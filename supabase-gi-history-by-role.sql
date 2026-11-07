-- =============================================================================
-- GEMEL INVEST · close the open read on the history tables.
--
-- public.agents_history, public.customers_history, and
-- public.proposals_history each store history_id, action_type, action_at,
-- row_id, and row_data. There is no owner column. Signed-in read, insert,
-- and update are open. Customers and proposals also have a second open
-- read and a second open insert, plus public update and delete blocks.
-- The app does not load these tables. A save or a delete can still append
-- a history row, and it fails when that insert is blocked.
--
-- This file removes the duplicate open policies. A manager can still read
-- and rewrite every history row. A signed-in person with an agent id can
-- still append a row, so a save can keep writing history. Anyone else
-- cannot read or rewrite a row. The public blocks stay. No history row is
-- read or changed. No other table is touched.
--
-- The swap happens only when row security is on, the five columns exist,
-- the known policies are the whole set, the signed-in paths are open, and
-- both helpers exist. If the new policies are missing afterwards, the
-- whole script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   drop policy if exists agents_history_select_authenticated on public.agents_history;
--   drop policy if exists agents_history_insert_authenticated on public.agents_history;
--   drop policy if exists agents_history_update_open on public.agents_history;
--   create policy agents_history_select_authenticated on public.agents_history for select to authenticated using (true);
--   create policy agents_history_insert_authenticated on public.agents_history for insert to authenticated with check (true);
--   create policy agents_history_update_open on public.agents_history for update to authenticated using (true) with check (true);
--   drop policy if exists customers_history_select_authenticated on public.customers_history;
--   drop policy if exists customers_history_insert_authenticated on public.customers_history;
--   drop policy if exists customers_history_update_open on public.customers_history;
--   create policy customers_history_select_authenticated on public.customers_history for select to authenticated using (true);
--   create policy customers_history_insert_authenticated on public.customers_history for insert to authenticated with check (true);
--   create policy customers_history_update_open on public.customers_history for update to authenticated using (true) with check (true);
--   create policy gi_customers_history_select_auth on public.customers_history for select to authenticated using (true);
--   create policy gi_customers_history_insert_auth on public.customers_history for insert to authenticated with check (true);
--   drop policy if exists proposals_history_select_authenticated on public.proposals_history;
--   drop policy if exists proposals_history_insert_authenticated on public.proposals_history;
--   drop policy if exists proposals_history_update_open on public.proposals_history;
--   create policy proposals_history_select_authenticated on public.proposals_history for select to authenticated using (true);
--   create policy proposals_history_insert_authenticated on public.proposals_history for insert to authenticated with check (true);
--   create policy proposals_history_update_open on public.proposals_history for update to authenticated using (true) with check (true);
--   create policy gi_proposals_history_select_auth on public.proposals_history for select to authenticated using (true);
--   create policy gi_proposals_history_insert_auth on public.proposals_history for insert to authenticated with check (true);
-- =============================================================================

