/* GI-CLAL-LIFE-SINGLE 2026-09-30
   טופס 653 L007 נכנס למסמכי לקוח ולהצהרת הבריאות בשיקוף
   רק לריסק כלל של מבוטח אחד. ריסק זוגי ומשכנתא נשארים במסלול שלהם.
   הרצה: node _test-clal-life-single-form.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261001-offer-totals-v1";
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const pdfPath = path.join(ROOT, "forms", "clal-risk-life", "clal-risk-life-l007.pdf");

console.log("1) קובץ הטופס והמטמון");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(fs.existsSync(pdfPath), "קובץ 653 L007 נמצא במאגר");
assert(fs.statSync(pdfPath).size > 100000, "קובץ הטופס אינו ריק");
assert(html.includes("app.js?v=" + TAG), "index.html טוען את app.js החדש");
assert(sw.includes("gi-v12-" + TAG), "service worker מתעדכן");
assert(app.includes('BUILD = "' + TAG + '"'), "BUILD");
assert(app.includes('TEMPLATE_FILE: "clal-risk-life-l007.pdf"'), "המילוי מצביע לקובץ שבמאגר");
assert(app.includes('TEMPLATE_BASE: "./forms/clal-risk-life/"'), "תיקיית המאגר");

console.log("\n2) מסמכי לקוח אחרי סיום הקמת לקוח");
assert(app.includes('clalLifeForm: "clal_life_form"'), "סוג מסמך רשום");
assert(app.includes("qualifiesForClalLifeForm"), "תנאי כניסה למבוטח אחד");
assert(app.includes("טופס מקורי — ריסק חיים · כלל"), "שם המסמך בתיק");
assert(app.includes("doc_clal_life_form"), "מזהה מסמך");
assert(app.includes('clal_life_form: true'), "מסמך מופק בלי שמירת קובץ נפרד");
const qualify = sliceBetween(app, "qualifiesForClalLifeForm(payload, rec){", "qualifiesForMenoraCiForm(payload, rec){");
assert(qualify.includes("qualifiesForClalLifeCoupleForm"), "מבוטח אחד לא נכנס כשיש טופס זוגי");
assert(qualify.includes("isClalLifeJoinPolicy"), "רק ריסק/חיים של כלל");
assert(!qualify.includes("ריסק משכנתא"), "התנאי לא נוגע במשכנתא");

console.log("\n3) הצהרת בריאות בשיקוף");
const rail = sliceBetween(app, "_mcJoinFormTypeForPolicy(p, rec){", "_mcFollowupTopicTitle(entry){");
const coupleAt = rail.indexOf("qualifiesForClalLifeCoupleForm");
const singleAt = rail.indexOf("qualifiesForClalLifeForm");
assert(coupleAt > 0 && singleAt > coupleAt, "זוגי נבדק לפני יחיד");
assert(rail.includes('clal_life_form: "טופס מקורי — ריסק חיים · כלל"') || app.includes('clal_life_form: "טופס מקורי — ריסק חיים · כלל"'), "שם ברשימת השיקוף");
assert(app.includes("buildDraft(rec){"), "טיוטה מהתיק");
assert(app.includes("window.ClalRiskLifePdf = ClalRiskLifePdf"), "הטופס זמין לפתיחה ממולאת");
assert(app.includes("ClalRiskLifePdf.renderPreviewHtml"), "תצוגה במסמכי לקוח");

console.log("\n4) מילוי מהנתונים השמורים");
const fill = sliceBetween(app, "async fillOriginalTemplate(meta){", "getFileName(meta){");
assert(fill.includes("clal-risk-life-l007.pdf"), "המילוי טוען את L007");
assert(fill.includes('this.setTextSafe(form, "FullName"'), "שם מבוטח");
assert(fill.includes('this.setTextSafe(form, "GiluiTotalRisk"'), "סכום ביטוח");
assert(fill.includes("this.setYesNo(form, crq"), "כן/לא מהצהרת הבריאות");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
