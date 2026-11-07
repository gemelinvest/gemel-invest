-- =============================================================================
-- GEMEL INVEST · narrow simulator saves to the person who saved them.
--
-- public.gi_simulator_saves has an open signed-in policy,
-- gi_simsaves_all_authenticated. It lets every signed-in person read
-- and change every saved calculation. Four limited policies sit beside
-- it. They grant every row to gi_jwt_is_manager(), which includes a
-- regular manager, and they ignore agent_name. The screen does neither.
-- An admin or an owner sees every save. Everyone else sees a save whose
-- agent_id is their own, or whose agent_name matches their name.
--
-- This file rewrites those four policies and removes the open one.
-- A regular manager, an operations user, and a team manager keep only
-- their own saves. A blank save with no name stays visible to an admin
-- or an owner only. No other table is touched. Saved calculations are
-- not read and are not changed.
--
-- The swap happens only when row security is on, agent_id and agent_name
-- exist, the agents id and name columns exist, the five known policies
-- are the whole set, and the helpers exist. If the new policies are
-- missing afterwards, the whole script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   create policy gi_simsaves_all_authenticated
--     on public.gi_simulator_saves
--     for all to authenticated
--     using (true) with check (true);
-- =============================================================================

drop table if exists gi_rls_simsaves_by_role;
create temporary table gi_rls_simsaves_by_role (
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
  v_pred text := $pred$
        public.gi_jwt_role() in ('admin', 'owner')
        or (
          public.gi_jwt_agent_id() <> ''
          and (
            coalesce(agent_id, '') = public.gi_jwt_agent_id()
            or exists (
              select 1
              from public.agents me
              where me.id = public.gi_jwt_agent_id()
                and coalesce(me.name, '') <> ''
                and lower(btrim(coalesce(agent_name, ''))) = lower(btrim(me.name))
            )
          )
        )
  $pred$;
begin
  if to_regclass('public.gi_simulator_saves') is null then
    raise exception 'simulator saves table is missing; nothing saved';
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'gi_simulator_saves';
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gi_simulator_saves' and column_name = 'agent_id'
  ) then
    raise exception 'agent_id column is missing; nothing saved';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gi_simulator_saves' and column_name = 'agent_name'
  ) then
    raise exception 'agent_name column is missing; nothing saved';
  end if;
  if to_regclass('public.agents') is null then
    raise exception 'agents table is missing; nothing saved';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'name'
  ) then
    raise exception 'agents link column is missing; nothing saved';
  end if;

  if to_regprocedure('public.gi_jwt_agent_id()') is null
     or to_regprocedure('public.gi_jwt_role()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_simulator_saves'
      and policyname = 'gi_simsaves_all_authenticated'
      and cmd = 'ALL'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_open;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_simulator_saves';

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_simulator_saves'
      and (
        coalesce(qual, '') ~ $re$coalesce[[:space:]]*\([[:space:]]*agent_id[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$coalesce[[:space:]]*\([[:space:]]*agent_id[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(qual, '') ~ $re$agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  if not v_open and not v_blank and v_count = 4
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'gi_simulator_saves'
         and policyname = 'simsaves_select_authenticated'
         and cmd = 'SELECT'
         and coalesce(qual, '') like '%''admin''%'
         and coalesce(qual, '') like '%''owner''%'
         and coalesce(qual, '') like '%agent_name%'
         and coalesce(qual, '') like '%gi_jwt_agent_id()%'
         and coalesce(qual, '') !~ 'gi_jwt_is_manager'
     ) then
    insert into gi_rls_simsaves_by_role(sort_key, section, detail) values
      (1, 'table', 'gi_simulator_saves'),
      (2, 'policies_removed', 'none'),
      (3, 'select_by_role', 'kept'),
      (4, 'write_by_role', 'kept'),
      (5, 'blank_agent', 'closed'),
      (6, 'changed', 'no');
    return;
  end if;

  if not v_open or v_count <> 5 then
    raise exception 'simulator save policies are not the expected open set; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_simulator_saves'
      and policyname = 'simsaves_select_authenticated' and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_simulator_saves'
      and policyname = 'simsaves_insert_authenticated' and cmd = 'INSERT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_simulator_saves'
      and policyname = 'simsaves_update_authenticated' and cmd = 'UPDATE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_simulator_saves'
      and policyname = 'simsaves_delete_authenticated' and cmd = 'DELETE'
  ) then
    raise exception 'a save policy is missing; nothing saved';
  end if;

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_simulator_saves'
    and ('anon' = any (roles) or 'public' = any (roles));
  if v_public <> 0 then
    raise exception 'a public policy is still open; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_simulator_saves';

  drop policy simsaves_select_authenticated on public.gi_simulator_saves;
  drop policy simsaves_insert_authenticated on public.gi_simulator_saves;
  drop policy simsaves_update_authenticated on public.gi_simulator_saves;
  drop policy simsaves_delete_authenticated on public.gi_simulator_saves;

  execute 'create policy simsaves_select_authenticated on public.gi_simulator_saves for select to authenticated using (' || v_pred || ')';
  execute 'create policy simsaves_insert_authenticated on public.gi_simulator_saves for insert to authenticated with check (' || v_pred || ')';
  execute 'create policy simsaves_update_authenticated on public.gi_simulator_saves for update to authenticated using (' || v_pred || ') with check (' || v_pred || ')';
  execute 'create policy simsaves_delete_authenticated on public.gi_simulator_saves for delete to authenticated using (' || v_pred || ')';

  drop policy gi_simsaves_all_authenticated on public.gi_simulator_saves;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_simulator_saves'
      and policyname = 'simsaves_select_authenticated'
      and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and coalesce(qual, '') like '%''admin''%'
      and coalesce(qual, '') like '%''owner''%'
      and coalesce(qual, '') like '%agent_name%'
      and coalesce(qual, '') like '%gi_jwt_agent_id()%'
      and coalesce(qual, '') !~ 'gi_jwt_is_manager'
  ) into v_select_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_simulator_saves'
      and policyname = 'simsaves_insert_authenticated'
      and cmd = 'INSERT'
      and coalesce(with_check, '') like '%''admin''%'
      and coalesce(with_check, '') like '%agent_name%'
      and coalesce(with_check, '') like '%gi_jwt_agent_id()%'
      and coalesce(with_check, '') !~ 'gi_jwt_is_manager'
  ) into v_insert_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_simulator_saves'
      and policyname = 'simsaves_update_authenticated'
      and cmd = 'UPDATE'
      and coalesce(qual, '') like '%''admin''%'
      and coalesce(with_check, '') like '%''admin''%'
      and coalesce(qual, '') like '%agent_name%'
      and coalesce(qual, '') !~ 'gi_jwt_is_manager'
  ) into v_update_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_simulator_saves'
      and policyname = 'simsaves_delete_authenticated'
      and cmd = 'DELETE'
      and coalesce(qual, '') like '%''admin''%'
      and coalesce(qual, '') like '%gi_jwt_agent_id()%'
      and coalesce(qual, '') !~ 'gi_jwt_is_manager'
  ) into v_delete_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gi_simulator_saves'
      and policyname = 'gi_simsaves_all_authenticated'
  ) into v_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gi_simulator_saves'
      and (
        coalesce(qual, '') ~ $re$coalesce[[:space:]]*\([[:space:]]*agent_id[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$coalesce[[:space:]]*\([[:space:]]*agent_id[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(qual, '') ~ $re$agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public' and tablename = 'gi_simulator_saves';

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'gi_simulator_saves'
    and ('anon' = any (roles) or 'public' = any (roles));

  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'gi_simulator_saves';

  if not v_select_ok or not v_insert_ok or not v_update_ok or not v_delete_ok
     or v_open or v_blank or v_count <> 4 or v_public <> 0
     or v_other_after <> v_other_before then
    raise exception 'more than the simulator save role path changed; nothing saved';
  end if;

  insert into gi_rls_simsaves_by_role(sort_key, section, detail) values
    (1, 'table', 'gi_simulator_saves'),
    (2, 'policies_removed', 'gi_simsaves_all_authenticated'),
    (3, 'select_by_role', 'installed'),
    (4, 'write_by_role', 'installed'),
    (5, 'blank_agent', 'closed'),
    (6, 'other_tables', 'unchanged'),
    (7, 'changed', 'yes');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_simsaves_by_role
order by sort_key;
