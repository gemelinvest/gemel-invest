/**
 * The settings-row cleanup must finish during a save, and the browser must
 * still be unable to call that cleanup directly.
 * Run: node _test-strip-trigger-definer.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-strip-trigger-definer.sql"), "utf8");
const original = fs.readFileSync(path.join(ROOT, "supabase-gi-app-meta-secret-split.sql"), "utf8");

console.log("1) the fix stays on the trigger function");
assert(sql.includes("security definer"), "trigger function runs with the save, not as the browser");
assert(sql.includes("set search_path = public"), "the function lookup stays in public");
assert(sql.includes("new.payload := public.gi_strip_app_meta_payload(new.payload)"), "it still calls the existing cleanup");
assert(sql.includes("revoke all on function public.gi_strip_app_meta_row() from public, anon, authenticated"), "the browser is not granted the trigger function");
assert(!/grant execute on function public\.gi_strip_app_meta_payload/i.test(sql), "the cleanup function is not opened to the browser");
assert(!/update public\.app_meta/i.test(sql), "running the file does not write the settings row");
assert(!/drop trigger/i.test(sql), "the trigger is not removed");
assert(!/customers|encrypted_password|gi_verify_admin_login/i.test(sql), "customers, passwords, and login are untouched");
assert(original.includes("gi_strip_app_meta_payload"), "the original cleanup file stays in place");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role crm_writer nologin;
    grant usage on schema public to crm_writer;
    create table public.app_meta (
      key text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    );
    grant select, update on public.app_meta to crm_writer;
    insert into public.app_meta (key, payload) values (
      'global',
      jsonb_build_object(
        'elementaryReferrals', jsonb_build_array(jsonb_build_object('id', 'ref-1')),
        'adminAuth', jsonb_build_object('username', 'מנהל בדיקה', 'pin', '1357'),
        'agentSecurity', jsonb_build_object(
          'a_target', jsonb_build_object('mfaRequired', true, 'totpUri', 'otpauth://secret'),
          'a_other', jsonb_build_object('pinOnlyLogin', true, 'mfaRequired', false)
        )
      )
    );
  `);
  const strip = original.slice(
    original.indexOf("create or replace function public.gi_strip_app_meta_payload"),
    original.indexOf("revoke all on function public.gi_strip_app_meta_payload")
  );
  const invoker = original.slice(
    original.indexOf("create or replace function public.gi_strip_app_meta_row()"),
    original.indexOf("revoke all on function public.gi_strip_app_meta_row()")
  );
  await db.exec(strip + invoker + `
    revoke all on function public.gi_strip_app_meta_payload(jsonb) from public, anon, authenticated, crm_writer;
    revoke all on function public.gi_strip_app_meta_row() from public, anon, authenticated, crm_writer;
    create trigger trg_gi_strip_app_meta_secrets
      before update on public.app_meta
      for each row
      execute function public.gi_strip_app_meta_row();
  `);

  await db.exec("set role crm_writer");
  let blocked = "";
  try {
    await db.exec(`
      update public.app_meta
         set payload = jsonb_set(payload, '{adminAuth,pin}', '"9999"'::jsonb, true)
       where key = 'global'
    `);
  } catch(err) {
    blocked = String(err && err.message || err);
  }
  await db.exec("reset role");
  assert(/permission denied for function gi_strip_app_meta_payload/i.test(blocked), "before the fix, the browser save is blocked on the cleanup function");

  const before = await db.query("select payload from public.app_meta where key = 'global'");
  assert(before.rows[0].payload.adminAuth.pin === "1357", "the blocked save does not change the settings row");

  await db.exec(sql);
  await db.exec("set role crm_writer");
  await db.exec(`
    update public.app_meta
       set payload = jsonb_set(payload, '{adminAuth,city}', '"חיפה"'::jsonb, true)
     where key = 'global'
  `);
  let directDenied = false;
  try {
    await db.query("select public.gi_strip_app_meta_payload('{}'::jsonb)");
  } catch(err) {
    directDenied = /permission denied for function gi_strip_app_meta_payload/i.test(String(err && err.message || err));
  }
  await db.exec("reset role");

  const after = await db.query("select payload from public.app_meta where key = 'global'");
  const payload = after.rows[0].payload;
  assert(payload.adminAuth.pin == null, "a finished save still removes the admin PIN");
  assert(payload.adminAuth.username === "מנהל בדיקה", "the admin name stays");
  assert(payload.adminAuth.city === "חיפה", "the saved field stays");
  assert(payload.agentSecurity.a_target.totpUri == null, "an authenticator secret is still removed");
  assert(payload.agentSecurity.a_target.mfaRequired === true, "the authenticator flag stays");
  assert(payload.agentSecurity.a_other.pinOnlyLogin === true, "another account is unchanged");
  assert(payload.elementaryReferrals[0].id === "ref-1", "referrals stay on the row");
  assert(directDenied, "the browser still cannot call the cleanup function directly");
  await db.close();
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
