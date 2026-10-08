// GI-PROVISION-AGENT-AUTH — sync a typed CRM PIN onto public.agents.pin
// and, when an Auth user already exists, onto that user's password.
//
// Narrower than the 2026-09-16 rollback:
//   - Never creates Auth users (that forced MFA onto agents with no email).
//   - sync never changes pinOnlyLogin / mfaRequired.
//   - PIN-only agents get agents.pin only.
//   - reset_mfa deletes Auth MFA factors so the next login must scan a new barcode.
//     It does not change pinOnlyLogin and does not enroll a factor by itself.
//   - clear_login_lock / list_login_locks only read or delete gi_login_attempts.
//     They do not change the PIN, the lock duration, or gi_verify_agent_login.
//
// Auth is app-level (admin/manager PIN via gi_verify_agent_login or adminAuth),
// not a user JWT. verify_jwt stays false. Never expose service_role to the browser.

import { createClient, type SupabaseClient, type User } from "jsr:@supabase/supabase-js@2.49.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_ADMIN_NAMES = ["איתי סומך", "סוניה ארנשטיין", "אוריה סומך", "מנהל מערכת", "מפתח המערכת"];

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

function roleCode(raw: unknown){
  return trim(raw).toLowerCase().replace(/[\s_-]+/g, "");
}

function isProvisionAdmin(actor: { role?: unknown; name?: unknown; username?: unknown }){
  const role = roleCode(actor.role);
  if(role === "admin" || role === "owner" || role === "manager" || role === "adminlite" || role === "מנהל") return true;
  const name = trim(actor.name) || trim(actor.username);
  return SYSTEM_ADMIN_NAMES.includes(name);
}

/** Same formula as app.js deriveGiAuthPassword — unique enough to pass HIBP / min length. */
function deriveGiAuthPassword(pin: string, email: string){
  return `GiCrm!${trim(pin)}#${normalizeEmail(email)}!v1`;
}

function isWeakPasswordError(err: unknown){
  const msg = trim((err as { message?: unknown })?.message || err);
  const code = trim((err as { code?: unknown })?.code).toLowerCase();
  if(code === "weak_password") return true;
  return /weak|easy to guess|hibp|pwned|leaked|too short|at least \d+ character|password.*invalid/i.test(msg);
}

function isPinOnlyFlag(v: unknown){
  return v === true || v === "true" || v === 1 || v === "1";
}

function sbAdmin(){
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  /* Force service_role on PostgREST / Auth Admin only.
     GET /auth/v1/user must keep the manager JWT — service_role has no `sub`
     and GoTrue returns 403 invalid claim: missing sub claim. */
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: "Bearer " + key, apikey: key },
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const dest = String(typeof input === "string" ? input : (input instanceof Request ? input.url : input));
        const headers = new Headers(init?.headers);
        if(!/\/auth\/v1\/user\/?(\?|$)/.test(dest)){
          headers.set("Authorization", "Bearer " + key);
          headers.set("apikey", key);
        }
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** Verify the manager JWT without going through sbAdmin's service_role fetch. */
async function getAuthUserByAccessToken(token: string){
  const url = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const apikey = Deno.env.get("SUPABASE_ANON_KEY")
    || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || "";
  const res = await fetch(url + "/auth/v1/user", {
    headers: {
      Authorization: "Bearer " + token,
      apikey,
    },
  });
  const data = await res.json().catch(() => ({})) as Json;
  if(!res.ok){
    return { user: null as User | null, error: trim(data.message || data.error_description || data.msg || res.status) };
  }
  const id = trim(data.id);
  if(!id) return { user: null as User | null, error: "no_sub" };
  return { user: data as unknown as User, error: "" };
}

function bearerToken(req: Request){
  const raw = trim(req.headers.get("authorization"));
  if(!raw) return "";
  const token = raw.replace(/^Bearer\s+/i, "").trim();
  if(!token || token.startsWith("sb_publishable_") || token.startsWith("sb_secret_")) return "";
  return token.split(".").length === 3 ? token : "";
}

