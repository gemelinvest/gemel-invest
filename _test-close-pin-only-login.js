/**
 * An active agent no longer finishes login with a code alone.
 * The two controls that turned the barcode off are gone.
 * Reset to a new barcode stays. Admin login stays ahead of this path.
 * Run: node _test-close-pin-only-login.js
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const submit = app.slice(app.indexOf("Auth._submit = async function(){"), app.indexOf("const SecurityUI = {"));

console.log("1) the login door");
assert(submit.includes("verifyAdminPinForLogin"), "admin login is still decided before an agent");
assert(submit.includes("readAgentPinOnlyFromServer"), "the server row is still read");
assert(submit.includes("verifyAgentPinForLogin(matched, pin)"), "the login code is still checked");
assert(!/if\(!requiresAuthMfa\)/.test(submit), "a missing barcode flag does not skip the barcode");
assert(!/loginDetailText:\s*"pin_only_server"/.test(submit), "a pin-only flag does not finish login");
assert(submit.includes("פותח אימות דו־שלבי"), "the barcode step still opens after the code");
assert(submit.includes("openAgentSession(matched, pin, { sessionOnly: true, once: true })"), "the session opener is unchanged");
assert(submit.includes("__GI_FACE_LOGIN_ACTIVE__"), "face login still returns on its own path");
assert(html.includes("giNoPinOnly=1"), "the page asks browsers to load this login change");

console.log("\n2) the controls");
assert(!html.includes('id="btnDisableGoogleAuth"'), "cancel-barcode button is gone");
assert(!html.includes('id="btnDisableAuthCompletely"'), "code-only button is gone");
assert(!html.includes("כניסה עם PIN בלבד"), "the code-only label is gone");
assert(html.includes('id="btnResetMfaBarcode"'), "reset to a new barcode stays");
assert(app.includes("async disableCurrentFactor(){"), "the old cancel action refuses");
assert(app.includes("ביטול האימות הדו־שלבי אינו זמין. אפשר לאפס לברקוד חדש."), "cancel tells the manager to reset the barcode");
assert(app.includes("כניסה עם קוד בלבד אינה זמינה."), "code-only action refuses");
assert(app.includes("async resetBarcode()"), "reset barcode action stays");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
