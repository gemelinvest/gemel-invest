-- =============================================================================
-- GEMEL INVEST · F-06 — stop storing card security codes
--
-- Removes cvv, cvc, cvv2, and cid from customers.payload and proposals.payload,
-- at any depth. Card number, expiry, and holder fields are left in place until
-- a payment vault exists. This script does not call a payment provider.
--
-- Apply once in the Supabase SQL editor, on the development database first.
-- The function exists only inside this transaction and is dropped before commit,
-- so it is never left exposed as an RPC.
-- =============================================================================

begin;

create or replace function public.gi_strip_card_security_codes(node jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = public
as $$
declare
  key text;
  val jsonb;
  out jsonb;
begin
  if jsonb_typeof(node) = 'object' then
    out := '{}'::jsonb;
    for key, val in select * from jsonb_each(node)
    loop
      if lower(key) in ('cvv', 'cvc', 'cvv2', 'cid') then
        continue;
      end if;
      out := out || jsonb_build_object(key, public.gi_strip_card_security_codes(val));
    end loop;
    return out;
  elsif jsonb_typeof(node) = 'array' then
    select coalesce(jsonb_agg(public.gi_strip_card_security_codes(elem) order by ord), '[]'::jsonb)
      into out
      from jsonb_array_elements(node) with ordinality as t(elem, ord);
    return out;
  else
    return node;
  end if;
end;
$$;

revoke all on function public.gi_strip_card_security_codes(jsonb) from public;
revoke all on function public.gi_strip_card_security_codes(jsonb) from anon;
revoke all on function public.gi_strip_card_security_codes(jsonb) from authenticated;

update public.customers
set payload = public.gi_strip_card_security_codes(payload)
where payload is not null
  and payload::text ~* '"(cvv|cvc|cvv2|cid)"[[:space:]]*:';

update public.proposals
set payload = public.gi_strip_card_security_codes(payload)
where payload is not null
  and payload::text ~* '"(cvv|cvc|cvv2|cid)"[[:space:]]*:';

drop function public.gi_strip_card_security_codes(jsonb);

commit;
