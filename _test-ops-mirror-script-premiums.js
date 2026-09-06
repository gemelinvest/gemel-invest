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
const APP_TAG = "20260906-haifa-modiin-v1";
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
assert(app.includes("_mcNewPolicyPremiumDiscountRows(p, opts = {}){"), "עזר פרמיה+הנחה קיים");
assert(app.includes('k: "פרמיה לפני הנחה"'), "שורה לפרמיה לפני הנחה");
assert(app.includes('k: "פרמיה לאחר הנחה"'), "שורה לפרמיה לאחר הנחה");
assert(app.includes('k: "הנחה שניתנה"'), "שורה לפירוט הנחה");
assert(app.includes("שנה ${year}: ${pctItem}%"), "פירוט הנחה לפי שנים");
assert(app.includes("getPolicyPremiumBeforeDiscount"), "לפני הנחה מגיע מהאשף");
assert(app.includes("getHealthRowPremiumAfterDiscount"), "אחרי הנחה מגיע מהסימולטור באשף");
const afterFn = sliceBetween(app, "_mcPremiumAfter(p){", "_mcNeedsNav(primaryAct, primaryLabel, secondaryAct, secondaryLabel){");
assert(!!afterFn, "פונקציית פרמיה לאחר הנחה נמצאה");
assert(afterFn.includes("getHealthRowPremiumAfterDiscount"), "אחרי הנחה קורא ל-getHealthRowPremiumAfterDiscount");
assert(!afterFn.includes("getPolicyPremiumAfterDiscount"), "לא משתמש בפונקציית הזהות שמחזירה «לפני»");
assert(afterFn.includes("simDiscountPerInsured") || app.includes("_mcSimAfterTotal(p){"), "נשען על simDiscountPerInsured מהסימולטור");
const collect = sliceBetween(app, "_collectNewPolicyCards(rec, opts = {}){", "_renderNeedsOffer(rec){");
assert(!!collect, "איסוף כרטיסי פוליסה מוצעת נמצא");
assert(collect.includes("_mcNewPolicyPremiumDiscountRows(p"), "כרטיס מוצע תמיד מושך פרמיה+הנחה");
assert(collect.includes("omitScheduleRow: !!opts.showRankScript"), "בשלב פרמיה לא כופלים את שורת ההנחה מעל המשפט המלא");
assert(!collect.includes('k: "פרמיה חודשית על סך"'), "הוסרה שורת פרמיה יחידה בכרטיס מוצע");
assert(css.includes(".mcPolCard__row--premium"), "עיצוב שורות פרמיה");
assert(css.includes(".mcPolCard__row--discount"), "עיצוב פירוט הנחה");

console.log("\n4) חישוב הנחה ופרמיות מהסימולטור");
const discStart = app.indexOf("_mcDiscountScheduleText(p){");
const discEnd = app.indexOf("_mcNeedsNav(primaryAct, primaryLabel, secondaryAct, secondaryLabel){", discStart);
assert(discStart > 0 && discEnd > discStart, "פונקציות פרמיה/הנחה נמצאו");

function makePremiumSandbox(globals){
  const sandbox = Object.assign({ Wizard: undefined, CustomersUI: undefined }, globals || {});
  vm.runInNewContext(`
    function safeTrim(v){ return String(v == null ? "" : v).trim(); }
    function escapeHtml(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c])); }
    var Wizard = this.Wizard;
    var CustomersUI = this.CustomersUI;
    const ui = {
      _fmtMcMoney(raw){
        const t = safeTrim(raw);
        return t ? (t.indexOf("₪") >= 0 ? t : t + "₪") : "—";
      },
      ${app.slice(discStart, discEnd)}
    };
    this.ui = ui;
  `, sandbox);
  return sandbox;
}

const sandbox = makePremiumSandbox();
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

const phoenixCi = {
  company: "הפניקס",
  type: "מחלות קשות",
  insuredIds: ["i1"],
  insuredId: "i1",
  premiumPerInsured: { i1: "149" },
  premiumMonthly: "149",
  premiumAfterDiscountValue: "149",
  discountPct: "25",
  discountYears: "10",
  simDiscountPerInsured: {
    i1: { year1Pct: 25, years: 10, monthlyAfterDiscount: 111.75 }
  }
};
assert(sandbox.ui._mcPremiumBefore(phoenixCi) === "149", "בלי אשף: לפני הנחה = ברוטו מהסימולטור");
assert(sandbox.ui._mcPremiumAfter(phoenixCi) === "111.75", "בלי אשף: אחרי הנחה = monthlyAfterDiscount ולא 149");
assert(sandbox.ui._mcPremiumAfter(phoenixCi) !== sandbox.ui._mcPremiumBefore(phoenixCi), "לפני ואחרי לא זהים כשיש הנחה בסימולטור");

const prem = sandbox.ui._mcNewPolicyPremiumDiscountRows(phoenixCi);
assert(prem.rows.length === 3, "שלוש שורות: לפני, אחרי, הנחה");
assert(prem.rows[0].k === "פרמיה לפני הנחה" && prem.rows[0].v.includes("149"), "פרמיה לפני הנחה בכרטיס");
assert(prem.rows[1].k === "פרמיה לאחר הנחה" && prem.rows[1].v.includes("111.75"), "פרמיה לאחר הנחה בכרטיס שונה מהלפני");
assert(prem.rows[2].k === "הנחה שניתנה" && prem.rows[2].v.includes("25%"), "הנחה במלואה בכרטיס");
assert(prem.rows[0].v.includes("mcStartDate"), "סכום פרמיה בשבב כחול");

