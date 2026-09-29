from pydantic import BaseModel, Field
from typing import Literal

class Classification(BaseModel):
    category: Literal["billing", "support", "sales_lead", "cancellation", "spam", "other"]
    urgency: Literal["low", "medium", "high"]
    sentiment: Literal["positive", "neutral", "negative"]
    confidence: float = Field(ge=0, le=1)

class ExtractedInfo(BaseModel):
    customer_name: str | None = None
    order_id: str | None = None
    product: str | None = None
    amount: float | None = None
    summary: str = Field(description="One sentence describing the request")

class Action(BaseModel):
    type: Literal["create_ticket", "update_customer", "send_reply", "escalate"]
    params: dict

class ActionPlan(BaseModel):
    actions: list[Action]
    reply_draft: str
    reasoning: str
    requires_approval: bool