/* GI-SIGN — החתמת טופס ביטול.
   לינק אישי לכל מבוטח, חתימה בתא המודפס, ומסמך אחד בלי כפילות.
   הרצה: node _test-gi-sign.js
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

function loadEngine(){
  const src = fs.readFileSync(path.join(ROOT, "gi-sign-engine.js"), "utf8");
  const sandbox = { console, URL, Intl, Date };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: "gi-sign-engine.js" });
  return sandbox.GiSignEngine;
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const forms = fs.readFileSync(path.join(ROOT, "gi-cancel-forms.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const page = fs.readFileSync(path.join(ROOT, "s.html"), "utf8");
const pageJs = fs.readFileSync(path.join(ROOT, "gi-sign-page.js"), "utf8");
const signJs = fs.readFileSync(path.join(ROOT, "gi-sign.js"), "utf8");
const edge = fs.readFileSync(path.join(ROOT, "supabase/functions/gi-sign/index.ts"), "utf8");
const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-sign.sql"), "utf8");
const E = loadEngine();

console.log("1) syntax");
["gi-sign-engine.js", "gi-sign.js", "gi-sign-page.js", "gi-cancel-forms.js", "app.js"].forEach((file) => {
  assert(spawnSync(process.execPath, ["--check", path.join(ROOT, file)]).status === 0, "node --check " + file);
});

console.log("\n2) permission and short link");
assert(E.canSendRole("admin") && E.canSendRole("manager") && E.canSendRole("מנהל") && E.canSendRole("מנהל מערכת"), "מנהל ומנהל מערכת");
assert(!E.canSendRole("agent") && !E.canSendRole("ops") && !E.canSendRole("teamManager"), "שאר התפקידים בלי שליחה");
assert(signJs.includes("canSendCancelSign") && app.includes("globalThis.Auth = Auth"), "הלחיצה רואה את אותו מנהל שהכפתור רואה");
const token = E.shortToken(() => 7);
assert(/^[A-Za-z0-9]{8}$/.test(token), "קוד לינק באורך 8");
assert(E.signLink("https://crm.example/gemel-invest/index.html", token) === "https://crm.example/gemel-invest/s/" + token, "לינק קצר מתחת לתיקיית המערכת");
assert(E.tokenFromLocation("/gemel-invest/s/" + token, "") === token, "הדף קורא את הקוד מהנתיב");
assert(!E.signLink("https://crm.example/index.html", token).includes("doc_cancel"), "אין מזהה מסמך בלינק");

console.log("\n3) greeting, toast, success page");
assert(E.greeting("ישראל ישראלי", new Date("2026-10-02T06:30:00+03:00")) === "בוקר טוב, ישראל ישראלי", "ברכת בוקר עם שם");
assert(E.toastText("דנה לוי") === "דנה לוי חתם על המסמכים. הם זמינים לצפייה בתיק", "נוסח הטוסט");
assert(signJs.includes("פתח") && signJs.includes("playSound"), "טוסט עם פתיחה וצליל");
assert(page.includes("החתימה נקלטה בהצלחה") && page.includes("תודה על שיתוף הפעולה") && page.includes("הורד לטלפון"), "מסך הצלחה והורדה");
assert(page.includes('name="viewport"') && page.includes("לחץ לחתימה") && page.includes("אשר ושלח") && page.includes("שמור"), "דף מותאם לנייד עם חתימה ושמירה");

console.log("\n4) signature cells stay on the printed box");
Object.keys(E.SIGNATURE_BOXES).forEach((id) => {
  const boxes = E.boxesFor(id);
  assert(boxes.length > 0 && boxes.every((cell) => E.boxIsClear(cell)), id + " תא חתימה ברור");
});
const phoenix = E.pdfRect(E.boxesFor("phoenix")[0]);
assert(phoenix.width > 100 && phoenix.height >= 28, "הפניקס ממלא את התא שמעל הכיתוב חתימה");
const migdal = E.pdfRect(E.boxesFor("migdal")[0]);
assert(migdal.y > 0 && migdal.width >= 80, "מגדל יושב במלבן חתימת המבוטח");

console.log("\n5) one link per signer, one document");
const primary = { _type: "primary", _id: "p1", fullName: "מבוטח ראשי", birthDate: "1980-01-01" };
const spouse = { _type: "spouse", _id: "p2", fullName: "מבוטח משני", birthDate: "1982-04-04" };
const child = { _type: "child", _id: "c1", fullName: "ילד קטן", birthDate: "2016-06-01" };
const adultChild = { _type: "child", _id: "c2", fullName: "ילד בגיר", birthDate: "2000-02-02" };
assert(E.signersFor("hachshara", [primary, spouse], new Date("2026-10-02")).length === 1, "טופס של חותם אחד נשאר לינק אחד");
const couple = E.signersFor("ayalon", [primary, spouse], new Date("2026-10-02"));
assert(couple.length === 2 && couple[0].name === "מבוטח ראשי" && couple[1].name === "מבוטח משני", "לינק אישי לראשי ולמשני");
assert(couple[0].box.y0 !== couple[1].box.y0, "כל חותם בתא משלו");
const family = E.signersFor("harel_health", [primary, spouse, child, adultChild], new Date("2026-10-02"));
assert(family.length === 3 && !family.some((row) => row.name === "ילד קטן"), "ילד מתחת לגיל 18 לא מקבל לינק");
const docs = [{ id: "doc_cancel_p1_ayalon", type: "company_cancel_form", name: "טופס ביטול" }];
let state = {
  docId: docs[0].id,
  links: [
    { token: "aaaa1111", name: couple[0].name, status: "pending" },
    { token: "bbbb2222", name: couple[1].name, status: "pending" }
  ]
};
state = E.recordSignature(state, "aaaa1111", "2026-10-02T10:00:00.000Z");
let after = E.keepSingleCancelDoc(docs, state.docId, state);
assert(after.length === 1 && after[0].id === docs[0].id, "חתימה ראשונה לא יוצרת טופס נוסף");
state = E.recordSignature(state, "bbbb2222", "2026-10-02T10:05:00.000Z");
after = E.keepSingleCancelDoc(docs, state.docId, state);
assert(after.length === 1 && state.status === "signed" && state.links.length === 2, "שתי חתימות על אותו טופס");
assert(forms.includes("injectDocs") && forms.includes("stripCancelFormDocs"), "הזרקת טפסי הביטול נשארת");
assert(!forms.includes('C("signature"'), "מילוי השדות הקיים לא השתנה לחתימה");

console.log("\n6) wiring stays beside the cancel form");
assert(app.includes('data-send-cancel-sign') && app.includes("saveCancelSignState") && app.includes("giSignByDoc"), "השליחה והשמירה על אותו מסמך");
assert(app.includes("canSendCancelSign") && app.includes("cfFile__documentRowActions"), "הכפתור נשען על ההרשאה ונשאר בשורה");
assert(app.includes("data-open-cancel-form-doc"), "פתיחת טופס הביטול נשארה");
assert(html.includes("app.js?v=20261002-360-sums-health-v1&giSign=6"), "app.js נטען מחדש כדי שהכפתור יופיע");
assert(html.includes("gi-sign.js?v=20261002-sign-v8"), "בדיקת ההרשאה בלחיצה נטענת מחדש");
assert(html.includes("gi-sign-engine.js?v=20261002-sign-v2") && page.includes("gi-sign-engine.js?v=20261002-sign-v2"), "מנוע החתימה נטען מחדש");
assert(signJs.includes("skipCustomersRender: true") && signJs.includes("skipDocPreview: true") && app.includes("skipCustomersRender !== true"), "פתיחה מהטוסט לא טוענת מחדש את כל הלקוחות");
assert(!signJs.includes("storeSignedPdf") && signJs.includes("noteSigned") && app.includes("file: null"), "ה-PDF לא נשמר בתוך תיק הלקוח");
assert(signJs.includes("yieldPaint") && !signJs.includes("renderFileView"), "חלון הלינקים לא מצייר מחדש את התיק");
const sendAt = signJs.indexOf("async function openSend");
const linksAt = signJs.indexOf("showLinks(customerName(rec), shown)", sendAt);
const saveAt = signJs.indexOf("saveCancelSignState", linksAt);
const shortAt = signJs.indexOf("shortenSignHref", sendAt);
assert(signJs.includes("שולח…") && shortAt > sendAt && linksAt > shortAt && saveAt > linksAt, "הכפתור מגיב מיד והלינקים נפתחים לפני השמירה");
assert(signJs.includes("https://is.gd/create.php?format=json&callback=") && signJs.includes("is.gd/"), "הלינק ללקוח מתקצר ב-is.gd בלי לשנות את כתובת המערכת");
assert(signJs.includes("cancelFormPdfBytes") && app.includes("rememberCancelFormPdfBytes"), "שליחה משתמשת ב-PDF שכבר מולא");
assert(app.includes('חתימת מסמך", { rowOnly: true }') && app.includes("options.rowOnly === true"), "השמירה נשארת על תיק הלקוח בלי שמירת כל המערכת");
assert(signJs.includes('action: "status"') && edge.includes('action === "status"') && edge.includes("body.includePdf !== false"), "בדיקת סטטוס לא מורידה את ה-PDF");
assert(app.includes("globalThis.ensureGiCancelFormsLoaded = ensureGiCancelFormsLoaded"), "טעינת טופס הביטול זמינה ללחיצה");
assert(html.includes("gi-sign.css?v=20261002-sign-v3"), "עיצוב הכפתור נטען מחדש");
assert(app.includes('gi-cancel-forms.js?v=20260914-mc-followup-qfix-v2&giSign=2'), "חלון הטופס נטען מחדש");
assert(app.includes("טופס ביטול ") && !app.includes("טופס ביטול מקורי —"), "שם הקובץ הוא טופס ביטול, חברה ומוצר");
assert(forms.includes('return "טופס ביטול " + company'), "שם הטופס בחלון הביטול");
assert(html.includes("gi-sign.js") && html.includes("giSignToastHost"), "הטוסט נטען במערכת");
assert(edge.includes('action === "create"') && edge.includes("canSendRole") && edge.includes("stampPdf"), "השרת בודק הרשאה ומטביע על אותו PDF");
assert(sql.includes("gi_sign_packets") && sql.includes("gi_sign_links") && !sql.includes("alter table public.customers"), "טבלאות חדשות בלי שינוי טבלת הלקוחות");
assert(fs.existsSync(path.join(ROOT, ".github/workflows/deploy-gi-sign.yml")) && fs.existsSync(path.join(ROOT, "scripts/deploy-gi-sign.mjs")), "פריסת שרת החתימה");
assert(fs.readFileSync(path.join(ROOT, "scripts/deploy-gi-sign.mjs"), "utf8").includes("functions\", \"deploy\", \"gi-sign\""), "הסקריפט מפרסם את gi-sign");

console.log("\n7) the customer link asks for an ID before the document");
assert(E.normalizeId("12345678") === "012345678", "תז קצרה מקבלת אפס מוביל");
assert(E.normalizeId("012345678") === "012345678", "תז של 9 ספרות נשארת");
assert(E.normalizeId("1234567890") === "1234567890", "תז ארוכה לא נחתכת");
assert(E.idsMatch("12-345678", "012345678") && !E.idsMatch("111111111", "012345678") && !E.idsMatch("", "012345678"), "השוואת תז");
const idRows = E.signersFor("hachshara", [Object.assign({}, primary, { idNumber: "12345678" })], new Date("2026-10-02"));
assert(idRows.length === 1 && idRows[0].idNumber === "012345678" && !idRows[0].box.idNumber, "הלינק נושא את תעודת הזהות מחוץ לתא החתימה");
assert(page.includes('id="giSignGate"') && page.includes("הזן תעודת זהות") && page.includes("תעודת הזהות לא תואמת"), "מסך תעודת זהות לפני המסמך");
assert(page.includes("gi-sign-page.js?v=20261002-sign-v2"), "דף החתימה נטען מחדש");
const bootFn = pageJs.slice(pageJs.indexOf("async function boot"), pageJs.indexOf("if(typeof document"));
assert(bootFn.includes('action: "peek"') && !bootFn.includes('action: "get"') && !bootFn.includes("pdfBase64"), "פתיחת הלינק לא מושכת את המסמך");
assert(pageJs.includes('action: "get"') && pageJs.includes('idNumber: typed') && pageJs.includes('action: "submit"') && pageJs.includes("idNumber: view.idNumber"), "המסמך והשליחה נפתחים רק עם התז שהוזנה");
assert(!pageJs.includes("localStorage") && !pageJs.includes("sessionStorage") && !page.includes("signer_id"), "התז לא נשמרת בדף ולא חוזרת מהשרת אל המסך");
assert(signJs.includes("חסרה תעודת זהות") && signJs.includes("idNumber: trim(row.idNumber)"), "בלי תז לא נוצר לינק, והתיק שומר אותה לסוכן");
const modalFn = signJs.slice(signJs.indexOf("function showLinks"), signJs.indexOf("function yieldPaint"));
assert(!modalFn.includes("idNumber"), "חלון הלינקים לא מציג תעודת זהות");
assert(app.includes("idNumber: safeTrim(row && row.idNumber)"), "שמירת התיק מחזיקה את התז של הלינק");
assert(edge.includes('error: "ID_MISMATCH"') && edge.includes('error: "NEEDS_RESEND"') && edge.includes('error: "MISSING_ID"'), "שרת דוחה תז לא תואמת ולינק בלי תז");
assert(edge.includes('action === "peek"') && edge.includes("signer_id: row.idNumber"), "התז נשמרת בעמודה ולא בתוך התא");
const opened = edge.slice(edge.indexOf("function openedPacket"), edge.indexOf("async function peekPacket"));
assert(!opened.includes("signer_id") && !opened.includes("signerId"), "תשובת המסמך לא כוללת את התז");
const peekFn = edge.slice(edge.indexOf("async function peekPacket"), edge.indexOf("async function linkStatus"));
assert(peekFn.includes("locked") && !peekFn.includes("pdfBase64") && !peekFn.includes("signer_name"), "לפני התאמה אין מסמך ואין שם");
const statusFn = edge.slice(edge.indexOf("async function linkStatus"), edge.indexOf("async function getPacket"));
assert(statusFn.includes("signedAt") && !statusFn.includes("pdf") && !statusFn.includes("signer"), "סטטוס לסוכן בלי מסמך ובלי תז");
assert(sql.includes("signer_id text not null default ''") && sql.includes("add column if not exists signer_id"), "עמודת התז מתווספת בלי למחוק לינקים");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
