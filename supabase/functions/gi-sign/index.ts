// GI-SIGN — cancel-form signature links.
// Create requires an admin/manager PIN. The public phone page only knows its token.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { OG_CARD_JPEG_B64 } from "./og-card.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
};

const PAGE_H = 841.89;
const HOLD_MS = 45000;
const GATE_MAX = 8;
const GATE_LOCK_MS = 15 * 60 * 1000;

type Json = Record<string, unknown>;

function json(data: Json, status = 200){
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function trim(v: unknown){
  return String(v == null ? "" : v).trim();
}

function jerusalemParts(date: Date){
  const map: Record<string, string> = {};
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).forEach((part) => { map[part.type] = part.value; });
  return {
    y: Number(map.year) || date.getUTCFullYear(),
    m: Number(map.month) || 1,
    d: Number(map.day) || 1,
  };
}

function israelNextMidnight(from: Date){
  const today = jerusalemParts(from);
  const todayKey = today.y * 10000 + today.m * 100 + today.d;
  let lo = from.getTime();
  let hi = lo + 36 * 3600 * 1000;
  while(hi - lo > 250){
    const mid = Math.floor((lo + hi) / 2);
    const part = jerusalemParts(new Date(mid));
    const key = part.y * 10000 + part.m * 100 + part.d;
    if(key > todayKey) hi = mid;
    else lo = mid + 1;
  }
  return hi;
}

function packetExpired(packet: Json, now = Date.now()){
  const exp = Date.parse(trim(packet.expires_at));
  if(Number.isFinite(exp)) return now >= exp;
  const created = Date.parse(trim(packet.created_at));
  if(Number.isFinite(created)) return now >= israelNextMidnight(new Date(created));
  return false;
}

function expiredResponse(){
  return json({ ok: false, error: "EXPIRED" }, 403);
}

