/**
 * The live-table check only reports policy names for three tables.
 * It does not add or remove one.
 * Run: node _test-live-policy-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-live-policy-status.sql"), "utf8");
const code = executable(sql);
const readable = code.replace(/\$body\$/g, "");

console.log("1) the file only reads three live tables");
["gi_agent_live", "gi_system_notices", "gi_ops_events"].forEach((name) => {
  assert(code.includes(name), "it looks at " + name);
});
assert(!/create policy/i.test(code), "it does not create a policy");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a stored row");
assert(!/\b(payload|phone|email|pin|agent_name|body)\b/i.test(readable), "stored fields are not selected");
assert(!/public\.agents|public\.app_meta|public\.customers|public\.proposals|gi_chat_messages|gi_simulator_saves/i.test(code), "other tables are not named");

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

  {
    const db = new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create table public.gi_agent_live (id text primary key);
      create table public.gi_system_notices (id text primary key);
      create table public.gi_ops_events (id text primary key);
      create table public.notes (id text primary key);
      insert into public.gi_agent_live(id) values ('active');
      alter table public.gi_agent_live enable row level security;
      alter table public.gi_system_notices enable row level security;
      alter table public.notes enable row level security;
      create policy gi_agent_live_read on public.gi_agent_live
        for all to anon, authenticated using (true) with check (true);
      create policy agent_live_select_authenticated on public.gi_agent_live
        for select to authenticated using (false);
      create policy gi_ops_ev_all on public.gi_ops_events
        for all to public using (true) with check (true);
      create policy notes_select_own on public.notes
        for select to authenticated using (true);
    `);
    const grouped = groups(await rowsOf(db));
    assert(grouped.map((group) => group.table).join(",") === "gi_agent_live,gi_system_notices,gi_ops_events", "the three tables are reported in order");
    const live = Object.fromEntries(grouped[0].rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
    const notices = Object.fromEntries(grouped[1].rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
    const ops = Object.fromEntries(grouped[2].rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
    assert(live.rls_enabled === "yes" && live.rows_present === "yes" && live.open_read === "yes" && live.changed === "no", "presence is reported without a change");
    assert(grouped[0].rows.some((row) => row.detail === "gi_agent_live|gi_agent_live_read|ALL|public+signed_in|open"), "the open presence door is named");
    assert(grouped[0].rows.some((row) => row.detail === "gi_agent_live|agent_live_select_authenticated|SELECT|signed_in|limited"), "a signed-in presence limit is named");
    assert(notices.rls_enabled === "yes" && notices.rows_present === "no" && notices.open_read === "no" && notices.changed === "no", "notices are reported with no open read");
    assert(ops.rls_enabled === "no" && ops.open_read === "yes" && ops.changed === "no", "ops events keep their reported open read and row security is not switched on");
    assert(!grouped.some((group) => group.rows.some((row) => String(row.detail).includes("notes_select_own"))), "another table is not listed");
    const policies = await db.query(`select count(*)::int as n from pg_policies where tablename in ('gi_agent_live', 'gi_system_notices', 'gi_ops_events')`);
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(policies.rows[0].n === 3, "the check does not add a policy");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.gi_agent_live (id text primary key);
      create table public.gi_ops_events (id text primary key);
    `);
    const grouped = groups(await rowsOf(db));
    const notices = grouped.find((group) => group.table === "gi_system_notices");
    const bySection = Object.fromEntries(notices.rows.map((row) => [row.section, row.detail]));
    assert(bySection.present === "no" && bySection.changed === "no", "a missing table is reported and the others are still read");
    assert(grouped.filter((group) => group.table !== "gi_system_notices").every((group) => group.rows.some((row) => row.section === "rls_enabled")), "the tables that exist are still described");
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
