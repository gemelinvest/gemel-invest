/**
 * The agent role status only reads policies and column names.
 * Run: node _test-agents-role-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-agents-role-status.sql"), "utf8");
const code = executable(sql);

console.log("1) the file only reads");
assert(code.includes("public.agents"), "it looks at the agents table");
assert(code.includes("column_name = 'pin'") && code.includes("column_name = 'auth_user_id'"), "it checks the sensitive columns");
assert(code.includes("column_name"), "it reports the column names");
assert(code.includes("teamManager|opsAgent"), "it flags a capital-letter role comparison");
assert(code.includes("blank_id"), "it flags a blank id comparison");
assert(code.includes("pg_policies"), "it reads policies");
assert(code.includes("'changed', 'no'"), "it reports that nothing changed");
assert(!/create\s+policy/i.test(code), "it does not create a policy");
assert(!/drop\s+policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/from\s+public\.agents/i.test(code), "it does not read an agent");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write an agent");
assert(!/public\.customers|public\.proposals|public\.app_meta|gi_agent_live|owner_devices/i.test(code), "other tables are not named");

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
      create table public.agents (
        id text primary key,
        name text,
        pin text,
        role text
      );
      create table public.notes (id text primary key);
      insert into public.agents(id, name, pin, role) values ('a1', 'One', 'secret', 'agent');
      alter table public.agents enable row level security;
      alter table public.notes enable row level security;
      create policy gi_agents_all_authenticated on public.agents
        for all to authenticated using (true) with check (true);
      create policy agents_select_authenticated on public.agents
        for select to authenticated using (true);
      create policy agents_insert_authenticated on public.agents
        for insert to authenticated
        with check (id = '' or id = 'teamManager');
      create policy z_block_anon_delete on public.agents
        for delete to public using (false);
      create policy notes_select_own on public.notes
        for select to authenticated using (true);
    `);
    const rows = await rowsOf(db);
    const header = bySection(rows);
    assert(header.table === "agents", "the result names the agents table");
    assert(header.present === "yes" && header.rls === "yes", "row security is reported");
    assert(header.pin === "yes" && header.role === "yes", "pin and role columns are reported");
    assert(header.email === "no" && header.auth_user_id === "no", "missing identity columns are reported");
    assert(header.columns === "id|name|pin|role", "the column names are reported");
    assert(header.role_literal === "mixed", "a capital-letter role comparison is reported");
    assert(header.blank_id === "yes", "a blank id comparison is reported");
    assert(header.changed === "no", "nothing is changed");
    assert(rows.some((row) => row.detail === "gi_agents_all_authenticated|ALL|signed_in|open"), "the open signed-in path is named");
    assert(rows.some((row) => row.detail === "agents_select_authenticated|SELECT|signed_in|open"), "an open select is named");
    assert(rows.some((row) => row.detail === "agents_insert_authenticated|INSERT|signed_in|limited"), "a limited insert is named");
    assert(rows.some((row) => row.detail === "z_block_anon_delete|DELETE|public|limited"), "the public delete block is named");
    assert(!rows.some((row) => String(row.detail).includes("notes_select_own")), "another table is not listed");
    assert(!rows.some((row) => String(row.detail).includes("secret")), "an agent value is not returned");
    const policies = await db.query(`select count(*)::int as n from pg_policies where tablename = 'agents'`);
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    const still = await db.query(`select id from public.agents`);
    assert(policies.rows[0].n === 4, "the check does not add a policy");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the notes table stays");
    assert(still.rows.length === 1 && still.rows[0].id === "a1", "the agent row stays");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create role authenticated nologin;
      create table public.agents (
        id text primary key,
        name text
      );
      alter table public.agents enable row level security;
      create policy agents_select_authenticated on public.agents
        for select to authenticated
        using (id = 'agent-1');
    `);
    const header = bySection(await rowsOf(db));
    assert(header.pin === "no" && header.columns === "id|name", "a missing pin column is reported");
    assert(header.role_literal === "lower" && header.blank_id === "no", "an owned id is not a blank id");
    assert(header.changed === "no", "the owned comparison changes nothing");
  }

  {
    const db = new PGlite();
    const header = bySection(await rowsOf(db));
    assert(header.table === "agents" && header.present === "no" && header.changed === "no", "a missing table is reported and nothing is saved");
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
