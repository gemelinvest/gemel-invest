-- =============================================================================
-- GEMEL INVEST · Pד shadow RLS for presence / events tables (authenticated)
-- Covers: gi_agent_live, gi_system_notices, gi_elementary_referrals,
--          gi_ops_events, gi_perf_events, owner_devices.
-- Today these are open to `public`/anon (USING true). Role matrix (§5):
--   gi_agent_live (presence) -> authenticated; agent owns row (agent_id = self)
--     or manager. Realtime presence — keep permissive for authenticated to
--     avoid breaking the live floor.
--   gi_system_notices -> authenticated read/insert (broadcast to logged-in users)
--   gi_elementary_referrals -> authenticated (elementary pool / manager)
--   gi_ops_events -> authenticated (ops / manager)
--   gi_perf_events -> authenticated (manager / own agent)
--   owner_devices -> authenticated (manager / owner)
-- INERT until Pה. Safe to run now.
-- NOTE: verify column names per table before applying.
-- =============================================================================

-- gi_agent_live — presence. Authenticated read; agent owns or manager all.
drop policy if exists "agent_live_select_authenticated" on public.gi_agent_live;
create policy "agent_live_select_authenticated"
  on public.gi_agent_live
  for select
  to authenticated
  using (true);

drop policy if exists "agent_live_upsert_authenticated" on public.gi_agent_live;
create policy "agent_live_upsert_authenticated"
  on public.gi_agent_live
  for insert
  to authenticated
  with check (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
  );

drop policy if exists "agent_live_update_authenticated" on public.gi_agent_live;
create policy "agent_live_update_authenticated"
  on public.gi_agent_live
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

-- gi_system_notices — broadcast to logged-in users.
drop policy if exists "system_notices_select_authenticated" on public.gi_system_notices;
create policy "system_notices_select_authenticated"
  on public.gi_system_notices
  for select
  to authenticated
  using (true);

drop policy if exists "system_notices_insert_authenticated" on public.gi_system_notices;
create policy "system_notices_insert_authenticated"
  on public.gi_system_notices
  for insert
  to authenticated
  with check (true);

-- gi_elementary_referrals — elementary pool / manager.
drop policy if exists "elem_ref_select_authenticated" on public.gi_elementary_referrals;
create policy "elem_ref_select_authenticated"
  on public.gi_elementary_referrals
  for select
  to authenticated
  using (public.gi_jwt_is_manager() or public.gi_jwt_role() = 'elementary');

drop policy if exists "elem_ref_insert_authenticated" on public.gi_elementary_referrals;
create policy "elem_ref_insert_authenticated"
  on public.gi_elementary_referrals
  for insert
  to authenticated
  with check (public.gi_jwt_is_manager() or public.gi_jwt_role() = 'elementary');

drop policy if exists "elem_ref_update_authenticated" on public.gi_elementary_referrals;
create policy "elem_ref_update_authenticated"
  on public.gi_elementary_referrals
  for update
  to authenticated
  using (public.gi_jwt_is_manager())
  with check (public.gi_jwt_is_manager());

-- gi_ops_events — ops / manager.
drop policy if exists "ops_ev_select_authenticated" on public.gi_ops_events;
create policy "ops_ev_select_authenticated"
  on public.gi_ops_events
  for select
  to authenticated
  using (public.gi_jwt_is_manager() or public.gi_jwt_role() in ('ops','opsAgent'));

drop policy if exists "ops_ev_insert_authenticated" on public.gi_ops_events;
create policy "ops_ev_insert_authenticated"
  on public.gi_ops_events
  for insert
  to authenticated
  with check (public.gi_jwt_is_manager() or public.gi_jwt_role() in ('ops','opsAgent'));

-- gi_perf_events — manager / own agent.
drop policy if exists "perf_events_select_authenticated" on public.gi_perf_events;
create policy "perf_events_select_authenticated"
  on public.gi_perf_events
  for select
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
  );

drop policy if exists "perf_events_insert_authenticated" on public.gi_perf_events;
create policy "perf_events_insert_authenticated"
  on public.gi_perf_events
  for insert
  to authenticated
  with check (
        public.gi_jwt_is_manager()
     or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
  );

-- owner_devices — manager / owner.
drop policy if exists "owner_devices_select_authenticated" on public.owner_devices;
create policy "owner_devices_select_authenticated"
  on public.owner_devices
  for select
  to authenticated
  using (public.gi_jwt_is_manager());

drop policy if exists "owner_devices_insert_authenticated" on public.owner_devices;
create policy "owner_devices_insert_authenticated"
  on public.owner_devices
  for insert
  to authenticated
  with check (public.gi_jwt_is_manager());

drop policy if exists "owner_devices_update_authenticated" on public.owner_devices;
create policy "owner_devices_update_authenticated"
  on public.owner_devices
  for update
  to authenticated
  using (public.gi_jwt_is_manager())
  with check (public.gi_jwt_is_manager());

notify pgrst, 'reload schema';
-- Pה: drop the open `public` policies per table (gi_agent_live_read/upsert/update,
-- gi_system_notices_read/insert, gi_elem_ref_all, gi_ops_ev_all, gi_perf_events_*,
-- owner_devices_open_*); revoke from anon.
