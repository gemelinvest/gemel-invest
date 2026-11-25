/* מסך הבית בטלפון לא חוזר על סריקת כל התיקים בכל עשר שניות.
   הרצה: node _test-phone-home-heavy.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
const phone = fs.readFileSync(path.join(ROOT, "phone/phone.js"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "phone/sw.js"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
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

console.log("1) the home screen still loads, and a repeat waits 45 seconds");
const refresh = sliceBetween(phone, "async function refreshHomeMetrics(options) {", "async function enterApp()");
assert(refresh.includes("loadReport(true)"), "the first load still reads a fresh sales report");
assert(refresh.includes("loadNet(israelRange())"), "sold today still uses the existing premium function");
assert(refresh.includes("loadGoalCard()"), "the goal card still uses the existing month figures");
assert(refresh.includes("countIncomingLeads()"), "the lead count still runs on the short timer");
assert(refresh.includes("if (heavy)"), "a fresh result skips the heavy reads");
const heavyAt = refresh.indexOf("if (heavy)");
const soldAt = refresh.indexOf("loadNet(israelRange())");
const goalAt = refresh.indexOf("loadGoalCard()");
const stampAt = refresh.indexOf("state.homeHeavyAt = Date.now()");
assert(heavyAt >= 0 && soldAt > heavyAt && goalAt > soldAt && stampAt > goalAt, "sold today and the goal card sit inside the heavy read");
assert(phone.includes("homeTimer") && phone.includes("10000"), "the home timer stays at ten seconds");
assert(phone.includes("refreshHomeMetrics({ forceHeavy: true })"), "a new sale refreshes the home figures");
assert(phone.includes('rpc("gi_dashboard_net_premium"'), "the premium function itself is unchanged");

const dueSrc = sliceBetween(phone, "function homeHeavyDue(forceHeavy, now) {", "async function refreshHomeMetrics");
const sandbox = { state: { homeHeavyAt: 0 } };
vm.createContext(sandbox);
vm.runInContext(dueSrc + "\nthis.homeHeavyDue = homeHeavyDue;", sandbox);
assert(sandbox.homeHeavyDue(false, 1000) === true, "the first open reads immediately");
assert(sandbox.homeHeavyDue(true, 1000) === true, "a sale forces a new read");
sandbox.state.homeHeavyAt = 10000;
assert(sandbox.homeHeavyDue(false, 20000) === false, "a repeat inside 45 seconds keeps the numbers on screen");
assert(sandbox.homeHeavyDue(false, 10000 + 45000) === true, "a repeat after 45 seconds reads again");

console.log("2) an open phone does not scan twice, and leads stay on their path");
const check = sliceBetween(sw, "async function checkSales() {", "self.addEventListener(\"message\"");
assert(check.indexOf("await pageIsAwake()") < check.indexOf("fetchLeadRows"), "an awake phone returns before the lead scan");
assert(check.includes("scheduleSaleCheck(20000)"), "a locked phone still checks within 20 seconds");
assert(sw.includes('description.ilike.*proposalPremiumAt*'), "a locked phone still sees a new sale");
assert(app.includes('fetchAll({ scope: "mine", skipDescription: true })'), "the minute lead poll is unchanged");
assert(app.includes('fetchAll({ scope: "mine" })'), "opening my leads still loads the description");
assert(app.includes("gi_dashboard_net_premium"), "the desktop premium engine is still there");

if (failed) {
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
