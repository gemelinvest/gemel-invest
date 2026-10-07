-- =============================================================================
-- GEMEL INVEST · Pד shadow RLS for campaign_leads (authenticated)
-- Today: "gi_campaign_leads_all_anon" (anon,authenticated, ALL, true) +
-- "z_block_anon_delete" (anon DELETE false). Open to anon.
-- Role matrix (§5): admin/manager all; ops per operational need; opsAgent
-- limited; teamManager limited; agent -> assigned leads; elementary/referent none.
-- INERT until Pה. Safe to run now.
-- =============================================================================

-- SELECT: managers/ops all; opsAgent limited (own scope); teamManager limited
-- (team); agent sees leads assigned to them; elementary/referent none.
drop policy if exists "campaign_leads_select_authenticated" on public.campaign_leads;
create policy "campaign_leads_select_authenticated"
  on public.campaign_leads
  for select
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or public.gi_jwt_role() in ('ops')
     or (public.gi_jwt_role() = 'opsAgent' and public.gi_jwt_agent_id() <> '')
     or (public.gi_jwt_agent_id() <> '' and assigned_to = public.gi_jwt_agent_id())
     or (
          public.gi_jwt_agent_id() <> ''
          and public.gi_jwt_role() = 'teamManager'
          and coalesce(team_manager_id, '') = public.gi_jwt_agent_id()
     )
  );

-- INSERT: managers/ops; agent inserts own; teamManager inserts team.
drop policy if exists "campaign_leads_insert_authenticated" on public.campaign_leads;
create policy "campaign_leads_insert_authenticated"
  on public.campaign_leads
  for insert
  to authenticated
  with check (
        public.gi_jwt_is_manager()
     or public.gi_jwt_role() in ('ops')
     or (public.gi_jwt_agent_id() <> '' and coalesce(assigned_to, '') = public.gi_jwt_agent_id())
     or (
          public.gi_jwt_agent_id() <> ''
          and public.gi_jwt_role() = 'teamManager'
          and coalesce(team_manager_id, '') = public.gi_jwt_agent_id()
     )
  );

-- UPDATE: managers/ops; agent updates own; teamManager updates team.
drop policy if exists "campaign_leads_update_authenticated" on public.campaign_leads;
create policy "campaign_leads_update_authenticated"
  on public.campaign_leads
  for update
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or public.gi_jwt_role() in ('ops')
     or (public.gi_jwt_agent_id() <> '' and assigned_to = public.gi_jwt_agent_id())
     or (
          public.gi_jwt_agent_id() <> ''
          and public.gi_jwt_role() = 'teamManager'
          and coalesce(team_manager_id, '') = public.gi_jwt_agent_id()
     )
  )
  with check (
        public.gi_jwt_is_manager()
     or public.gi_jwt_role() in ('ops')
     or (public.gi_jwt_agent_id() <> '' and coalesce(assigned_to, '') = public.gi_jwt_agent_id())
     or (
          public.gi_jwt_agent_id() <> ''
          and public.gi_jwt_role() = 'teamManager'
          and coalesce(team_manager_id, '') = public.gi_jwt_agent_id()
     )
  );

-- DELETE: managers/ops only.
drop policy if exists "campaign_leads_delete_authenticated" on public.campaign_leads;
create policy "campaign_leads_delete_authenticated"
  on public.campaign_leads
  for delete
  to authenticated
  using (public.gi_jwt_is_manager() or public.gi_jwt_role() in ('ops'));

notify pgrst, 'reload schema';

-- Pה: drop "gi_campaign_leads_all_anon"; revoke all on campaign_leads from anon.
-- Kill switch: recreate "gi_campaign_leads_all_anon" ... using (true) to anon, authenticated.
