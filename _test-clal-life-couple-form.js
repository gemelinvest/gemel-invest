/* GI-CLAL-LIFE-COUPLE-FORM 2026-08-24
   Official Clal couple-risk form in customer documents.
   Run: node _test-clal-life-couple-form.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20260830-clal-health-decl-v1";
const FORM_TAG = "20260824-covers-sum-v1";
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
const form = fs.readFileSync(path.join(ROOT, "gi-clal-life-couple-form.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const pdfPath = path.join(ROOT, "forms", "clal-life-couple", "clal-life-couple-join.pdf");

console.log("1) syntax + files");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-clal-life-couple-form.js")]).status === 0, "node --check gi-clal-life-couple-form.js");
assert(fs.existsSync(pdfPath), "official PDF template exists");
assert(fs.statSync(pdfPath).size > 100000, "PDF template is not empty");

console.log("\n2) cache");
assert(html.includes("app.js?v=" + TAG), "index.html bumps app.js cache");
assert(app.includes('GI_CLAL_LIFE_COUPLE_FORM_HREF = "./gi-clal-life-couple-form.js?v=' + FORM_TAG + '"'), "form chunk cache bumped");
assert(sw.includes("gi-v12-" + TAG), "service worker cache bumped");

console.log("\n3) customer-file document");
assert(app.includes('clalLifeCoupleForm: "clal_life_couple_form"'), "document type registered");
assert(app.includes("qualifiesForClalLifeCoupleForm"), "qualify helper exists");
assert(app.includes("טופס מקורי — ריסק זוגי · כלל"), "document title is live");
assert(app.includes("data-open-clal-life-couple-doc"), "documents tab has open button");
assert(app.includes("openClalLifeCoupleForm"), "customer file opens the form");
assert(app.includes("ensureClalLifeCoupleFormLoaded"), "form chunk loads on demand");
assert(app.includes('OFFICIAL_JOIN_FORM_FROM_DAY: "2026-08-23"'), "official forms start from 23 Aug 2026");
assert(app.includes("insuredMode") && app.includes("זוגי|כפול למשפחה|כלל כפול"), "qualify requires couple risk");

console.log("\n4) fill engine — proposal sums");
assert(form.includes("function installClalLifeCoupleForm"), "form module wraps itself");
assert(form.includes("buildDraft"), "draft builder exists");
assert(form.includes("fillOriginalTemplate"), "PDF fill exists");
assert(form.includes("applyProposalSums"), "proposal sums filler exists");
assert(form.includes("GiluiTotalRisk"), "fills primary death sum");
assert(form.includes("SGiluiTotalRisk"), "fills spouse death sum");
assert(form.includes("AccDeathMainSum"), "fills primary accidental-death sum");
assert(form.includes("AccDeathSpouseSum"), "fills spouse accidental-death sum");
assert(form.includes("AccNehutMainSum"), "fills primary accidental-disability sum");
assert(form.includes("AccNehutSpouseSum"), "fills spouse accidental-disability sum");
assert(form.includes("sumInsuredPerInsured"), "reads per-insured death sums from the proposal");
assert(form.includes("umbrellaDeathAmount"), "reads accidental-death amount from the proposal");
assert(form.includes("umbrellaDisabilityAmount"), "reads accidental-disability amount from the proposal");
assert(form.includes("CShihrurMain"), "fills stored income-protection amount");
assert(!form.includes("GiluiRetAge"), "does not invent retirement age");
assert(form.includes("cc: draft.payment?.cc"), "passes stored card into shared payment fill");
assert(form.includes("applyOfficialHealthAndNames"), "fills extra names via shared helper");
assert(form.includes("applyClalCoupleHealthYesNo"), "fills CRQ yes/no from stored couple declaration");
assert(form.includes("{ visual: false }"), "Clal Hebrew is logical, not visually reversed");
assert(form.includes("הצהרת בריאות"), "tells agent medical free-text stays manual");
assert(!/PolicyCancel|SPolicyCancel|AgentMust|ClientMust|SpouseMust/.test(form), "does not fill cancel/signatures");

console.log("\n5) helper CRQ mapping");
const start = app.indexOf("const GI_OFFICIAL_FORM_FILL = {");
const end = app.indexOf("try { window.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL; }", start);
assert(start > 0 && end > start, "helper block found");
const ctx = { window: {}, console };
vm.runInNewContext(app.slice(start, end) + "\nthis.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL;", ctx);
const H = ctx.GI_OFFICIAL_FORM_FILL;
assert(Array.isArray(H.HEALTH_QKEYS.clal_couple) && H.HEALTH_QKEYS.clal_couple.length === 19, "couple keys zip to CRQ1–19");
assert(H.HEALTH_QKEYS.clal_couple[0] === "clal_couple_neuro", "CRQ1 is neuro");
assert(H.HEALTH_QKEYS.clal_couple[18] === "clal_couple_drugs", "CRQ19 is drugs");
ctx.window.PDFLib = { PDFName: { of(v){ return { v: String(v) }; } } };
const healthExports = {};
const mockForm = {
  getField(name){
    return {
      acroField: {
        dict: {
          set(_k, val){ healthExports[name] = val && val.v; }
        }
      }
    };
  }
};
H.applyClalCoupleHealthYesNo(mockForm, {
  healthResponses: {
    clal_couple_neuro: { p1: { answer: "yes" }, s1: { answer: "no" } },
    clal_couple_regular_meds: { p1: { answer: "no" } }
  },
  primaryId: "p1",
  spouseId: "s1"
});
assert(healthExports.CRQ1 === "1", "primary CRQ1 yes exports 1");
assert(healthExports.CRQ1S === "2", "spouse CRQ1 no exports 2");
assert(healthExports.RegularMeds === "2", "named extra maps regular meds");
assert(healthExports.CRQ2 == null, "unanswered CRQ is skipped");

console.log("\n6) other contracts untouched");
assert(app.includes("paintDashboardAfterFaceLogin"), "face-login KPI paint remains");
assert(app.includes("fetchAgentAppointmentKpis"), "agent-appointment KPI fetch remains");
assert(app.includes("טופס מקורי — בריאות · כלל"), "Clal health form remains");
assert(app.includes("getClalRiskHealthSchema"), "wizard couple health schema stays in place");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
