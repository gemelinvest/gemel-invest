/* GI-OPS 2026-09-14 — שלב 7 שיקוף: עריכת טופס מקורי במסך מלא
   (לא מודאל), כל שדות הטופס כולל הצהרת בריאות, מילוי מהתיק.
   הרצה: node _test-ops-mirror-form-inline-editor.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260914-mc-he-followup-v1";
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = read("app.js");
const css = read("app.css");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

const healthRender = sliceBetween(app, "_renderHealthDeclarationBody(rec){", "_mcIsExistingHealthProduct(p){");
const openJoin = sliceBetween(app, "async _mcOpenJoinFormFromRail(rec, type){", "async _mcOpenFollowupFromRail(rec, type");
const openFollow = sliceBetween(app, "async _mcOpenFollowupFromRail(rec, type", "_mcShowFullPdfModal(title, url){");
const overlayFn = sliceBetween(app, "async _mcApplyPdfOverlayToBytes(bytes, pdfValues){", "_mcCaptureFormEditsFromModal(modal){");
const stemMap = sliceBetween(app, "_mcPdfFieldStemMap(){", "_mcSplitPdfFieldName(fieldName){");

console.log("\n2) מסך מלא במקום מודאל");
assert(healthRender.includes("_mcHealthFormEditorHtml(rec)"), "גוף שלב 7 מצייר עורך במסך");
assert(healthRender.includes("mcHealthDeclSplit--editor"), "פריסת עורך במסך השיקוף");
assert(app.includes("חזרה להצהרה"), "חזרה מהטופס לסיכום הצהרה");
assert(app.includes("health-form-close"), "פעולת סגירת עורך");
assert(openJoin.includes("listEditablePdfFields"), "טוען את כל שדות ה-PDF הרשמי");
assert(openJoin.includes("fillOriginalTemplate"), "ממלא מהתיק לפני העריכה");
assert(!openJoin.includes("await ui[fnName](rec)"), "לא פותח את מודאל תיק הלקוח");
assert(openFollow.includes('kind: "followup"'), "שאלון המשך נפתח במסך ולא במודאל");
assert(openFollow.includes("_mcFollowupFallbackFields"), "שאלון בלי AcroForm נפתח לעריכה");
assert(!openFollow.includes("<iframe"), "שאלון המשך אינו iframe במסך העריכה");
assert(app.includes("health-followup-save"), "שמירת שאלון וחזרה");
assert(app.includes("_mcReturnFromFollowupEditor(rec){"), "חזרה לטופס או להצהרה אחרי שאלון");
assert(app.includes('data-mc-health-yes="1"'), "כן בהצהרה מסומן לפתיחת שאלון");
assert(app.includes("_mcOnHealthChoiceInEditor(rec, el){"), "לחיצת כן פותחת שאלון המשך");

console.log("\n3) מיפוי הצהרת בריאות לכל הטפסים");
assert(app.includes("_mcJoinTypeHealthMap(type){"), "מפת סוג טופס → מפת הצהרה");
assert(app.includes("phoenix_life_short_form: \"phoenix_life_short\""), "פניקס ריסק מקוצר");
assert(app.includes("phoenix_ci_form: \"phoenix_ci\""), "פניקס מחלות קשות");
assert(app.includes("hachshara_health_form: \"hachshara_health\""), "הכשרה בריאות");
assert(app.includes("clal_health_form: \"clal_health\""), "כלל בריאות");
assert(app.includes("menora_risk_form: \"menora_risk\""), "מנורה ריסק");
assert(app.includes("ayalon_health_form: \"ayalon_health\""), "איילון בריאות");
assert(app.includes("migdal_life_form: \"migdal_life\""), "מגדל חיים");
assert(app.includes("_mcRenderPdfFieldsHtml(type, fields, values){"), "עורך לפי שדות הטופס המקורי");
assert(app.includes("_mcRenderDraftHealthFormHtml(rec, type, draft){"), "נפילה לטופס שטוח (בלי AcroForm)");
assert(app.includes("_mcPdfHealthFieldMeta(type, fieldName){"), "תווית שאלה לפי מיקום בטופס");
assert(app.includes("הצהרת בריאות"), "כותרת אזור הצהרה בעורך");

console.log("\n4) עיצוב מקצועי + שמירה");
assert(css.includes(".mcFormEd__q{"), "שאלות הצהרה ככרטיסים");
assert(css.includes(".mcFormEd__seg{"), "כן/לא כבחירה מקצועית");
assert(css.includes(".mcFormEd__seg{\n  position:relative;"), "כפתור כן לא מכסה את המסך");
assert(css.includes(".mcFormEd__head{"), "כותרת דביקה לעורך");
assert(app.includes("_mcFlushInlineFormEditor(rec){"), "שמירת עריכות לפני ניווט");
assert(app.includes("_mcApplyPdfOverlayToBytes(bytes, pdfValues){"), "כתיבת שדות PDF חזרה לטופס");
assert(overlayFn.includes("{ visual: false }"), "עברית לוגית ב-PDF (לא הפוכה)");
assert(overlayFn.includes('setExport(form, name, "Off")'), "ניקוי צ'קבוקס נכתב Off");
assert(app.includes("if(el.type === \"radio\" && !el.checked) return;"), "רדיו לא דורס ערך ריק");
assert(app.includes("this._mcBytesToPdfDataUrl(outBytes)"), "שאלון המשך נשמר עם העריכות");

console.log("\n4b) תוויות עברית 1:1 לטופס הנייר");
assert(stemMap.includes('ClientMustExistPolicy: "קיימת פוליסה בחברה"'), "קיימת פוליסה");
assert(stemMap.includes('RiskWellPremiaText: "פרמיית ריסק / בריאות"'), "פרמיית ריסק");
assert(stemMap.includes('GiluiTotalRisk15: "סכום ביטוח — 15 שנים"'), "סכום 15 שנים");
assert(stemMap.includes('FamilyIncome: "הכנסה משפחתית"'), "הכנסה משפחתית");
assert(app.includes('_mcPdfFieldLabel(type, fieldName){'), "תווית שדה לעורך");
assert(app.includes('return "שדה בטופס"'), "לא מציגים שם אנגלי גולמי");

console.log("\n5) רגרסיה — לא נפתח מודאל תיק לקוח מהמסילה");
assert(app.includes("_mcOfficialFormOpeners(){"), "מיפוי פותחי טפסים נשאר (לתיק לקוח)");
assert(app.includes("fillOriginalTemplate"), "מנוע מילוי רשמי לא הוסר");
assert(healthRender.includes("כעת נעבור להצהרת הבריאות"), "נוסח הקראה נשאר כשהעורך סגור");

console.log("\n6) תוויות עבריות בזמן ריצה");
function extractMethod(src, name){
  const start = src.indexOf("    " + name + "(");
  if(start < 0) return "";
  let i = src.indexOf("{", start);
  let depth = 0;
  for(; i < src.length; i++){
    if(src[i] === "{") depth += 1;
    else if(src[i] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}
const vm = require("vm");
const humanizeSrc = [
  extractMethod(app, "_mcPdfFieldStemMap"),
  extractMethod(app, "_mcSplitPdfFieldName"),
  extractMethod(app, "_mcHumanizePdfFieldName")
].join(",\n");
assert(humanizeSrc.indexOf("_mcPdfFieldStemMap") >= 0, "חולץ מפת תוויות");
const sandbox = {
  safeTrim: (v) => (v == null ? "" : String(v).trim()),
  GI_OFFICIAL_FORM_FILL: { hebrewPdfFieldLabel: (n) => n }
};
vm.createContext(sandbox);
vm.runInContext("const api = {\n" + humanizeSrc + "\n}; this.api = api;", sandbox);
const labelOf = (name) => sandbox.api._mcHumanizePdfFieldName(name);
assert(labelOf("ClientMustExistPolicy") === "קיימת פוליסה בחברה", "ClientMustExistPolicy בעברית");
assert(labelOf("RiskWellPremiaText") === "פרמיית ריסק / בריאות", "RiskWellPremiaText בעברית");
assert(labelOf("GiluiTotalRisk15") === "סכום ביטוח — 15 שנים", "GiluiTotalRisk15 בעברית");
assert(labelOf("FamilyIncome") === "הכנסה משפחתית", "FamilyIncome בעברית");
assert(labelOf("FirstNameBzug") === "בן/בת זוג — שם פרטי", "FirstNameBzug בעברית");
assert(labelOf("PIDChild1") === "ילד 1 — תעודת זהות", "PIDChild1 בעברית");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
