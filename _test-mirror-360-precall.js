/* נציג תפעול בלי ספר לקוחות, וסטטוס המתנה שנשמר ביציאה.
   הרצה: node _test-mirror-360-precall.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
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

function sliceBetween(src, start, end){
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  if(a < 0 || b < 0) return "";
  return src.slice(a, b);
}

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) נציג תפעול לא מושך את ספר הלקוחות");
assert(app.includes("async loadOpsAgentQueueCustomerRows()"), "שאילתת תור שיקוף");
assert(app.includes("payload->opsProcess->>waitingMirrorLane.not.is.null"), "התור מסונן לפי סטטוס המתנה");
const fetch = sliceBetween(app, "const opsAgentQueueSession = Auth?.isOpsAgent?.() === true;", "const proposalsFetch");
assert(fetch.includes("opsAgentQueueSession") && fetch.includes("this.loadOpsAgentQueueCustomerRows()"), "סשן נציג טוען את התור");
assert(fetch.indexOf("this.loadOpsAgentQueueCustomerRows()") < fetch.indexOf("this.loadTableRows(SUPABASE_TABLES.customers"), "משיכת כל הטבלה נשארת רק לתפקידים האחרים");
assert(app.includes("if(Auth?.isOpsAgent?.()) return this.loadSheets(options);"), "רענון חי לא מחזיר את כל הספר");
assert(app.includes("if(Auth?.isOpsAgent?.()) return false;"), "תור ריק לא מפעיל משיכת ארגון");
const nav = sliceBetween(app, "if (this.els.navCustomers)", "if (this.els.navProposals)");
assert(nav.includes("!isOpsAgent"), "לקוחות מוסתרים מנציג תפעול");
assert(!nav.includes("!isOps)"), "מנהל תפעול לא מוסתר באותו תנאי");
assert(app.includes('if(safe === "customers" && (!Auth.current || Auth.isOpsAgent())) safe = "dashboard";'), "ניווט ישיר ללקוחות נחסם לנציג");
const openBy = sliceBetween(app, "openById(id, opts={}){", "const rec = this.byId(id);");
assert(openBy.includes("Auth?.isOpsAgent?.()"), "תיק לקוח לא נפתח לנציג תפעול");
assert(app.includes("Storage.searchCustomers(q, 30, { skipAgentScope: true })"), "חיפוש שיקוף של הנציג רץ מול השרת");
assert(app.includes("canViewAllCustomers(){\n      return this.isAdmin() || this.isManager() || this.isOps() || this.isOpsAgent();"), "מנהל תפעול עדיין רואה את כל הלקוחות");

console.log("\n3) סטטוס המתנה");
assert(app.includes("async _onReadyLaneClick(laneKey)"), "לחיצה על סטטוס");
assert(app.includes("this._readyLaneDraft = { id: cid, key };"), "שינוי מאוחר נשמר כטיוטה");
assert(app.includes("_commitReadyLaneDraft()"), "הטיוטה נשמרת ביציאה");
const click = sliceBetween(app, "async _onReadyLaneClick(laneKey){", "_commitReadyLaneDraft(){");
assert(click.includes("if(!stored)") && click.includes("_documentReadyMirrorLane(key)"), "סימון ראשון נכנס מיד לתור");
const goSearch = sliceBetween(app, "goToSearch(){", "if(this._callRunning) this.stopCall();");
assert(goSearch.includes("_commitReadyLaneDraft"), "יציאה מהלקוח שומרת את הסטטוס ששונה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
