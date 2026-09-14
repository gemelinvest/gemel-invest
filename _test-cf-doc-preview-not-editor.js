/* GI-CF-DOC-PREVIEW 2026-09-14 — בתיק לקוח לחיצה על מסמך מציגה את הטופס המקורי, לא את עורך השדות.
   אותו כלל לכל סוגי הקבצים בתיק. עורך נשאר בשיקוף ובכפתור «ערוך טופס».
   הרצה: node _test-cf-doc-preview-not-editor.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260914-cf-doc-preview-v1";
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD");

console.log("\n2) document row click always previews the original file");
const previewClick = sliceBetween(app, 'const previewRow = ev.target?.closest?.("[data-cf-doc-preview]");', 'const backBtn = ev.target?.closest?.("#customerMedicalBackBtn");');
assert(!!previewClick, "preview-row handler found");
assert(previewClick.includes("showCustomerDocumentPreview(docId)"), "row click shows document preview");
assert(!previewClick.includes("openOriginalFormForEdit"), "row click does not open the field editor");
assert(!previewClick.includes("followupEditorTypeFromDoc"), "followup rows are not hijacked to the editor");
assert(!previewClick.includes("officialJoinFormPreviewSpec"), "official join rows are not hijacked to the editor");
assert(!previewClick.includes("openCompanyCancelForm"), "cancel rows are not hijacked to the cancel editor");
assert(!previewClick.includes("openHachshara"), "hachshara rows are not hijacked to a digital modal");
assert(!previewClick.includes("openPhoenix"), "phoenix rows are not hijacked to a digital modal");
assert(!previewClick.includes("openClal"), "clal rows are not hijacked to a digital modal");
assert(!previewClick.includes("openMigdal"), "migdal rows are not hijacked to a digital modal");
assert(!previewClick.includes("openMenora"), "menora rows are not hijacked to a digital modal");
assert(!previewClick.includes("openAyalon"), "ayalon rows are not hijacked to a digital modal");
assert(!previewClick.includes(".open("), "row click does not open a digital form modal");

console.log("\n3) documents list: every file type is a preview row, never a digital-open attr");
const docsFn = sliceBetween(app, "renderDocumentsSection(rec){", "renderSectionContent(rec, policies){");
assert(!!docsFn, "documents section renderer found");
assert(docsFn.includes("data-cf-doc-preview="), "every row is a preview row");
[
  "data-open-hachshara", "data-open-phoenix", "data-open-clal",
  "data-open-migdal", "data-open-menora", "data-open-ayalon",
  "data-hachci-open", "data-hachhealth-open", "data-hachlife-open", "data-hachlifeshort-open", "data-hachmort-open",
  "data-phxlifeshort-open", "data-phxlifefull-open", "data-phxhealth-open", "data-phxci-open",
  "data-miglife-open", "data-migmort-open", "data-migcancer-open",
  "data-clalhealth-open", "data-clalcouple-open", "data-clalmort-open",
  "data-ayalhealth-open", "data-ayalmort-open",
  "data-menoraci-open", "data-menormort-open", "data-menorarisk-open",
  "data-cancel-form-open"
].forEach((attr) => {
  assert(!docsFn.includes(attr), "documents list has no " + attr);
});
assert(docsFn.includes("data-edit-original-form"), "explicit ערוך טופס button stays");
assert(docsFn.includes("data-download-followup-doc"), "followup download stays");
assert(docsFn.includes("data-open-cancel-form-doc"), "cancel keeps a dedicated button, not a row hijack");
assert(docsFn.includes("data-download-ops-health-doc"), "ops health report keeps download");
assert(docsFn.includes("data-download-arrival-pack-doc"), "arrival pack keeps download");
assert(docsFn.includes("data-download-ops-agent-doc"), "agent appointment report keeps download");
assert(docsFn.includes("data-download-customer-file-doc"), "uploaded/har files keep download");
assert(docsFn.includes("followupEditorTypeFromDoc(rec, doc)"), "followup editor type is only for the ערוך טופס button");

console.log("\n4) original-form PDF preview covers every official join type + followup + cancel");
const typesBlock = sliceBetween(app, "OFFICIAL_JOIN_FORM_TYPES: [", "],");
const officialTypes = [...typesBlock.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]);
assert(officialTypes.length >= 19, "official join type list is complete (" + officialTypes.length + ")");
const specFn = sliceBetween(app, "officialJoinFormPreviewSpec(type){", "isArchiveCustomerDoc(doc){");
officialTypes.forEach((type) => {
  const camel = type.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
  assert(specFn.includes("CustomerDocuments.TYPES." + camel), "preview map includes " + type);
});
const wantsFn = sliceBetween(app, "wantsFilledPdfPreview(doc){", "customerDocPreviewCacheKey(rec, doc){");
assert(wantsFn.includes("followupQuestionnaire"), "followup questionnaires preview as PDF");
assert(wantsFn.includes("companyCancelForm"), "cancel letters preview as PDF");
assert(wantsFn.includes("isOfficialJoinFormType"), "official join forms preview as PDF");
assert(wantsFn.includes("nispahHarAuth"), "har-auth appendix previews as PDF");
assert(app.includes("fillCustomerDocumentPreviewPdf"), "preview fills the original template");

console.log("\n5) other customer-file files are not the field editor either");
const showFn = sliceBetween(app, "async showCustomerDocumentPreview(docId){", "denyOfficialJoinFormDownload(){");
assert(showFn.includes("fillCustomerDocumentPreviewPdf"), "preview path fills the original PDF");
assert(!showFn.includes("openOriginalFormForEdit"), "preview path does not open the field editor");
assert(!showFn.includes("GiCancelForms.open"), "preview path does not open the cancel modal");
assert(!showFn.includes("HachsharaHealthForm.open"), "preview path does not open a company digital modal");
const bodyClickHead = sliceBetween(app, "on(this.els.body, \"click\", async (ev) => {", "const previewRow = ev.target?.closest?.(\"[data-cf-doc-preview]\");");
assert(bodyClickHead.includes("[data-edit-original-form]"), "ערוך טופס is a separate handler before the row");
assert(bodyClickHead.indexOf("[data-edit-original-form]") < bodyClickHead.indexOf("[data-open-hachshara-ci-doc]"), "edit button is handled before leftover digital-open attrs");

console.log("\n6) editor remains in mirror + explicit edit button");
assert(app.includes("void this.openOriginalFormForEdit(rec, editOriginal.getAttribute(\"data-edit-original-form\"))"), "ערוך טופס still opens editor");
assert(app.includes("_mcOpenJoinFormFromRail"), "mirror-call still opens the form editor");
assert(app.includes("_mcFormEditorContext = \"customerFile\""), "file editor still exists for the edit button");
assert(app.includes("עריכת טופס מקורי"), "editor kicker still exists for explicit edit / mirror");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
