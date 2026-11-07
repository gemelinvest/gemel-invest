-- =============================================================================
-- GEMEL INVEST · one inert read on the activity log.
--
-- This file adds one authenticated read on public.gi_agent_activity_log.
-- The open select stays. The open insert stays. No other table is touched.
-- Row security is not switched on. Nothing is revoked. Log rows are not
-- read into the result and are not changed.
--
-- A permissive read can only add a path. The script still counts the rows
-- visible to anon and to authenticated before and after. If either count
-- changes, or the count cannot be taken while row security is already on
-- and authenticated does not already have an open read, the whole script
-- stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   drop policy if exists actlog_select_authenticated
--     on public.gi_agent_activity_log;
-- =============================================================================

drop table if exists gi_rls_actlog_read;
create temporary table gi_rls_actlog_read (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_rls boolean;
  v_rls_after boolean;
  v_open_count integer := 0;
  v_auth_open integer := 0;
  v_other_before integer := 0;
  v_other_after integer := 0;
  v_table_policies_before integer := 0;
  v_table_policies_after integer := 0;
  v_rows_before integer := 0;
  v_rows_after integer := 0;
  v_anon_before integer;
  v_anon_after integer;
  v_auth_before integer;
  v_auth_after integer;
  v_installed boolean := false;
  v_shadow_cmd text;
  v_shadow_qual text;
  v_shadow_permissive text;
  v_shadow_roles text;
  v_policy_name text;
  v_sort integer := 20;
begin
  if to_regclass('public.gi_agent_activity_log') is null then
    raise exception 'activity log table is missing; nothing saved';
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'gi_agent_activity_log';

  select count(*)
    into v_other_before
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_agent_activity_log';

  select count(*)
    into v_table_policies_before
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_agent_activity_log';

  select count(*)
    into v_rows_before
  from public.gi_agent_activity_log;

  select count(*)
    into v_open_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_agent_activity_log'
    and permissive::text in ('PERMISSIVE', 'true', 't')
    and cmd in ('ALL', 'SELECT')
    and ('anon' = any (roles) or 'public' = any (roles))
    and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true');

  select count(*)
    into v_auth_open
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_agent_activity_log'
    and permissive::text in ('PERMISSIVE', 'true', 't')
    and cmd in ('ALL', 'SELECT')
    and (
      'authenticated' = any (roles)
      or 'public' = any (roles)
      or 'anon' = any (roles)
    )
    and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true');

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select count(*) into v_anon_before from public.gi_agent_activity_log;
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
      select count(*) into v_auth_before from public.gi_agent_activity_log;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_auth_before := null;
    end;
  end if;

  if v_rls and v_anon_before is null and v_auth_before is null and v_auth_open = 0 then
    raise exception 'cannot prove the extra read changes nothing; nothing saved';
  end if;

  select p.cmd,
         p.qual,
         p.permissive::text,
         array_to_string(p.roles, ',')
    into v_shadow_cmd, v_shadow_qual, v_shadow_permissive, v_shadow_roles
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'gi_agent_activity_log'
    and p.policyname = 'actlog_select_authenticated';

  if found then
    if v_shadow_permissive not in ('PERMISSIVE', 'true', 't')
       or v_shadow_cmd <> 'SELECT'
       or regexp_replace(lower(btrim(coalesce(v_shadow_qual, ''))), '[()]', '', 'g') <> 'true'
       or v_shadow_roles <> 'authenticated' then
      raise exception 'shadow policy is not a plain authenticated read; nothing saved';
    end if;
  else
    execute $policy$
      create policy actlog_select_authenticated
        on public.gi_agent_activity_log
        for select
        to authenticated
        using (true)
    $policy$;
    v_installed := true;
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select count(*) into v_anon_after from public.gi_agent_activity_log;
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
      select count(*) into v_auth_after from public.gi_agent_activity_log;
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

  select c.relrowsecurity
    into v_rls_after
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'gi_agent_activity_log';

  if v_rls_after is distinct from v_rls then
    raise exception 'row security flag changed; nothing saved';
  end if;
  v_rls := v_rls_after;

  select count(*)
    into v_rows_after
  from public.gi_agent_activity_log;

  if v_rows_after <> v_rows_before then
    raise exception 'log rows changed; nothing saved';
  end if;

  select count(*)
    into v_other_after
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_agent_activity_log';

  if v_other_after <> v_other_before then
    raise exception 'another table changed; nothing saved';
  end if;

  select count(*)
    into v_table_policies_after
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_agent_activity_log';

  if v_table_policies_after <> v_table_policies_before
     and v_table_policies_after <> v_table_policies_before + 1 then
    raise exception 'log policies changed by more than the extra read; nothing saved';
  end if;

  insert into gi_rls_actlog_read(sort_key, section, detail) values
    (1, 'table', 'gi_agent_activity_log'),
    (2, 'rls_enabled', case when v_rls then 'yes' else 'no' end),
    (3, 'open_door', case when v_open_count > 0 then 'yes' else 'no' end),
    (4, 'shadow', case when v_installed then 'installed' else 'already_present' end),
    (5, 'anon_rows', case
      when v_anon_before is null then 'not_counted'
      when v_anon_before = v_anon_after then 'same'
      else 'changed' end),
    (6, 'authenticated_rows', case
      when v_auth_before is null then 'not_counted'
      when v_auth_before = v_auth_after then 'same'
      else 'changed' end),
    (7, 'log_rows', 'unchanged'),
    (8, 'other_tables', 'unchanged'),
    (9, 'access_changed', 'no'),
    (10, 'door_closed', 'no');

  for v_policy_name in
    select p.policyname
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'gi_agent_activity_log'
      and p.permissive::text in ('PERMISSIVE', 'true', 't')
      and p.cmd in ('ALL', 'SELECT')
      and ('anon' = any (p.roles) or 'public' = any (p.roles))
      and (p.qual is null or regexp_replace(lower(btrim(p.qual)), '[()]', '', 'g') = 'true')
    order by p.policyname
  loop
    insert into gi_rls_actlog_read(sort_key, section, detail)
    values (v_sort, 'open_policy', v_policy_name);
    v_sort := v_sort + 1;
  end loop;

  for v_policy_name in
    select p.policyname
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'gi_agent_activity_log'
      and p.permissive::text in ('PERMISSIVE', 'true', 't')
      and p.cmd in ('ALL', 'INSERT')
      and ('anon' = any (p.roles) or 'public' = any (p.roles))
      and (p.with_check is null or regexp_replace(lower(btrim(p.with_check)), '[()]', '', 'g') = 'true')
    order by p.policyname
  loop
    insert into gi_rls_actlog_read(sort_key, section, detail)
    values (v_sort, 'open_insert', v_policy_name);
    v_sort := v_sort + 1;
  end loop;
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_actlog_read
order by sort_key;
