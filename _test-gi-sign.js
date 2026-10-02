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
assert(signJs.includes("api.isAdmin?.() || api.isManager?.()"), "הכפתור במערכת נשען על מנהל/מנהל מערכת");
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
assert(html.includes("app.js?v=20261002-360-sums-health-v1&giSign=1"), "app.js נטען מחדש כדי שהכפתור יופיע");
assert(html.includes("gi-sign.css?v=20261002-sign-v2"), "עיצוב הכפתור נטען מחדש");
assert(app.includes('gi-cancel-forms.js?v=20260914-mc-followup-qfix-v2&giSign=1'), "חלון הטופס נטען מחדש");
assert(html.includes("gi-sign.js") && html.includes("giSignToastHost"), "הטוסט נטען במערכת");
assert(edge.includes('action === "create"') && edge.includes("canSendRole") && edge.includes("stampPdf"), "השרת בודק הרשאה ומטביע על אותו PDF");
assert(sql.includes("gi_sign_packets") && sql.includes("gi_sign_links") && !sql.includes("alter table public.customers"), "טבלאות חדשות בלי שינוי טבלת הלקוחות");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
