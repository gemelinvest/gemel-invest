-- =============================================================================
-- GEMEL INVEST · collection mailbox secrets stay off the client
--
-- gi_app_secrets already holds server-only values. This file makes sure the
-- table exists and that the browser roles cannot read it. The collection
-- function writes key collection_mail (Outlook refresh token for
-- gviyaas@i-s-f.co.il) and collection_mail_holds. Do not select those keys
-- from the CRM.
--
-- Run once in the Supabase SQL editor if the table is missing.
-- Running it again does not copy, print, or change a token.
-- =============================================================================

create table if not exists public.gi_app_secrets (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.gi_app_secrets enable row level security;
revoke all on table public.gi_app_secrets from public, anon, authenticated;

notify pgrst, 'reload schema';
