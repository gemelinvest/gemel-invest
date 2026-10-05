/* מערכת החתמת לקוח בתפריט הצד, לכל משתמש.
   Run: node _test-customer-sign-menu.js
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const js = fs.readFileSync(path.join(ROOT, "gi-customer-sign.js"), "utf8");
const mail = fs.readFileSync(path.join(ROOT, "gi-cancel-mail.js"), "utf8");
const fn = fs.readFileSync(path.join(ROOT, "supabase/functions/gi-sign/index.ts"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-customer-sign.js")]).status === 0, "node --check gi-customer-sign.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-cancel-mail.js")]).status === 0, "node --check gi-cancel-mail.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) every logged-in user sees the side menu");
assert(html.includes('data-view="customerSign"'), "nav item");
assert(html.includes("מערכת החתמת לקוח"), "menu label");
assert(html.includes('id="view-customerSign"'), "view");
assert(html.includes("gi-customer-sign.js"), "script");
assert(html.includes("gi-cancel-mail.js"), "cancel mail script");
assert(app.includes('customerSign: "מערכת החתמת לקוח"'), "page title");
assert(app.includes('safe !== "customerSign"') , "referent still reaches the view");
assert(app.includes('v === "customerSign"'), "referent menu keeps it");
assert(app.includes('getElementById("navCustomerSign")'), "shown for the current user");
assert(app.includes("CustomerSignUI?.open"), "view opens the screen");

console.log("\n3) upload, name, place, then a link instead of WhatsApp");
assert(js.includes("העלאת מסמך לחתימה"), "upload button");
assert(js.includes("שם למסמך"), "asks for a document name");
assert(js.includes("סיימתי להציב חתימות"), "finish placing button");
assert(js.includes("מספר טלפון לשליחה"), "asks for a phone");
assert(js.includes(">שלח<"), "send button");
assert(js.includes('action: "create_upload"'), "creates a signing packet");
assert(js.includes("הלינק לשליחה מוכן"), "shows the link");
assert(js.includes("pdf_viewer.js") && js.includes('currentScaleValue = "page-width"'), "opens the PDF with the shared viewer");
assert(js.includes("giCustSign__url"), "link is shown as text");
assert(js.includes("לא נשלחה הודעת וואטסאפ"), "does not send WhatsApp");
assert(!js.includes("wa.me") && !js.includes("whatsapp"), "no direct WhatsApp call");
assert(fn.includes('action === "create_upload"'), "server action");
assert(fn.includes("sentWhatsapp: false"), "server marks WhatsApp as not sent");
assert(fn.includes("async function requireActiveAgent"), "login is still checked");
assert(fn.includes("function canOpenCustomerSignRole"), "screen role gate");
assert(js.includes("אין הרשאה לפתוח את מערכת החתמת הלקוח"), "other users see no permission");
assert(js.includes("api.isAdmin") && js.includes("api.isManager"), "only admin and manager open the screen");

console.log("\n4) customer search uses the existing visibility");
assert(js.includes("חיפוש לקוח לפי שם או תעודת זהות"), "search by name or id");
assert(app.includes("window.giCustomerSignSearch = customerSignSearch"), "search helper is exported");
assert(app.includes("window.giCustomerVisible = customerVisibleToCurrentUser"), "visibility helper is exported");
const searchStart = app.indexOf("function customerSignSearch");
const searchEnd = app.indexOf("window.giCustomerVisible");
const searchBody = app.slice(searchStart, searchEnd);
assert(searchBody.includes("customerVisibleToCurrentUser(rec)"), "search uses existing visibility");
assert(!searchBody.includes("canViewAllCustomers"), "search does not reimplement visibility");

console.log("\n5) waiting queue and outside-screen toast");
assert(js.includes("ממתינים לחתימות"), "queue title");
assert(js.includes("לא פתח את הלינק"), "not opened yet");
assert(js.includes("פתח את הלינק"), "link was opened");
assert(js.includes("המסמך נחתם, מוכן להורדה"), "signed and ready");
assert(js.includes("חתם על המסמך והוא מוכן"), "toast when finished");
assert(js.includes("view-customerSign-active"), "no toast while the screen is open");
assert(fn.includes('action === "list_uploads"'), "queue reads uploads");

console.log("\n6) cancellation mail is prepared, not invented");
assert(js.includes("זהו מכתב ביטול"), "upload can be marked as a cancellation letter");
assert(js.includes("שליחת ביטול לחברה"), "send button on a signed cancellation");
assert(mail.includes("שליחת ביטול לחברה"), "shared send button");
assert(mail.includes("bituliimp@gmail.com"), "sending mailbox");
assert(mail.includes("המכתב נשלח לחברת הביטוח בהצלחה"), "success text exists for a real send");
assert(mail.includes("COMPANY_EMAIL_MISSING"), "missing company email is not a success");
assert(mail.includes("אישור ביטול נשלח בתאריך"), "sent record text");
assert(fn.includes('const CANCEL_FROM = "bituliimp@gmail.com"'), "server from mailbox");
assert(fn.includes("const CANCEL_COMPANY_MAIL: Record<string, string> = {}"), "company emails stay empty");
assert(fn.includes("COMPANY_EMAIL_MISSING") && fn.includes("MAIL_NOT_CONNECTED"), "no fake send");
assert(fn.includes('action === "send_cancel"'), "send action");
const sendStart = fn.indexOf("async function sendCancel");
const sendEnd = fn.indexOf("async function createPacket");
const sendBody = fn.slice(sendStart, sendEnd);
assert(sendStart > 0 && sendEnd > sendStart, "sendCancel stays beside createPacket");
assert(!sendBody.includes(".update(") && !sendBody.includes(".insert("), "send does not write a sent record");
assert(app.includes('data-send-cancel-sign='), "ops link button stays");
assert(app.includes("GiCancelMail.underDoc"), "ops adds the mail button under the document");
assert(fn.includes('action === "create"') && fn.includes("async function createPacket"), "ops packet creation stays");

const opens = (fn.match(/{/g) || []).length;
const closes = (fn.match(/}/g) || []).length;
assert(opens === closes, "edge function braces " + opens + " / " + closes);

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
