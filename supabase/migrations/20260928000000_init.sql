-- AI Business Workflow: initial schema.
-- Run this in the Supabase dashboard (SQL Editor -> New query -> paste -> Run),
-- or with the Supabase CLI: `supabase db push`.

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- CRM
-- ---------------------------------------------------------------------------
create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique check (email = lower(email)),
  name        text,
  company     text,
  phone       text,
  plan        text,
  status      text not null default 'active',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Inbound email + agent run state
-- ---------------------------------------------------------------------------
create table public.emails (
  id              uuid primary key default gen_random_uuid(),
  message_id      text not null unique,
  thread_id       text,
  from_email      text not null,
  from_name       text,
  to_email        text not null,
  subject         text not null,
  body_text       text not null,
  received_at     timestamptz not null,
  attachments     jsonb not null default '[]'::jsonb,
  status          text not null default 'received'
                  check (status in ('received', 'processing', 'awaiting_approval',
                                    'completed', 'rejected', 'ignored', 'failed')),
  classification  jsonb,
  extracted       jsonb,
  plan            jsonb,
  approval        jsonb,
  results         jsonb,
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index emails_status_idx on public.emails (status, created_at desc);
create index emails_from_email_idx on public.emails (from_email);

-- ---------------------------------------------------------------------------
-- Actions the agent can take (idempotency_key makes node retries safe)
-- ---------------------------------------------------------------------------
create table public.tickets (
  id               uuid primary key default gen_random_uuid(),
  idempotency_key  text not null unique,
  email_id         uuid references public.emails (id) on delete set null,
  customer_id      uuid references public.customers (id) on delete set null,
  subject          text not null,
  description      text not null,
  category         text,
  priority         text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status           text not null default 'open' check (status in ('open', 'pending', 'resolved', 'closed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Replies are queued here; a sender job / email provider integration delivers them.
create table public.outbound_emails (
  id               uuid primary key default gen_random_uuid(),
  idempotency_key  text not null unique,
  email_id         uuid references public.emails (id) on delete set null,
  to_email         text not null,
  subject          text not null,
  body             text not null,
  in_reply_to      text,
  status           text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  sent_at          timestamptz,
  created_at       timestamptz not null default now()
);

create table public.escalations (
  id               uuid primary key default gen_random_uuid(),
  idempotency_key  text not null unique,
  email_id         uuid references public.emails (id) on delete set null,
  customer_id      uuid references public.customers (id) on delete set null,
  reason           text not null,
  status           text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  assigned_to      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Knowledge the agent must follow when planning
-- ---------------------------------------------------------------------------
create table public.policies (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('billing', 'support', 'sales_lead', 'cancellation',
                                                'spam', 'other', 'general')),
  title       text not null,
  content     text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index policies_category_idx on public.policies (category) where active;

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  email_id    uuid references public.emails (id) on delete set null,
  event       text not null,
  actor       text not null default 'system',
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_email_idx on public.audit_log (email_id, created_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger customers_updated_at   before update on public.customers   for each row execute function public.set_updated_at();
create trigger emails_updated_at      before update on public.emails      for each row execute function public.set_updated_at();
create trigger tickets_updated_at     before update on public.tickets     for each row execute function public.set_updated_at();
create trigger escalations_updated_at before update on public.escalations for each row execute function public.set_updated_at();
create trigger policies_updated_at    before update on public.policies    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Security: RLS on with no policies = only the backend (service role) can
-- read/write. The public anon key gets nothing.
-- ---------------------------------------------------------------------------
alter table public.customers       enable row level security;
alter table public.emails          enable row level security;
alter table public.tickets         enable row level security;
alter table public.outbound_emails enable row level security;
alter table public.escalations     enable row level security;
alter table public.policies        enable row level security;
alter table public.audit_log       enable row level security;

-- LangGraph checkpoint tables are created here by the app on startup, outside
-- the `public` schema so they are never exposed through the Supabase REST API.
create schema if not exists langgraph;
revoke all on schema langgraph from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Starter policies (edit these to match your business)
-- ---------------------------------------------------------------------------
insert into public.policies (category, title, content) values
  ('general', 'Tone', 'Be warm, concise and professional. Never promise anything not covered by a policy. Sign replies as "The Support Team".'),
  ('billing', 'Refunds', 'Refunds are available within 30 days of purchase. Refunds over $100 or outside 30 days need manager approval. Never confirm a refund in the reply; say it is being reviewed.'),
  ('billing', 'Invoices', 'Customers can request invoice copies at any time. Create a ticket for the finance team.'),
  ('support', 'Support SLA', 'Acknowledge every support request. High urgency issues get a ticket with priority high and a reply within 1 business hour.'),
  ('sales_lead', 'New leads', 'Thank the prospect, create or update their customer record with company details, and create a ticket for the sales team.'),
  ('cancellation', 'Cancellations', 'Always acknowledge cancellation requests, ask if there is anything we can do to help, and escalate to the retention team. Do not process cancellations automatically.');
