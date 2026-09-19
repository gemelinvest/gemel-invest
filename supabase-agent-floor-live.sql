-- GEMEL INVEST · Agent floor live location (פעילות נציג)
-- Additive only. Does not alter customers / proposals / campaign_leads.
-- Apply once in Supabase SQL Editor.
-- Designed for thousands of connected agents: one row per session, REST upsert,
-- realtime only for admin/manager watchers — not a shared Presence room.
-- The floor list shows only rows with online=true and a fresh heartbeat.

create table if not exists public.gi_agent_live (
  id text primary key,
  agent_id text not null default '',
  name text not null default '',
  online boolean not null default true,
  view text not null default '',
  view_label text not null default '',
  wizard_open boolean not null default false,
  flow_type text not null default '',
  step_id integer not null default 0,
  step_label text not null default '',
  np_stage text not null default '',
  action text not null default 'idle',
  lead_id text not null default '',
  proposal_id text not null default '',
  entity_label text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists gi_agent_live_updated_idx
  on public.gi_agent_live (updated_at desc);

create index if not exists gi_agent_live_online_updated_idx
  on public.gi_agent_live (online, updated_at desc);

alter table public.gi_agent_live enable row level security;

drop policy if exists gi_agent_live_read on public.gi_agent_live;
create policy gi_agent_live_read
  on public.gi_agent_live for select
  using (true);

drop policy if exists gi_agent_live_upsert on public.gi_agent_live;
create policy gi_agent_live_upsert
  on public.gi_agent_live for insert
  with check (true);

drop policy if exists gi_agent_live_update on public.gi_agent_live;
create policy gi_agent_live_update
  on public.gi_agent_live for update
  using (true)
  with check (true);

grant select, insert, update on public.gi_agent_live to anon, authenticated;

do $pub$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gi_agent_live'
  ) then
    execute 'alter publication supabase_realtime add table public.gi_agent_live';
  end if;
end
$pub$;
