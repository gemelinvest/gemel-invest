-- =============================================================================
-- GEMEL INVEST · close the public doors on presence, notices, and ops events.
--
-- This file removes only these policies:
--   gi_agent_live_read, gi_agent_live_upsert, gi_agent_live_update
--   gi_system_notices_read, gi_system_notices_insert
--   gi_ops_ev_all, gi_ops_ev_restore_anon
--
-- A signed-in session can still read presence, write and update it, read and
-- insert notices, and read and write ops events. The limited signed-in
-- policies stay. The anon delete block on ops events stays. No other table
-- is touched. Row security is not switched on or off. Nothing is revoked.
-- Stored rows are not read into the result and are not changed.
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
--   create policy gi_agent_live_read on public.gi_agent_live for select to anon, authenticated using (true);
--   create policy gi_agent_live_upsert on public.gi_agent_live for insert to anon, authenticated with check (true);
--   create policy gi_agent_live_update on public.gi_agent_live for update to anon, authenticated using (true) with check (true);
--   create policy gi_system_notices_read on public.gi_system_notices for select to anon, authenticated using (true);
--   create policy gi_system_notices_insert on public.gi_system_notices for insert to anon, authenticated with check (true);
--   create policy gi_ops_ev_all on public.gi_ops_events for all to anon, authenticated using (true) with check (true);
--   create policy gi_ops_ev_restore_anon on public.gi_ops_events for all to anon, authenticated using (true) with check (true);
-- =============================================================================

