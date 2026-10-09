/* GI-GOAL-MIX + login display.
   עוגות ליד ביצועים מול יעד, וסידור מסך הכניסה. בלי חישוב פרמיה.
   הרצה: node _test-dash-goal-mix-login.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
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

console.log("\n2) one product pie sits under service; the goal stays full width");
assert(app.includes("GI-GOAL-MIX"), "mix marker stays");
assert(app.includes("renderGoalMixHtml(metrics)"), "mix renderer is called with the same metrics");
assert(app.includes("metrics?.netProductTotals"), "product slices come from netProductTotals");
assert(app.includes("חלוקה לפי מוצר"), "pie title is product only");
assert(app.includes("אין מכירות החודש"), "empty month copy stays");
assert(!app.includes("bankDash__goalSplit"), "goal is no longer split beside the pies");
assert(!theme.includes("bankDash__goalSplit"), "split layout is gone from the theme");
const elevAt = app.lastIndexOf('class="bankDash__elevatedCol"');
const mixAt = app.indexOf("${this.renderGoalMixHtml(metrics)}", elevAt);
const serviceAt = app.lastIndexOf("${serviceCubeHtml}");
const goalAt = app.lastIndexOf("${goalPanelHtml}");
assert(elevAt > 0 && serviceAt > elevAt && mixAt > serviceAt && mixAt < elevAt + 400, "product pie is under the service cube");
assert(goalAt > mixAt, "goal card is back in its own full-width row");
const mixFn = app.slice(app.indexOf("renderGoalMixHtml(metrics){"), app.indexOf("_goalPieShade("));
assert(mixFn.includes("netProductTotals") && !mixFn.includes("netCompanyBreakdown"), "company pie is not built");
assert(app.includes("wizardSaleAfterDiscount(p)"), "sale premium helper unchanged");
assert(theme.includes("GI-GOAL-MIX"), "pie layout is in the dashboard theme");
assert(theme.includes(".bankDash__elevatedCol .bankGoalMix"), "pie uses the service column width");
assert(theme.includes("#view-dashboard .bankGoal:not(#\\9):not(#\\9)") && /#view-dashboard \.bankGoal:not\(#\\9\):not\(#\\9\)\{[^}]*width: 100% !important;/.test(theme.replace(/\s+/g, " ")), "goal card still fills its cell");

function extractObjectMethod(src, methodName){
  const needle = "\n    " + methodName + "(";
  const start = src.indexOf(needle);
  if(start < 0) return "";
  const brace = src.indexOf("{", start);
  if(brace < 0) return "";
  let depth = 0;
  for(let i = brace; i < src.length; i += 1){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1).trim();
    }
  }
  return "";
}
const shadeFn = extractObjectMethod(app, "_goalPieShade");
const pieFn = extractObjectMethod(app, "_goalPieHtml");
const mixRenderFn = extractObjectMethod(app, "renderGoalMixHtml");
assert(!!shadeFn && !!pieFn && !!mixRenderFn, "pie helpers extract");
const pieSandbox = {
  escapeHtml(v){ return String(v == null ? "" : v); },
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  formatMoney(value){
    const n = Number(value) || 0;
    return "₪" + n.toLocaleString("he-IL", { maximumFractionDigits: 0 });
  },
  formatPct(value){
    const n = Number(value) || 0;
    return n.toLocaleString("he-IL", { maximumFractionDigits: 1 }) + "%";
  }
};
vm.runInNewContext(
  "this._goalPieShade = function" + shadeFn.slice("_goalPieShade".length) + ";\n" +
  "this._goalPieHtml = function" + pieFn.slice("_goalPieHtml".length) + ";\n" +
  "this.renderGoalMixHtml = function" + mixRenderFn.slice("renderGoalMixHtml".length) + ";",
  pieSandbox
);
const pieHtml = pieSandbox.renderGoalMixHtml({
  netProductTotals: { "ריסק": 1200, "בריאות": 800 },
  netCompanyBreakdown: [{ label: "מגדל", premium: 9999 }]
});
assert(pieHtml.includes("חלוקה לפי מוצר"), "rendered pie title");
assert(pieHtml.includes("ריסק") && pieHtml.includes("בריאות"), "product names stay on the card");
assert(pieHtml.includes("1,200") || pieHtml.includes("1200"), "product amount is the saved total");
assert(!pieHtml.includes("מגדל") && !pieHtml.includes("9999") && !pieHtml.includes("לפי חברה"), "company breakdown is not drawn");
assert(pieHtml.includes("<svg"), "pie is drawn, not a flat pair of wheels");
const emptyPie = pieSandbox.renderGoalMixHtml({ netProductTotals: {} });
assert(emptyPie.includes("אין מכירות החודש") && !emptyPie.includes("<svg"), "empty month has no invented slices");

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
