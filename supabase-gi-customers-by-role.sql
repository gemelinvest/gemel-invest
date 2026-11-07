-- =============================================================================
-- GEMEL INVEST · narrow the customers table to the signed-in role.
--
-- public.customers has an open signed-in policy,
-- gi_customers_all_authenticated. It lets every signed-in person read
-- and change every customer. The four shadow policies sit beside it.
-- They compare teamManager and opsAgent with capital letters, so they do
-- not match the lowercase role helper. They also treat a blank agent_id
-- as allowed.
--
-- This file rewrites the four shadow policies and removes the open one.
-- A manager, and an operations user, can still read and write every
-- customer, so the office screens stay full.
-- A team manager can read and write a customer of their own and a
-- customer of an agent whose team_manager_id is theirs.
-- An elementary user can read and write their own customer and a customer
-- whose agent_role is elementary.
-- Anyone else can read and write a customer whose agent_id is their own.
-- A customer with a blank agent_id is still visible when its agent_name
-- matches that person, or a member of that team manager's team.
-- A blank customer with no name stays visible to a manager and to
-- operations only.
-- gi_customers_delete_archived and z_block_anon_delete stay as they are.
-- No other table is touched. Customer rows are not read and are not
-- changed.
--
-- The swap happens only when row security is on, agent_id, agent_name,
-- and agent_role exist, the agents name, username, and team_manager_id
-- columns exist, the seven known policies are the whole set, and the
-- helpers exist. If the new policies are missing afterwards, or either
-- kept policy changes, the whole script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   create policy gi_customers_all_authenticated
--     on public.customers
--     for all to authenticated
--     using (true) with check (true);
-- =============================================================================

