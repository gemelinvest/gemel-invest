/* GI-MIRROR 2026-08-27 — שלב 2 פרטי מבוטח/ים:
   נוסח ההקראה הוא רק «ברשותך אשאל אותך מספר שאלות.»
   בלי שם מלא / ת.ז / תאריך לידה וכו׳.
   הרצה: node _test-mirror-step2-script.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260827-clal-exe-zip-v1";
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

const html = read("index.html");
const sw = read("service-worker.js");
const app = read("app.js");

const verifyStart = html.indexOf('id="mcStepVerifyWrap"');
const verifyEnd = html.indexOf('id="mcStep2Wrap"');
const verifyBlock = verifyStart >= 0 && verifyEnd > verifyStart ? html.slice(verifyStart, verifyEnd) : "";

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) נוסח הקראה בשלב 2");
assert(!!verifyBlock, "פאנל שלב 2 פרטי מבוטח/ים נמצא");
assert(verifyBlock.includes("שלב 2 · פרטי מבוטח/ים"), "כותרת שלב 2");
assert(verifyBlock.includes("נוסח להקראה ללקוח"), "תיבת נוסח להקראה");
assert(verifyBlock.includes(">ברשותך אשאל אותך מספר שאלות.<"), "הנוסח הוא המשפט הקצר בלבד");
assert(!verifyBlock.includes("מהו שמך המלא"), "אין הקראת שם מלא");
assert(!verifyBlock.includes("מספר ת.ז"), "אין הקראת תעודת זהות");
assert(!verifyBlock.includes("תאריך לידה?"), "אין הקראת תאריך לידה");
assert(!verifyBlock.includes("מצב משפחתי?"), "אין הקראת שאר שאלות ברצף");
assert(!app.includes("מהו שמך המלא? מספר ת.ז"), "app.js לא מחזיר את הנוסח הישן");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
