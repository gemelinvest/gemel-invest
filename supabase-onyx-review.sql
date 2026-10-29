-- Customer review links for the phone app.
-- Apply in Supabase before the short customer link can be saved or opened.
-- The table holds the id number and the preview image. Anon cannot read it.
-- The customer page calls onyx_review_open, which returns only the name, stage, and prices.
-- The live short host only redirects codes stored as sign cards, so each review code is mirrored there.
-- Re-run this file once to open links that were copied before the mirror existed.

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
grant select, insert, update, delete on table public.onyx_review_links to authenticated;
grant select, insert, update, delete on table public.onyx_review_links to service_role;

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

-- The live short host reads gi_sign_links and redirects a person to open_href.
-- Review codes are mirrored there so an existing link opens the customer page.
-- The id number and the prices stay on onyx_review_links. A real sign link is never overwritten.

insert into public.gi_sign_packets (
  id, customer_id, doc_id, doc_name, customer_name, sender_id, sender_name, pdf_base64
) values (
  'a0e00000-0000-4000-8000-0000000000e1',
  'onyx-review',
  'onyx-review',
  '',
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

create or replace function public.onyx_review_mirror_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  href text;
begin
  if new.code is null or btrim(new.code) !~ '^r[A-Za-z0-9]{5,12}$' then
    return new;
  end if;
  href := 'https://gemelinvest.github.io/gemel-invest/phone/review.html?c=' || new.code;
  begin
    insert into public.gi_sign_links (
      token, packet_id, slot, signer_name, signer_id, box, status, open_href, og_png
    ) values (
      new.code,
      'a0e00000-0000-4000-8000-0000000000e1',
      'review',
      coalesce(new.customer_name, ''),
      '',
      '{}'::jsonb,
      'pending',
      href,
      coalesce(new.og_jpeg, '')
    )
    on conflict (token) do update
      set open_href = excluded.open_href,
          signer_name = excluded.signer_name,
          og_png = case
            when excluded.og_png <> '' then excluded.og_png
            else public.gi_sign_links.og_png
          end
      where public.gi_sign_links.slot = 'review';
  exception
    when others then
      raise warning 'onyx_review_mirror_card %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.onyx_review_mirror_card() from public, anon, authenticated;

drop trigger if exists onyx_review_mirror_card on public.onyx_review_links;
create trigger onyx_review_mirror_card
  after insert or update of customer_name, og_jpeg, open_href, code
  on public.onyx_review_links
  for each row
  execute function public.onyx_review_mirror_card();

insert into public.gi_sign_links (
  token, packet_id, slot, signer_name, signer_id, box, status, open_href, og_png
)
select
  code,
  'a0e00000-0000-4000-8000-0000000000e1',
  'review',
  coalesce(customer_name, ''),
  '',
  '{}'::jsonb,
  'pending',
  'https://gemelinvest.github.io/gemel-invest/phone/review.html?c=' || code,
  coalesce(og_jpeg, '')
from public.onyx_review_links
where code ~ '^r[A-Za-z0-9]{5,12}$'
on conflict (token) do update
  set open_href = excluded.open_href,
      signer_name = excluded.signer_name,
      og_png = case
        when excluded.og_png <> '' then excluded.og_png
        else public.gi_sign_links.og_png
      end
  where public.gi_sign_links.slot = 'review';
