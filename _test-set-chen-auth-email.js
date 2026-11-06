/**
 * One agent address is copied onto his sign-in account. The address is not
 * stored in the script and is not returned. Other accounts stay as they are.
 * Run: node _test-set-chen-auth-email.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-set-chen-auth-email.sql"), "utf8");
console.log("1) the script does not contain an address");
assert(sql.includes("a_42b897c014fd4_1a0a94d314a"), "targets one agent id");
assert(sql.includes("5a22aa9e-0520-465a-83a3-8b0bd7291c37"), "targets one sign-in account");
assert(!/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(sql), "no address is written in the file");
assert(!/encrypted_password|GiCrm!|mfaRequired|pinOnlyLogin/.test(sql), "does not change codes or authenticator flags");
assert(/nothing was changed/.test(sql), "a conflict leaves the data unchanged");

const CHEN = "5a22aa9e-0520-465a-83a3-8b0bd7291c37";
const OTHER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

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
      email text unique,
      email_confirmed_at timestamptz,
      updated_at timestamptz not null default now()
    );
    create table auth.identities (
      id uuid primary key,
      user_id uuid not null,
      provider text not null,
      provider_id text not null,
      identity_data jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (provider, provider_id)
    );
    create table public.agents (
      id text primary key,
      name text,
      email text,
      pin text,
      active boolean
    );
    insert into auth.users (id, email) values
      ('${CHEN}', null),
      ('${OTHER}', 'other@example.test');
    insert into public.agents (id, name, email, pin, active) values
      ('a_42b897c014fd4_1a0a94d314a', 'חן מזרחי', 'Chen.User@Example.test', '1111', true),
      ('a_other', 'נציג אחר', 'other@example.test', '2222', true);
  `);

  await db.exec(sql);
  const report = await db.query("select kind, detail from gi_email_result order by kind");
  assert(report.rows.map((row) => row.kind + "=" + row.detail).join() === "auth_email=set,code_login=unchanged", "reports that the address was set");
  assert(!JSON.stringify(report.rows).includes("@"), "the result does not contain the address");
  const users = await db.query("select id::text as id, email, email_confirmed_at is not null as confirmed from auth.users order by id");
  const byId = Object.fromEntries(users.rows.map((row) => [row.id, row]));
  assert(byId[CHEN].email === "chen.user@example.test" && byId[CHEN].confirmed === true, "the sign-in address is confirmed");
  assert(byId[OTHER].email === "other@example.test", "another sign-in account stays unchanged");
  const ident = await db.query("select provider_id, identity_data->>'email' as email from auth.identities where user_id = $1", [CHEN]);
  assert(ident.rows.length === 1 && ident.rows[0].provider_id === "chen.user@example.test", "the sign-in identity uses the same address");
  const pins = await db.query("select id, pin, active from public.agents order by id");
  assert(pins.rows.map((row) => row.id + ":" + row.pin + ":" + row.active).join() === "a_42b897c014fd4_1a0a94d314a:1111:true,a_other:2222:true", "codes and active flags stay");

  await db.exec(sql);
  const again = await db.query("select detail from gi_email_result where kind = 'auth_email'");
  assert(again.rows[0].detail === "already_present", "running it again does not replace the address");

  const clash = new PGlite();
  await clash.exec(`
    create schema if not exists auth;
    create table auth.users (
      id uuid primary key,
      email text unique,
      email_confirmed_at timestamptz,
      updated_at timestamptz not null default now()
    );
    create table auth.identities (
      id uuid primary key,
      user_id uuid not null,
      provider text not null,
      provider_id text not null,
      identity_data jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (provider, provider_id)
    );
    create table public.agents (
      id text primary key,
      name text,
      email text,
      pin text,
      active boolean
    );
    insert into auth.users (id, email) values
      ('${CHEN}', 'someone-else@example.test'),
      ('${OTHER}', 'chen.user@example.test');
    insert into public.agents (id, name, email, pin, active) values
      ('a_42b897c014fd4_1a0a94d314a', 'חן מזרחי', 'chen.user@example.test', '1111', true);
  `);
  let blocked = false;
  try {
    await clash.exec(sql);
  } catch(err) {
    blocked = /different address/.test(String(err && err.message || err));
  }
  assert(blocked, "a different existing address is left untouched");
  const kept = await clash.query("select email from auth.users where id = $1", [CHEN]);
  assert(kept.rows[0].email === "someone-else@example.test", "the previous sign-in address remains");
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
