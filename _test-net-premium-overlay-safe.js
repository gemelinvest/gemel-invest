/* GI-NET 2026-08-27 — בחירת מקור ל«פרמיה חודשית נטו» בלי לשנות נוסחה.
   חוסר: לא דורסים סכום מקומי גבוה ב-RPC נמוך.
   עודף: אחרי חישוב מקומי מוכן לא עוברים ל-RPC רק כי הוא גדול יותר.
   הרצה: node _test-net-premium-overlay-safe.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260828-menora-health-decl-v1";
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

function extractObjectMethod(src, methodName){
  const needle = "\n    " + methodName + "(";
  const start = src.indexOf(needle);
  if(start < 0) return "";
  const brace = src.indexOf("{", start);
  if(brace < 0) return "";
  let depth = 0;
  for(let i = brace; i < src.length; i += 1){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1).trim();
    }
  }
  return "";
}

const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-net-premium-overlay-safe.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");

console.log("\n2) נתיב מיזוג נטו — בלי נוסחה");
assert(app.includes("_shouldApplyServerNetOverlay(opts){"), "עוזר בחירת מקור נטו");
assert(app.includes("const applyServerNet = this._shouldApplyServerNetOverlay({"), "compareServerKpis משתמש בעוזר");
assert(app.includes("if(applyServerNet){"), "דריסת נטו רק כשהעוזר מאשר");
assert(app.includes("this.compareServerKpis?.(this._metricsCache);"), "אחרי מכירה שולפים overlay חודשי מחדש");
const policyNet = extractObjectMethod(app, "policyNetPremium");
assert(!!policyNet && policyNet.includes("getPolicyPremiumAfterDiscount"), "policyNetPremium לא הוסר");
assert(!policyNet.includes("_shouldApplyServerNetOverlay"), "policyNetPremium לא נגע במיזוג");
assert(app.includes("formatNetProductBreakdownHtml(metrics.netProductTotals)"), "פירוט נטו נשאר לפי סוג מוצר");
assert(app.includes("if(premium > (Number(m.agentAppointmentPremium) || 0)){"), "מינוי סוכן עדיין רק מעלה, לא דורס למטה");

console.log("\n3) חוסר / עודף");
const fn = extractObjectMethod(app, "_shouldApplyServerNetOverlay");
assert(!!fn, "חולץ _shouldApplyServerNetOverlay");
const sandbox = {};
vm.runInNewContext(
  "this._shouldApplyServerNetOverlay = function" + fn.slice("_shouldApplyServerNetOverlay".length) + ";",
  sandbox
);
const decide = (opts) => sandbox._shouldApplyServerNetOverlay(opts);

assert(decide({ localNet: 8000, serverNet: 5000, missingCustomers: 12, localReady: false, localHasNet: true }) === false,
  "hydration: מקומי גבוה — לא דורסים (חוסר)");
assert(decide({ localNet: 200, serverNet: 5000, missingCustomers: 12, localReady: false, localHasNet: true }) === true,
  "hydration: מקומי חלקי נמוך — RPC (בלי קפיצה ל־₪200)");
assert(decide({ localNet: 0, serverNet: 5000, missingCustomers: 12, localReady: false, localHasNet: false }) === true,
  "hydration: מקומי ריק — RPC");
assert(decide({ localNet: 5000, serverNet: 8000, missingCustomers: 0, localReady: true, localHasNet: true }) === false,
  "מקומי מוכן: לא עוברים ל-RPC גדול יותר (עודף)");
assert(decide({ localNet: 8000, serverNet: 5000, missingCustomers: 0, localReady: true, localHasNet: true }) === false,
  "מקומי מוכן גבוה — נשאר מקומי");
assert(decide({ localNet: 0, serverNet: 5000, missingCustomers: 0, localReady: true, localHasNet: false }) === true,
  "מקומי מוכן אבל ₪0 — מותר RPC");
assert(decide({ localNet: 5000, serverNet: 0, missingCustomers: 0, localReady: true, localHasNet: true }) === false,
  "RPC ריק לא דורס מספר טוב");
assert(decide({ localNet: 5000, serverNet: 8000, missingCustomers: 12, localReady: false, localHasNet: true }) === true,
  "hydration: RPC גבוה יותר — max בזמן טעינה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
