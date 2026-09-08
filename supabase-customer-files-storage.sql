-- =============================================================================
-- GEMEL INVEST · storage.buckets gi-customer-files
-- בייטים של קבצים שהועלו לתיק לקוח (הר הביטוח, העתק פוליסה אלמנטרית).
-- המטא-דאטה נשארת ב-customers.payload; התצוגה/ההורדה מושכות רק את הקובץ שנבחר.
-- אין מיגרציה גורפת של כל התיקים — פינוי הבייטים קורה בשמירה/פתיחה של תיק בודד.
--
-- הכניסה למערכת אינה עוברת דרך Supabase Auth (אימות מול טבלת agents),
-- ולכן המדיניות זהה לשאר הטבלאות: פתוחה ל-anon + authenticated ברמת ה-DB,
-- וההפרדה בין נציגים נאכפת בקוד.
-- הורץ ב-Supabase אחרי מיזוג. הקובץ נשמר לתיעוד ולשחזור.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('gi-customer-files', 'gi-customer-files', false, 20971520)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "gi_customer_files_all" on storage.objects;
create policy "gi_customer_files_all"
  on storage.objects
  for all
  to anon, authenticated
  using (bucket_id = 'gi-customer-files')
  with check (bucket_id = 'gi-customer-files');
