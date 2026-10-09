-- =============================================================================
-- GEMEL INVEST · Application WAF + SOC persistence (additive)
-- Apply once in Supabase SQL Editor AFTER supabase-gi-login-bruteforce-protection.sql.
-- Does not change the agent PIN login function or its success path.
--
-- Kill switch: insert/update public.gi_security_settings
--   key = 'waf_enabled', value = 'false'
-- Private tables: anon/authenticated have no direct SELECT/UPDATE/DELETE.
-- Ingest is write-only, rate-limited, and re-validates a short signature set.
-- Admin RPCs require an active agent with role admin/owner/manager linked to auth.uid().
-- =============================================================================

insert into public.gi_security_settings (key, value) values
  ('waf_enabled', 'true')
on conflict (key) do nothing;

create table if not exists public.gi_waf_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null check (action in ('log', 'block')),
  severity text not null check (severity in ('info', 'suspicious', 'critical')),
  category text not null,
  rule_id text,
  method text,
  path text,
  username text,
  ip text,
  detail text
);

create index if not exists gi_waf_events_created_idx
  on public.gi_waf_events (created_at desc);

create table if not exists public.gi_waf_blocks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('ip', 'username', 'session')),
  value text not null,
  reason text,
  until timestamptz,
  created_by text
);

create index if not exists gi_waf_blocks_lookup_idx
  on public.gi_waf_blocks (kind, lower(value));

create table if not exists public.gi_waf_incidents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'investigating', 'contained', 'closed')),
  severity text not null check (severity in ('suspicious', 'critical')),
  category text not null,
  title text not null,
  summary text,
  recommendation text,
  actor text,
  event_count int not null default 1
);

alter table public.gi_waf_events enable row level security;
alter table public.gi_waf_blocks enable row level security;
alter table public.gi_waf_incidents enable row level security;

revoke all on public.gi_waf_events from anon, authenticated, public;
revoke all on public.gi_waf_blocks from anon, authenticated, public;
revoke all on public.gi_waf_incidents from anon, authenticated, public;
grant all on public.gi_waf_events to service_role;
grant all on public.gi_waf_blocks to service_role;
grant all on public.gi_waf_incidents to service_role;

create or replace function public.gi_waf_is_enabled()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
begin
  select (s.value = 'true') into v_enabled
    from public.gi_security_settings s where s.key = 'waf_enabled';
  return coalesce(v_enabled, true);
end;
$$;

create or replace function public.gi_waf_is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agents a
    where a.auth_user_id is not null
      and a.auth_user_id = auth.uid()
      and coalesce(a.active, true) = true
      and lower(coalesce(a.role, '')) in ('admin', 'owner', 'manager')
  );
$$;

create or replace function public.gi_waf_client_ip()
returns text
language plpgsql
stable
as $$
declare
  v_ip text;
begin
  v_ip := trim(both from split_part(coalesce(current_setting('request.header.x-forwarded-for', true), ''), ',', 1));
  if v_ip = '' then v_ip := 'unknown'; end if;
  return v_ip;
end;
$$;

create or replace function public.gi_waf_classify(p_text text)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_hay text := lower(coalesce(p_text, ''));
begin
  if v_hay ~ '<[[:space:]]*script\y' or v_hay ~ 'javascript[[:space:]]*:' or v_hay ~ 'onerror[[:space:]]*=' then
    return jsonb_build_object('category', 'xss', 'severity', 'critical', 'rule_id', 'sig-xss');
  end if;
  if v_hay ~ 'union[[:space:]]+select\y' or v_hay ~ '''[[:space:]]*or[[:space:]]+''?1''?[[:space:]]*=[[:space:]]*''?1' or v_hay ~ 'drop[[:space:]]+table\y' then
    return jsonb_build_object('category', 'sqli', 'severity', 'critical', 'rule_id', 'sig-sqli');
  end if;
  if v_hay ~ '\.\./' or v_hay ~ 'etc/passwd' then
    return jsonb_build_object('category', 'traversal', 'severity', 'critical', 'rule_id', 'sig-traversal');
  end if;
  if v_hay ~ '169\.254\.169\.254' or v_hay ~ 'file://' then
    return jsonb_build_object('category', 'ssrf', 'severity', 'critical', 'rule_id', 'sig-ssrf');
  end if;
  return jsonb_build_object('category', 'unknown', 'severity', 'suspicious', 'rule_id', '');
end;
$$;

create or replace function public.gi_waf_ingest_event(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := public.gi_waf_client_ip();
  v_recent int := 0;
  v_path text;
  v_detail text;
  v_class jsonb;
  v_action text;
  v_username text;
begin
  if not public.gi_waf_is_enabled() then
    return jsonb_build_object('ok', false, 'error', 'WAF_DISABLED');
  end if;

  select count(*)::int into v_recent
    from public.gi_waf_events e
    where e.ip = v_ip
      and e.created_at > now() - interval '1 minute';
  if v_recent >= 30 then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMIT');
  end if;

  v_path := left(coalesce(p_event->>'path', ''), 300);
  v_detail := left(coalesce(p_event->>'detail', p_event->>'snippet', ''), 480);
  v_username := left(coalesce(p_event->>'username', ''), 80);
  v_class := public.gi_waf_classify(v_path || ' ' || v_detail);
  v_action := case when coalesce(p_event->>'action', '') = 'block' or (v_class->>'severity') = 'critical' then 'block' else 'log' end;

  insert into public.gi_waf_events (action, severity, category, rule_id, method, path, username, ip, detail)
  values (
    v_action,
    coalesce(v_class->>'severity', 'suspicious'),
    coalesce(nullif(v_class->>'category', 'unknown'), nullif(p_event->>'category', ''), 'unknown'),
    coalesce(nullif(v_class->>'rule_id', ''), p_event->>'rule_id'),
    left(coalesce(p_event->>'method', ''), 12),
    v_path,
    v_username,
    v_ip,
    v_detail
  );

  return jsonb_build_object('ok', true, 'action', v_action);
end;
$$;

create or replace function public.gi_waf_admin_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.gi_waf_is_manager() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  return jsonb_build_object(
    'ok', true,
    'enabled', public.gi_waf_is_enabled(),
    'events', coalesce((
      select jsonb_agg(row_to_json(e) order by e.created_at desc)
      from (select * from public.gi_waf_events order by created_at desc limit 200) e
    ), '[]'::jsonb),
    'incidents', coalesce((
      select jsonb_agg(row_to_json(i) order by i.updated_at desc)
      from (select * from public.gi_waf_incidents order by updated_at desc limit 80) i
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(row_to_json(b))
      from public.gi_waf_blocks b
      where b.until is null or b.until > now()
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.gi_waf_ingest_event(jsonb) from public;
grant execute on function public.gi_waf_ingest_event(jsonb) to anon, authenticated;
revoke all on function public.gi_waf_admin_snapshot() from public;
grant execute on function public.gi_waf_admin_snapshot() to authenticated;
revoke all on function public.gi_waf_is_enabled() from public;
grant execute on function public.gi_waf_is_enabled() to authenticated;
revoke all on function public.gi_waf_is_manager() from public;
grant execute on function public.gi_waf_is_manager() to authenticated;
revoke all on function public.gi_waf_classify(text) from public;
revoke all on function public.gi_waf_client_ip() from public;

notify pgrst, 'reload schema';
