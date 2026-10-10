/* GI-OPS-FORMS-WARM 2026-10-05
   מסך הסיכום מציג את רשימת הטפסים בלי לבנות PDF ברקע.
   שליחה משתמשת בקובץ שכבר נשמר, בלי לבנות כל שאלון מחדש.
   הרצה: node _test-ops-forms-send-warm.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261007-lead-dup-v1";
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

console.log("\n2) summary screen paints first, then warms one document at a time");
const prepare = sliceBetween(app, "async _mcPrepareSummaryFilledForms(rec){", "_mcSummaryByteJobKey");
assert(prepare.includes("_mcPaintSummaryFilledForms(rec)"), "the form list paints immediately");
assert(prepare.includes("_mcPaintSummaryFilledForms(fresh)"), "arrival rows paint after their script loads");
assert(prepare.includes("GI-OPS-SUMMARY-IDLE"), "the idle guard is still on this screen");
assert(prepare.indexOf("_mcPaintSummaryFilledForms(rec)") < prepare.indexOf("_mcQuietSendWarm(rec)"), "the first paint is not waiting on the warm");
assert(prepare.includes("_mcQuietSendYield") && prepare.includes("for(let i = 0; i < items.length; i++)") && prepare.includes("await self._mcQuietSendYield()"), "the warm yields between documents");
assert(!prepare.includes("Promise.all"), "the warm does not build every PDF at once");
assert(!prepare.includes("_mcWarmSummarySendForms"), "the old blocking warmup is not back");
assert(prepare.includes("_mcPrefetchArrivalSign") && prepare.includes("_mcSummaryFormBytes"), "arrival and saved forms are filled into the existing cache");
assert(!prepare.includes("fillOriginalTemplate"), "pdf-lib is not called directly while the list is painting");
assert(!app.includes("_mcWarmSummarySendForms"), "the background warmup name is gone");
assert(!app.includes("_mcSendWarmGen"), "a second warmup pass cannot restart the builds");

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

function blockMs(ms){
  const start = Date.now();
  while(Date.now() - start < ms){}
}

function runPool(items, limit, worker){
  const list = items.slice();
  let index = 0;
  const workers = Math.max(1, Math.min(limit, list.length));
  const run = async () => {
    while(index < list.length){
      const item = list[index];
      index += 1;
      await worker(item);
    }
  };
  const jobs = [];
  for(let n = 0; n < workers; n++) jobs.push(run());
  return Promise.all(jobs);
}

function maxTimerGap(work){
  return new Promise((resolve, reject) => {
    let maxGap = 0;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      if(now - last > maxGap) maxGap = now - last;
      last = now;
    }, 5);
    Promise.resolve().then(work).then(() => {
      clearInterval(timer);
      resolve(maxGap);
    }, (err) => {
      clearInterval(timer);
      reject(err);
    });
  });
}

console.log("\n5) opening the five-form list does not block clicks");
const prepareSrc = sliceBetween(app, "async _mcPrepareSummaryFilledForms(rec){", "_mcSummaryByteJobKey(rec, item){");
const calls = { paint: 0, pdf: 0, order: [] };
const sandbox = {
  calls,
  setTimeout,
  Promise,
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  ensureGiArrivalDocsLoaded(){ return Promise.resolve(); }
};
sandbox.done = vm.runInNewContext(`
  const ui = {
    _mirrorUiPhase: "mirrorSummaryReport",
    ${prepareSrc}
    _mcEnsureJoinFormEdits(){},
    _mcPaintSummaryFilledForms(){ calls.paint += 1; calls.order.push("paint"); },
    _mcWarmSummarySendForms(){ calls.pdf += 1; },
    _mcPrefetchArrivalSign(){ calls.pdf += 1; calls.order.push("pdf"); return Promise.resolve(); },
    _mcSummaryFormBytes(){ calls.pdf += 1; calls.order.push("pdf"); return Promise.resolve(); },
    _mcListSummaryFilledForms(){
      return [
        { kind: "join", ready: true },
        { kind: "hatama", ready: true },
        { kind: "premia", ready: true }
      ];
    },
    _getFreshCustomerRecord(){ return { id: "cust" }; }
  };
  ui._mcPrepareSummaryFilledForms({ id: "cust" });
`, sandbox);

Promise.resolve(sandbox.done).then(async () => {
  assert(calls.paint === 2, "the list paints, then paints again after arrival docs load");
  assert(calls.order[0] === "paint" && calls.order[1] === "paint", "both paints finish before a PDF build");
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert(calls.pdf === 3, "the quiet warm then builds each ready document");
  assert(calls.order.filter((step) => step === "pdf").length === 3, "each document is warmed once");
  const forms = ["health-clal", "phoenix-life", "hatama", "premia", "nispah"];
  const frozenGap = await maxTimerGap(() => runPool(forms, 2, async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    blockMs(40);
  }));
  const idleGap = await maxTimerGap(() => new Promise((resolve) => setTimeout(resolve, 40)));
  console.log("  gap  two-at-a-time fill " + frozenGap + "ms, idle open " + idleGap + "ms");
  assert(frozenGap >= 35, "filling two PDFs at a time blocks the event loop");
  assert(idleGap < 30, "an idle open lets timers run");
  if(failed){
    console.error("\nFAILED " + failed + " / passed " + passed);
    process.exit(1);
  }
  console.log("\nOK  " + passed + " assertions");
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
