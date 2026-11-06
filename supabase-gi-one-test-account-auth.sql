-- =============================================================================
-- GEMEL INVEST · one vacant test account gets a sign-in address.
--
-- The account is the active "יוזר פנוי" that has no address and no sign-in
-- account. The other "יוזר פנוי" is not this id and is not changed.
-- The address is built inside the database. It is not printed.
-- No other account, customer, or barcode is changed.
--
-- After this runs, that one account still starts with its username and code.
-- The next login can show a barcode. If this script stops with an error,
-- nothing was saved.
--
-- If the editor warns about a temporary table, choose Run without RLS.
-- Run once, after the file is merged. Do not run it again.
-- =============================================================================

drop table if exists gi_one_account_result;
create temp table gi_one_account_result (
  kind text,
  detail text
);

do $$
declare
  v_agent_id text := 'a_6b3a63ce13bda_1a0a48aec42';
  v_name text;
  v_active boolean;
  v_email text;
  v_existing_email text;
  v_auth_user uuid;
  v_linked uuid;
  v_instance uuid;
  v_now text;
  v_meta jsonb;
  v_entry jsonb;
  v_other jsonb;
  v_before_other jsonb;
begin
  select a.name, coalesce(a.active, true), nullif(lower(btrim(coalesce(a.email, ''))), ''), a.auth_user_id
    into v_name, v_active, v_existing_email, v_linked
  from public.agents a
  where a.id = v_agent_id;

  if v_name is null or v_name <> 'יוזר פנוי' or v_active is not true then
    raise exception 'the vacant test account was not found; nothing was changed';
  end if;
  if v_existing_email is not null or v_linked is not null then
    raise exception 'this account already has a sign-in address; nothing was changed';
  end if;

  v_email := 'agent+'
    || regexp_replace(lower(v_agent_id), '[^a-z0-9]', '', 'g')
    || '@gemel-invest.internal';

  select u.id
    into v_auth_user
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  if v_auth_user is null then
    select u.instance_id
      into v_instance
    from auth.users u
    where u.instance_id is not null
    limit 1;
    if v_instance is null then
      v_instance := '00000000-0000-0000-0000-000000000000'::uuid;
    end if;
    v_auth_user := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      v_instance,
      v_auth_user,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf', 10)),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'agent_id', v_agent_id, 'role', 'agent'),
      '{}'::jsonb,
      now(),
      now(),
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_auth_user,
      jsonb_build_object('sub', v_auth_user::text, 'email', v_email),
      'email',
      v_auth_user::text,
      now(),
      now(),
      now()
    );
  end if;

  update public.agents
     set email = v_email,
         auth_user_id = v_auth_user,
         updated_at = now()
   where id = v_agent_id
     and name = 'יוזר פנוי'
     and coalesce(active, true) = true
     and nullif(lower(btrim(coalesce(email, ''))), '') is null
     and auth_user_id is null;
  if not found then
    raise exception 'the account row was not updated; nothing else was kept';
  end if;

  select m.payload
    into v_meta
  from public.app_meta m
  where m.key = 'global'
  for update;

  if v_meta is null or jsonb_typeof(v_meta) <> 'object' then
    raise exception 'settings row was not found; nothing was changed';
  end if;

  v_before_other := v_meta #> array['agentSecurity', 'a_504a67126e406_19d8ae66366'];
  v_now := to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_entry := coalesce(v_meta #> array['agentSecurity', v_agent_id], '{}'::jsonb);
  if jsonb_typeof(v_entry) <> 'object' then
    v_entry := '{}'::jsonb;
  end if;
  v_entry := (v_entry || jsonb_build_object(
    'authEmail', v_email,
    'authUserId', v_auth_user::text,
    'pinOnlyLogin', false,
    'pinOnlyLiftedAt', v_now,
    'mfaRequired', true,
    'mfaEnabled', false,
    'mfaResetPending', false,
    'mfaResetAt', '',
    'factorId', '',
    'updatedAt', v_now
  )) - 'totpUri' - 'totpQrHtml' - 'totpSecret';
  v_meta := jsonb_set(v_meta, array['agentSecurity', v_agent_id], v_entry, true);

  update public.app_meta
     set payload = v_meta,
         updated_at = now()
   where key = 'global';

  select payload #> array['agentSecurity', 'a_504a67126e406_19d8ae66366']
    into v_other
  from public.app_meta
  where key = 'global';
  if v_other is distinct from v_before_other then
    raise exception 'another account changed; stopping';
  end if;

  insert into gi_one_account_result(kind, detail)
  values
    ('account', 'ready'),
    ('authenticator', 'required'),
    ('other_accounts', 'unchanged'),
    ('address_printed', 'no');
end
$$;

select kind, detail
from gi_one_account_result
order by kind;
