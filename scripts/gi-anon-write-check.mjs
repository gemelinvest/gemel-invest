#!/usr/bin/env node
/**
 * Check that the public key, with no user session, cannot write the CRM
 * tables. The first attempt uses a timestamp that cannot be saved. A normal
 * row is sent only when that attempt was refused for a bad value rather than
 * for permissions. A text id that the column cannot hold is retried once as
 * a fixed probe uuid. Any row that still appears is removed by that exact
 * probe id. Prints closed or open. Never prints a row, a pin, a token, the
 * key, or the project address.
 *
 * Run from the repo root: node scripts/gi-anon-write-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const WRITE_PROBE_ID = "__gi_write_probe__";
export const WRITE_PROBE_UUID = "00000000-0000-4000-8000-000000000766";
export const WRITE_PROBE_NUM = "766000766";

export const WRITE_TABLES = [
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

export function errorCode(body){
  try {
    const code = String(JSON.parse(body || "").code || "");
    return /^[0-9A-Z]{5}$/.test(code) ? code : "";
  } catch(_err) {
    return "";
  }
}

export function classifyWrite(status, body){
  const code = Number(status) || 0;
  const text = String(body || "");
  const pg = errorCode(body);
  if(pg === "428C9" || pg === "23505" || pg === "22003") return "blocked";
  if(code === 401 || code === 403 || pg === "42501") return "rejected";
  if(/row-level security|permission denied/i.test(text)) return "rejected";
  if(code >= 200 && code < 300) return "accepted";
  if(code >= 400) return "aborted";
  return "error";
}

export function rowPresent(status, body){
  if(status !== 200 && status !== 206) return false;
  try {
    const parsed = JSON.parse(body || "");
    return Array.isArray(parsed) && parsed.length > 0;
  } catch(_err) {
    return String(body || "").length > 0;
  }
}

export function probeBody(pk, mode, id = WRITE_PROBE_ID){
  const value = id === WRITE_PROBE_NUM ? Number(WRITE_PROBE_NUM) : id;
  const body = { [pk]: value };
  if(mode === "safe") body.created_at = "not-a-timestamp";
  return body;
}

export function probeFilter(pk, id = WRITE_PROBE_ID){
  if(id !== WRITE_PROBE_ID && id !== WRITE_PROBE_UUID && id !== WRITE_PROBE_NUM) throw new Error("probe id drifted");
  return pk + "=eq." + id;
}

async function postProbe(request, table, pk, mode, id){
  const sent = await request("POST", table, pk, probeBody(pk, mode, id), id);
  return { sent, verdict: classifyWrite(sent.status, sent.body), code: errorCode(sent.body), id };
}

export async function checkTable(request, table, pk){
  const rows = [["table", table]];
  const before = await request("GET", table, pk, null, WRITE_PROBE_ID);
  if(rowPresent(before.status, before.body)){
    const left = await removeProbe(request, table, pk, WRITE_PROBE_ID);
    rows.push(["insert", "preexisting"], ["http", String(before.status)], ["code", "none"], ["present", "yes"], ["left", left]);
    return rows;
  }

  let result = await postProbe(request, table, pk, "safe", WRITE_PROBE_ID);
  if(result.verdict === "aborted" && result.code !== "428C9"){
    const minimal = await postProbe(request, table, pk, "minimal", WRITE_PROBE_ID);
    result = minimal.verdict === "rejected" || minimal.verdict === "blocked" ? minimal : result.verdict === "accepted" ? result : minimal;
    if(minimal.verdict === "aborted" && minimal.code === "22P02"){
      const typed = await postProbe(request, table, pk, "minimal", WRITE_PROBE_UUID);
      result = typed;
      if(typed.verdict === "aborted" && typed.code === "22P02"){
        result = await postProbe(request, table, pk, "minimal", WRITE_PROBE_NUM);
      }
    }
  }

  const after = await request("GET", table, pk, null, result.id);
  let left = "no";
  if(result.verdict === "accepted") left = await removeProbe(request, table, pk, result.id);
  rows.push(
    ["insert", result.verdict],
    ["http", String(result.sent.status || "failed")],
    ["code", result.code || "none"],
    ["present", rowPresent(after.status, after.body) ? "yes" : "no"],
    ["left", left]
  );
  return rows;
}

async function removeProbe(request, table, pk, id){
  await request("DELETE", table, pk, null, id);
  let seen = await request("GET", table, pk, null, id);
  if(!rowPresent(seen.status, seen.body)) return "no";
  if(table === "customers"){
    await request("PATCH", table, pk, {
      status: "purged",
      is_archived: true,
      payload: {}
    }, id);
    seen = await request("GET", table, pk, null, id);
    if(!rowPresent(seen.status, seen.body)) return "no";
  }
  return "yes";
}

export async function runWriteCheck(options){
  const request = options.request;
  const tables = options.tables || WRITE_TABLES;
  const rows = [];
  for(const [table, pk] of tables){
    try {
      rows.push(...await checkTable(request, table, pk));
    } catch(_err) {
      rows.push(["table", table], ["insert", "error"], ["http", "failed"], ["code", "none"], ["present", "no"], ["left", "yes"]);
    }
  }
  return rows;
}

export function writeCheckFailed(rows){
  for(let i = 0; i < rows.length; i += 1){
    if(rows[i][0] === "insert" && rows[i][1] !== "rejected" && rows[i][1] !== "blocked") return true;
    if(rows[i][0] === "left" && rows[i][1] !== "no") return true;
  }
  return false;
}

function makeRequest(url, key, fetchImpl){
  const headers = {
    apikey: key,
    Authorization: "Bearer " + key,
    Accept: "application/json",
    "Content-Type": "application/json"
  };
  return async function request(method, table, pk, body, id = WRITE_PROBE_ID){
    const filter = probeFilter(pk, id);
    const target = method === "POST"
      ? url + "/rest/v1/" + table
      : url + "/rest/v1/" + table + "?" + filter;
    const res = await fetchImpl(target, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.text() };
  };
}

async function main(){
  const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const url = (String(source).match(/const SUPABASE_URL = "([^"]+)"/) || [])[1] || "";
  const key = (String(source).match(/const SUPABASE_PUBLISHABLE_KEY = "([^"]+)"/) || [])[1] || "";
  if(!url || !key){
    console.error("missing public project settings");
    process.exit(2);
  }
  const rows = await runWriteCheck({ request: makeRequest(url, key, globalThis.fetch) });
  for(const [section, detail] of rows){
    console.log(section + "," + detail);
  }
  if(writeCheckFailed(rows)) process.exit(1);
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  main();
}
