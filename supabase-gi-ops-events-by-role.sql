-- =============================================================================
-- GEMEL INVEST · narrow operations events to the operations pool.
--
-- public.gi_ops_events has an open signed-in policy,
-- gi_ops_events_all_authenticated. It lets every signed-in person read
-- and change every event. The select and insert policies beside it name
-- opsAgent with a capital letter, so they do not match the lowercase role
-- helper. There is no update policy. The screen still reads these events
-- from app meta. Saving meta upserts the changed rows, and an upsert of
-- an existing row is an update.
--
-- This file rewrites select and insert, adds the missing update, and
-- removes the open policy. A manager can read and write every event.
-- An operations user can too, in lowercase and in Hebrew. Anyone else
-- cannot. There is no authenticated delete. z_block_anon_delete stays.
-- No other table is touched. Event rows are not read and are not changed.
--
-- The swap happens only when row security is on, created_by_key exists,
-- the four known policies are the whole set, and the helpers exist. If
-- the new policies are missing afterwards, the whole script stops and
-- saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   create policy gi_ops_events_all_authenticated
--     on public.gi_ops_events
--     for all to authenticated
--     using (true) with check (true);
--   drop policy if exists ops_ev_update_authenticated on public.gi_ops_events;
-- =============================================================================

drop table if exists gi_rls_ops_events_by_role;
create temporary table gi_rls_ops_events_by_role (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $cut$
declare
  v_rls boolean;
  v_open boolean;
  v_count integer;
  v_public integer;
  v_other_before integer;
  v_other_after integer;
  v_select_ok boolean;
  v_insert_ok boolean;
  v_update_ok boolean;
  v_block_ok boolean;
  v_blank boolean;
  v_pred text := $pred$
        public.gi_jwt_is_manager()
        or public.gi_jwt_role() in (
          'ops', 'opsagent', 'ops_agent', 'תפעול', 'מנהל תפעול', 'נציג תפעול'
        )
  $pred$;
begin
  if to_regclass('public.gi_ops_events') is null then
    raise exception 'operations events table is missing; nothing saved';
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'gi_ops_events';
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'gi_ops_events'
      and column_name = 'created_by_key'
  ) then
    raise exception 'created_by_key column is missing; nothing saved';
  end if;

  if to_regprocedure('public.gi_jwt_is_manager()') is null
     or to_regprocedure('public.gi_jwt_role()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_ops_events'
      and policyname = 'gi_ops_events_all_authenticated'
      and cmd = 'ALL'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_open;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_ops_events';

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_ops_events'
      and (
        coalesce(qual, '') ~ $re$(created_by_key|agent_id)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$(created_by_key|agent_id)[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  if not v_open and not v_blank and v_count = 4
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'gi_ops_events'
         and policyname = 'ops_ev_select_authenticated'
         and cmd = 'SELECT'
         and coalesce(qual, '') like '%opsagent%'
         and coalesce(qual, '') like '%תפעול%'
         and coalesce(qual, '') like '%gi_jwt_is_manager()%'
         and coalesce(qual, '') !~ 'teamManager|opsAgent'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'gi_ops_events'
         and policyname = 'ops_ev_update_authenticated' and cmd = 'UPDATE'
         and coalesce(qual, '') like '%opsagent%'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'gi_ops_events'
         and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
         and ('anon' = any (roles) or 'public' = any (roles))
         and not ('authenticated' = any (roles))
     ) then
    insert into gi_rls_ops_events_by_role(sort_key, section, detail) values
      (1, 'table', 'gi_ops_events'),
      (2, 'policies_removed', 'none'),
      (3, 'select_by_role', 'kept'),
      (4, 'write_by_role', 'kept'),
      (5, 'blank_owner', 'closed'),
      (6, 'anon_delete_block', 'kept'),
      (7, 'changed', 'no');
    return;
  end if;

  if not v_open or v_count <> 4 then
    raise exception 'operations event policies are not the expected open set; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'ops_ev_select_authenticated' and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'ops_ev_insert_authenticated' and cmd = 'INSERT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
      and ('anon' = any (roles) or 'public' = any (roles))
      and not ('authenticated' = any (roles))
  ) or exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'ops_ev_update_authenticated'
  ) then
    raise exception 'an operations event policy is missing; nothing saved';
  end if;

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_ops_events'
    and ('anon' = any (roles) or 'public' = any (roles));
  if v_public <> 1 then
    raise exception 'a public policy is still open; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_ops_events';

  drop policy ops_ev_select_authenticated on public.gi_ops_events;
  drop policy ops_ev_insert_authenticated on public.gi_ops_events;

  execute 'create policy ops_ev_select_authenticated on public.gi_ops_events for select to authenticated using (' || v_pred || ')';
  execute 'create policy ops_ev_insert_authenticated on public.gi_ops_events for insert to authenticated with check (' || v_pred || ')';
  execute 'create policy ops_ev_update_authenticated on public.gi_ops_events for update to authenticated using (' || v_pred || ') with check (' || v_pred || ')';

  drop policy gi_ops_events_all_authenticated on public.gi_ops_events;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'ops_ev_select_authenticated'
      and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and coalesce(qual, '') like '%opsagent%'
      and coalesce(qual, '') like '%תפעול%'
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
      and coalesce(qual, '') !~ 'teamManager|opsAgent'
  ) into v_select_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'ops_ev_insert_authenticated'
      and cmd = 'INSERT'
      and coalesce(with_check, '') like '%opsagent%'
      and coalesce(with_check, '') like '%תפעול%'
      and coalesce(with_check, '') like '%gi_jwt_is_manager()%'
      and coalesce(with_check, '') !~ 'opsAgent'
  ) into v_insert_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'ops_ev_update_authenticated'
      and cmd = 'UPDATE'
      and coalesce(qual, '') like '%opsagent%'
      and coalesce(with_check, '') like '%opsagent%'
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
      and coalesce(qual, '') !~ 'opsAgent'
  ) into v_update_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'z_block_anon_delete'
      and cmd = 'DELETE'
      and ('anon' = any (roles) or 'public' = any (roles))
      and not ('authenticated' = any (roles))
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'false'
  ) into v_block_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'gi_ops_events_all_authenticated'
  ) into v_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_ops_events'
      and (
        coalesce(qual, '') ~ $re$(created_by_key|agent_id)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$(created_by_key|agent_id)[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public' and tablename = 'gi_ops_events';

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_ops_events'
    and ('anon' = any (roles) or 'public' = any (roles));

  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_ops_events';

  if not v_select_ok or not v_insert_ok or not v_update_ok or not v_block_ok
     or v_open or v_blank or v_count <> 4 or v_public <> 1
     or v_other_after <> v_other_before then
    raise exception 'more than the operations event role path changed; nothing saved';
  end if;

  insert into gi_rls_ops_events_by_role(sort_key, section, detail) values
    (1, 'table', 'gi_ops_events'),
    (2, 'policies_removed', 'gi_ops_events_all_authenticated'),
    (3, 'select_by_role', 'installed'),
    (4, 'write_by_role', 'installed'),
    (5, 'blank_owner', 'closed'),
    (6, 'anon_delete_block', 'kept'),
    (7, 'other_tables', 'unchanged'),
    (8, 'changed', 'yes');
end
$cut$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_ops_events_by_role
order by sort_key;
