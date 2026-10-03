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
  const formsSrc = fs.readFileSync(path.join(ROOT, "gi-sign-forms.js"), "utf8");
  vm.runInNewContext(formsSrc, sandbox, { filename: "gi-sign-forms.js" });
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
const css = fs.readFileSync(path.join(ROOT, "gi-sign.css"), "utf8");
const E = loadEngine();

console.log("1) syntax");
["gi-sign-engine.js", "gi-sign-forms.js", "gi-sign.js", "gi-sign-page.js", "gi-cancel-forms.js", "app.js"].forEach((file) => {
  assert(spawnSync(process.execPath, ["--check", path.join(ROOT, file)]).status === 0, "node --check " + file);
});

console.log("\n2) permission and short link");
assert(E.canSendRole("admin") && E.canSendRole("manager") && E.canSendRole("מנהל") && E.canSendRole("מנהל מערכת"), "מנהל ומנהל מערכת");
assert(!E.canSendRole("agent") && !E.canSendRole("ops") && !E.canSendRole("teamManager"), "שאר התפקידים בלי שליחה");
assert(E.canSendFormsRole("ops") && E.canSendFormsRole("opsAgent") && E.canSendFormsRole("נציג תפעול") && E.canSendFormsRole("manager"), "תפעול שולח טפסי הצעה");
assert(!E.canSendFormsRole("agent") && !E.canSendFormsRole("elementary") && !E.canSendFormsRole("teamManager") && !E.canSendFormsRole("referent") && !E.canSendFormsRole("סוקרת"), "נציג, אלמנטרי, מנהל צוות וסוקרת עדיין סגורים");
assert(E.FORMS_SEND_ON.ops === true && E.FORMS_SEND_ON.opsagent === true && E.FORMS_SEND_ON.agent === false && E.FORMS_SEND_ON.referent === false, "מתג הרשאה מוכן לכל תפקיד");
assert(!E.canSendRole("ops"), "טופס ביטול נשאר למנהל");
assert(signJs.includes("canSendCancelSign") && app.includes("globalThis.Auth = Auth"), "הלחיצה רואה את אותו מנהל שהכפתור רואה");
const token = E.shortToken(() => 7);
assert(/^[A-Za-z0-9]{8}$/.test(token), "קוד לינק באורך 8");
assert(E.signLink("https://crm.example/gemel-invest/index.html", token) === "https://crm.example/gemel-invest/s/" + token, "לינק קצר מתחת לתיקיית המערכת");
assert(E.tokenFromLocation("/gemel-invest/s/" + token, "") === token, "הדף קורא את הקוד מהנתיב");
assert(E.tokenFromLocation("/gemel-invest/s.html", "#" + token) === token, "הדף קורא את הקוד מכתובת s.html");
assert(E.tokenFromLocation("/gemel-invest/s.html", "", "?t=" + token) === token, "הדף קורא את הקוד משאילתת הלינק");
assert(!E.signLink("https://crm.example/index.html", token).includes("doc_cancel"), "אין מזהה מסמך בלינק");

