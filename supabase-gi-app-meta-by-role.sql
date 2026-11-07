-- =============================================================================
-- GEMEL INVEST · close the open write on app settings.
--
-- public.app_meta has an open signed-in policy,
-- gi_app_meta_all_authenticated. It lets every signed-in person read,
-- change, and delete every setting. The select policy beside it is also
-- open. Insert, update, and delete are limited. A public delete block
-- stays. The columns are key, payload, and updated_at.
--
-- The screen reads the global row on boot, and a signed-in person saves
-- that same row. The phone also saves a notification row whose key starts
-- with onyxsub_. A manager publishes the app_version row.
--
-- This file removes the open policy. Reading stays open to every
-- signed-in person. A manager can still write and delete every row.
-- Anyone else with an agent id can write only the global row or a
-- notification row. A blank agent id cannot write. Other keys, including
-- app_version, stay with a manager. The public delete block stays. No
-- setting is read or changed. No other table is touched.
--
-- The swap happens only when row security is on, key and payload exist,
-- the six known policies are the whole set, the select and the open
-- policy are open, and the helpers exist. If the new policies are missing
-- afterwards, the whole script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   create policy gi_app_meta_all_authenticated
--     on public.app_meta
--     for all to authenticated
--     using (true) with check (true);
--   drop policy if exists app_meta_insert_authenticated on public.app_meta;
--   drop policy if exists app_meta_update_authenticated on public.app_meta;
--   drop policy if exists app_meta_delete_authenticated on public.app_meta;
--   create policy app_meta_insert_authenticated
--     on public.app_meta for insert to authenticated
--     with check (public.gi_jwt_is_manager());
--   create policy app_meta_update_authenticated
--     on public.app_meta for update to authenticated
--     using (public.gi_jwt_is_manager()) with check (public.gi_jwt_is_manager());
--   create policy app_meta_delete_authenticated
--     on public.app_meta for delete to authenticated
--     using (public.gi_jwt_is_manager());
-- =============================================================================

