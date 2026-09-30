/* GI-FOLLOWUP-PAGE-MAP 2026-09-30
   מספר השאלון במחסנית נפתח על העמוד שהכותרת המודפסת שלו תואמת.
   הרצה: node _test-followup-page-map.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

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

const cfgSrc = fs.readFileSync(path.join(ROOT, "gi-followup-zip-config.js"), "utf8");
const zipSrc = fs.readFileSync(path.join(ROOT, "gi-followup-zip.js"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(cfgSrc, sandbox);
const companies = sandbox.GI_FOLLOWUP_ZIP_CONFIG.COMPANIES;

console.log("1) phoenix");
assert(companies.phoenix.pageForQuestionnaire(2) === 11, "מום לב opens the heart page");
assert(companies.phoenix.pageForQuestionnaire(16) === 1, "lungs is page 1");
assert(companies.phoenix.pageForQuestionnaire(12) === 2, "spine is page 2");
assert(companies.phoenix.pageForQuestionnaire(22) === 13, "family history is the last page");
assert(companies.phoenix.pageForQuestionnaire(3) === 0, "rhythm has no page in the file");
assert(companies.phoenix.stackIds.indexOf("3") < 0, "stack does not offer a phoenix id without a page");
assert(companies.phoenix.stackIds.indexOf("2") >= 0, "stack still offers heart defect");

console.log("2) ayalon");
assert(companies.ayalon.pageForQuestionnaire(2) === 1, "lungs is the first page");
assert(companies.ayalon.pageForQuestionnaire(7) === 6, "drugs and alcohol is page 6");
assert(companies.ayalon.pageForQuestionnaire(11) === 11, "heart stays on the heart page");
assert(companies.ayalon.pageForQuestionnaire(32) === 28, "family history is page 28");
assert(companies.ayalon.pageForQuestionnaire(1) === 0, "neurology is not the FMF page");
assert(companies.ayalon.stackIds.length === 22, "stack lists one copy of the real questionnaires");
assert(companies.ayalon.stackIds.indexOf("52") < 0, "duplicate copy is not in the stack");

console.log("3) clal");
assert(companies.clal.pageForQuestionnaire("א") === 1, "drugs letter opens page 1");
assert(companies.clal.pageForQuestionnaire("ד") === 5, "ד skips the extra page of ג");
assert(companies.clal.pageForQuestionnaire("ז") === 8, "heart letter opens the heart page");
assert(companies.clal.pageForQuestionnaire("ו") === 7, "skin letter stays on skin");
assert(companies.clal.pageForQuestionnaire("כג") === 33, "disability letter");
assert(companies.clal.pageForQuestionnaire("כב") === 34, "tests letter is after כג in the file");

console.log("4) menora");
assert(companies.menora.pageForQuestionnaire(2) === 2, "drugs stays drugs");
assert(companies.menora.pageForQuestionnaire(4) === 4, "heart stays heart");
assert(companies.menora.pageForQuestionnaire(22) === 22, "ENT opens its first page");
assert(companies.menora.pageForQuestionnaire(23) === 24, "prostate skips the ENT continuation");
assert(companies.menora.pageForQuestionnaire(26) === 27, "family is the last page");
assert(companies.menora.stackIds.indexOf("27") < 0, "stack has no extra id 27");

console.log("5) hachshara");
assert(companies.hachshara.pageForQuestionnaire(4) === 4, "drugs stays page 4");
assert(companies.hachshara.pageForQuestionnaire(11) === 2, "heart opens the heart page");
assert(companies.hachshara.pageForQuestionnaire(15) === 14, "digestion opens the digestion page");
assert(companies.hachshara.pageForQuestionnaire(17) === 11, "lungs opens the respiratory page");
assert(companies.hachshara.pageForQuestionnaire(19) === 0, "endocrine has no page");
assert(companies.hachshara.stackIds.indexOf("19") < 0, "endocrine is not offered in the stack");
assert(companies.hachshara.pageForQuestionnaire(29) === 28, "women opens the women page");

console.log("6) migdal page number still matches the printed number");
assert(companies.migdal.pageForQuestionnaire(1) === 1, "migdal 1");
assert(companies.migdal.pageForQuestionnaire(18) === 18, "migdal 18");
assert(companies.migdal.pageForQuestionnaire(30) === 30, "migdal 30");

console.log("7) missing page does not fall back to page 1");
assert(zipSrc.includes('if(!pageNum) throw new Error("אין עמוד בקובץ לשאלון "'), "isolated page refuses an unmapped questionnaire");
assert(app.includes("cfg.stackIds"), "mirror stack uses the explicit id list");

const clal = app.slice(app.indexOf("const ClalRiskLifePdf"), app.indexOf("getFileName(meta)", app.indexOf("const ClalRiskLifePdf")));
assert(clal.includes("Heebo-Bold.ttf"), "clal risk embeds Heebo");
assert(!clal.includes("Rubik-Regular.ttf"), "clal risk does not ask for the missing Rubik file");
assert(clal.includes("updateFieldAppearances: false"), "clal risk save does not redraw with Helvetica");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
