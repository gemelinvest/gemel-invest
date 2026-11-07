-- =============================================================================
-- GEMEL INVEST · read the live-floor and system-notice policies.
--
-- The tables are public.gi_agent_live and public.gi_system_notices.
-- This file changes nothing. It does not create a policy, drop a policy,
-- turn row security on, revoke anything, or read a stored row. The only
-- table it creates is temporary, for the result rows. A missing table is
-- reported and the other table is still described.
--
-- The floor screen reads every online row and each person writes their own
-- heartbeat. A system notice is a message every signed-in person can read.
-- agent_id and author_id are reported, and so are the column names.
-- A capital-letter role comparison (teamManager or opsAgent) would not
-- match, because the role helper returns a lowercase value.
-- A policy that treats a blank agent_id or author_id as allowed leaves that
-- row open to every signed-in person.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
-- =============================================================================

drop table if exists gi_rls_live_role_status;
create temporary table gi_rls_live_role_status (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $status$
declare
  v_table text;
  v_base integer;
  v_rls boolean;
  v_agent boolean;
  v_author boolean;
  v_author_name boolean;
  v_columns text;
  v_key text;
  v_mixed boolean;
  v_blank boolean;
  v_sort integer;
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
  v_tables text[] := array['gi_agent_live', 'gi_system_notices'];
begin
  foreach v_table in array v_tables
  loop
    v_base := case when v_table = 'gi_agent_live' then 0 else 100 end;

    if to_regclass('public.' || v_table) is null then
      insert into gi_rls_live_role_status(sort_key, section, detail) values
        (v_base + 1, 'table', v_table),
        (v_base + 2, 'present', 'no'),
        (v_base + 3, 'changed', 'no');
      continue;
    end if;

    select c.relrowsecurity
      into v_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = v_table;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = v_table
        and column_name = 'agent_id'
    ) into v_agent;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = v_table
        and column_name = 'author_id'
    ) into v_author;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = v_table
        and column_name = 'author_name'
    ) into v_author_name;

    select coalesce(string_agg(column_name, '|' order by ordinal_position), '')
      into v_columns
    from information_schema.columns
    where table_schema = 'public'
      and table_name = v_table;

    v_key := case when v_table = 'gi_agent_live' then 'agent_id' else 'author_id' end;

    select exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = v_table
        and (
          coalesce(qual, '') ~ 'teamManager|opsAgent'
          or coalesce(with_check, '') ~ 'teamManager|opsAgent'
        )
    ) into v_mixed;

    select exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = v_table
        and (
          coalesce(qual, '') ~* (v_key || $re$[[:space:]]*=[[:space:]]*''(::text)?$re$)
          or coalesce(with_check, '') ~* (v_key || $re$[[:space:]]*=[[:space:]]*''(::text)?$re$)
          or coalesce(qual, '') ~* ($re$coalesce[[:space:]]*\([[:space:]]*$re$ || v_key || $re$[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$)
          or coalesce(with_check, '') ~* ($re$coalesce[[:space:]]*\([[:space:]]*$re$ || v_key || $re$[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$)
          or coalesce(qual, '') ~* (v_key || $re$[[:space:]]+is[[:space:]]+null$re$)
          or coalesce(with_check, '') ~* (v_key || $re$[[:space:]]+is[[:space:]]+null$re$)
        )
    ) into v_blank;

    if v_table = 'gi_agent_live' then
      insert into gi_rls_live_role_status(sort_key, section, detail) values
        (v_base + 1, 'table', v_table),
        (v_base + 2, 'present', 'yes'),
        (v_base + 3, 'rls', case when v_rls then 'yes' else 'no' end),
        (v_base + 4, 'agent_id', case when v_agent then 'yes' else 'no' end),
        (v_base + 5, 'columns', v_columns),
        (v_base + 6, 'role_literal', case when v_mixed then 'mixed' else 'lower' end),
        (v_base + 7, 'blank_agent', case when v_blank then 'yes' else 'no' end),
        (v_base + 8, 'changed', 'no');
    else
      insert into gi_rls_live_role_status(sort_key, section, detail) values
        (v_base + 1, 'table', v_table),
        (v_base + 2, 'present', 'yes'),
        (v_base + 3, 'rls', case when v_rls then 'yes' else 'no' end),
        (v_base + 4, 'author_id', case when v_author then 'yes' else 'no' end),
        (v_base + 5, 'author_name', case when v_author_name then 'yes' else 'no' end),
        (v_base + 6, 'columns', v_columns),
        (v_base + 7, 'role_literal', case when v_mixed then 'mixed' else 'lower' end),
        (v_base + 8, 'blank_author', case when v_blank then 'yes' else 'no' end),
        (v_base + 9, 'changed', 'no');
    end if;

    v_sort := v_base + 20;
    for v_policy, v_cmd, v_roles, v_qual, v_check, v_permissive in
      select p.policyname,
             p.cmd,
             p.roles,
             p.qual,
             p.with_check,
             p.permissive::text
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = v_table
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

      insert into gi_rls_live_role_status(sort_key, section, detail)
      values (v_sort, 'policy', v_policy || '|' || v_cmd || '|' || v_who || '|' || v_open_label);
      v_sort := v_sort + 1;
    end loop;
  end loop;
end
$status$;

select section, detail
from gi_rls_live_role_status
order by sort_key;
