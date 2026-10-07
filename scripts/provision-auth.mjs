#!/usr/bin/env node
/**
 * GI-SEC Tier 2 — helper to provision Supabase Auth identities for active
 * agents that still log in PIN-only (no auth_user_id). This is the safe
 * prerequisite before closing anon access / activating RLS (Pה), so that
 * no active agent gets locked out.
 *
 * It drives the EXISTING gi-provision-agent-auth Edge function:
 *   - preview_missing : lists the agents that would be provisioned (NO writes).
 *   - provision_missing: creates the Auth users + links auth_user_id (writes).
 *
 * Auth: the Edge function requires a manager/admin actor — either a manager
 * JWT (Bearer) or admin credentials (actorUsername + actorPin) that match
 * app_meta.adminAuth or a manager agent verified via gi_verify_agent_login.
 *
 * Usage:
 *   # 1) Preview only (safe, no writes):
 *   GI_ADMIN_USER="מנהל מערכת" GI_ADMIN_PIN="<pin>" node scripts/provision-auth.mjs
 *
 *   # 2) Provision (writes — creates Auth users):
 *   GI_ADMIN_USER="מנהל מערכת" GI_ADMIN_PIN="<pin>" node scripts/provision-auth.mjs --provision
 *
 *   # Optional: override Supabase URL / publishable key / manager JWT:
 *   GI_SUPABASE_URL=...  GI_SUPABASE_KEY=...  GI_MANAGER_JWT=...  node scripts/provision-auth.mjs
 *
 * Exit codes: 0 success, 1 error / nothing to provision / aborted.
 */
"use strict";

const SUPABASE_URL = process.env.GI_SUPABASE_URL || "https://vhvlkerectggovfihjgm.supabase.co";
const SUPABASE_KEY = process.env.GI_SUPABASE_KEY
  || "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
const FN_PATH = "/functions/v1/gi-provision-agent-auth";

function trim(v){ return String(v == null ? "" : v).trim(); }

async function callEdge(action, creds){
  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
  };
  const body = { action };
  if(creds.jwt){
    headers.Authorization = "Bearer " + creds.jwt;
  } else {
    headers.Authorization = "Bearer " + SUPABASE_KEY;
    body.actorUsername = creds.username;
    body.actorPin = creds.pin;
  }
  const res = await fetch(SUPABASE_URL + FN_PATH, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data?.ok === true, status: res.status, data };
}

function getCreds(){
  const jwt = trim(process.env.GI_MANAGER_JWT);
  if(jwt) return { jwt };
  const username = trim(process.env.GI_ADMIN_USER);
  const pin = trim(process.env.GI_ADMIN_PIN);
  if(!username || !pin){
    console.error("Missing admin credentials. Set GI_MANAGER_JWT, or both GI_ADMIN_USER and GI_ADMIN_PIN.");
    console.error("  Example: GI_ADMIN_USER=\"מנהל מערכת\" GI_ADMIN_PIN=\"<pin>\" node scripts/provision-auth.mjs");
    process.exit(1);
  }
  return { username, pin };
}

function printAgents(agents){
  if(!Array.isArray(agents) || !agents.length){
    console.log("  (no agents to provision — all active agents already have an auth_user_id)");
    return;
  }
  const pad = Math.max(4, ...agents.map((a) => String(a.name || "").length));
  console.log("  count = " + agents.length);
  console.log("  " + "name".padEnd(pad) + "  role            email / proposedEmail");
  console.log("  " + "-".repeat(pad) + "  " + "-".repeat(15) + "  " + "-".repeat(40));
  for(const a of agents){
    const name = String(a.name || "").padEnd(pad);
    const role = String(a.role || "agent").padEnd(15);
    const email = a.usingExistingEmail ? ("(existing) " + (a.email || "")) : (a.proposedEmail || "");
    console.log("  " + name + "  " + role + "  " + email);
  }
}

async function main(){
  const doProvision = process.argv.includes("--provision");
  const creds = getCreds();

  console.log(doProvision ? "=== PROVISION (will create Auth users) ===" : "=== PREVIEW (no writes) ===");
  console.log("Endpoint: " + SUPABASE_URL + FN_PATH);
  console.log("Auth: " + (creds.jwt ? "manager JWT" : "admin PIN (" + creds.username + ")"));
  console.log();

  // 1) Always preview first so the operator sees exactly what will change.
  console.log("Step 1/2 — preview_missing ...");
  const preview = await callEdge("preview_missing", creds);
  if(!preview.ok){
    console.error("preview_missing FAILED (HTTP " + preview.status + "):");
    console.error("  " + (preview.data?.error || JSON.stringify(preview.data)));
    process.exit(1);
  }
  const agents = Array.isArray(preview.data?.agents) ? preview.data.agents : [];
  console.log("preview_missing OK — count = " + (preview.data?.count ?? agents.length));
  printAgents(agents);
  console.log();

  if(agents.length === 0){
    console.log("Nothing to provision. All active agents already have an auth_user_id — safe to proceed to RLS cutover (Tier 2, Pה).");
    process.exit(0);
  }

  if(!doProvision){
    console.log("Preview only. To actually create the Auth users, re-run with --provision:");
    console.log("  GI_ADMIN_USER=\"מנהל מערכת\" GI_ADMIN_PIN=\"<pin>\" node scripts/provision-auth.mjs --provision");
    process.exit(0);
  }

  // 2) Provision.
  console.log("Step 2/2 — provision_missing (creating " + agents.length + " Auth users) ...");
  const prov = await callEdge("provision_missing", creds);
  if(!prov.ok){
    console.error("provision_missing FAILED (HTTP " + prov.status + "):");
    console.error("  " + (prov.data?.error || JSON.stringify(prov.data)));
    process.exit(1);
  }
  console.log("provision_missing done:");
  console.log("  created = " + (prov.data?.created ?? 0));
  console.log("  skipped = " + (prov.data?.skipped ?? 0));
  if(Array.isArray(prov.data?.createdAgents) && prov.data.createdAgents.length){
    console.log("  created agents:");
    for(const a of prov.data.createdAgents) console.log("    - " + a.name + "  (" + a.email + ")");
  }
  if(Array.isArray(prov.data?.skippedAgents) && prov.data.skippedAgents.length){
    console.log("  skipped agents (review these):");
    for(const a of prov.data.skippedAgents) console.log("    - " + a.name + "  error: " + (a.error || "?"));
  }
  console.log();
  console.log("NEXT: ask each newly-provisioned agent to log in with their existing PIN and");
  console.log("confirm it works. Then re-run preview (no --provision) — count should be 0.");
  console.log("When count = 0, it is safe to proceed to the RLS cutover (Tier 2, Pה).");
  process.exit(prov.data?.skipped ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL: " + (e?.message || e));
  process.exit(1);
});
