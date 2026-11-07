-- =============================================================================
-- GEMEL INVEST · inert signed-in update paths on the history tables.
--
-- Signed-in read and insert are already open. The public update doors are
-- the remaining wide path. This file adds three authenticated policies and
-- drops nothing:
--   agents_history_update_open
--   customers_history_update_open
--   proposals_history_update_open
--
-- Each one is FOR UPDATE to authenticated, using true and check true.
-- The public doors stay. The existing signed-in read and insert policies
-- stay. The anon update and delete blocks stay. No stored row is read into
-- the result or rewritten. Row security is not switched on. Nothing is
-- revoked. Delete is not newly allowed.
--
-- The policies are added only when a signed-in session can already read,
-- insert, and update, so access does not change. If a visible count
-- changes, a public door is missing, or a signed-in policy is missing, the
-- whole script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   drop policy if exists agents_history_update_open on public.agents_history;
--   drop policy if exists customers_history_update_open on public.customers_history;
--   drop policy if exists proposals_history_update_open on public.proposals_history;
-- =============================================================================

drop table if exists gi_rls_history_hold;
create temporary table gi_rls_history_hold (
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
  v_open_qual boolean;
  v_open_check boolean;
  v_agent_before integer := 0;
  v_cust_before integer := 0;
  v_prop_before integer := 0;
  v_agent_after integer := 0;
  v_cust_after integer := 0;
  v_prop_after integer := 0;
  v_other_before integer := 0;
  v_other_after integer := 0;
  v_agent_rows_before integer := 0;
  v_cust_rows_before integer := 0;
  v_prop_rows_before integer := 0;
  v_agent_rows_after integer := 0;
  v_cust_rows_after integer := 0;
  v_prop_rows_after integer := 0;
  v_agent_anon_before integer;
  v_agent_anon_after integer;
  v_agent_auth_before integer;
  v_agent_auth_after integer;
  v_cust_anon_before integer;
  v_cust_anon_after integer;
  v_cust_auth_before integer;
  v_cust_auth_after integer;
  v_prop_anon_before integer;
  v_prop_anon_after integer;
  v_prop_auth_before integer;
  v_prop_auth_after integer;
  v_agent_new boolean := false;
  v_cust_new boolean := false;
  v_prop_new boolean := false;
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

  -- Agent history: signed-in read and insert are open, and the public update is open.
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
  ) then
    raise exception 'agent history read is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'agents_history'
    and p.policyname = 'agents_history_update';
  v_open_qual := v_qual is null or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') = 'true';
  v_open_check := v_check is null or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') = 'true';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'UPDATE'
     or v_has_anon is distinct from true or v_has_auth is distinct from false
     or v_open_qual is distinct from true or v_open_check is distinct from true then
    raise exception 'open agent history update is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents_history'
      and policyname = 'gi_agents_history_select_app' and cmd = 'SELECT'
      and ('anon' = any (roles) or 'public' = any (roles))
      and 'authenticated' = any (roles)
      and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true')
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents_history'
      and policyname = 'gi_agents_history_insert_app' and cmd = 'INSERT'
      and ('anon' = any (roles) or 'public' = any (roles))
      and 'authenticated' = any (roles)
      and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true')
  ) then
    raise exception 'open agent history door is missing; nothing saved';
  end if;

  -- Customer history.
  if not exists (
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
      and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true')
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
      and policyname = 'gi_customers_history_insert_auth' and cmd = 'INSERT'
      and 'authenticated' = any (roles)
      and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true')
  ) then
    raise exception 'customer history read is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_qual, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'customers_history'
    and p.policyname = 'customers_history_select';
  v_open_qual := v_qual is null or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') = 'true';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'SELECT'
     or v_has_anon is distinct from true or v_has_auth is distinct from false
     or v_open_qual is distinct from true then
    raise exception 'open customer history door is missing; nothing saved';
  end if;

  select p.cmd, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_check, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'customers_history'
    and p.policyname = 'customers_history_insert';
  v_open_check := v_check is null or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') = 'true';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'INSERT'
     or v_has_anon is distinct from true or v_has_auth is distinct from false
     or v_open_check is distinct from true then
    raise exception 'open customer history door is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'customers_history'
    and p.policyname = 'customers_history_update';
  v_open_qual := v_qual is null or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') = 'true';
  v_open_check := v_check is null or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') = 'true';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'UPDATE'
     or v_has_anon is distinct from true or v_has_auth is distinct from false
     or v_open_qual is distinct from true or v_open_check is distinct from true then
    raise exception 'open customer history update is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
      and policyname = 'z_block_anon_update' and cmd = 'UPDATE'
  ) then
    raise exception 'customer history blocks are missing; nothing saved';
  end if;

  -- Proposal history.
  if not exists (
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
      and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true')
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
      and policyname = 'gi_proposals_history_insert_auth' and cmd = 'INSERT'
      and 'authenticated' = any (roles)
      and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true')
  ) then
    raise exception 'proposal history read is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_qual, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'proposals_history'
    and p.policyname = 'proposals_history_select';
  v_open_qual := v_qual is null or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') = 'true';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'SELECT'
     or v_has_anon is distinct from true or v_has_auth is distinct from false
     or v_open_qual is distinct from true then
    raise exception 'open proposal history door is missing; nothing saved';
  end if;

  select p.cmd, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_check, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'proposals_history'
    and p.policyname = 'proposals_history_insert';
  v_open_check := v_check is null or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') = 'true';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'INSERT'
     or v_has_anon is distinct from true or v_has_auth is distinct from false
     or v_open_check is distinct from true then
    raise exception 'open proposal history door is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'proposals_history'
    and p.policyname = 'proposals_history_update';
  v_open_qual := v_qual is null or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') = 'true';
  v_open_check := v_check is null or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') = 'true';
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'UPDATE'
     or v_has_anon is distinct from true or v_has_auth is distinct from false
     or v_open_qual is distinct from true or v_open_check is distinct from true then
    raise exception 'open proposal history update is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
      and policyname = 'z_block_anon_update' and cmd = 'UPDATE'
  ) then
    raise exception 'proposal history blocks are missing; nothing saved';
  end if;

  select count(*) into v_agent_before from pg_policies where schemaname = 'public' and tablename = 'agents_history';
  select count(*) into v_cust_before from pg_policies where schemaname = 'public' and tablename = 'customers_history';
  select count(*) into v_prop_before from pg_policies where schemaname = 'public' and tablename = 'proposals_history';
  select count(*) into v_other_before from pg_policies
  where schemaname = 'public'
    and tablename not in ('agents_history', 'customers_history', 'proposals_history');
  select count(*) into v_agent_rows_before from public.agents_history;
  select count(*) into v_cust_rows_before from public.customers_history;
  select count(*) into v_prop_rows_before from public.proposals_history;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select count(*) into v_agent_anon_before from public.agents_history;
      select count(*) into v_cust_anon_before from public.customers_history;
      select count(*) into v_prop_anon_before from public.proposals_history;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_agent_anon_before := null;
        v_cust_anon_before := null;
        v_prop_anon_before := null;
    end;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    begin
      execute 'set local role authenticated';
      select count(*) into v_agent_auth_before from public.agents_history;
      select count(*) into v_cust_auth_before from public.customers_history;
      select count(*) into v_prop_auth_before from public.proposals_history;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_agent_auth_before := null;
        v_cust_auth_before := null;
        v_prop_auth_before := null;
    end;
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'agents_history'
    and p.policyname = 'agents_history_update_open';
  if found then
    if v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'UPDATE'
       or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
       or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true'
       or v_roles <> 'authenticated' then
      raise exception 'signed-in policy is not a plain authenticated path; nothing saved';
    end if;
  else
    v_agent_new := true;
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'customers_history'
    and p.policyname = 'customers_history_update_open';
  if found then
    if v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'UPDATE'
       or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
       or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true'
       or v_roles <> 'authenticated' then
      raise exception 'signed-in policy is not a plain authenticated path; nothing saved';
    end if;
  else
    v_cust_new := true;
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'proposals_history'
    and p.policyname = 'proposals_history_update_open';
  if found then
    if v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'UPDATE'
       or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
       or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true'
       or v_roles <> 'authenticated' then
      raise exception 'signed-in policy is not a plain authenticated path; nothing saved';
    end if;
  else
    v_prop_new := true;
  end if;

  if v_agent_new then
    execute $policy$
      create policy agents_history_update_open
        on public.agents_history
        for update
        to authenticated
        using (true)
        with check (true)
    $policy$;
  end if;
  if v_cust_new then
    execute $policy$
      create policy customers_history_update_open
        on public.customers_history
        for update
        to authenticated
        using (true)
        with check (true)
    $policy$;
  end if;
  if v_prop_new then
    execute $policy$
      create policy proposals_history_update_open
        on public.proposals_history
        for update
        to authenticated
        using (true)
        with check (true)
    $policy$;
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select count(*) into v_agent_anon_after from public.agents_history;
      select count(*) into v_cust_anon_after from public.customers_history;
      select count(*) into v_prop_anon_after from public.proposals_history;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_agent_anon_after := null;
        v_cust_anon_after := null;
        v_prop_anon_after := null;
    end;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    begin
      execute 'set local role authenticated';
      select count(*) into v_agent_auth_after from public.agents_history;
      select count(*) into v_cust_auth_after from public.customers_history;
      select count(*) into v_prop_auth_after from public.proposals_history;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_agent_auth_after := null;
        v_cust_auth_after := null;
        v_prop_auth_after := null;
    end;
  end if;

  if v_agent_anon_before is distinct from v_agent_anon_after
     or v_agent_auth_before is distinct from v_agent_auth_after
     or v_cust_anon_before is distinct from v_cust_anon_after
     or v_cust_auth_before is distinct from v_cust_auth_after
     or v_prop_anon_before is distinct from v_prop_anon_after
     or v_prop_auth_before is distinct from v_prop_auth_after then
    raise exception 'row visibility changed; nothing saved';
  end if;

  select count(*) into v_agent_rows_after from public.agents_history;
  select count(*) into v_cust_rows_after from public.customers_history;
  select count(*) into v_prop_rows_after from public.proposals_history;
  if v_agent_rows_after <> v_agent_rows_before
     or v_cust_rows_after <> v_cust_rows_before
     or v_prop_rows_after <> v_prop_rows_before then
    raise exception 'stored rows changed; nothing saved';
  end if;

  select count(*) into v_agent_after from pg_policies where schemaname = 'public' and tablename = 'agents_history';
  select count(*) into v_cust_after from pg_policies where schemaname = 'public' and tablename = 'customers_history';
  select count(*) into v_prop_after from pg_policies where schemaname = 'public' and tablename = 'proposals_history';
  select count(*) into v_other_after from pg_policies
  where schemaname = 'public'
    and tablename not in ('agents_history', 'customers_history', 'proposals_history');
  if v_agent_after <> v_agent_before + (case when v_agent_new then 1 else 0 end)
     or v_cust_after <> v_cust_before + (case when v_cust_new then 1 else 0 end)
     or v_prop_after <> v_prop_before + (case when v_prop_new then 1 else 0 end) then
    raise exception 'policies changed by more than the extra path; nothing saved';
  end if;
  if v_other_after <> v_other_before then
    raise exception 'another table changed; nothing saved';
  end if;

  insert into gi_rls_history_hold(sort_key, section, detail) values
    (1, 'table', 'agents_history'),
    (2, 'update_policy', case when v_agent_new then 'installed' else 'already_present' end),
    (3, 'anon_rows', case when v_agent_anon_before is null then 'not_counted' when v_agent_anon_before = v_agent_anon_after then 'same' else 'changed' end),
    (4, 'authenticated_rows', case when v_agent_auth_before is null then 'not_counted' when v_agent_auth_before = v_agent_auth_after then 'same' else 'changed' end),
    (5, 'table', 'customers_history'),
    (6, 'update_policy', case when v_cust_new then 'installed' else 'already_present' end),
    (7, 'anon_rows', case when v_cust_anon_before is null then 'not_counted' when v_cust_anon_before = v_cust_anon_after then 'same' else 'changed' end),
    (8, 'authenticated_rows', case when v_cust_auth_before is null then 'not_counted' when v_cust_auth_before = v_cust_auth_after then 'same' else 'changed' end),
    (9, 'table', 'proposals_history'),
    (10, 'update_policy', case when v_prop_new then 'installed' else 'already_present' end),
    (11, 'anon_rows', case when v_prop_anon_before is null then 'not_counted' when v_prop_anon_before = v_prop_anon_after then 'same' else 'changed' end),
    (12, 'authenticated_rows', case when v_prop_auth_before is null then 'not_counted' when v_prop_auth_before = v_prop_auth_after then 'same' else 'changed' end),
    (13, 'read_insert', 'kept'),
    (14, 'blocks', 'kept'),
    (15, 'other_tables', 'unchanged'),
    (16, 'open_doors', 'kept'),
    (17, 'access_changed', 'no'),
    (18, 'door_closed', 'no');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_history_hold
order by sort_key;
