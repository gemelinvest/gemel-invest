/* GI-OPS 2026-08-27 — ממתינים לשיקוף לפי שיוך וחוצץ סטטוס;
   שיוכי שיקוף רק מהגש לתפעול; בלי לחצני דשבורד.
   הרצה: node _test-ops-waiting-lanes-assign.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260827-clal-prod-commit-v1";
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

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

const app = read("app.js");
const html = read("index.html");
const css = read("app.css");
const sw = read("service-worker.js");

const dashStart = app.indexOf("const OpsDashboardUI = {");
const dashEnd = app.indexOf("const TypingPacketUI = {");
const dashBlock = dashStart > 0 && dashEnd > dashStart ? app.slice(dashStart, dashEnd) : "";
const assignStart = app.indexOf("const MirrorAssignmentsUI = {");
const assignEnd = app.indexOf("const ElementaryMirrorUI = {");
const assignBlock = assignStart > 0 && assignEnd > assignStart ? app.slice(assignStart, assignEnd) : "";
const filterStart = dashBlock.indexOf("filterWaitingMirrorRowsByLane(rows){");
const filterEnd = dashBlock.indexOf("collectWaitingTypingRows(){");
const filterBlock = filterStart >= 0 && filterEnd > filterStart ? dashBlock.slice(filterStart, filterEnd) : "";

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-waiting-lanes-assign.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) ממתינים לשיקוף — שיוך + חוצצי סטטוס");
assert(dashBlock.includes("currentUserMatchesMirrorAssign(getMirrorAssign(rec))"), "נציג רואה רק לקוחות ששויכו אליו");
assert(filterBlock.includes('safeTrim(row.laneKey) || "no_answer_1"'), "חוצץ מסנן לפי סטטוס מתועד");
assert(!filterBlock.includes("waitingMirrorLaneOf(row, scheduledIds)"), "אין דריסה של סטטוס מתועד ע״י overlay");
assert(dashBlock.includes('data-ops-mirror-lane='), "לחצני חוצץ ללא מענה נשארו");
assert(dashBlock.includes("לקוחות ששויכו אליך וממתינות לשיחת שיקוף") || dashBlock.includes("הצעות ששויכו אליך וממתינות לשיחת שיקוף"), "כותרת משנה לנציג נשארה בפאנל התור");

console.log("\n3) כותרת מסך ממתינים");
assert(dashBlock.includes("opsDash__hello"), "ברכת היום + שם בטקסט רגיל");
assert(css.includes(".opsDash__hello"), "עיצוב ברכה קטנה קיים");
assert(!dashBlock.includes("מסך ממתינים לשיקוף"), "הוסרה כותרת מסך ממתינים לשיקוף");
assert(dashBlock.includes("getTimeGreeting()"), "ברכת היום נשארה");

console.log("\n4) לחצני דשבורד הוסרו, מסכים נשארו");
assert(!dashBlock.includes('data-ops-dash-go="mirrorCall"'), "לחצן שיחת שיקוף הוסר מדשבורד");
assert(!dashBlock.includes('data-ops-dash-go="mirrorAssignments"'), "לחצן שיוכי שיקוף הוסר מדשבורד");
assert(!dashBlock.includes('data-ops-dash-go="myProcesses"'), "לחצן התהליכים שלי הוסר מדשבורד");
assert(html.includes('id="view-mirrorCall"'), "מסך שיחת שיקוף לא הוסר");
assert(html.includes('id="view-mirrorAssignments"'), "מסך שיוכי שיקוף לא הוסר");
assert(html.includes('id="view-myProcesses"') || html.includes('id="myProcessesTbody"'), "מסך התהליכים שלי לא הוסר");
assert(dashBlock.includes('UI.goView("mirrorCall")'), "פתיחת שיקוף משורת התור נשארה");

console.log("\n5) שיוכי שיקוף רק מהגש לתפעול");
assert(assignBlock.includes("hasSubmittedHealthRisksToOps"), "רשימת שיוך דורשת הגש לתפעול");
assert(assignBlock.includes("isHealthRisksWizardCompleted"), "רשימת שיוך מוגבלת לבריאות וסיכונים");
assert(!assignBlock.includes(".slice(0, 400)"), "הוסר חיתוך 400 לקוחות כלליים");
assert(app.includes("function setMirrorAssign(rec, agent, byName)"), "לוגיקת שמירת שיוך לא נגעה");

console.log("\n6) רגרסיה");
assert(app.includes("if(!hasSubmittedHealthRisksToOps(rec)) return false;"), "שער ממתינים לשיקוף נשאר");
assert(dashBlock.includes('const agentsHtml = (!listBucket && isManager)'), "וידג'טי מנהל עדיין רק למנהל");
assert(html.includes('id="lcSendToOps"'), "הגש לתפעול במסך סיום לא נגע");
assert(html.includes('id="mcCallStartBtn"'), "לחצן התחלת שיחה לא נגע");
assert(html.includes('nav__label">שיחת שיקוף') || html.includes("שיחת שיקוף"), "ניווט שיחת שיקוף בסרגל לא הוסר");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
