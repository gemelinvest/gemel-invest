-- =============================================================================
-- GEMEL INVEST · save one agent's authenticator status without rewriting
-- the rest of the settings row.
--
-- Running this file only installs the save. It does not reset a barcode,
-- does not change any account, and does not touch elementary referrals.
-- After it is installed, "אפס לברקוד חדש" writes a few status fields for
-- that one agent. The old full-row save is what timed out.
--
-- The save refuses a return to code-only login and refuses authenticator
-- secrets. It accepts the same callers that can already write the settings
-- row, and it writes much less.
--
-- If the editor warns about a temporary table, choose Run without RLS.
-- Run this once, after the matching app update is live. Do not click
-- "אפס לברקוד חדש" before this file has run.
-- =============================================================================

create or replace function public.gi_patch_agent_security(p_agent_id text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.gi_patch_agent_security(text, jsonb) from public;
grant execute on function public.gi_patch_agent_security(text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
