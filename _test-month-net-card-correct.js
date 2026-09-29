/* GI-MONTH-NET-CARD 2026-09-27
   כרטיס פרמיה חודשית נטו: אחרי הנחה כשיש, אחרת כמו שנמכר.
   בלי חותמת — יום יצירת הלקוח. לא updatedAt (יותר מדי). לא להעלים (מעט מדי).
   מדיקר בלי לפני/אחרי נכנס כמו שנמכר.
   הרצה: node _test-month-net-card-correct.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260929-stage10-save-check-v1";
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const wizard = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const sqlPrem = fs.readFileSync(path.join(ROOT, "supabase-gi-policy-premium-after-discount.sql"), "utf8");
const sqlStamp = fs.readFileSync(path.join(ROOT, "supabase-dashboard-finish-sale-stamp.sql"), "utf8");

console.log("1) cache + האשף לא זז");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");
assert(wizard.includes("return this.getPolicyPremiumBeforeDiscount(policy);"), "אשף AfterDiscount נשאר לפני");
assert(app.includes("GI-MONTH-NET-CARD"), "סמן הכרטיס");
assert(sqlStamp.includes("THEN p_created_at"), "SQL בלי חותמת נופל ליום יצירה");
assert(!sqlStamp.includes("THEN NULL"), "SQL לא מוחק מכירה בלי חותמת");
assert(sqlPrem.includes("מדיקר"), "SQL מדיקר כמו שנמכר");
assert(!sqlPrem.includes("if stored > 0 then return round(stored, 2)"), "SQL לא לוקח ברוטו שמור");

console.log("\n2) סכום — לפני/אחרי לפי מוצר");
const ctx = {
  console, Date, Number, String, Object, Array, Math, JSON, Set, Map, Intl,
  safeTrim: (v) => String(v ?? "").trim(),
  CustomersUI: {
    resolveCustomerSectorFromType(type){
      const t = String(type || "");
      if(/ריסק|משכנת|חיים|כושר/.test(t)) return "סיכונים";
      if(/בריאות|מחלות|סרטן|מדיקר/.test(t)) return "בריאות";
      return "";
    },
    isProductionBackfillPolicy(){ return false; },
    asMoneyNumber(v){
      const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    }
  }
};
const src = [
  extractFunction(app, "getNewPoliciesFromCustomerPayload"),
  extractFunction(app, "getCustomerRawNewPolicies"),
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
  extractObjectMethod(app, "accumulateCustomerIntoAgg"),
  "};",
  "this.DashboardUI = DashboardUI;"
].join("\n");
vm.runInNewContext(src, ctx);
const dash = ctx.DashboardUI;
const sale = (p) => dash.wizardSaleAfterDiscount(p);

assert(sale({
  premiumMonthly: "95.83",
  premiumAfterDiscountValue: 95.83,
  simDiscountPerInsured: { ins1: { monthlyAfterDiscount: 28.75 } }
}) === 28.75, "סימולטור אחרי הנחה 28.75");

assert(sale({
  company: "מדיקר",
  type: "מדיקר",
  premiumMonthly: "210",
  simDiscountPerInsured: { a: { monthlyAfterDiscount: 0 } }
}) === 210, "מדיקר כמו שנמכר, לא 0 מהסימולטור");

assert(sale({
  type: "אובדן כושר עבודה",
  premiumMonthly: "320"
}) === 320, "אובדן כושר בלי סימולטור כמו שנמכר");

assert(sale({
  type: "בריאות",
  coverDiscountsApplied: true,
  premiumAfterCoverDiscounts: 140,
  premiumMonthly: "200"
}) === 140, "בריאות הנחת כיסויים");

console.log("\n3) ספירה — לא יותר מדי ולא מעט מדי");
const monthRange = {
  start: new Date("2026-09-01T00:00:00+03:00"),
  end: new Date("2026-09-28T00:00:00+03:00")
};

const lironNow = {
  id: "liron-now",
  createdAt: "2026-09-10T08:00:00.000Z",
  updatedAt: "2026-09-26T08:00:00.000Z",
  payload: {
    newPolicies: [
      { id: "unstamped", type: "בריאות", premiumMonthly: "400" }
    ]
  }
};
const tooLittle = { grossPremium: 0, netPremium: 0, soldPolicies: 0, productTotals: Object.create(null) };
dash.accumulateCustomerIntoAgg(lironNow, tooLittle, monthRange);
assert(Math.abs(tooLittle.netPremium - 400) < 0.02, "בלי חותמת על לקוח מהחודש — עדיין נספר (לא מעט מדי)");
assert(tooLittle.soldPolicies === 1, "פוליסה אחת נספרת");

const oldFile = {
  id: "old-file",
  createdAt: "2026-08-02T08:00:00.000Z",
  updatedAt: "2026-09-26T08:00:00.000Z",
  payload: {
    newPolicies: [
      { id: "legacy", type: "בריאות", premiumMonthly: "9000" }
    ]
  }
};
const tooMuch = { grossPremium: 0, netPremium: 0, soldPolicies: 0, productTotals: Object.create(null) };
dash.accumulateCustomerIntoAgg(oldFile, tooMuch, monthRange);
assert(tooMuch.netPremium === 0, "תיק ישן בלי חותמת לא נספר לפי updatedAt (לא יותר מדי)");
assert(tooMuch.soldPolicies === 0, "אין פוליסה מחודש ישן");

const extraSale = {
  id: "old-plus",
  createdAt: "2026-08-02T08:00:00.000Z",
  updatedAt: "2026-09-12T08:00:00.000Z",
  payload: {
    newPolicies: [
      { id: "aug", type: "בריאות", premiumMonthly: "1000", _addedAt: "2026-08-02T08:00:00.000Z" },
      { id: "sep", type: "מדיקר", company: "מדיקר", premiumMonthly: "70", _addedAt: "2026-09-12T08:00:00.000Z" }
    ]
  }
};
const extra = { grossPremium: 0, netPremium: 0, soldPolicies: 0, productTotals: Object.create(null) };
dash.accumulateCustomerIntoAgg(extraSale, extra, monthRange);
assert(Math.abs(extra.netPremium - 70) < 0.02, "מכירה נוספת מדיקר החודש נכנסת כמו שנמכרה");
assert(extra.soldPolicies === 1, "רק הפוליסה החדשה");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
