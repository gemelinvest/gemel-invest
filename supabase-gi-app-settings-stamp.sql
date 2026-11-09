-- GEMEL INVEST · the settings clock beside the open meta row.
-- Adds gi_app_settings_stamp. The screen tries it and still falls back to
-- the table. No policy changes. This file rewrites no row. The door stays
-- open. The answer is only the update time.
-- Run once after this file is on main. Paste the result rows.
-- If it errors, paste the ERROR line and leave out the DETAIL row.
-- Undo: drop function if exists public.gi_app_settings_stamp();

drop table if exists gi_app_settings_stamp_hold;
create temporary table gi_app_settings_stamp_hold (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_policies_before integer := 0;
  v_policies_after integer := 0;
  v_meta_before text;
  v_meta_after text;
  v_probe jsonb;
begin
  if to_regclass('public.app_meta') is null then
    raise exception 'settings table is missing; nothing saved';
  end if;
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'app_meta'
      and column_name in ('key', 'payload', 'updated_at')
  ) <> 3 then
    raise exception 'settings columns are missing; nothing saved';
  end if;

  select count(*) into v_policies_before from pg_policies where schemaname = 'public';
  select md5(coalesce(string_agg(key || payload::text || coalesce(updated_at::text, ''), '|' order by key), ''))
    into v_meta_before from public.app_meta;

  execute $fn$
    create or replace function public.gi_app_settings_stamp()
    returns jsonb
    language plpgsql
    stable
    security definer
    set search_path = public
    as $func$
    declare
      v_at timestamptz;
    begin
      select m.updated_at into v_at
      from public.app_meta m
      where m.key = 'global'
      limit 1;
      if not found then
        return jsonb_build_object('ok', false, 'error', 'missing');
      end if;
      return jsonb_build_object('ok', true, 'updated_at', v_at);
    end;
    $func$
  $fn$;

  execute 'revoke all on function public.gi_app_settings_stamp() from public, anon';
  execute 'grant execute on function public.gi_app_settings_stamp() to authenticated';

  select public.gi_app_settings_stamp() into v_probe;
  if v_probe is null or not (v_probe ? 'ok') or (select count(*) from jsonb_object_keys(v_probe)) <> 2
     or v_probe ? 'payload' or v_probe ? 'pin' then
    raise exception 'settings clock returned a closed field; nothing saved';
  end if;

  if has_function_privilege('public', 'public.gi_app_settings_stamp()', 'execute')
     or (
       exists (select 1 from pg_roles where rolname = 'anon')
       and has_function_privilege('anon', 'public.gi_app_settings_stamp()', 'execute')
     ) then
    raise exception 'anon can read the settings clock; nothing saved';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and not has_function_privilege('authenticated', 'public.gi_app_settings_stamp()', 'execute') then
    raise exception 'a signed-in session cannot read the settings clock; nothing saved';
  end if;

  select count(*) into v_policies_after from pg_policies where schemaname = 'public';
  select md5(coalesce(string_agg(key || payload::text || coalesce(updated_at::text, ''), '|' order by key), ''))
    into v_meta_after from public.app_meta;
  if v_policies_after <> v_policies_before or v_meta_after is distinct from v_meta_before then
    raise exception 'tables changed; nothing saved';
  end if;

  insert into gi_app_settings_stamp_hold(sort_key, section, detail) values
    (1, 'function', 'gi_app_settings_stamp'),
    (2, 'installed', 'yes'),
    (3, 'door_closed', 'no'),
    (4, 'policies_changed', 'no'),
    (5, 'rows_changed', 'no'),
    (6, 'anon_read', 'no'),
    (7, 'signed_in_read', 'yes'),
    (8, 'answer', 'time_only'),
    (9, 'table_read', 'kept');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_app_settings_stamp_hold
order by sort_key, detail;
