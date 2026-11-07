/**
 * App settings stay readable by every signed-in person. A person can save
 * the shared row and a notification row. A manager can write every row.
 * The open signed-in path is removed, and the public delete block stays.
 * Run: node _test-app-meta-by-role.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-app-meta-by-role.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes the open write and keeps boot reading");
assert(code.includes("drop policy gi_app_meta_all_authenticated"), "it removes the open path");
assert(!code.includes("drop policy app_meta_select_authenticated"), "it leaves the boot read in place");
assert(!code.includes("drop policy z_block_anon_delete"), "it leaves the public delete block");
assert(code.includes("coalesce(key, '') = 'global'"), "a person can still save the shared row");
assert(code.includes("starts_with(coalesce(key, ''), 'onyxsub_')"), "a person can still save a notification row");
assert(code.includes("gi_jwt_is_manager()"), "a manager can still write every row");
assert(!code.includes("coalesce(key, '') = ''"), "it does not leave a blank key open");
assert(!/from\s+public\.app_meta/i.test(code), "it does not read a setting");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/public\.customers|public\.proposals|public\.agents|gi_agent_live|owner_devices/i.test(code), "other tables are not named");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");

  const base = `
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public to anon, authenticated;
    create function public.gi_jwt_agent_id() returns text language sql stable as $$
      select coalesce(current_setting('gi.test_agent', true), '')
    $$;
    create function public.gi_jwt_is_manager() returns boolean language sql stable as $$
      select coalesce(current_setting('gi.test_manager', true), '') = 'yes'
    $$;
    create table public.app_meta (
      key text primary key,
      payload jsonb,
      updated_at timestamptz
    );
    create table public.notes (id text primary key);
    grant select, insert, update, delete on public.app_meta to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.app_meta(key, payload) values
      ('global', '{"hello":1}'),
      ('app_version', '{"version":"1"}'),
      ('onyx_push_vapid_public', '{"publicKey":"mark"}');
    alter table public.app_meta enable row level security;
    alter table public.notes enable row level security;
    create policy notes_select_own on public.notes for select to authenticated using (true);
    create policy gi_app_meta_all_authenticated on public.app_meta
      for all to authenticated using (true) with check (true);
    create policy app_meta_select_authenticated on public.app_meta
      for select to authenticated using (true);
    create policy app_meta_insert_authenticated on public.app_meta
      for insert to authenticated with check (public.gi_jwt_is_manager());
    create policy app_meta_update_authenticated on public.app_meta
      for update to authenticated
      using (public.gi_jwt_is_manager()) with check (public.gi_jwt_is_manager());
    create policy app_meta_delete_authenticated on public.app_meta
      for delete to authenticated using (public.gi_jwt_is_manager());
    create policy z_block_anon_delete on public.app_meta
      for delete to public using (false);
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  async function asUser(db, agent, manager){
    await db.exec("set role authenticated");
    await db.exec("select set_config('gi.test_agent', '" + agent + "', false)");
    await db.exec("select set_config('gi.test_manager', '" + (manager ? "yes" : "") + "', false)");
  }

  {
    const db = new PGlite();
    await db.exec(base);
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("policies_removed=gi_app_meta_all_authenticated"), "the open path is removed");
    assert(details.includes("select_by_role=open_kept") && details.includes("write_by_role=installed"), "reading stays open and writing is installed");
    assert(details.includes("blank_key=closed") && details.includes("anon_delete_block=kept"), "the blank path is closed and the delete block stays");
    assert(details.includes("other_tables=unchanged") && details.includes("changed=yes"), "the cut is reported");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.includes("changed=no"), "a second run removes nothing");

    await db.exec("set role anon");
    const anonRead = await db.query("select count(*)::int as n from public.app_meta");
    await db.exec("delete from public.app_meta where key = 'global'");
    await db.exec("reset role");
    const afterAnon = await db.query("select count(*)::int as n from public.app_meta where key = 'global'");
    assert(anonRead.rows[0].n === 0, "anon still cannot read");
    assert(afterAnon.rows[0].n === 1, "anon still cannot delete");

    await asUser(db, "a1", false);
    const seen = await db.query("select key from public.app_meta order by key");
    await db.exec("update public.app_meta set payload = '{\"hello\":2}' where key = 'global'");
    await db.exec("insert into public.app_meta(key, payload) values ('onyxsub_abc', '{\"agent_id\":\"a1\"}')");
    let versionInsert = "";
    try {
      await db.exec("insert into public.app_meta(key, payload) values ('side_key', '{\"version\":\"9\"}')");
      versionInsert = "wrote";
    } catch(err) {
      versionInsert = String(err && err.message || err);
    }
    await db.exec("update public.app_meta set payload = '{\"publicKey\":\"stolen\"}' where key = 'onyx_push_vapid_public'");
    await db.exec("delete from public.app_meta where key = 'global'");
    await db.exec("reset role");
    const globalPayload = await db.query("select payload::text as payload from public.app_meta where key = 'global'");
    const vapid = await db.query("select payload::text as payload from public.app_meta where key = 'onyx_push_vapid_public'");
    const sub = await db.query("select count(*)::int as n from public.app_meta where key = 'onyxsub_abc'");
    assert(seen.rows.map((row) => row.key).join(",") === "app_version,global,onyx_push_vapid_public", "a person still reads every setting");
    assert(JSON.parse(globalPayload.rows[0].payload).hello === 2, "a person can save the shared row");
    assert(sub.rows[0].n === 1, "a person can save a notification row");
    assert(/row-level security/i.test(versionInsert), "a person cannot publish a version");
    assert(JSON.parse(vapid.rows[0].payload).publicKey === "mark", "a person cannot change the push key");
    assert(globalPayload.rows.length === 1, "a person cannot delete the shared row");

    await asUser(db, "", false);
    await db.exec("update public.app_meta set payload = '{\"hello\":9}' where key = 'global'");
    await db.exec("reset role");
    const untouched = await db.query("select payload::text as payload from public.app_meta where key = 'global'");
    assert(JSON.parse(untouched.rows[0].payload).hello === 2, "a blank agent id cannot save the shared row");

    await asUser(db, "boss", true);
    await db.exec("update public.app_meta set payload = '{\"publicKey\":\"desk\"}' where key = 'onyx_push_vapid_public'");
    await db.exec("insert into public.app_meta(key, payload) values ('extra', '{\"ok\":1}')");
    await db.exec("delete from public.app_meta where key = 'extra'");
    await db.exec("reset role");
    const pushed = await db.query("select payload::text as payload from public.app_meta where key = 'onyx_push_vapid_public'");
    const extra = await db.query("select count(*)::int as n from public.app_meta where key = 'extra'");
    assert(JSON.parse(pushed.rows[0].payload).publicKey === "desk", "a manager can change the push key");
    assert(extra.rows[0].n === 0, "a manager can delete a setting");

    const open = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_app_meta_all_authenticated'");
    const block = await db.query("select count(*)::int as n from pg_policies where policyname = 'z_block_anon_delete'");
    const notes = await db.query("select policyname from pg_policies where tablename = 'notes'");
    assert(open.rows[0].n === 0 && block.rows[0].n === 1, "the open path stays removed and the delete block stays");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create role authenticated nologin;
      create table public.app_meta (payload jsonb);
      alter table public.app_meta enable row level security;
      create policy gi_app_meta_all_authenticated on public.app_meta
        for all to authenticated using (true) with check (true);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/setting columns are missing; nothing saved/i.test(blocked), "a missing key column saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_app_meta_all_authenticated'");
    assert(stillOpen.rows[0].n === 1, "the open path stays when the column is missing");
  }

  {
    const db = new PGlite();
    await db.exec(base + `
      create policy app_meta_extra on public.app_meta for select to authenticated using (false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/not the expected open set; nothing saved/i.test(blocked), "an unexpected policy saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_app_meta_all_authenticated'");
    assert(stillOpen.rows[0].n === 1, "the open path stays when the set is unexpected");
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
