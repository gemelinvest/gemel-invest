-- =============================================================================
-- GEMEL INVEST · Pה cutover — drop the OPEN anon policies, table-by-table.
-- RUN ONE TABLE AT A TIME in Supabase SQL Editor. After each table:
--   1) node scripts/r1-verify-anon-access.mjs  (expect exit 0)
--   2) login + list + save + Realtime smoke test per role
-- If anything breaks — run that table's KILL SWITCH immediately (restores
-- anon read), and tell me. Do NOT "fix forward" over a broken prod.
--
-- PREREQUISITES (run once before this file, all safe/inert):
--   supabase-gi-jwt-helpers-fix.sql        (gi_jwt_agent_id, gi_jwt_is_manager)
--   supabase-gi-jwt-helpers-role.sql      (gi_jwt_role)
--   supabase-gi-pd-shadow-policies.sql     (customers shadow)
--   supabase-proposals-rls-fix.sql         (proposals own)
--   supabase-gi-pe-app-meta-rls.sql       (app_meta authenticated)
--   supabase-gi-pe-agents-rls.sql         (agents authenticated)
--   supabase-gi-pe-campaign-leads-rls.sql (campaign_leads authenticated)
--   supabase-gi-pe-reminders-rls.sql      (reminders authenticated)
--   supabase-gi-pe-simsaves-rls.sql      (gi_simulator_saves authenticated)
--   supabase-gi-pe-chat-rls.sql          (gi_chat_messages authenticated)
--   supabase-gi-pe-presence-rls.sql      (presence/events authenticated)
--   supabase-gi-pe-reports-rls.sql       (reports/logs authenticated)
--   supabase-gi-pe-history-rls.sql       (history tables authenticated)
-- And: PR #502 merged (openAgentSession JWT uplift + SW bump).
-- =============================================================================

-- =============================================================================
-- TABLE 1 — reports / logs (lowest blast radius). Run each, verify, then next.
-- =============================================================================

-- 1a) gi_daily_report
drop policy if exists "gi_daily_report_all_anon" on public.gi_daily_report;
revoke all on table public.gi_daily_report from anon;
notify pgrst, 'reload schema';
-- KILL SWITCH (1a): create policy "gi_daily_report_all_anon" on public.gi_daily_report for all to anon, authenticated using (true) with check (true); grant all on table public.gi_daily_report to anon, authenticated; notify pgrst, 'reload schema';

-- 1b) gi_cancellations_report
drop policy if exists "gi_cancellations_report_all_anon" on public.gi_cancellations_report;
revoke all on table public.gi_cancellations_report from anon;
notify pgrst, 'reload schema';
-- KILL SWITCH (1b): create policy "gi_cancellations_report_all_anon" on public.gi_cancellations_report for all to anon, authenticated using (true) with check (true); grant all on table public.gi_cancellations_report to anon, authenticated; notify pgrst, 'reload schema';

-- 1c) gi_agent_activity_log  (drop the anon+auth permissive; keep authenticated insert/select)
drop policy if exists "gi_actlog_select" on public.gi_agent_activity_log;   -- was anon,authenticated SELECT true
drop policy if exists "gi_actlog_insert" on public.gi_agent_activity_log;  -- was anon, authenticated INSERT null
revoke all on table public.gi_agent_activity_log from anon;
notify pgrst, 'reload schema';
-- KILL SWITCH (1c): recreate gi_actlog_select/insert for anon, authenticated using(true)/null; grant to anon, authenticated.

-- 1d) gi_agent_appointment_report (if it has an open anon policy — confirm via pg_policies first)
-- drop policy if exists "<open_policy_name>" on public.gi_agent_appointment_report;
-- revoke all on table public.gi_agent_appointment_report from anon;
-- notify pgrst, 'reload schema';

-- =============================================================================
-- TABLE 2 — campaign_leads
-- =============================================================================
drop policy if exists "gi_campaign_leads_all_anon" on public.campaign_leads;
revoke all on table public.campaign_leads from anon;
notify pgrst, 'reload schema';
-- KILL SWITCH (2): create policy "gi_campaign_leads_all_anon" on public.campaign_leads for all to anon, authenticated using (true) with check (true); grant all on table public.campaign_leads to anon, authenticated; notify pgrst, 'reload schema';

