/**
 * A surveyor can assign a meeting. An agent cannot open one for somebody else.
 * Run: node _test-gi-pension-meetings-rls.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
let failed = 0;

function assert(cond, msg) {
  if (cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-pension-meetings.sql"), "utf8");
const code = sql
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

console.log("1) the assign policy accepts a surveyor and still ties the row to her");
assert(code.includes("gi_meeting_writer"), "the insert check is the surveyor writer");
assert(code.includes("'סוקרת'"), "a Hebrew surveyor role is accepted");
assert(code.includes("'רפרנטית'"), "a Hebrew referent role is accepted");
assert(code.includes("a.auth_user_id::text = auth.uid()::text"), "the signed-in account link is accepted");
assert(code.includes("with check (public.gi_meeting_writer(created_by_id))"), "insert uses that check");
assert(!/with check \(\s*true\s*\)/i.test(code), "insert is not open to every signed-in user");

async function runDatabase() {
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch (_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");

  const base = `
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public to anon, authenticated;
    create schema if not exists auth;
    create table public.agents (
      id text primary key,
      name text,
      role text,
      auth_user_id uuid,
      active boolean default true
    );
    grant select on public.agents to authenticated;
    create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('gi.test_uid', true), '')::uuid
    $$;
    create or replace function public.gi_jwt_agent_id() returns text
    language sql stable as $$
      select coalesce(current_setting('gi.test_agent', true), '')
    $$;
    create or replace function public.gi_jwt_is_manager() returns boolean
    language sql stable as $$
      select coalesce(current_setting('gi.test_manager', true), '') = 'yes'
    $$;
    create or replace function public.gi_jwt_role() returns text
    language sql stable as $$
      select coalesce(current_setting('gi.test_role', true), '')
    $$;
  `;

  const db = new PGlite();
  await db.exec(base);
  await db.exec(code.replace(/notify\s+pgrst\s*,\s*'reload schema'\s*;/i, ""));
  await db.exec(`
    insert into public.agents (id, name, role, auth_user_id) values
      ('s1', 'נועה', 'referent', '11111111-1111-1111-1111-111111111111'),
      ('s2', 'חן', 'סוקרת', '33333333-3333-3333-3333-333333333333'),
      ('a1', 'אוריה', 'agent', '22222222-2222-2222-2222-222222222222'),
      ('a2', 'אחר', 'agent', '44444444-4444-4444-4444-444444444444');
  `);

  async function asUser(agent, role, manager, uid) {
    await db.exec("reset role");
    await db.exec("select set_config('gi.test_agent', '" + agent + "', false)");
    await db.exec("select set_config('gi.test_role', '" + role + "', false)");
    await db.exec("select set_config('gi.test_manager', '" + (manager ? "yes" : "") + "', false)");
    await db.exec("select set_config('gi.test_uid', '" + (uid || "") + "', false)");
    await db.exec("set role authenticated");
  }

  async function insertMeeting(id, creator, assignee) {
    await db.query(
      "insert into public.gi_pension_meetings (id, created_by_id, assignee_id, assignee_name) values ($1, $2, $3, $4) returning id",
      [id, creator, assignee, "נציג"]
    );
  }

  async function rejected(fn) {
    try {
      await fn();
      return "";
    } catch (err) {
      return String(err && err.message || err);
    }
  }

  await asUser("s1", "referent", false, "11111111-1111-1111-1111-111111111111");
  await insertMeeting("m1", "s1", "a1");
  const own = await db.query("select id from public.gi_pension_meetings where id = 'm1'");
  assert(own.rows.length === 1, "a referent sees the meeting she just assigned");
  const foreign = await rejected(() => insertMeeting("m-foreign", "a1", "a1"));
  assert(/row-level security/i.test(foreign), "a referent cannot file the meeting under someone else");

  await asUser("s1", "agent", false, "11111111-1111-1111-1111-111111111111");
  await insertMeeting("m-stale", "s1", "a1");
  const stale = await db.query("select id from public.gi_pension_meetings where id = 'm-stale'");
  assert(stale.rows.length === 1, "a stale agent token still assigns when the roster row is a surveyor");

  await asUser("s2", "רפרנטית", false, "33333333-3333-3333-3333-333333333333");
  await insertMeeting("m-he", "s2", "a1");
  const hebrew = await db.query("select id from public.gi_pension_meetings where id = 'm-he'");
  assert(hebrew.rows.length === 1, "a Hebrew surveyor role can assign and read the row");

  await asUser("not-an-agent", "referent", false, "11111111-1111-1111-1111-111111111111");
  await insertMeeting("m-link", "s1", "a1");
  const linked = await db.query("select id from public.gi_pension_meetings where id = 'm-link'");
  assert(linked.rows.length === 1, "the account link accepts the roster id when the token id differs");

  await asUser("a1", "agent", false, "22222222-2222-2222-2222-222222222222");
  const assigned = await db.query("select id from public.gi_pension_meetings where id = 'm1'");
  assert(assigned.rows.length === 1, "the assignee can read the meeting");
  const agentInsert = await rejected(() => insertMeeting("m-agent", "a1", "a1"));
  assert(/row-level security/i.test(agentInsert), "an agent cannot open a meeting");
  const stolen = await rejected(() => insertMeeting("m-steal", "s1", "a1"));
  assert(/row-level security/i.test(stolen), "an agent cannot open a meeting as the surveyor");

  await asUser("a2", "agent", false, "44444444-4444-4444-4444-444444444444");
  const hidden = await db.query("select id from public.gi_pension_meetings where id = 'm1'");
  assert(hidden.rows.length === 0, "another agent does not see the meeting");

  await asUser("boss", "manager", true, "");
  await insertMeeting("m-boss", "s1", "a1");
  const boss = await db.query("select count(*)::int as n from public.gi_pension_meetings");
  assert(boss.rows[0].n >= 4, "a manager can assign and sees the meetings");

  await db.exec("reset role");
  await db.exec("set role anon");
  const anonInsert = await rejected(() => insertMeeting("m-anon", "s1", "a1"));
  assert(/permission denied|row-level security/i.test(anonInsert), "anon cannot insert a meeting");
}

runDatabase().then(() => {
  if (failed) {
    console.error("\nFAILED " + failed);
    process.exit(1);
  }
  console.log("\ngi pension meetings rls ok");
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
