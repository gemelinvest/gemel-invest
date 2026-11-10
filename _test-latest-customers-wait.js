/* רשימת לקוחות: ניסיון אחד קצר לדירוג, והשורות שכבר בזיכרון נשארות על המסך.
   הרצה: node _test-latest-customers-wait.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
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

function between(src, start, end){
  const a = src.indexOf(start);
  const b = a < 0 ? -1 : src.indexOf(end, a + start.length);
  if(a < 0 || b < 0) return "";
  return src.slice(a, b);
}

const latest = between(app, "async loadLatestCustomers(limit = 10){", "async searchCustomers(");
const sync = between(app, "async syncListFromServer(options = {}){", "handleOpenCustomerClick(");
const latestBranch = between(sync, "if(!q){", "this._showListLoading();\n        const res = await Storage.searchCustomers");

assert(latest.includes('client.rpc("gi_latest_customers", rpcArgs)'), "הדירוג הקיים נשאר הקריאה הראשונה");
assert(latest.includes("timeoutMs: 4000, retries: 1"), "ניסיון אחד, המתנה של 4 שניות");
assert(!latest.includes("timeoutMs: 30000"), "אין המתנה של 30 שניות");
assert(latest.includes("LATEST_CUSTOMERS_RPC_FALLBACK"), "שגיאה או המתנה נכנסות לנפילה");
assert(latest.includes("CUSTOMER_LIGHT_COLUMNS"), "הנפילה נשארת שליפה רזה");
assert(latest.includes("_fetchLimitedRowsMergedAgentScope"), "הנפילה נשארת במסנן הנציג");

assert(latestBranch.includes("const localRows = this.listLatest(CUSTOMERS_DEFAULT_VISIBLE)"), "בלי חיפוש, קודם השורות שכבר עברו את מסנן התפקיד");
assert(latestBranch.indexOf("this.listLatest(CUSTOMERS_DEFAULT_VISIBLE)") < latestBranch.indexOf("this._showListLoading()"), "שורת הטעינה רק כשאין שורה מקומית");
assert(latestBranch.includes("await Storage.loadLatestCustomers(CUSTOMERS_DEFAULT_VISIBLE)"), "אחר כך עדיין נמשכת הרשימה מהשרת");
assert(sync.includes("this._showListLoading();\n        const res = await Storage.searchCustomers(q, 40)"), "בחיפוש לא מציגים את עשרת האחרונים");

console.log(passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
