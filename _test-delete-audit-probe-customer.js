/**
 * The audit probe customer is deleted only when its id, name mark, and
 * archived mark all match, and nothing else points at that id.
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

console.log("1) the file deletes only the marked probe row");
assert(code.includes("delete from public.customers"), "it deletes from customers");
assert(code.includes("full_name = $2") && code.includes("is_archived is true"), "the delete requires both marks");
assert(code.includes("'__audit_probe_cust__'") && code.includes("'[AUDIT_PROBE_DELETE_ME]'"), "the marks are the audit marks");
assert(!/delete\s+from\s+public\.(?!customers\b)/i.test(code), "it does not delete from another table");
assert(!/update\s+public\./i.test(code), "it does not update a row");
assert(!/drop policy|create policy|revoke |alter table/i.test(code), "it does not change policies or grants");
assert(!/select\s+full_name/i.test(code), "it does not print the name");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");

  const shape = `
    create table public.customers (
      id text primary key,
      full_name text,
      is_archived boolean,
      phone text
    );
    insert into public.customers(id, full_name, is_archived, phone) values
      ('__audit_probe_cust__', '[AUDIT_PROBE_DELETE_ME]', true, '0500000000'),
      ('live-1', 'לקוח פעיל', false, '0501111111'),
      ('live-2', '[AUDIT_PROBE_DELETE_ME]', true, '0502222222');
  `;

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
    assert(details.includes("referenced=no") && details.includes("deleted=1"), "one unreferenced row is deleted");
    assert(details.includes("remaining=0") && details.includes("other_customers=unchanged") && details.includes("changed=yes"), "the cut is reported");
    assert(!details.some((row) => row.includes("[AUDIT_PROBE_DELETE_ME]") || row.includes("050")), "the result does not print the name or a phone");

    const left = await db.query("select id, phone from public.customers order by id");
    assert(left.rows.map((row) => row.id).join(",") === "live-1,live-2", "the live customers stay");
    assert(left.rows.some((row) => row.phone === "0501111111") && left.rows.some((row) => row.phone === "0502222222"), "the live phones stay");

    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("matched=0") && again.includes("marker=absent") && again.includes("deleted=0") && again.includes("changed=no"), "a second run deletes nothing");
    const still = await db.query("select count(*)::int as n from public.customers");
    assert(still.rows[0].n === 2, "the second run keeps both live customers");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.customers (
        id text primary key,
        full_name text,
        is_archived boolean
      );
      insert into public.customers(id, full_name, is_archived) values
        ('__audit_probe_cust__', 'לקוח אמיתי', true),
        ('live-1', 'לקוח פעיל', false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/probe marker does not match; nothing saved/i.test(blocked), "a different name saves nothing");
    const kept = await db.query("select id from public.customers order by id");
    assert(kept.rows.map((row) => row.id).join(",") === "__audit_probe_cust__,live-1", "both rows stay when the name differs");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.customers (
        id text primary key,
        full_name text,
        is_archived boolean
      );
      insert into public.customers(id, full_name, is_archived) values
        ('__audit_probe_cust__', '[AUDIT_PROBE_DELETE_ME]', false),
        ('live-1', 'לקוח פעיל', false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/probe marker does not match; nothing saved/i.test(blocked), "an unarchived row saves nothing");
    const kept = await db.query("select count(*)::int as n from public.customers where id = '__audit_probe_cust__'");
    assert(kept.rows[0].n === 1, "the unarchived probe stays");
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
    const kept = await db.query("select count(*)::int as n from public.customers where id = '__audit_probe_cust__'");
    const live = await db.query("select count(*)::int as n from public.customers where id <> '__audit_probe_cust__'");
    const reminder = await db.query("select count(*)::int as n from public.reminders");
    assert(kept.rows[0].n === 1 && live.rows[0].n === 2 && reminder.rows[0].n === 1, "the probe, the live customers, and the reminder stay");
  }

  {
    const db = new PGlite();
    await db.exec("create table public.customers (id text primary key, full_name text)");
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/customer columns are missing; nothing saved/i.test(blocked), "missing columns save nothing");
    const kept = await db.query("select count(*)::int as n from public.customers");
    assert(kept.rows[0].n === 0, "an empty customers table stays empty");
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
