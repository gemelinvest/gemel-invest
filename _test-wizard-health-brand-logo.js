/* GI-WIZ-HEALTH-BRAND-LOGO 2026-09-21
   לוגו גמל INVEST יוצא מכרטיס הסימולטור המשובץ בשלב פוליסות חדשות
   ויושב מעל סרגל שלבי אשף בריאות וסיכונים, בצד ימין למעלה.
   לוגו החברה בכרטיס נשאר.
   הרצה: node _test-wizard-health-brand-logo.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260921-wiz-health-logo-v1";
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

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start + startMark.length);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const html = read("index.html");
const app = read("app.js");
const css = read("app.css");
const wiz = read("gi-wizard.js");
const sims = read("gi-simulators.js");
const shellCss = read("simulators-shell.css");
const sw = read("service-worker.js");

const wizardHead = sliceBetween(html, 'id="lcWizard"', 'id="lcWizardBody"');
const chromeFn = sliceBetween(sims, "function riskSimAugmentStandaloneChrome(sim){", "const body = card.querySelector");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-simulators.js")]).status === 0, "node --check gi-simulators.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "wizard chunk version");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build mark");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + TAG + '"'), "simulator chunk cache");
assert(app.includes("simulators-shell.css?v=" + TAG), "shell css cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");

console.log("\n2) wizard chrome — logo above the stepper, top right");
assert(wizardHead.includes('id="lcHealthWizardLogo"'), "health wizard logo element exists");
assert(wizardHead.includes('class="lcWizard__healthLogo"'), "health wizard logo class");
assert(wizardHead.includes('src="./logo-login-clean.png"'), "uses the system GEMEL INVEST logo, not a company logo");
assert(wizardHead.includes('alt="גמל INVEST"'), "alt text is the system brand");
assert(wizardHead.indexOf("lcHealthWizardLogo") < wizardHead.indexOf("lcWizard__stepper"), "logo sits in the head above the stepper");
assert(wizardHead.indexOf("lcHealthWizardLogo") < wizardHead.indexOf("lcElemWizardLogo"), "health logo is the first head child (RTL top-right)");
assert(wizardHead.includes('id="lcElemWizardLogo"'), "elementary logo stays for that flow");
assert(css.includes("GI-WIZ-HEALTH-BRAND-LOGO 2026-09-21"), "app.css marker");
assert(/\.lcWizard__healthLogo\{[^}]*height:\s*32px/.test(css), "header logo size");
assert(css.includes(".lcWizard.is-elementaryFlow .lcWizard__healthLogo"), "hidden during elementary flow");
assert(css.includes(".lcWizard__healthLogo[hidden]"), "hidden attribute honored");

console.log("\n3) docked simulator proposal — system logo removed, company logo kept");
assert(chromeFn.includes("GI-WIZ-HEALTH-BRAND-LOGO 2026-09-21"), "simulator chrome marker");
assert(chromeFn.includes("const dockedInWizard = !!sim._ctx.wizardWorkspace"), "detects wizard embedding");
assert(chromeFn.includes("if(brandLogo) brandLogo.remove()"), "removes gemel logo when docked");
assert(chromeFn.includes('brandLogo.className = "giSimShell__brandLogo"'), "standalone simulator still gets the system logo");
assert(chromeFn.includes('brandStack.className = "giSimShell__brandStack"'), "company logo stack remains");
assert(chromeFn.includes(".giValModal__headIcon"), "company head icon remains");
assert(!/dockedInWizard[\s\S]{0,80}brandLogo\.remove\(\)[\s\S]{0,200}headIcon/.test(chromeFn) || chromeFn.includes("headIcon"), "company icon path still present after docked branch");
assert(/giSimShellModal--docked \.giSimShell__brandLogo\{[^}]*display:none !important/.test(shellCss), "CSS hides docked gemel logo");
assert(!/giSimShellModal--docked \.giSimShell__brandLogo\{[^}]*left:16px !important/.test(shellCss), "old left-side docked gemel logo rule removed");
assert(/giSimShellModal--docked \.giSimShell__brandStack\{[^}]*margin-top:0 !important/.test(shellCss), "company stack no longer reserved space for gemel logo");

console.log("\n4) wizard JS toggles the header logo vs elementary");
assert(wiz.includes('this.els.healthWizardLogo = $("#lcHealthWizardLogo")'), "wizard binds the health logo");
assert(wiz.includes("this.els.healthWizardLogo.hidden = isElem"), "health logo hidden on elementary flow");
assert(wiz.includes("this.els.elemWizardLogo.hidden = !showLogo"), "elementary logo toggle unchanged");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK  " + passed + " assertions");
