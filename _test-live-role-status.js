/**
 * The live-floor and system-notice status only reads policies and column names.
 * Run: node _test-live-role-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-live-role-status.sql"), "utf8");
const code = executable(sql);

console.log("1) the file only reads");
assert(code.includes("'gi_agent_live'"), "it looks at the live floor");
assert(code.includes("'gi_system_notices'"), "it looks at system notices");
assert(code.includes("agent_id") && code.includes("author_id"), "it checks the person columns");
assert(code.includes("column_name"), "it reports the column names");
assert(code.includes("teamManager|opsAgent"), "it flags a capital-letter role comparison");
assert(code.includes("blank_agent") && code.includes("blank_author"), "it flags a blank person comparison");
assert(code.includes("pg_policies"), "it reads policies");
assert(code.includes("'changed', 'no'"), "it reports that nothing changed");
assert(!/create\s+policy/i.test(code), "it does not create a policy");
assert(!/drop\s+policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/from\s+public\.gi_agent_live/i.test(code), "it does not read the floor");
assert(!/from\s+public\.gi_system_notices/i.test(code), "it does not read a notice");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a row");
assert(!/public\.customers|public\.proposals|public\.agents|public\.app_meta|owner_devices|gi_perf_events/i.test(code), "other tables are not named");

function groups(rows){
  const out = [];
  let current = null;
  rows.forEach((row) => {
    if(row.section === "table"){
      current = { table: row.detail, rows: [] };
      out.push(current);
    }
    if(current) current.rows.push(row);
  });
  return out;
}

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
      create table public.gi_agent_live (
        id text primary key,
        agent_id text,
        name text
      );
      create table public.gi_system_notices (
        id text primary key,
        body text,
        author_id text,
        author_name text
      );
      create table public.notes (id text primary key);
      insert into public.gi_agent_live(id, agent_id, name) values ('me', '', 'secret');
      insert into public.gi_system_notices(id, body, author_id, author_name) values ('n1', 'secret', '', 'Boss');
      alter table public.gi_agent_live enable row level security;
      alter table public.gi_system_notices enable row level security;
      alter table public.notes enable row level security;
      create policy agent_live_select_authenticated on public.gi_agent_live
        for select to authenticated using (true);
      create policy agent_live_upsert_authenticated on public.gi_agent_live
        for insert to authenticated
        with check (agent_id = '' or agent_id = 'teamManager');
      create policy gi_agent_live_update_open on public.gi_agent_live
        for update to authenticated using (true) with check (true);
      create policy system_notices_select_authenticated on public.gi_system_notices
        for select to authenticated using (true);
      create policy system_notices_insert_authenticated on public.gi_system_notices
        for insert to authenticated with check (true);
      create policy gi_system_notices_read on public.gi_system_notices
        for select to public using (true);
      create policy notes_select_own on public.notes
        for select to authenticated using (true);
    `);
    const grouped = groups(await rowsOf(db));
    assert(grouped.map((group) => group.table).join(",") === "gi_agent_live,gi_system_notices", "the two tables are reported in order");
    const live = bySection(grouped[0].rows);
    const notices = bySection(grouped[1].rows);
    assert(live.present === "yes" && live.rls === "yes", "the floor is present with row security");
    assert(live.agent_id === "yes", "the floor agent_id column is reported");
    assert(live.columns === "id|agent_id|name", "the floor columns are named");
    assert(live.role_literal === "mixed", "a capital-letter role comparison is reported");
    assert(live.blank_agent === "yes", "a blank agent_id comparison is reported");
    assert(live.changed === "no", "the floor is not changed");
    assert(grouped[0].rows.some((row) => row.detail === "agent_live_select_authenticated|SELECT|signed_in|open"), "the open floor read is named");
    assert(grouped[0].rows.some((row) => row.detail === "agent_live_upsert_authenticated|INSERT|signed_in|limited"), "the limited floor insert is named");
    assert(grouped[0].rows.some((row) => row.detail === "gi_agent_live_update_open|UPDATE|signed_in|open"), "the open floor update is named");
    assert(notices.present === "yes" && notices.rls === "yes", "notices are present with row security");
    assert(notices.author_id === "yes" && notices.author_name === "yes", "the notice author columns are reported");
    assert(notices.columns === "id|body|author_id|author_name", "the notice columns are named");
    assert(notices.role_literal === "lower" && notices.blank_author === "no", "an open notice insert is not a blank author");
    assert(notices.changed === "no", "notices are not changed");
    assert(grouped[1].rows.some((row) => row.detail === "system_notices_select_authenticated|SELECT|signed_in|open"), "the open notice read is named");
    assert(grouped[1].rows.some((row) => row.detail === "system_notices_insert_authenticated|INSERT|signed_in|open"), "the open notice insert is named");
    assert(grouped[1].rows.some((row) => row.detail === "gi_system_notices_read|SELECT|public|open"), "a public notice read is named");
    assert(!grouped.some((group) => group.rows.some((row) => String(row.detail).includes("notes_select_own"))), "another table is not listed");
    assert(!grouped.some((group) => group.rows.some((row) => String(row.detail).includes("secret"))), "a stored row is not returned");
    const policies = await db.query(`select count(*)::int as n from pg_policies where tablename in ('gi_agent_live', 'gi_system_notices')`);
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    const still = await db.query(`select id from public.gi_agent_live`);
    assert(policies.rows[0].n === 6, "the check does not add a policy");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the notes table stays");
    assert(still.rows.length === 1 && still.rows[0].id === "me", "the floor row stays");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create role authenticated nologin;
      create table public.gi_agent_live (
        id text primary key,
        agent_id text
      );
      alter table public.gi_agent_live enable row level security;
      create policy agent_live_select_authenticated on public.gi_agent_live
        for select to authenticated
        using (agent_id = 'agent-1');
    `);
    const grouped = groups(await rowsOf(db));
    const live = bySection(grouped[0].rows);
    const notices = bySection(grouped[1].rows);
    assert(live.agent_id === "yes" && live.columns === "id|agent_id", "the floor columns stay accurate");
    assert(live.role_literal === "lower" && live.blank_agent === "no", "an owned comparison is not a blank agent");
    assert(grouped[0].rows.some((row) => row.detail === "agent_live_select_authenticated|SELECT|signed_in|limited"), "a limited floor read is named");
    assert(notices.table === "gi_system_notices" && notices.present === "no" && notices.changed === "no", "a missing notice table is reported");
  }

  {
    const db = new PGlite();
    const header = bySection(groups(await rowsOf(db))[0].rows);
    const second = bySection(groups(await rowsOf(db))[1].rows);
    assert(header.table === "gi_agent_live" && header.present === "no" && header.changed === "no", "a missing floor is reported");
    assert(second.table === "gi_system_notices" && second.present === "no" && second.changed === "no", "a missing notice table is reported when both are absent");
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