console.log("\n3) greeting, toast, success page");
assert(E.greeting("ישראל ישראלי", new Date("2026-10-02T06:30:00+03:00")) === "בוקר טוב, ישראל ישראלי", "ברכת בוקר עם שם");
assert(E.toastText("דנה לוי") === "דנה לוי חתם על המסמכים. הם זמינים לצפייה בתיק", "נוסח הטוסט");
assert(signJs.includes("פתח") && signJs.includes("playSound"), "טוסט עם פתיחה וצליל");
assert(page.includes("שביעות הרצון מהנציג") && page.includes("שירות מעולה") && page.includes("מרוצה אבל לא עד הסוף") && page.includes("חוויית שירות לא טובה") && page.includes("תודה שענית על הסקר") && page.includes("תהליך ההחתמה הסתיים בהצלחה") && page.includes("הורד מסמך התאמת צרכים") && page.includes('data-gi-survey="good"') && page.includes('data-gi-survey="ok"') && page.includes('data-gi-survey="bad"'), "מסך הצלחה והורדה");
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
assert(html.includes("app.js?v=20261002-360-sums-health-v1&giSign=20"), "app.js נטען מחדש כדי שהכפתור יופיע");
assert(html.includes("gi-sign.js?v=20261002-sign-v32"), "בדיקת ההרשאה בלחיצה נטענת מחדש");
assert(html.includes("gi-sign-engine.js?v=20261002-sign-v9") && page.includes("gi-sign-engine.js?v=20261002-sign-v9"), "מנוע החתימה נטען מחדש");
assert(html.includes("gi-sign-forms.js?v=20261002-sign-v2"), "מפת תאי החתימה נטענת עם הטפסים");
assert(signJs.includes("skipCustomersRender: true") && signJs.includes("skipDocPreview: true") && app.includes("skipCustomersRender !== true"), "פתיחה מהטוסט לא טוענת מחדש את כל הלקוחות");
assert(!signJs.includes("storeSignedPdf") && signJs.includes("noteSigned") && app.includes("file: null"), "ה-PDF לא נשמר בתוך תיק הלקוח");
assert(signJs.includes("yieldPaint") && !signJs.includes("renderFileView"), "חלון הלינקים לא מצייר מחדש את התיק");
const sendAt = signJs.indexOf("async function openSend");
const openBody = signJs.slice(sendAt, signJs.indexOf("async function syncCustomer"));
const linksAt = openBody.indexOf("showLinks(customerName(rec), links)");
const saveAt = openBody.indexOf("saveCancelSignState");
const fillAt = openBody.indexOf("forms.fillOriginalTemplate(draft)");
const b64At = openBody.indexOf("bytesToBase64");
const shortAt = openBody.indexOf("shareSignHref(");
const edgeAt = openBody.indexOf("callEdge(");
assert(signJs.includes("שולח…") && shortAt > 0 && shortAt < edgeAt && linksAt > edgeAt && saveAt > linksAt, "הלינק מוכן במקביל לשליחה והחלון נפתח לפני השמירה");
assert(signJs.includes("s.html?t=") && signJs.includes('s.html?t=" + id') && !signJs.includes('s.html?t=" + id + "#"') && signJs.includes("function asPreviewHref") && signJs.includes("function shareSignHref") && signJs.includes("function ownSignHref") && signJs.includes("signLink") && signJs.includes("function cardSignHref") && !signJs.includes("https://da.gd") && !signJs.includes("function shortenSignHref") && !signJs.includes("spoo.me") && !signJs.includes("is.gd") && !signJs.includes("github.io"), "הלינק לשיתוף הוא /s/TOKEN של המערכת, בלי מקצר חיצוני");
assert(openBody.lastIndexOf("yieldPaint", fillAt) > openBody.indexOf("cancelFormPdfBytes") && openBody.lastIndexOf("yieldPaint", b64At) > fillAt, "מילוי ה-PDF וההמרה ממתינים לציור המסך");
assert(signJs.includes("cancelFormPdfBytes") && app.includes("rememberCancelFormPdfBytes"), "שליחה משתמשת ב-PDF שכבר מולא");
assert(app.includes('חתימת מסמך", { rowOnly: true }') && app.includes("options.rowOnly === true"), "השמירה נשארת על תיק הלקוח בלי שמירת כל המערכת");
assert(signJs.includes('action: "status"') && edge.includes('action === "status"') && edge.includes("body.includePdf !== false"), "בדיקת סטטוס לא מורידה את ה-PDF");
assert(app.includes("globalThis.ensureGiCancelFormsLoaded = ensureGiCancelFormsLoaded"), "טעינת טופס הביטול זמינה ללחיצה");
assert(html.includes("gi-sign.css?v=20261002-sign-v7"), "עיצוב הכפתור נטען מחדש");
assert(signJs.includes("function signShareText") && signJs.includes("מאת : ") && !signJs.includes("📄") && !signJs.includes("🖊️") && !signJs.includes("מא. ") && signJs.includes("function agentFirstName") && signJs.includes("clipboard.writeText(signShareText(href))") && !signJs.includes("github.io"), "העתקת הלינק לוואטסאפ היא מאת : עם שם פרטי, בלי אייקון ובלי שם המערכת");
const shareFn = signJs.slice(signJs.indexOf("function signShareText"), signJs.indexOf("function currentAgent"));
assert(shareFn.includes("מאת : ") && !shareFn.includes("חתימה על מסמך") && !shareFn.includes("מסמכים לחתימה") && !shareFn.includes("GEMEL") && !shareFn.includes("📄"), "טקסט השיתוף הוא רק מאת : בלי כפילות של מסמכים לחתימה");
assert(page.includes('<title>מסמכים לחתימה</title>') && page.includes('property="og:title" content="מסמכים לחתימה"') && page.includes("https://gemelinvest.github.io/gemel-invest/gi-sign-icon.png?v=sign-og-v9") && page.includes('property="og:image:secure_url"') && page.includes("summary_large_image") && page.includes('property="og:url"') && page.includes('rel="image_src"') && fs.existsSync(path.join(ROOT, "gi-sign-icon.png")) && !page.includes("gi-sign-card.jpg") && (page.split('property="og:image" content=').length - 1) === 1 && !page.includes("חתימה על מסמך") && !page.includes('content="חתימה"') && !page.includes("GEMEL"), "כרטיס וואטסאפ עם תמונה אחת וכותרת מסמכים לחתימה");
assert(fs.readFileSync(path.join(ROOT, "gi-sign.css"), "utf8").includes("overflow-x:hidden") && fs.readFileSync(path.join(ROOT, "gi-sign.css"), "utf8").includes("text-overflow:ellipsis") && app.includes('cfFile__documentRowActions">${downloadBtn}'), "שורות המסמכים בתיק בשורה אחת בלי גלילה ימין-שמאל");
assert(fs.readFileSync(path.join(ROOT, "gi-sign.css"), "utf8").includes("max-width:min(340px, calc(100vw - 24px)) !important") && signJs.includes("giSignSend__x"), "חלון הלינקים קטן והסגירה בצד");
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
assert(page.includes('id="giSignGate"') && page.includes("הזן סיסמא") && page.includes(">סיסמא<") && page.includes("הסיסמא לא תואמת") && pageJs.includes("הסיסמא לא תואמת") && pageJs.includes("idNumber: typed") && !page.includes("הזן תעודת זהות"), "מסך הכניסה מציג סיסמא ובפועל בודק תז");
assert(page.includes("giSignGate") && page.includes("giSignGate__box") && page.includes("align-items: center") && page.includes("align-self: center") && page.includes("max-width: none") && page.includes("כניסה לחתימה"), "מסך הכניסה ממורכז ופרוש לכל גודל מסך");
assert(page.includes('class="giSignLogo"') && page.indexOf("giSignLogo") < page.indexOf(">כניסה לחתימה<") && page.includes("#3870ED") && page.includes("<svg"), "לוגו מסמכים ועט מעל הכותרת");
assert(page.includes("gi-sign-page.js?v=20261002-sign-v13"), "דף החתימה נטען מחדש");
assert(page.includes("giSignStageWrap") && page.includes("pdf_viewer.css") && pageJs.includes("pdf_viewer.js") && pageJs.includes('currentScaleValue = "page-width"') && pageJs.includes("AnnotationMode.ENABLE_FORMS") && pageJs.includes("textLayerMode: 0"), "דף החתימה מציג את הקובץ המקורי כמו בתיק הלקוח");
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

