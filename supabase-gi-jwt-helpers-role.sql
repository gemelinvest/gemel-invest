-- =============================================================================
-- GEMEL INVEST · gi_jwt_role() — additive helper (complements supabase-gi-jwt-helpers-fix.sql)
-- Returns the actor's role from app_metadata, then the linked agents row.
-- user_metadata is not read. Used by the role policies for ops, opsAgent,
-- teamManager, and elementary.
--
-- Apply once in Supabase SQL Editor AFTER supabase-gi-jwt-helpers-fix.sql.
-- Safe, additive, security definer. No behavior change until Pה.
-- =============================================================================
create or replace function public.gi_jwt_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(
    nullif(trim(auth.jwt() -> 'app_metadata' ->> 'role'), ''),
    (select lower(coalesce(a.role, '')) from public.agents a where a.auth_user_id = auth.uid() limit 1),
    ''
  ));
$$;

revoke all on function public.gi_jwt_role() from public;
grant execute on function public.gi_jwt_role() to authenticated;

notify pgrst, 'reload schema';
