// GI-OPEN-AGENT-SESSION — Pג-3: open a Supabase Auth session for an
// agent after their PIN is verified by gi_verify_agent_login. Returns the
// session tokens so the client can make authenticated (JWT) requests,
// which lets RLS enforce per-role access (Pד/Pה).
//
// Additive: if this function fails or is not deployed, login stays
// PIN-based (anon) exactly as today. The client only uses the session
// if this function returns one.
//
// Auth is app-level (admin/manager PIN via gi_verify_agent_login or adminAuth),
// not a user JWT. verify_jwt stays false. Never expose service_role
// to the browser.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2.49.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

function normalizeEmail(v: unknown){
  return trim(v).toLowerCase();
}

/** Same formula as app.js deriveGiAuthPassword and gi-provision-agent-auth. */
function deriveGiAuthPassword(pin: string, email: string){
  return `GiCrm!${trim(pin)}#${normalizeEmail(email)}!v1`;
}

function sbAdmin(){
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: "Bearer " + key, apikey: key },
    },
  });
}

Deno.serve(async (req: Request) => {
  if(req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if(req.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);

  let body: Json = {};
  try {
    body = await req.json();
  } catch(_e) {
    return json({ ok: false, error: "INVALID_JSON" }, 400);
  }

  const agentId = trim(body.agentId);
  const username = trim(body.username) || trim(body.agentName);
  const pin = trim(body.pin);
  if(!agentId && !username) return json({ ok: false, error: "MISSING_AGENT_ID_OR_USERNAME" }, 400);
  if(!pin) return json({ ok: false, error: "MISSING_PIN" }, 400);

  const sb = sbAdmin();

  // Resolve the agent row (id, name, username, role, email, auth_user_id).
  let agent: Json | null = null;
  if(agentId){
    const { data, error } = await sb.from("agents")
      .select("id,name,username,role,email,auth_user_id,active")
      .eq("id", agentId)
      .maybeSingle();
    if(error) return json({ ok: false, error: "AGENT_LOOKUP_FAILED: " + trim(error.message) }, 500);
    agent = data as Json | null;
  } else {
    const uname = username;
    const { data, error } = await sb.from("agents")
      .select("id,name,username,role,email,auth_user_id,active")
      .or([{ column: "username", operator: "eq", value: uname }, { column: "name", operator: "eq", value: uname }])
      .limit(2);
    if(error) return json({ ok: false, error: "AGENT_LOOKUP_FAILED: " + trim(error.message) }, 500);
    const rows = (data || []) as Json[];
    if(rows.length === 0) return json({ ok: false, error: "AGENT_NOT_FOUND" }, 404);
    if(rows.length > 1) return json({ ok: false, error: "USERNAME_AMBIGUOUS" }, 409);
    agent = rows[0];
  }
  if(!agent) return json({ ok: false, error: "AGENT_NOT_FOUND" }, 404);
  if(agent.active === false) return json({ ok: false, error: "AGENT_DISABLED" }, 403);
  if(!agent.auth_user_id) return json({ ok: false, error: "AGENT_HAS_NO_AUTH_ACCOUNT", hint: "Run provision_missing first." }, 409);

  // Verify the PIN via the existing security-definer RPC (records brute-force attempts).
  const { data: verify, error: verifyErr } = await sb.rpc("gi_verify_agent_login", {
    p_username: trim(agent.username) || trim(agent.name),
    p_pin: pin,
  });
  if(verifyErr) return json({ ok: false, error: "PIN_VERIFY_FAILED: " + trim(verifyErr.message) }, 500);
  if(!verify || (verify as Json).ok !== true){
    const code = trim((verify as Json)?.error) || "BAD_PIN");
    return json({ ok: false, error: code === "LOCKED" ? "ACCOUNT_LOCKED" : "BAD_PIN" }, code === "LOCKED" ? 429 : 401);
  }

  // Derive the deterministic password (same as gi-provision-agent-auth sync) and sign in.
  const authEmail = normalizeEmail(agent.email) || `agent+${trim(agent.id).replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}@gemel-invest.internal`;
  const password = deriveGiAuthPassword(pin, authEmail);

  const { data: signIn, error: signInErr } = await sb.auth.signInWithPassword({
    email: authEmail,
    password,
  });
  if(signInErr || !signIn?.session){
    // Best-effort: do not break login. The client falls back to anon.
    return json({ ok: false, error: "SESSION_OPEN_FAILED: " + trim(signInErr?.message || signInErr || "unknown"), fallback: "anon" }, 500);
  }

  // Return the session tokens. The client stores them via supabase.auth.setSession.
  return json({
    ok: true,
    agentId: trim(agent.id),
    agentName: trim(agent.name),
    role: trim(agent.role) || "agent",
    access_token: signIn.session.access_token,
    refresh_token: signIn.session.refresh_token,
    expires_in: signIn.session.expires_in,
    expires_at: signIn.session.expires_at,
  });
});
