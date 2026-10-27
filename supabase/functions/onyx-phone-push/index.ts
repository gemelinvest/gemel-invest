// ONYX phone lock-screen alerts. A sleeping iPhone does not run page timers,
// so reminders and manager sales are delivered with Web Push.
// Apply supabase-onyx-phone-push.sql once. The clock is the GitHub workflow,
// and pg_cron when that extension is already installed.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import webpushMod from "npm:web-push@3.6.7";

const webpush = (webpushMod as { default?: typeof webpushMod }).default ?? webpushMod;
const SUBJECT = "mailto:oriasomech@gmail.com";
const DISPATCH_HEADER = "x-onyx-push";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-onyx-push",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Json = Record<string, unknown>;
type SubRow = {
  endpoint: string;
  agent_id: string;
  agent_name: string;
  role: string;
  p256dh: string;
  auth: string;
};

function json(data: Json, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function trim(value: unknown) {
  return String(value == null ? "" : value).trim();
}

function roleKey(role: unknown) {
  const raw = trim(role).toLowerCase();
  if (raw === "מנהל צוות" || raw === "team_manager" || raw === "teammanager") return "teammanager";
  if (raw === "מנהל" || raw === "manager") return "manager";
  if (raw === "admin" || raw === "מנהל מערכת" || raw === "owner") return "admin";
  if (raw === "נציג" || raw === "agent") return "agent";
  return raw;
}

function missingTable(error: { message?: string } | null) {
  const message = trim(error && error.message);
  return /onyx_phone_|schema cache|does not exist|relation/i.test(message);
}

function admin() {
  const url = trim(Deno.env.get("SUPABASE_URL"));
  const key = trim(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!url || !key) throw new Error("missing-service");
  return createClient(url, key, { auth: { persistSession: false } });
}

function israelNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "0";
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const wall = Date.UTC(y, m - 1, d, Number(get("hour")), Number(get("minute")), Number(get("second")));
  const offset = wall - now.getTime();
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offset);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    day: String(y) + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0"),
  };
}

function stampDay(raw: unknown, day: string) {
  const s = trim(raw);
  if (!s) return "";
  const isoDay = /^(\d{4}-\d{2}-\d{2})$/.exec(s);
  if (isoDay) return isoDay[1];
  const ilDay = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (ilDay) return ilDay[3] + "-" + ilDay[2] + "-" + ilDay[1];
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) {
    const prefix = /^(\d{4}-\d{2}-\d{2})/.exec(s);
    return prefix ? prefix[1] : "";
  }
  try {
    return new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  } catch (_err) {
    return day;
  }
}

function leadMeta(description: unknown) {
  const text = String(description || "");
  const mark = "---LEAD_META_JSON---";
  const at = text.lastIndexOf(mark);
  if (at < 0) return {} as Json;
  try {
    const parsed = JSON.parse(text.slice(at + mark.length).trim());
    return parsed && typeof parsed === "object" ? parsed as Json : {};
  } catch (_err) {
    return {} as Json;
  }
}

function moneyText(value: unknown) {
  const n = Number(value);
  const rounded = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  if (!(rounded > 0)) return "";
  try { return "₪" + rounded.toLocaleString("he-IL", { maximumFractionDigits: 2 }); }
  catch (_err) { return "₪" + String(rounded); }
}

function reminderLabel(type: unknown) {
  const key = trim(type);
  if (key === "callback") return "חזרה ללקוח";
  if (key === "documents") return "מעקב מסמכים";
  if (key === "missing") return "השלמת חוסרים";
  return "תזכורת";
}

async function ensureKeys(sb: SupabaseClient) {
  const existing = await sb.from("onyx_phone_vapid").select("public_key,private_key").eq("id", 1).maybeSingle();
  if (existing.error) {
    if (missingTable(existing.error)) return { error: "missing-table" as const };
    throw new Error(existing.error.message);
  }
  if (existing.data && existing.data.public_key && existing.data.private_key) return existing.data;
  const keys = webpush.generateVAPIDKeys();
  const saved = await sb.from("onyx_phone_vapid").upsert({
    id: 1,
    public_key: keys.publicKey,
    private_key: keys.privateKey,
  }, { onConflict: "id", ignoreDuplicates: true });
  if (saved.error) {
    if (missingTable(saved.error)) return { error: "missing-table" as const };
    throw new Error(saved.error.message);
  }
  const again = await sb.from("onyx_phone_vapid").select("public_key,private_key").eq("id", 1).maybeSingle();
  if (again.error || !again.data) throw new Error(again.error?.message || "vapid");
  return again.data;
}

