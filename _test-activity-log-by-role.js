/**
 * The activity log read and insert follow the signed-in role.
 * A manager and a team manager can read every row. Anyone else reads and
 * inserts only a row with their own agent_id. The public door stays closed.
 * Run: node _test-activity-log-by-role.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-activity-log-by-role.sql"), "utf8");
const code = executable(sql);

console.log("1) the file replaces only the two open signed-in policies");
assert(code.includes("create policy actlog_select_by_role"), "it adds the role read");
assert(code.includes("create policy actlog_insert_by_role"), "it adds the role insert");
assert(code.includes("drop policy actlog_select_authenticated"), "it removes the open read");
assert(code.includes("drop policy actlog_insert_authenticated"), "it removes the open insert");
assert((code.match(/drop policy/gi) || []).length === 2, "it drops two policies");
assert(code.includes("gi_jwt_is_manager()"), "a manager can read");
assert(code.includes("'teammanager'"), "a team manager can read");
assert(code.includes("coalesce(agent_id, '') = public.gi_jwt_agent_id()"), "anyone else is limited to their own agent id");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/from public\.gi_agent_activity_log/i.test(code), "it does not read log rows");
assert(!/public\.customers|public\.app_meta|public\.proposals/i.test(code), "other business tables are not named");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");

  const base = `
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public to anon, authenticated;
    create table public.gi_agent_activity_log (
      id text primary key,
      agent_id text
    );
    create table public.notes (id text primary key);
    grant select, insert on public.gi_agent_activity_log to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.gi_agent_activity_log(id, agent_id) values
      ('mine', 'a1'),
      ('other', 'a2');
    alter table public.gi_agent_activity_log enable row level security;
    alter table public.notes enable row level security;
    create function public.gi_jwt_agent_id() returns text language sql stable as $$
      select coalesce(current_setting('gi.test_agent', true), '')
    $$;
    create function public.gi_jwt_is_manager() returns boolean language sql stable as $$
      select coalesce(current_setting('gi.test_manager', true), '') = 'yes'
    $$;
    create function public.gi_jwt_role() returns text language sql stable as $$
      select coalesce(current_setting('gi.test_role', true), '')
    $$;
    create policy notes_select_own on public.notes for select to authenticated using (true);
    create policy actlog_select_authenticated on public.gi_agent_activity_log
      for select to authenticated using (true);
    create policy actlog_insert_authenticated on public.gi_agent_activity_log
      for insert to authenticated with check (true);
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  {
    const db = new PGlite();
    await db.exec(base);
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("policies_removed=actlog_select_authenticated,actlog_insert_authenticated"), "the open policies are removed");
    assert(details.includes("select_by_role=installed") && details.includes("insert_by_role=installed"), "the role policies are installed");
    assert(details.includes("other_tables=unchanged") && details.includes("changed=yes"), "other tables stay and the cut is reported");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.includes("changed=no"), "a second run removes nothing");

    await db.exec("set role anon");
    const anonRead = await db.query("select count(*)::int as n from public.gi_agent_activity_log");
    await db.exec("reset role");
    assert(anonRead.rows[0].n === 0, "anon still cannot read");

    await db.exec("set role authenticated");
    await db.exec("select set_config('gi.test_agent', 'a1', false)");
    await db.exec("select set_config('gi.test_manager', '', false)");
    await db.exec("select set_config('gi.test_role', 'agent', false)");
    const own = await db.query("select count(*)::int as n from public.gi_agent_activity_log");
    let foreign = "";
    try {
      await db.exec("insert into public.gi_agent_activity_log(id, agent_id) values ('nope', 'a2')");
      foreign = "wrote";
    } catch(err) {
      foreign = String(err && err.message || err);
    }
    await db.exec("insert into public.gi_agent_activity_log(id, agent_id) values ('also', 'a1')");
    assert(own.rows[0].n === 1, "an agent sees only their own row");
    assert(/row-level security/i.test(foreign), "an agent cannot insert another agent's row");

    await db.exec("select set_config('gi.test_manager', 'yes', false)");
    const asManager = await db.query("select count(*)::int as n from public.gi_agent_activity_log");
    await db.exec("select set_config('gi.test_manager', '', false)");
    await db.exec("select set_config('gi.test_role', 'teammanager', false)");
    await db.exec("select set_config('gi.test_agent', 'tm', false)");
    const asTeam = await db.query("select count(*)::int as n from public.gi_agent_activity_log");
    await db.exec("reset role");
    assert(asManager.rows[0].n === 3, "a manager sees every row");
    assert(asTeam.rows[0].n === 3, "a team manager sees every row");
    const notes = await db.query("select policyname from pg_policies where tablename = 'notes'");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    await db.exec(base
      .replace("agent_id text", "note text")
      .replace("insert into public.gi_agent_activity_log(id, agent_id) values\n      ('mine', 'a1'),\n      ('other', 'a2');", "insert into public.gi_agent_activity_log(id) values ('mine');"));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/agent_id column is missing; nothing saved/i.test(blocked), "a missing agent_id column saves nothing");
    const open = await db.query("select count(*)::int as n from pg_policies where policyname = 'actlog_select_authenticated'");
    assert(open.rows[0].n === 1, "the open read stays when agent_id is missing");
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
