/* GI-OPS 2026-09-14 — יישור שורות פוליסות מוצעות + טופס כלל ריסק זוגי משתי פוליסות יחיד.
   הרצה: node _test-ops-policy-row-clal-form.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260914-pledge-years-digit-v1";
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

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

const app = read("app.js");
const css = read("app.css");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-ops-policy-row-clal-form.js")]).status === 0, "node --check this test");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes('BUILD = "' + APP_TAG + '"'), "app.js BUILD");

console.log("\n2) שורות פוליסות — כותרת ונתון על אותה רשת");
const head = sliceBetween(app, "_mcPolicyRowHead(kind){", "_mcPolicyRowHtml(opts){");
assert(head.includes('class="mcPolicyRow__main"'), "כותרת השורות באותו מיכל כמו הנתונים");
assert(head.includes("mcPolicyRow__cell--money"), "עמודות כסף בכותרת מסומנות כמו בנתונים");
assert(css.includes(".mcPolicyRow--head .mcPolicyRow__main"), "כותרת משתמשת באותה גריד");
assert(!/mcPolicyRow__cell--money\{[^}]*direction:\s*ltr/.test(css), "עמודת כסף לא נדחפת לשמאל נגד RTL");
assert(css.includes("text-align:start"), "יישור לתחילת העמודה (ימין ב-RTL)");

console.log("\n3) לפני/אחרי הנחה — בלי simDiscount נשאר הסכום שנשמר");
const afterFn = sliceBetween(app, "_mcPremiumAfter(p){", "_mcNeedsNav(primaryAct, primaryLabel, secondaryAct, secondaryLabel){");
assert(afterFn.includes("return this._mcPremiumBefore(p)"), "בלי הנחה בסימולטור אחרי=לפני");
assert(app.includes("_mcSimAfterTotal(p){"), "אחרי הנחה מגיע מ-simDiscount כשיש");

console.log("\n4) כלל ריסק — שתי פוליסות יחיד נפתחות כטופס זוגי");
assert(app.includes("isClalLifeJoinPolicy(policy){"), "מזהה ריסק/חיים של כלל");
assert(app.includes("const twoPeople = matched.length >= 2 || insuredIds.size >= 2"), "שני מבוטחים = טופס זוגי");
const join = sliceBetween(app, "_mcJoinFormTypeForPolicy(p, rec){", "_mcCollectHealthFormRail(rec){");
assert(join.includes("CD.qualifiesForClalLifeCoupleForm(couplePayload, null)"), "מסילת הטפסים בודקת את כל פוליסות כלל יחד");
assert(join.includes("_mirrorGetNewPoliciesRaw(rec)"), "לא בודקים פוליסה יחידה בבידוד לטופס הזוגי");

const sandbox = { console };
sandbox.window = sandbox;
vm.runInNewContext(`
  function safeTrim(v){ return String(v == null ? "" : v).trim(); }
  const CD = {
    listOfficialJoinFormPolicies(payload){ return Array.isArray(payload?.newPolicies) ? payload.newPolicies : []; },
    officialJoinFormInPeriod(){ return true; },
    ${sliceBetween(app, "isClalLifeJoinPolicy(policy){", "qualifiesForMenoraCiForm(payload, rec){")}
  };
  this.CD = CD;
`, sandbox);

const twoSingles = [
  { id: "npol_a", company: "כלל", type: "ריסק", insuredMode: "single", insuredIds: ["ins_1"], insuredId: "ins_1" },
  { id: "npol_b", company: "כלל", type: "ריסק", insuredMode: "single", insuredIds: ["ins_2"], insuredId: "ins_2" }
];
assert(sandbox.CD.qualifiesForClalLifeCoupleForm({ newPolicies: twoSingles }, null) === true, "עאמר+ריאן: שתי פוליסות יחיד נפתחות כטופס זוגי");
assert(sandbox.CD.qualifiesForClalLifeCoupleForm({ newPolicies: [twoSingles[0]] }, null) === false, "פוליסת כלל יחידה אחת עדיין לא נחשבת זוגית");
assert(sandbox.CD.isClalLifeJoinPolicy(twoSingles[0]) === true, "ריסק כלל מזוהה");
assert(sandbox.CD.isClalLifeJoinPolicy({ company: "כלל", type: "בריאות" }) === false, "בריאות כלל לא נחשבת ריסק");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
