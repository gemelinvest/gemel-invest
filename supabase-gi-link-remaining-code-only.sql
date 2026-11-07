-- =============================================================================
-- GEMEL INVEST · the five active accounts that still sign in with a username
-- and a code. Three already have a sign-in link. Two do not, so one link is
-- created for each of those two. Every account keeps its login code and must
-- scan a barcode on the next login.
--
-- Targets:
--   יובל מנדלסון     a_0
--   נציג תפעול      a_1d2d2c232ad718_1a0f8458ae8
--   תפעול פנוי      a_772caeccd209a_19d010c5062
--   מנהל צוות       a_3202ee4668f158_1a13b494633
--   מנהל ראשי       a_0295c0dafe4e08_1a13b480eec
--
-- No other account is changed. Addresses are not printed.
-- If this script stops with an error, nothing was saved.
-- Run once. A second run changes nothing.
-- If the editor warns about a temporary table, choose Run without RLS.
-- =============================================================================

drop table if exists gi_link_account_result;
create temp table gi_link_account_result (
  sort_key int,
  kind text,
  detail text
);

drop table if exists gi_code_only_target;
create temp table gi_code_only_target (
  agent_id text primary key,
  agent_name text not null,
  agent_role text not null,
  sort_key int not null
);

insert into gi_code_only_target(agent_id, agent_name, agent_role, sort_key) values
  ('a_0', 'יובל מנדלסון', 'agent', 1),
  ('a_1d2d2c232ad718_1a0f8458ae8', 'נציג תפעול', 'opsAgent', 2),
  ('a_772caeccd209a_19d010c5062', 'תפעול פנוי', 'ops', 3),
  ('a_3202ee4668f158_1a13b494633', 'מנהל צוות', 'teamManager', 4),
  ('a_0295c0dafe4e08_1a13b480eec', 'מנהל ראשי', 'manager', 5);

drop table if exists gi_code_only_plan;
create temp table gi_code_only_plan (
  agent_id text primary key,
  agent_name text not null,
  agent_role text not null,
  sort_key int not null,
  linked uuid,
  email text,
  action text not null,
  verified int not null
);

do $$
declare
  t record;
  p record;
  v_name text;
  v_role text;
  v_active boolean;
  v_agent_email text;
  v_linked uuid;
  v_meta_link text;
  v_entry jsonb;
  v_meta jsonb;
  v_auth_email text;
  v_email text;
  v_found uuid;
  v_found_count int;
  v_instance uuid;
  v_verified int;
  v_now text;
  v_before_others jsonb;
  v_after_others jsonb;
  v_before_refs jsonb;
  v_after_refs jsonb;
  v_before_agents jsonb;
  v_after_agents jsonb;
  v_before_pins jsonb;
  v_after_pins jsonb;
