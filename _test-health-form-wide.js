/* שלב 9 הצהרת בריאות: הטופס הפתוח נמתח לרוחב האזור האפור.
   הרצה: node _test-health-form-wide.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20261002-mirror-360-precall-v1";
let failed = 0;
let passed = 0;

function assert(cond, msg){
  if(cond){
    passed += 1;
    console.log("  PASS  " + msg);
  }else{
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
const css = read("app.css");
const html = read("index.html");
const sw = read("service-worker.js");
const viewer = read("gi-pdf-form-viewer.html");
const mount = extractMethod(app, "_mcMountOriginalForm");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) מתיחה רק בשלב 9");
assert(mount.includes('this._mcFormEditorContext === "customerFile" ? "" : "&wide=1"'), "בשיחת השיקוף הטופס נפתח רחב");
assert(mount.includes('encodeURIComponent(url) + wide'), "דגל הרוחב נכנס לכתובת הצופה");
assert(mount.includes("gi-pdf-form-viewer.html"), "נשאר צופה הטופס המקורי");
assert(!mount.includes("PDFViewer"), "בלי ציור פנימי של השדות");
assert(viewer.includes('params.get("wide") === "1"'), "הצופה מזהה פתיחה רחבה");
assert(viewer.includes("html.giWide"), "הדף הרחב בלי מסגרת אפורה");
assert(viewer.includes("ResizeObserver"), "הרוחב נמדד שוב כשהמסך משתנה");
assert(viewer.includes("((avail - 4) / pageView.width) * pageView.scale"), "הדף ממלא את רוחב האזור");
assert(viewer.includes('currentScaleValue = "page-width"'), "חלון תיק הלקוח נשאר במדידה הקיימת");
assert(viewer.includes("storage.size <= 0) return pdfDoc.getData()"), "שמירה בלי שינוי לא מוחקת סימונים");

console.log("\n3) הרשימה והחלון בתיק נשארים");
assert(css.includes(".mcHealthFormsRail{") && css.includes("flex:0 0 300px;"), "רשימת הטפסים נשארת בצד");
assert(css.includes("max-width:min(1180px,96vw);"), "חלון הטופס בתיק הלקוח לא הורחב");
assert(css.includes(".mcHealthDeclSplit--editor .mcHealthDeclSplit__main{"), "אזור העריכה בשלב 9 נשאר");

const viewerBytes = fs.readFileSync(path.join(ROOT, "gi-pdf-form-viewer.html"));
const crlf = viewerBytes.filter((b, i) => b === 10 && viewerBytes[i - 1] === 13).length;
const bare = viewerBytes.filter((b, i) => b === 10 && viewerBytes[i - 1] !== 13).length;
assert(crlf > 0 && bare === 0, "קובץ הצופה נשאר CRLF");

console.log("\n" + (failed ? "FAILED " + failed : "OK " + passed + " checks"));
process.exit(failed ? 1 : 0);
