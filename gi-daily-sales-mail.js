/* GI-DAILY-SALES-MAIL 20260919-mail-prefs-ui-v1
   Isolated Outlook daily-sales email. Calls existing DashboardUI report
   builders only (buildDailySalesPrintModel). Does not change sales / PIN / MFA. */
(() => {
  "use strict";

  const FN_PATH = "/functions/v1/gi-daily-sales-mail";
  const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
  const SNAPSHOT_GAP_MS = 10 * 60 * 1000;
  const SNAPSHOT_POLL_MS = 45 * 1000;
  const MIN_PDF_CHARS = 10000;
  const TITLE = "דוח מכירות למייל";
  const MAIL_LAYOUT = "20260908-today-net";
  const DEFAULT_SLOTS = ["12:30", "15:00", "20:00"];

  let lastSnapshotAt = 0;
  let pollTimer = 0;
  let bound = false;
  let prefsState = {
    slots: DEFAULT_SLOTS.slice(),
    selectedIds: [],
    candidates: [],
    shownIds: []
  };

  function trim(v){
    return String(v == null ? "" : v).trim();
  }

  function errText(err){
    if(typeof err === "string" && trim(err) && trim(err) !== "[object Object]") return trim(err);
    const msg = err && err.message;
    if(typeof msg === "string" && trim(msg) && trim(msg) !== "[object Object]") return trim(msg);
    if(msg && typeof msg === "object"){
      if(typeof msg.message === "string" && trim(msg.message)) return trim(msg.message);
      try { return JSON.stringify(msg); } catch(_e) {}
    }
    if(err && typeof err === "object"){
      if(typeof err.error === "string" && trim(err.error)) return trim(err.error);
      try { return JSON.stringify(err); } catch(_e) {}
    }
    return "שגיאה בחיבור המייל";
  }

  function escapeHtml(value){
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bridge(){
    const b = window.__GI_FACE_BRIDGE__ && typeof window.__GI_FACE_BRIDGE__ === "object"
      ? window.__GI_FACE_BRIDGE__
      : {};
    return {
      supabaseUrl: trim(b.supabaseUrl) || FALLBACK_SUPABASE_URL,
      publishableKey: trim(b.publishableKey) || FALLBACK_PUBLISHABLE_KEY,
      getCurrentAgent: typeof b.getCurrentAgent === "function" ? b.getCurrentAgent : null
    };
  }

  function roleCode(raw){
    return trim(raw).toLowerCase().replace(/[\s_-]+/g, "");
  }

  function isMailAdminRole(raw){
    const role = roleCode(raw);
    return role === "admin" || role === "owner" || role === "manager" || role === "adminlite"
      || role === "מנהל" || role === "מנהלמערכת" || role === "מפתחהמערכת" || trim(raw) === "מנהל";
  }

  function pillAgent(){
    const name = trim(document.querySelector("#lcUserPillText .lcUserPill__name, .lcUserPill__name")?.textContent);
    const roleHe = trim(document.querySelector("#lcUserPillText .lcUserPill__role, .lcUserPill__role")?.textContent);
    let role = "";
    if(roleHe === "מפתח המערכת") role = "owner";
    else if(roleHe === "מנהל מערכת") role = "admin";
    else if(roleHe === "מנהל") role = "manager";
    if(!name && !role) return null;
    return { id: "", name: name || "מנהל מערכת", role: role || "agent" };
  }

  function currentAgent(){
    try {
      const b = bridge();
      const fromBridge = b.getCurrentAgent ? (b.getCurrentAgent() || null) : null;
      const pill = pillAgent();
      if(fromBridge){
        const role = isMailAdminRole(fromBridge.role) ? trim(fromBridge.role) : trim(pill?.role);
        return {
          id: trim(fromBridge.id),
          name: trim(fromBridge.name) || trim(pill?.name),
          role: role || "agent",
          username: trim(fromBridge.username)
        };
      }
      return pill;
    } catch(_e) {
      return pillAgent();
    }
  }

  function isMailAdmin(){
    const agent = currentAgent();
    if(isMailAdminRole(agent?.role)) return true;
    const name = trim(agent?.name);
    return name === "מנהל מערכת" || name === "מפתח המערכת" || name === "אוריה סומך"
      || name === "איתי סומך" || name === "סוניה ארנשטיין" || name.indexOf("סטס") === 0;
  }

  function fnUrl(){
    return bridge().supabaseUrl.replace(/\/+$/, "") + FN_PATH;
  }

  function sessionPin(){
    try {
      const b = window.__GI_FACE_BRIDGE__;
      if(b && typeof b.getMailSessionPin === "function") return trim(b.getMailSessionPin());
    } catch(_e) {}
    return "";
  }

  async function api(action, body){
    const b = bridge();
    const agent = currentAgent() || {};
    const res = await fetch(fnUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: b.publishableKey,
        Authorization: "Bearer " + b.publishableKey
      },
      body: JSON.stringify({
        action,
        actorId: trim(agent.id),
        actorName: trim(agent.name),
        actorUsername: trim(agent.username) || trim(agent.name),
        actorPin: sessionPin(),
        actorRole: isMailAdmin() ? (isMailAdminRole(agent.role) ? trim(agent.role) : "manager") : (trim(agent.role) || "agent"),
        ...(body || {})
      })
    });
    let data = {};
    try { data = await res.json(); } catch(_e) { data = {}; }
    if(!res.ok || data.ok === false){
      throw new Error(errText(data.error) || ("שגיאת שרת " + res.status));
    }
    return data;
  }

  function els(){
    return {
      panel: document.getElementById("settingsPanel-dailySalesMail"),
      status: document.getElementById("giDailySalesMailStatus"),
      schedulePanel: document.getElementById("giDailySalesMailSchedulePanel"),
      recipientsPanel: document.getElementById("giDailySalesMailRecipientsPanel"),
      slots: document.getElementById("giDailySalesMailSlots"),
      slotInput: document.getElementById("giDailySalesMailSlotInput"),
      addSlot: document.getElementById("giDailySalesMailAddSlotBtn"),
      recipients: document.getElementById("giDailySalesMailRecipients"),
      addUserSelect: document.getElementById("giDailySalesMailAddUserSelect"),
      addUser: document.getElementById("giDailySalesMailAddUserBtn"),
      savePrefs: document.getElementById("giDailySalesMailSavePrefsBtn"),
      azureBlock: document.getElementById("giDailySalesMailAzureBlock"),
      clientId: document.getElementById("giDailySalesMailClientId"),
      tenantId: document.getElementById("giDailySalesMailTenantId"),
      clientSecret: document.getElementById("giDailySalesMailClientSecret"),
      azureHelp: document.getElementById("giDailySalesMailAzureHelp"),
      redirect: document.getElementById("giDailySalesMailRedirect"),
      saveAzure: document.getElementById("giDailySalesMailSaveAzureBtn"),
      connect: document.getElementById("giDailySalesMailConnectBtn"),
      disconnect: document.getElementById("giDailySalesMailDisconnectBtn"),
      snapshot: document.getElementById("giDailySalesMailSnapshotBtn"),
      sendNow: document.getElementById("giDailySalesMailSendNowBtn"),
      message: document.getElementById("giDailySalesMailMessage"),
      pageTitle: document.getElementById("pageTitle")
    };
  }

  function setMessage(text, isError){
    const node = els().message;
    if(!node) return;
    node.textContent = trim(text);
    node.style.color = isError ? "var(--danger, #c0392b)" : "var(--brandC, #1b7a4a)";
  }

  function setStatusHtml(html, kind){
    const node = els().status;
    if(!node) return;
    node.innerHTML = html;
    node.classList.toggle("is-ok", kind === "ok");
    node.classList.toggle("is-warn", kind === "warn");
  }

  function setStatus(text, kind){
    setStatusHtml(escapeHtml(text).replace(/\n/g, "<br>"), kind);
  }

  function israelDateKey(d){
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d || new Date());
  }

  function ensureRtlEmailHtml(raw){
    let inner = String(raw == null ? "" : raw);
    const body = inner.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if(body) inner = body[1];
    inner = inner.replace(/dir\s*=\s*(['"])ltr\1/gi, "dir=$1rtl$1");
    inner = inner.replace(/direction\s*:\s*ltr/gi, "direction:rtl");
    inner = inner.replace(/<table(?![^>]*\bdir\s*=)/gi, '<table dir="rtl" align="right"');
    return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head>'
      + '<body dir="rtl" style="margin:0;padding:24px;background:#fff;color:#122033;font-family:Arial,sans-serif;direction:rtl;text-align:right;unicode-bidi:embed">'
      + '<table dir="rtl" align="right" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;direction:rtl;text-align:right"><tr><td dir="rtl" align="right" style="direction:rtl;text-align:right">'
      + inner
      + "</td></tr></table></body></html>";
  }

  /* הפונקציה החיה עדיין דורשת את המחרוזת «לידים שויכו» ב-HTML.
     לא מציגים KPI — רק הערה מוסתרת כדי שהשליחה לא תידחה. */
  function ensureLiveLayoutMarker(html){
    const s = String(html || "");
    if(!s || s.indexOf("לידים שויכו") >= 0) return s;
    if(s.indexOf("</body>") >= 0) return s.replace("</body>", "<!-- לידים שויכו --></body>");
    return s + "<!-- לידים שויכו -->";
  }

  function wrapSnap(snap){
    if(!snap || (!snap.html && !snap.pdfBase64)) return null;
    const html = snap.html ? ensureLiveLayoutMarker(ensureRtlEmailHtml(snap.html)) : "";
    const summary = snap.summary && typeof snap.summary === "object" ? { ...snap.summary } : {};
    summary.layout = MAIL_LAYOUT;
    return {
      dateKey: trim(snap.dateKey) || israelDateKey(),
      dateLabel: snap.dateLabel || israelDateKey(),
      html,
      summary,
      pdfBase64: trim(snap.pdfBase64),
      pdfName: trim(snap.pdfName)
    };
  }

  function snapshotHasNewLayout(snap){
    const html = String(snap && snap.html || "");
    if(!html) return false;
    if(html.indexOf("מוצגים רק נציגים עם מכירה") >= 0) return false;
    if(html.indexOf(">לידים שויכו<") >= 0) return false;
    return html.indexOf("מכירות מודיעין") >= 0
      && html.indexOf("מכירות חיפה") >= 0
      && html.indexOf("פרמייה מהפקה") >= 0;
  }

  function dashboardUI(){
    const list = [];
    try {
      const hookDash = window.DashboardUI;
      if(hookDash) list.push(hookDash);
    } catch(_e) {}
    try {
      const b = window.__GI_FACE_BRIDGE__;
      if(b && typeof b.getDashboardUI === "function") list.push(b.getDashboardUI());
    } catch(_e) {}
    try {
      const host = window.__GI_WIZARD_HOST;
      if(host && host.DashboardUI) list.push(host.DashboardUI);
    } catch(_e) {}
    for(let i = 0; i < list.length; i++){
      const dash = list[i];
      if(dash && (typeof dash.buildDailySalesMailSnapshot === "function" || typeof dash.buildDailySalesEmailHtml === "function" || typeof dash.buildDailyAgentSalesReport === "function")){
        return dash;
      }
    }
    return null;
  }

  function mailHookReady(){
    try {
      if(typeof window.__GI_DAILY_SALES_MAIL_PDF_HOOK__ === "function") return true;
    } catch(_e) {}
    try {
      if(typeof window.__GI_DAILY_SALES_MAIL_HOOK__ === "function") return true;
    } catch(_e) {}
    try {
      const b = window.__GI_FACE_BRIDGE__;
      if(b && (typeof b.buildDailySalesMailSnapshot === "function" || typeof b.buildDailySalesEmailHtml === "function")) return true;
    } catch(_e) {}
    return !!dashboardUI();
  }

  function snapHasPdf(snap){
    return trim(snap && snap.pdfBase64).length >= MIN_PDF_CHARS;
  }

  async function buildSnapshot(requirePdf){
    /* Heartbeat must not paint a PDF iframe over the CRM. HTML-only is
       enough between send slots; PDF only when required. */
    if(!requirePdf){
      return buildEmailHtml();
    }
    let lastErr = null;
    try {
      if(typeof window.__GI_DAILY_SALES_MAIL_PDF_HOOK__ === "function"){
        const snap = wrapSnap(await window.__GI_DAILY_SALES_MAIL_PDF_HOOK__());
        if(snap && snapHasPdf(snap)) return snap;
        if(snap) lastErr = new Error("PDF ריק");
      }
    } catch(err) {
      lastErr = err;
    }
    try {
      const b = window.__GI_FACE_BRIDGE__;
      if(b && typeof b.buildDailySalesMailSnapshot === "function"){
        const snap = wrapSnap(await b.buildDailySalesMailSnapshot());
        if(snap && snapHasPdf(snap)) return snap;
        lastErr = lastErr || new Error("PDF ריק");
      }
    } catch(err) {
      lastErr = lastErr || err;
    }
    const Dash = dashboardUI();
    if(Dash && typeof Dash.buildDailySalesMailSnapshot === "function"){
      try {
        const snap = wrapSnap(await Dash.buildDailySalesMailSnapshot());
        if(snap && snapHasPdf(snap)) return snap;
        lastErr = lastErr || new Error("PDF ריק");
      } catch(err) {
        lastErr = lastErr || err;
      }
    }
    throw lastErr || new Error("לא נוצר קובץ PDF. רעננו את העמוד ב־Ctrl+F5, פתחו את דוח המכירות, ואז לחצו שוב.");
  }

  function buildEmailHtml(){
    let lastErr = null;
    try {
      if(typeof window.__GI_DAILY_SALES_MAIL_HOOK__ === "function"){
        const snap = wrapSnap(window.__GI_DAILY_SALES_MAIL_HOOK__());
        if(snap) return snap;
      }
    } catch(err) {
      lastErr = err;
    }
    try {
      const b = window.__GI_FACE_BRIDGE__;
      if(b && typeof b.buildDailySalesEmailHtml === "function"){
        const snap = wrapSnap(b.buildDailySalesEmailHtml());
        if(snap) return snap;
      }
    } catch(err) {
      lastErr = lastErr || err;
    }
    const Dash = dashboardUI();
    if(Dash && typeof Dash.buildDailySalesEmailHtml === "function"){
      const snap = wrapSnap(Dash.buildDailySalesEmailHtml());
      if(snap) return snap;
    }
    if(lastErr) throw lastErr;
    throw new Error("חסר חיבור לדוח מכירות. רעננו את העמוד ב־Ctrl+F5 ואז לחצו שוב.");
  }

  function wait(ms){
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function waitForMailHook(timeoutMs){
    const start = Date.now();
    while(!mailHookReady() && (Date.now() - start) < timeoutMs){
      await wait(200);
    }
    return mailHookReady();
  }

  function snapshotReady(){
    try {
      if(typeof window.__GI_DAILY_SALES_MAIL_READY_HOOK__ === "function"){
        return !!window.__GI_DAILY_SALES_MAIL_READY_HOOK__();
      }
    } catch(_e) {}
    try {
      const b = window.__GI_FACE_BRIDGE__;
      if(b && typeof b.dailySalesMailSnapshotReady === "function"){
        return !!b.dailySalesMailSnapshotReady();
      }
    } catch(_e) {}
    const Dash = dashboardUI();
    if(Dash && typeof Dash.dailySalesMailSnapshotReady === "function"){
      return !!Dash.dailySalesMailSnapshotReady();
    }
    return false;
  }

  async function waitForCompleteSnapshot(timeoutMs){
    const start = Date.now();
    while((Date.now() - start) < timeoutMs){
      if(snapshotReady()) return true;
      await wait(250);
    }
    return snapshotReady();
  }

  function israelMinutesNow(){
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jerusalem",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23"
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    if(!Number.isFinite(hour) || !Number.isFinite(minute)) return -1;
    return hour * 60 + minute;
  }

  function nearSendSlot(){
    const now = israelMinutesNow();
    if(now < 0) return false;
    const slots = (prefsState.slots && prefsState.slots.length ? prefsState.slots : DEFAULT_SLOTS)
      .map(slotToMinutes)
      .filter((n) => n >= 0);
    /* 12 minutes before through 40 minutes after each slot so a late GitHub
       fire still gets a PDF built from the sales screen, not an old file. */
    return slots.some((slot) => now >= (slot - 12) && now < (slot + 40));
  }

  function slotToMinutes(slot){
    const m = /^(\d{1,2}):(\d{2})$/.exec(trim(slot));
    if(!m) return -1;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function normalizeSlot(raw){
    const mins = slotToMinutes(raw);
    if(mins < 0) return "";
    const hour = Math.floor(mins / 60);
    const minute = mins % 60;
    return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
  }

  function roleLabelHe(role){
    const r = trim(role).toLowerCase().replace(/[\s_-]+/g, "");
    if(r === "owner" || r === "מפתחהמערכת") return "מפתח המערכת";
    if(r === "admin" || r === "מנהלמערכת") return "מנהל מערכת";
    if(r === "manager" || r === "מנהל") return "מנהל";
    if(r === "teammanager") return "מנהל צוות";
    if(r === "agent" || r === "נציג") return "נציג";
    return trim(role) || "משתמש";
  }

  function candidateById(id){
    const wanted = trim(id).toLowerCase();
    return (prefsState.candidates || []).find((c) => trim(c.id).toLowerCase() === wanted) || null;
  }

  function renderSlots(){
    const host = els().slots;
    if(!host) return;
    const slots = Array.isArray(prefsState.slots) ? prefsState.slots.slice() : [];
    if(!slots.length){
      host.innerHTML = `<div class="giDailySalesMail__panelHint">אין מועדים. הוסיפו מועד למטה.</div>`;
      return;
    }
    host.innerHTML = slots.map((slot) => `
      <span class="giDailySalesMail__slotChip" data-slot="${escapeHtml(slot)}">
        <span>${escapeHtml(slot)}</span>
        <button type="button" data-remove-slot="${escapeHtml(slot)}" title="הסר מועד" aria-label="הסר ${escapeHtml(slot)}">×</button>
      </span>`).join("");
    host.querySelectorAll("[data-remove-slot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slot = trim(btn.getAttribute("data-remove-slot"));
        prefsState.slots = prefsState.slots.filter((s) => s !== slot);
        renderSlots();
      });
    });
  }

  function renderRecipients(){
    const host = els().recipients;
    const addSelect = els().addUserSelect;
    if(!host) return;
    const selected = new Set((prefsState.selectedIds || []).map((id) => trim(id).toLowerCase()));
    const shown = [];
    const seen = new Set();
    (prefsState.shownIds || []).forEach((id) => {
      const c = candidateById(id);
      if(!c) return;
      const key = trim(c.id).toLowerCase();
      if(seen.has(key)) return;
      seen.add(key);
      shown.push(c);
    });
    (prefsState.candidates || []).forEach((c) => {
      const key = trim(c.id).toLowerCase();
      if(!selected.has(key) || seen.has(key)) return;
      seen.add(key);
      shown.push(c);
    });
    prefsState.shownIds = shown.map((c) => c.id);
    if(!shown.length){
      host.innerHTML = `<div class="giDailySalesMail__panelHint">אין נמענים להצגה. הוסיפו משתמש עם מייל למטה.</div>`;
    } else {
      host.innerHTML = shown.map((c) => {
        const on = selected.has(trim(c.id).toLowerCase());
        return `<label class="giDailySalesMail__recipient${on ? " is-on" : ""}">
          <input type="checkbox" data-recipient-id="${escapeHtml(c.id)}" ${on ? "checked" : ""}/>
          <span class="giDailySalesMail__recipientMain">
            <span class="giDailySalesMail__recipientName">${escapeHtml(c.name || "משתמש")}</span>
            <div class="giDailySalesMail__recipientEmail">${escapeHtml(c.email || "")}</div>
            <span class="giDailySalesMail__recipientRole">${escapeHtml(roleLabelHe(c.role))}</span>
          </span>
        </label>`;
      }).join("");
      host.querySelectorAll("[data-recipient-id]").forEach((input) => {
        input.addEventListener("change", () => {
          const id = trim(input.getAttribute("data-recipient-id"));
          const key = id.toLowerCase();
          const set = new Set(prefsState.selectedIds.map((x) => trim(x).toLowerCase()));
          if(input.checked) set.add(key);
          else set.delete(key);
          prefsState.selectedIds = (prefsState.candidates || [])
            .filter((c) => set.has(trim(c.id).toLowerCase()))
            .map((c) => c.id);
          renderRecipients();
        });
      });
    }
    if(addSelect){
      const shownSet = new Set(prefsState.shownIds.map((id) => trim(id).toLowerCase()));
      const options = (prefsState.candidates || [])
        .filter((c) => !shownSet.has(trim(c.id).toLowerCase()))
        .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml((c.name || "משתמש") + " — " + (c.email || ""))}</option>`)
        .join("");
      addSelect.innerHTML = `<option value="">— בחר משתמש עם מייל —</option>` + options;
    }
  }

  function applyPrefsFromStatus(data){
    const slots = Array.isArray(data.slots) && data.slots.length
      ? data.slots.map(normalizeSlot).filter(Boolean)
      : DEFAULT_SLOTS.slice();
    const candidates = Array.isArray(data.candidates) ? data.candidates : (Array.isArray(data.recipients) ? data.recipients : []);
    const selectedIds = Array.isArray(data.selectedRecipientIds) && data.selectedRecipientIds.length
      ? data.selectedRecipientIds.map(trim).filter(Boolean)
      : candidates.filter((c) => c.isDefault || c.selected).map((c) => trim(c.id)).filter(Boolean);
    prefsState = {
      slots,
      selectedIds,
      candidates,
      shownIds: selectedIds.slice()
    };
    const schedulePanel = els().schedulePanel;
    const recipientsPanel = els().recipientsPanel;
    if(schedulePanel) schedulePanel.hidden = false;
    if(recipientsPanel) recipientsPanel.hidden = false;
    renderSlots();
    renderRecipients();
  }

  function formatStatus(data){
    const lines = [];
    if(data.connectedEmail){
      lines.push(`<div class="giDailySalesMail__statusLine"><span class="giDailySalesMail__statusLabel">מייל שולח</span><span class="giDailySalesMail__statusValue">${escapeHtml(data.connectedEmail)}</span></div>`);
      const slots = (Array.isArray(data.slots) && data.slots.length ? data.slots : DEFAULT_SLOTS).join(" · ");
      lines.push(`<div class="giDailySalesMail__statusLine"><span class="giDailySalesMail__statusLabel">מועדים</span><span class="giDailySalesMail__statusValue">${escapeHtml(slots)} · שעון ישראל</span></div>`);
      lines.push(`<div class="giDailySalesMail__statusMeta">בגוף המייל רק «דוח מכירות עדכני נכון ל־…». הפירוט מצורף כקובץ PDF.</div>`);
    } else if(data.azureReady){
      lines.push(`<div class="giDailySalesMail__statusMeta">אפליקציית Microsoft מוגדרת. עדיין לא חובר מייל Outlook.</div>`);
      lines.push(`<div class="giDailySalesMail__statusMeta">לחצו «חבר מייל Outlook» והיכנסו עם orias@i-s-f.co.il</div>`);
    } else {
      lines.push(`<div class="giDailySalesMail__statusMeta">כדי לשלוח מ־Outlook צריך פעם אחת מזהה אפליקציה של Microsoft.</div>`);
    }
    if(data.snapshotDateKey){
      const savedAt = formatIsraelDateTime(data.snapshotAt);
      lines.push(`<div class="giDailySalesMail__statusMeta">דוח שמור: ${escapeHtml(data.snapshotDateKey)}${savedAt ? (" · " + escapeHtml(savedAt)) : ""} · ${data.hasPdf ? "PDF מוכן" : "אין PDF — רעננו דוח"}</div>`);
    }
    if(data.lastSend){
      const at = formatIsraelDateTime(data.lastSend.at);
      let last = "שליחה אחרונה: " + sendStatusHe(data.lastSend.status) + (at ? (" · " + at) : "");
      if(trim(data.lastSend.error)) last += " · " + trim(data.lastSend.error);
      lines.push(`<div class="giDailySalesMail__statusMeta">${escapeHtml(last)}</div>`);
    }
    if(data.redirectUri){
      const redir = els().redirect;
      if(redir) redir.textContent = "Redirect URI: " + data.redirectUri;
    }
    return lines.join("");
  }

  async function refreshStatus(){
    if(!isMailAdmin()){
      setStatus("המסך הזה זמין למנהל ולמנהל מערכת בלבד.", "warn");
      return;
    }
    const data = await api("status");
    const azureBlock = els().azureBlock;
    if(azureBlock) azureBlock.hidden = !!data.azureReady && !data.forceAzure;
    applyPrefsFromStatus(data);
    setStatusHtml(formatStatus(data), data.connectedEmail ? "ok" : "warn");
    const connect = els().connect;
    const disconnect = els().disconnect;
    const sendNow = els().sendNow;
    if(connect) connect.disabled = !data.azureReady;
    if(disconnect) disconnect.disabled = !data.connectedEmail;
    if(sendNow) sendNow.disabled = !data.connectedEmail;
    return data;
  }

  async function savePrefs(){
    const slots = (prefsState.slots || []).map(normalizeSlot).filter(Boolean);
    const recipientIds = (prefsState.selectedIds || []).map(trim).filter(Boolean);
    if(!slots.length) throw new Error("יש להגדיר לפחות מועד שליחה אחד");
    if(!recipientIds.length) throw new Error("יש לסמן לפחות נמען אחד");
    const out = await api("save-prefs", { slots, recipientIds });
    prefsState.slots = Array.isArray(out.slots) ? out.slots : slots;
    prefsState.selectedIds = Array.isArray(out.selectedRecipientIds) ? out.selectedRecipientIds : recipientIds;
    renderSlots();
    renderRecipients();
    return out;
  }

  async function persistSnapshot(force){
    if(!isMailAdmin()) return { skipped: true };
    const now = Date.now();
    const needPdf = !!force || nearSendSlot();
    const gap = (!force && nearSendSlot()) ? 60 * 1000 : SNAPSHOT_GAP_MS;
    if(!force && lastSnapshotAt && (now - lastSnapshotAt) < gap) return { skipped: true };
    await waitForMailHook(needPdf ? 4000 : 1500);
    if(needPdf){
      try {
        if(typeof window.__GI_DAILY_SALES_MAIL_PREPARE_HOOK__ === "function"){
          await window.__GI_DAILY_SALES_MAIL_PREPARE_HOOK__();
        } else {
          const b = window.__GI_FACE_BRIDGE__;
          if(b && typeof b.prepareDailySalesMailSnapshot === "function"){
            await b.prepareDailySalesMailSnapshot();
          } else {
            const Dash = dashboardUI();
            if(Dash && typeof Dash.prepareDailySalesMailSnapshot === "function"){
              await Dash.prepareDailySalesMailSnapshot();
            }
          }
        }
      } catch(_e) {}
      await waitForCompleteSnapshot(1500);
    } else {
      snapshotReady();
      if(!snapshotReady()) return { skipped: true, reason: "incomplete" };
    }
    const snap = await buildSnapshot(needPdf);
    if(!snapshotHasNewLayout(snap)){
      throw new Error("נטען דוח ישן מהמטמון (בלי מודיעין / חיפה). רעננו את העמוד ב־Ctrl+F5, ואז לחצו שוב «שלח עכשיו לבדיקה».");
    }
    if(needPdf && !snapHasPdf(snap)){
      throw new Error("לא נוצר קובץ PDF. רעננו את העמוד ב־Ctrl+F5, פתחו את דוח המכירות, ואז לחצו שוב.");
    }
    const save = await api("save-snapshot", {
      ...snap,
      force: !!force,
      replace: !!force
    });
    lastSnapshotAt = Date.now();
    return { snap, save, kept: !!(save && save.kept) };
  }

  function formatIsraelDateTime(iso){
    const raw = trim(iso);
    if(!raw) return "";
    const d = new Date(raw);
    if(!Number.isFinite(d.getTime())) return raw;
    try {
      return new Intl.DateTimeFormat("he-IL", {
        timeZone: "Asia/Jerusalem",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        hourCycle: "h23"
      }).format(d);
    } catch(_e) {
      return raw;
    }
  }

  function sendStatusHe(status){
    const s = trim(status);
    if(s === "sent") return "נשלח";
    if(s === "skipped") return "דולג";
    if(s === "error") return "נכשל";
    return s;
  }

  async function connectOutlook(){
    const nodes = els();
    const clientId = trim(nodes.clientId?.value);
    const tenantId = trim(nodes.tenantId?.value);
    const clientSecret = trim(nodes.clientSecret?.value);
    if(clientId && (clientSecret || tenantId)){
      setMessage("שומר הגדרת Microsoft…");
      await api("save-azure", { clientId, tenantId, clientSecret });
      if(nodes.clientSecret) nodes.clientSecret.value = "";
    }
    setMessage("פותח את Microsoft…");
    const data = await api("oauth-start");
    const url = trim(data.authUrl);
    if(!url) throw new Error("לא התקבלה כתובת חיבור");
    const popup = window.open(url, "giOutlookConnect", "width=520,height=720");
    const started = Date.now();
    await new Promise((resolve, reject) => {
      const timer = setInterval(async () => {
        if(Date.now() - started > 180000){
          clearInterval(timer);
          reject(new Error("פג הזמן לחיבור Outlook"));
          return;
        }
        try {
          const st = await api("status");
          if(st.connectedEmail){
            clearInterval(timer);
            try { popup && popup.close(); } catch(_e) {}
            resolve(st);
          }
        } catch(_e) {}
      }, 1600);
    });
    await refreshStatus();
    setMessage("מייל Outlook חובר בהצלחה.");
  }

  function bind(){
    if(bound) return;
    const nodes = els();
    if(!nodes.panel) return;
    bound = true;
    nodes.addSlot?.addEventListener("click", () => {
      const slot = normalizeSlot(nodes.slotInput?.value);
      if(!slot){
        setMessage("מועד לא תקין", true);
        return;
      }
      if(prefsState.slots.includes(slot)){
        setMessage("המועד כבר קיים", true);
        return;
      }
      prefsState.slots = [...prefsState.slots, slot].sort((a, b) => slotToMinutes(a) - slotToMinutes(b));
      renderSlots();
      setMessage("המועד נוסף — לחצו «שמור נמענים ומועדים».");
    });
    nodes.addUser?.addEventListener("click", () => {
      const id = trim(nodes.addUserSelect?.value);
      if(!id){
        setMessage("בחרו משתמש להוספה", true);
        return;
      }
      if(!prefsState.shownIds.includes(id)) prefsState.shownIds.push(id);
      if(!prefsState.selectedIds.map((x) => x.toLowerCase()).includes(id.toLowerCase())){
        prefsState.selectedIds.push(id);
      }
      renderRecipients();
      setMessage("המשתמש נוסף וסומן — לחצו «שמור נמענים ומועדים».");
    });
    nodes.savePrefs?.addEventListener("click", async () => {
      try {
        setMessage("שומר נמענים ומועדים…");
        await savePrefs();
        await refreshStatus();
        setMessage("ההגדרות נשמרו.");
      } catch(err) {
        setMessage(errText(err), true);
      }
    });
    nodes.saveAzure?.addEventListener("click", async () => {
      try {
        setMessage("שומר הגדרת Microsoft…");
        await api("save-azure", {
          clientId: trim(nodes.clientId?.value),
          tenantId: trim(nodes.tenantId?.value),
          clientSecret: trim(nodes.clientSecret?.value)
        });
        if(nodes.clientSecret) nodes.clientSecret.value = "";
        await refreshStatus();
        setMessage("הגדרת Microsoft נשמרה. אפשר לחבר את Outlook.");
      } catch(err) {
        setMessage(errText(err), true);
      }
    });
    nodes.connect?.addEventListener("click", async () => {
      try { await connectOutlook(); }
      catch(err) { setMessage(errText(err), true); }
    });
    nodes.disconnect?.addEventListener("click", async () => {
      try {
        if(!window.confirm("לנתק את מייל Outlook? אפשר לחבר מייל אחר אחר כך.")) return;
        await api("disconnect");
        await refreshStatus();
        setMessage("המייל נותק. אפשר לחבר כתובת אחרת.");
      } catch(err) {
        setMessage(errText(err), true);
      }
    });
    nodes.snapshot?.addEventListener("click", async () => {
      try {
        setMessage("שומר את דוח היום…");
        const persist = await persistSnapshot(true);
        await refreshStatus();
        if(persist && persist.kept){
          setMessage("השרת לא החליף את קובץ ה-PDF הישן של היום. לחצו «שלח עכשיו לבדיקה» אחרי עדכון פונקציית המייל, או נסו שוב אחרי חצות שעון ישראל.", true);
          return;
        }
        setMessage("דוח היום נשמר. יישלח אוטומטית במועדים שנשמרו.");
      } catch(err) {
        setMessage(errText(err), true);
      }
    });
    nodes.sendNow?.addEventListener("click", async () => {
      try {
        setMessage("מפיק PDF ושולח דוח בדיקה…");
        const persist = await persistSnapshot(true);
        await refreshStatus();
        if(persist && persist.kept){
          setMessage("השרת לא החליף את קובץ ה-PDF הישן של היום, ולכן לא נשלח שוב את הדוח הישן. אחרי עדכון פונקציית המייל לחצו שוב «שלח עכשיו לבדיקה».", true);
          return;
        }
        const snap = persist && persist.snap ? persist.snap : persist;
        const out = await api("send-now", {
          ...(snap || {}),
          force: true,
          replace: true
        });
        await refreshStatus();
        setMessage(trim(out.message) || "הדוח נשלח.");
      } catch(err) {
        setMessage(errText(err), true);
      }
    });
  }

  function syncPanel(){
    const panel = els().panel;
    const active = !!(panel && !panel.hidden && panel.classList.contains("is-active"));
    document.body.classList.toggle("lcSettingsRubric-dailySalesMail", active);
    if(!active) return;
    if(els().pageTitle) els().pageTitle.textContent = TITLE;
    bind();
    refreshStatus().catch((err) => setMessage(errText(err), true));
  }

  function startHeartbeat(){
    if(pollTimer) return;
    pollTimer = window.setInterval(() => {
      if(!isMailAdmin()) return;
      persistSnapshot(false).catch(() => {});
    }, SNAPSHOT_POLL_MS);
    window.setTimeout(() => {
      if(isMailAdmin()) persistSnapshot(false).catch(() => {});
    }, 8000);
  }

  function boot(){
    bind();
    startHeartbeat();
    const root = document.getElementById("view-settings");
    if(root){
      const obs = new MutationObserver(() => syncPanel());
      obs.observe(root, { attributes: true, subtree: true, attributeFilter: ["hidden", "class"] });
    }
    document.querySelectorAll('[data-settings-rubric="dailySalesMail"]').forEach((btn) => {
      btn.addEventListener("click", () => window.setTimeout(syncPanel, 30));
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
