/* שלבי שיקוף: הסרת אזור השיקולים, הנחה מדורגת, חזרה מימין, השארת ביטוח.
   הרצה: node _test-mirror-step-ui.js
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
  }else{
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function sliceBetween(src, start, end){
  const i = src.indexOf(start);
  if(i < 0) return "";
  const j = src.indexOf(end, i + start.length);
  return j > i ? src.slice(i, j) : "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");

assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

const reasons = sliceBetween(app, "_renderNeedsReasons(rec){", "_renderNeedsCompareNotice(rec){");
assert(reasons.includes("השיקולים העיקריים במתן ההמלצה הינם הם:"), "נוסח השיקולים נשאר");
assert(!reasons.includes("mcReasonStatus"), "שורת סטטוס מהאשף הוסרה");
assert(!reasons.includes("mcReasonCard"), "כרטיס המבוטח הוסר");
assert(!reasons.includes("סטטוס מהאשף"), "הכיתוב סטטוס מהאשף הוסר");

const offer = sliceBetween(app, "meta += `<button type=\"button\" class=\"mcOfferCard__discBtn\"", "meta += this._mcHealthCoverDiscountHtml");
assert(offer.includes("הצג הנחה"), "דירוג ההנחה נפתח מלחצן");
assert(offer.includes("mcOfferCard__discKeep"), "הדירוג לא נשאר גלוי על הכרטיס");
assert(app.includes("_openMcDiscountEdit(policyId){"), "מסך הדירוג נפתח");
assert(app.includes("_mcWriteGradedDiscount(policy, schedule, option){"), "שמירת דירוג נשארת על הפוליסה");
assert(css.includes(".mcOfferCard__line--graded{") && css.includes("justify-content:flex-start"), "המספרים צמודים למשפט");
assert(css.includes(".mcOfferCard__line--graded strong{\n  font-size:20px;"), "המספרים גדולים יותר");

assert(css.includes(".mcNeedsNav__secondary{order:1;}"), "חזרה מימין");
assert(css.includes(".mcNeedsNav__primary{order:2;}"), "המשך משמאל לחזרה");

const row = sliceBetween(app, "_mcCancelQRowHtml(item, store, options, statusOptions){", "_mcPatchCancelQRow(rec, policyId){");
assert(!row.includes("הלקוח מבטל"), "הוסר הלקוח מבטל");
assert(!row.includes("data-mc-cancelq-confirm"), "הוסרו כן ולא");
assert(row.includes("הלקוח החליט להשאיר את הביטוח ולא לבטל"), "סימון השארה על השורה");
assert(app.includes('["keptActive", "השארת הביטוח"]'), "ההשארה נכנסת לדוח תיקוני ההצעה");
assert(app.includes('keptActive: kept ? "הלקוח החליט להשאיר את הביטוח ולא לבטל"'), "נוסח ההשארה בדוח");
assert(app.includes('return { label: "פוליסה פעילה", cls: "is-activePolicy" }'), "פוליסה פעילה בתיק");
assert(sliceBetween(app, "renderOldPolicyTableRow(policy, rec){", "renderAgentAppointmentTableRow(policy, rec){").includes("פוליסה פעילה"), "שורת הפוליסה הישנה מציגה פוליסה פעילה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
