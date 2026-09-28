/* בריאות מוצעת: פרמיה לפני ואחרי לכל כיסוי, וטקסט לבן על תיבות הפרמיה.
   הרצה: node _test-ops-offer-cover-premium.js
*/
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "app.css"), "utf8");
let failed = 0, passed = 0;
function assert(c, m){ if(c){ passed++; console.log("  PASS  " + m); } else { failed++; console.error("  FAIL  " + m); } }
assert(spawnSync(process.execPath, ["--check", path.join(__dirname, "app.js")]).status === 0, "node --check app.js");
const block = app.slice(app.indexOf("_mcHealthCoverDiscountHtml(rec, p){"), app.indexOf("_mcPledgeMarkerHtml(p){"));
assert(block.includes("פרמיה לפי כיסוי"), "כותרת כיסויים");
assert(block.includes("לפני") && block.includes("אחרי"), "לפני ואחרי לכל כיסוי");
assert(block.includes("getHealthCoverGrossPremiumsByName"), "פרמיית כיסוי מהאשף");
assert(!block.includes(">נרכש<"), "בלי סימון נרכש בלי סכום");
const parity = app.slice(app.indexOf("_mcNewPolicyFileParityRows(rec, p){"), app.indexOf("_collectNewPolicyCards(rec"));
assert(parity.includes('!== "בריאות"'), "שורת נרכש לא נכנסת לבריאות");
assert(css.includes(".mcOfferCard__fact--after strong{") && css.includes("color:#fff;"), "טקסט לבן על תיבת הפרמיה");
assert(css.includes("background:var(--brandC);"), "רקע כחול לתיבה");
console.log(failed ? "\nFAILED " + failed : "\nOK " + passed);
process.exit(failed ? 1 : 0);
