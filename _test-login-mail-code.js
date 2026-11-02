/* GI-LOGIN-MAIL-CODE
   כניסה בקוד למייל: 6 ספרות, 10 דקות, רק המייל שבהגדרות,
   ורק מתיבת דוח המכירות. הקוד לא נשמר בדפדפן.
   הרצה: node _test-login-mail-code.js
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

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

function extractFn(src, fnName){
  const start = src.indexOf("function " + fnName + "(");
  if(start < 0) return "";
  let i = start;
  let depth = 0;
  let seen = false;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{"){ depth += 1; seen = true; }
    else if(ch === "}"){
      depth -= 1;
      if(seen && depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const fn = read("supabase/functions/gi-login-mail-code/index.ts");
const app = read("app.js");
const html = read("index.html");
const cfg = read("supabase/config.toml");
const mailEnd = app.indexOf("Auth.logout = (function(orig){");
const mailBlock = app.slice(app.indexOf("GI-LOGIN-MAIL-CODE"), mailEnd > 0 ? mailEnd : app.length);

console.log("1) syntax + sender");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(fn.includes('const SALES_FROM = "orias@i-s-f.co.il"'), "sales mailbox is the sender");
assert(fn.includes("normalizeEmail(account.connected_email) !== SALES_FROM"), "refuses any other connected mailbox");
assert(!fn.includes("bituliimp@gmail.com"), "cancellation mailbox is not used");
assert(fn.includes("https://graph.microsoft.com/v1.0/me/sendMail"), "sends through the sales Outlook connection");
assert(fn.includes("saveToSentItems: false"), "the code is not kept in Sent items");
assert(cfg.includes("[functions.gi-login-mail-code]"), "function is registered");
assert(cfg.includes("verify_jwt = false"), "login code can be requested before a session");

console.log("\n2) code rules");
assert(fn.includes("const CODE_MS = 10 * 60 * 1000"), "code expires after 10 minutes");
assert(fn.includes('return String(buf[0] % 1000000).padStart(6, "0")'), "code is 6 digits");
assert(fn.includes("crypto.getRandomValues"), "each code is random");
assert(fn.includes('name: "HMAC", hash: "SHA-256"'), "server stores an HMAC, not the code");
assert(fn.includes("loginCodeExpired"), "expired codes are rejected");
assert(fn.includes("הסיסמה תקפה ל-10 דקות בלבד."), "mail says the code lasts 10 minutes");
assert(fn.includes("אין להעביר אותה לאף אדם אחר."), "mail says not to forward the code");
assert(fn.includes("הסיסמה שלך לכניסה למערכת ONYX: "), "mail names the ONYX password");
assert(fn.includes('"שלום: " + who'), "mail greets the agent by name");
assert(fn.includes('error: "EMAIL_MISMATCH"'), "wrong email is rejected");
assert(fn.includes("return mailAddr(sec.authEmail) || mailAddr(agent.email)"), "settings email is the destination");
assert(fn.includes('return META_KEY + ":" + trim(agentId)'), "each agent has a separate code row");
assert(!/return json\(\{[^}]*\bcode\s*:/.test(fn), "the response does not include the code");

console.log("\n3) screen does not keep the email or the code");
assert(html.includes("כניסה באמצעות קוד למייל"), "login offers the email code");
assert(html.includes("אנא הזן את הסיסמה שנשלחה אליך"), "the code field asks for the mailed password");
assert(html.includes('id="lcLoginMailEmail"') && html.includes('autocomplete="off"'), "email field is not offered to the password manager");
assert(html.includes('id="lcLoginMailCode"') && html.includes('maxlength="6"'), "code field is six characters");
assert(app.includes("GI-LOGIN-MAIL-CODE"), "client marker");
assert(mailBlock.includes('emailEl.value = ""'), "typed email is cleared after the request");
assert(mailBlock.includes("codeEl.value = \"\""), "typed code is cleared after the check");
assert(mailBlock.includes("this._mailLoginUser = \"\""), "the username held in memory is cleared");
assert(!mailBlock.includes("localStorage"), "mail login does not write local storage");
assert(!mailBlock.includes("sessionStorage"), "mail login does not write session storage");
assert(mailBlock.includes('this._sessionPin = ""'), "the mailed code does not become the saved PIN");
assert(app.includes('action: "request"') || mailBlock.includes('this._postLoginMail("request"'), "request goes to the server");
assert(mailBlock.includes('this._postLoginMail("verify"'), "verify goes to the server");
assert(mailBlock.includes("המייל לא נכון או לא נמצא כשייך למשתמש."), "mismatch message is shown");
assert(mailBlock.includes('loginDetailText: "mail_code"'), "a valid mail code opens the system");
assert(!mailBlock.includes("_showMfaStep"), "a valid mail code does not open the authenticator screen");

console.log("\n4) runtime — settings email, expiry, greeting");
function stripTypes(src){
  return src
    .replace(/\s+as\s+[A-Za-z_][A-Za-z0-9_]*/g, "")
    .replace(/:\s*(?:unknown|string|number|boolean|Json)\b/g, "");
}
assert(fn.includes("on_conflict=key"), "the code row is saved through the meta table");
assert(fn.includes("function loginMailErrorCode"), "mailbox failures stay a mailbox error");
const helperSrc = ["mailAddr", "asObject", "storedLoginEmail", "loginCodeExpired", "loginMailBody", "sameText", "loginMailErrorCode"]
  .map((name) => stripTypes(extractFn(fn, name)))
  .join("\n");
