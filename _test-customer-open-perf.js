/* GI-PERF 2026-09-09 — פתיחת תיק לא נתקעת מול משיכת 10 payload-ים ברצף.
   Run: node _test-customer-open-perf.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260913-clal-couple-health-decl-v7";
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
  const end = src.indexOf(endToken, start + startToken.length);
  if(start < 0 || end < 0) return "";
  return src.slice(start, end);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html bumps app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html bumps app.css cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache bumped");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD tag");

console.log("\n2) list hydrate is one-at-a-time and yields to file open");
const hydrate = sliceBetween(app, "ensureVisibleListPayloads(){", "async _fillOneVisibleListPayload(){");
assert(hydrate.includes("perfIdle"), "list hydrate waits for idle before fetching");
assert(hydrate.includes("_isCustomerFileBlockingListHydrate"), "list hydrate checks open file");
assert(hydrate.includes("900"), "idle timeout lets a click win");
const fill = sliceBetween(app, "async _fillOneVisibleListPayload(){", "render(options = {}){");
assert(fill.includes("missing[0]"), "fills a single visible row, not the whole list");
assert(!fill.includes("for(const rec of missing)"), "no sequential for-loop over all visible payloads");
assert(fill.includes("_isCustomerFileBlockingListHydrate"), "aborts after await if a file opened");
assert(fill.includes("skipId"), "does not fetch the customer being opened");
assert(app.includes("_markCustomerFileOpening"), "open path marks opening before fetch");
const click = sliceBetween(app, "handleOpenCustomerClick(ev, customerId){", "handleArchiveCustomerClick(ev, customerId){");
assert(click.includes("_markCustomerFileOpening(id)"), "row click marks opening before loader");
assert(click.includes("this.openByIdWithLoader(id)"), "row click still opens the file");
const loader = sliceBetween(app, "openByIdWithLoader(id, delay=120){", "byId(id){");
assert(loader.includes("_markCustomerFileOpening(safeId)"), "loader marks opening immediately");
assert(loader.includes("this.openById(safeId)"), "loader still opens by id");

console.log("\n3) blob offload deferred until the file is stable");
const offload = sliceBetween(app, "queueCustomerFileBlobOffload(rec){", "renderTabBar(rec, policies){");
assert(offload.includes("_FILE_BLOB_OFFLOAD_DELAY_MS"), "uses named offload delay");
assert(app.includes("_FILE_BLOB_OFFLOAD_DELAY_MS: 8000"), "open-file offload waits 8s, not 1.8s");
assert(!offload.includes(", 1800)"), "removed 1800ms competing offload");
assert(offload.includes("persistCustomerPayloadRecord"), "same persist slim path");
assert(offload.includes("_openingCustomerId"), "offload waits while a file is opening");
assert(offload.includes("_flushCustomerFileBlobOffloadOnClose"), "close still schedules slim");
assert(app.includes("_flushCustomerFileBlobOffloadOnClose(closingId)"), "close flushes pending offload");

console.log("\n4) open/save payload path unchanged");
assert(app.includes("async ensureRecordPayload(stateKey, id){"), "ensureRecordPayload intact");
assert(app.includes('selectExpr = rec ? "id,payload"'), "cold open still fetches payload");
assert(app.includes("_omitEmptyPayloadForWrite(row){"), "write guard intact");
assert(app.includes("afterOpen({ skipImmediatePull: true })"), "cold open still skips duplicate call pull");
assert(app.includes("startOpenFileCallWatch()"), "call watch still starts");
assert(app.includes("_openFileCallSessionThinSelect"), "thin call-session select stays");

console.log("\n-----");
console.log("passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
