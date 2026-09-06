/* GI-CLAL-HEALTH-DECL 2026-08-30
   Fix recurrence of health-declaration advance block + follow-ups for Clal
   (health + risk). Same class of bug as Hachshara Thursday fix, plus:
   - official Clal letter questionnaires on Yes
   - no Magdala questionnaires when cart is Clal-only
   - aliases must not cross-read Magdala into Clal keys
   - height/weight only for relevant insureds
   Run: node _test-clal-health-decl-advance.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260906-proposal-assign-live-v2";
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
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "gi-wizard.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build mark");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app wizard version");
assert(html.includes("app.js?v=" + TAG), "index app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");

console.log("\n2) Clal health opens official letter questionnaires");
const clalStart = wiz.indexOf("getClalHealthSchema(){");
const clalEnd = wiz.indexOf("getPhoenixHealthSchema(){", clalStart);
const clalBody = clalStart > 0 && clalEnd > clalStart ? wiz.slice(clalStart, clalEnd) : "";
assert(clalBody.includes("buildClalFollowupFields"), "Clal health uses buildClalFollowupFields");
assert(clalBody.includes("questionnaireNos: letterList"), "Clal health sets questionnaireNos");
assert(clalBody.includes("GI-FIX 2026-08-30"), "Clal health follow-up fix marker");
assert(!/fields:\s*letter\s*\?\s*detailsFields/.test(clalBody), "Clal health no longer uses generic detailsFields for letter questions");

const riskStart = wiz.indexOf("getClalRiskHealthSchema(){");
const riskEnd = wiz.indexOf("getClalHealthSchema(){", riskStart);
const riskBody = riskStart > 0 && riskEnd > riskStart ? wiz.slice(riskStart, riskEnd) : "";
assert(riskBody.includes("questionnaireNos: letterList"), "Clal risk sets questionnaireNos");

console.log("\n3) single-company Clal does not prefer Magdala");
const filterStart = wiz.indexOf("getHealthQuestionsFiltered(){");
const filterEnd = wiz.indexOf("getHealthQuestionList(){");
const filterFn = filterStart > 0 && filterEnd > filterStart ? wiz.slice(filterStart, filterEnd) : "";
assert(filterFn.includes("healthCompanies.length === 1"), "single-company preference exists");
assert(filterFn.includes("לא להעדיף מגדל"), "single-company Magdala skip marker");
assert(filterFn.includes("אין למזג הצהרות מחברות שונות"), "purchase mode no longer merges foreign schemas");

console.log("\n4) alias cross-company isolation");
assert(wiz.includes("אל תערבב תשובות בין חברות"), "alias company-scope marker");
const aliasFn = (() => {
  const i = wiz.indexOf("resolveHealthResponseAliasKeys(qKey){");
  const j = wiz.indexOf("getHealthResponse(qKey, insId){", i);
  return i > 0 && j > i ? wiz.slice(i, j) : "";
})();
assert(aliasFn.includes("familyOf"), "alias family helper exists");
assert(aliasFn.includes("magdal_"), "alias filter knows Magdala prefix");

console.log("\n5) height/weight uses relevant insureds");
const bmiBlock = (() => {
  const i = wiz.indexOf("getHealthHeightWeightBlockingIssue(){");
  const j = wiz.indexOf("renderHealthHeightWeightSection(){", i);
  return i > 0 && j > i ? wiz.slice(i, j) : "";
})();
assert(bmiBlock.includes("getHealthStepRelevantInsureds"), "BMI gate uses shared insured helper");
assert(bmiBlock.includes("GI-FIX 2026-08-30"), "BMI relevant-insureds fix marker");
const bmiRender = (() => {
  const i = wiz.indexOf("renderHealthHeightWeightSection(){");
  const j = wiz.indexOf("renderStep2(ins){", i);
  return i > 0 && j > i ? wiz.slice(i, j) : "";
})();
assert(bmiRender.includes("getHealthStepRelevantInsureds"), "BMI UI uses shared insured helper");

console.log("\n6) mirror meta passes questionnaireLetter + Clal followup builders");
assert(app.includes("questionnaireLetter: safeTrim(q.questionnaireLetter)"), "mirror meta copies questionnaireLetter");
assert(app.includes("getClalFollowupSchemas: Wizard.getClalFollowupSchemas"), "mirror ctx has Clal followup schemas");
assert(app.includes("buildClalFollowupFields: Wizard.buildClalFollowupFields"), "mirror ctx has Clal followup builder");

console.log("\n7) behavioural harness — aliases + insureds + schema pick");
function familyOf(k){
  const t = safeTrim(k);
  if(!t) return "";
  if(t.startsWith("clal_") || t.startsWith("critical__") || t.startsWith("cancer__")) return "clal";
  if(t.startsWith("magdal_")) return "migdal";
  if(t.startsWith("menora_")) return "menora";
  if(t.startsWith("ayalon_")) return "ayalon";
  if(t.startsWith("phoenix_") || t.startsWith("cancer_short_")) return "phoenix";
  if(t.startsWith("hachshara_")) return "hachshara";
  if(t.startsWith("short__") || t.startsWith("extended__") || t.startsWith("full__")) return "legacy";
  return "";
}

function resolveHealthResponseAliasKeys(qKey, aliases){
  const key = safeTrim(qKey);
  if(!key) return [];
  const out = [key];
  const seen = new Set([key]);
  const add = (k) => {
    const t = safeTrim(k);
    if(!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  if(Array.isArray(aliases[key])) aliases[key].forEach(add);
  Object.entries(aliases).forEach(([legacy, canons]) => {
    const list = Array.isArray(canons) ? canons : [canons];
    if(list.includes(key)){
      add(legacy);
      list.forEach(add);
    }
  });
  const family = familyOf(key);
  if(family && family !== "legacy"){
    return out.filter((k) => {
      const f = familyOf(k);
      return !f || f === family || f === "legacy";
    });
  }
  return out;
}

const HEALTH_QKEY_ALIASES = {
  short__smoking: ["clal_smoking", "menora__smoking", "ayalon__smoking", "phoenix_full__smoking", "magdal_full__smoking_now"],
  short__heart: ["clal_heart_blood_vessels", "menora__heart", "ayalon__heart", "phoenix_full__heart", "magdal_full__heart"]
};
const clalSmokeAliases = resolveHealthResponseAliasKeys("clal_smoking", HEALTH_QKEY_ALIASES);
assert(clalSmokeAliases.includes("clal_smoking"), "clal smoking keeps self");
assert(clalSmokeAliases.includes("short__smoking"), "clal smoking keeps legacy bridge");
assert(!clalSmokeAliases.includes("magdal_full__smoking_now"), "clal smoking does NOT dual-read Magdala");
assert(!clalSmokeAliases.includes("menora__smoking"), "clal smoking does NOT dual-read Menora");

const magdalSmokeAliases = resolveHealthResponseAliasKeys("magdal_full__smoking_now", HEALTH_QKEY_ALIASES);
assert(magdalSmokeAliases.includes("magdal_full__smoking_now"), "magdala smoking keeps self");
assert(!magdalSmokeAliases.includes("clal_smoking"), "magdala smoking does NOT dual-read Clal");

function getHealthStepRelevantInsureds(ctx){
  const policies = ctx.newPolicies || [];
  const wizardInsureds = ctx.insureds || [];
  const primary = wizardInsureds.find((x) => x?.type === "primary") || wizardInsureds[0] || null;
  const spouse = wizardInsureds.find((x) => x?.type === "spouse") || null;
  const idSet = new Set();
  policies.forEach((policy) => {
    const mode = safeTrim(policy?.insuredMode);
    if(mode === "couple"){
      if(primary?.id != null && safeTrim(primary.id)) idSet.add(String(primary.id));
      if(spouse?.id != null && safeTrim(spouse.id)) idSet.add(String(spouse.id));
    }
    const ids = Array.isArray(policy?.insuredIds) && policy.insuredIds.length
      ? policy.insuredIds
      : (policy?.insuredId ? [policy.insuredId] : []);
    ids.forEach((id) => { if(id != null && safeTrim(id)) idSet.add(String(id)); });
  });
  const matched = wizardInsureds.filter((ins) => idSet.has(String(ins?.id)));
  return matched.length ? matched : wizardInsureds.slice();
}

const clalCouple = {
  insureds: [
    { id: "p1", type: "primary", label: "ראשי", data: { heightCm: 170, weightKg: 70 } },
    { id: "s1", type: "spouse", label: "בן/בת זוג", data: { heightCm: 165, weightKg: 60 } },
    { id: "c1", type: "child", label: "ילד", data: {} }
  ],
  newPolicies: [
    { id: "pol1", company: "כלל", type: "בריאות", insuredId: "p1", insuredIds: ["p1"], insuredMode: "couple" }
  ]
};
const relevant = getHealthStepRelevantInsureds(clalCouple).map((i) => i.id);
assert(relevant.includes("p1") && relevant.includes("s1"), "Clal couple keeps primary+spouse");
assert(!relevant.includes("c1"), "Clal couple excludes child from health step");

function pickHealthCompany(companies){
  if(companies.length === 1) return companies[0];
  if(companies.includes("מגדל")) return "מגדל";
  return companies[0];
}
assert(pickHealthCompany(["כלל"]) === "כלל", "Clal-only cart picks Clal");
assert(pickHealthCompany(["כלל", "מגדל"]) === "מגדל", "multi-company still prefers Magdala");

console.log("\n8) runtime VM — real Wizard methods prove the three bugs are fixed");
const vm = require("vm");
const host = new Proxy({
  Wizard: {},
  safeTrim,
  escapeHtml: (s) => String(s == null ? "" : s),
  on(){}, $(){ return null; }, $$(){ return []; },
  nowISO: () => "2026-08-30T08:00:00.000Z"
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
    createElement(){ return { style:{}, setAttribute(){}, appendChild(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; },
    body: { appendChild(){}, classList:{ add(){}, remove(){} } }
  },
  console
};
sandbox.globalThis = sandbox;
try {
  vm.runInNewContext(wiz, sandbox, { filename: "gi-wizard.js" });
  assert(typeof host.Wizard.getClalHealthSchema === "function", "Wizard chunk loaded into VM");
} catch(err){
  assert(false, "load gi-wizard.js in VM: " + (err && err.message));
}

const W = host.Wizard;
function wireWizard(policies, insureds){
  W.insureds = insureds;
  W.newPolicies = policies;
  W.step = 7;
  W._healthDerivedCache = null;
  W.customerPurchaseMode = null;
  W.isCustomerPurchaseMode = function(){ return false; };
  W.getWizardNewPolicies = function(){ return this.newPolicies || []; };
  W.getPoliciesForWizardValidation = function(){ return this.newPolicies || []; };
  W.wizardRequiresHealthDeclarationStep = function(){ return true; };
  W.getInsuredDisplayName = function(ins){ return ins.label || "מבוטח"; };
  W.getPolicyInsuredIds = function(p){
    return Array.isArray(p?.insuredIds) && p.insuredIds.length
      ? p.insuredIds
      : (p?.insuredId ? [p.insuredId] : []);
  };
}

const primary = {
  id: "p1", type: "primary", label: "ראשי",
  data: { heightCm: 175, weightKg: 80, healthDeclaration: { responses: {}, ui: { currentIndex: 0, summary: false } } }
};
const child = { id: "c1", type: "child", label: "ילד", data: {} };

wireWizard(
  [{ id: "pol_h", company: "כלל", type: "בריאות", insuredId: "p1", insuredIds: ["p1"], insuredMode: "single" }],
  [primary, child]
);
const healthKeys = [];
(W.getHealthQuestionsFiltered() || []).forEach((cat) => (cat.questions || []).forEach((q) => healthKeys.push(q.key)));
assert(healthKeys.length === 29, "runtime Clal health has 29 questions (got " + healthKeys.length + ")");
assert(healthKeys.every((k) => String(k).startsWith("clal_")), "runtime Clal-only health has no foreign keys");
assert(!healthKeys.some((k) => String(k).startsWith("magdal_")), "runtime Clal-only health has zero Magdala keys");

const heart = (W.getClalHealthSchema() || []).flatMap((c) => c.questions || [])
  .find((q) => q.key === "clal_heart_blood_vessels");
assert(!!heart, "runtime Clal heart question exists");
assert((heart.fields || []).some((f) => String(f.key || "").startsWith("clal_ז_")), "runtime Yes opens Clal letter-ז fields");
assert(String(heart.questionnaireSource || "").includes("כלל"), "runtime heart follow-up branded כלל");
assert(!(heart.fields || []).some((f) => /^q\d+_/.test(String(f.key || ""))), "runtime heart fields are not Magdala qN_*");

const healthList = W.getHealthQuestionList();
const healthStore = W.getHealthStore();
healthStore.responses = {};
healthList.forEach((item) => {
  healthStore.responses[item.question.key] = {
    p1: { answer: "no", fields: {}, saved: false, editing: false }
  };
});
assert(W.getHealthStepRelevantInsureds().map((i) => i.id).join(",") === "p1", "runtime health step excludes child");
assert(W.getHealthBlockingIssue().ok === true, "runtime health advance OK after all answers");
assert(W.getHealthHeightWeightBlockingIssue().ok === true, "runtime BMI ignores unanswered child");

const clalAliases = W.resolveHealthResponseAliasKeys("clal_smoking");
assert(!clalAliases.includes("magdal_full__smoking_now"), "runtime alias does not dual-read Magdala");

wireWizard(
  [{ id: "pol_r", company: "כלל", type: "ריסק", insuredId: "p1", insuredIds: ["p1"], insuredMode: "single" }],
  [{ ...primary, data: { ...primary.data, healthDeclaration: { responses: {}, ui: { currentIndex: 0, summary: false } } } }]
);
const riskKeys = [];
(W.getHealthQuestionsFiltered() || []).forEach((cat) => (cat.questions || []).forEach((q) => riskKeys.push(q.key)));
assert(riskKeys.length > 0 && riskKeys.every((k) => String(k).startsWith("clal_")), "runtime Clal risk-only has only clal_* keys");
assert(!riskKeys.some((k) => String(k).startsWith("magdal_")), "runtime Clal risk-only has zero Magdala keys");
const riskHeart = W.getHealthQuestionList().find((x) => x.question.key === "clal_risk_heart");
assert(!!riskHeart, "runtime Clal risk heart question exists");
assert(String(riskHeart.question.questionnaireSource || "").includes("כלל"), "runtime risk Yes opens כלל follow-up");
assert((riskHeart.question.fields || []).some((f) => String(f.key || "").startsWith("clal_ז_")), "runtime risk heart uses letter-ז fields");
const riskStore = W.getHealthStore();
riskStore.responses = {};
W.getHealthQuestionList().forEach((item) => {
  riskStore.responses[item.question.key] = {
    p1: { answer: "no", fields: {}, saved: false, editing: false }
  };
});
assert(W.getHealthBlockingIssue().ok === true, "runtime risk advance OK after all answers");

if(failed){
  console.error("\nFAILED  passed=" + passed + " failed=" + failed);
  process.exit(1);
}
console.log("\nOK  passed=" + passed);
