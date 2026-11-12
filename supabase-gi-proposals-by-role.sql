-- =============================================================================
-- GEMEL INVEST · narrow the proposals table to the signed-in role.
--
-- public.proposals has an open signed-in policy,
-- gi_proposals_all_authenticated. It lets every signed-in person read
-- and change every proposal. The four own policies sit beside it, and
-- they treat a blank agent_id as allowed, so an unassigned proposal stays
-- visible to every signed-in person after the open path is removed.
--
-- This file rewrites the four policies and removes the open one.
-- A manager, and an operations user, can still read and write every
-- proposal, so the office screens stay full.
-- A team manager can read and write a proposal of their own and a
-- proposal of an agent whose team_manager_id is theirs.
-- An elementary user can read and write their own proposal and a proposal
-- whose agent_role is elementary.
-- Anyone else can read and write a proposal whose agent_id is their own,
-- and a proposal whose agent_name is exactly their name even when the
-- stored agent_id belongs to another row of the same person.
-- A proposal with a blank agent_id is still visible when its agent_name
-- matches that person, or a member of that team manager's team.
-- A blank proposal with no name stays visible to a manager and to
-- operations only. No other table is touched. Proposal rows are not
-- read and are not changed.
--
-- The swap happens only when row security is on, agent_id, agent_name,
-- and agent_role exist, the agents name, username, and team_manager_id
-- columns exist, the five known policies are the whole set, and the
-- helpers exist. If the new policies are missing afterwards, the whole
-- script stops and saves nothing.
--
-- Run this once, after it is on main. If the editor warns about a
-- temporary table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
--
-- Undo for this file alone, and only if a later check asks for it:
--   create policy gi_proposals_all_authenticated
--     on public.proposals
--     for all to authenticated
--     using (true) with check (true);
-- =============================================================================

