/* נציג תפעול בלי ספר לקוחות, ואישור סטטוס המתנה לפני החזרה לבחירה.
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

console.log("\n2) נציג תפעול נטען כמו מנהל, בלי ספר מלא");
assert(app.includes("async loadOpsAgentQueueCustomerRows()"), "שאילתת תור שיקוף נשארת בקוד");
assert(app.includes("payload->opsProcess->>waitingMirrorLane.not.is.null"), "התור מסונן לפי סטטוס המתנה");
const fetch = sliceBetween(app, "const customersFetch = useLargeCustomers", "const proposalsFetch");
assert(fetch.includes("this.loadRecentCustomerRows") && !fetch.includes("loadOpsAgentQueueCustomerRows"), "סשן הנציג הוא working-set כמו מנהל");
assert(fetch.includes("this.loadTableRows(SUPABASE_TABLES.customers"), "ארגון קטן נטען באותו מסלול של מנהל");
assert(app.includes("if(this.isLargeCustomersSession()) return this.loadSheets(options);"), "סשן גדול לא מושך דלתא של כל הספר");
assert(!app.includes("if(Auth?.isOpsAgent?.()) return this.loadSheets(options);"), "רענון הנציג לא מנותב לטעינה נפרדת");
assert(!app.includes("if(Auth?.isOpsAgent?.()) return false;"), "רשימה ריקה מטופלת כמו אצל מנהל");
const nav = sliceBetween(app, "if (this.els.navCustomers)", "if (this.els.navProposals)");
assert(!nav.includes("!isOpsAgent"), "לקוחות גלויים לנציג תפעול");
assert(!nav.includes("!isOps)"), "מנהל תפעול לא מוסתר באותו תנאי");
assert(app.includes('if(safe === "customers" && !Auth.current) safe = "dashboard";'), "בלי משתמש אין מסך לקוחות");
assert(!app.includes('if(safe === "customers" && (!Auth.current || Auth.isOpsAgent())) safe = "dashboard";'), "ניווט ללקוחות לא נחסם לנציג");
const openBy = sliceBetween(app, "openById(id, opts={}){", "if(Storage.payloadIsEmpty(rec))");
assert(!openBy.includes("תיק הלקוח לא זמין לנציג תפעול"), "תיק לקוח נפתח לנציג תפעול");
assert(app.includes("Storage.searchCustomers(q, 30,"), "חיפוש שיקוף של הנציג רץ מול השרת ובמכסה");
assert(app.includes("canViewAllCustomers(){\n      return this.isAdmin() || this.isManager() || this.isOps() || this.isOpsAgent();"), "מנהל תפעול עדיין רואה את כל הלקוחות");

console.log("\n3) סטטוס המתנה");
assert(app.includes("async _onReadyLaneClick(laneKey)"), "לחיצה על סטטוס");
assert(app.includes("this._readyLaneDraft = { id: cid, key };"), "בחירת סטטוס נשמרת עד לאישור");
assert(app.includes("async _confirmReadyLane()"), "יש לחצן אישור לסטטוס");
const click = sliceBetween(app, "async _onReadyLaneClick(laneKey){", "_syncReadyLaneConfirm(){");
assert(click.includes("this._readyLaneDraft = { id: cid, key };") && !click.includes("_documentReadyMirrorLane"), "הבחירה לא נשמרת לפני אישור");
const confirm = sliceBetween(app, "async _confirmReadyLane(){", "_commitReadyLaneDraft(){");
assert(confirm.includes("_documentReadyMirrorLane(key)") && confirm.indexOf("_documentReadyMirrorLane(key)") < confirm.indexOf("this.goToSearch()"), "אישור שומר ואז חוזר לבחירת לקוח");
const goSearch = sliceBetween(app, "goToSearch(){", "if(this._callRunning) this.stopCall();");
assert(!goSearch.includes("_commitReadyLaneDraft") && goSearch.includes("this._readyLaneDraft = null"), "יציאה בלי אישור לא שומרת את הסטטוס");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
