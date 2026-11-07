/**
 * The customer-file check only reports storage policies.
 * It does not add or remove one, and it does not read a file name.
 * Run: node _test-customer-files-policy-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-customer-files-policy-status.sql"), "utf8");
const code = executable(sql);
const readable = code.replace(/\$body\$/g, "");

console.log("1) the file only reads customer file storage");
assert(code.includes("gi-customer-files"), "it looks at the customer file bucket");
assert(code.includes("storage.objects"), "it looks at storage objects");
assert(code.includes("storage.buckets"), "it looks at the bucket row");
assert(!/create policy/i.test(code), "it does not create a policy");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into storage\.|update storage\.|delete from storage\./i.test(code), "it does not write a stored file");
assert(!/\b(name|payload|phone|email|pin|agent_name|body)\b/i.test(readable), "file names and stored fields are not selected");
assert(!/public\.customers|public\.app_meta|public\.proposals/i.test(code), "customer tables are not named");

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
      create schema if not exists storage;
      create role anon nologin;
      create role authenticated nologin;
      create table storage.buckets (
        id text primary key,
        public boolean not null
      );
      create table storage.objects (
        id text primary key,
        bucket_id text not null
      );
      insert into storage.buckets(id, public) values ('gi-customer-files', false);
      insert into storage.objects(id, bucket_id) values ('one', 'gi-customer-files');
      alter table storage.objects enable row level security;
      create policy gi_customer_files_all on storage.objects
        for all to anon, authenticated
        using (bucket_id = 'gi-customer-files')
        with check (bucket_id = 'gi-customer-files');
      create policy other_bucket_read on storage.objects
        for select to public
        using (bucket_id = 'other-bucket');
      create policy signed_in_limit on storage.objects
        for select to authenticated
        using (false);
      create table public.notes (id text primary key);
      create policy notes_select_own on public.notes
        for select to authenticated using (true);
    `);
    const rows = await rowsOf(db);
    const bySection = Object.fromEntries(rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
    assert(bySection.bucket === "gi-customer-files" && bySection.bucket_present === "yes" && bySection.bucket_public === "no", "the private bucket is reported");
    assert(bySection.objects_present === "yes" && bySection.rls_enabled === "yes" && bySection.rows_present === "yes", "stored files are counted without being named");
    assert(bySection.open_read === "yes" && bySection.changed === "no", "the public read is reported and nothing changes");
    assert(rows.some((row) => row.detail === "storage.objects|gi_customer_files_all|ALL|public+signed_in|this_bucket|bucket"), "the bucket door is named");
    assert(rows.some((row) => row.detail === "storage.objects|other_bucket_read|SELECT|public|other|limited"), "another bucket is not called this bucket");
    assert(rows.some((row) => row.detail === "storage.objects|signed_in_limit|SELECT|signed_in|other|limited"), "a signed-in limit is named");
    assert(!rows.some((row) => String(row.detail).includes("notes_select_own")), "another table is not listed");
    const policies = await db.query(`select count(*)::int as n from pg_policies where schemaname = 'storage'`);
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(policies.rows[0].n === 3, "the check does not add a policy");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create schema if not exists storage;
      create role anon nologin;
      create table storage.buckets (id text primary key, public boolean not null);
      create table storage.objects (id text primary key, bucket_id text not null);
      insert into storage.buckets(id, public) values ('gi-customer-files', true);
      alter table storage.objects enable row level security;
      create policy wide_open on storage.objects
        for select to anon using (true);
    `);
    const rows = await rowsOf(db);
    const bySection = Object.fromEntries(rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
    assert(bySection.bucket_public === "yes" && bySection.rows_present === "no" && bySection.open_read === "yes", "a public bucket and a whole-storage read are reported");
    assert(rows.some((row) => row.detail === "storage.objects|wide_open|SELECT|public|whole_storage|open"), "a rule of true is called open");
  }

  {
    const db = new PGlite();
    const rows = await rowsOf(db);
    const bySection = Object.fromEntries(rows.map((row) => [row.section, row.detail]));
    assert(bySection.bucket_present === "no" && bySection.objects_present === "no" && bySection.changed === "no", "a missing bucket is reported and nothing is created");
    assert(!rows.some((row) => row.section === "policy"), "no policy row is invented");
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
