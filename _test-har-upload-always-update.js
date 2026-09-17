/* GI-HAR-CROSS-INSURED-UPLOAD 2026-09-17
   העלאת הר ביטוח: זיהוי לפי ת.ז. כשהקובץ כבר עלה למבוטח אחר באותה הצעה.
   הרצה: node _test-har-upload-always-update.js
*/
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260917-har-cross-ins-v1";
let failed = 0;
let passed = 0;
function assert(cond, msg){
  if(cond){ passed += 1; console.log("  PASS  " + msg); }
  else { failed += 1; console.error("  FAIL  " + msg); }
}
function read(name){ return fs.readFileSync(path.join(ROOT, name), "utf8"); }
function sliceBetween(src, startToken, endToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  const end = src.indexOf(endToken, start + startToken.length);
  if(end < 0) return src.slice(start);
  return src.slice(start, end);
}

const wiz = read("gi-wizard.js");
const app = read("app.js");

console.log("1) syntax + markers");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(wiz.includes("GI-HAR-CROSS-INSURED-UPLOAD"), "cross-insured marker");
assert(wiz.includes("קובץ הר ביטוח זה כבר הועלה למבוטח"), "cross-insured warning copy");
assert(wiz.includes("העלה קובץ הר ביטוח אחר"), "upload-other-file button");
assert(wiz.includes("רענון מלא של פוליסות שהגיעו מהר הביטוח"), "refresh HAR policies after approve");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build tag");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app wizard cache tag");

console.log("\n2) no SHA/origin recycle gate before parse");
assert(!wiz.includes("async rejectRecycledHarBituachFile"), "old rejectRecycled removed");
assert(!wiz.includes("קובץ זה כבר שמור בתיק הלקוח"), "same-customer SHA warning removed");
assert(!wiz.includes("המשך ועדכן"), "continue-and-update recycle label removed");
const handleStart = wiz.indexOf("async handleHarBituachFile(ins, file){");
const handleEnd = wiz.indexOf("clearHarBituachImportedData(ins){", handleStart);
const handleFn = wiz.slice(handleStart, handleEnd);
assert(handleFn.indexOf("parseHarBituachWorkbook") < handleFn.indexOf("findOtherProposalInsuredWithHarForFileIds"), "parse before cross-insured check");
assert(handleFn.includes("warnHarFileAlreadyUploadedForOtherInsured"), "warns with other insured name");
assert(handleFn.includes("openHarBituachImport"), "other-file button reopens picker");

console.log("\n3) cross-insured match is by ת.ז. only");
const findFn = sliceBetween(wiz, "findOtherProposalInsuredWithHarForFileIds(currentIns, fileIdNumbers){", "async warnHarFileAlreadyUploadedForOtherInsured");
assert(findFn.includes("normalizeIdValue"), "normalizes IDs");
assert(findFn.includes("padStart(9, \"0\")"), "pads ID for compare");
assert(findFn.includes("hasHarFileUploaded") || findFn.includes("insuredHasPersistedHarBituach"), "requires other insured already has Har");
assert(!findFn.includes("contentSha256"), "does not match by SHA");
assert(!findFn.includes("policyNumber"), "does not match by policy number");

console.log("\n4) approve path still refreshes imported rows");
const mergeArea = wiz.slice(wiz.indexOf("/* רענון מלא של פוליסות"), wiz.indexOf("unlockExistingPolicyActionsAfterHarImport"));
assert(mergeArea.includes("importedFromHarBituach"), "clears previous HAR rows");
assert(mergeArea.includes("mergeImportedExistingPolicy"), "re-merges from approved file");
assert(mergeArea.includes("markHarBituachAcknowledged"), "ack updated after approve");

if(failed){ console.error("\nFAILED " + failed + "/" + (passed+failed)); process.exit(1); }
console.log("\nOK " + passed + "/" + passed);
