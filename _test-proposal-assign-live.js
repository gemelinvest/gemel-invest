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
const TAG = "20260906-mirror-script-premiums-v1";
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
assert(inboxBlock.includes("scheduleRetry(){"), "failed pull schedules a retry");
assert(inboxBlock.includes("handleRealtimeProposal(payload){"), "proposal row realtime ingest");
assert(inboxBlock.includes("const ProposalAssignWatcher = {"), "dedicated assign watcher exists");
assert(inboxBlock.includes("gi-proposal-assign-"), "watcher channel is independent of campaign leads");
assert(!/const ProposalAssignWatcher = \{[\s\S]*canAccessCampaignMyLeads/.test(inboxBlock), "assign watcher is not gated on campaign access");

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
assert(applyInbox.includes("incomingMine"), "inbox is merged even when local meta clock is newer");
assert(assignConfirm.includes("metaOnly: true"), "manager persist is meta-only so the click does not freeze");
assert(assignConfirm.includes('metaSyncScopes: ["proposalInbox"]'), "manager persist scopes the inbox clock");
assert(assignConfirm.includes("skipNormalize: true"), "manager persist skips full normalize");
assert(assignConfirm.includes("this._busy = true"), "assign click is locked against double submit");
assert(assignConfirm.includes("משיוך…"), "confirm button shows in-progress label");
assert(watcherTick.includes("ProposalAssignInbox.flushForCurrentUser()"), "15s meta watcher also flushes proposal inbox");
assert(app.includes("try { void ProposalAssignInbox.flushForCurrentUser(); } catch(_e) {}"), "LiveRefresh still flushes");
assert(app.includes("ProposalAssignWatcher.start()"), "assign watcher starts with the logged-in session");
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
    mergeProposalsDelta(rows){
      (rows || []).forEach((row) => {
        const rec = {
          id: row.id,
          fullName: row.full_name || row.fullName || "",
          agentId: row.agent_id || row.agentId || "",
          agentName: row.agent_name || row.agentName || ""
        };
        sandbox.State.data.proposals = sandbox.State.data.proposals.filter((p) => p.id !== rec.id).concat([rec]);
      });
    }
  },
  SUPABASE_TABLES: { proposals: "proposals" },
  PROPOSAL_LIGHT_COLUMNS: "id,agent_id",
  App: { persist: async () => { sandbox._persisted = true; return { ok: true }; } },
  ProposalsUI: { render(){ sandbox._rendered = true; }, openById(){ sandbox._opened = true; } },
  UI: { goView(v){ sandbox._view = v; } },
  window: { showToast(opts){ sandbox._toasts.push(opts); }, setTimeout(fn, ms){ sandbox._timeouts.push(Number(ms) || 0); } },
  DesktopNotifications: { notify(){ sandbox._desktop = true; } },
  findAgentRecordForSession: () => ({ id: "agent-1", name: "דני נציג" }),
  customerOwnedByCurrentAgent: (rec) => sandbox.safeTrim(rec?.agentId) === "agent-1",
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
  _desktop: false,
  _timeouts: []
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
  assert(sandbox._timeouts.some((ms) => ms >= 1000), "failed pull schedules a delayed retry");

  sandbox._toasts = [];
  sandbox._rendered = false;
  G.handleRealtimeProposal({
    new: { id: "prop-live", agent_id: "agent-1", full_name: "ליאור כהן", agent_name: "דני נציג" },
    old: { id: "prop-live", agent_id: "other-agent" }
  });
  assert(sandbox.State.data.proposals.some((p) => p.id === "prop-live"), "realtime row is merged into the agent list");
  assert(sandbox._toasts.some((t) => t.title === "שויכה לך הצעה" && String(t.text).includes("ליאור כהן")), "realtime assign toasts without waiting for inbox");
  assert(sandbox._rendered === true, "realtime assign re-renders the proposals list");

  console.log(failed ? ("\nFAIL  passed=" + passed + " failed=" + failed) : ("\nOK  passed=" + passed + " failed=0"));
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