drop table if exists gi_rls_history_by_role;
create temporary table gi_rls_history_by_role (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $cut$
declare
  v_table text;
  v_rls boolean;
  v_columns integer;
  v_ready boolean := true;
  v_done boolean := true;
  v_other_before integer;
  v_other_after integer;
  v_read text := $pred$public.gi_jwt_is_manager()$pred$;
  v_append text := $pred$public.gi_jwt_is_manager() or public.gi_jwt_agent_id() <> ''$pred$;
  v_tables text[] := array['agents_history', 'customers_history', 'proposals_history'];
begin
  foreach v_table in array v_tables
  loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'a history table is missing; nothing saved';
    end if;

    select c.relrowsecurity
      into v_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = v_table;
    if v_rls is distinct from true then
      raise exception 'row security is off; nothing saved';
    end if;

    select count(*) into v_columns
    from information_schema.columns
    where table_schema = 'public'
      and table_name = v_table
      and column_name in ('history_id', 'action_type', 'action_at', 'row_id', 'row_data');
    if v_columns <> 5 then
      raise exception 'history columns are missing; nothing saved';
    end if;
  end loop;

  if to_regprocedure('public.gi_jwt_is_manager()') is null
     or to_regprocedure('public.gi_jwt_agent_id()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  if (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'agents_history'
  ) = 3
  and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents_history'
      and policyname = 'agents_history_select_authenticated' and cmd = 'SELECT'
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
      and coalesce(qual, '') not like '%gi_jwt_agent_id()%'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents_history'
      and policyname = 'agents_history_insert_authenticated' and cmd = 'INSERT'
      and coalesce(with_check, '') like '%gi_jwt_is_manager()%'
      and coalesce(with_check, '') like '%gi_jwt_agent_id() <> ''''%'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') <> 'true'
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents_history'
      and policyname = 'agents_history_update_open' and cmd = 'UPDATE'
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
      and coalesce(with_check, '') like '%gi_jwt_is_manager()%'
      and coalesce(qual, '') not like '%gi_jwt_agent_id()%'
  ) then
    v_done := v_done and true;
  else
    v_done := false;
  end if;

  if (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
  ) = 5
  and not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
      and policyname in ('gi_customers_history_insert_auth', 'gi_customers_history_select_auth')
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
      and policyname = 'customers_history_select_authenticated'
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
      and policyname = 'customers_history_insert_authenticated'
      and coalesce(with_check, '') like '%gi_jwt_agent_id() <> ''''%'
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
      and policyname = 'z_block_anon_update' and cmd = 'UPDATE'
  ) then
    v_done := v_done and true;
  else
    v_done := false;
  end if;

  if (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
  ) = 5
  and not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
      and policyname in ('gi_proposals_history_insert_auth', 'gi_proposals_history_select_auth')
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
      and policyname = 'proposals_history_select_authenticated'
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
      and policyname = 'proposals_history_insert_authenticated'
      and coalesce(with_check, '') like '%gi_jwt_agent_id() <> ''''%'
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
      and policyname = 'z_block_anon_update' and cmd = 'UPDATE'
  ) then
    v_done := v_done and true;
  else
    v_done := false;
  end if;

  if v_done then
    insert into gi_rls_history_by_role(sort_key, section, detail) values
      (1, 'table', 'agents_history'),
      (2, 'policies_removed', 'none'),
      (3, 'select_by_role', 'kept'),
      (4, 'insert_by_role', 'kept'),
      (5, 'update_by_role', 'kept'),
      (6, 'anon_blocks', 'none'),
      (101, 'table', 'customers_history'),
      (102, 'policies_removed', 'none'),
      (103, 'select_by_role', 'kept'),
      (104, 'insert_by_role', 'kept'),
      (105, 'update_by_role', 'kept'),
      (106, 'anon_blocks', 'kept'),
      (201, 'table', 'proposals_history'),
      (202, 'policies_removed', 'none'),
      (203, 'select_by_role', 'kept'),
      (204, 'insert_by_role', 'kept'),
      (205, 'update_by_role', 'kept'),
      (206, 'anon_blocks', 'kept'),
      (301, 'changed', 'no');
    return;
  end if;

  v_ready := (
    select count(*) = 3
      and count(*) filter (
        where policyname = 'agents_history_select_authenticated' and cmd = 'SELECT'
          and 'authenticated' = any (roles)
          and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      ) = 1
      and count(*) filter (
        where policyname = 'agents_history_insert_authenticated' and cmd = 'INSERT'
          and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
      ) = 1
      and count(*) filter (
        where policyname = 'agents_history_update_open' and cmd = 'UPDATE'
          and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
          and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
      ) = 1
      and count(*) filter (
        where 'anon' = any (roles) or 'public' = any (roles)
      ) = 0
    from pg_policies
    where schemaname = 'public' and tablename = 'agents_history'
  );
  if not v_ready then
    raise exception 'history policies are not the expected open set; nothing saved';
  end if;

  v_ready := (
    select count(*) = 7
      and count(*) filter (
        where policyname = 'customers_history_select_authenticated' and cmd = 'SELECT'
          and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      ) = 1
      and count(*) filter (
        where policyname = 'gi_customers_history_select_auth' and cmd = 'SELECT'
          and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      ) = 1
      and count(*) filter (
        where policyname = 'customers_history_insert_authenticated' and cmd = 'INSERT'
          and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
      ) = 1
      and count(*) filter (
        where policyname = 'gi_customers_history_insert_auth' and cmd = 'INSERT'
          and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
      ) = 1
      and count(*) filter (
        where policyname = 'customers_history_update_open' and cmd = 'UPDATE'
          and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
          and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
      ) = 1
      and count(*) filter (where policyname = 'z_block_anon_delete' and cmd = 'DELETE') = 1
      and count(*) filter (where policyname = 'z_block_anon_update' and cmd = 'UPDATE') = 1
      and count(*) filter (
        where ('anon' = any (roles) or 'public' = any (roles))
          and policyname not in ('z_block_anon_delete', 'z_block_anon_update')
      ) = 0
    from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
  );
  if not v_ready then
    raise exception 'history policies are not the expected open set; nothing saved';
  end if;

  v_ready := (
    select count(*) = 7
      and count(*) filter (
        where policyname = 'proposals_history_select_authenticated' and cmd = 'SELECT'
          and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      ) = 1
      and count(*) filter (
        where policyname = 'gi_proposals_history_select_auth' and cmd = 'SELECT'
          and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      ) = 1
      and count(*) filter (
        where policyname = 'proposals_history_insert_authenticated' and cmd = 'INSERT'
          and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
      ) = 1
      and count(*) filter (
        where policyname = 'gi_proposals_history_insert_auth' and cmd = 'INSERT'
          and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
      ) = 1
      and count(*) filter (
        where policyname = 'proposals_history_update_open' and cmd = 'UPDATE'
          and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
          and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
      ) = 1
      and count(*) filter (where policyname = 'z_block_anon_delete' and cmd = 'DELETE') = 1
      and count(*) filter (where policyname = 'z_block_anon_update' and cmd = 'UPDATE') = 1
      and count(*) filter (
        where ('anon' = any (roles) or 'public' = any (roles))
          and policyname not in ('z_block_anon_delete', 'z_block_anon_update')
      ) = 0
    from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
  );
  if not v_ready then
    raise exception 'history policies are not the expected open set; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public'
    and tablename not in ('agents_history', 'customers_history', 'proposals_history');

  drop policy agents_history_select_authenticated on public.agents_history;
  drop policy agents_history_insert_authenticated on public.agents_history;
  drop policy agents_history_update_open on public.agents_history;
  execute 'create policy agents_history_select_authenticated on public.agents_history for select to authenticated using (' || v_read || ')';
  execute 'create policy agents_history_insert_authenticated on public.agents_history for insert to authenticated with check (' || v_append || ')';
  execute 'create policy agents_history_update_open on public.agents_history for update to authenticated using (' || v_read || ') with check (' || v_read || ')';

  drop policy gi_customers_history_select_auth on public.customers_history;
  drop policy gi_customers_history_insert_auth on public.customers_history;
  drop policy customers_history_select_authenticated on public.customers_history;
  drop policy customers_history_insert_authenticated on public.customers_history;
  drop policy customers_history_update_open on public.customers_history;
  execute 'create policy customers_history_select_authenticated on public.customers_history for select to authenticated using (' || v_read || ')';
  execute 'create policy customers_history_insert_authenticated on public.customers_history for insert to authenticated with check (' || v_append || ')';
  execute 'create policy customers_history_update_open on public.customers_history for update to authenticated using (' || v_read || ') with check (' || v_read || ')';

  drop policy gi_proposals_history_select_auth on public.proposals_history;
  drop policy gi_proposals_history_insert_auth on public.proposals_history;
  drop policy proposals_history_select_authenticated on public.proposals_history;
  drop policy proposals_history_insert_authenticated on public.proposals_history;
  drop policy proposals_history_update_open on public.proposals_history;
  execute 'create policy proposals_history_select_authenticated on public.proposals_history for select to authenticated using (' || v_read || ')';
  execute 'create policy proposals_history_insert_authenticated on public.proposals_history for insert to authenticated with check (' || v_append || ')';
  execute 'create policy proposals_history_update_open on public.proposals_history for update to authenticated using (' || v_read || ') with check (' || v_read || ')';

  if (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'agents_history'
  ) <> 3
  or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents_history'
      and policyname = 'agents_history_select_authenticated'
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
  )
  or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents_history'
      and policyname = 'agents_history_insert_authenticated'
      and coalesce(with_check, '') like '%gi_jwt_agent_id() <> ''''%'
  )
  or (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
  ) <> 5
  or exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'customers_history'
      and policyname in ('gi_customers_history_insert_auth', 'gi_customers_history_select_auth')
  )
  or (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'proposals_history'
  ) <> 5
  or exists (
    select 1 from pg_policies
    where policyname in (
      'gi_proposals_history_insert_auth',
      'gi_proposals_history_select_auth'
    )
  )
  or (
    select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in ('customers_history', 'proposals_history')
      and policyname in ('z_block_anon_delete', 'z_block_anon_update')
  ) <> 4 then
    raise exception 'more than the history role path changed; nothing saved';
  end if;

  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public'
    and tablename not in ('agents_history', 'customers_history', 'proposals_history');
  if v_other_after <> v_other_before then
    raise exception 'more than the history role path changed; nothing saved';
  end if;

  insert into gi_rls_history_by_role(sort_key, section, detail) values
    (1, 'table', 'agents_history'),
    (2, 'policies_removed', 'none'),
    (3, 'select_by_role', 'installed'),
    (4, 'insert_by_role', 'installed'),
    (5, 'update_by_role', 'installed'),
    (6, 'anon_blocks', 'none'),
    (101, 'table', 'customers_history'),
    (102, 'policies_removed', 'gi_customers_history_insert_auth|gi_customers_history_select_auth'),
    (103, 'select_by_role', 'installed'),
    (104, 'insert_by_role', 'installed'),
    (105, 'update_by_role', 'installed'),
    (106, 'anon_blocks', 'kept'),
    (201, 'table', 'proposals_history'),
    (202, 'policies_removed', 'gi_proposals_history_insert_auth|gi_proposals_history_select_auth'),
    (203, 'select_by_role', 'installed'),
    (204, 'insert_by_role', 'installed'),
    (205, 'update_by_role', 'installed'),
    (206, 'anon_blocks', 'kept'),
    (301, 'other_tables', 'unchanged'),
    (302, 'changed', 'yes');
end
$cut$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_history_by_role
order by sort_key;
