/* GI-FIX 2026-09-22 — שכר באובדן כושר עבודה נשמר בהוספה להצעה ובעריכה.
   Run: node _test-akov-salary-persist.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260922-login-mfa-qr-btn-v1";
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

function safeTrim(v){ return String(v == null ? "" : v).trim(); }

const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

console.log("1) syntax + source");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard cache tag");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app wizard version");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(wiz.includes("akovSalary: safeTrim(d.akovSalary)"), "addDraftPolicy copies akovSalary");
assert(wiz.includes("akovSalary: safeTrim(p.akovSalary)"), "startEditNewPolicy restores akovSalary");
assert(wiz.includes("akovExt_cancelOffset: !!d.akovExt_cancelOffset"), "addDraftPolicy copies AKE extensions");
assert(wiz.includes("akovSalary: \"\""), "ensurePolicyDraft has empty akovSalary");

console.log("\n2) runtime — add to proposal keeps salary, Next does not demand it again");
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
  nowISO: () => "2026-09-22T10:00:00.000Z"
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
    classList: { add(){}, remove(){}, contains(){ return false; } },
    appendChild(child){ this.children.push(child); return child; },
    querySelector(){ return null; }, querySelectorAll(){ return []; }
  };
}
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
    body: makeNode("body")
  },
  console,
  Auth: { current: { name: "נציג בדיקה" } }
};
sandbox.globalThis = sandbox;
vm.runInNewContext(wiz, sandbox, { filename: "gi-wizard.js" });
const W = host.Wizard;
assert(typeof W.addDraftPolicy === "function", "Wizard.addDraftPolicy loaded");
assert(typeof W.startEditNewPolicy === "function", "Wizard.startEditNewPolicy loaded");

W.insureds = [{ id:"i1", type:"primary", label:"מבוטח ראשי", data:{ firstName:"דוד", lastName:"כהן" } }];
W.render = () => {};
W.isOpen = true;
W.step = 5;
W.isCustomerPurchaseMode = () => false;
W.isElementaryFlow = () => false;
W.closeNpOpenSimulator = function(){};
W.resetNpSimAutoOpenKey = function(){
  this._npSimAutoOpenedKey = "";
  this._npSimPickByInsured = {};
};
W.resetPremiumSanityState = function(){};
W.sumHealthNewPolicyPremiums = () => 0;
W.applyAllProposalInsuredsToDraft = function(){};

W.newPolicies = [];
W.policyDraft = null;
W.editingPolicyId = null;
W.ensurePolicyDraft();
Object.assign(W.policyDraft, {
  company: "הפניקס",
  type: "אובדן כושר עבודה",
  insuredIds: ["i1"],
  insuredId: "i1",
  insuredMode: "single",
  startDate: "2026-10-01",
  premiumMonthly: "120",
  premiumPerInsured: { i1: "120" },
  akovSalary: "15,000",
  akovExt_cancelOffset: true,
  akovExt_specificOccupation: true
});

const addedId = W.addDraftPolicy({ skipRender: true });
const added = (W.newPolicies || []).find((p) => String(p.id) === String(addedId)) || W.newPolicies[0];
assert(!!added, "policy was added to the proposal list");
assert(safeTrim(added.akovSalary) === "15,000", "added policy keeps the salary the agent typed");
assert(added.akovExt_cancelOffset === true, "cancel-offset extension is copied");
assert(added.akovExt_specificOccupation === true, "specific-occupation extension is copied");

const nextIssues = W.collectNewPolicyValidationIssues(added, { policyIndex: 0, policyId: added.id })
  .map((row) => row.message);
assert(!nextIssues.some((msg) => String(msg).includes("שכר")), "Next does not demand salary after it was added");

W.startEditNewPolicy(added.id);
assert(safeTrim(W.policyDraft?.akovSalary) === "15,000", "editing the policy restores the salary field");
assert(W.policyDraft?.akovExt_cancelOffset === true, "editing restores cancel-offset");
assert(W.policyDraft?.type === "אובדן כושר עבודה", "editing keeps AKE product type");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + " / passed " + passed);
process.exit(failed ? 1 : 0);
