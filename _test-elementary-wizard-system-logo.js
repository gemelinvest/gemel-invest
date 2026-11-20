/* אשף אלמנטרי מציג את לוגו המערכת (ONYX) במקום גמלנטרי.
   הרצה: node _test-elementary-wizard-system-logo.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) elementary wizard uses system logo");
assert(html.includes('id="lcElemWizardLogo"'), "elementary logo element exists");
assert(html.includes('id="lcElemWizardLogo"') && /id="lcElemWizardLogo"[^>]*src="\.\/assets\/onyx-logo-light\.png\?v=onyx-mark-1"/.test(html)
  || /src="\.\/assets\/onyx-logo-light\.png\?v=onyx-mark-1"[^>]*id="lcElemWizardLogo"/.test(html), "src is ONYX system logo");
assert(html.includes('alt="ONYX CRM"') && html.includes("lcWizard__elemLogo"), "alt is ONYX CRM");
assert(!html.includes("elementary-wizard-logo.png"), "old גמלנטרי png is not referenced in html");
assert(app.includes('ELEMENTARY_WIZARD_LOGO_SRC = "./assets/onyx-logo-light.png?v=onyx-mark-1"'), "JS constant points to system logo");
assert(!app.includes('ELEMENTARY_WIZARD_LOGO_SRC = "./elementary-wizard-logo.png"'), "JS no longer points to גמלנטרי png");
assert(/\.lcWizard__elemLogo\{[^}]*max-width:\s*72px/.test(css), "elem logo sized like system brand mark");
assert(html.includes("giElemSysLogo=1"), "app.js/html cache bumped");
assert(sw.includes("elem-sys-logo-v1"), "service-worker cache bumped");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
