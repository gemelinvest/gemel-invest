/* First-party short share host. Bots get the personal sign card; people
   follow the card server's 302 onto the sign page.
   A disclosure token (1 and eight letters) is answered here. The signature
   server that is live does not know those tokens and would show an English
   JSON error on the phone.
   The image URL ends in .jpg when the bytes are JPEG. WhatsApp drops the
   picture and shows the English domain when the ending and the file disagree.
   The picture is cached here so the preview does not wait on a second cold fetch. */
import { DISCLOSURE_JPEG_B64, DISCLOSURE_PAGE } from "./disclosure-card.js";

const TOKEN_RE = /^\/([A-Za-z0-9]{6,16})(\.(?:png|jpe?g))?\/?$/i;
const DISCLOSURE_TOKEN_RE = /^1[a-z0-9]{8}$/;
const BOT_RE = /facebookexternalhit|Facebot|WhatsApp|Twitterbot|Slackbot|TelegramBot|Discordbot|LinkedInBot|Googlebot/i;

let disclosureJpegBytes = null;
function disclosureJpeg(){
  if(disclosureJpegBytes) return disclosureJpegBytes;
  const bin = atob(DISCLOSURE_JPEG_B64);
  const out = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  disclosureJpegBytes = out;
  return out;
}

function isDisclosureToken(token){
  return DISCLOSURE_TOKEN_RE.test(token);
}

function disclosureHeaders(init){
  const headers = new Headers(init || {});
  headers.set("access-control-allow-origin", "*");
  headers.set("x-content-type-options", "nosniff");
  return headers;
}

function disclosureCardHtml(pageUrl, imageUrl){
  const title = "גילוי נאות";
  return `<!DOCTYPE html><html lang="he" dir="rtl"><head>
<meta charset="utf-8"/>
<title>${title}</title>
<meta property="og:title" content="${title}"/>
<meta property="og:type" content="website"/>
<meta property="og:locale" content="he_IL"/>
<meta property="og:url" content="${pageUrl}"/>
<meta property="og:image" content="${imageUrl}"/>
<meta property="og:image:secure_url" content="${imageUrl}"/>
<meta property="og:image:type" content="image/jpeg"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="${title}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${title}"/>
<meta name="twitter:image" content="${imageUrl}"/>
<link rel="image_src" href="${imageUrl}"/>
</head><body></body></html>`;
}

