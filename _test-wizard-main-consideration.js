/* GI-WIZARD 2026-10-07 — שיקול עיקרי חובה בשלב התאמת צרכים.
   הרצה: node _test-wizard-main-consideration.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261007-lead-dup-v1";
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

console.log("1) syntax + helpers");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-wizard-main-consideration.js")]).status === 0, "node --check this test");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard cache tag");
assert(app.includes('const BUILD = "' + TAG + '"'), "app BUILD aligned");

const helpers = sliceBetween(wiz, "_cloneNeedsMainConsideration(raw){", "_naPolicyFingerprint(policy){");
assert(helpers.includes('key: "hozala"') && helpers.includes('label: "הוזלה"'), "אופציית הוזלה");
assert(helpers.includes('key: "expansion"') && helpers.includes('label: "הרחבה"'), "אופציית הרחבה");
assert(helpers.includes('label: "כיסוי חדש"'), "אופציית כיסוי חדש כשיש פוליסות");
assert(helpers.includes('label: "רכישת ביטוח חדש"'), "בלי פוליסות — רכישת ביטוח חדש");
assert(helpers.includes("validateNeedsMainConsideration(){"), "ולידציית חובה");
assert(helpers.includes("isElementaryFlow()"), "אלמנטרי לא נחסם בשיקול העיקרי");

console.log("\n2) UI + validation + payload");
const step4 = sliceBetween(wiz, "renderStep4NeedsAnalysis(){", "_openNaSharedInsuredsPopup(fp){");
assert(step4.includes("_naRenderMainConsiderationPicker()"), "הסימון מוצג בשלב התאמת צרכים");
assert(step4.includes("התאמת צרכים"), "כותרת השלב לא הוחלפה");
assert(step4.includes("שיקולים ונימוקים"), "נימוקי ביטול קיימים נשארו");
const bind = sliceBetween(wiz, "bindStep4NeedsAnalysis(){", "renderStep4(ins){");
assert(bind.includes("data-na-main-key"), "בחירת סטטוס נשמרת בלחיצה");
assert(bind.includes("data-na-reason"), "שמירת נימוקים קיימת לא הוסרה");
const validate = sliceBetween(wiz, "if(stepId === 4){", "const bad = this.insureds.filter");
assert(validate.includes("validateNeedsMainConsideration"), "שער «הבא» דורש שיקול עיקרי");
assert(validate.includes("לא ניתן להתקדם לשלב הבא ללא פירוט על הפוליסות שמבטל מלא/חלקי ללקוח"), "שער נימוקי ביטול לא הוסר");
assert(wiz.includes("attachNeedsMainConsiderationToPayload(payload)"), "נשמר ב-payload");
assert(wiz.includes("applyNeedsMainConsiderationFromPayload(payload)"), "נטען מ-payload");
assert(wiz.includes("getExistingPolicyCancelReasons(){"), "סיבות ביטול קיימות לא הוסרו");
assert(wiz.includes('"הוזלת עלויות / מיקסום זכויות"'), "סיבת ביטול הוזלת עלויות נשארה");

console.log("\n3) elementary step 4 untouched");
assert(wiz.includes('if(Number(stepId) === 4) return !!(safeTrim(d.coverageType));'), "אלמנטרי שלב 4 נשאר בחירת כיסוי");
const elemBlockStart = wiz.indexOf("isStepCompleteForInsured(stepId, ins){");
const healthStep4 = wiz.indexOf("if(stepId === 4){", elemBlockStart);
const elemSlice = wiz.slice(elemBlockStart, healthStep4);
assert(elemSlice.includes("if(this.isElementaryFlow()){"), "בדיקת אלמנטרי לפני בריאות");
assert(elemSlice.includes("coverageType"), "שלב 4 באלמנטרי נשאר coverageType");
assert(!elemSlice.includes("validateNeedsMainConsideration"), "אלמנטרי לא דורש שיקול עיקרי");

console.log("\n4) runtime options / normalize / validate");
function extractMethod(src, name, nextName){
  const start = src.indexOf(name + "(");
  const end = src.indexOf(nextName + "(", start);
  if(start < 0 || end < 0 || end <= start) return "";
  return ("function " + src.slice(start, end).replace(/,\s*$/, "")).trim();
}
const sandbox = {
  console,
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  escapeHtml(s){ return String(s == null ? "" : s); }
};
sandbox.api = {
  isElementaryFlow(){ return this._elem === true; },
  wizardHasExistingPolicies(){ return this._hasExisting === true; },
  insureds: [],
  needsMainConsideration: { key: "", label: "" },
  _persistWizardMemoryLocalOnly(){},
  _cloneNeedsMainConsideration(raw){
    const src = raw && typeof raw === "object" ? raw : {};
    return { key: sandbox.safeTrim(src.key), label: sandbox.safeTrim(src.label) };
  }
};
vm.runInNewContext(
  "this.api.getNeedsMainConsiderationOptions = " + extractMethod(helpers, "getNeedsMainConsiderationOptions", "normalizeNeedsMainConsideration") +
  "; this.api.normalizeNeedsMainConsideration = " + extractMethod(helpers, "normalizeNeedsMainConsideration", "getNeedsMainConsideration") +
  "; this.api.validateNeedsMainConsideration = " + extractMethod(helpers, "validateNeedsMainConsideration", "_naRenderMainConsiderationPicker") +
  ";",
  sandbox
);

sandbox.api._hasExisting = true;
sandbox.api._elem = false;
const withPol = sandbox.api.getNeedsMainConsiderationOptions(true).map((o) => o.label);
assert(JSON.stringify(withPol) === JSON.stringify(["הוזלה", "הרחבה", "כיסוי חדש"]), "עם פוליסות: שלושת הסטטוסים");
sandbox.api.needsMainConsideration = { key: "", label: "" };
assert(sandbox.api.validateNeedsMainConsideration().ok === false, "בלי בחירה — חסום");
sandbox.api.needsMainConsideration = sandbox.api.normalizeNeedsMainConsideration({ key: "hozala" }, true);
assert(sandbox.api.needsMainConsideration.label === "הוזלה", "הוזלה מנורמלת");
assert(sandbox.api.validateNeedsMainConsideration().ok === true, "אחרי הוזלה — מותר להמשיך");

sandbox.api._hasExisting = false;
const noPol = sandbox.api.getNeedsMainConsiderationOptions(false).map((o) => o.label);
assert(JSON.stringify(noPol) === JSON.stringify(["רכישת ביטוח חדש"]), "בלי פוליסות רק רכישת ביטוח חדש");
sandbox.api.needsMainConsideration = { key: "hozala", label: "הוזלה" };
assert(sandbox.api.normalizeNeedsMainConsideration(sandbox.api.needsMainConsideration, false).key === "", "הוזלה לא תקפה בלי פוליסות");
sandbox.api.needsMainConsideration = { key: "", label: "" };
assert(/רכישת ביטוח חדש/.test(sandbox.api.validateNeedsMainConsideration().msg || ""), "הודעת חובה בלי פוליסות");
sandbox.api.needsMainConsideration = sandbox.api.normalizeNeedsMainConsideration({ key: "new_cover" }, false);
assert(sandbox.api.needsMainConsideration.label === "רכישת ביטוח חדש", "new_cover בלי פוליסות = רכישת ביטוח חדש");
assert(sandbox.api.validateNeedsMainConsideration().ok === true, "אחרי רכישת ביטוח חדש — מותר");

sandbox.api._elem = true;
sandbox.api.needsMainConsideration = { key: "", label: "" };
assert(sandbox.api.validateNeedsMainConsideration().ok === true, "אלמנטרי לא נחסם");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
