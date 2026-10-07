-- =============================================================================
-- GEMEL INVEST · Pד shadow RLS for campaign_leads (authenticated)
-- Today: "gi_campaign_leads_all_anon" (anon,authenticated, ALL, true) +
-- "z_block_anon_delete" (anon DELETE false). Open to anon.
-- Actual columns (from app.js CAMPAIGN_LEAD_COLUMNS):
--   id, phone, customer_name, description, campaign_id, campaign_label,
--   assigned_agent_id, assigned_agent_name, status, source,
--   created_by_name, updated_by_name, row_color, created_at, updated_at
-- (+ customer fields: id_number, id_issue_date, birth_date)
-- NOTE: there is NO team_manager_id on campaign_leads; team manager is on agents.
-- A lead is "in the team" if assigned_agent_id is an agent whose
-- team_manager_id = the current teamManager.
-- Role matrix (§5): admin/manager/ops/opsAgent all; teamManager team;
--   agent own (assigned_agent_id = self); elementary/referent none.
-- INERT until Pה. Safe to run now.
-- =============================================================================

drop policy if exists "campaign_leads_select_authenticated" on public.campaign_leads;
create policy "campaign_leads_select_authenticated"
  on public.campaign_leads
  for select
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or public.gi_jwt_role() in ('ops','opsAgent')
     or (public.gi_jwt_agent_id() <> '' and coalesce(assigned_agent_id, '') = public.gi_jwt_agent_id())
     or (
          public.gi_jwt_agent_id() <> ''
          and public.gi_jwt_role() = 'teamManager'
          and exists (
            select 1 from public.agents a
            where a.id = coalesce(assigned_agent_id, '')
              and coalesce(a.team_manager_id, '') = public.gi_jwt_agent_id()
          )
     )
  );

drop policy if exists "campaign_leads_insert_authenticated" on public.campaign_leads;
create policy "campaign_leads_insert_authenticated"
  on public.campaign_leads
  for insert
  to authenticated
  with check (
        public.gi_jwt_is_manager()
     or public.gi_jwt_role() in ('ops','opsAgent')
     or (public.gi_jwt_agent_id() <> '' and coalesce(assigned_agent_id, '') = public.gi_jwt_agent_id())
     or (
          public.gi_jwt_agent_id() <> ''
          and public.gi_jwt_role() = 'teamManager'
          and exists (
            select 1 from public.agents a
            where a.id = coalesce(assigned_agent_id, '')
              and coalesce(a.team_manager_id, '') = public.gi_jwt_agent_id()
          )
     )
  );

drop policy if exists "campaign_leads_update_authenticated" on public.campaign_leads;
create policy "campaign_leads_update_authenticated"
  on public.campaign_leads
  for update
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or public.gi_jwt_role() in ('ops','opsAgent')
     or (public.gi_jwt_agent_id() <> '' and assigned_agent_id = public.gi_jwt_agent_id())
     or (
          public.gi_jwt_agent_id() <> ''
          and public.gi_jwt_role() = 'teamManager'
          and exists (
            select 1 from public.agents a
            where a.id = assigned_agent_id
              and coalesce(a.team_manager_id, '') = public.gi_jwt_agent_id()
          )
     )
  )
  with check (
        public.gi_jwt_is_manager()
     or public.gi_jwt_role() in ('ops','opsAgent')
     or (public.gi_jwt_agent_id() <> '' and coalesce(assigned_agent_id, '') = public.gi_jwt_agent_id())
     or (
          public.gi_jwt_agent_id() <> ''
          and public.gi_jwt_role() = 'teamManager'
          and exists (
            select 1 from public.agents a
            where a.id = coalesce(assigned_agent_id, '')
              and coalesce(a.team_manager_id, '') = public.gi_jwt_agent_id()
          )
     )
  );

drop policy if exists "campaign_leads_delete_authenticated" on public.campaign_leads;
create policy "campaign_leads_delete_authenticated"
  on public.campaign_leads
  for delete
  to authenticated
  using (public.gi_jwt_is_manager() or public.gi_jwt_role() in ('ops','opsAgent'));

notify pgrst, 'reload schema';
-- Pה: drop "gi_campaign_leads_all_anon"; revoke all from anon.
