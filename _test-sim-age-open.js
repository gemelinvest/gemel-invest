/* GI-SIM-AGE-OPEN 2026-10-21
   כל סימולטור נפתח עד הגיל האחרון שיש לו תעריף.
   מעבר לטבלה נשאר חסום. כיסוי ילד שנעצר במדרגה שלו נשאר חסום.
   הרצה: node _test-sim-age-open.js
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
assert(app.includes("&giSimAgeOpen=1"), "simulator cache busted");
assert(sw.includes("sim-age-open-v1"), "service-worker cache suffix bumped");
assert(sims.includes("const MENORA_HEALTH_MAX_AGE = 120"), "Menora health follows bands to 120");
assert(sims.includes("const PHOENIX_HEALTH_MAX_AGE = 120"), "Phoenix health follows bands to 120");
assert(sims.includes("const AYALON_HEALTH_MAX_AGE = 120"), "Ayalon health follows bands to 120");
assert(sims.includes("const HACHSHARA_HEALTH_MAX_AGE = 120"), "Hachshara health follows bands to 120");
assert(sims.includes("MIGDAL_HEALTH_MAX_AGE = 120"), "Migdal health follows bands to 120");
assert(sims.includes("maxEntryAge: 74,     // כניסה עד השורה האחרונה בטבלה"), "Menora critical illness entry follows the table");
assert(sims.includes("minEntryAge:18, maxEntryAge:64"), "Migdal accidental death entry follows the table");
assert(sims.includes("MIGDAL_MORT_RISK_MAX_ENTRY_AGE = 79"), "Migdal mortgage entry follows the table");

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

function base(age){
  return { age, gender: "זכר", smoker: false, sumInsured: 100000 };
}
function okAt(company, product, age, extra, label){
  const q = quote(company, product, Object.assign(base(age), extra || {}));
  assert(!!q && q.ok === true && Number(q.monthlyPremium) > 0, label + " — " + (q && q.ok ? q.monthlyPremium : (q && q.error)));
  return q;
}
function blockedAt(company, product, age, extra, label){
  const q = quote(company, product, Object.assign(base(age), extra || {}));
  assert(!!q && q.ok === false, label + " — " + (q && (q.ok ? "priced " + q.monthlyPremium : q.error)));
  return q;
}

console.log("\n2) critical illness and cancer through the last tariff row");
okAt("מנורה", "מחלות קשות", 74, null, "Menora CI age 74");
assert(Math.round(quote("מנורה", "מחלות קשות", base(74)).monthlyPremium * 100) === 111690, "Menora CI age 74 male nonsmoker uses the age-74 row");
blockedAt("מנורה", "מחלות קשות", 75, null, "Menora CI age 75 has no row");
okAt("מנורה", "סרטן", 74, null, "Menora cancer age 74");
blockedAt("מנורה", "סרטן", 75, null, "Menora cancer age 75 has no row");
okAt("הפניקס", "מחלות קשות", 74, null, "Phoenix CI age 74");
blockedAt("הפניקס", "מחלות קשות", 75, null, "Phoenix CI age 75 has no row");
okAt("הפניקס", "סרטן", 75, null, "Phoenix cancer age 75");
blockedAt("הפניקס", "סרטן", 76, null, "Phoenix cancer age 76 has no row");
okAt("איילון", "מחלות קשות", 75, null, "Ayalon CI age 75");
blockedAt("איילון", "מחלות קשות", 76, null, "Ayalon CI age 76 has no row");
okAt("איילון", "סרטן", 74, null, "Ayalon cancer age 74");
blockedAt("איילון", "סרטן", 75, null, "Ayalon cancer age 75 has no row");
okAt("כלל", "מחלות קשות", 74, null, "Clal CI age 74");
blockedAt("כלל", "מחלות קשות", 75, null, "Clal CI age 75 has no row");
okAt("כלל", "סרטן", 74, null, "Clal cancer age 74");
blockedAt("כלל", "סרטן", 75, null, "Clal cancer age 75 has no row");
okAt("מגדל", "מחלות קשות", 65, null, "Migdal CI age 65 still prices");
blockedAt("מגדל", "מחלות קשות", 66, null, "Migdal CI age 66 has no row");
okAt("מגדל", "סרטן", 65, null, "Migdal cancer age 65 still prices");
blockedAt("מגדל", "סרטן", 66, null, "Migdal cancer age 66 has no row");
okAt("הכשרה", "מחלות קשות", 75, null, "Hachshara CI age 75");
blockedAt("הכשרה", "מחלות קשות", 76, null, "Hachshara CI age 76 has no row");

console.log("\n3) risk and mortgage risk at the last tariff row");
okAt("הפניקס", "ריסק", 79, null, "Phoenix risk age 79");
blockedAt("הפניקס", "ריסק", 80, null, "Phoenix risk age 80 has no row");
okAt("מנורה", "ריסק", 79, null, "Menora risk age 79");
blockedAt("מנורה", "ריסק", 80, null, "Menora risk age 80 has no row");
okAt("הכשרה", "ריסק", 85, null, "Hachshara risk age 85");
blockedAt("הכשרה", "ריסק", 86, null, "Hachshara risk age 86 has no row");
okAt("כלל", "ריסק", 80, null, "Clal risk age 80");
blockedAt("כלל", "ריסק", 81, null, "Clal risk age 81 has no row");
okAt("הפניקס", "ריסק משכנתא", 80, null, "Phoenix mortgage age 80");
blockedAt("הפניקס", "ריסק משכנתא", 81, null, "Phoenix mortgage age 81 has no row");
okAt("מנורה", "ריסק משכנתא", 84, null, "Menora mortgage age 84");
blockedAt("מנורה", "ריסק משכנתא", 85, null, "Menora mortgage age 85 has no row");
okAt("הכשרה", "ריסק משכנתא", 85, null, "Hachshara mortgage age 85");
blockedAt("הכשרה", "ריסק משכנתא", 86, null, "Hachshara mortgage age 86 has no row");
okAt("כלל", "ריסק משכנתא", 84, null, "Clal mortgage age 84");
blockedAt("כלל", "ריסק משכנתא", 85, null, "Clal mortgage age 85 has no row");
okAt("מגדל", "ריסק משכנתא", 79, null, "Migdal mortgage age 79");
blockedAt("מגדל", "ריסק משכנתא", 80, null, "Migdal mortgage age 80 has no row");

console.log("\n4) health through age 120, and accident covers that have a row");
okAt("מנורה", "בריאות", 80, { covers: ["transplant"] }, "Menora health age 80");
blockedAt("מנורה", "בריאות", 121, { covers: ["transplant"] }, "Menora health age 121");
blockedAt("מנורה", "בריאות", 30, { covers: ["child_dev"] }, "Menora child cover stays capped");
okAt("הפניקס", "בריאות", 80, { covers: ["transplant"] }, "Phoenix health age 80");
blockedAt("הפניקס", "בריאות", 121, { covers: ["transplant"] }, "Phoenix health age 121");
okAt("איילון", "בריאות", 80, { covers: ["transplant"] }, "Ayalon health age 80");
okAt("איילון", "בריאות", 80, { covers: ["fast_diagnosis"] }, "Ayalon fast diagnosis age 80 uses the existing band");
blockedAt("איילון", "בריאות", 70, { covers: ["home"] }, "Ayalon home visit still stops where its band stops");
okAt("הכשרה", "בריאות", 80, { covers: ["drugs"] }, "Hachshara health age 80");
blockedAt("הכשרה", "בריאות", 121, { covers: ["drugs"] }, "Hachshara health age 121");
okAt("מגדל", "בריאות", 80, { covers: ["drugs"] }, "Migdal health age 80");
blockedAt("מגדל", "בריאות", 121, { covers: ["drugs"] }, "Migdal health age 121");
okAt("כלל", "בריאות", 80, { covers: ["consult_diag"] }, "Clal health age 80 still prices");
okAt("מגדל", "מוות מתאונה", 64, null, "Migdal accidental death age 64");
okAt("מגדל", "מוות מתאונה", 18, null, "Migdal accidental death age 18");
blockedAt("מגדל", "מוות מתאונה", 65, null, "Migdal accidental death age 65 has no row");
okAt("מגדל", "נכות מתאונה", 64, null, "Migdal disability age 64");
blockedAt("מגדל", "נכות מתאונה", 29, null, "Migdal disability age 29 has no row");
blockedAt("מגדל", "נכות מתאונה", 65, null, "Migdal disability age 65 has no row");

console.log("\n5) offer path accepts a previously blocked critical-illness age");
const sim = RiskSimulators.getHandler("מנורה", "מחלות קשות");
const age74 = sim._syncAge({ birthDate: "01/01/1952", insuranceStartDate: "01/01/2026" });
assert(age74.ok === true && Number(age74.age) === 74, "Menora CI _syncAge accepts insurance age 74");
sim._state = {
  p1: {
    birthDate: "01/01/1952",
    insuranceStartDate: "01/01/2026",
    age: "",
    gender: "זכר",
    smoker: false,
    compensation: "100000",
    programMode: "base",
    result: null,
    error: null
  }
};
const built = sim._buildResultForInsured("p1");
assert(!!built && Number(built.age) === 74 && Math.round(Number(built.monthlyPremium) * 100) === 111690, "offer apply can build the Menora CI age-74 tariff");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
