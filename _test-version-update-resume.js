/* GI-VERSION-RESUME 2026-09-09 — עדכון גרסה שומר סשן בלי כניסה/2FA.
   הרצה: node _test-version-update-resume.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260909-session-keep-v2";
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

console.log("\n2) סמן סשן לפני רענון עדכון — גם מקוד ישן עם ?nocache=");
assert(app.includes('const GI_VERSION_UPDATE_RESUME_KEY = "GI_VERSION_UPDATE_RESUME_V1"'), "מפתח resume");
assert(app.includes("function saveVersionUpdateResume(cur)"), "saveVersionUpdateResume");
assert(app.includes("function hasVersionUpdateNocacheQuery()"), "זיהוי ?nocache= מעדכון");
assert(app.includes("function snapFromLastSessionUserKey()"), "שחזור ממשתמש אחרון אחרי עדכון ישן");
assert(app.includes("function peekVersionUpdateResume()"), "peekVersionUpdateResume");
assert(app.includes("function clearVersionUpdateResume()"), "clearVersionUpdateResume אחרי הצלחה");
assert(app.includes("localStorage.setItem(GI_VERSION_UPDATE_RESUME_KEY, payload)"), "גיבוי resume ב-localStorage");
assert(app.includes("try { saveVersionUpdateResume(Auth?.current); } catch(_e) {}"), "לחיצה על עדכן שומרת סשן");
assert(app.includes("persistLastSessionUserKey(typeof Storage !== \"undefined\" ? Storage.fullCacheUserKey() : \"\")"), "לחיצה על עדכן שומרת מזהה משתמש");
const applyClick = sliceBetween(app, 'applyBtn.addEventListener(\'click\'', "const dismissBtn");
assert(applyClick.includes("saveVersionUpdateResume(Auth?.current)"), "שמירה לפני ניווט nocache");
assert(applyClick.includes("window.location.replace"), "רענון גרסה נשאר");

console.log("\n3) טעינה מחדש מדלגת על כניסה/2FA");
assert(app.includes("async function resumeSessionAfterVersionUpdate()"), "resumeSessionAfterVersionUpdate");
assert(app.includes("readStoredVersionUpdateResumeSnap() || snapFromLastSessionUserKey()"), "resume קורא סמן או משתמש אחרון");
assert(!app.includes("function consumeVersionUpdateResume()"), "לא מוחקים סמן לפני שהשחזור הצליח");
assert(app.includes("skipMfa: true"), "דילוג על MFA ב-resume");
assert(app.includes("quietResume: true"), "resume שקט בלי לוג כניסה ובלי מסך ברוכים");
assert(app.includes("if(peekVersionUpdateResume()) void resumeSessionAfterVersionUpdate()"), "Auth.init מפעיל resume");
assert(app.includes("if(peekVersionUpdateResume()) return;"), "pagehide לא מנתק בעדכון גרסה");
assert(app.includes("if(peekVersionUpdateResume()) return;\n          window.__GI_SW_RELOADED"), "SW לא מרענן שוב באמצע resume");
assert(app.includes('this.els.wrap?.setAttribute?.("aria-hidden", resumingVersionUpdate ? "true" : "false")'), "מסך כניסה מוסתר ב-resume");
assert(app.includes("if(!resumingVersionUpdate) this.lock()"), "lock רגיל בלי סמן");
assert(app.includes("localStorage.removeItem(GI_VERSION_UPDATE_RESUME_KEY)"), "logout מוחק סמן resume");

console.log("\n4) כניסה רגילה לא השתנתה");
assert(app.includes("Auth._submit = async function()"), "מסלול שם משתמש/PIN נשאר");
assert(app.includes("_verifyPendingMfa"), "מסלול MFA נשאר");
assert(app.includes("skipMfa: true,\n          quietResume: true"), "quietResume רק ב-resume של עדכון");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
