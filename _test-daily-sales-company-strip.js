/* GI-CO-STRIP — פירוט נמכר היום לפי חברה בדוח המייל: שורה אופקית ולוגו בלי מסגרת.
   הרצה: node _test-daily-sales-company-strip.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
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

function sliceBetween(src, start, end){
  const i = src.indexOf(start);
  if(i < 0) return "";
  const j = src.indexOf(end, i + start.length);
  if(j < 0) return "";
  return src.slice(i, j);
}

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("2) המודל לוקח את פירוט נמכר היום רק להיום");
const modelRet = sliceBetween(app, "companyBreakdown: report.isToday", "buildDailySalesPrintModel");
assert(app.includes("companyBreakdown: report.isToday"), "companyBreakdown קיים במודל");
assert(app.includes("todayMetrics.breakdown"), "הפירוט מגיע מכרטיס נמכר היום");
assert(app.includes(": null"), "ביום שאינו היום אין פירוט חברות");
assert(modelRet.includes("row.premium"), "נשמר סכום החברה");
assert(modelRet.includes("ללא חברה"), "חברה בלי שם נשארת בפירוט");

console.log("3) שורה אופקית ב-PDF וב-HTML של המייל");
assert(app.includes("renderDailySalesCompanyStripHtml(model)"), "ה-PDF כולל את שורת החברות");
assert(app.includes("renderDailySalesCompanyStripEmailHtml(model)"), "ה-HTML של המייל כולל את שורת החברות");
assert(app.includes("נמכר היום לפי חברה"), "כותרת הפירוט");
assert(app.includes('class="giCoStrip"'), "החברות בשורת giCoStrip");
assert(app.includes("display: flex; flex-wrap: wrap; align-items: center;"), "החברות זו לצד זו, לא טבלה אנכית");
const emailFn = sliceBetween(app, "renderDailySalesCompanyStripEmailHtml(model){", "async _flattenDailySalesCompanyLogos");
assert(emailFn.includes("<tr>${rows.map(cell).join(\"\")}</tr>"), "במייל כל החברות באותה שורה");
assert(emailFn.includes("אין מכירות עדיין היום"), "יום בלי מכירות נשאר בפירוט");

console.log("4) לוגו גדול, בלי מסגרת, רקע שקוף על צבע הדוח");
const css = sliceBetween(app, ".giCoStripWrap {", ".foot {");
assert(css.includes("height: 84px"), "הלוגו גדול");
assert(css.includes("border: 0"), "אין מסגרת ללוגו");
assert(css.includes("box-shadow: none"), "אין צל שנראה כמסגרת");
assert(css.includes("background: transparent"), "הרקע של הלוגו שקוף");
assert(css.includes(".giCoStrip__item {") && css.includes("border: 0"), "גם הכרטיס בלי מסגרת");
assert(app.includes("dailySalesCompanyLogoAbsSrc"), "כתובת לוגו מלאה ל-PDF");
assert(app.includes("getCompanyLogoSrcForCompany"), "אותם קבצי לוגו של המערכת");
assert(app.includes("_flattenDailySalesCompanyLogos(idoc)"), "לפני צילום ה-PDF מנקים את רקע הלוגו");
const flat = sliceBetween(app, "async _flattenOneDailySalesLogo(img){", "buildDailySalesPrintPageInnerHtml(model)");
assert(flat.includes("nearWhite") && flat.includes("nearBlack"), "רקע לבן או שחור יורד");
assert(flat.includes("d[i + 3] = 0"), "פיקסלי הרקע נעשים שקופים");
assert(flat.includes('toDataURL("image/png")'), "הלוגו נשמר כ-PNG אחרי החיתוך");
assert(flat.includes('fillStyle = "#ffffff"'), "הלוגו החתוך יושב על לבן של הדוח, בלי מסגרת");
assert(flat.includes("if(!nearWhite && !nearBlack) return"), "לוגו שפינותיו צבעוניות לא נחתך");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
