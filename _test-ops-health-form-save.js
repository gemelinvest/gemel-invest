/* GI-OPS 2026-10-12 — שמירת טופס הצהרת בריאות בשיקוף:
   כל לחיצת שמירה מייצאת את הסימונים שהנציג הזין בצופה, וכותבת מיד לתיק.
   הרצה: node _test-ops-health-form-save.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20261007-lead-dup-v1";
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

function extractMethod(src, name){
  let start = src.indexOf("    async " + name + "(");
  if(start < 0) start = src.indexOf("    " + name + "(");
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

const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");
const viewer = read("gi-pdf-form-viewer.html");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("&giHealthSave=1"), "index.html app.js נטען מחדש אחרי תיקון השמירה");
assert(sw.includes("health-save-v1"), "service-worker cache לשמירת טופס בריאות");
assert(extractMethod(app, "_mcMountOriginalForm").includes("giHealthSave=1"), "צופה הטופס נטען מחדש");

console.log("\n2) ייצוא הסימונים מצופה הטופס");
const exportFn = extractMethod(app, "_mcExportOpenViewerPdf");
const saveFn = extractMethod(app, "_mcSaveRailForm");
const persistFn = extractMethod(app, "_persistMirrorCall");
const flushFn = extractMethod(app, "_flushMirrorPersist");
assert(exportFn.includes("giExportPdf"), "שמירה קוראת ל-giExportPdf");
assert(exportFn.includes("_mcNormalizeViewerSavedPdf"), "אחרי ייצוא מסונכרן מראה התיבה");
assert(exportFn.includes("_mcReadOpenViewerFormValues"), "נפילה לקריאת ערכים מהצופה");
assert(exportFn.includes('reject(new Error("timeout"))'), "שמירה לא נתקעת על הצופה");
assert(!exportFn.includes("if(!edits || !edits.length) return base"), "אין שמירה שקטה של טופס בלי הסימונים");
assert(saveFn.includes("immediate: true"), "לחיצת שמירה נכתבת מיד");
assert(saveFn.includes("keepError: true"), "כשל בשמירה לשרת לא נבלע");
assert(saveFn.includes("_mcReadOpenViewerFormValues"), "ערכי הנציג נשמרים גם במפת העריכות");
assert(flushFn.includes("opts.keepError") || flushFn.includes("opts && opts.keepError"), "persist מדווח על כשל בשמירה ידנית");
assert(persistFn.includes("_flushMirrorPersist(opts)"), "שמירה מיידית מעבירה את דגל השגיאה");

console.log("\n3) הצופה אוסף סימונים לפני כתיבת הקובץ");
assert(viewer.includes("giHarvestWidgets"), "איסוף שדות ל-annotationStorage");
assert(viewer.includes("window.giReadFormValues"), "קריאת ערכי טופס נוכחיים");
assert(viewer.includes("window.giExportPdf"), "ייצוא PDF עם הסימונים");
assert(viewer.includes("data-annotation-id"), "מזהה שדה מתוך שכבת הטופס");
assert(viewer.includes("storage.size <= 0) return pdfDoc.getData()"), "שמירה בלי שינוי לא מוחקת סימונים קיימים");
assert(viewer.includes("active.blur"), "שדה טקסט פתוח נסגר לפני הייצוא");

console.log("\n4) קריאת סימון מה-DOM כולל ערך ייצוא של מנורה");
const readFn = extractMethod(app, "_mcReadViewerDomEdits");
const widgetFn = extractMethod(app, "_mcViewerWidgetExport");
const copyFn = extractMethod(app, "_mcCopyPdfBytes");
const bytesFn = extractMethod(app, "_mcBytesFromViewerExport");
assert(!!readFn && !!widgetFn && !!copyFn && !!bytesFn, "חולצו עוזרי שמירה");
const sandbox = { safeTrim: (v) => (v == null ? "" : String(v).trim()) };
vm.createContext(sandbox);
vm.runInContext(
  "const api = {\n" + widgetFn + ",\n" + readFn + ",\n" + copyFn + ",\n" + bytesFn + "\n}; this.api = api;",
  sandbox
);

function fakeEl(spec){
  return {
    getAttribute(n){
      const map = spec.attrs || {};
      return Object.prototype.hasOwnProperty.call(map, n) ? map[n] : "";
    },
    name: spec.name || "",
    type: spec.type || "checkbox",
    checked: !!spec.checked,
    defaultChecked: !!spec.defaultChecked,
    value: spec.value == null ? "on" : spec.value,
    exportValue: spec.exportValue,
    defaultValue: spec.defaultValue == null ? "" : spec.defaultValue
  };
}

function fakeFrame(fields){
  return { contentDocument: { querySelectorAll(){ return fields; } } };
}

const menoraOn = fakeEl({
  name: "HealthQ1",
  type: "checkbox",
  checked: true,
  defaultChecked: false,
  value: "1",
  attrs: { name: "HealthQ1" }
});
const edits = sandbox.api._mcReadViewerDomEdits(fakeFrame([menoraOn]));
assert(Array.isArray(edits) && edits.length === 1 && edits[0].name === "HealthQ1" && edits[0].export === "1", "סימון מנורה 1 נשמר לפי ערך הייצוא");

const unchanged = fakeEl({
  name: "HealthQ2",
  type: "checkbox",
  checked: true,
  defaultChecked: true,
  value: "Yes",
  attrs: { name: "HealthQ2", exportvalue: "Yes" }
});
const noDiff = sandbox.api._mcReadViewerDomEdits(fakeFrame([unchanged]));
assert(Array.isArray(noDiff) && noDiff.length === 0, "תיבה שלא שונתה לא נחשבת שינוי DOM");

assert(bytesFn.includes("_mcCopyPdfBytes"), "ייצוא הצופה מועתק ולא משתף באפר");
assert(sandbox.api._mcBytesFromViewerExport(null) === null, "ייצוא ריק נדחה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
