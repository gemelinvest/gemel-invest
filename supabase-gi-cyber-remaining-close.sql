-- =============================================================================
-- GEMEL INVEST · close two public-key openings the screen does not need.
-- The write-rate report becomes manager-only. The production archive
-- becomes signed-in only. Login stays. No archive row changes.
-- A missing piece is reported and skipped.
--
-- Run this file once. Then run supabase-gi-cyber-support-session.sql.
-- If the editor warns about a temporary table, choose Run without RLS.
--
-- Undo, only if a later check asks for it:
--   grant execute on function public.gi_write_meter_report() to anon, authenticated;
--   grant select, insert on public.gi_production_reports to anon, authenticated;
--   grant select, insert on public.gi_production_report_rows to anon, authenticated;
-- =============================================================================

drop table if exists gi_cyber_remaining_hold;
create temporary table gi_cyber_remaining_hold (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $body$
declare
  v_before bigint; v_after bigint; v_rows_before bigint; v_rows_after bigint; v_anon boolean;
begin
  if to_regprocedure('public.gi_write_meter_report()') is null then
    insert into gi_cyber_remaining_hold(sort_key, section, detail) values (10, 'write_meter', 'not_installed');
  else
    execute $fn$
      create or replace function public.gi_write_meter_report()
      returns table (event_type text, ip text, agent_id text, agent_name text, peak_per_minute int, total_events int, first_seen timestamptz, last_seen timestamptz)
      language plpgsql security definer set search_path = public as $func$
      begin
        if auth.uid() is null or coalesce(public.gi_jwt_is_manager(), false) is not true then return; end if;
        return query
        select m.event_type, m.ip, m.agent_id, m.agent_name,
               max(m.count)::int, sum(m.count)::int, min(m.bucket), max(m.bucket)
        from public.gi_write_meter m
        group by m.event_type, m.ip, m.agent_id, m.agent_name
        order by 5 desc;
      end; $func$
    $fn$;
    execute 'revoke all on function public.gi_write_meter_report() from public, anon';
    execute 'grant execute on function public.gi_write_meter_report() to authenticated';
    select has_function_privilege('anon', 'public.gi_write_meter_report()', 'execute') into v_anon;
    if v_anon then raise exception 'anon can still read the write-rate report'; end if;
    insert into gi_cyber_remaining_hold(sort_key, section, detail) values
      (10, 'write_meter', 'manager_only'), (11, 'write_meter_anon', 'no');
  end if;

  if to_regclass('public.gi_production_reports') is null or to_regclass('public.gi_production_report_rows') is null then
    insert into gi_cyber_remaining_hold(sort_key, section, detail) values
      (20, 'production_archive', 'not_installed'), (21, 'production_rows_changed', 'no');
  else
    select count(*) into v_before from public.gi_production_reports;
    select count(*) into v_rows_before from public.gi_production_report_rows;
    execute 'drop policy if exists gi_production_reports_read on public.gi_production_reports';
    execute 'drop policy if exists gi_production_reports_insert on public.gi_production_reports';
    execute 'drop policy if exists gi_production_report_rows_read on public.gi_production_report_rows';
    execute 'drop policy if exists gi_production_report_rows_insert on public.gi_production_report_rows';
    execute 'create policy gi_production_reports_read on public.gi_production_reports for select to authenticated using (true)';
    execute 'create policy gi_production_reports_insert on public.gi_production_reports for insert to authenticated with check (true)';
    execute 'create policy gi_production_report_rows_read on public.gi_production_report_rows for select to authenticated using (true)';
    execute 'create policy gi_production_report_rows_insert on public.gi_production_report_rows for insert to authenticated with check (true)';
    execute 'revoke all on table public.gi_production_reports from anon';
    execute 'revoke all on table public.gi_production_report_rows from anon';
    execute 'grant select, insert on table public.gi_production_reports to authenticated';
    execute 'grant select, insert on table public.gi_production_report_rows to authenticated';
    select count(*) into v_after from public.gi_production_reports;
    select count(*) into v_rows_after from public.gi_production_report_rows;
    if v_after <> v_before or v_rows_after <> v_rows_before then raise exception 'production archive rows changed'; end if;
    select has_table_privilege('anon', 'public.gi_production_reports', 'select')
        or has_table_privilege('anon', 'public.gi_production_report_rows', 'select') into v_anon;
    if v_anon then raise exception 'anon can still read the production archive'; end if;
    insert into gi_cyber_remaining_hold(sort_key, section, detail) values
      (20, 'production_archive', 'signed_in'), (21, 'production_rows_changed', 'no'), (22, 'production_anon', 'no');
  end if;

  insert into gi_cyber_remaining_hold(sort_key, section, detail) values (40, 'answer', 'archive_closed');
end
$body$;

select section, detail from gi_cyber_remaining_hold order by sort_key;
