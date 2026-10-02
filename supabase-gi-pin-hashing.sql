-- =============================================================================
-- GEMEL INVEST · PIN hashing (dual-run, zero login-risk)
-- Tiny fix for the PIN-leak finding: agents.pin is stored in clear text today.
-- This migration hashes PINs WITHOUT resetting any agent's PIN:
--   1. add a pin_hash column (nullable)
--   2. redefine gi_verify_agent_login to dual-run:
--        if pin_hash is not null -> compare crypt(entered, pin_hash) = pin_hash
--        else -> existing clear-text compare (unchanged behavior)
--   3. (separate, optional) backfill pin_hash = crypt(pin, gen_salt('bf'))
--   4. (separate, later) NULL the pin column once pin_hash is verified
--
-- Because the client-side fallback no longer reads agents.pin from REST
-- (R9-pre-B already hid it), hashing the DB pin does NOT break the fallback.
--
-- Kill switch: the dual-run reverts to clear-text automatically if pin_hash
-- is NULL. To force-revert: update agents set pin_hash = null;
-- (the clear-text pin column is left intact until step 4).
--
-- Apply once in Supabase SQL Editor (after supabase-gi-login-bruteforce-protection.sql).
-- Supersedes the brute-force version with the same success + lock behavior,
-- adding only the dual-run hash compare.
-- =============================================================================

-- pgcrypto provides crypt() and gen_salt(). Supabase ships it in `extensions`.
create extension if not exists pgcrypto with schema extensions;

-- Add the hash column (nullable so dual-run works before backfill).
alter table public.agents
  add column if not exists pin_hash text;

-- Hide pin_hash from REST (same treatment as pin in R9-pre-B).
-- AGENT_PUBLIC_COLUMNS already excludes pin; ensure pin_hash is excluded too.
-- (If AGENT_PUBLIC_COLUMNS is managed as a literal list elsewhere, also add
--  'pin_hash' there. The revoke below is a defense-in-depth backstop.)
revoke select (pin_hash) on public.agents from anon, authenticated;

-- Redefine the login RPC: brute-force protection (from #398) + dual-run PIN hash.
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
  v_pin_match boolean;
begin
  if uname = '' or upin = '' then
    return jsonb_build_object('ok', false, 'error', 'MISSING_CREDENTIALS');
  end if;

  -- Kill switch for brute-force (default ON if row missing).
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
      if v_rec.locked_until is not null and v_rec.locked_until <= now() then
        update public.gi_login_attempts
          set failed_count = 0, locked_until = null, last_attempt_at = now()
          where username = uname and ip = v_ip;
        v_rec.failed_count := 0;
        v_rec.locked_until := null;
      end if;

      if v_rec.locked_until is not null and v_rec.locked_until > now() then
        v_retry_after := ceil(extract(epoch from (v_rec.locked_until - now())));
        if v_retry_after is null or v_retry_after < 1 then v_retry_after := 1; end if;
        return jsonb_build_object('ok', false, 'error', 'LOCKED', 'retry_after', v_retry_after);
      end if;
    end if;
  end if;

  -- Username resolution (unchanged).
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

  -- Dual-run PIN compare: hash if present, else clear-text (unchanged).
  if ag.pin_hash is not null then
    v_pin_match := (extensions.crypt(upin, ag.pin_hash) = ag.pin_hash);
  else
    v_pin_match := (trim(both from coalesce(ag.pin, '0000')) = upin);
  end if;

  if not v_pin_match then
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

  -- Success: clear attempts (additive).
  if v_enabled then
    delete from public.gi_login_attempts where username = uname and ip = v_ip;
  end if;

  -- Never return the pin or pin_hash.
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

-- =============================================================================
-- BACKFILL (run separately AFTER the RPC change is deployed, to populate
-- pin_hash from existing clear-text pins). No agent needs a new PIN.
--
--   update public.agents
--     set pin_hash = extensions.crypt(coalesce(pin, ''), extensions.gen_salt('bf', 8))
--     where pin_hash is null and coalesce(pin, '') <> '';
--
-- Verify a few agents can still log in with their existing PIN. If yes, proceed.
--
-- (LATER, optional) Once pin_hash is populated for all active agents and login
-- is verified, clear the clear-text column:
--   update public.agents set pin = null where pin_hash is not null;
-- =============================================================================

-- EMERGENCY REVERT (run in SQL Editor if login breaks):
--   update public.agents set pin_hash = null;
--   (clear-text pin column is intact; dual-run falls back to it instantly)
-- =============================================================================
