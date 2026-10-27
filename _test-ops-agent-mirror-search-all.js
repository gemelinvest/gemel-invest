/* חיפוש שיחת שיקוף של נציג תפעול עולה כל לקוח במערכת.
   שער הבריאות ושער «משויכים אליי» נשארים לכל השאר.
   הרצה: node _test-ops-agent-mirror-search-all.js
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

function extractMethodBody(src, signature){
  const at = src.indexOf(signature);
  if(at < 0) return "";
  const open = src.indexOf("{", at);
  if(open < 0) return "";
  let depth = 0;
  for(let i = open; i < src.length; i += 1){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(open + 1, i);
    }
  }
  return "";
}

function sliceBetween(src, start, end){
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  if(a < 0 || b < 0) return "";
  return src.slice(a, b);
}

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-agent-mirror-search-all.js")]).status === 0, "node --check this test");

console.log("\n2) החריג יושב רק על חיפוש שיחת השיקוף");
const helperBody = extractMethodBody(app, "_mcOpsAgentMirrorSearchIsOpen(query){");
const searchBody = extractMethodBody(app, "_searchLoadedCustomers(){");
const healthBody = extractMethodBody(app, "_mcCustomerHasHealthRiskPolicies(rec){");
assert(helperBody.includes("Auth?.isOpsAgent?.()") && helperBody.includes("safeTrim(query)"), "החריג דורש נציג תפעול וטקסט חיפוש");
assert(!helperBody.includes("isOps()") && !helperBody.includes("canViewAllCustomers"), "החריג לא נפתח למנהל תפעול או לכל צופה");
assert(searchBody.includes("const openBook = this._mcOpsAgentMirrorSearchIsOpen(q);"), "החיפוש שואל את החריג");
assert(searchBody.includes("if(!openBook && !this._mcCustomerHasHealthRiskPolicies(c)) return false;"), "בלי חריג נשאר שער בריאות וסיכונים");
assert(searchBody.includes("if(assignedOnly && !openBook)"), "בלי חריג נשאר שער משויכים אליי");
assert(searchBody.includes('this.filter === "assignedToMe"'), "סינון משויכים לא נמחק");
assert(searchBody.includes('this.filter === "hasProposal" && !openBook'), "סינון הצעה לא נמחק מחוץ לחיפוש הנציג");
assert(app.includes("Storage.searchCustomers(q, 30, { skipAgentScope: true })"), "החיפוש עדיין רץ על השרת בלי סינון נציג מכירות");
assert((app.split("_mcOpsAgentMirrorSearchIsOpen").length - 1) === 2, "שם החריג מופיע רק בהגדרה ובחיפוש");

const sheets = sliceBetween(app, "const opsAgentQueueSession = Auth?.isOpsAgent?.() === true;", "const proposalsFetch");
assert(sheets.includes("this.loadOpsAgentQueueCustomerRows()"), "סשן הנציג עדיין טוען רק את תור השיקוף");
assert(!sheets.includes("_mcOpsAgentMirrorSearchIsOpen"), "טעינת הסשן לא נפתחה לכל הספר");
const openBy = sliceBetween(app, "openById(id, opts={}){", "const rec = this.byId(id);");
assert(openBy.includes("Auth?.isOpsAgent?.()") && openBy.includes("תיק הלקוח לא זמין לנציג תפעול"), "תיק לקוח נשאר חסום לנציג תפעול");
const relevant = sliceBetween(app, "isRelevantCustomer(rec){", "getPremium(rec){");
assert(relevant.includes("isHealthRisksWizardCompleted(rec)") && !relevant.includes("_mcOpsAgentMirrorSearchIsOpen"), "תור הדשבורד לא השתנה");
assert(app.includes("canMirrorAssign(){\n      return this.isOps();"), "שיוך שיקוף נשאר אצל מנהל תפעול");
const nav = sliceBetween(app, "if (this.els.navCustomers)", "if (this.els.navProposals)");
assert(nav.includes("!isOpsAgent"), "מסך הלקוחות נשאר מוסתר מנציג תפעול");
const discovery = html.slice(html.indexOf('id="mcDiscoveryPanel"'), html.indexOf('id="mcFlowDock"'));
assert(!discovery.includes("רק משויכים אליי"), "מסך החיפוש לא החזיר צ׳יפ משויכים אליי");

console.log("\n3) מטריצת תוצאות");
function safeTrim(v){
  return String(v == null ? "" : v).trim();
}
const world = { role: "agent", assigned: true };
const Auth = {
  isOpsAgent(){ return world.role === "opsAgent"; },
  isOps(){ return world.role === "ops"; }
};
function hasHealth(rec){
  return (new Function("rec", "safeTrim", "isHealthRisksWizardCompleted", healthBody))(rec, safeTrim, () => false);
}
function isOpen(query){
  return (new Function("Auth", "safeTrim", "query", helperBody))(Auth, safeTrim, query);
}
const ui = {
  filter: "all",
  els: { searchInput: { value: "" } },
  _mcSearchOpenBook: false,
  _captured: null,
  _mcCustomerHasHealthRiskPolicies: hasHealth,
  _mcOpsAgentMirrorSearchIsOpen: isOpen,
  _mcSearchRecencyMs(){ return 0; },
  renderResults(list){ this._captured = list.map((row) => row.id); },
  _syncAssignHint(){},
  _syncMgrRow(){}
};
ui._searchLoadedCustomers = new Function(
  "State",
  "safeTrim",
  "getMirrorAssign",
  "currentUserMatchesMirrorAssign",
  searchBody
).bind(ui);

const customers = [
  { id: "mine-health", fullName: "דנה לוי", idNumber: "111", phone: "050", payload: { newPolicies: [{ id: 1 }] } },
  { id: "other-plain", fullName: "דנה כהן", idNumber: "222", phone: "051", payload: {} },
  { id: "other-health", fullName: "דנה ברק", idNumber: "333", phone: "052", payload: { newPolicies: [{ id: 2 }] } },
  { id: "no-match", fullName: "יוסי מזרחי", idNumber: "444", phone: "053", payload: { newPolicies: [{ id: 3 }] } }
];
const State = { data: { customers, proposals: [] } };
function getMirrorAssign(rec){
  return rec.id === "mine-health" ? { agentId: "ops-1", agentName: "נציג" } : null;
}
function currentUserMatchesMirrorAssign(assign){
  return !!(assign && world.assigned);
}

function run(role, query, filter){
  world.role = role;
  world.assigned = true;
  ui.filter = filter;
  ui.els.searchInput.value = query;
  ui._captured = null;
  ui._searchLoadedCustomers(State, safeTrim, getMirrorAssign, currentUserMatchesMirrorAssign);
  return ui._captured || [];
}

const opsHit = run("opsAgent", "דנה", "all");
assert(opsHit.includes("mine-health") && opsHit.includes("other-plain") && opsHit.includes("other-health"), "נציג תפעול בחיפוש רואה גם לקוח בלי שיוך ובלי פוליסת בריאות");
assert(!opsHit.includes("no-match"), "חיפוש הנציג עדיין דורש התאמת שם, ת״ז או טלפון");

const opsIdle = run("opsAgent", "", "all");
assert(opsIdle.includes("mine-health") && !opsIdle.includes("other-plain"), "בלי טקסט חיפוש נשארת רשימת הבריאות והסיכונים");

const mgrHit = run("ops", "דנה", "all");
assert(mgrHit.includes("mine-health") && mgrHit.includes("other-health") && !mgrHit.includes("other-plain"), "מנהל תפעול נשאר מאחורי שער הבריאות");

const opsAssignedFilter = run("opsAgent", "דנה", "assignedToMe");
assert(opsAssignedFilter.includes("other-plain") && opsAssignedFilter.includes("other-health"), "חיפוש הנציג לא נחתך לפי משויכים אליי");

const mgrAssigned = run("ops", "דנה", "assignedToMe");
assert(mgrAssigned.includes("mine-health") && !mgrAssigned.includes("other-health") && !mgrAssigned.includes("other-plain"), "מנהל תפעול בסינון משויכים אליי רואה רק לקוח משויך עם בריאות");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
