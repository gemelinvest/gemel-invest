/* GI-HACH-DISC-APPLY 2026-09-08
   הכשרה — מחלות קשות / ריסק / ריסק משכנתא:
   הנחה שנבחרה בסימולטור מחושבת על פרמיית התעריפון (שנה ראשונה)
   ונשמרת לפרמיה אחרי הנחה בהצעה, גם ב-«החל על הפוליסה».
   הרצה: node _test-hachshara-disc.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260913-menora-health-decl-v6";
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

function moneyAfterPct(shekels, pct){
  const ag = Math.round(Number(shekels) * 100);
  if(!Number.isFinite(ag)) return null;
  const p = Number(pct);
  if(!Number.isFinite(p) || p <= 0) return ag / 100;
  return Math.round((ag * (100 - p)) / 100) / 100;
}

const sims = read("gi-simulators.js");
const wiz = read("gi-wizard.js");
const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");
const engineSrc = read("gi-sim-discount-engine.js");

console.log("1) syntax + cache + wiring");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-sim-discount-engine.js")]).status === 0, "node --check discount engine");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + TAG + '"'), "app.js simulator cache");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard build tag");
assert(sims.includes("GI-HACH-DISC-APPLY"), "apply wrap marker");
assert(sims.includes("handler._giDiscBuildWrapped"), "build wrap flag");
assert(sims.includes("riskSimCollectResultForInsured(sim, sim._activeInsuredId)"), "discount UI uses collected result (ok + monthly)");
assert(wiz.includes("getPolicySimDiscountAfterTotal(policy){"), "wizard totals simulator after-discount");
assert(wiz.includes("r.simDiscount.monthlyAfterDiscount"), "wizard apply copies monthlyAfterDiscount");
assert(wiz.includes("api.afterMonthly(result, raw)"), "policy-row discount uses the same afterMonthly engine");

console.log("\n2) catalog year-1 percents for הכשרה CI / risk / mortgage");
assert(sims.includes('giSimDiscOpt("hach-ci-40"'), "CI 40% option");
assert(sims.includes('giSimDiscOpt("hach-r-100"'), "risk מגן 1 100");
assert(sims.includes('giSimDiscOpt("hach-m-100"'), "mortgage מגן 100");
assert(/"מחלות קשות":\s*\[[\s\S]*?hach-ci-40[\s\S]*?40, \{ years: 10 \}/.test(sims), "CI option is 40% for 10 years");
assert(/"ריסק":\s*\[[\s\S]*?hach-r-100[\s\S]*?\[55,50,30,15,15,15\]/.test(sims), "risk 100 year-1 is 55%");
assert(/"ריסק משכנתא":\s*\[[\s\S]*?hach-m-100[\s\S]*?\[55,50,30,15,15,15\]/.test(sims), "mortgage 100 year-1 is 55%");

console.log("\n3) runtime — quote, apply %, store after into proposal premium");
const registry = {};
const RiskSimulators = {
  registry,
  _key(c, p){ return String(c || "").trim() + "::" + String(p || "").trim(); },
  register(company, product, handler){
    this.registry[this._key(company, product)] = handler;
    return handler;
  },
  getHandler(company, product){
    return this.registry[this._key(company, product)] || null;
  },
  list(){ return Object.keys(this.registry); }
};
const sandbox = {
  console,
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  JSON,
  parseInt,
  isNaN,
  Infinity,
  setTimeout(){ return 0; },
  clearTimeout(){},
  document: {
    createElement(){ return { style: {}, classList:{ add(){}, remove(){} }, setAttribute(){}, addEventListener(){}, querySelector(){ return null; }, querySelectorAll(){ return []; }, appendChild(){}, remove(){} }; },
    getElementById(){ return null; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    addEventListener(){},
    removeEventListener(){},
    body: { appendChild(){} }
  },
  window: {
    localStorage: { getItem(){ return null; }, setItem(){} },
    addEventListener(){},
    showToast(){}
  }
};
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.window = sandbox.window;
sandbox.window.document = sandbox.document;
sandbox.document.defaultView = sandbox.window;
sandbox.__GI_SIM_HOST = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  escapeHtml(s){ return String(s == null ? "" : s); },
  on(){},
  $(){ return null; },
  $$(){ return []; },
  nowISO(){ return new Date().toISOString(); },
  parseBirthDateValue(){ return null; },
  parseAnyDmyDate(){ return null; },
  formatDmyFromParts(){ return ""; },
  applyDmyAutoFormat(){ return ""; },
  renderCompanyLogoHtmlForCompany(){ return ""; },
  ensureGiSimulatorStylesLoaded(){},
  RiskSimulators,
  onSimulatorsInstalled(){}
};
vm.runInNewContext(engineSrc, sandbox);
assert(!!sandbox.GiSimDiscountEngine && typeof sandbox.GiSimDiscountEngine.afterMonthly === "function", "discount engine loaded");
vm.runInNewContext(sims, sandbox);
const quote = sandbox.GiSimulatorQuotes && sandbox.GiSimulatorQuotes.quote;
const discApi = sandbox.GiSimulatorDiscounts;
assert(typeof quote === "function", "GiSimulatorQuotes.quote exported");
assert(!!discApi && typeof discApi.afterMonthly === "function", "GiSimulatorDiscounts.afterMonthly exported");
assert(typeof discApi.list === "function", "GiSimulatorDiscounts.list exported");

const cpi = sandbox.window.HealthCpi || sandbox.HealthCpi;
if(cpi){
  cpi._mem = {
    fetchedAt: "2026-09-07T13:00:00.000Z",
    targetPeriod: "07-2026",
    current: { year: 2026, month: 7, monthDesc: "יולי", linked: 112.8774 },
    anchor: { year: 2023, month: 7, monthDesc: "יולי", linked: 104.5 },
    source: "cbs"
  };
}

const cases = [
  {
    product: "מחלות קשות",
    optionId: "hach-ci-40",
    year1: 40,
    input: { age: 43, gender: "זכר", smoker: false, compensation: 100000 },
    seedState(q){
      return {
        compensation: "100000",
        result: Object.assign({ ok: true }, q),
        birthDate: "01/01/1983",
        insuranceStartDate: "01/09/2026",
        age: 43,
        gender: "זכר",
        smoker: false
      };
    }
  },
  {
    product: "ריסק",
    optionId: "hach-r-100",
    year1: 55,
    input: { age: 40, gender: "זכר", smoker: false, sumInsured: 1000000 },
    seedState(q){
      return {
        sumInsured: "1000000",
        result: Object.assign({ ok: true }, q),
        birthDate: "01/01/1986",
        insuranceStartDate: "01/09/2026",
        age: 40,
        gender: "זכר",
        smoker: false,
        occupation: ""
      };
    }
  },
  {
    product: "ריסק משכנתא",
    optionId: "hach-m-100",
    year1: 55,
    input: { age: 40, gender: "זכר", smoker: false, sumInsured: 1000000 },
    seedState(q){
      return {
        sumInsured: "1000000",
        result: Object.assign({ ok: true }, q),
        birthDate: "01/01/1986",
        insuranceStartDate: "01/09/2026",
        age: 40,
        gender: "זכר",
        smoker: false,
        occupation: ""
      };
    }
  }
];

function wizardStore(result){
  const draft = { premiumPerInsured: {}, simDiscountPerInsured: {} };
  const monthlyNum = Number(result.monthlyPremium);
  draft.premiumPerInsured.i1 = Number.isFinite(monthlyNum) ? monthlyNum.toFixed(2) : String(result.monthlyPremium);
  const simAfterRaw = result.simDiscount ? result.simDiscount.monthlyAfterDiscount : null;
  const simAfterNum = (simAfterRaw == null || simAfterRaw === "") ? NaN : Number(simAfterRaw);
  if(result.simDiscount && Number.isFinite(simAfterNum)){
    draft.simDiscountPerInsured.i1 = JSON.parse(JSON.stringify(result.simDiscount));
    draft.simDiscountPerInsured.i1.monthlyAfterDiscount = simAfterNum;
  } else {
    delete draft.simDiscountPerInsured.i1;
  }
  return draft;
}

function rowAfter(policy){
  const map = policy.simDiscountPerInsured;
  const ids = Object.keys(policy.premiumPerInsured || {});
  if(!map || typeof map !== "object" || !ids.length) return null;
  let total = 0;
  let found = false;
  ids.forEach((iid) => {
    const raw = map[iid] && map[iid].monthlyAfterDiscount;
    const n = (raw == null || raw === "") ? NaN : Number(raw);
    if(Number.isFinite(n)){
      total += n;
      found = true;
    } else {
      total += Number(policy.premiumPerInsured[iid]) || 0;
    }
  });
  if(!found) return null;
  return Math.round(total * 100) / 100;
}

cases.forEach((c) => {
  const opts = discApi.list("הכשרה", c.product);
  assert(Array.isArray(opts) && opts.length > 0, c.product + " has catalog options");
  opts.forEach((opt) => {
    const y1 = discApi.year1Pct(opt);
    assert(Number.isFinite(y1) && y1 > 0, c.product + " " + opt.id + " year-1 pct = " + y1);
  });
  const chosen = discApi.byId("הכשרה", c.product, c.optionId);
  assert(!!chosen, c.product + " option " + c.optionId + " exists");
  assert(discApi.year1Pct(chosen) === c.year1, c.product + " " + c.optionId + " year-1 is " + c.year1 + "%");

  const q = quote("הכשרה", c.product, c.input);
  assert(!!q && q.ok === true && Number(q.monthlyPremium) > 0, c.product + " quote ok");
  const expected = moneyAfterPct(q.monthlyPremium, c.year1);
  const engineAfter = sandbox.GiSimDiscountEngine.afterMonthly(Object.assign({ ok: true }, q), chosen);
  const apiAfter = discApi.afterMonthly(Object.assign({ ok: true }, q), chosen);
  assert(engineAfter === expected, c.product + " engine after = " + expected + " (gross " + q.monthlyPremium + " − " + c.year1 + "%)");
  assert(apiAfter === expected, c.product + " GiSimulatorDiscounts.afterMonthly matches engine");
  assert(engineAfter < q.monthlyPremium, c.product + " after-discount is lower than tariff gross");
  if(Number.isFinite(q.baseMonthlyPremium)){
    const onBase = moneyAfterPct(q.baseMonthlyPremium, c.year1);
    assert(engineAfter !== onBase || q.baseMonthlyPremium === q.monthlyPremium,
      c.product + " discount is on tariff premium (no separate CPI base)");
  }

  const handler = RiskSimulators.getHandler("הכשרה", c.product);
  assert(!!handler && typeof handler._buildResultForInsured === "function", c.product + " handler registered");
  assert(handler._giDiscBuildWrapped === true, c.product + " apply wrap installed");
  handler._ctx = { company: "הכשרה", product: c.product, wizardWorkspace: true };
  handler._activeInsuredId = "i1";
  handler._giSimDiscountSel = { i1: c.optionId };
  handler._state = { i1: c.seedState(q) };
  const built = handler._buildResultForInsured("i1");
  assert(!!built, c.product + " _buildResultForInsured returns a result");
  assert(built.ok === true, c.product + " wrapped result has ok:true");
  assert(Math.abs(Number(built.monthlyPremium) - Number(q.monthlyPremium)) < 0.001, c.product + " wrap keeps tariff gross");
  assert(!!built.simDiscount, c.product + " wrap attaches simDiscount (החל על הפוליסה)");
  assert(built.simDiscount.optionId === c.optionId, c.product + " wrap keeps option id");
  assert(built.simDiscount.year1Pct === c.year1, c.product + " wrap year-1 pct");
  assert(built.simDiscount.monthlyAfterDiscount === expected, c.product + " wrap monthlyAfterDiscount = " + expected);

  const stored = wizardStore(built);
  assert(stored.premiumPerInsured.i1 === Number(q.monthlyPremium).toFixed(2), c.product + " draft still stores gross");
  assert(stored.simDiscountPerInsured.i1.monthlyAfterDiscount === expected, c.product + " draft stores after");
  assert(rowAfter(stored) === expected, c.product + " proposal row after-discount uses " + expected + " not gross");

  handler._giSimDiscountSel = { i1: "" };
  const builtNone = handler._buildResultForInsured("i1");
  assert(!builtNone.simDiscount, c.product + " clearing the option does not attach simDiscount");
  const storedNone = wizardStore(builtNone);
  assert(rowAfter(storedNone) == null, c.product + " without a choice the row falls back to gross");
});

const ciGold = quote("הכשרה", "מחלות קשות", { age: 43, gender: "זכר", smoker: false, compensation: 100000 });
const riskGold = quote("הכשרה", "ריסק", { age: 40, gender: "זכר", smoker: false, sumInsured: 1000000 });
const mortGold = quote("הכשרה", "ריסק משכנתא", { age: 40, gender: "זכר", smoker: false, sumInsured: 1000000 });
assert(ciGold && ciGold.monthlyPremium === 93.6, "CI tariff gross ₪93.60 (for 40% → ₪56.16)");
assert(moneyAfterPct(93.6, 40) === 56.16, "CI 40% of ₪93.60 is ₪56.16");
assert(riskGold && riskGold.monthlyPremium === 86.67, "risk tariff gross ₪86.67 (for 55% → ₪39.00)");
assert(moneyAfterPct(86.67, 55) === 39.00, "risk 55% of ₪86.67 is ₪39.00");
assert(mortGold && mortGold.monthlyPremium === 80, "mortgage tariff gross ₪80.00 (for 55% → ₪36.00)");
assert(moneyAfterPct(80, 55) === 36.00, "mortgage 55% of ₪80.00 is ₪36.00");

const extraRisk = discApi.list("הכשרה", "ריסק");
extraRisk.forEach((opt) => {
  const after = discApi.afterMonthly(Object.assign({ ok: true }, riskGold), opt);
  const y1 = discApi.year1Pct(opt);
  assert(after === moneyAfterPct(riskGold.monthlyPremium, y1), "risk " + opt.id + " afterMonthly matches " + y1 + "%");
});
const extraMort = discApi.list("הכשרה", "ריסק משכנתא");
extraMort.forEach((opt) => {
  const after = discApi.afterMonthly(Object.assign({ ok: true }, mortGold), opt);
  const y1 = discApi.year1Pct(opt);
  assert(after === moneyAfterPct(mortGold.monthlyPremium, y1), "mortgage " + opt.id + " afterMonthly matches " + y1 + "%");
});

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
