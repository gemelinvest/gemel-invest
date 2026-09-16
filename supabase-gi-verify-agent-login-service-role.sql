-- =============================================================================
-- GEMEL INVEST · grant gi_verify_agent_login to service_role
--
-- Root cause: supabase-gi-verify-agent-login.sql revoked EXECUTE from public and
-- re-granted it to anon + authenticated only. Edge Functions run with the
-- service role, so every server-side call returned "permission denied for
-- function gi_verify_agent_login". That silently broke:
--   * gi-provision-agent-auth  — manager gate fell through to "אין הרשאה"
--   * gi-daily-sales-mail      — requireUiActor PIN branch
--
-- Why this adds no exposure: service_role already bypasses RLS and can read
-- public.agents.pin directly. A verify-only function that never returns the pin
-- is strictly less powerful than what the role can already do.
--
-- Apply once in Supabase SQL Editor.
-- =============================================================================

grant execute on function public.gi_verify_agent_login(text, text) to service_role;

notify pgrst, 'reload schema';
