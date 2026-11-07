/**
 * The customers check only reports policy names. It does not add or remove one.
 * Run: node _test-customers-policy-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-customers-policy-status.sql"), "utf8");
const code = executable(sql);

console.log("1) the file only reads");
assert(code.includes("public.customers"), "it looks at the customers table");
assert(!/create policy/i.test(code), "it does not create a policy");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a customer");
assert(!/payload|customer_name|id_number|agent_name|phone/i.test(code), "customer fields are not selected");
assert(!/campaign_leads|gi_agent_activity_log|gi_cancellations_report|gi_daily_report|public\.proposals|public\.agents|public\.app_meta/i.test(code), "other tables are not named");

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
      create table public.customers (id text primary key);
      create table public.proposals (id text primary key);
      insert into public.customers(id) values ('active');
      alter table public.customers enable row level security;
      alter table public.proposals enable row level security;
      create policy "allow all customers" on public.customers
        for all to anon, authenticated using (true) with check (true);
      create policy customers_select_authenticated on public.customers
        for select to authenticated using (false);
      create policy proposals_select_own on public.proposals
        for select to authenticated using (true);
    `);
    const rows = await rowsOf(db);
    const bySection = Object.fromEntries(rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
    assert(bySection.table === "customers", "the result names the customers table");
    assert(bySection.rls_enabled === "yes", "row security is reported");
    assert(bySection.rows_present === "yes", "rows are reported without a count");
    assert(bySection.open_read === "yes", "the public read is reported");
    assert(bySection.changed === "no", "nothing is changed");
    assert(rows.some((row) => row.detail === "allow all customers|ALL|public+signed_in|open"), "the open door is named");
    assert(rows.some((row) => row.detail === "customers_select_authenticated|SELECT|signed_in|limited"), "a signed-in limit is named");
    assert(!rows.some((row) => String(row.detail).includes("proposals_select_own")), "another table is not listed");
    const policies = await db.query(`select count(*)::int as n from pg_policies where tablename = 'customers'`);
    const proposals = await db.query(`select policyname from pg_policies where tablename = 'proposals'`);
    assert(policies.rows[0].n === 2, "the check does not add a policy");
    assert(proposals.rows.length === 1 && proposals.rows[0].policyname === "proposals_select_own", "the proposals table stays");
  }

  {
    const db = new PGlite();
    const rows = await rowsOf(db);
    const bySection = Object.fromEntries(rows.map((row) => [row.section, row.detail]));
    assert(bySection.table === "missing" && bySection.changed === "no", "a missing table is reported and nothing is saved");
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
