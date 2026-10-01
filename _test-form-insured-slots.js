/* GI-FORM-INSURED-SLOTS 20261001-health-form-wide-v1
   Company form identity + every insured who fits a row is placed.
   Run: node _test-form-insured-slots.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

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

function loadForm(file){
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox.window;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), "utf8"), sandbox, { filename: file });
  return sandbox.window;
}

function people(){
  return [
    { id: "p0", type: "primary", data: { firstName: "ראשי", lastName: "כהן", idNumber: "111" } },
    { id: "p1", type: "adult", data: { firstName: "בגיר", lastName: "כהן", idNumber: "222" } },
    { id: "p2", type: "child", data: { firstName: "ילד1", lastName: "כהן", idNumber: "333" } },
    { id: "p3", type: "child", data: { firstName: "ילד2", lastName: "כהן", idNumber: "444" } },
    { id: "p4", type: "adult", data: { firstName: "בגיר2", lastName: "כהן", idNumber: "555" } }
  ];
}

function names(group){
  return [group.primary, group.spouse].concat(group.children || []).filter(Boolean).map((p) => p.data.firstName);
}

console.log("1) Migdal health template is not the Ayalon file");
const migdalPdf = fs.readFileSync(path.join(ROOT, "forms/migdal-health/migdal-health-join.pdf"));
const ayalonPdf = fs.readFileSync(path.join(ROOT, "forms/ayalon-health/ayalon-health-join.pdf"));
const migdalSha = crypto.createHash("sha256").update(migdalPdf).digest("hex");
const ayalonSha = crypto.createHash("sha256").update(ayalonPdf).digest("hex");
assert(migdalSha !== ayalonSha, "migdal health pdf differs from ayalon health");
assert(migdalPdf.length > 100000, "migdal health pdf is a real template");

console.log("\n2) five insureds land on family rows, two on life rows");
const gap = loadForm("gi-gap-join-forms.js");
const family = gap.MigdalHealthForm.classifyInsureds({ insureds: people() });
assert(names(family).join(",") === "ראשי,בגיר,ילד1,ילד2,בגיר2", "migdal health places all five");
const life = gap.AyalonLifeForm.classifyInsureds({ insureds: people() });
assert(names(life).join(",") === "ראשי,בגיר", "ayalon life keeps the two candidate rows");
assert((life.children || []).length === 0, "ayalon life has no child columns");

const ayalon = loadForm("gi-ayalon-health-form.js");
const ayalonFamily = ayalon.AyalonHealthForm.classifyInsureds({ insureds: people() });
assert(names(ayalonFamily).join(",") === "ראשי,בגיר,ילד1,ילד2,בגיר2", "ayalon health places all five");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
