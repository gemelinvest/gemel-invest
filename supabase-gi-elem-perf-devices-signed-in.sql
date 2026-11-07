-- =============================================================================
-- GEMEL INVEST · inert signed-in paths on referrals, perf events, and devices.
--
-- This file adds three authenticated policies and drops nothing:
--   gi_elementary_referrals_all_authenticated
--   gi_perf_events_all_authenticated
--   owner_devices_all_authenticated
--
-- Each one is FOR ALL to authenticated, using true and check true.
-- The public doors stay. The limited signed-in policies stay, and their
-- limits are not turned into the only path. The anon delete block on
-- referrals stays. No stored row is read into the result or rewritten.
-- Row security is not switched on. Nothing is revoked.
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
--   drop policy if exists gi_elementary_referrals_all_authenticated on public.gi_elementary_referrals;
--   drop policy if exists gi_perf_events_all_authenticated on public.gi_perf_events;
--   drop policy if exists owner_devices_all_authenticated on public.owner_devices;
-- =============================================================================

drop table if exists gi_rls_elem_hold;
create temporary table gi_rls_elem_hold (
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
  v_ref_before integer := 0;
  v_perf_before integer := 0;
  v_dev_before integer := 0;
  v_ref_after integer := 0;
  v_perf_after integer := 0;
  v_dev_after integer := 0;
  v_other_before integer := 0;
  v_other_after integer := 0;
  v_ref_rows_before integer := 0;
  v_perf_rows_before integer := 0;
  v_dev_rows_before integer := 0;
  v_ref_rows_after integer := 0;
  v_perf_rows_after integer := 0;
  v_dev_rows_after integer := 0;
  v_ref_anon_before integer;
  v_ref_anon_after integer;
  v_ref_auth_before integer;
  v_ref_auth_after integer;
  v_perf_anon_before integer;
  v_perf_anon_after integer;
  v_perf_auth_before integer;
  v_perf_auth_after integer;
  v_dev_anon_before integer;
  v_dev_anon_after integer;
  v_dev_auth_before integer;
  v_dev_auth_after integer;
  v_ref_new boolean := false;
  v_perf_new boolean := false;
  v_dev_new boolean := false;
begin
  if to_regclass('public.gi_elementary_referrals') is null
     or to_regclass('public.gi_perf_events') is null
     or to_regclass('public.owner_devices') is null then
    raise exception 'a table is missing; nothing saved';
  end if;

  select bool_and(c.relrowsecurity) into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('gi_elementary_referrals', 'gi_perf_events', 'owner_devices');
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_elementary_referrals'
    and p.policyname = 'gi_elem_ref_all';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'ALL'
     or v_has_anon is distinct from true or v_has_auth is distinct from false
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'open referrals door is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_elementary_referrals'
    and p.policyname = 'gi_elem_ref_restore_anon';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'ALL'
     or v_has_anon is distinct from true or v_has_auth is distinct from true
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'open referrals door is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_elementary_referrals'
      and policyname = 'elem_ref_select_authenticated' and cmd = 'SELECT'
      and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_elementary_referrals'
      and policyname = 'elem_ref_insert_authenticated' and cmd = 'INSERT'
      and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_elementary_referrals'
      and policyname = 'elem_ref_update_authenticated' and cmd = 'UPDATE'
      and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_elementary_referrals'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
  ) then
    raise exception 'referrals policies are missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_perf_events'
    and p.policyname = 'gi_perf_events_restore_anon';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'ALL'
     or v_has_anon is distinct from true or v_has_auth is distinct from true
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'open perf door is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_qual, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_perf_events'
    and p.policyname = 'gi_perf_events_select_authenticated';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'SELECT'
     or v_has_anon is distinct from true or v_has_auth is distinct from true
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'open perf door is missing; nothing saved';
  end if;

  select p.cmd, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_check, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_perf_events'
    and p.policyname = 'gi_perf_events_insert_authenticated';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'INSERT'
     or v_has_anon is distinct from true or v_has_auth is distinct from true
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'open perf door is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_perf_events'
      and policyname = 'perf_events_select_authenticated' and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and regexp_replace(lower(btrim(coalesce(qual, ''))), '[()]', '', 'g') = 'true'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_perf_events'
      and policyname = 'perf_events_insert_authenticated' and cmd = 'INSERT'
      and 'authenticated' = any (roles)
  ) then
    raise exception 'perf policies are missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'owner_devices'
    and p.policyname = 'owner_devices_restore_anon';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'ALL'
     or v_has_anon is distinct from true or v_has_auth is distinct from true
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'open devices door is missing; nothing saved';
  end if;

  select p.cmd, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_check, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'owner_devices'
    and p.policyname = 'owner_devices_open_insert_for_mvp';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'INSERT'
     or v_has_anon is distinct from true or v_has_auth is distinct from true
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'open devices door is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'owner_devices'
    and p.policyname = 'owner_devices_open_update_for_mvp';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'UPDATE'
     or v_has_anon is distinct from true or v_has_auth is distinct from true
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'open devices door is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'owner_devices'
      and policyname = 'owner_devices_select_authenticated' and cmd = 'SELECT'
      and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'owner_devices'
      and policyname = 'owner_devices_insert_authenticated' and cmd = 'INSERT'
      and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'owner_devices'
      and policyname = 'owner_devices_update_authenticated' and cmd = 'UPDATE'
      and 'authenticated' = any (roles)
  ) then
    raise exception 'devices policies are missing; nothing saved';
  end if;

  select count(*) into v_ref_before from pg_policies where schemaname = 'public' and tablename = 'gi_elementary_referrals';
  select count(*) into v_perf_before from pg_policies where schemaname = 'public' and tablename = 'gi_perf_events';
  select count(*) into v_dev_before from pg_policies where schemaname = 'public' and tablename = 'owner_devices';
  select count(*) into v_other_before from pg_policies
  where schemaname = 'public'
    and tablename not in ('gi_elementary_referrals', 'gi_perf_events', 'owner_devices');
  select count(*) into v_ref_rows_before from public.gi_elementary_referrals;
  select count(*) into v_perf_rows_before from public.gi_perf_events;
  select count(*) into v_dev_rows_before from public.owner_devices;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select count(*) into v_ref_anon_before from public.gi_elementary_referrals;
      select count(*) into v_perf_anon_before from public.gi_perf_events;
      select count(*) into v_dev_anon_before from public.owner_devices;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_ref_anon_before := null;
        v_perf_anon_before := null;
        v_dev_anon_before := null;
    end;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    begin
      execute 'set local role authenticated';
      select count(*) into v_ref_auth_before from public.gi_elementary_referrals;
      select count(*) into v_perf_auth_before from public.gi_perf_events;
      select count(*) into v_dev_auth_before from public.owner_devices;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_ref_auth_before := null;
        v_perf_auth_before := null;
        v_dev_auth_before := null;
    end;
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_elementary_referrals'
    and p.policyname = 'gi_elementary_referrals_all_authenticated';
  if found then
    if v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'ALL'
       or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
       or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true'
       or v_roles <> 'authenticated' then
      raise exception 'signed-in policy is not a plain authenticated path; nothing saved';
    end if;
  else
    v_ref_new := true;
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_perf_events'
    and p.policyname = 'gi_perf_events_all_authenticated';
  if found then
    if v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'ALL'
       or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
       or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true'
       or v_roles <> 'authenticated' then
      raise exception 'signed-in policy is not a plain authenticated path; nothing saved';
    end if;
  else
    v_perf_new := true;
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'owner_devices'
    and p.policyname = 'owner_devices_all_authenticated';
  if found then
    if v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'ALL'
       or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
       or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true'
       or v_roles <> 'authenticated' then
      raise exception 'signed-in policy is not a plain authenticated path; nothing saved';
    end if;
  else
    v_dev_new := true;
  end if;

  if v_ref_new then
    execute $policy$
      create policy gi_elementary_referrals_all_authenticated
        on public.gi_elementary_referrals
        for all
        to authenticated
        using (true)
        with check (true)
    $policy$;
  end if;
  if v_perf_new then
    execute $policy$
      create policy gi_perf_events_all_authenticated
        on public.gi_perf_events
        for all
        to authenticated
        using (true)
        with check (true)
    $policy$;
  end if;
  if v_dev_new then
    execute $policy$
      create policy owner_devices_all_authenticated
        on public.owner_devices
        for all
        to authenticated
        using (true)
        with check (true)
    $policy$;
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select count(*) into v_ref_anon_after from public.gi_elementary_referrals;
      select count(*) into v_perf_anon_after from public.gi_perf_events;
      select count(*) into v_dev_anon_after from public.owner_devices;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_ref_anon_after := null;
        v_perf_anon_after := null;
        v_dev_anon_after := null;
    end;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    begin
      execute 'set local role authenticated';
      select count(*) into v_ref_auth_after from public.gi_elementary_referrals;
      select count(*) into v_perf_auth_after from public.gi_perf_events;
      select count(*) into v_dev_auth_after from public.owner_devices;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_ref_auth_after := null;
        v_perf_auth_after := null;
        v_dev_auth_after := null;
    end;
  end if;

  if v_ref_anon_before is distinct from v_ref_anon_after
     or v_ref_auth_before is distinct from v_ref_auth_after
     or v_perf_anon_before is distinct from v_perf_anon_after
     or v_perf_auth_before is distinct from v_perf_auth_after
     or v_dev_anon_before is distinct from v_dev_anon_after
     or v_dev_auth_before is distinct from v_dev_auth_after then
    raise exception 'row visibility changed; nothing saved';
  end if;

  select count(*) into v_ref_rows_after from public.gi_elementary_referrals;
  select count(*) into v_perf_rows_after from public.gi_perf_events;
  select count(*) into v_dev_rows_after from public.owner_devices;
  if v_ref_rows_after <> v_ref_rows_before
     or v_perf_rows_after <> v_perf_rows_before
     or v_dev_rows_after <> v_dev_rows_before then
    raise exception 'stored rows changed; nothing saved';
  end if;

  select count(*) into v_ref_after from pg_policies where schemaname = 'public' and tablename = 'gi_elementary_referrals';
  select count(*) into v_perf_after from pg_policies where schemaname = 'public' and tablename = 'gi_perf_events';
  select count(*) into v_dev_after from pg_policies where schemaname = 'public' and tablename = 'owner_devices';
  select count(*) into v_other_after from pg_policies
  where schemaname = 'public'
    and tablename not in ('gi_elementary_referrals', 'gi_perf_events', 'owner_devices');
  if v_ref_after <> v_ref_before + (case when v_ref_new then 1 else 0 end)
     or v_perf_after <> v_perf_before + (case when v_perf_new then 1 else 0 end)
     or v_dev_after <> v_dev_before + (case when v_dev_new then 1 else 0 end) then
    raise exception 'policies changed by more than the extra path; nothing saved';
  end if;
  if v_other_after <> v_other_before then
    raise exception 'another table changed; nothing saved';
  end if;

  insert into gi_rls_elem_hold(sort_key, section, detail) values
    (1, 'table', 'gi_elementary_referrals'),
    (2, 'signed_in_all', case when v_ref_new then 'installed' else 'already_present' end),
    (3, 'anon_rows', case when v_ref_anon_before is null then 'not_counted' when v_ref_anon_before = v_ref_anon_after then 'same' else 'changed' end),
    (4, 'authenticated_rows', case when v_ref_auth_before is null then 'not_counted' when v_ref_auth_before = v_ref_auth_after then 'same' else 'changed' end),
    (5, 'table', 'gi_perf_events'),
    (6, 'signed_in_all', case when v_perf_new then 'installed' else 'already_present' end),
    (7, 'anon_rows', case when v_perf_anon_before is null then 'not_counted' when v_perf_anon_before = v_perf_anon_after then 'same' else 'changed' end),
    (8, 'authenticated_rows', case when v_perf_auth_before is null then 'not_counted' when v_perf_auth_before = v_perf_auth_after then 'same' else 'changed' end),
    (9, 'table', 'owner_devices'),
    (10, 'signed_in_all', case when v_dev_new then 'installed' else 'already_present' end),
    (11, 'anon_rows', case when v_dev_anon_before is null then 'not_counted' when v_dev_anon_before = v_dev_anon_after then 'same' else 'changed' end),
    (12, 'authenticated_rows', case when v_dev_auth_before is null then 'not_counted' when v_dev_auth_before = v_dev_auth_after then 'same' else 'changed' end),
    (13, 'limited_policies', 'kept'),
    (14, 'delete_block', 'kept'),
    (15, 'other_tables', 'unchanged'),
    (16, 'open_doors', 'kept'),
    (17, 'access_changed', 'no'),
    (18, 'door_closed', 'no');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_elem_hold
order by sort_key;