const omitted = sandbox.ui._mcNewPolicyPremiumDiscountRows(phoenixCi, { omitScheduleRow: true });
assert(omitted.rows.length === 2, "עם משפט הנחה מלא אין שורת הנחה כפולה");
assert(!!omitted.schedule && omitted.schedule.indexOf("25%") >= 0, "המשפט המלא עדיין זמין לכרטיס");

const health = {
  type: "בריאות",
  insuredIds: ["i1"],
  premiumPerInsured: { i1: "220" },
  premiumMonthly: "220",
  coverDiscountsApplied: true,
  premiumAfterCoverDiscounts: 180
};
assert(sandbox.ui._mcPremiumBefore(health) === "220", "בריאות: לפני הנחה מכיסוי בסיס");
assert(sandbox.ui._mcPremiumAfter(health) === "180", "בריאות: אחרי הנחה מ-premiumAfterCoverDiscounts");

const calls = { before: 0, after: 0, identity: 0, cui: 0 };
const wizardBox = makePremiumSandbox({
  Wizard: {
    getPolicyPremiumBeforeDiscount(){ calls.before += 1; return 149; },
    getHealthRowPremiumAfterDiscount(){ calls.after += 1; return 111.75; },
    getPolicyPremiumAfterDiscount(){ calls.identity += 1; return 149; }
  },
  CustomersUI: {
    getPolicyPremiumAfterDiscount(){ calls.cui += 1; return 149; }
  }
});
assert(wizardBox.ui._mcPremiumBefore(phoenixCi) === "149", "עם אשף: לפני הנחה מ-getPolicyPremiumBeforeDiscount");
assert(wizardBox.ui._mcPremiumAfter(phoenixCi) === "111.75", "עם אשף: אחרי הנחה מ-getHealthRowPremiumAfterDiscount");
assert(calls.before >= 1 && calls.after >= 1, "הכרטיס באמת קורא לפונקציות האשף");
assert(calls.identity === 0, "לא קורא ל-getPolicyPremiumAfterDiscount של האשף");
assert(calls.cui === 0, "לא קורא ל-CustomersUI.getPolicyPremiumAfterDiscount");

console.log("\n5) תחילת ביטוח — נוסח מלא פעם אחת, בלי כפל");
assert(app.includes("_mcInsStartPolicyHtml(p){"), "עזר נוסח תחילת ביטוח לכל פוליסה");
const insStartFn = sliceBetween(app, "_mcInsStartPolicyHtml(p){", "_mcSumToggle(key, on, label){");
assert(insStartFn.includes("הפוליסה תיכנס לתוקף החל מתאריך"), "משפט התוקף בתוך בלוק הפוליסה");
assert(insStartFn.includes("תישלח אליך הודעת SMS מחברת הביטוח"), "משפט ה-SMS בתוך אותו בלוק");
assert(insStartFn.includes("יש לעקוב אחר קבלת ההודעה"), "סיום משפט ה-SMS נשאר");
const block13 = sliceBetween(app, "// --- 13 · תחילת ביטוח ---", "// --- 14 · הקראת הצהרות למועמד ---");
assert(block13.includes("_mcInsStartPolicyHtml(p)"), "בלוק 13 משתמש בנוסח המלא לכל פוליסה");
assert((block13.match(/תישלח אליך הודעת SMS/g) || []).length === 0, "בלוק 13 לא כופל את משפט ה-SMS מחוץ לפוליסה");
assert((app.split("_mirrorPoliciesForStart(rec){").length - 1) === 1, "אין כפילות של פונקציית רשימת הפוליסות");

const startSandbox = {};
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function escapeHtml(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c])); }
  const ui = {
    _mcFmtDateHe(v){
      const t = safeTrim(v);
      if(!t) return "";
      const iso = /^(\\d{4})-(\\d{2})-(\\d{2})/.exec(t);
      if(iso) return iso[3] + "/" + iso[2] + "/" + iso[1];
      return t;
    },
    ${app.slice(app.indexOf("_mirrorPoliciesForStart(rec){"), app.indexOf("_mcSumToggle(key, on, label){"))}
  };
  this.ui = ui;
`, startSandbox);

const htmlOne = startSandbox.ui._mcInsStartPolicyHtml({
  company: "הפניקס",
  type: "מחלות קשות",
  startDate: "01/10/2026"
});
assert((htmlOne.match(/mcStartItem__pol/g) || []).length === 1, "כותרת פוליסה פעם אחת");
assert((htmlOne.match(/הפוליסה תיכנס לתוקף/g) || []).length === 1, "משפט התוקף פעם אחת");
assert((htmlOne.match(/הודעת SMS/g) || []).length === 1, "משפט SMS פעם אחת באותו בלוק");
assert(htmlOne.includes("01/10/2026"), "תאריך התחלה מוצג בנוסח המלא");
assert(htmlOne.indexOf("הפוליסה תיכנס לתוקף") < htmlOne.indexOf("הודעת SMS"), "קודם תוקף ואז SMS");

const rec = {
  payload: {
    newPolicies: [
      { company: "הפניקס", type: "מחלות קשות", startDate: "2026-10-01" },
      { company: "הפניקס", type: "מחלות קשות", startDate: "2026-10-01" }
    ]
  }
};
const pols = startSandbox.ui._mirrorPoliciesForStart(rec);
assert(pols.length === 1, "אותה פוליסה לא מוצגת פעמיים");
const joined = pols.map((p) => startSandbox.ui._mcInsStartPolicyHtml(p)).join("");
assert((joined.match(/הפניקס/g) || []).length === 1, "שם החברה פעם אחת אחרי איחוד כפילויות");

console.log("\n6) רגרסיה — פוליסות קיימות וכניסה");
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
