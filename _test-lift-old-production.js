/* העברת שורות טעינת פרודוקציה ישנה מטרום טיפול לפרודוקציה.
   הרצה: node _test-lift-old-production.js
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

function sliceMethod(src, name){
  const token = name + "(";
  const start = src.indexOf(token);
  if(start < 0) return "";
  const brace = src.indexOf("{", start);
  let depth = 0;
  for(let i = brace; i < src.length; i++){
    if(src[i] === "{") depth += 1;
    else if(src[i] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const card = app.slice(app.indexOf("renderNewPolicyCard(policy, rec, healthPolicies){"), app.indexOf("renderIssuedPolicyBadge(scan, policy){"));
const prod = app.slice(app.indexOf("renderProductionPolicyTable(rec){"), app.indexOf("renderPolicyTableView(rec, policies){"));

console.log("1) pretreatment hides the policy number, production keeps it");
assert(!card.includes("מספר פוליסה"), "the pretreatment card does not print a policy number");
assert(card.includes("תחילת ביטוח"), "the pretreatment card still prints the start date");
assert(prod.includes("מספר פוליסה"), "the production card still prints the policy number");

console.log("\n2) only an old production row moves");
const sandbox = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  window: {}
};
vm.createContext(sandbox);
const methods = [
  "isOldProductionLoadRow",
  "_productionCompanySame",
  "_productionMatchKey",
  "productionRowFromOldLoad",
  "liftOldProductionLoads"
].map((name) => sliceMethod(app, name));
assert(methods.every(Boolean), "lift helpers are in app.js");
vm.runInContext("const ui = {\n" + methods.map((body, i) => {
  const name = ["isOldProductionLoadRow", "_productionCompanySame", "_productionMatchKey", "productionRowFromOldLoad", "liftOldProductionLoads"][i];
  return name + "(" + body.slice(body.indexOf("(") + 1);
}).join(",\n") + "\n}; this.ui = ui;", sandbox);

const payload = {
  insureds: [{ id: "ins1", label: "נועה ליה", data: { firstName: "נועה", lastName: "ליה", idNumber: "123456782" } }],
  newPolicies: [
    {
      id: "npol_prod_800_ab",
      company: "מנורה",
      type: "בריאות",
      policyNumber: "00800",
      premiumMonthly: "58.50",
      startDate: "01/03/2024",
      insuredIds: ["ins1"],
      healthCovers: ["ייעוץ ובדיקות"],
      productionImport: { importedAt: "2026-01-01" }
    },
    {
      id: "npol_offer_1",
      company: "כלל",
      type: "ריסק",
      policyNumber: "",
      premiumMonthly: "40",
      productionImport: { source: "old-update" }
    }
  ],
  operational: { newPolicies: [] },
  productionPolicies: [{
    id: "prod_existing",
    company: "הפניקס",
    policyNumber: "119",
    policyMatchKey: "119"
  }]
};
payload.operational.newPolicies = payload.newPolicies.map((row) => Object.assign({}, row));
const changed = sandbox.ui.liftOldProductionLoads(payload);
assert(changed === true, "a stored old row is moved");
assert(payload.newPolicies.length === 1 && payload.newPolicies[0].id === "npol_offer_1", "the agent offer stays in pretreatment");
assert(payload.operational.newPolicies.length === 1 && payload.operational.newPolicies[0].id === "npol_offer_1", "the operational mirror drops the old row");
assert(payload.productionPolicies.length === 2, "the old row is added beside the existing production row");
const moved = payload.productionPolicies.find((row) => row.id === "prod_legacy_800_ab");
assert(moved && moved.company === "מנורה" && moved.premiumMonthly === "58.50", "company and premium stay the stored values");
assert(moved && moved.policyNumberFull === "00800" && moved.policyMatchKey === "800" && moved.startDate === "01/03/2024", "the policy number and start date stay stored");
assert(moved && moved.people[0] && moved.people[0].fullName === "נועה ליה", "the linked insured name is copied");
assert(moved && moved.covers[0] && moved.covers[0].name === "ייעוץ ובדיקות" && moved.covers[0].premium == null, "a stored cover name is copied without a made-up premium");
assert(sandbox.ui.liftOldProductionLoads(payload) === false, "a second pass does not add the row again");
assert(payload.productionPolicies.length === 2, "the production list is not duplicated");

const duplicate = {
  newPolicies: [{ id: "npol_prod_119_zz", company: "הפניקס", policyNumber: "0119", premiumMonthly: "10" }],
  productionPolicies: [{ id: "prod_existing", company: "הפניקס", policyNumber: "119", policyMatchKey: "119" }]
};
assert(sandbox.ui.liftOldProductionLoads(duplicate) === true, "a duplicate old row is still removed from pretreatment");
assert(duplicate.newPolicies.length === 0, "the duplicate leaves pretreatment");
assert(duplicate.productionPolicies.length === 1 && duplicate.productionPolicies[0].id === "prod_existing", "an existing production row is not copied");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
