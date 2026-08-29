// GI-ASSISTANT-ENGINE — context, confirmation gate, timeline, audit.
// The model is not authority. "כן" applies only to an open pending_action_id.
// No CRM tools here (P8). Writes are proposed, never executed.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PENDING_TTL_MS = 2 * 60 * 1000;
const COMMAND_TTL_MS = 2 * 60 * 1000;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const UI_COMMANDS = new Set([
  "open_customer", "go_view", "open_simulator", "open_proposal",
  "open_wizard", "refresh_reminders", "upsert_reminder", "mark_task_done",
  "fill_wizard", "wizard_next", "open_har_import",
]);
const PII_KEY = /id_number|idNumber|tz_number|national_id|"ת\\"ז"|ת״ז/i;
const PII_DIGITS = /\d{8,9}/g;

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

function redactSafe(text: unknown){
  return trim(text).replace(PII_DIGITS, "[מזהה]").slice(0, 280);
}

function hasPii(value: unknown){
  try { return PII_KEY.test(JSON.stringify(value || {})); } catch(_e) { return true; }
}

function classifyIntent(text: string){
  const normalized = trim(text).replace(/[!.?,]/g, "");
  if(/^(כן|בטח|אשרי?|תאשר|מאשר|יאללה|קדימה)$/.test(normalized)) return "confirm";
  if(/^(לא|בטל|ביטול|אל תאשר|לא לאשר)$/.test(normalized)) return "cancel";
  return "other";
}

