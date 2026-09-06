/* GI-OPS 2026-09-06 — נוסח שיקוף בסגנון סיכום (מעט מוגדל),
   ופוליסות מוצעות עם פרמיה לפני/אחרי הנחה + פירוט הנחה מלא.
   הרצה: node _test-ops-mirror-script-premiums.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260906-mirror-script-premiums-v1";
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = read("app.js");
const html = read("index.html");
const css = read("app.css");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-mirror-script-premiums.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) סגנון כיתוב אחיד — כמו סיכום, מעט מוגדל");
assert(css.includes("font-size:clamp(18px, 1.7vw, 21px)"), "גודל קריאה 18–21px");
assert(css.includes("line-height:1.68"), "ריווח שורות 1.68");
assert(css.includes(".mcPaySay{") && css.includes("font-size: 18.5px"), "נוסח הסיכום מעט מוגדל");
assert(!css.includes("font-size:clamp(22px, 2.35vw, 28px)"), "נוסח הפתיחה לא נשאר גדול מדי");
assert(!css.includes("font-size:clamp(20px, 2.15vw, 26px)"), "נוסח הפתיחה החי לא נשאר גדול מדי");
assert(css.includes(".mcCallScript__ask") && css.includes("font-weight:800"), "שאלות מודגשות");
assert(css.includes(".mcNeedsScript__p--ask{font-weight:800"), "שאלות בירור צרכים מודגשות");
assert(css.includes(".mcStartDate{"), "שבב ערך כחול (תאריך/סכום) נשאר");

console.log("\n3) פוליסות מוצעות — לפני הנחה, לאחר הנחה, הנחה במלואה");
assert(app.includes("_mcNewPolicyPremiumDiscountRows(p){"), "עזר פרמיה+הנחה קיים");
assert(app.includes('k: "פרמיה לפני הנחה"'), "שורה לפרמיה לפני הנחה");
assert(app.includes('k: "פרמיה לאחר הנחה"'), "שורה לפרמיה לאחר הנחה");
assert(app.includes('k: "הנחה שניתנה"'), "שורה לפירוט הנחה");
assert(app.includes("שנה ${year}: ${pctItem}%"), "פירוט הנחה לפי שנים");
const collect = sliceBetween(app, "_collectNewPolicyCards(rec, opts = {}){", "_renderNeedsOffer(rec){");
assert(!!collect, "איסוף כרטיסי פוליסה מוצעת נמצא");
assert(collect.includes("_mcNewPolicyPremiumDiscountRows(p)"), "כרטיס מוצע תמיד מושך פרמיה+הנחה");
assert(!collect.includes('k: "פרמיה חודשית על סך"'), "הוסרה שורת פרמיה יחידה בכרטיס מוצע");
assert(css.includes(".mcPolCard__row--premium"), "עיצוב שורות פרמיה");
assert(css.includes(".mcPolCard__row--discount"), "עיצוב פירוט הנחה");

console.log("\n4) חישוב הנחה ופרמיות");
const discStart = app.indexOf("_mcDiscountScheduleText(p){");
const discEnd = app.indexOf("_mcPremiumBefore(p){", discStart);
assert(discStart > 0 && discEnd > discStart, "פונקציות פרמיה/הנחה נמצאו");
const sandbox = {};
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function escapeHtml(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c])); }
  const ui = {
    _fmtMcMoney(raw){
      const t = safeTrim(raw);
      return t ? (t.indexOf("₪") >= 0 ? t : t + "₪") : "—";
    },
    _mcPremiumBefore(p){ return safeTrim(p?.premiumBefore || p?.premiumMonthly || ""); },
    _mcPremiumAfter(p){ return safeTrim(p?.premiumAfterDiscount || p?.premiumMonthly || ""); },
    ${app.slice(discStart, discEnd)}
  };
  this.ui = ui;
`, sandbox);

const full = sandbox.ui._mcDiscountScheduleText({
  discountSchedule: [
    { year: 1, pct: 20 },
    { year: 2, pct: 15 },
    { year: 3, pct: 10 }
  ]
});
assert(full === "שנה 1: 20% · שנה 2: 15% · שנה 3: 10%", "הנחה מדורגת לפי שנים");
assert(sandbox.ui._mcDiscountScheduleText({ discountPct: 12, discountYears: "5" }) === "12% ל־5 שנים", "הנחה אחידה כשאין לוח שנים");
assert(sandbox.ui._mcDiscountScheduleText({}) === "", "בלי הנחה אין שורה");

const prem = sandbox.ui._mcNewPolicyPremiumDiscountRows({
  premiumBefore: "250",
  premiumAfterDiscount: "200",
  discountSchedule: [{ year: 1, pct: 20 }, { year: 2, pct: 10 }]
});
assert(prem.rows.length === 3, "שלוש שורות: לפני, אחרי, הנחה");
assert(prem.rows[0].k === "פרמיה לפני הנחה" && prem.rows[0].v.includes("250"), "פרמיה לפני הנחה");
assert(prem.rows[1].k === "פרמיה לאחר הנחה" && prem.rows[1].v.includes("200"), "פרמיה לאחר הנחה");
assert(prem.rows[2].k === "הנחה שניתנה" && prem.rows[2].v.includes("שנה 1: 20%"), "הנחה במלואה בכרטיס");
assert(prem.rows[0].v.includes("mcStartDate"), "סכום פרמיה בשבב כחול");

console.log("\n5) רגרסיה — פוליסות קיימות וכניסה");
assert(app.includes('k: "פרמיה חודשית על סך"'), "פוליסות קיימות נשארות עם פרמיה אחת");
assert(app.includes("function findAgentForLogin(username, agents = []){"), "findAgentForLogin לא נגע");
assert(app.includes("Auth._submit = async function(){"), "Auth._submit לא נגע");
assert(html.includes('id="mcCallStartBtn"'), "לחצן התחלת שיחה נשאר");
assert(css.includes("body.view-mirrorCall-active.mc-mirror-immersive .topbar"), "טופבר עדיין מוסתר בשיקוף");
assert(!/body\.view-mirrorCall-active\.mc-mirror-immersive \.sidebar/.test(css), "תפריט הצד נשאר גלוי");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
