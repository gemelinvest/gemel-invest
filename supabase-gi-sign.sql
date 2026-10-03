-- =============================================================================
-- GEMEL INVEST · החתמת טופס ביטול
-- הרצה ב-Supabase SQL Editor פעם אחת לפני פריסת gi-sign.
-- טבלאות חדשות בלבד. אין שינוי לטבלאות לקוחות או למסמכים.
-- הגישה רק דרך Edge Function (service_role). אין מדיניות ל-anon/authenticated.
-- =============================================================================

create table if not exists public.gi_sign_packets (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null,
  doc_id text not null,
  doc_name text not null default '',
  customer_name text not null default '',
  sender_id text not null default '',
  sender_name text not null default '',
  pdf_base64 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gi_sign_packets_customer_idx
  on public.gi_sign_packets (customer_id, doc_id, created_at desc);

create table if not exists public.gi_sign_links (
  token text primary key,
  packet_id uuid not null references public.gi_sign_packets(id) on delete cascade,
  slot text not null,
  signer_name text not null default '',
  signer_id text not null default '',
  box jsonb not null,
  status text not null default 'pending',
  signed_at timestamptz
);

create index if not exists gi_sign_links_packet_idx
  on public.gi_sign_links (packet_id);

alter table public.gi_sign_packets enable row level security;
alter table public.gi_sign_links enable row level security;

revoke all on table public.gi_sign_packets from public, anon, authenticated;
revoke all on table public.gi_sign_links from public, anon, authenticated;
grant all on table public.gi_sign_packets to service_role;
grant all on table public.gi_sign_links to service_role;

alter table public.gi_sign_links
  add column if not exists signer_id text not null default '';

alter table public.gi_sign_packets
  add column if not exists holder_token text not null default '';

alter table public.gi_sign_packets
  add column if not exists holder_name text not null default '';

alter table public.gi_sign_packets
  add column if not exists holder_until timestamptz;

alter table public.gi_sign_links
  add column if not exists opened_at timestamptz;

alter table public.gi_sign_links
  add column if not exists step_n integer not null default 0;

alter table public.gi_sign_links
  add column if not exists step_total integer not null default 0;

alter table public.gi_sign_links
  add column if not exists progress_at timestamptz;

alter table public.gi_sign_packets
  add column if not exists expires_at timestamptz;

alter table public.gi_sign_links
  add column if not exists open_href text not null default '';

alter table public.gi_sign_links
  add column if not exists og_png text not null default '';
