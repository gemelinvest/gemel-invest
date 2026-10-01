/* GI-WIZ-PLEDGE-CONFIRM 2026-09-27
   לחצן אישור בשיעבוד (לא אשר). אם מולאו פרטי שיעבוד בלי אישור,
   «הוסף להצעה» נחסם והודעה במרכז המסך.
   הרצה: node _test-wizard-pledge-confirm-notice.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261001-health-form-wide-v1";
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
const shellCss = read("simulators-shell.css");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=20261001-health-form-wide-v1"'), "simulator cache");
assert(app.includes("simulators-shell.css?v=20260927-legal-text-v1"), "shell css cache");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "wizard version");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard build");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");

console.log("\n2) source — label + purchase gate");
assert(sims.includes('data-gishell-legal-confirm="1">אישור</button>'), "confirm button label is אישור");
assert(!sims.includes('data-gishell-legal-confirm="1">אשר</button>'), "old אשר label removed from pledge confirm");
assert(sims.includes("GI-WIZ-PLEDGE-CONFIRM"), "pledge-confirm marker");
assert(sims.includes("function riskSimLegalNeedsPledgeConfirm(legal)"), "needs-confirm helper");
assert(sims.includes("function riskSimShowPledgeConfirmNotice(sim)"), "centered notice helper");
assert(sims.includes("יש ללחוץ על לחצן האישור בשיעבוד"), "notice copy matches the requested text");
assert(sims.includes("giSimShell__centerNotice"), "notice uses a centered overlay class");
assert(shellCss.includes(".giSimShell__centerNotice{"), "overlay is centered in shell css");
assert(shellCss.includes("position:fixed"), "overlay covers the viewport");
assert(shellCss.includes("align-items:center"), "overlay is vertically centered");
assert(shellCss.includes("justify-content:center"), "overlay is horizontally centered");
const purchaseFn = sliceFn(sims, "function riskSimPurchaseWizardInsureds(sim){", "function riskSimPurchaseActiveInsured(sim){");
assert(purchaseFn.includes("if(riskSimBlockPurchaseIfPledgeUnconfirmed(sim)) return;"), "הוסף להצעה stops when pledge is unconfirmed");
assert(purchaseFn.indexOf("riskSimBlockPurchaseIfPledgeUnconfirmed") < purchaseFn.indexOf("onPurchaseAllInsureds"), "block runs before adding to the proposal");
assert(purchaseFn.includes("GI-WIZ-PLEDGE-PER-INSURED"), "per-insured copy rule kept");
assert(!purchaseFn.includes("riskSimCopyPledgeToCoupleInsureds"), "purchase still does not unify pledges");

console.log("\n3) runtime — unconfirmed pledge is detected; confirmed is not");
const src = sliceFn(sims, "function riskSimLegalHasOwnPledge(legal){", "function riskSimEmptyBeneficiary(){");
assert(src.includes("function riskSimCollectUnconfirmedPledgeId(sim){"), "collect helper extracted");
const box = {
  safeTrim,
  on(){},
  document: {
    querySelector(){ return null; },
    body: { appendChild(){} },
    createElement(){
      return { className:"", setAttribute(){}, innerHTML:"", querySelector(){ return null; }, addEventListener(){}, remove(){} };
    }
  },
  riskSimCoupleSelectedIds(sim){
    const map = sim && sim._giCoupleIds && typeof sim._giCoupleIds === "object" ? sim._giCoupleIds : {};
    return Object.keys(map).filter((id) => !!map[id]);
  },
  riskSimGetLegal(sim, insId){
    const map = sim && sim._ctx && sim._ctx.wizardLegalByInsured || {};
    return map[insId] || { pledge:false, pledgeConfirmed:false, pledgeBanks:[] };
  }
};
vm.createContext(box);
vm.runInContext(src, box);

assert(box.riskSimLegalNeedsPledgeConfirm({ pledge:true, pledgeConfirmed:false }) === true, "open pledge form needs confirm");
assert(box.riskSimLegalNeedsPledgeConfirm({ pledge:true, pledgeConfirmed:true }) === false, "confirmed pledge does not need confirm");
assert(box.riskSimLegalNeedsPledgeConfirm({ pledge:false, pledgeConfirmed:false }) === false, "no pledge does not need confirm");
assert(box.riskSimLegalNeedsPledgeConfirm(null) === false, "missing legal does not need confirm");

const empty = { pledge:false, pledgeConfirmed:false, pledgeBanks:[{ bankName:"", amount:"", years:"" }] };
const filledOpen = {
  pledge:true, pledgeConfirmed:false,
  pledgeBanks:[{ bankName:"בנק לאומי", bankNo:"10", branch:"1", amount:"200000", years:"20", address:"רחוב 1" }]
};
const filledOk = Object.assign({}, filledOpen, { pledgeConfirmed:true });

assert(box.riskSimCollectUnconfirmedPledgeId({
  _activeInsuredId: "A",
  _ctx: { insureds:[{ id:"A" }, { id:"B" }], wizardLegalByInsured:{ A: filledOk, B: empty } }
}) === "", "confirmed A does not block");

assert(box.riskSimCollectUnconfirmedPledgeId({
  _activeInsuredId: "A",
  _ctx: { insureds:[{ id:"A" }, { id:"B" }], wizardLegalByInsured:{ A: filledOpen, B: empty } }
}) === "A", "unconfirmed filled A is the blocking id");

assert(box.riskSimCollectUnconfirmedPledgeId({
  _activeInsuredId: "B",
  _ctx: { insureds:[{ id:"A" }, { id:"B" }], wizardLegalByInsured:{ A: filledOpen, B: empty } }
}) === "A", "unconfirmed A is found even when B is active");

const notices = [];
const origShow = box.riskSimShowPledgeConfirmNotice;
box.riskSimShowPledgeConfirmNotice = function(sim){ notices.push(sim && sim._activeInsuredId); };
assert(box.riskSimBlockPurchaseIfPledgeUnconfirmed({
  _activeInsuredId: "A",
  _ctx: { insureds:[{ id:"A" }], wizardLegalByInsured:{ A: filledOpen } },
  _render(){}
}) === true, "purchase block returns true when unconfirmed");
assert(notices[0] === "A", "centered notice is shown for the unconfirmed insured");
assert(box.riskSimBlockPurchaseIfPledgeUnconfirmed({
  _activeInsuredId: "A",
  _ctx: { insureds:[{ id:"A" }], wizardLegalByInsured:{ A: filledOk } },
  _render(){}
}) === false, "purchase block returns false when confirmed");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
void origShow;
