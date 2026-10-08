/* GI-FLOOR-POP 2026-10-08
   «פעילות נציג» נפתח בחלון דפדפן נפרד: נגרר, מזער/סגור משלו,
   נשאר פתוח כשממזערים את חלון המערכת. בלי החלפת BUILD/SIM.
   הרצה: node _test-agent-floor-popout.js
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
function sliceBetween(src, startToken, endToken){
  const start = src.indexOf(startToken);
  const end = src.indexOf(endToken, start + startToken.length);
  if(start < 0 || end < 0) return "";
  return src.slice(start, end);
}

const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");
const css = read("app.css");
const floorUi = sliceBetween(app, "const AgentFloorActivityUI = {", "const __chatOriginalGoView");
const goView = sliceBetween(app, "goView(view, options = {}){", "initSettingsRubrics(){");

console.log("1) syntax + BUILD/SIM stay; cache via &giFloorPop=1");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(app.includes('const BUILD = "' + BUILD + '"'), "BUILD stays");
assert(app.includes('GI_SIMULATOR_JS_HREF = "./gi-simulators.js?v=' + SIM_TAG + '"'), "SIM tag stays");
assert(html.includes("&giFloorPop=1"), "index.html busts giFloorPop");
assert(html.includes("&giGrandCrm=1&giFloorPop=1"), "keeps grand-crm and adds floor-pop");
assert(sw.includes("floor-pop-v1"), "service-worker busts floor-pop");
assert(sw.includes(BUILD), "SW still has BUILD");

console.log("\n2) sales activity opens a real popup window");
assert(floorUi.includes("openWindow(){"), "openWindow helper");
assert(floorUi.includes('window.open("", "giSalesAgentFloor"'), "named popup giSalesAgentFloor");
assert(floorUi.includes("popup=yes"), "popup feature flag");
assert(floorUi.includes("giSalesFloorMin"), "minimize control");
assert(floorUi.includes("giSalesFloorClose"), "close control");
assert(floorUi.includes("<strong>פעילות נציג</strong>"), "window title bar");
assert(floorUi.includes("toggleWindowMin(){"), "minimize resizes the popup");
assert(floorUi.includes("win.resizeTo(520, 100)"), "minimized size is a title strip");
assert(floorUi.includes("closeWindow(){"), "close helper");
assert(css.includes("GI-FLOOR-POP"), "css marker");
assert(css.includes("#giSalesFloorBar"), "title-bar styles");

console.log("\n3) click does not replace the sales/system view");
assert(goView.includes('if(safe === "agentActivity")'), "goView intercepts agentActivity");
assert(goView.includes("AgentFloorActivityUI.openWindow()"), "goView opens the popup");
assert(/if\(safe === "agentActivity"\)\{[\s\S]{0,280}return;/.test(goView), "goView returns without switching the main view");
assert(app.includes('on(activityBtn, "click", () => { try { UI.goView("agentActivity")'), "sales button still goes through goView");
assert(floorUi.includes("isWindowOpen()"), "active = popup open");
assert(floorUi.includes("return this.isWindowOpen()"), "isActive follows the popup");
assert(!floorUi.includes('classList.contains("is-visible")'), "no longer tied to the in-page view");

console.log("\n4) window stays live while the main app is used; logout closes it");
assert(!app.includes('if(prev === "agentActivity" && now !== "agentActivity") AgentFloorActivityUI.deactivate()'), "navigating the CRM does not kill the popup");
assert(app.includes("AgentFloorActivityUI.closeWindow()"), "logout closes the popup");
assert(floorUi.includes("bindOpenerHide()"), "closing the system tab closes the popup");
assert(floorUi.includes("pagehide"), "pagehide cleanup");
assert(floorUi.includes("hostDoc()"), "render targets the popup document");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
