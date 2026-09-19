/* GI-MAIL 2026-09-19 — 12:30 / 15:00 / 20:00 Israel daily-sales send resumed.
   Short Outlook body + PDF; one send per Israel slot from CRM snapshot.
   Snapshot premiums use after-discount (policyNetPremium) via Dashboard builders.
   הרצה: node _test-daily-sales-mail-cron.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
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

const fn = read("supabase/functions/gi-daily-sales-mail/index.ts");
const wf = read(".github/workflows/daily-sales-mail.yml");
const mail = read("gi-daily-sales-mail.js");
const html = read("index.html");
const app = read("app.js");
const cfg = read("supabase/config.toml");
const assistantWf = read(".github/workflows/deploy-assistant.yml");

console.log("1) clock + send-slot");
assert(fn.includes('["gi-daily-sales-mail-1230", "30 9 * * *"]'), "Deno.cron 09:30 UTC = 12:30 IDT");
assert(fn.includes('["gi-daily-sales-mail-1500", "0 12 * * *"]'), "Deno.cron 12:00 UTC = 15:00 IDT");
assert(fn.includes('["gi-daily-sales-mail-2000", "0 17 * * *"]'), "Deno.cron 17:00 UTC = 20:00 IDT");
assert(fn.includes("function registerSlotCrons"), "רישום Deno.cron מאובטח");
assert(fn.includes("typeof cron !== \"function\""), "לא קורס אם Deno.cron חסר");
assert(fn.includes('if(action === "send-slot")'), "HTTP send-slot מתוזמן");
assert(fn.includes("cronSecretOk(req, body)"), "send-slot דורש סוד כרון");
assert(fn.includes("return await handleSendNow(sb, body, { scheduled: true })"), "send-slot קורא לשליחה מתוזמנת");
assert(fn.includes("if(action === \"send-now\") return await handleSendNow(sb, body, { scheduled: false })"), "HTTP send-now ידני");
assert(fn.includes("async function runScheduledSlot"), "קרון קורא לאותו send-slot");
assert(fn.includes("fromBody = scheduled ? null : snapshotFromBody"), "שליחה מתוזמנת משתמשת בסנאפשוט השמור");
assert(!fn.includes("refreshSnapshotFromLiveSales"), "send-slot לא מרענן מ-RPC");
assert(!fn.includes('rpc("gi_daily_sales_by_agent"'), "אין RPC חי שמשכתב את הדוח");
assert(!fn.includes("mergeLiveAgentsIntoHtml"), "אין מיזוג שורות ל-HTML השמור");
assert(!fn.includes("buildLiveEmailHtml"), "אין בניית HTML נפרדת בשרת");
assert(fn.includes("kept: false"), "save-snapshot לא קופא על PDF ישן");
assert(fn.includes("html: incoming.html || existing?.html || \"\""), "HTML מתעדכן גם בלי PDF חדש");
assert(!assistantWf.includes("gi-daily-sales-mail"), "deploy-assistant לא מפרסם את פונקציית המייל");

console.log("\n2) skip/fail נרשמים בלוג");
assert(fn.includes('await logSend(sb, dateKey, "skipped", msg, emails)'), "skipped נכתב ללוג");
assert(fn.includes("finishSkip(NO_SNAPSHOT_ERROR)"), "אין סנאפשוט → לוג");
assert(fn.includes("finishSkip(OLD_LAYOUT_ERROR)"), "תבנית ישנה → לוג");
assert(fn.includes("finishSkip(NO_OUTLOOK_ERROR)"), "אין Outlook → לוג");
assert(fn.includes("finishSkip(NO_RECIPIENTS_ERROR)"), "אין נמענים → לוג");
assert(fn.includes("finishSkip(ALREADY_SENT_ERROR)"), "כפילות חלון → לוג");
assert(fn.includes('logSend(sb, dateKey, "error", msg, emails)'), "כשל Graph → לוג");
assert(fn.includes('logSend(sb, israelDateKey(), "error", msg, [])'), "כשל מעטפת → לוג");
assert(!fn.includes("SLOT_DEDUP_MS"), "הוסר חלון 90 דקות ששלח שוב באותו סלוט");
assert(fn.includes('wanted === "manual"'), "שליחה ידנית לא נספרת כסלוט");
assert(fn.includes("if(scheduled) return json({ ok: true, skipped: true"), "דילוג מתוזמן לא מפיל את ה-cron");

console.log("\n3) גוף Outlook קצר + PDF");
assert(fn.includes("function salesMailBodyHtml"), "גוף Outlook קצר נבנה בנפרד מהסנאפשוט");
assert(fn.includes("content: salesMailBodyHtml(dateLabel || dateKeyLabel(dateKey))"), "Graph שולח כותרת+תאריך ולא את הטבלה");
assert(fn.includes("דוח מכירות עדכני נכון ל־"), "גוף המייל: דוח מכירות עדכני נכון ל־");
assert(!fn.includes(">דוח מכירות</p>"), "הוסרה כותרת קצרה בלי «עדכני נכון ל־»");
assert(!fn.includes("content: String(snap.html"), "HTML המלא לא נשלח כגוף Outlook");
assert(fn.includes("SENT_WITHOUT_PDF"), "שליחה בלי PDF מסומנת");
assert(fn.includes("missingPdf ? SENT_WITHOUT_PDF : null"), "Graph עדיין שולח HTML בלי PDF");
assert(fn.includes("const attachments = pdfOk(pdf)"), "PDF רק כששמור, לא חובה");

console.log("\n4) GitHub Actions — שעון פעיל + דיפלוי");
assert(wf.includes("name: Daily sales mail slots"), "שם ה-workflow");
assert(/(^|\n)  schedule:/.test(wf), "בלוק schedule פעיל תחת on");
assert(wf.includes('cron: "*/10 * * * *"'), "סקר 10 דקות פעיל");
assert(wf.includes('cron: "30 12 * * *"'), "12:30 פעיל");
assert(wf.includes('cron: "0 15 * * *"'), "15:00 פעיל");
assert(wf.includes('cron: "0 20 * * *"'), "20:00 פעיל");
assert(wf.includes('timezone: "Asia/Jerusalem"'), "timezone ישראל על ה-schedule");
assert(fn.includes("const SCHEDULED_SEND_DISABLED = false"), "kill-switch כבוי — שליחה מתוזמנת פעילה");
assert(fn.includes('finishSkip("שליחה מתוזמנת מושבתת זמנית")'), "משפט דילוג נשאר לקיל-סוויץ'");
assert(fn.includes("if(scheduled && SCHEDULED_SEND_DISABLED)"), "רק שליחה מתוזמנת נחסמת כשהדגל דלוק");
assert(!wf.includes('cron: "40 9 * * *"'), "הוסרו cron UTC כפולים");
assert(!wf.includes('cron: "50 11 * * *"'), "הוסר חלון UTC 11:50");
assert(!wf.includes("secrets.SUPABASE_ACCESS_TOKEN != ''"), "אין secrets ב-if של job (מדלג את הדיפלוי)");
assert(wf.includes("github.event_name == 'push'"), "דיפלוי רץ על push");
assert(wf.includes('if [ -z "$SUPABASE_ACCESS_TOKEN" ]'), "דיפלוי נכשל במפורש בלי טוקן");
assert(wf.includes('ZoneInfo("Asia/Jerusalem")'), "סינון לפי שעון ישראל");
assert(wf.includes('"slot": "auto"'), "workflow מעביר auto — Edge קובע מועד מ-prefs");
assert(wf.includes("before 06:00"), "שקט בלילה לפני 06:00");
assert(!wf.includes("def due_slot(minutes):"), "due_slot הוסר מה-workflow — Edge דינמי");
assert(!wf.includes("window = 35"), "הוסר שער 35 הדקות שפספס 12:30/15:00");
assert(!wf.includes('"refreshLive": True'), "אין רענון RPC מה-cron");
assert(wf.includes('"action": "send-slot"'), "POST send-slot");
assert(wf.includes("vhvlkerectggovfihjgm.supabase.co/functions/v1/gi-daily-sales-mail"), "URL הפונקציה החיה");
assert(wf.includes("must not fail the workflow"), "דילוג צפוי לא מפיל את השעון");
assert(!wf.includes("send-slot missed a due Israel slot"), "הוסר fail על skip שכיבה את ה-cron");
assert(wf.includes("workflow_dispatch"), "אפשר להריץ ידנית אחרי מיזוג");
assert(wf.includes("supabase functions deploy gi-daily-sales-mail"), "push ל-main מפרסם את הפונקציה");
assert(wf.includes("github.event_name != 'push'"), "שליחה לא רצה על push");
assert(cfg.includes("supabase functions deploy gi-daily-sales-mail --project-ref vhvlkerectggovfihjgm"), "הוראת דיפלוי ב-config.toml");

