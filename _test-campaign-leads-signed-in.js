/**
 * The leads signed-in path is added beside the open door.
 * The role policies and the public delete block stay.
 * Run: node _test-campaign-leads-signed-in.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-campaign-leads-signed-in.sql"), "utf8");
const code = executable(sql);

console.log("1) the file adds one inert signed-in path");
assert(code.includes("create policy campaign_leads_all_authenticated"), "it adds the signed-in path");
assert(code.includes("on public.campaign_leads"), "the path is on the leads table");
assert(code.includes("for all") && code.includes("to authenticated") && code.includes("using (true)") && code.includes("with check (true)"), "a signed-in session can read and save");
assert((code.match(/create policy/gi) || []).length === 1, "it creates one policy");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security/i.test(code), "it does not turn row security on");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.campaign_leads|update public\.campaign_leads|delete from public\.campaign_leads/i.test(code), "it does not write a lead");
assert(!/phone|customer_name|id_number|description|assigned_agent/i.test(code), "lead fields are not selected");
assert(!/gi_agent_activity_log|gi_agent_appointment_report|gi_daily_report|gi_cancellations_report|public\.customers|public\.agents|public\.app_meta|public\.proposals/i.test(code), "other tables are not named");
assert(code.includes("open door is missing; nothing saved"), "a missing open door saves nothing");
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
    create table public.campaign_leads (id text primary key);
    create table public.gi_agent_activity_log (id text primary key);
    grant select, insert, update, delete on public.campaign_leads to anon, authenticated;
    grant select, insert on public.gi_agent_activity_log to authenticated;
    insert into public.campaign_leads(id) values ('active');
    insert into public.gi_agent_activity_log(id) values ('active');
    alter table public.gi_agent_activity_log enable row level security;
    create policy actlog_select_authenticated on public.gi_agent_activity_log
      for select to authenticated using (true);
  `;

  const current = `
    alter table public.campaign_leads enable row level security;
    create policy gi_campaign_leads_all_anon on public.campaign_leads
      for all to anon, authenticated using (true) with check (true);
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
    await db.exec(fixture + current);
    const first = await rowsOf(db);
    const bySection = Object.fromEntries(first.map((row) => [row.section, row.detail]));
    assert(bySection.table === "campaign_leads", "the result names the leads table");
    assert(bySection.rls_enabled === "yes", "row security stays on");
    assert(bySection.open_door === "yes", "the open door is still reported");
    assert(bySection.signed_in_all === "installed", "the signed-in path is installed");
    assert(bySection.anon_rows === "same", "anon still sees the same rows");
    assert(bySection.authenticated_rows === "same", "a session still sees the same rows");
    assert(bySection.lead_rows === "unchanged", "the stored leads are unchanged");
    assert(bySection.other_tables === "unchanged", "the activity log is unchanged");
    assert(bySection.role_policies === "kept" && bySection.anon_delete_block === "kept", "the role policies and the delete block stay");
    assert(bySection.access_changed === "no" && bySection.door_closed === "no", "access is unchanged and the door stays open");
    assert(bySection.open_policy === "gi_campaign_leads_all_anon", "the live open policy name is returned");
    const second = await rowsOf(db);
    const again = Object.fromEntries(second.map((row) => [row.section, row.detail]));
    assert(again.signed_in_all === "already_present", "a second run adds nothing");
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
      "gi_campaign_leads_all_anon",
      "z_block_anon_delete"
    ].join(","), "the open door and the role policies stay beside the new path");
    const log = await db.query(`select policyname from pg_policies where tablename = 'gi_agent_activity_log'`);
    assert(log.rows.length === 1 && log.rows[0].policyname === "actlog_select_authenticated", "the activity log stays");
    const stored = await db.query(`select count(*)::int as n from public.campaign_leads`);
    assert(stored.rows[0].n === 1, "the lead row was not rewritten");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.campaign_leads enable row level security;
      create policy campaign_leads_select_authenticated on public.campaign_leads
        for select to authenticated using (false);
      create policy campaign_leads_insert_authenticated on public.campaign_leads
        for insert to authenticated with check (false);
      create policy campaign_leads_update_authenticated on public.campaign_leads
        for update to authenticated using (false) with check (false);
      create policy campaign_leads_delete_authenticated on public.campaign_leads
        for delete to authenticated using (false);
      create policy z_block_anon_delete on public.campaign_leads
        for delete to anon using (false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/open door is missing; nothing saved/i.test(blocked), "a path without the open door saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'campaign_leads' and policyname = 'campaign_leads_all_authenticated'
    `);
    assert(policies.rows.length === 0, "the rejected path is not left behind");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current + `
      create policy campaign_leads_all_authenticated on public.campaign_leads
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
