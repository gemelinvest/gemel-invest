/**
 * The description search keeps the same ILIKE and the same created_at order.
 * The measured slow plan walked the date index. The function fences that plan
 * so the text index runs first.
 *
 * Run: node _test-lead-description-search.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = __dirname;
const sql = fs.readFileSync(path.join(root, "supabase-gi-campaign-leads-by-description.sql"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const code = sql
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

console.log("1) the function is the plan that was measured");
assert(code.includes("CREATE OR REPLACE FUNCTION public.gi_campaign_leads_by_description("), "the function name is stable");
assert(code.includes("RETURNS SETOF public.campaign_leads"), "it returns the lead row as stored");
assert(code.includes("WITH found AS MATERIALIZED"), "the text match is fenced from the page");
assert(code.includes("WHERE description ILIKE p_pattern"), "the match is still ILIKE on description");
assert(code.includes("ORDER BY created_at DESC"), "the page is still newest first");
assert(code.includes("LIMIT v_limit"), "the page size is applied after the match");
assert(code.includes("OFFSET v_offset"), "the page offset is applied after the match");
assert(code.includes("least(greatest(coalesce(p_limit, 1000), 1), 1000)"), "a page stays at most 1000 rows");
assert(/LANGUAGE plpgsql/i.test(code), "the body is not inlined into the date-index plan");
assert(!/security\s+definer/i.test(code), "it runs as the caller, so lead visibility is unchanged");
assert(code.includes("SET search_path = public"), "the function resolves only public objects");
assert(code.includes("GRANT EXECUTE ON FUNCTION public.gi_campaign_leads_by_description(text, bigint, bigint) TO anon, authenticated"), "the same roles that read leads can call it");
assert(!/update\s+public\.|delete\s+from|insert\s+into|drop\s+policy|alter\s+table/i.test(code), "it does not change rows or policies");
assert(!/gi_dashboard_net_premium|gi_dashboard_sales_by_product|gi_dashboard_sales_by_company/.test(code), "it does not replace a sales card");

console.log("2) the screen sends the same pattern through that function");
const load = app.slice(app.indexOf("async loadCampaignLeadRows"), app.indexOf("async loadTableRowsSince"));
assert(load.includes('client.rpc("gi_campaign_leads_by_description"'), "the description page calls the function");
assert(load.includes("p_pattern: descriptionIlike"), "the function receives the existing pattern");
assert(load.includes("p_limit: pageSize"), "the function receives the existing page size");
assert(load.includes("p_offset: from"), "the function receives the existing offset");
assert(load.includes("if(!campaignLeadDescriptionRpcMissing(rpcErr)) throw rpcErr"), "a real failure does not fall through into a second scan");
assert(load.includes('.ilike("description", descriptionIlike)'), "the previous description scan remains if the function is not installed yet");
assert(load.includes('.in("assigned_agent_id", agentIds)'), "the assignment filter is unchanged");
assert(load.includes('.order("created_at", { ascending: false })'), "the assignment page is still ordered by created_at");
assert(app.includes('return "%" + raw.replace(/[\\\\%_]/g, (ch) => "\\\\" + ch) + "%"'), "the pattern still has a percent sign on both sides");

console.log("3) a missing function is the only reason to use the old scan");
const helperStart = app.indexOf("function campaignLeadDescriptionRpcMissing");
const helperEnd = app.indexOf("function campaignLeadMineDescriptionPatterns");
const context = { safeTrim(v){ return String(v == null ? "" : v).trim(); } };
vm.createContext(context);
vm.runInContext(app.slice(helperStart, helperEnd), context);
assert(context.campaignLeadDescriptionRpcMissing({ code: "PGRST202", message: "missing" }) === true, "schema-cache code PGRST202 uses the old scan");
assert(context.campaignLeadDescriptionRpcMissing({ message: "Could not find the function public.gi_campaign_leads_by_description in the schema cache" }) === true, "a missing function uses the old scan");
assert(context.campaignLeadDescriptionRpcMissing({ message: "canceling statement due to statement timeout" }) === false, "a timeout does not start the slow scan as well");
assert(context.campaignLeadDescriptionRpcMissing({ code: "57014", message: "timeout" }) === false, "a database timeout stays a failure");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
