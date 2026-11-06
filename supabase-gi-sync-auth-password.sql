-- =============================================================================
-- GEMEL INVEST · a PIN change no longer rewrites the Auth password.
--
-- Login is the CRM PIN, then the existing Auth session. The Auth password is
-- random and is not derived from the PIN. This trigger stays in place so an
-- older install does not error, and it does not write auth.users.
-- It does not create users, change emails, or touch auth.mfa_factors.
-- =============================================================================

create or replace function public.gi_sync_agent_auth_password()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
