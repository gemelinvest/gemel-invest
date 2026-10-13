-- =============================================================================
-- GEMEL INVEST · keep Auth password in sync when agents.pin changes
--
-- MFA login signs into Supabase Auth with the CRM PIN (or gi-v1 derived from
-- that PIN + the Auth email). Updating agents.pin / pin_hash without rewriting
-- auth.users.encrypted_password left the old Auth secret in place, so the
-- login screen reported "wrong password / user not found" even though
-- gi_verify_agent_login already accepted the new PIN.
--
-- This trigger rewrites ONLY the password hash of the linked Auth user.
-- It does not create users, change emails, or touch auth.mfa_factors
-- (existing TOTP barcodes stay exactly as they are).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

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
  v_user := coalesce(
    new.auth_user_id,
    public.gi_pick_agent_auth_user(new.id, new.email, new.auth_user_id)
  );
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

  -- Same formula as app.js deriveGiAuthPassword / gi-provision-agent-auth.
  v_derived := 'GiCrm!' || btrim(new.pin) || '#' || v_email || '!v1';

  update auth.users
    set encrypted_password = extensions.crypt(v_derived, extensions.gen_salt('bf', 10)),
        updated_at = now()
    where id = v_user;

  return new;
end;
$$;

drop trigger if exists trg_gi_sync_agent_auth_password on public.agents;
create trigger trg_gi_sync_agent_auth_password
  after insert or update of pin on public.agents
  for each row
  execute function public.gi_sync_agent_auth_password();

revoke all on function public.gi_sync_agent_auth_password() from public;

notify pgrst, 'reload schema';
