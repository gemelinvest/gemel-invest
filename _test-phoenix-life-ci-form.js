/* Phoenix health marks + one form when risk and critical illness are both purchased.
   Run: node _test-phoenix-life-ci-form.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
const TAG = "20261007-lead-dup-v1";
let passed = 0;
let failed = 0;

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
const health = fs.readFileSync(path.join(ROOT, "gi-phoenix-health-form.js"), "utf8");
const combo = fs.readFileSync(path.join(ROOT, "gi-phoenix-life-ci-form.js"), "utf8");

console.log("1) routing");
assert(app.includes("qualifiesForPhoenixLifeCiForm"), "qualify exists");
assert(app.includes('phoenixLifeCiForm: "phoenix_life_ci_form"'), "document type");
assert(app.includes("doc_phoenix_life_ci_form"), "customer file id");
assert(app.includes("!phxLifeCi && this.qualifiesForPhoenixLifeShortForm"), "risk short is not added beside the combined form");
assert(app.includes("!phxLifeCi && this.qualifiesForPhoenixLifeFullForm"), "risk full is not added beside the combined form");
assert(app.includes("!phxLifeCi && this.qualifiesForPhoenixHealthForm"), "health form is not added beside the combined form");
assert(app.includes("return CD.TYPES.phoenixLifeCiForm"), "mirror opens the combined form");
assert(fs.existsSync(path.join(ROOT, "forms/phoenix-life-ci/phoenix-life-ci-join.pdf")), "combined PDF is stored");

console.log("\n2) health form fills covers and declaration marks");
assert(health.includes("coversForInsured"), "covers are read per insured");
assert(health.includes("healthCoversPerInsured"), "per-insured cover list is used");
assert(health.includes("drawCheckedMarks"), "checked boxes are drawn on the page");
assert(health.includes('map: "phoenix_health"'), "health declaration yes/no still mapped");
assert(health.includes('amounts.phoenixCriticalAmount'), "critical-illness amount is read from the proposal");

const ctx = { console, location: { href: "http://localhost/", pathname: "/" } };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(health, ctx);
const letters = ctx.PhoenixHealthForm.coverLetters([
  "השתלות וטיפולים מיוחדים מחוץ לישראל",
  "תרופות מחוץ לסל שירותי הבריאות",
  "אבחון רפואי מהיר",
  "ייעוץ ובדיקות",
  "משלים שב\"ן עם השתתפות עצמית 5,000 ₪"
]);
assert(letters.indexOf("C") >= 0, "transplants → C");
assert(letters.indexOf("D") >= 0, "drugs → D");
assert(letters.indexOf("Q") >= 0, "fast diagnosis → Q");
assert(letters.indexOf("F") >= 0, "consults → F");
assert(letters.indexOf("A") >= 0, "shaban 5000 → A");
assert(letters.indexOf("R") < 0, "shaban 5000 is not also the no-deductible box");
const per = ctx.PhoenixHealthForm.coversForInsured({
  healthCovers: ["תרופות מחוץ לסל שירותי הבריאות"],
  healthCoversPerInsured: { a: ["אבחון רפואי מהיר"], b: ["רפואה משלימה"] }
}, { id: "b" });
assert(per.length === 1 && per[0] === "רפואה משלימה", "spouse column uses that insured's covers");

console.log("\n3) combined declaration rows");
vm.runInContext(combo, ctx);
assert(ctx.PhoenixLifeCiForm.DECL_ROWS.length === 12, "short declaration has 12 question rows");
assert(ctx.PhoenixLifeCiForm.DECL_ROWS[0].keys.indexOf("phoenix_critical_illness__ci_tests") >= 0, "first row is tests");
assert(ctx.PhoenixLifeCiForm.DECL_ROWS[11].keys.indexOf("phoenix_critical_illness__ci_family") >= 0, "last row is family");
assert(ctx.PhoenixLifeCiForm.isRiskPolicy({ company: "הפניקס", type: "ריסק" }), "phoenix risk counts");
assert(!ctx.PhoenixLifeCiForm.isRiskPolicy({ company: "הפניקס", type: "ריסק משכנתא" }), "mortgage stays on its own form");
assert(ctx.PhoenixLifeCiForm.isCiPolicy({ company: "הפניקס", type: "מחלות קשות" }), "critical illness counts");
assert(ctx.PhoenixLifeCiForm.qualifies({
  newPolicies: [
    { company: "הפניקס", type: "ריסק" },
    { company: "הפניקס", type: "מחלות קשות" }
  ]
}), "risk plus critical illness qualifies");
assert(!ctx.PhoenixLifeCiForm.qualifies({
  newPolicies: [{ company: "הפניקס", type: "מחלות קשות" }]
}), "critical illness alone does not use the combined form");
assert(combo.includes("GiluiTotalRisk"), "risk sum is written");
assert(app.includes("./gi-phoenix-health-form.js?v=" + TAG), "health script cache tag");
assert(app.includes("./gi-phoenix-life-ci-form.js?v=" + TAG), "combined script cache tag");

console.log("\n=== " + passed + " passed, " + failed + " failed ===");
process.exit(failed ? 1 : 0);
