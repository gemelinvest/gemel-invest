-- GEMEL INVEST · read the version row through a function.
-- The screen tries gi_app_version first. If it does not answer, the
-- existing table read stays. This file does not change a policy, does
-- not write a row, and does not read the global settings row.
-- Any signed-in session may read the version. The public key cannot.
-- The update notice and the version channel stay.
-- Run once after this file is on main. Paste the result rows.
-- If it errors, paste the ERROR line and leave out the DETAIL row.
-- Undo: drop function if exists public.gi_app_version();

drop table if exists gi_app_version_hold;
create temporary table gi_app_version_hold (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_policies_before integer := 0;
  v_policies_after integer := 0;
  v_rows_before text := '';
  v_rows_after text := '';
  v_def text := '';
  v_anon boolean := false;
  v_signed boolean := false;
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
  select coalesce(string_agg(
    md5(m.key || m.payload::text || coalesce(m.updated_at::text, '')),
    ',' order by m.key
  ), '') into v_rows_before
  from public.app_meta m;

  execute $fn$
    create or replace function public.gi_app_version()
    returns jsonb
    language plpgsql
    stable
    security definer
    set search_path = public
    as $func$
    declare
      v_payload jsonb := null;
    begin
      if auth.uid() is null then
        return jsonb_build_object('ok', false, 'error', 'NO_SESSION');
      end if;
      select m.payload into v_payload
      from public.app_meta m
      where m.key = 'app_version'
      limit 1;
      if v_payload is null or jsonb_typeof(v_payload) <> 'object' then
        return jsonb_build_object('ok', true, 'key', 'app_version', 'payload', null);
      end if;
      return jsonb_build_object(
        'ok', true,
        'key', 'app_version',
        'payload', jsonb_build_object(
          'version', coalesce(v_payload->>'version', ''),
          'notes', coalesce(v_payload->>'notes', ''),
          'effectiveAt', case when v_payload ? 'effectiveAt' then v_payload->'effectiveAt' else 'null'::jsonb end,
          'publishedAt', coalesce(v_payload->>'publishedAt', ''),
          'updatedBy', coalesce(v_payload->>'updatedBy', '')
        )
      );
    end;
    $func$
  $fn$;

  execute 'revoke all on function public.gi_app_version() from public, anon';
  execute 'grant execute on function public.gi_app_version() to authenticated';

  select pg_get_functiondef('public.gi_app_version()'::regprocedure) into v_def;
  if position('key = ''app_version''' in v_def) = 0
     or position('auth.uid()' in v_def) = 0
     or position('key = ''global''' in v_def) > 0
     or position('set payload' in lower(v_def)) > 0 then
    raise exception 'version read shape is unexpected; nothing saved';
  end if;

  select has_function_privilege('public', 'public.gi_app_version()', 'execute')
      or has_function_privilege('anon', 'public.gi_app_version()', 'execute')
    into v_anon;
  select has_function_privilege('authenticated', 'public.gi_app_version()', 'execute')
    into v_signed;
  if v_anon then
    raise exception 'anon can read the version; nothing saved';
  end if;
  if not v_signed then
    raise exception 'a signed-in session cannot read the version; nothing saved';
  end if;

  select count(*) into v_policies_after from pg_policies where schemaname = 'public';
  select coalesce(string_agg(
    md5(m.key || m.payload::text || coalesce(m.updated_at::text, '')),
    ',' order by m.key
  ), '') into v_rows_after
  from public.app_meta m;
  if v_policies_after <> v_policies_before or v_rows_after <> v_rows_before then
    raise exception 'tables changed; nothing saved';
  end if;

  insert into gi_app_version_hold(sort_key, section, detail) values
    (1, 'function', 'gi_app_version'),
    (2, 'installed', 'yes'),
    (3, 'door_closed', 'no'),
    (4, 'policies_changed', 'no'),
    (5, 'rows_changed', 'no'),
    (6, 'answer', 'version_only'),
    (7, 'anon_read', 'no'),
    (8, 'table_read', 'kept'),
    (9, 'global_row', 'unread');
end
$body$;

select section, detail
from gi_app_version_hold
order by sort_key, detail;
