/* GI-OPS 2026-09-14 — שלב 7 שיקוף: עריכת טופס מקורי במסך מלא
   (לא מודאל), כל שדות הטופס כולל הצהרת בריאות, מילוי מהתיק.
   הרצה: node _test-ops-mirror-form-inline-editor.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260914-mc-inline-form-v1";
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
const openJoin = sliceBetween(app, "async _mcOpenJoinFormFromRail(rec, type){", "async _mcOpenFollowupFromRail(rec, type){");
const openFollow = sliceBetween(app, "async _mcOpenFollowupFromRail(rec, type){", "_mcShowFullPdfModal(title, url){");

console.log("\n2) מסך מלא במקום מודאל");
assert(healthRender.includes("_mcHealthFormEditorHtml(rec)"), "גוף שלב 7 מצייר עורך במסך");
assert(healthRender.includes("mcHealthDeclSplit--editor"), "פריסת עורך במסך השיקוף");
assert(app.includes("חזרה להצהרה"), "חזרה מהטופס לסיכום הצהרה");
assert(app.includes("health-form-close"), "פעולת סגירת עורך");
assert(openJoin.includes("listEditablePdfFields"), "טוען את כל שדות ה-PDF הרשמי");
assert(openJoin.includes("fillOriginalTemplate"), "ממלא מהתיק לפני העריכה");
assert(!openJoin.includes("await ui[fnName](rec)"), "לא פותח את מודאל תיק הלקוח");
assert(openFollow.includes('kind: "followup"'), "שאלון המשך נפתח במסך ולא במודאל");

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
assert(css.includes(".mcFormEd__head{"), "כותרת דביקה לעורך");
assert(app.includes("_mcFlushInlineFormEditor(rec){"), "שמירת עריכות לפני ניווט");
assert(app.includes("_mcApplyPdfOverlayToBytes(bytes, pdfValues){"), "כתיבת שדות PDF חזרה לטופס");
assert(app.includes("if(el.type === \"radio\" && !el.checked) return;"), "רדיו לא דורס ערך ריק");

console.log("\n5) רגרסיה — לא נפתח מודאל תיק לקוח מהמסילה");
assert(app.includes("_mcOfficialFormOpeners(){"), "מיפוי פותחי טפסים נשאר (לתיק לקוח)");
assert(app.includes("fillOriginalTemplate"), "מנוע מילוי רשמי לא הוסר");
assert(healthRender.includes("כעת נעבור להצהרת הבריאות"), "נוסח הקראה נשאר כשהעורך סגור");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
