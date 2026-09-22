// GI-PROVISION-AGENT-AUTH — sync a typed CRM PIN onto public.agents.pin
// and, when an Auth user already exists, onto that user's password.
//
// Narrower than the 2026-09-16 rollback:
//   - Never creates Auth users (that forced MFA onto agents with no email).
//   - Never changes pinOnlyLogin / mfaRequired.
//   - PIN-only agents get agents.pin only.
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
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    const user = userData?.user;
    if(userErr || !user?.id){
      reasons.push("session_invalid");
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
  if(action !== "sync"){
    return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  }

  const sb = sbAdmin();
  const gate = await verifyAdminActor(sb, req, body);
  if(!gate.ok) return gate.res;

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
    .eq("id", agentId);
  if(pinErr){
    return json({
      ok: false,
      error: "לא הצלחתי לשמור את קוד הכניסה בטבלת הנציגים: " + trim(pinErr.message),
      pinUpdated: false,
    }, 500);
  }

  const pinOnly = await readPinOnlyFlag(sb, agentId, body.pinOnlyLogin);
  if(pinOnly){
    return json({
      ok: true,
      pinUpdated: true,
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
      pinUpdated: true,
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
        pinUpdated: true,
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
      pinUpdated: true,
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
      pinUpdated: true,
      authUpdated: false,
      error: "קוד הכניסה נשמר לנציג, אך סיסמת Auth לא עודכנה: "
        + (trim((err as { message?: unknown })?.message || err) || "AUTH_SYNC_FAILED"),
    }, 400);
  }
});
