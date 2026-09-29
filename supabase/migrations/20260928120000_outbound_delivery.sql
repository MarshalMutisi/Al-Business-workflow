-- Delivery of queued replies by an external sender (n8n).
-- n8n calls claim_outbound_emails() on a schedule, sends each row, then reports
-- back with complete_outbound_email(). Claiming marks rows 'sending' atomically,
-- so overlapping runs never send the same reply twice.

alter table public.outbound_emails
  drop constraint outbound_emails_status_check,
  add constraint outbound_emails_status_check check (status in ('queued', 'sending', 'sent', 'failed')),
  add column attempts             int not null default 0,
  add column claimed_at           timestamptz,
  add column provider_message_id  text,
  add column error                text;

create index outbound_emails_status_idx on public.outbound_emails (status, created_at);

-- A claimed row whose sender never reported back is retried after this long.
-- After 3 attempts it is marked failed instead.
create or replace function public.claim_outbound_emails(p_limit int default 10)
returns setof public.outbound_emails
language plpgsql
set search_path = ''
as $$
begin
  update public.outbound_emails
     set status = 'failed', error = coalesce(error, 'Sender stalled on every attempt')
   where status = 'sending' and claimed_at < now() - interval '15 minutes' and attempts >= 3;

  return query
  update public.outbound_emails o
     set status = 'sending', claimed_at = now(), attempts = o.attempts + 1
   where o.id in (
           select id from public.outbound_emails
            where status = 'queued'
               or (status = 'sending' and claimed_at < now() - interval '15 minutes')
            order by created_at
            limit p_limit
            for update skip locked)
  returning o.*;
end;
$$;

-- Report the result of sending a claimed row. Failures go back to 'queued'
-- for another try, until the 3rd attempt, which marks the row 'failed'.
create or replace function public.complete_outbound_email(
  p_id uuid,
  p_success boolean,
  p_error text default null,
  p_provider_message_id text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_row public.outbound_emails;
begin
  update public.outbound_emails
     set status = case when p_success then 'sent' when attempts >= 3 then 'failed' else 'queued' end,
         sent_at = case when p_success then now() else sent_at end,
         provider_message_id = coalesce(p_provider_message_id, provider_message_id),
         error = case when p_success then null else left(p_error, 2000) end
   where id = p_id and status = 'sending'
  returning * into v_row;

  if found then
    insert into public.audit_log (email_id, event, actor, details)
    values (
      v_row.email_id,
      case v_row.status when 'sent' then 'reply_sent' when 'failed' then 'reply_failed' else 'reply_send_retry' end,
      'n8n',
      jsonb_build_object('outbound_email_id', v_row.id, 'attempts', v_row.attempts,
                         'provider_message_id', v_row.provider_message_id, 'error', v_row.error)
    );
  end if;
end;
$$;

-- Only the backend / n8n (service role) may call these over the REST API.
revoke execute on function public.claim_outbound_emails(int) from public, anon, authenticated;
revoke execute on function public.complete_outbound_email(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.claim_outbound_emails(int) to service_role;
grant execute on function public.complete_outbound_email(uuid, boolean, text, text) to service_role;
