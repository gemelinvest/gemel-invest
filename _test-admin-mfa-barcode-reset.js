/* GI-FIX 2026-10-05 — איפוס ברקוד 2FA מניהול משתמשים.
   נציג עם Authenticator ישן (טלפון שהוחלף / אין ברקוד) מקבל ברקוד חדש,
   והכניסה הבאה דורשת לסרוק אותו.
   Run: node _test-admin-mfa-barcode-reset.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
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
const fn = fs.readFileSync(path.join(ROOT, "supabase/functions/gi-provision-agent-auth/index.ts"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-admin-mfa-barcode-reset.js")]).status === 0, "node --check test");

console.log("\n2) admin button resets the old barcode");
assert(html.includes('id="btnResetMfaBarcode"'), "reset button in the security modal");
assert(html.includes("אפס לברקוד חדש"), "reset button label");
assert(app.includes("resetBarcode:$('#btnResetMfaBarcode')"), "button is wired");
assert(app.includes("on(this.els.resetBarcode,'click',()=>this.resetBarcode())"), "click resets");
assert(app.includes("async resetBarcode()"), "reset handler");
assert(app.includes("action: \"reset_mfa\""), "client calls reset_mfa");
assert(app.includes("הסיסמה הדו-שלבית הישנה באפליקציה תפסיק לעבוד."), "confirm explains the old code dies");
assert(app.includes("בכניסה הבאה המערכת תציג ברקוד חדש, והנציג יידרש לסרוק אותו ולהזין קוד חדש."), "confirm explains the next login");
assert(app.includes("mfaResetPending: true"), "pending flag is stored");
assert(app.includes("ממתין לברקוד חדש"), "users table shows waiting for a new barcode");

console.log("\n3) server deletes the verified factor (AAL1 cannot)");
assert(fn.includes('action === "reset_mfa"'), "edge action reset_mfa");
assert(fn.includes("/auth/v1/admin/users/"), "admin factors API");
assert(fn.includes('method: "DELETE"'), "admin delete factor");
assert(fn.includes("async function resetAgentMfa"), "reset helper");
assert(fn.includes("verifyAdminActor"), "still requires a manager");
assert(!fn.includes("service_role") || fn.includes("SUPABASE_SERVICE_ROLE_KEY"), "service role stays on the server");

console.log("\n4) next login must scan the new barcode");
const prep = app.slice(app.indexOf("Auth._prepareEnrollmentForLogin"), app.indexOf("Auth._setError = function"));
assert(prep.includes("const resetPending = secNow.mfaResetPending === true || security?.mfaResetPending === true"), "login reads the reset flag");
assert(prep.includes("if(!resetPending && security?.mfaEnabled === true && cachedFactorId)"), "verified users are not forced to rescan");
assert(prep.includes("mode:'enroll'"), "reset opens enroll, not the old code");
assert(app.includes("הברקוד הקודם בוטל. סרוק את הברקוד החדש ואז הזן את הסיסמה החדשה מהאפליקציה."), "login tells the agent to scan the new code");
assert(app.includes("mfaResetPending:false"), "a valid new code clears the reset");
assert(app.includes("if(base?.mfaResetPending === true)"), "merge does not revive the old factor");

console.log("\n5) the old red error is no longer the admin dead end");
assert(app.includes("await this.resetBarcode()"), "create-QR falls through to reset when the old factor cannot be removed");
assert(app.includes("לא ניתן ליצור QR חדש בלי לבטל את החיבור הישן"), "non-admin still sees the old message");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
