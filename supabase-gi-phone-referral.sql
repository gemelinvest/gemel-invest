-- GEMEL INVEST · one vehicle referral beside the open meta row.
-- Adds gi_phone_referral_save. The phone tries it and still falls back to
-- the table. No policy changes. This file rewrites no row. The door stays
-- open. The agent comes from the session. The result omits the row.
-- Run once after this file is on main. Paste the result rows.
-- If it errors, paste the ERROR line and leave out the DETAIL row.
-- Undo: drop function if exists public.gi_phone_referral_save(jsonb);

drop table if exists gi_phone_referral_hold;
create temporary table gi_phone_referral_hold (
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

  select count(*) into v_policies_before from pg_policies where schemaname = 'public';
  select md5(coalesce(string_agg(key || payload::text || coalesce(updated_at::text, ''), '|' order by key), ''))
    into v_meta_before from public.app_meta;
  select md5(coalesce(string_agg(id::text || coalesce(name, '') || coalesce(username, '') || coalesce(role, ''), '|' order by id::text), ''))
    into v_agents_before from public.agents;

  execute $fn$
    create or replace function public.gi_phone_referral_save(p_referral jsonb)
    returns jsonb language plpgsql volatile security definer set search_path = public
    as $func$
    declare
      v_agent text := public.gi_jwt_agent_id();
      v_name text;
      v_ref_id text;
      v_digits text;
      v_payload jsonb;
      v_list jsonb;
      v_item jsonb;
      v_dup boolean;
    begin
      if v_agent = '' then
        return jsonb_build_object('ok', false, 'duplicate', false, 'error', 'auth');
      end if;
      if p_referral is null or jsonb_typeof(p_referral) <> 'object'
         or octet_length(p_referral::text) > 350000 then
        return jsonb_build_object('ok', false, 'duplicate', false, 'error', 'referral');
      end if;
      v_ref_id := btrim(coalesce(p_referral->>'id', ''));
      v_digits := left(regexp_replace(coalesce(p_referral->>'idNumber', ''), '\D', '', 'g'), 9);
      if v_ref_id !~ '^elemref_[A-Za-z0-9_]+$' or length(v_ref_id) > 80 or length(v_digits) <> 9 then
        return jsonb_build_object('ok', false, 'duplicate', false, 'error', 'referral');
      end if;
      select btrim(coalesce(a.name, '')) into v_name
      from public.agents a where a.id::text = v_agent limit 1;
      if coalesce(v_name, '') = '' then
        return jsonb_build_object('ok', false, 'duplicate', false, 'error', 'auth');
      end if;
      select m.payload into v_payload from public.app_meta m where m.key = 'global' for update;
      if v_payload is null or jsonb_typeof(v_payload) <> 'object' then
        return jsonb_build_object('ok', false, 'duplicate', false, 'error', 'meta');
      end if;
      if jsonb_typeof(v_payload->'elementaryReferrals') = 'array' then
        v_list := v_payload->'elementaryReferrals';
      else
        v_list := '[]'::jsonb;
      end if;
      if exists (
        select 1 from jsonb_array_elements(v_list) e where e.value->>'id' = v_ref_id
      ) then
        return jsonb_build_object('ok', true, 'duplicate', false);
      end if;
      select exists (
        select 1 from jsonb_array_elements(v_list) e
        where lower(coalesce(e.value->>'status', 'pending')) in ('', 'pending')
          and left(regexp_replace(coalesce(e.value->>'idNumber', ''), '\D', '', 'g'), 9) = v_digits
      ) into v_dup;
      if v_dup then
        return jsonb_build_object('ok', false, 'duplicate', true);
      end if;
      v_item := (p_referral - 'pin' - 'pin_hash' - 'totpUri' - 'totpSecret' - 'adminAuth')
        || jsonb_build_object('agentId', v_agent, 'agentName', v_name, 'status', 'pending', 'idNumber', v_digits);
      update public.app_meta
         set payload = jsonb_set(
               jsonb_set(v_payload, '{elementaryReferrals}', jsonb_build_array(v_item) || v_list, true),
               '{updatedAt}',
               to_jsonb(to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
               true
             ),
             updated_at = clock_timestamp()
       where key = 'global';
      return jsonb_build_object('ok', true, 'duplicate', false);
    end;
    $func$
  $fn$;

  execute 'revoke all on function public.gi_phone_referral_save(jsonb) from public, anon';
  execute 'grant execute on function public.gi_phone_referral_save(jsonb) to authenticated';

  if has_function_privilege('public', 'public.gi_phone_referral_save(jsonb)', 'execute')
     or (
       exists (select 1 from pg_roles where rolname = 'anon')
       and has_function_privilege('anon', 'public.gi_phone_referral_save(jsonb)', 'execute')
     ) then
    raise exception 'anon can call a phone function; nothing saved';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and not has_function_privilege('authenticated', 'public.gi_phone_referral_save(jsonb)', 'execute') then
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

  insert into gi_phone_referral_hold(sort_key, section, detail) values
    (1, 'function', 'gi_phone_referral_save'),
    (2, 'installed', 'yes'),
    (3, 'door_closed', 'no'),
    (4, 'policies_changed', 'no'),
    (5, 'rows_changed', 'no'),
    (6, 'anon_call', 'no'),
    (7, 'signed_in_call', 'yes'),
    (8, 'table_path', 'kept');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_phone_referral_hold
order by sort_key, detail;
