-- =============================================================================
-- GEMEL INVEST · compare the agent card, the session token, and the live row.
-- Changes nothing.
--
-- The screen writes the id from the agent card. The database trusts the id
-- in the session token first. This file reports whether those two ids are
-- the same for אדוה, אוריה, and יובל, and whether a fresh live-floor row
-- exists for them. It also reports how many active agents disagree, and
-- whether the installed helper still prefers the token id.
--
-- No customer, proposal, or lead row is read. No email, code, or token is
-- printed. No function is replaced and no policy is created or dropped.
-- The only table created is temporary, for the result rows.
--
-- Run this once in the SQL editor. If the editor warns about a temporary
-- table, choose Run without RLS. Paste the result rows.
-- If it stops with an error, paste only the error text and do not run it
-- again.
-- =============================================================================

drop table if exists gi_identity_check;
create temporary table gi_identity_check (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_oid regprocedure;
  v_src text;
  v_agents integer;
  v_active integer;
  v_no_link integer;
  v_token_empty integer;
  v_token_mismatch integer;
  v_token_match integer;
  v_live_table boolean;
  v_rec record;
  v_n integer := 0;
begin
  v_oid := to_regprocedure('public.gi_jwt_agent_id()');
  if v_oid is null then
    insert into gi_identity_check(sort_key, section, detail) values
      (10, 'helper', 'missing');
  else
    v_src := lower(pg_get_functiondef(v_oid));
    insert into gi_identity_check(sort_key, section, detail) values
      (10, 'helper', 'present'),
      (11, 'helper_prefers_token', case when position('app_metadata' in v_src) > 0
        and position('->> ''agent_id''' in v_src) > 0 then 'yes' else 'no' end),
      (12, 'helper_falls_back_to_auth_uid', case when position('auth.uid()' in v_src) > 0 then 'yes' else 'no' end),
      (13, 'helper_uses_agents_link', case when position('auth_user_id' in v_src) > 0 then 'yes' else 'no' end),
      (14, 'helper_security_definer', case when position('security definer' in v_src) > 0 then 'yes' else 'no' end);
  end if;

  if to_regclass('public.agents') is null then
    insert into gi_identity_check(sort_key, section, detail) values
      (20, 'agents_table', 'missing'),
      (900, 'changed', 'no');
    return;
  end if;

  select count(*) into v_agents from public.agents;
  select count(*) into v_active from public.agents where active is distinct from false;
  select count(*) into v_no_link
  from public.agents a
  where a.active is distinct from false
    and nullif(btrim(a.auth_user_id::text), '') is null;
  select
    count(*) filter (where nullif(btrim(u.raw_app_meta_data ->> 'agent_id'), '') is null),
    count(*) filter (
      where nullif(btrim(u.raw_app_meta_data ->> 'agent_id'), '') is not null
        and nullif(btrim(u.raw_app_meta_data ->> 'agent_id'), '') is distinct from a.id::text
    ),
    count(*) filter (
      where nullif(btrim(u.raw_app_meta_data ->> 'agent_id'), '') = a.id::text
    )
  into v_token_empty, v_token_mismatch, v_token_match
  from public.agents a
  left join auth.users u on u.id::text = nullif(btrim(a.auth_user_id::text), '')
  where a.active is distinct from false;

  insert into gi_identity_check(sort_key, section, detail) values
    (20, 'agents', v_agents::text),
    (21, 'active_agents', v_active::text),
    (22, 'active_without_auth_link', v_no_link::text),
    (23, 'active_token_empty', v_token_empty::text),
    (24, 'active_token_matches_card', v_token_match::text),
    (25, 'active_token_differs_from_card', v_token_mismatch::text);

  v_live_table := to_regclass('public.gi_agent_live') is not null;
  insert into gi_identity_check(sort_key, section, detail) values
    (30, 'live_table', case when v_live_table then 'yes' else 'no' end);

  for v_rec in
    select
      a.name,
      lower(coalesce(a.role, '')) as card_role,
      case when nullif(btrim(a.auth_user_id::text), '') is null then 'no_link' else 'linked' end as link_state,
      case
        when u.id is null then 'no_auth_user'
        when nullif(btrim(u.raw_app_meta_data ->> 'agent_id'), '') is null then 'token_empty'
        when nullif(btrim(u.raw_app_meta_data ->> 'agent_id'), '') = a.id::text then 'match'
        else 'differs'
      end as token_vs_card,
      lower(coalesce(u.raw_app_meta_data ->> 'role', '')) as token_role,
      case
        when not v_live_table then 'no_table'
        when live.id is null then 'no_row'
        when live.online is distinct from true then 'offline'
        when live.updated_at > now() - interval '2 minutes' then 'fresh'
        else 'stale'
      end as live_state,
      case
        when not v_live_table or live.id is null then 'none'
        when coalesce(live.agent_id, '') = '' then 'blank'
        when live.agent_id = a.id::text then 'match'
        else 'other'
      end as live_vs_card
    from public.agents a
    left join auth.users u on u.id::text = nullif(btrim(a.auth_user_id::text), '')
    left join lateral (
      select l.id, l.agent_id, l.online, l.updated_at
      from public.gi_agent_live l
      where v_live_table
        and (l.agent_id = a.id::text or l.name = a.name)
      order by l.updated_at desc
      limit 1
    ) live on true
    where a.name like '%אדוה%'
       or a.name like '%אוריה%'
       or a.name like '%יובל%'
       or coalesce(a.username, '') like '%אדוה%'
       or coalesce(a.username, '') like '%אוריה%'
       or coalesce(a.username, '') like '%יובל%'
    order by a.name
  loop
    v_n := v_n + 1;
    insert into gi_identity_check(sort_key, section, detail) values
      (100 + v_n * 10, 'person', v_rec.name),
      (101 + v_n * 10, 'card_role', v_rec.card_role),
      (102 + v_n * 10, 'auth_link', v_rec.link_state),
      (103 + v_n * 10, 'token_vs_card', v_rec.token_vs_card),
      (104 + v_n * 10, 'token_role', v_rec.token_role),
      (105 + v_n * 10, 'live_row', v_rec.live_state),
      (106 + v_n * 10, 'live_vs_card', v_rec.live_vs_card);
  end loop;

  if v_n = 0 then
    insert into gi_identity_check(sort_key, section, detail) values
      (100, 'person', 'none');
  end if;

  insert into gi_identity_check(sort_key, section, detail)
  select 400, 'proposals_insert',
    case
      when not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'proposals' and cmd = 'INSERT'
      ) then 'missing'
      when exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'proposals' and cmd = 'INSERT'
          and coalesce(with_check, '') like '%gi_jwt_is_manager%'
      ) then 'manager_or_own'
      else 'other'
    end;

  insert into gi_identity_check(sort_key, section, detail)
  select 410, 'live_insert',
    case
      when to_regclass('public.gi_agent_live') is null then 'no_table'
      when not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'gi_agent_live' and cmd = 'INSERT'
      ) then 'missing'
      when exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'gi_agent_live' and cmd = 'INSERT'
          and regexp_replace(lower(coalesce(with_check, '')), '[()]', '', 'g') = 'true'
      ) then 'open'
      when exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'gi_agent_live' and cmd = 'INSERT'
          and coalesce(with_check, '') like '%gi_jwt_agent_id%'
      ) then 'own_row'
      else 'other'
    end;

  insert into gi_identity_check(sort_key, section, detail) values
    (900, 'changed', 'no');
end
$body$;

select section, detail
from gi_identity_check
order by sort_key;
