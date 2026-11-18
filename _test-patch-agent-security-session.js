/**
 * The small authenticator-status save requires a signed-in manager.
 * A missing session and a signed-in agent are refused. The public key
 * cannot execute it. The accepted fields stay the same.
 *
 * Run: node _test-patch-agent-security-session.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const root = __dirname;
const sql = fs.readFileSync(path.join(root, "supabase-gi-patch-agent-security-session.sql"), "utf8");
const oldSql = fs.readFileSync(path.join(root, "supabase-gi-patch-agent-security.sql"), "utf8");
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

console.log("1) the caller is a signed-in manager");
assert(Buffer.byteLength(sql) < 7800, "the whole file fits in the SQL editor");
assert(sql.trim().endsWith("order by sort_key;"), "the file ends with the result query");
assert(sql.includes("create or replace function public.gi_patch_agent_security(p_agent_id text, p_patch jsonb)"), "it replaces the same save");
assert(sql.includes("if auth.uid() is null then") && sql.includes("raise exception 'NO_SESSION'"), "a missing session is refused");
assert(sql.includes("gi_jwt_is_manager()") && sql.includes("raise exception 'NOT_ALLOWED'"), "a non-manager is refused");
assert(sql.includes("revoke all on function public.gi_patch_agent_security(text, jsonb) from public, anon"), "the public key cannot execute");
assert(!/grant execute on function public\.gi_patch_agent_security\(text, jsonb\) to anon/.test(sql), "the file does not grant the public key");
assert(sql.includes("grant execute on function public.gi_patch_agent_security(text, jsonb) to authenticated"), "a signed-in session can execute");
assert(sql.includes("rows_changed") && sql.includes("policies_changed"), "install checks that rows and policies stay");
assert(!/drop\s+policy|create\s+policy|delete\s+from\s+public\./i.test(sql), "it does not change policies or delete rows");
assert(oldSql.includes("supabase-gi-patch-agent-security-session.sql"), "the older file points at this one");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");

  const helpers = `
    create role anon nologin;
    create role authenticated nologin;
    create schema if not exists auth;
    create function auth.uid() returns uuid language sql stable as $$
      select '11111111-1111-4111-8111-111111111111'::uuid
    $$;
    create function public.gi_jwt_is_manager() returns boolean language sql stable as $$ select true $$;
    create table public.app_meta (
      key text primary key,
      payload jsonb not null,
      updated_at timestamptz
    );
    insert into public.app_meta(key, payload, updated_at) values
      ('global', '{"elementaryReferrals":[{"id":"ref-1"}],"agentSecurity":{"ag-1":{"mfaEnabled":true,"totpSecret":"old-secret"},"ag-2":{"mfaEnabled":false}}}'::jsonb, '2026-11-01T00:00:00Z'),
      ('app_version', '{"version":"20261101"}'::jsonb, '2026-11-01T00:00:00Z');
  `;

  {
    const db = new PGlite();
    await db.exec(helpers);
    const before = await db.query("select key, payload::text as payload, updated_at::text as updated_at from public.app_meta order by key");
    const out = await db.exec(sql);
    const report = out[out.length - 1].rows || [];
    const bySection = Object.fromEntries(report.map((row) => [row.section, row.detail]));
    const after = await db.query("select key, payload::text as payload, updated_at::text as updated_at from public.app_meta order by key");
    assert(JSON.stringify(after.rows) === JSON.stringify(before.rows), "install leaves every settings row");
    assert(bySection.function === "gi_patch_agent_security" && bySection.installed === "yes", "the function is installed");
    assert(bySection.caller === "signed_in_manager" && bySection.answer === "session_required", "the report says a manager session is required");
    assert(bySection.anon_execute === "no" && bySection.rows_changed === "no" && bySection.policies_changed === "no", "the public key is closed and nothing else moved");

    const priv = await db.query(`
      select
        has_function_privilege('anon', 'public.gi_patch_agent_security(text, jsonb)', 'execute') as anon_ok,
        has_function_privilege('authenticated', 'public.gi_patch_agent_security(text, jsonb)', 'execute') as signed_ok
    `);
    assert(priv.rows[0].anon_ok === false && priv.rows[0].signed_ok === true, "only a signed-in role can execute");

    const saved = await db.query(`
      select public.gi_patch_agent_security('ag-1', '{"mfaResetPending":true,"factorId":"factor-new"}'::jsonb) as result
    `);
    assert(saved.rows[0].result.ok === true, "a manager save is accepted");
    const stored = await db.query("select key, payload from public.app_meta order by key");
    const globalRow = stored.rows.find((row) => row.key === "global").payload;
    const versionRow = stored.rows.find((row) => row.key === "app_version").payload;
    assert(globalRow.elementaryReferrals[0].id === "ref-1", "referral data stays");
    assert(globalRow.agentSecurity["ag-2"].mfaEnabled === false, "the other account stays");
    assert(globalRow.agentSecurity["ag-1"].mfaResetPending === true && globalRow.agentSecurity["ag-1"].factorId === "factor-new", "the reset flags are stored");
    assert(globalRow.agentSecurity["ag-1"].totpSecret === undefined, "an old authenticator secret is removed");
    assert(versionRow.version === "20261101", "the version row stays");

    await db.exec("create or replace function public.gi_jwt_is_manager() returns boolean language sql stable as $$ select false $$");
    let denied = "";
    try {
      await db.query(`select public.gi_patch_agent_security('ag-1', '{"mfaEnabled":false}'::jsonb)`);
    } catch(err) {
      denied = String(err && err.message || err);
    }
    const afterDeny = await db.query("select payload from public.app_meta where key = 'global'");
    assert(denied.includes("NOT_ALLOWED"), "a signed-in agent is refused");
    assert(afterDeny.rows[0].payload.agentSecurity["ag-1"].mfaResetPending === true, "a refused save does not change the row");

    await db.exec(`
      create or replace function public.gi_jwt_is_manager() returns boolean language sql stable as $$ select true $$;
      create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    `);
    let missing = "";
    try {
      await db.query(`select public.gi_patch_agent_security('ag-1', '{"mfaEnabled":false}'::jsonb)`);
    } catch(err) {
      missing = String(err && err.message || err);
    }
    assert(missing.includes("NO_SESSION"), "a missing session is refused");

    await db.exec(`
      create or replace function auth.uid() returns uuid language sql stable as $$
        select '11111111-1111-4111-8111-111111111111'::uuid
      $$;
    `);
    await db.exec("set role anon");
    let blocked = "";
    try {
      await db.query(`select public.gi_patch_agent_security('ag-1', '{"mfaEnabled":false}'::jsonb)`);
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
    const fn = await db.query("select count(*)::int as n from pg_proc where proname = 'gi_patch_agent_security'");
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
