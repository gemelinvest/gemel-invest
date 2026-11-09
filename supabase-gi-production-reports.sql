-- GEMEL INVEST · Production report archive
-- Additive only. Does not alter customers / proposals / agents.
-- Apply once in Supabase SQL Editor.

create table if not exists public.gi_production_reports (
  id text primary key,
  company text not null,
  imported_at timestamptz not null default now(),
  imported_by text not null default '',
  file_names jsonb not null default '[]'::jsonb,
  policy_count integer not null default 0,
  customer_count integer not null default 0
);

create index if not exists gi_production_reports_company_idx
  on public.gi_production_reports (company, imported_at desc);

create table if not exists public.gi_production_report_rows (
  report_id text not null references public.gi_production_reports (id) on delete cascade,
  customer_id text not null,
  policies jsonb not null default '[]'::jsonb,
  primary key (report_id, customer_id)
);

alter table public.gi_production_reports enable row level security;
alter table public.gi_production_report_rows enable row level security;

drop policy if exists gi_production_reports_read on public.gi_production_reports;
create policy gi_production_reports_read
  on public.gi_production_reports for select
  using (true);

drop policy if exists gi_production_reports_insert on public.gi_production_reports;
create policy gi_production_reports_insert
  on public.gi_production_reports for insert
  with check (true);

drop policy if exists gi_production_report_rows_read on public.gi_production_report_rows;
create policy gi_production_report_rows_read
  on public.gi_production_report_rows for select
  using (true);

drop policy if exists gi_production_report_rows_insert on public.gi_production_report_rows;
create policy gi_production_report_rows_insert
  on public.gi_production_report_rows for insert
  with check (true);

grant select, insert on public.gi_production_reports to anon, authenticated;
grant select, insert on public.gi_production_report_rows to anon, authenticated;
