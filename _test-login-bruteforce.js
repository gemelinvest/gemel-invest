/**
 * Contract checks for brute-force login protection (Track A / Step A2).
 * Additive only: success path unchanged; LOCKED handling added.
 * Run: node _test-login-bruteforce.js
 */
const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-login-bruteforce-protection.sql"), "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

// app.js: LOCKED handled with a clear Hebrew message + retry minutes.
assert(app.includes('"LOCKED"'), "app.js must handle LOCKED error code");
assert(/נעלת את הכניסה/.test(app), "app.js must show lockout message");
assert(/retry_after/.test(app), "app.js must read retry_after from RPC");
// existing codes still mapped (unchanged behavior)
assert(app.includes('"USERNAME_AMBIGUOUS"'), "must still handle USERNAME_AMBIGUOUS");
assert(/קוד כניסה שגוי/.test(app), "must still show generic bad-pin message");
assert(app.includes('source:"server"'), "server source preserved");
assert(app.includes('source:"local"'), "local fallback preserved");

// SQL: attempts table private to service_role only.
assert(/create table if not exists public\.gi_login_attempts/i.test(sql), "must create attempts table");
assert(/revoke all on public\.gi_login_attempts from anon, authenticated/i.test(sql), "attempts must be private");
assert(/grant all on public\.gi_login_attempts to service_role/i.test(sql), "service_role manages attempts");

// SQL: kill switch present and defaults ON.
assert(/login_bruteforce_enabled/i.test(sql), "must have kill switch setting");
assert(sql.includes("'login_bruteforce_enabled', 'true'"), "kill switch defaults ON");

// SQL: success path clears attempts (additive), success return unchanged.
assert(/delete from public\.gi_login_attempts where username = uname and ip = v_ip/i.test(sql), "success must clear attempts");
assert(sql.includes("'agentId', ag.id"), "success return shape unchanged");
assert(sql.includes("Never return the pin"), "must still never return pin");

// SQL: only BAD_PIN records an attempt (not USER_NOT_FOUND) — prevents lockout DoS.
assert(/insert into public\.gi_login_attempts/i.test(sql), "BAD_PIN path must insert an attempt");
assert(/update public\.gi_login_attempts\s+set failed_count = failed_count \+ 1/i.test(sql), "BAD_PIN path must increment count");
const userNotFoundBlock = sql.split("'USER_NOT_FOUND'")[1].split("'USERNAME_AMBIGUOUS'")[0];
assert(!/gi_login_attempts/i.test(userNotFoundBlock), "USER_NOT_FOUND must NOT record an attempt (anti-DoS)");

// SQL: lock check returns LOCKED with retry_after.
assert(sql.includes("'LOCKED'"), "must return LOCKED");
assert(/'retry_after', v_retry_after/.test(sql), "must return retry_after seconds");

// SQL: thresholds are constants (10 attempts / 15 min lock).
assert(/v_threshold int := 10/.test(sql), "threshold default 10");
assert(/v_lock_min int := 15/.test(sql), "lock default 15 min");

// SQL: security definer + grants preserved.
assert(/security definer/i.test(sql), "RPC stays security definer");
assert(/grant execute on function public\.gi_verify_agent_login/i.test(sql), "execute grant preserved");
assert(/revoke all on function public\.gi_verify_agent_login/i.test(sql), "revoke from public preserved");

console.log("OK _test-login-bruteforce.js");
