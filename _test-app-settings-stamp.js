/**
 * The settings clock returns only the update time and leaves the table door open.
 * Run: node _test-app-settings-stamp.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-app-settings-stamp.sql"), "utf8");
const code = executable(sql);
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

console.log("1) the file adds a settings clock");
assert(Buffer.byteLength(sql) < 7800, "the whole file fits in the SQL editor");
assert(sql.trim().endsWith("order by sort_key, detail;"), "the file ends with the result query");
assert(code.includes("create or replace function public.gi_app_settings_stamp()"), "it adds the clock");
assert(code.includes("grant execute on function public.gi_app_settings_stamp() to authenticated"), "a signed-in session can call it");
assert(code.includes("revoke all on function public.gi_app_settings_stamp() from public, anon"), "the public key cannot call it");
assert(code.includes("anon can read the settings clock"), "an anon grant stops the install");
assert(code.includes("'door_closed', 'no'"), "the table door stays open");
assert(code.includes("'table_read', 'kept'"), "the table read stays");
assert(code.includes("'answer', 'time_only'"), "the answer is only the time");
assert(!/drop\s+policy|create\s+policy|update\s+public\.app_meta|delete\s+from\s+public\./i.test(code), "it does not change policies or rows");

const start = app.indexOf("async probeMetaUpdatedAt()");
const end = app.indexOf("async loadMetaRowCached()", start);
const fn = app.slice(start, end);
const loadStart = app.indexOf("async loadMetaRow()");
const loadEnd = app.indexOf("async loadLoginRosterPayload()", loadStart);
const loadFn = app.slice(loadStart, loadEnd);
console.log("2) the screen reads the clock without the table");
assert(start > 0 && end > start, "the clock probe is defined");
assert(fn.includes('client.rpc("gi_app_settings_stamp")'), "the screen calls the clock");
assert(!fn.includes("SUPABASE_TABLES.meta"), "the clock no longer reads the table");
assert(!fn.includes('.select("updated_at")'), "the clock no longer selects the time column");
assert(fn.includes('error: "SETTINGS_STAMP_UNAVAILABLE"'), "a missing answer stays a failed read");
assert(!loadFn.includes("SUPABASE_TABLES.meta"), "loading settings still stays off the table");
assert(app.includes('.from(SUPABASE_TABLES.meta).upsert([row]'), "saving settings still writes the table");
assert(app.includes(".select('key').eq('key', 'global')"), "the connection check still reads the table");
assert(html.includes("giStamp=2"), "the page asks browsers to load this change");

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
      insert into public.app_meta(key, payload, updated_at) values (
        'global',
        '{"adminAuth":{"pin":"secret-pin"},"team":"kept"}'::jsonb,
        '2026-11-09T20:00:00Z'
      );
    `);
    const before = await db.query("select key, payload, updated_at from public.app_meta order by key");
    const rows = await rowsOf(db);
    const after = await db.query("select key, payload, updated_at from public.app_meta order by key");
    const bySection = Object.fromEntries(rows.map((row) => [row.section, row.detail]));
    assert(JSON.stringify(after.rows) === JSON.stringify(before.rows), "settings rows stayed");
    assert(bySection.function === "gi_app_settings_stamp" && bySection.installed === "yes", "the clock is installed");
    assert(bySection.door_closed === "no" && bySection.policies_changed === "no" && bySection.rows_changed === "no", "the door and the rows stay");
    assert(bySection.anon_read === "no" && bySection.signed_in_read === "yes" && bySection.answer === "time_only" && bySection.table_read === "kept", "the answer stays narrow");
    assert(!/secret-pin/.test(JSON.stringify(rows)), "the result rows do not contain a code");

    const stamp = await db.query("select public.gi_app_settings_stamp() as stamp");
    const body = stamp.rows[0].stamp;
    assert(body.ok === true && Object.keys(body).sort().join(",") === "ok,updated_at", "the answer is only the time");
    assert(!JSON.stringify(body).includes("secret-pin"), "a code is absent");

    await db.exec("set role anon");
    let blocked = "";
    try { await db.query("select public.gi_app_settings_stamp()"); }
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
    const fn = await db.query("select count(*)::int as n from pg_proc where proname = 'gi_app_settings_stamp'");
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
