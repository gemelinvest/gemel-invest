/* GI-SYSTEM-NOTICE 2026-09-15 — הודעת מערכת מבודדת, בלי לגעת במנועי CRM.
   הרצה: node _test-system-notice.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260915-sys-notice-v1";
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
assert(html.includes("id=\"giSysNoticeSendBtn\""), "send button");
assert(html.includes("id=\"giSysNoticeCard\""), "left card exists");
assert(html.includes("id=\"giSysNoticeDock\""), "reopen dock exists");
assert(html.includes("id=\"giSysNoticeMinBtn\""), "minimize button");
assert(html.includes("id=\"giSysNoticeCloseBtn\""), "close button");
assert(css.includes("left:16px") || css.includes("left: 16px"), "card is on the left");
assert(css.includes(".giSysNoticeDock"), "minimized dock styles");

console.log("\n3) send is immediate; module is isolated");
assert(js.includes("method: \"POST\""), "send writes immediately");
assert(js.includes("postgres_changes"), "live insert subscription");
assert(js.includes("broadcast"), "live broadcast backup");
assert(js.includes("playGiSystemNoticeSound"), "dedicated system sound");
assert(!js.includes("playGiReminderSound"), "does not use reminder sound");
assert(!js.includes("playGiChatWhatsAppTone"), "does not use chat sound");
assert(!js.includes("playGiLeadNotifySequence"), "does not use lead sound");
assert(!app.includes("playGiSystemNoticeSound"), "app.js sound engines untouched");
assert(sql.includes("gi_system_notices"), "sql table exists");
assert(sql.includes("supabase_realtime"), "sql enables realtime");

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
