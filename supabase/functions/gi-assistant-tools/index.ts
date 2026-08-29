// GI-ASSISTANT-TOOLS — server-side tool invoke + role authz.
// The model is not authority: user_id in the body is ignored.
// Writes execute only after a confirmed pending_action_id.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CUSTOMER_LIGHT = "id,status,full_name,id_number,phone,email,city,agent_name,agent_id,agent_role,existing_policies_count,new_policies_count,created_at";
const PII_KEY = /id_number|idNumber|tz_number|national_id|ת״ז/i;
const WRITE_TOOLS = new Set(["create_task", "update_task", "create_proposal"]);
const SIM_CATALOG: Array<[string, string]> = [
  ["הפניקס", "ריסק"], ["הפניקס", "בריאות"], ["הפניקס", "מחלות קשות"], ["הפניקס", "סרטן"],
  ["הפניקס", "ריסק משכנתא"],
  ["מנורה", "ריסק"], ["מנורה", "ריסק משכנתא"], ["מנורה", "בריאות"], ["מנורה", "מחלות קשות"], ["מנורה", "סרטן"],
  ["הכשרה", "ריסק"], ["הכשרה", "ריסק משכנתא"], ["הכשרה", "בריאות"], ["הכשרה", "מחלות קשות"],
  ["מגדל", "בריאות"], ["מגדל", "מחלות קשות"], ["מגדל", "סרטן"], ["מגדל", "ריסק"], ["מגדל", "ריסק משכנתא"],
  ["מגדל", "מוות מתאונה"], ["מגדל", "נכות מתאונה"],
  ["איילון", "בריאות"], ["איילון", "מחלות קשות"], ["איילון", "סרטן"],
  ["כלל", "בריאות"], ["כלל", "מחלות קשות"], ["כלל", "סרטן"], ["כלל", "ריסק משכנתא"], ["כלל", "ריסק"],
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

function roleOf(agent: AgentRow){
  const raw = trim(agent.role).toLowerCase().replace(/[\s_-]+/g, "");
  if(raw === "מנהל" || raw === "adminlite") return "manager";
  if(raw === "owner" || raw === "admin") return raw;
  if(raw === "teammanager") return "teammanager";
  if(raw === "ops") return "ops";
  if(raw === "opsagent") return "opsagent";
  if(raw === "elementary" || raw === "אלמנטרי") return "elementary";
  if(raw === "referent") return "referent";
  return raw || "agent";
}

function canViewAll(role: string){
  return role === "admin" || role === "owner" || role === "manager" || role === "ops";
}

function canViewTeamReports(role: string){
  return canViewAll(role) || role === "teammanager";
}

function sbAdmin(){
  return createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", {
    auth: { persistSession: false },
  });
}

async function sha256Hex(value: string){
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
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
      action: trim(row.action) || "tool",
      tool: trim(row.tool) || null,
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
  const select = "id,name,username,role,pin,active";
  const id = trim(body.agentId);
  if(id){
    const byId = await sb.from("agents").select(select).eq("id", id).maybeSingle();
    if(byId.data) return byId.data as AgentRow;
  }
  const username = trim(body.username);
  if(username){
    const byUser = await sb.from("agents").select(select).eq("username", username).limit(2);
    const rows = Array.isArray(byUser.data) ? byUser.data : [];
    if(rows.length === 1) return rows[0] as AgentRow;
  }
  const name = trim(body.agentName);
  if(name){
    const byName = await sb.from("agents").select(select).eq("name", name).limit(2);
    const rows = Array.isArray(byName.data) ? byName.data : [];
    if(rows.length === 1) return rows[0] as AgentRow;
  }
  return null;
}

