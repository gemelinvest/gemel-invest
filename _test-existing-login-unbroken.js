/**
 * Regression guard: the Auth-provisioning change must not alter login for
 * existing users. Behavioural checks run the real helpers from app.js.
 * Run: node _test-existing-login-unbroken.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

let failed = 0;
let passed = 0;
function assert(cond, msg){
  if(cond){ passed += 1; console.log("  PASS  " + msg); }
  else { failed += 1; console.error("  FAIL  " + msg); }
}

/* Extract the shipped helpers instead of restating the formula, so a change to
   app.js that breaks the "existing user" path fails here. */
function extract(startMarker, endMarker){
  const s = app.indexOf(startMarker);
  const e = app.indexOf(endMarker, s);
  if(s < 0 || e < 0) throw new Error("cannot extract " + startMarker);
  return app.slice(s, e);
}

const helperSrc = extract("const deriveGiAuthPassword =", "const agentRequiresMfa =");
const safeTrim = (v) => String(v == null ? "" : v).trim();
const normalizeEmailValue = (v) => safeTrim(v).toLowerCase();
const calls = [];
const SupabaseMFA = {
  async signInWithPassword(email, password){
    calls.push({ email, password });
    // Simulate production today: only the raw PIN is a valid Auth password.
    if(password === "482913") return { ok: true, data: {} };
    return { ok: false, error: "Invalid login credentials" };
  }
};
const factory = new Function(
  "safeTrim", "normalizeEmailValue", "SupabaseMFA",
  helperSrc + "\nreturn { deriveGiAuthPassword, resolveAgentAuthPassword, signInAgentAuth };"
);
const { deriveGiAuthPassword, resolveAgentAuthPassword, signInAgentAuth } = factory(
  safeTrim, normalizeEmailValue, SupabaseMFA
);

console.log("1) existing user with no provisioning record — first attempt is the raw PIN");
calls.length = 0;
const legacySec = { authEmail: "agent@example.com", mfaRequired: true, authPasswordScheme: "" };
assert(
  resolveAgentAuthPassword("482913", "agent@example.com", legacySec) === "482913",
  "legacy agentSecurity resolves to the raw PIN, not a derived password"
);
(async () => {
  const r1 = await signInAgentAuth("agent@example.com", "482913", legacySec);
  assert(r1.ok === true, "existing user logs in");
  assert(calls.length === 1, "exactly one Auth round-trip on success (no extra attempts)");
  assert(calls[0].password === "482913", "the single call used the PIN the agent typed");

  console.log("\n2) missing agentSecurity entry behaves the same");
  calls.length = 0;
  const r2 = await signInAgentAuth("agent@example.com", "482913", null);
  assert(r2.ok === true, "no security record still logs in");
  assert(calls.length === 1 && calls[0].password === "482913", "still a single raw-PIN attempt");

  console.log("\n3) wrong PIN still fails (no accidental bypass via derived password)");
  calls.length = 0;
  const r3 = await signInAgentAuth("agent@example.com", "000000", legacySec);
  assert(r3.ok !== true, "wrong PIN is rejected");
  assert(
    calls.every((c) => c.password !== "482913"),
    "a wrong PIN is never rewritten into the correct password"
  );
  assert(calls.length <= 2, "failed login costs at most one extra round-trip");

  console.log("\n4) provisioned user (gi-v1) still falls back to the raw PIN");
  calls.length = 0;
  const provisioned = { authEmail: "agent@example.com", authPasswordScheme: "gi-v1" };
  const r4 = await signInAgentAuth("agent@example.com", "482913", provisioned);
  assert(r4.ok === true, "gi-v1 agent whose Auth password is still the PIN can log in");
  assert(calls[0].password === deriveGiAuthPassword("482913", "agent@example.com"), "tries derived first");
  assert(r4.passwordScheme === "pin", "reports the scheme that actually worked");

  console.log("\n5) source guards for the untouched login paths");
  assert(app.includes('client.rpc("gi_verify_agent_login"'), "PIN login RPC untouched");
  assert(app.includes('source:"server_unavailable"'), "PIN login still fails closed when RPC is down");
  assert(
    app.includes("if(sec.pinOnlyLogin === true) return false;"),
    "PIN-only agents still skip the Auth/MFA branch entirely"
  );
  assert(app.includes("editSec.pinOnlyLogin === true"), "saving a PIN-only agent never provisions Auth");
  assert(
    /const pin = safeTrim\(input\?\.pin\) \|\| safeTrim\(input\?\.pass\) \|\| "";/.test(app),
    "no 0000 default that could overwrite a real server PIN"
  );
  assert(app.includes("window.__GI_FACE_LOGIN_ACTIVE__"), "face-login guards still in the submit path");

  console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed);
  if(failed) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
