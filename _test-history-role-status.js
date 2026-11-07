/**
 * The history role status only reads policies and column names.
 * Run: node _test-history-role-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-history-role-status.sql"), "utf8");
const code = executable(sql);

console.log("1) the file only reads the three history tables");
assert(code.includes("'agents_history'") && code.includes("'customers_history'") && code.includes("'proposals_history'"), "it names the three tables");
assert(code.includes("column_name = 'agent_id'") && code.includes("column_name = 'customer_id'") && code.includes("column_name = 'proposal_id'"), "it checks the owner columns");
assert(code.includes("teamManager|opsAgent"), "it flags a capital-letter role comparison");
assert(code.includes("blank_owner"), "it flags a blank owner comparison");
assert(code.includes("'changed', 'no'"), "it reports that nothing changed");
assert(!/create\s+policy/i.test(code), "it does not create a policy");
assert(!/drop\s+policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/from\s+public\.(agents_history|customers_history|proposals_history)/i.test(code), "it does not read a history row");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a history row");

function byTable(rows){
  const out = {};
  let current = "";
  rows.forEach((row) => {
    if(row.section === "table"){
      current = row.detail;
      out[current] = {};
      return;
    }
    if(row.section === "policy"){
      out[current].policies = out[current].policies || [];
      out[current].policies.push(row.detail);
      return;
    }
    out[current][row.section] = row.detail;
  });
  return out;
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
      create function public.gi_jwt_agent_id() returns text language sql stable as $$ select 'a1' $$;
      create table public.agents_history (id text primary key, agent_id text);
      create table public.customers_history (id text primary key, customer_id text);
      create table public.proposals_history (id text primary key, proposal_id text, note text);
      create table public.notes (id text primary key);
      insert into public.agents_history(id, agent_id) values ('h1', 'Ada');
      insert into public.customers_history(id, customer_id) values ('h2', 'c1');
      insert into public.proposals_history(id, proposal_id, note) values ('h3', 'p1', 'kept');
      alter table public.agents_history enable row level security;
      alter table public.customers_history enable row level security;
      alter table public.proposals_history enable row level security;
      alter table public.notes enable row level security;
      create policy notes_select_own on public.notes for select to authenticated using (true);
      create policy agents_history_select_authenticated on public.agents_history
        for select to authenticated using (true);
      create policy agents_history_insert_authenticated on public.agents_history
        for insert to authenticated
        with check (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id());
      create policy agents_history_update_open on public.agents_history
        for update to authenticated using (true) with check (true);
      create policy z_block_anon_delete on public.agents_history
        for delete to public using (false);
      create policy customers_history_select_authenticated on public.customers_history
        for select to authenticated using (customer_id = '');
      create policy customers_history_insert_authenticated on public.customers_history
        for insert to authenticated with check (true);
      create policy proposals_history_select_authenticated on public.proposals_history
        for select to authenticated using (true);
    `);
    const got = byTable(await rowsOf(db));
    assert(got.agents_history.present === "yes" && got.agents_history.rls === "yes", "agent history is present");
    assert(got.agents_history.agent_id === "yes" && got.agents_history.customer_id === "no" && got.agents_history.proposal_id === "no", "agent history columns are reported");
    assert(got.agents_history.columns === "id|agent_id", "agent history lists its columns");
    assert(got.agents_history.role_literal === "lower" && got.agents_history.blank_owner === "no" && got.agents_history.changed === "no", "agent history changes nothing");
    assert(got.agents_history.policies.includes("agents_history|agents_history_select_authenticated|SELECT|signed_in|open"), "the open agent read is reported");
    assert(got.agents_history.policies.includes("agents_history|agents_history_insert_authenticated|INSERT|signed_in|limited"), "the name match is not called open");
    assert(got.agents_history.policies.includes("agents_history|z_block_anon_delete|DELETE|public|limited"), "the public delete block is reported");
    assert(got.customers_history.customer_id === "yes" && got.customers_history.blank_owner === "yes", "a blank customer comparison is flagged");
    assert(got.customers_history.policies.includes("customers_history|customers_history_insert_authenticated|INSERT|signed_in|open"), "the open customer insert is reported");
    assert(got.proposals_history.proposal_id === "yes" && got.proposals_history.columns === "id|proposal_id|note", "proposal history lists its columns");
    const left = await db.query("select count(*)::int as n from public.agents_history");
    const notes = await db.query("select count(*)::int as n from pg_policies where tablename = 'notes'");
    assert(left.rows[0].n === 1 && notes.rows[0].n === 1, "stored rows and the other table stay");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.agents_history (id text primary key);
      alter table public.agents_history enable row level security;
    `);
    const got = byTable(await rowsOf(db));
    assert(got.agents_history.present === "yes" && got.agents_history.changed === "no", "the present table is still described");
    assert(got.customers_history.present === "no" && got.customers_history.changed === "no", "a missing customer history table is reported");
    assert(got.proposals_history.present === "no" && got.proposals_history.changed === "no", "a missing proposal history table is reported");
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
