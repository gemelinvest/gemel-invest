/* GEMEL INVEST CRM — Service Worker
   GI-PERF 2026-07-31 (שלב א'.7)

   קודם: SW ריק ללא fetch handler. כל טעינה הורידה מחדש מהרשת את app.js (4MB),
   app.css (1.4MB) והתמונות. עכשיו הנכסים הסטטיים מוגשים מהדיסק.

   כללי ברזל:
   1. אך ורק same-origin GET. קריאות ל-Supabase הן cross-origin ולעולם לא נוגעים
      בהן — נתוני לקוחות חייבים להגיע טריים מהשרת, תמיד.
   2. ניווט (HTML) הוא network-first. אחרת משתמש נתקע על index.html ישן ולא
      מקבל גרסאות חדשות לעולם.
   3. נכסים עם ‎?v=‎ הם cache-first — כתובת ה-URL משתנה בכל דיפלוי, אז אין סכנת
      התיישנות.
   4. כל השאר: stale-while-revalidate — מגיש מיד מהמטמון, מרענן ברקע.

   לאיפוס ידני: כפתור "החל עדכון" במערכת כבר מוחק את כל המטמונים ומבטל רישום SW.
*/

const CACHE_VERSION = "gi-v8-20260810-large-session-v8";
const RUNTIME_CACHE = `gi-runtime-${CACHE_VERSION}`;

// סיומות שמותר להגיש מהמטמון.
// GI-LEADNOTIFY 2026-08-02: נוספו סיומות אודיו. קודם קבצי ההתראה
// (lead-chime / lead-new-announcement / chat-message-chime) ירדו מחדש מהרשת
// בכל טעינת עמוד, ואם הרשת הייתה איטית ברגע שהליד נכנס — הצלצול התעכב או נכשל.
const STATIC_EXT = /\.(?:css|js|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot|pdf|mp3|m4a|aac|wav|ogg|oga|weba)$/i;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // מוחק מטמונים של גרסאות קודמות.
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("gi-runtime-") && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
      );
    } catch (_e) {}
    await self.clients.claim();
  })());
});

/** האם מותר לשמור את התגובה במטמון. */
function isCacheableResponse(res) {
  // opaque (type "opaque") = cross-origin ללא CORS — לא ניתן לאמת, לא שומרים.
  return !!res && res.status === 200 && res.type === "basic";
}

/** ניווט: קודם רשת, ואם אין — מטמון. שומר על עדכניות ומאפשר עבודה במצב לא מקוון. */
async function handleNavigate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    let fresh;
    try {
      // cache:"reload" מכריח פנייה לשרת ומדלג על מטמון ה-HTTP של הדפדפן.
      fresh = await fetch(new Request(request.url, {
        cache: "reload",
        credentials: "same-origin",
        redirect: "follow"
      }));
    } catch (_reloadErr) {
      fresh = await fetch(request);
    }
    if (isCacheableResponse(fresh)) {
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (_e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await cache.match("./index.html");
    if (shell) return shell;
    throw _e;
  }
}

/** נכס מגורסן (‎?v=‎): המטמון תמיד תקף, כי URL חדש = דיפלוי חדש. */
async function handleVersioned(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (isCacheableResponse(fresh)) {
    cache.put(request, fresh.clone()).catch(() => {});
  }
  return fresh;
}

/** נכס רגיל: מגיש מיד מהמטמון ומרענן ברקע. */
async function handleStale(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((res) => {
      if (isCacheableResponse(res)) {
        cache.put(request, res.clone()).catch(() => {});
      }
      return res;
    })
    .catch(() => null);

  if (cached) return cached;

  const fresh = await network;
  if (fresh) return fresh;
  throw new Error("offline and not cached: " + request.url);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch (_e) {
    return;
  }

  // רק same-origin. חוסם Supabase, CDN ופונטים של גוגל.
  if (url.origin !== self.location.origin) return;

  // http/https בלבד — מסנן chrome-extension וכדומה.
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // ה-SW עצמו לעולם לא מהמטמון.
  if (url.pathname.endsWith("/service-worker.js")) return;

  // בקשת ניווט — מסמך HTML.
  if (request.mode === "navigate") {
    event.respondWith(handleNavigate(request));
    return;
  }

  // עקיפת מטמון מכוונת (כפתור "החל עדכון" מוסיף ‎?nocache=‎).
  if (url.searchParams.has("nocache")) return;

  if (!STATIC_EXT.test(url.pathname)) return;

  if (url.searchParams.has("v")) {
    event.respondWith(handleVersioned(request));
    return;
  }

  event.respondWith(handleStale(request));
});
