-- =============================================================================
-- GEMEL INVEST · יוזר אלמנטרי still signs in with a username and a code.
-- This account already has a sign-in link and no address. Use that same link,
-- store one address on the account, and require a barcode.
--
-- Target: active elementary a_652af5403ef9f8_19e310e4c90.
-- No other account is changed. No second sign-in account is created.
-- The address is not printed. The login code is not changed.
-- If this script stops with an error, nothing was saved.
-- Run once. A second run changes nothing.
-- If the editor warns about a temporary table, choose Run without RLS.
-- =============================================================================

drop table if exists gi_link_account_result;
create temp table gi_link_account_result (
  kind text,
  detail text
);

do $$
declare
  v_agent_id text := 'a_652af5403ef9f8_19e310e4c90';
  v_name text;
  v_role text;
  v_active boolean;
  v_agent_email text;
  v_linked uuid;
  v_meta_link text;
  v_auth_email text;
  v_email text;
  v_verified int := 0;
  v_now text;
  v_meta jsonb;
  v_entry jsonb;
  v_before_others jsonb;
  v_after_others jsonb;
  v_before_refs jsonb;
  v_after_refs jsonb;
  v_before_agents jsonb;
  v_after_agents jsonb;
  v_after_linked uuid;
  v_after_email text;
