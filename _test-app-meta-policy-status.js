/**
 * The app meta check only reports policy names. It does not add or remove one.
 * Run: node _test-app-meta-policy-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-app-meta-policy-status.sql"), "utf8");
const code = executable(sql);

console.log("1) the file only reads");
assert(code.includes("public.app_meta"), "it looks at the app meta table");
assert(!/create policy/i.test(code), "it does not create a policy");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a meta row");
assert(!/\b(key|value|secret|pin|payload)\b/i.test(code), "meta fields are not selected");
assert(!/campaign_leads|gi_agent_activity_log|gi_cancellations_report|gi_daily_report|public\.customers|public\.proposals|public\.agents/i.test(code), "other tables are not named");

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
      create table public.app_meta (id text primary key);
      create table public.customers (id text primary key);
      insert into public.app_meta(id) values ('active');
      alter table public.app_meta enable row level security;
      alter table public.customers enable row level security;
      create policy "allow all app_meta" on public.app_meta
        for all to anon, authenticated using (true) with check (true);
      create policy app_meta_select_authenticated on public.app_meta
        for select to authenticated using (false);
      create policy customers_select_own_shadow on public.customers
        for select to authenticated using (true);
    `);
    const rows = await rowsOf(db);
    const bySection = Object.fromEntries(rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
    assert(bySection.table === "app_meta", "the result names the app meta table");
    assert(bySection.rls_enabled === "yes", "row security is reported");
    assert(bySection.rows_present === "yes", "rows are reported without a count");
    assert(bySection.open_read === "yes", "the public read is reported");
    assert(bySection.changed === "no", "nothing is changed");
    assert(rows.some((row) => row.detail === "allow all app_meta|ALL|public+signed_in|open"), "the open door is named");
    assert(rows.some((row) => row.detail === "app_meta_select_authenticated|SELECT|signed_in|limited"), "a signed-in limit is named");
    assert(!rows.some((row) => String(row.detail).includes("customers_select_own_shadow")), "another table is not listed");
    const policies = await db.query(`select count(*)::int as n from pg_policies where tablename = 'app_meta'`);
    const customers = await db.query(`select policyname from pg_policies where tablename = 'customers'`);
    assert(policies.rows[0].n === 2, "the check does not add a policy");
    assert(customers.rows.length === 1 && customers.rows[0].policyname === "customers_select_own_shadow", "the customers table stays");
  }

  {
    const db = new PGlite();
    const rows = await rowsOf(db);
    const bySection = Object.fromEntries(rows.map((row) => [row.section, row.detail]));
    assert(bySection.table === "missing" && bySection.changed === "no", "a missing table is reported and nothing is saved");
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
