"""CRM MCP server backed by Supabase.

Exposes the CRM operations the agent is allowed to perform as MCP tools. The API
starts it automatically over stdio; to run it standalone (e.g. with the MCP
inspector):  uv run python -m ai_bussiness_workflow.mcp_servers.crm_server
"""

import logging
from typing import Any, Literal

from mcp.server.mcpserver import MCPServer
from supabase import AsyncClient, acreate_client

from ai_bussiness_workflow.config import require_env

# stdout is the MCP transport; logs must go to stderr (logging's default).
logging.basicConfig(level=logging.INFO, format="[crm] %(levelname)s %(message)s")

mcp = MCPServer("crm", instructions="CRM for customers, tickets, replies, escalations and policies.")

Category = Literal["billing", "support", "sales_lead", "cancellation", "spam", "other"]
Priority = Literal["low", "medium", "high", "urgent"]

_db: AsyncClient | None = None


async def db() -> AsyncClient:
    global _db
    if _db is None:
        _db = await acreate_client(require_env("SUPABASE_URL"), require_env("SUPABASE_SERVICE_ROLE_KEY"))
    return _db


async def _insert_once(table: str, row: dict[str, Any]) -> dict[str, Any]:
    """Insert keyed by idempotency_key; return the existing row if it was already inserted."""
    client = await db()
    res = await (
        client.table(table).upsert(row, on_conflict="idempotency_key", ignore_duplicates=True).execute()
    )
    if res.data:
        return res.data[0]
    existing = await (
        client.table(table).select("*").eq("idempotency_key", row["idempotency_key"]).limit(1).execute()
    )
    return existing.data[0]


@mcp.tool()
async def find_customer(email: str) -> dict[str, Any]:
    """Look up a customer by email address. Returns {"customer": null} if unknown."""
    client = await db()
    res = await client.table("customers").select("*").eq("email", email.strip().lower()).limit(1).execute()
    return {"customer": res.data[0] if res.data else None}


@mcp.tool()
async def get_policies(category: Category) -> dict[str, Any]:
    """Return the active policies for a category, plus general policies."""
    client = await db()
    res = await (
        client.table("policies")
        .select("category, title, content")
        .in_("category", [category, "general"])
        .eq("active", True)
        .execute()
    )
    return {"policies": res.data}


@mcp.tool()
async def upsert_customer(
    email: str,
    name: str | None = None,
    company: str | None = None,
    phone: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    """Create the customer if new, otherwise update the provided fields."""
    client = await db()
    row: dict[str, Any] = {"email": email.strip().lower()}
    row.update({k: v for k, v in {"name": name, "company": company, "phone": phone, "notes": notes}.items() if v})
    res = await client.table("customers").upsert(row, on_conflict="email").execute()
    return {"customer": res.data[0]}


@mcp.tool()
async def create_ticket(
    idempotency_key: str,
    email_id: str,
    subject: str,
    description: str,
    category: Category,
    priority: Priority = "medium",
    customer_id: str | None = None,
) -> dict[str, Any]:
    """Open a ticket for the team."""
    ticket = await _insert_once(
        "tickets",
        {
            "idempotency_key": idempotency_key,
            "email_id": email_id,
            "customer_id": customer_id,
            "subject": subject,
            "description": description,
            "category": category,
            "priority": priority,
        },
    )
    return {"ticket": ticket}


@mcp.tool()
async def queue_reply(
    idempotency_key: str,
    email_id: str,
    to_email: str,
    subject: str,
    body: str,
    in_reply_to: str | None = None,
) -> dict[str, Any]:
    """Queue a reply email for delivery."""
    reply = await _insert_once(
        "outbound_emails",
        {
            "idempotency_key": idempotency_key,
            "email_id": email_id,
            "to_email": to_email,
            "subject": subject,
            "body": body,
            "in_reply_to": in_reply_to,
        },
    )
    return {"reply": reply}


@mcp.tool()
async def escalate(
    idempotency_key: str,
    email_id: str,
    reason: str,
    customer_id: str | None = None,
) -> dict[str, Any]:
    """Escalate the conversation to a human team."""
    escalation = await _insert_once(
        "escalations",
        {"idempotency_key": idempotency_key, "email_id": email_id, "customer_id": customer_id, "reason": reason},
    )
    return {"escalation": escalation}


if __name__ == "__main__":
    mcp.run(transport="stdio")
