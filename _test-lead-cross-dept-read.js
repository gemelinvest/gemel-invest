/**
 * An additional assignee can read a lead whose primary agent is someone else.
 * Run: node _test-lead-cross-dept-read.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-lead-cross-dept-read.sql"), "utf8");
const code = sql
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

console.log("1) the file only extends the existing select rule");
assert(code.includes("alter policy campaign_leads_select_authenticated"), "it updates the select policy");
assert(code.includes('\'"id":"\''), "it matches the stored agent id");
assert(code.includes('\'"name":"\''), "it matches the stored agent name");
assert(!/update\s+public\.campaign_leads/i.test(code), "it does not edit lead rows");
assert(!/delete\s+from\s+public\.campaign_leads/i.test(code), "it does not delete lead rows");
assert(!/drop policy campaign_leads_update_authenticated/i.test(code), "it leaves the update policy");

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
      create policy campaign_leads_update_authenticated on public.campaign_leads
        for update to authenticated using (true) with check (true);
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

  async function idsForIlan(db){
    await asIlan(db);
    const seen = await db.query("select id from public.campaign_leads order by id");
    await db.exec("reset role");
    return seen.rows.map((row) => row.id);
  }

  {
    const db = new PGlite();
    await db.exec(setup(`
      create policy campaign_leads_select_authenticated on public.campaign_leads
        for select to authenticated
        using (
          public.gi_jwt_agent_id() <> ''
          and coalesce(assigned_agent_id, '') = public.gi_jwt_agent_id()
        );
    `));
    const before = await idsForIlan(db);
    assert(before.indexOf("mine") >= 0 && before.indexOf("by-name") < 0, "the old rule shows only the primary assignment");
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("select_policy=upgraded") && details.includes("changed=yes"), "the old select rule gains the cross-department read");
    const after = await idsForIlan(db);
    assert(after.indexOf("by-id") >= 0, "Ilan can read a lead that stores his agent id");
    assert(after.indexOf("by-name") >= 0, "Ilan can read a lead stored under his name");
    assert(after.indexOf("other") < 0, "another agent's lead stays hidden");
    assert(after.indexOf("mine") >= 0, "his own primary lead stays visible");
    const writes = await db.query("select count(*)::int as n from pg_policies where policyname = 'campaign_leads_update_authenticated'");
    assert(writes.rows[0].n === 1, "the update policy stays");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("changed=no") && again.includes("select_policy=kept"), "a second run leaves the read rule alone");
  }

  {
    const db = new PGlite();
    await db.exec(setup(`
      create policy campaign_leads_select_authenticated on public.campaign_leads
        for select to authenticated
        using (
          public.gi_jwt_agent_id() <> ''
          and coalesce(assigned_agent_id, '') = public.gi_jwt_agent_id()
          or strpos(coalesce(description, ''), '"id":"' || public.gi_jwt_agent_id() || '"') > 0
        );
    `));
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("changed=yes"), "a policy that already matches the agent id gains the name match");
    const after = await idsForIlan(db);
    assert(after.indexOf("by-name") >= 0 && after.indexOf("other") < 0, "the name match is added without opening other leads");
  }

  {
    const db = new PGlite();
    await db.exec(setup(`
      create policy campaign_leads_all_authenticated on public.campaign_leads
        for all to authenticated using (true) with check (true);
    `));
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("select_policy=open") && details.includes("changed=no"), "an open signed-in policy is left in place");
  }

  {
    const db = new PGlite();
    await db.exec(setup(""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/select policy is missing; nothing saved/i.test(blocked), "a missing select policy saves nothing");
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