async function verifyAdminActor(sb: SupabaseClient, req: Request, body: Json){
  const username = trim(body.actorUsername) || trim(body.actorName);
  const pin = trim(body.actorPin);
  const token = bearerToken(req);
  const reasons: string[] = [];

  if(token){
    const got = await getAuthUserByAccessToken(token);
    const user = got.user;
    if(!user?.id){
      reasons.push("session_invalid");
      try { console.log("GI_PROVISION_GATE session_invalid " + got.error); } catch(_e) {}
    } else {
      const byAuthId = await sb.from("agents")
        .select("id,name,username,role,active")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      let agent = byAuthId.data as Json | null;
      if(!agent && normalizeEmail(user.email)){
        const byEmail = await sb.from("agents")
          .select("id,name,username,role,active")
          .eq("email", normalizeEmail(user.email))
          .maybeSingle();
        agent = byEmail.data as Json | null;
      }
      if(!agent){
        reasons.push("session_not_linked_to_agent");
      } else if(agent.active === false){
        reasons.push("session_agent_disabled");
      } else {
        const actor = {
          id: trim(agent.id),
          name: trim(agent.name),
          username: trim(agent.username) || trim(agent.name),
          role: trim(agent.role) || "agent",
        };
        if(isProvisionAdmin(actor)) return { ok: true as const, actor, via: "session" };
        return {
          ok: false as const,
          res: json({
            ok: false,
            error: "רק מנהל או מנהל מערכת יכול לשנות קוד כניסה. התפקיד המחובר: " + actor.role,
            reason: "session_not_manager",
          }, 403),
        };
      }
    }
  }

  if(username && pin){
    const { data: metaRow } = await sb.from("app_meta").select("payload").eq("key", "global").maybeSingle();
    const payload = (metaRow?.payload && typeof metaRow.payload === "object") ? metaRow.payload as Json : {};
    const adminAuth = (payload.adminAuth && typeof payload.adminAuth === "object") ? payload.adminAuth as Json : {};
    if(adminAuth.active !== false
      && trim(adminAuth.username) === username
      && trim(adminAuth.pin) === pin){
      return { ok: true as const, actor: { id: "", name: trim(adminAuth.username), username, role: "admin" }, via: "adminAuth" };
    }

    const { data, error } = await sb.rpc("gi_verify_agent_login", {
      p_username: username,
      p_pin: pin,
    });
    if(error){
      reasons.push("pin_rpc_error");
      try { console.log("GI_PROVISION_GATE pin_rpc_error " + trim(error.message)); } catch(_e) {}
    } else if(!data || (data as Json).ok !== true) {
      reasons.push("pin_" + (trim((data as Json)?.error) || "rejected").toLowerCase());
    } else {
      const verified = data as Json;
      const actor = {
        id: trim(verified.agentId),
        name: trim(verified.agentName),
        username: trim(verified.username) || username,
        role: trim(verified.role) || "agent",
      };
      if(!isProvisionAdmin(actor)){
        return {
          ok: false as const,
          res: json({
            ok: false,
            error: "רק מנהל או מנהל מערכת יכול לשנות קוד כניסה. התפקיד המחובר: " + actor.role,
            reason: "pin_not_manager",
          }, 403),
        };
      }
      return { ok: true as const, actor, via: "pin" };
    }
  } else if(!token) {
    reasons.push("no_credentials");
  }

  const hint = reasons.includes("pin_bad_pin")
    ? "קוד הכניסה של המנהל לא תואם. התנתק, היכנס מחדש ונסה לשמור שוב."
    : reasons.includes("session_not_linked_to_agent")
      ? "החיבור המאובטח שלך לא מקושר לרשומת נציג."
      : reasons.includes("no_credentials")
        ? "לא נמצאו פרטי מנהל מאומתים. התנתק והיכנס מחדש ואז שמור שוב."
        : "לא הצלחתי לאמת שאתה מנהל. התנתק, היכנס מחדש ונסה שוב.";

  try { console.log("GI_PROVISION_GATE fail " + (reasons.join(",") || "unauthorized")); } catch(_e) {}
  return {
    ok: false as const,
    res: json({ ok: false, error: "אין הרשאה — " + hint, reason: reasons.join(",") || "unauthorized" }, 401),
  };
}

async function findAuthUserByEmail(sb: SupabaseClient, email: string){
  const target = normalizeEmail(email);
  if(!target) return null;
  let page = 1;
  while(page <= 20){
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if(error) throw error;
    const users = data?.users || [];
    const found = users.find((u) => normalizeEmail(u.email) === target);
    if(found) return found;
    if(users.length < 200) return null;
    page += 1;
  }
  return null;
}

