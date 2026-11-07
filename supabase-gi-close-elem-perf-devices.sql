-- =============================================================================
-- GEMEL INVEST · close the public doors on referrals, perf events, and devices.
--
-- This file removes only these policies:
--   gi_elem_ref_all, gi_elem_ref_restore_anon
--   gi_perf_events_select_authenticated, gi_perf_events_insert_authenticated,
--   gi_perf_events_restore_anon
--   owner_devices_open_insert_for_mvp, owner_devices_open_update_for_mvp,
--   owner_devices_restore_anon
--
-- A signed-in session can still read and write each table. The limited
-- signed-in policies stay. The anon delete block on referrals stays.
-- No other table is touched. Row security is not switched on or off.
-- Nothing is revoked. Stored rows are not read into the result and are
-- not changed.
--
-- The doors are removed only when those signed-in paths are already in
-- place and a signed-in session still sees the same rows afterwards. If a
-- count changes, a door is not the expected shape, or a public read or
-- write would remain, the whole script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   create policy gi_elem_ref_all on public.gi_elementary_referrals for all to public using (true) with check (true);
--   create policy gi_elem_ref_restore_anon on public.gi_elementary_referrals for all to anon, authenticated using (true) with check (true);
--   create policy gi_perf_events_select_authenticated on public.gi_perf_events for select to anon, authenticated using (true);
--   create policy gi_perf_events_insert_authenticated on public.gi_perf_events for insert to anon, authenticated with check (true);
--   create policy gi_perf_events_restore_anon on public.gi_perf_events for all to anon, authenticated using (true) with check (true);
--   create policy owner_devices_open_insert_for_mvp on public.owner_devices for insert to anon, authenticated with check (true);
--   create policy owner_devices_open_update_for_mvp on public.owner_devices for update to anon, authenticated using (true) with check (true);
--   create policy owner_devices_restore_anon on public.owner_devices for all to anon, authenticated using (true) with check (true);
-- =============================================================================

