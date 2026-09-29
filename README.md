# AI Business Workflow

Receives inbound business email by webhook, and an AI agent (LangGraph + Groq) classifies it,
looks up the customer, reads company policies and plans actions (tickets, CRM updates, replies,
escalations). Sensitive plans pause for human approval. Everything is stored in Supabase.

```
webhook ─► emails table ─► classify ─► extract ─► lookup_customer ─► retrieve_policy ─► plan_action
                              │ spam                                                   │
                              ▼                                           needs approval? ──yes──► human_approval (pauses)
                             END                                                       │ no            │ approved
                                                                                       ▼               ▼
                                                                                execute_actions ◄──────┘
                                                                          (via CRM MCP server → Supabase)
```

## Setup

1. **Create a Supabase project** at https://supabase.com.
2. **Create the tables**: in the dashboard open *SQL Editor → New query*, paste
   [supabase/migrations/20260928000000_init.sql](supabase/migrations/20260928000000_init.sql) and click *Run*.
   Edit the starter rows in the `policies` table to match your business.
3. **Configure**: copy `.env.example` to `.env` and fill in every value (the comments say where to find each one).
4. **Install and run**:
   ```
   uv sync
   uv run ai-bussiness-workflow
   ```
   The API runs on http://localhost:8000, with interactive docs at http://localhost:8000/docs.
   On first start it creates the LangGraph checkpoint tables in the `langgraph` schema.
5. **Send a test email** (in a second terminal):
   ```
   uv run python scripts/send_test_email.py billing
   ```

## API

| Endpoint | Auth header | Purpose |
|---|---|---|
| `POST /webhooks/email` | `X-Webhook-Secret` | Receive an email (duplicates by `message_id` are ignored) |
| `GET /emails?status=awaiting_approval` | `X-API-Key` | List emails, optionally by status |
| `GET /emails/{id}` | `X-API-Key` | Email, agent output, created tickets/escalations/replies and audit trail |
| `POST /emails/{id}/approval` | `X-API-Key` | Approve/reject a paused plan: `{"approved": true, "reviewer": "you"}` — add `"edited_reply": "..."` only to replace the AI reply |
| `POST /emails/{id}/retry` | `X-API-Key` | Re-run a failed email from its last checkpoint |
| `GET /stats?days=14` | `X-API-Key` | Dashboard aggregates (needs the `dashboard_stats` migration) |
| `GET /tickets`, `/escalations` `?status=` | `X-API-Key` | List tickets / escalations with their customer |
| `GET /customers?search=` | `X-API-Key` | List or search customers |
| `GET /auth/check` | `X-API-Key` | 200 if the key is valid (used by the dashboard login) |

Email statuses: `received → processing → completed | awaiting_approval | rejected | ignored | failed`.

## When does a plan need approval?

Any of: the model asks for it, classification confidence is below `APPROVAL_CONFIDENCE_THRESHOLD`,
the category is `billing` or `cancellation`, the email is urgent and negative, or
`ALWAYS_REQUIRE_APPROVAL=true`.

## Supabase tables

`customers`, `emails`, `tickets`, `outbound_emails`, `escalations`, `policies`, `audit_log`.
Row Level Security is on with no policies, so only the backend (service role key) can access them.

## Gmail via n8n (receiving and sending)

One importable workflow, [n8n/Email-intake.json](n8n/Email-intake.json), has two branches:

- **Intake**: Gmail Trigger (every minute, Primary inbox) → Code (maps to `IncomingEmail`, full body text) →
  `POST /webhooks/email`. The Gmail message id becomes `message_id`, so replies land in the same thread.
- **Replies**: every minute, calls `claim_outbound_emails()` in Supabase, sends each reply with Gmail (in-thread
  reply when the email came from Gmail, otherwise a new email), then reports the result with
  `complete_outbound_email()`. Failed sends are retried up to 3 times, then marked `failed`. Every outcome is
  written to `audit_log`.

