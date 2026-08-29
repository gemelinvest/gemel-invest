// GI-ASSISTANT-PAIRING — one-time QR tokens + device bind.
// Auth is app-level (agents.pin), not Supabase JWT. Never put user_id in the QR.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOKEN_TTL_MS = 5 * 60 * 1000;

type Json = Record<string, unknown>;

function json(data: Json, status = 200){
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function trim(v: unknown){
  return String(v == null ? "" : v).trim();
}

function sbAdmin(){
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function pinsMatch(stored: unknown, provided: string){
  const left = trim(stored);
  const right = trim(provided);
  if(!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for(let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

async function audit(sb: SupabaseClient, row: Json){
  try {
    await sb.from("gi_assistant_audit_log").insert({
      user_id: trim(row.user_id) || null,
      session_id: trim(row.session_id) || null,
      action: trim(row.action) || "pairing",
      tool: "pairing",
      arguments_safe: row.arguments_safe && typeof row.arguments_safe === "object" ? row.arguments_safe : {},
      authorization_result: trim(row.authorization_result) || null,
      execution_status: trim(row.execution_status) || null,
      error: trim(row.error) || null,
    });
  } catch(_e) {}
}

type AgentRow = {
  id?: string;
  name?: string;
  username?: string;
  role?: string;
  pin?: string;
  active?: boolean;
};

async function findAgent(sb: SupabaseClient, body: Json): Promise<AgentRow | null> {
  const id = trim(body.agentId);
  const name = trim(body.agentName);
  const username = trim(body.username);
  const select = "id,name,username,role,pin,active";
  if(id){
    const byId = await sb.from("agents").select(select).eq("id", id).maybeSingle();
    if(byId.data) return byId.data as AgentRow;
  }
  if(username){
    const byUser = await sb.from("agents").select(select).eq("username", username).limit(2);
    const rows = Array.isArray(byUser.data) ? byUser.data : [];
    if(rows.length === 1) return rows[0] as AgentRow;
  }
  if(name){
    const byName = await sb.from("agents").select(select).eq("name", name).limit(2);
    const rows = Array.isArray(byName.data) ? byName.data : [];
    if(rows.length === 1) return rows[0] as AgentRow;
  }
  return null;
}

async function requireAgentWithPin(sb: SupabaseClient, body: Json){
  const pin = trim(body.pin);
  if(!pin) return { ok: false as const, error: "MISSING_PIN", status: 400 };
  const agent = await findAgent(sb, body);
  if(!agent || agent.active === false || !pinsMatch(agent.pin, pin)){
    return { ok: false as const, error: "AUTH_FAILED", status: 401 };
  }
  return { ok: true as const, agent };
}

async function hasActiveDevice(sb: SupabaseClient, agentId: string){
  const { data, error } = await sb.from("gi_assistant_devices")
    .select("id")
    .eq("agent_id", agentId)
    .is("revoked_at", null)
    .limit(1);
  if(error) throw new Error(error.message);
  return !!(data && data.length);
}

async function createToken(sb: SupabaseClient, agent: AgentRow){
  const publicToken = randomToken();
  const desktopSecret = randomToken();
  const tokenHash = await sha256Hex(publicToken);
  const desktopHash = await sha256Hex(desktopSecret);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const { error } = await sb.from("gi_assistant_pairing_tokens").insert({
    token_hash: tokenHash,
    desktop_secret_hash: desktopHash,
    agent_id: trim(agent.id),
    expires_at: expiresAt,
  });
  if(error) throw new Error(error.message);
  return { publicToken, desktopSecret, expiresAt };
}

async function handleCreate(sb: SupabaseClient, body: Json){
  const auth = await requireAgentWithPin(sb, body);
  if(!auth.ok){
    await audit(sb, { action: "pairing_create", authorization_result: "denied", execution_status: "error", error: auth.error });
    return json({ ok: false, error: auth.error }, auth.status);
  }
  const agentId = trim(auth.agent.id);
  if(await hasActiveDevice(sb, agentId)){
    await audit(sb, { user_id: agentId, action: "pairing_create", authorization_result: "ok", execution_status: "already_paired", arguments_safe: { alreadyPaired: true } });
    return json({ ok: true, alreadyPaired: true, agentId });
  }
  const created = await createToken(sb, auth.agent);
  await audit(sb, { user_id: agentId, action: "pairing_create", authorization_result: "ok", execution_status: "ok", arguments_safe: { ttlSec: TOKEN_TTL_MS / 1000 } });
  return json({
    ok: true,
    alreadyPaired: false,
    publicToken: created.publicToken,
    desktopSecret: created.desktopSecret,
    expiresAt: created.expiresAt,
  });
}

async function tokenByDesktopSecret(sb: SupabaseClient, secret: string){
  const hash = await sha256Hex(trim(secret));
  const { data, error } = await sb.from("gi_assistant_pairing_tokens")
    .select("id,agent_id,expires_at,used_at,cancelled_at")
    .eq("desktop_secret_hash", hash)
    .maybeSingle();
  if(error) throw new Error(error.message);
  return data;
}

function tokenStatus(row: { expires_at?: string; used_at?: string | null; cancelled_at?: string | null } | null){
  if(!row) return "missing";
  if(row.cancelled_at) return "cancelled";
  if(row.used_at) return "paired";
  if(row.expires_at && Date.parse(row.expires_at) <= Date.now()) return "expired";
  return "pending";
}

async function handleStatus(sb: SupabaseClient, body: Json){
  const secret = trim(body.desktopSecret);
  if(!secret) return json({ ok: false, error: "MISSING_SECRET" }, 400);
  const row = await tokenByDesktopSecret(sb, secret);
  return json({ ok: true, status: tokenStatus(row) });
}

async function handleCancel(sb: SupabaseClient, body: Json){
  const secret = trim(body.desktopSecret);
  if(!secret) return json({ ok: false, error: "MISSING_SECRET" }, 400);
  const row = await tokenByDesktopSecret(sb, secret);
  if(!row) return json({ ok: true, status: "missing" });
  if(!row.used_at && !row.cancelled_at){
    await sb.from("gi_assistant_pairing_tokens")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("used_at", null);
  }
  return json({ ok: true, status: row.used_at ? "paired" : "cancelled" });
}

async function handleConsume(sb: SupabaseClient, body: Json, req: Request){
  const publicToken = trim(body.publicToken);
  if(!publicToken) return json({ ok: false, error: "MISSING_TOKEN" }, 400);
  const auth = await requireAgentWithPin(sb, body);
  if(!auth.ok){
    await audit(sb, { action: "pairing_consume", authorization_result: "denied", execution_status: "error", error: auth.error });
    return json({ ok: false, error: auth.error }, auth.status);
  }
  const tokenHash = await sha256Hex(publicToken);
  const now = new Date().toISOString();
  const existing = await sb.from("gi_assistant_pairing_tokens")
    .select("id,agent_id,expires_at,used_at,cancelled_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if(existing.error) throw new Error(existing.error.message);
  const row = existing.data;
  if(!row || row.used_at || row.cancelled_at || (row.expires_at && Date.parse(row.expires_at) <= Date.now())){
    await audit(sb, { user_id: trim(auth.agent.id), action: "pairing_consume", authorization_result: "denied", execution_status: "error", error: "TOKEN_INVALID" });
    return json({ ok: false, error: "TOKEN_INVALID" }, 409);
  }
  if(trim(row.agent_id) !== trim(auth.agent.id)){
    await audit(sb, { user_id: trim(auth.agent.id), action: "pairing_consume", authorization_result: "denied", execution_status: "error", error: "AGENT_MISMATCH" });
    return json({ ok: false, error: "AGENT_MISMATCH" }, 403);
  }
  const claimed = await sb.from("gi_assistant_pairing_tokens")
    .update({ used_at: now })
    .eq("id", row.id)
    .is("used_at", null)
    .is("cancelled_at", null)
    .gt("expires_at", now)
    .select("id,agent_id")
    .maybeSingle();
  if(claimed.error) throw new Error(claimed.error.message);
  if(!claimed.data){
    await audit(sb, { user_id: trim(auth.agent.id), action: "pairing_consume", authorization_result: "denied", execution_status: "error", error: "TOKEN_INVALID" });
    return json({ ok: false, error: "TOKEN_INVALID" }, 409);
  }
  const devicePublicId = randomToken();
  const deviceSecret = randomToken();
  const deviceSecretHash = await sha256Hex(deviceSecret);
  const { error } = await sb.from("gi_assistant_devices").insert({
    agent_id: trim(auth.agent.id),
    device_public_id: devicePublicId,
    device_secret_hash: deviceSecretHash,
    user_agent: trim(req.headers.get("user-agent")).slice(0, 240),
  });
  if(error) throw new Error(error.message);
  await audit(sb, { user_id: trim(auth.agent.id), action: "pairing_consume", authorization_result: "ok", execution_status: "ok", arguments_safe: { deviceBound: true } });
  return json({
    ok: true,
    devicePublicId,
    deviceSecret,
    agentId: trim(auth.agent.id),
    agentName: trim(auth.agent.name),
    agentRole: trim(auth.agent.role) || "agent",
  });
}

Deno.serve(async (req) => {
  if(req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if(req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);
  let body: Json = {};
  try { body = await req.json(); } catch(_e) { body = {}; }
  const action = trim(body.action);
  const sb = sbAdmin();
  try {
    if(action === "create") return await handleCreate(sb, body);
    if(action === "status") return await handleStatus(sb, body);
    if(action === "cancel") return await handleCancel(sb, body);
    if(action === "consume") return await handleConsume(sb, body, req);
    return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch(err) {
    const message = err instanceof Error ? err.message : String(err);
    await audit(sb, { action: "pairing_" + action, execution_status: "error", error: "SERVER" });
    return json({ ok: false, error: "SERVER", detail: message }, 500);
  }
});
