-- =============================================================================
-- GEMEL INVEST · retire the leftover audit probe customer.
--
-- The architecture audit inserted one customers row and could not delete it
-- with the public key. The row is marked id __audit_probe_cust__,
-- full_name [AUDIT_PROBE_DELETE_ME], and is_archived true.
--
-- Physical DELETE on customers is blocked by block_delete(). The app retires
-- an archived customer by setting status to purged and clearing payload.
-- This file does that for the probe row only. It does not disable the
-- delete block, and it does not delete or update any other customer.
-- The name is not printed. No policy or grant is changed.
--
-- The change runs only for a role that bypasses row security, which is the
-- SQL Editor service role. If the probe is already purged, the file reports
-- that and writes nothing. If a mark does not match, the delete block is
-- missing, or another row points at this id, the file stops and saves nothing.
--
-- Run this once in the SQL Editor. If the editor warns about a temporary
-- table, choose Run without RLS. Paste the result rows. If it stops with
-- an error, paste only the error text and do not run it again.
-- =============================================================================

drop table if exists gi_probe_customer_cleanup;
create temporary table gi_probe_customer_cleanup (
  sort_key integer not null,
  section text not null,
  detail text not null
);

do $cut$
declare
  v_id constant text := '__audit_probe_cust__';
  v_name constant text := '[AUDIT_PROBE_DELETE_ME]';
  v_bypass boolean;
  v_matched integer;
  v_marker boolean;
  v_archived boolean;
  v_status text;
  v_payload_type text;
  v_has_updated boolean;
  v_payload_open boolean;
  v_others_before integer;
  v_others_after integer;
  v_others_changed integer;
  v_written integer;
  v_remaining integer;
  v_refs integer := 0;
  v_one integer;
  v_ref record;
  v_assign text;
  v_needs text;