assert(helperSrc.includes("function storedLoginEmail"), "helpers extracted");
const box = { trim(v){ return String(v == null ? "" : v).trim(); }, normalizeEmail(v){ return String(v == null ? "" : v).trim().toLowerCase(); } };
const run = new Function("trim", "normalizeEmail", helperSrc + "\nreturn { storedLoginEmail, loginCodeExpired, loginMailBody, sameText, mailAddr, loginMailErrorCode };");
const api = run(box.trim, box.normalizeEmail);
assert(api.storedLoginEmail({ email: "old@example.com" }, { authEmail: "Agent@I-S-F.co.il" }) === "agent@i-s-f.co.il", "settings email wins and is normalized");
assert(api.storedLoginEmail({ email: "row@example.com" }, {}) === "row@example.com", "row email is used only when settings email is empty");
assert(api.sameText("agent@i-s-f.co.il", "agent@i-s-f.co.il") === true, "matching emails compare equal");
assert(api.sameText("agent@i-s-f.co.il", "other@i-s-f.co.il") === false, "a different email does not match");
const now = 1_700_000_000_000;
assert(api.loginCodeExpired(now + 10 * 60 * 1000, now) === false, "a code is valid until its expiry");
assert(api.loginCodeExpired(now, now) === true, "a code is dead at the expiry instant");
assert(api.loginCodeExpired(now - 1, now) === true, "a code is dead after 10 minutes");
const body = api.loginMailBody("דנה כהן", "482913");
assert(body.includes("שלום: דנה כהן"), "greeting uses the agent name");
assert(body.includes("ONYX: 482913"), "body contains this code only");
assert(body.includes("10 דקות") && body.includes("אין להעביר"), "body keeps the approved wording");
assert(api.loginMailErrorCode("MAILBOX_NOT_READY:AADSTS70008") === "MAILBOX_NOT_READY", "a token failure stays a mailbox error");
assert(api.loginMailErrorCode("SEND_FAILED:403") === "SEND_FAILED", "a graph rejection stays a send failure");
assert(api.loginMailErrorCode("permission denied for table gi_daily_sales_mail_account") === "MAILBOX_NOT_READY", "a blocked mailbox table is not a generic error");
assert(api.loginMailErrorCode("meta-write") === "SERVER_ERROR", "an unknown failure stays generic");

console.log("\n" + (failed ? "FAILED" : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
