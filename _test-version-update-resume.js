/* GI-VERSION-RESUME 2026-09-09 — עדכון גרסה שומר סשן בלי כניסה/2FA.
   כפתור «עדכן» חי ב-IIFE נפרד — חייב גשר ל-window, אחרת הסמן לא נשמר.
   הרצה: node _test-version-update-resume.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");

const ROOT = __dirname;
const APP_TAG = "20260909-wizard-open-v1";
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
const mainIifeEnd = app.indexOf("\n})();\n\n\n// ===== CHAT TOAST FIX =====");
const applyClick = sliceBetween(app, "applyBtn.addEventListener('click'", "const dismissBtn");
const swHandler = sliceBetween(app, "navigator.serviceWorker.addEventListener(\"controllerchange\"", "function bindInstallUi()");
const prepareBridge = sliceBetween(app, "window.__GI_PREPARE_VERSION_UPDATE_RESUME = function(){", "window.__GI_HAS_AUTH_CURRENT");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes('const BUILD = "' + APP_TAG + '"'), "app.js BUILD tag");

console.log("\n2) לחיצה על עדכן שומרת סמן דרך גשר, לא דרך שמות מקומיים");
assert(app.includes('const GI_VERSION_UPDATE_RESUME_KEY = "GI_VERSION_UPDATE_RESUME_V1"'), "מפתח resume");
assert(app.includes("function saveVersionUpdateResume(cur)"), "saveVersionUpdateResume");
assert(app.includes("function peekVersionUpdateResume()"), "peekVersionUpdateResume");
assert(app.includes("function hasVersionUpdateNocacheQuery()"), "זיהוי ?nocache= בלי marker");
assert(app.includes("function snapFromLastSessionUserKey()"), "שחזור מ-GI_LAST_SESSION_USER_V1");
assert(app.includes("function readStoredVersionUpdateResumeSnap()"), "קורא sessionStorage וגם localStorage");
assert(!app.includes("function consumeVersionUpdateResume()"), "לא מוחקים את הסמן לפני שה-resume הצליח");
assert(app.includes("window.__GI_PREPARE_VERSION_UPDATE_RESUME = function(){"), "גשר window לשמירת resume");
assert(app.includes("window.peekVersionUpdateResume = peekVersionUpdateResume;"), "peek חשוף ל-SW IIFE");
assert(app.includes("window.__GI_HAS_AUTH_CURRENT = function(){"), "בדיקת סשן ל-SW בלי ReferenceError");
assert(mainIifeEnd > 0 && app.indexOf("window.__GI_PREPARE_VERSION_UPDATE_RESUME") < mainIifeEnd, "הגשר מוגדר ב-IIFE הראשי");
assert(app.indexOf("applyBtn.addEventListener('click'") > mainIifeEnd, "לחיצת עדכן עדיין ב-IIFE נפרד");
assert(applyClick.includes("window.__GI_PREPARE_VERSION_UPDATE_RESUME"), "לחיצה קוראת לגשר לפני nocache");
assert(!applyClick.includes("saveVersionUpdateResume(Auth?.current)"), "לחיצה לא קוראת ל-save מתוך IIFE זר");
assert(!applyClick.includes("persistLastSessionUserKey(typeof Storage"), "לחיצה לא משתמשת ב-Storage הגלובלי של הדפדפן");
assert(prepareBridge.includes("persistLastSessionUserKey(Storage.fullCacheUserKey())"), "הגשר כותב last-session מתוך Storage של האפליקציה");
assert(prepareBridge.includes("saveVersionUpdateResume(Auth && Auth.current)"), "הגשר שומר סמן מ-Auth.current של ה-IIFE הראשי");
assert(applyClick.includes("window.location.replace"), "רענון גרסה נשאר עם ?nocache=");
assert(applyClick.includes("?nocache="), "URL אחרי עדכן כולל nocache");
assert(!applyClick.includes("window.location.reload()"), "כישלון עדכן לא עושה reload בלי nocache");
assert((applyClick.match(/\?nocache=/g) || []).length >= 2, "גם מסלול ה-catch מרענן עם nocache");

console.log("\n3) טעינה מחדש מדלגת על כניסה/2FA רק בעדכון");
assert(app.includes("async function resumeSessionAfterVersionUpdate()"), "resumeSessionAfterVersionUpdate");
assert(app.includes("readStoredVersionUpdateResumeSnap() || snapFromLastSessionUserKey()"), "resume עובד מ-marker או מ-nocache+last user");
assert(app.includes("skipMfa: true"), "דילוג על MFA ב-resume");
assert(app.includes("quietResume: true"), "resume שקט בלי לוג כניסה ובלי מסך ברוכים");
assert(app.includes("if(peekVersionUpdateResume()) void resumeSessionAfterVersionUpdate()"), "Auth.init מפעיל resume רק עם peek");
assert(app.includes("if(peekVersionUpdateResume()) return;"), "pagehide לא מנתק בעדכון גרסה");
assert(app.includes('if(resumingVersionUpdate){'), "ב-resume לא שמים lcAuthLock");
assert(app.includes("document.body.classList.remove(\"lcAuthLock\")"), "מסירים lcAuthLock ב-resume כדי שה-CSS לא יציג כניסה");
assert(app.includes("if(!resumingVersionUpdate) this.lock()"), "lock רגיל בלי סמן/nocache");
assert(app.includes("clearVersionUpdateResume()"), "מוחקים סמן רק אחרי הצלחה/כישלון סופי");
assert(app.includes("stripVersionUpdateNocacheQuery()"), "מסירים ?nocache= אחרי resume כדי ש-F5 ידרוש כניסה");
assert(swHandler.includes("window.peekVersionUpdateResume"), "SW קורא peek מה-window ולא משם מקומי");
assert(swHandler.includes("window.__GI_HAS_AUTH_CURRENT"), "SW בודק סשן דרך הגשר");
assert(!swHandler.includes("if(Auth?.current) return;"), "SW לא ניגש ל-Auth הלא-מוגדר");
assert(app.includes("let hadController = !!navigator.serviceWorker.controller;"), "SW לא מרענן ב-claim ראשון אחרי unregister של עדכן");
assert(app.includes("LOGIN_SUBMIT_FAILED:"), "שגיאת כניסה נתפסת ב-_submit ולא נשארת unhandled");
assert(app.includes("VERSION_UPDATE_RESUME_FAILED:"), "כישלון resume נכתב לקונסול");
assert(app.includes("localStorage.removeItem(GI_VERSION_UPDATE_RESUME_KEY)"), "logout מוחק סמן גם מ-localStorage");

console.log("\n4) כניסה רגילה לא השתנתה");
assert(app.includes("Auth._submit = async function()"), "מסלול שם משתמש/PIN נשאר");
assert(app.includes("_verifyPendingMfa"), "מסלול MFA נשאר");
assert(app.includes("skipMfa: true,\n          quietResume: true"), "quietResume רק ב-resume של עדכון");
assert(app.includes("if(!username) return this._setError('נא להזין שם משתמש')"), "ולידציית שם משתמש בכניסה נשארה");
assert(app.includes("if(!pin) return this._setError('נא להזין קוד כניסה')"), "ולידציית PIN בכניסה נשארה");

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

console.log("\n6) runtime: IIFE זר לא שומר סמן, הגשר כן");
function simulateApplyClick(useBridge){
  const sandbox = {
    Storage: function NativeStorage(){},
    window: {},
    persistLastSessionUserKey: undefined,
    saveVersionUpdateResume: undefined,
    Auth: undefined
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    (function(){
      const Auth = { current: { name: "נציג בדיקה", role: "agent", id: "a_1" } };
      const Storage = { fullCacheUserKey(){ return "full:agent:a_1"; } };
      function persistLastSessionUserKey(key){ globalThis.__last = String(key || ""); }
      function saveVersionUpdateResume(cur){
        if(!cur || !cur.name) return false;
        globalThis.__marker = { name: cur.name, id: cur.id, role: cur.role };
        return true;
      }
      if(${useBridge ? "true" : "false"}){
        window.__GI_PREPARE_VERSION_UPDATE_RESUME = function(){
          persistLastSessionUserKey(Storage.fullCacheUserKey());
          return saveVersionUpdateResume(Auth && Auth.current);
        };
      }
    })();
    (function(){
      try { persistLastSessionUserKey(typeof Storage !== "undefined" ? Storage.fullCacheUserKey() : ""); } catch(_e) {}
      try { saveVersionUpdateResume(Auth?.current); } catch(_e) {}
      try {
        if(typeof window.__GI_PREPARE_VERSION_UPDATE_RESUME === "function"){
          window.__GI_PREPARE_VERSION_UPDATE_RESUME();
        }
      } catch(_e) {}
    })();
  `, sandbox);
  return { last: sandbox.__last || "", marker: sandbox.__marker || null };
}
const withoutBridge = simulateApplyClick(false);
assert(!withoutBridge.marker, "בלי גשר: IIFE של עדכן לא מצליח לשמור סמן");
assert(withoutBridge.last === "", "בלי גשר: Storage הגלובלי לא כותב last-session");
const withBridge = simulateApplyClick(true);
assert(withBridge.marker && withBridge.marker.id === "a_1", "עם גשר: הסמן נשמר עם המשתמש המחובר");
assert(withBridge.last === "full:agent:a_1", "עם גשר: last-session נכתב במפתח full:");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
