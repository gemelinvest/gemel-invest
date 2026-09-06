/* GI-OPS 2026-08-27 — צ׳ק־ליסט שיקוף: בלי הצגה עצמית / ביטול בעתיד / מספרים,
   ניקוי כותרות מסך המוכנות, והצגת שעה + נציג משקף בתיעוד סטטוס.
   הרצה: node _test-ops-mirror-checklist-ui.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260906-mirror-script-premiums-v3";
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = read("app.js");
const html = read("index.html");
const css = read("app.css");
const sw = read("service-worker.js");

const preStart = app.indexOf("PREFLIGHT_STEPS: Object.freeze([");
const preEnd = app.indexOf("_preFlightReviewedSet(){", preStart);
const preBlock = preStart > 0 && preEnd > preStart ? app.slice(preStart, preEnd) : "";
const paintStart = app.indexOf("_paintPreFlightChecklist(){");
const paintEnd = app.indexOf("_togglePreFlightStep(", paintStart);
const paintBlock = paintStart > 0 && paintEnd > paintStart ? app.slice(paintStart, paintEnd) : "";
const dashStart = app.indexOf("const OpsDashboardUI = {");
const dashEnd = app.indexOf("const TypingPacketUI = {");
const dashBlock = dashStart > 0 && dashEnd > dashStart ? app.slice(dashStart, dashEnd) : "";

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-mirror-checklist-ui.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) צ׳ק־ליסט בלבד");
assert(!!preBlock, "PREFLIGHT_STEPS נמצא");
assert(!/key:\s*"intro"/.test(preBlock), "הצגה עצמית הוסרה מהצ׳ק־ליסט");
assert(!/key:\s*"future"/.test(preBlock), "שינוי או ביטול בעתיד הוסר מהצ׳ק־ליסט");
assert(preBlock.includes('key: "personal"'), "פרטי מבוטח/ים נשארו");
assert(preBlock.includes('key: "needs"'), "בירור והתאמת צרכים נשאר");
assert(preBlock.includes('key: "disclosure"'), "גילוי נאות נשאר");
assert(preBlock.includes('key: "cancel"'), "שאלון ביטול נשאר");
assert(preBlock.includes('key: "beneficiaries"'), "פרטי מוטבים נשארו");
assert(preBlock.includes('key: "health"'), "הצהרת בריאות נשארה");
assert(preBlock.includes('key: "payment"'), "פרטי אמצעי תשלום נשארו");
assert(preBlock.includes('key: "summary"'), "סיכום והצהרות נשאר");
assert(!paintBlock.includes("mcPreFlightItem__n"), "מספרי שלב לא מצוירים בצ׳ק־ליסט");
assert(html.includes('id="mcFlowStep1"') && html.includes("הצגה עצמית"), "הצגה עצמית נשארה בסרגל השיחה");
assert(html.includes('id="mcFlowStep8"') && html.includes("שינוי או ביטול בעתיד"), "ביטול בעתיד נשאר בסרגל השיחה");
assert(app.includes('{ n: 1, keys: ["idle"], label: "הצגה עצמית" }'), "מעקב שלבי שיחה חיה לא נגע");

console.log("\n3) ניקוי מסך המוכנות");
assert(!html.includes("מוכן להתחלת שיחה"), "הוסרה כותרת מוכן להתחלת שיחה");
assert(!html.includes("הצ׳קליסט הושלם · ניתן להתחיל הקלטה"), "הוסרה שורת הסטטוס מתחת לכותרת");
assert(!html.includes("הבחירה מעבירה את הלקוח לחוצץ המתנה בדשבורד התפעול"), "הוסר משפט החוצץ");
assert(!html.includes("יש להשלים את כל העלאות הפרמיות לפני התחלת השיחה"), "הוסר באנר העלאות הפרמיות");
assert(!html.includes("חובה להעלות לכל מבוטח ומוצר שני קבצי Excel"), "הוסר משפט חובת האקסל");
assert(!html.includes("קבצי פרמיות וכיסויים"), "הוסרה כותרת קבצי פרמיות");
assert(html.includes('id="mcReadyCustomerName"'), "כרטיס שם לקוח נשאר");
assert(html.includes('id="mcReadyLaneBtns"'), "לחצני סטטוס נשארו");
assert(!html.includes('id="mcReadyPremiumUploads"'), "אזור העלאת פרמיות הוסר");

console.log("\n4) היפוך עיצוב כרטיס לקוח");
const labelCss = sliceBetween(css, ".mcReadyPanel__label{", "}");
const valueCss = sliceBetween(css, ".mcReadyPanel__value{", "}");
assert(labelCss.includes("font-weight:800") && labelCss.includes("#0f1f4a"), "כותרות כרטיס הלקוח גדולות וכהות");
assert(valueCss.includes("#64748b") && valueCss.includes("font-size:14px"), "ערכי כרטיס הלקוח אפורים");

console.log("\n5) תיעוד סטטוס — שעה + נציג משקף");
assert(app.includes('agent ? ("נציג משקף: " + agent) : ""'), "תיק הלקוח מציג שם נציג משקף");
assert(app.includes('clock ? ("שעה: " + clock) : ""'), "תיק הלקוח מציג שעה");
assert(dashBlock.includes("laneBy: safeTrim(laneDoc?.by)"), "התור קורא את הנציג ששיקף מה-statusLog");
assert(dashBlock.includes("סטטוס: ${escapeHtml(row.laneLabel)}"), "חוצץ המנהל/נציג מציג את הסטטוס שסומן");
assert(dashBlock.includes("שיקף: ${escapeHtml(row.laneBy)}"), "חוצץ המנהל/נציג מציג מי שיקף");
assert(app.includes("store.statusLog.push({"), "applyLane עדיין כותב ל-statusLog");
assert(app.includes("waitingMirrorLane: key"), "applyLane עדיין מעביר לחוצץ הסטטוס");
assert(app.includes("async _documentReadyMirrorLane(laneKey)"), "לחיצת סטטוס במסך השיקוף לא הוסרה");

console.log("\n6) תקינות applyLane — שעה ושם נשמרים");
const laneStart = app.indexOf("/* GI-OPS-THREAD-LANE-START */");
const laneEnd = app.indexOf("async function persistOpsProcessLightGuarded");
assert(laneStart > 0 && laneEnd > laneStart, "בלוק OpsThreadLane נמצא");
const extracted = app.slice(laneStart, laneEnd);
const sandbox = {};
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function nowISO(){ return "2026-08-27T13:42:00.000Z"; }
  const Auth = { current: { id: "ops-1", name: "סתיו כהן" } };
  function ensureOpsProcess(rec){
    if(!rec.payload) rec.payload = {};
    if(!rec.payload.opsProcess) rec.payload.opsProcess = {};
    return rec.payload.opsProcess;
  }
  function setOpsTouch(rec, patch){
    const store = ensureOpsProcess(rec);
    Object.assign(store, patch || {});
    return store;
  }
  ${extracted}
  this.OpsThreadLane = OpsThreadLane;
