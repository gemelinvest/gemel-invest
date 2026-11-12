/**
 * A cross-department assignee, including an elementary user, receives the lead.
 * The primary agent stays the primary agent. Run: node _test-cross-dept-lead-delivery.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start + startMark.length);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = read("app.js");
const push = read("supabase/functions/onyx-phone-push/index.ts");

console.log("1) my leads shows a cross-department lead on the assignment day");
const dayFns = sliceBetween(
  app,
  "function parseCampaignLeadStampMs(raw){",
  "function campaignLeadHasAdditionalAgentId(lead, agentId){"
);
const dayBox = { console };
vm.runInNewContext("const safeTrim = (v) => String(v ?? \"\").trim();\n" + dayFns, dayBox);
const lead = {
  createdAt: "2026-11-07T10:00:00.000Z",
  additionalAgents: [{ id: "elem1", name: "אילן איילין", assignedAt: "2026-11-08T08:00:00.000Z" }]
};
assert(typeof dayBox.campaignLeadVisibleOnMyLeadsDay === "function", "day visibility helper exists");
if(typeof dayBox.campaignLeadVisibleOnMyLeadsDay === "function"){
  const show = dayBox.campaignLeadVisibleOnMyLeadsDay;
  assert(show(lead, "2026-11-08", { id: "elem1" }) === true, "the assignee sees the lead on the assignment day");
  assert(show(lead, "2026-11-08", { id: "stale", name: "אילן איילין" }) === true, "the assignee sees the lead when the stored id is a different record of the same name");
  assert(show(lead, "2026-11-08", { id: "primary" }) === false, "the primary agent does not gain the lead on that day");
  assert(show(lead, "2026-11-07", { id: "primary" }) === true, "the primary agent still sees the creation day");
  assert(show(lead, "2026-11-07", { id: "elem1" }) === true, "the assignee still sees the creation day");
  assert(show(lead, "ALL", { id: "elem1" }) === true, "all dates stays open");
}
const myLeadsDay = sliceBetween(
  app,
  'dayFilter: "",      // YYYY-MM-DD; empty = today; "ALL" = all time',
  "_syncDayInput(){"
);
assert(myLeadsDay.includes("campaignLeadVisibleOnMyLeadsDay"), "my leads uses the assignment-day helper");

console.log("\n2) the assignment notice arrives even when the local clock is newer");
const apply = sliceBetween(app, "function applyRemoteMetaInboxScopes(remoteMeta){", "function getDashboardScopeLabelHe(kind){");
const campaignAt = apply.indexOf('metaSyncIsNewer(remoteMeta, State.data.meta, "campaignInbox")');
const campaignBlock = campaignAt >= 0 ? apply.slice(campaignAt, apply.indexOf("if(changed){", campaignAt)) : "";
assert(campaignBlock.includes("campaignLeadAssignInboxMatchesCurrentUser"), "a newer local clock still accepts this user's assignment");
assert(campaignBlock.includes("incomingMine.length"), "an incoming assignment is enough to apply the inbox");
assert(apply.includes("proposalAssignInboxMatchesCurrentUser"), "proposal inbox matching stays");

console.log("\n3) the phone rings for the additional assignee");
function stripTypes(src){
  return src
    .replace(/const items: Array<\{[\s\S]*?\}>/g, "const items")
    .replace(/: string\[\]/g, "")
    .replace(/: Json\[\]/g, "")
    .replace(/: Json/g, "")
    .replace(/: unknown/g, "")
    .replace(/: number/g, "")
    .replace(/ as Json/g, "");
}
const leadMeta = stripTypes(sliceBetween(push, "function leadMeta(description", "function moneyText(value"));
const alerts = stripTypes(sliceBetween(push, "function assignmentAlerts(rows", "async function claim(sb"));
const phoneBox = {};
vm.runInNewContext(
  "const ASSIGN_LOOKBACK_MS = 8 * 60 * 60 * 1000;\nconst PHONE_URL = 'https://gemelinvest.github.io/gemel-invest/phone/';\nfunction trim(value){ return String(value == null ? '' : value).trim(); }\n"
  + leadMeta + "\n" + alerts + "\nthis.assignmentAlerts = assignmentAlerts;",
  phoneBox
);
const now = Date.parse("2026-11-08T12:00:00.000Z");
const rows = phoneBox.assignmentAlerts([
  {
    id: "lead1",
    assigned_agent_id: "primary",
    customer_name: "לקוח",
    updated_at: "2026-11-08T11:00:00.000Z",
    description: "פנייה\n---LEAD_META_JSON---\n" + JSON.stringify({
      additionalAgents: [{ id: "elem1", name: "אילן איילין" }, { id: "primary", name: "מקור" }]
    })
  },
  {
    id: "elder",
    assigned_agent_id: "__ELDERLY__",
    customer_name: "מבוגר",
    updated_at: "2026-11-08T11:00:00.000Z",
    description: ""
  }
], now);
const ids = rows.map((row) => row.agentId).sort();
assert(ids.indexOf("elem1") >= 0 && ids.indexOf("primary") >= 0, "both the primary and the additional assignee are notified");
assert(ids.filter((id) => id === "primary").length === 1, "the primary assignee is notified once");
assert(ids.indexOf("__ELDERLY__") < 0, "the elderly bucket is not notified");
const recent = sliceBetween(push, "const sinceAssign", "if (!recent.error");
assert(recent.includes("description"), "the assignment query reads the cross-department note");

console.log("\n4) the computer asks for the lead by id and by name");
const patternSrc = sliceBetween(
  app,
  "function campaignLeadDescriptionIlikePattern(fragment){",
  "function campaignLeadMineDescriptionPatterns(){"
);
const patternBox = {};
vm.runInNewContext("const safeTrim = (v) => String(v ?? \"\").trim();\n" + patternSrc, patternBox);
const idPattern = patternBox.campaignLeadDescriptionIlikePattern('"id":"a_1"');
assert(idPattern === '%"id":"a\\_1"%', "an underscore in the agent id is a literal character");
assert(app.includes("campaignLeadMineDescriptionPatterns()"), "my leads fetches the signed-in agent's description patterns");
assert(app.includes("\"name\":\"' + n + '\""), "my leads also fetches a lead stored under the agent name");
assert(app.includes("Storage.verifySavedRow("), "a peer assignment checks that the extra agent was saved");
const pickSrc = sliceBetween(
  app,
  "function campaignLeadPeerNameKey(value){",
  "function campaignLeadPeerDeptForName(name){"
);
const pickBox = {};
vm.runInNewContext("const safeTrim = (v) => String(v ?? \"\").trim();\n" + pickSrc, pickBox);
const picked = pickBox.campaignLeadPickPeerAgent([
  { id: "old", name: "אילן איילין", active: false },
  { id: "user-only", username: "אילן איילין", name: "אחר", active: true },
  { id: "live", name: "אילן איילין", active: true }
], "אילן איילין");
assert(picked && picked.id === "live", "שיוך לנציג chooses the active אילן איילין");
assert(app.includes("const found = byId || byLabel;"), "the signed-in agent id wins over an earlier duplicate name");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
