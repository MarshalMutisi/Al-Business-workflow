import asyncio
import logging
import secrets
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query, Request
from langchain_core.tracers.langchain import wait_for_all_tracers
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool, PoolTimeout
from pydantic import BaseModel, ConfigDict, EmailStr

from . import db
from .agent.graph import build_graph
from .agent.runner import WorkflowRunner
from .config import get_settings
from .mcp_servers.mcp_client import crm

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

settings = get_settings()


async def _use_langgraph_schema(conn: AsyncConnection) -> None:
    # Keep checkpoint tables out of the `public` schema that Supabase exposes over REST.
    await conn.execute("set search_path to langgraph")


# No agent run takes this long, so an email still received/processing after it lost its run.
STALE_RUN_AFTER = timedelta(minutes=10)


async def _fail_stale_runs() -> None:
    """Runs execute inside this process, so a restart (deploy, crash, out of memory) can leave an email stuck in
    'received' or 'processing'. Mark those failed so they can be retried from their last checkpoint."""
    while True:
        try:
            for email_id in await db.fail_stale_runs(STALE_RUN_AFTER):
                logger.warning("Email %s was left unfinished; marked failed so it can be retried", email_id)
                await db.audit("run_abandoned", email_id)
        except Exception:
            logger.exception("Stale run check failed")
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    async with AsyncConnectionPool(
        settings.database_url,
        min_size=1,
        # Small on purpose: Supabase's session pooler allows few connections, and n8n can share the database.
        max_size=5,
        open=False,
        kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row},
        configure=_use_langgraph_schema,
        check=AsyncConnectionPool.check_connection,
    ) as pool:
        try:
            await pool.wait(timeout=15)
        except PoolTimeout:
            raise RuntimeError(
                "Could not connect to Postgres with DATABASE_URL. For Supabase use the Session pooler "
                "connection string (Dashboard -> Connect -> Session pooler, host *.pooler.supabase.com, port 5432); "
                "the direct db.<ref>.supabase.co host is IPv6-only and fails on most home networks."
            ) from None
        checkpointer = AsyncPostgresSaver(pool)
        await checkpointer.setup()
        async with crm:
            app.state.runner = WorkflowRunner(build_graph(checkpointer))
            watcher = asyncio.create_task(_fail_stale_runs())
            try:
                yield
            finally:
                watcher.cancel()
    # Send any LangSmith traces still buffered before the process exits.
    wait_for_all_tracers()


app = FastAPI(title="AI Business Workflow", lifespan=lifespan)


def _same(a: str, b: str) -> bool:
    return secrets.compare_digest(a.encode(), b.encode())


async def require_admin(x_api_key: str = Header(...)) -> None:
    if not _same(x_api_key, settings.admin_api_key):
        raise HTTPException(401, "Bad API key")


class IncomingEmail(BaseModel):
    message_id: str
    thread_id: str | None = None
    from_email: EmailStr
    from_name: str | None = None
    to: str
    subject: str
    body_text: str
    received_at: datetime
    attachments: list[dict] = []


class ApprovalDecision(BaseModel):
    approved: bool
    reviewer: str
    note: str | None = None
    # Only set this to replace the AI's reply; omit it to send plan.reply_draft as-is.
    edited_reply: str | None = None

    model_config = ConfigDict(
        json_schema_extra={"examples": [{"approved": True, "reviewer": "your-name", "note": "Looks good"}]}
    )


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.post("/webhooks/email", status_code=202)
async def receive_email(
    email: IncomingEmail,
    request: Request,
    background: BackgroundTasks,
    x_webhook_secret: str = Header(...),
):
    if not _same(x_webhook_secret, settings.webhook_secret):
        raise HTTPException(401, "Bad secret")

    row = await db.insert_email(
        {
            "message_id": email.message_id,
            "thread_id": email.thread_id,
            "from_email": str(email.from_email).lower(),
            "from_name": email.from_name,
            "to_email": email.to,
            "subject": email.subject,
            "body_text": email.body_text,
            "received_at": email.received_at.isoformat(),
            "attachments": email.attachments,
        }
    )
    if row is None:
        await db.audit("email_duplicate", details={"message_id": email.message_id})
        return {"status": "duplicate", "message_id": email.message_id}

    await db.audit(
        "email_received", row["id"], actor="webhook", details={"from": row["from_email"], "subject": email.subject}
    )
    background.add_task(request.app.state.runner.process, row)
    return {"status": "accepted", "message_id": email.message_id, "email_id": row["id"]}


@app.get("/auth/check", dependencies=[Depends(require_admin)])
async def auth_check():
    """Lets the dashboard verify an API key at login."""
    return {"ok": True}


@app.get("/stats", dependencies=[Depends(require_admin)])
async def stats(days: int = Query(14, ge=1, le=90)):
    return await db.dashboard_stats(days)


@app.get("/tickets", dependencies=[Depends(require_admin)])
async def list_tickets(status: str | None = None, limit: int = 50):
    return await db.list_tickets(status, min(limit, 200))


@app.get("/escalations", dependencies=[Depends(require_admin)])
async def list_escalations(status: str | None = None, limit: int = 50):
    return await db.list_escalations(status, min(limit, 200))


@app.get("/customers", dependencies=[Depends(require_admin)])
async def list_customers(search: str | None = None, limit: int = 50):
    return await db.list_customers(search, min(limit, 200))


@app.get("/emails", dependencies=[Depends(require_admin)])
async def list_emails(status: str | None = None, limit: int = 50):
    return await db.list_emails(status, min(limit, 200))


@app.get("/emails/{email_id}", dependencies=[Depends(require_admin)])
async def get_email(email_id: str):
    email = await db.get_email(email_id)
    if email is None:
        raise HTTPException(404, "Email not found")
    return {**email, **await db.get_email_records(email_id), "audit_log": await db.get_audit_log(email_id)}


@app.post("/emails/{email_id}/approval", status_code=202, dependencies=[Depends(require_admin)])
async def decide_approval(email_id: str, decision: ApprovalDecision, request: Request, background: BackgroundTasks):
    if not await db.transition_status(email_id, ["awaiting_approval"], "processing"):
        raise HTTPException(409, "Email is not awaiting approval")
    await db.audit(
        "approval_granted" if decision.approved else "approval_rejected",
        email_id,
        actor=decision.reviewer,
        details=decision.model_dump(),
    )
    background.add_task(request.app.state.runner.resume, email_id, decision.model_dump())
    return {"status": "resuming", "email_id": email_id}


@app.post("/emails/{email_id}/retry", status_code=202, dependencies=[Depends(require_admin)])
async def retry_email(email_id: str, request: Request, background: BackgroundTasks):
    email = await db.get_email(email_id)
    if email is None:
        raise HTTPException(404, "Email not found")
    if not await db.transition_status(email_id, ["failed", "received"], "processing"):
        raise HTTPException(409, f"Email is {email['status']}; only failed or received emails can be retried")
    await db.audit("retry_requested", email_id, actor="admin")
    background.add_task(request.app.state.runner.retry, email)
    return {"status": "retrying", "email_id": email_id}


def main():
    import uvicorn

    uvicorn.run(
        "ai_bussiness_workflow.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        # psycopg's async driver needs a selector event loop on Windows.
        loop="asyncio:SelectorEventLoop" if sys.platform == "win32" else "auto",
    )
