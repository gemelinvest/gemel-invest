-- =============================================================================
-- GEMEL INVEST · inert signed-in path on customer file storage.
--
-- This file adds one authenticated policy and drops nothing:
--   gi_customer_files_all_authenticated
--
-- It is FOR ALL to authenticated, and it names only the bucket
-- gi-customer-files. It does not open any other bucket. The public door
-- gi_customer_files_all stays. The four narrower signed-in policies stay.
-- No file name or file bytes are read. No stored row is rewritten. Row
-- security is not switched on. Nothing is revoked.
--
-- The policy is added only when that public door is already the same
-- bucket rule, so a signed-in session can already reach the same files.
-- If a visible count changes, another bucket becomes visible, the door is
-- missing, or the new policy is not exactly this bucket, the whole script
-- stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   drop policy if exists gi_customer_files_all_authenticated on storage.objects;
-- =============================================================================

drop table if exists gi_rls_files_hold;
create temporary table gi_rls_files_hold (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_bucket boolean := false;
  v_public boolean := false;
  v_rls boolean := false;
  v_cmd text;
  v_qual text;
  v_check text;
  v_permissive text;
  v_roles text;
  v_has_anon boolean := false;
  v_has_auth boolean := false;
  v_norm_qual text;
  v_norm_check text;
  v_policies_before integer := 0;
  v_policies_after integer := 0;
  v_other_before integer := 0;
  v_other_after integer := 0;
  v_rows_before integer := 0;
  v_rows_after integer := 0;
  v_anon_before integer;
  v_anon_after integer;
  v_auth_before integer;
  v_auth_after integer;
  v_anon_other_before integer;
  v_anon_other_after integer;
  v_auth_other_before integer;
  v_auth_other_after integer;
  v_new boolean := false;
  v_expected integer := 0;
begin
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    raise exception 'storage table is missing; nothing saved';
  end if;

  execute 'select exists (select 1 from storage.buckets where id = ''gi-customer-files'')'
    into v_bucket;
  if v_bucket is distinct from true then
    raise exception 'bucket is missing; nothing saved';
  end if;

  execute 'select b.public from storage.buckets b where b.id = ''gi-customer-files'''
    into v_public;
  if v_public is distinct from false then
    raise exception 'bucket is public; nothing saved';
  end if;

  select c.relrowsecurity into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage' and c.relname = 'objects';
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text,
         ('anon' = any (p.roles) or 'public' = any (p.roles)),
         ('authenticated' = any (p.roles))
    into v_cmd, v_qual, v_check, v_permissive, v_has_anon, v_has_auth
  from pg_policies p
  where p.schemaname = 'storage' and p.tablename = 'objects'
    and p.policyname = 'gi_customer_files_all';
  v_norm_qual := replace(replace(
    regexp_replace(lower(coalesce(v_qual, '')), '[[:space:]()'']', '', 'g'),
    chr(34), ''), '::text', '');
  v_norm_check := replace(replace(
    regexp_replace(lower(coalesce(v_check, '')), '[[:space:]()'']', '', 'g'),
    chr(34), ''), '::text', '');
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'ALL'
     or v_has_anon is distinct from true or v_has_auth is distinct from true
     or v_norm_qual <> 'bucket_id=gi-customer-files'
     or v_norm_check <> 'bucket_id=gi-customer-files' then
    raise exception 'open door is missing; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_select_authenticated' and cmd = 'SELECT'
      and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_insert_authenticated' and cmd = 'INSERT'
      and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_update_authenticated' and cmd = 'UPDATE'
      and 'authenticated' = any (roles)
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_delete_authenticated' and cmd = 'DELETE'
      and 'authenticated' = any (roles)
  ) then
    raise exception 'narrow policies are missing; nothing saved';
  end if;

  select count(*) into v_policies_before from pg_policies
  where schemaname = 'storage' and tablename = 'objects';
  select count(*) into v_other_before from pg_policies
  where not (schemaname = 'storage' and tablename = 'objects');
  select count(*) into v_rows_before from storage.objects;

  if not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'anon') then
    raise exception 'cannot prove the signed-in read stays; nothing saved';
  end if;

  begin
    execute 'set local role anon';
    select count(*) into v_anon_before from storage.objects where bucket_id = 'gi-customer-files';
    select count(*) into v_anon_other_before from storage.objects where bucket_id <> 'gi-customer-files';
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'cannot prove the signed-in read stays; nothing saved';
  end;

  begin
    execute 'set local role authenticated';
    select count(*) into v_auth_before from storage.objects where bucket_id = 'gi-customer-files';
    select count(*) into v_auth_other_before from storage.objects where bucket_id <> 'gi-customer-files';
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'cannot prove the signed-in read stays; nothing saved';
  end;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'storage' and p.tablename = 'objects'
    and p.policyname = 'gi_customer_files_all_authenticated';
  if found then
    v_norm_qual := replace(replace(
      regexp_replace(lower(coalesce(v_qual, '')), '[[:space:]()'']', '', 'g'),
      chr(34), ''), '::text', '');
    v_norm_check := replace(replace(
      regexp_replace(lower(coalesce(v_check, '')), '[[:space:]()'']', '', 'g'),
      chr(34), ''), '::text', '');
    if v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'ALL'
       or v_roles <> 'authenticated'
       or v_norm_qual <> 'bucket_id=gi-customer-files'
       or v_norm_check <> 'bucket_id=gi-customer-files' then
      raise exception 'signed-in policy is not a bucket path; nothing saved';
    end if;
  else
    v_new := true;
  end if;

  if v_new then
    execute $policy$
      create policy gi_customer_files_all_authenticated
        on storage.objects
        for all
        to authenticated
        using (bucket_id = 'gi-customer-files')
        with check (bucket_id = 'gi-customer-files')
    $policy$;
  end if;

  select p.cmd, p.qual, p.with_check, p.permissive::text, array_to_string(p.roles, ',')
    into v_cmd, v_qual, v_check, v_permissive, v_roles
  from pg_policies p
  where p.schemaname = 'storage' and p.tablename = 'objects'
    and p.policyname = 'gi_customer_files_all_authenticated';
  v_norm_qual := replace(replace(
    regexp_replace(lower(coalesce(v_qual, '')), '[[:space:]()'']', '', 'g'),
    chr(34), ''), '::text', '');
  v_norm_check := replace(replace(
    regexp_replace(lower(coalesce(v_check, '')), '[[:space:]()'']', '', 'g'),
    chr(34), ''), '::text', '');
  if not found or v_permissive not in ('PERMISSIVE', 'true', 't') or v_cmd <> 'ALL'
     or v_roles <> 'authenticated'
     or v_norm_qual <> 'bucket_id=gi-customer-files'
     or v_norm_check <> 'bucket_id=gi-customer-files' then
    raise exception 'signed-in policy is not a bucket path; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_all' and cmd = 'ALL'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_select_authenticated'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_insert_authenticated'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_update_authenticated'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_delete_authenticated'
  ) then
    raise exception 'signed-in path disappeared; nothing saved';
  end if;

  begin
    execute 'set local role anon';
    select count(*) into v_anon_after from storage.objects where bucket_id = 'gi-customer-files';
    select count(*) into v_anon_other_after from storage.objects where bucket_id <> 'gi-customer-files';
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'row visibility changed; nothing saved';
  end;

  begin
    execute 'set local role authenticated';
    select count(*) into v_auth_after from storage.objects where bucket_id = 'gi-customer-files';
    select count(*) into v_auth_other_after from storage.objects where bucket_id <> 'gi-customer-files';
    execute 'reset role';
  exception
    when insufficient_privilege or invalid_authorization_specification then
      execute 'reset role';
      raise exception 'row visibility changed; nothing saved';
  end;

  if v_anon_after is distinct from v_anon_before
     or v_auth_after is distinct from v_auth_before then
    raise exception 'row visibility changed; nothing saved';
  end if;
  if v_anon_other_after is distinct from v_anon_other_before
     or v_auth_other_after is distinct from v_auth_other_before then
    raise exception 'another bucket changed; nothing saved';
  end if;

  select count(*) into v_rows_after from storage.objects;
  if v_rows_after <> v_rows_before then
    raise exception 'stored rows changed; nothing saved';
  end if;

  select count(*) into v_policies_after from pg_policies
  where schemaname = 'storage' and tablename = 'objects';
  select count(*) into v_other_after from pg_policies
  where not (schemaname = 'storage' and tablename = 'objects');
  if v_other_after <> v_other_before then
    raise exception 'another table changed; nothing saved';
  end if;
  v_expected := case when v_new then 1 else 0 end;
  if v_policies_after - v_policies_before <> v_expected then
    raise exception 'more than the signed-in path was added; nothing saved';
  end if;

  insert into gi_rls_files_hold(sort_key, section, detail) values
    (1, 'bucket', 'gi-customer-files'),
    (2, 'signed_in_all', case when v_new then 'installed' else 'already' end),
    (3, 'anon_rows', 'same'),
    (4, 'authenticated_rows', 'same'),
    (5, 'narrow_policies', 'kept'),
    (6, 'open_door', 'kept'),
    (7, 'other_buckets', 'unchanged'),
    (8, 'stored_rows', 'unchanged'),
    (9, 'other_tables', 'unchanged'),
    (10, 'access_changed', 'no'),
    (11, 'door_closed', 'no');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_files_hold
order by sort_key;
