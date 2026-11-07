/**
 * A signed-in path is added beside the open customer-file door.
 * The door stays. Other buckets stay closed.
 * Run: node _test-customer-files-signed-in.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-customer-files-signed-in.sql"), "utf8");
const code = executable(sql);
const readable = code.replace(/\$body\$/g, "").replace(/\$policy\$/g, "");

console.log("1) the file adds one inert signed-in path");
assert(code.includes("create policy gi_customer_files_all_authenticated"), "it adds the signed-in path");
assert((code.match(/create policy/gi) || []).length === 1, "it creates one policy");
assert(code.includes("bucket_id = 'gi-customer-files'"), "the path names only this bucket");
assert(!/using\s*\(\s*true\s*\)/i.test(code), "it does not open every bucket");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security/i.test(code), "it does not turn row security on");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into storage\.|update storage\.|delete from storage\./i.test(code), "it does not write a stored file");
assert(!/\b(name|payload|phone|email|pin|agent_name|body)\b/i.test(readable), "file names and stored fields are not selected");
assert(!/public\.customers|public\.app_meta|public\.proposals/i.test(code), "customer tables are not named");
assert(code.includes("another bucket changed; nothing saved"), "another bucket becoming visible saves nothing");

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
    create schema if not exists storage;
    create role anon nologin;
    create role authenticated nologin;
    create table storage.buckets (id text primary key, public boolean not null);
    create table storage.objects (id text primary key, bucket_id text not null);
    grant usage on schema storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
    insert into storage.buckets(id, public) values ('gi-customer-files', false);
    insert into storage.objects(id, bucket_id) values ('one', 'gi-customer-files'), ('two', 'other-bucket');
    alter table storage.objects enable row level security;
    create policy gi_customer_files_all on storage.objects
      for all to anon, authenticated
      using (bucket_id = 'gi-customer-files')
      with check (bucket_id = 'gi-customer-files');
    create policy gi_customer_files_select_authenticated on storage.objects
      for select to authenticated using (false);
    create policy gi_customer_files_insert_authenticated on storage.objects
      for insert to authenticated with check (false);
    create policy gi_customer_files_update_authenticated on storage.objects
      for update to authenticated using (false) with check (false);
    create policy gi_customer_files_delete_authenticated on storage.objects
      for delete to authenticated using (false);
    create table public.notes (id text primary key);
    create policy notes_select_own on public.notes for select to authenticated using (true);
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  {
    const db = new PGlite();
    await db.exec(base);
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("bucket=gi-customer-files"), "the bucket is named");
    assert(details.includes("signed_in_all=installed"), "the signed-in path is installed");
    assert(details.includes("anon_rows=same") && details.includes("authenticated_rows=same"), "both reads stay the same");
    assert(details.includes("narrow_policies=kept") && details.includes("open_door=kept"), "the narrow policies and the door stay");
    assert(details.includes("other_buckets=unchanged") && details.includes("stored_rows=unchanged"), "other buckets and stored rows stay");
    assert(details.includes("access_changed=no") && details.includes("door_closed=no"), "access does not change and the door stays open");
    const second = await rowsOf(db);
    assert(second.some((row) => row.section === "signed_in_all" && row.detail === "already"), "a second run adds nothing");
    await db.exec("set role anon");
    const anonFiles = await db.query(`select count(*)::int as n from storage.objects where bucket_id = 'gi-customer-files'`);
    const anonOther = await db.query(`select count(*)::int as n from storage.objects where bucket_id <> 'gi-customer-files'`);
    await db.exec("reset role");
    await db.exec("set role authenticated");
    const authFiles = await db.query(`select count(*)::int as n from storage.objects where bucket_id = 'gi-customer-files'`);
    const authOther = await db.query(`select count(*)::int as n from storage.objects where bucket_id <> 'gi-customer-files'`);
    await db.exec("reset role");
    assert(anonFiles.rows[0].n === 1 && authFiles.rows[0].n === 1, "both roles still see this bucket");
    assert(anonOther.rows[0].n === 0 && authOther.rows[0].n === 0, "neither role gains the other bucket");
    const added = await db.query(`select cmd, array_to_string(roles, ',') as roles from pg_policies where policyname = 'gi_customer_files_all_authenticated'`);
    const door = await db.query(`select count(*)::int as n from pg_policies where policyname = 'gi_customer_files_all'`);
    const narrow = await db.query(`select count(*)::int as n from pg_policies where policyname in ('gi_customer_files_select_authenticated', 'gi_customer_files_insert_authenticated', 'gi_customer_files_update_authenticated', 'gi_customer_files_delete_authenticated')`);
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(added.rows.length === 1 && added.rows[0].cmd === "ALL" && added.rows[0].roles === "authenticated", "the new path is authenticated only");
    assert(door.rows[0].n === 1 && narrow.rows[0].n === 4, "the door and the four narrow policies stay");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    await db.exec(base.replace("create policy gi_customer_files_all on storage.objects\n      for all to anon, authenticated\n      using (bucket_id = 'gi-customer-files')\n      with check (bucket_id = 'gi-customer-files');\n    ", ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/open door is missing; nothing saved/i.test(blocked), "a missing door saves nothing");
    const added = await db.query(`select policyname from pg_policies where policyname = 'gi_customer_files_all_authenticated'`);
    assert(added.rows.length === 0, "no path is added when the door is missing");
  }

  {
    const db = new PGlite();
    await db.exec(base + `
      create policy gi_customer_files_all_authenticated on storage.objects
        for all to authenticated using (true) with check (true);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/signed-in policy is not a bucket path; nothing saved/i.test(blocked), "a whole-storage signed-in path saves nothing");
    const door = await db.query(`select policyname from pg_policies where policyname = 'gi_customer_files_all'`);
    assert(door.rows.length === 1, "the door stays when the signed-in path is too wide");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create schema if not exists storage;
      create table storage.buckets (id text primary key, public boolean not null);
      create table storage.objects (id text primary key, bucket_id text not null);
      insert into storage.buckets(id, public) values ('gi-customer-files', false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/row security is off; nothing saved/i.test(blocked), "row security is not switched on in order to add the path");
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
