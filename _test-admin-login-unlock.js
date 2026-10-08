/* GI-FIX 2026-10-08 — שחרור נעילת כניסה מניהול משתמשים.
   לא משנה את gi_verify_agent_login: רק מוחק שורות gi_login_attempts של הנציג.
   Run: node _test-admin-login-unlock.js
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const fn = fs.readFileSync(path.join(ROOT, "supabase/functions/gi-provision-agent-auth/index.ts"), "utf8");
const lockSql = fs.readFileSync(path.join(ROOT, "supabase-gi-login-bruteforce-protection.sql"), "utf8");
const pinSql = fs.readFileSync(path.join(ROOT, "supabase-gi-pin-hashing.sql"), "utf8");

function sliceBetween(src, start, end){
  const i = src.indexOf(start);
  const j = end ? src.indexOf(end, i + start.length) : src.length;
  return i >= 0 && j > i ? src.slice(i, j) : "";
}

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-admin-login-unlock.js")]).status === 0, "node --check test");

console.log("\n2) users table can release a lock");
assert(html.includes('id="usersTbody"'), "users table stays");
assert(app.includes('data-act="unlock"'), "unlock button in the row");
assert(app.includes(">שחרר נעילה<"), "unlock button label");
assert(app.includes('if(act === "unlock") await this.unlockLogin(id);'), "click releases");
assert(app.includes("async unlockLogin(id)"), "unlock handler");
assert(app.includes('action: "clear_login_lock"'), "client calls clear_login_lock");
assert(app.includes("לשחרר את נעילת הכניסה של "), "confirm names the agent");
assert(app.includes("אחרי השחרור הנציג יכול להתחבר שוב עם הסיסמה הרגילה."), "confirm says login works again");
assert(app.includes("רק מנהל יכול לשחרר נעילת כניסה."), "non-admin is refused");
assert(app.includes('action: "list_login_locks"'), "client loads active locks");
assert(app.includes("נעול עד "), "locked agents show until when");
assert(app.includes("if(gen !== this._loginLocksGen) return;"), "a late lock list cannot repaint a release");

console.log("\n3) server clears attempts only after a manager is verified");
const serve = sliceBetween(fn, "Deno.serve", "");
const gateAt = serve.indexOf("if(!gate.ok) return gate.res;");
const clearAt = serve.indexOf('action === "clear_login_lock"');
const listAt = serve.indexOf('action === "list_login_locks"');
assert(fn.includes('action === "clear_login_lock"'), "edge action clear_login_lock");
assert(fn.includes('action === "list_login_locks"'), "edge action list_login_locks");
assert(gateAt >= 0 && clearAt > gateAt && listAt > gateAt, "both actions run only after verifyAdminActor");
assert(fn.includes("async function clearLoginLock"), "clear helper");
assert(fn.includes("async function listLoginLocks"), "list helper");
assert(fn.includes('.delete()') && fn.includes('.in("username", keys)'), "delete is limited to the agent keys");
assert(fn.includes('.gt("locked_until", nowIso)'), "list returns only locks that are still active");
assert(fn.includes("function loginLockKeys"), "keys come from the agent record");
const clearFn = sliceBetween(fn, "async function clearLoginLock", "async function provisionMissing");
assert(clearFn.includes('.select("id,name,username")'), "clear looks up the agent, not a typed name");
assert(!clearFn.includes("gi_verify_agent_login"), "clear does not redefine login");
assert(!clearFn.includes("p_pin"), "clear does not touch the PIN");

console.log("\n4) login lock rules themselves stay unchanged");
assert(/v_threshold int := 10/.test(lockSql) && /v_lock_min int := 15/.test(lockSql), "bruteforce SQL still 10 tries / 15 minutes");
assert(/v_threshold int := 10/.test(pinSql) && /v_lock_min int := 15/.test(pinSql), "pin-hash login SQL still 10 tries / 15 minutes");
assert(lockSql.includes("'LOCKED'") && pinSql.includes("'LOCKED'"), "LOCKED response stays in the login SQL");
assert(app.includes("נעלת את הכניסה לאחר מספר ניסיונות כושלים."), "login screen message stays");
assert(!lockSql.includes("clear_login_lock") && !pinSql.includes("clear_login_lock"), "login SQL does not gain an unlock path");

console.log("\n5) key matching releases username and display name");
const trim = (v) => String(v == null ? "" : v).trim();
const keySrc = sliceBetween(fn, "function loginLockKeys(row: Json){", "function loginLockTableMissing");
const loginLockKeys = new Function("trim", "return function(row){" + keySrc.replace(/^function loginLockKeys\(row: Json\)\{/, "").replace(/\}\s*$/, "") + "\n};")(trim);
const both = loginLockKeys({ username: " dana ", name: "דנה כהן" });
assert(both.length === 2 && both[0] === "dana" && both[1] === "דנה כהן", "both typed login names are cleared");
const same = loginLockKeys({ username: "דנה", name: "דנה" });
assert(same.length === 1 && same[0] === "דנה", "a repeated name is cleared once");
assert(loginLockKeys({ username: "  ", name: "" }).length === 0, "blank names are not a delete-all");

const lockBody = sliceBetween(app, "_lockForAgent(agent){", "_formatLockUntil(iso){");
const lockInner = lockBody.replace(/^_lockForAgent\(agent\)\{/, "").replace(/\}\s*,\s*$/, "");
let lockForAgent = null;
try {
  lockForAgent = new Function("safeTrim", "return function(agent){" + lockInner + "\n};")(trim);
} catch(err) {
  assert(false, "lock matcher parses: " + err.message);
}
const ui = {
  _loginLocks: new Map([
    ["dana", { until: "2026-10-08T18:00:00.000Z" }],
    ["דנה כהן", { until: "2026-10-08T20:00:00.000Z" }]
  ])
};
const matched = lockForAgent && lockForAgent.call(ui, { username: "dana", name: "מישהי" });
assert(matched && matched.until === "2026-10-08T18:00:00.000Z", "badge follows the username lock");
const later = lockForAgent && lockForAgent.call(ui, { username: "dana", name: "דנה כהן" });
assert(later && later.until === "2026-10-08T20:00:00.000Z", "the later of the two names is shown");
const none = lockForAgent && lockForAgent.call(ui, { username: "other", name: "אחר" });
assert(none == null, "an unlocked agent has no badge");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
