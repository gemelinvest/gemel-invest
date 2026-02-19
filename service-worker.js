/* GEMEL INVEST PWA Service Worker
   Goals:
   - Always pick up new UI (CSS/JS) fast on GitHub Pages
   - Keep offline support for core assets
   Notes:
   - We keep a versioned cache name so ANY update to this file forces a clean refresh.
*/
const CACHE_NAME = "gemel-invest-cache-20260219150353";

const CORE_ASSETS = [
  "./",
  "./index.html",
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

// Normalize same-origin requests: ignore cache-busting query params (e.g. ?v=... / ?build=...)
function normalizedRequest(req) {
  const url = new URL(req.url);
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
    cache: "reload" // prefer fresh when possible
  });
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Use {cache:'reload'} to avoid getting a stale HTTP-cached response.
    await cache.addAll(CORE_ASSETS.map((u) => new Request(u, { cache: "reload" })));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const norm = normalizedRequest(req);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(norm, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(norm);
    return cached || new Response("Offline", { status: 503 });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const norm = normalizedRequest(req);
  const cached = await cache.match(norm);
  const fetchPromise = fetch(req).then((res) => {
    if (res && res.ok) cache.put(norm, res.clone());
    return res;
  }).catch(() => null);

  return cached || (await fetchPromise) || fetch(req);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Navigations: always try network first so HTML updates immediately
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }

  // Same-origin assets
  if (url.origin === self.location.origin) {
    const path = url.pathname.toLowerCase();

    // CSS/JS: network-first so design changes appear immediately
    if (path.endsWith(".css") || path.endsWith(".js")) {
      event.respondWith(networkFirst(req));
      return;
    }

    // Everything else: fast + update in background
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
});
