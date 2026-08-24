/* GI-HACH-MORT-RISK-SIM 2026-08-16 — הכשרה ריסק משכנתא
   הרצה: node _test-hachshara-mortgage-risk.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const sims = fs.readFileSync(path.join(ROOT, "gi-simulators.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "hachshara-mortgage-risk-sim.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) files + syntax");
const syntax = spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")], { encoding: "utf8" });
assert(syntax.status === 0, "node --check gi-simulators.js");
if(syntax.status !== 0) console.error(syntax.stderr || syntax.stdout);
assert(fs.existsSync(path.join(ROOT, "hachshara-mortgage-risk-sim.css")), "mortgage CSS exists");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=20260824-official-he-bold-v1"'), "app.js loads bumped simulators chunk");
assert(app.includes('{ company: "הכשרה", product: "ריסק משכנתא" }'), "catalog lists הכשרה × ריסק משכנתא");
assert(app.includes("hachshara-mortgage-risk-sim.css?v=20260816-hach-mort-v1"), "app.js loads mortgage CSS");
assert(html.includes("app.js?v=20260824-hach-mort-v1"), "index.html bumps app.js cache");
assert(sw.includes("gi-v12-20260824-hach-mort-v1"), "service worker cache bumped");

console.log("\n2) source-of-truth table from גיליון משכנתא");
assert(sims.includes("GI-HACH-MORT-RISK-SIM"), "mortgage engine block exists");
assert(sims.includes('RiskSimulators.register("הכשרה", "ריסק משכנתא", HachsharaMortRiskSimulator)'), "registers הכשרה × ריסק משכנתא");
assert(sims.includes("[18, 0.75, 1.11, 0.51, 0.7]"), "age 18 annual/1000 row matches the sheet");
assert(sims.includes("[40, 0.96, 1.64, 0.7, 1.15]"), "age 40 annual/1000 row matches the sheet");
assert(sims.includes("[85, 70.29, 121.15, 64.7, 96.8]"), "age 85 annual/1000 row matches the sheet");
assert(!/HACHSHARA_MORT_RISK_RATE_TABLE[\s\S]{0,400}le500k/.test(sims), "mortgage table has no sum-insured brackets");
assert(sims.includes("HACHSHARA_MORT_RISK_MIN_AGE"), "min age constant exists");
assert(sims.includes("computeHachsharaMortRiskPremium"), "premium function exists");
assert(css.includes("lcHachMortModal"), "CSS uses the mortgage prefix");
assert(!css.includes("lcHachRiskModal"), "mortgage CSS does not reuse the regular-risk prefix");

console.log("\n3) premium unit: annual per 1,000 → monthly / 12");
const tableMatch = sims.match(/const HACHSHARA_MORT_RISK_RATE_TABLE = \[([\s\S]*?)\];/);
assert(!!tableMatch, "rate table is extractable");
const table = [];
if(tableMatch){
  const re = /\[(\d+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\]/g;
  let m;
  while((m = re.exec(tableMatch[1]))){
    table.push([Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])]);
  }
}
assert(table.length === 68, "68 entry ages 18–85");
assert(table[0][0] === 18 && table[table.length - 1][0] === 85, "age range is 18–85");
const row40 = table.find((r) => r[0] === 40);
assert(!!row40, "age 40 exists");
if(row40){
  const annual = (Math.round(row40[1] * 100) * 1000000) / 100000;
  const monthly = annual / 12;
  assert(annual === 960, "age 40 male non-smoker × ₪1,000,000 = ₪960 annual");
  assert(Math.abs(monthly - 80) < 1e-9, "same quote = ₪80 monthly");
}

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
