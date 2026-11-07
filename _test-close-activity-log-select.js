/**
 * The public read on the activity log closes only when a signed-in session
 * still sees the same rows. The public insert stays.
 * Run: node _test-close-activity-log-select.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-close-activity-log-select.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes one named read");
assert(code.includes("drop policy gi_actlog_select on public.gi_agent_activity_log"), "it removes the named public read");
assert((code.match(/drop policy/gi) || []).length === 1, "it drops one policy");
assert(!code.includes("drop policy gi_actlog_insert"), "it does not drop the public insert");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.gi_agent_activity_log|update public\.gi_agent_activity_log/i.test(code), "it does not write a log row");
assert(!/actlog_select_authenticated on public|actlog_insert_authenticated on public/i.test(code), "it does not recreate the signed-in policies");
assert(!/gi_cancellations_report|gi_daily_report|public\.customers|public\.agents|public\.app_meta|public\.proposals/i.test(code), "other tables are not named");
assert(!/agent_name|detail_text|entity_label|full_name|id_number/i.test(code), "log cells and customer fields are not selected");
assert(code.includes("signed-in rows changed; nothing saved"), "a signed-in count change saves nothing");
assert(code.includes("open insert is missing; nothing saved"), "a missing public insert saves nothing");
assert(code.includes("anon read is still open; nothing saved"), "a remaining public read saves nothing");

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
    create table public.gi_agent_activity_log (
      id text primary key,
      agent_name text
    );
    create table public.gi_cancellations_report (
      id text primary key
    );
    grant select, insert on public.gi_agent_activity_log to anon, authenticated;
    grant select on public.gi_cancellations_report to authenticated;
    insert into public.gi_agent_activity_log(id, agent_name) values ('active', 'בדיקה');
    insert into public.gi_cancellations_report(id) values ('active');
    alter table public.gi_cancellations_report enable row level security;
    create policy cancellations_report_select_authenticated on public.gi_cancellations_report
      for select to authenticated using (true);
  `;

  const kept = `
    create policy gi_actlog_insert on public.gi_agent_activity_log
      for insert to anon, authenticated with check (true);
    create policy actlog_select_authenticated on public.gi_agent_activity_log
      for select to authenticated using (true);
    create policy actlog_insert_authenticated on public.gi_agent_activity_log
      for insert to authenticated with check (true);
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.gi_agent_activity_log enable row level security;
      create policy gi_actlog_select on public.gi_agent_activity_log
        for select to anon, authenticated using (true);
    ` + kept);
    const first = await rowsOf(db);
    const bySection = Object.fromEntries(first.map((row) => [row.section, row.detail]));
    assert(bySection.table === "gi_agent_activity_log", "the result names the activity log");
    assert(bySection.rls_enabled === "yes", "row security stays on");
    assert(bySection.authenticated_rows === "same", "a signed-in session still sees the same rows");
    assert(bySection.anon_rows === "hidden", "the public key no longer sees the rows");
    assert(bySection.log_rows === "unchanged", "the stored log is unchanged");
    assert(bySection.other_tables === "unchanged", "the cancellations table is unchanged");
    assert(bySection.policies_removed === "gi_actlog_select", "only the named read is removed");
    assert(bySection.signed_in_read === "kept" && bySection.signed_in_insert === "kept", "the signed-in read and insert stay");
    assert(bySection.open_insert === "gi_actlog_insert", "the public insert stays");
    assert(bySection.read_door_closed === "yes" && bySection.insert_door_closed === "no", "only the read door is closed");
    const second = await rowsOf(db);
    const again = Object.fromEntries(second.map((row) => [row.section, row.detail]));
    assert(again.policies_removed === "none" && again.anon_rows === "already_hidden", "a second run removes nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'gi_agent_activity_log'
      order by policyname
    `);
    assert(policies.rows.map((row) => row.policyname).join(",") === [
      "actlog_insert_authenticated",
      "actlog_select_authenticated",
      "gi_actlog_insert"
    ].join(","), "the public insert and the signed-in policies remain");
    const stored = await db.query(`select agent_name from public.gi_agent_activity_log`);
    assert(stored.rows.length === 1 && stored.rows[0].agent_name === "בדיקה", "the log row was not rewritten");
    const other = await db.query(`select policyname from pg_policies where tablename = 'gi_cancellations_report'`);
    assert(other.rows.length === 1 && other.rows[0].policyname === "cancellations_report_select_authenticated", "the cancellations policy stays");
    await db.exec("set role anon");
    const hidden = await db.query(`select count(*)::int as n from public.gi_agent_activity_log`);
    await db.exec("reset role");
    await db.exec("set role authenticated");
    const visible = await db.query(`select count(*)::int as n from public.gi_agent_activity_log`);
    await db.exec("reset role");
    assert(hidden.rows[0].n === 0 && visible.rows[0].n === 1, "anon sees nothing and the session still sees the row");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.gi_agent_activity_log enable row level security;
      create policy gi_actlog_select on public.gi_agent_activity_log
        for select to anon, authenticated using (true);
      create policy actlog_select_authenticated on public.gi_agent_activity_log
        for select to authenticated using (true);
      create policy actlog_insert_authenticated on public.gi_agent_activity_log
        for insert to authenticated with check (true);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/open insert is missing; nothing saved/i.test(blocked), "a missing public insert saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'gi_agent_activity_log' and policyname = 'gi_actlog_select'
    `);
    assert(policies.rows.length === 1, "the public read stays when the public insert is missing");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.gi_agent_activity_log enable row level security;
      create policy gi_actlog_select on public.gi_agent_activity_log
        for select to anon, authenticated using (true);
    ` + kept + `
      create policy anon_extra on public.gi_agent_activity_log
        for select to anon using (true);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/anon read is still open; nothing saved/i.test(blocked), "a second public read saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'gi_agent_activity_log' and policyname = 'gi_actlog_select'
    `);
    assert(policies.rows.length === 1, "the named read is restored when another public read remains");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + kept);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/row security is off; nothing saved/i.test(blocked), "row security is not switched on in order to close the read");
    const flag = await db.query(`
      select c.relrowsecurity as enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'gi_agent_activity_log'
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
