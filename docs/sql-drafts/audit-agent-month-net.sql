-- ביקורת פרמיה חודשית נטו לכל נציג.
-- RPC חייב להיות זהה לספירת מכירות האשף (בלי ייבוא).
-- הרצה ידנית מול פרודקשן. לא משנה נתונים.

WITH bounds AS (
  SELECT
    (date_trunc('month', timezone('Asia/Jerusalem', now()))
      AT TIME ZONE 'Asia/Jerusalem') AS p_start,
    ((date_trunc('day', timezone('Asia/Jerusalem', now()))
      + interval '1 day') AT TIME ZONE 'Asia/Jerusalem') AS p_end
),
rpc AS (
  SELECT a.id, a.name,
         (public.gi_dashboard_net_premium(b.p_start, b.p_end, ARRAY[a.id]::text[], ARRAY[a.name]::text[])).*
  FROM public.agents a
  CROSS JOIN bounds b
  WHERE a.active IS DISTINCT FROM false
),
independent AS (
  SELECT c.agent_id,
         count(*) FILTER (
           WHERE coalesce(p->>'origin','') <> 'existing'
             AND NOT public.gi_is_production_backfill(p)
             AND public.gi_dashboard_sale_stamp(p, c.created_at) >= b.p_start
             AND public.gi_dashboard_sale_stamp(p, c.created_at) < b.p_end
         ) AS wizard_pols,
         round(coalesce(sum(public.gi_policy_premium(p)) FILTER (
           WHERE coalesce(p->>'origin','') <> 'existing'
             AND NOT public.gi_is_production_backfill(p)
             AND public.gi_dashboard_sale_stamp(p, c.created_at) >= b.p_start
             AND public.gi_dashboard_sale_stamp(p, c.created_at) < b.p_end
         ), 0), 2) AS wizard_net
  FROM public.customers c
  CROSS JOIN bounds b
  LEFT JOIN LATERAL jsonb_array_elements(gi_new_policies(c.payload)) p ON true
  WHERE lower(btrim(coalesce(c.status,''))) NOT IN ('inactive','archived','purged')
    AND btrim(coalesce(c.status,'')) <> 'גנוז'
    AND p IS NOT NULL
  GROUP BY c.agent_id
)
SELECT r.name, r.net_premium AS rpc_net, r.sold_policies AS rpc_pols,
       coalesce(i.wizard_net, 0) AS wizard_net, coalesce(i.wizard_pols, 0) AS wizard_pols,
       (round(r.net_premium, 2) IS DISTINCT FROM coalesce(i.wizard_net, 0)
        OR r.sold_policies IS DISTINCT FROM coalesce(i.wizard_pols, 0)) AS mismatch
FROM rpc r
LEFT JOIN independent i ON i.agent_id = r.id
ORDER BY r.net_premium DESC, r.name;
