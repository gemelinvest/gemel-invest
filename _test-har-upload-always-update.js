/* GI-HAR-UPLOAD-ALWAYS-UPDATE 2026-09-12
   העלאת הר ביטוח: קובץ שכבר בתיק לא נחסם — אחרי אישור הנתונים מתעדכנים.
   הרצה: node _test-har-upload-always-update.js
*/
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260913-menora-health-decl-v5";
let failed = 0;
let passed = 0;
function assert(cond, msg){
  if(cond){ passed += 1; console.log("  PASS  " + msg); }
  else { failed += 1; console.error("  FAIL  " + msg); }
}
function read(name){ return fs.readFileSync(path.join(ROOT, name), "utf8"); }

const wiz = read("gi-wizard.js");
const app = read("app.js");

console.log("1) syntax + markers");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(wiz.includes("GI-HAR-UPLOAD-ALWAYS-UPDATE"), "always-update marker");
assert(wiz.includes("המשך ועדכן"), "confirm continue label");
assert(wiz.includes("קובץ זה כבר שמור בתיק הלקוח"), "known-file warning copy");
assert(wiz.includes("רענון מלא של פוליסות שהגיעו מהר הביטוח"), "refresh HAR policies after approve");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build tag");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app wizard cache tag");

console.log("\n2) rejectRecycled no longer hard-blocks");
const start = wiz.indexOf("async rejectRecycledHarBituachFile");
const end = wiz.indexOf("async handleHarBituachFile", start);
const fn = wiz.slice(start, end);
assert(fn.includes("showCancel: true"), "recycled/known prompts allow cancel+continue");
assert(fn.includes("return !ok"), "continue when agent confirms");
assert(!fn.includes("showCancel: false"), "no hard-only alert in rejectRecycled");
assert(fn.includes("אחרי אישור הייבוא הנתונים יתעדכנו"), "promises data update after approve");

console.log("\n3) approve path refreshes imported rows");
const mergeArea = wiz.slice(wiz.indexOf("/* רענון מלא של פוליסות"), wiz.indexOf("unlockExistingPolicyActionsAfterHarImport"));
assert(mergeArea.includes("importedFromHarBituach"), "clears previous HAR rows");
assert(mergeArea.includes("mergeImportedExistingPolicy"), "re-merges from approved file");
assert(mergeArea.includes("markHarBituachAcknowledged"), "ack updated after approve");

if(failed){ console.error("\nFAILED " + failed + "/" + (passed+failed)); process.exit(1); }
console.log("\nOK " + passed + "/" + passed);
