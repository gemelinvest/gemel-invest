/* GI-TRAVEL-INSURANCE-TOPBAR 20260826-travel-insurance-v1
   Replace topbar "שליחת הצעה" with PassportCard travel insurance popup.
   Run: node _test-travel-insurance-topbar.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260826-travel-insurance-v1";
const URL = "https://buy.passportcard.co.il/?AffiliateId=vINm9OCbeh0%2BTAjGxvVjjQ%3D%3D";
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
const sw = read("service-worker.js");

console.log("1) cache + syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(html.includes("theme.css?v=" + TAG), "index.html theme.css cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");

console.log("\n2) topbar button");
const start = html.indexOf('id="btnTravelInsuranceAbroad"');
const nextBtn = html.indexOf("<button", start + 1);
const block = start >= 0 ? html.slice(start, nextBtn > start ? nextBtn : start + 1800) : "";
assert(start >= 0, "לחצן ביטוח נסיעות לחו״ל בטופ בר");
assert(html.includes('aria-label="ביטוח נסיעות לחו״ל"'), "aria-label");
assert(html.includes('title="ביטוח נסיעות לחו״ל"'), "title");
assert(html.includes("lcTravelInsuranceBtn"), "מחלקת lcTopBtn ייעודית");
assert(block.includes('stroke-width="1.9"'), "אותו עובי קו כמו שאר האייקונים");
assert(block.includes('stroke="currentColor"'), "currentColor כמו השכנים");
assert(block.includes('data-gi-travel-icon="plane"'), "האייקון מסומן כמטוס");
assert(block.includes("M21 16v-2l-8-5V3.5"), "גוף המטוס בצדודית");
assert(block.includes("V19l-2 1.5V22"), "זנב המטוס");
assert(!block.includes("M17.8 19.2"), "הוסר האייקון הישן שהיה קשה לזהות");

console.log("\n3) old offer UI removed");
assert(!html.includes('id="giOfferFab"'), "לחצן שליחת הצעה הוסר");
assert(!html.includes('id="giOfferModal"'), "מודל שליחת הצעה הוסר");
assert(!html.includes("giOfferCustomerName"), "שדות המודל הוסרו");
assert(!app.includes("const OfferCompareUI"), "OfferCompareUI הוסר");
assert(!app.includes("OfferCompareUI.init"), "אין קריאת init למודל הישן");
assert(!css.includes("giOfferFab--topbar"), "CSS של הלחצן הישן הוסר");
assert(!css.includes("giOfferModal__panel"), "CSS של המודל הישן הוסר");
assert(!theme.includes("giOfferFab--topbar"), "theme לא מתייחס ללחצן הישן");

console.log("\n4) click opens PassportCard window");
assert(app.includes("TRAVEL_INSURANCE_ABROAD_URL"), "קבוע URL");
assert(app.includes(URL), "קישור PassportCard עם AffiliateId");
assert(app.includes('window.open(') && app.includes("giTravelInsuranceAbroad"), "window.open לחלון ייעודי");
assert(app.includes("TravelInsuranceTopbarUI"), "TravelInsuranceTopbarUI");
assert(app.includes("TravelInsuranceTopbarUI.init()"), "init בבוט");
assert(app.includes('getElementById("btnTravelInsuranceAbroad")'), "applyRoleUI / init על הלחצן החדש");
assert(css.includes("body.is-referent-role .lcTravelInsuranceBtn"), "מוסתר לסוקרת כמו הלחצן הישן");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
