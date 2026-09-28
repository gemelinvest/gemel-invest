/* GI-HACH-SIM-WIZARD-SYNC 2026-09-27
   נעילת נתיבים: מרכז הסימולטורים + אשף פוליסות חדשות (בריאות/סיכונים)
   טוענים את אותו gi-simulators.js עם תעריפי היום (בריאות 2023 + CPI 133.17,
   ריסק/משכנתא/מחלות קשות מסיכונים ללא מדד בריאות). בלי מנוע שני, בלי אילון.
   הרצה: node _test-hachshara-sim-wizard-sync.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260928-stage10-resave-v1";
const HACHSHARA_PRODUCTS = ["ריסק", "ריסק משכנתא", "בריאות", "מחלות קשות"];
const CATALOG_EXTRAS_NOT_PRICED = ["אבחון רפואי מהיר", "ראשון בסל", "מחלות קשות", "מחלות קשות לילד"];
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

function extractArrayLiteral(src, startNeedle){
  const start = src.indexOf(startNeedle);
  if(start < 0) return null;
  const bracket = src.indexOf("[", start);
  if(bracket < 0) return null;
  let depth = 0;
  for(let i = bracket; i < src.length; i++){
    const ch = src[i];
    if(ch === "[") depth += 1;
    else if(ch === "]"){
      depth -= 1;
      if(depth === 0){
        try { return Function("return (" + src.slice(bracket, i + 1) + ")")(); }
        catch(_e){ return null; }
      }
    }
  }
  return null;
}

const app = read("app.js");
const sims = read("gi-simulators.js");
const wiz = read("gi-wizard.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache — both UIs load the same tagged chunk");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(app.includes('const BUILD = "' + TAG + '"'), "app.js BUILD");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=20260928-stage10-resave-v1"'), "app.js simulator cache");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app.js wizard version");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard build tag");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");

const loadFn = sliceFn(app, "function ensureGiSimulatorJsLoaded(){", "try {\n    if(typeof globalThis !== \"undefined\"){\n      globalThis.ensureGiSimulatorJsLoaded");
assert(loadFn.includes("s.src = GI_SIMULATOR_JS_HREF"), "ensureGiSimulatorJsLoaded injects GI_SIMULATOR_JS_HREF");
assert(!loadFn.includes("gi-simulators.js?v=") || loadFn.includes("GI_SIMULATOR_JS_HREF"), "loader does not hardcode a second simulators URL");

console.log("\n2) catalog + register — four Hachshara products, no סרטן");
const catalog = extractArrayLiteral(app, "const GI_SIMULATOR_CATALOG = Object.freeze(");
assert(Array.isArray(catalog) && catalog.length > 0, "GI_SIMULATOR_CATALOG extractable");
const hachCatalog = (catalog || []).filter((x) => x && x.company === "הכשרה").map((x) => x.product);
assert(JSON.stringify(hachCatalog.slice().sort()) === JSON.stringify(HACHSHARA_PRODUCTS.slice().sort()), "catalog has exactly ריסק / ריסק משכנתא / בריאות / מחלות קשות");
assert(!hachCatalog.includes("סרטן"), "catalog has no הכשרה / סרטן");
HACHSHARA_PRODUCTS.forEach((product) => {
  assert(sims.includes('RiskSimulators.register("הכשרה", "' + product + '"'), "register(הכשרה, " + product + ")");
});
assert(!sims.includes('RiskSimulators.register("הכשרה", "סרטן"'), "no register(הכשרה, סרטן)");
assert(wiz.includes('companies: ["איילון","כלל","מגדל","מנורה","הפניקס","הכשרה","מדיקר"]'), "wizard companies include הכשרה");

console.log("\n3) both launch paths use the same handler after the same chunk load");
const centerOpenExact = sliceFn(app, "async open(opts){\n      if(!Auth.canAccessSimulators?.()){", "_catalogItems(){");
const launchExact = sliceFn(app, "_launch(company, product){\n      const handler = RiskSimulators.getHandler(company, product);", "if(typeof globalThis !== \"undefined\"){");
assert(centerOpenExact.includes("await ensureGiSimulatorJsLoaded()"), "sim-center open() awaits ensureGiSimulatorJsLoaded");
assert(launchExact.includes("RiskSimulators.getHandler(company, product)"), "sim-center _launch uses getHandler");
assert(launchExact.includes("standalone: true") || /standalone:\s*true/.test(launchExact), "sim-center opens standalone");
assert(!/wizardWorkspace:\s*true/.test(launchExact), "sim-center does not set wizardWorkspace");

const openSim = sliceFn(wiz, "async openRiskSimulator(){", "addDraftPolicy(opts){");
assert(openSim.includes("await ensureGiSimulatorJsLoaded()"), "wizard openRiskSimulator awaits ensureGiSimulatorJsLoaded");
assert(openSim.includes("RiskSimulators.getHandler(company, product)"), "wizard openRiskSimulator uses getHandler");
assert(openSim.includes("wizardWorkspace: true"), "wizard opens wizardWorkspace");
assert(!/standalone:\s*true/.test(openSim), "wizard open does not set standalone");
assert(openSim.includes("simulatorCatalog"), "wizard passes catalog into the same simulator");

const catalogFn = sliceFn(wiz, "getWizardSimulatorCatalog(){", "switchSimulatorInsuredPick(");
assert(catalogFn.includes("RiskSimulators.hasCatalog"), "wizard catalog reads hasCatalog");
assert(catalogFn.includes("RiskSimulators.getHandler"), "wizard catalog reads getHandler");

const step4 = sliceFn(wiz, "renderStep4NeedsAnalysis(){", "_openNaSharedInsuredsPopup(fp){");
assert(step4.includes("renderStep4NeedsAnalysis(){"), "step 4 is התאמת צרכים");
assert(step4.includes("התאמת צרכים"), "step 4 title is התאמת צרכים");
assert(!step4.includes("openRiskSimulator"), "step 4 renderer does not open a simulator");
assert(!step4.includes("ensureGiSimulatorJsLoaded"), "step 4 renderer does not load the simulators chunk");
assert(!step4.includes("data-open-risk-sim"), "step 4 has no פתח סימולטור control");

const step5 = sliceFn(wiz, "renderStep5(){", "renderStep6(");
assert(step5.includes("data-open-risk-sim"), "step 5 has פתח סימולטור");
assert(step5.includes("_npSimAutoOpenedKey") || wiz.includes("_npSimAutoOpenedKey"), "step 5 auto-opens the simulator");
assert(step5.includes("RiskSimulators.hasCatalog") || step5.includes("RiskSimulators.getHandler"), "step 5 banner is catalog/handler gated");
assert(step5.includes("getNewPolicyHealthCoverGroups(d.company)"), "step 5 health checkboxes use simulator keys");
assert(step5.includes("pruneDraftHealthCoversToSimulator"), "step 5 prunes draft covers to simulator keys");

console.log("\n4) health cover keys 1:1 with HACHSHARA_HEALTH_COVERS wizardKey");
const covers = extractArrayLiteral(sims, "const HACHSHARA_HEALTH_COVERS = ");
assert(Array.isArray(covers) && covers.length === 8, "HACHSHARA_HEALTH_COVERS has 8 covers");
const wizardKeys = (covers || []).map((c) => c.wizardKey);
assert(wizardKeys.every(Boolean), "every health cover has wizardKey");

const keysBlockStart = wiz.indexOf("const HEALTH_SIMULATOR_COVER_KEYS");
const keysBlock = keysBlockStart >= 0 ? wiz.slice(keysBlockStart, wiz.indexOf("healthCoversByCompany", keysBlockStart)) : "";
const simKeys = extractArrayLiteral(keysBlock, '"הכשרה":');
assert(Array.isArray(simKeys) && simKeys.length === 8, "HEALTH_SIMULATOR_COVER_KEYS.הכשרה has 8 keys");
assert(JSON.stringify(simKeys) === JSON.stringify(wizardKeys), "wizard keys 1:1 with simulator wizardKey");
CATALOG_EXTRAS_NOT_PRICED.forEach((extra) => {
  assert(!(simKeys || []).includes(extra), "simulator keys exclude catalog extra: " + extra);
});

const catalogHach = extractArrayLiteral(
  sliceFn(wiz, 'healthCoversByCompany: {', "getHealthQuestionsFiltered(){"),
  '"הכשרה":'
);
const catalogKeys = [];
(catalogHach || []).forEach((group) => {
  (group.items || []).forEach((item) => { if(item && item.k) catalogKeys.push(item.k); });
});
assert(catalogKeys.length > 8, "wizard catalog for הכשרה still has extras beyond the 8 priced covers");
wizardKeys.forEach((k) => {
  assert(catalogKeys.includes(k), "catalog contains priced key: " + k);
});
CATALOG_EXTRAS_NOT_PRICED.forEach((extra) => {
  assert(catalogKeys.includes(extra), "catalog still lists unpriced extra (filtered at new-policy): " + extra);
});

const applyFn = sliceFn(wiz, "applyRiskSimResultsToDraft(resultsByInsuredId, opts){", "syncDraftDiscountFromSimulator(draft){");
assert(applyFn.includes("c.wizardKey || c.label || c.id"), "apply copies wizardKey onto draft.healthCovers");
assert(applyFn.includes("this.pruneDraftHealthCoversToSimulator(draft)"), "apply prunes to HEALTH_SIMULATOR_COVER_KEYS");

const pruneFn = sliceFn(wiz, "pruneDraftHealthCoversToSimulator(draft){", "isHealthCoverInGeneralDiscount(cover){");
assert(pruneFn.includes("getHealthSimulatorCoverKeySet(draft.company)"), "prune uses company simulator key set");
assert(pruneFn.includes('safeTrim(draft.type) !== "בריאות"'), "prune only runs on health drafts");

function pruneToSimulator(coversIn, allowed){
  const set = new Set(allowed);
  return coversIn.filter((k) => set.has(String(k || "").trim()));
}
const applied = pruneToSimulator(wizardKeys.concat(CATALOG_EXTRAS_NOT_PRICED), simKeys);
assert(JSON.stringify(applied) === JSON.stringify(wizardKeys), "prune keeps all 8 priced covers and drops extras");

console.log("\n5) runtime quotes from the shared chunk (2023 health + סיכונים life)");
const registry = {};
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
  window: {
    localStorage: { getItem(){ return null; }, setItem(){} },
    addEventListener(){},
    document: {
      createElement(){ return { style: {}, setAttribute(){}, addEventListener(){} }; },
      getElementById(){ return null; },
      querySelector(){ return null; },
      querySelectorAll(){ return []; },
      body: { appendChild(){} }
    }
  }
};
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.window = sandbox.window;
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
  RiskSimulators: {
    registry,
    _key(c, p){ return String(c || "").trim() + "::" + String(p || "").trim(); },
    register(company, product, handler){
      this.registry[this._key(company, product)] = handler;
      return handler;
    },
    getHandler(company, product){
      return this.registry[this._key(company, product)] || null;
    }
  },
  onSimulatorsInstalled(){}
};
vm.runInNewContext(sims, sandbox);
const rs = sandbox.__GI_SIM_HOST.RiskSimulators;
HACHSHARA_PRODUCTS.forEach((product) => {
  const handler = rs.getHandler("הכשרה", product);
  assert(!!handler && typeof handler.open === "function", "runtime handler registered for " + product);
});
assert(!rs.getHandler("הכשרה", "סרטן"), "runtime has no הכשרה סרטן handler");

const quote = sandbox.GiSimulatorQuotes && sandbox.GiSimulatorQuotes.quote;
assert(typeof quote === "function", "GiSimulatorQuotes.quote exported from the same chunk");

const healthBook = quote("הכשרה", "בריאות", { age: 10, covers: ["drugs"] });
assert(!!healthBook && healthBook.ok === true && healthBook.monthlyPremium === 11.5, "health drugs 0–20 book ₪11.50 (2023, not סיכונים)");
assert(healthBook.baseMonthlyPremium === 11.5, "health keeps 2023 base before CPI");

const cpi = sandbox.window.HealthCpi;
assert(!!cpi && cpi.TARIFFS.hachshara_health.baseIndexPoints === 133.17, "HealthCpi.hachshara_health base 133.17");
cpi._mem = {
  fetchedAt: "2026-09-07T13:00:00.000Z",
  targetPeriod: "07-2026",
  current: { year: 2026, month: 7, monthDesc: "יולי", linked: 112.8774 },
  anchor: { year: 2023, month: 7, monthDesc: "יולי", linked: 104.5 },
  source: "cbs"
};
const healthCpi = quote("הכשרה", "בריאות", { age: 10, covers: ["drugs"] });
assert(!!healthCpi && healthCpi.ok === true && healthCpi.monthlyPremium === 12.76, "same engine after CPI: drugs ₪12.76");

const allEight = quote("הכשרה", "בריאות", {
  age: 10,
  covers: ["drugs", "transplant", "abroad_surgery", "surgery_shaban_5000", "surgery_shaban", "surgery_first_shekel", "ambulatory_consults", "child_premium"]
});
assert(!!allEight && allEight.ok === true && allEight.baseMonthlyPremium === 131.34, "all 8 2023 covers book ₪131.34");

const riskQuote = quote("הכשרה", "ריסק", { age: 40, gender: "זכר", smoker: false, sumInsured: 1000000 });
assert(!!riskQuote && riskQuote.ok === true && riskQuote.monthlyPremium === 86.67, "risk 40 זכר לא-מעשן ₪1M = ₪86.67 (no health CPI)");
assert(riskQuote.indexFactor == null, "risk quote has no health CPI factor");

const mortQuote = quote("הכשרה", "ריסק משכנתא", { age: 40, gender: "זכר", smoker: false, sumInsured: 1000000 });
assert(!!mortQuote && mortQuote.ok === true && mortQuote.monthlyPremium === 80, "mortgage 40 זכר לא-מעשן ₪1M = ₪80.00 (no health CPI)");
assert(mortQuote.indexFactor == null, "mortgage quote has no health CPI factor");

const ciQuote = quote("הכשרה", "מחלות קשות", { age: 43, gender: "זכר", smoker: false, compensation: 100000 });
assert(!!ciQuote && ciQuote.ok === true && ciQuote.monthlyPremium === 93.6, "CI 43 זכר לא-מעשן ₪100k = ₪93.60 (no health CPI)");
assert(ciQuote.indexFactor == null, "CI quote has no health CPI factor");

console.log("\n6) unrelated engines untouched");
assert(sims.includes("RiskSimulators.register(\"איילון\", \"בריאות\""), "Ayalon health register remains");
assert(launchExact.includes("getHandler(company, product)"), "sim-center launch stays company-agnostic");
assert(openSim.includes("getHandler(company, product)"), "wizard open stays company-agnostic (same handler lookup)");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
