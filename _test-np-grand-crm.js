/* GI-NP-GRAND-CRM 2026-10-07
   מסיר חיסכון לחודש ומעצב את כרטיס הסה״כ כמערכת CRM ביטוחית.
   בלי החלפת BUILD/SIM. בלי שינוי KPI.
   הרצה: node _test-np-grand-crm.js
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

const css = read("app.css");
const html = read("index.html");
const app = read("app.js");
const sw = read("service-worker.js");
const wiz = read("gi-wizard.js");
const crmIdx = css.lastIndexOf("GI-NP-GRAND-CRM");
const crm = crmIdx >= 0 ? css.slice(crmIdx) : "";
const renderStart = wiz.indexOf("renderProposalPremiumGrandHtml(list){");
const renderEnd = wiz.indexOf("applyAllProposalInsuredsToDraft(){", renderStart);
const renderFn = (renderStart >= 0 && renderEnd > renderStart) ? wiz.slice(renderStart, renderEnd) : "";

console.log("1) syntax + BUILD/SIM stay; cache via &giGrandCrm=1");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + BUILD + '"'), "BUILD stays");
assert(wiz.includes('GI_WIZARD_BUILD = "' + BUILD + '"'), "wizard BUILD stays");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + SIM_TAG + '"'), "SIM tag stays");
assert(html.includes("&giGrandCrm=1"), "index.html busts giGrandCrm");
assert(html.includes("&giSumChrome=1&giGrandCrm=1"), "css keeps sum-chrome and adds grand-crm");
assert(app.includes("&giGrandCrm=1"), "wizard href busts giGrandCrm");
assert(sw.includes("grand-crm-v1"), "service-worker busts grand-crm");
assert(sw.includes("sum-chrome-v1"), "sum-chrome cache suffix stays");

console.log("\n2) monthly savings is gone from the grand card");
assert(css.includes("GI-NP-GRAND-CRM"), "crm marker");
assert(!renderFn.includes("lcNpGrand__saved"), "saved class not rendered");
assert(!renderFn.includes("חיסכון"), "savings copy not rendered");
assert(!renderFn.includes("לחודש"), "monthly savings label not rendered");
assert(renderFn.includes("lcNpGrand__head"), "navy statement header");
assert(renderFn.includes("lcNpGrand__lines"), "ledger lines wrap");
assert(renderFn.includes(">לפני הנחה<"), "before line stays");
assert(renderFn.includes(">אחרי הנחה<"), "after line stays");
assert(crm.includes(".lcNpGrand__saved{ display:none; }"), "leftover savings chip is hidden");

console.log("\n3) grand card is an insurance ledger, not a gold garden card");
assert(crm.includes(".lcNpGrand__head{"), "statement header last-wins");
assert(crm.includes("background:#1b365d"), "navy header instead of gold hairline");
assert(crm.includes("background:#fff"), "white ledger body, not cream gradient");
assert(crm.includes("border-radius:2px"), "sharp CRM corners");
assert(!crm.includes("#c9a227"), "crm last-wins drops gold");
assert(!crm.includes("#fffdf6"), "crm last-wins drops cream");
assert(!crm.includes("#f3faf5"), "crm last-wins drops pastel green after-box");
assert(crm.includes(".lcNpGrand__line--after strong{ color:#0f2744"), "after amount is navy, not candy green");
assert(crm.includes("font-size:28px"), "after amount stays large");
assert(crm.includes(".lcNpGrand__title{"), "title last-wins");
assert(crm.includes("font-size:20px"), "title stays readable");

console.log("\n4) add-policy control matches the CRM, not a gold pill");
assert(crm.includes(".lcNpAddMore{"), "add button last-wins");
assert(crm.includes("background:#1b365d"), "add button is navy");
assert(crm.includes("border-radius:2px"), "add button is not a pill");
assert(!crm.includes("#f7e7a3"), "add button last-wins drops gold fill");
assert(!crm.includes("border-radius:999px"), "add button last-wins drops pill radius");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
