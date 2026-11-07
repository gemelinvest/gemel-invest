-- =============================================================================
-- GEMEL INVEST · narrow performance events to the person who owns them.
--
-- public.gi_perf_events has an open signed-in policy,
-- gi_perf_events_all_authenticated. It lets every signed-in person read
-- and change every event. The select policy beside it is also open.
-- The insert policy is limited. agent_id exists, and the screen does not
-- read this table.
--
-- This file rewrites select and insert, adds update and delete for the
-- same people, and removes the open policy. A manager can read and write
-- every event. Anyone else can read and write an event whose agent_id is
-- their own. A blank agent_id stays visible to a manager only. No other
-- table is touched. Event rows are not read and are not changed.
--
-- The swap happens only when row security is on, agent_id exists, the
-- three known policies are the whole set, the select policy is open, and
-- the helpers exist. If the new policies are missing afterwards, the
-- whole script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   create policy gi_perf_events_all_authenticated
--     on public.gi_perf_events
--     for all to authenticated
--     using (true) with check (true);
--   drop policy if exists perf_events_update_authenticated on public.gi_perf_events;
--   drop policy if exists perf_events_delete_authenticated on public.gi_perf_events;
-- =============================================================================

drop table if exists gi_rls_perf_events_by_role;
create temporary table gi_rls_perf_events_by_role (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $cut$
declare
  v_rls boolean;
  v_open boolean;
  v_select_open boolean;
  v_count integer;
  v_public integer;
  v_other_before integer;
  v_other_after integer;
  v_select_ok boolean;
  v_insert_ok boolean;
  v_update_ok boolean;
  v_delete_ok boolean;
  v_blank boolean;
  v_pred text := $pred$
        public.gi_jwt_is_manager()
        or (
          public.gi_jwt_agent_id() <> ''
          and coalesce(agent_id, '') = public.gi_jwt_agent_id()
        )
  $pred$;
begin
  if to_regclass('public.gi_perf_events') is null then
    raise exception 'performance events table is missing; nothing saved';
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'gi_perf_events';
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'gi_perf_events'
      and column_name = 'agent_id'
  ) then
    raise exception 'agent_id column is missing; nothing saved';
  end if;

  if to_regprocedure('public.gi_jwt_is_manager()') is null
     or to_regprocedure('public.gi_jwt_agent_id()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_perf_events'
      and policyname = 'gi_perf_events_all_authenticated'
      and cmd = 'ALL'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_perf_events'
      and policyname = 'perf_events_select_authenticated'
      and cmd = 'SELECT'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
  ) into v_select_open;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_perf_events';

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_perf_events'
      and (
        coalesce(qual, '') ~ $re$agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  if not v_open and not v_select_open and not v_blank and v_count = 4
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'gi_perf_events'
         and policyname = 'perf_events_select_authenticated'
         and cmd = 'SELECT'
         and coalesce(qual, '') like '%gi_jwt_is_manager()%'
         and coalesce(qual, '') like '%gi_jwt_agent_id()%'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'gi_perf_events'
         and policyname = 'perf_events_update_authenticated' and cmd = 'UPDATE'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'gi_perf_events'
         and policyname = 'perf_events_delete_authenticated' and cmd = 'DELETE'
     ) then
    insert into gi_rls_perf_events_by_role(sort_key, section, detail) values
      (1, 'table', 'gi_perf_events'),
      (2, 'policies_removed', 'none'),
      (3, 'select_by_role', 'kept'),
      (4, 'write_by_role', 'kept'),
      (5, 'blank_agent', 'closed'),
      (6, 'changed', 'no');
    return;
  end if;

  if not v_open or not v_select_open or v_count <> 3 then
    raise exception 'performance event policies are not the expected open set; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_perf_events'
      and policyname = 'perf_events_insert_authenticated' and cmd = 'INSERT'
  ) or exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_perf_events'
      and policyname in ('perf_events_update_authenticated', 'perf_events_delete_authenticated')
  ) then
    raise exception 'a performance event policy is missing; nothing saved';
  end if;

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_perf_events'
    and ('anon' = any (roles) or 'public' = any (roles));
  if v_public <> 0 then
    raise exception 'a public policy is still open; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_perf_events';

  drop policy perf_events_select_authenticated on public.gi_perf_events;
  drop policy perf_events_insert_authenticated on public.gi_perf_events;

  execute 'create policy perf_events_select_authenticated on public.gi_perf_events for select to authenticated using (' || v_pred || ')';
  execute 'create policy perf_events_insert_authenticated on public.gi_perf_events for insert to authenticated with check (' || v_pred || ')';
  execute 'create policy perf_events_update_authenticated on public.gi_perf_events for update to authenticated using (' || v_pred || ') with check (' || v_pred || ')';
  execute 'create policy perf_events_delete_authenticated on public.gi_perf_events for delete to authenticated using (' || v_pred || ')';

  drop policy gi_perf_events_all_authenticated on public.gi_perf_events;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_perf_events'
      and policyname = 'perf_events_select_authenticated'
      and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
      and coalesce(qual, '') like '%gi_jwt_agent_id()%'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
  ) into v_select_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_perf_events'
      and policyname = 'perf_events_insert_authenticated'
      and cmd = 'INSERT'
      and coalesce(with_check, '') like '%gi_jwt_is_manager()%'
      and coalesce(with_check, '') like '%gi_jwt_agent_id()%'
  ) into v_insert_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_perf_events'
      and policyname = 'perf_events_update_authenticated'
      and cmd = 'UPDATE'
      and coalesce(qual, '') like '%gi_jwt_agent_id()%'
      and coalesce(with_check, '') like '%gi_jwt_agent_id()%'
  ) into v_update_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_perf_events'
      and policyname = 'perf_events_delete_authenticated'
      and cmd = 'DELETE'
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
      and coalesce(qual, '') like '%gi_jwt_agent_id()%'
  ) into v_delete_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_perf_events'
      and policyname = 'gi_perf_events_all_authenticated'
  ) into v_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_perf_events'
      and (
        coalesce(qual, '') ~ $re$agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public' and tablename = 'gi_perf_events';

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_perf_events'
    and ('anon' = any (roles) or 'public' = any (roles));

  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_perf_events';

  if not v_select_ok or not v_insert_ok or not v_update_ok or not v_delete_ok
     or v_open or v_blank or v_count <> 4 or v_public <> 0
     or v_other_after <> v_other_before then
    raise exception 'more than the performance event role path changed; nothing saved';
  end if;

  insert into gi_rls_perf_events_by_role(sort_key, section, detail) values
    (1, 'table', 'gi_perf_events'),
    (2, 'policies_removed', 'gi_perf_events_all_authenticated'),
    (3, 'select_by_role', 'installed'),
    (4, 'write_by_role', 'installed'),
    (5, 'blank_agent', 'closed'),
    (6, 'other_tables', 'unchanged'),
    (7, 'changed', 'yes');
end
$cut$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_perf_events_by_role
order by sort_key;