async function audit(sb: SupabaseClient, row: Json){
  try {
    await sb.from("gi_assistant_audit_log").insert({
      user_id: trim(row.user_id) || null,
      session_id: trim(row.session_id) || null,
      action: trim(row.action) || "engine",
      tool: trim(row.tool) || "engine",
      customer_id: trim(row.customer_id) || null,
      arguments_safe: row.arguments_safe && typeof row.arguments_safe === "object" ? row.arguments_safe : {},
      authorization_result: trim(row.authorization_result) || null,
      confirmation_required: row.confirmation_required === true,
      confirmation_result: trim(row.confirmation_result) || null,
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
  return { ok: true as const, agent };
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
  return { ok: true as const, agent };
}

async function authorize(sb: SupabaseClient, body: Json){
  if(trim(body.devicePublicId) && trim(body.deviceSecret)) return requireDevice(sb, body);
  return requireAgentWithPin(sb, body);
}

async function requireSession(sb: SupabaseClient, body: Json, agentId: string){
  const sessionId = trim(body.sessionId);
  if(!sessionId) return { ok: false as const, error: "MISSING_SESSION", status: 400 };
  const { data, error } = await sb.from("gi_assistant_sessions")
    .select("id,agent_id,ended_at,expires_at")
    .eq("id", sessionId)
    .maybeSingle();
  if(error) throw new Error(error.message);
  if(!data || trim(data.agent_id) !== agentId) return { ok: false as const, error: "SESSION_DENIED", status: 403 };
  if(data.ended_at || (data.expires_at && Date.parse(data.expires_at) <= Date.now())){
    return { ok: false as const, error: "SESSION_EXPIRED", status: 409 };
  }
  return { ok: true as const, sessionId: trim(data.id) };
}

async function addTimeline(sb: SupabaseClient, row: { sessionId: string; agentId: string; kind: string; text: string }){
  const textSafe = redactSafe(row.text);
  await sb.from("gi_assistant_timeline").insert({
    session_id: row.sessionId,
    agent_id: row.agentId,
    kind: trim(row.kind) || "info",
    text_safe: textSafe,
  });
  return textSafe;
}

async function readContext(sb: SupabaseClient, sessionId: string){
  const { data } = await sb.from("gi_assistant_context")
    .select("session_id,agent_id,customer_id,last_intent,pending_action_id,updated_at")
    .eq("session_id", sessionId)
    .maybeSingle();
  return data;
}

async function upsertContext(sb: SupabaseClient, row: Json){
  const sessionId = trim(row.session_id);
  const payload = {
    session_id: sessionId,
    agent_id: trim(row.agent_id),
    customer_id: trim(row.customer_id) || null,
    last_intent: trim(row.last_intent),
    pending_action_id: trim(row.pending_action_id) || null,
    updated_at: new Date().toISOString(),
  };
  await sb.from("gi_assistant_context").upsert(payload, { onConflict: "session_id" });
  return payload;
}

async function handleOpenSession(sb: SupabaseClient, body: Json, agent: AgentRow){
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const source = trim(body.source) === "phone" ? "phone" : "desktop";
  const inserted = await sb.from("gi_assistant_sessions").insert({
    agent_id: trim(agent.id),
    source,
    model: "local-browser",
    expires_at: expiresAt,
  }).select("id").maybeSingle();
  if(inserted.error) throw new Error(inserted.error.message);
  const sessionId = trim(inserted.data?.id);
  await audit(sb, {
    user_id: trim(agent.id),
    session_id: sessionId,
    action: "engine_open_session",
    authorization_result: "ok",
    execution_status: "ok",
    arguments_safe: { source, model: "local-browser" },
  });
  return json({ ok: true, sessionId, model: "local-browser", expiresAt });
}

async function handleEndSession(sb: SupabaseClient, sessionId: string){
  await sb.from("gi_assistant_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("ended_at", null);
  return json({ ok: true });
}

async function handleBootstrap(sb: SupabaseClient, body: Json, agent: AgentRow, sessionId: string){
  const existing = await readContext(sb, sessionId);
  if(!existing){
    await upsertContext(sb, { session_id: sessionId, agent_id: trim(agent.id), last_intent: "" });
    await addTimeline(sb, { sessionId, agentId: trim(agent.id), kind: "system", text: "סשן עוזר נפתח." });
  }
  await audit(sb, { user_id: trim(agent.id), session_id: sessionId, action: "engine_bootstrap", authorization_result: "ok", execution_status: "ok" });
  return json({ ok: true, context: await readContext(sb, sessionId) });
}

async function handleSetContext(sb: SupabaseClient, body: Json, agent: AgentRow, sessionId: string){
  if(hasPii(body.context)) return json({ ok: false, error: "PII_REJECTED" }, 400);
  const current = await readContext(sb, sessionId) || {};
  const next = await upsertContext(sb, {
    session_id: sessionId,
    agent_id: trim(agent.id),
    customer_id: trim(body.customerId) || trim((current as Json).customer_id),
    last_intent: trim(body.lastIntent) || trim((current as Json).last_intent),
    pending_action_id: trim((current as Json).pending_action_id),
  });
  await audit(sb, {
    user_id: trim(agent.id),
    session_id: sessionId,
    action: "engine_set_context",
    customer_id: next.customer_id,
    authorization_result: "ok",
    execution_status: "ok",
    arguments_safe: { lastIntent: next.last_intent, hasCustomer: !!next.customer_id },
  });
  return json({ ok: true, context: next });
}

async function handleLog(sb: SupabaseClient, body: Json, agent: AgentRow, sessionId: string){
  if(hasPii(body)) return json({ ok: false, error: "PII_REJECTED" }, 400);
  const kind = trim(body.kind) || "info";
  const textSafe = await addTimeline(sb, { sessionId, agentId: trim(agent.id), kind, text: trim(body.text) });
  await audit(sb, {
    user_id: trim(agent.id),
    session_id: sessionId,
    action: "engine_log",
    authorization_result: "ok",
    execution_status: "ok",
    arguments_safe: { kind },
  });
  return json({ ok: true, textSafe });
}

async function handlePropose(sb: SupabaseClient, body: Json, agent: AgentRow, sessionId: string){
  const tool = trim(body.tool);
  if(!tool) return json({ ok: false, error: "MISSING_TOOL" }, 400);
  if(hasPii(body.argumentsSafe || body)) return json({ ok: false, error: "PII_REJECTED" }, 400);
  const args = (body.argumentsSafe && typeof body.argumentsSafe === "object") ? body.argumentsSafe as Json : {};
  const expiresAt = new Date(Date.now() + PENDING_TTL_MS).toISOString();
  const label = redactSafe(body.label) || ("פעולה: " + tool);
  await sb.from("gi_assistant_pending_actions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("status", "pending");
  const inserted = await sb.from("gi_assistant_pending_actions").insert({
    session_id: sessionId,
    agent_id: trim(agent.id),
    tool,
    label,
    arguments_safe: args,
    status: "pending",
    expires_at: expiresAt,
  }).select("id,expires_at").maybeSingle();
  if(inserted.error) throw new Error(inserted.error.message);
  const pendingId = trim(inserted.data?.id);
  await upsertContext(sb, {
    session_id: sessionId,
    agent_id: trim(agent.id),
    last_intent: "propose_write",
    pending_action_id: pendingId,
    customer_id: trim(body.customerId),
  });
  await addTimeline(sb, { sessionId, agentId: trim(agent.id), kind: "confirm", text: "ממתין לאישור: " + label });
  await audit(sb, {
    user_id: trim(agent.id),
    session_id: sessionId,
    action: "engine_propose",
    tool,
    confirmation_required: true,
    authorization_result: "ok",
    execution_status: "needs_confirmation",
    arguments_safe: { tool, pendingActionId: pendingId },
  });
  return json({
    ok: true,
    needs_confirmation: true,
    pending_action_id: pendingId,
    label,
    expiresAt: trim(inserted.data?.expires_at),
    executed: false,
  });
}

async function loadPending(sb: SupabaseClient, sessionId: string, pendingId: string){
  const { data, error } = await sb.from("gi_assistant_pending_actions")
    .select("id,session_id,agent_id,tool,label,arguments_safe,status,expires_at")
    .eq("id", pendingId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if(error) throw new Error(error.message);
  return data;
}

async function handleConfirm(sb: SupabaseClient, body: Json, agent: AgentRow, sessionId: string){
  const pendingId = trim(body.pendingActionId);
  if(!pendingId){
    await audit(sb, { user_id: trim(agent.id), session_id: sessionId, action: "engine_confirm", authorization_result: "denied", execution_status: "ignored", error: "NO_PENDING" });
    return json({ ok: false, error: "NO_PENDING", executed: false }, 409);
  }
  const row = await loadPending(sb, sessionId, pendingId);
  if(!row || row.status !== "pending"){
    await audit(sb, { user_id: trim(agent.id), session_id: sessionId, action: "engine_confirm", authorization_result: "denied", execution_status: "ignored", error: "NO_PENDING" });
    return json({ ok: false, error: "NO_PENDING", executed: false }, 409);
  }
  if(row.expires_at && Date.parse(row.expires_at) <= Date.now()){
    await sb.from("gi_assistant_pending_actions").update({ status: "expired" }).eq("id", row.id);
    return json({ ok: false, error: "PENDING_EXPIRED", executed: false }, 409);
  }
  const now = new Date().toISOString();
  await sb.from("gi_assistant_pending_actions")
    .update({ status: "confirmed", confirmed_at: now })
    .eq("id", row.id)
    .eq("status", "pending");
  await upsertContext(sb, { session_id: sessionId, agent_id: trim(agent.id), last_intent: "confirmed", pending_action_id: "" });
  await addTimeline(sb, { sessionId, agentId: trim(agent.id), kind: "ok", text: "אושר: " + redactSafe(row.label) + " — יבוצע בשלב הכלים." });
  await audit(sb, {
    user_id: trim(agent.id),
    session_id: sessionId,
    action: "engine_confirm",
    tool: trim(row.tool),
    confirmation_required: true,
    confirmation_result: "confirmed",
    authorization_result: "ok",
    execution_status: "confirmed_pending_tool",
    arguments_safe: { pendingActionId: pendingId, executed: false },
  });
  return json({
    ok: true,
    confirmed: true,
    executed: false,
    pending_action_id: pendingId,
    tool: trim(row.tool),
    ready_for_tool: true,
  });
}

async function handleCancel(sb: SupabaseClient, body: Json, agent: AgentRow, sessionId: string){
  const pendingId = trim(body.pendingActionId);
  if(!pendingId) return json({ ok: false, error: "NO_PENDING", executed: false }, 409);
  const row = await loadPending(sb, sessionId, pendingId);
  if(!row || row.status !== "pending") return json({ ok: false, error: "NO_PENDING", executed: false }, 409);
  await sb.from("gi_assistant_pending_actions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", row.id);
  await upsertContext(sb, { session_id: sessionId, agent_id: trim(agent.id), last_intent: "cancelled", pending_action_id: "" });
  await addTimeline(sb, { sessionId, agentId: trim(agent.id), kind: "cancel", text: "בוטל: " + redactSafe(row.label) });
  await audit(sb, {
    user_id: trim(agent.id),
    session_id: sessionId,
    action: "engine_cancel",
    tool: trim(row.tool),
    confirmation_result: "cancelled",
    authorization_result: "ok",
    execution_status: "cancelled",
    arguments_safe: { pendingActionId: pendingId },
  });
  return json({ ok: true, cancelled: true, executed: false });
}

async function handleIntent(sb: SupabaseClient, body: Json, agent: AgentRow, sessionId: string){
  const text = redactSafe(body.text);
  const intent = classifyIntent(text);
  const ctx = await readContext(sb, sessionId);
  const pendingId = trim((ctx as Json | null)?.pending_action_id);
  await upsertContext(sb, {
    session_id: sessionId,
    agent_id: trim(agent.id),
    last_intent: intent,
    pending_action_id: pendingId,
    customer_id: trim((ctx as Json | null)?.customer_id),
  });
  if(intent === "confirm"){
    if(!pendingId){
      await addTimeline(sb, { sessionId, agentId: trim(agent.id), kind: "info", text: "אין פעולה ממתינה לאישור." });
      await audit(sb, { user_id: trim(agent.id), session_id: sessionId, action: "engine_intent", authorization_result: "denied", execution_status: "ignored", error: "NO_PENDING", arguments_safe: { intent } });
      return json({ ok: true, intent, applied: false, error: "NO_PENDING", executed: false });
    }
    return handleConfirm(sb, { pendingActionId: pendingId }, agent, sessionId);
  }
  if(intent === "cancel"){
    if(!pendingId) return json({ ok: true, intent, applied: false, executed: false });
    return handleCancel(sb, { pendingActionId: pendingId }, agent, sessionId);
  }
  return json({ ok: true, intent, applied: false, executed: false });
}

async function handleTimeline(sb: SupabaseClient, sessionId: string){
  const { data, error } = await sb.from("gi_assistant_timeline")
    .select("id,kind,text_safe,created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(40);
  if(error) throw new Error(error.message);
  return json({ ok: true, items: data || [] });
}

function sanitizeCommand(raw: unknown){
  if(!raw || typeof raw !== "object") return null;
  const src = raw as Json;
  const type = trim(src.type);
  if(!UI_COMMANDS.has(type)) return null;
  if(type !== "fill_wizard" && hasPii(src)) return null;
  const cmd: Json = { type };
  if(trim(src.customerId)) cmd.customerId = trim(src.customerId);
  if(trim(src.view)) cmd.view = trim(src.view);
  if(trim(src.company)) cmd.company = trim(src.company);
  if(trim(src.product)) cmd.product = trim(src.product);
  if(trim(src.proposalId)) cmd.proposalId = trim(src.proposalId);
  if(trim(src.id || src.taskId)) cmd.id = trim(src.id || src.taskId);
  if(src.reminder && typeof src.reminder === "object") cmd.reminder = src.reminder;
  if(type === "fill_wizard" && src.fields && typeof src.fields === "object"){
    cmd.fields = sanitizeFillFields(src.fields);
  }
  return cmd;
}

function sanitizeFillFields(raw: unknown){
  const src = raw && typeof raw === "object" ? raw as Json : {};
  const out: Json = {};
  for(const key of ["firstName", "lastName", "city", "street", "houseNumber", "apartment", "zip", "email", "gender", "company", "product", "birthDate", "idIssueDate", "occupation", "maritalStatus", "clinic", "shaban", "smokingType", "smokingAmount"]){
    const value = trim(src[key]);
    if(value) out[key] = value.slice(0, 80);
  }
  const idNumber = trim(src.idNumber).replace(/\D/g, "");
  if(idNumber.length >= 8 && idNumber.length <= 9) out.idNumber = idNumber;
  const phone = trim(src.phone).replace(/\D/g, "");
  if(phone.length >= 9 && phone.length <= 10) out.phone = phone;
  const age = Number(src.age);
  if(Number.isFinite(age) && age > 0 && age < 120) out.age = age;
  if(src.smoker === true || src.smoker === false) out.smoker = src.smoker;
  const sum = Number(src.sumInsured);
  if(Number.isFinite(sum) && sum > 0) out.sumInsured = sum;
  return out;
}

async function handleDispatch(sb: SupabaseClient, body: Json, agent: AgentRow, sessionId: string){
  const command = sanitizeCommand(body.command);
  if(!command) return json({ ok: false, error: "BAD_COMMAND" }, 400);
  const inserted = await sb.from("gi_assistant_commands").insert({
    agent_id: trim(agent.id),
    session_id: sessionId || null,
    command,
    status: "pending",
  }).select("id").maybeSingle();
  if(inserted.error) throw new Error(inserted.error.message);
  await audit(sb, {
    user_id: trim(agent.id),
    session_id: sessionId,
    action: "engine_dispatch",
    authorization_result: "ok",
    execution_status: "queued",
    arguments_safe: { type: trim(command.type) },
  });
  return json({ ok: true, commandId: trim(inserted.data?.id), queued: true });
}

async function handlePull(sb: SupabaseClient, agent: AgentRow){
  const since = new Date(Date.now() - COMMAND_TTL_MS).toISOString();
  const { data, error } = await sb.from("gi_assistant_commands")
    .select("id,command,created_at")
    .eq("agent_id", trim(agent.id))
    .eq("status", "pending")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(10);
  if(error) throw new Error(error.message);
  return json({
    ok: true,
    commands: (data || []).map((row) => ({
      id: trim((row as Json).id),
      command: (row as Json).command,
    })),
  });
}

async function handleAck(sb: SupabaseClient, body: Json, agent: AgentRow){
  const id = trim(body.commandId);
  if(!id) return json({ ok: false, error: "MISSING_COMMAND" }, 400);
  const patch: Json = {
    status: trim(body.error) ? "failed" : "executed",
    executed_at: new Date().toISOString(),
  };
  if(trim(body.error)) patch.error = trim(body.error).slice(0, 160);
  const { error } = await sb.from("gi_assistant_commands")
    .update(patch)
    .eq("id", id)
    .eq("agent_id", trim(agent.id));
  if(error) throw new Error(error.message);
  return json({ ok: true, commandId: id });
}

Deno.serve(async (req) => {
  if(req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if(req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);
  let body: Json = {};
  try { body = await req.json(); } catch(_e) { body = {}; }
  const action = trim(body.action);
  const sb = sbAdmin();
  try {
    const auth = await authorize(sb, body);
    if(!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    if(action === "open_session") return await handleOpenSession(sb, body, auth.agent);
    const busAction = action === "dispatch" || action === "pull" || action === "ack";
    let sessionId = "";
    if(!busAction || trim(body.sessionId)){
      const session = await requireSession(sb, body, trim(auth.agent.id));
      if(!session.ok){
        if(!busAction) return json({ ok: false, error: session.error }, session.status);
      } else {
        sessionId = session.sessionId;
      }
    }
    if(action === "dispatch") return await handleDispatch(sb, body, auth.agent, sessionId);
    if(action === "pull") return await handlePull(sb, auth.agent);
    if(action === "ack") return await handleAck(sb, body, auth.agent);
    if(!sessionId){
      const session = await requireSession(sb, body, trim(auth.agent.id));
      if(!session.ok) return json({ ok: false, error: session.error }, session.status);
      sessionId = session.sessionId;
    }
    if(action === "bootstrap") return await handleBootstrap(sb, body, auth.agent, sessionId);
    if(action === "end_session") return await handleEndSession(sb, sessionId);
    if(action === "set_context") return await handleSetContext(sb, body, auth.agent, sessionId);
    if(action === "log") return await handleLog(sb, body, auth.agent, sessionId);
    if(action === "propose") return await handlePropose(sb, body, auth.agent, sessionId);
    if(action === "confirm") return await handleConfirm(sb, body, auth.agent, sessionId);
    if(action === "cancel") return await handleCancel(sb, body, auth.agent, sessionId);
    if(action === "intent") return await handleIntent(sb, body, auth.agent, sessionId);
    if(action === "timeline") return await handleTimeline(sb, sessionId);
    return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch(err) {
    const message = err instanceof Error ? err.message : String(err);
    await audit(sb, { action: "engine_" + action, execution_status: "error", error: "SERVER" });
    return json({ ok: false, error: "SERVER", detail: message }, 500);
  }
});
