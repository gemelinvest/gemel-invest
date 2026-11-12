-- =============================================================================
-- GEMEL INVEST · narrow the leads table to the signed-in role.
--
-- public.campaign_leads has an open signed-in policy,
-- campaign_leads_all_authenticated. It lets every signed-in person read
-- and change every lead. Four narrower policies sit beside it, but they
-- compare teamManager and opsAgent with capital letters. The role helper
-- returns lowercase, so those comparisons do not match.
--
-- This file rewrites the four policies and removes the open one.
-- A manager, a referent, operations, and a team manager can still read
-- every lead, so the inbox and the office screens stay full.
-- Anyone else can read a lead assigned to them, a lead they
-- themselves last saved, and a lead that names them as an additional
-- assignee, either by agent id or by the exact agent name stored on
-- the lead. The saved-by path is what lets them pass a lead to another
-- agent. They can insert a lead assigned to themselves.
-- A manager or a referent can insert, update, and delete any lead.
-- z_block_anon_delete stays. No other table is touched. Lead rows are
-- not read and are not changed.
--
-- The swap happens only when row security is on, assigned_agent_id and
-- updated_by_name exist,
-- the six known policies are the whole set, and the helpers exist.
-- If the new policies are missing afterwards, the whole script stops and
-- saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   drop policy if exists campaign_leads_select_authenticated on public.campaign_leads;
--   drop policy if exists campaign_leads_insert_authenticated on public.campaign_leads;
--   drop policy if exists campaign_leads_update_authenticated on public.campaign_leads;
--   drop policy if exists campaign_leads_delete_authenticated on public.campaign_leads;
--   create policy campaign_leads_all_authenticated
--     on public.campaign_leads
--     for all to authenticated
--     using (true) with check (true);
--   Then run supabase-gi-pe-campaign-leads-rls.sql to restore the four
--   older policies.
-- =============================================================================

