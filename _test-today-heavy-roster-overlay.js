/* GI-TODAY-HEAVY 2026-10-05 — «נמכר היום» למנהל בסשן כבד.
   סשן כבד (מאגר גדול / מנהל צוות רזה) מדלג על loadTodaySalesAfterDiscount
   ונופל ל-loadServerKpis (RPC gi_dashboard_net_premium). ה-RPC הזה אחרי הנחה
   מאז 2026-09-17, ולכן ה-overlay חייב סימון afterDiscount=true; אחרת ה-merge
   לא מחליף את הסכום המקומי החלקי מ-500 התיקים בסכום המלא של השרת,
   והכרטיס מציג חסר.
   הרצה: node _test-today-heavy-roster-overlay.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20261005-ops-forms-warm-v1";
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
  let i = start + needle.length;
  let depthParen = 1;
  while(i < src.length && depthParen > 0){
    const ch = src[i];
    if(ch === "(") depthParen += 1;
    else if(ch === ")") depthParen -= 1;
    i += 1;
  }
  const brace = src.indexOf("{", i);
  if(brace < 0) return "";
  let depth = 0;
  for(let j = brace; j < src.length; j += 1){
    const ch = src[j];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, j + 1).trim();
    }
  }
  return "";
}

const app = read("app.js");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-today-heavy-roster-overlay.js")]).status === 0, "node --check this test");

console.log("\n2) סשן כבד — ה-RPC הממוקד מדלג, הנפילה מסומנת אחרי הנחה");
assert(app.includes("if(!Storage.isHeavyRosterSession?.() && typeof Storage.loadTodaySalesAfterDiscount === \"function\")"), "סשן כבד מדלג על loadTodaySalesAfterDiscount");
assert(app.includes("fromAfter = (res?.afterDiscount === true)"), "נפילה ל-loadServerKpis מסמנת afterDiscount לפי תשובת השרת");
assert(app.includes("afterDiscount: fromAfter === true"), "ה-overlay עדיין נבנה מ-fromAfter");

console.log("\n3) התנהגות — merge לסשן כבד: השרת המלא מחליף את המקומי החלקי");
const mergeFn = extractObjectMethod(app, "_resolveTodaySalesOverlayMerge");
const box = {
  safeTrim(v){ return String(v == null ? "" : v).trim(); },
  _mergeTodayCompanyBreakdown(localRows, serverRows){
    const map = Object.create(null);
    const add = (row) => {
      if(!row) return;
      const key = String(row.label || "ללא חברה");
      if(!map[key]) map[key] = { label: key, count: 0, premium: 0 };
      const premium = Number(row.premium) || 0;
      if(premium > map[key].premium){
        map[key].premium = premium;
        map[key].count = Number(row.count) || map[key].count;
      }
    };
    (localRows || []).forEach(add);
    (serverRows || []).forEach(add);
    return Object.values(map).sort((a, b) => b.premium - a.premium);
  }
};
vm.runInNewContext(
  "this._resolveTodaySalesOverlayMerge = function" + mergeFn.slice("_resolveTodaySalesOverlayMerge".length) + ";",
  box
);

/* סשן כבד: המקומי ראה רק חלק מהמכירות של היום (working set), השרת ראה הכול.
   ה-overlay מסומן afterDiscount (כי loadServerKpis מחזיר afterDiscount:true),
   ויש missingPayloads (תיקים מרוכזים). ה-merge חייב לבחור בשרת. */
const partialLocal = { totalPremium: 1200, totalPolicies: 4, newClients: 3, breakdown: [{ label: "מגדל", count: 2, premium: 800 }], byAgent: [], _fromServer: false };
const fullServer = { ok: true, afterDiscount: true, totalPremium: 4279.45, totalPolicies: 29, newClients: 15, breakdown: [{ label: "מגדל", count: 10, premium: 3000 }, { label: "כלל", count: 19, premium: 1279.45 }], byAgent: [] };
const merged = box._resolveTodaySalesOverlayMerge(partialLocal, fullServer, 420);
assert(Number(merged.totalPremium) === 4279.45, "סשן כבד: השרת המלא מחליף את המקומי החלקי");
assert(Number(merged.totalPolicies) === 29, "מספר פוליסות מהשרת");
assert(Number(merged.newClients) === 15, "מספר לקוחות מהשרת");
assert(merged._fromServer === true, "התוצאה מסומנת מהשרת");

/* שומרים על הכלל הישן: overlay ברוטו (בלי afterDiscount) לא דורס מקומי אחרי-הנחה. */
const grossOverlay = { ok: true, totalPremium: 4927.31, totalPolicies: 26, newClients: 12, breakdown: [] };
const kept = box._resolveTodaySalesOverlayMerge(partialLocal, grossOverlay, 420);
assert(Number(kept.totalPremium) === 1200, "overlay ברוטו עדיין לא דורס מקומי");

/* מקומי ריק — גם overlay ברוטו ממלא. */
const filled = box._resolveTodaySalesOverlayMerge({ totalPremium: 0, totalPolicies: 0, breakdown: [] }, grossOverlay, 420);
assert(Number(filled.totalPremium) === 4927.31, "מקומי ריק — overlay ממלא גם בלי afterDiscount");

console.log("\n4) מסך מכירות — פירוט נציגים אחרי הנחה בלי לגעת בדשבורד");
const overlayFn = extractObjectMethod(app, "ensureTodaySalesServerOverlay");
assert(!!overlayFn, "חולץ ensureTodaySalesServerOverlay");
assert(overlayFn.includes("if(!Storage.isHeavyRosterSession?.() && typeof Storage.loadTodaySalesAfterDiscount === \"function\")"), "דשבורד כבד עדיין מדלג על השליפה הממוקדת");
assert(overlayFn.includes("_isDailySalesView"), "מסך מכירות מזוהה בנפרד מהדשבורד");
assert((overlayFn.match(/loadTodaySalesAfterDiscount/g) || []).length >= 2, "במסך מכירות עדיין רצים לשליפה הממוקדת בשביל byAgent");
assert(overlayFn.includes("needTableAgents") && overlayFn.includes("needCompanyRows"), "מטמון כסף בלי נציגים או בלי פירוט חברות לא חוסם רענון");
assert(overlayFn.includes("prevAgents !== nextAgents"), "שינוי במספר הנציגים מרענן את הטבלה");
assert(overlayFn.includes("netPremium: Number(res.netPremium) || 0"), "סכום הכרטיס לא מוחלף כשמצרפים byAgent");
assert(app.includes("const skipServerOnly = localHealthPremium > 0"), "לא ממלאים RPC ברוטו כשיש מכירות מקומיות");
assert(!extractObjectMethod(app, "policyNetPremium").includes("getPolicyPremiumAfterDiscount"), "policyNetPremium לא השתנה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
