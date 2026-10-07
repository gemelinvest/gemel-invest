-- =============================================================================
-- GEMEL INVEST · Pד shadow RLS for reminders (authenticated)
-- Today: "anon_full_access" (anon,authenticated, ALL, true). Open to anon.
-- Role matrix (§5): manager all; agent owns (agent_id = self); others minimal.
-- INERT until Pה. Safe to run now.
-- =============================================================================

drop policy if exists "reminders_select_authenticated" on public.reminders;
create policy "reminders_select_authenticated"
  on public.reminders
  for select
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
  );

drop policy if exists "reminders_insert_authenticated" on public.reminders;
create policy "reminders_insert_authenticated"
  on public.reminders
  for insert
  to authenticated
  with check (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
  );

drop policy if exists "reminders_update_authenticated" on public.reminders;
create policy "reminders_update_authenticated"
  on public.reminders
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

drop policy if exists "reminders_delete_authenticated" on public.reminders;
create policy "reminders_delete_authenticated"
  on public.reminders
  for delete
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and agent_id = public.gi_jwt_agent_id())
  );

notify pgrst, 'reload schema';
-- Pה: drop "anon_full_access" on reminders; revoke all from anon.
