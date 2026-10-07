/* GI-NP-HEALTH-MULTI-BUY 2026-10-07
   אשף בריאות וסיכונים · פוליסות חדשות:
   בחירה מרובה עם פרמיה שמוצגת על המסך לא נחסמת ב«יש לחשב פרמיה»,
   והטוסט מציג שמות מבוטחים במקום ins_xxxx.
   הרצה: node _test-wizard-np-health-multibuy.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const SIM_TAG = "20261007-np-health-buy-v1";
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

function extractFn(src, fnName){
  const start = src.indexOf("function " + fnName + "(");
  if(start < 0) return "";
  let i = start;
  let depth = 0;
  let seen = false;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{"){ depth += 1; seen = true; }
    else if(ch === "}"){
      depth -= 1;
      if(seen && depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

function safeTrim(v){ return String(v == null ? "" : v).trim(); }

const wiz = read("gi-wizard.js");
const sims = read("gi-simulators.js");
const app = read("app.js");
const sw = read("service-worker.js");

console.log("1) syntax + cache + markers");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + SIM_TAG + '"'), "simulator chunk cache bumped");
assert(sw.includes("np-buy-v1"), "service-worker cache suffix bumped");
assert(wiz.includes("GI-NP-HEALTH-MULTI-BUY"), "wizard multi-buy marker");
assert(sims.includes("GI-NP-HEALTH-MULTI-BUY"), "simulator multi-buy marker");
assert(wiz.includes("simulatorInsuredDisplayName(insId, fallback)"), "display-name helper");
assert(wiz.includes("simulatorPurchasePayloadReady(payload)"), "payload-ready helper");
assert(wiz.includes("if(!buyList.length){"), "multi-select no longer requires two calculated payloads");
assert(!/if\(buyList\.length < 2\)\{\s*const labels = missing\.map/.test(wiz), "old block-all-when-one-ready gate removed");
assert(sims.includes("riskSimCopyCoupleHealthCoversFromSeed(sim, shareSrc, { emptyOnly: true })"), "purchase copies health covers onto empty selected insureds");
assert(sims.includes("function riskSimResultLooksPurchasable(result)"), "purchasable helper");
assert(sims.includes("function riskSimStateForInsured(sim, insId)"), "state lookup helper");

console.log("\n2) collect keeps a displayed premium if rebuild returns null");
const collectSrc = extractFn(sims, "riskSimCollectResultForInsured");
const usableSrc = extractFn(sims, "riskSimResultLooksPurchasable");
const stateSrc = extractFn(sims, "riskSimStateForInsured");
assert(!!collectSrc && !!usableSrc && !!stateSrc, "extracted collect helpers");
const collectBox = { console, Object, Array, Number, String, Math };
vm.createContext(collectBox);
vm.runInContext(
  "function safeTrim(v){ return String(v == null ? \"\" : v).trim(); }\n" +
  stateSrc + "\n" + usableSrc + "\n" + collectSrc,
  collectBox
);

{
  const sim = {
    _state: {
      "ins_4283cfdba25a": {
        result: { monthlyPremium: 125.25, annualPremium: 1503, covers: [{ id: "drugs", monthlyPremium: 19.97 }] },
        birthDate: "01/01/1990",
        insuranceStartDate: "01/10/2026"
      }
    },
    _buildResultForInsured(){ return null; }
  };
  const got = collectBox.riskSimCollectResultForInsured(sim, "ins_4283cfdba25a");
  assert(got && got.ok === true && got.monthlyPremium === 125.25, "displayed health premium without result.ok is purchasable");
}

{
  const wiped = { monthlyPremium: 100.2, annualPremium: 1202.4, covers: [{ id: "amb" }], ok: true };
  const sim = {
    _state: { a: { result: Object.assign({}, wiped) } },
    _buildResultForInsured(){
      this._state.a.result = null;
      return null;
    }
  };
  const got = collectBox.riskSimCollectResultForInsured(sim, "a");
  assert(got && got.ok === true && got.monthlyPremium === 100.2, "snapshot survives a rebuild that clears state.result");
  assert(sim._state.a.result && sim._state.a.result.monthlyPremium === 100.2, "wiped live result is restored from snapshot");
}

console.log("\n3) runtime — names in toast, add the ready insured in a family of 3");
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

const toasts = [];
const host = new Proxy({
  Wizard: {},
  safeTrim,
  parseAnyDmyDate,
  parseBirthDateValue(value){
    const p = parseAnyDmyDate(value);
    if(!p) return null;
    if(p.date > new Date()) return null;
    return p;
  },
  formatDmyFromParts(y, m, d){
    return String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0") + "/" + String(y).padStart(4, "0");
  },
  escapeHtml: (s) => String(s == null ? "" : s),
  on(){}, $(){ return null; }, $$(){ return []; },
  nowISO: () => "2026-10-07T10:00:00.000Z",
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
    showToast(t){ toasts.push(t || {}); }
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

W.insureds = [
  { id:"ins_4283cfdba25a", type:"primary", data:{ firstName:"דוד", lastName:"כהן" } },
  { id:"ins_8121c92c41cea", type:"spouse", data:{ firstName:"יעל", lastName:"כהן" } },
  { id:"ins_5c7b4203328188", type:"child", data:{ firstName:"נועה", lastName:"כהן" } }
];
W.render = () => {};
W.isOpen = true;
W.step = 5;
W.isCustomerPurchaseMode = () => false;
W.closeNpOpenSimulator = function(){};
W.resetNpSimAutoOpenKey = function(){ this._npSimPickByInsured = {}; };
W.resetPremiumSanityState = function(){};
W.emptyPledgeBank = function(){ return { bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" }; };
W.normalizePledgeBanks = function(){ return []; };
W.isMedicareCompany = function(){ return false; };

assert(W.simulatorInsuredDisplayName("ins_4283cfdba25a") === "דוד כהן", "display name uses first+last when label is empty");
assert(W.simulatorInsuredDisplayName("ins_8121c92c41cea") === "יעל כהן", "spouse display name");
assert(W.simulatorInsuredDisplayName("ins_5c7b4203328188") === "נועה כהן", "child display name");
assert(W.simulatorInsuredDisplayName("ins_unknown") === "מבוטח", "bare ins_ id is not shown in the toast");

{
  toasts.length = 0;
  W.newPolicies = [];
  W.policyDraft = null;
  W.ensurePolicyDraft();
  W.policyDraft.company = "הפניקס";
  W.policyDraft.type = "בריאות";
  const none = W.purchaseAllSimulatorInsureds([
    { insId:"ins_4283cfdba25a", company:"הפניקס", product:"בריאות", payload:null, label:"" },
    { insId:"ins_8121c92c41cea", company:"הפניקס", product:"בריאות", payload:null, label:"" },
    { insId:"ins_5c7b4203328188", company:"הפניקס", product:"בריאות", payload:null, label:"" }
  ], { couple:true, coupleIds:["ins_4283cfdba25a","ins_8121c92c41cea","ins_5c7b4203328188"] });
  assert((none || []).length === 0 && (W.newPolicies || []).length === 0, "family with no payloads still does not write");
  const toast = toasts[toasts.length - 1] || {};
  assert(toast.title === "יש לחשב פרמיה", "blocked toast title stays יש לחשב פרמיה");
  const text = String(toast.text || "");
  assert(text.indexOf("דוד כהן") >= 0 && text.indexOf("יעל כהן") >= 0 && text.indexOf("נועה כהן") >= 0, "blocked toast lists people names");
  assert(text.indexOf("ins_") < 0, "blocked toast does not leak raw ins_ ids");
}

{
  toasts.length = 0;
  const added = [];
  W.newPolicies = [];
  W.policyDraft = { company:"הפניקס", type:"בריאות", insuredIds:["ins_4283cfdba25a"], insuredId:"ins_4283cfdba25a" };
  W._npShowPick = false;
  W.addDraftPolicy = function(opts){
    const d = this.policyDraft;
    const row = {
      id: "npol_h_" + (added.length + 1),
      company: d.company,
      type: d.type,
      insuredIds: (d.insuredIds || []).slice(),
      premiumPerInsured: Object.assign({}, d.premiumPerInsured || {})
    };
    added.push(row);
    this.newPolicies = (this.newPolicies || []).concat([row]);
    return row.id;
  };
  const pids = W.purchaseAllSimulatorInsureds([
    {
      insId:"ins_4283cfdba25a", company:"הפניקס", product:"בריאות", label:"",
      payload:{ ok:true, monthlyPremium:125.25, annualPremium:1503, covers:[{ id:"drugs", wizardKey:"תרופות מחוץ לסל" }] }
    },
    { insId:"ins_8121c92c41cea", company:"הפניקס", product:"בריאות", payload:null, label:"" },
    { insId:"ins_5c7b4203328188", company:"הפניקס", product:"בריאות", payload:null, label:"" }
  ], { couple:true, coupleIds:["ins_4283cfdba25a","ins_8121c92c41cea","ins_5c7b4203328188"] });
  assert(added.length === 1, "family of 3 with one calculated premium writes that one row");
  assert((pids || []).length === 1, "returns the ready policy id");
  assert((added[0].insuredIds || [])[0] === "ins_4283cfdba25a", "ready row belongs to the primary");
  const okToast = toasts.find((t) => t && /נוסף/.test(String(t.title || "")));
  assert(!!okToast, "ready insured is added instead of blocking the whole family");
  const skipText = toasts.map((t) => String(t.text || "")).join(" | ");
  assert(skipText.indexOf("יעל כהן") >= 0 && skipText.indexOf("נועה כהן") >= 0, "skipped names are the uncalculated family members");
  assert((skipText.match(/יעל כהן/g) || []).length === 1 && (skipText.match(/נועה כהן/g) || []).length === 1, "skipped names are listed once");
  assert(skipText.indexOf("ins_") < 0, "success/skip text has no raw ins_ ids");
}

{
  assert(W.simulatorPurchasePayloadReady({ monthlyPremium: 100.2, covers: [{ id:"x" }] }) === true, "health result without ok is ready");
  assert(W.simulatorPurchasePayloadReady({ ok:false, monthlyPremium: 10 }) === false, "explicit ok:false is not ready");
  assert(W.simulatorPurchasePayloadReady(null) === false, "null payload is not ready");
}

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
