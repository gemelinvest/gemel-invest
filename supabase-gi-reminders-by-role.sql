-- =============================================================================
-- GEMEL INVEST · close the open write on reminders.
--
-- public.reminders has an open signed-in policy,
-- reminders_all_authenticated. It lets every signed-in person read, change,
-- and delete every reminder. Select, insert, update, and delete beside it
-- are limited. The screen and the phone store the person's name in
-- agent_id. The phone stores the username when the name is empty.
--
-- This file removes the open policy. A manager can still read and write
-- every reminder. Anyone else can read, add, change, and delete a reminder
-- only when agent_id is their name or their username. An empty agent_id,
-- and the fallback values unknown and מערכת, stay with a manager. No
-- reminder is read or changed. No other table is touched.
--
-- The swap happens only when row security is on, agent_id and customer_id
-- exist, agents.name and agents.username exist, the five known policies
-- are the whole set, the open policy is open, and the manager helper
-- exists. If the new policies are missing afterwards, the whole script
-- stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   create policy reminders_all_authenticated
--     on public.reminders
--     for all to authenticated
--     using (true) with check (true);
--   drop policy if exists reminders_select_authenticated on public.reminders;
--   drop policy if exists reminders_insert_authenticated on public.reminders;
--   drop policy if exists reminders_update_authenticated on public.reminders;
--   drop policy if exists reminders_delete_authenticated on public.reminders;
--   create policy reminders_select_authenticated
--     on public.reminders for select to authenticated
--     using (public.gi_jwt_is_manager() or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id()));
--   create policy reminders_insert_authenticated
--     on public.reminders for insert to authenticated
--     with check (public.gi_jwt_is_manager() or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id()));
--   create policy reminders_update_authenticated
--     on public.reminders for update to authenticated
--     using (public.gi_jwt_is_manager() or (public.gi_jwt_agent_id() <> '' and agent_id = public.gi_jwt_agent_id()))
--     with check (public.gi_jwt_is_manager() or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id()));
--   create policy reminders_delete_authenticated
--     on public.reminders for delete to authenticated
--     using (public.gi_jwt_is_manager() or (public.gi_jwt_agent_id() <> '' and agent_id = public.gi_jwt_agent_id()));
-- =============================================================================

