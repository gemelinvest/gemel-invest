/* ONYX phone shell only. Does not cache Supabase or the desktop CRM. */
const CACHE = "onyx-phone-shell-v12";
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

self.addEventListener("message", (event) => {
  const data = event.data || {};
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
    if (client) {
      await client.focus();
      client.postMessage({ type: "due" });
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
