/**
 * Simulator saves follow the screen. An admin or an owner can read every
 * save. Everyone else reads a save with their agent_id, or a save whose
 * agent_name matches their name. A regular manager does not see the rest.
 * The open signed-in path is removed.
 * Run: node _test-simsaves-by-role.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-simsaves-by-role.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes the open path and rewrites the save policies");
assert(code.includes("drop policy gi_simsaves_all_authenticated"), "it removes the open path");
assert(code.includes("'admin'"), "an admin can read every save");
assert(code.includes("'owner'"), "an owner can read every save");
assert(code.includes("coalesce(agent_id, '') = public.gi_jwt_agent_id()"), "anyone else is limited to their own save");
assert(code.includes("agent_name"), "a save is also visible when the name matches");
assert(!code.includes("gi_jwt_is_manager()"), "a regular manager is not given every save");
assert(!code.includes("'opsagent'"), "an operations user is not given every save");
assert(!code.includes("'teammanager'"), "a team manager is not given the team saves");
assert(!code.includes("'elementary'"), "there is no elementary pool of saves");
assert(!code.includes("coalesce(agent_id, '') = ''"), "it does not leave a blank agent_id open");
assert(!/from\s+public\.gi_simulator_saves/i.test(code), "it does not read saved calculations");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/public\.customers|public\.proposals|public\.app_meta|gi_chat_messages/i.test(code), "other business tables are not named");

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
    create table public.agents (
      id text primary key,
      name text,
      username text
    );
    create table public.gi_simulator_saves (
      id text primary key,
      agent_id text,
      agent_name text,
      note text
    );
    create table public.notes (id text primary key);
    grant select on public.agents to authenticated;
    grant select, insert, update, delete on public.gi_simulator_saves to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.agents(id, name, username) values
      ('a1', 'Agent One', 'agent1'),
      ('a2', 'Agent Two', 'agent2'),
      ('boss', 'Office Manager', 'boss'),
      ('ops', 'Ops Person', 'ops');
    insert into public.gi_simulator_saves(id, agent_id, agent_name, note) values
      ('mine', 'a1', 'Agent One', '1'),
      ('byname', 'a2', 'Agent One', '2'),
      ('casename', 'a2', 'agent one', '3'),
      ('other', 'a2', 'Agent Two', '4'),
      ('blank', '', '', '5'),
      ('bossrow', 'boss', 'Office Manager', '6');
    alter table public.gi_simulator_saves enable row level security;
    alter table public.notes enable row level security;
    create function public.gi_jwt_agent_id() returns text language sql stable as $$
      select coalesce(current_setting('gi.test_agent', true), '')
    $$;
    create function public.gi_jwt_is_manager() returns boolean language sql stable as $$
      select coalesce(current_setting('gi.test_manager', true), '') = 'yes'
    $$;
    create function public.gi_jwt_role() returns text language sql stable as $$
      select coalesce(current_setting('gi.test_role', true), '')
    $$;
    create policy notes_select_own on public.notes for select to authenticated using (true);
    create policy gi_simsaves_all_authenticated on public.gi_simulator_saves
      for all to authenticated using (true) with check (true);
    create policy simsaves_select_authenticated on public.gi_simulator_saves
      for select to authenticated
      using (
        public.gi_jwt_is_manager()
        or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
      );
    create policy simsaves_insert_authenticated on public.gi_simulator_saves
      for insert to authenticated
      with check (
        public.gi_jwt_is_manager()
        or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
      );
    create policy simsaves_update_authenticated on public.gi_simulator_saves
      for update to authenticated
      using (
        public.gi_jwt_is_manager()
        or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
      )
      with check (
        public.gi_jwt_is_manager()
        or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
      );
    create policy simsaves_delete_authenticated on public.gi_simulator_saves
      for delete to authenticated
      using (
        public.gi_jwt_is_manager()
        or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id())
      );
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  async function asUser(db, agent, role, manager){
    await db.exec("set role authenticated");
    await db.exec("select set_config('gi.test_agent', '" + agent + "', false)");
    await db.exec("select set_config('gi.test_role', '" + role + "', false)");
    await db.exec("select set_config('gi.test_manager', '" + (manager ? "yes" : "") + "', false)");
  }

  {
    const db = new PGlite();
    await db.exec(base);
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("policies_removed=gi_simsaves_all_authenticated"), "the open path is removed");
    assert(details.includes("select_by_role=installed") && details.includes("write_by_role=installed"), "the save policies are installed");
    assert(details.includes("blank_agent=closed") && details.includes("other_tables=unchanged"), "the blank path is closed and other tables stay");
    assert(details.includes("changed=yes"), "the cut is reported");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.includes("changed=no"), "a second run removes nothing");

    await db.exec("set role anon");
    const anonRead = await db.query("select count(*)::int as n from public.gi_simulator_saves");
    await db.exec("reset role");
    assert(anonRead.rows[0].n === 0, "anon still cannot read");

    await asUser(db, "a1", "agent", false);
    const ownIds = await db.query("select id from public.gi_simulator_saves order by id");
    await db.exec("update public.gi_simulator_saves set note = 'x' where id = 'other'");
    let foreignInsert = "";
    try {
      await db.exec("insert into public.gi_simulator_saves(id, agent_id, agent_name, note) values ('nope', 'a2', 'Agent Two', '9')");
      foreignInsert = "wrote";
    } catch(err) {
      foreignInsert = String(err && err.message || err);
    }
    await db.exec("update public.gi_simulator_saves set note = 'kept' where id = 'mine'");
    await db.exec("delete from public.gi_simulator_saves where id = 'mine'");
    await db.exec("reset role");
    const seen = ownIds.rows.map((row) => row.id);
    const otherNote = await db.query("select note from public.gi_simulator_saves where id = 'other'");
    const mine = await db.query("select count(*)::int as n from public.gi_simulator_saves where id = 'mine'");
    assert(seen.join(",") === "byname,casename,mine", "an agent sees their own save and a save with their name");
    assert(otherNote.rows[0].note === "4", "an agent cannot change another save");
    assert(/row-level security/i.test(foreignInsert), "an agent cannot insert another agent's save");
    assert(mine.rows[0].n === 0, "an agent can delete their own save");

    await asUser(db, "boss", "manager", true);
    const bossIds = await db.query("select id from public.gi_simulator_saves order by id");
    await db.exec("reset role");
    assert(bossIds.rows.map((row) => row.id).join(",") === "bossrow", "a regular manager sees only their own save");

    await asUser(db, "ops", "opsagent", false);
    const opsCount = await db.query("select count(*)::int as n from public.gi_simulator_saves");
    await db.exec("reset role");
    assert(opsCount.rows[0].n === 0, "an operations user does not see every save");

    await asUser(db, "boss", "admin", false);
    const adminCount = await db.query("select count(*)::int as n from public.gi_simulator_saves");
    await db.exec("update public.gi_simulator_saves set agent_id = 'a1' where id = 'blank'");
    await db.exec("reset role");
    const assigned = await db.query("select agent_id from public.gi_simulator_saves where id = 'blank'");
    assert(adminCount.rows[0].n === 5, "an admin sees every remaining save");
    assert(assigned.rows[0].agent_id === "a1", "an admin can assign a blank save");

    await asUser(db, "a2", "owner", false);
    const ownerCount = await db.query("select count(*)::int as n from public.gi_simulator_saves");
    await db.exec("reset role");
    assert(ownerCount.rows[0].n === 5, "an owner sees every remaining save");

    const open = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_simsaves_all_authenticated'");
    const notes = await db.query("select policyname from pg_policies where tablename = 'notes'");
    assert(open.rows[0].n === 0, "the open path stays removed");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    const missingColumn = base
      .replace("      agent_id text,\n      agent_name text,\n      note text", "      agent_id text,\n      note text")
      .replace(
        "insert into public.gi_simulator_saves(id, agent_id, agent_name, note) values\n      ('mine', 'a1', 'Agent One', '1'),\n      ('byname', 'a2', 'Agent One', '2'),\n      ('casename', 'a2', 'agent one', '3'),\n      ('other', 'a2', 'Agent Two', '4'),\n      ('blank', '', '', '5'),\n      ('bossrow', 'boss', 'Office Manager', '6');",
        "insert into public.gi_simulator_saves(id, agent_id, note) values\n      ('mine', 'a1', '1'),\n      ('byname', 'a2', '2'),\n      ('casename', 'a2', '3'),\n      ('other', 'a2', '4'),\n      ('blank', '', '5'),\n      ('bossrow', 'boss', '6');"
      );
    await db.exec(missingColumn);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/agent_name column is missing; nothing saved/i.test(blocked), "a missing agent_name column saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_simsaves_all_authenticated'");
    assert(stillOpen.rows[0].n === 1, "the open path stays when the column is missing");
  }

  {
    const db = new PGlite();
    await db.exec(base + `
      create policy simsaves_extra on public.gi_simulator_saves for select to authenticated using (false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/not the expected open set; nothing saved/i.test(blocked), "an unexpected policy saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_simsaves_all_authenticated'");
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
