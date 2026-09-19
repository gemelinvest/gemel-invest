/* GI-PERF 2026-09-19 — CRM freeze remediation regression.
   Run: node _test-crm-freeze-fix.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260919-crm-freeze-fix-v1";
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

function sliceFunction(src, startToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  let i = startToken.endsWith("{")
    ? start + startToken.length - 1
    : src.indexOf("{", start);
  if(i < 0) return "";
  let depth = 0;
  for(; i < src.length; i++){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const sql = fs.readFileSync(path.join(ROOT, "supabase-crm-freeze-fix.sql"), "utf8");

console.log("1) syntax + cache tags");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(sw.includes(TAG) || sw.includes("gi-v12-" + TAG), "service worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD tag");

console.log("\n2) MirrorCall watcher no longer seq-scans JSONB");
const fetchMirror = sliceFunction(app, "async fetchRecentOwnedRows(){");
assert(!!fetchMirror, "MirrorCall fetchRecentOwnedRows exists");
assert(fetchMirror.includes("canViewAllCustomers"), "managers skip org-wide remote poll");
assert(fetchMirror.includes('gte("updated_at", since)'), "uses updated_at recent window");
assert(!fetchMirror.includes('filter("payload->mirrorFlow->callSession->>active"'), "no JSONB active filter");
assert(!fetchMirror.includes("payload->mirrorFlow->callSession->>active") || fetchMirror.indexOf("canViewAllCustomers") < fetchMirror.indexOf("updated_at"), "JSONB path removed from primary fetch");
assert(app.includes("intervalMs: 8000") && app.includes("MirrorCallAgentToastWatcher"), "MirrorCall interval raised");

console.log("\n3) app_meta elementary referrals are slimmed on write");
assert(app.includes("function slimElementaryReferralForMeta"), "slim helper exists");
assert(app.includes("slimElementaryReferralForMeta(row"), "buildMetaRow / persist uses slim helper");
assert(app.includes("elementaryReferralPayloadRichness"), "merge preserves richer local payload");
assert(sql.includes("elementaryReferrals"), "SQL slims elementaryReferrals in app_meta");

console.log("\n4) index + stuck-flag + KPI SQL present");
assert(sql.includes("idx_customers_updated_at_desc"), "updated_at index documented");
assert(sql.includes("ANALYZE public.customers"), "ANALYZE customers");
assert(sql.includes("callSession,active"), "stuck active flag cleanup");
assert(sql.includes("created_at >= p_start"), "KPI RPCs pre-filter by date");
assert(sql.includes("gi_dashboard_net_premium"), "net premium RPC replaced");
assert(sql.includes("gi_dashboard_sales_by_product"), "sales_by_product RPC replaced");
assert(sql.includes("gi_dashboard_sales_by_company"), "sales_by_company RPC replaced");

console.log("\n5) manager KPI extras skipped on heavy roster + file-open slim");
assert(app.includes("isHeavyRosterSession?.()") && app.includes("skipExtras = true"), "heavy roster skips KPI extras");
assert(app.includes("CUSTOMER_PAYLOAD_OPEN_SLIM_BYTES"), "open slim threshold");
assert(app.includes("stripGeneratedBlobs(payload)"), "ensureRecordPayload strips generated blobs");
assert(app.includes("estimateRecordPayloadBytes(rec)") && app.includes("CUSTOMER_PAYLOAD_OPEN_SLIM_BYTES"), "open path slims heavy payloads");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\n-----");
console.log("passed=" + passed + " failed=" + failed);
process.exit(0);
