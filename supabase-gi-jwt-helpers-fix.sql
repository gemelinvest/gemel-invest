-- =============================================================================
-- GEMEL INVEST · JWT helpers fix (Pג-2, additive, zero-risk)
-- gi_jwt_agent_id() / gi_jwt_is_manager() currently fall back to user_metadata,
-- which is user-editable in Supabase -> privilege-escalation risk.
--
-- This migration reprioritizes secure sources:
--   1. app_metadata (set by the server, not user-editable) — preferred
--   2. agents.role / agents.id via auth_user_id lookup (DB, authoritative)
--   3. user_metadata — kept ONLY as a last-resort backward-compat so no
--      existing manager loses access. Will be removed in a later gated
--      step once all managers are verified to have app_metadata or a linked
--      agents row.
--
-- Additive: the proposals policies that call these helpers keep working.
-- No manager loses access (user_metadata remains a fallback). The secure
-- sources are simply preferred.
--
-- Apply once in Supabase SQL Editor. Supersedes the definitions in
-- supabase-proposals-rls-fix.sql with the same signatures.
-- =============================================================================

create or replace function public.gi_jwt_agent_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(auth.jwt() -> 'app_metadata' ->> 'agent_id'), ''),
    (select a.id from public.agents a where a.auth_user_id = auth.uid() limit 1),
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'agent_id'), ''),
    nullif(trim(auth.jwt() -> 'app_metadata' ->> 'agentId'), ''),
    nullif(trim(auth.uid()::text), '')
  );
$$;

create or replace function public.gi_jwt_is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(
    nullif(trim(auth.jwt() -> 'app_metadata' ->> 'role'), ''),
    (select lower(coalesce(a.role, '')) from public.agents a where a.auth_user_id = auth.uid() limit 1),
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'role'), ''),
    ''
  )) in ('admin', 'owner', 'manager', 'adminlite', 'מנהל');
$$;

notify pgrst, 'reload schema';

-- =============================================================================
-- LATER (gated) — once all managers are verified to have app_metadata.role OR a
-- linked agents row, drop the user_metadata fallback entirely:
--
--   create or replace function public.gi_jwt_agent_id()
--   returns text language sql stable security definer set search_path=public as $$
--     select coalesce(
--       nullif(trim(auth.jwt() -> 'app_metadata' ->> 'agent_id'), ''),
--       (select a.id from public.agents a where a.auth_user_id = auth.uid() limit 1),
--       nullif(trim(auth.uid()::text), '')
--     );
--   $$;
--
--   create or replace function public.gi_jwt_is_manager()
--   returns boolean language sql stable security definer set search_path=public as $$
--     select lower(coalesce(
--       nullif(trim(auth.jwt() -> 'app_metadata' ->> 'role'), ''),
--       (select lower(coalesce(a.role, '')) from public.agents a where a.auth_user_id = auth.uid() limit 1),
--       ''
--     )) in ('admin', 'owner', 'manager', 'adminlite', 'מנהל');
--   $$;
-- =============================================================================
