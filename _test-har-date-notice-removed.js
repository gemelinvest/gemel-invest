/* GI-WIZARD 2026-09-09 — הסרת חלונית תאריך הר הביטוח במעבר לשלב 2.
   הרצה: node _test-har-date-notice-removed.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260909-version-resume-v1";
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

function sliceBetween(src, startToken, endToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  const end = src.indexOf(endToken, start + startToken.length);
  if(end < 0) return src.slice(start);
  return src.slice(start, end);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");

console.log("1) syntax + wizard cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app.js wizard version");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard.js build mark");

console.log("\n2) החלונית הוסרה, המעבר לשלב הבא נשאר");
assert(wiz.includes("async ensureHarDateUploadNoticeAck()"), "ensureHarDateUploadNoticeAck קיים");
const noticeFn = sliceBetween(wiz, "async ensureHarDateUploadNoticeAck(){", "async nextStep(){");
assert(noticeFn.includes("return true"), "הפונקציה מחזירה true בלי מודאל");
assert(!noticeFn.includes("showWizardHarAlertModal"), "אין פתיחת מודאל בחלונית התאריך");
assert(!noticeFn.includes("משתמש יקר, שים לב"), "אין כותרת החלונית");
assert(!noticeFn.includes("מהיום לא נדרש להסיר את התאריך"), "אין טקסט החלונית");
assert(!wiz.includes("מהיום לא נדרש להסיר את התאריך מקובץ הר הביטוח"), "הטקסט הוסר מהאשף");
assert(wiz.includes("const acked = await this.ensureHarDateUploadNoticeAck()"), "קריאות המעבר לשלב הבא נשארו");
assert(wiz.includes("showWizardHarAlertModal"), "התראות אחרות באשף נשארו");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
