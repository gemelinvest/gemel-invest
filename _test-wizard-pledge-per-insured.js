/* GI-WIZ-PLEDGE-PER-INSURED 2026-09-27
   באשף: שעבוד לכל מבוטח. בחירה מרובה לא דורסת שעבוד שכבר מולא,
   ו«הוסף להצעה» לא מאחד שעבודים. ירושה ליעד ריק נשארת ב«אשר».
   הרצה: node _test-wizard-pledge-per-insured.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260930-phoenix-life-ci-v1";
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

function sliceFn(src, startNeedle, endNeedle){
  const start = src.indexOf(startNeedle);
  if(start < 0) return "";
  const end = src.indexOf(endNeedle, start + startNeedle.length);
  if(end < 0) return src.slice(start);
  return src.slice(start, end);
}

function safeTrim(v){ return String(v == null ? "" : v).trim(); }

const sims = read("gi-simulators.js");
const wiz = read("gi-wizard.js");
const app = read("app.js");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=20260930-phoenix-life-ci-v1"'), "simulator cache");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "wizard version");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard build");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");

console.log("\n2) source — copy skips a filled dest; purchase does not unify");
assert(sims.includes("GI-WIZ-PLEDGE-PER-INSURED"), "per-insured pledge marker");
assert(sims.includes("function riskSimLegalHasOwnPledge(legal)"), "own-pledge helper");
assert(sims.includes("if(riskSimLegalHasOwnPledge(dest)) return;"), "copy does not overwrite a filled dest");
const purchaseFn = sliceFn(sims, "function riskSimPurchaseWizardInsureds(sim){", "function riskSimPurchaseActiveInsured(sim){");
assert(purchaseFn.includes("function riskSimPurchaseWizardInsureds(sim){"), "purchase helper extracted");
assert(!purchaseFn.includes("riskSimCopyPledgeToCoupleInsureds"), "הוסף להצעה does not copy pledge across insureds");
assert(purchaseFn.includes("GI-WIZ-PLEDGE-PER-INSURED"), "purchase comments the per-insured rule");
const confirmSrc = sliceFn(sims, 'const confirmBtn = modal.querySelector("[data-gishell-legal-confirm]");', 'const editBtn = modal.querySelector("[data-gishell-legal-edit]");');
assert(confirmSrc.includes("riskSimCopyPledgeToCoupleInsureds(sim)"), "אשר still inherits into empty dests");

console.log("\n3) runtime — copy helper on the real function body");
const copySrc = sliceFn(sims, "function riskSimEmptyPledgeBank(){", "function riskSimEmptyBeneficiary(){");
assert(copySrc.includes("function riskSimCopyPledgeToCoupleInsureds(sim){"), "copy body extracted");
const copyBox = {
  safeTrim,
  riskSimCoupleSelectedIds(sim){
    const map = sim && sim._giCoupleIds && typeof sim._giCoupleIds === "object" ? sim._giCoupleIds : {};
    return Object.keys(map).filter((id) => !!map[id]);
  },
  riskSimEnsureLegalMap(sim){
    return sim._ctx.wizardLegalByInsured;
  },
  riskSimGetLegal(sim, insId){
    const map = sim._ctx.wizardLegalByInsured;
    if(!map[insId]) map[insId] = { pledge:false, pledgeConfirmed:false, pledgeBanks:[{ bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" }], beneficiaries:[] };
    return map[insId];
  }
};
vm.createContext(copyBox);
vm.runInContext(copySrc, copyBox);

function filled(bankName, amount){
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
    pledgeBanks: [{ bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" }],
    beneficiaries: []
  };
}

assert(copyBox.riskSimLegalHasOwnPledge(filled("בנק לאומי", "200000")) === true, "filled pledge counts as own");
assert(copyBox.riskSimLegalHasOwnPledge({ pledge:true, pledgeConfirmed:false, pledgeBanks:emptyLegal().pledgeBanks }) === true, "checkbox-only still counts as own");
assert(copyBox.riskSimLegalHasOwnPledge(emptyLegal()) === false, "empty legal is not own");

const twoFilled = {
  _giCoupleOn: true,
  _giCoupleIds: { A:true, B:true },
  _activeInsuredId: "B",
  _ctx: { wizardLegalByInsured: { A: filled("בנק לאומי", "200000"), B: filled("בנק הפועלים", "300000") } }
};
copyBox.riskSimCopyPledgeToCoupleInsureds(twoFilled);
assert(twoFilled._ctx.wizardLegalByInsured.A.pledgeBanks[0].bankName === "בנק לאומי", "A keeps Leumi when both filled");
assert(twoFilled._ctx.wizardLegalByInsured.A.pledgeBanks[0].amount === "200000", "A keeps 200000");
assert(twoFilled._ctx.wizardLegalByInsured.B.pledgeBanks[0].bankName === "בנק הפועלים", "B keeps Poalim");

const inheritEmpty = {
  _giCoupleOn: true,
  _giCoupleIds: { A:true, B:true },
  _activeInsuredId: "A",
  _ctx: { wizardLegalByInsured: { A: filled("בנק לאומי", "200000"), B: emptyLegal() } }
};
copyBox.riskSimCopyPledgeToCoupleInsureds(inheritEmpty);
assert(inheritEmpty._ctx.wizardLegalByInsured.B.pledge === true, "empty B inherits pledge flag");
assert(inheritEmpty._ctx.wizardLegalByInsured.B.pledgeBanks[0].bankName === "בנק לאומי", "empty B inherits Leumi");
assert(inheritEmpty._ctx.wizardLegalByInsured.A.pledgeBanks[0].bankName === "בנק לאומי", "source A is unchanged");

const checkboxA = {
  _giCoupleOn: true,
  _giCoupleIds: { A:true, B:true },
  _activeInsuredId: "B",
  _ctx: {
    wizardLegalByInsured: {
      A: { pledge:true, pledgeConfirmed:false, pledgeBanks:emptyLegal().pledgeBanks, beneficiaries:[] },
      B: filled("בנק הפועלים", "300000")
    }
  }
};
copyBox.riskSimCopyPledgeToCoupleInsureds(checkboxA);
assert(checkboxA._ctx.wizardLegalByInsured.A.pledgeBanks[0].bankName === "", "checkbox-only A is not overwritten with B's banks");
assert(checkboxA._ctx.wizardLegalByInsured.A.pledge === true, "checkbox-only A keeps pledge=true");

console.log("\n4) runtime — purchaseAll keeps two distinct pledges");
const host = new Proxy({
  Wizard: {},
  safeTrim,
  parseAnyDmyDate(){ return null; },
  parseBirthDateValue(){ return null; },
  formatDmyFromParts(y, m, d){
    return String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0") + "/" + String(y).padStart(4, "0");
  },
  escapeHtml: (s) => String(s == null ? "" : s),
  on(){}, $(){ return null; }, $$(){ return []; },
  nowISO: () => "2026-09-27T12:00:00.000Z",
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
W.newPolicies = [];
W.editingPolicyId = null;
W.policyDraft = null;
W.ensurePolicyDraft();
W.policyDraft.company = "הכשרה";
W.policyDraft.type = "ריסק";
W._npSimLegalByInsured = { A: filled("בנק לאומי", "200000"), B: filled("בנק הפועלים", "300000") };
const payload = { ok:true, monthlyPremium: 100, sumInsured: "500000", insuranceStartDate:"01/01/2026" };
W.purchaseAllSimulatorInsureds([
  { insId:"A", company:"הכשרה", product:"ריסק", payload, legal: W._npSimLegalByInsured.A, label:"מבוטח א" },
  { insId:"B", company:"הכשרה", product:"ריסק", payload, legal: W._npSimLegalByInsured.B, label:"מבוטח ב" }
], { couple:true, coupleIds:["A","B"] });
const rowA = (W.newPolicies || []).find((p) => (p.insuredIds || [])[0] === "A");
const rowB = (W.newPolicies || []).find((p) => (p.insuredIds || [])[0] === "B");
assert(!!rowA && !!rowB, "multi-select writes two proposal rows");
assert(rowA.pledge === true && rowA.pledgeBanks[0].bankName === "בנק לאומי", "row A keeps Leumi");
assert(String(rowA.pledgeBanks[0].amount) === "200000", "row A keeps 200000");
assert(rowB.pledge === true && rowB.pledgeBanks[0].bankName === "בנק הפועלים", "row B keeps Poalim");
assert(String(rowB.pledgeBanks[0].amount) === "300000", "row B keeps 300000");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
