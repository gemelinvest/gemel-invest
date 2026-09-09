/* GI-VERSION-RESUME 2026-09-09 — עדכון גרסה שומר סשן בלי כניסה/2FA.
   גם כשהלחיצה על «עדכן» רצה בקוד ישן (בלי marker) — ?nocache= + last session user.
   הרצה: node _test-version-update-resume.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260909-version-resume-v1";
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

function sliceBetween(src, startToken, endToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  const end = src.indexOf(endToken, start + startToken.length);
  if(end < 0) return src.slice(start);
  return src.slice(start, end);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes('const BUILD = "' + APP_TAG + '"'), "app.js BUILD tag");

console.log("\n2) לחיצה על עדכן + זיהוי גם מקוד ישן");
assert(app.includes('const GI_VERSION_UPDATE_RESUME_KEY = "GI_VERSION_UPDATE_RESUME_V1"'), "מפתח resume");
assert(app.includes("function saveVersionUpdateResume(cur)"), "saveVersionUpdateResume");
assert(app.includes("function peekVersionUpdateResume()"), "peekVersionUpdateResume");
assert(app.includes("function hasVersionUpdateNocacheQuery()"), "זיהוי ?nocache= בלי marker");
assert(app.includes("function snapFromLastSessionUserKey()"), "שחזור מ-GI_LAST_SESSION_USER_V1");
assert(app.includes("function readStoredVersionUpdateResumeSnap()"), "קורא sessionStorage וגם localStorage");
assert(!app.includes("function consumeVersionUpdateResume()"), "לא מוחקים את הסמן לפני שה-resume הצליח");
const applyClick = sliceBetween(app, "applyBtn.addEventListener('click'", "const dismissBtn");
assert(applyClick.includes("saveVersionUpdateResume(Auth?.current)"), "קוד חדש עדיין שומר סמן לפני nocache");
assert(applyClick.includes("persistLastSessionUserKey"), "קוד חדש שומר last-session לפני הרענון");
assert(applyClick.includes("window.location.replace"), "רענון גרסה נשאר עם ?nocache=");
assert(applyClick.includes("?nocache="), "URL אחרי עדכן כולל nocache");

console.log("\n3) טעינה מחדש מדלגת על כניסה/2FA רק בעדכון");
assert(app.includes("async function resumeSessionAfterVersionUpdate()"), "resumeSessionAfterVersionUpdate");
assert(app.includes("readStoredVersionUpdateResumeSnap() || snapFromLastSessionUserKey()"), "resume עובד מ-marker או מ-nocache+last user");
assert(app.includes("skipMfa: true"), "דילוג על MFA ב-resume");
assert(app.includes("quietResume: true"), "resume שקט בלי לוג כניסה ובלי מסך ברוכים");
assert(app.includes("if(peekVersionUpdateResume()) void resumeSessionAfterVersionUpdate()"), "Auth.init מפעיל resume רק עם peek");
assert(app.includes("if(peekVersionUpdateResume()) return;"), "pagehide לא מנתק בעדכון גרסה");
assert(app.includes('this.els.wrap?.setAttribute?.("aria-hidden", resumingVersionUpdate ? "true" : "false")'), "מסך כניסה מוסתר ב-resume");
assert(app.includes("if(!resumingVersionUpdate) this.lock()"), "lock רגיל בלי סמן/nocache");
assert(app.includes("clearVersionUpdateResume()"), "מוחקים סמן רק אחרי הצלחה/כישלון סופי");
assert(app.includes("stripVersionUpdateNocacheQuery()"), "מסירים ?nocache= אחרי resume כדי ש-F5 ידרוש כניסה");
assert(app.includes("if(peekVersionUpdateResume()) return;"), "SW controllerchange לא עושה reload שמוחק את ה-resume");
assert(app.includes("localStorage.removeItem(GI_VERSION_UPDATE_RESUME_KEY)"), "logout מוחק סמן גם מ-localStorage");

console.log("\n4) כניסה רגילה לא השתנתה");
assert(app.includes("Auth._submit = async function()"), "מסלול שם משתמש/PIN נשאר");
assert(app.includes("_verifyPendingMfa"), "מסלול MFA נשאר");
assert(app.includes("skipMfa: true,\n          quietResume: true"), "quietResume רק ב-resume של עדכון");

console.log("\n5) runtime: nocache+last-user כן, F5 בלי nocache לא");
const helpers = sliceBetween(app, "function hasVersionUpdateNocacheQuery(){", "function persistLastSessionUserKey(key){");
function runPeek(search, lastKey, marker){
  const safeTrim = (v) => String(v == null ? "" : v).trim();
  const GI_VERSION_UPDATE_RESUME_KEY = "GI_VERSION_UPDATE_RESUME_V1";
  const GI_VERSION_UPDATE_RESUME_TTL_MS = 180000;
  const sessionStorage = { getItem: () => marker };
  const localStorage = { getItem: (k) => k === GI_VERSION_UPDATE_RESUME_KEY ? null : lastKey };
  const window = { location: { search: search, href: "https://x/" + search } };
  const DateNow = Date.now;
  const fn = new Function(
    "safeTrim", "GI_VERSION_UPDATE_RESUME_KEY", "GI_VERSION_UPDATE_RESUME_TTL_MS",
    "sessionStorage", "localStorage", "window", "Date",
    helpers + "\nfunction readLastSessionUserKey(){ return safeTrim(localStorage.getItem('GI_LAST_SESSION_USER_V1')); }\nreturn peekVersionUpdateResume();"
  );
  return fn(safeTrim, GI_VERSION_UPDATE_RESUME_KEY, GI_VERSION_UPDATE_RESUME_TTL_MS, sessionStorage, localStorage, window, { now: DateNow });
}
assert(runPeek("?nocache=" + Date.now(), "full:agent:a_1", null) === true, "nocache + last user → resume בלי marker (קוד ישן)");
assert(runPeek("", "full:agent:a_1", null) === false, "F5 בלי nocache → אין resume");
assert(runPeek("?nocache=" + Date.now(), "", null) === false, "nocache בלי last user → אין resume");
assert(runPeek("", "", '{"name":"x","ts":' + Date.now() + "}") === true, "marker ב-sessionStorage עדיין עובד");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
