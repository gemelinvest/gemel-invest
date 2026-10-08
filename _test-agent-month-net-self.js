/* נציג רגיל: כרטיס «פרמיה חודשית נטו» מראה את המכירות שלו.
   סכום מקומי 0 + שרת מסונן לנציג נצבע. סכום של כולם לא נצבע.
   סכום מקומי חיובי לא נדרס. מנהל בלי סינון עדיין רואה את כולם.
   הרצה: node _test-agent-month-net-self.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
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

function extractObjectMethod(src, methodName){
  const needle = "\n    " + methodName + "(";
  const start = src.indexOf(needle);
  if(start < 0) return "";
  let i = start + needle.length;
  let depthParen = 1;
  while(i < src.length && depthParen > 0){
    const ch = src[i];
    if(ch === "(") depthParen += 1;
    else if(ch === ")") depthParen -= 1;
    i += 1;
  }
  const brace = src.indexOf("{", i);
  if(brace < 0) return "";
  let depth = 0;
  for(let j = brace; j < src.length; j += 1){
    const ch = src[j];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, j + 1).trim();
    }
  }
  return "";
}

assert(app.includes("const agentSelfKpi = Auth.getDashboardSalesScope?.() === \"self\""), "נציג מזוהה לפי היקף self");
assert(app.includes("agentSelf: agentSelfKpi"), "הכרטיס מעביר את היקף הנציג לעוזר");
assert(app.includes("scoped: agentMonthNetScoped"), "הכרטיס מעביר אם השרת סונן לנציג");
assert(app.includes("opts.agentSelf === true && opts.scoped !== true"), "בלי סינון נציג המספר לא נצבע");
assert(app.includes("getServerListAgentScopeFilter()"), "הסינון נלקח מאותו מסנן של רשימת הנציג");

const fn = extractObjectMethod(app, "_shouldApplyServerNetOverlay");
assert(!!fn, "חולץ העוזר");
const sandbox = {};
vm.runInNewContext(
  "this._shouldApplyServerNetOverlay = function" + fn.slice("_shouldApplyServerNetOverlay".length) + ";",
  sandbox
);
const decide = (opts) => sandbox._shouldApplyServerNetOverlay(opts);

const agentOwn = { localNet:0, serverNet:29260.1, missingCustomers:0, localReady:true, localHasNet:false, agentSelf:true, scoped:true };
const agentOrg = { localNet:0, serverNet:180000, missingCustomers:0, localReady:true, localHasNet:false, agentSelf:true, scoped:false };
const agentKept = { localNet:4100, serverNet:29260.1, missingCustomers:0, localReady:true, localHasNet:true, agentSelf:true, scoped:true };
const managerAll = { localNet:0, serverNet:180000, missingCustomers:0, localReady:true, localHasNet:false, agentSelf:false, scoped:false };

assert(decide(agentOwn) === true, "נציג עם 0 מקומי רואה את המכירות שלו מהשרת המסונן");
assert(decide(agentOrg) === false, "נציג לא רואה את הסכום של כולם");
assert(decide(agentKept) === false, "סכום מקומי חיובי של הנציג לא נדרס");
assert(decide(managerAll) === true, "מנהל עם חישוב מקומי ריק עדיין רואה את כולם");
assert(decide({ localNet:8000, serverNet:5000, missingCustomers:0, localReady:true, localHasNet:true, agentSelf:true, scoped:true }) === false, "נציג עם סכום מקומי גבוה נשאר על המקומי");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
