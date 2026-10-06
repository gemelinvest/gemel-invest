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
const css = fs.readFileSync(path.join(ROOT, "gi-customer-sign.css"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
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
assert(js.includes("שם המסמך"), "asks for a document name");
assert(js.includes("סיימתי להציב חתימות"), "finish placing button");
assert(js.includes("מספר טלפון לשליחה"), "asks for a phone");
assert(js.includes(">שלח<"), "send button");
assert(js.includes('action: "create_upload"'), "creates a signing packet");
assert(js.includes("הלינק לשליחה מוכן"), "shows the link");
assert(js.includes("pdf_viewer.js") && js.includes('currentScaleValue = "page-width"'), "opens the PDF with the shared viewer");
assert(js.includes("giCustSign__url"), "link is shown as text");
assert(js.includes("לא נשלחה הודעת וואטסאפ"), "does not send WhatsApp");
assert(!js.includes("wa.me"), "no manual WhatsApp link");
assert(js.includes("GiWhatsappSign") && js.includes("לא נשלחה הודעת וואטסאפ"), "WhatsApp is sent only after the number is connected");
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

console.log("\n6) cancellation mail sends from bituliimp after the mailbox secret exists");
assert(js.includes("function looksLikeCancelLetter") && js.includes("getTextContent"), "cancellation letters are detected from the file");
assert(!js.includes("זהו מכתב ביטול"), "manual cancellation checkbox is gone");
assert(js.includes("תייק לתיק הלקוח") && js.includes("fileSignedCustomerUpload") && app.includes("async fileSignedCustomerUpload"), "signed files can be filed in the customer folder");
assert(js.includes("data-download"), "signed files can be downloaded");
assert(js.includes("שליחת ביטול לחברה"), "send button on a signed cancellation");
assert(mail.includes("שליחת ביטול לחברה"), "shared send button");
assert(mail.includes("bituliimp@gmail.com"), "sending mailbox");
assert(mail.includes("המכתב נשלח לחברת הביטוח בהצלחה"), "success text exists for a real send");
assert(!mail.includes("לא יוצא עכשיו"), "dialog no longer says the letter stays unsent");
assert(mail.includes("COMPANY_EMAIL_MISSING"), "missing company email is not a success");
assert(mail.includes("MAIL_FAILED"), "failed SMTP is not a success");
assert(mail.includes("אישור ביטול נשלח בתאריך"), "sent record text");
assert(html.includes("gi-cancel-mail.js?v=20261006-cancel-reply-v1"), "cancel mail script is refreshed");
assert(fn.includes('const CANCEL_FROM = "bituliimp@gmail.com"'), "server from mailbox");
assert(fn.includes("const CANCEL_DESTINATIONS"), "company and product destinations");
const want = [
  ["polisotbs@harel-ins.co.il", "הראל בריאות"],
  ["cancellb@harel-ins.co.il", "הראל חיים"],
  ["BitulPolicyBriut@clal-ins.co.il", "כלל בריאות"],
  ["bitulp@clal-ins.co.il", "כלל חיים"],
  ["bitul@fnx.co.il", "הפניקס"],
  ["mail-cancel@ayalon-ins.co.il", "איילון חיים"],
  ["mail-cancel@ayalon-ins.co.il", "איילון בריאות"],
  ["bitul-life@menora.co.il", "מנורה"],
  ["cancelpolisa@migdal.co.il", "מגדל"],
  ["bitul@hcsra-ins.co.il", "הכשרה חיים"],
  ["bitul-b@hcsra-ins.co.il", "הכשרה בריאות"],
  ["cancellation@aig.co.il", "AIG"],
  ["bitul@lbr.co.il", "ליברה"],
  ["bitullife@5555555.co.il", "ביטוח ישיר"],
  ["service@poalimbit.co.il", "סוכנות פועלים"],
  ["polisa@umtb.co.il", "סוכנות טפחות"],
  ["SHERUT_MAALOT@MAALOT-INS.CO.IL", "סוכנות מעלות"],
  ["mashkantadiscount@dbank.co.il", "סוכנות דיסקונט"],
  ["stdjbank@standard.co.il", "עיר שלם"]
];
want.forEach((pair) => {
  assert(fn.includes(pair[0]) && mail.includes(pair[0]), pair[1] + " email");
  assert(fn.includes(pair[1]) && mail.includes(pair[1]), pair[1] + " label");
});
assert((fn.match(/id: "harel-health"/g) || []).length === 1, "nineteen ids stay one each");
assert(fn.includes('id: "discount"') && fn.includes('fax: ""'), "discount has email and no fax");
assert(fn.includes("COMPANY_EMAIL_MISSING") && fn.includes("MAIL_NOT_CONNECTED"), "no fake send");
assert(fn.includes('action === "send_cancel"'), "send action");
const sendStart = fn.indexOf("async function sendCancel");
const sendEnd = fn.indexOf("async function createPacket");
const sendBody = fn.slice(sendStart, sendEnd);
assert(sendStart > 0 && sendEnd > sendStart, "sendCancel stays beside createPacket");
assert(fn.includes("GMAIL_APP_PASSWORD") && fn.includes("smtp.gmail.com"), "Gmail SMTP uses the app password secret");
assert(sendBody.includes("gmailAppPassword()"), "sendCancel reads the mailbox secret");
assert(sendBody.includes("await stampCancelSent("), "records after a real send");
assert(sendBody.indexOf("MAIL_NOT_CONNECTED") < sendBody.indexOf("await stampCancelSent("), "disconnected mailbox does not stamp");
assert(sendBody.indexOf("MAIL_FAILED") < sendBody.indexOf("await stampCancelSent("), "failed SMTP does not stamp");
assert(!sendBody.includes(".update(") && !sendBody.includes(".insert("), "send does not write a sent record itself");
assert(!sendBody.includes("graph.microsoft"), "daily-sales Graph mailbox is not reused");
assert(app.includes('data-send-cancel-sign='), "ops link button stays");
assert(app.includes("GiCancelMail.underDoc"), "ops adds the mail button under the document");
assert(fn.includes('action === "create"') && fn.includes("async function createPacket"), "ops packet creation stays");

console.log("\n7) WhatsApp leaves from 0556686960 only after Meta is connected");
const wa = fs.readFileSync(path.join(ROOT, "gi-whatsapp-sign.js"), "utf8");
const sign = fs.readFileSync(path.join(ROOT, "gi-sign.js"), "utf8");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-whatsapp-sign.js")]).status === 0, "node --check gi-whatsapp-sign.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-sign.js")]).status === 0, "node --check gi-sign.js");
assert(html.includes("gi-whatsapp-sign.js?v=20261005-wa-sign-v1"), "whatsapp script");
assert(html.indexOf("gi-whatsapp-sign.js") < html.indexOf("gi-customer-sign.js"), "script loads before the signing screen");
assert(wa.includes('const FROM = "0556686960"'), "client sender number");
assert(fn.includes('const WHATSAPP_FROM = "0556686960"'), "server sender number");
assert(wa.includes('action: "send_whatsapp"') && fn.includes('action === "send_whatsapp"'), "send action");
assert(fn.includes("WHATSAPP_NOT_CONNECTED") && fn.includes("WHATSAPP_TOKEN") && fn.includes("WHATSAPP_PHONE_NUMBER_ID"), "no send without Meta secrets");
assert(fn.includes('|| "sign_link"'), "template name");
assert(!wa.includes("wa.me") && !sign.includes("wa.me") && !js.includes("wa.me"), "no manual WhatsApp link");
assert(wa.includes("לא נשלחה הודעת וואטסאפ"), "not-sent text");
assert(js.includes("0556686960"), "screen names the sender number");
const waStart = fn.indexOf("async function sendWhatsapp");
const waEnd = fn.indexOf("async function createPacket");
const waBody = fn.slice(waStart, waEnd);
assert(waStart > 0 && waEnd > waStart, "sendWhatsapp stays beside createPacket");
assert(!waBody.includes(".update(") && !waBody.includes(".insert("), "whatsapp send does not write a packet");
assert(fn.includes("function waHref") && waBody.includes("waHref("), "only signing links are sent");
assert(waBody.includes('row.slot !== "agent"'), "agent copy is not sent to the customer");
const openSend = sign.slice(sign.indexOf("async function openSend"), sign.indexOf("async function openFormsSend"));
assert(openSend.indexOf("showLinks(") >= 0 && openSend.indexOf("showLinks(") < openSend.indexOf("await notifyWhatsapp"), "cancel send shows the link before WhatsApp");
assert(openSend.includes('action: "create"') && !openSend.includes("send_whatsapp"), "cancel send still creates the packet itself");
const formsSend = sign.slice(sign.indexOf("async function openFormsSend"), sign.indexOf("async function syncCustomer"));
assert(!formsSend.includes("decoratedJob"), "forms send stays sequential");
assert(formsSend.indexOf("showLinks(") < formsSend.indexOf("await notifyWhatsapp"), "forms send shows the link before WhatsApp");
const uploadSend = js.slice(js.indexOf("async function sendLink"), js.indexOf("function queueStatus"));
assert(uploadSend.indexOf('action: "create_upload"') < uploadSend.indexOf("sendLinks"), "upload still creates the link first");
assert(js.includes("shareSignHref") && js.includes("asShareHref") && js.includes("ogPngForSigner"), "upload uses the shared short-link and card");
assert(uploadSend.includes("openHref: open") && uploadSend.includes("ogPng: ogPng"), "upload stores the open page and WhatsApp image");
assert(uploadSend.includes("shareHref") && uploadSend.includes("asShareHref") && !uploadSend.includes("GiSignEngine"), "send uses the share helper, not the CRM origin builder");
assert(!js.includes('url.origin + dir + "s/"'), "upload never shares the CRM origin path");
assert(sign.includes("asShareHref,") && sign.includes("shareSignHref,"), "shared API is public so the upload screen cannot drift");
assert(fn.includes("open_href: trim(body.openHref") && fn.includes("og_png: trim(body.ogPng"), "create_upload persists the card");
const runtime = spawnSync(process.execPath, ["-e", `
const fs = require("fs");
const vm = require("vm");
const sandbox = { window: {}, console, setTimeout, clearTimeout, AbortController };
sandbox.fetch = async () => {
  sandbox.calls = (sandbox.calls || 0) + 1;
  return { ok: false, status: 503, json: async () => ({ ok: false, error: "WHATSAPP_NOT_CONNECTED", from: "0556686960" }) };
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(${JSON.stringify(path.join(ROOT, "gi-whatsapp-sign.js"))}, "utf8"), sandbox);
const api = sandbox.window.GiWhatsappSign;
if(api.FROM !== "0556686960") throw new Error("from");
const disconnected = api.note({ sent: false, code: "WHATSAPP_NOT_CONNECTED" });
if(disconnected.indexOf("0556686960") < 0 || disconnected.indexOf("לא נשלחה הודעת וואטסאפ") < 0) throw new Error("note");
if(api.note({ sent: true }).indexOf("הלינק נשלח") !== 0) throw new Error("sent note");
(async () => {
  const onlyAgent = await api.sendLinks({ phone: "0501234567", links: [{ href: "https://example.test/s/Ab12Cd34", slot: "agent" }] });
  if(onlyAgent.sent || onlyAgent.code !== "MISSING_PHONE" || sandbox.calls) throw new Error("agent link");
  const pending = await api.sendLinks({ phone: "0501234567", customerName: "ישראל", links: [{ href: "https://example.test/s/Ab12Cd34", slot: "self", name: "טופס" }] });
  if(pending.sent || pending.code !== "WHATSAPP_NOT_CONNECTED") throw new Error("pending " + pending.code);
  if(api.note(pending).indexOf("נשלח לוואטסאפ של הלקוח") >= 0) throw new Error("false success");
  console.log("runtime-ok");
})().catch((err) => { console.error(err); process.exit(1); });
`], { encoding: "utf8" });
assert(runtime.status === 0 && runtime.stdout.includes("runtime-ok"), "disconnected number does not count as sent");

const opens = (fn.match(/{/g) || []).length;
const closes = (fn.match(/}/g) || []).length;
assert(opens === closes, "edge function braces " + opens + " / " + closes);

console.log("\n8) home is a two-column stage: queue beside the nav, details on the left");
const homeStart = js.indexOf("function paintHome");
const homeEnd = js.indexOf("function openNameDialog");
const home = homeStart > 0 && homeEnd > homeStart ? js.slice(homeStart, homeEnd) : "";
const queueStart = js.indexOf("function paintQueue");
const queueEnd = js.indexOf("function onQueueClick");
const queueFn = queueStart > 0 && queueEnd > queueStart ? js.slice(queueStart, queueEnd) : "";
assert(!!home && !!queueFn, "paintHome and paintQueue extracted");
assert(home.includes("giCustSign__stage"), "home uses the split stage");
assert(home.indexOf("giCustSignQueue") < home.indexOf("giCustSignDetail"), "queue is first in the RTL grid (right, beside nav)");
assert(!home.includes("recentHtml"), "home does not render produced-link rows");
assert(!home.includes("לינקים שהופקו"), "home has no copy-link heading");
assert(!home.includes("giCustSign__url"), "home does not show a signing URL");
assert(queueFn.includes("data-select"), "queue rows select a document");
assert(!queueFn.includes("data-download"), "download stays in the detail pane");
assert(!queueFn.includes("data-cancel-send"), "cancel send stays in the detail pane");
assert(js.includes("function paintDetail") && js.includes("פרטי המסמך"), "selected row shows document details");
assert(js.includes("data-download") && js.includes("תייק לתיק הלקוח") && js.includes("שליחת ביטול לחברה"), "status actions still exist");
assert(css.includes("grid-template-columns: minmax(240px, 320px) minmax(0, 1fr)"), "narrow queue column is first in RTL");
assert(html.includes("gi-customer-sign.css?v=20261005-cust-sign-v11"), "css cache refresh");
assert(html.includes("gi-customer-sign.js?v=20261006-cancel-reply-v1"), "js cache refresh");
assert(sw.includes("20261005-ops-summary-idle-v1"), "service-worker still carries the sums cache tag");
assert(html.includes("gi-sign.js?v=20261005-sign-survey-v1"), "gi-sign cache tag unchanged");

console.log("\n9) file-to-folder, header gradient, recent-customer facts");
assert(js.includes("if(!filed)") && app.includes("GiCustomerFileStore.uploadBlob") && app.includes("if(rowOnly) return false"), "filing uploads the PDF and only toasts after a real save");
assert(app.includes("refreshOpenCustomerPreservingState") && app.includes("customerDocuments) ? rec.payload.customerDocuments.length"), "open customer file refreshes after a signed PDF is filed");
assert(css.includes("linear-gradient(180deg, #3870ED") && css.includes("#FFFFFF 100%)") && css.includes("#C4A35A"), "header is sidebar blue graded to white with a gold rule");
assert(js.includes("giCustSign__steps") && js.includes("מעקב ותיוק"), "home shows the four signing steps");
assert(js.includes("giCustSign__chip") && js.includes("statusChipHtml"), "queue status is a chip");
assert(js.includes("שלב 2 · הצבת חתימות") && js.includes("שלב 3 · שליחה ללקוח"), "editor bars name the current step");
assert(js.includes("giCustSign__sendRow"), "send fields stay on one row");
assert(html.includes('id="navCustomerSign"') && html.includes('data-view="customerSign"'), "side menu item is unchanged");
assert(app.includes("recentCustomerMissingFacts") && app.includes('ensureRecordPayload("customers", id, { force: true })'), "recent customers load full payload when sector or premium is missing");
assert(app.includes("sameHtml)") && !app.includes("sameIds && nextFilled <= curFilled"), "a later filled row is not skipped because ids stayed the same");
assert(sw.includes("20261005-ops-summary-idle-v1"), "service-worker still carries the sums cache tag");

console.log("\n10) a company reply is tied to one letter and shown under it");
assert(fn.includes('action === "sync_cancel_replies"') && fn.includes('action === "cancel_reply_file"'), "reply sync and attachment actions");
assert(fn.includes("imap.gmail.com") && fn.includes("UID SEARCH SINCE"), "inbox is read over IMAP");
assert(fn.includes("IMAP_TIMEOUT"), "a stuck inbox does not hold the file open");
assert(fn.includes("setTimeout(resolve, 8000)"), "a slow inbox does not block the signing queue");
assert(fn.includes('מכתב ביטול — " + opts.company + " — " + opts.customerName'), "subject carries company and customer");
assert(fn.includes('ref ? " — " + ref : ""') && fn.includes('ref ? "קוד: " + ref : ""'), "the letter code is in the subject and the body");
assert(sendBody.includes("const ref = cancelRef()") && sendBody.includes("const messageId = cancelMessageId(ref)"), "each send stores a code and a message id");
assert(sendBody.includes("customerName,") && sendBody.includes("replies: []"), "the stored send keeps the customer and starts with no replies");
assert(!sendBody.includes(".update(") && !sendBody.includes(".insert("), "send still does not write the record itself");
const pullBody = fn.slice(fn.indexOf("async function pullCancelReplies"), fn.indexOf("async function syncCancelReplies"));
assert(pullBody.includes("addrOf(mail && mail.from) === CANCEL_FROM"), "mail from our own box is not a company reply");
assert(pullBody.includes(".update("), "a matched reply is saved on that letter");
assert(fn.includes("cancelSent: trim(cancel.sentAt) ? publicCancel(cancel) : null"), "the queue returns the public record");
const pubReply = fn.slice(fn.indexOf("function publicReply"), fn.indexOf("function publicCancel"));
assert(pubReply.includes("hasFile") && !pubReply.includes("fileBase64:"), "the queue names an attachment without sending the pdf");
assert(mail.includes("תשובה מחברת הביטוח בתאריך") && mail.includes("צפייה בצירוף"), "the file shows the reply date, sender, and attachment");
assert(mail.includes('action: "sync_cancel_replies"') && mail.includes('action: "cancel_reply_file"'), "the file syncs replies and opens a saved pdf");
assert(mail.includes("data-cancel-mail-token"), "the letter wrapper carries the sign token");
assert(js.includes("repliesHtml"), "the signing screen uses the same reply block");
assert(mail.includes("syncedAt") && mail.includes("20000"), "the same open letters are not read from the inbox on every redraw");

const vm = require("vm");
const mailBox = {
  window: {},
  document: {
    getElementById(){ return null; },
    createElement(){ return {}; },
    head: { appendChild(){} },
    addEventListener(){},
    body: null,
    querySelectorAll(){ return []; }
  }
};
mailBox.window.window = mailBox.window;
vm.createContext(mailBox);
vm.runInContext(mail, mailBox, { filename: "gi-cancel-mail.js" });
const api = mailBox.window.GiCancelMail;
const withReply = api.repliesHtml({
  replies: [{ at: "2026-10-06T07:00:00.000Z", from: "polisotbs@harel-ins.co.il", text: "התקבל", messageId: "<r1@harel>", hasFile: true }]
}, "tok1");
assert(withReply.includes("תשובה מחברת הביטוח בתאריך") && withReply.includes("polisotbs@harel-ins.co.il") && withReply.includes("התקבל") && withReply.includes("צפייה בצירוף") && withReply.includes("tok1"), "a reply with a pdf shows the text and the view button");
assert(api.repliesHtml({ replies: [{ at: "2026-10-06T07:00:00.000Z", from: "a@b.co", text: "רק טקסט", hasFile: false }] }, "tok1").indexOf("צפייה בצירוף") < 0, "a reply without a pdf has no view button");
assert(api.repliesHtml({ replies: [] }, "tok1") === "", "a send with no reply adds nothing under the confirmation");
mailBox.window.GiSign = { isSignedReady(){ return true; } };
const bare = api.underDoc({ payload: { giSignByDoc: { d1: { links: [{ status: "signed", token: "tok1" }] } } } }, { id: "d1", type: "company_cancel_form", company: "הראל", productFamily: "health" });
assert(bare.includes('data-cancel-mail-token="tok1"') && bare.includes("שליחת ביטול לחברה") && bare.indexOf("תשובה מחברת הביטוח") < 0, "an unsent letter keeps the send button and no reply");

function loadReplyFns(){
  const destStart = fn.indexOf("const CANCEL_DESTINATIONS");
  const destEnd = fn.indexOf("\n];", destStart);
  const dest = fn.slice(destStart, destEnd + 3).replace(/: \{[\s\S]*?\}\[\]/, "");
  const bodyStart = fn.indexOf("function addrOf");
  const bodyEnd = fn.indexOf("function imapSince");
  const body = fn.slice(bodyStart, bodyEnd)
    .replace(/: Record<string, string>/g, "")
    .replace(/: number\[\]/g, "")
    .replace(/: Json\[\]/g, "")
    .replace(/: Json/g, "")
    .replace(/: unknown/g, "")
    .replace(/: string/g, "");
  return new Function(dest + "\nfunction trim(v){ return String(v == null ? \"\" : v).trim(); }\n" + body + "\nreturn { matchCancelReply, parseCancelRfc822 };")();
}
const replyFns = loadReplyFns();
const sends = [
  { token: "a", ref: "GIAB12CD", messageId: "<GIAB12CD@bituliimp.gmail.com>", email: "polisotbs@harel-ins.co.il", customerName: "ישראל ישראלי" },
  { token: "b", ref: "GIOTHER1", messageId: "<GIOTHER1@bituliimp.gmail.com>", email: "polisotbs@harel-ins.co.il", customerName: "ישראל ישראלי" },
  { token: "c", ref: "GICLAL22", messageId: "<GICLAL22@bituliimp.gmail.com>", email: "bitulp@clal-ins.co.il", customerName: "דנה כהן" }
];
const byCode = replyFns.matchCancelReply({ subject: "Re: בקשה", text: "קוד GIAB12CD", from: "clerk@harel-ins.co.il" }, sends);
assert(byCode && byCode.token === "a", "a code in the reply selects that letter");
assert(replyFns.matchCancelReply({ subject: "GIAB12CD וגם GIOTHER1", text: "" }, sends) == null, "two codes are not assigned");
const byThread = replyFns.matchCancelReply({ subject: "תשובה", inReplyTo: "<GIAB12CD@bituliimp.gmail.com>", from: "desk@harel-ins.co.il" }, [sends[0], sends[2]]);
assert(byThread && byThread.token === "a", "a thread id selects that letter");
assert(replyFns.matchCancelReply({ references: "<GIAB12CD@bituliimp.gmail.com> <GICLAL22@bituliimp.gmail.com>" }, [sends[0], sends[2]]) == null, "two threads are not assigned");
const byName = replyFns.matchCancelReply({ subject: "דנה כהן", text: "התקבל", from: "BitulP@clal-ins.co.il" }, sends);
assert(byName && byName.token === "c", "one company address plus one customer name selects that letter");
assert(replyFns.matchCancelReply({ subject: "ישראל ישראלי", text: "ישראל ישראלי", from: "polisotbs@harel-ins.co.il" }, sends) == null, "two letters for the same customer at the same company are not assigned");
assert(replyFns.matchCancelReply({ subject: "ישראל ישראלי", text: "ישראל ישראלי", from: "other@gmail.com" }, sends) == null, "an unknown sender without a code is not assigned");
const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n").toString("base64");
const raw = [
  "From: =?UTF-8?B?" + Buffer.from("הראל").toString("base64") + "?= <polisotbs@harel-ins.co.il>",
  "Subject: Re: GIAB12CD",
  "Message-ID: <reply-1@harel-ins.co.il>",
  "In-Reply-To: <GIAB12CD@bituliimp.gmail.com>",
  "Date: Tue, 6 Oct 2026 10:00:00 +0300",
  "MIME-Version: 1.0",
  "Content-Type: multipart/mixed; boundary=\"b1\"",
  "",
  "--b1",
  "Content-Type: text/plain; charset=UTF-8",
  "Content-Transfer-Encoding: base64",
  "",
  Buffer.from("התקבל המכתב").toString("base64"),
  "--b1",
  "Content-Type: application/pdf; name=\"ans.pdf\"",
  "Content-Transfer-Encoding: base64",
  "Content-Disposition: attachment; filename=\"ans.pdf\"",
  "",
  pdf,
  "--b1",
  "Content-Type: application/pdf",
  "Content-Transfer-Encoding: base64",
  "Content-Disposition: attachment; filename=\"note.pdf\"",
  "",
  Buffer.from("not a pdf").toString("base64"),
  "--b1--",
  ""
].join("\r\n");
const parsed = replyFns.parseCancelRfc822(raw);
assert(parsed.from.indexOf("הראל") >= 0 && parsed.from.indexOf("polisotbs@harel-ins.co.il") >= 0, "the sender name is decoded");
assert(parsed.text.indexOf("התקבל המכתב") >= 0, "the reply text is decoded");
assert(parsed.fileName === "ans.pdf" && parsed.fileBase64.indexOf("JVBERi") === 0, "a real pdf attachment is kept");
assert(parsed.inReplyTo === "<GIAB12CD@bituliimp.gmail.com>", "the thread id is kept");
const junk = replyFns.parseCancelRfc822("From: a@b.co\r\nSubject: hi\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n" + Buffer.from("hello world, this is not a pdf at all!!").toString("base64"));
assert(!junk.fileBase64, "a part that is not a pdf is not stored");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
