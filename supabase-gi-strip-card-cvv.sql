-- =============================================================================
-- GEMEL INVEST · F-06 — stop storing card security codes
--
-- Removes cvv, cvc, cvv2, and cid from customers.payload and proposals.payload,
-- at any depth. Card number, expiry, and holder fields stay in place.
--
-- The SQL editor closes a query that runs too long. One update of every row
-- hit that limit and rolled back, so nothing was changed.
-- Run the batch below again and again. Each run cleans 15 customer files and
-- 15 proposals and shows two numbers. Stop when both numbers are 0, then run
-- the drop at the bottom once.
-- Apply on the development database first when one exists.
-- =============================================================================

set statement_timeout = '40s';

create or replace function public.gi_strip_card_security_codes(node jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = public
as $$
declare
  result jsonb;
begin
  if jsonb_typeof(node) = 'object' then
    select coalesce(jsonb_object_agg(e.key, public.gi_strip_card_security_codes(e.value)), '{}'::jsonb)
      into result
      from jsonb_each(node) as e
      where lower(e.key) not in ('cvv', 'cvc', 'cvv2', 'cid');
    return result;
  elsif jsonb_typeof(node) = 'array' then
    select coalesce(jsonb_agg(public.gi_strip_card_security_codes(t.elem) order by t.ord), '[]'::jsonb)
      into result
      from jsonb_array_elements(node) with ordinality as t(elem, ord);
    return result;
  else
    return node;
  end if;
end;
$$;

revoke all on function public.gi_strip_card_security_codes(jsonb) from public;
revoke all on function public.gi_strip_card_security_codes(jsonb) from anon;
revoke all on function public.gi_strip_card_security_codes(jsonb) from authenticated;

with cust_batch as (
  select id
  from public.customers
  where payload is not null
    and payload::text ~* '"(cvv|cvc|cvv2|cid)"[[:space:]]*:'
  limit 15
),
cust_upd as (
  update public.customers as c
  set payload = public.gi_strip_card_security_codes(c.payload)
  from cust_batch
  where c.id = cust_batch.id
  returning 1
),
prop_batch as (
  select id
  from public.proposals
  where payload is not null
    and payload::text ~* '"(cvv|cvc|cvv2|cid)"[[:space:]]*:'
  limit 15
),
prop_upd as (
  update public.proposals as p
  set payload = public.gi_strip_card_security_codes(p.payload)
  from prop_batch
  where p.id = prop_batch.id
  returning 1
)
select
  (select count(*)::int from cust_upd) as customers_updated,
  (select count(*)::int from prop_upd) as proposals_updated;

-- When both numbers above are 0, run this once:
-- drop function if exists public.gi_strip_card_security_codes(jsonb);
