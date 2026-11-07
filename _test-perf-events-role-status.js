/**
 * The performance-event role status only reads policies and the agent_id column.
 * Run: node _test-perf-events-role-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-perf-events-role-status.sql"), "utf8");
const code = executable(sql);

console.log("1) the file only reads");
assert(code.includes("public.gi_perf_events"), "it looks at the performance events table");
assert(code.includes("agent_id"), "it checks the agent_id column");
assert(code.includes("teamManager|opsAgent"), "it flags a capital-letter role comparison");
assert(code.includes("blank_agent"), "it flags a blank agent_id comparison");
assert(code.includes("pg_policies"), "it reads policies");
assert(code.includes("'changed', 'no'"), "it reports that nothing changed");
assert(!/create\s+policy/i.test(code), "it does not create a policy");
assert(!/drop\s+policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/from\s+public\.gi_perf_events/i.test(code), "it does not read events");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write an event");
assert(!/public\.customers|public\.proposals|public\.agents|public\.app_meta|gi_chat_messages|gi_ops_events|owner_devices/i.test(code), "other tables are not named");

function bySection(rows){
  return Object.fromEntries(rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
}

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  {
    const db = new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create table public.gi_perf_events (
        id text primary key,
        agent_id text,
        note text
      );
      create table public.notes (id text primary key);
      insert into public.gi_perf_events(id, agent_id, note) values ('ev', '', 'secret');
      alter table public.gi_perf_events enable row level security;
      alter table public.notes enable row level security;
      create policy gi_perf_events_all_authenticated on public.gi_perf_events
        for all to authenticated using (true) with check (true);
      create policy perf_events_select_authenticated on public.gi_perf_events
        for select to authenticated using (true);
      create policy perf_events_insert_authenticated on public.gi_perf_events
        for insert to authenticated
        with check (agent_id = '' or agent_id = 'teamManager');
      create policy notes_select_own on public.notes
        for select to authenticated using (true);
    `);
    const rows = await rowsOf(db);
    const header = bySection(rows);
    assert(header.table === "gi_perf_events", "the result names the performance events table");
    assert(header.present === "yes", "the table is present");
    assert(header.rls === "yes", "row security is reported");
    assert(header.agent_id === "yes", "the agent_id column is reported");
    assert(header.role_literal === "mixed", "a capital-letter role comparison is reported");
    assert(header.blank_agent === "yes", "a blank agent_id comparison is reported");
    assert(header.changed === "no", "nothing is changed");
    assert(rows.some((row) => row.detail === "gi_perf_events_all_authenticated|ALL|signed_in|open"), "the open signed-in path is named");
    assert(rows.some((row) => row.detail === "perf_events_select_authenticated|SELECT|signed_in|open"), "an open select is named");
    assert(rows.some((row) => row.detail === "perf_events_insert_authenticated|INSERT|signed_in|limited"), "a limited insert is named");
    assert(!rows.some((row) => String(row.detail).includes("notes_select_own")), "another table is not listed");
    assert(!rows.some((row) => String(row.detail).includes("secret")), "an event row is not returned");
    const policies = await db.query(`select count(*)::int as n from pg_policies where tablename = 'gi_perf_events'`);
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    const still = await db.query(`select id from public.gi_perf_events`);
    assert(policies.rows[0].n === 3, "the check does not add a policy");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the notes table stays");
    assert(still.rows.length === 1 && still.rows[0].id === "ev", "the event row stays");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create role authenticated nologin;
      create table public.gi_perf_events (
        id text primary key,
        agent_id text
      );
      alter table public.gi_perf_events enable row level security;
      create policy perf_events_select_authenticated on public.gi_perf_events
        for select to authenticated
        using (agent_id = 'agent-1');
    `);
    const header = bySection(await rowsOf(db));
    assert(header.agent_id === "yes", "agent_id is still reported");
    assert(header.role_literal === "lower", "a lowercase comparison is not mixed");
    assert(header.blank_agent === "no", "an owned comparison is not a blank agent_id");
    assert(header.changed === "no", "the owned comparison changes nothing");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.gi_perf_events (id text primary key);
      alter table public.gi_perf_events enable row level security;
    `);
    const header = bySection(await rowsOf(db));
    assert(header.present === "yes" && header.rls === "yes", "row security on is reported");
    assert(header.agent_id === "no", "a missing agent_id column is reported");
    assert(header.role_literal === "lower" && header.blank_agent === "no", "no policy means no extra flags");
    assert(header.changed === "no", "a quiet table is not changed");
  }

  {
    const db = new PGlite();
    const header = bySection(await rowsOf(db));
    assert(header.table === "gi_perf_events" && header.present === "no" && header.changed === "no", "a missing table is reported and nothing is saved");
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
