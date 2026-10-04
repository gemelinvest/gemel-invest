/* מסך שיחת שיקוף לא מתרוקן אחרי שמירה / רענון / ציור שלב שנכשל.
   הרצה: node _test-mirror-blank-screen.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261002-360-sums-health-v1";
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

function extractNamed(src, name, from){
  const needle = "\n    " + name + "(";
  const start = src.indexOf(needle, from || 0);
  if(start < 0) return "";
  const paren = src.indexOf("(", start);
  let parenDepth = 0;
  let i = paren;
  for(; i < src.length; i += 1){
    if(src[i] === "(") parenDepth += 1;
    else if(src[i] === ")"){
      parenDepth -= 1;
      if(parenDepth === 0){ i += 1; break; }
    }
  }
  const brace = src.indexOf("{", i);
  let depth = 0;
  for(let j = brace; j < src.length; j += 1){
    if(src[j] === "{") depth += 1;
    else if(src[j] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, j + 1).trim();
    }
  }
  return "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const liveAt = app.indexOf("_mcRefreshMirrorShellEls(){");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG + "&giSign=24"), "index cache bump");
assert(liveAt > 0 && app.includes("_mcMirrorScreenIsLive") && app.includes("_mcKeepLiveMirrorScreen"), "שומרים את מסך השיחה החיה");

console.log("\n2) render לא מחזיר לחיפוש בשיחה פעילה");
const renderFn = extractNamed(app, "render", liveAt);
assert(renderFn.includes("_mcMirrorScreenIsLive") && renderFn.includes("_mcKeepLiveMirrorScreen") && renderFn.includes('showScreen("search")'), "render שומר שיחה חיה ורק אחרת חוזר לחיפוש");
assert(app.includes("if(typeof MirrorCallUI._mcMirrorScreenIsLive === \"function\" && MirrorCallUI._mcMirrorScreenIsLive())") && app.includes("MirrorCallUI._mcKeepLiveMirrorScreen()"), "מעבר מסך ורענון לא מאפסים שיחה חיה");
assert(app.includes('UI.goView("mirrorCall", { syncRender: true })'), "פתיחת שיקוף מלקוח מסונכרנת בלי מרוץ מול render");

console.log("\n3) ציור שלב שנכשל לא משאיר פאנלים מוסתרים");
const restoreFn = extractNamed(app, "_restoreMirrorPhaseUi", liveAt);
assert(restoreFn.includes("try") && restoreFn.includes("MC_RESTORE_PHASE") && restoreFn.includes("_renderOpeningScript"), "כשל בציור מחזיר את נוסח הפתיחה ולא מסך ריק");
assert(restoreFn.includes('p === "mirrorSummaryReport"'), "דוח הסיכום חוזר אחרי רענון");
const chromeFn = extractNamed(app, "_syncFlowChrome", liveAt);
assert(chromeFn.includes("_mcRestoringPhase") && chromeFn.includes("_restoreMirrorPhaseUi"), "דוק ריק בשיחה חיה משחזר את השלב");
const showFn = extractNamed(app, "showScreen", liveAt);
assert(showFn.includes("_mcRefreshMirrorShellEls") && showFn.includes("if(this._callRunning) return") && showFn.includes("removeAttribute(\"hidden\")"), "showScreen מרענן DOM ולא גונב פוקוס משיחה חיה");

console.log("\n4) runtime: render על שיחה חיה לא מוחק לקוח");
const liveIs = extractNamed(app, "_mcMirrorScreenIsLive", liveAt);
const liveRender = extractNamed(app, "render", liveAt);
const sandbox = {
  document: {
    getElementById(){ return { classList: { contains: () => true } }; }
  }
};
const ui = vm.runInNewContext(`
  const safeTrim = (v) => String(v == null ? "" : v).trim();
  const ui = {
    _callRunning: true,
    _callPaused: false,
    _mirrorUiPhase: "step2",
    selectedCustomer: { id: "c1", fullName: "דנה" },
    els: { workstation: { classList: { contains: () => true } }, selectBtn: {}, searchInput: {} },
    searchCalls: 0,
    keepCalls: 0,
    ${liveIs},
    _mcKeepLiveMirrorScreen(){ this.keepCalls += 1; },
    showScreen(){ this.wentSearch = true; },
    _syncOpsAgentSearchScope(){},
    _resetMirrorFlowUi(){ this.resetFlow = true; },
    search(){ this.searchCalls += 1; },
    ${liveRender}
  };
  ui.render();
  ui;
`, sandbox);
assert(ui.keepCalls === 1 && ui.searchCalls === 0 && ui.selectedCustomer && ui.selectedCustomer.id === "c1" && !ui.resetFlow, "שיחה חיה נשמרת ב-render");
ui._callRunning = false;
ui._callPaused = false;
ui._mirrorUiPhase = "idle";
ui.selectedCustomer = null;
ui.els.workstation.classList.contains = () => false;
sandbox.document.getElementById = () => ({ classList: { contains: () => false } });
ui.render();
assert(ui.searchCalls === 1 && ui.resetFlow === true, "מסך חיפוש עדיין נפתח כשאין שיחה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (failed + passed));
  process.exit(1);
}
console.log("\nOK " + passed);
