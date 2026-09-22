-- =============================================================================
-- GEMEL INVEST · service_role must be able to UPDATE public.agents.pin
--
-- R9-pre-B revoked table SELECT from anon/authenticated and re-granted
-- column privileges. service_role kept SELECT but lost INSERT/UPDATE, so
-- gi-provision-agent-auth failed with:
--   permission denied for table agents
-- After forcing service_role on the Edge Function fetch:
--   GET /auth/v1/user → 403 invalid claim: missing sub claim
--   RPC gi_verify_agent_login → permission denied for function
--   (EXECUTE had been granted only to anon/authenticated)
-- =============================================================================

grant insert, update on table public.agents to service_role;
grant insert (pin), update (pin) on table public.agents to service_role;
grant execute on function public.gi_verify_agent_login(text, text) to service_role;

notify pgrst, 'reload schema';
