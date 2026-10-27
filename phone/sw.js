/* ONYX phone shell only. Does not cache Supabase or the desktop CRM. */
const CACHE = "onyx-phone-shell-v14";
const SHELL = ["./index.html", "./phone.css", "./phone.js", "./manifest.webmanifest"];

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
  return bits.join(" · ") || "אין פרמיה רשומה";
}

function salesFromRows(rows, day) {
  const items = [];
  (rows || []).forEach((row) => {
    const meta = leadMeta(row.description);
    const agent = String(row.assigned_agent_name || "").trim() || "נציג";
    const monthly = Number(meta.proposalPremiumMonthly) || 0;
    const annual = Number(meta.proposalPremiumAnnual) || 0;
    if (stampDay(meta.proposalPremiumAt, day) === day && (monthly > 0 || annual > 0)) {
      items.push({
        id: "sale:" + row.id + ":" + String(meta.proposalPremiumAt || "").trim(),
        agent: agent,
        body: saleBody(monthly, annual)
      });
    }
    if (String(row.status || "").trim() === "closed" && stampDay(meta.closedAt || row.updated_at, day) === day) {
      items.push({
        id: "closed:" + row.id + ":" + String(meta.closedAt || row.updated_at || "").trim(),
        agent: agent,
        body: saleBody(monthly, annual)
      });
    }
  });
  return items;
}

function scheduleSaleCheck(delay) {
  clearTimeout(saleTimer);
  if (!saleWatch || Date.now() > saleWatch.until) return;
  saleTimer = setTimeout(() => { void checkSales(); }, delay);
}

async function checkSales() {
  const watch = saleWatch;
  if (!watch || Date.now() > watch.until) return;
  try {
    const range = israelNow();
    const url = new URL(watch.url + "/rest/v1/campaign_leads");
    url.searchParams.set("select", "id,customer_name,assigned_agent_name,status,description,updated_at");
    url.searchParams.append("updated_at", "gte." + range.start);
    url.searchParams.append("updated_at", "lt." + range.end);
    url.searchParams.set("or", "(status.eq.closed,description.ilike.*proposalPremiumAt*)");
    url.searchParams.set("order", "updated_at.desc");
    url.searchParams.set("limit", "80");
    const res = await fetch(url.toString(), {
      headers: {
        apikey: watch.key,
        Authorization: "Bearer " + watch.token,
        Accept: "application/json"
      }
    });
    if (res.ok) {
      const rows = await res.json();
      const seen = new Set(watch.seen);
      const fresh = salesFromRows(Array.isArray(rows) ? rows : [], range.day).filter((item) => !seen.has(item.id));
      if (fresh.length) {
        fresh.forEach((item) => seen.add(item.id));
        watch.seen = Array.from(seen).slice(-200);
        const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const visible = open.some((client) => client.visibilityState === "visible");
        if (!visible) {
          fresh.slice(0, 6).forEach((item) => {
            self.registration.showNotification(item.agent || "מכירה חדשה", {
              body: item.body,
              lang: "he",
              tag: "onyx-sale-" + item.id,
              renotify: true,
              icon: "./icon-192.png",
              badge: "./icon-192.png",
              vibrate: [180, 80, 180, 80, 320],
              data: { kind: "sale", id: item.id }
            });
          });
          open.forEach((client) => client.postMessage({ type: "sale-seen", ids: fresh.map((item) => item.id) }));
        }
      }
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
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((open) => {
        const visible = open.some((client) => client.visibilityState === "visible");
        if (visible) {
          open.forEach((client) => client.postMessage({ type: "due" }));
          return;
        }
        self.registration.showNotification(item.title || "תזכורת", {
          body: item.body || "",
          lang: "he",
          tag: "onyx-rem-" + item.id,
          renotify: true,
          vibrate: [180, 80, 180, 80, 320],
          data: { id: item.id }
        });
      }).catch(() => {});
    }, delay));
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = open.find((item) => item.url.includes("/phone/"));
    const data = event.notification.data || {};
    const message = data.kind === "sale"
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
      const fresh = await fetch(request);
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
