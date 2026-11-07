-- =============================================================================
-- GEMEL INVEST · close the open writes on the live floor and system notices.
--
-- public.gi_agent_live is the floor. A manager reads every row. Each person
-- writes the row whose agent_id is their own, including the read that an
-- upsert needs in order to save. Two extra policies, gi_agent_live_insert_open
-- and gi_agent_live_update_open, let every signed-in person write every row.
-- The select policy is open to every signed-in person.
--
-- public.gi_system_notices is a broadcast. Every signed-in person reads it.
-- The insert policy is open, so any signed-in person can send one. The
-- screen only offers sending to a manager.
--
-- This file removes the two open floor writes and rewrites the floor
-- select, insert, and update. A manager can read and write every floor row.
-- Anyone else can read and write only a row whose agent_id is their own.
-- A blank agent_id stays with a manager. Notice reads stay open to every
-- signed-in person. Notice sends become manager-only. No row is read or
-- changed. No other table is touched.
--
-- The swap happens only when both tables have row security, the expected
-- columns and policies are present, the known reads and writes are open,
-- and the helpers exist. If the new policies are missing afterwards, the
-- whole script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   drop policy if exists agent_live_select_authenticated on public.gi_agent_live;
--   create policy agent_live_select_authenticated
--     on public.gi_agent_live for select to authenticated using (true);
--   create policy gi_agent_live_insert_open
--     on public.gi_agent_live for insert to authenticated with check (true);
--   create policy gi_agent_live_update_open
--     on public.gi_agent_live for update to authenticated using (true) with check (true);
--   drop policy if exists system_notices_insert_authenticated on public.gi_system_notices;
--   create policy system_notices_insert_authenticated
--     on public.gi_system_notices for insert to authenticated with check (true);
-- =============================================================================

