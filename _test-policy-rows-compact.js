/* GI-UI 2026-08-29 — שורות פוליסה קומפקטיות בתיק לקוח:
   עיצוב + תווית «בדיקת התאמת ביטוח», בלי נגיעה בלוגיקת סריקה/העלאה.
   הרצה: node _test-policy-rows-compact.js
*/
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260830-policy-actions-align-v1";
let failed = 0;
let passed = 0;
function assert(cond, msg){
  if(cond){ passed += 1; console.log("  PASS  " + msg); }
  else { failed += 1; console.error("  FAIL  " + msg); }
}
function read(name){ return fs.readFileSync(path.join(ROOT, name), "utf8"); }

const app = read("app.js");
const theme = read("theme.css");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("theme.css?v=" + APP_TAG), "index.html theme.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) UI — תווית + שורות קומפקטיות");
assert(app.includes('uploadLabel = status ? "החלף פוליסה" : "בדיקת התאמת ביטוח"'), "תווית בדיקת התאמת ביטוח");
assert(!app.includes('"העלה פוליסה"'), "הוסר טקסט העלה פוליסה");
assert(app.includes("cfNewPolicyGrid__head"), "כותרות עמודות לטבלה הקומפקטית");
assert(app.includes('cell(\'סכום\', amountText)'), "עמודת סכום קבועה");
assert(theme.includes("min-height: 46px"), "גובה שורה קומפקטי");
assert(theme.includes("96px 252px"), "פרמיה+פעולות ברוחב קבוע (לא auto)");
assert(theme.includes("grid-template-columns: 72px minmax(120px, 1.25fr)"), "תבנית גריד משותפת לראש ולשורה");
assert((theme.match(/96px 252px/g) || []).length >= 2, "כותרת ושורת כרטיס חולקים אותה תבנית");
assert(theme.includes(".cfNewPolicyCard__logo .lcCompanyLogo:not(#\\9):not(#\\9)"), "override לוגו נשאר");
assert(theme.includes("object-fit: contain"), "לוגו מלא ללא חיתוך");
assert(theme.includes("background: transparent !important") && theme.includes(".cfNewPolicyCard__logo:not(#\\9):not(#\\9)"), "לוגו בלי קוביה");

console.log("\n3) אין נגיעה בלוגיקת סריקה / העלאה");
assert(app.includes("renderIssuedPolicyScanBar(policy, scan)"), "רינדור סרגל סריקה נשאר");
assert(app.includes("data-issued-policy-upload"), "data attribute להעלאה נשאר");
assert(app.includes("canShowIssuedPolicyUpload()"), "שער הרשאות העלאה לא נגע");
assert(app.includes("buildIssuedScanSnapshot(rec, policy)"), "השוואת פוליסה להצעה לא נגעה");
assert(app.includes("openIssuedPolicyGapsModal(rec, policyId)"), "מודל פערים לא נגע");
assert(app.includes("getHealthCoverRowsForDisplay(rec, policy)"), "פירוט כיסויים לא נגע");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK  " + passed + " assertions");
