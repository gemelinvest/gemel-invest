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

  function currentAgent(){
    try {
      const b = bridge();
      return b.getCurrentAgent ? (b.getCurrentAgent() || null) : null;
    } catch(_e) {
      return null;
    }
  }

  function roleCode(raw){
    return trim(raw).toLowerCase().replace(/[\s_-]+/g, "");
  }

  function isMailAdmin(){
    const agent = currentAgent();
    const role = roleCode(agent?.role);
    return role === "admin" || role === "owner" || role === "manager" || role === "adminlite" || trim(agent?.role) === "מנהל";
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
        actorRole: trim(agent.role) || "agent",
        ...(body || {})
      })
    });
    let data = {};
    try { data = await res.json(); } catch(_e) { data = {}; }
    if(!res.ok || data.ok === false){
      throw new Error(trim(data.error) || ("שגיאת שרת " + res.status));
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

  function buildEmailHtml(){
    const Dash = window.DashboardUI;
    if(!Dash || typeof Dash.buildDailyAgentSalesReport !== "function"){
      throw new Error("דוח המכירות עדיין לא נטען");
    }
    const report = Dash.buildDailyAgentSalesReport();
    const rows = typeof Dash.dailySalesPresentPivotByAgent === "function"
      ? Dash.dailySalesPresentPivotByAgent(report.groups).sort((a, b) =>
        (Number(b.monthly) - Number(a.monthly))
        || (Number(b.elementary) - Number(a.elementary))
        || trim(a.agentName).localeCompare(trim(b.agentName), "he")
      )
      : [];
    const healthTab = Dash.dailySalesSectorTabs().find((t) => t.key === "healthPrat");
    const healthSlice = Dash.dailySalesTabSlice(report, healthTab);
    const totals = Dash.dailySalesBranchTotals(report);
    const agentCount = new Set((Array.isArray(report.groups) ? report.groups : []).map((g) => g.agentName)).size;
    const money = (v) => Dash.dailySalesPrintMoney(v);
    const cell = (v) => (Number(v) > 0 ? escapeHtml(money(v)) : `<span style="color:#9aa6b2">—</span>`);
    const body = rows.length
      ? rows.map((r) => {
          const sectors = (r.sectors || []).map((s) => Dash.dailySalesDisplaySectorLabel(s)).join(", ");
          return `<tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e4e9ee;font-weight:700;color:#0b2a4a">${escapeHtml(r.agentName)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e4e9ee;color:#3d4d5e">${escapeHtml(sectors || "—")}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e4e9ee;text-align:left">${cell(r.health)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e4e9ee;text-align:left">${cell(r.prat)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e4e9ee;text-align:left">${cell(r.elementary)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e4e9ee;text-align:left">${cell(r.pension)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e4e9ee;text-align:left">${cell(r.monthly)}</td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="7" style="text-align:center;padding:28px;color:#5b6b7c">אין מכירות ביום זה</td></tr>`;
    let dateLine = report.dateLabel || israelDateKey();
    try {
      dateLine = Dash.parseLocalDateKey(report.dateKey).toLocaleDateString("he-IL", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
      }) + " · ישראל";
    } catch(_e) {}
    const sum = (key) => Math.round(rows.reduce((n, r) => n + (Number(r[key]) || 0), 0) * 100) / 100;
    const agentsWord = typeof Dash.dailySalesAgentsWord === "function"
      ? Dash.dailySalesAgentsWord(agentCount)
      : (agentCount + " נציגים");
    const html = `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;padding:24px;background:#fff;color:#122033;font-family:'Segoe UI','Arial Hebrew',Arial,sans-serif">
      <div style="max-width:920px;margin:0 auto">
        <p style="margin:0 0 4px;font-size:11px;letter-spacing:.08em;color:#5b6b7c;font-weight:600">GEMEL INVEST · דוח מכירות</p>
        <h1 style="margin:0;font-size:22px;color:#0b2a4a">מכירות היום</h1>
        <p style="margin:4px 0 18px;font-size:13px;color:#3d4d5e">${escapeHtml(dateLine)}</p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 18px"><tr>
          <td style="border:1px solid #d7dee6;padding:10px 12px"><b style="display:block;font-size:18px;color:#0b2a4a">${escapeHtml(String(agentCount))}</b><span style="font-size:11px;color:#5b6b7c">נציגים שמכרו היום</span></td>
          <td style="border:1px solid #d7dee6;padding:10px 12px"><b style="display:block;font-size:18px;color:#0b2a4a">${escapeHtml(String(healthSlice.deals || 0))}</b><span style="font-size:11px;color:#5b6b7c">פוליסות בריאות + פרט</span></td>
          <td style="border:1px solid #d7dee6;padding:10px 12px"><b style="display:block;font-size:18px;color:#0b2a4a">${escapeHtml(money(healthSlice.premium))}</b><span style="font-size:11px;color:#5b6b7c">פרמיה חודשית · בריאות + פרט</span></td>
          <td style="border:1px solid #d7dee6;padding:10px 12px"><b style="display:block;font-size:18px;color:#0b2a4a">${escapeHtml(money(totals.elementary))}</b><span style="font-size:11px;color:#5b6b7c">פרמיה שנתית · אלמנטרי</span></td>
          <td style="border:1px solid #d7dee6;padding:10px 12px"><b style="display:block;font-size:18px;color:#0b2a4a">${escapeHtml(money(totals.pension))}</b><span style="font-size:11px;color:#5b6b7c">פרמיה חודשית · פנסיה</span></td>
        </tr></table>
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead><tr>
            <th style="background:#0b2a4a;color:#fff;text-align:right;padding:9px 10px">שם הנציג</th>
            <th style="background:#0b2a4a;color:#fff;text-align:right;padding:9px 10px">ענפים</th>
            <th style="background:#0b2a4a;color:#fff;text-align:left;padding:9px 10px">בריאות</th>
            <th style="background:#0b2a4a;color:#fff;text-align:left;padding:9px 10px">פרט</th>
            <th style="background:#0b2a4a;color:#fff;text-align:left;padding:9px 10px">אלמנטרי (שנתי)</th>
            <th style="background:#0b2a4a;color:#fff;text-align:left;padding:9px 10px">פנסיה</th>
            <th style="background:#0b2a4a;color:#fff;text-align:left;padding:9px 10px">סה״כ חודשי</th>
          </tr></thead>
          <tbody>${body}</tbody>
          <tfoot><tr>
            <td style="background:#0b2a4a;color:#fff;font-weight:700;padding:10px">סה״כ</td>
            <td style="background:#0b2a4a;color:#fff;font-weight:700;padding:10px">${escapeHtml(agentsWord)}</td>
            <td style="background:#0b2a4a;color:#fff;font-weight:700;padding:10px;text-align:left">${escapeHtml(money(sum("health")))}</td>
            <td style="background:#0b2a4a;color:#fff;font-weight:700;padding:10px;text-align:left">${escapeHtml(money(sum("prat")))}</td>
            <td style="background:#0b2a4a;color:#fff;font-weight:700;padding:10px;text-align:left">${escapeHtml(money(sum("elementary")))}</td>
            <td style="background:#0b2a4a;color:#fff;font-weight:700;padding:10px;text-align:left">${escapeHtml(money(sum("pension")))}</td>
            <td style="background:#0b2a4a;color:#fff;font-weight:700;padding:10px;text-align:left">${escapeHtml(money(sum("monthly")))}</td>
          </tr></tfoot>
        </table>
        <p style="margin-top:14px;font-size:11px;color:#5b6b7c;line-height:1.5">מוצגים רק נציגים עם מכירה ביום הנבחר. «פרט» הוא ענף הסיכונים במערכת. פרמיית בריאות, פרט ופנסיה היא חודשית. פרמיית אלמנטרי מוצגת שנתית ואינה נכנסת לסה״כ החודשי.</p>
      </div>
    </body></html>`;
    return {
      dateKey: trim(report.dateKey) || israelDateKey(),
      dateLabel: dateLine,
      html,
      summary: {
        agentCount,
        healthDeals: Number(healthSlice.deals) || 0,
        healthPremium: Number(healthSlice.premium) || 0,
        elementary: Number(totals.elementary) || 0,
        pension: Number(totals.pension) || 0
      }
    };
  }

  async function persistSnapshot(force){
    if(!isMailAdmin()) return { skipped: true };
    const now = Date.now();
    if(!force && lastSnapshotAt && (now - lastSnapshotAt) < SNAPSHOT_GAP_MS) return { skipped: true };
    const snap = buildEmailHtml();
    await api("save-snapshot", snap);
    lastSnapshotAt = now;
    return snap;
  }

  function formatStatus(data){
    const lines = [];
    if(data.connectedEmail){
      lines.push("מייל שולח מחובר: " + data.connectedEmail);
      lines.push("שעת שליחה: כל יום ב־20:00 שעון ישראל");
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
        setMessage(err.message || String(err), true);
      }
    });
    nodes.connect?.addEventListener("click", async () => {
      try { await connectOutlook(); }
      catch(err) { setMessage(err.message || String(err), true); }
    });
    nodes.disconnect?.addEventListener("click", async () => {
      try {
        if(!window.confirm("לנתק את מייל Outlook? אפשר לחבר מייל אחר אחר כך.")) return;
        await api("disconnect");
        await refreshStatus();
        setMessage("המייל נותק. אפשר לחבר כתובת אחרת.");
      } catch(err) {
        setMessage(err.message || String(err), true);
      }
    });
    nodes.snapshot?.addEventListener("click", async () => {
      try {
        setMessage("שומר את דוח היום…");
        await persistSnapshot(true);
        await refreshStatus();
        setMessage("דוח היום נשמר לשליחה ב־20:00.");
      } catch(err) {
        setMessage(err.message || String(err), true);
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
        setMessage(err.message || String(err), true);
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
    refreshStatus().catch((err) => setMessage(err.message || String(err), true));
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
