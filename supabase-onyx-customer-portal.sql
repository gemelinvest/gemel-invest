-- Personal area for a customer file.
-- Apply in Supabase before an agent can save a link or a customer can open it.
-- Anon cannot read customers. The page calls onyx_customer_portal_open,
-- which checks the id number, phone, and birth date, then returns only the
-- policies, premiums, cancellations, previous policies, and document names.
-- A portal code is mirrored to gi_sign_links so the existing short host can open it.

create table if not exists public.onyx_customer_portals (
  code text primary key,
  customer_id text unique not null,
  agent_id text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.onyx_customer_portals enable row level security;

drop policy if exists onyx_customer_portals_auth on public.onyx_customer_portals;
create policy onyx_customer_portals_auth on public.onyx_customer_portals
  for all to authenticated
  using (true)
  with check (true);

revoke all on table public.onyx_customer_portals from anon, public;
grant select, insert, update, delete on table public.onyx_customer_portals to authenticated;
grant select, insert, update, delete on table public.onyx_customer_portals to service_role;

create or replace function public.onyx_portal_id(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(regexp_replace(coalesce(value, ''), '\D', '', 'g'), '^0+', '');
$$;

create or replace function public.onyx_portal_phone(value text)
returns text
language plpgsql
immutable
as $$
declare
  digits text := regexp_replace(coalesce(value, ''), '\D', '', 'g');
begin
  if digits like '972%' then digits := substring(digits from 4); end if;
  return regexp_replace(digits, '^0+', '');
end;
$$;

create or replace function public.onyx_portal_birth(value text)
returns text
language plpgsql
immutable
as $$
declare
  raw text := btrim(coalesce(value, ''));
  parts text[];
begin
  if raw ~ '^\d{4}-\d{2}-\d{2}' then
    return substring(raw from 1 for 4) || substring(raw from 6 for 2) || substring(raw from 9 for 2);
  end if;
  if raw ~ '^\d{1,2}[./]\d{1,2}[./]\d{4}' then
    parts := regexp_match(raw, '^(\d{1,2})[./](\d{1,2})[./](\d{4})');
    return parts[3] || lpad(parts[2], 2, '0') || lpad(parts[1], 2, '0');
  end if;
  return '';
end;
$$;

create or replace function public.onyx_portal_amount(value jsonb)
returns numeric
language plpgsql
immutable
as $$
declare
  raw text;
  n numeric;
begin
  if value is null or jsonb_typeof(value) = 'null' then return 0; end if;
  raw := regexp_replace(coalesce(value #>> '{}', ''), '[^0-9.\-]', '', 'g');
  if raw = '' or raw = '-' or raw = '.' then return 0; end if;
  begin
    n := raw::numeric;
  exception when others then
    return 0;
  end;
  if n > 0 then return n; end if;
  return 0;
end;
$$;

create or replace function public.onyx_portal_premium(policy jsonb)
returns numeric
language plpgsql
immutable
as $$
declare
  sim jsonb;
  key text;
  sum numeric := 0;
  any_sim boolean := false;
  n numeric;
  fields text[] := array['premiumAfterDiscountValue', 'premiumAfterDiscount', 'monthlyPremium', 'premiumMonthly', 'premiumValue', 'premium'];
  field text;
begin
  if policy is null or jsonb_typeof(policy) <> 'object' then return 0; end if;
  sim := policy->'simDiscountPerInsured';
  if jsonb_typeof(sim) = 'object' then
    for key in select jsonb_object_keys(sim)
    loop
      n := public.onyx_portal_amount(sim->key->'monthlyAfterDiscount');
      if n > 0 then
        sum := sum + n;
        any_sim := true;
      end if;
    end loop;
    if any_sim then return round(sum, 2); end if;
  end if;
  if coalesce(policy->>'type', '') = 'בריאות'
     and lower(coalesce(policy->>'coverDiscountsApplied', '')) in ('true', 't') then
    n := public.onyx_portal_amount(policy->'premiumAfterCoverDiscounts');
    if n > 0 then return n; end if;
  end if;
  foreach field in array fields loop
    n := public.onyx_portal_amount(policy->field);
    if n > 0 then return n; end if;
  end loop;
  return 0;
end;
$$;

create or replace function public.onyx_portal_doc_title(doc jsonb)
returns text
language plpgsql
immutable
as $$
declare
  name text := btrim(coalesce(doc->>'name', doc->>'fileName', doc->>'originalFileName', ''));
  kind text := btrim(coalesce(doc->>'type', ''));
begin
  if name <> '' then return left(name, 180); end if;
  return case kind
    when 'operational_report_health' then 'דוח תפעולי'
    when 'operational_report_agent_appointment' then 'דוח תפעולי'
    when 'har_bituach_file' then 'הר הביטוח'
    when 'suitability_document' then 'הצהרת התאמה'
    when 'nispah_he_har_auth' then 'הצהרת ביטוח'
    when 'customer_arrival_pack' then 'מסמכי הגעה'
    when 'premium_development_report' then 'דוח התפתחות פרמיה'
    when 'company_cancel_form' then 'טופס ביטול'
    when 'agent_appointment_form' then 'טופס מינוי סוכן'
    else 'מסמך'
  end;
end;
$$;

create or replace function public.onyx_customer_portal_open(p_code text, p_id text, p_phone text, p_birth text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  portal public.onyx_customer_portals%rowtype;
  cust record;
  payload jsonb;
  primary_person jsonb;
  insureds jsonb;
  fresh jsonb;
  elementary jsonb;
  ins jsonb;
  data jsonb;
  book jsonb;
  pols jsonb;
  item jsonb;
  entry jsonb;
  policies jsonb := '[]'::jsonb;
  previous jsonb := '[]'::jsonb;
  cancels jsonb := '[]'::jsonb;
  docs jsonb := '[]'::jsonb;
  seen text[] := array[]::text[];
  prev_seen text[] := array[]::text[];
  given_id text;
  given_phone text;
  given_birth text;
  id_ok boolean := false;
  phone_ok boolean := false;
  birth_ok boolean := false;
  monthly numeric := 0;
  premium numeric;
  company text;
  kind text;
  number text;
  who text;
  raw_status text;
  status_text text;
  live boolean;
  scan jsonb;
  pid text;
  dedupe text;
  reason text;
  signed boolean;
  doc_date text;
  cust_name text;
begin
  select * into portal
  from public.onyx_customer_portals
  where code = btrim(coalesce(p_code, ''));
  if not found then
    return jsonb_build_object('ok', false, 'error', 'MISSING');
  end if;
  if portal.enabled is not true then
    return jsonb_build_object('ok', false, 'error', 'CLOSED');
  end if;

  given_id := public.onyx_portal_id(p_id);
  given_phone := public.onyx_portal_phone(p_phone);
  given_birth := public.onyx_portal_birth(p_birth);
  if given_id = '' or given_phone = '' or given_birth = '' or length(given_id) < 5 or length(given_phone) < 8 then
    return jsonb_build_object('ok', false, 'error', 'MISMATCH');
  end if;

  select id, full_name, id_number, phone, payload
  into cust
  from public.customers
  where id::text = portal.customer_id
  limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'MISSING');
  end if;

  payload := coalesce(cust.payload, '{}'::jsonb);
  if jsonb_typeof(payload) <> 'object' then payload := '{}'::jsonb; end if;
  primary_person := payload->'primary';
  if jsonb_typeof(primary_person) <> 'object' then primary_person := payload #> '{operational,primary}'; end if;
  if jsonb_typeof(primary_person) <> 'object' then primary_person := '{}'::jsonb; end if;
  insureds := payload->'insureds';
  if jsonb_typeof(insureds) <> 'array' or jsonb_array_length(insureds) = 0 then
    insureds := payload #> '{operational,insureds}';
  end if;
  if jsonb_typeof(insureds) <> 'array' then insureds := '[]'::jsonb; end if;

  if public.onyx_portal_id(cust.id_number) = given_id then id_ok := true; end if;
  if public.onyx_portal_id(primary_person->>'idNumber') = given_id then
    id_ok := true;
    if public.onyx_portal_birth(primary_person->>'birthDate') = given_birth then birth_ok := true; end if;
  end if;
  if public.onyx_portal_phone(cust.phone) = given_phone then phone_ok := true; end if;
  if public.onyx_portal_phone(primary_person->>'phone') = given_phone then phone_ok := true; end if;
  if id_ok and public.onyx_portal_birth(primary_person->>'birthDate') = given_birth
     and (public.onyx_portal_id(primary_person->>'idNumber') = '' or public.onyx_portal_id(primary_person->>'idNumber') = given_id) then
    birth_ok := true;
  end if;

  for ins in select value from jsonb_array_elements(insureds)
  loop
    data := ins->'data';
    if jsonb_typeof(data) <> 'object' then data := '{}'::jsonb; end if;
    if public.onyx_portal_id(data->>'idNumber') = given_id then
      id_ok := true;
      if public.onyx_portal_birth(data->>'birthDate') = given_birth then birth_ok := true; end if;
    end if;
    if public.onyx_portal_phone(data->>'phone') = given_phone then phone_ok := true; end if;
  end loop;

  if not (id_ok and phone_ok and birth_ok) then
    return jsonb_build_object('ok', false, 'error', 'MISMATCH');
  end if;

  fresh := payload->'newPolicies';
  if jsonb_typeof(fresh) <> 'array' or jsonb_array_length(fresh) = 0 then
    fresh := payload #> '{operational,newPolicies}';
  end if;
  if jsonb_typeof(fresh) <> 'array' then fresh := '[]'::jsonb; end if;
  elementary := payload->'elementaryPolicies';
  if jsonb_typeof(elementary) <> 'array' then elementary := '[]'::jsonb; end if;

  for item in select value from jsonb_array_elements(fresh || elementary)
  loop
    if jsonb_typeof(item) <> 'object' then continue; end if;
    company := btrim(coalesce(nullif(btrim(coalesce(item->>'company', '')), ''), nullif(btrim(coalesce(item->>'insurer', '')), ''), nullif(btrim(coalesce(item->>'companyName', '')), ''), ''));
    kind := btrim(coalesce(nullif(btrim(coalesce(item->>'type', '')), ''), nullif(btrim(coalesce(item->>'product', '')), ''), nullif(btrim(coalesce(item->>'name', '')), ''), nullif(btrim(coalesce(item->>'planName', '')), ''), 'פוליסה'));
    number := btrim(coalesce(nullif(btrim(coalesce(item->>'policyNumber', '')), ''), nullif(btrim(coalesce(item->>'number', '')), ''), nullif(btrim(coalesce(item->>'policyNo', '')), ''), ''));
    premium := public.onyx_portal_premium(item);
    if coalesce(item->>'origin', '') = 'existing' then
      dedupe := lower(company) || '|' || lower(kind) || '|' || number;
      if dedupe = any(prev_seen) or jsonb_array_length(previous) >= 40 then continue; end if;
      prev_seen := prev_seen || dedupe;
      previous := previous || jsonb_build_array(jsonb_build_object(
        'company', company, 'type', kind, 'number', number, 'premium', premium
      ));
      continue;
    end if;
    pid := btrim(coalesce(item->>'id', ''));
    if pid <> '' and pid = any(seen) then continue; end if;
    if pid <> '' then seen := seen || pid; end if;
    if jsonb_array_length(policies) >= 40 then continue; end if;
    scan := item->'issuedPolicyScan';
    raw_status := btrim(coalesce(item->>'status', item->>'badgeText', ''));
    if jsonb_typeof(scan) = 'object' and btrim(coalesce(scan->>'status', '')) = 'ok' then
      status_text := 'פעילה'; live := true;
    elsif jsonb_typeof(scan) = 'object' and btrim(coalesce(scan->>'status', '')) = 'gaps' then
      status_text := 'יש פערים'; live := false;
    elsif jsonb_typeof(scan) = 'object' and btrim(coalesce(scan->>'status', '')) = 'unreadable' then
      status_text := 'לא ניתן לקרוא'; live := false;
    elsif raw_status = '' or raw_status in ('חדש', 'פעיל', 'פעילה', 'הופק', 'הופקה') then
      status_text := 'פעילה'; live := true;
    else
      status_text := raw_status; live := false;
    end if;
    monthly := monthly + premium;
    policies := policies || jsonb_build_array(jsonb_build_object(
      'company', company,
      'type', kind,
      'number', number,
      'premium', premium,
      'status', status_text,
      'live', live
    ));
  end loop;

  for ins in select value from jsonb_array_elements(insureds)
  loop
    data := ins->'data';
    if jsonb_typeof(data) <> 'object' then data := '{}'::jsonb; end if;
    who := btrim(coalesce(data->>'firstName', '') || ' ' || coalesce(data->>'lastName', ''));
    book := data->'cancellations';
    if jsonb_typeof(book) <> 'object' then book := '{}'::jsonb; end if;
    pols := data->'existingPolicies';
    if jsonb_typeof(pols) <> 'array' then continue; end if;
    for item in select value from jsonb_array_elements(pols)
    loop
      if jsonb_typeof(item) <> 'object' then continue; end if;
      company := btrim(coalesce(item->>'company', item->>'insurer', item->>'companyName', ''));
      kind := btrim(coalesce(nullif(btrim(coalesce(item->>'type', item->>'product', '')), ''), 'פוליסה'));
      number := btrim(coalesce(item->>'policyNumber', item->>'number', item->>'policyNo', ''));
      premium := public.onyx_portal_premium(item);
      entry := book->coalesce(item->>'id', '');
      if jsonb_typeof(entry) <> 'object' then entry := '{}'::jsonb; end if;
      raw_status := btrim(coalesce(nullif(btrim(coalesce(entry->>'status', '')), ''), item->>'status', item->>'policyStatus', item->>'action', ''));
      dedupe := lower(company) || '|' || lower(kind) || '|' || number || '|' || lower(raw_status);
      if dedupe = any(prev_seen) then continue; end if;
      prev_seen := prev_seen || dedupe;
      if raw_status in ('full', 'partial', 'partial_health', 'ביטול מלא', 'ביטול חלקי') then
        if jsonb_array_length(cancels) >= 40 then continue; end if;
        reason := left(btrim(coalesce(entry->>'needsAnalysisReason', entry->>'reason', '')), 240);
        status_text := case raw_status
          when 'full' then 'ביטול מלא'
          when 'partial' then 'ביטול חלקי'
          when 'partial_health' then 'ביטול חלקי'
          else raw_status
        end;
        cancels := cancels || jsonb_build_array(jsonb_build_object(
          'company', company,
          'type', kind,
          'number', number,
          'premium', premium,
          'status', status_text,
          'reason', reason,
          'who', who
        ));
      else
        if jsonb_array_length(previous) >= 40 then continue; end if;
        previous := previous || jsonb_build_array(jsonb_build_object(
          'company', company,
          'type', kind,
          'number', number,
          'premium', premium,
          'who', who
        ));
      end if;
    end loop;
  end loop;

  if jsonb_typeof(payload->'customerDocuments') = 'array' then
    for item in select value from jsonb_array_elements(payload->'customerDocuments')
    loop
      if jsonb_typeof(item) <> 'object' or jsonb_array_length(docs) >= 40 then continue; end if;
      doc_date := btrim(coalesce(item->>'uploadedAt', item->>'createdAt', ''));
      signed := lower(btrim(coalesce(item->>'signed', ''))) in ('true', 't', '1', 'signed')
        or lower(btrim(coalesce(item->>'status', ''))) in ('signed', 'חתום')
        or (jsonb_typeof(item->'signature') = 'object' and lower(btrim(coalesce(item->'signature'->>'signed', ''))) in ('true', 't', '1'));
      docs := docs || jsonb_build_array(jsonb_build_object(
        'title', public.onyx_portal_doc_title(item),
        'date', left(doc_date, 40),
        'signed', signed
      ));
    end loop;
  end if;

  cust_name := btrim(coalesce(cust.full_name, ''));
  if cust_name = '' then
    cust_name := btrim(coalesce(primary_person->>'firstName', '') || ' ' || coalesce(primary_person->>'lastName', ''));
  end if;
  if cust_name = '' then cust_name := 'לקוח'; end if;

  return jsonb_build_object(
    'ok', true,
    'name', cust_name,
    'monthly', round(monthly, 2),
    'policies', policies,
    'cancellations', cancels,
    'previous', previous,
    'documents', docs
  );
end;
$$;

revoke all on function public.onyx_portal_id(text) from public, anon, authenticated;
revoke all on function public.onyx_portal_phone(text) from public, anon, authenticated;
revoke all on function public.onyx_portal_birth(text) from public, anon, authenticated;
revoke all on function public.onyx_portal_amount(jsonb) from public, anon, authenticated;
revoke all on function public.onyx_portal_premium(jsonb) from public, anon, authenticated;
revoke all on function public.onyx_portal_doc_title(jsonb) from public, anon, authenticated;
revoke all on function public.onyx_customer_portal_open(text, text, text, text) from public;
grant execute on function public.onyx_customer_portal_open(text, text, text, text) to anon, authenticated;

insert into public.gi_sign_packets (
  id, customer_id, doc_id, doc_name, customer_name, sender_id, sender_name, pdf_base64
) values (
  'a0e00000-0000-4000-8000-0000000000e2',
  'onyx-portal',
  'onyx-portal',
  '',
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

create or replace function public.onyx_customer_portal_mirror()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  href text;
begin
  if new.code is null or btrim(new.code) !~ '^p[A-Za-z0-9]{5,12}$' then
    return new;
  end if;
  href := case
    when new.enabled is true then 'https://gemelinvest.github.io/gemel-invest/phone/portal.html?c=' || new.code
    else ''
  end;
  begin
    insert into public.gi_sign_links (
      token, packet_id, slot, signer_name, signer_id, box, status, open_href, og_png
    ) values (
      new.code,
      'a0e00000-0000-4000-8000-0000000000e2',
      'portal',
      '',
      '',
      '{}'::jsonb,
      case when new.enabled is true then 'pending' else 'closed' end,
      href,
      ''
    )
    on conflict (token) do update
      set open_href = excluded.open_href,
          status = excluded.status
      where public.gi_sign_links.slot = 'portal';
  exception
    when others then
      raise warning 'onyx_customer_portal_mirror %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.onyx_customer_portal_mirror() from public, anon, authenticated;

drop trigger if exists onyx_customer_portal_mirror on public.onyx_customer_portals;
create trigger onyx_customer_portal_mirror
  after insert or update of enabled, code
  on public.onyx_customer_portals
  for each row
  execute function public.onyx_customer_portal_mirror();