async function actor(sb: SupabaseClient, req: Request) {
  const jwt = trim(req.headers.get("Authorization")).replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const user = await sb.auth.getUser(jwt);
  if (user.error || !user.data.user) return null;
  const uid = user.data.user.id;
  const byAuth = await sb.from("agents").select("id,name,role").eq("auth_user_id", uid).maybeSingle();
  if (byAuth.data && trim(byAuth.data.id)) return byAuth.data;
  const meta = user.data.user.app_metadata || {};
  const userMeta = user.data.user.user_metadata || {};
  const agentId = trim(meta.agent_id || meta.agentId || userMeta.agent_id || userMeta.agentId);
  if (!agentId) return null;
  const byId = await sb.from("agents").select("id,name,role").eq("id", agentId).maybeSingle();
  return byId.data && trim(byId.data.id) ? byId.data : null;
}

async function sendOne(sub: SubRow, payload: Json, vapid: { publicKey: string; privateKey: string }) {
  const details = webpush.generateRequestDetails({
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  }, JSON.stringify(payload), {
    TTL: 12 * 60 * 60,
    urgency: "high",
    vapidDetails: {
      subject: SUBJECT,
      publicKey: vapid.publicKey,
      privateKey: vapid.privateKey,
    },
  });
  const headers = new Headers();
  const source = details.headers || {};
  Object.keys(source).forEach((key) => {
    const value = source[key];
    if (value != null) headers.set(key, String(value));
  });
  const raw = details.body;
  const res = await fetch(details.endpoint, {
    method: "POST",
    headers,
    body: raw ? new Uint8Array(raw) : undefined,
  });
  return res.status;
}

async function claim(sb: SupabaseClient, id: string) {
  const inserted = await sb.from("onyx_phone_push_sent").insert({ id });
  return !inserted.error;
}

async function release(sb: SupabaseClient, id: string) {
  await sb.from("onyx_phone_push_sent").delete().eq("id", id);
}

async function pushTo(sb: SupabaseClient, subs: SubRow[], payload: Json, vapid: { publicKey: string; privateKey: string }, sentId: string) {
  if (!subs.length) return "none";
  if (!await claim(sb, sentId)) return "seen";
  let delivered = 0;
  let retry = false;
  for (const sub of subs) {
    try {
      const status = await sendOne(sub, payload, vapid);
      if (status === 404 || status === 410) {
        await sb.from("onyx_phone_push").delete().eq("endpoint", sub.endpoint);
      } else if (status >= 200 && status < 300) delivered += 1;
      else retry = true;
    } catch (_err) {
      retry = true;
    }
  }
  if (!delivered && retry) await release(sb, sentId);
  return delivered ? "sent" : "failed";
}

async function dueReminders(sb: SupabaseClient) {
  const now = new Date();
  const since = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();
  let res = await sb.from("reminders")
    .select("id,type,details,remind_at,customer_name,agent_id,is_done,snoozed_until")
    .eq("is_done", false)
    .lte("remind_at", nowIso)
    .gte("remind_at", since)
    .limit(80);
  if (res.error && /snoozed_until/i.test(res.error.message || "")) {
    res = await sb.from("reminders")
      .select("id,type,details,remind_at,customer_name,agent_id,is_done")
      .eq("is_done", false)
      .lte("remind_at", nowIso)
      .gte("remind_at", since)
      .limit(80);
  }
  if (res.error) throw new Error(res.error.message);
  const rows = Array.isArray(res.data) ? res.data : [];
  let snoozed: typeof rows = [];
  const snooze = await sb.from("reminders")
    .select("id,type,details,remind_at,customer_name,agent_id,is_done,snoozed_until")
    .eq("is_done", false)
    .lte("snoozed_until", nowIso)
    .gte("snoozed_until", since)
    .limit(40);
  if (!snooze.error && Array.isArray(snooze.data)) snoozed = snooze.data;
  const seen = new Set<string>();
  return rows.concat(snoozed).filter((row) => {
    const id = trim(row.id);
    if (!id || seen.has(id)) return false;
    const wake = Date.parse(trim(row.snoozed_until) || trim(row.remind_at));
    if (Number.isFinite(wake) && wake > now.getTime()) return false;
    seen.add(id);
    return true;
  });
}

function salesToday(rows: Json[], day: string) {
  const items: Array<{ id: string; agent: string; body: string }> = [];
  rows.forEach((row) => {
    const meta = leadMeta(row.description);
    const agent = trim(row.assigned_agent_name) || "נציג";
    const monthly = Number(meta.proposalPremiumMonthly) || 0;
    const annual = Number(meta.proposalPremiumAnnual) || 0;
    const bits = [];
    const month = moneyText(monthly);
    const year = moneyText(annual);
    if (month) bits.push(month + " · בריאות וסיכונים");
    if (year) bits.push(year + " · אלמנטרי");
    const premium = bits.join(" · ") || "אין פרמיה רשומה";
    if (stampDay(meta.proposalPremiumAt, day) === day && (monthly > 0 || annual > 0)) {
      items.push({
        id: "sale:" + trim(row.id) + ":" + trim(meta.proposalPremiumAt),
        agent,
        body: "מכירה באשף בריאות וסיכונים · " + premium,
      });
    }
    if (trim(row.status) === "closed" && stampDay(meta.closedAt || row.updated_at, day) === day) {
      items.push({
        id: "closed:" + trim(row.id) + ":" + trim(meta.closedAt || row.updated_at),
        agent,
        body: "ליד נסגר · " + premium,
      });
    }
  });
  return items;
}

