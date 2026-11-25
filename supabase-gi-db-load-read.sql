-- =============================================================================
-- GEMEL INVEST · למה המסד עמוס
-- קריאה בלבד. אין כאן שינוי טבלה, הרשאה, פונקציה או שורת לקוח.
--
-- מה השאילתה קוראת:
--   חיבורים פתוחים, שאילתות שרצות עכשיו, השאילתות הכבדות שנרשמו,
--   ואורך שורת הדוח הפעילה בלי להחזיר אף תא מהדוח.
--
-- הטבלה הזמנית נעלמת עם סיום החיבור. היא לא נשמרת במסד.
-- מריצים את כל הקובץ ב-SQL Editor ומדביקים את כל התוצאות.
-- =============================================================================

set statement_timeout = '8s';
set lock_timeout = '2s';

select 'database' as report,
       d.numbackends,
       pg_size_pretty(pg_database_size(d.datname)) as database_size,
       d.blks_hit,
       d.blks_read,
       d.temp_bytes,
       d.deadlocks,
       d.conflicts
from pg_stat_database d
where d.datname = current_database();

select 'connections' as report,
       coalesce(a.usename, 'none') as usename,
       coalesce(a.state, 'none') as state,
       count(*)::bigint as sessions
from pg_stat_activity a
where a.datname = current_database()
group by a.usename, a.state
order by sessions desc, usename, state;

select 'waits' as report,
       coalesce(a.wait_event_type, 'none') as wait_event_type,
       coalesce(a.wait_event, 'none') as wait_event,
       count(*)::bigint as sessions
from pg_stat_activity a
where a.datname = current_database()
group by a.wait_event_type, a.wait_event
order by sessions desc, wait_event_type, wait_event;

select 'active_queries' as report,
       a.pid,
       coalesce(a.usename, 'none') as usename,
       coalesce(a.state, 'none') as state,
       coalesce(a.wait_event_type, 'none') as wait_event_type,
       coalesce(a.wait_event, 'none') as wait_event,
       round(extract(epoch from (clock_timestamp() - a.query_start))::numeric, 1) as seconds,
       left(regexp_replace(coalesce(a.query, ''), '''(?:''''|[^''])*''', '?', 'g'), 160) as query
from pg_stat_activity a
where a.datname = current_database()
  and a.pid <> pg_backend_pid()
  and coalesce(a.state, '') <> 'idle'
order by a.query_start nulls last
limit 30;

create temporary table gi_load_check_tmp (
  report text,
  detail text
);

do $$
declare
  rel regclass;
begin
  rel := to_regclass('pg_stat_statements');
  if rel is null then
    rel := to_regclass('extensions.pg_stat_statements');
  end if;
  if rel is null then
    insert into gi_load_check_tmp(report, detail)
    values ('top_statements', 'extension_missing');
    return;
  end if;
  execute format($q$
    insert into gi_load_check_tmp(report, detail)
    select 'top_statements',
           calls::text || ' calls | total_ms ' || round(total_exec_time::numeric, 1)::text
           || ' | mean_ms ' || round(mean_exec_time::numeric, 1)::text
           || ' | rows ' || rows::text || ' | '
           || left(regexp_replace(coalesce(query, ''), '''(?:''''|[^''])*''', '?', 'g'), 160)
    from %s
    order by total_exec_time desc
    limit 20
  $q$, rel::text);
end $$;

do $$
begin
  if to_regclass('public.gi_daily_report') is null then
    insert into gi_load_check_tmp(report, detail)
    values ('report_size', 'gi_daily_report_missing');
  elsif not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'gi_daily_report'
      and column_name = 'data_rows'
  ) then
    insert into gi_load_check_tmp(report, detail)
    values ('report_size', 'data_rows_column_missing');
  else
    execute $q$
      insert into gi_load_check_tmp(report, detail)
      select 'report_size',
             id || ' | bytes ' || coalesce(pg_column_size(data_rows), 0)::text
             || ' | rows ' || case
               when jsonb_typeof(data_rows) = 'array' then jsonb_array_length(data_rows)::text
               else 'not_array'
             end
      from public.gi_daily_report
      where id = 'active'
    $q$;
    if not exists (select 1 from gi_load_check_tmp where report = 'report_size') then
      insert into gi_load_check_tmp(report, detail)
      values ('report_size', 'active_row_missing');
    end if;
  end if;

  if to_regclass('public.gi_cancellations_report') is null then
    insert into gi_load_check_tmp(report, detail)
    values ('cancel_size', 'table_missing');
  elsif not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'gi_cancellations_report'
      and column_name = 'sheets'
  ) then
    insert into gi_load_check_tmp(report, detail)
    values ('cancel_size', 'sheets_column_missing');
  else
    execute $q$
      insert into gi_load_check_tmp(report, detail)
      select 'cancel_size',
             id || ' | bytes ' || coalesce(pg_column_size(sheets), 0)::text
      from public.gi_cancellations_report
      where id = 'active'
    $q$;
    if not exists (select 1 from gi_load_check_tmp where report = 'cancel_size') then
      insert into gi_load_check_tmp(report, detail)
      values ('cancel_size', 'active_row_missing');
    end if;
  end if;
end $$;

select report, detail
from gi_load_check_tmp
order by report, detail;
