/**
 * Chat messages follow the screen. An admin or an owner can read every
 * message. Everyone else reads a message they sent or received, and can
 * send only as themselves. A participant can delete a message only after
 * it expires. A regular manager does not see every conversation.
 * The open signed-in path is removed.
 * Run: node _test-chat-by-role.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-chat-by-role.sql"), "utf8");
const code = executable(sql);

console.log("1) the file closes the open path and rewrites the chat policies");
assert(code.includes("drop policy gi_chat_messages_all_authenticated"), "it removes the open path");
assert(code.includes("'admin'"), "an admin can read every message");
assert(code.includes("'owner'"), "an owner can read every message");
assert(code.includes("coalesce(sender_id, '') = public.gi_jwt_agent_id()"), "a person can send as themselves");
assert(code.includes("coalesce(recipient_id, '') = public.gi_jwt_agent_id()"), "a recipient can read the message");
assert(code.includes("expires_at < now()"), "a participant deletes only an expired message");
assert(!code.includes("gi_jwt_is_manager()"), "a regular manager is not given every message");
assert(!code.includes("'opsagent'"), "an operations user is not given every message");
assert(!code.includes("'teammanager'"), "a team manager is not given the team messages");
assert(!code.includes("coalesce(sender_id, '') = ''"), "it does not leave a blank sender open");
assert(!/from\s+public\.gi_chat_messages/i.test(code), "it does not read messages");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/public\.customers|public\.proposals|public\.agents|public\.app_meta|gi_simulator_saves/i.test(code), "other tables are not named");

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
    create table public.gi_chat_messages (
      id text primary key,
      sender_id text,
      recipient_id text,
      note text,
      expires_at timestamptz
    );
    create table public.notes (id text primary key);
    grant select, insert, update, delete on public.gi_chat_messages to anon, authenticated;
    grant select on public.notes to authenticated;
    insert into public.gi_chat_messages(id, sender_id, recipient_id, note, expires_at) values
      ('mine', 'a1', 'a2', '1', now() + interval '1 day'),
      ('incoming', 'a2', 'a1', '2', now() + interval '1 day'),
      ('old', 'a1', 'a2', '3', now() - interval '1 day'),
      ('other', 'a2', 'a3', '4', now() + interval '1 day'),
      ('oldother', 'a2', 'a3', '5', now() - interval '1 day');
    alter table public.gi_chat_messages enable row level security;
    alter table public.notes enable row level security;
    create function public.gi_jwt_agent_id() returns text language sql stable as $$
      select coalesce(current_setting('gi.test_agent', true), '')
    $$;
    create function public.gi_jwt_is_manager() returns boolean language sql stable as $$
      select coalesce(current_setting('gi.test_manager', true), '') = 'yes'
    $$;
    create function public.gi_jwt_role() returns text language sql stable as $$
      select coalesce(current_setting('gi.test_role', true), '')
    $$;
    create policy notes_select_own on public.notes for select to authenticated using (true);
    create policy gi_chat_messages_all_authenticated on public.gi_chat_messages
      for all to authenticated using (true) with check (true);
    create policy chat_select_authenticated on public.gi_chat_messages
      for select to authenticated
      using (
        public.gi_jwt_is_manager()
        or (public.gi_jwt_agent_id() <> '' and (
          coalesce(sender_id, '') = public.gi_jwt_agent_id()
          or coalesce(recipient_id, '') = public.gi_jwt_agent_id()
        ))
      );
    create policy chat_insert_authenticated on public.gi_chat_messages
      for insert to authenticated
      with check (
        public.gi_jwt_is_manager()
        or (public.gi_jwt_agent_id() <> '' and coalesce(sender_id, '') = public.gi_jwt_agent_id())
      );
    create policy chat_update_authenticated on public.gi_chat_messages
      for update to authenticated
      using (public.gi_jwt_is_manager())
      with check (public.gi_jwt_is_manager());
    create policy chat_delete_authenticated on public.gi_chat_messages
      for delete to authenticated
      using (public.gi_jwt_is_manager());
  `;

  async function rowsOf(db){
    const out = await db.exec(sql);
    const last = out[out.length - 1];
    return last.rows || [];
  }

  async function asUser(db, agent, role, manager){
    await db.exec("set role authenticated");
    await db.exec("select set_config('gi.test_agent', '" + agent + "', false)");
    await db.exec("select set_config('gi.test_role', '" + role + "', false)");
    await db.exec("select set_config('gi.test_manager', '" + (manager ? "yes" : "") + "', false)");
  }

  {
    const db = new PGlite();
    await db.exec(base);
    const first = await rowsOf(db);
    const details = first.map((row) => row.section + "=" + row.detail);
    assert(details.includes("policies_removed=gi_chat_messages_all_authenticated"), "the open path is removed");
    assert(details.includes("select_by_role=installed") && details.includes("write_by_role=installed"), "the chat policies are installed");
    assert(details.includes("blank_party=closed") && details.includes("other_tables=unchanged"), "the blank path is closed and other tables stay");
    assert(details.includes("changed=yes"), "the cut is reported");
    const second = await rowsOf(db);
    const again = second.map((row) => row.section + "=" + row.detail);
    assert(again.includes("policies_removed=none") && again.includes("changed=no"), "a second run removes nothing");

    await db.exec("set role anon");
    const anonRead = await db.query("select count(*)::int as n from public.gi_chat_messages");
    await db.exec("reset role");
    assert(anonRead.rows[0].n === 0, "anon still cannot read");

    await asUser(db, "a1", "agent", false);
    const ownIds = await db.query("select id from public.gi_chat_messages order by id");
    await db.exec("update public.gi_chat_messages set note = 'x' where id = 'mine'");
    let foreignInsert = "";
    try {
      await db.exec("insert into public.gi_chat_messages(id, sender_id, recipient_id, note, expires_at) values ('nope', 'a2', 'a1', '9', now() + interval '1 day')");
      foreignInsert = "wrote";
    } catch(err) {
      foreignInsert = String(err && err.message || err);
    }
    await db.exec("insert into public.gi_chat_messages(id, sender_id, recipient_id, note, expires_at) values ('sent', 'a1', 'a3', 'ok', now() + interval '1 day')");
    await db.exec("delete from public.gi_chat_messages where id = 'mine'");
    await db.exec("delete from public.gi_chat_messages where id = 'old'");
    await db.exec("delete from public.gi_chat_messages where id = 'oldother'");
    await db.exec("reset role");
    const seen = ownIds.rows.map((row) => row.id);
    const mineNote = await db.query("select note from public.gi_chat_messages where id = 'mine'");
    const old = await db.query("select count(*)::int as n from public.gi_chat_messages where id = 'old'");
    const oldOther = await db.query("select count(*)::int as n from public.gi_chat_messages where id = 'oldother'");
    const sent = await db.query("select count(*)::int as n from public.gi_chat_messages where id = 'sent'");
    assert(seen.join(",") === "incoming,mine,old", "a person sees messages they sent or received");
    assert(mineNote.rows[0].note === "1", "a person cannot edit a live message");
    assert(/row-level security/i.test(foreignInsert), "a person cannot send as someone else");
    assert(sent.rows[0].n === 1, "a person can send as themselves");
    assert(mineNote.rows.length === 1, "a person cannot delete a live message");
    assert(old.rows[0].n === 0, "a person can delete an expired message they are in");
    assert(oldOther.rows[0].n === 1, "a person cannot delete someone else's expired message");

    await asUser(db, "boss", "manager", true);
    const bossCount = await db.query("select count(*)::int as n from public.gi_chat_messages");
    await db.exec("reset role");
    assert(bossCount.rows[0].n === 0, "a regular manager does not see every conversation");

    await asUser(db, "ops", "opsagent", false);
    const opsCount = await db.query("select count(*)::int as n from public.gi_chat_messages");
    await db.exec("reset role");
    assert(opsCount.rows[0].n === 0, "an operations user does not see every conversation");

    await asUser(db, "boss", "admin", false);
    const adminCount = await db.query("select count(*)::int as n from public.gi_chat_messages");
    await db.exec("update public.gi_chat_messages set note = 'kept' where id = 'other'");
    await db.exec("delete from public.gi_chat_messages where id = 'other'");
    await db.exec("reset role");
    const edited = await db.query("select count(*)::int as n from public.gi_chat_messages where id = 'other'");
    assert(adminCount.rows[0].n === 5, "an admin sees every remaining message");
    assert(edited.rows[0].n === 0, "an admin can delete a live message");

    const open = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_chat_messages_all_authenticated'");
    const notes = await db.query("select policyname from pg_policies where tablename = 'notes'");
    assert(open.rows[0].n === 0, "the open path stays removed");
    assert(notes.rows.length === 1 && notes.rows[0].policyname === "notes_select_own", "the other table stays");
  }

  {
    const db = new PGlite();
    const missingColumn = base
      .replace("      note text,\n      expires_at timestamptz\n", "      note text\n")
      .replace(", expires_at) values", ") values")
      .replace(/, now\(\) \+ interval '1 day'/g, "")
      .replace(/, now\(\) - interval '1 day'/g, "");
    await db.exec(missingColumn);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/expires_at column is missing; nothing saved/i.test(blocked), "a missing expires_at column saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_chat_messages_all_authenticated'");
    assert(stillOpen.rows[0].n === 1, "the open path stays when the column is missing");
  }

  {
    const db = new PGlite();
    await db.exec(base + `
      create policy chat_extra on public.gi_chat_messages for select to authenticated using (false);
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/not the expected open set; nothing saved/i.test(blocked), "an unexpected policy saves nothing");
    const stillOpen = await db.query("select count(*)::int as n from pg_policies where policyname = 'gi_chat_messages_all_authenticated'");
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
