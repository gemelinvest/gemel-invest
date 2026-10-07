/* GI-NP-DISC-BANK-ROW 2026-10-07
   תוכנית משולבת: שורת פוליסה קומפקטית וקריאה, הנחה ידנית בסימולטור
   (טבלת כיסוי + 70/65/60 + חשב הנחה), בלי כפתורי הנחה בשורה,
   «הוסף הטבה», ותיקון בנק שני + חלוקת סכום + אזהרת יתרה.
   בלי החלפת BUILD/SIM tag. בלי שינוי נוסחת פרמיה/KPI.
   הרצה: node _test-np-disc-bank-row.js
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

const wiz = read("gi-wizard.js");
const sims = read("gi-simulators.js");
const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");
const css = read("app.css");
const shell = read("simulators-shell.css");

const renderStart = wiz.indexOf("renderStep5(){");
const renderEnd = wiz.indexOf("renderStep6(ins){", renderStart);
const renderFn = (renderStart >= 0 && renderEnd > renderStart) ? wiz.slice(renderStart, renderEnd) : "";

console.log("1) syntax + BUILD/SIM tags stay; cache via &giNpPlan=1");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(app.includes('const BUILD = "' + BUILD + '"'), "BUILD tag stays");
assert(wiz.includes('GI_WIZARD_BUILD = "' + BUILD + '"'), "wizard build tag stays");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + SIM_TAG + '"'), "simulator href keeps SIM tag as prefix");
assert(app.includes('"./gi-simulators.js?v=' + SIM_TAG + '" + "&giHealthMan=1" + "&giNpPlan=1"'), "simulator href adds giNpPlan after health-man");
assert(html.includes("app.js?v=" + BUILD), "index.html keeps BUILD");
assert(html.includes("&giNpPlan=1"), "index.html busts with giNpPlan");
assert(app.includes("&giHealthMan=1\" + \"&giNpPlan=1"), "wizard href keeps health-man and adds giNpPlan");
assert(sw.includes(BUILD), "service-worker keeps BUILD");
assert(sw.includes("np-plan-v1"), "service-worker adds np-plan-v1");
assert(app.includes("simulators-shell.css?v=20260927-legal-text-v1&giHealthMan=1&giNpPlan=1"), "shell css cache suffix");
assert(css.includes("GI-NP-PROW-COMPACT"), "prow compact last-wins marker");

console.log("\n2) added-policy row: larger type, compact, no הנחה / +הנחה ידנית");
const prowBlock = css.slice(css.lastIndexOf("GI-NP-PROW-COMPACT"));
assert(prowBlock.includes("max-width:980px"), "row is not stretched full-width");
assert(prowBlock.includes(".lcNpProw__title{ font-size:16px"), "policy title 16px");
assert(prowBlock.includes(".lcNpMetric strong{ font-size:18px"), "premium numbers 18px");
assert(prowBlock.includes("padding:10px 14px"), "tighter row padding");
assert(!renderFn.includes("data-discountpol") && !wiz.includes("$$('[data-discountpol]'"), "הנחה button left the added-policy row");
assert(!renderFn.includes("data-np-manual-disc") && !wiz.includes("$$('[data-np-manual-disc]'"), "+ הנחה ידנית left the added-policy row");
assert(!wiz.includes("+ הנחה ידנית"), "cover-chip label is gone from the wizard");
assert(renderFn.includes("data-editpol=") && renderFn.includes("data-delpol="), "edit/remove stay on the row");
assert(renderFn.includes("lcNpChip--gift"), "intro-benefit chip can still show on the row");
assert(renderFn.includes('pledgeBankNames.join(" · ")'), "row pledge chip lists every bank name");

console.log("\n3) health simulator: compact cover table + typed 70/65/60 + חשב הנחה");
assert(sims.includes("function giSimDiscountHealthManualHtml(sim, rec){"), "health panel builder");
assert(sims.includes("הנחה ידנית לפי כיסוי"), "per-cover heading");
assert(sims.includes("<th>כיסוי</th><th>הנחה כללית</th><th>אחוז</th>"), "cover / general / percent columns");
assert(sims.includes('placeholder="70/65/60"'), "typed year grading 70/65/60");
assert(sims.includes("data-gisim-disc-apply"), "חשב הנחה");
assert(sims.includes("שנה א"), "pills auto-label שנה א");
assert(sims.includes("function giSimManualYearPillsHtml(rec){"), "year pills helper");
assert(!sims.includes("data-gisim-disc-year=\""), "no open year-1..10 boxes in markup");
assert(shell.includes(".giSimDisc__coverTable"), "cover table styles");
assert(shell.includes(".giSimDisc__yearPills"), "year pill styles");
assert(shell.includes("max-width:min(560px, 100%)"), "health panel is compact");
{
  const pillsSrc = sliceBetween(sims, "function giSimManualScheduleNumbers(schedule){", "function giSimDiscountHealthManualHtml(sim, rec){");
  const pillsFn = new Function(pillsSrc + "\nreturn giSimManualYearPillsHtml;")();
  const htmlPills = pillsFn({ schedule: [{ year: 1, pct: 70 }, { year: 2, pct: 65 }, { year: 3, pct: 60 }] });
  assert(htmlPills.includes("שנה א · 70%"), "70 becomes שנה א");
  assert(htmlPills.includes("שנה ב · 65%"), "65 becomes שנה ב");
  assert(htmlPills.includes("שנה ג · 60%"), "60 becomes שנה ג");
}

console.log("\n4) simulator הוסף הטבה copies introBenefit onto the draft");
assert(sims.includes("הוסף הטבה"), "gift toggle label");
assert(sims.includes("חודש ראשון ללא עלות"), "month 1 free option");
assert(sims.includes("חודשיים ללא עלות"), "month 2 free option");
assert(sims.includes('data-gisim-gift-pick="month1free"'), "month1 pick");
assert(sims.includes('data-gisim-gift-pick="month2free"'), "month2 pick");
assert(sims.includes("function giSimIntroBenefitGet(sim, insId){"), "gift getter");
assert(sims.includes("payload.introBenefit = gift"), "discount payload carries introBenefit");
assert(sims.includes("payload.introBenefit = gift") || sims.includes("if(gift && gift !== \"none\") payload.introBenefit = gift"), "live purchase payload carries introBenefit");
assert(wiz.includes("r.introBenefit || (r.simDiscount && r.simDiscount.introBenefit)"), "apply copies gift from sim");
assert(wiz.includes("draft.introBenefit = gift"), "draft.introBenefit is filled from the simulator");
assert(wiz.includes("this.getPolicyIntroBenefitKey(d) !== \"none\""), "addDraftPolicy keeps the gift");
assert(shell.includes(".giSimDisc__gift"), "gift panel styles");

console.log("\n5) add-bank: skipCapture, amount split, remainder remark, ops + preflight");
assert(sims.includes("GI-PLEDGE-ADD-BANK"), "add-bank overwrite marker");
assert(sims.includes("function riskSimMountLegalPanel(sim, opts){"), "mount accepts skipCapture");
assert(sims.includes("if(!(opts && opts.skipCapture)){"), "capture is skipped when asked");
const addBankSrc = sliceBetween(sims, 'const addBank = modal.querySelector("[data-gishell-legal-bank-add]");', "modal.querySelectorAll(\"[data-gishell-legal-bank-remove]\")");
assert(addBankSrc.includes("persist();"), "add-bank persists the first card first");
assert(addBankSrc.includes("legal.pledgeBanks.push(riskSimEmptyPledgeBank())"), "add-bank pushes the second bank");
assert(addBankSrc.includes("riskSimRefreshLegalPanel(sim, { skipCapture: true })"), "add-bank refresh does not recapture the 1-card DOM");
assert(addBankSrc.includes("כל הסכום נוצל לטובת הבנק הראשון"), "add-bank toasts when bank 1 used the whole sum");
const removeBankSrc = sliceBetween(sims, "modal.querySelectorAll(\"[data-gishell-legal-bank-remove]\")", 'const addBen = modal.querySelector("[data-gishell-legal-ben-add]");');
assert(removeBankSrc.includes("skipCapture: true"), "remove-bank also skips recapture");
assert(sims.includes("if(secondAmt > remain) nextBanks[1].amount = remain ? String(remain) : \"\""), "capture clamps bank-2 to leftover");
assert(sims.includes("לא ניתן לשעבד לבנק השני — כל הסכום נוצל לטובת הבנק הראשון"), "legal dock remainder remark");
assert(wiz.includes("לא ניתן לשעבד לבנק השני — כל הסכום נוצל לטובת הבנק הראשון"), "wizard pledge status remainder remark");
assert(wiz.includes("כל הסכום נוצל לטובת הבנק הראשון"), "wizard amount input toasts when no remainder");
assert(app.includes("GI_MAX_PLEDGE_BANKS = 2"), "max two pledge banks");
assert(wiz.includes("GI_MAX_PLEDGE_BANKS"), "wizard uses the shared max");
assert(wiz.includes("שם בנק${sfx}"), "ops PDF emits a row per pledged bank");
assert(wiz.includes("סכום משועבד${sfx}"), "ops PDF lists each bank amount");
assert(app.includes("banks.map((bank, i) => {"), "preflight beneficiaries card maps every pledge bank");
assert(app.includes('banks.length > 1 ? ("בנק " + (i + 1)) : "בנק"'), "preflight labels bank 1 / bank 2");
assert(app.includes("_fmtPledgeBanks(p)"), "360 snapshot lists all pledge banks");
assert(shell.includes(".giSimShell__legalPledgeSplit"), "legal dock shows the amount split");

if(failed){
  console.error("\nFAILED " + failed + "/" + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
