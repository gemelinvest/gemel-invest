/**
 * The customer-file role status only reads storage policies and the helper.
 * It does not add or remove a policy, and it does not read a file name.
 * Run: node _test-customer-files-role-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-customer-files-role-status.sql"), "utf8");
const code = executable(sql);

console.log("1) the file only reads customer file storage");
assert(code.includes("gi-customer-files"), "it looks at the customer file bucket");
assert(code.includes("storage.objects"), "it looks at storage objects");
assert(code.includes("storage.buckets"), "it looks at the bucket row");
assert(code.includes("gi_storage_customer_allowed"), "it checks the ownership helper");
assert(code.includes("teamManager|opsAgent"), "it flags a capital-letter role comparison");
assert(code.includes("'changed', 'no'"), "it reports that nothing changed");
assert(!/create\s+policy/i.test(code), "it does not create a policy");
assert(!/drop\s+policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/from\s+storage\.objects/i.test(code), "it does not read stored files");
assert(!/insert into storage\.|update storage\.|delete from storage\./i.test(code), "it does not write a file");

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
      create schema storage;
      create role anon nologin;
      create role authenticated nologin;
      create table storage.buckets (id text primary key, public boolean);
      create table storage.objects (id text primary key, bucket_id text, name text);
      insert into storage.buckets(id, public) values ('gi-customer-files', false);
      insert into storage.objects(id, bucket_id, name) values ('f1', 'gi-customer-files', 'secret-file.pdf');
      alter table storage.objects enable row level security;
      create function public.gi_storage_customer_allowed(p_customer_id text)
      returns boolean language sql stable security definer as $$
        select p_customer_id = 'teamManager'
      $$;
      create policy gi_customer_files_all_authenticated on storage.objects
        for all to authenticated
        using (bucket_id = 'gi-customer-files')
        with check (bucket_id = 'gi-customer-files');
      create policy gi_customer_files_select_authenticated on storage.objects
        for select to authenticated
        using (bucket_id = 'gi-customer-files' and public.gi_storage_customer_allowed(name));
      create policy other_bucket_select on storage.objects
        for select to authenticated
        using (bucket_id = 'other-bucket');
    `);
    const rows = await rowsOf(db);
    const header = bySection(rows);
    assert(header.bucket === "gi-customer-files", "the result names the bucket");
    assert(header.present === "yes", "the bucket is present");
    assert(header.public === "no", "a private bucket is reported");
    assert(header.objects === "yes" && header.rls === "yes", "object row security is reported");
    assert(header.helper === "yes" && header.definer === "yes", "the security definer helper is reported");
    assert(header.role_literal === "mixed", "a capital-letter role comparison is reported");
    assert(header.open_path === "yes", "the open bucket path is reported");
    assert(header.changed === "no", "nothing is changed");
    assert(rows.some((row) => row.detail === "storage.objects|gi_customer_files_all_authenticated|ALL|signed_in|this_bucket|open"), "the open signed-in path is named");
    assert(rows.some((row) => row.detail === "storage.objects|gi_customer_files_select_authenticated|SELECT|signed_in|this_bucket|limited"), "a limited bucket policy is named");
    assert(rows.some((row) => row.detail === "storage.objects|other_bucket_select|SELECT|signed_in|other|limited"), "another bucket is named as other");
    assert(!rows.some((row) => String(row.detail).includes("secret-file")), "a file name is not returned");
    const policies = await db.query(`select count(*)::int as n from pg_policies where schemaname = 'storage' and tablename = 'objects'`);
    const still = await db.query(`select name from storage.objects`);
    assert(policies.rows[0].n === 3, "the check does not add a policy");
    assert(still.rows.length === 1 && still.rows[0].name === "secret-file.pdf", "the stored file stays");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create schema storage;
      create role authenticated nologin;
      create table storage.buckets (id text primary key, public boolean);
      create table storage.objects (id text primary key, bucket_id text, name text);
      insert into storage.buckets(id, public) values ('gi-customer-files', true);
      alter table storage.objects enable row level security;
      create function public.gi_storage_customer_allowed(p_customer_id text)
      returns boolean language sql stable security invoker as $$
        select p_customer_id = 'agent-1'
      $$;
      create policy gi_customer_files_select_authenticated on storage.objects
        for select to authenticated
        using (bucket_id = 'gi-customer-files' and public.gi_storage_customer_allowed(name));
    `);
    const header = bySection(await rowsOf(db));
    assert(header.public === "yes", "a public bucket is reported");
    assert(header.definer === "no", "an invoker helper is reported");
    assert(header.role_literal === "lower", "a lowercase helper is not mixed");
    assert(header.open_path === "no", "an ownership policy is not an open path");
    assert(header.changed === "no", "the ownership policy changes nothing");
  }

  {
    const db = new PGlite();
    const header = bySection(await rowsOf(db));
    assert(header.bucket === "gi-customer-files" && header.present === "no", "a missing bucket is reported");
    assert(header.objects === "no" && header.rls === "unknown", "missing storage is reported");
    assert(header.helper === "no" && header.definer === "unknown", "a missing helper is reported");
    assert(header.open_path === "unknown" && header.changed === "no", "nothing is saved when storage is missing");
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