function sbAdmin(){
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

function canSendRole(role: string){
  const raw = trim(role);
  const r = raw.toLowerCase();
  return r === "admin" || r === "owner" || r === "manager" || r === "adminlite" || r === "admin_lite"
    || raw === "מנהל" || raw === "מנהל מערכת" || raw === "מפתח המערכת";
}

const FORMS_SEND_ON: Record<string, boolean> = {
  admin: true,
  owner: true,
  manager: true,
  adminlite: true,
  ops: true,
  opsagent: true,
  agent: false,
  elementary: false,
  teammanager: false,
  referent: false,
};

function formsSendRoleKey(role: string){
  const raw = trim(role);
  const r = raw.toLowerCase().replace(/[\s_-]/g, "");
  if(r === "owner" || raw === "מפתח המערכת") return "owner";
  if(r === "admin" || raw === "מנהל מערכת") return "admin";
  if(r === "manager" || raw === "מנהל") return "manager";
  if(r === "adminlite") return "adminlite";
  if(r === "ops" || r === "operations" || raw === "תפעול" || raw === "מנהל תפעול") return "ops";
  if(r === "opsagent" || raw === "נציג תפעול" || raw === "יוזר תפעול" || raw === "משתמש תפעול") return "opsagent";
  if(r === "elementary" || raw === "אלמנטרי" || raw === "נציג אלמנטרי") return "elementary";
  if(r === "teammanager" || raw === "מנהל צוות") return "teammanager";
  if(r === "referent" || raw === "סוקרת" || raw === "רפרנטית") return "referent";
  if(r === "agent" || raw === "נציג" || raw === "נציג רגיל") return "agent";
  return r;
}

function canSendFormsRole(role: string){
  return !!FORMS_SEND_ON[formsSendRoleKey(role)];
}

function canOpenCustomerSignRole(role: string){
  const key = formsSendRoleKey(role);
  return key === "admin" || key === "manager" || key === "owner" || key === "adminlite";
}

function canSendCancelMailRole(role: string){
  const key = formsSendRoleKey(role);
  return canOpenCustomerSignRole(role) || key === "ops" || key === "opsagent";
}

const CANCEL_FROM = "bituliimp@gmail.com";
const CANCEL_COMPANY_MAIL: Record<string, string> = {};

function b64ToBytes(raw: string){
  const clean = raw.replace(/^data:[^,]*,/, "").replace(/\s/g, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function imageContentType(bytes: Uint8Array){
  if(bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return "image/png";
}

let fallbackJpeg: Uint8Array | null = null;
function fallbackCardJpeg(){
  if(fallbackJpeg && fallbackJpeg.length) return fallbackJpeg;
  fallbackJpeg = b64ToBytes(OG_CARD_JPEG_B64);
  return fallbackJpeg;
}

function cardJpegBytes(raw: string){
  const stored = raw ? b64ToBytes(raw) : new Uint8Array();
  if(stored.length >= 3 && imageContentType(stored) === "image/jpeg") return stored;
  return fallbackCardJpeg();
}

function bytesToB64(bytes: Uint8Array){
  let bin = "";
  const chunk = 0x2000;
  for(let i = 0; i < bytes.length; i += chunk){
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function digitsId(v: unknown){
  const digits = trim(v).replace(/\D/g, "");
  if(!digits) return "";
  if(digits.length >= 9) return digits;
  return digits.padStart(9, "0");
}

function idsMatch(a: unknown, b: unknown){
  const left = digitsId(a);
  const right = digitsId(b);
  return !!left && left === right;
}

function idsAllow(stored: unknown, typed: unknown){
  return trim(stored).split(/[,|]/).some((part) => idsMatch(part, typed));
}

function signerIds(signer: Json){
  const ids: string[] = [];
  const push = (value: unknown) => {
    const id = digitsId(value);
    if(id && !ids.includes(id)) ids.push(id);
  };
  push(signer.idNumber);
  if(Array.isArray(signer.idNumbers)) (signer.idNumbers as unknown[]).forEach(push);
  return ids;
}

function pdfRect(box: Json, pageH = PAGE_H){
  const x0 = Number(box.x0) || 0;
  const y0 = Number(box.y0) || 0;
  const x1 = Number(box.x1) || 0;
  const y1 = Number(box.y1) || 0;
  return { x: x0, y: pageH - y1, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}

function storedCells(box: Json){
  const list = Array.isArray(box.boxes) ? box.boxes as Json[] : [];
  if(list.length) return list;
  return [box];
}

async function stampPdf(pdfBase64: string, pngs: string[], box: Json){
  const pdf = await PDFDocument.load(b64ToBytes(pdfBase64), { ignoreEncryption: true });
  const pages = pdf.getPages();
  const cells = storedCells(box);
  const images = pngs.length ? pngs : [""];
  for(let i = 0; i < cells.length; i++){
    const cell = cells[i] && typeof cells[i] === "object" ? cells[i] as Json : {};
    const pngRaw = trim(images[i] || images[0]);
    if(!pngRaw) continue;
    const png = await pdf.embedPng(b64ToBytes(pngRaw));
    const page = pages[Number(cell.page) || 0] || pages[0];
    const rect = pdfRect(cell, page.getHeight());
    const pad = 2;
    page.drawImage(png, {
      x: rect.x + pad,
      y: rect.y + pad,
      width: Math.max(8, rect.width - pad * 2),
      height: Math.max(8, rect.height - pad * 2),
    });
  }
  const saved = await pdf.save();
  return bytesToB64(saved);
}

async function requireManager(sb: SupabaseClient, body: Json, forms = false){
  const pin = trim(body.pin);
  const username = trim(body.username) || trim(body.agentName);
  const agentId = trim(body.agentId);
  if(!pin || !username) return { ok: false as const, error: "AUTH_REQUIRED", status: 401 };
  const verified = await sb.rpc("gi_verify_agent_login", { p_username: username, p_pin: pin });
  if(verified.error || !verified.data || (verified.data as Json).ok !== true){
    return { ok: false as const, error: "AUTH_FAILED", status: 401 };
  }
  let query = sb.from("agents").select("id,name,username,role,active");
  const found = agentId
    ? await query.eq("id", agentId).maybeSingle()
    : await query.eq("username", username).maybeSingle();
  const agent = found.data as Json | null;
  const allowed = forms ? canSendFormsRole(trim(agent?.role)) : canSendRole(trim(agent?.role));
  if(!agent || agent.active === false || !allowed){
    return { ok: false as const, error: "FORBIDDEN", status: 403 };
  }
  return { ok: true as const, agent };
}

async function broadcastSigned(payload: Json){
  const url = trim(Deno.env.get("SUPABASE_URL"));
  const key = trim(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if(!url || !key) return;
  try {
    await fetch(url.replace(/\/+$/, "") + "/realtime/v1/api/broadcast", {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{
          topic: "gi-sign-toast",
          event: "signed",
          payload,
        }],
      }),
    });
  } catch(_e) {}
}

function signerCells(signer: Json){
  const many = Array.isArray(signer.boxes) ? signer.boxes as Json[] : [];
  const source = many.length ? many : (signer.box && typeof signer.box === "object" ? [signer.box as Json] : []);
  const cells = [];
  for(const raw of source){
    const cell = raw && typeof raw === "object" ? raw as Json : {};
    const x0 = Number(cell.x0);
    const y0 = Number(cell.y0);
    const x1 = Number(cell.x1);
    const y1 = Number(cell.y1);
    if(!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) continue;
    cells.push({ page: Number(cell.page) || 0, x0, y0, x1, y1 });
  }
  return cells;
}

async function reuseStampedPdf(sb: SupabaseClient, customerId: string, docId: string){
  const packs = await sb.from("gi_sign_packets")
    .select("id")
    .eq("customer_id", customerId)
    .eq("doc_id", docId)
    .order("created_at", { ascending: false })
    .limit(8);
  const rows = Array.isArray(packs.data) ? packs.data as Json[] : [];
  for(const pack of rows){
    const id = trim(pack.id);
    if(!id) continue;
    const linksRes = await sb.from("gi_sign_links").select("status,signer_id").eq("packet_id", id);
    const links = Array.isArray(linksRes.data) ? linksRes.data as Json[] : [];
    const signed = links.filter((row) => trim(row.status) === "signed");
    if(!signed.length) continue;
    const pdfRes = await sb.from("gi_sign_packets").select("pdf_base64").eq("id", id).maybeSingle();
    const pdfBase64 = trim(pdfRes.data && (pdfRes.data as Json).pdf_base64);
    if(!pdfBase64) continue;
    return {
      pdfBase64,
      signedIds: signed.map((row) => trim(row.signer_id)).filter(Boolean),
    };
  }
  return null;
}

async function requireActiveAgent(sb: SupabaseClient, body: Json){
  const pin = trim(body.pin);
  const username = trim(body.username) || trim(body.agentName);
  const agentId = trim(body.agentId);
  if(!pin || !username) return { ok: false as const, error: "AUTH_REQUIRED", status: 401 };
  const verified = await sb.rpc("gi_verify_agent_login", { p_username: username, p_pin: pin });
  if(verified.error || !verified.data || (verified.data as Json).ok !== true){
    return { ok: false as const, error: "AUTH_FAILED", status: 401 };
  }
  const query = sb.from("agents").select("id,name,username,role,active");
  const found = agentId
    ? await query.eq("id", agentId).maybeSingle()
    : await query.eq("username", username).maybeSingle();
  const agent = found.data as Json | null;
  if(!agent || agent.active === false){
    return { ok: false as const, error: "FORBIDDEN", status: 403 };
  }
  return { ok: true as const, agent };
}

/** Free-form upload for an admin or manager. The phone is the customer's gate code.
    Nothing is sent to WhatsApp. */
async function createUpload(sb: SupabaseClient, body: Json){
  const auth = await requireActiveAgent(sb, body);
  if(!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  if(!canOpenCustomerSignRole(trim(auth.agent.role))) return json({ ok: false, error: "FORBIDDEN" }, 403);
  const docName = trim(body.docName);
  const phone = digitsId(body.phone);
  const pdfBase64 = trim(body.pdfBase64).replace(/^data:[^,]*,/, "");
  const token = trim(body.token);
  const cells = signerCells({ boxes: body.boxes });
  if(!docName || phone.length < 9 || !pdfBase64 || !cells.length || !/^[A-Za-z0-9]{6,16}$/.test(token)){
    return json({ ok: false, error: "MISSING_FIELDS" }, 400);
  }
  if(pdfBase64.length > 12000000) return json({ ok: false, error: "PDF_TOO_LARGE" }, 413);
  const docId = "upload-" + token;
  const customerId = trim(body.customerId) || ("upload:" + trim(auth.agent.id));
  const expiresAt = new Date(israelNextMidnight(new Date())).toISOString();
  const inserted = await sb.from("gi_sign_packets").insert({
    customer_id: customerId,
    doc_id: docId,
    doc_name: docName,
    customer_name: trim(body.customerName),
    sender_id: trim(auth.agent.id),
    sender_name: trim(auth.agent.name),
    pdf_base64: pdfBase64,
    expires_at: expiresAt,
  }).select("id").single();
  if(inserted.error || !inserted.data) return json({ ok: false, error: "SAVE_FAILED" }, 500);
  const packetId = trim((inserted.data as Json).id);
  const first = cells[0];
  const saved = await sb.from("gi_sign_links").insert({
    token,
    packet_id: packetId,
    slot: "self",
    signer_name: trim(body.customerName) || "לקוח",
    signer_id: phone,
    box: {
      page: first.page, x0: first.x0, y0: first.y0, x1: first.x1, y1: first.y1, boxes: cells,
      cancelLetter: body.cancelLetter === true,
    },
    status: "pending",
    step_total: cells.length,
  });
  if(saved.error) return json({ ok: false, error: "LINK_FAILED" }, 500);
  return json({
    ok: true,
    packetId,
    token,
    phone,
    docName,
    expiresAt,
    sentWhatsapp: false,
    senderName: trim(auth.agent.name),
  });
}

async function listUploads(sb: SupabaseClient, body: Json){
  const auth = await requireActiveAgent(sb, body);
  if(!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  if(!canOpenCustomerSignRole(trim(auth.agent.role))) return json({ ok: false, error: "FORBIDDEN" }, 403);
  const packets = await sb.from("gi_sign_packets")
    .select("id,doc_id,doc_name,customer_name,customer_id,created_at,expires_at")
    .eq("sender_id", trim(auth.agent.id))
    .like("doc_id", "upload-%")
    .order("created_at", { ascending: false })
    .limit(40);
  if(packets.error) return json({ ok: false, error: "LIST_FAILED" }, 500);
  const rows = Array.isArray(packets.data) ? packets.data as Json[] : [];
  const ids = rows.map((row) => trim(row.id)).filter(Boolean);
  let links: Json[] = [];
  if(ids.length){
    const found = await sb.from("gi_sign_links")
      .select("token,packet_id,status,opened_at,step_n,step_total,signed_at,box,signer_name")
      .in("packet_id", ids);
    if(found.error) return json({ ok: false, error: "LIST_FAILED" }, 500);
    links = Array.isArray(found.data) ? found.data as Json[] : [];
  }
  const byPacket: Record<string, Json> = {};
  for(const link of links) byPacket[trim(link.packet_id)] = link;
  const items = rows.map((row) => {
    const link = byPacket[trim(row.id)] || {};
    const box = link.box && typeof link.box === "object" ? link.box as Json : {};
    const boxes = Array.isArray(box.boxes) ? box.boxes as Json[] : [];
    const cancel = box.cancel && typeof box.cancel === "object" ? box.cancel as Json : {};
    return {
      packetId: trim(row.id),
      token: trim(link.token),
      docName: trim(row.doc_name),
      customerName: trim(row.customer_name) || trim(link.signer_name),
      customerId: trim(row.customer_id),
      createdAt: trim(row.created_at),
      expiresAt: trim(row.expires_at),
      status: trim(link.status) || "pending",
      opened: !!trim(link.opened_at),
      step: Number(link.step_n) || 0,
      total: Number(link.step_total) || boxes.length || 0,
      signedAt: trim(link.signed_at),
      cancelLetter: box.cancelLetter === true,
      cancelSent: trim(cancel.sentAt) ? {
        company: trim(cancel.company),
        email: trim(cancel.email),
        sentAt: trim(cancel.sentAt),
        sentBy: trim(cancel.sentBy),
      } : null,
    };
  });
  return json({ ok: true, items, from: CANCEL_FROM });
}

/** Writes the under-document record only after a real send from bituliimp@gmail.com.
    sendCancel does not call this while that mailbox is disconnected. */
async function stampCancelSent(sb: SupabaseClient, token: string, box: Json, record: Json){
  const next = Object.assign({}, box, { cancel: record });
  return await sb.from("gi_sign_links").update({ box: next }).eq("token", token);
}

async function sendCancel(sb: SupabaseClient, body: Json){
  const auth = await requireActiveAgent(sb, body);
  if(!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  if(!canSendCancelMailRole(trim(auth.agent.role))) return json({ ok: false, error: "FORBIDDEN" }, 403);
  const token = trim(body.token);
  const company = trim(body.company);
  if(!token || !company) return json({ ok: false, error: "MISSING_FIELDS" }, 400);
  const found = await sb.from("gi_sign_links").select("token,status,box").eq("token", token).maybeSingle();
  if(found.error || !found.data) return json({ ok: false, error: "NOT_FOUND" }, 404);
  const link = found.data as Json;
  if(trim(link.status) !== "signed") return json({ ok: false, error: "NOT_SIGNED" }, 409);
  const box = link.box && typeof link.box === "object" ? link.box as Json : {};
  const isCancel = box.cancelLetter === true || trim(body.kind) === "company_cancel_form";
  if(!isCancel) return json({ ok: false, error: "NOT_CANCEL" }, 409);
  const email = trim(CANCEL_COMPANY_MAIL[company]);
  if(!email) return json({ ok: false, error: "COMPANY_EMAIL_MISSING", from: CANCEL_FROM, company }, 409);
  return json({ ok: false, error: "MAIL_NOT_CONNECTED", from: CANCEL_FROM, company }, 503);
}

async function createPacket(sb: SupabaseClient, body: Json){
  const forms = trim(body.scope) === "forms";
  const auth = await requireManager(sb, body, forms);
  if(!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  const customerId = trim(body.customerId);
  const docId = trim(body.docId);
  let pdfBase64 = trim(body.pdfBase64);
  const signers = Array.isArray(body.signers) ? body.signers : [];
  if(!customerId || !docId || !pdfBase64 || !signers.length){
    return json({ ok: false, error: "MISSING_FIELDS" }, 400);
  }
  const prepared = [];
  for(const row of signers){
    const signer = row && typeof row === "object" ? row as Json : {};
    const token = trim(signer.token);
    const name = trim(signer.name);
    const slot = trim(signer.slot) || "self";
    const cells = signerCells(signer);
    const ids = signerIds(signer);
    if(!token || !name || !cells.length || !ids.length) return json({ ok: false, error: "MISSING_ID" }, 400);
    const first = cells[0];
    prepared.push({
      token,
      name,
      slot,
      idNumber: ids.join(","),
      ids,
      openHref: trim(signer.openHref || signer.open_href),
      ogPng: trim(signer.ogPng || signer.og_png).replace(/^data:image\/png;base64,/, ""),
      cell: { page: first.page, x0: first.x0, y0: first.y0, x1: first.x1, y1: first.y1, boxes: cells },
    });
  }
  const reused = await reuseStampedPdf(sb, customerId, docId);
  if(reused){
    pdfBase64 = reused.pdfBase64;
  }
  const remaining = prepared.filter((row) => {
    if(!reused) return true;
    return !reused.signedIds.some((stored) => row.ids.some((id) => idsAllow(stored, id)));
  });
  if(!remaining.length) return json({ ok: false, error: "ALL_SIGNED" }, 409);
  const expiresAt = new Date(israelNextMidnight(new Date())).toISOString();
  const inserted = await sb.from("gi_sign_packets").insert({
    customer_id: customerId,
    doc_id: docId,
    doc_name: trim(body.docName),
    customer_name: trim(body.customerName),
    sender_id: trim(auth.agent.id),
    sender_name: trim(auth.agent.name),
    pdf_base64: pdfBase64,
    expires_at: expiresAt,
  }).select("id").single();
  if(inserted.error || !inserted.data) return json({ ok: false, error: "SAVE_FAILED" }, 500);
  const packetId = trim((inserted.data as Json).id);
  const links = [];
  for(const row of remaining){
    const saved = await sb.from("gi_sign_links").insert({
      token: row.token,
      packet_id: packetId,
      slot: row.slot,
      signer_name: row.name,
      signer_id: row.idNumber,
      box: row.cell,
      status: "pending",
      open_href: row.openHref,
      og_png: row.ogPng,
    });
    if(saved.error) return json({ ok: false, error: "LINK_FAILED" }, 500);
    links.push({ token: row.token, name: row.name, slot: row.slot, status: "pending" });
  }
  if(!links.length) return json({ ok: false, error: "NO_SIGNERS" }, 400);
  return json({
    ok: true,
    packetId,
    links,
    expiresAt,
    senderId: trim(auth.agent.id),
    senderName: trim(auth.agent.name),
  });
}

async function loadByToken(sb: SupabaseClient, token: string, includePdf = true){
  const linkRes = await sb.from("gi_sign_links").select("token,packet_id,slot,signer_name,signer_id,box,status,signed_at").eq("token", token).maybeSingle();
  if(linkRes.error || !linkRes.data) return null;
  const link = linkRes.data as Json;
  const packetCols = includePdf
    ? "id,customer_id,doc_id,doc_name,customer_name,sender_id,sender_name,pdf_base64,expires_at,created_at"
    : "id,customer_id,doc_id,doc_name,customer_name,sender_id,sender_name,expires_at,created_at";
  const packetRes = await sb.from("gi_sign_packets").select(packetCols).eq("id", link.packet_id).maybeSingle();
  if(packetRes.error || !packetRes.data) return null;
  return { link, packet: packetRes.data as Json };
}

function gateError(link: Json){
  const stored = digitsId(link.signer_id);
  if(!stored) return json({ ok: false, error: "NEEDS_RESEND" }, 403);
  return json({ ok: false, error: "ID_MISMATCH" }, 403);
}

function lockedResponse(retryAfter: number){
  return json({ ok: false, error: "LOCKED", retryAfter: Math.max(1, Math.round(retryAfter) || 1) }, 429);
}

async function readGate(sb: SupabaseClient, token: string){
  const res = await sb.from("gi_sign_links").select("gate_fails,gate_until").eq("token", token).maybeSingle();
  if(res.error || !res.data) return { unsupported: !!res.error, open: true, fails: 0, retryAfter: 0 };
  const row = res.data as Json;
  const until = Date.parse(trim(row.gate_until));
  if(Number.isFinite(until) && until > Date.now()){
    return {
      unsupported: false,
      open: false,
      fails: Number(row.gate_fails) || 0,
      retryAfter: Math.max(1, Math.ceil((until - Date.now()) / 1000)),
    };
  }
  const fails = Number.isFinite(until) ? 0 : (Number(row.gate_fails) || 0);
  return { unsupported: false, open: true, fails, retryAfter: 0 };
}

async function noteGateMiss(sb: SupabaseClient, token: string, fails: number){
  const next = fails + 1;
  const patch: Json = { gate_fails: next, gate_until: null };
  let locked = false;
  let retryAfter = 0;
  if(next >= GATE_MAX){
    patch.gate_until = new Date(Date.now() + GATE_LOCK_MS).toISOString();
    locked = true;
    retryAfter = Math.ceil(GATE_LOCK_MS / 1000);
  }
  const saved = await sb.from("gi_sign_links").update(patch).eq("token", token);
  if(saved.error) return { locked: false, retryAfter: 0 };
  return { locked, retryAfter };
}

async function clearGate(sb: SupabaseClient, token: string){
  await sb.from("gi_sign_links").update({ gate_fails: 0, gate_until: null }).eq("token", token);
}

async function publicGate(sb: SupabaseClient, body: Json, link: Json, token: string, allowManager: boolean){
  let agent = false;
  if(allowManager && trim(body.pin) && (trim(body.username) || trim(body.agentName))){
    agent = await managerPreview(sb, body, true);
  }
  const state = await readGate(sb, token);
  if(!agent && !state.unsupported && !state.open) return { ok: false as const, manager: false, response: lockedResponse(state.retryAfter) };
  if(idsAllow(link.signer_id, body.idNumber)){
    if(!state.unsupported && state.fails > 0) await clearGate(sb, token);
    return { ok: true as const, manager: false, response: null };
  }
  if(agent) return { ok: true as const, manager: true, response: null };
  if(state.unsupported || !digitsId(link.signer_id)) return { ok: false as const, manager: false, response: gateError(link) };
  const miss = await noteGateMiss(sb, token, state.fails);
  if(miss.locked) return { ok: false as const, manager: false, response: lockedResponse(miss.retryAfter) };
  return { ok: false as const, manager: false, response: gateError(link) };
}

function holdIsFree(holderToken: unknown, holderUntil: unknown, token: string, now = Date.now()){
  const holder = trim(holderToken);
  if(!holder || holder === trim(token)) return true;
  const until = Date.parse(trim(holderUntil));
  if(!Number.isFinite(until)) return true;
  return until <= now;
}

function waiting(signerName: unknown){
  return json({ ok: true, waiting: true, signerName: trim(signerName) });
}

async function claimHold(sb: SupabaseClient, packetId: string, token: string, signerName: string){
  const nowIso = new Date().toISOString();
  const until = new Date(Date.now() + HOLD_MS).toISOString();
  const filter = `holder_token.eq.,holder_token.eq.${token},holder_until.is.null,holder_until.lt.${nowIso}`;
  const updated = await sb.from("gi_sign_packets").update({
    holder_token: token,
    holder_name: signerName,
    holder_until: until,
  }).eq("id", packetId).or(filter).select("id");
  if(!updated.error && Array.isArray(updated.data) && updated.data.length){
    return { ok: true as const, signerName };
  }
  const current = await sb.from("gi_sign_packets").select("holder_token,holder_name,holder_until").eq("id", packetId).maybeSingle();
  const row = (current.data || {}) as Json;
  if(holdIsFree(row.holder_token, row.holder_until, token)){
    const again = await sb.from("gi_sign_packets").update({
      holder_token: token,
      holder_name: signerName,
      holder_until: until,
    }).eq("id", packetId).or(filter).select("id");
    if(!again.error && Array.isArray(again.data) && again.data.length){
      return { ok: true as const, signerName };
    }
  }
  return { ok: false as const, signerName: trim(row.holder_name) };
}

async function matchedSigner(sb: SupabaseClient, body: Json){
  const token = trim(body.token);
  if(!token) return { ok: false as const, response: json({ ok: false, error: "MISSING_TOKEN" }, 400) };
  const row = await loadByToken(sb, token, false);
  if(!row) return { ok: false as const, response: json({ ok: false, error: "NOT_FOUND" }, 404) };
  const gate = await publicGate(sb, body, row.link, token, false);
  if(!gate.ok) return { ok: false as const, response: gate.response };
  return { ok: true as const, token, row };
}

async function managerPreview(sb: SupabaseClient, body: Json, forms = false){
  if(!trim(body.pin) || !(trim(body.username) || trim(body.agentName))) return false;
  const auth = await requireManager(sb, body, forms);
  return auth.ok;
}

function openedPacket(token: string, row: { link: Json; packet: Json }, includePdf: boolean){
  const out: Json = {
    ok: true,
    token,
    status: trim(row.link.status) || "pending",
    signedAt: trim(row.link.signed_at),
    signerName: trim(row.link.signer_name),
    slot: trim(row.link.slot),
    box: row.link.box,
    customerName: trim(row.packet.customer_name),
    docName: trim(row.packet.doc_name),
    customerId: trim(row.packet.customer_id),
    docId: trim(row.packet.doc_id),
  };
  if(includePdf) out.pdfBase64 = trim(row.packet.pdf_base64);
  return json(out);
}

async function peekPacket(sb: SupabaseClient, body: Json){
  const token = trim(body.token);
  if(!token) return json({ ok: false, error: "MISSING_TOKEN" }, 400);
  const linkRes = await sb.from("gi_sign_links").select("signer_id,status,packet_id").eq("token", token).maybeSingle();
  if(linkRes.error || !linkRes.data) return json({ ok: false, error: "NOT_FOUND" }, 404);
  const link = linkRes.data as Json;
  const stored = digitsId(link.signer_id);
  if(!stored) return json({ ok: true, needsResend: true });
  if(trim(link.status) !== "signed"){
    const pack = await sb.from("gi_sign_packets").select("expires_at,created_at").eq("id", trim(link.packet_id)).maybeSingle();
    if(pack.data && packetExpired(pack.data as Json)) return json({ ok: true, expired: true });
  }
  return json({ ok: true, locked: true });
}

async function linkStatus(sb: SupabaseClient, body: Json){
  const token = trim(body.token);
  if(!token) return json({ ok: false, error: "MISSING_TOKEN" }, 400);
  const linkRes = await sb.from("gi_sign_links").select("status,signed_at").eq("token", token).maybeSingle();
  if(linkRes.error || !linkRes.data) return json({ ok: false, error: "NOT_FOUND" }, 404);
  const link = linkRes.data as Json;
  return json({
    ok: true,
    status: trim(link.status) || "pending",
    signedAt: trim(link.signed_at),
  });
}

async function getPacket(sb: SupabaseClient, body: Json){
  const token = trim(body.token);
  if(!token) return json({ ok: false, error: "MISSING_TOKEN" }, 400);
  const includePdf = body.includePdf !== false;
  const row = await loadByToken(sb, token, false);
  if(!row) return json({ ok: false, error: "NOT_FOUND" }, 404);
  const gate = await publicGate(sb, body, row.link, token, true);
  if(!gate.ok) return gate.response;
  if(gate.manager){
    const full = includePdf ? await loadByToken(sb, token, true) : row;
    return openedPacket(token, full || row, includePdf);
  }
  if(trim(row.link.status) === "signed"){
    const full = includePdf ? await loadByToken(sb, token, true) : row;
    return openedPacket(token, full || row, includePdf);
  }
  if(packetExpired(row.packet)) return expiredResponse();
  const claim = await claimHold(sb, trim(row.packet.id), token, trim(row.link.signer_name));
  if(!claim.ok) return waiting(claim.signerName);
  const openedAt = new Date().toISOString();
  await sb.from("gi_sign_links").update({ opened_at: openedAt, progress_at: openedAt }).eq("token", token).is("opened_at", null);
  const fresh = await loadByToken(sb, token, true);
  return openedPacket(token, fresh || row, true);
}

async function beatHold(sb: SupabaseClient, body: Json){
  const found = await matchedSigner(sb, body);
  if(!found.ok) return found.response;
  if(trim(found.row.link.status) === "signed") return json({ ok: true });
  if(packetExpired(found.row.packet)) return expiredResponse();
  const until = new Date(Date.now() + HOLD_MS).toISOString();
  const updated = await sb.from("gi_sign_packets").update({
    holder_until: until,
  }).eq("id", found.row.packet.id).eq("holder_token", found.token).select("id");
  if(!updated.error && Array.isArray(updated.data) && updated.data.length){
    const now = new Date().toISOString();
    const linkPatch: Json = { progress_at: now };
    const step = Math.round(Number(body.step) || 0);
    const total = Math.round(Number(body.total) || 0);
    if(step > 0) linkPatch.step_n = step;
    if(total > 0) linkPatch.step_total = total;
    await sb.from("gi_sign_links").update(linkPatch).eq("token", found.token);
    return json({ ok: true });
  }
  const current = await sb.from("gi_sign_packets").select("holder_name").eq("id", found.row.packet.id).maybeSingle();
  return waiting(trim((current.data as Json | null)?.holder_name));
}

async function releaseHold(sb: SupabaseClient, body: Json){
  const found = await matchedSigner(sb, body);
  if(!found.ok) return found.response;
  await sb.from("gi_sign_packets").update({
    holder_token: "",
    holder_name: "",
    holder_until: null,
  }).eq("id", found.row.packet.id).eq("holder_token", found.token);
  return json({ ok: true });
}

async function touchProgress(sb: SupabaseClient, body: Json){
  const found = await matchedSigner(sb, body);
  if(!found.ok) return found.response;
  if(packetExpired(found.row.packet) && trim(found.row.link.status) !== "signed") return expiredResponse();
  const step = Math.max(0, Math.round(Number(body.step) || 0));
  const total = Math.max(0, Math.round(Number(body.total) || 0));
  const now = new Date().toISOString();
  await sb.from("gi_sign_links").update({ opened_at: now }).eq("token", found.token).is("opened_at", null);
  await sb.from("gi_sign_links").update({
    progress_at: now,
    step_n: step,
    step_total: total,
  }).eq("token", found.token);
  return json({ ok: true });
}

async function boardLinks(sb: SupabaseClient, body: Json){
  const tokens = (Array.isArray(body.tokens) ? body.tokens : [])
    .map((token) => trim(token))
    .filter(Boolean)
    .slice(0, 40);
  if(!tokens.length) return json({ ok: true, links: [] });
  const res = await sb.from("gi_sign_links")
    .select("token,slot,signer_name,status,signed_at,opened_at,step_n,step_total,progress_at,survey,survey_at,packet:gi_sign_packets(expires_at,created_at)")
    .in("token", tokens);
  if(res.error) return json({ ok: false, error: "STATUS_FAILED" }, 500);
  const links = (Array.isArray(res.data) ? res.data as Json[] : []).map((row) => {
    const pack = row.packet && typeof row.packet === "object" ? row.packet as Json : {};
    return {
    token: trim(row.token),
    name: trim(row.signer_name),
    slot: trim(row.slot),
    status: trim(row.status) || "pending",
    signedAt: trim(row.signed_at),
    openedAt: trim(row.opened_at),
    progressAt: trim(row.progress_at),
    survey: trim(row.survey),
    surveyAt: trim(row.survey_at),
    step: Number(row.step_n) || 0,
    total: Number(row.step_total) || 0,
    expiresAt: trim(pack.expires_at),
    createdAt: trim(pack.created_at),
  };
  });
  return json({ ok: true, links });
}

async function submitSignature(sb: SupabaseClient, body: Json){
  const token = trim(body.token);
  const png = trim(body.pngBase64);
  if(!token || !png) return json({ ok: false, error: "MISSING_FIELDS" }, 400);
  const row = await loadByToken(sb, token);
  if(!row) return json({ ok: false, error: "NOT_FOUND" }, 404);
  const gate = await publicGate(sb, body, row.link, token, false);
  if(!gate.ok) return gate.response;
  if(trim(row.link.status) === "signed"){
    return json({
      ok: true,
      already: true,
      pdfBase64: trim(row.packet.pdf_base64),
      customerName: trim(row.packet.customer_name),
      docName: trim(row.packet.doc_name),
    });
  }
  if(packetExpired(row.packet)) return expiredResponse();
  const claim = await claimHold(sb, trim(row.packet.id), token, trim(row.link.signer_name));
  if(!claim.ok) return json({ ok: false, error: "WAITING", signerName: claim.signerName }, 409);
  const fresh = await loadByToken(sb, token, true);
  const source = fresh || row;
  const box = source.link.box && typeof source.link.box === "object" ? source.link.box as Json : {};
  const incoming = Array.isArray(body.stamps) ? body.stamps as Json[] : [];
  const pngs = incoming.map((row) => trim(row && (row as Json).pngBase64)).filter(Boolean);
  let stamped = "";
  try {
    stamped = await stampPdf(trim(source.packet.pdf_base64), pngs.length ? pngs : [png], box);
  } catch(_e) {
    return json({ ok: false, error: "STAMP_FAILED" }, 500);
  }
  const now = new Date().toISOString();
  const savedPdf = await sb.from("gi_sign_packets").update({
    pdf_base64: stamped,
    updated_at: now,
    holder_token: "",
    holder_name: "",
    holder_until: null,
  }).eq("id", source.packet.id).eq("holder_token", token).select("id");
  if(savedPdf.error || !Array.isArray(savedPdf.data) || !savedPdf.data.length){
    return json({ ok: false, error: "WAITING", signerName: claim.signerName }, 409);
  }
  const savedLink = await sb.from("gi_sign_links").update({ status: "signed", signed_at: now }).eq("token", token);
  if(savedLink.error) return json({ ok: false, error: "SAVE_FAILED" }, 500);
  const others = await sb.from("gi_sign_links").select("status").eq("packet_id", source.packet.id);
  const rows = Array.isArray(others.data) ? others.data as Json[] : [];
  const complete = rows.length > 0 && rows.every((item) => trim(item.status) === "signed");
  await broadcastSigned({
    customerId: trim(source.packet.customer_id),
    customerName: trim(source.packet.customer_name),
    docId: trim(source.packet.doc_id),
    docName: trim(source.packet.doc_name),
    senderId: trim(source.packet.sender_id),
    signerName: trim(source.link.signer_name),
    token,
    signedAt: now,
    complete,
  });
  return json({
    ok: true,
    pdfBase64: stamped,
    customerName: trim(row.packet.customer_name),
    docName: trim(row.packet.doc_name),
    customerId: trim(row.packet.customer_id),
    docId: trim(row.packet.doc_id),
  });
}

async function saveSurvey(sb: SupabaseClient, body: Json){
  const token = trim(body.token);
  const score = trim(body.survey);
  if(!token) return json({ ok: false, error: "MISSING_TOKEN" }, 400);
  if(score !== "good" && score !== "ok" && score !== "bad") return json({ ok: false, error: "MISSING_FIELDS" }, 400);
  const row = await loadByToken(sb, token);
  if(!row) return json({ ok: false, error: "NOT_FOUND" }, 404);
  if(trim(row.link.status) !== "signed") return json({ ok: false, error: "NOT_SIGNED" }, 409);
  const now = new Date().toISOString();
  const saved = await sb.from("gi_sign_links").update({ survey: score, survey_at: now }).eq("token", token).eq("status", "signed");
  if(saved.error) return json({ ok: false, error: "SAVE_FAILED" }, 500);
  return json({ ok: true, survey: score });
}

function isOgBot(ua: string){
  return /facebookexternalhit|Facebot|WhatsApp|Twitterbot|Slackbot|TelegramBot|Discordbot|LinkedInBot|Googlebot/i.test(ua);
}

function cardToken(url: URL){
  const parts = url.pathname.split("/").filter(Boolean);
  const cardAt = Math.max(parts.lastIndexOf("card"), parts.lastIndexOf("og"));
  if(cardAt >= 0 && parts[cardAt + 1]) return parts[cardAt + 1].replace(/\.(?:png|jpe?g)$/i, "");
  return trim(url.searchParams.get("card") || url.searchParams.get("token"));
}

function wantsImage(url: URL){
  const path = url.pathname.toLowerCase();
  return path.endsWith(".png") || path.endsWith(".jpg") || path.endsWith(".jpeg") || url.searchParams.get("img") === "1";
}

function htmlEsc(v: string){
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function serveCard(req: Request, sb: SupabaseClient){
  const url = new URL(req.url);
  const token = cardToken(url);
  if(!token) return json({ ok: false, error: "MISSING_TOKEN" }, 400);
  const linkRes = await sb.from("gi_sign_links")
    .select(wantsImage(url) ? "og_png" : "signer_name,open_href,og_png")
    .eq("token", token).maybeSingle();
  if(linkRes.error || !linkRes.data) return json({ ok: false, error: "NOT_FOUND" }, 404);
  const row = linkRes.data as Json;
  const openHref = trim(row.open_href);
  const name = trim(row.signer_name);
  const pageUrl = url.origin + "/functions/v1/gi-sign/card/" + encodeURIComponent(token);
  const rawPng = trim(row.og_png);
  const imageBytes = cardJpegBytes(rawPng);
  const imageType = imageBytes.length && imageContentType(imageBytes) === "image/jpeg" ? "image/jpeg" : "image/png";
  const imageExt = imageType === "image/jpeg" ? ".jpg" : ".png";
  const imageUrl = url.origin + "/functions/v1/gi-sign/og/" + encodeURIComponent(token) + imageExt;
  if(wantsImage(url)){
    return new Response(imageBytes, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": imageType,
        "Content-Length": String(imageBytes.length),
        "Cache-Control": "public, max-age=604800, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const ua = trim(req.headers.get("user-agent"));
  if(!isOgBot(ua) && openHref){
    return new Response(null, { status: 302, headers: { ...CORS, "Vary": "User-Agent", Location: openHref } });
  }
  const title = name ? ("שלום: " + name) : "שלום:";
  const html = `<!DOCTYPE html><html lang="he" dir="rtl"><head>
<meta charset="utf-8"/>
<title>${htmlEsc(title)}</title>
<meta property="og:title" content="${htmlEsc(title)}"/>
<meta property="og:type" content="website"/>
<meta property="og:locale" content="he_IL"/>
<meta property="og:url" content="${htmlEsc(pageUrl)}"/>
<meta property="og:image" content="${htmlEsc(imageUrl)}"/>
<meta property="og:image:secure_url" content="${htmlEsc(imageUrl)}"/>
<meta property="og:image:type" content="${htmlEsc(imageType)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="${htmlEsc(title)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${htmlEsc(title)}"/>
<meta name="twitter:image" content="${htmlEsc(imageUrl)}"/>
<link rel="image_src" href="${htmlEsc(imageUrl)}"/>
</head><body></body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "Vary": "User-Agent",
    },
  });
}

Deno.serve(async (req) => {
  if(req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sb = sbAdmin();
  if(req.method === "GET" || req.method === "HEAD"){
    try { return await serveCard(req, sb); }
    catch(_err) { return json({ ok: false, error: "FAILED" }, 500); }
  }
  if(req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);
  let body: Json = {};
  try { body = await req.json() as Json; } catch(_e) { body = {}; }
  const action = trim(body.action);
  try {
    if(action === "create_upload") return await createUpload(sb, body);
    if(action === "list_uploads") return await listUploads(sb, body);
    if(action === "send_cancel") return await sendCancel(sb, body);
    if(action === "create") return await createPacket(sb, body);
    if(action === "peek") return await peekPacket(sb, body);
    if(action === "status") return await linkStatus(sb, body);
    if(action === "get") return await getPacket(sb, body);
    if(action === "beat") return await beatHold(sb, body);
    if(action === "touch") return await touchProgress(sb, body);
    if(action === "board") return await boardLinks(sb, body);
    if(action === "release") return await releaseHold(sb, body);
    if(action === "submit") return await submitSignature(sb, body);
    if(action === "survey") return await saveSurvey(sb, body);
    return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch(_err) {
    return json({ ok: false, error: "FAILED" }, 500);
  }
});
