/* פרמיית ליד אחרי סיום הקמת לקוח באשף בריאות וסיכונים.
   הרצה: node _test-lead-proposal-premium.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

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

function extractFunction(src, name){
  const start = src.indexOf("function " + name + "(");
  if(start < 0) return "";
  const sig = src.indexOf("){", start);
  if(sig < 0) return "";
  const brace = sig + 1;
  let depth = 0;
  for(let i = brace; i < src.length; i++){
    if(src[i] === "{") depth += 1;
    else if(src[i] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const wizard = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

const moneyFn = extractFunction(app, "campaignLeadMoneyNumber");
const rowsFn = extractFunction(app, "buildCampaignPremiumDayRows");
const findFn = extractFunction(app, "findCampaignLeadForHealthFinish");
const stampFn = extractFunction(app, "stampCampaignLeadSubmittedPremium");
const refreshFn = extractFunction(app, "refreshSubmittedPremiumSurfaces");
assert(stampFn.includes("refreshSubmittedPremiumSurfaces"), "finish refreshes only the open screen");
assert(!stampFn.includes("renderDailySalesPage"), "finish does not rebuild the sales page");
assert(refreshFn.includes("campaignLeads") && refreshFn.includes("dailySales"), "refresh is limited to the visible view");
const paintStart = app.indexOf("paintDailySalesCampaignPremium(dateKey)");
const paintEnd = app.indexOf("renderReferentLeadBoard()", paintStart);
assert(paintStart > 0 && paintEnd > paintStart && !app.slice(paintStart, paintEnd).includes("renderDailySalesPage"), "lead fetch repaints only the campaign block");
assert(moneyFn.includes("return 0"), "money helper drops non-positive amounts");
assert(rowsFn.includes("proposalPremiumMonthly"), "day rows read monthly premium");
assert(rowsFn.includes("proposalPremiumAnnual"), "day rows read annual premium");
assert(findFn.includes("campaignLeadAgentAccess"), "lead match requires the assigned agent");
assert(wizard.includes("stampCampaignLeadSubmittedPremium"), "health finish stamps the lead premium");
assert(wizard.includes("if(preferredLeadId || (!this.isElementaryFlow() && saved?.id))"), "stamp runs only after a health customer finish");
assert(!wizard.includes("isElementaryFlow() && saved?.id){\n          try {\n            await stampCampaignLeadSubmittedPremium"), "elementary finish does not stamp premium");
assert(html.includes('id="dailySalesCampaignPremium"'), "sales screen has a campaign premium block");
assert(app.includes("renderReferentLeadBoard"), "surveyor dashboard renders her lead board");
assert(app.includes("campaignLeadSubmittedPremiumHtml(lead)"), "lead cubes render the submitted premium");

const sandbox = {
  safeTrim(value){ return String(value == null ? "" : value).trim(); },
  parseCampaignLeadStampDateIL(raw){ return String(raw || "").slice(0, 10); },
  campaignLeadFinishAgentRecord(){ return { id: "ag1", name: "דנה" }; },
  collectCustomerIdentityIds(){ return new Set(["208827261"]); },
  isElderlyCampaignLead(lead){ return lead.assignedAgentId === "__ELDERLY__"; },
  campaignLeadAgentAccess(lead, agent){ return String(lead.assignedAgentId) === String(agent.id); },
  normalizeIdValue(value){ return String(value || "").replace(/\D/g, ""); },
  parseCampaignLeadStampMs(raw){ return Date.parse(raw) || 0; },
  CampaignLeadsStore: {
    leads: [
      { id: "other-agent", idNumber: "208827261", assignedAgentId: "ag2", updatedAt: "2026-10-15T12:00:00.000Z" },
      { id: "mine", idNumber: "208827261", assignedAgentId: "ag1", campaignId: "cmp_dan", campaignLabel: "קמפיין דן", proposalPremiumMonthly: 180, proposalPremiumAnnual: 2400, proposalPremiumAt: "2026-10-15T09:00:00.000Z", updatedAt: "2026-10-14T09:00:00.000Z" },
      { id: "preferred", idNumber: "208827261", assignedAgentId: "ag1", updatedAt: "2026-10-01T09:00:00.000Z" },
      { id: "yesterday", idNumber: "111111111", assignedAgentId: "ag1", campaignId: "cmp_dan", campaignLabel: "קמפיין דן", proposalPremiumMonthly: 50, proposalPremiumAt: "2026-10-14T09:00:00.000Z" },
      { id: "meitar", idNumber: "222222222", assignedAgentId: "ag1", campaignId: "cmp_meitar", campaignLabel: "קמפיין מיתר", proposalPremiumMonthly: 90, proposalPremiumAnnual: 0, proposalPremiumAt: "2026-10-15T11:00:00.000Z" }
    ]
  }
};
vm.createContext(sandbox);
vm.runInContext(moneyFn + "\n" + rowsFn + "\n" + findFn + "\nthis.__loaded = true;", sandbox);

const rows = sandbox.buildCampaignPremiumDayRows(sandbox.CampaignLeadsStore.leads, "2026-10-15");
assert(rows.length === 2, "same day keeps two campaigns");
const dan = rows.find((row) => row.key === "cmp_dan");
const meitar = rows.find((row) => row.key === "cmp_meitar");
assert(dan && dan.monthly === 180 && dan.annual === 2400 && dan.customers === 1, "health monthly and elementary annual stay separate");
assert(meitar && meitar.monthly === 90 && meitar.annual === 0, "a campaign without elementary shows only monthly");
assert(!rows.some((row) => row.monthly === 50), "another day is excluded");

const matched = sandbox.findCampaignLeadForHealthFinish({}, "preferred");
assert(matched && matched.id === "preferred", "preferred lead wins when the id and agent match");
const ambiguous = sandbox.findCampaignLeadForHealthFinish({}, "");
assert(ambiguous === null, "two open leads for the same id are not guessed");
sandbox.CampaignLeadsStore.leads = [
  { id: "closed-new", status: "closed", idNumber: "208827261", assignedAgentId: "ag1", updatedAt: "2026-10-15T18:00:00.000Z" },
  { id: "only-open", status: "in_progress", idNumber: "208827261", assignedAgentId: "ag1", updatedAt: "2026-10-01T09:00:00.000Z" },
  { id: "other-agent", idNumber: "208827261", assignedAgentId: "ag2", updatedAt: "2026-10-15T12:00:00.000Z" }
];
const single = sandbox.findCampaignLeadForHealthFinish({}, "");
assert(single && single.id === "only-open", "a single open lead is used instead of a newer closed lead");
const fromWizard = sandbox.findCampaignLeadForHealthFinish({}, "closed-new");
assert(fromWizard && fromWizard.id === "closed-new", "a lead opened from the wizard is kept even if it is closed");
sandbox.CampaignLeadsStore.leads = [
  { id: "only-closed", status: "closed", idNumber: "208827261", assignedAgentId: "ag1", updatedAt: "2026-10-15T18:00:00.000Z" }
];
const onlyClosed = sandbox.findCampaignLeadForHealthFinish({}, "");
assert(onlyClosed && onlyClosed.id === "only-closed", "a single closed lead still receives the sale stamp");

const note = "הלקוח ביקש בדיקת בריאות";
const metaFns = [
  "const CAMPAIGN_LEAD_META_TOKEN = \"---LEAD_META_JSON---\";",
  "const CAMPAIGN_LEAD_STATUS_LABELS = { new: \"חדש\", in_progress: \"בטיפול\", closed: \"נסגר\", irrelevant: \"לא רלוונטי\", no_answer: \"אין מענה\", agent_appointment: \"מינוי סוכן\" };",
  extractFunction(app, "normalizeCampaignLeadDescriptionText"),
  extractFunction(app, "findCampaignLeadMetaIndex"),
  extractFunction(app, "stripCampaignLeadMetaFromDescription"),
  extractFunction(app, "parseCampaignLeadMetaFromDescription"),
  extractFunction(app, "normalizeCampaignLeadAdditionalAgents"),
  extractFunction(app, "normalizeCampaignLead"),
  extractFunction(app, "mapCampaignLeadToDb")
].join("\n");
const metaBox = {
  safeTrim(value){ return String(value == null ? "" : value).trim(); },
  nowISO(){ return "2026-10-15T09:00:00.000Z"; },
  normalizePhoneValue(value){ return String(value || ""); },
  normalizeIdValue(value){ return String(value || "").replace(/\D/g, ""); },
  CampaignLeadsStore: { customerFieldsInDb: true }
};
vm.createContext(metaBox);
vm.runInContext(moneyFn + "\n" + metaFns + "\nthis.__meta = true;", metaBox);
const savedRow = metaBox.mapCampaignLeadToDb({
  id: "cl_note",
  phone: "0501234567",
  customerName: "יראת",
  description: note,
  campaignId: "cmp_dan",
  campaignLabel: "קמפיין דן",
  assignedAgentId: "ag1",
  assignedAgentName: "דנה",
  status: "in_progress",
  idNumber: "208827261",
  proposalPremiumMonthly: 180,
  proposalPremiumAnnual: 2400,
  proposalPremiumAt: "2026-10-15T09:00:00.000Z",
  createdAt: "2026-10-15T08:00:00.000Z",
  updatedAt: "2026-10-15T09:00:00.000Z"
});
const savedMeta = metaBox.parseCampaignLeadMetaFromDescription(savedRow.description);
assert(metaBox.stripCampaignLeadMetaFromDescription(savedRow.description) === note, "surveyor note survives the premium save");
assert(savedMeta.proposalPremiumMonthly === 180 && savedMeta.proposalPremiumAnnual === 2400, "saved meta keeps monthly and annual premiums apart");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
