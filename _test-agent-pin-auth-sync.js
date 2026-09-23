/* GI-FIX 2026-09-22 — שינוי PIN בעריכת משתמש נשמר ל-agents.pin ולסיסמת Auth.
   Run: node _test-agent-pin-auth-sync.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260923-month-net-addon-v1";
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
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const fn = fs.readFileSync(path.join(ROOT, "supabase/functions/gi-provision-agent-auth/index.ts"), "utf8");
const cfg = fs.readFileSync(path.join(ROOT, "supabase/config.toml"), "utf8");
const wf = fs.readFileSync(path.join(ROOT, ".github/workflows/deploy-provision-agent-auth.yml"), "utf8");

console.log("1) cache tags + syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(app.includes('const BUILD = "' + TAG + '"'), "app.js BUILD");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "wizard js version");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "gi-wizard build");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");

console.log("\n2) typed PIN is the only write to agents.pin");
assert(!/safeTrim\(input\?\.pin\) \|\| safeTrim\(input\?\.pass\) \|\| "0000"/.test(app), "normalizeAgentRecord does not default 0000");
assert(app.includes('const pin = safeTrim(input?.pin) || safeTrim(input?.pass) || "";'), "empty pin stays empty after load");
assert(app.includes("if(pin) rec.pin = pin;"), "loaded agents omit missing pin");
assert(app.includes("writeAgentPin: options.writeAgentPin === true"), "persist forwards writeAgentPin");
assert(app.includes("writeAgentPin: !!pin"), "user save writes pin only when typed");
assert(app.includes("pinWriteFailed: true"), "pin PATCH failure is fatal");
assert(!/if\(\/pin\/i\.test\(msg\)\) delete slim\.pin/.test(app), "writeAgentRow does not silently drop pin");
assert(app.includes("empty on edit => omit from upsert"), "empty edit pin still omits column");

console.log("\n3) Auth password sync for existing MFA users only");
assert(fn.includes("GI-PROVISION-AGENT-AUTH"), "edge function present");
assert(!fn.includes("auth.admin.createUser"), "does not create Auth users");
assert(fn.includes("auth.admin.updateUserById"), "updates existing Auth password");
assert(fn.includes("skippedAuth: \"pin_only\""), "PIN-only skips Auth");
assert(fn.includes("skippedAuth: \"no_auth_user\""), "missing Auth user is not created");
assert(fn.includes('rpc("gi_verify_agent_login"'), "actor PIN uses login RPC");
assert(fn.includes("deriveGiAuthPassword"), "HIBP fallback password");
assert(fn.includes("GiCrm!"), "derived password prefix matches client");
assert(cfg.includes("[functions.gi-provision-agent-auth]"), "config.toml function");
assert(/gi-provision-agent-auth[\s\S]*verify_jwt = false/.test(cfg), "verify_jwt false");
assert(wf.includes("gi-provision-agent-auth") && wf.includes("--no-verify-jwt"), "workflow deploys function");
assert(app.includes("async _syncAgentLoginPin("), "UsersUI sync helper");
assert(app.includes("/functions/v1/gi-provision-agent-auth"), "client calls the function");
assert(app.includes("action: \"sync\""), "client uses sync action");
assert(!app.includes("auth.admin.updateUserById"), "browser does not call Auth admin");
assert(html.includes("לכניסת 2FA הקוד מתעדכן גם ב-Auth"), "edit modal explains Auth sync");

console.log("\n4) login still PIN then Authenticator, with both password schemes");
assert(app.includes("const deriveGiAuthPassword"), "client derive helper");
assert(app.includes("const signInAgentAuth"), "shared Auth sign-in helper");
assert(app.includes("signInAgentAuth(authEmail, pin, sec)"), "MFA login uses helper");
assert(app.includes('this._showMfaStep(matched, flow.factorId'), "login still opens MFA after PIN");
assert(app.includes("הקש סיסמה מהאפליקציה"), "login MFA title stays");
assert(app.includes("btnShowLoginMfaQr"), "login recovery QR button stays");

const grantSql = fs.readFileSync(path.join(ROOT, "supabase-gi-service-role-agent-pin.sql"), "utf8");
console.log("\n5) service_role GRANT + Auth sync continues if pin UPDATE fails");
assert(grantSql.includes("grant insert, update on table public.agents to service_role"), "table INSERT/UPDATE for service_role");
assert(grantSql.includes("grant insert (pin), update (pin) on table public.agents to service_role"), "column pin INSERT/UPDATE for service_role");
assert(fn.includes('headers.set("Authorization", "Bearer " + key)'), "edge fetch forces service_role Authorization");
assert(fn.includes("/auth/v1/user"), "manager JWT verified at /auth/v1/user, not via service_role");
assert(fn.includes("getAuthUserByAccessToken"), "getUser does not overwrite manager JWT");
assert(grantSql.includes("grant execute on function public.gi_verify_agent_login(text, text) to service_role"), "service_role can run PIN login RPC");
assert(fn.includes(".select(\"id\")"), "pin UPDATE RETURNING only id, not pin");
assert(fn.includes("const pinUpdated = !pinErr"), "pin failure is recorded, not thrown");
assert(!/if\(pinErr\) return json\(/.test(fn), "pin UPDATE error does not abort Auth sync");
assert(!fn.includes("לא הצלחתי לשמור את קוד הכניסה בטבלת הנציגים"), "old pin-update 500 toast is gone");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
