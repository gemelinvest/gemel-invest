/* GI-WIZARD 2026-09-01 — תחנת חיתום שלב 4: עיצוב בלבד, בלי שינוי לוגיקה.
   הרצה: node _test-step4-uw-desk.js
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
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) desk markup + existing selectors");
assert(wiz.includes('id="lcNpDesk"'), "desk root exists");
assert(wiz.includes("data-np-desk-tab"), "insured tabs for view switch");
assert(wiz.includes('id="lcNpCoDdTrigger"'), "company dropdown id unchanged");
assert(wiz.includes("data-nptype"), "product buttons unchanged");
assert(wiz.includes("data-np-insured"), "insured include still uses data-np-insured");
assert(wiz.includes('data-addpol="1"'), "add-policy button unchanged");
assert(wiz.includes('id="lcBenAddBtn"'), "add-beneficiary id unchanged");
assert(wiz.includes("data-open-risk-sim"), "simulator open hook unchanged");
assert(wiz.includes("data-pdraft-per-insured-premium-before"), "before-discount field unchanged");
assert(wiz.includes("data-pdraft-per-insured-premium="), "after-discount field unchanged");

console.log("\n3) simulator uses proposal insureds; apply does not change tariff");
assert(wiz.includes("getProposalInsuredsForSimulator"), "proposal-insured helper");
assert(!wiz.includes("בחרו מבוטח/ים בשלב 3 לפני פתיחת הסימולטור"), "no longer gated on accordion step 3 copy");
assert(wiz.includes("draft.riskSimQuotes[insId] = Object.assign({}, r, {"), "apply still stores quotes the same way");
assert(wiz.includes("formatAppliedPremiumValue"), "premium apply helper unchanged");

console.log("\n4) health cover table + ops table keep the same draft attrs");
assert(wiz.includes("lcNpCoverSheet"), "health cover sheet");
assert(wiz.includes("data-pdraft-cover-premium-before"), "cover before attr");
assert(wiz.includes("data-pdraft-cover-premium-after"), "cover after attr");
assert(wiz.includes("lcOpCoverSheet"), "ops report cover table");
assert(wiz.includes("collectHealthCoverPremiumReportRows"), "ops collector unchanged");

console.log("\n5) validation contract unchanged");
assert(wiz.includes('miss("פרמיה חודשית לאחר הנחה"'), "after-discount still required");
assert(!/miss\(\s*["']פרמיה לפני הנחה/.test(wiz), "before-discount still optional");
assert(wiz.includes('miss("חברת ביטוח"'), "company required");
assert(wiz.includes('miss("מוצר ביטוח"'), "product required");

console.log("\n6) css + cache");
assert(css.includes(".lcNpDesk{") || css.includes(".lcNpDesk {") || css.includes(".lcNpDesk{\n") || css.includes(".lcNpDesk{\r") || css.includes(".lcNpDesk{"), "desk styles in app.css");
assert(css.includes(".lcNpCoverSheet"), "cover sheet styles");
assert(app.includes('GI_WIZARD_JS_VERSION = "20260901-step4-desk-v1"'), "wizard cache bump");

console.log("\n" + (failed ? "FAILED: " + failed : "OK") + "  passed=" + passed);
process.exit(failed ? 1 : 0);