async function readPinOnlyFlag(sb: SupabaseClient, agentId: string, bodyFlag: unknown){
  if(isPinOnlyFlag(bodyFlag)) return true;
  const { data: metaRow } = await sb.from("app_meta").select("payload").eq("key", "global").maybeSingle();
  const payload = (metaRow?.payload && typeof metaRow.payload === "object") ? metaRow.payload as Json : {};
  const map = (payload.agentSecurity && typeof payload.agentSecurity === "object") ? payload.agentSecurity as Record<string, Json> : {};
  const entry = map[agentId];
  return isPinOnlyFlag(entry?.pinOnlyLogin) || isPinOnlyFlag(entry?.pin_only_login);
}

async function setExistingAuthPassword(sb: SupabaseClient, params: {
  email: string;
  pin: string;
  existing: User;
  appMetadata: Json;
}){
  const email = normalizeEmail(params.email);
  const pin = trim(params.pin);
  const attempts: Array<{ password: string; scheme: "pin" | "gi-v1" }> = [
    { password: pin, scheme: "pin" },
    { password: deriveGiAuthPassword(pin, email), scheme: "gi-v1" },
  ];
  let lastErr = "PASSWORD_REJECTED";

  for(const attempt of attempts){
    try {
      const { data, error } = await sb.auth.admin.updateUserById(params.existing.id, {
        password: attempt.password,
        email_confirm: true,
        app_metadata: params.appMetadata,
      });
      if(error) throw error;
      return { user: data.user, passwordScheme: attempt.scheme };
    } catch(err) {
      lastErr = trim((err as { message?: unknown })?.message || err);
      if(!isWeakPasswordError(err)) throw err;
    }
  }
  throw new Error(
    "סיסמת Auth נדחתה (בדיקת סיסמה חלשה / אורך מינימלי). "
    + lastErr
  );
}

/** Generate a strong random password the agent never types (login stays PIN-based via RPC). */
function randomPassword(len = 24){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for(let i = 0; i < len; i += 1) out += chars[bytes[i] % chars.length];
  return out + "!Aa1";
}

/** Technical internal email for agents without one. Pattern is configurable
 * via the internal_agent_email_pattern setting (default agent+<id>@gemel-invest.internal). */
function technicalEmailFor(agentId: string){
  const pattern = Deno.env.get("INTERNAL_AGENT_EMAIL_PATTERN")
    || "agent+<id>@gemel-invest.internal";
  const cleanId = trim(agentId).replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "x";
  return pattern.replace(/<id>/g, cleanId);
}

/** List active agents without auth_user_id. */
async function listMissingAgents(sb: SupabaseClient){
  const { data, error } = await sb.from("agents")
    .select("id,name,username,role,email,auth_user_id,active")
    .is("auth_user_id", null)
    .order("role", { ascending: true });
  if(error) throw error;
  const rows = (data || []) as Json[];
  // Keep only active (active true or null treated as active).
  return rows.filter((r) => r.active !== false).map((r) => ({
    id: trim(r.id),
    name: trim(r.name),
    username: trim(r.username) || trim(r.name),
    role: trim(r.role) || "agent",
    email: normalizeEmail(r.email),
    proposedEmail: normalizeEmail(r.email) || technicalEmailFor(trim(r.id)),
  usingExistingEmail: !!normalizeEmail(r.email),
  auth_user_id: trim(r.auth_user_id) || "",
  active: r.active !== false,
  }));
}

async function listAuthFactors(sb: SupabaseClient, userId: string){
  const url = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const headers = { Authorization: "Bearer " + key, apikey: key };
  let listError = "";
  try {
    const res = await fetch(url + "/auth/v1/admin/users/" + encodeURIComponent(userId) + "/factors", { headers });
    const data = await res.json().catch(() => null);
    if(res.ok){
      if(Array.isArray(data)) return { ok: true as const, factors: data as Json[], error: "" };
      if(data && typeof data === "object" && Array.isArray((data as Json).factors)){
        return { ok: true as const, factors: (data as Json).factors as Json[], error: "" };
      }
      return { ok: true as const, factors: [] as Json[], error: "" };
    }
    listError = trim((data as Json | null)?.message || (data as Json | null)?.error || res.status);
  } catch(err) {
    listError = trim((err as { message?: unknown })?.message || err);
  }
  const got = await sb.auth.admin.getUserById(userId);
  const user = got.data?.user as (User & { factors?: Json[] }) | undefined;
  if(Array.isArray(user?.factors)) return { ok: true as const, factors: user.factors, error: "" };
  if(got.error || !user){
    return { ok: false as const, factors: [] as Json[], error: listError || trim(got.error?.message) || "LIST_FACTORS_FAILED" };
  }
  if(!listError) return { ok: true as const, factors: [] as Json[], error: "" };
  return { ok: false as const, factors: [] as Json[], error: listError || "LIST_FACTORS_FAILED" };
}