console.log("\n8) one signer at a time, toast only when everyone finished");
const now = new Date("2026-10-03T12:00:00.000Z");
const future = "2026-10-03T12:01:00.000Z";
const past = "2026-10-03T11:59:00.000Z";
assert(E.holdIsFree("", "", "aaaa1111", now), "בלי נועל המסמך פנוי");
assert(E.holdIsFree("aaaa1111", future, "aaaa1111", now), "מי שחותם שומר את המסמך");
assert(!E.holdIsFree("bbbb2222", future, "aaaa1111", now), "מבוטח אחר שמחכה לא נכנס");
assert(E.holdIsFree("bbbb2222", past, "aaaa1111", now), "נעילה של דף שנסגר מתפנה");
assert(page.includes('id="giSignWait"') && page.includes("אנא המתן"), "מסך המתנה בלי המסמך");
assert(pageJs.includes("מבצע חתימה") && pageJs.includes('action: "beat"') && pageJs.includes('action: "release"') && pageJs.includes("setInterval") && pageJs.includes("data.waiting"), "הממתין נפתח לבד והנעילה יורדת כשסוגרים");
const getFn = edge.slice(edge.indexOf("async function getPacket"), edge.indexOf("async function beatHold"));
const waitFn = edge.slice(edge.indexOf("function waiting"), edge.indexOf("async function claimHold"));
assert(waitFn.includes("waiting: true") && !waitFn.includes("pdfBase64") && !waitFn.includes("signer_id"), "בזמן המתנה אין מסמך ואין תז");
assert(getFn.includes("claimHold") && getFn.indexOf("managerPreview") < getFn.indexOf("claimHold") && getFn.includes('trim(row.link.status) === "signed"'), "המסמך ננעל רק למי שחותם עכשיו");
const submitFn = edge.slice(edge.indexOf("async function submitSignature"), edge.indexOf("Deno.serve"));
assert(submitFn.indexOf("claimHold") < submitFn.indexOf("stampPdf") && submitFn.includes('holder_token: ""') && submitFn.includes("complete"), "החתימה נשמרת על אותו PDF ורק אחרי כולם ההודעה מסומנת");
const toastFn = signJs.slice(signJs.indexOf('event: "signed"'), signJs.indexOf("state.channel.subscribe"));
assert(toastFn.indexOf("noteSigned") < toastFn.indexOf("showSignedToast") && toastFn.includes("payload.complete === true"), "ההודעה לנציג קופצת רק כשכל המבוטחים סיימו");
assert(sql.includes("holder_token text not null default ''") && sql.includes("holder_name text not null default ''") && sql.includes("holder_until timestamptz"), "הנעילה מתווספת בלי למחוק טפסים");

