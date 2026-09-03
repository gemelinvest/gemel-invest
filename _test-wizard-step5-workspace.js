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
const TAG = "20260903-np-workspace-v1";
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
assert(css.includes(".lcNpProw"), "row styles in app.css");
assert(css.includes(".lcNpManualBox"), "manual discount panel styles");

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

console.log("\n5) regression — health declaration routing not touched");
assert(pickBlock.includes("GI-HEALTH-ONE-DECL"), "one-declaration marker remains");
assert(pickBlock.includes("migdalHealth"), "Migdal health hard priority remains");
assert(pickBlock.includes("cand.company === 'מגדל'"), "Migdal match by company remains");
assert(pickBlock.includes("healthCompanies.length === 1"), "single-company cart still skips Magdala force");
assert(pickBlock.includes("bestCandidate(healthCandidates)"), "health still picks largest remaining form");
assert(pickBlock.includes("bestCandidate(productCandidates)"), "non-health still picks most questions");
assert(!pickBlock.includes("addUniqueQuestions"), "still no cross-form question merge");
assert(!renderFn.includes("getHealthQuestionsFiltered"), "step 5 render does not call declaration routing");

if(failed){
  console.error("\nFAILED  passed=" + passed + " failed=" + failed);
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
