"""Supabase data access for the API service (emails + audit log)."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from supabase import AsyncClient, acreate_client

from .config import get_settings

logger = logging.getLogger(__name__)

_client: AsyncClient | None = None


async def init_db() -> None:
    global _client
    settings = get_settings()
    _client = await acreate_client(settings.supabase_url, settings.supabase_key)


def client() -> AsyncClient:
    if _client is None:
        raise RuntimeError("Database not initialised; call init_db() first")
    return _client


async def insert_email(row: dict[str, Any]) -> dict[str, Any] | None:
    """Insert an inbound email. Returns None if message_id was already stored."""
    res = await (
        client()
        .table("emails")
        .upsert(row, on_conflict="message_id", ignore_duplicates=True)
        .execute()
    )
    return res.data[0] if res.data else None


async def get_email(email_id: str) -> dict[str, Any] | None:
    res = await client().table("emails").select("*").eq("id", email_id).limit(1).execute()
    return res.data[0] if res.data else None


async def list_emails(status: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    query = client().table("emails").select(
        "id, message_id, from_email, from_name, subject, status, classification, plan, error, created_at"
    )
    if status:
        query = query.eq("status", status)
    res = await query.order("created_at", desc=True).limit(limit).execute()
    return res.data


async def get_email_records(email_id: str) -> dict[str, list[dict[str, Any]]]:
    """Tickets, escalations and queued replies the agent created for an email."""
    records = {}
    for table in ("tickets", "escalations", "outbound_emails"):
        res = await client().table(table).select("*").eq("email_id", email_id).order("created_at").execute()
        records[table] = res.data
    return records


async def dashboard_stats(days: int) -> dict[str, Any]:
    res = await client().rpc("dashboard_stats", {"p_days": days}).execute()
    return res.data


async def list_tickets(status: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    query = client().table("tickets").select("*, customer:customers(name, email, company)")
    if status:
        query = query.eq("status", status)
    res = await query.order("created_at", desc=True).limit(limit).execute()
    return res.data


async def list_escalations(status: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    query = client().table("escalations").select("*, customer:customers(name, email, company)")
    if status:
        query = query.eq("status", status)
    res = await query.order("created_at", desc=True).limit(limit).execute()
    return res.data


async def list_customers(search: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    query = client().table("customers").select("*")
    # Drop characters that have meaning in a PostgREST or= filter or an ilike pattern.
    term = "".join(ch for ch in (search or "") if ch not in ',()*%\\"').strip()
    if term:
        query = query.or_(f"email.ilike.*{term}*,name.ilike.*{term}*,company.ilike.*{term}*")
    res = await query.order("created_at", desc=True).limit(limit).execute()
    return res.data


async def update_email(email_id: str, **fields: Any) -> None:
    await client().table("emails").update(fields).eq("id", email_id).execute()


async def transition_status(email_id: str, from_statuses: list[str], to_status: str) -> bool:
    """Atomically move an email between statuses. False if it was not in from_statuses."""
    res = await (
        client()
        .table("emails")
        .update({"status": to_status, "error": None})
        .eq("id", email_id)
        .in_("status", from_statuses)
        .execute()
    )
    return bool(res.data)


async def fail_stale_runs(older_than: timedelta) -> list[str]:
    """Mark emails stuck in received/processing for longer than older_than as failed. Returns their ids."""
    cutoff = (datetime.now(timezone.utc) - older_than).isoformat()
    res = await (
        client()
        .table("emails")
        .update({"status": "failed", "error": "The agent run was interrupted (server restart?). Retry to resume it."})
        .in_("status", ["received", "processing"])
        .lt("updated_at", cutoff)
        .execute()
    )
    return [row["id"] for row in res.data]


async def get_audit_log(email_id: str) -> list[dict[str, Any]]:
    res = await (
        client().table("audit_log").select("*").eq("email_id", email_id).order("created_at").execute()
    )
    return res.data


async def audit(
    event: str,
    email_id: str | None = None,
    actor: str = "system",
    details: dict[str, Any] | None = None,
) -> None:
    """Write an audit entry. Never raises: auditing must not break the workflow."""
    try:
        await client().table("audit_log").insert(
            {"event": event, "email_id": email_id, "actor": actor, "details": details or {}}
        ).execute()
    except Exception:
        logger.exception("Failed to write audit event %s for email %s", event, email_id)
