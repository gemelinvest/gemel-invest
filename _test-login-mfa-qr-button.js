/* GI-FIX 2026-09-22 — כפתור QR בשלב MFA אחרי PIN (שכחתי / טלפון אחר).
   Run: node _test-login-mfa-qr-button.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260922-mirror-health-q-v2";
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
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const split = fs.readFileSync(path.join(ROOT, "login-split.css"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");

console.log("1) cache tags + syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(app.includes('const BUILD = "' + TAG + '"'), "app.js BUILD tag");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "wizard js version aligned");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard build aligned");
assert(sw.includes(TAG) || sw.includes("gi-v12-" + TAG), "service worker cache");

console.log("\n2) login MFA markup always has the QR button");
assert(html.includes('id="btnShowLoginMfaQr"'), "button id in index.html");
assert(html.includes("שכחתי את האפליקציה / טלפון אחר"), "Hebrew recovery label");
const mfaStart = html.indexOf('id="lcLoginMfaStep"');
const mfaEnd = html.indexOf('id="lcLoginError"');
const mfaHtml = mfaStart >= 0 && mfaEnd > mfaStart ? html.slice(mfaStart, mfaEnd) : "";
assert(mfaHtml.includes('id="btnShowLoginMfaQr"'), "button is inside MFA step");
assert(mfaHtml.includes('id="btnVerifyLoginMfa"'), "verify button still present");
assert(mfaHtml.indexOf("btnShowLoginMfaQr") < mfaHtml.indexOf("btnVerifyLoginMfa"), "QR button appears before verify");

console.log("\n3) Auth reveal / re-enroll wiring");
assert(app.includes("Auth._revealLoginMfaQr"), "reveal helper");
assert(app.includes("Auth._enrollFreshTotpForLogin"), "fresh enroll helper");
assert(app.includes("Auth._openLoginMfaQr"), "open helper");
assert(app.includes("Auth._closeLoginMfaQr"), "close helper");
assert(app.includes("showQrBtn: $('#btnShowLoginMfaQr')"), "elements map includes button");
assert(app.includes("on($('#btnShowLoginMfaQr'),'click'"), "click bound in Auth.init");
assert(app.includes("showQrBtn.hidden = normalizedMode !== 'verify'"), "button shown in verify, hidden in enroll");
assert(app.includes("setupBox.hidden = !(normalizedMode === 'enroll' && hasQr)"), "verify does not auto-open QR");
assert(app.includes("פנה למנהל מערכת בניהול משתמשים כדי לאפס את ה-2FA"), "AAL2 fallback message");

console.log("\n4) CSS cannot keep hiding QR after the button opens it");
assert(css.includes('[data-mode="verify"].is-qr-open .lcLogin__mfaSetupBox'), "app.css is-qr-open override");
assert(html.includes('[data-mode="verify"].is-qr-open .lcLogin__mfaSetupBox'), "critical login CSS override");
assert(split.includes("#btnShowLoginMfaQr:not([hidden])"), "login-split shows the button");
assert(html.includes("#btnShowLoginMfaQr:not([hidden])"), "critical CSS shows the button");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
