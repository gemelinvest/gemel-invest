-- =============================================================================
-- DRAFT ONLY — DO NOT RUN IN PRODUCTION WITHOUT EXPLICIT APPROVAL
-- R9-pre: hide agents.pin from anon/authenticated direct table reads
-- Prerequisite: a server-side login path (RPC / Supabase Auth) must exist first,
-- otherwise the CRM login that compares PINs in the browser will break.
-- =============================================================================

-- Example direction (NOT applied):
-- 1) Create RPC verify_agent_login(username, pin) security definer
-- 2) Grant execute to anon
-- 3) Revoke direct select of pin from anon/authenticated
-- 4) Update app.js Auth._submit to call RPC instead of reading agents.pin

-- revoke select (pin) on public.agents from anon, authenticated;
-- → Postgres cannot revoke a single column without a column-level GRANT model;
-- prefer: view agents_public without pin + revoke table select, or RPC-only login.

select 'DRAFT_ONLY_NO_OP' as status;
