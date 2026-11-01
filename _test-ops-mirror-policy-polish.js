/* GI-MIRROR-POLISH 2026-11-01
   שלב 4: סדר עמודות וכרטיס. שלב 5: הצג הנחה, תיקון דירוג, לחצן מוטבים.
   הרצה: node _test-ops-mirror-policy-polish.js
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start + startMark.length);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

function extractMethod(src, signature){
  const start = src.indexOf(signature);
  if(start < 0) return "";
  const brace = src.indexOf("{", start);
  if(brace < 0) return "";
  let depth = 0;
  for(let i = brace; i < src.length; i += 1){
    if(src[i] === "{") depth += 1;
    else if(src[i] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) שלב 4 — סדר עמודות וכרטיס");
const head = sliceBetween(app, "_mcPolicyRowHead(kind){", "_mcPolicyRowHtml(opts){");
const existingHead = head.slice(head.indexOf(": ["));
assert(!existingHead.includes('"מספר פוליסה"'), "מספר הפוליסה ירד מהכותרת");
const existingCols = existingHead.slice(existingHead.indexOf('"פרמיה"'));
assert(existingHead.indexOf('"מבוטח"') < existingHead.indexOf('"פרמיה"'), "מבוטח נשאר ראשון");
assert(existingCols.indexOf('"פרמיה"') < existingCols.indexOf('"סכום ביטוח"'), "פרמיה לפני סכום הביטוח");
assert(existingCols.indexOf('"סכום ביטוח"') < existingCols.indexOf('"סטטוס"'), "סטטוס נשאר אחרון");
const existing = sliceBetween(app, "_collectExistingPolicyCards(rec){", "_renderNeedsExisting(rec){");
assert(existing.indexOf('k: "פרמיה"') < existing.indexOf('k: "סכום ביטוח"'), "בשורה הפרמיה לפני סכום הביטוח");
assert(existing.includes('rowClass: "mcPolicyRow--existing"'), "שורת פוליסה קיימת מסומנת לכרטיס");
assert(!existing.includes('k: "מספר פוליסה"'), "מספר הפוליסה ירד מהשורה");
assert(css.includes("repeat(6, minmax(0, 1fr))"), "שש עמודות ברווחים שווים");
assert(css.includes(".mcPolicyRow__status--danger"), "צבע סטטוס ביטול נשאר");
assert(css.includes(".mcPolicyRow--existing .mcPolicyRow__status::before"), "תג סטטוס חדש");
assert(css.includes("#view-mirrorCall .mcPolicyRow--existing .mcPolicyRow__main"), "פס הכרטיס הקיים");

console.log("\n3) שלב 5 — הנחה ולחצן צד");
const collect = sliceBetween(app, "_collectNewPolicyCards(rec, opts = {}){", "_mcMigdalPeakMap(rec){");
assert(collect.includes('class="mcOfferCard__discBtn"'), "לחצן הצג הנחה על הכרטיס");
assert(collect.includes("mcOfferCard__discKeep"), "דירוג ההנחה לא גלוי על הכרטיס");
assert(!collect.includes("mcOfferCard__line--graded"), "שורת ההנחה המדורגת ירדה מהכרטיס");
assert(collect.includes("_mcOfferSideBtnHtml(rec, p, key)"), "לחצן צד נבנה לפי הנתונים");
assert(collect.includes("_mcPledgeMarkerHtml(p)"), "סמן השעבוד הישן נשאר בקוד");
assert(collect.includes("_mcHealthCoverDiscountHtml(rec, p, key)"), "פירוט כיסוי בריאות נשאר");
assert(app.includes("data-mc-party-open"), "לחיצה על לחצן הצד");
assert(app.includes("_openMcPartyView(policyId, opts){"), "מסך המוטבים והשיעבוד");
assert(app.includes("_openMcDiscountEdit(policyId){"), "מסך דירוג ההנחה");
assert(css.includes("#view-mirrorCall .mcOfferCard__facts"), "פס נייבי על פרטי הפוליסה המוצעת");
assert(css.includes("#view-mirrorCall .mcOfferTotals"), "פס נייבי על הסה״כ");
assert(css.includes(".mcPolicyRow__main:not(#\\9):not(#\\9)") && css.includes("background-image:") && css.includes("#12345F 0%, #17457E 16%"), "פס הקיים גובר על מחיקת הרקע");
assert(css.includes(".mcOfferCard__fact--before .mcOfferCard__discBtn") && app.includes("opts.discountBtn"), "הצג הנחה יושב מתחת ללפני הנחה");
assert(app.includes("data-mc-forms-rail-fold") && app.includes("_mcHealthRailCollapsed"), "אזור הטפסים נשאר מתקפל");
assert(app.includes("מחסנית טפסים"), "מחסנית הטפסים נשארת");
assert(css.includes(".mcOfferTotals{"), "כלל הסיכום הישן נשאר");
assert(!css.includes(".mcPolicyRowList .mcOfferTotals"), "הסיכום לא נצבע דרך שורות הביטוח הקיים");

console.log("\n4) שמירת דירוג לא מחליפה את נוסחת הפרמיה");
const afterFn = extractMethod(app, "_mcPremiumAfter(p){");
assert(afterFn.includes("getHealthRowPremiumAfterDiscount"), "אחרי הנחה עדיין מהפונקציה הקיימת");
assert(!afterFn.includes("getPolicyPremiumAfterDiscount"), "נוסחת האשף שמחזירה את לפני לא נכנסה");
const writeFn = extractMethod(app, "_mcWriteGradedDiscount(policy, schedule, option){");
const partyFn = extractMethod(app, "_mcOfferPartyState(rec, p){");
const labelFn = extractMethod(app, "_mcOfferSideLabel(state){");
const sideFn = extractMethod(app, "_mcOfferSideBtnHtml(rec, p, key){");
assert(!!writeFn && !!partyFn && !!sideFn, "הפונקציות החדשות נמצאו");

const sandbox = {};
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function escapeHtml(s){ return String(s == null ? "" : s); }
  const ui = {
    _mcAsMoneyNumber(v){
      const n = Number(String(v == null ? "" : v).replace(/[^\\d.\\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    },
    _mcPolicyInsuredIds(p){ return Array.isArray(p.insuredIds) ? p.insuredIds : []; },
    _mcWizardApi(){ return null; },
    _mcPremiumBefore(p){ return String(p.beforePremium || ""); },
    _policyHasFilledPledge(p){ return p.hasPledge === true; },
    ${partyFn},
    ${labelFn},
    ${sideFn},
    ${writeFn}
  };
  this.ui = ui;
`, sandbox);

const policy = { id: "p1", insuredIds: ["a"], beforePremium: "200", discountSchedule: [{ year: 1, pct: 10 }] };
const saved = sandbox.ui._mcWriteGradedDiscount(policy, [{ year: 1, pct: 25 }, { year: 2, pct: 15 }], null);
assert(saved.ok === true, "שמירה עם דירוג ידני");
assert(policy.discountSchedule[0].pct === 25 && policy.discountSchedule[1].pct === 15, "הדירוג נשמר על הפוליסה");
assert(policy.simDiscountPerInsured.a.monthlyAfterDiscount === 150, "אחרי 25% מ-200 נשמר 150");
assert(policy.premiumAfterDiscountValue === 150, "הסכום שאחרי ההנחה נשמר");
const empty = sandbox.ui._mcWriteGradedDiscount(policy, [], null);
assert(empty.ok === false, "בלי אחוז לא נשמר דירוג ריק");
const picked = { label: "10% ל-10 שנים", pct: 10, years: 2, packageNum: "101" };
const again = sandbox.ui._mcWriteGradedDiscount(
  { id: "p2", insuredIds: ["a"], beforePremium: "100" },
  [{ year: 1, pct: 10 }, { year: 2, pct: 10 }],
  picked
);
assert(again.ok === true && again.after === 90, "בחירה מהרשימה מחשבת 10%");

const none = sandbox.ui._mcOfferSideBtnHtml({}, { id: "x" }, "x");
assert(none === "", "בלי מוטבים יורשים או שיעבוד אין לחצן");
const heirs = sandbox.ui._mcOfferSideBtnHtml({}, { id: "x", beneficiariesMode: "legalHeirs" }, "x");
assert(heirs.includes("יורשים חוקיים") && heirs.includes("data-mc-party-open"), "יורשים חוקיים פותחים לחצן");
const bens = sandbox.ui._mcOfferSideBtnHtml({}, { id: "x", beneficiaries: [{ fullName: "רות ישראלי" }] }, "x");
assert(bens.includes("מוטבים"), "מוטבים עם שם פותחים לחצן");
const pledge = sandbox.ui._mcOfferSideBtnHtml({}, { id: "x", hasPledge: true }, "x");
assert(pledge.includes("שיעבוד"), "שיעבוד פותח לחצן");
const risk = sandbox.ui._mcOfferSideBtnHtml({}, { id: "r", type: "ריסק" }, "r");
assert(risk.includes("data-mc-benef-offer") && risk.includes("data-mc-heirs-offer"), "ריסק בלי נתונים מקבל מוטבים ויורשים");
const mort = sandbox.ui._mcOfferSideBtnHtml({}, { id: "m", type: "ריסק משכנתא" }, "m");
assert(mort.includes("מוטבים") && mort.includes("יורשים חוקיים"), "ריסק משכנתא מקבל את שני הלחצנים");
const ci = sandbox.ui._mcOfferSideBtnHtml({}, { id: "c", type: "מחלות קשות" }, "c");
assert(ci.includes("data-mc-benef-offer"), "מחלות קשות מקבל לחצן מוטבים");
const cancer = sandbox.ui._mcOfferSideBtnHtml({}, { id: "s", type: "סרטן" }, "s");
assert(cancer.includes("data-mc-heirs-offer"), "סרטן מקבל לחצן יורשים");
const health = sandbox.ui._mcOfferSideBtnHtml({}, { id: "h", type: "בריאות" }, "h");
assert(health === "", "בריאות בלי נתונים נשארת בלי לחצן");
assert(app.includes("_openMcOfferBeneficiaries(policyId){"), "הזנת מוטבים נפתחת מהכרטיס");
assert(app.includes("_mcMarkOfferLegalHeirs(policyId){"), "סימון יורשים חוקיים מהכרטיס");
assert(app.includes("mcHealthFormsRail__foldIcon") && app.includes("פתיחת טפסים"), "טפסים מקופלים נפתחים בחץ");
assert(app.includes("_mcAckPledgeShown(policyId){"), "סגירת שיעבוד מסמנת שהוקרא");
assert(app.includes('pledgeRead ? " is-read"') && css.includes(".mcOfferCard__sideBtn.is-read:not(#\\9):not(#\\9)"), "שיעבוד שהוקרא בירוק חלש");
assert(app.includes("ריבית קבועה") && app.includes("ריבית משתנה") && app.includes("mcPledgeInterestMarks"), "בשיעבוד מוצגות שתי הריביות");
assert(app.includes("במה תבחר?") && !app.includes("במה בחרת?"), "שאלת התשלום במה תבחר");
assert(app.includes('data-mc-needs-act="pay-to-insstart"') && app.includes('class="btn btn--primary mcNeedsNav__primary" data-mc-needs-act="pay-to-insstart"'), "המשך לתחילת ביטוח בלחצן השלבים");
assert(app.includes('data-mc-needs-act="insstart-done"') && app.includes('class="btn btn--primary mcNeedsNav__primary" data-mc-needs-act="insstart-done"'), "סיום שיקוף בלחצן השלבים");
assert(app.includes('data-mc-pay-payer="external"') && app.includes('exField("שם פרטי", "firstName"'), "אפשר לעבור למשלם חריג ולמלא שדות");
assert(app.includes("openEd.saved") && app.includes("quietStatus"), "המשך משלב ההצהרה לא מציג שמירה שנייה");
assert(css.includes(".mcHealthFormsRail__fold.is-open-arrow") && css.includes(".mcPayPayer__btn.is-on"), "חץ הפתיחה ומשלם חריג מעוצבים");

console.log(failed ? "\nFAILED " + failed : "\nOK " + passed);
process.exit(failed ? 1 : 0);
