/**
 * Customer files follow the customer the signed-in person may see.
 * The open bucket path is removed. Update and delete use the same helper
 * as select, because an upload can overwrite an existing file.
 * Run: node _test-customer-files-by-role.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-customer-files-by-role.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes the open bucket path and rewrites the helper");
assert(code.includes("drop policy gi_customer_files_all_authenticated"), "it removes the open path");
assert(!code.includes("drop policy gi_customer_files_select_authenticated"), "it keeps the select policy");
assert(!code.includes("drop policy gi_customer_files_insert_authenticated"), "it keeps the insert policy");
assert(code.includes("gi_storage_customer_allowed"), "it rewrites the helper");
assert(code.includes("'teammanager'"), "a team manager can read a team file");
assert(code.includes("'opsagent'"), "an operations user can read");
assert(code.includes("'elementary'"), "an elementary user can read the pool");
assert(code.includes("security definer"), "the helper stays security definer");
assert(!code.includes("= 'teamManager'"), "it does not compare a capital-letter team manager");
assert(!code.includes("= 'opsAgent'"), "it does not compare a capital-letter operations agent");
assert(!code.includes("coalesce(c.agent_id, '') = ''"), "it does not leave a blank agent_id open");
assert(!/from\s+storage\.objects/i.test(code), "it does not read stored files");
assert(!/revoke /i.test(code), "it does not revoke anything");

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
    create schema storage;
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public to anon, authenticated;
    grant usage on schema storage to anon, authenticated;
    create table storage.buckets (id text primary key, public boolean);
    create table storage.objects (id text primary key, bucket_id text, name text);
    create function storage.foldername(path text) returns text[]
    language sql immutable as $$ select string_to_array(path, '/') $$;
    create table public.agents (
      id text primary key,
      name text,
      username text,
      team_manager_id text
    );
    create table public.customers (
      id text primary key,
      agent_id text,
      agent_name text,
      agent_role text
    );
    create table public.notes (id text primary key);
    grant select on public.agents to authenticated;
    grant select on public.customers to authenticated;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into storage.buckets(id, public) values ('gi-customer-files', false);
    insert into public.agents(id, name, username, team_manager_id) values
      ('a1', 'Agent One', 'agent1', 'tm'),
      ('a2', 'Agent Two', 'agent2', null),
      ('tm', 'Team Lead', 'team', null),
      ('el', 'Elem User', 'elem', null);
    insert into public.customers(id, agent_id, agent_name, agent_role) values
      ('c1', 'a1', 'Agent One', 'agent'),
      ('cname', '', 'Agent One', 'agent'),
      ('c2', 'a2', 'Agent Two', 'agent'),
      ('ce', 'a2', 'Agent Two', 'elementary');
    insert into storage.objects(id, bucket_id, name) values
      ('mine', 'gi-customer-files', 'c1/doc/mine.pdf'),
      ('byname', 'gi-customer-files', 'cname/doc/byname.pdf'),
      ('other', 'gi-customer-files', 'c2/doc/other.pdf'),
      ('elem', 'gi-customer-files', 'ce/doc/elem.pdf'),
      ('orphan', 'gi-customer-files', 'missing/doc/orphan.pdf');
    alter table storage.objects enable row level security;
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
    create function public.gi_storage_customer_allowed(p_customer_id text)
    returns boolean language sql stable security definer set search_path = public as $$
      select exists (
        select 1 from public.customers c
        where c.id = p_customer_id
          and public.gi_jwt_role() = 'teamManager'
      )
    $$;
    create policy notes_select_own on public.notes for select to authenticated using (true);
    create policy gi_customer_files_all_authenticated on storage.objects
      for all to authenticated
      using (bucket_id = 'gi-customer-files')
      with check (bucket_id = 'gi-customer-files');
    create policy gi_customer_files_select_authenticated on storage.objects
      for select to authenticated
      using (
        bucket_id = 'gi-customer-files'
        and public.gi_storage_customer_allowed((storage.foldername(name))[1])
      );
    create policy gi_customer_files_insert_authenticated on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'gi-customer-files'
        and public.gi_storage_customer_allowed((storage.foldername(name))[1])
      );
    create policy gi_customer_files_update_authenticated on storage.objects
      for update to authenticated
      using (bucket_id = 'gi-customer-files' and public.gi_jwt_is_manager())
      with check (bucket_id = 'gi-customer-files' and public.gi_jwt_is_manager());
    create policy gi_customer_files_delete_authenticated on storage.objects
      for delete to authenticated
      using (bucket_id = 'gi-customer-files' and public.gi_jwt_is_manager());
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
    assert(details.includes("policies_removed=gi_customer_files_all_authenticated"), "the open path is removed");
    assert(details.includes("helper=installed") && details.includes("write_by_role=installed"), "the helper and write policies are installed");
    assert(details.includes("select_by_role=kept") && details.includes("open_path=closed"), "select stays and the open path is closed");
    assert(details.includes("other_tables=unchanged") && details.includes("changed=yes"), "other tables stay and the cut is reported");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.includes("changed=no"), "a second run removes nothing");

    await db.exec("set role anon");
    const anonRead = await db.query("select count(*)::int as n from storage.objects");
    await db.exec("reset role");
    assert(anonRead.rows[0].n === 0, "anon still cannot read a file");

    await asUser(db, "a1", "agent", false);
    const ownIds = await db.query("select id from storage.objects order by id");
    await db.exec("update storage.objects set name = 'c2/doc/stolen.pdf' where id = 'other'");
    let foreignInsert = "";
    try {
      await db.exec("insert into storage.objects(id, bucket_id, name) values ('nope', 'gi-customer-files', 'c2/doc/nope.pdf')");
      foreignInsert = "wrote";
    } catch(err) {
      foreignInsert = String(err && err.message || err);
    }
    await db.exec("update storage.objects set name = 'c1/doc/renamed.pdf' where id = 'mine'");
    await db.exec("delete from storage.objects where id = 'byname'");
    await db.exec("reset role");
    const seen = ownIds.rows.map((row) => row.id);
    const otherName = await db.query("select name from storage.objects where id = 'other'");
    const mineName = await db.query("select name from storage.objects where id = 'mine'");
    const bynameLeft = await db.query("select count(*)::int as n from storage.objects where id = 'byname'");
    assert(seen.join(",") === "byname,mine", "an agent sees only files of their own customers");
    assert(otherName.rows[0].name === "c2/doc/other.pdf", "an agent cannot move another customer's file");
    assert(/row-level security/i.test(foreignInsert), "an agent cannot add a file to another customer");
    assert(mineName.rows[0].name === "c1/doc/renamed.pdf", "an agent can overwrite their own file");
    assert(bynameLeft.rows[0].n === 0, "an agent can delete a file of their own customer");

    await asUser(db, "tm", "teammanager", false);
    const teamIds = await db.query("select id from storage.objects order by id");
    await db.exec("reset role");
    assert(teamIds.rows.map((row) => row.id).join(",") === "mine", "a team manager sees their team's file and not every file");

    await asUser(db, "ops", "opsagent", false);
    const opsCount = await db.query("select count(*)::int as n from storage.objects");
    await db.exec("reset role");
    assert(opsCount.rows[0].n === 4, "an operations user sees every remaining file");

    await asUser(db, "el", "elementary", false);
    const elemIds = await db.query("select id from storage.objects order by id");
    await db.exec("reset role");
    assert(elemIds.rows.map((row) => row.id).join(",") === "elem", "an elementary user sees the elementary customer's file");

    const open = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_customer_files_all_authenticated'");
    const notes = await db.query("select policyname from pg_policies where tablename = 'notes'");
    const helper = await db.query("select pg_get_functiondef('public.gi_storage_customer_allowed(text)'::regprocedure) as src");
    assert(open.rows[0].n === 0, "the open path stays removed");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
    assert(String(helper.rows[0].src).toLowerCase().includes("security definer"), "the helper stays security definer");
    assert(!String(helper.rows[0].src).includes("teamManager"), "the helper no longer uses a capital-letter role");
  }

  {
    const db = new PGlite();
    const missing = base
      .replace("agent_id text,\n      agent_name text,", "agent_name text,")
      .replace(
        "insert into public.customers(id, agent_id, agent_name, agent_role) values\n      ('c1', 'a1', 'Agent One', 'agent'),\n      ('cname', '', 'Agent One', 'agent'),\n      ('c2', 'a2', 'Agent Two', 'agent'),\n      ('ce', 'a2', 'Agent Two', 'elementary');",
        "insert into public.customers(id, agent_name, agent_role) values ('c1', 'Agent One', 'agent');"
      );
    await db.exec(missing);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/customer link column is missing; nothing saved/i.test(blocked), "a missing agent_id column saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_customer_files_all_authenticated'");
    assert(stillOpen.rows[0].n === 1, "the open path stays when the column is missing");
  }

  {
    const db = new PGlite();
    await db.exec(base + `
      create policy storage_extra on storage.objects for select to authenticated using (false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/not the expected open set; nothing saved/i.test(blocked), "an unexpected policy saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_customer_files_all_authenticated'");
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
