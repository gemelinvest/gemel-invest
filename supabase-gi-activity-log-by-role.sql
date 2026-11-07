-- =============================================================================
-- GEMEL INVEST · narrow the activity log to the signed-in role.
--
-- public.gi_agent_activity_log has two signed-in policies, both open:
-- actlog_select_authenticated and actlog_insert_authenticated.
-- A signed-in agent can read every row and insert any row.
--
-- This file replaces those two policies.
-- A manager can read every row. A team manager can read every row, so the
-- team screen does not go empty before the team link is confirmed.
-- Anyone else can read and insert only a row whose agent_id is their own.
-- The public door stays closed. No other table is touched. Log rows are
-- not read and are not changed.
--
-- The swap happens only when row security is on, agent_id exists, the two
-- open policies are the signed-in ones, and no public policy remains.
-- If the new policies are missing afterwards, the whole script stops and
-- saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   drop policy if exists actlog_select_by_role on public.gi_agent_activity_log;
--   drop policy if exists actlog_insert_by_role on public.gi_agent_activity_log;
--   create policy actlog_select_authenticated
--     on public.gi_agent_activity_log
--     for select to authenticated using (true);
--   create policy actlog_insert_authenticated
--     on public.gi_agent_activity_log
--     for insert to authenticated with check (true);
-- =============================================================================

drop table if exists gi_rls_actlog_by_role;
create temporary table gi_rls_actlog_by_role (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_rls boolean;
  v_agent_id boolean;
  v_select_open boolean;
  v_insert_open boolean;
  v_select_role boolean;
  v_insert_role boolean;
  v_public integer;
  v_other_before integer;
  v_other_after integer;
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
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'gi_agent_activity_log'
      and column_name = 'agent_id'
  ) into v_agent_id;
  if v_agent_id is distinct from true then
    raise exception 'agent_id column is missing; nothing saved';
  end if;

  if to_regprocedure('public.gi_jwt_agent_id()') is null
     or to_regprocedure('public.gi_jwt_is_manager()') is null
     or to_regprocedure('public.gi_jwt_role()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_agent_activity_log'
      and policyname = 'actlog_select_authenticated'
      and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
  ) into v_select_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_agent_activity_log'
      and policyname = 'actlog_insert_authenticated'
      and cmd = 'INSERT'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_insert_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_agent_activity_log'
      and policyname = 'actlog_select_by_role'
      and cmd = 'SELECT'
  ) into v_select_role;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_agent_activity_log'
      and policyname = 'actlog_insert_by_role'
      and cmd = 'INSERT'
  ) into v_insert_role;

  if v_select_role and v_insert_role and not v_select_open and not v_insert_open then
    insert into gi_rls_actlog_by_role(sort_key, section, detail) values
      (1, 'table', 'gi_agent_activity_log'),
      (2, 'policies_removed', 'none'),
      (3, 'select_by_role', 'kept'),
      (4, 'insert_by_role', 'kept'),
      (5, 'changed', 'no');
    return;
  end if;

  if not v_select_open or not v_insert_open then
    raise exception 'open signed-in policy is missing; nothing saved';
  end if;

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_agent_activity_log'
    and ('anon' = any (roles) or 'public' = any (roles));
  if v_public <> 0 then
    raise exception 'a public policy is still open; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_agent_activity_log';

  execute $policy$
    create policy actlog_select_by_role
      on public.gi_agent_activity_log
      for select
      to authenticated
      using (
        public.gi_jwt_is_manager()
        or public.gi_jwt_role() in ('teammanager', 'team_manager', 'מנהל צוות')
        or (
          public.gi_jwt_agent_id() <> ''
          and coalesce(agent_id, '') = public.gi_jwt_agent_id()
        )
      )
  $policy$;

  execute $policy$
    create policy actlog_insert_by_role
      on public.gi_agent_activity_log
      for insert
      to authenticated
      with check (
        public.gi_jwt_is_manager()
        or (
          public.gi_jwt_agent_id() <> ''
          and coalesce(agent_id, '') = public.gi_jwt_agent_id()
        )
      )
  $policy$;

  drop policy actlog_select_authenticated on public.gi_agent_activity_log;
  drop policy actlog_insert_authenticated on public.gi_agent_activity_log;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_agent_activity_log'
      and policyname = 'actlog_select_by_role'
      and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
  ) into v_select_role;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_agent_activity_log'
      and policyname = 'actlog_insert_by_role'
      and cmd = 'INSERT'
      and 'authenticated' = any (roles)
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') <> 'true'
  ) into v_insert_role;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_agent_activity_log'
      and policyname in ('actlog_select_authenticated', 'actlog_insert_authenticated')
  ) into v_select_open;

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_agent_activity_log'
    and ('anon' = any (roles) or 'public' = any (roles));

  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_agent_activity_log';

  if not v_select_role or not v_insert_role or v_select_open or v_public <> 0 or v_other_after <> v_other_before then
    raise exception 'more than the activity-log role path changed; nothing saved';
  end if;

  insert into gi_rls_actlog_by_role(sort_key, section, detail) values
    (1, 'table', 'gi_agent_activity_log'),
    (2, 'policies_removed', 'actlog_select_authenticated,actlog_insert_authenticated'),
    (3, 'select_by_role', 'installed'),
    (4, 'insert_by_role', 'installed'),
    (5, 'other_tables', 'unchanged'),
    (6, 'changed', 'yes');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_actlog_by_role
order by sort_key;
