/**
 * The version poll tries a narrow read and keeps the table read.
 * Run: node _test-app-version-poll.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-app-version.sql"), "utf8");
const code = executable(sql);
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

console.log("1) the file adds a narrow version read");
assert(Buffer.byteLength(sql) < 7800, "the whole file fits in the SQL editor");
assert(sql.trim().endsWith("order by sort_key, detail;"), "the file ends with the result query");
assert(code.includes("create or replace function public.gi_app_version()"), "it adds the version read");
assert(code.includes("grant execute on function public.gi_app_version() to authenticated"), "a signed-in session can call it");
assert(code.includes("revoke all on function public.gi_app_version() from public, anon"), "the public key cannot call it");
assert(code.includes("where m.key = 'app_version'"), "the function reads only the version row");
assert(!code.includes("key = 'global'"), "the function does not name the settings row");
assert(code.includes("'door_closed', 'no'"), "the table door stays open");
assert(!/drop\s+policy|create\s+policy|update\s+public\.app_meta|delete\s+from\s+public\./i.test(code), "it does not change policies or rows");

const poll = app.slice(app.indexOf("async function pollVersionFromSupabase(){"), app.indexOf("function startVersionRealtime(){"));
const channel = app.slice(app.indexOf("function startVersionRealtime(){"), app.indexOf("function startVersionWatchAfterLogin(){"));
const handler = app.slice(app.indexOf("function handleVersionChange(rawInfo){"), app.indexOf("function promptBrandingEpochIfNeeded"));
console.log("2) the poll tries the function and keeps the table read");
assert(poll.includes('client.rpc("gi_app_version")'), "the poll calls the version function");
assert(poll.indexOf('client.rpc("gi_app_version")') < poll.indexOf("key=eq."), "the function is tried before the table");
assert(poll.includes("key=eq."), "a missing function still reads the version row");
assert(poll.includes("handleVersionChange(rawFn)"), "a function answer still opens the same notice path");
assert(poll.includes("promptBrandingEpochIfNeeded(rawFn)"), "a function answer still uses the same branding check");
assert(!poll.includes("gi_app_version_save"), "the poll does not publish");
assert(!poll.includes("releaseAckForAssetEpoch"), "the poll does not erase an acknowledgement");
assert(channel.includes('filter: "key=eq." + GI_VC_META_KEY'), "the version channel still listens to the version row");
assert(!channel.includes("gi_app_version"), "the version channel does not use the read function");
assert(!handler.includes("gi_app_version"), "the notice logic is unchanged");
assert(html.includes("giVerPoll=1"), "the page asks browsers to load the poll change");

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

  const helpers = `
    create role anon nologin;
    create role authenticated nologin;
    create schema if not exists auth;
    create function auth.uid() returns uuid language sql stable as $$
      select '00000000-0000-0000-0000-000000000001'::uuid
    $$;
    create table public.app_meta (
      key text primary key,
      payload jsonb not null,
      updated_at timestamptz
    );
    insert into public.app_meta(key, payload, updated_at) values
      ('global', jsonb_build_object('updatedAt', '2026-11-09T00:00:00Z', 'adminAuth', jsonb_build_object('username', 'manager', 'pin', 'secret-pin')), '2026-11-09T00:00:00Z'),
      ('app_version', jsonb_build_object('version', '2026-11-15', 'notes', 'בדיקה', 'effectiveAt', null, 'publishedAt', '2026-11-15T21:20:00.000Z', 'updatedBy', 'אוריה', 'pin', 'secret-pin'), '2026-11-09T00:00:00Z');
  `;

  {
    const db = new PGlite();
    await db.exec(helpers);
    const before = await db.query("select key, payload, updated_at from public.app_meta order by key");
    const rows = await rowsOf(db);
    const after = await db.query("select key, payload, updated_at from public.app_meta order by key");
    const bySection = Object.fromEntries(rows.map((row) => [row.section, row.detail]));
    assert(JSON.stringify(after.rows) === JSON.stringify(before.rows), "install leaves every settings row");
    assert(bySection.function === "gi_app_version" && bySection.installed === "yes", "the function is installed");
    assert(bySection.door_closed === "no" && bySection.policies_changed === "no" && bySection.rows_changed === "no", "the door and the rows stay");
    assert(bySection.answer === "version_only" && bySection.anon_read === "no" && bySection.table_read === "kept" && bySection.global_row === "unread", "the answer stays narrow and the table read stays");

    const shown = await db.query("select public.gi_app_version() as version");
    const body = JSON.stringify(shown.rows[0].version);
    assert(body.includes('"ok":true') && body.includes('"key":"app_version"'), "a signed-in read is accepted");
    assert(body.includes("2026-11-15") && body.includes("אוריה") && body.includes("בדיקה"), "the version fields are returned");
    assert(!body.includes("secret-pin") && !body.includes("adminAuth"), "a code and the settings row are absent");

    await db.exec("delete from public.app_meta where key = 'app_version'");
    const empty = await db.query("select public.gi_app_version() as version");
    assert(JSON.stringify(empty.rows[0].version).includes('"payload":null'), "a missing version row is an empty answer");
    const globalLeft = await db.query("select payload::text as payload from public.app_meta where key = 'global'");
    assert(globalLeft.rows[0].payload.includes("manager"), "the settings row stays in the table");

    await db.exec("set role anon");
    let blocked = "";
    try { await db.query("select public.gi_app_version()"); }
    catch(err) { blocked = String(err && err.message || err); }
    await db.exec("reset role");
    assert(/permission denied/i.test(blocked), "the public key cannot call the function");
    await db.close();
  }

  {
    const db = new PGlite();
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/settings table is missing/.test(blocked), "a missing table saves nothing");
    const fn = await db.query("select count(*)::int as n from pg_proc where proname = 'gi_app_version'");
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
