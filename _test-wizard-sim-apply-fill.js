/* GI-WIZARD-SIM-FILL 2026-09-01
   החלת סימולטור → תאריך תחילה + פרמיה לפני/אחרי (לפני אופציונלי) + פירוט בריאות בדוח.
   הרצה: node _test-wizard-sim-apply-fill.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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

const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const sim = fs.readFileSync(path.join(ROOT, "gi-simulators.js"), "utf8");
const theme = fs.readFileSync(path.join(ROOT, "theme-wizard.css"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");

console.log("\n2) simulator apply fills start date + before/after");
assert(wiz.includes("toPolicyDraftIsoDate"), "ISO date helper exists");
assert(wiz.includes("parseAnyDmyDate"), "uses parseAnyDmyDate (future dates allowed)");
assert(!/toPolicyDraftIsoDate[\s\S]{0,400}parseBirthDateValue/.test(wiz), "start-date helper does not use parseBirthDateValue");
assert(wiz.includes("draft.startDate = startIso"), "onApply writes draft.startDate");
assert(wiz.includes("premiumBeforePerInsured"), "draft stores premium before discount");
assert(wiz.includes("monthlyPremiumAfterDiscount"), "onApply reads after-discount from sim");
assert(wiz.includes("healthCoverPremiums"), "per-cover health premiums stored");
assert(wiz.includes("data-pdraft-per-insured-premium-before"), "optional before field in form");
assert(wiz.includes("renderNpHealthPurchaseBlockHtml"), "health purchase breakdown renderer");

console.log("\n3) before-discount is optional; after stays required");
assert(!/miss\(\s*["']פרמיה לפני הנחה/.test(wiz), "validation does not require before-discount");
assert(wiz.includes("פרמיה חודשית לאחר הנחה"), "after-discount validation remains");
assert(wiz.includes("אופציונלי"), "before field labeled optional");

console.log("\n4) sim enriches onApply with discount without changing tariff");
assert(sim.includes("function giSimAttachDiscountToResult"), "discount attach helper");
assert(sim.includes("next.onApply = function(resultsByInsuredId)"), "onApply wrapped once at open");
assert(sim.includes("לא משנה תעריף"), "attach helper documents no tariff mutation");

console.log("\n5) operational report shows before/after + health covers");
assert(wiz.includes("collectHealthCoverPremiumReportRows"), "ops/pdf cover row collector");
assert(wiz.includes("lcOpCoverPremList"), "on-screen ops cover list");
assert(wiz.includes("coverPremiumRows"), "pdf row includes cover premiums");
assert(wiz.includes("פרמיה לפני הנחה"), "pdf detail has before-discount line");

console.log("\n6) compact pledge/beneficiary controls");
assert(wiz.includes("lcNpPledgeSwitch"), "pledge compact switch markup");
assert(wiz.includes('id="lcBenAddBtn"'), "add-beneficiary still bound by id");
assert(theme.includes(".lcNpAddBtn"), "compact add button styles");
assert(theme.includes("max-width:max-content"), "add button is not full-width");

const appCss = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
console.log("\n7) premium pair layout is in loaded app.css (not squeezed to 1 col)");
assert(appCss.includes(".lcNpPremiumPair"), "app.css defines .lcNpPremiumPair");
assert(/\.lcNpPremiumPair\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/.test(appCss), "pair spans full grid row");
assert(/\.lcNpPremiumPair\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/.test(appCss), "before/after sit side by side");
assert(/\.lcNpPremiumPair\s*>\s*\.lcNpDetailField\s*\{[^}]*grid-column:\s*auto/.test(appCss), "inner cards do not inherit span 4");
assert(/\.lcNpPremiumPair\s*>\s*\.lcNpDetailField\s*\{[^}]*overflow:\s*visible/.test(appCss), "inner cards are not clipped");

console.log("\n" + (failed ? "FAILED: " + failed : "OK") + "  passed=" + passed);
process.exit(failed ? 1 : 0);