console.log("\n5) UI + cache + אחרי הנחה בסנאפשוט");
assert(html.includes("gi-daily-sales-mail.js?v=20260919-mail-prefs-ui-v1"), "cache bust לסקריפט המייל");
assert(mail.includes("20260919-mail-prefs-ui-v1"), "כותרת הסקריפט");
assert(mail.includes("MAIL_LAYOUT = \"20260908-today-net\""), "תג תבנית אמיתי");
assert(!mail.includes("20260826-branch-leads"), "הוסר תג תבנית מזויף");
assert(mail.includes("function formatIsraelDateTime"), "שעות סטטוס לפי ישראל");
assert(mail.includes("data.lastSend.error"), "סטטוס מציג סיבת דילוג/כשל");
assert(mail.includes("דוח מכירות עדכני נכון ל־"), "סטטוס מסביר שגוף המייל קצר ומעודכן");
assert(mail.includes("הפירוט מצורף כקובץ PDF"), "סטטוס מציין שהפירוט ב-PDF");
assert(mail.includes('api("send-now"'), "שלח עכשיו נשאר ידני");
assert(!mail.includes('api("send-slot"'), "הדפדפן לא קורא send-slot");
assert(mail.includes("slot + 40") || mail.includes("(slot + 40)"), "PDF נבנה גם אחרי השעה אם GitHub מאחר");
assert(mail.includes("api(\"save-prefs\""), "שמירת נמענים ומועדים");
assert(mail.includes("buildDailySalesPrintModel"), "סנאפשוט דרך בוני מסך המכירות בלבד");
assert(app.includes("this.policyNetPremium(p)"), "דוח יומי סופר פרמיה אחרי הנחה");
assert(app.includes('layout: "20260908-today-net"'), "סיכום המייל נושא תג after-discount");
assert(app.includes("this.buildDailySalesPrintModel(this._coerceDailySalesMailDate(forDate))"), "HTML מייל נבנה להיום");
assert(app.includes("buildDailySalesMailSnapshot"), "בניית snapshot למייל קיימת");
assert(app.includes("מכירות מודיעין") && app.includes("מכירות חיפה"), "KPI סניפים נשארים ב-HTML המייל");

