// GI-ASSISTANT-REALTIME — mint OpenAI ephemeral client secrets.
// OPENAI_API_KEY stays in Edge secrets. The browser only receives ek_ tokens.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const DEFAULT_MODEL = "gpt-realtime";
const INSTRUCTIONS = [
  "אתה העוזר האישי הקולי של GEMEL INVEST.",
  "דבר עברית, קצר וברור.",
  "פעולות במערכת רק דרך הכלים. אל תמציא לקוחות, מחירים או נתונים.",
  "user_id או ת״ז שהמשתמש אמר אינם סמכות — השרת מחליט לפי הסשן.",
  "פעולות כתיבה דורשות אישור קולי. אם הכלי מחזיר needs_confirmation, בקש כן או לא.",
  "תמחור והצעות חדשות עדיין לא זמינים — אל תחשב פרמיה בעצמך.",
].join(" ");

const SESSION_TOOLS = [
  { type: "function", name: "search_customer", description: "חיפוש לקוחות מורשים לפי שם או עיר", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { type: "function", name: "find_customer_by_id", description: "איתור לקוח לפי מזהה פנימי או שאילתה", parameters: { type: "object", properties: { customerId: { type: "string" }, query: { type: "string" } } } },
  { type: "function", name: "get_customer", description: "פרטי לקוח מורשים בלי ת״ז", parameters: { type: "object", properties: { customerId: { type: "string" } }, required: ["customerId"] } },
  { type: "function", name: "get_customer_policies", description: "ספירת פוליסות של לקוח מורשה", parameters: { type: "object", properties: { customerId: { type: "string" } }, required: ["customerId"] } },
  { type: "function", name: "open_customer", description: "פתיחת תיק לקוח במסך", parameters: { type: "object", properties: { customerId: { type: "string" } }, required: ["customerId"] } },
  { type: "function", name: "get_tasks", description: "רשימת משימות פתוחות", parameters: { type: "object", properties: {} } },
  { type: "function", name: "create_task", description: "יצירת משימה — דורש אישור", parameters: { type: "object", properties: { type: { type: "string" }, details: { type: "string" }, remindAt: { type: "string" }, customerId: { type: "string" }, customerName: { type: "string" } } } },
  { type: "function", name: "update_task", description: "עדכון משימה — דורש אישור", parameters: { type: "object", properties: { taskId: { type: "string" }, isDone: { type: "boolean" }, remindAt: { type: "string" } }, required: ["taskId"] } },
  { type: "function", name: "go_view", description: "מעבר למסך במערכת", parameters: { type: "object", properties: { view: { type: "string" } }, required: ["view"] } },
  { type: "function", name: "open_simulator", description: "פתיחת סימולטור קיים", parameters: { type: "object", properties: { company: { type: "string" }, product: { type: "string" } }, required: ["company", "product"] } },
  { type: "function", name: "get_agents", description: "רשימת נציגים — למנהלים בלבד", parameters: { type: "object", properties: {} } },
  { type: "function", name: "get_monthly_production", description: "ספירת תיקים החודש לפי הרשאה", parameters: { type: "object", properties: {} } },
  { type: "function", name: "get_team_production", description: "ספירת תיקי צוות — למנהלים", parameters: { type: "object", properties: {} } },
];

type Json = Record<string, unknown>;

type AgentRow = {
  id?: string;
  name?: string;
  username?: string;
  role?: string;
  pin?: string;
  active?: boolean;
};

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
      action: trim(row.action) || "realtime",
      tool: "realtime",
      arguments_safe: row.arguments_safe && typeof row.arguments_safe === "object" ? row.arguments_safe : {},
      authorization_result: trim(row.authorization_result) || null,
      execution_status: trim(row.execution_status) || null,
      error: trim(row.error) || null,
    });
  } catch(_e) {}
}

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
  return { ok: true as const, agent, deviceId: "" };
}

