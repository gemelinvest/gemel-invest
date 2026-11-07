/**
 * The agent roster stays readable by every signed-in person. Only a manager
 * can add, change, or delete an agent. The open signed-in path is removed,
 * and the public delete block stays.
 * Run: node _test-agents-by-role.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-agents-by-role.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes the open write and keeps the roster read");
assert(code.includes("drop policy gi_agents_all_authenticated"), "it removes the open path");
assert(!code.includes("drop policy agents_select_authenticated"), "it leaves the roster read in place");
assert(!code.includes("drop policy z_block_anon_delete"), "it leaves the public delete block");
assert(code.includes("gi_jwt_is_manager()"), "a manager can still write an agent");
assert(!code.includes("gi_jwt_agent_id()"), "a person cannot write an agent by matching an id");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/from\s+public\.agents/i.test(code), "it does not read an agent");
assert(!/public\.customers|public\.proposals|public\.app_meta|gi_agent_live|owner_devices/i.test(code), "other tables are not named");

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
    create table public.agents (
      id text primary key,
      name text,
      username text,
      pin text,
      role text,
      active boolean,
      email text,
      auth_user_id text,
      pin_hash text
    );
    create table public.notes (id text primary key);
    grant select, insert, update, delete on public.agents to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.agents(id, name, username, pin, role, active, email, auth_user_id, pin_hash) values
      ('a1', 'One', 'one', 'mark', 'agent', true, 'one@example.com', 'u1', 'hash');
    alter table public.agents enable row level security;
    alter table public.notes enable row level security;
    create policy notes_select_own on public.notes for select to authenticated using (true);
    create policy gi_agents_all_authenticated on public.agents
      for all to authenticated using (true) with check (true);
    create policy agents_select_authenticated on public.agents
      for select to authenticated using (true);
    create policy agents_insert_authenticated on public.agents
      for insert to authenticated with check (public.gi_jwt_is_manager());
    create policy agents_update_authenticated on public.agents
      for update to authenticated
      using (public.gi_jwt_is_manager()) with check (public.gi_jwt_is_manager());
    create policy agents_delete_authenticated on public.agents
      for delete to authenticated using (public.gi_jwt_is_manager());
    create policy z_block_anon_delete on public.agents
      for delete to public using (false);
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
    assert(details.includes("policies_removed=gi_agents_all_authenticated"), "the open path is removed");
    assert(details.includes("select_by_role=open_kept") && details.includes("write_by_role=installed"), "reading stays open and writing is installed");
    assert(details.includes("blank_id=closed") && details.includes("anon_delete_block=kept"), "the blank path is closed and the delete block stays");
    assert(details.includes("other_tables=unchanged") && details.includes("changed=yes"), "the cut is reported");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.includes("changed=no"), "a second run removes nothing");

    await db.exec("set role anon");
    const anonRead = await db.query("select count(*)::int as n from public.agents");
    await db.exec("delete from public.agents where id = 'a1'");
    await db.exec("reset role");
    const afterAnon = await db.query("select count(*)::int as n from public.agents where id = 'a1'");
    assert(anonRead.rows[0].n === 0, "anon still cannot read");
    assert(afterAnon.rows[0].n === 1, "anon still cannot delete");

    await asUser(db, false);
    const seen = await db.query("select id, name, role from public.agents order by id");
    await db.exec("update public.agents set role = 'admin' where id = 'a1'");
    let inserted = "";
    try {
      await db.exec("insert into public.agents(id, name, role) values ('a2', 'Two', 'agent')");
      inserted = "wrote";
    } catch(err) {
      inserted = String(err && err.message || err);
    }
    await db.exec("delete from public.agents where id = 'a1'");
    await db.exec("reset role");
    const role = await db.query("select role from public.agents where id = 'a1'");
    const added = await db.query("select count(*)::int as n from public.agents where id = 'a2'");
    assert(seen.rows.length === 1 && seen.rows[0].name === "One", "a person still reads the roster");
    assert(role.rows[0].role === "agent", "a person cannot change an agent");
    assert(/row-level security/i.test(inserted), "a person cannot add an agent");
    assert(added.rows[0].n === 0 && role.rows.length === 1, "a person cannot delete an agent");

    await asUser(db, true);
    await db.exec("update public.agents set role = 'manager' where id = 'a1'");
    await db.exec("insert into public.agents(id, name, role) values ('a3', 'Three', 'agent')");
    await db.exec("delete from public.agents where id = 'a3'");
    await db.exec("reset role");
    const managed = await db.query("select role from public.agents where id = 'a1'");
    const gone = await db.query("select count(*)::int as n from public.agents where id = 'a3'");
    assert(managed.rows[0].role === "manager", "a manager can change an agent");
    assert(gone.rows[0].n === 0, "a manager can delete an agent");

    const open = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_agents_all_authenticated'");
    const block = await db.query("select count(*)::int as n from pg_policies where policyname = 'z_block_anon_delete'");
    const notes = await db.query("select policyname from pg_policies where tablename = 'notes'");
    assert(open.rows[0].n === 0 && block.rows[0].n === 1, "the open path stays removed and the delete block stays");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create role authenticated nologin;
      create function public.gi_jwt_is_manager() returns boolean language sql stable as $$ select false $$;
      create table public.agents (id text primary key, name text);
      alter table public.agents enable row level security;
      create policy gi_agents_all_authenticated on public.agents
        for all to authenticated using (true) with check (true);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/agent columns are missing; nothing saved/i.test(blocked), "missing agent columns save nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_agents_all_authenticated'");
    assert(stillOpen.rows[0].n === 1, "the open path stays when a column is missing");
  }

  {
    const db = new PGlite();
    await db.exec(base + `
      create policy agents_extra on public.agents for select to authenticated using (false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/not the expected open set; nothing saved/i.test(blocked), "an unexpected policy saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_agents_all_authenticated'");
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
