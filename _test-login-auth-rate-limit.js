/**
 * A user marked for 2FA must not enter when the Auth session cannot open.
 * The browser must not send a password grant (that 429s the office NAT).
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
const mfaStart = app.indexOf("this._setPrimaryLoginLoading(true, 'פותח אימות דו־שלבי...')");
const submit = app.slice(mfaStart, mfaStart + 1600);
assert(mfaStart > app.indexOf("const pinCheck = await verifyAgentPinForLogin(matched, pin);"), "PIN is verified before the MFA session");
assert(submit.includes("await openAgentSession(matched, pin)"), "MFA login opens one server session");
assert(!submit.includes("signInAgentAuth("), "login form does not send a browser password grant");
assert(!submit.includes("completeAgentLogin"), "a failed MFA session does not open the CRM");
assert(submit.includes("הכניסה נעצרה"), "failed session stays on the login screen");
assert(html.includes("giLoginOpen=2"), "login cache tag bumped");

console.log("OK _test-login-auth-rate-limit.js");
