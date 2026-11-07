/**
 * The public doors on referrals, perf events, and devices close together.
 * The signed-in paths stay.
 * Run: node _test-close-elem-perf-devices.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-close-elem-perf-devices.sql"), "utf8");
const code = executable(sql);
const readable = code.replace(/\$body\$/g, "");

console.log("1) the file closes the named public doors");
[
  'drop policy "gi_elem_ref_all" on public.gi_elementary_referrals',
  'drop policy "gi_elem_ref_restore_anon" on public.gi_elementary_referrals',
  'drop policy "gi_perf_events_select_authenticated" on public.gi_perf_events',
  'drop policy "gi_perf_events_insert_authenticated" on public.gi_perf_events',
  'drop policy "gi_perf_events_restore_anon" on public.gi_perf_events',
  'drop policy "owner_devices_open_insert_for_mvp" on public.owner_devices',
  'drop policy "owner_devices_open_update_for_mvp" on public.owner_devices',
  'drop policy "owner_devices_restore_anon" on public.owner_devices'
].forEach((stmt) => assert(code.includes(stmt), stmt));
assert((code.match(/drop policy/gi) || []).length === 8, "it drops eight policies");
assert(!code.includes('drop policy "perf_events_select_authenticated"'), "it does not drop the signed-in perf read");
assert(!code.includes('drop policy "z_block_anon_delete"'), "it does not drop the delete block");
assert(!code.includes('drop policy "gi_elementary_referrals_all_authenticated"'), "it does not drop the referrals path");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/create policy/i.test(code), "it does not create a policy");
assert(!/\b(payload|phone|email|pin|agent_name|body|token)\b/i.test(readable), "stored fields are not selected");
assert(!/public\.agents|public\.app_meta|public\.customers|public\.proposals|public\.reminders/i.test(code), "other business tables are not named");

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
    create table public.gi_elementary_referrals (id text primary key);
    create table public.gi_perf_events (id text primary key);
    create table public.owner_devices (id text primary key);
    create table public.notes (id text primary key);
    grant select, insert, update, delete on public.gi_elementary_referrals to anon, authenticated;
    grant select, insert, update, delete on public.gi_perf_events to anon, authenticated;
    grant select, insert, update, delete on public.owner_devices to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.gi_elementary_referrals(id) values ('active');
    alter table public.gi_elementary_referrals enable row level security;
    alter table public.gi_perf_events enable row level security;
    alter table public.owner_devices enable row level security;
    alter table public.notes enable row level security;
    create policy notes_select_own on public.notes for select to authenticated using (true);
    create policy gi_elementary_referrals_all_authenticated on public.gi_elementary_referrals
      for all to authenticated using (true) with check (true);
    create policy elem_ref_select_authenticated on public.gi_elementary_referrals
      for select to authenticated using (false);
    create policy elem_ref_insert_authenticated on public.gi_elementary_referrals
      for insert to authenticated with check (false);
    create policy elem_ref_update_authenticated on public.gi_elementary_referrals
      for update to authenticated using (false) with check (false);
    create policy z_block_anon_delete on public.gi_elementary_referrals
      for delete to anon using (false);
    create policy gi_perf_events_all_authenticated on public.gi_perf_events
      for all to authenticated using (true) with check (true);
    create policy perf_events_select_authenticated on public.gi_perf_events
      for select to authenticated using (true);
    create policy perf_events_insert_authenticated on public.gi_perf_events
      for insert to authenticated with check (false);
    create policy owner_devices_all_authenticated on public.owner_devices
      for all to authenticated using (true) with check (true);
    create policy owner_devices_select_authenticated on public.owner_devices
      for select to authenticated using (false);
    create policy owner_devices_insert_authenticated on public.owner_devices
      for insert to authenticated with check (false);
    create policy owner_devices_update_authenticated on public.owner_devices
      for update to authenticated using (false) with check (false);
  `;

  const doors = `
    create policy gi_elem_ref_all on public.gi_elementary_referrals
      for all to public using (true) with check (true);
    create policy gi_elem_ref_restore_anon on public.gi_elementary_referrals
      for all to anon, authenticated using (true) with check (true);
    create policy gi_perf_events_select_authenticated on public.gi_perf_events
      for select to anon, authenticated using (true);
    create policy gi_perf_events_insert_authenticated on public.gi_perf_events
      for insert to anon, authenticated with check (true);
    create policy gi_perf_events_restore_anon on public.gi_perf_events
      for all to anon, authenticated using (true) with check (true);
    create policy owner_devices_open_insert_for_mvp on public.owner_devices
      for insert to anon, authenticated with check (true);
    create policy owner_devices_open_update_for_mvp on public.owner_devices
      for update to anon, authenticated using (true) with check (true);
    create policy owner_devices_restore_anon on public.owner_devices
      for all to anon, authenticated using (true) with check (true);
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
    assert(details.filter((row) => row.startsWith("table=")).join(",") === "table=gi_elementary_referrals,table=gi_perf_events,table=owner_devices", "the three tables are named");
    assert(details.includes("anon_rows=hidden"), "the public key no longer sees the referral rows");
    assert(details.filter((row) => row === "anon_rows=already_hidden").length === 2, "empty tables were already hidden");
    assert(details.filter((row) => row === "authenticated_rows=same").length === 3, "a session still sees the same rows");
    assert(details.includes("stored_rows=unchanged") && details.includes("other_tables=unchanged"), "stored rows and other tables stay");
    assert(details.includes("signed_in_paths=kept") && details.includes("delete_block=kept") && details.includes("door_closed=yes"), "the signed-in paths stay and the doors close");
    const removed = String(first.find((row) => row.section === "policies_removed").detail);
    ["gi_elem_ref_all", "gi_elem_ref_restore_anon", "gi_perf_events_restore_anon", "owner_devices_restore_anon"].forEach((name) => {
      assert(removed.includes(name), "removed " + name);
    });
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.filter((row) => row === "anon_rows=already_hidden").length === 3, "a second run removes nothing");
    await db.exec("set role anon");
    const hidden = await db.query(`select count(*)::int as n from public.gi_elementary_referrals`);
    await db.exec("reset role");
    await db.exec("set role authenticated");
    const visible = await db.query(`select count(*)::int as n from public.gi_elementary_referrals`);
    await db.exec("reset role");
    assert(hidden.rows[0].n === 0 && visible.rows[0].n === 1, "anon sees nothing and the session still sees the referral");
    const block = await db.query(`select policyname from pg_policies where policyname = 'z_block_anon_delete'`);
    const kept = await db.query(`select policyname from pg_policies where policyname = 'perf_events_select_authenticated'`);
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(block.rows.length === 1 && kept.rows.length === 1, "the delete block and the signed-in perf read stay");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    await db.exec(base.replace("create policy gi_elementary_referrals_all_authenticated on public.gi_elementary_referrals\n      for all to authenticated using (true) with check (true);\n    ", "") + doors);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/signed-in path is missing; nothing saved/i.test(blocked), "a missing signed-in path saves nothing");
    const door = await db.query(`select policyname from pg_policies where policyname = 'gi_elem_ref_all'`);
    assert(door.rows.length === 1, "the public door stays when the signed-in path is missing");
  }

  {
    const db = new PGlite();
    await db.exec(base + doors + `
      create policy anon_extra on public.gi_perf_events for select to anon using (true);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/anon door is still open; nothing saved/i.test(blocked), "a second public read saves nothing");
    const door = await db.query(`select policyname from pg_policies where policyname = 'gi_elem_ref_all'`);
    assert(door.rows.length === 1, "the named door is restored when another public read remains");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.gi_elementary_referrals (id text primary key);
      create table public.gi_perf_events (id text primary key);
      create table public.owner_devices (id text primary key);
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
