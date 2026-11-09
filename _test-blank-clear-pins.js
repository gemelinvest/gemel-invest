/**
 * Clear login codes are blanked only when the stored hash matches.
 * A mismatch, a missing hash, or an identity change saves nothing.
 * Run: node _test-blank-clear-pins.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-blank-clear-pins.sql"), "utf8");
const code = executable(sql);

console.log("1) the file blanks only a matching clear code");
assert(code.includes("set pin = ''"), "it clears the code column with an empty string");
assert(!/set pin = null/i.test(code), "it does not write null into a required column");
assert(code.includes("extensions.crypt(btrim(pin), pin_hash) = pin_hash"), "the write requires a matching hash");
assert(code.includes("an active account has a clear code and no hash"), "an active account without a hash stops it");
assert(code.includes("a stored hash does not match its clear code"), "a mismatch stops it");
assert(code.includes("a sign-in identity changed"), "an identity change stops it");
assert(code.includes("pin sync would replace the hash"), "a hash-wiping trigger stops it");
assert(!/update\s+public\.(app_meta|gi_app_secrets|customers)\b/i.test(code), "it does not write settings or customers");
assert(!/delete\s+from\s+public\./i.test(code), "it does not delete a row");
assert(!/drop\s+trigger|disable\s+trigger|create\s+policy|revoke /i.test(code), "it does not change triggers or policies");
assert(!/detail[^;]*\|\|\s*(pin|pin_hash|email)\b/i.test(code), "a result does not carry a code or an address");

const SYNC = `
  create or replace function public.gi_sync_agent_pin_hash()
  returns trigger language plpgsql as $fn$
  begin
    if TG_OP = 'UPDATE' and new.pin is not distinct from old.pin then
      return new;
    end if;
    if new.pin is not null and btrim(new.pin) <> '' then
      new.pin_hash := extensions.crypt(btrim(new.pin), 'salt');
    end if;
    return new;
  end $fn$;
  drop trigger if exists trg_gi_sync_agent_pin_hash on public.agents;
  create trigger trg_gi_sync_agent_pin_hash
    before update of pin on public.agents
    for each row execute function public.gi_sync_agent_pin_hash();
`;

const LOGIN = `
  create or replace function public.gi_verify_agent_login(p_username text, p_pin text)
  returns jsonb language plpgsql as $fn$
  begin
    if extensions.crypt(p_pin, 'hash') = 'hash' then
      return jsonb_build_object('ok', true, 'pin_hash', 'checked');
    end if;
    return jsonb_build_object('ok', false);
  end $fn$;
`;

function mapRows(rows){
  return Object.fromEntries(rows.filter((row) => row.section !== "left_clear").map((row) => [row.section, row.detail]));
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

  async function base(db){
    await db.exec(`
      create schema if not exists extensions;
      create or replace function extensions.crypt(pw text, salt text)
      returns text language sql immutable as $fn$
        select case when salt = 'match:' || pw then salt else 'mismatch' end
      $fn$;
      create table public.agents (
        id text primary key,
        name text,
        username text,
        role text,
        email text,
        auth_user_id uuid,
        active boolean,
        pin text,
        pin_hash text
      );
    `);
    await db.exec(LOGIN);
    await db.exec(SYNC);
  }

  {
    const db = new PGlite();
    await base(db);
    await db.exec(`
      insert into public.agents (id, name, username, role, email, auth_user_id, active, pin, pin_hash) values
        ('a_ready', 'מוכן', 'ready', 'agent', 'hidden.ready@example.test', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, '1111', 'match:1111'),
        ('a_off', 'כבוי', 'off', 'agent', 'hidden.off@example.test', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false, '2222', 'match:2222'),
        ('a_hash', 'רק גיבוב', 'hashonly', 'agent', '', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true, null, 'match:kept'),
        ('a_open', 'בלי גיבוב', 'open', 'agent', '', null, false, '3333', null);
    `);
    const before = await db.query("select id, email, auth_user_id, pin_hash, active from public.agents order by id");
    const rows = await rowsOf(db);
    const after = await db.query("select id, name, email, auth_user_id, pin, pin_hash, active from public.agents order by id");
    const shown = JSON.stringify(rows);
    assert(!shown.includes("@"), "no address is visible");
    assert(!/1111|2222|3333|match:|hidden\./.test(shown), "no code or hash is visible");
    const counts = mapRows(rows);
    assert(counts.ready === "2" && counts.blanked === "2", "two matching codes are blanked");
    assert(counts.active_clear_remaining === "0", "no active clear code remains");
    assert(counts.left_without_hash === "1", "the inactive code without a hash stays");
    assert(counts.hashes_unchanged === "yes" && counts.identity_unchanged === "yes", "hashes and identities stay");
    assert(counts.changed === "yes", "the write is reported");
    const left = rows.filter((row) => row.section === "left_clear");
    assert(left.length === 1 && left[0].detail === "בלי גיבוב|agent|a_open", "only the unmatched inactive account is listed");
    const byId = Object.fromEntries(after.rows.map((row) => [row.id, row]));
    assert(byId.a_ready.pin === "" && byId.a_ready.pin_hash === "match:1111", "an active code is cleared and its hash stays");
    assert(byId.a_off.pin === "" && byId.a_off.pin_hash === "match:2222", "an inactive matching code is cleared");
    assert(byId.a_hash.pin == null && byId.a_hash.pin_hash === "match:kept", "a hash with no clear code stays");
    assert(byId.a_open.pin === "3333" && byId.a_open.pin_hash == null, "a code without a hash stays");
    const identityAfter = after.rows.map((row) => ({
      id: row.id,
      email: row.email,
      auth_user_id: row.auth_user_id,
      pin_hash: row.pin_hash,
      active: row.active
    }));
    assert(JSON.stringify(before.rows) === JSON.stringify(identityAfter), "identity columns stayed");

    const again = mapRows(await rowsOf(db));
    assert(again.ready === "0" && again.blanked === "0" && again.changed === "no", "running it again changes nothing");
    await db.close();
  }

  {
    const db = new PGlite();
    await base(db);
    await db.exec(`
      alter table public.agents alter column pin set not null;
      insert into public.agents (id, name, role, active, pin, pin_hash, email) values
        ('a_required', 'חובה', 'agent', true, '1212', 'match:1212', '');
    `);
    const rows = mapRows(await rowsOf(db));
    const pin = await db.query("select pin, pin_hash from public.agents where id = 'a_required'");
    assert(rows.blanked === "1" && rows.changed === "yes" && rows.active_clear_remaining === "0", "a required code column still blanks");
    assert(pin.rows[0].pin === "" && pin.rows[0].pin_hash === "match:1212", "the required column keeps an empty code and the same hash");
    await db.close();
  }

  {
    const db = new PGlite();
    await base(db);
    await db.exec(`
      insert into public.agents (id, name, role, active, pin, pin_hash, email) values
        ('a_block', 'פעיל', 'agent', true, '4444', null, '');
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    const pin = await db.query("select pin, pin_hash from public.agents where id = 'a_block'");
    assert(/clear code and no hash/.test(blocked), "an active account without a hash stops the file");
    assert(pin.rows[0].pin === "4444" && pin.rows[0].pin_hash == null, "that clear code stays");
    await db.close();
  }

  {
    const db = new PGlite();
    await base(db);
    await db.exec(`
      insert into public.agents (id, name, role, active, pin, pin_hash, email) values
        ('a_bad', 'לא תואם', 'agent', true, '5555', 'match:other', '');
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    const pin = await db.query("select pin, pin_hash from public.agents where id = 'a_bad'");
    assert(/does not match its clear code/.test(blocked), "a mismatched hash stops the file");
    assert(pin.rows[0].pin === "5555" && pin.rows[0].pin_hash === "match:other", "the mismatched code stays");
    await db.close();
  }

  {
    const db = new PGlite();
    await base(db);
    await db.exec(`
      create or replace function public.gi_sync_agent_pin_hash()
      returns trigger language plpgsql as $fn$
      begin
        new.pin_hash := 'wiped';
        return new;
      end $fn$;
      insert into public.agents (id, name, role, active, pin, pin_hash, email) values
        ('a_wipe', 'מחיקה', 'agent', true, '6666', 'match:6666', '');
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    const pin = await db.query("select pin, pin_hash from public.agents where id = 'a_wipe'");
    assert(/would replace the hash/.test(blocked), "a trigger that replaces the hash stops the file");
    assert(pin.rows[0].pin === "6666" && pin.rows[0].pin_hash === "match:6666", "the code stays when the trigger is unsafe");
    await db.close();
  }

  {
    const db = new PGlite();
    await base(db);
    await db.exec(`
      create or replace function public.gi_lock_agent_auth_row()
      returns trigger language plpgsql as $fn$
      begin
        new.email := 'changed@example.test';
        return new;
      end $fn$;
      create trigger trg_gi_lock_agent_auth_identity
        before update on public.agents
        for each row execute function public.gi_lock_agent_auth_row();
      insert into public.agents (id, name, role, active, pin, pin_hash, email) values
        ('a_id', 'זהות', 'agent', true, '7777', 'match:7777', 'hidden.id@example.test');
    `);
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    const pin = await db.query("select pin, email from public.agents where id = 'a_id'");
    assert(/sign-in identity changed/.test(blocked), "an identity rewrite stops the file");
    assert(pin.rows[0].pin === "7777" && pin.rows[0].email === "hidden.id@example.test", "the code and the address stay");
    await db.close();
  }

  {
    const db = new PGlite();
    await base(db);
    await db.exec(`
      insert into public.agents (id, name, role, active, pin, pin_hash, email) values
        ('a_ok', 'תקין', 'agent', true, '8888', 'match:8888', '');
      create role gi_blank_reader nologin;
      grant select, update on public.agents to gi_blank_reader;
    `);
    await db.exec("set role gi_blank_reader");
    let blocked = "";
    try { await db.exec(sql); } catch(err) { blocked = String(err && err.message || err); }
    await db.exec("reset role");
    const pin = await db.query("select pin from public.agents where id = 'a_ok'");
    assert(/service role is required/.test(blocked), "a role that does not bypass row security stops the file");
    assert(pin.rows[0].pin === "8888", "that code stays");
    await db.close();
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
