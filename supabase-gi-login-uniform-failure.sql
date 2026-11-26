-- =============================================================================
-- GEMEL INVEST · gi_verify_agent_login — one failure for a missing or disabled user
--
-- Apply once in the Supabase SQL editor AFTER supabase-gi-login-lock-five.sql,
-- on the development database first.
--
-- A missing name and a disabled user now return BAD_PIN, the same code as a
-- wrong PIN. The reply waits until 650ms so the missing name is not the fast
-- answer. Neither case is written to gi_login_attempts.
--
-- Unchanged: a correct PIN, the 15-minute lock, the last-attempt warning,
-- an ambiguous name, and the kill switch. The function still does not return
-- pin or pin_hash. It stays security definer because login has to read the
-- PIN hash before a session exists.
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
  v_ip text;
  v_enabled boolean;
  v_threshold int := 5;
  v_lock_min int := 15;
  v_rec record;
  v_retry_after int;
  v_pin_match boolean;
  v_failed int := 0;
  v_started timestamptz := clock_timestamp();
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

  -- Lock check (only when enabled). A lock stays a distinct answer.
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

  select count(*)::int into match_count
    from public.agents a
    where coalesce(a.active, true) = true
    and (
      trim(both from coalesce(a.username, '')) = uname
      or trim(both from coalesce(a.name, '')) = uname
    );

  -- Missing and disabled users are not counted. The dummy hash plus the wait
  -- makes this path take as long as a real PIN check.
  if match_count = 0 then
    perform extensions.crypt(upin, '$2a$06$012345678901234567890u');
    perform pg_sleep(greatest(0, extract(epoch from (v_started + interval '650 milliseconds' - clock_timestamp()))));
    return jsonb_build_object('ok', false, 'error', 'BAD_PIN');
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
        v_failed := 1;
      else
        v_failed := coalesce(v_rec.failed_count, 0) + 1;
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
      if v_failed >= v_threshold then
        return jsonb_build_object('ok', false, 'error', 'LOCKED', 'retry_after', v_lock_min * 60);
      end if;
      if v_failed = v_threshold - 1 then
        perform pg_sleep(greatest(0, extract(epoch from (v_started + interval '650 milliseconds' - clock_timestamp()))));
        return jsonb_build_object('ok', false, 'error', 'BAD_PIN', 'attempts_left', 1);
      end if;
    end if;
    perform pg_sleep(greatest(0, extract(epoch from (v_started + interval '650 milliseconds' - clock_timestamp()))));
    return jsonb_build_object('ok', false, 'error', 'BAD_PIN');
  end if;

  -- Success: clear attempts for this username+ip only. No added wait.
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
grant execute on function public.gi_verify_agent_login(text, text) to service_role;

notify pgrst, 'reload schema';
