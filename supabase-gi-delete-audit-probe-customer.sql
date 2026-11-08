-- =============================================================================
-- GEMEL INVEST · delete the leftover audit probe customer.
--
-- The architecture audit inserted one customers row and could not delete it
-- with the public key. The row is marked id __audit_probe_cust__,
-- full_name [AUDIT_PROBE_DELETE_ME], and is_archived true.
--
-- This file deletes that one row only when all three marks match and no
-- other table references the id. Every other customer stays. The name is
-- not printed. No policy, grant, or other table is changed.
--
-- The delete runs only for a role that bypasses row security, which is the
-- SQL Editor service role. If the row is already gone, the file reports
-- that and deletes nothing. If a mark does not match, or another row
-- points at this id, the file stops and saves nothing.
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
  v_others_before integer;
  v_others_after integer;
  v_deleted integer;
  v_remaining integer;
  v_refs integer := 0;
  v_one integer;
  v_ref record;
begin
  if to_regclass('public.customers') is null then
    raise exception 'customers table is missing; nothing saved';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name in ('id', 'full_name', 'is_archived')
  ) <> 3 then
    raise exception 'customer columns are missing; nothing saved';
  end if;

  select r.rolbypassrls or r.rolsuper
    into v_bypass
  from pg_roles r
  where r.rolname = current_user;
  if v_bypass is distinct from true then
    raise exception 'service role is required; nothing saved';
  end if;

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
      (5, 'deleted', '0'),
      (6, 'remaining', '0'),
      (7, 'other_customers', 'unchanged'),
      (8, 'changed', 'no');
    return;
  end if;

  execute
    'select (full_name = $2), (is_archived is true) from public.customers where id::text = $1'
    into v_marker, v_archived
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

  execute
    'delete from public.customers where id::text = $1 and full_name = $2 and is_archived is true'
    using v_id, v_name;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'probe delete count was not one; nothing saved';
  end if;

  execute 'select count(*) from public.customers where id::text = $1'
    into v_remaining
    using v_id;
  execute 'select count(*) from public.customers where id::text <> $1'
    into v_others_after
    using v_id;
  if v_remaining <> 0 or v_others_after <> v_others_before then
    raise exception 'more than the probe row changed; nothing saved';
  end if;

  insert into gi_probe_customer_cleanup(sort_key, section, detail) values
    (1, 'target_id', v_id),
    (2, 'matched', '1'),
    (3, 'marker', 'yes'),
    (4, 'referenced', 'no'),
    (5, 'deleted', '1'),
    (6, 'remaining', '0'),
    (7, 'other_customers', 'unchanged'),
    (8, 'changed', 'yes');
end
$cut$;

select section, detail
from gi_probe_customer_cleanup
order by sort_key;
