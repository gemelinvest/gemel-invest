/**
 * Only the three unused accounts are turned off. A working agent stays active.
 * Run: node _test-disable-unused-pin-accounts.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
let failed = 0;

function assert(cond, msg){
  if(cond){
    console.log("  PASS  " + msg);
  } else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-disable-unused-pin-accounts.sql"), "utf8");

console.log("1) the script names only the three unused accounts");
assert(sql.includes("__PROBE_AGENTS__"), "includes the probe id");
assert(sql.includes("__NOOP__"), "includes the noop id");
assert(sql.includes("a_5a54433a98aba_1a13b463f71"), "includes the surveyor id");
assert(!sql.includes("חן מזרחי"), "does not name a working account");
assert(!/encrypted_password|GiCrm!/i.test(sql), "does not touch Auth passwords");
assert(/n <> 3/.test(sql), "stops unless exactly three accounts match");

async function runDatabase(){
  let PGlite;
  try {
    ({ PGlite } = require("/tmp/gi-pglite/node_modules/@electric-sql/pglite"));
  } catch(_e) {
    console.log("\n2) database fixture skipped (pglite not installed)");
    return;
  }
  console.log("\n2) database fixture");
  const db = new PGlite();
  await db.exec(`
    create table public.agents (
      id text primary key,
      name text,
      username text,
      pin text,
      active boolean,
      role text
    );
    insert into public.agents (id, name, username, pin, active, role) values
      ('__PROBE_AGENTS__', 'VALIDATOR_PROBE_DELETE_ME', 'VALIDATOR_PROBE_DELETE_ME', '1111', true, 'agent'),
      ('__NOOP__', 'NOOP', '', '2222', true, 'agent'),
      ('a_5a54433a98aba_1a13b463f71', 'סוקרת', 'סוקרת', '3333', true, 'referent'),
      ('a_keep', 'חן מזרחי', 'חן מזרחי', '4444', true, 'agent'),
      ('a_other', 'נציג אחר', 'אחר', '5555', true, 'agent');
  `);
  await db.exec(sql);
  const report = await db.query("select kind, detail from gi_disable_result");
  assert(report.rows.length === 1 && report.rows[0].detail === "3", "reports three accounts");
  const rows = await db.query("select id, active, pin from public.agents order by id");
  const byId = Object.fromEntries(rows.rows.map((row) => [row.id, row]));
  assert(byId.__PROBE_AGENTS__.active === false, "probe is off");
  assert(byId.__NOOP__.active === false, "noop is off");
  assert(byId.a_5a54433a98aba_1a13b463f71.active === false, "surveyor is off");
  assert(byId.a_keep.active === true && byId.a_keep.pin === "4444", "a working account stays active and keeps its code");
  assert(byId.a_other.active === true, "another account stays active");
  await db.exec(sql);
  const again = await db.query("select count(*)::int as n from public.agents where active = false");
  assert(again.rows[0].n === 3, "running the script again does not turn anyone else off");
}

runDatabase().then(() => {
  if(failed){
    console.error("\n" + failed + " failed");
    process.exit(1);
  }
  console.log("\nall passed");
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
