/* GI-CAR-CLICK-TOPBAR-ICON 20260826-car-icon-v1
   Topbar "רכב בקליק" must show a sedan, matching neighboring stroke icons.
   Run: node _test-car-click-topbar-icon.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

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

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const start = html.indexOf('id="btnCarInsuranceClick"');
const nextBtn = html.indexOf("<button", start + 1);
const block = start >= 0 ? html.slice(start, nextBtn > start ? nextBtn : start + 1800) : "";
const proposal = html.slice(
  html.indexOf('id="btnNewCustomerWizard"'),
  html.indexOf('id="btnCarInsuranceClick"')
);

console.log("1) topbar car button");
assert(start >= 0, "car-click topbar button exists");
assert(block.includes('data-gi-car-icon="sedan"'), "sedan marker on the SVG");
assert(block.includes('stroke-width="1.9"'), "same stroke width as neighboring topbar icons");
assert(block.includes('stroke-linecap="round"'), "round caps");
assert(block.includes('stroke-linejoin="round"'), "round joins");
assert(block.includes('stroke="currentColor"'), "inherits button color like siblings");
assert((block.match(/<circle /g) || []).length === 2, "two wheels");
assert(block.includes('cx="7"') && block.includes('cx="17"'), "wheels sit under the body");
assert(block.includes("M19 17h2"), "rear bumper / trunk reads as a car, not a box");
assert(!block.includes("M8 9V7.5"), "old toaster-cabin path removed");
assert(!block.includes("M5 12h14"), "old flat belt-line path removed");

console.log("\n2) matches neighboring proposal button family");
assert(proposal.includes('stroke-width="1.9"'), "new-proposal icon uses stroke 1.9");
assert(proposal.includes('stroke="currentColor"'), "new-proposal icon uses currentColor");
assert(block.includes('viewBox="0 0 24 24"') && proposal.includes('viewBox="0 0 24 24"'), "both icons share 24 viewBox");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