drop table if exists gi_rls_customers_by_role;
create temporary table gi_rls_customers_by_role (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_rls boolean;
  v_open boolean;
  v_count integer;
  v_public integer;
  v_other_before integer;
  v_other_after integer;
  v_select_ok boolean;
  v_insert_ok boolean;
  v_update_ok boolean;
  v_delete_ok boolean;
  v_blank boolean;
  v_arch_qual text;
  v_arch_check text;
  v_arch_roles text;
  v_arch_perm text;
  v_block_qual text;
  v_block_check text;
  v_block_roles text;
  v_block_perm text;
  v_arch_qual_after text;
  v_arch_check_after text;
  v_arch_roles_after text;
  v_arch_perm_after text;
  v_block_qual_after text;
  v_block_check_after text;
  v_block_roles_after text;
  v_block_perm_after text;
  v_pred text := $pred$
        public.gi_jwt_is_manager()
        or public.gi_jwt_role() in (
          'ops', 'opsagent', 'ops_agent', 'תפעול', 'מנהל תפעול', 'נציג תפעול'
        )
        or (
          public.gi_jwt_agent_id() <> ''
          and coalesce(agent_id, '') = public.gi_jwt_agent_id()
        )
        or (
          public.gi_jwt_agent_id() <> ''
          and length(coalesce(agent_id, '')) = 0
          and exists (
            select 1
            from public.agents me
            where me.id = public.gi_jwt_agent_id()
              and (
                (coalesce(me.name, '') <> '' and coalesce(agent_name, '') = me.name)
                or (coalesce(me.username, '') <> '' and coalesce(agent_name, '') = me.username)
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
                (coalesce(agent_id, '') <> '' and a.id = agent_id)
                or (
                  length(coalesce(agent_id, '')) = 0
                  and (
                    (coalesce(a.name, '') <> '' and coalesce(agent_name, '') = a.name)
                    or (coalesce(a.username, '') <> '' and coalesce(agent_name, '') = a.username)
                  )
                )
              )
          )
        )
        or (
          public.gi_jwt_agent_id() <> ''
          and public.gi_jwt_role() in ('elementary', 'אלמנטרי')
          and lower(coalesce(agent_role, '')) in ('elementary', 'אלמנטרי')
        )
  $pred$;
begin
  if to_regclass('public.customers') is null then
    raise exception 'customers table is missing; nothing saved';
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'customers';
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'agent_id'
  ) then
    raise exception 'agent_id column is missing; nothing saved';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'agent_name'
  ) then
    raise exception 'agent_name column is missing; nothing saved';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'agent_role'
  ) then
    raise exception 'agent_role column is missing; nothing saved';
  end if;
  if to_regclass('public.agents') is null then
    raise exception 'agents table is missing; nothing saved';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'name'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'username'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'team_manager_id'
  ) then
    raise exception 'agents link column is missing; nothing saved';
  end if;

  if to_regprocedure('public.gi_jwt_agent_id()') is null
     or to_regprocedure('public.gi_jwt_is_manager()') is null
     or to_regprocedure('public.gi_jwt_role()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'gi_customers_all_authenticated'
      and cmd = 'ALL'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_open;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'customers';

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname in (
        'customers_select_own_shadow',
        'customers_insert_own_shadow',
        'customers_update_own_shadow',
        'customers_delete_own_shadow'
      )
      and (
        coalesce(qual, '') ~ $re$coalesce[[:space:]]*\([[:space:]]*agent_id[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$coalesce[[:space:]]*\([[:space:]]*agent_id[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(qual, '') ~ $re$agent_id[[:space:]]+is[[:space:]]+null$re$
        or coalesce(with_check, '') ~ $re$agent_id[[:space:]]+is[[:space:]]+null$re$
        or coalesce(qual, '') ~ $re$agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  if not v_open and not v_blank and v_count = 6
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'customers'
         and policyname = 'customers_select_own_shadow'
         and cmd = 'SELECT'
         and coalesce(qual, '') like '%teammanager%'
         and coalesce(qual, '') like '%opsagent%'
         and coalesce(qual, '') like '%elementary%'
         and coalesce(qual, '') !~ 'teamManager|opsAgent'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'customers'
         and policyname = 'gi_customers_delete_archived' and cmd = 'DELETE'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'customers'
         and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
     ) then
    insert into gi_rls_customers_by_role(sort_key, section, detail) values
      (1, 'table', 'customers'),
      (2, 'policies_removed', 'none'),
      (3, 'select_by_role', 'kept'),
      (4, 'write_by_role', 'kept'),
      (5, 'blank_agent', 'closed'),
      (6, 'anon_delete_block', 'kept'),
      (7, 'archived_delete', 'kept'),
      (8, 'changed', 'no');
    return;
  end if;

  if not v_open or v_count <> 7 then
    raise exception 'customers policies are not the expected open set; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers'
      and policyname = 'customers_select_own_shadow' and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers'
      and policyname = 'customers_insert_own_shadow' and cmd = 'INSERT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers'
      and policyname = 'customers_update_own_shadow' and cmd = 'UPDATE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers'
      and policyname = 'customers_delete_own_shadow' and cmd = 'DELETE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers'
      and policyname = 'gi_customers_delete_archived' and cmd = 'DELETE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
      and ('anon' = any (roles) or 'public' = any (roles))
      and not ('authenticated' = any (roles))
  ) then
    raise exception 'a customer policy is missing; nothing saved';
  end if;

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'customers'
    and ('anon' = any (roles) or 'public' = any (roles));
  if v_public <> 1 then
    raise exception 'a public policy is still open; nothing saved';
  end if;

  select coalesce(qual, ''), coalesce(with_check, ''), array_to_string(roles, ','), permissive::text
    into v_arch_qual, v_arch_check, v_arch_roles, v_arch_perm
  from pg_policies
  where schemaname = 'public' and tablename = 'customers'
    and policyname = 'gi_customers_delete_archived';

  select coalesce(qual, ''), coalesce(with_check, ''), array_to_string(roles, ','), permissive::text
    into v_block_qual, v_block_check, v_block_roles, v_block_perm
  from pg_policies
  where schemaname = 'public' and tablename = 'customers'
    and policyname = 'z_block_anon_delete';

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'customers';

  drop policy customers_select_own_shadow on public.customers;
  drop policy customers_insert_own_shadow on public.customers;
  drop policy customers_update_own_shadow on public.customers;
  drop policy customers_delete_own_shadow on public.customers;

  execute 'create policy customers_select_own_shadow on public.customers for select to authenticated using (' || v_pred || ')';
  execute 'create policy customers_insert_own_shadow on public.customers for insert to authenticated with check (' || v_pred || ')';
  execute 'create policy customers_update_own_shadow on public.customers for update to authenticated using (' || v_pred || ') with check (' || v_pred || ')';
  execute 'create policy customers_delete_own_shadow on public.customers for delete to authenticated using (' || v_pred || ')';

  drop policy gi_customers_all_authenticated on public.customers;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers'
      and policyname = 'customers_select_own_shadow'
      and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and coalesce(qual, '') like '%teammanager%'
      and coalesce(qual, '') like '%opsagent%'
      and coalesce(qual, '') like '%elementary%'
      and coalesce(qual, '') like '%gi_jwt_agent_id()%'
      and coalesce(qual, '') !~ 'teamManager|opsAgent'
  ) into v_select_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers'
      and policyname = 'customers_insert_own_shadow'
      and cmd = 'INSERT'
      and coalesce(with_check, '') like '%teammanager%'
      and coalesce(with_check, '') like '%gi_jwt_agent_id()%'
      and coalesce(with_check, '') !~ 'teamManager|opsAgent'
  ) into v_insert_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers'
      and policyname = 'customers_update_own_shadow'
      and cmd = 'UPDATE'
      and coalesce(qual, '') like '%teammanager%'
      and coalesce(with_check, '') like '%teammanager%'
      and coalesce(qual, '') !~ 'teamManager|opsAgent'
  ) into v_update_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers'
      and policyname = 'customers_delete_own_shadow'
      and cmd = 'DELETE'
      and coalesce(qual, '') like '%teammanager%'
      and coalesce(qual, '') like '%gi_jwt_agent_id()%'
      and coalesce(qual, '') !~ 'teamManager|opsAgent'
  ) into v_delete_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers'
      and policyname = 'gi_customers_all_authenticated'
  ) into v_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname in (
        'customers_select_own_shadow',
        'customers_insert_own_shadow',
        'customers_update_own_shadow',
        'customers_delete_own_shadow'
      )
      and (
        coalesce(qual, '') ~ $re$coalesce[[:space:]]*\([[:space:]]*agent_id[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$coalesce[[:space:]]*\([[:space:]]*agent_id[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(qual, '') ~ $re$agent_id[[:space:]]+is[[:space:]]+null$re$
        or coalesce(with_check, '') ~ $re$agent_id[[:space:]]+is[[:space:]]+null$re$
        or coalesce(qual, '') ~ $re$agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  select coalesce(qual, ''), coalesce(with_check, ''), array_to_string(roles, ','), permissive::text
    into v_arch_qual_after, v_arch_check_after, v_arch_roles_after, v_arch_perm_after
  from pg_policies
  where schemaname = 'public' and tablename = 'customers'
    and policyname = 'gi_customers_delete_archived';

  select coalesce(qual, ''), coalesce(with_check, ''), array_to_string(roles, ','), permissive::text
    into v_block_qual_after, v_block_check_after, v_block_roles_after, v_block_perm_after
  from pg_policies
  where schemaname = 'public' and tablename = 'customers'
    and policyname = 'z_block_anon_delete';

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public' and tablename = 'customers';

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'customers'
    and ('anon' = any (roles) or 'public' = any (roles));

  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'customers';

  if not v_select_ok or not v_insert_ok or not v_update_ok or not v_delete_ok
     or v_open or v_blank or v_count <> 6 or v_public <> 1
     or v_arch_qual_after is distinct from v_arch_qual
     or v_arch_check_after is distinct from v_arch_check
     or v_arch_roles_after is distinct from v_arch_roles
     or v_arch_perm_after is distinct from v_arch_perm
     or v_block_qual_after is distinct from v_block_qual
     or v_block_check_after is distinct from v_block_check
     or v_block_roles_after is distinct from v_block_roles
     or v_block_perm_after is distinct from v_block_perm
     or v_other_after <> v_other_before then
    raise exception 'more than the customers role path changed; nothing saved';
  end if;

  insert into gi_rls_customers_by_role(sort_key, section, detail) values
    (1, 'table', 'customers'),
    (2, 'policies_removed', 'gi_customers_all_authenticated'),
    (3, 'select_by_role', 'installed'),
    (4, 'write_by_role', 'installed'),
    (5, 'blank_agent', 'closed'),
    (6, 'anon_delete_block', 'kept'),
    (7, 'archived_delete', 'kept'),
    (8, 'other_tables', 'unchanged'),
    (9, 'changed', 'yes');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_customers_by_role
order by sort_key;
