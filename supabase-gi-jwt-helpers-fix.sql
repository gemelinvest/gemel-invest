-- =============================================================================
-- GEMEL INVEST · JWT helpers fix (Pג-2, additive, zero-risk)
-- gi_jwt_agent_id() and gi_jwt_is_manager() read app_metadata, then the
-- agents row linked by auth_user_id. user_metadata is not read.
--
-- The wide signed-in policies stay, so replacing these functions does not
-- hide rows. Identity comes from app_metadata, then the linked agents row.
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
    ''
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
    ''
  )) in ('admin', 'owner', 'manager', 'adminlite', 'מנהל');
$$;

notify pgrst, 'reload schema';
