/* GI-PERF 2026-08-25 — רגרסיה: מצב light session למנהל צוות (ואדים).
   הרצה: node _test-team-manager-light-session.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
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

const app = read("app.js");
const indexHtml = read("index.html");
const sw = read("service-worker.js");

console.log("\nמצב Team Manager Light Session");
assert(app.includes("TEAM_MANAGER_LIGHT_SESSION_ENABLED"), "דגל הפעלה קיים");
assert(app.includes("TEAM_MANAGER_PAYLOAD_LRU_CAP"), "תקרת LRU קיימת");
assert(app.includes("isTeamManagerLightSession()"), "מתודה isTeamManagerLightSession");
assert(app.includes("isHeavyRosterSession()"), "מתודה isHeavyRosterSession");
assert(app.includes("trimTeamManagerCustomerPayloadLru"), "LRU trim קיים");
assert(app.includes("TEAM_MANAGER_PAYLOAD_LRU_TRIM"), "לוג trim קיים");

console.log("\nהגנות שחוברו");
assert(app.includes("this.isHeavyRosterSession()") || app.includes("Storage.isHeavyRosterSession"), "heavy roster בשימוש");
assert(app.includes("isTeamManagerLightSession() ? CUSTOMER_LIGHT_COLUMNS"), "delta לקוחות בעמודות רזות");
assert(app.includes("isTeamManagerLightSession() ? PROPOSAL_LIGHT_COLUMNS"), "delta הצעות בעמודות רזות");
assert(app.includes("מיזוג קונפליקט לפי מזהים") || app.includes("fetchByIds"), "conflict-merge לפי מזהים dirty בלבד");
assert(app.includes("CUSTOMER_LIGHT_COLUMNS + \",payload\"") || app.includes('CUSTOMER_LIGHT_COLUMNS + ",payload"'), "conflict-merge לקוחות עם payload נקודתי");
assert(app.includes("largeSession || teamMgrLight"), "LiveRefresh מתייחס למנהל צוות light");
assert(app.includes("Auth?.isTeamManager?.() && Storage?.isTeamManagerLightSession?.()"), "פטור force dashboard pull");
assert(app.includes("payloadHasPolicyOrInsuredContent?.(rec?.payload)"), "MyTeam מדלג על payloads ריקים");
assert(/startProposals\(\)\{[\s\S]*?isHeavyRosterSession/.test(app), "proposals realtime נחסם ב-heavy roster");
assert(app.includes("TEAM_MANAGER_LOGIN_SKIP_FAT_CACHE"), "דילוג IDB שמן בכניסה");
assert(app.includes("purgeCurrentUserFullIdbCache"), "מחיקת IDB שמן למשתמש נוכחי");
assert(app.includes("shouldSkipTeamManagerFatIdbLoad"), "בדיקת מטמון מפוצל לפני טעינת מנות");
assert(app.includes("_teamManagerLightLoginHint"), "hint light מיד בלוגין");
assert(app.includes("if(paintedFromFullCache) adoptIdbEntry"), "לא מאמצים IDB כשצביעה נדחתה");
assert(app.includes("TEAM_MANAGER_LIGHT_WORKING_SET"), "working-set למנהל צוות");
assert(app.includes("TEAM_MANAGER_WORKING_SET:"), "לוג working-set");
assert(app.includes("useTeamManagerWorkingSet"), "טעינת working-set ב-loadSheets");
assert(app.includes("isTeamManagerLightSession()) return this.loadSheets"), "delta חוזר ל-working-set");
assert(app.includes("isTeamManagerLightSession?.()) return true"), "KPI מדולג לשרת במצב light");

console.log("\nתיקון 23.08 נשמר");
assert(app.includes("TEAM_MANAGER_SKIP_MASS_HYDRATION"), "דילוג hydrate מסיבי נשאר");
assert(app.includes("TEAM_MANAGER_FAT_CACHE_PAINT_CAP"), "CAP צביעת מטמון נשאר");
assert(app.includes("TEAM_MANAGER_SKIP_FAT_CACHE_PAINT") || app.includes("paintCustomers >= TEAM_MANAGER_FAT_CACHE_PAINT_CAP"), "דילוג צביעת מטמון שמן נשאר");

console.log("\nלא שוברים Large Session / נציג");
assert(app.includes("LARGE_SESSION_MODE_ENABLED"), "Large Session נשאר");
assert(app.includes("LARGE_SESSION_CUSTOMER_THRESHOLD = 5000"), "סף 5000 לא הורד גלובלית");
assert(app.includes("LIGHT_INITIAL_LOAD_ENABLED = true"), "טעינה רזה נשארת");
assert(!/LARGE_SESSION_CUSTOMER_THRESHOLD\s*=\s*2000/.test(app), "לא הורדנו סף ל-2000");

console.log("\ncache");
assert(indexHtml.includes("app.js?v=20260826-daily-sales-branch-v1"), "cache bust app.js");
assert(sw.includes("20260826-daily-sales-branch-v1"), "service-worker version");

console.log("\nלוגיקה טהורה — LRU");
function trimLru(list, cap, protectedIds){
  const fat = [];
  list.forEach((rec, idx) => {
    if(protectedIds.has(String(rec.id))) return;
    if(rec.payload && Object.keys(rec.payload).length){
      fat.push({ idx, stamp: Date.parse(rec.updatedAt || "") || 0 });
    }
  });
  if(fat.length <= cap) return { list, stripped: 0 };
  fat.sort((a, b) => b.stamp - a.stamp);
  const keep = new Set(fat.slice(0, cap).map((x) => x.idx));
  let stripped = 0;
  const next = list.map((rec, idx) => {
    if(protectedIds.has(String(rec.id)) || keep.has(idx)) return rec;
    if(!rec.payload || !Object.keys(rec.payload).length) return rec;
    stripped += 1;
    return { ...rec, payload: {} };
  });
  return { list: next, stripped };
}

const sample = [];
for(let i = 0; i < 120; i += 1){
  sample.push({ id: "c" + i, updatedAt: new Date(Date.UTC(2026, 7, 1, 0, i)).toISOString(), payload: { newPolicies: [{ id: "p" }] } });
}
sample[5].id = "open";
const out = trimLru(sample, 80, new Set(["open"]));
assert(out.stripped === 39, "LRU מסיר עודפים מעל 80 (+protected)");
assert(out.list.find((r) => r.id === "open").payload.newPolicies, "תיק פתוח נשמר");
assert(out.list.filter((r) => r.payload && r.payload.newPolicies).length === 81, "נשארו 80 + פתוח");

console.log("\nלוגיקה טהורה — שימור payload ב-conflict merge");
function pickNewer(localRec, serverRec, keepLocal){
  if(keepLocal) return localRec;
  if(!localRec) return serverRec;
  if(!serverRec) return localRec;
  const localAt = Date.parse(localRec.updatedAt || "") || 0;
  const serverAt = Date.parse(serverRec.updatedAt || "") || 0;
  const newer = serverAt >= localAt ? serverRec : localRec;
  const older = newer === serverRec ? localRec : serverRec;
  const has = (p) => !!(p && Array.isArray(p.newPolicies) && p.newPolicies.length);
  if(has(older.payload) && !has(newer.payload)) return { ...newer, payload: older.payload };
  return newer;
}
const localFat = { id: "x", updatedAt: "2026-08-01T10:00:00.000Z", payload: { newPolicies: [{ id: "p1" }] } };
const serverLight = { id: "x", updatedAt: "2026-08-02T10:00:00.000Z", fullName: "חדש", payload: {} };
const merged = pickNewer(localFat, serverLight, false);
assert(merged.fullName === "חדש", "מטא-דאטה מהשרת נשמר");
assert(merged.payload.newPolicies[0].id === "p1", "payload מקומי מלא לא נמחק ע״י LIGHT");

console.log("\n-----");
console.log("passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
