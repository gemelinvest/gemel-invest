/**
 * The plasma wall must not poll the radio table without a session,
 * and daily sales must not unpack every customer before the date filter.
 * Run: node _test-db-health-plasma.js
 */
const fs = require("fs");
const path = require("path");

const js = fs.readFileSync(path.join(__dirname, "plasma.js"), "utf8");
const sql = fs.readFileSync(path.join(__dirname, "supabase-db-health-plasma.sql"), "utf8");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(!js.includes("radioPullShared(false); }, 2000)"), "no two-second radio poll");
assert(js.includes("if (!anon && !sessionFresh(readSession()))"), "no anon key fallback");
assert(js.includes("refreshBlockedUntil"), "token refresh backs off after 429");
assert(js.includes("var KPI_MS = 60000"), "heavy KPIs are not on the 8s loop");
assert(sql.includes("c.updated_at >= p_start or c.created_at >= p_start"), "daily sales filters before unpacking");
assert(sql.includes("idx_customers_live_call_updated"), "live-call index");
assert(sql.includes("statement_timeout = '15s'"), "API queries cannot run for two minutes");

console.log("OK _test-db-health-plasma.js");
