/**
 * The floor stays visible to a manager, and each person keeps their own row.
 * A system notice stays readable by every signed-in person, and only a
 * manager can send one. The open floor writes are removed.
 * Run: node _test-live-by-role.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-live-by-role.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes the open writes and keeps the floor and the broadcast");
assert(code.includes("drop policy gi_agent_live_insert_open"), "it removes the open floor insert");
assert(code.includes("drop policy gi_agent_live_update_open"), "it removes the open floor update");
assert(!code.includes("drop policy system_notices_select_authenticated"), "it leaves the notice read in place until the insert is replaced");
assert(code.includes("drop policy system_notices_insert_authenticated"), "it replaces the open notice send");
assert(code.includes("coalesce(agent_id, '') = public.gi_jwt_agent_id()"), "a person keeps the floor row with their agent_id");
assert(code.includes("gi_jwt_is_manager()"), "a manager still sees the floor and can send a notice");
assert(!code.includes("coalesce(agent_id, '') = ''"), "it does not leave a blank agent_id open");
assert(!/from\s+public\.gi_agent_live/i.test(code), "it does not read the floor");
assert(!/from\s+public\.gi_system_notices/i.test(code), "it does not read a notice");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/public\.customers|public\.proposals|public\.agents|public\.app_meta|owner_devices|gi_perf_events/i.test(code), "other tables are not named");

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
    create function public.gi_jwt_agent_id() returns text language sql stable as $$
      select coalesce(current_setting('gi.test_agent', true), '')
    $$;
    create function public.gi_jwt_is_manager() returns boolean language sql stable as $$
      select coalesce(current_setting('gi.test_manager', true), '') = 'yes'
    $$;
    create table public.gi_agent_live (
      id text primary key,
      agent_id text,
      view text
    );
    create table public.gi_system_notices (
      id text primary key,
      body text,
      author_id text,
      author_name text,
      created_at timestamptz
    );
    create table public.notes (id text primary key);
    grant select, insert, update, delete on public.gi_agent_live to anon, authenticated;
    grant select, insert, update, delete on public.gi_system_notices to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.gi_agent_live(id, agent_id, view) values
      ('mine', 'a1', 'customers'),
      ('other', 'a2', 'leads'),
      ('blank', '', 'settings');
    insert into public.gi_system_notices(id, body, author_id, author_name) values
      ('n1', 'hello', 'boss', 'Boss');
    alter table public.gi_agent_live enable row level security;
    alter table public.gi_system_notices enable row level security;
    alter table public.notes enable row level security;
    create policy notes_select_own on public.notes for select to authenticated using (true);
    create policy agent_live_select_authenticated on public.gi_agent_live
      for select to authenticated using (true);
    create policy agent_live_upsert_authenticated on public.gi_agent_live
      for insert to authenticated
      with check (public.gi_jwt_is_manager() or agent_id = public.gi_jwt_agent_id());
    create policy agent_live_update_authenticated on public.gi_agent_live
      for update to authenticated
      using (public.gi_jwt_is_manager() or agent_id = public.gi_jwt_agent_id())
      with check (public.gi_jwt_is_manager() or agent_id = public.gi_jwt_agent_id());
    create policy gi_agent_live_insert_open on public.gi_agent_live
      for insert to authenticated with check (true);
    create policy gi_agent_live_update_open on public.gi_agent_live
      for update to authenticated using (true) with check (true);
    create policy system_notices_select_authenticated on public.gi_system_notices
      for select to authenticated using (true);
    create policy system_notices_insert_authenticated on public.gi_system_notices
      for insert to authenticated with check (true);
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  async function asUser(db, agent, manager){
    await db.exec("set role authenticated");
    await db.exec("select set_config('gi.test_agent', '" + agent + "', false)");
    await db.exec("select set_config('gi.test_manager', '" + (manager ? "yes" : "") + "', false)");
  }

  {
    const db = new PGlite();
    await db.exec(base);
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("policies_removed=gi_agent_live_insert_open|gi_agent_live_update_open"), "the open floor writes are removed");
    assert(details.includes("select_by_role=installed") && details.includes("write_by_role=installed"), "the floor policies are installed");
    assert(details.includes("select_by_role=open_kept"), "notice reads stay open");
    assert(details.includes("blank_agent=closed") && details.includes("blank_author=closed"), "blank rows stay closed");
    assert(details.includes("other_tables=unchanged") && details.includes("changed=yes"), "the cut is reported");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.includes("changed=no"), "a second run removes nothing");

    await db.exec("set role anon");
    const anonFloor = await db.query("select count(*)::int as n from public.gi_agent_live");
    const anonNotice = await db.query("select count(*)::int as n from public.gi_system_notices");
    await db.exec("reset role");
    assert(anonFloor.rows[0].n === 0 && anonNotice.rows[0].n === 0, "anon still cannot read");

    await asUser(db, "a1", false);
    const ownIds = await db.query("select id from public.gi_agent_live order by id");
    const noticeRead = await db.query("select count(*)::int as n from public.gi_system_notices");
    await db.exec("update public.gi_agent_live set view = 'stolen' where id = 'other'");
    let foreignInsert = "";
    try {
      await db.exec("insert into public.gi_agent_live(id, agent_id, view) values ('nope', 'a2', 'x')");
      foreignInsert = "wrote";
    } catch(err) {
      foreignInsert = String(err && err.message || err);
    }
    let noticeInsert = "";
    try {
      await db.exec("insert into public.gi_system_notices(id, body, author_id, author_name) values ('n2', 'hi', 'a1', 'One')");
      noticeInsert = "wrote";
    } catch(err) {
      noticeInsert = String(err && err.message || err);
    }
    await db.exec("insert into public.gi_agent_live(id, agent_id, view) values ('added', 'a1', 'dashboard')");
    await db.exec("update public.gi_agent_live set view = 'proposals' where id = 'mine'");
    await db.exec("reset role");
    const otherView = await db.query("select view from public.gi_agent_live where id = 'other'");
    const mineView = await db.query("select view from public.gi_agent_live where id = 'mine'");
    const added = await db.query("select count(*)::int as n from public.gi_agent_live where id = 'added'");
    const notices = await db.query("select count(*)::int as n from public.gi_system_notices");
    assert(ownIds.rows.map((row) => row.id).join(",") === "mine", "a person sees only their own floor row");
    assert(noticeRead.rows[0].n === 1, "a person still reads a system notice");
    assert(otherView.rows[0].view === "leads", "a person cannot change another floor row");
    assert(/row-level security/i.test(foreignInsert), "a person cannot insert another person's floor row");
    assert(/row-level security/i.test(noticeInsert), "a person cannot send a system notice");
    assert(added.rows[0].n === 1 && mineView.rows[0].view === "proposals", "a person can save their own floor row");
    assert(notices.rows[0].n === 1, "the notice row stays");

    await asUser(db, "boss", true);
    const managerCount = await db.query("select count(*)::int as n from public.gi_agent_live");
    await db.exec("update public.gi_agent_live set view = 'desk' where id = 'blank'");
    await db.exec("insert into public.gi_system_notices(id, body, author_id, author_name) values ('n3', 'from-manager', 'boss', 'Boss')");
    await db.exec("reset role");
    const blankView = await db.query("select view from public.gi_agent_live where id = 'blank'");
    const sent = await db.query("select count(*)::int as n from public.gi_system_notices where id = 'n3'");
    assert(managerCount.rows[0].n === 4, "a manager sees every floor row");
    assert(blankView.rows[0].view === "desk", "a manager can update a blank floor row");
    assert(sent.rows[0].n === 1, "a manager can send a system notice");

    const open = await db.query("select count(*)::int as n from pg_policies where policyname in ('gi_agent_live_insert_open', 'gi_agent_live_update_open')");
    const notes = await db.query("select policyname from pg_policies where tablename = 'notes'");
    assert(open.rows[0].n === 0, "the open floor writes stay removed");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    const missingColumn = base
      .replace("      agent_id text,\n", "")
      .replace(", agent_id, view) values", ", view) values")
      .replace(/, 'a1'/g, "")
      .replace(/, 'a2'/g, "")
      .replace(/, ''/g, "")
      .replaceAll("or agent_id = public.gi_jwt_agent_id()", "");
    await db.exec(missingColumn);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/agent_id column is missing; nothing saved/i.test(blocked), "a missing agent_id column saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_agent_live_insert_open'");
    assert(stillOpen.rows[0].n === 1, "the open floor insert stays when the column is missing");
  }

  {
    const db = new PGlite();
    await db.exec(base + `
      create policy agent_live_extra on public.gi_agent_live for select to authenticated using (false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/not the expected open set; nothing saved/i.test(blocked), "an unexpected policy saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_agent_live_update_open'");
    assert(stillOpen.rows[0].n === 1, "the open floor update stays when the set is unexpected");
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
