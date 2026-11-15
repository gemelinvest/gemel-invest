// Read gviyaas@i-s-f.co.il and open collection cases.
// The browser never receives a password, a refresh token, or a letter body.
// Only inbox messages received in the last 7 days are read.
// The sales mailbox token for orias@ is not used and not loaded.
//
// verify_jwt stays false: the callback page has no session. Connect and
// pull still require a manager or operations PIN. Deploy is
// .github/workflows/deploy-collection-mail.yml on push to main.

import { createClient } from "jsr:@supabase/supabase-js@2.49.1";
import "../../../gi-collection.js";
import { pdfTextItems } from "./pdf-items.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAILBOX = "gviyaas@i-s-f.co.il";
const REDIRECT = "https://gemelinvest.github.io/gemel-invest/collection-mail.html";
const READ_SCOPE = "offline_access User.Read Mail.Read";
const SECRET_MAIL = "collection_mail";
const SECRET_STATE = "collection_mail_state";
const SECRET_HOLDS = "collection_mail_holds";
const FILES_BUCKET = "gi-customer-files";
const MAX_MESSAGES = 12;
const MAX_PAGES = 4;
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const PULL_LOCK_MS = 90 * 1000;

type Json = Record<string, unknown>;

type CollectionApi = {
  MAILBOX: string;
  weekStart: (now?: Date | number | string) => string;
  withinWeek: (received: unknown, now?: Date | number | string) => boolean;
  applyIncoming: (message: Json, customers: Json[]) => {
    company: string;
    kind: string;
    assignments: { customerId: string; entry: Json }[];
    holds: Json[];
    reportFileOmitted: boolean;
  };
  openCount: (cases: Json[]) => number;
};

