/**
 * One dashboard read uses the same sale rules as the three existing functions.
 * It does not replace them, and it does not change policies or customer rows.
 *
 * Run: node _test-dashboard-sales-bundle.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = __dirname;
const sql = fs.readFileSync(path.join(root, "supabase-gi-dashboard-sales-bundle.sql"), "utf8");
const stable = fs.readFileSync(path.join(root, "supabase-gi-net-premium-stable.sql"), "utf8");
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

console.log("1) same sale rules, one read, no security change");
assert(code.includes("CREATE OR REPLACE FUNCTION public.gi_dashboard_sales_bundle("), "the bundle name is stable");
assert(!/create\s+or\s+replace\s+function\s+public\.gi_dashboard_net_premium/i.test(code), "net premium function is not replaced");
assert(!/create\s+or\s+replace\s+function\s+public\.gi_dashboard_sales_by_product/i.test(code), "product function is not replaced");
assert(!/create\s+or\s+replace\s+function\s+public\.gi_dashboard_sales_by_company/i.test(code), "company function is not replaced");
assert(code.includes("public.gi_dashboard_agent_in_scope(c.agent_id, c.agent_name, p_agent_ids, p_agent_names)"), "agent scope is the existing function");
assert(code.includes("lower(btrim(coalesce(c.status, ''))) NOT IN ('inactive', 'archived', 'purged')"), "archived customers stay out");
assert(code.includes("btrim(coalesce(c.status, '')) <> 'גנוז'"), "shelved customers stay out");
assert(code.includes("(c.created_at >= p_start AND c.created_at < p_end)"), "the created_at window is unchanged");
assert(code.includes("(c.updated_at >= p_start AND c.updated_at < p_end)"), "the updated_at window is unchanged");
assert(code.includes("(c.completed_at IS NOT NULL AND c.completed_at >= p_start AND c.completed_at < p_end)"), "the completed_at window is unchanged");
assert(code.includes("coalesce(p->>'origin', '') <> 'existing'"), "existing policies stay out");
assert(code.includes("NOT public.gi_is_production_backfill(p)"), "production import stays out");
assert(code.includes("public.gi_dashboard_sale_stamp(p, l.created_at)"), "the sale stamp is unchanged");
assert(code.includes("round(coalesce(sum(public.gi_policy_premium(policy)), 0), 2)"), "net premium is still the after-discount sum");
assert(code.includes("count(DISTINCT customer_id)::bigint"), "client count is still distinct customers");
assert(code.includes("coalesce(nullif(btrim(coalesce(p->>'type', '')), ''), 'אחר')"), "an empty product is still אחר");
assert(code.includes("coalesce(nullif(btrim(coalesce(p->>'company', '')), ''), 'ללא חברה')"), "an empty company is still ללא חברה");
assert(code.includes("round(sum(prem), 2)"), "product and company sums stay rounded to cents");
assert(stable.includes("round(coalesce(sum(gi_policy_premium(policy)), 0), 2)"), "the original net function is still in its file");
assert(!/security\s+definer/i.test(code), "the function runs as the caller");
assert(code.includes("SET search_path = public"), "the function resolves only public objects");
assert(code.includes("GRANT EXECUTE ON FUNCTION public.gi_dashboard_sales_bundle(timestamp with time zone, timestamp with time zone, text[], text[]) TO anon, authenticated"), "execute is limited to the roles that already read the dashboard");
assert(!/grant\s+execute[^;]*to\s+public/i.test(code), "execute is not granted to public");
assert(!/create\s+policy|alter\s+policy|drop\s+policy|alter\s+table|update\s+public\.|delete\s+from|insert\s+into/i.test(code), "rows and policies stay untouched");

console.log("2) the screen uses the bundle and keeps the three calls as fallback");
const loadStart = app.indexOf("Storage.loadServerKpis = async function");
const loadEnd = app.indexOf("Storage.loadTodaySalesAfterDiscount = async function");
const load = app.slice(loadStart, loadEnd);
assert(load.includes('client.rpc("gi_dashboard_sales_bundle", args)'), "the dashboard asks for one read first");
assert(load.includes("if(!dashboardSalesBundleMissing(bundleErr)) throw bundleErr"), "a real failure does not start the three reads as well");
assert(load.includes('client.rpc("gi_dashboard_net_premium", args)'), "net premium remains when the bundle is absent");
assert(load.includes('client.rpc("gi_dashboard_sales_by_product", args)'), "product remains when the bundle is absent");
assert(load.includes('client.rpc("gi_dashboard_sales_by_company", args)'), "company remains when the bundle is absent");
assert(load.includes("if(!usedBundle)"), "the three reads run only when the bundle is absent");
assert(load.includes("if(skipExtras !== true)"), "a heavy session still skips the product list");
assert(load.includes("סשן כבד מדלג על sales_by_product"), "the heavy-session product skip stays");
assert(load.includes('client.rpc("gi_dashboard_agent_appointment", args)'), "the appointment card is a separate read");

console.log("3) bundle rows become the same card fields");
const helperStart = app.indexOf("function mapDashboardSalesBundle");
const helperEnd = app.indexOf("Storage.loadServerKpis = async function");
const missingStart = app.indexOf("function dashboardSalesBundleMissing");
const context = { safeTrim(v){ return String(v == null ? "" : v).trim(); } };
vm.createContext(context);
vm.runInContext(app.slice(missingStart, helperEnd), context);
const mapped = context.mapDashboardSalesBundle([
  { section: "net", net_premium: "120.5", sold_policies: "2", new_clients: "1" },
  { section: "company", label: "הפניקס", policies: "1", premium: "100.5" },
  { section: "company", label: "מגדל", policies: "1", premium: "20" },
  { section: "product", label: "ריסק", policies: "2", premium: "120.5" }
]);
assert(mapped.netPremium === 120.5, "net premium stays 120.5");
assert(mapped.soldPolicies === 2, "sold policies stay 2");
assert(mapped.newClients === 1, "new clients stay 1");
assert(mapped.companyBreakdown[0].label === "הפניקס" && mapped.companyBreakdown[0].premium === 100.5, "the larger company stays first");
assert(mapped.companyBreakdown[1].label === "מגדל" && mapped.companyBreakdown[1].premium === 20, "the smaller company stays second");
assert(mapped.productBreakdown[0].label === "ריסק" && mapped.productBreakdown[0].count === 2, "the product row keeps its count");
assert(mapped.productTotals["ריסק"] === 120.5, "the product total matches the net");
assert(context.dashboardSalesBundleMissing({ code: "PGRST202" }) === true, "a missing function uses the three existing reads");
assert(context.dashboardSalesBundleMissing({ message: "Could not find the function public.gi_dashboard_sales_bundle in the schema cache" }) === true, "a schema-cache miss uses the three existing reads");
assert(context.dashboardSalesBundleMissing({ message: "canceling statement due to statement timeout" }) === false, "a timeout does not start three more scans");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
