/**
 * The history check only reports policy names for three tables.
 * It does not add or remove one.
 * Run: node _test-history-policy-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-history-policy-status.sql"), "utf8");
const code = executable(sql);
const readable = code.replace(/\$body\$/g, "");

console.log("1) the file only reads three history tables");
["agents_history", "customers_history", "proposals_history"].forEach((name) => {
  assert(code.includes(name), "it looks at " + name);
});
assert(!/create policy/i.test(code), "it does not create a policy");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a stored row");
assert(!/\b(payload|phone|email|pin|agent_name|body)\b/i.test(readable), "stored fields are not selected");
assert(!/public\.app_meta|public\.reminders|gi_elementary_referrals|gi_chat_messages/i.test(code), "other tables are not named");

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
      create table public.agents_history (id text primary key);
      create table public.customers_history (id text primary key);
      create table public.proposals_history (id text primary key);
      create table public.notes (id text primary key);
      insert into public.agents_history(id) values ('active');
      alter table public.agents_history enable row level security;
      alter table public.customers_history enable row level security;
      alter table public.notes enable row level security;
      create policy agents_history_select on public.agents_history
        for all to anon, authenticated using (true) with check (true);
      create policy agents_history_select_authenticated on public.agents_history
        for select to authenticated using (false);
      create policy customers_history_select on public.customers_history
        for all to public using (true) with check (true);
      create policy notes_select_own on public.notes
        for select to authenticated using (true);
    `);
    const grouped = groups(await rowsOf(db));
    assert(grouped.map((group) => group.table).join(",") === "agents_history,customers_history,proposals_history", "the three tables are reported in order");
    const agents = Object.fromEntries(grouped[0].rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
    const customers = Object.fromEntries(grouped[1].rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
    const proposals = Object.fromEntries(grouped[2].rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
    assert(agents.rls_enabled === "yes" && agents.rows_present === "yes" && agents.open_read === "yes" && agents.changed === "no", "agent history is reported without a change");
    assert(grouped[0].rows.some((row) => row.detail === "agents_history|agents_history_select|ALL|public+signed_in|open"), "the open agent-history door is named");
    assert(grouped[0].rows.some((row) => row.detail === "agents_history|agents_history_select_authenticated|SELECT|signed_in|limited"), "a signed-in agent-history limit is named");
    assert(customers.rls_enabled === "yes" && customers.rows_present === "no" && customers.open_read === "yes" && customers.changed === "no", "customer history keeps its reported open read");
    assert(proposals.rls_enabled === "no" && proposals.open_read === "no" && proposals.changed === "no", "proposal history is reported and row security is not switched on");
    assert(!grouped.some((group) => group.rows.some((row) => String(row.detail).includes("notes_select_own"))), "another table is not listed");
    const policies = await db.query(`select count(*)::int as n from pg_policies where tablename in ('agents_history', 'customers_history', 'proposals_history')`);
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(policies.rows[0].n === 3, "the check does not add a policy");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.agents_history (id text primary key);
      create table public.proposals_history (id text primary key);
    `);
    const grouped = groups(await rowsOf(db));
    const customers = grouped.find((group) => group.table === "customers_history");
    const bySection = Object.fromEntries(customers.rows.map((row) => [row.section, row.detail]));
    assert(bySection.present === "no" && bySection.changed === "no", "a missing table is reported and the others are still read");
    assert(grouped.filter((group) => group.table !== "customers_history").every((group) => group.rows.some((row) => row.section === "rls_enabled")), "the tables that exist are still described");
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
