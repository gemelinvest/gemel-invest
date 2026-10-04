/**
 * Security contract for the customer signature link (s.html).
 * The document still opens after the right password. Guessing is locked,
 * and the page follows the same header rules as the CRM.
 * Run: node _test-sign-link-security.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const page = fs.readFileSync(path.join(ROOT, "s.html"), "utf8");
const pageJs = fs.readFileSync(path.join(ROOT, "gi-sign-page.js"), "utf8");
const edge = fs.readFileSync(path.join(ROOT, "supabase/functions/gi-sign/index.ts"), "utf8");
const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-sign.sql"), "utf8");

function assert(cond, msg){
  if(!cond){
    console.error("FAIL", msg);
    process.exitCode = 1;
    failed += 1;
  } else {
    console.log("  PASS", msg);
    passed += 1;
  }
}

let passed = 0;
let failed = 0;

console.log("1) the customer page does not leak the link");
assert(page.includes('name="robots" content="noindex, nofollow"'), "הדף לא נכנס לאינדקס");
assert(page.includes('name="referrer" content="no-referrer"'), "הלינק שבכתובת לא נשלח החוצה");
assert(page.includes("frame-ancestors 'none'") && page.includes("object-src 'none'") && page.includes("base-uri 'self'"), "אותן כותרות אבטחה כמו במערכת");
assert(page.includes("window.top === window.self") && page.includes("document.documentElement.innerHTML"), "הדף לא נפתח בתוך חלון זר");
assert(page.includes("הלינק אישי. אין להעביר אותו לאדם אחר."), "נשארת הודעה שהלינק אישי");
assert(page.includes("הזן סיסמא") && !page.includes("הזן תעודת זהות"), "מסך הכניסה נשאר סיסמא");
assert(!page.includes("giSignDownload") && !page.includes("הורד מסמך התאמת צרכים"), "אין הורדה אחרי הסקר");

console.log("2) a wrong password locks the link, a right one still opens it");
const gate = edge.slice(edge.indexOf("async function publicGate"), edge.indexOf("async function matchedSigner"));
assert(gate.includes("const GATE_MAX = 8") === false && edge.includes("const GATE_MAX = 8"), "שמונה ניסיונות");
assert(edge.includes("const GATE_LOCK_MS = 15 * 60 * 1000"), "נעילה של רבע שעה");
assert(gate.indexOf("lockedResponse") < gate.indexOf("idsAllow(link.signer_id, body.idNumber)"), "הנעילה נבדקת לפני בדיקת הסיסמא");
assert(gate.includes("allowManager") && gate.includes("managerPreview"), "סוכן מחובר עדיין יכול לפתוח");
assert(gate.includes("state.unsupported") && gate.includes("noteGateMiss"), "בלי העמודות החדשות החתימה נשארת פתוחה");
assert(edge.includes('error: "LOCKED"') && edge.includes('error: "ID_MISMATCH"'), "סיסמא שגויה ונעילה נשארות נפרדות");
assert(edge.includes("publicGate(sb, body, row.link, token, true)") && edge.includes("publicGate(sb, body, row.link, token, false)"), "פתיחה ושליחה עוברות באותו שער");
assert(pageJs.includes('code === "LOCKED"') && pageJs.includes("הכניסה ננעלה לזמן קצר") && pageJs.includes("הסיסמא לא תואמת"), "הלקוח רואה נעילה, וסיסמא שגויה נשארת");
assert(pageJs.includes('action: "get"') && pageJs.includes('action: "submit"') && pageJs.includes('action: "survey"'), "פתיחה, חתימה וסקר נשארים");
assert(!pageJs.includes("localStorage") && !pageJs.includes("sessionStorage"), "הסיסמא לא נשמרת בדפדפן");

console.log("3) the document answer is not cached and errors stay generic");
assert(edge.includes('"Cache-Control": "no-store"') && edge.includes('"X-Content-Type-Options": "nosniff"'), "תשובת המסמך לא נשמרת במטמון");
assert(!edge.includes("trim((err as Error)?.message)"), "שגיאת שרת לא חושפת פרטים פנימיים");
assert(sql.includes("add column if not exists gate_fails") && sql.includes("add column if not exists gate_until"), "הנעילה מתווספת בלי למחוק לינקים");
assert(sql.includes("revoke all on table public.gi_sign_links from public, anon, authenticated"), "הטבלה נשארת סגורה לציבור");

const peek = edge.slice(edge.indexOf("async function peekPacket"), edge.indexOf("async function linkStatus"));
assert(peek.includes("locked: true") && !peek.includes("pdfBase64") && !peek.includes("signer_name"), "לפני הסיסמא אין מסמך ואין שם");

console.log(failed ? ("FAILED " + failed) : ("OK " + passed));
if(failed) process.exit(1);