function serveDisclosure(request, url, token, asImage){
  const method = request.method === "HEAD" ? "HEAD" : "GET";
  const bytes = disclosureJpeg();
  if(asImage){
    const headers = disclosureHeaders({
      "content-type": "image/jpeg",
      "content-length": String(bytes.byteLength),
      "cache-control": "public, max-age=604800, immutable"
    });
    if(method === "HEAD") return new Response(null, { status: 200, headers });
    return new Response(bytes, { status: 200, headers });
  }
  const ua = request.headers.get("user-agent") || "";
  if(!BOT_RE.test(ua)){
    return new Response(null, {
      status: 302,
      headers: disclosureHeaders({
        location: DISCLOSURE_PAGE + encodeURIComponent(token),
        vary: "User-Agent",
        "cache-control": "no-store"
      })
    });
  }
  const pageUrl = url.origin + "/" + token;
  const imageUrl = pageUrl + ".jpg";
  const html = disclosureCardHtml(pageUrl, imageUrl);
  const headers = disclosureHeaders({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=86400",
    vary: "User-Agent"
  });
  if(method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(html, { status: 200, headers });
}

function rewriteCardHtml(html, pageUrl){
  const image = pageUrl + ".jpg";
  return String(html || "").replace(
    /https?:\/\/[^"'<\s]+\/functions\/v1\/gi-sign\/(?:card|og)\/[A-Za-z0-9]+(\.(?:png|jpe?g))?/gi,
    image
  ).replace(
    /(property="og:image(?::secure_url)?"\s+content=")[^"]*/gi,
    "$1" + image
  ).replace(
    /(name="twitter:image"\s+content=")[^"]*/gi,
    "$1" + image
  ).replace(
    /(rel="image_src"\s+href=")[^"]*/gi,
    "$1" + image
  );
}

function looksLikeCardHtml(type, body){
  const kind = String(type || "").toLowerCase();
  if(kind.indexOf("json") >= 0) return false;
  if(kind.indexOf("text/html") >= 0) return true;
  const text = String(body || "");
  return (kind.indexOf("text/plain") >= 0 || !kind) && (text.indexOf("<!DOCTYPE html") >= 0 || text.indexOf("og:title") >= 0);
}

function cardBaseOf(env){
  return String((env && env.CARD_BASE) || "").replace(/\/+$/, "");
}

function forwardHeaders(request){
  const headers = new Headers();
  const ua = request.headers.get("user-agent");
  if(ua) headers.set("user-agent", ua);
  const accept = request.headers.get("accept");
  if(accept) headers.set("accept", accept);
  return headers;
}

function publicHeaders(src){
  const out = new Headers();
  const type = src.get("content-type");
  if(type) out.set("content-type", type);
  const cache = src.get("cache-control");
  if(cache) out.set("cache-control", cache);
  const vary = src.get("vary");
  if(vary) out.set("vary", vary);
  const len = src.get("content-length");
  if(len) out.set("content-length", len);
  out.set("access-control-allow-origin", "*");
  out.set("x-content-type-options", "nosniff");
  return out;
}

async function cacheImage(cacheKey, res){
  if(!res || res.status !== 200) return null;
  const type = String(res.headers.get("content-type") || "").toLowerCase();
  if(type.indexOf("image/jpeg") < 0) return null;
  const bytes = await res.arrayBuffer();
  if(!bytes || bytes.byteLength < 3) return null;
  const view = new Uint8Array(bytes);
  if(view[0] !== 0xff || view[1] !== 0xd8 || view[2] !== 0xff) return null;
  const cached = new Response(bytes, {
    status: 200,
    headers: {
      "content-type": "image/jpeg",
      "content-length": String(bytes.byteLength),
      "cache-control": "public, max-age=604800, immutable",
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff"
    }
  });
  const cache = caches.default;
  await cache.put(cacheKey, cached.clone());
  return cached;
}

function imageMiss(){
  return new Response(null, {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff"
    }
  });
}

async function loadJpeg(request, env, token){
  const imageUrl = new URL(request.url).origin + "/" + token + ".jpg";
  const cacheKey = new Request(imageUrl, { method: "GET" });
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if(hit) return hit;
  const dest = cardBaseOf(env) + "/" + encodeURIComponent(token) + ".jpg";
  const res = await fetch(dest, { method: "GET", headers: forwardHeaders(request), redirect: "manual" });
  return cacheImage(cacheKey, res);
}

async function warmJpeg(request, env, token){
  await loadJpeg(request, env, token);
}

export default {
  async fetch(request, env){
    const url = new URL(request.url);
    const match = url.pathname.match(TOKEN_RE);
    if(!match){
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }
    const token = match[1];
    const ext = match[2] ? String(match[2]).toLowerCase() : "";
    const asImage = !!ext || url.searchParams.get("img") === "1";
    if(isDisclosureToken(token)) return serveDisclosure(request, url, token, asImage);
    const cardBase = cardBaseOf(env);
    const dest = cardBase + "/" + encodeURIComponent(token) + ext;
    const method = request.method === "HEAD" ? "HEAD" : "GET";
    if(asImage){
      const jpeg = await loadJpeg(request, env, token);
      if(!jpeg) return imageMiss();
      if(method === "HEAD") return new Response(null, { status: 200, headers: publicHeaders(jpeg.headers) });
      return jpeg;
    }
    const ua = request.headers.get("user-agent") || "";
    const warm = !asImage && BOT_RE.test(ua) ? warmJpeg(request, env, token) : null;
    const res = await fetch(dest, { method, headers: forwardHeaders(request), redirect: "manual" });
    if(warm) await warm.catch(() => {});
    const headers = publicHeaders(res.headers);
    if(res.status >= 300 && res.status < 400){
      const loc = res.headers.get("location");
      if(loc) headers.set("location", loc);
      return new Response(null, { status: res.status, headers });
    }
    const type = String(res.headers.get("content-type") || "");
    const body = await res.text();
    if(looksLikeCardHtml(type, body)){
      const pageUrl = url.origin + "/" + token;
      const html = rewriteCardHtml(body, pageUrl);
      headers.set("content-type", "text/html; charset=utf-8");
      headers.delete("content-length");
      return new Response(html, { status: res.status, headers });
    }
    return new Response(body, { status: res.status, headers });
  }
};
