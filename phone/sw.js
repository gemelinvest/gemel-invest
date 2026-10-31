/* ONYX phone shell only. Does not cache Supabase or the desktop CRM. */
const CACHE = "onyx-phone-shell-v99";
const SHELL = ["./index.html", "./phone.css", "./phone.js", "./discount-catalog.js", "./manifest.webmanifest", "./home-logo.png", "./splash-logo.png", "./portal-og.jpg", "./logos/phoenix.png", "./logos/menora.png", "./logos/hachshara.png", "./logos/migdal.png", "./logos/ayalon.png", "./logos/clal.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("onyx-phone-shell-") && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

let armed = [];
let saleTimer = 0;
let saleWatch = null;
const shownTags = new Set();

function pageIsAwake() {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((open) => {
    if (!open.length) return false;
    return Promise.all(open.map((client) => new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(false), 1200);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        const data = event.data || {};
        resolve(data.visible === true);
      };
      try {
        client.postMessage({ type: "ping" }, [channel.port2]);
      } catch (_err) {
        clearTimeout(timer);
        resolve(false);
      }
    }))).then((answers) => answers.some(Boolean));
  });
}

async function showOnce(title, options) {
  const tag = options && options.tag ? String(options.tag) : "";
  if (tag) {
    if (shownTags.has(tag)) return;
    try {
      const existing = await self.registration.getNotifications({ tag: tag });
      if (existing.length) {
        shownTags.add(tag);
        return;
      }
    } catch (_err) {}
    shownTags.add(tag);
  }
  const safe = Object.assign({}, options || {});
  delete safe.badge;
  await self.registration.showNotification(title, safe);
}

function idFromTag(tag) {
  const text = String(tag || "");
  if (text.indexOf("onyx-closed-") === 0) return text.slice("onyx-closed-".length);
  if (text.indexOf("onyx-sale-") === 0) return text.slice("onyx-sale-".length);
  return "";
}

function closedAlreadySeen(seen, id) {
  const key = String(id || "");
  if (!key || seen.has(key)) return true;
  if (key.indexOf("closed:") !== 0) return false;
  const leadId = key.split(":")[1];
  if (!leadId) return false;
  const prefix = "closed:" + leadId + ":";
  for (const old of seen) {
    if (String(old).indexOf(prefix) === 0) return true;
  }
  return false;
}

function openSeenDb() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("onyx-phone-seen", 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("ids")) req.result.createObjectStore("ids");
      };
      req.onerror = () => resolve(null);
      req.onsuccess = () => resolve(req.result);
    } catch (_err) { resolve(null); }
  });
}

async function readRememberedIds() {
  const db = await openSeenDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const all = db.transaction("ids", "readonly").objectStore("ids").getAllKeys();
      all.onsuccess = () => { db.close(); resolve((all.result || []).map((id) => String(id))); };
      all.onerror = () => { db.close(); resolve([]); };
    } catch (_err) { db.close(); resolve([]); }
  });
}

async function rememberAlertIds(ids) {
  const list = (ids || []).map((id) => String(id || "")).filter(Boolean);
  if (!list.length) return;
  const db = await openSeenDb();
  if (!db) return;
  await new Promise((resolve) => {
    try {
      const tx = db.transaction("ids", "readwrite");
      const store = tx.objectStore("ids");
      list.forEach((id) => store.put(Date.now(), id));
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    } catch (_err) { db.close(); resolve(); }
  });
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
    hourCycle: "h23"
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type).value;
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
    day: String(y) + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0")
  };
}

function stampDay(raw, day) {
  const s = String(raw || "").trim();
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
  const rounded = Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  if (!(rounded > 0)) return "";
  try { return "₪" + rounded.toLocaleString("he-IL", { maximumFractionDigits: 2 }); }
  catch (_err) { return "₪" + String(rounded); }
}

function saleBody(monthly, annual) {
  const bits = [];
  const month = moneyText(monthly);
  const year = moneyText(annual);
  if (month) bits.push(month + " · בריאות וסיכונים");
  if (year) bits.push(year + " · אלמנטרי");
  return bits.join(" · ");
}

