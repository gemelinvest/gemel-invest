-- =============================================================================
-- GEMEL INVEST · Pד shadow RLS for gi_simulator_saves (authenticated)
-- Today: "gi_simsaves_all" (anon,authenticated, ALL, true). Open to anon.
-- Role matrix (§5): manager all / owner; agent owns (agent_id = self); others none.
-- INERT until Pה. Safe to run now.
-- =============================================================================

drop policy if exists "simsaves_select_authenticated" on public.gi_simulator_saves;
create policy "simsaves_select_authenticated"
  on public.gi_simulator_saves
  for select
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
  );

drop policy if exists "simsaves_insert_authenticated" on public.gi_simulator_saves;
create policy "simsaves_insert_authenticated"
  on public.gi_simulator_saves
  for insert
  to authenticated
  with check (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
  );

drop policy if exists "simsaves_update_authenticated" on public.gi_simulator_saves;
create policy "simsaves_update_authenticated"
  on public.gi_simulator_saves
  for update
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and agent_id = public.gi_jwt_agent_id())
  )
  with check (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
  );

drop policy if exists "simsaves_delete_authenticated" on public.gi_simulator_saves;
create policy "simsaves_delete_authenticated"
  on public.gi_simulator_saves
  for delete
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and agent_id = public.gi_jwt_agent_id())
  );

notify pgrst, 'reload schema';
-- Pה: drop "gi_simsaves_all"; revoke all from anon.
