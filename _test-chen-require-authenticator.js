/**
 * One account is switched from code-only login to authenticator login.
 * The address is not stored in the script and is not returned.
 * Run: node _test-chen-require-authenticator.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-chen-require-authenticator.sql"), "utf8");
console.log("1) the script stays on one account");
assert(sql.includes("a_42b897c014fd4_1a0a94d314a"), "targets one agent id");
assert(!/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(sql), "no address is written in the file");
assert(/sign-in address is not ready/.test(sql), "refuses to switch before the sign-in address matches");
assert(!/GiCrm!|encrypted_password/.test(sql), "does not touch passwords");

const CHEN = "5a22aa9e-0520-465a-83a3-8b0bd7291c37";

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");
  const db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (
      id uuid primary key,
      email text
    );
    create table public.agents (
      id text primary key,
      name text,
      email text,
      pin text,
      active boolean
    );
    create table public.app_meta (
      key text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    );
    insert into auth.users (id, email) values
      ('${CHEN}', 'chen.user@example.test');
    insert into public.agents (id, name, email, pin, active) values
      ('a_42b897c014fd4_1a0a94d314a', 'חן מזרחי', 'Chen.User@Example.test', '1111', true),
      ('a_other', 'נציג אחר', 'other@example.test', '2222', true);
    insert into public.app_meta (key, payload) values (
      'global',
      jsonb_build_object(
        'agentSecurity',
        jsonb_build_object(
          'a_42b897c014fd4_1a0a94d314a',
          jsonb_build_object('pinOnlyLogin', true, 'mfaRequired', false, 'authEmail', ''),
          'a_other',
          jsonb_build_object('pinOnlyLogin', true, 'mfaRequired', false, 'authEmail', '')
        )
      )
    );
  `);

  await db.exec(sql);
  const report = await db.query("select kind, detail from gi_mfa_result order by kind");
  const shown = report.rows.map((row) => row.kind + "=" + row.detail).join();
  assert(shown === "authenticator=required,other_accounts=unchanged,pin_only=off", "reports the switch without an address");
  assert(!JSON.stringify(report.rows).includes("@"), "the result has no address");
  const sec = await db.query("select payload->'agentSecurity' as sec from public.app_meta where key = 'global'");
  const map = sec.rows[0].sec;
  assert(map["a_42b897c014fd4_1a0a94d314a"].pinOnlyLogin === false, "code-only login is off for this account");
  assert(map["a_42b897c014fd4_1a0a94d314a"].mfaRequired === true, "the authenticator is required");
  assert(map["a_42b897c014fd4_1a0a94d314a"].authEmail === "chen.user@example.test", "the saved address matches the sign-in account");
  assert(map.a_other.pinOnlyLogin === true && map.a_other.mfaRequired === false, "another account stays on code login");
  const pin = await db.query("select pin from public.agents where id = 'a_42b897c014fd4_1a0a94d314a'");
  assert(pin.rows[0].pin === "1111", "his code stays the same");

  const blocked = new PGlite();
  await blocked.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key, email text);
    create table public.agents (id text primary key, name text, email text, pin text, active boolean);
    create table public.app_meta (key text primary key, payload jsonb not null, updated_at timestamptz not null default now());
    insert into auth.users (id, email) values ('${CHEN}', '');
    insert into public.agents (id, name, email, pin, active) values
      ('a_42b897c014fd4_1a0a94d314a', 'חן מזרחי', 'chen.user@example.test', '1111', true);
    insert into public.app_meta (key, payload) values ('global', '{"agentSecurity":{}}'::jsonb);
  `);
  let refused = false;
  try {
    await blocked.exec(sql);
  } catch(err) {
    refused = /sign-in address is not ready/.test(String(err && err.message || err));
  }
  assert(refused, "an empty sign-in address blocks the switch");
  const still = await blocked.query("select payload->'agentSecurity' as sec from public.app_meta where key = 'global'");
  assert(Object.keys(still.rows[0].sec).length === 0, "a refused run changes no account");
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
