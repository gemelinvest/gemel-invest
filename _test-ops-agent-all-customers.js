/* GI-OPS 2026-09-06 — נציג תפעול רואה את כל הלקוחות כמו מנהל תפעול;
   שיוך עבודה (canMirrorAssign / canAssignCustomers) נשאר אצל מנהל / אדמין.
   הרצה: node _test-ops-agent-all-customers.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260906-ops-agent-all-cust-v1";
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

const authStart = app.indexOf("canViewAllCustomers(){");
const authEnd = app.indexOf("canViewElementaryCustomersPool(){", authStart);
const authBlock = authStart > 0 && authEnd > authStart ? app.slice(authStart, authEnd) : "";
const mirrorAssignStart = app.indexOf("canMirrorAssign(){");
const mirrorAssignEnd = app.indexOf("canViewAllCustomers(){", mirrorAssignStart);
const mirrorAssignBlock = mirrorAssignStart > 0 && mirrorAssignEnd > mirrorAssignStart
  ? app.slice(mirrorAssignStart, mirrorAssignEnd) : "";
const assignCustStart = app.indexOf("canAssignCustomers(){");
const assignCustEnd = app.indexOf("canUploadDailyReport(){", assignCustStart);
const assignCustBlock = assignCustStart > 0 && assignCustEnd > assignCustStart
  ? app.slice(assignCustStart, assignCustEnd) : "";
const visibleStart = app.indexOf("function customerVisibleToCurrentUser(rec){");
const visibleEnd = app.indexOf("function classifyCustomerOwnershipForCurrentUser(rec){", visibleStart);
const visibleBlock = visibleStart > 0 && visibleEnd > visibleStart ? app.slice(visibleStart, visibleEnd) : "";
const sheetsStart = app.indexOf("async _loadSheetsUnlocked(options = {}){");
const sheetsEnd = app.indexOf("async saveSheets(state, options = {}){", sheetsStart);
const sheetsBlock = sheetsStart > 0 && sheetsEnd > sheetsStart ? app.slice(sheetsStart, sheetsEnd) : "";
const deltaStart = app.indexOf("async loadSheetsDelta(options = {}){");
const deltaEnd = app.indexOf("async loadMetaRow(){", deltaStart);
const deltaBlock = deltaStart > 0 && deltaEnd > deltaStart ? app.slice(deltaStart, deltaEnd) : "";
const dashStart = app.indexOf("const OpsDashboardUI = {");
const dashEnd = app.indexOf("const TypingPacketUI = {");
const dashBlock = dashStart > 0 && dashEnd > dashStart ? app.slice(dashStart, dashEnd) : "";
const searchStart = app.indexOf("_syncOpsAgentSearchScope(){");
const searchEnd = app.indexOf("showScreen(name){", searchStart);
const searchScopeBlock = searchStart > 0 && searchEnd > searchStart ? app.slice(searchStart, searchEnd) : "";
const searchFnStart = app.indexOf("    search(){", searchStart);
const searchFnEnd = app.indexOf("    renderResults(list, opts = {}){", searchFnStart);
const searchFnBlock = searchFnStart > 0 && searchFnEnd > searchFnStart ? app.slice(searchFnStart, searchFnEnd) : "";
const hintStart = app.indexOf("_syncAssignHint(){");
const hintEnd = app.indexOf("_syncMgrRow(){", hintStart);
const hintBlock = hintStart > 0 && hintEnd > hintStart ? app.slice(hintStart, hintEnd) : "";
const openStart = app.indexOf("openMirrorForCustomer(id){");
const openEnd = app.indexOf("quietRefresh(){", openStart);
const openBlock = openStart > 0 && openEnd > openStart ? app.slice(openStart, openEnd) : "";
const relevantStart = dashBlock.indexOf("isRelevantCustomer(rec){");
const relevantEnd = dashBlock.indexOf("getPremium(rec){");
const relevantBlock = relevantStart >= 0 && relevantEnd > relevantStart
  ? dashBlock.slice(relevantStart, relevantEnd) : "";

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-agent-all-customers.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) הרשאות — כל הלקוחות, בלי שיוך עבודה");
assert(!!authBlock && authBlock.includes("this.isOpsAgent()"), "canViewAllCustomers כולל נציג תפעול");
assert(!!mirrorAssignBlock && mirrorAssignBlock.includes("return this.isOps();"), "canMirrorAssign רק למנהל תפעול");
assert(!mirrorAssignBlock.includes("isOpsAgent"), "canMirrorAssign לא ניתן לנציג תפעול");
assert(!!assignCustBlock && assignCustBlock.includes("this.isAdmin()") && assignCustBlock.includes("this.isManager()"), "canAssignCustomers אדמין/מנהל");
assert(!assignCustBlock.includes("isOpsAgent") && !assignCustBlock.includes("isOps()"), "canAssignCustomers לא ניתן לתפעול");

console.log("\n3) נראות וטעינה ארגונית");
assert(!!visibleBlock && visibleBlock.includes("Auth.canViewAllCustomers()"), "נראות לפי canViewAllCustomers");
assert(!visibleBlock.includes("currentUserMatchesMirrorAssign"), "נציג תפעול לא מוגבל לפי mirrorAssign בנראות");
assert(!sheetsBlock.includes("useOpsAgentAssignSet"), "loadSheets לא משתמש בסט שיוך כטעינת סשן");
assert(!sheetsBlock.includes("loadOpsAgentAssignedCustomerRows"), "loadSheets לא טוען רק משויכים");
assert(sheetsBlock.includes("loadRecentCustomerRows"), "loadSheets טוען working-set כמו מנהל");
assert(sheetsBlock.includes("Auth?.isOpsAgent?.()") && sheetsBlock.includes("data: []"), "הצעות נשארות ריקות לנציג תפעול");
assert(!deltaBlock.includes("loadOpsAgentAssignedCustomerRows"), "דלתא לא טוענת רק משויכים");
assert(deltaBlock.includes("loadTableRowsSince"), "דלתא מושכת לקוחות מאז since");
assert(!deltaBlock.includes("filterSessionStateForCurrentUserScope(State.data)"), "דלתא לא חותכת שורות לא-משויכות");

console.log("\n4) חיפוש שיקוף + פתיחת תיק + דשבורד");
assert(!!searchScopeBlock && searchScopeBlock.includes('this.filter = "all"'), "חיפוש שיקוף מתחיל מהכל");
assert(!searchScopeBlock.includes("assignedToMe"), "אין כפיית רק-משויכים על צ׳יפים");
assert(!!searchFnBlock && searchFnBlock.includes('this.filter === "assignedToMe"'), "סינון משויכים אופציונלי");
assert(!searchFnBlock.includes("Auth.isOpsAgent"), "חיפוש לא כופה assignedToMe לנציג");
assert(!!hintBlock && hintBlock.includes('this.filter !== "assignedToMe"'), "רמז שיוך רק כשבוחרים משויכים אליי");
assert(!!openBlock && openBlock.includes("MirrorCallUI.pickCustomer"), "פתיחת שיקוף מלקוח נשארה");
assert(!openBlock.includes("הלקוח לא משויך אליך"), "אין חסימת פתיחה ללקוח לא-משויך");
assert(!!relevantBlock && relevantBlock.includes("Auth.isOpsAgent()"), "תור דשבורד כולל נציג תפעול");
assert(!relevantBlock.includes("currentUserMatchesMirrorAssign"), "תור דשבורד לא מסונן לפי שיוך");
assert(dashBlock.includes("הצעות שהוגשו לתפעול · לפי סדר כניסה לתור"), "כותרת תור כמו מנהל תפעול");
assert(app.includes("data-ops-dash-assign"), "לחצן שיוך בדשבורד מנהל נשאר");
assert(html.includes('id="view-mirrorAssignments"'), "מסך שיוכי שיקוף לא הוסר");
assert(html.includes("נציג תפעול (רואה את כל הלקוחות)"), "טקסט תפקיד במשתמשים עודכן");
assert(html.includes('id="navMirrorAssignments"') || app.includes("navMirrorAssignments"), "ניווט שיוכי שיקוף נשאר");
assert(app.includes("Auth.canMirrorAssign() && Auth.current"), "ניווט שיוך רק עם canMirrorAssign");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
