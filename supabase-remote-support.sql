-- =============================================================================
-- GEMEL INVEST · Remote Support (תמיכה מרחוק)
-- Additive only: new tables + SECURITY DEFINER RPCs.
-- Does not alter customers / proposals / agents / app_meta.
--
-- Apply once in Supabase SQL Editor (or via migration).
-- Client: gi-remote-support.js calls these RPCs with an actor token.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.gi_remote_support_actor_tokens (
  id uuid primary key default gen_random_uuid(),
  agent_user_id text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists gi_rs_tokens_agent_idx
  on public.gi_remote_support_actor_tokens (agent_user_id, created_at desc);

create table if not exists public.gi_remote_support_sessions (
  id uuid primary key default gen_random_uuid(),
  agent_user_id text not null,
  admin_user_id text,
  agent_name text not null default '',
  admin_name text not null default '',
  problem_text text not null default '',
  status text not null default 'requested',
  view_permission boolean not null default false,
  control_permission boolean not null default false,
  signaling_secret text not null,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  connected_at timestamptz,
  ended_at timestamptz,
  ended_by text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gi_rs_sessions_status_chk check (status in (
    'requested',
    'pending_agent_approval',
    'approved',
    'connecting',
    'connected',
    'control_requested',
    'control_granted',
    'control_revoked',
    'ended',
    'rejected',
    'expired',
    'failed'
  ))
);

create index if not exists gi_rs_sessions_agent_idx
  on public.gi_remote_support_sessions (agent_user_id, requested_at desc);

create index if not exists gi_rs_sessions_admin_idx
  on public.gi_remote_support_sessions (admin_user_id, requested_at desc);

create index if not exists gi_rs_sessions_status_idx
  on public.gi_remote_support_sessions (status, requested_at desc);

create unique index if not exists gi_rs_one_active_per_agent
  on public.gi_remote_support_sessions (agent_user_id)
  where status not in ('ended', 'rejected', 'expired', 'failed');

create table if not exists public.gi_remote_support_audit_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.gi_remote_support_sessions(id) on delete cascade,
  actor_user_id text,
  actor_role text,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists gi_rs_audit_session_idx
  on public.gi_remote_support_audit_logs (session_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Lock down tables: no direct PostgREST writes; no open SELECT of secrets.
-- ---------------------------------------------------------------------------

alter table public.gi_remote_support_actor_tokens enable row level security;
alter table public.gi_remote_support_sessions enable row level security;
alter table public.gi_remote_support_audit_logs enable row level security;

revoke all on public.gi_remote_support_actor_tokens from public, anon, authenticated;
revoke all on public.gi_remote_support_sessions from public, anon, authenticated;
revoke all on public.gi_remote_support_audit_logs from public, anon, authenticated;
grant all on public.gi_remote_support_actor_tokens to service_role;
grant all on public.gi_remote_support_sessions to service_role;
grant all on public.gi_remote_support_audit_logs to service_role;

-- ---------------------------------------------------------------------------
-- Internal helpers (not granted to anon)
-- ---------------------------------------------------------------------------

create or replace function public.gi_rs_role_is_support_admin(p_role text, p_name text)
returns boolean
language plpgsql
immutable
set search_path = public
as $fn$
declare
  role_norm text := lower(trim(both from coalesce(p_role, '')));
  name_norm text := trim(both from coalesce(p_name, ''));
begin
  if role_norm in ('admin', 'owner', 'manager', 'adminlite', 'מנהל') then
    return true;
  end if;
  if name_norm in ('איתי סומך', 'סוניה ארנשטיין', 'אוריה סומך') then
    return true;
  end if;
  return false;
end;
$fn$;

create or replace function public.gi_rs_hash_token(p_token text)
returns text
language sql
immutable
set search_path = public, extensions
as $fn$
  select encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'::text), 'hex');
$fn$;

create or replace function public.gi_rs_new_secret()
returns text
language sql
volatile
set search_path = public, extensions
as $fn$
  select encode(extensions.gen_random_bytes(32), 'hex');
$fn$;

create or replace function public.gi_rs_terminal(p_status text)
returns boolean
language sql
immutable
set search_path = public
as $fn$
  select coalesce(p_status, '') in ('ended', 'rejected', 'expired', 'failed');
$fn$;

create or replace function public.gi_rs_can_transition(p_from text, p_to text)
returns boolean
language plpgsql
immutable
set search_path = public
as $fn$
begin
  if public.gi_rs_terminal(p_from) then
    return false;
  end if;
  if p_to in ('ended', 'rejected', 'expired', 'failed') then
    return true;
  end if;
  if p_from = 'requested' and p_to = 'pending_agent_approval' then
    return true;
  end if;
  if p_from = 'pending_agent_approval' and p_to = 'approved' then
    return true;
  end if;
  if p_from = 'approved' and p_to = 'connecting' then
    return true;
  end if;
  if p_from = 'connecting' and p_to = 'connected' then
    return true;
  end if;
  if p_from in ('connected', 'control_revoked') and p_to = 'control_requested' then
    return true;
  end if;
  if p_from = 'control_requested' and p_to in ('control_granted', 'connected', 'control_revoked') then
    return true;
  end if;
  if p_from = 'control_granted' and p_to = 'control_revoked' then
    return true;
  end if;
  return false;
end;
$fn$;

create or replace function public.gi_rs_expire_stale()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.gi_remote_support_sessions
  set status = 'expired',
      view_permission = false,
      control_permission = false,
      ended_at = coalesce(ended_at, now()),
      ended_by = coalesce(ended_by, 'system'),
      updated_at = now()
  where not public.gi_rs_terminal(status)
    and expires_at < now();

  insert into public.gi_remote_support_audit_logs (session_id, actor_user_id, actor_role, action, metadata)
  select s.id, 'system', 'system', 'Session expired', jsonb_build_object('source', 'expire_stale')
  from public.gi_remote_support_sessions s
  where s.status = 'expired'
    and s.ended_at >= now() - interval '2 seconds'
    and not exists (
      select 1 from public.gi_remote_support_audit_logs a
      where a.session_id = s.id and a.action = 'Session expired'
    );
end;
$fn$;

create or replace function public.gi_rs_audit(
  p_session_id uuid,
  p_actor_id text,
  p_actor_role text,
  p_action text,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.gi_remote_support_audit_logs (session_id, actor_user_id, actor_role, action, metadata)
  values (
    p_session_id,
    p_actor_id,
    p_actor_role,
    p_action,
    coalesce(p_metadata, '{}'::jsonb)
      - 'signaling_secret'
      - 'sdp'
      - 'candidate'
      - 'token'
      - 'pin'
      - 'password'
      - 'cardNumber'
      - 'cvv'
  );
end;
$fn$;

create or replace function public.gi_rs_session_json(
  s public.gi_remote_support_sessions,
  include_secret boolean
) returns jsonb
language plpgsql
stable
set search_path = public
as $fn$
begin
  return jsonb_build_object(
    'id', s.id,
    'agentUserId', s.agent_user_id,
    'adminUserId', s.admin_user_id,
    'agentName', s.agent_name,
    'adminName', s.admin_name,
    'problemText', s.problem_text,
    'status', s.status,
    'viewPermission', s.view_permission,
    'controlPermission', s.control_permission,
    'requestedAt', s.requested_at,
    'approvedAt', s.approved_at,
    'connectedAt', s.connected_at,
    'endedAt', s.ended_at,
    'endedBy', s.ended_by,
    'expiresAt', s.expires_at,
    'updatedAt', s.updated_at,
    'signalingSecret', case when include_secret and not public.gi_rs_terminal(s.status)
      then s.signaling_secret else null end
  );
end;
$fn$;

create or replace function public.gi_rs_lookup_actor(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  tok public.gi_remote_support_actor_tokens%rowtype;
  ag public.agents%rowtype;
  hash text;
begin
  if trim(both from coalesce(p_token, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'MISSING_TOKEN');
  end if;
  hash := public.gi_rs_hash_token(trim(both from p_token));
  select t.* into tok
  from public.gi_remote_support_actor_tokens t
  where t.token_hash = hash
  limit 1;
  if tok.id is null then
    return jsonb_build_object('ok', false, 'error', 'BAD_TOKEN');
  end if;
  if tok.revoked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'TOKEN_REVOKED');
  end if;
  if tok.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'TOKEN_EXPIRED');
  end if;
  select a.* into ag
  from public.agents a
  where a.id = tok.agent_user_id
  limit 1;
  if ag.id is null then
    return jsonb_build_object('ok', false, 'error', 'AGENT_NOT_FOUND');
  end if;
  if coalesce(ag.active, true) is not true then
    return jsonb_build_object('ok', false, 'error', 'AGENT_INACTIVE');
  end if;
  return jsonb_build_object(
    'ok', true,
    'tokenId', tok.id,
    'agentUserId', tok.agent_user_id,
    'agentName', coalesce(ag.name, ''),
    'role', coalesce(ag.role, 'agent'),
    'isSupportAdmin', public.gi_rs_role_is_support_admin(ag.role, ag.name)
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------

create or replace function public.gi_rs_mint_actor_token(p_agent_id text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  ag public.agents%rowtype;
  raw_token text;
  aid text := trim(both from coalesce(p_agent_id, ''));
  upin text := trim(both from coalesce(p_pin, ''));
begin
  if aid = '' then
    return jsonb_build_object('ok', false, 'error', 'MISSING_CREDENTIALS');
  end if;
  select a.* into ag
  from public.agents a
  where coalesce(a.active, true) = true
    and (
      a.id = aid
      or trim(both from coalesce(a.username, '')) = aid
      or trim(both from coalesce(a.name, '')) = aid
    )
  limit 1;
  if ag.id is null then
    return jsonb_build_object('ok', false, 'error', 'AGENT_NOT_FOUND');
  end if;
  -- PIN is optional: the CRM session already identified the logged-in agent.
  -- If a PIN is supplied, still verify it.
  if upin <> '' and trim(both from coalesce(ag.pin, '0000')) <> upin then
    return jsonb_build_object('ok', false, 'error', 'BAD_PIN');
  end if;

  update public.gi_remote_support_actor_tokens
  set revoked_at = now()
  where agent_user_id = ag.id
    and revoked_at is null;

  raw_token := public.gi_rs_new_secret();
  insert into public.gi_remote_support_actor_tokens (agent_user_id, token_hash, expires_at)
  values (ag.id, public.gi_rs_hash_token(raw_token), now() + interval '12 hours');

  return jsonb_build_object(
    'ok', true,
    'token', raw_token,
    'agentUserId', ag.id,
    'agentName', coalesce(ag.name, ''),
    'role', coalesce(ag.role, 'agent'),
    'isSupportAdmin', public.gi_rs_role_is_support_admin(ag.role, ag.name),
    'expiresAt', (now() + interval '12 hours')
  );
end;
$fn$;

create or replace function public.gi_rs_revoke_actor_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  hash text;
begin
  if trim(both from coalesce(p_token, '')) = '' then
    return jsonb_build_object('ok', true);
  end if;
  hash := public.gi_rs_hash_token(trim(both from p_token));
  update public.gi_remote_support_actor_tokens
  set revoked_at = now()
  where token_hash = hash
    and revoked_at is null;
  return jsonb_build_object('ok', true);
end;
$fn$;

create or replace function public.gi_rs_list(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  actor jsonb;
  recs jsonb := '[]'::jsonb;
  mine jsonb := null;
begin
  perform public.gi_rs_expire_stale();
  actor := public.gi_rs_lookup_actor(p_token);
  if coalesce(actor->>'ok', 'false') <> 'true' then
    return actor;
  end if;

  if (actor->>'isSupportAdmin')::boolean then
    select coalesce(jsonb_agg(public.gi_rs_session_json(s, (
        s.agent_user_id = actor->>'agentUserId'
        or coalesce(s.admin_user_id, '') = actor->>'agentUserId'
      ) and not public.gi_rs_terminal(s.status)
    ) order by s.requested_at desc), '[]'::jsonb)
    into recs
    from public.gi_remote_support_sessions s
    where s.requested_at > now() - interval '7 days'
      and (
        not public.gi_rs_terminal(s.status)
        or s.ended_at > now() - interval '6 hours'
      );
  end if;

  select public.gi_rs_session_json(s, not public.gi_rs_terminal(s.status))
  into mine
  from public.gi_remote_support_sessions s
  where s.agent_user_id = actor->>'agentUserId'
    and not public.gi_rs_terminal(s.status)
  order by s.requested_at desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'isSupportAdmin', (actor->>'isSupportAdmin')::boolean,
    'mine', mine,
    'inbox', recs
  );
end;
$fn$;

create or replace function public.gi_rs_action(
  p_token text,
  p_action text,
  p_session_id uuid default null,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  actor jsonb;
  s public.gi_remote_support_sessions%rowtype;
  act text := lower(trim(both from coalesce(p_action, '')));
  problem text;
  next_status text;
  include_secret boolean := false;
  actor_id text;
  actor_role text;
  is_admin boolean;
  is_agent_party boolean;
begin
  perform public.gi_rs_expire_stale();
  actor := public.gi_rs_lookup_actor(p_token);
  if coalesce(actor->>'ok', 'false') <> 'true' then
    return actor;
  end if;

  actor_id := actor->>'agentUserId';
  actor_role := actor->>'role';
  is_admin := (actor->>'isSupportAdmin')::boolean;
  problem := left(trim(both from coalesce(p_payload->>'problemText', p_payload->>'problem_text', '')), 2000);

  if act = 'request_support' then
    if is_admin then
      return jsonb_build_object('ok', false, 'error', 'ADMIN_CANNOT_REQUEST');
    end if;
    if exists (
      select 1 from public.gi_remote_support_sessions x
      where x.agent_user_id = actor_id
        and not public.gi_rs_terminal(x.status)
    ) then
      return jsonb_build_object('ok', false, 'error', 'SESSION_ALREADY_ACTIVE');
    end if;
    insert into public.gi_remote_support_sessions (
      agent_user_id, agent_name, problem_text, status,
      signaling_secret, expires_at
    ) values (
      actor_id,
      actor->>'agentName',
      problem,
      'requested',
      public.gi_rs_new_secret(),
      now() + interval '45 minutes'
    ) returning * into s;
    perform public.gi_rs_audit(s.id, actor_id, actor_role, 'Support requested', jsonb_build_object(
      'hasProblemText', length(problem) > 0
    ));
    return jsonb_build_object('ok', true, 'session', public.gi_rs_session_json(s, true));
  end if;

  if p_session_id is null then
    return jsonb_build_object('ok', false, 'error', 'MISSING_SESSION');
  end if;

  select x.* into s from public.gi_remote_support_sessions x where x.id = p_session_id;
  if s.id is null then
    return jsonb_build_object('ok', false, 'error', 'SESSION_NOT_FOUND');
  end if;
  if public.gi_rs_terminal(s.status) and act not in ('get') then
    return jsonb_build_object('ok', false, 'error', 'SESSION_TERMINAL', 'session', public.gi_rs_session_json(s, false));
  end if;

  is_agent_party := (s.agent_user_id = actor_id);

  if act = 'get' then
    if not (is_agent_party or is_admin) then
      return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    end if;
    include_secret := (is_agent_party or coalesce(s.admin_user_id, '') = actor_id)
      and not public.gi_rs_terminal(s.status);
    return jsonb_build_object('ok', true, 'session', public.gi_rs_session_json(s, include_secret));
  end if;

  if act = 'reject_request' then
    if not is_admin then
      return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    end if;
    next_status := 'rejected';
    if not public.gi_rs_can_transition(s.status, next_status) then
      return jsonb_build_object('ok', false, 'error', 'ILLEGAL_TRANSITION');
    end if;
    update public.gi_remote_support_sessions
    set status = next_status,
        admin_user_id = actor_id,
        admin_name = actor->>'agentName',
        view_permission = false,
        control_permission = false,
        ended_at = now(),
        ended_by = actor_id,
        updated_at = now()
    where id = s.id
    returning * into s;
    perform public.gi_rs_audit(s.id, actor_id, actor_role, 'Request rejected', '{}'::jsonb);
    return jsonb_build_object('ok', true, 'session', public.gi_rs_session_json(s, false));
  end if;

  if act = 'request_connect' then
    if not is_admin then
      return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    end if;
    if s.status <> 'requested' then
      return jsonb_build_object('ok', false, 'error', 'ILLEGAL_TRANSITION');
    end if;
    if coalesce(s.admin_user_id, '') <> '' and s.admin_user_id <> actor_id then
      return jsonb_build_object('ok', false, 'error', 'OTHER_ADMIN_ATTACHED');
    end if;
    update public.gi_remote_support_sessions
    set status = 'pending_agent_approval',
        admin_user_id = actor_id,
        admin_name = actor->>'agentName',
        updated_at = now()
    where id = s.id
    returning * into s;
    perform public.gi_rs_audit(s.id, actor_id, actor_role, 'Request accepted', '{}'::jsonb);
    perform public.gi_rs_audit(s.id, actor_id, actor_role, 'Connection requested', '{}'::jsonb);
    return jsonb_build_object('ok', true, 'session', public.gi_rs_session_json(s, true));
  end if;

  if act = 'approve_connect' then
    if not is_agent_party then
      return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    end if;
    if s.status <> 'pending_agent_approval' then
      return jsonb_build_object('ok', false, 'error', 'ILLEGAL_TRANSITION');
    end if;
    update public.gi_remote_support_sessions
    set status = 'approved',
        view_permission = true,
        control_permission = false,
        approved_at = now(),
        updated_at = now()
    where id = s.id
    returning * into s;
    perform public.gi_rs_audit(s.id, actor_id, actor_role, 'Connection approved', '{}'::jsonb);
    return jsonb_build_object('ok', true, 'session', public.gi_rs_session_json(s, true));
  end if;

  if act = 'reject_connect' then
    if not is_agent_party then
      return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    end if;
    if s.status <> 'pending_agent_approval' then
      return jsonb_build_object('ok', false, 'error', 'ILLEGAL_TRANSITION');
    end if;
    update public.gi_remote_support_sessions
    set status = 'rejected',
        view_permission = false,
        control_permission = false,
        ended_at = now(),
        ended_by = actor_id,
        updated_at = now()
    where id = s.id
    returning * into s;
    perform public.gi_rs_audit(s.id, actor_id, actor_role, 'Request rejected', jsonb_build_object('by', 'agent'));
    return jsonb_build_object('ok', true, 'session', public.gi_rs_session_json(s, false));
  end if;

  if act = 'mark_connecting' then
    if not (is_agent_party or coalesce(s.admin_user_id, '') = actor_id) then
      return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    end if;
    if s.status not in ('approved', 'connecting') then
      return jsonb_build_object('ok', false, 'error', 'ILLEGAL_TRANSITION');
    end if;
    if s.status = 'approved' then
      update public.gi_remote_support_sessions
      set status = 'connecting',
          view_permission = true,
          updated_at = now()
      where id = s.id
      returning * into s;
    end if;
    return jsonb_build_object('ok', true, 'session', public.gi_rs_session_json(s, true));
  end if;

  if act = 'mark_connected' then
    if not (is_agent_party or coalesce(s.admin_user_id, '') = actor_id) then
      return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    end if;
    if s.status not in ('connecting', 'connected', 'control_requested', 'control_granted', 'control_revoked') then
      if s.status <> 'approved' then
        return jsonb_build_object('ok', false, 'error', 'ILLEGAL_TRANSITION');
      end if;
      update public.gi_remote_support_sessions
      set status = 'connecting',
          view_permission = true,
          updated_at = now()
      where id = s.id
      returning * into s;
    end if;
    if s.status in ('approved', 'connecting') then
      update public.gi_remote_support_sessions
      set status = 'connected',
          view_permission = true,
          control_permission = false,
          connected_at = coalesce(connected_at, now()),
          updated_at = now()
      where id = s.id
      returning * into s;
      perform public.gi_rs_audit(s.id, actor_id, actor_role, 'Connection started', '{}'::jsonb);
    end if;
    return jsonb_build_object('ok', true, 'session', public.gi_rs_session_json(s, true));
  end if;

  if act = 'request_control' then
    if coalesce(s.admin_user_id, '') <> actor_id then
      return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    end if;
    if s.status not in ('connected', 'control_revoked') then
      return jsonb_build_object('ok', false, 'error', 'ILLEGAL_TRANSITION');
    end if;
    update public.gi_remote_support_sessions
    set status = 'control_requested',
        view_permission = true,
        control_permission = false,
        updated_at = now()
    where id = s.id
    returning * into s;
    perform public.gi_rs_audit(s.id, actor_id, actor_role, 'Control requested', '{}'::jsonb);
    return jsonb_build_object('ok', true, 'session', public.gi_rs_session_json(s, true));
  end if;

  if act = 'grant_control' then
    if not is_agent_party then
      return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    end if;
    if s.status <> 'control_requested' then
      return jsonb_build_object('ok', false, 'error', 'ILLEGAL_TRANSITION');
    end if;
    update public.gi_remote_support_sessions
    set status = 'control_granted',
        view_permission = true,
        control_permission = true,
        updated_at = now()
    where id = s.id
    returning * into s;
    perform public.gi_rs_audit(s.id, actor_id, actor_role, 'Control granted', '{}'::jsonb);
    return jsonb_build_object('ok', true, 'session', public.gi_rs_session_json(s, true));
  end if;

  if act = 'reject_control' then
    if not is_agent_party then
      return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    end if;
    if s.status <> 'control_requested' then
      return jsonb_build_object('ok', false, 'error', 'ILLEGAL_TRANSITION');
    end if;
    update public.gi_remote_support_sessions
    set status = 'connected',
        view_permission = true,
        control_permission = false,
        updated_at = now()
    where id = s.id
    returning * into s;
    perform public.gi_rs_audit(s.id, actor_id, actor_role, 'Control revoked', jsonb_build_object('reason', 'rejected'));
    return jsonb_build_object('ok', true, 'session', public.gi_rs_session_json(s, true));
  end if;

  if act = 'revoke_control' then
    if not is_agent_party then
      return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    end if;
    if s.status <> 'control_granted' then
      return jsonb_build_object('ok', false, 'error', 'ILLEGAL_TRANSITION');
    end if;
    update public.gi_remote_support_sessions
    set status = 'control_revoked',
        view_permission = true,
        control_permission = false,
        updated_at = now()
    where id = s.id
    returning * into s;
    perform public.gi_rs_audit(s.id, actor_id, actor_role, 'Control revoked', '{}'::jsonb);
    return jsonb_build_object('ok', true, 'session', public.gi_rs_session_json(s, true));
  end if;

  if act in ('end_session', 'fail_session') then
    if not (is_agent_party or coalesce(s.admin_user_id, '') = actor_id or (is_admin and act = 'fail_session')) then
      return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    end if;
    next_status := case when act = 'fail_session' then 'failed' else 'ended' end;
    update public.gi_remote_support_sessions
    set status = next_status,
        view_permission = false,
        control_permission = false,
        ended_at = now(),
        ended_by = actor_id,
        updated_at = now()
    where id = s.id
    returning * into s;
    perform public.gi_rs_audit(
      s.id,
      actor_id,
      actor_role,
      case when next_status = 'failed' then 'Session ended' else 'Session ended' end,
      jsonb_build_object('status', next_status, 'reason', left(coalesce(p_payload->>'reason', ''), 120))
    );
    return jsonb_build_object('ok', true, 'session', public.gi_rs_session_json(s, false));
  end if;

  return jsonb_build_object('ok', false, 'error', 'UNKNOWN_ACTION');
end;
$fn$;

revoke all on function public.gi_rs_role_is_support_admin(text, text) from public, anon, authenticated;
revoke all on function public.gi_rs_hash_token(text) from public, anon, authenticated;
revoke all on function public.gi_rs_new_secret() from public, anon, authenticated;
revoke all on function public.gi_rs_terminal(text) from public, anon, authenticated;
revoke all on function public.gi_rs_can_transition(text, text) from public, anon, authenticated;
revoke all on function public.gi_rs_expire_stale() from public, anon, authenticated;
revoke all on function public.gi_rs_audit(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.gi_rs_session_json(public.gi_remote_support_sessions, boolean) from public, anon, authenticated;
revoke all on function public.gi_rs_lookup_actor(text) from public, anon, authenticated;

revoke all on function public.gi_rs_mint_actor_token(text, text) from public;
grant execute on function public.gi_rs_mint_actor_token(text, text) to anon, authenticated;

revoke all on function public.gi_rs_revoke_actor_token(text) from public;
grant execute on function public.gi_rs_revoke_actor_token(text) to anon, authenticated;

revoke all on function public.gi_rs_list(text) from public;
grant execute on function public.gi_rs_list(text) to anon, authenticated;

revoke all on function public.gi_rs_action(text, text, uuid, jsonb) from public;
grant execute on function public.gi_rs_action(text, text, uuid, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
