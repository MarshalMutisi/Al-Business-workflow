from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.types import RetryPolicy
from .state import AgentState
from . import nodes

SPAM_CONFIDENCE = 0.8

def route_after_classify(state):
    c = state["classification"]
    return END if c["category"] == "spam" and c["confidence"] >= SPAM_CONFIDENCE else "extract"

def route_after_plan(state):
    return "human_approval" if state["plan"]["requires_approval"] else "execute_actions"

def route_after_approval(state):
    return "execute_actions" if state["approval"].get("approved") else END

def build_graph(checkpointer: AsyncPostgresSaver):
    g = StateGraph(AgentState)
    retry = RetryPolicy(max_attempts=3)

    g.add_node("classify", nodes.classify, retry_policy=retry)
    g.add_node("extract", nodes.extract, retry_policy=retry)
    g.add_node("lookup_customer", nodes.lookup_customer, retry_policy=retry)
    g.add_node("retrieve_policy", nodes.retrieve_policy)
    g.add_node("plan_action", nodes.plan_action, retry_policy=retry)
    g.add_node("human_approval", nodes.human_approval)
    g.add_node("execute_actions", nodes.execute_actions, retry_policy=retry)

    g.add_edge(START, "classify")
    g.add_conditional_edges("classify", route_after_classify, ["extract", END])
    g.add_edge("extract", "lookup_customer")
    g.add_edge("lookup_customer", "retrieve_policy")
    g.add_edge("retrieve_policy", "plan_action")
    g.add_conditional_edges("plan_action", route_after_plan, ["human_approval", "execute_actions"])
    g.add_conditional_edges("human_approval", route_after_approval, ["execute_actions", END])
    g.add_edge("execute_actions", END)

    return g.compile(checkpointer=checkpointer)
