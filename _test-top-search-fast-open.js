/* חיפוש הטופ בר: ת״ז וטלפון על האינדקס, הצעות רזות, אחרונים, ופתיחה בלי select *.
   הרצה: node _test-top-search-fast-open.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
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

function extractFunction(src, signature){
  const at = src.indexOf(signature);
  if(at < 0) return "";
  const open = at + signature.length - 1;
  if(src[open] !== "{") return "";
  let depth = 0;
  for(let i = open; i < src.length; i += 1){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(at, i + 1);
    }
  }
  return "";
}

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) indexed lookup stays off the other screens");
const filterSrc = extractFunction(app, "function buildCustomerSearchOrFilter(query, options = {}){");
assert(!!filterSrc, "buildCustomerSearchOrFilter exists");
const safeTrim = (v) => String(v == null ? "" : v).trim();
const buildFilter = new Function("safeTrim", filterSrc + "\nreturn buildCustomerSearchOrFilter;")(safeTrim);
const idFilter = buildFilter("300298130", { indexedLookup: true });
assert(idFilter.includes('id_number.eq."300298130"'), "ת״ז הולכת לשוויון על האינדקס");
assert(idFilter.includes('phone.eq."300298130"'), "אותן ספרות נבדקות גם כטלפון");
assert(!idFilter.includes("ilike"), "ת״ז מלאה לא נסרקת ב-ilike");
assert(!idFilter.includes("email") && !idFilter.includes("city") && !idFilter.includes("agent_name"), "ת״ז לא סורקת עמודות בלי אינדקס");
const phoneFilter = buildFilter("050-1234567", { indexedLookup: true });
assert(phoneFilter === 'phone.eq."0501234567"', "טלפון עם מקפים נשמר כספרות ועל האינדקס");
assert(!phoneFilter.includes("id_number"), "טלפון בן 10 ספרות לא נחתך לת״ז");
const nameFilter = buildFilter("שי", { indexedLookup: true });
assert(nameFilter === 'full_name.ilike."%שי%"', "שם של מילה אחת נשאר על אינדקס השם");
assert(!nameFilter.includes("id_number") && !nameFilter.includes("phone"), "שם לא סורק ת״ז וטלפון");
const two = buildFilter("שי עטייה", { indexedLookup: true });
assert(two.includes('full_name.ilike."%שי%"') && two.includes('full_name.ilike."%עטייה%"') && two.startsWith("and("), "שתי מילים נשארות על השם");
assert(buildFilter("נדב", { nameWordsAnyOrder: true }).includes("id_number.ilike"), "מסך הלקוחות נשאר על המסנן הישן");
assert(app.includes("searchCustomers(q, 40, { nameWordsAnyOrder: true })"), "מסך הלקוחות לא עבר לחיפוש האינדקס");
assert(!app.includes("searchCustomers(q, 20, { nameWordsAnyOrder"), "שיוך תזכורת נשאר בלי המסנן");

console.log("\n3) top bar asks for customers and light proposals together");
const gs = app.slice(app.indexOf("const GlobalSearch = {"), app.indexOf("GlobalSearch.init();"));
assert(gs.includes("indexedLookup: true"), "הטופ בר מבקש חיפוש אינדקס");
assert(gs.includes("searchCustomers(raw, 20, opts)"), "הטופ בר מחפש לקוחות");
assert(gs.includes("searchProposals(raw, 12, opts)"), "הטופ בר מחפש הצעות רזות במקביל");
assert(!gs.includes("includePayload: true"), "הטופ בר לא מושך payload בחיפוש");
assert(!gs.includes("this.startBackgroundIndex()"), "הטופ בר לא סורק את כל התיקים ברקע");
assert(gs.includes("חיפושים אחרונים"), "לחיצה על שורה ריקה מציגה אחרונים");
assert(gs.includes("gi.topSearch.recent."), "האחרונים נשמרים לפי משתמש");

console.log("\n4) opening a search hit does not download select *");
const opener = extractFunction(app, "async openCustomerFromSearch(entry){");
assert(opener.includes("CUSTOMER_LIGHT_COLUMNS"), "כשאין שורה מקומית נשלפות רק העמודות הרזות");
assert(opener.includes("lightShadows: true"), "השורה נכנסת בלי רענון צללים מלא");
assert(!opener.includes("fetchCustomerRecordFromServer"), "פתיחה מהחיפוש לא מורידה את כל השורה");
assert(!opener.includes('select("*")') && !opener.includes("select('*')"), "אין select * במסלול הזה");
assert(app.includes('selectExpr = rec ? "id,payload"'), "מילוי התיק אחר כך נשאר id,payload");

console.log("\n5) loader keeps its copy and drops the glass scene");
const loader = html.slice(html.indexOf('id="customerLoader"'), html.indexOf('id="customerPolicyModal"'));
assert(loader.includes("טוען תיק לקוח"), "הכותרת נשארת");
assert(loader.includes("אנו מכינים עבורך את נתוני הלקוח"), "שורת המשנה נשארת");
assert(loader.includes("customerLoader__brandLogo") && loader.includes("onyx-sidebar-logo.png"), "הלוגו נשאר");
assert(!loader.includes("onyx-sidebar-logo-blue.png"), "לא מוחלף ללוגו הכחול של התפריט");
assert(loader.includes("customerLoader__bar"), "פס התקדמות דק");
assert(!loader.includes("customerLoader__orb"), "עיגולי הזכוכית הוסרו");
assert(css.includes("GI-LOADER 2026-11-21") && css.includes(".customerLoader__bar"), "העיצוב השקט בקובץ העיצוב");
assert(!css.includes("customerLoaderPanelFloat"), "אנימציית הציפה הוסרה");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
