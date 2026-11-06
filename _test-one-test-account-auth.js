/**
 * One vacant test account receives a sign-in address.
 * The address is not printed. Every other account stays as it was.
 * Run: node _test-one-test-account-auth.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-one-test-account-auth.sql"), "utf8");
const TARGET = "a_6b3a63ce13bda_1a0a48aec42";
const OTHER = "a_504a67126e406_19d8ae66366";

console.log("1) the script stays on one vacant account");
assert(sql.includes(TARGET), "targets the vacant account id");
assert(sql.includes(OTHER), "checks the other same-name account");
assert(sql.includes("address_printed"), "the result says the address was not printed");
assert(!/[\w.+-]+@(?!gemel-invest\.internal)[\w.-]+\.[a-z]{2,}/i.test(sql), "no outside address is written in the file");
assert(!/GiCrm!|agents\.pin|encrypted_password\s*=\s*'/.test(sql), "does not write a fixed password or a PIN");

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
    create schema if not exists extensions;
    create function extensions.gen_random_bytes(len integer)
    returns bytea language sql volatile as $$
      select decode(md5(clock_timestamp()::text || random()::text || len::text), 'hex');
    $$;
    create function extensions.gen_salt(kind text, rounds integer)
    returns text language sql volatile as $$
      select 'salt-' || md5(clock_timestamp()::text || random()::text);
    $$;
    create function extensions.crypt(secret text, salt text)
    returns text language sql as $$
      select 'hash:' || md5(secret || salt);
    $$;
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
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, confirmation_token)
    values ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'kept@example.test', 'old-hash', '');
    insert into public.agents (id, name, email, auth_user_id, active, pin) values
      ('${TARGET}', 'יוזר פנוי', '', null, true, '1111'),
      ('${OTHER}', 'יוזר פנוי', '', null, true, '2222'),
      ('a_real', 'יובל מנדלסון', '', null, true, '3333');
    insert into public.app_meta (key, payload) values (
      'global',
      jsonb_build_object(
        'elementaryReferrals', jsonb_build_array(jsonb_build_object('id', 'ref-1')),
        'agentSecurity', jsonb_build_object(
          '${TARGET}', jsonb_build_object('pinOnlyLogin', false),
          '${OTHER}', jsonb_build_object('mfaEnabled', true, 'authEmail', 'kept-other@example.test'),
          'a_real', jsonb_build_object('mfaRequired', false)
        )
      )
    );
  `);

  await db.exec(sql);
  const report = await db.query("select kind, detail from gi_one_account_result order by kind");
  const shown = report.rows.map((row) => row.kind + "=" + row.detail).join();
  assert(shown === "account=ready,address_printed=no,authenticator=required,other_accounts=unchanged", "result is account=ready without an address");
  assert(!/@/.test(shown), "the result does not contain an address");

  const target = await db.query("select email, auth_user_id from public.agents where id = $1", [TARGET]);
  const auth = await db.query("select email, email_confirmed_at, encrypted_password from auth.users where id = $1", [target.rows[0].auth_user_id]);
  const expected = "agent+" + TARGET.toLowerCase().replace(/[^a-z0-9]/g, "") + "@gemel-invest.internal";
  assert(target.rows[0].email === expected, "the system address is stored on the account");
  assert(auth.rows[0].email === expected, "the same address is stored on the sign-in account");
  assert(auth.rows[0].email_confirmed_at != null, "the sign-in address is confirmed");
  assert(String(auth.rows[0].encrypted_password || "").startsWith("hash:"), "the sign-in password is random");
  assert(!String(auth.rows[0].encrypted_password || "").includes("1111"), "the code is not the sign-in password");

  const payload = (await db.query("select payload from public.app_meta where key = 'global'")).rows[0].payload;
  const sec = payload.agentSecurity[TARGET];
  assert(sec.mfaRequired === true && sec.mfaEnabled === false && sec.authUserId === target.rows[0].auth_user_id, "a barcode is required and not yet scanned");
  assert(sec.authEmail === expected, "the security row has the same address");
  assert(payload.agentSecurity[OTHER].authEmail === "kept-other@example.test" && payload.agentSecurity[OTHER].mfaEnabled === true, "the other same-name account is unchanged");
  assert(payload.agentSecurity.a_real.mfaRequired === false, "a real account is unchanged");
  assert(payload.elementaryReferrals[0].id === "ref-1", "referrals are unchanged");

  const otherAgent = await db.query("select email, auth_user_id, pin from public.agents where id = $1", [OTHER]);
  assert(otherAgent.rows[0].email === "" && otherAgent.rows[0].auth_user_id == null && otherAgent.rows[0].pin === "2222", "the other account row is unchanged");
  const real = await db.query("select email, pin from public.agents where id = 'a_real'");
  assert(real.rows[0].email === "" && real.rows[0].pin === "3333", "the real account row is unchanged");

  let ranAgain = false;
  try {
    await db.exec(sql);
    ranAgain = true;
  } catch(err) {
    ranAgain = /already has a sign-in address/.test(String(err && err.message));
  }
  assert(ranAgain, "running the script again changes nothing");
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
