/* שם שלא קיים וקוד שגוי מוצגים באותו משפט. כניסה נכונה, נעילה ומשתמש מושבת נשארים.
   הרצה: node _test-login-uniform-error.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const phone = fs.readFileSync(path.join(ROOT, "phone/phone.js"), "utf8");
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start < 0 ? 0 : start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

console.log("1) the desktop screen uses one sentence for a missing name and a wrong code");
const submit = sliceBetween(app, "Auth._submit = async function(){", "const SecurityUI = {");
const shown = sliceBetween(submit, "if(!matched){", "if(matched.active === false)");
assert(shown.includes('detail === "שם משתמש לא נמצא"') && shown.includes('"קוד כניסה שגוי"'), "a missing name is shown as a wrong code");
assert(shown.includes("return this._setError(sameAsBadPin ? \"קוד כניסה שגוי\" : detail)"), "a roster or ambiguous-name message is still shown");
assert(submit.includes("if(matched.active === false) return this._setError('קוד כניסה שגוי')"), "a disabled user sees the same sentence as a wrong code");
assert(submit.includes("verifyAgentPinForLogin(matched, pin)"), "a matching name still checks the code");
assert(submit.includes("this.unlock()"), "a correct admin login still opens the system");

console.log("2) the server still tells the two cases apart, and the lock stays");
const verify = sliceBetween(app, "async function verifyAgentPinForLogin(agent, pin){", "async function verifyAdminPinForLogin");
assert(verify.includes('code === "LOCKED"') && verify.includes("נעלת את הכניסה"), "a lock is still explained");
assert(verify.includes("נותר ניסיון אחרון"), "the last attempt is still explained");
assert(verify.includes('msg = "קוד כניסה שגוי"'), "a wrong code stays a wrong code");
assert(verify.includes("data.ok === true") && verify.includes('return { ok:true, source:"server" }'), "a correct code still passes");

console.log("3) the phone and the mail code use the same screen rule");
const phoneMsg = sliceBetween(phone, "function loginMessage(code, extra) {", "function readStoredProfile");
assert(phoneMsg.includes('key === "AGENT_DISABLED"') && phoneMsg.includes('return "קוד כניסה שגוי"'), "the phone shows one sentence");
assert(phoneMsg.includes("נעלת את הכניסה"), "the phone still explains a lock");
const mail = sliceBetween(app, "Auth._loginMailErrorText = function(code){", "Auth._setLoginMailError");
assert(mail.includes('key === "EMAIL_MISMATCH" || key === "USER_NOT_FOUND"'), "a missing mail user and a wrong mail use one sentence");
assert(!mail.includes('return "שם משתמש לא נמצא"'), "the mail screen does not say the username is missing");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
