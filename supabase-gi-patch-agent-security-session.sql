-- =============================================================================
-- GEMEL INVEST · a signed-in manager is the only caller of the small
-- authenticator-status save.
--
-- The screen calls gi_patch_agent_security after a manager resets a barcode.
-- This file keeps that save and refuses everyone else. The public key cannot
-- call it. A signed-in agent cannot call it. A missing session cannot call
-- it. The accepted fields stay the same. Authenticator secrets stay refused.
-- No settings row is read into the result and none is changed by this file.
-- No policy is changed.
--
-- The file runs only when the settings table and gi_jwt_is_manager() already
-- exist. If a check fails, it stops and saves nothing.
--
-- Run this once in the SQL Editor. If the editor warns about a temporary
-- table, choose Run without RLS. Paste the result rows. If it stops with
-- an error, paste only the error text and do not run it again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   run supabase-gi-patch-agent-security.sql again.
-- =============================================================================

drop table if exists gi_patch_security_session_hold;
create temporary table gi_patch_security_session_hold (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_rows_before text;
  v_rows_after text;
  v_policies_before integer;
  v_policies_after integer;
  v_def text;
  v_anon boolean;
  v_signed boolean;
begin
  if to_regclass('public.app_meta') is null then
    raise exception 'settings table is missing; nothing saved';
  end if;
  if to_regprocedure('public.gi_jwt_is_manager()') is null then
    raise exception 'manager check is missing; nothing saved';
  end if;

  select count(*) into v_policies_before from pg_policies where schemaname = 'public';
  select coalesce(string_agg(
    md5(m.key || m.payload::text || coalesce(m.updated_at::text, '')),
    ',' order by m.key
  ), '') into v_rows_before
  from public.app_meta m;

  execute $fn$
    create or replace function public.gi_patch_agent_security(p_agent_id text, p_patch jsonb)
    returns jsonb
    language plpgsql
    security definer
    set search_path = public
    as $func$
    declare
      v_id text := btrim(coalesce(p_agent_id, ''));
      v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
      v_allowed text[] := array[
        'authEmail',
        'authUserId',
        'mfaRequired',
        'mfaEnabled',
        'mfaResetPending',
        'mfaResetAt',
        'factorId',
        'mfaEnrolledAt',
        'lastVerifiedAt',
        'pinOnlyLiftedAt'
      ];
      v_meta jsonb;
      v_entry jsonb;
      v_clean jsonb;
      v_now text;
    begin
      if auth.uid() is null then
        raise exception 'NO_SESSION';
      end if;
      if coalesce(public.gi_jwt_is_manager(), false) is not true then
        raise exception 'NOT_ALLOWED';
      end if;
      if v_id = '' or char_length(v_id) > 80 or v_id !~ '^[A-Za-z0-9_-]+$' then
        raise exception 'agent id is not usable';
      end if;
      if jsonb_typeof(v_patch) <> 'object' or v_patch = '{}'::jsonb then
        raise exception 'patch is empty';
      end if;
      if exists (
        select 1
        from jsonb_object_keys(v_patch) as incoming(key)
        where incoming.key <> all (v_allowed)
      ) then
        raise exception 'patch contains a field this save does not accept';
      end if;

      select coalesce(jsonb_object_agg(item.key, item.value), '{}'::jsonb)
        into v_clean
      from jsonb_each(v_patch) as item
      where item.key = any (v_allowed);

      if v_clean is null or v_clean = '{}'::jsonb then
        raise exception 'patch is empty';
      end if;

      select m.payload
        into v_meta
      from public.app_meta m
      where m.key = 'global'
      for update;

      if v_meta is null or jsonb_typeof(v_meta) <> 'object' then
        raise exception 'settings row was not found';
      end if;
      if coalesce(jsonb_typeof(v_meta->'agentSecurity'), '') <> 'object' then
        v_meta := jsonb_set(v_meta, '{agentSecurity}', '{}'::jsonb, true);
      end if;

      v_entry := coalesce(v_meta #> array['agentSecurity', v_id], '{}'::jsonb);
      if jsonb_typeof(v_entry) <> 'object' then
        v_entry := '{}'::jsonb;
      end if;

      v_now := to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
      v_entry := (v_entry || v_clean || jsonb_build_object('updatedAt', v_now))
        - 'totpUri' - 'totpQrHtml' - 'totpSecret';
      v_meta := jsonb_set(v_meta, array['agentSecurity', v_id], v_entry, true);

      update public.app_meta
         set payload = v_meta,
             updated_at = now()
       where key = 'global';

      return jsonb_build_object('ok', true);
    end;
    $func$
  $fn$;

  execute 'revoke all on function public.gi_patch_agent_security(text, jsonb) from public, anon';
  execute 'grant execute on function public.gi_patch_agent_security(text, jsonb) to authenticated';

  select pg_get_functiondef('public.gi_patch_agent_security(text, jsonb)'::regprocedure) into v_def;
  if position('auth.uid()' in v_def) = 0
     or position('gi_jwt_is_manager()' in v_def) = 0
     or position('NO_SESSION' in v_def) = 0
     or position('NOT_ALLOWED' in v_def) = 0
     or position('key = ''global''' in v_def) = 0
     or position('pinOnlyLogin' in v_def) > 0 then
    raise exception 'security save shape is unexpected; nothing saved';
  end if;

  select has_function_privilege('public', 'public.gi_patch_agent_security(text, jsonb)', 'execute')
      or has_function_privilege('anon', 'public.gi_patch_agent_security(text, jsonb)', 'execute')
    into v_anon;
  select has_function_privilege('authenticated', 'public.gi_patch_agent_security(text, jsonb)', 'execute')
    into v_signed;
  if v_anon then
    raise exception 'anon can save authenticator status; nothing saved';
  end if;
  if not v_signed then
    raise exception 'a signed-in manager cannot save authenticator status; nothing saved';
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

  insert into gi_patch_security_session_hold(sort_key, section, detail) values
    (1, 'function', 'gi_patch_agent_security'),
    (2, 'installed', 'yes'),
    (3, 'caller', 'signed_in_manager'),
    (4, 'anon_execute', 'no'),
    (5, 'policies_changed', 'no'),
    (6, 'rows_changed', 'no'),
    (7, 'answer', 'session_required');
end
$body$;

select section, detail
from gi_patch_security_session_hold
order by sort_key;