async function deleteAuthFactor(userId: string, factorId: string){
  const url = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const res = await fetch(
    url + "/auth/v1/admin/users/" + encodeURIComponent(userId) + "/factors/" + encodeURIComponent(factorId),
    {
      method: "DELETE",
      headers: { Authorization: "Bearer " + key, apikey: key },
    }
  );
  if(res.ok || res.status === 404) return { ok: true as const, error: "" };
  const data = await res.json().catch(() => ({})) as Json;
  return { ok: false as const, error: trim(data.message || data.error || data.msg || res.status) || "DELETE_FACTOR_FAILED" };
}

/** Admin reset: remove every Auth MFA factor so the next login must scan a new barcode. */
async function resetAgentMfa(sb: SupabaseClient, body: Json, gate: { via: string }){
  const agentId = trim(body.agentId);
  if(!agentId) return json({ ok: false, error: "חסר מזהה נציג" }, 400);

  const { data: agentRow, error: agentErr } = await sb.from("agents")
    .select("id,name,email,auth_user_id,active")
    .eq("id", agentId)
    .maybeSingle();
  if(agentErr) return json({ ok: false, error: trim(agentErr.message) || "AGENT_LOOKUP_FAILED" }, 500);
  if(!agentRow) return json({ ok: false, error: "הנציג לא נמצא" }, 404);

  const email = normalizeEmail(body.email) || normalizeEmail((agentRow as Json).email);
  let userId = trim((agentRow as Json).auth_user_id);
  if(userId){
    const got = await sb.auth.admin.getUserById(userId);
    if(got.error || !got.data?.user) userId = "";
  }
  if(!userId && email){
    const existing = await findAuthUserByEmail(sb, email);
    userId = trim(existing?.id);
  }
  if(!userId){
    return json({
      ok: false,
      error: "לנציג אין משתמש Auth, ולכן אין ברקוד ישן למחיקה.",
      reason: "no_auth_user",
    }, 404);
  }

  const listed = await listAuthFactors(sb, userId);
  if(!listed.ok){
    return json({
      ok: false,
      error: "לא הצלחתי לקרוא את האימות הדו-שלבי הישן" + (listed.error ? ": " + listed.error : ""),
      authUserId: userId,
    }, 500);
  }
  const factors = listed.factors;
  let deleted = 0;
  const errors: string[] = [];
  for(const factor of factors){
    const factorId = trim(factor?.id);
    if(!factorId) continue;
    const removed = await deleteAuthFactor(userId, factorId);
    if(removed.ok) deleted += 1;
    else errors.push(removed.error);
  }
  if(factors.length > 0 && deleted === 0){
    return json({
      ok: false,
      error: "לא הצלחתי למחוק את האימות הדו-שלבי הישן"
        + (errors[0] ? ": " + errors[0] : ""),
      authUserId: userId,
      factorCount: factors.length,
    }, 500);
  }

  return json({
    ok: true,
    action: "reset_mfa",
    agentId,
    authUserId: userId,
    email,
    deleted,
    factorCount: factors.length,
    authorizedVia: gate.via,
  });
}

function loginLockKeys(row: Json){
  const keys = [trim(row.username), trim(row.name)].filter(Boolean);
  return keys.filter((key, index) => keys.indexOf(key) === index);
}

function loginLockTableMissing(message: string){
  return /gi_login_attempts|does not exist|schema cache/i.test(message);
}

/** Active locks only. Does not change attempts or the login function. */
async function listLoginLocks(sb: SupabaseClient){
  const nowIso = new Date().toISOString();
  const { data, error } = await sb.from("gi_login_attempts")
    .select("username, locked_until, failed_count")
    .gt("locked_until", nowIso);
  if(error){
    const msg = trim(error.message);
    return json({
      ok: false,
      error: loginLockTableMissing(msg) ? "טבלת נעילת הכניסה עדיין לא קיימת בשרת." : (msg || "LOCK_LIST_FAILED"),
    }, 500);
  }
  const byUser = new Map<string, { username: string; lockedUntil: string; failedCount: number }>();
  for(const row of (Array.isArray(data) ? data : []) as Json[]){
    const username = trim(row.username);
    const lockedUntil = trim(row.locked_until);
    if(!username || !lockedUntil) continue;
    const failedCount = Number(row.failed_count) || 0;
    const prev = byUser.get(username);
    if(!prev || lockedUntil > prev.lockedUntil){
      byUser.set(username, { username, lockedUntil, failedCount });
    }
  }
  return json({
    ok: true,
    action: "list_login_locks",
    locks: [...byUser.values()],
  });
}

