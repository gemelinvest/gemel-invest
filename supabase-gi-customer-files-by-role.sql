-- =============================================================================
-- GEMEL INVEST · narrow customer files to the signed-in role.
--
-- storage.objects has an open signed-in policy,
-- gi_customer_files_all_authenticated. It lets every signed-in person read
-- and change every file in the bucket gi-customer-files. The four narrower
-- policies sit beside it. Select and insert ask gi_storage_customer_allowed,
-- but that function compares teamManager and opsAgent with capital letters,
-- and it treats a blank agent_id on an elementary customer as allowed for
-- every signed-in person. Update and delete allow only a manager, while
-- the app uploads with upsert, so an owner must be able to write the same
-- file again.
--
-- This file rewrites the helper and points update and delete at it, then
-- removes the open policy. A manager and an operations user can still read
-- and write every file in this bucket. A team manager can read and write a
-- file of their own customer and a file of an agent on their team. An
-- elementary user can read and write a file of their own customer and a
-- file of a customer whose agent_role is elementary. Anyone else can read
-- and write a file whose customer is theirs. The helper stays security
-- definer, so the customers policies do not hide the check. Select and
-- insert stay as they are. No file name or file bytes are read. No other
-- table is touched.
--
-- The swap happens only when the bucket is private, row security is on,
-- the helper is already security definer, the customer and agent columns
-- exist, the five known policies are the whole set on storage.objects, and
-- the jwt helpers exist. If the helper or the policies are wrong
-- afterwards, the whole script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   create policy gi_customer_files_all_authenticated
--     on storage.objects
--     for all to authenticated
--     using (bucket_id = 'gi-customer-files')
--     with check (bucket_id = 'gi-customer-files');
-- =============================================================================

