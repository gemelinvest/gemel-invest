/**
 * The public door on the agents table closes only when a signed-in session
 * still sees the same rows. The signed-in policies stay.
 * Run: node _test-close-agents-door.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-close-agents-door.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes one named door");
assert(code.includes('drop policy "agents_anon_all" on public.agents'), "it removes the named public door");
assert((code.match(/drop policy/gi) || []).length === 1, "it drops one policy");
assert(!code.includes("drop policy gi_agents_all_authenticated"), "it does not drop the signed-in path");
assert(!code.includes("drop policy agents_select_authenticated"), "it does not drop a signed-in policy");
assert(!code.includes("drop policy z_block_anon_delete"), "it does not drop the public delete block");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.agents|update public\.agents|delete from public\.agents/i.test(code), "it does not write an agent row");
assert(!/create policy/i.test(code), "it does not create a policy");
assert(!/\b(name|username|email|pin|payload|secret)\b/i.test(code), "agent fields are not selected");
assert(!/public\.app_meta|public\.customers|public\.proposals|campaign_leads/i.test(code), "other tables are not named");
assert(code.includes("signed-in rows changed; nothing saved"), "a signed-in count change saves nothing");
assert(code.includes("signed-in path is missing; nothing saved"), "a missing signed-in path saves nothing");
assert(code.includes("agent policies are missing; nothing saved"), "a missing agent policy saves nothing");
assert(code.includes("anon door is still open; nothing saved"), "a remaining public door saves nothing");

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

  const kept = `
    create policy gi_agents_all_authenticated on public.agents
      for all to authenticated using (true) with check (true);
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
    await db.exec(fixture + `
      alter table public.agents enable row level security;
      create policy agents_anon_all on public.agents
        for all to anon, authenticated using (true) with check (true);
    ` + kept);
    const first = await rowsOf(db);
    const bySection = Object.fromEntries(first.map((row) => [row.section, row.detail]));
    assert(bySection.table === "agents", "the result names the agents table");
    assert(bySection.rls_enabled === "yes", "row security stays on");
    assert(bySection.authenticated_rows === "same", "a signed-in session still sees the same rows");
    assert(bySection.anon_rows === "hidden", "the public key no longer sees the rows");
    assert(bySection.agent_rows === "unchanged", "the stored agent rows are unchanged");
    assert(bySection.other_tables === "unchanged", "the other table is unchanged");
    assert(bySection.policies_removed === "agents_anon_all", "only the named door is removed");
    assert(bySection.signed_in_all === "kept" && bySection.signed_in_policies === "kept" && bySection.anon_delete_block === "kept", "the signed-in path and the delete block stay");
    assert(bySection.door_closed === "yes", "the public door is closed");
    const second = await rowsOf(db);
    const again = Object.fromEntries(second.map((row) => [row.section, row.detail]));
    assert(again.policies_removed === "none" && again.anon_rows === "already_hidden", "a second run removes nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'agents'
      order by policyname
    `);
    assert(policies.rows.map((row) => row.policyname).join(",") === [
      "agents_delete_authenticated",
      "agents_insert_authenticated",
      "agents_select_authenticated",
      "agents_update_authenticated",
      "gi_agents_all_authenticated",
      "z_block_anon_delete"
    ].join(","), "the signed-in policies remain and the public door does not");
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
    await db.exec("set role anon");
    const hidden = await db.query(`select count(*)::int as n from public.agents`);
    await db.exec("reset role");
    await db.exec("set role authenticated");
    const visible = await db.query(`select count(*)::int as n from public.agents`);
    await db.exec("reset role");
    assert(hidden.rows[0].n === 0 && visible.rows[0].n === 1, "anon sees nothing and the session still sees the row");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.agents enable row level security;
      create policy agents_anon_all on public.agents
        for all to anon, authenticated using (true) with check (true);
    ` + kept.replace("create policy gi_agents_all_authenticated on public.agents\n      for all to authenticated using (true) with check (true);\n    ", ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/signed-in path is missing; nothing saved/i.test(blocked), "a missing signed-in path saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'agents' and policyname = 'agents_anon_all'
    `);
    assert(policies.rows.length === 1, "the public door stays when the signed-in path is missing");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.agents enable row level security;
      create policy agents_anon_all on public.agents
        for all to anon, authenticated using (true) with check (true);
      create policy anon_extra on public.agents
        for select to anon using (true);
    ` + kept);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/anon door is still open; nothing saved/i.test(blocked), "a second public read saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'agents' and policyname = 'agents_anon_all'
    `);
    assert(policies.rows.length === 1, "the named door is restored when another public read remains");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + kept);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/row security is off; nothing saved/i.test(blocked), "row security is not switched on in order to close the door");
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
