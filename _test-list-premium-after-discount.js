/* GI-LIST-AFTER-DISC 2026-09-08
   «לקוחות אחרונים» בדשבורד וטבלת הלקוחות מציגים פרמיה אחרי הנחה,
   כמו בתיק הלקוח. getPolicyPremiumAfterDiscount באשף נשאר «לפני».
   הרצה: node _test-list-premium-after-discount.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260909-session-keep-v2";
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

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

function extractObjectMethod(src, methodName){
  const needle = "\n    " + methodName + "(";
  const start = src.indexOf(needle);
  if(start < 0) return "";
  let i = start + needle.length;
  let depthParen = 1;
  while(i < src.length && depthParen > 0){
    const ch = src[i];
    if(ch === "(") depthParen += 1;
    else if(ch === ")") depthParen -= 1;
    i += 1;
  }
  const brace = src.indexOf("{", i);
  if(brace < 0) return "";
  let depth = 0;
  for(let j = brace; j < src.length; j += 1){
    const ch = src[j];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, j + 1).trim();
    }
  }
  return "";
}

const app = read("app.js");
const wizard = read("gi-wizard.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache unchanged");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache unchanged");

console.log("\n2) sources — list/dashboard after, wizard engine still before");
const shallow = extractObjectMethod(app, "sumNewPolicyPremiumsShallow");
assert(!!shallow, "חולץ sumNewPolicyPremiumsShallow");
assert(app.includes("GI-LIST-AFTER-DISC"), "marker on the list/dashboard sum");
assert(shallow.includes("getNewPolicyFilePremiumAfterDiscount"), "list sum uses the file after-discount helper");
assert(!/sum \+= this\.getPolicyPremiumAfterDiscount\(clonePolicyForMetrics/.test(shallow), "list sum no longer adds the wizard «לפני» helper");
assert(app.includes("recentPremiumCellHtml(rec){"), "dashboard recent customers cell exists");
assert(app.includes("customerListPremiumParts(rec)"), "recent cell and customers table share the same parts helper");
assert(app.includes("this.sumNewPolicyPremiumsShallow(rec)"), "customers-table monthly still comes from the shallow sum");
assert(wizard.includes("return this.getPolicyPremiumBeforeDiscount(policy);"), "wizard AfterDiscount stays before");
assert(extractObjectMethod(wizard, "getPolicyPremiumAfterDiscount").includes("getPolicyPremiumBeforeDiscount"), "wizard engine not rewritten");
assert(extractObjectMethod(app, "getNewPolicyFilePremiumAfterDiscount").includes("getHealthRowPremiumAfterDiscount"), "file helper still prefers the row after amount");
assert(extractObjectMethod(app, "sumPremiumAfterDiscount").includes("premiumAfterDiscountValue"), "file group total still sums after-discount");

console.log("\n3) runtime — Rita example: file 329.77, list must not show 396.85");
const sandbox = {
  getCustomerRawNewPolicies(rec){
    const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
    return Array.isArray(payload.newPolicies) ? payload.newPolicies : [];
  },
  clonePolicyForMetrics(raw){ return raw; }
};
sandbox.ui = {
  getPolicyPremiumAfterDiscount(p){
    return Number(p && (p.premiumMonthly || p.premiumValue) || 0) || 0;
  },
  getNewPolicyFilePremiumAfterDiscount(p){
    const map = p && p.simDiscountPerInsured;
    if(map && typeof map === "object"){
      let total = 0;
      let found = false;
      Object.keys(map).forEach((k) => {
        const n = Number(map[k] && map[k].monthlyAfterDiscount);
        if(Number.isFinite(n)){
          total += n;
          found = true;
        }
      });
      if(found) return Math.round(total * 100) / 100;
    }
    return this.getPolicyPremiumAfterDiscount(p);
  }
};
vm.runInNewContext(
  "this.ui.sumNewPolicyPremiumsShallow = function" + shallow.slice("sumNewPolicyPremiumsShallow".length) + ";",
  sandbox
);

const rita = {
  payload: {
    newPolicies: [
      { origin: "new", type: "ריסק", company: "הפניקס", premiumMonthly: "40.00", simDiscountPerInsured: { i1: { monthlyAfterDiscount: 28.75 } } },
      { origin: "new", type: "בריאות", company: "הפניקס", premiumMonthly: "80.00", simDiscountPerInsured: { i1: { monthlyAfterDiscount: 61.02 } } },
      { origin: "new", type: "מחלות קשות", company: "הפניקס", premiumMonthly: "276.85", simDiscountPerInsured: { i1: { monthlyAfterDiscount: 240 } } }
    ]
  }
};
const listed = sandbox.ui.sumNewPolicyPremiumsShallow(rita);
assert(listed === 329.77, "list/dashboard shows 28.75+61.02+240 = 329.77");
assert(listed !== 396.85, "does not show the gross 40+80+276.85 = 396.85");
const gross = rita.payload.newPolicies.reduce((s, p) => s + Number(p.premiumMonthly), 0);
assert(Math.round(gross * 100) / 100 === 396.85, "fixture gross is the dashboard bug number");

const noDiscount = {
  payload: { newPolicies: [{ origin: "new", type: "ריסק", premiumMonthly: "88" }] }
};
assert(sandbox.ui.sumNewPolicyPremiumsShallow(noDiscount) === 88, "without a discount the entered premium is shown");

if(failed){
  console.error("\nFAILED " + failed + "/" + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
