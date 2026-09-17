/* GI-MONTH-NET-AFTER 2026-09-17
   כרטיס «פרמיה חודשית נטו» חייב להיות סכום אחרי הנחה מתחילת החודש,
   לא ברוטו מ-premiumAfterDiscountValue / premiumMonthly.
   RPC gi_policy_premium מתואם ל-policyNetPremium.
   הרצה: node _test-dashboard-month-net-after-discount.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260917-lead-toast-v1";
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
const html = read("index.html");
const sw = read("service-worker.js");
const sql = read("supabase-gi-policy-premium-after-discount.sql");
const wizard = read("gi-wizard.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-dashboard-month-net-after-discount.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) RPC אחרי הנחה + היקף תפקידים");
assert(sql.includes("gi_policy_sim_after_discount"), "SQL helper לסכום סימולטור אחרי הנחה");
assert(sql.includes("simDiscountPerInsured"), "SQL קורא ל-simDiscountPerInsured");
assert(sql.includes("monthlyAfterDiscount"), "SQL קורא ל-monthlyAfterDiscount");
assert(sql.includes("via_file > 0 and stored > 0 and via_file < stored"), "סימולטור מנצח ברוטו שמור");
assert(app.includes("GI-MONTH-NET-AFTER"), "סמן ב-app.js");
assert(app.includes("afterDiscount: true"), "overlay חודשי מסומן אחרי הנחה");
assert(app.includes("client.rpc(\"gi_dashboard_net_premium\""), "כרטיס חודשי עדיין מ-RPC");
assert(app.includes('if(this.isAdmin() || this.isManager()) return "all"'), "מנהל/מנהל מערכת — הכל");
assert(app.includes('if(this.isTeamManager()) return "team"'), "מנהל צוות — צוות");
assert(app.includes("return customerOwnedByCurrentAgent(rec) || customerOwnedByManagedTeam(rec)"), "מנהל צוות כולל עצמו");
assert(app.includes("return all.filter((rec) => this.isCustomerOwnedByCurrentAgent(rec))"), "נציג רק את שלו");
assert(extractObjectMethod(wizard, "getPolicyPremiumAfterDiscount").includes("getPolicyPremiumBeforeDiscount"), "אשף AfterDiscount נשאר לפני");

console.log("\n3) policyNetPremium — אחרי 28.75, לא ברוטו 95.83");
const policyNet = extractObjectMethod(app, "policyNetPremium");
assert(!!policyNet, "חולץ policyNetPremium");
const sandbox = {
  CustomersUI: {
    asMoneyNumber(v){
      const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    },
    getNewPolicyFilePremiumAfterDiscount(p){
      const n = Number(p?.simDiscountPerInsured?.ins1?.monthlyAfterDiscount);
      return n > 0 ? n : 0;
    }
  }
};
vm.runInNewContext(
  "this.policyNetPremium = function" + policyNet.slice("policyNetPremium".length) + ";",
  sandbox
);
assert(sandbox.policyNetPremium({
  premiumMonthly: "95.83",
  premiumValue: "95.83",
  premiumAfterDiscountValue: 95.83,
  simDiscountPerInsured: { ins1: { monthlyAfterDiscount: 28.75 } }
}) === 28.75, "אחרי הנחה 28.75 לא 95.83 ברוטו");
assert(sandbox.policyNetPremium({
  premiumMonthly: "150",
  premiumAfterDiscountValue: 97.5
}) === 97.5, "stored אחרי בלי סימולטור נשאר");
assert(sandbox.policyNetPremium({
  premiumMonthly: "88",
  premiumValue: "88"
}) === 88, "בלי הנחה — הפרמיה שהוזנה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
