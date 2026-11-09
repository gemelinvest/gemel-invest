-- GEMEL INVEST · a settings read beside the open meta row.
-- Adds gi_app_settings. The screen tries it and still falls back to the
-- table. No policy changes. No row is rewritten. The door stays open.
-- The result is the global row without a code, a barcode, or a password
-- scheme. Other settings stay, including the copies the screen still reads.
-- Run once after this file is on main. Paste the result rows.
-- If it errors, paste the ERROR line and leave out the DETAIL row.
-- Undo: drop function if exists public.gi_app_settings();

drop table if exists gi_app_settings_hold;
create temporary table gi_app_settings_hold (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_policies_before integer := 0;
  v_policies_after integer := 0;
  v_meta_before integer := 0;
  v_meta_after integer := 0;
  v_result jsonb;
  v_anon_read boolean := false;
  v_keys integer := 0;
  v_text text;
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
  select count(*) into v_meta_before from public.app_meta;

  execute $fn$
    create or replace function public.gi_app_settings()
    returns jsonb
    language plpgsql
    stable
    security definer
    set search_path = public
    as $func$
    declare
      v_payload jsonb := '{}'::jsonb;
      v_updated timestamptz;
      v_admin jsonb;
      v_sec jsonb := '{}'::jsonb;
      v_key text;
      v_entry jsonb;
      v_shadow jsonb := '[]'::jsonb;
      v_item jsonb;
    begin
      select coalesce(m.payload, '{}'::jsonb), m.updated_at
        into v_payload, v_updated
      from public.app_meta m
      where m.key = 'global'
      limit 1;
      if v_payload is null or jsonb_typeof(v_payload) <> 'object' then
        v_payload := '{}'::jsonb;
      end if;

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

      return jsonb_build_object(
        'ok', true,
        'key', 'global',
        'payload', v_payload,
        'updated_at', v_updated
      );
    end;
    $func$
  $fn$;

  execute 'revoke all on function public.gi_app_settings() from public, anon';
  execute 'grant execute on function public.gi_app_settings() to authenticated';

  select public.gi_app_settings() into v_result;
  if coalesce(v_result->>'ok', '') <> 'true' or v_result->>'key' <> 'global' then
    raise exception 'settings did not answer; nothing saved';
  end if;
  select count(*) into v_keys from jsonb_object_keys(v_result) as k(key_name);
  if v_keys <> 4 then
    raise exception 'settings shape is unexpected; nothing saved';
  end if;

  v_text := coalesce(v_result#>>'{payload,adminAuth}', '')
    || coalesce(v_result#>>'{payload,agentSecurity}', '')
    || coalesce(v_result#>>'{payload,agentsShadow}', '');
  if v_text ~* '"(pin|pin_hash|totpuri|totp_uri|totpqrhtml|totp_qr_html|totpsecret|totp_secret|authpasswordscheme|auth_password_scheme)"\s*:' then
    raise exception 'settings returned a closed field; nothing saved';
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      begin
        perform public.gi_app_settings();
        v_anon_read := true;
      exception
        when insufficient_privilege then
          v_anon_read := false;
      end;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_anon_read := false;
    end;
    if v_anon_read then
      raise exception 'anon can read settings; nothing saved';
    end if;
  end if;

  select count(*) into v_policies_after from pg_policies where schemaname = 'public';
  select count(*) into v_meta_after from public.app_meta;
  if v_policies_after <> v_policies_before or v_meta_after <> v_meta_before then
    raise exception 'tables changed; nothing saved';
  end if;

  insert into gi_app_settings_hold(sort_key, section, detail) values
    (1, 'function', 'gi_app_settings'),
    (2, 'installed', 'yes'),
    (3, 'door_closed', 'no'),
    (4, 'policies_changed', 'no'),
    (5, 'rows_changed', 'no'),
    (6, 'closed_fields', 'omitted'),
    (7, 'anon_read', 'no'),
    (8, 'table_read', 'kept');
end
$body$;

select section, detail
from gi_app_settings_hold
order by sort_key, detail;
