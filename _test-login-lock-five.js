/**
 * Contract checks for the 5-attempt login lock and the 4th-try warning.
 * Run: node _test-login-lock-five.js
 *
 * Older SQL files stay at 10/15 because they were already applied.
 * The live policy is supabase-gi-login-lock-five.sql.
 */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const sql = fs.readFileSync(path.join(root, "supabase-gi-login-lock-five.sql"), "utf8");
const oldLock = fs.readFileSync(path.join(root, "supabase-gi-login-bruteforce-protection.sql"), "utf8");
const oldHash = fs.readFileSync(path.join(root, "supabase-gi-pin-hashing.sql"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const phone = fs.readFileSync(path.join(root, "phone/phone.js"), "utf8");
const session = fs.readFileSync(path.join(root, "supabase/functions/gi-open-agent-session/index.ts"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

const warn = "שים לב, נותר ניסיון אחרון. המערכת תיחסם ל-15 דקות.";

assert(/v_threshold int := 5/.test(sql), "new login SQL locks after 5 failures");
assert(/v_lock_min int := 15/.test(sql), "lock stays 15 minutes");
assert(/v_failed >= v_threshold/.test(sql), "the 5th failure returns the lock");
assert(/'LOCKED', 'retry_after', v_lock_min \* 60/.test(sql), "the locking attempt returns 15 minutes");
assert(/v_failed = v_threshold - 1/.test(sql), "the attempt before the lock is the warning");
assert(/'BAD_PIN', 'attempts_left', 1/.test(sql), "the 4th failure reports one attempt left");
assert(/username = uname and ip = v_ip/.test(sql), "lock stays per username and IP");
assert(/login_bruteforce_enabled/.test(sql), "kill switch stays");
assert(/extensions\.crypt\(upin, ag\.pin_hash\) = ag\.pin_hash/.test(sql), "PIN hash compare stays");
assert(sql.includes("Never return the pin or pin_hash"), "response still must not return the PIN");
assert(sql.includes("'agentId', ag.id"), "success return shape stays");
assert(/security definer/i.test(sql), "RPC stays security definer");
assert(/grant execute on function public\.gi_verify_agent_login\(text, text\) to anon, authenticated/.test(sql), "login before a session stays callable");
assert(/grant execute on function public\.gi_verify_agent_login\(text, text\) to service_role/.test(sql), "service_role execute stays");

const userNotFound = sql.split("'USER_NOT_FOUND'")[1].split("'USERNAME_AMBIGUOUS'")[0];
assert(!/gi_login_attempts|attempts_left/i.test(userNotFound), "an unknown username is not counted and gets no warning");

assert(/v_threshold int := 10/.test(oldLock) && /v_lock_min int := 15/.test(oldLock), "already-applied bruteforce SQL stays 10/15");
assert(/v_threshold int := 10/.test(oldHash) && /v_lock_min int := 15/.test(oldHash), "already-applied pin-hash SQL stays 10/15");

assert(app.includes(warn), "CRM login shows the last-attempt warning");
assert(/code === "BAD_PIN" && Number\(data\.attempts_left\) === 1/.test(app), "CRM warning only on the server's last attempt");
assert(app.includes("נעלת את הכניסה לאחר מספר ניסיונות כושלים."), "existing lock message stays");
assert(app.includes("קוד כניסה שגוי"), "other failures stay a wrong-code message");
assert(html.includes("&giLoginLock=1"), "CRM cache token includes the lock warning");

assert(phone.includes(warn), "phone login shows the same warning");
assert(/loginMessage\(data && data\.error, data\)/.test(phone), "phone reads attempts_left from the session response");
assert(/code === "LOCKED" \? "ACCOUNT_LOCKED"/.test(session), "session still maps a server lock");
assert(/Number\(verifyData\.attempts_left\) === 1/.test(session), "session forwards the last-attempt flag");
assert(!session.includes("signInWithPassword"), "session open does not sign in with a password");

console.log("OK _test-login-lock-five.js");