drop table if exists gi_rls_files_by_role;
create temporary table gi_rls_files_by_role (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_bucket boolean := false;
  v_public boolean := false;
  v_rls boolean := false;
  v_open boolean := false;
  v_count integer := 0;
  v_other_before integer := 0;
  v_other_after integer := 0;
  v_src text := '';
  v_select_qual text := '';
  v_select_check text := '';
  v_insert_qual text := '';
  v_insert_check text := '';
  v_select_qual_after text := '';
  v_select_check_after text := '';
  v_insert_qual_after text := '';
  v_insert_check_after text := '';
  v_helper_ok boolean := false;
  v_select_ok boolean := false;
  v_insert_ok boolean := false;
  v_update_ok boolean := false;
  v_delete_ok boolean := false;
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise exception 'customer file storage is missing; nothing saved';
  end if;

  execute 'select exists (select 1 from storage.buckets where id = ''gi-customer-files'')'
    into v_bucket;
  if not v_bucket then
    raise exception 'customer file bucket is missing; nothing saved';
  end if;
  execute 'select b.public from storage.buckets b where b.id = ''gi-customer-files'''
    into v_public;
  if v_public then
    raise exception 'customer file bucket is public; nothing saved';
  end if;

  select c.relrowsecurity into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage' and c.relname = 'objects';
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  if to_regprocedure('public.gi_storage_customer_allowed(text)') is null then
    raise exception 'file helper is missing; nothing saved';
  end if;
  v_src := pg_get_functiondef('public.gi_storage_customer_allowed(text)'::regprocedure);
  if position('security definer' in lower(v_src)) = 0 then
    raise exception 'file helper is not security definer; nothing saved';
  end if;

  if to_regclass('public.customers') is null or to_regclass('public.agents') is null then
    raise exception 'customer link is missing; nothing saved';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'agent_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'agent_name'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'agent_role'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'name'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'username'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'team_manager_id'
  ) then
    raise exception 'customer link column is missing; nothing saved';
  end if;

  if to_regprocedure('public.gi_jwt_agent_id()') is null
     or to_regprocedure('public.gi_jwt_is_manager()') is null
     or to_regprocedure('public.gi_jwt_role()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects';

  select exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_all_authenticated'
      and cmd = 'ALL'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and replace(replace(regexp_replace(lower(coalesce(qual, '')), '[[:space:]()'']', '', 'g'), chr(34), ''), '::text', '') = 'bucket_id=gi-customer-files'
      and replace(replace(regexp_replace(lower(coalesce(with_check, '')), '[[:space:]()'']', '', 'g'), chr(34), ''), '::text', '') = 'bucket_id=gi-customer-files'
  ) into v_open;

  if not v_open and v_count = 4
     and position('security definer' in lower(v_src)) > 0
     and lower(v_src) like '%teammanager%'
     and lower(v_src) like '%opsagent%'
     and lower(v_src) like '%elementary%'
     and v_src !~ 'teamManager|opsAgent'
     and exists (
       select 1 from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname = 'gi_customer_files_select_authenticated' and cmd = 'SELECT'
         and coalesce(qual, '') like '%gi_storage_customer_allowed%'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname = 'gi_customer_files_insert_authenticated' and cmd = 'INSERT'
         and coalesce(with_check, '') like '%gi_storage_customer_allowed%'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname = 'gi_customer_files_update_authenticated' and cmd = 'UPDATE'
         and coalesce(qual, '') like '%gi_storage_customer_allowed%'
         and coalesce(with_check, '') like '%gi_storage_customer_allowed%'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname = 'gi_customer_files_delete_authenticated' and cmd = 'DELETE'
         and coalesce(qual, '') like '%gi_storage_customer_allowed%'
     ) then
    insert into gi_rls_files_by_role(sort_key, section, detail) values
      (1, 'bucket', 'gi-customer-files'),
      (2, 'policies_removed', 'none'),
      (3, 'helper', 'kept'),
      (4, 'select_by_role', 'kept'),
      (5, 'write_by_role', 'kept'),
      (6, 'open_path', 'closed'),
      (7, 'changed', 'no');
    return;
  end if;

  if not v_open or v_count <> 5 then
    raise exception 'customer file policies are not the expected open set; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_select_authenticated' and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and coalesce(qual, '') like '%gi_storage_customer_allowed%'
      and coalesce(qual, '') like '%gi-customer-files%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_insert_authenticated' and cmd = 'INSERT'
      and 'authenticated' = any (roles)
      and coalesce(with_check, '') like '%gi_storage_customer_allowed%'
      and coalesce(with_check, '') like '%gi-customer-files%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_update_authenticated' and cmd = 'UPDATE'
      and 'authenticated' = any (roles)
      and coalesce(qual, '') like '%gi_jwt_is_manager%'
      and coalesce(with_check, '') like '%gi_jwt_is_manager%'
      and coalesce(qual, '') like '%gi-customer-files%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_delete_authenticated' and cmd = 'DELETE'
      and 'authenticated' = any (roles)
      and coalesce(qual, '') like '%gi_jwt_is_manager%'
      and coalesce(qual, '') like '%gi-customer-files%'
  ) then
    raise exception 'a customer file policy is missing; nothing saved';
  end if;

  select coalesce(qual, ''), coalesce(with_check, '')
    into v_select_qual, v_select_check
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'gi_customer_files_select_authenticated';
  select coalesce(qual, ''), coalesce(with_check, '')
    into v_insert_qual, v_insert_check
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'gi_customer_files_insert_authenticated';

  select count(*) into v_other_before
  from pg_policies
  where not (schemaname = 'storage' and tablename = 'objects');

  execute $fn$
    create or replace function public.gi_storage_customer_allowed(p_customer_id text)
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
    as $body2$
      select
        public.gi_jwt_is_manager()
        or public.gi_jwt_role() in (
          'ops', 'opsagent', 'ops_agent', 'תפעול', 'מנהל תפעול', 'נציג תפעול'
        )
        or exists (
          select 1
          from public.customers c
          where c.id = p_customer_id
            and (
              (
                public.gi_jwt_agent_id() <> ''
                and coalesce(c.agent_id, '') = public.gi_jwt_agent_id()
              )
              or (
                public.gi_jwt_agent_id() <> ''
                and length(coalesce(c.agent_id, '')) = 0
                and exists (
                  select 1
                  from public.agents me
                  where me.id = public.gi_jwt_agent_id()
                    and (
                      (coalesce(me.name, '') <> '' and coalesce(c.agent_name, '') = me.name)
                      or (coalesce(me.username, '') <> '' and coalesce(c.agent_name, '') = me.username)
                    )
                )
              )
              or (
                public.gi_jwt_agent_id() <> ''
                and public.gi_jwt_role() in ('teammanager', 'team_manager', 'מנהל צוות')
                and exists (
                  select 1
                  from public.agents a
                  where coalesce(a.team_manager_id, '') = public.gi_jwt_agent_id()
                    and (
                      (coalesce(c.agent_id, '') <> '' and a.id = c.agent_id)
                      or (
                        length(coalesce(c.agent_id, '')) = 0
                        and (
                          (coalesce(a.name, '') <> '' and coalesce(c.agent_name, '') = a.name)
                          or (coalesce(a.username, '') <> '' and coalesce(c.agent_name, '') = a.username)
                        )
                      )
                    )
                )
              )
              or (
                public.gi_jwt_agent_id() <> ''
                and public.gi_jwt_role() in ('elementary', 'אלמנטרי')
                and lower(coalesce(c.agent_role, '')) in ('elementary', 'אלמנטרי')
              )
            )
        );
    $body2$
  $fn$;

  drop policy gi_customer_files_update_authenticated on storage.objects;
  drop policy gi_customer_files_delete_authenticated on storage.objects;

  execute $policy$
    create policy gi_customer_files_update_authenticated
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'gi-customer-files'
        and public.gi_storage_customer_allowed((storage.foldername(name))[1])
      )
      with check (
        bucket_id = 'gi-customer-files'
        and public.gi_storage_customer_allowed((storage.foldername(name))[1])
      )
  $policy$;

  execute $policy$
    create policy gi_customer_files_delete_authenticated
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'gi-customer-files'
        and public.gi_storage_customer_allowed((storage.foldername(name))[1])
      )
  $policy$;

  drop policy gi_customer_files_all_authenticated on storage.objects;

  v_src := pg_get_functiondef('public.gi_storage_customer_allowed(text)'::regprocedure);
  v_helper_ok := position('security definer' in lower(v_src)) > 0
    and lower(v_src) like '%teammanager%'
    and lower(v_src) like '%opsagent%'
    and lower(v_src) like '%elementary%'
    and v_src !~ 'teamManager|opsAgent'
    and position('user_metadata' in lower(v_src)) = 0;

  select coalesce(qual, ''), coalesce(with_check, '')
    into v_select_qual_after, v_select_check_after
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'gi_customer_files_select_authenticated';
  select coalesce(qual, ''), coalesce(with_check, '')
    into v_insert_qual_after, v_insert_check_after
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'gi_customer_files_insert_authenticated';

  v_select_ok := v_select_qual_after = v_select_qual and v_select_check_after = v_select_check;
  v_insert_ok := v_insert_qual_after = v_insert_qual and v_insert_check_after = v_insert_check;

  select exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_update_authenticated' and cmd = 'UPDATE'
      and 'authenticated' = any (roles)
      and coalesce(qual, '') like '%gi_storage_customer_allowed%'
      and coalesce(with_check, '') like '%gi_storage_customer_allowed%'
      and coalesce(qual, '') like '%gi-customer-files%'
      and coalesce(qual, '') !~ 'gi_jwt_is_manager'
  ) into v_update_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_delete_authenticated' and cmd = 'DELETE'
      and 'authenticated' = any (roles)
      and coalesce(qual, '') like '%gi_storage_customer_allowed%'
      and coalesce(qual, '') like '%gi-customer-files%'
      and coalesce(qual, '') !~ 'gi_jwt_is_manager'
  ) into v_delete_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'gi_customer_files_all_authenticated'
  ) into v_open;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects';

  select count(*) into v_other_after
  from pg_policies
  where not (schemaname = 'storage' and tablename = 'objects');

  if not v_helper_ok or not v_select_ok or not v_insert_ok or not v_update_ok or not v_delete_ok
     or v_open or v_count <> 4 or v_other_after <> v_other_before then
    raise exception 'more than the customer file role path changed; nothing saved';
  end if;

  insert into gi_rls_files_by_role(sort_key, section, detail) values
    (1, 'bucket', 'gi-customer-files'),
    (2, 'policies_removed', 'gi_customer_files_all_authenticated'),
    (3, 'helper', 'installed'),
    (4, 'select_by_role', 'kept'),
    (5, 'write_by_role', 'installed'),
    (6, 'open_path', 'closed'),
    (7, 'other_tables', 'unchanged'),
    (8, 'changed', 'yes');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_files_by_role
order by sort_key;
