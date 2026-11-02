// One-time 6-digit login code for CRM agents.
// The code is emailed only to the address saved on that user in user
// settings, and only from the Outlook mailbox that already sends the
// daily sales report (orias@i-s-f.co.il). The browser never receives the
// code, and the server stores only an HMAC.
//
// verify_jwt stays false: the agent has no session yet. Deploy is
// .github/workflows/deploy-login-mail-code.yml on push to main.

import { createClient } from "jsr:@supabase/supabase-js@2.49.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SALES_FROM = "orias@i-s-f.co.il";
const META_KEY = "onyx-login-mail-codes";
const CODE_MS = 10 * 60 * 1000;
const COOL_MS = 60 * 1000;
const MAX_TRIES = 5;
const GRAPH_SCOPE = "offline_access User.Read Mail.Send";

type Json = Record<string, unknown>;

function json(data: Json, status = 200){
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function trim(value: unknown){
  return String(value == null ? "" : value).trim();
}

function normalizeEmail(value: unknown){
  return trim(value).toLowerCase();
}

function mailAddr(value: unknown){
  const text = normalizeEmail(value);
  return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(text) ? text : "";
}

function asObject(value: unknown): Json{
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function sameText(left: string, right: string){
  const a = trim(left);
  const b = trim(right);
  if(!a || a.length !== b.length) return false;
  let out = 0;
  for(let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function storedLoginEmail(agent: Json, security: Json){
  const sec = asObject(security);
  if(sec.pinOnlyLogin === true && !mailAddr(sec.authEmail)){
    return mailAddr(agent.email);
  }
  return mailAddr(sec.authEmail) || mailAddr(agent.email);
}

function loginCodeExpired(exp: unknown, now: number){
  const at = Number(exp);
  return !Number.isFinite(at) || at <= now;
}

function sixDigits(){
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1000000).padStart(6, "0");
}

function bytesToHex(bytes: Uint8Array){
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function pepper(){
  return trim(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
}

async function hmac(secret: string, message: string){
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(sig));
}

function sbAdmin(){
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function sbAnon(){
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function technicalEmailFor(agentId: string){
  const pattern = Deno.env.get("INTERNAL_AGENT_EMAIL_PATTERN") || "agent+<id>@gemel-invest.internal";
  const cleanId = trim(agentId).replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "x";
  return pattern.replace(/<id>/g, cleanId);
}

function loginMailBody(name: string, code: string){
  const who = trim(name) || "נציג";
  return [
    "שלום: " + who,
    "",
    "הסיסמה שלך לכניסה למערכת ONYX: " + code,
    "",
    "הסיסמה תקפה ל-10 דקות בלבד.",
    "אין להעביר אותה לאף אדם אחר.",
  ].join("\n");
}

function codeKey(agentId: string){
  return META_KEY + ":" + trim(agentId);
}

function loginMailErrorCode(message: string){
  const text = trim(message);
  if(text === "MAILBOX_NOT_READY" || text.startsWith("MAILBOX_NOT_READY:")) return "MAILBOX_NOT_READY";
  if(text === "SEND_FAILED" || text.startsWith("SEND_FAILED:")) return "SEND_FAILED";
  if(/permission denied for table gi_daily_sales_mail_account/i.test(text)) return "MAILBOX_NOT_READY";
  if(/outlook|graph\.microsoft|login\.microsoftonline|invalid_grant|aadsts|refresh token|mailbox/i.test(text)) return "MAILBOX_NOT_READY";
  return "SERVER_ERROR";
}

function safeFailureText(err: unknown){
  return trim((err as Error)?.message || err)
    .replace(/eyJ[A-Za-z0-9._\-]+/g, "[redacted]")
    .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, "[email]")
    .slice(0, 240);
}

async function restWriteMeta(row: Json){
  const base = trim(Deno.env.get("SUPABASE_URL")).replace(/\/$/, "");
  const keys = [pepper(), trim(Deno.env.get("SUPABASE_ANON_KEY"))].filter((value, index, list) => value && list.indexOf(value) === index);
  let last = "meta-write";
  for(const apiKey of keys){
    try {
      const res = await fetch(base + "/rest/v1/app_meta?on_conflict=key", {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(row),
      });
      if(res.ok) return;
      last = trim(await res.text()) || last;
    } catch(err){
      last = safeFailureText(err) || last;
    }
  }
  throw new Error(last);
}

async function rememberFailure(step: string, err: unknown){
  try {
    await restWriteMeta({
      key: META_KEY + ":last-error",
      payload: { step, message: safeFailureText(err), at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    });
  } catch(_e) {}
}

async function readCode(sb: ReturnType<typeof sbAdmin>, agentId: string){
  const res = await sb.from("app_meta").select("payload").eq("key", codeKey(agentId)).maybeSingle();
  if(res.error) throw new Error(res.error.message || "meta");
  return asObject(res.data && (res.data as Json).payload);
}

async function writeCode(_sb: ReturnType<typeof sbAdmin>, agentId: string, payload: Json){
  await restWriteMeta({ key: codeKey(agentId), payload, updated_at: new Date().toISOString() });
}

async function clearCode(sb: ReturnType<typeof sbAdmin>, agentId: string){
  const removed = await sb.from("app_meta").delete().eq("key", codeKey(agentId));
  if(removed.error) await writeCode(sb, agentId, { hash: "", exp: 0, tries: 0, sentAt: 0 });
}

async function findLoginAgent(sb: ReturnType<typeof sbAdmin>, username: string){
  const uname = trim(username);
  const cols = "id,name,username,role,email,auth_user_id,active";
  const byUser = await sb.from("agents").select(cols).eq("username", uname).limit(5);
  if(byUser.error) throw new Error(byUser.error.message || "agents");
  let rows = (byUser.data || []) as Json[];
  if(!rows.length){
    const byName = await sb.from("agents").select(cols).eq("name", uname).limit(5);
    if(byName.error) throw new Error(byName.error.message || "agents");
    rows = (byName.data || []) as Json[];
  }
  const active = rows.filter((row) => row.active !== false);
  if(!active.length){
    return { error: rows.length ? "AGENT_DISABLED" : "USER_NOT_FOUND", agent: null as Json | null };
  }
  if(active.length > 1) return { error: "USERNAME_AMBIGUOUS", agent: null as Json | null };
  return { error: "", agent: active[0] };
}

async function loadAgentSecurity(sb: ReturnType<typeof sbAdmin>, agentId: string){
  const res = await sb.from("app_meta").select("payload").eq("key", "global").limit(1);
  if(res.error) throw new Error(res.error.message || "security");
  const payload = asObject(res.data && res.data[0] && (res.data[0] as Json).payload);
  const map = asObject(payload.agentSecurity);
  return asObject(map[agentId]);
}

async function loadSalesAccount(sb: ReturnType<typeof sbAdmin>){
  const res = await sb.from("gi_daily_sales_mail_account").select("*").limit(1);
  if(res.error) throw new Error(res.error.message || "mailbox");
  return (res.data && res.data[0]) ? res.data[0] as Json : null;
}

async function saveSalesTokens(sb: ReturnType<typeof sbAdmin>, account: Json, tokenData: Json){
  const refresh = trim(tokenData.refresh_token) || trim(account.refresh_token);
  const access = trim(tokenData.access_token);
  if(!access) throw new Error("MAILBOX_NOT_READY");
  const row = {
    ...account,
    access_token: access,
    refresh_token: refresh,
    updated_at: new Date().toISOString(),
  };
  const saved = await sb.from("gi_daily_sales_mail_account").upsert(row);
  if(saved.error) throw new Error("MAILBOX_NOT_READY");
}

async function salesAccessToken(sb: ReturnType<typeof sbAdmin>, account: Json){
  const tenant = trim(account.ms_tenant_id) || "common";
  const clientId = trim(account.ms_client_id);
  const clientSecret = trim(account.ms_client_secret);
  const refresh = trim(account.refresh_token);
  if(!clientId || !refresh) throw new Error("MAILBOX_NOT_READY");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refresh,
    grant_type: "refresh_token",
    scope: GRAPH_SCOPE,
  });
  let res: Response;
  try {
    res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch(err){
    throw new Error("MAILBOX_NOT_READY:" + safeFailureText(err));
  }
  let data: Json = {};
  try { data = asObject(await res.json()); } catch(_e) { data = {}; }
  if(!res.ok || !trim(data.access_token)){
    throw new Error("MAILBOX_NOT_READY:" + (trim(data.error_description) || trim(data.error) || String(res.status)));
  }
  return { access: trim(data.access_token), tokenData: data };
}

async function sendSalesCode(access: string, to: string, name: string, code: string){
  const payload = {
    message: {
      subject: "הסיסמה שלך לכניסה למערכת ONYX",
      body: { contentType: "Text", content: loginMailBody(name, code) },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: false,
  };
  let res: Response;
  try {
    res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + access,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch(err){
    throw new Error("SEND_FAILED:" + safeFailureText(err));
  }
  if(!res.ok){
    let detail = "";
    try { detail = trim(await res.text()).slice(0, 180); } catch(_e) { detail = ""; }
    throw new Error("SEND_FAILED:" + (detail || String(res.status)));
  }
}

async function openVerifiedSession(sb: ReturnType<typeof sbAdmin>, agent: Json){
  try {
    const locked = await sb.rpc("gi_lock_agent_auth_identity", { p_agent_id: trim(agent.id) });
    const payload = asObject(locked.data);
    const lockedId = trim(payload.auth_user_id);
    const lockedEmail = normalizeEmail(payload.email);
    if(lockedId) agent.auth_user_id = lockedId;
    if(lockedEmail) agent.email = lockedEmail;
  } catch(_lockErr) {}
  const authUserId = trim(agent.auth_user_id);
  if(!authUserId) return null;
  try { await sb.rpc("gi_repair_auth_null_tokens", { p_user_id: authUserId }); } catch(_e) {}
  let authEmail = "";
  try {
    const got = await sb.auth.admin.getUserById(authUserId);
    if(got.error) throw got.error;
    authEmail = normalizeEmail(got.data?.user?.email);
    if(!authEmail){
      authEmail = mailAddr(agent.email) || technicalEmailFor(trim(agent.id));
      const updated = await sb.auth.admin.updateUserById(authUserId, { email: authEmail, email_confirm: true });
      if(updated.error) throw updated.error;
    }
    const meta = await sb.auth.admin.updateUserById(authUserId, {
      email_confirm: true,
      app_metadata: { agent_id: trim(agent.id), role: trim(agent.role) || "agent" },
    });
    if(meta.error) throw meta.error;
  } catch(_e) {
    return null;
  }
  const link = await sb.auth.admin.generateLink({ type: "magiclink", email: authEmail });
  const props = (link.data?.properties || {}) as Json;
  const hashed = trim(props.hashed_token);
  if(link.error || !hashed) return null;
  const anon = sbAnon();
  const verified = await anon.auth.verifyOtp({ token_hash: hashed, type: "magiclink" });
  const session = verified.data?.session;
  if(verified.error || !session?.access_token) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token || "",
    expires_in: session.expires_in,
    expires_at: session.expires_at,
  };
}

Deno.serve(async (req: Request) => {
  if(req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if(req.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  let body: Json = {};
  try { body = await req.json(); } catch(_e) { return json({ ok: false, error: "INVALID_JSON" }, 400); }
  const action = trim(body.action);
  const username = trim(body.username);
  if(!username) return json({ ok: false, error: "USER_NOT_FOUND" }, 404);
  const sb = sbAdmin();
  const now = Date.now();
  try {
    const found = await findLoginAgent(sb, username);
    if(!found.agent) return json({ ok: false, error: found.error || "USER_NOT_FOUND" }, found.error === "AGENT_DISABLED" ? 403 : 404);
    const agent = found.agent;
    const agentId = trim(agent.id);
    if(action === "request"){
      const typed = mailAddr(body.email);
      const security = await loadAgentSecurity(sb, agentId);
      const stored = storedLoginEmail(agent, security);
      if(!typed || !stored || !sameText(typed, stored)){
        return json({ ok: false, error: "EMAIL_MISMATCH" }, 403);
      }
      const account = await loadSalesAccount(sb);
      if(!account || normalizeEmail(account.connected_email) !== SALES_FROM){
        return json({ ok: false, error: "MAILBOX_NOT_READY" }, 409);
      }
      const current = await readCode(sb, agentId);
      const sentAt = Number(current.sentAt);
      if(Number.isFinite(sentAt) && now - sentAt < COOL_MS && !loginCodeExpired(current.exp, now)){
        return json({ ok: false, error: "COOLDOWN" }, 429);
      }
      if(!pepper()) return json({ ok: false, error: "SERVER_ERROR" }, 500);
      const code = sixDigits();
      const hash = await hmac(pepper(), agentId + ":" + code);
      await writeCode(sb, agentId, { hash, exp: now + CODE_MS, tries: 0, sentAt: now });
      let mailed = false;
      try {
        const token = await salesAccessToken(sb, account);
        await sendSalesCode(token.access, stored, trim(agent.name) || username, code);
        mailed = true;
        try { await saveSalesTokens(sb, account, token.tokenData); }
        catch(saveErr){ await rememberFailure("save-token", saveErr); }
      } catch(sendErr){
        if(!mailed){
          try { await clearCode(sb, agentId); } catch(_rollback) {}
        }
        throw sendErr;
      }
      return json({ ok: true });
    }
    if(action === "verify"){
      const code = trim(body.code).replace(/\D/g, "");
      if(!/^\d{6}$/.test(code)) return json({ ok: false, error: "BAD_CODE" }, 401);
      const current = await readCode(sb, agentId);
      if(!trim(current.hash) || loginCodeExpired(current.exp, now)){
        await clearCode(sb, agentId);
        return json({ ok: false, error: "BAD_CODE" }, 401);
      }
      const tries = Number(current.tries) || 0;
      if(tries >= MAX_TRIES){
        await clearCode(sb, agentId);
        return json({ ok: false, error: "TOO_MANY_TRIES" }, 429);
      }
      const hash = await hmac(pepper(), agentId + ":" + code);
      if(!sameText(hash, trim(current.hash))){
        current.tries = tries + 1;
        await writeCode(sb, agentId, current);
        return json({ ok: false, error: "BAD_CODE" }, 401);
      }
      await clearCode(sb, agentId);
      let session: Json | null = null;
      try { session = await openVerifiedSession(sb, agent); } catch(_e) { session = null; }
      return json({
        ok: true,
        agentId,
        agentName: trim(agent.name),
        username: trim(agent.username) || trim(agent.name),
        role: trim(agent.role) || "agent",
        access_token: session ? session.access_token : "",
        refresh_token: session ? session.refresh_token : "",
        expires_in: session ? session.expires_in : 0,
        expires_at: session ? session.expires_at : 0,
      });
    }
    return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch(err){
    await rememberFailure(action || "request", err);
    const code = loginMailErrorCode(trim((err as Error)?.message || err));
    const status = code === "SEND_FAILED" ? 502 : code === "MAILBOX_NOT_READY" ? 409 : 500;
    return json({ ok: false, error: code }, status);
  }
});