drop table if exists gi_rls_reminders_by_role;
create temporary table gi_rls_reminders_by_role (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $cut$
declare
  v_rls boolean;
  v_open boolean;
  v_count integer;
  v_public integer;
  v_other_before integer;
  v_other_after integer;
  v_select_ok boolean;
  v_insert_ok boolean;
  v_update_ok boolean;
  v_delete_ok boolean;
  v_blank boolean;
  v_own text := $pred$public.gi_jwt_is_manager()
or (
  coalesce(reminders.agent_id, '') <> ''
  and reminders.agent_id <> 'unknown'
  and reminders.agent_id <> 'מערכת'
  and exists (
    select 1
    from public.agents a
    where a.auth_user_id = auth.uid()
      and (
        (coalesce(a.name, '') <> '' and reminders.agent_id = a.name)
        or (coalesce(a.username, '') <> '' and reminders.agent_id = a.username)
      )
  )
)$pred$;
begin
  if to_regclass('public.reminders') is null then
    raise exception 'reminders table is missing; nothing saved';
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'reminders';
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reminders' and column_name = 'agent_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reminders' and column_name = 'customer_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'name'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'username'
  ) then
    raise exception 'reminder columns are missing; nothing saved';
  end if;

  if to_regprocedure('public.gi_jwt_is_manager()') is null
     or to_regprocedure('auth.uid()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and policyname = 'reminders_all_authenticated' and cmd = 'ALL'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_open;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public' and tablename = 'reminders';

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and (
        coalesce(qual, '') ~* $re$coalesce[[:space:]]*\([[:space:]]*agent_id[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~* $re$coalesce[[:space:]]*\([[:space:]]*agent_id[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(qual, '') ~* $re$agent_id[[:space:]]+is[[:space:]]+null$re$
        or coalesce(with_check, '') ~* $re$agent_id[[:space:]]+is[[:space:]]+null$re$
        or coalesce(qual, '') ~* $re$(^|[^[:alnum:]_])agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~* $re$(^|[^[:alnum:]_])agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  if not v_open and not v_blank and v_count = 4
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'reminders'
         and policyname = 'reminders_select_authenticated' and cmd = 'SELECT'
         and coalesce(qual, '') like '%gi_jwt_is_manager()%'
         and coalesce(qual, '') like '%a.name%'
         and coalesce(qual, '') like '%a.username%'
         and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'reminders'
         and policyname = 'reminders_insert_authenticated' and cmd = 'INSERT'
         and coalesce(with_check, '') like '%a.username%'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'reminders'
         and policyname = 'reminders_update_authenticated' and cmd = 'UPDATE'
         and coalesce(qual, '') like '%a.username%'
         and coalesce(with_check, '') like '%a.username%'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'reminders'
         and policyname = 'reminders_delete_authenticated' and cmd = 'DELETE'
         and coalesce(qual, '') like '%a.username%'
     ) then
    insert into gi_rls_reminders_by_role(sort_key, section, detail) values
      (1, 'table', 'reminders'),
      (2, 'policies_removed', 'none'),
      (3, 'select_by_role', 'kept'),
      (4, 'write_by_role', 'kept'),
      (5, 'blank_agent', 'closed'),
      (6, 'changed', 'no');
    return;
  end if;

  if not v_open or v_count <> 5 then
    raise exception 'reminder policies are not the expected open set; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and policyname = 'reminders_select_authenticated' and cmd = 'SELECT'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and policyname = 'reminders_insert_authenticated' and cmd = 'INSERT'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') <> 'true'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and policyname = 'reminders_update_authenticated' and cmd = 'UPDATE'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and policyname = 'reminders_delete_authenticated' and cmd = 'DELETE'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
  ) then
    raise exception 'a reminder policy is missing; nothing saved';
  end if;

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public' and tablename = 'reminders'
    and ('anon' = any (roles) or 'public' = any (roles));
  if v_public <> 0 then
    raise exception 'a public policy is still open; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public' and tablename <> 'reminders';

  drop policy reminders_select_authenticated on public.reminders;
  drop policy reminders_insert_authenticated on public.reminders;
  drop policy reminders_update_authenticated on public.reminders;
  drop policy reminders_delete_authenticated on public.reminders;
  execute 'create policy reminders_select_authenticated on public.reminders for select to authenticated using (' || v_own || ')';
  execute 'create policy reminders_insert_authenticated on public.reminders for insert to authenticated with check (' || v_own || ')';
  execute 'create policy reminders_update_authenticated on public.reminders for update to authenticated using (' || v_own || ') with check (' || v_own || ')';
  execute 'create policy reminders_delete_authenticated on public.reminders for delete to authenticated using (' || v_own || ')';
  drop policy reminders_all_authenticated on public.reminders;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and policyname = 'reminders_select_authenticated' and cmd = 'SELECT'
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
      and coalesce(qual, '') like '%a.name%'
      and coalesce(qual, '') like '%a.username%'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
  ) into v_select_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and policyname = 'reminders_insert_authenticated' and cmd = 'INSERT'
      and coalesce(with_check, '') like '%a.name%'
      and coalesce(with_check, '') like '%a.username%'
  ) into v_insert_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and policyname = 'reminders_update_authenticated' and cmd = 'UPDATE'
      and coalesce(qual, '') like '%a.username%'
      and coalesce(with_check, '') like '%a.username%'
  ) into v_update_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and policyname = 'reminders_delete_authenticated' and cmd = 'DELETE'
      and coalesce(qual, '') like '%a.username%'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
  ) into v_delete_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and policyname = 'reminders_all_authenticated'
  ) into v_open;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and (
        coalesce(qual, '') ~* $re$coalesce[[:space:]]*\([[:space:]]*agent_id[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~* $re$coalesce[[:space:]]*\([[:space:]]*agent_id[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(qual, '') ~* $re$agent_id[[:space:]]+is[[:space:]]+null$re$
        or coalesce(with_check, '') ~* $re$agent_id[[:space:]]+is[[:space:]]+null$re$
        or coalesce(qual, '') ~* $re$(^|[^[:alnum:]_])agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~* $re$(^|[^[:alnum:]_])agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;
  select count(*) into v_count
  from pg_policies where schemaname = 'public' and tablename = 'reminders';
  select count(*) into v_public
  from pg_policies
  where schemaname = 'public' and tablename = 'reminders'
    and ('anon' = any (roles) or 'public' = any (roles));
  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public' and tablename <> 'reminders';

  if not v_select_ok or not v_insert_ok or not v_update_ok or not v_delete_ok
     or v_open or v_blank or v_count <> 4 or v_public <> 0
     or v_other_after <> v_other_before then
    raise exception 'more than the reminder role path changed; nothing saved';
  end if;

  insert into gi_rls_reminders_by_role(sort_key, section, detail) values
    (1, 'table', 'reminders'),
    (2, 'policies_removed', 'reminders_all_authenticated'),
    (3, 'select_by_role', 'installed'),
    (4, 'write_by_role', 'installed'),
    (5, 'blank_agent', 'closed'),
    (6, 'other_tables', 'unchanged'),
    (7, 'changed', 'yes');
end
$cut$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_reminders_by_role
order by sort_key;
