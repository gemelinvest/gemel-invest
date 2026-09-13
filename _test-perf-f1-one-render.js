/**
 * F1.0 contract: persist/referral fan-out paints the visible view once.
 * Run: node _test-perf-f1-one-render.js
 */
const fs = require("fs");
const app = fs.readFileSync("app.js", "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(app.includes("function scheduleVisibleViewRender"), "missing scheduler");
assert(app.includes("GI-PERF F1.0"), "missing F1.0 comment");
assert(app.includes("LiveRefresh.renderActiveView()"), "scheduler must reuse LiveRefresh");

const reasons = [
  "health-premium-recovered",
  "elem-agent-setup",
  "elem-mirror-status",
  "elem-policies-activated",
  "elem-ops-touch",
  "elem-proposal-ready",
  "elem-handling",
  "elem-quote-sent"
];
for (const reason of reasons) {
  assert(app.includes('scheduleVisibleViewRender("' + reason + '")'), "missing schedule " + reason);
}

assert(!/persistElementaryReferralsQuiet\("הנציג השלים הקמת הצעה[^"]*"\);\s*try \{ ProposalsUI\.render/.test(app),
  "agent-setup must not fan-out ProposalsUI.render");
assert(!/persistElementaryReferralsQuiet\("הצעה הוכנה[^"]*"\);\s*try \{ ProposalsUI\.render/.test(app),
  "proposal-ready must not fan-out ProposalsUI.render");
assert(!/persistElementaryReferralsQuiet\("נשלחה הצעת מחיר לנציג"\);\s*try \{ ProposalsUI\.render/.test(app),
  "quote-sent must not fan-out ProposalsUI.render");

assert(app.includes('on(this.els.proposalsSearch, "input", perfDebounce(() => ProposalsUI.render(), 250))'),
  "must keep explicit search render on the visible proposals list");
assert(app.includes('client.rpc("gi_verify_agent_login"'), "must not touch login RPC");
assert(app.includes("AGENT_PUBLIC_COLUMNS"), "must keep public agent columns");

console.log("OK _test-perf-f1-one-render.js");
