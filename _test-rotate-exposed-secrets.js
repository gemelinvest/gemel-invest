/**
 * Exposed-secret rotation: new admin PIN stays in the private table,
 * only the exposed TOTP accounts are reset, and session revoke is a
 * second script limited to those auth users.
 * Run: node _test-rotate-exposed-secrets.js
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
const rotateSql = fs.readFileSync(path.join(ROOT, "supabase-gi-rotate-exposed-secrets.sql"), "utf8");
const revokeSql = fs.readFileSync(path.join(ROOT, "supabase-gi-revoke-exposed-sessions.sql"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

function sliceFn(name){
  const start = app.indexOf("async function " + name);
  const next = app.indexOf("\n  async function ", start + 10);
  return start < 0 ? "" : app.slice(start, next === -1 ? start + 1800 : next);
}

console.log("1) stale cached PIN cannot override a server rejection");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js parses");
const usersGate = sliceFn("verifyUsersManagementPin");
const archiveGate = sliceFn("adminDestructivePinAccepted");
assert(usersGate.indexOf("verifyAdminPinForLogin") < usersGate.indexOf("adminAuth?.pin"), "users gate asks the server before the cached PIN");
assert(usersGate.includes("verified.source === 'server'"), "users gate treats a server rejection as final");
assert(archiveGate.indexOf("ARCHIVE_CUSTOMER_PIN") < archiveGate.indexOf("verifyAdminPinForLogin"), "archive code still works without the admin PIN");
assert(archiveGate.includes("verified.source === 'server'"), "archive rejects a PIN the server refused");
assert(archiveGate.indexOf("verified.source === 'server'") < archiveGate.indexOf("getCustomerAdminPinCandidates"), "cached archive PIN is only a fallback");
assert(app.includes("const deriveGiAuthPassword"), "password derivation stays");
assert(app.includes('client.rpc("gi_verify_agent_login"'), "agent PIN login stays");
assert(html.includes("giPinServer=1"), "app.js cache key bumped");
assert(sw.includes("pin-server-v1"), "service worker cache key bumped");

console.log("\n2) SQL rotates only the exposed set and does not embed a PIN");
assert(!/pin['"]?\s*[:=]\s*'?\d{4,8}'/.test(rotateSql), "section 1 does not contain a PIN literal");
assert(rotateSql.includes("gi_app_secrets"), "section 1 writes the private table");
assert(!/update public\.app_meta[\s\S]*adminAuth/.test(rotateSql), "section 1 does not write the admin PIN into app_meta");
assert(rotateSql.includes("mfaResetPending"), "exposed agents are marked for a new barcode");
assert(rotateSql.includes("delete from auth.mfa_factors"), "exposed factors are removed");
assert(!/delete from auth\.sessions/.test(rotateSql), "section 1 does not log anyone out");
assert(rotateSql.includes("exposed_totp_reset"), "section 1 records who section 2 may revoke");
assert(rotateSql.includes("section 1 already ran"), "section 1 refuses a second rotation");
assert(revokeSql.includes("user_id::text in (select id::text from unnest(ids) as id)"), "section 2 matches text and uuid user ids");
assert((revokeSql.match(/unnest\(ids\)/g) || []).length >= 2, "both session tables use the recorded id list");
assert(!/delete from auth\.sessions\s*;/.test(revokeSql), "section 2 does not delete every session");
assert(revokeSql.includes("section 1 has not been run"), "section 2 refuses to run first");
assert(!revokeSql.includes("deriveGiAuthPassword"), "section 2 does not touch password derivation");

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";
const U3 = "33333333-3333-3333-3333-333333333333";
const UA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const F1 = "11111111-1111-4111-8111-111111111111";
const F2 = "22222222-2222-4222-8222-222222222222";
const F3 = "33333333-3333-4333-8333-333333333333";
const FA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const S1 = "11111111-1111-4111-8111-111111111112";
const S3 = "33333333-3333-4333-8333-333333333332";
const SA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab";

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n3) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n3) database fixture");
  const splitSql = fs.readFileSync(path.join(ROOT, "supabase-gi-app-meta-secret-split.sql"), "utf8");
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema if not exists auth;
    create table auth.users (id uuid primary key, email text);
    create table auth.mfa_factors (
      id uuid primary key,
      user_id uuid not null references auth.users(id),
      factor_type text,
      status text,
      secret text
    );
    create table auth.mfa_challenges (
      id uuid primary key,
      factor_id uuid not null references auth.mfa_factors(id) on delete cascade
    );
    create table auth.sessions (
      id uuid primary key,
      user_id uuid not null references auth.users(id),
      factor_id uuid references auth.mfa_factors(id)
    );
    create table auth.refresh_tokens (
      id bigint generated always as identity primary key,
      user_id varchar,
      session_id uuid references auth.sessions(id) on delete cascade,
      revoked boolean not null default false,
      token text
    );
    create table public.agents (
      id text primary key,
      name text,
      username text,
      pin text,
      auth_user_id uuid
    );
    create table public.app_meta (
      key text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    );
    insert into public.app_meta (key, payload) values (
      'global',
      jsonb_build_object(
        'adminAuth', jsonb_build_object('username', 'מנהל בדיקה', 'pin', '1357', 'active', true),
        'teamManagerAssignments', jsonb_build_object('a3', 'tm_keep'),
        'agentSecurity', jsonb_build_object(
          'a1', jsonb_build_object(
            'authEmail', 'a1@example.test',
            'authPasswordScheme', 'gi-v1',
            'mfaEnabled', true,
            'factorId', 'factor-1',
            'pinOnlyLogin', false,
            'totpUri', 'otpauth://totp/demo?secret=DEMOSECRET1',
            'totpQrHtml', '<svg>one</svg>'
          ),
          'a2', jsonb_build_object(
            'authEmail', 'a2@example.test',
            'mfaEnabled', true,
            'factorId', 'factor-2',
            'totpUri', 'otpauth://totp/demo?secret=DEMOSECRET2'
          )
        )
      )
    );
  `);
  await db.exec(splitSql);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${U1}', 'a1@example.test'),
      ('${U2}', 'a2@example.test'),
      ('${U3}', 'a3@example.test'),
      ('${UA}', 'admin@example.test');
    insert into auth.mfa_factors (id, user_id, factor_type, status, secret) values
      ('${F1}', '${U1}', 'totp', 'verified', 'secret-one'),
      ('${F2}', '${U2}', 'totp', 'verified', 'secret-two'),
      ('${F3}', '${U3}', 'totp', 'verified', 'secret-keep'),
      ('${FA}', '${UA}', 'totp', 'verified', 'secret-admin');
    insert into auth.mfa_challenges (id, factor_id) values
      ('${F1}', '${F1}');
    insert into auth.sessions (id, user_id, factor_id) values
      ('${S1}', '${U1}', '${F1}'),
      ('${S3}', '${U3}', '${F3}'),
      ('${SA}', '${UA}', '${FA}');
    insert into auth.refresh_tokens (user_id, session_id, token) values
      ('${U1}', '${S1}', 'tok-1'),
      ('${U3}', '${S3}', 'tok-3'),
      ('${UA}', '${SA}', 'tok-admin');
    insert into public.agents (id, name, username, pin, auth_user_id) values
      ('a1', 'נציג אחד', 'agent1', '1111', '${U1}'),
      ('a2', 'נציג שתיים', 'agent2', '2222', '${U2}'),
      ('a3', 'נציג אחר', 'agent3', '3333', '${U3}'),
      ('admin', 'מנהל בדיקה', 'מנהל בדיקה', '9999', '${UA}');
    update public.app_meta
       set payload = jsonb_set(
         payload,
         '{agentSecurity,a3}',
         '{"authEmail":"a3@example.test","mfaEnabled":true,"factorId":"factor-3","mfaRequired":true}'::jsonb,
         true
       )
     where key = 'global';
  `);

  const early = new PGlite();
  await early.exec(`
    create table public.gi_app_secrets (
      key text primary key,
      value jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
  `);
  let refused = false;
  try {
    await early.exec(revokeSql);
  } catch(err) {
    refused = /section 1 has not been run/.test(String(err && err.message || err));
  }
  assert(refused, "section 2 refuses to run before section 1");

  await db.exec(rotateSql);
  const report = await db.query("select kind, agent_id, agent_name, detail from gi_rotate_result");
  const pinRow = report.rows.find((row) => row.kind === "new_admin_pin");
  assert(!!pinRow && /^\d{6}$/.test(pinRow.detail) && pinRow.detail !== "1357", "section 1 returns a new 6-digit PIN");
  assert(!report.rows.some((row) => /otpauth|DEMOSECRET|secret-/.test(JSON.stringify(row))), "the result does not contain TOTP material");

  const secret = await db.query("select value from public.gi_app_secrets where key = 'admin_auth'");
  assert(secret.rows[0].value.pin === pinRow.detail, "private table stores that PIN");
  assert(!secret.rows[0].value.pin.includes("1357"), "old PIN is gone from the private table");

  const payload = (await db.query("select payload from public.app_meta where key = 'global'")).rows[0].payload;
  assert(!payload.adminAuth.pin, "readable row still has no PIN");
  assert(payload.adminAuth.username === "מנהל בדיקה", "admin username stays readable");
  assert(payload.teamManagerAssignments.a3 === "tm_keep", "unrelated meta stays");
  assert(payload.agentSecurity.a1.mfaResetPending === true, "exposed agent is pending a new barcode");
  assert(payload.agentSecurity.a1.mfaEnabled === false, "exposed agent is not left on the dead factor");
  assert(payload.agentSecurity.a1.factorId === "", "exposed factor id is cleared");
  assert(payload.agentSecurity.a1.totpUri == null, "exposed URI is not written back");
  assert(payload.agentSecurity.a2.mfaResetPending === true, "second exposed agent is reset");
  assert(payload.agentSecurity.a3.mfaEnabled === true && payload.agentSecurity.a3.factorId === "factor-3", "unrelated agent flags stay");
  assert(payload.agentSecurity.a3.mfaResetPending == null, "unrelated agent is not forced to re-enroll");

  const totpLeft = await db.query("select value from public.gi_app_secrets where key = 'agent_totp'");
  assert(JSON.stringify(totpLeft.rows[0].value) === "{}", "private TOTP copies are cleared");
  const marker = await db.query("select value from public.gi_app_secrets where key = 'exposed_totp_reset'");
  const ids = marker.rows[0].value.agentIds;
  assert(ids.includes("a1") && ids.includes("a2") && !ids.includes("a3") && !ids.includes("admin"), "reset list is only the exposed agents");
  assert(!JSON.stringify(marker.rows[0].value).includes("otpauth"), "reset list has no TOTP material");

  const factors = await db.query("select user_id::text as user_id from auth.mfa_factors order by user_id");
  const factorUsers = factors.rows.map((row) => row.user_id);
  assert(!factorUsers.includes(U1) && !factorUsers.includes(U2), "exposed factors are deleted");
  assert(factorUsers.includes(U3) && factorUsers.includes(UA), "other factors stay, including the admin barcode");
  const sessions = await db.query("select id::text as id from auth.sessions order by id");
  assert(sessions.rows.map((row) => row.id).sort().join() === [S1, S3, SA].sort().join(), "section 1 keeps every session");
  const pins = await db.query("select id, pin from public.agents order by id");
  assert(pins.rows.map((row) => row.id + ":" + row.pin).join() === "a1:1111,a2:2222,a3:3333,admin:9999", "agent PINs are not rotated");

  const verify = await db.query(
    "select public.gi_verify_admin_login('מנהל בדיקה', $1) as good, public.gi_verify_admin_login('מנהל בדיקה', '1357') as old",
    [pinRow.detail]
  );
  assert(verify.rows[0].good.ok === true && verify.rows[0].old.ok === false, "new PIN verifies and the old PIN does not");
  assert(verify.rows[0].good.pin == null && verify.rows[0].old.pin == null, "verifier still does not return the PIN");

  let second = false;
  try {
    await db.exec(rotateSql);
  } catch(err) {
    second = /section 1 already ran/.test(String(err && err.message || err));
  }
  assert(second, "running section 1 again is rejected");
  const pinAfter = await db.query("select value->>'pin' as pin from public.gi_app_secrets where key = 'admin_auth'");
  assert(pinAfter.rows[0].pin === pinRow.detail, "the rejected re-run does not change the PIN");

  await db.exec(revokeSql);
  const leftSessions = await db.query("select id::text as id, user_id::text as user_id from auth.sessions");
  assert(leftSessions.rows.length === 1 && leftSessions.rows[0].user_id === U3, "section 2 deletes only the recorded sessions");
  const tokens = await db.query("select user_id::text as user_id, revoked from auth.refresh_tokens order by user_id");
  assert(tokens.rows.length === 1 && tokens.rows[0].user_id === U3 && tokens.rows[0].revoked === false, "the unrelated refresh token stays valid");
  const keptFactor = await db.query("select count(*)::int as n from auth.mfa_factors where user_id = $1", [U3]);
  assert(keptFactor.rows[0].n === 1, "section 2 does not remove the unrelated factor");
}

runDatabase().then(() => {
  if(failed){
    console.error("\n" + failed + " failed");
    process.exit(1);
  }
  console.log("\nall passed");
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
