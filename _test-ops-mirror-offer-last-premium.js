/* GI-OPS — הפרמיה האחרונה בכרטיס פוליסה מוצעת נלקחת משורת הגיל האחרונה
   בהתפתחות הפרמיה של אותה פוליסה, לא משיא הפרמיה.
   הרצה: node _test-ops-mirror-offer-last-premium.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
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

function sliceMethod(src, signature){
  const start = src.indexOf(signature);
  if(start < 0) return "";
  let i = src.indexOf("{", start);
  if(i < 0) return "";
  let depth = 0;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const arrival = fs.readFileSync(path.join(ROOT, "gi-arrival-docs.js"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-arrival-docs.js")]).status === 0, "מנוע ההתפתחות לא נשבר");
assert(!app.includes("quoteOnce("), "שיחת השיקוף לא קוראת למנוע התעריף בעצמה");

function safeTrim(v){ return String(v == null ? "" : v).trim(); }
const box = { safeTrim, console };
box.ui = {};
vm.createContext(box);
vm.runInContext(
  "ui._mcPersonMatchesLabel = function " + sliceMethod(app, "_mcPersonMatchesLabel(person, label){").replace("_mcPersonMatchesLabel", "") + ";\n" +
  "ui._mcLastAgeMonthly = function " + sliceMethod(app, "_mcLastAgeMonthly(table){").replace("_mcLastAgeMonthly", "") + ";\n" +
  "ui._mcLastPremiumFromTables = function " + sliceMethod(app, "_mcLastPremiumFromTables(tables, policy, insuredLabel){").replace("_mcLastPremiumFromTables", "") + ";\n" +
  "ui._mcOfferProductOpensDisclosure = function " + sliceMethod(app, "_mcOfferProductOpensDisclosure(product){").replace("_mcOfferProductOpensDisclosure", "") + ";",
  box
);

console.log("\n2) הפרמיה האחרונה היא שורת הגיל האחרון, לא השיא");
const policy = { id: "p1", company: "הפניקס", type: "מחלות קשות" };
const tables = [{
  policy,
  company: "הפניקס",
  person: { fullName: "איתן חופי" },
  coverRows: [{
    projection: {
      ok: true,
      source: "engine",
      rows: [
        { age: 30, monthly: 40 },
        { age: 50, monthly: 210 },
        { age: 67, monthly: 90 }
      ]
    }
  }]
}];
const last = box.ui._mcLastPremiumFromTables(tables, policy, "מבוטח משני ילד - איתן חופי");
assert(last && last.monthly === 90 && last.age === 67, "נלקחת הפרמיה של הגיל האחרון");
assert(box.ui._mcLastPremiumFromTables(tables, { id: "other", company: "מגדל", type: "ריסק" }, "איתן חופי") == null, "פוליסה אחרת לא נספרת");
const stored = [{
  policy,
  person: { fullName: "איתן חופי" },
  coverRows: [{ projection: { ok: true, source: "stored", rows: [{ age: 30, monthly: 40 }, { age: 67, monthly: 90 }] } }]
}];
assert(box.ui._mcLastPremiumFromTables(stored, policy, "איתן חופי") == null, "מקור stored לא מייצר פרמיה אחרונה");
const twoPeople = [
  { policy, person: { fullName: "איתן חופי" }, coverRows: [{ projection: { ok: true, source: "engine", rows: [{ age: 40, monthly: 20 }, { age: 60, monthly: 30 }] } }] },
  { policy, person: { fullName: "נועה חופי" }, coverRows: [{ projection: { ok: true, source: "engine", rows: [{ age: 10, monthly: 15 }, { age: 25, monthly: 18 }] } }] }
];
const child = box.ui._mcLastPremiumFromTables(twoPeople, policy, "ילד - איתן חופי");
assert(child && child.monthly === 30 && child.age === 60, "נבחר המבוטח ששמו על הכרטיס");
assert(box.ui._mcLastPremiumFromTables(twoPeople, policy, "") == null, "בלי שם מבוטח לא מערבבים שתי פרמיות");

console.log("\n3) לחיצה לפי סוג מוצר");
assert(box.ui._mcOfferProductOpensDisclosure("מחלות קשות") === true, "מחלות קשות נפתח לפי שם המוצר");
assert(box.ui._mcOfferProductOpensDisclosure("ריסק") === true, "ריסק נפתח לפי שם המוצר");
assert(box.ui._mcOfferProductOpensDisclosure("ריסק משכנתא") === true, "ריסק משכנתא נפתח לפי שם המוצר");
assert(box.ui._mcOfferProductOpensDisclosure("סרטן") === true, "סרטן נפתח לפי שם המוצר");
assert(box.ui._mcOfferProductOpensDisclosure("בריאות") === false, "המילה בריאות לא פותחת גילוי");

assert(arrival.includes("function buildPeopleTables(draft){"), "טבלאות ההתפתחות נשארו במסמך ההגעה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
