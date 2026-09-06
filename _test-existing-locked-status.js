/* GI-OPS 2026-09-06 — סטטוס פוליסות קיימות מהר הביטוח:
   סיעודי / קולקטיב = לא ניתן לגעת; סטטוס שסומן באשף נשאר מוצג.
   הרצה: node _test-existing-locked-status.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260906-existing-locked-status-v1";
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

function safeTrim(v){ return String(v == null ? "" : v).trim(); }

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

const wiz = read("gi-wizard.js");
const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-existing-locked-status.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(wiz.includes('const GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build tag");

console.log("\n2) מקורות הסטטוס בקוד");
assert(wiz.includes("isExistingPolicyNursingReadOnly"), "אשף מזהה סיעודי נעול");
assert(wiz.includes("isExistingPolicyLockedReadOnly"), "אשף מאחד סיעודי+קולקטיב כנעול");
assert(wiz.includes('return "לא ניתן לגעת"'), "תווית סיעודי = לא ניתן לגעת");
assert(wiz.includes("קולקטיבית / קבוצתית · לא ניתן לגעת"), "תווית קולקטיב נעול");
assert(app.includes("getExistingPolicyLockedStatusLabel"), "תיק לקוח/שיקוף משתמש באותה תווית נעולה");
assert(app.includes("locked_nursing"), "סטטוס סיעודי נשמר לתיק הלקוח");
assert(!/getPolicyStatusValue\(p\);/.test(app) || app.includes("getPolicyStatusValue(p, row.cancellation)"), "כרטיס שיקוף מושך גם את הסטטוס מהביטולים");

console.log("\n3) אשף אמיתי — תוויות סטטוס");
const host = new Proxy({
  Wizard: {},
  safeTrim,
  escapeHtml: (s) => String(s == null ? "" : s),
  on(){}, $(){ return null; }, $$(){ return []; },
  nowISO: () => "2026-09-06T12:00:00.000Z"
}, {
  get(target, prop){
    if(prop in target) return target[prop];
    if(prop === "then") return undefined;
    return () => {};
  }
});
const sandbox = {
  __GI_WIZARD_HOST: host,
  globalThis: null,
  window: { requestAnimationFrame(fn){ fn(); }, setTimeout(fn){ return fn(); }, clearTimeout(){} },
  document: { getElementById(){ return null; }, createElement(){ return { style:{}, classList:{ add(){}, remove(){} }, appendChild(){} }; }, body: { appendChild(){} } },
  console
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox.window;
try{
  vm.runInNewContext(wiz, sandbox, { filename: "gi-wizard.js" });
  assert(typeof host.Wizard.getExistingPolicyStatusMeta === "function", "Wizard נטען");
}catch(err){
  assert(false, "load gi-wizard.js: " + (err && err.message));
}

const W = host.Wizard;
if(typeof W.getExistingPolicyStatusMeta === "function"){
  const nursing = { id: "n1", company: "הפניקס", type: "סיעודי", importedFromHarBituach: true };
  const nursingMeta = W.getExistingPolicyStatusMeta(nursing, { cancellations: {} });
  assert(nursingMeta.label === "לא ניתן לגעת", "סיעודי בלי סטטוס → לא ניתן לגעת, לא טרם הוזן");
  assert(nursingMeta.label !== "טרם נבחר" && nursingMeta.label !== "טרם הוזן", "סיעודי לא נופל לטרם הוזן");

  const coll = { id: "c1", company: "כלל", type: "בריאות", isCollectiveReadOnly: true, classification: "קולקטיבי" };
  const collMeta = W.getExistingPolicyStatusMeta(coll, { cancellations: {} });
  assert(collMeta.label === "קולקטיבית / קבוצתית · לא ניתן לגעת", "קולקטיב נעול מציג לא ניתן לגעת");

  const marked = { id: "p1", company: "כלל", type: "ריסק" };
  const markedMeta = W.getExistingPolicyStatusMeta(marked, { cancellations: { p1: { status: "full", reason: "סדר בתיק הביטוחי" } } });
  assert(markedMeta.label === "ביטול מלא", "סטטוס שסומן באשף מוצג");
  assert(markedMeta.reason === "סדר בתיק הביטוחי", "סיבת הביטול נשמרת");

  const appoint = W.getExistingPolicyStatusMeta({ id: "p2", type: "בריאות" }, { cancellations: { p2: { status: "agent_appoint" } } });
  assert(appoint.label === "מינוי סוכן", "מינוי סוכן מוצג");

  const empty = W.getExistingPolicyStatusMeta({ id: "p3", type: "בריאות" }, { cancellations: {} });
  assert(empty.label === "טרם נבחר", "בלי סטטוס ובלי נעילה → טרם נבחר");

  const ins = {
    data: {
      existingPolicies: [nursing, coll, marked]
    }
  };
  const actionable = W.getStep3ActionablePolicies(ins);
  assert(actionable.length === 1 && actionable[0].id === "p1", "סיעודי וקולקטיב לא נחשבים פוליסות לטיפול");
  assert(W.renderExistingPolicyLockedActionBox(nursing).includes("לא ניתן לגעת"), "תיבת סיעודי באשף כותבת לא ניתן לגעת");
  assert(W.renderExistingPolicyLockedActionBox(coll).includes("פוליסה קבוצתית / קולקטיבית"), "תיבת קולקטיב נשארת");
}

console.log("\n4) תיק לקוח + שיקוף — אותן תוויות");
const cuiStart = app.indexOf("normalizeExistingPolicyStatus(value){");
const cuiEnd = app.indexOf("resolveExistingPolicyStatus(ins, rawPolicy){", cuiStart);
const polStart = app.indexOf("getPolicyStatusValue(policy, cancellation){");
const polEnd = app.indexOf("async openReflection(){", polStart);
assert(cuiStart > 0 && cuiEnd > cuiStart && polStart > 0 && polEnd > polStart, "פונקציות תצוגת סטטוס נמצאו ב-app.js");
const cuiBox = {};
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  var Wizard = this.Wizard;
  const ui = {
    ${app.slice(cuiStart, cuiEnd)}
    ${app.slice(polStart, polEnd)}
  };
  this.ui = ui;
`, Object.assign(cuiBox, { Wizard: W }));

const ui = cuiBox.ui;
assert(ui.getExistingPolicyLockedStatusLabel({ type: "סיעודי" }) === "לא ניתן לגעת", "CustomersUI: סיעודי = לא ניתן לגעת");
assert(ui.getExistingStatusPresentation({ type: "סיעודי" }).label === "לא ניתן לגעת", "תגית תיק לקוח לסיעודי");
assert(ui.getExistingStatusPresentation({ type: "סיעודי" }).label !== "טרם הוזן", "תיק לקוח לא מציג טרם הוזן על סיעודי");
assert(ui.getPolicyStatusValue({ type: "סיעודי" }, {}) === "לא ניתן לגעת", "טבלת שיקוף: סיעודי");
assert(ui.getPolicyStatusValue({ type: "בריאות", isCollectiveReadOnly: true }, {}) === "קולקטיבית / קבוצתית · לא ניתן לגעת", "טבלת שיקוף: קולקטיב");
assert(ui.getPolicyStatusValue({ type: "ריסק" }, { status: "nochange_client" }) === "ללא שינוי – לבקשת הלקוח", "טבלת שיקוף: סטטוס שסומן באשף");
assert(ui.getPolicyStatusValue({ type: "בריאות" }, {}) === "טרם הוזן", "רק בלי סטטוס ובלי נעילה → טרם הוזן");
assert(ui.getExistingStatusPresentation({ existingStatus: "full" }).label === "ביטול מלא", "תיק לקוח מציג ביטול מלא שסומן");

console.log("\n5) רגרסיה — כניסה");
assert(app.includes("function findAgentForLogin(username, agents = []){"), "findAgentForLogin לא נגע");
assert(app.includes("Auth._submit = async function(){"), "Auth._submit לא נגע");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
