/**
 * Settings save tries the function first and keeps the table write.
 * Run: node _test-app-settings-save.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-app-settings-save.sql"), "utf8");
const code = executable(sql);
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

console.log("1) the file adds a global settings save");
assert(Buffer.byteLength(sql) < 7800, "the whole file fits in the SQL editor");
assert(sql.trim().endsWith("order by sort_key, detail;"), "the file ends with the result query");
assert(code.includes("create or replace function public.gi_app_settings_save(p_payload jsonb, p_updated_at timestamptz)"), "it adds the save function");
assert(code.includes("grant execute on function public.gi_app_settings_save(jsonb, timestamptz) to authenticated"), "a signed-in session can call it");
assert(code.includes("revoke all on function public.gi_app_settings_save(jsonb, timestamptz) from public, anon"), "the public key cannot call it");
assert(code.includes("anon can save settings"), "an anon grant stops the install");
assert(code.includes("'door_closed', 'no'"), "the table door stays open");
assert(code.includes("where key = 'global'"), "the function writes only the global row");
assert(code.includes("position('app_version' in v_def) > 0"), "a version mention stops the install");
assert(!/drop\s+policy|create\s+policy|delete\s+from\s+public\./i.test(code), "it does not change policies or delete rows");

const start = app.indexOf("async upsertMeta(state){");
const end = app.indexOf("invalidateMetaRowCache(){", start);
const fn = app.slice(start, end);
const publishStart = app.indexOf("async publishVersion(){");
const publishEnd = app.indexOf("async ", publishStart + 20);
const publishFn = app.slice(publishStart, publishEnd > publishStart ? publishEnd : publishStart + 2500);
console.log("2) the screen saves through the function only");
assert(start > 0 && end > start, "upsertMeta is still defined");
assert(fn.includes('client.rpc("gi_app_settings_save"'), "the screen calls the save function");
assert(fn.includes('fnData.key === "global"'), "only a global answer counts as saved");
assert(fn.includes("SETTINGS_SAVE_FAILED"), "a missing answer stays a failed save");
assert(!fn.includes(".from(SUPABASE_TABLES.meta)"), "a missing function does not write the table");
assert(!fn.includes("key=eq.global"), "a missing function does not read the settings row");
assert(publishFn.includes("key: 'app_version'"), "version publish still writes its own row");
assert(publishFn.includes(".from(SUPABASE_TABLES.meta).upsert([row]"), "version publish still keeps its table backup");
assert(!publishFn.includes("gi_app_settings_save"), "version publish does not use the settings save");
assert(html.includes("giSetSave=1"), "the page asks browsers to load the save change");
assert(html.includes("giSetSaveOnly=1"), "the page asks browsers to load the save without the table");

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
    create function public.gi_jwt_agent_id() returns text language sql stable as $$ select 'agent-1' $$;
    create table public.app_meta (
      key text primary key,
      payload jsonb not null,
      updated_at timestamptz
    );
    insert into public.app_meta(key, payload, updated_at) values
      ('global', jsonb_build_object('updatedAt', '2026-11-09T00:00:00Z', 'adminAuth', jsonb_build_object('username', 'manager'), 'teamManagerAssignments', jsonb_build_object('m1', jsonb_build_array('a1'))), '2026-11-09T00:00:00Z'),
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
    assert(bySection.function === "gi_app_settings_save" && bySection.installed === "yes", "the function is installed");
    assert(bySection.door_closed === "no" && bySection.policies_changed === "no" && bySection.rows_changed === "no", "the door and the rows stay");
    assert(bySection.anon_execute === "no" && bySection.table_write === "kept" && bySection.global_only === "yes", "the public key cannot call it and the table write stays");

    const saved = await db.query(`
      select public.gi_app_settings_save(
        jsonb_build_object(
          'updatedAt', '2026-11-15T21:00:00Z',
          'adminAuth', jsonb_build_object('username', 'manager', 'pin', 'secret-pin'),
          'teamManagerAssignments', jsonb_build_object('m1', jsonb_build_array('a1', 'a2')),
          'agentSecurity', jsonb_build_object('a1', jsonb_build_object('mfaRequired', true, 'totpUri', 'otpauth://totp/demo?secret=SECRET', 'authPasswordScheme', 'derived')),
          'agentsShadow', jsonb_build_array(jsonb_build_object('id', 'a1', 'name', 'Agent', 'pin', 'secret-pin'))
        ),
        '2026-11-15T21:00:00Z'::timestamptz
      ) as saved
    `);
    const body = JSON.stringify(saved.rows[0].saved);
    assert(body.includes('"ok":true') && body.includes('"key":"global"'), "a manager save is accepted");
    const stored = await db.query("select key, payload::text as payload from public.app_meta order by key");
    const globalRow = stored.rows.find((row) => row.key === "global");
    const versionRow = stored.rows.find((row) => row.key === "app_version");
    assert(globalRow.payload.includes("a2") && globalRow.payload.includes("mfaRequired"), "the accepted settings are stored");
    assert(!/secret-pin|otpauth|derived/.test(globalRow.payload), "a code, a barcode, and a password scheme are not stored");
    assert(versionRow.payload.includes('"version": "1"') || versionRow.payload.includes('"version":"1"'), "the version row stays");

    await db.exec("create or replace function public.gi_jwt_is_manager() returns boolean language sql stable as $$ select false $$");
    await db.exec("create or replace function public.gi_jwt_agent_id() returns text language sql stable as $$ select '' $$");
    const beforeDeny = globalRow.payload;
    const denied = await db.query(`
      select public.gi_app_settings_save(
        jsonb_build_object('updatedAt', '2026-11-15T22:00:00Z', 'adminAuth', jsonb_build_object('username', 'other'), 'marker', 'should-not-land'),
        '2026-11-15T22:00:00Z'::timestamptz
      ) as saved
    `);
    const afterDeny = await db.query("select payload::text as payload from public.app_meta where key = 'global'");
    assert(String(JSON.stringify(denied.rows[0].saved)).includes("NOT_ALLOWED"), "a blank agent id is refused");
    assert(afterDeny.rows[0].payload === beforeDeny, "a refused save does not change the row");

    await db.exec("set role anon");
    let blocked = "";
    try {
      await db.query("select public.gi_app_settings_save('{}'::jsonb, now())");
    } catch(err) {
      blocked = String(err && err.message || err);
    }
    await db.exec("reset role");
    assert(/permission denied/i.test(blocked), "the public key cannot call the function");
    await db.close();
  }

  {
    const db = new PGlite();
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/settings table is missing/.test(blocked), "a missing table saves nothing");
    const fn = await db.query("select count(*)::int as n from pg_proc where proname = 'gi_app_settings_save'");
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
