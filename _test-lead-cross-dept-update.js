/**
 * An additional assignee can update a lead whose primary agent is someone else.
 * Read access alone is not enough — UPDATE must gain the same peer matches.
 * Run: node _test-lead-cross-dept-update.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-lead-cross-dept-update.sql"), "utf8");
const code = sql
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

console.log("1) the file only extends the existing update rule");
assert(code.includes("alter policy campaign_leads_update_authenticated"), "it updates the update policy");
assert(code.includes('\'"id":"\''), "it matches the stored agent id");
assert(code.includes('\'"name":"\''), "it matches the stored agent name");
assert(!/update\s+public\.campaign_leads/i.test(code), "it does not edit lead rows");
assert(!/delete\s+from\s+public\.campaign_leads/i.test(code), "it does not delete lead rows");
assert(!/drop policy campaign_leads_select_authenticated/i.test(code), "it leaves the select policy");
assert(!/drop policy campaign_leads_insert_authenticated/i.test(code), "it leaves the insert policy");
assert(!/drop policy campaign_leads_delete_authenticated/i.test(code), "it leaves the delete policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(/No INSERT\/DELETE widening/i.test(sql), "comments keep write bounds");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");

  const helpers = `
    create function public.gi_jwt_agent_id() returns text language sql stable as $$
      select coalesce(current_setting('gi.test_agent', true), '')
    $$;
  `;

  function setup(extraPolicy){
    return `
      create role anon nologin;
      create role authenticated nologin;
      grant usage on schema public to anon, authenticated;
      create table public.agents (id text primary key, name text);
      create table public.campaign_leads (
        id text primary key,
        assigned_agent_id text,
        description text,
        phone text
      );
      grant select on public.agents to authenticated;
      grant select, insert, update, delete on public.campaign_leads to authenticated;
      insert into public.agents(id, name) values ('elem1', 'Ilan'), ('a2', 'Liron');
      insert into public.campaign_leads(id, assigned_agent_id, description, phone) values
        ('by-id', 'a2', '{"additionalAgents":[{"id":"elem1","name":"Ilan"}]}', '1'),
        ('by-name', 'a2', '{"additionalAgents":[{"id":"stale","name":"Ilan"}]}', '2'),
        ('other', 'a2', '{"additionalAgents":[{"id":"someone","name":"Other"}]}', '3'),
        ('mine', 'elem1', 'primary', '4');
      alter table public.campaign_leads enable row level security;
      ${helpers}
      ${extraPolicy}
      create policy campaign_leads_select_authenticated on public.campaign_leads
        for select to authenticated using (true);
    `;
  }

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  async function asIlan(db){
    await db.exec("set role authenticated");
    await db.exec("select set_config('gi.test_agent', 'elem1', false)");
  }

  async function phoneOf(db, id){
    const out = await db.query(`select phone from public.campaign_leads where id = '${id}'`);
    return out.rows[0] && out.rows[0].phone;
  }

  async function tryUpdate(db, id, phone){
    try {
      await db.exec(`update public.campaign_leads set phone = '${phone}' where id = '${id}'`);
    } catch(_e) {}
  }

  {
    const db = new PGlite();
    await db.exec(setup(`
      create policy campaign_leads_update_authenticated on public.campaign_leads
        for update to authenticated
        using (
          public.gi_jwt_agent_id() <> ''
          and coalesce(assigned_agent_id, '') = public.gi_jwt_agent_id()
        )
        with check (
          public.gi_jwt_agent_id() <> ''
          and coalesce(assigned_agent_id, '') = public.gi_jwt_agent_id()
        );
    `));
    await asIlan(db);
    await tryUpdate(db, "by-id", "x");
    await tryUpdate(db, "mine", "ok");
    await db.exec("reset role");
    assert((await phoneOf(db, "by-id")) === "1", "the old rule blocks a peer assignee update");
    assert((await phoneOf(db, "mine")) === "ok", "the old rule still lets the primary assignee update");

    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("update_policy=upgraded") && details.includes("changed=yes"), "the old update rule gains the cross-department write");

    await asIlan(db);
    await tryUpdate(db, "by-id", "saved-id");
    await tryUpdate(db, "by-name", "saved-name");
    await tryUpdate(db, "other", "nope");
    await tryUpdate(db, "mine", "still");
    await db.exec("reset role");
    assert((await phoneOf(db, "by-id")) === "saved-id", "Ilan can update a lead that stores his agent id");
    assert((await phoneOf(db, "by-name")) === "saved-name", "Ilan can update a lead stored under his name");
    assert((await phoneOf(db, "other")) === "3", "another agent's lead stays blocked for update");
    assert((await phoneOf(db, "mine")) === "still", "his own primary lead stays writable");

    const selectKept = await db.query("select count(*)::int as n from pg_policies where policyname = 'campaign_leads_select_authenticated'");
    assert(selectKept.rows[0].n === 1, "the select policy stays");

    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("changed=no") && again.includes("update_policy=kept"), "a second run leaves the update rule alone");
  }

  {
    const db = new PGlite();
    await db.exec(setup(`
      create policy campaign_leads_update_authenticated on public.campaign_leads
        for update to authenticated
        using (
          public.gi_jwt_agent_id() <> ''
          and coalesce(assigned_agent_id, '') = public.gi_jwt_agent_id()
        )
        with check (true);
    `));
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("update_policy=upgraded"), "an open with-check policy still upgrades USING");
    await asIlan(db);
    await tryUpdate(db, "by-id", "open-check");
    await db.exec("reset role");
    assert((await phoneOf(db, "by-id")) === "open-check", "peer update works when with check is already open");
  }

  {
    const db = new PGlite();
    await db.exec(setup(`
      create policy campaign_leads_all_authenticated on public.campaign_leads
        for all to authenticated using (true) with check (true);
    `));
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("update_policy=open") && details.includes("changed=no"), "an open signed-in policy is left in place");
  }

  {
    const db = new PGlite();
    await db.exec(setup(""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/update policy is missing; nothing saved/i.test(blocked), "a missing update policy saves nothing");
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
