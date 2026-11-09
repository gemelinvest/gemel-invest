-- =============================================================================
-- GEMEL INVEST · blank clear login codes after each hash matches.
--
-- The count on 9 Nov 2026 showed 63 active accounts, each with a hash and a
-- clear code, and none with a clear code and no hash. The screen row no
-- longer holds an admin code or authenticator material.
--
-- This file sets agents.pin to an empty string only where pin_hash matches
-- that clear code. The column refuses null. Login already checks the hash.
-- The sync trigger leaves the hash in place when the clear code is emptied.
--
-- It writes nothing unless the login function checks the hash, the sync
-- trigger keeps the hash, every active clear code has a hash, and every
-- hash matches its clear code. After the write it checks that no hash and
-- no sign-in identity changed, and that no active clear code remains.
-- If any check fails, it stops and saves nothing.
--
-- A clear code is not copied into the result and cannot be restored from
-- this file. The private admin code is not read and is not changed.
-- Accounts, customers, and settings rows are otherwise left as they are.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
-- =============================================================================

drop table if exists gi_blank_clear_pins;
create temporary table gi_blank_clear_pins (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $blank$
declare
  v_bypass boolean;
  v_login text;
  v_sync text;
  v_password_sync text;
  v_ready integer := 0;
  v_blocked integer := 0;
  v_mismatch integer := 0;
  v_blanked integer := 0;
  v_active_clear integer := 0;
  v_left integer := 0;
  v_hash_before text;
  v_hash_after text;
  v_identity_before text;
  v_identity_after text;
  v_sort integer := 100;
  rec record;
begin
  if to_regclass('public.agents') is null then
    raise exception 'agents table is missing; nothing saved';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agents'
      and column_name in ('id', 'name', 'role', 'email', 'auth_user_id', 'pin', 'pin_hash', 'active')
  ) <> 8 then
    raise exception 'agent code columns are missing; nothing saved';
  end if;

  select r.rolbypassrls or r.rolsuper
    into v_bypass
  from pg_roles r
  where r.rolname = current_user;
  if v_bypass is distinct from true then
    raise exception 'service role is required; nothing saved';
  end if;

  if to_regprocedure('extensions.crypt(text,text)') is null then
    raise exception 'hash function is missing; nothing saved';
  end if;

  if to_regprocedure('public.gi_verify_agent_login(text,text)') is null then
    raise exception 'login function is missing; nothing saved';
  end if;
  v_login := pg_get_functiondef('public.gi_verify_agent_login(text,text)'::regprocedure);
  if v_login !~ 'pin_hash' or v_login !~ 'extensions\.crypt' then
    raise exception 'login does not check the hash; nothing saved';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'public'
      and c.relname = 'agents'
      and t.tgname = 'trg_gi_sync_agent_pin_hash'
      and p.proname = 'gi_sync_agent_pin_hash'
      and not t.tgisinternal
      and t.tgenabled in ('O', 'A')
  ) then
    raise exception 'pin sync trigger is missing; nothing saved';
  end if;

  v_sync := pg_get_functiondef('public.gi_sync_agent_pin_hash()'::regprocedure);
  if v_sync !~ 'new\.pin is not null'
     or v_sync !~ 'btrim\(new\.pin\) <> '''''
     or v_sync !~ 'new\.pin_hash := extensions\.crypt' then
    raise exception 'pin sync would replace the hash; nothing saved';
  end if;

  if to_regprocedure('public.gi_sync_agent_auth_password()') is not null then
    v_password_sync := pg_get_functiondef('public.gi_sync_agent_auth_password()'::regprocedure);
    if v_password_sync ~* 'auth\.users' or v_password_sync ~* 'encrypted_password' then
      raise exception 'a pin change still rewrites the auth password; nothing saved';
    end if;
  end if;

  select count(*)
    into v_blocked
  from public.agents
  where coalesce(active, true)
    and nullif(btrim(coalesce(pin, '')), '') is not null
    and nullif(btrim(coalesce(pin_hash, '')), '') is null;
  if v_blocked > 0 then
    raise exception 'an active account has a clear code and no hash; nothing saved';
  end if;

  select count(*)
    into v_mismatch
  from public.agents
  where nullif(btrim(coalesce(pin, '')), '') is not null
    and nullif(btrim(coalesce(pin_hash, '')), '') is not null
    and extensions.crypt(btrim(pin), pin_hash) is distinct from pin_hash;
  if v_mismatch > 0 then
    raise exception 'a stored hash does not match its clear code; nothing saved';
  end if;

  select count(*)
    into v_ready
  from public.agents
  where nullif(btrim(coalesce(pin, '')), '') is not null
    and nullif(btrim(coalesce(pin_hash, '')), '') is not null
    and extensions.crypt(btrim(pin), pin_hash) = pin_hash;

  select md5(coalesce(string_agg(id::text || ':' || pin_hash, '|' order by id::text), ''))
    into v_hash_before
  from public.agents
  where nullif(btrim(coalesce(pin_hash, '')), '') is not null;

  select md5(coalesce(string_agg(
    id::text || ':' || coalesce(auth_user_id::text, '') || ':' || btrim(coalesce(email, '')),
    '|' order by id::text
  ), ''))
    into v_identity_before
  from public.agents;

  if v_ready > 0 then
    update public.agents
       set pin = ''
     where nullif(btrim(coalesce(pin, '')), '') is not null
       and nullif(btrim(coalesce(pin_hash, '')), '') is not null
       and extensions.crypt(btrim(pin), pin_hash) = pin_hash;
    get diagnostics v_blanked = row_count;
  end if;

  if v_blanked <> v_ready then
    raise exception 'the blanked count does not match; nothing saved';
  end if;

  select md5(coalesce(string_agg(id::text || ':' || pin_hash, '|' order by id::text), ''))
    into v_hash_after
  from public.agents
  where nullif(btrim(coalesce(pin_hash, '')), '') is not null;
  if v_hash_before is distinct from v_hash_after then
    raise exception 'a hash changed; nothing saved';
  end if;

  select md5(coalesce(string_agg(
    id::text || ':' || coalesce(auth_user_id::text, '') || ':' || btrim(coalesce(email, '')),
    '|' order by id::text
  ), ''))
    into v_identity_after
  from public.agents;
  if v_identity_before is distinct from v_identity_after then
    raise exception 'a sign-in identity changed; nothing saved';
  end if;

  select count(*)
    into v_active_clear
  from public.agents
  where coalesce(active, true)
    and nullif(btrim(coalesce(pin, '')), '') is not null;
  if v_active_clear > 0 then
    raise exception 'an active clear code remained; nothing saved';
  end if;

  select count(*)
    into v_left
  from public.agents
  where nullif(btrim(coalesce(pin, '')), '') is not null;

  insert into gi_blank_clear_pins(sort_key, section, detail) values
    (1, 'ready', v_ready::text),
    (2, 'blanked', v_blanked::text),
    (3, 'active_clear_remaining', v_active_clear::text),
    (4, 'left_without_hash', v_left::text),
    (5, 'hashes_unchanged', 'yes'),
    (6, 'identity_unchanged', 'yes'),
    (7, 'changed', case when v_blanked > 0 then 'yes' else 'no' end);

  for rec in
    select
      btrim(coalesce(name, '')) as agent_name,
      btrim(coalesce(role, '')) as agent_role,
      id::text as agent_id
    from public.agents
    where nullif(btrim(coalesce(pin, '')), '') is not null
    order by 1, 3
  loop
    v_sort := v_sort + 1;
    insert into gi_blank_clear_pins(sort_key, section, detail)
    values (v_sort, 'left_clear', rec.agent_name || '|' || rec.agent_role || '|' || rec.agent_id);
  end loop;
end
$blank$;

select section, detail
from gi_blank_clear_pins
order by sort_key, detail;
