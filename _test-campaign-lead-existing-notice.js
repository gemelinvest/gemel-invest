/* GI-LEAD-EXISTING 2026-09-19
   התראת לקוח קיים במערכת לידים — ת״ז / טלפון בהקלדה.
   הרצה: node _test-campaign-lead-existing-notice.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260919-exist-pol-layout-v1";
const CSS_TAG = "20260919-exist-pol-layout-v1";
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
const css = read("app.css");
const html = read("index.html");
const sw = read("service-worker.js");

const helpers = sliceBetween(
  app,
  "function campaignLeadExistingNoticeMatchKey(kind, value){",
  "function ensureBuiltinCampaignLines(list){"
);
const uiBlock = sliceBetween(
  app,
  "resetExistingNoticeState(){",
  "saveSelected(){"
);
const saveBlock = sliceBetween(
  app,
  "async _persistSelectedLead(existing, next, meta = {}){",
  "async simulateInbound(){"
);
const initBlock = sliceBetween(
  app,
  "if(this.els.form) on(this.els.form, \"submit\"",
  "try { AgentFloorPresence._bindSurveyorTyping(); }"
);
const beginNew = sliceBetween(
  app,
  "beginNewLead(options = {}){",
  "scheduleListRender(){"
);
const selectLead = sliceBetween(
  app,
  "selectLead(id){",
  "filteredLeads(){"
);

const sandboxSrc = `
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
    const s = safeTrim(raw);
    if(!s) return 0;
    const d = new Date(s);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  function parseCampaignLeadStampDateIL(s){
    const m = /^(\\d{4}-\\d{2}-\\d{2})/.exec(safeTrim(s));
    return m ? m[1] : "";
  }
  function goldLeadCustomerId(c){ return normalizeIdValue(c && c.idNumber); }
  function goldLeadCustomerPhone(c){ return normalizePhoneValue(c && c.phone); }
  function goldLeadCustomerName(c){ return safeTrim(c && c.fullName); }
  function goldLeadHiddenForViewer(lead){ return !!(lead && lead.goldLead === true); }
  function agentCanOpenCampaignLead(lead){ return !!lead; }
  const CampaignLeadsStore = { leads: [] };
  const State = { data: { customers: [] } };
  ${helpers}
  return {
    campaignLeadExistingNoticeMatchKey,
    campaignLeadExistingNoticeDateLabel,
    campaignLeadExistingNoticePickEarliestStamp,
    campaignLeadExistingNoticeLeadMatches,
    campaignLeadExistingNoticeCanOpenLead,
    campaignLeadExistingNoticeAckTokens,
    buildCampaignLeadExistingNoticeCopy,
    findCampaignLeadExistingNoticeLocal
  };
`;

let api = null;
try {
  api = new Function(sandboxSrc)();
} catch(err){
  console.error("sandbox load failed:", err && err.message);
}

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-campaign-lead-existing-notice.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + CSS_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes('const BUILD = "' + APP_TAG + '"'), "app.js BUILD tag");
assert(!!api, "sandbox helpers load");

console.log("\n2) התאמת ליד / לקוח");
const oldLead = {
  id: "cl_old",
  phone: "0501234567",
  idNumber: "123456789",
  createdAt: "2026-03-15T08:00:00.000Z",
  goldLead: false
};
const newLead = {
  id: "cl_new",
  phone: "0501234567",
  idNumber: "123456789",
  createdAt: "2026-09-01T08:00:00.000Z",
  goldLead: false
};
const otherLead = {
  id: "cl_other",
  phone: "0529998877",
  idNumber: "987654321",
  createdAt: "2026-01-01T08:00:00.000Z",
  goldLead: false
};
const goldLead = {
  id: "cl_gold",
  phone: "0501112233",
  idNumber: "111222333",
  createdAt: "2025-12-01T08:00:00.000Z",
  goldLead: true
};
const customer = {
  id: "cust_1",
  fullName: "ישראל ישראלי",
  phone: "0534445566",
  idNumber: "333444555",
  createdAt: "2024-06-20T08:00:00.000Z"
};

if(api){
  const byPhone = api.findCampaignLeadExistingNoticeLocal({
    phone: "050-123-4567",
    leads: [newLead, oldLead, otherLead],
    customers: []
  });
  assert(!!byPhone, "מוצא ליד לפי טלפון");
  assert(byPhone.leadId === "cl_old", "בוחר את הליד המוקדם לפי תאריך");
  assert(byPhone.canOpenLead === true, "ליד רגיל ניתן לפתיחה");
  assert(String(byPhone.dateLabel).includes("2026"), "תאריך המוצג כולל שנה");
  assert(byPhone.matchKey.indexOf("phone:0501234567") >= 0, "מפתח התאמה לפי טלפון");

  const byId = api.findCampaignLeadExistingNoticeLocal({
    idNumber: "123456789",
    leads: [newLead, oldLead, otherLead],
    customers: []
  });
  assert(byId && byId.leadId === "cl_old", "מוצא ליד לפי ת״ז ומעדיף את המוקדם");

  const excluded = api.findCampaignLeadExistingNoticeLocal({
    phone: "0501234567",
    excludeLeadId: "cl_old",
    leads: [oldLead],
    customers: []
  });
  assert(!excluded, "מדלג על הליד שפתוח כרגע בטופס");

  const gold = api.findCampaignLeadExistingNoticeLocal({
    phone: "0501112233",
    leads: [goldLead],
    customers: []
  });
  assert(!!gold, "ליד זהב עדיין מזוהה כעלה בסוכנות");
  assert(gold.canOpenLead === false, "ליד זהב לא מציע פתח ליד לסוקרת");

  const custOnly = api.findCampaignLeadExistingNoticeLocal({
    phone: "0534445566",
    leads: [otherLead],
    customers: [customer]
  });
  assert(!!custOnly, "מוצא תיק לקוח בלי ליד תואם");
  assert(!custOnly.leadId, "אין leadId כשאין ליד");
  assert(custOnly.canOpenLead === false, "בלי ליד אין פתח ליד");
  assert(custOnly.customer && custOnly.customer.id === "cust_1", "מחזיר את תיק הלקוח");

  const both = api.findCampaignLeadExistingNoticeLocal({
    idNumber: "333444555",
    phone: "0534445566",
    leads: [{ id: "cl_c", phone: "0534445566", idNumber: "333444555", createdAt: "2025-01-01T00:00:00.000Z" }],
    customers: [customer]
  });
  assert(!!both, "התאמה משולבת לליד וללקוח");
  assert(both.dateLabel && both.dateLabel.indexOf("2024") >= 0, "התאריך המוצג הוא המוקדם מבין ליד ולקוח");

  const incompletePhone = api.findCampaignLeadExistingNoticeLocal({
    phone: "05012",
    leads: [oldLead],
    customers: []
  });
  assert(!incompletePhone, "לא מזהה טלפון חלקי");

  const incompleteId = api.findCampaignLeadExistingNoticeLocal({
    idNumber: "12345678",
    leads: [oldLead],
    customers: []
  });
  assert(!incompleteId, "לא מזהה ת״ז קצרה מ-9 ספרות");

  const copy = api.buildCampaignLeadExistingNoticeCopy("15/03/2026");
  assert(copy.title === "שים/י לב סוקר/ת יק/רה", "כותרת המודאל");
  assert(copy.text === "לקוח זה עלה בסוכנות בתאריך 15/03/2026", "גוף המודאל כולל תאריך");
  assert(copy.openText === "פתח ליד", "כפתור פתח ליד");
  assert(copy.ackText === "הבנתי", "כפתור הבנתי");
  assert(copy.kicker === "מערכת לידים", "kicker מערכת לידים");

  const tokens = api.campaignLeadExistingNoticeAckTokens(byPhone);
  assert(tokens.indexOf("lead:cl_old") >= 0, "טוקן אישור כולל מזהה ליד");
}

console.log("\n3) מודאל + חיבור לטופס");
assert(helpers.includes("giCampaignLeadExistingNotice"), "id של המודאל");
assert(helpers.includes("data-lead-existing-open"), "כפתור פתח ליד במודאל");
assert(helpers.includes("data-lead-existing-ack"), "כפתור הבנתי במודאל");
assert(helpers.includes("requireConfirmClick") || helpers.includes('if(ev.key === "Escape")'), "Escape לא סוגר בלי אישור");
assert(helpers.includes("data-lead-existing-backdrop") && helpers.includes('.addEventListener("click", () => {})'), "backdrop לא סוגר");
assert(helpers.includes("fetchCampaignLeadExistingCustomerPeek"), "שליפת לקוח רזה מהשרת");
assert(helpers.includes('select(CAMPAIGN_LEAD_EXISTING_CUSTOMER_SELECT)'), "select רזה בלי payload");
assert(!helpers.includes("ingestCustomerRowFromServer"), "אין ingest ל-State של הסוקרת");
assert(uiBlock.includes("scheduleExistingNoticeCheck"), "debounce בהקלדה");
assert(initBlock.includes('on(this.els.phone, "input"'), "מאזין להקלדת טלפון");
assert(initBlock.includes('on(this.els.idNumber, "input"'), "מאזין להקלדת ת״ז");
assert(uiBlock.includes("350"), "debounce 350ms");
assert(beginNew.includes("resetExistingNoticeState()"), "ליד חדש מאפס את מצב ההתראה");
assert(selectLead.includes("_existingNoticeAcked = new Set()"), "בחירת ליד מאפסת אישור קודם");
assert(uiBlock.includes("this.selectLead(match.leadId)"), "פתח ליד קורא ל-selectLead");
assert(uiBlock.includes('this.showPanel("form")'), "פתח ליד מציג את טופס הליד");
assert(saveBlock.includes("guardExistingNoticeForSave"), "שמירה עוברת דרך שומר ההתראה");
assert(saveBlock.includes("if(blocked) return"), "שמירה נחסמת אם נפתח הליד הקיים");
assert(css.includes("GI-LEAD-EXISTING 2026-09-19"), "סמן CSS");
assert(css.includes(".giHarNotice__card--leadExisting"), "כרטיס מודאל ממורכז");
assert(css.includes(".giHarNotice__date"), "הדגשת תאריך");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
