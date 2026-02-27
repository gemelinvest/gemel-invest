/* BUILD_VERSION: v2-blue-right-20260227041622 */
const CACHE_NAME = 'gemel-invest-v2-blue-right-20260227041622';
const CORE = [
  './',
  './index.html?v=v2-blue-right-20260227041622',
  './app.css?v=v2-blue-right-20260227041622',
  './app.js?v=v2-blue-right-20260227041622',
  './logo-login-clean.png',
  './icon-192x192.png',
  './icon-512x512-maskable.png',
  './aig.png','./ayalon.png','./beytuyashir.png','./clal.png','./harel.png','./megdl.png','./menora.png',
  './afenix.png','./achshara.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE.map(u => new Request(u, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : null));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if(req.method !== 'GET' || url.origin !== location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    if(req.headers.get('accept')?.includes('text/html')) {
      try {
        const fresh = await fetch(req);
        cache.put(req, fresh.clone());
        return fresh;
      } catch(e) {
        return (await cache.match(req)) || (await cache.match('./'));
      }
    }

    const cached = await cache.match(req);
    if(cached) return cached;

    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  })());
});
