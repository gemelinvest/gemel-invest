/**
 * Owner devices stay with a manager. A regular person cannot read a device
 * even when owner_id matches them. The open signed-in path is removed.
 * Run: node _test-owner-devices-by-role.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-owner-devices-by-role.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes the open path and keeps devices with a manager");
assert(code.includes("drop policy owner_devices_all_authenticated"), "it removes the open path");
assert(code.includes("owner_devices_delete_authenticated"), "it adds a delete for a manager");
assert(code.includes("gi_jwt_is_manager()"), "a manager can read every device");
assert(!code.includes("coalesce(owner_id, '') = public.gi_jwt_agent_id()"), "a matching owner_id does not open a device");
assert(!/owner_name[[:space:]]*=/.test(code), "it does not match a device by name");
assert(!code.includes("coalesce(owner_id, '') = ''"), "it does not leave a blank owner_id open");
assert(!/from\s+public\.owner_devices/i.test(code), "it does not read devices");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/public\.customers|public\.proposals|public\.agents|public\.app_meta|gi_perf_events|gi_chat_messages/i.test(code), "other tables are not named");

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
    create function public.gi_jwt_is_manager() returns boolean language sql stable as $$
      select coalesce(current_setting('gi.test_manager', true), '') = 'yes'
    $$;
    create table public.owner_devices (
      id text primary key,
      owner_id text,
      owner_name text,
      token text,
      platform text,
      updated_at timestamptz
    );
    create table public.notes (id text primary key);
    grant select, insert, update, delete on public.owner_devices to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.owner_devices(id, owner_id, owner_name, token, platform) values
      ('mine', 'a1', 'One', 'mark-1', 'ios'),
      ('blank', '', 'Two', 'mark-2', 'web');
    alter table public.owner_devices enable row level security;
    alter table public.notes enable row level security;
    create policy notes_select_own on public.notes for select to authenticated using (true);
    create policy owner_devices_all_authenticated on public.owner_devices
      for all to authenticated using (true) with check (true);
    create policy owner_devices_select_authenticated on public.owner_devices
      for select to authenticated using (public.gi_jwt_is_manager());
    create policy owner_devices_insert_authenticated on public.owner_devices
      for insert to authenticated with check (public.gi_jwt_is_manager());
    create policy owner_devices_update_authenticated on public.owner_devices
      for update to authenticated
      using (public.gi_jwt_is_manager()) with check (public.gi_jwt_is_manager());
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  async function asUser(db, manager){
    await db.exec("set role authenticated");
    await db.exec("select set_config('gi.test_manager', '" + (manager ? "yes" : "") + "', false)");
  }

  {
    const db = new PGlite();
    await db.exec(base);
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("policies_removed=owner_devices_all_authenticated"), "the open path is removed");
    assert(details.includes("select_by_role=installed") && details.includes("write_by_role=installed"), "the device policies are installed");
    assert(details.includes("blank_owner=closed") && details.includes("other_tables=unchanged"), "the blank path is closed and other tables stay");
    assert(details.includes("changed=yes"), "the cut is reported");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.includes("changed=no"), "a second run removes nothing");

    await db.exec("set role anon");
    const anonRead = await db.query("select count(*)::int as n from public.owner_devices");
    await db.exec("reset role");
    assert(anonRead.rows[0].n === 0, "anon still cannot read");

    await asUser(db, false);
    const ownCount = await db.query("select count(*)::int as n from public.owner_devices");
    let foreignInsert = "";
    try {
      await db.exec("insert into public.owner_devices(id, owner_id, owner_name, token, platform) values ('nope', 'a1', 'N', 'mark-9', 'web')");
      foreignInsert = "wrote";
    } catch(err) {
      foreignInsert = String(err && err.message || err);
    }
    await db.exec("update public.owner_devices set platform = 'stolen' where id = 'mine'");
    await db.exec("delete from public.owner_devices where id = 'mine'");
    await db.exec("reset role");
    const stillMine = await db.query("select platform from public.owner_devices where id = 'mine'");
    assert(ownCount.rows[0].n === 0, "a person cannot read a device even when owner_id matches");
    assert(/row-level security/i.test(foreignInsert), "a person cannot add a device");
    assert(stillMine.rows[0].platform === "ios", "a person cannot change or delete a device");

    await asUser(db, true);
    const managerCount = await db.query("select count(*)::int as n from public.owner_devices");
    await db.exec("update public.owner_devices set platform = 'desk' where id = 'blank'");
    await db.exec("insert into public.owner_devices(id, owner_id, owner_name, token, platform) values ('added', 'a1', 'One', 'mark-3', 'web')");
    await db.exec("delete from public.owner_devices where id = 'mine'");
    await db.exec("reset role");
    const assigned = await db.query("select platform from public.owner_devices where id = 'blank'");
    const added = await db.query("select count(*)::int as n from public.owner_devices where id = 'added'");
    const mine = await db.query("select count(*)::int as n from public.owner_devices where id = 'mine'");
    assert(managerCount.rows[0].n === 2, "a manager sees every device");
    assert(assigned.rows[0].platform === "desk", "a manager can update a blank device");
    assert(added.rows[0].n === 1, "a manager can add a device");
    assert(mine.rows[0].n === 0, "a manager can delete a device");

    const open = await db.query("select count(*)::int as n from pg_policies where policyname = 'owner_devices_all_authenticated'");
    const notes = await db.query("select policyname from pg_policies where tablename = 'notes'");
    assert(open.rows[0].n === 0, "the open path stays removed");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    const missingColumn = base
      .replace("      owner_id text,\n", "")
      .replace("id, owner_id, owner_name", "id, owner_name")
      .replace("('mine', 'a1', 'One'", "('mine', 'One'")
      .replace("('blank', '', 'Two'", "('blank', 'Two'");
    await db.exec(missingColumn);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/owner_id column is missing; nothing saved/i.test(blocked), "a missing owner_id column saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'owner_devices_all_authenticated'");
    assert(stillOpen.rows[0].n === 1, "the open path stays when the column is missing");
  }

  {
    const db = new PGlite();
    await db.exec(base + `
      create policy owner_devices_extra on public.owner_devices for select to authenticated using (false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/not the expected open set; nothing saved/i.test(blocked), "an unexpected policy saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'owner_devices_all_authenticated'");
    assert(stillOpen.rows[0].n === 1, "the open path stays when the set is unexpected");
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