-- =============================================================================
-- TABLE 3 — proposals  (drop the public overlay + permissive-auth; keep own)
-- =============================================================================
drop policy if exists "anon_read_proposals" on public.propals;
drop policy if exists "gi_proposals_select_public" on public.propals;
drop policy if exists "gi_proposals_insert_public" on public.propals;
drop policy if exists "gi_proposals_update_public" on public.propals;
drop policy if exists "gi_proposals_delete_public" on public.propals;
drop policy if exists "gi_proposals_delete_auth" on public.proposals;   -- authenticated DELETE true (permissive)
drop policy if exists "allow_all_authenticated" on public.propals;     -- authenticated ALL true (permissive)
drop policy if exists "admin_full_access" on public.propals;          -- legacy CURRENT_USER
drop policy if exists "agent_own_proposals" on public.propals;         -- legacy CURRENT_USER
revoke all on table public.propals from anon;
notify pgrst, 'reload schema';
-- KILL SWITCH (3): recreate the public overlay: create policy "gi_proposals_select_public" on public.propals for select to public using (true); ... (or restore from backup). grant to anon, authenticated.

-- =============================================================================
-- TABLE 4 — customers  (THE HOT PATH — cut last among data tables)
-- =============================================================================
drop policy if exists "allow all customers" on public.customers;
drop policy if exists "anon_read_customers" on public.customers;
revoke all on table public.customers from anon;
notify pgrst, 'reload schema';
-- KILL SWITCH (4): create policy "allow all customers" on public.customers for all to anon, authenticated using (true) with check (true); grant select, insert, update, delete on table public.customers to anon, authenticated; notify pgrst, 'reload schema';

-- =============================================================================
-- TABLE 5 — app_meta  (closes adminAuth exposure to anon)
-- =============================================================================
drop policy if exists "allow all app_meta" on public.app_meta;
revoke all on table public.app_meta from anon;
notify pgrst, 'reload schema';
-- KILL SWITCH (5): create policy "allow all app_meta" on public.app_meta for all to public, anon, authenticated using (true) with check (true); grant all on table public.app_meta to anon, authenticated; notify pgrst, 'reload schema';

-- =============================================================================
-- TABLE 6 — agents  (narrow anon; keep z_block_anon_delete)
-- =============================================================================
drop policy if exists "agents_anon_all" on public.agents;
revoke insert, update on table public.agents from anon;
-- Optionally keep a minimal anon SELECT for bootstrap (or move to RPC only):
-- grant select (id, name, username, role, active) on public.agents to anon;
notify pgrst, 'reload schema';
-- KILL SWITCH (6): create policy "agents_anon_all" on public.agents for all to anon, authenticated using (true) with check (true); grant select, insert, update, delete on public.agents to anon, authenticated; notify pgrst, 'reload schema';

-- =============================================================================
-- TABLE 7 — gi_simulator_saves
-- =============================================================================
drop policy if exists "gi_simsaves_all" on public.gi_simulator_saves;
revoke all on table public.gi_simulator_saves from anon;
notify pgrst, 'reload schema';
-- KILL SWITCH (7): create policy "gi_simsaves_all" on public.gi_simulator_saves for all to anon, authenticated using (true) with check (true); grant all on table public.gi_simulator_saves to anon, authenticated; notify pgrst, 'reload schema';

-- =============================================================================
-- TABLE 8 — gi_chat_messages  (sensitive)
-- =============================================================================
drop policy if exists "gi_chat_messages_all" on public.gi_chat_messages;
revoke all on table public.gi_chat_messages from anon;
notify pgrst, 'reload schema';
-- KILL SWITCH (8): create policy "gi_chat_messages_all" on public.gi_chat_messages for all to anon, authenticated using (true) with check (true); grant all on table public.gi_chat_messages to anon, authenticated; notify pgrst, 'reload schema';

