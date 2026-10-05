/* מסך הכניסה לא צובע שגיאת F12 בגלל חריגה שלא קשורה להתחברות,
   ולא מושך את דוח מינוי הסוכן לפני שיש משתמש מחובר.
   הרצה: node _test-login-idle-error.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
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

const errAt = app.indexOf('window.addEventListener("error"');
const rejectAt = app.indexOf('window.addEventListener("unhandledrejection"');
const errBlock = app.slice(errAt, rejectAt);
const rejectBlock = app.slice(rejectAt, app.indexOf("// ---------- Config / Local keys", rejectAt));
assert(errAt > 0 && rejectAt > errAt, "מאזיני השגיאה נשארו");
assert(!errBlock.includes("showLoginError"), "שגיאת חלון לא נצבעת על מסך הכניסה");
assert(!rejectBlock.includes("showLoginError"), "דחיית הבטחה לא נצבעת על מסך הכניסה");
assert(errBlock.includes("GLOBAL_ERROR:"), "השגיאה עדיין נרשמת בקונסול");
assert(rejectBlock.includes("UNHANDLED_REJECTION:"), "הדחייה עדיין נרשמת בקונסול");
assert(app.includes("LOGIN_SUBMIT_FAILED:"), "כישלון שליחת הטופס נתפס בתוך ההתחברות");
assert(app.includes('this._setError("שגיאה במערכת. פתח קונסול (F12) לפרטים.")'), "כישלון ההתחברות עצמה עדיין מדווח");
assert(app.includes("BOOT_FAILED:"), "כשל עלייה נתפס ולא נשאר דחייה פתוחה");
assert(app.includes("if(Auth.current) void AgentAppointmentReportStore.fetchActive().catch(() => {});"), "דוח מינוי הסוכן לא נטען לפני כניסה");
assert(!app.includes("void AgentAppointmentReportStore.fetchActive(); }"), "אין משיכה ישנה בלי משתמש");
assert(html.includes("app.js?v=20261005-ops-forms-warm-v1&giSign=29"), "app.js נטען מחדש");
assert(html.includes("20261005-ops-forms-warm-v1"), "תג ה-build לא נדרס");

console.log(failed ? ("FAILED " + failed) : ("OK " + passed));
process.exit(failed ? 1 : 0);