Replies are not sent straight after intake because the agent runs in the background and some plans wait for
human approval; the reply branch sends whatever has been approved.

Delivery statuses in `outbound_emails`: `queued → sending → sent`, or back to `queued` on failure, then `failed` after 3 attempts.

Setup (self-hosted n8n in Docker):

1. Run [supabase/migrations/20260928120000_outbound_delivery.sql](supabase/migrations/20260928120000_outbound_delivery.sql) if you have not.
2. **Gmail credential**. Self-hosted n8n needs your own Google OAuth app:
   Google Cloud Console → new project → enable **Gmail API** → OAuth consent screen (External, add your Gmail as a
   test user) → Credentials → OAuth client ID (Web application) with redirect URI
   `http://localhost:5678/rest/oauth2-credential/callback`. In n8n create a **Gmail OAuth2** credential with that
   client ID/secret and sign in. While the Google app is in *Testing*, the sign-in expires every 7 days; publish the app to avoid that.
3. **Supabase credential** in n8n: Host `https://<project-ref>.supabase.co`, Service Role Secret = `SUPABASE_SERVICE_ROLE_KEY`.
4. **Header Auth credential** in n8n: Name `X-Webhook-Secret`, Value = your `WEBHOOK_SECRET`.
5. In n8n: *Workflows → Import from file* → `Email-intake.json`, select the credentials on the HTTP Request nodes, then **Activate**.

n8n reaches the API at `http://host.docker.internal:8000` (Docker Desktop). The API must be running and bound to
`0.0.0.0` (the default here). On Linux Docker, start n8n with `--add-host=host.docker.internal:host-gateway`.

## Tracing with LangSmith

Set `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY` and `LANGSMITH_PROJECT` in `.env`. Every agent run then appears
in that LangSmith project as an `email_workflow` trace: each graph node, the Groq calls with their prompts and
structured outputs, and each CRM MCP call (`crm.find_customer`, `crm.create_ticket`, ...). Runs are tagged `start`
or `resume`, and the first run and the post-approval run of an email share its `thread_id` (the email id), so the
*Threads* tab shows them together.

Traces contain the full email text and customer records. To keep those out of LangSmith, set
`LANGSMITH_HIDE_INPUTS=true` and `LANGSMITH_HIDE_OUTPUTS=true`.

## Dashboard

A Next.js admin dashboard in [dashboard/](dashboard/): overview charts, the email list, approve/reject (with reply
editing), retry of failed runs, tickets, escalations and customers.

The dashboard only talks to FastAPI, never to Supabase, so RLS stays locked down and the service-role key stays
in the API. You sign in with `ADMIN_API_KEY`; it is kept in an httpOnly cookie and sent to the API from the Next.js
server, so browser JavaScript never sees it.

1. Run [supabase/migrations/20260929000000_dashboard_stats.sql](supabase/migrations/20260929000000_dashboard_stats.sql)
   in the Supabase SQL Editor (adds the `dashboard_stats` function behind `GET /stats`).
2. Start the API (`uv run ai-bussiness-workflow`).
3. In a second terminal:
   ```
   cd dashboard
   copy .env.example .env.local
   npm install
   npm run dev
   ```
4. Open http://localhost:3000 and sign in with your `ADMIN_API_KEY`.

For production run `npm run build` then `npm start`, serve it over HTTPS (the session cookie is `Secure` in
production), and keep the FastAPI admin endpoints off the public internet if only the dashboard needs them.

## Deploying to Render

[render.yaml](render.yaml) is a Render Blueprint for three services, all on the free plan in Frankfurt
(closest to the Supabase project in London):

| Service | What | Notes |
|---|---|---|
| `workflow-api` | FastAPI + agent, built from the [Dockerfile](Dockerfile) | Sleeps when idle; n8n's webhook call wakes it (first email after a quiet spell waits ~1 min) |
| `workflow-dashboard` | Next.js dashboard | Sleeps when idle; wakes when you open it |
| `workflow-n8n` | n8n Community Edition (free, self-hosted), Docker image `n8nio/n8n` | Stores workflows and credentials in the Supabase `n8n` schema, so restarts lose nothing |

