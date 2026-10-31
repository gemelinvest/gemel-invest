// Personal-area one-time code.
// The page sends an id and a phone. This function checks them against the
// customer file, emails a code to the address saved on that file, and only
// then opens the existing board. The birth date stays on the file: the
// customer does not type it.
//
// The code is stored as HMAC-SHA256 with the service-role key as the pepper,
// on app_meta key onyx-portal-codes (not the 3MB global row). A 6-digit code
// is never written in plaintext. The pass used for documents is a long random
// token; only its SHA-256 is stored.
//
// Deploy is .github/workflows/deploy-portal-code.yml on push to main.
// verify_jwt stays false: the customer has no agent session.

import { createClient } from "jsr:@supabase/supabase-js@2.49.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM = "bituliimp@gmail.com";
const META_KEY = "onyx-portal-codes";
const CODE_MS = 10 * 60 * 1000;
const PASS_MS = 12 * 60 * 60 * 1000;
const COOL_MS = 60 * 1000;
const MAX_TRIES = 5;

type Json = Record<string, any>;

function json(data: Json, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function trim(value: unknown) {
  return String(value == null ? "" : value).trim();
}

function portalId(value: unknown) {
  return trim(value).replace(/\D/g, "").replace(/^0+/, "");
}

function portalPhone(value: unknown) {
  let digits = trim(value).replace(/\D/g, "");
  if (digits.startsWith("972")) digits = digits.slice(3);
  return digits.replace(/^0+/, "");
}

function mailAddr(value: unknown) {
  const text = trim(value).toLowerCase();
  return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(text) ? text : "";
}

function maskEmail(email: string) {
  const at = email.indexOf("@");
  if (at < 1) return "";
  return email.slice(0, 1) + "***" + email.slice(at);
}

function same(left: string, right: string) {
  if (left.length !== right.length) return false;
  let out = 0;
  for (let i = 0; i < left.length; i += 1) out |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return out === 0;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(sig));
}

function sixDigits() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1000000).padStart(6, "0");
}

function passToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function sbAdmin() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function pepper() {
  return trim(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
}

function gmailPassword() {
  return trim(Deno.env.get("GMAIL_APP_PASSWORD") || Deno.env.get("GMAIL_SMTP_PASSWORD")).replace(/\s+/g, "");
}

function asObject(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function primaryOf(payload: Json) {
  const primary = asObject(payload.primary);
  if (Object.keys(primary).length) return primary;
  const operational = asObject(payload.operational);
  return asObject(operational.primary);
}

function insuredRows(payload: Json) {
  const direct = Array.isArray(payload.insureds) ? payload.insureds : [];
  if (direct.length) return direct;
  const operational = asObject(payload.operational);
  return Array.isArray(operational.insureds) ? operational.insureds : [];
}

function personData(row: unknown) {
  const rec = asObject(row);
  return asObject(rec.data);
}

function identityOk(cust: Json, idRaw: string, phoneRaw: string) {
  const givenId = portalId(idRaw);
  const givenPhone = portalPhone(phoneRaw);
  if (givenId.length < 5 || givenPhone.length < 8) return false;
  const payload = asObject(cust.payload);
  const primary = primaryOf(payload);
  let idOk = portalId(cust.id_number) === givenId || portalId(primary.idNumber) === givenId;
  let phoneOk = portalPhone(cust.phone) === givenPhone || portalPhone(primary.phone) === givenPhone;
  insuredRows(payload).forEach((row) => {
    const data = personData(row);
    if (portalId(data.idNumber) === givenId) idOk = true;
    if (portalPhone(data.phone) === givenPhone) phoneOk = true;
  });
  return idOk && phoneOk;
}

function birthOf(cust: Json, idRaw: string) {
  const givenId = portalId(idRaw);
  const payload = asObject(cust.payload);
  const primary = primaryOf(payload);
  const hits: string[] = [];
  const primaryBirth = trim(primary.birthDate || primary.birth_date);
  if (portalId(primary.idNumber) === givenId && primaryBirth) hits.push(primaryBirth);
  insuredRows(payload).forEach((row) => {
    const data = personData(row);
    const birth = trim(data.birthDate || data.birth_date);
    if (portalId(data.idNumber) === givenId && birth) hits.push(birth);
  });
  if (hits.length) return hits[0];
  if (portalId(cust.id_number) === givenId && primaryBirth) return primaryBirth;
  return primaryBirth;
}

function oneLine(value: unknown) {
  return trim(value).replace(/[\r\n]+/g, " ");
}

function customerName(cust: Json) {
  const direct = oneLine(cust.full_name);
  if (direct) return direct;
  const primary = primaryOf(asObject(cust.payload));
  const composed = oneLine(oneLine(primary.firstName) + " " + oneLine(primary.lastName));
  if (composed) return composed;
  return oneLine(primary.fullName || primary.name);
}

function emailOf(cust: Json) {
  const direct = mailAddr(cust.email);
  if (direct) return direct;
  const payload = asObject(cust.payload);
  const primary = primaryOf(payload);
  const fromPrimary = mailAddr(primary.email);
  if (fromPrimary) return fromPrimary;
  for (const row of insuredRows(payload)) {
    const found = mailAddr(personData(row).email);
    if (found) return found;
  }
  return "";
}

async function loadCustomer(sb: ReturnType<typeof sbAdmin>, portalCode: string) {
  const portal = await sb.from("onyx_customer_portals").select("code,customer_id,enabled").eq("code", portalCode).maybeSingle();
  if (portal.error) return { error: "LOOKUP" as const };
  if (!portal.data) return { error: "MISSING" as const };
  if (portal.data.enabled !== true) return { error: "CLOSED" as const };
  const cust = await sb.from("customers").select("id,full_name,id_number,phone,email,payload").eq("id", portal.data.customer_id).maybeSingle();
  if (cust.error) return { error: "LOOKUP" as const };
  if (!cust.data) return { error: "MISSING" as const };
  return { customer: cust.data as Json };
}

function prune(box: Json, now: number) {
  const pending = asObject(box.pending);
  const passes = asObject(box.passes);
  const nextPending: Json = {};
  const nextPasses: Json = {};
  Object.keys(pending).forEach((key) => {
    const row = asObject(pending[key]);
    if (Number(row.exp) > now) nextPending[key] = row;
  });
  Object.keys(passes).forEach((key) => {
    const row = asObject(passes[key]);
    if (Number(row.exp) > now) nextPasses[key] = row;
  });
  return { pending: nextPending, passes: nextPasses };
}

async function readBox(sb: ReturnType<typeof sbAdmin>) {
  const res = await sb.from("app_meta").select("payload,updated_at").eq("key", META_KEY).maybeSingle();
  if (res.error) throw new Error(res.error.message || "meta");
  return {
    payload: prune(asObject(res.data && res.data.payload), Date.now()),
    updatedAt: res.data ? res.data.updated_at : null,
    exists: !!res.data,
  };
}

async function writeBox(sb: ReturnType<typeof sbAdmin>, payload: Json) {
  const row = { key: META_KEY, payload, updated_at: new Date().toISOString() };
  const base = trim(Deno.env.get("SUPABASE_URL")).replace(/\/$/, "");
  const keys = [pepper(), trim(Deno.env.get("SUPABASE_ANON_KEY"))].filter((value, index, list) => value && list.indexOf(value) === index);
  for (const apiKey of keys) {
    try {
      const res = await fetch(base + "/rest/v1/app_meta?on_conflict=key", {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(row),
      });
      if (res.ok) return true;
    } catch (_err) {
      /* try the next key */
    }
  }
  const saved = await sb.from("app_meta").upsert(row, { onConflict: "key" });
  return !saved.error;
}

function smtpB64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function rfc2047(value: string) {
  return "=?UTF-8?B?" + smtpB64(value) + "?=";
}

function foldB64(raw: string) {
  const lines: string[] = [];
  for (let i = 0; i < raw.length; i += 76) lines.push(raw.slice(i, i + 76));
  return lines.join("\r\n");
}

async function smtpRead(conn: Deno.Conn, acc: { buf: string }) {
  const decoder = new TextDecoder();
  while (true) {
    const nl = acc.buf.indexOf("\n");
    if (nl < 0) {
      const chunk = new Uint8Array(4096);
      const n = await conn.read(chunk);
      if (n == null) throw new Error("SMTP_CLOSED");
      acc.buf += decoder.decode(chunk.subarray(0, n));
      continue;
    }
    const raw = acc.buf.slice(0, nl).replace(/\r$/, "");
    acc.buf = acc.buf.slice(nl + 1);
    if (/^[0-9]{3}-/.test(raw)) continue;
    if (/^[0-9]{3}([\s].*)?$/.test(raw)) return { code: Number(raw.slice(0, 3)) };
  }
}

async function writeAll(conn: Deno.Conn, text: string) {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  while (offset < bytes.length) {
    const wrote = await conn.write(bytes.subarray(offset));
    if (!wrote) throw new Error("SMTP_WRITE");
    offset += wrote;
  }
}

async function smtpCmd(conn: Deno.Conn, acc: { buf: string }, line?: string) {
  if (line != null) await writeAll(conn, line + "\r\n");
  return await smtpRead(conn, acc);
}

async function sendCode(to: string, name: string, code: string, password: string) {
  const who = trim(name);
  const body = [
    who ? "שלום: " + who : "שלום,",
    "",
    "קוד הכניסה לאזור האישי שלך הוא: " + code,
    "",
    "הקוד תקף ל-10 דקות ונועד לכניסה אחת.",
    "אם לא ביקשתם את הקוד, אפשר להתעלם מההודעה.",
  ].join("\r\n");
  const message = [
    "From: " + FROM,
    "To: " + to,
    "Subject: " + rfc2047("קוד כניסה לאזור האישי"),
    "MIME-Version: 1.0",
    "Date: " + new Date().toUTCString(),
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    foldB64(smtpB64(body)),
    "",
  ].join("\r\n");
  const conn = await Deno.connectTls({ hostname: "smtp.gmail.com", port: 465 });
  const acc = { buf: "" };
  try {
    const greet = await smtpCmd(conn, acc);
    if (greet.code !== 220) return false;
    let reply = await smtpCmd(conn, acc, "EHLO gemelinvest");
    if (reply.code !== 250) return false;
    reply = await smtpCmd(conn, acc, "AUTH LOGIN");
    if (reply.code === 334) {
      reply = await smtpCmd(conn, acc, smtpB64(FROM));
      if (reply.code !== 334) return false;
      reply = await smtpCmd(conn, acc, smtpB64(password));
    } else {
      reply = await smtpCmd(conn, acc, "AUTH PLAIN " + smtpB64("\0" + FROM + "\0" + password));
    }
    if (reply.code !== 235) return false;
    reply = await smtpCmd(conn, acc, "MAIL FROM:<" + FROM + ">");
    if (reply.code !== 250) return false;
    reply = await smtpCmd(conn, acc, "RCPT TO:<" + to + ">");
    if (reply.code !== 250) return false;
    reply = await smtpCmd(conn, acc, "DATA");
    if (reply.code !== 354) return false;
    const stuffed = message.split(/\r?\n/).map((line) => line.startsWith(".") ? "." + line : line).join("\r\n");
    reply = await smtpCmd(conn, acc, stuffed + "\r\n.");
    if (reply.code === 354) reply = await smtpRead(conn, acc);
    if (reply.code !== 250) return false;
    try { await smtpCmd(conn, acc, "QUIT"); } catch (_err) { /* the message was already accepted */ }
    return true;
  } finally {
    try { conn.close(); } catch (_err) { /* closed */ }
  }
}

async function openBoard(sb: ReturnType<typeof sbAdmin>, portalCode: string, idRaw: string, phoneRaw: string, birth: string, which: "open" | "doc", doc: string) {
  if (which === "doc") {
    const res = await sb.rpc("onyx_customer_portal_doc", {
      p_code: portalCode,
      p_id: idRaw,
      p_phone: phoneRaw,
      p_birth: birth,
      p_doc: doc,
    });
    if (res.error || !res.data) return { ok: false, error: "BOARD" };
    return res.data as Json;
  }
  const res = await sb.rpc("onyx_customer_portal_open", {
    p_code: portalCode,
    p_id: idRaw,
    p_phone: phoneRaw,
    p_birth: birth,
  });
  if (res.error || !res.data) return { ok: false, error: "BOARD" };
  return res.data as Json;
}

async function withPass(sb: ReturnType<typeof sbAdmin>, portalCode: string, token: string) {
  const hash = await sha256(token);
  let row: Json | null = null;
  for (let attempt = 0; attempt < 2 && !row; attempt += 1) {
    const box = await readBox(sb);
    row = asObject(box.payload.passes)[hash] || null;
    if (!row) return { error: "EXPIRED" as const };
    if (trim(row.code) !== portalCode || Number(row.exp) <= Date.now()) return { error: "EXPIRED" as const };
  }
  if (!row) return { error: "EXPIRED" as const };
  const loaded = await loadCustomer(sb, portalCode);
  if (loaded.error || !loaded.customer) return { error: loaded.error || "MISSING" as const };
  const idRaw = trim(row.id);
  const phoneRaw = trim(row.phone);
  if (!identityOk(loaded.customer, idRaw, phoneRaw)) return { error: "MISMATCH" as const };
  const birth = birthOf(loaded.customer, idRaw);
  if (!birth) return { error: "NO_BIRTH" as const };
  return { customer: loaded.customer, idRaw, phoneRaw, birth };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);
  let body: Json = {};
  try {
    body = await req.json();
  } catch (_err) {
    return json({ ok: false, error: "INVALID_JSON" }, 400);
  }
  const action = trim(body.action);
  const portalCode = trim(body.portal).slice(0, 40);
  if (!portalCode) return json({ ok: false, error: "MISSING" }, 400);
  const secret = pepper();
  if (!secret) return json({ ok: false, error: "MAIL" }, 500);
  const sb = sbAdmin();

  try {
    if (action === "start") {
      const idRaw = trim(body.id).slice(0, 16);
      const phoneRaw = trim(body.phone).slice(0, 16);
      const loaded = await loadCustomer(sb, portalCode);
      if (loaded.error || !loaded.customer) return json({ ok: false, error: loaded.error || "MISSING" });
      if (!identityOk(loaded.customer, idRaw, phoneRaw)) return json({ ok: false, error: "MISMATCH" });
      const birth = birthOf(loaded.customer, idRaw);
      if (!birth) return json({ ok: false, error: "NO_BIRTH" });
      const email = emailOf(loaded.customer);
      if (!email) return json({ ok: false, error: "NO_EMAIL" });
      const password = gmailPassword();
      if (!password) return json({ ok: false, error: "MAIL" }, 500);
      const normId = portalId(idRaw);
      const normPhone = portalPhone(phoneRaw);
      const now = Date.now();
      const first = await readBox(sb);
      const pending = asObject(asObject(first.payload.pending)[portalCode]);
      if (pending.mac && Number(pending.exp) > now && now - Number(pending.sentAt) < COOL_MS && trim(pending.id) === normId && trim(pending.phone) === normPhone) {
        return json({ ok: true, masked: maskEmail(email), wait: true });
      }
      const otp = sixDigits();
      const mac = await hmac(secret, portalCode + "|" + normId + "|" + normPhone + "|" + otp);
      const sent = await sendCode(email, customerName(loaded.customer), otp, password);
      if (!sent) return json({ ok: false, error: "MAIL" });
      const row = { id: normId, phone: normPhone, mac, exp: now + CODE_MS, sentAt: now, tries: 0 };
      let current = first;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await writeBox(sb, {
          pending: { ...asObject(current.payload.pending), [portalCode]: row },
          passes: asObject(current.payload.passes),
        });
        const check = await readBox(sb);
        const stored = asObject(asObject(check.payload.pending)[portalCode]);
        if (trim(stored.mac) === mac) return json({ ok: true, masked: maskEmail(email) });
        current = check;
      }
      return json({ ok: false, error: "MAIL" });
    }

    if (action === "verify") {
      const idRaw = trim(body.id).slice(0, 16);
      const phoneRaw = trim(body.phone).slice(0, 16);
      const otp = trim(body.otp).replace(/\D/g, "");
      if (otp.length !== 6) return json({ ok: false, error: "BAD_CODE" });
      const normId = portalId(idRaw);
      const normPhone = portalPhone(phoneRaw);
      const mac = await hmac(secret, portalCode + "|" + normId + "|" + normPhone + "|" + otp);
      let matched = false;
      for (let attempt = 0; attempt < 2 && !matched; attempt += 1) {
        const box = await readBox(sb);
        const pending = asObject(asObject(box.payload.pending)[portalCode]);
        if (!pending.mac || Number(pending.exp) <= Date.now()) return json({ ok: false, error: "EXPIRED" });
        if (trim(pending.id) !== normId || trim(pending.phone) !== normPhone) return json({ ok: false, error: "BAD_CODE" });
        if (Number(pending.tries) >= MAX_TRIES) {
          const cleared = { pending: { ...asObject(box.payload.pending) }, passes: asObject(box.payload.passes) };
          delete cleared.pending[portalCode];
          await writeBox(sb, cleared);
          return json({ ok: false, error: "LOCKED" });
        }
        if (!same(trim(pending.mac), mac)) {
          const nextPending = { ...pending, tries: Number(pending.tries) + 1 };
          const saved = await writeBox(sb, {
            pending: { ...asObject(box.payload.pending), [portalCode]: nextPending },
            passes: asObject(box.payload.passes),
          });
          if (saved) return json({ ok: false, error: nextPending.tries >= MAX_TRIES ? "LOCKED" : "BAD_CODE" });
          continue;
        }
        const loaded = await loadCustomer(sb, portalCode);
        if (loaded.error || !loaded.customer) return json({ ok: false, error: loaded.error || "MISSING" });
        if (!identityOk(loaded.customer, idRaw, phoneRaw)) return json({ ok: false, error: "MISMATCH" });
        const birth = birthOf(loaded.customer, idRaw);
        if (!birth) return json({ ok: false, error: "NO_BIRTH" });
        const board = await openBoard(sb, portalCode, idRaw, phoneRaw, birth, "open", "");
        if (board.ok !== true) return json({ ok: false, error: trim(board.error) || "MISMATCH" });
        const token = passToken();
        const hash = await sha256(token);
        const passes = { ...asObject(box.payload.passes), [hash]: { code: portalCode, id: idRaw, phone: phoneRaw, exp: Date.now() + PASS_MS } };
        const pendingLeft = { ...asObject(box.payload.pending) };
        delete pendingLeft[portalCode];
        const saved = await writeBox(sb, { pending: pendingLeft, passes });
        if (!saved) continue;
        matched = true;
        return json({ ...board, ok: true, pass: token });
      }
      return json({ ok: false, error: "BAD_CODE" });
    }

    if (action === "open" || action === "doc") {
      const token = trim(body.pass);
      if (token.length < 32) return json({ ok: false, error: "EXPIRED" });
      const gate = await withPass(sb, portalCode, token);
      if (gate.error || !gate.customer) return json({ ok: false, error: gate.error || "EXPIRED" });
      const board = await openBoard(sb, portalCode, gate.idRaw, gate.phoneRaw, gate.birth, action === "doc" ? "doc" : "open", trim(body.doc).slice(0, 80));
      if (board.ok !== true) return json({ ok: false, error: trim(board.error) || "MISMATCH" });
      return json(board);
    }

    return json({ ok: false, error: "METHOD" }, 400);
  } catch (_err) {
    return json({ ok: false, error: "LOOKUP" }, 500);
  }
});
