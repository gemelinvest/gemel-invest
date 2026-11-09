/**
 * The secret inventory only counts. It does not blank a code or print one.
 * Run: node _test-secret-inventory.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-secret-inventory.sql"), "utf8");
const code = executable(sql);

console.log("1) the file only reads");
assert(code.includes("public.agents"), "it looks at the agents table");
assert(code.includes("pin_hash"), "it counts the hash column");
assert(code.includes("totpUri") && code.includes("totpSecret"), "it detects authenticator material");
assert(code.includes("'changed', 'no'"), "it reports that nothing changed");
assert(code.includes("clear_without_hash"), "it lists an account that would be locked");
assert(code.includes("readable_totp"), "it lists a screen row that still holds a secret");
assert(!/\b(update|delete|truncate|alter)\b/i.test(code), "it does not write a stored row");
assert(!/create\s+table\s+public/i.test(code), "it does not create a stored table");
assert(!/insert\s+into\s+public/i.test(code), "it does not insert a stored row");
assert(!/detail[^;]*\|\|\s*(pin|pin_hash|email)\b/i.test(code), "a result does not carry a code or an address");

function mapRows(rows){
  return Object.fromEntries(rows.filter((row) => row.section !== "clear_without_hash" && row.section !== "readable_totp").map((row) => [row.section, row.detail]));
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
      create table public.app_meta (
        key text primary key,
        payload jsonb not null
      );
      create table public.gi_app_secrets (
        key text primary key,
        value jsonb not null
      );
      create or replace function public.gi_secret_inventory_noop()
      returns trigger language plpgsql as $fn$ begin return new; end $fn$;
      insert into public.agents (id, name, username, role, email, auth_user_id, active, pin, pin_hash) values
        ('a_ready', 'מוכן', 'ready', 'agent', 'hidden.ready@example.test', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, '1111', 'hash-ready'),
        ('a_block', 'בלי גיבוב', 'blocked', 'ops', '', null, true, '2222', null),
        ('a_hash', 'רק גיבוב', 'hashonly', 'agent', 'hidden.hash@example.test', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true, null, 'hash-only'),
        ('a_empty', 'בלי קוד', 'empty', 'agent', 'not-an-address', null, true, '', null),
        ('a_off', 'כבוי', 'off', 'agent', 'hidden.off@example.test', null, false, '3333', null),
        ('a_totp', 'עם סוד', 'totp', 'manager', '', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true, null, 'hash-totp');
      insert into public.app_meta (key, payload) values (
        'global',
        jsonb_build_object(
          'adminAuth', jsonb_build_object('username', 'admin', 'pin', 'ADMINPIN'),
          'agentSecurity', jsonb_build_object(
            'a_totp', jsonb_build_object('totpUri', 'otpauth://totp/demo?secret=DEMOSECRET', 'totpSecret', 'DEMOSECRET', 'totpQrHtml', '<svg>QR</svg>'),
            'a_ready', jsonb_build_object('mfaEnabled', true),
            'a_hash', jsonb_build_object('totpUri', '')
          )
        )
      );
      insert into public.gi_app_secrets (key, value) values
        ('admin_auth', jsonb_build_object('pin', 'SECRETADMIN')),
        ('agent_totp', jsonb_build_object('a_totp', jsonb_build_object('totpUri', 'otpauth://totp/demo?secret=DEMOSECRET')));
      create trigger trg_gi_strip_app_meta_secrets
        before update on public.app_meta
        for each row execute function public.gi_secret_inventory_noop();
    `);

    const beforeAgents = await db.query("select id, pin, pin_hash, email, active from public.agents order by id");
    const beforeMeta = await db.query("select payload from public.app_meta where key = 'global'");
    const beforeSecrets = await db.query("select key, value from public.gi_app_secrets order by key");
    const rows = await rowsOf(db);
    const afterAgents = await db.query("select id, pin, pin_hash, email, active from public.agents order by id");
    const afterMeta = await db.query("select payload from public.app_meta where key = 'global'");
    const afterSecrets = await db.query("select key, value from public.gi_app_secrets order by key");
    assert(JSON.stringify(afterAgents.rows) === JSON.stringify(beforeAgents.rows), "agent rows stayed");
    assert(JSON.stringify(afterMeta.rows) === JSON.stringify(beforeMeta.rows), "settings stayed");
    assert(JSON.stringify(afterSecrets.rows) === JSON.stringify(beforeSecrets.rows), "private secrets stayed");

    const shown = JSON.stringify(rows);
    assert(!shown.includes("@"), "no address is visible");
    assert(!/1111|2222|3333|ADMINPIN|SECRETADMIN|DEMOSECRET|otpauth|hash-ready|hash-only|hash-totp/.test(shown), "no code or secret is visible");

    const counts = mapRows(rows);
    assert(counts.agents_table === "yes", "the agents table is present");
    assert(counts.pin_column === "yes" && counts.pin_hash_column === "yes", "both code columns are present");
    assert(counts.active === "5", "five active accounts are counted");
    assert(counts.active_with_hash === "3", "three active accounts have a hash");
    assert(counts.active_clear_pin === "2", "two active accounts still keep a clear code");
    assert(counts.active_ready_to_blank === "1", "one active account can be blanked later");
    assert(counts.active_clear_without_hash === "1", "one active account would be locked");
    assert(counts.inactive_clear_pin === "1", "the inactive clear code is counted apart");
    assert(counts.readable_admin_pin === "yes", "the screen row still holds an admin code");
    assert(counts.readable_totp_uri === "1", "one screen entry still holds an authenticator address");
    assert(counts.readable_totp_secret === "1", "one screen entry still holds an authenticator secret");
    assert(counts.readable_totp_qr === "1", "one screen entry still holds a barcode drawing");
    assert(counts.private_admin_pin === "yes", "the private admin code is still stored");
    assert(counts.private_totp_entries === "1", "one private authenticator copy remains");
    assert(counts.strip_trigger === "yes", "the strip trigger is reported");
    assert(counts.active_with_auth_user === "3", "three active accounts have a sign-in id");
    assert(counts.active_with_address === "2", "two active accounts have an address");
    assert(counts.active_without_auth_user === "2", "two active accounts have no sign-in id");
    assert(counts.changed === "no", "nothing changed");

    const blocked = rows.filter((row) => row.section === "clear_without_hash");
    assert(blocked.length === 1 && blocked[0].detail === "בלי גיבוב|ops|a_block", "only the unlocked-hash account is listed");
    const totp = rows.filter((row) => row.section === "readable_totp");
    assert(totp.length === 1 && totp[0].detail === "עם סוד|manager|a_totp|uri=yes|secret=yes|qr=yes", "the screen secret is named without its value");
    await db.close();
  }

  {
    const db = new PGlite();
    await db.exec(`
      create table public.agents (
        id text primary key,
        name text,
        role text,
        active boolean,
        pin text
      );
      insert into public.agents (id, name, role, active, pin) values
        ('a1', 'בלי עמודה', 'agent', true, '4444');
    `);
    const rows = await rowsOf(db);
    const shown = JSON.stringify(rows);
    assert(!shown.includes("4444"), "a missing hash column does not print the code");
    const counts = mapRows(rows);
    assert(counts.pin_hash_column === "no", "a missing hash column is reported");
    assert(counts.active_with_hash === "skipped", "the hash count is skipped");
    assert(counts.active_clear_without_hash === "skipped", "the lock count is skipped");
    assert(counts.active_clear_pin === "1", "the clear code is still counted");
    assert(counts.private_secrets_table === "no", "a missing private table is reported");
    assert(counts.app_meta === "no", "a missing settings table is reported");
    assert(counts.changed === "no", "a partial schema still changes nothing");
    assert(!rows.some((row) => row.section === "clear_without_hash"), "no lock list is built without a hash column");
    await db.close();
  }

  {
    const db = new PGlite();
    const rows = await rowsOf(db);
    const counts = mapRows(rows);
    assert(counts.agents_table === "no" && counts.changed === "no", "a missing agents table stops the count");
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
