/* GI-OPS 2026-10-12 — אחרי הקראת הצהרת בריאות נפתח טופס הצעת בריאות.
   אם יש מגדל ועוד חברה עם מוצר בריאות — מגדל מועדף.
   הרצה: node _test-ops-health-form-open-pref.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20261007-lead-dup-v1";
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

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

function extractMethod(src, name){
  let start = src.indexOf("    async " + name + "(");
  if(start < 0) start = src.indexOf("    " + name + "(");
  if(start < 0) return "";
  let i = src.indexOf("{", start);
  let depth = 0;
  for(; i < src.length; i++){
    if(src[i] === "{") depth += 1;
    else if(src[i] === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("&giHealthOpen=1"), "index.html app.js נטען מחדש אחרי העדפת טופס בריאות");
assert(sw.includes("health-open-v1"), "service-worker cache להעדפת טופס בריאות");

const renderFn = extractMethod(app, "_renderHealthDeclarationBody");
const isHealthFn = extractMethod(app, "_mcIsHealthOfferJoinType");
const prefFn = extractMethod(app, "_mcPreferredJoinFormToOpen");
assert(renderFn.includes("_mcPreferredJoinFormToOpen"), "אחרי ההקראה נפתח הטופס המועדף ולא הראשון ברשימה");
assert(!/const firstOriginal = \(railNow\.join \|\| \[\]\)\.find/.test(renderFn), "אין פתיחה לפי סדר הפוליסות בלבד");
assert(!!isHealthFn && !!prefFn, "חולצו עוזרי העדפת טופס בריאות");

console.log("\n2) העדפה: בריאות לפני מחלות קשות, מגדל לפני חברה אחרת");
const sandbox = { safeTrim: (v) => (v == null ? "" : String(v).trim()) };
vm.createContext(sandbox);
vm.runInContext(
  "const api = {\n" + isHealthFn + ",\n" + prefFn + "\n}; this.api = api;",
  sandbox
);

function row(type, available){
  return { type, available: available !== false, name: type };
}

assert(sandbox.api._mcIsHealthOfferJoinType("migdal_health_form") === true, "מגדל בריאות הוא טופס הצעת בריאות");
assert(sandbox.api._mcIsHealthOfferJoinType("phoenix_health_form") === true, "הפניקס בריאות הוא טופס הצעת בריאות");
assert(sandbox.api._mcIsHealthOfferJoinType("phoenix_ci_form") === false, "הפניקס מחלות קשות אינו טופס הצעת בריאות");
assert(sandbox.api._mcIsHealthOfferJoinType("migdal_life_form") === false, "מגדל ריסק אינו טופס הצעת בריאות");

function pick(types){
  const rail = { join: types.map((t) => row(t)) };
  const chosen = sandbox.api._mcPreferredJoinFormToOpen(rail);
  return chosen && chosen.type;
}

assert(pick(["phoenix_ci_form", "migdal_health_form"]) === "migdal_health_form", "מגדל בריאות נפתח גם כשהפניקס מחלות קשות ראשון");
assert(pick(["phoenix_health_form", "migdal_health_form"]) === "migdal_health_form", "מגדל מועדף על הפניקס כשיש שתי הצעות בריאות");
assert(pick(["clal_health_form", "menora_health_form", "migdal_health_form"]) === "migdal_health_form", "מגדל מועדף גם כשיש כלל ומנורה");
assert(pick(["phoenix_ci_form", "phoenix_health_form"]) === "phoenix_health_form", "יש מוצר בריאות — נפתח טופס ההצעה לבריאות");
assert(pick(["migdal_life_form", "clal_health_form"]) === "clal_health_form", "בריאות של חברה אחרת נפתחת גם אם למגדל יש רק ריסק");
assert(pick(["phoenix_ci_form", "menora_risk_form"]) === "phoenix_ci_form", "בלי מוצר בריאות נשאר הטופס הראשון");
assert(pick(["migdal_health_form"]) === "migdal_health_form", "רק מגדל בריאות נפתח");
assert(sandbox.api._mcPreferredJoinFormToOpen({ join: [] }) === null, "בלי טפסים אין פתיחה");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
