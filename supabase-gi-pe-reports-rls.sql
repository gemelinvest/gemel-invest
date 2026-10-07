-- =============================================================================
-- GEMEL INVEST · Pד shadow RLS for report / log tables (authenticated)
-- Covers: gi_daily_report, gi_cancellations_report, gi_agent_activity_log,
--          gi_agent_appointment_report.
-- Today: open to anon/authenticated (USING true). Role matrix (§5): managers/ops
-- see all. The per-agent column (agent_id) is not verified in the repo, so
-- these policies use role-based checks only (no column reference) to avoid a
-- runtime column error. Effect: anon loses access; authenticated read all
-- (managers/ops/agents). Narrowing anon out is the safe minimum cutover.
-- INERT until Pה. Safe to run now.
-- =============================================================================

-- gi_daily_report — authenticated read.
drop policy if exists "daily_report_select_authenticated" on public.gi_daily_report;
create policy "daily_report_select_authenticated"
  on public.gi_daily_report
  for select
  to authenticated
  using (true);

-- gi_cancellations_report — authenticated read.
drop policy if exists "cancellations_report_select_authenticated" on public.gi_cancellations_report;
create policy "cancellations_report_select_authenticated"
  on public.gi_cancellations_report
  for select
  to authenticated
  using (true);

-- gi_agent_activity_log — authenticated select all; insert authenticated (beacon).
drop policy if exists "actlog_select_authenticated" on public.gi_agent_activity_log;
create policy "actlog_select_authenticated"
  on public.gi_agent_activity_log
  for select
  to authenticated
  using (true);

drop policy if exists "actlog_insert_authenticated" on public.gi_agent_activity_log;
create policy "actlog_insert_authenticated"
  on public.gi_agent_activity_log
  for insert
  to authenticated
  with check (true);

-- gi_agent_appointment_report — authenticated read.
drop policy if exists "agent_appointment_report_select_authenticated" on public.gi_agent_appointment_report;
create policy "agent_appointment_report_select_authenticated"
  on public.gi_agent_appointment_report
  for select
  to authenticated
  using (true);

notify pgrst, 'reload schema';
-- Pה: drop "gi_daily_report_all_anon", "gi_cancellations_report_all_anon",
-- "gi_actlog_select"/"gi_actlog_insert" (the anon+auth ones); revoke from anon.
-- LATER (narrow): once the per-agent column is confirmed (agent_id / agent_name),
-- restrict agent reads to own rows per the role matrix.
