/* שלב 5 בשיקוף (פוליסות מוצעות): פרמיה לפני ואחרי הנחה תמיד בכרטיס.
   הרצה: node _test-ops-step5-offer-premiums.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20261007-lead-dup-v1";
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

function extractMethod(src, name){
  const start = src.indexOf("\n    " + name + "(");
  if(start < 0) return "";
  let i = src.indexOf("{", start);
  let depth = 0;
  for(; i < src.length; i++){
    if(src[i] === "{") depth += 1;
    else if(src[i] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start + 1, i + 1);
    }
  }
  return "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("giMcPrem=1"), "cache bump for offer premiums");
assert(html.includes("giMcCoverDup=1"), "cache bump for cover dedupe");
assert(html.includes("app.css?v=" + APP_TAG) && html.includes("giMcPrem=1"), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(sw.includes("mc-prem-v1"), "service-worker premium bump");
assert(sw.includes("mc-cover-dup-v1"), "service-worker cover-dedupe bump");

console.log("\n2) כרטיס מוצע — שורת פרמיה ייעודית, לא auto-fit שגוזר את לפני/אחרי");
const offerCard = extractMethod(app, "_mcOfferCardHtml");
assert(offerCard.includes('class="mcOfferCard__premia"'), "שורת פרמיה נפרדת בכרטיס");
assert(offerCard.includes("לפני הנחה") && offerCard.includes("לאחר הנחה"), "תוויות לפני ואחרי בכרטיס");
assert(offerCard.includes("mcOfferCard__fact--before") && offerCard.includes("mcOfferCard__fact--after"), "מחלקות לפני/אחרי");
assert(!offerCard.includes('["לפני הנחה", opts.before]'), "הפרמיות לא יושבות באותו גריד של מבוטח/מוצר");
assert(css.includes(".mcOfferCard__premia{"), "עיצוב שורת הפרמיה");
assert(/display:\s*flex/.test(css.slice(css.indexOf(".mcOfferCard__premia{"), css.indexOf(".mcOfferCard__premia{") + 280)), "לפני ואחרי בשורה אחת");
assert(/justify-content:\s*flex-start/.test(css.slice(css.indexOf(".mcOfferCard__premia{"), css.indexOf(".mcOfferCard__premia{") + 280)), "אחרי הנחה צמוד ללפני הנחה");
assert(!/mcOfferCard__premia\{[^}]*auto-fit/.test(css), "שורת הפרמיה לא auto-fit");
assert(!/mcOfferCard__facts\{[^}]*auto-fit/.test(css), "גריד הזהות לא auto-fit");

console.log("\n3) איסוף כרטיס — סכומים מהפונקציות, לא אחרי הפשטת HTML");
const collect = sliceBetween(app, "_collectNewPolicyCards(rec, opts = {}){", "_mcMigdalPeakMap(rec){");
assert(collect.includes("const beforeText = this._fmtMcMoney(this._mcPremiumBefore(p))"), "לפני הנחה מחושב ישירות");
assert(collect.includes("const afterText = this._fmtMcMoney(this._mcPremiumAfter(p))"), "אחרי הנחה מחושב ישירות");
assert(collect.includes("before: beforeText") && collect.includes("after: afterText"), "הכרטיס מקבל את הסכומים הגולמיים");
assert(!collect.includes("before: this._mcPlainText(beforeHtml)"), "לא מעבירים שבב HTML מפורק");
const offerRender = sliceBetween(app, "_renderNeedsOffer(rec){", "_renderNeedsReasons(rec){");
assert(offerRender.includes("_mirrorCoerceCustomerPayloadInPlace(rec)"), "מסך ההצעה מנרמל payload לפני הציור");

console.log("\n4) ציור בפועל — הסכומים מופיעים ב-HTML");
const sandbox = {};
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function escapeHtml(s){
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]));
  }
  const ui = {
    _mcPlainText(v){
      return safeTrim(String(v == null ? "" : v).replace(/<[^>]+>/g, " ").replace(/\\s+/g, " "));
    },
    ${offerCard}
  };
  this.ui = ui;
`, sandbox);

const cardHtml = sandbox.ui._mcOfferCardHtml({
  insured: "ישראל ישראלי",
  product: "בריאות",
  company: "הפניקס",
  sum: "—",
  before: "220₪",
  after: "180₪",
  meta: "",
  actions: ""
});
assert(cardHtml.includes("mcOfferCard__premia"), "הכרטיס כולל שורת פרמיה");
const premAt = cardHtml.indexOf("mcOfferCard__premia");
const premChunk = premAt < 0 ? "" : cardHtml.slice(premAt, premAt + 420);
assert(premChunk.includes("לפני הנחה") && premChunk.includes("220₪"), "לפני הנחה 220 מוצג בשורת הפרמיה");
assert(premChunk.includes("לאחר הנחה") && premChunk.includes("180₪"), "לאחר הנחה 180 מוצג בשורת הפרמיה");
assert(premChunk.includes("mcOfferCard__fact--before") && premChunk.includes("mcOfferCard__fact--after"), "שתי העמודות צבועות");

const discStart = app.indexOf("_mcCoverDiscountPct(p, coverName){");
const discEnd = app.indexOf("_mcPledgeMarkerHtml(p){", discStart);
const discBlock = app.slice(discStart, discEnd);
const coverBox = {};
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function escapeHtml(s){
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]));
  }
  const ui = {
    _mcAsMoneyNumber(v){
      const n = Number(String(v == null ? "" : v).replace(/[^0-9.\\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    },
    _fmtMcMoney(raw){
      const n = this._mcAsMoneyNumber(raw);
      return n > 0 ? (n + "₪") : "—";
    },
    _mcPremiumBefore(p){ return p && p.premiumBefore != null ? p.premiumBefore : "0"; },
    _mcPremiumAfter(p){ return p && p.premiumAfter != null ? p.premiumAfter : "0"; },
    _mcWizardApi(){ return this._wiz; },
    _mcQuoteCoverPremiums(p){
      const byName = {};
      const add = (key, prem) => {
        const name = safeTrim(key);
        if(!name || !(prem > 0)) return;
        byName[name] = Math.round(((byName[name] || 0) + prem) * 100) / 100;
      };
      const quotes = p && p.riskSimQuotes;
      if(!quotes || typeof quotes !== "object") return byName;
      Object.keys(quotes).forEach((id) => {
        const covers = Array.isArray(quotes[id] && quotes[id].covers) ? quotes[id].covers : [];
        covers.forEach((c) => {
          const prem = this._mcAsMoneyNumber(c && c.monthlyPremium);
          add(c && c.label, prem);
          add(c && c.name, prem);
          add(c && c.wizardKey, prem);
        });
      });
      return byName;
    },
    _mcCoverNeedsSurgeryRead(){ return false; },
    _mcIsraelSurgeryReadHtml(){ return ""; },
    ${discBlock}
  };
  this.ui = ui;
`, coverBox);
coverBox.ui._wiz = {
  getPolicyCoverItems(p){ return Array.isArray(p && p.healthCovers) ? p.healthCovers.slice() : []; },
  getHealthCoverGrossPremiumsByName(){
    return { "תרופות מחוץ לסל הבריאות": 20, "ייעוץ ובדיקות": 10 };
  }
};
const coverHtml = coverBox.ui._mcHealthCoverDiscountHtml({}, {
  type: "בריאות",
  healthCovers: ["תרופות מחוץ לסל הבריאות", "ייעוץ ובדיקות"],
  premiumBefore: "30",
  premiumAfter: "30"
});
assert(coverHtml.includes("<strong>20₪</strong>") && coverHtml.includes("<strong>10₪</strong>"), "סכומי כיסוי ב-strong");
assert(coverHtml.includes("לפני הנחה") && coverHtml.includes("אחרי הנחה"), "תוויות כיסוי מלאות");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
