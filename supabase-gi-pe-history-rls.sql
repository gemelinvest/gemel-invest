-- =============================================================================
-- GEMEL INVEST · Pד shadow RLS for history tables (authenticated)
-- Covers: agents_history, customers_history, proposals_history.
-- Today: anon can select/insert/update (history tables). Role matrix: these are
-- audit/append-only tables — authenticated insert (via triggers/service role),
-- authenticated select (manager all; agent own). Low blast radius.
-- INERT until Pה. Safe to run now.
-- NOTE: verify column names (agent_id/customer_id/proposal_id) per table.
-- =============================================================================

-- agents_history — authenticated select (manager all; agent own); insert authenticated.
drop policy if exists "agents_history_select_authenticated" on public.agents_history;
create policy "agents_history_select_authenticated"
  on public.agents_history
  for select
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
  );

drop policy if exists "agents_history_insert_authenticated" on public.agents_history;
create policy "agents_history_insert_authenticated"
  on public.agents_history
  for insert
  to authenticated
  with check (true);

-- customers_history
drop policy if exists "customers_history_select_authenticated" on public.customers_history;
create policy "customers_history_select_authenticated"
  on public.customers_history
  for select
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or public.gi_jwt_role() in ('ops','opsAgent')
     or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
  );

drop policy if exists "customers_history_insert_authenticated" on public.customers_history;
create policy "customers_history_insert_authenticated"
  on public.customers_history
  for insert
  to authenticated
  with check (true);

-- proposals_history
drop policy if exists "proposals_history_select_authenticated" on public.proposals_history;
create policy "proposals_history_select_authenticated"
  on public.proposals_history
  for select
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
  );

drop policy if exists "proposals_history_insert_authenticated" on public.proposals_history;
create policy "proposals_history_insert_authenticated"
  on public.proposals_history
  for insert
  to authenticated
  with check (true);

notify pgrst, 'reload schema';
-- Pה: drop the anon history policies (agents_history_update, customers_history_insert/select/update,
-- proposals_history_insert/select/update, z_block_anon_*); revoke from anon.
