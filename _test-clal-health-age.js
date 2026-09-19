/* GI-CLL-HEALTH-AGE 2026-09-17
   בריאות כלל: גיל ביטוחי 66–120 משתמש במדרגות התעריפון הקיימות
   ולא נחסם בשער כניסה 0–65. שירותים לילד נשאר עד גיל 20.
   הרצה: node _test-clal-health-age.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260917-clal-health-age-v1";
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

console.log("1) syntax + cache + source gate");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-clal-health-age.js")]).status === 0, "node --check this test");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=20260919-prem-edit-modal-v1"'), "app.js simulator cache bumped");
assert(sims.includes("const CLAL_HEALTH_MIN_AGE = 0, CLAL_HEALTH_MAX_AGE = 120"), "max insurance age is 120");
assert(!/const CLAL_HEALTH_MIN_AGE = 0, CLAL_HEALTH_MAX_AGE = 65/.test(sims), "old 0–65 gate removed");
assert(sims.includes('maxAge: CLAL_HEALTH_MAX_AGE'), "_syncAge uses the raised max");
assert(/"id": "child_services"[\s\S]{0,180}"maxAge": 20/.test(sims), "child services still capped at 20");

console.log("\n2) runtime quote for ages 66+");
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

const at40 = quote("כלל", "בריאות", { age: 40, covers: ["personal_plus"] });
assert(!!at40 && at40.ok === true && Number(at40.monthlyPremium) > 0, "age 40 personal plus still prices");

const at66 = quote("כלל", "בריאות", { age: 66, covers: ["personal_plus"] });
assert(!!at66 && at66.ok === true && Number(at66.monthlyPremium) > 0, "age 66 personal plus prices from 66–120 band");

const at70 = quote("כלל", "בריאות", { age: 70, covers: ["consult_diag"] });
assert(!!at70 && at70.ok === true && Number(at70.monthlyPremium) > 0, "age 70 consult/diag prices");

const at120 = quote("כלל", "בריאות", { age: 120, covers: ["personal_plus"] });
assert(!!at120 && at120.ok === true && Number(at120.monthlyPremium) > 0, "age 120 still inside tariff");

const over = quote("כלל", "בריאות", { age: 121, covers: ["personal_plus"] });
assert(!!over && over.ok === false && over.error === "age_out_of_range", "age 121 still rejected");

const childOk = quote("כלל", "בריאות", { age: 10, covers: ["child_services"] });
assert(!!childOk && childOk.ok === true && Number(childOk.monthlyPremium) > 0, "child services prices at age 10");

const childOver = quote("כלל", "בריאות", { age: 21, covers: ["child_services"] });
assert(!!childOver && childOver.ok === false && childOver.error === "age_cover_limit", "child services still blocked over 20");

console.log("\n3) simulator _syncAge no longer blocks 66–120");
const sim = RiskSimulators.getHandler("כלל", "בריאות");
assert(!!sim && typeof sim._syncAge === "function", "Clal health simulator registered");

const age70 = sim._syncAge({
  birthDate: "01/01/1956",
  insuranceStartDate: "01/01/2026"
});
assert(age70.ok === true && Number(age70.age) === 70, "_syncAge accepts insurance age 70");

const age121 = sim._syncAge({
  birthDate: "01/01/1904",
  insuranceStartDate: "01/01/2026"
});
assert(age121.ok === false && age121.reason === "age_out_of_range", "_syncAge still rejects age 122-range beyond 120");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
