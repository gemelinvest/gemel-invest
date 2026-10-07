/* שם סוכן קבוע בטפסי הצעה, וחלון פעילות נציגים נפרד.
   הרצה: node _test-official-handling-agent-window.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const NAME = "גרגורי יז'מסקי";
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "gi-wizard.js");

console.log("\n2) שם קבוע בטפסים");
assert(app.includes('GI_OFFICIAL_HANDLING_AGENT_NAME = "' + NAME + '"'), "קבוע השם");
assert(app.includes("stampOfficialHandlingAgent"), "חותמת שדות סוכן ב-PDF");
assert(app.includes("draft.agentName = (typeof GI_OFFICIAL_HANDLING_AGENT_NAME"), "טיוטת מילוי מקבלת את השם");
assert(wiz.includes("function giOfficialHandlingAgentName()"), "אשף קורא את השם הקבוע");
assert(wiz.includes("['נציג מטפל', currentAgentName]"), "דוח ההצעה מסמן נציג מטפל");
assert(!wiz.includes("safeTrim(Auth?.current?.name) || safeTrim(payload?.agentName) || 'נציג מטפל'"), "דוח ההצעה לא לוקח את הנציג המחובר");

const start = app.indexOf("const GI_OFFICIAL_FORM_FILL = {");
const end = app.indexOf("try { window.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL; }", start);
const ctx = { window: {}, console, GI_OFFICIAL_HANDLING_AGENT_NAME: NAME };
vm.runInNewContext(app.slice(start, end) + "\nthis.GI_OFFICIAL_FORM_FILL = GI_OFFICIAL_FORM_FILL;", ctx);
const H = ctx.GI_OFFICIAL_FORM_FILL;
const bag = Object.create(null);
const form = {
  __giCapture: bag,
  getField(fieldName){ return fieldName === "AgentName" ? { name: fieldName } : null; },
  getTextField(fieldName){
    if(fieldName !== "AgentName") throw new Error("missing");
    return { setText(v){ bag[fieldName] = v; }, setFontSize(){}, updateAppearances(){} };
  }
};
const draft = { agentName: "נציג שהגיש", primary: { fullName: "דנה כהן" } };
H.applyOfficialHealthAndNames(form, draft, null, { skipHealth: true, visual: false });
assert(draft.agentName === NAME, "הטיוטה לא נשארת על שם הנציג");
assert(bag.AgentName && bag.AgentName.indexOf("גרגורי") === 0, "AgentName בטופס הוא גרגורי");

console.log("\n3) חלון פעילות נציגים");
assert(app.includes('window.open("", "giOpsAgentFloor"'), "נפתח חלון דפדפן");
assert(app.includes('new URL("./app.css?v=" + BUILD, window.location.href)'), "העיצוב נטען מהכתובת של המערכת ולא מחלון ריק");
assert(app.includes("toggleAgentFloorWindowMin") && app.includes("closeAgentFloorWindow"), "מזער וסגור");
assert(app.includes('id="giFloorMin"') && app.includes('id="giFloorClose"'), "לחצנים בחלון עצמו");
assert(!app.includes("גרור את החלון"), "אין יותר גרירה עם הדפדפן");
assert(app.includes('if(safe === "opsAgentFloor")') && app.includes("return;"), "הדשבורד נשאר פתוח");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
