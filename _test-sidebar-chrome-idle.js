/* GI-SIDEBAR-CHROME 2026-09-17
   כחול התפריט הצדדי על לחצני תזכורת + פתיחת תיק, והתנתקות אחרי 60 דקות.
   בלי לגעת בלוגיקת תזכורת / פתיחת תיק / InactivityGuard.
   הרצה: node _test-sidebar-chrome-idle.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const CSS_TAG = "20260917-sidebar-chrome-v1";
const APP_TAG = "20260919-shift-hours-persist-v1";
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = read("app.js");
const unify = read("theme-unify-flat.css");
const theme = read("theme.css");
const css = read("app.css");
const html = read("index.html");
const sw = read("service-worker.js");

const reminderBtns = sliceBetween(unify, "GI-SIDEBAR-CHROME 2026-09-17 — reminder primary", "/* ---- שלב 1:");
const folderUnify = sliceBetween(unify, "GI-SIDEBAR-CHROME 2026-09-17 — open-file control", "#view-customers .emptyState:not(#\\9)");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-sidebar-chrome-idle.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + CSS_TAG), "index.html app.css cache");
assert(html.includes("theme.css?v=" + CSS_TAG), "index.html theme.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes("theme-unify-flat.css?v=" + CSS_TAG), "unify-flat cache");

console.log("\n2) reminder primary uses sidebar blue");
assert(reminderBtns.includes("background: var(--gi-navy)"), "reminder primary fill is sidebar blue");
assert(reminderBtns.includes("var(--gi-navy-hover)"), "reminder primary hover is sidebar hover blue");
assert(!reminderBtns.includes("background: var(--uf-accent)"), "reminder primary left the dark navy accent");
assert(unify.includes("#giReminderModal .btn:not(#\\9):not(#\\9)"), "secondary reminder buttons stay");

console.log("\n3) customer folder button uses sidebar blue");
assert(folderUnify.includes("color: var(--gi-navy)"), "folder icon uses sidebar blue");
assert(folderUnify.includes("background: var(--gi-navy)"), "folder hover fill is sidebar blue");
assert(!folderUnify.includes("background: var(--uf-accent)"), "folder button left the dark navy accent");
assert(theme.includes("#view-customers .lcCustomerFolderBtn:not(#\\9):not(#\\9)"), "theme folder rule stays");
assert(css.includes("data-open-customer") === false, "css does not own the open handler");
assert(app.includes('class="lcCustomerFolderBtn"'), "open-file button markup stays");
assert(app.includes('data-open-customer="${escapeHtml(rec.id)}"'), "open-file data attribute stays");

console.log("\n4) idle logout is 60 minutes — engine unchanged");
assert(app.includes("const AUTO_LOGOUT_IDLE_MS = 60 * 60 * 1000"), "idle window is 60 minutes");
assert(!app.includes("const AUTO_LOGOUT_IDLE_MS = 40 * 60 * 1000"), "40-minute idle constant is gone");
assert(app.includes("לאחר 60 דקות של אי פעילות במערכת"), "logout copy says 60 minutes");
assert(!app.includes("לאחר 40 דקות של אי פעילות במערכת"), "40-minute logout copy is gone");
assert(app.includes("const InactivityGuard = {"), "InactivityGuard stays");
assert(app.includes("idleMs: AUTO_LOGOUT_IDLE_MS"), "guard still reads AUTO_LOGOUT_IDLE_MS");
assert(app.includes('events: ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "pointerdown", "wheel"]'), "activity listeners stay");
assert(app.includes('if(reason === "idle"){'), "idle logout still goes through Auth.logout");
assert(app.includes("this.events.forEach((evt) => window.addEventListener(evt, this.boundActivityHandler, true))"), "activity bump wiring stays");

console.log("\n5) reminder / customer engines stay");
assert(app.includes("const ReminderUI = {"), "ReminderUI stays");
assert(app.includes("showStep(step){"), "reminder wizard steps stay");
assert(html.includes("id=\"giReminderModal\""), "reminder modal markup stays");
assert(html.includes("id=\"giReminderStep1\""), "reminder type step stays");
assert(app.includes("handleOpenCustomerClick"), "customer open click handler stays");
assert(app.includes("function playGiReminderSound(){"), "reminder sound stays");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
