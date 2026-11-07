/**
 * The referrals, perf events, and devices check only reports policy names.
 * It does not add or remove one.
 * Run: node _test-elem-perf-devices-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-elem-perf-devices-status.sql"), "utf8");
const code = executable(sql);
const readable = code.replace(/\$body\$/g, "");

console.log("1) the file only reads three tables");
["gi_elementary_referrals", "gi_perf_events", "owner_devices"].forEach((name) => {
  assert(code.includes(name), "it looks at " + name);
});
assert(!/create policy/i.test(code), "it does not create a policy");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a stored row");
assert(!/\b(payload|phone|email|pin|agent_name|body|token)\b/i.test(readable), "stored fields are not selected");
assert(!/public\.agents|public\.app_meta|public\.customers|public\.proposals|gi_chat_messages|gi_simulator_saves|public\.reminders/i.test(code), "other tables are not named");

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

  function groups(rows){
    const out = [];
    let current = null;
    rows.forEach((row) => {
      if(row.section === "table"){
        current = { table: row.detail, rows: [] };
        out.push(current);
      }
      if(current) current.rows.push(row);
    });
    return out;
  }

  {
    const db = new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create table public.gi_elementary_referrals (id text primary key);
      create table public.gi_perf_events (id text primary key);
      create table public.owner_devices (id text primary key);
      create table public.notes (id text primary key);
      insert into public.gi_elementary_referrals(id) values ('active');
      alter table public.gi_elementary_referrals enable row level security;
      alter table public.gi_perf_events enable row level security;
      alter table public.notes enable row level security;
      create policy gi_elem_ref_all on public.gi_elementary_referrals
        for all to anon, authenticated using (true) with check (true);
      create policy elem_ref_select_authenticated on public.gi_elementary_referrals
        for select to authenticated using (false);
      create policy gi_perf_events_select_authenticated on public.gi_perf_events
        for all to public using (true) with check (true);
      create policy notes_select_own on public.notes
        for select to authenticated using (true);
    `);
    const grouped = groups(await rowsOf(db));
    assert(grouped.map((group) => group.table).join(",") === "gi_elementary_referrals,gi_perf_events,owner_devices", "the three tables are reported in order");
    const referrals = Object.fromEntries(grouped[0].rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
    const perf = Object.fromEntries(grouped[1].rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
    const devices = Object.fromEntries(grouped[2].rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
    assert(referrals.rls_enabled === "yes" && referrals.rows_present === "yes" && referrals.open_read === "yes" && referrals.changed === "no", "referrals are reported without a change");
    assert(grouped[0].rows.some((row) => row.detail === "gi_elementary_referrals|gi_elem_ref_all|ALL|public+signed_in|open"), "the open referrals door is named");
    assert(grouped[0].rows.some((row) => row.detail === "gi_elementary_referrals|elem_ref_select_authenticated|SELECT|signed_in|limited"), "a signed-in referrals limit is named");
    assert(perf.rls_enabled === "yes" && perf.rows_present === "no" && perf.open_read === "yes" && perf.changed === "no", "perf events keep their reported open read");
    assert(devices.rls_enabled === "no" && devices.open_read === "no" && devices.changed === "no", "devices are reported and row security is not switched on");
    assert(!grouped.some((group) => group.rows.some((row) => String(row.detail).includes("notes_select_own"))), "another table is not listed");
    const policies = await db.query(`select count(*)::int as n from pg_policies where tablename in ('gi_elementary_referrals', 'gi_perf_events', 'owner_devices')`);
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(policies.rows[0].n === 3, "the check does not add a policy");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.gi_elementary_referrals (id text primary key);
      create table public.owner_devices (id text primary key);
    `);
    const grouped = groups(await rowsOf(db));
    const perf = grouped.find((group) => group.table === "gi_perf_events");
    const bySection = Object.fromEntries(perf.rows.map((row) => [row.section, row.detail]));
    assert(bySection.present === "no" && bySection.changed === "no", "a missing table is reported and the others are still read");
    assert(grouped.filter((group) => group.table !== "gi_perf_events").every((group) => group.rows.some((row) => row.section === "rls_enabled")), "the tables that exist are still described");
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
