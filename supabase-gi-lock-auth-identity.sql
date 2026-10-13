-- =============================================================================
-- GEMEL INVEST · lock one Auth identity per agent
--
-- Login, PIN sync, and session-open must all use the SAME Auth user: the one
-- that holds the verified TOTP barcode (real work email), never a leftover
-- agent+…@gemel-invest.internal row from provision_missing.
--
-- This does NOT create users, change emails on auth.users, or touch
-- auth.mfa_factors (existing TOTP barcodes stay exactly as they are).
-- =============================================================================

create or replace function public.gi_pick_agent_auth_user(
  p_agent_id text,
  p_agent_email text,
  p_linked uuid
) returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select c.id
  from (
    select
      u.id,
      case
        when exists (
          select 1 from auth.mfa_factors f
          where f.user_id = u.id
            and f.status = 'verified'
            and f.factor_type = 'totp'
        ) and u.email not ilike '%@gemel-invest.internal' then 1
        when coalesce(p_agent_email, '') <> ''
          and lower(btrim(u.email)) = lower(btrim(p_agent_email))
          and u.email not ilike '%@gemel-invest.internal' then 2
        when exists (
          select 1 from auth.mfa_factors f
          where f.user_id = u.id
            and f.status = 'verified'
            and f.factor_type = 'totp'
        ) then 3
        when u.email not ilike '%@gemel-invest.internal' then 4
        when p_linked is not null and u.id = p_linked then 5
        else 6
      end as pref
    from auth.users u
    where coalesce(p_agent_id, '') <> ''
      and (
        (p_linked is not null and u.id = p_linked)
        or (
          coalesce(p_agent_email, '') <> ''
          and lower(btrim(u.email)) = lower(btrim(p_agent_email))
        )
        or coalesce(u.raw_app_meta_data->>'agent_id', '') = p_agent_id
        or lower(u.email) = ('agent+'
          || regexp_replace(lower(p_agent_id), '[^a-z0-9]', '', 'g')
          || '@gemel-invest.internal')
      )
  ) c
  order by c.pref, c.id
  limit 1;
$$;

create or replace function public.gi_lock_agent_auth_row()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_pick uuid;
  v_email text;
begin
  v_pick := public.gi_pick_agent_auth_user(new.id, new.email, new.auth_user_id);
  if v_pick is not null then
    new.auth_user_id := v_pick;
    select lower(btrim(u.email)) into v_email
      from auth.users u
      where u.id = v_pick;
    if v_email is not null
      and v_email not like '%@gemel-invest.internal'
      and coalesce(btrim(new.email), '') = '' then
      new.email := v_email;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_gi_lock_agent_auth_identity on public.agents;
create trigger trg_gi_lock_agent_auth_identity
  before insert or update on public.agents
  for each row
  execute function public.gi_lock_agent_auth_row();

create or replace function public.gi_lock_agent_auth_identity(p_agent_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  r public.agents%rowtype;
  v_pick uuid;
  v_email text;
  v_relinked boolean := false;
begin
  select * into r from public.agents where id = p_agent_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'AGENT_NOT_FOUND');
  end if;

  v_pick := public.gi_pick_agent_auth_user(r.id, r.email, r.auth_user_id);
  if v_pick is null then
    return jsonb_build_object(
      'ok', true,
      'auth_user_id', r.auth_user_id,
      'email', nullif(lower(btrim(coalesce(r.email, ''))), ''),
      'relinked', false
    );
  end if;

  select lower(btrim(email)) into v_email from auth.users where id = v_pick;

  if r.auth_user_id is distinct from v_pick
    or (
      v_email is not null
      and v_email not like '%@gemel-invest.internal'
      and coalesce(btrim(r.email), '') = ''
    ) then
    update public.agents
      set auth_user_id = v_pick,
          email = case
            when v_email is not null
              and v_email not like '%@gemel-invest.internal'
              and coalesce(btrim(email), '') = '' then v_email
            else email
          end,
          updated_at = now()
      where id = p_agent_id;
    v_relinked := true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'auth_user_id', v_pick,
    'email', v_email,
    'relinked', v_relinked
  );
end;
$$;

-- Keep the PIN → Auth password trigger, writing onto the locked identity.
create or replace function public.gi_sync_agent_auth_password()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text;
  v_derived text;
  v_user uuid;
begin
  if TG_OP = 'UPDATE' and new.pin is not distinct from old.pin then
    return new;
  end if;
  v_user := coalesce(new.auth_user_id, public.gi_pick_agent_auth_user(new.id, new.email, new.auth_user_id));
  if v_user is null then
    return new;
  end if;
  if new.pin is null or btrim(new.pin) = '' then
    return new;
  end if;

  select lower(btrim(u.email)) into v_email
    from auth.users u
    where u.id = v_user;
  if v_email is null or v_email = '' then
    return new;
  end if;

  v_derived := 'GiCrm!' || btrim(new.pin) || '#' || v_email || '!v1';

  update auth.users
    set encrypted_password = extensions.crypt(v_derived, extensions.gen_salt('bf', 10)),
        updated_at = now()
    where id = v_user;

  return new;
end;
$$;

revoke all on function public.gi_pick_agent_auth_user(text, text, uuid) from public;
revoke all on function public.gi_lock_agent_auth_row() from public;
revoke all on function public.gi_lock_agent_auth_identity(text) from public;
revoke all on function public.gi_sync_agent_auth_password() from public;

grant execute on function public.gi_pick_agent_auth_user(text, text, uuid) to service_role;
grant execute on function public.gi_lock_agent_auth_identity(text) to service_role;
