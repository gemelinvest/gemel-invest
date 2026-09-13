/* GI-SIM-MANUAL-DISC 2026-09-08
   לחצן «הנחה ידנית» בסימולטור ליד «הנחה», קלט כמו הנחה חריגה באשף,
   שמירה להצעה עם לוח שנתי ופרמיה אחרי הנחה לפי אחוז שנה-1.
   הרצה: node _test-sim-manual-discount.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260913-ayalon-health-decl-v2";
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

function sliceBetween(src, startToken, endToken){
  const start = src.indexOf(startToken);
  const end = src.indexOf(endToken, start + startToken.length);
  if(start < 0 || end < 0) return "";
  return src.slice(start, end);
}

function safeTrim(v){ return String(v == null ? "" : v).trim(); }

const wiz = read("gi-wizard.js");
const sims = read("gi-simulators.js");
const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");
const shell = read("simulators-shell.css");

console.log("1) syntax + cache tag unchanged");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(html.includes("app.js?v=" + TAG), "index app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + TAG + '"'), "simulator chunk cache");
assert(app.includes("simulators-shell.css?v=" + TAG), "shell css cache");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build tag");

console.log("\n2) simulator UI: manual button next to catalog הנחה");
assert(sims.includes('data-gisim-disc-manual-toggle'), "manual toggle attribute");
assert(sims.includes('data-gisim-disc-manual-input'), "manual percent input");
assert(sims.includes('data-gisim-disc-toggle="1"'), "catalog הנחה toggle remains");
assert(sims.includes("הנחה ידנית"), "manual button label");
assert(sims.includes("GI-SIM-MANUAL-DISC"), "manual discount marker");
assert(shell.includes(".giSimDisc__manualInput"), "manual input styles");
assert(shell.includes(".giSimDisc__btn--manual"), "manual button class");
assert(!/function giSimDiscountInjectDom\(sim\)\{[\s\S]{0,500}if\(!opts\.length\) return;/.test(sims), "empty catalog still injects the manual control");
assert(sims.includes("giSimDiscountSetManual(sim, formatted)"), "typing applies the manual schedule without waiting for catalog");
const inputBind = sliceBetween(sims, 'on(modal, "input", (ev) => {', "function giSimDiscountInstallChrome");
assert(inputBind.includes("giSimDiscountSetManual"), "input handler writes the schedule");
assert(inputBind.includes("giSimDiscountRefreshLive"), "input handler refreshes after-premium in place");
assert(!inputBind.includes("sim._render"), "typing does not _render (would steal focus)");

console.log("\n3) same year-split engine as wizard exception");
assert(sims.includes("function giSimFormatManualDiscountInput(value, prevValue){"), "simulator copies the exception formatter");
assert(sims.includes("function giSimParseManualDiscountSchedule(raw){"), "simulator copies the exception parser");
const wizFmt = sliceBetween(wiz, "formatExceptionDiscountInput(value, prevValue){", "parseExceptionDiscountSchedule(raw){");
const simFmt = sliceBetween(sims, "function giSimFormatManualDiscountInput(value, prevValue){", "function giSimParseManualDiscountSchedule(raw){");
assert(wizFmt.includes('if(lastSeg.length === 2 && !isDeleting) out += "/";'), "wizard inserts / after two digits");
assert(simFmt.includes('if(lastSeg.length === 2 && !isDeleting) out += "/";'), "simulator inserts / after two digits");

const formatFn = new Function(
  sliceBetween(sims, "function giSimFormatManualDiscountInput(value, prevValue){", "function giSimParseManualDiscountSchedule(raw){")
  + "\nreturn giSimFormatManualDiscountInput;"
)();
assert(formatFn("706560", "") === "70/65/60/", "70 65 60 becomes 70/65/60/");
assert(formatFn("70", "") === "70/", "two digits get a trailing slash");
assert(formatFn("7", "") === "7", "a single digit is left as-is");
assert(formatFn("70/6", "70/65") === "70/6", "deleting a digit does not force a new slash");

const parseFn = new Function(
  "safeTrim",
  sliceBetween(sims, "function giSimParseManualDiscountSchedule(raw){", "function giSimManualScheduleNumbers(schedule){")
  + "\nreturn giSimParseManualDiscountSchedule;"
)(safeTrim);
const parsed = parseFn("70/65/60/");
assert(Array.isArray(parsed) && parsed.length === 3, "parse yields three years");
assert(parsed[0].year === 1 && parsed[0].pct === 70, "year 1 is 70%");
assert(parsed[1].year === 2 && parsed[1].pct === 65, "year 2 is 65%");
assert(parsed[2].year === 3 && parsed[2].pct === 60, "year 3 is 60%");
assert(parseFn("40").length === 1 && parseFn("40")[0].pct === 40, "a single number is year-1 only");
assert(parseFn("").length === 0, "empty input is not a schedule");

console.log("\n4) payload to the proposal replaces catalog and uses year-1 after-premium");
assert(sims.includes("giSimDiscountActiveOption(sim, insId, company, product)"), "payload reads the active catalog-or-manual option");
assert(sims.includes("manualException: !!opt.manualException"), "payload marks a typed exception");
assert(sims.includes('id: GI_SIM_MANUAL_DISCOUNT_ID'), "synthetic option id");
assert(sims.includes('const GI_SIM_MANUAL_DISCOUNT_ID = "gi-sim-manual"'), "stable manual id");
assert(/function giSimDiscountSetSelected\(sim, optionId\)\{[\s\S]{0,420}delete sim\._giSimManualByInsured\[active\]/.test(sims), "picking a catalog option clears the typed schedule");
assert(/function giSimDiscountSetManual\(sim, raw\)\{[\s\S]{0,1600}sim\._giSimDiscountSel\[active\] = GI_SIM_MANUAL_DISCOUNT_ID/.test(sims), "typing a schedule replaces the catalog selection");
assert(sims.includes("function giSimManualAfterMonthly(result, opt){"), "manual after uses year-1 percent, not catalog cover maps");
assert(sims.includes("if(opt.manualException){"), "payload/UI branch for typed exception");
{
  const moneySrc = sliceBetween(sims, "function giSimMoneyAfterPct(shekels, pct){", "function giSimCoverDiscountPct(opt, coverId){");
  const yearSrc = sliceBetween(sims, "function giSimDiscountYear1Pct(opt){", "function giSimMoneyAfterPct(shekels, pct){");
  const coverAgSrc = sliceBetween(sims, "function giSimCoverMonthlyAgorot(cover){", "function giSimDiscountAfterMonthly(result, opt){");
  const manAfterSrc = sliceBetween(sims, "function giSimManualAfterMonthly(result, opt){", "function giSimDiscountResolvedAfter(result, opt, company, product){");
  const afterFn = new Function(
    moneySrc + yearSrc + coverAgSrc + manAfterSrc + "\nreturn giSimManualAfterMonthly;"
  )();
  assert(afterFn({ ok:true, monthlyPremium:100 }, { schedule:[70,65,60], pct:70 }) === 30, "100₪ with 70% year-1 becomes 30₪");
  assert(afterFn({
    ok:true,
    covers:[{ monthlyPremium:80 }, { monthlyPremium:20 }]
  }, { schedule:[70], pct:70 }) === 30, "health cover total 100₪ with 70% also becomes 30₪");
}
assert(/getPolicyPremiumAfterDiscount\(policy\)\{[\s\S]{0,320}return this\.getPolicyPremiumBeforeDiscount\(policy\);/.test(wiz), "global after-discount engine still identity");

{
  const fromRecSrc = sliceBetween(sims, "function giSimManualScheduleNumbers(schedule){", "function giSimDiscountManualRec(sim, insId){");
  const bundle = new Function(
    "safeTrim",
    "GI_SIM_MANUAL_DISCOUNT_ID",
    fromRecSrc + "\nreturn { giSimManualScheduleNumbers, giSimManualOptionFromRec };"
  )(safeTrim, "gi-sim-manual");
  const opt = bundle.giSimManualOptionFromRec({
    raw: "70/65/60/",
    schedule: [{ year: 1, pct: 70 }, { year: 2, pct: 65 }, { year: 3, pct: 60 }]
  });
  assert(opt && opt.id === "gi-sim-manual", "synthetic option id is gi-sim-manual");
  assert(opt.manualException === true && opt.isException === true, "option is a manual exception");
  assert(opt.pct === 70 && opt.schedule[0] === 70, "year-1 percent is the first typed number");
  assert(opt.schedule.join("/") === "70/65/60", "payload schedule is the typed years");
  assert(opt.label.indexOf("70%") >= 0 && opt.label.indexOf("65%") >= 0, "label lists the yearly percents");
}

console.log("\n5) multi-select keeps typed discount per insured + session restore");
{
  const start = sims.indexOf("function riskSimCopyCoupleDiscountFromId(sim, sourceId){");
  const end = sims.indexOf("function riskSimCopyCoupleDiscountFromSeed(sim){", start);
  const fnSrc = sims.slice(start, end);
  const fn = new Function(
    "safeTrim",
    "riskSimAllowsCouplePolicy",
    "riskSimCoupleSelectedIds",
    "riskSimCoupleSeedInsuredId",
    fnSrc + "\nreturn riskSimCopyCoupleDiscountFromId;"
  );
  const copy = fn(safeTrim, () => true, (sim) => ["i1", "i2"], () => "i1");
  const sim = {
    _giCoupleOn: true,
    _ctx: { wizardWorkspace: true, product: "ריסק" },
    _activeInsuredId: "i1",
    _giSimDiscountSel: { i1: "gi-sim-manual", i2: "own-manual" },
    _giSimManualByInsured: {
      i1: { raw: "70/65/60/", schedule: [{ year: 1, pct: 70 }, { year: 2, pct: 65 }, { year: 3, pct: 60 }] },
      i2: { raw: "50/", schedule: [{ year: 1, pct: 50 }] }
    }
  };
  copy(sim, "i1");
  assert(sim._giSimDiscountSel.i2 === "own-manual", "multi-select does not overwrite secondary manual option");
  assert(sim._giSimManualByInsured.i2 && sim._giSimManualByInsured.i2.schedule[0].pct === 50, "secondary keeps its own year-1 percent");
  assert(sim._giSimManualByInsured.i2.schedule.length === 1, "secondary keeps its own schedule length");
  sim._giSimDiscountSel.i1 = "cll-r-5001";
  delete sim._giSimManualByInsured.i1;
  copy(sim, "i1");
  assert(sim._giSimDiscountSel.i2 === "own-manual", "catalog pick on primary leaves secondary discount alone");
  assert(sim._giSimManualByInsured.i2 && sim._giSimManualByInsured.i2.schedule[0].pct === 50, "catalog pick on primary does not clear secondary typed schedule");
}

assert(sims.includes("function giSimDiscountRestoreMap(sim, restoreDiscount){"), "open restores a typed schedule object");
assert(sims.includes("giSimDiscountRestoreMap(handler, restoreDiscount)"), "open wires restore of manual payloads");
assert(wiz.includes('optId === "gi-sim-manual"'), "wizard restore keeps the manual payload object");
assert(wiz.includes("manualException: true"), "wizard session capture stores a typed exception");
assert(wiz.includes("rec.manualException || optId === \"gi-sim-manual\""), "edit-restore keeps the typed schedule");

{
  const restoreSrc = sliceBetween(sims, "function giSimManualRecFromRestore(v){", "function giSimDiscountRestoreMap(sim, restoreDiscount){");
  const mapSrc = sliceBetween(sims, "function giSimDiscountRestoreMap(sim, restoreDiscount){", "function giSimDiscountSnapshotEntry(sim, insId, result){");
  const parseSrc = sliceBetween(sims, "function giSimParseManualDiscountSchedule(raw){", "function giSimManualScheduleNumbers(schedule){");
  const formatSrc = sliceBetween(sims, "function giSimFormatManualDiscountInput(value, prevValue){", "function giSimParseManualDiscountSchedule(raw){");
  const restore = new Function(
    "safeTrim",
    "GI_SIM_MANUAL_DISCOUNT_ID",
    formatSrc + parseSrc + restoreSrc + mapSrc + "\nreturn giSimDiscountRestoreMap;"
  )(safeTrim, "gi-sim-manual");
  const sim = {};
  restore(sim, {
    i1: {
      optionId: "gi-sim-manual",
      manualException: true,
      raw: "70/65/60/",
      schedule: [70, 65, 60],
      year1Pct: 70
    }
  });
  assert(sim._giSimDiscountSel.i1 === "gi-sim-manual", "restore writes the synthetic id");
  assert(sim._giSimManualByInsured.i1.schedule[0].pct === 70, "restore rebuilds year 1 from the payload");
  assert(sim._giSimManualByInsured.i1.schedule[1].pct === 65, "restore rebuilds year 2 from the payload");
}

console.log("\n6) not the health-row per-cover chip");
assert(!sims.includes("+ הנחה ידנית"), "simulator control is not the summary-row cover chip");
assert(wiz.includes("+ הנחה ידנית"), "the existing health-row chip is untouched");

if(failed){
  console.error("\nFAILED " + failed + "/" + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
