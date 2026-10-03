/* First-party short share host. Bots get the personal sign card; people
   follow the card server's 302 onto the sign page. */
const TOKEN_RE = /^\/([A-Za-z0-9]{6,16})(\.png)?\/?$/;

function rewriteCardHtml(html, pageUrl, pngUrl){
  return String(html || "").replace(
    /https:\/\/[^"'<\s]+\/functions\/v1\/gi-sign\/card\/[A-Za-z0-9]+(?:\.png)?/g,
    (hit) => (/\.png$/i.test(hit) ? pngUrl : pageUrl)
  );
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
    const asPng = !!match[2] || url.searchParams.get("img") === "1";
    const cardBase = String((env && env.CARD_BASE) || "").replace(/\/+$/, "");
    const dest = cardBase + "/" + encodeURIComponent(token) + (asPng ? ".png" : "");
    const headers = new Headers();
    const ua = request.headers.get("user-agent");
    if(ua) headers.set("user-agent", ua);
    const accept = request.headers.get("accept");
    if(accept) headers.set("accept", accept);
    const method = request.method === "HEAD" ? "HEAD" : "GET";
    const res = await fetch(dest, { method, headers, redirect: "manual" });
    const out = new Headers(res.headers);
    out.set("access-control-allow-origin", "*");
    const type = String(res.headers.get("content-type") || "");
    if(!asPng && type.indexOf("text/html") >= 0){
      const pageUrl = url.origin + "/" + token;
      const pngUrl = pageUrl + ".png";
      const html = rewriteCardHtml(await res.text(), pageUrl, pngUrl);
      out.set("content-type", "text/html; charset=utf-8");
      return new Response(html, { status: res.status, headers: out });
    }
    return new Response(res.body, { status: res.status, headers: out });
  }
};
