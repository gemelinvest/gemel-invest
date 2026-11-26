-- Read indexes for the two loads measured on 26 Nov 2026, 11:40–11:56 Asia/Jerusalem.
-- campaign_leads list: 54 calls, 5.3s mean, 39% of database time.
-- gi_dashboard_net_premium, gi_dashboard_sales_by_company, gi_dashboard_sales_by_product:
--   4.1–4.8s each, 36% together.
--
-- These statements add indexes only. They do not change a row, an assignment,
-- a policy, or a dashboard formula. The same leads stay assigned to the same
-- agents. The same sales numbers stay on the cards.
--
-- The Supabase SQL editor wraps a script in one transaction, so this file
-- does not use CONCURRENTLY. While Run is in progress, saving a lead waits
-- on the leads index, and saving a customer waits on the customer indexes.
-- Reading continues. campaign_leads is about 25MB. The customer indexes are
-- on the timestamp columns only, not on the file payload.
--
-- Safe to run again. An index that already exists is skipped.

CREATE INDEX IF NOT EXISTS idx_campaign_leads_created_at_desc
  ON public.campaign_leads (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_created_at
  ON public.customers (created_at);

CREATE INDEX IF NOT EXISTS idx_customers_completed_at
  ON public.customers (completed_at)
  WHERE completed_at IS NOT NULL;

ANALYZE public.campaign_leads;
ANALYZE public.customers;