async function requireDevice(sb: SupabaseClient, body: Json){
  const publicId = trim(body.devicePublicId);
  const secret = trim(body.deviceSecret);
  if(!publicId || !secret) return { ok: false as const, error: "MISSING_DEVICE", status: 400 };
  const hash = await sha256Hex(secret);
  const { data, error } = await sb.from("gi_assistant_devices")
    .select("id,agent_id,revoked_at")
    .eq("device_public_id", publicId)
    .eq("device_secret_hash", hash)
    .maybeSingle();
  if(error) throw new Error(error.message);
  if(!data || data.revoked_at) return { ok: false as const, error: "AUTH_FAILED", status: 401 };
  const agent = await findAgent(sb, { agentId: data.agent_id });
  if(!agent || agent.active === false) return { ok: false as const, error: "AUTH_FAILED", status: 401 };
  await sb.from("gi_assistant_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);
  return { ok: true as const, agent, deviceId: trim(data.id) };
}

async function authorize(sb: SupabaseClient, body: Json){
  if(trim(body.devicePublicId) && trim(body.deviceSecret)) return requireDevice(sb, body);
  return requireAgentWithPin(sb, body);
}

function extractClientSecret(data: Json){
  const direct = trim(data.value);
  if(direct) return direct;
  const nested = data.client_secret;
  if(nested && typeof nested === "object") return trim((nested as Json).value);
  return "";
}

async function mintEphemeral(agentId: string){
  const apiKey = trim(Deno.env.get("OPENAI_API_KEY"));
  if(!apiKey) return { ok: false as const, error: "MISSING_OPENAI_KEY" };
  const model = trim(Deno.env.get("OPENAI_REALTIME_MODEL")) || DEFAULT_MODEL;
  const voice = trim(Deno.env.get("OPENAI_REALTIME_VOICE")) || "alloy";
  const safety = (await sha256Hex("gi-asst:" + agentId)).slice(0, 32);
  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": safety,
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model,
        instructions: INSTRUCTIONS,
        tools: SESSION_TOOLS,
        audio: { output: { voice } },
      },
    }),
  });
  let data: Json = {};
  try { data = await res.json() as Json; } catch(_e) { data = {}; }
  if(!res.ok){
    return { ok: false as const, error: "OPENAI_ERROR", status: res.status };
  }
  const clientSecret = extractClientSecret(data);
  if(!clientSecret || clientSecret.indexOf("sk-") === 0){
    return { ok: false as const, error: "OPENAI_ERROR" };
  }
  return {
    ok: true as const,
    clientSecret,
    expiresAt: trim(data.expires_at) || new Date(Date.now() + 60 * 1000).toISOString(),
    model,
  };
}

async function handleToken(sb: SupabaseClient, body: Json){
  const auth = await authorize(sb, body);
  if(!auth.ok){
    await audit(sb, { action: "realtime_token", authorization_result: "denied", execution_status: "error", error: auth.error });
    return json({ ok: false, error: auth.error }, auth.status);
  }
  const minted = await mintEphemeral(trim(auth.agent.id));
  if(!minted.ok){
    await audit(sb, {
      user_id: trim(auth.agent.id),
      action: "realtime_token",
      authorization_result: "ok",
      execution_status: "error",
      error: minted.error,
    });
    return json({ ok: false, error: minted.error }, minted.error === "MISSING_OPENAI_KEY" ? 503 : 502);
  }
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const source = trim(body.source) === "phone" ? "phone" : "desktop";
  const inserted = await sb.from("gi_assistant_sessions").insert({
    agent_id: trim(auth.agent.id),
    device_id: trim(auth.deviceId) || null,
    source,
    model: minted.model,
    expires_at: expiresAt,
  }).select("id").maybeSingle();
  if(inserted.error) throw new Error(inserted.error.message);
  const sessionId = trim(inserted.data?.id);
  await audit(sb, {
    user_id: trim(auth.agent.id),
    session_id: sessionId,
    action: "realtime_token",
    authorization_result: "ok",
    execution_status: "ok",
    arguments_safe: { source, model: minted.model },
  });
  return json({
    ok: true,
    sessionId,
    clientSecret: minted.clientSecret,
    expiresAt: minted.expiresAt,
    model: minted.model,
  });
}

async function handleEnd(sb: SupabaseClient, body: Json){
  const sessionId = trim(body.sessionId);
  if(!sessionId) return json({ ok: false, error: "MISSING_SESSION" }, 400);
  await sb.from("gi_assistant_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("ended_at", null);
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if(req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if(req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);
  let body: Json = {};
  try { body = await req.json(); } catch(_e) { body = {}; }
  const action = trim(body.action);
  const sb = sbAdmin();
  try {
    if(action === "token") return await handleToken(sb, body);
    if(action === "end") return await handleEnd(sb, body);
    return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch(err) {
    const message = err instanceof Error ? err.message : String(err);
    await audit(sb, { action: "realtime_" + action, execution_status: "error", error: "SERVER" });
    return json({ ok: false, error: "SERVER", detail: message }, 500);
  }
});
