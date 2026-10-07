-- Restore the open access that the Pה cutover removed, so PIN login can
-- load and save customers, proposals, leads, reports and app settings again.
-- Shadow policies and the Auth session stay in place. This only puts back
-- the previous allow-all policies and table grants. Safe to run more than once.

drop policy if exists "allow all customers" on public.customers;
create policy "allow all customers" on public.customers for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on table public.customers to anon, authenticated;

drop policy if exists "gi_proposals_restore_anon" on public.proposals;
create policy "gi_proposals_restore_anon" on public.proposals for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on table public.proposals to anon, authenticated;

drop policy if exists "gi_campaign_leads_all_anon" on public.campaign_leads;
create policy "gi_campaign_leads_all_anon" on public.campaign_leads for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on table public.campaign_leads to anon, authenticated;

drop policy if exists "allow all app_meta" on public.app_meta;
create policy "allow all app_meta" on public.app_meta for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on table public.app_meta to anon, authenticated;

drop policy if exists "gi_daily_report_all_anon" on public.gi_daily_report;
create policy "gi_daily_report_all_anon" on public.gi_daily_report for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on table public.gi_daily_report to anon, authenticated;

drop policy if exists "gi_cancellations_report_all_anon" on public.gi_cancellations_report;
create policy "gi_cancellations_report_all_anon" on public.gi_cancellations_report for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on table public.gi_cancellations_report to anon, authenticated;

drop policy if exists "gi_actlog_select" on public.gi_agent_activity_log;
create policy "gi_actlog_select" on public.gi_agent_activity_log for select to anon, authenticated using (true);
drop policy if exists "gi_actlog_insert" on public.gi_agent_activity_log;
create policy "gi_actlog_insert" on public.gi_agent_activity_log for insert to anon, authenticated with check (true);
grant select, insert on table public.gi_agent_activity_log to anon, authenticated;

drop policy if exists "gi_elem_ref_restore_anon" on public.gi_elementary_referrals;
create policy "gi_elem_ref_restore_anon" on public.gi_elementary_referrals for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on table public.gi_elementary_referrals to anon, authenticated;

drop policy if exists "gi_ops_ev_restore_anon" on public.gi_ops_events;
create policy "gi_ops_ev_restore_anon" on public.gi_ops_events for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on table public.gi_ops_events to anon, authenticated;

drop policy if exists "gi_perf_events_restore_anon" on public.gi_perf_events;
create policy "gi_perf_events_restore_anon" on public.gi_perf_events for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on table public.gi_perf_events to anon, authenticated;

drop policy if exists "owner_devices_restore_anon" on public.owner_devices;
create policy "owner_devices_restore_anon" on public.owner_devices for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on table public.owner_devices to anon, authenticated;

notify pgrst, 'reload schema';
