#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = __dirname;
const sql = fs.readFileSync(path.join(root, "supabase-gi-login-uniform-failure.sql"), "utf8");
const session = fs.readFileSync(path.join(root, "supabase/functions/gi-open-agent-session/index.ts"), "utf8");
const mail = fs.readFileSync(path.join(root, "supabase/functions/gi-login-mail-code/index.ts"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
let failed = 0;
function assert(cond, msg){
  if(!cond){
    failed += 1;
    console.error("FAIL", msg);
  }
}

const missing = sql.split("if match_count = 0 then")[1].split("if match_count > 1 then")[0];
assert(missing.includes("'BAD_PIN'"), "a missing or disabled user returns the same code as a wrong PIN");
assert(!missing.includes("USER_NOT_FOUND"), "the missing user is not named");
assert(!/gi_login_attempts/i.test(missing), "a missing user is not counted toward a lock");
assert(missing.includes("extensions.crypt"), "a missing user pays the same hash cost");
assert(missing.includes("650 milliseconds"), "a missing user waits like a real check");
assert(sql.includes("'LOCKED', 'retry_after', v_retry_after"), "a lock is still a lock");
assert(sql.includes("'USERNAME_AMBIGUOUS'"), "an ambiguous name stays its own answer");
assert(sql.includes("'BAD_PIN', 'attempts_left', 1"), "the last attempt is still reported");
assert(sql.includes("'ok', true"), "a correct PIN still succeeds");
assert(/security definer/i.test(sql), "the login function keeps its existing definer rights");
assert(sql.includes("set search_path = public"), "the login function keeps a fixed search path");

assert(!session.includes("AGENT_NOT_FOUND") && !session.includes("AGENT_DISABLED"), "the session function does not name a missing or disabled user");
assert(session.includes("sameLoginFailure"), "those failures share one answer");
assert(session.includes("USERNAME_AMBIGUOUS") && session.includes("FACE_AUTH_FAILED") && session.includes("ACCOUNT_LOCKED"), "ambiguous names, face login, and a lock stay distinct");
assert(/Number\(verifyData\.attempts_left\) === 1/.test(session), "the session still forwards the last-attempt flag");

assert(mail.includes('return { error: "USER_NOT_FOUND", agent: null'), "the mail code uses one failure for a missing or disabled user");
assert(app.includes("if(matched.active === false) return this._setError('קוד כניסה שגוי')"), "the desktop screen uses the same sentence");

if(failed){
  console.error(failed + " failed");
  process.exit(1);
}
console.log("OK");
