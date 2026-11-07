/**
 * The agents signed-in path is added beside the open door.
 * The existing signed-in policies and the public delete block stay.
 * Run: node _test-agents-signed-in.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-agents-signed-in.sql"), "utf8");
const code = executable(sql);

console.log("1) the file adds one inert signed-in path");
assert(code.includes("create policy gi_agents_all_authenticated"), "it adds the signed-in path");
assert(code.includes("on public.agents"), "the path is on the agents table");
assert(code.includes("for all") && code.includes("to authenticated") && code.includes("using (true)") && code.includes("with check (true)"), "a signed-in session can read and save");
assert((code.match(/create policy/gi) || []).length === 1, "it creates one policy");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security/i.test(code), "it does not turn row security on");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.agents|update public\.agents|delete from public\.agents/i.test(code), "it does not write an agent row");
assert(!/\b(name|username|email|pin|payload|secret)\b/i.test(code), "agent fields are not selected");
assert(!/public\.app_meta|public\.customers|public\.proposals|campaign_leads/i.test(code), "other tables are not named");
assert(code.includes("open door is missing; nothing saved"), "a missing open door saves nothing");
assert(code.includes("agent policies are missing; nothing saved"), "a missing agent policy saves nothing");
assert(code.includes("row visibility changed; nothing saved"), "a visibility change saves nothing");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");

  const fixture = `
    create role anon nologin;
    create role authenticated nologin;
    create table public.agents (id text primary key);
    create table public.notes (id text primary key);
    grant select, insert, update, delete on public.agents to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.agents(id) values ('active');
    insert into public.notes(id) values ('active');
    alter table public.notes enable row level security;
    create policy notes_select_own on public.notes
      for select to authenticated using (true);
  `;

  const current = `
    alter table public.agents enable row level security;
    create policy agents_anon_all on public.agents
      for all to anon, authenticated using (true) with check (true);
    create policy agents_select_authenticated on public.agents
      for select to authenticated using (true);
    create policy agents_insert_authenticated on public.agents
      for insert to authenticated with check (false);
    create policy agents_update_authenticated on public.agents
      for update to authenticated using (false) with check (false);
    create policy agents_delete_authenticated on public.agents
      for delete to authenticated using (false);
    create policy z_block_anon_delete on public.agents
      for delete to anon using (false);
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current);
    const first = await rowsOf(db);
    const bySection = Object.fromEntries(first.map((row) => [row.section, row.detail]));
    assert(bySection.table === "agents", "the result names the agents table");
    assert(bySection.rls_enabled === "yes", "row security stays on");
    assert(bySection.open_door === "yes", "the open door is still reported");
    assert(bySection.signed_in_all === "installed", "the signed-in path is installed");
    assert(bySection.anon_rows === "same", "anon still sees the same rows");
    assert(bySection.authenticated_rows === "same", "a session still sees the same rows");
    assert(bySection.agent_rows === "unchanged", "the stored agent rows are unchanged");
    assert(bySection.other_tables === "unchanged", "the other table is unchanged");
    assert(bySection.signed_in_policies === "kept" && bySection.anon_delete_block === "kept", "the signed-in policies and the delete block stay");
    assert(bySection.access_changed === "no" && bySection.door_closed === "no", "access is unchanged and the door stays open");
    assert(bySection.open_policy === "agents_anon_all", "the live open policy name is returned");
    const second = await rowsOf(db);
    const again = Object.fromEntries(second.map((row) => [row.section, row.detail]));
    assert(again.signed_in_all === "already_present", "a second run adds nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'agents'
      order by policyname
    `);
    assert(policies.rows.map((row) => row.policyname).join(",") === [
      "agents_anon_all",
      "agents_delete_authenticated",
      "agents_insert_authenticated",
      "agents_select_authenticated",
      "agents_update_authenticated",
      "gi_agents_all_authenticated",
      "z_block_anon_delete"
    ].join(","), "the open door and the signed-in policies stay beside the new path");
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
    const stored = await db.query(`select count(*)::int as n from public.agents`);
    assert(stored.rows[0].n === 1, "the agent row was not rewritten");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current.replace(`create policy agents_anon_all on public.agents\n      for all to anon, authenticated using (true) with check (true);\n    `, ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/open door is missing; nothing saved/i.test(blocked), "a path without the open door saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'agents' and policyname = 'gi_agents_all_authenticated'
    `);
    assert(policies.rows.length === 0, "the rejected path is not left behind");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current.replace("create policy agents_update_authenticated on public.agents\n      for update to authenticated using (false) with check (false);\n    ", ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/agent policies are missing; nothing saved/i.test(blocked), "a missing signed-in policy saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'agents' and policyname = 'gi_agents_all_authenticated'
    `);
    const door = await db.query(`
      select policyname from pg_policies
      where tablename = 'agents' and policyname = 'agents_anon_all'
    `);
    assert(policies.rows.length === 0 && door.rows.length === 1, "the open door stays when a signed-in policy is missing");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current + `
      create policy gi_agents_all_authenticated on public.agents
        as restrictive
        for all
        to authenticated
        using (false)
        with check (false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/signed-in policy is not a plain authenticated path; nothing saved/i.test(blocked), "a different policy under the same name is left alone");
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
