/* תפעול באותו מראה של שירות, בלי שינוי ספירה או לחיצה.
   הרצה: node _test-ops-cube-service-style.js
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
  } else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const theme = fs.readFileSync(path.join(ROOT, "theme.css"), "utf8");

function sliceBetween(src, start, end){
  const i = src.indexOf(start);
  const j = src.indexOf(end, i + start.length);
  return i >= 0 && j > i ? src.slice(i, j) : "";
}

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) buckets, counts, and clicks stay");
const cube = sliceBetween(app, "renderAgentOpsCubeHtml(model){", "collectionOpenCustomers(){");
assert(cube.includes('key: "waiting_mirror", label: "ממתין לשיקוף"') || app.includes('key: "waiting_mirror", label: "ממתין לשיקוף"'), "ממתין לשיקוף");
assert(app.includes('key: "waiting_typing", label: "שליחה לחתימות"'), "שליחה לחתימות");
assert(app.includes('key: "pending_signatures", label: "ממתין לחתימות"'), "ממתין לחתימות");
assert(app.includes('key: "issuance", label: "עבר להפקה"'), "עבר להפקה");
assert(cube.includes("this.formatMoney(r.premium)") && cube.includes("${r.count} לקוחות"), "שורת השיקוף עדיין מציגה סכום ומספר לקוחות");
assert(cube.includes("escapeHtml(String(r.count))") && cube.includes(">לקוחות<"), "שאר השורות עדיין מציגות מספר לקוחות");
assert(cube.includes("data-agent-ops-bucket="), "הלחיצה נשארת על אותו מאפיין");
assert(cube.includes("bankOpsCube__metric") && cube.includes("bankOpsCube__metricSub"), "המספרים עדיין מתעדכנים באותם סימונים");
assert(app.includes('this.openAgentOpsBucketList(opsBtn.getAttribute("data-agent-ops-bucket"))'), "פתיחת הרשימה נשארת");

console.log("\n3) same visual language as service");
assert(theme.includes("GI-OPS-CUBE 2026-11-15"), "סימון העיצוב");
assert(theme.includes("background: #f6f8fc !important;"), "שורות אפורות מעוגלות");
assert(theme.includes("background: #fef3c7 !important; color: #d97706 !important;"), "עיגול שיקוף");
assert(theme.includes("background: #dbeafe !important; color: #2563eb !important;"), "עיגול חתימות");
assert(theme.includes("background: #ede9fe !important; color: #7c3aed !important;"), "עיגול המתנה");
assert(theme.includes("background: #dcfce7 !important; color: #16a34a !important;"), "עיגול הפקה");
assert(cube.includes("M9 6l6 6-6 6") && !cube.includes("‹"), "החץ פונה ימינה");
assert(theme.includes("GI-SERVICE-CUBE 2026-11-15") && theme.includes("background: #d8f3ee !important; color: #0d9488 !important;"), "שירות לא השתנה");

console.log("\n" + (failed ? "FAILED " + failed : "OK " + passed));
process.exit(failed ? 1 : 0);
