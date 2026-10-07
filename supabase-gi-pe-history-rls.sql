-- =============================================================================
-- GEMEL INVEST · Pד shadow RLS for history tables (authenticated)
-- Covers: agents_history, customers_history, proposals_history.
-- Today: anon can select/insert/update (history tables). These are
-- audit/append-only tables. Per-owner column (agent_id/customer_id/proposal_id)
-- is not verified in the repo, so these policies use role-based checks only
-- (no column reference) to avoid a runtime column error. Effect: anon
-- loses access; authenticated read/insert. Narrowing anon
-- out is the safe minimum cutover.
-- INERT until Pה. Safe to run now.
-- =============================================================================

-- agents_history — authenticated select; insert authenticated.
drop policy if exists "agents_history_select_authenticated" on public.agents_history;
create policy "agents_history_select_authenticated"
  on public.agents_history
  for select
  to authenticated
  using (true);

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
  using (true);

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
  using (true);

drop policy if exists "proposals_history_insert_authenticated" on public.proposals_history;
create policy "proposals_history_insert_authenticated"
  on public.proposals_history
  for insert
  to authenticated
  with check (true);

notify pgrst, 'reload schema';
-- Pה: drop the anon history policies (agents_history_update, customers_history_insert/select/update,
-- proposals_history_insert/select/update, z_block_anon_*); revoke from anon.
-- LATER (narrow): once the per-owner column is confirmed (agent_id/customer_id/proposal_id),
-- restrict reads to own rows per the role matrix.
