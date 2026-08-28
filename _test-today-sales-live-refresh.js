/* GI-TODAY 2026-08-27 — כרטיס «נמכר היום» / «כמה מכרתי היום»
   מתעדכן במקום אחרי מכירה, בלי לצאת מהדשבורד.
   בלי שינוי חישוב פרמיה, כרטיסי KPI אחרים, או תוכן «הצג פירוט».
   הרצה: node _test-today-sales-live-refresh.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260828-hach-quest-fill-v1";
const WIZARD_TAG = "20260827-today-sales-refresh-v1";
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
const wizard = read("gi-wizard.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-today-sales-live-refresh.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + WIZARD_TAG + '"'), "app.js wizard cache");
assert(wizard.includes('GI_WIZARD_BUILD = "' + WIZARD_TAG + '"'), "gi-wizard.js build mark");

console.log("\n2) נתיב רענון חי — שבירת מטמון 45ש + ציור מחדש");
assert(app.includes("invalidateTodaySalesLive(){"), "invalidateTodaySalesLive קיים");
assert(app.includes("ensureTodaySalesServerOverlay({ force: true })"), "שליפת overlay בכוח אחרי מכירה");
assert(app.includes("const force = options && options.force === true;"), "ensureTodaySalesServerOverlay מקבל force");
assert(app.includes("if(!force && cachedOk && (cachedHasMoney || App?._fullDataReady))"), "מטמון 45ש לא חוסם force");
assert(app.includes("_scheduleTodaySalesOverlayRetry(){"), "ניסיונות RPC נוספים אחרי מכירה");
assert(app.includes("this._todaySalesServerOverlay.at = 0;"), "מפקיע מטמון overlay בלי לאפס סכום");
assert(wizard.includes("DashboardUI.invalidateTodaySalesLive?.()"), "סיום אשף מרענן כרטיס היום");
assert(app.includes("DashboardUI.invalidateTodaySalesLive?.()"), "persist מרענן כרטיס היום");
assert(app.includes("_resolveTodaySalesOverlayMerge(localResult, serverOverlay, missingPayloads)"), "מיזוג overlay יומי מופרד");
assert(app.includes("_shouldPaintTodayOverlayValue(overlayPrem, localPrem)"), "לא צובעים overlay נמוך מעל מקומי");

console.log("\n3) מיזוג overlay — לא דורסים סכום מקומי גבוה יותר");
const mergeFn = extractObjectMethod(app, "_mergeTodayCompanyBreakdown");
const resolveFn = extractObjectMethod(app, "_resolveTodaySalesOverlayMerge");
const paintFn = extractObjectMethod(app, "_shouldPaintTodayOverlayValue");
assert(!!mergeFn, "חולץ _mergeTodayCompanyBreakdown");
assert(!!resolveFn, "חולץ _resolveTodaySalesOverlayMerge");
assert(!!paintFn, "חולץ _shouldPaintTodayOverlayValue");

const sandbox = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  resolveCompanyLogoKey(raw){ return String(raw == null ? "" : raw).trim() || "ללא חברה"; }
};
vm.runInNewContext(
  "this._mergeTodayCompanyBreakdown = function" + mergeFn.slice("_mergeTodayCompanyBreakdown".length) + ";\n" +
  "this._resolveTodaySalesOverlayMerge = function" + resolveFn.slice("_resolveTodaySalesOverlayMerge".length) + ";\n" +
  "this._shouldPaintTodayOverlayValue = function" + paintFn.slice("_shouldPaintTodayOverlayValue".length) + ";",
  sandbox
);

const overlay = {
  ok: true,
  totalPremium: 5000,
  totalPolicies: 4,
  newClients: 3,
  breakdown: [{ label: "הפניקס", premium: 5000, count: 4 }]
};
const localHigher = {
  totalPremium: 5200,
  totalPolicies: 5,
  newClients: 4,
  breakdown: [
    { label: "הפניקס", premium: 5000, count: 4 },
    { label: "כלל", premium: 200, count: 1 }
  ],
  _loading: false,
  _fromServer: false
};
const localPartial = {
  totalPremium: 200,
  totalPolicies: 1,
  newClients: 1,
  breakdown: [{ label: "כלל", premium: 200, count: 1 }],
  _loading: true,
  _fromServer: false
};
const localEmpty = {
  totalPremium: 0,
  totalPolicies: 0,
  newClients: 0,
  breakdown: [],
  _loading: true,
  _fromServer: false
};

const hydrated = sandbox._resolveTodaySalesOverlayMerge(localEmpty, overlay, 12);
assert(hydrated && hydrated.totalPremium === 5000 && hydrated._fromServer === true, "hydration ריק — נשאר overlay");

const deferredLower = sandbox._resolveTodaySalesOverlayMerge(localPartial, overlay, 12);
assert(deferredLower && deferredLower.totalPremium === 5000 && deferredLower._fromServer === true, "payload חלקי נמוך — overlay (בלי קפיצה ל־₪200)");

const liveSale = sandbox._resolveTodaySalesOverlayMerge(localHigher, overlay, 12);
assert(liveSale && liveSale.totalPremium === 5200 && liveSale._fromServer !== true, "מכירה חדשה מקומית גבוהה יותר — לא נדרסת");
assert(Array.isArray(liveSale.breakdown) && liveSale.breakdown.some((r) => r.label === "כלל"), "פירוט חברות נשמר אחרי מכירה");

const completeLocal = sandbox._resolveTodaySalesOverlayMerge(localHigher, overlay, 0);
assert(completeLocal && completeLocal.totalPremium === 5200, "בלי missing payloads — סכום מקומי");

assert(sandbox._shouldPaintTodayOverlayValue(5000, 5200) === false, "paintServerKpiDom לא מוריד מספר שכבר על המסך");
assert(sandbox._shouldPaintTodayOverlayValue(5200, 5000) === true, "overlay גבוה יותר — מותר לצבוע");
assert(sandbox._shouldPaintTodayOverlayValue(5000, 0) === true, "בלי מקומי — מותר לצבוע overlay");

console.log("\n4) אין שינוי בחישוב פרמיה / כרטיסים אחרים / פירוט");
const policyNet = extractObjectMethod(app, "policyNetPremium");
assert(!!policyNet && policyNet.includes("premiumValue"), "policyNetPremium לא הוסר");
assert(!policyNet.includes("invalidateTodaySalesLive"), "policyNetPremium לא נגע בנתיב הרענון");
assert(app.includes("formatNetProductBreakdownHtml(metrics.netProductTotals)"), "פירוט נטו חודשי נשאר לפי סוג מוצר");
assert(app.includes("formatNetProductBreakdownHtml(m.netProductTotals)"), "paintServerKpiDom עדיין צובע פירוט נטו חודשי");
const todayStart = app.indexOf("const todayCardHtml = (() => {");
const todayRender = todayStart >= 0 ? app.slice(todayStart, todayStart + 2200) : "";
assert(todayRender.includes("bankKpiTodayRow__label"), "פירוט כרטיס היום נשאר לפי חברה");
assert(todayRender.includes("row.label"), "פירוט כרטיס היום לפי תווית חברה");
assert(!todayRender.includes("לקוח") || todayRender.includes("לקוחות"), "אין פירוט שורת לקוח בכרטיס היום");
assert(app.includes('querySelectorAll(\'.bankDash__kpis .bankKpi:not(.bankKpi--today)\')'), "כרטיסי KPI אחרים נצבעים בנפרד מכרטיס היום");
assert(app.includes("collectNewPoliciesForMetrics(rec, {"), "collectNewPoliciesForMetrics עדיין מקור כרטיס היום");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
