/**
 * The public insert on the activity log closes.
 * The signed-in read and insert stay. The public read stays closed.
 * Run: node _test-close-activity-log-insert.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-close-activity-log-insert.sql"), "utf8");
const code = executable(sql);
const readable = code.replace(/\$body\$/g, "");

console.log("1) the file closes only the public insert");
assert(code.includes("drop policy gi_actlog_insert on public.gi_agent_activity_log"), "it removes the named public insert");
assert((code.match(/drop policy/gi) || []).length === 1, "it drops one policy");
assert(!code.includes("drop policy actlog_insert_authenticated"), "it does not drop the signed-in insert");
assert(!code.includes("drop policy actlog_select_authenticated"), "it does not drop the signed-in read");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/create policy/i.test(code), "it does not create a policy");
assert(!/insert into public\.gi_agent_activity_log|update public\.gi_agent_activity_log/i.test(code), "it does not write a log row");
assert(!/\b(agent_name|detail_text|entity_label|payload|phone|email|pin|body)\b/i.test(readable), "log cells are not selected");
assert(!/public\.customers|public\.agents|public\.app_meta|public\.proposals/i.test(code), "other business tables are not named");

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
    create table public.gi_agent_activity_log (id text primary key);
    create table public.notes (id text primary key);
    grant select, insert on public.gi_agent_activity_log to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.gi_agent_activity_log(id) values ('active');
    alter table public.gi_agent_activity_log enable row level security;
    alter table public.notes enable row level security;
    create policy notes_select_own on public.notes for select to authenticated using (true);
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
    await db.exec(base);
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("table=gi_agent_activity_log") && details.includes("rls_enabled=yes"), "the log is reported");
    assert(details.includes("authenticated_rows=same") && details.includes("anon_rows=already_hidden"), "the session keeps the rows and the public read stays closed");
    assert(details.includes("policies_removed=gi_actlog_insert"), "the public insert is the policy removed");
    assert(details.includes("signed_in_read=kept") && details.includes("signed_in_insert=kept"), "the signed-in paths stay");
    assert(details.includes("read_door_closed=yes") && details.includes("insert_door_closed=yes"), "both public doors are closed");
    assert(details.includes("log_rows=unchanged") && details.includes("other_tables=unchanged"), "stored rows and other tables stay");
    const second = await rowsOf(db);
    assert(second.some((row) => row.section === "policies_removed" && row.detail === "none"), "a second run removes nothing");
    await db.exec("set role anon");
    const hidden = await db.query(`select count(*)::int as n from public.gi_agent_activity_log`);
    let anonInsert = "";
    try {
      await db.exec(`insert into public.gi_agent_activity_log(id) values ('anon')`);
      anonInsert = "wrote";
    } catch(err) {
      anonInsert = String(err && err.message || err);
    }
    await db.exec("reset role");
    await db.exec("set role authenticated");
    const visible = await db.query(`select count(*)::int as n from public.gi_agent_activity_log`);
    await db.exec("reset role");
    assert(hidden.rows[0].n === 0 && /row-level security/i.test(anonInsert), "anon cannot read or insert");
    assert(visible.rows[0].n === 1, "the session still sees the row");
    const door = await db.query(`select count(*)::int as n from pg_policies where policyname = 'gi_actlog_insert'`);
    const kept = await db.query(`select count(*)::int as n from pg_policies where policyname in ('actlog_select_authenticated', 'actlog_insert_authenticated')`);
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(door.rows[0].n === 0 && kept.rows[0].n === 2, "only the public insert is gone");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    await db.exec(base.replace("create policy actlog_insert_authenticated on public.gi_agent_activity_log\n      for insert to authenticated with check (true);\n    ", ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/signed-in path is missing; nothing saved/i.test(blocked), "a missing signed-in insert saves nothing");
    const door = await db.query(`select policyname from pg_policies where policyname = 'gi_actlog_insert'`);
    assert(door.rows.length === 1, "the public insert stays when the signed-in path is missing");
  }

  {
    const db = new PGlite();
    await db.exec(base + `
      create policy anon_extra on public.gi_agent_activity_log
        for insert to anon with check (true);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/anon insert is still open; nothing saved/i.test(blocked), "a second public insert saves nothing");
    const door = await db.query(`select policyname from pg_policies where policyname = 'gi_actlog_insert'`);
    assert(door.rows.length === 1, "the named insert is restored when another public insert remains");
  }

  {
    const db = new PGlite();
    await db.exec(base + `
      create policy gi_actlog_select on public.gi_agent_activity_log
        for select to anon using (true);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/anon read is still open; nothing saved/i.test(blocked), "an open public read saves nothing");
    const door = await db.query(`select policyname from pg_policies where policyname = 'gi_actlog_insert'`);
    assert(door.rows.length === 1, "the public insert stays when the public read is open");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.gi_agent_activity_log (id text primary key);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/row security is off; nothing saved/i.test(blocked), "row security is not switched on in order to close the insert");
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
