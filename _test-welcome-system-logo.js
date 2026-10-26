/* GI-WELCOME-ONYX 2026-10-26
   אחרי כניסה: לוגו ONYX נבנה 4 שניות על מסך לבן, והסשן נטען לפני שהמסך נחשף.
   הרצה: node _test-welcome-system-logo.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261007-lead-dup-v1";
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

console.log("\n2) welcome loader assembles the ONYX logo");
assert(!!welcomeSrc, "WelcomeLoader block found");
assert(!welcomeSrc.includes('src="./logo-login-clean.png"'), "welcome splash no longer uses the login logo");
assert(!welcomeSrc.includes('alt="GEMEL INVEST"'), "welcome splash no longer names the old logo");
assert(welcomeSrc.includes('src="./assets/onyx-splash/mark.png"'), "big O mark is first");
assert(welcomeSrc.includes("onyxSplash__cell--o"), "letter O is its own layer");
assert(welcomeSrc.includes("onyxSplash__cell--n"), "letter N is its own layer");
assert(welcomeSrc.includes("onyxSplash__cell--y"), "letter Y is its own layer");
assert(welcomeSrc.includes("onyxSplash__cell--x"), "letter X is its own layer");
assert(welcomeSrc.includes("onyxSplash__cell--c"), "CRM C is its own layer");
assert(welcomeSrc.includes("onyxSplash__cell--r"), "CRM R is its own layer");
assert(welcomeSrc.includes("onyxSplash__cell--m"), "CRM M is its own layer");
assert(welcomeSrc.indexOf("onyxSplash__mark") < welcomeSrc.indexOf("onyxSplash__word"), "mark is above the word");
assert(welcomeSrc.indexOf("onyxSplash__word") < welcomeSrc.indexOf("onyxSplash__crm"), "word is above CRM");
assert(!welcomeSrc.includes('id="lcWelcomeGreeting"'), "greeting left the splash");
assert(!welcomeSrc.includes("טוען מערכת, אנא המתן"), "please-wait line left the splash");
assert(!welcomeSrc.includes("gi-welcome-shana-tova.png"), "Shana Tova asset left the loader");
assert(!welcomeSrc.includes("lcWelcomeLoader--shanaTova"), "shanaTova layout class is gone");
assert(!html.includes("gi-welcome-shana-tova.png"), "blessing is not in index.html");
assert(html.includes('src="./logo-login-clean.png"'), "login/chrome still use company logo");
assert(html.includes("giOnyxSplash=1"), "splash cache flag is on the page");
assert(fs.existsSync(path.join(ROOT, "assets/onyx-splash/mark.png")), "mark asset exists");
assert(fs.existsSync(path.join(ROOT, "assets/onyx-splash/x.png")), "X asset exists");

console.log("\n3) logo stays 4s while the session loads");
assert(!welcomeSrc.includes("startRingFill"), "ring fill loop removed");
assert(!welcomeSrc.includes("lcWelcomeLoader__ringFill"), "ring fill markup removed");
assert(!welcomeSrc.includes("lcWelcomeLoader__ringTrack"), "ring track markup removed");
assert(welcomeSrc.includes("MIN_DISPLAY_MS: 4000"), "splash holds for 4 seconds");
assert(welcomeSrc.includes("waitMin()"), "splash wait is awaitable");
assert(!welcomeSrc.includes("startStatusCycle"), "status cycling removed");
assert(!welcomeSrc.includes("מאמת הרשאות"), "rotating permission copy removed");
assert(welcomeSrc.includes('id="lcWelcomeStatus"'), "screen-reader status stays");
assert(welcomeSrc.includes("getTimeGreeting()"), "greeting setter still harmless if an element exists");
assert(app.includes("WelcomeLoader.open("), "open still called after login");
{
  const loginFn = sliceBetween(app, "const completeAgentLogin = async", "const enterFromFaceSession");
  assert(!!loginFn, "completeAgentLogin found");
  assert(loginFn.includes("WelcomeLoader.waitMin()"), "login waits out the splash");
  assert(loginFn.includes("App.runPostLoginPipeline"), "login loads the session under the splash");
  assert(loginFn.indexOf("WelcomeLoader.waitMin()") < loginFn.indexOf("WelcomeLoader.close(true)"), "splash closes after the wait");
  assert(loginFn.indexOf("runPostLoginPipeline") < loginFn.indexOf("WelcomeLoader.close(true)"), "session load starts before the splash closes");
  assert(loginFn.includes("options.quietResume !== true"), "version-update resume does not take the hold");
  assert(loginFn.includes("void pipelinePromise"), "quiet resume still loads in the background");
}
{
  const facePaint = sliceBetween(app, "paintDashboardAfterFaceLogin(){", "revealKpiMetricValues");
  assert(!!facePaint, "face dashboard paint found");
  assert(!facePaint.includes("WelcomeLoader"), "face dashboard paint does not dismiss the splash");
}
assert(app.includes("await Promise.all([\n            App.reloadSessionState(),\n            WelcomeLoader.waitMin()\n          ])"), "admin login holds the logo while settings load");

console.log("\n4) CSS — white field, ONYX motion, greeting hidden");
assert(theme.includes("GI-WELCOME-SYSTEM-LOGO 2026-09-19"), "theme build marker");
assert(theme.includes(".lcWelcomeLoader__ringFill:not(#\\9):not(#\\9)") && theme.includes("display: none !important"), "theme hides leftover ring");
assert(!/width:\s*min\(640px/.test(theme) || !theme.includes("GI-WELCOME-SYSTEM-LOGO"), "holiday ring size left the system-logo block");
{
  const block = sliceBetween(theme, "GI-WELCOME-SYSTEM-LOGO 2026-09-19", "GI-LEADS-TRACK-CARDS");
  assert(!!block, "theme welcome block found");
  assert(block.includes("display: none !important") && block.includes("ringFill"), "ring fill hidden in welcome block");
  assert(!block.includes("min(640px"), "640px holiday mark is gone");
  assert(block.includes(".lcWelcomeLoader__greeting") && block.includes("display: none !important"), "greeting is hidden");
  assert(block.includes(".lcWelcomeLoader__name") && block.includes("display: none !important"), "name is hidden");
  assert(block.includes("#ffffff"), "splash field stays white");
  assert(block.includes("onyxRise"), "letters rise");
  assert(block.includes("onyxRule"), "CRM rules draw");
  assert(block.includes("prefers-reduced-motion"), "reduced motion keeps the finished logo");
  assert(block.includes(".95s") && block.includes("1.23s") && block.includes("1.51s") && block.includes("1.79s"), "ONYX letters are staggered");
  assert(block.includes("2.55s") && block.includes("2.78s") && block.includes("3.01s"), "CRM letters follow the word");
}

const bodyMatch = welcomeSrc.match(/waitMin\(\)\{([\s\S]*?)\n    \},/);
assert(!!bodyMatch, "waitMin body extracted");
if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}

const sandbox = { window: { setTimeout }, result: null };
vm.createContext(sandbox);
vm.runInContext(
  "const loader = { _openedAt: 0, MIN_DISPLAY_MS: 4000, waitMin(){" + bodyMatch[1] + "\n} };\n" +
  "loader._openedAt = Date.now();\n" +
  "result = loader.waitMin();\n",
  sandbox
);
const started = Date.now();
sandbox.result.then(() => {
  const elapsed = Date.now() - started;
  assert(elapsed >= 3900 && elapsed < 4700, "waitMin holds about 4 seconds (" + elapsed + "ms)");
  if(failed){
    console.error("\nFAILED " + failed + " / passed " + passed);
    process.exit(1);
  }
  console.log("\nOK  " + passed + " assertions");
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
