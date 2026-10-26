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
const collect = app.slice(app.indexOf("_collectNewPolicyCards(rec, opts = {}){"), app.indexOf("_mcMigdalPeakMap(rec){"));
assert(!collect.includes("buildDraft("), "ציור הכרטיס לא מחשב את התפתחות הפרמיה");
assert(collect.includes("_mcOfferLastSlots"), "הכרטיס מציג רק פרמיה אחרונה שכבר ידועה");
assert(sliceMethod(app, "_mcOfferLastSlots(rec, policy, cardKey){").includes("_mcKnownOfferLastPremium"), "המילוי נשען על ערך שכבר חושב");
const offerRender = app.slice(app.indexOf("_renderNeedsOffer(rec){"), app.indexOf("_renderNeedsReasons(rec){"));
assert(offerRender.includes("this._mcScheduleOfferLastPremiums(rec);"), "אחרי הציור מתחיל המילוי");
const schedule = app.slice(app.indexOf("_mcScheduleOfferLastPremiums(rec){"), app.indexOf("_mcOfferCardHtml(opts){"));
assert(schedule.includes("beginOfferLastScan") && !schedule.includes("buildDraft("), "המילוי רץ בפרוסות בלי לבנות את כל הטיוטה");
assert(schedule.includes("requestAnimationFrame"), "המילוי מתחיל אחרי שהמסך כבר צויר");

console.log("\n4) פרמיה אחרונה היא תעריף נקי לכל מבוטח");
assert(arrival.includes("offerCoverJobs(policy, person, { cleanTariff: true })"), "סריקת הכרטיס בלי הנחה");
assert(arrival.includes("cleanTariff === true"), "מסלול תעריף נקי");
const projection = sliceMethod(arrival, "function buildProjectionForCover(args){");
assert(projection.includes("applyDiscount") && projection.includes("anchorEngineRows"), "מסמך ההגעה נשאר עם הנחה ויישור");
function loadArrival(quote){
  const sandbox = {
    console,
    location: { href: "https://example.com/app" },
    GiSimulatorQuotes: { quote }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(arrival, sandbox, { filename: "gi-arrival-docs.js" });
  return sandbox.GiArrivalDocs;
}
function tail(tables, policy){
  return box.ui._mcLastPremiumFromTables(tables, policy, "יעקב פרץ");
}
const life = {
  id: "life1", company: "מגדל", type: "ריסק",
  insuredIds: ["p1"], sumInsured: "500000",
  premiumPerInsured: { p1: "80" }
};
const rec = {
  id: "c1",
  payload: {
    flowType: "health",
    primary: { firstName: "יעקב", lastName: "פרץ", idNumber: "307957571", birthDate: "19/01/1993", gender: "זכר" },
    insureds: [{ id: "p1", type: "primary", data: { firstName: "יעקב", lastName: "פרץ", idNumber: "307957571", birthDate: "19/01/1993", gender: "זכר" } }],
    newPolicies: [life]
  }
};
let quotes = 0;
const api = loadArrival((company, product, input) => {
  quotes += 1;
  const age = Number(input.age);
  if(age > 40) return { ok: false };
  return { ok: true, monthlyPremium: 100 + age };
});
const scan = api.beginOfferLastScan(rec, life);
let steps = 0;
while(scan && scan.step(3) !== true){
  steps += 1;
  if(steps > 80) break;
}
const fromScan = tail(scan.tables(), life);
const fromDraft = tail(api.buildDraft(rec).tables, life);
assert(steps > 1, "החישוב נפרס ליותר מצעד אחד");
assert(fromScan && fromScan.monthly === 140 && fromScan.age === 40, "הגיל האחרון הוא תעריף המנוע בלי יישור");
assert(fromDraft && fromDraft.age === 40 && fromDraft.monthly !== fromScan.monthly, "טבלת מסמך ההגעה נשארת מיושרת לשנה הראשונה");
const discounted = Object.assign({}, life, {
  simDiscountPerInsured: { p1: { year1Pct: 50, years: 20, schedule: Array(20).fill(50) } }
});
const discRec = {
  id: "c1",
  payload: Object.assign({}, rec.payload, { newPolicies: [discounted] })
};
const discScan = api.beginOfferLastScan(discRec, discounted);
let discSteps = 0;
while(discScan && discScan.step(3) !== true){
  discSteps += 1;
  if(discSteps > 80) break;
}
const cleanDisc = tail(discScan.tables(), discounted);
assert(cleanDisc && cleanDisc.monthly === 140 && cleanDisc.age === 40, "הנחה בתיק לא נכנסת לפרמיה האחרונה");
const people = api.offerLastPeople({
  payload: {
    insureds: [
      { id: "p1", type: "primary", data: { firstName: "יעקב", lastName: "פרץ", birthDate: "19/01/1993", gender: "זכר" } },
      { id: "s1", type: "spouse", data: { firstName: "נועה", lastName: "פרץ", birthDate: "01/01/1995", gender: "נקבה" } }
    ]
  }
}, { id: "life2", type: "ריסק", insuredIds: ["p1", "s1"] });
assert(Array.isArray(people) && people.length === 2 && people[0].fullName === "יעקב פרץ" && people[1].fullName === "נועה פרץ", "פרמיה אחרונה נפרדת לכל מבוטח");
assert(app.includes("_mcOfferLastSlots(rec, policy, cardKey){") && app.includes('named.length > 1 ? ("פרמיה אחרונה · " + who)'), "הכרטיס מציג שורה לכל מבוטח");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
