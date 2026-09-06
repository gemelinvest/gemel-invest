/* GI-PROPOSAL-ASSIGN-LIVE 2026-09-06
   שיוך הצעה לנציג מגיע מיד לרשימה + הודעה, בלי יציאה וכניסה.
   הרצה: node _test-proposal-assign-live.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260906-ops-agent-all-cust-v1";
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");
const wiz = read("gi-wizard.js");

const inboxBlock = sliceBetween(
  app,
  "function normalizeProposalAssignInboxEntry(raw){",
  "function normalizeCustomerAssignInboxEntry(raw){"
);
const applyInbox = sliceBetween(
  app,
  "function applyRemoteMetaInboxScopes(remoteMeta){",
  "function getDashboardScopeLabelHe(kind){"
);
const watcherTick = sliceBetween(
  app,
  "async lightTick(){",
  "function showLeadTransferAnimation(agentName, options = {}){"
);
const assignConfirm = sliceBetween(
  app,
  "const AssignProposalModal = {",
  "const AssignCustomerModal = {"
);

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-proposal-assign-live.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app.js wizard version");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard build tag");

console.log("\n2) שיוך מושך את ההצעה לזיכרון הנציג");
assert(!!inboxBlock, "ProposalAssignInbox block found");
assert(inboxBlock.includes("async pullIntoSession(proposalId){"), "pullIntoSession helper");
assert(inboxBlock.includes('Storage.ensureRecordPayload("proposals", id)'), "pull uses ensureRecordPayload");
assert(inboxBlock.includes("Storage.loadSingleRow(SUPABASE_TABLES.proposals, id"), "pull falls back to a single-row fetch");
assert(inboxBlock.includes("Storage.mergeProposalsDelta"), "light row is merged into the working set");
assert(inboxBlock.includes("handleInboxMetaArrival(){"), "meta-arrival hook");
assert(inboxBlock.includes("void this.flushForCurrentUser()"), "arrival hook flushes immediately");
assert(inboxBlock.includes("ProposalsUI.render"), "list re-renders after ingest");
assert(inboxBlock.includes("keep.push(ev)"), "failed pulls stay in the inbox for retry");
assert(inboxBlock.includes("ready.push(ev)"), "successful pulls are notified");

console.log("\n3) הודעה מיידית לנציג");
assert(inboxBlock.includes('title: "שויכה לך הצעה"'), "toast title");
assert(inboxBlock.includes('DesktopNotifications?.notify?.("שויכה לך הצעה"'), "desktop notification");
assert(inboxBlock.includes('label: "פתח הצעה"'), "toast action opens the proposal");
assert(inboxBlock.includes("openProposal(proposalId){"), "open helper");
assert(inboxBlock.includes('UI.goView("proposals")'), "open switches to the proposals view");
assert(inboxBlock.includes("ProposalsUI.openById"), "open loads the proposal");
assert(inboxBlock.includes("singletonKey: tag"), "toast is not duplicated");
assert(!inboxBlock.includes('title: "התקבלה הצעה חדשה"'), "old delayed-login toast title removed from inbox");

console.log("\n4) מסירה חיה — לא מחכים לכניסה מחדש");
assert(applyInbox.includes("ProposalAssignInbox.handleInboxMetaArrival()"), "meta realtime copies inbox then pulls immediately");
assert(watcherTick.includes("ProposalAssignInbox.flushForCurrentUser()"), "15s meta watcher also flushes proposal inbox");
assert(app.includes("try { void ProposalAssignInbox.flushForCurrentUser(); } catch(_e) {}"), "LiveRefresh still flushes");
assert(assignConfirm.includes("הנציג יראה אותה מיד"), "manager success toast says immediately");
assert(!assignConfirm.includes("אחרי רענון/כניסה"), "manager toast no longer asks for re-login");
assert(html.includes("שויכה לך הצעה"), "assign modal hint names the agent toast");
assert(html.includes("בלי לצאת מהמערכת"), "assign modal hint no longer requires logout");

console.log("\n5) runtime — pull + toast for the assigned agent");
function safeTrim(v){
  return String(v == null ? "" : v).trim();
}
function nowISO(){ return "2026-09-06T12:00:00.000Z"; }
const sandbox = {
  console,
  Auth: { current: { id: "agent-1", name: "דני נציג" } },
  State: {
    data: {
      meta: { proposalAssignInbox: [{
        id: "pbinv_1",
        targetAgentId: "agent-1",
        targetAgentName: "דני נציג",
        fromName: "מנהל",
        proposalId: "prop-99",
        proposalLabel: "אביב פרץ",
        at: nowISO()
      }] },
      proposals: []
    }
  },
  Storage: {
    ensureRecordPayload: async (kind, id) => {
      sandbox._ensured = { kind, id };
      const rec = { id, fullName: "אביב פרץ", agentId: "agent-1" };
      sandbox.State.data.proposals = [rec];
      return { ok: true, record: rec };
    },
    loadSingleRow: async () => ({ ok: false }),
    mergeProposalsDelta(){}
  },
  SUPABASE_TABLES: { proposals: "proposals" },
  PROPOSAL_LIGHT_COLUMNS: "id,agent_id",
  App: { persist: async () => { sandbox._persisted = true; return { ok: true }; } },
  ProposalsUI: { render(){ sandbox._rendered = true; }, openById(){ sandbox._opened = true; } },
  UI: { goView(v){ sandbox._view = v; } },
  window: { showToast(opts){ sandbox._toasts.push(opts); }, setTimeout(fn){ fn(); } },
  DesktopNotifications: { notify(){ sandbox._desktop = true; } },
  findAgentRecordForSession: () => ({ id: "agent-1", name: "דני נציג" }),
  bumpMetaSyncClock(meta){ return meta; },
  safeTrim,
  nowISO,
  Math,
  Date,
  String,
  Array,
  Object,
  Number,
  JSON,
  _ensured: null,
  _persisted: false,
  _rendered: false,
  _opened: false,
  _view: "",
  _toasts: [],
  _desktop: false
};
sandbox.window = sandbox.window;
vm.runInNewContext(
  inboxBlock + "\nthis.ProposalAssignInbox = ProposalAssignInbox;\nthis.proposalAssignInboxMatchesCurrentUser = proposalAssignInboxMatchesCurrentUser;\n",
  sandbox,
  { filename: "proposal-assign-inbox.js" }
);

(async () => {
  const G = sandbox.ProposalAssignInbox;
  assert(typeof G.flushForCurrentUser === "function", "flush is callable");
  assert(sandbox.proposalAssignInboxMatchesCurrentUser({ targetAgentId: "agent-1" }), "inbox matches the assigned agent id");
  assert(!sandbox.proposalAssignInboxMatchesCurrentUser({ targetAgentId: "other" }), "inbox does not match a different agent");
  await G.flushForCurrentUser();
  assert(sandbox._ensured && sandbox._ensured.id === "prop-99", "flush pulls the assigned proposal by id");
  assert(sandbox.State.data.proposals.some((p) => p.id === "prop-99"), "proposal is in the agent working set");
  assert(sandbox._rendered === true, "proposals list re-renders");
  assert(sandbox._toasts.length === 1 && sandbox._toasts[0].title === "שויכה לך הצעה", "agent toast says the proposal was assigned");
  assert(String(sandbox._toasts[0].text).includes("אביב פרץ"), "toast names the proposal");
  assert(sandbox._desktop === true, "desktop notification fired");
  assert(sandbox._persisted === true, "processed inbox is cleared on the server");
  sandbox.State.data.meta.proposalAssignInbox = [{
    id: "pbinv_2",
    targetAgentId: "agent-1",
    proposalId: "prop-missing",
    proposalLabel: "חסרה",
    at: nowISO()
  }];
  sandbox.Storage.ensureRecordPayload = async () => ({ ok: false });
  sandbox._toasts = [];
  sandbox._persisted = false;
  await G.flushForCurrentUser();
  assert(sandbox.State.data.meta.proposalAssignInbox.some((e) => e.proposalId === "prop-missing"), "failed pull is kept for retry");
  assert(sandbox._toasts.length === 0, "no toast when the proposal was not loaded");
  assert(sandbox._persisted === false, "inbox is not cleared when the pull failed");

  console.log(failed ? ("\nFAIL  passed=" + passed + " failed=" + failed) : ("\nOK  passed=" + passed + " failed=0"));
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
