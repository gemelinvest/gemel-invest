/**
 * Barcode reset saves one agent security entry.
 * Elementary referrals and every other account stay untouched.
 * Run: node _test-patch-agent-security.js
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

const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-patch-agent-security.sql"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

console.log("1) the save stays narrow");
assert(sql.includes("gi_patch_agent_security"), "function name");
assert(sql.includes("where m.key = 'global'"), "updates the settings row in place");
assert(!sql.includes("elementaryReferrals"), "does not mention referral data");
assert(sql.includes("patch contains a field this save does not accept"), "rejects fields outside the status list");
assert(sql.includes("pinOnlyLogin") === false || !/'pinOnlyLogin'/.test(sql.split("v_allowed")[1].split("];")[0]), "pin-only is not an accepted field");
assert(!/'totpUri'/.test(sql.split("v_allowed")[1].split("];")[0]), "authenticator secret is not an accepted field");
assert(!/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(sql), "no address is written in the file");
assert(app.includes('client.rpc("gi_patch_agent_security"'), "app calls the small save");

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
    create role anon;
    create role authenticated;
    create table public.app_meta (
      key text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    );
  `);
  const referrals = JSON.stringify([{ id: "ref-1", payload: { note: "keep-me" } }]);
  await db.query(
    `insert into public.app_meta (key, payload) values ('global', $1::jsonb)`,
    [JSON.stringify({
      elementaryReferrals: JSON.parse(referrals),
      agentSecurity: {
        a_target: { pinOnlyLogin: false, mfaRequired: true, mfaEnabled: true, factorId: "old-factor", totpUri: "otpauth://secret" },
        a_other: { pinOnlyLogin: true, mfaRequired: false, authEmail: "other@example.test" }
      }
    })]
  );
  await db.exec(sql);

  const before = await db.query("select payload from public.app_meta where key = 'global'");
  const beforePayload = before.rows[0].payload;

  const ok = await db.query(
    `select public.gi_patch_agent_security($1, $2::jsonb) as result`,
    ["a_target", JSON.stringify({
      mfaRequired: true,
      mfaEnabled: false,
      mfaResetPending: true,
      factorId: "",
      authEmail: "target@example.test"
    })]
  );
  assert(ok.rows[0].result.ok === true, "small save returns ok");

  const after = await db.query("select payload from public.app_meta where key = 'global'");
  const payload = after.rows[0].payload;
  const target = payload.agentSecurity.a_target;
  assert(JSON.stringify(payload.elementaryReferrals) === JSON.stringify(beforePayload.elementaryReferrals), "referrals are unchanged");
  assert(JSON.stringify(payload.agentSecurity.a_other) === JSON.stringify(beforePayload.agentSecurity.a_other), "the other account is unchanged");
  assert(target.mfaResetPending === true && target.mfaEnabled === false && target.factorId === "", "reset flags are stored");
  assert(target.authEmail === "target@example.test", "the status address is stored");
  assert(target.totpUri == null, "an old authenticator secret is removed");
  assert(typeof target.updatedAt === "string" && target.updatedAt.length > 0, "the server stamps the save time");

  let rejectedPin = false;
  try {
    await db.query(
      `select public.gi_patch_agent_security($1, $2::jsonb)`,
      ["a_target", JSON.stringify({ pinOnlyLogin: true })]
    );
  } catch(err) {
    rejectedPin = /does not accept/.test(String(err && err.message));
  }
  assert(rejectedPin, "code-only login cannot be turned on by this save");

  let rejectedSecret = false;
  try {
    await db.query(
      `select public.gi_patch_agent_security($1, $2::jsonb)`,
      ["a_target", JSON.stringify({ totpUri: "otpauth://nope" })]
    );
  } catch(err) {
    rejectedSecret = /does not accept/.test(String(err && err.message));
  }
  assert(rejectedSecret, "an authenticator secret cannot be written");

  const finalRow = await db.query("select payload from public.app_meta where key = 'global'");
  assert(JSON.stringify(finalRow.rows[0].payload.elementaryReferrals) === JSON.stringify(payload.elementaryReferrals), "a rejected save does not rewrite referrals");
  assert(finalRow.rows[0].payload.agentSecurity.a_target.mfaResetPending === true, "a rejected save does not undo the reset flag");
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
