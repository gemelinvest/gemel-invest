-- =============================================================================
-- GEMEL INVEST · close the public insert on the activity log.
--
-- This file removes one policy, gi_actlog_insert, from
-- public.gi_agent_activity_log. The signed-in read and the signed-in
-- insert stay. The public read stays closed. No other table is touched.
-- Row security is not switched on or off. Nothing is revoked. Log rows
-- are not read into the result and are not changed.
--
-- The insert is removed only when a signed-in session can already read
-- and insert, the public read is already closed, and that session still
-- sees the same rows afterwards. If a count changes, a public read or
-- insert would remain, or the signed-in path is missing, the whole script
-- stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   create policy gi_actlog_insert
--     on public.gi_agent_activity_log
--     for insert
--     to anon, authenticated
--     with check (true);
-- =============================================================================

drop table if exists gi_rls_actlog_close_insert;
create temporary table gi_rls_actlog_close_insert (
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
  v_has_anon boolean := false;
  v_drop boolean := false;
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
  v_left integer := 0;
  v_expected integer := 0;
begin
  if to_regclass('public.gi_agent_activity_log') is null then
    raise exception 'activity log table is missing; nothing saved';
  end if;

  select c.relrowsecurity into v_rls
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
      and not ('anon' = any (roles) or 'public' = any (roles))
      and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true')
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_agent_activity_log'
      and policyname = 'actlog_insert_authenticated'
      and permissive::text in ('PERMISSIVE', 'true', 't')
      and cmd = 'INSERT'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and (with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true')
  ) then
    raise exception 'signed-in path is missing; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'gi_agent_activity_log'
    and p.policyname = 'gi_actlog_insert';
  if found then
    if v_permissive not in ('PERMISSIVE', 'true', 't')
       or v_cmd <> 'INSERT'
       or v_has_anon is distinct from true
       or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true'
       or (
         v_qual is not null
         and regexp_replace(lower(btrim(v_qual)), '[()]', '', 'g') <> 'true'
       ) then
      raise exception 'open insert shape is unexpected; nothing saved';
    end if;
    v_drop := true;
  end if;

  select count(*) into v_other_before from pg_policies
  where schemaname = 'public' and tablename <> 'gi_agent_activity_log';
  select count(*) into v_table_before from pg_policies
  where schemaname = 'public' and tablename = 'gi_agent_activity_log';
  select count(*) into v_rows_before from public.gi_agent_activity_log;

  if not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'anon') then
    raise exception 'cannot prove the signed-in read stays; nothing saved';
  end if;

  begin
    execute 'set local role authenticated';
    select count(*) into v_auth_before from public.gi_agent_activity_log;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'cannot prove the signed-in read stays; nothing saved';
  end;

  begin
    execute 'set local role anon';
    select count(*) into v_anon_before from public.gi_agent_activity_log;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'cannot prove the public read stays closed; nothing saved';
  end;

  if coalesce(v_anon_before, 0) <> 0 then
    raise exception 'anon read is still open; nothing saved';
  end if;
  if v_auth_before is distinct from v_rows_before then
    raise exception 'cannot prove the signed-in read stays; nothing saved';
  end if;

  if v_drop then
    execute 'drop policy gi_actlog_insert on public.gi_agent_activity_log';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_activity_log'
      and policyname = 'actlog_select_authenticated' and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_agent_activity_log'
      and policyname = 'actlog_insert_authenticated' and cmd = 'INSERT'
  ) then
    raise exception 'signed-in path disappeared; nothing saved';
  end if;

  begin
    execute 'set local role authenticated';
    select count(*) into v_auth_after from public.gi_agent_activity_log;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'signed-in rows changed; nothing saved';
  end;

  begin
    execute 'set local role anon';
    select count(*) into v_anon_after from public.gi_agent_activity_log;
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'anon read is still open; nothing saved';
  end;

  if v_auth_after is distinct from v_auth_before or coalesce(v_anon_after, 0) <> 0 then
    raise exception 'signed-in rows changed; nothing saved';
  end if;

  select count(*) into v_left
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_agent_activity_log'
    and permissive::text in ('PERMISSIVE', 'true', 't')
    and ('anon' = any (roles) or 'public' = any (roles))
    and (
      (cmd in ('ALL', 'SELECT') and (
        qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true'
      ))
      or (cmd in ('ALL', 'INSERT') and (
        with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true'
      ))
      or (cmd = 'UPDATE' and (
        qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true'
      ) and (
        with_check is null or regexp_replace(lower(btrim(with_check)), '[()]', '', 'g') = 'true'
      ))
    );
  if v_left > 0 then
    raise exception 'anon insert is still open; nothing saved';
  end if;

  select count(*) into v_rows_after from public.gi_agent_activity_log;
  if v_rows_after <> v_rows_before then
    raise exception 'log rows changed; nothing saved';
  end if;

  select count(*) into v_other_after from pg_policies
  where schemaname = 'public' and tablename <> 'gi_agent_activity_log';
  if v_other_after <> v_other_before then
    raise exception 'another table changed; nothing saved';
  end if;

  select count(*) into v_table_after from pg_policies
  where schemaname = 'public' and tablename = 'gi_agent_activity_log';
  v_expected := case when v_drop then 1 else 0 end;
  if v_table_before - v_table_after <> v_expected then
    raise exception 'more than the public insert was removed; nothing saved';
  end if;

  insert into gi_rls_actlog_close_insert(sort_key, section, detail) values
    (1, 'table', 'gi_agent_activity_log'),
    (2, 'rls_enabled', 'yes'),
    (3, 'authenticated_rows', 'same'),
    (4, 'anon_rows', 'already_hidden'),
    (5, 'log_rows', 'unchanged'),
    (6, 'other_tables', 'unchanged'),
    (7, 'policies_removed', case when v_drop then 'gi_actlog_insert' else 'none' end),
    (8, 'signed_in_read', 'kept'),
    (9, 'signed_in_insert', 'kept'),
    (10, 'read_door_closed', 'yes'),
    (11, 'insert_door_closed', 'yes');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_actlog_close_insert
order by sort_key;
