/* GI-CUSTOMER-FILES-STORAGE 20260909-version-resume-v1
   Metadata in the customer record, file bytes in object storage.
   Generated docs stay generated. Uploaded blobs offload on save/open.
   Run: node _test-customer-files-storage.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260909-version-resume-v1";
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
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const sql = fs.readFileSync(path.join(ROOT, "supabase-customer-files-storage.sql"), "utf8");

console.log("1) syntax + cache tag unchanged");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD tag");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build tag unchanged");

console.log("\n2) business logic files were not rewritten");
assert(wiz.includes("getPolicyPremiumAfterDiscount(policy){"), "wizard after-discount helper still exists");
assert(wiz.includes("return this.getPolicyPremiumBeforeDiscount(policy);"), "wizard after-discount stays identity/before");
assert(!/Wizard\.getPolicyPremiumAfterDiscount\s*=(?!=)/.test(app), "app.js does not override wizard after-discount");
assert(app.includes("giSnapshotWithoutDocs"), "ops snapshot still strips nested docs");
assert(app.includes("Wizard.renderOperationalReport"), "ops report still rendered from snapshot");

console.log("\n3) SQL bucket + store wiring");
assert(sql.includes("gi-customer-files"), "SQL creates gi-customer-files bucket");
assert(sql.includes("storage.objects"), "SQL policy on storage.objects");
assert(sql.includes("anon, authenticated"), "SQL keeps anon+authenticated like other tables");
assert(app.includes('GI_CUSTOMER_FILES_BUCKET = "gi-customer-files"'), "bucket id in app.js");
assert(app.includes("const GiCustomerFileStore = {"), "GiCustomerFileStore exists");
assert(app.includes("preparePayloadForPersist"), "persist prepares slim payload");
assert(app.includes("await GiCustomerFileStore.preparePayloadForPersist"), "persistCustomerPayloadRecord offloads blobs");
assert(app.includes("skipAppPersist"), "background offload can skip full App.persist");
assert(app.includes("queueCustomerFileBlobOffload"), "open-file lazy offload exists");
assert(app.includes("GiCustomerFileStore.hydrate"), "preview/download hydrate selected file");

console.log("\n4) list / preview UX stays without requiring inline dataUrl");
assert(app.includes("GiCustomerFileStore.fileLooksPresent"), "elementary files count storagePath");
assert(app.includes("GiCustomerFileStore.needsHydrate"), "preview hydrates stored files");
assert(app.includes("data-cf-doc-preview-pane"), "document preview pane stays");
assert(app.includes("data-cf-doc-preview"), "document row click preview stays");
const persistFn = sliceBetween(app, "async function persistCustomerPayloadRecord(customerId, payload, label, options = {}){", "async function persistCustomerOpsResultLight");
assert(persistFn.includes("preparePayloadForPersist"), "single-customer persist slims files");
assert(persistFn.includes("skipAppPersist"), "background persist does not run full saveSheets");
const showFn = sliceBetween(app, "async showCustomerDocumentPreview(docId){", "denyOfficialJoinFormDownload(){");
assert(showFn.includes("GiCustomerFileStore.hydrate"), "preview hydrates before showing stored file");
assert(!showFn.includes("triggerDataUrlDownload"), "preview still does not download");
const resolveFn = sliceBetween(app, "async resolveDocumentBytes(rec, doc){", "async downloadSelectedCustomerDocuments(rec){");
assert(resolveFn.includes("companyCancelForm"), "generated cancel PDFs still filled");
assert(resolveFn.includes("followupQuestionnaire"), "generated followup PDFs still filled");
assert(resolveFn.includes("GiCustomerFileStore.hydrate"), "uploaded bytes resolved from storage when needed");

console.log("\n5) runtime: generated blobs stripped, uploaded blobs offloaded, failure keeps dataUrl");
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
function arrayBufferToBase64(buffer){
  const bytes = new Uint8Array(buffer || []);
  let binary = "";
  for(let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return Buffer.from(binary, "binary").toString("base64");
}
function dataUrlToArrayBuffer(dataUrl){
  const raw = safeTrim(dataUrl);
  const comma = raw.indexOf(",");
  const b64 = comma >= 0 ? raw.slice(comma + 1) : raw;
  const bin = Buffer.from(b64, "base64");
  return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
}

const uploads = [];
let failUpload = false;
const objects = new Map();
const mockStorage = {
  from(bucket){
    return {
      async upload(path, blob, opts){
        if(failUpload) return { error: { message: "Bucket not found" } };
        uploads.push({ bucket, path, type: blob && blob.type, upsert: !!(opts && opts.upsert) });
        const buf = blob && blob._buf ? blob._buf : new ArrayBuffer(4);
        objects.set(bucket + "/" + path, { buf, type: (blob && blob.type) || "application/octet-stream" });
        return { data: { path }, error: null };
      },
      async download(path){
        const row = objects.get(bucket + "/" + path);
        if(!row) return { data: null, error: { message: "not found" } };
        return {
          data: {
            type: row.type,
            arrayBuffer: async () => row.buf
          },
          error: null
        };
      }
    };
  }
};

class TestBlob {
  constructor(parts, opts){
    const part = parts && parts[0];
    if(part instanceof ArrayBuffer) this._buf = part;
    else if(part && typeof part.byteLength === "number" && part.buffer){
      this._buf = part.buffer.slice(part.byteOffset || 0, (part.byteOffset || 0) + part.byteLength);
    } else if(part && typeof part.byteLength === "number"){
      this._buf = part;
    } else {
      this._buf = new ArrayBuffer(4);
    }
    this.parts = parts;
    this.type = (opts && opts.type) || "";
    this.size = this._buf.byteLength || 0;
  }
}

const storeSrc = sliceBetween(
  app,
  "  const GI_CUSTOMER_FILES_BUCKET = \"gi-customer-files\";",
  "  try { window.GiCustomerFileStore = GiCustomerFileStore; } catch(_e) {}"
);
assert(!!storeSrc && storeSrc.includes("preparePayloadForPersist"), "extracted GiCustomerFileStore source");

const sandbox = {
  window: {},
  ArrayBuffer,
  Uint8Array,
  Buffer,
  safeTrim,
  arrayBufferToBase64,
  dataUrlToArrayBuffer,
  CustomerDocuments: {
    fileExtensionFromName(name){
      const n = safeTrim(name);
      const idx = n.lastIndexOf(".");
      if(idx <= 0) return "";
      const ext = n.slice(idx).toLowerCase();
      return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
    },
    isOfficialJoinFormType(){ return false; }
  },
  Storage: { getClient(){ return { storage: mockStorage }; } },
  Blob: TestBlob,
  Date,
  console
};
vm.createContext(sandbox);
vm.runInContext(storeSrc + "\nthis.GiCustomerFileStore = GiCustomerFileStore;", sandbox);
const store = sandbox.GiCustomerFileStore;

const tinyPdf = "data:application/pdf;base64," + Buffer.from("%PDF-1.4 hi").toString("base64");
const tinyXlsx = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + Buffer.from("xlsx").toString("base64");

const payload = {
  customerDocuments: [
    { id: "ops1", type: "operational_report_health", name: "דוח", dataUrl: tinyPdf, payloadSnapshot: { primary: { firstName: "רות" } } },
    { id: "har1", type: "har_bituach_file", name: "הר ביטוח.xlsx", fileName: "har.xlsx", dataUrl: tinyXlsx, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    { id: "pack1", type: "customer_arrival_pack", name: "מסמך התאמה", dataUrl: tinyPdf }
  ],
  elementaryPolicyFiles: [
    { name: "policy.pdf", dataUrl: tinyPdf }
  ]
};

assert(store.isGeneratedType("operational_report_health"), "health ops is generated");
assert(store.isGeneratedType("customer_arrival_pack"), "arrival pack is generated");
assert(!store.isGeneratedType("har_bituach_file"), "har bituach is uploaded binary");
assert(store.payloadNeedsPersistSlim(payload), "payload with inline blobs needs slim");
assert(store.fileLooksPresent({ storagePath: "c1/doc/a.xlsx", hasFile: true }), "storagePath counts as present");
assert(!store.fileLooksPresent({ name: "empty" }), "name-only is not a stored file");

const beforeSnap = payload.customerDocuments[0].payloadSnapshot;
store.stripGeneratedBlobs(payload);
assert(!payload.customerDocuments[0].dataUrl, "generated ops dataUrl stripped");
assert(payload.customerDocuments[0].payloadSnapshot === beforeSnap, "ops payloadSnapshot kept for preview");
assert(!payload.customerDocuments[2].dataUrl, "generated arrival dataUrl stripped");
assert(!!payload.customerDocuments[1].dataUrl, "har bituach dataUrl kept until upload");

(async () => {
  await store.preparePayloadForPersist("cust_1", payload);
  assert(!payload.customerDocuments[1].dataUrl, "har bituach dataUrl removed after upload");
  assert(safeTrim(payload.customerDocuments[1].storagePath).indexOf("cust_1/") === 0, "har storagePath under customer id");
  assert(payload.customerDocuments[1].hasFile === true, "har hasFile flag set");
  assert(!payload.elementaryPolicyFiles[0].dataUrl, "elementary dataUrl removed after upload");
  assert(!!payload.elementaryPolicyFiles[0].storagePath, "elementary storagePath set");
  assert(uploads.length >= 2, "uploaded only real files, not generated docs");
  assert(uploads.every((u) => u.bucket === "gi-customer-files" && u.upsert === true), "uploads target private bucket with upsert");
  assert(!store.payloadNeedsPersistSlim(payload), "slim payload does not need another persist");

  const hydrated = await store.hydrate(payload.customerDocuments[1]);
  assert(/^data:/.test(hydrated), "hydrate returns dataUrl for the selected file");
  assert(!payload.customerDocuments[1].dataUrl, "hydrate does not write enumerable dataUrl back");
  assert(!!Object.getOwnPropertyDescriptor(payload.customerDocuments[1], "_giHydratedDataUrl"), "hydrate cache is memory-only");

  const persistJson = JSON.parse(JSON.stringify(payload));
  assert(!persistJson.customerDocuments[1].dataUrl, "JSON persist copy has no har blob");
  assert(!persistJson.customerDocuments[1]._giHydratedDataUrl, "JSON persist copy has no hydrate cache");
  assert(!!persistJson.customerDocuments[0].payloadSnapshot, "JSON persist copy keeps ops snapshot");

  failUpload = true;
  const fallback = {
    customerDocuments: [
      { id: "har2", type: "har_bituach_file", name: "har2.xlsx", fileName: "har2.xlsx", dataUrl: tinyXlsx }
    ]
  };
  await store.preparePayloadForPersist("cust_2", fallback);
  assert(!!fallback.customerDocuments[0].dataUrl, "upload failure keeps dataUrl");
  assert(!fallback.customerDocuments[0].storagePath, "upload failure does not pretend storagePath exists");

  const generatedOnly = {
    customerDocuments: [
      { id: "ops2", type: "operational_report_health", dataUrl: tinyPdf, payloadSnapshot: { ok: true } }
    ]
  };
  const changed = await store.preparePayloadForPersist("cust_3", generatedOnly);
  assert(changed === true, "stripping generated leftover blobs counts as a slim");
  assert(!generatedOnly.customerDocuments[0].dataUrl, "generated leftover blob gone without storage");

  if(failed){
    console.error("\nFAILED " + failed + " / passed " + passed);
    process.exit(1);
  }
  console.log("\nOK  " + passed + " assertions");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