begin
  if (select count(*) from gi_code_only_target) <> 5 then
    raise exception 'the account list is incomplete; nothing was changed';
  end if;

  select m.payload
    into v_meta
  from public.app_meta m
  where m.key = 'global'
  for update;
  if v_meta is null or jsonb_typeof(v_meta) <> 'object' then
    raise exception 'settings row was not found; nothing was changed';
  end if;
  if jsonb_typeof(v_meta->'agentSecurity') is distinct from 'object' then
    v_meta := jsonb_set(v_meta, '{agentSecurity}', '{}'::jsonb, true);
  end if;

  v_before_refs := v_meta->'elementaryReferrals';
  v_before_others := coalesce(v_meta->'agentSecurity', '{}'::jsonb)
    - 'a_0'
    - 'a_1d2d2c232ad718_1a0f8458ae8'
    - 'a_772caeccd209a_19d010c5062'
    - 'a_3202ee4668f158_1a13b494633'
    - 'a_0295c0dafe4e08_1a13b480eec';
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'name', a.name, 'role', a.role,
           'email', a.email, 'auth', a.auth_user_id, 'pin', a.pin, 'active', a.active
         ) order by a.id), '[]'::jsonb)
    into v_before_agents
  from public.agents a
  where not exists (select 1 from gi_code_only_target t0 where t0.agent_id = a.id);
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'pin', a.pin) order by a.id), '[]'::jsonb)
    into v_before_pins
  from public.agents a
  join gi_code_only_target t0 on t0.agent_id = a.id;

  for t in select * from gi_code_only_target order by sort_key loop
    select a.name, btrim(coalesce(a.role, '')), coalesce(a.active, true),
           nullif(lower(btrim(coalesce(a.email, ''))), ''), a.auth_user_id
      into v_name, v_role, v_active, v_agent_email, v_linked
    from public.agents a
    where a.id = t.agent_id;

    if v_name is null or v_name <> t.agent_name or v_role <> t.agent_role or v_active is not true then
      raise exception 'an account was not found; nothing was changed';
    end if;
    if v_agent_email is not null then
      raise exception 'an account already has an address; nothing was changed';
    end if;

    v_entry := v_meta #> array['agentSecurity', t.agent_id];
    if v_entry is null or jsonb_typeof(v_entry) <> 'object' then
      v_entry := '{}'::jsonb;
    end if;
    v_meta_link := nullif(btrim(coalesce(v_entry->>'authUserId', v_entry->>'auth_user_id', '')), '');
    if v_meta_link is not null
      and v_meta_link !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'a sign-in link is not usable; nothing was changed';
    end if;
    if v_linked is null and v_meta_link is not null then
      v_linked := v_meta_link::uuid;
    elsif v_linked is not null and v_meta_link is not null and v_linked::text <> lower(v_meta_link) then
      raise exception 'the sign-in links disagree; nothing was changed';
    end if;

    v_email := 'agent+'
      || regexp_replace(lower(t.agent_id), '[^a-z0-9]', '', 'g')
      || '@gemel-invest.internal';

    if v_linked is null then
      select count(*)
        into v_found_count
      from auth.users u
      where lower(btrim(coalesce(u.email, ''))) = v_email
         or coalesce(u.raw_app_meta_data->>'agent_id', '') = t.agent_id;
      if v_found_count > 1 then
        raise exception 'more than one sign-in matches an account; nothing was changed';
      end if;
      select u.id
        into v_found
      from auth.users u
      where lower(btrim(coalesce(u.email, ''))) = v_email
         or coalesce(u.raw_app_meta_data->>'agent_id', '') = t.agent_id
      limit 1;
      if v_found is not null then
        v_linked := v_found;
      end if;
    end if;

    if v_linked is not null and (
      exists (
        select 1 from public.agents a
        where a.id <> t.agent_id and a.auth_user_id = v_linked
      ) or exists (
        select 1 from gi_code_only_plan planned
        where planned.linked = v_linked
      ) or exists (
        select 1
        from jsonb_each(coalesce(v_meta->'agentSecurity', '{}'::jsonb)) e
        where e.key <> t.agent_id
          and lower(btrim(coalesce(e.value->>'authUserId', e.value->>'auth_user_id', ''))) = v_linked::text
      )
    ) then
      raise exception 'another account uses this sign-in; nothing was changed';
    end if;

    if v_linked is null then
      insert into gi_code_only_plan(agent_id, agent_name, agent_role, sort_key, linked, email, action, verified)
      values (t.agent_id, t.agent_name, t.agent_role, t.sort_key, null, v_email, 'created', 0);
    else
      if not exists (select 1 from auth.users u where u.id = v_linked) then
        raise exception 'the linked sign-in account was not found; nothing was changed';
      end if;
      select nullif(lower(btrim(coalesce(u.email, ''))), '')
        into v_auth_email
      from auth.users u
      where u.id = v_linked;
      if v_auth_email is not null and v_auth_email not like '%@gemel-invest.internal' then
        v_email := v_auth_email;
      end if;
      select count(*)
        into v_verified
      from auth.mfa_factors f
      where f.user_id = v_linked
        and f.factor_type = 'totp'
        and f.status = 'verified';
      insert into gi_code_only_plan(agent_id, agent_name, agent_role, sort_key, linked, email, action, verified)
      values (t.agent_id, t.agent_name, t.agent_role, t.sort_key, v_linked, v_email, 'reused', v_verified);
    end if;
  end loop;

  select u.instance_id
    into v_instance
  from auth.users u
  where u.instance_id is not null
  limit 1;
  if v_instance is null then
    v_instance := '00000000-0000-0000-0000-000000000000'::uuid;
  end if;

  for p in select * from gi_code_only_plan where action = 'created' order by sort_key loop
    v_linked := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      v_instance,
      v_linked,
      'authenticated',
      'authenticated',
      p.email,
      extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf', 10)),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'agent_id', p.agent_id, 'role', p.agent_role),
      '{}'::jsonb,
      now(),
      now(),
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_linked,
      jsonb_build_object('sub', v_linked::text, 'email', p.email),
      'email',
      v_linked::text,
      now(),
      now(),
      now()
    );
    update gi_code_only_plan
       set linked = v_linked
     where agent_id = p.agent_id;
  end loop;

  for p in select * from gi_code_only_plan where action = 'reused' order by sort_key loop
    select nullif(lower(btrim(coalesce(u.email, ''))), '')
      into v_auth_email
    from auth.users u
    where u.id = p.linked;
    if v_auth_email is null or v_auth_email like '%@gemel-invest.internal' then
      update auth.users
         set email = p.email,
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             confirmation_token = coalesce(confirmation_token, ''),
             recovery_token = coalesce(recovery_token, ''),
             email_change_token_new = coalesce(email_change_token_new, ''),
             email_change = coalesce(email_change, ''),
             email_change_token_current = coalesce(email_change_token_current, ''),
             phone_change = coalesce(phone_change, ''),
             phone_change_token = coalesce(phone_change_token, ''),
             reauthentication_token = coalesce(reauthentication_token, ''),
             raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
               || jsonb_build_object('agent_id', p.agent_id, 'role', p.agent_role),
             updated_at = now()
       where id = p.linked;
      update auth.identities
         set identity_data = jsonb_build_object('sub', p.linked::text, 'email', p.email),
             updated_at = now()
       where user_id = p.linked
         and provider = 'email';
    end if;
  end loop;

  for p in select * from gi_code_only_plan order by sort_key loop
    update public.agents
       set email = p.email,
           auth_user_id = p.linked,
           updated_at = now()
     where id = p.agent_id
       and name = p.agent_name
       and btrim(coalesce(role, '')) = p.agent_role
       and coalesce(active, true)
       and (auth_user_id is null or auth_user_id = p.linked)
       and nullif(lower(btrim(coalesce(email, ''))), '') is null;
    if not found then
      raise exception 'an account row was not updated; nothing else was kept';
    end if;
  end loop;

  v_now := to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  for p in select * from gi_code_only_plan order by sort_key loop
    if p.linked is null then
      raise exception 'a sign-in link was not stored; nothing was kept';
    end if;
    select a.auth_user_id, nullif(lower(btrim(coalesce(a.email, ''))), '')
      into v_linked, v_agent_email
    from public.agents a
    where a.id = p.agent_id;
    if v_linked is distinct from p.linked or v_agent_email is distinct from p.email then
      raise exception 'a sign-in link moved; nothing was kept';
    end if;

    v_entry := v_meta #> array['agentSecurity', p.agent_id];
    if v_entry is null or jsonb_typeof(v_entry) <> 'object' then
      v_entry := '{}'::jsonb;
    end if;
    v_entry := (v_entry || jsonb_build_object(
      'authEmail', p.email,
      'authUserId', p.linked::text,
      'pinOnlyLogin', false,
      'pinOnlyLiftedAt', v_now,
      'mfaRequired', true,
      'mfaEnabled', p.verified > 0,
      'mfaResetPending', false,
      'updatedAt', v_now
    )) - 'totpUri' - 'totpQrHtml' - 'totpSecret';
    v_meta := jsonb_set(v_meta, array['agentSecurity', p.agent_id], v_entry, true);

    insert into gi_link_account_result(sort_key, kind, detail)
    values (
      p.sort_key,
      p.agent_name,
      case when p.verified > 0 then 'already_verified' else 'required' end || '_' || p.action
    );
  end loop;

  update public.app_meta
     set payload = v_meta,
         updated_at = now()
   where key = 'global';

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'name', a.name, 'role', a.role,
           'email', a.email, 'auth', a.auth_user_id, 'pin', a.pin, 'active', a.active
         ) order by a.id), '[]'::jsonb)
    into v_after_agents
  from public.agents a
  where not exists (select 1 from gi_code_only_target t0 where t0.agent_id = a.id);
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'pin', a.pin) order by a.id), '[]'::jsonb)
    into v_after_pins
  from public.agents a
  join gi_code_only_target t0 on t0.agent_id = a.id;
  select (payload->'agentSecurity')
           - 'a_0'
           - 'a_1d2d2c232ad718_1a0f8458ae8'
           - 'a_772caeccd209a_19d010c5062'
           - 'a_3202ee4668f158_1a13b494633'
           - 'a_0295c0dafe4e08_1a13b480eec',
         payload->'elementaryReferrals'
    into v_after_others, v_after_refs
  from public.app_meta
  where key = 'global';
  if v_after_agents is distinct from v_before_agents
    or v_after_pins is distinct from v_before_pins
    or v_after_others is distinct from v_before_others
    or v_after_refs is distinct from v_before_refs then
    raise exception 'another account changed; stopping';
  end if;

  insert into gi_link_account_result(sort_key, kind, detail) values
    (90, 'address_printed', 'no'),
    (91, 'other_accounts', 'unchanged');
end
$$;

select kind, detail
from gi_link_account_result
order by sort_key, kind;
