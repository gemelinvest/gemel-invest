/**
 * Performance events follow the owner. A manager can read and write every
 * event. Anyone else can read and write an event with their agent_id.
 * A blank event stays with a manager. The open signed-in paths are removed.
 * Run: node _test-perf-events-by-role.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-perf-events-by-role.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes the open paths and rewrites the event policies");
assert(code.includes("drop policy gi_perf_events_all_authenticated"), "it removes the open path");
assert(code.includes("perf_events_update_authenticated"), "it adds an update for the owner");
assert(code.includes("perf_events_delete_authenticated"), "it adds a delete for the owner");
assert(code.includes("gi_jwt_is_manager()"), "a manager can read every event");
assert(code.includes("coalesce(agent_id, '') = public.gi_jwt_agent_id()"), "anyone else is limited to their own event");
assert(!code.includes("'opsagent'"), "an operations user is not given every event");
assert(!code.includes("coalesce(agent_id, '') = ''"), "it does not leave a blank agent_id open");
assert(!/from\s+public\.gi_perf_events/i.test(code), "it does not read events");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/public\.customers|public\.proposals|public\.agents|public\.app_meta|gi_chat_messages|gi_ops_events|owner_devices/i.test(code), "other tables are not named");

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
    create table public.gi_perf_events (
      id text primary key,
      agent_id text,
      note text
    );
    create table public.notes (id text primary key);
    grant select, insert, update, delete on public.gi_perf_events to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.gi_perf_events(id, agent_id, note) values
      ('mine', 'a1', '1'),
      ('other', 'a2', '2'),
      ('blank', '', '3');
    alter table public.gi_perf_events enable row level security;
    alter table public.notes enable row level security;
    create function public.gi_jwt_agent_id() returns text language sql stable as $$
      select coalesce(current_setting('gi.test_agent', true), '')
    $$;
    create function public.gi_jwt_is_manager() returns boolean language sql stable as $$
      select coalesce(current_setting('gi.test_manager', true), '') = 'yes'
    $$;
    create policy notes_select_own on public.notes for select to authenticated using (true);
    create policy gi_perf_events_all_authenticated on public.gi_perf_events
      for all to authenticated using (true) with check (true);
    create policy perf_events_select_authenticated on public.gi_perf_events
      for select to authenticated using (true);
    create policy perf_events_insert_authenticated on public.gi_perf_events
      for insert to authenticated
      with check (public.gi_jwt_is_manager());
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  async function asUser(db, agent, manager){
    await db.exec("set role authenticated");
    await db.exec("select set_config('gi.test_agent', '" + agent + "', false)");
    await db.exec("select set_config('gi.test_manager', '" + (manager ? "yes" : "") + "', false)");
  }

  {
    const db = new PGlite();
    await db.exec(base);
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("policies_removed=gi_perf_events_all_authenticated"), "the open path is removed");
    assert(details.includes("select_by_role=installed") && details.includes("write_by_role=installed"), "the event policies are installed");
    assert(details.includes("blank_agent=closed") && details.includes("other_tables=unchanged"), "the blank path is closed and other tables stay");
    assert(details.includes("changed=yes"), "the cut is reported");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.includes("changed=no"), "a second run removes nothing");

    await db.exec("set role anon");
    const anonRead = await db.query("select count(*)::int as n from public.gi_perf_events");
    await db.exec("reset role");
    assert(anonRead.rows[0].n === 0, "anon still cannot read");

    await asUser(db, "a1", false);
    const ownIds = await db.query("select id from public.gi_perf_events order by id");
    await db.exec("update public.gi_perf_events set note = 'x' where id = 'other'");
    let foreignInsert = "";
    try {
      await db.exec("insert into public.gi_perf_events(id, agent_id, note) values ('nope', 'a2', '9')");
      foreignInsert = "wrote";
    } catch(err) {
      foreignInsert = String(err && err.message || err);
    }
    await db.exec("insert into public.gi_perf_events(id, agent_id, note) values ('added', 'a1', '4')");
    await db.exec("update public.gi_perf_events set note = 'kept' where id = 'mine'");
    await db.exec("delete from public.gi_perf_events where id = 'other'");
    await db.exec("delete from public.gi_perf_events where id = 'mine'");
    await db.exec("reset role");
    const seen = ownIds.rows.map((row) => row.id);
    const otherNote = await db.query("select note from public.gi_perf_events where id = 'other'");
    const mine = await db.query("select count(*)::int as n from public.gi_perf_events where id = 'mine'");
    const added = await db.query("select count(*)::int as n from public.gi_perf_events where id = 'added'");
    assert(seen.join(",") === "mine", "a person sees only their own event");
    assert(otherNote.rows[0].note === "2", "a person cannot change another event");
    assert(/row-level security/i.test(foreignInsert), "a person cannot insert another person's event");
    assert(added.rows[0].n === 1, "a person can add their own event");
    assert(mine.rows[0].n === 0, "a person can delete their own event");

    await asUser(db, "ops", false);
    const opsCount = await db.query("select count(*)::int as n from public.gi_perf_events");
    await db.exec("reset role");
    assert(opsCount.rows[0].n === 0, "an operations user does not see every event");

    await asUser(db, "boss", true);
    const managerCount = await db.query("select count(*)::int as n from public.gi_perf_events");
    await db.exec("update public.gi_perf_events set agent_id = 'a1' where id = 'blank'");
    await db.exec("reset role");
    const assigned = await db.query("select agent_id from public.gi_perf_events where id = 'blank'");
    assert(managerCount.rows[0].n === 3, "a manager sees every remaining event");
    assert(assigned.rows[0].agent_id === "a1", "a manager can assign a blank event");

    const open = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_perf_events_all_authenticated'");
    const notes = await db.query("select policyname from pg_policies where tablename = 'notes'");
    assert(open.rows[0].n === 0, "the open path stays removed");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    const missingColumn = base
      .replace("      agent_id text,\n", "")
      .replace(", agent_id, note) values", ", note) values")
      .replace(/, 'a1'/g, "")
      .replace(/, 'a2'/g, "")
      .replace(/, ''/g, "");
    await db.exec(missingColumn);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/agent_id column is missing; nothing saved/i.test(blocked), "a missing agent_id column saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_perf_events_all_authenticated'");
    assert(stillOpen.rows[0].n === 1, "the open path stays when the column is missing");
  }

  {
    const db = new PGlite();
    await db.exec(base + `
      create policy perf_events_extra on public.gi_perf_events for select to authenticated using (false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/not the expected open set; nothing saved/i.test(blocked), "an unexpected policy saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_perf_events_all_authenticated'");
    assert(stillOpen.rows[0].n === 1, "the open path stays when the set is unexpected");
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
