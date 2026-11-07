/**
 * The owner-device role status only reads policies and column names.
 * Run: node _test-owner-devices-role-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-owner-devices-role-status.sql"), "utf8");
const code = executable(sql);

console.log("1) the file only reads");
assert(code.includes("public.owner_devices"), "it looks at the owner devices table");
assert(code.includes("agent_id") && code.includes("owner_id") && code.includes("user_id"), "it checks the likely owner columns");
assert(code.includes("column_name"), "it reports the column names");
assert(code.includes("teamManager|opsAgent"), "it flags a capital-letter role comparison");
assert(code.includes("blank_owner"), "it flags a blank owner comparison");
assert(code.includes("pg_policies"), "it reads policies");
assert(code.includes("'changed', 'no'"), "it reports that nothing changed");
assert(!/create\s+policy/i.test(code), "it does not create a policy");
assert(!/drop\s+policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/from\s+public\.owner_devices/i.test(code), "it does not read devices");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a device");
assert(!/public\.customers|public\.proposals|public\.agents|public\.app_meta|gi_perf_events|gi_chat_messages/i.test(code), "other tables are not named");

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
      create table public.owner_devices (
        id text primary key,
        owner_id text,
        label text
      );
      create table public.notes (id text primary key);
      insert into public.owner_devices(id, owner_id, label) values ('dev', '', 'secret');
      alter table public.owner_devices enable row level security;
      alter table public.notes enable row level security;
      create policy owner_devices_all_authenticated on public.owner_devices
        for all to authenticated using (true) with check (true);
      create policy owner_devices_select_authenticated on public.owner_devices
        for select to authenticated using (public.gi_jwt_is_manager());
      create policy owner_devices_insert_authenticated on public.owner_devices
        for insert to authenticated
        with check (owner_id = '' or owner_id = 'teamManager');
      create policy notes_select_own on public.notes
        for select to authenticated using (true);
    `);
    const rows = await rowsOf(db);
    const header = bySection(rows);
    assert(header.table === "owner_devices", "the result names the owner devices table");
    assert(header.present === "yes", "the table is present");
    assert(header.rls === "yes", "row security is reported");
    assert(header.agent_id === "no", "a missing agent_id column is reported");
    assert(header.owner_id === "yes", "the owner_id column is reported");
    assert(header.user_id === "no" && header.created_by === "no", "the other owner columns are reported");
    assert(header.columns === "id|owner_id|label", "the column names are reported");
    assert(header.role_literal === "mixed", "a capital-letter role comparison is reported");
    assert(header.blank_owner === "yes", "a blank owner comparison is reported");
    assert(header.changed === "no", "nothing is changed");
    assert(rows.some((row) => row.detail === "owner_devices_all_authenticated|ALL|signed_in|open"), "the open signed-in path is named");
    assert(rows.some((row) => row.detail === "owner_devices_select_authenticated|SELECT|signed_in|limited"), "a limited select is named");
    assert(rows.some((row) => row.detail === "owner_devices_insert_authenticated|INSERT|signed_in|limited"), "a limited insert is named");
    assert(!rows.some((row) => String(row.detail).includes("notes_select_own")), "another table is not listed");
    assert(!rows.some((row) => String(row.detail).includes("secret")), "a device row is not returned");
    const policies = await db.query(`select count(*)::int as n from pg_policies where tablename = 'owner_devices'`);
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    const still = await db.query(`select id from public.owner_devices`);
    assert(policies.rows[0].n === 3, "the check does not add a policy");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the notes table stays");
    assert(still.rows.length === 1 && still.rows[0].id === "dev", "the device row stays");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create role authenticated nologin;
      create table public.owner_devices (
        id text primary key,
        agent_id text
      );
      alter table public.owner_devices enable row level security;
      create policy owner_devices_select_authenticated on public.owner_devices
        for select to authenticated
        using (agent_id = 'agent-1');
    `);
    const header = bySection(await rowsOf(db));
    assert(header.agent_id === "yes" && header.owner_id === "no", "agent_id is reported when it exists");
    assert(header.columns === "id|agent_id", "only the real columns are named");
    assert(header.role_literal === "lower", "a lowercase comparison is not mixed");
    assert(header.blank_owner === "no", "an owned comparison is not a blank owner");
    assert(header.changed === "no", "the owned comparison changes nothing");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.owner_devices (id text primary key);
      alter table public.owner_devices enable row level security;
    `);
    const header = bySection(await rowsOf(db));
    assert(header.present === "yes" && header.rls === "yes", "row security on is reported");
    assert(header.agent_id === "no" && header.owner_id === "no", "missing owner columns are reported");
    assert(header.columns === "id", "the only column is named");
    assert(header.role_literal === "lower" && header.blank_owner === "no", "no policy means no extra flags");
    assert(header.changed === "no", "a quiet table is not changed");
  }

  {
    const db = new PGlite();
    const header = bySection(await rowsOf(db));
    assert(header.table === "owner_devices" && header.present === "no" && header.changed === "no", "a missing table is reported and nothing is saved");
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
