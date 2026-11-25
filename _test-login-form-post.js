/* טופס הכניסה נשלח ב-POST, והמסלול הקיים נשאר.
   הרצה: node _test-login-form-post.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const desktop = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const phone = fs.readFileSync(path.join(ROOT, "phone/index.html"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const phoneJs = fs.readFileSync(path.join(ROOT, "phone/phone.js"), "utf8");
let failed = 0;

function assert(cond, msg) {
  if (cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function sliceBetween(src, startMark, endMark) {
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start < 0 ? 0 : start);
  if (start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

function formTag(html, id) {
  const mark = 'id="' + id + '"';
  const at = html.indexOf(mark);
  if (at < 0) return "";
  const open = html.lastIndexOf("<form", at);
  const close = html.indexOf(">", at);
  if (open < 0 || close < open) return "";
  return html.slice(open, close + 1);
}

console.log("1) the three login forms post, and other forms stay as they were");
const desktopForm = formTag(desktop, "lcLoginForm");
const phoneLogin = formTag(phone, "loginForm");
const phoneMfa = formTag(phone, "mfaForm");
assert(desktopForm.includes('method="post"') && desktop.includes('name="username"') && desktop.includes('name="pin"'), "the desktop login form posts username and pin");
assert(phoneLogin.includes('method="post"') && phone.includes('name="username"') && phone.includes('name="password"'), "the phone login form posts");
assert(phoneMfa.includes('method="post"'), "the phone verification form posts");
assert((desktop.match(/method="post"/g) || []).length === 1, "only the desktop login form was changed");
assert((phone.match(/method="post"/g) || []).length === 2, "only the two phone entry forms were changed");

console.log("2) the existing login path still handles the submit");
const desktopSubmit = sliceBetween(app, 'on(this.els.form, "submit", async (e) => {', "on(this.els.user");
assert(desktopSubmit.includes("e.preventDefault()") && desktopSubmit.includes("await this._submit()"), "desktop submit stays in the page and calls the existing login");
const phoneLoginSubmit = sliceBetween(phoneJs, '$("loginForm").addEventListener("submit", async (event) => {', '$("mfaForm").addEventListener');
assert(phoneLoginSubmit.includes("event.preventDefault()") && phoneLoginSubmit.includes("openSession(username, pin)"), "phone login stays in the page and opens the same session");
const phoneMfaSubmit = sliceBetween(phoneJs, '$("mfaForm").addEventListener("submit", async (event) => {', "function ");
assert(phoneMfaSubmit.includes("event.preventDefault()") && phoneMfaSubmit.includes("verifyCode"), "phone verification stays in the page");
assert(app.includes("gi_verify_agent_login"), "the login function is unchanged");

if (failed) {
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