function salesFromRows(rows, day) {
  const items = [];
  (rows || []).forEach((row) => {
    const meta = leadMeta(row.description);
    const agent = String(row.assigned_agent_name || "").trim() || "נציג";
    const customer = String(row.customer_name || "").trim();
    const monthly = Number(meta.proposalPremiumMonthly) || 0;
    const annual = Number(meta.proposalPremiumAnnual) || 0;
    const premium = saleBody(monthly, annual);
    if (stampDay(meta.proposalPremiumAt, day) === day && premium) {
      items.push({
        id: "sale:" + row.id + ":" + String(meta.proposalPremiumAt || "").trim(),
        title: "מכירה חדשה",
        body: agent + " · " + premium,
        customer: customer
      });
    }
    if (String(row.status || "").trim() === "closed" && stampDay(meta.closedAt || row.updated_at, day) === day) {
      items.push({
        id: "closed:" + row.id + ":" + day,
        title: "ליד נסגר",
        body: [agent, customer].filter(Boolean).join(" · ")
      });
    }
  });
  return items;
}

function shiftKey(day, delta) {
  const parts = String(day || "").split("-").map(Number);
  const dt = new Date(Date.UTC(parts[0], (parts[1] || 1) - 1, (parts[2] || 1) + delta));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return dt.getUTCFullYear() + "-" + mm + "-" + dd;
}

function scheduleSaleCheck(delay) {
  clearTimeout(saleTimer);
  if (!saleWatch || Date.now() > saleWatch.until) return;
  saleTimer = setTimeout(() => { void checkSales(); }, delay);
}

function policyAmount(policy) {
  if (!policy || String(policy.origin || "") === "existing") return 0;
  const after = Number(policy.premiumAfterDiscountValue);
  if (after > 0) return after;
  const raw = String(policy.premiumMonthly || "").replace(/[^\d.]/g, "");
  const amount = Number(raw);
  return amount > 0 ? amount : 0;
}

function policySales(rows, day, stampedNames) {
  const skip = new Set(stampedNames || []);
  const items = [];
  (rows || []).forEach((row) => {
    const customer = String(row.full_name || "").trim();
    if (customer && skip.has(customer)) return;
    const payload = row.payload || {};
    const lists = [];
    if (Array.isArray(payload.newPolicies)) lists.push(payload.newPolicies);
    if (payload.operational && Array.isArray(payload.operational.newPolicies)) lists.push(payload.operational.newPolicies);
    const seen = new Set();
    let monthly = 0;
    lists.forEach((list) => {
      list.forEach((policy) => {
        const id = String(policy && policy.id || "");
        if (id && seen.has(id)) return;
        if (stampDay(policy && policy._addedAt, day) !== day) return;
        const amount = policyAmount(policy);
        if (!(amount > 0)) return;
        if (id) seen.add(id);
        monthly += amount;
      });
    });
    monthly = Math.round(monthly * 100) / 100;
    const premium = saleBody(monthly, 0);
    if (!premium) return;
    const agent = String(row.agent_name || "").trim() || "נציג";
    items.push({
      id: "sale:cust:" + String(row.id || "") + ":" + day,
      title: "מכירה חדשה",
      body: agent + " · " + premium,
      customer: customer
    });
  });
  return items;
}

