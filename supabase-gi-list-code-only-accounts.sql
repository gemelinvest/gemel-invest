-- =============================================================================
-- GEMEL INVEST · read-only list of active accounts that still sign in with a
-- username and a code. The rule matches loginRequiresMfa: a boolean
-- authenticator flag or a saved factor means the barcode is already required.
--
-- Nothing is written. Addresses, codes, and authenticator secrets are not
-- selected. Inactive accounts are counted and not listed.
-- Run after this file is on main. Running it again changes nothing.
-- =============================================================================

with security as (
  select
    a.id,
    a.name,
    a.role,
    coalesce(a.active, true) as is_active,
    nullif(btrim(coalesce(a.email, '')), '') as address,
    a.auth_user_id,
    case
      when jsonb_typeof(m.payload #> array['agentSecurity', a.id]) = 'object'
        then m.payload #> array['agentSecurity', a.id]
      else null
    end as sec
  from public.agents a
  left join public.app_meta m on m.key = 'global'
),
flags as (
  select
    s.*,
    (
      (jsonb_typeof(s.sec->'mfaRequired') = 'boolean' and (s.sec->>'mfaRequired') = 'true')
      or (jsonb_typeof(s.sec->'mfa_required') = 'boolean' and (s.sec->>'mfa_required') = 'true')
      or (jsonb_typeof(s.sec->'mfaEnabled') = 'boolean' and (s.sec->>'mfaEnabled') = 'true')
      or (jsonb_typeof(s.sec->'mfa_enabled') = 'boolean' and (s.sec->>'mfa_enabled') = 'true')
      or (jsonb_typeof(s.sec->'mfaResetPending') = 'boolean' and (s.sec->>'mfaResetPending') = 'true')
      or (jsonb_typeof(s.sec->'mfa_reset_pending') = 'boolean' and (s.sec->>'mfa_reset_pending') = 'true')
      or nullif(btrim(coalesce(s.sec->>'factorId', '')), '') is not null
      or nullif(btrim(coalesce(s.sec->>'factor_id', '')), '') is not null
    ) as barcode_required,
    (
      select count(*)
      from public.agents o
      where coalesce(o.active, true)
        and btrim(coalesce(o.name, '')) <> ''
        and btrim(coalesce(o.name, '')) = btrim(coalesce(s.name, ''))
    ) as name_count
  from security s
),
code_only as (
  select *
  from flags
  where is_active
    and barcode_required is not true
)
select section, name, detail, role, has_address, has_sign_in, authenticator, same_name, account_id
from (
  select
    0 as sort_group,
    1 as sort_item,
    'count'::text as section,
    'active_accounts'::text as name,
    (select count(*) from flags where is_active)::text as detail,
    ''::text as role,
    ''::text as has_address,
    ''::text as has_sign_in,
    ''::text as authenticator,
    ''::text as same_name,
    ''::text as account_id
  union all
  select
    0, 2, 'count', 'code_only',
    (select count(*) from code_only)::text,
    '', '', '', '', '', ''
  union all
  select
    0, 3, 'count', 'barcode_required',
    (select count(*) from flags where is_active and barcode_required)::text,
    '', '', '', '', '', ''
  union all
  select
    0, 4, 'count', 'inactive_skipped',
    (select count(*) from flags where not is_active)::text,
    '', '', '', '', '', ''
  union all
  select
    1,
    0,
    'account',
    btrim(coalesce(c.name, '')),
    '',
    btrim(coalesce(c.role, '')),
    case
      when c.address is not null and position('@' in c.address) > 0 then 'yes'
      else 'no'
    end,
    case
      when c.auth_user_id is not null
        or nullif(btrim(coalesce(c.sec->>'authUserId', '')), '') is not null
        or nullif(btrim(coalesce(c.sec->>'auth_user_id', '')), '') is not null
        then 'yes'
      else 'no'
    end,
    'not_required',
    case when c.name_count > 1 then 'yes' else 'no' end,
    c.id
  from code_only c
) listed
order by sort_group, sort_item, name, account_id;
