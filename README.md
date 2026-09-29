AI Business Workflow

An AI powered email support workflow that receives business emails, classifies them, looks up customers, retrieves company policies, and plans actions such as creating tickets, updating CRM records, sending replies, or escalating issues.

Sensitive actions can pause for human approval before execution.

Architecture
Gmail → n8n → FastAPI → LangGraph + Groq
                    ↓
              Supabase / MCP
                    ↓
        Tickets • CRM • Replies • Escalations
                    ↓
              Human Approval
Tech Stack
AI: LangGraph, Groq
Backend: FastAPI, Python
Database: Supabase / PostgreSQL
Automation: n8n + Gmail
CRM: MCP server
Dashboard: Next.js
Observability: LangSmith
Deployment: Docker + Render

Key Features
AI email classification and information extraction
Customer lookup and policy-based decisions
Automatic ticket and escalation creation
Human-in-the-loop approval for sensitive actions
Resumable LangGraph workflows with checkpoints
Gmail integration through n8n
Admin dashboard for emails, tickets, escalations and approvals
Audit logging
LangSmith tracing
Dockerized deployment on Render
