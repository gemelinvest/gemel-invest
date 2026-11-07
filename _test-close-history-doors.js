/**
 * The public doors on the three history tables close together.
 * Signed-in read, insert, and update stay. The blocks stay.
 * Run: node _test-close-history-doors.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-close-history-doors.sql"), "utf8");
const code = executable(sql);
const readable = code.replace(/\$body\$/g, "");

console.log("1) the file closes the named public doors");
[
  'drop policy "agents_history_update" on public.agents_history',
  'drop policy "gi_agents_history_select_app" on public.agents_history',
  'drop policy "gi_agents_history_insert_app" on public.agents_history',
  'drop policy "customers_history_select" on public.customers_history',
  'drop policy "customers_history_insert" on public.customers_history',
  'drop policy "customers_history_update" on public.customers_history',
  'drop policy "proposals_history_select" on public.proposals_history',
  'drop policy "proposals_history_insert" on public.proposals_history',
  'drop policy "proposals_history_update" on public.proposals_history'
].forEach((stmt) => assert(code.includes(stmt), stmt));
assert((code.match(/drop policy/gi) || []).length === 9, "it drops nine policies");
assert(!code.includes('drop policy "agents_history_update_open"'), "it does not drop the signed-in agent update");
assert(!code.includes('drop policy "customers_history_update_open"'), "it does not drop the signed-in customer update");
assert(!code.includes('drop policy "z_block_anon_delete"'), "it does not drop a delete block");
assert(!code.includes('drop policy "z_block_anon_update"'), "it does not drop an update block");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/create policy/i.test(code), "it does not create a policy");
assert(!/\b(payload|phone|email|pin|agent_name|body)\b/i.test(readable), "stored fields are not selected");
assert(!/public\.app_meta|public\.reminders|gi_elementary_referrals/i.test(code), "other business tables are not named");

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
    create table public.agents_history (id text primary key);
    create table public.customers_history (id text primary key);
    create table public.proposals_history (id text primary key);
    create table public.notes (id text primary key);
    grant select, insert, update, delete on public.agents_history to anon, authenticated;
    grant select, insert, update, delete on public.customers_history to anon, authenticated;
    grant select, insert, update, delete on public.proposals_history to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.agents_history(id) values ('active');
    insert into public.customers_history(id) values ('active');
    insert into public.proposals_history(id) values ('active');
    alter table public.agents_history enable row level security;
    alter table public.customers_history enable row level security;
    alter table public.proposals_history enable row level security;
    alter table public.notes enable row level security;
    create policy notes_select_own on public.notes for select to authenticated using (true);
    create policy agents_history_select_authenticated on public.agents_history
      for select to authenticated using (true);
    create policy agents_history_insert_authenticated on public.agents_history
      for insert to authenticated with check (true);
    create policy agents_history_update_open on public.agents_history
      for update to authenticated using (true) with check (true);
    create policy customers_history_select_authenticated on public.customers_history
      for select to authenticated using (true);
    create policy customers_history_insert_authenticated on public.customers_history
      for insert to authenticated with check (true);
    create policy gi_customers_history_select_auth on public.customers_history
      for select to authenticated using (true);
    create policy gi_customers_history_insert_auth on public.customers_history
      for insert to authenticated with check (true);
    create policy customers_history_update_open on public.customers_history
      for update to authenticated using (true) with check (true);
    create policy z_block_anon_delete on public.customers_history
      for delete to anon using (false);
    create policy z_block_anon_update on public.customers_history
      for update to anon using (false) with check (false);
    create policy proposals_history_select_authenticated on public.proposals_history
      for select to authenticated using (true);
    create policy proposals_history_insert_authenticated on public.proposals_history
      for insert to authenticated with check (true);
    create policy gi_proposals_history_select_auth on public.proposals_history
      for select to authenticated using (true);
    create policy gi_proposals_history_insert_auth on public.proposals_history
      for insert to authenticated with check (true);
    create policy proposals_history_update_open on public.proposals_history
      for update to authenticated using (true) with check (true);
    create policy z_block_anon_delete on public.proposals_history
      for delete to anon using (false);
    create policy z_block_anon_update on public.proposals_history
      for update to anon using (false) with check (false);
  `;

  const doors = `
    create policy agents_history_update on public.agents_history
      for update to public using (true) with check (true);
    create policy gi_agents_history_select_app on public.agents_history
      for select to anon, authenticated using (true);
    create policy gi_agents_history_insert_app on public.agents_history
      for insert to anon, authenticated with check (true);
    create policy customers_history_select on public.customers_history
      for select to public using (true);
    create policy customers_history_insert on public.customers_history
      for insert to public with check (true);
    create policy customers_history_update on public.customers_history
      for update to public using (true) with check (true);
    create policy proposals_history_select on public.proposals_history
      for select to public using (true);
    create policy proposals_history_insert on public.proposals_history
      for insert to public with check (true);
    create policy proposals_history_update on public.proposals_history
      for update to public using (true) with check (true);
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
    assert(details.filter((row) => row.startsWith("table=")).join(",") === "table=agents_history,table=customers_history,table=proposals_history", "the three tables are named");
    assert(details.filter((row) => row === "anon_rows=hidden").length === 3, "the public key no longer sees the rows");
    assert(details.filter((row) => row === "authenticated_rows=same").length === 3, "a session still sees the same rows");
    assert(details.includes("stored_rows=unchanged") && details.includes("other_tables=unchanged"), "stored rows and other tables stay");
    assert(details.includes("signed_in_paths=kept") && details.includes("blocks=kept") && details.includes("door_closed=yes"), "the signed-in paths and blocks stay");
    const removed = String(first.find((row) => row.section === "policies_removed").detail);
    ["agents_history_update", "gi_agents_history_select_app", "customers_history_select", "proposals_history_update"].forEach((name) => {
      assert(removed.split(" ").includes(name), "removed " + name);
    });
    assert(!removed.split(" ").includes("agents_history_update_open"), "the signed-in update is not listed as removed");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.filter((row) => row === "anon_rows=already_hidden").length === 3, "a second run removes nothing");
    await db.exec("set role anon");
    const hidden = await db.query(`select count(*)::int as n from public.customers_history`);
    await db.exec("reset role");
    await db.exec("set role authenticated");
    const visible = await db.query(`select count(*)::int as n from public.proposals_history`);
    await db.exec("reset role");
    assert(hidden.rows[0].n === 0 && visible.rows[0].n === 1, "anon sees nothing and the session still sees the row");
    const blocks = await db.query(`select count(*)::int as n from pg_policies where policyname in ('z_block_anon_delete', 'z_block_anon_update')`);
    const kept = await db.query(`select policyname from pg_policies where policyname = 'agents_history_update_open'`);
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(blocks.rows[0].n === 4 && kept.rows.length === 1, "the blocks and the signed-in update stay");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    await db.exec(base.replace("create policy agents_history_update_open on public.agents_history\n      for update to authenticated using (true) with check (true);\n    ", "") + doors);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/signed-in path is missing; nothing saved/i.test(blocked), "a missing signed-in path saves nothing");
    const door = await db.query(`select policyname from pg_policies where policyname = 'agents_history_update'`);
    assert(door.rows.length === 1, "the public door stays when the signed-in path is missing");
  }

  {
    const db = new PGlite();
    await db.exec(base + doors + `
      create policy anon_extra on public.customers_history for select to anon using (true);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/anon door is still open; nothing saved/i.test(blocked), "a second public read saves nothing");
    const door = await db.query(`select policyname from pg_policies where policyname = 'customers_history_select'`);
    assert(door.rows.length === 1, "the named door is restored when another public read remains");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.agents_history (id text primary key);
      create table public.customers_history (id text primary key);
      create table public.proposals_history (id text primary key);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/row security is off; nothing saved/i.test(blocked), "row security is not switched on in order to close the doors");
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
