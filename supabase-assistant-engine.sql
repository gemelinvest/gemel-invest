-- =============================================================================
-- GEMEL INVEST · Assistant engine (P7)
-- הרצה ב-SQL Editor אחרי supabase-assistant-sessions.sql, לפני פריסת
-- gi-assistant-engine. טבלאות חדשות בלבד — אין שינוי לטבלאות קיימות.
-- =============================================================================

create table if not exists public.gi_assistant_context (
  session_id uuid primary key,
  agent_id text not null,
  customer_id text,
  last_intent text not null default '',
  pending_action_id uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.gi_assistant_pending_actions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  agent_id text not null,
  tool text not null,
  label text not null default '',
  arguments_safe jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists gi_asst_pending_session_idx
  on public.gi_assistant_pending_actions (session_id, status, created_at desc);

create table if not exists public.gi_assistant_timeline (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  agent_id text not null,
  kind text not null,
  text_safe text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists gi_asst_timeline_session_idx
  on public.gi_assistant_timeline (session_id, created_at desc);

alter table public.gi_assistant_context enable row level security;
alter table public.gi_assistant_pending_actions enable row level security;
alter table public.gi_assistant_timeline enable row level security;

revoke all on public.gi_assistant_context from public, anon, authenticated;
revoke all on public.gi_assistant_pending_actions from public, anon, authenticated;
revoke all on public.gi_assistant_timeline from public, anon, authenticated;

grant all on public.gi_assistant_context to service_role;
grant all on public.gi_assistant_pending_actions to service_role;
grant all on public.gi_assistant_timeline to service_role;

notify pgrst, 'reload schema';
