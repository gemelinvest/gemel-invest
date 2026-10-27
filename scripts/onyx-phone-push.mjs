// Sends ONYX reminders and manager sale alerts to the iPhone notification shade.
// A locked iPhone does not run the page clock, so this job sends Declarative Web
// Push (the system shows the banner even when ONYX is closed).
// The VAPID private key stays in the Actions cache, never in the repo or app_meta.
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
const SUPABASE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
const SUBJECT = "mailto:oriasomech@gmail.com";
const PHONE_URL = "https://gemelinvest.github.io/gemel-invest/phone/";
const PUBLIC_ROW = "onyx_push_vapid_public";

export function declarative(title, body, tag) {
  const notification = {
    title: title || "ONYX",
    body: body || "",
    lang: "he",
    dir: "rtl",
    navigate: PHONE_URL,
    silent: false,
    icon: PHONE_URL + "icon-192.png"
  };
  if (tag) notification.tag = String(tag).slice(0, 64);
  return { web_push: 8030, notification };
}

export function reminderLabel(type) {
  const key = String(type || "").trim();
  if (key === "callback") return "חזרה ללקוח";
  if (key === "documents") return "מעקב מסמכים";
  if (key === "missing") return "השלמת חוסרים";
  return "תזכורת";
}

export function isManager(role) {
  const raw = String(role || "").trim().toLowerCase();
  return raw === "admin" || raw === "manager" || raw === "מנהל";
}

function trim(value) {
  return String(value == null ? "" : value).trim();
}

export function wakeAt(row, now) {
  const at = Date.parse(trim(row && row.remind_at));
  const snooze = Date.parse(trim(row && row.snoozed_until));
  const wake = Number.isFinite(snooze) && snooze > at ? snooze : at;
  if (!Number.isFinite(wake) || wake > now) return 0;
  return wake;
}

export function dueRows(rows, now, horizonMs) {
  const since = now - horizonMs;
  const seen = new Set();
  const out = [];
  (rows || []).forEach((row) => {
    const id = trim(row && row.id);
    const wake = wakeAt(row, now);
    if (!id || !wake || wake < since || seen.has(id)) return;
    if (row.is_done === true) return;
    seen.add(id);
    out.push(row);
  });
  return out;
}

function israelNow(now) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(now));
  const get = (type) => parts.find((part) => part.type === type)?.value || "0";
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const wall = Date.UTC(y, m - 1, d, Number(get("hour")), Number(get("minute")), Number(get("second")));
  const offset = wall - now;
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offset);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    day: String(y) + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0")
  };
}

function stampDay(raw, day) {
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

function leadMeta(description) {
  const text = String(description || "");
  const mark = "---LEAD_META_JSON---";
  const at = text.lastIndexOf(mark);
  if (at < 0) return {};
  try {
    const parsed = JSON.parse(text.slice(at + mark.length).trim());
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_err) {
    return {};
  }
}

function moneyText(value) {
  const n = Number(value);
  const rounded = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  if (!(rounded > 0)) return "";
  try { return "₪" + rounded.toLocaleString("he-IL", { maximumFractionDigits: 2 }); }
  catch (_err) { return "₪" + String(rounded); }
}

export function salesToday(rows, day) {
  const items = [];
  (rows || []).forEach((row) => {
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
        title: "מכירה חדשה",
        body: agent + " · " + premium
      });
    }
    if (trim(row.status) === "closed" && stampDay(meta.closedAt || row.updated_at, day) === day) {
      items.push({
        id: "closed:" + trim(row.id) + ":" + trim(meta.closedAt || row.updated_at),
        title: "ליד נסגר",
        body: agent + " · " + premium
      });
    }
  });
  return items;
}

export function subsFor(subs, name) {
  const wanted = trim(name);
  if (!wanted) return [];
  return (subs || []).filter((sub) => {
    return [sub.agent_name, sub.agent_id, sub.username].some((value) => trim(value) === wanted);
  });
}

function hashKey(prefix, value) {
  return prefix + createHash("sha256").update(String(value)).digest("hex").slice(0, 32);
}

