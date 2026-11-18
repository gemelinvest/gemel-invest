-- =============================================================================
-- GEMEL INVEST · close the signed-in read of the app meta table.
--
-- This file removes one policy, app_meta_select_authenticated, from
-- public.app_meta. A signed-in session no longer reads the table directly.
-- Settings, the settings clock, and the version read stay on their
-- functions. Insert, update, and delete policies stay. No other table is
-- touched. Row security is not switched. Meta values are not read into the
-- result and are not changed.
--
-- The policy is removed only when the five functions already exist and the
-- signed-in select is still there. If a check fails, the whole script stops
-- and saves nothing.
--
-- Run this once, after the screen that stops writing the table is on main.
-- If the editor warns about a temporary table, choose Run without RLS.
-- Paste the result rows. If it stops with an error, paste only the error
-- text and do not run it again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   create policy "app_meta_select_authenticated"
--     on public.app_meta
--     for select
--     to authenticated
--     using (true);
-- =============================================================================

drop table if exists gi_app_meta_select_off_hold;
create temporary table gi_app_meta_select_off_hold (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_fn integer := 0;
  v_before integer := 0;
  v_after integer := 0;
  v_other_before integer := 0;
  v_other_after integer := 0;
  v_rows_before integer := 0;
  v_rows_after integer := 0;
begin
  if to_regclass('public.app_meta') is null then
    raise exception 'app meta table is missing; nothing saved';
  end if;

  select count(*) into v_fn
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'gi_app_settings',
      'gi_app_settings_stamp',
      'gi_app_settings_save',
      'gi_app_version',
      'gi_app_version_save'
    );
  if v_fn <> 5 then
    raise exception 'settings functions are missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_meta'
      and policyname = 'app_meta_select_authenticated'
      and cmd = 'SELECT'
  ) then
    raise exception 'signed-in select is already gone; nothing saved';
  end if;

  select count(*) into v_before
  from pg_policies
  where schemaname = 'public' and tablename = 'app_meta';
  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public' and tablename <> 'app_meta';
  select count(*) into v_rows_before from public.app_meta;

  execute 'drop policy "app_meta_select_authenticated" on public.app_meta';

  select count(*) into v_after
  from pg_policies
  where schemaname = 'public' and tablename = 'app_meta';
  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public' and tablename <> 'app_meta';
  select count(*) into v_rows_after from public.app_meta;

  if v_after <> v_before - 1
     or v_other_after <> v_other_before
     or v_rows_after <> v_rows_before
     or exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'app_meta'
         and policyname = 'app_meta_select_authenticated'
     ) then
    raise exception 'select close changed more than the signed-in read; nothing saved';
  end if;

  insert into gi_app_meta_select_off_hold(sort_key, section, detail) values
    (1, 'policy', 'app_meta_select_authenticated'),
    (2, 'removed', 'yes'),
    (3, 'policies_changed', 'one'),
    (4, 'other_tables', 'no'),
    (5, 'rows_changed', 'no'),
    (6, 'answer', 'select_closed');
end
$body$;

select section, detail
from gi_app_meta_select_off_hold
order by sort_key;
