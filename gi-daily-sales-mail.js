/* GI-DAILY-SALES-MAIL 2026-08-17
   Isolated Outlook daily-sales email. Calls existing DashboardUI report
   builders only. Does not change sales / PIN / MFA logic. */
(() => {
  "use strict";

  const FN_PATH = "/functions/v1/gi-daily-sales-mail";
  const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
  const SNAPSHOT_GAP_MS = 10 * 60 * 1000;
  const TITLE = "דוח מכירות למייל";

  let lastSnapshotAt = 0;
  let pollTimer = 0;
  let bound = false;

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
          role: role || "agent"
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

  function setStatus(text, kind){
    const node = els().status;
    if(!node) return;
    node.textContent = text;
    node.classList.toggle("is-ok", kind === "ok");
    node.classList.toggle("is-warn", kind === "warn");
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

  function wrapSnap(snap){
    if(!snap || !snap.html) return null;
    return {
      dateKey: trim(snap.dateKey) || israelDateKey(),
      dateLabel: snap.dateLabel || israelDateKey(),
      html: ensureRtlEmailHtml(snap.html),
      summary: snap.summary || {}
    };
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
      if(dash && (typeof dash.buildDailySalesEmailHtml === "function" || typeof dash.buildDailyAgentSalesReport === "function")){
        return dash;
      }
    }
    return null;
  }

  function mailHookReady(){
    try {
      if(typeof window.__GI_DAILY_SALES_MAIL_HOOK__ === "function") return true;
    } catch(_e) {}
    try {
      const b = window.__GI_FACE_BRIDGE__;
      if(b && typeof b.buildDailySalesEmailHtml === "function") return true;
    } catch(_e) {}
    return !!dashboardUI();
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

  async function persistSnapshot(force){
    if(!isMailAdmin()) return { skipped: true };
    const now = Date.now();
    if(!force && lastSnapshotAt && (now - lastSnapshotAt) < SNAPSHOT_GAP_MS) return { skipped: true };
    await waitForMailHook(force ? 4000 : 1500);
    const snap = buildEmailHtml();
    await api("save-snapshot", snap);
    lastSnapshotAt = Date.now();
    return snap;
  }

  function formatStatus(data){
    const lines = [];
    if(data.connectedEmail){
      lines.push("מייל שולח מחובר: " + data.connectedEmail);
      lines.push("שעת שליחה: כל יום ב־12:30, 15:00 ו־20:00 שעון ישראל");
    } else if(data.azureReady){
      lines.push("אפליקציית Microsoft מוגדרת. עדיין לא חובר מייל Outlook.");
      lines.push("לחץ «חבר מייל Outlook» והיכנס עם orias@i-s-f.co.il");
    } else {
      lines.push("כדי לשלוח מ־Outlook צריך פעם אחת מזהה אפליקציה של Microsoft.");
      lines.push("היכנס ל־portal.azure.com עם אותו חשבון, צור App registration, והדבק כאן את המזהה והסוד.");
    }
    const recipients = Array.isArray(data.recipients) ? data.recipients : [];
    if(recipients.length){
      lines.push("נמענים כרגע (מנהל / מנהל מערכת):");
      recipients.forEach((r) => {
        lines.push("• " + trim(r.name || "משתמש") + " — " + trim(r.email));
      });
    } else {
      lines.push("לא נמצאו מיילים שמורים למנהל / מנהל מערכת. יש למלא מייל בכרטיס המשתמש.");
    }
    if(data.snapshotDateKey){
      lines.push("דוח אחרון שנשמר לשליחה: " + data.snapshotDateKey + (data.snapshotAt ? (" · " + data.snapshotAt) : ""));
    }
    if(data.lastSend){
      lines.push("שליחה אחרונה: " + trim(data.lastSend.status) + (data.lastSend.at ? (" · " + data.lastSend.at) : ""));
    }
    if(data.redirectUri){
      const redir = els().redirect;
      if(redir) redir.textContent = "Redirect URI: " + data.redirectUri;
    }
    return lines.join("\n");
  }

  async function refreshStatus(){
    if(!isMailAdmin()){
      setStatus("המסך הזה זמין למנהל ולמנהל מערכת בלבד.", "warn");
      return;
    }
    const data = await api("status");
    const azureBlock = els().azureBlock;
    if(azureBlock) azureBlock.hidden = !!data.azureReady && !data.forceAzure;
    setStatus(formatStatus(data), data.connectedEmail ? "ok" : "warn");
    const connect = els().connect;
    const disconnect = els().disconnect;
    const sendNow = els().sendNow;
    if(connect) connect.disabled = !data.azureReady;
    if(disconnect) disconnect.disabled = !data.connectedEmail;
    if(sendNow) sendNow.disabled = !data.connectedEmail;
    return data;
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
        await persistSnapshot(true);
        await refreshStatus();
        setMessage("דוח היום נשמר. יישלח אוטומטית ב־12:30, 15:00 ו־20:00.");
      } catch(err) {
        setMessage(errText(err), true);
      }
    });
    nodes.sendNow?.addEventListener("click", async () => {
      try {
        setMessage("שולח דוח בדיקה…");
        await persistSnapshot(true);
        const out = await api("send-now");
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
    }, SNAPSHOT_GAP_MS);
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
