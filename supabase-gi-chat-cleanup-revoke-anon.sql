-- =============================================================================
-- GEMEL INVEST · ממצא 4 בדוח Onyx (24.11.2026)
-- סוגר הרצה אנונימית של public.gi_chat_cleanup.
--
-- לא מחליף את גוף הפונקציה, לא משנה את מסלול הצ'אט במחשב או בטלפון,
-- לא נוגע ב-RLS, לא נוגע בכניסה.
-- נציג עם סשן (authenticated) ממשיך להפעיל את הניקוי כמו היום.
-- service_role מקבל הרשאה מפורשת כי הרשאת PUBLIC יורדת.
--
-- הבלוק אטומי: אם בדיקה נכשלת, שום הרשאה לא נשארת שינוי.
-- הרצה שנייה בטוחה.
--
-- הצלחה: בשורת התוצאה יש authenticated ו-service_role,
-- ואין anon= ואין הרשאת PUBLIC (רשומה שמתחילה ב-=X).
--
-- שחזור, רק אם ניקוי הצ'אט נשבר לנציג מחובר. מריצים לבד, לא עם הקובץ הזה.
-- החתימה היא העמודה args בשורת התוצאה. לפונקציה בלי ארגומנטים:
--   grant execute on function public.gi_chat_cleanup() to public, anon;
-- =============================================================================

do $$
declare
  fn_count int;
  fn regprocedure;
  fn_oid oid;
  fn_acl aclitem[];
begin
  select count(*) into fn_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'gi_chat_cleanup';

  if fn_count <> 1 then
    raise exception 'expected exactly one public.gi_chat_cleanup, found %', fn_count;
  end if;

  select p.oid::regprocedure, p.oid
    into fn, fn_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'gi_chat_cleanup';

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'role authenticated is missing';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    raise exception 'role anon is missing';
  end if;
  if not has_function_privilege('authenticated', fn_oid, 'EXECUTE') then
    raise exception 'authenticated cannot execute %, aborting before revoke', fn;
  end if;

  execute format('grant execute on function %s to authenticated', fn);
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute format('grant execute on function %s to service_role', fn);
  end if;

  execute format('revoke execute on function %s from public', fn);
  execute format('revoke execute on function %s from anon', fn);

  select p.proacl into fn_acl
  from pg_proc p
  where p.oid = fn_oid;

  if fn_acl is null then
    raise exception 'privilege list is still the default public execute on %', fn;
  end if;
  if exists (
    select 1
    from aclexplode(fn_acl) a
    where a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC still has EXECUTE on %', fn;
  end if;
  if has_function_privilege('anon', fn_oid, 'EXECUTE') then
    raise exception 'anon still has EXECUTE on %', fn;
  end if;
  if not has_function_privilege('authenticated', fn_oid, 'EXECUTE') then
    raise exception 'authenticated lost EXECUTE on %', fn;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role')
     and not has_function_privilege('service_role', fn_oid, 'EXECUTE') then
    raise exception 'service_role has no EXECUTE on %', fn;
  end if;

  raise notice 'closed anonymous execute on %', fn;
end $$;

select p.proname,
       p.prosecdef,
       pg_get_function_identity_arguments(p.oid) as args,
       array_to_string(p.proacl, ', ') as proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'gi_chat_cleanup';
