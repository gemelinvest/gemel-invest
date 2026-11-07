/**
 * Active accounts that still sign in with a username and a code are listed.
 * Accounts that already require a barcode stay off that list.
 * The result does not contain an address, a code, or an authenticator secret.
 * Run: node _test-list-code-only-accounts.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-list-code-only-accounts.sql"), "utf8");
const body = sql.replace(/--.*$/gm, "");

console.log("1) the check only reads");
assert(!/\b(insert|update|delete|truncate|alter|drop|create)\b/i.test(body), "no write statement");
assert(!/agents\.pin|totpUri|totpSecret|encrypted_password/i.test(sql), "codes and secrets are not read");
assert(sql.includes("not_required"), "a listed account is marked not required");
assert(sql.includes("inactive_skipped"), "inactive accounts are counted apart");

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
    create table public.agents (
      id text primary key,
      name text,
      username text,
      role text,
      email text,
      auth_user_id uuid,
      active boolean,
      pin text
    );
    create table public.app_meta (
      key text primary key,
      payload jsonb not null
    );
    insert into public.agents (id, name, username, role, email, auth_user_id, active, pin) values
      ('a_pin', 'חן מינץ', 'חן מינץ', 'referent', '', null, true, '9999'),
      ('a_mfa', 'חן מזרחי', 'חן מזרחי', 'agent', 'hidden.one@example.test', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, '8888'),
      ('a_both', 'נציג מעורב', 'נציג מעורב', 'agent', '', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true, '7777'),
      ('a_factor', 'עם גורם', 'עם גורם', 'agent', '', null, true, '6666'),
      ('a_text', 'דגל טקסט', 'דגל טקסט', 'agent', 'hidden.two@example.test', null, true, '5555'),
      ('a_dup_1', 'יוזר פנוי', 'יוזר אחד', 'agent', '', null, true, '4444'),
      ('a_dup_2', 'יוזר פנוי', 'יוזר שניים', 'ops', '', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true, '3333'),
      ('a_off', 'חשבון כבוי', 'חשבון כבוי', 'agent', 'hidden.off@example.test', null, false, '2222'),
      ('a_reset', 'ממתין לברקוד', 'ממתין לברקוד', 'agent', '', null, true, '1111');
    insert into public.app_meta (key, payload) values (
      'global',
      jsonb_build_object(
        'elementaryReferrals', jsonb_build_array(jsonb_build_object('id', 'ref-1')),
        'agentSecurity', jsonb_build_object(
          'a_mfa', jsonb_build_object('mfaRequired', true, 'authEmail', 'hidden.one@example.test', 'totpUri', 'otpauth://totp/demo?secret=DEMOSECRET'),
          'a_both', jsonb_build_object('pinOnlyLogin', true, 'mfaEnabled', true),
          'a_factor', jsonb_build_object('factorId', 'factor-1'),
          'a_text', jsonb_build_object('mfaRequired', 'true'),
          'a_dup_2', jsonb_build_object('authUserId', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
          'a_reset', jsonb_build_object('mfaResetPending', true),
          'a_off', jsonb_build_object('pinOnlyLogin', true)
        )
      )
    );
  `);

  const before = await db.query("select id, email, pin, active from public.agents order by id");
  const beforeMeta = await db.query("select payload from public.app_meta where key = 'global'");
  const report = await db.query(sql);
  const after = await db.query("select id, email, pin, active from public.agents order by id");
  const afterMeta = await db.query("select payload from public.app_meta where key = 'global'");
  assert(JSON.stringify(after.rows) === JSON.stringify(before.rows), "agent rows stayed");
  assert(JSON.stringify(afterMeta.rows) === JSON.stringify(beforeMeta.rows), "settings stayed");

  const shown = JSON.stringify(report.rows);
  assert(!shown.includes("@"), "no address is visible");
  assert(!/9999|8888|7777|6666|5555|4444|3333|2222|1111|DEMOSECRET|otpauth|factor-1/.test(shown), "no code or secret is visible");

  const counts = Object.fromEntries(report.rows.filter((row) => row.section === "count").map((row) => [row.name, row.detail]));
  assert(counts.active_accounts === "8", "eight active accounts are counted");
  assert(counts.code_only === "4", "four active accounts are still code only");
  assert(counts.barcode_required === "4", "four active accounts already require a barcode");
  assert(counts.inactive_skipped === "1", "the inactive account is not part of the work list");

  const accounts = report.rows.filter((row) => row.section === "account");
  const byId = Object.fromEntries(accounts.map((row) => [row.account_id, row]));
  assert(accounts.length === 4, "the work list has one row per code-only account");
  assert(byId.a_pin && byId.a_pin.name === "חן מינץ" && byId.a_pin.has_address === "no" && byId.a_pin.has_sign_in === "no" && byId.a_pin.authenticator === "not_required" && byId.a_pin.same_name === "no", "an account with no authenticator flag is listed");
  assert(byId.a_text && byId.a_text.has_address === "yes" && byId.a_text.authenticator === "not_required", "a text flag does not count as a required barcode");
  assert(byId.a_dup_1 && byId.a_dup_1.same_name === "yes" && byId.a_dup_1.has_sign_in === "no", "a shared name is marked");
  assert(byId.a_dup_2 && byId.a_dup_2.same_name === "yes" && byId.a_dup_2.has_sign_in === "yes" && byId.a_dup_2.role === "ops", "the other shared name keeps its own sign-in answer");
  assert(!byId.a_mfa && !byId.a_both && !byId.a_factor && !byId.a_reset && !byId.a_off, "barcode accounts and the inactive account stay off the list");
  await db.close();
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
