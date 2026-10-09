/* GI-LOGOUT-FAST — לחיצה על התנתק נועלת את המסך לפני הניקוי הכבד.
   הרצה: node _test-logout-fast.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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

function sliceFunction(src, startToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  let i = startToken.endsWith("{")
    ? start + startToken.length - 1
    : src.indexOf("{", start);
  if(i < 0) return "";
  let depth = 0;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "service-worker.js")]).status === 0, "node --check service-worker.js");
assert(html.includes("giLogout=1"), "index.html bumps app.js cache");
assert(sw.includes("logout-fast-v1"), "service worker cache bumped");

console.log("\n2) login screen locks before the heavy cleanup");
const logoutFn = sliceFunction(app, 'logout(reason = "manual"){');
assert(!!logoutFn, "Auth.logout exists");
const lockAt = logoutFn.indexOf("this.lock()");
const finishAt = logoutFn.indexOf("const finish = () => {");
const timeoutAt = logoutFn.indexOf("setTimeout(finish, 0)");
assert(lockAt >= 0 && finishAt > lockAt && timeoutAt > finishAt, "lock runs before the deferred finish");
assert(logoutFn.indexOf("InactivityGuard.stop()") > lockAt && logoutFn.indexOf("InactivityGuard.stop()") < finishAt, "idle guard stops before the yield");
assert(logoutFn.includes('UI.goView("dashboard", { skipDashboardRender: true })'), "logout skips dashboard render");
assert(logoutFn.indexOf("skipDashboardRender: true") > finishAt && logoutFn.indexOf("skipDashboardRender: true") < timeoutAt, "dashboard skip is inside the deferred finish");
assert(logoutFn.includes("Wizard.closeForSessionEnd"), "logout still closes the wizard");
assert(logoutFn.indexOf("Wizard.closeForSessionEnd") > finishAt && logoutFn.indexOf("Wizard.closeForSessionEnd") < timeoutAt, "wizard close is deferred");
assert(logoutFn.includes('resetSessionDataForUserSwitch(reason === "browser" ? "browser_close" : "logout")'), "logout still resets session data");
assert(html.includes('id="btnLogout"'), "logout button stays");
assert(app.includes('on(this.els.btnLogout, "click", () => Auth.logout())'), "logout binding unchanged");

console.log("\n3) logout reset does not normalize the roster");
const resetFn = sliceFunction(app, 'resetSessionDataForUserSwitch(reason = ""){');
assert(!!resetFn, "resetSessionDataForUserSwitch exists");
const lightAt = resetFn.indexOf('reason === "logout" || reason === "browser_close"');
const elseAt = resetFn.indexOf("} else {", lightAt);
assert(lightAt > 0 && elseAt > lightAt, "light branch exists");
const lightBody = resetFn.slice(lightAt, elseAt);
assert(!lightBody.includes("normalizeState"), "logout reset skips normalizeState");
assert(lightBody.includes("customersShadow = []"), "logout clears customer shadow");
assert(lightBody.includes("proposalsShadow = []"), "logout clears proposal shadow");
assert(lightBody.includes("lightShadows: true"), "logout refresh stays light");
assert(resetFn.slice(elseAt).includes("normalizeState"), "user switch still normalizes");

console.log("\n4) logout auth sign-out is local");
const wrapStart = app.indexOf("Auth.logout = (function(orig){");
const wrapEnd = app.indexOf("})(Auth.logout);", wrapStart);
const wrap = wrapStart >= 0 && wrapEnd > wrapStart ? app.slice(wrapStart, wrapEnd) : "";
assert(!!wrap, "logout auth wrapper exists");
assert(wrap.includes('signOut({ scope: "local" })'), "logout uses local signOut");
assert(!wrap.includes("signOutSilently"), "logout does not wait on global signOut");
assert(app.includes("async signOutSilently()"), "login path still has silent signOut");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
