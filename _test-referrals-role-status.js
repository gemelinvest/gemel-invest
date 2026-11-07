/**
 * The elementary-referral role status only reads policies and ownership columns.
 * Run: node _test-referrals-role-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-referrals-role-status.sql"), "utf8");
const code = executable(sql);

console.log("1) the file only reads");
assert(code.includes("public.gi_elementary_referrals"), "it looks at the referrals table");
assert(code.includes("agent_id"), "it checks the agent_id column");
assert(code.includes("agent_name"), "it checks the agent_name column");
assert(code.includes("teamManager|opsAgent"), "it flags a capital-letter role comparison");
assert(code.includes("blank_agent"), "it flags a blank agent_id comparison");
assert(code.includes("pg_policies"), "it reads policies");
assert(code.includes("'changed', 'no'"), "it reports that nothing changed");
assert(!/create\s+policy/i.test(code), "it does not create a policy");
assert(!/drop\s+policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/from\s+public\.gi_elementary_referrals/i.test(code), "it does not read referrals");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a referral");
assert(!/payload|customer_id/i.test(code), "referral fields are not selected");
assert(!/public\.customers|public\.proposals|public\.agents|public\.app_meta|gi_chat_messages|gi_perf_events|owner_devices/i.test(code), "other tables are not named");

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
      create table public.gi_elementary_referrals (
        id text primary key,
        agent_id text,
        customer_id text
      );
      create table public.notes (id text primary key);
      insert into public.gi_elementary_referrals(id, agent_id, customer_id)
        values ('ref', '', 'secret customer');
      alter table public.gi_elementary_referrals enable row level security;
      alter table public.notes enable row level security;
      create policy gi_elementary_referrals_all_authenticated on public.gi_elementary_referrals
        for all to authenticated using (true) with check (true);
      create policy elem_ref_select_authenticated on public.gi_elementary_referrals
        for select to authenticated
        using (coalesce(agent_id, '') = '' or agent_id = 'agent-1');
      create policy elem_ref_insert_authenticated on public.gi_elementary_referrals
        for insert to authenticated
        with check (agent_id is null or agent_id = 'agent-1');
      create policy elem_ref_update_authenticated on public.gi_elementary_referrals
        for update to authenticated
        using (agent_id = 'teamManager')
        with check (agent_id = 'agent-1');
      create policy z_block_anon_delete on public.gi_elementary_referrals
        for delete to anon using (false);
      create policy notes_select_own on public.notes
        for select to authenticated using (true);
    `);
    const rows = await rowsOf(db);
    const header = bySection(rows);
    assert(header.table === "gi_elementary_referrals", "the result names the referrals table");
    assert(header.present === "yes", "the table is present");
    assert(header.rls === "yes", "row security is reported");
    assert(header.agent_id === "yes", "the agent_id column is reported");
    assert(header.agent_name === "no", "a missing agent_name column is reported");
    assert(header.role_literal === "mixed", "a capital-letter role comparison is reported");
    assert(header.blank_agent === "yes", "a blank agent_id comparison is reported");
    assert(header.changed === "no", "nothing is changed");
    assert(rows.some((row) => row.detail === "gi_elementary_referrals_all_authenticated|ALL|signed_in|open"), "the open signed-in path is named");
    assert(rows.some((row) => row.detail === "elem_ref_select_authenticated|SELECT|signed_in|limited"), "a limited select is named");
    assert(rows.some((row) => row.detail === "elem_ref_insert_authenticated|INSERT|signed_in|limited"), "a limited insert is named");
    assert(rows.some((row) => row.detail === "elem_ref_update_authenticated|UPDATE|signed_in|limited"), "a limited update is named");
    assert(rows.some((row) => row.detail === "z_block_anon_delete|DELETE|public|limited"), "the anon delete block is named");
    assert(!rows.some((row) => String(row.detail).includes("notes_select_own")), "another table is not listed");
    assert(!rows.some((row) => String(row.detail).includes("secret customer")), "a referral row is not returned");
    const policies = await db.query(`select count(*)::int as n from pg_policies where tablename = 'gi_elementary_referrals'`);
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    const still = await db.query(`select id from public.gi_elementary_referrals`);
    assert(policies.rows[0].n === 5, "the check does not add a policy");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the notes table stays");
    assert(still.rows.length === 1 && still.rows[0].id === "ref", "the referral row stays");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create role authenticated nologin;
      create table public.gi_elementary_referrals (
        id text primary key,
        agent_id text,
        agent_name text
      );
      alter table public.gi_elementary_referrals enable row level security;
      create policy elem_ref_select_authenticated on public.gi_elementary_referrals
        for select to authenticated
        using (agent_id = 'agent-1');
    `);
    const header = bySection(await rowsOf(db));
    assert(header.agent_id === "yes" && header.agent_name === "yes", "both ownership columns are reported");
    assert(header.role_literal === "lower", "a lowercase comparison is not mixed");
    assert(header.blank_agent === "no", "an owned comparison is not a blank agent_id");
    assert(header.changed === "no", "the owned comparison changes nothing");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.gi_elementary_referrals (id text primary key);
    `);
    const header = bySection(await rowsOf(db));
    assert(header.present === "yes" && header.rls === "no", "row security off is reported");
    assert(header.agent_id === "no" && header.agent_name === "no", "missing ownership columns are reported");
    assert(header.role_literal === "lower" && header.blank_agent === "no", "no policy means no extra flags");
    assert(header.changed === "no", "a quiet table is not changed");
  }

  {
    const db = new PGlite();
    const header = bySection(await rowsOf(db));
    assert(header.table === "gi_elementary_referrals" && header.present === "no" && header.changed === "no", "a missing table is reported and nothing is saved");
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
