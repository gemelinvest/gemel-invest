/**
 * A person keeps the reminders stored under their name or username.
 * A manager can still read and write every reminder. The open signed-in
 * path is removed. Empty and fallback owners stay with a manager.
 * Run: node _test-reminders-by-role.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-reminders-by-role.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes the open path and follows the stored name");
assert(code.includes("drop policy reminders_all_authenticated"), "it removes the open path");
assert(code.includes("a.name") && code.includes("a.username"), "it matches the name and the username");
assert(!code.includes("gi_jwt_agent_id()"), "it does not match the agent record id");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/from\s+public\.reminders/i.test(code), "it does not read a reminder");
assert(!/public\.customers|public\.proposals|gi_agent_live|owner_devices/i.test(code), "other tables are not named");

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
    create schema if not exists auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('gi.test_uid', true), '')::uuid
    $$;
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
      auth_user_id uuid
    );
    create table public.reminders (
      id text primary key,
      agent_id text,
      customer_id text,
      is_done boolean
    );
    create table public.notes (id text primary key);
    grant select on public.agents to authenticated;
    grant select, insert, update, delete on public.reminders to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.agents(id, name, username, auth_user_id) values
      ('a1', 'Ada', 'ada', '11111111-1111-1111-1111-111111111111'),
      ('a2', 'Ben', 'ben', '22222222-2222-2222-2222-222222222222'),
      ('a3', '', 'bee', '33333333-3333-3333-3333-333333333333');
    insert into public.reminders(id, agent_id, customer_id, is_done) values
      ('r-ada', 'Ada', 'c1', false),
      ('r-ben', 'Ben', 'c2', false),
      ('r-bee', 'bee', 'c3', false),
      ('r-blank', '', 'c4', false),
      ('r-unknown', 'unknown', 'c5', false),
      ('r-system', 'מערכת', 'c6', false);
    alter table public.agents enable row level security;
    alter table public.reminders enable row level security;
    alter table public.notes enable row level security;
    create policy agents_select_authenticated on public.agents
      for select to authenticated using (true);
    create policy notes_select_own on public.notes for select to authenticated using (true);
    create policy reminders_all_authenticated on public.reminders
      for all to authenticated using (true) with check (true);
    create policy reminders_select_authenticated on public.reminders
      for select to authenticated using (public.gi_jwt_is_manager());
    create policy reminders_insert_authenticated on public.reminders
      for insert to authenticated with check (public.gi_jwt_is_manager());
    create policy reminders_update_authenticated on public.reminders
      for update to authenticated
      using (public.gi_jwt_is_manager()) with check (public.gi_jwt_is_manager());
    create policy reminders_delete_authenticated on public.reminders
      for delete to authenticated using (public.gi_jwt_is_manager());
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  async function asUser(db, uid, manager){
    await db.exec("set role authenticated");
    await db.exec("select set_config('gi.test_uid', '" + uid + "', false)");
    await db.exec("select set_config('gi.test_manager', '" + (manager ? "yes" : "") + "', false)");
  }

  {
    const db = new PGlite();
    await db.exec(base);
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("policies_removed=reminders_all_authenticated"), "the open path is removed");
    assert(details.includes("select_by_role=installed") && details.includes("write_by_role=installed"), "the name path is installed");
    assert(details.includes("blank_agent=closed") && details.includes("other_tables=unchanged") && details.includes("changed=yes"), "the cut is reported");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.includes("changed=no"), "a second run removes nothing");

    await db.exec("set role anon");
    const anonRead = await db.query("select count(*)::int as n from public.reminders");
    await db.exec("delete from public.reminders where id = 'r-ada'");
    await db.exec("reset role");
    const afterAnon = await db.query("select count(*)::int as n from public.reminders where id = 'r-ada'");
    assert(anonRead.rows[0].n === 0, "anon still cannot read");
    assert(afterAnon.rows[0].n === 1, "anon still cannot delete");

    await asUser(db, "11111111-1111-1111-1111-111111111111", false);
    const ada = await db.query("select id from public.reminders order by id");
    await db.exec("update public.reminders set is_done = true where id = 'r-ben'");
    await db.exec("update public.reminders set is_done = true where id = 'r-ada'");
    let inserted = "";
    try {
      await db.exec("insert into public.reminders(id, agent_id, is_done) values ('r-bad', 'Ben', false)");
      inserted = "wrote";
    } catch(err) {
      inserted = String(err && err.message || err);
    }
    await db.exec("insert into public.reminders(id, agent_id, is_done) values ('r-new', 'Ada', false)");
    await db.exec("delete from public.reminders where id = 'r-ben'");
    await db.exec("delete from public.reminders where id = 'r-new'");
    await db.exec("reset role");
    const adaIds = ada.rows.map((row) => row.id);
    const benDone = await db.query("select is_done from public.reminders where id = 'r-ben'");
    const adaDone = await db.query("select is_done from public.reminders where id = 'r-ada'");
    const added = await db.query("select count(*)::int as n from public.reminders where id = 'r-bad'");
    const removed = await db.query("select count(*)::int as n from public.reminders where id = 'r-new'");
    const benStill = await db.query("select count(*)::int as n from public.reminders where id = 'r-ben'");
    assert(adaIds.length === 1 && adaIds[0] === "r-ada", "a person sees the reminder stored under their name");
    assert(benDone.rows[0].is_done === false && adaDone.rows[0].is_done === true, "a person changes only their own reminder");
    assert(/row-level security/i.test(inserted) && added.rows[0].n === 0, "a person cannot add someone else's reminder");
    assert(removed.rows[0].n === 0 && benStill.rows[0].n === 1, "a person deletes only their own reminder");

    await asUser(db, "33333333-3333-3333-3333-333333333333", false);
    const bee = await db.query("select id from public.reminders order by id");
    await db.exec("reset role");
    assert(bee.rows.length === 1 && bee.rows[0].id === "r-bee", "a username still reaches its own reminder");

    await asUser(db, "22222222-2222-2222-2222-222222222222", true);
    const managed = await db.query("select id from public.reminders order by id");
    await db.exec("update public.reminders set is_done = true where id = 'r-blank'");
    await db.exec("delete from public.reminders where id = 'r-unknown'");
    await db.exec("reset role");
    const blank = await db.query("select is_done from public.reminders where id = 'r-blank'");
    const unknown = await db.query("select count(*)::int as n from public.reminders where id = 'r-unknown'");
    assert(managed.rows.length === 6, "a manager sees every reminder");
    assert(blank.rows[0].is_done === true && unknown.rows[0].n === 0, "a manager can change and delete a reminder");

    const open = await db.query("select count(*)::int as n from pg_policies where policyname = 'reminders_all_authenticated'");
    const notes = await db.query("select policyname from pg_policies where tablename = 'notes'");
    assert(open.rows[0].n === 0, "the open path stays removed");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create schema if not exists auth;
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      create role authenticated nologin;
      create function public.gi_jwt_is_manager() returns boolean language sql stable as $$ select false $$;
      create table public.agents (id text primary key, name text);
      create table public.reminders (id text primary key, agent_id text, customer_id text);
      alter table public.reminders enable row level security;
      create policy reminders_all_authenticated on public.reminders
        for all to authenticated using (true) with check (true);
      create policy reminders_select_authenticated on public.reminders
        for select to authenticated using (public.gi_jwt_is_manager());
      create policy reminders_insert_authenticated on public.reminders
        for insert to authenticated with check (public.gi_jwt_is_manager());
      create policy reminders_update_authenticated on public.reminders
        for update to authenticated using (public.gi_jwt_is_manager()) with check (public.gi_jwt_is_manager());
      create policy reminders_delete_authenticated on public.reminders
        for delete to authenticated using (public.gi_jwt_is_manager());
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/reminder columns are missing; nothing saved/i.test(blocked), "missing columns save nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'reminders_all_authenticated'");
    assert(stillOpen.rows[0].n === 1, "the open path stays when a column is missing");
  }

  {
    const db = new PGlite();
    await db.exec(base + `
      create policy reminders_extra on public.reminders for select to authenticated using (false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/not the expected open set; nothing saved/i.test(blocked), "an unexpected policy saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'reminders_all_authenticated'");
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
