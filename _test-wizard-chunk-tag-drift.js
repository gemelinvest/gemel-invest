/* GI-WIZARD-TAG-DRIFT 2026-09-09
   gi-wizard.js תקין נטען גם כש-GI_WIZARD_BUILD שונה מ-GI_WIZARD_JS_VERSION.
   זה השורש של «אשף לא נטען» ושל הבעיטה למסך כניסה אחרי MFA.
   הרצה: node _test-wizard-chunk-tag-drift.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260913-menora-health-decl-v4";
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

function sliceFunction(src, startToken){
  const start = src.indexOf(startToken);
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
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");

console.log("1) syntax + BUILD aligned with wizard chunk");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(app.includes('const BUILD = "' + TAG + '"'), "BUILD");
assert(app.includes('GI_WIZARD_JS_VERSION = "' + TAG + '"'), "GI_WIZARD_JS_VERSION aligned");
assert(wiz.includes('GI_WIZARD_BUILD = "' + TAG + '"'), "GI_WIZARD_BUILD aligned");
assert(app.includes("function giWizardChunkLooksInstallable"), "helper present");

const helperSrc = sliceFunction(app, "function giWizardChunkLooksInstallable(text)");
assert(helperSrc.indexOf("GI_WIZARD_BUILD") >= 0, "helper reads GI_WIZARD_BUILD");
assert(helperSrc.indexOf("installGiWizard") >= 0, "helper requires installGiWizard");

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(helperSrc, sandbox);
const looks = sandbox.giWizardChunkLooksInstallable;

console.log("\n2) runtime: installable vs junk");
assert(typeof looks === "function", "helper is callable");
assert(looks(wiz) === true, "current gi-wizard.js looks installable");

const drifted = wiz.replace(
  'GI_WIZARD_BUILD = "' + TAG + '"',
  'GI_WIZARD_BUILD = "20260909-leads-export-v1"'
);
assert(drifted !== wiz, "drifted fixture has a different tag");
assert(looks(drifted) === true, "wizard with older cache tag is still installable");

assert(looks("<!DOCTYPE html><html><body>login</body></html>") === false, "HTML is not installable");
assert(looks("const GI_WIZARD_BUILD = \"x\";") === false, "tiny file is not installable");
assert(looks("a".repeat(8000)) === false, "long junk without wizard marks is not installable");

function decideLoad(text, expectedVersion){
  if(!text || text.length < 500) throw new Error("short");
  if(/^\s*</.test(text)) throw new Error("html");
  const buildMark = 'GI_WIZARD_BUILD = "' + expectedVersion + '"';
  if(text.indexOf(buildMark) < 0){
    if(looks(text)) return "accept-drift";
    throw new Error("stale gi-wizard.js (build mismatch)");
  }
  return "match";
}

console.log("\n3) runtime: loadOnce would accept production mismatch");
assert(decideLoad(wiz, TAG) === "match", "aligned tags load as match");
assert(decideLoad(drifted, TAG) === "accept-drift", "leads-export-v1 chunk accepted by wizard-open-v1 loader");
assert(decideLoad(drifted, "20260909-version-resume-v3") === "accept-drift", "the live main mismatch would now load");
let threw = false;
try { decideLoad("<!DOCTYPE html><html></html>", TAG); } catch(_e){ threw = true; }
assert(threw, "HTML still rejected");
threw = false;
try { decideLoad("console.log(1);\n", TAG); } catch(_e){ threw = true; }
assert(threw, "short junk still rejected");

console.log("\n4) login path is not reset by wizard prefetch recover");
assert(app.includes("לא מרעננים את כל הדף על drift של תג"), "load catch documents no full reload");
assert(app.includes("_verifyPendingMfa"), "MFA verify path untouched");
assert(app.includes("Auth._submit = async function()"), "PIN login path untouched");
assert(app.includes("if(peekVersionUpdateResume()) void resumeSessionAfterVersionUpdate()"), "version-update resume still runs");

console.log("\n" + (failed ? ("FAILED: " + failed) : ("OK — " + passed + " checks")));
process.exit(failed ? 1 : 0);
