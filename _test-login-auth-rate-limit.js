/**
 * Office login must not die when Auth is 429 / email case drifts.
 * Run: node _test-login-auth-rate-limit.js
 */
const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(/toLowerCase\(\)/.test(app.slice(app.indexOf("const normalizeEmailValue"), app.indexOf("const normalizeEmailValue") + 120)), "emails used for Auth are lowercased");
assert(app.includes("autoRefreshToken: false"), "must not auto-refresh dead tokens from the office NAT");
assert(app.includes("retries: 0"), "password grant must not retry into a 429");
assert(app.includes('signInWithPassword({ email: targetEmail, password })'), "password grant uses the lowercased email");
assert(!/const order = scheme === "pin"/.test(app), "must not send a second raw-PIN Auth attempt");
assert(app.includes("const pinCheck = await verifyAgentPinForLogin(matched, pin);"), "PIN is verified before Auth");
const submit = app.slice(app.indexOf("if(requiresAuthMfa){"), app.indexOf("if(requiresAuthMfa){") + 1800);
assert(submit.includes("await completeAgentLogin(matched);"), "verified PIN still opens the CRM when Auth fails");
assert(!submit.includes("נחסמו יותר מדי ניסיונות כניסה מהרשת הזו"), "429 must not block a verified PIN");
assert(html.includes("giLoginOpen=1"), "login cache tag bumped");

console.log("OK _test-login-auth-rate-limit.js");
