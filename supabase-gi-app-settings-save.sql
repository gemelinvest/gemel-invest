-- GEMEL INVEST · save the global settings row through a function.
-- The screen tries gi_app_settings_save first. If it does not answer,
-- the existing table write stays. This file does not change a policy,
-- does not write a row, and does not touch app_version.
-- A manager, or a signed-in agent id, may save the global row.
-- A code, a barcode, and a password scheme are removed before the write.
-- Run once after this file is on main. Paste the result rows.
-- If it errors, paste the ERROR line and leave out the DETAIL row.
-- Undo: drop function if exists public.gi_app_settings_save(jsonb, timestamptz);

drop table if exists gi_app_settings_save_hold;
create temporary table gi_app_settings_save_hold (
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
  if to_regprocedure('public.gi_jwt_is_manager()') is null
     or to_regprocedure('public.gi_jwt_agent_id()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select count(*) into v_policies_before from pg_policies where schemaname = 'public';
  select coalesce(string_agg(
    md5(m.key || m.payload::text || coalesce(m.updated_at::text, '')),
    ',' order by m.key
  ), '') into v_rows_before
  from public.app_meta m;

  execute $fn$
    create or replace function public.gi_app_settings_save(p_payload jsonb, p_updated_at timestamptz)
    returns jsonb
    language plpgsql
    security definer
    set search_path = public
    as $func$
    declare
      v_payload jsonb := '{}'::jsonb;
      v_at timestamptz := now();
      v_admin jsonb;
      v_sec jsonb := '{}'::jsonb;
      v_key text;
      v_entry jsonb;
      v_shadow jsonb := '[]'::jsonb;
      v_item jsonb;
    begin
      if auth.uid() is null then
        return jsonb_build_object('ok', false, 'error', 'NO_SESSION');
      end if;
      if coalesce(public.gi_jwt_is_manager(), false) is not true
         and coalesce(public.gi_jwt_agent_id(), '') = '' then
        return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED');
      end if;
      if jsonb_typeof(p_payload) <> 'object'
         or not (p_payload ? 'adminAuth')
         or not (p_payload ? 'updatedAt') then
        return jsonb_build_object('ok', false, 'error', 'SETTINGS_SHAPE');
      end if;

      v_payload := p_payload;
      v_at := coalesce(p_updated_at, now());
      v_admin := v_payload->'adminAuth';
      if jsonb_typeof(v_admin) = 'object' then
        v_payload := jsonb_set(v_payload, '{adminAuth}', v_admin - 'pin', true);
      end if;
      if jsonb_typeof(v_payload->'agentSecurity') = 'object' then
        for v_key, v_entry in select e.key, e.value from jsonb_each(v_payload->'agentSecurity') e
        loop
          if jsonb_typeof(v_entry) = 'object' then
            v_entry := v_entry
              - 'totpUri' - 'totp_uri' - 'totpQrHtml' - 'totp_qr_html'
              - 'totpSecret' - 'totp_secret' - 'authPasswordScheme' - 'auth_password_scheme';
          end if;
          v_sec := v_sec || jsonb_build_object(v_key, v_entry);
        end loop;
        v_payload := jsonb_set(v_payload, '{agentSecurity}', v_sec, true);
      end if;
      if jsonb_typeof(v_payload->'agentsShadow') = 'array' then
        for v_item in select value from jsonb_array_elements(v_payload->'agentsShadow')
        loop
          if jsonb_typeof(v_item) = 'object' then
            v_item := v_item - 'pin' - 'pin_hash';
          end if;
          v_shadow := v_shadow || jsonb_build_array(v_item);
        end loop;
        v_payload := jsonb_set(v_payload, '{agentsShadow}', v_shadow, true);
      end if;

      update public.app_meta
         set payload = v_payload,
             updated_at = v_at
       where key = 'global';
      if not found then
        insert into public.app_meta(key, payload, updated_at)
        values ('global', v_payload, v_at);
      end if;
      return jsonb_build_object('ok', true, 'key', 'global', 'updated_at', v_at);
    end;
    $func$
  $fn$;

  execute 'revoke all on function public.gi_app_settings_save(jsonb, timestamptz) from public, anon';
  execute 'grant execute on function public.gi_app_settings_save(jsonb, timestamptz) to authenticated';

  select pg_get_functiondef('public.gi_app_settings_save(jsonb, timestamptz)'::regprocedure) into v_def;
  if position('key = ''global''' in v_def) = 0
     or position('gi_jwt_is_manager()' in v_def) = 0
     or position('gi_jwt_agent_id()' in v_def) = 0
     or position('auth.uid()' in v_def) = 0
     or position('app_version' in v_def) > 0 then
    raise exception 'settings save shape is unexpected; nothing saved';
  end if;

  select has_function_privilege('public', 'public.gi_app_settings_save(jsonb, timestamptz)', 'execute')
      or has_function_privilege('anon', 'public.gi_app_settings_save(jsonb, timestamptz)', 'execute')
    into v_anon;
  select has_function_privilege('authenticated', 'public.gi_app_settings_save(jsonb, timestamptz)', 'execute')
    into v_signed;
  if v_anon then
    raise exception 'anon can save settings; nothing saved';
  end if;
  if not v_signed then
    raise exception 'a signed-in session cannot save settings; nothing saved';
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

  insert into gi_app_settings_save_hold(sort_key, section, detail) values
    (1, 'function', 'gi_app_settings_save'),
    (2, 'installed', 'yes'),
    (3, 'door_closed', 'no'),
    (4, 'policies_changed', 'no'),
    (5, 'rows_changed', 'no'),
    (6, 'closed_fields', 'stripped_on_write'),
    (7, 'anon_execute', 'no'),
    (8, 'table_write', 'kept'),
    (9, 'global_only', 'yes');
end
$body$;

select section, detail
from gi_app_settings_save_hold
order by sort_key, detail;
