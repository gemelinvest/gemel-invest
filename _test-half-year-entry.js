/* GI-HALF-YEAR 2026-10-28
   ילדה בת חצי שנה (גיל ביטוחי 0) נכנסת להצעה במחלות קשות וסרטן של מנורה
   באותו תעריף ילדים של גיל 1. מתחת ל-15 יום נשאר חסום. גיל 75 נשאר חסום.
   הרצה: node _test-half-year-entry.js
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

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + SIM_TAG + '"'), "simulator cache prefix stays");
assert(app.includes("&giSimAgeOpen=1"), "previous age-open cache flag stays");
assert(app.includes("&giHalfYear=1"), "simulator cache busted for half-year entry");
assert(sw.includes("sim-age-open-v1"), "previous service-worker suffix stays");
assert(sw.includes("half-year-v1"), "service-worker cache suffix bumped");
assert(sims.includes("minAge: 0,           // גיל ביטוחי 0 (מתחת לחצי שנה) = תעריף ילדים 1–19"), "Menora CI min age is 0");
assert(sims.includes("maxEntryAge: 74,     // כניסה עד השורה האחרונה בטבלה"), "Menora CI still ends at the last table row");

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
  console, Date, Math, Number, String, Array, Object, JSON, parseInt, isNaN, Infinity,
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
  window: { localStorage: { getItem(){ return null; }, setItem(){} }, addEventListener(){}, document: null }
};
sandbox.window.document = sandbox.document;
sandbox.globalThis = sandbox;
sandbox.window.window = sandbox.window;
sandbox.__GI_SIM_HOST = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  escapeHtml(s){ return String(s == null ? "" : s); },
  on(){}, $(){ return null; }, $$(){ return []; },
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
const quote = sandbox.GiSimulatorQuotes.quote;

function girl(age, extra){
  return Object.assign({ age, gender: "נקבה", smoker: false, compensation: 100000, sumInsured: 100000 }, extra || {});
}

console.log("\n2) Menora critical illness and cancer at insurance age 0");
const ci0 = quote("מנורה", "מחלות קשות", girl(0));
const ci1 = quote("מנורה", "מחלות קשות", girl(1));
assert(ci0 && ci0.ok === true, "Menora CI age 0 quotes — " + (ci0 && (ci0.ok ? ci0.monthlyPremium : ci0.error)));
assert(ci1 && ci1.ok === true, "Menora CI age 1 still quotes");
assert(ci0 && ci1 && ci0.monthlyPremium === ci1.monthlyPremium && ci0.monthlyPremium === 10.5, "Menora CI age 0 uses the age-1 child rate 10.5");
const cancer0 = quote("מנורה", "סרטן", girl(0));
const cancer1 = quote("מנורה", "סרטן", girl(1));
assert(cancer0 && cancer0.ok === true, "Menora cancer age 0 quotes — " + (cancer0 && (cancer0.ok ? cancer0.monthlyPremium : cancer0.error)));
assert(cancer1 && cancer1.ok === true, "Menora cancer age 1 still quotes");
assert(cancer0 && cancer1 && cancer0.monthlyPremium === cancer1.monthlyPremium && cancer0.monthlyPremium === 4.5, "Menora cancer age 0 uses the age-1 child rate 4.5");
const boy = quote("מנורה", "מחלות קשות", girl(0, { gender: "זכר" }));
assert(boy && boy.ok === true && boy.monthlyPremium === 10.5, "Menora CI age 0 boy uses the same child rate");
const smoker = quote("מנורה", "מחלות קשות", girl(0, { smoker: true }));
assert(smoker && smoker.ok === false && smoker.error === "rate_missing", "Menora CI age 0 smoker stays unpriced — " + (smoker && smoker.error));
const tooOld = quote("מנורה", "מחלות קשות", girl(75));
assert(tooOld && tooOld.ok === false && tooOld.error === "age_out_of_range", "Menora CI age 75 stays blocked");
const riskBaby = quote("מנורה", "ריסק", girl(0));
assert(riskBaby && riskBaby.ok === false, "Menora life risk still has no infant tariff — " + (riskBaby && (riskBaby.ok ? riskBaby.monthlyPremium : riskBaby.error)));

console.log("\n3) birth date of about half a year can be added to the proposal");
const sim = RiskSimulators.getHandler("מנורה", "מחלות קשות");
const cancerSim = RiskSimulators.getHandler("מנורה", "סרטן");
const under = sim._syncAge({ birthDate: "29/04/2026", insuranceStartDate: "28/10/2026" });
assert(under.ok === true && under.age === 0, "a day under half a year is insurance age 0 and accepted — " + JSON.stringify(under));
const exact = sim._syncAge({ birthDate: "28/04/2026", insuranceStartDate: "28/10/2026" });
assert(exact.ok === true && exact.age === 1 && exact.days === 183, "exact half a year still rounds up to insurance age 1");
const newborn = sim._syncAge({ birthDate: "20/10/2026", insuranceStartDate: "28/10/2026" });
assert(newborn.ok === false && newborn.reason === "entry_too_young", "under 15 days stays blocked — " + JSON.stringify(newborn));
const cancerUnder = cancerSim._syncAge({ birthDate: "29/04/2026", insuranceStartDate: "28/10/2026" });
assert(cancerUnder.ok === true && cancerUnder.age === 0, "Menora cancer accepts the same half-year birth date");

sim._state = {
  girl: {
    birthDate: "29/04/2026",
    insuranceStartDate: "28/10/2026",
    age: "",
    gender: "נקבה",
    smoker: false,
    compensation: "100000",
    programMode: "base",
    result: null,
    error: null
  }
};
const built = sim._buildResultForInsured("girl");
assert(!!built && String(built.age) === "0" && Number(built.monthlyPremium) === 10.5, "offer apply builds Menora CI for a half-year-old girl — " + (built && built.monthlyPremium));

console.log("\n4) other companies already price insurance age 0");
[
  ["הפניקס", "מחלות קשות"],
  ["הפניקס", "סרטן"],
  ["איילון", "מחלות קשות"],
  ["איילון", "סרטן"],
  ["הכשרה", "מחלות קשות"],
  ["מגדל", "מחלות קשות"],
  ["מגדל", "סרטן"],
  ["כלל", "מחלות קשות"],
  ["כלל", "סרטן"]
].forEach(([company, product]) => {
  const q = quote(company, product, girl(0));
  assert(q && q.ok === true && Number(q.monthlyPremium) > 0, company + " " + product + " age 0 — " + (q && (q.ok ? q.monthlyPremium : q.error)));
});
[
  ["מנורה", "בריאות", ["transplant"]],
  ["הפניקס", "בריאות", ["transplant"]],
  ["איילון", "בריאות", ["transplant"]],
  ["הכשרה", "בריאות", ["drugs"]],
  ["מגדל", "בריאות", ["drugs"]],
  ["כלל", "בריאות", ["consult_diag"]]
].forEach(([company, product, covers]) => {
  const q = quote(company, product, girl(0, { covers }));
  assert(q && q.ok === true && Number(q.monthlyPremium) > 0, company + " health age 0 — " + (q && (q.ok ? q.monthlyPremium : q.error)));
});

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
