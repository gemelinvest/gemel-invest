-- =============================================================================
-- GEMEL INVEST · Assistant device pairing (P4)
-- הרצה ב-Supabase SQL Editor פעם אחת לפני פריסת gi-assistant-pairing.
-- טבלאות חדשות בלבד — אין שינוי לטבלאות קיימות.
-- הגישה רק דרך Edge Function (service_role). אין מדיניות ל-anon/authenticated.
-- =============================================================================

create table if not exists public.gi_assistant_pairing_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  desktop_secret_hash text not null unique,
  agent_id text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists gi_asst_pair_agent_idx
  on public.gi_assistant_pairing_tokens (agent_id, created_at desc);

create table if not exists public.gi_assistant_devices (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  device_public_id text not null unique,
  device_secret_hash text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists gi_asst_devices_agent_idx
  on public.gi_assistant_devices (agent_id, revoked_at, last_seen_at desc);

create table if not exists public.gi_assistant_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  session_id text,
  action text not null,
  tool text,
  customer_id text,
  arguments_safe jsonb not null default '{}'::jsonb,
  authorization_result text,
  confirmation_required boolean,
  confirmation_result text,
  execution_status text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists gi_asst_audit_user_idx
  on public.gi_assistant_audit_log (user_id, created_at desc);

alter table public.gi_assistant_pairing_tokens enable row level security;
alter table public.gi_assistant_devices enable row level security;
alter table public.gi_assistant_audit_log enable row level security;

revoke all on public.gi_assistant_pairing_tokens from public, anon, authenticated;
revoke all on public.gi_assistant_devices from public, anon, authenticated;
revoke all on public.gi_assistant_audit_log from public, anon, authenticated;

grant all on public.gi_assistant_pairing_tokens to service_role;
grant all on public.gi_assistant_devices to service_role;
grant all on public.gi_assistant_audit_log to service_role;

notify pgrst, 'reload schema';
