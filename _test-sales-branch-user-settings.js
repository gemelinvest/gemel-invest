/* GI-SALES 2026-09-19 — שיוך סניף לדוח מכירות רק מערכית משתמשים.
   בלי נפילה לאנשי קשר. הרצה: node _test-sales-branch-user-settings.js
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

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

const app = read("app.js");
const html = read("index.html");
const sw = read("service-worker.js");

console.log("1) cache + UI");
assert(html.includes("app.js?v=20260919-sales-branch-user-v1"), "cache bust app.js");
assert(sw.includes("gi-v12-20260919-sales-branch-user-v1"), "service-worker cache");
assert(html.includes('id="lcUserOfficeBranch"'), "שדה שיוך לסוכנות");
assert(html.includes('<option value="חיפה">סוכנות חיפה</option>'), "אופציית חיפה");
assert(html.includes('<option value="מודיעין">סוכנות מודיעין</option>'), "אופציית מודיעין");
assert(html.includes("בלי שיוך — המכירות לא נספרות לסניף"), "עזרה מעודכנת");
assert(!html.includes("אם ריק — נלקח מאנשי קשר"), "אין נפילה לאנשי קשר בעזרה");

console.log("\n2) resolve = ערכית משתמשים בלבד");
assert(app.includes("function getAgentOfficeBranch"), "getAgentOfficeBranch");
assert(app.includes("function setAgentOfficeBranch"), "setAgentOfficeBranch");
assert(app.includes("function resolveOfficeBranchForAgentId"), "resolve לפי מזהה");
assert(app.includes("function resolveOfficeBranchForSalesAgent"), "resolve לפי מכירה");
assert(app.includes("function resolveOfficeBranchForSalesAgentName"), "resolve לפי שם");
assert(app.includes("return getAgentOfficeBranch(agentId)"), "AgentId → meta בלבד");
assert(app.includes("return getAgentOfficeBranch(agent.id)"), "שם → meta בלבד");
assert(!/function resolveOfficeBranchForAgentId[\s\S]{0,400}lookupOfficeBranchFromDirectory/.test(app),
  "resolveOfficeBranchForAgentId לא קורא לאנשי קשר");
assert(!/function resolveOfficeBranchForSalesAgentName[\s\S]{0,400}lookupOfficeBranchFromDirectory/.test(app),
  "resolveOfficeBranchForSalesAgentName לא קורא לאנשי קשר");
assert(!/function suggestOfficeBranchForAgent[\s\S]{0,200}lookupOfficeBranchFromDirectory/.test(app),
  "suggestOfficeBranchForAgent לא ממלא מאנשי קשר");
assert(app.includes("דוח המכירות סופר לפי meta.agentBranches בלבד"), "הערה בקוד");

console.log("\n3) KPI דוח מכירות עדיין דרך resolve");
assert(app.includes("resolveOfficeBranchForSalesAgent(r?.agentName, r?.agentIds)"), "KPI סניף דרך resolve");
assert(app.includes("dailySalesOfficeBranchTotals"), "סיכום סניפים");
assert(app.includes("dailySalesTodayOfficeBranchTotals"), "סיכום להיום");
assert(app.includes('label: "מכירות מודיעין"'), "תווית מודיעין");
assert(app.includes('label: "מכירות חיפה"'), "תווית חיפה");

console.log("\n4) התנהגות resolve מתוך מפה שמורה");
function safeTrim(v){ return String(v == null ? "" : v).trim(); }
function normalizeOfficeBranchLabel(value){
  const raw = safeTrim(value).toLowerCase().replace(/[\s_-]+/g, "");
  if(!raw) return "";
  if(raw === "חיפה" || raw === "haifa") return "חיפה";
  if(raw === "מודיעין" || raw === "modiin") return "מודיעין";
  return "";
}
function getAgentOfficeBranch(agentId, map){
  const id = safeTrim(agentId);
  if(!id) return "";
  if(map[id]) return normalizeOfficeBranchLabel(map[id]);
  const lower = id.toLowerCase();
  for(const k of Object.keys(map)){
    if(k.toLowerCase() === lower) return normalizeOfficeBranchLabel(map[k]);
  }
  return "";
}
function resolveOfficeBranchForAgentId(agentId, map){
  return getAgentOfficeBranch(agentId, map);
}
function resolveOfficeBranchForSalesAgent(agentName, agentIds, map, nameToId){
  const ids = [];
  const seen = new Set();
  (Array.isArray(agentIds) ? agentIds : []).forEach((raw) => {
    const id = safeTrim(raw);
    const key = id.toLowerCase();
    if(!id || seen.has(key)) return;
    seen.add(key);
    ids.push(id);
  });
  const fromIds = [...new Set(ids.map((id) => resolveOfficeBranchForAgentId(id, map)).filter(Boolean))];
  if(fromIds.length === 1) return fromIds[0];
  if(fromIds.length > 1) return "";
  const mappedId = nameToId[safeTrim(agentName)] || "";
  return mappedId ? getAgentOfficeBranch(mappedId, map) : "";
}

const saved = {
  "a_haifa_1": "חיפה",
  "a_modiin_1": "מודיעין"
};
const nameToId = {
  "אביאל אלקיים": "a_haifa_1",
  "אביב עמאש": "a_modiin_1",
  "בלי שיוך": "a_none"
};
assert(resolveOfficeBranchForAgentId("a_haifa_1", saved) === "חיפה", "מזהה שמור → חיפה");
assert(resolveOfficeBranchForAgentId("a_modiin_1", saved) === "מודיעין", "מזהה שמור → מודיעין");
assert(resolveOfficeBranchForAgentId("a_missing", saved) === "", "בלי שיוך → ריק (לא אנשי קשר)");
assert(resolveOfficeBranchForSalesAgent("אביב עמאש", ["a_modiin_1"], saved, nameToId) === "מודיעין",
  "מכירה עם מזהה → מודיעין מהגדרות");
assert(resolveOfficeBranchForSalesAgent("אביאל אלקיים", [], saved, nameToId) === "חיפה",
  "מכירה לפי שם שמור → חיפה מהגדרות");
assert(resolveOfficeBranchForSalesAgent("בלי שיוך", ["a_none"], saved, nameToId) === "",
  "נציג בלי שיוך לא נכנס לסניף");

function dailySalesOfficeBranchTotals(rows, resolveBranch){
  const out = { haifa: { premium: 0, agents: 0 }, modiin: { premium: 0, agents: 0 } };
  const seen = { haifa: new Set(), modiin: new Set() };
  rows.forEach((r) => {
    const prem = (Number(r.health) || 0) + (Number(r.prat) || 0);
    if(!(prem > 0)) return;
    const branch = resolveBranch(r);
    const bucket = branch === "חיפה" ? "haifa" : (branch === "מודיעין" ? "modiin" : "");
    if(!bucket) return;
    out[bucket].premium += prem;
    const key = "id:" + safeTrim((r.agentIds || [])[0] || r.agentName);
    if(!seen[bucket].has(key)){
      seen[bucket].add(key);
      out[bucket].agents += 1;
    }
  });
  out.haifa.premium = Math.round(out.haifa.premium * 100) / 100;
  out.modiin.premium = Math.round(out.modiin.premium * 100) / 100;
  return out;
}

const office = dailySalesOfficeBranchTotals([
  { agentName: "אביאל אלקיים", health: 100, prat: 20, agentIds: ["a_haifa_1"] },
  { agentName: "אביב עמאש", health: 80, prat: 0, agentIds: ["a_modiin_1"] },
  { agentName: "בלי שיוך", health: 999, prat: 0, agentIds: ["a_none"] }
], (r) => resolveOfficeBranchForSalesAgent(r.agentName, r.agentIds, saved, nameToId));
assert(office.haifa.premium === 120, "חיפה מסכמת רק משויכים");
assert(office.modiin.premium === 80, "מודיעין מסכמת רק משויכים");
assert(office.haifa.agents === 1 && office.modiin.agents === 1, "סופרים נציגים משויכים");

console.log("\n5) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n" + (failed ? "FAILED " + failed : "OK") + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
