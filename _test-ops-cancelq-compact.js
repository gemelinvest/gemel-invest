/* GI-OPS 2026-09-24 — שאלון ביטול: שורה קומפקטית, מולא מההצעה, ניתן לעריכה.
   הרצה: node _test-ops-cancelq-compact.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260924-manager-toast-yield-v1";let failed = 0;
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
  const end = src.indexOf(endMark, start + startMark.length);
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
assert(app.includes('BUILD = "' + APP_TAG + '"'), "app.js BUILD");

console.log("\n2) שורה קומפקטית ועריכה");
const body = sliceBetween(app, "_renderCancelQuestionnaireBody(rec){", "_renderCancelQIfNotBlock(store, items){");
assert(body.includes("mcCancelQRow"), "שורת ביטול קומפקטית");
assert(body.includes("data-mc-cancelq-status"), "סוג הביטול ניתן לעריכה");
assert(body.includes("data-mc-cancelq-reason"), "הנימוק ניתן לעריכה");
assert(body.includes("data-mc-cancelq-method-select"), "אופן השליחה ניתן לעריכה");
assert(body.includes("data-mc-cancelq-confirm"), "כן/לא נשאר");
assert(!body.includes("mcCancelQCard__wizardNote--empty"), "אין תיבת ריקה של האשף");
assert(body.includes("_mcSeedCancelQFromProposal(rec)"), "השורה נפתחת ממה שסומן בהצעה");
assert(css.includes(".mcCancelQRow__main{"), "עיצוב שורה");
assert(css.includes(".mcCancelQRow__fact strong{"), "כתב גדול לנתונים");

console.log("\n3) דוח השינויים");
assert(app.includes('["status", "סוג ביטול"]'), "סוג ביטול בדוח");
assert(app.includes('["reason", "נימוק ביטול"]'), "נימוק בדוח");
assert(app.includes("_onCancelQReasonInput(input){"), "עריכת נימוק נשמרת");
assert(app.includes("_onCancelQStatusChange(sel){"), "עריכת סוג ביטול נשמרת");
assert(app.includes("needsAnalysisReason: reason"), "הנימוק נכתב גם לתיק");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
