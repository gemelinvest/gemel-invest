/**
 * The vacant test account keeps its existing sign-in link, gains one address,
 * and is required to scan. The other account with the same name stays put.
 * Run: node _test-link-vacant-test-account.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-link-vacant-test-account.sql"), "utf8");
const lockSql = fs.readFileSync(path.join(ROOT, "supabase-gi-lock-auth-identity.sql"), "utf8");
const TARGET = "a_6b3a63ce13bda_1a0a48aec42";
const OTHER = "a_504a67126e406_19d8ae66366";
const TARGET_USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_USER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

console.log("1) the script uses the existing link");
assert(sql.includes(TARGET), "targets the vacant account");
assert(sql.includes(OTHER), "names the other account so it can be compared");
assert(sql.includes("this account has no sign-in link"), "refuses an account with no link");
assert(!sql.includes("insert into auth.users"), "does not create a second sign-in account");
assert(sql.includes("address_printed"), "the result does not print the address");
assert(!/GiCrm!|gen_random_bytes|agents\.pin/.test(sql), "does not rewrite a password or a code");

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
    insert into auth.users (id, email, encrypted_password, confirmation_token, raw_app_meta_data) values
      ('${TARGET_USER}', null, 'keep-me', '', jsonb_build_object('agent_id', '${TARGET}')),
      ('${OTHER_USER}', 'other.user@example.test', 'keep-other', '', jsonb_build_object('agent_id', '${OTHER}'));
    insert into auth.identities (id, user_id, identity_data, provider, provider_id) values
      ('cccccccc-cccc-cccc-cccc-cccccccccccc', '${TARGET_USER}', '{}'::jsonb, 'email', '${TARGET_USER}');
    insert into public.agents (id, name, email, auth_user_id, active, pin) values
      ('${TARGET}', 'יוזר פנוי', '', '${TARGET_USER}', true, '1111'),
      ('${OTHER}', 'יוזר פנוי', '', '${OTHER_USER}', true, '2222');
    insert into public.app_meta (key, payload) values (
      'global',
      jsonb_build_object(
        'elementaryReferrals', jsonb_build_array(jsonb_build_object('id', 'ref-1')),
        'agentSecurity', jsonb_build_object(
          '${TARGET}', jsonb_build_object('pinOnlyLogin', false),
          '${OTHER}', jsonb_build_object('mfaEnabled', true, 'authEmail', 'other.user@example.test')
        )
      )
    );
  `);
  await db.exec(lockSql);

  const beforeOther = await db.query("select email, auth_user_id, pin from public.agents where id = $1", [OTHER]);
  await db.exec(sql);
  const report = await db.query("select kind, detail from gi_link_account_result order by kind");
  const shown = report.rows.map((row) => row.kind + "=" + row.detail).join();
  assert(shown === "account=linked,address_printed=no,authenticator=required,other_accounts=unchanged", "result says linked, required, and no address");
  assert(!/@/.test(shown), "the visible result has no address");

  const target = await db.query("select email, auth_user_id, pin from public.agents where id = $1", [TARGET]);
  const auth = await db.query("select email, encrypted_password, email_confirmed_at from auth.users where id = $1", [TARGET_USER]);
  const expected = "agent+" + TARGET.toLowerCase().replace(/[^a-z0-9]/g, "") + "@gemel-invest.internal";
  assert(target.rows[0].auth_user_id === TARGET_USER, "the original sign-in link stayed");
  assert(target.rows[0].email === expected, "the account now has the internal address");
  assert(auth.rows[0].email === expected, "the sign-in account has the same address");
  assert(auth.rows[0].encrypted_password === "keep-me", "the existing sign-in secret was not replaced");
  assert(auth.rows[0].email_confirmed_at != null, "the address is confirmed");
  assert(target.rows[0].pin === "1111", "the login code stayed");

  const payload = (await db.query("select payload from public.app_meta where key = 'global'")).rows[0].payload;
  const sec = payload.agentSecurity[TARGET];
  assert(sec.mfaRequired === true && sec.mfaEnabled === false, "a new barcode is required");
  assert(sec.authEmail === expected && sec.authUserId === TARGET_USER, "the security row points at the same sign-in");
  assert(payload.agentSecurity[OTHER].mfaEnabled === true && payload.agentSecurity[OTHER].authEmail === "other.user@example.test", "the other security row stayed");
  assert(payload.elementaryReferrals[0].id === "ref-1", "referrals stayed");

  const afterOther = await db.query("select email, auth_user_id, pin from public.agents where id = $1", [OTHER]);
  assert(JSON.stringify(afterOther.rows[0]) === JSON.stringify(beforeOther.rows[0]), "the other account row stayed");

  let second = false;
  try {
    await db.exec(sql);
  } catch(err) {
    second = /already has an address/.test(String(err && err.message));
  }
  assert(second, "running it again changes nothing");
  const still = await db.query("select auth_user_id from public.agents where id = $1", [TARGET]);
  assert(still.rows[0].auth_user_id === TARGET_USER, "the second run kept the same link");
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
