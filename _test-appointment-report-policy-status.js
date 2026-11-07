/**
 * The appointment report check only reports policy names. It does not add or remove one.
 * Run: node _test-appointment-report-policy-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-appointment-report-policy-status.sql"), "utf8");
const code = executable(sql);

console.log("1) the file only reads");
assert(code.includes("public.gi_agent_appointment_report"), "it looks at the appointment report");
assert(!/create policy/i.test(code), "it does not create a policy");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a report row");
assert(!/\b(uploaded_by|customer|phone|email|payload|pin)\b/i.test(code), "report fields are not selected");
assert(!/public\.agents|public\.app_meta|public\.customers|public\.proposals|campaign_leads/i.test(code), "other tables are not named");

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
      create table public.gi_agent_appointment_report (id text primary key);
      create table public.notes (id text primary key);
      insert into public.gi_agent_appointment_report(id) values ('active');
      alter table public.gi_agent_appointment_report enable row level security;
      alter table public.notes enable row level security;
      create policy gi_agent_appointment_report_all_anon on public.gi_agent_appointment_report
        for all to anon, authenticated using (true) with check (true);
      create policy agent_appointment_report_select_authenticated on public.gi_agent_appointment_report
        for select to authenticated using (false);
      create policy notes_select_own on public.notes
        for select to authenticated using (true);
    `);
    const rows = await rowsOf(db);
    const bySection = Object.fromEntries(rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
    assert(bySection.table === "gi_agent_appointment_report", "the result names the appointment report");
    assert(bySection.rls_enabled === "yes", "row security is reported");
    assert(bySection.rows_present === "yes", "rows are reported without a count");
    assert(bySection.open_read === "yes", "the public read is reported");
    assert(bySection.changed === "no", "nothing is changed");
    assert(rows.some((row) => row.detail === "gi_agent_appointment_report_all_anon|ALL|public+signed_in|open"), "the open door is named");
    assert(rows.some((row) => row.detail === "agent_appointment_report_select_authenticated|SELECT|signed_in|limited"), "a signed-in limit is named");
    assert(!rows.some((row) => String(row.detail).includes("notes_select_own")), "another table is not listed");
    const policies = await db.query(`select count(*)::int as n from pg_policies where tablename = 'gi_agent_appointment_report'`);
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(policies.rows[0].n === 2, "the check does not add a policy");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
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
