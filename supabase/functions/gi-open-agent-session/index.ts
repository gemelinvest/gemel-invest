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

import { createClient } from "jsr:@supabase/supabase-js@2.49.1";

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
  });
}

/** User token endpoint. The service-role client is for admin calls only. */
function sbAnon(){
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Same pattern as gi-provision-agent-auth, including INTERNAL_AGENT_EMAIL_PATTERN. */
function technicalEmailFor(agentId: string){
  const pattern = Deno.env.get("INTERNAL_AGENT_EMAIL_PATTERN")
    || "agent+<id>@gemel-invest.internal";
  const cleanId = trim(agentId).replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "x";
  return pattern.replace(/<id>/g, cleanId);
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
    const cols = "id,name,username,role,email,auth_user_id,active";
    const byUser = await sb.from("agents").select(cols).eq("username", uname).limit(2);
    if(byUser.error) return json({ ok: false, error: "AGENT_LOOKUP_FAILED: " + trim(byUser.error.message) }, 500);
    let rows = (byUser.data || []) as Json[];
    if(rows.length === 0){
      const byName = await sb.from("agents").select(cols).eq("name", uname).limit(2);
      if(byName.error) return json({ ok: false, error: "AGENT_LOOKUP_FAILED: " + trim(byName.error.message) }, 500);
      rows = (byName.data || []) as Json[];
    }
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
  const verifyData = (verify as Json) || {};
  if(!verify || verifyData.ok !== true){
    const code = trim(verifyData.error) || "BAD_PIN";
    return json({ ok: false, error: code === "LOCKED" ? "ACCOUNT_LOCKED" : "BAD_PIN" }, code === "LOCKED" ? 429 : 401);
  }

  // Sign in with the Auth user's real email. Guessing agent+<id>@... fails when
  // provision used INTERNAL_AGENT_EMAIL_PATTERN or a different address, and the
  // agent then stays anon. After the RLS cutover that looks like empty lists.
  const authUserId = trim(agent.auth_user_id);
  // GoTrue cannot scan a user whose token columns are NULL ("converting NULL
  // to string is unsupported"). That 500s login and the plasma radio save.
  // Repair those columns before the admin read. A missing function must not
  // block agents whose rows are already healthy.
  try {
    await sb.rpc("gi_repair_auth_null_tokens", { p_user_id: authUserId });
  } catch(_repairErr) {}
  let authEmail = "";
  try {
    const { data: got, error: getErr } = await sb.auth.admin.getUserById(authUserId);
    if(getErr) throw getErr;
    authEmail = normalizeEmail(got?.user?.email);
    if(!authEmail){
      authEmail = normalizeEmail(agent.email) || technicalEmailFor(trim(agent.id));
      const { error: emailErr } = await sb.auth.admin.updateUserById(authUserId, {
        email: authEmail,
        email_confirm: true,
      });
      if(emailErr) throw emailErr;
    }
  } catch(err){
    return json({ ok: false, error: "AUTH_USER_LOOKUP_FAILED: " + trim((err as Error)?.message || err || "unknown") }, 500);
  }

  const password = deriveGiAuthPassword(pin, authEmail);
  try {
    const { error: updErr } = await sb.auth.admin.updateUserById(authUserId, {
      password,
      email_confirm: true,
      app_metadata: { agent_id: trim(agent.id), role: trim(agent.role) || "agent" },
    });
    if(updErr) throw updErr;
  } catch(err){
    return json({ ok: false, error: "AUTH_PASSWORD_NORMALIZE_FAILED: " + trim((err as Error)?.message || err || "unknown") }, 500);
  }

  const anon = sbAnon();
  let session: Json | null = null;
  let sessionError = "";
  const signed = await anon.auth.signInWithPassword({ email: authEmail, password });
  if(!signed.error && signed.data?.session){
    session = signed.data.session as unknown as Json;
  } else {
    sessionError = trim(signed.error?.message || signed.error || "");
    // Password grant can still fail (policy / email alias). Issue the session
    // from the admin link after the PIN was already verified.
    const link = await sb.auth.admin.generateLink({ type: "magiclink", email: authEmail });
    const props = (link.data?.properties || {}) as Json;
    const hashed = trim(props.hashed_token);
    if(!link.error && hashed){
      const verified = await anon.auth.verifyOtp({ token_hash: hashed, type: "magiclink" });
      if(!verified.error && verified.data?.session){
        session = verified.data.session as unknown as Json;
        sessionError = "";
      } else if(!sessionError){
        sessionError = trim(verified.error?.message || verified.error || "");
      }
    } else if(!sessionError){
      sessionError = trim(link.error?.message || link.error || "");
    }
  }
  if(!session?.access_token){
    return json({ ok: false, error: "SESSION_OPEN_FAILED: " + (sessionError || "unknown"), fallback: "anon" }, 500);
  }

  return json({
    ok: true,
    agentId: trim(agent.id),
    agentName: trim(agent.name),
    role: trim(agent.role) || "agent",
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
  });
});
