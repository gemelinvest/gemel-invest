/**
 * The leads check only reports policy names. It does not add or remove one.
 * Run: node _test-leads-policy-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-leads-policy-status.sql"), "utf8");
const code = executable(sql);

console.log("1) the file only reads");
assert(code.includes("public.campaign_leads"), "it looks at the leads table");
assert(!/create policy/i.test(code), "it does not create a policy");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a lead");
assert(!/phone|customer_name|id_number|description|assigned_agent_name/i.test(code), "lead fields are not selected");
assert(!/gi_agent_appointment_report|gi_agent_activity_log|gi_cancellations_report|gi_daily_report|public\.customers|public\.agents|public\.app_meta|public\.proposals/i.test(code), "other tables are not named");

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
      create table public.campaign_leads (id text primary key);
      insert into public.campaign_leads(id) values ('active');
      alter table public.campaign_leads enable row level security;
      create policy gi_campaign_leads_all_anon on public.campaign_leads
        for all to anon, authenticated using (true) with check (true);
      create policy z_block_anon_delete on public.campaign_leads
        for delete to anon using (false);
      create policy campaign_leads_select_authenticated on public.campaign_leads
        for select to authenticated using (false);
    `);
    const rows = await rowsOf(db);
    const bySection = Object.fromEntries(rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
    assert(bySection.table === "campaign_leads", "the result names the leads table");
    assert(bySection.rls_enabled === "yes", "row security is reported");
    assert(bySection.rows_present === "yes", "rows are reported without a count");
    assert(bySection.open_read === "yes", "the public read is reported");
    assert(bySection.changed === "no", "nothing is changed");
    assert(rows.some((row) => row.detail === "gi_campaign_leads_all_anon|ALL|public+signed_in|open"), "the open door is named");
    assert(rows.some((row) => row.detail === "z_block_anon_delete|DELETE|public|limited"), "a closed delete is named");
    assert(rows.some((row) => row.detail === "campaign_leads_select_authenticated|SELECT|signed_in|limited"), "a signed-in limit is named");
    const policies = await db.query(`select count(*)::int as n from pg_policies where tablename = 'campaign_leads'`);
    assert(policies.rows[0].n === 3, "the check does not add a policy");
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
