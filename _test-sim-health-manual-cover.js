/* GI-SIM-HEALTH-MANUAL-COVER 2026-10-07
   בסימולטור בריאות, «הנחה ידנית» פותחת מסך לפי כיסוי + דירוג שנים 1–10.
   ריסק נשאר 70/65/60. בלי שינוי נוסחת פרמיה/KPI. בלי החלפת BUILD/SIM tag.
   הרצה: node _test-sim-health-manual-cover.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const BUILD = "20261007-lead-dup-v1";
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

console.log("1) syntax + cache suffixes keep BUILD/SIM tags");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(app.includes('const BUILD = "' + BUILD + '"'), "BUILD tag stays");
assert(wiz.includes('GI_WIZARD_BUILD = "' + BUILD + '"'), "wizard build tag stays");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + SIM_TAG + '"'), "simulator href keeps SIM tag as prefix");
assert(app.includes('"./gi-simulators.js?v=' + SIM_TAG + '" + "&giHealthMan=1"'), "simulator href adds giHealthMan");
assert(html.includes("app.js?v=" + BUILD), "index.html keeps BUILD");
assert(html.includes("&giHealthMan=1"), "index.html busts app.js for this fix");
assert(app.includes("&giHarManual=1\" + \"&giHealthMan=1\""), "wizard href keeps har-manual and adds giHealthMan");
assert(sw.includes("20261007-lead-dup-v1"), "service-worker keeps BUILD");
assert(sw.includes("health-man-v1"), "service-worker adds health-man-v1");
assert(app.includes("simulators-shell.css?v=20260927-legal-text-v1&giHealthMan=1"), "shell css cache suffix");

console.log("\n2) health simulator opens per-cover screen; risk keeps 70/65/60");
assert(sims.includes("GI-SIM-HEALTH-MANUAL-COVER"), "health manual-cover marker");
assert(sims.includes("function giSimDiscountHealthManualHtml(sim, rec){"), "health panel builder");
assert(sims.includes("הנחה ידנית לפי כיסוי · בריאות"), "per-cover heading in simulator");
assert(sims.includes("data-gisim-disc-cover-pct"), "per-cover percent inputs");
assert(sims.includes("data-gisim-disc-year"), "year grading inputs");
assert(sims.includes("דירוג ההנחה בשנים"), "year grading title in simulator");
assert(sims.includes("הדירוג לא מתחיל רק אחרי הוספה להצעה"), "grading is in-sim, not only after add");
assert(sims.includes('placeholder="70/65/60"'), "non-health still has 70/65/60");
assert(sims.includes("giSimIsHealthProduct(sim)"), "health product gate");
assert(!sims.includes("+ הנחה ידנית"), "simulator control is not the summary-row cover chip");
assert(wiz.includes("+ הנחה ידנית"), "after-add health chip stays");
assert(shell.includes(".giSimDisc__manual--health"), "health panel styles");
assert(shell.includes(".giSimDisc__coverTable"), "per-cover table styles");
assert(shell.includes(".giSimDisc__yearGrid"), "year grid styles");

const injectSrc = sliceBetween(sims, "function giSimDiscountInjectDom(sim){", "function giSimDiscountEnsureDelegation(sim){");
assert(injectSrc.includes("giSimDiscountHealthManualHtml"), "health inject uses per-cover html");
assert(injectSrc.includes('placeholder="70/65/60"'), "non-health inject keeps year-string input");
assert(!injectSrc.includes('placeholder="הזן אחוז"'), "cover row markup lives in the health html helper");

const inputBind = sliceBetween(sims, 'on(modal, "input", (ev) => {', "function giSimDiscountInstallChrome");
assert(inputBind.includes("giSimDiscountWriteHealthManual"), "cover/year typing writes the health rec");
assert(inputBind.includes("giSimDiscountSetManual"), "non-health typing still writes 70/65/60");
assert(inputBind.includes("giSimDiscountRefreshLive"), "typing refreshes after-premium in place");
assert(!inputBind.includes("sim._render"), "typing does not _render (would steal focus)");
assert(injectSrc.includes('data-gisim-disc-cover-pct") != null'), "inject skips rebuild while a cover input is focused");
assert(injectSrc.includes('data-gisim-disc-year") != null'), "inject skips rebuild while a year input is focused");

console.log("\n3) per-cover year-1 after-premium + sparse year grading");
{
  const moneySrc = sliceBetween(sims, "function giSimMoneyAfterPct(shekels, pct){", "function giSimCoverDiscountPct(opt, coverId){");
  const yearSrc = sliceBetween(sims, "function giSimDiscountYear1Pct(opt){", "function giSimMoneyAfterPct(shekels, pct){");
  const coverAgSrc = sliceBetween(sims, "function giSimCoverMonthlyAgorot(cover){", "function giSimDiscountAfterMonthly(result, opt){");
  const manAfterSrc = sliceBetween(sims, "function giSimManualAfterMonthly(result, opt){", "function giSimDiscountResolvedAfter(result, opt, company, product){");
  const afterFn = new Function(
    "safeTrim",
    "function giSimHealthCoverName(cover){ return safeTrim((cover && (cover.wizardKey || cover.label || cover.id)) || \"\"); }\n" +
    moneySrc + yearSrc + coverAgSrc + manAfterSrc + "\nreturn giSimManualAfterMonthly;"
  )(safeTrim);
  assert(afterFn({ ok:true, monthlyPremium:100 }, { schedule:[70,65,60], pct:70 }) === 30, "risk 100₪ with 70% year-1 stays 30₪");
  const healthAfter = afterFn({
    ok:true,
    monthlyPremium:200,
    covers:[
      { wizardKey: "ניתוחים", monthlyPremium: 80 },
      { wizardKey: "תרופות", monthlyPremium: 70 },
      { wizardKey: "מחלות קשות", monthlyPremium: 50 }
    ]
  }, {
    schedule:[70,65],
    pct:70,
    coverDiscounts:[
      { name: "ניתוחים", pct: "70" },
      { name: "תרופות", pct: "50" },
      { name: "מחלות קשות", pct: "0" }
    ]
  });
  assert(healthAfter === 109, "health per-cover year-1: 80@70% + 70@50% + 50@0% = 109₪");
}

{
  const fromRecSrc = sliceBetween(sims, "function giSimManualScheduleNumbers(schedule){", "function giSimDiscountManualRec(sim, insId){");
  const bundle = new Function(
    "safeTrim",
    "GI_SIM_MANUAL_DISCOUNT_ID",
    "function giSimDiscountCollectResult(){ return null; }\n" +
    fromRecSrc + "\nreturn { giSimManualScheduleNumbers, giSimManualOptionFromRec, giSimIsHealthAddonCover };"
  )(safeTrim, "gi-sim-manual");
  const consecutive = bundle.giSimManualOptionFromRec({
    raw: "70/65/60/",
    schedule: [{ year: 1, pct: 70 }, { year: 2, pct: 65 }, { year: 3, pct: 60 }]
  });
  assert(consecutive && consecutive.schedule.join("/") === "70/65/60", "consecutive years stay 70/65/60");
  const sparse = bundle.giSimManualScheduleNumbers([
    { year: 1, pct: 70 },
    { year: 5, pct: 40 }
  ]);
  assert(sparse.join("/") === "70/0/0/0/40", "year 5 stays year 5 (zeros pad 2–4)");
  const coversOnly = bundle.giSimManualOptionFromRec({
    raw: "",
    schedule: [],
    coverDiscounts: [{ name: "ניתוחים", pct: "55" }, { name: "מחלות קשות", pct: "10" }]
  });
  assert(coversOnly && coversOnly.manualException === true, "cover-only rec is still a manual exception");
  assert(coversOnly.pct === 55 && coversOnly.schedule[0] === 55, "cover-only year-1 is the max cover percent");
  assert(bundle.giSimIsHealthAddonCover("מחלות קשות"), "addon cover: מחלות קשות");
  assert(bundle.giSimIsHealthAddonCover("סרטן"), "addon cover: סרטן");
  assert(!bundle.giSimIsHealthAddonCover("ניתוחים"), "surgeries is not an addon");
}

console.log("\n4) payload + wizard copy coverDiscounts and year schedule");
assert(sims.includes("giSimManualCoverDiscountsForPayload"), "payload helper for per-cover rows");
assert(sims.includes("payload.coverDiscounts = covers") || sims.includes("snap.coverDiscounts = covers"), "selected discount payload carries coverDiscounts");
assert(wiz.includes("r.simDiscount.coverDiscounts"), "applyRiskSimResultsToDraft copies coverDiscounts onto the draft");
assert(wiz.includes("draft.coverDiscounts = r.simDiscount.coverDiscounts.map"), "draft.coverDiscounts is filled from the simulator");
assert(wiz.includes("captured.coverDiscounts = coverRows") || wiz.includes("if(coverRows.length) captured.coverDiscounts"), "session capture keeps coverDiscounts");
assert(wiz.includes("hasCoverDisc"), "session capture treats cover-only as manual");

{
  const restoreSrc = sliceBetween(sims, "function giSimManualRecFromRestore(v){", "function giSimDiscountRestoreMap(sim, restoreDiscount){");
  const mapSrc = sliceBetween(sims, "function giSimDiscountRestoreMap(sim, restoreDiscount){", "function giSimDiscountSnapshotEntry(sim, insId, result){");
  const parseSrc = sliceBetween(sims, "function giSimParseManualDiscountSchedule(raw){", "function giSimManualScheduleNumbers(schedule){");
  const formatSrc = sliceBetween(sims, "function giSimFormatManualDiscountInput(value, prevValue){", "function giSimParseManualDiscountSchedule(raw){");
  const addonSrc = "function giSimIsHealthAddonCover(name){ return /מחלות קשות|סרטן/i.test(safeTrim(name)); }\n";
  const restore = new Function(
    "safeTrim",
    "GI_SIM_MANUAL_DISCOUNT_ID",
    formatSrc + parseSrc + addonSrc + restoreSrc + mapSrc + "\nreturn giSimDiscountRestoreMap;"
  )(safeTrim, "gi-sim-manual");
  const sim = {};
  restore(sim, {
    i1: {
      optionId: "gi-sim-manual",
      manualException: true,
      raw: "",
      schedule: [70, 0, 0, 0, 40],
      year1Pct: 70,
      coverDiscounts: [{ name: "ניתוחים", pct: "70" }, { name: "מחלות קשות", pct: "0" }]
    }
  });
  assert(sim._giSimDiscountSel.i1 === "gi-sim-manual", "restore writes the synthetic id for cover+years");
  assert(sim._giSimManualByInsured.i1.schedule[0].pct === 70, "restore year 1 is 70");
  assert(sim._giSimManualByInsured.i1.schedule[1].year === 5 && sim._giSimManualByInsured.i1.schedule[1].pct === 40, "restore year 5 stays year 5");
  assert(sim._giSimManualByInsured.i1.coverDiscounts.some((row) => row.name === "ניתוחים" && row.pct === "70"), "restore keeps per-cover percent");
}

if(failed){
  console.error("\nFAILED " + failed + "/" + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
