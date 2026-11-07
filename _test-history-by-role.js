/**
 * A manager can read and rewrite history. A signed-in person with an agent
 * id can still append a row. The duplicate open reads are removed.
 * Run: node _test-history-by-role.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-history-by-role.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes the open read and keeps an append path");
assert(code.includes("drop policy gi_customers_history_select_auth"), "it removes the duplicate customer read");
assert(code.includes("drop policy gi_proposals_history_select_auth"), "it removes the duplicate proposal read");
assert(!code.includes("drop policy z_block_anon_delete"), "it leaves the public delete block");
assert(!code.includes("drop policy z_block_anon_update"), "it leaves the public update block");
assert(code.includes("gi_jwt_is_manager()") && code.includes("gi_jwt_agent_id() <> ''"), "a manager reads and an identified person can append");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/from\s+public\.(agents_history|customers_history|proposals_history)/i.test(code), "it does not read a history row");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");

  const helpers = `
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public to anon, authenticated;
    create function public.gi_jwt_is_manager() returns boolean language sql stable as $$
      select coalesce(current_setting('gi.test_manager', true), '') = 'yes'
    $$;
    create function public.gi_jwt_agent_id() returns text language sql stable as $$
      select coalesce(current_setting('gi.test_agent', true), '')
    $$;
  `;
  const shape = `
    history_id text primary key,
    action_type text,
    action_at timestamptz,
    row_id text,
    row_data text
  `;
  const base = helpers + `
    create table public.agents_history (${shape});
    create table public.customers_history (${shape});
    create table public.proposals_history (${shape});
    create table public.notes (id text primary key);
    grant select, insert, update, delete on public.agents_history to anon, authenticated;
    grant select, insert, update, delete on public.customers_history to anon, authenticated;
    grant select, insert, update, delete on public.proposals_history to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.customers_history(history_id, action_type, action_at, row_id, row_data)
      values ('h1', 'update', now(), 'c1', '{}');
    insert into public.proposals_history(history_id, action_type, action_at, row_id, row_data)
      values ('p1', 'update', now(), 'p1', '{}');
    alter table public.agents_history enable row level security;
    alter table public.customers_history enable row level security;
    alter table public.proposals_history enable row level security;
    alter table public.notes enable row level security;
    create policy notes_select_own on public.notes for select to authenticated using (true);
    create policy agents_history_select_authenticated on public.agents_history for select to authenticated using (true);
    create policy agents_history_insert_authenticated on public.agents_history for insert to authenticated with check (true);
    create policy agents_history_update_open on public.agents_history for update to authenticated using (true) with check (true);
    create policy customers_history_select_authenticated on public.customers_history for select to authenticated using (true);
    create policy gi_customers_history_select_auth on public.customers_history for select to authenticated using (true);
    create policy customers_history_insert_authenticated on public.customers_history for insert to authenticated with check (true);
    create policy gi_customers_history_insert_auth on public.customers_history for insert to authenticated with check (true);
    create policy customers_history_update_open on public.customers_history for update to authenticated using (true) with check (true);
    create policy z_block_anon_delete on public.customers_history for delete to public using (false);
    create policy z_block_anon_update on public.customers_history for update to public using (false);
    create policy proposals_history_select_authenticated on public.proposals_history for select to authenticated using (true);
    create policy gi_proposals_history_select_auth on public.proposals_history for select to authenticated using (true);
    create policy proposals_history_insert_authenticated on public.proposals_history for insert to authenticated with check (true);
    create policy gi_proposals_history_insert_auth on public.proposals_history for insert to authenticated with check (true);
    create policy proposals_history_update_open on public.proposals_history for update to authenticated using (true) with check (true);
    create policy z_block_anon_delete on public.proposals_history for delete to public using (false);
    create policy z_block_anon_update on public.proposals_history for update to public using (false);
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  async function asUser(db, agentId, manager){
    await db.exec("set role authenticated");
    await db.exec("select set_config('gi.test_agent', '" + agentId + "', false)");
    await db.exec("select set_config('gi.test_manager', '" + (manager ? "yes" : "") + "', false)");
  }

  {
    const db = new PGlite();
    await db.exec(base);
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("policies_removed=gi_customers_history_insert_auth|gi_customers_history_select_auth"), "the duplicate customer paths are removed");
    assert(details.includes("policies_removed=gi_proposals_history_insert_auth|gi_proposals_history_select_auth"), "the duplicate proposal paths are removed");
    assert(details.filter((row) => row === "select_by_role=installed").length === 3, "reading is installed on each table");
    assert(details.filter((row) => row === "insert_by_role=installed").length === 3, "appending is installed on each table");
    assert(details.includes("anon_blocks=kept") && details.includes("other_tables=unchanged") && details.includes("changed=yes"), "the cut is reported");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.includes("select_by_role=kept") && again.includes("changed=no"), "a second run removes nothing");

    await db.exec("set role anon");
    const anonRead = await db.query("select count(*)::int as n from public.customers_history");
    await db.exec("reset role");
    assert(anonRead.rows[0].n === 0, "anon still cannot read");

    await asUser(db, "a1", false);
    const seen = await db.query("select count(*)::int as n from public.customers_history");
    await db.exec("insert into public.customers_history(history_id, action_type, action_at, row_id, row_data) values ('h2', 'insert', now(), 'c2', '{}')");
    await db.exec("update public.customers_history set action_type = 'rewritten' where history_id = 'h1'");
    let blank = "";
    await db.exec("select set_config('gi.test_agent', '', false)");
    try {
      await db.exec("insert into public.proposals_history(history_id, action_type, action_at, row_id, row_data) values ('p2', 'insert', now(), 'p2', '{}')");
      blank = "wrote";
    } catch(err) {
      blank = String(err && err.message || err);
    }
    await db.exec("reset role");
    const kept = await db.query("select action_type from public.customers_history where history_id = 'h1'");
    const added = await db.query("select count(*)::int as n from public.customers_history where history_id = 'h2'");
    const forged = await db.query("select count(*)::int as n from public.proposals_history where history_id = 'p2'");
    assert(seen.rows[0].n === 0, "a person cannot read a history snapshot");
    assert(added.rows[0].n === 1, "a person with an agent id can append a history row");
    assert(kept.rows[0].action_type === "update", "a person cannot rewrite a history row");
    assert(/row-level security/i.test(blank) && forged.rows[0].n === 0, "a blank agent id cannot append");

    await asUser(db, "", true);
    const managed = await db.query("select count(*)::int as n from public.customers_history");
    await db.exec("update public.proposals_history set action_type = 'kept' where history_id = 'p1'");
    await db.exec("reset role");
    const rewritten = await db.query("select action_type from public.proposals_history where history_id = 'p1'");
    assert(managed.rows[0].n === 2, "a manager can read history");
    assert(rewritten.rows[0].action_type === "kept", "a manager can rewrite a history row");

    const dupes = await db.query("select count(*)::int as n from pg_policies where policyname like 'gi\\_%history%'");
    const blocks = await db.query("select count(*)::int as n from pg_policies where policyname in ('z_block_anon_delete', 'z_block_anon_update')");
    const notes = await db.query("select policyname from pg_policies where tablename = 'notes'");
    assert(dupes.rows[0].n === 0 && blocks.rows[0].n === 4, "the duplicate paths stay removed and the public blocks stay");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    await db.exec(helpers + `
      create table public.agents_history (history_id text primary key);
      create table public.customers_history (${shape});
      create table public.proposals_history (${shape});
      alter table public.agents_history enable row level security;
      alter table public.customers_history enable row level security;
      alter table public.proposals_history enable row level security;
      create policy agents_history_select_authenticated on public.agents_history for select to authenticated using (true);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/history columns are missing; nothing saved/i.test(blocked), "missing history columns save nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'agents_history_select_authenticated'");
    assert(stillOpen.rows[0].n === 1, "the open read stays when a column is missing");
  }

  {
    const db = new PGlite();
    await db.exec(base + `
      create policy agents_history_extra on public.agents_history for select to authenticated using (false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/not the expected open set; nothing saved/i.test(blocked), "an unexpected policy saves nothing");
    const dupes = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_customers_history_select_auth'");
    assert(dupes.rows[0].n === 1, "the duplicate read stays when the set is unexpected");
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
