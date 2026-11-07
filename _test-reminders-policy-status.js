/**
 * The reminders check only reports policy names.
 * It does not add or remove one.
 * Run: node _test-reminders-policy-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-reminders-policy-status.sql"), "utf8");
const code = executable(sql);
const readable = code.replace(/\$body\$/g, "");

console.log("1) the file only reads reminders");
assert(code.includes("public.reminders"), "it looks at reminders");
assert(!/create policy/i.test(code), "it does not create a policy");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a stored row");
assert(!/\b(payload|phone|email|pin|agent_name|body|note|title)\b/i.test(readable), "stored fields are not selected");
assert(!/public\.agents|public\.app_meta|public\.customers|public\.proposals|gi_chat_messages|gi_simulator_saves|gi_agent_live/i.test(code), "other tables are not named");

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
      create table public.reminders (id text primary key);
      create table public.notes (id text primary key);
      insert into public.reminders(id) values ('active');
      alter table public.reminders enable row level security;
      alter table public.notes enable row level security;
      create policy anon_full_access on public.reminders
        for all to anon, authenticated using (true) with check (true);
      create policy reminders_select_authenticated on public.reminders
        for select to authenticated using (false);
      create policy notes_select_own on public.notes
        for select to authenticated using (true);
    `);
    const rows = await rowsOf(db);
    const head = Object.fromEntries(rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
    assert(head.table === "reminders" && head.rls_enabled === "yes" && head.rows_present === "yes" && head.open_read === "yes" && head.changed === "no", "reminders are reported without a change");
    assert(rows.some((row) => row.detail === "reminders|anon_full_access|ALL|public+signed_in|open"), "the open door is named");
    assert(rows.some((row) => row.detail === "reminders|reminders_select_authenticated|SELECT|signed_in|limited"), "a signed-in limit is named");
    assert(!rows.some((row) => String(row.detail).includes("notes_select_own")), "another table is not listed");
    const policies = await db.query(`select count(*)::int as n from pg_policies where tablename = 'reminders'`);
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(policies.rows[0].n === 2, "the check does not add a policy");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    const rows = await rowsOf(db);
    const bySection = Object.fromEntries(rows.map((row) => [row.section, row.detail]));
    assert(bySection.table === "reminders" && bySection.present === "no" && bySection.changed === "no", "a missing table is reported");
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
