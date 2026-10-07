-- =============================================================================
-- GEMEL INVEST · Pד shadow RLS for app_meta (authenticated)
-- CRITICAL: today app_meta is open to `public` (policy "allow all app_meta",
-- roles={public}, USING true). That exposes adminAuth (the admin PIN!) and
-- agentSecurity/shadows/inboxes to ANY anon with the publishable key — a
-- pentest finding. This file writes the TARGET authenticated policies so Pה
-- only needs to drop the open policy.
--
-- Role matrix (docs/CRM_SECURITY_PROGRAM.md §5):
--   admin/manager -> all app_meta
--   ops/opsAgent/teamManager -> partial (read public-ish meta)
--   agent/elementary/referent -> minimal (read only what the client needs)
--   anon -> none (after Pה)
--
-- INERT until Pה: the open "allow all app_meta" (public) still OR-wins, so
-- applying this now changes nothing. Safe to run now.
-- NOTE: app_meta is a single-row table (key='global'). Policies are per-row.
-- =============================================================================

-- SELECT: managers see everything; everyone authenticated sees the global row
-- (the client reads meta on boot). anon loses access only after Pה drops the
-- open policy.
drop policy if exists "app_meta_select_authenticated" on public.app_meta;
create policy "app_meta_select_authenticated"
  on public.app_meta
  for select
  to authenticated
  using (true);

-- INSERT: managers only (app_meta is upserted by admin/manager sync).
drop policy if exists "app_meta_insert_authenticated" on public.app_meta;
create policy "app_meta_insert_authenticated"
  on public.app_meta
  for insert
  to authenticated
  with check (public.gi_jwt_is_manager());

-- UPDATE: managers only.
drop policy if exists "app_meta_update_authenticated" on public.app_meta;
create policy "app_meta_update_authenticated"
  on public.app_meta
  for update
  to authenticated
  using (public.gi_jwt_is_manager())
  with check (public.gi_jwt_is_manager());

-- DELETE: managers only (rare; e.g. reset).
drop policy if exists "app_meta_delete_authenticated" on public.app_meta;
create policy "app_meta_delete_authenticated"
  on public.app_meta
  for delete
  to authenticated
  using (public.gi_jwt_is_manager());

notify pgrst, 'reload schema';

-- =============================================================================
-- Pה (NEXT, RISKY) — to activate, drop the open policies:
--   drop policy "allow all app_meta" on public.app_meta;   -- removes public open
--   (do NOT create an anon bridge — anon should have NO access to app_meta)
-- Kill switch (rollback):
--   create policy "allow all app_meta" on public.app_meta
--     for all to public, anon, authenticated using (true) with check (true);
-- =============================================================================
