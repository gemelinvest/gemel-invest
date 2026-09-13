/* GI-COUPLE-SHARED-FIELDS 2026-09-07
   פוליסה זוגית: סכום ביטוח / פיצוי ותאריך תחילה מהראשי ממלאים את המשני.
   הפרמיה נשארת לכל מבוטח. בלי שינוי במנועי תעריף.
   הרצה: node _test-wizard-couple-shared-fields.js
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

function safeTrim(v){ return String(v == null ? "" : v).trim(); }

const wiz = read("gi-wizard.js");
const sims = read("gi-simulators.js");
const app = read("app.js");

console.log("1) syntax + helpers");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard cache tag");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + TAG + '"'), "simulator cache tag");
assert(sims.includes("GI-COUPLE-SHARED-FIELDS"), "simulator couple shared-fields marker");
assert(wiz.includes("GI-COUPLE-SHARED-FIELDS"), "wizard couple shared-fields marker");
assert(sims.includes("function riskSimCopyCoupleSharedFieldsFromId(sim, sourceId)"), "copy from any couple member");
assert(sims.includes("function riskSimCopyCoupleSharedFieldsFromSeed(sim)"), "copy from primary seed");
assert(sims.includes("function riskSimEnsureCoupleSharedResults(sim)"), "purchase prepares couple results");
assert(sims.includes("try { riskSimEnsureCoupleSharedResults(sim); } catch(_eCouple) {}"), "add-to-proposal runs couple prepare");
assert(sims.includes("try { riskSimCopyCoupleSharedFieldsFromSeed(sim); } catch(_eShare) {}"), "checking זוגית copies shared fields");
assert(sims.includes("riskSimCalcOtherCoupleMembers(sim, id)"), "shell calc also calcs the other couple members");
assert(!/riskSimCopyCoupleSharedFieldsFromId[\s\S]{0,900}monthlyPremium/.test(sims.slice(sims.indexOf("function riskSimCopyCoupleSharedFieldsFromId"))), "shared copy does not touch monthlyPremium");
assert(wiz.includes("fillCoupleSharedPolicyFields(draft)"), "couple purchase fills missing per-insured amounts");
assert(wiz.includes("this.fillCoupleSharedPolicyFields(p)"), "addDraftPolicy fills missing couple amounts");

console.log("\n2) runtime — copy + Next on real Wizard methods");
function parseAnyDmyDate(value){
  const s = safeTrim(value);
  if(!s) return null;
  let y = null, m = null, d = null;
  let hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if(hit){ y = Number(hit[1]); m = Number(hit[2]); d = Number(hit[3]); }
  else {
    hit = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if(hit){ d = Number(hit[1]); m = Number(hit[2]); y = Number(hit[3]); }
  }
  if(!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if(Number.isNaN(dt.getTime()) || dt.getFullYear() !== y || dt.getMonth() !== (m - 1) || dt.getDate() !== d) return null;
  return { year:y, month:m, day:d, date:dt };
}
function parseBirthDateValue(value){
  const p = parseAnyDmyDate(value);
  if(!p) return null;
  if(p.date > new Date()) return null;
  return p;
}

const host = new Proxy({
  Wizard: {},
  safeTrim,
  parseAnyDmyDate,
  parseBirthDateValue,
  formatDmyFromParts(y, m, d){
    return String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0") + "/" + String(y).padStart(4, "0");
  },
  escapeHtml: (s) => String(s == null ? "" : s),
  on(){}, $(){ return null; }, $$(){ return []; },
  nowISO: () => "2026-09-07T10:00:00.000Z",
  RiskSimulators: { hasCatalog(){ return true; }, getHandler(){ return { open(){}, close(){} }; } }
}, {
  get(target, prop){
    if(prop in target) return target[prop];
    if(prop === "then") return undefined;
    return () => {};
  }
});

function makeNode(id){
  return {
    id: id || "", children: [], parentElement: null,
    classList: { _s: new Set(), add(){}, remove(){}, contains(){ return false; } },
    appendChild(child){ this.children.push(child); return child; },
    querySelector(){ return null; }, querySelectorAll(){ return []; }
  };
}
const fakeBody = makeNode("body");
const sandbox = {
  __GI_WIZARD_HOST: host,
  globalThis: null,
  window: {
    requestAnimationFrame(fn){ fn(); },
    setTimeout(fn){ return fn(); },
    clearTimeout(){},
    showToast(){}
  },
  document: {
    getElementById(){ return null; },
    createElement(){ return makeNode(""); },
    querySelectorAll(){ return []; },
    querySelector(){ return null; },
    addEventListener(){}, removeEventListener(){},
    body: fakeBody
  },
  console,
  Auth: { current: { name: "נציג בדיקה" } }
};
sandbox.globalThis = sandbox;
vm.runInNewContext(wiz, sandbox, { filename: "gi-wizard.js" });
const W = host.Wizard;
assert(typeof W.fillCoupleSharedPolicyFields === "function", "Wizard.fillCoupleSharedPolicyFields loaded");

W.insureds = [
  { id:"i1", type:"primary", label:"מבוטח ראשי - דוד כהן", data:{ firstName:"דוד", lastName:"כהן" } },
  { id:"i2", type:"spouse", label:"מבוטח משני בן / בת זוג - יעל כהן", data:{ firstName:"יעל", lastName:"כהן" } }
];
W.render = () => {};
W.isOpen = true;
W.step = 5;
W.isCustomerPurchaseMode = () => false;
W.closeNpOpenSimulator = function(){};
W.resetNpSimAutoOpenKey = function(){
  this._npSimAutoOpenedKey = "";
  this._npSimPickByInsured = {};
  this._npSimLegalByInsured = null;
  this._npSimCoupleOn = false;
  this._npSimCoupleIds = {};
};
W.resetPremiumSanityState = function(){};

function resetWizard(){
  W.newPolicies = [];
  W.policyDraft = null;
  W.editingPolicyId = null;
  W._npShowPick = false;
  W.ensurePolicyDraft();
}

function issuesOf(policy){
  return W.collectNewPolicyValidationIssues(policy, { policyIndex: 0, policyId: policy.id }).map((r) => r.message);
}

{
  const filled = W.fillCoupleSharedPolicyFields({
    insuredMode: "couple",
    insuredIds: ["i1","i2"],
    sumInsuredPerInsured: { i1: "800000" },
    compensationPerInsured: { i1: "100000" }
  });
  assert(filled.sumInsuredPerInsured.i2 === "800000", "missing risk sum on secondary is filled from primary");
  assert(filled.compensationPerInsured.i2 === "100000", "missing CI compensation on secondary is filled from primary");
  assert(filled.sumInsured === "800000", "policy-level sumInsured is filled");
  assert(filled.compensation === "100000", "policy-level compensation is filled");
}

{
  const kept = W.fillCoupleSharedPolicyFields({
    insuredMode: "couple",
    insuredIds: ["i1","i2"],
    sumInsuredPerInsured: { i1: "800000", i2: "500000" }
  });
  assert(kept.sumInsuredPerInsured.i2 === "500000", "an already-typed secondary sum is not overwritten");
}

{
  const single = W.fillCoupleSharedPolicyFields({
    insuredMode: "single",
    insuredIds: ["i1"],
    sumInsuredPerInsured: { i1: "800000" }
  });
  assert(!single.sumInsuredPerInsured.i2, "non-couple policies are left untouched");
}

{
  const riskCouple = {
    id: "npol_r",
    company: "כלל",
    type: "ריסק",
    insuredMode: "couple",
    insuredIds: ["i1","i2"],
    insuredId: "i1",
    premiumPerInsured: { i1: "61.32", i2: "40" },
    sumInsured: "",
    sumInsuredPerInsured: { i1: "800000" },
    startDate: "2026-10-01"
  };
  const before = issuesOf(riskCouple);
  assert(!before.some((m) => String(m).includes("סכום ביטוח")), "couple risk Next accepts a sum that exists only on the primary");
  W.fillCoupleSharedPolicyFields(riskCouple);
  assert(riskCouple.sumInsuredPerInsured.i2 === "800000", "fill writes the shared sum onto the secondary before save");
}

{
  const ciCouple = {
    id: "npol_c",
    company: "כלל",
    type: "מחלות קשות",
    insuredMode: "couple",
    insuredIds: ["i1","i2"],
    insuredId: "i1",
    premiumPerInsured: { i1: "38.03", i2: "42" },
    compensationPerInsured: { i1: "100000" },
    startDate: "2026-10-01"
  };
  const before = issuesOf(ciCouple);
  assert(!before.some((m) => String(m).includes("סכום פיצוי")), "couple CI Next accepts compensation that exists only on the primary");
}

{
  const stillMissing = {
    id: "npol_empty",
    company: "כלל",
    type: "ריסק",
    insuredMode: "couple",
    insuredIds: ["i1","i2"],
    insuredId: "i1",
    premiumPerInsured: { i1: "61.32", i2: "40" },
    sumInsuredPerInsured: {},
    startDate: "2026-10-01"
  };
  const msgs = issuesOf(stillMissing);
  assert(msgs.some((m) => String(m).includes("סכום ביטוח")), "couple risk still blocks when nobody has a sum");
}

resetWizard();
W.policyDraft.company = "כלל";
W.policyDraft.type = "ריסק";
W.purchaseAllSimulatorInsureds([
  {
    insId:"i1", company:"כלל", product:"ריסק", label:"ראשי - דוד כהן",
    payload:{ ok:true, monthlyPremium:61.32, sumInsured:"800000", insuranceStartDate:"01/10/2026" }
  },
  {
    insId:"i2", company:"כלל", product:"ריסק", label:"משני - יעל כהן",
    payload:{ ok:true, monthlyPremium:40 }
  }
], { couple:true, coupleIds:["i1","i2"] });
assert((W.newPolicies || []).length === 2, "multi-select risk writes one row per insured");
const riskPol1 = W.newPolicies.find((p) => (p.insuredIds || [])[0] === "i1") || W.newPolicies[0];
const riskPol2 = W.newPolicies.find((p) => (p.insuredIds || [])[0] === "i2") || W.newPolicies[1];
assert(riskPol1 && riskPol1.insuredMode !== "couple", "primary row is single (not couple)");
assert(riskPol2 && riskPol2.insuredMode !== "couple", "secondary row is single (not couple)");
assert(riskPol1.sumInsuredPerInsured.i1 === "800000", "primary keeps its risk sum");
assert(riskPol2.sumInsuredPerInsured.i2 === "800000", "secondary inherits shared risk sum from primary");
assert(riskPol1.startDate === "2026-10-01" || riskPol2.startDate === "2026-10-01", "start date from the primary is kept on a row");
assert(String(riskPol2.premiumPerInsured.i2).indexOf("40") === 0, "secondary premium is not replaced by the primary premium");
const riskNext = W.validateStep5();
assert(riskNext.ok === true, "Next is allowed after multi-select risk add");

resetWizard();
W.policyDraft.company = "כלל";
W.policyDraft.type = "מחלות קשות";
W.purchaseAllSimulatorInsureds([
  {
    insId:"i1", company:"כלל", product:"מחלות קשות", label:"ראשי - דוד כהן",
    payload:{ ok:true, monthlyPremium:38.03, compensation:"100000", insuranceStartDate:"01/10/2026" }
  },
  {
    insId:"i2", company:"כלל", product:"מחלות קשות", label:"משני - יעל כהן",
    payload:{ ok:true, monthlyPremium:42 }
  }
], { couple:true, coupleIds:["i1","i2"] });
assert((W.newPolicies || []).length === 2, "multi-select CI writes one row per insured");
const ciPol2 = W.newPolicies.find((p) => (p.insuredIds || [])[0] === "i2") || W.newPolicies[1];
assert(ciPol2 && ciPol2.compensationPerInsured.i2 === "100000", "multi CI fills secondary compensation from primary");
assert(String(ciPol2.premiumPerInsured.i2).indexOf("42") === 0, "CI secondary premium stays 42");
const ciNext = W.validateStep5();
assert(ciNext.ok === true, "Next is allowed after multi-select CI add");

resetWizard();
W.policyDraft.company = "כלל";
W.policyDraft.type = "ריסק";
W.purchaseAllSimulatorInsureds([
  {
    insId:"i1", company:"כלל", product:"ריסק", label:"ראשי",
    payload:{ ok:true, monthlyPremium:61.32, sumInsured:"800000", insuranceStartDate:"01/10/2026" }
  }
], { couple:true, coupleIds:["i1"] });
assert((W.newPolicies || []).length === 0, "couple with one insured still does not write a policy");

resetWizard();
W.policyDraft.company = "כלל";
W.policyDraft.type = "ריסק";
W.purchaseAllSimulatorInsureds([
  {
    insId:"i1", company:"כלל", product:"ריסק", label:"ראשי - דוד כהן",
    payload:{ ok:true, monthlyPremium:61.32, sumInsured:"800000", insuranceStartDate:"01/10/2026" }
  },
  {
    insId:"i2", company:"כלל", product:"ריסק", label:"משני - יעל כהן",
    payload:{ ok:true, monthlyPremium:40, sumInsured:"800000" }
  },
  {
    insId:"i3", company:"כלל", product:"ריסק", label:"ילד - ללא חישוב",
    payload:null
  }
], { couple:true, coupleIds:["i1","i2","i3"] });
assert((W.newPolicies || []).length === 2, "multi-select adds ready marked insureds even if one marked lacks calc");
assert((W.newPolicies || []).some((p) => (p.insuredIds || [])[0] === "i1"), "primary ready row added");
assert((W.newPolicies || []).some((p) => (p.insuredIds || [])[0] === "i2"), "secondary ready row added");
assert(!(W.newPolicies || []).some((p) => (p.insuredIds || [])[0] === "i3"), "unready marked insured is skipped");


resetWizard();
W.policyDraft.company = "הפניקס";
W.policyDraft.type = "ריסק";
W.purchaseSimulatorInsured("i1", {
  ok:true, monthlyPremium:200, sumInsured:"1000000", insuranceStartDate:"01/10/2026"
}, null, { skipToast:true, skipRender:true });
const single = W.newPolicies[0];
assert(single && single.insuredMode !== "couple", "single purchase path is unchanged");
assert(single.sumInsuredPerInsured.i1 === "1000000", "single policy keeps its own sum");
assert(!single.sumInsuredPerInsured.i2, "single policy does not invent a spouse sum");

console.log("\n3) simulator copy helper on a plain state object");
{
  const copyStart = sims.indexOf("function riskSimCopyCoupleSharedFieldsFromId(sim, sourceId){");
  const copyEnd = sims.indexOf("function riskSimCopyCoupleSharedFieldsFromSeed(sim){", copyStart);
  const fnSrc = sims.slice(copyStart, copyEnd);
  const fn = new Function("safeTrim", "riskSimAllowsCouplePolicy", "riskSimCoupleSelectedIds", fnSrc + "\nreturn riskSimCopyCoupleSharedFieldsFromId;");
  const copyFromId = fn(
    safeTrim,
    () => true,
    (sim) => Object.keys(sim._giCoupleIds || {}).filter((id) => sim._giCoupleIds[id])
  );
  const sim = {
    _giCoupleOn: true,
    _ctx: { wizardWorkspace: true, product: "ריסק" },
    _giCoupleIds: { i1: true, i2: true },
    _state: {
      i1: { sumInsured: "800000", compensation: "", insuranceStartDate: "01/10/2026", insuranceStartDateSource: "manual", result: { ok:true, monthlyPremium: 61.32 } },
      i2: { sumInsured: "", compensation: "", insuranceStartDate: "", result: null, monthlyPremium: 40 }
    },
    _syncAge(st){ st.ageSynced = st.insuranceStartDate; }
  };
  copyFromId(sim, "i1");
  assert(sim._state.i2.sumInsured === "800000", "simulator copy writes primary sum onto secondary");
  assert(sim._state.i2.insuranceStartDate === "01/10/2026", "simulator copy writes primary start date onto secondary");
  assert(sim._state.i2.ageSynced === "01/10/2026", "copied start date refreshes secondary age");
  assert(sim._state.i1.result && sim._state.i1.result.monthlyPremium === 61.32, "primary calculated premium is not cleared");
  assert(sim._state.i2.result === null, "stale secondary result is cleared so it can be recalculated");
  assert(sim._state.i2.monthlyPremium === 40, "secondary premium field is not copied from primary");

  const off = {
    _giCoupleOn: false,
    _ctx: { wizardWorkspace: true, product: "ריסק" },
    _giCoupleIds: { i1: true, i2: true },
    _state: {
      i1: { sumInsured: "800000", insuranceStartDate: "01/10/2026" },
      i2: { sumInsured: "", insuranceStartDate: "" }
    }
  };
  copyFromId(off, "i1");
  assert(off._state.i2.sumInsured === "", "copy is a no-op when couple is off");
}

if(failed){
  console.error("\nFAILED  passed=" + passed + " failed=" + failed);
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
