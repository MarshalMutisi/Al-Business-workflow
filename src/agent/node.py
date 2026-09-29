from langchain_groq import ChatGroq
from langgraph.types import interrupt
from .schemas import Classification, ExtractedInfo, ActionPlan
from .mcp_client import call_tool
from ..db import audit_log, search_policies

llm = ChatGroq(model="llama3.3-70b-versatile", temperature=0)

async def classify(state):
    e = state["email"]
    result = await llm.with_structured_output(Classification).ainvoke(
        f"Classify this customer email.\nSubject: {e['subject']}\n\n{e['body_text']}"
    )
    await audit_log("classified", state["email_id"], result.model_dump())
    return {"classification": result}

async def extract(state):
    e = state["email"]
    result = await llm.with_structured_output(ExtractedInfo).ainvoke(
        f"Extract details from this email. Use null if missing.\n\n{e['body_text']}"
    )
    return {"extracted": result}

async def lookup_customer(state):
    customer = await call_tool("crm", "search_customer",
                               {"email": state["email"]["from_email"]})
    return {"customer": customer}

async def retrieve_policy(state):
    docs = await search_policies(state["extracted"].summary, k=3)  # pgvector
    return {"policy_docs": docs}

async def plan_action(state):
    prompt = f"""You handle support emails for Acme.
Category: {state['classification'].category}
Details: {state['extracted'].model_dump()}
Customer record: {state['customer']}
Relevant policy:
{chr(10).join(state['policy_docs'])}

Decide which actions to take and draft a reply. Only promise what the policy allows.
Set requires_approval=true for refunds, cancellations, or anything uncertain."""
    plan = await llm.with_structured_output(ActionPlan).ainvoke(prompt)

    # Your rules override the LLM: low confidence or high urgency always needs a human
    if state["classification"].confidence < 0.8 or state["classification"].urgency == "high":
        plan.requires_approval = True

    await audit_log("plan_created", state["email_id"], plan.model_dump())
    return {"plan": plan}

async def human_approval(state):
    # Graph pauses here and is saved to Postgres. Resumes when a human responds.
    decision = interrupt({
        "email": state["email"],
        "plan": state["plan"].model_dump(),
    })
    await audit_log("approval_decision", state["email_id"], decision)
    return {"approval": decision}

async def execute_actions(state):
    plan = state["plan"]
    reply = state.get("approval", {}).get("edited_reply") or plan.reply_draft
    results = []
    for i, action in enumerate(plan.actions):
        params = dict(action.params)
        if action.type == "send_reply":
            params = {"to": state["email"]["from_email"],
                      "subject": "Re: " + state["email"]["subject"], "body": reply}
        params["idempotency_key"] = f"{state['email_id']}:{i}:{action.type}"
        server = {"create_ticket": "tickets", "update_customer": "crm",
                  "send_reply": "email", "escalate": "tickets"}[action.type]
        result = await call_tool(server, action.type, params)
        results.append({"action": action.type, "result": result})
        await audit_log("action_executed", state["email_id"], results[-1])
    return {"results": results}