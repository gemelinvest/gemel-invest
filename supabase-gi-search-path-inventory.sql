-- =============================================================================
-- GEMEL INVEST · ממצא 5 בדוח Onyx (24.11.2026)
-- קריאה בלבד. הקובץ הזה לא משנה פונקציה, הרשאה, RLS או כניסה.
--
-- מריצים את כל הקובץ ב-SQL Editor ומדביקים את ארבע תוצאות הדוח.
-- בלי התוצאות האלה לא קובעים search_path.
-- =============================================================================

select 'schema_acl' as report,
       n.nspname as schema_name,
       n.nspacl is null as acl_is_default,
       coalesce(array_to_string(n.nspacl, ' | '), '') as acl
from pg_namespace n
where n.nspname in ('public', 'extensions')
order by n.nspname;

select 'create_grants' as report,
       n.nspname as schema_name,
       case when a.grantee = 0 then 'PUBLIC' else r.rolname end as grantee,
       a.privilege_type
from pg_namespace n
cross join lateral aclexplode(n.nspacl) a
left join pg_roles r on r.oid = a.grantee
where n.nspname in ('public', 'extensions')
  and a.privilege_type = 'CREATE'
  and (a.grantee = 0 or r.rolname in ('anon', 'authenticated'))
order by n.nspname, grantee;

select 'missing_search_path' as report,
       p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       case
         when exists (select 1 from pg_roles where rolname = 'anon')
           then has_function_privilege('anon', p.oid, 'EXECUTE')
         else null
       end as anon_exec,
       case
         when exists (select 1 from pg_roles where rolname = 'authenticated')
           then has_function_privilege('authenticated', p.oid, 'EXECUTE')
         else null
       end as auth_exec,
       (
         p.proacl is null
         or exists (
           select 1
           from aclexplode(p.proacl) a
           where a.grantee = 0
             and a.privilege_type = 'EXECUTE'
         )
       ) as public_exec,
       (
         p.prosrc ~* '(^|[^[:alnum:]_$.])(crypt|gen_salt|digest|hmac|gen_random_bytes|gen_random_uuid|uuid_generate_v[0-9]|pgp_sym_encrypt|pgp_sym_decrypt)\s*\('
         or p.prosrc ~* '(^|[^[:alnum:]_])extensions\.'
       ) as uses_extension,
       p.proname in (
         'gi_verify_agent_login',
         'gi_verify_admin_login',
         'gi_verify_sensitive_pin',
         'gi_login_roster'
       ) as login_gate,
       p.proname in (
         'onyx_customer_portal_open',
         'onyx_customer_portal_doc',
         'onyx_disclosure_link_open',
         'onyx_review_open',
         'ingest_landing_lead',
         'gi_publish_plasma_model'
       ) as public_product
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and not exists (
    select 1
    from unnest(coalesce(p.proconfig, array[]::text[])) cfg
    where cfg like 'search_path=%'
  )
order by login_gate desc, public_product desc, uses_extension desc, p.proname;

select 'login_and_portal' as report,
       p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       exists (
         select 1
         from unnest(coalesce(p.proconfig, array[]::text[])) cfg
         where cfg like 'search_path=%'
       ) as has_search_path,
       case
         when exists (select 1 from pg_roles where rolname = 'anon')
           then has_function_privilege('anon', p.oid, 'EXECUTE')
         else null
       end as anon_exec,
       (
         p.prosrc ~* '(^|[^[:alnum:]_$.])(crypt|gen_salt|digest|hmac|gen_random_bytes|gen_random_uuid|uuid_generate_v[0-9]|pgp_sym_encrypt|pgp_sym_decrypt)\s*\('
         or p.prosrc ~* '(^|[^[:alnum:]_])extensions\.'
       ) as uses_extension
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'gi_verify_agent_login',
    'gi_verify_admin_login',
    'gi_verify_sensitive_pin',
    'gi_login_roster',
    'onyx_customer_portal_open',
    'onyx_customer_portal_doc',
    'onyx_disclosure_link_open',
    'onyx_review_open',
    'ingest_landing_lead',
    'gi_publish_plasma_model'
  )
order by p.proname;
