-- =============================================================================
-- GEMEL INVEST · close the public read on the activity log.
--
-- This file removes one policy, gi_actlog_select, from
-- public.gi_agent_activity_log. The open insert, gi_actlog_insert, stays.
-- The signed-in read and the signed-in insert stay. No other table is
-- touched. Row security is not switched on or off. Nothing is revoked.
-- Log rows are not read into the result and are not changed.
--
-- The read is removed only when a signed-in session can already read and
-- insert, the public insert is still the expected insert, and that session
-- still sees the same rows afterwards. If the signed-in count changes, a
-- public read would remain, or the public insert is missing, the whole
-- script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   create policy gi_actlog_select
--     on public.gi_agent_activity_log
--     for select
--     to anon, authenticated
--     using (true);
-- =============================================================================

drop table if exists gi_rls_actlog_close_read;
create temporary table gi_rls_actlog_close_read (
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
  v_removed boolean := false;
  v_cmd text;
  v_qual text;
  v_check text;
  v_permissive text;
  v_has_anon boolean := false;
  v_anon_left integer := 0;
  v_insert_name text;
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

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_agent_activity_log'
      and policyname = 'actlog_select_authenticated'
      and permissive::text in ('PERMISSIVE', 'true', 't')
      and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true')
  ) then
    raise exception 'signed-in read is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_agent_activity_log'
      and policyname = 'actlog_insert_authenticated'
      and permissive::text in ('PERMISSIVE', 'true', 't')
      and cmd = 'INSERT'
      and 'authenticated' = any (roles)
      and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true')
  ) then
    raise exception 'signed-in insert is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'gi_agent_activity_log'
    and p.policyname = 'gi_actlog_insert';

  if not found
     or v_permissive not in ('PERMISSIVE', 'true', 't')
     or v_cmd <> 'INSERT'
     or v_has_anon is distinct from true
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true'
     or (
       v_qual is not null
       and regexp_replace(lower(btrim(v_qual)), '[()]', '', 'g') <> 'true'
     ) then
    raise exception 'open insert is missing; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_agent_activity_log';

  select count(*) into v_table_before
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_agent_activity_log';

  select count(*) into v_rows_before
  from public.gi_agent_activity_log;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'gi_agent_activity_log'
    and p.policyname = 'gi_actlog_select';

  if found then
    if v_permissive not in ('PERMISSIVE', 'true', 't')
       or v_cmd <> 'SELECT'
       or v_has_anon is distinct from true
       or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
       or (
         v_check is not null
         and regexp_replace(lower(btrim(v_check)), '[()]', '', 'g') <> 'true'
       ) then
      raise exception 'open read shape is unexpected; nothing saved';
    end if;
  else
    select count(*) into v_anon_left
    from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_agent_activity_log'
      and permissive::text in ('PERMISSIVE', 'true', 't')
      and cmd in ('ALL', 'SELECT')
      and ('anon' = any (roles) or 'public' = any (roles));
    if v_anon_left > 0 then
      raise exception 'anon read is still open; nothing saved';
    end if;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'cannot prove the signed-in read stays; nothing saved';
  end if;

  begin
    execute 'set local role authenticated';
    select count(*) into v_auth_before from public.gi_agent_activity_log;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      v_auth_before := null;
  end;

  if v_auth_before is null then
    raise exception 'cannot prove the signed-in read stays; nothing saved';
  end if;

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

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_agent_activity_log'
      and policyname = 'gi_actlog_select'
  ) then
    execute 'drop policy gi_actlog_select on public.gi_agent_activity_log';
    v_removed := true;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_agent_activity_log'
      and policyname = 'actlog_select_authenticated'
      and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_agent_activity_log'
      and policyname = 'actlog_insert_authenticated'
      and cmd = 'INSERT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_agent_activity_log'
      and policyname = 'gi_actlog_insert'
      and cmd = 'INSERT'
  ) then
    raise exception 'signed-in access disappeared; nothing saved';
  end if;

  begin
    execute 'set local role authenticated';
    select count(*) into v_auth_after from public.gi_agent_activity_log;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      v_auth_after := null;
  end;

  if v_auth_after is null or v_auth_after is distinct from v_auth_before then
    raise exception 'signed-in rows changed; nothing saved';
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

  select count(*) into v_anon_left
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_agent_activity_log'
    and permissive::text in ('PERMISSIVE', 'true', 't')
    and cmd in ('ALL', 'SELECT')
    and ('anon' = any (roles) or 'public' = any (roles));

  if v_anon_left > 0 or (v_anon_after is not null and v_anon_after <> 0) then
    raise exception 'anon read is still open; nothing saved';
  end if;

  select p.policyname into v_insert_name
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'gi_agent_activity_log'
    and p.policyname = 'gi_actlog_insert'
    and p.cmd = 'INSERT';

  if v_insert_name is null then
    raise exception 'open insert disappeared; nothing saved';
  end if;

  select c.relrowsecurity into v_rls_after
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'gi_agent_activity_log';

  if v_rls_after is distinct from true then
    raise exception 'row security flag changed; nothing saved';
  end if;

  select count(*) into v_rows_after from public.gi_agent_activity_log;
  if v_rows_after <> v_rows_before then
    raise exception 'log rows changed; nothing saved';
  end if;

  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_agent_activity_log';
  if v_other_after <> v_other_before then
    raise exception 'another table changed; nothing saved';
  end if;

  select count(*) into v_table_after
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_agent_activity_log';
  if v_removed and v_table_after <> v_table_before - 1 then
    raise exception 'more than the public read was removed; nothing saved';
  end if;
  if not v_removed and v_table_after <> v_table_before then
    raise exception 'log policies changed; nothing saved';
  end if;

  insert into gi_rls_actlog_close_read(sort_key, section, detail) values
    (1, 'table', 'gi_agent_activity_log'),
    (2, 'rls_enabled', 'yes'),
    (3, 'authenticated_rows', 'same'),
    (4, 'anon_rows', case
      when v_anon_before is null and v_anon_after is null then 'not_counted'
      when v_anon_before is not null and v_anon_before > 0 and v_anon_after = 0 then 'hidden'
      else 'already_hidden' end),
    (5, 'log_rows', 'unchanged'),
    (6, 'other_tables', 'unchanged'),
    (7, 'policies_removed', case when v_removed then 'gi_actlog_select' else 'none' end),
    (8, 'signed_in_read', 'kept'),
    (9, 'signed_in_insert', 'kept'),
    (10, 'open_insert', 'gi_actlog_insert'),
    (11, 'read_door_closed', 'yes'),
    (12, 'insert_door_closed', 'no');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_actlog_close_read
order by sort_key;
