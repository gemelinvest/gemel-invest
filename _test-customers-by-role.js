/**
 * Customers follow the signed-in role. A manager and an operations user
 * can read every customer. A team manager reads their own team. An
 * elementary user reads the elementary pool. Anyone else reads a customer
 * with their agent_id, or a blank agent_id whose name matches them.
 * The open signed-in path is removed. The anon delete block and the
 * archived delete stay.
 * Run: node _test-customers-by-role.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-customers-by-role.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes the open path and rewrites the shadow policies");
assert(code.includes("drop policy gi_customers_all_authenticated"), "it removes the open path");
assert(!code.includes("drop policy z_block_anon_delete"), "it keeps the anon delete block");
assert(!code.includes("drop policy gi_customers_delete_archived"), "it keeps the archived delete");
assert(code.includes("'teammanager'"), "a team manager can read");
assert(code.includes("'opsagent'"), "an operations user can read");
assert(code.includes("'elementary'"), "an elementary user can read the pool");
assert(code.includes("coalesce(agent_id, '') = public.gi_jwt_agent_id()"), "anyone else is limited to their own customer");
assert(code.includes("length(coalesce(agent_id, '')) = 0"), "a blank agent_id still matches by name");
assert(!code.includes("= 'teamManager'"), "it does not compare a capital-letter team manager");
assert(!code.includes("= 'opsAgent'"), "it does not compare a capital-letter operations agent");
assert(!code.includes("coalesce(agent_id, '') = ''"), "it does not leave a blank agent_id open");
assert(!/from\s+public\.customers/i.test(code), "it does not read customer rows");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/campaign_leads|gi_agent_activity_log|gi_cancellations_report|gi_daily_report|public\.proposals|public\.app_meta/i.test(code), "other tables are not named");

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
      username text,
      team_manager_id text
    );
    create table public.customers (
      id text primary key,
      agent_id text,
      agent_name text,
      agent_role text,
      phone text
    );
    create table public.notes (id text primary key);
    grant select on public.agents to authenticated;
    grant select, insert, update, delete on public.customers to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.agents(id, name, username, team_manager_id) values
      ('a1', 'Agent One', 'agent1', 'tm'),
      ('a2', 'Agent Two', 'agent2', null),
      ('tm', 'Team Lead', 'team', null),
      ('el', 'Elem User', 'elem', null);
    insert into public.customers(id, agent_id, agent_name, agent_role, phone) values
      ('mine', 'a1', 'Agent One', 'agent', '1'),
      ('byname', '', 'Agent One', 'agent', '2'),
      ('other', 'a2', 'Agent Two', 'agent', '3'),
      ('blank', '', '', 'agent', '4'),
      ('elem', 'a2', 'Agent Two', 'elementary', '5'),
      ('arch', 'a2', 'Agent Two', 'archived', '6');
    alter table public.customers enable row level security;
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
    create policy gi_customers_all_authenticated on public.customers
      for all to authenticated using (true) with check (true);
    create policy customers_select_own_shadow on public.customers
      for select to authenticated
      using (public.gi_jwt_role() = 'teamManager' or coalesce(agent_id, '') = '');
    create policy customers_insert_own_shadow on public.customers
      for insert to authenticated
      with check (public.gi_jwt_role() = 'opsAgent' or coalesce(agent_id, '') = '');
    create policy customers_update_own_shadow on public.customers
      for update to authenticated
      using (public.gi_jwt_role() = 'teamManager' or agent_id is null)
      with check (coalesce(agent_id, '') = '');
    create policy customers_delete_own_shadow on public.customers
      for delete to authenticated
      using (public.gi_jwt_role() = 'opsAgent');
    create policy gi_customers_delete_archived on public.customers
      for delete to authenticated
      using (agent_role = 'archived');
    create policy z_block_anon_delete on public.customers
      as restrictive for delete to anon using (false);
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
    assert(details.includes("policies_removed=gi_customers_all_authenticated"), "the open path is removed");
    assert(details.includes("select_by_role=installed") && details.includes("write_by_role=installed"), "the role policies are installed");
    assert(details.includes("blank_agent=closed") && details.includes("other_tables=unchanged"), "the blank path is closed and other tables stay");
    assert(details.includes("anon_delete_block=kept") && details.includes("archived_delete=kept"), "the kept policies stay");
    assert(details.includes("changed=yes"), "the cut is reported");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.includes("changed=no"), "a second run removes nothing");

    await db.exec("set role anon");
    const anonRead = await db.query("select count(*)::int as n from public.customers");
    await db.exec("delete from public.customers");
    await db.exec("reset role");
    const afterAnon = await db.query("select count(*)::int as n from public.customers");
    assert(anonRead.rows[0].n === 0, "anon still cannot read");
    assert(afterAnon.rows[0].n === 6, "anon still cannot delete");

    await asUser(db, "a1", "agent", false);
    const ownIds = await db.query("select id from public.customers order by id");
    await db.exec("update public.customers set phone = 'x' where id = 'other'");
    let foreignInsert = "";
    try {
      await db.exec("insert into public.customers(id, agent_id, agent_name, agent_role, phone) values ('nope', 'a2', 'Agent Two', 'agent', '9')");
      foreignInsert = "wrote";
    } catch(err) {
      foreignInsert = String(err && err.message || err);
    }
    await db.exec("update public.customers set phone = 'kept' where id = 'mine'");
    await db.exec("reset role");
    const seen = ownIds.rows.map((row) => row.id);
    const otherPhone = await db.query("select phone from public.customers where id = 'other'");
    const minePhone = await db.query("select phone from public.customers where id = 'mine'");
    assert(seen.join(",") === "byname,mine", "an agent sees their own customer and a blank one with their name");
    assert(otherPhone.rows[0].phone === "3", "an agent cannot change another customer");
    assert(/row-level security/i.test(foreignInsert), "an agent cannot insert another agent's customer");
    assert(minePhone.rows[0].phone === "kept", "an agent can update their own customer");

    await asUser(db, "tm", "teammanager", false);
    const teamIds = await db.query("select id from public.customers order by id");
    await db.exec("reset role");
    assert(teamIds.rows.map((row) => row.id).join(",") === "byname,mine", "a team manager sees their team and not every customer");

    await asUser(db, "ops", "opsagent", false);
    const opsCount = await db.query("select count(*)::int as n from public.customers");
    await db.exec("reset role");
    assert(opsCount.rows[0].n === 6, "an operations user sees every customer");

    await asUser(db, "boss", "manager", true);
    await db.exec("update public.customers set agent_id = 'a1' where id = 'blank'");
    await db.exec("reset role");
    const assigned = await db.query("select agent_id from public.customers where id = 'blank'");
    assert(assigned.rows[0].agent_id === "a1", "a manager can assign a blank customer");

    await asUser(db, "el", "elementary", false);
    const elemIds = await db.query("select id from public.customers order by id");
    await db.exec("reset role");
    assert(elemIds.rows.map((row) => row.id).join(",") === "elem", "an elementary user sees the elementary pool only");

    const open = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_customers_all_authenticated'");
    const block = await db.query("select count(*)::int as n from pg_policies where policyname = 'z_block_anon_delete'");
    const archived = await db.query("select qual from pg_policies where policyname = 'gi_customers_delete_archived'");
    const notes = await db.query("select policyname from pg_policies where tablename = 'notes'");
    assert(open.rows[0].n === 0, "the open path stays removed");
    assert(block.rows[0].n === 1, "the anon delete block stays");
    assert(archived.rows.length === 1 && String(archived.rows[0].qual).includes("archived"), "the archived delete expression stays");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    const missingColumn = base
      .replace("agent_id text,\n      agent_name text,", "agent_name text,")
      .replace(
        "insert into public.customers(id, agent_id, agent_name, agent_role, phone) values\n      ('mine', 'a1', 'Agent One', 'agent', '1'),\n      ('byname', '', 'Agent One', 'agent', '2'),\n      ('other', 'a2', 'Agent Two', 'agent', '3'),\n      ('blank', '', '', 'agent', '4'),\n      ('elem', 'a2', 'Agent Two', 'elementary', '5'),\n      ('arch', 'a2', 'Agent Two', 'archived', '6');",
        "insert into public.customers(id, agent_name, agent_role, phone) values ('mine', 'Agent One', 'agent', '1');"
      )
      .replaceAll("coalesce(agent_id, '') = ''", "true")
      .replaceAll("agent_id is null", "true");
    await db.exec(missingColumn);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/agent_id column is missing; nothing saved/i.test(blocked), "a missing agent_id column saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_customers_all_authenticated'");
    assert(stillOpen.rows[0].n === 1, "the open path stays when the column is missing");
  }

  {
    const db = new PGlite();
    await db.exec(base + `
      create policy customers_extra on public.customers for select to authenticated using (false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/not the expected open set; nothing saved/i.test(blocked), "an unexpected policy saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_customers_all_authenticated'");
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
