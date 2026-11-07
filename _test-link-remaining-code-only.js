/**
 * The five remaining code-only accounts are updated together.
 * Three keep an existing sign-in. Two receive one new sign-in.
 * Any failure saves nothing. Addresses are not printed.
 * Run: node _test-link-remaining-code-only.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-link-remaining-code-only.sql"), "utf8");
const lockSql = fs.readFileSync(path.join(ROOT, "supabase-gi-lock-auth-identity.sql"), "utf8");
const YUVAL = "a_0";
const OPS_AGENT = "a_1d2d2c232ad718_1a0f8458ae8";
const OPS_FREE = "a_772caeccd209a_19d010c5062";
const TEAM = "a_3202ee4668f158_1a13b494633";
const MANAGER = "a_0295c0dafe4e08_1a13b480eec";
const OTHER = "a_380ef00b23fca_19e5e74093f";
const YUVAL_USER = "11111111-1111-1111-1111-111111111111";
const OPS_AGENT_USER = "22222222-2222-2222-2222-222222222222";
const OPS_FREE_USER = "33333333-3333-3333-3333-333333333333";
const OTHER_USER = "44444444-4444-4444-4444-444444444444";

console.log("1) the script names the five accounts");
assert(sql.includes(YUVAL) && sql.includes("יובל מנדלסון"), "names Yuval");
assert(sql.includes(OPS_AGENT) && sql.includes("נציג תפעול"), "names the operations representative");
assert(sql.includes(OPS_FREE) && sql.includes("תפעול פנוי"), "names the vacant operations account");
assert(sql.includes(TEAM) && sql.includes("מנהל צוות"), "names the team manager");
assert(sql.includes(MANAGER) && sql.includes("מנהל ראשי"), "names the head manager");
assert(!sql.includes(OTHER), "does not target an account that already requires a barcode");
assert(!sql.includes("insert into auth.users") || sql.includes("action = 'created'"), "a sign-in is created only for an account that has none");
assert(sql.includes("address_printed"), "the result does not print an address");
assert(!/GiCrm!|set pin|agents\.pin\s*=/.test(sql), "does not rewrite a login code");

const SCHEMA = `
  create schema if not exists extensions;
  create or replace function extensions.gen_salt(text, int) returns text
  language sql as $$ select '$2a$10$saltsaltsaltsaltsaltu' $$;
  create or replace function extensions.crypt(text, text) returns text
  language sql as $$ select 'hashed-' || md5($1) $$;
  create or replace function extensions.gen_random_bytes(int) returns bytea
  language sql as $$ select decode(repeat('ab', greatest($1, 1)), 'hex') $$;
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

function internalEmail(id){
  return "agent+" + id.toLowerCase().replace(/[^a-z0-9]/g, "") + "@gemel-invest.internal";
}

async function openDb(){
  const { PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite");
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(lockSql);
  return db;
}

async function seed(db, extraAgentsSql){
  await db.exec(`
    insert into auth.users (id, instance_id, email, encrypted_password, confirmation_token, raw_app_meta_data) values
      ('${YUVAL_USER}', '00000000-0000-0000-0000-000000000000', null, 'keep-yuval', '', jsonb_build_object('agent_id', '${YUVAL}')),
      ('${OPS_AGENT_USER}', '00000000-0000-0000-0000-000000000000', null, 'keep-ops-agent', '', jsonb_build_object('agent_id', '${OPS_AGENT}')),
      ('${OPS_FREE_USER}', '00000000-0000-0000-0000-000000000000', null, 'keep-ops-free', '', jsonb_build_object('agent_id', '${OPS_FREE}')),
      ('${OTHER_USER}', '00000000-0000-0000-0000-000000000000', 'other.person@example.test', 'keep-other', '', jsonb_build_object('agent_id', '${OTHER}'));
    insert into auth.identities (id, user_id, identity_data, provider, provider_id) values
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '${YUVAL_USER}', '{}'::jsonb, 'email', '${YUVAL_USER}'),
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '${OPS_AGENT_USER}', '{}'::jsonb, 'email', '${OPS_AGENT_USER}'),
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '${OPS_FREE_USER}', '{}'::jsonb, 'email', '${OPS_FREE_USER}');
    insert into public.agents (id, name, role, email, auth_user_id, active, pin) values
      ('${YUVAL}', 'יובל מנדלסון', 'agent', '', '${YUVAL_USER}', true, '1111'),
      ('${OPS_AGENT}', 'נציג תפעול', 'opsAgent', '', '${OPS_AGENT_USER}', true, '2222'),
      ('${OPS_FREE}', 'תפעול פנוי', 'ops', '', '${OPS_FREE_USER}', true, '3333'),
      ('${TEAM}', 'מנהל צוות', 'teamManager', '', null, true, '4444'),
      ('${MANAGER}', 'מנהל ראשי', 'manager', '', null, true, '5555'),
      ('${OTHER}', 'חן אודיה מינץ', 'referent', 'other.person@example.test', '${OTHER_USER}', true, '6666')
      ${extraAgentsSql || ""};
    insert into public.app_meta (key, payload) values (
      'global',
      jsonb_build_object(
        'elementaryReferrals', jsonb_build_array(jsonb_build_object('id', 'ref-1')),
        'agentSecurity', jsonb_build_object(
          '${YUVAL}', jsonb_build_object('pinOnlyLogin', true, 'totpUri', 'otpauth://secret'),
          '${OPS_AGENT}', jsonb_build_object('pinOnlyLogin', true),
          '${OTHER}', jsonb_build_object('mfaRequired', true, 'authEmail', 'other.person@example.test')
        )
      )
    );
  `);
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
  console.log("\n2) five accounts in one run");
  const db = await openDb();
  await seed(db);
  const beforeOther = await db.query("select email, auth_user_id, pin, role from public.agents where id = $1", [OTHER]);
  await db.exec(sql);
  const report = await db.query("select kind, detail from gi_link_account_result order by sort_key, kind");
  const shown = report.rows.map((row) => row.kind + "=" + row.detail).join("|");
  assert(shown === [
    "יובל מנדלסון=required_reused",
    "נציג תפעול=required_reused",
    "תפעול פנוי=required_reused",
    "מנהל צוות=required_created",
    "מנהל ראשי=required_created",
    "address_printed=no",
    "other_accounts=unchanged"
  ].join("|"), "each account is marked and no address is printed");
  assert(!/@/.test(shown), "the visible result has no address");

  const yuval = await db.query("select email, auth_user_id, pin from public.agents where id = $1", [YUVAL]);
  const yuvalAuth = await db.query("select email, encrypted_password, raw_app_meta_data from auth.users where id = $1", [YUVAL_USER]);
  assert(yuval.rows[0].auth_user_id === YUVAL_USER, "Yuval kept the original sign-in");
  assert(yuval.rows[0].email === internalEmail(YUVAL), "Yuval received the internal address");
  assert(yuvalAuth.rows[0].encrypted_password === "keep-yuval", "an existing sign-in secret stayed");
  assert(yuval.rows[0].pin === "1111", "Yuval's login code stayed");

  const team = await db.query("select email, auth_user_id, pin from public.agents where id = $1", [TEAM]);
  const manager = await db.query("select email, auth_user_id, pin from public.agents where id = $1", [MANAGER]);
  assert(team.rows[0].auth_user_id && manager.rows[0].auth_user_id, "the two accounts without a sign-in now have one");
  assert(team.rows[0].auth_user_id !== manager.rows[0].auth_user_id, "the new sign-ins are not shared");
  assert(team.rows[0].email === internalEmail(TEAM), "the team manager received the internal address");
  assert(manager.rows[0].email === internalEmail(MANAGER), "the head manager received the internal address");
  assert(team.rows[0].pin === "4444" && manager.rows[0].pin === "5555", "the new accounts kept their login codes");
  const created = await db.query(
    "select encrypted_password, raw_app_meta_data->>'role' as role from auth.users where id in ($1, $2) order by raw_app_meta_data->>'role'",
    [team.rows[0].auth_user_id, manager.rows[0].auth_user_id]
  );
  assert(created.rows.length === 2, "two sign-in rows were created");
  assert(created.rows.every((row) => row.encrypted_password && !["1111", "2222", "3333", "4444", "5555", "6666"].includes(row.encrypted_password)), "a created secret is not a login code");
  assert(created.rows.map((row) => row.role).sort().join() === "manager,teamManager", "created sign-ins keep the account role");

  const payload = (await db.query("select payload from public.app_meta where key = 'global'")).rows[0].payload;
  assert(payload.agentSecurity[YUVAL].mfaRequired === true && payload.agentSecurity[YUVAL].pinOnlyLogin === false, "Yuval must scan");
  assert(payload.agentSecurity[YUVAL].totpUri == null, "a saved barcode secret was removed");
  assert(payload.agentSecurity[TEAM].mfaRequired === true && payload.agentSecurity[MANAGER].mfaRequired === true, "the new accounts must scan");
  assert(payload.agentSecurity[OTHER].mfaRequired === true && payload.agentSecurity[OTHER].authEmail === "other.person@example.test", "an untouched security row stayed");
  assert(payload.elementaryReferrals[0].id === "ref-1", "referrals stayed");
  const afterOther = await db.query("select email, auth_user_id, pin, role from public.agents where id = $1", [OTHER]);
  assert(JSON.stringify(afterOther.rows[0]) === JSON.stringify(beforeOther.rows[0]), "an account outside the list stayed");

  const userCount = await db.query("select count(*)::int as n from auth.users");
  let second = false;
  try {
    await db.exec(sql);
  } catch(err) {
    second = /already has an address/.test(String(err && err.message));
  }
  const userCountAfter = await db.query("select count(*)::int as n from auth.users");
  assert(second, "running it again changes nothing");
  assert(userCountAfter.rows[0].n === userCount.rows[0].n, "the second run did not create another sign-in");
  await db.close();

  console.log("\n3) a shared sign-in saves nothing");
  const shared = await openDb();
  await seed(shared);
  await shared.exec(`update public.agents set auth_user_id = '${YUVAL_USER}' where id = '${OPS_AGENT}'`);
  let blocked = false;
  try {
    await shared.exec(sql);
  } catch(err) {
    blocked = /another account uses this sign-in/.test(String(err && err.message));
  }
  const still = await shared.query("select email from public.agents where id = $1", [YUVAL]);
  const createdCount = await shared.query("select count(*)::int as n from auth.users where id not in ($1, $2, $3, $4)", [YUVAL_USER, OPS_AGENT_USER, OPS_FREE_USER, OTHER_USER]);
  assert(blocked, "a shared sign-in is refused");
  assert(!still.rows[0].email, "the refused run saved no address");
  assert(createdCount.rows[0].n === 0, "the refused run created no sign-in");
  await shared.close();

  console.log("\n4) a mismatched account saves nothing");
  const wrong = await openDb();
  await seed(wrong);
  await wrong.exec(`update public.agents set name = 'שם אחר' where id = '${MANAGER}'`);
  let missing = false;
  try {
    await wrong.exec(sql);
  } catch(err) {
    missing = /was not found/.test(String(err && err.message));
  }
  const yuvalStill = await wrong.query("select email from public.agents where id = $1", [YUVAL]);
  const usersStill = await wrong.query("select count(*)::int as n from auth.users");
  assert(missing, "a mismatched account is refused");
  assert(!yuvalStill.rows[0].email, "the refused run left the other accounts untouched");
  assert(usersStill.rows[0].n === 4, "the refused run created no sign-in");
  await wrong.close();
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