async function fetchLeadRows(watch, pairs) {
  const url = new URL(watch.url + "/rest/v1/campaign_leads");
  url.searchParams.set("select", "id,customer_name,assigned_agent_name,status,description,updated_at");
  pairs.forEach((pair) => url.searchParams.append(pair[0], pair[1]));
  url.searchParams.set("order", "updated_at.desc");
  url.searchParams.set("limit", "80");
  const res = await fetch(url.toString(), {
    headers: {
      apikey: watch.key,
      Authorization: "Bearer " + watch.token,
      Accept: "application/json"
    }
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

async function checkSales() {
  const watch = saleWatch;
  if (!watch || Date.now() > watch.until) return;
  try {
    const range = israelNow();
    const yesterday = shiftKey(range.day, -1);
    const touched = await fetchLeadRows(watch, [
      ["updated_at", "gte." + range.start],
      ["updated_at", "lt." + range.end],
      ["or", "(status.eq.closed,description.ilike.*proposalPremiumAt*)"]
    ]);
    const stamped = await fetchLeadRows(watch, [
      ["or", "(description.ilike.*proposalPremiumAt*" + range.day + "*,description.ilike.*proposalPremiumAt*" + yesterday + "*)"]
    ]);
    const byId = new Map();
    touched.concat(stamped).forEach((row) => { if (row && row.id) byId.set(row.id, row); });
    const rows = Array.from(byId.values()).filter((row) => {
      const at = String(row.updated_at || "");
      return at >= range.start && at < range.end || String(row.description || "").indexOf("proposalPremiumAt") >= 0;
    });
    const seen = new Set(watch.seen);
    (await readRememberedIds()).forEach((id) => seen.add(id));
    const leadItems = salesFromRows(rows, range.day);
    const stampedNames = leadItems.filter((item) => String(item.id).indexOf("sale:") === 0 && String(item.id).indexOf("sale:cust:") !== 0).map((item) => item.customer);
    let policies = [];
    try {
      const url = new URL(watch.url + "/rest/v1/customers");
      url.searchParams.set("select", "id,full_name,agent_name,payload");
      url.searchParams.set("updated_at", "gte." + range.start);
      url.searchParams.append("updated_at", "lt." + range.end);
      url.searchParams.set("new_policies_count", "gt.0");
      url.searchParams.set("order", "updated_at.desc");
      url.searchParams.set("limit", "40");
      const res = await fetch(url.toString(), {
        headers: {
          apikey: watch.key,
          Authorization: "Bearer " + watch.token,
          Accept: "application/json"
        }
      });
      if (res.ok) {
        const data = await res.json();
        policies = Array.isArray(data) ? data : [];
      }
    } catch (_err) { policies = []; }
    const fresh = leadItems.concat(policySales(policies, range.day, stampedNames)).filter((item) => !closedAlreadySeen(seen, item.id));
    if (fresh.length) {
      const awake = await pageIsAwake();
      if (awake) {
        const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        open.forEach((client) => client.postMessage({ type: "sale-ring" }));
      }
      fresh.slice(0, 6).forEach((item) => {
        const closed = String(item.id).indexOf("closed:") === 0;
        void showOnce(item.title || (closed ? "ליד נסגר" : "מכירה חדשה"), {
          body: item.body,
          lang: "he",
          tag: (closed ? "onyx-closed-" : "onyx-sale-") + item.id,
          icon: "./icon-192.png",
          vibrate: [180, 80, 180, 80, 320],
          data: { kind: closed ? "closed" : "sale", id: item.id }
        });
      });
      fresh.forEach((item) => seen.add(item.id));
      watch.seen = Array.from(seen).slice(-200);
      void rememberAlertIds(fresh.slice(0, 6).map((item) => item.id));
    }
  } catch (_err) {}
  scheduleSaleCheck(20000);
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "watch-stop") {
    clearTimeout(saleTimer);
    saleWatch = null;
    return;
  }
  if (data.type === "watch") {
    const seen = new Set([...(Array.isArray(data.seen) ? data.seen : []), ...(saleWatch && saleWatch.seen ? saleWatch.seen : [])]);
    saleWatch = {
      url: String(data.url || ""),
      key: String(data.key || ""),
      token: String(data.token || ""),
      until: Number(data.until) || (Date.now() + 6 * 60 * 60 * 1000),
      seen: Array.from(seen).slice(-200)
    };
    if (!saleWatch.url || !saleWatch.key || !saleWatch.token) {
      saleWatch = null;
      return;
    }
    scheduleSaleCheck(2000);
    return;
  }
  if (data.type !== "arm") return;
  armed.forEach((handle) => clearTimeout(handle));
  armed = [];
  (Array.isArray(data.reminders) ? data.reminders : []).forEach((item) => {
    const delay = Number(item.at) - Date.now();
    if (!Number.isFinite(delay) || delay < 0 || delay > 6 * 60 * 60 * 1000) return;
    armed.push(setTimeout(() => {
      pageIsAwake().then((awake) => {
        if (awake) {
          return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((open) => {
            open.forEach((client) => client.postMessage({ type: "due" }));
          });
        }
        return showOnce(item.title || "תזכורת", {
          body: item.body || "",
          lang: "he",
          tag: "onyx-rem-" + item.id,
          icon: "./icon-192.png",
          vibrate: [180, 80, 180, 80, 320],
          data: { kind: "reminder", id: item.id }
        });
      }).catch(() => {});
    }, delay));
  });
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_err) { data = {}; }
  const note = data.notification && typeof data.notification === "object" ? data.notification : {};
  const title = note.title || data.title || "ONYX";
  const body = note.body || data.body || "";
  const tag = note.tag || data.tag || "onyx-push";
  const leadFromTag = String(tag).indexOf("onyx-lead-") === 0 ? String(tag).slice("onyx-lead-".length) : "";
  const alertId = data.id || idFromTag(tag);
  const isAlert = !leadFromTag && (data.kind === "sale" || data.kind === "closed" || /מכירה|ליד נסגר/.test(title) || String(alertId).indexOf("closed:") === 0 || String(alertId).indexOf("sale:") === 0);
  const closed = String(alertId).indexOf("closed:") === 0 || /ליד נסגר/.test(title);
  const ios = /iPhone|iPad|iPod/i.test(self.navigator.userAgent || "");
  const os = /OS (\d+)[_.](\d+)/.exec(self.navigator.userAgent || "");
  const iosModern = ios && (!os || Number(os[1]) > 18 || (Number(os[1]) === 18 && Number(os[2]) >= 4));
  const appleShade = data.web_push === 8030 && note.title && note.navigate && iosModern;
  const showing = appleShade ? Promise.resolve() : self.registration.showNotification(title, {
    body: body,
    lang: note.lang || "he",
    dir: note.dir || "rtl",
    tag: tag,
    icon: note.icon || new URL("./icon-192.png", self.registration.scope).href,
    data: {
      kind: isAlert ? (closed ? "closed" : "sale") : (leadFromTag ? "lead" : (data.kind || "")),
      id: leadFromTag || alertId || data.id || "",
      url: note.navigate || ""
    }
  });
  event.waitUntil((async () => {
    try { await showing; } catch (_err) {}
    if (isAlert && alertId) await rememberAlertIds([alertId]);
    const awake = await pageIsAwake();
    if (!awake) return;
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const message = leadFromTag
      ? { type: "lead-push", id: leadFromTag }
      : (isAlert ? { type: "sale-ring" } : { type: "due" });
    open.forEach((client) => client.postMessage(message));
  })());
});

