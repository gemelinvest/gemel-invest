-- GEMEL INVEST · the station playing on the ops plasma wall.
-- One row. Ops manager and ops agents change it from the top bar.
-- The plasma screen follows that row.

create table if not exists public.gi_plasma_radio (
  id text primary key,
  station_id text not null default 'glglz',
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

alter table public.gi_plasma_radio enable row level security;

create or replace function public.gi_can_set_plasma_radio()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(
    nullif(trim(auth.jwt() -> 'app_metadata' ->> 'role'), ''),
    (select lower(coalesce(a.role, '')) from public.agents a where a.auth_user_id = auth.uid() limit 1),
    ''
  )) in ('ops', 'opsagent');
$$;

revoke all on function public.gi_can_set_plasma_radio() from public;
grant execute on function public.gi_can_set_plasma_radio() to authenticated;

drop policy if exists gi_plasma_radio_read on public.gi_plasma_radio;
create policy gi_plasma_radio_read
  on public.gi_plasma_radio for select
  to authenticated
  using (true);

drop policy if exists gi_plasma_radio_insert on public.gi_plasma_radio;
create policy gi_plasma_radio_insert
  on public.gi_plasma_radio for insert
  to authenticated
  with check (public.gi_can_set_plasma_radio());

drop policy if exists gi_plasma_radio_update on public.gi_plasma_radio;
create policy gi_plasma_radio_update
  on public.gi_plasma_radio for update
  to authenticated
  using (public.gi_can_set_plasma_radio())
  with check (public.gi_can_set_plasma_radio());

grant select, insert, update on public.gi_plasma_radio to authenticated;

insert into public.gi_plasma_radio (id, station_id)
values ('wall', 'glglz')
on conflict (id) do nothing;

do $pub$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gi_plasma_radio'
  ) then
    execute 'alter publication supabase_realtime add table public.gi_plasma_radio';
  end if;
end
$pub$;

notify pgrst, 'reload schema';
