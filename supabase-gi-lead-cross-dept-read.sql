-- =============================================================================
-- GEMEL INVEST · an additional assignee can read the lead on the computer.
--
-- A peer assignment keeps the original agent in assigned_agent_id and
-- writes the other agent into description, inside additionalAgents.
-- The older select rule only allows assigned_agent_id = the signed-in
-- agent, so the other computer never receives the lead.
--
-- This file adds that read onto the existing select policy. It matches
-- the agent id ("id":"<id>") and the exact agent name ("name":"<name>").
-- Insert, update, and delete stay as they are. Lead rows are not read
-- and are not changed. If both matches are already present, nothing changes.
-- If the select policy is missing, the script stops and saves nothing.
--
-- Run this in the Supabase SQL editor after it is on main. Paste the
-- result rows. If it stops with an error, paste only the error text.
-- =============================================================================

drop table if exists gi_rls_lead_cross_dept_read;
create temporary table gi_rls_lead_cross_dept_read (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_rls boolean;
  v_qual text;
  v_extra text := '';
  v_description boolean;
  v_assigned boolean;
  v_agents boolean;
  v_after text;
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
      and column_name = 'description'
  ) into v_description;
  if v_description is distinct from true then
    raise exception 'description column is missing; nothing saved';
  end if;

  if to_regclass('public.agents') is null then
    raise exception 'agents table is missing; nothing saved';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agents'
      and column_name = 'name'
  ) into v_agents;
  if v_agents is distinct from true then
    raise exception 'agents.name column is missing; nothing saved';
  end if;

  if to_regprocedure('public.gi_jwt_agent_id()') is null then
    raise exception 'jwt helper is missing; nothing saved';
  end if;

  select qual
    into v_qual
  from pg_policies
  where schemaname = 'public'
    and tablename = 'campaign_leads'
    and policyname = 'campaign_leads_select_authenticated'
    and cmd = 'SELECT';

  if v_qual is null then
    if exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'campaign_leads'
        and policyname = 'campaign_leads_all_authenticated'
    ) then
      insert into gi_rls_lead_cross_dept_read(sort_key, section, detail) values
        (1, 'table', 'campaign_leads'),
        (2, 'select_policy', 'open'),
        (3, 'changed', 'no');
      return;
    end if;
    raise exception 'select policy is missing; nothing saved';
  end if;

  if lower(v_qual) like '%strpos%'
     and v_qual like '%"id":"%'
     and v_qual like '%"name":"%' then
    insert into gi_rls_lead_cross_dept_read(sort_key, section, detail) values
      (1, 'table', 'campaign_leads'),
      (2, 'select_policy', 'kept'),
      (3, 'changed', 'no');
    return;
  end if;

  if not (lower(v_qual) like '%strpos%' and v_qual like '%"id":"%') then
    v_extra := v_extra || $id$ or (
      public.gi_jwt_agent_id() <> ''
      and strpos(coalesce(description, ''), '"id":"' || public.gi_jwt_agent_id() || '"') > 0
    )$id$;
  end if;

  if v_qual not like '%"name":"%' then
    v_extra := v_extra || $name$ or exists (
      select 1
      from public.agents a
      where a.id = public.gi_jwt_agent_id()
        and public.gi_jwt_agent_id() <> ''
        and coalesce(btrim(a.name), '') <> ''
        and strpos(coalesce(description, ''), '"name":"' || btrim(a.name) || '"') > 0
    )$name$;
  end if;

  if v_extra = '' then
    raise exception 'the cross-department read was not built; nothing saved';
  end if;

  execute 'alter policy campaign_leads_select_authenticated on public.campaign_leads using (('
    || v_qual || ')' || v_extra || ')';

  select qual
    into v_after
  from pg_policies
  where schemaname = 'public'
    and tablename = 'campaign_leads'
    and policyname = 'campaign_leads_select_authenticated'
    and cmd = 'SELECT';

  if v_after is null
     or lower(v_after) not like '%strpos%'
     or v_after not like '%"id":"%'
     or v_after not like '%"name":"%' then
    raise exception 'the cross-department read was not installed; nothing saved';
  end if;

  insert into gi_rls_lead_cross_dept_read(sort_key, section, detail) values
    (1, 'table', 'campaign_leads'),
    (2, 'select_policy', 'upgraded'),
    (3, 'changed', 'yes');
end
$body$;

select section, detail
from gi_rls_lead_cross_dept_read
order by sort_key;
