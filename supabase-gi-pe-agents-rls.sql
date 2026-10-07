-- =============================================================================
-- GEMEL INVEST · Pד shadow RLS for agents (authenticated)
-- Today: "agents_anon_all" (anon,authenticated, ALL, true) + "z_block_anon_delete"
-- (anon DELETE false). The anon_all policy lets anon read/write the whole
-- agents table. PIN is hidden at the column-GRANT level (supabase-gi-hide-agent-pins.sql)
-- but anon can still read id/name/username/role/active and WRITE rows.
--
-- Role matrix (§5): agents public columns (id,name,username,role,active) readable
-- by authenticated (no pin for anyone via REST). Writes (insert/update) only
-- via admin/manager RPC (gi-provision-agent-auth), not direct REST by agents.
--
-- INERT until Pה: "agents_anon_all" still OR-wins. Safe to run now.
-- =============================================================================

-- SELECT: authenticated read public columns (PIN is excluded by column GRANTs;
-- the policy grants row-level read of the agents table to authenticated).
drop policy if exists "agents_select_authenticated" on public.agents;
create policy "agents_select_authenticated"
  on public.agents
  for select
  to authenticated
  using (true);

-- INSERT: managers only (agent creation is an admin/manager action).
drop policy if exists "agents_insert_authenticated" on public.agents;
create policy "agents_insert_authenticated"
  on public.agents
  for insert
  to authenticated
  with check (public.gi_jwt_is_manager());

-- UPDATE: managers only (pin/role/active changes go through gi-provision-agent-auth,
-- which uses service_role; direct REST update by non-managers is not allowed).
drop policy if exists "agents_update_authenticated" on public.agents;
create policy "agents_update_authenticated"
  on public.agents
  for update
  to authenticated
  using (public.gi_jwt_is_manager())
  with check (public.gi_jwt_is_manager());

-- DELETE: managers only.
drop policy if exists "agents_delete_authenticated" on public.agents;
create policy "agents_delete_authenticated"
  on public.agents
  for delete
  to authenticated
  using (public.gi_jwt_is_manager());

notify pgrst, 'reload schema';

-- =============================================================================
-- Pה (NEXT, RISKY) — to activate:
--   drop policy "agents_anon_all" on public.agents;
--   (keep "z_block_anon_delete" — it already blocks anon delete)
--   revoke insert, update on table public.agents from anon;
--   -- optionally: revoke select on table public.agents from anon and re-grant
--   -- a minimal bootstrap column list if login still needs it pre-session:
--   -- grant select (id,name,username,role,active) on public.agents to anon;
-- Kill switch (rollback):
--   create policy "agents_anon_all" on public.agents
--     for all to anon, authenticated using (true) with check (true);
--   grant select, insert, update, delete on public.agents to anon, authenticated;
-- =============================================================================
