/* פתיחת האשף אחרי «נסגר» לא דורסת את הסטטוס.
   הרצה: node _test-closed-lead-wizard-stamp.js
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
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-closed-lead-wizard-stamp.js")]).status === 0, "node --check this test");

console.log("\n2) האשף נפתח עם הליד שכבר נשמר כנסגר");
const closeFlow = sliceBetween(app, "async _processClose(closedNote){", "_openWizardWithLeadData(lead){");
const wizardOpen = sliceBetween(app, "_openWizardWithLeadData(lead){", "_removeOverlay(){");
assert(closeFlow.includes("status: \"closed\""), "השמירה הראשונה מסמנת נסגר");
assert(closeFlow.includes("this._openWizardWithLeadData(save.lead || lead)"), "האשף מקבל את השורה שנשמרה");
assert(wizardOpen.includes("stampCampaignLeadProposalEvent(lead, \"opened\""), "פתיחת האשף עדיין חותמת הצעה");
assert(html.includes("giClosedKeep=1"), "גרסת דפדפן");
assert(sw.includes("closed-keep-v1"), "גרסת מטמון");

console.log("\n3) חותמת האשף לא מחזירה ליד סגור לחדש");
const stampSrc = sliceBetween(app, "function campaignLeadRowForStamp(lead){", "function goldLeadMarkOpened(lead){");
assert(stampSrc.includes("function campaignLeadRowForStamp(lead){"), "החותמת נשענת על השורה בחנות");
assert(!stampSrc.includes("CampaignLeadsStore.upsert(lead)"), "החותמת לא שומרת את העותק שנמסר לה");

const box = {
  saved: null,
  Auth: { current: { id: "agent-1", name: "נציג" } },
  AgentFloorActivityUI: { scheduleRender(){} },
  CampaignLeadsUI: { scheduleListRender(){} },
  CampaignLeadsStore: {
    leads: [],
    upsert(lead){
      box.saved = { ...lead };
      const idx = this.leads.findIndex((row) => String(row.id) === String(lead.id));
      if(idx >= 0) this.leads[idx] = { ...lead };
      else this.leads.unshift({ ...lead });
      return Promise.resolve({ ok: true, lead });
    }
  },
  safeTrim(value){ return String(value == null ? "" : value).trim(); },
  nowISO(){ return "2026-11-22T09:05:00.000Z"; },
  campaignLeadMoneyNumber(value){
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  },
  campaignLeadAgentAccess(){ return true; }
};
vm.createContext(box);
vm.runInContext(stampSrc, box);

const stored = {
  id: "cl-closed",
  status: "closed",
  closedAt: "2026-11-22T09:00:00.000Z",
  closedNote: "נמכר ביטוח בריאות",
  phone: "0501234567",
  customerName: "דנה לוי",
  assignedAgentId: "agent-1",
  proposalOpenedAt: ""
};
const stale = {
  id: "cl-closed",
  status: "new",
  closedAt: "",
  closedNote: "",
  phone: "0501234567",
  customerName: "דנה לוי",
  assignedAgentId: "agent-1"
};
box.CampaignLeadsStore.leads = [{ ...stored }];
const opened = box.stampCampaignLeadProposalEvent(stale, "opened", {});
assert(opened === true, "חותמת פתיחה נרשמת");
assert(box.saved && box.saved.status === "closed", "השמירה השנייה נשארת נסגר");
assert(box.saved.closedNote === "נמכר ביטוח בריאות", "תיעוד הסגירה נשאר");
assert(box.saved.closedAt === stored.closedAt, "חותמת הסגירה נשארת");
assert(box.safeTrim(box.saved.proposalOpenedAt), "חותמת ההצעה נוספת");
assert(stale.status === "new", "העותק הישן לא הופך למקור");
assert(box.CampaignLeadsStore.leads[0].status === "closed", "החנות נשארת על נסגר");

box.saved = null;
const again = box.stampCampaignLeadProposalEvent(stale, "saved", { step: 3, proposalId: "prop-1" });
assert(again === true, "שמירת טיוטה נרשמת");
assert(box.saved.status === "closed", "טיוטה לא פותחת ליד סגור מחדש");
assert(box.saved.proposalStep === "3", "שלב האשף נשמר");
assert(box.saved.proposalId === "prop-1", "מזהה ההצעה נשמר");
assert(box.saved.closedNote === "נמכר ביטוח בריאות", "התיעוד נשאר גם בשמירת טיוטה");

box.saved = null;
const premium = box.stampCampaignLeadClosedPremium(stale, 180);
assert(premium === true, "פרמיה נרשמת");
assert(box.saved.status === "closed", "פרמיה לא משנה סטטוס נסגר");
assert(box.saved.proposalPremiumMonthly === 180, "סכום הפרמיה נשמר");

box.saved = null;
const openedStamp = box.stampCampaignLeadOpened(stale);
assert(openedStamp === true, "פתיחת ליד נרשמת");
assert(box.saved.status === "closed", "פתיחה לא מחזירה סטטוס חדש");
assert(box.safeTrim(box.saved.openedAt), "חותמת פתיחה נוספת");

const fresh = {
  id: "cl-fresh",
  status: "in_progress",
  phone: "0507654321",
  customerName: "יוסי כהן",
  assignedAgentId: "agent-1"
};
box.CampaignLeadsStore.leads = [];
box.saved = null;
const fallback = box.stampCampaignLeadProposalEvent(fresh, "opened", {});
assert(fallback === true, "בלי שורה בחנות נשמר הליד שנמסר");
assert(box.saved.status === "in_progress", "ליד בטיפול נשאר בטיפול");
assert(box.safeTrim(box.saved.proposalOpenedAt), "גם בלי שורה בחנות נרשמת הצעה");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