/** Drop every failed-attempt row for this agent's username and display name. */
async function clearLoginLock(sb: SupabaseClient, body: Json){
  const agentId = trim(body.agentId);
  if(!agentId) return json({ ok: false, error: "חסר מזהה נציג" }, 400);

  const { data: agentRow, error: agentErr } = await sb.from("agents")
    .select("id,name,username")
    .eq("id", agentId)
    .maybeSingle();
  if(agentErr) return json({ ok: false, error: trim(agentErr.message) || "AGENT_LOOKUP_FAILED" }, 500);
  if(!agentRow) return json({ ok: false, error: "הנציג לא נמצא" }, 404);

  const keys = loginLockKeys(agentRow as Json);
  if(!keys.length) return json({ ok: false, error: "לנציג אין שם משתמש לשחרור" }, 400);

  const { data, error } = await sb.from("gi_login_attempts")
    .delete()
    .in("username", keys)
    .select("id");
  if(error){
    const msg = trim(error.message);
    return json({
      ok: false,
      error: loginLockTableMissing(msg) ? "טבלת נעילת הכניסה עדיין לא קיימת בשרת." : (msg || "LOCK_CLEAR_FAILED"),
    }, 500);
  }
  return json({
    ok: true,
    action: "clear_login_lock",
    agentId,
    cleared: Array.isArray(data) ? data.length : 0,
  });
}

