-- =============================================================================
-- GEMEL INVEST · read the agent policies before a role cut.
--
-- The table is public.agents. The screen reads it for the roster. This
-- file changes nothing. It does not create a policy, drop a policy, turn
-- row security on, revoke anything, or read an agent. The only table it
-- creates is temporary, for the result rows. A missing table is reported.
--
-- It also reports the facts the next cut depends on. The column names are
-- reported, including whether pin, role, email, and auth_user_id exist.
-- A cut must not assume one of those columns. A capital-letter role
-- comparison (teamManager or opsAgent) would not match, because the role
-- helper returns a lowercase value. A policy that treats a blank id as
-- allowed leaves that agent open to every signed-in person.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
-- =============================================================================

drop table if exists gi_rls_agents_role_status;
create temporary table gi_rls_agents_role_status (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $status$
declare
  v_rls boolean;
  v_pin boolean;
  v_role boolean;
  v_email boolean;
  v_auth boolean;
  v_columns text;
  v_mixed boolean;
  v_blank boolean;
  v_sort integer := 20;
  v_policy text;
  v_cmd text;
  v_roles text[];
  v_qual text;
  v_check text;
  v_permissive text;
  v_who text;
  v_open_label text;
  v_qual_true boolean;
  v_check_true boolean;
begin
  if to_regclass('public.agents') is null then
    insert into gi_rls_agents_role_status(sort_key, section, detail) values
      (1, 'table', 'agents'),
      (2, 'present', 'no'),
      (3, 'changed', 'no');
    return;
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'agents';

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'pin'
  ) into v_pin;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'role'
  ) into v_role;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'email'
  ) into v_email;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'auth_user_id'
  ) into v_auth;

  select coalesce(string_agg(column_name, '|' order by ordinal_position), '')
    into v_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'agents';

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents'
      and (
        coalesce(qual, '') ~ 'teamManager|opsAgent'
        or coalesce(with_check, '') ~ 'teamManager|opsAgent'
      )
  ) into v_mixed;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents'
      and (
        coalesce(qual, '') ~* $re$id[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~* $re$id[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(qual, '') ~* $re$id[[:space:]]+is[[:space:]]+null$re$
        or coalesce(with_check, '') ~* $re$id[[:space:]]+is[[:space:]]+null$re$
      )
  ) into v_blank;

  insert into gi_rls_agents_role_status(sort_key, section, detail) values
    (1, 'table', 'agents'),
    (2, 'present', 'yes'),
    (3, 'rls', case when v_rls then 'yes' else 'no' end),
    (4, 'pin', case when v_pin then 'yes' else 'no' end),
    (5, 'role', case when v_role then 'yes' else 'no' end),
    (6, 'email', case when v_email then 'yes' else 'no' end),
    (7, 'auth_user_id', case when v_auth then 'yes' else 'no' end),
    (8, 'columns', v_columns),
    (9, 'role_literal', case when v_mixed then 'mixed' else 'lower' end),
    (10, 'blank_id', case when v_blank then 'yes' else 'no' end),
    (11, 'changed', 'no');

  for v_policy, v_cmd, v_roles, v_qual, v_check, v_permissive in
    select p.policyname, p.cmd, p.roles, p.qual, p.with_check, p.permissive::text
    from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'agents'
    order by p.policyname
  loop
    if ('anon' = any (v_roles) or 'public' = any (v_roles))
       and 'authenticated' = any (v_roles) then
      v_who := 'public+signed_in';
    elsif 'anon' = any (v_roles) or 'public' = any (v_roles) then
      v_who := 'public';
    elsif 'authenticated' = any (v_roles) then
      v_who := 'signed_in';
    else
      v_who := 'other';
    end if;

    v_qual_true := v_qual is null
      or regexp_replace(lower(btrim(v_qual)), '[()]', '', 'g') = 'true';
    v_check_true := v_check is null
      or regexp_replace(lower(btrim(v_check)), '[()]', '', 'g') = 'true';

    if v_permissive not in ('PERMISSIVE', 'true', 't') then
      v_open_label := 'limited';
    elsif v_cmd = 'SELECT' then
      v_open_label := case when v_qual_true then 'open' else 'limited' end;
    elsif v_cmd = 'INSERT' then
      v_open_label := case when v_check_true then 'open' else 'limited' end;
    elsif v_cmd = 'DELETE' then
      v_open_label := case when v_qual_true then 'open' else 'limited' end;
    elsif v_cmd in ('UPDATE', 'ALL') then
      v_open_label := case when v_qual_true and v_check_true then 'open' else 'limited' end;
    else
      v_open_label := 'limited';
    end if;

    insert into gi_rls_agents_role_status(sort_key, section, detail)
    values (v_sort, 'policy', v_policy || '|' || v_cmd || '|' || v_who || '|' || v_open_label);
    v_sort := v_sort + 1;
  end loop;
end
$status$;

select section, detail
from gi_rls_agents_role_status
order by sort_key;
