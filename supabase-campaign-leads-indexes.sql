-- GI-LEAD-INDEX — indexes for the lead reads that already exist.
-- They do not change saved rows, who can see a row, or any screen.
-- Do not run this on the live server until a quiet window is approved.
-- Agents are working. Each CREATE INDEX CONCURRENTLY takes a lock while it
-- builds, so run it when the office is quiet.
--
-- Each statement below runs on its own, outside a transaction.
-- The Supabase SQL editor must not wrap these in one transaction.
-- Run the lookup first. If a name is already listed, skip its CREATE.
--
-- Undo, one statement at a time, and only if a later check asks for it:
--   DROP INDEX CONCURRENTLY IF EXISTS public.idx_campaign_leads_assigned_created;
--   DROP INDEX CONCURRENTLY IF EXISTS public.idx_campaign_leads_description_trgm;
-- Do not drop pg_trgm. The customer name index already uses it.

-- 1. Lookup. Read only.
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'campaign_leads'
  AND indexname IN (
    'idx_campaign_leads_assigned_created',
    'idx_campaign_leads_description_trgm'
  );

-- 2. The extension is already used by idx_customers_full_name_trgm.
--    Run this alone. If it already exists, this statement changes nothing.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 3. Serves assigned_agent_id IN (...) ordered by created_at desc.
--    Run this alone. Skip it when the lookup already returned this name.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_leads_assigned_created
  ON public.campaign_leads (assigned_agent_id, created_at DESC);

-- 4. Serves description ILIKE with a percent sign on both sides.
--    Same gin_trgm_ops pattern as idx_customers_full_name_trgm.
--    Run this alone. Skip it when the lookup already returned this name.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_leads_description_trgm
  ON public.campaign_leads USING gin (description gin_trgm_ops);

-- 5. Planner stats only. Run this alone, after both indexes exist.
ANALYZE public.campaign_leads;