function selfTest() {
  let failed = 0;
  const check = (cond, msg) => {
    if (cond) console.log("  PASS  " + msg);
    else {
      failed += 1;
      console.error("  FAIL  " + msg);
    }
  };
  const now = Date.parse("2026-10-27T09:00:00.000Z");
  const note = declarative("חזרה ללקוח", "יוסי", "onyx-rem-1");
  check(note.web_push === 8030 && note.notification.title === "חזרה ללקוח" && note.notification.navigate.startsWith("https://"), "the shade payload is declarative");
  check(!("mutable" in note.notification), "the phone shows the banner without waking the app");
  const rows = dueRows([
    { id: "a", remind_at: "2026-10-27T08:00:00.000Z", is_done: false },
    { id: "b", remind_at: "2026-10-27T12:00:00.000Z", is_done: false },
    { id: "c", remind_at: "2026-10-20T08:00:00.000Z", is_done: false },
    { id: "d", remind_at: "2026-10-27T07:00:00.000Z", snoozed_until: "2026-10-27T10:00:00.000Z", is_done: false },
    { id: "e", remind_at: "2026-10-27T07:00:00.000Z", is_done: true }
  ], now, 36 * 60 * 60 * 1000);
  check(rows.map((row) => row.id).join() === "a", "only a due reminder is sent");
  check(isManager("manager") && isManager("admin") && !isManager("agent"), "sale alerts go to a manager");
  const sales = salesToday([{
    id: "l1",
    assigned_agent_name: "דנה",
    status: "open",
    updated_at: "2026-10-27T08:00:00.000Z",
    description: "---LEAD_META_JSON---" + JSON.stringify({ proposalPremiumAt: "2026-10-27T08:00:00.000Z", proposalPremiumMonthly: 120 })
  }], "2026-10-27");
  check(sales.length === 1 && sales[0].title === "מכירה חדשה", "a sale today is included");
  check(subsFor([{ agent_name: "דנה", agent_id: "1" }], "דנה").length === 1, "a reminder reaches that agent's phone");
  if (failed) process.exit(1);
  console.log("self-test passed");
}

if (process.argv.includes("--self-test")) selfTest();

async function rest(method, path, body, prefer) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: "Bearer " + SUPABASE_KEY,
    Accept: "application/json"
  };
  if (body != null) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (_err) { data = text; }
  }
  return { status: res.status, data };
}

function loadKeys(file) {
  if (existsSync(file)) {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (parsed && parsed.publicKey && parsed.privateKey) return parsed;
  }
  const require = createRequire(import.meta.url);
  const webpush = require("web-push");
  const keys = webpush.generateVAPIDKeys();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(keys), { mode: 0o600 });
  return keys;
}

async function publishPublic(publicKey) {
  const existing = await rest("GET", "app_meta?select=payload&key=eq." + PUBLIC_ROW);
  const current = existing.data && existing.data[0] && existing.data[0].payload && existing.data[0].payload.publicKey;
  if (current === publicKey) return;
  const saved = await rest("POST", "app_meta?on_conflict=key", {
    key: PUBLIC_ROW,
    payload: { publicKey },
    updated_at: new Date().toISOString()
  }, "resolution=merge-duplicates,return=minimal");
  if (saved.status >= 300) throw new Error("public-key " + saved.status);
}

async function loadSubs() {
  const res = await rest("GET", "app_meta?select=key,payload&key=like.onyxsub_*&limit=1000");
  if (res.status >= 300) throw new Error("subs " + res.status);
  return (Array.isArray(res.data) ? res.data : []).map((row) => row.payload || {}).filter((sub) => sub.endpoint && sub.p256dh && sub.auth);
}

