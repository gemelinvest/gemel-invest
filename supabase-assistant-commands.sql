-- =============================================================================
-- GEMEL INVEST · Assistant phone↔desktop commands (P13)
-- טבלה חדשה בלבד. אין שינוי ל-customers / proposals / agents.
-- =============================================================================

create table if not exists public.gi_assistant_commands (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  session_id uuid,
  command jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  executed_at timestamptz,
  error text
);

create index if not exists gi_asst_commands_agent_idx
  on public.gi_assistant_commands (agent_id, status, created_at desc);

alter table public.gi_assistant_pairing_tokens
  add column if not exists desktop_claimed_at timestamptz;

alter table public.gi_assistant_commands enable row level security;
revoke all on public.gi_assistant_commands from public, anon, authenticated;
grant all on public.gi_assistant_commands to service_role;

notify pgrst, 'reload schema';
