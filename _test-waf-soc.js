/**
 * Contract checks for GEMEL INVEST application WAF + SOC.
 * Isolated module. Login success path must stay untouched.
 * Run: node _test-waf-soc.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20261009-waf-simple-v1";
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
const sql = read("supabase-gi-waf-soc.sql");
const js = read("gi-waf-engine.js");
const css = read("gi-firewall.css");
const GiWaf = require("./gi-waf-engine.js");

console.log("1) syntax + wiring");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-waf-engine.js")]).status === 0, "node --check gi-waf-engine.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("gi-waf-engine.js?v=" + TAG), "index loads WAF module");
assert(html.includes("gi-firewall.css?v=" + TAG), "index loads WAF css");
assert(html.indexOf("gi-waf-engine.js") < html.indexOf("app.js?v="), "WAF wraps fetch before app.js");
assert(js.includes('const TAG = "' + TAG + '"'), "module tag matches cache");
assert(html.includes('data-settings-rubric="firewallSoc"'), "settings rubric exists");
assert(html.includes('id="settingsPanel-firewallSoc"'), "settings panel exists");
assert(html.includes('id="giWafRoot"'), "console root exists");
assert(css.includes(".giWaf__kpis"), "kpi grid styled");

console.log("\n2) engine blocks attack signatures and allows clean CRM payloads");
const xss = GiWaf.inspectRequest({ method: "POST", url: "https://vhvlkerectggovfihjgm.supabase.co/rest/v1/customers", body: "<script>alert(1)</script>" });
assert(xss.action === "block" && xss.ruleId === "sig-xss", "XSS is blocked");
const sqli = GiWaf.inspectRequest({ method: "POST", url: "https://vhvlkerectggovfihjgm.supabase.co/rest/v1/customers", body: "' or 1=1 union select pin from agents" });
assert(sqli.action === "block" && sqli.ruleId === "sig-sqli", "SQLi is blocked");
const trav = GiWaf.inspectRequest({ method: "GET", url: "https://example/files?path=../../etc/passwd" });
assert(trav.action === "block" && trav.ruleId === "sig-traversal", "path traversal is blocked");
const clean = GiWaf.inspectRequest({
  method: "POST",
  url: "https://vhvlkerectggovfihjgm.supabase.co/rest/v1/customers",
  body: JSON.stringify({ full_name: "ישראל ישראלי", id_number: "123456789", notes: "פגישה מחר ב-10" })
});
assert(clean.action === "allow", "normal Hebrew CRM payload is allowed");
const quote = GiWaf.inspectRequest({
  method: "POST",
  url: "https://vhvlkerectggovfihjgm.supabase.co/rest/v1/customers",
  body: JSON.stringify({ full_name: "ג'קי לוי" })
});
assert(quote.action === "allow", "apostrophe in a name is not SQLi");

console.log("\n3) login burst is counted on failures only, then guardLogin blocks");
const user = "waf-test-user-" + Date.now();
for(let i = 0; i < 8; i++){
  GiWaf.recordLoginOutcome({ ok: false, username: user, code: "BAD_PIN" });
}
const ninth = GiWaf.recordLoginOutcome({ ok: false, username: user, code: "BAD_PIN" });
assert(ninth && ninth.event && ninth.event.action === "block", "9th failed login is blocked by client WAF");
const gate = GiWaf.guardLogin(user);
assert(gate.ok === false, "guardLogin refuses a bursting username");
const other = GiWaf.guardLogin("clean-colleague");
assert(other.ok === true, "a different username is not locked by the first burst");
GiWaf.recordLoginOutcome({ ok: true, username: user });

console.log("\n3b) self-test reports each signature separately");
const probe = GiWaf.probeSelfTest();
assert(probe[0] && probe[0].ruleId === "sig-xss", "probe labels XSS");
assert(probe[1] && probe[1].ruleId === "sig-sqli", "probe labels SQLi");
assert(probe[2] && probe[2].ruleId === "sig-traversal", "probe labels traversal");

console.log("\n4) SOC recommendations stay defensive");
assert(/ניהול משתמשים/.test(GiWaf.recommendationFor({ category: "login" })), "login rec points to user admin unlock");
assert(/נחסמה ולא יצאה לשרת/.test(GiWaf.recommendationFor({ category: "xss" })), "xss rec is containment, not an exploit");
assert(/בדיקה פנימית/.test(GiWaf.recommendationFor({ category: "xss", username: "soc-probe-xss" })), "probe rec is labeled as an internal test");
assert(!/payload|exploit|PoC/i.test(js), "engine source does not ship exploit recipes");

console.log("\n5) SQL is additive, private, and does not redefine login");
assert(/create table if not exists public\.gi_waf_events/i.test(sql), "events table");
assert(/revoke all on public\.gi_waf_events from anon, authenticated/i.test(sql), "events are private");
assert(/gi_waf_ingest_event/i.test(sql), "ingest RPC exists");
assert(/gi_waf_admin_snapshot/i.test(sql), "admin snapshot RPC exists");
assert(/waf_enabled/.test(sql), "kill switch setting");
assert(!/create or replace function public\.gi_verify_agent_login/i.test(sql), "login RPC is not redefined");
assert(/auth_user_id = auth\.uid\(\)/.test(sql), "admin snapshot is role-gated by agents.auth_user_id");
assert(/v_recent >= 30/.test(sql), "ingest is rate-limited");

console.log("\n6) app.js hooks without changing success login");
assert(app.includes("GiWaf?.guardLogin"), "login calls WAF guard");
assert(app.includes("GiWaf?.recordLoginOutcome"), "login records WAF outcome");
assert(app.includes("canManageFirewall"), "admin/manager helper exists");
assert(app.includes("firewallSoc"), "settings rubric is wired");
assert(app.includes('"LOCKED"'), "LOCKED handling stays");
assert(/נעלת את הכניסה/.test(app), "lockout message stays");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
