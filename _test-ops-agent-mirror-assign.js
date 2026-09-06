/* GI-OPS 2026-08-30 — שיוך מנהל תפעול → נציג תפעול נשמר ב-payload;
   upsert ישיר בשמירת השיוך. נציג תפעול רואה את כל הלקוחות (2026-09-06),
   והשיוך נשאר כלי עבודה של מנהל תפעול + סינון «רק משויכים אליי».
   הרצה: node _test-ops-agent-mirror-assign.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260906-haifa-modiin-v1";
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
const loadStart = app.indexOf("_opsAgentMirrorAssignOrFilter(scope){");
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

console.log("\n3) סינון JSON לפי mirrorAssign נשמר ל«רק משויכים אליי»");
assert(!!loadBlock && loadBlock.includes("async loadOpsAgentAssignedCustomerRows"), "loadOpsAgentAssignedCustomerRows נמצא");
assert(loadBlock.includes("payload->mirrorFlow->mirrorAssign->>agentId"), "סינון JSON לפי agentId");
assert(loadBlock.includes("payload->mirrorFlow->mirrorAssign->>agentName"), "סינון JSON לפי agentName");
assert(loadBlock.includes('cols + ",payload"') || loadBlock.includes("cols + \",payload\""), "payload נכלל בסלקט");
assert(!sheetsBlock.includes("useOpsAgentAssignSet"), "loadSheets לא טוען רק סט שיוך");
assert(!sheetsBlock.includes("loadOpsAgentAssignedCustomerRows"), "loadSheets לא קורא לטעינת שיוך כסשן");
assert(!deltaBlock.includes("loadOpsAgentAssignedCustomerRows"), "דלתא לא טוענת לפי שיוך");
assert(app.includes("this.isOpsAgent()"), "canViewAllCustomers כולל נציג תפעול");

console.log("\n4) שמירת שיוך — upsert ישיר + כשלון לא מציג הצלחה");
assert(!!saveBlock, "saveAssignModal נמצא");
assert(saveBlock.includes("upsertSingleRow"), "upsert ישיר לתיק אחרי שיוך");
assert(saveBlock.includes("השיוך לא נשמר בשרת"), "התראה כשהשרת נכשל");
assert(saveBlock.includes("setMirrorAssign(rec, agent"), "עדיין כותב mirrorAssign ל-payload");
assert(app.includes("function setMirrorAssign(rec, agent, byName)"), "לוגיקת mirrorAssign לא הוסרה");
assert(app.includes("function currentUserMatchesMirrorAssign(assign)"), "התאמת שיוך לנציג לא הוסרה");

console.log("\n5) רגרסיה — שיוך נשמר, נציג רואה את כל הלקוחות");
assert(visibleBlock.includes("Auth.canViewAllCustomers()"), "customerVisibleToCurrentUser לפי canViewAllCustomers");
assert(!visibleBlock.includes("currentUserMatchesMirrorAssign(getMirrorAssign(rec))"), "אין הגבלת נראות לפי mirrorAssign");
assert(app.includes("canMirrorAssign(){\n      return this.isOps();"), "שיוך שיקוף נשאר אצל מנהל תפעול");
assert(app.includes("data-ops-dash-assign"), "לחצן שיוך בדשבורד מנהל נשאר");
assert(html.includes('id="view-mirrorAssignments"'), "מסך שיוכי שיקוף לא הוסר");
assert(html.includes('id="lcSendToOps"'), "הגש לתפעול לא נגע");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
