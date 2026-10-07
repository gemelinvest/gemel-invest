/* GI-PRIOR-HEALTH-DECL 2026-10-05
   רכישה חדשה ללקוח קיים: בשלב 7 מוצגת הודעה על הצהרה קודמת,
   ממצאים לפי מבוטח, פירוט סגור עד פתיחה, פעם אחת בסשן.
   בלי נגיעה ב-prefill / כן-לא / שאלון המשך / מודל ממצאים / כרטיסיית רפואה.
   הרצה: node _test-health-prior-decl-notice.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261007-agent-window-v1";
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

function sliceFn(src, startNeedle, endNeedle){
  const start = src.indexOf(startNeedle);
  if(start < 0) return "";
  const end = src.indexOf(endNeedle, start + startNeedle.length);
  if(end < 0) return src.slice(start);
  return src.slice(start, end);
}

const wiz = read("gi-wizard.js");
const app = read("app.js");
const css = read("app.css");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache (BUILD stays aligned)");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "GI_WIZARD_BUILD unchanged");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "GI_WIZARD_JS_VERSION unchanged");
assert(app.includes('gi-wizard.js?v=" + GI_WIZARD_JS_VERSION + "&giPriorDecl=1"'), "wizard href cache suffix");
assert(html.includes("giPriorDecl=1"), "index.html cache suffix");
assert(html.includes("app.css?v=" + TAG) && html.includes("giPriorDecl=1"), "app.css cache suffix");
assert(sw.includes("prior-decl-v1"), "service-worker cache suffix");

console.log("\n2) hook + copy + once-per-session");
const renderFn = sliceFn(wiz, "render(){", "renderSteps(){");
assert(renderFn.includes("this.maybeShowPriorHealthDeclNotice()"), "render step 7 calls the notice");
assert(renderFn.includes("hardenHealthStepInteractivity()"), "health interactivity still hardened");
assert(wiz.includes("GI-PRIOR-HEALTH-DECL 2026-10-05"), "prior-decl marker");
assert(wiz.includes("סוכן/נציג יקר שים לב"), "notice title copy");
assert(wiz.includes("הלקוח:"), "customer name copy");
assert(wiz.includes("הצהיר בתאריך:"), "declaration date copy");
assert(wiz.includes("קיימת הצהרת בריאות קודמת בתיק."), "existing declaration copy");
assert(wiz.includes("הממצאים הבאים שהצהיר:"), "findings intro copy");
assert(wiz.includes(">פתיחה</button>"), "details open via פתיחה");
assert(wiz.includes('id = "lcPriorHealthDeclNotice"'), "new notice modal id");
assert(!wiz.includes('ensureHealthFindingsModal();') || wiz.includes("lcHealthFindingsModal"), "existing findings modal remains");

const maybeFn = sliceFn(wiz, "maybeShowPriorHealthDeclNotice(){", "openPriorHealthDeclNotice(model){");
assert(maybeFn.includes("if(this._priorHealthDeclNoticeShown) return;"), "shown-once guard");
assert(maybeFn.includes("this._priorHealthDeclNoticeShown = true;"), "marks shown for the session");
assert(maybeFn.includes("if(!this.isCustomerPurchaseMode()) return;"), "only existing-customer purchase");
assert(maybeFn.includes("if(Number(this.step) !== 7) return;"), "only health step");
assert(maybeFn.includes("if(!model) return;"), "no modal when there are no yes findings");

const openPurchase = sliceFn(wiz, "async openNewPurchaseForCustomer(customerId, options = {}){", "handleStepEntry(fromStep, toStep){");
assert(openPurchase.includes("baselineHealthDeclaredAt: safeTrim(payload?.mirrorFlow?.healthStep?.savedAt)"), "date from healthStep.savedAt");
assert(openPurchase.includes("|| safeTrim(rec?.updatedAt)"), "date falls back to file updatedAt");
assert(openPurchase.includes("this._priorHealthDeclNoticeShown = false;"), "new purchase resets the once flag");

console.log("\n3) grouping + collapsed details");
const collectFn = sliceFn(wiz, "collectPriorHealthDeclNoticeModel(){", "ensurePriorHealthDeclNotice(){");
assert(collectFn.includes("baselineHealthDeclaration"), "reads baseline only");
assert(collectFn.includes('safeTrim(resp.answer) !== "yes"'), "only yes findings");
assert(collectFn.includes("if(!findings.length) return;"), "skips insureds with no yes");
assert(collectFn.includes("if(!groups.length) return null;"), "no groups → no notice");
assert(collectFn.includes("groups.push"), "groups findings per insured");

const bodyFn = sliceFn(wiz, "renderPriorHealthDeclNoticeBody(model){", "maybeShowPriorHealthDeclNotice(){");
assert(bodyFn.includes("lcPriorHealthDeclNotice__insured"), "per-insured sections");
assert(bodyFn.includes('class="lcPriorHealthDeclNotice__item"'), "finding rows start closed");
assert(!/class="lcPriorHealthDeclNotice__item is-open"/.test(bodyFn), "no auto-open findings");
assert(bodyFn.includes("data-prior-decl-toggle"), "click opens details");

assert(css.includes(".lcPriorHealthDeclNotice.is-open{"), "notice overlay css");
assert(css.includes("z-index:10070"), "notice sits above the wizard");
assert(css.includes(".lcPriorHealthDeclNotice__itemBody{"), "details body css");
assert(css.includes("display:none"), "details hidden until open");
assert(css.includes(".lcPriorHealthDeclNotice__item.is-open .lcPriorHealthDeclNotice__itemBody{"), "open class reveals details");

console.log("\n4) regression — untouched contracts");
const prefill = sliceFn(wiz, "ensureCustomerPurchaseHealthPrefill(){", "getHealthValidationQuestionList(){");
assert(prefill.includes("if(!this.isCustomerPurchaseMode()) return;"), "prefill still gated");
assert(prefill.includes("store.responses[qKey][insId] = JSON.parse(JSON.stringify(base));"), "prefill still copies baseline answers");
assert(!prefill.includes("maybeShowPriorHealthDeclNotice"), "notice is not mixed into prefill");
assert(wiz.includes("ensureHealthFindingsModal(){"), "existing findings modal helper stays");
assert(wiz.includes("openHealthFindingsModal(insId){"), "existing findings open stays");
assert(app.includes('cfMedicalYes${idx === 0 ? " is-open" : ""}'), "customer-file medical tab still auto-opens first yes");
assert(app.includes("bindMedicalTabActions(){"), "medical tab click binding unchanged");
assert(wiz.includes("setHealthResponse(qKey, insId, { answer:'yes', fields, saved:false, editing:true })"), "yes follow-up write path unchanged");
assert(wiz.includes("hardenHealthStepInteractivity(){"), "health step harden stays");

console.log("\n5) runtime — grouping from baseline");
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
function collectModel(baseline, insureds){
  const responses = baseline.responses && typeof baseline.responses === "object" ? baseline.responses : {};
  const orderedIds = [];
  const seenIds = new Set();
  insureds.forEach((ins) => {
    const id = safeTrim(ins?.id);
    if(!id || seenIds.has(id)) return;
    seenIds.add(id);
    orderedIds.push(id);
  });
  Object.keys(responses).forEach((qKey) => {
    Object.keys(responses[qKey] || {}).forEach((insId) => {
      const id = safeTrim(insId);
      if(!id || seenIds.has(id)) return;
      seenIds.add(id);
      orderedIds.push(id);
    });
  });
  const qOrder = Object.keys(responses);
  const groups = [];
  orderedIds.forEach((insId) => {
    const ins = insureds.find((x) => String(x.id) === String(insId)) || null;
    const findings = [];
    qOrder.forEach((qKey) => {
      const resp = responses[qKey] && responses[qKey][insId];
      if(!resp || safeTrim(resp.answer) !== "yes") return;
      findings.push(qKey);
    });
    if(!findings.length) return;
    groups.push({ insId, label: ins ? ins.label : "מבוטח", findings });
  });
  return groups.length ? groups : null;
}

const groups = collectModel({
  responses: {
    q1: {
      ins_a: { answer: "yes", fields: { notes: "כאבי גב" } },
      ins_b: { answer: "no", fields: {} }
    },
    q2: {
      ins_a: { answer: "no", fields: {} },
      ins_b: { answer: "yes", fields: { notes: "עישון" } }
    },
    q3: {
      ins_a: { answer: "no", fields: {} },
      ins_b: { answer: "no", fields: {} }
    }
  }
}, [
  { id: "ins_a", label: "דני כהן" },
  { id: "ins_b", label: "מיכל כהן" }
]);
assert(groups && groups.length === 2, "two insureds with yes are listed separately");
assert(groups[0].label === "דני כהן" && groups[0].findings.join(",") === "q1", "primary keeps only own yes");
assert(groups[1].label === "מיכל כהן" && groups[1].findings.join(",") === "q2", "spouse keeps only own yes");
assert(collectModel({ responses: { q1: { ins_a: { answer: "no" } } } }, [{ id: "ins_a", label: "דני" }]) === null, "all-no baseline yields no notice");
assert(collectModel({ responses: {} }, [{ id: "ins_a", label: "דני" }]) === null, "empty baseline yields no notice");

if(failed){
  console.error("\nFAILED  passed=" + passed + " failed=" + failed);
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
