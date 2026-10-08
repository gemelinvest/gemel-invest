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

console.log("3) שורת חברות מתחת לטבלת הנציגים, בלי שם חברה");
const printPage = sliceBetween(app, "buildDailySalesPrintPageInnerHtml(model){", "buildDailySalesPrintDocumentHtml(forDate)");
const salesTableAt = printPage.indexOf("renderDailySalesPrintRowsHtml(model)");
const stripAt = printPage.indexOf("renderDailySalesCompanyStripHtml(model)");
assert(salesTableAt >= 0 && stripAt > salesTableAt, "הלוגואים אחרי טבלת הנציגים, לא מעליה");
assert(app.includes("renderDailySalesCompanyStripEmailHtml(model)"), "ה-HTML של המייל כולל את שורת החברות");
const emailFn = sliceBetween(app, "renderDailySalesCompanyStripEmailHtml(model){", "async _flattenDailySalesCompanyLogos");
assert(emailFn.includes("<tr>${rows.map(cell).join(\"\")}</tr>"), "במייל כל החברות באותה שורה");
assert(!emailFn.includes("giCoStrip__name"), "אין שם חברה מתחת ללוגו");
assert(emailFn.includes("font-size:18px"), "הסכום מתחת ללוגו גדול");
assert(emailFn.includes("אין מכירות עדיין היום"), "יום בלי מכירות נשאר בפירוט");
const stripFn = sliceBetween(app, "renderDailySalesCompanyStripHtml(model){", "renderDailySalesCompanyStripEmailHtml");
assert(!stripFn.includes("giCoStrip__name"), "גם ב-PDF אין שם חברה מתחת ללוגו");
assert(stripFn.includes("giCoStrip__amt"), "מתחת ללוגו יש סכום");

console.log("4) לוגו במידה של הטופס, בלי מסגרת");
const css = sliceBetween(app, "table.giCoStrip {", ".foot {");
assert(css.includes("height: 36px"), "הלוגו בגובה שמתאים לטופס");
assert(css.includes("max-width: 120px"), "הלוגו לא רחב יותר מהתא");
assert(css.includes("font-size: 18px"), "הסכום ב-PDF גדול וברור");
assert(css.includes("border: 0"), "אין מסגרת ללוגו");
assert(css.includes("box-shadow: none"), "אין צל שנראה כמסגרת");
assert(css.includes("background: transparent"), "הרקע של הלוגו שקוף");
assert(!css.includes("display: flex"), "שורת הלוגו היא טבלה, לא flex שמכסה את הנציגים");
assert(app.includes("dailySalesCompanyLogoAbsSrc"), "כתובת לוגו מלאה ל-PDF");
assert(app.includes("getCompanyLogoSrcForCompany"), "אותם קבצי לוגו של המערכת");
assert(app.includes("_flattenDailySalesCompanyLogos(idoc)"), "לפני צילום ה-PDF מנקים את רקע הלוגו");
const flat = sliceBetween(app, "async _flattenOneDailySalesLogo(img){", "buildDailySalesPrintPageInnerHtml(model)");
assert(flat.includes("nearWhite") && flat.includes("nearBlack"), "רקע לבן או שחור יורד");
assert(flat.includes("d[i + 3] = 0"), "פיקסלי הרקע נעשים שקופים");
assert(flat.includes('toDataURL("image/png")'), "הלוגו נשמר כ-PNG אחרי החיתוך");
assert(flat.includes('fillStyle = "#ffffff"'), "הלוגו החתוך יושב על לבן של הדוח, בלי מסגרת");
assert(flat.includes("if(!nearWhite && !nearBlack) return"), "לוגו שפינותיו צבעוניות לא נחתך");
assert(flat.includes("const maxH = 36"), "הלוגו נחתך לגובה השורה ולא לגודל הקובץ");
assert(flat.includes("const maxW = 120"), "הלוגו נחתך לרוחב התא");

console.log("5) טבלת הנציגים שומרת את כל מי שמכר אחרי הנחה");
assert(app.includes("dailySalesUnionTodaySoldAgents"), "יש איחוד של נציגי היום כשהרשימה החלקית לא תואמת לכרטיס");
assert(app.includes("todayMetrics.byAgent"), "האיחוד כולל את פירוט נמכר היום");
assert(app.includes("overlay.byAgent"), "האיחוד כולל גם את נציגי השרת אחרי הנחה");
const unionFn = sliceBetween(app, "dailySalesUnionTodaySoldAgents(lists){", "dailySalesApplySoldDayHealthPrat(rows, dateKey, soldAgentsOpt)");
assert(unionFn.includes("Math.max") || unionFn.includes("if(health > prev.health)"), "אותה מכירה לא נספרת פעמיים");
assert(app.includes('sectors.push("בריאות")') && app.includes('sectors.push("סיכונים")'), "הענף בטבלה הוא בריאות או סיכונים");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
