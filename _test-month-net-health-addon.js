/* GI-MONTH-NET-ADDON 2026-09-23
   פרמיה חודשית נטו: בריאות עם תוספת נספרת אחרי הנחה.
   סכום שורת הבסיס ושורות התוספת = המחיר שאחרי ההנחה של הפוליסה.
   אחוז הנחה לבד לא מוכפל. חלון החודש לא משתנה.
   הרצה: node _test-month-net-health-addon.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260924-manager-toast-yield-v1";let failed = 0;
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

function round2(n){
  return Math.round((Number(n) || 0) * 100) / 100;
}

const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");
const wizard = read("gi-wizard.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes('const BUILD = "' + APP_TAG + '"'), "app.js BUILD");
assert(wizard.includes('GI_WIZARD_BUILD = "' + APP_TAG + '"'), "gi-wizard build");

console.log("\n2) חלוקה אחרי הנחה");
const method = extractObjectMethod(app, "allocateHealthAddonNetPremiums");
assert(!!method, "חולץ allocateHealthAddonNetPremiums");
assert(!method.includes("discountPct"), "החלוקה לא קוראת לאחוז הנחה");
const sandbox = {};
vm.runInNewContext(
  "this.allocateHealthAddonNetPremiums = function" + method.slice("allocateHealthAddonNetPremiums".length) + ";",
  sandbox
);
const split = sandbox.allocateHealthAddonNetPremiums(200, [50], 175);
assert(split.base === 140, "בסיס 200 מתוך 250 יורד ל-140");
assert(split.addons[0] === 35, "תוספת 50 יורדת ל-35");
assert(round2(split.base + split.addons[0]) === 175, "140+35 = 175");

const unchanged = sandbox.allocateHealthAddonNetPremiums(200, [50], 250);
assert(unchanged.base === 200 && unchanged.addons[0] === 50, "בלי הנחה נמוכה יותר נשאר 200+50");

const pctIgnored = sandbox.allocateHealthAddonNetPremiums(100, [], 100);
assert(pctIgnored.base === 100, "100 בלי מחיר אחרי הנחה נמוך נשאר 100");

const cover = sandbox.allocateHealthAddonNetPremiums(200, [50], 180);
assert(round2(cover.base + cover.addons[0]) === 180, "הנחת כיסוי 180 מתחלקת במדויק");

const two = sandbox.allocateHealthAddonNetPremiums(100, [33.33, 33.34], 100);
assert(round2(two.base + two.addons[0] + two.addons[1]) === 100, "שתי תוספתות עם הנחה נסגרות ל-100");
const twoAfter = sandbox.allocateHealthAddonNetPremiums(100.01, [33.33, 33.33], 100);
assert(round2(twoAfter.base + twoAfter.addons[0] + twoAfter.addons[1]) === 100, "עיגול נסגר ל-100");

console.log("\n3) שורות המכירה משתמשות בחלוקה, והאשף נשאר לפני הנחה");
const collect = extractObjectMethod(app, "collectPolicies");
assert(collect.includes("allocateHealthAddonNetPremiums"), "collectPolicies מחלק את הנטו");
assert(collect.includes("getNewPolicyFilePremiumAfterDiscount(p)"), "הסכום שאחרי ההנחה מחושב על הפוליסה");
assert(!collect.includes("hasAddons\n          ? this.getHealthPolicyBasePremium(p)"), "הבסיס לפני הנחה לא נכנס לבד לכרטיס");
const month = extractObjectMethod(app, "accumulateCustomerIntoBothAggs");
assert(month.includes("if(!stamp) continue;"), "בלי חותמת מכירה הפוליסה לא נכנסת לחודש");
assert(month.includes("policyNetPremium(p)"), "הכרטיס עדיין סוכם דרך policyNetPremium");
assert(extractObjectMethod(wizard, "getPolicyPremiumAfterDiscount").includes("getPolicyPremiumBeforeDiscount"), "אשף AfterDiscount נשאר לפני");

console.log("\n4) סכום השורות אחרי policyNetPremium");
const policyNet = extractObjectMethod(app, "policyNetPremium");
const netBox = {
  CustomersUI: {
    asMoneyNumber(v){
      const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    },
    getNewPolicyFilePremiumAfterDiscount(){
      return 0;
    }
  }
};
vm.runInNewContext(
  "this.policyNetPremium = function" + policyNet.slice("policyNetPremium".length) + ";",
  netBox
);
const rows = [
  { premiumAfterDiscountValue: split.base, premiumValue: "250", type: "בריאות" },
  { premiumAfterDiscountValue: split.addons[0], premiumValue: "50", type: "מחלות קשות" }
];
const summed = round2(rows.reduce((s, row) => s + netBox.policyNetPremium(row), 0));
assert(summed === 175, "הכרטיס סוכם 175 ולא 250");
assert(netBox.policyNetPremium({
  premiumMonthly: "95.83",
  premiumValue: "95.83",
  premiumAfterDiscountValue: 28.75
}) === 28.75, "ריסק שכבר נשמר אחרי הנחה נשאר 28.75");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
