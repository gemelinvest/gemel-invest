/**
 * Pא contract: gi-daily-sales-mail is gated per action, not verify_jwt global.
 * Schedule is active again; send-slot still requires cron secret.
 * Screen actions require the signed-in manager session, not a body name or PIN.
 * Run: node _test-sec-pa-daily-mail.js
 */
const fs = require("fs");

const fn = fs.readFileSync("supabase/functions/gi-daily-sales-mail/index.ts", "utf8");
const wf = fs.readFileSync(".github/workflows/daily-sales-mail.yml", "utf8");
const mail = fs.readFileSync("gi-daily-sales-mail.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const cfg = fs.readFileSync("supabase/config.toml", "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

assert(fn.includes("GI-SEC Pא"), "missing Pא comment");
assert(fn.includes("const CRON_SECRET_REQUIRED = true"), "cron secret must be required");
assert(fn.includes("const UI_ACTOR_REQUIRED = true"), "UI actor gate must be on");
assert(fn.includes("x-gi-mail-cron-secret"), "cron secret header");
assert(fn.includes("function cronSecretOk"), "cron secret helper");
assert(fn.includes("async function requireUiSession"), "UI session helper");
assert(fn.includes("sb.auth.getUser(token)"), "UI actions validate the session JWT");
assert(fn.includes("user.app_metadata"), "session role comes from app_metadata");
assert(fn.includes("meta.agent_id"), "session is tied to the agent id");
assert(!fn.includes('rpc("gi_verify_agent_login"'), "UI path does not accept a body PIN");
assert(!fn.includes("body.actorId"), "body actor id is not proof");
assert(!fn.includes("body.actorPin"), "body PIN is not proof");
assert(!fn.includes("user_metadata"), "user-editable metadata is not proof");
assert(!fn.includes("loadMailAdminByLabel"), "a display name is not proof");
assert(fn.includes('select("id,name,username,role,active")'), "session path reads public agent columns");
assert(!fn.includes("select(\"id,name,username,role,active,pin\")"), "must not select agents.pin");
assert(fn.includes('if(!cronSecretOk(req, body)) return json({ ok: false, error: "אין הרשאה" }, 401)'),
  "send-slot without secret is 401");
assert(fn.includes("if(UI_ACTIONS.has(action))"), "UI actions share one gate");
assert(fn.includes("const SCHEDULED_SEND_DISABLED = false"), "scheduled send enabled");
assert(fn.includes("--no-verify-jwt") || cfg.includes("--no-verify-jwt"), "must not enable global JWT");
assert(wf.includes("supabase functions deploy gi-daily-sales-mail") && wf.includes("--no-verify-jwt --yes"),
  "workflow deploy stays --no-verify-jwt and confirms without a terminal");

assert(wf.includes("secrets.GI_DAILY_SALES_MAIL_CRON_SECRET"), "workflow passes cron secret");
assert(wf.includes('"x-gi-mail-cron-secret"'), "workflow sends cron header");
assert(wf.includes("GI_DAILY_SALES_MAIL_CRON_SECRET missing"), "empty secret skips, does not fail the clock");
assert(/(^|\n)  schedule:/.test(wf), "schedule is active");
assert(wf.includes('cron: "30 12 * * *"'), "12:30 Israel slot");
assert(wf.includes('cron: "0 15 * * *"'), "15:00 Israel slot");
assert(wf.includes('cron: "0 20 * * *"'), "20:00 Israel slot");
assert(wf.includes('"slot": "auto"'), "workflow defers slot choice to Edge prefs");
assert(fn.includes("async function loadMailAdminById"), "session agent is loaded by id");
assert(mail.includes("Never leave the HTML default"), "status clears loading on error");
assert(mail.includes('trim(fromBridge.username) || trim(fromBridge.name)'), "username falls back to name");
assert(mail.includes("gemel_invest_sb_auth_v1"), "client reads the stored session");
assert(mail.includes('Authorization: "Bearer " + token'), "client sends the session JWT");
assert(!mail.includes("actorPin"), "client does not send a PIN");
assert(html.includes("gi-daily-sales-mail.js?v=20261107-mail-session-v1"), "cache bust for the session gate");

assert(app.includes("Auth._sessionPin"), "PIN stays in memory only after login");
assert(app.includes("getMailSessionPin"), "bridge exposes pin only to mail");
assert(app.includes('client.rpc("gi_verify_agent_login"'), "must not touch login RPC");
assert(app.includes("AGENT_PUBLIC_COLUMNS"), "must keep public agent columns");

console.log("OK _test-sec-pa-daily-mail.js");
