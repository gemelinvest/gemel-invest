/* GI-OPS-FORMS-WARM 2026-10-05
   מסך הסיכום בתפעול מכין את הטפסים מראש.
   שליחה משתמשת בקובץ שכבר נשמר, בלי לבנות כל שאלון מחדש.
   הרצה: node _test-ops-forms-send-warm.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261005-ops-forms-warm-v1";
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

function sliceBetween(src, start, end){
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  if(a < 0 || b < 0) return "";
  return src.slice(a, b);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sign = fs.readFileSync(path.join(ROOT, "gi-sign.js"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-forms-send-warm.js")]).status === 0, "node --check this test");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD");
assert(html.includes("app.js?v=" + TAG), "index.html loads the new app.js");

console.log("\n2) summary screen warms forms before send");
const prepare = sliceBetween(app, "async _mcPrepareSummaryFilledForms(rec){", "_mcSummaryByteJobKey");
assert(prepare.includes("void this._mcWarmSummarySendForms(rec)"), "warm starts with the form list");
assert(prepare.includes("void this._mcWarmSummarySendForms(fresh)"), "warm restarts after arrival docs load");
const warm = sliceBetween(app, "async _mcWarmSummarySendForms(rec){", "_mcPushArrivalSummaryRows");
assert(warm.includes("this._mcRunPool(items, 2"), "two forms are prepared at a time");
assert(warm.includes("window.setTimeout(resolve, 0)"), "the screen can paint between forms");
assert(warm.includes("_mcPrefetchArrivalSign"), "hatama, premia and nispah start before the click");
assert(warm.includes("_mcSummaryFormBytes"), "join and followup bytes are built before the click");

console.log("\n3) send reuses a saved or in-flight file");
const summary = sliceBetween(app, "async _mcSummaryFormBytes(rec, item){", "async _mcBuildSummaryFormBytes");
assert(summary.indexOf("_mcInstantSummaryPdf") < summary.indexOf("_mcBuildSummaryFormBytes"), "saved bytes win before a new build");
assert(summary.includes("_mcSummaryByteJobs"), "a second caller waits for the build already running");
const follow = sliceBetween(app, "async _mcOriginalFollowupSignBytes(rec, item){", "_mcFollowCacheKey(rec, entry){");
assert(follow.includes("if(saved && saved.length){"), "a saved followup is sent as-is");
assert(follow.indexOf("if(saved && saved.length){") < follow.indexOf("fillFollowupPdf"), "saved followup is not filled again");
assert(!follow.includes("&& !hasAnswers"), "answers no longer force a refill of a saved followup");
const materialize = sliceBetween(app, "async _mcMaterializeEditedForms(rec){", "_mcHealthYesSummaryHtml");
assert(materialize.includes("this._mcFollowCacheKey(rec, entry)"), "materialize stores the key send reads");
const hydrate = sliceBetween(app, "_mcHydrateFilledFormsFromCache(rec){", "async _mcRunPool");
assert(hydrate.includes("this._mcFollowCacheKey(rec, job.entry)"), "hydrate reads the same followup key");
assert(app.includes("const cacheKey = this._mcFollowCacheKey(rec, row.entry);"), "the editor uses the send cache key");

console.log("\n4) click path still yields between documents");
assert(sign.includes("await bytesForSendItem(rec, list[i])"), "send still builds one document after another");
assert(!sign.includes("Promise.all(list.map((item) => bytesForSendItem"), "send does not run every pdf at once");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK  " + passed + " assertions");
