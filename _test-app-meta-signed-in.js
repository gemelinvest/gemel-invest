/**
 * The app meta signed-in path is added beside the open door.
 * The existing signed-in policies and the public delete block stay.
 * Run: node _test-app-meta-signed-in.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-app-meta-signed-in.sql"), "utf8");
const code = executable(sql);

console.log("1) the file adds one inert signed-in path");
assert(code.includes("create policy gi_app_meta_all_authenticated"), "it adds the signed-in path");
assert(code.includes("on public.app_meta"), "the path is on the app meta table");
assert(code.includes("for all") && code.includes("to authenticated") && code.includes("using (true)") && code.includes("with check (true)"), "a signed-in session can read and save");
assert((code.match(/create policy/gi) || []).length === 1, "it creates one policy");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security/i.test(code), "it does not turn row security on");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.app_meta|update public\.app_meta|delete from public\.app_meta/i.test(code), "it does not write a meta row");
assert(!/\b(key|value|secret|pin|payload)\b/i.test(code), "meta fields are not selected");
assert(!/campaign_leads|gi_agent_activity_log|gi_daily_report|gi_cancellations_report|public\.customers|public\.proposals|public\.agents/i.test(code), "other tables are not named");
assert(code.includes("open door is missing; nothing saved"), "a missing open door saves nothing");
assert(code.includes("app meta policies are missing; nothing saved"), "a missing app meta policy saves nothing");
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
    create table public.app_meta (id text primary key);
    create table public.customers (id text primary key);
    grant select, insert, update, delete on public.app_meta to anon, authenticated;
    grant select on public.customers to authenticated;
    insert into public.app_meta(id) values ('active');
    insert into public.customers(id) values ('active');
    alter table public.customers enable row level security;
    create policy customers_select_own_shadow on public.customers
      for select to authenticated using (true);
  `;

  const current = `
    alter table public.app_meta enable row level security;
    create policy "allow all app_meta" on public.app_meta
      for all to anon, authenticated using (true) with check (true);
    create policy app_meta_select_authenticated on public.app_meta
      for select to authenticated using (true);
    create policy app_meta_insert_authenticated on public.app_meta
      for insert to authenticated with check (false);
    create policy app_meta_update_authenticated on public.app_meta
      for update to authenticated using (false) with check (false);
    create policy app_meta_delete_authenticated on public.app_meta
      for delete to authenticated using (false);
    create policy z_block_anon_delete on public.app_meta
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
    assert(bySection.table === "app_meta", "the result names the app meta table");
    assert(bySection.rls_enabled === "yes", "row security stays on");
    assert(bySection.open_door === "yes", "the open door is still reported");
    assert(bySection.signed_in_all === "installed", "the signed-in path is installed");
    assert(bySection.anon_rows === "same", "anon still sees the same rows");
    assert(bySection.authenticated_rows === "same", "a session still sees the same rows");
    assert(bySection.meta_rows === "unchanged", "the stored meta rows are unchanged");
    assert(bySection.other_tables === "unchanged", "the customers table is unchanged");
    assert(bySection.signed_in_policies === "kept" && bySection.anon_delete_block === "kept", "the signed-in policies and the delete block stay");
    assert(bySection.access_changed === "no" && bySection.door_closed === "no", "access is unchanged and the door stays open");
    assert(bySection.open_policy === "allow all app_meta", "the live open policy name is returned");
    const second = await rowsOf(db);
    const again = Object.fromEntries(second.map((row) => [row.section, row.detail]));
    assert(again.signed_in_all === "already_present", "a second run adds nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'app_meta'
      order by policyname
    `);
    assert(policies.rows.map((row) => row.policyname).join(",") === [
      "allow all app_meta",
      "app_meta_delete_authenticated",
      "app_meta_insert_authenticated",
      "app_meta_select_authenticated",
      "app_meta_update_authenticated",
      "gi_app_meta_all_authenticated",
      "z_block_anon_delete"
    ].join(","), "the open door and the signed-in policies stay beside the new path");
    const customers = await db.query(`select policyname from pg_policies where tablename = 'customers'`);
    assert(customers.rows.length === 1 && customers.rows[0].policyname === "customers_select_own_shadow", "the customers table stays");
    const stored = await db.query(`select count(*)::int as n from public.app_meta`);
    assert(stored.rows[0].n === 1, "the meta row was not rewritten");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current.replace(`create policy "allow all app_meta" on public.app_meta\n      for all to anon, authenticated using (true) with check (true);\n    `, ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/open door is missing; nothing saved/i.test(blocked), "a path without the open door saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'app_meta' and policyname = 'gi_app_meta_all_authenticated'
    `);
    assert(policies.rows.length === 0, "the rejected path is not left behind");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current.replace("create policy app_meta_update_authenticated on public.app_meta\n      for update to authenticated using (false) with check (false);\n    ", ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/app meta policies are missing; nothing saved/i.test(blocked), "a missing signed-in policy saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'app_meta' and policyname = 'gi_app_meta_all_authenticated'
    `);
    const door = await db.query(`
      select policyname from pg_policies
      where tablename = 'app_meta' and policyname = 'allow all app_meta'
    `);
    assert(policies.rows.length === 0 && door.rows.length === 1, "the open door stays when a signed-in policy is missing");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current + `
      create policy gi_app_meta_all_authenticated on public.app_meta
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
