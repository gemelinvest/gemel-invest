/* Production archive layer: full policy number, update without duplicates.
   Run: node _test-production-archive.js
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

function loadEngine(){
  const src = fs.readFileSync(path.join(ROOT, "gi-production-import.js"), "utf8");
  const sandbox = { window: {}, console };
  vm.runInNewContext(src, sandbox);
  return sandbox.window.GI_PRODUCTION;
}

const P = loadEngine();
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

console.log("1) report replaces the same company and keeps the other");
const first = {
  company: "הכשרה",
  policyNumber: "12345",
  policyNumberFull: "0012345",
  policyMatchKey: "12345",
  type: "בריאות",
  premiumMonthly: "10.00",
  covers: [{ name: "ניתוחים", premium: "4.50", premiumAnnual: "54.00", sumInsured: "1000" }],
  people: [{ fullName: "ישראל ישראלי", idNumber: "123456782", phone: "0521111111", city: "חיפה" }],
  exclusions: ["החרגה לדוגמה"],
  healthCovers: ["ניתוחים"],
  importSource: "hachshara-production"
};
const other = {
  company: "מגדל",
  policyNumber: "999",
  policyMatchKey: "999",
  premiumMonthly: "8.00"
};
let payload = P.applyProductionReport({
  newPolicies: [{ id: "keep-me", company: "הכשרה" }],
  productionPolicies: []
}, [first, Object.assign({}, first, { policyNumber: "777", policyNumberFull: "777", policyMatchKey: "777", premiumMonthly: "3.00" })]);
payload = P.applyProductionReport(payload, [other]);
payload = P.applyProductionReport(payload, [Object.assign({}, first, { premiumMonthly: "12.50" })]);

const hach = payload.productionPolicies.filter((p) => p.company === "הכשרה");
const mig = payload.productionPolicies.filter((p) => p.company === "מגדל");
assert(hach.length === 1, "second hachshara report drops the policy that left");
assert(hach[0].policyNumber === "0012345", "full policy number is stored");
assert(hach[0].premiumMonthly === "12.50", "same policy is updated");
assert(hach[0].covers[0].premiumAnnual === "54.00", "annual cover premium is kept");
assert(hach[0].people[0].phone === "0521111111", "insured phone is kept");
assert((hach[0].exclusions || [])[0] === "החרגה לדוגמה", "exclusion is kept");
assert(mig.length === 1 && mig[0].policyNumber === "999", "another company stays");
assert(payload.newPolicies.length === 1 && payload.newPolicies[0].id === "keep-me", "pretreatment policies stay");

console.log("\n2) empty policy number does not create a row");
const skipped = P.applyProductionReport({ productionPolicies: [] }, [{
  company: "כלל",
  policyNumber: "",
  premiumMonthly: "1"
}]);
assert((skipped.productionPolicies || []).length === 0, "no number, no row");

console.log("\n3) mark does not change the built object");
const built = { company: "מגדל", policyNumber: "42", policyNumberFull: "0042" };
const marked = P.markProductionLayer([built]);
assert(built.productionLayer !== true, "builder object stays unmarked");
assert(marked[0].productionLayer === true, "marked copy is a production layer");
assert(marked[0].policyMatchKey === "42", "match key ignores leading zeros");
assert(marked[0].policyNumberFull === "0042", "full number stays on the copy");

console.log("\n4) commit path stays inside production");
assert(app.includes("P.applyProductionReport"), "commit writes the production report");
assert(app.includes("P.applyProductionLayer"), "single-row writer remains available");
assert(app.includes('const productionLayerImport = phoenixImport || companyNow === "מנורה"'), "phoenix and menora stay on the production layer");
assert(app.includes('companyNow === "הכשרה"'), "hachshara uses the production layer");
assert(app.includes('companyNow === "מגדל"'), "migdal uses the production layer");
assert(app.includes('companyNow === "כלל"'), "clal uses the production layer");
assert(app.includes("gi_production_reports"), "archive table is written");
assert(app.includes("cfNewPolicyCard__val--policyNo"), "policy number has its own class");
assert(!app.includes(".cfNewPolicyCard__val{"), "shared card value class is not redefined in app.js");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
