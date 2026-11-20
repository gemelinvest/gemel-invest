/* תצוגת פרודוקציה בתיק: רק ערך שנשמר מהדוח, בלי ניחוש.
   Run: node _test-production-file-facts.js
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

function safeTrim(v){
  return String(v ?? "").trim();
}

function loadFacts(app){
  const start = app.indexOf("    productionFileFacts(p){");
  const end = app.indexOf("    productionFactsHtml(lines){", start);
  assert(start > 0 && end > start, "facts helper is in app.js");
  const chunk = app.slice(start, end).trim();
  return eval("({" + chunk + "})").productionFileFacts;
}

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "_test-production-file-facts.js")]).status === 0, "test syntax");

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const facts = loadFacts(app);
const prodStart = app.indexOf("    renderProductionPolicyTable(rec){");
const prodFn = app.slice(prodStart, app.indexOf("    renderPolicyTableView(rec, policies){", prodStart));
assert(prodFn.includes("person.fullName") && !prodFn.includes("person.idNumber"), "insured column is the name only");
assert(app.includes("Array.isArray(p.notes)"), "production detail still reads stored notes");
assert(prodFn.includes("ריסק משכנתא"), "mortgage rows stay in the production sort");
assert(!prodFn.includes("12,400.00") && !prodFn.includes("יקיר יעיש"), "sample picture numbers are not written into the file");

console.log("\n2) a stored pension note keeps its own value");
const lines = facts.call({ logicalHealthCoverLabel: (name) => name }, {
  company: "איילון",
  type: "חיסכון",
  policyNumberFull: "007073742",
  premiumMonthly: "58.50",
  people: [{ fullName: "יקיר יעיש", idNumber: "203348156" }],
  covers: [{ name: "חיסכון", premium: "58.50" }],
  notes: [
    "מסגרת: מנהלים",
    "יתרת כספים: 86.50",
    "דמי ניהול שנגבו: -140.20",
    "מסלול כללי: 60.00",
    "מסלול מניות",
    "הערה שנשמרה כמו שהיא"
  ]
});
const by = (section, label) => lines.filter((row) => row.section === section && row.label === label);
assert(by("pension", "יתרת כספים")[0] && by("pension", "יתרת כספים")[0].value === "86.50", "balance stays 86.50");
assert(by("pension", "דמי ניהול שנגבו")[0] && by("pension", "דמי ניהול שנגבו")[0].value === "-140.20", "a negative fee is not dropped");
assert(by("policy", "מסגרת")[0] && by("policy", "מסגרת")[0].value === "מנהלים", "frame stays on the policy");
assert(by("pension", "מסלול כללי")[0] && by("pension", "מסלול כללי")[0].value === "60.00", "track amount stays on that track");
assert(lines.some((row) => row.section === "pension" && row.label === "מסלול מניות" && row.value === "מסלול מניות"), "a track name without an amount is not given one");
assert(lines.some((row) => row.section === "note" && row.value === "הערה שנשמרה כמו שהיא"), "an unknown note stays a note");
assert(!lines.some((row) => row.section === "pension" && row.label === "הערה שנשמרה כמו שהיא"), "an unknown note is not pension");
assert(by("person", "ת״ז")[0] && by("person", "ת״ז")[0].value === "203348156", "stored id is shown on the person");
assert(!lines.some((row) => row.label === "סכום" || row.label === "סכום ביטוח"), "premium is not copied into the sum");

console.log("\n3) empty report fields stay empty");
const bare = facts.call({}, { company: "הראל", type: "ריסק משכנתא", policyNumber: "7654321", premiumMonthly: "1227.03" });
assert(bare.some((row) => row.label === "מספר פוליסה" && row.value === "7654321"), "mortgage policy number is the stored number");
assert(!bare.some((row) => row.section === "pension"), "a company without pension notes gets no pension section");
assert(!bare.some((row) => row.section === "cover"), "no cover is invented");
assert(!bare.some((row) => row.label === "סוכן" || row.label === "סיום ביטוח"), "missing agent and end date stay missing");

const detailsOnly = facts.call({}, {
  covers: [],
  coverDetails: [{ name: "ביטוח משכנתא", premiumMonthly: "1227.03", sumInsured: "500000" }]
});
assert(detailsOnly.some((row) => row.section === "cover" && row.value === "ביטוח משכנתא"), "cover details are used only when covers are empty");
assert(detailsOnly.some((row) => row.label === "פרמיה חודשית" && row.value === "1227.03"), "cover premium stays the stored premium");
assert(detailsOnly.some((row) => row.label === "סכום" && row.value === "500000"), "cover sum stays the stored sum");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