console.log("\n9) proposal forms and follow-up questionnaires");
const ciBoxes = E.formBoxes("hachshara_ci_form");
assert(ciBoxes.some((cell) => cell.slot === "self") && ciBoxes.some((cell) => cell.slot === "spouse"), "הכשרה מחלות קשות: תא לראשי ותא לבן הזוג");
const phoenixCi = E.formBoxes("phoenix_ci_form");
assert(phoenixCi.filter((cell) => cell.slot === "self").length >= 2 && phoenixCi.some((cell) => cell.slot === "child:0" && cell.adultsOnly), "הפניקס מחלות קשות: כמה תאים, וילד רק מגיל 18");
const ayalonPage = E.followupBoxes("ayalon", 1);
assert(ayalonPage.length >= 1 && ayalonPage[0].page === 0, "שאלון המשך נחתם על העמוד הבודד שנשמר");
const formPrimary = { _type: "primary", _id: "p", fullName: "דנה לוי", idNumber: "012345678" };
const formSpouse = { _type: "spouse", _id: "s", fullName: "יוסי לוי", idNumber: "023456789" };
const formChild = { _type: "child", _id: "c", fullName: "נועה לוי", idNumber: "034567890", birthDate: "2015-01-01" };
const formAdult = { _type: "child", _id: "a", fullName: "אור לוי", idNumber: "045678901", birthDate: "2000-01-01" };
const grouped = E.signersFromBoxes([
  { slot: "self", page: 0, x0: 10, y0: 10, x1: 110, y1: 30 },
  { slot: "self", page: 2, x0: 10, y0: 40, x1: 110, y1: 60 },
  { slot: "spouse", page: 0, x0: 200, y0: 10, x1: 300, y1: 30 }
], [formPrimary, formSpouse], new Date("2026-10-03"));
assert(grouped.length === 2 && grouped[0].boxes.length === 2 && grouped[1].boxes.length === 1, "כל התאים של מבוטח נכנסים ללינק אחד");
const minor = E.signersFromBoxes([
  { slot: "child:0", page: 0, x0: 10, y0: 10, x1: 110, y1: 30, adultsOnly: true }
], [formPrimary, formChild], new Date("2026-10-03"));
assert(minor.length === 0, "ילד מתחת לגיל 18 לא מקבל לינק");
const grown = E.signersFromBoxes([
  { slot: "adultChild", page: 0, x0: 10, y0: 10, x1: 110, y1: 30, adultsOnly: true }
], [formPrimary, formChild, formAdult], new Date("2026-10-03"));
assert(grown.length === 1 && grown[0].name === "אור לוי" && grown[0].idNumber === "045678901", "ילד מגיל 18 חותם רק בתא שלו");
assert(app.includes("data-mc-summary-sign") && app.includes('data-mc-summary-form="send-sign"') && app.includes("טפסים ממולאים אחרי תיקון השיקוף"), "בסוף השיקוף מסמנים אילו טפסים נשלחים");
const prepareAt = app.indexOf("async _mcPrepareSummaryFilledForms(rec){");
const prepareBody = prepareAt >= 0 ? app.slice(prepareAt, app.indexOf("_mcHatamaCacheKey(rec){", prepareAt)) : "";
assert(prepareBody.includes("_mcEnsureJoinFormEdits") && prepareBody.includes("_mcPaintSummaryFilledForms") && !prepareBody.includes("_mcMaterializeEditedForms") && !prepareBody.includes("_mcPrefetchHatamaSign") && !prepareBody.includes("_mcHydrateFilledFormsFromCache"), "פתיחת פאנל הטפסים לא בונה PDF ברקע ולא חוסמת סימון");
assert(app.includes('body.querySelectorAll("[data-mc-summary-sign]:checked")') && app.includes("el.checked = true"), "סימון קיים נשמר אם הרשימה מצוירת מחדש");
const watchAt = signJs.indexOf("function watchLive(getRec, paint){");
const watchBody = watchAt >= 0 ? signJs.slice(watchAt, signJs.indexOf("function agentFirstName()", watchAt)) : "";
assert(watchBody.includes("giSignByDoc") && watchBody.includes("if(!any) return"), "בלי לינקים חיים אין משיכת לוח כל שתי שניות");
assert(signJs.includes("openFormsSend") && signJs.includes('scope: "forms"') && signJs.includes("signersFromBoxes") && signJs.includes("mergeFormPdfs"), "הטפסים שסומנו נפתחים בלינק אחד");
assert(signJs.includes("originalSignPdfBytes") && signJs.includes("list.length === 1") && app.includes("async originalSignPdfBytes") && app.includes("_mcOriginalJoinSignBytes") && app.includes("fillFollowupPdf"), "השליחה לוקחת את קובץ הטופס המקורי, וקובץ יחיד לא מצויר מחדש");
assert(signJs.includes("function storedPdfBytes") && signJs.includes("bytesToBase64Idle") && signJs.includes("fetchStoredPdfBytes") && signJs.includes("hatamaSignPdfForSend") && signJs.includes("MirrorCallUI") && signJs.includes("Promise.all(list.map((item) => bytesForSendItem") && !signJs.includes("אפשר לשלוח רק טופס שכבר מולא") && app.includes("giOpsHoldNote(true, \"send\")") && app.includes("giOpsHoldSpin") && app.includes("מכין את המסמכים לשליחה") && app.includes("מכין את המסמך לפתיחה") && app.includes("_mcShareFilledForm") && app.includes("_mcSummaryFormBytes") && app.includes("originalSignPdfBytes") && app.includes("מסך הלינקים") && app.includes("_mcPrefetchHatamaSign") && app.includes("hatamaSignPdfForSend") && app.includes("cells: self._mcCopyHatamaCells(cells)") && app.includes("globalThis.MirrorCallUI = MirrorCallUI"), "טופס שכבר קיים נשלח כמו שהוא, פתיחה והורדה בונות את אותו PDF, ומסך ההמתנה מכסה גם פתיחה");
assert(signJs.includes("row.label || row.name"), "שם מבוטח שנשמר כתווית נמצא בשליחה");
assert(pageJs.includes("giSignSheet") && pageJs.includes("stamps") && edge.includes("canSendFormsRole") && edge.includes('trim(body.scope) === "forms"') && edge.includes("boxes: cells"), "כל עמוד וכל תא נחתמים, ותפעול לא נפתח לטופס ביטול");
const agentCells = E.formBoxes("hachshara_ci_form").filter((cell) => cell.slot === "agent");
assert(agentCells.length >= 1, "הכשרה מחלות קשות: תא חתימה לסוכן");
const agentLink = E.agentSigner(agentCells, ["12345678", "23456789"], "רונית הסוכנת");
assert(agentLink && agentLink.slot === "agent" && agentLink.name === "רונית הסוכנת" && agentLink.boxes.length === agentCells.length && agentLink.idNumbers.length === 2, "לינק אחד לסוכן עם כל התאים שלו");
assert(E.idsAllow(agentLink.idNumbers.join(","), "23456789") && E.idsAllow(agentLink.idNumbers.join(","), "012345678") && !E.idsAllow(agentLink.idNumbers.join(","), "999999999"), "כל תז של מבוטח פותחת את לינק הסוכן");
assert(!E.agentSigner([], ["012345678"], "הסוכן"), "בלי תא של סוכן אין לינק סוכן");
const formsSend = signJs.slice(signJs.indexOf("async function openFormsSend"), signJs.indexOf("async function syncCustomer"));
assert(formsSend.includes("agentSigner") && formsSend.includes("signers.map((row) => row.idNumber)") && formsSend.includes('cell.slot !== "agent"'), "שליחת הטפסים מוסיפה את לינק הסוכן");
const cancelSend = signJs.slice(signJs.indexOf("async function openSend"), signJs.indexOf("async function openFormsSend"));
assert(!cancelSend.includes("agentSigner"), "טופס הביטול נשאר בלי לינק סוכן");
assert(edge.includes("function idsAllow") && edge.includes("signer.idNumbers") && edge.includes('ids.join(",")'), "השרת מקבל כל תז של מבוטח בלינק הסוכן");
assert(page.includes('id="giSignStep"') && pageJs.includes('חתימה " + n + " מתוך "') && pageJs.includes("scrollIntoView") && pageJs.includes("jumpToCell"), "אחרי שמור המסך קופץ לחתימה הבאה ורושם כמה מתוך");
assert(page.includes('id="giSignCelebrate"') && pageJs.includes("playDone") && pageJs.includes("findIndex((cell) => !cell.png)"), "בלי חתימה חסרה יש אנימציה, ואם חסרה המסך חוזר אליה");
assert(pageJs.includes('action: "survey"') && pageJs.includes("pickSurvey") && pageJs.includes("showThanks") && edge.includes('action === "survey"') && edge.includes('score !== "good"') && sql.includes("survey text") && sql.includes("survey_at timestamptz"), "אחרי האנימציה הלקוח מדרג שביעות רצון והדירוג נשמר");
assert(app.includes('kind: "hatama"') && app.includes("מסמך התאמה") && app.includes('data-mc-summary-form="send-sign"${sendDisabled}'), "מסמך ההתאמה ברשימה, והכפתור מוצג גם כשהוא לא לחיץ");
assert(app.includes("function giArrivalDocsReady()") && app.includes("docs.hatamaSignPdf") && app.includes('gi-arrival-docs.js?v=20261002-360-sums-health-v1&giSign=3') && app.includes("stale.remove()"), "טופס התאמה ישן נטען מחדש לפני השליחה");
assert(app.includes('data-gi-sending') && app.includes('getAttribute("data-gi-sending") === "1"'), "לחיצה כפולה על שלח לחתימה לא שולחת פעמיים");
const arrival = fs.readFileSync(path.join(ROOT, "gi-arrival-docs.js"), "utf8");
assert(arrival.includes('data-gi-sign-slot="self"') && arrival.includes("hatamaSignPdf") && !arrival.includes('חתימת בעל הרישיון: ${escapeHtml(draft.agent?.name || AGENCY)}<div class="giSign__line" data-gi-sign-slot'), "במסמך ההתאמה מסומנת רק חתימת המבוטח");
assert(getFn.includes("idsAllow(row.link.signer_id, body.idNumber)") && submitFn.includes("idsAllow(row.link.signer_id, body.idNumber)"), "כניסה ושליחה בודקות כל תז בלי לאחד את הספרות");

