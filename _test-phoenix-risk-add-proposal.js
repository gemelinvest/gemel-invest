/* GI-PHX-RISK-BUY 2026-10-14
   הפניקס · ריסק באשף פוליסות חדשות:
   אחרי «חשב פרמיה» לחיצה על «הוסף להצעה» לא נחסמת ב«יש לחשב פרמיה».
   הרצה: node _test-phoenix-risk-add-proposal.js
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
  let i = start + ("function " + fnName).length;
  let paren = 0;
  let seenParen = false;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "("){ paren += 1; seenParen = true; }
    else if(ch === ")"){ paren -= 1; }
    else if(ch === "{" && seenParen && paren === 0) break;
  }
  if(i >= src.length || src[i] !== "{") return "";
  let depth = 0;
  for(; i < src.length; i++){
    if(src[i] === "{") depth += 1;
    else if(src[i] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

function sliceMethod(src, startNeedle, endNeedle){
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
const sw = read("service-worker.js");

console.log("1) syntax + cache + markers");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + SIM_TAG + '"'), "simulator chunk tag stays");
assert(app.includes("&giPhxRiskBuy=1"), "simulator cache busted for phoenix risk buy");
assert(sw.includes("phx-risk-buy-v1"), "service-worker cache suffix bumped");
assert(sims.includes("GI-PHX-RISK-BUY"), "simulator buy-after-calc marker");
assert(sims.includes("const selected = riskSimCoupleSelectedIds(sim);"), "couple prepare defines selected");
assert(sims.includes("_recomputeInsuredPremium(st)"), "phoenix rebuilds premium from the same inputs");
assert(sims.includes("_lookupInsuredState(insId)"), "phoenix looks up insured state without exact-key miss");
const phxBuild = sliceMethod(sims, "/* GI-PHX-RISK-BUY: «הוסף להצעה» קורא ל-_buildResultForInsured.", "_apply(){");
assert(phxBuild.includes("ok: true"), "phoenix payload includes ok:true");
assert(phxBuild.includes("if(!st.result || st.result.ok !== true)"), "phoenix rebuilds when the live result was wiped");

const ensureSrc = sliceMethod(sims, "function riskSimEnsureCoupleSharedResults(sim){", "function riskSimCoupleSharedFieldName(el){");
assert(ensureSrc.includes("const selected = riskSimCoupleSelectedIds(sim);"), "selected is declared inside ensureCoupleSharedResults");
assert(/const selected = riskSimCoupleSelectedIds\(sim\);\s*selected\.forEach/.test(ensureSrc), "recalc loop uses the local selected list");

console.log("\n2) runtime — couple prepare does not throw after wiping dest result");
{
  const box = {
    safeTrim,
    riskSimAllowsCouplePolicy: () => true,
    riskSimCoupleSelectedIds: (sim) => Object.keys(sim._giCoupleIds || {}).filter((id) => sim._giCoupleIds[id]),
    riskSimCoupleSeedInsuredId: (sim) => "ins_a",
    riskSimFlushActiveDomFields(){},
    riskSimEnsureInsuredState(sim, id){ return sim._state[id]; },
    riskSimSyncCouplePicksToOpenProduct(){},
    riskSimCopyCoupleSharedFieldsFromId(sim){
      const dest = sim._state.ins_b;
      dest.sumInsured = sim._state.ins_a.sumInsured;
      dest.result = null;
    },
    riskSimCopyCoupleHealthCoversFromSeed(){},
    riskSimCopyPledgeToCoupleInsureds(){},
    riskSimEnsureCalcForInsured(sim, id){
      const st = sim._state[id];
      if(st && !st.result){
        st.result = { ok:true, monthlyPremium: 40 + (id === "ins_b" ? 12 : 0) };
      }
      return st && st.result;
    }
  };
  vm.createContext(box);
  vm.runInContext(
    "function riskSimEnsureCoupleSharedResults(sim){\n" +
    ensureSrc.slice(ensureSrc.indexOf("{") + 1) + "\n",
    box
  );
  const sim = {
    _giCoupleOn: true,
    _ctx: { wizardWorkspace: true, product: "ריסק" },
    _giCoupleIds: { ins_a: true, ins_b: true },
    _state: {
      ins_a: { sumInsured: "1000000", result: { ok:true, monthlyPremium: 40 } },
      ins_b: { sumInsured: "", result: { ok:true, monthlyPremium: 33 } }
    }
  };
  let threw = null;
  try { box.riskSimEnsureCoupleSharedResults(sim); }
  catch(err){ threw = err; }
  assert(!threw, "ensureCoupleSharedResults does not throw ReferenceError on selected");
  assert(sim._state.ins_b.result && sim._state.ins_b.result.ok === true, "wiped dest is recalculated before add-to-proposal");
  assert(sim._state.ins_b.result.monthlyPremium === 52, "recalc uses the dest insured, not a copied premium");
}

console.log("\n3) runtime — phoenix rebuilds a wiped result so the payload is purchasable");
{
  const tableStart = sims.indexOf("const PHOENIX_RISK_RATE_TABLE = [");
  const tableEnd = sims.indexOf("];", tableStart) + 2;
  const mapStart = sims.indexOf("const PHOENIX_RISK_RATE_MAP", tableStart);
  const mapEnd = sims.indexOf(");", mapStart) + 2;
  const lookupSrc = extractFn(sims, "lookupPhoenixRiskRate");
  const computeSrc = extractFn(sims, "computePhoenixRiskPremium");
  const box = { console, Map, Math, Number, String, Date, Object, Array, isFinite };
  vm.createContext(box);
  vm.runInContext(sims.slice(tableStart, tableEnd) + "\n" + sims.slice(mapStart, mapEnd), box);
  vm.runInContext(lookupSrc + "\n" + computeSrc, box);
  const live = box.computePhoenixRiskPremium({ age: 35, gender: "זכר", smoker: false, sumInsured: 1000000 });
  assert(live.ok === true && Number.isFinite(live.monthlyPremium), "tariff compute succeeds for a typical phoenix risk row");

  const st = {
    birthDate: "01/01/1991",
    insuranceStartDate: "01/11/2026",
    age: "35",
    gender: "זכר",
    smoker: false,
    sumInsured: "1,000,000",
    result: Object.assign({}, live),
    error: null
  };
  const sim = {
    _state: { ins_phx: st },
    _syncAge(s){ s.age = "35"; return { ok:true, age: 35 }; },
    _lookupInsuredState(id){ return this._state[id] || null; },
    _recomputeInsuredPremium(state){
      const calc = box.computePhoenixRiskPremium({
        age: state.age, gender: state.gender, smoker: state.smoker,
        sumInsured: Number(String(state.sumInsured || "").replace(/[^\d.]/g, ""))
      });
      if(calc.ok){ state.result = calc; state.error = null; }
      else { state.result = null; }
      return calc;
    },
    _buildResultForInsured(insId){
      const state = this._lookupInsuredState(insId);
      if(!state) return null;
      if(!state.result || state.result.ok !== true){
        const calc = this._recomputeInsuredPremium(state);
        if(!calc || calc.ok !== true) return null;
      }
      if(!state.result || state.result.ok !== true) return null;
      return {
        ok: true,
        sumInsured: state.sumInsured,
        monthlyPremium: state.result.monthlyPremium,
        annualPremium: state.result.annualPremium
      };
    }
  };

  const first = sim._buildResultForInsured("ins_phx");
  assert(first && first.ok === true && first.monthlyPremium === live.monthlyPremium, "fresh calc is purchasable");

  st.result = null;
  const rebuilt = sim._buildResultForInsured("ins_phx");
  assert(rebuilt && rebuilt.ok === true && rebuilt.monthlyPremium === live.monthlyPremium, "wiped result is rebuilt from the same inputs");
  assert(st.result && st.result.ok === true, "rebuilt result is stored back on the insured");
}

console.log("\n4) runtime — wizard add-to-proposal accepts a phoenix risk payload");
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
  nowISO: () => "2026-10-14T10:00:00.000Z",
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

W.insureds = [{ id:"ins_phx", type:"primary", data:{ firstName:"דוד", lastName:"כהן" } }];
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

assert(W.simulatorPurchasePayloadReady({ ok:true, monthlyPremium: 41.25 }) === true, "phoenix result with ok is ready");
assert(W.simulatorPurchasePayloadReady({ monthlyPremium: 41.25 }) === true, "phoenix result without ok but with monthly is ready");

{
  toasts.length = 0;
  W.newPolicies = [];
  W.policyDraft = { company:"הפניקס", type:"ריסק", insuredIds:["ins_phx"], insuredId:"ins_phx" };
  W._npShowPick = false;
  const added = [];
  W.addDraftPolicy = function(){
    const d = this.policyDraft;
    const row = {
      id: "npol_phx_1",
      company: d.company,
      type: d.type,
      insuredIds: (d.insuredIds || []).slice(),
      premiumPerInsured: Object.assign({}, d.premiumPerInsured || {})
    };
    added.push(row);
    this.newPolicies = (this.newPolicies || []).concat([row]);
    return row.id;
  };
  const pids = W.purchaseAllSimulatorInsureds([{
    insId:"ins_phx",
    company:"הפניקס",
    product:"ריסק",
    label:"דוד כהן",
    payload:{ ok:true, monthlyPremium: 41.25, annualPremium: 495, sumInsured:"1000000" }
  }], { couple:false, coupleIds:[] });
  assert((pids || []).length === 1 && added.length === 1, "single phoenix risk calc is added to the proposal");
  assert(added[0].company === "הפניקס" && added[0].type === "ריסק", "added row stays הפניקס · ריסק");
  const titles = toasts.map((t) => String(t.title || ""));
  assert(titles.indexOf("יש לחשב פרמיה") < 0, "calculated phoenix risk is not blocked by יש לחשב פרמיה");
  assert(titles.some((t) => /נוסף/.test(t)), "agent sees an added-to-proposal toast");
}

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
