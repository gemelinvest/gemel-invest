-- =============================================================================
-- GEMEL INVEST · read the JWT helper functions. Changes nothing.
--
-- The functions are gi_jwt_agent_id, gi_jwt_is_manager, and gi_jwt_role.
-- This file does not replace them, does not create a policy, and does not
-- read a customer, agent, or file row. The only table it creates is
-- temporary, for the result rows. A missing function is reported.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
-- =============================================================================

drop table if exists gi_rls_jwt_helper_status;
create temporary table gi_rls_jwt_helper_status (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_names text[] := array['gi_jwt_agent_id', 'gi_jwt_is_manager', 'gi_jwt_role'];
  v_name text;
  v_oid regprocedure;
  v_src text;
  v_base integer := 0;
  v_app text;
  v_link text;
  v_user text;
begin
  foreach v_name in array v_names loop
    v_base := v_base + 10;
    v_oid := to_regprocedure('public.' || v_name || '()');
    if v_oid is null then
      insert into gi_rls_jwt_helper_status(sort_key, section, detail) values
        (v_base + 1, 'function', v_name),
        (v_base + 2, 'present', 'no');
    else
      v_src := lower(pg_get_functiondef(v_oid));
      v_app := case when position('app_metadata' in v_src) > 0 then 'yes' else 'no' end;
      v_link := case when position('auth_user_id' in v_src) > 0 then 'yes' else 'no' end;
      v_user := case when position('user_metadata' in v_src) > 0 then 'yes' else 'no' end;
      insert into gi_rls_jwt_helper_status(sort_key, section, detail) values
        (v_base + 1, 'function', v_name),
        (v_base + 2, 'present', 'yes'),
        (v_base + 3, 'app_metadata', v_app),
        (v_base + 4, 'auth_user_id', v_link),
        (v_base + 5, 'user_metadata', v_user);
    end if;
  end loop;
  insert into gi_rls_jwt_helper_status(sort_key, section, detail) values
    (100, 'changed', 'no');
end
$body$;

select section, detail
from gi_rls_jwt_helper_status
order by sort_key;