console.log("\n10) live signature status for the agent");
const waitingBoth = E.signBoard([
  { name: "דנה", slot: "self", status: "pending" },
  { name: "רונית", slot: "agent", status: "pending" }
], new Date("2026-10-03T12:00:00.000Z"));
assert(waitingBoth && waitingBoth.title === "ממתין לחתימות מבוטח/ים + סוכן" && waitingBoth.rows.every((row) => row.detail === "חסרה חתימה"), "בלי חתימה מופיעים המבוטח והסוכן עם חוסר");
const liveNow = new Date("2026-10-03T12:00:00.000Z");
const liveStep = E.signBoard([
  { name: "דנה", slot: "self", status: "pending", openedAt: "2026-10-03T11:59:50.000Z", progressAt: "2026-10-03T11:59:55.000Z", step: 5, total: 10 },
  { name: "רונית", slot: "agent", status: "signed" }
], liveNow);
assert(liveStep && liveStep.title === "ממתין לחתימות מבוטח/ים" && liveStep.rows.length === 1 && liveStep.rows[0].name === "דנה" && liveStep.rows[0].detail === "חתימה 5 מתוך 10", "שלב החתימה הנוכחי מופיע בלייב");
const openedOnly = E.signBoard([
  { name: "דנה", slot: "self", status: "pending", openedAt: "2026-10-03T11:00:00.000Z", progressAt: "2026-10-03T11:00:00.000Z", step: 2, total: 10 }
], liveNow);
assert(openedOnly && openedOnly.rows[0].detail === "פתח את החתימה", "פתיחת החתימה נשארת גם אחרי שהשלב כבר לא חי");
const onlyAgent = E.signBoard([{ name: "רונית", slot: "agent", status: "pending" }], liveNow);
assert(onlyAgent && onlyAgent.title === "ממתין לחתימת סוכן" && onlyAgent.rows[0].detail === "חסרה חתימה", "כשנשאר רק הסוכן זה מופיע בשמו");
const readyBoard = E.signBoard([
  { name: "דנה", slot: "self", status: "signed" },
  { name: "רונית", slot: "agent", status: "signed" }
], liveNow);
assert(readyBoard && readyBoard.state === "ready" && readyBoard.title === "המסמך חתום ומוכן", "אחרי כולם המסמך חתום ומוכן");
assert(pageJs.includes('action: "touch"') && pageJs.includes("reportStep"), "החותם מדווח את השלב הנוכחי");
const boardFn = edge.slice(edge.indexOf("async function boardLinks"), edge.indexOf("async function submitSignature"));
assert(edge.includes('action === "touch"') && edge.includes('action === "board"') && boardFn.includes("opened_at") && !boardFn.includes("signer_id"), "לוח הסטטוס בלי תעודת זהות");
assert(sql.includes("opened_at timestamptz") && sql.includes("step_n integer") && sql.includes("progress_at timestamptz"), "השלב נשמר בלי למחוק לינקים");
assert(app.includes("data-gi-sign-live") && app.includes("liveHtml") && signJs.includes("watchLive") && signJs.includes('action: "board"'), "הרשימה מציירת את הסטטוס החי");
assert(signJs.includes('class="giSignLive is-ready"') && css.includes("giSignLive__check") && css.includes("#16a34a"), "מסמך מוכן מסומן בוי ירוק");
assert(css.includes("[data-mc-summary-forms] .mtqFormRow__name") && css.includes("font-size:17px") && css.includes("[data-mc-summary-forms] .giSignLive") && css.includes("[data-mc-summary-forms] .mtqBtn--sm"), "טקסטים בפאנל הטפסים הממולאים מוגדלים");

