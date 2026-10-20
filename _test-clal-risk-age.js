/* GI-CLL-RISK-AGE 2026-10-20
   ריסק כלל: גיל ביטוחי 68–80 משתמש בתעריפון הקיים ולא נחסם בשער כניסה 18–67.
   הסימולטור בהצעה (_syncAge + compute + quote) מאפשר להתקדם גם בגיל 72.
   הרצה: node _test-clal-risk-age.js
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
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-clal-risk-age.js")]).status === 0, "node --check this test");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + SIM_TAG + '"'), "app.js simulator cache prefix stays");
assert(app.includes("&giClalRiskAge=1"), "simulator cache busted for Clal risk age");
assert(sw.includes("clal-risk-age-v1"), "service-worker cache suffix bumped");
assert(sims.includes("const CLAL_RISK_MIN_AGE = 18, CLAL_RISK_MAX_ENTRY_AGE = 80"), "entry age follows the tariff table to 80");
assert(!/const CLAL_RISK_MIN_AGE = 18, CLAL_RISK_MAX_ENTRY_AGE = 67/.test(sims), "old 18–67 entry gate removed");
assert(sims.includes("maxAge: CLAL_RISK_MAX_ENTRY_AGE"), "_syncAge uses the raised max");
assert(!/computeClalRiskPremium שחוסם כניסה מעל 67/.test(sims), "projection comment no longer describes a 67 block");
assert(sims.includes("אין שער 67 שחוסם חישוב או «הוסף להצעה»"), "header documents the open entry path");

console.log("\n2) runtime quote for ages 68–80, including 72");
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

const at40 = quote("כלל", "ריסק", { age: 40, gender: "זכר", smoker: false, sumInsured: 1000000 });
assert(!!at40 && at40.ok === true && Number(at40.monthlyPremium) > 0, "age 40 still prices");

const at67 = quote("כלל", "ריסק", { age: 67, gender: "זכר", smoker: false, sumInsured: 500000 });
assert(!!at67 && at67.ok === true && Number(at67.monthlyPremium) > 0, "age 67 still prices");

const at72 = quote("כלל", "ריסק", { age: 72, gender: "זכר", smoker: false, sumInsured: 500000 });
assert(!!at72 && at72.ok === true && Number(at72.monthlyPremium) > 0, "age 72 prices from the existing tariff");

const at72f = quote("כלל", "ריסק", { age: 72, gender: "נקבה", smoker: true, sumInsured: 750000 });
assert(!!at72f && at72f.ok === true && Number(at72f.monthlyPremium) > 0, "age 72 female smoker prices");

const at80 = quote("כלל", "ריסק", { age: 80, gender: "נקבה", smoker: false, sumInsured: 500000 });
assert(!!at80 && at80.ok === true && Number(at80.monthlyPremium) > 0, "age 80 still inside tariff");

const over = quote("כלל", "ריסק", { age: 81, gender: "זכר", smoker: false, sumInsured: 500000 });
assert(!!over && over.ok === false && over.error === "age_out_of_range", "age 81 still rejected — no table row");

const young = quote("כלל", "ריסק", { age: 17, gender: "זכר", smoker: false, sumInsured: 500000 });
assert(!!young && young.ok === false && young.error === "age_out_of_range", "age 17 still rejected");

console.log("\n3) simulator _syncAge / apply path no longer blocks 68–80");
const sim = RiskSimulators.getHandler("כלל", "ריסק");
assert(!!sim && typeof sim._syncAge === "function", "Clal risk simulator registered");
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

const age80 = sim._syncAge({
  birthDate: "01/01/1946",
  insuranceStartDate: "01/01/2026"
});
assert(age80.ok === true && Number(age80.age) === 80, "_syncAge accepts insurance age 80");

const age81 = sim._syncAge({
  birthDate: "01/01/1945",
  insuranceStartDate: "01/01/2026"
});
assert(age81.ok === false && age81.reason === "age_out_of_range", "_syncAge still rejects age beyond 80");

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
assert(!!built && Number(built.age) === 72 && Number(built.monthlyPremium) > 0, "offer apply/save can build a result at age 72");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
