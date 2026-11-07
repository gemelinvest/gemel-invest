#!/usr/bin/env node
/**
 * Read-only check that the public key, with no user session, cannot see
 * the tables the security test read. Prints closed or open. Never prints
 * a row, a pin, a token, the key, or the project address.
 *
 * Run from the repo root: node scripts/gi-anon-door-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function readPublicKey(source){
  const url = (String(source).match(/const SUPABASE_URL = "([^"]+)"/) || [])[1] || "";
  const key = (String(source).match(/const SUPABASE_PUBLISHABLE_KEY = "([^"]+)"/) || [])[1] || "";
  return { url, key };
}

export function restVisible(status, range, body){
  if(status !== 200 && status !== 206) return "no";
  const match = String(range || "").match(/\/(\d+|\*)/);
  if(match && match[1] === "0") return "no";
  if(match && match[1] !== "*") return Number(match[1]) > 0 ? "yes" : "no";
  try {
    const parsed = JSON.parse(body || "");
    if(Array.isArray(parsed)) return parsed.length > 0 ? "yes" : "no";
  } catch(_err) {}
  return "yes";
}

export function pinExposed(status, body){
  if(status !== 200 && status !== 206) return "no";
  return /"pin"\s*:/.test(String(body || "")) ? "yes" : "no";
}

export function storageListed(status, body){
  if(status !== 200) return "no";
  try {
    const parsed = JSON.parse(body || "");
    return Array.isArray(parsed) && parsed.length > 0 ? "yes" : "no";
  } catch(_err) {
    return "yes";
  }
}

const TABLES = [
  ["agents", "id"],
  ["customers", "id"],
  ["proposals", "id"],
  ["campaign_leads", "id"],
  ["app_meta", "key"],
  ["gi_simulator_saves", "id"],
  ["gi_daily_report", "id"],
  ["gi_cancellations_report", "id"],
  ["gi_agent_activity_log", "id"],
  ["reminders", "id"],
  ["agents_history", "history_id"],
  ["customers_history", "history_id"],
  ["proposals_history", "history_id"],
  ["owner_devices", "id"],
  ["gi_agent_live", "id"],
  ["gi_system_notices", "id"],
  ["gi_chat_messages", "id"],
  ["gi_elementary_referrals", "id"]
];

async function main(){
  const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const { url, key } = readPublicKey(source);
  if(!url || !key){
    console.error("missing public project settings");
    process.exit(2);
  }
  const headers = {
    apikey: key,
    Authorization: "Bearer " + key,
    Accept: "application/json",
    Prefer: "count=exact"
  };
  const rows = [];
  for(const [table, column] of TABLES){
    let status = 0;
    let range = "";
    let body = "";
    try {
      const res = await fetch(url + "/rest/v1/" + table + "?select=" + encodeURIComponent(column) + "&limit=1", {
        method: "GET",
        headers: { ...headers, Range: "0-0" }
      });
      status = res.status;
      range = res.headers.get("content-range") || "";
      body = await res.text();
    } catch(_err) {
      rows.push(["table", table], ["visible", "error"], ["http", "failed"]);
      continue;
    }
    rows.push(["table", table], ["visible", restVisible(status, range, body)], ["http", String(status)]);
  }

  try {
    const res = await fetch(url + "/rest/v1/agents?select=pin&limit=1", {
      method: "GET",
      headers: { ...headers, Range: "0-0" }
    });
    const body = await res.text();
    rows.push(["table", "agents_pin"], ["visible", pinExposed(res.status, body)], ["http", String(res.status)]);
  } catch(_err) {
    rows.push(["table", "agents_pin"], ["visible", "error"], ["http", "failed"]);
  }

  try {
    const res = await fetch(url + "/storage/v1/object/list/gi-customer-files", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "", limit: 1 })
    });
    const body = await res.text();
    rows.push(["storage", "gi-customer-files"], ["listed", storageListed(res.status, body)], ["http", String(res.status)]);
  } catch(_err) {
    rows.push(["storage", "gi-customer-files"], ["listed", "error"], ["http", "failed"]);
  }

  try {
    const res = await fetch(url + "/functions/v1/gi-daily-sales-mail", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status" })
    });
    await res.text();
    rows.push(["edge", "gi-daily-sales-mail"], ["open", res.status === 200 ? "yes" : "no"], ["http", String(res.status)]);
  } catch(_err) {
    rows.push(["edge", "gi-daily-sales-mail"], ["open", "error"], ["http", "failed"]);
  }

  for(const [section, detail] of rows){
    console.log(section + "," + detail);
  }
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  main();
}
