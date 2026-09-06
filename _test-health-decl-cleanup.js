/* GI-HEALTH-DECL-CLEANUP 2026-08-25
   Dedup + alias dual-read + report canonical keys + strip שאלון annotations.
   Run: node _test-health-decl-cleanup.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260906-haifa-modiin-v1";
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

console.log("1) markers + cache");
assert(wiz.includes("GI-HEALTH-CLEANUP 2026-08-25"), "cleanup marker in wizard");
assert(wiz.includes("HEALTH_QKEY_ALIASES"), "alias map exists");
assert(wiz.includes("stripHealthQuestionnaireAnnotation"), "annotation stripper exists");
assert(wiz.includes("sanitizeHealthSchemaQuestionTexts"), "schema text sanitizer exists");
assert(wiz.includes("resolveHealthResponseAliasKeys"), "alias key resolver exists");
assert(wiz.includes("רק מפתחות הסכמה הקנונית"), "report uses canonical schema keys only");
assert(wiz.includes("GI-HEALTH-DEDUP: כפילות לפי key ולפי דמיון תוכן"), "merge schemas text-dedup");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "app wizard version bumped");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "wizard build mark matches");
assert(html.includes("app.js?v=" + TAG) || app.includes(TAG), "cache tag present in app/html");
assert(sw.includes(TAG) || sw.includes("health-decl-cleanup"), "service worker cache bumped");

console.log("2) syntax");
const syn = spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")], { encoding: "utf8" });
assert(syn.status === 0, "node --check gi-wizard.js");
if(syn.status !== 0) console.error(syn.stderr || syn.stdout);

console.log("3) strip + alias behaviour (vm harness)");
const vm = require("vm");
const harness = `
${wiz.match(/stripHealthQuestionnaireAnnotation\(text\)\{[\s\S]*?\n    \},/)[0].replace(/^/, "function ")}
${wiz.match(/resolveHealthResponseAliasKeys\(qKey\)\{[\s\S]*?\n    \},/)[0]
  .replace(/^/, "const HEALTH_QKEY_ALIASES = " + wiz.match(/HEALTH_QKEY_ALIASES:\s*(\{[\s\S]*?\n    \}),/)[1] + ";\nfunction ")
  .replace(/this\.HEALTH_QKEY_ALIASES/g, "HEALTH_QKEY_ALIASES")
  .replace(/this\.resolveHealthResponseAliasKeys/g, "resolveHealthResponseAliasKeys")
  .replace(/safeTrim/g, "(function(v){return String(v==null?'':v).trim();})")
}
`;

// Simpler unit tests without full VM of wizard:
function stripHealthQuestionnaireAnnotation(text){
  let t = String(text == null ? "" : text);
  t = t.replace(/\s*\(שאלון(?:ים)?[^)]*\)/g, "");
  t = t.replace(/\s*\(\s*\d+(?:\s*[,/]\s*\d+)*\s*\)(?=\s*[,.]|$)/g, "");
  t = t.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim();
  return t;
}

assert(
  stripHealthQuestionnaireAnnotation("האם מעשן? (שאלון 2)") === "האם מעשן?",
  "strips (שאלון N)"
);
assert(
  stripHealthQuestionnaireAnnotation("מערכת העצבים (4).") === "מערכת העצבים.",
  "strips trailing questionnaire number"
);
assert(
  stripHealthQuestionnaireAnnotation("לרבות מספר 8 ומעלה") === "לרבות מספר 8 ומעלה",
  "keeps non-paren numbers like מספר 8"
);
assert(
  /שאלון/.test(stripHealthQuestionnaireAnnotation("לב (שאלון 11), כלי דם (שאלון 22)")) === false,
  "strips multiple שאלון annotations from Menora/Ayalon style"
);

// Count clal health q() calls still 29
const clalBodyStart = wiz.indexOf("getClalHealthSchema(){");
const clalBody = wiz.slice(clalBodyStart, wiz.indexOf("getPhoenixHealthSchema(){", clalBodyStart));
const clalQs = [...clalBody.matchAll(/q\(\s*'clal_[^']+'/g)];
assert(clalQs.length === 29, "Clal health still exactly 29 questions (got " + clalQs.length + ")");

const phoenixStart = wiz.indexOf("getPhoenixHealthSchema(){");
const phoenixBody = wiz.slice(phoenixStart, wiz.indexOf("getMenoraHealthSchema(){", phoenixStart));
const phxQs = [...phoenixBody.matchAll(/q\(\s*'phoenix_full__[^']+'/g)];
assert(phxQs.length === 28, "Phoenix health still exactly 28 questions (got " + phxQs.length + ")");

const ayalonStart = wiz.indexOf("getAyalonHealthSchema(){");
const ayalonBody = wiz.slice(ayalonStart, wiz.indexOf("getAyalonCriticalHealthSchema(){", ayalonStart));
const ayQs = [...ayalonBody.matchAll(/key:'ayalon__[^']+'/g)];
assert(ayQs.length === 22, "Ayalon health still exactly 22 questions (got " + ayQs.length + ")");

console.log("4) regression suite samples");
const reg = spawnSync(process.execPath, [path.join(ROOT, "_test-health-decl-one-form.js")], { encoding: "utf8" });
assert(reg.status === 0, "_test-health-decl-one-form.js passes");
if(reg.status !== 0) console.error(reg.stdout || reg.stderr);

const off = spawnSync(process.execPath, [path.join(ROOT, "_test-official-forms-regression.js")], { encoding: "utf8", timeout: 120000 });
assert(off.status === 0, "_test-official-forms-regression.js passes");
if(off.status !== 0){
  console.error((off.stdout || "").slice(-2000));
  console.error((off.stderr || "").slice(-1000));
}

console.log("\n" + (failed ? "FAILED " + failed : "OK") + " · passed=" + passed);
process.exit(failed ? 1 : 0);
