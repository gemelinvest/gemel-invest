-- =============================================================================
-- GEMEL INVEST · an additional assignee can update the lead (call notes, etc.).
--
-- Peer assignment keeps the original agent in assigned_agent_id and writes
-- the other agent into description, inside additionalAgents.
-- Cross-department SELECT already lets that agent read the lead
-- (supabase-gi-lead-cross-dept-read.sql). UPDATE still required
-- assigned_agent_id = the signed-in agent, so saving a call note failed
-- with RLS even though the card was visible.
--
-- This file adds the same id / exact-name matches onto the existing
-- UPDATE policy only (USING, and WITH CHECK when it is not already open).
-- Insert, delete, and SELECT stay as they are. No other table is touched.
-- Lead rows are not read and are not changed. If both matches are already
-- present on UPDATE, nothing changes. If the update policy is missing,
-- the script stops and saves nothing.
--
-- Security bounds (cyber remediation):
--   - RLS stays on; anon / open ALL policies are not touched
--   - Only authenticated users already named on the lead as additional
--     assignees (by agent id or exact agents.name) gain UPDATE
--   - Primary assignee, manager, referent, and other role paths stay
--   - No INSERT/DELETE widening; no revoke; no row rewrite
--
-- Run this in the Supabase SQL editor after it is on main (after the
-- cross-department read script if that was not already applied).
-- Paste the result rows. If it stops with an error, paste only the
-- error text.
-- =============================================================================

drop table if exists gi_rls_lead_cross_dept_update;
create temporary table gi_rls_lead_cross_dept_update (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_rls boolean;
  v_qual text;
  v_check text;
  v_extra text := '';
  v_check_extra text := '';
  v_peer text;
  v_description boolean;
  v_assigned boolean;
  v_agents boolean;
  v_after text;
  v_check_after text;
  v_check_open boolean;
  v_new_using text;
  v_new_check text;
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

  select qual, with_check
    into v_qual, v_check
  from pg_policies
  where schemaname = 'public'
    and tablename = 'campaign_leads'
    and policyname = 'campaign_leads_update_authenticated'
    and cmd = 'UPDATE';

  if v_qual is null then
    if exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'campaign_leads'
        and policyname = 'campaign_leads_all_authenticated'
    ) then
      insert into gi_rls_lead_cross_dept_update(sort_key, section, detail) values
        (1, 'table', 'campaign_leads'),
        (2, 'update_policy', 'open'),
        (3, 'changed', 'no');
      return;
    end if;
    raise exception 'update policy is missing; nothing saved';
  end if;

  v_check_open := regexp_replace(lower(coalesce(v_check, '')), '[()]', '', 'g') = 'true';

  if lower(v_qual) like '%strpos%'
     and v_qual like '%"id":"%'
     and v_qual like '%"name":"%'
     and (
       v_check_open
       or (
         lower(coalesce(v_check, '')) like '%strpos%'
         and coalesce(v_check, '') like '%"id":"%'
         and coalesce(v_check, '') like '%"name":"%'
       )
     ) then
    insert into gi_rls_lead_cross_dept_update(sort_key, section, detail) values
      (1, 'table', 'campaign_leads'),
      (2, 'update_policy', 'kept'),
      (3, 'changed', 'no');
    return;
  end if;

  v_peer := $peer$ or (
      public.gi_jwt_agent_id() <> ''
      and strpos(coalesce(description, ''), '"id":"' || public.gi_jwt_agent_id() || '"') > 0
    ) or exists (
      select 1
      from public.agents a
      where a.id = public.gi_jwt_agent_id()
        and public.gi_jwt_agent_id() <> ''
        and coalesce(btrim(a.name), '') <> ''
        and strpos(coalesce(description, ''), '"name":"' || btrim(a.name) || '"') > 0
    )$peer$;

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

  if not v_check_open
     and not (
       lower(coalesce(v_check, '')) like '%strpos%'
       and coalesce(v_check, '') like '%"id":"%'
       and coalesce(v_check, '') like '%"name":"%'
     ) then
    v_check_extra := v_peer;
  end if;

  if v_extra = '' and v_check_extra = '' then
    raise exception 'the cross-department update was not built; nothing saved';
  end if;

  v_new_using := '(' || v_qual || ')' || v_extra;
  if v_check_open then
    execute 'alter policy campaign_leads_update_authenticated on public.campaign_leads using ('
      || v_new_using || ')';
  else
    v_new_check := '(' || coalesce(v_check, v_qual) || ')' || v_check_extra;
    execute 'alter policy campaign_leads_update_authenticated on public.campaign_leads using ('
      || v_new_using || ') with check (' || v_new_check || ')';
  end if;

  select qual, with_check
    into v_after, v_check_after
  from pg_policies
  where schemaname = 'public'
    and tablename = 'campaign_leads'
    and policyname = 'campaign_leads_update_authenticated'
    and cmd = 'UPDATE';

  if v_after is null
     or lower(v_after) not like '%strpos%'
     or v_after not like '%"id":"%'
     or v_after not like '%"name":"%' then
    raise exception 'the cross-department update was not installed; nothing saved';
  end if;

  if not v_check_open
     and (
       v_check_after is null
       or lower(v_check_after) not like '%strpos%'
       or v_check_after not like '%"id":"%'
       or v_check_after not like '%"name":"%'
     ) then
    raise exception 'the cross-department update check was not installed; nothing saved';
  end if;

  insert into gi_rls_lead_cross_dept_update(sort_key, section, detail) values
    (1, 'table', 'campaign_leads'),
    (2, 'update_policy', 'upgraded'),
    (3, 'changed', 'yes');
end
$body$;

select section, detail
from gi_rls_lead_cross_dept_update
order by sort_key;
