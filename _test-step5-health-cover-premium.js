/* שלב 5 · פרמיה לפי כיסוי: השם והסכום לפי מפתח הכיסוי שנשמר בפוליסה.
   הרצה: node _test-step5-health-cover-premium.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
let failed = 0;
let passed = 0;
function assert(c, m){
  if(c){ passed++; console.log("  PASS  " + m); }
  else { failed++; console.error("  FAIL  " + m); }
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

const start = app.indexOf("_mcHealthCoverDiscountHtml(rec, p){");
const end = app.indexOf("_mcPledgeMarkerHtml(p){", start);
const pctStart = app.indexOf("_mcCoverDiscountPct(p, coverName){");
const block = app.slice(pctStart, end);
assert(start > 0 && end > start, "בלוק פרמיה לפי כיסוי נמצא");
assert(block.includes("getPolicyCoverItems"), "שמות הכיסוי נלקחים מהפוליסה");
assert(block.includes("getHealthCoverGrossPremiumsByName"), "הפרמיה נלקחת מהסימולטור");
assert(!block.includes("logicalHealthCoverLabel("), "בלי קריאה למיפוי שמות של פרודוקציה");

const sandbox = {};
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  function escapeHtml(s){
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]));
  }
  const CustomersUI = {
    getHealthCoverRowsForDisplay(){
      return [{ label: "SHOULD_NOT_APPEAR", amount: "999" }];
    }
  };
  const ui = {
    _wiz: null,
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
    ${block}
  };
  this.ui = ui;
`, sandbox);

function policyFrom(company, covers, extra){
  const healthCovers = covers.map((row) => row[0]);
  return Object.assign({
    type: "בריאות",
    company,
    healthCovers,
    riskSimQuotes: {
      i1: {
        covers: covers.map((row) => ({ wizardKey: row[0], monthlyPremium: row[1] }))
      }
    },
    premiumBefore: String(covers.reduce((s, row) => s + row[1], 0)),
    premiumAfter: String(covers.reduce((s, row) => s + row[1], 0))
  }, extra || {});
}

sandbox.ui._wiz = {
  getPolicyCoverItems(p){ return Array.isArray(p && p.healthCovers) ? p.healthCovers.slice() : []; },
  getHealthCoverGrossPremiumsByName(p){
    const map = {};
    const quotes = (p && p.riskSimQuotes) || {};
    Object.keys(quotes).forEach((id) => {
      const list = Array.isArray(quotes[id] && quotes[id].covers) ? quotes[id].covers : [];
      list.forEach((c) => {
        const name = String((c && (c.wizardKey || c.label)) || "").trim();
        const n = Number(c && c.monthlyPremium);
        if(name && n > 0) map[name] = (map[name] || 0) + n;
      });
    });
    return map;
  }
};

const companies = [
  ["מנורה", [
    ["השתלות וטיפולים מיוחדים מחוץ לישראל", 10],
    ["תרופות מחוץ לסל הבריאות", 20],
    ["ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל", 8],
    ["משלים שב\"ן עם השתתפות עצמית", 30],
    ["משלים שב\"ן ללא השתתפות עצמית", 40],
    ["טיפול ואבחון לילד", 15],
    ["ייעוץ ובדיקות", 12]
  ], ["תרופות מחוץ לסל שירותי הבריאות", "שירות פרימיום לילד"]],
  ["הפניקס", [
    ["השתלות וטיפולים מיוחדים מחוץ לישראל", 11],
    ["ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל", 9],
    ["תרופות מחוץ לסל שירותי הבריאות", 21],
    ["משלים שב\"ן עם השתתפות עצמית 5,000 ₪", 31],
    ["משלים שב\"ן ללא השתתפות עצמית", 41],
    ["ייעוץ ובדיקות ואבחון רפואי מהיר", 16],
    ["ייעוץ ובדיקות", 13],
    ["כתב שירות התפתחות הילד", 7]
  ], ["שירות פרימיום לילד"]],
  ["איילון", [
    ["השתלות וטיפולים מיוחדים בחו\"ל", 14],
    ["תרופות מחוץ לסל הבריאות", 22],
    ["ניתוחים וטיפולים מחליפי ניתוח בחו\"ל", 6],
    ["משלים שב\"ן", 18],
    ["משלים שב\"ן עם השתתפות עצמית 5,000 ₪", 28],
    ["אמבולטורי מורחב", 19],
    ["טיפולים אמבולטוריים", 17],
    ["ייעוץ ובדיקות", 13],
    ["טיפולים ואבחונים בהתפתחות הילד", 8]
  ], ["השתלות וטיפולים מיוחדים מחוץ לישראל", "תרופות מחוץ לסל שירותי הבריאות", "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל", "שירות פרימיום לילד"]],
  ["הכשרה", [
    ["תרופות מחוץ לסל שירותי הבריאות", 23],
    ["השתלות וטיפולים מיוחדים מחוץ לישראל", 12],
    ["ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל", 7],
    ["משלים שב\"ן עם השתתפות עצמית 5,000 ₪", 33],
    ["משלים שב\"ן ללא השתתפות עצמית", 43],
    ["ייעוץ ובדיקות", 14],
    ["שירות פרימיום לילד", 9]
  ], []],
  ["מגדל", [
    ["תרופות מחוץ לסל", 24],
    ["השתלות וטיפולים מיוחדים מחוץ לישראל", 13],
    ["ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל", 5],
    ["משלים שב\"ן", 18],
    ["משלים שב\"ן עם השתתפות עצמית 5,000 ₪", 34],
    ["טיפולים אמבולטוריים", 16],
    ["ייעוץ ובדיקות", 11]
  ], ["תרופות מחוץ לסל שירותי הבריאות"]],
  ["כלל", [
    ["ניתוחים ומחליפי ניתוח בחו\"ל", 4],
    ["השתלות וטיפולים מיוחדים בחו\"ל", 15],
    ["תרופות", 25],
    ["משלים שב\"ן עם השתתפות עצמית 5,000 ₪", 35],
    ["משלים שב\"ן לניתוחים ומחליפי ניתוח בישראל", 36],
    ["ניתוחים ומחליפי ניתוח בישראל", 37],
    ["ייעוץ, בדיקות ואבחון רפואי מהיר", 26],
    ["ייעוצים ובדיקות", 27],
    ["שירותים לילד", 8],
    ["מדיכלל מחלות קשות 33", 44]
  ], ["ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל", "השתלות וטיפולים מיוחדים מחוץ לישראל", "תרופות מחוץ לסל שירותי הבריאות", "שירות פרימיום לילד"]]
];

console.log("1) כל חברה — שם מקורי וסכום, בלי מיזוג לשם גנרי");
companies.forEach((entry) => {
  const company = entry[0];
  const covers = entry[1];
  const absent = entry[2];
  const html = sandbox.ui._mcHealthCoverDiscountHtml({}, policyFrom(company, covers));
  covers.forEach((row) => {
    const shown = row[0].replace(/"/g, "&quot;");
    const marker = "mcCoverDisc__name\">" + shown + "</span>";
    const at = html.indexOf(marker);
    const rowHtml = at < 0 ? "" : html.slice(at, at + marker.length + 160);
    assert(at >= 0, company + " מציג " + row[0]);
    assert(rowHtml.includes("לפני") && rowHtml.includes(row[1] + "₪"), company + " מציג " + row[1] + " ל" + row[0]);
  });
  absent.forEach((name) => {
    assert(!html.includes(name.replace(/"/g, "&quot;")), company + " לא מחליף ל־" + name);
  });
  assert(!html.includes("SHOULD_NOT_APPEAR"), company + " לא משתמש בשם הממופה כשיש כיסויים בפוליסה");
  assert(!html.includes("—"), company + " בלי קווים במקום סכום");
});

console.log("\n2) הנחה לפי שם הכיסוי המקורי");
const discounted = policyFrom("איילון", [
  ["תרופות מחוץ לסל הבריאות", 20],
  ["ייעוץ ובדיקות", 10]
], {
  coverDiscountsApplied: true,
  coverDiscounts: [
    { name: "תרופות מחוץ לסל הבריאות", included: true, pct: "10" },
    { name: "ייעוץ ובדיקות", included: true, pct: "0" }
  ],
  premiumBefore: "30",
  premiumAfter: "28"
});
const discHtml = sandbox.ui._mcHealthCoverDiscountHtml({}, discounted);
assert(discHtml.includes("תרופות מחוץ לסל הבריאות"), "שם תרופות איילון נשאר");
assert(discHtml.includes("18₪"), "אחרי 10% על 20 = 18");
assert(discHtml.includes("10₪"), "ייעוץ בלי אחוז נשאר 10");
assert(!discHtml.includes("תרופות מחוץ לסל שירותי הבריאות"), "אין החלפה לשם הגנרי של תרופות");

console.log("\n3) תוספת מחלות ופוליסה בלי מערך כיסויים");
const addonHtml = sandbox.ui._mcHealthCoverDiscountHtml({}, {
  type: "בריאות",
  company: "מנורה",
  healthCovers: ["TOP קרן מחלות קשות"],
  healthAddonPremiums: { "TOP קרן מחלות קשות": { i1: "55" } }
});
assert(addonHtml.includes("TOP קרן מחלות קשות"), "שם תוספת המחלות נשאר");
assert(addonHtml.includes("55₪"), "פרמיית התוספת מוצגת");
assert(!addonHtml.includes(">מחלות קשות<"), "התוספת לא מתקצרת למחלות קשות");

const legacyHtml = sandbox.ui._mcHealthCoverDiscountHtml({}, { type: "בריאות" });
sandbox.ui._wiz = {
  getPolicyCoverItems(){ return []; },
  getHealthCoverGrossPremiumsByName(){ return {}; }
};
const legacyOnly = sandbox.ui._mcHealthCoverDiscountHtml({}, { type: "בריאות", healthCovers: [] });
assert(legacyOnly.includes("SHOULD_NOT_APPEAR") && legacyOnly.includes("999₪"), "בלי כיסויי פוליסה נשארת תצוגת הגיבוי");
assert(sandbox.ui._mcHealthCoverDiscountHtml({}, { type: "ריסק", healthCovers: ["תרופות"] }) === "", "לא בריאות — בלי הבלוק");
assert(typeof legacyHtml === "string", "קריאה בלי כיסויים לא זורקת");

console.log(failed ? "\nFAILED " + failed : "\nOK " + passed);
process.exit(failed ? 1 : 0);
