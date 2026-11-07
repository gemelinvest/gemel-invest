-- =============================================================================
-- GEMEL INVEST · close the public doors on the three history tables.
--
-- This file removes only these policies:
--   agents_history_update, gi_agents_history_insert_app, gi_agents_history_select_app
--   customers_history_insert, customers_history_select, customers_history_update
--   proposals_history_insert, proposals_history_select, proposals_history_update
--
-- A signed-in session can still read, insert, and update each history table.
-- The anon update and delete blocks stay. No other table is touched. Row
-- security is not switched on or off. Nothing is revoked. Stored rows are
-- not read into the result and are not changed. Delete is not newly allowed.
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
--   create policy agents_history_update on public.agents_history for update to public using (true) with check (true);
--   create policy gi_agents_history_select_app on public.agents_history for select to anon, authenticated using (true);
--   create policy gi_agents_history_insert_app on public.agents_history for insert to anon, authenticated with check (true);
--   create policy customers_history_select on public.customers_history for select to public using (true);
--   create policy customers_history_insert on public.customers_history for insert to public with check (true);
--   create policy customers_history_update on public.customers_history for update to public using (true) with check (true);
--   create policy proposals_history_select on public.proposals_history for select to public using (true);
--   create policy proposals_history_insert on public.proposals_history for insert to public with check (true);
--   create policy proposals_history_update on public.proposals_history for update to public using (true) with check (true);
-- =============================================================================

