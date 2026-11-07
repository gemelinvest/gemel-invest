-- =============================================================================
-- GEMEL INVEST · one inert signed-in path on the leads table.
--
-- This file adds one authenticated policy, campaign_leads_all_authenticated,
-- on public.campaign_leads. It allows a signed-in session to read, insert,
-- update, and delete. The open door stays. The four role policies stay.
-- The public delete block stays. No other table is touched. Row security
-- is not switched on. Nothing is revoked. Lead rows are not read into the
-- result and are not changed.
--
-- The policy is added only when the public door is already open, so a
-- signed-in session can already do the same things. If a visible count
-- changes, the public door is missing, or a role policy is missing, the
-- whole script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   drop policy if exists campaign_leads_all_authenticated
--     on public.campaign_leads;
-- =============================================================================

drop table if exists gi_rls_leads_hold;
create temporary table gi_rls_leads_hold (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_rls boolean;
  v_rls_after boolean;
  v_other_before integer := 0;
  v_other_after integer := 0;
  v_table_before integer := 0;
  v_table_after integer := 0;
  v_rows_before integer := 0;
  v_rows_after integer := 0;
  v_anon_before integer;
  v_anon_after integer;
  v_auth_before integer;
  v_auth_after integer;
  v_installed boolean := false;
  v_cmd text;
  v_qual text;
  v_check text;
  v_permissive text;
  v_roles text;
  v_has_anon boolean := false;
begin
  if to_regclass('public.campaign_leads') is null then
    raise exception 'leads table is missing; nothing saved';
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'campaign_leads';

  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'campaign_leads'
    and p.policyname = 'gi_campaign_leads_all_anon';

  if not found
     or v_permissive not in ('PERMISSIVE', 'true', 't')
     or v_cmd <> 'ALL'
     or v_has_anon is distinct from true
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'open door is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'campaign_leads_select_authenticated'
      and cmd = 'SELECT' and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'campaign_leads_insert_authenticated'
      and cmd = 'INSERT' and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'campaign_leads_update_authenticated'
      and cmd = 'UPDATE' and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'campaign_leads_delete_authenticated'
      and cmd = 'DELETE' and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'z_block_anon_delete'
      and cmd = 'DELETE' and ('anon' = any (roles) or 'public' = any (roles))
  ) then
    raise exception 'signed-in policies are missing; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public' and tablename <> 'campaign_leads';

  select count(*) into v_table_before
  from pg_policies
  where schemaname = 'public' and tablename = 'campaign_leads';

  select count(*) into v_rows_before from public.campaign_leads;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select count(*) into v_anon_before from public.campaign_leads;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_anon_before := null;
    end;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    begin
      execute 'set local role authenticated';
      select count(*) into v_auth_before from public.campaign_leads;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_auth_before := null;
    end;
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'campaign_leads'
    and p.policyname = 'campaign_leads_all_authenticated';

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
      create policy campaign_leads_all_authenticated
        on public.campaign_leads
        for all
        to authenticated
        using (true)
        with check (true)
    $policy$;
    v_installed := true;
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select count(*) into v_anon_after from public.campaign_leads;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_anon_after := null;
    end;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    begin
      execute 'set local role authenticated';
      select count(*) into v_auth_after from public.campaign_leads;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_auth_after := null;
    end;
  end if;

  if v_anon_before is distinct from v_anon_after
     or v_auth_before is distinct from v_auth_after then
    raise exception 'row visibility changed; nothing saved';
  end if;

  select c.relrowsecurity into v_rls_after
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'campaign_leads';

  if v_rls_after is distinct from true then
    raise exception 'row security flag changed; nothing saved';
  end if;

  select count(*) into v_rows_after from public.campaign_leads;
  if v_rows_after <> v_rows_before then
    raise exception 'lead rows changed; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'gi_campaign_leads_all_anon' and cmd = 'ALL'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'campaign_leads_select_authenticated' and cmd = 'SELECT'
  ) then
    raise exception 'existing policies disappeared; nothing saved';
  end if;

  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public' and tablename <> 'campaign_leads';
  if v_other_after <> v_other_before then
    raise exception 'another table changed; nothing saved';
  end if;

  select count(*) into v_table_after
  from pg_policies
  where schemaname = 'public' and tablename = 'campaign_leads';
  if v_table_after <> v_table_before and v_table_after <> v_table_before + 1 then
    raise exception 'lead policies changed by more than the extra path; nothing saved';
  end if;

  insert into gi_rls_leads_hold(sort_key, section, detail) values
    (1, 'table', 'campaign_leads'),
    (2, 'rls_enabled', 'yes'),
    (3, 'open_door', 'yes'),
    (4, 'signed_in_all', case when v_installed then 'installed' else 'already_present' end),
    (5, 'anon_rows', case
      when v_anon_before is null then 'not_counted'
      when v_anon_before = v_anon_after then 'same'
      else 'changed' end),
    (6, 'authenticated_rows', case
      when v_auth_before is null then 'not_counted'
      when v_auth_before = v_auth_after then 'same'
      else 'changed' end),
    (7, 'lead_rows', 'unchanged'),
    (8, 'other_tables', 'unchanged'),
    (9, 'role_policies', 'kept'),
    (10, 'anon_delete_block', 'kept'),
    (11, 'access_changed', 'no'),
    (12, 'door_closed', 'no'),
    (13, 'open_policy', 'gi_campaign_leads_all_anon');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_leads_hold
order by sort_key;
