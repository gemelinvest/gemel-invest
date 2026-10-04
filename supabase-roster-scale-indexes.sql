-- GI-PERF 2026-10-04 — indexes for a customers table that can grow past 51k toward millions.
-- Each CREATE INDEX CONCURRENTLY must be run on its own, outside a transaction.
-- These do not change saved data or business rules. They let list, search, and
-- latest-customer reads use an index instead of scanning the table.
--
-- Run one statement at a time in the Supabase SQL editor.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_updated_at_desc
  ON public.customers (updated_at DESC NULLS LAST);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_agent_id
  ON public.customers (agent_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_id_number
  ON public.customers (id_number);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_phone
  ON public.customers (phone);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_full_name_trgm
  ON public.customers USING gin (full_name gin_trgm_ops);

ANALYZE public.customers;
