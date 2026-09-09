/* GI-DASH-NET 2026-09-08 — «נמכר היום» ו«פרמיה חודשית נטו» מציגים אחרי הנחה.
   לא נוגעים במנוע האשף: getPolicyPremiumAfterDiscount נשאר «לפני» בכוונה.
   הרצה: node _test-dashboard-net-after-discount.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260909-version-resume-v1";
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
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-dashboard-net-after-discount.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) מקורות — דשבורד אחרי, אשף לפני");
const policyNet = extractObjectMethod(app, "policyNetPremium");
assert(!!policyNet, "חולץ policyNetPremium");
assert(policyNet.includes("premiumAfterDiscountValue"), "כרטיסים קוראים לערך אחרי הנחה שכבר חושב");
assert(policyNet.includes("getNewPolicyFilePremiumAfterDiscount"), "נפילה לחישוב אחרי-הנחה של התיק");
assert(!policyNet.includes("getPolicyPremiumAfterDiscount"), "policyNetPremium לא קורא ל«לפני הנחה»");
assert(app.includes("buildTodaySalesMetrics(){"), "כרטיס נמכר היום קיים");
assert(app.includes("this.policyNetPremium(p)"), "נמכר היום / נטו חודשי עדיין דרך policyNetPremium");
assert(wizard.includes("return this.getPolicyPremiumBeforeDiscount(policy);"), "אשף: AfterDiscount נשאר לפני");
assert(extractObjectMethod(wizard, "getPolicyPremiumAfterDiscount").includes("getPolicyPremiumBeforeDiscount"), "מנוע האשף לא הוחלף");
const heavy = extractObjectMethod(app, "collectNewPoliciesForMetrics");
assert(heavy.includes("getNewPolicyFilePremiumAfterDiscount"), "מסלול payload כבד גם אחרי הנחה");

console.log("\n3) התנהגות — לפני 150, אחרי 97.5 → הכרטיס מציג 97.5");
const sandbox = {
  CustomersUI: {
    getPolicyPremiumAfterDiscount(){ return 150; },
    getNewPolicyFilePremiumAfterDiscount(){ return 150; },
    asMoneyNumber(v){
      const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    }
  }
};
vm.runInNewContext(
  "this.policyNetPremium = function" + policyNet.slice("policyNetPremium".length) + ";",
  sandbox
);

const displayRow = {
  origin: "new",
  type: "בריאות",
  company: "הכשרה",
  premiumValue: "150",
  premiumMonthly: "150",
  premiumAfterDiscountValue: 97.5
};
assert(sandbox.policyNetPremium(displayRow) === 97.5, "שורת תצוגה: אחרי הנחה מנצח את הברוטו");
assert(sandbox.policyNetPremium(displayRow) !== 150, "לא מציגים 150 לפני הנחה");

const rawNoStored = {
  origin: "new",
  type: "ריסק",
  premiumValue: "200",
  simDiscountPerInsured: { ins1: { monthlyAfterDiscount: 140 } }
};
sandbox.CustomersUI.getNewPolicyFilePremiumAfterDiscount = function(p){
  const n = Number(p?.simDiscountPerInsured?.ins1?.monthlyAfterDiscount);
  return n > 0 ? n : 200;
};
assert(sandbox.policyNetPremium(rawNoStored) === 140, "בלי stored — נפילה לחישוב אחרי הנחה");

const storedGross = {
  origin: "new",
  type: "ריסק",
  premiumMonthly: "95.83",
  premiumValue: "95.83",
  premiumAfterDiscountValue: 95.83,
  simDiscountPerInsured: { ins1: { monthlyAfterDiscount: 28.75 } }
};
sandbox.CustomersUI.getNewPolicyFilePremiumAfterDiscount = function(p){
  const n = Number(p?.simDiscountPerInsured?.ins1?.monthlyAfterDiscount);
  return n > 0 ? n : Number(p?.premiumAfterDiscountValue) || 0;
};
assert(sandbox.policyNetPremium(storedGross) === 28.75, "stored ברוטו + סימולטור אחרי — הכרטיס מציג אחרי");
assert(sandbox.policyNetPremium(storedGross) !== 95.83, "לא מציגים 95.83 לפני הנחה");

const noDiscount = { origin: "new", premiumValue: "88", premiumMonthly: "88" };
sandbox.CustomersUI.getNewPolicyFilePremiumAfterDiscount = function(){ return 0; };
assert(sandbox.policyNetPremium(noDiscount) === 88, "בלי הנחה — פרמיה שהוזנה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
