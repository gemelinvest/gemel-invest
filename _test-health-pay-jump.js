/* שלב הצהרת בריאות: המשך לתשלום רק אחרי אישור שמירת הטפסים.
   הרצה: node _test-health-pay-jump.js
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
  }else{
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function sliceBetween(src, start, end){
  const i = src.indexOf(start);
  if(i < 0) return "";
  const j = src.indexOf(end, i + start.length);
  return j > i ? src.slice(i, j) : "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");

assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

const editor = sliceBetween(app, "_mcHealthFormEditorHtml(rec){", "_mcEditorRoot(){");
const render = sliceBetween(app, "_renderHealthDeclarationBody(rec){", "_mcIsExistingHealthProduct(p){");
const remind = sliceBetween(app, "_mcOpenHealthPayRemind(){", "_handleNeedsAct(act){");
const leave = sliceBetween(app, 'if(action === "health-to-future"){', 'if(action === "future-back"){');

assert(editor.includes("המשך לשלב אמצעי תשלום"), "בטופס הפתוח יש המשך לשלב אמצעי תשלום");
assert(editor.includes("payJump: true"), "הלחצן בטופס נצמד לתחתית");
assert(render.includes("המשך לשלב אמצעי תשלום"), "גם בסיכום ההצהרה אותו לחצן");
assert(render.includes("health-to-future"), "ניווט ההמשך נשאר");
assert(remind.includes("שים לב שביצעת שמירה על הטפסים במידה ובוצעו שינויים"), "ההודעה לנציג");
assert(remind.includes(">אישור<"), "לחצן אישור");
assert(remind.includes('this._mcHealthPayAck = true'), "אישור מאפשר את המעבר");
assert(remind.includes('this._handleNeedsAct("health-to-future")'), "אחרי אישור עוברים הלאה");
assert(leave.includes("_mcOpenHealthPayRemind()"), "בלי אישור לא עוברים לתשלום");
assert(leave.includes('this._mirrorUiPhase = "paymentDetails"'), "אחרי האישור נפתח שלב אמצעי התשלום");
assert(css.includes(".mcHealthPayJump{") && css.includes("justify-content:flex-end"), "הלחצן בתחתית בצד שמאל");
assert(css.includes(".mcHealthPayRemind__text{"), "עיצוב ההודעה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
