/**
 * Version publish tries the function first and keeps the table write.
 * Run: node _test-app-version-save.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-app-version-save.sql"), "utf8");
const code = executable(sql);
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

console.log("1) the file adds a manager version publish");
assert(Buffer.byteLength(sql) < 7800, "the whole file fits in the SQL editor");
assert(sql.trim().endsWith("order by sort_key, detail;"), "the file ends with the result query");
assert(code.includes("create or replace function public.gi_app_version_save(p_payload jsonb)"), "it adds the version function");
assert(code.includes("grant execute on function public.gi_app_version_save(jsonb) to authenticated"), "a signed-in session can call it");
assert(code.includes("revoke all on function public.gi_app_version_save(jsonb) from public, anon"), "the public key cannot call it");
assert(code.includes("where key = 'app_version'"), "the function writes only the version row");
assert(!code.includes("key = 'global'"), "the function does not write the settings row");
assert(code.includes("'door_closed', 'no'"), "the table door stays open");
assert(!/drop\s+policy|create\s+policy|delete\s+from\s+public\./i.test(code), "it does not change policies or delete rows");

const start = app.indexOf("async publishVersion(){");
const end = app.indexOf("async saveUsersManagementPin(){", start);
const fn = app.slice(start, end);
const poll = app.slice(app.indexOf("async function pollVersionFromSupabase(){"), app.indexOf("function startVersionRealtime(){"));
console.log("2) the screen tries the function and keeps the notice");
assert(start > 0 && end > start, "publishVersion is still defined");
assert(fn.includes('client.rpc("gi_app_version_save"'), "the screen calls the version function first");
assert(fn.includes('fnData.key === "app_version"'), "only a version answer counts as published");
assert(fn.includes(".upsert([row], { onConflict: 'key' })"), "a missing function still writes the table");
assert(fn.includes("window.__GI_NOTIFY_VERSION_PUBLISHED"), "a successful publish still notifies this browser");
assert(fn.includes("תוצג לנציגים במועד שנבחר"), "a scheduled publish keeps its message");
assert(fn.includes("פורסמה — הנציגים יקבלו הודעה"), "an immediate publish keeps its message");
assert(poll.includes('client.rpc("gi_app_version")'), "the version poll reads through the version function");
assert(!poll.includes("key=eq."), "the version poll does not read the table");
assert(!poll.includes("gi_app_version_save"), "the version poll does not use the save function");
assert(html.includes("giVerSave=1"), "the page asks browsers to load the publish change");

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
    create function public.gi_jwt_is_manager() returns boolean language sql stable as $$ select true $$;
    create table public.app_meta (
      key text primary key,
      payload jsonb not null,
      updated_at timestamptz
    );
    insert into public.app_meta(key, payload, updated_at) values
      ('global', jsonb_build_object('updatedAt', '2026-11-09T00:00:00Z', 'adminAuth', jsonb_build_object('username', 'manager')), '2026-11-09T00:00:00Z'),
      ('app_version', jsonb_build_object('version', '1'), '2026-11-09T00:00:00Z');
  `;

  {
    const db = new PGlite();
    await db.exec(helpers);
    const before = await db.query("select key, payload, updated_at from public.app_meta order by key");
    const rows = await rowsOf(db);
    const after = await db.query("select key, payload, updated_at from public.app_meta order by key");
    const bySection = Object.fromEntries(rows.map((row) => [row.section, row.detail]));
    assert(JSON.stringify(after.rows) === JSON.stringify(before.rows), "install leaves every settings row");
    assert(bySection.function === "gi_app_version_save" && bySection.installed === "yes", "the function is installed");
    assert(bySection.door_closed === "no" && bySection.policies_changed === "no" && bySection.rows_changed === "no", "the door and the rows stay");
    assert(bySection.manager_only === "yes" && bySection.anon_execute === "no" && bySection.global_row === "untouched", "only a manager publishes and the settings row stays out");

    const globalBefore = before.rows.find((row) => row.key === "global").payload;
    const saved = await db.query(`
      select public.gi_app_version_save(jsonb_build_object(
        'version', '2026-11-15',
        'notes', 'בדיקה',
        'effectiveAt', null,
        'publishedAt', '2026-11-15T21:20:00.000Z',
        'updatedBy', 'אוריה',
        'pin', 'secret-pin'
      )) as saved
    `);
    const body = JSON.stringify(saved.rows[0].saved);
    assert(body.includes('"ok":true') && body.includes('"key":"app_version"'), "a manager publish is accepted");
    const stored = await db.query("select key, payload::text as payload from public.app_meta order by key");
    const versionRow = stored.rows.find((row) => row.key === "app_version");
    const globalRow = stored.rows.find((row) => row.key === "global");
    assert(versionRow.payload.includes("2026-11-15") && versionRow.payload.includes("אוריה"), "the published version is stored");
    assert(!versionRow.payload.includes("secret-pin"), "a code is not stored on the version row");
    assert(JSON.stringify(globalRow.payload) === JSON.stringify(globalBefore) || globalRow.payload.includes("manager"), "the settings row stays");
    const globalNow = await db.query("select payload::text as payload from public.app_meta where key = 'global'");
    assert(globalNow.rows[0].payload.includes("manager") && !globalNow.rows[0].payload.includes("2026-11-15"), "the settings row is not replaced by the version");

    await db.exec("create or replace function public.gi_jwt_is_manager() returns boolean language sql stable as $$ select false $$");
    const denied = await db.query(`
      select public.gi_app_version_save(jsonb_build_object('version', 'should-not-land', 'notes', '', 'publishedAt', '2026-11-15T22:00:00.000Z', 'updatedBy', 'agent')) as saved
    `);
    const afterDeny = await db.query("select payload::text as payload from public.app_meta where key = 'app_version'");
    assert(String(JSON.stringify(denied.rows[0].saved)).includes("NOT_ALLOWED"), "an agent is refused");
    assert(afterDeny.rows[0].payload === versionRow.payload, "a refused publish does not change the version");

    await db.exec("set role anon");
    let blocked = "";
    try { await db.query("select public.gi_app_version_save('{}'::jsonb)"); }
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
    const fn = await db.query("select count(*)::int as n from pg_proc where proname = 'gi_app_version_save'");
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
