-- The "my leads" description search was measured at 4.28s.
-- PostgREST sends LIMIT and OFFSET as parameters, so PostgreSQL walks
-- idx_campaign_leads_created_at_desc and tests description row by row.
-- EXPLAIN of this shape on 26 Nov 2026 used idx_campaign_leads_description_trgm
-- first (bitmap index scan), then sorted that result, then applied the page.
--
-- Same ILIKE pattern, same created_at DESC order, same page size.
-- The function reads as the caller, so lead visibility stays with the table policies.
-- It does not insert, update, or delete a lead.

CREATE OR REPLACE FUNCTION public.gi_campaign_leads_by_description(
  p_pattern text,
  p_limit bigint,
  p_offset bigint
)
RETURNS SETOF public.campaign_leads
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
DECLARE
  v_limit bigint;
  v_offset bigint;
BEGIN
  IF coalesce(btrim(p_pattern), '') = '' OR p_pattern IN ('%', '%%') THEN
    RETURN;
  END IF;
  v_limit := least(greatest(coalesce(p_limit, 1000), 1), 1000);
  v_offset := greatest(coalesce(p_offset, 0), 0);
  RETURN QUERY
  WITH found AS MATERIALIZED (
    SELECT *
    FROM public.campaign_leads
    WHERE description ILIKE p_pattern
  )
  SELECT *
  FROM found
  ORDER BY created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.gi_campaign_leads_by_description(text, bigint, bigint) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
