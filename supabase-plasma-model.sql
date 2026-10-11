-- GEMEL INVEST · the photo on the ops plasma "model of the day" card.
-- The television, already signed in, reads one row.
-- A phone that scanned the current code publishes through the function.
-- The code changes after a successful photo, and a photo stays for 10 minutes.

create table if not exists public.gi_plasma_model (
  id text primary key,
  image text not null default '',
  caption text not null default '',
  approved_at timestamptz,
  upload_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.gi_plasma_model enable row level security;

revoke all on public.gi_plasma_model from public, anon;
grant select on public.gi_plasma_model to authenticated;

drop policy if exists gi_plasma_model_read on public.gi_plasma_model;
create policy gi_plasma_model_read
  on public.gi_plasma_model for select
  to authenticated
  using (true);

insert into public.gi_plasma_model (id, upload_token)
values ('wall', encode(extensions.gen_random_bytes(16), 'hex'))
on conflict (id) do nothing;

create or replace function public.gi_publish_plasma_model(p_token text, p_image text, p_caption text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  slot public.gi_plasma_model%rowtype;
  img text := coalesce(p_image, '');
  cap text := btrim(regexp_replace(coalesce(p_caption, ''), '[[:cntrl:]]', '', 'g'));
begin
  if length(img) > 900000 then
    return jsonb_build_object('ok', false, 'error', 'TOO_BIG');
  end if;
  if img !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' then
    return jsonb_build_object('ok', false, 'error', 'BAD_IMAGE');
  end if;
  if length(cap) > 80 then
    cap := left(cap, 80);
  end if;
  select * into slot from public.gi_plasma_model where id = 'wall' for update;
  if not found or slot.upload_token is distinct from btrim(coalesce(p_token, '')) or length(btrim(coalesce(p_token, ''))) < 16 then
    return jsonb_build_object('ok', false, 'error', 'BAD_TOKEN');
  end if;
  if slot.approved_at is not null and slot.image <> '' and slot.approved_at > now() - interval '10 minutes' then
    return jsonb_build_object('ok', false, 'error', 'BUSY');
  end if;
  update public.gi_plasma_model
    set image = img,
        caption = cap,
        approved_at = now(),
        upload_token = encode(extensions.gen_random_bytes(16), 'hex'),
        updated_at = now()
    where id = 'wall';
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.gi_publish_plasma_model(text, text, text) from public;
grant execute on function public.gi_publish_plasma_model(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
