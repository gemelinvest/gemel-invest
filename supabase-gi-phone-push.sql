-- GEMEL INVEST · phone notifications beside the open meta row.
-- Adds the key read and the subscription save. The phone tries them and
-- still falls back to the table. No policy changes. This file rewrites no
-- row. The door stays open. The agent comes from the session.
-- Run once after this file is on main. Paste the result rows.
-- If it errors, paste the ERROR line and leave out the DETAIL row.
-- Undo:
--   drop function if exists public.gi_phone_push_key();
--   drop function if exists public.gi_phone_push_save(text, text, text);

drop table if exists gi_phone_push_hold;
create temporary table gi_phone_push_hold (
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
  v_agents_before text;
  v_agents_after text;
  v_probe jsonb;
begin
  if to_regclass('public.app_meta') is null or to_regclass('public.agents') is null then
    raise exception 'phone tables are missing; nothing saved';
  end if;
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'app_meta'
      and column_name in ('key', 'payload', 'updated_at')
  ) <> 3 or (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'agents'
      and column_name in ('id', 'name', 'username', 'role')
  ) <> 4 then
    raise exception 'phone columns are missing; nothing saved';
  end if;
  if to_regprocedure('public.gi_jwt_agent_id()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;
  if to_regprocedure('extensions.digest(text, text)') is null then
    raise exception 'digest is missing; nothing saved';
  end if;

  select count(*) into v_policies_before from pg_policies where schemaname = 'public';
  select md5(coalesce(string_agg(key || payload::text || coalesce(updated_at::text, ''), '|' order by key), ''))
    into v_meta_before from public.app_meta;
  select md5(coalesce(string_agg(id::text || coalesce(name, '') || coalesce(username, '') || coalesce(role, ''), '|' order by id::text), ''))
    into v_agents_before from public.agents;

  execute $fn$
    create or replace function public.gi_phone_push_key()
    returns jsonb language plpgsql stable security definer set search_path = public
    as $func$
    declare
      v_key text;
    begin
      if public.gi_jwt_agent_id() = '' then
        return jsonb_build_object('ok', false, 'error', 'auth');
      end if;
      select nullif(btrim(coalesce(m.payload->>'publicKey', '')), '') into v_key
      from public.app_meta m where m.key = 'onyx_push_vapid_public' limit 1;
      if v_key is null or length(v_key) > 200 or v_key ~ '[^A-Za-z0-9_=-]' then
        return jsonb_build_object('ok', false, 'error', 'missing');
      end if;
      return jsonb_build_object('ok', true, 'publicKey', v_key);
    end;
    $func$
  $fn$;

  execute $fn$
    create or replace function public.gi_phone_push_save(p_endpoint text, p_p256dh text, p_auth text)
    returns jsonb language plpgsql volatile security definer set search_path = public
    as $func$
    declare
      v_agent text := public.gi_jwt_agent_id();
      v_name text;
      v_user text;
      v_role text;
      v_endpoint text := btrim(coalesce(p_endpoint, ''));
      v_p256 text := btrim(coalesce(p_p256dh, ''));
      v_auth text := btrim(coalesce(p_auth, ''));
      v_key text;
    begin
      if v_agent = '' then
        return jsonb_build_object('ok', false, 'error', 'auth');
      end if;
      if v_endpoint !~ '^https://' or length(v_endpoint) > 2000
         or v_p256 = '' or length(v_p256) > 200 or v_p256 ~ '[^A-Za-z0-9_=-]'
         or v_auth = '' or length(v_auth) > 200 or v_auth ~ '[^A-Za-z0-9_=-]' then
        return jsonb_build_object('ok', false, 'error', 'subscription');
      end if;
      select btrim(coalesce(a.name, '')), btrim(coalesce(a.username, '')), btrim(coalesce(a.role, ''))
        into v_name, v_user, v_role
      from public.agents a where a.id::text = v_agent limit 1;
      if coalesce(v_name, '') = '' then
        return jsonb_build_object('ok', false, 'error', 'auth');
      end if;
      v_key := 'onyxsub_' || left(encode(extensions.digest(v_endpoint, 'sha256'), 'hex'), 32);
      insert into public.app_meta (key, payload, updated_at) values (
        v_key,
        jsonb_build_object(
          'endpoint', v_endpoint, 'p256dh', v_p256, 'auth', v_auth,
          'agent_id', v_agent, 'agent_name', v_name, 'username', v_user, 'role', v_role,
          'updated_at', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ),
        clock_timestamp()
      )
      on conflict (key) do update
        set payload = excluded.payload, updated_at = excluded.updated_at;
      return jsonb_build_object('ok', true);
    end;
    $func$
  $fn$;

  execute 'revoke all on function public.gi_phone_push_key() from public, anon';
  execute 'revoke all on function public.gi_phone_push_save(text, text, text) from public, anon';
  execute 'grant execute on function public.gi_phone_push_key() to authenticated';
  execute 'grant execute on function public.gi_phone_push_save(text, text, text) to authenticated';

  select public.gi_phone_push_key() into v_probe;
  if v_probe is null or not (v_probe ? 'ok') or (select count(*) from jsonb_object_keys(v_probe)) > 2
     or v_probe ? 'payload' or v_probe ? 'pin' or v_probe ? 'privateKey' then
    raise exception 'push key returned a closed field; nothing saved';
  end if;
  if has_function_privilege('public', 'public.gi_phone_push_key()', 'execute')
     or has_function_privilege('public', 'public.gi_phone_push_save(text, text, text)', 'execute')
     or (
       exists (select 1 from pg_roles where rolname = 'anon')
       and (
         has_function_privilege('anon', 'public.gi_phone_push_key()', 'execute')
         or has_function_privilege('anon', 'public.gi_phone_push_save(text, text, text)', 'execute')
       )
     ) then
    raise exception 'anon can call a phone function; nothing saved';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and (
       not has_function_privilege('authenticated', 'public.gi_phone_push_key()', 'execute')
       or not has_function_privilege('authenticated', 'public.gi_phone_push_save(text, text, text)', 'execute')
     ) then
    raise exception 'a signed-in session cannot call a phone function; nothing saved';
  end if;

  select count(*) into v_policies_after from pg_policies where schemaname = 'public';
  select md5(coalesce(string_agg(key || payload::text || coalesce(updated_at::text, ''), '|' order by key), ''))
    into v_meta_after from public.app_meta;
  select md5(coalesce(string_agg(id::text || coalesce(name, '') || coalesce(username, '') || coalesce(role, ''), '|' order by id::text), ''))
    into v_agents_after from public.agents;
  if v_policies_after <> v_policies_before or v_meta_after is distinct from v_meta_before
     or v_agents_after is distinct from v_agents_before then
    raise exception 'tables changed; nothing saved';
  end if;

  insert into gi_phone_push_hold(sort_key, section, detail) values
    (1, 'function', 'gi_phone_push_key'),
    (2, 'function', 'gi_phone_push_save'),
    (3, 'installed', 'yes'),
    (4, 'door_closed', 'no'),
    (5, 'policies_changed', 'no'),
    (6, 'rows_changed', 'no'),
    (7, 'anon_call', 'no'),
    (8, 'signed_in_call', 'yes'),
    (9, 'table_path', 'kept'),
    (10, 'digest', 'yes');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_phone_push_hold
order by sort_key, detail;
