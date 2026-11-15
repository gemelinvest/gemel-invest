/* GI-COLLECTION-MAIL 2026-11-15
   חיבור קריאה לתיבת הגבייה: שבעה ימים, בלי סיסמה, בלי טוקן המכירות.
   הרצה: node _test-gi-collection-mail.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

let failed = 0;
let passed = 0;
function assert(cond, msg){
  if(cond){ passed += 1; console.log("  PASS  " + msg); }
  else { failed += 1; console.error("  FAIL  " + msg); }
}

const root = __dirname;
const fn = fs.readFileSync(path.join(root, "supabase/functions/gi-collection-mail/index.ts"), "utf8");
const html = fs.readFileSync(path.join(root, "collection-mail.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert(fn.includes('const MAILBOX = "gviyaas@i-s-f.co.il"'), "התיבה הקבועה");
assert(fn.includes("mailFolders/inbox/messages"), "נקראת רק תיבת הדואר הנכנס");
assert(fn.includes("receivedDateTime ge "), "השאילתה חותכת לפי תאריך קבלה");
assert(fn.includes("api.withinWeek"), "גם תשובה ישנה מ-Graph נזרקת");
assert(fn.includes("api.weekStart"), "חלון השבוע מגיע מהקורא המשותף");
assert(fn.includes('select("ms_client_id,ms_client_secret,ms_tenant_id")'), "מאפליקציית Outlook נלקחים רק מזהה האפליקציה, לא טוקן המכירות");
assert(!fn.includes("account.refresh_token"), "טוקן הרענון של orias לא נטען");
assert(fn.includes("offline_access User.Read Mail.Read"), "ההרשאה היא קריאה");
assert(!fn.includes("Mail.Send"), "אין הרשאת שליחה בחיבור הגבייה");
assert(fn.includes('result.kind !== "report"'), "דוח מרובה לקוחות לא מועלה לתיק");
assert(fn.includes("result.assignments.length === 1"), "קובץ נשמר רק כשיש שיוך יחיד");
assert(fn.includes("function publicPull"), "התשובה לדפדפן נבנית משדות מפורשים");
assert(!fn.includes("contentBytes:"), "תוכן הקובץ לא חוזר לדפדפן");
assert(!/password\s*[:=]/i.test(fn), "אין שדה סיסמה בפונקציה");
assert(fn.includes("https://gemelinvest.github.io/gemel-invest/collection-mail.html"), "כתובת החזרה קבועה");
assert(html.includes("action: \"finish\"") && !html.includes("refresh_token"), "דף החזרה לא שומר טוקן");
assert(app.includes("data-gi-col-mail-pull") && app.includes("7 הימים האחרונים"), "המסך מבקש רק את השבוע האחרון");
assert(app.includes("fetchCustomerRecordFromServer(id)"), "אחרי משיכה התיק נטען מחדש מהשרת");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed);
