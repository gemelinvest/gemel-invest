/**
 * Indexes for the two measured loads. No row, assignment, or formula change.
 *
 * Run: node _test-load-hot-indexes.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const root = __dirname;
const sql = fs.readFileSync(path.join(root, "supabase-load-hot-indexes.sql"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "supabase-gi-net-premium-stable.sql"), "utf8");
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

console.log("1) indexes only, no business change");
assert(code.includes("CREATE INDEX IF NOT EXISTS idx_campaign_leads_created_at_desc"), "lead list index is created once");
assert(code.includes("ON public.campaign_leads (created_at DESC)"), "lead index matches order by created_at descending");
assert(code.includes("CREATE INDEX IF NOT EXISTS idx_customers_created_at"), "customer created_at index is created once");
assert(code.includes("ON public.customers (created_at)"), "customer created_at index is the column the dashboard already filters");
assert(code.includes("CREATE INDEX IF NOT EXISTS idx_customers_completed_at"), "customer completed_at index is created once");
assert(code.includes("ON public.customers (completed_at)"), "completed_at index is the column the dashboard already filters");
assert(code.includes("WHERE completed_at IS NOT NULL"), "completed_at index skips empty stamps, matching the existing null check");
assert(!/concurrently/i.test(code), "the editor can run this inside its transaction");
assert(code.includes("ANALYZE public.campaign_leads"), "lead planner stats are refreshed");
assert(code.includes("ANALYZE public.customers"), "customer planner stats are refreshed");
assert(!/drop\s+policy|create\s+policy|alter\s+policy|alter\s+table|update\s+public\.|delete\s+from|insert\s+into/i.test(code), "it does not change rows or policies");
assert(!/create\s+(or\s+replace\s+)?function/i.test(code), "it does not replace a function");
assert(!/gi_dashboard_net_premium|gi_dashboard_sales_by_product|gi_dashboard_sales_by_company/.test(code), "it does not replace the sales card");
assert(!/assigned_agent_id|description/.test(code), "it does not rewrite lead assignment or the description text");

console.log("2) lead screen behavior stays");
assert(app.includes('const CAMPAIGN_LEAD_COLUMNS = "id,phone,customer_name,description,campaign_id,campaign_label,assigned_agent_id,assigned_agent_name,status,source,created_by_name,updated_by_name,row_color,created_at,updated_at"'), "the list still reads the same lead columns, including description");
assert(app.includes('.order("created_at", { ascending: false })'), "leads are still ordered by created_at descending");
assert(app.includes('.in("assigned_agent_id", agentIds)'), "assignment filter is unchanged");
assert(app.includes("assigned_agent_id: l.assignedAgentId"), "saving a lead still writes the same assignee");

console.log("3) dashboard formula stays");
assert(dashboard.includes("public.gi_dashboard_sale_stamp(p, s.created_at)"), "net premium still uses the sale stamp");
assert(dashboard.includes("public.gi_dashboard_sale_stamp(p, l.created_at)"), "product and company cards still use the sale stamp");
assert(dashboard.includes("NOT public.gi_is_production_backfill(p)"), "production import is still excluded");
assert(dashboard.includes("coalesce(p->>'origin', '') <> 'existing'"), "existing policies are still excluded");
assert(dashboard.includes("round(coalesce(sum(gi_policy_premium(policy)), 0), 2)"), "net premium is still the after-discount sum");
assert(dashboard.includes("c.created_at >= p_start AND c.created_at < p_end"), "the created_at window is unchanged");
assert(dashboard.includes("c.updated_at >= p_start AND c.updated_at < p_end"), "the updated_at window is unchanged");
assert(dashboard.includes("c.completed_at IS NOT NULL AND c.completed_at >= p_start AND c.completed_at < p_end"), "the completed_at window is unchanged");
assert(app.includes('client.rpc("gi_dashboard_net_premium", args)'), "the net card still calls the same function");
assert(app.includes('client.rpc("gi_dashboard_sales_by_product", args)'), "the product card still calls the same function");
assert(app.includes('client.rpc("gi_dashboard_sales_by_company", args)'), "the company card still calls the same function");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
