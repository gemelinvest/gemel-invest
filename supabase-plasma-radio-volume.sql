-- GEMEL INVEST · plasma wall volume, and a station stamp that changes
-- only when an ops agent picks a station. A volume change must not move
-- the station. The wall opens on hits and follows a newer stamp.

alter table public.gi_plasma_radio
  add column if not exists volume integer not null default 35;

alter table public.gi_plasma_radio
  add column if not exists station_updated_at timestamptz not null default now();

alter table public.gi_plasma_radio
  alter column station_id set default 'hits';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gi_plasma_radio_volume_range'
  ) then
    alter table public.gi_plasma_radio
      add constraint gi_plasma_radio_volume_range check (volume >= 0 and volume <= 100);
  end if;
end $$;

update public.gi_plasma_radio
set station_id = 'hits'
where id = 'wall';

notify pgrst, 'reload schema';
