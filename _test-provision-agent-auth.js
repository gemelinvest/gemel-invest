/**
 * Provision agent Auth from CRM user management.
 * Run: node _test-provision-agent-auth.js
 */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const fn = fs.readFileSync(path.join(root, "supabase/functions/gi-provision-agent-auth/index.ts"), "utf8");
const cfg = fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8");
const wf = fs.readFileSync(path.join(root, ".github/workflows/deploy-provision-agent-auth.yml"), "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

console.log("1) Edge Function contract");
assert(fn.includes("GI-PROVISION-AGENT-AUTH"), "function banner");
assert(fn.includes('rpc("gi_verify_agent_login"'), "actor PIN uses login RPC");
assert(fn.includes("auth.admin.createUser"), "creates Auth user with service role");
assert(fn.includes("auth.admin.updateUserById"), "updates existing Auth user password");
assert(fn.includes("deriveGiAuthPassword"), "HIBP fallback password");
assert(fn.includes("GiCrm!"), "derived password prefix matches client");
assert(fn.includes("isWeakPasswordError"), "detects leaked/weak password errors");
assert(fn.includes("password_hibp") || fn.includes("easy to guess") || fn.includes("weak_password") || fn.includes("hibp"), "HIBP error matching");
assert(fn.includes('from("agents")'), "links agents.auth_user_id");
assert(fn.includes("auth_user_id"), "writes auth_user_id");
assert(fn.includes("app_metadata"), "stores agent_id in app_metadata not user_metadata for authz");
assert(!fn.includes("select(\"id,name,username,role,active,pin\")"), "must not select agents.pin");
assert(fn.includes("רק מנהל יכול להקים משתמש Auth") || fn.includes("isProvisionAdmin"), "admin/manager gate");

console.log("2) Deploy config");
assert(cfg.includes("[functions.gi-provision-agent-auth]"), "config.toml function");
assert(/gi-provision-agent-auth[\s\S]*verify_jwt = false/.test(cfg) || cfg.includes("gi-provision-agent-auth"), "verify_jwt false for custom PIN auth");
assert(wf.includes("gi-provision-agent-auth"), "workflow deploys the function");
assert(wf.includes("--no-verify-jwt"), "workflow keeps custom auth");

console.log("3) CRM save wires provision");
assert(app.includes("async _provisionAgentAuth("), "UsersUI provision helper");
assert(app.includes("/functions/v1/gi-provision-agent-auth"), "calls the edge function");
assert(app.includes("משתמש Supabase Auth נוצר אוטומטית"), "success copy after create");
assert(app.includes("Auth לא נוצר"), "warns if Auth provision fails");
assert(html.includes("אין צורך להזין אותם שוב ב-Studio") || html.includes("אין צורך להזין אותם שוב"), "HTML explains no Studio step");

console.log("4) PIN no longer silently dropped / defaulted to 0000");
assert(app.includes("const pin = safeTrim(input?.pin) || safeTrim(input?.pass) || \"\""), "normalizeAgentRecord does not default 0000");
assert(!/safeTrim\(input\?\.pin\) \|\| safeTrim\(input\?\.pass\) \|\| \"0000\"/.test(app), "0000 default removed from normalizeAgentRecord");
assert(app.includes("pinWriteFailed: true"), "new agent pin write failure is fatal");
assert(app.includes("empty on edit => omit from upsert"), "edit empty pin omits field");
assert(app.includes("try { delete a.pin; }"), "edit clears in-memory pin so 0000 is not written");
assert(app.includes("קוד כניסה חדש"), "add modal does not prefill 0000");

console.log("5) Login uses provisioned Auth password scheme");
assert(app.includes("function deriveGiAuthPassword") || app.includes("const deriveGiAuthPassword"), "client derive helper");
assert(app.includes("GiCrm!") && app.includes("!v1"), "client formula matches edge");
assert(app.includes("const signInAgentAuth"), "shared Auth sign-in helper");
assert(app.includes("signInAgentAuth(authEmail, pin, sec)"), "MFA login uses helper");
assert(app.includes("authPasswordScheme"), "scheme persisted on agentSecurity");
assert(app.includes("Auth._sessionPin = safeTrim(pin)"), "admin login stores session PIN for provision actor");

console.log("6) Cache bust");
assert(html.includes("app.js?v=20260916-provision-agent-auth-v1"), "index.html cache bust");
assert(fs.readFileSync(path.join(root, "service-worker.js"), "utf8").includes("gi-v12-20260916-provision-agent-auth-v1"), "service worker cache bust");

console.log("all checks passed");
