/**
 * The cancellations-report save is added beside the open door.
 * The sales-report door that was already closed stays closed.
 * Run: node _test-cancellations-report-write.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-cancellations-report-write.sql"), "utf8");
const code = executable(sql);

console.log("1) the file stays on one inert save");
assert(code.includes("create policy cancellations_report_insert_authenticated"), "it adds the authenticated insert");
assert(code.includes("create policy cancellations_report_update_authenticated"), "it adds the authenticated update");
assert(code.includes("on public.gi_cancellations_report"), "the save is on the cancellations report");
assert(code.includes("for insert") && code.includes("with check (true)"), "the insert accepts a signed-in save");
assert(code.includes("for update") && code.includes("using (true)"), "the update accepts a signed-in save");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security/i.test(code), "it does not turn row security on");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.gi_cancellations_report|update public\.gi_cancellations_report/i.test(code), "it does not write a report row");
assert(!/gi_daily_report|public\.customers|public\.agents|public\.app_meta|public\.proposals/i.test(code), "other tables are not named");
assert(!/header_row|data_rows|full_name|id_number|sheets/i.test(code), "report cells and customer fields are not selected");
assert(code.includes("open write is missing; nothing saved"), "a missing open write saves nothing");
assert(code.includes("row visibility changed; nothing saved"), "a visibility change saves nothing");

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
    create table public.gi_cancellations_report (
      id text primary key,
      uploaded_by_name text
    );
    create table public.gi_daily_report (
      id text primary key
    );
    grant select, insert, update, delete on public.gi_cancellations_report to anon, authenticated;
    grant select, insert, update on public.gi_daily_report to authenticated;
    insert into public.gi_cancellations_report(id, uploaded_by_name) values ('active', 'בדיקה');
    insert into public.gi_daily_report(id) values ('active');
    alter table public.gi_daily_report enable row level security;
    create policy daily_report_select_authenticated on public.gi_daily_report
      for select to authenticated using (true);
    create policy daily_report_insert_authenticated on public.gi_daily_report
      for insert to authenticated with check (true);
    create policy daily_report_update_authenticated on public.gi_daily_report
      for update to authenticated using (true) with check (true);
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.gi_cancellations_report enable row level security;
      create policy gi_cancellations_report_all_anon on public.gi_cancellations_report
        for all to anon, authenticated using (true) with check (true);
      create policy cancellations_report_select_authenticated on public.gi_cancellations_report
        for select to authenticated using (true);
    `);
    const first = await rowsOf(db);
    const bySection = Object.fromEntries(first.map((row) => [row.section, row.detail]));
    assert(bySection.table === "gi_cancellations_report", "the result names the cancellations report");
    assert(bySection.rls_enabled === "yes", "row security was already on");
    assert(bySection.open_door === "yes", "the open door is still reported");
    assert(bySection.insert_policy === "installed", "the insert is installed");
    assert(bySection.update_policy === "installed", "the update is installed");
    assert(bySection.anon_rows === "same", "anon still sees the same rows");
    assert(bySection.authenticated_rows === "same", "a session still sees the same rows");
    assert(bySection.report_rows === "unchanged", "the stored report is unchanged");
    assert(bySection.other_tables === "unchanged", "the sales report is unchanged");
    assert(bySection.access_changed === "no", "access is unchanged");
    assert(bySection.door_closed === "no", "the open door is not closed");
    assert(first.some((row) => row.section === "open_policy" && row.detail === "gi_cancellations_report_all_anon"), "the live open policy name is returned");
    const second = await rowsOf(db);
    const again = Object.fromEntries(second.map((row) => [row.section, row.detail]));
    assert(again.insert_policy === "already_present" && again.update_policy === "already_present", "a second run adds nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'gi_cancellations_report'
      order by policyname
    `);
    assert(policies.rows.map((row) => row.policyname).join(",") === [
      "cancellations_report_insert_authenticated",
      "cancellations_report_select_authenticated",
      "cancellations_report_update_authenticated",
      "gi_cancellations_report_all_anon"
    ].join(","), "the open door and the earlier read stay beside the save");
    const sales = await db.query(`
      select policyname from pg_policies
      where tablename = 'gi_daily_report'
      order by policyname
    `);
    assert(sales.rows.map((row) => row.policyname).join(",") === [
      "daily_report_insert_authenticated",
      "daily_report_select_authenticated",
      "daily_report_update_authenticated"
    ].join(","), "the closed sales-report door stays closed");
    const stored = await db.query(`select uploaded_by_name from public.gi_cancellations_report`);
    assert(stored.rows.length === 1 && stored.rows[0].uploaded_by_name === "בדיקה", "the report row was not rewritten");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.gi_cancellations_report enable row level security;
      create policy cancellations_report_select_authenticated on public.gi_cancellations_report
        for select to authenticated using (true);
    `);
    let blocked = "";
    try {
      await db.exec(sql);
    } catch(err) {
      blocked = String(err && err.message || err);
    }
    assert(/open write is missing; nothing saved/i.test(blocked), "a save without an open write saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'gi_cancellations_report'
      order by policyname
    `);
    assert(policies.rows.length === 1 && policies.rows[0].policyname === "cancellations_report_select_authenticated", "the rejected save is not left behind");
  }

  {
    const db = new PGlite();
    await db.exec(fixture);
    const first = await rowsOf(db);
    const bySection = Object.fromEntries(first.map((row) => [row.section, row.detail]));
    assert(bySection.insert_policy === "installed" && bySection.update_policy === "installed", "with row security off the save is stored");
    assert(bySection.rls_enabled === "no", "row security stays off");
    const flag = await db.query(`
      select c.relrowsecurity as enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'gi_cancellations_report'
    `);
    assert(flag.rows[0].enabled === false, "the table flag stays off");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.gi_cancellations_report enable row level security;
      create policy gi_cancellations_report_all_anon on public.gi_cancellations_report
        for all to anon, authenticated using (true) with check (true);
      create policy cancellations_report_insert_authenticated on public.gi_cancellations_report
        as restrictive
        for insert
        to authenticated
        with check (false);
    `);
    let blocked = "";
    try {
      await db.exec(sql);
    } catch(err) {
      blocked = String(err && err.message || err);
    }
    assert(/insert policy is not a plain authenticated write; nothing saved/i.test(blocked), "a different insert under the same name is left alone");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'gi_cancellations_report'
        and policyname = 'cancellations_report_update_authenticated'
    `);
    assert(policies.rows.length === 0, "the update is not added after a rejected insert");
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
