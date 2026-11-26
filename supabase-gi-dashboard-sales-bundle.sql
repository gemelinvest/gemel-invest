-- One read for the three dashboard cards measured at 4.3–4.9s each.
-- The filters, sale stamp, import exclusion, and after-discount sum are the
-- same expressions as gi_dashboard_net_premium, gi_dashboard_sales_by_product,
-- and gi_dashboard_sales_by_company. Those three functions are not replaced.
--
-- The function reads as the caller. It does not change rows, policies, or grants
-- on customers. It does not run as definer.

CREATE OR REPLACE FUNCTION public.gi_dashboard_sales_bundle(
  p_start timestamp with time zone,
  p_end timestamp with time zone,
  p_agent_ids text[] DEFAULT NULL::text[],
  p_agent_names text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
  section text,
  label text,
  net_premium numeric,
  sold_policies bigint,
  new_clients bigint,
  policies bigint,
  premium numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
WITH live AS (
  SELECT c.id, c.created_at, c.payload
  FROM public.customers c
  WHERE public.gi_dashboard_agent_in_scope(c.agent_id, c.agent_name, p_agent_ids, p_agent_names)
    AND lower(btrim(coalesce(c.status, ''))) NOT IN ('inactive', 'archived', 'purged')
    AND btrim(coalesce(c.status, '')) <> 'גנוז'
    AND (
      (c.created_at >= p_start AND c.created_at < p_end)
      OR (c.updated_at >= p_start AND c.updated_at < p_end)
      OR (c.completed_at IS NOT NULL AND c.completed_at >= p_start AND c.completed_at < p_end)
    )
),
pol AS (
  SELECT l.id AS customer_id,
         p AS policy,
         coalesce(nullif(btrim(coalesce(p->>'type', '')), ''), 'אחר') AS product,
         coalesce(nullif(btrim(coalesce(p->>'company', '')), ''), 'ללא חברה') AS company,
         public.gi_policy_premium(p) AS prem,
         public.gi_dashboard_sale_stamp(p, l.created_at) AS stamp
  FROM live l,
       LATERAL jsonb_array_elements(public.gi_new_policies(l.payload)) p
  WHERE coalesce(p->>'origin', '') <> 'existing'
    AND NOT public.gi_is_production_backfill(p)
),
inrange AS (
  SELECT *
  FROM pol
  WHERE stamp IS NOT NULL
    AND stamp >= p_start
    AND stamp < p_end
),
net AS (
  SELECT
    round(coalesce(sum(public.gi_policy_premium(policy)), 0), 2) AS net_premium,
    count(*)::bigint AS sold_policies,
    count(DISTINCT customer_id)::bigint AS new_clients
  FROM inrange
),
by_product AS (
  SELECT product, count(*)::bigint AS policies, round(sum(prem), 2) AS premium
  FROM inrange
  GROUP BY product
),
by_company AS (
  SELECT company, count(*)::bigint AS policies, round(sum(prem), 2) AS premium
  FROM inrange
  GROUP BY company
)
SELECT 'net'::text, NULL::text, net_premium, sold_policies, new_clients, NULL::bigint, NULL::numeric
FROM net
UNION ALL
SELECT 'product'::text, product, NULL::numeric, NULL::bigint, NULL::bigint, policies, premium
FROM by_product
UNION ALL
SELECT 'company'::text, company, NULL::numeric, NULL::bigint, NULL::bigint, policies, premium
FROM by_company;
$function$;

GRANT EXECUTE ON FUNCTION public.gi_dashboard_sales_bundle(timestamp with time zone, timestamp with time zone, text[], text[]) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
