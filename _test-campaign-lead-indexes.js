/**
 * The lead index file only adds two indexes. It does not change rows,
 * policies, functions, or app.js.
 *
 * Run: node _test-campaign-lead-indexes.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const root = __dirname;
const sql = fs.readFileSync(path.join(root, "supabase-campaign-leads-indexes.sql"), "utf8");
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

console.log("1) the file is indexes only");
assert(code.includes("FROM pg_indexes"), "it looks up existing indexes first");
assert(code.includes("idx_campaign_leads_assigned_created"), "the assignment index has a stable name");
assert(code.includes("idx_campaign_leads_description_trgm"), "the description index has a stable name");
assert(code.includes("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_leads_assigned_created"), "the assignment index is created once, outside a transaction");
assert(code.includes("ON public.campaign_leads (assigned_agent_id, created_at DESC)"), "the assignment index matches the existing order");
assert(code.includes("CREATE EXTENSION IF NOT EXISTS pg_trgm"), "trigram support is the same extension already used for customer names");
assert(code.includes("USING gin (description gin_trgm_ops)"), "the description index uses the customer-name pattern");
assert(code.includes("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_leads_description_trgm"), "the description index is created once, outside a transaction");
assert(code.includes("ANALYZE public.campaign_leads"), "planner stats are refreshed after the indexes");
assert(!/drop\s+policy|create\s+policy|alter\s+policy|alter\s+table|update\s+public\.|delete\s+from|insert\s+into/i.test(code), "it does not change rows or policies");
assert(!/create\s+(or\s+replace\s+)?function/i.test(code), "it does not replace a function");
assert(!/gi_dashboard_net_premium|gi_dashboard_sales_by_product|gi_dashboard_sales_by_company/.test(code), "it does not replace the sales card");
assert(!/gi_verify_agent_login|agents\.pin|anon/.test(code), "it does not touch login or the public key");

console.log("2) the screen query this index serves is unchanged");
assert(app.includes("function campaignLeadDescriptionIlikePattern(fragment){"), "the description pattern function is still there");
assert(app.includes('return "%" + raw.replace(/[\\\\%_]/g, (ch) => "\\\\" + ch) + "%"'), "the pattern still has a percent sign on both sides");
assert(app.includes('.order("created_at", { ascending: false })'), "leads are still ordered by created_at descending");
assert(app.includes('.in("assigned_agent_id", agentIds)'), "the assigned-agent filter is still the existing one");
assert(app.includes('.ilike("description", descriptionIlike)'), "the description scan is still the existing one");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
