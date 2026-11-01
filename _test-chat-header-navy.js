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
assert(lit.includes(".giChatWindow__header:not(#\\9):not(#\\9):not(#\\9)") && lit.includes("background-image: var(--gi-lit-lines), var(--gi-lit-fill) !important;"), "רקע נאבי מואר עם הקווים");
assert(lit.includes(".giChatWindow__title:not(#\\9):not(#\\9):not(#\\9)") && lit.includes("color: #fff !important;"), "הכותרת בהירה");
assert(lit.includes(".giChatWindow__kicker:not(#\\9):not(#\\9):not(#\\9)"), "GEMEL INVEST בהיר");
assert(lit.includes(".giChatWindow__miniBtn:not(#\\9):not(#\\9):not(#\\9)") && lit.includes(".giChatWindow__miniBtn:hover:not(#\\9):not(#\\9):not(#\\9)"), "הלחצנים בהירים על הפס");

console.log("\n3) טקסט רשימת הנציגים");
assert(lit.includes(".giChatUser__name:not(#\\9):not(#\\9):not(#\\9)") && lit.includes("font-size: 15px !important;"), "השמות 15 פיקסלים");
assert(lit.includes(".giChatUser__status:not(#\\9):not(#\\9):not(#\\9)") && lit.includes("font-size: 13px !important;"), "שורות המשנה 13 פיקסלים");
assert(lit.includes("#giChatUserSearch:not(#\\9):not(#\\9):not(#\\9)"), "שדה החיפוש גדל יחד איתם");
assert(theme.includes(".giChatUser__avatar:not(#\\9):not(#\\9)") && theme.includes("font-size: 12px !important;"), "עיגולי הנציגים נשארים");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
assert(css.includes(".giChatWindow__body{ display:grid; grid-template-columns: 196px 1fr; min-height:0; flex:1; }"), "עמודת הנציגים רחבה מספיק לשמות בשורה אחת");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
