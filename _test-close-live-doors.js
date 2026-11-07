/**
 * The public doors on presence, notices, and ops events close together.
 * The signed-in paths stay.
 * Run: node _test-close-live-doors.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-close-live-doors.sql"), "utf8");
const code = executable(sql);
const readable = code.replace(/\$body\$/g, "");

console.log("1) the file closes the named public doors");
[
  'drop policy "gi_agent_live_read" on public.gi_agent_live',
  'drop policy "gi_agent_live_upsert" on public.gi_agent_live',
  'drop policy "gi_agent_live_update" on public.gi_agent_live',
  'drop policy "gi_system_notices_read" on public.gi_system_notices',
  'drop policy "gi_system_notices_insert" on public.gi_system_notices',
  'drop policy "gi_ops_ev_all" on public.gi_ops_events',
  'drop policy "gi_ops_ev_restore_anon" on public.gi_ops_events'
].forEach((stmt) => assert(code.includes(stmt), stmt));
assert((code.match(/drop policy/gi) || []).length === 7, "it drops seven policies");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/create policy/i.test(code), "it does not create a policy");
assert(!/\b(payload|phone|email|pin|agent_name|body)\b/i.test(readable), "stored fields are not selected");
assert(!/public\.agents|public\.app_meta|public\.customers|public\.proposals|gi_chat_messages/i.test(code), "other business tables are not named");

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
    create table public.gi_agent_live (id text primary key);
    create table public.gi_system_notices (id text primary key);
    create table public.gi_ops_events (id text primary key);
    create table public.notes (id text primary key);
    grant select, insert, update, delete on public.gi_agent_live to anon, authenticated;
    grant select, insert, update, delete on public.gi_system_notices to anon, authenticated;
    grant select, insert, update, delete on public.gi_ops_events to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.gi_agent_live(id) values ('active');
    insert into public.gi_system_notices(id) values ('active');
    insert into public.gi_ops_events(id) values ('active');
    alter table public.gi_agent_live enable row level security;
    alter table public.gi_system_notices enable row level security;
    alter table public.gi_ops_events enable row level security;
    alter table public.notes enable row level security;
    create policy notes_select_own on public.notes for select to authenticated using (true);
    create policy gi_agent_live_insert_open on public.gi_agent_live
      for insert to authenticated with check (true);
    create policy gi_agent_live_update_open on public.gi_agent_live
      for update to authenticated using (true) with check (true);
    create policy agent_live_select_authenticated on public.gi_agent_live
      for select to authenticated using (true);
    create policy agent_live_upsert_authenticated on public.gi_agent_live
      for insert to authenticated with check (false);
    create policy agent_live_update_authenticated on public.gi_agent_live
      for update to authenticated using (false) with check (false);
    create policy system_notices_select_authenticated on public.gi_system_notices
      for select to authenticated using (true);
    create policy system_notices_insert_authenticated on public.gi_system_notices
      for insert to authenticated with check (true);
    create policy gi_ops_events_all_authenticated on public.gi_ops_events
      for all to authenticated using (true) with check (true);
    create policy ops_ev_select_authenticated on public.gi_ops_events
      for select to authenticated using (false);
    create policy ops_ev_insert_authenticated on public.gi_ops_events
      for insert to authenticated with check (false);
    create policy z_block_anon_delete on public.gi_ops_events
      for delete to anon using (false);
  `;

  const doors = `
    create policy gi_agent_live_read on public.gi_agent_live for select to anon using (true);
    create policy gi_agent_live_upsert on public.gi_agent_live for insert to anon with check (true);
    create policy gi_agent_live_update on public.gi_agent_live for update to anon using (true) with check (true);
    create policy gi_system_notices_read on public.gi_system_notices for select to public using (true);
    create policy gi_system_notices_insert on public.gi_system_notices for insert to public with check (true);
    create policy gi_ops_ev_all on public.gi_ops_events for all to public using (true) with check (true);
    create policy gi_ops_ev_restore_anon on public.gi_ops_events for all to anon, authenticated using (true) with check (true);
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  {
    const db = new PGlite();
    await db.exec(base + doors);
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.filter((row) => row.startsWith("table=")).join(",") === "table=gi_agent_live,table=gi_system_notices,table=gi_ops_events", "the three tables are named");
    assert(details.filter((row) => row === "anon_rows=hidden").length === 3, "the public key no longer sees the rows");
    assert(details.filter((row) => row === "authenticated_rows=same").length === 3, "a session still sees the same rows");
    assert(details.includes("stored_rows=unchanged") && details.includes("other_tables=unchanged"), "stored rows and other tables stay");
    assert(details.includes("signed_in_paths=kept") && details.includes("door_closed=yes"), "the signed-in paths stay and the doors close");
    assert(String(first.find((row) => row.section === "policies_removed").detail).includes("gi_ops_ev_restore_anon"), "the named doors are removed");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.filter((row) => row === "anon_rows=already_hidden").length === 3, "a second run removes nothing");
    await db.exec("set role anon");
    const hidden = await db.query(`select count(*)::int as n from public.gi_agent_live`);
    await db.exec("reset role");
    await db.exec("set role authenticated");
    const visible = await db.query(`select count(*)::int as n from public.gi_ops_events`);
    await db.exec("reset role");
    assert(hidden.rows[0].n === 0 && visible.rows[0].n === 1, "anon sees nothing and the session still sees the ops row");
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
    const block = await db.query(`select policyname from pg_policies where policyname = 'z_block_anon_delete'`);
    assert(block.rows.length === 1, "the ops delete block stays");
  }

  {
    const db = new PGlite();
    await db.exec(base.replace("create policy gi_agent_live_insert_open on public.gi_agent_live\n      for insert to authenticated with check (true);\n    ", "") + doors);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/presence insert path is missing; nothing saved/i.test(blocked), "a missing presence path saves nothing");
    const door = await db.query(`select policyname from pg_policies where policyname = 'gi_agent_live_read'`);
    assert(door.rows.length === 1, "the public door stays when the signed-in path is missing");
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