async function dispatch(sb: SupabaseClient) {
  const keys = await ensureKeys(sb);
  if ("error" in keys) return json({ ok: false, error: "missing-table" }, 503);
  const vapid = { publicKey: keys.public_key, privateKey: keys.private_key };
  const subsRes = await sb.from("onyx_phone_push").select("endpoint,agent_id,agent_name,role,p256dh,auth").limit(1000);
  if (subsRes.error) {
    if (missingTable(subsRes.error)) return json({ ok: false, error: "missing-table" }, 503);
    throw new Error(subsRes.error.message);
  }
  const subs = (Array.isArray(subsRes.data) ? subsRes.data : []) as SubRow[];
  const managers = subs.filter((sub) => {
    const role = roleKey(sub.role);
    return role === "admin" || role === "manager";
  });
  let reminders = 0;
  let sales = 0;
  for (const row of await dueReminders(sb)) {
    const name = trim(row.agent_id);
    const mine = subs.filter((sub) => trim(sub.agent_name) === name || trim(sub.agent_id) === name);
    const wake = trim(row.snoozed_until) || trim(row.remind_at);
    const result = await pushTo(sb, mine, {
      title: reminderLabel(row.type),
      body: [trim(row.details), trim(row.customer_name)].filter(Boolean).join(" · "),
      tag: "onyx-rem-" + trim(row.id),
      kind: "reminder",
      id: trim(row.id),
    }, vapid, "rem:" + trim(row.id) + ":" + wake);
    if (result === "sent") reminders += 1;
  }
  const range = israelNow();
  const leads = await sb.from("campaign_leads")
    .select("id,customer_name,assigned_agent_name,status,description,updated_at")
    .gte("updated_at", range.start)
    .lt("updated_at", range.end)
    .or("status.eq.closed,description.ilike.%proposalPremiumAt%")
    .order("updated_at", { ascending: false })
    .limit(80);
  if (leads.error) throw new Error(leads.error.message);
  for (const item of salesToday(Array.isArray(leads.data) ? leads.data as Json[] : [], range.day).slice(0, 12)) {
    const result = await pushTo(sb, managers, {
      title: item.agent,
      body: item.body,
      tag: "onyx-sale-" + item.id,
      kind: "sale",
      id: item.id,
    }, vapid, item.id);
    if (result === "sent") sales += 1;
  }
  return json({ ok: true, reminders, sales });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  let body: Json = {};
  try { body = await req.json(); } catch (_err) { body = {}; }
  const action = trim(body.action);
  try {
    const sb = admin();
    if (action === "dispatch") {
      const expected = trim(Deno.env.get("ONYX_PUSH_CRON_SECRET"));
      const got = trim(req.headers.get(DISPATCH_HEADER));
      if (expected) {
        if (got !== expected) return json({ ok: false, error: "forbidden" }, 401);
      } else if (got !== "dispatch") {
        return json({ ok: false, error: "forbidden" }, 401);
      }
      return await dispatch(sb);
    }
    const user = await actor(sb, req);
    if (!user) return json({ ok: false, error: "auth" }, 401);
    if (action === "public-key") {
      const keys = await ensureKeys(sb);
      if ("error" in keys) return json({ ok: false, error: "missing-table" }, 503);
      return json({ ok: true, publicKey: keys.public_key });
    }
    if (action === "save") {
      const endpoint = trim(body.endpoint);
      const p256dh = trim(body.p256dh);
      const auth = trim(body.auth);
      if (!endpoint || !p256dh || !auth) return json({ ok: false, error: "subscription" }, 400);
      const saved = await sb.from("onyx_phone_push").upsert({
        endpoint,
        agent_id: trim(user.id),
        agent_name: trim(user.name),
        role: roleKey(user.role),
        p256dh,
        auth,
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (saved.error) {
        if (missingTable(saved.error)) return json({ ok: false, error: "missing-table" }, 503);
        throw new Error(saved.error.message);
      }
      return json({ ok: true });
    }
    return json({ ok: false, error: "action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "push";
    if (message === "missing-service") return json({ ok: false, error: "missing-service" }, 500);
    return json({ ok: false, error: "push" }, 500);
  }
});
