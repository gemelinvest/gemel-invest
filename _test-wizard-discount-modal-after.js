/* GI-NP-DISC-MODAL-AFTER 2026-09-08
   מודאל «הנחה» בפוליסה חדשה: פרמיה אחרי הנחה מחושבת לפי אחוז
   כשאין afterMonthly מהסימולטור. getPolicyPremiumAfterDiscount נשאר «לפני».
   הרצה: node _test-wizard-discount-modal-after.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260909-customer-open-v1";
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

function safeTrim(v){ return String(v == null ? "" : v).trim(); }

const wiz = read("gi-wizard.js");
const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache (tag unchanged)");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-wizard-discount-modal-after.js")]).status === 0, "node --check this test");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build tag unchanged");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app.js wizard version unchanged");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache unchanged");
assert(sw.includes("gi-v12-" + TAG), "service worker cache unchanged");

console.log("\n2) source — fallback % without replacing the before-engine");
assert(wiz.includes("GI-NP-DISC-MODAL-AFTER"), "modal-after marker");
assert(wiz.includes("_percentDiscountAfterAmount(gross, pct)"), "percent helper");
assert(wiz.includes("_writePercentDiscountAfter(policy, insId, pct)"), "write-percent helper");
assert(wiz.includes("_ensureRowDiscountAfterPremium(policy)"), "row after helper");
assert(wiz.includes("this._applySimulatorDiscountAfter(policy, oneId, discountOption || selectedOpt)"), "save passes exception option, not only catalog idx");
assert(wiz.includes("opt || (payload && payload.discountOption)"), "multi-insured save uses payload option when catalog idx is empty");
assert(wiz.includes("if(discountOption) this.applyCoupleSharedSimulatorDiscount(policy)"), "couple reapplies on exception too");
assert(/getPolicyPremiumAfterDiscount\(policy\)\{\s*\/\/ 20260502-vFinalPremiumNoDiscountCalc:/.test(wiz), "no-discount-calc marker remains");
assert(extractObjectMethod(wiz, "getPolicyPremiumAfterDiscount").includes("getPolicyPremiumBeforeDiscount"), "engine still returns before");
assert(extractObjectMethod(wiz, "_applySimulatorDiscountAfter").includes("api.afterMonthly(result, raw)"), "simulator afterMonthly still preferred");
assert(extractObjectMethod(wiz, "savePolicyDiscountModal").includes("getHealthRowPremiumAfterDiscount")
  || extractObjectMethod(wiz, "_ensureRowDiscountAfterPremium").includes("getHealthRowPremiumAfterDiscount"),
  "stored after comes from the row helper");
assert(extractObjectMethod(wiz, "_ensureRowDiscountAfterPremium").includes('kind === "healthAddon"'), "addon target skips full-policy after");

let queryImpl = function(){ return null; };
const host = new Proxy({
  Wizard: {},
  safeTrim,
  parseAnyDmyDate(){ return null; },
  parseBirthDateValue(){ return null; },
  formatDmyFromParts(y, m, d){
    return String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0") + "/" + String(y).padStart(4, "0");
  },
  escapeHtml: (s) => String(s == null ? "" : s),
  on(){}, $(sel){ return queryImpl(sel); }, $$(){ return []; },
  nowISO: () => "2026-09-08T10:00:00.000Z",
  RiskSimulators: { hasCatalog(){ return true; }, getHandler(){ return { open(){}, close(){} }; } }
}, {
  get(target, prop){
    if(prop in target) return target[prop];
    if(prop === "then") return undefined;
    return () => {};
  }
});

const sandbox = {
  __GI_WIZARD_HOST: host,
  globalThis: null,
  window: { requestAnimationFrame(fn){ fn(); }, setTimeout(fn){ return fn(); }, clearTimeout(){}, showToast(){} },
  document: {
    getElementById(){ return null; },
    createElement(){ return {}; },
    querySelectorAll(){ return []; },
    querySelector(){ return null; },
    addEventListener(){}, removeEventListener(){},
    body: {}
  },
  console,
  Auth: { current: { name: "נציג בדיקה" } }
};
sandbox.globalThis = sandbox;
vm.runInNewContext(wiz, sandbox, { filename: "gi-wizard.js" });
const W = host.Wizard;

function basePolicy(extra){
  return Object.assign({
    id: "p1",
    company: "הפניקס",
    type: "בריאות",
    insuredIds: ["i1"],
    insuredId: "i1",
    insuredMode: "single",
    premiumMonthly: "100",
    premiumPerInsured: { i1: "100" }
  }, extra || {});
}

function stubModal(Wiz){
  Wiz.els = {
    policyDiscountPct: { value: "-1" },
    policyDiscountError: { textContent: "" },
    policyDiscountBenefitInputs: [],
    policyDiscountPreview: { innerHTML: "" },
    policyDiscountModal: null
  };
  Wiz.closePolicyDiscountModal = function(){};
  Wiz.render = function(){};
  Wiz.setHint = function(){};
  Wiz._advanceMultiDiscount = function(){ return false; };
  Wiz._multiDiscountTargets = null;
}

console.log("\n3) runtime — catalog / exception / keep simulator after");
{
  W.getSimulatorDiscountApi = () => null;
  const policy = basePolicy();
  W._applySimulatorDiscountAfter(policy, "i1", { label: "20% ל-10 שנים", pct: 20, years: 10 });
  assert(policy.simDiscountPerInsured.i1.monthlyAfterDiscount === 80, "no simulator API: 20% of 100 = 80");
  assert(W.getPolicyPremiumAfterDiscount(policy) === 100, "engine still returns before 100");
  assert(W.getPolicyPremiumBeforeDiscount(policy) === 100, "before stays 100");
  assert(W.getHealthRowPremiumAfterDiscount(policy) === 80, "row after uses the percent result");
}

{
  W.getSimulatorDiscountApi = () => ({
    byId(){ return { id: "phx-h-20", pct: 20, label: "20%" }; },
    afterMonthly(){ return 75; },
    year1Pct(){ return 20; }
  });
  const policy = basePolicy({
    simDiscountPerInsured: { i1: { optionId: "phx-h-20", year1Pct: 20, monthlyAfterDiscount: 75 } }
  });
  const opt = { id: "phx-h-20", label: "20%", pct: 20, years: 10, _simRaw: { id: "phx-h-20", pct: 20, label: "20%" } };
  W._applySimulatorDiscountAfter(policy, "i1", opt);
  assert(policy.simDiscountPerInsured.i1.monthlyAfterDiscount === 75, "keeps simulator after 75 instead of 80 from %");
  assert(W.getHealthRowPremiumAfterDiscount(policy) === 75, "row shows simulator after");
  assert(W.getPolicyPremiumAfterDiscount(policy) === 100, "engine still before");
}

{
  W.getSimulatorDiscountApi = () => ({
    byId(){ return { id: "phx-h-20", pct: 20, label: "20%" }; },
    afterMonthly(){ return 100; },
    year1Pct(){ return 20; }
  });
  const policy = basePolicy();
  const opt = { id: "phx-h-20", label: "20%", pct: 20, years: 10, _simRaw: { id: "phx-h-20", pct: 20 } };
  W._applySimulatorDiscountAfter(policy, "i1", opt);
  assert(policy.simDiscountPerInsured.i1.monthlyAfterDiscount === 80, "afterMonthly that returns gross falls back to 20% of 100");
}

{
  W.getSimulatorDiscountApi = () => null;
  const policy = basePolicy({
    simDiscountPerInsured: { i1: { optionId: "phx-h-20", year1Pct: 20, monthlyAfterDiscount: 75 } }
  });
  W._applySimulatorDiscountAfter(policy, "i1", null);
  assert(!policy.simDiscountPerInsured.i1, "null option still clears the insured slot");
}

{
  W.getSimulatorDiscountApi = () => null;
  const policy = basePolicy({
    simDiscountPerInsured: { i1: { optionId: "phx-h-20", year1Pct: 20, monthlyAfterDiscount: 75 } }
  });
  const ex = { label: "הנחה חריגה 30%", pct: 30, years: 1, schedule: "30", isException: true, manualException: true };
  W._applySimulatorDiscountAfter(policy, "i1", ex);
  assert(policy.simDiscountPerInsured.i1.monthlyAfterDiscount === 70, "exception 30% overwrites simulator 75 → 70");
  assert(policy.simDiscountPerInsured.i1.year1Pct === 30, "exception stores year1 30");
}

console.log("\n4) runtime — savePolicyDiscountModal writes row after");
{
  stubModal(W);
  W.getSimulatorDiscountApi = () => null;
  const policy = basePolicy();
  W.newPolicies = [policy];
  W._discountPolicyId = "p1";
  W._discountCurrentIdx = 0;
  W._discountOpts = [{ id: "phx-h-20", label: "20% ל-10 שנים", pct: 20, years: 10 }];
  W._npDiscInsuredIds = ["i1"];
  W._discountTarget = { kind: "base", productLabel: "בריאות" };
  W.savePolicyDiscountModal();
  assert(policy.simDiscountPerInsured.i1.monthlyAfterDiscount === 80, "modal catalog 20% stores after 80");
  assert(policy.premiumAfterDiscountValue === 80, "premiumAfterDiscountValue is the row after");
  assert(String(policy.premiumMonthly) === "100", "premiumMonthly stays the entered before");
  assert(W.getPolicyPremiumAfterDiscount(policy) === 100, "engine still before after save");
  assert(W.getHealthRowPremiumAfterDiscount(policy) === 80, "row after after save is 80");
}

{
  stubModal(W);
  const exEls = {
    pct: { value: "30" },
    approved: { checked: true },
    body: { hasAttribute(name){ return name !== "hidden"; } }
  };
  queryImpl = function(sel){
    if(sel === "#lcPolicyDiscountExceptionPct") return exEls.pct;
    if(sel === "#lcPolicyDiscountExceptionApproved") return exEls.approved;
    if(sel === "#lcPolicyDiscountExceptionBody") return exEls.body;
    return null;
  };
  W.getSimulatorDiscountApi = () => null;
  const policy = basePolicy({
    simDiscountPerInsured: { i1: { optionId: "keep-me", year1Pct: 20, monthlyAfterDiscount: 75 } }
  });
  W.newPolicies = [policy];
  W._discountPolicyId = "p1";
  W._discountCurrentIdx = -1;
  W._discountOpts = [];
  W._npDiscInsuredIds = ["i1"];
  W._discountTarget = { kind: "base", productLabel: "בריאות" };
  W.savePolicyDiscountModal();
  assert(policy.simDiscountPerInsured.i1.monthlyAfterDiscount === 70, "exception save 30% → 70, does not delete the map");
  assert(policy.discountManualException === true, "exception flag stored");
  assert(W.getPolicyPremiumAfterDiscount(policy) === 100, "engine still before on exception save");
  queryImpl = function(){ return null; };
}

{
  stubModal(W);
  W.getSimulatorDiscountApi = () => null;
  const policy = basePolicy({
    healthAddonPremiums: { "מחלות קשות": { i1: "40" } }
  });
  W.newPolicies = [policy];
  W._discountPolicyId = "p1";
  W._discountCurrentIdx = 0;
  W._discountOpts = [{ id: "ci-20", label: "20%", pct: 20, years: 10 }];
  W._npDiscInsuredIds = ["i1"];
  W._discountTarget = { kind: "healthAddon", cover: "מחלות קשות", productLabel: "מחלות קשות" };
  W.savePolicyDiscountModal();
  assert(!policy.simDiscountPerInsured || !policy.simDiscountPerInsured.i1,
    "health addon discount does not write full-policy monthlyAfterDiscount");
  assert(policy.healthAddonDiscounts["מחלות קשות"].i1.discountPct === "20", "addon payload still saved");
}

console.log("\n5) runtime — preview uses percent when simulator after is missing");
{
  stubModal(W);
  W.getSimulatorDiscountApi = () => null;
  const policy = basePolicy();
  W.newPolicies = [policy];
  W._discountPolicyId = "p1";
  W._discountPremiumBase = 100;
  W._discountCurrentIdx = 0;
  W._discountOpts = [{ id: "phx-h-20", label: "20%", pct: 20, years: 10 }];
  W._discountScheduleDraft = [{ year: 1, pct: 20 }];
  W._npDiscInsuredId = "i1";
  W.updatePolicyDiscountPreview();
  assert(/80/.test(W.els.policyDiscountPreview.innerHTML), "preview shows 80 from 20% of 100");
  assert(W.els.policyDiscountPreview.innerHTML.includes("לפי אחוז ההנחה שנבחר"), "preview note explains percent calc");
}

console.log("\n6) cover-manual discounts still apply % on gross");
{
  const policy = basePolicy({
    healthCovers: ["השתלות", "ניתוחים"],
    coverDiscounts: [{ name: "השתלות", pct: "20" }, { name: "ניתוחים", pct: "20" }],
    riskSimQuotes: {
      i1: {
        ok: true,
        monthlyPremium: 100,
        covers: [
          { wizardKey: "השתלות", monthlyPremium: 60 },
          { wizardKey: "ניתוחים", monthlyPremium: 40 }
        ]
      }
    }
  });
  const r = W.applyHealthCoverManualDiscounts(policy);
  assert(r.ok === true && r.before === 100, "manual cover base is still 100");
  assert(r.after === 80, "manual 20% of 100 is still 80");
}

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
