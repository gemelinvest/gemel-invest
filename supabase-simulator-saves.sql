-- =============================================================================
-- GEMEL INVEST · public.gi_simulator_saves
-- שמירת חישובי פרמיה ממרכז הסימולטורים ("לקוחות סימולטורים שנשמרו").
-- הורץ ב-Supabase בתאריך 2026-08-12. הקובץ נשמר לתיעוד ולשחזור.
-- =============================================================================
-- הערת הרשאות:
-- הכניסה למערכת אינה עוברת דרך Supabase Auth (אימות ברמת האפליקציה מול טבלת
-- agents), ולכן רוב הפניות מגיעות עם מפתח anon. המדיניות כאן זהה לזו של שאר
-- הטבלאות במערכת (customers / proposals / reminders): פתוחה ברמת ה-DB, וההפרדה
-- בין נציגים נאכפת בקוד — נציג רואה רק את השמירות שלו, מנהל מערכת רואה הכל.
-- =============================================================================

create table if not exists public.gi_simulator_saves (
  id text primary key,
  agent_id text,
  agent_name text,
  client_name text not null,
  client_key text not null,
  company text not null default '',
  product text not null default '',
  total_monthly numeric(12,2) not null default 0,
  insureds_count integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gi_simulator_saves_agent_created_idx
  on public.gi_simulator_saves (agent_id, created_at desc);

create index if not exists gi_simulator_saves_client_key_idx
  on public.gi_simulator_saves (client_key);

alter table public.gi_simulator_saves enable row level security;

drop policy if exists "gi_simsaves_all" on public.gi_simulator_saves;
create policy "gi_simsaves_all"
  on public.gi_simulator_saves
  for all
  to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.gi_simulator_saves to anon, authenticated;

notify pgrst, 'reload schema';
