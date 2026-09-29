"""Runs the agent graph for an email and mirrors its progress into Supabase."""

import logging
from typing import Any

from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Command, StateSnapshot

from .. import db

logger = logging.getLogger(__name__)

EMAIL_STATE_FIELDS = ("id", "message_id", "thread_id", "from_email", "from_name", "subject", "body_text", "received_at")


class WorkflowRunner:
    def __init__(self, graph: CompiledStateGraph) -> None:
        self.graph = graph

    @staticmethod
    def _config(email_id: str) -> dict[str, Any]:
        # One LangGraph thread per email, so an approval can resume exactly where it paused.
        return {"configurable": {"thread_id": email_id}}

    async def process(self, email_row: dict[str, Any]) -> None:
        """Run a freshly received email."""
        if not await db.transition_status(email_row["id"], ["received"], "processing"):
            return  # already picked up by another run
        await self._start(email_row)

    async def _start(self, email_row: dict[str, Any]) -> None:
        email = {k: email_row.get(k) for k in EMAIL_STATE_FIELDS}
        await self._run(email_row["id"], {"email": email})

    async def resume(self, email_id: str, decision: dict[str, Any]) -> None:
        """Continue a run paused at human_approval. Status must already be 'processing'."""
        await self._run(email_id, Command(resume=decision))

    async def retry(self, email_row: dict[str, Any]) -> None:
        """Re-run a failed email, continuing from its last checkpoint if there is one.
        Status must already be 'processing'."""
        snapshot = await self.graph.aget_state(self._config(email_row["id"]))
        if snapshot.next:
            await self._run(email_row["id"], None)
        else:
            await self._start(email_row)

    async def _run(self, email_id: str, graph_input: Any) -> None:
        config = self._config(email_id)
        is_start = isinstance(graph_input, dict)
        await db.audit("agent_started" if is_start else "agent_resumed", email_id)
        # Labels the LangSmith trace; thread_id (copied into its metadata) groups an email's runs into one thread.
        trace_config = {**config, "run_name": "email_workflow", "tags": ["start" if is_start else "resume"]}
        try:
            await self.graph.ainvoke(graph_input, trace_config)
            snapshot = await self.graph.aget_state(config)
        except Exception as exc:
            logger.exception("Agent run failed for email %s", email_id)
            await db.update_email(email_id, status="failed", error=f"{type(exc).__name__}: {exc}"[:2000])
            await db.audit("agent_failed", email_id, details={"error": str(exc)[:2000]})
            return

        status = self._status(snapshot)
        values = snapshot.values
        await db.update_email(
            email_id,
            status=status,
            classification=values.get("classification"),
            extracted=values.get("extracted"),
            plan=values.get("plan"),
            approval=values.get("approval"),
            results=values.get("results"),
            error=None,
        )
        await db.audit(
            f"agent_{status}",
            email_id,
            details={
                "approval_reasons": (values.get("plan") or {}).get("approval_reasons"),
                "results": values.get("results"),
            },
        )

    @staticmethod
    def _status(snapshot: StateSnapshot) -> str:
        values = snapshot.values
        if snapshot.next:
            return "awaiting_approval"
        if "plan" not in values:
            return "ignored"  # stopped after classify (spam)
        if "approval" in values and not values["approval"].get("approved"):
            return "rejected"
        return "completed"
