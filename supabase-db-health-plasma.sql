-- GEMEL INVEST · stop the plasma wall and daily-sales scans that pinned the
-- medium compute on 2026-10-13. Run each CREATE INDEX on its own if the
-- session is already inside a transaction (CONCURRENTLY cannot be).

-- Live calls: payload->mirrorFlow->callSession->>active = true, newest first.
create index if not exists idx_customers_live_call_updated
  on public.customers (updated_at desc)
  where (payload->'mirrorFlow'->'callSession'->>'active') = 'true';

-- Queue: a booking date, newest first.
create index if not exists idx_customers_book_date_updated
  on public.customers (updated_at desc)
  where coalesce(payload->'mirrorCallBookings'->'current'->>'date', '') >= '2000-01-01';

-- Queue: a schedule date, newest first.
create index if not exists idx_customers_sched_date_updated
  on public.customers (updated_at desc)
  where coalesce(payload->'mirrorSchedule'->>'date', '') >= '2000-01-01';

-- Production KPI: issued to production.
create index if not exists idx_customers_issued_to_production
  on public.customers ((payload->'opsProcess'->>'issuedToProductionAt'))
  where (payload->'opsProcess'->>'issuedToProductionAt') is not null;

-- Waiting-mirror KPI: setup finished, summary not yet written.
create index if not exists idx_customers_waiting_mirror
  on public.customers ((payload->'opsProcess'->>'healthSetupFinishedAt'))
  where (payload->'opsProcess'->>'healthSetupFinishedAt') is not null
    and (payload->'mirrorFlow'->'callSession'->>'mirrorSummaryAt') is null;

-- Done-today KPI: summary timestamp range.
create index if not exists idx_customers_mirror_summary_at
  on public.customers ((payload->'mirrorFlow'->'callSession'->>'mirrorSummaryAt'))
  where coalesce(payload->'mirrorFlow'->'callSession'->>'mirrorSummaryAt', '') <> '';

-- A sale's stamp lives inside the policy array. Rows that can match a window
-- were created or saved inside it; unpacking every archived-excluded customer
-- is what hit statement_timeout.
create or replace function public.gi_daily_sales_by_agent(
  p_start timestamp with time zone,
  p_end timestamp with time zone,
  p_agent_ids text[] default null,
  p_agent_names text[] default null
)
returns table(agent_name text, product text, company text, policies bigint, premium numeric)
language sql
stable
security definer
set search_path to 'public'
as $function$
with live as (
  select c.id, c.agent_name, c.created_at, c.updated_at, c.payload
  from public.customers c
  where ((p_agent_ids is null and p_agent_names is null)
         or c.agent_id = any(coalesce(p_agent_ids, '{}'::text[]))
         or c.agent_name = any(coalesce(p_agent_names, '{}'::text[])))
    and lower(btrim(coalesce(c.status, ''))) not in ('inactive', 'archived', 'purged')
    and btrim(coalesce(c.status, '')) <> 'גנוז'
    and (c.updated_at >= p_start or c.created_at >= p_start)
),
pol as (
  select coalesce(nullif(btrim(coalesce(l.agent_name, '')), ''), 'נציג') as agent_name,
         coalesce(nullif(btrim(coalesce(p->>'type', '')), ''), 'אחר') as product,
         coalesce(nullif(btrim(coalesce(p->>'company', '')), ''), 'ללא חברה') as company,
         gi_policy_premium(p) as prem,
         coalesce(nullif(btrim(coalesce(p->>'_addedAt', '')), ''),
                  coalesce(
                    nullif(btrim(to_char(l.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')), ''),
                    nullif(btrim(coalesce(l.payload->>'createdAt', '')), ''),
                    nullif(btrim(to_char(l.updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')), ''),
                    nullif(btrim(coalesce(l.payload->>'updatedAt', '')), ''))) as stamp
  from live l, lateral jsonb_array_elements(gi_new_policies(l.payload)) p
  where coalesce(p->>'origin', '') <> 'existing'
    and not public.gi_is_production_backfill(p)
)
select agent_name, product, company, count(*)::bigint as policies, round(sum(prem), 2) as premium
from pol
where stamp is not null and stamp::timestamptz >= p_start and stamp::timestamptz < p_end
group by agent_name, product, company
order by agent_name, premium desc nulls last;
$function$;

-- A query the API cannot finish must let go of a CPU well before two minutes.
alter role authenticator set statement_timeout = '15s';
