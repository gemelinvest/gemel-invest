/* חיפוש שיחת שיקוף אלמנטרי מוצא לקוח שהוקם עכשיו על ידי נציג מכירות.
   השליפה כוללת payload, והשער מזהה flowType elementary.
   טלפון עם מקפים מותאם גם לערך השמור בלי תווים.
   הרצה: node _test-elementary-mirror-search-new-customer.js
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
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-elementary-mirror-search-new-customer.js")]).status === 0, "node --check this test");

console.log("\n2) שיקוף אלמנטרי שולף payload בלי סינון נציג");
const mirrorSearch = extractFunction(app, "async search(options = {}){");
assert(mirrorSearch.includes("Storage.searchCustomers(q, 40, { skipAgentScope: true, includePayload: true, matchDigits: true })"), "החיפוש מבקש payload והתאמת ספרות");
assert(app.includes("CUSTOMER_LIGHT_COLUMNS + \",payload\""), "השליפה מוסיפה payload רק כשמבקשים");
assert(app.includes("Storage.searchCustomers(q, 30, { skipAgentScope: true })"), "חיפוש שיקוף התפעול נשאר בלי payload");
assert((app.split("includePayload: true").length - 1) === 1, "includePayload רק בשיקוף האלמנטרי");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
assert(html.includes("giElemSearch=1"), "מטמון app.js עודכן");
assert(sw.includes("elem-search-v1"), "מטמון ה-service worker עודכן");

console.log("\n3) שער המאגר מזהה תיק אלמנטרי שהקים נציג מכירות");
const poolSrc = extractFunction(app, "function isElementaryPoolCustomerRecord(rec){");
assert(poolSrc.includes('payload.flowType).toLowerCase() === "elementary"'), "השער בודק flowType");
assert(poolSrc.includes("payload.elementaryProduct"), "השער בודק elementaryProduct");
const safeTrim = (v) => String(v == null ? "" : v).trim();
const isPool = new Function("safeTrim", poolSrc + "\nreturn isElementaryPoolCustomerRecord;")(safeTrim);

const freshSales = {
  id: "cust_new",
  agentRole: "agent",
  fullName: "דנה כהן",
  idNumber: "123456782",
  phone: "0501234567",
  payload: {}
};
assert(isPool(freshSales) === false, "שורה רזה בלי payload אינה מאגר אלמנטרי");
assert(isPool({ ...freshSales, payload: { flowType: "elementary", elementaryPolicies: [{ id: "elementary_mandatory" }] } }) === true, "flowType elementary של נציג מכירות כן במאגר");
assert(isPool({ ...freshSales, payload: { elementaryProduct: "vehicle" } }) === true, "elementaryProduct מספיק לזיהוי");
assert(isPool({ ...freshSales, payload: { flowType: "health", newPolicies: [{ id: 1 }] } }) === false, "תיק בריאות נשאר בחוץ");
assert(isPool({ ...freshSales, agentRole: "elementary", payload: {} }) === true, "יוזר אלמנטרי עדיין מזוהה גם בלי payload");

console.log("\n4) טלפון ות״ז עם מקפים");
const filterSrc = extractFunction(app, "function buildCustomerSearchOrFilter(query, options = {}){");
assert(!!filterSrc, "buildCustomerSearchOrFilter exists");
const buildFilter = new Function("safeTrim", filterSrc + "\nreturn buildCustomerSearchOrFilter;")(safeTrim);
const dashed = buildFilter("050-1234567", { matchDigits: true });
assert(dashed.includes('phone.ilike."%0501234567%"'), "טלפון עם מקפים מחפש גם את הספרות השמורות");
assert(dashed.includes('id_number.ilike."%0501234567%"'), "אותן ספרות נבדקות גם מול ת״ז");
const plain = buildFilter("0501234567", { matchDigits: true });
assert(plain.includes('phone.ilike."%0501234567%"'), "טלפון בלי מקפים נשאר בתבנית הרגילה");
assert(!plain.includes('phone.ilike."%0501234567%"', plain.indexOf('phone.ilike."%0501234567%"') + 1), "אין תבנית ספרות כפולה כשהקלט כבר ספרות");
const spacedId = buildFilter("123 456 782", { matchDigits: true });
assert(spacedId.includes('id_number.ilike."%123456782%"'), "ת״ז עם רווחים מותאמת בלי רווחים");
const nameOnly = buildFilter("דנה כהן", { matchDigits: true });
assert(nameOnly.includes('full_name.ilike."%דנה כהן%"'), "שם נשאר בחיפוש");
assert((nameOnly.split("id_number.ilike.").length - 1) === 1, "שם לא מוסיף תבנית ספרות על ת״ז");
assert((nameOnly.split("phone.ilike.").length - 1) === 1, "שם לא מוסיף תבנית ספרות על טלפון");
const noDigitsFlag = buildFilter("050-1234567", {});
assert(!noDigitsFlag.includes("0501234567"), "בלי matchDigits לא מוסיפים ספרות — שאר החיפושים לא משתנים");
assert(buildFilter("   ", { matchDigits: true }) === "", "שאילתה ריקה לא בונה מסנן");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
