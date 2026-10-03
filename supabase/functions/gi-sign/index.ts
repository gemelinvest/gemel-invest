// GI-SIGN — cancel-form signature links.
// Create requires an admin/manager PIN. The public phone page only knows its token.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAGE_H = 841.89;
const HOLD_MS = 45000;

type Json = Record<string, unknown>;

function json(data: Json, status = 200){
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function trim(v: unknown){
  return String(v == null ? "" : v).trim();
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

function canSendFormsRole(role: string){
  if(canSendRole(role)) return true;
  const raw = trim(role);
  const r = raw.toLowerCase();
  return r === "ops" || r === "opsagent" || r === "ops_agent" || r === "operations"
    || raw === "תפעול" || raw === "מנהל תפעול" || raw === "נציג תפעול";
}

function b64ToBytes(raw: string){
  const clean = raw.replace(/^data:[^,]*,/, "").replace(/\s/g, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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

async function createPacket(sb: SupabaseClient, body: Json){
  const forms = trim(body.scope) === "forms";
  const auth = await requireManager(sb, body, forms);
  if(!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  const customerId = trim(body.customerId);
  const docId = trim(body.docId);
  const pdfBase64 = trim(body.pdfBase64);
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
    const idNumber = digitsId(signer.idNumber);
    if(!token || !name || !cells.length || !idNumber) return json({ ok: false, error: "MISSING_ID" }, 400);
    const first = cells[0];
    prepared.push({
      token,
      name,
      slot,
      idNumber,
      cell: { page: first.page, x0: first.x0, y0: first.y0, x1: first.x1, y1: first.y1, boxes: cells },
    });
  }
  const inserted = await sb.from("gi_sign_packets").insert({
    customer_id: customerId,
    doc_id: docId,
    doc_name: trim(body.docName),
    customer_name: trim(body.customerName),
    sender_id: trim(auth.agent.id),
    sender_name: trim(auth.agent.name),
    pdf_base64: pdfBase64,
  }).select("id").single();
  if(inserted.error || !inserted.data) return json({ ok: false, error: "SAVE_FAILED" }, 500);
  const packetId = trim((inserted.data as Json).id);
  const links = [];
  for(const row of prepared){
    const saved = await sb.from("gi_sign_links").insert({
      token: row.token,
      packet_id: packetId,
      slot: row.slot,
      signer_name: row.name,
      signer_id: row.idNumber,
      box: row.cell,
      status: "pending",
    });
    if(saved.error) return json({ ok: false, error: "LINK_FAILED" }, 500);
    links.push({ token: row.token, name: row.name, slot: row.slot, status: "pending" });
  }
  if(!links.length) return json({ ok: false, error: "NO_SIGNERS" }, 400);
  return json({
    ok: true,
    packetId,
    links,
    senderId: trim(auth.agent.id),
    senderName: trim(auth.agent.name),
  });
}

async function loadByToken(sb: SupabaseClient, token: string, includePdf = true){
  const linkRes = await sb.from("gi_sign_links").select("token,packet_id,slot,signer_name,signer_id,box,status,signed_at").eq("token", token).maybeSingle();
  if(linkRes.error || !linkRes.data) return null;
  const link = linkRes.data as Json;
  const packetCols = includePdf
    ? "id,customer_id,doc_id,doc_name,customer_name,sender_id,sender_name,pdf_base64"
    : "id,customer_id,doc_id,doc_name,customer_name,sender_id,sender_name";
  const packetRes = await sb.from("gi_sign_packets").select(packetCols).eq("id", link.packet_id).maybeSingle();
  if(packetRes.error || !packetRes.data) return null;
  return { link, packet: packetRes.data as Json };
}

function gateError(link: Json){
  const stored = digitsId(link.signer_id);
  if(!stored) return json({ ok: false, error: "NEEDS_RESEND" }, 403);
  return json({ ok: false, error: "ID_MISMATCH" }, 403);
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
  if(!idsMatch(body.idNumber, row.link.signer_id)){
    return { ok: false as const, response: gateError(row.link) };
  }
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
  const linkRes = await sb.from("gi_sign_links").select("signer_id").eq("token", token).maybeSingle();
  if(linkRes.error || !linkRes.data) return json({ ok: false, error: "NOT_FOUND" }, 404);
  const stored = digitsId((linkRes.data as Json).signer_id);
  if(!stored) return json({ ok: true, needsResend: true });
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
  const stored = digitsId(row.link.signer_id);
  const matched = !!stored && idsMatch(body.idNumber, stored);
  if(!matched){
    const agent = includePdf && await managerPreview(sb, body, true);
    if(!agent) return gateError(row.link);
    const full = includePdf ? await loadByToken(sb, token, true) : row;
    return openedPacket(token, full || row, includePdf);
  }
  if(trim(row.link.status) === "signed"){
    const full = includePdf ? await loadByToken(sb, token, true) : row;
    return openedPacket(token, full || row, includePdf);
  }
  const claim = await claimHold(sb, trim(row.packet.id), token, trim(row.link.signer_name));
  if(!claim.ok) return waiting(claim.signerName);
  const fresh = await loadByToken(sb, token, true);
  return openedPacket(token, fresh || row, true);
}

async function beatHold(sb: SupabaseClient, body: Json){
  const found = await matchedSigner(sb, body);
  if(!found.ok) return found.response;
  if(trim(found.row.link.status) === "signed") return json({ ok: true });
  const until = new Date(Date.now() + HOLD_MS).toISOString();
  const updated = await sb.from("gi_sign_packets").update({
    holder_until: until,
  }).eq("id", found.row.packet.id).eq("holder_token", found.token).select("id");
  if(!updated.error && Array.isArray(updated.data) && updated.data.length) return json({ ok: true });
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

async function submitSignature(sb: SupabaseClient, body: Json){
  const token = trim(body.token);
  const png = trim(body.pngBase64);
  if(!token || !png) return json({ ok: false, error: "MISSING_FIELDS" }, 400);
  const row = await loadByToken(sb, token);
  if(!row) return json({ ok: false, error: "NOT_FOUND" }, 404);
  const stored = digitsId(row.link.signer_id);
  if(!stored || !idsMatch(body.idNumber, stored)) return gateError(row.link);
  if(trim(row.link.status) === "signed"){
    return json({
      ok: true,
      already: true,
      pdfBase64: trim(row.packet.pdf_base64),
      customerName: trim(row.packet.customer_name),
      docName: trim(row.packet.doc_name),
    });
  }
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

Deno.serve(async (req) => {
  if(req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if(req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);
  let body: Json = {};
  try { body = await req.json() as Json; } catch(_e) { body = {}; }
  const sb = sbAdmin();
  const action = trim(body.action);
  try {
    if(action === "create") return await createPacket(sb, body);
    if(action === "peek") return await peekPacket(sb, body);
    if(action === "status") return await linkStatus(sb, body);
    if(action === "get") return await getPacket(sb, body);
    if(action === "beat") return await beatHold(sb, body);
    if(action === "release") return await releaseHold(sb, body);
    if(action === "submit") return await submitSignature(sb, body);
    return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch(err) {
    return json({ ok: false, error: trim((err as Error)?.message) || "FAILED" }, 500);
  }
});