drop table if exists gi_rls_app_meta_by_role;
create temporary table gi_rls_app_meta_by_role (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $cut$
declare
  v_rls boolean;
  v_open boolean;
  v_select_open boolean;
  v_count integer;
  v_public integer;
  v_other_before integer;
  v_other_after integer;
  v_select_ok boolean;
  v_insert_ok boolean;
  v_update_ok boolean;
  v_delete_ok boolean;
  v_block_ok boolean;
  v_blank boolean;
  v_write text := $pred$
        public.gi_jwt_is_manager()
        or (
          public.gi_jwt_agent_id() <> ''
          and (
            coalesce(key, '') = 'global'
            or starts_with(coalesce(key, ''), 'onyxsub_')
          )
        )
  $pred$;
  v_manager text := $pred$public.gi_jwt_is_manager()$pred$;
begin
  if to_regclass('public.app_meta') is null then
    raise exception 'app meta table is missing; nothing saved';
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'app_meta';
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_meta' and column_name = 'key'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_meta' and column_name = 'payload'
  ) then
    raise exception 'setting columns are missing; nothing saved';
  end if;

  if to_regprocedure('public.gi_jwt_is_manager()') is null
     or to_regprocedure('public.gi_jwt_agent_id()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_meta'
      and policyname = 'gi_app_meta_all_authenticated' and cmd = 'ALL'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_meta'
      and policyname = 'app_meta_select_authenticated' and cmd = 'SELECT'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
  ) into v_select_open;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public' and tablename = 'app_meta';

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_meta'
      and (
        coalesce(qual, '') ~ $re$key[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$key[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  if not v_open and v_select_open and not v_blank and v_count = 5
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'app_meta'
         and policyname = 'app_meta_insert_authenticated' and cmd = 'INSERT'
         and coalesce(with_check, '') like '%gi_jwt_is_manager()%'
         and coalesce(with_check, '') like '%''global''%'
         and coalesce(with_check, '') like '%onyxsub_%'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'app_meta'
         and policyname = 'app_meta_delete_authenticated' and cmd = 'DELETE'
         and coalesce(qual, '') like '%gi_jwt_is_manager()%'
         and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'app_meta'
         and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
     ) then
    insert into gi_rls_app_meta_by_role(sort_key, section, detail) values
      (1, 'table', 'app_meta'),
      (2, 'policies_removed', 'none'),
      (3, 'select_by_role', 'open_kept'),
      (4, 'write_by_role', 'kept'),
      (5, 'blank_key', 'closed'),
      (6, 'anon_delete_block', 'kept'),
      (7, 'changed', 'no');
    return;
  end if;

  if not v_open or not v_select_open or v_count <> 6 then
    raise exception 'app meta policies are not the expected open set; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_meta'
      and policyname = 'app_meta_insert_authenticated' and cmd = 'INSERT'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') <> 'true'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_meta'
      and policyname = 'app_meta_update_authenticated' and cmd = 'UPDATE'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_meta'
      and policyname = 'app_meta_delete_authenticated' and cmd = 'DELETE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_meta'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
      and ('anon' = any (roles) or 'public' = any (roles))
  ) then
    raise exception 'an app meta policy is missing; nothing saved';
  end if;

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public' and tablename = 'app_meta'
    and ('anon' = any (roles) or 'public' = any (roles))
    and policyname <> 'z_block_anon_delete';
  if v_public <> 0 then
    raise exception 'a public policy is still open; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public' and tablename <> 'app_meta';

  drop policy app_meta_insert_authenticated on public.app_meta;
  drop policy app_meta_update_authenticated on public.app_meta;
  drop policy app_meta_delete_authenticated on public.app_meta;
  execute 'create policy app_meta_insert_authenticated on public.app_meta for insert to authenticated with check (' || v_write || ')';
  execute 'create policy app_meta_update_authenticated on public.app_meta for update to authenticated using (' || v_write || ') with check (' || v_write || ')';
  execute 'create policy app_meta_delete_authenticated on public.app_meta for delete to authenticated using (' || v_manager || ')';
  drop policy gi_app_meta_all_authenticated on public.app_meta;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_meta'
      and policyname = 'app_meta_select_authenticated' and cmd = 'SELECT'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
  ) into v_select_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_meta'
      and policyname = 'app_meta_insert_authenticated' and cmd = 'INSERT'
      and coalesce(with_check, '') like '%gi_jwt_is_manager()%'
      and coalesce(with_check, '') like '%''global''%'
      and coalesce(with_check, '') like '%onyxsub_%'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') <> 'true'
  ) into v_insert_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_meta'
      and policyname = 'app_meta_update_authenticated' and cmd = 'UPDATE'
      and coalesce(qual, '') like '%''global''%'
      and coalesce(with_check, '') like '%onyxsub_%'
  ) into v_update_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_meta'
      and policyname = 'app_meta_delete_authenticated' and cmd = 'DELETE'
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
      and coalesce(qual, '') not like '%onyxsub_%'
  ) into v_delete_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_meta'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
  ) into v_block_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_meta'
      and policyname = 'gi_app_meta_all_authenticated'
  ) into v_open;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_meta'
      and (
        coalesce(qual, '') ~ $re$key[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$key[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;
  select count(*) into v_count
  from pg_policies where schemaname = 'public' and tablename = 'app_meta';
  select count(*) into v_public
  from pg_policies
  where schemaname = 'public' and tablename = 'app_meta'
    and ('anon' = any (roles) or 'public' = any (roles))
    and policyname <> 'z_block_anon_delete';
  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public' and tablename <> 'app_meta';

  if not v_select_ok or not v_insert_ok or not v_update_ok or not v_delete_ok or not v_block_ok
     or v_open or v_blank or v_count <> 5 or v_public <> 0
     or v_other_after <> v_other_before then
    raise exception 'more than the app meta role path changed; nothing saved';
  end if;

  insert into gi_rls_app_meta_by_role(sort_key, section, detail) values
    (1, 'table', 'app_meta'),
    (2, 'policies_removed', 'gi_app_meta_all_authenticated'),
    (3, 'select_by_role', 'open_kept'),
    (4, 'write_by_role', 'installed'),
    (5, 'blank_key', 'closed'),
    (6, 'anon_delete_block', 'kept'),
    (7, 'other_tables', 'unchanged'),
    (8, 'changed', 'yes');
end
$cut$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_app_meta_by_role
order by sort_key;
