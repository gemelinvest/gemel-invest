/* Confirmed fixes: product-document prune, sidebar mosaic, appointment
   completion, proposal cancellation marks, hidden document scrollbars.
   Run: node _test-confirmed-fixes.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const navy = fs.readFileSync(path.join(ROOT, "gi-navy-lit.css"), "utf8");
const wizard = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const arrival = fs.readFileSync(path.join(ROOT, "gi-arrival-docs.js"), "utf8");
const migdal = fs.readFileSync(path.join(ROOT, "gi-migdal-life-form.js"), "utf8");

function sliceMethod(source, name, nextName){
  const start = source.indexOf(name + "(");
  const end = source.indexOf(nextName + "(", start + 1);
  if(start < 0 || end < 0) throw new Error("missing " + name);
  return source.slice(start, end);
}

const gateSrc = [
  sliceMethod(app, "purchaseNewPolicies", "purchaseDocumentGate"),
  sliceMethod(app, "purchaseDocumentGate", "officialJoinStillQualifies"),
  sliceMethod(app, "pruneRemovedProductDocuments", "appendAgentAppointmentDocsFromMarkedPolicies")
].join("\n");

const sandbox = {
  console,
  safeTrim(value){ return String(value == null ? "" : value).trim(); },
  getCustomerRawNewPolicies(rec){
    const payload = rec && rec.payload ? rec.payload : {};
    return Array.isArray(payload.newPolicies) ? payload.newPolicies : [];
  },
  result: null
};
vm.createContext(sandbox);
vm.runInContext(`
  const api = {
    TYPES: {
      harBituach: "har_bituach",
      healthOps: "health_ops",
      followupQuestionnaire: "followup_questionnaire",
      arrivalPack: "customer_arrival_pack",
      suitabilityDoc: "suitability_document",
      migdalHealthForm: "migdal_health_form"
    },
    REPORT_SCOPES: { purchase: "health_purchase", proposal: "health_proposal" },
    isOfficialJoinFormType(type){ return type === this.TYPES.migdalHealthForm; },
    officialJoinStillQualifies(doc){ return doc && doc.keepJoin === true; },
    listFromPayload(payload){
      return Array.isArray(payload && payload.customerDocuments) ? payload.customerDocuments.filter(Boolean) : [];
    },
    ${gateSrc}
  };
  result = api;
`, sandbox);
const api = sandbox.result;

const payload = {
  newPolicies: [{ id: "np1", company: "מגדל" }],
  customerDocuments: [
    { id: "har", type: "har_bituach", name: "הר הביטוח" },
    { id: "ops", type: "health_ops", reportScope: "health_purchase", payloadSnapshot: { newPolicies: [{ id: "gone" }] } },
    { id: "ops-live", type: "health_ops", reportScope: "health_purchase", payloadSnapshot: { newPolicies: [{ id: "np1" }] } },
    { id: "proposal", type: "health_ops", reportScope: "health_proposal" },
    { id: "follow-migdal", type: "followup_questionnaire", company: "מגדל" },
    { id: "follow-clal", type: "followup_questionnaire", company: "כלל" },
    { id: "pack", type: "customer_arrival_pack" },
    { id: "join", type: "migdal_health_form", keepJoin: false },
    { id: "upload", type: "upload", name: "קובץ" }
  ]
};
api.pruneRemovedProductDocuments(payload, { payload });
const ids = payload.customerDocuments.map((doc) => doc.id);
assert(ids.indexOf("har") >= 0, "har bituach stays after product prune");
assert(ids.indexOf("ops") < 0, "purchase report with no remaining product is removed");
assert(ids.indexOf("ops-live") >= 0, "purchase report that still matches a product stays");
assert(ids.indexOf("proposal") >= 0, "proposal report stays");
assert(ids.indexOf("follow-migdal") >= 0, "followup of a remaining company stays");
assert(ids.indexOf("follow-clal") < 0, "followup of a removed company is removed");
assert(ids.indexOf("pack") >= 0, "arrival pack stays while a purchase product remains");
assert(ids.indexOf("join") < 0, "official join form that no longer qualifies is removed");
assert(ids.indexOf("upload") >= 0, "uploaded file stays");

const empty = {
  newPolicies: [],
  customerDocuments: [
    { id: "har", type: "har_bituach" },
    { id: "pack", type: "customer_arrival_pack" },
    { id: "hatama", type: "suitability_document" },
    { id: "follow", type: "followup_questionnaire", company: "מגדל" }
  ]
};
api.pruneRemovedProductDocuments(empty, { payload: empty });
const emptyIds = empty.customerDocuments.map((doc) => doc.id);
assert(emptyIds.indexOf("har") >= 0 && emptyIds.length === 1, "with no products only har bituach remains from the purchase set");

const cancelSrc = [
  sliceMethod(app, "collectProposalCancellations", "fieldHasExport"),
  sliceMethod(app, "fieldHasExport", "applyProposalCancellationMarks"),
  sliceMethod(app, "applyProposalCancellationMarks", "")
].join("\n");
const cancelEnd = app.indexOf("applyProposalCancellationMarks(form, draft, font){");
const cancelClose = app.indexOf("\n  };", cancelEnd);
const cancelFn = app.slice(cancelEnd, cancelClose);
const cancelBox = {
  capture: {},
  setExport(form, name, value){ form.__giCapture[name] = value; },
  setTextSafe(form, name, value){ form.__giCapture[name] = value; }
};
vm.runInContext(`
  cancelApi = {
    ${sliceMethod(app, "collectProposalCancellations", "fieldHasExport")}
    ${sliceMethod(app, "fieldHasExport", "applyProposalCancellationMarks")}
    ${cancelFn}
  };
`, Object.assign(sandbox, { cancelApi: null }));
const fill = sandbox.cancelApi;
fill.setExport = function(form, name, value){ form.__giCapture[name] = value; };
fill.setTextSafe = function(form, name, value){ form.__giCapture[name] = value; };
const form = { __giCapture: {} };
fill.applyProposalCancellationMarks(form, {
  sourcePayload: {
    insureds: [{
      data: {
        existingPolicies: [{ id: "p1", company: "מגדל", type: "בריאות", policyNumber: "123" }],
        cancellations: { p1: { status: "full", executionMethod: "client" }, p2: { status: "agent_appoint", executionMethod: "agent" } }
      }
    }]
  }
}, null);
assert(form.__giCapture.PolicyCancel === "Client", "cancellation who-sends follows the wizard client choice");
assert(form.__giCapture.ExistPCancel === "1", "full cancellation marks the existing-policy checkbox");
assert(form.__giCapture.insCompera === "מגדל · בריאות · 123", "company, type and policy number fill the cancellation line");
assert(!form.__giCapture.PolicyCancel || form.__giCapture.PolicyCancel !== "Agent", "agent appointment is not marked as a cancellation sender");

const noClient = { __giCapture: {} };
const probed = {
  __giCapture: {},
  states: { PolicyCancel: ["Agent", "Company"], PolicyCancelFN: ["1"], ExistPReduce: ["1"] },
  getField(name){ return this.states[name] ? { name } : null; }
};
fill.fieldHasExport = function(form, name, value){
  const states = form.states && form.states[name];
  return !!(states && states.indexOf(value) >= 0);
};
fill.setExport = function(form, name, value){ form.__giCapture[name] = value; };
fill.applyProposalCancellationMarks(probed, {
  sourcePayload: {
    primary: {
      existingPolicies: [{ id: "p9", company: "מנורה", type: "ריסק", policyNumber: "77" }],
      cancellations: { p9: { status: "partial_health", executionMethod: "client" } }
    },
    insureds: []
  }
}, null);
assert(probed.__giCapture.PolicyCancel !== "Client", "a form without a client box is not forced to client");
assert(probed.__giCapture.ExistPReduce === "1", "partial health cancellation marks the reduce checkbox");

assert(arrival.includes("const purchasePolicies = listNewPolicies(payload);"), "arrival pack is withheld when no purchase products remain");
assert(navy.includes("--gi-sidebar-mosaic") && navy.includes("background-repeat: no-repeat") && navy.includes("rgba(0,0,0,.5) 68%"), "sidebar mosaic is a few large graded shapes");
assert(navy.includes("z-index: 0") && navy.includes("z-index: 1"), "menu labels stay above the mosaic");
assert(css.includes(".cfFile__documentsPreviewBody") && css.includes("scrollbar-width: none"), "document preview scrollbar track is hidden");
assert(css.includes("overflow: auto"), "document preview still scrolls");
assert(app.includes('previewHash = "scrollbar=0"'), "pdf preview asks the viewer to hide its scrollbar");
assert(wizard.includes("appendAgentAppointmentDocsFromMarkedPolicies"), "health wizard writes appointment docs for marked policies");
assert(app.includes("שלח לחתימה") && app.includes("renderDone"), "appointment finish stays on a screen with send for signature");
assert(app.includes("הטפסים מוכנים לפתיחה, להורדה ולשליחה לחתימה"), "finish no longer jumps straight into the customer file");
assert(migdal.includes('status === "partial_health"'), "migdal life reads the wizard partial cancellation status");
assert(!fs.readFileSync(path.join(ROOT, "gi-hachshara-health-form.js"), "utf8").includes("applyProposalCancellationMarks"), "hachshara health is left without an invented cancellation mark");
assert(!fs.readFileSync(path.join(ROOT, "gi-phoenix-ci-form.js"), "utf8").includes("applyProposalCancellationMarks"), "phoenix ci is left without an invented cancellation mark");
assert(fs.readFileSync(path.join(ROOT, "gi-menora-risk-form.js"), "utf8").includes("applyProposalCancellationMarks"), "menora risk form receives the cancellation mark");
assert(fs.readFileSync(path.join(ROOT, "gi-gap-join-forms.js"), "utf8").includes("applyProposalCancellationMarks"), "gap join forms receive the cancellation mark");

console.log(failed ? ("FAILED " + failed + " passed=" + passed) : ("OK passed=" + passed));
process.exit(failed ? 1 : 0);
