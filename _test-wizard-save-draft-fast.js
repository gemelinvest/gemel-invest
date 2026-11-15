/* GI-FIX 2026-08-13 — רגרסיה: שמירת הצעה מהירה באשף בריאות וסיכונים.
   הרצה: node _test-wizard-save-draft-fast.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const WIZARD_FILE = path.join(ROOT, "gi-wizard.js");
let failed = 0;
let passed = 0;

function assert(cond, msg){
  if(cond){
    passed += 1;
    console.log("  PASS  " + msg);
  }else{
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function safeTrim(v){
  return String(v == null ? "" : v).trim();
}

console.log("1) syntax check");
const syntax = spawnSync(process.execPath, ["--check", WIZARD_FILE], { encoding: "utf8" });
assert(syntax.status === 0, "node --check gi-wizard.js");
if(syntax.status !== 0) console.error(syntax.stderr || syntax.stdout);

console.log("\n2) source contracts — fast path, not business logic");
const src = fs.readFileSync(WIZARD_FILE, "utf8");
assert(src.includes("_persistProposalSaveInBackground"), "background persist helper exists");
assert(src.includes("_commitProposalRecordLocally"), "local commit helper exists");
assert(src.includes("skipNormalize: true"), "persist skips full normalize");
assert(src.includes("skipServerMerge: true"), "persist skips server merge");
assert(src.includes("skipCustomersSync: true"), "persist skips customers sync");
assert(src.includes("lightShadows: true"), "persist uses light shadows");
assert(/retries:\s*2/.test(src) && /delayMs:\s*250/.test(src), "verify retries reduced to 2x250ms");
assert(!/refreshStateShadows\(\s*\)/.test(src.match(/async saveDraft\(\)\{[\s\S]*?\n    \},/)?.[0] || ""), "saveDraft does not call full refreshStateShadows()");

const saveDraftBlock = src.slice(src.indexOf("async saveDraft(){"), src.indexOf("getOperationalAgentNumbers(){"));
assert(saveDraftBlock.includes("this._persistProposalSaveInBackground(true)"), "direct success fires persist in background");
assert(saveDraftBlock.includes("SaveStatusUI.success('ההצעה נשמרה בהצלחה'"), "success UI is shown before waiting on full persist");
assert(!/await App\.persist\("ההצעה נשמרה", \{ skipProposalsSync: proposalStoredDirectly \}\)/.test(saveDraftBlock), "no longer awaits full persist after direct save");
assert(!saveDraftBlock.includes("skipProposalsSync: false"), "a rejected save does not sync the proposals list");
const rejectedAt = saveDraftBlock.indexOf("if(!proposalStoredDirectly)");
const commitAt = saveDraftBlock.indexOf("this._commitProposalRecordLocally(record)");
const successAt = saveDraftBlock.indexOf("SaveStatusUI.success('ההצעה נשמרה בהצלחה'");
assert(rejectedAt >= 0 && commitAt > rejectedAt && successAt > commitAt, "the list and the success message come only after the database accepts the row");
assert(saveDraftBlock.includes("getAuthAccessToken"), "save checks the signed-in session first");
assert(saveDraftBlock.includes("השמירה לא נקלטה"), "a rejected save says it was not received");
assert(!saveDraftBlock.includes("supabase-proposals-rls-fix.sql"), "save does not point at the old policy file");
assert(saveDraftBlock.includes("blockIfAgentDuplicateIdAsync"), "duplicate-id guard still runs");
assert(saveDraftBlock.includes("getPremiumValidationIssues"), "premium validation still runs");
assert(saveDraftBlock.includes("upsertSingleRow"), "direct proposal upsert still runs");
assert(saveDraftBlock.includes("stampRecordAgentOwnership"), "agent ownership stamp still runs");
assert(!saveDraftBlock.includes("ProposalsUI.render();"), "does not render proposals list on the save path");

console.log("\n3) load real wizard methods");
const persistCalls = [];
let lastShadowOpts = null;
const host = new Proxy({
  Wizard: {},
  safeTrim,
  escapeHtml: (s) => String(s == null ? "" : s),
  on: (el, evt, fn) => el && el.addEventListener && el.addEventListener(evt, fn),
  $: () => null,
  $$: () => [],
  nowISO: () => "2026-08-13T07:40:00.000Z",
  State: { data: { proposals: [], meta: {} } },
  App: {
    persist(label, opts){
      persistCalls.push({ label, opts });
      return Promise.resolve({ ok: true, at: "2026-08-13T07:40:01.000Z" });
    }
  },
  UI: { renderSyncStatus(){} },
  LiveRefresh: { getCurrentView(){ return "dashboard"; } },
  ProposalsUI: { render(){} },
  refreshStateShadows(opts){ lastShadowOpts = opts || {}; }
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
  window: { requestAnimationFrame(fn){ fn(); }, setTimeout(fn){ fn(); } },
  document: { getElementById(){ return null; } },
  console
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox.window;

try{
  vm.runInNewContext(src, sandbox, { filename: "gi-wizard.js" });
  assert(typeof host.Wizard.saveDraft === "function", "saveDraft installed");
}catch(err){
  assert(false, "load gi-wizard.js: " + (err && err.message));
  console.error(err);
}

const W = host.Wizard;
if(typeof W._commitProposalRecordLocally === "function"){
  console.log("\n4) local commit + background persist flags");
  const record = { id: "prop_test_1", fullName: "בדיקה", payload: { flowType: "health" } };
  W.els = { btnSaveDraft: { disabled: false } };
  W._clearLocalDraft = () => { W._cleared = true; };
  W._commitProposalRecordLocally(record);
  assert(host.State.data.proposals[0] === record, "proposal is written to local State");
  assert(W.editingDraftId === "prop_test_1", "editingDraftId is set to saved id");
  assert(W._cleared === true, "local emergency draft is cleared");
  assert(lastShadowOpts && lastShadowOpts.skipNormalize === true, "local shadows skip normalize");
  assert(lastShadowOpts && lastShadowOpts.lightShadows === true, "local shadows are light");

  persistCalls.length = 0;
  W._persistProposalSaveInBackground(true);
  assert(persistCalls.length === 1, "background persist is fired once");
  const opts = persistCalls[0].opts;
  assert(opts.skipNormalize === true, "bg persist skipNormalize");
  assert(opts.skipServerMerge === true, "bg persist skipServerMerge");
  assert(opts.skipCustomersSync === true, "bg persist skipCustomersSync");
  assert(opts.skipProposalsSync === true, "bg persist skipProposalsSync after direct save");
  assert(opts.silent === true, "bg persist silent");
  assert(opts.yieldUi === true, "bg persist yieldUi");
}

function loadWizard(host){
  const sandbox = {
    __GI_WIZARD_HOST: host,
    globalThis: null,
    window: { requestAnimationFrame(fn){ fn(); }, setTimeout(fn){ fn(); } },
    document: { getElementById(){ return null; } },
    console
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: "gi-wizard.js" });
  return host.Wizard;
}

console.log("\n5) a rejected save stays off the list");
const host2 = new Proxy({
  Wizard: {},
  safeTrim,
  escapeHtml: (s) => String(s == null ? "" : s),
  on: () => {},
  $: () => null,
  $$: () => [],
  nowISO: () => "2026-11-15T20:00:00.000Z",
  Auth: { current: { id: "mgr-1", name: "אוריה", role: "manager" } },
  State: { data: { proposals: [], meta: {} } },
  App: { persist: async () => ({ ok: true }) },
  UI: { renderSyncStatus(){} },
  LiveRefresh: { getCurrentView(){ return "proposals"; } },
  ProposalsUI: { render(){} },
  refreshStateShadows(){},
  normalizeProposalRecord(rec){ return rec; },
  SaveStatusUI: {
    error(title, text){ host2._status = { kind: "error", title, text }; },
    success(title, text){ host2._status = { kind: "success", title, text }; },
    show(){ host2._status = { kind: "loading" }; }
  },
  Storage: {
    async getAuthAccessToken(){ return host2._token; },
    buildProposalRows(data){
      const rec = data.proposals[0];
      return [{ id: rec.id, updated_at: rec.updatedAt, full_name: rec.fullName }];
    },
    async upsertSingleRow(){ return host2._upsert; },
    async verifySavedRow(){ return { ok: true, data: { id: "saved" } }; },
    async loadSingleRow(){ return { ok: false }; },
    rememberRows(){}
  },
  SUPABASE_TABLES: { proposals: "proposals" },
  _token: "",
  _upsert: { ok: false, error: "new row violates row-level security policy for table \"proposals\"" },
  _status: null,
  _hint: ""
}, {
  get(target, prop){
    if(prop in target) return target[prop];
    if(prop === "then") return undefined;
    return () => {};
  }
});

const W2 = loadWizard(host2);
W2.getDraftPayload = () => ({ operational: { primary: { firstName: "אביב", lastName: "פרץ" } }, insureds: [{}] });
W2.blockIfAgentDuplicateIdAsync = async () => false;
W2.getPremiumValidationIssues = () => [];
W2.isCustomerPurchaseMode = () => false;
W2.setHint = (text) => { host2._hint = text; };
W2._yieldWizardUi = async () => {};
W2._clearLocalDraft = () => { W2._clearedDraft = true; };
W2.els = { btnSaveDraft: { disabled: false } };
W2.step = 1;

(async () => {
  host2._token = "";
  await W2.saveDraft();
  assert(host2.State.data.proposals.length === 0, "without a session the proposal is not listed");
  assert(host2._status && host2._status.kind === "error", "without a session the save is an error");
  assert(String(host2._status && host2._status.text).includes("השמירה לא נקלטה"), "without a session the message says the save was not received");
  assert(W2._clearedDraft !== true, "without a session the typed draft stays");

  host2._token = "signed-in-token";
  host2._upsert = { ok: false, error: "new row violates row-level security policy for table \"proposals\"" };
  await W2.saveDraft();
  assert(host2.State.data.proposals.length === 0, "a rejected row is not listed");
  assert(String(host2._status && host2._status.text).includes("היכנס מחדש"), "a rejected row asks for a fresh login");
  assert(W2._clearedDraft !== true, "a rejected row keeps the typed draft");

  const keptId = W2.editingDraftId;
  host2._upsert = { ok: true };
  await W2.saveDraft();
  assert(host2.State.data.proposals.length === 1, "an accepted row is listed");
  assert(host2.State.data.proposals[0].id === keptId, "the accepted row keeps the id from the rejected attempt");
  assert(host2._status && host2._status.kind === "success", "an accepted row shows success");
  assert(W2._clearedDraft === true, "an accepted row clears the emergency draft");

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
