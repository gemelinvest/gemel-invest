/* GI-ASSISTANT P3 — top bar button + pairing gate.
   Run: node _test-assistant-topbar.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260829-assistant-engine-v1";
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

const html = read("index.html");
const app = read("app.js");
const theme = read("theme.css");
const css = read("app.css");
const asstCss = read("gi-assistant.css");
const asstTs = read("gi-assistant.ts");
const asstJs = read("gi-assistant.js");
const sw = read("service-worker.js");

console.log("1) cache + syntax + typescript source");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-assistant.js")]).status === 0, "node --check gi-assistant.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("gi-assistant.js?v=" + TAG), "index.html gi-assistant.js cache");
assert(html.includes("gi-assistant.css?v=" + TAG), "index.html gi-assistant.css cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(asstTs.includes("hasActiveDevicePairing"), "מקור TypeScript קיים");
assert(asstJs.includes("hasActiveDevicePairing"), "קובץ מקומפל כולל את ה-API");

console.log("\n2) topbar button");
const start = html.indexOf('id="btnPersonalAssistant"');
const nextBtn = html.indexOf("<button", start + 1);
const block = start >= 0 ? html.slice(start, nextBtn > start ? nextBtn : start + 1800) : "";
assert(start >= 0, "לחצן העוזר האישי בטופ בר");
assert(html.includes('aria-label="העוזר האישי"'), "aria-label");
assert(html.includes('title="העוזר האישי"'), "title");
assert(html.includes("giAssistantBtn"), "מחלקת כפתור ייעודית");
assert(html.includes('class="lcTopBtn giAssistantBtn'), "משתמש ב-lcTopBtn הקיים");
assert(block.includes('stroke-width="1.9"'), "אותו עובי קו כמו שאר האייקונים");
assert(block.includes('stroke="currentColor"'), "currentColor כמו השכנים");
assert(block.includes('data-gi-asst-icon="mic"'), "אייקון מיקרופון מסומן");
const chatIdx = html.indexOf('id="giChatFab"');
const asstIdx = html.indexOf('id="btnPersonalAssistant"');
const travelIdx = html.indexOf('id="btnTravelInsuranceAbroad"');
assert(chatIdx > 0 && asstIdx > chatIdx && asstIdx < travelIdx, "הכפתור בין הצ׳אט לביטוח נסיעות");

console.log("\n3) scoped CSS only");
assert(!theme.includes("giAssistantBtn"), "theme.css לא שונה");
assert(!theme.includes("giAsst__"), "theme.css בלי סגנונות עוזר");
assert(!css.includes("giAssistantBtn"), "app.css לא שונה");
assert(asstCss.includes(".giAsst"), "CSS scoped תחת .giAsst");
assert(asstCss.includes(".giAssistantBtn"), "CSS scoped לכפתור");
assert(asstCss.includes("@media (max-width: 640px)"), "התאמת מובייל במודל");

console.log("\n4) pairing gate + no secrets in QR path");
assert(asstTs.includes("hasActiveDevicePairing"), "בדיקת pairing לפני פתיחה");
assert(asstTs.includes("הפעלת העוזר האישי"), "מסך הפעלה בפעם הראשונה");
assert(asstTs.includes("סרוק את קוד ה-QR"), "טקסט הסבר QR");
assert(!asstTs.includes("id_number") && !asstTs.includes("idNumber"), "אין ת״ז במודול");
    assert(!asstJs.includes('searchParams.set("password"') && !asstJs.includes('searchParams.set("pin"'), "QR לא שם PIN/סיסמה בפרמטר");
    assert(asstTs.includes('url.searchParams.set("p"'), "QR בנוי מפרמטר p בלבד");
    assert(asstJs.includes("assistant.html"), "QR מצביע ל-assistant.html");
assert(app.includes("__GI_ASSISTANT_BRIDGE__"), "גשר Auth מהמערכת הקיימת");
assert(app.includes("GiAssistant?.onLogin"), "onLogin אחרי כניסה קיימת");
assert(app.includes("GiAssistant?.onLogout"), "onLogout עם היציאה הקיימת");
assert(!app.includes("create table"), "אין שינוי סכימה ב-app.js");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
