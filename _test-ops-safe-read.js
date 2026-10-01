/* עומס תפעול בטוח: סריקה בלי תיק מלא, מילוי רקע ממתין בתיק פתוח,
   וטופס השיקוף נשאר אותה שורה בתיק.
   הרצה: node _test-ops-safe-read.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
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
  let i = src.indexOf("{", start);
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

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) toast polls keep notice fields and drop the full file");
const select = (app.match(/const GI_TOAST_CUSTOMER_SELECT = "([^"]+)"/) || [])[1] || "";
assert(select.includes("callSession:payload->mirrorFlow->callSession"), "call session stays on the poll");
assert(select.includes("agentNotice:payload->opsProcess->agentNotice"), "agent notice stays on the poll");
assert(select.includes("opsNotice:payload->opsProcess->opsNotice"), "ops notice stays on the poll");
assert(!/(^|,)payload(,|$)/.test(select), "full payload column is not selected");
assert(app.includes("function mapToastCustomerRow(row, idx)"), "thin row is rebuilt into the existing payload shape");
const mirror = sliceFunction(app, "async fetchRecentOwnedRows(){");
assert(mirror.includes("mapToastCustomerRow(row, idx)"), "mirror poll maps the thin row");
assert(mirror.includes("GI_TOAST_CUSTOMER_SELECT"), "mirror poll uses the thin select");
const opsWatcher = app.slice(app.indexOf("const OpsAgentStatusToastWatcher"), app.indexOf("const OpsReferralFastWatcher"));
assert(opsWatcher.includes("mapToastCustomerRow(row, idx)"), "ops status poll maps the thin row");
assert(opsWatcher.includes("GI_TOAST_CUSTOMER_SELECT"), "ops status poll uses the thin select");
assert(app.includes("shouldShowAgentToast(rec, session)"), "agent toast decision is unchanged");
assert(app.includes("shouldShowOpsHandledToast(rec, session)"), "handled toast decision is unchanged");
const referral = app.slice(app.indexOf("const OpsReferralFastWatcher"), app.indexOf("const OpsReferralsUI"));
assert(referral.includes("intervalMs: 1000"), "referral poll stays at one second");

console.log("\n3) bulk hydration waits, opening one file does not");
const hydrateAt = app.indexOf("async hydratePayloads(options = {}){");
const hydrate = app.slice(hydrateAt, hydrateAt + 2500);
const ensure = sliceFunction(app, "async ensureRecordPayload(stateKey, id){");
assert(hydrate.includes("backgroundPayloadHydrationShouldPause()"), "bulk fill waits while a file or call is open");
assert(hydrate.includes("await this.sleep(400)"), "the wait keeps already loaded rows and continues");
assert(!ensure.includes("backgroundPayloadHydrationShouldPause"), "opening one file still loads that row");
const pause = sliceFunction(app, "function backgroundPayloadHydrationShouldPause(){");
assert(pause.includes("_callRunning") && pause.includes('contains("is-open")'), "pause covers an open file and a live mirror call");

console.log("\n4) health form load shows a spinner and keeps the same file row");
const editor = sliceFunction(app, "_mcHealthFormEditorHtml(rec){");
assert(editor.includes(">טוען קובץ<"), "loading text is טוען קובץ");
assert(editor.includes("mcFormEd__spin"), "loading shows a spinner");
assert(!editor.includes("טוען את הטופס המקורי"), "old form loading sentence is gone");
assert(css.includes(".mcFormEd__spin{") && css.includes("animation:spinZ"), "spinner is a rotating circle");
const openJoin = sliceFunction(app, "async _mcOpenJoinFormFromRail(rec, type, opts){");
assert(openJoin.includes("fillOriginalTemplate"), "open still fills the official form");
assert(openJoin.includes("cacheOnly"), "prefetch can build bytes without painting");
assert(!openJoin.includes("_mcUpsertFilledFormDoc"), "opening or prefetch does not write a document row");
assert(!openJoin.includes("App.persist") && !openJoin.includes("_persistMirrorCall"), "opening or prefetch does not save");
assert(openJoin.includes("_mcJoinCacheKey"), "changed answers miss the in-memory copy");
const prefetch = sliceFunction(app, "_mcPrefetchOpenForms(rec){");
assert(prefetch.includes("cacheOnly: true"), "idle prefetch stays in memory");
assert(!prefetch.includes("_mcUpsertFilledFormDoc"), "prefetch does not insert a second file");
assert(!prefetch.includes("persist"), "prefetch does not persist");
const upsert = sliceFunction(app, "_mcUpsertFilledFormDoc(rec, type, dataUrl, fileName, name, idSuffix){");
assert(upsert.includes("_mcCanonicalJoinDocId"), "save still targets the canonical document id");
assert(upsert.includes("list[idx] = row"), "save replaces the existing row");
const readyDoc = sliceFunction(app, "isReadySignatureDoc(doc){");
const ready = sliceFunction(app, "readySignatureDocs(rec){");
assert(readyDoc.includes("mirrorAgentSaved"), "signature send reads the form saved in the mirror call");
assert(ready.includes("isReadySignatureDoc"), "signature list uses that saved-form check");
assert(ready.includes("customerDocuments") || ready.includes("listFromPayload"), "signature send reads the customer file list");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\n-----");
console.log("passed=" + passed + " failed=" + failed);
process.exit(0);
