-- לינק גילוי נאות ללקוח. הנציג שומר את המסמכים שנבחרו, הלקוח פותח בלי התחברות,
-- והפתיחה נרשמת כדי שהנציג יראה אישור קריאה.
-- הטבלה לא חשופה ל-anon. רק הפונקציות.

create table if not exists public.onyx_disclosure_links (
  token text primary key,
  customer_id text not null,
  docs jsonb not null,
  opened_at timestamptz,
  opens jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.onyx_disclosure_links enable row level security;

revoke all on table public.onyx_disclosure_links from anon, public, authenticated;
grant select, insert, update, delete on table public.onyx_disclosure_links to service_role;

create or replace function public.onyx_disclosure_docs(p_docs jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  item jsonb;
  clean jsonb := '[]'::jsonb;
  n integer := 0;
  file text;
  id text;
begin
  if jsonb_typeof(p_docs) <> 'array' then
    return '[]'::jsonb;
  end if;
  for item in select value from jsonb_array_elements(p_docs)
  loop
    exit when n >= 40;
    if jsonb_typeof(item) <> 'object' then continue; end if;
    id := btrim(coalesce(item->>'id', ''));
    file := btrim(coalesce(item->>'file', ''));
    if id = '' or file = '' then continue; end if;
    if file !~ '^disclosure-pdfs/[a-z0-9_./-]+\.pdf$' then continue; end if;
    if position('..' in file) > 0 then continue; end if;
    clean := clean || jsonb_build_array(jsonb_build_object(
      'id', id,
      'company', btrim(coalesce(item->>'company', '')),
      'title', btrim(coalesce(item->>'title', '')),
      'file', file
    ));
    n := n + 1;
  end loop;
  return clean;
end;
$$;

revoke all on function public.onyx_disclosure_docs(jsonb) from public, anon, authenticated;

create or replace function public.onyx_disclosure_link_save(p_token text, p_customer_id text, p_docs jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tok text;
  cust text;
  docs jsonb;
  kept jsonb := '{}'::jsonb;
  prev jsonb := '{}'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return jsonb_build_object('ok', false, 'error', 'AUTH');
  end if;
  tok := lower(btrim(coalesce(p_token, '')));
  cust := btrim(coalesce(p_customer_id, ''));
  if tok !~ '^[a-f0-9]{32}$' or cust = '' then
    return jsonb_build_object('ok', false, 'error', 'TOKEN');
  end if;
  docs := public.onyx_disclosure_docs(p_docs);
  if jsonb_array_length(docs) = 0 then
    return jsonb_build_object('ok', false, 'error', 'DOCS');
  end if;
  select opens into prev from public.onyx_disclosure_links where token = tok;
  if prev is null then prev := '{}'::jsonb; end if;
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    into kept
  from jsonb_each(prev) e
  where exists (
    select 1 from jsonb_array_elements(docs) d where d->>'id' = e.key
  );
  insert into public.onyx_disclosure_links (token, customer_id, docs, opens, updated_at)
  values (tok, cust, docs, kept, now())
  on conflict (token) do update
    set customer_id = excluded.customer_id,
        docs = excluded.docs,
        opens = excluded.opens,
        updated_at = now();
  return jsonb_build_object('ok', true, 'token', tok);
end;
$$;

create or replace function public.onyx_disclosure_link_open(p_token text, p_doc text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tok text;
  doc text;
  link public.onyx_disclosure_links%rowtype;
  opened text;
begin
  tok := lower(btrim(coalesce(p_token, '')));
  if tok !~ '^[a-f0-9]{32}$' then
    return jsonb_build_object('ok', false, 'error', 'TOKEN');
  end if;
  select * into link from public.onyx_disclosure_links where token = tok;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'MISSING');
  end if;
  doc := btrim(coalesce(p_doc, ''));
  if doc <> '' and exists (
    select 1 from jsonb_array_elements(link.docs) d where d->>'id' = doc
  ) then
    link.opens := coalesce(link.opens, '{}'::jsonb) || jsonb_build_object(doc, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  end if;
  if link.opened_at is null then
    link.opened_at := now();
  end if;
  update public.onyx_disclosure_links
    set opened_at = link.opened_at,
        opens = link.opens,
        updated_at = now()
    where token = tok;
  opened := to_char(link.opened_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  return jsonb_build_object('ok', true, 'openedAt', opened, 'opens', link.opens, 'docs', link.docs);
end;
$$;

create or replace function public.onyx_disclosure_link_status(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tok text;
  link public.onyx_disclosure_links%rowtype;
  opened text := '';
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return jsonb_build_object('ok', false, 'error', 'AUTH');
  end if;
  tok := lower(btrim(coalesce(p_token, '')));
  if tok !~ '^[a-f0-9]{32}$' then
    return jsonb_build_object('ok', false, 'error', 'TOKEN');
  end if;
  select * into link from public.onyx_disclosure_links where token = tok;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'MISSING');
  end if;
  if link.opened_at is not null then
    opened := to_char(link.opened_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;
  return jsonb_build_object('ok', true, 'openedAt', opened, 'opens', coalesce(link.opens, '{}'::jsonb));
end;
$$;

revoke all on function public.onyx_disclosure_link_save(text, text, jsonb) from public, anon;
revoke all on function public.onyx_disclosure_link_open(text, text) from public;
revoke all on function public.onyx_disclosure_link_status(text) from public, anon;
grant execute on function public.onyx_disclosure_link_save(text, text, jsonb) to authenticated;
grant execute on function public.onyx_disclosure_link_open(text, text) to anon, authenticated;
grant execute on function public.onyx_disclosure_link_status(text) to authenticated;