-- =============================================================================
-- TABLE 9 — presence / events (gi_agent_live, gi_system_notices, gi_elementary_referrals, gi_ops_events, gi_perf_events, owner_devices)
-- Run each sub-table separately; verify the relevant screen (live floor, system notices, etc.)
-- =============================================================================
-- 9a) gi_agent_live
drop policy if exists "gi_agent_live_read" on public.gi_agent_live;
drop policy if exists "gi_agent_live_upsert" on public.gi_agent_live;
drop policy if exists "gi_agent_live_update" on public.gi_agent_live;
revoke all on table public.gi_agent_live from anon;
notify pgrst, 'reload schema';
-- 9b) gi_system_notices
drop policy if exists "gi_system_notices_read" on public.gi_system_notices;
drop policy if exists "gi_system_notices_insert" on public.gi_system_notices;
revoke all on table public.gi_system_notices from anon;
notify pgrst, 'reload schema';
-- 9c) gi_elementary_referrals
drop policy if exists "gi_elem_ref_all" on public.gi_elementary_referrals;
revoke all on table public.gi_elementary_referrals from anon;
notify pgrst, 'reload schema';
-- 9d) gi_ops_events
drop policy if exists "gi_ops_ev_all" on public.gi_ops_events;
revoke all on table public.gi_ops_events from anon;
notify pgrst, 'reload schema';
-- 9e) gi_perf_events
drop policy if exists "gi_perf_events_select_authenticated" on public.gi_perf_events;   -- was anon, authenticated
drop policy if exists "gi_perf_events_insert_authenticated" on public.gi_perf_events; -- was anon, authenticated
revoke all on table public.gi_perf_events from anon;
notify pgrst, 'reload schema';
-- 9f) owner_devices
drop policy if exists "owner_devices_open_insert_for_mvp" on public.owner_devices;
drop policy if exists "owner_devices_open_update_for_mvp" on public.owner_devices;
revoke all on table public.owner_devices from anon;
notify pgrst, 'reload schema';

-- =============================================================================
-- TABLE 10 — history tables (agents_history, customers_history, proposals_history)
-- =============================================================================
-- 10a) agents_history
drop policy if exists "agents_history_update" on public.agents_history;          -- anon UPDATE true
drop policy if exists "gi_agents_history_insert_app" on public.agents_history;  -- anon, authenticated
drop policy if exists "gi_agents_history_select_app" on public.agents_history;  -- anon, authenticated
revoke all on table public.agents_history from anon;
notify pgrst, 'reload schema';
-- 10b) customers_history
drop policy if exists "customers_history_insert" on public.customers_history;
drop policy if exists "customers_history_select" on public.customers_history;
drop policy if exists "customers_history_update" on public.customers_history;
drop policy if exists "z_block_anon_update" on public.customers_history;
drop policy if exists "z_block_anon_delete" on public.customers_history;
revoke all on table public.customers_history from anon;
notify pgrst, 'reload schema';
-- 10c) proposals_history
drop policy if exists "proposals_history_insert" on public.proposals_history;
drop policy if exists "proposals_history_select" on public.proposals_history;
drop policy if exists "proposals_history_update" on public.proposals_history;
drop policy if exists "z_block_anon_delete" on public.proposals_history;
drop policy if exists "z_block_anon_update" on public.proposals_history;
revoke all on table public.proposals_history from anon;
notify pgrst, 'reload schema';

-- =============================================================================
-- TABLE 11 — Storage gi-customer-files  (Pו — AFTER customers RLS is live)
-- =============================================================================
drop policy if exists "gi_customer_files_all" on storage.objects;
notify pgrst, 'reload schema';
-- KILL SWITCH (11): create policy "gi_customer_files_all" on storage.objects for all to anon, authenticated using (bucket_id = 'gi-customer-files') with check (bucket_id = 'gi-customer-files'); notify pgrst, 'reload schema';

-- =============================================================================
-- FINAL VERIFY
--   node scripts/r1-verify-anon-access.mjs   (expect: exit 0, "No obvious anon core-table read access")
--   + per-role login/list/save/Realtime smoke tests
-- =============================================================================
