/* GI-ILS 2026-09-14 — 1K/1M בשדות סכום הופכים למספר עם אפסים, בלי לגעת בלוגיקת חישוב.
   הרצה: node _test-ils-amount-km.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260915-sys-notice-v4";
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

function sliceFunction(src, startToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  let i = startToken.endsWith("{")
    ? start + startToken.length - 1
    : src.indexOf("{", start);
  if(i < 0) return "";
  let depth = 0;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const sim = fs.readFileSync(path.join(ROOT, "gi-simulators.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD");

console.log("\n2) 1K / 1M expand to the real number of zeros");
const start = app.indexOf("const GI_ILS_AMOUNT = (function(){");
const end = app.indexOf("try { window.GI_ILS_AMOUNT = GI_ILS_AMOUNT; }");
assert(start >= 0 && end > start, "GI_ILS_AMOUNT helper found");
const ctx = { window: {}, document: { addEventListener(){} } };
vm.createContext(ctx);
vm.runInContext(app.slice(start, end) + "this.GI_ILS_AMOUNT = GI_ILS_AMOUNT;", ctx);
const A = ctx.GI_ILS_AMOUNT;
assert(A.expand("1K") === "1000", "1K → 1000");
assert(A.expand("1k") === "1000", "1k → 1000");
assert(A.expand("1M") === "1000000", "1M → 1000000");
assert(A.expand("1m") === "1000000", "1m → 1000000");
assert(A.expand("1.5M") === "1500000", "1.5M → 1500000");
assert(A.expand("250K") === "250000", "250K → 250000");
assert(A.expand("1,000K") === "1000000", "1,000K → 1000000");
assert(A.expand("1000") === "1000", "plain 1000 stays 1000");
assert(A.expand("1,000,000") === "1,000,000", "already-expanded grouping is not multiplied");
assert(A.parse("1M") === 1000000, "parse 1M");
assert(A.parse("₪1K") === 1000, "₪1K → 1000");
assert(A.grouped("1M") === "1,000,000", "grouped 1M shows zeros");
assert(A.grouped("1K") === "1,000", "grouped 1K shows zeros");
assert(A.shekelLabel("1M").replace(/\s/g, "").includes("1,000,000") || A.shekelLabel("1M").includes("1000000"), "hint shows real shekels");

console.log("\n3) only money fields — not years / ID / phone");
function fakeEl(attrs){
  return {
    tagName: "INPUT",
    id: attrs.id || "",
    getAttribute(k){ return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    hasAttribute(k){ return Object.prototype.hasOwnProperty.call(attrs, k); }
  };
}
assert(A.isAmountField(fakeEl({ "data-pdraft-per-insured-sum": "x" })), "sum insured field");
assert(A.isAmountField(fakeEl({ "data-pdraft-bank": "amount" })), "pledge amount field");
assert(!A.isAmountField(fakeEl({ "data-pdraft-bank": "years" })), "pledge years is not money");
assert(!A.isAmountField(fakeEl({ "data-mc-pledge-field": "years" })), "mirror pledge years is not money");
assert(!A.isAmountField(fakeEl({ "data-ce-field": "primary.idNumber" })), "ID is not money");
assert(!A.isAmountField(fakeEl({ "data-ce-field": "primary.phone" })), "phone is not money");
assert(!A.isAmountField(fakeEl({ "data-ce-field": "newPolicies.0.pledgeBank.years" })), "edit-file years is not money");
assert(A.isAmountField(fakeEl({ "data-ce-field": "newPolicies.0.pledgeBank.amount" })), "edit-file pledge amount is money");
assert(A.isAmountField(fakeEl({ "data-ce-field": "newPolicies.0.sumInsured" })), "edit-file sum is money");
assert(A.isAmountField(fakeEl({ "data-phx-field": "sumInsured" })), "simulator sum is money");
assert(!A.isAmountField(fakeEl({ "data-phx-field": "age" })), "simulator age is not money");

const live = { tagName: "INPUT", value: "1M", getAttribute: () => "1", hasAttribute: () => true, setSelectionRange(){}, closest(){ return null; }, parentElement: null };
assert(A.applyInput(live) && live.value === "1,000,000", "typing 1M rewrites the field to 1,000,000");

console.log("\n4) parsers call expand; discount/years logic does not");
const asMoney = sliceFunction(app, "asMoneyNumber(v){");
assert(asMoney.includes("GI_ILS_AMOUNT.expand"), "CustomersUI.asMoneyNumber expands K/M");
const asNum = sliceFunction(app, "asNumber(v){");
assert(!asNum.includes("GI_ILS_AMOUNT"), "asNumber is unchanged");
const life = sliceFunction(app, "asLifeMoneyNumber(v){");
assert(life.includes("GI_ILS_AMOUNT.expand"), "life money parser expands K/M");
const wizMoney = sliceFunction(wiz, "asMoneyNumber(v){");
assert(wizMoney.includes("giWizardExpandIlsAmount"), "wizard asMoneyNumber expands K/M");
const wizParse = sliceFunction(wiz, "parseMoneyNumber(v){");
assert(wizParse.includes("giWizardExpandIlsAmount"), "wizard parseMoneyNumber expands K/M");
const discPct = sliceFunction(wiz, "getPolicyDiscountPct(policy){");
assert(!discPct.includes("GI_ILS_AMOUNT") && !discPct.includes("giWizardExpandIlsAmount"), "discount percent parser unchanged");
const discYears = sliceFunction(wiz, "getPolicyDiscountSchedule(policy){");
assert(discYears.includes("policy?.discountYears"), "discount years still read as years");
assert(!discYears.includes("giWizardExpandIlsAmount"), "discount years are not K/M amounts");
assert(sim.includes("giIlsExpandLocal(raw"), "simulator digit formatter expands K/M first");
assert(sim.includes("s = giIlsExpandLocal(s)"), "manual premium prompt expands K/M");
assert(app.includes("חישוב פרמיה/הנחה ממשיך לקבל מספר רגיל"), "comment documents no calc-logic change");

console.log("\n5) display wiring stays on input, calc still strips non-digits");
assert(app.includes("GI_ILS_AMOUNT.bindDocument()"), "document listener rewrites amount fields");
assert(sim.includes("החישוב עצמו — _calc בכל סימולטור ממשיך לנקות"), "simulator calc still strips glyphs");
assert(app.includes('this._mcAsMoneyNumber(el.value)'), "mirror pledge hint uses money parser");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
