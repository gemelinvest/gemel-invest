-- =============================================================================
-- GEMEL INVEST · Assistant voice sessions (P6)
-- הרצה ב-SQL Editor אחרי supabase-assistant-pairing.sql, לפני פריסת
-- gi-assistant-realtime. טבלה חדשה בלבד — אין שינוי לטבלאות קיימות.
-- =============================================================================

create table if not exists public.gi_assistant_sessions (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  device_id text,
  source text not null default 'desktop',
  model text not null default '',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz
);

create index if not exists gi_asst_sessions_agent_idx
  on public.gi_assistant_sessions (agent_id, started_at desc);

alter table public.gi_assistant_sessions enable row level security;

revoke all on public.gi_assistant_sessions from public, anon, authenticated;
grant all on public.gi_assistant_sessions to service_role;

notify pgrst, 'reload schema';
