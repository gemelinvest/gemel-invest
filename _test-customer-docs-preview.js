/* GI-CUSTOMER-DOCS-PREVIEW 20260907-health-disc-v1
   On-screen preview for every customer-file document (ops-report style),
   without changing fill / download / open logic.
   Run: node _test-customer-docs-preview.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260907-health-disc-v1";
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
const cancel = fs.readFileSync(path.join(ROOT, "gi-cancel-forms.js"), "utf8");
const followup = fs.readFileSync(path.join(ROOT, "gi-followup-zip.js"), "utf8");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-cancel-forms.js")]).status === 0, "node --check gi-cancel-forms.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-followup-zip.js")]).status === 0, "node --check gi-followup-zip.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD tag");
assert(app.includes('GI_CANCEL_FORMS_HREF = "./gi-cancel-forms.js?v=' + TAG + '"'), "cancel forms href");
assert(cancel.includes('VERSION: "' + TAG + '"'), "cancel forms VERSION");

console.log("\n2) pane + ops-report HTML preview stays");
assert(app.includes("data-cf-doc-preview-pane"), "preview pane exists");
assert(app.includes("data-cf-doc-preview"), "row click preview attr");
assert(css.includes(".cfFile__documentsPreview"), "preview pane CSS");
assert(css.includes(".cfFile__documentsPreviewFrame"), "preview iframe CSS");
const opsPreview = sliceBetween(app, "renderGeneratedDocumentPreview(rec, doc){", "renderDocumentPreviewInner(rec, docId, options = {}){");
assert(opsPreview.includes("Wizard?.renderOperationalReport"), "ops report still rendered as HTML");
assert(opsPreview.includes("CustomerDocuments.TYPES.healthOps"), "health ops type uses HTML report");
assert(opsPreview.includes("AgentAppointmentPdf?.buildOperationalReportHtml"), "agent appointment report still HTML");
assert(opsPreview.includes("GiArrivalDocs"), "arrival docs preview uses GiArrivalDocs");
assert(opsPreview.includes("arrivalPack") || opsPreview.includes("customer_arrival_pack") || app.includes("arrivalPack"), "combined pack preview");
assert(wiz.includes("renderOperationalReport"), "wizard ops renderer unchanged name");

console.log("\n3) filled PDF preview for cancel, followup, official join");
assert(app.includes("fillCustomerDocumentPreviewPdf"), "preview fill helper");
assert(app.includes("wantsFilledPdfPreview"), "preview type gate");
assert(app.includes("officialJoinFormPreviewSpec"), "official form preview map");
assert(app.includes("renderPdfPreviewFrame"), "shared iframe helper");
assert(app.includes("מכין תצוגת מסמך…"), "loading copy for generated PDFs");
const wantsFn = sliceBetween(app, "wantsFilledPdfPreview(doc){", "customerDocPreviewCacheKey(rec, doc){");
assert(wantsFn.includes("followupQuestionnaire"), "followup questionnaires want PDF preview");
assert(wantsFn.includes("companyCancelForm"), "cancel letters want PDF preview");
assert(wantsFn.includes("isOfficialJoinFormType"), "official join forms want PDF preview");
assert(wantsFn.includes("healthOps") && wantsFn.includes("return false"), "ops report is not forced through PDF fill");
assert(wantsFn.includes("suitabilityDoc") && wantsFn.includes("premiumDevelopment"), "hatama/premia stay HTML preview");
assert(wantsFn.includes("arrivalPack"), "combined pack stays HTML plus nispah frame");
assert(wantsFn.includes("followupQuestionnairesZip") || app.includes("isArchiveCustomerDoc"), "zip is not treated as a fake PDF");

const fillFn = sliceBetween(app, "async fillCustomerDocumentPreviewPdf(rec, doc){", "customerDocPreviewKind(doc){");
assert(fillFn.includes("fillOriginalTemplate"), "preview reuses official/cancel fillOriginalTemplate");
assert(fillFn.includes("resolveDocumentBytes"), "preview reuses resolveDocumentBytes for cancel/followup");
assert(fillFn.includes("createObjectURL"), "preview uses blob URL, not a file download");
assert(!fillFn.includes("triggerDataUrlDownload"), "preview fill does not download");
assert(!fillFn.includes("downloadBytes"), "preview fill does not call downloadBytes");
assert(!/\.open\(/.test(fillFn), "preview fill does not open the editor modal");
assert(!fillFn.includes("a.click()"), "preview fill does not click a download link");

const specFn = sliceBetween(app, "officialJoinFormPreviewSpec(type){", "isArchiveCustomerDoc(doc){");
[
  "HachsharaCiForm", "HachsharaHealthForm", "HachsharaLifeForm", "HachsharaLifeShortForm", "HachsharaMortgageForm",
  "MigdalLifeForm", "MigdalMortgageForm", "MigdalCancerForm",
  "MenoraCiForm", "MenoraMortgageForm", "MenoraRiskForm",
  "AyalonHealthForm", "AyalonMortgageForm",
  "ClalHealthForm", "ClalLifeCoupleForm", "ClalMortgageForm",
  "PhoenixLifeForm", "PhoenixHealthForm", "PhoenixCiForm"
].forEach((name) => {
  assert(specFn.includes(name), "preview map includes " + name);
});
assert(specFn.includes('mode: "short"') && specFn.includes('mode: "full"'), "phoenix short/full modes mapped");

console.log("\n4) zip stays a contents preview; download buttons unchanged");
assert(app.includes("renderArchiveDocumentPreview"), "zip contents preview helper");
assert(app.includes("תצוגה מקדימה של תוכן הארכיון"), "zip preview copy");
assert(app.includes("data-open-cancel-form-doc"), "cancel row still has open/download");
assert(app.includes("data-download-followup-doc"), "followup row still has download");
assert(app.includes("data-download-ops-health-doc"), "ops report row still has download");
assert(app.includes("הורד ZIP"), "zip row still has download");
assert(app.includes("פתח טופס"), "official/cancel open label remains");

console.log("\n5) fill + download engines are not rewritten");
const resolveFn = sliceBetween(app, "async resolveDocumentBytes(rec, doc){", "async downloadSelectedCustomerDocuments(rec){");
assert(resolveFn.includes("companyCancelForm"), "resolveDocumentBytes still fills cancel PDFs for download/pack");
assert(resolveFn.includes("followupQuestionnaire"), "resolveDocumentBytes still fills followup PDFs");
assert(resolveFn.includes("fillFollowupPdf"), "download path still uses fillFollowupPdf");
assert(!resolveFn.includes("HachsharaCiForm"), "official join still not packed via resolveDocumentBytes");
assert(!resolveFn.includes("isOfficialJoinFormType"), "official join download path unchanged");
assert(cancel.includes("async fillOriginalTemplate(draft)"), "cancel fillOriginalTemplate kept");
assert(followup.includes("async function fillFollowupPdf(entry)"), "followup fillFollowupPdf kept");
assert(app.includes("canDownloadOfficialJoinForm(){"), "official download gate kept");
assert(/canDownloadOfficialJoinForm\(\)\{\s*try \{ return !!\(Auth\.isAdmin\(\) \|\| Auth\.isManager\(\)\);/.test(app), "gate is still admin or manager only");
assert(!/canDownloadOfficialJoinForm\(\)\{[\s\S]{0,220}isTeamManager/.test(app), "team manager is still excluded from official PDF download");
assert(app.includes("denyOfficialJoinFormDownload(){"), "official open still denied for agents");
assert(app.includes("window.GiCancelForms.open(rec, doc)"), "cancel open still uses GiCancelForms.open");
assert(app.includes("window.HachsharaHealthForm.open(rec)"), "hachshara health open unchanged");
assert(app.includes("CustomerDocuments.triggerDataUrlDownload"), "download helper still used for real downloads");

console.log("\n6) showCustomerDocumentPreview hydrates PDF after module load");
const showFn = sliceBetween(app, "async showCustomerDocumentPreview(docId){", "denyOfficialJoinFormDownload(){");
const prevModLoad = sliceBetween(app, "async ensureCustomerDocumentPreviewModule(doc){", "async fillCustomerDocumentPreviewPdf");
assert(showFn.includes("ensureCustomerDocumentPreviewModule"), "lazy-loads the form module before fill");
assert(showFn.includes("fillCustomerDocumentPreviewPdf"), "fills PDF for the pane");
assert(showFn.includes("pdfUrl"), "passes blob URL into the pane");
assert(showFn.includes("_previewFillSeq"), "cancels stale preview fills when switching docs");
assert(!showFn.includes("triggerDataUrlDownload"), "preview show does not download");
assert(!prevModLoad.includes("ensureGiSimulatorJsLoaded"), "arrival preview does not load simulators");
assert(css.includes("cfFile__documentsPreviewNote"), "archive note CSS");
assert(css.includes("min(68vh, 780px)") || css.includes("min(72vh, 820px)"), "preview pane is tall like a document");

console.log("\n7) runtime: preview fill uses blob URL and never downloads");
(async () => {
  const vm = require("vm");
  const calls = [];
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  class Blob {
    constructor(parts, opts){
      this.parts = parts;
      this.type = opts && opts.type;
    }
  }
  const windowObj = {
    HachsharaHealthForm: {
      buildDraft(rec){ calls.push("draft"); return { id: rec && rec.id }; },
      fillOriginalTemplate: async () => { calls.push("fill"); return new Uint8Array([1, 2, 3]); },
      downloadBytes(){ calls.push("download"); },
      open(){ calls.push("open"); }
    },
    GiCancelForms: {
      open(){ calls.push("cancel-open"); }
    }
  };
  const URLObj = {
    createObjectURL(blob){
      calls.push("blob:" + ((blob && blob.type) || ""));
      return "blob:preview-1";
    },
    revokeObjectURL(){ calls.push("revoke"); }
  };
  let fnSrc = sliceBetween(app, "    async fillCustomerDocumentPreviewPdf(rec, doc){", "\n    customerDocPreviewKind(doc){");
  fnSrc = fnSrc.replace(/,\s*$/, "").replace(/^    async fillCustomerDocumentPreviewPdf/, "async function fillCustomerDocumentPreviewPdf");
  const ctx = {
    window: windowObj,
    URL: URLObj,
    Blob,
    console,
    calls,
    result: "",
    safeTrim,
    Uint8Array
  };
  vm.createContext(ctx);
  vm.runInContext(`
    const ui = {
      cachedCustomerDocPreviewUrl(){ return ""; },
      officialJoinFormPreviewSpec(type){
        return type === "hachshara_health_form" ? { globalName: "HachsharaHealthForm" } : null;
      },
      rememberCustomerDocPreviewUrl(key, url){ calls.push("remember:" + url); },
      customerDocPreviewCacheKey(){ return "k1"; },
      async resolveDocumentBytes(){ calls.push("resolve"); return { bytes: new Uint8Array([9]) }; },
      fillCustomerDocumentPreviewPdf: ${fnSrc.replace(/^async function fillCustomerDocumentPreviewPdf/, "async function")}
    };
    result = ui.fillCustomerDocumentPreviewPdf({ id: "c1" }, { id: "d1", type: "hachshara_health_form" });
  `, ctx);
  const url = await ctx.result;
  assert(url === "blob:preview-1", "preview returns object URL");
  assert(calls.indexOf("draft") >= 0, "preview builds draft");
  assert(calls.indexOf("fill") >= 0, "preview calls fillOriginalTemplate");
  assert(calls.indexOf("blob:application/pdf") >= 0, "preview creates PDF blob URL");
  assert(calls.indexOf("remember:blob:preview-1") >= 0, "preview caches the blob URL");
  assert(calls.indexOf("download") < 0, "runtime preview does not downloadBytes");
  assert(calls.indexOf("open") < 0, "runtime preview does not open the form modal");
  assert(calls.indexOf("cancel-open") < 0, "runtime preview does not open cancel modal");
  assert(calls.indexOf("resolve") < 0, "official join preview does not use resolveDocumentBytes");

  calls.length = 0;
  vm.runInContext(`
    const uiCancel = {
      cachedCustomerDocPreviewUrl(){ return ""; },
      officialJoinFormPreviewSpec(){ return null; },
      rememberCustomerDocPreviewUrl(key, url){ calls.push("remember:" + url); },
      customerDocPreviewCacheKey(){ return "k2"; },
      async resolveDocumentBytes(){ calls.push("resolve"); return { bytes: new Uint8Array([7, 7]) }; },
      fillCustomerDocumentPreviewPdf: ${fnSrc.replace(/^async function fillCustomerDocumentPreviewPdf/, "async function")}
    };
    result = uiCancel.fillCustomerDocumentPreviewPdf({ id: "c2" }, { id: "d2", type: "company_cancel_form" });
  `, ctx);
  const cancelUrl = await ctx.result;
  assert(cancelUrl === "blob:preview-1", "cancel preview returns object URL");
  assert(calls.indexOf("resolve") >= 0, "cancel preview reuses resolveDocumentBytes");
  assert(calls.indexOf("fill") < 0, "cancel preview does not call official fill directly");
  assert(calls.indexOf("download") < 0, "cancel preview does not download");

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

