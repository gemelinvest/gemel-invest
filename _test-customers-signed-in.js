/**
 * The customers signed-in path is added beside the open door.
 * The shadow policies, the archived delete, and the public delete block stay.
 * Run: node _test-customers-signed-in.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-customers-signed-in.sql"), "utf8");
const code = executable(sql);

console.log("1) the file adds one inert signed-in path");
assert(code.includes("create policy gi_customers_all_authenticated"), "it adds the signed-in path");
assert(code.includes("on public.customers"), "the path is on the customers table");
assert(code.includes("for all") && code.includes("to authenticated") && code.includes("using (true)") && code.includes("with check (true)"), "a signed-in session can read and save");
assert((code.match(/create policy/gi) || []).length === 1, "it creates one policy");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security/i.test(code), "it does not turn row security on");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.customers|update public\.customers|delete from public\.customers/i.test(code), "it does not write a customer");
assert(!/payload|full_name|id_number|agent_name|phone|email/i.test(code), "customer fields are not selected");
assert(!/campaign_leads|gi_agent_activity_log|gi_daily_report|gi_cancellations_report|public\.proposals|public\.agents|public\.app_meta/i.test(code), "other tables are not named");
assert(code.includes("open door is missing; nothing saved"), "a missing open door saves nothing");
assert(code.includes("customer policies are missing; nothing saved"), "a missing customer policy saves nothing");
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
    create table public.customers (id text primary key);
    create table public.proposals (id text primary key);
    grant select, insert, update, delete on public.customers to anon, authenticated;
    grant select on public.proposals to authenticated;
    insert into public.customers(id) values ('active');
    insert into public.proposals(id) values ('active');
    alter table public.proposals enable row level security;
    create policy proposals_select_own on public.proposals
      for select to authenticated using (true);
  `;

  const current = `
    alter table public.customers enable row level security;
    create policy "allow all customers" on public.customers
      for all to anon, authenticated using (true) with check (true);
    create policy customers_select_own_shadow on public.customers
      for select to authenticated using (false);
    create policy customers_insert_own_shadow on public.customers
      for insert to authenticated with check (false);
    create policy customers_update_own_shadow on public.customers
      for update to authenticated using (false) with check (false);
    create policy customers_delete_own_shadow on public.customers
      for delete to authenticated using (false);
    create policy gi_customers_delete_archived on public.customers
      for delete to authenticated using (false);
    create policy z_block_anon_delete on public.customers
      for delete to anon using (false);
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
    const bySection = Object.fromEntries(first.map((row) => [row.section, row.detail]));
    assert(bySection.table === "customers", "the result names the customers table");
    assert(bySection.rls_enabled === "yes", "row security stays on");
    assert(bySection.open_door === "yes", "the open door is still reported");
    assert(bySection.signed_in_all === "installed", "the signed-in path is installed");
    assert(bySection.anon_rows === "same", "anon still sees the same rows");
    assert(bySection.authenticated_rows === "same", "a session still sees the same rows");
    assert(bySection.customer_rows === "unchanged", "the stored customers are unchanged");
    assert(bySection.other_tables === "unchanged", "the proposals table is unchanged");
    assert(bySection.shadow_policies === "kept" && bySection.archived_delete === "kept" && bySection.anon_delete_block === "kept", "the shadow policies, archived delete, and delete block stay");
    assert(bySection.access_changed === "no" && bySection.door_closed === "no", "access is unchanged and the door stays open");
    assert(bySection.open_policy === "allow all customers", "the live open policy name is returned");
    const second = await rowsOf(db);
    const again = Object.fromEntries(second.map((row) => [row.section, row.detail]));
    assert(again.signed_in_all === "already_present", "a second run adds nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'customers'
      order by policyname
    `);
    assert(policies.rows.map((row) => row.policyname).join(",") === [
      "allow all customers",
      "customers_delete_own_shadow",
      "customers_insert_own_shadow",
      "customers_select_own_shadow",
      "customers_update_own_shadow",
      "gi_customers_all_authenticated",
      "gi_customers_delete_archived",
      "z_block_anon_delete"
    ].join(","), "the open door and the shadow policies stay beside the new path");
    const proposals = await db.query(`select policyname from pg_policies where tablename = 'proposals'`);
    assert(proposals.rows.length === 1 && proposals.rows[0].policyname === "proposals_select_own", "the proposals table stays");
    const stored = await db.query(`select count(*)::int as n from public.customers`);
    assert(stored.rows[0].n === 1, "the customer row was not rewritten");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current.replace(`create policy "allow all customers" on public.customers\n      for all to anon, authenticated using (true) with check (true);\n    `, ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/open door is missing; nothing saved/i.test(blocked), "a path without the open door saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'customers' and policyname = 'gi_customers_all_authenticated'
    `);
    assert(policies.rows.length === 0, "the rejected path is not left behind");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current.replace("create policy customers_select_own_shadow on public.customers\n      for select to authenticated using (false);\n    ", ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/customer policies are missing; nothing saved/i.test(blocked), "a missing shadow policy saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'customers' and policyname = 'gi_customers_all_authenticated'
    `);
    const door = await db.query(`
      select policyname from pg_policies
      where tablename = 'customers' and policyname = 'allow all customers'
    `);
    assert(policies.rows.length === 0 && door.rows.length === 1, "the open door stays when a shadow policy is missing");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current + `
      create policy gi_customers_all_authenticated on public.customers
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
