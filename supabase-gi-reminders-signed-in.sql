-- =============================================================================
-- GEMEL INVEST · inert signed-in path on reminders.
--
-- This file adds one authenticated policy and drops nothing:
--   reminders_all_authenticated  ALL to authenticated, using true, check true
--
-- The public door stays. The four limited signed-in policies stay, and
-- their limits are not turned into the only path. No stored reminder is
-- read into the result or rewritten. Row security is not switched on.
-- Nothing is revoked.
--
-- The policy is added only when the public door is already open, so a
-- signed-in session can already do the same things. If a visible count
-- changes, the public door is missing, or a limited policy is missing,
-- the script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   drop policy if exists reminders_all_authenticated on public.reminders;
-- =============================================================================

drop table if exists gi_rls_reminders_hold;
create temporary table gi_rls_reminders_hold (
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
  v_before integer := 0;
  v_after integer := 0;
  v_other_before integer := 0;
  v_other_after integer := 0;
  v_rows_before integer := 0;
  v_rows_after integer := 0;
  v_anon_before integer;
  v_anon_after integer;
  v_auth_before integer;
  v_auth_after integer;
  v_new boolean := false;
begin
  if to_regclass('public.reminders') is null then
    raise exception 'reminders table is missing; nothing saved';
  end if;

  select c.relrowsecurity into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'reminders';
  if v_rls is distinct from true then
    raise exception 'reminders row security is off; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'reminders'
    and p.policyname = 'anon_full_access';
  if not found
     or v_permissive not in ('PERMISSIVE', 'true', 't')
     or v_cmd <> 'ALL'
     or v_has_anon is distinct from true
     or v_has_auth is distinct from true
     or regexp_replace(lower(btrim(coalesce(v_qual, ''))), '[()]', '', 'g') <> 'true'
     or regexp_replace(lower(btrim(coalesce(v_check, ''))), '[()]', '', 'g') <> 'true' then
    raise exception 'open reminders door is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and policyname = 'reminders_select_authenticated'
      and cmd = 'SELECT' and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and policyname = 'reminders_insert_authenticated'
      and cmd = 'INSERT' and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and policyname = 'reminders_update_authenticated'
      and cmd = 'UPDATE' and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and policyname = 'reminders_delete_authenticated'
      and cmd = 'DELETE' and 'authenticated' = any (roles)
  ) then
    raise exception 'reminders limits are missing; nothing saved';
  end if;

  select count(*) into v_before from pg_policies
  where schemaname = 'public' and tablename = 'reminders';
  select count(*) into v_other_before from pg_policies
  where schemaname = 'public' and tablename <> 'reminders';
  select count(*) into v_rows_before from public.reminders;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select count(*) into v_anon_before from public.reminders;
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
      select count(*) into v_auth_before from public.reminders;
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
  where p.schemaname = 'public' and p.tablename = 'reminders'
    and p.policyname = 'reminders_all_authenticated';
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
      create policy reminders_all_authenticated
        on public.reminders
        for all
        to authenticated
        using (true)
        with check (true)
    $policy$;
    v_new := true;
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select count(*) into v_anon_after from public.reminders;
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
      select count(*) into v_auth_after from public.reminders;
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

  select count(*) into v_rows_after from public.reminders;
  if v_rows_after <> v_rows_before then
    raise exception 'reminders rows changed; nothing saved';
  end if;

  select count(*) into v_after from pg_policies
  where schemaname = 'public' and tablename = 'reminders';
  select count(*) into v_other_after from pg_policies
  where schemaname = 'public' and tablename <> 'reminders';

  if v_after <> v_before + (case when v_new then 1 else 0 end) then
    raise exception 'reminders policies changed by more than the extra path; nothing saved';
  end if;
  if v_other_after <> v_other_before then
    raise exception 'another table changed; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reminders'
      and policyname = 'anon_full_access' and cmd = 'ALL'
  ) then
    raise exception 'open reminders door disappeared; nothing saved';
  end if;

  insert into gi_rls_reminders_hold(sort_key, section, detail) values
    (1, 'table', 'reminders'),
    (2, 'signed_in_all', case when v_new then 'installed' else 'already_present' end),
    (3, 'anon_rows', case when v_anon_before is null then 'not_counted' when v_anon_before = v_anon_after then 'same' else 'changed' end),
    (4, 'authenticated_rows', case when v_auth_before is null then 'not_counted' when v_auth_before = v_auth_after then 'same' else 'changed' end),
    (5, 'limited_policies', 'kept'),
    (6, 'other_tables', 'unchanged'),
    (7, 'open_door', 'kept'),
    (8, 'access_changed', 'no'),
    (9, 'door_closed', 'no');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_reminders_hold
order by sort_key;
