-- GI-PERF 2026-09-19 — CRM freeze remediation (production)
-- Safe for live agents when applied carefully:
--   * CREATE INDEX CONCURRENTLY must run OUTSIDE a transaction
--   * Stuck callSession cleanup only touches finished / stale rows
--   * app_meta slim keeps top-level referral fields + elementaryReferralMeta
--   * Dashboard RPCs pre-filter by date so managers do not unpack 51k payloads

-- ---------------------------------------------------------------------------
-- 1) Working-set / delta / OpsAgent watcher: index on updated_at
--    Run this statement alone (not inside BEGIN/COMMIT):
-- ---------------------------------------------------------------------------
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_updated_at_desc
--   ON public.customers (updated_at DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- 2) Optional partial index if JSONB live-call probes return (defense in depth)
-- ---------------------------------------------------------------------------
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_live_call_active
--   ON public.customers ((payload->'mirrorFlow'->'callSession'->>'active'))
--   WHERE (payload->'mirrorFlow'->'callSession'->>'active') = 'true';

-- ---------------------------------------------------------------------------
-- 3) Refresh planner stats (customers was reporting ~52 live tuples vs 51k)
-- ---------------------------------------------------------------------------
ANALYZE public.customers;
ANALYZE public.app_meta;

-- ---------------------------------------------------------------------------
-- 4) Clear stuck mirror callSession.active flags
--    Only rows that already have finishedAt, or started > 8 hours ago.
-- ---------------------------------------------------------------------------
UPDATE public.customers
SET payload = jsonb_set(
  payload,
  '{mirrorFlow,callSession,active}',
  'false'::jsonb,
  true
),
updated_at = updated_at
WHERE payload->'mirrorFlow'->'callSession'->>'active' = 'true'
  AND (
    nullif(btrim(coalesce(payload->'mirrorFlow'->'callSession'->>'finishedAt', '')), '') IS NOT NULL
    OR coalesce(
         (payload->'mirrorFlow'->'callSession'->>'startedAt')::timestamptz,
         '-infinity'::timestamptz
       ) < now() - interval '8 hours'
  );

-- ---------------------------------------------------------------------------
-- 5) Slim elementaryReferrals inside app_meta.global
--    Drop nested fat payload; keep elementaryReferralMeta + elementaryReport.
--    Strip inline dataUrl blobs from elementaryPolicyFiles.
-- ---------------------------------------------------------------------------
UPDATE public.app_meta
SET payload = jsonb_set(
  payload,
  '{elementaryReferrals}',
  coalesce((
    SELECT jsonb_agg(slimmed ORDER BY ordinality)
    FROM (
      SELECT ordinality,
        (elem - 'payload' - 'elementaryPolicyFiles')
        || jsonb_build_object(
          'payload',
            CASE
              WHEN jsonb_typeof(elem->'payload') = 'object' THEN
                jsonb_strip_nulls(jsonb_build_object(
                  'elementaryReferralMeta', elem->'payload'->'elementaryReferralMeta',
                  'mirrorFlow', CASE
                    WHEN elem->'payload'->'mirrorFlow'->'elementaryReport' IS NOT NULL
                      THEN jsonb_build_object(
                        'elementaryReport',
                        elem->'payload'->'mirrorFlow'->'elementaryReport'
                      )
                    ELSE NULL
                  END
                ))
              ELSE '{}'::jsonb
            END,
          'elementaryPolicyFiles',
            coalesce((
              SELECT jsonb_agg(
                (f - 'dataUrl' - 'data' - 'base64' - 'url')
                || CASE
                     WHEN coalesce(f->>'dataUrl', f->>'data', f->>'base64', '') <> ''
                       OR coalesce(f->>'url', '') LIKE 'data:%'
                     THEN jsonb_build_object('hasFile', true)
                     ELSE '{}'::jsonb
                   END
              )
              FROM jsonb_array_elements(coalesce(elem->'elementaryPolicyFiles', '[]'::jsonb)) AS f
            ), '[]'::jsonb)
        ) AS slimmed
      FROM jsonb_array_elements(coalesce(payload->'elementaryReferrals', '[]'::jsonb))
        WITH ORDINALITY AS t(elem, ordinality)
    ) s
  ), '[]'::jsonb),
  true
),
updated_at = now()
WHERE key = 'global'
  AND jsonb_typeof(payload->'elementaryReferrals') = 'array';

