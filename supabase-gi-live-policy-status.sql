-- =============================================================================
-- GEMEL INVEST · read the live policies on three live tables.
--
-- The tables are public.gi_agent_live, public.gi_system_notices, and
-- public.gi_ops_events. This file changes nothing. It does not create a
-- policy, drop a policy, turn row security on, revoke anything, or read a
-- stored row. The only table it creates is temporary, for the result rows.
-- A missing table is reported, and the other two are still read.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
-- =============================================================================

drop table if exists gi_rls_live_status;
create temporary table gi_rls_live_status (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_tables text[] := array['gi_agent_live', 'gi_system_notices', 'gi_ops_events'];
  v_table text;
  v_base integer := 0;
  v_rls boolean;
  v_rows integer := 0;
  v_open integer := 0;
  v_sort integer;
  v_name text;
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
  foreach v_table in array v_tables loop
    v_base := v_base + 1000;
    v_sort := v_base + 20;

    if to_regclass('public.' || v_table) is null then
      insert into gi_rls_live_status(sort_key, section, detail) values
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

    execute format('select count(*) from public.%I', v_table) into v_rows;

    select count(*) into v_open
    from pg_policies
    where schemaname = 'public'
      and tablename = v_table
      and permissive::text in ('PERMISSIVE', 'true', 't')
      and cmd in ('ALL', 'SELECT')
      and ('anon' = any (roles) or 'public' = any (roles))
      and (qual is null or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true');

    insert into gi_rls_live_status(sort_key, section, detail) values
      (v_base + 1, 'table', v_table),
      (v_base + 2, 'rls_enabled', case when v_rls then 'yes' else 'no' end),
      (v_base + 3, 'rows_present', case when v_rows > 0 then 'yes' else 'no' end),
      (v_base + 4, 'open_read', case when v_open > 0 then 'yes' else 'no' end),
      (v_base + 5, 'changed', 'no');

    for v_name, v_cmd, v_roles, v_qual, v_check, v_permissive in
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

      insert into gi_rls_live_status(sort_key, section, detail)
      values (v_sort, 'policy', v_table || '|' || v_name || '|' || v_cmd || '|' || v_who || '|' || v_open_label);
      v_sort := v_sort + 1;
    end loop;
  end loop;
end
$body$;

select section, detail
from gi_rls_live_status
order by sort_key;
