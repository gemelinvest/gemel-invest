-- =============================================================================
-- GEMEL INVEST · read the customer-file policies before a role cut.
--
-- The bucket is gi-customer-files. Policies live on storage.objects, which
-- also holds every other bucket, so every policy on that table is listed.
-- A policy whose rule is simply true covers the whole storage table. A
-- policy whose only rule is this bucket is open to everyone it applies to.
-- Anything else that names this bucket is limited. Anything else is other.
--
-- This file changes nothing. It does not create a policy, drop a policy,
-- turn row security on, revoke anything, or read a file name or file
-- bytes. The only table it creates is temporary, for the result rows.
-- A missing bucket or table is reported.
--
-- It also reports whether gi_storage_customer_allowed exists and whether
-- it is security definer, and whether a policy or that function compares
-- teamManager or opsAgent with capital letters. The role helper returns
-- lowercase, so that comparison would not match after the open path is
-- removed.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
-- =============================================================================

drop table if exists gi_rls_files_role_status;
create temporary table gi_rls_files_role_status (
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
  v_helper boolean := false;
  v_definer boolean := false;
  v_mixed boolean := false;
  v_open boolean := false;
  v_src text := '';
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
  v_text text;
  v_norm_qual text;
  v_norm_check text;
  v_qual_true boolean;
  v_check_true boolean;
  v_bucket_qual boolean;
  v_bucket_check boolean;
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
  end if;

  v_helper := to_regprocedure('public.gi_storage_customer_allowed(text)') is not null;
  if v_helper then
    v_src := pg_get_functiondef('public.gi_storage_customer_allowed(text)'::regprocedure);
    v_definer := position('security definer' in lower(v_src)) > 0;
    v_mixed := v_src ~ 'teamManager|opsAgent';
  end if;

  if v_objects and not v_mixed then
    select exists (
      select 1 from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and (
          coalesce(qual, '') ~ 'teamManager|opsAgent'
          or coalesce(with_check, '') ~ 'teamManager|opsAgent'
        )
    ) into v_mixed;
  end if;

  if v_objects then
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
      v_norm_qual := replace(replace(
        regexp_replace(lower(coalesce(v_qual, '')), '[[:space:]()'']', '', 'g'),
        chr(34), ''), '::text', '');
      v_norm_check := replace(replace(
        regexp_replace(lower(coalesce(v_check, '')), '[[:space:]()'']', '', 'g'),
        chr(34), ''), '::text', '');
      v_bucket_qual := v_norm_qual = 'bucket_id=gi-customer-files';
      v_bucket_check := v_norm_check = 'bucket_id=gi-customer-files';

      if v_cmd in ('UPDATE', 'ALL') then
        if v_qual_true and v_check_true then
          v_scope := 'whole_storage';
        elsif position('gi-customer-files' in v_text) > 0 or v_bucket_qual or v_bucket_check then
          v_scope := 'this_bucket';
        else
          v_scope := 'other';
        end if;
      elsif v_cmd = 'INSERT' then
        if v_check_true then
          v_scope := 'whole_storage';
        elsif position('gi-customer-files' in v_text) > 0 or v_bucket_check then
          v_scope := 'this_bucket';
        else
          v_scope := 'other';
        end if;
      else
        if v_qual_true then
          v_scope := 'whole_storage';
        elsif position('gi-customer-files' in v_text) > 0 or v_bucket_qual then
          v_scope := 'this_bucket';
        else
          v_scope := 'other';
        end if;
      end if;

      if v_permissive not in ('PERMISSIVE', 'true', 't') then
        v_label := 'limited';
      elsif v_scope = 'whole_storage' then
        v_label := 'open';
      elsif v_scope = 'this_bucket' and (
        (v_cmd in ('UPDATE', 'ALL') and v_bucket_qual and v_bucket_check)
        or (v_cmd = 'INSERT' and v_bucket_check)
        or (v_cmd not in ('UPDATE', 'ALL', 'INSERT') and v_bucket_qual)
      ) then
        v_label := 'open';
      elsif v_scope = 'this_bucket' then
        v_label := 'limited';
      else
        v_label := 'limited';
      end if;

      if v_label = 'open' then
        v_open := true;
      end if;

      insert into gi_rls_files_role_status(sort_key, section, detail)
      values (
        v_sort,
        'policy',
        'storage.objects|' || v_name || '|' || v_cmd || '|' || v_who || '|' || v_scope || '|' || v_label
      );
      v_sort := v_sort + 1;
    end loop;
  end if;

  insert into gi_rls_files_role_status(sort_key, section, detail) values
    (1, 'bucket', 'gi-customer-files'),
    (2, 'present', case when v_bucket then 'yes' else 'no' end),
    (3, 'public', case when v_bucket and v_public then 'yes' when v_bucket then 'no' else 'unknown' end),
    (4, 'objects', case when v_objects then 'yes' else 'no' end),
    (5, 'rls', case when v_objects and v_rls then 'yes' when v_objects then 'no' else 'unknown' end),
    (6, 'helper', case when v_helper then 'yes' else 'no' end),
    (7, 'definer', case when v_helper and v_definer then 'yes' when v_helper then 'no' else 'unknown' end),
    (8, 'role_literal', case when v_mixed then 'mixed' else 'lower' end),
    (9, 'open_path', case when not v_objects then 'unknown' when v_open then 'yes' else 'no' end),
    (10, 'changed', 'no');
end
$body$;

select section, detail
from gi_rls_files_role_status
order by sort_key;
