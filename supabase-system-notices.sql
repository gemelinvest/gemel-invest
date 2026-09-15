-- GEMEL INVEST · System notices (הודעת מערכת)
-- Additive only. Does not alter customers / proposals / agents / reminders.
-- Apply once in Supabase SQL Editor (or via migration).

create table if not exists public.gi_system_notices (
  id text primary key,
  body text not null,
  author_id text not null default '',
  author_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists gi_system_notices_created_idx
  on public.gi_system_notices (created_at desc);

alter table public.gi_system_notices enable row level security;

drop policy if exists gi_system_notices_read on public.gi_system_notices;
create policy gi_system_notices_read
  on public.gi_system_notices for select
  using (true);

drop policy if exists gi_system_notices_insert on public.gi_system_notices;
create policy gi_system_notices_insert
  on public.gi_system_notices for insert
  with check (true);

grant select, insert on public.gi_system_notices to anon, authenticated;

do $pub$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gi_system_notices'
  ) then
    execute 'alter publication supabase_realtime add table public.gi_system_notices';
  end if;
end
$pub$;
