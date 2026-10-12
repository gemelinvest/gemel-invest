/* GI-OPS 2026-10-12 — בהתאמת צרכים: התפתחות פרמיה נפרדת לכל מבוטח
   לכל מוצר שרכש, לפי חברת הביטוח והנתונים שלו.
   הרצה: node _test-ops-premia-per-insured-product.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20261007-lead-dup-v1";
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

function loadModule(extra){
  const src = read("gi-arrival-docs.js");
  const sandbox = Object.assign({
    console,
    location: { href: "https://example.com/app", pathname: "/" },
    Auth: { current: { name: "סוכן בדיקה", id: "a_1" } }
  }, extra || {});
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: "gi-arrival-docs.js" });
  return sandbox.GiArrivalDocs;
}

const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");
const modSrc = read("gi-arrival-docs.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-arrival-docs.js")]).status === 0, "node --check gi-arrival-docs.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("&giPremiaEach=1"), "index.html app.js נטען מחדש אחרי פיצול התפתחות הפרמיה");
assert(sw.includes("premia-each-v1"), "service-worker cache לפיצול התפתחות הפרמיה");
assert(app.includes("giPremiaEach=1"), "מודול מסמכי ההגעה נטען מחדש");

console.log("\n2) אין איחוד של מבוטחים/חברות/מוצרים לדוח אחד");
assert(!modSrc.includes('families: ["health", "ci", "cancer"]'), "בריאות/מחלות קשות/סרטן לא מתאחדים לדוח אחד");
assert(!modSrc.includes('families: ["life", "mortgage"]'), "חיים ומשכנתא לא מתאחדים בלי מבוטח");
assert(modSrc.includes("premiaFamilyLabel"), "תווית מוצר לכל דוח");
assert(modSrc.includes("personName"), "שם המבוטח בכותרת הדוח");
assert(modSrc.includes("items: [entry]"), "כל שורה בטבלה היא דוח נפרד");
assert(modSrc.includes("[group.personName, group.label, group.company, group.reportTitle]"), "כותרת = מבוטח + מוצר + חברה");

console.log("\n3) לכל מבוטח דוח לפי המוצר והחברה שרכש");
const api = loadModule({});
const rec = {
  id: "c1",
  payload: {
    flowType: "health",
    primary: {
      firstName: "יעקב", lastName: "פרץ", idNumber: "307957571",
      birthDate: "19/01/1993", gender: "זכר"
    },
    insureds: [
      { id: "p1", type: "primary", label: "יעקב פרץ", data: {
        firstName: "יעקב", lastName: "פרץ", idNumber: "307957571",
        birthDate: "19/01/1993", gender: "זכר"
      } },
      { id: "s1", type: "spouse", label: "רות פרץ", data: {
        firstName: "רות", lastName: "פרץ", idNumber: "111111111",
        birthDate: "02/02/1995", gender: "נקבה"
      } }
    ],
    newPolicies: [
      {
        id: "life1", company: "מגדל", type: "ריסק", productName: "ביטוח חיים",
        insuredIds: ["p1"], sumInsured: "1000000",
        premiumPerInsured: { p1: "80" }
      },
      {
        id: "health1", company: "הפניקס", type: "בריאות", productName: "בריאות",
        insuredIds: ["p1"],
        premiumPerInsured: { p1: "46.76" }
      },
      {
        id: "health2", company: "מנורה", type: "בריאות", productName: "בריאות",
        insuredIds: ["s1"],
        premiumPerInsured: { s1: "39.75" }
      }
    ]
  }
};

const draft = api.buildDraft(rec);
const groups = api.premiaGroups(draft);
assert(groups.length === 3, "שלושה דוחות — מוצר לכל מבוטח");
assert(groups.every((g) => g.items.length === 1), "אף דוח לא מאחד שני מוצרים");
assert(groups.every((g) => g.people.length === 1), "אף דוח לא מאחד שני מבוטחים");
const byKey = {};
groups.forEach((g) => { byKey[g.label + "|" + g.company + "|" + g.personName] = g; });
assert(!!byKey["חיים|מגדל|יעקב פרץ"], "ליעקב דוח חיים במגדל");
assert(!!byKey["בריאות|הפניקס|יעקב פרץ"], "ליעקב דוח בריאות בהפניקס");
assert(!!byKey["בריאות|מנורה|רות פרץ"], "לרות דוח בריאות במנורה");
assert(!groups.some((g) => / \/ /.test(g.company || "")), "אין כותרת חברה משולבת");

const htmlOut = api.renderPremiaHtml(draft);
assert(htmlOut.includes("יעקב פרץ - חיים - מגדל"), "כותרת דוח החיים של יעקב");
assert(htmlOut.includes("יעקב פרץ - בריאות - הפניקס"), "כותרת דוח הבריאות של יעקב");
assert(htmlOut.includes("רות פרץ - בריאות - מנורה"), "כותרת דוח הבריאות של רות");
assert(htmlOut.includes("הצעת מחיר והתפתחות פרמיה"), "דוח חיים שומר את כותרת ההצעה");
assert((htmlOut.match(/אישור המועמד לביטוח/g) || []).length === 3, "לכל דוח יש אישור מועמד משלו");

const yaakovHealth = groups.find((g) => g.label === "בריאות" && g.company === "הפניקס");
const ruthHealth = groups.find((g) => g.label === "בריאות" && g.company === "מנורה");
assert(yaakovHealth && Math.abs(yaakovHealth.items[0].year1.used - 46.76) < 0.02, "פרמיית יעקב בהפניקס לפי הנתונים שלו");
assert(ruthHealth && Math.abs(ruthHealth.items[0].year1.used - 39.75) < 0.02, "פרמיית רות במנורה לפי הנתונים שלה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
