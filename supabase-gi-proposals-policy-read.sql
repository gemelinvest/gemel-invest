-- =============================================================================
-- GEMEL INVEST · read the installed policies on public.proposals.
-- Changes nothing.
--
-- A manager save is still rejected. The token id already matches the agent
-- card, so this file only lists the policies that decide an insert. For each
-- policy it reports the name, the command, whether it is permissive or
-- restrictive, who it applies to, and whether the manager helper is part of
-- the check. It does not read a proposal row. It does not replace a
-- function or create or drop a policy.
--
-- The only table created is temporary, for the result rows.
-- Run this once in the SQL editor. If the editor warns about a temporary
-- table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
-- =============================================================================

drop table if exists gi_proposals_policy_read;
create temporary table gi_proposals_policy_read (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_rls boolean;
  v_force boolean;
  v_count integer;
  v_restrictive integer;
  v_n integer := 0;
  v_rec record;
  v_kind text;
  v_roles text;
  v_using text;
  v_check text;
  v_cmd text;
begin
  if to_regclass('public.proposals') is null then
    insert into gi_proposals_policy_read(sort_key, section, detail) values
      (10, 'table', 'missing'),
      (900, 'changed', 'no');
    return;
  end if;

  select c.relrowsecurity, c.relforcerowsecurity
    into v_rls, v_force
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'proposals';

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'proposals';

  select count(*) into v_restrictive
  from pg_policies
  where schemaname = 'public'
    and tablename = 'proposals'
    and permissive::text in ('false', 'RESTRICTIVE', 'restrictive');

  insert into gi_proposals_policy_read(sort_key, section, detail) values
    (10, 'table', 'proposals'),
    (11, 'row_security', case when v_rls then 'on' else 'off' end),
    (12, 'force_row_security', case when v_force then 'on' else 'off' end),
    (13, 'policy_count', coalesce(v_count, 0)::text),
    (14, 'restrictive_count', coalesce(v_restrictive, 0)::text);

  for v_rec in
    select
      policyname,
      cmd,
      permissive::text as permissive_text,
      array_to_string(roles, ',') as role_list,
      coalesce(qual, '') as using_expr,
      coalesce(with_check, '') as check_expr
    from pg_policies
    where schemaname = 'public'
      and tablename = 'proposals'
    order by cmd, policyname
  loop
    v_n := v_n + 1;
    v_cmd := lower(v_rec.cmd::text);
    v_kind := case
      when v_rec.permissive_text in ('true', 'PERMISSIVE', 'permissive') then 'permissive'
      when v_rec.permissive_text in ('false', 'RESTRICTIVE', 'restrictive') then 'restrictive'
      else lower(v_rec.permissive_text)
    end;
    v_roles := coalesce(nullif(v_rec.role_list, ''), 'none');
    v_using := lower(v_rec.using_expr);
    v_check := lower(v_rec.check_expr);
    insert into gi_proposals_policy_read(sort_key, section, detail) values
      (100 + v_n * 10, 'policy', v_rec.policyname),
      (101 + v_n * 10, 'command', v_cmd),
      (102 + v_n * 10, 'kind', v_kind),
      (103 + v_n * 10, 'roles', v_roles),
      (104 + v_n * 10, 'manager_in_using', case when position('gi_jwt_is_manager' in v_using) > 0 then 'yes' else 'no' end),
      (105 + v_n * 10, 'manager_in_check', case when position('gi_jwt_is_manager' in v_check) > 0 then 'yes' else 'no' end),
      (106 + v_n * 10, 'using_is_open', case
        when v_using = '' then 'empty'
        when regexp_replace(v_using, '[()]', '', 'g') = 'true' then 'yes'
        else 'no'
      end),
      (107 + v_n * 10, 'check_is_open', case
        when v_check = '' then 'empty'
        when regexp_replace(v_check, '[()]', '', 'g') = 'true' then 'yes'
        else 'no'
      end);
  end loop;

  if v_n = 0 then
    insert into gi_proposals_policy_read(sort_key, section, detail) values
      (100, 'policy', 'none');
  end if;

  insert into gi_proposals_policy_read(sort_key, section, detail) values
    (900, 'changed', 'no');
end
$body$;

select section, detail
from gi_proposals_policy_read
order by sort_key;
