-- =============================================================================
-- GEMEL INVEST · turn off three accounts that must not sign in.
--
-- Run once after this file is on main. If the editor warns about a temporary
-- table, choose Run without RLS.
--
-- Turns off only:
--   VALIDATOR_PROBE_DELETE_ME
--   NOOP
--   סוקרת
--
-- The nine accounts that still sign in with a username and a code are not
-- changed. Pins, emails, and authenticator settings stay as they are.
-- Login for a turned-off account stops because the PIN check only accepts
-- an active account.
--
-- To turn one back on, set active = true for that id only.
-- =============================================================================

drop table if exists gi_disable_result;
create temp table gi_disable_result (
  kind text,
  detail text
);

do $$
declare
  n int := 0;
begin
  update public.agents
     set active = false
   where (id = '__PROBE_AGENTS__' and name = 'VALIDATOR_PROBE_DELETE_ME')
      or (id = '__NOOP__' and name = 'NOOP')
      or (id = 'a_5a54433a98aba_1a13b463f71' and name = 'סוקרת');
  get diagnostics n = row_count;

  if n <> 3 then
    raise exception 'expected to turn off 3 accounts, updated %', n;
  end if;

  insert into gi_disable_result(kind, detail)
  values ('disabled', n::text);
end
$$;

select kind, detail
from gi_disable_result
order by kind;
