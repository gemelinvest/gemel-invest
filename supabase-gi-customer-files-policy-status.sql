-- =============================================================================
-- GEMEL INVEST · read the policies on customer file storage.
--
-- The bucket is gi-customer-files. Policies live on storage.objects, which
-- also holds every other bucket, so every policy on that table is listed.
-- A policy whose rule is simply true covers the whole storage table. A
-- policy that names this bucket covers this bucket. Anything else is other.
--
-- This file changes nothing. It does not create a policy, drop a policy,
-- turn row security on, revoke anything, or read a file name or file
-- bytes. The only table it creates is temporary, for the result rows.
-- A missing bucket or table is reported.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
-- =============================================================================

drop table if exists gi_rls_files_status;
create temporary table gi_rls_files_status (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_bucket boolean := false;
  v_public boolean := false;
  v_objects boolean := false;
  v_rls boolean := false;
  v_rows integer := 0;
  v_open integer := 0;
  v_sort integer := 20;
  v_name text;
  v_cmd text;
  v_roles text[];
  v_qual text;
  v_check text;
  v_permissive text;
  v_who text;
  v_scope text;
  v_label text;
  v_qual_true boolean;
  v_check_true boolean;
  v_text text;
begin
  v_objects := to_regclass('storage.objects') is not null;
  if to_regclass('storage.buckets') is not null then
    execute 'select exists (select 1 from storage.buckets where id = ''gi-customer-files'')'
      into v_bucket;
    if v_bucket then
      execute 'select b.public from storage.buckets b where b.id = ''gi-customer-files'''
        into v_public;
    end if;
  end if;

  if v_objects then
    select c.relrowsecurity into v_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage'
      and c.relname = 'objects';

    select count(*) into v_rows
    from storage.objects
    where bucket_id = 'gi-customer-files';

    select count(*) into v_open
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and permissive::text in ('PERMISSIVE', 'true', 't')
      and cmd in ('ALL', 'SELECT')
      and ('anon' = any (roles) or 'public' = any (roles))
      and (
        qual is null
        or regexp_replace(lower(btrim(qual)), '[()]', '', 'g') = 'true'
        or position('gi-customer-files' in lower(qual)) > 0
      );
  end if;

  insert into gi_rls_files_status(sort_key, section, detail) values
    (1, 'bucket', 'gi-customer-files'),
    (2, 'bucket_present', case when v_bucket then 'yes' else 'no' end),
    (3, 'bucket_public', case when v_bucket and v_public then 'yes' when v_bucket then 'no' else 'unknown' end),
    (4, 'objects_present', case when v_objects then 'yes' else 'no' end),
    (5, 'rls_enabled', case when v_objects and v_rls then 'yes' when v_objects then 'no' else 'unknown' end),
    (6, 'rows_present', case when not v_objects then 'unknown' when v_rows > 0 then 'yes' else 'no' end),
    (7, 'open_read', case when v_open > 0 then 'yes' else 'no' end),
    (8, 'changed', 'no');

  if not v_objects then
    return;
  end if;

  for v_name, v_cmd, v_roles, v_qual, v_check, v_permissive in
    select p.policyname,
           p.cmd,
           p.roles,
           p.qual,
           p.with_check,
           p.permissive::text
    from pg_policies p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
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
    v_text := lower(coalesce(v_qual, '') || ' ' || coalesce(v_check, ''));

    if v_cmd in ('UPDATE', 'ALL') then
      if v_qual_true and v_check_true then
        v_scope := 'whole_storage';
      elsif position('gi-customer-files' in v_text) > 0 then
        v_scope := 'this_bucket';
      else
        v_scope := 'other';
      end if;
    elsif v_cmd = 'INSERT' then
      if v_check_true then
        v_scope := 'whole_storage';
      elsif position('gi-customer-files' in v_text) > 0 then
        v_scope := 'this_bucket';
      else
        v_scope := 'other';
      end if;
    else
      if v_qual_true then
        v_scope := 'whole_storage';
      elsif position('gi-customer-files' in v_text) > 0 then
        v_scope := 'this_bucket';
      else
        v_scope := 'other';
      end if;
    end if;

    if v_permissive not in ('PERMISSIVE', 'true', 't') then
      v_label := 'limited';
    elsif v_scope = 'whole_storage' then
      v_label := 'open';
    elsif v_scope = 'this_bucket' then
      v_label := 'bucket';
    else
      v_label := 'limited';
    end if;

    insert into gi_rls_files_status(sort_key, section, detail)
    values (v_sort, 'policy', 'storage.objects|' || v_name || '|' || v_cmd || '|' || v_who || '|' || v_scope || '|' || v_label);
    v_sort := v_sort + 1;
  end loop;
end
$body$;

select section, detail
from gi_rls_files_status
order by sort_key;
