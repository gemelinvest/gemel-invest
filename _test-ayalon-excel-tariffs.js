/* GI-AYALON-TARIFFS 2026-11-05
   דרור 1, דרור למשכנתא, והתפתחות פרמיה של בריאות / חוסן / סרטן.
   הרצה: node _test-ayalon-excel-tariffs.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
let failed = 0;
let passed = 0;
function assert(cond, msg){
  if(cond){ passed += 1; console.log("  PASS  " + msg); }
  else { failed += 1; console.error("  FAIL  " + msg); }
}
function read(name){ return fs.readFileSync(path.join(ROOT, name), "utf8"); }
const app = read("app.js");
const sims = read("gi-simulators.js");
const arrival = read("gi-arrival-docs.js");

console.log("1) syntax and Ayalon-only wiring");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=20261007-np-health-buy-v1"'), "simulator cache prefix stays");
assert(app.includes("&giAyalonTariff=1"), "Ayalon tariff cache flag");
assert(app.includes('{ company: "איילון", product: "ריסק" }'), "catalog lists איילון × ריסק");
assert(app.includes('{ company: "איילון", product: "ריסק משכנתא" }'), "catalog lists איילון × ריסק משכנתא");
assert(sims.includes('RiskSimulators.register("איילון", "ריסק", AyalonRiskSimulator)'), "registers דרור 1");
assert(sims.includes('RiskSimulators.register("איילון", "ריסק משכנתא", AyalonMortgageRiskSimulator)'), "registers דרור למשכנתא");
assert(sims.includes("[data-ayllife-close]"), "shell close prefix includes the new simulator");
assert(fs.existsSync(path.join(ROOT, "ayalon-life-sim.css")), "life CSS exists");
assert(app.includes("ayalon-life-sim.css?v=20261105-ayalon-tariff-v1"), "app loads the life CSS");
assert(!read("ayalon-life-sim.css").includes("lcClalRisk"), "life CSS does not keep the Clal prefix");
assert(arrival.includes('return company === "איילון" ? 85 : 79;'), "premium report cap is 85 only for Ayalon");
assert(arrival.includes("const cap = maxAgeFor(family, company);"), "cap receives the company");

function extractTable(name){
  const marker = "const " + name + " = ";
  const start = sims.indexOf(marker + "[");
  const end = start < 0 ? -1 : sims.indexOf("\n  ];", start);
  assert(start >= 0 && end > start, name + " extractable");
  if(start < 0 || end < 0) return [];
  return Function("return (" + sims.slice(start + marker.length, end + "\n  ]".length) + ")")();
}
const EXPECTED_RISK = [
    [20, 0.72, 1.02, 0.37, 0.53],
    [21, 0.72, 1.02, 0.37, 0.53],
    [22, 0.72, 1.01, 0.37, 0.53],
    [23, 0.72, 0.99, 0.37, 0.53],
    [24, 0.72, 0.99, 0.37, 0.53],
    [25, 0.72, 0.98, 0.37, 0.54],
    [26, 0.71, 0.97, 0.37, 0.55],
    [27, 0.7, 0.96, 0.37, 0.56],
    [28, 0.71, 0.96, 0.37, 0.58],
    [29, 0.72, 0.95, 0.37, 0.6],
    [30, 0.72, 0.94, 0.37, 0.62],
    [31, 0.72, 0.98, 0.37, 0.65],
    [32, 0.72, 1.02, 0.37, 0.69],
    [33, 0.72, 1.05, 0.41, 0.73],
    [34, 0.72, 1.09, 0.46, 0.78],
    [35, 0.72, 1.12, 0.51, 0.83],
    [36, 0.72, 1.23, 0.55, 0.9],
    [37, 0.72, 1.31, 0.57, 0.97],
    [38, 0.72, 1.43, 0.61, 1.03],
    [39, 0.8, 1.54, 0.66, 1.1],
    [40, 0.83, 1.67, 0.67, 1.1],
    [41, 0.91, 1.85, 0.75, 1.22],
    [42, 1.0, 2.03, 0.87, 1.39],
    [43, 1.11, 2.23, 0.96, 1.59],
    [44, 1.21, 2.42, 1.04, 1.8],
    [45, 1.33, 2.66, 1.13, 2.05],
    [46, 1.48, 2.93, 1.23, 2.25],
    [47, 1.64, 3.23, 1.34, 2.52],
    [48, 1.82, 3.56, 1.47, 2.84],
    [49, 2.07, 4.03, 1.61, 3.19],
    [50, 2.31, 4.53, 1.77, 3.59],
    [51, 2.55, 5.05, 1.95, 4.05],
    [52, 2.83, 5.58, 2.15, 4.22],
    [53, 3.14, 6.13, 2.38, 4.55],
    [54, 3.5, 6.71, 2.64, 5.04],
    [55, 3.9, 7.42, 2.92, 5.64],
    [56, 4.36, 8.16, 3.23, 6.29],
    [57, 4.87, 9.03, 3.53, 6.82],
    [58, 5.45, 10.05, 3.87, 7.33],
    [59, 6.13, 11.48, 4.26, 8.05],
    [60, 6.88, 12.99, 4.69, 9.2],
    [61, 7.74, 14.8, 5.14, 10.54],
    [62, 8.7, 16.82, 5.66, 12.16],
    [63, 9.8, 18.82, 6.21, 13.9],
    [64, 11.04, 20.84, 6.83, 15.56],
    [65, 12.45, 23.14, 7.49, 17.13],
    [66, 14.05, 25.93, 8.46, 18.56],
    [67, 15.85, 29.24, 9.57, 20.12],
    [68, 17.89, 32.47, 10.81, 22.12],
    [69, 20.21, 35.46, 12.22, 24.36],
    [70, 22.36, 38.35, 13.8, 27.31],
    [71, 25.29, 43.48, 15.61, 30.91],
    [72, 28.79, 49.62, 18.02, 35.18],
    [73, 32.9, 57.19, 21.14, 39.38],
    [74, 34.88, 64.52, 22.71, 43.44],
    [75, 37.11, 70.53, 23.99, 47.0],
    [76, 44.47, 77.34, 32.99, 51.01],
    [77, 48.21, 84.03, 35.67, 55.29],
    [78, 52.54, 91.8, 39.03, 60.63],
    [79, 57.24, 100.24, 43.83, 68.22],
    [80, 62.36, 109.46, 49.36, 77.01],
    [81, 67.71, 119.12, 55.51, 86.8],
    [82, 74.41, 131.2, 62.69, 98.24],
    [83, 83.75, 148.03, 70.75, 111.13],
    [84, 94.93, 168.16, 79.43, 125.04],
    [85, 185.25, 261.38, 109.65, 210.17]
  ];
const EXPECTED_MORT = [
    [20, 0.72, 1.05, 0.37, 0.56],
    [21, 0.72, 1.05, 0.37, 0.56],
    [22, 0.72, 1.05, 0.37, 0.56],
    [23, 0.72, 1.05, 0.37, 0.56],
    [24, 0.72, 1.05, 0.37, 0.57],
    [25, 0.72, 1.05, 0.37, 0.57],
    [26, 0.72, 1.05, 0.37, 0.58],
    [27, 0.72, 1.05, 0.37, 0.59],
    [28, 0.72, 1.05, 0.37, 0.6],
    [29, 0.72, 1.05, 0.37, 0.62],
    [30, 0.72, 1.05, 0.37, 0.64],
    [31, 0.72, 1.05, 0.37, 0.67],
    [32, 0.72, 1.09, 0.37, 0.7],
    [33, 0.72, 1.12, 0.41, 0.74],
    [34, 0.72, 1.16, 0.46, 0.78],
    [35, 0.72, 1.2, 0.51, 0.83],
    [36, 0.72, 1.24, 0.55, 0.9],
    [37, 0.72, 1.31, 0.57, 0.97],
    [38, 0.72, 1.39, 0.61, 1.0],
    [39, 0.8, 1.49, 0.66, 1.0],
    [40, 0.83, 1.59, 0.67, 1.05],
    [41, 0.91, 1.71, 0.73, 1.17],
    [42, 1.0, 1.84, 0.78, 1.29],
    [43, 1.09, 2.0, 0.84, 1.43],
    [44, 1.17, 2.18, 0.9, 1.58],
    [45, 1.27, 2.4, 0.98, 1.78],
    [46, 1.38, 2.65, 1.07, 2.0],
    [47, 1.51, 2.94, 1.17, 2.24],
    [48, 1.65, 3.28, 1.28, 2.53],
    [49, 1.82, 3.66, 1.4, 2.85],
    [50, 2.01, 4.08, 1.54, 3.47],
    [51, 2.22, 4.57, 1.7, 3.63],
    [52, 2.46, 5.12, 1.87, 4.08],
    [53, 2.73, 5.75, 2.07, 4.56],
    [54, 3.05, 6.46, 2.3, 5.04],
    [55, 3.39, 7.27, 2.54, 5.64],
    [56, 3.79, 8.16, 2.83, 6.29],
    [57, 4.24, 9.03, 3.14, 6.82],
    [58, 4.75, 10.05, 3.5, 7.32],
    [59, 5.33, 11.48, 3.9, 8.05],
    [60, 5.99, 12.99, 4.33, 9.19],
    [61, 6.73, 14.76, 4.82, 10.54],
    [62, 7.57, 16.59, 5.38, 12.16],
    [63, 8.53, 18.62, 6.0, 13.9],
    [64, 9.6, 20.84, 6.69, 15.56],
    [65, 10.83, 23.14, 7.47, 17.12],
    [66, 12.22, 25.93, 8.35, 18.56],
    [67, 13.79, 29.24, 9.34, 20.12],
    [68, 15.56, 32.47, 10.45, 22.13],
    [69, 17.58, 35.46, 11.69, 24.36],
    [70, 19.85, 38.35, 13.09, 27.3],
    [71, 22.43, 43.48, 14.66, 30.91],
    [72, 25.33, 49.62, 16.42, 35.18],
    [73, 28.62, 55.53, 18.4, 39.38],
    [74, 30.35, 58.99, 19.76, 43.44],
    [75, 32.29, 61.36, 20.87, 47.0],
    [76, 36.47, 67.65, 23.4, 51.01],
    [77, 41.19, 74.45, 26.24, 55.29],
    [78, 46.52, 81.8, 29.42, 60.63],
    [79, 52.51, 89.71, 32.99, 68.23],
    [80, 59.26, 98.18, 36.99, 77.01],
    [81, 67.71, 119.12, 45.8, 86.8],
    [82, 74.41, 130.49, 51.37, 98.25],
    [83, 83.75, 142.14, 57.67, 111.13],
    [84, 94.93, 155.7, 64.78, 125.04],
    [85, 106.7, 171.19, 73.21, 139.78]
  ];
console.log("\n2) life tables match the 10.08.2026 books");
const riskTable = extractTable("AYALON_RISK_RATE_TABLE");
const mortTable = extractTable("AYALON_MORT_RATE_TABLE");
assert(JSON.stringify(riskTable) === JSON.stringify(EXPECTED_RISK), "דרור 1 table matches the workbook, cell for cell");
assert(JSON.stringify(mortTable) === JSON.stringify(EXPECTED_MORT), "דרור למשכנתא table matches the workbook, cell for cell");
assert(riskTable.length === 66 && riskTable[0][0] === 20 && riskTable[65][0] === 85, "דרור 1 ages 20–85");
assert(mortTable.length === 66 && mortTable[0][0] === 20 && mortTable[65][0] === 85, "דרור למשכנתא ages 20–85");
assert(!sims.includes("שעור פרמיה נטו") || sims.includes("שעור פרמיה נטו לא נכנס לחישוב"), "net rate is not a pricing input");

console.log("\n3) runtime quotes");
const sandbox = {
  console, Date, Math, Number, String, Array, Object, JSON, parseInt, isNaN, Infinity,
  window: {
    localStorage: { getItem(){ return null; }, setItem(){} },
    addEventListener(){},
    document: { createElement(){ return { style:{}, setAttribute(){}, addEventListener(){} }; }, getElementById(){ return null; }, querySelector(){ return null; }, querySelectorAll(){ return []; }, body: { appendChild(){} } }
  }
};
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.window = sandbox.window;
sandbox.__GI_SIM_HOST = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  escapeHtml(s){ return String(s == null ? "" : s); },
  on(){}, $(){ return null; }, $$(){ return []; },
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
const quote = sandbox.GiSimulatorQuotes.quote;
function agorot(n){ return Math.round(Number(n) * 100); }
const risk40 = quote("איילון", "ריסק", { age: 40, gender: "זכר", smoker: true, sumInsured: 1000000 });
assert(risk40 && risk40.ok === true, "דרור 1 quote ok");
assert(agorot(risk40.monthlyPremium) === 13917, "גבר מעשן בן 40, מיליון ₪, דרור 1 = ₪139.17");
assert(agorot(risk40.annualPremium) === 167000, "same quote annual ₪1,670");
const mort40 = quote("איילון", "ריסק משכנתא", { age: 40, gender: "זכר", smoker: true, sumInsured: 1000000 });
assert(mort40 && mort40.ok === true && agorot(mort40.monthlyPremium) === 13250, "אותו מבוטח בדרור למשכנתא = ₪132.50");
const risk41 = quote("איילון", "ריסק", { age: 41, gender: "זכר", smoker: true, sumInsured: 1000000 });
assert(risk41 && risk41.ok === true && agorot(risk41.monthlyPremium) === 15417, "גיל 41 uses the age-41 row 1.85, not the entry row");
assert(quote("איילון", "ריסק", { age: 19, gender: "זכר", smoker: false, sumInsured: 500000 }).ok === false, "age 19 blocked");
assert(quote("איילון", "ריסק", { age: 86, gender: "נקבה", smoker: true, sumInsured: 500000 }).ok === false, "age 86 blocked");
assert(quote("איילון", "ריסק משכנתא", { age: 20, gender: "נקבה", smoker: false, sumInsured: 1000 }).ok === true, "age 20 female nonsmoker mortgage prices");
const other = quote("הכשרה", "ריסק", { age: 40, gender: "זכר", smoker: false, sumInsured: 1000000 });
assert(other && other.ok === true && other.monthlyPremium === 86.67, "הכשרה risk quote is unchanged");

const discs = sandbox.GiSimulatorDiscounts.list("איילון", "ריסק").map((o) => o.id);
assert(JSON.stringify(discs) === JSON.stringify(["ayl-r-56095","ayl-r-1373","ayl-r-19993","ayl-r-60094"]), "דרור 1 discount packages only");
assert(sandbox.GiSimulatorDiscounts.list("איילון", "ריסק משכנתא").length === 6, "mortgage discounts stay the existing six");
assert(sandbox.GiSimulatorDiscounts.list("מנורה", "ריסק").length > 0, "other company discounts untouched");

console.log("\n4) health and hoshen cells from the development workbook");
const coversMatch = sims.match(/const AYALON_HEALTH_COVERS = (\[[\s\S]*?\n  \]);/);
assert(!!coversMatch, "health covers extractable");
const covers = Function("return (" + coversMatch[1] + ")")();
const byId = Object.fromEntries(covers.map((c) => [c.id, c]));
const EXPECTED_BANDS = {"transplant":[[0,20,1038],[21,30,1654],[31,40,1821],[41,50,2252],[51,55,2459],[56,60,2732],[61,65,3098],[66,120,3162]],"drugs":[[0,20,1323],[21,30,1833],[31,40,2580],[41,50,4194],[51,55,6073],[56,60,8050],[61,65,10841],[66,120,14398]],"abroad_surgery":[[0,20,666],[21,30,625],[31,40,1072],[41,50,1320],[51,55,2183],[56,60,2676],[61,65,3050],[66,120,3135]],"surgery_first_shekel":[[0,20,4554],[21,30,9865],[31,40,12759],[41,50,19961],[51,55,29929],[56,60,39114],[61,65,47187],[66,120,62491]],"surgery_shaban":[[0,20,1906],[21,30,3588],[31,40,6281],[41,50,8707],[51,55,13904],[56,60,16935],[61,65,22411],[66,120,28999]],"surgery_shaban_5000":[[0,20,1486],[21,30,2799],[31,40,4900],[41,50,6792],[51,55,10845],[56,60,13209],[61,65,17481],[66,120,22620]],"ambulatory_consults":[[0,17,1672],[18,30,4577],[31,55,5664],[56,64,6120],[65,75,8226],[76,120,9568]],"ambulatory_treatments":[[0,17,186],[18,30,508],[31,55,630],[56,64,680],[65,75,914],[76,120,1063]],"fast_diagnosis":[[0,20,408],[21,120,1876]],"tech_devices":[[0,20,726],[21,30,1323],[31,35,1368],[36,40,1500],[41,45,1687],[46,50,1971],[51,55,2271],[56,60,2897],[61,65,3552],[66,120,4716]],"child_dev":[[0,21,2640]],"complementary":[[0,25,977],[26,70,1725],[71,75,1832]],"online":[[0,75,1945]],"home":[[0,20,1739],[21,69,2826]],"sports":[[0,20,1152],[21,69,1806]],"crisis_bar_gefen":[[0,20,577],[21,55,1153],[56,65,2307],[66,120,2884]]};
Object.keys(EXPECTED_BANDS).forEach((id) => {
  const got = (byId[id].bands || []).map((b) => [b.min, b.max, b.agorot]);
  assert(JSON.stringify(got) === JSON.stringify(EXPECTED_BANDS[id]), id + " bands match the workbook");
});
assert(byId.ambulatory_consults.baseIndexPoints == null, "ייעוץ ובדיקות uses the 142.34 default index");
assert(byId.ambulatory_extended.baseIndexPoints === 145.56, "אמבולטורי מורחב stays on 145.56");
assert(JSON.stringify(byId.ambulatory_extended.bands.map((b) => b.agorot)) === JSON.stringify([2880,7300,8030,8210,11800,14410]), "אמבולטורי מורחב bands unchanged");
const abroad = quote("איילון", "בריאות", { age: 25, covers: ["abroad_surgery"] });
assert(abroad && abroad.ok === true && abroad.baseMonthlyPremium === 6.25, "ניתוחים בחו״ל age 25 book premium is ₪6.25");
const ciMap = Function("return (" + sims.match(/const AYALON_CI_RATE_MAPS = (\{.*?\});/)[1] + ")")();
assert(JSON.stringify(ciMap.hoshen["48"]) === JSON.stringify({mNS:143,mS:268,fNS:143,fS:172}), "hoshen age 48 columns");
assert(ciMap.hoshen["64"].mNS === 690, "hoshen age 64 male nonsmoker ₪6.90");
assert(ciMap.hoshenCancer["28"].fNS === 198, "cancer age 28 female nonsmoker ₪1.98");
assert(ciMap.hoshenCancer["46"].fNS === 1014, "cancer age 46 female nonsmoker ₪10.14");
assert(ciMap.hoshenCancer["56"].mNS === 1753, "cancer age 56 male nonsmoker ₪17.53");
const ci48 = quote("איילון", "מחלות קשות", { age: 48, gender: "זכר", smoker: false, compensation: 50000 });
assert(ci48 && ci48.ok === true && ci48.monthlyPremium === 71.5, "hoshen age 48 male nonsmoker, ₪50,000 = ₪71.50");
const ca56 = quote("איילון", "סרטן", { age: 56, gender: "זכר", smoker: false, compensation: 50000 });
assert(ca56 && ca56.ok === true && ca56.monthlyPremium === 87.65, "cancer age 56 male nonsmoker, ₪50,000 = ₪87.65");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
