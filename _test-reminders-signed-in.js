/**
 * A signed-in path is added beside the open reminders door.
 * The limited policies stay.
 * Run: node _test-reminders-signed-in.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-reminders-signed-in.sql"), "utf8");
const code = executable(sql);
const readable = code.replace(/\$body\$/g, "");

console.log("1) the file adds one inert signed-in path");
assert(code.includes("create policy reminders_all_authenticated"), "it adds the signed-in path");
assert((code.match(/create policy/gi) || []).length === 1, "it creates one policy");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security/i.test(code), "it does not turn row security on");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a stored row");
assert(!/\b(payload|phone|email|pin|agent_name|body|note|title)\b/i.test(readable), "stored fields are not selected");
assert(!/public\.agents|public\.app_meta|public\.customers|public\.proposals|gi_chat_messages/i.test(code), "other business tables are not named");
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
    create table public.reminders (id text primary key);
    create table public.notes (id text primary key);
    grant select, insert, update, delete on public.reminders to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.reminders(id) values ('active');
    alter table public.reminders enable row level security;
    alter table public.notes enable row level security;
    create policy notes_select_own on public.notes
      for select to authenticated using (true);
  `;

  const current = `
    create policy anon_full_access on public.reminders
      for all to anon, authenticated using (true) with check (true);
    create policy reminders_select_authenticated on public.reminders
      for select to authenticated using (false);
    create policy reminders_insert_authenticated on public.reminders
      for insert to authenticated with check (false);
    create policy reminders_update_authenticated on public.reminders
      for update to authenticated using (false) with check (false);
    create policy reminders_delete_authenticated on public.reminders
      for delete to authenticated using (false);
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
    assert(details.includes("table=reminders"), "the table is named");
    assert(details.includes("signed_in_all=installed"), "the signed-in path is installed");
    assert(details.includes("anon_rows=same") && details.includes("authenticated_rows=same"), "both roles still see the same rows");
    assert(details.includes("limited_policies=kept") && details.includes("other_tables=unchanged"), "the limits and other tables stay");
    assert(details.includes("open_door=kept") && details.includes("access_changed=no") && details.includes("door_closed=no"), "the public door stays open");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("signed_in_all=already_present"), "a second run adds nothing");
    const policies = await db.query(`select policyname from pg_policies where tablename = 'reminders' and policyname in ('anon_full_access', 'reminders_all_authenticated') order by policyname`);
    assert(policies.rows.map((row) => row.policyname).join(",") === "anon_full_access,reminders_all_authenticated", "the open door stays beside the new path");
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
    const stored = await db.query(`select count(*)::int as n from public.reminders`);
    assert(stored.rows[0].n === 1, "the reminder row was not rewritten");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current.replace("create policy anon_full_access on public.reminders\n      for all to anon, authenticated using (true) with check (true);\n    ", ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/open reminders door is missing; nothing saved/i.test(blocked), "a missing door saves nothing");
    const added = await db.query(`select policyname from pg_policies where policyname = 'reminders_all_authenticated'`);
    assert(added.rows.length === 0, "the rejected path is not left behind");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current + `
      create policy reminders_all_authenticated on public.reminders
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
