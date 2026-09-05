/* GI-OPS 2026-08-27 — מעקב נציגים בשיחה אצל מנהל תפעול:
   שם הלקוח שהנציג נמצא איתו כעת בשיחה.
   בלי שינוי בלוגיקת השיחה / שיוך / persist.
   הרצה: node _test-ops-live-agent-customer.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260905-pledge-bens-v1";
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

const dashStart = app.indexOf("const OpsDashboardUI = {");
const dashEnd = app.indexOf("const TypingPacketUI = {");
const dashBlock = dashStart > 0 && dashEnd > dashStart ? app.slice(dashStart, dashEnd) : "";

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-live-agent-customer.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) תצוגה למנהל — עמודת שם לקוח");
assert(!!dashBlock, "OpsDashboardUI נמצא");
assert(dashBlock.includes("liveCustomerName(rec){"), "עוזר שם לקוח חי");
assert(dashBlock.includes("this.liveCustomerName(liveRec)"), "collectLiveAgents משתמש בשם החי");
assert(dashBlock.includes('opsDashAgent__whoLbl">בשיחה עם'), "תווית בשיחה עם בשורה");
assert(dashBlock.includes("opsDashAgent__whoName"), "שם הלקוח בעמודה נפרדת");
assert(dashBlock.includes("נציגים מחוברים"), "כותרת נציגים מחוברים");
assert(dashBlock.includes("שידור חי · ${agentsConnected} מחוברים · ${agentsInCall} בשיחה"), "כותרת המשנה מציינת מחוברים ובשיחה");
assert(dashBlock.includes('const agentsHtml = (!listBucket && isManager)'), "מעקב נציגים נשאר למנהל בלבד");
assert(css.includes(".opsDashAgent__who"), "עיצוב עמודת הלקוח");
assert(css.includes(".opsDashAgent__aside"), "במובייל אזור הסטטוס מקבל שורה");

console.log("\n3) אין נגיעה בלוגיקת שיחה / שיוך");
assert(dashBlock.includes("agentMatchesCall(agent, rec, call){"), "התאמת נציג לשיחה לא הוסרה");
assert(dashBlock.includes("call?.active && safeTrim(call?.startedAt)"), "זיהוי שיחה חיה נשאר לפי callSession");
assert(app.includes("try{ setOpsTouch(rec,{liveState:\"in_call\""), "סימון in_call בתחילת שיחה נשאר");
assert(html.includes('id="mcCallStartBtn"'), "לחצן התחלת שיחה לא נגע");
assert(dashBlock.includes("data-ops-dash-assign"), "שיוך מהתור לא נגע");
assert(dashBlock.includes('kpiCard("waiting_mirror", "ממתינים לשיקוף")'), "כרטיסי KPI לא נגעו");

console.log("\n4) התנהגות — שם לקוח ורינדור שורה");
function safeTrim(v){
  return v == null ? "" : String(v).trim();
}
function escapeHtml(v){
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const nameSrc = sliceBetween(app, "liveCustomerName(rec){", "agentMatchesCall(agent, rec, call){");
const renderSrc = sliceBetween(app, "renderAgentRows(agents){", "renderWaitingMirrorList(");
assert(!!nameSrc, "ניתן לחלץ liveCustomerName");
assert(!!renderSrc, "ניתן לחלץ renderAgentRows");

const sandbox = { console, safeTrim, escapeHtml };
vm.createContext(sandbox);
vm.runInContext(`
  const api = {
    ${nameSrc}
    ${renderSrc}
  };
  this.api = api;
`, sandbox);
const api = sandbox.api;

assert(api.liveCustomerName({ fullName: "ישראל ישראלי" }) === "ישראל ישראלי", "שם מ-fullName");
assert(api.liveCustomerName({
  fullName: "",
  payload: { primary: { firstName: "רות", lastName: "כהן" } }
}) === "רות כהן", "נפילה ל-primary כשאין fullName");
assert(api.liveCustomerName({
  fullName: "לקוח ללא שם",
  payload: { insureds: [{ data: { firstName: "דן", lastName: "לוי" } }] }
}) === "דן לוי", "נפילה למבוטח ראשי כש-fullName גנרי");
assert(api.liveCustomerName({}) === "לקוח", "ברירת מחדל לקוח");

const liveHtml = api.renderAgentRows([{
  id: "a1",
  name: "דנה כהן",
  initials: "דכ",
  tone: 1,
  live: true,
  paused: false,
  customerId: "c1",
  customerName: "ישראל ישראלי",
  stepLabel: "שלב 2 · פרטי מבוטח/ים",
  startedAt: "2026-08-27T12:00:00.000Z",
  seconds: 90,
  clock: "01:30"
}]);
assert(liveHtml.includes("ישראל ישראלי"), "שם הלקוח מוצג כשהנציג בשיחה");
assert(liveHtml.includes("בשיחה עם"), "תווית בשיחה עם מוצגת");
assert(liveHtml.includes("דנה כהן"), "שם הנציג נשאר");
assert(liveHtml.includes('data-ops-dash-open="c1"'), "לחיצה עדיין פותחת את תיק הלקוח");

const idleHtml = api.renderAgentRows([{
  id: "a2",
  name: "יוסי לוי",
  initials: "יל",
  tone: 0,
  live: false,
  paused: false,
  customerId: "",
  customerName: "",
  stepLabel: "לא בשיחה",
  startedAt: "",
  seconds: 0,
  clock: "—"
}]);
assert(idleHtml.includes("יוסי לוי"), "נציג פנוי עדיין מוצג");
assert(!idleHtml.includes("ישראל ישראלי"), "נציג פנוי לא מציג לקוח קודם");
assert(idleHtml.includes("לא מחובר"), "נציג פנוי מסומן כלא מחובר");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK  " + passed + " assertions");
