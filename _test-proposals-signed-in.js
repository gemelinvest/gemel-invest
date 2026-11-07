/**
 * The proposals signed-in path is added beside the open door.
 * The four own policies stay.
 * Run: node _test-proposals-signed-in.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-proposals-signed-in.sql"), "utf8");
const code = executable(sql);

console.log("1) the file adds one inert signed-in path");
assert(code.includes("create policy gi_proposals_all_authenticated"), "it adds the signed-in path");
assert(code.includes("on public.proposals"), "the path is on the proposals table");
assert(code.includes("for all") && code.includes("to authenticated") && code.includes("using (true)") && code.includes("with check (true)"), "a signed-in session can read and save");
assert((code.match(/create policy/gi) || []).length === 1, "it creates one policy");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security/i.test(code), "it does not turn row security on");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.proposals|update public\.proposals|delete from public\.proposals/i.test(code), "it does not write a proposal");
assert(!/payload|customer_name|id_number|agent_name|phone/i.test(code), "proposal fields are not selected");
assert(!/campaign_leads|gi_agent_activity_log|gi_daily_report|gi_cancellations_report|public\.customers|public\.agents|public\.app_meta/i.test(code), "other tables are not named");
assert(!/create policy proposals_all_authenticated\b/i.test(code), "it does not use the name an older repair file drops");
assert(code.includes("open door is missing; nothing saved"), "a missing open door saves nothing");
assert(code.includes("own policies are missing; nothing saved"), "a missing own policy saves nothing");
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
    create table public.proposals (id text primary key);
    create table public.gi_agent_activity_log (id text primary key);
    grant select, insert, update, delete on public.proposals to anon, authenticated;
    grant select, insert on public.gi_agent_activity_log to authenticated;
    insert into public.proposals(id) values ('active');
    insert into public.gi_agent_activity_log(id) values ('active');
    alter table public.gi_agent_activity_log enable row level security;
    create policy actlog_select_authenticated on public.gi_agent_activity_log
      for select to authenticated using (true);
  `;

  const current = `
    alter table public.proposals enable row level security;
    create policy gi_proposals_restore_anon on public.proposals
      for all to anon, authenticated using (true) with check (true);
    create policy proposals_select_own on public.proposals
      for select to authenticated using (false);
    create policy proposals_insert_own on public.proposals
      for insert to authenticated with check (false);
    create policy proposals_update_own on public.proposals
      for update to authenticated using (false) with check (false);
    create policy proposals_delete_own on public.proposals
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
    assert(bySection.table === "proposals", "the result names the proposals table");
    assert(bySection.rls_enabled === "yes", "row security stays on");
    assert(bySection.open_door === "yes", "the open door is still reported");
    assert(bySection.signed_in_all === "installed", "the signed-in path is installed");
    assert(bySection.anon_rows === "same", "anon still sees the same rows");
    assert(bySection.authenticated_rows === "same", "a session still sees the same rows");
    assert(bySection.proposal_rows === "unchanged", "the stored proposals are unchanged");
    assert(bySection.other_tables === "unchanged", "the activity log is unchanged");
    assert(bySection.own_policies === "kept", "the own policies stay");
    assert(bySection.access_changed === "no" && bySection.door_closed === "no", "access is unchanged and the door stays open");
    assert(bySection.open_policy === "gi_proposals_restore_anon", "the live open policy name is returned");
    const second = await rowsOf(db);
    const again = Object.fromEntries(second.map((row) => [row.section, row.detail]));
    assert(again.signed_in_all === "already_present", "a second run adds nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'proposals'
      order by policyname
    `);
    assert(policies.rows.map((row) => row.policyname).join(",") === [
      "gi_proposals_all_authenticated",
      "gi_proposals_restore_anon",
      "proposals_delete_own",
      "proposals_insert_own",
      "proposals_select_own",
      "proposals_update_own"
    ].join(","), "the open door and the own policies stay beside the new path");
    const log = await db.query(`select policyname from pg_policies where tablename = 'gi_agent_activity_log'`);
    assert(log.rows.length === 1 && log.rows[0].policyname === "actlog_select_authenticated", "the activity log stays");
    const stored = await db.query(`select count(*)::int as n from public.proposals`);
    assert(stored.rows[0].n === 1, "the proposal row was not rewritten");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + `
      alter table public.proposals enable row level security;
      create policy proposals_select_own on public.proposals
        for select to authenticated using (false);
      create policy proposals_insert_own on public.proposals
        for insert to authenticated with check (false);
      create policy proposals_update_own on public.proposals
        for update to authenticated using (false) with check (false);
      create policy proposals_delete_own on public.proposals
        for delete to authenticated using (false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/open door is missing; nothing saved/i.test(blocked), "a path without the open door saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'proposals' and policyname = 'gi_proposals_all_authenticated'
    `);
    assert(policies.rows.length === 0, "the rejected path is not left behind");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current.replace("create policy proposals_select_own on public.proposals\n      for select to authenticated using (false);\n    ", ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/own policies are missing; nothing saved/i.test(blocked), "a missing own policy saves nothing");
    const policies = await db.query(`
      select policyname from pg_policies
      where tablename = 'proposals' and policyname = 'gi_proposals_all_authenticated'
    `);
    const door = await db.query(`
      select policyname from pg_policies
      where tablename = 'proposals' and policyname = 'gi_proposals_restore_anon'
    `);
    assert(policies.rows.length === 0 && door.rows.length === 1, "the open door stays when an own policy is missing");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current + `
      create policy gi_proposals_all_authenticated on public.proposals
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