console.log("\n11) midnight expiry, reused signatures, personal WhatsApp card");
const beforeMidnight = new Date("2026-10-02T23:50:00+03:00");
const afterMidnight = new Date("2026-10-03T00:00:20+03:00");
const sentAt = "2026-10-02T10:00:00+03:00";
const nextMidnight = E.israelNextMidnight(new Date(sentAt));
assert(nextMidnight > new Date(sentAt).getTime() && nextMidnight <= afterMidnight.getTime(), "חצות ישראל היא תחילת היום הבא");
assert(!E.linkExpired({ status: "pending", createdAt: sentAt }, beforeMidnight), "לפני חצות הלינק בתוקף");
assert(E.linkExpired({ status: "pending", createdAt: sentAt }, afterMidnight), "אחרי חצות הלינק לא בתוקף");
assert(!E.linkExpired({ status: "signed", createdAt: sentAt }, afterMidnight), "חתימה שכבר נקלטה לא פוקעת");
assert(E.linkExpired({ status: "pending", expiresAt: "2026-10-02T21:00:00.000Z" }, new Date("2026-10-02T21:00:00.000Z")), "פקיעה לפי expiresAt");
assert(E.deriveStatus([{ status: "pending", createdAt: sentAt }], afterMidnight) === "expired" && E.statusLabel("expired") === "פג תוקף", "סטטוס פג תוקף אחרי חצות");
const expiredBoard = E.signBoard([{ name: "דנה", slot: "self", status: "pending", createdAt: sentAt }], afterMidnight);
assert(expiredBoard && expiredBoard.state === "expired" && expiredBoard.title === "הלינק לא בתוקף" && expiredBoard.rows[0].detail === "פג תוקף", "לוח הסוכן מציג לינק לא בתוקף");
const mixedBoard = E.signBoard([
  { name: "דנה", slot: "self", status: "pending", expiresAt: "2026-10-02T21:00:00.000Z" },
  { name: "יוסי", slot: "self", status: "pending", expiresAt: "2026-10-04T21:00:00.000Z" }
], new Date("2026-10-03T12:00:00.000Z"));
assert(mixedBoard && mixedBoard.state === "waiting" && mixedBoard.rows[0].detail === "פג תוקף" && mixedBoard.rows[1].detail === "חסרה חתימה", "רק מי שפג לו מוצג כפג תוקף");
assert(edge.includes("function reuseStampedPdf") && edge.includes('.select("id")') && edge.includes('.select("pdf_base64")') && !edge.includes('.select("id,pdf_base64")') && edge.includes('error: "ALL_SIGNED"') && edge.includes("israelNextMidnight") && edge.includes("packetExpired") && edge.includes('error: "EXPIRED"'), "השרת שומר PDF חתום, מדלג על מי שחתם, וחוסם לינק שפג");
assert(edge.includes("async function serveCard") && edge.includes("/card/") && edge.includes("שלום: ") && edge.includes("קבלת מסמכים לחתימה") && edge.includes("isOgBot") && edge.includes("og_png") && edge.includes("max-age=604800") && !edge.includes("http-equiv") && edge.includes("og:url"), "כרטיס וואטסאפ אישי מהשרת בלי רענון שמעלים את התמונה");
assert(sql.includes("expires_at timestamptz") && sql.includes("open_href text") && sql.includes("og_png text"), "עמודות תוקף וכרטיס מתווספות בלי מחיקה");
assert(signJs.includes("function shareSignHref") && signJs.includes("function ownSignHref") && signJs.includes("signLink") && !signJs.includes("https://da.gd") && !signJs.includes("function shortenSignHref") && signJs.includes('FN_PATH + "/card/"') && signJs.includes("s.html?t=") && signJs.includes("openHref") && page.includes("gi-sign-icon.png?v=sign-og-v9") && page.includes('property="og:image"') && pageJs.includes("location.search") && fs.existsSync(path.join(ROOT, "robots.txt")) && fs.readFileSync(path.join(ROOT, "robots.txt"), "utf8").includes("WhatsApp"), "הלינק לשיתוף הוא /s/TOKEN של המערכת, בלי מקצר חיצוני");
assert(signJs.includes("function drawWhiteDownArrow") && signJs.includes("function ogPngForSigner") && signJs.includes("יש ללחוץ על הלינק בכדי להתחיל") && !signJs.includes("שמופיע מטה") && !signJs.includes("לחץ על הלינק למטה כדי להתחיל") && signJs.includes("קבלת מסמכים לחתימה") && signJs.includes("שלום: ") && !signJs.includes("drawDownFinger") && !signJs.includes("👇") && !signJs.includes("1F447") && !/\u{1F447}/u.test(signJs) && !signJs.includes("#f2c29c"), "חץ לבן מצויר למטה, בלי יד צבעונית ובלי אימוג'י");
const icon = fs.readFileSync(path.join(ROOT, "gi-sign-icon.png"));
assert(icon[0] === 0x89 && icon[1] === 0x50 && icon.readUInt32BE(16) === 1200 && icon.readUInt32BE(20) === 630, "תמונת הכרטיס הקבועה היא PNG 1200 על 630");
assert(signJs.includes("ALL_SIGNED") && signJs.includes("המסמך כבר חתום") && signJs.includes("expiresAt: trim(created.expiresAt)"), "שליחה מחדש אחרי שכולם חתמו, ותוקף נשמר אצל הסוכן");
assert(pageJs.includes("הלינק לא בתוקף. בקשו מהסוכן לשלוח לינק חדש.") && pageJs.includes("failExpired") && pageJs.includes("EXPIRED"), "פקיעה נחסמת בפתיחה ובשליחה");
assert(!signJs.includes("github.io") && !signJs.includes("is.gd") && !signJs.includes("spoo.me"), "השיתוף לא עובר דרך מקצר שחוסם את תמונת הוואטסאפ");
const notFound = fs.readFileSync(path.join(ROOT, "404.html"), "utf8");
assert(notFound.includes('s.html?t=" + match[1]') && !notFound.includes("s.html#"), "פתיחת /s/TOKEN עוברת לדף החתימה בלי סולמית");

