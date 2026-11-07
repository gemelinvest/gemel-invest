/**
 * Only a manager can save the sales report. Every signed-in person can
 * still read it. The public door stays closed.
 * Run: node _test-daily-report-by-role.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-daily-report-by-role.sql"), "utf8");
const code = executable(sql);

console.log("1) the file limits only the save");
assert(code.includes("create policy daily_report_insert_by_role"), "it adds the manager insert");
assert(code.includes("create policy daily_report_update_by_role"), "it adds the manager update");
assert(code.includes("with check (public.gi_jwt_is_manager())"), "the insert checks the manager helper");
assert(code.includes("using (public.gi_jwt_is_manager())"), "the update checks the manager helper");
assert(code.includes("drop policy daily_report_insert_authenticated"), "it removes the open insert");
assert(code.includes("drop policy daily_report_update_authenticated"), "it removes the open update");
assert(!code.includes("drop policy daily_report_select_authenticated"), "it keeps the signed-in read");
assert((code.match(/drop policy/gi) || []).length === 2, "it drops two policies");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/from public\.gi_daily_report/i.test(code), "it does not read report rows");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");

  const base = `
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public to anon, authenticated;
    create table public.gi_daily_report (
      id text primary key,
      label text
    );
    create table public.notes (id text primary key);
    grant select, insert, update on public.gi_daily_report to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.gi_daily_report(id, label) values ('active', 'keep');
    alter table public.gi_daily_report enable row level security;
    alter table public.notes enable row level security;
    create function public.gi_jwt_is_manager() returns boolean language sql stable as $$
      select coalesce(current_setting('gi.test_manager', true), '') = 'yes'
    $$;
    create policy notes_select_own on public.notes for select to authenticated using (true);
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
    await db.exec(base);
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("policies_removed=daily_report_insert_authenticated,daily_report_update_authenticated"), "the open save policies are removed");
    assert(details.includes("select_signed_in=kept"), "the signed-in read stays");
    assert(details.includes("insert_by_role=installed") && details.includes("update_by_role=installed"), "the manager save is installed");
    assert(details.includes("other_tables=unchanged") && details.includes("changed=yes"), "other tables stay and the cut is reported");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.includes("changed=no"), "a second run removes nothing");

    await db.exec("set role anon");
    const anonRead = await db.query("select count(*)::int as n from public.gi_daily_report");
    await db.exec("reset role");
    assert(anonRead.rows[0].n === 0, "anon still cannot read");

    await db.exec("set role authenticated");
    await db.exec("select set_config('gi.test_manager', '', false)");
    const own = await db.query("select count(*)::int as n from public.gi_daily_report");
    await db.exec("update public.gi_daily_report set label = 'agent' where id = 'active'");
    let agentInsert = "";
    try {
      await db.exec("insert into public.gi_daily_report(id, label) values ('extra', 'agent')");
      agentInsert = "wrote";
    } catch(err) {
      agentInsert = String(err && err.message || err);
    }
    await db.exec("reset role");
    const afterAgent = await db.query("select label from public.gi_daily_report where id = 'active'");
    assert(own.rows[0].n === 1, "a signed-in person still reads the report");
    assert(afterAgent.rows[0].label === "keep", "an agent cannot change the report");
    assert(/row-level security/i.test(agentInsert), "an agent cannot insert a report row");

    await db.exec("set role authenticated");
    await db.exec("select set_config('gi.test_manager', 'yes', false)");
    await db.exec("update public.gi_daily_report set label = 'mgr' where id = 'active'");
    await db.exec("insert into public.gi_daily_report(id, label) values ('month', 'mgr')");
    await db.exec("reset role");
    const afterManager = await db.query("select label from public.gi_daily_report where id = 'active'");
    const months = await db.query("select count(*)::int as n from public.gi_daily_report where id = 'month'");
    assert(afterManager.rows[0].label === "mgr" && months.rows[0].n === 1, "a manager can update and insert");
    const notes = await db.query("select policyname from pg_policies where tablename = 'notes'");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    await db.exec(base.replace("create policy daily_report_select_authenticated on public.gi_daily_report\n      for select to authenticated using (true);\n    ", ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/sales-report policies are not the expected open set; nothing saved/i.test(blocked), "a missing read saves nothing");
    const open = await db.query("select count(*)::int as n from pg_policies where policyname = 'daily_report_insert_authenticated'");
    assert(open.rows[0].n === 1, "the open insert stays when the read is missing");
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
