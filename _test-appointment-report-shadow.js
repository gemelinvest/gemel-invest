/**
 * The appointment-report read is added beside the open door.
 * The activity-log read that was already closed stays closed.
 * Run: node _test-appointment-report-shadow.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-appointment-report-shadow.sql"), "utf8");
const code = executable(sql);

console.log("1) the file stays on one inert read");
assert(code.includes("create policy agent_appointment_report_select_authenticated"), "it adds the authenticated read");
assert(code.includes("on public.gi_agent_appointment_report"), "the read is on the appointment report");
assert(code.includes("for select") && code.includes("to authenticated") && code.includes("using (true)"), "the read is open to an authenticated session");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security/i.test(code), "it does not turn row security on");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/gi_agent_activity_log|gi_cancellations_report|gi_daily_report|public\.customers|public\.agents|public\.app_meta|public\.proposals/i.test(code), "other tables are not named");
assert(!/header_row|data_rows|full_name|id_number|sheets|uploaded_by_name/i.test(code), "report cells and customer fields are not selected");
assert(code.includes("row visibility changed; nothing saved"), "a visibility change saves nothing");
assert(code.includes("cannot prove the extra read changes nothing; nothing saved"), "an unproven read saves nothing");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");

  const fixture = `
    create role anon nologin;
    create role authenticated nologin;
    create table public.gi_agent_appointment_report (
      id text primary key,
      uploaded_by_name text
    );
    create table public.gi_agent_activity_log (
      id text primary key
    );
    grant select, insert, update, delete on public.gi_agent_appointment_report to anon, authenticated;
    grant select, insert on public.gi_agent_activity_log to anon, authenticated;
    insert into public.gi_agent_appointment_report(id, uploaded_by_name) values ('active', 'בדיקה');
    insert into public.gi_agent_activity_log(id) values ('active');
    alter table public.gi_agent_activity_log enable row level security;
    create policy actlog_select_authenticated on public.gi_agent_activity_log
      for select to authenticated using (true);
    create policy actlog_insert_authenticated on public.gi_agent_activity_log
      for insert to authenticated with check (true);
    create policy gi_actlog_insert on public.gi_agent_activity_log
      for insert to anon, authenticated with check (true);
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.gi_agent_appointment_report enable row level security;
      create policy gi_agent_appointment_report_all_anon on public.gi_agent_appointment_report
        for all to anon, authenticated using (true) with check (true);
    `);
    const first = await rowsOf(db);
    const bySection = Object.fromEntries(first.filter((row) => row.section !== "open_policy").map((row) => [row.section, row.detail]));
    assert(bySection.table === "gi_agent_appointment_report", "the result names the appointment report");
    assert(bySection.rls_enabled === "yes", "row security was already on");
    assert(bySection.open_door === "yes", "the open door is still reported");
    assert(bySection.shadow === "installed", "the extra read is installed");
    assert(bySection.anon_rows === "same", "anon still sees the same rows");
    assert(bySection.authenticated_rows === "same", "a session still sees the same rows");
    assert(bySection.report_rows === "unchanged", "the stored report is unchanged");
    assert(bySection.other_tables === "unchanged", "the activity log is unchanged");
    assert(bySection.access_changed === "no", "access is unchanged");
    assert(bySection.door_closed === "no", "the open door is not closed");
    assert(first.some((row) => row.section === "open_policy" && row.detail === "gi_agent_appointment_report_all_anon"), "the live open policy name is returned");
    const second = await rowsOf(db);
    assert(second.some((row) => row.section === "shadow" && row.detail === "already_present"), "a second run adds nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'gi_agent_appointment_report'
      order by policyname
    `);
    assert(policies.rows.map((row) => row.policyname).join(",") === [
      "agent_appointment_report_select_authenticated",
      "gi_agent_appointment_report_all_anon"
    ].join(","), "the open policy and the extra read both remain");
    const log = await db.query(`
      select policyname from pg_policies
      where tablename = 'gi_agent_activity_log'
      order by policyname
    `);
    assert(log.rows.map((row) => row.policyname).join(",") === [
      "actlog_insert_authenticated",
      "actlog_select_authenticated",
      "gi_actlog_insert"
    ].join(","), "the closed activity-log read stays closed");
    const stored = await db.query(`select uploaded_by_name from public.gi_agent_appointment_report`);
    assert(stored.rows[0].uploaded_by_name === "בדיקה", "the report row was not rewritten");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.gi_agent_appointment_report enable row level security;
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/row visibility changed; nothing saved/i.test(blocked), "a read that would reveal new rows saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies where tablename = 'gi_agent_appointment_report'
    `);
    assert(policies.rows.length === 0, "the rejected read is not left behind");
  }

  {
    const db = new PGlite();
    await db.exec(fixture);
    const first = await rowsOf(db);
    const bySection = Object.fromEntries(first.map((row) => [row.section, row.detail]));
    assert(bySection.shadow === "installed", "with row security off the extra read is stored");
    assert(bySection.rls_enabled === "no", "row security stays off");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.gi_agent_appointment_report enable row level security;
      create policy agent_appointment_report_select_authenticated on public.gi_agent_appointment_report
        as restrictive
        for select
        to authenticated
        using (false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/shadow policy is not a plain authenticated read; nothing saved/i.test(blocked), "a different policy under the same name is left alone");
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
