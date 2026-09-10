/* GI-PERF 2026-09-10 — פתיחת תיק לא טוענת את האשף, טאבים לא מוחקים DOM, רענון חי לא חוסם.
   Run: node _test-customer-open-freeze.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260910-cf-open-paint-v1";
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

function sliceFunction(src, startToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  let i = startToken.endsWith("{")
    ? start + startToken.length - 1
    : src.indexOf("{", start);
  if(i < 0) return "";
  let depth = 0;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");

console.log("1) syntax + cache tags aligned");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD tag");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "GI_WIZARD_JS_VERSION aligned");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard BUILD aligned");

console.log("\n2) file open does not kick off gi-wizard.js");
const closeChrome = sliceFunction(app, "_closeWizardChromeForFileOpen(){");
assert(closeChrome.includes("giWizardIsInstalled"), "checks whether wizard chunk is already installed");
assert(closeChrome.includes("Wizard.isOpen"), "still closes a really-open wizard");
assert(closeChrome.includes("if(!chunkReady) return"), "skips wrappers when chunk is not ready");
assert(closeChrome.includes("hideFinishFlow"), "still hides finish flow when chunk is ready");
const openResolved = sliceFunction(app, "_openByIdResolved(rec, opts={}){");
assert(openResolved.includes("this._closeWizardChromeForFileOpen()"), "open path uses the guarded closer");
assert(!openResolved.includes("Wizard?.hideFinishFlow?.()"), "open path no longer calls hideFinishFlow directly");
assert(!openResolved.includes("Wizard?.closeHealthFindingsModal?.()"), "open path no longer calls closeHealthFindingsModal directly");
assert(app.includes('["open","openDraft"') || app.includes('"hideFinishFlow","closeHealthFindingsModal"'), "wizard wrappers unchanged");

console.log("\n3) tab switch keeps painted panes");
const switchFn = sliceFunction(app, "switchSection(section){");
assert(switchFn.includes("paintSectionPane(rec, policies)"), "tab switch paints via pane helper");
assert(!switchFn.includes("this.els.main.innerHTML = this.renderSectionContent"), "tab switch does not wipe #customerFullMain");
assert(switchFn.includes('if(next === "documents") this.queueFollowupDocumentsSync(rec)'), "followup sync only on documents tab");
assert(!switchFn.replace('if(next === "documents") this.queueFollowupDocumentsSync(rec)', "").includes("queueFollowupDocumentsSync"), "followup not queued on every tab");
assert(app.includes('data-cf-pane='), "section panes are created in the file main");
assert(app.includes("paintSectionPane(rec, policies"), "pane painter exists");
assert(app.includes("invalidateSectionPanes()"), "full file view still can rebuild panes");
assert(css.includes(".cfFile__pane[hidden]"), "hidden panes are not displayed");
assert(css.includes(".cfFile__main.is-cf-documents"), "documents layout class is scoped to the active tab");

console.log("\n4) live refresh no longer paints the file synchronously");
assert(openResolved.includes("if(opts.syncOpen === true"), "syncOpen still paints immediately");
assert(openResolved.includes("if(!opts.skipSig)"), "skipSig no longer forces sync paint");
assert(openResolved.includes("requestAnimationFrame(() => requestAnimationFrame(() =>"), "open still defers heavy paint with double rAF");
assert(openResolved.includes("HeavySyncGate.markInteraction"), "live refresh marks interaction so sync waits");

console.log("\n5) login / wizard load-accept-drift / CRM save untouched");
assert(app.includes("giWizardChunkLooksInstallable"), "wizard tag-drift accept stays");
assert(app.includes("function giWizardChunkLooksInstallable(text){"), "drift helper intact");
assert(app.includes("__giWizardCall"), "wizard call wrapper intact");
assert(app.includes("function persistLastSessionUserKey"), "login session helper stays");
assert(app.includes("saveVersionUpdateResume"), "version-update resume stays");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\n-----");
console.log("passed=" + passed + " failed=" + failed);
process.exit(0);
