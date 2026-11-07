-- =============================================================================
-- GEMEL INVEST · keep owner devices with a manager.
--
-- public.owner_devices has an open signed-in policy,
-- owner_devices_all_authenticated. It lets every signed-in person read and
-- change every device, including the token column. The select, insert,
-- and update policies beside it are already limited. The table has
-- owner_id, owner_name, and token. The screen does not read this table.
--
-- This file removes the open policy and rewrites select, insert, and
-- update so only a manager can use them. It also adds a manager delete,
-- because the open policy was the only delete path. A device is not given
-- to whoever happens to match owner_id. A blank owner_id stays with a
-- manager. No other table is touched. Device rows are not read and are
-- not changed.
--
-- The swap happens only when row security is on, owner_id, owner_name,
-- and token exist, the four known policies are the whole set, the select,
-- insert, and update policies are limited, and the manager helper exists.
-- If the new policies are missing afterwards, the whole script stops and
-- saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   create policy owner_devices_all_authenticated
--     on public.owner_devices
--     for all to authenticated
--     using (true) with check (true);
--   drop policy if exists owner_devices_delete_authenticated on public.owner_devices;
-- =============================================================================

drop table if exists gi_rls_owner_devices_by_role;
create temporary table gi_rls_owner_devices_by_role (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $cut$
declare
  v_rls boolean;
  v_open boolean;
  v_select_open boolean;
  v_insert_open boolean;
  v_update_open boolean;
  v_count integer;
  v_public integer;
  v_other_before integer;
  v_other_after integer;
  v_select_ok boolean;
  v_insert_ok boolean;
  v_update_ok boolean;
  v_delete_ok boolean;
  v_blank boolean;
  v_pred text := $pred$public.gi_jwt_is_manager()$pred$;
begin
  if to_regclass('public.owner_devices') is null then
    raise exception 'owner devices table is missing; nothing saved';
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'owner_devices';
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'owner_devices'
      and column_name = 'owner_id'
  ) then
    raise exception 'owner_id column is missing; nothing saved';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'owner_devices'
      and column_name = 'owner_name'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'owner_devices'
      and column_name = 'token'
  ) then
    raise exception 'device columns are missing; nothing saved';
  end if;

  if to_regprocedure('public.gi_jwt_is_manager()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'owner_devices'
      and policyname = 'owner_devices_all_authenticated'
      and cmd = 'ALL'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'owner_devices'
      and policyname = 'owner_devices_select_authenticated'
      and cmd = 'SELECT'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
  ) into v_select_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'owner_devices'
      and policyname = 'owner_devices_insert_authenticated'
      and cmd = 'INSERT'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_insert_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'owner_devices'
      and policyname = 'owner_devices_update_authenticated'
      and cmd = 'UPDATE'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_update_open;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'owner_devices';

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'owner_devices'
      and (
        coalesce(qual, '') ~ $re$(agent_id|owner_id|user_id)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$(agent_id|owner_id|user_id)[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  if not v_open and not v_select_open and not v_insert_open and not v_update_open
     and not v_blank and v_count = 4
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'owner_devices'
         and policyname = 'owner_devices_select_authenticated'
         and cmd = 'SELECT'
         and coalesce(qual, '') like '%gi_jwt_is_manager()%'
         and coalesce(qual, '') not like '%gi_jwt_agent_id()%'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'owner_devices'
         and policyname = 'owner_devices_delete_authenticated' and cmd = 'DELETE'
         and coalesce(qual, '') like '%gi_jwt_is_manager()%'
     ) then
    insert into gi_rls_owner_devices_by_role(sort_key, section, detail) values
      (1, 'table', 'owner_devices'),
      (2, 'policies_removed', 'none'),
      (3, 'select_by_role', 'kept'),
      (4, 'write_by_role', 'kept'),
      (5, 'blank_owner', 'closed'),
      (6, 'changed', 'no');
    return;
  end if;

  if not v_open or v_select_open or v_insert_open or v_update_open or v_count <> 4 then
    raise exception 'owner device policies are not the expected open set; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'owner_devices'
      and policyname = 'owner_devices_select_authenticated' and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'owner_devices'
      and policyname = 'owner_devices_insert_authenticated' and cmd = 'INSERT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'owner_devices'
      and policyname = 'owner_devices_update_authenticated' and cmd = 'UPDATE'
  ) or exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'owner_devices'
      and policyname = 'owner_devices_delete_authenticated'
  ) then
    raise exception 'an owner device policy is missing; nothing saved';
  end if;

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'owner_devices'
    and ('anon' = any (roles) or 'public' = any (roles));
  if v_public <> 0 then
    raise exception 'a public policy is still open; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'owner_devices';

  drop policy owner_devices_select_authenticated on public.owner_devices;
  drop policy owner_devices_insert_authenticated on public.owner_devices;
  drop policy owner_devices_update_authenticated on public.owner_devices;

  execute 'create policy owner_devices_select_authenticated on public.owner_devices for select to authenticated using (' || v_pred || ')';
  execute 'create policy owner_devices_insert_authenticated on public.owner_devices for insert to authenticated with check (' || v_pred || ')';
  execute 'create policy owner_devices_update_authenticated on public.owner_devices for update to authenticated using (' || v_pred || ') with check (' || v_pred || ')';
  execute 'create policy owner_devices_delete_authenticated on public.owner_devices for delete to authenticated using (' || v_pred || ')';

  drop policy owner_devices_all_authenticated on public.owner_devices;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'owner_devices'
      and policyname = 'owner_devices_select_authenticated'
      and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
      and coalesce(qual, '') not like '%gi_jwt_agent_id()%'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
  ) into v_select_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'owner_devices'
      and policyname = 'owner_devices_insert_authenticated'
      and cmd = 'INSERT'
      and coalesce(with_check, '') like '%gi_jwt_is_manager()%'
      and coalesce(with_check, '') not like '%gi_jwt_agent_id()%'
  ) into v_insert_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'owner_devices'
      and policyname = 'owner_devices_update_authenticated'
      and cmd = 'UPDATE'
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
      and coalesce(with_check, '') like '%gi_jwt_is_manager()%'
  ) into v_update_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'owner_devices'
      and policyname = 'owner_devices_delete_authenticated'
      and cmd = 'DELETE'
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
  ) into v_delete_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'owner_devices'
      and policyname = 'owner_devices_all_authenticated'
  ) into v_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'owner_devices'
      and (
        coalesce(qual, '') ~ $re$(agent_id|owner_id|user_id)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$(agent_id|owner_id|user_id)[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public' and tablename = 'owner_devices';

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'owner_devices'
    and ('anon' = any (roles) or 'public' = any (roles));

  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'owner_devices';

  if not v_select_ok or not v_insert_ok or not v_update_ok or not v_delete_ok
     or v_open or v_blank or v_count <> 4 or v_public <> 0
     or v_other_after <> v_other_before then
    raise exception 'more than the owner device role path changed; nothing saved';
  end if;

  insert into gi_rls_owner_devices_by_role(sort_key, section, detail) values
    (1, 'table', 'owner_devices'),
    (2, 'policies_removed', 'owner_devices_all_authenticated'),
    (3, 'select_by_role', 'installed'),
    (4, 'write_by_role', 'installed'),
    (5, 'blank_owner', 'closed'),
    (6, 'other_tables', 'unchanged'),
    (7, 'changed', 'yes');
end
$cut$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_owner_devices_by_role
order by sort_key;
