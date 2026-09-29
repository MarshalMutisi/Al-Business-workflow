from typing import Any, TypedDict


class AgentState(TypedDict, total=False):
    # Values are plain dicts (model_dump() of the schemas) so checkpoints stay JSON-friendly.
    email: dict[str, Any]
    classification: dict[str, Any]
    extracted: dict[str, Any]
    customer: dict[str, Any] | None
    policies: list[dict[str, Any]]
    plan: dict[str, Any]
    approval: dict[str, Any]
    results: list[dict[str, Any]]
