/* GI-REMINDER 2026-09-15 — מודאל תזכורות קומפקטי, בלי פעמון אמוג'י מצועצע.
   הרצה: node _test-reminder-compact-ui.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260915-reminder-compact-v1";
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
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const unify = fs.readFileSync(path.join(ROOT, "theme-unify-flat.css"), "utf8");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + TAG), "service-worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD");

console.log("\n2) compact panel, not a large empty stage");
const panel = sliceBetween(css, "/* ===== REMINDER MODAL ===== */", "/* Type grid */");
assert(panel.includes("max-width:380px"), "panel max-width is 380px");
assert(!panel.includes("max-width:500px"), "old 500px panel is gone");
assert(css.includes("max-height:220px"), "open list is shorter");
assert(!css.includes("max-height:370px"), "old 370px list height is gone");
assert(!css.includes(".giReminderModal__listEmpty span:first-child{ font-size:32px; }"), "jumbo empty icon size is gone");
assert(unify.includes("max-width: 380px !important"), "unify theme keeps the compact width");

console.log("\n3) empty state is a quiet outline bell, not a 3D emoji");
const empty = sliceBetween(html, "id=\"giReminderListEmpty\"", "id=\"giReminderModalFoot\"");
assert(empty.includes("giReminderModal__emptyIcon"), "empty state uses the outline SVG");
assert(!empty.includes("🔔"), "empty state has no emoji bell");
assert(empty.includes("אין תזכורות פתוחות"), "empty copy stays");
assert(!empty.includes("תזכורות פתוחות</div>"), "duplicate list heading is gone");

console.log("\n4) list step has no empty footer bar");
const showStep = sliceBetween(app, "showStep(step){", "startNew(){");
assert(showStep.includes("this.els.foot.hidden = (step === \"list\")"), "footer hides on the list step");
assert(css.includes(".giReminderModal .modal__kicker{ display:none; }"), "GEMEL INVEST kicker is hidden");

console.log("\n5) reminder engines stay");
assert(app.includes("function playGiReminderSound(){"), "glass reminder sound stays");
assert(app.includes("playGiReminderSound()"), "due alert still plays it");
assert(html.includes("id=\"giReminderLinkQuery\""), "link search stays");
assert(app.includes("customerOwnedByCurrentAgent(rec)"), "ownership helper stays");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
