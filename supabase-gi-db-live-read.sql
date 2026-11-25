-- =============================================================================
-- GEMEL INVEST · מה רץ על המסד ברגע זה
-- קריאה בלבד. אין כאן שינוי טבלה, הרשאה, פונקציה או שורת לקוח.
-- אין כאן קריאה לתוכן תיק, לדוח או לליד. רק רשימת החיבורים שכבר פתוחים.
--
-- מריצים את כל הקובץ ב-SQL Editor ומדביקים את הטבלה האחרונה.
-- הטבלה הזמנית נעלמת עם סיום החיבור.
-- =============================================================================

set statement_timeout = '5s';
set lock_timeout = '2s';

create temporary table gi_live_check_tmp (
  sort_key integer not null,
  report text not null,
  detail text not null
);

insert into gi_live_check_tmp(sort_key, report, detail)
select 10,
       'database',
       'backends ' || d.numbackends::text
       || ' | size ' || pg_size_pretty(pg_database_size(d.datname))
       || ' | temp ' || pg_size_pretty(d.temp_bytes)
       || ' | deadlocks ' || d.deadlocks::text
from pg_stat_database d
where d.datname = current_database();

insert into gi_live_check_tmp(sort_key, report, detail)
select 20,
       'sessions',
       coalesce(a.usename, 'none') || ' | ' || coalesce(a.state, 'none') || ' | ' || count(*)::text
from pg_stat_activity a
where a.datname = current_database()
group by a.usename, a.state;

insert into gi_live_check_tmp(sort_key, report, detail)
with live as (
  select a.query_start,
         a.query,
         case
           when a.query ilike '%gi_dashboard_net_premium%' then 'dashboard_net'
           when a.query ilike '%gi_dashboard_sales_by_company%' then 'dashboard_company'
           when a.query ilike '%gi_dashboard_sales_by_product%' then 'dashboard_product'
           when a.query ilike '%gi_daily_sales_by_agent%' then 'dashboard_agents'
           when a.query ilike '%gi_dashboard_agent_appointment%' then 'dashboard_appointment'
           when a.query ilike '%campaign_leads%' and a.query ilike '%ilike%' then 'lead_description'
           when a.query ilike '%campaign_leads%' then 'lead_read'
           when a.query ilike '%gi_daily_report%' then 'daily_report'
           when a.query ilike '%gi_cancellations_report%' then 'cancel_report'
           when a.query ilike '%customers%' then 'customer_read'
           else 'other'
         end as kind
  from pg_stat_activity a
  where a.datname = current_database()
    and a.pid <> pg_backend_pid()
    and coalesce(a.state, '') <> 'idle'
)
select 30,
       'running',
       kind || ' | n ' || count(*)::text
       || ' | longest_s ' || coalesce(round(max(extract(epoch from (clock_timestamp() - query_start)))::numeric, 1)::text, '0')
from live
group by kind;

insert into gi_live_check_tmp(sort_key, report, detail)
select 31, 'running', 'none'
where not exists (select 1 from gi_live_check_tmp where report = 'running');

insert into gi_live_check_tmp(sort_key, report, detail)
select 40,
       'query',
       round(extract(epoch from (clock_timestamp() - a.query_start))::numeric, 1)::text
       || 's | ' || coalesce(a.state, 'none')
       || ' | ' || left(regexp_replace(coalesce(a.query, ''), '''(?:''''|[^''])*''', '?', 'g'), 180)
from pg_stat_activity a
where a.datname = current_database()
  and a.pid <> pg_backend_pid()
  and coalesce(a.state, '') <> 'idle'
order by a.query_start nulls last
limit 25;

do $$
declare
  rel regclass;
begin
  rel := to_regclass('pg_stat_statements');
  if rel is null then
    rel := to_regclass('extensions.pg_stat_statements');
  end if;
  if rel is null then
    insert into gi_live_check_tmp(sort_key, report, detail)
    values (50, 'recorded', 'extension_missing');
    return;
  end if;
  execute format($q$
    insert into gi_live_check_tmp(sort_key, report, detail)
    select 50,
           'recorded',
           calls::text || ' calls | total_ms ' || round(total_exec_time::numeric, 1)::text
           || ' | mean_ms ' || round(mean_exec_time::numeric, 1)::text
           || ' | ' || left(regexp_replace(coalesce(query, ''), '''(?:''''|[^''])*''', '?', 'g'), 140)
    from %s
    where query ilike '%%gi_dashboard_net_premium%%'
       or query ilike '%%gi_dashboard_sales_by_company%%'
       or query ilike '%%gi_dashboard_sales_by_product%%'
       or query ilike '%%gi_daily_sales_by_agent%%'
       or query ilike '%%gi_dashboard_agent_appointment%%'
       or (query ilike '%%campaign_leads%%' and query ilike '%%ilike%%')
       or query ilike '%%gi_daily_report%%'
    order by total_exec_time desc
    limit 15
  $q$, rel::text);
  if not exists (select 1 from gi_live_check_tmp where report = 'recorded') then
    insert into gi_live_check_tmp(sort_key, report, detail)
    values (50, 'recorded', 'none');
  end if;
end $$;

select report, detail
from gi_live_check_tmp
order by sort_key, report, detail;
