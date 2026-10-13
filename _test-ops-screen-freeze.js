/* Ops screens stay responsive: dashboard repaints the list body only,
   and document downloads release canvas bitmaps and hydrated blobs.
   Run: node _test-ops-screen-freeze.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
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

function sliceBetween(src, start, end){
  const i = src.indexOf(start);
  if(i < 0) return "";
  const j = src.indexOf(end, i + start.length);
  return j > i ? src.slice(i, j) : "";
}

const app = read("app.js");
const wiz = read("gi-wizard.js");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");

console.log("\n2) dashboard repaints the list, keeps the shell");
const dash = sliceBetween(app, "const OpsDashboardUI = {", "const TypingPacketUI = {");
const renderFn = sliceBetween(dash, "render(){", "stopFloatTimer(){");
assert(renderFn.includes("bodyHost.innerHTML = bodyHtml"), "rubric changes replace only the list body");
assert(renderFn.includes("opsDash__head"), "full shell still includes the header");
assert(renderFn.includes("mount.innerHTML"), "missing shell still builds the whole dashboard");
assert(renderFn.includes("this.bindBody(bodyHost)"), "new list rows are bound without rebinding the header");
const quiet = sliceBetween(dash, "quietRefresh(){", "paintKpiValues(");
assert(quiet.includes("quietViewSignature"), "quiet refresh notices queue changes");
assert(quiet.includes("return false"), "missing dashboard still falls back to a full render");
assert(dash.includes("queueSignature(){"), "row scan is cached by a queue signature");
assert(dash.includes("_rowsCache"), "unchanged queue reuses the row model");

console.log("\n3) document memory is released");
const pageExport = sliceBetween(wiz, "async exportOperationalPdfPageByPage", "async downloadOperationalHtmlFallback");
const htmlExport = sliceBetween(wiz, "async exportLcPdfHtmlDocument", "async exportOperationalPdfPageByPage");
assert(pageExport.includes("canvas.width = 0"), "ops report releases the page bitmap");
assert(htmlExport.includes("canvas.width = 0"), "proposal PDF releases the page bitmap");
assert(htmlExport.includes("sliceCanvas.width = 0"), "proposal PDF releases slice bitmaps");
const store = sliceBetween(app, "rememberHydrated(file, dataUrl){", "getStorageApi(){");
assert(store.includes("oldFile._giHydratedBlob = null"), "evicted preview drops the file blob");
assert(store.includes("oldFile._giHydratedDataUrl = \"\""), "evicted preview still clears the blob URL");
const download = sliceBetween(app, "async downloadFileDoc(doc){", "triggerDataUrlDownload(dataUrl, fileName){");
assert(download.includes("doc._giHydratedBlob"), "download uses a blob already in memory");
assert(download.includes("dataUrlToBlob"), "data URL download decodes once");
assert(download.includes("}, 2000)"), "download object URL is revoked after the click");
assert(download.includes("fetch(url)"), "download still falls back if blob decode fails");
const clear = sliceBetween(app, "clearCustomerDocPreviewUrls(){", "rememberCustomerDocPreviewUrl(key, url){");
assert(clear.includes("URL.revokeObjectURL"), "closing a preview revokes its blob URLs");
assert(app.includes("CustomerFileUI.clearCustomerDocPreviewUrls()"), "form save uses the revoke helper");
const frame = sliceBetween(app, "renderPdfPreviewFrame(title, url, options = {}){", "async ensureCustomerDocumentPreviewModule");
assert(frame.includes("dataUrlToBlob"), "preview iframe prefers a blob URL over a data URL");
assert(frame.includes("src"), "preview still renders when blob conversion is unavailable");
const selected = sliceBetween(app, "async downloadSelectedCustomerDocuments(rec){", "async downloadFollowupQuestionnairesZip");
assert(selected.includes("files[fi].bytes = null"), "selected download drops source bytes after the archive exists");

console.log("\n4) other dashboards are untouched");
assert(app.includes("if(!CustomersUI.quietRefresh?.()) CustomersUI.render"), "customer list quiet refresh stays");
assert(app.includes("DashboardUI.scheduleRefreshKpis"), "sales dashboard refresh stays");
assert(!dash.includes("scheduleRefreshKpis"), "ops dashboard does not call the sales KPI scheduler");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
