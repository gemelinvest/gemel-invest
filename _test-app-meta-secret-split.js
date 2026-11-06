/**
 * Finding 2 containment: admin PIN and TOTP material leave the client-readable
 * app_meta row. Operational keys stay. Login still resolves through the server.
 * Run: node _test-app-meta-secret-split.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
let failed = 0;

function assert(cond, msg){
  if(cond){
    console.log("  PASS  " + msg);
  } else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-app-meta-secret-split.sql"), "utf8");
const provision = fs.readFileSync(path.join(ROOT, "supabase/functions/gi-provision-agent-auth/index.ts"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) client still logs in, without requiring the PIN in the row");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js parses");
assert(app.includes('client.rpc("gi_verify_admin_login"'), "admin login calls the server");
assert(app.includes("async function verifyAdminPinForLogin"), "admin verifier exists");
assert(app.includes('source:"local"'), "pre-migration local PIN fallback remains");
assert(/verifiedAdmin\.ok/.test(app), "login uses the server result");
assert(app.includes("adminDestructivePinAccepted"), "archive and purge still accept the admin PIN");
assert(app.includes("const deriveGiAuthPassword"), "password derivation was not removed in this slice");
assert(app.includes('client.rpc("gi_verify_agent_login"'), "agent PIN login RPC unchanged");
assert(html.includes("giMetaSecret=1"), "app.js cache key bumped");
assert(sw.includes("meta-secret-v1"), "service worker cache key bumped");
assert(app.includes("adminAuth: state?.meta?.adminAuth"), "operational adminAuth object still saved");
assert(app.includes("teamManagerAssignments"), "team assignment meta still in the client");

console.log("\n2) SQL hides secrets and leaves the rest of the row");
assert(sql.includes("create table if not exists public.gi_app_secrets"), "private secret table");
assert(/revoke all on table public\.gi_app_secrets from public, anon, authenticated/.test(sql), "no client grant on secrets");
assert(sql.includes("enable row level security"), "RLS on the secret table only");
assert(!/revoke all on table public\.app_meta/.test(sql), "app_meta grants are not cut in this slice");
assert(sql.includes("gi_strip_app_meta_payload"), "payload stripper");
assert(sql.includes("- 'totpUri'"), "TOTP URI is removed");
assert(sql.includes("- 'pin'"), "admin PIN key is removed");
assert(!/'pin',\s*stored_pin/.test(sql), "verify response does not return the PIN");
assert(sql.includes("'ok', true, 'name', stored_user"), "verify returns name only");
assert(sql.includes("grant execute on function public.gi_verify_admin_login"), "login can call the verifier");
assert(sql.indexOf("insert into public.gi_app_secrets") < sql.indexOf("create trigger trg_gi_strip_app_meta_secrets"), "copy happens before the strip trigger");
assert(sql.includes("where coalesce(excluded.value->>'pin', '') <> ''"), "re-run does not blank a stored PIN");
assert(provision.includes("gi_app_secrets"), "provision reads the private admin record");
assert(provision.includes("payload.adminAuth"), "provision still falls back until the SQL is applied");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n3) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n3) database fixture");
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create table public.app_meta (
      key text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    );
    insert into public.app_meta (key, payload) values (
      'global',
      '{
        "adminAuth": {"username": "מנהל בדיקה", "pin": "1357", "active": true},
        "teamManagerAssignments": {"a_1": "tm_1"},
        "companyDiscountOverrides": {"demo": 10},
        "agentSecurity": {
          "a_1": {
            "authEmail": "agent@example.test",
            "authPasswordScheme": "gi-v1",
            "mfaEnabled": true,
            "factorId": "factor-1",
            "pinOnlyLogin": false,
            "totpUri": "otpauth://totp/demo?secret=DEMOSECRET",
            "totpQrHtml": "<svg>qr</svg>"
          }
        }
      }'::jsonb
    );
    insert into public.app_meta (key, payload) values (
      'other',
      '{"teamManagerAssignments":{"keep":"yes"}}'::jsonb
    );
  `);
  await db.exec(sql);

  const row = await db.query("select payload from public.app_meta where key = 'global'");
  const payload = row.rows[0].payload;
  assert(!payload.adminAuth.pin, "readable row has no admin PIN");
  assert(payload.adminAuth.username === "מנהל בדיקה", "admin username stays");
  assert(payload.teamManagerAssignments.a_1 === "tm_1", "team assignments stay");
  assert(payload.companyDiscountOverrides.demo === 10, "discount settings stay");
  const sec = payload.agentSecurity.a_1;
  assert(sec.totpUri == null && sec.totpQrHtml == null, "TOTP material left the readable row");
  assert(sec.authEmail === "agent@example.test", "auth email flag stays for login");
  assert(sec.mfaEnabled === true && sec.factorId === "factor-1", "MFA flags stay");
  assert(sec.pinOnlyLogin === false, "pinOnlyLogin stays");

  const other = await db.query("select payload from public.app_meta where key = 'other'");
  assert(other.rows[0].payload.teamManagerAssignments.keep === "yes", "unrelated meta row unchanged");

  const secret = await db.query("select value from public.gi_app_secrets where key = 'admin_auth'");
  assert(secret.rows[0].value.pin === "1357", "private table kept the PIN");
  const totp = await db.query("select value from public.gi_app_secrets where key = 'agent_totp'");
  assert(totp.rows[0].value.a_1.totpUri.includes("DEMOSECRET"), "private table kept the TOTP URI");

  const ok = await db.query("select public.gi_verify_admin_login($1, $2) as result", ["מנהל בדיקה", "1357"]);
  assert(ok.rows[0].result.ok === true, "correct PIN verifies");
  assert(ok.rows[0].result.name === "מנהל בדיקה", "verify returns the name");
  assert(ok.rows[0].result.pin == null, "verify does not return the PIN");
  const bad = await db.query("select public.gi_verify_admin_login($1, $2) as result", ["מנהל בדיקה", "0000"]);
  assert(bad.rows[0].result.ok === false, "wrong PIN is rejected");

  await db.exec(`
    update public.app_meta
       set payload = jsonb_set(payload, '{adminAuth,pin}', '"9999"'::jsonb, true)
     where key = 'global';
  `);
  const rewritten = await db.query("select payload->'adminAuth' as admin from public.app_meta where key = 'global'");
  assert(rewritten.rows[0].admin.pin == null, "a later write cannot put the PIN back");
  const still = await db.query("select value->>'pin' as pin from public.gi_app_secrets where key = 'admin_auth'");
  assert(still.rows[0].pin === "1357", "write-back does not replace the stored PIN");

  await db.exec(sql);
  const rerun = await db.query("select value->>'pin' as pin from public.gi_app_secrets where key = 'admin_auth'");
  assert(rerun.rows[0].pin === "1357", "running the SQL again keeps the stored PIN");

  let denied = false;
  try {
    await db.exec("set role anon; select * from public.gi_app_secrets;");
  } catch(_e) {
    denied = true;
  }
  await db.exec("reset role");
  assert(denied, "anon cannot read the secret table");
  await db.close();
}

runDatabase().then(() => {
  if(failed){
    console.error("\nFAILED " + failed);
    process.exit(1);
  }
  console.log("\nOK _test-app-meta-secret-split.js");
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
