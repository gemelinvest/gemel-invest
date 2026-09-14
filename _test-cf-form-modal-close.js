/* GI-PERF 2026-09-14 — original-form editor must leave with the customer file
   and must not block the UI on PDF/persist.
   Run: node _test-cf-form-modal-close.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260914-cf-form-modal-close-v1";
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

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD");

console.log("\n2) closing the customer file dismisses the original-form window");
assert(app.includes("document.body.appendChild(modal)"), "editor is mounted on document.body");
assert(app.includes("_mcDismissFileFormEditorOnFileClose"), "dismiss helper exists");
assert(app.includes("void MirrorCallUI._mcDismissFileFormEditorOnFileClose()"), "CustomersUI.close calls dismiss");
const closeFile = sliceFunction(app, "close(){\n      const closingId = safeTrim(this.currentId || this._openingCustomerId);");
assert(!!closeFile, "customer file close() found");
assert(closeFile.includes("_mcDismissFileFormEditorOnFileClose"), "close path unhooks the editor");

console.log("\n3) save/close hides the window before heavy PDF work");
const saveFn = sliceFunction(app, "async _mcSaveAndCloseFileFormEditor(){");
assert(!!saveFn, "save/close exists");
const flushAt = saveFn.indexOf("this._mcFlushInlineFormEditor(rec)");
const closeAfterFlush = saveFn.indexOf("this._mcCloseFileFormModal()", flushAt);
const materializeAt = saveFn.indexOf("await this._mcMaterializeEditedForms");
const persistAt = saveFn.indexOf("App.persist");
assert(flushAt >= 0 && closeAfterFlush > flushAt, "edits flushed before removing DOM");
assert(closeAfterFlush >= 0 && closeAfterFlush < materializeAt, "modal gone before materialize");
assert(closeAfterFlush >= 0 && closeAfterFlush < persistAt, "modal gone before persist");
assert(saveFn.includes("stillOpen"), "does not refresh the file after it was closed");
assert(saveFn.includes("if(this._mcFileFormSaving){"), "busy save still has a guard");
assert(saveFn.includes("this._mcCloseFileFormModal();"), "stuck window can still be removed");

console.log("\n4) tab switch does not load the wizard on the click turn");
const queueFollowup = sliceFunction(app, "queueFollowupDocumentsSync(rec, opts){");
assert(queueFollowup.includes("scheduleIdle"), "idle scheduler");
assert(!queueFollowup.includes("window.setTimeout(run, 0)"), "no 0ms wizard kick on tab click");
assert(queueFollowup.includes("window.setTimeout(fn, 2200)"), "slow fallback stays delayed");
const switchSection = sliceFunction(app, "switchSection(section){");
assert(switchSection.includes("queueFollowupDocumentsSync(rec)"), "documents tab still syncs followups");
assert(!switchSection.includes("ensureGiWizardJsLoaded"), "tab switch itself does not load wizard");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
