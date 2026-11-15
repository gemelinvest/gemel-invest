/* כותרת חלון הצ׳אט בנאבי מואר, והטקסט ברשימת הנציגים מעט גדול יותר.
   הרצה: node _test-chat-header-navy.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const lit = fs.readFileSync(path.join(root, "gi-navy-lit.css"), "utf8");
const theme = fs.readFileSync(path.join(root, "theme.css"), "utf8");

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

const title = html.slice(html.indexOf('class="giChatWindow__title"'), html.indexOf('class="giChatWindow__title"') + 80);
console.log("1) כותרת החלון");
assert(title.includes(">צ׳אט<"), "הכותרת בחלון היא צ׳אט");
assert(html.includes('aria-label="צ׳אט אינווסט"'), "שם הכפתור בטופ בר נשאר");
assert(html.includes('<div class="giChatSettingsModal__kicker">צ׳אט אינווסט</div>'), "מסך ההגדרות נשאר");

console.log("\n2) הפס העליון כולו");
assert(lit.includes(".giChatWindow__header:not(#\\9):not(#\\9):not(#\\9)") && lit.includes("background-color: #0E2748 !important;") && lit.includes("border-bottom: 1px solid #C6A15B !important;"), "רקע נייבי עם קו זהב");
assert(lit.includes(".giChatWindow__title:not(#\\9):not(#\\9):not(#\\9)") && lit.includes("color: #fff !important;"), "הכותרת בהירה");
const chat = html.slice(html.indexOf('id="giChatWindow"'), html.indexOf("giChatWindow__body"));
assert(!chat.includes("GEMEL INVEST"), "GEMEL INVEST לא חוזר לפס הצ׳אט");
assert(chat.includes('class="giChatWindow__kicker">ONYX<'), "השם ONYX מופיע מעל צ׳אט");
assert(lit.includes(".giChatWindow__miniBtn:not(#\\9):not(#\\9):not(#\\9)") && lit.includes(".giChatWindow__miniBtn:hover:not(#\\9):not(#\\9):not(#\\9)"), "הלחצנים בהירים על הפס");

console.log("\n3) טקסט רשימת הנציגים");
assert(lit.includes(".giChatUser__name:not(#\\9):not(#\\9):not(#\\9)") && lit.includes("font-size: 15px !important;"), "השמות 15 פיקסלים");
assert(lit.includes(".giChatUser__status:not(#\\9):not(#\\9):not(#\\9)") && lit.includes("font-size: 13px !important;"), "שורות המשנה 13 פיקסלים");
assert(lit.includes("#giChatUserSearch:not(#\\9):not(#\\9):not(#\\9)"), "שדה החיפוש גדל יחד איתם");
assert(theme.includes(".giChatUser__avatar:not(#\\9):not(#\\9)") && theme.includes("font-size: 12px !important;"), "עיגולי הנציגים נשארים");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
assert(css.includes(".giChatWindow__body{ display:grid; grid-template-columns: 196px 1fr; min-height:0; flex:1; }"), "עמודת הנציגים רחבה מספיק לשמות בשורה אחת");

console.log("\n4) כותרת תיק הלקוח");
const cfHeader = lit.slice(lit.indexOf("customer file header"), lit.indexOf("sidebar"));
assert(cfHeader.includes("#customerFull.cfFile .customerFull__top.cfFile__header"), "כלל הכותרת נשאר");
assert(cfHeader.includes("linear-gradient") && cfHeader.includes("var(--gi-cf-header-wave)"), "רשת קבועה וגל ביחס שמור");
assert(!cfHeader.includes("--gi-lit-lines-soft"), "הכותרת לא משתמשת ב-SVG המתוח");
const wave = lit.slice(lit.indexOf("--gi-cf-header-wave:"), lit.indexOf("--gi-cf-header-wave:") + 900);
assert(wave.includes("preserveAspectRatio='xMidYMid slice'"), "גל הכותרת שומר יחס");
assert(!wave.includes("preserveAspectRatio='none'"), "גל הכותרת לא נמתח");
assert(lit.includes("--gi-lit-lines-soft:"), "הטוקן המשותף נשאר");
assert(lit.includes("background-image: var(--gi-lit-lines), var(--gi-lit-fill) !important;"), "שאר המשטחים עדיין עם הקווים המשותפים");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
