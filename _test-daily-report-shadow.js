/**
 * The sales-report read is added beside the open door.
 * The door stays, the rows stay, and a run that would change visibility saves nothing.
 * Run: node _test-daily-report-shadow.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-daily-report-shadow.sql"), "utf8");
const code = executable(sql);

console.log("1) the file stays on one inert read");
assert(code.includes("create policy daily_report_select_authenticated"), "it adds the authenticated read");
assert(code.includes("for select") && code.includes("to authenticated") && code.includes("using (true)"), "the read is open to an authenticated session");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security/i.test(code), "it does not turn row security on");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/gi_cancellations_report|gi_agent_activity_log|public\.customers|public\.agents|public\.app_meta|public\.proposals/i.test(code), "other tables are not named");
assert(!/header_row|data_rows|full_name|id_number/i.test(code), "report cells and customer fields are not selected");
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
    create table public.gi_daily_report (
      id text primary key,
      header_row jsonb,
      data_rows jsonb
    );
    create table public.gi_cancellations_report (
      id text primary key
    );
    grant select, insert, update, delete on public.gi_daily_report to anon, authenticated;
    insert into public.gi_daily_report(id, header_row, data_rows)
    values ('active', '["נציג"]'::jsonb, '[{"agent":"בדיקה"}]'::jsonb);
    insert into public.gi_cancellations_report(id) values ('keep');
    alter table public.gi_cancellations_report enable row level security;
    create policy cancellations_open on public.gi_cancellations_report
      for all to anon, authenticated using (true) with check (true);
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  async function detail(db, section){
    const found = (await rowsOf(db)).filter((row) => row.section === section);
    return found.map((row) => row.detail);
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.gi_daily_report enable row level security;
      create policy gi_daily_report_all_anon on public.gi_daily_report
        for all to anon, authenticated using (true) with check (true);
    `);
    const first = await rowsOf(db);
    const bySection = Object.fromEntries(first.map((row) => [row.section, row.detail]));
    assert(bySection.table === "gi_daily_report", "the result names the sales report");
    assert(bySection.rls_enabled === "yes", "row security was already on");
    assert(bySection.open_door === "yes", "the open door is still reported");
    assert(bySection.shadow === "installed", "the extra read is installed");
    assert(bySection.anon_rows === "same", "anon still sees the same rows");
    assert(bySection.authenticated_rows === "same", "a session still sees the same rows");
    assert(bySection.report_rows === "unchanged", "the stored report is unchanged");
    assert(bySection.other_tables === "unchanged", "the cancellations table is unchanged");
    assert(bySection.access_changed === "no", "access is unchanged");
    assert(bySection.door_closed === "no", "the open door is not closed");
    assert(first.some((row) => row.section === "open_policy" && row.detail === "gi_daily_report_all_anon"), "the live open policy name is returned");
    const second = await rowsOf(db);
    assert(second.some((row) => row.section === "shadow" && row.detail === "already_present"), "a second run adds nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'gi_daily_report'
      order by policyname
    `);
    assert(policies.rows.length === 2, "the open policy and the extra read both remain");
    const other = await db.query(`
      select policyname from pg_policies where tablename = 'gi_cancellations_report'
    `);
    assert(other.rows.length === 1 && other.rows[0].policyname === "cancellations_open", "the other table's policy stays");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.gi_daily_report enable row level security;
    `);
    let blocked = "";
    try {
      await db.exec(sql);
    } catch(err) {
      blocked = String(err && err.message || err);
    }
    assert(/row visibility changed; nothing saved/i.test(blocked), "a read that would reveal new rows saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies where tablename = 'gi_daily_report'
    `);
    assert(policies.rows.length === 0, "the rejected read is not left behind");
    const report = await db.query(`select id from public.gi_daily_report`);
    assert(report.rows.length === 1, "the report row is still there");
  }

  {
    const db = new PGlite();
    await db.exec(fixture);
    const installed = await detail(db, "shadow");
    const enabled = await detail(db, "rls_enabled");
    assert(installed[0] === "installed", "with row security off the extra read is stored");
    assert(enabled[0] === "no", "row security stays off");
    const flag = await db.query(`
      select c.relrowsecurity as enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'gi_daily_report'
    `);
    assert(flag.rows[0].enabled === false, "the table flag stays off");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.gi_daily_report enable row level security;
      create policy daily_report_select_authenticated on public.gi_daily_report
        as restrictive
        for select
        to authenticated
        using (false);
    `);
    let blocked = "";
    try {
      await db.exec(sql);
    } catch(err) {
      blocked = String(err && err.message || err);
    }
    assert(/shadow policy is not a plain authenticated read; nothing saved/i.test(blocked), "a different policy under the same name is left alone");
    const policies = await db.query(`
      select permissive from pg_policies
      where tablename = 'gi_daily_report'
        and policyname = 'daily_report_select_authenticated'
    `);
    assert(String(policies.rows[0].permissive).toUpperCase() === "RESTRICTIVE", "the existing policy is not replaced");
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
