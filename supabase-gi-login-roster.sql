-- =============================================================================
-- GEMEL INVEST · a narrow login roster beside the open meta read.
--
-- This file adds one function, gi_login_roster. The login screen does not
-- call it. The full meta read stays. No policy is created or dropped. No
-- door is closed. No row is rewritten. The function returns the fields the
-- login screen needs in order to recognise a user: public agent columns,
-- the agent copy, team assignment, the admin record without its code,
-- shift hours, and the security flags. It does not return a code, a
-- barcode, a password scheme, or copies of customers or proposals.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   drop function if exists public.gi_login_roster();
-- =============================================================================

drop table if exists gi_login_roster_hold;
create temporary table gi_login_roster_hold (
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
  v_agents_before integer := 0;
  v_agents_after integer := 0;
  v_result jsonb;
  v_anon jsonb;
  v_keys_count integer := 0;
  v_keys_total integer := 0;
  v_admin_count integer := 0;
  v_admin_total integer := 0;
  v_text text;
begin
  if to_regclass('public.app_meta') is null or to_regclass('public.agents') is null then
    raise exception 'login tables are missing; nothing saved';
  end if;

  select count(*) into v_policies_before from pg_policies where schemaname = 'public';
  select count(*) into v_meta_before from public.app_meta;
  select count(*) into v_agents_before from public.agents;

  execute $fn$
    create or replace function public.gi_login_roster()
    returns jsonb
    language plpgsql
    stable
    security definer
    set search_path = public
    as $func$
    declare
      v_payload jsonb := '{}'::jsonb;
      v_agents jsonb := '[]'::jsonb;
      v_shadow jsonb := '[]'::jsonb;
      v_security jsonb := '{}'::jsonb;
      v_item jsonb;
      v_key text;
      v_entry jsonb;
      v_sql text;
    begin
      select coalesce(m.payload, '{}'::jsonb)
        into v_payload
      from public.app_meta m
      where m.key = 'global'
      limit 1;
      if v_payload is null then
        v_payload := '{}'::jsonb;
      end if;

      v_sql := 'select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(''id'', a.id';
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'agents' and column_name = 'name'
      ) then v_sql := v_sql || ', ''name'', a.name'; end if;
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'agents' and column_name = 'username'
      ) then v_sql := v_sql || ', ''username'', a.username'; end if;
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'agents' and column_name = 'role'
      ) then v_sql := v_sql || ', ''role'', a.role'; end if;
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'agents' and column_name = 'active'
      ) then v_sql := v_sql || ', ''active'', a.active'; end if;
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'agents' and column_name = 'created_at'
      ) then v_sql := v_sql || ', ''createdAt'', a.created_at'; end if;
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'agents' and column_name = 'updated_at'
      ) then v_sql := v_sql || ', ''updatedAt'', a.updated_at'; end if;
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'agents' and column_name = 'birth_date'
      ) then v_sql := v_sql || ', ''birthDate'', a.birth_date'; end if;
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'agents' and column_name = 'monthly_sales_target'
      ) then v_sql := v_sql || ', ''monthlySalesTarget'', a.monthly_sales_target'; end if;
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'agents' and column_name = 'email'
      ) then v_sql := v_sql || ', ''email'', a.email'; end if;
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'agents' and column_name = 'team_manager_id'
      ) then v_sql := v_sql || ', ''teamManagerId'', a.team_manager_id'; end if;
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'agents' and column_name = 'auth_user_id'
      ) then v_sql := v_sql || ', ''authUserId'', a.auth_user_id'; end if;
      v_sql := v_sql || '))), ''[]''::jsonb) from public.agents a';
      execute v_sql into v_agents;

      if jsonb_typeof(v_payload->'agentsShadow') = 'array' then
        for v_item in select value from jsonb_array_elements(v_payload->'agentsShadow')
        loop
          v_shadow := v_shadow || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
            'id', v_item->'id',
            'name', v_item->'name',
            'username', v_item->'username',
            'birthDate', coalesce(v_item->'birthDate', v_item->'birth_date'),
            'email', v_item->'email',
            'monthlySalesTarget', coalesce(v_item->'monthlySalesTarget', v_item->'monthly_sales_target'),
            'role', v_item->'role',
            'teamManagerId', coalesce(v_item->'teamManagerId', v_item->'team_manager_id'),
            'active', v_item->'active',
            'createdAt', coalesce(v_item->'createdAt', v_item->'created_at'),
            'updatedAt', coalesce(v_item->'updatedAt', v_item->'updated_at')
          )));
        end loop;
      end if;

      if jsonb_typeof(v_payload->'agentSecurity') = 'object' then
        for v_key, v_entry in
          select e.key, e.value from jsonb_each(v_payload->'agentSecurity') e
        loop
          v_security := v_security || jsonb_build_object(
            v_key,
            jsonb_strip_nulls(jsonb_build_object(
              'mfaRequired', coalesce(v_entry->'mfaRequired', v_entry->'mfa_required'),
              'mfaEnabled', coalesce(v_entry->'mfaEnabled', v_entry->'mfa_enabled'),
              'mfaResetPending', coalesce(v_entry->'mfaResetPending', v_entry->'mfa_reset_pending'),
              'pinOnlyLogin', coalesce(v_entry->'pinOnlyLogin', v_entry->'pin_only_login'),
              'factorId', coalesce(v_entry->'factorId', v_entry->'factor_id'),
              'updatedAt', coalesce(v_entry->'updatedAt', v_entry->'updated_at'),
              'authUserId', coalesce(v_entry->'authUserId', v_entry->'auth_user_id')
            ))
          );
        end loop;
      end if;

      return jsonb_build_object(
        'ok', true,
        'agents', coalesce(v_agents, '[]'::jsonb),
        'agentsShadow', v_shadow,
        'teamManagerAssignments',
          case
            when jsonb_typeof(v_payload->'teamManagerAssignments') = 'object'
              then v_payload->'teamManagerAssignments'
            else '{}'::jsonb
          end,
        'adminAuth', jsonb_build_object(
          'username', coalesce(v_payload->'adminAuth'->>'username', ''),
          'active', case when coalesce(v_payload->'adminAuth'->>'active', 'true') = 'false' then false else true end
        ),
        'agentShiftHours',
          case
            when jsonb_typeof(v_payload->'agentShiftHours') = 'object'
              then v_payload->'agentShiftHours'
            else '{}'::jsonb
          end,
        'agentSecurity', v_security
      );
    end;
    $func$
  $fn$;

  execute 'revoke all on function public.gi_login_roster() from public';
  execute 'grant execute on function public.gi_login_roster() to anon, authenticated';

  select public.gi_login_roster() into v_result;
  if coalesce(v_result->>'ok', '') <> 'true' then
    raise exception 'roster did not answer; nothing saved';
  end if;

  select count(*)
    into v_keys_count
  from jsonb_object_keys(v_result) as roster_keys(key_name)
  where key_name in (
    'ok', 'agents', 'agentsShadow', 'teamManagerAssignments',
    'adminAuth', 'agentShiftHours', 'agentSecurity'
  );
  select count(*)
    into v_keys_total
  from jsonb_object_keys(v_result) as roster_keys(key_name);
  if v_keys_count <> 7 or v_keys_total <> 7 then
    raise exception 'roster shape is unexpected; nothing saved';
  end if;

  select count(*)
    into v_admin_count
  from jsonb_object_keys(v_result->'adminAuth') as admin_keys(key_name)
  where key_name in ('active', 'username');
  select count(*)
    into v_admin_total
  from jsonb_object_keys(v_result->'adminAuth') as admin_keys(key_name);
  if v_admin_count <> 2 or v_admin_total <> 2 then
    raise exception 'admin record is not narrow; nothing saved';
  end if;

  v_text := v_result::text;
  if v_text ~* '"(pin|pin_hash|totpuri|totp_uri|totpqrhtml|totp_qr_html|authpasswordscheme|auth_password_scheme|customersshadow|proposalsshadow|archivedcustomers|elementaryreferrals|payload)"\s*:' then
    raise exception 'roster returned a closed field; nothing saved';
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    begin
      execute 'set local role anon';
      select public.gi_login_roster() into v_anon;
      execute 'reset role';
    exception
      when insufficient_privilege or invalid_authorization_specification then
        execute 'reset role';
        v_anon := null;
    end;
    if v_anon is null or v_anon <> v_result then
      raise exception 'public roster call is not the same narrow result; nothing saved';
    end if;
  end if;

  select count(*) into v_policies_after from pg_policies where schemaname = 'public';
  select count(*) into v_meta_after from public.app_meta;
  select count(*) into v_agents_after from public.agents;
  if v_policies_after <> v_policies_before
     or v_meta_after <> v_meta_before
     or v_agents_after <> v_agents_before then
    raise exception 'tables changed; nothing saved';
  end if;

  insert into gi_login_roster_hold(sort_key, section, detail) values
    (1, 'function', 'gi_login_roster'),
    (2, 'installed', 'yes'),
    (3, 'screen_changed', 'no'),
    (4, 'door_closed', 'no'),
    (5, 'policies_changed', 'no'),
    (6, 'rows_changed', 'no'),
    (7, 'closed_fields', 'omitted'),
    (8, 'customer_copies', 'omitted'),
    (9, 'admin_code', 'omitted');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_login_roster_hold
order by sort_key;
