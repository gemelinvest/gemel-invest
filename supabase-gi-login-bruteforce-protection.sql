-- =============================================================================
-- GEMEL INVEST · gi_verify_agent_login — brute-force protection (additive)
-- Track A / Step A2. Zero login-risk: success path unchanged; only BAD_PIN now
-- also records an attempt, and a LOCKED check is added at the start.
--
-- Apply once in Supabase SQL Editor (after supabase-gi-verify-agent-login.sql).
-- Supersedes the original gi_verify_agent_login with the same success behavior.
--
-- Kill switch: set gi_security_settings.login_bruteforce_enabled = 'false'
-- (via service role) to disable protection instantly — reverts to original.
--
-- Only BAD_PIN is counted (not USER_NOT_FOUND) to prevent an attacker from
-- locking out a legitimate username by spamming wrong usernames.
-- =============================================================================

-- Attempts tracking table (private — only the security definer function
-- and service_role touch it; anon/authenticated have no access).
create table if not exists public.gi_login_attempts (
  id bigserial primary key,
  username text not null,
  ip text not null default 'unknown',
  failed_count int not null default 0,
  first_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now(),
  locked_until timestamptz
);

drop index if exists public.gi_login_attempts_lookup_idx;
create unique index if not exists gi_login_attempts_lookup_idx
  on public.gi_login_attempts (username, ip);

alter table public.gi_login_attempts enable row level security;
revoke all on public.gi_login_attempts from anon, authenticated;
grant all on public.gi_login_attempts to service_role;

-- Security settings / kill switch (private; service_role can toggle).
create table if not exists public.gi_security_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.gi_security_settings enable row level security;
revoke all on public.gi_security_settings from anon, authenticated;
grant all on public.gi_security_settings to service_role;

insert into public.gi_security_settings (key, value) values
  ('login_bruteforce_enabled', 'true')
on conflict (key) do nothing;

-- Redefine the login RPC with additive brute-force protection.
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
  v_ip text;
  v_enabled boolean;
  v_threshold int := 10;
  v_lock_min int := 15;
  v_rec record;
  v_retry_after int;
begin
  if uname = '' or upin = '' then
    return jsonb_build_object('ok', false, 'error', 'MISSING_CREDENTIALS');
  end if;

  -- Kill switch (default ON if row missing).
  select (s.value = 'true') into v_enabled
    from public.gi_security_settings s where s.key = 'login_bruteforce_enabled';
  v_enabled := coalesce(v_enabled, true);

  -- Client IP (first hop of x-forwarded-for; 'unknown' if missing).
  v_ip := trim(both from split_part(coalesce(current_setting('request.header.x-forwarded-for', true), ''), ',', 1));
  if v_ip = '' then v_ip := 'unknown'; end if;

  -- Lock check (only when enabled).
  if v_enabled then
    select * into v_rec from public.gi_login_attempts
      where username = uname and ip = v_ip for update;

    if v_rec is not null then
      -- Reset if a previous lock has expired.
      if v_rec.locked_until is not null and v_rec.locked_until <= now() then
        update public.gi_login_attempts
          set failed_count = 0, locked_until = null, last_attempt_at = now()
          where username = uname and ip = v_ip;
        v_rec.failed_count := 0;
        v_rec.locked_until := null;
      end if;

      -- Still locked?
      if v_rec.locked_until is not null and v_rec.locked_until > now() then
        v_retry_after := ceil(extract(epoch from (v_rec.locked_until - now())));
        if v_retry_after is null or v_retry_after < 1 then v_retry_after := 1; end if;
        return jsonb_build_object('ok', false, 'error', 'LOCKED', 'retry_after', v_retry_after);
      end if;
    end if;
  end if;

  -- Existing username resolution (unchanged).
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
    -- Record the failed attempt (additive; only when enabled).
    if v_enabled then
      if v_rec is null then
        insert into public.gi_login_attempts (username, ip, failed_count, first_attempt_at, last_attempt_at)
          values (uname, v_ip, 1, now(), now());
      else
        update public.gi_login_attempts
          set failed_count = failed_count + 1,
              last_attempt_at = now(),
              locked_until = case
                when failed_count + 1 >= v_threshold
                  then now() + (v_lock_min || ' minutes')::interval
                else locked_until
              end
          where username = uname and ip = v_ip;
      end if;
    end if;
    return jsonb_build_object('ok', false, 'error', 'BAD_PIN');
  end if;

  -- Success: clear attempts for this username+ip (additive).
  if v_enabled then
    delete from public.gi_login_attempts where username = uname and ip = v_ip;
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
