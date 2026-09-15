/* GI-REMINDER 2026-09-15 — תזכורת חדשה משמיעה זכוכית רכה פעמיים עם הפסקה.
   ליד וצ׳אט לא משתנים.
   הרצה: node _test-reminder-soft-glass.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260915-reminder-vol-v1";
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

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD");

console.log("\n2) reminder plays soft glass twice with a pause");
const alertFn = sliceBetween(app, "_playAlertSound(){", "_sendBrowserNotification(r){");
assert(alertFn.includes("playGiReminderSound()"), "due reminder uses the glass sound");
assert(!alertFn.includes("playGiNotifySound()"), "due reminder no longer uses the marimba");
const remFn = sliceBetween(app, "function playGiReminderSound(){", "function playGiChatWhatsAppTone(){");
assert(!!remFn, "playGiReminderSound exists");
assert(remFn.includes("playPhrase(0)"), "plays the glass phrase once");
assert(remFn.includes("playPhrase(1.72)"), "repeats after a pause");
assert(remFn.includes("1567.98") && remFn.includes("1318.51"), "same G6/E6 glass notes as the sample");
assert(remFn.includes("_playGiGlassNote"), "uses the glass voice, not marimba");
assert(!remFn.includes("E G A B C B A G"), "reminder is not the old marimba run");
assert(remFn.includes("master.gain.value = 1.0"), "master gain is louder than the original 0.85");
assert(remFn.includes("0.50") && remFn.includes("0.44"), "glass note velocities are raised");
assert(!remFn.includes("0.18") && !remFn.includes("0.16"), "quiet 0.18/0.16 velocities are gone");

console.log("\n3) lead and chat stay on their own sounds");
assert(app.includes('new Audio("assets/audio/lead-chime-from-recording.mp3")'), "lead chime file stays");
assert(app.includes("function playGiLeadNotifySequence"), "lead notify sequence stays");
assert(app.includes("function playGiChatWhatsAppTone(){"), "chat tone stays");
assert(app.includes("function playGiNotifySound(){"), "old marimba helper remains for other fallbacks");
const leadSeq = sliceBetween(app, "function playGiLeadNotifySequence(options = {}){", "function unlockGiNotifyAudio(force){");
assert(leadSeq.includes("playGiLeadChime()"), "lead still plays the lead chime");
assert(!leadSeq.includes("playGiReminderSound"), "lead does not play the reminder glass");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
