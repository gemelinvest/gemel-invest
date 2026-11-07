/**
 * The chat role status only reads policies and the sender and recipient columns.
 * Run: node _test-chat-role-status.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-chat-role-status.sql"), "utf8");
const code = executable(sql);

console.log("1) the file only reads");
assert(code.includes("public.gi_chat_messages"), "it looks at the chat table");
assert(code.includes("sender_id"), "it checks the sender column");
assert(code.includes("recipient_id"), "it checks the recipient column");
assert(code.includes("teamManager|opsAgent"), "it flags a capital-letter role comparison");
assert(code.includes("blank_party"), "it flags a blank sender or recipient");
assert(code.includes("manager_write"), "it flags a manager-only write");
assert(code.includes("pg_policies"), "it reads policies");
assert(code.includes("'changed', 'no'"), "it reports that nothing changed");
assert(!/create\s+policy/i.test(code), "it does not create a policy");
assert(!/drop\s+policy/i.test(code), "it does not drop a policy");
assert(!/revoke /i.test(code), "it does not revoke anything");
assert(!/enable row level security|disable row level security/i.test(code), "it does not switch row security");
assert(!/alter table/i.test(code), "it does not alter a table");
assert(!/from\s+public\.gi_chat_messages/i.test(code), "it does not read messages");
assert(!/insert into public\.|update public\.|delete from public\./i.test(code), "it does not write a message");
assert(!/body|sender_name|recipient_name|conversation_id/i.test(code), "message fields are not selected");
assert(!/public\.customers|public\.proposals|public\.agents|public\.app_meta|gi_simulator_saves/i.test(code), "other tables are not named");

function bySection(rows){
  return Object.fromEntries(rows.filter((row) => row.section !== "policy").map((row) => [row.section, row.detail]));
}

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

  {
    const db = new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create function public.gi_jwt_is_manager() returns boolean language sql stable as $$ select false $$;
      create table public.gi_chat_messages (
        id text primary key,
        sender_id text,
        recipient_id text,
        body text
      );
      create table public.gi_simulator_saves (id text primary key);
      insert into public.gi_chat_messages(id, sender_id, recipient_id, body)
        values ('msg', '', 'a2', 'secret text');
      alter table public.gi_chat_messages enable row level security;
      alter table public.gi_simulator_saves enable row level security;
      create policy gi_chat_messages_all_authenticated on public.gi_chat_messages
        for all to authenticated using (true) with check (true);
      create policy chat_select_authenticated on public.gi_chat_messages
        for select to authenticated
        using (sender_id = '' or recipient_id = 'a1');
      create policy chat_insert_authenticated on public.gi_chat_messages
        for insert to authenticated
        with check (sender_id is null or sender_id = 'a1');
      create policy chat_update_authenticated on public.gi_chat_messages
        for update to authenticated
        using (public.gi_jwt_is_manager())
        with check (sender_id = 'teamManager');
      create policy chat_delete_authenticated on public.gi_chat_messages
        for delete to authenticated
        using (public.gi_jwt_is_manager());
      create policy saves_select_authenticated on public.gi_simulator_saves
        for select to authenticated using (true);
    `);
    const rows = await rowsOf(db);
    const header = bySection(rows);
    assert(header.table === "gi_chat_messages", "the result names the chat table");
    assert(header.present === "yes", "the table is present");
    assert(header.rls === "yes", "row security is reported");
    assert(header.sender_id === "yes", "the sender column is reported");
    assert(header.recipient_id === "yes", "the recipient column is reported");
    assert(header.role_literal === "mixed", "a capital-letter role comparison is reported");
    assert(header.blank_party === "yes", "a blank sender comparison is reported");
    assert(header.manager_write === "yes", "a manager-only write is reported");
    assert(header.changed === "no", "nothing is changed");
    assert(rows.some((row) => row.detail === "gi_chat_messages_all_authenticated|ALL|signed_in|open"), "the open signed-in path is named");
    assert(rows.some((row) => row.detail === "chat_select_authenticated|SELECT|signed_in|limited"), "a limited select is named");
    assert(rows.some((row) => row.detail === "chat_insert_authenticated|INSERT|signed_in|limited"), "a limited insert is named");
    assert(rows.some((row) => row.detail === "chat_update_authenticated|UPDATE|signed_in|limited"), "a limited update is named");
    assert(rows.some((row) => row.detail === "chat_delete_authenticated|DELETE|signed_in|limited"), "a limited delete is named");
    assert(!rows.some((row) => String(row.detail).includes("saves_select_authenticated")), "another table is not listed");
    assert(!rows.some((row) => String(row.detail).includes("secret text")), "a message is not returned");
    const policies = await db.query(`select count(*)::int as n from pg_policies where tablename = 'gi_chat_messages'`);
    const saves = await db.query(`select policyname from pg_policies where tablename = 'gi_simulator_saves'`);
    const still = await db.query(`select id from public.gi_chat_messages`);
    assert(policies.rows[0].n === 5, "the check does not add a policy");
    assert(saves.rows.length === 1 && saves.rows[0].policyname === "saves_select_authenticated", "the saves table stays");
    assert(still.rows.length === 1 && still.rows[0].id === "msg", "the message row stays");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create role authenticated nologin;
      create table public.gi_chat_messages (
        id text primary key,
        sender_id text,
        recipient_id text
      );
      alter table public.gi_chat_messages enable row level security;
      create policy chat_select_authenticated on public.gi_chat_messages
        for select to authenticated
        using (sender_id = 'a1' or recipient_id = 'a1');
      create policy chat_update_authenticated on public.gi_chat_messages
        for update to authenticated
        using (sender_id = 'a1')
        with check (sender_id = 'a1');
    `);
    const header = bySection(await rowsOf(db));
    assert(header.sender_id === "yes" && header.recipient_id === "yes", "both party columns are reported");
    assert(header.role_literal === "lower", "a lowercase comparison is not mixed");
    assert(header.blank_party === "no", "an owned comparison is not a blank party");
    assert(header.manager_write === "no", "a participant update is not manager-only");
    assert(header.changed === "no", "the owned comparison changes nothing");
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.gi_chat_messages (id text primary key);
    `);
    const header = bySection(await rowsOf(db));
    assert(header.present === "yes" && header.rls === "no", "row security off is reported");
    assert(header.sender_id === "no" && header.recipient_id === "no", "missing party columns are reported");
    assert(header.role_literal === "lower" && header.blank_party === "no" && header.manager_write === "no", "no policy means no extra flags");
    assert(header.changed === "no", "a quiet table is not changed");
  }

  {
    const db = new PGlite();
    const header = bySection(await rowsOf(db));
    assert(header.table === "gi_chat_messages" && header.present === "no" && header.changed === "no", "a missing table is reported and nothing is saved");
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
