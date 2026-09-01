// GI-DAILY-SALES-MAIL — reconstructed 2026-08-26, scheduler restored 2026-09-01
// Original function was not in the git repo. This rewrite keeps the live
// contract (status / save-snapshot / send-now / send-slot / save-azure /
// oauth-start / disconnect + GET OAuth callback) and fixes the bug that
// kept the first PDF of the Israel day forever, so extras never reached Outlook.
//
// Keep rule (fixed): skip overwrite only when a PDF is already stored AND
// the incoming body has no valid PDF. User refresh / send-now with a real
// PDF always replaces. send-now prefers the request snapshot when present.
//
// Scheduler: send-slot at 12:30 / 15:00 / 20:00 Asia/Jerusalem. Hosted
// Supabase does not support Deno.cron; register it anyway if the runtime
// has it, and rely on .github/workflows/daily-sales-mail.yml (UTC 09:30,
// 12:00, 17:00 plus winter-offset times, gated on Israel local time).

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const MIN_PDF_CHARS = 10000;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const GRAPH_SCOPE = "offline_access User.Read Mail.Send";
const OAUTH_REDIRECT = () => {
  const url = Deno.env.get("SUPABASE_URL") || "";
  return url.replace(/\/+$/, "") + "/functions/v1/gi-daily-sales-mail";
};

type Json = Record<string, unknown>;

