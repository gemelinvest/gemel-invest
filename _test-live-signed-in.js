/**
 * Signed-in write paths are added beside the open doors on presence and ops events.
 * System notices are not changed.
 * Run: node _test-live-signed-in.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-live-signed-in.sql"), "utf8");
const code = executable(sql);
const readable = code.replace(/\$body\$/g, "");

console.log("1) the file adds three inert signed-in paths");
assert(code.includes("create policy gi_agent_live_insert_open"), "it adds the presence insert path");
assert(code.includes("create policy gi_agent_live_update_open"), "it adds the presence update path");
assert(code.includes("create policy gi_ops_events_all_authenticated"), "it adds the ops events path");
assert((code.match(/create policy/gi) || []).length === 3, "it creates three policies");
assert(!/drop policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security/i.test(code), "it does not turn row security on");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a stored row");
assert(!/\b(payload|phone|email|pin|agent_name|body|name)\b/i.test(readable), "stored fields are not selected");
assert(!/public\.agents|public\.app_meta|public\.customers|public\.proposals|gi_chat_messages/i.test(code), "other business tables are not named");
assert(code.includes("row visibility changed; nothing saved"), "a visibility change saves nothing");
assert(code.includes("notices changed; nothing saved"), "a notices change saves nothing");

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
    create table public.gi_agent_live (id text primary key);
    create table public.gi_ops_events (id text primary key);
    create table public.gi_system_notices (id text primary key);
    create table public.notes (id text primary key);
    grant select, insert, update, delete on public.gi_agent_live to anon, authenticated;
    grant select, insert, update, delete on public.gi_ops_events to anon, authenticated;
    grant select on public.gi_system_notices to authenticated;
    grant select on public.notes to authenticated;
    insert into public.gi_agent_live(id) values ('active');
    insert into public.gi_ops_events(id) values ('active');
    insert into public.notes(id) values ('active');
    alter table public.gi_agent_live enable row level security;
    alter table public.gi_ops_events enable row level security;
    alter table public.gi_system_notices enable row level security;
    alter table public.notes enable row level security;
    create policy notes_select_own on public.notes
      for select to authenticated using (true);
    create policy system_notices_select_authenticated on public.gi_system_notices
      for select to authenticated using (true);
  `;

  const current = `
    create policy gi_agent_live_read on public.gi_agent_live
      for select to anon using (true);
    create policy gi_agent_live_upsert on public.gi_agent_live
      for insert to anon with check (true);
    create policy gi_agent_live_update on public.gi_agent_live
      for update to anon using (true) with check (true);
    create policy agent_live_select_authenticated on public.gi_agent_live
      for select to authenticated using (true);
    create policy agent_live_upsert_authenticated on public.gi_agent_live
      for insert to authenticated with check (false);
    create policy agent_live_update_authenticated on public.gi_agent_live
      for update to authenticated using (false) with check (false);
    create policy gi_ops_ev_all on public.gi_ops_events
      for all to public using (true) with check (true);
    create policy gi_ops_ev_restore_anon on public.gi_ops_events
      for all to anon, authenticated using (true) with check (true);
    create policy ops_ev_select_authenticated on public.gi_ops_events
      for select to authenticated using (false);
    create policy ops_ev_insert_authenticated on public.gi_ops_events
      for insert to authenticated with check (false);
    create policy z_block_anon_delete on public.gi_ops_events
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
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("table=gi_agent_live") && details.includes("table=gi_ops_events"), "both tables are named");
    assert(details.includes("insert_policy=installed") && details.includes("update_policy=installed"), "the presence write paths are installed");
    assert(details.includes("signed_in_all=installed"), "the ops events path is installed");
    assert(details.filter((row) => row === "anon_rows=same").length === 2, "anon still sees the same rows");
    assert(details.filter((row) => row === "authenticated_rows=same").length === 2, "a session still sees the same rows");
    assert(details.includes("notices=unchanged") && details.includes("other_tables=unchanged"), "notices and other tables stay");
    assert(details.includes("open_doors=kept") && details.includes("access_changed=no") && details.includes("door_closed=no"), "the public doors stay open");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("insert_policy=already_present") && again.includes("update_policy=already_present") && again.includes("signed_in_all=already_present"), "a second run adds nothing");
    const live = await db.query(`select policyname from pg_policies where tablename = 'gi_agent_live' and policyname in ('gi_agent_live_insert_open', 'gi_agent_live_update_open', 'gi_agent_live_read') order by policyname`);
    assert(live.rows.map((row) => row.policyname).join(",") === "gi_agent_live_insert_open,gi_agent_live_read,gi_agent_live_update_open", "the presence door stays beside the new paths");
    const notices = await db.query(`select policyname from pg_policies where tablename = 'gi_system_notices'`);
    assert(notices.rows.length === 1 && notices.rows[0].policyname === "system_notices_select_authenticated", "notices stay");
    const notes = await db.query(`select policyname from pg_policies where tablename = 'notes'`);
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
    const stored = await db.query(`select count(*)::int as n from public.gi_agent_live`);
    assert(stored.rows[0].n === 1, "the presence row was not rewritten");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current.replace("create policy gi_agent_live_read on public.gi_agent_live\n      for select to anon using (true);\n    ", ""));
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/open presence read is missing; nothing saved/i.test(blocked), "a missing presence door saves nothing");
    const added = await db.query(`select policyname from pg_policies where policyname = 'gi_ops_events_all_authenticated'`);
    assert(added.rows.length === 0, "the rejected path is not left behind");
  }

  {
    const db = new PGlite();
    await db.exec(fixture + current + `
      create policy gi_ops_events_all_authenticated on public.gi_ops_events
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
