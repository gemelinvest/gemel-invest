/* GEMEL INVEST PWA Service Worker
   - Network-first for navigations (keeps app up to date)
   - Stale-while-revalidate for static assets (fast + updates in background)
   - Normalizes cache keys to ignore ?build=... query params used for cache busting
*/
const CACHE_NAME = "gemel-invest-cache-v1";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/logo-login-clean.svg",
  "./assets/companies/achshara.png",
  "./assets/companies/afenix.png",
  "./assets/companies/aig.png",
  "./assets/companies/ayalon.png",
  "./assets/companies/beytuyashir.png",
  "./assets/companies/clal.png",
  "./assets/companies/harel.png",
  "./assets/companies/megdl.png",
  "./assets/companies/menora.png",
  "./assets/icons/icon-192x192.png",
  "./assets/icons/icon-512x512.png",
  "./assets/icons/icon-512x512-maskable.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

function normalizedRequest(req) {
  const url = new URL(req.url);
  // Only normalize same-origin requests
  if (url.origin !== self.location.origin) return req;
  return new Request(url.origin + url.pathname, {
    method: "GET",
    headers: req.headers,
    credentials: req.credentials,
    redirect: "follow",
    mode: req.mode,
    referrer: req.referrer,
    referrerPolicy: req.referrerPolicy,
    integrity: req.integrity,
    cache: "default"
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Navigations: network-first (fresh HTML)
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put("./index.html", fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match("./index.html");
        return cached || caches.match("./") || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // Static assets: stale-while-revalidate (fast)
  if (url.origin === self.location.origin) {
    const norm = normalizedRequest(req);
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(norm);
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.ok) cache.put(norm, res.clone());
        return res;
      }).catch(() => null);

      return cached || (await fetchPromise) || fetch(req);
    })());
  }
});
