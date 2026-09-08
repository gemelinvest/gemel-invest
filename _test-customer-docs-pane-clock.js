/* GI-CUSTOMER-DOCS-PANE-CLOCK 20260908-daily-sales-v4
   Independent file-list / preview scroll, no select-all, elapsed download clock.
   Run: node _test-customer-docs-pane-clock.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260908-daily-sales-v4";
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
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");

console.log("1) syntax + cache tag unchanged");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD tag");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build tag unchanged");

console.log("\n2) independent scroll panes");
assert(css.includes(".cfFile__main:has(.cfFile__documentsSplit)"), "documents tab stops the outer scroll");
assert(css.includes("overscroll-behavior: contain"), "inner panes contain scroll");
assert(css.includes(".cfFile__documentsList") && css.includes("overflow: auto"), "file list has its own overflow");
assert(css.includes(".cfFile__documentsPreviewBody"), "preview body still exists");
assert(css.includes("height: 100%") && css.includes("max-height: 100%"), "split is height-bounded");
assert(app.includes("data-cf-doc-preview-pane"), "preview pane stays");
assert(app.includes("data-cf-doc-preview"), "row click preview stays");

console.log("\n3) select-all removed; per-row select stays");
assert(!app.includes("data-doc-select-all"), "no documents select-all checkbox");
assert(!app.includes('aria-label="בחר הכל"'), "no documents select-all aria");
assert(app.includes("data-doc-select"), "row checkboxes remain");
assert(app.includes("הורד נבחרים"), "download selected remains");
assert(html.includes("בחר הכל"), "team-agents select-all elsewhere is untouched");

console.log("\n4) elapsed clock on customer-file downloads, fill engines unchanged");
assert(app.includes('data-doc-dl-clock'), "overlay has elapsed clock");
assert(app.includes("startGiDocDownloadElapsedClock"), "clock ticker starts with overlay");
assert(app.includes("runWithGiDocDownloadClock"), "shared clock wrapper");
assert(app.includes('עברו "'), "elapsed copy");
assert(app.includes("runWithGiDocDownloadClock(\"מפיק PDF…\", () => this.downloadFollowupQuestionnaireDoc"), "followup download uses clock");
assert(app.includes("runWithGiDocDownloadClock(\"מפיק PDF…\", () => Wizard.exportOperationalPdfPageByPage"), "ops report download uses clock");
assert(app.includes("runWithGiDocDownloadClock(\"מוריד מסמך…\""), "stored file download uses clock");
assert(app.includes("runWithGiDocDownloadClock(\"מפיק PDF…\", () => AgentAppointmentPdf.downloadForCustomer"), "agent appointment download uses clock");
const arrivalFn = sliceBetween(app, "async downloadArrivalDoc(rec, kind, sourceBtn){", "async appendArrivalNispahPreview");
assert(arrivalFn.includes("showGiDocDownloadOverlay"), "arrival pack still uses the same overlay");
assert(app.includes("fillFollowupPdf"), "followup fill engine name unchanged");
assert(app.includes("exportOperationalPdfPageByPage"), "ops export name unchanged");
assert(wiz.includes("async exportOperationalPdfPageByPage"), "wizard export function stays");
assert(css.includes(".cfDocDownloadOverlay__clock"), "clock CSS");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK  " + passed + " assertions");
