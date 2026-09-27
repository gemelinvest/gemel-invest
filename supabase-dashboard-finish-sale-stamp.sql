-- =============================================================================
-- GEMEL INVEST · כרטיסי הדשבורד: חותמת מכירה = סיום הקמת הלקוח
--
-- פוליסה בלי _addedAt לא נופלת ל-created_at/updated_at של התיק.
-- טיוטה שנחתמה לפני סיום ההקמה, באותו חודש בישראל, נספרת ביום יצירת הלקוח.
-- פוליסה שנוספה אחר כך נשארת על _addedAt שלה.
-- gi_policy_premium לא משתנה (דוח העבודה נשאר על המסלול הקיים).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.gi_dashboard_sale_stamp(
  p jsonb,
  p_created_at timestamp with time zone
)
RETURNS timestamp with time zone
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN nullif(btrim(coalesce(p->>'_addedAt', '')), '') IS NULL THEN NULL
    WHEN p_created_at IS NOT NULL
      AND (p->>'_addedAt')::timestamptz < p_created_at
      AND to_char((p->>'_addedAt')::timestamptz AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM')
        = to_char(p_created_at AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM')
      THEN p_created_at
    ELSE (p->>'_addedAt')::timestamptz
  END
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

GRANT EXECUTE ON FUNCTION public.gi_dashboard_sale_stamp(jsonb, timestamp with time zone) TO PUBLIC;

NOTIFY pgrst, 'reload schema';
