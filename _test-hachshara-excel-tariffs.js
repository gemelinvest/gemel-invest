/* GI-HACH-LIFE-CPI 2026-09-27
   בריאות הכשרה: תעריפים סיכונים.xlsx גיליון בריאות לכיסויים הממופים,
   + שלושת הכיסויים מתעריפי בריאות 2023.xlsx שאינם באקסל,
   + הצמדה במנוע HealthCpi (מדד בסיס 13317 = 133.17 מ־12/2022).
   מחלות קשות / ריסק / משכנתא לפי תעריפים סיכונים.xlsx — פרמיית התעריפון ביום
   ההצטרפות; סכום הביטוח והפרמיה צמודים למדד המחירים לצרכן מאותו יום.
   הרצה: node _test-hachshara-excel-tariffs.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260927-hach-health-excel-v1";
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

console.log("\n2) health engine uses Excel סיכונים rates + 2023-only covers + CPI 133.17");
assert(healthBlock.includes("תעריפים סיכונים.xlsx"), "health block cites Excel סיכונים");
assert(healthBlock.includes("תעריפי בריאות 2023.xlsx"), "health block cites 2023 book for kept covers");
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

const EXCEL_HEALTH = {
  drugs: [310, 814, 1002, 1776, 2667, 3406, 3742, 4400],
  transplant: [446, 1054, 1226, 1636, 1743, 1743, 1706, 1508],
  abroad_surgery: [131, 286, 386, 628, 941, 1225, 1472, 1570],
  surgery_first_shekel: [2195, 5951, 7546, 11514, 17522, 22741, 17328, 36023],
  surgery_shaban: [1392, 3952, 4848, 7116, 10729, 13897, 16435, 21113]
};
const BOOK_2023_KEPT = {
  surgery_shaban_5000: [1409, 2652, 4643, 6435, 10277, 12517, 16877, 21680],
  ambulatory_consults: [1044, 4000, 4000, 4000, 4000, 4575, 4575, 5175]
};
Object.keys(EXCEL_HEALTH).forEach((id) => {
  assert(JSON.stringify(bandAgorot(id)) === JSON.stringify(EXCEL_HEALTH[id]), id + " bands match תעריפים סיכונים.xlsx גיליון בריאות");
});
Object.keys(BOOK_2023_KEPT).forEach((id) => {
  assert(JSON.stringify(bandAgorot(id)) === JSON.stringify(BOOK_2023_KEPT[id]), id + " stays on תעריפי בריאות 2023.xlsx");
});
assert(JSON.stringify(bandAgorot("child_premium")) === JSON.stringify([3050]), "שירות פרימיום לילד ₪30.50 ages 0–25 from 2023 book");

function lookupAgorot(coverId, age){
  const bands = byId[coverId]?.bands || [];
  const b = bands.find((x) => age >= x.min && age <= x.max);
  return b ? b.agorot : null;
}
assert(lookupAgorot("drugs", 0) === 310, "drugs age 0 = ₪3.10 from Excel");
assert(lookupAgorot("drugs", 20) === 310, "drugs age 20 still in 0–20 band");
assert(lookupAgorot("drugs", 21) === 814, "drugs age 21 = ₪8.14");
assert(lookupAgorot("surgery_first_shekel", 10) === 2195, "first-shekel age 10 = ₪21.95");
assert(lookupAgorot("transplant", 70) === 1508, "transplant 66+ = ₪15.08");
assert(lookupAgorot("surgery_first_shekel", 63) === 17328, "first-shekel 61–65 = ₪173.28 from Excel");
assert(lookupAgorot("surgery_shaban_5000", 10) === 1409, "shaban 5,000 age 10 stays ₪14.09");
assert(lookupAgorot("ambulatory_consults", 10) === 1044, "consults age 10 stays ₪10.44");

console.log("\n3) CPI formula matches HealthCpi.indexAgorot (agorot rounded)");
const BASE_POINTS = 133.17;
const CURRENT_JUL_2026 = 147.81; // CBS יולי 2026 → נקודות תעריפון (עוגן 136.84 × linked/104.5)
function indexAgorot(baseAgorot, currentPoints){
  return Math.round(Number(baseAgorot) * (currentPoints / BASE_POINTS));
}
assert(indexAgorot(310, CURRENT_JUL_2026) === 344, "drugs 0–20: ₪3.10 × (147.81/133.17) → ₪3.44");
assert(indexAgorot(2195, CURRENT_JUL_2026) === 2436, "first-shekel 0–20: ₪21.95 → ₪24.36");
assert(indexAgorot(3050, CURRENT_JUL_2026) === 3385, "child premium: ₪30.50 → ₪33.85");
assert(indexAgorot(1409, CURRENT_JUL_2026) === 1564, "shaban 5,000 0–20: ₪14.09 → ₪15.64");
assert(Math.abs((CURRENT_JUL_2026 / BASE_POINTS) - 1.109935) < 0.00001, "factor ≈ 1.109935");

console.log("\n4) CI / risk / mortgage keep Excel סיכונים tables, without health CPI");
assert(ciBlock.includes("תעריפים סיכונים.xlsx") || sims.includes("גיליון «מחלות קשות»"), "CI block cites the xlsx");
assert(sims.includes("HACHSHARA_SHARED_CPI_KEY"), "shared CPI helpers remain for health");
assert(sims.includes('const HACHSHARA_SHARED_CPI_KEY = "hachshara_health"'), "health CPI key remains hachshara_health");
assert(!ciBlock.includes("applyHachsharaSharedCpiToAgorot(monthlyAgorot)"), "CI engine does not apply shared health CPI");
assert(!sims.includes("applyHachsharaSharedCpiToMonthlyShekels(monthlyPremium)"), "risk/mortgage do not apply shared health CPI");
assert(!ciBlock.includes("צמודה למדד"), "CI UI no longer says CPI-indexed");
assert(ciBlock.includes("formatHachsharaLifeJoinCpiNoteHtml"), "CI UI uses join-date CPI note");
assert(sims.includes("סכום הביטוח והפרמיה צמודים למדד המחירים לצרכן מיום ההצטרפות"), "join-date CPI copy");
assert(sims.includes("formatHachsharaLifeJoinCpiNoteHtml"), "join-date CPI note helper");
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

console.log("\n5) runtime quote uses Excel base then CBS factor");
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
assert(before.monthlyPremium === 3.1, "without CBS cache, drugs 0–20 stays at Excel ₪3.10");

cpi._mem = {
  fetchedAt: "2026-09-07T13:00:00.000Z",
  targetPeriod: "07-2026",
  current: { year: 2026, month: 7, monthDesc: "יולי", linked: 112.8774 },
  anchor: { year: 2023, month: 7, monthDesc: "יולי", linked: 104.5 },
  source: "cbs"
};
assert(cpi.getCurrentIndexPoints() === 147.81, "CBS July 2026 converts to 147.81 tariff points");
const indexed = cpi.indexAgorot(310, "hachshara_health");
assert(indexed.indexedAgorot === 344, "indexAgorot(310) → 344 agorot");
assert(Math.abs(indexed.factor - (147.81 / 133.17)) < 1e-12, "factor is current/base");

const after = quote("הכשרה", "בריאות", { age: 10, covers: ["drugs"] });
assert(!!after && after.ok === true, "health quote ok after CBS mem");
assert(after.monthlyPremium === 3.44, "drugs 0–20 indexed to ₪3.44");
assert(after.annualPremium === 41.28, "annual is indexed monthly × 12");

const first = quote("הכשרה", "בריאות", { age: 10, covers: ["surgery_first_shekel"] });
assert(!!first && first.ok === true && first.monthlyPremium === 24.36, "first-shekel 0–20 indexed to ₪24.36");

const kept = quote("הכשרה", "בריאות", { age: 10, covers: ["surgery_shaban_5000", "ambulatory_consults", "child_premium"] });
assert(!!kept && kept.ok === true, "kept 2023 covers quote ok");
assert(kept.baseMonthlyPremium === 55.03, "kept covers book base 14.09+10.44+30.50 = ₪55.03");
assert(kept.monthlyPremium === 61.08, "kept covers indexed 15.64+11.59+33.85 = ₪61.08");

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
assert(after.baseMonthlyPremium === 3.1, "health quote keeps Excel base before CPI");
assert(riskQuote.baseMonthlyPremium == null, "risk quote has no separate base-before-CPI field");
assert(mortQuote.baseMonthlyPremium == null, "mortgage quote has no separate base-before-CPI field");
assert(ciQuote.baseMonthlyPremium == null, "CI quote has no separate base-before-CPI field");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