drop table if exists gi_rls_live_by_role;
create temporary table gi_rls_live_by_role (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $cut$
declare
  v_live_rls boolean;
  v_notice_rls boolean;
  v_live_count integer;
  v_notice_count integer;
  v_public integer;
  v_other_before integer;
  v_other_after integer;
  v_select_open boolean;
  v_insert_open boolean;
  v_update_open boolean;
  v_notice_select_open boolean;
  v_notice_insert_open boolean;
  v_live_select_ok boolean;
  v_live_insert_ok boolean;
  v_live_update_ok boolean;
  v_notice_select_ok boolean;
  v_notice_insert_ok boolean;
  v_blank boolean;
  v_done boolean;
  v_live text := $pred$
        public.gi_jwt_is_manager()
        or (
          public.gi_jwt_agent_id() <> ''
          and coalesce(agent_id, '') = public.gi_jwt_agent_id()
        )
  $pred$;
  v_notice text := $pred$public.gi_jwt_is_manager()$pred$;
begin
  if to_regclass('public.gi_agent_live') is null
     or to_regclass('public.gi_system_notices') is null then
    raise exception 'a live table is missing; nothing saved';
  end if;

  select c.relrowsecurity into v_live_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'gi_agent_live';
  select c.relrowsecurity into v_notice_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'gi_system_notices';
  if v_live_rls is distinct from true or v_notice_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gi_agent_live' and column_name = 'agent_id'
  ) then
    raise exception 'agent_id column is missing; nothing saved';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gi_system_notices' and column_name = 'author_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gi_system_notices' and column_name = 'author_name'
  ) then
    raise exception 'notice columns are missing; nothing saved';
  end if;

  if to_regprocedure('public.gi_jwt_is_manager()') is null
     or to_regprocedure('public.gi_jwt_agent_id()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select count(*) into v_live_count
  from pg_policies where schemaname = 'public' and tablename = 'gi_agent_live';
  select count(*) into v_notice_count
  from pg_policies where schemaname = 'public' and tablename = 'gi_system_notices';

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'agent_live_select_authenticated' and cmd = 'SELECT'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
  ) into v_select_open;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'gi_agent_live_insert_open' and cmd = 'INSERT'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_insert_open;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'gi_agent_live_update_open' and cmd = 'UPDATE'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_update_open;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_system_notices'
      and policyname = 'system_notices_select_authenticated' and cmd = 'SELECT'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
  ) into v_notice_select_open;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_system_notices'
      and policyname = 'system_notices_insert_authenticated' and cmd = 'INSERT'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_notice_insert_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('gi_agent_live', 'gi_system_notices')
      and (
        coalesce(qual, '') ~ $re$(agent_id|author_id)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$(agent_id|author_id)[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  select (
    not v_select_open and not v_insert_open and not v_update_open
    and not v_notice_insert_open and v_notice_select_open
    and not v_blank and v_live_count = 3 and v_notice_count = 2
    and exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'gi_agent_live'
        and policyname = 'agent_live_select_authenticated' and cmd = 'SELECT'
        and coalesce(qual, '') like '%gi_jwt_is_manager()%'
        and coalesce(qual, '') like '%gi_jwt_agent_id()%'
    )
    and exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'gi_system_notices'
        and policyname = 'system_notices_insert_authenticated' and cmd = 'INSERT'
        and coalesce(with_check, '') like '%gi_jwt_is_manager()%'
        and coalesce(with_check, '') not like '%gi_jwt_agent_id()%'
    )
  ) into v_done;

  if v_done then
    insert into gi_rls_live_by_role(sort_key, section, detail) values
      (1, 'table', 'gi_agent_live'),
      (2, 'policies_removed', 'none'),
      (3, 'select_by_role', 'kept'),
      (4, 'write_by_role', 'kept'),
      (5, 'blank_agent', 'closed'),
      (6, 'table', 'gi_system_notices'),
      (7, 'policies_removed', 'none'),
      (8, 'select_by_role', 'open_kept'),
      (9, 'write_by_role', 'kept'),
      (10, 'blank_author', 'closed'),
      (11, 'changed', 'no');
    return;
  end if;

  if not v_select_open or not v_insert_open or not v_update_open
     or not v_notice_select_open or not v_notice_insert_open
     or v_live_count <> 5 or v_notice_count <> 2 then
    raise exception 'live policies are not the expected open set; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'agent_live_upsert_authenticated' and cmd = 'INSERT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'agent_live_update_authenticated' and cmd = 'UPDATE'
  ) then
    raise exception 'a floor policy is missing; nothing saved';
  end if;

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename in ('gi_agent_live', 'gi_system_notices')
    and ('anon' = any (roles) or 'public' = any (roles));
  if v_public <> 0 then
    raise exception 'a public policy is still open; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public'
    and tablename not in ('gi_agent_live', 'gi_system_notices');

  drop policy agent_live_select_authenticated on public.gi_agent_live;
  drop policy agent_live_upsert_authenticated on public.gi_agent_live;
  drop policy agent_live_update_authenticated on public.gi_agent_live;
  execute 'create policy agent_live_select_authenticated on public.gi_agent_live for select to authenticated using (' || v_live || ')';
  execute 'create policy agent_live_upsert_authenticated on public.gi_agent_live for insert to authenticated with check (' || v_live || ')';
  execute 'create policy agent_live_update_authenticated on public.gi_agent_live for update to authenticated using (' || v_live || ') with check (' || v_live || ')';
  drop policy gi_agent_live_insert_open on public.gi_agent_live;
  drop policy gi_agent_live_update_open on public.gi_agent_live;

  drop policy system_notices_insert_authenticated on public.gi_system_notices;
  execute 'create policy system_notices_insert_authenticated on public.gi_system_notices for insert to authenticated with check (' || v_notice || ')';

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'agent_live_select_authenticated' and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
      and coalesce(qual, '') like '%gi_jwt_agent_id()%'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
  ) into v_live_select_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'agent_live_upsert_authenticated' and cmd = 'INSERT'
      and coalesce(with_check, '') like '%gi_jwt_is_manager()%'
      and coalesce(with_check, '') like '%gi_jwt_agent_id()%'
  ) into v_live_insert_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname = 'agent_live_update_authenticated' and cmd = 'UPDATE'
      and coalesce(qual, '') like '%gi_jwt_agent_id()%'
      and coalesce(with_check, '') like '%gi_jwt_agent_id()%'
  ) into v_live_update_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_system_notices'
      and policyname = 'system_notices_select_authenticated' and cmd = 'SELECT'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
  ) into v_notice_select_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_system_notices'
      and policyname = 'system_notices_insert_authenticated' and cmd = 'INSERT'
      and coalesce(with_check, '') like '%gi_jwt_is_manager()%'
      and coalesce(with_check, '') not like '%gi_jwt_agent_id()%'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') <> 'true'
  ) into v_notice_insert_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_live'
      and policyname in ('gi_agent_live_insert_open', 'gi_agent_live_update_open')
  ) into v_insert_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('gi_agent_live', 'gi_system_notices')
      and (
        coalesce(qual, '') ~ $re$(agent_id|author_id)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$(agent_id|author_id)[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  select count(*) into v_live_count
  from pg_policies where schemaname = 'public' and tablename = 'gi_agent_live';
  select count(*) into v_notice_count
  from pg_policies where schemaname = 'public' and tablename = 'gi_system_notices';
  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename in ('gi_agent_live', 'gi_system_notices')
    and ('anon' = any (roles) or 'public' = any (roles));
  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public'
    and tablename not in ('gi_agent_live', 'gi_system_notices');

  if not v_live_select_ok or not v_live_insert_ok or not v_live_update_ok
     or not v_notice_select_ok or not v_notice_insert_ok
     or v_insert_open or v_blank
     or v_live_count <> 3 or v_notice_count <> 2 or v_public <> 0
     or v_other_after <> v_other_before then
    raise exception 'more than the live role path changed; nothing saved';
  end if;

  insert into gi_rls_live_by_role(sort_key, section, detail) values
    (1, 'table', 'gi_agent_live'),
    (2, 'policies_removed', 'gi_agent_live_insert_open|gi_agent_live_update_open'),
    (3, 'select_by_role', 'installed'),
    (4, 'write_by_role', 'installed'),
    (5, 'blank_agent', 'closed'),
    (6, 'table', 'gi_system_notices'),
    (7, 'policies_removed', 'none'),
    (8, 'select_by_role', 'open_kept'),
    (9, 'write_by_role', 'installed'),
    (10, 'blank_author', 'closed'),
    (11, 'other_tables', 'unchanged'),
    (12, 'changed', 'yes');
end
$cut$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_live_by_role
order by sort_key;
