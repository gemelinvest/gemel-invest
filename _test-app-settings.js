/**
 * The settings read strips codes and barcodes and leaves the table door open.
 * Run: node _test-app-settings.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-app-settings.sql"), "utf8");
const code = executable(sql);
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

console.log("1) the file adds a narrow settings read");
assert(Buffer.byteLength(sql) < 7800, "the whole file fits in the SQL editor");
assert(sql.trim().endsWith("order by sort_key, detail;"), "the file ends with the result query");
assert(code.includes("create or replace function public.gi_app_settings()"), "it adds the settings function");
assert(code.includes("grant execute on function public.gi_app_settings() to authenticated"), "a signed-in session can call it");
assert(code.includes("revoke all on function public.gi_app_settings() from public, anon"), "the public key cannot call it");
assert(code.includes("anon can read settings"), "an anon result stops the install");
assert(code.includes("'door_closed', 'no'"), "the table door stays open");
assert(!/drop\s+policy|create\s+policy|update\s+public\.app_meta|delete\s+from\s+public\./i.test(code), "it does not change policies or rows");

const start = app.indexOf("async loadMetaRow()");
const end = app.indexOf("async loadLoginRosterPayload()", start);
const fn = app.slice(start, end);
console.log("2) the screen tries the function and keeps the table read");
assert(start > 0 && end > start, "loadMetaRow is still defined");
assert(fn.includes('client.rpc("gi_app_settings")'), "the screen calls the settings function");
assert(fn.indexOf('client.rpc("gi_app_settings")') < fn.indexOf("SUPABASE_TABLES.meta"), "the function is tried before the table");
assert(fn.includes('.from(SUPABASE_TABLES.meta).select("key,payload,updated_at")'), "the table read remains as the fallback");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n3) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n3) database fixture");

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  {
    const db = new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create table public.app_meta (
        key text primary key,
        payload jsonb not null,
        updated_at timestamptz
      );
      alter table public.app_meta enable row level security;
      create policy app_meta_select_authenticated on public.app_meta
        for select to authenticated using (true);
      insert into public.app_meta(key, payload, updated_at) values (
        'global',
        jsonb_build_object(
          'updatedAt', '2026-11-09T00:00:00Z',
          'adminAuth', jsonb_build_object('username', 'manager', 'active', true, 'pin', 'secret-pin'),
          'agentsShadow', jsonb_build_array(jsonb_build_object('id', 'a1', 'name', 'Agent', 'pin', 'secret-pin')),
          'agentSecurity', jsonb_build_object('a1', jsonb_build_object(
            'mfaRequired', true,
            'totpUri', 'otpauth://totp/demo?secret=SECRET',
            'authPasswordScheme', 'derived'
          )),
          'teamManagerAssignments', jsonb_build_object('m1', jsonb_build_array('a1')),
          'customersShadow', jsonb_build_array(jsonb_build_object('id', 'c1', 'full_name', 'Kept Customer')),
          'elementaryReferrals', jsonb_build_array(jsonb_build_object('id', 'r1'))
        ),
        '2026-11-09T00:00:00Z'
      );
    `);
    const before = await db.query("select key, payload, updated_at from public.app_meta order by key");
    const rows = await rowsOf(db);
    const after = await db.query("select key, payload, updated_at from public.app_meta order by key");
    const bySection = Object.fromEntries(rows.map((row) => [row.section, row.detail]));
    assert(JSON.stringify(after.rows) === JSON.stringify(before.rows), "settings rows stayed");
    assert(bySection.function === "gi_app_settings" && bySection.installed === "yes", "the function is installed");
    assert(bySection.door_closed === "no" && bySection.policies_changed === "no" && bySection.rows_changed === "no", "the door and the rows stay");
    assert(bySection.closed_fields === "omitted" && bySection.anon_read === "no" && bySection.table_read === "kept", "closed fields stay out and the table read stays");
    const shown = JSON.stringify(rows);
    assert(!/secret-pin|otpauth|derived/.test(shown), "the result rows do not contain a secret");

    const settings = await db.query("select public.gi_app_settings() as settings");
    const body = JSON.stringify(settings.rows[0].settings);
    assert(body.includes("Kept Customer") && body.includes("elementaryReferrals") && body.includes("manager"), "screen settings stay");
    assert(!/secret-pin|otpauth|derived/.test(body), "a code, a barcode, and a password scheme are absent");
    assert(body.includes("mfaRequired"), "a security flag stays");

    await db.exec("set role anon");
    let blocked = "";
    try { await db.query("select public.gi_app_settings()"); }
    catch(err) { blocked = String(err && err.message || err); }
    await db.exec("reset role");
    assert(/permission denied/i.test(blocked), "the public key cannot call the function");

    const again = Object.fromEntries((await rowsOf(db)).map((row) => [row.section, row.detail]));
    assert(again.installed === "yes" && again.rows_changed === "no", "a second run changes no rows");
    await db.close();
  }

  {
    const db = new PGlite();
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/settings table is missing/.test(blocked), "a missing table saves nothing");
    const fn = await db.query("select count(*)::int as n from pg_proc where proname = 'gi_app_settings'");
    assert(fn.rows[0].n === 0, "the rejected function is not left behind");
    await db.close();
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
