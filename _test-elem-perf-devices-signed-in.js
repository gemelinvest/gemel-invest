/**
 * Signed-in paths are added beside the open doors on referrals, perf events, and devices.
 * Run: node _test-elem-perf-devices-signed-in.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-elem-perf-devices-signed-in.sql"), "utf8");
const code = executable(sql);
const readable = code.replace(/\$body\$/g, "");

console.log("1) the file adds three inert signed-in paths");
assert(code.includes("create policy gi_elementary_referrals_all_authenticated"), "it adds the referrals path");
assert(code.includes("create policy gi_perf_events_all_authenticated"), "it adds the perf events path");
assert(code.includes("create policy owner_devices_all_authenticated"), "it adds the devices path");
assert((code.match(/create policy/gi) || []).length === 3, "it creates three policies");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security/i.test(code), "it does not turn row security on");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a stored row");
assert(!/\b(payload|phone|email|pin|agent_name|body|token)\b/i.test(readable), "stored fields are not selected");
assert(!/public\.agents|public\.app_meta|public\.customers|public\.proposals|public\.reminders/i.test(code), "other business tables are not named");
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
    create table public.gi_elementary_referrals (id text primary key);
    create table public.gi_perf_events (id text primary key);
    create table public.owner_devices (id text primary key);
    create table public.notes (id text primary key);
    grant select, insert, update, delete on public.gi_elementary_referrals to anon, authenticated;
    grant select, insert, update, delete on public.gi_perf_events to anon, authenticated;
    grant select, insert, update, delete on public.owner_devices to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.gi_elementary_referrals(id) values ('active');
    alter table public.gi_elementary_referrals enable row level security;
    alter table public.gi_perf_events enable row level security;
    alter table public.owner_devices enable row level security;
    alter table public.notes enable row level security;
    create policy notes_select_own on public.notes
      for select to authenticated using (true);
  `;

  const current = `
    create policy gi_elem_ref_all on public.gi_elementary_referrals
      for all to public using (true) with check (true);
    create policy gi_elem_ref_restore_anon on public.gi_elementary_referrals
      for all to anon, authenticated using (true) with check (true);
    create policy elem_ref_select_authenticated on public.gi_elementary_referrals
      for select to authenticated using (false);
    create policy elem_ref_insert_authenticated on public.gi_elementary_referrals
      for insert to authenticated with check (false);
    create policy elem_ref_update_authenticated on public.gi_elementary_referrals
      for update to authenticated using (false) with check (false);
    create policy z_block_anon_delete on public.gi_elementary_referrals
      for delete to anon using (false);
    create policy gi_perf_events_select_authenticated on public.gi_perf_events
      for select to anon, authenticated using (true);
    create policy gi_perf_events_insert_authenticated on public.gi_perf_events
      for insert to anon, authenticated with check (true);
    create policy gi_perf_events_restore_anon on public.gi_perf_events
      for all to anon, authenticated using (true) with check (true);
    create policy perf_events_select_authenticated on public.gi_perf_events
      for select to authenticated using (true);
    create policy perf_events_insert_authenticated on public.gi_perf_events
      for insert to authenticated with check (false);
    create policy owner_devices_open_insert_for_mvp on public.owner_devices
      for insert to anon, authenticated with check (true);
    create policy owner_devices_open_update_for_mvp on public.owner_devices
      for update to anon, authenticated using (true) with check (true);
    create policy owner_devices_restore_anon on public.owner_devices
      for all to anon, authenticated using (true) with check (true);
    create policy owner_devices_select_authenticated on public.owner_devices
      for select to authenticated using (false);
    create policy owner_devices_insert_authenticated on public.owner_devices
      for insert to authenticated with check (false);
    create policy owner_devices_update_authenticated on public.owner_devices
      for update to authenticated using (false) with check (false);
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
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.filter((row) => row.startsWith("table=")).join(",") === "table=gi_elementary_referrals,table=gi_perf_events,table=owner_devices", "the three tables are named");
    assert(details.filter((row) => row === "signed_in_all=installed").length === 3, "the three signed-in paths are installed");
    assert(details.filter((row) => row === "anon_rows=same").length === 3, "anon still sees the same rows");
    assert(details.filter((row) => row === "authenticated_rows=same").length === 3, "a session still sees the same rows");
    assert(details.includes("limited_policies=kept") && details.includes("delete_block=kept") && details.includes("other_tables=unchanged"), "limits, the delete block, and other tables stay");
    assert(details.includes("open_doors=kept") && details.includes("access_changed=no") && details.includes("door_closed=no"), "the public doors stay open");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.filter((row) => row === "signed_in_all=already_present").length === 3, "a second run adds nothing");
    const doors = await db.query(`select policyname from pg_policies where policyname in ('gi_elem_ref_all', 'gi_perf_events_restore_anon', 'owner_devices_restore_anon', 'z_block_anon_delete') order by policyname`);
    assert(doors.rows.map((row) => row.policyname).join(",") === "gi_elem_ref_all,gi_perf_events_restore_anon,owner_devices_restore_anon,z_block_anon_delete", "the public doors and the delete block stay");
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
    const stored = await db.query(`select count(*)::int as n from public.gi_elementary_referrals`);
    assert(stored.rows[0].n === 1, "the referral row was not rewritten");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current.replace("create policy gi_elem_ref_all on public.gi_elementary_referrals\n      for all to public using (true) with check (true);\n    ", ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/open referrals door is missing; nothing saved/i.test(blocked), "a missing referrals door saves nothing");
    const added = await db.query(`select policyname from pg_policies where policyname = 'gi_perf_events_all_authenticated'`);
    assert(added.rows.length === 0, "the rejected path is not left behind");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current + `
      create policy gi_elementary_referrals_all_authenticated on public.gi_elementary_referrals
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
