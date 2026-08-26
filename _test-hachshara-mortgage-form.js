/* GI-HACH-MORT-FORM 2026-08-24
   Official Hachshara mortgage form in customer documents.
   Run: node _test-hachshara-mortgage-form.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260826-sales-kpis-v1";
const TAG = "20260826-hach-hmo-health-v1";
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
const form = fs.readFileSync(path.join(ROOT, "gi-hachshara-mortgage-form.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const pdfPath = path.join(ROOT, "forms", "hachshara-mortgage", "hachshara-mortgage-join.pdf");

console.log("1) syntax + files");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-hachshara-mortgage-form.js")]).status === 0, "node --check gi-hachshara-mortgage-form.js");
assert(fs.existsSync(pdfPath), "official PDF template exists");
assert(fs.statSync(pdfPath).size > 100000, "PDF template is not empty");

console.log("\n2) cache");
assert(html.includes("app.js?v=" + APP_TAG), "index.html bumps app.js cache");
assert(app.includes('GI_HACHSHARA_MORTGAGE_FORM_HREF = "./gi-hachshara-mortgage-form.js?v=' + TAG + '"'), "form chunk cache bumped");
assert(sw.includes("gi-v12-" + APP_TAG), "service worker cache bumped");

console.log("\n3) customer-file document");
assert(app.includes('hachsharaMortgageForm: "hachshara_mortgage_form"'), "document type registered");
assert(app.includes("qualifiesForHachsharaMortgageForm"), "qualify helper exists");
assert(app.includes("hachsharaMortgageIsShort"), "short/full health mode helper exists");
assert(app.includes("hachsharaMortgageAmountMode"), "mortgage amount mode helper exists");
assert(app.includes("טופס מקורי — ריסק משכנתא · הכשרה"), "document title is live");
assert(app.includes("data-open-hachshara-mortgage-doc"), "documents tab has open button");
assert(app.includes("openHachsharaMortgageForm"), "customer file opens the form");
assert(app.includes("ensureHachsharaMortgageFormLoaded"), "form chunk loads on demand");
assert(app.includes('hachshara_mortgage_short:'), "HEALTH_QKEYS short mortgage keys");
assert(app.includes('hachshara_mortgage_full:'), "HEALTH_QKEYS full mortgage keys");
assert(app.includes("mortgage_full:"), "health rows map mortgage full Q1-20");
assert(app.includes("if(type === this.TYPES.hachsharaMortgageForm) return this.qualifiesForHachsharaMortgageForm(payload, rec);"), "old mortgage docs stay hidden outside period");

console.log("\n4) fill engine");
assert(form.includes("function installHachsharaMortgageForm"), "form module wraps itself");
assert(form.includes("buildDraft"), "draft builder exists");
assert(form.includes("fillOriginalTemplate"), "PDF fill exists");
assert(form.includes("LoanSum"), "fills official loan sum");
assert(form.includes("LoanYears"), "fills official loan years");
assert(form.includes("LoanInterest"), "fills loan interest track");
assert(form.includes("LoanTerminationDate"), "fills loan termination date");
assert(form.includes('ApartmentPurchase", "1"') || form.includes('ApartmentPurchase", "1")'), "apartment purchase uses PDF export 1");
assert(form.includes('LandPurchase", "1"') || form.includes("LandPurchase\", \"1\""), "land purchase uses PDF export 1");
assert(form.includes("MaximumAmountText"), "sum insured writes MaximumAmountText");
assert(form.includes('MaximumAmount", "True"') || form.includes("MaximumAmount\", \"True\""), "marks MaximumAmount checkbox");
assert(!/setTextSafe\(form,\s*s === "Spouse" \? "MaximumAmountText" : "MaximumAmount"/.test(form), "no longer writes sum into MaximumAmount button");
assert(form.includes("applyMappedHealthYesNo"), "named health map for yes/no");
assert(form.includes('map: draft.healthMap'), "health map follows mortgage amount mode");
assert(form.includes("mortgage_full"), "full mode uses mortgage_full rows");
assert(form.includes("life_short"), "short mode uses life_short alias rows");
assert(form.includes("applyInsuredPayerOwner"), "fills payer/owner from stored data");
assert(form.includes("applyStoredPayment"), "fills HO/CC only when stored");
assert(form.includes("CollectionMethod"), "marks Hok/Credit collection");
assert(form.includes("HMO"), "fills HMO/clinic");
assert(form.includes("HealthDecQ"), "v1 defers HealthDecQ followups");
assert(form.includes("renderPdfFieldEditor"), "pre-download editor lists PDF fields");

console.log("\n5) regression");
assert(spawnSync(process.execPath, [path.join(ROOT, "_test-hachshara-mortgage-risk.js")]).status === 0, "hachshara mortgage risk sim regression");
assert(app.includes("paintDashboardAfterFaceLogin"), "face-login KPI paint remains");
assert(app.includes("fetchAgentAppointmentKpis"), "agent-appointment KPI fetch remains");
assert(app.includes("טופס מקורי — ריסק חיים · הכשרה"), "Hachshara life form remains");
assert(app.includes("qualifiesForHachsharaLifeForm"), "life form qualify remains separate from mortgage");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
