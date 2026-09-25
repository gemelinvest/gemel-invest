/* GI-KPI-EXACT 2026-09-25
   כרטיסי נציג: סכום בול מול מה שנשמר על הפוליסה.
   סימולטור/תיקון ידני מנצח. בלי סימולטור — מה שהוזן.
   לא נוגעים במנוע האשף ולא בדוח המכירות היומי.
   הרצה: node _test-agent-kpi-exact.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260925-agent-kpi-exact-v1";
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const wizard = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + cache, האשף לא זז");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");
assert(wizard.includes("return this.getPolicyPremiumBeforeDiscount(policy);"), "אשף AfterDiscount נשאר לפני");

console.log("\n2) הכרטיסים קוראים לסכום שנשמר, דוח העבודה נשאר");
const today = extractObjectMethod(app, "_accumulateTodayHealthRiskSales");
const month = extractObjectMethod(app, "accumulateCustomerIntoBothAggs");
const dailyReport = extractObjectMethod(app, "buildDailySalesAgentRows");
assert(today.includes("wizardSaleAfterDiscount(p)"), "נמכר היום משתמש בסכום השמור");
assert(today.includes("_isHealthOrRiskWizardSale(p)"), "נמכר היום רק בריאות וסיכונים");
assert(month.includes("wizardSaleAfterDiscount(p)"), "פרמיה חודשית נטו משתמשת בסכום השמור");
assert(month.includes("if(!stamp) continue;"), "בלי חותמת מכירה אין כניסה לחודש");
assert(app.includes("const agentSelfKpi = Auth.getDashboardSalesScope?.() === \"self\""), "נציג לא נדרס על ידי RPC");
assert(app.includes("this.policyNetPremium(p)"), "דוח המכירות היומי נשאר על המסלול הקיים");
if(dailyReport){
  assert(!dailyReport.includes("wizardSaleAfterDiscount"), "שורות דוח העבודה לא עברו לנוסחה החדשה");
}

console.log("\n3) נוסחה: סימולטור, או מה שהוזן");
const fn = extractObjectMethod(app, "wizardSaleAfterDiscount");
const money = extractObjectMethod(app, "_saleMoney");
const round = extractObjectMethod(app, "_roundSaleMoney");
assert(!!fn && !!money && !!round, "חולצו עזרי הסכום");
const box = {};
vm.runInNewContext(
  "this._saleMoney = function" + money.slice("_saleMoney".length) + ";\n"
  + "this._roundSaleMoney = function" + round.slice("_roundSaleMoney".length) + ";\n"
  + "this.wizardSaleAfterDiscount = function" + fn.slice("wizardSaleAfterDiscount".length) + ";",
  box
);
const sale = (p) => box.wizardSaleAfterDiscount(p);

assert(sale({
  premiumMonthly: "95.83",
  premiumAfterDiscountValue: 95.83,
  simDiscountPerInsured: { ins1: { monthlyAfterDiscount: 28.75 } }
}) === 28.75, "סימולטור 28.75 ולא 95.83 שנשמר כברוטו");

assert(sale({
  premiumMonthly: "80",
  premiumPerInsured: { a: "100" },
  healthAddonPremiums: { "מחלות קשות": { a: "20" } },
  simDiscountPerInsured: { a: { monthlyAfterDiscount: 70 } }
}) === 70, "יש סימולטור — לא מוסיפים תוספת שוב");

assert(sale({
  premiumMonthly: "200",
  premiumAfterDiscountValue: 200,
  premiumPerInsured: { a: "70" },
  healthAddonPremiums: { "מחלות קשות": { a: "30" } }
}) === 100, "בלי סימולטור: מה שהוזן 70+30, לא 200");

assert(sale({
  premiumMonthly: "88",
  premiumAfterDiscountValue: 120
}) === 88, "בלי סימולטור ובלי פירוט: הסכום שהוזן, לא השדה המועתק");

assert(sale({
  premiumMonthly: "150",
  premiumPerInsured: { a: "90", b: "40" },
  simDiscountPerInsured: { a: { monthlyAfterDiscount: 60 } }
}) === 60, "מבוטח בלי סכום סימולטור לא מוסיף ברוטו");

assert(sale({
  type: "ריסק",
  origin: "existing",
  premiumMonthly: "40",
  simDiscountPerInsured: { a: { monthlyAfterDiscount: 0 } }
}) === 0, "אפס מפורש מהסימולטור נשמר כאפס");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
