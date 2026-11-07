-- =============================================================================
-- GEMEL INVEST · stop the JWT helpers from reading user_metadata.
--
-- gi_jwt_agent_id and gi_jwt_is_manager already read app_metadata, and they
-- also read user_metadata. A signed-in user can edit user_metadata.
-- gi_jwt_role reads both, and it already looks up agents.auth_user_id.
--
-- This file replaces those three functions. The role comes from app_metadata,
-- then from the agents row linked by auth_user_id. user_metadata is not read.
-- No policy is created or dropped. No customer, agent, or file row is changed.
--
-- The wide signed-in policies stay. This does not hide rows. If the new
-- function text still mentions user_metadata, or a policy count changes, the
-- whole script stops and saves nothing.
--
-- Run this once, after it is on main. Paste the result rows. If it stops
-- with an error, paste only the error text and do not run it again.
--
-- Undo for this file alone, and only if a later check asks for it: re-apply
-- supabase-gi-jwt-helpers-fix.sql and supabase-gi-jwt-helpers-role.sql from
-- the commit before this change.
-- =============================================================================

drop table if exists gi_rls_jwt_helper_cut;
create temporary table gi_rls_jwt_helper_cut (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_before integer;
begin
  select count(*) into v_before from pg_policy;
  insert into gi_rls_jwt_helper_cut(sort_key, section, detail) values
    (1, 'policies_before', v_before::text);
end
$body$;

create or replace function public.gi_jwt_agent_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(auth.jwt() -> 'app_metadata' ->> 'agent_id'), ''),
    (select a.id from public.agents a where a.auth_user_id = auth.uid() limit 1),
    ''
  );
$$;

create or replace function public.gi_jwt_is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(
    nullif(trim(auth.jwt() -> 'app_metadata' ->> 'role'), ''),
    (select lower(coalesce(a.role, '')) from public.agents a where a.auth_user_id = auth.uid() limit 1),
    ''
  )) in ('admin', 'owner', 'manager', 'adminlite', 'מנהל');
$$;

create or replace function public.gi_jwt_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(
    nullif(trim(auth.jwt() -> 'app_metadata' ->> 'role'), ''),
    (select lower(coalesce(a.role, '')) from public.agents a where a.auth_user_id = auth.uid() limit 1),
    ''
  ));
$$;

do $body$
declare
  v_names text[] := array['gi_jwt_agent_id', 'gi_jwt_is_manager', 'gi_jwt_role'];
  v_name text;
  v_oid regprocedure;
  v_src text;
  v_base integer := 10;
  v_before integer;
  v_after integer;
begin
  select detail::integer into v_before
  from gi_rls_jwt_helper_cut
  where section = 'policies_before';
  select count(*) into v_after from pg_policy;

  foreach v_name in array v_names loop
    v_base := v_base + 10;
    v_oid := to_regprocedure('public.' || v_name || '()');
    if v_oid is null then
      raise exception 'jwt helper % is missing', v_name;
    end if;
    v_src := lower(pg_get_functiondef(v_oid));
    if position('user_metadata' in v_src) > 0 then
      raise exception 'jwt helper % still reads user_metadata', v_name;
    end if;
    if position('app_metadata' in v_src) = 0 or position('auth_user_id' in v_src) = 0 then
      raise exception 'jwt helper % lost the session or agents link', v_name;
    end if;
    if position('security definer' in v_src) = 0 then
      raise exception 'jwt helper % is not security definer', v_name;
    end if;
    insert into gi_rls_jwt_helper_cut(sort_key, section, detail) values
      (v_base + 1, 'function', v_name),
      (v_base + 2, 'user_metadata', 'no'),
      (v_base + 3, 'app_metadata', 'yes'),
      (v_base + 4, 'auth_user_id', 'yes');
  end loop;

  if v_after <> v_before then
    raise exception 'policy count changed from % to %', v_before, v_after;
  end if;
  insert into gi_rls_jwt_helper_cut(sort_key, section, detail) values
    (90, 'policies', 'unchanged'),
    (100, 'changed', 'yes');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_jwt_helper_cut
where section <> 'policies_before'
order by sort_key;
