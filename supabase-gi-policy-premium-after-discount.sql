-- =============================================================================
-- GEMEL INVEST · gi_policy_premium = פרמיה אחרי הנחה (כמו כרטיס «פרמיה חודשית נטו»)
--
-- ביקורת 2026-09-17: RPC gi_dashboard_net_premium הציג ₪72,286.06 (ברוטו /
-- premiumAfterDiscountValue השמור כברוטו) במקום ₪45,555.79 אחרי הנחה מהסימולטור.
-- premiumAfterDiscountValue בתיק לעיתים זהה ל-premiumMonthly; הסכום אחרי הנחה
-- יושב ב-simDiscountPerInsured.*.monthlyAfterDiscount.
--
-- תואם DashboardUI.policyNetPremium / getNewPolicyFilePremiumAfterDiscount.
-- לא נוגעים במנוע האשף (getPolicyPremiumAfterDiscount נשאר «לפני» בכוונה).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.gi_policy_sim_after_discount(p jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p IS NULL OR jsonb_typeof(p) <> 'object' THEN NULL::numeric
    WHEN btrim(coalesce(p->>'type', '')) = 'בריאות'
         AND coalesce(p->>'coverDiscountsApplied', '') IN ('true', 't')
         AND gi_num(p->>'premiumAfterCoverDiscounts') > 0
      THEN round(gi_num(p->>'premiumAfterCoverDiscounts'), 2)
    WHEN jsonb_typeof(p->'simDiscountPerInsured') = 'object' THEN (
      SELECT CASE
        WHEN COUNT(*) FILTER (
          WHERE btrim(coalesce(v->>'monthlyAfterDiscount', '')) <> ''
        ) = 0 THEN NULL::numeric
        ELSE round(SUM(gi_num(v->>'monthlyAfterDiscount')) FILTER (
          WHERE btrim(coalesce(v->>'monthlyAfterDiscount', '')) <> ''
        ), 2)
      END
      FROM jsonb_each(p->'simDiscountPerInsured') AS e(k, v)
    )
    ELSE NULL::numeric
  END
$function$;

CREATE OR REPLACE FUNCTION public.gi_policy_premium(p jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $function$
declare
  ids text[]; iid text; cov text;
  per_sum numeric := 0; addon numeric := 0;
  parts numeric; monthly numeric; stored numeric; via_file numeric := 0;
  seen text[] := '{}';
begin
  if p is null or jsonb_typeof(p) <> 'object' then return 0; end if;

  -- GI-MONTH-NET-AFTER: כמו policyNetPremium — סימולטור אחרי הנחה מנצח ברוטו שמור.
  via_file := coalesce(public.gi_policy_sim_after_discount(p), 0);
  stored := gi_num(coalesce(p->>'premiumAfterDiscountValue',
                            p->>'premiumAfterDiscount'));
  if via_file > 0 and stored > 0 and via_file < stored then
    return round(via_file, 2);
  end if;
  if stored > 0 then return round(stored, 2); end if;
  if via_file > 0 then return round(via_file, 2); end if;

  ids := gi_insured_ids(p);

  foreach iid in array ids loop
    if btrim(coalesce(p->'premiumPerInsured'->>iid, '')) <> '' then
      per_sum := per_sum + gi_num(p->'premiumPerInsured'->>iid);
    end if;
  end loop;
  per_sum := round(greatest(per_sum, 0), 2);

  if btrim(coalesce(p->>'type', '')) = 'בריאות' then
    foreach cov in array gi_cover_items(p) loop
      if cov ~ 'מחלות קשות|סרטן' and not (cov = any(seen)) then
        seen := seen || cov;
        foreach iid in array ids loop
          addon := addon + gi_num(btrim(coalesce(
                     p->'healthAddonPremiums'->cov->>iid, '')));
        end loop;
      end if;
    end loop;
    parts   := round(greatest(per_sum + addon, 0), 2);
    monthly := gi_num(coalesce(p->>'premiumMonthly', p->>'monthlyPremium'));
    if parts   > 0 then return parts;   end if;
    if monthly > 0 then return monthly; end if;
    return 0;
  else
    monthly := gi_num(coalesce(p->>'premiumMonthly', p->>'monthlyPremium',
                               p->>'premiumValue',  p->>'premium'));
    if per_sum > 0 then return per_sum; end if;
    if monthly > 0 then return monthly; end if;
    return 0;
  end if;
end
$function$;

GRANT EXECUTE ON FUNCTION public.gi_policy_sim_after_discount(jsonb) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.gi_policy_premium(jsonb) TO PUBLIC;

NOTIFY pgrst, 'reload schema';
