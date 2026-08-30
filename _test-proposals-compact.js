/* GI-UI 2026-08-29 — מסך הצעות קומפקטי:
   הסרת טקסט הסבר + עיצוב שורות צפוף, בלי נגיעה בלוגיקה.
   הרצה: node _test-proposals-compact.js
*/
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260830-customer-open-perf-v1";
let failed = 0, passed = 0;
function assert(cond, msg){
  if(cond){ passed++; console.log("  PASS  " + msg); }
  else { failed++; console.error("  FAIL  " + msg); }
}
function read(name){ return fs.readFileSync(path.join(ROOT, name), "utf8"); }

const html = read("index.html");
const app = read("app.js");
const css = read("app.css");
const theme = read("theme.css");
const sw = read("service-worker.js");

const proposalsStart = html.indexOf('id="view-proposals"');
const proposalsEnd = html.indexOf('id="view-elementaryProposals"');
const proposalsBlock = proposalsStart >= 0 && proposalsEnd > proposalsStart
  ? html.slice(proposalsStart, proposalsEnd) : "";

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(html.includes("theme.css?v=" + APP_TAG), "index.html theme.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) UI — הסרת הסבר + קומפקטיות");
assert(!!proposalsBlock, "בלוק view-proposals נמצא");
assert(proposalsBlock.includes('card__title">הצעות'), "כותרת הצעות נשארה");
assert(!proposalsBlock.includes("card__hint"), "טקסט ההסבר הוסר ממסך הצעות");
assert(!proposalsBlock.includes("טיוטות והצעות שהוגשו לחיתום"), "משפט ההסבר לא מופיע במסך הצעות");
assert(theme.includes("20260829-proposalsCompact-v1"), "theme compact build marker");
assert(theme.includes("font-weight: 700 !important") && theme.includes(".lcProposalsName strong"), "שם לקוח לא מגושם");
assert(css.includes("font-weight:700") && css.includes("#view-proposals .lcProposalsName strong"), "app.css משקל שם מעודכן");
assert(theme.includes("padding: 7px 12px !important"), "padding שורה קומפקטי");

console.log("\n3) אין נגיעה בלוגיקה");
assert(app.includes("renderProposalRowHtml"), "רינדור שורת הצעה נשאר");
assert(app.includes('data-open-proposal="'), "המשך עריכה נשאר");
assert(app.includes("bindProposalRowActions"), "קישור פעולות נשאר");
assert(app.includes("openById(id)"), "פתיחת הצעה לפי id לא נגעה");
assert(html.includes('id="proposalsTbody"'), "tbody הצעות לא הוסר");
assert(html.includes('id="btnProposalsRefresh"'), "רענון רשימה לא הוסר");
assert(html.includes('id="proposalsSearch"'), "חיפוש הצעות לא הוסר");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK  " + passed + " assertions");