### Free tier limits

- Free services sleep after 15 minutes without incoming requests. A sleeping n8n does not run its Gmail
  trigger or reply sender, so keep it awake with a free uptime monitor (e.g. UptimeRobot or cron-job.org) that
  requests `https://<your-n8n>.onrender.com/healthz` every 5-10 minutes.
- Render gives each workspace a monthly budget of free instance hours (check Render's current limits). An n8n
  that is always awake uses nearly all of it, and the API and dashboard use more whenever they are awake, so late
  in the month Render may suspend free services. That is fine for testing. For real use, switch `workflow-n8n`
  to the paid Starter plan (`plan: starter`); the API and dashboard then fit comfortably in the free hours.
- Free instances have 512 MB of memory. The API uses about 200 MB and an idle n8n about 320 MB.

### One-time setup

1. **Push this repo to GitHub.**
2. **Supabase**: in the SQL Editor run
   [supabase/migrations/20260929120000_n8n_schema.sql](supabase/migrations/20260929120000_n8n_schema.sql)
   (and `20260929000000_dashboard_stats.sql` if you have not yet).
3. **Render**: *New → Blueprint*, pick the repo. Fill in the prompted values:
   - API: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `GROQ_API_KEY` (same as your `.env`).
   - Dashboard `API_URL`: `https://workflow-api.onrender.com`.
   - n8n `WEBHOOK_URL`: `https://workflow-n8n.onrender.com/`. `DB_POSTGRESDB_HOST`, `DB_POSTGRESDB_USER` and
     `DB_POSTGRESDB_PASSWORD` come from your `DATABASE_URL`
     (`postgresql://<USER>:<PASSWORD>@<HOST>:5432/postgres`).

   If Render gives a service a different URL (it adds a suffix when the name is taken), correct `API_URL`
   and `WEBHOOK_URL` under each service's *Environment* tab afterwards.
4. **Google Cloud**: add `https://workflow-n8n.onrender.com/rest/oauth2-credential/callback` to the OAuth
   client's redirect URIs, and publish the app (*OAuth consent screen → Publish*) so the Gmail sign-in
   stops expiring every 7 days.
5. **n8n** (open the n8n URL, create the owner account):
   - Create the three credentials as in [Gmail via n8n](#gmail-via-n8n-receiving-and-sending). The Header Auth
     value is the API's `WEBHOOK_SECRET`, generated by Render (API service → *Environment*).
   - Import [n8n/Email-intake.json](n8n/Email-intake.json). In the node that posts to `/webhooks/email`,
     change the URL from `http://host.docker.internal:8000/...` to `https://workflow-api.onrender.com/webhooks/email`.
   - Select the credentials on each node and **Activate** the workflow.
6. **Uptime monitor** on `https://workflow-n8n.onrender.com/healthz` (see above).
7. **Dashboard**: open `https://workflow-dashboard.onrender.com` and sign in with the API's `ADMIN_API_KEY`
   (generated by Render, API service → *Environment*).

### Deploying changes

Push to the repo's default branch and Render redeploys what changed: changes under `dashboard/` redeploy only
the dashboard; changes to the backend code redeploy only the API. n8n workflows live in n8n's database, not
in git: edit them in the n8n editor (export back to `n8n/Email-intake.json` to keep the repo copy current).
To upgrade n8n, change the image tag in `render.yaml`.

If the API restarts in the middle of an agent run (a deploy, a crash), that email would be stuck. The API checks
every minute and marks emails left in `received` or `processing` for over 10 minutes as `failed`; retry them
from the dashboard and they resume from their last checkpoint.

## Windows note

psycopg's async driver needs a selector event loop on Windows. `uv run ai-bussiness-workflow` sets this
up; if you start uvicorn yourself add `--loop asyncio:SelectorEventLoop`.
#   A l - B u s i n e s s - w o r k f l o w  
 