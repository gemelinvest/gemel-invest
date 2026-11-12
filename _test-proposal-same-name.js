/**
 * A proposal stored under the agent's exact name stays on their proposals screen,
 * even when its agent_id points at another row. Run: node _test-proposal-same-name.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start + startMark.length);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-proposal-same-name-read.sql"), "utf8");

console.log("1) the proposals screen keeps a same-name draft");
const owned = sliceBetween(app, "function customerOwnedByCurrentAgent(rec){", "function normalizeTeamManagerAssignmentsMap(raw){");
assert(owned.indexOf("recordAgentNameEqualsSessionAgent(rec)") >= 0, "ownership checks the exact agent name");
assert(
  owned.indexOf("recordAgentNameEqualsSessionAgent(rec)") < owned.indexOf("recordExplicitlyAssignedToOtherActiveAgent"),
  "the exact name is accepted before another agent id hides the proposal"
);

const nameFns = sliceBetween(app, "function recordAgentNameCandidates(rec){", "function recordAgentKeyCandidates(rec){")
  + sliceBetween(app, "function recordAgentNameEqualsSessionAgent(rec){", "function customerOwnedByCurrentAgent(rec){");
const box = {
  Auth: { current: { id: "live", name: "אבישג פדידה", username: "אבישג" } },
  findAgentRecordForSession: () => ({ id: "live", name: "אבישג פדידה", username: "אבישג" })
};
vm.runInNewContext(
  "const safeTrim = (v) => String(v ?? \"\").trim();\n" + nameFns + "\nthis.same = recordAgentNameEqualsSessionAgent;",
  box
);
const same = box.same;
assert(same({ agentName: "אבישג פדידה", agentId: "stale" }) === true, "שובל רדעי matches אבישג פדידה");
assert(same({ agentName: "אביאל אלקיים", agentId: "other" }) === false, "a different full name does not match");
assert(same({ agentName: "אבישג", agentId: "other" }) === true, "the username still matches an exact short name");

console.log("\n2) the select rule can be added onto the existing policy");
assert(sql.includes("alter policy proposals_select_own"), "it updates the select policy");
assert(sql.includes("btrim(me.name)"), "it matches the stored agent name");
assert(!/update\s+public\.proposals/i.test(sql), "it does not edit proposal rows");
assert(!/delete\s+from\s+public\.proposals/i.test(sql), "it does not delete proposal rows");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n3) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n3) database fixture");
  const db = new PGlite();
  await db.exec(`
    create role authenticated nologin;
    grant usage on schema public to authenticated;
    create table public.agents (id text primary key, name text, username text);
    create table public.proposals (
      id text primary key,
      agent_id text,
      agent_name text,
      phone text
    );
    grant select on public.agents to authenticated;
    grant select, insert, update, delete on public.proposals to authenticated;
    insert into public.agents(id, name, username) values
      ('live', 'אבישג פדידה', 'אבישג'),
      ('stale', 'אבישג פדידה', 'old');
    insert into public.proposals(id, agent_id, agent_name, phone) values
      ('shoval', 'stale', 'אבישג פדידה', '1'),
      ('other', 'someone', 'נציג אחר', '2');
    alter table public.proposals enable row level security;
    create function public.gi_jwt_agent_id() returns text language sql stable as $$
      select coalesce(current_setting('gi.test_agent', true), '')
    $$;
    create policy proposals_select_own on public.proposals
      for select to authenticated
      using (
        public.gi_jwt_agent_id() <> ''
        and coalesce(agent_id, '') = public.gi_jwt_agent_id()
      );
    create policy proposals_update_own on public.proposals
      for update to authenticated
      using (coalesce(agent_id, '') = public.gi_jwt_agent_id())
      with check (coalesce(agent_id, '') = public.gi_jwt_agent_id());
  `);
  await db.exec("set role authenticated");
  await db.exec("select set_config('gi.test_agent', 'live', false)");
  const before = await db.query("select id from public.proposals order by id");
  await db.exec("reset role");
  assert(before.rows.map((row) => row.id).join(",") === "", "the old rule hides a proposal stored on the other row");

  const out = await db.exec(sql);
  const last = out[out.length - 1];
  const details = (last.rows || []).map((row) => row.section + "=" + row.detail);
  assert(details.includes("select_policy=upgraded") && details.includes("changed=yes"), "the select rule gains the exact name");

  await db.exec("set role authenticated");
  await db.exec("select set_config('gi.test_agent', 'live', false)");
  const after = await db.query("select id from public.proposals order by id");
  await db.exec("update public.proposals set phone = 'saved' where id = 'shoval'");
  await db.exec("update public.proposals set phone = 'no' where id = 'other'");
  await db.exec("reset role");
  assert(after.rows.map((row) => row.id).join(",") === "shoval", "אבישג sees שובל רדעי and not another agent");
  const phones = await db.query("select id, phone from public.proposals order by id");
  const phoneOf = (id) => (phones.rows.find((row) => row.id === id) || {}).phone;
  assert(phoneOf("shoval") === "saved", "she can keep editing that proposal");
  assert(phoneOf("other") === "2", "another agent's proposal stays unchanged");

  const again = await db.exec(sql);
  const second = (again[again.length - 1].rows || []).map((row) => row.section + "=" + row.detail);
  assert(second.includes("changed=no") && second.includes("select_policy=kept"), "a second run leaves the rule alone");
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
