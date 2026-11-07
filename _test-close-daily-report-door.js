/**
 * The public door on the sales report closes only when a signed-in
 * session still sees the same rows and can still save.
 * Run: node _test-close-daily-report-door.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-close-daily-report-door.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes one named door");
assert(code.includes("drop policy gi_daily_report_all_anon on public.gi_daily_report"), "it removes the named public door");
assert((code.match(/drop policy/gi) || []).length === 1, "it drops one policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.gi_daily_report|update public\.gi_daily_report/i.test(code), "it does not write a report row");
assert(!/daily_report_select_authenticated on public|daily_report_insert_authenticated on public|daily_report_update_authenticated on public/i.test(code), "it does not recreate the signed-in policies");
assert(!/gi_cancellations_report|public\.customers|public\.agents|public\.app_meta|public\.proposals/i.test(code), "other tables are not named");
assert(!/header_row|data_rows|full_name|id_number/i.test(code), "report cells and customer fields are not selected");
assert(code.includes("signed-in rows changed; nothing saved"), "a signed-in count change saves nothing");
assert(code.includes("signed-in save is missing; nothing saved"), "a missing signed-in save saves nothing");
assert(code.includes("anon door is still open; nothing saved"), "a remaining public door saves nothing");

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
      uploaded_by_name text
    );
    create table public.gi_cancellations_report (
      id text primary key
    );
    grant select, insert, update, delete on public.gi_daily_report to anon, authenticated;
    insert into public.gi_daily_report(id, uploaded_by_name) values ('active', 'בדיקה');
    insert into public.gi_cancellations_report(id) values ('keep');
    alter table public.gi_cancellations_report enable row level security;
    create policy cancellations_open on public.gi_cancellations_report
      for all to anon, authenticated using (true) with check (true);
  `;

  const sessionPolicies = `
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
      alter table public.gi_daily_report enable row level security;
      create policy gi_daily_report_all_anon on public.gi_daily_report
        for all to anon, authenticated using (true) with check (true);
    ` + sessionPolicies);
    const first = await rowsOf(db);
    const bySection = Object.fromEntries(first.map((row) => [row.section, row.detail]));
    assert(bySection.table === "gi_daily_report", "the result names the sales report");
    assert(bySection.rls_enabled === "yes", "row security stays on");
    assert(bySection.authenticated_rows === "same", "a signed-in session still sees the same rows");
    assert(bySection.anon_rows === "hidden", "the public key no longer sees the rows");
    assert(bySection.report_rows === "unchanged", "the stored report is unchanged");
    assert(bySection.other_tables === "unchanged", "the cancellations table is unchanged");
    assert(bySection.policies_removed === "gi_daily_report_all_anon", "only the named door is removed");
    assert(bySection.signed_in_read === "kept" && bySection.signed_in_save === "kept", "the signed-in read and save stay");
    assert(bySection.door_closed === "yes", "the public door is closed");
    const second = await rowsOf(db);
    const again = Object.fromEntries(second.map((row) => [row.section, row.detail]));
    assert(again.policies_removed === "none" && again.anon_rows === "already_hidden", "a second run removes nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'gi_daily_report'
      order by policyname
    `);
    assert(policies.rows.map((row) => row.policyname).join(",") === [
      "daily_report_insert_authenticated",
      "daily_report_select_authenticated",
      "daily_report_update_authenticated"
    ].join(","), "the signed-in policies remain and the public door does not");
    const stored = await db.query(`select id, uploaded_by_name from public.gi_daily_report`);
    assert(stored.rows.length === 1 && stored.rows[0].uploaded_by_name === "בדיקה", "the report row was not rewritten");
    const other = await db.query(`select policyname from pg_policies where tablename = 'gi_cancellations_report'`);
    assert(other.rows.length === 1 && other.rows[0].policyname === "cancellations_open", "the other table's policy stays");
    await db.exec("set role anon");
    const hidden = await db.query(`select count(*)::int as n from public.gi_daily_report`);
    await db.exec("reset role");
    await db.exec("set role authenticated");
    const visible = await db.query(`select count(*)::int as n from public.gi_daily_report`);
    await db.exec("reset role");
    assert(hidden.rows[0].n === 0 && visible.rows[0].n === 1, "anon sees nothing and the session still sees the row");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.gi_daily_report enable row level security;
      create policy gi_daily_report_all_anon on public.gi_daily_report
        for all to anon, authenticated using (true) with check (true);
      create policy daily_report_select_authenticated on public.gi_daily_report
        for select to authenticated using (true);
      create policy daily_report_insert_authenticated on public.gi_daily_report
        for insert to authenticated with check (true);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/signed-in save is missing; nothing saved/i.test(blocked), "a missing update saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'gi_daily_report' and policyname = 'gi_daily_report_all_anon'
    `);
    assert(policies.rows.length === 1, "the public door stays when the save is incomplete");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.gi_daily_report enable row level security;
      create policy gi_daily_report_all_anon on public.gi_daily_report
        for all to anon, authenticated using (true) with check (true);
    ` + sessionPolicies + `
      create policy anon_extra on public.gi_daily_report
        for select to anon using (true);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/anon door is still open; nothing saved/i.test(blocked), "a second public read saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'gi_daily_report' and policyname = 'gi_daily_report_all_anon'
    `);
    assert(policies.rows.length === 1, "the named door is restored when another public read remains");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + sessionPolicies);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/row security is off; nothing saved/i.test(blocked), "row security is not switched on in order to close the door");
    const flag = await db.query(`
      select c.relrowsecurity as enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'gi_daily_report'
    `);
    assert(flag.rows[0].enabled === false, "the table flag stays off");
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
