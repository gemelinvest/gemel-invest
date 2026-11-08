/**
 * The audit probe customer is retired in place when delete is blocked.
 * Only its status and payload change. Live customers stay.
 * Run: node _test-delete-audit-probe-customer.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function executable(sql){
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-delete-audit-probe-customer.sql"), "utf8");
const code = executable(sql);

console.log("1) the file retires only the marked probe row");
assert(code.includes("status = ''purged''"), "it sets the purged status");
assert(code.includes("full_name = $2") && code.includes("is_archived is true"), "the write requires both marks");
assert(code.includes("'__audit_probe_cust__'") && code.includes("'[AUDIT_PROBE_DELETE_ME]'"), "the marks are the audit marks");
assert(!/delete\s+from\s+public\./i.test(code), "it does not delete a row");
assert(!/disable\s+trigger/i.test(code), "it does not disable the delete block");
assert(!/drop policy|create policy|revoke |alter table/i.test(code), "it does not change policies or grants");
assert(!/select\s+full_name/i.test(code), "it does not print the name");

const guard = `
  create function public.block_delete() returns trigger language plpgsql as $$
  begin
    raise exception 'DELETE is blocked on this table. Use archive/inactive instead.';
  end $$;
  create trigger customers_block_delete before delete on public.customers
  for each row execute function public.block_delete();
`;

const shape = `
  create table public.customers (
    id text primary key,
    full_name text,
    is_archived boolean,
    status text,
    phone text,
    payload jsonb,
    updated_at timestamptz
  );
  insert into public.customers(id, full_name, is_archived, status, phone, payload, updated_at) values
    ('__audit_probe_cust__', '[AUDIT_PROBE_DELETE_ME]', true, 'inactive', '0500000000', '{"probe":true}'::jsonb, '2026-09-13'),
    ('live-1', 'לקוח פעיל', false, 'חדש', '0501111111', '{"keep":1}'::jsonb, '2026-11-01'),
    ('live-2', '[AUDIT_PROBE_DELETE_ME]', true, 'inactive', '0502222222', '{"keep":2}'::jsonb, '2026-11-02');
` + guard;

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  {
    const db = new PGlite();
    await db.exec(shape);
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("target_id=__audit_probe_cust__"), "the target id is reported");
    assert(details.includes("matched=1") && details.includes("marker=yes"), "the marked row is recognized");
    assert(details.includes("delete_blocked=yes") && details.includes("action=tombstone"), "the blocked delete becomes a tombstone");
    assert(details.includes("status=purged") && details.includes("deleted=0") && details.includes("remaining=1"), "the row stays and is purged");
    assert(details.includes("referenced=no") && details.includes("other_customers=unchanged") && details.includes("changed=yes"), "the cut is reported");
    assert(!details.some((row) => row.includes("[AUDIT_PROBE_DELETE_ME]") || row.includes("050")), "the result does not print the name or a phone");

    const probe = await db.query("select status, is_archived, payload::text as payload, phone from public.customers where id = '__audit_probe_cust__'");
    assert(probe.rows[0].status === "purged" && probe.rows[0].is_archived === true && probe.rows[0].payload === "{}", "the probe is purged and its payload is cleared");
    assert(probe.rows[0].phone === "0500000000", "the probe phone column is left as it was");

    const left = await db.query("select id, status, phone, payload::text as payload from public.customers where id <> '__audit_probe_cust__' order by id");
    assert(left.rows.map((row) => row.id + ":" + row.status + ":" + row.phone + ":" + row.payload).join("|") === "live-1:חדש:0501111111:{\"keep\": 1}|live-2:inactive:0502222222:{\"keep\": 2}", "the live customers stay unchanged");

    let deleteBlocked = "";
    try {
      await db.exec("delete from public.customers where id = 'live-1'");
    } catch(err) {
      deleteBlocked = String(err && err.message || err);
    }
    const live = await db.query("select count(*)::int as n from public.customers where id = 'live-1'");
    assert(/DELETE is blocked/i.test(deleteBlocked) && live.rows[0].n === 1, "the delete block still stops a customer delete");

    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("action=already_purged") && again.includes("deleted=0") && again.includes("changed=no"), "a second run writes nothing");
    const still = await db.query("select status, payload::text as payload from public.customers where id = '__audit_probe_cust__'");
    assert(still.rows[0].status === "purged" && still.rows[0].payload === "{}", "the second run keeps the tombstone");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.customers (
        id text primary key,
        full_name text,
        is_archived boolean,
        status text,
        payload jsonb
      );
      insert into public.customers(id, full_name, is_archived, status, payload) values
        ('__audit_probe_cust__', 'לקוח אמיתי', true, 'inactive', '{}'::jsonb),
        ('live-1', 'לקוח פעיל', false, 'חדש', '{}'::jsonb);
    ` + guard);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/probe marker does not match; nothing saved/i.test(blocked), "a different name saves nothing");
    const kept = await db.query("select id, status from public.customers order by id");
    assert(kept.rows.map((row) => row.id + ":" + row.status).join(",") === "__audit_probe_cust__:inactive,live-1:חדש", "both rows stay when the name differs");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.customers (
        id text primary key,
        full_name text,
        is_archived boolean,
        status text,
        payload jsonb
      );
      insert into public.customers(id, full_name, is_archived, status, payload) values
        ('__audit_probe_cust__', '[AUDIT_PROBE_DELETE_ME]', false, 'חדש', '{}'::jsonb),
        ('live-1', 'לקוח פעיל', false, 'חדש', '{}'::jsonb);
    ` + guard);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/probe marker does not match; nothing saved/i.test(blocked), "an active row saves nothing");
    const kept = await db.query("select status from public.customers where id = '__audit_probe_cust__'");
    assert(kept.rows[0].status === "חדש", "the active probe stays active");
  }

  {
    const db = new PGlite();
    await db.exec(shape + `
      create table public.reminders (
        id text primary key,
        customer_id text references public.customers(id)
      );
      insert into public.reminders(id, customer_id) values ('r-probe', '__audit_probe_cust__');
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/probe row is referenced; nothing saved/i.test(blocked), "a referencing row saves nothing");
    const kept = await db.query("select status from public.customers where id = '__audit_probe_cust__'");
    const live = await db.query("select count(*)::int as n from public.customers where id <> '__audit_probe_cust__'");
    assert(kept.rows[0].status === "inactive" && live.rows[0].n === 2, "the probe and the live customers stay");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.customers (
        id text primary key,
        full_name text,
        is_archived boolean
      );
    ` + guard);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/customer columns are missing; nothing saved/i.test(blocked), "missing columns save nothing");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.customers (
        id text primary key,
        full_name text,
        is_archived boolean,
        status text,
        payload jsonb
      );
      insert into public.customers(id, full_name, is_archived, status, payload) values
        ('__audit_probe_cust__', '[AUDIT_PROBE_DELETE_ME]', true, 'inactive', '{}'::jsonb);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/delete block is missing; nothing saved/i.test(blocked), "a missing delete block saves nothing");
    const kept = await db.query("select status from public.customers where id = '__audit_probe_cust__'");
    assert(kept.rows[0].status === "inactive", "the probe stays when the block is missing");
  }
}

runDatabase().then(() => {
  if(failed){
    console.error("\nFAILED " + failed);
    process.exit(1);
  }
  console.log("\nOK");
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
