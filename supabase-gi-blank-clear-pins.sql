-- GEMEL INVEST · blank clear login codes where the hash matches.
-- agents.pin becomes ''. The column refuses null. Login checks the hash.
-- The sign-in lock is paused for this write and turned back on.
-- Nothing is saved unless every check passes. The paste must end with
-- order by sort_key, detail;
-- If it errors, paste the ERROR line and leave out the DETAIL row.

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
  v_lock boolean := false;
  v_sort integer := 100;
  rec record;
begin
  if to_regclass('public.agents') is null then
    raise exception 'agents table is missing; nothing saved';
  end if;

  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'agents'
      and column_name in ('id', 'name', 'role', 'email', 'auth_user_id', 'pin', 'pin_hash', 'active')
  ) <> 8 then
    raise exception 'agent code columns are missing; nothing saved';
  end if;

  select r.rolbypassrls or r.rolsuper into v_bypass
  from pg_roles r where r.rolname = current_user;
  if v_bypass is distinct from true then
    raise exception 'service role is required; nothing saved';
  end if;

  drop view if exists gi_pin_state;
  create temporary view gi_pin_state as
  select
    id,
    btrim(coalesce(name, '')) as agent_name,
    btrim(coalesce(role, '')) as agent_role,
    coalesce(active, true) as is_active,
    nullif(btrim(coalesce(pin, '')), '') is not null as has_pin,
    nullif(btrim(coalesce(pin_hash, '')), '') is not null as has_hash,
    (
      nullif(btrim(coalesce(pin_hash, '')), '') is not null
      and extensions.crypt(btrim(pin), pin_hash) = pin_hash
    ) as matches
  from public.agents;

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
    where n.nspname = 'public' and c.relname = 'agents'
      and t.tgname = 'trg_gi_sync_agent_pin_hash'
      and p.proname = 'gi_sync_agent_pin_hash'
      and not t.tgisinternal and t.tgenabled in ('O', 'A')
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

  select count(*) into v_blocked from gi_pin_state
  where is_active and has_pin and not has_hash;
  if v_blocked > 0 then
    raise exception 'an active account has a clear code and no hash; nothing saved';
  end if;
  select count(*) into v_mismatch from gi_pin_state
  where has_pin and has_hash and not matches;
  if v_mismatch > 0 then
    raise exception 'a stored hash does not match its clear code; nothing saved';
  end if;
  select count(*) into v_ready from gi_pin_state where has_pin and matches;

  select md5(coalesce(string_agg(id::text || ':' || pin_hash, '|' order by id::text), ''))
    into v_hash_before from public.agents
  where nullif(btrim(coalesce(pin_hash, '')), '') is not null;
  select md5(coalesce(string_agg(
    id::text || ':' || coalesce(auth_user_id::text, '') || ':' || btrim(coalesce(email, '')),
    '|' order by id::text), ''))
    into v_identity_before from public.agents;

  select exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'agents'
      and t.tgname = 'trg_gi_lock_agent_auth_identity' and not t.tgisinternal
  ) into v_lock;

  if v_ready > 0 then
    if v_lock then
      alter table public.agents disable trigger trg_gi_lock_agent_auth_identity;
    end if;
    update public.agents a
       set pin = ''
      from gi_pin_state s
     where a.id::text = s.id::text and s.has_pin and s.matches;
    get diagnostics v_blanked = row_count;
    if v_lock then
      alter table public.agents enable trigger trg_gi_lock_agent_auth_identity;
    end if;
  end if;

  if v_lock and not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'agents'
      and t.tgname = 'trg_gi_lock_agent_auth_identity'
      and not t.tgisinternal and t.tgenabled in ('O', 'A')
  ) then
    raise exception 'sign-in lock was left off; nothing saved';
  end if;
  if v_blanked <> v_ready then
    raise exception 'the blanked count does not match; nothing saved';
  end if;

  select md5(coalesce(string_agg(id::text || ':' || pin_hash, '|' order by id::text), ''))
    into v_hash_after from public.agents
  where nullif(btrim(coalesce(pin_hash, '')), '') is not null;
  if v_hash_before is distinct from v_hash_after then
    raise exception 'a hash changed; nothing saved';
  end if;
  select md5(coalesce(string_agg(
    id::text || ':' || coalesce(auth_user_id::text, '') || ':' || btrim(coalesce(email, '')),
    '|' order by id::text), ''))
    into v_identity_after from public.agents;
  if v_identity_before is distinct from v_identity_after then
    raise exception 'a sign-in identity changed; nothing saved';
  end if;

  select count(*) into v_active_clear from gi_pin_state where is_active and has_pin;
  if v_active_clear > 0 then
    raise exception 'an active clear code remained; nothing saved';
  end if;
  select count(*) into v_left from gi_pin_state where has_pin;

  insert into gi_blank_clear_pins(sort_key, section, detail) values
    (1, 'ready', v_ready::text),
    (2, 'blanked', v_blanked::text),
    (3, 'active_clear_remaining', v_active_clear::text),
    (4, 'left_without_hash', v_left::text),
    (5, 'hashes_unchanged', 'yes'),
    (6, 'identity_unchanged', 'yes'),
    (7, 'changed', case when v_blanked > 0 then 'yes' else 'no' end);

  for rec in
    select agent_name, agent_role, id::text as agent_id
    from gi_pin_state where has_pin order by 1, 3
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
