/**
 * File preview: hydrate as blob URL, no main-thread base64.
 * Neighbors prefetch after the current preview paints.
 * Persist bucket, generated docs, and login stay.
 * Run: node _test-perf-file-preview.js
 */
const fs = require("fs");
const { spawnSync } = require("child_process");

const app = fs.readFileSync("app.js", "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

function sliceBetween(src, start, end){
  const i = src.indexOf(start);
  if(i < 0) return "";
  const j = src.indexOf(end, i + start.length);
  return j > i ? src.slice(i, j) : src.slice(i);
}

assert(spawnSync(process.execPath, ["--check", "app.js"]).status === 0, "node --check app.js");
assert(app.includes("GI-PERF files"), "missing GI-PERF files comment");

const storeFn = sliceBetween(app, "const GiCustomerFileStore = {", "try { window.GiCustomerFileStore = GiCustomerFileStore;");
assert(storeFn.includes("URL.createObjectURL(blob)"), "hydrate must use createObjectURL");
assert(storeFn.includes("async readBytes(file){"), "store must expose readBytes");
assert(storeFn.includes("_giHydratedBlob"), "hydrate keeps the Blob in memory");
assert(storeFn.includes("while(this._hydratedBlobUrls.length > 8)"), "blob URLs are revoked after a short cache");
assert(storeFn.includes("oldFile._giHydratedDataUrl = \"\""), "revoked blob URLs are cleared on the file");
assert(storeFn.includes("file._giHydratedBlob"), "hydrate can reuse a Blob already in memory");
assert(!/async hydrate\(file\)\{[\s\S]{0,900}bytesToDataUrl/.test(storeFn), "hydrate must not encode to data URL");
assert(storeFn.includes("preparePayloadForPersist"), "persist slim stays on the store");
assert(storeFn.includes('GI_CUSTOMER_FILES_BUCKET') || app.includes('GI_CUSTOMER_FILES_BUCKET = "gi-customer-files"'), "bucket id unchanged");

const showFn = sliceBetween(app, "async showCustomerDocumentPreview(docId){", "denyOfficialJoinFormDownload(){");
assert(showFn.includes("yieldCustomerDocumentPreviewPaint"), "preview yields a frame before hydrate");
assert(showFn.includes("prefetchNeighborCustomerDocs"), "preview prefetches next/prev files");
assert(showFn.includes("GiCustomerFileStore.hydrate"), "preview still hydrates the selected file");
assert(!showFn.includes("triggerDataUrlDownload"), "preview still does not download");
assert(showFn.includes("_previewFillSeq"), "stale preview fills still cancel");

const prefetchFn = sliceBetween(app, "async prefetchNeighborCustomerDocs(rec, currentId){", "yieldCustomerDocumentPreviewPaint(){");
assert(prefetchFn.includes("idx + 1"), "prefetch looks at the next file");
assert(prefetchFn.includes("idx - 1"), "prefetch looks at the previous file");
assert(prefetchFn.includes("needsHydrate"), "prefetch only hydrates stored files");

const sheetFn = sliceBetween(app, "async renderSheetPreviewHtml(doc){", "renderGeneratedDocumentPreview(rec, doc){");
assert(sheetFn.includes("GiCustomerFileStore.readBytes"), "sheet preview reads bytes, not dataUrlToArrayBuffer on blob URLs");
assert(!sheetFn.includes("dataUrlToArrayBuffer(url)") || sheetFn.indexOf("readBytes") < sheetFn.indexOf("dataUrlToArrayBuffer"), "sheet preview prefers readBytes over data-URL decode");

const harFn = sliceBetween(app, "async downloadHarBituachFileDoc(doc){", "append(payload, doc){");
assert(harFn.includes("GiCustomerFileStore.readBytes"), "har download reads bytes from the store");
assert(!harFn.includes("const buffer = dataUrlToArrayBuffer(url)"), "har download must not assume a data URL");

const resolveFn = sliceBetween(app, "async resolveDocumentBytes(rec, doc){", "async downloadSelectedCustomerDocuments(rec){");
assert(resolveFn.includes("GiCustomerFileStore.readBytes"), "pack/download bytes use readBytes");
assert(resolveFn.includes("companyCancelForm"), "generated cancel PDFs still filled");
assert(resolveFn.includes("followupQuestionnaire"), "generated followup PDFs still filled");

assert(app.includes("function scheduleVisibleViewRender"), "must keep F1.0");
assert(app.includes("const BackgroundSyncGate"), "must keep F1.1");
assert(app.includes("const CAMPAIGN_LEAD_COLUMNS"), "must keep F1.2");
assert(app.includes("function collectHydrationPriorityIds"), "must keep F1.3");
assert(app.includes("GI-PERF F2") || app.includes("CUSTOMER_LIGHT_COLUMNS"), "must keep F2 light columns");
assert(app.includes('client.rpc("gi_verify_agent_login"'), "must not touch login RPC");
assert(app.includes("AGENT_PUBLIC_COLUMNS"), "must keep public agent columns");
assert(app.includes("intervalMs: 120000"), "must not change LiveRefresh interval");

console.log("OK _test-perf-file-preview.js");
