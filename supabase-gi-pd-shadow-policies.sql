-- =============================================================================
-- GEMEL INVEST · Pד — shadow RLS policies for authenticated (Track C)
-- Purpose: write the TARGET per-role policies for authenticated so that
-- Pה (anon cutoff) only needs to flip a switch. Until Pה, the open
-- 'allow all customers' policy still overrides these (RLS ORs), so these
-- restrictive policies are INERT today — they change nothing. This is the safe,
-- zero-risk Pד step.
--
-- Role matrix (from docs/CRM_SECURITY_PROGRAM.md §5):
--   admin/manager/ops/opsAgent -> all customers
--   teamManager          -> self + team (team_manager_id = self OR agent_id = self)
--   agent                -> own (agent_id = self)
--   elementary           -> elementary pool (role = 'elementary')
--   referent             -> dedicated (deferred to a follow-up; kept open here)
--
-- NOTE: 'allow all customers' (USING true, applies to anon AND authenticated) is left intact, so
-- nothing changes today. Pה will drop it for authenticated to activate these.
-- Apply once in Supabase SQL Editor. Safe to run now (inert until Pה).
-- =============================================================================

-- SELECT: managers/ops/opsAgent see all; teamManager sees self+team; agent sees own;
-- elementary sees the elementary pool; referent stays open (deferred).
drop policy if exists "customers_select_own_shadow" on public.customers;
create policy "customers_select_own_shadow"
  on public.customers
  for select
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and coalesce(role, '') in ('ops', 'opsAgent'))
     or (public.gi_jwt_agent_id() <> '' and agent_id = public.gi_jwt_agent_id())
     or (
          public.gi_jwt_agent_id() <> ''
          and exists (
            select 1 from public.agents a
            where a.id = public.gi_jwt_agent_id()
              and coalesce(a.role, '') = 'teamManager'
          )
          and (
            agent_id = public.gi_jwt_agent_id()
            or coalesce(team_manager_id, '') = public.gi_jwt_agent_id()
          )
     )
     or (
          public.gi_jwt_agent_id() <> ''
          and coalesce(role, '') = 'elementary'
          and (coalesce(agent_id, '') = '' or agent_id is null)
     )
  );

-- INSERT: same scope.
drop policy if exists "customers_insert_own_shadow" on public.customers;
create policy "customers_insert_own_shadow"
  on public.customers
  for insert
  to authenticated
  with check (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and coalesce(role, '') in ('ops', 'opsAgent'))
     or (public.gi_jwt_agent_id() <> '' and agent_id = public.gi_jwt_agent_id())
     or (
          public.gi_jwt_agent_id() <> ''
          and exists (
            select 1 from public.agents a
            where a.id = public.gi_jwt_agent_id()
              and coalesce(a.role, '') = 'teamManager'
          )
          and (
            agent_id = public.gi_jwt_agent_id()
            or coalesce(team_manager_id, '') = public.gi_jwt_agent_id()
          )
     )
     or (
          public.gi_jwt_agent_id() <> ''
          and coalesce(role, '') = 'elementary'
          and (coalesce(agent_id, '') = '' or agent_id is null)
     )
  );

-- UPDATE: same scope.
drop policy if exists "customers_update_own_shadow" on public.customers;
create policy "customers_update_own_shadow"
  on public.customers
  for update
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and coalesce(role, '') in ('ops', 'opsAgent'))
     or (public.gi_jwt_agent_id() <> '' and agent_id = public.gi_jwt_agent_id())
     or (
          public.gi_jwt_agent_id() <> ''
          and exists (
            select 1 from public.agents a
            where a.id = public.gi_jwt_agent_id()
              and coalesce(a.role, '') = 'teamManager'
          )
          and (
            agent_id = public.gi_jwt_agent_id()
            or coalesce(team_manager_id, '') = public.gi_jwt_agent_id()
          )
     )
     or (
          public.gi_jwt_agent_id() <> ''
          and coalesce(role, '') = 'elementary'
          and (coalesce(agent_id, '') = '' or agent_id is null)
     )
  )
  with check (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and coalesce(role, '') in ('ops', 'opsAgent'))
     or (public.gi_jwt_agent_id() <> '' and agent_id = public.gi_jwt_agent_id())
     or (
          public.gi_jwt_agent_id() <> ''
          and exists (
            select 1 from public.agents a
            where a.id = public.gi_jwt_agent_id()
              and coalesce(a.role, '') = 'teamManager'
          )
          and (
            agent_id = public.gi_jwt_agent_id()
            or coalesce(team_manager_id, '') = public.gi_jwt_agent_id()
          )
     )
     or (
          public.gi_jwt_agent_id() <> ''
          and coalesce(role, '') = 'elementary'
          and (coalesce(agent_id, '') = '' or agent_id is null)
     )
  );

-- DELETE: managers/ops/opsAgent all; agent owns; teamManager owns team; elementary pool.
drop policy if exists "customers_delete_own_shadow" on public.customers;
create policy "customers_delete_own_shadow"
  on public.customers
  for delete
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and coalesce(role, '') in ('ops', 'opsAgent'))
     or (public.gi_jwt_agent_id() <> '' and agent_id = public.gi_jwt_agent_id())
     or (
          public.gi_jwt_agent_id() <> ''
          and exists (
            select 1 from public.agents a
            where a.id = public.gi_jwt_agent_id()
              and coalesce(a.role, '') = 'teamManager'
          )
          and (
            agent_id = public.gi_jwt_agent_id()
            or coalesce(team_manager_id, '') = public.gi_jwt_agent_id()
          )
     )
  );

notify pgrst, 'reload schema';

-- =============================================================================
-- Pה (NEXT, RISKY) — to activate these shadow policies, drop the open
-- 'allow all customers' FOR AUTHENTICATED and replace it with an anon-only open policy.
-- This is the step that closes the critical hole. Do NOT run until Pג-3
-- is deployed AND the client uses the JWT session, AND these shadow policies
-- are verified against real JWTs on a Supabase branch.
--
-- Sketch (do NOT run blindly):
--   drop policy "allow all customers" on public.customers;            -- removes the open-for-all
--   create policy "customers_anon_all" on public.customers
--     for select, insert, update, delete to anon using (true);   -- anon stays open
--   -- now the shadow policies above take effect for authenticated (anon still open).
-- =============================================================================
