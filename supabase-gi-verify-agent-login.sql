-- =============================================================================
-- GEMEL INVEST · gi_verify_agent_login
-- Phase 1 (additive, zero login risk): server-side PIN check for CRM login.
--
-- Apply once in Supabase SQL Editor.
-- Until applied, app.js keeps using the existing browser PIN compare (fallback).
-- After applied, app.js prefers this RPC and still falls back if RPC is down.
--
-- Does NOT revoke agents.pin (that is R9-pre-B, only after this path is proven).
-- Never return the pin from this function.
-- =============================================================================

create or replace function public.gi_verify_agent_login(p_username text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  match_count int := 0;
  ag public.agents%rowtype;
  uname text := trim(both from coalesce(p_username, ''));
  upin text := trim(both from coalesce(p_pin, ''));
begin
  if uname = '' or upin = '' then
    return jsonb_build_object('ok', false, 'error', 'MISSING_CREDENTIALS');
  end if;

  select count(*)::int into match_count
  from public.agents a
  where coalesce(a.active, true) = true
    and (
      trim(both from coalesce(a.username, '')) = uname
      or trim(both from coalesce(a.name, '')) = uname
    );

  if match_count = 0 then
    return jsonb_build_object('ok', false, 'error', 'USER_NOT_FOUND');
  end if;

  if match_count > 1 then
    return jsonb_build_object('ok', false, 'error', 'USERNAME_AMBIGUOUS');
  end if;

  select a.* into ag
  from public.agents a
  where coalesce(a.active, true) = true
    and (
      trim(both from coalesce(a.username, '')) = uname
      or trim(both from coalesce(a.name, '')) = uname
    )
  limit 1;

  if trim(both from coalesce(ag.pin, '0000')) <> upin then
    return jsonb_build_object('ok', false, 'error', 'BAD_PIN');
  end if;

  -- Never return the pin.
  return jsonb_build_object(
    'ok', true,
    'agentId', ag.id,
    'agentName', coalesce(ag.name, ''),
    'username', coalesce(ag.username, ''),
    'role', coalesce(ag.role, 'agent')
  );
end;
$$;

revoke all on function public.gi_verify_agent_login(text, text) from public;
grant execute on function public.gi_verify_agent_login(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
