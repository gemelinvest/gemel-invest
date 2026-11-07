-- =============================================================================
-- GEMEL INVEST · close the open write on the agent roster.
--
-- public.agents has an open signed-in policy, gi_agents_all_authenticated.
-- It lets every signed-in person read, change, and delete every agent.
-- The select policy beside it is also open. Insert, update, and delete are
-- limited. A public delete block stays. pin and pin_hash exist. The screen
-- reads the roster, and a manager saves an agent from the users screen.
--
-- This file removes the open policy. Reading stays open to every
-- signed-in person, so the roster still loads. A manager can still add,
-- change, and delete an agent. Anyone else cannot. The public delete
-- block stays. No agent is read or changed. No grant is revoked. No other
-- table is touched.
--
-- The swap happens only when row security is on, pin, role, and
-- auth_user_id exist, the six known policies are the whole set, the
-- select and the open policy are open, and the manager helper exists.
-- If the new policies are missing afterwards, the whole script stops and
-- saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   create policy gi_agents_all_authenticated
--     on public.agents
--     for all to authenticated
--     using (true) with check (true);
--   drop policy if exists agents_insert_authenticated on public.agents;
--   drop policy if exists agents_update_authenticated on public.agents;
--   drop policy if exists agents_delete_authenticated on public.agents;
--   create policy agents_insert_authenticated
--     on public.agents for insert to authenticated
--     with check (public.gi_jwt_is_manager());
--   create policy agents_update_authenticated
--     on public.agents for update to authenticated
--     using (public.gi_jwt_is_manager()) with check (public.gi_jwt_is_manager());
--   create policy agents_delete_authenticated
--     on public.agents for delete to authenticated
--     using (public.gi_jwt_is_manager());
-- =============================================================================

drop table if exists gi_rls_agents_by_role;
create temporary table gi_rls_agents_by_role (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $cut$
declare
  v_rls boolean;
  v_open boolean;
  v_select_open boolean;
  v_count integer;
  v_public integer;
  v_other_before integer;
  v_other_after integer;
  v_select_ok boolean;
  v_insert_ok boolean;
  v_update_ok boolean;
  v_delete_ok boolean;
  v_block_ok boolean;
  v_blank boolean;
  v_manager text := $pred$public.gi_jwt_is_manager()$pred$;
begin
  if to_regclass('public.agents') is null then
    raise exception 'agents table is missing; nothing saved';
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'agents';
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'pin'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'role'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'auth_user_id'
  ) then
    raise exception 'agent columns are missing; nothing saved';
  end if;

  if to_regprocedure('public.gi_jwt_is_manager()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents'
      and policyname = 'gi_agents_all_authenticated' and cmd = 'ALL'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents'
      and policyname = 'agents_select_authenticated' and cmd = 'SELECT'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
  ) into v_select_open;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public' and tablename = 'agents';

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents'
      and (
        coalesce(qual, '') ~ $re$\mid[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$\mid[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  if not v_open and v_select_open and not v_blank and v_count = 5
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'agents'
         and policyname = 'agents_insert_authenticated' and cmd = 'INSERT'
         and coalesce(with_check, '') like '%gi_jwt_is_manager()%'
         and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') <> 'true'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'agents'
         and policyname = 'agents_update_authenticated' and cmd = 'UPDATE'
         and coalesce(qual, '') like '%gi_jwt_is_manager()%'
         and coalesce(with_check, '') like '%gi_jwt_is_manager()%'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'agents'
         and policyname = 'agents_delete_authenticated' and cmd = 'DELETE'
         and coalesce(qual, '') like '%gi_jwt_is_manager()%'
     )
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'agents'
         and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
     ) then
    insert into gi_rls_agents_by_role(sort_key, section, detail) values
      (1, 'table', 'agents'),
      (2, 'policies_removed', 'none'),
      (3, 'select_by_role', 'open_kept'),
      (4, 'write_by_role', 'kept'),
      (5, 'blank_id', 'closed'),
      (6, 'anon_delete_block', 'kept'),
      (7, 'changed', 'no');
    return;
  end if;

  if not v_open or not v_select_open or v_count <> 6 then
    raise exception 'agent policies are not the expected open set; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents'
      and policyname = 'agents_insert_authenticated' and cmd = 'INSERT'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') <> 'true'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents'
      and policyname = 'agents_update_authenticated' and cmd = 'UPDATE'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents'
      and policyname = 'agents_delete_authenticated' and cmd = 'DELETE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
      and ('anon' = any (roles) or 'public' = any (roles))
  ) then
    raise exception 'an agent policy is missing; nothing saved';
  end if;

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public' and tablename = 'agents'
    and ('anon' = any (roles) or 'public' = any (roles))
    and policyname <> 'z_block_anon_delete';
  if v_public <> 0 then
    raise exception 'a public policy is still open; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public' and tablename <> 'agents';

  drop policy agents_insert_authenticated on public.agents;
  drop policy agents_update_authenticated on public.agents;
  drop policy agents_delete_authenticated on public.agents;
  execute 'create policy agents_insert_authenticated on public.agents for insert to authenticated with check (' || v_manager || ')';
  execute 'create policy agents_update_authenticated on public.agents for update to authenticated using (' || v_manager || ') with check (' || v_manager || ')';
  execute 'create policy agents_delete_authenticated on public.agents for delete to authenticated using (' || v_manager || ')';
  drop policy gi_agents_all_authenticated on public.agents;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents'
      and policyname = 'agents_select_authenticated' and cmd = 'SELECT'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
  ) into v_select_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents'
      and policyname = 'agents_insert_authenticated' and cmd = 'INSERT'
      and coalesce(with_check, '') like '%gi_jwt_is_manager()%'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') <> 'true'
  ) into v_insert_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents'
      and policyname = 'agents_update_authenticated' and cmd = 'UPDATE'
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
      and coalesce(with_check, '') like '%gi_jwt_is_manager()%'
  ) into v_update_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents'
      and policyname = 'agents_delete_authenticated' and cmd = 'DELETE'
      and coalesce(qual, '') like '%gi_jwt_is_manager()%'
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') <> 'true'
  ) into v_delete_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents'
      and policyname = 'z_block_anon_delete' and cmd = 'DELETE'
  ) into v_block_ok;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents'
      and policyname = 'gi_agents_all_authenticated'
  ) into v_open;
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agents'
      and (
        coalesce(qual, '') ~ $re$\mid[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$\mid[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;
  select count(*) into v_count
  from pg_policies where schemaname = 'public' and tablename = 'agents';
  select count(*) into v_public
  from pg_policies
  where schemaname = 'public' and tablename = 'agents'
    and ('anon' = any (roles) or 'public' = any (roles))
    and policyname <> 'z_block_anon_delete';
  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public' and tablename <> 'agents';

  if not v_select_ok or not v_insert_ok or not v_update_ok or not v_delete_ok or not v_block_ok
     or v_open or v_blank or v_count <> 5 or v_public <> 0
     or v_other_after <> v_other_before then
    raise exception 'more than the agent role path changed; nothing saved';
  end if;

  insert into gi_rls_agents_by_role(sort_key, section, detail) values
    (1, 'table', 'agents'),
    (2, 'policies_removed', 'gi_agents_all_authenticated'),
    (3, 'select_by_role', 'open_kept'),
    (4, 'write_by_role', 'installed'),
    (5, 'blank_id', 'closed'),
    (6, 'anon_delete_block', 'kept'),
    (7, 'other_tables', 'unchanged'),
    (8, 'changed', 'yes');
end
$cut$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_agents_by_role
order by sort_key;
