/* לחיצה כפולה על שמירת ליד לא יוצרת כמה כרטיסים.
   הרצה: node _test-lead-save-burst-lock.js
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const saveStart = app.indexOf("saveSelected(){");
const saveEnd = app.indexOf("async _persistSelectedLead(existing, next, meta = {}){", saveStart);
const saveBlock = saveStart >= 0 && saveEnd > saveStart ? app.slice(saveStart, saveEnd) : "";
const persistStart = app.indexOf("async _persistSelectedLead(existing, next, meta = {}){");
const persistEnd = app.indexOf("async simulateInbound(){", persistStart);
const persistBlock = persistStart >= 0 && persistEnd > persistStart ? app.slice(persistStart, persistEnd) : "";

console.log("1) syntax + lock");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js");
assert(saveBlock.includes("if(this._leadSaveLock) return;"), "שמירה שנייה בזמן שהראשונה רצה לא נכנסת");
assert(saveBlock.includes("this._leadSaveLock = true;"), "הנעילה נסגרת לפני ההמתנה");
assert(saveBlock.includes('getElementById("btnCampaignLeadSave")'), "כפתור השמירה ננעל");
assert(saveBlock.includes(".finally("), "הנעילה משתחררת גם אם השמירה נכשלת");
assert(persistBlock.includes("collapseBurstDuplicates()"), "אחרי שמירה מקומית הכפילות הקצרה יורדת");
assert(persistBlock.includes("guardExistingNoticeForSave"), "בדיקת הלקוח הקיים נשארת");
assert(persistBlock.includes("beginNewLead({ skipListRender: true })"), "הטופס מתנקה אחרי הבדיקה");

const helperStart = app.indexOf("function campaignLeadIdentityKey(lead){");
const helperEnd = app.indexOf("function findCampaignLeadExistingNoticeLocal(options = {}){", helperStart);
const helpers = helperStart >= 0 && helperEnd > helperStart ? app.slice(helperStart, helperEnd) : "";
assert(helpers.includes("CAMPAIGN_LEAD_BURST_WINDOW_MS"), "חלון הזמן של הכפילות");

const sandbox = `
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function digitsOnly(v){ return String(v == null ? "" : v).replace(/\\D+/g, ""); }
  function normalizePhoneValue(v){
    let d = digitsOnly(v);
    if(d.startsWith("972") && d.length >= 11) d = "0" + d.slice(3);
    return d.slice(0, 10);
  }
  function normalizeIdValue(v){ return digitsOnly(v).slice(0, 9); }
  function isValidIsraeliPhone(v){
    const phone = normalizePhoneValue(v);
    if(!/^0\\d{8,9}$/.test(phone)) return false;
    return /^05\\d{8}$/.test(phone) || /^0(?:2|3|4|8|9)\\d{7}$/.test(phone) || /^07\\d{8}$/.test(phone);
  }
  function parseCampaignLeadStampMs(raw){
    const ms = new Date(String(raw || "")).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  ${helpers}
  this.api = { campaignLeadIdentityKey, campaignLeadBurstDuplicateIds, campaignLeadMergeBurstDocs, CAMPAIGN_LEAD_BURST_WINDOW_MS };
`;
const ctx = {};
vm.runInNewContext(sandbox, ctx);
const api = ctx.api;

console.log("\n2) אילעי נשמר פעם אחת");
const base = "2026-10-07T09:40:00.000Z";
const burst = [
  { id: "cl_a", phone: "0506828784", idNumber: "200032152", createdAt: base, description: "רכב", status: "new" },
  { id: "cl_b", phone: "050-682-8784", idNumber: "200032152", createdAt: "2026-10-07T09:40:01.200Z", description: "", callNote: "לחזור", status: "new" },
  { id: "cl_c", phone: "0506828784", idNumber: "200032152", createdAt: "2026-10-07T09:40:02.400Z", status: "new" }
];
const drop = api.campaignLeadBurstDuplicateIds(burst);
assert(drop.length === 2 && drop.indexOf("cl_a") < 0, "נשאר המקור, שני העותקים מסומנים למחיקה");
assert(drop.indexOf("cl_b") >= 0 && drop.indexOf("cl_c") >= 0, "שני העותקים המאוחרים יורדים");
const merged = api.campaignLeadMergeBurstDocs(burst[0], burst[1]);
assert(merged.description === "רכב" && merged.callNote === "לחזור", "תיעוד מהעותק עובר למקור אם חסר שם");
assert(api.campaignLeadMergeBurstDocs(merged, burst[2]) === merged, "בלי תיעוד חדש המקור לא משתנה");

const later = api.campaignLeadBurstDuplicateIds([
  burst[0],
  { id: "cl_next", phone: "0506828784", idNumber: "200032152", createdAt: "2026-10-08T09:40:00.000Z", status: "new" }
]);
assert(later.length === 0, "ליד של יום אחר עם אותה תעודה לא נמחק");

const other = api.campaignLeadBurstDuplicateIds([
  burst[0],
  { id: "cl_other", phone: "0521111111", idNumber: "111111111", createdAt: "2026-10-07T09:40:01.000Z", status: "new" }
]);
assert(other.length === 0, "לקוח אחר לא נחשב כפל");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
