/**
 * Signed-in update paths are added beside the open history doors.
 * Read and insert stay as they are.
 * Run: node _test-history-signed-in.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-history-signed-in.sql"), "utf8");
const code = executable(sql);
const readable = code.replace(/\$body\$/g, "");

console.log("1) the file adds three inert update paths");
assert(code.includes("create policy agents_history_update_open"), "it adds the agent history update");
assert(code.includes("create policy customers_history_update_open"), "it adds the customer history update");
assert(code.includes("create policy proposals_history_update_open"), "it adds the proposal history update");
assert((code.match(/create policy/gi) || []).length === 3, "it creates three policies");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/for delete/i.test(code), "it does not add a delete path");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security/i.test(code), "it does not turn row security on");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a stored row");
assert(!/\b(payload|phone|email|pin|agent_name|body)\b/i.test(readable), "stored fields are not selected");
assert(!/public\.app_meta|public\.reminders|gi_elementary_referrals/i.test(code), "other business tables are not named");
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
    create table public.agents_history (id text primary key);
    create table public.customers_history (id text primary key);
    create table public.proposals_history (id text primary key);
    create table public.notes (id text primary key);
    grant select, insert, update, delete on public.agents_history to anon, authenticated;
    grant select, insert, update, delete on public.customers_history to anon, authenticated;
    grant select, insert, update, delete on public.proposals_history to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.agents_history(id) values ('active');
    insert into public.customers_history(id) values ('active');
    insert into public.proposals_history(id) values ('active');
    alter table public.agents_history enable row level security;
    alter table public.customers_history enable row level security;
    alter table public.proposals_history enable row level security;
    alter table public.notes enable row level security;
    create policy notes_select_own on public.notes for select to authenticated using (true);
  `;

  const current = `
    create policy agents_history_select_authenticated on public.agents_history
      for select to authenticated using (true);
    create policy agents_history_insert_authenticated on public.agents_history
      for insert to authenticated with check (true);
    create policy agents_history_update on public.agents_history
      for update to public using (true) with check (true);
    create policy gi_agents_history_select_app on public.agents_history
      for select to anon, authenticated using (true);
    create policy gi_agents_history_insert_app on public.agents_history
      for insert to anon, authenticated with check (true);
    create policy customers_history_select on public.customers_history
      for select to public using (true);
    create policy customers_history_insert on public.customers_history
      for insert to public with check (true);
    create policy customers_history_update on public.customers_history
      for update to public using (true) with check (true);
    create policy customers_history_select_authenticated on public.customers_history
      for select to authenticated using (true);
    create policy customers_history_insert_authenticated on public.customers_history
      for insert to authenticated with check (true);
    create policy gi_customers_history_select_auth on public.customers_history
      for select to authenticated using (true);
    create policy gi_customers_history_insert_auth on public.customers_history
      for insert to authenticated with check (true);
    create policy z_block_anon_delete on public.customers_history
      for delete to anon using (false);
    create policy z_block_anon_update on public.customers_history
      for update to anon using (false) with check (false);
    create policy proposals_history_select on public.proposals_history
      for select to public using (true);
    create policy proposals_history_insert on public.proposals_history
      for insert to public with check (true);
    create policy proposals_history_update on public.proposals_history
      for update to public using (true) with check (true);
    create policy proposals_history_select_authenticated on public.proposals_history
      for select to authenticated using (true);
    create policy proposals_history_insert_authenticated on public.proposals_history
      for insert to authenticated with check (true);
    create policy gi_proposals_history_select_auth on public.proposals_history
      for select to authenticated using (true);
    create policy gi_proposals_history_insert_auth on public.proposals_history
      for insert to authenticated with check (true);
    create policy z_block_anon_delete on public.proposals_history
      for delete to anon using (false);
    create policy z_block_anon_update on public.proposals_history
      for update to anon using (false) with check (false);
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
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.filter((row) => row.startsWith("table=")).join(",") === "table=agents_history,table=customers_history,table=proposals_history", "the three tables are named");
    assert(details.filter((row) => row === "update_policy=installed").length === 3, "the three update paths are installed");
    assert(details.filter((row) => row === "anon_rows=same").length === 3, "anon still sees the same rows");
    assert(details.filter((row) => row === "authenticated_rows=same").length === 3, "a session still sees the same rows");
    assert(details.includes("read_insert=kept") && details.includes("blocks=kept") && details.includes("other_tables=unchanged"), "reads, inserts, blocks, and other tables stay");
    assert(details.includes("open_doors=kept") && details.includes("access_changed=no") && details.includes("door_closed=no"), "the public doors stay open");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.filter((row) => row === "update_policy=already_present").length === 3, "a second run adds nothing");
    const doors = await db.query(`select policyname from pg_policies where policyname in ('agents_history_update', 'customers_history_select', 'proposals_history_update') order by policyname`);
    assert(doors.rows.map((row) => row.policyname).join(",") === "agents_history_update,customers_history_select,proposals_history_update", "the public doors stay");
    const blocks = await db.query(`select count(*)::int as n from pg_policies where policyname in ('z_block_anon_delete', 'z_block_anon_update')`);
    assert(blocks.rows[0].n === 4, "the four blocks stay");
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
    const stored = await db.query(`select count(*)::int as n from public.customers_history`);
    assert(stored.rows[0].n === 1, "the history row was not rewritten");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current.replace("create policy agents_history_update on public.agents_history\n      for update to public using (true) with check (true);\n    ", ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/open agent history update is missing; nothing saved/i.test(blocked), "a missing update door saves nothing");
    const added = await db.query(`select policyname from pg_policies where policyname = 'customers_history_update_open'`);
    assert(added.rows.length === 0, "the rejected path is not left behind");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current + `
      create policy agents_history_update_open on public.agents_history
        as restrictive
        for update
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
