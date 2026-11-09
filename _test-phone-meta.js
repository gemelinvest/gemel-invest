/**
 * Phone notifications and a vehicle referral go through narrow functions.
 * The table path stays. The install rewrites no row and leaves the door open.
 * Run: node _test-phone-meta.js
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

const pushSql = fs.readFileSync(path.join(ROOT, "supabase-gi-phone-push.sql"), "utf8");
const referralSql = fs.readFileSync(path.join(ROOT, "supabase-gi-phone-referral.sql"), "utf8");
const pushCode = executable(pushSql);
const referralCode = executable(referralSql);
const phone = fs.readFileSync(path.join(ROOT, "phone/phone.js"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "phone/sw.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "phone/index.html"), "utf8");

console.log("1) both files fit the SQL editor and leave the door open");
assert(Buffer.byteLength(pushSql) < 7800, "the notification file fits in the SQL editor");
assert(Buffer.byteLength(referralSql) < 7800, "the referral file fits in the SQL editor");
assert(pushSql.trim().endsWith("order by sort_key, detail;"), "the notification file ends with the result query");
assert(referralSql.trim().endsWith("order by sort_key, detail;"), "the referral file ends with the result query");
assert(pushCode.includes("create or replace function public.gi_phone_push_key()"), "it adds the key function");
assert(pushCode.includes("create or replace function public.gi_phone_push_save(p_endpoint text, p_p256dh text, p_auth text)"), "it adds the subscription function");
assert(referralCode.includes("create or replace function public.gi_phone_referral_save(p_referral jsonb)"), "it adds the referral function");
assert(pushCode.includes("grant execute on function public.gi_phone_push_key() to authenticated"), "a signed-in session can read the key");
assert(pushCode.includes("grant execute on function public.gi_phone_push_save(text, text, text) to authenticated"), "a signed-in session can save a subscription");
assert(referralCode.includes("grant execute on function public.gi_phone_referral_save(jsonb) to authenticated"), "a signed-in session can save a referral");
assert(pushCode.includes("revoke all on function public.gi_phone_push_key() from public, anon"), "the public key cannot read the notification key");
assert(pushCode.includes("anon can call a phone function"), "an anon grant stops the notification install");
assert(referralCode.includes("anon can call a phone function"), "an anon grant stops the referral install");
assert(pushCode.includes("'door_closed', 'no'") && referralCode.includes("'door_closed', 'no'"), "the table door stays open");
assert(pushCode.includes("'table_path', 'kept'") && referralCode.includes("'table_path', 'kept'"), "the table path stays");
assert(!/drop\s+policy|create\s+policy/i.test(pushCode + referralCode), "neither file changes a policy");
assert(!/update\s+public\.app_meta/i.test(pushCode), "the notification install does not rewrite a settings row");
assert(!/gi_phone_push_save\(/.test(pushCode.split("create or replace function public.gi_phone_push_save")[0]), "the install does not call the subscription save");
assert(!/select\s+public\.gi_phone_referral_save|perform\s+public\.gi_phone_referral_save/i.test(referralCode), "the install does not call the referral save");
assert(pushCode.includes("extensions.digest(v_endpoint, 'sha256')"), "a subscription key is a hash of the address");
assert(referralCode.includes("'agentId', v_agent"), "a referral takes the agent from the session");

const keyFn = phone.slice(phone.indexOf("async function readPushPublicKey"), phone.indexOf("async function savePushSubscription"));
const saveFn = phone.slice(phone.indexOf("async function savePushSubscription"), phone.indexOf("async function enablePush"));
const referralFn = phone.slice(phone.indexOf("async function carSaveReferral"), phone.indexOf("async function carFinish"));
console.log("2) the phone tries the functions and keeps the table");
assert(keyFn.includes('sb.rpc("gi_phone_push_key")') && keyFn.indexOf('sb.rpc("gi_phone_push_key")') < keyFn.indexOf('eq("key", "onyx_push_vapid_public")'), "the key function is tried before the table");
assert(saveFn.includes('sb.rpc("gi_phone_push_save"') && saveFn.indexOf('sb.rpc("gi_phone_push_save"') < saveFn.indexOf('key: "onyxsub_"'), "the subscription function is tried before the table");
assert(referralFn.includes('sb.rpc("gi_phone_referral_save"') && referralFn.indexOf('sb.rpc("gi_phone_referral_save"') < referralFn.indexOf('.from("app_meta").select("payload,updated_at")'), "the referral function is tried before the table");
assert(referralFn.includes('.update({ payload: next, updated_at: next.updatedAt })'), "the referral table write remains as the fallback");
assert(sw.includes("onyx-phone-shell-v108"), "the phone cache token moved");
assert(html.includes("phone.js?v=93"), "the phone script token moved");

const FIXTURE = `
  create role anon nologin;
  create role authenticated nologin;
  create schema if not exists extensions;
  create or replace function extensions.digest(data text, kind text)
  returns bytea language plpgsql as $fn$
  begin
    if kind is distinct from 'sha256' then
      raise exception 'digest kind';
    end if;
    return decode(md5(convert_to(data, 'UTF8')), 'hex');
  end
  $fn$;
  create or replace function public.gi_jwt_agent_id()
  returns text language sql stable as $fn$
    select coalesce(nullif(current_setting('gi.agent', true), ''), '');
  $fn$;
  create table public.agents (
    id text primary key,
    name text,
    username text,
    role text,
    active boolean
  );
  insert into public.agents(id, name, username, role, active) values
    ('a1', 'Dana', 'dana', 'agent', true),
    ('a2', 'Other', 'other', 'agent', true);
  create table public.app_meta (
    key text primary key,
    payload jsonb not null,
    updated_at timestamptz
  );
  alter table public.app_meta enable row level security;
  create policy app_meta_select_authenticated on public.app_meta
    for select to authenticated using (true);
  insert into public.app_meta(key, payload, updated_at) values
    ('global', jsonb_build_object(
      'adminAuth', jsonb_build_object('username', 'manager', 'pin', 'secret-pin'),
      'teamManagerAssignments', jsonb_build_object('m1', jsonb_build_array('a1')),
      'elementaryReferrals', jsonb_build_array(jsonb_build_object('id', 'elemref_old', 'idNumber', '111111111', 'status', 'done'))
    ), '2026-11-09T00:00:00Z'),
    ('onyx_push_vapid_public', jsonb_build_object('publicKey', 'abc_DEF-123'), '2026-11-09T00:00:00Z');
  create or replace function public.gi_strip_app_meta_row()
  returns trigger language plpgsql as $fn$
  begin
    if jsonb_typeof(new.payload->'adminAuth') = 'object' then
      new.payload := jsonb_set(new.payload, '{adminAuth}', (new.payload->'adminAuth') - 'pin', true);
    end if;
    return new;
  end
  $fn$;
  create trigger trg_gi_strip_app_meta_secrets
    before update on public.app_meta
    for each row execute function public.gi_strip_app_meta_row();
`;

function rowsOf(out){
  const last = out[out.length - 1];
  return last.rows || [];
}

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n3) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n3) database fixture");

  {
    const db = new PGlite();
    await db.exec(FIXTURE);
    const before = await db.query("select key, payload, updated_at from public.app_meta order by key");
    const agentsBefore = await db.query("select id, name, username, role from public.agents order by id");
    const pushRows = rowsOf(await db.exec(pushSql));
    const afterPush = await db.query("select key, payload, updated_at from public.app_meta order by key");
    const referralRows = rowsOf(await db.exec(referralSql));
    const after = await db.query("select key, payload, updated_at from public.app_meta order by key");
    const agentsAfter = await db.query("select id, name, username, role from public.agents order by id");
    const pushMap = Object.fromEntries(pushRows.map((row) => [row.section + ":" + row.detail, row.detail]));
    const referralMap = Object.fromEntries(referralRows.map((row) => [row.section, row.detail]));
    assert(JSON.stringify(afterPush.rows) === JSON.stringify(before.rows), "the notification install leaves every settings row");
    assert(JSON.stringify(after.rows) === JSON.stringify(before.rows), "the referral install leaves every settings row");
    assert(JSON.stringify(agentsAfter.rows) === JSON.stringify(agentsBefore.rows), "neither install changes an agent");
    assert(pushMap["function:gi_phone_push_key"] === "gi_phone_push_key" && pushMap["function:gi_phone_push_save"] === "gi_phone_push_save", "both notification functions are installed");
    assert(pushMap["installed:yes"] === "yes" && pushMap["door_closed:no"] === "no" && pushMap["rows_changed:no"] === "no", "the notification door and the rows stay");
    assert(pushMap["anon_call:no"] === "no" && pushMap["signed_in_call:yes"] === "yes" && pushMap["table_path:kept"] === "kept", "the notification grants stay narrow");
    assert(referralMap.function === "gi_phone_referral_save" && referralMap.installed === "yes", "the referral function is installed");
    assert(referralMap.door_closed === "no" && referralMap.rows_changed === "no" && referralMap.table_path === "kept", "the referral door and the rows stay");
    assert(!/secret-pin|abc_DEF/.test(JSON.stringify(pushRows) + JSON.stringify(referralRows)), "the result rows do not contain a secret or the key");
    const policy = await db.query("select count(*)::int as n from pg_policies where policyname = 'app_meta_select_authenticated'");
    assert(policy.rows[0].n === 1, "the open read policy is untouched");

    await db.exec("select set_config('gi.agent', 'a1', false)");
    await db.exec("set role authenticated");
    const key = await db.query("select public.gi_phone_push_key() as key");
    const body = key.rows[0].key;
    assert(body.ok === true && body.publicKey === "abc_DEF-123" && Object.keys(body).join(",") === "ok,publicKey", "the key answer is only the public key");
    const saved = await db.query("select public.gi_phone_push_save('https://push.example/device', 'abc', 'auth1') as saved");
    assert(saved.rows[0].saved.ok === true, "a subscription save answers ok");
    const rejected = await db.query("select public.gi_phone_push_save('http://push.example/device', 'abc', 'auth1') as saved");
    assert(rejected.rows[0].saved.ok === false && rejected.rows[0].saved.error === "subscription", "an address that is not https is refused");
    const referral = {
      id: "elemref_phone_1",
      status: "sent",
      agentId: "a2",
      agentName: "Spoofed",
      idNumber: "12-3456782",
      fullName: "לקוח",
      pin: "secret-pin",
      adminAuth: { pin: "secret-pin" },
      totpUri: "otpauth://totp/demo"
    };
    const first = await db.query("select public.gi_phone_referral_save($1::jsonb) as saved", [JSON.stringify(referral)]);
    assert(first.rows[0].saved.ok === true && first.rows[0].saved.duplicate === false, "a referral save answers ok");
    const again = await db.query("select public.gi_phone_referral_save($1::jsonb) as saved", [JSON.stringify(referral)]);
    assert(again.rows[0].saved.ok === true, "the same referral id does not append twice");
    const other = Object.assign({}, referral, { id: "elemref_phone_2" });
    const dup = await db.query("select public.gi_phone_referral_save($1::jsonb) as saved", [JSON.stringify(other)]);
    assert(dup.rows[0].saved.ok === false && dup.rows[0].saved.duplicate === true, "a waiting identity number is refused");
    await db.exec("reset role");

    const sub = await db.query("select key, payload from public.app_meta where key like 'onyxsub_%' order by key");
    assert(sub.rows.length === 1, "one subscription row is stored");
    const expectedKey = await db.query("select 'onyxsub_' || left(encode(extensions.digest('https://push.example/device', 'sha256'), 'hex'), 32) as key");
    assert(sub.rows[0].key === expectedKey.rows[0].key, "the subscription key is the hash of the address");
    assert(sub.rows[0].payload.agent_id === "a1" && sub.rows[0].payload.agent_name === "Dana" && sub.rows[0].payload.role === "agent", "the subscription agent comes from the session");
    const global = await db.query("select payload from public.app_meta where key = 'global'");
    const payload = global.rows[0].payload;
    const list = payload.elementaryReferrals;
    assert(Array.isArray(list) && list.length === 2, "the referral is prepended to the existing list");
    assert(list[0].id === "elemref_phone_1" && list[0].agentId === "a1" && list[0].agentName === "Dana", "the stored referral uses the session agent");
    assert(list[0].idNumber === "123456782" && list[0].status === "pending" && list[0].fullName === "לקוח", "the referral keeps the customer and drops a supplied status");
    assert(list[0].pin == null && list[0].adminAuth == null && list[0].totpUri == null, "a code and a barcode are not stored on the referral");
    assert(list[1].id === "elemref_old", "the older referral stays");
    assert(payload.teamManagerAssignments && payload.teamManagerAssignments.m1[0] === "a1", "the other settings stay");
    assert(!payload.adminAuth.pin, "the settings trigger still removes a code");
    assert((await db.query("select count(*)::int as n from public.agents")).rows[0].n === 2, "a save does not add an agent");

    await db.exec("select set_config('gi.agent', '', false)");
    await db.exec("set role authenticated");
    const blocked = await db.query("select public.gi_phone_referral_save('{\"id\":\"elemref_x\",\"idNumber\":\"123456782\"}'::jsonb) as saved");
    assert(blocked.rows[0].saved.ok === false && blocked.rows[0].saved.error === "auth", "a session without an agent saves nothing");
    await db.exec("reset role");
    const still = await db.query("select jsonb_array_length(payload->'elementaryReferrals')::int as n from public.app_meta where key = 'global'");
    assert(still.rows[0].n === 2, "a refused save leaves the list");

    await db.exec("set role anon");
    let denied = "";
    try { await db.query("select public.gi_phone_push_key()"); }
    catch(err) { denied = String(err && err.message || err); }
    await db.exec("reset role");
    assert(/permission denied/i.test(denied), "the public key cannot call the function");

    const second = Object.fromEntries(rowsOf(await db.exec(pushSql)).map((row) => [row.section, row.detail]));
    assert(second.installed === "yes" && second.rows_changed === "no", "a second notification run changes no rows");
    await db.close();
  }

  {
    const db = new PGlite();
    let blocked = "";
    try { await db.exec(pushSql); } catch(err) { blocked = String(err && err.message || err); }
    assert(/phone tables are missing/.test(blocked), "a missing table saves nothing");
    const fn = await db.query("select count(*)::int as n from pg_proc where proname like 'gi_phone_%'");
    assert(fn.rows[0].n === 0, "the rejected functions are not left behind");
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
