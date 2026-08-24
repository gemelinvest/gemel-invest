/* GI-CUSTOMER-DOCS-MULTI-DOWNLOAD 20260825-docs-multi-v1
   Run: node _test-customer-docs-multi-download.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260825-phoenix-fu-v1";
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const modSrc = fs.readFileSync(path.join(ROOT, "gi-followup-zip.js"), "utf8");
const cfgSrc = fs.readFileSync(path.join(ROOT, "gi-followup-zip-config.js"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-followup-zip.js")]).status === 0, "node --check gi-followup-zip.js");

console.log("\n2) multi-select UI wiring");
assert(app.includes("data-doc-select"), "row checkbox attr");
assert(app.includes("data-doc-select-all"), "select-all checkbox");
assert(app.includes("data-download-selected-docs"), "download selected button");
assert(app.includes("הורד נבחרים"), "Hebrew download-selected label");
assert(app.includes("בחר הכל"), "select-all label");
assert(app.includes("downloadSelectedCustomerDocuments"), "downloadSelectedCustomerDocuments method");
assert(app.includes("resolveDocumentBytes"), "resolveDocumentBytes method");
assert(app.includes("_selectedDocIds"), "in-memory selected set");
assert(css.includes("cfFile__documentsToolbar"), "toolbar CSS");
assert(css.includes("cfFile__documentCheck"), "checkbox CSS");

console.log("\n3) pack selected-only with fake JSZip");
class FakeZip {
  constructor(){ this.files = {}; }
  file(name, bytes){ this.files[name] = bytes; }
  generateAsync(){
    return Promise.resolve({
      type: "blob-stub",
      names: Object.keys(this.files),
      count: Object.keys(this.files).length
    });
  }
}
const sandbox = { console, PDFLib: null, JSZip: FakeZip, GI_OFFICIAL_FORM_FILL: { setTextSafe(){}, FONT_FILE: "x" } };
vm.runInNewContext(cfgSrc, sandbox);
vm.runInNewContext(modSrc, sandbox);

(async () => {
  const packed = await sandbox.GiFollowupZip.packFilesIntoZip([
    { fileName: "a.pdf", bytes: new Uint8Array([1, 2, 3]) },
    { fileName: "b.pdf", bytes: new Uint8Array([4, 5]) },
    { fileName: "a.pdf", bytes: new Uint8Array([9]) }
  ]);
  assert(packed.count === 3, "packs exactly 3 selected files");
  assert(packed.names.indexOf("a.pdf") >= 0, "keeps first a.pdf");
  assert(packed.names.some((n) => n.indexOf("a-2") === 0 || n === "a-2.pdf"), "dedupes duplicate names");
  assert(packed.names.indexOf("b.pdf") >= 0, "includes b.pdf");
  assert(packed.names.length === 3, "no extra files beyond selected");

  const empty = await sandbox.GiFollowupZip.packFilesIntoZip([]);
  assert(empty.count === 0, "empty selection yields empty zip");

  console.log("\n4) followup per-doc + cache tag");
  assert(app.includes('followupQuestionnaire: "followup_questionnaire"'), "followup questionnaire type");
  assert(app.includes("createFollowupQuestionnaireDoc"), "create per-doc helper");
  assert(modSrc.includes(TAG) || app.includes(TAG), "docs-multi tag present");
  assert(app.includes("paintDashboardAfterFaceLogin"), "face-login KPI untouched");
  assert(app.includes("fetchAgentAppointmentKpis"), "appointment KPI untouched");

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