drop table if exists gi_rls_history_close;
create temporary table gi_rls_history_close (
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
  v_other_before integer := 0;
  v_other_after integer := 0;
  v_agent_before integer := 0;
  v_agent_after integer := 0;
  v_cust_before integer := 0;
  v_cust_after integer := 0;
  v_prop_before integer := 0;
  v_prop_after integer := 0;
  v_agent_rows_before integer := 0;
  v_agent_rows_after integer := 0;
  v_cust_rows_before integer := 0;
  v_cust_rows_after integer := 0;
  v_prop_rows_before integer := 0;
  v_prop_rows_after integer := 0;
  v_agent_auth_before integer;
  v_agent_auth_after integer;
  v_cust_auth_before integer;
  v_cust_auth_after integer;
  v_prop_auth_before integer;
  v_prop_auth_after integer;
  v_agent_anon_before integer;
  v_agent_anon_after integer;
  v_cust_anon_before integer;
  v_cust_anon_after integer;
  v_prop_anon_before integer;
  v_prop_anon_after integer;
  v_removed text := '';
  v_removed_n integer := 0;
  v_left integer := 0;
begin
  if to_regclass('public.agents_history') is null
     or to_regclass('public.customers_history') is null
     or to_regclass('public.proposals_history') is null then
    raise exception 'a history table is missing; nothing saved';
  end if;

  select bool_and(c.relrowsecurity) into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('agents_history', 'customers_history', 'proposals_history');
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'agents_history'
    and p.policyname = 'agents_history_update_open';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'UPDATE'
     or v_roles <> 'authenticated'
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'signed-in path is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'customers_history'
    and p.policyname = 'customers_history_update_open';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'UPDATE'
     or v_roles <> 'authenticated'
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'signed-in path is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'proposals_history'
    and p.policyname = 'proposals_history_update_open';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'UPDATE'
     or v_roles <> 'authenticated'
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'signed-in path is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents_history'
      and policyname = 'agents_history_select_authenticated' and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true')
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents_history'
      and policyname = 'agents_history_insert_authenticated' and cmd = 'INSERT'
      and 'authenticated' = any (roles)
      and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true')
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
      and policyname = 'customers_history_select_authenticated' and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true')
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
      and policyname = 'customers_history_insert_authenticated' and cmd = 'INSERT'
      and 'authenticated' = any (roles)
      and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true')
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
      and policyname = 'gi_customers_history_select_auth' and cmd = 'SELECT'
      and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
      and policyname = 'gi_customers_history_insert_auth' and cmd = 'INSERT'
      and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
      and policyname = 'proposals_history_select_authenticated' and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true')
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
      and policyname = 'proposals_history_insert_authenticated' and cmd = 'INSERT'
      and 'authenticated' = any (roles)
      and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true')
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
      and policyname = 'gi_proposals_history_select_auth' and cmd = 'SELECT'
      and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
      and policyname = 'gi_proposals_history_insert_auth' and cmd = 'INSERT'
      and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
      and policyname = 'z_block_anon_update' and cmd = 'UPDATE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
      and policyname = 'z_block_anon_update' and cmd = 'UPDATE'
  ) then
    raise exception 'signed-in paths are missing; nothing saved';
  end if;

  if exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and (
        (p.tablename = 'agents_history' and p.policyname = 'agents_history_update'
          and (p.cmd <> 'UPDATE' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or 'authenticated' = any (p.roles)
               or not (p.qual is null or regexp_replace(lower(btrim(p.qual)), '[()]', '', 'g') = 'true')
               or not (p.with_check is null or regexp_replace(lower(btrim(p.with_check)), '[()]', '', 'g') = 'true')))
        or (p.tablename = 'agents_history' and p.policyname = 'gi_agents_history_select_app'
          and (p.cmd <> 'SELECT' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or not ('authenticated' = any (p.roles))
               or not (p.qual is null or regexp_replace(lower(btrim(p.qual)), '[()]', '', 'g') = 'true')))
        or (p.tablename = 'agents_history' and p.policyname = 'gi_agents_history_insert_app'
          and (p.cmd <> 'INSERT' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or not ('authenticated' = any (p.roles))
               or not (p.with_check is null or regexp_replace(lower(btrim(p.with_check)), '[()]', '', 'g') = 'true')))
        or (p.tablename = 'customers_history' and p.policyname = 'customers_history_select'
          and (p.cmd <> 'SELECT' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or 'authenticated' = any (p.roles)
               or not (p.qual is null or regexp_replace(lower(btrim(p.qual)), '[()]', '', 'g') = 'true')))
        or (p.tablename = 'customers_history' and p.policyname = 'customers_history_insert'
          and (p.cmd <> 'INSERT' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or 'authenticated' = any (p.roles)
               or not (p.with_check is null or regexp_replace(lower(btrim(p.with_check)), '[()]', '', 'g') = 'true')))
        or (p.tablename = 'customers_history' and p.policyname = 'customers_history_update'
          and (p.cmd <> 'UPDATE' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or 'authenticated' = any (p.roles)
               or not (p.qual is null or regexp_replace(lower(btrim(p.qual)), '[()]', '', 'g') = 'true')
               or not (p.with_check is null or regexp_replace(lower(btrim(p.with_check)), '[()]', '', 'g') = 'true')))
        or (p.tablename = 'proposals_history' and p.policyname = 'proposals_history_select'
          and (p.cmd <> 'SELECT' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or 'authenticated' = any (p.roles)
               or not (p.qual is null or regexp_replace(lower(btrim(p.qual)), '[()]', '', 'g') = 'true')))
        or (p.tablename = 'proposals_history' and p.policyname = 'proposals_history_insert'
          and (p.cmd <> 'INSERT' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or 'authenticated' = any (p.roles)
               or not (p.with_check is null or regexp_replace(lower(btrim(p.with_check)), '[()]', '', 'g') = 'true')))
        or (p.tablename = 'proposals_history' and p.policyname = 'proposals_history_update'
          and (p.cmd <> 'UPDATE' or p.permissive::text not in ('PERMISSIVE', 'true', 't')
               or not ('anon' = any (p.roles) or 'public' = any (p.roles))
               or 'authenticated' = any (p.roles)
               or not (p.qual is null or regexp_replace(lower(btrim(p.qual)), '[()]', '', 'g') = 'true')
               or not (p.with_check is null or regexp_replace(lower(btrim(p.with_check)), '[()]', '', 'g') = 'true')))
      )
  ) then
    raise exception 'open door shape is unexpected; nothing saved';
  end if;

  select count(*) into v_other_before from pg_policies
  where schemaname = 'public'
    and tablename not in ('agents_history', 'customers_history', 'proposals_history');
  select count(*) into v_agent_before from pg_policies where schemaname = 'public' and tablename = 'agents_history';
  select count(*) into v_cust_before from pg_policies where schemaname = 'public' and tablename = 'customers_history';
  select count(*) into v_prop_before from pg_policies where schemaname = 'public' and tablename = 'proposals_history';
  select count(*) into v_agent_rows_before from public.agents_history;
  select count(*) into v_cust_rows_before from public.customers_history;
  select count(*) into v_prop_rows_before from public.proposals_history;

  if not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'anon') then
    raise exception 'cannot prove the signed-in read stays; nothing saved';
  end if;

  begin
    execute 'set local role authenticated';
    select count(*) into v_agent_auth_before from public.agents_history;
    select count(*) into v_cust_auth_before from public.customers_history;
    select count(*) into v_prop_auth_before from public.proposals_history;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'cannot prove the signed-in read stays; nothing saved';
  end;

  begin
    execute 'set local role anon';
    select count(*) into v_agent_anon_before from public.agents_history;
    select count(*) into v_cust_anon_before from public.customers_history;
    select count(*) into v_prop_anon_before from public.proposals_history;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'cannot prove the public read closes; nothing saved';
  end;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'agents_history' and policyname = 'agents_history_update') then
    execute 'drop policy "agents_history_update" on public.agents_history';
    v_removed := v_removed || 'agents_history_update ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'agents_history' and policyname = 'gi_agents_history_select_app') then
    execute 'drop policy "gi_agents_history_select_app" on public.agents_history';
    v_removed := v_removed || 'gi_agents_history_select_app ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'agents_history' and policyname = 'gi_agents_history_insert_app') then
    execute 'drop policy "gi_agents_history_insert_app" on public.agents_history';
    v_removed := v_removed || 'gi_agents_history_insert_app ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'customers_history' and policyname = 'customers_history_select') then
    execute 'drop policy "customers_history_select" on public.customers_history';
    v_removed := v_removed || 'customers_history_select ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'customers_history' and policyname = 'customers_history_insert') then
    execute 'drop policy "customers_history_insert" on public.customers_history';
    v_removed := v_removed || 'customers_history_insert ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'customers_history' and policyname = 'customers_history_update') then
    execute 'drop policy "customers_history_update" on public.customers_history';
    v_removed := v_removed || 'customers_history_update ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'proposals_history' and policyname = 'proposals_history_select') then
    execute 'drop policy "proposals_history_select" on public.proposals_history';
    v_removed := v_removed || 'proposals_history_select ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'proposals_history' and policyname = 'proposals_history_insert') then
    execute 'drop policy "proposals_history_insert" on public.proposals_history';
    v_removed := v_removed || 'proposals_history_insert ';
    v_removed_n := v_removed_n + 1;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'proposals_history' and policyname = 'proposals_history_update') then
    execute 'drop policy "proposals_history_update" on public.proposals_history';
    v_removed := v_removed || 'proposals_history_update ';
    v_removed_n := v_removed_n + 1;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'agents_history'
      and policyname = 'agents_history_update_open' and cmd = 'UPDATE'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'agents_history'
      and policyname = 'agents_history_select_authenticated' and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'customers_history'
      and policyname = 'customers_history_update_open' and cmd = 'UPDATE'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'proposals_history'
      and policyname = 'proposals_history_update_open' and cmd = 'UPDATE'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'customers_history'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'customers_history'
      and policyname = 'z_block_anon_update' and cmd = 'UPDATE'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'proposals_history'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'proposals_history'
      and policyname = 'z_block_anon_update' and cmd = 'UPDATE'
  ) then
    raise exception 'signed-in path disappeared; nothing saved';
  end if;

  begin
    execute 'set local role authenticated';
    select count(*) into v_agent_auth_after from public.agents_history;
    select count(*) into v_cust_auth_after from public.customers_history;
    select count(*) into v_prop_auth_after from public.proposals_history;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'signed-in rows changed; nothing saved';
  end;

  if v_agent_auth_after is distinct from v_agent_auth_before
     or v_cust_auth_after is distinct from v_cust_auth_before
     or v_prop_auth_after is distinct from v_prop_auth_before then
    raise exception 'signed-in rows changed; nothing saved';
  end if;

  begin
    execute 'set local role anon';
    select count(*) into v_agent_anon_after from public.agents_history;
    select count(*) into v_cust_anon_after from public.customers_history;
    select count(*) into v_prop_anon_after from public.proposals_history;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'anon door is still open; nothing saved';
  end;

  if v_agent_anon_after <> 0 or v_cust_anon_after <> 0 or v_prop_anon_after <> 0 then
    raise exception 'anon door is still open; nothing saved';
  end if;

  select count(*) into v_left
  from pg_policies
  where schemaname = 'public'
    and tablename in ('agents_history', 'customers_history', 'proposals_history')
    and permissive::text in ('PERMISSIVE', 'true', 't')
    and ('anon' = any (roles) or 'public' = any (roles))
    and (
      (cmd = 'SELECT' and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true'))
      or (cmd = 'INSERT' and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true'))
      or (cmd = 'UPDATE'
          and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true')
          and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true'))
      or (cmd = 'DELETE' and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true'))
      or (cmd = 'ALL' and (
           (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true')
           or (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true')
      ))
    );
  if v_left > 0 then
    raise exception 'anon door is still open; nothing saved';
  end if;

  select count(*) into v_agent_rows_after from public.agents_history;
  select count(*) into v_cust_rows_after from public.customers_history;
  select count(*) into v_prop_rows_after from public.proposals_history;
  if v_agent_rows_after <> v_agent_rows_before
     or v_cust_rows_after <> v_cust_rows_before
     or v_prop_rows_after <> v_prop_rows_before then
    raise exception 'stored rows changed; nothing saved';
  end if;

  select count(*) into v_other_after from pg_policies
  where schemaname = 'public'
    and tablename not in ('agents_history', 'customers_history', 'proposals_history');
  if v_other_after <> v_other_before then
    raise exception 'another table changed; nothing saved';
  end if;

  select count(*) into v_agent_after from pg_policies where schemaname = 'public' and tablename = 'agents_history';
  select count(*) into v_cust_after from pg_policies where schemaname = 'public' and tablename = 'customers_history';
  select count(*) into v_prop_after from pg_policies where schemaname = 'public' and tablename = 'proposals_history';
  if (v_agent_before - v_agent_after) + (v_cust_before - v_cust_after) + (v_prop_before - v_prop_after) <> v_removed_n then
    raise exception 'more than the public doors was removed; nothing saved';
  end if;

  insert into gi_rls_history_close(sort_key, section, detail) values
    (0, 'rls_enabled', 'yes'),
    (1, 'table', 'agents_history'),
    (2, 'authenticated_rows', 'same'),
    (3, 'anon_rows', case when v_removed like '%agents_history%' and coalesce(v_agent_anon_before, 0) > 0 then 'hidden' when v_agent_anon_after = 0 then 'already_hidden' else 'hidden' end),
    (4, 'table', 'customers_history'),
    (5, 'authenticated_rows', 'same'),
    (6, 'anon_rows', case when v_removed like '%customers_history_%' and coalesce(v_cust_anon_before, 0) > 0 then 'hidden' when v_cust_anon_after = 0 then 'already_hidden' else 'hidden' end),
    (7, 'table', 'proposals_history'),
    (8, 'authenticated_rows', 'same'),
    (9, 'anon_rows', case when v_removed like '%proposals_history_%' and coalesce(v_prop_anon_before, 0) > 0 then 'hidden' when v_prop_anon_after = 0 then 'already_hidden' else 'hidden' end),
    (10, 'stored_rows', 'unchanged'),
    (11, 'other_tables', 'unchanged'),
    (12, 'policies_removed', case when v_removed_n = 0 then 'none' else btrim(v_removed) end),
    (13, 'signed_in_paths', 'kept'),
    (14, 'blocks', 'kept'),
    (15, 'door_closed', 'yes');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_history_close
order by sort_key;
