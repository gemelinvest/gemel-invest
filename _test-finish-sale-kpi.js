/* GI-FINISH-SALE 2026-09-27
   נמכר היום ופרמיה חודשית נטו:
   סיום הקמת לקוח חותם את הפוליסות החדשות.
   מכירה נוספת לאותו תיק מוסיפה רק את הפרמיה החדשה.
   נציג / מנהל צוות / מנהל ומנהל מערכת נשארים על היקף הצפייה הקיים.
   הרצה: node _test-finish-sale-kpi.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260928-ops-prem-totals-v1";
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

function extractFunction(src, fnName){
  const needle = "  function " + fnName + "(";
  const start = src.indexOf(needle);
  if(start < 0) return "";
  let i = start + needle.length;
  let depthParen = 1;
  while(i < src.length && depthParen > 0){
    const ch = src[i];
    if(ch === "(") depthParen += 1;
    else if(ch === ")") depthParen -= 1;
    i += 1;
  }
  const brace = src.indexOf("{", i);
  let depth = 0;
  for(let i = brace; i < src.length; i += 1){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1).trim();
    }
  }
  return "";
}

function extractObjectMethod(src, methodName){
  const needle = "\n    " + methodName + "(";
  const start = src.indexOf(needle);
  if(start < 0) return "";
  let i = start + needle.length;
  let depthParen = 1;
  while(i < src.length && depthParen > 0){
    const ch = src[i];
    if(ch === "(") depthParen += 1;
    else if(ch === ")") depthParen -= 1;
    i += 1;
  }
  const brace = src.indexOf("{", i);
  if(brace < 0) return "";
  let depth = 0;
  for(let j = brace; j < src.length; j += 1){
    const ch = src[j];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, j + 1).trim();
    }
  }
  return "";
}

const app = read("app.js");
const wizard = read("gi-wizard.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache, בלי לגעת במנוע האשף");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(html.includes("app.js?v=" + TAG), "index.html cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");
assert(wizard.includes("return this.getPolicyPremiumBeforeDiscount(policy);"), "אשף AfterDiscount נשאר לפני");
assert(wizard.includes("stampPoliciesSubmittedAtFinish(payload, existingPayloadSnapshot, nowISO())"), "סיום הקמה חותם רק בשמירה");
assert(extractObjectMethod(app, "computeAgentTeamSalesMetrics") === "" || app.includes("function computeAgentTeamSalesMetrics(agent){"), "פונקציית צוות קיימת");
const teamFn = extractFunction(app, "computeAgentTeamSalesMetrics");
assert(teamFn.includes("wizardSaleAfterDiscount(p)"), "מסך הצוות על נוסחת הכרטיס");
assert(teamFn.includes("_dashboardSaleStamp"), "מסך הצוות על חותמת הכרטיס");

console.log("\n2) היקף צפייה");
const scope = extractObjectMethod(app, "getDashboardSalesScope");
assert(scope.includes('return "all"'), "מנהל ומנהל מערכת רואים הכל");
assert(scope.includes('return "team"'), "מנהל צוות רואה צוות");
assert(scope.includes('return "self"'), "נציג רואה את שלו");
assert(extractFunction(app, "customerVisibleToTeamManager").includes("customerOwnedByCurrentAgent(rec) || customerOwnedByManagedTeam(rec)"), "מנהל צוות רואה גם את עצמו");
assert(app.includes("const needsServerNet = !agentSelfKpi && (missingCustomers > 0 || !localReady || !(localNet > 0))"), "שליפה מדויקת מהשרת רק כשהחישוב המקומי עוד לא מוכן, ולא לנציג");
assert(app.includes("if(needsServerNet && typeof Storage.loadDashboardMonthSalesExact"), "הכרטיס החודשי של מנהל נשען על הפוליסות השמורות");
assert(app.includes('const agentSelfKpi = Auth.getDashboardSalesScope?.() === "self"'), "נציג לא נדרס במספר חודשי");

console.log("\n3) התנהגות — סיום הקמה מול מכירה נוספת");
const ctx = {
  console, Date, Number, String, Object, Array, Math, JSON, Set, Map, Intl,
  safeTrim: (v) => String(v ?? "").trim(),
  nowISO: () => "2026-09-27T12:00:00.000Z",
  CustomersUI: {
    resolveCustomerSectorFromType(type){
      const t = String(type || "");
      if(/ריסק|משכנת|חיים|כושר/.test(t)) return "סיכונים";
      if(/בריאות|מחלות|סרטן|מדיקר/.test(t)) return "בריאות";
      if(/רכב|דירה|אלמנטרי/.test(t)) return "אלמנטרי";
      return "";
    },
    isProductionBackfillPolicy(){ return false; }
  },
  Storage: { payloadIsEmpty(){ return false; } },
  resolveCompanyLogoKey: (v) => String(v || ""),
  salesRecordAgentId: () => "agent-1",
  dailySalesAgentMergeKey: (name) => String(name || "")
};
const src = [
  extractFunction(app, "getNewPoliciesFromCustomerPayload"),
  extractFunction(app, "getCustomerRawNewPolicies"),
  extractFunction(app, "stampPoliciesSubmittedAtFinish"),
  "var DashboardUI = {",
  extractObjectMethod(app, "_roundSaleMoney") + ",",
  extractObjectMethod(app, "_saleMoney") + ",",
  extractObjectMethod(app, "toLocalDateKey") + ",",
  extractObjectMethod(app, "toIsraelDateKey") + ",",
  extractObjectMethod(app, "_isMedicareWizardSale") + ",",
  extractObjectMethod(app, "_enteredSalePremium") + ",",
  extractObjectMethod(app, "_dashboardSaleStamp") + ",",
  extractObjectMethod(app, "wizardSaleAfterDiscount") + ",",
  extractObjectMethod(app, "_isDashboardWizardSale") + ",",
  extractObjectMethod(app, "_isHealthOrRiskWizardSale") + ",",
  extractObjectMethod(app, "_eachDashboardWizardSale") + ",",
  extractObjectMethod(app, "isWithinRange") + ",",
  extractObjectMethod(app, "resolveDailySalesSector") + ",",
  extractObjectMethod(app, "accumulateCustomerIntoAgg") + ",",
  extractObjectMethod(app, "_accumulateTodayHealthRiskSales"),
  "};",
  "this.DashboardUI = DashboardUI;",
  "this.stampPoliciesSubmittedAtFinish = stampPoliciesSubmittedAtFinish;"
].join("\n");
vm.runInNewContext(src, ctx);

const finish = "2026-09-27T09:00:00.000Z";
const created = "2026-09-25T10:00:00.000Z";
const draftDay = "2026-09-24T15:00:00.000Z";
const payload = {
  newPolicies: [
    { id: "old", type: "בריאות", premiumMonthly: "200", _addedAt: draftDay },
    { id: "new", type: "ריסק", premiumMonthly: "80", _addedAt: draftDay }
  ],
  operational: { newPolicies: [] }
};
ctx.stampPoliciesSubmittedAtFinish(payload, {
  newPolicies: [{ id: "old", type: "בריאות", premiumMonthly: "200", _addedAt: "2026-09-02T08:00:00.000Z" }]
}, finish);
assert(payload.newPolicies[0]._addedAt === "2026-09-02T08:00:00.000Z", "פוליסה ישנה שומרת את חותמת המכירה המקורית");
assert(payload.newPolicies[1]._addedAt === finish, "פוליסה חדשה נחתמת בסיום, לא ביום הטיוטה");
assert(payload.operational.newPolicies[1]._addedAt === finish, "העותק התפעולי מקבל את אותה חותמת");

const dash = ctx.DashboardUI;
const monthRange = {
  start: new Date("2026-09-01T00:00:00+03:00"),
  end: new Date("2026-09-28T00:00:00+03:00")
};
const todayRange = {
  start: new Date("2026-09-25T00:00:00+03:00"),
  end: new Date("2026-09-26T00:00:00+03:00")
};
const file = {
  id: "c1",
  createdAt: created,
  agentName: "נציג",
  payload: {
    newPolicies: [
      { id: "drafted", type: "בריאות", premiumMonthly: "400", _addedAt: draftDay },
      { id: "same-day", type: "מחלות קשות", premiumMonthly: "105.79", _addedAt: "2026-09-25T11:00:00.000Z" },
      { id: "later", type: "ריסק", premiumMonthly: "50", _addedAt: "2026-09-27T09:00:00.000Z" },
      { id: "elem", type: "רכב", premiumMonthly: "900", _addedAt: "2026-09-25T11:00:00.000Z" }
    ]
  }
};
const today = dash._accumulateTodayHealthRiskSales([file], todayRange);
assert(Math.abs(today.totalPremium - 505.79) < 0.02, "נמכר היום כולל את טיוטת האתמול שסוימה היום, בלי המכירה המאוחרת ובלי רכב");
assert(today.totalPolicies === 2, "שתי פוליסות בריאות ביום הסיום");

const laterDay = {
  start: new Date("2026-09-27T00:00:00+03:00"),
  end: new Date("2026-09-28T00:00:00+03:00")
};
const later = dash._accumulateTodayHealthRiskSales([file], laterDay);
assert(Math.abs(later.totalPremium - 50) < 0.02, "יום המכירה הנוספת סופר רק את הפרמיה שנוספה");

const monthAll = { grossPremium: 0, netPremium: 0, soldPolicies: 0, productTotals: Object.create(null) };
dash.accumulateCustomerIntoAgg(file, monthAll, monthRange);
assert(monthAll.soldPolicies === 4, "כל פוליסה שנרכשה החודש נספרת פעם אחת");
assert(Math.abs(monthAll.netPremium - (400 + 105.79 + 50 + 900)) < 0.02, "פרמיה חודשית נטו היא סכום הפוליסות של החודש, בלי לספור שוב את כל התיק");

const oldMonthPolicy = {
  id: "c2",
  createdAt: "2026-08-02T08:00:00.000Z",
  payload: {
    newPolicies: [
      { id: "aug", type: "בריאות", premiumMonthly: "1000", _addedAt: "2026-08-02T08:00:00.000Z" },
      { id: "sep", type: "בריאות", premiumMonthly: "70", _addedAt: "2026-09-10T08:00:00.000Z" }
    ]
  }
};
const repeat = { grossPremium: 0, netPremium: 0, soldPolicies: 0, productTotals: Object.create(null) };
dash.accumulateCustomerIntoAgg(oldMonthPolicy, repeat, monthRange);
assert(Math.abs(repeat.netPremium - 70) < 0.02, "מכירה נוספת לתיק ישן מוסיפה רק את הפרמיה החדשה");
assert(repeat.soldPolicies === 1, "הפרמיה הישנה לא נספרת שוב");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
