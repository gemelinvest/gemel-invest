/* פולו אפ ומד תהליך על קוביית ליד פעיל — בלי לשנות את מנוע השיוך.
   הרצה: node _test-campaign-lead-followup-meter.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
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
const css = read("app.css");
const html = read("index.html");
const sw = read("service-worker.js");

const card = sliceBetween(app, "return `<div class=\"lcSplitCard", "}).join(\"\");");
const followBtn = sliceBetween(app, "function campaignLeadFollowUpBtnHtml(lead){", "function campaignLeadProcessMeterHtml(lead){");
const leadInbox = sliceBetween(app, "const CampaignLeadAssignInbox = {", "const CampaignAgentLeadWatcher = {");
const notifyAssigned = sliceBetween(leadInbox, "notifyAssigned(ev){", "notifyLeadRow(row, options = {}){");
const notifyFollowUp = sliceBetween(leadInbox, "notifyFollowUp(ev){", "async flushForCurrentUser(){");
const assignPush = sliceBetween(app, "function pushCampaignLeadAssignInboxEntry(entry){", "function pushCampaignLeadFollowUpInboxEntry(entry){");
const followPush = sliceBetween(app, "function pushCampaignLeadFollowUpInboxEntry(entry){", "const GI_CAMPAIGN_LEAD_INBOX_NOTIFY_MAX_AGE_MS");
const syncAssign = sliceBetween(leadInbox, "syncAssignNotice(entry){", "syncFollowUpNotice(entry){");
const flushStart = leadInbox.indexOf("async flushForCurrentUser(){");
const flush = flushStart >= 0 ? leadInbox.slice(flushStart) : "";

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-campaign-lead-followup-meter.js")]).status === 0, "node --check this test");

console.log("\n2) כרטיס ליד");
assert(followBtn.includes(">פולו אפ</button>"), "כפתור פולו אפ בקובייה");
assert(card.includes("campaignLeadFollowUpBtnHtml(lead)"), "הכפתור ליד השיוך");
assert(card.includes("campaignLeadReassignBtnHtml(lead.id)"), "כפתור השיוך נשאר");
assert(card.includes("campaignLeadProcessMeterHtml(lead)"), "מד תהליך על הקובייה");
assert(card.includes('lcSplitCard__rowLabel">נציג'), "שורת נציג");
assert(card.includes("lcSplitCard__row lcSplitCard__row--beside"), "נציג ותאריך צמודים");
assert((card.match(/lcSplitCard__row--beside/g) || []).length === 2, "רק נציג ותאריך צמודים");
assert(card.includes('lcSplitCard__rowLabel">טלפון'), "שורת טלפון נשארת");
assert(!card.includes('lcSplitCard__row lcSplitCard__row--beside">\n      ${phoneIcon}'), "הטלפון לא הוצמד");
assert(app.includes('labels = ["נפתח", "בהצעה ללקוח", "נסגר"]'), "שלושת שלבי המד");
assert(app.includes("הליד נפתח"), "כיתוב פתיחה");
assert(app.includes("פרמיה שנסגרה"), "כיתוב פרמיה");
assert(app.includes("function stampCampaignLeadClosedPremium(lead, monthly){"), "חותמת פרמיה");
assert(app.includes('stampCampaignLeadProposalEvent(lead, "opened"'), "חותמת הצעה");

console.log("\n3) התראת פולו אפ לא נוגעת בשיוך");
assert(notifyAssigned.includes('title: "קבלת ליד חדש לטיפול"'), "כותרת שיוך נשארה");
assert(notifyAssigned.includes("this.markDelivered(leadId, agentId)"), "סימון מסירה של שיוך נשאר");
assert(!notifyAssigned.includes("התראה לליד פולואפ"), "כותרת פולו אפ לא נכנסה לשיוך");
assert(!notifyAssigned.includes("notifyFollowUp"), "שיוך לא קורא לפולו אפ");
assert(notifyFollowUp.includes('title: "התראה לליד פולואפ"'), "כותרת פולו אפ");
assert(notifyFollowUp.includes("playGiLeadNotifySequence("), "אותו צלצול");
assert(notifyFollowUp.includes('label: "פתח ליד"'), "פתיחת אותו ליד");
assert(notifyFollowUp.includes("this.markFollowUpDelivered(entryId)"), "מסירה לפי אירוע");
assert(!notifyFollowUp.includes("markDelivered(leadId, agentId)"), "פולו אפ לא שורף את מפתח השיוך");
assert(assignPush.includes("safeTrim(e.noticeKind) === \"followup\""), "שיוך לא מוחק פולו אפ");
assert(assignPush.includes("safeTrim(e.leadId) === safeTrim(next.leadId) && safeTrim(e.targetAgentId) === safeTrim(next.targetAgentId)"), "כפילות שיוך עדיין נחסמת");
assert(followPush.includes('noticeKind: "followup"'), "רשומת פולו אפ מסומנת");
assert(!followPush.includes("safeTrim(e.leadId) === safeTrim(next.leadId) && safeTrim(e.targetAgentId)"), "פולו אפ לא מחליף שיוך");
assert(syncAssign.includes("pushCampaignLeadAssignInboxEntry(normalized)"), "שיוך עדיין נכנס למנוע הקיים");
assert(!syncAssign.includes("pushCampaignLeadFollowUpInboxEntry"), "שיוך לא עובר לנתיב פולו אפ");
assert(flush.includes('safeTrim(ev?.noticeKind) === "followup"'), "התיבה מזהה פולו אפ לפני שיוך");
assert(flush.includes("this.notifyAssigned(ev)"), "התיבה עדיין מתריעה על שיוך");
assert(flush.indexOf('noticeKind) === "followup"') < flush.indexOf("this.notifyAssigned(ev)"), "פולו אפ לא נבלע במפתח השיוך");

console.log("\n4) עיצוב וגרסה");
assert(css.includes(".lcSplitCard__row--beside .lcSplitCard__val"), "צמידות נציג ותאריך");
assert(css.includes(".lcLeadMeter__step.is-done"), "שלב שהושלם");
assert(css.includes(".lcSplitCard__actions .lcLeadFollowBtn"), "שני הכפתורים באותה שורה");
assert(html.includes("giLeadMeter=2"), "גרסת דפדפן");
assert(sw.includes("lead-meter-v2"), "גרסת מטמון");
const meter = sliceBetween(app, "function campaignLeadProcessMeterHtml(lead){", "function handleCampaignLeadFollowBtn(btn){");
assert(meter.includes("statusClosed"), "סטטוס נסגר מדליק את שלב נסגר");
assert(meter.includes("premium > 0 || statusClosed"), "השלב השלישי נסגר גם בלי פרמיה");
assert(meter.includes("הליד נסגר"), "כיתוב הסגירה מופיע על הקובייה");
const split = sliceBetween(app, "splitFilteredLeads(){", "renderSplitLeads(){");
assert(split.includes("ליד שנסגר נשאר בקובייה של הסוקרת"), "הקובייה לא מסתירה ליד סגור");
assert(!split.includes("campaignLeadIsOpenInInbox"), "מסנן חדשים לא מוריד סטטוס נסגר");
assert(app.includes("applySurveyorLeadRow(row)"), "עדכון סטטוס מגיע למסך הסוקרת");

console.log("\n5) לחיצה על נסגר נראית אצל הסוקרת");
const meterBox = {
  safeTrim(value){ return String(value == null ? "" : value).trim(); },
  escapeHtml(value){ return String(value == null ? "" : value); },
  campaignLeadMoneyNumber(value){
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
};
vm.createContext(meterBox);
vm.runInContext(meter + "\nthis.html = campaignLeadProcessMeterHtml(lead);", Object.assign(meterBox, {
  lead: { status: "closed", proposalOpenedAt: "2026-11-22T08:00:00.000Z" }
}));
assert(meterBox.html.includes("is-done") && (meterBox.html.match(/is-done/g) || []).length === 3, "שלושת השלבים נסגרים כשהסטטוס נסגר");
assert(meterBox.html.includes("הליד נסגר"), "הכיתוב הוא נסגר ולא נשאר על ההצעה");
assert(!meterBox.html.includes("בהצעה ללקוח</div>"), "אין כיתוב הצעה אחרי סגירה");
const openBox = {
  safeTrim(value){ return String(value == null ? "" : value).trim(); },
  escapeHtml(value){ return String(value == null ? "" : value); },
  campaignLeadMoneyNumber(){ return 0; }
};
vm.createContext(openBox);
vm.runInContext(meter + "\nthis.html = campaignLeadProcessMeterHtml(lead);", Object.assign(openBox, {
  lead: { status: "in_progress", proposalOpenedAt: "2026-11-22T08:00:00.000Z" }
}));
assert((openBox.html.match(/is-done/g) || []).length === 2, "בלי נסגר השלב השלישי נשאר פתוח");
assert(openBox.html.includes("בהצעה ללקוח"), "ליד פתוח עדיין מציג הצעה");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
