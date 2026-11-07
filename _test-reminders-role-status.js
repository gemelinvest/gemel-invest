/**
 * The reminder role status only reads policies and column names.
 * Run: node _test-reminders-role-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-reminders-role-status.sql"), "utf8");
const code = executable(sql);

console.log("1) the file only reads");
assert(code.includes("public.reminders"), "it looks at the reminders table");
assert(code.includes("column_name = 'agent_id'") && code.includes("column_name = 'customer_id'"), "it checks the owner columns");
assert(code.includes("column_name"), "it reports the column names");
assert(code.includes("teamManager|opsAgent"), "it flags a capital-letter role comparison");
assert(code.includes("blank_agent"), "it flags a blank agent comparison");
assert(code.includes("pg_policies"), "it reads policies");
assert(code.includes("'changed', 'no'"), "it reports that nothing changed");
assert(!/create\s+policy/i.test(code), "it does not create a policy");
assert(!/drop\s+policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/from\s+public\.reminders/i.test(code), "it does not read a reminder");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a reminder");
assert(!/public\.customers|public\.proposals|public\.agents|gi_agent_live|owner_devices/i.test(code), "other tables are not named");

function bySection(rows){
  return Object.fromEntries(rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
}

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  {
    const db = new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create function public.gi_jwt_is_manager() returns boolean language sql stable as $$ select false $$;
      create function public.gi_jwt_agent_id() returns text language sql stable as $$ select 'a1' $$;
      create table public.reminders (
        id text primary key,
        agent_id text,
        customer_id text,
        details text
      );
      create table public.notes (id text primary key);
      insert into public.reminders(id, agent_id, customer_id, details) values ('r1', 'Ada', 'c1', 'call');
      alter table public.reminders enable row level security;
      alter table public.notes enable row level security;
      create policy notes_select_own on public.notes for select to authenticated using (true);
      create policy reminders_all_authenticated on public.reminders
        for all to authenticated using (true) with check (true);
      create policy reminders_select_authenticated on public.reminders
        for select to authenticated
        using (public.gi_jwt_is_manager() or (public.gi_jwt_agent_id() <> '' and coalesce(agent_id, '') = public.gi_jwt_agent_id()));
      create policy reminders_insert_authenticated on public.reminders
        for insert to authenticated
        with check (public.gi_jwt_is_manager());
      create policy reminders_update_authenticated on public.reminders
        for update to authenticated
        using (public.gi_jwt_is_manager()) with check (public.gi_jwt_is_manager());
      create policy reminders_delete_authenticated on public.reminders
        for delete to authenticated using (public.gi_jwt_is_manager());
      create policy z_block_anon_delete on public.reminders
        for delete to public using (false);
    `);
    const rows = await rowsOf(db);
    const got = bySection(rows);
    const policies = rows.filter((row) => row.section === "policy").map((row) => row.detail);
    assert(got.table === "reminders" && got.present === "yes" && got.rls === "yes", "the table is present with row security");
    assert(got.agent_id === "yes" && got.customer_id === "yes", "the owner columns are reported");
    assert(got.columns === "id|agent_id|customer_id|details", "the column list is reported");
    assert(got.role_literal === "lower" && got.blank_agent === "no" && got.changed === "no", "nothing is flagged and nothing changed");
    assert(policies.includes("reminders_all_authenticated|ALL|signed_in|open"), "the open signed-in path is reported");
    assert(policies.includes("reminders_select_authenticated|SELECT|signed_in|limited"), "the limited read is reported");
    assert(policies.includes("z_block_anon_delete|DELETE|public|limited"), "the public delete block is reported");
    const notes = await db.query("select count(*)::int as n from pg_policies where tablename = 'notes'");
    const still = await db.query("select count(*)::int as n from public.reminders");
    assert(notes.rows[0].n === 1 && still.rows[0].n === 1, "the other table and the stored row stay");
  }

  {
    const db = new PGlite();
    const rows = await rowsOf(db);
    const got = bySection(rows);
    assert(got.present === "no" && got.changed === "no", "a missing table is reported and nothing changes");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create role authenticated nologin;
      create table public.reminders (id text primary key, agent_id text);
      alter table public.reminders enable row level security;
      create policy reminders_blank on public.reminders
        for select to authenticated using (agent_id = '');
    `);
    const rows = await rowsOf(db);
    const got = bySection(rows);
    assert(got.blank_agent === "yes", "a blank agent comparison is flagged");
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
