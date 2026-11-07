-- =============================================================================
-- GEMEL INVEST · one inert save on the cancellations report.
--
-- This file adds an authenticated insert and an authenticated update on
-- public.gi_cancellations_report. The open door stays. The authenticated
-- read from the previous file stays. No other table is touched. Row
-- security is not switched on. Nothing is revoked. Report rows are not
-- read into the result and are not changed.
--
-- The save is added only when a signed-in session can already write. A
-- permissive write can only add a path, and the script still compares the
-- rows visible to the public key and to a signed-in session. If a count
-- changes, or the open write is missing while row security is on, the whole
-- script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   drop policy if exists cancellations_report_insert_authenticated
--     on public.gi_cancellations_report;
--   drop policy if exists cancellations_report_update_authenticated
--     on public.gi_cancellations_report;
-- =============================================================================

drop table if exists gi_rls_cancel_write;
create temporary table gi_rls_cancel_write (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_rls boolean;
  v_rls_after boolean;
  v_open_count integer := 0;
  v_insert_open integer := 0;
  v_update_open integer := 0;
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
  v_insert_installed boolean := false;
  v_update_installed boolean := false;
  v_cmd text;
  v_qual text;
  v_check text;
  v_permissive text;
  v_roles text;
  v_policy_name text;
  v_sort integer := 30;
  v_true text;
begin
  if to_regclass('public.gi_cancellations_report') is null then
    raise exception 'cancellations report table is missing; nothing saved';
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'gi_cancellations_report';

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_cancellations_report';

  select count(*) into v_table_policies_before
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_cancellations_report';

  select count(*) into v_rows_before
  from public.gi_cancellations_report;

  select count(*) into v_open_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_cancellations_report'
    and permissive::text in ('PERMISSIVE', 'true', 't')
    and cmd in ('ALL', 'SELECT')
    and ('anon' = any (roles) or 'public' = any (roles))
    and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true');

  select count(*) into v_insert_open
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_cancellations_report'
    and permissive::text in ('PERMISSIVE', 'true', 't')
    and cmd in ('ALL', 'INSERT')
    and ('authenticated' = any (roles) or 'public' = any (roles) or 'anon' = any (roles))
    and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true');

  select count(*) into v_update_open
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_cancellations_report'
    and permissive::text in ('PERMISSIVE', 'true', 't')
    and cmd in ('ALL', 'UPDATE')
    and ('authenticated' = any (roles) or 'public' = any (roles) or 'anon' = any (roles))
    and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true')
    and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true');

  if v_rls and (v_insert_open = 0 or v_update_open = 0) then
    raise exception 'open write is missing; nothing saved';
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select count(*) into v_anon_before from public.gi_cancellations_report;
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
      select count(*) into v_auth_before from public.gi_cancellations_report;
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
    and p.tablename = 'gi_cancellations_report'
    and p.policyname = 'cancellations_report_insert_authenticated';

  if found then
    v_true := regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g');
    if v_permissive not in ('PERMISSIVE', 'true', 't')
       or v_cmd <> 'INSERT'
       or v_true <> 'true'
       or v_roles <> 'authenticated' then
      raise exception 'insert policy is not a plain authenticated write; nothing saved';
    end if;
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'gi_cancellations_report'
    and p.policyname = 'cancellations_report_update_authenticated';

  if found then
    if v_permissive not in ('PERMISSIVE', 'true', 't')
       or v_cmd <> 'UPDATE'
       or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
       or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true'
       or v_roles <> 'authenticated' then
      raise exception 'update policy is not a plain authenticated write; nothing saved';
    end if;
  else
    execute $policy$
      create policy cancellations_report_update_authenticated
        on public.gi_cancellations_report
        for update
        to authenticated
        using (true)
        with check (true)
    $policy$;
    v_update_installed := true;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_cancellations_report'
      and policyname = 'cancellations_report_insert_authenticated'
  ) then
    execute $policy$
      create policy cancellations_report_insert_authenticated
        on public.gi_cancellations_report
        for insert
        to authenticated
        with check (true)
    $policy$;
    v_insert_installed := true;
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select count(*) into v_anon_after from public.gi_cancellations_report;
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
      select count(*) into v_auth_after from public.gi_cancellations_report;
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
  where n.nspname = 'public'
    and c.relname = 'gi_cancellations_report';

  if v_rls_after is distinct from v_rls then
    raise exception 'row security flag changed; nothing saved';
  end if;

  select count(*) into v_rows_after from public.gi_cancellations_report;
  if v_rows_after <> v_rows_before then
    raise exception 'report rows changed; nothing saved';
  end if;

  select count(*) into v_insert_open
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_cancellations_report'
    and permissive::text in ('PERMISSIVE', 'true', 't')
    and cmd in ('ALL', 'INSERT')
    and ('authenticated' = any (roles) or 'public' = any (roles) or 'anon' = any (roles))
    and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true');

  select count(*) into v_update_open
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_cancellations_report'
    and permissive::text in ('PERMISSIVE', 'true', 't')
    and cmd in ('ALL', 'UPDATE')
    and ('authenticated' = any (roles) or 'public' = any (roles) or 'anon' = any (roles))
    and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true')
    and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true');

  if v_rls and (v_insert_open = 0 or v_update_open = 0) then
    raise exception 'open write disappeared; nothing saved';
  end if;

  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_cancellations_report';
  if v_other_after <> v_other_before then
    raise exception 'another table changed; nothing saved';
  end if;

  select count(*) into v_table_policies_after
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_cancellations_report';
  if v_table_policies_after > v_table_policies_before + 2 then
    raise exception 'report policies changed by more than the extra save; nothing saved';
  end if;

  insert into gi_rls_cancel_write(sort_key, section, detail) values
    (1, 'table', 'gi_cancellations_report'),
    (2, 'rls_enabled', case when v_rls_after then 'yes' else 'no' end),
    (3, 'open_door', case when v_open_count > 0 then 'yes' else 'no' end),
    (4, 'insert_policy', case when v_insert_installed then 'installed' else 'already_present' end),
    (5, 'update_policy', case when v_update_installed then 'installed' else 'already_present' end),
    (6, 'anon_rows', case
      when v_anon_before is null then 'not_counted'
      when v_anon_before = v_anon_after then 'same'
      else 'changed' end),
    (7, 'authenticated_rows', case
      when v_auth_before is null then 'not_counted'
      when v_auth_before = v_auth_after then 'same'
      else 'changed' end),
    (8, 'report_rows', 'unchanged'),
    (9, 'other_tables', 'unchanged'),
    (10, 'access_changed', 'no'),
    (11, 'door_closed', 'no');

  for v_policy_name in
    select p.policyname
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'gi_cancellations_report'
      and p.permissive::text in ('PERMISSIVE', 'true', 't')
      and p.cmd in ('ALL', 'SELECT')
      and ('anon' = any (p.roles) or 'public' = any (p.roles))
      and (p.qual is null or regexp_replace(lower(btrim(p.qual)), '[()]', '', 'g') = 'true')
    order by p.policyname
  loop
    insert into gi_rls_cancel_write(sort_key, section, detail)
    values (v_sort, 'open_policy', v_policy_name);
    v_sort := v_sort + 1;
  end loop;
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_cancel_write
order by sort_key;
