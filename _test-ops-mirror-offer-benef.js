/* GI-OPS 2026-09-14 — שיקוף חי: בלי מסך עלות כפול, הנחות/שעבוד בהצעה, מוטבים בבחירה.
   הרצה: node _test-ops-mirror-offer-benef.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260915-reminder-glass-v1";
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
const css = read("app.css");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-mirror-offer-benef.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes('BUILD = "' + APP_TAG + '"'), "app.js BUILD");

console.log("\n2) קטלוג חי — בלי עלות הביטוח");
const catalog = sliceBetween(app, "_mcCallStepCatalog(rec){", "_mcCurrentCallStepKey(){");
const offerI = catalog.indexOf('key: "offer"');
const compareI = catalog.indexOf('key: "compareNotice"');
const premI = catalog.indexOf('key: "premiumCost"');
const futI = catalog.indexOf('key: "futureCancel"');
const discI = catalog.indexOf('key: "disclosure"');
assert(offerI > 0 && compareI > offerI, "מוצעות לפני השוואה / היעדר ביטוח");
assert(premI < 0, "עלות הביטוח לא בקטלוג החי");
assert(futI > compareI, "שינוי/ביטול בעתיד אחרי השוואה");
assert(discI > futI, "גילוי נאות אחרי שינוי/ביטול בעתיד");
assert(catalog.includes('label: "שינוי או ביטול בעתיד"'), "שם שלב ביטול בעתיד נשאר");
assert(app.includes("_renderStep4PremiumCostBody(rec){"), "פונקציית מסך העלות נשארה בקוד ולא נמחקה");

console.log("\n3) ניווט — השוואה/היעדר → ביטול בעתיד, חזרה להשוואה");
const compare = sliceBetween(app, "_renderNeedsCompareNotice(rec){", "_mirrorGetNewPoliciesRaw(rec){");
assert(compare.includes("needs-to-premium"), "כפתור המשך מהשוואה נשאר");
assert(compare.includes("המשך · שינוי או ביטול בעתיד"), "התווית לא עלות הביטוח");
assert(!compare.includes("המשך · עלות הביטוח"), "אין יותר מעבר לעלות");
const toPrem = sliceBetween(app, 'if(action === "needs-to-premium"){', 'if(action === "premium-back"){');
assert(toPrem.includes('this._mirrorUiPhase = "futureCancel"'), "ממסמך השוואה לשינוי/ביטול בעתיד");
assert(!toPrem.includes("_renderStep4PremiumCostBody"), "לא פותחים את מסך העלות מהשוואה");
const noneYes = sliceBetween(app, 'if(action === "compare-none-yes"){', 'if(action === "reasons-to-compare"){');
assert(noneYes.includes('this._mirrorUiPhase = "futureCancel"'), "אישור היעדר ביטוח ממשיך לביטול בעתיד");
const futureBack = sliceBetween(app, 'if(action === "future-back"){', 'if(action === "future-to-disclosure"');
assert(futureBack.includes('this._mirrorNeedsSubPhase = "compareNotice"'), "חזרה מביטול בעתיד למסמך השוואה");
assert(!futureBack.includes("_renderStep4PremiumCostBody"), "חזרה לא פותחת עלות");
const restore = sliceBetween(app, "_restoreMirrorPhaseUi(rec, phase){", "_mcNavPrev(){");
assert(restore.includes('this._mirrorUiPhase = "futureCancel"'), "שחזור מעלות ישנה מדלג לביטול בעתיד");
assert(!restore.includes("_showStep4Panel()"), "שחזור לא מציג את פאנל העלות");
assert(app.includes('if(phase === "premiumCost" || phase === "newPolicies") return "futureCancel"'), "מספר רץ מתייחס לשלב ביטול בעתיד");

console.log("\n4) הצעה — הנחות אמיתיות + שעבוד לתצוגה");
const collect = sliceBetween(app, "_collectNewPolicyCards(rec, opts = {}){", "_renderNeedsOffer(rec){");
assert(collect.includes("_mcHealthCoverDiscountHtml(rec, p)"), "פירוט הנחות כיסוי בבריאות על שורת ההצעה");
assert(collect.includes("_mcPledgeMarkerHtml(p)"), "סמן שעבוד על פוליסה מוצעת");
assert(app.includes('data-mc-pledge-open='), "לחיצה על סמן שעבוד");
assert(app.includes("_openMcPledgeViewModal(policyId){"), "מודאל שעבוד לקריאה בלבד");
assert(app.includes("שעבוד לבנק · תצוגה בלבד"), "מודאל לא עורך");
assert(app.includes("_mcPledgeViewBanks(policy){"), "תומך עד שני בנקים בתצוגה");
assert(css.includes(".mcPolicyRow__pledgeBtn"), "עיצוב סמן שעבוד");
assert(css.includes(".mcCoverDisc__row"), "עיצוב הנחות כיסוי");
assert(css.includes(".mcPledgeViewModal{"), "עיצוב מודאל שעבוד");

const coverStart = app.indexOf("_mcCoverDiscountPct(p, coverName){");
const coverEnd = app.indexOf("_mcPledgeMarkerHtml(p){", coverStart);
assert(coverStart > 0 && coverEnd > coverStart, "עזרי הנחת כיסוי נמצאו");
const sandbox = { console };
sandbox.window = sandbox;
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function escapeHtml(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c])); }
  const CustomersUI = {
    getHealthCoverRowsForDisplay(){
      return [
        { label: "ניתוחים", amount: "100" },
        { label: "השתלות", amount: "50" }
      ];
    }
  };
  const ui = {
    _mcAsMoneyNumber(v){ const n = Number(String(v == null ? "" : v).replace(/[^0-9.\\-]/g, "")); return Number.isFinite(n) ? n : 0; },
    _fmtMcMoney(raw){ const t = safeTrim(raw); return t ? t + "₪" : "—"; },
    ${app.slice(coverStart, coverEnd)}
  };
  this.ui = ui;
`, sandbox);
const htmlNone = sandbox.ui._mcHealthCoverDiscountHtml({}, { type: "בריאות" });
assert(htmlNone.includes("ללא הנחה"), "בלי הנחה שניתנה לא ממציאים אחוז");
assert(htmlNone.includes("ניתוחים") && htmlNone.includes("השתלות"), "מציגים את הכיסויים שקיימים");
assert(!htmlNone.includes("5%"), "אין אחוז מומצא");
const htmlDisc = sandbox.ui._mcHealthCoverDiscountHtml({}, {
  type: "בריאות",
  coverDiscountsApplied: true,
  coverDiscounts: [{ name: "ניתוחים", included: true, pct: "10" }, { name: "השתלות", included: true, pct: "0" }]
});
assert(htmlDisc.includes("10%"), "הנחה שניתנה לניתוחים מוצגת");
assert(htmlDisc.includes("90₪") || htmlDisc.includes("90"), "אחרי הנחה = 90");
assert(/השתלות[\\s\\S]*ללא הנחה/.test(htmlDisc) || htmlDisc.includes("ללא הנחה"), "כיסוי בלי הנחה נשאר ללא הנחה");
const riskHtml = sandbox.ui._mcHealthCoverDiscountHtml({}, { type: "ריסק", coverDiscountsApplied: true, coverDiscounts: [{ name: "ניתוחים", pct: "50" }] });
assert(riskHtml === "", "פירוט כיסוי רק לבריאות");
assert(sandbox.ui._mcCoverDiscountPct({ coverDiscounts: [{ name: "ניתוחים", pct: "10" }] }, "ניתוחים") === 10, "אחוז כיסוי מהנתונים");
assert(sandbox.ui._mcCoverDiscountPct({ coverDiscounts: [{ name: "ניתוחים", pct: "10", included: false }] }, "ניתוחים") === 0, "כיסוי לא כלול = בלי הנחה");

console.log("\n5) מוטבים — בחירה, מילוי משותף, יורשים ככפתור");
assert(app.includes("_benefBeginFill(rec, ids, shared){"), "כניסה למילוי נבחר");
assert(app.includes("_benefFillItems(store, items){"), "מסנן כרטיסי מילוי");
assert(app.includes("_benefTargetIdsFromCard(card){"), "העתקה לכמה פוליסות");
assert(app.includes('data-mc-benef-shared-ids='), "מילוי משותף על הכרטיס");
assert(app.includes("data-mc-benef-pick-open"), "בחירת מבוטח בודד");
assert(app.includes("data-mc-benef-pick-all"), "סמן את שניהם / כולם");
assert(app.includes("data-mc-benef-pick-fill"), "מלא יחד את המסומנים");
assert(app.includes("data-mc-benef-pick-back"), "חזרה לבחירה");
assert(app.includes('class="mcBenefCard__heirsBtn'), "יורשים חוקיים ככפתור");
assert(app.includes("אושר מול הלקוח"), "אישור מול הלקוח נשאר");
assert(app.includes("_validateBeneficiariesStep(rec){"), "ולידציית מוטבים לא הוחלפה");
assert(app.includes("_renderPledgeBankBlock(policy){"), "עריכת שעבוד נשארה בשלב המוטבים");
const fillStart = app.indexOf("_benefFillItems(store, items){");
const fillEnd = app.indexOf("_benefBeginFill(rec, ids, shared){", fillStart);
const tgtStart = app.indexOf("_benefTargetIdsFromCard(card){");
const tgtEnd = app.indexOf("_benefFillItems(store, items){", tgtStart);
const pickSandbox = { console };
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  const ui = {
    ${app.slice(tgtStart, fillEnd)}
  };
  this.ui = ui;
`, pickSandbox);
const two = [{ policyId: "a" }, { policyId: "b" }];
assert(pickSandbox.ui._benefFillItems({ pickerView: "pick" }, two).length === 0, "שתי פוליסות נפתחות בבחירה");
assert(pickSandbox.ui._benefFillItems({ pickerView: "fill", focusIds: ["b"] }, two).map((x) => x.policyId).join() === "b", "מילוי אחד-אחד לפי בחירה");
assert(pickSandbox.ui._benefFillItems({}, [{ policyId: "only" }]).length === 1, "פוליסה אחת מדלגת על בחירה");
assert(pickSandbox.ui._benefTargetIdsFromCard({ getAttribute(n){ return n === "data-mc-benef-shared-ids" ? "a,b" : ""; } }).join() === "a,b", "מזהי מילוי משותף");
assert(pickSandbox.ui._benefTargetIdsFromCard({ getAttribute(n){ return n === "data-mc-benef-policy" ? "x" : ""; } }).join() === "x", "כרטיס יחיד לפי policy id");
assert(app.includes("_mcBenefPickerPreviewText(item, meta){"), "תצוגת שמות מוטבים בבחירה");
assert(app.includes("mcBenefPickCard__bens"), "שורה למוטבים בכרטיס בחירה");
assert(app.includes("מוטבים: ${escapeHtml(preview)}"), "שמות שנשלפו מוצגים בבחירה");
assert(css.includes(".mcBenefPickCard__bens{"), "עיצוב שמות מוטבים בבחירה");
const prevStart = app.indexOf("_mcBenefRowDisplayName(b){");
const prevEnd = app.indexOf("_mcBenefFillCardHtml(item, store, relOpts, opts = {}){", prevStart);
const normStart = app.indexOf("_normalizeBenefRow(b){");
const normEnd = app.indexOf("_emptyPledgeBankRow(){", normStart);
const nameSandbox = { console };
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  const ui = {
    _benefModeForPolicy(){ return "risk_benef"; },
    ${app.slice(normStart, normEnd)}
    ${app.slice(prevStart, prevEnd)}
  };
  this.ui = ui;
`, nameSandbox);
assert(nameSandbox.ui._mcBenefRowDisplayName({ firstName: "רות", lastName: "ישראלי" }) === "רות ישראלי", "שם מלא משדות נפרדים");
assert(nameSandbox.ui._mcBenefRowDisplayName({ fullName: "דני כהן" }) === "דני כהן", "שם מ-fullName של ההצעה");
assert(nameSandbox.ui._mcBenefPickerPreviewText({
  mode: "risk_benef",
  policy: { beneficiaries: [{ firstName: "רות", lastName: "ישראלי" }, { fullName: "נועה לוי" }] }
}, {}) === "רות ישראלי · נועה לוי", "שני מוטבים מההצעה בכרטיס הבחירה");
assert(nameSandbox.ui._mcBenefPickerPreviewText({
  mode: "risk_benef",
  policy: { beneficiariesMode: "legalHeirs", beneficiaries: [] }
}, { legalHeirs: true }) === "יורשים חוקיים", "יורשים חוקיים בכרטיס הבחירה");
assert(nameSandbox.ui._mcBenefPickerPreviewText({
  mode: "risk_benef",
  policy: { beneficiaries: [{ firstName: "", lastName: "" }] }
}, {}) === "", "בלי שמות לא ממציאים מוטב");

console.log("\n6) גודל טקסט במסכי שיחה חיה");
assert(css.includes(".mcStepVerify__label{\n  font-size:15px;"), "תוויות שדות 15px");
assert(css.includes("font-size:16px;\n  font-weight:600;\n  line-height:1.35;"), "קלט 16px");
assert(css.includes(".mcBenefCard__hint{margin:0 0 12px;font-size:16px;"), "רמזי מוטבים 16px");
assert(css.includes("font-size:clamp(17px,1.6vw,19px)"), "כותרות כרטיס מוגדלות");
assert(css.includes(".mcCancelQCard__reasonLabel{display:block;margin:0 0 4px;font-size:15px;"), "תווית סיבת ביטול 15px");
assert(css.includes("font-size: 15px;\n  font-weight: 600;\n  color: var(--muted);"), "מפתחות שורת תשלום 15px");
assert(css.includes("font-size:clamp(18px, 1.7vw, 21px)"), "נוסח הקראה לא הוקטן");
assert(!css.includes(".mcNeedsScript__p{\n  margin:0 0 12px;\n  font-size:11px"), "נוסח הקראה לא ירד ל-11px");

console.log("\n7) רגרסיה — אזורים שלא נדרשו");
assert(app.includes("_mcSyncHealthDeclarationCopies(rec, source){"), "הצהרת בריאות לא הוחלפה");
assert(app.includes("_validatePaymentStep(rec){"), "תשלום לא הוחלף");
assert(app.includes("_validateSummaryStep(rec){"), "סיכום לא הוחלף");
assert(app.includes("function findAgentForLogin(username, agents = []){"), "login לא נגע");
assert(app.includes("_renderNeedsReasons(rec){"), "מסך שיקולים נשאר בקוד");
assert(app.includes('_isBeneficiaryStepProduct(type){'), "מסנן מוצרי מוטבים");
assert(app.includes('return t === "ריסק" || t === "ריסק משכנתא" || t === "מחלות קשות" || t === "סרטן"'), "סרטן ומחלות קשות נשארים במוטבים");
assert(app.includes("getHealthRowPremiumAfterDiscount"), "אחרי הנחה עדיין מהסימולטור/כיסויים");
assert(!sliceBetween(app, "_mcPremiumAfter(p){", "_mcNeedsNav(primaryAct, primaryLabel, secondaryAct, secondaryLabel){").includes("getPolicyPremiumAfterDiscount"), "לא משתמשים בזהות של האשף");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