async function authorize(sb: SupabaseClient, body: Json){
  if(trim(body.devicePublicId) && trim(body.deviceSecret)){
    const hash = await sha256Hex(trim(body.deviceSecret));
    const { data, error } = await sb.from("gi_assistant_devices")
      .select("id,agent_id,revoked_at")
      .eq("device_public_id", trim(body.devicePublicId))
      .eq("device_secret_hash", hash)
      .maybeSingle();
    if(error) throw new Error(error.message);
    if(!data || data.revoked_at) return { ok: false as const, error: "AUTH_FAILED", status: 401 };
    const agent = await findAgent(sb, { agentId: data.agent_id });
    if(!agent || agent.active === false) return { ok: false as const, error: "AUTH_FAILED", status: 401 };
    return { ok: true as const, agent };
  }
  const pin = trim(body.pin);
  if(!pin) return { ok: false as const, error: "MISSING_PIN", status: 400 };
  const agent = await findAgent(sb, body);
  if(!agent || agent.active === false || !pinsMatch(agent.pin, pin)){
    return { ok: false as const, error: "AUTH_FAILED", status: 401 };
  }
  return { ok: true as const, agent };
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

function safeCustomer(row: Json){
  return {
    id: trim(row.id),
    full_name: trim(row.full_name),
    city: trim(row.city),
    agent_name: trim(row.agent_name),
    existing_policies_count: Number(row.existing_policies_count) || 0,
    new_policies_count: Number(row.new_policies_count) || 0,
  };
}

function customerOwned(row: Json, agent: AgentRow){
  const id = trim(agent.id);
  const name = trim(agent.name);
  return (!!id && trim(row.agent_id) === id) || (!!name && trim(row.agent_name) === name);
}

async function teamAgentIds(sb: SupabaseClient, managerId: string){
  const ids = new Set<string>([managerId]);
  try {
    const { data } = await sb.from("agents").select("id").eq("team_manager_id", managerId);
    (data || []).forEach((row) => { if(trim((row as Json).id)) ids.add(trim((row as Json).id)); });
  } catch(_e) {}
  return [...ids];
}

async function customerVisible(sb: SupabaseClient, row: Json, agent: AgentRow){
  const role = roleOf(agent);
  if(canViewAll(role)) return true;
  if(role === "elementary"){
    const ar = trim(row.agent_role).toLowerCase();
    if(ar === "elementary" || ar === "אלמנטרי") return true;
    return customerOwned(row, agent);
  }
  if(role === "teammanager"){
    if(customerOwned(row, agent)) return true;
    const team = await teamAgentIds(sb, trim(agent.id));
    return team.includes(trim(row.agent_id));
  }
  return customerOwned(row, agent);
}

async function loadCustomer(sb: SupabaseClient, customerId: string){
  const { data, error } = await sb.from("customers").select(CUSTOMER_LIGHT).eq("id", customerId).maybeSingle();
  if(error) throw new Error(error.message);
  return data as Json | null;
}

function sanitizeQuery(raw: string){
  return trim(raw).replace(/[%_,.()]/g, " ").replace(/\s+/g, " ").slice(0, 80);
}

async function handleSearch(sb: SupabaseClient, agent: AgentRow, args: Json){
  const q = sanitizeQuery(trim(args.query));
  if(!q) return { ok: true, customers: [] as Json[] };
  const pattern = "%" + q.replace(/"/g, "") + "%";
  const { data, error } = await sb.from("customers")
    .select(CUSTOMER_LIGHT)
    .or(`full_name.ilike.${pattern},phone.ilike.${pattern},city.ilike.${pattern},agent_name.ilike.${pattern}`)
    .order("created_at", { ascending: false })
    .limit(20);
  if(error) throw new Error(error.message);
  const visible: Json[] = [];
  for(const row of (data || []) as Json[]){
    if(await customerVisible(sb, row, agent)) visible.push(safeCustomer(row));
    if(visible.length >= 8) break;
  }
  return { ok: true, customers: visible };
}

async function handleFind(sb: SupabaseClient, agent: AgentRow, args: Json){
  const customerId = trim(args.customerId);
  const query = sanitizeQuery(trim(args.query));
  let row: Json | null = null;
  if(customerId){
    row = await loadCustomer(sb, customerId);
  } else if(/^\d{8,9}$/.test(query)){
    const found = await sb.from("customers").select(CUSTOMER_LIGHT).eq("id_number", query).limit(2);
    if(found.error) throw new Error(found.error.message);
    const rows = (found.data || []) as Json[];
    row = rows.length === 1 ? rows[0] : null;
  } else if(query){
    const searched = await handleSearch(sb, agent, { query });
    const list = (searched.customers || []) as Json[];
    return { ok: true, customer: list[0] || null, matches: list.length };
  }
  if(!row || !(await customerVisible(sb, row, agent))) return { ok: false, error: "NOT_VISIBLE" };
  return { ok: true, customer: safeCustomer(row) };
}

async function handleGetCustomer(sb: SupabaseClient, agent: AgentRow, args: Json){
  const row = await loadCustomer(sb, trim(args.customerId));
  if(!row || !(await customerVisible(sb, row, agent))) return { ok: false, error: "NOT_VISIBLE" };
  return { ok: true, customer: safeCustomer(row) };
}

async function handlePolicies(sb: SupabaseClient, agent: AgentRow, args: Json){
  const row = await loadCustomer(sb, trim(args.customerId));
  if(!row || !(await customerVisible(sb, row, agent))) return { ok: false, error: "NOT_VISIBLE" };
  return {
    ok: true,
    customer_id: trim(row.id),
    existing_policies_count: Number(row.existing_policies_count) || 0,
    new_policies_count: Number(row.new_policies_count) || 0,
  };
}

async function handleTasks(sb: SupabaseClient, agent: AgentRow){
  const keys = [trim(agent.name), trim(agent.id)].filter(Boolean);
  const { data, error } = await sb.from("reminders")
    .select("id,type,details,remind_at,customer_id,customer_name,is_done,agent_id")
    .in("agent_id", keys)
    .eq("is_done", false)
    .order("remind_at", { ascending: true })
    .limit(20);
  if(error) throw new Error(error.message);
  return {
    ok: true,
    tasks: (data || []).map((row) => ({
      id: trim((row as Json).id),
      type: trim((row as Json).type),
      details: trim((row as Json).details).slice(0, 160),
      remind_at: trim((row as Json).remind_at),
      customer_name: trim((row as Json).customer_name),
    })),
  };
}

async function handleAgents(sb: SupabaseClient, agent: AgentRow){
  const role = roleOf(agent);
  if(!canViewTeamReports(role)) return { ok: false, error: "FORBIDDEN" };
  let q = sb.from("agents").select("id,name,role,active").eq("active", true).limit(80);
  if(role === "teammanager"){
    const ids = await teamAgentIds(sb, trim(agent.id));
    q = sb.from("agents").select("id,name,role,active").in("id", ids).limit(80);
  }
  const { data, error } = await q;
  if(error) throw new Error(error.message);
  return {
    ok: true,
    agents: (data || []).map((row) => ({
      id: trim((row as Json).id),
      name: trim((row as Json).name),
      role: trim((row as Json).role),
    })),
  };
}

async function countScopedCustomers(sb: SupabaseClient, agent: AgentRow, sinceIso: string){
  const role = roleOf(agent);
  let q = sb.from("customers").select("id", { count: "exact", head: true }).gte("created_at", sinceIso);
  if(!canViewAll(role)){
    if(role === "teammanager"){
      const ids = await teamAgentIds(sb, trim(agent.id));
      q = q.in("agent_id", ids);
    } else {
      q = q.eq("agent_id", trim(agent.id));
    }
  }
  const { count, error } = await q;
  if(error) throw new Error(error.message);
  return count || 0;
}

async function handleProduction(sb: SupabaseClient, agent: AgentRow, kind: string){
  const role = roleOf(agent);
  if(kind !== "self" && !canViewTeamReports(role)) return { ok: false, error: "FORBIDDEN" };
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const files = await countScopedCustomers(sb, agent, start.toISOString());
  return { ok: true, period: "month", customer_files: files, currency: null, note: "ספירת תיקים בלבד, לא פרמיה." };
}

function viewAllowed(view: string, role: string){
  const restricted: Record<string, string[]> = {
    myTeam: ["admin", "owner", "manager", "teammanager"],
    reportsHub: ["admin", "owner", "manager", "teammanager"],
    campaignLeads: ["admin", "owner", "manager", "referent"],
    mirrorCall: ["ops", "opsagent"],
    settings: ["admin", "owner", "manager"],
  };
  const open = ["dashboard", "customers", "proposals", "myTools", "contacts", "dailySales", "myProcesses", "campaignMyLeads"];
  if(open.includes(view)) return true;
  return (restricted[view] || []).includes(role);
}

async function handleOpenCustomer(sb: SupabaseClient, agent: AgentRow, args: Json){
  const row = await loadCustomer(sb, trim(args.customerId));
  if(!row || !(await customerVisible(sb, row, agent))) return { ok: false, error: "NOT_VISIBLE" };
  return {
    ok: true,
    client_command: { type: "open_customer", customerId: trim(row.id) },
  };
}

async function handleGoView(agent: AgentRow, args: Json){
  const view = trim(args.view);
  if(!viewAllowed(view, roleOf(agent))) return { ok: false, error: "FORBIDDEN" };
  return { ok: true, client_command: { type: "go_view", view } };
}

function simAllowed(company: string, product: string){
  return SIM_CATALOG.some(([c, p]) => c === company && p === product);
}

function productFamily(product: string){
  if(product === "ריסק" || product === "ריסק משכנתא") return "risk";
  if(product === "בריאות") return "health";
  if(product === "מחלות קשות" || product === "סרטן") return "ci";
  if(product === "מוות מתאונה" || product === "נכות מתאונה") return "accident";
  return "";
}

function quoteInput(args: Json, family: string){
  const input: Json = {};
  const age = Number(args.age);
  if(Number.isFinite(age) && age > 0) input.age = age;
  const gender = trim(args.gender);
  if(gender) input.gender = gender;
  if(args.smoker === true || args.smoker === false) input.smoker = args.smoker;
  else if(trim(args.smoker)) input.smoker = trim(args.smoker);
  const sum = Number(String(args.sumInsured == null ? args.sum_insured : args.sumInsured).replace(/[^\d.-]/g, ""));
  if(Number.isFinite(sum) && sum > 0) input.sumInsured = sum;
  const compensation = Number(String(args.compensation == null ? "" : args.compensation).replace(/[^\d.-]/g, ""));
  if(Number.isFinite(compensation) && compensation > 0) input.compensation = compensation;
  const covers = Array.isArray(args.covers) ? args.covers.map((x) => trim(x)).filter(Boolean) : [];
  if(covers.length) input.covers = covers;
  const planId = trim(args.planId || args.plan);
  if(planId) input.planId = planId;
  if(family === "health" && !covers.length) input._missing = "covers";
  if(family === "risk" && (!input.age || !input.gender || input.smoker == null || !input.sumInsured)) input._missing = "risk";
  if(family === "ci" && (!input.age || !input.gender || input.smoker == null || !input.compensation)) input._missing = "ci";
  if(family === "accident" && (!input.age || !input.gender || !input.sumInsured)) input._missing = "accident";
  return input;
}

async function handleOpenSimulator(args: Json){
  const company = trim(args.company);
  const product = trim(args.product);
  if(!company || !product) return { ok: false, error: "MISSING_SIM" };
  if(!simAllowed(company, product)) return { ok: false, error: "UNKNOWN_SIM" };
  return {
    ok: true,
    client_command: { type: "open_simulator", company, product },
  };
}

async function handleGetPrice(args: Json){
  const company = trim(args.company);
  const product = trim(args.product);
  if(!company || !product) return { ok: false, error: "MISSING_SIM" };
  if(!simAllowed(company, product)) return { ok: false, error: "UNKNOWN_SIM" };
  const family = productFamily(product);
  const input = quoteInput(args, family);
  const missing = trim(input._missing);
  delete input._missing;
  if(missing){
    return {
      ok: true,
      needs_input: true,
      missing,
      company,
      product,
      client_command: { type: "open_simulator", company, product },
    };
  }
  return {
    ok: true,
    company,
    product,
    family,
    client_command: { type: "quote_simulator", company, product, input },
  };
}

async function handleCreateProposal(sb: SupabaseClient, agent: AgentRow, args: Json){
  const customerId = trim(args.customerId);
  if(customerId){
    const row = await loadCustomer(sb, customerId);
    if(!row || !(await customerVisible(sb, row, agent))) return { ok: false, error: "NOT_VISIBLE" };
  }
  return {
    ok: true,
    client_command: {
      type: "open_wizard",
      customerId,
      company: trim(args.company),
      product: trim(args.product),
    },
  };
}

async function handleCreateTask(sb: SupabaseClient, agent: AgentRow, args: Json){
  const type = trim(args.type) || "callback";
  if(!["callback", "documents", "missing"].includes(type)) return { ok: false, error: "BAD_TYPE" };
  const row = {
    id: "rem_" + Date.now() + "_" + Math.random().toString(16).slice(2),
    agent_id: trim(agent.name) || trim(agent.id),
    type,
    details: trim(args.details).slice(0, 240) || "חזרה ללקוח",
    remind_at: trim(args.remindAt) || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    customer_id: trim(args.customerId) || null,
    customer_name: trim(args.customerName) || null,
    is_done: false,
    created_at: new Date().toISOString(),
    snoozed_until: null,
  };
  const { error } = await sb.from("reminders").insert(row);
  if(error) throw new Error(error.message);
  return { ok: true, taskId: row.id, reminder: row, client_command: { type: "upsert_reminder", reminder: row } };
}

async function handleUpdateTask(sb: SupabaseClient, agent: AgentRow, args: Json){
  const id = trim(args.taskId);
  if(!id) return { ok: false, error: "MISSING_TASK" };
  const existing = await sb.from("reminders").select("id,agent_id").eq("id", id).maybeSingle();
  if(!existing.data) return { ok: false, error: "NOT_FOUND" };
  const owner = trim((existing.data as Json).agent_id);
  if(owner && owner !== trim(agent.name) && owner !== trim(agent.id) && !canViewAll(roleOf(agent))){
    return { ok: false, error: "FORBIDDEN" };
  }
  const patch: Json = {};
  if(args.isDone === true) {
    patch.is_done = true;
    patch.done_at = new Date().toISOString();
  }
  if(trim(args.remindAt)) patch.remind_at = trim(args.remindAt);
  if(!Object.keys(patch).length) return { ok: false, error: "NO_PATCH" };
  const { error } = await sb.from("reminders").update(patch).eq("id", id);
  if(error) throw new Error(error.message);
  if(patch.is_done === true){
    return { ok: true, taskId: id, client_command: { type: "mark_task_done", id } };
  }
  return { ok: true, taskId: id, client_command: { type: "refresh_reminders" } };
}

async function proposeWrite(sb: SupabaseClient, agent: AgentRow, sessionId: string, tool: string, args: Json){
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const label = tool === "create_task" ? "יצירת משימה" : (tool === "create_proposal" ? "יצירת הצעה באשף" : "עדכון משימה");
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
  }).select("id").maybeSingle();
  if(inserted.error) throw new Error(inserted.error.message);
  await sb.from("gi_assistant_context").upsert({
    session_id: sessionId,
    agent_id: trim(agent.id),
    last_intent: "propose_write",
    pending_action_id: trim(inserted.data?.id),
    updated_at: new Date().toISOString(),
  }, { onConflict: "session_id" });
  return {
    ok: true,
    needs_confirmation: true,
    pending_action_id: trim(inserted.data?.id),
    label,
    executed: false,
  };
}

