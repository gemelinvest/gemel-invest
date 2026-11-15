-- GEMEL INVEST · publish the version row through a function.
-- The screen tries gi_app_version_save first. If it does not answer,
-- the existing table write stays. This file does not change a policy,
-- does not write a row, and does not touch the global settings row.
-- Only a manager may publish. The update notice and the version poll stay.
-- Run once after this file is on main. Paste the result rows.
-- If it errors, paste the ERROR line and leave out the DETAIL row.
-- Undo: drop function if exists public.gi_app_version_save(jsonb);

drop table if exists gi_app_version_save_hold;
create temporary table gi_app_version_save_hold (
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
  if to_regprocedure('public.gi_jwt_is_manager()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select count(*) into v_policies_before from pg_policies where schemaname = 'public';
  select coalesce(string_agg(
    md5(m.key || m.payload::text || coalesce(m.updated_at::text, '')),
    ',' order by m.key
  ), '') into v_rows_before
  from public.app_meta m;

  execute $fn$
    create or replace function public.gi_app_version_save(p_payload jsonb)
    returns jsonb
    language plpgsql
    security definer
    set search_path = public
    as $func$
    declare
      v_payload jsonb := '{}'::jsonb;
      v_version text := '';
    begin
      if auth.uid() is null then
        return jsonb_build_object('ok', false, 'error', 'NO_SESSION');
      end if;
      if coalesce(public.gi_jwt_is_manager(), false) is not true then
        return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED');
      end if;
      v_version := btrim(coalesce(p_payload->>'version', ''));
      if jsonb_typeof(p_payload) <> 'object' or v_version = '' then
        return jsonb_build_object('ok', false, 'error', 'VERSION_SHAPE');
      end if;

      v_payload := jsonb_build_object(
        'version', v_version,
        'notes', coalesce(p_payload->>'notes', ''),
        'effectiveAt', case when p_payload ? 'effectiveAt' then p_payload->'effectiveAt' else 'null'::jsonb end,
        'publishedAt', coalesce(nullif(btrim(coalesce(p_payload->>'publishedAt', '')), ''), to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
        'updatedBy', coalesce(p_payload->>'updatedBy', '')
      );

      update public.app_meta
         set payload = v_payload,
             updated_at = now()
       where key = 'app_version';
      if not found then
        insert into public.app_meta(key, payload, updated_at)
        values ('app_version', v_payload, now());
      end if;
      return jsonb_build_object('ok', true, 'key', 'app_version', 'version', v_version);
    end;
    $func$
  $fn$;

  execute 'revoke all on function public.gi_app_version_save(jsonb) from public, anon';
  execute 'grant execute on function public.gi_app_version_save(jsonb) to authenticated';

  select pg_get_functiondef('public.gi_app_version_save(jsonb)'::regprocedure) into v_def;
  if position('key = ''app_version''' in v_def) = 0
     or position('gi_jwt_is_manager()' in v_def) = 0
     or position('auth.uid()' in v_def) = 0
     or position('key = ''global''' in v_def) > 0 then
    raise exception 'version save shape is unexpected; nothing saved';
  end if;

  select has_function_privilege('public', 'public.gi_app_version_save(jsonb)', 'execute')
      or has_function_privilege('anon', 'public.gi_app_version_save(jsonb)', 'execute')
    into v_anon;
  select has_function_privilege('authenticated', 'public.gi_app_version_save(jsonb)', 'execute')
    into v_signed;
  if v_anon then
    raise exception 'anon can publish a version; nothing saved';
  end if;
  if not v_signed then
    raise exception 'a signed-in session cannot publish a version; nothing saved';
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

  insert into gi_app_version_save_hold(sort_key, section, detail) values
    (1, 'function', 'gi_app_version_save'),
    (2, 'installed', 'yes'),
    (3, 'door_closed', 'no'),
    (4, 'policies_changed', 'no'),
    (5, 'rows_changed', 'no'),
    (6, 'manager_only', 'yes'),
    (7, 'anon_execute', 'no'),
    (8, 'table_write', 'kept'),
    (9, 'global_row', 'untouched');
end
$body$;

select section, detail
from gi_app_version_save_hold
order by sort_key, detail;