`, sandbox);

const rec = {
  id: "c-ready",
  fullName: "לגנאו ביילין",
  payload: { opsProcess: {} }
};
const applied = sandbox.OpsThreadLane.applyLane(rec, "no_answer_1", { id: "ops-1", name: "סתיו כהן" });
assert(applied && applied.ok === true, "applyLane מצליח");
assert(rec.payload.opsProcess.waitingMirrorLane === "no_answer_1", "הסטטוס נשמר בחוצץ");
const last = rec.payload.opsProcess.statusLog[rec.payload.opsProcess.statusLog.length - 1];
assert(last && last.by === "סתיו כהן", "נשמר שם הנציג ששיקף");
assert(last && last.at === "2026-08-27T13:42:00.000Z", "נשמר חותם זמן");
assert(last && last.label === "ללא מענה 1", "נשמרה תווית הסטטוס");

console.log("\n7) רגרסיה — לא נגענו במסכים אחרים");
assert(html.includes('id="mcCallStartBtn"'), "לחצן התחלת שיחה נשאר");
assert(html.includes('id="lcSendToOps"'), "הגש לתפעול במסך סיום לא נגע");
assert(app.includes("if(!hasSubmittedHealthRisksToOps(rec)) return false;"), "שער ממתינים לשיקוף מהגשה נשאר");
assert(dashBlock.includes('const agentsHtml = (!listBucket && isManager)'), "וידג'טי מנהל עדיין מוסתרים מנציג");
assert(!app.includes("_collectMirrorPremiumUploadSlots"), "לוגיקת העלאת פרמיות הוסרה");
assert(!html.includes("סמן וי על הפרמיות (זמני)"), "לחצן סימון פרמיות הוסר");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
