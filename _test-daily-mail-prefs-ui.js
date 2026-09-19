/* GI-MAIL 2026-09-19 — בחירת נמענים + מועדי שליחה במסך דוח מכירות למייל.
   הרצה: node _test-daily-mail-prefs-ui.js
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
const mail = read("gi-daily-sales-mail.js");
const css = read("gi-daily-sales-mail.css");
const html = read("index.html");
const wf = read(".github/workflows/daily-sales-mail.yml");

console.log("1) Edge prefs + recipients");
assert(fn.includes('"save-prefs"'), "UI action save-prefs");
assert(fn.includes("async function handleSavePrefs"), "handleSavePrefs");
assert(fn.includes("async function listMailCandidates"), "מועמדים עם מייל");
assert(fn.includes("readAccountPrefs"), "קריאת prefs מחשבון");
assert(fn.includes("DEFAULT_SLOTS"), "ברירת מחדל למועדים");
assert(fn.includes("hasRecipientSelection"), "בחירת נמענים מפורשת");
assert(fn.includes("normalizeSlots"), "נרמול מועדים");
assert(fn.includes('slot": "auto"') || wf.includes('"slot": "auto"'), "workflow מעביר auto ל-Edge");
assert(fn.includes("מחוץ לחלון שליחה"), "דילוג מחוץ למועד");
assert(fn.includes("לא נבחרו נמענים עם מייל"), "שגיאה בלי נמענים");
assert(!fn.includes("function slotForMinutes(minutes: number){\n  if(minutes >= 20 * 60)"), "slotForMinutes דינמי");

console.log("\n2) UI HTML/CSS");
assert(html.includes("giDailySalesMailSchedulePanel"), "פאנל מועדים");
assert(html.includes("giDailySalesMailRecipientsPanel"), "פאנל נמענים");
assert(html.includes("giDailySalesMailSavePrefsBtn"), "כפתור שמירת העדפות");
assert(html.includes("giDailySalesMailUserSearch"), "חיפוש משתמש להוספה");
assert(html.includes("giDailySalesMailUserPick"), "רשימת משתמשים ללחיצה");
assert(html.includes("giDailySalesMailAddSlotBtn"), "הוספת מועד");
assert(html.includes("gi-daily-sales-mail.js?v=20260919-mail-status-auth-v3"), "cache bust js");
assert(html.includes("gi-daily-sales-mail.css?v=20260919-mail-prefs-click-v2"), "cache bust css");
assert(mail.includes("Never leave the HTML default"), "סטטוס לא נתקע על טוען");
assert(css.includes("giDailySalesMail__recipient"), "כרטיס נמען");
assert(css.includes("giDailySalesMail__slotChip"), "צ'יפ מועד");
assert(css.includes("giDailySalesMail__userPickItem"), "פריט לחיצה להוספה");
assert(css.includes("giDailySalesMail__panel"), "פאנל מקצועי");

console.log("\n3) Client behavior");
assert(mail.includes("api(\"save-prefs\""), "לקוח שומר prefs");
assert(mail.includes("function renderRecipients"), "רינדור נמענים");
assert(mail.includes("function renderSlots"), "רינדור מועדים");
assert(mail.includes("function renderUserPicker"), "רינדור רשימת הוספה");
assert(mail.includes("function addRecipientById"), "הוספה בלחיצה על שם");
assert(mail.includes("panelWasActive"), "רענון סטטוס רק בכניסה לפאנל");
assert(mail.includes("setSelectedId"), "סימון בלי איפוס מלא");
assert(mail.includes("function applyPrefsFromStatus"), "טעינת prefs מסטטוס");
assert(mail.includes("prefsState"), "מצב מקומי");
assert(mail.includes("data-recipient-id"), "צ'קבוקס נמען");
assert(mail.includes("data-add-user-id"), "לחיצה על שם מוסיפה");
assert(mail.includes("data-remove-slot"), "הסרת מועד");
assert(!mail.includes("נמענים כרגע (מנהל / מנהל מערכת):"), "הוסר טקסט גולמי של נמענים");
assert(!mail.includes("giDailySalesMailAddUserSelect"), "הוסר select ישן");
assert(mail.includes("giDailySalesMail__statusLine"), "סטטוס מעוצב");
assert(!mail.includes('api("send-slot"'), "דפדפן לא קורא send-slot");

console.log("\n4) slot helpers");
function normalizeSlot(raw){
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(raw || "").trim());
  if(!m) return "";
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if(hour > 23 || minute > 59) return "";
  return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
}
function slotForMinutes(minutes, slots){
  let current = "";
  [...slots].map(normalizeSlot).filter(Boolean)
    .sort((a, b) => {
      const [ah, am] = a.split(":").map(Number);
      const [bh, bm] = b.split(":").map(Number);
      return (ah * 60 + am) - (bh * 60 + bm);
    })
    .forEach((slot) => {
      const [h, m] = slot.split(":").map(Number);
      const start = h * 60 + m;
      if(minutes >= start) current = slot;
    });
  return current;
}
assert(normalizeSlot("12:30") === "12:30", "נרמול מועד");
assert(slotForMinutes(12 * 60 + 40, ["12:30", "15:00", "20:00"]) === "12:30", "חלון 12:30");
assert(slotForMinutes(15 * 60, ["12:30", "15:00", "20:00"]) === "15:00", "מעבר ל-15:00");
assert(slotForMinutes(14 * 60, ["12:30", "14:00", "20:00"]) === "14:00", "מועד מותאם");
assert(slotForMinutes(5 * 60, ["12:30"]) === "", "לפני מועד ראשון");

console.log("\n5) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-daily-sales-mail.js")]).status === 0, "node --check gi-daily-sales-mail.js");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