/** preview_missing / provision_missing handler. */
async function provisionMissing(sb: SupabaseClient, action: string, _body: Json){
  let missing: Array<Json & { proposedEmail: string; usingExistingEmail: boolean }>;
  try {
    missing = await listMissingAgents(sb) as typeof missing;
  } catch(err){
    return json({ ok: false, error: "LIST_FAILED: " + trim((err as { message?: unknown })?.message || err) }, 500);
  }

  if(action === "preview_missing"){
    return json({
      ok: true,
      action: "preview_missing",
      count: missing.length,
      agents: missing.map((a) => ({
        id: a.id, name: a.name, username: a.username, role: a.role,
        email: a.email, proposedEmail: a.proposedEmail,
        usingExistingEmail: a.usingExistingEmail,
        active: a.active,
      })),
      authorizedVia: "admin",
    });
  }

  // provision_missing: create Auth users and link auth_user_id.
  const created: Json[] = [];
  const skipped: Json[] = [];
  for(const a of missing){
    try {
      // Do not touch agents.email — only create the Auth user with the proposed email.
      const { data: newUser, error } = await sb.auth.admin.createUser({
        email: a.proposedEmail,
        password: randomPassword(),
        email_confirm: true,
        // No MFA, no user_metadata the agent controls. Identity only in app_metadata.
        app_metadata: { agent_id: a.id, role: a.role },
      });
      if(error) throw error;
      const authUserId = trim(newUser?.id);
      if(!authUserId) throw new Error("NO_USER_ID");
      // Link auth_user_id only. agents.email is intentionally NOT updated.
      const { error: linkErr } = await sb.from("agents")
        .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
        .eq("id", a.id);
      if(linkErr) throw linkErr;
      created.push({ id: a.id, name: a.name, role: a.role, email: a.proposedEmail, authUserId, usingExistingEmail: a.usingExistingEmail });
    } catch(err){
      skipped.push({ id: a.id, name: a.name, email: a.proposedEmail, error: trim((err as { message?: unknown })?.message || err) });
    }
  }

  return json({
    ok: skipped.length === 0,
    action: "provision_missing",
    count: missing.length,
    created: created.length,
    skipped: skipped.length,
    createdAgents: created,
    skippedAgents: skipped,
    authorizedVia: "admin",
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

  const action = trim(body.action) || "sync";
  if(action !== "sync" && action !== "preview_missing" && action !== "provision_missing" && action !== "reset_mfa" && action !== "clear_login_lock" && action !== "list_login_locks"){
    return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  }

  const sb = sbAdmin();
  const gate = await verifyAdminActor(sb, req, body);
  if(!gate.ok) return gate.res;

  if(action === "reset_mfa"){
    return await resetAgentMfa(sb, body, gate);
  }

  if(action === "list_login_locks"){
    return await listLoginLocks(sb);
  }

  if(action === "clear_login_lock"){
    return await clearLoginLock(sb, body);
  }

  // --- Pג step 1: create Auth accounts for active agents without auth_user_id.
  // preview_missing lists what WOULD be created (no side effects).
  // provision_missing actually creates the Auth users and links auth_user_id.
  // Never touches agents.email for agents that already have one; for agents
  // without email, the technical email lives only in auth.users (agents.email
  // stays null) so no existing sync is disturbed.
  if(action === "preview_missing" || action === "provision_missing"){
    return await provisionMissing(sb, action, body);
  }

  const agentId = trim(body.agentId);
  const pin = trim(body.password) || trim(body.pin);
  const email = normalizeEmail(body.email);
  const name = trim(body.name) || trim(body.agentName);
  const role = trim(body.role) || "agent";

  if(!agentId) return json({ ok: false, error: "חסר מזהה נציג" }, 400);
  if(!pin) return json({ ok: false, error: "חסר קוד כניסה (PIN) לעדכון" }, 400);

  const { data: agentRow, error: agentErr } = await sb.from("agents")
    .select("id,name,username,role,active,email,auth_user_id")
    .eq("id", agentId)
    .maybeSingle();
  if(agentErr) return json({ ok: false, error: trim(agentErr.message) || "AGENT_LOOKUP_FAILED" }, 500);
  if(!agentRow) return json({ ok: false, error: "הנציג לא נמצא בטבלת agents. שמור קודם את הנציג ואז נסה שוב." }, 404);

  const { error: pinErr } = await sb.from("agents")
    .update({
      pin,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agentId)
    .select("id");
  const pinUpdated = !pinErr;
  const pinError = pinErr ? trim(pinErr.message) : "";
  /* GI-FIX 2026-09-22 — ה-CRM כבר כתב את ה-PIN. אל תחסמי סנכרון Auth
     אם PostgREST נכשל על RETURNING/GRANT של עמודת pin. */

  const pinOnly = await readPinOnlyFlag(sb, agentId, body.pinOnlyLogin);
  if(pinOnly){
    return json({
      ok: true,
      pinUpdated,
      ...(pinError ? { pinError } : {}),
      authUpdated: false,
      skippedAuth: "pin_only",
      agentId,
      authorizedVia: gate.via,
    });
  }

  const authEmail = email || normalizeEmail(agentRow.email);
  if(!authEmail){
    return json({
      ok: true,
      pinUpdated,
      ...(pinError ? { pinError } : {}),
      authUpdated: false,
      skippedAuth: "no_email",
      agentId,
      authorizedVia: gate.via,
    });
  }

  try {
    const existingId = trim(agentRow.auth_user_id);
    let existing: User | null = null;
    if(existingId){
      const got = await sb.auth.admin.getUserById(existingId);
      if(!got.error && got.data?.user) existing = got.data.user;
    }
    if(!existing) existing = await findAuthUserByEmail(sb, authEmail);

    if(!existing?.id){
      return json({
        ok: true,
        pinUpdated,
        ...(pinError ? { pinError } : {}),
        authUpdated: false,
        skippedAuth: "no_auth_user",
        agentId,
        email: authEmail,
        authorizedVia: gate.via,
      });
    }

    const result = await setExistingAuthPassword(sb, {
      email: authEmail,
      pin,
      existing,
      appMetadata: {
        agent_id: agentId,
        role,
        pin_synced_by: gate.actor.username || gate.actor.name,
      },
    });
    const authUserId = trim(result.user?.id);
    if(authUserId && authUserId !== existingId){
      await sb.from("agents")
        .update({
          auth_user_id: authUserId,
          email: authEmail,
          updated_at: new Date().toISOString(),
        })
        .eq("id", agentId);
    }

    return json({
      ok: true,
      pinUpdated,
      ...(pinError ? { pinError } : {}),
      authUpdated: true,
      authUserId,
      email: authEmail,
      passwordScheme: result.passwordScheme,
      agentId,
      authorizedVia: gate.via,
      name: name || trim(agentRow.name),
    });
  } catch(err) {
    return json({
      ok: false,
      pinUpdated,
      ...(pinError ? { pinError } : {}),
      authUpdated: false,
      error: "קוד הכניסה נשמר לנציג, אך סיסמת Auth לא עודכנה: "
        + (trim((err as { message?: unknown })?.message || err) || "AUTH_SYNC_FAILED"),
    }, 400);
  }
});
