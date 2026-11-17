/* The health declaration and the customer-file form follow the same sum and age.
   Run: node _test-proposal-routing-audit.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
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

function extractMethod(src, signature){
  const start = src.indexOf(signature);
  if(start < 0) throw new Error("missing " + signature);
  let i = src.indexOf("{", start);
  let depth = 0;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error("unclosed " + signature);
}

function yearsAgo(age){
  const d = new Date();
  d.setMonth(0, 15);
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().slice(0, 10);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const names = [
  "gapPolicyBlob(policy){",
  "hachsharaLifePolicyBlob(policy){",
  "isHachsharaLifeLikePolicy(policy){",
  "hachsharaRiskSumNumber(policy){",
  "hachsharaRiskAmountMode(payload){",
  "hachsharaRiskAgeOut(policy, payload){",
  "hachsharaRiskIsShort(policy, payload){",
  "qualifiesForHachsharaLifeForm(payload, rec){",
  "qualifiesForHachsharaLifeShortForm(payload, rec){",
  "calcAgeYears(birthDate){",
  "phoenixRiskSumNumber(policy){",
  "isPhoenixRiskMortgagePolicy(policy){",
  "isPhoenixCiPolicy(policy){",
  "phoenixCiExtended(payload){",
  "phoenixCriticalIllnessExtended(payload){",
  "phoenixHasHealthProduct(payload, rec){",
  "qualifiesForPhoenixHealthForm(payload, rec){",
  "qualifiesForPhoenixCiForm(payload, rec){",
  "ayalonCiPolicies(payload, rec){",
  "ayalonCiOverShortLimit(payload, rec){",
  "ayalonHasHealthProduct(payload, rec){",
  "qualifiesForAyalonHealthForm(payload, rec){",
  "qualifiesForAyalonCiForm(payload, rec){"
];
const script = `
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
const api = {
${names.map((name) => extractMethod(app, name)).join(",\n")},
listOfficialJoinFormPolicies(payload){ return Array.isArray(payload && payload.newPolicies) ? payload.newPolicies : []; },
officialJoinFormInPeriod(){ return true; }
};
this.api = api;
`;
const sandbox = {};
vm.runInNewContext(script, sandbox);
const api = sandbox.api;

function person(id, age){
  return { id, data: { birthDate: yearsAgo(age) } };
}
function file(policies, people){
  return { newPolicies: policies, insureds: people };
}

console.log("1) Hachshara life form follows 1,000,000 and ages 20-55");
{
  const young = file([{ id: "h1", type: "ריסק", company: "הכשרה", sumInsured: "500000", insuredIds: ["a"] }], [person("a", 40)]);
  assert(api.hachsharaRiskIsShort(young.newPolicies[0], young) === true, "age 40 and 500,000 stays on the short form");
  assert(api.qualifiesForHachsharaLifeShortForm(young, null) === true, "short life document opens");
  assert(api.qualifiesForHachsharaLifeForm(young, null) === false, "full life document stays closed");

  const older = file([{ id: "h2", type: "ריסק", company: "הכשרה", sumInsured: "500000", insuredIds: ["a"] }], [person("a", 56)]);
  assert(api.hachsharaRiskIsShort(older.newPolicies[0], older) === false, "age 56 leaves the short form");
  assert(api.qualifiesForHachsharaLifeForm(older, null) === true, "age 56 opens the full life document");

  const child = file([{ id: "h3", type: "ריסק", company: "הכשרה", sumInsured: "200000", insuredIds: ["a"] }], [person("a", 19)]);
  assert(api.hachsharaRiskIsShort(child.newPolicies[0], child) === false, "age 19 leaves the short form");

  const big = file([{ id: "h4", type: "ריסק", company: "הכשרה", sumInsured: "1500000", insuredIds: ["a"] }], [person("a", 40)]);
  assert(api.hachsharaRiskIsShort(big.newPolicies[0], big) === false, "1.5 million leaves the short form");

  const edge = file([{ id: "h5", type: "ריסק", company: "הכשרה", sumInsured: "1000000", insuredIds: ["a"] }], [person("a", 55)]);
  assert(api.hachsharaRiskIsShort(edge.newPolicies[0], edge) === true, "age 55 and exactly 1 million stays short");

  const magen = file([{ id: "h6", type: "ריסק", company: "הכשרה", productName: "מגן לעתיד", sumInsured: "200000", insuredIds: ["a"] }], [person("a", 40)]);
  assert(api.hachsharaRiskIsShort(magen.newPolicies[0], magen) === false, "מגן לעתיד stays on the full form");
}

console.log("\n2) Phoenix critical illness under the threshold keeps form 300101240");
{
  const small = file([{ id: "p1", type: "מחלות קשות", company: "הפניקס", sumInsured: "500000", insuredIds: ["a"] }], [person("a", 40)]);
  assert(api.phoenixCriticalIllnessExtended(small) === false, "age 40 and 500,000 is not extended");
  assert(api.qualifiesForPhoenixHealthForm(small, null) === false, "the health form stays closed");
  assert(api.qualifiesForPhoenixCiForm(small, null) === true, "the official short CI form opens");

  const old = file([{ id: "p2", type: "מחלות קשות", company: "הפניקס", sumInsured: "100000", insuredIds: ["a"] }], [person("a", 61)]);
  assert(api.qualifiesForPhoenixHealthForm(old, null) === true, "age 61 opens the health form");
  assert(api.qualifiesForPhoenixCiForm(old, null) === false, "age 61 closes the flat CI form");

  const large = file([{ id: "p3", type: "מחלות קשות", company: "הפניקס", sumInsured: "2500000", insuredIds: ["a"] }], [person("a", 40)]);
  assert(api.qualifiesForPhoenixHealthForm(large, null) === true, "2.5 million opens the health form");
  assert(api.qualifiesForPhoenixCiForm(large, null) === false, "2.5 million closes the flat CI form");

  const exact = file([{ id: "p4", type: "מחלות קשות", company: "הפניקס", sumInsured: "2000000", insuredIds: ["a"] }], [person("a", 60)]);
  assert(api.qualifiesForPhoenixCiForm(exact, null) === true, "age 60 and exactly 2 million stays on the short form");

  const withHealth = file([
    { id: "p5", type: "מחלות קשות", company: "הפניקס", sumInsured: "200000", insuredIds: ["a"] },
    { id: "p6", type: "בריאות", company: "הפניקס", insuredIds: ["a"] }
  ], [person("a", 40)]);
  assert(api.qualifiesForPhoenixHealthForm(withHealth, null) === true, "CI sold with health opens the health form");
  assert(api.qualifiesForPhoenixCiForm(withHealth, null) === false, "CI sold with health does not open the flat form");
}

console.log("\n3) Ayalon critical illness above 350,000 uses the health form");
{
  const small = file([{ id: "a1", type: "מחלות קשות", company: "איילון", sumInsured: "200000" }], [person("a", 40)]);
  assert(api.qualifiesForAyalonCiForm(small, null) === true, "200,000 stays on the short CI form");
  assert(api.qualifiesForAyalonHealthForm(small, null) === false, "200,000 does not open the health form");

  const big = file([{ id: "a2", type: "מחלות קשות", company: "איילון", compensation: "400000" }], [person("a", 40)]);
  assert(api.qualifiesForAyalonCiForm(big, null) === false, "400,000 closes the short CI form");
  assert(api.qualifiesForAyalonHealthForm(big, null) === true, "400,000 opens health form 001");

  const withHealth = file([
    { id: "a3", type: "מחלות קשות", company: "איילון", sumInsured: "100000" },
    { id: "a4", type: "בריאות", company: "איילון" }
  ], [person("a", 40)]);
  assert(api.qualifiesForAyalonCiForm(withHealth, null) === false, "CI sold with health does not open the short form");
  assert(api.qualifiesForAyalonHealthForm(withHealth, null) === true, "the health product still opens its form");
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
