/* GI-HACH-LIFE-CPI 2026-09-12
   בריאות הכשרה: תעריפי בריאות 2023 (2).xlsx (מדד בסיס 13317 = 133.17)
   + הצמדה במנוע HealthCpi כמו שאר חברות הבריאות.
   מחלות קשות / ריסק / משכנתא לפי תעריפים סיכונים.xlsx — ללא מדד
   (בתעריפון הסיכונים אין מדד בסיס מתועד).
   הרצה: node _test-hachshara-excel-tariffs.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260913-migdal-health-decl-v1";
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

const app = read("app.js");
const sims = read("gi-simulators.js");
const html = read("index.html");
const sw = read("service-worker.js");
const wiz = read("gi-wizard.js");
const cancel = read("gi-cancel-forms.js");

const healthStart = sims.indexOf("GI-HACH-HEALTH-SIM");
const healthEnd = sims.indexOf("GI-HACH-CI-SIM");
assert(healthStart >= 0 && healthEnd > healthStart, "health and CI blocks exist");
const healthBlock = sims.slice(healthStart, healthEnd);
const ciBlock = sims.slice(healthEnd, sims.indexOf("RiskSimulators.register(\"הכשרה\", \"מחלות קשות\"") + 80);

console.log("1) syntax + cache tag");
const syntax = spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")], { encoding: "utf8" });
assert(syntax.status === 0, "node --check gi-simulators.js");
if(syntax.status !== 0) console.error(syntax.stderr || syntax.stdout);
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + TAG + '"'), "app.js simulator cache");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app.js wizard version");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard build tag");
assert(cancel.includes('VERSION: "' + TAG + '"'), "cancel-forms version");

console.log("\n2) health engine uses 2023 book rates + CPI base 133.17");
assert(healthBlock.includes("תעריפי בריאות 2023.xlsx"), "health block cites the 2023 book");
assert(healthBlock.includes("HACHSHARA_HEALTH_CPI_KEY"), "health CPI key present");
assert(healthBlock.includes("HealthCpi.indexAgorot(agorot, HACHSHARA_HEALTH_CPI_KEY)"), "health engine indexes via HealthCpi");
assert(healthBlock.includes("צמודה למדד"), "health UI says CPI-indexed");
assert(healthBlock.includes("פרמיית בסיס (לפני מדד)"), "health UI shows base before CPI");
assert(healthBlock.includes("formatHachsharaHealthIndexMetaHtml"), "index meta helper");
assert(healthBlock.includes("HealthCpi.ensure()"), "fetches CBS index on open");
assert(!healthBlock.includes("id: \"drugs_ext\""), "does not add Excel-only drug rider");
assert(!healthBlock.includes("id: \"transplant_rider\""), "does not add Excel-only transplant rider");

const tariffBlock = sims.slice(sims.indexOf("hachshara_health:"), sims.indexOf("migdal_health:"));
assert(tariffBlock.includes("baseIndexPoints: 133.17"), "HealthCpi.hachshara_health base is 133.17");
assert(tariffBlock.includes("מדד 13317") || tariffBlock.includes("13317"), "tariff comment cites book header 13317");

const coversMatch = sims.match(/const HACHSHARA_HEALTH_COVERS = (\[[\s\S]*?\n  \]);/);
assert(!!coversMatch, "HACHSHARA_HEALTH_COVERS extractable");
let covers = [];
try { covers = Function("return (" + coversMatch[1] + ")")(); } catch(e){
  console.error(e);
}
assert(Array.isArray(covers) && covers.length === 8, "8 health covers (no extras added)");
const byId = Object.fromEntries(covers.map((c) => [c.id, c]));

function bandAgorot(coverId){
  return (byId[coverId]?.bands || []).map((b) => b.agorot);
}

const BOOK_2023 = {
  drugs: [1150, 1774, 2382, 3915, 5500, 7300, 10000, 13200],
  transplant: [971, 1568, 1703, 2107, 2347, 2659, 3072, 3254],
  abroad_surgery: [623, 866, 991, 1202, 1900, 2400, 2800, 2900],
  surgery_first_shekel: [3104, 8415, 10670, 16281, 24777, 32157, 38643, 50938],
  surgery_shaban: [1783, 3357, 5877, 8146, 13009, 15844, 21363, 27443],
  surgery_shaban_5000: [1409, 2652, 4643, 6435, 10277, 12517, 16877, 21680],
  ambulatory_consults: [1044, 4000, 4000, 4000, 4000, 4575, 4575, 5175]
};
Object.keys(BOOK_2023).forEach((id) => {
  assert(JSON.stringify(bandAgorot(id)) === JSON.stringify(BOOK_2023[id]), id + " bands match תעריפי בריאות 2023.xlsx");
});
assert(JSON.stringify(bandAgorot("child_premium")) === JSON.stringify([3050]), "שירות פרימיום לילד ₪30.50 ages 0–25");

function lookupAgorot(coverId, age){
  const bands = byId[coverId]?.bands || [];
  const b = bands.find((x) => age >= x.min && age <= x.max);
  return b ? b.agorot : null;
}
assert(lookupAgorot("drugs", 0) === 1150, "drugs age 0 = ₪11.50 (book, not Excel ₪3.10)");
assert(lookupAgorot("drugs", 20) === 1150, "drugs age 20 still in 0–20 band");
assert(lookupAgorot("drugs", 21) === 1774, "drugs age 21 = ₪17.74");
assert(lookupAgorot("surgery_first_shekel", 10) === 3104, "first-shekel age 10 = ₪31.04");
assert(lookupAgorot("transplant", 70) === 3254, "transplant 66+ = ₪32.54");
assert(lookupAgorot("surgery_first_shekel", 63) === 38643, "first-shekel 61–65 = ₪386.43 from 2023 book");

console.log("\n3) CPI formula matches HealthCpi.indexAgorot (agorot rounded)");
const BASE_POINTS = 133.17;
const CURRENT_JUL_2026 = 147.81; // CBS יולי 2026 → נקודות תעריפון (עוגן 136.84 × linked/104.5)
function indexAgorot(baseAgorot, currentPoints){
  return Math.round(Number(baseAgorot) * (currentPoints / BASE_POINTS));
}
assert(indexAgorot(1150, CURRENT_JUL_2026) === 1276, "drugs 0–20: ₪11.50 × (147.81/133.17) → ₪12.76");
assert(indexAgorot(3104, CURRENT_JUL_2026) === 3445, "first-shekel 0–20: ₪31.04 → ₪34.45");
assert(indexAgorot(3050, CURRENT_JUL_2026) === 3385, "child premium: ₪30.50 → ₪33.85");
assert(Math.abs((CURRENT_JUL_2026 / BASE_POINTS) - 1.109935) < 0.00001, "factor ≈ 1.109935");

console.log("\n4) CI / risk / mortgage keep Excel סיכונים tables, without health CPI");
assert(ciBlock.includes("תעריפים סיכונים.xlsx") || sims.includes("גיליון «מחלות קשות»"), "CI block cites the xlsx");
assert(sims.includes("HACHSHARA_SHARED_CPI_KEY"), "shared CPI helpers remain for health");
assert(sims.includes('const HACHSHARA_SHARED_CPI_KEY = "hachshara_health"'), "health CPI key remains hachshara_health");
assert(!ciBlock.includes("applyHachsharaSharedCpiToAgorot(monthlyAgorot)"), "CI engine does not apply shared health CPI");
assert(!sims.includes("applyHachsharaSharedCpiToMonthlyShekels(monthlyPremium)"), "risk/mortgage do not apply shared health CPI");
assert(!ciBlock.includes("צמודה למדד"), "CI UI no longer says CPI-indexed");
assert(healthBlock.includes("פרמיית בסיס (לפני מדד)"), "health UI still shows base before CPI");
const ciMatch = sims.match(/const HACHSHARA_CI_RATE_MAP = (\{.*?\});/);
assert(!!ciMatch, "HACHSHARA_CI_RATE_MAP extractable");
let ciMap = null;
try { ciMap = Function("return (" + ciMatch[1] + ")")(); } catch(e){
  console.error(e);
}
assert(!!ciMap && Object.keys(ciMap).length === 76, "CI map has ages 0–75");
assert(ciMap["43"].mNS === 9360, "age 43 male NS = ₪93.60");
assert(ciMap["17"].mNS === 889, "age 17 all-columns ₪8.89");
assert(JSON.stringify(ciMap["0"]) === JSON.stringify(ciMap["17"]), "ages 0–16 copy age 17");
assert(JSON.stringify(ciMap["75"]) === JSON.stringify(ciMap["74"]), "age 75 copies age 74");
assert(sims.includes("const HACHSHARA_RISK_RATE_TABLE_LE500K"), "risk ≤500k table exists");
assert(sims.includes("const HACHSHARA_MORT_RISK_RATE_TABLE"), "mortgage table exists");
assert(sims.includes("[18, 0.99, 1.41, 0.72, 0.93]"), "risk age 18 low-bracket matches Excel ריסק");
assert(sims.includes("[18, 0.75, 1.11, 0.51, 0.7]"), "mortgage age 18 matches Excel משכנתא");

console.log("\n5) runtime quote uses 2023 base then CBS factor");
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
  RiskSimulators: { register(){}, getHandler(){ return null; }, registry: {} },
  onSimulatorsInstalled(){}
};
vm.runInNewContext(sims, sandbox);
const quote = sandbox.GiSimulatorQuotes && sandbox.GiSimulatorQuotes.quote;
assert(typeof quote === "function", "GiSimulatorQuotes.quote exported");
const cpi = sandbox.window.HealthCpi;
assert(!!cpi && typeof cpi.indexAgorot === "function", "HealthCpi exported");
assert(cpi.TARIFFS.hachshara_health.baseIndexPoints === 133.17, "runtime baseIndexPoints is 133.17");

const before = quote("הכשרה", "בריאות", { age: 10, covers: ["drugs"] });
assert(!!before && before.ok === true, "health quote ok before CBS mem");
assert(before.monthlyPremium === 11.5, "without CBS cache, drugs 0–20 stays at book ₪11.50");

cpi._mem = {
  fetchedAt: "2026-09-07T13:00:00.000Z",
  targetPeriod: "07-2026",
  current: { year: 2026, month: 7, monthDesc: "יולי", linked: 112.8774 },
  anchor: { year: 2023, month: 7, monthDesc: "יולי", linked: 104.5 },
  source: "cbs"
};
assert(cpi.getCurrentIndexPoints() === 147.81, "CBS July 2026 converts to 147.81 tariff points");
const indexed = cpi.indexAgorot(1150, "hachshara_health");
assert(indexed.indexedAgorot === 1276, "indexAgorot(1150) → 1276 agorot");
assert(Math.abs(indexed.factor - (147.81 / 133.17)) < 1e-12, "factor is current/base");

const after = quote("הכשרה", "בריאות", { age: 10, covers: ["drugs"] });
assert(!!after && after.ok === true, "health quote ok after CBS mem");
assert(after.monthlyPremium === 12.76, "drugs 0–20 indexed to ₪12.76");
assert(after.annualPremium === 153.12, "annual is indexed monthly × 12");

const first = quote("הכשרה", "בריאות", { age: 10, covers: ["surgery_first_shekel"] });
assert(!!first && first.ok === true && first.monthlyPremium === 34.45, "first-shekel 0–20 indexed to ₪34.45");

const ciQuote = quote("הכשרה", "מחלות קשות", { age: 43, gender: "זכר", smoker: false, compensation: 100000 });
assert(!!ciQuote && ciQuote.ok === true, "CI quote still works");
assert(ciQuote.monthlyPremium === 93.6, "CI age 43 male NS ₪100k = book ₪93.60 (no CPI)");
assert(ciQuote.annualPremium === 1123.2, "CI annual is book monthly × 12");

const riskQuote = quote("הכשרה", "ריסק", { age: 40, gender: "זכר", smoker: false, sumInsured: 1000000 });
assert(!!riskQuote && riskQuote.ok === true, "risk quote ok");
assert(riskQuote.monthlyPremium === 86.67, "risk age 40 male NS ₪1M = book ₪86.67 (no CPI)");

const mortQuote = quote("הכשרה", "ריסק משכנתא", { age: 40, gender: "זכר", smoker: false, sumInsured: 1000000 });
assert(!!mortQuote && mortQuote.ok === true, "mortgage quote ok");
assert(mortQuote.monthlyPremium === 80, "mortgage age 40 male NS ₪1M = book ₪80.00 (no CPI)");

assert(after.indexFactor === indexed.factor, "health quote exposes the health CPI factor");
assert(riskQuote.indexFactor == null, "risk quote has no CPI factor");
assert(mortQuote.indexFactor == null, "mortgage quote has no CPI factor");
assert(ciQuote.indexFactor == null, "CI quote has no CPI factor");
assert(after.baseMonthlyPremium === 11.5, "health quote keeps book base before CPI");
assert(riskQuote.baseMonthlyPremium == null, "risk quote has no separate base-before-CPI field");
assert(mortQuote.baseMonthlyPremium == null, "mortgage quote has no separate base-before-CPI field");
assert(ciQuote.baseMonthlyPremium == null, "CI quote has no separate base-before-CPI field");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
