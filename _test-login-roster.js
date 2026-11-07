/**
 * The login roster function is added beside the open meta read.
 * The screen is not switched, and no door is closed.
 * Run: node _test-login-roster.js
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

function executable(sql){
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-login-roster.sql"), "utf8");
const code = executable(sql);

console.log("1) the file adds one narrow function");
assert(code.includes("create or replace function public.gi_login_roster()"), "it adds the roster function");
assert(code.includes("security definer"), "the function can read while a later door is closed");
assert((code.match(/create or replace function/gi) || []).length === 1, "it creates one function");
assert(!/drop policy|create policy/i.test(code), "it does not change a policy");
assert(!/revoke select|revoke insert|revoke update|revoke delete/i.test(code), "it does not revoke table access");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a row");
assert(!/a\.pin\b/.test(code), "it does not read the agent code column");
assert(!/'customersShadow'|'proposalsShadow'|'totpUri'|'totpQrHtml'/.test(code), "closed copies are not copied out");
assert(code.includes("grant execute on function public.gi_login_roster() to anon, authenticated"), "a signed-in session and the public key can call it");
assert(code.includes("roster returned a closed field; nothing saved"), "a closed field in the result saves nothing");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");

  const fixture = `
    create role anon nologin;
    create role authenticated nologin;
    create table public.app_meta (
      key text primary key,
      payload jsonb
    );
    create table public.agents (
      id text primary key,
      name text,
      username text,
      role text,
      active boolean,
      email text,
      team_manager_id text,
      auth_user_id text,
      birth_date text,
      monthly_sales_target numeric,
      created_at timestamptz,
      updated_at timestamptz,
      pin text
    );
    create table public.customers (id text primary key);
    alter table public.app_meta enable row level security;
    alter table public.agents enable row level security;
    alter table public.customers enable row level security;
    create policy "allow all app_meta" on public.app_meta
      for all to anon, authenticated using (true) with check (true);
    create policy "allow all agents" on public.agents
      for all to anon, authenticated using (true) with check (true);
    grant select on public.app_meta, public.agents to anon, authenticated;
    insert into public.customers(id) values ('kept');
    insert into public.agents(id, name, username, role, active, email, pin)
      values ('a1', 'Agent', 'agent', 'agent', true, 'agent@example.com', 'closed-marker');
    insert into public.app_meta(key, payload) values ('global', jsonb_build_object(
      'adminAuth', jsonb_build_object('username', 'manager', 'active', true, 'pin', 'closed-marker'),
      'agentsShadow', jsonb_build_array(jsonb_build_object('id', 'a1', 'name', 'Agent', 'pin', 'closed-marker')),
      'teamManagerAssignments', jsonb_build_object('m1', jsonb_build_array('a1')),
      'agentShiftHours', jsonb_build_object('a1', jsonb_build_object('start', '09:00')),
      'agentSecurity', jsonb_build_object('a1', jsonb_build_object(
        'mfaRequired', true,
        'pinOnlyLogin', false,
        'totpUri', 'closed-marker',
        'authPasswordScheme', 'closed-marker'
      )),
      'customersShadow', jsonb_build_array(jsonb_build_object('id', 'c1', 'full_name', 'closed-marker')),
      'proposalsShadow', jsonb_build_array(jsonb_build_object('id', 'p1'))
    ));
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  {
    const db = new PGlite();
    await db.exec(fixture);
    const rows = await rowsOf(db);
    const bySection = Object.fromEntries(rows.map((row) => [row.section, row.detail]));
    assert(bySection.function === "gi_login_roster", "the result names the function");
    assert(bySection.installed === "yes", "the function is installed");
    assert(bySection.screen_changed === "no" && bySection.door_closed === "no", "the screen and the door stay as they are");
    assert(bySection.policies_changed === "no" && bySection.rows_changed === "no", "policies and rows stay");
    assert(bySection.closed_fields === "omitted" && bySection.customer_copies === "omitted" && bySection.admin_code === "omitted", "closed fields are omitted");
    const roster = await db.query(`select public.gi_login_roster() as roster`);
    const body = JSON.stringify(roster.rows[0].roster);
    assert(body.includes("Agent") && body.includes("manager"), "the roster still names the user records");
    assert(!body.includes("closed-marker"), "a code, a barcode, and a customer copy are absent");
    assert(!body.includes("customersShadow") && !body.includes("proposalsShadow"), "customer and proposal copies are absent");
    const policies = await db.query(`select count(*)::int as n from pg_policies`);
    const customers = await db.query(`select count(*)::int as n from public.customers`);
    assert(policies.rows[0].n === 2 && customers.rows[0].n === 1, "the open doors and the customers table stay");
    const second = await rowsOf(db);
    const again = Object.fromEntries(second.map((row) => [row.section, row.detail]));
    assert(again.installed === "yes" && again.rows_changed === "no", "a second run changes nothing");
  }

  {
    const db = new PGlite();
    await db.exec(`create table public.agents (id text primary key);`);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/login tables are missing; nothing saved/i.test(blocked), "a missing meta table saves nothing");
    const fn = await db.query(`
      select count(*)::int as n from pg_proc where proname = 'gi_login_roster'
    `);
    assert(fn.rows[0].n === 0, "the rejected function is not left behind");
  }
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
