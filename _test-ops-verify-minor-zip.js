/* פרטי מבוטח: עיסוק וילדים רק לבגיר, מיקוד מהראשי לכולם.
   הרצה: node _test-ops-verify-minor-zip.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "app.css"), "utf8");
let failed = 0;
let passed = 0;

function assert(cond, msg){
  if(cond){ passed += 1; console.log("  PASS  " + msg); }
  else { failed += 1; console.error("  FAIL  " + msg); }
}

function method(name){
  const start = app.indexOf(name + "(");
  const brace = app.indexOf("{", start);
  let depth = 0;
  for(let i = brace; i < app.length; i++){
    if(app[i] === "{") depth++;
    else if(app[i] === "}"){
      depth--;
      if(depth === 0) return app.slice(brace, i + 1);
    }
  }
  return "";
}

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(__dirname, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) קטין בלי עיסוק וילדים");
const verify = app.slice(app.indexOf("onVerifyPersonalContinue(){"), app.indexOf("_renderNeedsExisting", app.indexOf("onVerifyPersonalContinue(){")));
assert(verify.includes('minor && (k === "childrenText" || k === "occupation")'), "בדיקת חובה מדלגת על קטין");
assert(app.includes("עיסוק וילדים לא נדרשים לקטין"), "הערה לקטין במסך");
assert(app.includes('textField("עיסוק נוכחי", "occupation")'), "עיסוק נשאר לבגיר");
assert(app.includes('textField("האם יש ילדים", "childrenText")'), "ילדים נשארים לבגיר");

console.log("\n3) מיקוד");
assert(app.includes("_mirrorBroadcastVerifyZip(input){"), "העתקת מיקוד");
assert(app.includes('data-mc-verify-field="zip"') || app.includes("data-mc-verify-field='zip'"), "שדה מיקוד נשאר");
assert(css.includes(".mcStepVerify__input--zip{"), "מיקוד בכחול התפריט");

console.log("\n4) התנהגות גיל וקטין");
const sandbox = { safeTrim(v){ return v == null ? "" : String(v).trim(); } };
vm.runInNewContext(
  "function safeTrim(v){ return v == null ? '' : String(v).trim(); }\n" +
  "const api = {\n" +
  "  _mirrorVerifyBirthAge(birthDate)" + method("_mirrorVerifyBirthAge") + ",\n" +
  "  _mirrorVerifyIsMinor(ins)" + method("_mirrorVerifyIsMinor") + "\n" +
  "};\n" +
  "api._mirrorVerifyBirthAge = api._mirrorVerifyBirthAge.bind(api);\n" +
  "api._mirrorVerifyIsMinor = api._mirrorVerifyIsMinor.bind(api);\n" +
  "this.api = api;",
  sandbox
);
const api = sandbox.api;
const age = api._mirrorVerifyBirthAge("13/07/2018");
assert(age != null && age < 18, "תאריך ילד מזוהה כמתחת ל-18");
assert(api._mirrorVerifyBirthAge("13/07/1979") >= 18, "תאריך בגיר");
assert(api._mirrorVerifyIsMinor({ type: "child", data: {} }) === true, "סוג ילד הוא קטין");
assert(api._mirrorVerifyIsMinor({ type: "primary", data: { birthDate: "01/01/2015" } }) === false, "ראשי נשאר בגיר לצורך השדות");
assert(api._mirrorVerifyIsMinor({ type: "spouse", data: {} }) === false, "בן זוג בגיר");
assert(api._mirrorVerifyIsMinor({ type: "", data: { birthDate: "01/01/2016" } }) === true, "בלי סוג, גיל קטין");

console.log(failed ? "\nFAILED " + failed : "\nOK " + passed);
process.exit(failed ? 1 : 0);