begin
  if to_regclass('public.customers') is null then
    raise exception 'customers table is missing; nothing saved';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name in ('id', 'full_name', 'is_archived', 'status')
  ) <> 4 then
    raise exception 'customer columns are missing; nothing saved';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'public'
      and c.relname = 'customers'
      and p.proname = 'block_delete'
      and not t.tgisinternal
      and t.tgenabled in ('O', 'A')
  ) then
    raise exception 'delete block is missing; nothing saved';
  end if;

  select r.rolbypassrls or r.rolsuper
    into v_bypass
  from pg_roles r
  where r.rolname = current_user;
  if v_bypass is distinct from true then
    raise exception 'service role is required; nothing saved';
  end if;

  select c.udt_name
    into v_payload_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'customers'
    and c.column_name = 'payload';
  if v_payload_type is not null and v_payload_type not in ('jsonb', 'json', 'text') then
    raise exception 'payload type is unexpected; nothing saved';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'updated_at'
  ) into v_has_updated;

  execute 'select count(*) from public.customers where id::text = $1'
    into v_matched
    using v_id;
  if v_matched > 1 then
    raise exception 'probe id is not unique; nothing saved';
  end if;

  execute 'select count(*) from public.customers where id::text <> $1'
    into v_others_before
    using v_id;

  if v_matched = 0 then
    insert into gi_probe_customer_cleanup(sort_key, section, detail) values
      (1, 'target_id', v_id),
      (2, 'matched', '0'),
      (3, 'marker', 'absent'),
      (4, 'referenced', 'no'),
      (5, 'delete_blocked', 'yes'),
      (6, 'action', 'absent'),
      (7, 'status', 'absent'),
      (8, 'deleted', '0'),
      (9, 'remaining', '0'),
      (10, 'other_customers', 'unchanged'),
      (11, 'changed', 'no');
    return;
  end if;

  execute
    'select (full_name = $2), (is_archived is true), status from public.customers where id::text = $1'
    into v_marker, v_archived, v_status
    using v_id, v_name;
  if v_marker is distinct from true or v_archived is distinct from true then
    raise exception 'probe marker does not match; nothing saved';
  end if;

  for v_ref in
    select n.nspname as schema_name,
           c.relname as table_name,
           a.attname as column_name
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join lateral unnest(con.conkey) as k(attnum) on true
    join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
    where con.contype = 'f'
      and con.confrelid = 'public.customers'::regclass
  loop
    execute format(
      'select count(*) from %I.%I where %I::text = $1',
      v_ref.schema_name,
      v_ref.table_name,
      v_ref.column_name
    )
      into v_one
      using v_id;
    v_refs := v_refs + coalesce(v_one, 0);
  end loop;
  if v_refs > 0 then
    raise exception 'probe row is referenced; nothing saved';
  end if;

  drop table if exists gi_probe_customer_others;
  if v_payload_type is null then
    execute
      'create temporary table gi_probe_customer_others as select id::text as id, status from public.customers where id::text <> $1'
      using v_id;
  elsif v_payload_type = 'text' then
    execute
      'select status is distinct from ''purged'' or payload is null or payload not in (''{}'', ''null'') from public.customers where id::text = $1'
      into v_payload_open
      using v_id;
    execute
      'create temporary table gi_probe_customer_others as select id::text as id, status, payload::text as payload_text from public.customers where id::text <> $1'
      using v_id;
  else
    execute
      'select status is distinct from ''purged'' or payload is null or payload::text not in (''{}'', ''null'') from public.customers where id::text = $1'
      into v_payload_open
      using v_id;
    execute
      'create temporary table gi_probe_customer_others as select id::text as id, status, payload::text as payload_text from public.customers where id::text <> $1'
      using v_id;
  end if;

  if v_payload_type is null then
    v_payload_open := v_status is distinct from 'purged';
  end if;
  if v_payload_open is null then
    raise exception 'probe state could not be read; nothing saved';
  end if;

  if not v_payload_open then
    insert into gi_probe_customer_cleanup(sort_key, section, detail) values
      (1, 'target_id', v_id),
      (2, 'matched', '1'),
      (3, 'marker', 'yes'),
      (4, 'referenced', 'no'),
      (5, 'delete_blocked', 'yes'),
      (6, 'action', 'already_purged'),
      (7, 'status', 'purged'),
      (8, 'deleted', '0'),
      (9, 'remaining', '1'),
      (10, 'other_customers', 'unchanged'),
      (11, 'changed', 'no');
    return;
  end if;

  v_assign := 'status = ''purged''';
  v_needs := 'status is distinct from ''purged''';
  if v_payload_type = 'jsonb' then
    v_assign := v_assign || ', payload = ''{}''::jsonb';
    v_needs := v_needs || ' or payload is null or payload::text not in (''{}'', ''null'')';
  elsif v_payload_type = 'json' then
    v_assign := v_assign || ', payload = ''{}''::json';
    v_needs := v_needs || ' or payload is null or payload::text not in (''{}'', ''null'')';
  elsif v_payload_type = 'text' then
    v_assign := v_assign || ', payload = ''{}''';
    v_needs := v_needs || ' or payload is null or payload not in (''{}'', ''null'')';
  end if;
  if v_has_updated then
    v_assign := v_assign || ', updated_at = now()';
  end if;

  execute
    'update public.customers set ' || v_assign
    || ' where id::text = $1 and full_name = $2 and is_archived is true and (' || v_needs || ')'
    using v_id, v_name;
  get diagnostics v_written = row_count;
  if v_written <> 1 then
    raise exception 'probe update count was not one; nothing saved';
  end if;

  execute 'select count(*) from public.customers where id::text = $1 and status = ''purged'' and is_archived is true'
    into v_remaining
    using v_id;
  execute 'select count(*) from public.customers where id::text <> $1'
    into v_others_after
    using v_id;
  if v_payload_type is null then
    execute
      'select count(*) from gi_probe_customer_others o join public.customers c on c.id::text = o.id where c.status is distinct from o.status'
      into v_others_changed;
  else
    execute
      'select count(*) from gi_probe_customer_others o join public.customers c on c.id::text = o.id where c.status is distinct from o.status or c.payload::text is distinct from o.payload_text'
      into v_others_changed;
  end if;
  if v_remaining <> 1 or v_others_after <> v_others_before or v_others_changed <> 0 then
    raise exception 'more than the probe row changed; nothing saved';
  end if;

  insert into gi_probe_customer_cleanup(sort_key, section, detail) values
    (1, 'target_id', v_id),
    (2, 'matched', '1'),
    (3, 'marker', 'yes'),
    (4, 'referenced', 'no'),
    (5, 'delete_blocked', 'yes'),
    (6, 'action', 'tombstone'),
    (7, 'status', 'purged'),
    (8, 'deleted', '0'),
    (9, 'remaining', '1'),
    (10, 'other_customers', 'unchanged'),
    (11, 'changed', 'yes');
end
$cut$;

select section, detail
from gi_probe_customer_cleanup
order by sort_key;
