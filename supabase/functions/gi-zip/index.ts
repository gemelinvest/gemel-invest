// GI-ZIP — Israeli postal code for a street address.
// The browser cannot call Israel Post directly (no CORS). This function
// resolves a locality and a street by an unambiguous name, then asks for
// the house code. An ambiguous name returns no code.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BASE = "https://apimftprd.israelpost.co.il/mypost-zip";

type Row = { id?: string; n?: string; syn?: string };

function json(data: Record<string, unknown>, status = 200){
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function trim(v: unknown){
  return String(v == null ? "" : v).trim();
}

function norm(v: unknown){
  return trim(v).replace(/[\s\-־'"״׳.()]/g, "");
}

function namesOf(row: Row){
  return [norm(row?.n), norm(row?.syn)].filter(Boolean);
}

function pickExact(rows: Row[], query: string){
  const want = norm(query);
  if(!want) return null;
  const exact = rows.filter((row) => namesOf(row).some((name) => name === want));
  if(exact.length === 1) return exact[0];
  if(exact.length > 1) return null;
  const prefix = rows.filter((row) => namesOf(row).some((name) => name.startsWith(want) || want.startsWith(name)));
  if(prefix.length === 1) return prefix[0];
  return null;
}

async function ilGet(path: string, params: Record<string, string>){
  const key = trim(Deno.env.get("IL_POST_KEY")) || "5ccb5b137e7444d885be752eda7f767a";
  const url = new URL(BASE + "/" + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Ocp-Apim-Subscription-Key": key,
    },
  });
  if(!res.ok) return null;
  const body = await res.json().catch(() => null);
  if(!body || body.ReturnCode !== 0) return null;
  return body.Result;
}

Deno.serve(async (req: Request) => {
  if(req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if(req.method !== "GET") return json({ ok: false, zip: "" }, 405);

  const q = new URL(req.url).searchParams;
  const city = trim(q.get("city"));
  const street = trim(q.get("street"));
  const house = trim(q.get("house")).replace(/[^0-9]/g, "");
  if(!city || !street || !house) return json({ ok: true, zip: "" });

  try{
    const cities = await ilGet("getcities-lang", { CityStartsWith: city, Lang: "he" });
    const cityRow = pickExact(Array.isArray(cities) ? cities : [], city);
    if(!cityRow?.id) return json({ ok: true, zip: "" });

    const streets = await ilGet("GetStreets-lang", {
      CityID: String(cityRow.id),
      SearchMode: "ID-StartsWith",
      StartsWith: street,
      Lang: "he",
    });
    const streetRow = pickExact(Array.isArray(streets) ? streets : [], street);
    if(!streetRow?.id) return json({ ok: true, zip: "" });

    const found = await ilGet("SearchZip-Lang", {
      CityID: String(cityRow.id),
      StreetID: String(streetRow.id),
      House: house,
      Entry: "",
      Lang: "he",
      ByMaanimID: "true",
    });
    const zip = trim(found?.zip).replace(/[^0-9]/g, "");
    if(zip.length < 5 || zip.length > 7) return json({ ok: true, zip: "" });
    return json({ ok: true, zip });
  }catch(_e){
    return json({ ok: false, zip: "" });
  }
});
