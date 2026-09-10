/* GI-LEADS-EXPORT 2026-09-09 — הפק דוח אקסל במערכת לידים למנהל/מנהל מערכת.
   לא נוגע בשיוך, סטטוס, שמירה או כניסה.
   הרצה: node _test-campaign-leads-export.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260910-cf-open-paint-v1";
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

function sliceBetween(src, startToken, endToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  const end = src.indexOf(endToken, start + startToken.length);
  if(end < 0) return src.slice(start);
  return src.slice(start, end);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes('const BUILD = "' + APP_TAG + '"'), "app.js BUILD tag");

console.log("\n2) לחצן ליד דוח מעקב סגירות + מודאל");
const formHead = sliceBetween(html, 'id="btnCampaignShowTracking1"', "campaignLeadsTableAlert");
const listHead = sliceBetween(html, 'id="btnCampaignShowTracking2"', "btnCampaignLeadsRefresh");
assert(formHead.includes('id="btnCampaignLeadsExport1"'), "הפק דוח ליד דוח מעקב סגירות במסך הטופס");
assert(formHead.includes("הפק דוח"), "תווית הפק דוח במסך הטופס");
assert(listHead.includes('id="btnCampaignLeadsExport2"'), "הפק דוח ליד דוח מעקב סגירות ברשימה");
assert(html.includes('id="campaignLeadsExportModal"'), "מודאל במרכז המסך");
assert(html.includes('id="campaignLeadsExportFrom"'), "שדה מתאריך");
assert(html.includes('id="campaignLeadsExportTo"'), "שדה עד תאריך");
assert(html.includes('id="btnCampaignLeadsExportConfirm"'), "לחצן אישור");
assert(html.includes(">אישור</button>"), "תווית אישור");
assert(css.includes("lcLeadExportModal__dates"), "עיצוב שורת תאריכים");

console.log("\n3) הרשאות מנהל / מנהל מערכת בלבד");
assert(app.includes("function campaignLeadExportCanUse()"), "בדיקת הרשאה");
assert(app.includes("return !!(Auth.isAdmin() || Auth.isManager())"), "רק admin/manager");
assert(app.includes("CampaignLeadsExportUI.syncButtons()"), "סנכרון נראות הלחצן");
assert(html.includes('id="btnCampaignLeadsExport1" type="button" style="display:none"'), "מוסתר כברירת מחדל");
assert(!sliceBetween(app, "function campaignLeadExportCanUse(){", "function campaignLeadExportSurveyorNote").includes("isReferent"),
  "סוקרת לא מקבלת את הדוח");

console.log("\n4) הייצוא לא נוגע בלוגיקת לידים / כניסה");
assert(app.includes("async persistRemote(lead, options = {}){"), "שמירת ליד נשארה");
assert(app.includes("async upsert(") && app.includes("CampaignLeadsStore"), "upsert לידים נשאר");
assert(app.includes("Auth._submit = async function()"), "מסלול כניסה נשאר");
assert(app.includes("_verifyPendingMfa"), "MFA נשאר");
assert(app.includes("showPanel(\"tracking\")"), "דוח מעקב סגירות לא הוסר");
const exportUi = sliceBetween(app, "const CampaignLeadsExportUI = {", "const CampaignLeadsUI = {");
assert(!exportUi.includes("persistRemote"), "ייצוא לא כותב ליד");
assert(!exportUi.includes("mapCampaignLeadToDb"), "ייצוא לא משנה מיפוי DB");
assert(exportUi.includes("CampaignLeadsStore.fetchAll({ scope: \"all\" })"), "קורא לטעינה קיימת בלי לשנות אותה");
assert(exportUi.includes("campaignLeadMatchesExportRange"), "סינון לפי טווח תאריכים");
assert(app.includes("parseCampaignLeadStampDateIL(lead?.createdAt)"), "טווח לפי תאריך כניסת הליד");

console.log("\n5) עמודות הדוח כוללות תיעוד סוקרת ונציג");
assert(app.includes('"סיבת פנייה (תיעוד סוקרת)"'), "עמודת תיעוד סוקרת");
assert(app.includes('"תיעוד שיחה (נציג)"'), "עמודת תיעוד שיחה");
assert(app.includes('"תיעוד מכירה"'), "עמודת תיעוד מכירה");
assert(app.includes('"תיעוד לא רלוונטי"'), "עמודת לא רלוונטי");
assert(app.includes('"חברת ביטוח"'), "עמודת חברה");
assert(app.includes('"קמפיין"'), "עמודת קמפיין");
assert(app.includes("window.XLSX.writeFile"), "הורדת קובץ אקסל");

console.log("\n6) runtime: טווח תאריכים + שורת אקסל");
const rangeSrc = sliceBetween(app, "function campaignLeadMatchesExportRange(lead, fromDay, toDay){", "function campaignLeadExportFmtStamp(raw){");
const safeTrim = (v) => String(v == null ? "" : v).trim();
function parseCampaignLeadStampDateIL(raw){
  const s = safeTrim(raw);
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : "";
}
const matchesRange = new Function(
  "safeTrim", "parseCampaignLeadStampDateIL",
  rangeSrc + "\nreturn campaignLeadMatchesExportRange;"
)(safeTrim, parseCampaignLeadStampDateIL);

assert(typeof matchesRange === "function", "פונקציית טווח נטענה");
assert(matchesRange({ createdAt: "2026-09-01" }, "2026-09-01", "2026-09-09") === true, "ליד ביום ההתחלה נכנס");
assert(matchesRange({ createdAt: "2026-09-09" }, "2026-09-01", "2026-09-09") === true, "ליד ביום הסיום נכנס");
assert(matchesRange({ createdAt: "2026-08-31" }, "2026-09-01", "2026-09-09") === false, "ליד לפני הטווח נחתך");
assert(matchesRange({ createdAt: "2026-09-10" }, "2026-09-01", "2026-09-09") === false, "ליד אחרי הטווח נחתך");
assert(matchesRange({ createdAt: "" }, "2026-09-01", "2026-09-09") === false, "ליד בלי תאריך לא נכנס");

const rowSrc = sliceBetween(app, "function buildCampaignLeadExportRow(lead, agents){", "function buildCampaignLeadExportSheet(leads, agents){");
const campaignLeadExportSurveyorNote = (lead) => safeTrim(lead?.descriptionDisplay);
const campaignLeadSourceLabel = (s) => s === "manual" ? "ידני" : s;
const campaignLeadStatusLabel = (s) => s === "closed" ? "נסגר" : s;
const campaignLeadResolveAgentName = (l) => safeTrim(l.assignedAgentName) || "—";
const campaignLeadTransferTrailText = () => "מעבר ליד: א → ב";
const campaignLeadExportFmtStamp = (raw) => safeTrim(raw);
const buildRow = new Function(
  "safeTrim", "campaignLeadExportSurveyorNote", "campaignLeadSourceLabel",
  "campaignLeadStatusLabel", "campaignLeadResolveAgentName", "campaignLeadTransferTrailText",
  "campaignLeadExportFmtStamp",
  rowSrc + "\nreturn buildCampaignLeadExportRow;"
)(safeTrim, campaignLeadExportSurveyorNote, campaignLeadSourceLabel, campaignLeadStatusLabel,
  campaignLeadResolveAgentName, campaignLeadTransferTrailText, campaignLeadExportFmtStamp);

const row = buildRow({
  customerName: "ישראל ישראלי",
  phone: "0501234567",
  idNumber: "123456789",
  descriptionDisplay: "רוצה ביטוח בריאות",
  insuranceCompany: "כלל",
  campaignLabel: "בריאות",
  source: "manual",
  status: "closed",
  assignedAgentName: "נציג א",
  createdByName: "סוקרת",
  callNote: "שוחחנו בבוקר",
  closedNote: "נסגר במכירה",
  createdAt: "2026-09-05"
}, []);
assert(row[0] === "ישראל ישראלי", "שם לקוח בשורה");
assert(row[5] === "רוצה ביטוח בריאות", "תיעוד סוקרת בשורה");
assert(row[6] === "כלל", "חברה בשורה");
assert(row[19] === "שוחחנו בבוקר", "תיעוד נציג בשורה");
assert(row[20] === "נסגר במכירה", "תיעוד מכירה בשורה");

const sheetSrc = sliceBetween(app, "function buildCampaignLeadExportSheet(leads, agents){", "const CAMPAIGN_LEAD_LANDING_MARKER");
const CAMPAIGN_LEAD_EXPORT_HEADERS = [
  "שם לקוח","טלפון","תעודת זהות","תאריך לידה","תאריך הנפקה ת.ז",
  "סיבת פנייה (תיעוד סוקרת)","חברת ביטוח","קמפיין"
];
const buildSheet = new Function(
  "CAMPAIGN_LEAD_EXPORT_HEADERS", "buildCampaignLeadExportRow",
  sheetSrc + "\nreturn buildCampaignLeadExportSheet;"
)(CAMPAIGN_LEAD_EXPORT_HEADERS.concat(new Array(22).fill("x")), buildRow);
const sheet = buildSheet([
  { customerName: "ב", createdAt: "2026-09-02", descriptionDisplay: "ב" },
  { customerName: "א", createdAt: "2026-09-01", descriptionDisplay: "א" }
], []);
assert(Array.isArray(sheet) && sheet.length === 3, "כותרת + שתי שורות");
assert(sheet[0].length === 30, "גיליון RTL (עמודות הפוכות)");
const firstDataName = sheet[1][sheet[1].length - 1];
assert(firstDataName === "א", "מיון לפי תאריך כניסה עולה");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
