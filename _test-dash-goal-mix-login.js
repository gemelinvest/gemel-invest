/* GI-GOAL-MIX + login display.
   עוגות ליד ביצועים מול יעד, וסידור מסך הכניסה. בלי חישוב פרמיה.
   הרצה: node _test-dash-goal-mix-login.js
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const theme = fs.readFileSync(path.join(ROOT, "theme.css"), "utf8");
const loginCss = fs.readFileSync(path.join(ROOT, "login-split.css"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) pies sit left of the goal and reuse existing totals");
assert(app.includes("GI-GOAL-MIX"), "mix marker stays");
assert(app.includes("renderGoalMixHtml(metrics)"), "mix renderer is called with the same metrics");
assert(app.includes("metrics?.netProductTotals"), "product slices come from netProductTotals");
assert(app.includes("metrics?.netCompanyBreakdown"), "company slices come from netCompanyBreakdown");
assert(app.includes('לפי מוצר') && app.includes('לפי חברה'), "both pie titles stay");
assert(app.includes("אין מכירות החודש"), "empty month copy stays");
assert(app.includes("bankDash__goalSplit"), "goal and pies share a row");
const splitAt = app.indexOf("bankDash__goalSplit");
const goalAt = app.indexOf("${goalPanelHtml}", splitAt);
const mixAt = app.indexOf("renderGoalMixHtml(metrics)", splitAt);
assert(splitAt > 0 && goalAt > splitAt && mixAt > goalAt, "goal stays first, pies second in the split");
assert(app.includes("wizardSaleAfterDiscount(p)"), "sale premium helper unchanged");
assert(theme.includes("GI-GOAL-MIX"), "split layout is in the dashboard theme");
assert(theme.includes("#view-dashboard .bankGoal:not(#\\9):not(#\\9)") && /#view-dashboard \.bankGoal:not\(#\\9\):not\(#\\9\)\{[^}]*width: 100% !important;/.test(theme.replace(/\s+/g, " ")), "goal card still fills its cell");

console.log("\n3) login copy and placement");
const hintAt = html.indexOf('<div class="lcLogin__hint">הזן שם משתמש וקוד כניסה</div>');
const userAt = html.indexOf('id="lcLoginUser"');
const orAt = html.indexOf('id="lcLoginOrFace"');
const forgotAt = html.indexOf('id="lcForgotPasswordBtn"');
const secureAt = html.indexOf("כניסה מאובטחת");
assert(hintAt > orAt && hintAt < userAt, "hint sits above the username field");
assert(secureAt > forgotAt, "secure note sits below forgot password");
assert(html.includes("כניסה באמצעות זיהוי פנים"), "face button uses the new wording");
assert(!html.includes("היכנס באמצעות זיהוי פנים"), "old face wording is gone");
assert(html.includes('class="lcLogin__visualLogo" src="./logo-login-clean.png"'), "cyan panel uses the original logo");
assert(!html.includes("logo-login-tagline.png"), "cropped tagline logo is off the login panel");
assert(loginCss.includes("text-align:right !important") && loginCss.includes("font-size:17px !important"), "hint is right-aligned and larger");
assert(loginCss.includes("order:7 !important"), "secure note stays under the forgot link");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
