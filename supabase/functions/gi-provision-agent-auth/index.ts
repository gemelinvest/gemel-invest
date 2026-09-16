// GI-PROVISION-AGENT-AUTH — create/link Supabase Auth users from CRM user management.
// Auth is app-level (admin/manager PIN via gi_verify_agent_login or adminAuth),
// not a user JWT. verify_jwt stays false. Never expose service_role to the browser.
//
// Why this exists: ניהול משתמשים writes public.agents only. MFA login then calls
// signInWithPassword(email, PIN). Without an auth.users row the agent cannot log in,
// and creating that row in Studio hits HaveIBeenPwned ("password is known to be weak")
// because CRM PINs (and many "strong" reused passwords) appear in breach corpora.

import { createClient, type SupabaseClient, type User } from "jsr:@supabase/supabase-js@2";

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

/** Same formula as app.js deriveGiAuthPassword — unique enough to pass HIBP. */
function deriveGiAuthPassword(pin: string, email: string){
  return `GiCrm!${trim(pin)}#${normalizeEmail(email)}!v1`;
}

function isWeakPasswordError(err: unknown){
  const msg = trim((err as { message?: unknown })?.message || err);
  const code = trim((err as { code?: unknown })?.code).toLowerCase();
  if(code === "weak_password") return true;
  return /weak|easy to guess|hibp|pwned|leaked|too short|at least \d+ character|password.*invalid/i.test(msg);
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
  // The CRM sends the publishable key when no user session exists.
  if(!token || token.startsWith("sb_publishable_") || token.startsWith("sb_secret_")) return "";
  // Only a JWT can be validated as a user token.
  return token.split(".").length === 3 ? token : "";
}

/* Authorization order:
   1. The manager's live Supabase Auth JWT. Managers who log in with MFA hold a
      real session, and their agents.pin may legitimately differ from the Auth
      password they typed — so replaying the PIN is not a reliable gate.
   2. adminAuth (username + PIN from app_meta) for the synthetic system admin.
   3. gi_verify_agent_login for PIN-only managers, who have no Auth session.
   Role always comes from public.agents, never from user_metadata. */
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
            error: "רק מנהל או מנהל מערכת יכול להקים משתמש Auth. התפקיד המחובר: " + actor.role,
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
            error: "רק מנהל או מנהל מערכת יכול להקים משתמש Auth. התפקיד המחובר: " + actor.role,
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
    ? "קוד הכניסה של המנהל לא תואם את הקוד בטבלת הנציגים. אם אתה מחובר עם אימות דו־שלבי — התנתק, היכנס מחדש כדי לרענן את החיבור המאובטח, ונסה לשמור שוב."
    : reasons.includes("session_not_linked_to_agent")
      ? "החיבור המאובטח שלך לא מקושר לרשומת נציג. פנה למנהל המערכת לקישור auth_user_id."
      : reasons.includes("no_credentials")
        ? "לא נמצאו פרטי מנהל מאומתים בבקשה. התנתק והיכנס מחדש ואז נסה לשמור שוב."
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

