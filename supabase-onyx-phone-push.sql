-- ONYX phone lock-screen alerts.
-- Apply once in the Supabase SQL editor. Safe to run again.
-- The phone stores nothing here itself; the edge function onyx-phone-push
-- writes with the service role. Clients cannot read the VAPID private key.

create table if not exists public.onyx_phone_vapid (
  id integer primary key,
  public_key text not null,
  private_key text not null,
  created_at timestamptz not null default now()
);
alter table public.onyx_phone_vapid enable row level security;
revoke all on table public.onyx_phone_vapid from anon, authenticated;
grant all on table public.onyx_phone_vapid to service_role;

create table if not exists public.onyx_phone_push (
  endpoint text primary key,
  agent_id text not null,
  agent_name text not null,
  role text not null,
  p256dh text not null,
  auth text not null,
  updated_at timestamptz not null default now()
);
alter table public.onyx_phone_push enable row level security;
revoke all on table public.onyx_phone_push from anon, authenticated;
grant all on table public.onyx_phone_push to service_role;
create index if not exists onyx_phone_push_agent_idx on public.onyx_phone_push (agent_name);

create table if not exists public.onyx_phone_push_sent (
  id text primary key,
  sent_at timestamptz not null default now()
);
alter table public.onyx_phone_push_sent enable row level security;
revoke all on table public.onyx_phone_push_sent from anon, authenticated;
grant all on table public.onyx_phone_push_sent to service_role;

notify pgrst, 'reload schema';

-- A one-minute clock when pg_cron and pg_net are already installed.
-- If they are not, the GitHub workflow still calls the function every few minutes.
do $cron$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron')
     and exists (select 1 from pg_namespace where nspname = 'net') then
    begin
      perform cron.unschedule('onyx-phone-push');
    exception when others then
      null;
    end;
    perform cron.schedule(
      'onyx-phone-push',
      '* * * * *',
      $job$
      select net.http_post(
        url := 'https://vhvlkerectggovfihjgm.supabase.co/functions/v1/onyx-phone-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb',
          'x-onyx-push', 'dispatch'
        ),
        body := '{"action":"dispatch"}'::jsonb
      );
      $job$
    );
  end if;
exception when others then
  raise notice 'onyx phone push clock skipped: %', sqlerrm;
end
$cron$;
