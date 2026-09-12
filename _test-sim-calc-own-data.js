/* GI-SIM-CALC-OWN-DATA 2026-09-12
   סימולטור: חישוב/הוספה לפי נתוני כל מבוטח; סנכרון גיל לפני calc.
   הרצה: node _test-sim-calc-own-data.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260912-sim-prem-edit-v1";
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

function extractFn(src, fnName){
  const start = src.indexOf("function " + fnName + "(");
  if(start < 0) return null;
  let i = start + ("function " + fnName).length;
  let paren = 0;
  let seenParen = false;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "("){ paren++; seenParen = true; }
    else if(ch === ")"){ paren--; }
    else if(ch === "{" && seenParen && paren === 0) break;
  }
  if(i >= src.length || src[i] !== "{") return null;
  let depth = 0;
  for(; i < src.length; i++){
    if(src[i] === "{") depth++;
    else if(src[i] === "}"){
      depth--;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

const sims = read("gi-simulators.js");
const wiz = read("gi-wizard.js");
const app = read("app.js");

console.log("1) markers + syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(sims.includes("GI-SIM-CALC-OWN-DATA"), "simulator own-data marker");
assert(sims.includes("function riskSimEnsureCalcForInsured(sim, insId)"), "ensure-calc helper");
assert(sims.includes("function riskSimFlushActiveDomFields(sim)"), "flush active DOM before calc");
assert(sims.includes("riskSimEnsureCalcForInsured(sim, id)"), "purchase auto-calcs targets");
assert(sims.includes("pickMap[activeId] = { company: curCo, product: curPr }"), "active pick synced to open product");
assert(sims.includes("GI-MULTI-SELECT-ADD-ALL"), "multi-select add-all marker");
assert(sims.includes("function riskSimEnsureInsuredState(sim, insId)"), "ensure state for couple members");
assert(sims.includes("function riskSimSyncCouplePicksToOpenProduct(sim)"), "quiet couple pick sync");
assert(sims.includes("שיוך שקט למוצר הפתוח"), "checkbox assigns pick without reopen");
assert(wiz.includes("want.map((id) => ready.find((e) => e.insId === id)).filter(Boolean)"), "wizard keeps ready multi-select rows");

assert(sims.includes("try { riskSimFlushActiveDomFields(sim); } catch(_eFlushCalc) {}"), "shell calc flushes DOM first");
assert(wiz.includes("fromPickSwitch: true"), "pick-switch reopen keeps the chosen pick");
assert(wiz.includes("if(!opts.fromPickSwitch)"), "draft open binds active pick to draft company/product");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + TAG + '"'), "simulator cache tag bumped");

console.log("\n2) risk _calc syncs age before tariff lookup");
["PHOENIX_RISK", "MENORA_RISK", "HACHSHARA_RISK", "HACHSHARA_MORT_RISK", "PHOENIX_MORTGAGE_RISK"].forEach((prefix) => {
  assert(
    sims.includes("riskSimAgeSyncErrorMessage(" + prefix + "_SIM_MISSING_MESSAGES, ageSync)"),
    prefix + " _calc reports age-sync errors"
  );
});
assert(sims.includes("const ageSync = this._syncAge(st);"), "_calc calls _syncAge before premium math");
assert(sims.includes("return riskSimSyncAgeFromBirthDate(st, { minAge: PHOENIX_RISK_MIN_AGE"), "phoenix has _syncAge");
assert(sims.includes("return riskSimSyncAgeFromBirthDate(st, { minAge: MENORA_RISK_MIN_AGE"), "menora has _syncAge");
assert(sims.includes('מלאו את כל השדות וחשבו פרמיה למבוטח זה לפני ההוספה להצעה.'), "purchase toast explains missing calc");

console.log("\n3) runtime — same tables, different insured params => different premiums");
const ctx = { console, Map, Math, Number, String, Date, Object, Array, isFinite };
vm.createContext(ctx);
const tableStart = sims.indexOf("const PHOENIX_RISK_RATE_TABLE = [");
const tableEnd = sims.indexOf("];", tableStart) + 2;
const mapStart = sims.indexOf("const PHOENIX_RISK_RATE_MAP", tableStart);
const mapEnd = sims.indexOf(");", mapStart) + 2;
assert(tableStart >= 0 && mapStart >= 0, "phoenix rate table present");
vm.runInContext(sims.slice(tableStart, tableEnd) + "\n" + sims.slice(mapStart, mapEnd), ctx);
const lookupSrc = extractFn(sims, "lookupPhoenixRiskRate");
const computeSrc = extractFn(sims, "computePhoenixRiskPremium");
assert(!!lookupSrc && !!computeSrc, "extracted phoenix premium helpers");
vm.runInContext(lookupSrc + "\n" + computeSrc, ctx);

const young = ctx.computePhoenixRiskPremium({ age: 30, gender: "זכר", smoker: false, sumInsured: 1000000 });
const older = ctx.computePhoenixRiskPremium({ age: 50, gender: "זכר", smoker: false, sumInsured: 1000000 });
const smoker = ctx.computePhoenixRiskPremium({ age: 30, gender: "זכר", smoker: true, sumInsured: 1000000 });
assert(young.ok && older.ok && smoker.ok, "tariff lookup succeeds for each insured profile");
assert(young.monthlyPremium !== older.monthlyPremium, "premiums differ by insured age — not a shared guess");
assert(older.monthlyPremium > young.monthlyPremium, "older insured costs more on the same sum/gender/smoker");
assert(smoker.monthlyPremium > young.monthlyPremium, "smoker premium differs from non-smoker on the same age/sum");

console.log("\n" + (failed ? ("FAILED " + failed + " (passed " + passed + ")") : ("OK " + passed + "/" + passed)));
process.exit(failed ? 1 : 0);
