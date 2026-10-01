/* בריאות מוצעת: פרמיה לפני ואחרי לכל כיסוי. לפני בשחור, אחרי בירוק.
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
const offer = app.slice(app.indexOf("if(opts.withDisclosure){"), app.indexOf("const peak = opts.migdalPeaks"));
assert(offer.includes('label === "כיסויים שנרכשו"'), "שורת הכיסויים הארוכה לא נכנסת לכרטיס");
assert(css.includes(".mcOfferCard__fact:nth-child(5) strong{") && /\.mcOfferCard__fact:nth-child\(5\) strong\{[^}]*color:#111;/.test(css), "פרמיה לפני בשחור");
assert(/\.mcOfferCard__fact--after strong\{[^}]*color:#0f7a4a;/.test(css), "פרמיה אחרי בירוק");
assert(css.includes(".mcCoverDisc__pay--after{color:#0f7a4a;}"), "כיסוי אחרי בירוק");
console.log(failed ? "\nFAILED " + failed : "\nOK " + passed);
process.exit(failed ? 1 : 0);
