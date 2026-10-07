/* GI-NP-SUM-CHROME 2026-10-07
   כפתור הוסף-פוליסה בסגנון המערכת, טקסט סה״כ גדול יותר,
   בחירת חברה/מוצר גדולה יותר. בלי החלפת BUILD/SIM.
   הרצה: node _test-np-sum-chrome.js
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
const chromeIdx = css.lastIndexOf("GI-NP-SUM-CHROME");
const chrome = chromeIdx >= 0 ? css.slice(chromeIdx) : "";
const renderStart = wiz.indexOf("renderStep5(){");
const renderEnd = wiz.indexOf("renderStep6(ins){", renderStart);
const renderFn = (renderStart >= 0 && renderEnd > renderStart) ? wiz.slice(renderStart, renderEnd) : "";

console.log("1) syntax + BUILD/SIM stay; cache via &giSumChrome=1");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + BUILD + '"'), "BUILD stays");
assert(wiz.includes('GI_WIZARD_BUILD = "' + BUILD + '"'), "wizard BUILD stays");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + SIM_TAG + '"'), "SIM tag stays");
assert(html.includes("&giSumChrome=1"), "index.html busts giSumChrome");
assert(html.includes("&giGrandStick=1&giSumChrome=1"), "css keeps grand-stick and adds sum-chrome");
assert(app.includes("&giSumChrome=1"), "wizard href busts giSumChrome");
assert(sw.includes("sum-chrome-v1"), "service-worker busts sum-chrome");

console.log("\n2) add-policy button matches the gold system CTA");
assert(css.includes("GI-NP-SUM-CHROME"), "chrome marker");
assert(renderFn.includes("lcBtn lcBtn--gold lcNpAddMore"), "add button uses gold system class");
assert(!renderFn.includes("lcBtn--primary lcNpAddMore"), "gray primary class left the add button");
assert(chrome.includes(".lcNpAddMore{"), "add-button last-wins");
assert(chrome.includes("linear-gradient(180deg,#f7e7a3"), "add button is gold, not gray");
assert(chrome.includes("border-radius:999px"), "add button is a pill");
assert(chrome.includes("font-size:15px"), "add button type is readable");

console.log("\n3) grand card type is larger");
assert(chrome.includes(".lcNpGrand__title{ font-size:22px; }"), "grand title 22px");
assert(chrome.includes(".lcNpGrand__kicker{ font-size:13px; }"), "kicker larger");
assert(chrome.includes(".lcNpGrand__count{ font-size:14px;"), "count larger");
assert(chrome.includes(".lcNpGrand__line span{ font-size:14px; }"), "before/after labels larger");
assert(chrome.includes(".lcNpGrand__line strong{ font-size:24px; }"), "before amount larger");
assert(chrome.includes(".lcNpGrand__line--after strong{ font-size:28px; }"), "after amount larger");

console.log("\n4) company/product pickers are larger, scoped to the pick grid");
assert(chrome.includes(".lcNpPickGrid .lcNpCoDd__trigger{"), "picker size is scoped to the pick grid");
assert(chrome.includes("min-height:72px"), "triggers are taller");
assert(chrome.includes("font-size:18px"), "trigger type is 18px");
assert(chrome.includes(".lcNpPickGrid .lcNpCoDd__triggerLabel{ font-size:18px; }"), "label type is 18px");
assert(chrome.includes("gap:22px"), "pickers have more space between them");
assert(chrome.includes(".lcNpPick .lcNpCoDd__item{"), "menu items grow with the pickers");
assert(chrome.includes("padding:14px 14px"), "menu items have more padding");
assert(!chrome.includes("#view-campaignLeads"), "campaign dropdowns are not restyled");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
