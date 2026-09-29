-- Aggregates for the admin dashboard, computed in one round trip.
-- Days are UTC. Called by the API only (service role); anon/authenticated cannot execute it.

create or replace function public.dashboard_stats(p_days int default 14)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with window_start as (
    select date_trunc('day', now()) - make_interval(days => p_days - 1) as ts
  ),
  recent as (
    select e.created_at, e.status, e.classification, e.plan
      from public.emails e, window_start w
     where e.created_at >= w.ts
  )
  select jsonb_build_object(
    'days', p_days,
    'recent_total', (select count(*) from recent),
    'avg_confidence', (select round(avg((classification->>'confidence')::numeric), 3) from recent),
    'emails_by_status', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
        from (select status, count(*) as n from public.emails group by status) s
    ),
    'recent_by_category', (
      select coalesce(jsonb_object_agg(category, n), '{}'::jsonb)
        from (select classification->>'category' as category, count(*) as n
                from recent where classification is not null group by 1) c
    ),
    -- Every email in the window lands in exactly one bucket per day.
    'daily', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.day), '[]'::jsonb)
        from (
          select to_char(d, 'YYYY-MM-DD') as day,
                 count(r.created_at) filter (where (r.plan->>'requires_approval')::boolean is false) as auto,
                 count(r.created_at) filter (where (r.plan->>'requires_approval')::boolean) as approval,
                 count(r.created_at) filter (where r.status = 'ignored') as ignored,
                 count(r.created_at) filter (where r.plan is null and r.status <> 'ignored') as other
            from window_start w,
                 generate_series(w.ts, date_trunc('day', now()), interval '1 day') d
            left join recent r on r.created_at >= d and r.created_at < d + interval '1 day'
           group by d
        ) t
    ),
    'open_tickets', (select count(*) from public.tickets where status in ('open', 'pending')),
    'open_escalations', (select count(*) from public.escalations where status in ('open', 'acknowledged')),
    'customers', (select count(*) from public.customers),
    'outbound_by_status', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
        from (select status, count(*) as n from public.outbound_emails group by status) o
    )
  );
$$;

revoke execute on function public.dashboard_stats(int) from public, anon, authenticated;
grant execute on function public.dashboard_stats(int) to service_role;
