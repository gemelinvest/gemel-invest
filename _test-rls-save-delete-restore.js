/* GI-RLS-SAVE-DELETE 2026-10-07
   תיקוני האבטחה גרמו למחיקת הצעה להיראות כהצלחה, ואז סיום הקמת לקוח נכשל.
   הרצה: node _test-rls-save-delete-restore.js
   לא נוגע בנוסחת פרמיה / כרטיסי דשבורד.
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
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

function extractMethod(src, name){
  const re = new RegExp("\\n\\s*(async\\s+)?" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\(");
  const m = re.exec(src);
  if(!m) return "";
  const start = m.index;
  let i = start + m[0].length;
  let paren = 1;
  let inStr = null;
  for(; i < src.length && paren > 0; i += 1){
    const ch = src[i];
    if(inStr){
      if(ch === "\\"){ i += 1; continue; }
      if(ch === inStr) inStr = null;
      continue;
    }
    if(ch === '"' || ch === "'" || ch === "`"){ inStr = ch; continue; }
    if(ch === "(") paren += 1;
    else if(ch === ")") paren -= 1;
  }
  while(i < src.length && /\s/.test(src[i])) i += 1;
  if(src[i] !== "{") return "";
  let depth = 0;
  for(; i < src.length; i += 1){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

console.log("1) syntax");
const appCheck = spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")], { encoding: "utf8" });
assert(appCheck.status === 0, "node --check app.js");
const wizCheck = spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")], { encoding: "utf8" });
assert(wizCheck.status === 0, "node --check gi-wizard.js");

const app = read("app.js");
const wizard = read("gi-wizard.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("\n2) cache — התיקון מגיע לנציג אחרי רענון, בלי להחליף תג קיים");
assert(app.includes('const BUILD = "20261007-lead-dup-v1"'), "BUILD tag stays");
assert(html.includes("app.js?v=20261007-lead-dup-v1&giSign=29"), "index.html keeps the existing app.js tag");
assert(html.includes("&giRlsSave=1"), "index.html adds giRlsSave so agents get the new app.js");
assert(sw.includes("20261007-lead-dup-v1"), "service-worker keeps the existing tag");
assert(sw.includes("rls-save-v1"), "service-worker adds rls-save-v1");

console.log("\n3) מחיקה לא נחשבת הצלחה בלי שורה שנמחקה");
const del = extractMethod(app, "deleteRowByIdSafe");
assert(del.includes("knownExists"), "preload respects knownExists");
assert(del.includes("ROW_NOT_VISIBLE"), "hidden/RLS row is not treated as already deleted");
assert(del.includes("deletedCount"), "tracks how many rows the server actually deleted");
assert(del.includes('Prefer: "return=representation"'), "REST delete still asks for the deleted row");
assert(del.includes("deletedCount !== 1"), "empty REST 200 is not a successful delete");
assert(del.includes("DELETE_VERIFY_READ_FAILED") || del.includes("DELETE_VERIFY_FAILED"), "verify still runs");
assert(!/await this\.restRequest\([\s\S]*DELETE[\s\S]*\}\);\s*\} catch\(restErr\)/.test(del.replace(/\s+/g, " ")) || del.includes("deletedCount !== 1"), "REST fallback checks representation");

console.log("\n4) מחיקת הצעה — אם הרשומה אצלנו במסך, השרת חייב לאשר");
const purge = extractMethod(app, "_purgeProposalFromServer");
assert(purge.includes("knownExists: !!rec"), "proposal purge tells delete the row should exist");
assert(purge.includes("allowMissing: !rec"), "skip-missing only when we have no local record");
assert(app.includes("State.data.proposals = prevProposals"), "failed delete restores the list");
assert(app.includes("ROW_NOT_VISIBLE"), "hidden-row error has a dedicated code");
assert(app.includes("ההצעה לא נראית בשרת"), "hidden-row error is shown in Hebrew");

console.log("\n5) סיום הקמת לקוח — הצעה נשארת אם השמירה נכשלה");
const saveCust = wizard.slice(wizard.indexOf("async saveCompletedCustomer(){"), wizard.indexOf("stepCompletionMap(stepId){"));
assert(saveCust.includes("if(!verifiedOnServer)"), "finish verifies the customer on the server");
assert(saveCust.includes("ההצעה נשארה ברשימת ההצעות"), "failed finish keeps the proposal");
assert(saveCust.includes("_purgeProposalFromServer"), "draft purge only after verified save");

console.log("\n6) כניסה PIN לא נשברת, סשן מנסה שוב, 401 נופל חזרה ל-anon");
assert(app.includes("Best-effort Auth session"), "PIN login stays best-effort");
assert(app.includes("A failed session must not block PIN login"), "failed session does not block login");
assert(app.includes("await openAgentSession(matched, Auth._sessionPin"), "login still awaits session");
assert(app.includes("return await tryOpen()"), "session open retries once");
assert(extractMethod(app, "isAuthTokenError").includes("401"), "detects expired/invalid JWT");
assert(extractMethod(app, "dropLocalAuthSession").includes('scope: "local"'), "clears only the local session");
assert(extractMethod(app, "upsertSingleRow").includes("_retriedAnon"), "customer/proposal upsert retries after 401");
assert(extractMethod(app, "restRequest").includes("res.status === 401"), "REST retries after 401");

console.log("\n7) לוגיקת דשבורד / פרמיה לא זזה");
assert(app.includes("wizardSaleAfterDiscount(p)"), "month/today still use after-discount");
assert(app.includes("_isHealthOrRiskWizardSale(p)"), "today card still health+risk only");
assert(app.includes("_dashboardSaleStamp"), "sale stamp helper stays");
assert(app.includes("getMonthToDateRange"), "month range helper stays");
assert(app.includes("accumulateCustomerIntoAgg"), "month aggregator stays");
assert(wizard.includes("getPolicyPremiumAfterDiscount"), "wizard after-discount engine stays");

if(failed){
  console.error("\nFAILED " + failed + " / " + (failed + passed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
