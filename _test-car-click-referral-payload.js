/* GI-FIX 2026-09-22 — רכב בקליק: slim שומר primary/insureds, hydrate מ-proposals.
   Run: node _test-car-click-referral-payload.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260922-login-mfa-qr-btn-v1";
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

function sliceFunction(src, startToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  let i = startToken.endsWith("{")
    ? start + startToken.length - 1
    : src.indexOf("{", start);
  if(i < 0) return "";
  let depth = 0;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

function safeTrim(v){ return String(v == null ? "" : v).trim(); }

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + source");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(app.includes('const BUILD = "' + TAG + '"'), "app.js BUILD tag");
assert(sw.includes(TAG) || sw.includes("gi-v12-" + TAG), "service worker cache");
assert(app.includes("GI-FIX 2026-09-22: רכב בקליק אין תיק לקוח"), "slim comment mentions car-click");
assert(app.includes('"primary"') && app.includes("keepKeys"), "slim keeps primary");
assert(app.includes("function hydrateSlimElementaryReferral"), "hydrate helper exists");
assert(app.includes("hydrateSlimElementaryReferral(normalizeElementaryReferral"), "getElementaryReferrals hydrates slim rows");
assert(app.includes("storedMfaQrMarkup"), "2FA stored QR helper exists");
assert(app.includes("טלפון חדש? סרוק את ה-QR"), "login shows rescan hint");

const slimSrc = sliceFunction(app, "function slimElementaryReferralPayloadForMeta(payload){");
const stripSrc = sliceFunction(app, "function stripInlineBlobsFromJson(value, depth){");
const hasFormSrc = sliceFunction(app, "function elementaryReferralPayloadHasFormData(payload){");
const extractSrc = sliceFunction(app, "function extractOperationalFormPayload(src){");
assert(!!slimSrc && !!stripSrc && !!hasFormSrc && !!extractSrc, "extracted slim/hydrate helpers");

console.log("\n2) runtime — slim keeps form fields, strips blobs");
const sandbox = { safeTrim, console };
vm.createContext(sandbox);
vm.runInContext(stripSrc + "\n" + slimSrc + "\n" + hasFormSrc + "\n" + extractSrc, sandbox);

const fatPayload = {
  elementaryReferralMeta: { sourceFlow: "carInsuranceClick", continueFromStep: 5 },
  primary: {
    firstName: "דוד",
    lastName: "כהן",
    idNumber: "123456789",
    phone: "0501234567",
    city: "תל אביב",
    coverageType: "comprehensive",
    plate: "12-345-67",
    licenseScan: { dataUrl: "data:image/png;base64,AAAA" }
  },
  insureds: [{ id: "i1", data: { firstName: "דוד", lastName: "כהן", plate: "12-345-67" } }],
  elementaryPolicies: [{ company: "הפניקס", type: "רכב" }],
  elementaryProduct: "vehicle",
  flowType: "elementary",
  currentStep: 5,
  mirrorFlow: { elementaryReport: { note: "ok" }, callSession: { huge: true } }
};

const slimmed = sandbox.slimElementaryReferralPayloadForMeta(fatPayload);
assert(slimmed.primary.firstName === "דוד", "slim keeps first name");
assert(slimmed.primary.idNumber === "123456789", "slim keeps id number");
assert(slimmed.primary.plate === "12-345-67", "slim keeps vehicle plate");
assert(slimmed.insureds[0].data.lastName === "כהן", "slim keeps insureds");
assert(slimmed.elementaryProduct === "vehicle", "slim keeps elementaryProduct");
assert(slimmed.elementaryReferralMeta.sourceFlow === "carInsuranceClick", "slim keeps sourceFlow");
assert(slimmed.mirrorFlow.elementaryReport.note === "ok", "slim keeps elementaryReport");
assert(!slimmed.mirrorFlow.callSession, "slim drops unrelated mirror blobs");
assert(slimmed.primary.licenseScan.hasFile === true, "slim strips dataUrl blob");
assert(!slimmed.primary.licenseScan.dataUrl, "dataUrl is not stored in meta");
assert(sandbox.elementaryReferralPayloadHasFormData(slimmed) === true, "slimmed payload still counts as form data");

const emptySlim = sandbox.slimElementaryReferralPayloadForMeta({
  elementaryReferralMeta: { sourceFlow: "carInsuranceClick" }
});
assert(sandbox.elementaryReferralPayloadHasFormData(emptySlim) === false, "meta-only payload is empty form data");

const fromProposal = sandbox.extractOperationalFormPayload({
  elementaryReferralMeta: { referralId: "elemref_1" },
  operational: {
    primary: { firstName: "יעל", lastName: "לוי", idNumber: "987654321" },
    insureds: [{ data: { firstName: "יעל", lastName: "לוי" } }]
  }
});
assert(fromProposal.primary.firstName === "יעל", "hydrate extract reads operational.primary");
assert(fromProposal.insureds[0].data.lastName === "לוי", "hydrate extract reads operational.insureds");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + " / passed " + passed);
process.exit(failed ? 1 : 0);
