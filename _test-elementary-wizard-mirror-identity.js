/* GI-FIX 2026-09-17 — זהות לקוח באשף אלמנטרי: שיקוף + כניסה מחדש.
   תשלום→שיקוף לא ממזג ללקוח אחר; השיקוף קשור ל-_wizardMirrorCustomerId;
   התנתקות סוגרת אשף; סיום מוצלח לא כותב טיוטה מחדש;
   שלב השיקוף באשף הוא טופס הכנה בלי טיימר שיחה.
   הרצה: node _test-elementary-wizard-mirror-identity.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
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

function normalizeIdValue(v){
  return String(v == null ? "" : v).replace(/\D/g, "").slice(0, 9);
}

function safeTrim(v){
  return String(v == null ? "" : v).trim();
}

function customerRecordMatchesWizardPrimary(rec, ident){
  if(!rec) return false;
  const recId = normalizeIdValue(rec.idNumber);
  if(ident.idNumber.length >= 8 && recId.length >= 8) return ident.idNumber === recId;
  const recName = safeTrim(rec.fullName);
  if(ident.fullName && recName) return ident.fullName === recName;
  return false;
}

const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-elementary-wizard-mirror-identity.js")]).status === 0, "node --check this test");

console.log("\n2) identity matcher — sticky lastSavedCustomerId of another client is rejected");
assert(customerRecordMatchesWizardPrimary(
  { idNumber: "123456789", fullName: "לקוח א" },
  { idNumber: "123456789", fullName: "לקוח ב" }
) === true, "same ת״ז matches even if name differs");
assert(customerRecordMatchesWizardPrimary(
  { idNumber: "111111118", fullName: "לקוח א" },
  { idNumber: "123456789", fullName: "לקוח ב" }
) === false, "different ת״ז does not match");
assert(customerRecordMatchesWizardPrimary(
  { idNumber: "", fullName: "דנה כהן" },
  { idNumber: "", fullName: "דנה כהן" }
) === true, "name fallback when ת״ז missing");
assert(customerRecordMatchesWizardPrimary(
  { idNumber: "", fullName: "לקוח א" },
  { idNumber: "", fullName: "לקוח ב" }
) === false, "different names without ת״ז do not match");
assert(customerRecordMatchesWizardPrimary(null, { idNumber: "123456789", fullName: "א" }) === false, "missing record does not match");

const matchFn = sliceFunction(wiz, "customerRecordMatchesWizardPrimary(rec){");
assert(!!matchFn, "customerRecordMatchesWizardPrimary exists");
assert(matchFn.includes("ident.idNumber.length >= 8") && matchFn.includes("recId.length >= 8"), "match requires ת״ז length");
assert(matchFn.includes("ident.fullName") && matchFn.includes("rec.fullName"), "name fallback remains");

console.log("\n3) save to mirror does not merge into a previous elementary client");
const saveCompleted = sliceFunction(wiz, "async saveCompletedCustomer(){");
assert(!!saveCompleted, "saveCompletedCustomer exists");
assert(saveCompleted.includes("this.isElementaryFlow()") && saveCompleted.includes("this.resolveElementarySaveTargetCustomerId()"), "elementary save target uses identity resolver");
assert(!/:\s*safeTrim\(this\.lastSavedCustomerId\);\s*\n\s*const existingCustomer/.test(saveCompleted), "elementary no longer uses raw lastSavedCustomerId as the only non-purchase target");

const resolveSave = sliceFunction(wiz, "resolveElementarySaveTargetCustomerId(){");
assert(!!resolveSave, "resolveElementarySaveTargetCustomerId exists");
assert(resolveSave.includes("this._wizardMirrorCustomerId"), "save resolver prefers mirror customer id");
assert(resolveSave.includes("this.lastSavedCustomerId"), "save resolver may use lastSaved only as a candidate");
assert(resolveSave.includes("this.customerRecordMatchesWizardPrimary(rec)"), "save resolver requires identity match");

const resolveMirror = sliceFunction(wiz, "resolveWizardElementaryMirrorCustomerId(){");
assert(!!resolveMirror, "resolveWizardElementaryMirrorCustomerId exists");
assert(resolveMirror.includes("safeTrim(this._wizardMirrorCustomerId)"), "mirror mount prefers explicit bind id");
assert(resolveMirror.includes("resolveElementarySaveTargetCustomerId"), "mirror falls back only through identity resolver");

const mountMirror = sliceFunction(wiz, "mountWizardElementaryMirrorUi(){");
assert(!!mountMirror, "mountWizardElementaryMirrorUi exists");
assert(mountMirror.includes("this.resolveWizardElementaryMirrorCustomerId()"), "mirror UI binds via resolver");
assert(!mountMirror.includes("this.lastSavedCustomerId"), "mirror UI does not fall back raw to lastSavedCustomerId");

console.log("\n4) mirror id is persisted in local draft and session snapshot");
const saveDraft = sliceFunction(wiz, "_saveLocalDraft(){");
assert(!!saveDraft, "_saveLocalDraft exists");
assert(saveDraft.includes("wizardMirrorCustomerId"), "local draft stores wizardMirrorCustomerId");
assert(saveDraft.includes("wizardMirrorKeepSteps"), "local draft stores frozen mirror steps");

const restoreDraft = sliceFunction(wiz, "restoreWizardSessionContextFromDraft(snap){");
assert(!!restoreDraft, "restoreWizardSessionContextFromDraft exists");
assert(restoreDraft.includes("row.wizardMirrorCustomerId"), "draft restore reapplies mirror customer id");
assert(restoreDraft.includes("row.wizardMirrorKeepSteps"), "draft restore reapplies frozen steps");

const snapshot = sliceFunction(wiz, "_snapshotWizardSession(){");
assert(!!snapshot, "_snapshotWizardSession exists");
assert(snapshot.includes("wizardMirrorCustomerId"), "session snapshot keeps mirror customer id");
assert(snapshot.includes("wizardMirrorKeepSteps"), "session snapshot keeps frozen steps");

const restoreSnap = sliceFunction(wiz, "_restoreWizardSession(snapshot){");
assert(!!restoreSnap, "_restoreWizardSession exists");
assert(restoreSnap.includes("snapshot.wizardMirrorCustomerId"), "session restore reapplies mirror customer id");

const attach = sliceFunction(wiz, "attachWizardElementaryMirrorToPayload(payload){");
assert(!!attach, "attachWizardElementaryMirrorToPayload exists");
assert(attach.includes("resolveWizardElementaryMirrorCustomerId"), "payload attach checks expected customer id");
assert(attach.includes("ElementaryMirrorUI?.selectedCustomerId"), "payload attach checks draft customer id");
assert(attach.includes("String(expectedId) !== String(draftId)"), "foreign reportDraft is skipped");

console.log("\n5) logout closes wizard; successful finish does not rewrite local draft");
const closeFn = sliceFunction(wiz, "close(){");
assert(!!closeFn, "close exists");
assert(closeFn.includes("!this._skipLocalDraftOnClose"), "close skips local draft after successful finish");

const finishFn = sliceFunction(wiz, "async finishWizard(options = {}){");
assert(!!finishFn, "finishWizard exists");
assert(finishFn.includes("this._skipLocalDraftOnClose = !continueToMirror"), "final finish marks skip-draft-on-close");
assert(finishFn.includes("this._skipLocalDraftOnClose = false"), "continue-to-mirror still allows resume draft");

const closeSession = sliceFunction(wiz, "closeForSessionEnd(){");
assert(!!closeSession, "closeForSessionEnd exists");
assert(closeSession.includes("this._sessionEndHandled"), "logout closer is idempotent");
assert(closeSession.includes("this.lastSavedCustomerId = null"), "logout clears sticky customer id");
assert(closeSession.includes("this._wizardMirrorCustomerId = null"), "logout clears mirror customer id");

assert(wiz.includes('addEventListener("gi:app-logout"'), "wizard chunk listens to logout");
assert(wiz.includes("closeForSessionEnd"), "logout path is wired");

const logoutFn = sliceFunction(app, "logout(reason = \"manual\"){");
assert(!!logoutFn, "Auth.logout exists");
assert(logoutFn.includes("Wizard.closeForSessionEnd"), "Auth.logout closes wizard for session end");

const stepLabel = sliceFunction(wiz, "getLocalDraftStepLabel(snap){");
assert(!!stepLabel, "getLocalDraftStepLabel exists");
assert(stepLabel.includes("שיקוף"), "restore dialog labels elementary שיקוף");
assert(stepLabel.includes("סיכום והקמת לקוח"), "restore dialog labels elementary summary");

const renderFn = sliceFunction(wiz, "render(){");
assert(renderFn.includes("!this.isElementaryFlow() && Number(this.step) === 7"), "health step-7 hooks do not run on elementary mirror");

console.log("\n6) wizard mirror is prep-only — call timer stays on the menu screen");
const unmount = sliceFunction(app, "unmountWizardEmbed(){");
assert(!!unmount, "unmountWizardEmbed exists");
assert(unmount.includes("keepCallIdentity"), "unmount keeps identity only for a live menu call");
assert(unmount.includes("this.selectedCustomerId = null"), "unmount clears embed identity");
assert(unmount.includes("this.reportDraft = null"), "unmount clears leftover reportDraft");

const schedule = sliceFunction(app, "_schedulePersist(label){");
assert(!!schedule, "_schedulePersist exists");
assert(schedule.includes("const persistId = safeTrim(this.selectedCustomerId)"), "draft persist captures customer id at schedule time");
assert(schedule.includes("this._getCustomer(persistId)"), "draft persist uses captured id, not later selectedCustomerId");

const startCall = sliceFunction(app, "async startCallForCustomer(customerId){");
assert(!!startCall, "startCallForCustomer exists");
assert(startCall.includes("if(this.isWizardEmbed()) return"), "menu call start is blocked inside wizard embed");

const beginCall = sliceFunction(app, "_beginCallSession(rec){");
assert(!!beginCall, "_beginCallSession exists");
assert(beginCall.includes("if(this.isWizardEmbed()) return"), "call session does not start from wizard prep");

const timerLoop = sliceFunction(app, "_startTimerLoop(){");
assert(!!timerLoop, "_startTimerLoop exists");
assert(timerLoop.includes("if(this.isWizardEmbed()) return"), "call timer does not run in wizard embed");

const wizardMirrorCopy = sliceFunction(wiz, "renderElementaryStepMirror(_ins){");
assert(wizardMirrorCopy.includes("טופס מילוי בלבד"), "wizard mirror copy says it is a prep form");
assert(wizardMirrorCopy.includes("שיקוף שיחה אלמנטרי"), "wizard mirror copy points timer to the menu screen");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
if(failed) process.exit(1);