drop table if exists gi_rls_elem_close;
create temporary table gi_rls_elem_close (
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
  v_has_anon boolean;
  v_has_auth boolean;
  v_other_before integer := 0;
  v_other_after integer := 0;
  v_ref_before integer := 0;
  v_ref_after integer := 0;
  v_perf_before integer := 0;
  v_perf_after integer := 0;
  v_dev_before integer := 0;
  v_dev_after integer := 0;
  v_ref_rows_before integer := 0;
  v_ref_rows_after integer := 0;
  v_perf_rows_before integer := 0;
  v_perf_rows_after integer := 0;
  v_dev_rows_before integer := 0;
  v_dev_rows_after integer := 0;
  v_ref_auth_before integer;
  v_ref_auth_after integer;
  v_perf_auth_before integer;
  v_perf_auth_after integer;
  v_dev_auth_before integer;
  v_dev_auth_after integer;
  v_ref_anon_before integer;
  v_ref_anon_after integer;
  v_perf_anon_before integer;
  v_perf_anon_after integer;
  v_dev_anon_before integer;
  v_dev_anon_after integer;
  v_removed text := '';
  v_removed_n integer := 0;
  v_left integer := 0;
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

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_elementary_referrals'
    and p.policyname = 'gi_elementary_referrals_all_authenticated';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'ALL'
     or v_roles <> 'authenticated'
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'signed-in path is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_perf_events'
    and p.policyname = 'gi_perf_events_all_authenticated';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'ALL'
     or v_roles <> 'authenticated'
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'signed-in path is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'owner_devices'
    and p.policyname = 'owner_devices_all_authenticated';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'ALL'
     or v_roles <> 'authenticated'
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'signed-in path is missing; nothing saved';
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
  ) or not exists (
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
  ) or not exists (
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
    raise exception 'signed-in limits are missing; nothing saved';
  end if;

  if exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and (
        (p.tablename = 'gi_elementary_referrals' and p.policyname = 'gi_elem_ref_all'
          and (p.cmd <> 'ALL' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or 'authenticated' = any (p.roles)
               or regexp_replace(lower(btrim(coalesce(p.qual, ''))), '[()]', '', 'g') <> 'true'
               or regexp_replace(lower(btrim(coalesce(p.with_check, ''))), '[()]', '', 'g') <> 'true'))
        or (p.tablename = 'gi_elementary_referrals' and p.policyname = 'gi_elem_ref_restore_anon'
          and (p.cmd <> 'ALL' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or not ('authenticated' = any (p.roles))
               or regexp_replace(lower(btrim(coalesce(p.qual, ''))), '[()]', '', 'g') <> 'true'
               or regexp_replace(lower(btrim(coalesce(p.with_check, ''))), '[()]', '', 'g') <> 'true'))
        or (p.tablename = 'gi_perf_events' and p.policyname = 'gi_perf_events_select_authenticated'
          and (p.cmd <> 'SELECT' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or not ('authenticated' = any (p.roles))
               or regexp_replace(lower(btrim(coalesce(p.qual, ''))), '[()]', '', 'g') <> 'true'))
        or (p.tablename = 'gi_perf_events' and p.policyname = 'gi_perf_events_insert_authenticated'
          and (p.cmd <> 'INSERT' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or not ('authenticated' = any (p.roles))
               or regexp_replace(lower(btrim(coalesce(p.with_check, ''))), '[()]', '', 'g') <> 'true'))
        or (p.tablename = 'gi_perf_events' and p.policyname = 'gi_perf_events_restore_anon'
          and (p.cmd <> 'ALL' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or not ('authenticated' = any (p.roles))
               or regexp_replace(lower(btrim(coalesce(p.qual, ''))), '[()]', '', 'g') <> 'true'
               or regexp_replace(lower(btrim(coalesce(p.with_check, ''))), '[()]', '', 'g') <> 'true'))
        or (p.tablename = 'owner_devices' and p.policyname = 'owner_devices_open_insert_for_mvp'
          and (p.cmd <> 'INSERT' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or not ('authenticated' = any (p.roles))
               or regexp_replace(lower(btrim(coalesce(p.with_check, ''))), '[()]', '', 'g') <> 'true'))
        or (p.tablename = 'owner_devices' and p.policyname = 'owner_devices_open_update_for_mvp'
          and (p.cmd <> 'UPDATE' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or not ('authenticated' = any (p.roles))
               or regexp_replace(lower(btrim(coalesce(p.qual, ''))), '[()]', '', 'g') <> 'true'
               or regexp_replace(lower(btrim(coalesce(p.with_check, ''))), '[()]', '', 'g') <> 'true'))
        or (p.tablename = 'owner_devices' and p.policyname = 'owner_devices_restore_anon'
          and (p.cmd <> 'ALL' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or not ('authenticated' = any (p.roles))
               or regexp_replace(lower(btrim(coalesce(p.qual, ''))), '[()]', '', 'g') <> 'true'
               or regexp_replace(lower(btrim(coalesce(p.with_check, ''))), '[()]', '', 'g') <> 'true'))
      )
  ) then
    raise exception 'open door shape is unexpected; nothing saved';
  end if;

  select count(*) into v_other_before from pg_policies
  where schemaname = 'public'
    and tablename not in ('gi_elementary_referrals', 'gi_perf_events', 'owner_devices');
  select count(*) into v_ref_before from pg_policies where schemaname = 'public' and tablename = 'gi_elementary_referrals';
  select count(*) into v_perf_before from pg_policies where schemaname = 'public' and tablename = 'gi_perf_events';
  select count(*) into v_dev_before from pg_policies where schemaname = 'public' and tablename = 'owner_devices';
  select count(*) into v_ref_rows_before from public.gi_elementary_referrals;
  select count(*) into v_perf_rows_before from public.gi_perf_events;
  select count(*) into v_dev_rows_before from public.owner_devices;

  if not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'anon') then
    raise exception 'cannot prove the signed-in read stays; nothing saved';
  end if;

  begin
    execute 'set local role authenticated';
    select count(*) into v_ref_auth_before from public.gi_elementary_referrals;
    select count(*) into v_perf_auth_before from public.gi_perf_events;
    select count(*) into v_dev_auth_before from public.owner_devices;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'cannot prove the signed-in read stays; nothing saved';
  end;

  begin
    execute 'set local role anon';
    select count(*) into v_ref_anon_before from public.gi_elementary_referrals;
    select count(*) into v_perf_anon_before from public.gi_perf_events;
    select count(*) into v_dev_anon_before from public.owner_devices;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'cannot prove the public read closes; nothing saved';
  end;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_elementary_referrals' and policyname = 'gi_elem_ref_all') then
    execute 'drop policy "gi_elem_ref_all" on public.gi_elementary_referrals';
    v_removed := v_removed || 'gi_elem_ref_all ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_elementary_referrals' and policyname = 'gi_elem_ref_restore_anon') then
    execute 'drop policy "gi_elem_ref_restore_anon" on public.gi_elementary_referrals';
    v_removed := v_removed || 'gi_elem_ref_restore_anon ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_perf_events' and policyname = 'gi_perf_events_select_authenticated') then
    execute 'drop policy "gi_perf_events_select_authenticated" on public.gi_perf_events';
    v_removed := v_removed || 'gi_perf_events_select_authenticated ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_perf_events' and policyname = 'gi_perf_events_insert_authenticated') then
    execute 'drop policy "gi_perf_events_insert_authenticated" on public.gi_perf_events';
    v_removed := v_removed || 'gi_perf_events_insert_authenticated ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_perf_events' and policyname = 'gi_perf_events_restore_anon') then
    execute 'drop policy "gi_perf_events_restore_anon" on public.gi_perf_events';
    v_removed := v_removed || 'gi_perf_events_restore_anon ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'owner_devices' and policyname = 'owner_devices_open_insert_for_mvp') then
    execute 'drop policy "owner_devices_open_insert_for_mvp" on public.owner_devices';
    v_removed := v_removed || 'owner_devices_open_insert_for_mvp ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'owner_devices' and policyname = 'owner_devices_open_update_for_mvp') then
    execute 'drop policy "owner_devices_open_update_for_mvp" on public.owner_devices';
    v_removed := v_removed || 'owner_devices_open_update_for_mvp ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'owner_devices' and policyname = 'owner_devices_restore_anon') then
    execute 'drop policy "owner_devices_restore_anon" on public.owner_devices';
    v_removed := v_removed || 'owner_devices_restore_anon ';
    v_removed_n := v_removed_n + 1;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_elementary_referrals'
      and policyname = 'gi_elementary_referrals_all_authenticated' and cmd = 'ALL'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_perf_events'
      and policyname = 'gi_perf_events_all_authenticated' and cmd = 'ALL'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'owner_devices'
      and policyname = 'owner_devices_all_authenticated' and cmd = 'ALL'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_elementary_referrals'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_perf_events'
      and policyname = 'perf_events_select_authenticated' and cmd = 'SELECT'
  ) then
    raise exception 'signed-in path disappeared; nothing saved';
  end if;

  begin
    execute 'set local role authenticated';
    select count(*) into v_ref_auth_after from public.gi_elementary_referrals;
    select count(*) into v_perf_auth_after from public.gi_perf_events;
    select count(*) into v_dev_auth_after from public.owner_devices;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'signed-in rows changed; nothing saved';
  end;

  if v_ref_auth_after is distinct from v_ref_auth_before
     or v_perf_auth_after is distinct from v_perf_auth_before
     or v_dev_auth_after is distinct from v_dev_auth_before then
    raise exception 'signed-in rows changed; nothing saved';
  end if;

  begin
    execute 'set local role anon';
    select count(*) into v_ref_anon_after from public.gi_elementary_referrals;
    select count(*) into v_perf_anon_after from public.gi_perf_events;
    select count(*) into v_dev_anon_after from public.owner_devices;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'anon door is still open; nothing saved';
  end;

  if v_ref_anon_after <> 0 or v_perf_anon_after <> 0 or v_dev_anon_after <> 0 then
    raise exception 'anon door is still open; nothing saved';
  end if;

  select count(*) into v_left
  from pg_policies
  where schemaname = 'public'
    and tablename in ('gi_elementary_referrals', 'gi_perf_events', 'owner_devices')
    and permissive::text in ('PERMISSIVE', 'true', 't')
    and ('anon' = any (roles) or 'public' = any (roles))
    and (
      (cmd in ('ALL', 'SELECT') and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true'))
      or (cmd in ('ALL', 'INSERT', 'UPDATE') and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true'))
      or (cmd = 'DELETE' and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true'))
    );
  if v_left > 0 then
    raise exception 'anon door is still open; nothing saved';
  end if;

  select count(*) into v_ref_rows_after from public.gi_elementary_referrals;
  select count(*) into v_perf_rows_after from public.gi_perf_events;
  select count(*) into v_dev_rows_after from public.owner_devices;
  if v_ref_rows_after <> v_ref_rows_before
     or v_perf_rows_after <> v_perf_rows_before
     or v_dev_rows_after <> v_dev_rows_before then
    raise exception 'stored rows changed; nothing saved';
  end if;

  select count(*) into v_other_after from pg_policies
  where schemaname = 'public'
    and tablename not in ('gi_elementary_referrals', 'gi_perf_events', 'owner_devices');
  if v_other_after <> v_other_before then
    raise exception 'another table changed; nothing saved';
  end if;

  select count(*) into v_ref_after from pg_policies where schemaname = 'public' and tablename = 'gi_elementary_referrals';
  select count(*) into v_perf_after from pg_policies where schemaname = 'public' and tablename = 'gi_perf_events';
  select count(*) into v_dev_after from pg_policies where schemaname = 'public' and tablename = 'owner_devices';
  if (v_ref_before - v_ref_after) + (v_perf_before - v_perf_after) + (v_dev_before - v_dev_after) <> v_removed_n then
    raise exception 'more than the public doors was removed; nothing saved';
  end if;

  insert into gi_rls_elem_close(sort_key, section, detail) values
    (0, 'rls_enabled', 'yes'),
    (1, 'table', 'gi_elementary_referrals'),
    (2, 'authenticated_rows', 'same'),
    (3, 'anon_rows', case when v_removed like '%gi_elem_ref_%' and coalesce(v_ref_anon_before, 0) > 0 then 'hidden' when v_ref_anon_after = 0 then 'already_hidden' else 'hidden' end),
    (4, 'table', 'gi_perf_events'),
    (5, 'authenticated_rows', 'same'),
    (6, 'anon_rows', case when v_removed like '%gi_perf_events_%' and coalesce(v_perf_anon_before, 0) > 0 then 'hidden' when v_perf_anon_after = 0 then 'already_hidden' else 'hidden' end),
    (7, 'table', 'owner_devices'),
    (8, 'authenticated_rows', 'same'),
    (9, 'anon_rows', case when v_removed like '%owner_devices_open_%' or v_removed like '%owner_devices_restore_anon%' then case when coalesce(v_dev_anon_before, 0) > 0 then 'hidden' else 'already_hidden' end when v_dev_anon_after = 0 then 'already_hidden' else 'hidden' end),
    (10, 'stored_rows', 'unchanged'),
    (11, 'other_tables', 'unchanged'),
    (12, 'policies_removed', case when v_removed_n = 0 then 'none' else btrim(v_removed) end),
    (13, 'signed_in_paths', 'kept'),
    (14, 'delete_block', 'kept'),
    (15, 'door_closed', 'yes');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_elem_close
order by sort_key;
