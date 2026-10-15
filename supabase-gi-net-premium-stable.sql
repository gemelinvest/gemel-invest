-- =============================================================================
-- GEMEL INVEST · פרמיה חודשית נטו יציבה ומדויקת לפי מכירות
--
-- 1) ייבוא פרודוקציה (npol_prod_ / productionImport) אינו מכירה, גם אם
--    _addedAt זז ביום אחר אחרי שמירה או סיום הקמה.
-- 2) סינון נציג: כשיש p_agent_ids — רק agent_id. שם רק לתיקים בלי id.
-- 3) פירוט לפי מוצר/חברה משתמש באותה חותמת מכירה כמו הכרטיס.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.gi_is_production_backfill(p jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT
    coalesce(p->>'id','') LIKE 'npol_prod_%'
    OR coalesce(jsonb_typeof(p->'productionImport'), '') = 'object';
$function$;

CREATE OR REPLACE FUNCTION public.gi_dashboard_agent_in_scope(
  p_agent_id text,
  p_agent_name text,
  p_agent_ids text[],
  p_agent_names text[]
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT
    (p_agent_ids IS NULL AND p_agent_names IS NULL)
    OR (
      p_agent_ids IS NOT NULL
      AND btrim(coalesce(p_agent_id, '')) <> ''
      AND p_agent_id = ANY (p_agent_ids)
    )
    OR (
      (p_agent_ids IS NULL OR btrim(coalesce(p_agent_id, '')) = '')
      AND p_agent_names IS NOT NULL
      AND p_agent_name = ANY (p_agent_names)
    );
$function$;

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
  WHERE public.gi_dashboard_agent_in_scope(c.agent_id, c.agent_name, p_agent_ids, p_agent_names)
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
pol AS (
  SELECT s.id AS customer_id, p AS policy,
         public.gi_dashboard_sale_stamp(p, s.created_at) AS stamp
  FROM live s,
       LATERAL jsonb_array_elements(gi_new_policies(s.payload)) p
  WHERE coalesce(p->>'origin', '') <> 'existing'
    AND NOT public.gi_is_production_backfill(p)
),
inrange AS (
  SELECT *
  FROM pol
  WHERE stamp IS NOT NULL
    AND stamp >= p_start
    AND stamp < p_end
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
  SELECT c.id, c.created_at, c.payload
  FROM public.customers c
  WHERE public.gi_dashboard_agent_in_scope(c.agent_id, c.agent_name, p_agent_ids, p_agent_names)
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
         public.gi_dashboard_sale_stamp(p, l.created_at) AS stamp
  FROM live l,
       LATERAL jsonb_array_elements(gi_new_policies(l.payload)) p
  WHERE coalesce(p->>'origin','') <> 'existing'
    AND NOT public.gi_is_production_backfill(p)
)
SELECT product, count(*)::bigint AS policies, round(sum(prem),2) AS premium
FROM pol
WHERE stamp IS NOT NULL AND stamp >= p_start AND stamp < p_end
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
  SELECT c.id, c.created_at, c.payload
  FROM public.customers c
  WHERE public.gi_dashboard_agent_in_scope(c.agent_id, c.agent_name, p_agent_ids, p_agent_names)
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
         public.gi_dashboard_sale_stamp(p, l.created_at) AS stamp
  FROM live l,
       LATERAL jsonb_array_elements(gi_new_policies(l.payload)) p
  WHERE coalesce(p->>'origin','') <> 'existing'
    AND NOT public.gi_is_production_backfill(p)
)
SELECT company, count(*)::bigint AS policies, round(sum(prem),2) AS premium
FROM pol
WHERE stamp IS NOT NULL AND stamp >= p_start AND stamp < p_end
GROUP BY company
ORDER BY premium DESC NULLS LAST;
$function$;

GRANT EXECUTE ON FUNCTION public.gi_is_production_backfill(jsonb) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.gi_dashboard_agent_in_scope(text, text, text[], text[]) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.gi_dashboard_net_premium(timestamp with time zone, timestamp with time zone, text[], text[]) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.gi_dashboard_sales_by_product(timestamp with time zone, timestamp with time zone, text[], text[]) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.gi_dashboard_sales_by_company(timestamp with time zone, timestamp with time zone, text[], text[]) TO PUBLIC;

NOTIFY pgrst, 'reload schema';
