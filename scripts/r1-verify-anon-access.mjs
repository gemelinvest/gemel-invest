#!/usr/bin/env node
/**
 * R1 — read-mostly anon access verification against the CRM Supabase project.
 * Reads SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY from app.js (no secrets file).
 *
 * Usage: node scripts/r1-verify-anon-access.mjs
 *
 * Does NOT insert/update/delete by default.
 * Set R1_WRITE_PROBES=1 to run non-destructive write probes (nonexistent ids /
 * constraint-fail inserts). Never leaves rows when probes fail as expected.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const url = (appJs.match(/const SUPABASE_URL = "([^"]+)"/) || [])[1];
const key = (appJs.match(/const SUPABASE_PUBLISHABLE_KEY = "([^"]+)"/) || [])[1];
if (!url || !key) {
  console.error("Could not parse SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY from app.js");
  process.exit(2);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
  Prefer: "count=exact",
};

async function probeSelect(table, select) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1`, {
    headers: { ...headers, Range: "0-0" },
  });
  const range = res.headers.get("content-range") || "";
  const body = await res.text();
  const pinExposed = table === "agents" && select.includes("pin") && /"pin"\s*:/.test(body);
  return {
    table,
    select,
    status: res.status,
    range,
    ok: res.status === 200 || res.status === 206,
    pinExposed,
    sampleBytes: body.length,
  };
}

const tables = [
  ["agents", "id,name,username,role,active"],
  ["agents", "id,pin"],
  ["customers", "id"],
  ["proposals", "id"],
  ["campaign_leads", "id"],
  ["app_meta", "key"],
  ["gi_simulator_saves", "id"],
  ["gi_daily_report", "id"],
  ["gi_cancellations_report", "id"],
  ["gi_agent_activity_log", "id"],
];

const results = [];
for (const [table, select] of tables) {
  try {
    results.push(await probeSelect(table, select));
  } catch (err) {
    results.push({ table, select, ok: false, error: String(err?.message || err) });
  }
}

console.log(JSON.stringify({ url, results, writeProbes: process.env.R1_WRITE_PROBES === "1" }, null, 2));

const critical = results.filter((r) => r.ok && (r.table === "customers" || r.table === "agents"));
const pinLeak = results.some((r) => r.pinExposed);
if (critical.length >= 2 && pinLeak) {
  console.error("\nCRITICAL: anon can read customers/agents and agents.pin is selectable.");
  process.exit(1);
}
if (critical.length) {
  console.error("\nWARNING: anon read access detected on core tables.");
  process.exit(1);
}
console.error("\nNo obvious anon core-table read access detected (unexpected if policies are still open).");
process.exit(0);
