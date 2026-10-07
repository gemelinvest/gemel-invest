/* GI-NP-GRAND 2026-10-07
   בסיכום הפוליסות: כרטיס סה״כ בצד שמאל — לפני הנחה ואחרי הנחה.
   אותם מקורות כמו שורת הפוליסה. בלי החלפת BUILD/SIM. בלי שינוי KPI.
   הרצה: node _test-np-sum-totals.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const BUILD = "20261007-lead-dup-v1";
const SIM_TAG = "20261007-np-health-buy-v1";
let failed = 0;
let passed = 0;

function assert(cond, msg){
  if(cond){ passed += 1; console.log("  PASS  " + msg); }
  else { failed += 1; console.error("  FAIL  " + msg); }
}
function read(name){ return fs.readFileSync(path.join(ROOT, name), "utf8"); }
function sliceBetween(src, startToken, endToken){
  const start = src.indexOf(startToken);
  const end = src.indexOf(endToken, start + startToken.length);
  if(start < 0 || end < 0) return "";
  return src.slice(start, end);
}

const wiz = read("gi-wizard.js");
const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");
const css = read("app.css");
const renderStart = wiz.indexOf("renderStep5(){");
const renderEnd = wiz.indexOf("renderStep6(ins){", renderStart);
const renderFn = (renderStart >= 0 && renderEnd > renderStart) ? wiz.slice(renderStart, renderEnd) : "";

console.log("1) syntax + BUILD/SIM stay; cache via &giSumTot=1");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(app.includes('const BUILD = "' + BUILD + '"'), "BUILD stays");
assert(wiz.includes('GI_WIZARD_BUILD = "' + BUILD + '"'), "wizard BUILD stays");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + SIM_TAG + '"'), "SIM tag stays");
assert(html.includes("&giSumTot=1"), "index.html busts giSumTot");
assert(html.includes("&giProwRtl=1&giSumTot=1"), "css keeps prow-rtl and adds giSumTot");
assert(app.includes('&giNpPlan=1" + "&giSumTot=1"'), "wizard href adds giSumTot");
assert(sw.includes("sum-tot-v1"), "service-worker busts sum-tot");
assert(sw.includes(BUILD), "SW still has BUILD");

console.log("\n2) summary body: rows on the right, grand on the left");
assert(wiz.includes("GI-NP-GRAND"), "grand marker");
assert(wiz.includes("sumProposalPolicyPremiums(list)"), "sum helper");
assert(wiz.includes("renderProposalPremiumGrandHtml(list)"), "grand html helper");
assert(renderFn.includes("lcNpSumBody"), "summary body wraps rows + grand");
assert(renderFn.includes("this.renderProposalPremiumGrandHtml(rowItems)"), "grand uses displayed rows");
assert(css.includes(".lcNpSumBody{"), "summary body grid");
assert(css.includes("grid-template-columns:minmax(0,1fr) minmax(248px,300px)"), "rows then totals (RTL = right then left)");
assert(css.includes(".lcNpGrand{"), "grand card styles");
assert(css.includes(".lcNpGrand__line--after"), "after-discount line");
assert(css.includes("position:sticky"), "grand stays while scrolling rows");
assert(!css.includes(".lcNpGrand{") || !/GI-NP-GRAND[\s\S]{0,400}\.lcNpTot--sum/.test(css), "grand is not the old calc-box");

console.log("\n3) same before/after sources as the policy row; no KPI rewrite");
const sumSrc = sliceBetween(wiz, "sumProposalPolicyPremiums(list){", "renderProposalPremiumGrandHtml(list){");
assert(sumSrc.includes("this.getHealthRowPremiumAfterDiscount(p)"), "after uses row after-discount");
assert(sumSrc.includes("this.getPolicyPremiumBeforeDiscount(p) || afterPrem"), "before matches the row");
assert(!sumSrc.includes("getPolicyPremiumAfterDiscount"), "does not use the legacy before-as-after helper");
assert(wiz.includes("סה״כ להצעה"), "grand title");
assert(wiz.includes(">לפני הנחה<"), "before label");
assert(wiz.includes(">אחרי הנחה<"), "after label");
assert(wiz.includes("חיסכון ${this.formatMoneyValue(tot.saved)} לחודש"), "monthly savings chip");
assert(/getPolicyPremiumAfterDiscount\(policy\)\{\s*\/\/ 20260502-vFinalPremiumNoDiscountCalc:/.test(wiz), "legacy after-discount engine comment stays");

{
  const start = wiz.indexOf("sumProposalPolicyPremiums(list){");
  let i = wiz.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for(; i < wiz.length; i++){
    if(wiz[i] === "{") depth += 1;
    else if(wiz[i] === "}"){
      depth -= 1;
      if(depth === 0){ end = i + 1; break; }
    }
  }
  const methodSrc = start >= 0 && end > start ? wiz.slice(start, end) : "";
  const box = {
    getHealthRowPremiumAfterDiscount(p){ return Number(p.after); },
    getPolicyPremiumBeforeDiscount(p){ return Number(p.before); },
    sumProposalPolicyPremiums: null
  };
  box.sumProposalPolicyPremiums = new Function("return function " + methodSrc)();
  const tot = box.sumProposalPolicyPremiums([
    { before: 257.88, after: 207.44 },
    { before: 100, after: 70 }
  ]);
  assert(tot.count === 2, "counts two policies");
  assert(Math.abs(tot.before - 357.88) < 0.001, "sums before-discount");
  assert(Math.abs(tot.after - 277.44) < 0.001, "sums after-discount");
  assert(Math.abs(tot.saved - 80.44) < 0.001, "saved is before minus after");
}

if(failed){
  console.error("\nFAILED " + failed + "/" + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
