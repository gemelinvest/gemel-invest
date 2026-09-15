/* GI-SYSTEM-NOTICE 2026-09-15 — הודעת מערכת מבודדת, בלי לגעת במנועי CRM.
   הרצה: node _test-system-notice.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260915-sys-notice-v5";
const IDLE_MS = 20000;
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const js = fs.readFileSync(path.join(ROOT, "gi-system-notice.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "gi-system-notice.css"), "utf8");
const sql = fs.readFileSync(path.join(ROOT, "supabase-system-notices.sql"), "utf8");

console.log("1) syntax + cache + isolated files");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-system-notice.js")]).status === 0, "node --check gi-system-notice.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("gi-system-notice.js?v=" + TAG), "index loads isolated module");
assert(html.includes("gi-system-notice.css?v=" + TAG), "index loads isolated css");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD");

console.log("\n2) settings composer + left-side card");
assert(html.includes("data-settings-rubric=\"systemNotice\""), "settings rubric exists");
assert(html.includes("id=\"settingsPanel-systemNotice\""), "settings panel exists");
assert(html.includes("id=\"giSysNoticeInput\""), "compose textarea");
assert(!html.includes("מה כל הנציגים צריכים לראות עכשיו"), "placeholder copy is gone");
const composer = sliceBetween(html, "id=\"settingsPanel-systemNotice\"", "id=\"settingsPanel-systemUpdates\"");
assert(composer.includes("card__title\">הודעת מערכת"), "title stays");
assert(!composer.includes("card__hint"), "hint under the title is gone");
assert(html.includes("id=\"giSysNoticeSendBtn\""), "send button");
assert(html.includes("id=\"giSysNoticeCard\""), "left card exists");
assert(html.includes("id=\"giSysNoticeDock\""), "reopen dock exists");
assert(html.includes("id=\"giSysNoticeDockOpen\""), "dock open button");
assert(html.includes("id=\"giSysNoticeDockClose\""), "dock close button");
assert(html.includes(">פתח<"), "dock open label");
assert(html.includes("id=\"giSysNoticeMinBtn\""), "minimize button");
assert(html.includes("id=\"giSysNoticeCloseBtn\""), "close button");
assert(!html.includes("<button class=\"giSysNoticeDock\""), "dock is no longer a single clickable chip");
assert(css.includes("left:16px") || css.includes("left: 16px"), "card is on the left");
assert(css.includes("bottom:16px") || css.includes("bottom: 16px"), "card is at the bottom");
assert(!css.includes("top:76px"), "old top-left placement is gone");
assert(css.includes("width:min(440px"), "card is larger than a toast");
assert(!css.includes("360px"), "old 360px toast width is gone");
assert(css.includes("background:#0b1f3a"), "navy official header");
assert(css.includes(".giSysNoticeDock"), "minimized dock styles");
assert(css.includes(".giSysNoticeDock{\n") || css.includes(".giSysNoticeDock{"), "dock block exists");
const dockCss = sliceBetween(css, ".giSysNoticeDock{", ".giSysNoticeDock.is-on");
assert(dockCss.includes("left:16px"), "dock stays in the same left place");
assert(dockCss.includes("bottom:16px"), "dock stays at the same bottom as the card");
assert(!dockCss.includes("top:76px"), "dock is no longer at the top");
assert(!dockCss.includes("left:0"), "old left-edge dock is gone");

console.log("\n3) send is immediate; module is isolated");
assert(js.includes("method: \"POST\""), "send writes immediately");
assert(js.includes("postgres_changes"), "live insert subscription");
assert(js.includes("broadcast"), "live broadcast backup");
assert(js.includes("playGiSystemNoticeSound"), "dedicated system sound");
const soundFn = sliceBetween(js, "function playGiSystemNoticeSound(){", "function formatWhen(iso){");
assert(soundFn.includes("exponentialRampToValueAtTime(1.0, t0 + 0.02)"), "system sound master is louder");
assert(!soundFn.includes("0.55"), "quiet 0.55 master is gone");
assert(!js.includes("playGiReminderSound"), "does not use reminder sound");
assert(!js.includes("playGiChatWhatsAppTone"), "does not use chat sound");
assert(!js.includes("playGiLeadNotifySequence"), "does not use lead sound");
assert(!app.includes("playGiSystemNoticeSound"), "app.js sound engines untouched");
assert(sql.includes("gi_system_notices"), "sql table exists");
assert(sql.includes("supabase_realtime"), "sql enables realtime");
assert(js.includes("const IDLE_MS = 20000"), "idle auto-minimize is 20 seconds");
assert(js.includes("function armIdle()"), "idle timer helper");
assert(js.includes("function clearIdle()"), "idle clear helper");
assert(js.includes("state.mode = \"closed\""), "close fully dismisses the notice");
assert(js.includes("pointerenter"), "hover pauses the idle timer");
assert(js.includes("pointerleave"), "leave restarts the idle timer");
assert(js.includes("giSysNoticeDockOpen"), "open is bound on the dock");
assert(js.includes("giSysNoticeDockClose"), "close is bound on the dock");
assert(!js.includes("$(\"giSysNoticeDock\")?.addEventListener(\"click\""), "whole dock is not a single expand click");
assert(js.includes("function canCompose()"), "compose gate exists");
assert(js.includes("lcUserPill__role"), "manager pill is enough to send");
assert(js.includes("מנהל"), "Hebrew manager role is allowed");
assert(js.includes("function isComposerRole(role)"), "role aliases are normalized");
assert(!js.includes("window.Auth"), "module stays off window.Auth");

console.log("\n4) CRM engines stay");
assert(app.includes("function playGiReminderSound(){"), "reminder sound stays");
assert(app.includes("const GI_ILS_AMOUNT"), "amount helper stays");
assert(app.includes("async searchCustomers(query, limit = 40, options = {}){"), "customer search stays");
assert(app.includes("customerOwnedByCurrentAgent(rec)"), "ownership helper stays");
assert(html.includes("id=\"giReminderLinkQuery\""), "reminder link search stays");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
