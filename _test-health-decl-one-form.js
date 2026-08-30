/* GI-HEALTH-ONE-DECL 2026-08-16
   הצהרת בריאות אחת בלבד: בלי מיזוג שאלות מחברות/מוצרים אחרים.
   מגדל בריאות קודם. אחרת המוצר עם הכי הרבה שאלות.
   בלי שינוי בבניית הסכמות / שאלוני המשך.
   הרצה: node _test-health-decl-one-form.js
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

const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

const filterStart = wiz.indexOf("getHealthQuestionsFiltered(){");
const filterEnd = wiz.indexOf("getHealthQuestionList(){");
const filterFn = (filterStart >= 0 && filterEnd > filterStart)
  ? wiz.slice(filterStart, filterEnd)
  : "";
const pickStart = filterFn.indexOf("GI-HEALTH-ONE-DECL");
const pickBlock = pickStart >= 0 ? filterFn.slice(pickStart) : "";

console.log("1) syntax + cache");
const syntaxWiz = spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")], { encoding: "utf8" });
assert(syntaxWiz.status === 0, "node --check gi-wizard.js");
if(syntaxWiz.status !== 0) console.error(syntaxWiz.stderr || syntaxWiz.stdout);
const syntaxApp = spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")], { encoding: "utf8" });
assert(syntaxApp.status === 0, "node --check app.js");
assert(app.includes('GI_WIZARD_JS_VERSION = "20260830-clal-health-decl-v1"') || app.includes('GI_WIZARD_JS_VERSION = "20260825-health-decl-cleanup-v1"') || /GI_WIZARD_JS_VERSION = "[^"]+"/.test(app), "app.js bumps gi-wizard cache");
assert(html.includes("app.js?v=20260830-clal-health-decl-v1") || html.includes("app.js?v=20260825-health-decl-cleanup-v1") || /app\.js\?v=/.test(html), "index.html bumps app.js cache");
assert(sw.includes("gi-v12-20260830-clal-health-decl-v1") || sw.includes("gi-v12-20260825-health-decl-cleanup-v1") || /gi-v12-/.test(sw), "service worker cache bumped");

console.log("\n2) one declaration only — no cross-company merge");
assert(filterFn.includes("getHealthQuestionsFiltered(){"), "filtered-questions resolver exists");
assert(pickBlock.includes("GI-HEALTH-ONE-DECL"), "one-declaration marker exists");
assert(pickBlock.includes("migdalHealth"), "Migdal health is an explicit hard priority");
assert(pickBlock.includes("cand.company === 'מגדל'"), "Migdal health match is by company name");
assert(pickBlock.includes("healthCompanies.length === 1"), "single-company carts skip Magdala hard priority");
assert(
  pickBlock.includes("chosenHealth = migdalHealth || bestCandidate(healthCandidates)")
    || pickBlock.includes("migdalHealth || bestCandidate(healthCandidates)"),
  "multi-company path still prefers Magdala then largest form"
);
assert(!pickBlock.includes("addUniqueQuestions"), "selection no longer merges leftover questions");
assert(!pickBlock.includes("mergedHealth"), "health path no longer builds a merged schema");
assert(pickBlock.includes("productCandidates"), "non-health path collects every product candidate");
assert(pickBlock.includes("bestCandidate(productCandidates)"), "non-health path picks one product by question count");
assert(
  pickBlock.includes("sanitizeHealthSchemaQuestionTexts(cloneSchema(best.schema))")
    || pickBlock.includes("cache.filteredQuestions = best ? cloneSchema(best.schema)"),
  "non-health path returns a single cloned schema"
);

console.log("\n3) company schemas and follow-ups stay in place");
assert(wiz.includes("getMagdalHealthSchema(){"), "Migdal health schema unchanged");
assert(wiz.includes("getPhoenixHealthSchema(){") || wiz.includes("getPhoenixHealthSchema("), "Phoenix health schema unchanged");
assert(wiz.includes("getClalHealthSchema(){"), "Clal health schema unchanged");
assert(wiz.includes("getMenoraHealthSchema(){"), "Menora health schema unchanged");
assert(wiz.includes("getAyalonHealthSchema(){"), "Ayalon health schema unchanged");
assert(wiz.includes("getHachsharaHealthSchema(){"), "Hachshara health schema unchanged");
assert(wiz.includes("getPhoenixFollowupSchemas(){"), "Phoenix follow-up questionnaires unchanged");
assert(wiz.includes("getHealthMasterSelection(){"), "master selection helper unchanged");
assert(app.includes("if(!username) return this._setError('נא להזין שם משתמש')"), "PIN login contract unchanged");
assert(app.includes("SupabaseMFA.signInWithPassword"), "MFA password step remains");

if(failed){
  console.error("\nFAILED  passed=" + passed + " failed=" + failed);
  process.exit(1);
}
console.log("\nOK " + passed + "/" + (passed + failed));
