/* GI-LEAD-CHIME — תזכורת משמיעה את onyx-alert.mp3 פעם אחת בעוצמה מלאה.
   ליד חדש משמיע אותו פעם אחת, מחכה 1500ms, ומשמיע שוב.
   הרצה: node _test-reminder-soft-glass.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261007-lead-dup-v1";
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

console.log("\n2) reminder plays the phone chime once at full volume");
const alertFn = sliceBetween(app, "_playAlertSound(){", "_sendBrowserNotification(r, options = {}){");
assert(alertFn.includes("playGiReminderSound()"), "due reminder uses the prepared chime");
assert(alertFn.includes("silent: !!silent"), "desktop reminder is quiet only after the chime starts");
assert(!alertFn.includes("playGiNotifySound()"), "due reminder no longer uses the marimba");
const remFn = sliceBetween(app, "function playGiReminderSound(){", "function playGiChatWhatsAppTone(){");
assert(!!remFn, "playGiReminderSound exists");
assert(remFn.includes("playGiPreparedChime(1)"), "reminder plays the chime once");
assert(!remFn.includes("playGiPreparedChime(2)"), "reminder does not play the lead pair");
const chimeFn = sliceBetween(app, "function playGiPreparedChimeElement(){", "function playGiReminderSound(){");
assert(chimeFn.includes("audio.volume = 1"), "chime volume is the browser maximum");
assert(chimeFn.includes("GI_LEAD_CHIME_GAP_MS"), "the second play waits after the first one ends");
assert(app.includes('const GI_PREPARED_CHIME_SRC = "phone/onyx-alert.mp3?v=1"'), "uses the phone alert file");
assert(html.includes("giLeadChime=1"), "index.html reloads app.js for the new chime");

console.log("\n3) a new lead plays once, waits 1.5s, then plays again");
assert(app.includes("function playGiLeadNotifySequence"), "lead notify sequence stays");
assert(app.includes("function playGiChatWhatsAppTone(){"), "chat tone stays");
assert(app.includes("function playGiNotifySound(){"), "old marimba helper remains for other fallbacks");
const leadSeq = sliceBetween(app, "function playGiLeadNotifySequence(options = {}){", "function unlockGiNotifyAudio(force){");
assert(leadSeq.includes("playGiPreparedChime(2)"), "lead plays the prepared chime twice");
assert(leadSeq.includes("tryGiSynthChime()"), "blocked playback still falls back to the synth chime");
assert(!leadSeq.includes("playGiReminderSound"), "lead does not call the reminder wrapper");
assert(app.includes("const GI_LEAD_CHIME_GAP_MS = 1500"), "the second lead chime waits 1500ms after the first ends");
assert(app.includes("playGiPreparedChimeElement._unlock"), "the chime file is unlocked with the rest of the notify audio");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
