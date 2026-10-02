-- =============================================================================
-- GEMEL INVEST · gi_write_meter — temporary write-rate metering (Track A / Step A3)
-- Purpose: measure the NORMAL write rate on public.customers (INSERT/UPDATE) so the
-- rate-limit threshold for Step A4 can be set safely (peak * 5-10). This script
-- NEVER blocks a write; it only counts. It is additive and self-disabling.
--
-- Apply once in Supabase SQL Editor. To stop early, set
--   update public.gi_security_settings set value='false' where key='write_meter_enabled';
-- To remove entirely after measurement, drop the trigger + function + table (see footer).
-- =============================================================================

-- Meter rows (private to service_role; the trigger writes here).
create table if not exists public.gi_write_meter (
  id bigserial primary key,
  event_type text not null,            -- 'INSERT' | 'UPDATE'
  ip text not null default 'unknown',
  agent_id text not null default '',
  agent_name text not null default '',
  bucket timestamptz not null default date_trunc('minute', now()),
  count int not null default 0,
  recorded_at timestamptz not null default now()
);

drop index if exists public.gi_write_meter_uniq;
create unique index if not exists gi_write_meter_uniq
  on public.gi_write_meter (event_type, ip, agent_id, bucket);

drop index if exists public.gi_write_meter_recent_idx;
create index if not exists gi_write_meter_recent_idx
  on public.gi_write_meter (recorded_at desc);

alter table public.gi_write_meter enable row level security;
revoke all on public.gi_write_meter from anon, authenticated;
grant all on public.gi_write_meter to service_role;

-- Settings: enable flag + expiry (auto-disable after this time even if forgotten).
insert into public.gi_security_settings (key, value) values
  ('write_meter_enabled', 'true'),
  ('write_meter_expires_at', (now() + interval '7 days')::text)
on conflict (key) do nothing;

-- Trigger function: counts the write, never blocks it (swallows own errors).
create or replace function public.gi_write_meter_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_expires timestamptz;
  v_ip text;
  v_agent_id text;
  v_agent_name text;
  v_bucket timestamptz;
  v_ev text;
  v_dummy int;
begin
  -- Best-effort: any failure here MUST NOT fail the customer write.
  begin
    select (s.value = 'true') into v_enabled
      from public.gi_security_settings s where s.key = 'write_meter_enabled';
    v_enabled := coalesce(v_enabled, true);

    select (s.value)::timestamptz into v_expires
      from public.gi_security_settings s where s.key = 'write_meter_expires_at';

    if not v_enabled then return null; end if;
    if v_expires is not null and now() > v_expires then
      -- Auto-disable once expired.
      update public.gi_security_settings set value = 'false'
        where key = 'write_meter_enabled' and value = 'true';
      return null;
    end if;

    v_ip := trim(both from split_part(coalesce(current_setting('request.header.x-forwarded-for', true), ''), ',', 1));
    if v_ip = '' then v_ip := 'unknown'; end if;

    v_agent_id := coalesce(new.agent_id, '');
    v_agent_name := coalesce(new.agent_name, '');
    v_bucket := date_trunc('minute', now());
    v_ev := tg_op;

    insert into public.gi_write_meter (event_type, ip, agent_id, agent_name, bucket, count)
      values (v_ev, v_ip, v_agent_id, v_agent_name, v_bucket, 1)
      on conflict (event_type, ip, agent_id, bucket)
      do update set count = gi_write_meter.count + 1, recorded_at = now();

    -- Occasional cleanup of old rows (every ~100th call, cheap).
    if (extract(epoch from now())::bigint % 100) = 0 then
      delete from public.gi_write_meter
        where recorded_at < now() - interval '7 days';
    end if;
  exception when others then
    -- Never let metering break the customer write.
    null;
  end;
  return null;
end;
$$;

revoke all on function public.gi_write_meter_record() from public;
grant execute on function public.gi_write_meter_record() to service_role;

-- Attach AFTER trigger (counts without altering the row).
drop trigger if exists gi_write_meter_customers on public.customers;
create trigger gi_write_meter_customers
  after insert or update on public.customers
  for each row execute function public.gi_write_meter_record();

-- Report function: peak write rate per minute, per IP, per agent.
-- Call: select * from public.gi_write_meter_report();
create or replace function public.gi_write_meter_report()
returns table (
  event_type text, ip text, agent_id text, agent_name text,
  peak_per_minute int, total_events int, first_seen timestamptz, last_seen timestamptz
)
language sql security definer set search_path = public as $$
  select event_type, ip, agent_id, agent_name,
         max(count)::int as peak_per_minute,
         sum(count)::int as total_events,
         min(bucket) as first_seen,
         max(bucket) as last_seen
  from public.gi_write_meter
  group by event_type, ip, agent_id, agent_name
  order by peak_per_minute desc;
$$;
revoke all on function public.gi_write_meter_report() from public;
grant execute on function public.gi_write_meter_report() to anon, authenticated;

notify pgrst, 'reload schema';

-- =============================================================================
-- To remove after measurement is complete:
-- drop trigger if exists gi_write_meter_customers on public.customers;
-- drop function if exists public.gi_write_meter_record();
-- drop function if exists public.gi_write_meter_report();
-- drop table if exists public.gi_write_meter;
-- (optionally) delete from public.gi_security_settings where key like 'write_meter_%';
-- =============================================================================
