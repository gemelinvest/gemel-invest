-- =============================================================================
-- GEMEL INVEST · Pו restrictive Storage RLS for gi-customer-files (authenticated)
-- Today: "gi_customer_files_all" (anon, authenticated, FOR ALL, using true)
-- — anyone with the publishable key can list/upload/download/delete ANY
-- customer file. CRITICAL.
-- Target: authenticated only; object path is `{customerId}/{kind}/{fileId}{ext}`
-- (app.js GiCustomerFileStore.buildStoragePath). Allow if the requesting
-- agent owns the customer (agent_id = gi_jwt_agent_id()) or is a manager/ops,
-- or the customer's agent is in the teamManager's team, or the customer is in
-- the elementary pool.
-- Actual customers columns: id, status, full_name, ..., agent_role, agent_id, ...
-- (NO `role` column — use `agent_role`; NO `team_manager_id` on customers —
--  team manager lives on agents.team_manager_id, resolved via subquery).
-- INERT until Pו: the open policy still OR-wins. Safe to run now.
-- NOTE: this is Pו — apply ONLY after `customers` RLS is active (Pה done),
-- otherwise the ownership subquery against customers would not be enforced.
-- =============================================================================

-- Helper: is the customer with this id visible to the current JWT?
-- (mirrors customers_select_own_shadow). security definer to avoid RLS recursion.
create or replace function public.gi_storage_customer_allowed(p_customer_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.customers c
    where c.id = p_customer_id
      and (
            public.gi_jwt_is_manager()
         or (public.gi_jwt_agent_id() <> '' and coalesce(c.agent_role, '') in ('ops','opsAgent'))
         or (public.gi_jwt_agent_id() <> '' and c.agent_id = public.gi_jwt_agent_id())
         or (
              public.gi_jwt_agent_id() <> ''
              and public.gi_jwt_role() = 'teamManager'
              and exists (
                select 1 from public.agents a
                where a.id = coalesce(c.agent_id, '')
                  and coalesce(a.team_manager_id, '') = public.gi_jwt_agent_id()
              )
         )
         or (
              public.gi_jwt_agent_id() <> ''
              and coalesce(c.agent_role, '') = 'elementary'
              and (coalesce(c.agent_id, '') = '' or c.agent_id is null)
         )
      )
  );
$$;

revoke all on function public.gi_storage_customer_allowed(text) from public;
grant execute on function public.gi_storage_customer_allowed(text) to authenticated;

-- SELECT (download/list): allowed if the object's customer is visible to the JWT.
drop policy if exists "gi_customer_files_select_authenticated" on storage.objects;
create policy "gi_customer_files_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (
        bucket_id = 'gi-customer-files'
    and public.gi_storage_customer_allowed((storage.foldername(name))[1])
  );

-- INSERT (upload): same ownership check.
drop policy if exists "gi_customer_files_insert_authenticated" on storage.objects;
create policy "gi_customer_files_insert_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (
        bucket_id = 'gi-customer-files'
    and public.gi_storage_customer_allowed((storage.foldername(name))[1])
  );

-- UPDATE: managers only (rare).
drop policy if exists "gi_customer_files_update_authenticated" on storage.objects;
create policy "gi_customer_files_update_authenticated"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'gi-customer-files' and public.gi_jwt_is_manager())
  with check (bucket_id = 'gi-customer-files' and public.gi_jwt_is_manager());

-- DELETE: managers / owner.
drop policy if exists "gi_customer_files_delete_authenticated" on storage.objects;
create policy "gi_customer_files_delete_authenticated"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'gi-customer-files' and public.gi_jwt_is_manager());

notify pgrst, 'reload schema';

-- =============================================================================
-- Pו (NEXT, RISKY) — to activate, AFTER customers RLS (Pה) is live:
--   drop policy "gi_customer_files_all" on storage.objects;
-- Kill switch (rollback):
--   create policy "gi_customer_files_all" on storage.objects
--     for all to anon, authenticated
--     using (bucket_id = 'gi-customer-files') with check (bucket_id = 'gi-customer-files');
-- =============================================================================