begin
  select a.name,
         btrim(coalesce(a.role, '')),
         coalesce(a.active, true),
         nullif(lower(btrim(coalesce(a.email, ''))), ''),
         a.auth_user_id
    into v_name, v_role, v_active, v_agent_email, v_linked
  from public.agents a
  where a.id = v_agent_id;

  if v_name is null or v_name <> 'יוזר אלמנטרי' or v_role <> 'elementary' or v_active is not true then
    raise exception 'this account was not found; nothing was changed';
  end if;
  if v_agent_email is not null then
    raise exception 'this account already has an address; nothing was changed';
  end if;

  select m.payload
    into v_meta
  from public.app_meta m
  where m.key = 'global'
  for update;
  if v_meta is null or jsonb_typeof(v_meta) <> 'object' then
    raise exception 'settings row was not found; nothing was changed';
  end if;

  v_entry := v_meta #> array['agentSecurity', v_agent_id];
  if v_entry is null or jsonb_typeof(v_entry) <> 'object' then
    v_entry := '{}'::jsonb;
  end if;
  v_meta_link := nullif(btrim(coalesce(v_entry->>'authUserId', v_entry->>'auth_user_id', '')), '');
  if v_meta_link is not null
    and v_meta_link !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'the sign-in link is not usable; nothing was changed';
  end if;
  if v_linked is null and v_meta_link is not null then
    v_linked := v_meta_link::uuid;
  elsif v_linked is not null and v_meta_link is not null and v_linked::text <> lower(v_meta_link) then
    raise exception 'the sign-in links disagree; nothing was changed';
  end if;
  if v_linked is null then
    raise exception 'this account has no sign-in link; nothing was changed';
  end if;

  if exists (
    select 1
    from public.agents a
    where a.id <> v_agent_id
      and a.auth_user_id = v_linked
  ) or exists (
    select 1
    from jsonb_each(coalesce(v_meta->'agentSecurity', '{}'::jsonb)) e
    where e.key <> v_agent_id
      and lower(btrim(coalesce(e.value->>'authUserId', e.value->>'auth_user_id', ''))) = v_linked::text
  ) then
    raise exception 'another account uses this sign-in; nothing was changed';
  end if;

  if not exists (select 1 from auth.users u where u.id = v_linked) then
    raise exception 'the linked sign-in account was not found; nothing was changed';
  end if;

  v_before_others := coalesce(v_meta->'agentSecurity', '{}'::jsonb) - v_agent_id;
  v_before_refs := v_meta->'elementaryReferrals';
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id,
           'name', a.name,
           'role', a.role,
           'email', a.email,
           'auth', a.auth_user_id,
           'pin', a.pin,
           'active', a.active
         ) order by a.id), '[]'::jsonb)
    into v_before_agents
  from public.agents a
  where a.id <> v_agent_id;

  select nullif(lower(btrim(coalesce(u.email, ''))), '')
    into v_auth_email
  from auth.users u
  where u.id = v_linked;

  if v_auth_email is null or v_auth_email like '%@gemel-invest.internal' then
    v_email := 'agent+'
      || regexp_replace(lower(v_agent_id), '[^a-z0-9]', '', 'g')
      || '@gemel-invest.internal';
    update auth.users
       set email = v_email,
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
             || jsonb_build_object('agent_id', v_agent_id, 'role', 'elementary'),
           updated_at = now()
     where id = v_linked;
    update auth.identities
       set identity_data = jsonb_build_object('sub', v_linked::text, 'email', v_email),
           updated_at = now()
     where user_id = v_linked
       and provider = 'email';
  else
    v_email := v_auth_email;
  end if;

  update public.agents
     set email = v_email,
         auth_user_id = v_linked,
         updated_at = now()
   where id = v_agent_id
     and name = 'יוזר אלמנטרי'
     and btrim(coalesce(role, '')) = 'elementary'
     and coalesce(active, true)
     and (auth_user_id is null or auth_user_id = v_linked)
     and nullif(lower(btrim(coalesce(email, ''))), '') is null;
  if not found then
    raise exception 'the account row was not updated; nothing else was kept';
  end if;

  select a.auth_user_id, nullif(lower(btrim(coalesce(a.email, ''))), '')
    into v_after_linked, v_after_email
  from public.agents a
  where a.id = v_agent_id;
  if v_after_linked is distinct from v_linked or v_after_email is distinct from v_email then
    raise exception 'the sign-in link moved; nothing was kept';
  end if;

  select count(*)
    into v_verified
  from auth.mfa_factors f
  where f.user_id = v_linked
    and f.factor_type = 'totp'
    and f.status = 'verified';

  v_now := to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_entry := (v_entry || jsonb_build_object(
    'authEmail', v_email,
    'authUserId', v_linked::text,
    'pinOnlyLogin', false,
    'pinOnlyLiftedAt', v_now,
    'mfaRequired', true,
    'mfaEnabled', v_verified > 0,
    'mfaResetPending', false,
    'updatedAt', v_now
  )) - 'totpUri' - 'totpQrHtml' - 'totpSecret';
  if jsonb_typeof(v_meta->'agentSecurity') is distinct from 'object' then
    v_meta := jsonb_set(v_meta, '{agentSecurity}', '{}'::jsonb, true);
  end if;
  v_meta := jsonb_set(v_meta, array['agentSecurity', v_agent_id], v_entry, true);

  update public.app_meta
     set payload = v_meta,
         updated_at = now()
   where key = 'global';

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id,
           'name', a.name,
           'role', a.role,
           'email', a.email,
           'auth', a.auth_user_id,
           'pin', a.pin,
           'active', a.active
         ) order by a.id), '[]'::jsonb)
    into v_after_agents
  from public.agents a
  where a.id <> v_agent_id;
  select (payload->'agentSecurity') - v_agent_id,
         payload->'elementaryReferrals'
    into v_after_others, v_after_refs
  from public.app_meta
  where key = 'global';
  if v_after_agents is distinct from v_before_agents
    or v_after_others is distinct from v_before_others
    or v_after_refs is distinct from v_before_refs then
    raise exception 'another account changed; stopping';
  end if;

  insert into gi_link_account_result(kind, detail)
  values
    ('account', 'linked'),
    ('address_printed', 'no'),
    ('authenticator', case when v_verified > 0 then 'already_verified' else 'required' end),
    ('other_accounts', 'unchanged');
end
$$;

select kind, detail
from gi_link_account_result
order by kind;
