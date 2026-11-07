/**
 * יוזר אלמנטרי keeps the existing sign-in link, gains one address, and must
 * scan a barcode. Every other account stays put. The address is not printed.
 * Run: node _test-link-elementary-user-auth.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-link-elementary-user-auth.sql"), "utf8");
const lockSql = fs.readFileSync(path.join(ROOT, "supabase-gi-lock-auth-identity.sql"), "utf8");
const TARGET = "a_652af5403ef9f8_19e310e4c90";
const OTHER = "a_0";
const TARGET_USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_USER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const JSON_USER = "cccccccc-cccc-cccc-cccc-cccccccccccc";

console.log("1) the script stays on one account");
assert(sql.includes(TARGET), "targets this account id");
assert(sql.includes("יוזר אלמנטרי"), "targets this account name");
assert(sql.includes("elementary"), "targets the elementary role");
assert(!sql.includes("insert into auth.users"), "does not create a second sign-in account");
assert(sql.includes("address_printed"), "the result does not print the address");
assert(!/GiCrm!|gen_random_bytes|set pin|agents\.pin\s*=/.test(sql), "does not rewrite a code");
assert(!sql.includes(OTHER), "does not name another account as a target");

const SCHEMA = `
  create role service_role;
  create schema if not exists auth;
  create table auth.users (
    instance_id uuid,
    id uuid primary key,
    aud text,
    role text,
    email text,
    encrypted_password text,
    email_confirmed_at timestamptz,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    confirmation_token text,
    recovery_token text,
    email_change_token_new text,
    email_change text,
    email_change_token_current text,
    phone_change text,
    phone_change_token text,
    reauthentication_token text
  );
  create table auth.identities (
    id uuid primary key,
    user_id uuid not null,
    identity_data jsonb,
    provider text,
    provider_id text,
    last_sign_in_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
  );
  create table auth.mfa_factors (
    id uuid primary key,
    user_id uuid,
    status text,
    factor_type text
  );
  create table public.agents (
    id text primary key,
    name text,
    role text,
    email text,
    auth_user_id uuid,
    active boolean,
    pin text,
    updated_at timestamptz
  );
  create table public.app_meta (
    key text primary key,
    payload jsonb not null,
    updated_at timestamptz not null default now()
  );
`;

async function openDb(){
  const { PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite");
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(lockSql);
  return db;
}

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  void PGlite;
  console.log("\n2) existing sign-in link");
  const db = await openDb();
  const expected = "agent+" + TARGET.toLowerCase().replace(/[^a-z0-9]/g, "") + "@gemel-invest.internal";
  await db.exec(`
    insert into auth.users (id, email, encrypted_password, confirmation_token, raw_app_meta_data) values
      ('${TARGET_USER}', null, 'keep-me', '', jsonb_build_object('agent_id', '${TARGET}')),
      ('${OTHER_USER}', 'other.user@example.test', 'keep-other', '', jsonb_build_object('agent_id', '${OTHER}'));
    insert into auth.identities (id, user_id, identity_data, provider, provider_id) values
      ('dddddddd-dddd-dddd-dddd-dddddddddddd', '${TARGET_USER}', '{}'::jsonb, 'email', '${TARGET_USER}');
    insert into public.agents (id, name, role, email, auth_user_id, active, pin) values
      ('${TARGET}', 'יוזר אלמנטרי', 'elementary', '', '${TARGET_USER}', true, '1111'),
      ('${OTHER}', 'יובל מנדלסון', 'agent', '', '${OTHER_USER}', true, '2222');
    insert into public.app_meta (key, payload) values (
      'global',
      jsonb_build_object(
        'elementaryReferrals', jsonb_build_array(jsonb_build_object('id', 'ref-1')),
        'agentSecurity', jsonb_build_object(
          '${TARGET}', jsonb_build_object('pinOnlyLogin', true, 'totpUri', 'otpauth://secret'),
          '${OTHER}', jsonb_build_object('pinOnlyLogin', true, 'authEmail', 'other.user@example.test')
        )
      )
    );
  `);
  const beforeOther = await db.query("select email, auth_user_id, pin, role from public.agents where id = $1", [OTHER]);
  await db.exec(sql);
  const report = await db.query("select kind, detail from gi_link_account_result order by kind");
  const shown = report.rows.map((row) => row.kind + "=" + row.detail).join();
  assert(shown === "account=linked,address_printed=no,authenticator=required,other_accounts=unchanged", "result says linked, required, and no address");
  assert(!/@/.test(shown), "the visible result has no address");

  const target = await db.query("select email, auth_user_id, pin from public.agents where id = $1", [TARGET]);
  const auth = await db.query("select email, encrypted_password, email_confirmed_at, raw_app_meta_data from auth.users where id = $1", [TARGET_USER]);
  assert(target.rows[0].auth_user_id === TARGET_USER, "the original sign-in link stayed");
  assert(target.rows[0].email === expected, "the account now has the internal address");
  assert(auth.rows[0].email === expected, "the sign-in account has the same address");
  assert(auth.rows[0].encrypted_password === "keep-me", "the existing sign-in secret was not replaced");
  assert(auth.rows[0].raw_app_meta_data.role === "elementary", "the sign-in role stays elementary");
  assert(target.rows[0].pin === "1111", "the login code stayed");

  const payload = (await db.query("select payload from public.app_meta where key = 'global'")).rows[0].payload;
  const sec = payload.agentSecurity[TARGET];
  assert(sec.mfaRequired === true && sec.mfaEnabled === false && sec.pinOnlyLogin === false, "a new barcode is required");
  assert(sec.authEmail === expected && sec.authUserId === TARGET_USER, "the security row points at the same sign-in");
  assert(sec.totpUri == null, "the saved barcode secret was removed from settings");
  assert(payload.agentSecurity[OTHER].pinOnlyLogin === true && payload.agentSecurity[OTHER].authEmail === "other.user@example.test", "the other security row stayed");
  assert(payload.elementaryReferrals[0].id === "ref-1", "referrals stayed");
  const afterOther = await db.query("select email, auth_user_id, pin, role from public.agents where id = $1", [OTHER]);
  assert(JSON.stringify(afterOther.rows[0]) === JSON.stringify(beforeOther.rows[0]), "the other account row stayed");

  let second = false;
  try {
    await db.exec(sql);
  } catch(err) {
    second = /already has an address/.test(String(err && err.message));
  }
  assert(second, "running it again changes nothing");
  await db.close();

  console.log("\n3) link stored only in settings");
  const jsonDb = await openDb();
  await jsonDb.exec(`
    insert into auth.users (id, email, encrypted_password, confirmation_token, raw_app_meta_data) values
      ('${JSON_USER}', null, 'keep-json', '', '{}'::jsonb);
    insert into public.agents (id, name, role, email, auth_user_id, active, pin) values
      ('${TARGET}', 'יוזר אלמנטרי', 'elementary', '', null, true, '1111');
    insert into public.app_meta (key, payload) values (
      'global',
      jsonb_build_object('agentSecurity', jsonb_build_object(
        '${TARGET}', jsonb_build_object('authUserId', '${JSON_USER}')
      ))
    );
  `);
  await jsonDb.exec(sql);
  const linked = await jsonDb.query("select auth_user_id from public.agents where id = $1", [TARGET]);
  assert(linked.rows[0].auth_user_id === JSON_USER, "the settings link is written onto the account");
  await jsonDb.close();

  console.log("\n4) an existing address is kept private");
  const mailDb = await openDb();
  await mailDb.exec(`
    insert into auth.users (id, email, encrypted_password, confirmation_token, raw_app_meta_data) values
      ('${TARGET_USER}', null, 'keep-mail', '', '{}'::jsonb);
    insert into public.agents (id, name, role, email, auth_user_id, active, pin) values
      ('${TARGET}', 'יוזר אלמנטרי', 'elementary', '', '${TARGET_USER}', true, '1111');
    update auth.users set email = 'hidden.person@example.test' where id = '${TARGET_USER}';
    insert into public.app_meta (key, payload) values (
      'global', jsonb_build_object('agentSecurity', '{}'::jsonb)
    );
  `);
  await mailDb.exec(sql);
  const privateReport = await mailDb.query("select detail from gi_link_account_result");
  const privateShown = privateReport.rows.map((row) => row.detail).join();
  const copied = await mailDb.query("select email from public.agents where id = $1", [TARGET]);
  const secret = await mailDb.query("select encrypted_password from auth.users where id = $1", [TARGET_USER]);
  assert(copied.rows[0].email === "hidden.person@example.test", "the existing sign-in address is reused");
  assert(!privateShown.includes("@"), "that address is not in the result");
  assert(secret.rows[0].encrypted_password === "keep-mail", "the existing sign-in secret stayed");
  await mailDb.close();

  console.log("\n5) a shared sign-in stops the script");
  const shared = await openDb();
  await shared.exec(`
    insert into auth.users (id, email, encrypted_password, confirmation_token) values
      ('${TARGET_USER}', null, 'keep-shared', '');
    insert into public.agents (id, name, role, email, auth_user_id, active, pin) values
      ('${TARGET}', 'יוזר אלמנטרי', 'elementary', '', '${TARGET_USER}', true, '1111'),
      ('${OTHER}', 'יובל מנדלסון', 'agent', '', '${TARGET_USER}', true, '2222');
    insert into public.app_meta (key, payload) values (
      'global', jsonb_build_object('agentSecurity', '{}'::jsonb)
    );
  `);
  let blocked = false;
  try {
    await shared.exec(sql);
  } catch(err) {
    blocked = /another account uses this sign-in/.test(String(err && err.message));
  }
  const stillEmpty = await shared.query("select email from public.agents where id = $1", [TARGET]);
  assert(blocked, "a shared sign-in is refused");
  assert(stillEmpty.rows[0].email == null || stillEmpty.rows[0].email === "", "the refused run saved nothing");
  await shared.close();
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
