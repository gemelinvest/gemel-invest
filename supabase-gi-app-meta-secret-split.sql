-- =============================================================================
-- GEMEL INVEST · move app_meta secrets out of the client-readable row
-- Finding 2 containment only. Does not change login screens, PIN login,
-- password derivation, RLS on other tables, or grants on app_meta itself.
--
-- Deploy order (do not reverse):
--   1. Ship the app.js that calls gi_verify_admin_login, with the local PIN
--      fallback still in place.
--   2. Run this file once in the Supabase SQL Editor.
-- After step 2, anon/authenticated SELECT on app_meta no longer returns the
-- admin PIN or TOTP material. Operational keys in the same row stay readable.
-- gi_verify_admin_login returns ok/name/error only. It never returns the PIN.
--
-- KILL SWITCH (restores the previous readable row; run only if login breaks):
--   drop trigger if exists trg_gi_strip_app_meta_secrets on public.app_meta;
--   update public.app_meta m
--      set payload = jsonb_set(
--        m.payload,
--        '{adminAuth}',
--        coalesce(m.payload->'adminAuth', '{}'::jsonb) || jsonb_build_object('pin', s.value->>'pin'),
--        true
--      )
--     from public.gi_app_secrets s
--    where m.key = 'global' and s.key = 'admin_auth' and coalesce(s.value->>'pin', '') <> '';
-- =============================================================================

create table if not exists public.gi_app_secrets (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.gi_app_secrets enable row level security;
revoke all on table public.gi_app_secrets from public, anon, authenticated;

create or replace function public.gi_strip_app_meta_payload(p jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  admin jsonb;
  sec jsonb;
  cleaned jsonb := '{}'::jsonb;
  agent_id text;
  entry jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return p;
  end if;

  admin := p->'adminAuth';
  if admin is not null and jsonb_typeof(admin) = 'object' then
    p := jsonb_set(p, '{adminAuth}', admin - 'pin', true);
  end if;

  sec := p->'agentSecurity';
  if sec is not null and jsonb_typeof(sec) = 'object' then
    for agent_id, entry in select * from jsonb_each(sec)
    loop
      if jsonb_typeof(entry) = 'object' then
        entry := entry
          - 'totpUri' - 'totp_uri'
          - 'totpQrHtml' - 'totp_qr_html'
          - 'totpSecret' - 'totp_secret';
      end if;
      cleaned := cleaned || jsonb_build_object(agent_id, entry);
    end loop;
    p := jsonb_set(p, '{agentSecurity}', cleaned, true);
  end if;

  return p;
end;
$$;

revoke all on function public.gi_strip_app_meta_payload(jsonb) from public, anon, authenticated;

create or replace function public.gi_verify_admin_login(p_username text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text := trim(both from coalesce(p_username, ''));
  upin text := trim(both from coalesce(p_pin, ''));
  rec jsonb;
  stored_user text;
  stored_pin text;
  active_flag boolean := true;
begin
  if uname = '' or upin = '' then
    return jsonb_build_object('ok', false, 'error', 'MISSING_CREDENTIALS');
  end if;

  select value into rec
  from public.gi_app_secrets
  where key = 'admin_auth';

  if rec is null or coalesce(rec->>'pin', '') = '' then
    select payload->'adminAuth' into rec
    from public.app_meta
    where key = 'global';
  end if;

  if rec is null or jsonb_typeof(rec) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'NOT_CONFIGURED');
  end if;

  stored_user := trim(both from coalesce(rec->>'username', ''));
  stored_pin := trim(both from coalesce(rec->>'pin', ''));
  if rec ? 'active' and lower(coalesce(rec->>'active', '')) in ('false', '0', 'f') then
    active_flag := false;
  end if;

  if not active_flag then
    return jsonb_build_object('ok', false, 'error', 'DISABLED');
  end if;
  if stored_user = '' or stored_pin = '' then
    return jsonb_build_object('ok', false, 'error', 'NOT_CONFIGURED');
  end if;
  if uname <> stored_user or upin <> stored_pin then
    return jsonb_build_object('ok', false, 'error', 'BAD_PIN');
  end if;

  return jsonb_build_object('ok', true, 'name', stored_user);
end;
$$;

revoke all on function public.gi_verify_admin_login(text, text) from public;
grant execute on function public.gi_verify_admin_login(text, text) to anon, authenticated;

-- Copy first, while the readable row still holds the values.
-- Re-running this file must not replace a stored PIN with an empty one.
insert into public.gi_app_secrets (key, value)
select
  'admin_auth',
  jsonb_build_object(
    'username', coalesce(payload#>>'{adminAuth,username}', ''),
    'pin', coalesce(payload#>>'{adminAuth,pin}', ''),
    'active', case
      when lower(coalesce(payload#>>'{adminAuth,active}', '')) in ('false', '0', 'f') then false
      else true
    end
  )
from public.app_meta
where key = 'global'
on conflict (key) do update
  set value = excluded.value,
      updated_at = now()
  where coalesce(excluded.value->>'pin', '') <> '';

insert into public.gi_app_secrets (key, value)
select
  'agent_totp',
  coalesce((
    select jsonb_object_agg(
      e.key,
      jsonb_strip_nulls(jsonb_build_object(
        'totpUri', nullif(coalesce(e.value->>'totpUri', e.value->>'totp_uri'), ''),
        'totpQrHtml', nullif(coalesce(e.value->>'totpQrHtml', e.value->>'totp_qr_html'), '')
      ))
    )
    from jsonb_each(coalesce(m.payload->'agentSecurity', '{}'::jsonb)) e
    where coalesce(e.value->>'totpUri', e.value->>'totp_uri', '') <> ''
       or coalesce(e.value->>'totpQrHtml', e.value->>'totp_qr_html', '') <> ''
  ), '{}'::jsonb)
from public.app_meta m
where m.key = 'global'
on conflict (key) do update
  set value = excluded.value,
      updated_at = now()
  where excluded.value <> '{}'::jsonb;

create or replace function public.gi_strip_app_meta_row()
returns trigger
language plpgsql
as $$
begin
  new.payload := public.gi_strip_app_meta_payload(new.payload);
  return new;
end;
$$;

revoke all on function public.gi_strip_app_meta_row() from public, anon, authenticated;

drop trigger if exists trg_gi_strip_app_meta_secrets on public.app_meta;
create trigger trg_gi_strip_app_meta_secrets
  before insert or update on public.app_meta
  for each row
  execute function public.gi_strip_app_meta_row();

update public.app_meta
   set payload = payload
 where key = 'global';

notify pgrst, 'reload schema';
