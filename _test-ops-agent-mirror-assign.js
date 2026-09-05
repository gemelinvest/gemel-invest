/* GI-OPS 2026-08-30 — שיוך מנהל תפעול → נציג תפעול באמת מגיע לנציג:
   טעינה לפי payload.mirrorFlow.mirrorAssign (לא agent_id של מכירות),
   upsert ישיר בשמירת השיוך, וסינון סשן לנציג לפי השיוך.
   הרצה: node _test-ops-agent-mirror-assign.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260905-couple-covers-v1";
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
const sw = read("service-worker.js");

const scopeStart = app.indexOf("function getServerListAgentScopeFilter(){");
const scopeEnd = app.indexOf("function getOpsAgentMirrorAssignScope(){", scopeStart);
const scopeBlock = scopeStart > 0 && scopeEnd > scopeStart ? app.slice(scopeStart, scopeEnd) : "";
const opsScopeStart = app.indexOf("function getOpsAgentMirrorAssignScope(){");
const opsScopeEnd = app.indexOf("function buildAgentScopeInValues(values){", opsScopeStart);
const opsScopeBlock = opsScopeStart > 0 && opsScopeEnd > opsScopeStart ? app.slice(opsScopeStart, opsScopeEnd) : "";
const loadStart = app.indexOf("/* GI-FIX 2026-08-30: נציג תפעול — טעינה לפי שיוך שיקוף");
const loadEnd = app.indexOf("async probeCustomersCount(){", loadStart);
const loadBlock = loadStart > 0 && loadEnd > loadStart ? app.slice(loadStart, loadEnd) : "";
const saveStart = app.indexOf("async saveAssignModal(){");
const saveEnd = app.indexOf("async clearAssignModal(){", saveStart);
const saveBlock = saveStart > 0 && saveEnd > saveStart ? app.slice(saveStart, saveEnd) : "";
const sheetsStart = app.indexOf("async _loadSheetsUnlocked(options = {}){");
const sheetsEnd = app.indexOf("async saveSheets(state, options = {}){", sheetsStart);
const sheetsBlock = sheetsStart > 0 && sheetsEnd > sheetsStart ? app.slice(sheetsStart, sheetsEnd) : "";
const deltaStart = app.indexOf("async loadSheetsDelta(options = {}){");
const deltaEnd = app.indexOf("async loadMetaRow(){", deltaStart);
const deltaBlock = deltaStart > 0 && deltaEnd > deltaStart ? app.slice(deltaStart, deltaEnd) : "";
const visibleStart = app.indexOf("function customerVisibleToCurrentUser(rec){");
const visibleEnd = app.indexOf("function classifyCustomerOwnershipForCurrentUser(rec){", visibleStart);
const visibleBlock = visibleStart > 0 && visibleEnd > visibleStart ? app.slice(visibleStart, visibleEnd) : "";

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-agent-mirror-assign.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) נציג תפעול לא מסונן לפי agent_id של מכירות");
assert(!!scopeBlock, "getServerListAgentScopeFilter נמצא");
assert(scopeBlock.includes("Auth.isOpsAgent"), "דילוג על scope מכירות לנציג תפעול");
assert(scopeBlock.includes("return null"), "scope מחזיר null לנציג תפעול");
assert(!!opsScopeBlock, "getOpsAgentMirrorAssignScope נמצא");
assert(opsScopeBlock.includes("Auth.isOpsAgent"), "סקופ שיוך רק לנציג תפעול");

console.log("\n3) טעינה לפי mirrorAssign ב-payload");
assert(!!loadBlock, "loadOpsAgentAssignedCustomerRows נמצא");
assert(loadBlock.includes("payload->mirrorFlow->mirrorAssign->>agentId"), "סינון JSON לפי agentId");
assert(loadBlock.includes("payload->mirrorFlow->mirrorAssign->>agentName"), "סינון JSON לפי agentName");
assert(loadBlock.includes('cols + ",payload"') || loadBlock.includes("cols + \",payload\""), "payload נכלל בסלקט");
assert(sheetsBlock.includes("useOpsAgentAssignSet"), "loadSheets משתמש בסט שיוך לנציג");
assert(sheetsBlock.includes("loadOpsAgentAssignedCustomerRows"), "loadSheets קורא לטעינת שיוך");
assert(deltaBlock.includes("loadOpsAgentAssignedCustomerRows"), "דלתא גם טוענת לפי שיוך");
assert(deltaBlock.includes("filterSessionStateForCurrentUserScope(State.data)"), "אחרי דלתא מסננים שורות שלא משויכות");

console.log("\n4) שמירת שיוך — upsert ישיר + כשלון לא מציג הצלחה");
assert(!!saveBlock, "saveAssignModal נמצא");
assert(saveBlock.includes("upsertSingleRow"), "upsert ישיר לתיק אחרי שיוך");
assert(saveBlock.includes("השיוך לא נשמר בשרת"), "התראה כשהשרת נכשל");
assert(saveBlock.includes("setMirrorAssign(rec, agent"), "עדיין כותב mirrorAssign ל-payload");
assert(app.includes("function setMirrorAssign(rec, agent, byName)"), "לוגיקת mirrorAssign לא הוסרה");
assert(app.includes("function currentUserMatchesMirrorAssign(assign)"), "התאמת שיוך לנציג לא הוסרה");

console.log("\n5) רגרסיה — נציג רואה רק מה ששויך אליו");
assert(visibleBlock.includes("Auth.isOpsAgent()"), "customerVisibleToCurrentUser מטפל בנציג תפעול");
assert(visibleBlock.includes("currentUserMatchesMirrorAssign(getMirrorAssign(rec))"), "נראות לפי mirrorAssign");
assert(app.includes("data-ops-dash-assign"), "לחצן שיוך בדשבורד מנהל נשאר");
assert(html.includes('id="view-mirrorAssignments"'), "מסך שיוכי שיקוף לא הוסר");
assert(html.includes('id="lcSendToOps"'), "הגש לתפעול לא נגע");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