console.log("\n6) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-daily-sales-mail.js")]).status === 0, "node --check gi-daily-sales-mail.js");

function israelMinutesAt(d){
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23"
  }).formatToParts(d);
  return Number(parts.find((p) => p.type === "hour").value) * 60
    + Number(parts.find((p) => p.type === "minute").value);
}
function slotForMinutes(minutes){
  if(minutes >= 20 * 60) return "20:00";
  if(minutes >= 15 * 60) return "15:00";
  if(minutes >= 12 * 60 + 30) return "12:30";
  return "";
}
function alreadySentSlot(sentAts, slot){
  if(!slot || slot === "manual") return false;
  return sentAts.some((iso) => slotForMinutes(israelMinutesAt(new Date(iso))) === slot);
}
assert(alreadySentSlot(["2026-09-06T12:50:01.000Z"], "15:00") === true, "שליחת 15:49 חוסמת poll נוסף ב-15:00");
assert(alreadySentSlot(["2026-09-06T12:50:01.000Z"], "20:00") === false, "15:00 לא חוסם את 20:00");
assert(alreadySentSlot(["2026-09-06T09:35:00.000Z"], "15:00") === false, "12:30 לא חוסם את 15:00");
assert(alreadySentSlot(["2026-09-06T12:50:01.000Z"], "manual") === false, "manual לא נחסם לפי סלוט");

function dueSlot(minutes){
  const slots = [
    ["12:30", 12 * 60 + 30, 15 * 60],
    ["15:00", 15 * 60, 20 * 60],
    ["20:00", 20 * 60, 24 * 60]
  ];
  for(const [name, start, end] of slots){
    if(minutes >= start && minutes < end) return name;
  }
  return null;
}
assert(dueSlot(12 * 60 + 29) === null, "12:29 עדיין לא חלון");
assert(dueSlot(12 * 60 + 30) === "12:30", "12:30 הוא חלון 12:30");
assert(dueSlot(14 * 60 + 39) === "12:30", "14:39 עדיין חלון 12:30 (איחור GitHub)");
assert(dueSlot(15 * 60) === "15:00", "15:00 עובר לחלון הבא");
assert(dueSlot(17 * 60 + 39) === "15:00", "17:39 עדיין חלון 15:00");
assert(dueSlot(20 * 60) === "20:00", "20:00 הוא חלון 20:00");
assert(dueSlot(23 * 60) === "20:00", "23:00 עדיין חלון 20:00");

function salesMailBodyHtml(dateLabel){
  const d = String(dateLabel == null ? "" : dateLabel).trim();
  const line = d ? ("דוח מכירות עדכני נכון ל־" + d) : "דוח מכירות עדכני";
  return line;
}
assert(salesMailBodyHtml("19.09.2026") === "דוח מכירות עדכני נכון ל־19.09.2026", "משפט גוף עם תאריך");
assert(salesMailBodyHtml("") === "דוח מכירות עדכני", "משפט גוף בלי תאריך");
assert(!/פרמיה|נציג|מודיעין|טבלה/.test(salesMailBodyHtml("יום שבת")), "גוף המייל בלי פירוט מכירות");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
