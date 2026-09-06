/* GI-HACH-EXCEL-TARIFFS 2026-09-06
   תעריפי הכשרה מגיליונות «בריאות» ו«מחלות קשות» ב־תעריפים סיכונים.xlsx.
   בריאות: כיסויים חופפים מתעדכנים, בלי הצמדת מדד.
   מחלות קשות: טבלת אגורות חודשית ל־₪100,000.
   ריסק / משכנתא לא משתנים (כבר תאמו את האקסל).
   הרצה: node _test-hachshara-excel-tariffs.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260906-existing-locked-status-v1";
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

console.log("\n2) health engine uses Excel rates, no CPI");
assert(healthBlock.includes("תעריפים סיכונים.xlsx"), "health block cites the xlsx");
assert(!healthBlock.includes("HealthCpi"), "health engine does not call HealthCpi");
assert(!healthBlock.includes("HACHSHARA_HEALTH_CPI_KEY"), "no hachshara health CPI key");
assert(!healthBlock.includes("צמודה למדד"), "health UI does not say CPI-indexed");
assert(healthBlock.includes("סה״כ פרמיה חודשית"), "health UI still shows monthly total");
assert(!healthBlock.includes("id: \"drugs_ext\""), "does not add Excel-only drug rider");
assert(!healthBlock.includes("id: \"transplant_rider\""), "does not add Excel-only transplant rider");

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
Object.keys(EXCEL_HEALTH).forEach((id) => {
  assert(JSON.stringify(bandAgorot(id)) === JSON.stringify(EXCEL_HEALTH[id]), id + " bands match Excel sheet בריאות");
});

assert(JSON.stringify(bandAgorot("surgery_shaban_5000")) === JSON.stringify([1409, 2652, 4643, 6435, 10277, 12517, 16877, 21680]), "משלים שב״ן 5,000 stays on previous tariff");
assert(JSON.stringify(bandAgorot("ambulatory_consults")) === JSON.stringify([1044, 4000, 4000, 4000, 4000, 4575, 4575, 5175]), "ייעוץ ובדיקות stays on previous tariff");
assert(JSON.stringify(bandAgorot("child_premium")) === JSON.stringify([3050]), "שירות פרימיום לילד stays on previous tariff");

function lookupAgorot(coverId, age){
  const bands = byId[coverId]?.bands || [];
  const b = bands.find((x) => age >= x.min && age <= x.max);
  return b ? b.agorot : null;
}
assert(lookupAgorot("drugs", 0) === 310, "drugs age 0 = ₪3.10");
assert(lookupAgorot("drugs", 20) === 310, "drugs age 20 still in 0–20 band");
assert(lookupAgorot("drugs", 21) === 814, "drugs age 21 = ₪8.14");
assert(lookupAgorot("surgery_first_shekel", 10) === 2195, "first-shekel age 10 = ₪21.95");
assert(lookupAgorot("transplant", 70) === 1508, "transplant 66+ = ₪15.08 (יסודי)");
assert(lookupAgorot("surgery_first_shekel", 63) === 17328, "first-shekel 61–65 = ₪173.28 as in Excel");

console.log("\n3) CI map matches Excel sheet מחלות קשות");
assert(ciBlock.includes("תעריפים סיכונים.xlsx") || sims.includes("גיליון «מחלות קשות»"), "CI block cites the xlsx");
const ciMatch = sims.match(/const HACHSHARA_CI_RATE_MAP = (\{.*?\});/);
assert(!!ciMatch, "HACHSHARA_CI_RATE_MAP extractable");
let ciMap = null;
try { ciMap = Function("return (" + ciMatch[1] + ")")(); } catch(e){
  console.error(e);
}
assert(!!ciMap && Object.keys(ciMap).length === 76, "CI map has ages 0–75");
assert(ciMap["43"].mNS === 9360, "age 43 male NS = ₪93.60 (was 102.08)");
assert(ciMap["55"].fS === 33738, "age 55 female S = ₪337.38 (was 377.38)");
assert(ciMap["56"].fS === 36349, "age 56 female S = ₪363.49 (was 364.49)");
assert(ciMap["59"].fS === 44427, "age 59 female S = ₪444.27 (was 444.95)");
assert(ciMap["60"].mS === 105198, "age 60 male S = ₪1,051.98 (was 1,051.83)");
assert(ciMap["61"].fNS === 33456, "age 61 female NS = ₪334.56 (was 344.56)");
assert(ciMap["64"].fS === 54734, "age 64 female S = ₪547.34 (was 547.89)");
assert(JSON.stringify(ciMap["0"]) === JSON.stringify(ciMap["17"]), "ages 0–16 copy age 17");
assert(JSON.stringify(ciMap["16"]) === JSON.stringify(ciMap["17"]), "age 16 copies age 17");
assert(JSON.stringify(ciMap["75"]) === JSON.stringify(ciMap["74"]), "age 75 copies age 74");
assert(ciMap["17"].mNS === 889, "age 17 all-columns ₪8.89");
assert(ciMap["65"].mNS === 105162, "age 65 male NS plateau ₪1,051.62");
assert(ciMap["74"].mNS === 105162, "age 74 male NS same plateau");
const monthly100k = (age, key) => ciMap[String(age)][key] / 100;
assert(monthly100k(43, "mNS") === 93.60, "CI ₪100,000 age 43 male NS monthly 93.60");
assert(Math.round(monthly100k(40, "mNS") * (250000 / 100000) * 100) / 100 === 161.60, "CI ₪250,000 age 40 male NS = 161.60");

console.log("\n4) risk + mortgage tables still present (already matched Excel)");
assert(sims.includes("const HACHSHARA_RISK_RATE_TABLE_LE500K"), "risk ≤500k table exists");
assert(sims.includes("const HACHSHARA_MORT_RISK_RATE_TABLE"), "mortgage table exists");
assert(sims.includes("[18, 0.99, 1.41, 0.72, 0.93]"), "risk age 18 low-bracket matches Excel ריסק");
assert(sims.includes("[18, 0.75, 1.11, 0.51, 0.7]"), "mortgage age 18 matches Excel משכנתא");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