drop table if exists gi_rls_leads_by_role;
create temporary table gi_rls_leads_by_role (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_rls boolean;
  v_assigned boolean;
  v_updated_by boolean;
  v_open boolean;
  v_mixed boolean;
  v_block boolean;
  v_count integer;
  v_public integer;
  v_other_before integer;
  v_other_after integer;
  v_select_ok boolean;
  v_insert_ok boolean;
  v_update_ok boolean;
  v_delete_ok boolean;
  v_description boolean;
  v_select text := $policy$
    create policy campaign_leads_select_authenticated
      on public.campaign_leads
      for select
      to authenticated
      using (
        public.gi_jwt_is_manager()
        or public.gi_jwt_role() in (
          'referent', 'רפרנטית',
          'ops', 'opsagent', 'ops_agent', 'תפעול', 'מנהל תפעול', 'נציג תפעול',
          'teammanager', 'team_manager', 'מנהל צוות'
        )
        or (
          public.gi_jwt_agent_id() <> ''
          and coalesce(assigned_agent_id, '') = public.gi_jwt_agent_id()
        )
        or (
          public.gi_jwt_agent_id() <> ''
          and strpos(coalesce(description, ''), '"id":"' || public.gi_jwt_agent_id() || '"') > 0
        )
        or exists (
          select 1
          from public.agents a
          where a.id = public.gi_jwt_agent_id()
            and public.gi_jwt_agent_id() <> ''
            and coalesce(btrim(a.name), '') <> ''
            and strpos(coalesce(description, ''), '"name":"' || btrim(a.name) || '"') > 0
        )
        or exists (
          select 1
          from public.agents a
          where a.id = public.gi_jwt_agent_id()
            and public.gi_jwt_agent_id() <> ''
            and coalesce(a.name, '') <> ''
            and coalesce(updated_by_name, '') = a.name
        )
      )
  $policy$;
begin
  if to_regclass('public.campaign_leads') is null then
    raise exception 'leads table is missing; nothing saved';
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'campaign_leads';
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'campaign_leads'
      and column_name = 'assigned_agent_id'
  ) into v_assigned;
  if v_assigned is distinct from true then
    raise exception 'assigned_agent_id column is missing; nothing saved';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'campaign_leads'
      and column_name = 'updated_by_name'
  ) into v_updated_by;
  if v_updated_by is distinct from true then
    raise exception 'updated_by_name column is missing; nothing saved';
  end if;

  if to_regprocedure('public.gi_jwt_agent_id()') is null
     or to_regprocedure('public.gi_jwt_is_manager()') is null
     or to_regprocedure('public.gi_jwt_role()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'campaign_leads'
      and policyname = 'campaign_leads_all_authenticated'
      and cmd = 'ALL'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'campaign_leads'
      and (
        coalesce(qual, '') ~ 'teamManager|opsAgent'
        or coalesce(with_check, '') ~ 'teamManager|opsAgent'
      )
  ) into v_mixed;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'campaign_leads'
      and policyname = 'z_block_anon_delete'
      and cmd = 'DELETE'
      and ('anon' = any (roles) or 'public' = any (roles))
  ) into v_block;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'campaign_leads';

  if not v_open and not v_mixed and v_block and v_count = 5
     and exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'campaign_leads'
         and policyname = 'campaign_leads_select_authenticated'
         and coalesce(qual, '') like '%referent%'
         and coalesce(qual, '') like '%teammanager%'
     ) then
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'campaign_leads'
        and policyname = 'campaign_leads_select_authenticated'
        and lower(coalesce(qual, '')) like '%strpos%'
        and lower(coalesce(qual, '')) like '%description%'
        and coalesce(qual, '') like '%"name":"%'
    ) then
      insert into gi_rls_leads_by_role(sort_key, section, detail) values
        (1, 'table', 'campaign_leads'),
        (2, 'policies_removed', 'none'),
        (3, 'select_by_role', 'kept'),
        (4, 'write_by_role', 'kept'),
        (5, 'anon_delete_block', 'kept'),
        (6, 'changed', 'no');
      return;
    end if;

    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'campaign_leads'
        and column_name = 'description'
    ) into v_description;
    if v_description is distinct from true then
      raise exception 'description column is missing; nothing saved';
    end if;

    drop policy campaign_leads_select_authenticated on public.campaign_leads;
    execute v_select;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'campaign_leads'
        and policyname = 'campaign_leads_select_authenticated'
        and cmd = 'SELECT'
        and lower(coalesce(qual, '')) like '%strpos%'
        and lower(coalesce(qual, '')) like '%description%'
        and coalesce(qual, '') like '%"name":"%'
    ) or not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'campaign_leads'
        and policyname = 'campaign_leads_insert_authenticated'
    ) or not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'campaign_leads'
        and policyname = 'campaign_leads_update_authenticated'
    ) or not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'campaign_leads'
        and policyname = 'campaign_leads_delete_authenticated'
    ) or exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'campaign_leads'
        and policyname = 'campaign_leads_all_authenticated'
    ) then
      raise exception 'the cross-department read was not installed; nothing saved';
    end if;

    insert into gi_rls_leads_by_role(sort_key, section, detail) values
      (1, 'table', 'campaign_leads'),
      (2, 'policies_removed', 'none'),
      (3, 'select_by_role', 'upgraded'),
      (4, 'write_by_role', 'kept'),
      (5, 'anon_delete_block', 'kept'),
      (6, 'changed', 'yes');
    return;
  end if;

  if not v_open or v_count <> 6 or not v_block then
    raise exception 'leads policies are not the expected open set; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'campaign_leads_select_authenticated' and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'campaign_leads_insert_authenticated' and cmd = 'INSERT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'campaign_leads_update_authenticated' and cmd = 'UPDATE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'campaign_leads_delete_authenticated' and cmd = 'DELETE'
  ) then
    raise exception 'a role policy is missing; nothing saved';
  end if;

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'campaign_leads'
    and ('anon' = any (roles) or 'public' = any (roles))
    and policyname <> 'z_block_anon_delete';
  if v_public <> 0 then
    raise exception 'a public policy is still open; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'campaign_leads';

  drop policy campaign_leads_select_authenticated on public.campaign_leads;
  drop policy campaign_leads_insert_authenticated on public.campaign_leads;
  drop policy campaign_leads_update_authenticated on public.campaign_leads;
  drop policy campaign_leads_delete_authenticated on public.campaign_leads;

  execute v_select;

  execute $policy$
    create policy campaign_leads_insert_authenticated
      on public.campaign_leads
      for insert
      to authenticated
      with check (
        public.gi_jwt_is_manager()
        or public.gi_jwt_role() in ('referent', 'רפרנטית')
        or (
          public.gi_jwt_agent_id() <> ''
          and coalesce(assigned_agent_id, '') = public.gi_jwt_agent_id()
        )
      )
  $policy$;

  execute $policy$
    create policy campaign_leads_update_authenticated
      on public.campaign_leads
      for update
      to authenticated
      using (
        public.gi_jwt_is_manager()
        or public.gi_jwt_role() in ('referent', 'רפרנטית')
        or (
          public.gi_jwt_agent_id() <> ''
          and coalesce(assigned_agent_id, '') = public.gi_jwt_agent_id()
        )
      )
      with check (true)
  $policy$;

  execute $policy$
    create policy campaign_leads_delete_authenticated
      on public.campaign_leads
      for delete
      to authenticated
      using (
        public.gi_jwt_is_manager()
        or public.gi_jwt_role() in ('referent', 'רפרנטית')
        or (
          public.gi_jwt_agent_id() <> ''
          and coalesce(assigned_agent_id, '') = public.gi_jwt_agent_id()
        )
      )
  $policy$;

  drop policy campaign_leads_all_authenticated on public.campaign_leads;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'campaign_leads_select_authenticated'
      and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and coalesce(qual, '') like '%referent%'
      and coalesce(qual, '') like '%teammanager%'
      and lower(coalesce(qual, '')) like '%strpos%'
        and lower(coalesce(qual, '')) like '%description%'
      and coalesce(qual, '') like '%"name":"%'
      and coalesce(qual, '') !~ 'teamManager|opsAgent'
  ) into v_select_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'campaign_leads_insert_authenticated'
      and cmd = 'INSERT'
      and coalesce(with_check, '') like '%referent%'
      and coalesce(with_check, '') like '%gi_jwt_agent_id()%'
      and coalesce(with_check, '') !~ 'teamManager|opsAgent'
  ) into v_insert_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'campaign_leads_update_authenticated'
      and cmd = 'UPDATE'
      and coalesce(qual, '') like '%referent%'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
      and coalesce(qual, '') !~ 'teamManager|opsAgent'
  ) into v_update_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'campaign_leads_delete_authenticated'
      and cmd = 'DELETE'
      and coalesce(qual, '') like '%referent%'
      and coalesce(qual, '') !~ 'teamManager|opsAgent'
  ) into v_delete_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'campaign_leads_all_authenticated'
  ) into v_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_leads'
      and policyname = 'z_block_anon_delete'
  ) into v_block;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public' and tablename = 'campaign_leads';

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'campaign_leads'
    and ('anon' = any (roles) or 'public' = any (roles))
    and policyname <> 'z_block_anon_delete';

  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'campaign_leads';

  if not v_select_ok or not v_insert_ok or not v_update_ok or not v_delete_ok
     or v_open or not v_block or v_count <> 5 or v_public <> 0
     or v_other_after <> v_other_before then
    raise exception 'more than the leads role path changed; nothing saved';
  end if;

  insert into gi_rls_leads_by_role(sort_key, section, detail) values
    (1, 'table', 'campaign_leads'),
    (2, 'policies_removed', 'campaign_leads_all_authenticated'),
    (3, 'select_by_role', 'installed'),
    (4, 'write_by_role', 'installed'),
    (5, 'anon_delete_block', 'kept'),
    (6, 'other_tables', 'unchanged'),
    (7, 'changed', 'yes');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_leads_by_role
order by sort_key;