async function takeConfirmed(sb: SupabaseClient, sessionId: string, pendingId: string, tool: string){
  const { data, error } = await sb.from("gi_assistant_pending_actions")
    .select("id,tool,arguments_safe,status,expires_at")
    .eq("id", pendingId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if(error) throw new Error(error.message);
  if(!data || trim(data.tool) !== tool) return { ok: false as const, error: "NO_PENDING" };
  if(data.status !== "confirmed") return { ok: false as const, error: "NOT_CONFIRMED" };
  if(data.expires_at && Date.parse(data.expires_at) <= Date.now()) return { ok: false as const, error: "PENDING_EXPIRED" };
  await sb.from("gi_assistant_pending_actions").update({ status: "executed" }).eq("id", data.id);
  return { ok: true as const, args: (data.arguments_safe && typeof data.arguments_safe === "object") ? data.arguments_safe as Json : {} };
}

async function invoke(sb: SupabaseClient, agent: AgentRow, sessionId: string, body: Json){
  const tool = trim(body.tool);
  const rawArgs = (body.arguments && typeof body.arguments === "object") ? body.arguments as Json : {};
  delete rawArgs.user_id;
  delete rawArgs.userId;
  if(PII_KEY.test(JSON.stringify(Object.keys(rawArgs))) && tool !== "find_customer_by_id"){
    return { ok: false, error: "PII_REJECTED" };
  }
  if(WRITE_TOOLS.has(tool)){
    const pendingId = trim(body.pendingActionId);
    if(!pendingId) return await proposeWrite(sb, agent, sessionId, tool, rawArgs);
    const taken = await takeConfirmed(sb, sessionId, pendingId, tool);
    if(!taken.ok) return { ok: false, error: taken.error, executed: false };
    const args = { ...taken.args, ...rawArgs };
    if(tool === "create_task") return await handleCreateTask(sb, agent, args);
    if(tool === "create_proposal") return await handleCreateProposal(sb, agent, args);
    return await handleUpdateTask(sb, agent, args);
  }
  if(tool === "get_insurance_price") return await handleGetPrice(rawArgs);
  if(tool === "search_customer") return await handleSearch(sb, agent, rawArgs);
  if(tool === "find_customer_by_id") return await handleFind(sb, agent, rawArgs);
  if(tool === "get_customer") return await handleGetCustomer(sb, agent, rawArgs);
  if(tool === "get_customer_policies") return await handlePolicies(sb, agent, rawArgs);
  if(tool === "get_tasks") return await handleTasks(sb, agent);
  if(tool === "get_agents") return await handleAgents(sb, agent);
  if(tool === "get_agent_production" || tool === "get_monthly_production") return await handleProduction(sb, agent, "self");
  if(tool === "get_team_production") return await handleProduction(sb, agent, "team");
  if(tool === "open_customer" || tool === "open_policy") return await handleOpenCustomer(sb, agent, rawArgs);
  if(tool === "open_proposal") {
    const id = trim(rawArgs.proposalId || rawArgs.customerId);
    if(!id) return { ok: false, error: "MISSING_ID" };
    return { ok: true, client_command: { type: "open_proposal", proposalId: id } };
  }
  if(tool === "go_view") return await handleGoView(agent, rawArgs);
  if(tool === "open_simulator") return await handleOpenSimulator(rawArgs);
  return { ok: false, error: "UNKNOWN_TOOL" };
}

Deno.serve(async (req) => {
  if(req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if(req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);
  let body: Json = {};
  try { body = await req.json(); } catch(_e) { body = {}; }
  const sb = sbAdmin();
  try {
    const auth = await authorize(sb, body);
    if(!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    const session = await requireSession(sb, body, trim(auth.agent.id));
    if(!session.ok) return json({ ok: false, error: session.error }, session.status);
    if(trim(body.action) !== "invoke") return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
    const result = await invoke(sb, auth.agent, session.sessionId, body);
    await audit(sb, {
      user_id: trim(auth.agent.id),
      session_id: session.sessionId,
      action: "tool_invoke",
      tool: trim(body.tool),
      customer_id: trim((body.arguments as Json | undefined)?.customerId),
      authorization_result: result.ok === false ? "denied" : "ok",
      confirmation_required: result.needs_confirmation === true,
      execution_status: result.needs_confirmation ? "needs_confirmation" : (result.ok === false ? "error" : "ok"),
      error: result.ok === false ? trim(result.error) : null,
      arguments_safe: { tool: trim(body.tool), hasQuery: !!trim((body.arguments as Json | undefined)?.query) },
    });
    return json(result, result.ok === false && result.error === "FORBIDDEN" ? 403 : 200);
  } catch(err) {
    const message = err instanceof Error ? err.message : String(err);
    await audit(sb, { action: "tool_invoke", execution_status: "error", error: "SERVER" });
    return json({ ok: false, error: "SERVER", detail: message }, 500);
  }
});
