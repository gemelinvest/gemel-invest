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
grant select, insert, update, delete on table public.gi_app_secrets to service_role;

-- The Outlook app id already lives on the sales mailbox row. The browser
-- stays blocked. Only the server role may read it, and the collection
-- function never returns the app secret or the sales refresh token.
do $$
begin
  if to_regclass('public.gi_daily_sales_mail_account') is not null then
    execute 'grant select on table public.gi_daily_sales_mail_account to service_role';
  end if;
end $$;

notify pgrst, 'reload schema';
