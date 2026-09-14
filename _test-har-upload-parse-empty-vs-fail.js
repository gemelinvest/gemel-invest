/* GI-HAR-PARSE-EMPTY-VS-FAIL 2026-09-14
   העלאת הר ביטוח בשלב 2: כשל קריאה ≠ קובץ ריק.
   הרצה: node _test-har-upload-parse-empty-vs-fail.js
*/
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260914-cf-form-modal-close-v1";
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

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(wiz.includes("GI-HAR-PARSE-EMPTY-VS-FAIL"), "parse-vs-empty marker");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build tag");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app wizard cache tag");

console.log("\n2) parser reports headerFound and keeps existing filters");
const parseFn = sliceBetween(wiz, "parseHarBituachWorkbook(buffer, ins){", "mergeImportedExistingPolicy(ins, policy, fileName){");
assert(parseFn.includes("let headerFound = false"), "tracks headerFound");
assert(parseFn.includes("headerFound = true"), "sets headerFound after valid headers");
assert(parseFn.includes("headerFound }"), "returns headerFound");
assert(parseFn.includes("GI_HAR_ORIGIN_SHEET"), "skips origin stamp sheet");
assert(parseFn.includes("/תעודת\\s*זהות/"), "flexible id header like elementary");
assert(parseFn.includes("/ענף\\s*ראשי/"), "flexible main-branch header");
assert(parseFn.includes("isHealthLifeRow"), "health/life filter unchanged");
assert(parseFn.includes("isElementaryRow"), "elementary link scan unchanged");

console.log("\n3) upload path: fail vs empty vs mismatch");
const handleStart = wiz.indexOf("async handleHarBituachFile(ins, file){");
const handleEnd = wiz.indexOf("clearHarBituachImportedData(ins){", handleStart);
const handleFn = wiz.slice(handleStart, handleEnd);
assert(handleFn.includes("parsed?.headerFound === true"), "reads headerFound");
assert(handleFn.includes("harFileBelongsToInsured(ins, fileIdNumbers)"), "ID check runs on upload");
assert(handleFn.includes('idCheck.reason === "id_mismatch"'), "only id_mismatch blocks");
assert(handleFn.includes("showHarIdMismatchModal"), "mismatch uses existing modal");
assert(handleFn.includes("לא ניתן לקרוא את הקובץ"), "parse-fail title");
assert(handleFn.includes("אין היסטוריית ביטוחים למבוטח בקובץ זה"), "true-empty copy kept");

const failBlock = sliceBetween(handleFn, "if(!headerFound){", "const idCheck");
assert(failBlock.includes('status: "error"'), "parse-fail is error");
assert(failBlock.includes("fileUploaded: false"), "parse-fail does not mark uploaded");
assert(!failBlock.includes("markHarBituachAcknowledged"), "parse-fail does not ack empty");
assert(!failBlock.includes("storeHarBituachOriginalFile"), "parse-fail does not store original");

const mismatchBlock = sliceBetween(handleFn, 'idCheck.reason === "id_mismatch"', "if(!policies.length)");
assert(mismatchBlock.includes('status: "error"'), "mismatch is error");
assert(mismatchBlock.includes("fileUploaded: false"), "mismatch does not mark uploaded");
assert(!mismatchBlock.includes("markHarBituachAcknowledged"), "mismatch does not ack");

const emptyBlock = sliceBetween(handleFn, "if(!policies.length){", "const approved");
assert(emptyBlock.includes("markHarBituachAcknowledged"), "true-empty still acks");
assert(emptyBlock.includes('status: "empty"'), "true-empty status kept");
assert(emptyBlock.includes("הקובץ נדבק"), "true-empty still uses stuck copy");

console.log("\n4) recycled warning and import-refresh stay intact");
const rejectFn = sliceBetween(wiz, "async rejectRecycledHarBituachFile", "async handleHarBituachFile");
assert(rejectFn.includes("המשך ועדכן"), "continue-and-update kept");
assert(rejectFn.includes("return !ok"), "confirm still continues");
const mergeArea = sliceBetween(wiz, "/* רענון מלא של פוליסות", "unlockExistingPolicyActionsAfterHarImport");
assert(mergeArea.includes("importedFromHarBituach"), "still refreshes HAR rows after approve");
assert(mergeArea.includes("mergeImportedExistingPolicy"), "still merges approved policies");

console.log("\n5) runtime: variant official headers parse, junk still rejected");
const exactId = [/^תעודת זהות$/, /^מספר תעודת זהות$/];
const flexId = [/^תעודת זהות$/, /^מספר תעודת זהות$/, /תעודת\s*זהות/, /מספר\s*תעודת\s*זהות/, /מספר\s*זהות/];
const variantId = "מספר תעודת זהות של מבוטח";
assert(!exactId.some((p) => p.test(variantId)), "old exact id matcher misses variant header");
assert(flexId.some((p) => p.test(variantId)), "new id matcher accepts variant header");

const flexMatchers = {
  idNumber: flexId,
  main: [/^ענף ראשי$/, /ענף\s*ראשי/],
  company: [/^חברה$/, /שם חברה/, /חברה/],
  policyNumber: [/^מספר פוליסה$/, /מספר\s*פוליסה/, /פוליסה/]
};
function requiredHits(row){
  const required = ["idNumber", "main", "company", "policyNumber"];
  return required.reduce((n, key) => n + (flexMatchers[key].some((p) => row.some((cell) => p.test(String(cell || "")))) ? 1 : 0), 0);
}
assert(requiredHits(["מספר תעודת זהות של מבוטח", "ענף ראשי", "שם חברה", "מספר פוליסה"]) >= 3, "official-like header row meets requiredHits");
assert(requiredHits(["שם", "כתובת", "טלפון", "הערות"]) < 3, "unrelated sheet still below requiredHits");

if(failed){ console.error("\nFAILED " + failed + "/" + (passed+failed)); process.exit(1); }
console.log("\nOK " + passed + "/" + passed);
