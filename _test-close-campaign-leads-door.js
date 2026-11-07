/**
 * The public door on the leads table closes only when a signed-in session
 * still sees the same rows. The role policies and the public delete block stay.
 * Run: node _test-close-campaign-leads-door.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-close-campaign-leads-door.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes one named door");
assert(code.includes("drop policy gi_campaign_leads_all_anon on public.campaign_leads"), "it removes the named public door");
assert((code.match(/drop policy/gi) || []).length === 1, "it drops one policy");
assert(!code.includes("drop policy z_block_anon_delete"), "it does not drop the public delete block");
assert(!code.includes("drop policy campaign_leads_all_authenticated"), "it does not drop the signed-in path");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.campaign_leads|update public\.campaign_leads|delete from public\.campaign_leads/i.test(code), "it does not write a lead");
assert(!/campaign_leads_all_authenticated on public/i.test(code), "it does not recreate the signed-in path");
assert(!/phone|customer_name|id_number|description|assigned_agent/i.test(code), "lead fields are not selected");
assert(!/gi_agent_activity_log|gi_daily_report|gi_cancellations_report|public\.customers|public\.agents|public\.app_meta|public\.proposals/i.test(code), "other tables are not named");
assert(code.includes("signed-in rows changed; nothing saved"), "a signed-in count change saves nothing");
assert(code.includes("signed-in path is missing; nothing saved"), "a missing signed-in path saves nothing");
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
    create table public.campaign_leads (id text primary key);
    create table public.gi_agent_activity_log (id text primary key);
    grant select, insert, update, delete on public.campaign_leads to anon, authenticated;
    grant select on public.gi_agent_activity_log to authenticated;
    insert into public.campaign_leads(id) values ('active');
    insert into public.gi_agent_activity_log(id) values ('active');
    alter table public.gi_agent_activity_log enable row level security;
    create policy actlog_select_authenticated on public.gi_agent_activity_log
      for select to authenticated using (true);
  `;

  const kept = `
    create policy campaign_leads_all_authenticated on public.campaign_leads
      for all to authenticated using (true) with check (true);
    create policy z_block_anon_delete on public.campaign_leads
      for delete to anon using (false);
    create policy campaign_leads_select_authenticated on public.campaign_leads
      for select to authenticated using (false);
    create policy campaign_leads_insert_authenticated on public.campaign_leads
      for insert to authenticated with check (false);
    create policy campaign_leads_update_authenticated on public.campaign_leads
      for update to authenticated using (false) with check (false);
    create policy campaign_leads_delete_authenticated on public.campaign_leads
      for delete to authenticated using (false);
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.campaign_leads enable row level security;
      create policy gi_campaign_leads_all_anon on public.campaign_leads
        for all to anon, authenticated using (true) with check (true);
    ` + kept);
    const first = await rowsOf(db);
    const bySection = Object.fromEntries(first.map((row) => [row.section, row.detail]));
    assert(bySection.table === "campaign_leads", "the result names the leads table");
    assert(bySection.rls_enabled === "yes", "row security stays on");
    assert(bySection.authenticated_rows === "same", "a signed-in session still sees the same rows");
    assert(bySection.anon_rows === "hidden", "the public key no longer sees the rows");
    assert(bySection.lead_rows === "unchanged", "the stored leads are unchanged");
    assert(bySection.other_tables === "unchanged", "the activity log is unchanged");
    assert(bySection.policies_removed === "gi_campaign_leads_all_anon", "only the named door is removed");
    assert(bySection.signed_in_all === "kept" && bySection.role_policies === "kept" && bySection.anon_delete_block === "kept", "the signed-in path, role policies, and delete block stay");
    assert(bySection.door_closed === "yes", "the public door is closed");
    const second = await rowsOf(db);
    const again = Object.fromEntries(second.map((row) => [row.section, row.detail]));
    assert(again.policies_removed === "none" && again.anon_rows === "already_hidden", "a second run removes nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'campaign_leads'
      order by policyname
    `);
    assert(policies.rows.map((row) => row.policyname).join(",") === [
      "campaign_leads_all_authenticated",
      "campaign_leads_delete_authenticated",
      "campaign_leads_insert_authenticated",
      "campaign_leads_select_authenticated",
      "campaign_leads_update_authenticated",
      "z_block_anon_delete"
    ].join(","), "the signed-in policies remain and the public door does not");
    const log = await db.query(`select policyname from pg_policies where tablename = 'gi_agent_activity_log'`);
    assert(log.rows.length === 1 && log.rows[0].policyname === "actlog_select_authenticated", "the activity log stays");
    await db.exec("set role anon");
    const hidden = await db.query(`select count(*)::int as n from public.campaign_leads`);
    await db.exec("reset role");
    await db.exec("set role authenticated");
    const visible = await db.query(`select count(*)::int as n from public.campaign_leads`);
    await db.exec("reset role");
    assert(hidden.rows[0].n === 0 && visible.rows[0].n === 1, "anon sees nothing and the session still sees the row");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.campaign_leads enable row level security;
      create policy gi_campaign_leads_all_anon on public.campaign_leads
        for all to anon, authenticated using (true) with check (true);
    ` + kept.replace("create policy campaign_leads_all_authenticated on public.campaign_leads\n      for all to authenticated using (true) with check (true);\n    ", ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/signed-in path is missing; nothing saved/i.test(blocked), "a missing signed-in path saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'campaign_leads' and policyname = 'gi_campaign_leads_all_anon'
    `);
    assert(policies.rows.length === 1, "the public door stays when the signed-in path is missing");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.campaign_leads enable row level security;
      create policy gi_campaign_leads_all_anon on public.campaign_leads
        for all to anon, authenticated using (true) with check (true);
      create policy anon_extra on public.campaign_leads
        for select to anon using (true);
    ` + kept);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/anon door is still open; nothing saved/i.test(blocked), "a second public read saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'campaign_leads' and policyname = 'gi_campaign_leads_all_anon'
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