function json(data: Json, status = 200){
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function trim(value: unknown){
  return String(value == null ? "" : value).trim();
}

function asObject(value: unknown): Json{
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function sameText(left: string, right: string){
  const a = trim(left);
  const b = trim(right);
  if(!a || a.length !== b.length) return false;
  let out = 0;
  for(let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function collectionApi(): CollectionApi{
  const api = (globalThis as Json).GICollection as CollectionApi;
  if(!api || typeof api.applyIncoming !== "function" || api.MAILBOX !== MAILBOX || typeof api.weekStart !== "function"){
    throw new Error("MISSING_PARSER");
  }
  return api;
}

function sbAdmin(){
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  // The browser call arrives with the public key. Force the server key on
  // every database call so the secret table is not read as the public role.
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: "Bearer " + key, apikey: key },
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        headers.set("Authorization", "Bearer " + key);
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

function safeFailureText(err: unknown){
  return trim((err as Error)?.message || err)
    .replace(/eyJ[A-Za-z0-9._\-]+/g, "[redacted]")
    .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, "[email]")
    .slice(0, 180);
}

function graphErrorCode(text: string){
  const upper = trim(text);
  if(["REDIRECT_NOT_REGISTERED", "MAIL_READ_DENIED", "MAILBOX_NOT_CONNECTED", "MAILBOX_NOT_READY", "MISSING_PARSER", "CUSTOMERS_UNAVAILABLE", "PULL_BUSY", "SECRET_DENIED", "SECRET_KEY_MISSING", "SECRET_KEY_REJECTED", "APP_CONFIG_DENIED", "APP_CONFIG_MISSING"].includes(upper)) return upper;
  const value = upper.toLowerCase();
  if(value.includes("redirect_uri") || value.includes("aadsts50011")) return "REDIRECT_NOT_REGISTERED";
  if(value.includes("650053") || value.includes("aadsts65001") || value.includes("consent")) return "MAIL_READ_DENIED";
  if(value.includes("invalid_grant") || value.includes("mailbox_not_connected")) return "MAILBOX_NOT_CONNECTED";
  if(value.includes("permission denied")) return "SECRET_DENIED";
  if(value.includes("invalid api key") || value.includes("jwt")) return "SECRET_KEY_REJECTED";
  return "MAILBOX_NOT_READY";
}

function allowedRole(role: unknown){
  const raw = trim(role);
  const code = raw.toLowerCase().replace(/[\s_-]+/g, "");
  return code === "admin" || code === "owner" || code === "manager" || code === "adminlite" || code === "ops" || raw === "מנהל";
}

async function sha256hex(value: string){
  const sig = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes = 32){
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function htmlToText(value: string){
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_m, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : " ";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function pathPart(value: string){
  return trim(value).replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "file";
}

function publicHold(row: Json){
  return {
    id: trim(row.id),
    reason: trim(row.reason),
    company: trim(row.company),
    subject: trim(row.subject).slice(0, 180),
    from: trim(row.from).slice(0, 120),
    receivedAt: trim(row.receivedAt),
    name: trim(row.name),
    idNumber: trim(row.idNumber),
    idLast4: trim(row.idLast4)
  };
}

function publicPull(data: Json){
  const holds = Array.isArray(data.holds) ? data.holds.map((row) => publicHold(asObject(row))).filter((row) => row.id || row.reason) : [];
  const customerIds = Array.isArray(data.customerIds) ? data.customerIds.map((id) => trim(id)).filter(Boolean).slice(0, 40) : [];
  return {
    ok: data.ok === true,
    scanned: Number(data.scanned) || 0,
    opened: Number(data.opened) || 0,
    held: Number(data.held) || 0,
    skipped: Number(data.skipped) || 0,
    more: data.more === true,
    windowStart: trim(data.windowStart),
    customerIds,
    openCounts: asObject(data.openCounts),
    holds: holds.slice(0, 12)
  };
}

function serviceKey(){
  const key = trim(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if(!key) throw new Error("SECRET_KEY_MISSING");
  return key;
}

function restBase(){
  return trim(Deno.env.get("SUPABASE_URL")).replace(/\/$/, "");
}

async function serviceRest(path: string, init: { method?: string; body?: string; prefer?: string }){
  const key = serviceKey();
  const base = restBase();
  if(!base) throw new Error("SECRET_KEY_MISSING");
  const headers = new Headers();
  headers.set("Authorization", "Bearer " + key);
  headers.set("apikey", key);
  headers.set("Content-Type", "application/json");
  if(init.prefer) headers.set("Prefer", init.prefer);
  const res = await fetch(base + path, {
    method: init.method || "GET",
    headers,
    body: init.body
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch(_e) { data = null; }
  if(!res.ok){
    const message = trim(asObject(data).message || asObject(data).error).toLowerCase();
    const azure = path.includes("gi_daily_sales_mail_account");
    if(message.includes("permission denied")) throw new Error(azure ? "APP_CONFIG_DENIED" : "SECRET_DENIED");
    if(res.status === 401 || message.includes("invalid api key") || message.includes("jwt")) throw new Error("SECRET_KEY_REJECTED");
    throw new Error(azure ? "APP_CONFIG_DENIED" : "SECRET_DENIED");
  }
  return data;
}

async function readSecret(_sb: ReturnType<typeof sbAdmin>, key: string){
  const data = await serviceRest("/rest/v1/gi_app_secrets?select=value&key=eq." + encodeURIComponent(key) + "&limit=1", {});
  const row = Array.isArray(data) ? asObject(data[0]) : {};
  return asObject(row.value);
}

async function writeSecret(_sb: ReturnType<typeof sbAdmin>, key: string, value: Json){
  await serviceRest("/rest/v1/gi_app_secrets?on_conflict=key", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
  });
}

async function loadAzureApp(_sb: ReturnType<typeof sbAdmin>){
  const data = await serviceRest("/rest/v1/gi_daily_sales_mail_account?select=ms_client_id,ms_client_secret,ms_tenant_id&limit=1", {});
  const row = Array.isArray(data) && data[0] ? asObject(data[0]) : {};
  const clientId = trim(row.ms_client_id);
  const clientSecret = trim(row.ms_client_secret);
  const tenant = trim(row.ms_tenant_id) || "common";
  if(!clientId) throw new Error("APP_CONFIG_MISSING");
  return { clientId, clientSecret, tenant };
}

async function requireActor(sb: ReturnType<typeof sbAdmin>, body: Json){
  const username = trim(body.username).slice(0, 80);
  const pin = trim(body.pin).slice(0, 32);
  if(!username || !pin) return { error: "MISSING_CREDENTIALS", actor: null as Json | null };
  const verified = await sb.rpc("gi_verify_agent_login", { p_username: username, p_pin: pin });
  if(verified.error) return { error: "PIN_VERIFY_FAILED", actor: null };
  const actor = asObject(verified.data);
  if(actor.ok !== true) return { error: trim(actor.error) || "BAD_PIN", actor: null };
  if(!allowedRole(actor.role)) return { error: "NOT_ALLOWED", actor: null };
  return { error: "", actor };
}

async function tokenRequest(tenant: string, params: URLSearchParams){
  let res: Response;
  try {
    res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });
  } catch(err){
    throw new Error(graphErrorCode(safeFailureText(err)));
  }
  let data: Json = {};
  try { data = asObject(await res.json()); } catch(_e) { data = {}; }
  if(!res.ok || !trim(data.access_token)){
    throw new Error(graphErrorCode(trim(data.error) + " " + trim(data.error_description)));
  }
  return data;
}

async function graphGet(access: string, url: string){
  const res = await fetch(url, {
    headers: {
      Authorization: "Bearer " + access,
      Prefer: 'outlook.body-content-type="text"'
    }
  });
  let data: Json = {};
  try { data = asObject(await res.json()); } catch(_e) { data = {}; }
  if(!res.ok) throw new Error(graphErrorCode(trim(data.error) + " " + trim((asObject(data.error)).message || data.error)));
  return data;
}

async function mailboxAddress(access: string){
  const me = await graphGet(access, "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName");
  const mail = trim(me.mail).toLowerCase();
  const upn = trim(me.userPrincipalName).toLowerCase();
  return mail === MAILBOX || upn === MAILBOX;
}

async function collectionAccess(sb: ReturnType<typeof sbAdmin>){
  const row = await readSecret(sb, SECRET_MAIL);
  const refresh = trim(row.refresh_token);
  if(!refresh || trim(row.mailbox).toLowerCase() !== MAILBOX) throw new Error("MAILBOX_NOT_CONNECTED");
  const exp = Number(row.access_exp) || 0;
  if(trim(row.access_token) && exp > Date.now() + 60 * 1000){
    return { access: trim(row.access_token), row };
  }
  const app = await loadAzureApp(sb);
  const data = await tokenRequest(app.tenant, new URLSearchParams({
    client_id: app.clientId,
    client_secret: app.clientSecret,
    refresh_token: refresh,
    grant_type: "refresh_token",
    scope: READ_SCOPE
  }));
  const next: Json = {
    ...row,
    mailbox: MAILBOX,
    refresh_token: trim(data.refresh_token) || refresh,
    access_token: trim(data.access_token),
    access_exp: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    updated_at: new Date().toISOString()
  };
  await writeSecret(sb, SECRET_MAIL, next);
  return { access: trim(data.access_token), row: next };
}

function seenMap(row: Json, windowStart: string){
  const start = Date.parse(windowStart) - 24 * 60 * 60 * 1000;
  const map = new Map<string, string>();
  (Array.isArray(row.seen) ? row.seen : []).forEach((item) => {
    const rec = asObject(item);
    const id = trim(rec.id);
    const at = trim(rec.at);
    if(!id || !at) return;
    const stamp = Date.parse(at);
    if(!Number.isFinite(stamp) || stamp < start) return;
    map.set(id, at);
  });
  return map;
}

async function loadCustomers(sb: ReturnType<typeof sbAdmin>){
  const rows: Json[] = [];
  const page = 1000;
  for(let from = 0; from < 20000; from += page){
    const res = await sb.from("customers").select("id,full_name,id_number").range(from, from + page - 1);
    if(res.error) throw new Error("CUSTOMERS_UNAVAILABLE");
    const chunk = (res.data || []) as Json[];
    chunk.forEach((row) => {
      rows.push({
        id: trim(row.id),
        fullName: trim(row.full_name),
        name: trim(row.full_name),
        idNumber: trim(row.id_number)
      });
    });
    if(chunk.length < page) break;
  }
  return rows;
}

async function rememberHolds(sb: ReturnType<typeof sbAdmin>, holds: Json[]){
  const prev = await readSecret(sb, SECRET_HOLDS);
  const list = Array.isArray(prev.holds) ? prev.holds.map((row) => asObject(row)) : [];
  holds.forEach((row) => list.push(publicHold(row)));
  const map = new Map<string, Json>();
  list.forEach((row) => {
    const id = trim(row.id);
    if(id) map.set(id, row);
  });
  const next = Array.from(map.values()).slice(-80);
  await writeSecret(sb, SECRET_HOLDS, { holds: next });
  return next;
}

async function patchIndex(sb: ReturnType<typeof sbAdmin>, counts: Record<string, number>){
  const ids = Object.keys(counts);
  if(!ids.length) return;
  const res = await sb.from("app_meta").select("payload").eq("key", "global").maybeSingle();
  if(res.error) return;
  const payload = asObject(res.data && (res.data as Json).payload);
  const index = asObject(payload.collectionOpenIndex);
  const at = new Date().toISOString();
  ids.forEach((id) => {
    index[id] = { customerId: id, openCount: counts[id], updatedAt: at };
  });
  payload.collectionOpenIndex = index;
  await sb.from("app_meta").update({ payload, updated_at: at }).eq("key", "global");
}

async function saveCase(sb: ReturnType<typeof sbAdmin>, customerId: string, entry: Json){
  const loaded = await sb.from("customers").select("payload").eq("id", customerId).maybeSingle();
  if(loaded.error || !loaded.data) return { saved: false, openCount: 0 };
  const payload = asObject((loaded.data as Json).payload);
  const cases = Array.isArray(payload.collectionCases) ? payload.collectionCases.map((row) => asObject(row)) : [];
  if(cases.some((row) => trim(row.id) === trim(entry.id))){
    return { saved: false, openCount: collectionApi().openCount(cases) };
  }
  cases.push(entry);
  payload.collectionCases = cases;
  const saved = await sb.from("customers").update({
    payload,
    updated_at: new Date().toISOString()
  }).eq("id", customerId);
  if(saved.error) return { saved: false, openCount: collectionApi().openCount(cases) };
  return { saved: true, openCount: collectionApi().openCount(cases) };
}

async function uploadPdf(sb: ReturnType<typeof sbAdmin>, customerId: string, caseId: string, fileName: string, bytes: Uint8Array){
  const path = pathPart(customerId) + "/collection/" + pathPart(caseId) + ".pdf";
  const stored = await sb.storage.from(FILES_BUCKET).upload(path, bytes, {
    contentType: "application/pdf",
    upsert: true
  });
  if(stored.error) return null;
  return {
    id: caseId + "_file",
    fileName: fileName || "collection.pdf",
    mime: "application/pdf",
    storagePath: path,
    storageBucket: FILES_BUCKET,
    hasFile: true,
    scope: "customer",
    size: bytes.length
  };
}

function fromAddress(message: Json){
  const from = asObject(asObject(message.from).emailAddress);
  return trim(from.address) || trim(from.name);
}

async function messagePdf(access: string, message: Json){
  if(message.hasAttachments !== true) return { items: [] as Json[], text: "", fileName: "", bytes: null as Uint8Array | null };
  const listed = await graphGet(access, "https://graph.microsoft.com/v1.0/me/messages/" + encodeURIComponent(trim(message.id)) + "/attachments?$select=id,name,contentType,size");
  const files = (Array.isArray(listed.value) ? listed.value : []).map((row) => asObject(row)).filter((row) => {
    const name = trim(row.name).toLowerCase();
    const type = trim(row.contentType).toLowerCase();
    const size = Number(row.size) || 0;
    return (type.includes("pdf") || name.endsWith(".pdf")) && size > 0 && size <= MAX_PDF_BYTES;
  }).slice(0, 3);
  const items: Json[] = [];
  const texts: string[] = [];
  let first: { fileName: string; bytes: Uint8Array } | null = null;
  for(let i = 0; i < files.length; i += 1){
    const file = await graphGet(access, "https://graph.microsoft.com/v1.0/me/messages/" + encodeURIComponent(trim(message.id)) + "/attachments/" + encodeURIComponent(trim(files[i].id)));
    const raw = trim(file.contentBytes).replace(/\s+/g, "");
    if(!raw) continue;
    const bytes = Uint8Array.from(atob(raw), (ch) => ch.charCodeAt(0));
    if(bytes.length > MAX_PDF_BYTES) continue;
    if(!first) first = { fileName: trim(file.name).slice(0, 120) || "collection.pdf", bytes };
    try {
      const parsed = await pdfTextItems(bytes);
      parsed.items.forEach((item) => items.push(item));
      if(parsed.text) texts.push(parsed.text);
    } catch(_e) {}
  }
  return { items, text: texts.join(" "), fileName: first?.fileName || "", bytes: first?.bytes || null };
}

async function pullMessages(sb: ReturnType<typeof sbAdmin>, access: string, row: Json){
  const api = collectionApi();
  const windowStart = api.weekStart(new Date());
  const seen = seenMap(row, windowStart);
  const customers = await loadCustomers(sb);
  let url = "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter="
    + encodeURIComponent("receivedDateTime ge " + windowStart + " and isDraft eq false")
    + "&$orderby=receivedDateTime%20desc&$top=20&$select=id,subject,from,receivedDateTime,body,hasAttachments,isDraft";
  let scanned = 0;
  let opened = 0;
  let held = 0;
  let skipped = 0;
  let more = false;
  let pages = 0;
  const customerIds: string[] = [];
  const openCounts: Record<string, number> = {};
  const holds: Json[] = [];
  while(url && pages < MAX_PAGES && scanned < MAX_MESSAGES){
    pages += 1;
    let page: Json;
    try {
      page = await graphGet(access, url);
    } catch(err){
      if(pages !== 1 || url.indexOf("$orderby=") < 0) throw err;
      url = url.replace(/&\$orderby=[^&]+/, "");
      page = await graphGet(access, url);
    }
    const values = Array.isArray(page.value) ? page.value.map((item) => asObject(item)) : [];
    for(let i = 0; i < values.length; i += 1){
      const message = values[i];
      const receivedAt = trim(message.receivedDateTime);
      if(!api.withinWeek(receivedAt, new Date())) continue;
      const id = trim(message.id);
      if(!id || seen.has(id)){
        skipped += 1;
        continue;
      }
      if(scanned >= MAX_MESSAGES){
        more = true;
        break;
      }
      scanned += 1;
      seen.set(id, receivedAt);
      const body = asObject(message.body);
      const text = htmlToText(trim(body.content));
      let pdf = { items: [] as Json[], text: "", fileName: "", bytes: null as Uint8Array | null };
      try { pdf = await messagePdf(access, message); } catch(_e) { pdf = { items: [], text: "", fileName: "", bytes: null }; }
      const result = api.applyIncoming({
        from: fromAddress(message),
        subject: trim(message.subject),
        body: [text, pdf.text].filter(Boolean).join(" "),
        text: [text, pdf.text].filter(Boolean).join(" "),
        receivedAt,
        items: pdf.items,
        attachment: pdf.bytes ? { name: pdf.fileName } : null
      }, customers);
      const freshHolds: Json[] = [];
      for(let h = 0; h < result.holds.length; h += 1){
        const hold = asObject(result.holds[h]);
        const holdKey = await sha256hex([id, trim(hold.reason), trim(hold.name), trim(hold.idNumber), trim(hold.idLast4)].join("|"));
        freshHolds.push({
          ...publicHold(hold),
          id: "colhold_" + holdKey.slice(0, 24)
        });
      }
      if(freshHolds.length){
        holds.push(...freshHolds);
        held += freshHolds.length;
      }
      const individualFile = result.kind !== "report" && result.reportFileOmitted !== true && result.assignments.length === 1 && !!pdf.bytes;
      for(let n = 0; n < result.assignments.length; n += 1){
        const item = result.assignments[n];
        const customerId = trim(item.customerId);
        if(!customerId) continue;
        const entry = asObject(item.entry);
        const caseKey = await sha256hex([id, trim(entry.policyNumber), trim(entry.idNumber), trim(entry.idLast4), trim(entry.name)].join("|"));
        const caseId = "colmail_" + caseKey.slice(0, 24);
        entry.id = caseId;
        entry.openedAt = receivedAt || new Date().toISOString();
        entry.openedBy = "תיבת גבייה";
        entry.mailId = id;
        delete entry.dataUrl;
        delete entry.base64;
        delete entry.data;
        entry.document = null;
        if(individualFile && pdf.bytes && n === 0){
          const stored = await uploadPdf(sb, customerId, caseId, pdf.fileName, pdf.bytes);
          if(stored) entry.document = stored;
        }
        const saved = await saveCase(sb, customerId, entry);
        openCounts[customerId] = saved.openCount;
        if(saved.saved){
          opened += 1;
          if(customerIds.indexOf(customerId) < 0) customerIds.push(customerId);
        } else skipped += 1;
      }
    }
    const next = trim(page["@odata.nextLink"]);
    if(scanned >= MAX_MESSAGES){
      if(next) more = true;
      break;
    }
    url = next;
    if(!values.length) break;
  }
  if(holds.length) await rememberHolds(sb, holds);
  await patchIndex(sb, openCounts);
  const storedSeen = Array.from(seen.entries()).slice(-400).map(([id, at]) => ({ id, at }));
  const current = await readSecret(sb, SECRET_MAIL);
  await writeSecret(sb, SECRET_MAIL, {
    ...current,
    mailbox: MAILBOX,
    seen: storedSeen,
    last_pull_at: new Date().toISOString(),
    pulling_until: 0
  });
  return publicPull({
    ok: true,
    scanned,
    opened,
    held,
    skipped,
    more,
    windowStart,
    customerIds,
    openCounts,
    holds
  });
}

async function connectStart(sb: ReturnType<typeof sbAdmin>, actor: Json){
  const app = await loadAzureApp(sb);
  const state = randomHex(32);
  await writeSecret(sb, SECRET_STATE, {
    hash: await sha256hex(state),
    agentId: trim(actor.agentId),
    exp: Date.now() + 10 * 60 * 1000
  });
  const params = new URLSearchParams({
    client_id: app.clientId,
    response_type: "code",
    redirect_uri: REDIRECT,
    response_mode: "query",
    scope: READ_SCOPE,
    state,
    prompt: "select_account"
  });
  return {
    ok: true,
    url: `https://login.microsoftonline.com/${encodeURIComponent(app.tenant)}/oauth2/v2.0/authorize?${params.toString()}`
  };
}

async function connectFinish(sb: ReturnType<typeof sbAdmin>, body: Json){
  const state = trim(body.state);
  const code = trim(body.code);
  const stored = await readSecret(sb, SECRET_STATE);
  const hash = state ? await sha256hex(state) : "";
  const fresh = !!hash && sameText(hash, trim(stored.hash)) && Date.now() <= Number(stored.exp || 0);
  await writeSecret(sb, SECRET_STATE, { hash: "", exp: 0 });
  if(!fresh || !code) return json({ ok: false, error: "STATE_EXPIRED" }, 400);
  const app = await loadAzureApp(sb);
  let data: Json;
  try {
    data = await tokenRequest(app.tenant, new URLSearchParams({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      code,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
      scope: READ_SCOPE
    }));
  } catch(err){
    return json({ ok: false, error: trim((err as Error).message) || "MAILBOX_NOT_READY" }, 400);
  }
  const access = trim(data.access_token);
  let matches = false;
  try { matches = await mailboxAddress(access); } catch(_e) { matches = false; }
  if(!matches) return json({ ok: false, error: "WRONG_MAILBOX" }, 403);
  try {
    await graphGet(access, "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=1&$select=id,receivedDateTime");
  } catch(err){
    const codeName = trim((err as Error).message);
    return json({ ok: false, error: codeName === "MAIL_READ_DENIED" ? codeName : "MAIL_READ_DENIED" }, 403);
  }
  const previous = await readSecret(sb, SECRET_MAIL);
  await writeSecret(sb, SECRET_MAIL, {
    mailbox: MAILBOX,
    refresh_token: trim(data.refresh_token),
    access_token: access,
    access_exp: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    seen: Array.isArray(previous.seen) ? previous.seen : [],
    last_pull_at: trim(previous.last_pull_at),
    updated_at: new Date().toISOString()
  });
  return json({ ok: true, connected: true, mailbox: MAILBOX });
}

Deno.serve(async (req) => {
  if(req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if(req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);
  let body: Json = {};
  try { body = asObject(await req.json()); } catch(_e) { body = {}; }
  const action = trim(body.action);
  const sb = sbAdmin();
  try {
    if(action === "status"){
      let connected = false;
      let lastPullAt = "";
      let blocker = "";
      try {
        const row = await readSecret(sb, SECRET_MAIL);
        connected = trim(row.mailbox).toLowerCase() === MAILBOX && !!trim(row.refresh_token);
        lastPullAt = trim(row.last_pull_at);
      } catch(err) {
        connected = false;
        blocker = graphErrorCode(trim((err as Error).message));
      }
      return json({ ok: true, connected, mailbox: MAILBOX, lastPullAt, blocker });
    }
    if(action === "finish") return await connectFinish(sb, body);
    const actor = await requireActor(sb, body);
    if(actor.error) return json({ ok: false, error: actor.error }, actor.error === "NOT_ALLOWED" ? 403 : 401);
    if(action === "auth-url") return json(await connectStart(sb, actor.actor || {}));
    if(action === "pull"){
      try {
        const ready = await collectionAccess(sb);
        const locked = await readSecret(sb, SECRET_MAIL);
        if(Number(locked.pulling_until) > Date.now()) return json({ ok: false, error: "PULL_BUSY" }, 429);
        await writeSecret(sb, SECRET_MAIL, { ...locked, pulling_until: Date.now() + PULL_LOCK_MS });
        const pulled = await pullMessages(sb, ready.access, locked);
        return json(pulled);
      } catch(err){
        const codeName = trim((err as Error).message) || "MAILBOX_NOT_READY";
        try {
          const latest = await readSecret(sb, SECRET_MAIL);
          await writeSecret(sb, SECRET_MAIL, { ...latest, pulling_until: 0, last_error: graphErrorCode(codeName) });
        } catch(_e) {}
        return json({ ok: false, error: graphErrorCode(codeName) }, 400);
      }
    }
    return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch(err){
    const codeName = graphErrorCode(safeFailureText(err));
    return json({ ok: false, error: codeName === "MAILBOX_NOT_READY" ? "MAILBOX_NOT_READY" : codeName }, 500);
  }
});
