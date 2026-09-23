/* GI-FIX 2026-09-22 — QR של 2FA נשאר בחלון ניהול המשתמשים אחרי הסריקה הראשונה.
   Run: node _test-admin-2fa-qr-persist.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260923-mirror-original-form-v5";
let failed = 0;
let passed = 0;

function assert(cond, msg){
  if(cond){
    passed += 1;
    console.log("  PASS  " + msg);
  } else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");

console.log("1) cache tags + syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(app.includes('const BUILD = "' + TAG + '"'), "app.js BUILD");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "wizard js version");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard build");
assert(sw.includes(TAG) || sw.includes("gi-v12-" + TAG), "service worker cache");

console.log("\n2) admin 2FA modal keeps the QR");
assert(html.includes('id="lcSecurityQrBox"'), "security QR box exists");
assert(html.includes("הברקוד נשאר כאן גם אחרי הסריקה הראשונה"), "modal says QR stays after first scan");
assert(app.includes("storedMfaQrMarkup"), "stored QR helper");
assert(app.includes("ה-QR נשאר זמין לסריקה חוזרת"), "active status keeps QR");
assert(!app.includes("למשתמש כבר יש Google Authenticator פעיל. אין ברקוד שמור לסריקה חוזרת."), "dead-end 'no QR stored' copy removed");
assert(app.includes("צור QR לסריקה חוזרת"), "missing stored QR can generate a new one");
assert(app.includes("הצג QR לסריקה חוזרת"), "stored QR can be reshown");
assert(app.includes("MFA QR reshown"), "reshow path persists");
assert(app.includes("totpUri: existingSec.totpUri") || app.includes("totpUri: existingSec.totpUri,"), "verify keeps totpUri");
assert(app.includes("totpUri: keepSec.totpUri"), "active render keeps totpUri");

console.log("\n3) login flow is unchanged");
assert(app.includes('this._showMfaStep(matched, flow.factorId'), "login still opens MFA after PIN");
assert(app.includes("הקש סיסמה מהאפליקציה"), "login MFA title stays");
assert(app.includes("btnShowLoginMfaQr"), "login recovery button from previous fix stays");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
