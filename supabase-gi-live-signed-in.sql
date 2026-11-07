-- =============================================================================
-- GEMEL INVEST · inert signed-in paths on presence and ops events.
--
-- This file adds three authenticated policies and drops nothing.
--   gi_agent_live_insert_open  INSERT  to authenticated, check true
--   gi_agent_live_update_open  UPDATE  to authenticated, using true, check true
--   gi_ops_events_all_authenticated  ALL to authenticated, using true, check true
--
-- The public doors stay. The existing signed-in policies stay, and their
-- limits are not turned into the only path. System notices are not changed:
-- a signed-in read and insert are already open there. No stored row is read
-- into the result or rewritten. Row security is not switched on. Nothing is
-- revoked.
--
-- The policies are added only when the public doors are already open, so a
-- signed-in session can already do the same things. If a visible count
-- changes, a public door is missing, or a signed-in policy is missing, the
-- whole script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   drop policy if exists gi_agent_live_insert_open on public.gi_agent_live;
--   drop policy if exists gi_agent_live_update_open on public.gi_agent_live;
--   drop policy if exists gi_ops_events_all_authenticated on public.gi_ops_events;
-- =============================================================================

drop table if exists gi_rls_live_hold;
create temporary table gi_rls_live_hold (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_rls boolean;
  v_cmd text;
  v_qual text;
  v_check text;
  v_permissive text;
  v_roles text;
  v_has_anon boolean := false;
  v_has_auth boolean := false;
  v_live_before integer := 0;
  v_live_after integer := 0;
  v_ops_before integer := 0;
  v_ops_after integer := 0;
  v_notices_before integer := 0;
  v_notices_after integer := 0;
  v_other_before integer := 0;
  v_other_after integer := 0;
  v_live_rows_before integer := 0;
  v_live_rows_after integer := 0;
  v_ops_rows_before integer := 0;
  v_ops_rows_after integer := 0;
  v_live_anon_before integer;
  v_live_anon_after integer;
  v_live_auth_before integer;
  v_live_auth_after integer;
  v_ops_anon_before integer;
  v_ops_anon_after integer;
  v_ops_auth_before integer;
  v_ops_auth_after integer;
  v_insert_new boolean := false;
  v_update_new boolean := false;
  v_ops_new boolean := false;
begin
  if to_regclass('public.gi_agent_live') is null then
    raise exception 'presence table is missing; nothing saved';
  end if;
  if to_regclass('public.gi_ops_events') is null then
    raise exception 'ops events table is missing; nothing saved';
  end if;
  if to_regclass('public.gi_system_notices') is null then
    raise exception 'notices table is missing; nothing saved';
  end if;

  select c.relrowsecurity into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'gi_agent_live';
  if v_rls is distinct from true then
    raise exception 'presence row security is off; nothing saved';
  end if;

  select c.relrowsecurity into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'gi_ops_events';
  if v_rls is distinct from true then
    raise exception 'ops row security is off; nothing saved';
  end if;

  select p.cmd, p.qual, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles))
    into v_cmd, v_qual, v_permissive, v_has_anon
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_agent_live'
    and p.policyname = 'gi_agent_live_read';
  if not found
     or v_permissive not in ('PERMISSIVE', 'true', 't')
     or v_cmd <> 'SELECT'
     or v_has_anon is distinct from true
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'open presence read is missing; nothing saved';
  end if;

  select p.cmd, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles))
    into v_cmd, v_check, v_permissive, v_has_anon
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_agent_live'
    and p.policyname = 'gi_agent_live_upsert';
  if not found
     or v_permissive not in ('PERMISSIVE', 'true', 't')
     or v_cmd <> 'INSERT'
     or v_has_anon is distinct from true
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'open presence insert is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_agent_live'
    and p.policyname = 'gi_agent_live_update';
  if not found
     or v_permissive not in ('PERMISSIVE', 'true', 't')
     or v_cmd <> 'UPDATE'
     or v_has_anon is distinct from true
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'open presence update is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'agent_live_select_authenticated'
      and cmd = 'SELECT' and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'agent_live_upsert_authenticated'
      and cmd = 'INSERT' and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'agent_live_update_authenticated'
      and cmd = 'UPDATE' and 'authenticated' = any (roles)
  ) then
    raise exception 'presence policies are missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_ops_events'
    and p.policyname = 'gi_ops_ev_restore_anon';
  if not found
     or v_permissive not in ('PERMISSIVE', 'true', 't')
     or v_cmd <> 'ALL'
     or v_has_anon is distinct from true
     or v_has_auth is distinct from true
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'open ops door is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_ops_events'
    and p.policyname = 'gi_ops_ev_all';
  if not found
     or v_permissive not in ('PERMISSIVE', 'true', 't')
     or v_cmd <> 'ALL'
     or v_has_anon is distinct from true
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'open ops door is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'ops_ev_select_authenticated'
      and cmd = 'SELECT' and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'ops_ev_insert_authenticated'
      and cmd = 'INSERT' and 'authenticated' = any (roles)
  ) then
    raise exception 'ops policies are missing; nothing saved';
  end if;

  select count(*) into v_live_before from pg_policies
  where schemaname = 'public' and tablename = 'gi_agent_live';
  select count(*) into v_ops_before from pg_policies
  where schemaname = 'public' and tablename = 'gi_ops_events';
  select count(*) into v_notices_before from pg_policies
  where schemaname = 'public' and tablename = 'gi_system_notices';
  select count(*) into v_other_before from pg_policies
  where schemaname = 'public'
    and tablename not in ('gi_agent_live', 'gi_ops_events', 'gi_system_notices');

  select count(*) into v_live_rows_before from public.gi_agent_live;
  select count(*) into v_ops_rows_before from public.gi_ops_events;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select count(*) into v_live_anon_before from public.gi_agent_live;
      select count(*) into v_ops_anon_before from public.gi_ops_events;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_live_anon_before := null;
        v_ops_anon_before := null;
    end;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    begin
      execute 'set local role authenticated';
      select count(*) into v_live_auth_before from public.gi_agent_live;
      select count(*) into v_ops_auth_before from public.gi_ops_events;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_live_auth_before := null;
        v_ops_auth_before := null;
    end;
  end if;

  select p.cmd, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_agent_live'
    and p.policyname = 'gi_agent_live_insert_open';
  if found then
    if v_permissive not in ('PERMISSIVE', 'true', 't')
       or v_cmd <> 'INSERT'
       or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true'
       or v_roles <> 'authenticated' then
      raise exception 'signed-in policy is not a plain authenticated path; nothing saved';
    end if;
  else
    execute $policy$
      create policy gi_agent_live_insert_open
        on public.gi_agent_live
        for insert
        to authenticated
        with check (true)
    $policy$;
    v_insert_new := true;
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_agent_live'
    and p.policyname = 'gi_agent_live_update_open';
  if found then
    if v_permissive not in ('PERMISSIVE', 'true', 't')
       or v_cmd <> 'UPDATE'
       or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
       or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true'
       or v_roles <> 'authenticated' then
      raise exception 'signed-in policy is not a plain authenticated path; nothing saved';
    end if;
  else
    execute $policy$
      create policy gi_agent_live_update_open
        on public.gi_agent_live
        for update
        to authenticated
        using (true)
        with check (true)
    $policy$;
    v_update_new := true;
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_ops_events'
    and p.policyname = 'gi_ops_events_all_authenticated';
  if found then
    if v_permissive not in ('PERMISSIVE', 'true', 't')
       or v_cmd <> 'ALL'
       or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
       or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true'
       or v_roles <> 'authenticated' then
      raise exception 'signed-in policy is not a plain authenticated path; nothing saved';
    end if;
  else
    execute $policy$
      create policy gi_ops_events_all_authenticated
        on public.gi_ops_events
        for all
        to authenticated
        using (true)
        with check (true)
    $policy$;
    v_ops_new := true;
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select count(*) into v_live_anon_after from public.gi_agent_live;
      select count(*) into v_ops_anon_after from public.gi_ops_events;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_live_anon_after := null;
        v_ops_anon_after := null;
    end;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    begin
      execute 'set local role authenticated';
      select count(*) into v_live_auth_after from public.gi_agent_live;
      select count(*) into v_ops_auth_after from public.gi_ops_events;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_live_auth_after := null;
        v_ops_auth_after := null;
    end;
  end if;

  if v_live_anon_before is distinct from v_live_anon_after
     or v_live_auth_before is distinct from v_live_auth_after
     or v_ops_anon_before is distinct from v_ops_anon_after
     or v_ops_auth_before is distinct from v_ops_auth_after then
    raise exception 'row visibility changed; nothing saved';
  end if;

  select count(*) into v_live_rows_after from public.gi_agent_live;
  select count(*) into v_ops_rows_after from public.gi_ops_events;
  if v_live_rows_after <> v_live_rows_before then
    raise exception 'presence rows changed; nothing saved';
  end if;
  if v_ops_rows_after <> v_ops_rows_before then
    raise exception 'ops rows changed; nothing saved';
  end if;

  select count(*) into v_live_after from pg_policies
  where schemaname = 'public' and tablename = 'gi_agent_live';
  select count(*) into v_ops_after from pg_policies
  where schemaname = 'public' and tablename = 'gi_ops_events';
  select count(*) into v_notices_after from pg_policies
  where schemaname = 'public' and tablename = 'gi_system_notices';
  select count(*) into v_other_after from pg_policies
  where schemaname = 'public'
    and tablename not in ('gi_agent_live', 'gi_ops_events', 'gi_system_notices');

  if v_live_after <> v_live_before + (case when v_insert_new then 1 else 0 end) + (case when v_update_new then 1 else 0 end) then
    raise exception 'presence policies changed by more than the extra path; nothing saved';
  end if;
  if v_ops_after <> v_ops_before + (case when v_ops_new then 1 else 0 end) then
    raise exception 'ops policies changed by more than the extra path; nothing saved';
  end if;
  if v_notices_after <> v_notices_before then
    raise exception 'notices changed; nothing saved';
  end if;
  if v_other_after <> v_other_before then
    raise exception 'another table changed; nothing saved';
  end if;

  insert into gi_rls_live_hold(sort_key, section, detail) values
    (1, 'table', 'gi_agent_live'),
    (2, 'insert_policy', case when v_insert_new then 'installed' else 'already_present' end),
    (3, 'update_policy', case when v_update_new then 'installed' else 'already_present' end),
    (4, 'anon_rows', case when v_live_anon_before is null then 'not_counted' when v_live_anon_before = v_live_anon_after then 'same' else 'changed' end),
    (5, 'authenticated_rows', case when v_live_auth_before is null then 'not_counted' when v_live_auth_before = v_live_auth_after then 'same' else 'changed' end),
    (6, 'table', 'gi_ops_events'),
    (7, 'signed_in_all', case when v_ops_new then 'installed' else 'already_present' end),
    (8, 'anon_rows', case when v_ops_anon_before is null then 'not_counted' when v_ops_anon_before = v_ops_anon_after then 'same' else 'changed' end),
    (9, 'authenticated_rows', case when v_ops_auth_before is null then 'not_counted' when v_ops_auth_before = v_ops_auth_after then 'same' else 'changed' end),
    (10, 'notices', 'unchanged'),
    (11, 'other_tables', 'unchanged'),
    (12, 'open_doors', 'kept'),
    (13, 'access_changed', 'no'),
    (14, 'door_closed', 'no');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_live_hold
order by sort_key;
