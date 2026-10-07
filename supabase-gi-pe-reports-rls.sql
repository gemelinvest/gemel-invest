-- =============================================================================
-- GEMEL INVEST · Pד shadow RLS for report / log tables (authenticated)
-- Covers: gi_daily_report, gi_cancellations_report, gi_agent_activity_log,
--          gi_agent_appointment_report.
-- Today: open to anon/authenticated (USING true). Role matrix (§5): managers/ops
-- see all; agent sees own rows (agent_id = self). Low blast radius — cut first.
-- INERT until Pה. Safe to run now.
-- NOTE: verify each table has an agent_id (or agent_name) column; adjust if a
-- report uses agent_name only — then join via agents.
-- =============================================================================

-- gi_daily_report
drop policy if exists "daily_report_select_authenticated" on public.gi_daily_report;
create policy "daily_report_select_authenticated"
  on public.gi_daily_report
  for select
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or public.gi_jwt_role() in ('ops','opsAgent')
     or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
  );

-- gi_cancellations_report
drop policy if exists "cancellations_report_select_authenticated" on public.gi_cancellations_report;
create policy "cancellations_report_select_authenticated"
  on public.gi_cancellations_report
  for select
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or public.gi_jwt_role() in ('ops','opsAgent')
     or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
  );

-- gi_agent_activity_log — insert by authenticated (beacon), select own/manager.
drop policy if exists "actlog_select_authenticated" on public.gi_agent_activity_log;
create policy "actlog_select_authenticated"
  on public.gi_agent_activity_log
  for select
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or public.gi_jwt_role() in ('ops','opsAgent')
     or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
  );

drop policy if exists "actlog_insert_authenticated" on public.gi_agent_activity_log;
create policy "actlog_insert_authenticated"
  on public.gi_agent_activity_log
  for insert
  to authenticated
  with check (true);

-- gi_agent_appointment_report
drop policy if exists "agent_appointment_report_select_authenticated" on public.gi_agent_appointment_report;
create policy "agent_appointment_report_select_authenticated"
  on public.gi_agent_appointment_report
  for select
  to authenticated
  using (
        public.gi_jwt_is_manager()
     or public.gi_jwt_role() in ('ops','opsAgent')
     or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
  );

notify pgrst, 'reload schema';
-- Pה: drop "gi_daily_report_all_anon", "gi_cancellations_report_all_anon",
-- "gi_actlog_select"/"gi_actlog_insert" (the anon+auth ones); revoke from anon.