async function loadDue() {
  const now = new Date();
  const since = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();
  const select = "id,type,details,remind_at,customer_name,agent_id,is_done,snoozed_until";
  const due = await rest("GET", "reminders?select=" + select + "&is_done=eq.false&remind_at=lte." + encodeURIComponent(nowIso) + "&remind_at=gte." + encodeURIComponent(since) + "&limit=80");
  if (due.status >= 300) throw new Error("reminders " + due.status);
  const snoozed = await rest("GET", "reminders?select=" + select + "&is_done=eq.false&snoozed_until=lte." + encodeURIComponent(nowIso) + "&snoozed_until=gte." + encodeURIComponent(since) + "&limit=40");
  const extra = snoozed.status < 300 && Array.isArray(snoozed.data) ? snoozed.data : [];
  return dueRows((Array.isArray(due.data) ? due.data : []).concat(extra), now.getTime(), 36 * 60 * 60 * 1000);
}

async function loadSales() {
  const range = israelNow(Date.now());
  const path = "campaign_leads?select=id,customer_name,assigned_agent_name,status,description,updated_at"
    + "&updated_at=gte." + encodeURIComponent(range.start)
    + "&updated_at=lt." + encodeURIComponent(range.end)
    + "&or=" + encodeURIComponent("(status.eq.closed,description.ilike.*proposalPremiumAt*)")
    + "&order=updated_at.desc&limit=80";
  const res = await rest("GET", path);
  if (res.status >= 300) return [];
  return salesToday(Array.isArray(res.data) ? res.data : [], range.day).slice(0, 12);
}

async function claim(id) {
  const key = hashKey("onyxsent_", id);
  const res = await rest("POST", "app_meta", {
    key,
    payload: { at: new Date().toISOString() },
    updated_at: new Date().toISOString()
  }, "return=minimal");
  if (res.status === 409 || res.status === 23505) return false;
  if (res.status >= 300) {
    const message = res.data && res.data.message ? res.data.message : "";
    if (/duplicate|already exists/i.test(message)) return false;
    throw new Error("claim " + res.status);
  }
  return true;
}

async function release(id) {
  const key = hashKey("onyxsent_", id);
  await rest("DELETE", "app_meta?key=eq." + encodeURIComponent(key));
}

async function sendOne(webpush, sub, payload) {
  try {
    await webpush.sendNotification({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    }, JSON.stringify(payload), {
      TTL: 12 * 60 * 60,
      urgency: "high"
    });
    return "sent";
  } catch (err) {
    const status = err && err.statusCode;
    if (status === 404 || status === 410) return "gone";
    return "retry";
  }
}

async function pushTo(webpush, subs, payload, sentId) {
  if (!subs.length) return "none";
  if (!await claim(sentId)) return "seen";
  let delivered = 0;
  let retry = false;
  for (const sub of subs) {
    const result = await sendOne(webpush, sub, payload);
    if (result === "sent") delivered += 1;
    else if (result === "gone") {
      const key = hashKey("onyxsub_", sub.endpoint);
      await rest("DELETE", "app_meta?key=eq." + encodeURIComponent(key));
    } else retry = true;
  }
  if (!delivered && retry) await release(sentId);
  return delivered ? "sent" : "failed";
}

async function main() {
  if (process.argv.includes("--self-test")) return;
  const file = process.env.ONYX_VAPID_FILE || ".onyx-vapid/keys.json";
  const keys = loadKeys(file);
  await publishPublic(keys.publicKey);
  const require = createRequire(import.meta.url);
  const webpush = require("web-push");
  webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey);
  const subs = await loadSubs();
  const managers = subs.filter((sub) => isManager(sub.role));
  let reminders = 0;
  let sales = 0;
  for (const row of await loadDue()) {
    const wake = trim(row.snoozed_until) || trim(row.remind_at);
    const result = await pushTo(webpush, subsFor(subs, row.agent_id), declarative(
      reminderLabel(row.type),
      [trim(row.details), trim(row.customer_name)].filter(Boolean).join(" · "),
      "onyx-rem-" + trim(row.id)
    ), "rem:" + trim(row.id) + ":" + wake);
    if (result === "sent") reminders += 1;
  }
  for (const item of await loadSales()) {
    const result = await pushTo(webpush, managers, declarative(item.title, item.body, "onyx-sale-" + item.id), item.id);
    if (result === "sent") sales += 1;
  }
  console.log(JSON.stringify({ ok: true, reminders, sales, phones: subs.length }));
}

if (!process.argv.includes("--self-test")) {
  main().catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
}
