/* GI-TODAY-AFTER 2026-09-08 — כרטיס «נמכר היום» מציג אחרי הנחה, לא ברוטו מ-RPC.
   לא נוגעים במנוע האשף: getPolicyPremiumAfterDiscount נשאר «לפני».
   הרצה: node _test-today-sold-after-discount.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260908-daily-sales-v1";
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

const app = read("app.js");
const wizard = read("gi-wizard.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache (ללא באמפ)");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-today-sold-after-discount.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(wizard.includes('GI_WIZARD_BUILD = "' + APP_TAG + '"'), "wizard cache tag");
assert(extractObjectMethod(wizard, "getPolicyPremiumAfterDiscount").includes("getPolicyPremiumBeforeDiscount"), "אשף AfterDiscount נשאר לפני");

console.log("\n2) מקורות כרטיס היום");
assert(app.includes("Storage.loadTodaySalesAfterDiscount = async function(range){"), "שליפה ממוקדת אחרי הנחה");
assert(app.includes("afterDiscount: fromAfter === true"), "overlay מסומן afterDiscount");
assert(app.includes("_accumulateTodayHealthRiskSales(customers, range){"), "סכימה משותפת לכרטיס ולשליפה");
assert(app.includes("this._accumulateTodayHealthRiskSales(customersAll, todayRange)"), "כרטיס מקומי דרך אותה סכימה");
assert(app.includes("_shouldPaintTodayOverlayValue(overlayPrem, localPrem, today)"), "צביעה מקבלת את אובייקט ה-overlay");
assert(!extractObjectMethod(app, "policyNetPremium").includes("getPolicyPremiumAfterDiscount"), "policyNetPremium לא קורא לאשף לפני");

console.log("\n3) stored ברוטו לא מנצח סימולטור אחרי");
const policyNet = extractObjectMethod(app, "policyNetPremium");
const sandbox = {
  CustomersUI: {
    asMoneyNumber(v){
      const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    },
    getNewPolicyFilePremiumAfterDiscount(p){
      const n = Number(p?.simDiscountPerInsured?.ins1?.monthlyAfterDiscount);
      return n > 0 ? n : 0;
    }
  }
};
vm.runInNewContext(
  "this.policyNetPremium = function" + policyNet.slice("policyNetPremium".length) + ";",
  sandbox
);
assert(sandbox.policyNetPremium({
  premiumMonthly: "95.83",
  premiumValue: "95.83",
  premiumAfterDiscountValue: 95.83,
  simDiscountPerInsured: { ins1: { monthlyAfterDiscount: 28.75 } }
}) === 28.75, "ריטה: 28.75 אחרי, לא 95.83");
assert(sandbox.policyNetPremium({
  premiumMonthly: "150",
  premiumAfterDiscountValue: 97.5
}) === 97.5, "stored אחרי בלי סימולטור נשאר");

console.log("\n4) overlay ברוטו לא דורס מקומי");
const mergeFn = extractObjectMethod(app, "_resolveTodaySalesOverlayMerge");
const paintFn = extractObjectMethod(app, "_shouldPaintTodayOverlayValue");
const box = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  _mergeTodayCompanyBreakdown(localRows, serverRows){
    return (localRows || []).concat(serverRows || []);
  }
};
vm.runInNewContext(
  "this._resolveTodaySalesOverlayMerge = function" + mergeFn.slice("_resolveTodaySalesOverlayMerge".length) + ";\n" +
  "this._shouldPaintTodayOverlayValue = function" + paintFn.slice("_shouldPaintTodayOverlayValue".length) + ";",
  box
);
const grossOverlay = { ok: true, totalPremium: 4927.31, totalPolicies: 26, newClients: 12, breakdown: [] };
const afterOverlay = { ok: true, afterDiscount: true, totalPremium: 4279.45, totalPolicies: 29, newClients: 15, breakdown: [] };
const localAfter = { totalPremium: 3285.75, totalPolicies: 26, newClients: 12, breakdown: [], _fromServer: false };
assert(box._resolveTodaySalesOverlayMerge(localAfter, grossOverlay, 40).totalPremium === 3285.75, "ברוטו RPC לא מחליף אחרי מקומי");
assert(box._resolveTodaySalesOverlayMerge({ totalPremium: 0, totalPolicies: 0, breakdown: [] }, grossOverlay, 40).totalPremium === 4927.31, "מקומי ריק — overlay עדיין ממלא");
assert(box._resolveTodaySalesOverlayMerge({ totalPremium: 200, totalPolicies: 1, breakdown: [] }, afterOverlay, 40).totalPremium === 4279.45, "overlay אחרי-הנחה ממלא טעינה רזה");
assert(box._shouldPaintTodayOverlayValue(4927.31, 3285.75, grossOverlay) === false, "לא צובעים ברוטו מעל אחרי");
assert(box._shouldPaintTodayOverlayValue(4279.45, 200, afterOverlay) === true, "צובעים overlay אחרי-הנחה בטעינה");
assert(box._shouldPaintTodayOverlayValue(4279.45, 0) === true, "בלי מקומי מותר overlay");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
