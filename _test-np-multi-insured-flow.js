/* GI-NP-MULTI-INS-FLOW 2026-10-07
   כמה מבוטחים באותו לקוח:
   1) בלי בחירה מרובה — מה שנוסף נשאר אצל אותו מבוטח; מבוטח אחר יכול חברה/מוצר אחר.
   2) בחירה מרובה — תאריך/כיסויים/סכום/בנק מהראשי ממלאים חסרים; פרמיה לכל אחד.
      שינוי במבוטח מסוים לא נדרס. אחרי הוספה השורה מציגה את מה שצוין.
   הרצה: node _test-np-multi-insured-flow.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const BUILD = "20261007-lead-dup-v1";
const SIM_TAG = "20261007-np-health-buy-v1";
let failed = 0;
let passed = 0;

function assert(cond, msg){
  if(cond){ passed += 1; console.log("  PASS  " + msg); }
  else { failed += 1; console.error("  FAIL  " + msg); }
}
function read(name){ return fs.readFileSync(path.join(ROOT, name), "utf8"); }
function sliceFn(src, startNeedle, endNeedle){
  const start = src.indexOf(startNeedle);
  if(start < 0) return "";
  const end = src.indexOf(endNeedle, start + startNeedle.length);
  if(end < 0) return src.slice(start);
  return src.slice(start, end);
}
function safeTrim(v){ return String(v == null ? "" : v).trim(); }

const wiz = read("gi-wizard.js");
const sims = read("gi-simulators.js");
const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");
const renderStart = wiz.indexOf("renderStep5(){");
const renderEnd = wiz.indexOf("renderStep6(ins){", renderStart);
const renderFn = (renderStart >= 0 && renderEnd > renderStart) ? wiz.slice(renderStart, renderEnd) : "";

console.log("1) syntax + BUILD/SIM stay; cache via &giMultiIns=1");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(app.includes('const BUILD = "' + BUILD + '"') || app.includes('GI_WIZARD_JS_VERSION = "' + BUILD + '"'), "BUILD stays");
assert(wiz.includes('GI_WIZARD_BUILD = "' + BUILD + '"'), "wizard BUILD stays");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + SIM_TAG + '"'), "SIM tag stays");
assert(html.includes("&giMultiIns=1"), "index.html busts giMultiIns");
assert(app.includes("&giMultiIns=1"), "app.js busts giMultiIns");
assert(sw.includes("multi-ins-v1"), "service-worker busts multi-ins");
assert(sw.includes("sum-tot-v1"), "grand-total cache suffix stays");

console.log("\n2) source — isolation without multi; inherit + per-person override with multi");
assert(wiz.includes("GI-NP-MULTI-INS-FLOW"), "wizard multi-ins marker");
assert(sims.includes("GI-NP-MULTI-INS-FLOW"), "simulator multi-ins marker");
assert(sims.includes("sim._giCoupleSharedCustomized"), "shared-field customization map");
assert(sims.includes("riskSimMarkCoupleSharedCustom(sim, active)"), "editing a non-primary marks shared fields as custom");
assert(sims.includes("if(sim._giCoupleSharedCustomized && sim._giCoupleSharedCustomized[id]) return;"), "copy skips a customized dest");
assert(renderFn.includes("תחילה ${escapeHtml(startShown)}"), "summary row shows start date");
assert(renderFn.includes("שיעבוד · ${escapeHtml(pledgeBankNames.join"), "summary row shows pledged banks");
assert(wiz.includes("if(!this.simulatorLegalHasContent(e.legal) && this.simulatorLegalHasContent(seedLegal))"), "purchase fills empty legal from primary");
assert(sims.includes("riskSimCopyPledgeToCoupleInsureds(sim)"), "pledge copy helper still used");

const purchaseFn = sliceFn(sims, "function riskSimPurchaseWizardInsureds(sim){", "function riskSimPurchaseActiveInsured(sim){");
assert(purchaseFn.includes("riskSimCopyPledgeToCoupleInsureds(sim)"), "add-to-proposal inherits empty bank");
assert(purchaseFn.includes("חישוב לפי הנתונים של כל מבוטח בנפרד"), "premiums stay per insured");

console.log("\n3) runtime — shared copy fills empty dest, skips customized dest, never copies premium");
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
    _ctx: { wizardWorkspace: true, product: "ריסק משכנתא" },
    _giCoupleIds: { i1: true, i2: true },
    _state: {
      i1: { sumInsured: "400000", compensation: "", insuranceStartDate: "01/11/2026", result: { ok:true, monthlyPremium: 80 } },
      i2: { sumInsured: "", compensation: "", insuranceStartDate: "", result: null, monthlyPremium: 55 }
    },
    _syncAge(st){ st.ageSynced = st.insuranceStartDate; }
  };
  copyFromId(sim, "i1");
  assert(sim._state.i2.sumInsured === "400000", "multi copies primary sum onto empty secondary");
  assert(sim._state.i2.insuranceStartDate === "01/11/2026", "multi copies primary start date");
  assert(sim._state.i2.monthlyPremium === 55, "secondary premium is not copied from primary");
  assert(sim._state.i1.result.monthlyPremium === 80, "primary premium stays");

  sim._giCoupleSharedCustomized = { i2: true };
  sim._state.i1.sumInsured = "900000";
  sim._state.i2.sumInsured = "250000";
  copyFromId(sim, "i1");
  assert(sim._state.i2.sumInsured === "250000", "customized secondary sum is not overwritten");
  assert(sim._state.i1.sumInsured === "900000", "primary sum stays after skipped copy");
}

console.log("\n4) runtime — Wizard: single stays isolated; multi inherits empty bank/date; override kept");
function makeNode(id){
  return {
    id: id || "",
    children: [],
    classList: { add(){}, remove(){}, contains(){ return false; } },
    style: {},
    innerHTML: "",
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    appendChild(c){ this.children.push(c); return c; }
  };
}
const host = new Proxy({
  Wizard: {},
  safeTrim,
  parseAnyDmyDate(value){
    const s = safeTrim(value);
    const hit = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s) || /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if(!hit) return null;
    if(hit[0].indexOf("-") >= 0) return { year:Number(hit[1]), month:Number(hit[2]), day:Number(hit[3]) };
    return { day:Number(hit[1]), month:Number(hit[2]), year:Number(hit[3]) };
  },
  parseBirthDateValue(){ return null; },
  formatDmyFromParts(y, m, d){
    return String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0") + "/" + String(y);
  },
  escapeHtml: (s) => String(s == null ? "" : s),
  on(){}, $(){ return null; }, $$(){ return []; },
  nowISO: () => "2026-10-07T12:00:00.000Z",
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
    createElement(){ return makeNode(""); },
    querySelectorAll(){ return []; },
    querySelector(){ return null; },
    addEventListener(){}, removeEventListener(){},
    body: makeNode("body")
  },
  console,
  Auth: { current: { name: "נציג בדיקה" } }
};
sandbox.globalThis = sandbox;
vm.runInNewContext(wiz, sandbox, { filename: "gi-wizard.js" });
const W = host.Wizard;
assert(typeof W.purchaseAllSimulatorInsureds === "function", "Wizard purchaseAll loaded");
assert(typeof W.purchaseSimulatorInsured === "function", "Wizard purchase one loaded");

W.render = () => {};
W.isOpen = true;
W.step = 5;
W.insureds = [
  { id:"A", type:"primary", label:"מבוטח א", data:{ firstName:"דוד", lastName:"כהן" } },
  { id:"B", type:"spouse", label:"מבוטח ב", data:{ firstName:"יעל", lastName:"כהן" } }
];
W.isMedicareCompany = () => false;
W.isElementaryFlow = () => false;
W.closeNpOpenSimulator = () => {};
W.captureOpenSimulatorSession = () => {};
W.emptyPledgeBank = function(){ return { bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" }; };

function filledLegal(bankName, amount){
  return {
    pledge: true,
    pledgeConfirmed: true,
    pledgeBanks: [{ bankName, bankNo:"10", branch:"1", amount, years:"20", address:"רחוב 1" }],
    beneficiaries: []
  };
}
function emptyLegal(){
  return {
    pledge: false,
    pledgeConfirmed: false,
    pledgeBanks: [W.emptyPledgeBank()],
    beneficiaries: []
  };
}

W.newPolicies = [];
W.editingPolicyId = null;
W.policyDraft = null;
W.ensurePolicyDraft();
W.policyDraft.company = "הכשרה";
W.policyDraft.type = "ריסק";
W.purchaseSimulatorInsured("A", {
  ok:true, monthlyPremium: 61.32, sumInsured: "700000", insuranceStartDate:"01/10/2026"
}, filledLegal("בנק לאומי", "200000"), { skipToast:true, skipRender:true });

W.policyDraft = null;
W.ensurePolicyDraft();
W.policyDraft.company = "כלל";
W.policyDraft.type = "סרטן";
W.purchaseSimulatorInsured("B", {
  ok:true, monthlyPremium: 22.5, compensation: "100000", insuranceStartDate:"15/10/2026"
}, null, { skipToast:true, skipRender:true });

const rowA = (W.newPolicies || []).find((p) => (p.insuredIds || [])[0] === "A");
const rowB = (W.newPolicies || []).find((p) => (p.insuredIds || [])[0] === "B");
assert(!!rowA && !!rowB, "two single purchases write two rows");
assert(rowA.company === "הכשרה" && rowA.type === "ריסק", "primary row stays הכשרה · ריסק");
assert(rowB.company === "כלל" && rowB.type === "סרטן", "secondary row is כלל · סרטן");
assert((rowA.insuredIds || []).join() === "A", "primary row is only A");
assert((rowB.insuredIds || []).join() === "B", "secondary row is only B");
assert(rowA.pledgeBanks[0].bankName === "בנק לאומי", "primary bank stays on A");
assert(!rowB.pledge, "secondary cancer row has no pledge from A");
assert(W.toSimulatorDmyDate(rowA.startDate) === "01/10/2026", "primary start date stored");
assert(W.toSimulatorDmyDate(rowB.startDate) === "15/10/2026", "secondary start date stored separately");

W.newPolicies = [];
W.editingPolicyId = null;
W.policyDraft = null;
W.ensurePolicyDraft();
W.policyDraft.company = "הפניקס";
W.policyDraft.type = "ריסק משכנתא";
const payloadA = { ok:true, monthlyPremium: 90, sumInsured: "400000", insuranceStartDate:"01/11/2026" };
const payloadB = { ok:true, monthlyPremium: 70, sumInsured: "", insuranceStartDate:"" };
W.purchaseAllSimulatorInsureds([
  { insId:"A", company:"הפניקס", product:"ריסק משכנתא", payload: payloadA, legal: filledLegal("בנק הפועלים", "400000"), label:"מבוטח א" },
  { insId:"B", company:"הפניקס", product:"ריסק משכנתא", payload: payloadB, legal: emptyLegal(), label:"מבוטח ב" }
], { couple:true, coupleIds:["B","A"] });
const mA = (W.newPolicies || []).find((p) => (p.insuredIds || [])[0] === "A");
const mB = (W.newPolicies || []).find((p) => (p.insuredIds || [])[0] === "B");
assert(!!mA && !!mB, "multi-select writes two proposal rows");
assert(mA.sumInsured === "400000" || mA.sumInsuredPerInsured.A === "400000", "primary keeps 400000");
assert(mB.sumInsured === "400000" || mB.sumInsuredPerInsured.B === "400000", "empty secondary inherits 400000");
assert(W.toSimulatorDmyDate(mB.startDate) === "01/11/2026", "empty secondary inherits start date");
assert(Number(mA.premiumPerInsured.A) === 90, "primary premium is its own calc");
assert(Number(mB.premiumPerInsured.B) === 70, "secondary premium is its own calc");
assert(mA.pledgeBanks[0].bankName === "בנק הפועלים", "primary bank on A row");
assert(mB.pledge === true && mB.pledgeBanks[0].bankName === "בנק הפועלים", "empty secondary inherits Poalim");
assert(mA.company === "הפניקס" && mB.company === "הפניקס", "both rows stay on the open company");
assert(mA.type === "ריסק משכנתא" && mB.type === "ריסק משכנתא", "both rows stay on the open product");

W.newPolicies = [];
W.editingPolicyId = null;
W.policyDraft = null;
W.ensurePolicyDraft();
W.policyDraft.company = "הפניקס";
W.policyDraft.type = "ריסק משכנתא";
W.purchaseAllSimulatorInsureds([
  { insId:"A", company:"הפניקס", product:"ריסק משכנתא", payload: { ok:true, monthlyPremium: 90, sumInsured: "400000", insuranceStartDate:"01/11/2026" }, legal: filledLegal("בנק הפועלים", "400000"), label:"מבוטח א" },
  { insId:"B", company:"הפניקס", product:"ריסק משכנתא", payload: { ok:true, monthlyPremium: 64, sumInsured: "250000", insuranceStartDate:"05/11/2026" }, legal: filledLegal("בנק לאומי", "250000"), label:"מבוטח ב" }
], { couple:true, coupleIds:["A","B"] });
const oA = (W.newPolicies || []).find((p) => (p.insuredIds || [])[0] === "A");
const oB = (W.newPolicies || []).find((p) => (p.insuredIds || [])[0] === "B");
assert(oB.sumInsured === "250000" || oB.sumInsuredPerInsured.B === "250000", "override sum on B is kept");
assert(W.toSimulatorDmyDate(oB.startDate) === "05/11/2026", "override start date on B is kept");
assert(oB.pledgeBanks[0].bankName === "בנק לאומי", "override bank on B is kept");
assert(Number(oB.premiumPerInsured.B) === 64, "override premium on B is kept");
assert(oA.pledgeBanks[0].bankName === "בנק הפועלים", "primary bank is unchanged by B override");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
