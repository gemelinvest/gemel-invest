/* GI-OPS 2026-09-14 — original-form editor lives inside the customer file.
   Run: node _test-cf-form-editor-in-file.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260915-reminder-vol-v1";
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
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD");

console.log("\n2) editor is hosted inside #customerFull, not behind it on body");
const hostFn = sliceFunction(app, "_mcFileFormHostEl(){");
assert(!!hostFn, "host helper exists");
assert(hostFn.includes('getElementById("customerFull")'), "host is the customer file");
assert(hostFn.includes('classList.contains("is-open")'), "only mounts while the file is open");
const ensureFn = sliceFunction(app, "_mcEnsureFileFormModal(){");
assert(!!ensureFn, "ensure helper exists");
assert(ensureFn.includes("host.appendChild(modal)"), "modal is appended to the file host");
assert(!ensureFn.includes("document.body.appendChild(modal)"), "file editor is not mounted on document.body");
assert(css.includes("#customerFull .mcFileFormModal.giValModal"), "file-scoped overlay CSS");
assert(css.includes("position: absolute"), "overlay is positioned inside the file stacking context");
const cssBlock = css.slice(css.indexOf("#customerFull .mcFileFormModal.giValModal"), css.indexOf(".mcFileFormModal .mcFileFormModal__card"));
assert(cssBlock.includes("z-index: 40"), "overlay sits above file content");
assert(!css.includes(".mcFileFormModal.giValModal{\n  z-index: 80;"), "removed z-index 80 behind the file");
assert(css.includes(".customerFull{\n  position: fixed;\n  inset: 0;\n  z-index: 130;"), "customer file stacking context stays 130");

console.log("\n3) in-flight PDF load cannot resurrect the window after close");
assert(app.includes("_mcBeginFileFormSession"), "open starts a session");
assert(app.includes("_mcInvalidateFileFormSession"), "close/save invalidates the session");
const dismissFn = sliceFunction(app, "_mcDismissFileFormEditorOnFileClose(){");
assert(dismissFn.includes("this._mcInvalidateFileFormSession()"), "file close invalidates in-flight load");
const saveFn = sliceFunction(app, "async _mcSaveAndCloseFileFormEditor(){");
assert(saveFn.includes("this._mcInvalidateFileFormSession()"), "save/close invalidates in-flight load");
const paintFn = sliceFunction(app, "_mcPaintFormEditor(rec){");
assert(paintFn.includes("if(!this._mcFileFormSessionLive) return"), "paint no-ops after invalidate");
assert(paintFn.includes("if(!modal) return"), "paint does not recreate without a live host");
const railFn = sliceFunction(app, "async _mcOpenJoinFormFromRail(rec, type){");
assert(railFn.includes("abortIfFileFormStale"), "join load can abort");
assert(railFn.includes("if(abortIfFileFormStale()) return"), "join load returns without painting a stale editor");
const followFn = sliceFunction(app, "async _mcOpenFollowupFromRail(rec, type, opts){");
assert(followFn.includes("abortIfFileFormStale"), "followup load can abort");
assert(followFn.includes("if(abortIfFileFormStale()) return"), "followup load returns without painting a stale editor");

console.log("\n4) leaving the file still tears the overlay down");
assert(app.includes("void MirrorCallUI._mcDismissFileFormEditorOnFileClose()"), "CustomersUI.close still dismisses");
assert(saveFn.includes("this._mcCloseFileFormModal()"), "save removes the overlay");
const closeModalFn = sliceFunction(app, "_mcCloseFileFormModal(){");
assert(closeModalFn.includes('document.querySelectorAll(".mcFileFormModal")'), "close sweeps orphan overlays");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
