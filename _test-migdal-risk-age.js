/* GI-MGD-RISK-AGE 2026-10-21
   ריסק מגדל (אור 1): גיל ביטוחי 68–79 משתמש בתעריפון הקיים ולא נחסם בשער כניסה 18–67.
   הסימולטור בהצעה (_syncAge + compute + quote + הוסף להצעה) מאפשר להתקדם גם מעל גיל 70.
   ריסק משכנתא נשאר חסום מעל 69.
   הרצה: node _test-migdal-risk-age.js
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

function agorot(n){
  return Math.round(Number(n) * 100);
}

function parseDmy(value){
  const s = String(value == null ? "" : value).trim();
  const hit = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if(!hit) return null;
  const day = Number(hit[1]);
  const month = Number(hit[2]);
  const year = Number(hit[3]);
  const date = new Date(year, month - 1, day);
  if(date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { year, month, day, date };
}

const sims = read("gi-simulators.js");
const app = read("app.js");
const sw = read("service-worker.js");

console.log("1) syntax + cache + source gate");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-migdal-risk-age.js")]).status === 0, "node --check this test");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + SIM_TAG + '"'), "app.js simulator cache prefix stays");
assert(app.includes("&giMigdalRiskAge=1"), "simulator cache busted for Migdal risk age");
assert(sw.includes("migdal-risk-age-v1"), "service-worker cache suffix bumped");
assert(sims.includes("const MIGDAL_RISK_MIN_AGE = 18, MIGDAL_RISK_MAX_ENTRY_AGE = 79, MIGDAL_RISK_MAX_TABLE_AGE = 79"), "entry age follows the tariff table to 79");
assert(!/const MIGDAL_RISK_MIN_AGE = 18, MIGDAL_RISK_MAX_ENTRY_AGE = 67/.test(sims), "old 18–67 entry gate removed");
assert(sims.includes("maxAge: maxEntry"), "_syncAge uses the simulator entry cap");
assert(sims.includes("אין שער 67 שחוסם חישוב או «הוסף להצעה»"), "header documents the open entry path");
assert(sims.includes("maxEntryAge: MIGDAL_MORT_RISK_MAX_ENTRY_AGE"), "mortgage quote keeps its own entry cap");

console.log("\n2) runtime quote for ages over 70, using the existing tariff rows");
const registry = {};
const RiskSimulators = {
  registry,
  _key(c, p){ return String(c || "").trim() + "::" + String(p || "").trim(); },
  register(company, product, handler){
    this.registry[this._key(company, product)] = handler;
    return handler;
  },
  getHandler(company, product){
    return this.registry[this._key(company, product)] || null;
  }
};
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
  setTimeout(){ return 0; },
  clearTimeout(){},
  document: {
    createElement(){ return { style: {}, classList:{ add(){}, remove(){} }, setAttribute(){}, addEventListener(){}, querySelector(){ return null; }, querySelectorAll(){ return []; }, appendChild(){}, remove(){} }; },
    getElementById(){ return null; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    addEventListener(){},
    removeEventListener(){},
    body: { appendChild(){} }
  },
  window: {
    localStorage: { getItem(){ return null; }, setItem(){} },
    addEventListener(){},
    document: null
  }
};
sandbox.window.document = sandbox.document;
sandbox.globalThis = sandbox;
sandbox.window.window = sandbox.window;
sandbox.__GI_SIM_HOST = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  escapeHtml(s){ return String(s == null ? "" : s); },
  on(){},
  $(){ return null; },
  $$(){ return []; },
  nowISO(){ return new Date().toISOString(); },
  parseBirthDateValue: parseDmy,
  parseAnyDmyDate: parseDmy,
  formatDmyFromParts(){ return ""; },
  applyDmyAutoFormat(){ return ""; },
  renderCompanyLogoHtmlForCompany(){ return ""; },
  ensureGiSimulatorStylesLoaded(){},
  RiskSimulators,
  onSimulatorsInstalled(){}
};
vm.runInNewContext(sims, sandbox);

const quote = sandbox.GiSimulatorQuotes && sandbox.GiSimulatorQuotes.quote;
assert(typeof quote === "function", "GiSimulatorQuotes.quote exported");

const at40 = quote("מגדל", "ריסק", { age: 40, gender: "זכר", smoker: false, sumInsured: 1000000 });
assert(!!at40 && at40.ok === true && agorot(at40.monthlyPremium) === 6910, "age 40 male nonsmoker 1M stays ₪69.10");

const at67 = quote("מגדל", "ריסק", { age: 67, gender: "זכר", smoker: false, sumInsured: 100000 });
assert(!!at67 && at67.ok === true && agorot(at67.monthlyPremium) === 13950, "age 67 male nonsmoker 100K stays ₪139.50");

const at70 = quote("מגדל", "ריסק", { age: 70, gender: "נקבה", smoker: false, sumInsured: 250000 });
assert(!!at70 && at70.ok === true && agorot(at70.monthlyPremium) === 37268, "age 70 female nonsmoker 250K is ₪372.68");

const at71 = quote("מגדל", "ריסק", { age: 71, gender: "זכר", smoker: true, sumInsured: 100000 });
assert(!!at71 && at71.ok === true && agorot(at71.monthlyPremium) === 36235, "age 71 male smoker 100K is ₪362.35");

const at72 = quote("מגדל", "ריסק", { age: 72, gender: "זכר", smoker: false, sumInsured: 500000 });
assert(!!at72 && at72.ok === true && agorot(at72.monthlyPremium) === 119975 && agorot(at72.annualPremium) === 1439700, "age 72 male nonsmoker 500K is ₪1,199.75 monthly");

const at72f = quote("מגדל", "ריסק", { age: 72, gender: "נקבה", smoker: true, sumInsured: 100000 });
assert(!!at72f && at72f.ok === true && agorot(at72f.monthlyPremium) === 25060, "age 72 female smoker uses the smoker column");
assert(agorot(at72f.monthlyPremium) !== agorot(quote("מגדל", "ריסק", { age: 72, gender: "זכר", smoker: false, sumInsured: 100000 }).monthlyPremium), "gender and smoking change the age-72 rate");

const at79 = quote("מגדל", "ריסק", { age: 79, gender: "נקבה", smoker: true, sumInsured: 200000 });
assert(!!at79 && at79.ok === true && agorot(at79.monthlyPremium) === 97184, "age 79 still inside the tariff table");

const over = quote("מגדל", "ריסק", { age: 80, gender: "זכר", smoker: false, sumInsured: 500000 });
assert(!!over && over.ok === false && over.error === "age_out_of_range", "age 80 still rejected — no table row");

const young = quote("מגדל", "ריסק", { age: 17, gender: "זכר", smoker: false, sumInsured: 500000 });
assert(!!young && young.ok === false && young.error === "age_out_of_range", "age 17 still rejected");

const mort70 = quote("מגדל", "ריסק משכנתא", { age: 70, gender: "זכר", smoker: false, sumInsured: 100000 });
assert(!!mort70 && mort70.ok === false && mort70.error === "age_out_of_range", "mortgage risk still rejects age 70");

const mort69 = quote("מגדל", "ריסק משכנתא", { age: 69, gender: "זכר", smoker: false, sumInsured: 100000 });
assert(!!mort69 && mort69.ok === true && agorot(mort69.monthlyPremium) === 17123, "mortgage risk still prices age 69");

console.log("\n3) simulator _syncAge / apply path no longer blocks ages over 70");
const sim = RiskSimulators.getHandler("מגדל", "ריסק");
assert(!!sim && typeof sim._syncAge === "function", "Migdal risk simulator registered");
assert(typeof sim._buildResultForInsured === "function", "offer apply/save uses _buildResultForInsured");

const age67 = sim._syncAge({
  birthDate: "01/01/1959",
  insuranceStartDate: "01/01/2026"
});
assert(age67.ok === true && Number(age67.age) === 67, "_syncAge still accepts insurance age 67");

const age72 = sim._syncAge({
  birthDate: "01/01/1954",
  insuranceStartDate: "01/01/2026"
});
assert(age72.ok === true && Number(age72.age) === 72, "_syncAge accepts insurance age 72");

const age79 = sim._syncAge({
  birthDate: "01/01/1947",
  insuranceStartDate: "01/01/2026"
});
assert(age79.ok === true && Number(age79.age) === 79, "_syncAge accepts insurance age 79");

const age80 = sim._syncAge({
  birthDate: "01/01/1946",
  insuranceStartDate: "01/01/2026"
});
assert(age80.ok === false && age80.reason === "age_out_of_range", "_syncAge still rejects age beyond 79");

sim._state = {
  p1: {
    birthDate: "01/01/1954",
    insuranceStartDate: "01/01/2026",
    age: "",
    gender: "זכר",
    smoker: false,
    sumInsured: "500000",
    result: null,
    error: null
  }
};
const built = sim._buildResultForInsured("p1");
assert(!!built && Number(built.age) === 72 && agorot(built.monthlyPremium) === 119975, "offer apply/save can build the age-72 tariff at ₪1,199.75");

const mort = RiskSimulators.getHandler("מגדל", "ריסק משכנתא");
const mortAge70 = mort._syncAge({
  birthDate: "01/01/1956",
  insuranceStartDate: "01/01/2026"
});
assert(mortAge70.ok === false && mortAge70.reason === "age_out_of_range", "mortgage simulator still rejects insurance age 70");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
