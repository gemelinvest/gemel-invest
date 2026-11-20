/* Closeout: printed question text, Menora MKQ detail, follow-up appearance, Phoenix CI threshold.
   Run: node _test-proposal-closeout.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
let passed = 0;
let failed = 0;

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
const zip = fs.readFileSync(path.join(ROOT, "gi-followup-zip.js"), "utf8");
const menora = fs.readFileSync(path.join(ROOT, "gi-menora-risk-form.js"), "utf8");

console.log("1) syntax");
["gi-wizard.js", "app.js", "gi-followup-zip.js", "gi-menora-risk-form.js"].forEach((file) => {
  assert(spawnSync(process.execPath, ["--check", path.join(ROOT, file)]).status === 0, file + " syntax");
});

console.log("\n2) printed question text keeps the questionnaire number");
const filterStart = wiz.indexOf("getHealthQuestionsFiltered(){");
const filterEnd = wiz.indexOf("getHealthQuestionList(){", filterStart);
const filterFn = wiz.slice(filterStart, filterEnd);
assert(!filterFn.includes("sanitizeHealthSchemaQuestionTexts("), "the displayed schema is not stripped");
assert(wiz.includes("sanitizeHealthSchemaQuestionTexts(schema)"), "the old stripper function remains");
assert(filterFn.includes("cloneSchema(chosenHealth.schema)"), "health declaration is still cloned");
assert(filterFn.includes("cache.filteredQuestions = best ? cloneSchema(best.schema)"), "one product schema is still cloned");

console.log("\n3) Menora yes-detail goes to the first MKQ text field");
assert(menora.includes('row.field + "Q1"'), "MKQ detail target is Q1 of that question");
assert(menora.includes('safeTrim(answerRow?.answer).toLowerCase() !== "yes"'), "a no answer does not write MKQ detail");

console.log("\n4) follow-up paints only when the field appearance cannot be updated");
const fillStart = zip.indexOf("async function fillFollowupPdf");
const fillFn = zip.slice(fillStart, zip.indexOf("async function loadFollowupPageBytes"));
assert(fillFn.includes("form.updateFieldAppearances(font)"), "Hebrew appearance is updated first");
assert(fillFn.includes("if(!appearancesOk) await paintAnswerText"), "drawing is the fallback");

console.log("\n5) Phoenix critical illness above 60 or 2 million uses the health declaration");
assert(wiz.includes("extended: maxAge > 60 || maxSum > 2000000"), "wizard route uses age 60 and 2 million");
assert(wiz.includes("allowWithoutHealth: true"), "the full health declaration can open without a health product");
assert(app.includes("return maxAge > 60 || maxSum > 2000000"), "the flat CI file is closed above the same threshold");
assert(app.includes("if(this.phoenixCiExtended(payload) || this.phoenixCriticalIllnessExtended(payload)) return false"), "an extended CI sale does not qualify the flat file");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
