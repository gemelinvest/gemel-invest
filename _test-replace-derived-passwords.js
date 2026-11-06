/**
 * Derived Auth passwords are replaced with random ones. CRM PINs stay.
 * Sessions stay until the second script, and that script is limited to the
 * recorded Auth users.
 * Run: node _test-replace-derived-passwords.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

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

const replaceSql = fs.readFileSync(path.join(ROOT, "supabase-gi-replace-derived-passwords.sql"), "utf8");
const revokeSql = fs.readFileSync(path.join(ROOT, "supabase-gi-revoke-derived-sessions.sql"), "utf8");
const syncSql = fs.readFileSync(path.join(ROOT, "supabase-gi-sync-auth-password.sql"), "utf8");

console.log("1) the scripts do not print or embed a password");
assert(!/GiCrm!/.test(replaceSql + revokeSql + syncSql), "the formula is not in the new scripts");
assert(!/select[^;]*encrypted_password/i.test(replaceSql), "section 1 does not return the password");
assert(replaceSql.includes("extensions.gen_random_bytes"), "section 1 generates the new password in the database");
assert(replaceSql.includes("section 1 already ran"), "section 1 refuses a second replacement");
assert(!/delete from auth\.sessions/.test(replaceSql), "section 1 does not close sessions");
assert(replaceSql.includes("gi_sync_agent_auth_password"), "section 1 stops the old password trigger");
assert(revokeSql.includes("user_id::text in (select id::text from unnest(ids) as id)"), "section 2 matches text and uuid user ids");
assert(revokeSql.includes("section 1 has not been run"), "section 2 refuses to run first");
assert(!/delete from auth\.sessions\s*;/.test(revokeSql), "section 2 does not delete every session");

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";
const U3 = "33333333-3333-3333-3333-333333333333";
const S1 = "11111111-1111-4111-8111-111111111112";
const S3 = "33333333-3333-4333-8333-333333333332";

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
      id uuid primary key,
      email text,
      encrypted_password text,
      updated_at timestamptz not null default now()
    );
    create table auth.sessions (
      id uuid primary key,
      user_id uuid not null references auth.users(id)
    );
    create table auth.refresh_tokens (
      id bigint generated always as identity primary key,
      user_id varchar,
      session_id uuid references auth.sessions(id) on delete cascade,
      revoked boolean not null default false
    );
    create table public.agents (
      id text primary key,
      name text,
      email text,
      pin text,
      auth_user_id uuid
    );
    create table public.gi_app_secrets (
      key text primary key,
      value jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
    insert into public.gi_app_secrets (key, value)
    values ('admin_auth', '{"username":"מנהל מערכת","pin":"1357","active":true}'::jsonb);
    create function public.gi_pick_agent_auth_user(p_agent_id text, p_agent_email text, p_linked uuid)
    returns uuid language sql stable as $$
      select p_linked;
    $$;
    insert into auth.users (id, email, encrypted_password) values
      ('${U1}', 'a1@example.test', 'old-derived'),
      ('${U2}', 'a2@example.test', 'old-derived-2'),
      ('${U3}', 'other@example.test', 'keep-me');
    insert into auth.sessions (id, user_id) values
      ('${S1}', '${U1}'),
      ('${S3}', '${U3}');
    insert into auth.refresh_tokens (user_id, session_id) values
      ('${U1}', '${S1}'),
      ('${U3}', '${S3}');
    insert into public.agents (id, name, email, pin, auth_user_id) values
      ('a1', 'נציג אחד', 'a1@example.test', '1111', '${U1}'),
      ('a2', 'נציג שתיים', 'a2@example.test', '2222', '${U2}'),
      ('a3', 'נציג אחר', 'a3@example.test', '3333', null);
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

  await db.exec(replaceSql);
  const report = await db.query("select kind, detail from gi_password_result order by kind");
  const replaced = report.rows.find((row) => row.kind === "passwords_replaced");
  assert(replaced && replaced.detail === "2", "only the two linked Auth users are replaced");
  assert(!JSON.stringify(report.rows).match(/[0-9a-f]{20,}/), "the result does not contain a password");

  const users = await db.query("select id::text as id, encrypted_password from auth.users order by id");
  const byId = Object.fromEntries(users.rows.map((row) => [row.id, row.encrypted_password]));
  assert(byId[U1] && byId[U1] !== "old-derived", "the first derived password was replaced");
  assert(byId[U2] && byId[U2] !== "old-derived-2", "the second derived password was replaced");
  assert(byId[U3] === "keep-me", "an Auth user who is not an agent stays unchanged");
  const pins = await db.query("select id, pin from public.agents order by id");
  assert(pins.rows.map((row) => row.id + ":" + row.pin).join() === "a1:1111,a2:2222,a3:3333", "CRM PINs stay");
  const admin = await db.query("select value->>'pin' as pin from public.gi_app_secrets where key = 'admin_auth'");
  assert(admin.rows[0].pin === "1357", "the admin PIN record stays");
  const sessions = await db.query("select id::text as id from auth.sessions order by id");
  assert(sessions.rows.map((row) => row.id).sort().join() === [S1, S3].sort().join(), "section 1 keeps every session");
  const marker = await db.query("select value from public.gi_app_secrets where key = 'derived_password_reset'");
  assert(Array.isArray(marker.rows[0].value.authUserIds) && marker.rows[0].value.authUserIds.length === 2, "section 2 is limited to the replaced users");
  assert(!JSON.stringify(marker.rows[0].value).includes("old-derived"), "the private list has no password");

  const fn = await db.query("select pg_get_functiondef('public.gi_sync_agent_auth_password()'::regprocedure) as def");
  assert(!/GiCrm!/.test(fn.rows[0].def) && !/encrypted_password/.test(fn.rows[0].def), "the trigger no longer writes a derived password");

  let second = false;
  try {
    await db.exec(replaceSql);
  } catch(err) {
    second = /section 1 already ran/.test(String(err && err.message || err));
  }
  assert(second, "running section 1 again is rejected");

  await db.exec(revokeSql);
  const leftSessions = await db.query("select user_id::text as user_id from auth.sessions");
  assert(leftSessions.rows.length === 1 && leftSessions.rows[0].user_id === U3, "section 2 closes only the recorded sessions");
  const tokens = await db.query("select user_id::text as user_id, revoked from auth.refresh_tokens");
  assert(tokens.rows.length === 1 && tokens.rows[0].user_id === U3 && tokens.rows[0].revoked === false, "the unrelated refresh token stays valid");
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
