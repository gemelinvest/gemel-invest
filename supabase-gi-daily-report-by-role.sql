-- =============================================================================
-- GEMEL INVEST · let only a manager save the sales report.
--
-- public.gi_daily_report has three signed-in policies, all open:
-- daily_report_select_authenticated, daily_report_insert_authenticated,
-- and daily_report_update_authenticated.
-- The report is one shared document. Every signed-in person reads it, and
-- the screen filters the lines. Only a manager saves it.
--
-- This file replaces the open insert and the open update with a manager
-- check. The signed-in read stays. The public door stays closed. No other
-- table is touched. Report rows are not read and are not changed.
--
-- The swap happens only when row security is on, the signed-in read is
-- open, the insert and update are the two open signed-in policies, and no
-- other policy is on this table. If the new policies are missing afterwards,
-- the whole script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   drop policy if exists daily_report_insert_by_role on public.gi_daily_report;
--   drop policy if exists daily_report_update_by_role on public.gi_daily_report;
--   create policy daily_report_insert_authenticated
--     on public.gi_daily_report
--     for insert to authenticated with check (true);
--   create policy daily_report_update_authenticated
--     on public.gi_daily_report
--     for update to authenticated using (true) with check (true);
-- =============================================================================

drop table if exists gi_rls_report_by_role;
create temporary table gi_rls_report_by_role (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_rls boolean;
  v_select_open boolean;
  v_insert_open boolean;
  v_update_open boolean;
  v_insert_role boolean;
  v_update_role boolean;
  v_old_left boolean;
  v_public integer;
  v_count integer;
  v_other_before integer;
  v_other_after integer;
begin
  if to_regclass('public.gi_daily_report') is null then
    raise exception 'daily report table is missing; nothing saved';
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'gi_daily_report';
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  if to_regprocedure('public.gi_jwt_is_manager()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_daily_report'
      and policyname = 'daily_report_select_authenticated'
      and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
  ) into v_select_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_daily_report'
      and policyname = 'daily_report_insert_authenticated'
      and cmd = 'INSERT'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_insert_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_daily_report'
      and policyname = 'daily_report_update_authenticated'
      and cmd = 'UPDATE'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_update_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_daily_report'
      and policyname = 'daily_report_insert_by_role'
      and cmd = 'INSERT'
  ) into v_insert_role;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_daily_report'
      and policyname = 'daily_report_update_by_role'
      and cmd = 'UPDATE'
  ) into v_update_role;

  if v_select_open and v_insert_role and v_update_role and not v_insert_open and not v_update_open then
    insert into gi_rls_report_by_role(sort_key, section, detail) values
      (1, 'table', 'gi_daily_report'),
      (2, 'policies_removed', 'none'),
      (3, 'select_signed_in', 'kept'),
      (4, 'insert_by_role', 'kept'),
      (5, 'update_by_role', 'kept'),
      (6, 'changed', 'no');
    return;
  end if;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_daily_report';

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_daily_report'
    and ('anon' = any (roles) or 'public' = any (roles));

  if not v_select_open or not v_insert_open or not v_update_open or v_count <> 3 or v_public <> 0 then
    raise exception 'sales-report policies are not the expected open set; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_daily_report';

  execute $policy$
    create policy daily_report_insert_by_role
      on public.gi_daily_report
      for insert
      to authenticated
      with check (public.gi_jwt_is_manager())
  $policy$;

  execute $policy$
    create policy daily_report_update_by_role
      on public.gi_daily_report
      for update
      to authenticated
      using (public.gi_jwt_is_manager())
      with check (public.gi_jwt_is_manager())
  $policy$;

  drop policy daily_report_insert_authenticated on public.gi_daily_report;
  drop policy daily_report_update_authenticated on public.gi_daily_report;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_daily_report'
      and policyname = 'daily_report_select_authenticated'
      and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
  ) into v_select_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_daily_report'
      and policyname = 'daily_report_insert_by_role'
      and cmd = 'INSERT'
      and 'authenticated' = any (roles)
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') <> 'true'
  ) into v_insert_role;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_daily_report'
      and policyname = 'daily_report_update_by_role'
      and cmd = 'UPDATE'
      and 'authenticated' = any (roles)
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') <> 'true'
  ) into v_update_role;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_daily_report'
      and policyname in ('daily_report_insert_authenticated', 'daily_report_update_authenticated')
  ) into v_old_left;

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_daily_report'
    and ('anon' = any (roles) or 'public' = any (roles));

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_daily_report';

  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_daily_report';

  if not v_select_open or not v_insert_role or not v_update_role
     or v_old_left or v_public <> 0 or v_count <> 3
     or v_other_after <> v_other_before then
    raise exception 'more than the sales-report save path changed; nothing saved';
  end if;

  insert into gi_rls_report_by_role(sort_key, section, detail) values
    (1, 'table', 'gi_daily_report'),
    (2, 'policies_removed', 'daily_report_insert_authenticated,daily_report_update_authenticated'),
    (3, 'select_signed_in', 'kept'),
    (4, 'insert_by_role', 'installed'),
    (5, 'update_by_role', 'installed'),
    (6, 'other_tables', 'unchanged'),
    (7, 'changed', 'yes');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_report_by_role
order by sort_key;
