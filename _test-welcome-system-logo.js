/* GI-WELCOME-SYSTEM-LOGO 2026-09-19
   אחרי סיסמה: לוגו המערכת, בלי טבעת שנה-טובה, בלי המתנה מלאכותית של 6 שנ׳.
   הרצה: node _test-welcome-system-logo.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260919-welcome-logo-v1";
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

function sliceBetween(src, startToken, endToken){
  const start = src.indexOf(startToken);
  const end = src.indexOf(endToken, start + startToken.length);
  if(start < 0 || end < 0) return "";
  return src.slice(start, end);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const theme = fs.readFileSync(path.join(ROOT, "theme.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const welcomeSrc = sliceBetween(app, "const WelcomeLoader = {", "const ForgotPasswordUI");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-welcome-system-logo.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(html.includes("theme.css?v=" + TAG), "index.html theme.css cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD tag");

console.log("\n2) welcome loader uses the system logo");
assert(!!welcomeSrc, "WelcomeLoader block found");
assert(welcomeSrc.includes('src="./logo-login-clean.png"'), "welcome img src is company logo");
assert(welcomeSrc.includes('alt="GEMEL INVEST"'), "welcome alt is company name");
assert(!welcomeSrc.includes("gi-welcome-shana-tova.png"), "Shana Tova asset left the loader");
assert(!welcomeSrc.includes("lcWelcomeLoader--shanaTova"), "shanaTova layout class is gone");
assert(!html.includes("gi-welcome-shana-tova.png"), "blessing is not in index.html");
assert(html.includes('src="./logo-login-clean.png"'), "login/chrome still use company logo");

console.log("\n3) no filling ring and no fake 6s hold");
assert(!welcomeSrc.includes("startRingFill"), "ring fill loop removed");
assert(!welcomeSrc.includes("lcWelcomeLoader__ringFill"), "ring fill markup removed");
assert(!welcomeSrc.includes("lcWelcomeLoader__ringTrack"), "ring track markup removed");
assert(!welcomeSrc.includes("DISPLAY_MS: 6000"), "6 second display hold is gone");
assert(welcomeSrc.includes("MIN_DISPLAY_MS: 400"), "minimum splash is 400ms");
assert(!welcomeSrc.includes("startStatusCycle"), "status cycling removed");
assert(!welcomeSrc.includes("מאמת הרשאות"), "rotating permission copy removed");
assert(welcomeSrc.includes("טוען מערכת, אנא המתן"), "one real status line stays");
assert(welcomeSrc.includes("getTimeGreeting()"), "greeting still set on open");
assert(app.includes("WelcomeLoader.open("), "open still called after login");
assert(app.includes("WelcomeLoader.close()"), "close still called when boot is ready");

console.log("\n4) CSS — logo, no ring, greeting visible");
assert(theme.includes("GI-WELCOME-SYSTEM-LOGO 2026-09-19"), "theme build marker");
assert(theme.includes(".lcWelcomeLoader__ringFill:not(#\\9):not(#\\9)") && theme.includes("display: none !important"), "theme hides leftover ring");
assert(!/width:\s*min\(640px/.test(theme) || !theme.includes("GI-WELCOME-SYSTEM-LOGO"), "holiday ring size left the system-logo block");
{
  const block = sliceBetween(theme, "GI-WELCOME-SYSTEM-LOGO 2026-09-19", "GI-LEADS-TRACK-CARDS");
  assert(!!block, "theme welcome block found");
  assert(block.includes("display: none !important") && block.includes("ringFill"), "ring fill hidden in welcome block");
  assert(!block.includes("min(640px"), "640px holiday mark is gone");
  assert(block.includes(".lcWelcomeLoader__greeting") && block.includes("display: block !important"), "greeting is visible");
  assert(block.includes(".lcWelcomeLoader__name") && block.includes("display: block !important"), "name is visible");
}

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK  " + passed + " assertions");
