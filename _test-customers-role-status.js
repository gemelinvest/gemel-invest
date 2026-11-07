/**
 * The customers role status only reads policies and the ownership columns.
 * Run: node _test-customers-role-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-customers-role-status.sql"), "utf8");
const code = executable(sql);

console.log("1) the file only reads");
assert(code.includes("public.customers"), "it looks at the customers table");
assert(code.includes("agent_id"), "it checks the agent_id column");
assert(code.includes("agent_name"), "it checks the agent_name column");
assert(code.includes("agent_role"), "it checks the agent_role column");
assert(code.includes("team_manager_id"), "it checks the team manager column");
assert(code.includes("teamManager|opsAgent"), "it flags a capital-letter role comparison");
assert(code.includes("blank_agent"), "it flags a blank agent_id comparison");
assert(code.includes("pg_policies"), "it reads policies");
assert(code.includes("'changed', 'no'"), "it reports that nothing changed");
assert(!/create\s+policy/i.test(code), "it does not create a policy");
assert(!/drop\s+policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/from\s+public\.customers/i.test(code), "it does not read customer rows");
assert(!/from\s+public\.agents/i.test(code), "it does not read agent rows");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a customer");
assert(!/payload|full_name|id_number|phone/i.test(code), "customer fields are not selected");
assert(!/campaign_leads|gi_agent_activity_log|gi_cancellations_report|gi_daily_report|public\.proposals|public\.app_meta/i.test(code), "other tables are not named");

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
      create table public.agents (id text primary key, team_manager_id text);
      create table public.customers (
        id text primary key,
        agent_id text,
        agent_name text,
        agent_role text
      );
      create table public.proposals (id text primary key);
      insert into public.customers(id, agent_id) values ('active', '');
      alter table public.customers enable row level security;
      alter table public.proposals enable row level security;
      create policy gi_customers_all_authenticated on public.customers
        for all to authenticated using (true) with check (true);
      create policy customers_select_own_shadow on public.customers
        for select to authenticated
        using (agent_id = 'teamManager' or coalesce(agent_id, '') = '');
      create policy z_block_anon_delete on public.customers
        as restrictive for delete to anon using (false);
      create policy proposals_select_own on public.proposals
        for select to authenticated using (true);
    `);
    const rows = await rowsOf(db);
    const header = bySection(rows);
    assert(header.table === "customers", "the result names the customers table");
    assert(header.present === "yes", "the table is present");
    assert(header.rls === "yes", "row security is reported");
    assert(header.agent_id === "yes", "agent_id is reported");
    assert(header.agent_name === "yes", "agent_name is reported");
    assert(header.agent_role === "yes", "agent_role is reported");
    assert(header.team_manager_id === "yes", "team_manager_id is reported");
    assert(header.role_literal === "mixed", "a capital-letter role comparison is reported");
    assert(header.blank_agent === "yes", "a blank agent_id comparison is reported");
    assert(header.changed === "no", "nothing is changed");
    assert(rows.some((row) => row.detail === "gi_customers_all_authenticated|ALL|signed_in|open"), "the open signed-in path is named");
    assert(rows.some((row) => row.detail === "customers_select_own_shadow|SELECT|signed_in|limited"), "a limited select is named");
    assert(rows.some((row) => row.detail === "z_block_anon_delete|DELETE|public|limited"), "the anon delete block is named");
    assert(!rows.some((row) => String(row.detail).includes("proposals_select_own")), "another table is not listed");
    assert(!rows.some((row) => String(row.detail).includes("active")), "a customer row is not returned");
    const policies = await db.query(`select count(*)::int as n from pg_policies where tablename = 'customers'`);
    const proposals = await db.query(`select policyname from pg_policies where tablename = 'proposals'`);
    const still = await db.query(`select id from public.customers`);
    assert(policies.rows[0].n === 3, "the check does not add a policy");
    assert(proposals.rows.length === 1 && proposals.rows[0].policyname === "proposals_select_own", "the proposals table stays");
    assert(still.rows.length === 1 && still.rows[0].id === "active", "the customer row stays");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create role authenticated nologin;
      create table public.agents (id text primary key, team_manager_id text);
      create table public.customers (
        id text primary key,
        agent_id text,
        agent_name text,
        agent_role text
      );
      alter table public.customers enable row level security;
      create policy customers_select_own_shadow on public.customers
        for select to authenticated
        using (agent_id = 'agent-1');
    `);
    const header = bySection(await rowsOf(db));
    assert(header.role_literal === "lower", "a lowercase comparison is not mixed");
    assert(header.blank_agent === "no", "an owned comparison is not a blank agent_id");
    assert(header.changed === "no", "the owned comparison changes nothing");
  }

  {
    const db = new PGlite();
    await db.exec(`create table public.customers (id text primary key);`);
    const header = bySection(await rowsOf(db));
    assert(header.present === "yes" && header.rls === "no", "row security off is reported");
    assert(header.agent_id === "no" && header.agent_name === "no" && header.agent_role === "no", "missing customer columns are reported");
    assert(header.team_manager_id === "no", "a missing agents column is reported");
    assert(header.role_literal === "lower" && header.blank_agent === "no", "no policy means no extra flags");
    assert(header.changed === "no", "a quiet table is not changed");
  }

  {
    const db = new PGlite();
    const header = bySection(await rowsOf(db));
    assert(header.table === "customers" && header.present === "no" && header.changed === "no", "a missing table is reported and nothing is saved");
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