drop table if exists gi_rls_live_close;
create temporary table gi_rls_live_close (
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
  v_has_anon boolean;
  v_roles text;
  v_other_before integer := 0;
  v_other_after integer := 0;
  v_removed text := '';
  v_removed_n integer := 0;
  v_live_before integer := 0;
  v_live_after integer := 0;
  v_notice_before integer := 0;
  v_notice_after integer := 0;
  v_ops_before integer := 0;
  v_ops_after integer := 0;
  v_live_rows_before integer := 0;
  v_live_rows_after integer := 0;
  v_notice_rows_before integer := 0;
  v_notice_rows_after integer := 0;
  v_ops_rows_before integer := 0;
  v_ops_rows_after integer := 0;
  v_live_auth_before integer;
  v_live_auth_after integer;
  v_notice_auth_before integer;
  v_notice_auth_after integer;
  v_ops_auth_before integer;
  v_ops_auth_after integer;
  v_live_anon_before integer;
  v_live_anon_after integer;
  v_notice_anon_before integer;
  v_notice_anon_after integer;
  v_ops_anon_before integer;
  v_ops_anon_after integer;
  v_left integer := 0;
begin
  if to_regclass('public.gi_agent_live') is null
     or to_regclass('public.gi_system_notices') is null
     or to_regclass('public.gi_ops_events') is null then
    raise exception 'a live table is missing; nothing saved';
  end if;

  select bool_and(c.relrowsecurity) into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('gi_agent_live', 'gi_system_notices', 'gi_ops_events');
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  select p.cmd, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_agent_live'
    and p.policyname = 'gi_agent_live_insert_open';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'INSERT'
     or v_roles <> 'authenticated'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'presence insert path is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_agent_live'
    and p.policyname = 'gi_agent_live_update_open';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'UPDATE'
     or v_roles <> 'authenticated'
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'presence update path is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'agent_live_select_authenticated' and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and regexp_replace(lower(btrim(coalesce(qual, ''))), '[()]', '', 'g') = 'true'
  ) then
    raise exception 'presence read path is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_system_notices'
      and policyname = 'system_notices_select_authenticated' and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and regexp_replace(lower(btrim(coalesce(qual, ''))), '[()]', '', 'g') = 'true'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_system_notices'
      and policyname = 'system_notices_insert_authenticated' and cmd = 'INSERT'
      and 'authenticated' = any (roles)
      and regexp_replace(lower(btrim(coalesce(with_check, ''))), '[()]', '', 'g') = 'true'
  ) then
    raise exception 'notices path is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'gi_ops_events'
    and p.policyname = 'gi_ops_events_all_authenticated';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'ALL'
     or v_roles <> 'authenticated'
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'ops path is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
  ) then
    raise exception 'ops delete block is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'agent_live_upsert_authenticated' and cmd = 'INSERT'
      and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'agent_live_update_authenticated' and cmd = 'UPDATE'
      and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'ops_ev_select_authenticated' and cmd = 'SELECT'
      and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'ops_ev_insert_authenticated' and cmd = 'INSERT'
      and 'authenticated' = any (roles)
  ) then
    raise exception 'signed-in path is missing; nothing saved';
  end if;

  -- Confirm any still-present public door has the open shape we expect.
  if exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and (
        (p.tablename = 'gi_agent_live' and p.policyname = 'gi_agent_live_read'
          and (p.cmd <> 'SELECT' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or regexp_replace(lower(btrim(coalesce(p.qual, ''))), '[()]', '', 'g') <> 'true'))
        or (p.tablename = 'gi_agent_live' and p.policyname = 'gi_agent_live_upsert'
          and (p.cmd <> 'INSERT' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or regexp_replace(lower(btrim(coalesce(p.with_check, ''))), '[()]', '', 'g') <> 'true'))
        or (p.tablename = 'gi_agent_live' and p.policyname = 'gi_agent_live_update'
          and (p.cmd <> 'UPDATE' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or regexp_replace(lower(btrim(coalesce(p.qual, ''))), '[()]', '', 'g') <> 'true'
               or regexp_replace(lower(btrim(coalesce(p.with_check, ''))), '[()]', '', 'g') <> 'true'))
        or (p.tablename = 'gi_system_notices' and p.policyname = 'gi_system_notices_read'
          and (p.cmd <> 'SELECT' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or regexp_replace(lower(btrim(coalesce(p.qual, ''))), '[()]', '', 'g') <> 'true'))
        or (p.tablename = 'gi_system_notices' and p.policyname = 'gi_system_notices_insert'
          and (p.cmd <> 'INSERT' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or regexp_replace(lower(btrim(coalesce(p.with_check, ''))), '[()]', '', 'g') <> 'true'))
        or (p.tablename = 'gi_ops_events' and p.policyname = 'gi_ops_ev_all'
          and (p.cmd <> 'ALL' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or regexp_replace(lower(btrim(coalesce(p.qual, ''))), '[()]', '', 'g') <> 'true'
               or regexp_replace(lower(btrim(coalesce(p.with_check, ''))), '[()]', '', 'g') <> 'true'))
        or (p.tablename = 'gi_ops_events' and p.policyname = 'gi_ops_ev_restore_anon'
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
    and tablename not in ('gi_agent_live', 'gi_system_notices', 'gi_ops_events');
  select count(*) into v_live_before from pg_policies where schemaname = 'public' and tablename = 'gi_agent_live';
  select count(*) into v_notice_before from pg_policies where schemaname = 'public' and tablename = 'gi_system_notices';
  select count(*) into v_ops_before from pg_policies where schemaname = 'public' and tablename = 'gi_ops_events';
  select count(*) into v_live_rows_before from public.gi_agent_live;
  select count(*) into v_notice_rows_before from public.gi_system_notices;
  select count(*) into v_ops_rows_before from public.gi_ops_events;

  if not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'anon') then
    raise exception 'cannot prove the signed-in read stays; nothing saved';
  end if;

  begin
    execute 'set local role authenticated';
    select count(*) into v_live_auth_before from public.gi_agent_live;
    select count(*) into v_notice_auth_before from public.gi_system_notices;
    select count(*) into v_ops_auth_before from public.gi_ops_events;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'cannot prove the signed-in read stays; nothing saved';
  end;

  begin
    execute 'set local role anon';
    select count(*) into v_live_anon_before from public.gi_agent_live;
    select count(*) into v_notice_anon_before from public.gi_system_notices;
    select count(*) into v_ops_anon_before from public.gi_ops_events;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'cannot prove the public read closes; nothing saved';
  end;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_agent_live' and policyname = 'gi_agent_live_read') then
    execute 'drop policy "gi_agent_live_read" on public.gi_agent_live';
    v_removed := v_removed || 'gi_agent_live_read ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_agent_live' and policyname = 'gi_agent_live_upsert') then
    execute 'drop policy "gi_agent_live_upsert" on public.gi_agent_live';
    v_removed := v_removed || 'gi_agent_live_upsert ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_agent_live' and policyname = 'gi_agent_live_update') then
    execute 'drop policy "gi_agent_live_update" on public.gi_agent_live';
    v_removed := v_removed || 'gi_agent_live_update ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_system_notices' and policyname = 'gi_system_notices_read') then
    execute 'drop policy "gi_system_notices_read" on public.gi_system_notices';
    v_removed := v_removed || 'gi_system_notices_read ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_system_notices' and policyname = 'gi_system_notices_insert') then
    execute 'drop policy "gi_system_notices_insert" on public.gi_system_notices';
    v_removed := v_removed || 'gi_system_notices_insert ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_ops_events' and policyname = 'gi_ops_ev_all') then
    execute 'drop policy "gi_ops_ev_all" on public.gi_ops_events';
    v_removed := v_removed || 'gi_ops_ev_all ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_ops_events' and policyname = 'gi_ops_ev_restore_anon') then
    execute 'drop policy "gi_ops_ev_restore_anon" on public.gi_ops_events';
    v_removed := v_removed || 'gi_ops_ev_restore_anon ';
    v_removed_n := v_removed_n + 1;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'gi_agent_live_insert_open' and cmd = 'INSERT'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'gi_agent_live_update_open' and cmd = 'UPDATE'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'agent_live_select_authenticated' and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_system_notices'
      and policyname = 'system_notices_select_authenticated' and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_system_notices'
      and policyname = 'system_notices_insert_authenticated' and cmd = 'INSERT'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'gi_ops_events_all_authenticated' and cmd = 'ALL'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'agent_live_upsert_authenticated' and cmd = 'INSERT'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'agent_live_update_authenticated' and cmd = 'UPDATE'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'ops_ev_select_authenticated' and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gi_ops_events'
      and policyname = 'ops_ev_insert_authenticated' and cmd = 'INSERT'
  ) then
    raise exception 'signed-in path disappeared; nothing saved';
  end if;

  begin
    execute 'set local role authenticated';
    select count(*) into v_live_auth_after from public.gi_agent_live;
    select count(*) into v_notice_auth_after from public.gi_system_notices;
    select count(*) into v_ops_auth_after from public.gi_ops_events;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'signed-in rows changed; nothing saved';
  end;

  if v_live_auth_after is distinct from v_live_auth_before
     or v_notice_auth_after is distinct from v_notice_auth_before
     or v_ops_auth_after is distinct from v_ops_auth_before then
    raise exception 'signed-in rows changed; nothing saved';
  end if;

  begin
    execute 'set local role anon';
    select count(*) into v_live_anon_after from public.gi_agent_live;
    select count(*) into v_notice_anon_after from public.gi_system_notices;
    select count(*) into v_ops_anon_after from public.gi_ops_events;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'anon door is still open; nothing saved';
  end;

  if v_live_anon_after <> 0 or v_notice_anon_after <> 0 or v_ops_anon_after <> 0 then
    raise exception 'anon door is still open; nothing saved';
  end if;

  select count(*) into v_left
  from pg_policies
  where schemaname = 'public'
    and tablename in ('gi_agent_live', 'gi_system_notices', 'gi_ops_events')
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

  select count(*) into v_live_rows_after from public.gi_agent_live;
  select count(*) into v_notice_rows_after from public.gi_system_notices;
  select count(*) into v_ops_rows_after from public.gi_ops_events;
  if v_live_rows_after <> v_live_rows_before
     or v_notice_rows_after <> v_notice_rows_before
     or v_ops_rows_after <> v_ops_rows_before then
    raise exception 'stored rows changed; nothing saved';
  end if;

  select count(*) into v_other_after from pg_policies
  where schemaname = 'public'
    and tablename not in ('gi_agent_live', 'gi_system_notices', 'gi_ops_events');
  if v_other_after <> v_other_before then
    raise exception 'another table changed; nothing saved';
  end if;

  select count(*) into v_live_after from pg_policies where schemaname = 'public' and tablename = 'gi_agent_live';
  select count(*) into v_notice_after from pg_policies where schemaname = 'public' and tablename = 'gi_system_notices';
  select count(*) into v_ops_after from pg_policies where schemaname = 'public' and tablename = 'gi_ops_events';
  if (v_live_before - v_live_after) + (v_notice_before - v_notice_after) + (v_ops_before - v_ops_after) <> v_removed_n then
    raise exception 'more than the public doors was removed; nothing saved';
  end if;

  insert into gi_rls_live_close(sort_key, section, detail) values
    (0, 'rls_enabled', 'yes'),
    (1, 'table', 'gi_agent_live'),
    (2, 'authenticated_rows', 'same'),
    (3, 'anon_rows', case when v_removed like '%gi_agent_live_%' and coalesce(v_live_anon_before, 0) > 0 then 'hidden' when v_live_anon_after = 0 then 'already_hidden' else 'hidden' end),
    (4, 'table', 'gi_system_notices'),
    (5, 'authenticated_rows', 'same'),
    (6, 'anon_rows', case when v_removed like '%gi_system_notices_%' and coalesce(v_notice_anon_before, 0) > 0 then 'hidden' when v_notice_anon_after = 0 then 'already_hidden' else 'hidden' end),
    (7, 'table', 'gi_ops_events'),
    (8, 'authenticated_rows', 'same'),
    (9, 'anon_rows', case when v_removed like '%gi_ops_ev_%' and coalesce(v_ops_anon_before, 0) > 0 then 'hidden' when v_ops_anon_after = 0 then 'already_hidden' else 'hidden' end),
    (10, 'stored_rows', 'unchanged'),
    (11, 'other_tables', 'unchanged'),
    (12, 'policies_removed', case when v_removed_n = 0 then 'none' else btrim(v_removed) end),
    (13, 'signed_in_paths', 'kept'),
    (14, 'door_closed', 'yes');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_live_close
order by sort_key;
