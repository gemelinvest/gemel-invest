/**
 * Operations events are a shared pool. A manager and an operations user
 * can read and write every event. Anyone else cannot. There is no
 * authenticated delete, and the anon delete block stays. The open
 * signed-in path is removed, and the missing update policy is added.
 * Run: node _test-ops-events-by-role.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-ops-events-by-role.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes the open path and rewrites the event policies");
assert(code.includes("drop policy gi_ops_events_all_authenticated"), "it removes the open path");
assert(code.includes("ops_ev_update_authenticated"), "it adds the missing update");
assert(!code.includes("drop policy z_block_anon_delete"), "it keeps the anon delete block");
assert(code.includes("gi_jwt_is_manager()"), "a manager can read the pool");
assert(code.includes("'opsagent'"), "an operations user is matched in lowercase");
assert(code.includes("'תפעול'"), "the Hebrew operations role can read the pool");
assert(!code.includes("('ops', 'opsAgent')"), "it does not compare a capital-letter operations role");
assert(!code.includes("'teammanager'"), "a team manager is not given the pool");
assert(!code.includes("created_by_key = ''"), "it does not leave a blank owner open");
assert(!/from\s+public\.gi_ops_events/i.test(code), "it does not read events");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/public\.customers|public\.proposals|public\.agents|public\.app_meta|gi_chat_messages|gi_elementary_referrals|gi_agent_live/i.test(code), "other tables are not named");

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
    create table public.gi_ops_events (
      id text primary key,
      created_by_key text,
      note text
    );
    create table public.notes (id text primary key);
    grant select, insert, update, delete on public.gi_ops_events to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.gi_ops_events(id, created_by_key, note) values
      ('mine', 'ops1', '1'),
      ('other', 'a1', '2'),
      ('blank', '', '3');
    alter table public.gi_ops_events enable row level security;
    alter table public.notes enable row level security;
    create function public.gi_jwt_is_manager() returns boolean language sql stable as $$
      select coalesce(current_setting('gi.test_manager', true), '') = 'yes'
    $$;
    create function public.gi_jwt_role() returns text language sql stable as $$
      select coalesce(current_setting('gi.test_role', true), '')
    $$;
    create policy notes_select_own on public.notes for select to authenticated using (true);
    create policy gi_ops_events_all_authenticated on public.gi_ops_events
      for all to authenticated using (true) with check (true);
    create policy ops_ev_select_authenticated on public.gi_ops_events
      for select to authenticated
      using (public.gi_jwt_is_manager() or public.gi_jwt_role() in ('ops', 'opsAgent'));
    create policy ops_ev_insert_authenticated on public.gi_ops_events
      for insert to authenticated
      with check (public.gi_jwt_is_manager() or public.gi_jwt_role() in ('ops', 'opsAgent'));
    create policy z_block_anon_delete on public.gi_ops_events
      for delete to anon using (false);
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  async function asUser(db, role, manager){
    await db.exec("set role authenticated");
    await db.exec("select set_config('gi.test_role', '" + role + "', false)");
    await db.exec("select set_config('gi.test_manager', '" + (manager ? "yes" : "") + "', false)");
  }

  {
    const db = new PGlite();
    await db.exec(base);
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("policies_removed=gi_ops_events_all_authenticated"), "the open path is removed");
    assert(details.includes("select_by_role=installed") && details.includes("write_by_role=installed"), "the event policies are installed");
    assert(details.includes("blank_owner=closed") && details.includes("anon_delete_block=kept"), "the blank path is closed and the anon block stays");
    assert(details.includes("other_tables=unchanged") && details.includes("changed=yes"), "the cut is reported");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.includes("changed=no"), "a second run removes nothing");

    await db.exec("set role anon");
    const anonRead = await db.query("select count(*)::int as n from public.gi_ops_events");
    await db.exec("delete from public.gi_ops_events where id = 'mine'");
    await db.exec("reset role");
    const afterAnon = await db.query("select count(*)::int as n from public.gi_ops_events where id = 'mine'");
    assert(anonRead.rows[0].n === 0, "anon still cannot read");
    assert(afterAnon.rows[0].n === 1, "anon still cannot delete");

    await asUser(db, "opsagent", false);
    const poolIds = await db.query("select id from public.gi_ops_events order by id");
    await db.exec("update public.gi_ops_events set note = 'kept' where id = 'other'");
    await db.exec("insert into public.gi_ops_events(id, created_by_key, note) values ('added', 'a1', '4')");
    await db.exec("delete from public.gi_ops_events where id = 'mine'");
    await db.exec("reset role");
    const seen = poolIds.rows.map((row) => row.id);
    const otherNote = await db.query("select note from public.gi_ops_events where id = 'other'");
    const added = await db.query("select count(*)::int as n from public.gi_ops_events where id = 'added'");
    const mine = await db.query("select count(*)::int as n from public.gi_ops_events where id = 'mine'");
    assert(seen.join(",") === "blank,mine,other", "an operations user sees the whole pool");
    assert(otherNote.rows[0].note === "kept", "an operations user can update an existing event");
    assert(added.rows[0].n === 1, "an operations user can add an event");
    assert(mine.rows[0].n === 1, "an operations user cannot delete an event");

    await asUser(db, "תפעול", false);
    const hebrewCount = await db.query("select count(*)::int as n from public.gi_ops_events");
    await db.exec("reset role");
    assert(hebrewCount.rows[0].n === 4, "the Hebrew operations role sees the pool");

    await asUser(db, "agent", false);
    const agentCount = await db.query("select count(*)::int as n from public.gi_ops_events");
    let foreignInsert = "";
    try {
      await db.exec("insert into public.gi_ops_events(id, created_by_key, note) values ('nope', 'a1', '9')");
      foreignInsert = "wrote";
    } catch(err) {
      foreignInsert = String(err && err.message || err);
    }
    await db.exec("reset role");
    assert(agentCount.rows[0].n === 0, "a regular agent does not see the pool");
    assert(/row-level security/i.test(foreignInsert), "a regular agent cannot add an event");

    await asUser(db, "elementary", false);
    const elemCount = await db.query("select count(*)::int as n from public.gi_ops_events");
    await db.exec("reset role");
    assert(elemCount.rows[0].n === 0, "an elementary user does not see the pool");

    await asUser(db, "manager", true);
    const managerCount = await db.query("select count(*)::int as n from public.gi_ops_events");
    await db.exec("update public.gi_ops_events set note = 'boss' where id = 'blank'");
    await db.exec("reset role");
    const blankNote = await db.query("select note from public.gi_ops_events where id = 'blank'");
    assert(managerCount.rows[0].n === 4, "a manager sees the whole pool");
    assert(blankNote.rows[0].note === "boss", "a manager can update a blank event");

    const open = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_ops_events_all_authenticated'");
    const block = await db.query("select policyname from pg_policies where policyname = 'z_block_anon_delete'");
    const updated = await db.query("select count(*)::int as n from pg_policies where policyname = 'ops_ev_update_authenticated'");
    const notes = await db.query("select policyname from pg_policies where tablename = 'notes'");
    assert(open.rows[0].n === 0, "the open path stays removed");
    assert(updated.rows[0].n === 1, "the update policy stays");
    assert(block.rows.length === 1, "the anon delete block stays");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    const missingColumn = base
      .replace("      created_by_key text,\n", "")
      .replace(", created_by_key, note) values", ", note) values")
      .replace(/, 'ops1'/g, "")
      .replace(/, 'a1'/g, "")
      .replace(/, ''/g, "");
    await db.exec(missingColumn);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/created_by_key column is missing; nothing saved/i.test(blocked), "a missing created_by_key column saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_ops_events_all_authenticated'");
    assert(stillOpen.rows[0].n === 1, "the open path stays when the column is missing");
  }

  {
    const db = new PGlite();
    await db.exec(base + `
      create policy ops_ev_extra on public.gi_ops_events for select to authenticated using (false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/not the expected open set; nothing saved/i.test(blocked), "an unexpected policy saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_ops_events_all_authenticated'");
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
