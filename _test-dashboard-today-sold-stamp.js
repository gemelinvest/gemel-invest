/* GI-TODAY-STAMP 2026-09-08 — «נמכר היום» / נטו חודשי לפי _addedAt של הפוליסה בלבד.
   לא createdAt/updatedAt של התיק, ולא חותמת עכשיו בשמירת תיק ישן.
   הרצה: node _test-dashboard-today-sold-stamp.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260908-daily-sales-v3";
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

function extractFunction(src, fnName){
  const needle = "  function " + fnName + "(";
  const start = src.indexOf(needle);
  if(start < 0) return "";
  const brace = src.indexOf("{", start);
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

const app = read("app.js");
const wizard = read("gi-wizard.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-dashboard-today-sold-stamp.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) מקורות — בלי נפילה לתיק, בלי חותמת מחדש");
const collectFn = extractObjectMethod(app, "collectNewPoliciesForMetrics");
assert(!!collectFn, "חולץ collectNewPoliciesForMetrics");
assert(collectFn.includes("safeTrim(p?._addedAt)"), "סינון לפי _addedAt של פוליסה");
assert(!collectFn.includes("resolveCustomerMonthStamp(rec)"), "אין נפילה ל-createdAt של התיק בסינון טווח");
assert(app.includes("keepExistingNewPolicyAddedAt("), "שומר חותמת מכירה קיימת בטיוטה/שמירה");
assert(app.includes("delete next._addedAt"), "פוליסה ישנה בלי חותמת לא מקבלת עכשיו");
assert(app.includes("getDashboardTodayRange("), "טווח היום של הדשבורד לפי ישראל");
assert(extractObjectMethod(app, "buildTodaySalesMetrics").includes("getDashboardTodayRange"), "כרטיס נמכר היום לפי יום ישראל");
assert(extractObjectMethod(app, "ensureTodaySalesServerOverlay").includes("getDashboardTodayRange"), "RPC יומי באותו טווח ישראל");
assert(wizard.includes("_addedAt: nowISO()") || wizard.includes("if(!p._addedAt) p._addedAt = nowISO()"), "אשף עדיין חותם מכירה חדשה");
assert(extractObjectMethod(app, "defaultNewPolicy").includes("_addedAt: nowISO()"), "הוספת פוליסה בתיק עדיין חותמת עכשיו");
assert(extractObjectMethod(app, "policyNetPremium").includes("premiumAfterDiscountValue"), "נטו אחרי הנחה לא נשבר");

console.log("\n3) התנהגות — סינון תאריך + שמירת חותמת");
const ctx = {
  console, Date, Number, String, Object, Array, Math, JSON, Set, Map, Intl,
  safeTrim: (v) => String(v ?? "").trim(),
  clonePolicyForMetrics: (raw) => Object.assign({}, raw),
  Wizard: undefined,
  Storage: {
    payloadIsEmpty(){ return false; },
    payloadHasPolicyOrInsuredContent(){ return true; }
  },
  GI_PAYLOAD_BYTES_PER_COVERAGE: 65,
  GI_PAYLOAD_BYTES_PER_POLICY: 398,
  GI_PAYLOAD_BYTES_PER_INSURED: 879,
  CUSTOMER_PAYLOAD_METRICS_SKIP_BYTES: 2 * 1024 * 1024
};

const src = [
  extractFunction(app, "_estimatePayloadBytesStructural"),
  extractFunction(app, "estimateRecordPayloadBytes"),
  extractFunction(app, "isCustomerPayloadTooHeavyForSyncMetrics"),
  extractFunction(app, "getCustomerRawNewPolicies"),
  "var CustomersUI = {",
  "  getPolicyPremiumAfterDiscount: function(p){ return Number(p && (p.premiumAfterDiscountValue || p.premiumMonthly) || 0) || 0; },",
  "  getNewPolicyFilePremiumAfterDiscount: function(p){ return Number(p && p.premiumAfterDiscountValue) || 0; },",
  "  collectPolicies: function(rec){",
  "    var raw = getCustomerRawNewPolicies(rec) || [];",
  "    return raw.map(function(p, idx){",
  "      return Object.assign({}, p, { origin: String(p && p.origin || '') === 'existing' ? 'existing' : 'new', id: (p && p.id) || ('new_' + idx) });",
  "    });",
  "  },",
  extractObjectMethod(app, "isProductionBackfillPolicy") + ",",
  extractObjectMethod(app, "collectNewPoliciesForMetrics") + ",",
  extractObjectMethod(app, "keepExistingNewPolicyAddedAt"),
  "};",
  "var DashboardUI = {",
  extractObjectMethod(app, "getTodayRange") + ",",
  extractObjectMethod(app, "getMonthToDateRange") + ",",
  extractObjectMethod(app, "toIsraelDateKey") + ",",
  extractObjectMethod(app, "toLocalDateKey") + ",",
  extractObjectMethod(app, "_nextCalendarDateKey") + ",",
  extractObjectMethod(app, "_israelDayBoundIso") + ",",
  extractObjectMethod(app, "getIsraelDayRange") + ",",
  extractObjectMethod(app, "getDashboardTodayRange") + ",",
  extractObjectMethod(app, "isWithinRange"),
  "};",
  "this.CustomersUI = CustomersUI;",
  "this.DashboardUI = DashboardUI;"
].join("\n");

vm.runInNewContext(src, ctx);

const dash = ctx.DashboardUI;
const CustomersUI = ctx.CustomersUI;
const todayPack = dash.getDashboardTodayRange();
const todayRange = todayPack.range;
const monthRange = dash.getMonthToDateRange();

function isoDaysAgo(days){
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function rec(id, createdAt, policies){
  return {
    id: id,
    createdAt: createdAt,
    updatedAt: createdAt,
    payload: { createdAt: createdAt, newPolicies: policies }
  };
}

function collect(row, range){
  return CustomersUI.collectNewPoliciesForMetrics(row, {
    range: range,
    isWithinRange: function(stamp, r){ return dash.isWithinRange(stamp, r); }
  });
}

const oldPol = rec("c1", isoDaysAgo(40), [
  { id: "new_old", type: "בריאות", premiumMonthly: "200", _addedAt: isoDaysAgo(10) }
]);
assert(collect(oldPol, todayRange).length === 0, "פוליסה מלפני 10 ימים לא בנמכר היום");
assert(collect(oldPol, monthRange).length === 0, "פוליסה מלפני 10 ימים (מחוץ לחודש) לא בנטו החודשי");

const todayPol = rec("c2", isoDaysAgo(40), [
  { id: "new_today", type: "בריאות", premiumMonthly: "180", _addedAt: new Date().toISOString() }
]);
assert(collect(todayPol, todayRange).length === 1, "מכירה מהיום (אשף / הוספה בתיק) נספרת היום");

const unstampedNewFile = rec("c3", new Date().toISOString(), [
  { id: "new_unstamped", type: "ריסק", premiumMonthly: "300" }
]);
assert(collect(unstampedNewFile, todayRange).length === 0, "בלי _addedAt לא סופרים לפי createdAt של תיק שנוצר היום");
assert(collect(unstampedNewFile, monthRange).length === 0, "בלי _addedAt לא סופרים גם בנטו החודשי");

const thisMonth = rec("c4", isoDaysAgo(3), [
  { id: "new_month", type: "בריאות", premiumMonthly: "90", _addedAt: isoDaysAgo(3) }
]);
assert(collect(thisMonth, todayRange).length === 0, "פוליסה מלפני 3 ימים לא בנמכר היום");
assert(collect(thisMonth, monthRange).length === 1, "פוליסה מלפני 3 ימים כן בנטו החודשי");

const kept = CustomersUI.keepExistingNewPolicyAddedAt(
  { id: "new_keep", _addedAt: "NOW" },
  { id: "new_keep", _addedAt: "2026-08-01T10:00:00.000Z" },
  null
);
assert(kept._addedAt === "2026-08-01T10:00:00.000Z", "חותמת מקורית נשמרת בשמירה");

const invented = CustomersUI.keepExistingNewPolicyAddedAt(
  { id: "new_miss", _addedAt: "NOW" },
  { id: "new_miss" },
  { id: "new_miss" }
);
assert(!invented._addedAt, "פוליסה ישנה בלי חותמת לא מקבלת עכשיו");

const brandNew = CustomersUI.keepExistingNewPolicyAddedAt(
  { id: "new_add", _addedAt: "NOW" },
  { id: "new_add", _addedAt: "NOW" },
  null
);
assert(brandNew._addedAt === "NOW", "הוספת פוליסה חדשה בתיק שומרת חותמת עכשיו");

assert(!!todayPack.dayKey && /^\d{4}-\d{2}-\d{2}$/.test(todayPack.dayKey), "dayKey ישראלי תקין");
assert(todayPack.range.start instanceof Date && todayPack.range.end instanceof Date, "טווח יום ישראל מוחזר");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
