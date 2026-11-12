-- =============================================================================
-- GEMEL INVEST · a proposal saved under the agent's own name stays visible.
--
-- A draft can keep another row's agent_id when two agent records share a
-- name. The select rule then hides it, so it is missing from «הצעות».
--
-- This file lets the signed-in agent read and update a proposal whose
-- agent_name is exactly their name or username. Other agents' proposals
-- stay hidden. Lead rows are not read and are not changed.
-- If the match is already present, nothing changes.
-- If the select policy is missing, the script stops and saves nothing.
--
-- Run this in the Supabase SQL editor. Paste the result rows.
-- If it stops with an error, paste only the error text.
-- =============================================================================

drop table if exists gi_rls_proposal_same_name;
create temporary table gi_rls_proposal_same_name (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_rls boolean;
  v_qual text;
  v_check text;
  v_extra text := $name$ or exists (
    select 1
    from public.agents me
    where me.id = public.gi_jwt_agent_id()
      and public.gi_jwt_agent_id() <> ''
      and (
        (coalesce(btrim(me.name), '') <> '' and coalesce(agent_name, '') = btrim(me.name))
        or (coalesce(btrim(me.username), '') <> '' and coalesce(agent_name, '') = btrim(me.username))
      )
  )$name$;
begin
  if to_regclass('public.proposals') is null or to_regclass('public.agents') is null then
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

  if to_regprocedure('public.gi_jwt_agent_id()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'proposals' and column_name = 'agent_name'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agents' and column_name = 'name'
  ) then
    raise exception 'agent name column is missing; nothing saved';
  end if;

  select qual
    into v_qual
  from pg_policies
  where schemaname = 'public'
    and tablename = 'proposals'
    and policyname = 'proposals_select_own'
    and cmd = 'SELECT';

  if v_qual is null then
    raise exception 'select policy is missing; nothing saved';
  end if;

  if v_qual like '%btrim(me.name)%' then
    insert into gi_rls_proposal_same_name(sort_key, section, detail) values
      (1, 'table', 'proposals'),
      (2, 'select_policy', 'kept'),
      (3, 'changed', 'no');
    return;
  end if;

  execute 'alter policy proposals_select_own on public.proposals using ((' || v_qual || ')' || v_extra || ')';

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals'
      and policyname = 'proposals_update_own' and cmd = 'UPDATE'
  ) then
    select qual, with_check into v_qual, v_check
    from pg_policies
    where schemaname = 'public' and tablename = 'proposals'
      and policyname = 'proposals_update_own' and cmd = 'UPDATE';
    if v_qual is not null and v_qual not like '%btrim(me.name)%' then
      execute 'alter policy proposals_update_own on public.proposals using (('
        || v_qual || ')' || v_extra || ') with check (('
        || coalesce(v_check, v_qual) || ')' || v_extra || ')';
    end if;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals'
      and policyname = 'proposals_insert_own' and cmd = 'INSERT'
  ) then
    select with_check into v_check
    from pg_policies
    where schemaname = 'public' and tablename = 'proposals'
      and policyname = 'proposals_insert_own' and cmd = 'INSERT';
    if v_check is not null and v_check not like '%btrim(me.name)%' then
      execute 'alter policy proposals_insert_own on public.proposals with check (('
        || v_check || ')' || v_extra || ')';
    end if;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals'
      and policyname = 'proposals_delete_own' and cmd = 'DELETE'
  ) then
    select qual into v_qual
    from pg_policies
    where schemaname = 'public' and tablename = 'proposals'
      and policyname = 'proposals_delete_own' and cmd = 'DELETE';
    if v_qual is not null and v_qual not like '%btrim(me.name)%' then
      execute 'alter policy proposals_delete_own on public.proposals using (('
        || v_qual || ')' || v_extra || ')';
    end if;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'proposals'
      and policyname = 'proposals_select_own'
      and coalesce(qual, '') like '%btrim(me.name)%'
  ) then
    raise exception 'the same-name proposal read was not installed; nothing saved';
  end if;

  insert into gi_rls_proposal_same_name(sort_key, section, detail) values
    (1, 'table', 'proposals'),
    (2, 'select_policy', 'upgraded'),
    (3, 'changed', 'yes');
end
$body$;

select section, detail
from gi_rls_proposal_same_name
order by sort_key;
