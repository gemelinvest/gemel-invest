/**
 * The public door on the customers table closes only when a signed-in session
 * still sees the same rows. The shadow policies stay.
 * Run: node _test-close-customers-door.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-close-customers-door.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes one named door");
assert(code.includes('drop policy "allow all customers" on public.customers'), "it removes the named public door");
assert((code.match(/drop policy/gi) || []).length === 1, "it drops one policy");
assert(!code.includes("drop policy gi_customers_all_authenticated"), "it does not drop the signed-in path");
assert(!code.includes("drop policy customers_select_own_shadow"), "it does not drop a shadow policy");
assert(!code.includes("drop policy z_block_anon_delete"), "it does not drop the public delete block");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.customers|update public\.customers|delete from public\.customers/i.test(code), "it does not write a customer");
assert(!/create policy/i.test(code), "it does not create a policy");
assert(!/payload|full_name|id_number|agent_name|phone|email/i.test(code), "customer fields are not selected");
assert(!/campaign_leads|gi_agent_activity_log|gi_daily_report|gi_cancellations_report|public\.proposals|public\.agents|public\.app_meta/i.test(code), "other tables are not named");
assert(code.includes("signed-in rows changed; nothing saved"), "a signed-in count change saves nothing");
assert(code.includes("signed-in path is missing; nothing saved"), "a missing signed-in path saves nothing");
assert(code.includes("customer policies are missing; nothing saved"), "a missing customer policy saves nothing");
assert(code.includes("anon door is still open; nothing saved"), "a remaining public door saves nothing");

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

  const kept = `
    create policy gi_customers_all_authenticated on public.customers
      for all to authenticated using (true) with check (true);
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
    await db.exec(fixture + `
      alter table public.customers enable row level security;
      create policy "allow all customers" on public.customers
        for all to anon, authenticated using (true) with check (true);
    ` + kept);
    const first = await rowsOf(db);
    const bySection = Object.fromEntries(first.map((row) => [row.section, row.detail]));
    assert(bySection.table === "customers", "the result names the customers table");
    assert(bySection.rls_enabled === "yes", "row security stays on");
    assert(bySection.authenticated_rows === "same", "a signed-in session still sees the same rows");
    assert(bySection.anon_rows === "hidden", "the public key no longer sees the rows");
    assert(bySection.customer_rows === "unchanged", "the stored customers are unchanged");
    assert(bySection.other_tables === "unchanged", "the proposals table is unchanged");
    assert(bySection.policies_removed === "allow all customers", "only the named door is removed");
    assert(bySection.signed_in_all === "kept" && bySection.shadow_policies === "kept" && bySection.archived_delete === "kept" && bySection.anon_delete_block === "kept", "the signed-in path, shadows, archived delete, and delete block stay");
    assert(bySection.door_closed === "yes", "the public door is closed");
    const second = await rowsOf(db);
    const again = Object.fromEntries(second.map((row) => [row.section, row.detail]));
    assert(again.policies_removed === "none" && again.anon_rows === "already_hidden", "a second run removes nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'customers'
      order by policyname
    `);
    assert(policies.rows.map((row) => row.policyname).join(",") === [
      "customers_delete_own_shadow",
      "customers_insert_own_shadow",
      "customers_select_own_shadow",
      "customers_update_own_shadow",
      "gi_customers_all_authenticated",
      "gi_customers_delete_archived",
      "z_block_anon_delete"
    ].join(","), "the signed-in policies remain and the public door does not");
    const proposals = await db.query(`select policyname from pg_policies where tablename = 'proposals'`);
    assert(proposals.rows.length === 1 && proposals.rows[0].policyname === "proposals_select_own", "the proposals table stays");
    await db.exec("set role anon");
    const hidden = await db.query(`select count(*)::int as n from public.customers`);
    await db.exec("reset role");
    await db.exec("set role authenticated");
    const visible = await db.query(`select count(*)::int as n from public.customers`);
    await db.exec("reset role");
    assert(hidden.rows[0].n === 0 && visible.rows[0].n === 1, "anon sees nothing and the session still sees the row");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.customers enable row level security;
      create policy "allow all customers" on public.customers
        for all to anon, authenticated using (true) with check (true);
    ` + kept.replace("create policy gi_customers_all_authenticated on public.customers\n      for all to authenticated using (true) with check (true);\n    ", ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/signed-in path is missing; nothing saved/i.test(blocked), "a missing signed-in path saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'customers' and policyname = 'allow all customers'
    `);
    assert(policies.rows.length === 1, "the public door stays when the signed-in path is missing");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.customers enable row level security;
      create policy "allow all customers" on public.customers
        for all to anon, authenticated using (true) with check (true);
      create policy anon_extra on public.customers
        for select to anon using (true);
    ` + kept);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/anon door is still open; nothing saved/i.test(blocked), "a second public read saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'customers' and policyname = 'allow all customers'
    `);
    assert(policies.rows.length === 1, "the named door is restored when another public read remains");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + kept);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/row security is off; nothing saved/i.test(blocked), "row security is not switched on in order to close the door");
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
