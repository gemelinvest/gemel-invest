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
  username: string;
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

const PHONE_URL = "https://gemelinvest.github.io/gemel-invest/phone/";

function vapidFromEnv() {
  const publicKey = trim(Deno.env.get("ONYX_VAPID_PUBLIC_KEY"));
  const privateKey = trim(Deno.env.get("ONYX_VAPID_PRIVATE_KEY"));
  if (!publicKey || !privateKey) return null;
  return { public_key: publicKey, private_key: privateKey };
}

async function ensureKeys(sb: SupabaseClient) {
  const fromEnv = vapidFromEnv();
  if (fromEnv) return fromEnv;
  const existing = await sb.from("onyx_phone_vapid").select("public_key,private_key").eq("id", 1).maybeSingle();
  if (existing.error) {
    if (missingTable(existing.error)) return { error: "missing-key" as const };
    throw new Error(existing.error.message);
  }
  if (existing.data && existing.data.public_key && existing.data.private_key) return existing.data;
  return { error: "missing-key" as const };
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

async function hashKey(prefix: string, value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const hex = Array.from(new Uint8Array(buf)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return prefix + hex.slice(0, 32);
}

function declarative(title: string, body: string, tag: string) {
  const notification: Json = {
    title: title || "ONYX",
    body: body || "",
    lang: "he",
    dir: "rtl",
    navigate: PHONE_URL,
    silent: false,
    icon: PHONE_URL + "icon-192.png",
  };
  if (tag) notification.tag = tag.slice(0, 64);
  return { web_push: 8030, notification } as Json;
}

async function claim(sb: SupabaseClient, id: string) {
  const key = await hashKey("onyxsent_", id);
  const inserted = await sb.from("app_meta").insert({
    key,
    payload: { at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  });
  if (!inserted.error) return true;
  const message = trim(inserted.error.message);
  const code = trim(inserted.error.code);
  if (code === "23505" || /duplicate|already exists/i.test(message)) return false;
  throw new Error(message || "claim");
}

async function release(sb: SupabaseClient, id: string) {
  const key = await hashKey("onyxsent_", id);
  await sb.from("app_meta").delete().eq("key", key);
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
        const key = await hashKey("onyxsub_", sub.endpoint);
        await sb.from("app_meta").delete().eq("key", key);
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
  const items: Array<{ id: string; title: string; body: string }> = [];
  rows.forEach((row) => {
    const meta = leadMeta(row.description);
    const agent = trim(row.assigned_agent_name) || "נציג";
    const monthly = Number(meta.proposalPremiumMonthly) || 0;
    const annual = Number(meta.proposalPremiumAnnual) || 0;
    const customer = trim(row.customer_name);
    const bits = [];
    const month = moneyText(monthly);
    const year = moneyText(annual);
    if (month) bits.push(month + " · בריאות וסיכונים");
    if (year) bits.push(year + " · אלמנטרי");
    const premium = bits.join(" · ");
    if (stampDay(meta.proposalPremiumAt, day) === day && premium) {
      items.push({
        id: "sale:" + trim(row.id) + ":" + trim(meta.proposalPremiumAt),
        title: "מכירה חדשה",
        body: agent + " · " + premium,
      });
    }
    if (trim(row.status) === "closed" && stampDay(meta.closedAt || row.updated_at, day) === day) {
      items.push({
        id: "closed:" + trim(row.id) + ":" + day,
        title: "ליד נסגר",
        body: [agent, customer].filter(Boolean).join(" · "),
      });
    }
  });
  return items;
}

function isManager(role: unknown) {
  const raw = trim(role).toLowerCase();
  return raw === "admin" || raw === "manager" || raw === "מנהל";
}

function subsFor(subs: SubRow[], name: string) {
  const wanted = trim(name);
  if (!wanted) return [];
  return subs.filter((sub) => {
    return [sub.agent_name, sub.agent_id, sub.username].some((value) => trim(value) === wanted);
  });
}

async function loadPhoneSubs(sb: SupabaseClient) {
  const res = await sb.from("app_meta").select("key,payload").like("key", "onyxsub_%").limit(1000);
  if (res.error) throw new Error(res.error.message);
  return (Array.isArray(res.data) ? res.data : []).map((row) => {
    const payload = row.payload && typeof row.payload === "object" ? row.payload as Json : {};
    return {
      endpoint: trim(payload.endpoint),
      agent_id: trim(payload.agent_id),
      agent_name: trim(payload.agent_name),
      username: trim(payload.username),
      role: trim(payload.role),
      p256dh: trim(payload.p256dh),
      auth: trim(payload.auth),
    };
  }).filter((sub) => sub.endpoint && sub.p256dh && sub.auth) as SubRow[];
}

async function dispatch(sb: SupabaseClient) {
  const keys = await ensureKeys(sb);
  if ("error" in keys) return json({ ok: false, error: "missing-key" }, 503);
  const vapid = { publicKey: keys.public_key, privateKey: keys.private_key };
  const subs = await loadPhoneSubs(sb);
  const managers = subs.filter((sub) => isManager(sub.role));
  let reminders = 0;
  let sales = 0;
  for (const row of await dueReminders(sb)) {
    const wake = trim(row.snoozed_until) || trim(row.remind_at);
    const note = declarative(
      reminderLabel(row.type),
      [trim(row.details), trim(row.customer_name)].filter(Boolean).join(" · "),
      "onyx-rem-" + trim(row.id),
    );
    const result = await pushTo(sb, subsFor(subs, trim(row.agent_id)), note, vapid, "rem:" + trim(row.id) + ":" + wake);
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
    const result = await pushTo(sb, managers, declarative(item.title, item.body, "onyx-sale-" + item.id), vapid, item.id);
    if (result === "sent") sales += 1;
  }
  return json({ ok: true, reminders, sales, phones: subs.length });
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
      if ("error" in keys) return json({ ok: false, error: keys.error }, 503);
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
