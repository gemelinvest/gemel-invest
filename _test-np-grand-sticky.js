/* GI-NP-GRAND-STICK 2026-10-07
   שורות הסיכום נגללות; כרטיס סה״כ משמאל נשאר במקום (לא בתוך הגלילה).
   בלי החלפת BUILD/SIM. בלי שינוי KPI.
   הרצה: node _test-np-grand-sticky.js
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
const grandIdx = css.lastIndexOf("GI-NP-GRAND-STICK");
const grandBlock = grandIdx >= 0 ? css.slice(grandIdx) : "";
const renderStart = wiz.indexOf("renderStep5(){");
const renderEnd = wiz.indexOf("renderStep6(ins){", renderStart);
const renderFn = (renderStart >= 0 && renderEnd > renderStart) ? wiz.slice(renderStart, renderEnd) : "";

console.log("1) syntax + BUILD/SIM stay; cache via &giGrandStick=1");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + BUILD + '"'), "BUILD stays");
assert(wiz.includes('GI_WIZARD_BUILD = "' + BUILD + '"'), "wizard BUILD stays");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + SIM_TAG + '"'), "SIM tag stays");
assert(html.includes("&giGrandStick=1"), "index.html busts giGrandStick");
assert(html.includes("&giSumTot=1&giGrandStick=1"), "css keeps sum-tot and adds grand-stick");
assert(sw.includes("grand-stick-v1"), "service-worker busts grand-stick");
assert(sw.includes("sum-tot-v1"), "grand-total cache suffix stays");

console.log("\n2) rows scroll; totals stay put");
assert(css.includes("GI-NP-GRAND-STICK"), "sticky marker");
assert(grandBlock.includes(".lcNpRows{"), "last-wins rows pane");
assert(grandBlock.includes("overflow-y:auto"), "rows column scrolls");
assert(grandBlock.includes("max-height:min(62vh"), "rows height is capped so the pane scrolls");
assert(grandBlock.includes("overscroll-behavior:contain"), "row scroll does not drag the page");
assert(grandBlock.includes(".lcNpGrand{"), "totals last-wins");
assert(grandBlock.includes("position:sticky"), "totals stay pinned");
assert(grandBlock.includes("align-self:start"), "totals do not stretch with the row list");
assert(renderFn.includes('class="lcNpSumBody"'), "rows and totals are siblings");
assert(renderFn.includes('class="lcNpRows"'), "rows wrap is the scroll pane");
assert(renderFn.includes("this.renderProposalPremiumGrandHtml(rowItems)"), "totals stay outside the rows wrap");
assert(!/lcNpRows[\s\S]{0,80}renderProposalPremiumGrandHtml/.test(renderFn), "totals are not nested inside the scrolling rows");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
