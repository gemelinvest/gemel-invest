-- Customer review links for the phone app.
-- Apply in Supabase before the short customer link can be saved or opened.
-- The table holds the id number and the preview image. Anon cannot read it.
-- The customer page calls onyx_review_open, which returns only the name, stage, and prices.

create table if not exists public.onyx_review_links (
  code text primary key,
  lead_id text unique,
  agent_id text,
  customer_name text,
  id_number text,
  stage text not null default 'intro',
  snapshot jsonb not null default '{}'::jsonb,
  og_jpeg text,
  open_href text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.onyx_review_links enable row level security;

drop policy if exists onyx_review_links_auth on public.onyx_review_links;
create policy onyx_review_links_auth on public.onyx_review_links
  for all to authenticated
  using (true)
  with check (true);

revoke all on table public.onyx_review_links from anon, public;

create or replace function public.onyx_review_open(p_code text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.onyx_review_links%rowtype;
  given text;
  stored text;
begin
  select * into row
  from public.onyx_review_links
  where code = btrim(coalesce(p_code, ''));
  if not found then
    return jsonb_build_object('ok', false, 'error', 'MISSING');
  end if;
  stored := regexp_replace(coalesce(row.id_number, ''), '\D', '', 'g');
  given := regexp_replace(coalesce(p_id, ''), '\D', '', 'g');
  if stored = '' then
    return jsonb_build_object('ok', false, 'error', 'WAIT');
  end if;
  if given = '' or given <> stored then
    return jsonb_build_object('ok', false, 'error', 'ID');
  end if;
  return jsonb_build_object(
    'ok', true,
    'name', coalesce(row.customer_name, ''),
    'stage', coalesce(row.stage, 'intro'),
    'snapshot', coalesce(row.snapshot, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.onyx_review_open(text, text) from public;
grant execute on function public.onyx_review_open(text, text) to anon, authenticated;
