/**
 * A lead fetch without a signed-in session must not look like the leads were deleted.
 * Run: node _test-my-leads-anon-session.js
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start + startMark.length);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

console.log("1) an empty token is a failed read, not an empty lead list");
const gateSrc = sliceBetween(
  app,
  "const CAMPAIGN_LEAD_READ_SESSION_ERROR = ",
  "function isValidIsraeliId(value){"
);
const box = {};
vm.runInNewContext("const safeTrim = (v) => String(v ?? \"\").trim();\n" + gateSrc, box);
const missing = box.campaignLeadReadSessionGate("");
const present = box.campaignLeadReadSessionGate("jwt");
assert(missing && missing.ok === false, "no token fails the gate");
assert(String(missing && missing.error).includes("הלידים לא נמחקו"), "the message says the leads were not deleted");
assert(!String(missing && missing.error).includes("אין לידים משויכים אליך"), "the message does not say no leads are assigned");
assert(present && present.ok === true, "a token passes the gate");

console.log("\n2) the fetch stops before it can replace the list");
const fetchSrc = sliceBetween(app, "async __fetchAllImpl(scope){", "applyLocal(lead){");
const gateAt = fetchSrc.indexOf("campaignLeadReadSessionGate(token)");
const loadAt = fetchSrc.indexOf("loadCampaignLeadRows");
const replaceAt = fetchSrc.indexOf("this.leads = this._mergeCampaignLeadFetchResults");
assert(gateAt >= 0 && loadAt > gateAt && replaceAt > loadAt, "the session gate runs before the list is replaced");
assert(fetchSrc.includes("return { ok: false, error: sessionGate.error }"), "a missing session returns a failure");
assert(fetchSrc.includes("openAgentSession(matched, pin, { once: true, sessionOnly: true })"), "one session retry uses the code still in memory");
assert(fetchSrc.includes("this._readSessionMissing = true"), "the screen can tell the session is missing");

console.log("\n3) my leads does not paint the empty-assignment sentence");
const renderSrc = sliceBetween(app, "const CampaignMyLeadsUI = {", "applyHighlight(){");
const missingAt = renderSrc.indexOf("CampaignLeadsStore._readSessionMissing");
const emptyAt = renderSrc.indexOf("אין לידים משויכים אליך");
assert(missingAt >= 0 && emptyAt > missingAt, "the missing-session branch is ahead of the empty sentence");
assert(renderSrc.includes("this.els.tbody.innerHTML = \"\""), "the list area stays blank");
const refreshSrc = sliceBetween(app, "async refresh(showToast){", "async render(){");
assert(refreshSrc.includes("this.showAlert(r.error"), "the existing alert shows the failure");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