console.log("\n12) centered send overlay and hatama job sharing");
function extractMethod(src, name){
  const needles = ["\n    async " + name + "(", "\n    " + name + "("];
  let start = -1;
  for(let i = 0; i < needles.length; i++){
    start = src.indexOf(needles[i]);
    if(start >= 0) break;
  }
  if(start < 0) return "";
  const brace = src.indexOf("{", start);
  let depth = 0;
  for(let i = brace; i < src.length; i++){
    if(src[i] === "{") depth += 1;
    else if(src[i] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}
const holdStart = app.indexOf("let giOpsHoldCount = 0;");
const holdEnd = app.indexOf("const OpsReferralsUI");
assert(holdStart > 0 && holdEnd > holdStart, "קוד מסך ההמתנה נמצא");
const nodes = [];
function makeEl(){
  const el = {
    id: "",
    style: { cssText: "" },
    innerHTML: "",
    setAttribute(){},
    remove(){
      const i = nodes.indexOf(el);
      if(i >= 0) nodes.splice(i, 1);
    }
  };
  return el;
}
const fakeDoc = {
  body: { appendChild(el){ if(nodes.indexOf(el) < 0) nodes.push(el); return el; } },
  head: { appendChild(el){ if(nodes.indexOf(el) < 0) nodes.push(el); return el; } },
  getElementById(id){ return nodes.find((el) => el.id === id) || null; },
  createElement: makeEl
};
const holdRun = vm.runInNewContext(`
  ${app.slice(holdStart, holdEnd)}
  giOpsHoldNote(true, "send");
  const first = document.getElementById("giOpsHoldNote");
  giOpsHoldNote(true, "send");
  const still = document.getElementById("giOpsHoldNote");
  const html = first ? String(first.innerHTML) : "";
  giOpsHoldNote(false);
  giOpsHoldNote(false);
  const gone = document.getElementById("giOpsHoldNote");
  this.out = { html, same: first === still, gone: gone == null };
`, { document: fakeDoc, out: null });
assert(holdRun && holdRun.same && holdRun.gone, "מסך ההמתנה נספר ולא נשאר אחרי הסיום");
assert(holdRun.html.indexOf("giOpsHoldSpin") >= 0 && holdRun.html.indexOf("מכין את המסמכים לשליחה") >= 0 && holdRun.html.indexOf("מסך הלינקים") >= 0, "במרכז יש עיגול טעינה עד מסך הלינקים");

let hatamaBuilds = 0;
const rec = { id: "c1", updatedAt: "t1" };
const hatamaSandbox = {
  Uint8Array,
  Promise,
  Object,
  Array,
  setTimeout,
  Error,
  String,
  Boolean,
  Number,
  window: {
    GiArrivalDocs: {
      buildDraft(row){ return { id: row.id }; },
      async hatamaSignPdf(){
        hatamaBuilds += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]), cells: [{ slot: "self", page: 0 }] };
      }
    }
  },
  ensureGiArrivalDocsLoaded(){ return Promise.resolve(); },
  safeTrim(v){ return String(v == null ? "" : v).trim(); }
};
const hatamaUi = vm.runInNewContext(`
  const ui = {
    _mcHatamaCache: null,
    _mcHatamaJob: null,
    ${extractMethod(app, "_mcCopyPdfBytes").replace("\n    ", "\n    ")},
    ${extractMethod(app, "_mcHatamaCacheKey")},
    ${extractMethod(app, "_mcCopyHatamaCells")},
    ${extractMethod(app, "_mcHatamaCached")},
    ${extractMethod(app, "_mcPrefetchHatamaSign")},
    ${extractMethod(app, "hatamaSignPdfForSend")}
  };
  ui
`, hatamaSandbox);
Promise.all([hatamaUi._mcPrefetchHatamaSign(rec), hatamaUi.hatamaSignPdfForSend(rec)]).then((rows) => {
  assert(hatamaBuilds === 1, "מסמך ההתאמה לא נבנה פעמיים אם השליחה התחילה בזמן ההכנה");
  assert(rows[0].cells[0].slot === "self" && rows[1].bytes[0] === 0x25, "השליחה משתמשת באותו PDF ותאי חתימה");
  console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
  process.exit(failed ? 1 : 0);
}).catch((err) => {
  assert(false, "שיתוף בניית מסמך ההתאמה נכשל: " + (err && err.message));
  console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
  process.exit(1);
});
