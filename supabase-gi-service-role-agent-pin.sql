-- =============================================================================
-- GEMEL INVEST · service_role must be able to UPDATE public.agents.pin
--
-- R9-pre-B revoked table SELECT from anon/authenticated and re-granted
-- column privileges. service_role kept SELECT but lost INSERT/UPDATE, so
-- gi-provision-agent-auth failed with:
--   permission denied for table agents
-- CRM user-edit had already saved the PIN; Auth password never updated.
-- =============================================================================

grant insert, update on table public.agents to service_role;
grant insert (pin), update (pin) on table public.agents to service_role;

notify pgrst, 'reload schema';