function json(data: Json, status = 200){
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function html(body: string, status = 200){
  return new Response(body, {
    status,
    headers: { ...CORS, "Content-Type": "text/html; charset=utf-8" },
  });
}

function trim(v: unknown){
  return String(v == null ? "" : v).trim();
}

function roleCode(raw: unknown){
  return trim(raw).toLowerCase().replace(/[\s_-]+/g, "");
}

function isMailAdminRole(raw: unknown){
  const role = roleCode(raw);
  return role === "admin" || role === "owner" || role === "manager" || role === "adminlite"
    || role === "מנהל" || role === "מנהלמערכת" || role === "מפתחהמערכת" || trim(raw) === "מנהל";
}

function isMailAdmin(body: Json){
  if(isMailAdminRole(body.actorRole)) return true;
  const name = trim(body.actorName);
  return name === "מנהל מערכת" || name === "מפתח המערכת" || name === "אוריה סומך"
    || name === "איתי סומך" || name === "סוניה ארנשטיין" || name.indexOf("סטס") === 0;
}

function israelDateKey(d = new Date()){
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function dateKeyLabel(dateKey: string){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trim(dateKey));
  if(!m) return dateKey;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function stripPdf(raw: unknown){
  let s = trim(raw);
  const comma = s.indexOf(",");
  if(/^data:application\/pdf;base64,/i.test(s) && comma >= 0) s = s.slice(comma + 1);
  return s.replace(/\s+/g, "");
}

function pdfOk(raw: unknown){
  return stripPdf(raw).length >= MIN_PDF_CHARS;
}

function sbAdmin(){
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

async function loadAccount(sb: SupabaseClient){
  const { data, error } = await sb.from("gi_daily_sales_mail_account").select("*").limit(1);
  if(error) throw new Error(error.message);
  return (data && data[0]) || null;
}

async function upsertAccount(sb: SupabaseClient, patch: Json){
  const existing = await loadAccount(sb);
  const row = {
    ...(existing || { id: "default" }),
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from("gi_daily_sales_mail_account").upsert(row);
  if(error) throw new Error(error.message);
  return row;
}

async function loadSnapshot(sb: SupabaseClient, dateKey: string){
  const { data, error } = await sb.from("gi_daily_sales_mail_snapshots")
    .select("date_key, date_label, html, summary, pdf_base64, pdf_name, updated_at")
    .eq("date_key", dateKey)
    .maybeSingle();
  if(error) throw new Error(error.message);
  return data;
}

function snapshotFromBody(body: Json, fallbackDateKey: string){
  const htmlBody = String(body.html || "");
  const pdfBase64 = stripPdf(body.pdfBase64 || body.pdf_base64);
  if(!htmlBody && !pdfBase64) return null;
  const summary = (body.summary && typeof body.summary === "object")
    ? { ...(body.summary as Json) }
    : {};
  return {
    date_key: trim(body.dateKey) || fallbackDateKey,
    date_label: trim(body.dateLabel) || trim(body.dateKey) || fallbackDateKey,
    html: htmlBody,
    summary,
    pdf_base64: pdfBase64,
    pdf_name: trim(body.pdfName) || `מכירות-היום-${trim(body.dateKey) || fallbackDateKey}.pdf`,
    updated_at: new Date().toISOString(),
  };
}

function shouldKeepExisting(existing: { pdf_base64?: string } | null, incomingPdf: string, force: boolean){
  const haveStoredPdf = trim(existing?.pdf_base64).length >= MIN_PDF_CHARS;
  if(!haveStoredPdf) return false;
  if(force && pdfOk(incomingPdf)) return false;
  if(pdfOk(incomingPdf)) return false;
  return true;
}

function snapshotHasNewLayout(html: unknown){
  const s = String(html || "");
  if(!s) return false;
  if(s.indexOf("מוצגים רק נציגים עם מכירה") >= 0) return false;
  if(s.indexOf("נציגים שמכרו היום") >= 0) return false;
  if(s.indexOf("פוליסות בריאות + פרט") >= 0) return false;
  return s.indexOf("מכירות מודיעין") >= 0
    && s.indexOf("מכירות חיפה") >= 0
    && s.indexOf("לידים שויכו") >= 0
    && s.indexOf("פרמייה מהפקה") >= 0;
}

const OLD_LAYOUT_ERROR = "הדוח השמור הוא תבנית ישנה (בלי מכירות חיפה / מודיעין / לידים). רעננו את ה-CRM ב־Ctrl+F5 ולחצו «רענן דוח להיום».";
const NO_SNAPSHOT_ERROR = "אין דוח שמור להיום. לחצו «רענן דוח להיום».";
const NO_OUTLOOK_ERROR = "מייל Outlook לא מחובר";
const NO_RECIPIENTS_ERROR = "לא נמצאו מיילים שמורים למנהל / מנהל מערכת.";
const ALREADY_SENT_ERROR = "הדוח כבר נשלח בחלון השעה הזו.";
const SENT_WITHOUT_PDF = "נשלח בלי קובץ PDF — אין PDF שמור להיום.";
const SLOT_DEDUP_MS = 90 * 60 * 1000;
const SLOT_CRONS: readonly [string, string][] = [
  ["gi-daily-sales-mail-1230", "30 9 * * *"],
  ["gi-daily-sales-mail-1500", "0 12 * * *"],
  ["gi-daily-sales-mail-2000", "0 17 * * *"],
];

async function listRecipients(sb: SupabaseClient){
  const [{ data: agents, error: agentsErr }, { data: metaRows, error: metaErr }] = await Promise.all([
    sb.from("agents").select("id, name, role, email, active"),
    sb.from("app_meta").select("payload").eq("key", "global").limit(1),
  ]);
  if(agentsErr) throw new Error(agentsErr.message);
  if(metaErr) throw new Error(metaErr.message);
  const security = (metaRows && metaRows[0] && (metaRows[0] as Json).payload
    && ((metaRows[0] as Json).payload as Json).agentSecurity)
    ? ((metaRows[0] as Json).payload as Json).agentSecurity as Record<string, Json>
    : {};
  const out: { id: string; name: string; email: string; role: string }[] = [];
  for(const raw of (agents || [])){
    const a = raw as Json;
    if(a.active === false) continue;
    if(!isMailAdminRole(a.role) && !isMailAdmin({ actorName: a.name, actorRole: a.role })) continue;
    const sec = security[trim(a.id)] || {};
    const email = trim(a.email) || trim(sec.authEmail);
    if(!email || email.indexOf("@") < 0) continue;
    out.push({
      id: trim(a.id),
      name: trim(a.name) || "מנהל",
      email,
      role: trim(a.role) || "manager",
    });
  }
  return out;
}

async function graphToken(account: Json){
  const tenant = trim(account.ms_tenant_id) || "common";
  const clientId = trim(account.ms_client_id);
  const clientSecret = trim(account.ms_client_secret);
  const refresh = trim(account.refresh_token);
  if(!clientId || !refresh) throw new Error("מייל Outlook לא מחובר");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refresh,
    grant_type: "refresh_token",
    scope: GRAPH_SCOPE,
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json() as Json;
  if(!res.ok || !data.access_token){
    throw new Error(trim(data.error_description) || trim(data.error) || "רענון טוקן Outlook נכשל");
  }
  return data;
}

async function sendGraph(account: Json, snap: Json, recipients: { name: string; email: string }[]){
  const tokenData = await graphToken(account);
  const access = trim(tokenData.access_token);
  const dateKey = trim(snap.date_key);
  const dateLabel = trim(snap.date_label) || dateKeyLabel(dateKey);
  const subject = `GEMEL INVEST · מכירות היום · ${dateKeyLabel(dateKey)}`;
  const pdf = stripPdf(snap.pdf_base64);
  const attachments = pdfOk(pdf)
    ? [{
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: trim(snap.pdf_name) || `מכירות-היום-${dateKey}.pdf`,
      contentType: "application/pdf",
      contentBytes: pdf,
    }]
    : [];
  const payload = {
    message: {
      subject,
      body: {
        contentType: "HTML",
        content: String(snap.html || "<p dir=\"rtl\">דוח המכירות מצורף כקובץ PDF.</p>"),
      },
      toRecipients: recipients.map((r) => ({
        emailAddress: { address: r.email, name: r.name },
      })),
      attachments,
    },
    saveToSentItems: true,
  };
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + access,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if(!res.ok){
    let detail = "";
    try { detail = await res.text(); } catch(_e) { detail = ""; }
    throw new Error(detail || ("שליחת Outlook נכשלה " + res.status));
  }
  return { access, tokenData };
}

async function logSend(sb: SupabaseClient, dateKey: string, status: string, error: string | null, toEmails: string[]){
  try {
    const { error: insertErr } = await sb.from("gi_daily_sales_mail_log").insert({
      date_key: dateKey,
      status,
      error,
      sent_at: new Date().toISOString(),
      to_emails: toEmails,
    });
    if(insertErr) console.error("gi-daily-sales-mail logSend", insertErr.message);
  } catch(err) {
    console.error("gi-daily-sales-mail logSend", err);
  }
}

async function recentSlotSend(sb: SupabaseClient, dateKey: string){
  const { data } = await sb.from("gi_daily_sales_mail_log")
    .select("status, sent_at")
    .eq("date_key", dateKey)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1);
  const row = data && data[0];
  if(!row?.sent_at) return false;
  const at = Date.parse(String(row.sent_at));
  if(!Number.isFinite(at)) return false;
  return (Date.now() - at) < SLOT_DEDUP_MS;
}

async function lastSend(sb: SupabaseClient){
  const { data } = await sb.from("gi_daily_sales_mail_log")
    .select("status, error, sent_at")
    .order("sent_at", { ascending: false })
    .limit(1);
  const row = data && data[0];
  if(!row) return null;
  return { status: row.status, at: row.sent_at, error: row.error || null };
}

async function handleStatus(sb: SupabaseClient){
  const [account, todaySnap, recipients, send] = await Promise.all([
    loadAccount(sb),
    loadSnapshot(sb, israelDateKey()),
    listRecipients(sb),
    lastSend(sb),
  ]);
  const summary = (todaySnap && todaySnap.summary && typeof todaySnap.summary === "object")
    ? todaySnap.summary as Json
    : {};
  return json({
    ok: true,
    azureReady: !!(account && trim(account.ms_client_id)),
    connectedEmail: trim(account?.connected_email) || "",
    redirectUri: OAUTH_REDIRECT(),
    recipients,
    snapshotDateKey: todaySnap?.date_key || "",
    snapshotAt: todaySnap?.updated_at || "",
    hasPdf: pdfOk(todaySnap?.pdf_base64),
    snapshotLayout: trim(summary.layout),
    lastSend: send,
  });
}

async function handleSaveSnapshot(sb: SupabaseClient, body: Json){
  const today = israelDateKey();
  const incoming = snapshotFromBody(body, today);
  if(!incoming) return json({ ok: false, error: "חסר תוכן דוח" }, 400);
  if(incoming.html && !snapshotHasNewLayout(incoming.html)){
    return json({ ok: false, error: OLD_LAYOUT_ERROR }, 400);
  }
  const dateKey = incoming.date_key || today;
  const existing = await loadSnapshot(sb, dateKey);
  const force = body.force === true || body.replace === true;
  if(shouldKeepExisting(existing, incoming.pdf_base64, force)){
    return json({
      ok: true,
      dateKey,
      kept: true,
      hasPdf: pdfOk(existing?.pdf_base64),
      replaced: false,
    });
  }
  const row = {
    date_key: dateKey,
    date_label: incoming.date_label,
    html: incoming.html || existing?.html || "",
    summary: incoming.summary || existing?.summary || {},
    pdf_base64: pdfOk(incoming.pdf_base64) ? incoming.pdf_base64 : (existing?.pdf_base64 || ""),
    pdf_name: incoming.pdf_name || existing?.pdf_name || "",
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from("gi_daily_sales_mail_snapshots").upsert(row);
  if(error) throw new Error(error.message);
  return json({
    ok: true,
    dateKey,
    kept: false,
    hasPdf: pdfOk(row.pdf_base64),
    replaced: true,
    snapshotAt: row.updated_at,
  });
}

async function handleSendNow(sb: SupabaseClient, body: Json, opts: { scheduled?: boolean } = {}){
  const scheduled = opts.scheduled === true;
  const today = israelDateKey();
  const fromBody = scheduled ? null : snapshotFromBody(body, today);
  const stored = await loadSnapshot(sb, (fromBody && fromBody.date_key) || today);
  const useRequest = !!(!scheduled && fromBody && (fromBody.html || pdfOk(fromBody.pdf_base64)));
  const snap = useRequest ? fromBody : stored;
  const dateKey = trim(snap?.date_key) || today;

  const finishSkip = async (msg: string, emails: string[] = []) => {
    await logSend(sb, dateKey, "skipped", msg, emails);
    if(scheduled) return json({ ok: true, skipped: true, error: msg, dateKey });
    return json({ ok: false, error: msg }, 400);
  };

  if(!snap || (!snap.html && !pdfOk(snap.pdf_base64))){
    return await finishSkip(NO_SNAPSHOT_ERROR);
  }
  if(!snapshotHasNewLayout(snap.html)){
    return await finishSkip(OLD_LAYOUT_ERROR);
  }
  if(scheduled && await recentSlotSend(sb, dateKey)){
    return await finishSkip(ALREADY_SENT_ERROR);
  }
  if(useRequest && fromBody && pdfOk(fromBody.pdf_base64)){
    await sb.from("gi_daily_sales_mail_snapshots").upsert({
      ...fromBody,
      updated_at: new Date().toISOString(),
    });
  }
  const account = await loadAccount(sb);
  if(!account || !trim(account.connected_email)){
    return await finishSkip(NO_OUTLOOK_ERROR);
  }
  const recipients = await listRecipients(sb);
  if(!recipients.length){
    return await finishSkip(NO_RECIPIENTS_ERROR);
  }
  const emails = recipients.map((r) => r.email);
  try {
    const sent = await sendGraph(account, snap, recipients);
    if(sent.tokenData.refresh_token || sent.access){
      await upsertAccount(sb, {
        access_token: sent.access,
        refresh_token: trim(sent.tokenData.refresh_token) || account.refresh_token,
      });
    }
    const missingPdf = !pdfOk(snap.pdf_base64);
    await logSend(sb, dateKey, "sent", missingPdf ? SENT_WITHOUT_PDF : null, emails);
    return json({
      ok: true,
      message: missingPdf ? "הדוח נשלח בלי קובץ PDF." : "הדוח נשלח.",
      usedRequestSnapshot: useRequest,
      replaced: useRequest && pdfOk(fromBody?.pdf_base64),
      hasPdf: !missingPdf,
      scheduled,
    });
  } catch(err) {
    const msg = err instanceof Error ? err.message : "שליחה נכשלה";
    await logSend(sb, dateKey, "error", msg, emails);
    return json({ ok: false, error: msg }, 400);
  }
}

async function runScheduledSlot(){
  const sb = sbAdmin();
  try {
    const res = await handleSendNow(sb, { action: "send-slot" }, { scheduled: true });
    const text = await res.text();
    console.log("gi-daily-sales-mail send-slot", res.status, text);
    return res;
  } catch(err) {
    const msg = err instanceof Error ? err.message : "שגיאת שרת";
    console.error("gi-daily-sales-mail send-slot", msg);
    await logSend(sb, israelDateKey(), "error", msg, []);
    return json({ ok: false, error: msg }, 400);
  }
}

function registerSlotCrons(){
  const cron = (Deno as { cron?: (name: string, schedule: string, handler: () => Promise<void> | void) => void }).cron;
  if(typeof cron !== "function"){
    console.log("gi-daily-sales-mail: Deno.cron not available; GitHub Actions daily-sales-mail.yml is the clock");
    return;
  }
  for(const [name, schedule] of SLOT_CRONS){
    try {
      cron(name, schedule, async () => {
        await runScheduledSlot();
      });
      console.log("gi-daily-sales-mail Deno.cron registered", name, schedule);
    } catch(err) {
      console.error("gi-daily-sales-mail Deno.cron failed", name, err);
    }
  }
}

async function handleSaveAzure(sb: SupabaseClient, body: Json){
  const clientId = trim(body.clientId);
  const tenantId = trim(body.tenantId);
  const clientSecret = trim(body.clientSecret);
  if(!clientId) return json({ ok: false, error: "חסר מזהה אפליקציה" }, 400);
  await upsertAccount(sb, {
    ms_client_id: clientId,
    ms_tenant_id: tenantId || "common",
    ...(clientSecret ? { ms_client_secret: clientSecret } : {}),
  });
  return json({ ok: true });
}

async function handleOauthStart(sb: SupabaseClient){
  const account = await loadAccount(sb);
  const clientId = trim(account?.ms_client_id);
  const tenant = trim(account?.ms_tenant_id) || "common";
  if(!clientId) return json({ ok: false, error: "אפליקציית Microsoft לא הוגדרה" }, 400);
  const state = crypto.randomUUID();
  const authUrl = "https://login.microsoftonline.com/" + encodeURIComponent(tenant)
    + "/oauth2/v2.0/authorize?client_id=" + encodeURIComponent(clientId)
    + "&response_type=code&redirect_uri=" + encodeURIComponent(OAUTH_REDIRECT())
    + "&response_mode=query&scope=" + encodeURIComponent(GRAPH_SCOPE)
    + "&state=" + encodeURIComponent(state)
    + "&prompt=select_account";
  return json({ ok: true, authUrl, state });
}

async function handleDisconnect(sb: SupabaseClient){
  const account = await loadAccount(sb);
  if(!account) return json({ ok: true });
  await upsertAccount(sb, {
    connected_email: "",
    access_token: "",
    refresh_token: "",
  });
  return json({ ok: true });
}

async function handleOauthCallback(sb: SupabaseClient, url: URL){
  const code = trim(url.searchParams.get("code"));
  const err = trim(url.searchParams.get("error_description") || url.searchParams.get("error"));
  if(err) return html(`<!doctype html><meta charset="utf-8"><p dir="rtl">${err}</p>`, 400);
  if(!code) return json({ ok: false, error: "METHOD" }, 405);
  const account = await loadAccount(sb);
  const tenant = trim(account?.ms_tenant_id) || "common";
  const clientId = trim(account?.ms_client_id);
  const clientSecret = trim(account?.ms_client_secret);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: OAUTH_REDIRECT(),
    grant_type: "authorization_code",
    scope: GRAPH_SCOPE,
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json() as Json;
  if(!res.ok || !data.access_token){
    return html(`<!doctype html><meta charset="utf-8"><p dir="rtl">חיבור Outlook נכשל.</p>`, 400);
  }
  let email = "";
  try {
    const me = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
      headers: { Authorization: "Bearer " + trim(data.access_token) },
    });
    const profile = await me.json() as Json;
    email = trim(profile.mail) || trim(profile.userPrincipalName);
  } catch(_e) {
    email = "";
  }
  await upsertAccount(sb, {
    access_token: trim(data.access_token),
    refresh_token: trim(data.refresh_token) || account?.refresh_token || "",
    connected_email: email,
  });
  return html(`<!doctype html><meta charset="utf-8"><title>Outlook</title>
    <p dir="rtl" style="font-family:Arial;padding:24px">מייל Outlook חובר. אפשר לסגור את החלון.</p>
    <script>setTimeout(function(){ window.close(); }, 600);</script>`);
}

registerSlotCrons();

Deno.serve(async (req) => {
  if(req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sb = sbAdmin();
  try {
    if(req.method === "GET"){
      return await handleOauthCallback(sb, new URL(req.url));
    }
    if(req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);
    const body = (await req.json().catch(() => ({}))) as Json;
    const action = trim(body.action);
    if(action === "status") return await handleStatus(sb);
    if(action === "save-snapshot") return await handleSaveSnapshot(sb, body);
    if(action === "send-now") return await handleSendNow(sb, body, { scheduled: false });
    if(action === "send-slot") return await handleSendNow(sb, body, { scheduled: true });
    if(action === "save-azure") return await handleSaveAzure(sb, body);
    if(action === "oauth-start") return await handleOauthStart(sb);
    if(action === "disconnect") return await handleDisconnect(sb);
    return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch(err) {
    const msg = err instanceof Error ? err.message : "שגיאת שרת";
    try { await logSend(sb, israelDateKey(), "error", msg, []); } catch(_e) {}
    return json({ ok: false, error: msg }, 400);
  }
});
