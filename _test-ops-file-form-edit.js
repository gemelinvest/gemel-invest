/* GI-OPS 2026-09-14 — בתיק לקוח (ממתין להקלדה) לחיצה על טופס פותחת עורך אמיתי ושומרת.
   הרצה: node _test-ops-file-form-edit.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260915-sys-notice-v2";
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
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-file-form-edit.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) לחיצה בתיק הלקוח — כפתור ערוך פותח עורך, השורה מציגה את הטופס");
assert(app.includes("async openOriginalFormForEdit(rec, type){"), "openOriginalFormForEdit קיים");
assert(app.includes("async _mcOpenJoinFormFromFile(rec, type){"), "פתיחה מתיק הלקוח");
assert(app.includes('data-edit-original-form="${escapeHtml(docType)}"'), "כפתור ערוך טופס בקבצים");
assert(app.includes(">ערוך טופס</button>"), "תווית ערוך טופס");
assert(app.includes("void this.openOriginalFormForEdit(rec, editOriginal.getAttribute(\"data-edit-original-form\"))"), "כפתור ערוך טופס פותח עורך");
const previewClick = sliceBetween(app, 'const previewRow = ev.target?.closest?.("[data-cf-doc-preview]");', 'const backBtn = ev.target?.closest?.("#customerMedicalBackBtn");');
assert(previewClick.includes("showCustomerDocumentPreview(docId)"), "לחיצה על שורת מסמך מציגה תצוגה מקדימה");
assert(!previewClick.includes("openOriginalFormForEdit"), "לחיצה על שורת מסמך לא פותחת עורך");
assert(app.includes("_mcFormEditorContext = \"customerFile\""), "הקשר עורך מתיק לקוח");
assert(app.includes("_mcHealthFormEditorHtml(rec)"), "משתמש בעורך הטופס הרשמי של השיקוף");
assert(app.includes("listEditablePdfFields"), "עורך נשען על שדות ה-PDF האמיתיים");
assert(!sliceBetween(app, "async openOriginalFormForEdit(rec, type){", "followupEditorTypeFromDoc(rec, doc){").includes("window.ClalHealthForm.open"), "לא פותח מודאל דיגיטלי להורדה בלבד");

console.log("\n3) שמירה חזרה לתיק");
assert(app.includes("async _mcSaveAndCloseFileFormEditor(){"), "שמירה וסגירה מתיק הלקוח");
assert(app.includes("await this._mcMaterializeEditedForms(rec)"), "אחרי עריכה ממלאים מחדש את ה-PDF בתיק");
assert(app.includes('App.persist("נשמרה עריכת טופס מקורי")'), "persist אחרי שמירת טופס");
assert(app.includes("paintSectionPane?.(rec, policies, { force: true })"), "רשימת הקבצים מתרעננת אחרי שמירה");
assert(app.includes("_mcMergeHtmlEditsIntoDraft(draft, overlay.html)"), "תצוגה מקדימה מכבדת עריכות שנשמרו");
const saveFn = sliceBetween(app, "async _mcSaveAndCloseFileFormEditor(){", "async _mcOpenJoinFormFromRail(rec, type){");
assert(saveFn.indexOf("this._mcCloseFileFormModal()") >= 0, "save path closes the modal");
assert(saveFn.indexOf("this._mcCloseFileFormModal()") < saveFn.indexOf("await this._mcMaterializeEditedForms"), "החלון יורד לפני מילוי ה-PDF");
assert(saveFn.indexOf("this._mcCloseFileFormModal()") < saveFn.indexOf("App.persist"), "החלון יורד לפני persist");
assert(app.includes("_mcDismissFileFormEditorOnFileClose"), "סגירת תיק מנתקת את עורך הטופס");
assert(app.includes("void MirrorCallUI._mcDismissFileFormEditorOnFileClose()"), "close() של התיק קורא לניתוק העורך");
assert(app.includes("host.appendChild(modal)"), "העורך נפתח בתוך תיק הלקוח");
assert(app.includes("_mcInvalidateFileFormSession"), "סגירה מבטלת טעינת PDF פתוחה");

console.log("\n4) עורך השיקוף נשאר");
assert(app.includes("חזרה להצהרה"), "בשיחת שיקוף עדיין חוזרים להצהרה");
assert(app.includes("_renderHealthDeclarationBody(rec)"), "ציור שלב 7 נשאר");
assert(app.includes("window.HachsharaHealthForm.open(rec)"), "פתיחה דיגיטלית ישנה לא נמחקה");
assert(css.includes(".mcFileFormModal"), "עיצוב מודאל עריכה מתיק");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK  " + passed + " assertions");