drop table if exists gi_rls_proposals_by_role;
create temporary table gi_rls_proposals_by_role (
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
          and exists (
            select 1
            from public.agents me
            where me.id = public.gi_jwt_agent_id()
              and (
                (coalesce(btrim(me.name), '') <> '' and coalesce(agent_name, '') = btrim(me.name))
                or (coalesce(btrim(me.username), '') <> '' and coalesce(agent_name, '') = btrim(me.username))
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
  if to_regclass('public.proposals') is null then
    raise exception 'proposals table is missing; nothing saved';
  end if;

  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'proposals';
  if v_rls is distinct from true then
    raise exception 'row security is off; nothing saved';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'proposals' and column_name = 'agent_id'
  ) then
    raise exception 'agent_id column is missing; nothing saved';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'proposals' and column_name = 'agent_name'
  ) then
    raise exception 'agent_name column is missing; nothing saved';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'proposals' and column_name = 'agent_role'
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
      and tablename = 'proposals'
      and policyname = 'gi_proposals_all_authenticated'
      and cmd = 'ALL'
      and 'authenticated' = any (roles)
      and not ('anon' = any (roles) or 'public' = any (roles))
      and regexp_replace(lower(coalesce(qual, '')), '[()]', '', 'g') = 'true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
  ) into v_open;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'proposals';

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'proposals'
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
       where schemaname = 'public' and tablename = 'proposals'
         and policyname = 'proposals_select_own'
         and cmd = 'SELECT'
         and coalesce(qual, '') like '%teammanager%'
         and coalesce(qual, '') like '%opsagent%'
         and coalesce(qual, '') like '%elementary%'
     ) then
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'proposals'
        and policyname = 'proposals_select_own'
        and cmd = 'SELECT'
        and coalesce(qual, '') like '%btrim(me.name)%'
    ) then
      insert into gi_rls_proposals_by_role(sort_key, section, detail) values
        (1, 'table', 'proposals'),
        (2, 'policies_removed', 'none'),
        (3, 'select_by_role', 'kept'),
        (4, 'write_by_role', 'kept'),
        (5, 'blank_agent', 'closed'),
        (6, 'changed', 'no');
      return;
    end if;

    drop policy proposals_select_own on public.proposals;
    drop policy proposals_insert_own on public.proposals;
    drop policy proposals_update_own on public.proposals;
    drop policy proposals_delete_own on public.proposals;

    execute 'create policy proposals_select_own on public.proposals for select to authenticated using (' || v_pred || ')';
    execute 'create policy proposals_insert_own on public.proposals for insert to authenticated with check (' || v_pred || ')';
    execute 'create policy proposals_update_own on public.proposals for update to authenticated using (' || v_pred || ') with check (' || v_pred || ')';
    execute 'create policy proposals_delete_own on public.proposals for delete to authenticated using (' || v_pred || ')';

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'proposals'
        and policyname = 'proposals_select_own'
        and cmd = 'SELECT'
        and coalesce(qual, '') like '%btrim(me.name)%'
    ) then
      raise exception 'the same-name proposal read was not installed; nothing saved';
    end if;

    insert into gi_rls_proposals_by_role(sort_key, section, detail) values
      (1, 'table', 'proposals'),
      (2, 'policies_removed', 'none'),
      (3, 'select_by_role', 'upgraded'),
      (4, 'write_by_role', 'upgraded'),
      (5, 'blank_agent', 'closed'),
      (6, 'changed', 'yes');
    return;
  end if;

  if not v_open or v_count <> 5 then
    raise exception 'proposals policies are not the expected open set; nothing saved';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals'
      and policyname = 'proposals_select_own' and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals'
      and policyname = 'proposals_insert_own' and cmd = 'INSERT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals'
      and policyname = 'proposals_update_own' and cmd = 'UPDATE'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals'
      and policyname = 'proposals_delete_own' and cmd = 'DELETE'
  ) then
    raise exception 'an own policy is missing; nothing saved';
  end if;

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'proposals'
    and ('anon' = any (roles) or 'public' = any (roles));
  if v_public <> 0 then
    raise exception 'a public policy is still open; nothing saved';
  end if;

  select count(*) into v_other_before
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'proposals';

  drop policy proposals_select_own on public.proposals;
  drop policy proposals_insert_own on public.proposals;
  drop policy proposals_update_own on public.proposals;
  drop policy proposals_delete_own on public.proposals;

  execute 'create policy proposals_select_own on public.proposals for select to authenticated using (' || v_pred || ')';
  execute 'create policy proposals_insert_own on public.proposals for insert to authenticated with check (' || v_pred || ')';
  execute 'create policy proposals_update_own on public.proposals for update to authenticated using (' || v_pred || ') with check (' || v_pred || ')';
  execute 'create policy proposals_delete_own on public.proposals for delete to authenticated using (' || v_pred || ')';

  drop policy gi_proposals_all_authenticated on public.proposals;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals'
      and policyname = 'proposals_select_own'
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
    where schemaname = 'public' and tablename = 'proposals'
      and policyname = 'proposals_insert_own'
      and cmd = 'INSERT'
      and coalesce(with_check, '') like '%teammanager%'
      and coalesce(with_check, '') like '%gi_jwt_agent_id()%'
      and coalesce(with_check, '') !~ 'teamManager|opsAgent'
  ) into v_insert_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals'
      and policyname = 'proposals_update_own'
      and cmd = 'UPDATE'
      and coalesce(qual, '') like '%teammanager%'
      and coalesce(with_check, '') like '%teammanager%'
      and coalesce(qual, '') !~ 'teamManager|opsAgent'
  ) into v_update_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals'
      and policyname = 'proposals_delete_own'
      and cmd = 'DELETE'
      and coalesce(qual, '') like '%teammanager%'
      and coalesce(qual, '') like '%gi_jwt_agent_id()%'
      and coalesce(qual, '') !~ 'teamManager|opsAgent'
  ) into v_delete_ok;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals'
      and policyname = 'gi_proposals_all_authenticated'
  ) into v_open;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'proposals'
      and (
        coalesce(qual, '') ~ $re$coalesce[[:space:]]*\([[:space:]]*agent_id[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$coalesce[[:space:]]*\([[:space:]]*agent_id[[:space:]]*,[[:space:]]*''(::text)?[[:space:]]*\)[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(qual, '') ~ $re$agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
        or coalesce(with_check, '') ~ $re$agent_id[[:space:]]*=[[:space:]]*''(::text)?$re$
      )
  ) into v_blank;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public' and tablename = 'proposals';

  select count(*) into v_public
  from pg_policies
  where schemaname = 'public'
    and tablename = 'proposals'
    and ('anon' = any (roles) or 'public' = any (roles));

  select count(*) into v_other_after
  from pg_policies
  where schemaname = 'public'
    and tablename <> 'proposals';

  if not v_select_ok or not v_insert_ok or not v_update_ok or not v_delete_ok
     or v_open or v_blank or v_count <> 4 or v_public <> 0
     or v_other_after <> v_other_before then
    raise exception 'more than the proposals role path changed; nothing saved';
  end if;

  insert into gi_rls_proposals_by_role(sort_key, section, detail) values
    (1, 'table', 'proposals'),
    (2, 'policies_removed', 'gi_proposals_all_authenticated'),
    (3, 'select_by_role', 'installed'),
    (4, 'write_by_role', 'installed'),
    (5, 'blank_agent', 'closed'),
    (6, 'other_tables', 'unchanged'),
    (7, 'changed', 'yes');
end
$body$;

notify pgrst, 'reload schema';

select section, detail
from gi_rls_proposals_by_role
order by sort_key;
