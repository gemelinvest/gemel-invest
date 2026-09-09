/* GI-OPS 2026-09-07 — שיקוף: פרמיה לכיסוי קיים, בר שיחה דק,
   באנר שלב 2 הוסר, כותרות קומפקטיות, נוסח שלב 3 לפי הצילום.
   הרצה: node _test-ops-mirror-compact-ux.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260909-version-resume-v1";
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
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-mirror-compact-ux.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) שלב 3 — נוסח כמו בצילום");
const consent = sliceBetween(app, "_renderNeedsConsent(_rec){", "_mcCancelMetaForPolicy(ins, policy){");
assert(!!consent, "פונקציית נוסח הסכמה נמצאה");
assert(consent.includes("חשוב לי לעדכן אותך כי בשוק ישנן 8 חברות המשווקות את המוצר בבריאות ו-9 בחיים."), "משפט 1 בלי הדגשת מספרים");
assert(!consent.includes("<strong>8</strong>"), "המספר 8 לא מודגש");
assert(!consent.includes("<strong>9</strong>"), "המספר 9 לא מודגש");
assert(consent.includes("<strong>כלל ואיילון</strong>"), "כלל ואיילון כזוג מודגש");
assert(consent.includes("<strong>כלל ומגדל</strong>"), "כלל ומגדל כזוג מודגש");
assert(!consent.includes("<strong>כלל</strong> ו<strong>איילון</strong>"), "לא מפצלים כלל / איילון");
assert(consent.includes("mcNeedsScript__p--ask\">אז לאחר שקיבלנו את פנייתך, האם אתה מאשר כי אתה מאשר לנו להיכנס עבורך לממשק הר הביטוח ולבצע עבורך בדיקה על מנת להתאים עבורך ביטוח העונה על צרכיך?"), "משפט 3 כולו בשאלת הקראה");
assert(!consent.includes("לממשק <strong>הר הביטוח</strong>"), "אין הדגשה נפרדת ל«הר הביטוח»");
assert(consent.includes("data-mc-needs-act=\"har-yes\""), "לחצן מאשר נשאר");
assert(consent.includes("data-mc-needs-act=\"har-no\""), "לחצן לא מאשר נשאר");

console.log("\n3) שלב 2 — באנר הוסר, כותרת קומפקטית");
assert(!html.includes("mcStepVerify__intro"), "הוסר באנר ההנחיה בשלב 2");
assert(!html.includes("לאחר ההקראה — עבור עם הלקוח על כל הפרטים"), "טקסט הבאנר הוסר");
assert(html.includes(">ברשותך אשאל אותך מספר שאלות.<"), "נוסח ההקראה בשלב 2 נשאר");
assert(!css.includes(".mcStepVerify__intro"), "עיצוב הבאנר הוסר");
const verifyKicker = sliceBetween(css, ".mcStepVerify__kicker{", "}");
assert(verifyKicker.includes("font-size:13px"), "כותרת שלב 2 13px");
assert(!verifyKicker.includes("clamp(22px"), "כותרת שלב 2 לא נשארה 22–28px");
assert(css.includes(".mcStep2__kicker") && css.includes("font-size:13px"), "כותרות שאר השלבים נשארו קומפקטיות");
const liveVerifyKicker = sliceBetween(css, ".mcWorkstation--callLive.mcWorkstation--dockOpen .mcStepVerify__kicker{", "}");
assert(liveVerifyKicker.includes("font-size:13px"), "כותרת שלב 2 בשיחה חיה גם 13px");

console.log("\n4) סרגל שיחה דק");
const liveCard = sliceBetween(css, ".mcWorkstation--callLive > .mcSessionPanel .mcCall__card,", "box-shadow:0 4px 16px rgba(42,92,245,.06),0 1px 0 rgba(255,255,255,.98) inset;");
assert(liveCard.includes("flex-wrap:nowrap"), "כרטיס השיחה בשורה אחת");
assert(liveCard.includes("padding:3px 8px"), "padding דחוס בכרטיס השיחה");
assert(css.includes("font-size:clamp(16px, 1.6vw, 20px)"), "טיימר קטן יותר");
assert(!css.includes("font-size:clamp(22px, 2.4vw, 28px)"), "טיימר גדול הוסר");
const liveNav = sliceBetween(css, ".mcCall__liveNav{", "}");
assert(liveNav.includes("width:auto"), "ניווט חי לא תופס שורה שלמה");
assert(liveNav.includes("flex-wrap:nowrap"), "ניווט חי בלי גלישה");
assert(html.includes('id="mcCallStartBtn"'), "לחצן סיום/התחל שיחה נשאר");
assert(html.includes('id="mcRescheduleMirrorDockBtn"'), "לחצן תזמון נשאר");

console.log("\n5) פרמיה חודשית ליד כל כיסוי בבריאות קיימת");
assert(app.includes("_mcCoverMonthlyPremiumRaw(item){"), "עזר פרמיה לכיסוי קיים");
assert(app.includes("_mcExistingHealthCoverPremiumRows(p){"), "איסוף שורות כיסוי+פרמיה");
assert(app.includes('kind: "cover"'), "שורה לכל כיסוי בכרטיס");
assert(app.includes('k: "סה״כ פרמיה חודשית"'), "סה״כ נשאר מתחת לכיסויים");

const moneyStart = app.indexOf("_fmtMcMoney(raw){");
const moneyEnd = app.indexOf("_mcCoverageBits(p){", moneyStart);
const coverStart = app.indexOf("_mcCoverMonthlyPremiumRaw(item){");
const coverEnd = app.indexOf("_collectExistingPolicyCards(rec){", coverStart);
assert(moneyStart > 0 && moneyEnd > moneyStart && coverStart > 0 && coverEnd > coverStart, "פונקציות פרמיה נמצאו");

const sandbox = {};
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  var CustomersUI = {
    formatMoney(v){
      const n = Number(String(v == null ? "" : v).replace(/[^\\d.\\-]/g, ""));
      if(!n) return "₪0";
      return "₪" + n;
    },
    formatMoneyValue(n){ return "₪" + n; }
  };
  const ui = {
    ${app.slice(moneyStart, moneyEnd)}
    ${app.slice(coverStart, coverEnd)}
  };
  this.ui = ui;
`, sandbox);

assert(sandbox.ui._fmtMcMoney("") === "—", "סכום ריק → —");
assert(sandbox.ui._fmtMcMoney("0") === "—", "0 לא מוצג כ־₪0");
assert(sandbox.ui._fmtMcMoney("0.00") === "—", "0.00 מיבוא הר הביטוח → —");
assert(String(sandbox.ui._fmtMcMoney("32.5")).indexOf("32.5") >= 0, "פרמיה אמיתית מוצגת");

const rows = sandbox.ui._mcExistingHealthCoverPremiumRows({
  type: "בריאות",
  premiumBreakdown: [
    { label: "השתלות-אחידה", monthlyPremium: "32.50" },
    { label: "תרופות מחוץ לסל-אחידה", monthlyPremium: "0.00" },
    { label: "ניתוחים בחו\"ל-אחידה", annualPremium: "120" }
  ]
});
assert(rows.length === 3, "שלושה כיסויים מפירוט הפרמיה");
assert(rows[0].label === "השתלות-אחידה" && rows[0].premium === "32.50", "פרמיה חודשית ליד כיסוי");
assert(rows[1].label.indexOf("תרופות") >= 0 && rows[1].premium === "", "כיסוי בלי פרמיה אמיתית נשאר ריק");
assert(rows[2].premium === "10", "פרמיה שנתית מתחלקת ל-12");
assert(sandbox.ui._fmtMcMoney(rows[1].premium) === "—", "כיסוי בלי פרמיה מוצג כ־— ולא ₪0");

const namedOnly = sandbox.ui._mcExistingHealthCoverPremiumRows({
  type: "בריאות",
  healthCovers: ["השתלות", "תרופות"]
});
assert(namedOnly.length === 2 && namedOnly[0].premium === "", "בלי פירוט נשארים שמות הכיסויים");

console.log("\n6) רגרסיה");
assert(app.includes('k: "פרמיה חודשית על סך"'), "פוליסות לא-בריאות נשארות עם פרמיה אחת");
assert(html.includes('id="mcCallStartBtn"'), "לחצן התחלת שיחה נשאר");
assert(app.includes("function findAgentForLogin(username, agents = []){"), "findAgentForLogin לא נגע");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
