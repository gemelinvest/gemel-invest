/**
 * Leads follow the signed-in role. A manager, referent, operations user,
 * and team manager can read every lead. Anyone else reads a lead assigned
 * to them. The open signed-in path is removed. The anon delete block stays.
 * Run: node _test-leads-by-role.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-leads-by-role.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes the open path and rewrites the role policies");
assert(code.includes("drop policy campaign_leads_all_authenticated"), "it removes the open path");
assert(code.includes("'referent'"), "a referent can read");
assert(code.includes("'teammanager'"), "a team manager can read");
assert(code.includes("coalesce(assigned_agent_id, '') = public.gi_jwt_agent_id()"), "anyone else is limited to an assigned lead");
assert(!code.includes("= 'teamManager'"), "it does not compare a capital-letter team manager");
assert(!code.includes("= 'opsAgent'"), "it does not compare a capital-letter operations agent");
assert(!code.includes("drop policy z_block_anon_delete"), "it keeps the anon delete block");
assert(!/from public\.campaign_leads/i.test(code), "it does not read lead rows");
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
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public to anon, authenticated;
    create table public.agents (
      id text primary key,
      name text
    );
    create table public.campaign_leads (
      id text primary key,
      assigned_agent_id text,
      updated_by_name text,
      phone text
    );
    create table public.notes (id text primary key);
    grant select on public.agents to authenticated;
    grant select, insert, update, delete on public.campaign_leads to anon, authenticated;
    insert into public.agents(id, name) values ('a1', 'Agent One');
    grant select on public.notes to authenticated;
    insert into public.campaign_leads(id, assigned_agent_id, phone) values
      ('mine', 'a1', '1'),
      ('other', 'a2', '2'),
      ('free', null, '3');
    alter table public.campaign_leads enable row level security;
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
    create policy campaign_leads_all_authenticated on public.campaign_leads
      for all to authenticated using (true) with check (true);
    create policy campaign_leads_select_authenticated on public.campaign_leads
      for select to authenticated using (public.gi_jwt_role() = 'teamManager');
    create policy campaign_leads_insert_authenticated on public.campaign_leads
      for insert to authenticated with check (public.gi_jwt_role() = 'opsAgent');
    create policy campaign_leads_update_authenticated on public.campaign_leads
      for update to authenticated using (public.gi_jwt_role() = 'teamManager') with check (public.gi_jwt_role() = 'opsAgent');
    create policy campaign_leads_delete_authenticated on public.campaign_leads
      for delete to authenticated using (public.gi_jwt_role() = 'opsAgent');
    create policy z_block_anon_delete on public.campaign_leads
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
    assert(details.includes("policies_removed=campaign_leads_all_authenticated"), "the open path is removed");
    assert(details.includes("select_by_role=installed") && details.includes("write_by_role=installed"), "the role policies are installed");
    assert(details.includes("anon_delete_block=kept") && details.includes("other_tables=unchanged"), "the anon block and other tables stay");
    assert(details.includes("changed=yes"), "the cut is reported");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.includes("changed=no"), "a second run removes nothing");

    await db.exec("set role anon");
    const anonRead = await db.query("select count(*)::int as n from public.campaign_leads");
    await db.exec("reset role");
    assert(anonRead.rows[0].n === 0, "anon still cannot read");

    await asUser(db, "a1", "agent", false);
    const own = await db.query("select count(*)::int as n from public.campaign_leads");
    await db.exec("update public.campaign_leads set phone = 'x' where id = 'other'");
    let foreignInsert = "";
    try {
      await db.exec("insert into public.campaign_leads(id, assigned_agent_id, phone) values ('nope', 'a2', '9')");
      foreignInsert = "wrote";
    } catch(err) {
      foreignInsert = String(err && err.message || err);
    }
    await db.exec("update public.campaign_leads set assigned_agent_id = 'a2', updated_by_name = 'Agent One' where id = 'mine'");
    await db.exec("reset role");
    const otherPhone = await db.query("select phone from public.campaign_leads where id = 'other'");
    const moved = await db.query("select assigned_agent_id from public.campaign_leads where id = 'mine'");
    assert(own.rows[0].n === 1, "an agent sees only an assigned lead");
    assert(otherPhone.rows[0].phone === "2", "an agent cannot change another lead");
    assert(/row-level security/i.test(foreignInsert), "an agent cannot insert another agent's lead");
    assert(moved.rows[0].assigned_agent_id === "a2", "an agent can pass their own lead to another agent");

    await asUser(db, "ref", "referent", false);
    const asRef = await db.query("select count(*)::int as n from public.campaign_leads");
    await db.exec("insert into public.campaign_leads(id, assigned_agent_id, phone) values ('new', null, '4')");
    await db.exec("reset role");
    assert(asRef.rows[0].n === 3, "a referent sees every lead");
    const created = await db.query("select count(*)::int as n from public.campaign_leads where id = 'new'");
    assert(created.rows[0].n === 1, "a referent can insert a lead");

    await asUser(db, "tm", "teammanager", false);
    const asTeam = await db.query("select count(*)::int as n from public.campaign_leads");
    await db.exec("reset role");
    assert(asTeam.rows[0].n === 4, "a team manager sees every lead");
    const block = await db.query("select count(*)::int as n from pg_policies where policyname = 'z_block_anon_delete'");
    const notes = await db.query("select policyname from pg_policies where tablename = 'notes'");
    assert(block.rows[0].n === 1, "the anon delete block stays");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    await db.exec(base
      .replace("assigned_agent_id text,", "note text,")
      .replace("insert into public.campaign_leads(id, assigned_agent_id, phone) values\n      ('mine', 'a1', '1'),\n      ('other', 'a2', '2'),\n      ('free', null, '3');", "insert into public.campaign_leads(id, phone) values ('mine', '1');"));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/assigned_agent_id column is missing; nothing saved/i.test(blocked), "a missing assigned column saves nothing");
    const open = await db.query("select count(*)::int as n from pg_policies where policyname = 'campaign_leads_all_authenticated'");
    assert(open.rows[0].n === 1, "the open path stays when the column is missing");
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
