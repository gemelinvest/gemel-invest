-- =============================================================================
-- GEMEL INVEST · חן מזרחי must confirm the next login in the authenticator.
--
-- Run once, only after his sign-in account already has the same address as
-- his agent row (the previous script returned auth_email already_present).
-- The address is not printed.
--
-- His next login still starts with the username and the same code. After
-- the code, the screen asks for the authenticator. No other account changes.
--
-- If the editor warns about a temporary table, choose Run without RLS.
-- If his next login stops before the authenticator is finished, stop and
-- say so. Do not run this file again.
-- =============================================================================

drop table if exists gi_mfa_result;
create temp table gi_mfa_result (
  kind text,
  detail text
);

do $$
declare
  v_agent_id text := 'a_42b897c014fd4_1a0a94d314a';
  v_user uuid := '5a22aa9e-0520-465a-83a3-8b0bd7291c37';
  v_email text;
  v_auth_email text;
  v_meta jsonb;
  v_entry jsonb;
  v_now text;
begin
  select lower(btrim(coalesce(a.email, '')))
    into v_email
  from public.agents a
  where a.id = v_agent_id
    and a.name = 'חן מזרחי'
    and coalesce(a.active, true) = true;

  if v_email is null then
    raise exception 'agent row was not found; nothing was changed';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'agent row has no usable address; nothing was changed';
  end if;

  select lower(btrim(coalesce(u.email, '')))
    into v_auth_email
  from auth.users u
  where u.id = v_user;

  if v_auth_email is null or v_auth_email = '' or v_auth_email <> v_email then
    raise exception 'sign-in address is not ready; nothing was changed';
  end if;

  select m.payload
    into v_meta
  from public.app_meta m
  where m.key = 'global';

  if v_meta is null or jsonb_typeof(v_meta) <> 'object' then
    raise exception 'settings row was not found; nothing was changed';
  end if;

  v_now := to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_entry := coalesce(v_meta #> array['agentSecurity', v_agent_id], '{}'::jsonb);
  if jsonb_typeof(v_entry) <> 'object' then
    v_entry := '{}'::jsonb;
  end if;

  v_entry := v_entry || jsonb_build_object(
    'authEmail', v_email,
    'authUserId', v_user::text,
    'pinOnlyLogin', false,
    'pinOnlyLiftedAt', v_now,
    'mfaRequired', true,
    'mfaEnabled', false,
    'mfaResetPending', false,
    'mfaResetAt', '',
    'factorId', '',
    'updatedAt', v_now
  );

  v_meta := jsonb_set(v_meta, array['agentSecurity', v_agent_id], v_entry, true);
  v_meta := jsonb_set(v_meta, '{updatedAt}', to_jsonb(v_now), true);

  update public.app_meta
     set payload = v_meta,
         updated_at = now()
   where key = 'global';

  insert into gi_mfa_result(kind, detail)
  values
    ('authenticator', 'required'),
    ('pin_only', 'off'),
    ('other_accounts', 'unchanged');
end
$$;

select kind, detail
from gi_mfa_result
order by kind;
