-- =============================================================================
-- GEMEL INVEST · section 1 of 2 · rotate the exposed admin PIN and the
-- exposed TOTP factors only.
--
-- Run this once, in the Supabase SQL Editor, only after the site is serving
-- the app.js that asks the server before it trusts a cached admin PIN
-- (the script URL contains giPinServer=1).
--
-- What this does
--   * Replaces the admin PIN inside gi_app_secrets. The new PIN is generated
--     here and returned once by the last SELECT. It is not written into
--     app_meta, into this file, or into the client.
--   * Deletes the copied TOTP material for the accounts that had a totpUri
--     or totpQrHtml in gi_app_secrets (the exposed set). No other agent.
--   * Deletes those accounts' Auth MFA factors so the old barcode cannot
--     verify. Their sessions stay until section 2.
--   * Marks those agentSecurity rows mfaResetPending so the next PIN login
--     shows a new barcode. Other agents, their PINs, and password derivation
--     are not changed. RLS is not changed.
--
-- The last SELECT prints the new admin PIN. Copy it into a password manager.
-- Do not paste it into chat, git, or app_meta.
-- Log in as admin with that PIN and confirm it works.
-- Only then run supabase-gi-revoke-exposed-sessions.sql.
--
-- Running this file again raises an error and does not change the PIN.
-- The destroyed TOTP copies cannot be restored.
-- =============================================================================

drop table if exists gi_rotate_result;
create temp table gi_rotate_result (
  kind text,
  agent_id text,
  agent_name text,
  detail text
);

do $$
declare
  old_pin text;
  new_pin text;
  admin_user text;
  stamp text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  totp jsonb;
  meta_payload jsonb;
  entry jsonb;
  agent_key text;
  agent_name text;
  uid uuid;
  factor_uids uuid[] := array[]::uuid[];
  uids uuid[] := array[]::uuid[];
  agent_ids jsonb := '[]'::jsonb;
  removed int := 0;
  attempt int;
begin
  if exists (
    select 1 from public.gi_app_secrets where key = 'exposed_totp_reset'
  ) then
    raise exception 'section 1 already ran; do not rotate the PIN again';
  end if;

  select value->>'pin', btrim(coalesce(value->>'username', ''))
    into old_pin, admin_user
  from public.gi_app_secrets
  where key = 'admin_auth';

  if coalesce(old_pin, '') = '' then
    raise exception 'admin PIN is not in gi_app_secrets';
  end if;

  new_pin := null;
  for attempt in 1..8 loop
    select string_agg((floor(random() * 10))::int::text, '')
      into new_pin
    from generate_series(1, 6);
    exit when new_pin is distinct from old_pin
      and length(new_pin) = 6
      and new_pin !~ '^0+$';
  end loop;
  if new_pin is not distinct from old_pin or length(coalesce(new_pin, '')) <> 6 then
    raise exception 'could not generate a replacement PIN';
  end if;

  update public.gi_app_secrets
     set value = jsonb_set(
           jsonb_set(value, '{pin}', to_jsonb(new_pin), true),
           '{rotatedAt}', to_jsonb(stamp), true
         ),
         updated_at = now()
   where key = 'admin_auth';

  insert into gi_rotate_result(kind, detail)
  values ('new_admin_pin', new_pin);

  select coalesce(value, '{}'::jsonb)
    into totp
  from public.gi_app_secrets
  where key = 'agent_totp';
  totp := coalesce(totp, '{}'::jsonb);

  select m.payload
    into meta_payload
  from public.app_meta m
  where m.key = 'global'
  for update;
  if meta_payload is null or jsonb_typeof(meta_payload) <> 'object' then
    raise exception 'app_meta global row is missing';
  end if;

  for agent_key, entry in
    select e.key, e.value from jsonb_each(totp) e
  loop
    if coalesce(entry->>'totpUri', entry->>'totp_uri', '') = ''
       and coalesce(entry->>'totpQrHtml', entry->>'totp_qr_html', '') = '' then
      continue;
    end if;

    entry := meta_payload->'agentSecurity'->agent_key;
    if entry is null or jsonb_typeof(entry) <> 'object' then
      entry := '{}'::jsonb;
    end if;
    entry := entry
      - 'totpUri' - 'totp_uri'
      - 'totpQrHtml' - 'totp_qr_html'
      - 'totpSecret' - 'totp_secret'
      - 'factorId' - 'factor_id';
    entry := entry || jsonb_build_object(
      'mfaRequired', true,
      'mfaEnabled', false,
      'mfaResetPending', true,
      'mfaResetAt', stamp,
      'updatedAt', stamp,
      'factorId', '',
      'mfaEnrolledAt', '',
      'lastVerifiedAt', ''
    );
    meta_payload := jsonb_set(meta_payload, array['agentSecurity', agent_key], entry, true);
    agent_ids := agent_ids || to_jsonb(agent_key);

    select a.auth_user_id, coalesce(nullif(btrim(a.name), ''), nullif(btrim(a.username), ''), agent_key)
      into uid, agent_name
    from public.agents a
    where a.id::text = agent_key;

    if uid is not null and not uid = any(factor_uids) then
      factor_uids := array_append(factor_uids, uid);
    end if;

    insert into gi_rotate_result(kind, agent_id, agent_name, detail)
    values ('reset_agent', agent_key, agent_name, 'barcode will be reissued on next login');
  end loop;

  update public.app_meta
     set payload = meta_payload
   where key = 'global';

  uids := factor_uids;

  if admin_user <> '' then
    select a.auth_user_id
      into uid
    from public.agents a
    where a.auth_user_id is not null
      and (
        btrim(coalesce(a.username, '')) = admin_user
        or btrim(coalesce(a.name, '')) = admin_user
      )
    limit 1;
    if uid is not null and not uid = any(uids) then
      uids := array_append(uids, uid);
    end if;
  end if;

  if cardinality(factor_uids) > 0 then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'sessions'
        and column_name = 'factor_id'
    ) then
      update auth.sessions s
         set factor_id = null
        from auth.mfa_factors f
       where s.factor_id = f.id
         and f.user_id = any(factor_uids);
    end if;

    if to_regclass('auth.mfa_challenges') is not null then
      delete from auth.mfa_challenges c
       using auth.mfa_factors f
       where c.factor_id = f.id
         and f.user_id = any(factor_uids);
    end if;

    delete from auth.mfa_factors f
     where f.user_id = any(factor_uids);
    get diagnostics removed = row_count;
  end if;

  insert into public.gi_app_secrets (key, value)
  values (
    'exposed_totp_reset',
    jsonb_build_object(
      'agentIds', agent_ids,
      'authUserIds', coalesce(to_jsonb(uids), '[]'::jsonb),
      'resetAt', stamp
    )
  );

  insert into public.gi_app_secrets (key, value)
  values ('agent_totp', '{}'::jsonb)
  on conflict (key) do update
    set value = '{}'::jsonb,
        updated_at = now();

  insert into gi_rotate_result(kind, detail)
  values (
    'summary',
    'agents=' || jsonb_array_length(agent_ids)::text
      || ' factors_deleted=' || removed::text
      || ' sessions_kept=yes'
  );
end
$$;

-- The new_admin_pin row is the only place the new PIN appears.
-- Do not paste this result into chat or git.
select kind, agent_id, agent_name, detail
from gi_rotate_result
order by case kind
  when 'new_admin_pin' then 0
  when 'reset_agent' then 1
  else 2
end, agent_id;
