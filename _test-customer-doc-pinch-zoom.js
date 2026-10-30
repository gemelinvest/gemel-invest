/* GI-DOC-PINCH 2026-10-30
   מסמך שנפתח בתיק לקוח גדל בצביטת אצבעות, בלי להזיז את שאר המערכת.
   הרצה: node _test-customer-doc-pinch-zoom.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
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

function sliceBetween(src, startToken, endToken){
  const start = src.indexOf(startToken);
  const end = src.indexOf(endToken, start + startToken.length);
  if(start < 0 || end < 0) return "";
  return src.slice(start, end);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=20261007-lead-dup-v1") && html.includes("giDocZoom=1"), "app.js cache loads the zoom");
assert(html.includes("app.css?v=20261007-lead-dup-v1&giDocs=1") && html.includes("giDocZoom=1"), "app.css cache loads the zoom");

console.log("\n2) opened document is the only zoom surface");
const preview = sliceBetween(app, "renderDocumentPreviewInner(rec, docId, options = {}){", "paintDocumentPreviewPane(pane, html){");
assert(preview.includes('data-cf-doc-zoom'), "preview body accepts pinch");
assert(preview.includes("cfFile__documentsZoomStage"), "document sits on a zoom stage");
assert(!preview.includes("customerFull"), "zoom markup is not the whole file");
const show = sliceBetween(app, "async showCustomerDocumentPreview(docId){", "denyOfficialJoinFormDownload(){");
assert(show.includes("paintDocumentPreviewPane"), "opening a document arms the zoom surface");
assert(app.includes("void this.showCustomerDocumentPreview(docId)"), "row click still opens the preview");
assert(!show.includes("triggerDataUrlDownload"), "zoom does not download the file");
const frame = sliceBetween(app, "renderPdfPreviewFrame(title, url, options = {}){", "async ensureCustomerDocumentPreviewModule");
assert(frame.includes("cfFile__documentsPreviewFrame") && frame.includes("src"), "PDF preview still has an iframe");
assert(app.includes("bindCustomerDocPinchZoom"), "pinch is bound for the customer file");

console.log("\n3) two fingers enlarge, one finger still moves the page");
const zoom = sliceBetween(app, "/* GI-DOC-PINCH-START", "/* GI-DOC-PINCH-END */");
assert(zoom.includes('ev.touches.length >= 2'), "pinch starts with two fingers");
assert(zoom.includes("touch-action") === false, "behavior lives in script, not a copied css string");
assert(zoom.includes("{ passive: false }"), "pinch can cancel the browser page zoom");
assert(zoom.includes("mode: \"pan\""), "one finger pans the opened document");
assert(css.includes(".cfFile__documentsPreviewBody[data-cf-doc-zoom]") && css.includes("touch-action: none"), "the preview owns the touch, not the whole screen");
assert(css.includes(".cfFile__documentsPreviewFrame.is-cf-pdf-drawn"), "drawn PDF pages replace the iframe for touch");
assert(css.includes("min(68vh, 780px)"), "preview pane stays tall");

console.log("\n4) zoom stays between fit and 4x and keeps the fingers' point");
const sandbox = { Math, Number, console };
vm.createContext(sandbox);
vm.runInContext(zoom + "\nthis.giDocZoomClamp = giDocZoomClamp; this.giDocZoomScroll = giDocZoomScroll;", sandbox);
assert(sandbox.giDocZoomClamp(0.2) === 1, "cannot shrink below the fitted page");
assert(sandbox.giDocZoomClamp(9) === 4, "zoom stops at 4x");
assert(sandbox.giDocZoomClamp(2.5) === 2.5, "a pinch between the limits is kept");
const parked = sandbox.giDocZoomScroll(0, 200, 1, 2);
assert(parked === 200, "the point under the fingers stays put when enlarging");
assert(sandbox.giDocZoomScroll(200, 200, 2, 1) === 0, "pinch out returns that point to the fit view");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
