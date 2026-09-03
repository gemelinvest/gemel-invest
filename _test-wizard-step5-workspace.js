/* GI-NP-WORKSPACE 2026-09-03
   שלב פוליסות חדשות: בחירה → סימולטור לכל נציג → שורות סיכום + הנחה ידנית בבריאות.
   בלי שינוי בלוגיקת הצהרת הבריאות / מרכז הסימולטורים / מסכים אחרים.
   הרצה: node _test-wizard-step5-workspace.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260903-np-workspace-v2";
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

const wiz = read("gi-wizard.js");
const app = read("app.js");
const html = read("index.html");
const css = read("app.css");
const sw = read("service-worker.js");

const renderStart = wiz.indexOf("renderStep5(){");
const renderEnd = wiz.indexOf("renderStep6(ins){", renderStart);
const renderFn = (renderStart >= 0 && renderEnd > renderStart) ? wiz.slice(renderStart, renderEnd) : "";

const filterStart = wiz.indexOf("getHealthQuestionsFiltered(){");
const filterEnd = wiz.indexOf("getHealthQuestionList(){");
const filterFn = (filterStart >= 0 && filterEnd > filterStart) ? wiz.slice(filterStart, filterEnd) : "";
const pickStart = filterFn.indexOf("GI-HEALTH-ONE-DECL");
const pickBlock = pickStart >= 0 ? filterFn.slice(pickStart) : "";

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard build tag");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app.js wizard version");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");

console.log("\n2) step 5 workspace chrome — pick / simulator / rows");
assert(renderFn.includes("renderStep5(){"), "renderStep5 exists");
assert(renderFn.includes("lcNpPick"), "pick view for company/product");
assert(renderFn.includes("lcNpWorkspace"), "simulator workspace");
assert(renderFn.includes("lcNpProw"), "summary rows not cubes");
assert(!renderFn.includes("lcPolCard--square"), "step 5 no longer renders square policy cubes");
assert(renderFn.includes("data-addpol"), "add-policy action kept");
assert(renderFn.includes("data-nptype"), "product picker kept");
assert(renderFn.includes("data-np-insured"), "insured multi-select kept");
assert(renderFn.includes("data-discountpol"), "existing discount modal still on the row");
assert(renderFn.includes("data-editpol") && renderFn.includes("data-delpol"), "edit/remove kept");
assert(renderFn.includes("data-np-manual-disc"), "manual discount chip on health rows");
assert(renderFn.includes("data-cover-pct"), "per-cover percent inputs");
assert(renderFn.includes("חשב פרמיה"), "calc button in workspace");
assert(renderFn.includes("הוסף פוליסה להצעה"), "add to proposal CTA");
assert(renderFn.includes("lcNpPickGrid"), "pick view is two equal dropdowns");
assert(renderFn.includes("lcNpWsGrid"), "workspace is two-column simulator layout");
assert(!renderFn.includes("lcNpPickHint"), "old accordion hint copy removed");
assert(!renderFn.includes("בחר את הכיסויים הרצויים"), "old catalog cover title removed");
assert(renderFn.includes(">בחירת כיסויים<"), "simulator-style cover title");
assert(css.includes(".lcNpProw"), "row styles in app.css");
assert(css.includes(".lcNpManualBox"), "manual discount panel styles");
assert(css.includes(".lcNpPickGrid"), "pick grid styles");
assert(css.includes(".lcNpWsGrid"), "workspace grid styles");
assert(css.includes(".lcNpManualActions"), "manual discount save-row styles");

console.log("\n3) simulators: wizard open to all agents, center unchanged");
assert(wiz.includes("canOpenWizardPolicySimulator(){"), "wizard simulator gate exists");
assert(/canOpenWizardPolicySimulator\(\)\{\s*return true;/.test(wiz), "wizard simulator is open to every agent");
assert(/canAccessSimulators\(\)\{\s*return this\.isAdmin\(\) \|\| this\.isManager\(\);/.test(app), "Simulators Center gate unchanged");
assert(renderFn.includes("canOpenWizardPolicySimulator"), "step 5 uses wizard gate, not manager-only center gate");
assert(!renderFn.includes("Auth.canAccessSimulators"), "step 5 no longer gates the banner on manager/admin");

console.log("\n4) coverDiscounts metadata — health only, no premium engine change");
assert(wiz.includes("getHealthCoverManualDiscountRows(policy){"), "manual discount rows helper");
assert(wiz.includes("isHealthCoverInGeneralDiscount(cover){"), "general vs addon cover split");
assert(wiz.includes("coverDiscounts:"), "optional coverDiscounts saved on add");
assert(wiz.includes("getPolicyPremiumAfterDiscount"), "existing after-discount reader untouched");
assert(/getPolicyPremiumAfterDiscount\(policy\)\{\s*\/\/ 20260502-vFinalPremiumNoDiscountCalc:/.test(wiz), "global after-discount engine comment remains");
assert(wiz.includes("return this.getPolicyPremiumBeforeDiscount(policy);"), "global engine still does not multiply by discount pct");
assert(renderFn.includes("data-np-apply-cover-disc"), "save-discounts button on the row");
assert(renderFn.includes("שמור הנחות"), "save-discounts label");
assert(wiz.includes("applyHealthCoverManualDiscounts(policy){"), "apply helper writes after-discount from per-cover pct");
assert(wiz.includes("getHealthRowPremiumAfterDiscount(policy){"), "row display uses cover-discount total");
assert(wiz.includes("premiumAfterCoverDiscounts"), "applied total stored on the health policy");

console.log("\n5) simulator covers only — compensation plans stay out of health picker");
assert(wiz.includes("HEALTH_SIMULATOR_COVER_KEYS"), "simulator cover catalog in wizard");
assert(wiz.includes("getNewPolicyHealthCoverGroups("), "step 5 filters groups to simulator keys");
const keysStart = wiz.indexOf("HEALTH_SIMULATOR_COVER_KEYS");
const menoraKeys = wiz.slice(wiz.indexOf('"מנורה":', keysStart), wiz.indexOf('"הפניקס":', keysStart));
assert(menoraKeys.includes("TOP רפואה משלימה"), "Menora simulator includes TOP complementary");
assert(!menoraKeys.includes("TOP קרן מחלות קשות"), "Menora simulator excludes critical-illness fund");
assert(!menoraKeys.includes("קרן פיצוי לגילוי מחלת הסרטן"), "Menora simulator excludes cancer fund");
assert(renderFn.includes("getNewPolicyHealthCoverGroups(d.company)"), "cover checkboxes use filtered groups");
assert(renderFn.includes("pruneDraftHealthCoversToSimulator"), "draft covers pruned to simulator keys");

console.log("\n6) regression — health declaration routing not touched");
assert(pickBlock.includes("GI-HEALTH-ONE-DECL"), "one-declaration marker remains");
assert(pickBlock.includes("migdalHealth"), "Migdal health hard priority remains");
assert(pickBlock.includes("cand.company === 'מגדל'"), "Migdal match by company remains");
assert(pickBlock.includes("healthCompanies.length === 1"), "single-company cart still skips Magdala force");
assert(pickBlock.includes("bestCandidate(healthCandidates)"), "health still picks largest remaining form");
assert(pickBlock.includes("bestCandidate(productCandidates)"), "non-health still picks most questions");
assert(!pickBlock.includes("addUniqueQuestions"), "still no cross-form question merge");
assert(!renderFn.includes("getHealthQuestionsFiltered"), "step 5 render does not call declaration routing");

console.log("\n7) manual discount math — per-cover % updates after price");
function round2(n){ return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function applyManual(total, rows, bases){
  const breakdownSum = Object.keys(bases || {}).reduce((s, k) => s + (bases[k] || 0), 0);
  let after = 0;
  if(breakdownSum > 0){
    const named = new Set(rows.map((r) => r.name));
    rows.forEach((row) => { after += (bases[row.name] || 0) * (1 - row.pct / 100); });
    Object.keys(bases).forEach((name) => { if(!named.has(name)) after += bases[name] || 0; });
  } else if(rows.length){
    const share = total / rows.length;
    rows.forEach((row) => { after += share * (1 - row.pct / 100); });
  } else {
    after = total;
  }
  return round2(after);
}
const shotRows = [
  { name:"השתלות", pct:20 },
  { name:"ניתוחים בחו״ל", pct:20 },
  { name:"אבחון מהיר", pct:10 },
  { name:"TOP משלימה", pct:20 }
];
assert(applyManual(80.26, shotRows, {}) === 66.21, "without per-cover quotes, 80.26 with 20/20/10/20 becomes 66.21");
assert(applyManual(80.26, shotRows, {
  "השתלות": 30, "ניתוחים בחו״ל": 20, "אבחון מהיר": 10, "TOP משלימה": 20.26
}) === 65.21, "with simulator per-cover quotes the after-price is weighted");
assert(wiz.includes("coverDiscountsApplied = true"), "save sets applied flag so the row price refreshes");

if(failed){
  console.error("\nFAILED  passed=" + passed + " failed=" + failed);
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
