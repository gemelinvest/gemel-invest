/* טיימר שיקוף בתיק לקוח — ניגודיות גבוהה על כותרת נאבי.
   הרצה: node _test-mirror-live-timer-contrast.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const navy = fs.readFileSync(path.join(ROOT, "gi-navy-lit.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) live timer contrast");
assert(/\.cfFile__liveTimer\.is-live\{[\s\S]*?background:\s*[\s\S]*?#ffffff/i.test(css), "live timer uses solid light card");
assert(css.includes("font-size: 22px") || css.includes("font-size:22px"), "timer digits are larger");
assert(/\.cfFile__liveTimerStatus\{[\s\S]*?opacity:\s*1/.test(css), "status text is fully opaque");
assert(css.includes("color: #064e3b") || css.includes("color:#064e3b"), "timer digits use dark emerald");
assert(navy.includes("#customerFull.cfFile .cfFile__liveTimer.is-live"), "navy header override exists");
assert(navy.includes("background: linear-gradient(180deg, #ffffff 0%, #f3fbf7 100%) !important"), "navy forces solid light fill");
assert(html.includes("giLiveTimerVis=1"), "css/html cache bumped");
assert(sw.includes("live-timer-vis-v1"), "service-worker cache bumped");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