-- ---------------------------------------------------------------------------
-- 6) Dashboard KPI RPCs — pre-filter by date before unpacking JSONB
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gi_dashboard_net_premium(
  p_start timestamp with time zone,
  p_end timestamp with time zone,
  p_agent_ids text[] DEFAULT NULL::text[],
  p_agent_names text[] DEFAULT NULL::text[]
)
RETURNS TABLE(net_premium numeric, sold_policies bigint, new_clients bigint)
LANGUAGE sql
STABLE
AS $function$
WITH scoped AS (
  SELECT c.id, c.status, c.created_at, c.updated_at, c.payload
  FROM public.customers c
  WHERE (
      (p_agent_ids IS NULL AND p_agent_names IS NULL)
      OR c.agent_id = ANY (coalesce(p_agent_ids, '{}'::text[]))
      OR c.agent_name = ANY (coalesce(p_agent_names, '{}'::text[]))
    )
    AND (
      (c.created_at >= p_start AND c.created_at < p_end)
      OR (c.updated_at >= p_start AND c.updated_at < p_end)
      OR (c.completed_at IS NOT NULL AND c.completed_at >= p_start AND c.completed_at < p_end)
    )
),
live AS (
  SELECT *
  FROM scoped s
  WHERE lower(btrim(coalesce(s.status, ''))) NOT IN ('inactive', 'archived', 'purged')
    AND btrim(coalesce(s.status, '')) <> 'גנוז'
),
stamped AS (
  SELECT s.id, s.payload,
         coalesce(
           nullif(btrim(to_char(s.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SSOF')), ''),
           nullif(btrim(coalesce(s.payload->>'createdAt','')), ''),
           nullif(btrim(to_char(s.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SSOF')), ''),
           nullif(btrim(coalesce(s.payload->>'updatedAt','')), '')
         ) AS cust_stamp
  FROM live s
),
pol AS (
  SELECT st.id AS customer_id, p AS policy,
         coalesce(nullif(btrim(coalesce(p->>'_addedAt','')), ''), st.cust_stamp) AS stamp
  FROM stamped st,
       LATERAL jsonb_array_elements(gi_new_policies(st.payload)) p
  WHERE coalesce(p->>'origin','') <> 'existing'
    AND NOT public.gi_is_production_backfill(p)
),
inrange AS (
  SELECT *
  FROM pol
  WHERE stamp IS NOT NULL
    AND stamp::timestamptz >= p_start
    AND stamp::timestamptz < p_end
)
SELECT
  round(coalesce(sum(gi_policy_premium(policy)), 0), 2) AS net_premium,
  count(*)::bigint AS sold_policies,
  count(DISTINCT customer_id)::bigint AS new_clients
FROM inrange;
$function$;

CREATE OR REPLACE FUNCTION public.gi_dashboard_sales_by_product(
  p_start timestamp with time zone,
  p_end timestamp with time zone,
  p_agent_ids text[] DEFAULT NULL::text[],
  p_agent_names text[] DEFAULT NULL::text[]
)
RETURNS TABLE(product text, policies bigint, premium numeric)
LANGUAGE sql
STABLE
AS $function$
WITH live AS (
  SELECT c.id, c.created_at, c.updated_at, c.payload
  FROM public.customers c
  WHERE (
      (p_agent_ids IS NULL AND p_agent_names IS NULL)
      OR c.agent_id = ANY (coalesce(p_agent_ids, '{}'::text[]))
      OR c.agent_name = ANY (coalesce(p_agent_names, '{}'::text[]))
    )
    AND lower(btrim(coalesce(c.status,''))) NOT IN ('inactive','archived','purged')
    AND btrim(coalesce(c.status,'')) <> 'גנוז'
    AND (
      (c.created_at >= p_start AND c.created_at < p_end)
      OR (c.updated_at >= p_start AND c.updated_at < p_end)
      OR (c.completed_at IS NOT NULL AND c.completed_at >= p_start AND c.completed_at < p_end)
    )
),
pol AS (
  SELECT coalesce(nullif(btrim(coalesce(p->>'type','')), ''), 'אחר') AS product,
         gi_policy_premium(p) AS prem,
         coalesce(
           nullif(btrim(coalesce(p->>'_addedAt','')), ''),
           coalesce(
             nullif(btrim(to_char(l.created_at,'YYYY-MM-DD"T"HH24:MI:SSOF')), ''),
             nullif(btrim(coalesce(l.payload->>'createdAt','')), ''),
             nullif(btrim(to_char(l.updated_at,'YYYY-MM-DD"T"HH24:MI:SSOF')), ''),
             nullif(btrim(coalesce(l.payload->>'updatedAt','')), '')
           )
         ) AS stamp
  FROM live l,
       LATERAL jsonb_array_elements(gi_new_policies(l.payload)) p
  WHERE coalesce(p->>'origin','') <> 'existing'
    AND NOT public.gi_is_production_backfill(p)
)
SELECT product, count(*)::bigint AS policies, round(sum(prem),2) AS premium
FROM pol
WHERE stamp IS NOT NULL AND stamp::timestamptz >= p_start AND stamp::timestamptz < p_end
GROUP BY product
ORDER BY premium DESC NULLS LAST;
$function$;

CREATE OR REPLACE FUNCTION public.gi_dashboard_sales_by_company(
  p_start timestamp with time zone,
  p_end timestamp with time zone,
  p_agent_ids text[] DEFAULT NULL::text[],
  p_agent_names text[] DEFAULT NULL::text[]
)
RETURNS TABLE(company text, policies bigint, premium numeric)
LANGUAGE sql
STABLE
AS $function$
WITH live AS (
  SELECT c.id, c.created_at, c.updated_at, c.payload
  FROM public.customers c
  WHERE (
      (p_agent_ids IS NULL AND p_agent_names IS NULL)
      OR c.agent_id = ANY (coalesce(p_agent_ids, '{}'::text[]))
      OR c.agent_name = ANY (coalesce(p_agent_names, '{}'::text[]))
    )
    AND lower(btrim(coalesce(c.status,''))) NOT IN ('inactive','archived','purged')
    AND btrim(coalesce(c.status,'')) <> 'גנוז'
    AND (
      (c.created_at >= p_start AND c.created_at < p_end)
      OR (c.updated_at >= p_start AND c.updated_at < p_end)
      OR (c.completed_at IS NOT NULL AND c.completed_at >= p_start AND c.completed_at < p_end)
    )
),
pol AS (
  SELECT coalesce(nullif(btrim(coalesce(p->>'company','')), ''), 'ללא חברה') AS company,
         gi_policy_premium(p) AS prem,
         coalesce(
           nullif(btrim(coalesce(p->>'_addedAt','')), ''),
           coalesce(
             nullif(btrim(to_char(l.created_at,'YYYY-MM-DD"T"HH24:MI:SSOF')), ''),
             nullif(btrim(coalesce(l.payload->>'createdAt','')), ''),
             nullif(btrim(to_char(l.updated_at,'YYYY-MM-DD"T"HH24:MI:SSOF')), ''),
             nullif(btrim(coalesce(l.payload->>'updatedAt','')), '')
           )
         ) AS stamp
  FROM live l,
       LATERAL jsonb_array_elements(gi_new_policies(l.payload)) p
  WHERE coalesce(p->>'origin','') <> 'existing'
    AND NOT public.gi_is_production_backfill(p)
)
SELECT company, count(*)::bigint AS policies, round(sum(prem),2) AS premium
FROM pol
WHERE stamp IS NOT NULL AND stamp::timestamptz >= p_start AND stamp::timestamptz < p_end
GROUP BY company
ORDER BY premium DESC NULLS LAST;
$function$;