self.addEventListener("notificationclose", (event) => {
  const note = event.notification;
  if (note && note.tag) shownTags.delete(note.tag);
  const data = note && note.data || {};
  const alertId = data.id || idFromTag(note && note.tag);
  if (alertId) event.waitUntil(rememberAlertIds([alertId]));
});

self.addEventListener("notificationclick", (event) => {
  if (event.notification && event.notification.tag) shownTags.delete(event.notification.tag);
  event.notification.close();
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = open.find((item) => item.url.includes("/phone/"));
    const data = event.notification.data || {};
    const title = event.notification.title || "";
    const tag = event.notification.tag || "";
    const leadFromTag = tag.indexOf("onyx-lead-") === 0 ? tag.slice("onyx-lead-".length) : "";
    const leadId = data.kind === "lead" ? String(data.id || leadFromTag) : leadFromTag;
    if (leadId || /שויך לך ליד/.test(title)) {
      if (client) {
        await client.focus();
        client.postMessage({ type: "lead-open", id: leadId });
        return;
      }
      await self.clients.openWindow(leadId ? "./index.html?lead=" + encodeURIComponent(leadId) : "./index.html");
      return;
    }
    const opensAlerts = data.kind === "sale" || data.kind === "closed" || /מכירה|ליד נסגר/.test(title);
    const message = opensAlerts
      ? { type: "sale-open", ids: data.id ? [data.id] : [] }
      : { type: "due" };
    if (client) {
      await client.focus();
      client.postMessage(message);
      return;
    }
    await self.clients.openWindow("./index.html");
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.includes("/phone/")) return;
  event.respondWith((async () => {
    try {
      const fresh = await fetch(request, { cache: "no-cache" });
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
      }
      return fresh;
    } catch (_err) {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw _err;
    }
  })());
});