async function setAuthPassword(sb: SupabaseClient, params: {
  email: string;
  pin: string;
  existing?: User | null;
  appMetadata: Json;
  userMetadata: Json;
}){
  const email = normalizeEmail(params.email);
  const pin = trim(params.pin);
  const attempts: Array<{ password: string; scheme: "pin" | "gi-v1" }> = [
    { password: pin, scheme: "pin" },
    { password: deriveGiAuthPassword(pin, email), scheme: "gi-v1" },
  ];
  // Skip the raw PIN attempt when it cannot possibly satisfy Auth (min length 6).
  const queue = pin.length >= 6 ? attempts : attempts.filter((a) => a.scheme === "gi-v1");
  let lastErr = "PASSWORD_REJECTED";

  for(const attempt of queue){
    try {
      if(params.existing?.id){
        const { data, error } = await sb.auth.admin.updateUserById(params.existing.id, {
          password: attempt.password,
          email_confirm: true,
          app_metadata: params.appMetadata,
          user_metadata: params.userMetadata,
        });
        if(error) throw error;
        return { user: data.user, passwordScheme: attempt.scheme, created: false };
      }
      const { data, error } = await sb.auth.admin.createUser({
        email,
        password: attempt.password,
        email_confirm: true,
        app_metadata: params.appMetadata,
        user_metadata: params.userMetadata,
      });
      if(error) throw error;
      return { user: data.user, passwordScheme: attempt.scheme, created: true };
    } catch(err) {
      lastErr = trim((err as { message?: unknown })?.message || err);
      const already = /already|registered|exists|duplicate/i.test(lastErr);
      if(already && !params.existing){
        const existing = await findAuthUserByEmail(sb, email);
        if(!existing) throw err;
        return setAuthPassword(sb, { ...params, existing });
      }
      if(!isWeakPasswordError(err)) throw err;
    }
  }
  throw new Error(
    "סיסמת Auth נדחתה (בדיקת סיסמה חלשה / HaveIBeenPwned). "
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

  const action = trim(body.action) || "create";
  if(action !== "create" && action !== "sync"){
    return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  }

  const sb = sbAdmin();
  const gate = await verifyAdminActor(sb, req, body);
  if(!gate.ok) return gate.res;

  const agentId = trim(body.agentId);
  const email = normalizeEmail(body.email);
  const pin = trim(body.password) || trim(body.pin);
  const name = trim(body.name) || trim(body.agentName);
  const role = trim(body.role) || "agent";

  if(!agentId) return json({ ok: false, error: "חסר מזהה נציג" }, 400);
  if(!email || !email.includes("@")) return json({ ok: false, error: "חסר מייל Auth תקין" }, 400);
  if(!pin) return json({ ok: false, error: "חסר קוד כניסה (PIN) ליצירת סיסמת Auth" }, 400);

  const { data: agentRow, error: agentErr } = await sb.from("agents")
    .select("id,name,username,role,active,email,auth_user_id")
    .eq("id", agentId)
    .maybeSingle();
  if(agentErr) return json({ ok: false, error: trim(agentErr.message) || "AGENT_LOOKUP_FAILED" }, 500);
  if(!agentRow) return json({ ok: false, error: "הנציג לא נמצא בטבלת agents. שמור קודם את הנציג ואז נסה שוב." }, 404);

  const { data: emailOwners, error: emailOwnerErr } = await sb.from("agents")
    .select("id,name,email,auth_user_id")
    .eq("email", email);
  if(emailOwnerErr) return json({ ok: false, error: trim(emailOwnerErr.message) }, 500);
  const stolen = (emailOwners || []).find((row) => trim(row.id) && trim(row.id) !== agentId);
  if(stolen){
    return json({
      ok: false,
      error: `המייל ${email} כבר משויך לנציג אחר (${trim(stolen.name) || stolen.id}).`,
    }, 409);
  }

  try {
    const existingId = trim(agentRow.auth_user_id);
    let existing: User | null = null;
    if(existingId){
      const got = await sb.auth.admin.getUserById(existingId);
      if(!got.error && got.data?.user) existing = got.data.user;
    }
    if(!existing) existing = await findAuthUserByEmail(sb, email);

    const appMetadata = {
      agent_id: agentId,
      role,
      provisioned_by: gate.actor.username || gate.actor.name,
    };
    const userMetadata = {
      full_name: name || trim(agentRow.name),
    };

    const result = await setAuthPassword(sb, {
      email,
      pin,
      existing,
      appMetadata,
      userMetadata,
    });
    const authUserId = trim(result.user?.id);
    if(!authUserId) return json({ ok: false, error: "AUTH_USER_MISSING_ID" }, 500);

    const { error: linkErr } = await sb.from("agents")
      .update({
        email,
        auth_user_id: authUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agentId);
    if(linkErr){
      return json({
        ok: false,
        error: "משתמש Auth נוצר אך קישור auth_user_id נכשל: " + trim(linkErr.message),
        authUserId,
        passwordScheme: result.passwordScheme,
      }, 500);
    }

    return json({
      ok: true,
      created: result.created,
      linked: !result.created,
      authUserId,
      email,
      passwordScheme: result.passwordScheme,
      agentId,
      authorizedVia: gate.via,
    });
  } catch(err) {
    return json({
      ok: false,
      error: trim((err as { message?: unknown })?.message || err) || "PROVISION_FAILED",
    }, 400);
  }
});
