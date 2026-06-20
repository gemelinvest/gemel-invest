(() => {
  "use strict";

  const CONFIG = {
    supabaseUrl: "https://vhvlkerectggovfihjgm.supabase.co",
    supabaseAnon: "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb",
    crmUrl: "/gemel-invest/",
    sessionKey: "investo_pwa_session_v1",
    iosDismissKey: "investo_pwa_ios_install_dismiss_v1",
    ownerUsername: "אוריה סומך"
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let session = null;
  let customers = [];
  let proposals = [];
  let reminders = [];
  let closedLeads = [];
  let currentView = "dashboard";
  let crmLoaded = false;

  /* ===== Session ===== */
  function loadSession() {
    try {
      const raw = localStorage.getItem(CONFIG.sessionKey);
      return raw ? JSON.parse(raw) : null;
    } catch (_e) {
      return null;
    }
  }

  function saveSession(data) {
    session = data;
    localStorage.setItem(CONFIG.sessionKey, JSON.stringify(data));
  }

  function clearSession() {
    session = null;
    localStorage.removeItem(CONFIG.sessionKey);
  }

  function getSession() { return session; }

  /* ===== Supabase API ===== */
  function apiHeaders(extra = {}) {
    return {
      apikey: CONFIG.supabaseAnon,
      Authorization: `Bearer ${CONFIG.supabaseAnon}`,
      Accept: "application/json",
      ...extra
    };
  }

  async function apiGet(path, params = {}) {
    const url = new URL(`${CONFIG.supabaseUrl}/rest/v1/${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== "") url.searchParams.set(k, v);
    });
    const res = await fetch(url.toString(), { headers: apiHeaders() });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  }

  async function apiUpsert(table, row) {
    const url = `${CONFIG.supabaseUrl}/rest/v1/${table}`;
    const res = await fetch(url, {
      method: "POST",
      headers: apiHeaders({
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      }),
      body: JSON.stringify(row)
    });
    if (!res.ok) throw new Error(`שמירה נכשלה (${res.status})`);
  }

  /* ===== Auth ===== */
  async function login(usernameRaw, pinRaw) {
    const username = usernameRaw.trim();
    const pin = pinRaw.trim();
    if (!username) throw new Error("נא להזין שם משתמש");
    if (!pin) throw new Error("נא להזין קוד כניסה");

    const metaRows = await apiGet("app_meta", {
      key: "eq.global",
      select: "key,payload,updated_at"
    });
    const agents = await apiGet("agents", {
      select: "id,name,username,pin,role,active"
    });

    const adminAuth = metaRows[0]?.payload?.adminAuth || {
      username: "מנהל מערכת",
      pin: "1234",
      active: true
    };

    if (adminAuth.active !== false &&
        username === String(adminAuth.username || "").trim() &&
        pin === String(adminAuth.pin || "").trim()) {
      const display = String(adminAuth.username || "").trim() || "מנהל מערכת";
      const role = display === CONFIG.ownerUsername ? "owner" : "admin";
      return { userKey: username, displayName: display, role, agentId: null };
    }

    const matched = agents.find(a => String(a.username || "").trim() === username) ||
      agents.find(a => String(a.name || "").trim() === username);

    if (!matched) throw new Error("שם משתמש לא נמצא");
    if (matched.active === false) throw new Error("המשתמש מושבת");

    const expectedPin = String(matched.pin || "").trim() || "0000";
    if (pin !== expectedPin) throw new Error("קוד כניסה שגוי");

    const display = String(matched.name || "").trim() ||
      String(matched.username || "").trim() || username;
    const roleRaw = String(matched.role || "").trim().toLowerCase();
    let role = "agent";
    if (["manager", "team_manager", "teammanager"].includes(roleRaw)) role = "manager";
    else if (roleRaw === "ops") role = "ops";
    else if (roleRaw === "referent") role = "referent";
    else if (roleRaw === "elementary") role = "elementary";

    return {
      userKey: username,
      displayName: display,
      role,
      agentId: matched.id || null
    };
  }

  /* ===== Data helpers ===== */
  function canViewAll() {
    return ["admin", "owner", "manager", "ops"].includes(session?.role || "");
  }

  function isArchived(row) {
    const s = String(row.status || "").trim().toLowerCase();
    return s === "inactive" || s === "archived" || s === "purged" || row.status === "גנוז";
  }

  function ownedByAgent(row) {
    const agent = String(row.agent_name || "").trim();
    if (!agent) return false;
    const name = session.displayName || "";
    const code = session.userKey || "";
    return (name && agent.toLowerCase() === name.toLowerCase()) ||
      (code && agent.toLowerCase() === code.toLowerCase());
  }

  function filterCustomers(rows) {
    const active = rows.filter(r => !isArchived(r));
    if (canViewAll()) return active;
    return active.filter(ownedByAgent);
  }

  function parsePayload(row) {
    const p = row.payload;
    if (!p) return {};
    if (typeof p === "object") return p;
    try { return JSON.parse(p); } catch (_e) { return {}; }
  }

  function collectPolicies(row) {
    const payload = parsePayload(row);
    const out = [];
    const existing = payload.existingPolicies || payload.existing_policies || [];
    const newPol = payload.newPolicies || payload.new_policies || [];
    [...existing, ...newPol].forEach(pol => {
      const premium = Number(pol.premiumMonthly || pol.premium_monthly || pol.monthlyPremium || 0);
      out.push({
        productLabel: String(pol.productLabel || pol.product_label || pol.product || ""),
        premiumMonthly: Number.isFinite(premium) ? premium : 0
      });
    });
    if (!out.length && row.monthly_premium_after_discount != null) {
      out.push({
        productLabel: "פרמיה",
        premiumMonthly: Number(row.monthly_premium_after_discount) || 0
      });
    }
    return out;
  }

  function netMonthlyPremium(rows) {
    return rows.reduce((sum, row) =>
      sum + collectPolicies(row).reduce((s, p) => s + p.premiumMonthly, 0), 0);
  }

  function salesTodayCount(rows) {
    const today = new Date();
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
    return rows.filter(row => {
      const raw = row.updated_at || row.created_at || "";
      const dt = new Date(raw);
      return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
    }).length;
  }

  function formatMoney(n) {
    const v = Math.round(Number(n) || 0);
    return `₪${v.toLocaleString("he-IL")}`;
  }

  function greeting() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "בוקר טוב,";
    if (h >= 12 && h < 17) return "צהריים טובים,";
    if (h >= 17 && h < 22) return "ערב טוב,";
    return "לילה טוב,";
  }

  function formatTime(raw) {
    if (!raw) return "";
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return "";
    const now = new Date();
    if (dt.toDateString() === now.toDateString()) {
      return dt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
    }
    const diff = Math.floor((now - dt) / 86400000);
    if (diff === 1) return "אתמול";
    if (diff < 7) return `לפני ${diff} ימים`;
    return dt.toLocaleDateString("he-IL");
  }

  function parsePhone(row) {
    const payload = parsePayload(row);
    return String(payload.phone || payload.mobile || row.phone || "").trim();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    let el = $("#ivToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "ivToast";
      el.className = "ivToast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("ivToast--show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("ivToast--show"), 3200);
  }

  function updateBadge(count) {
    const badgeEl = $("#ivNotifBadge");
    if (!badgeEl) return;
    if (count > 0) {
      badgeEl.hidden = false;
      badgeEl.textContent = String(count > 99 ? "99+" : count);
    } else {
      badgeEl.hidden = true;
    }
  }

  /* ===== Fetch ===== */
  async function refreshData() {
    const [custRows, propRows, remRows] = await Promise.all([
      apiGet("customers", {
        select: "id,status,full_name,agent_name,agent_role,new_policies_count,existing_policies_count,monthly_premium_after_discount,wizard_completed,created_at,updated_at,payload",
        order: "updated_at.desc",
        limit: "500"
      }),
      apiGet("proposals", {
        select: "id,status,full_name,agent_name,agent_role,current_step,insured_count,id_number,phone,email,city,created_at,updated_at,payload",
        order: "created_at.desc",
        limit: "200"
      }),
      session.agentId ? apiGet("reminders", {
        agent_id: `eq.${session.agentId}`,
        is_done: "eq.false",
        order: "remind_at.asc",
        select: "id,agent_id,type,details,remind_at,customer_id,customer_name,is_done,created_at,snoozed_until"
      }).catch(() => []) : Promise.resolve([])
    ]);

    customers = filterCustomers(custRows);
    proposals = propRows;
    reminders = remRows;
    if (window.InvestoNotify) window.InvestoNotify.refresh();
  }

  async function loadDailyReport() {
    const rows = await apiGet("gi_daily_report", {
      id: "eq.active",
      select: "id,uploaded_at,uploaded_by_name,report_as_of_date,sheet_name,header_row,data_rows",
      limit: "1"
    });
    return rows[0] || null;
  }

  /* ===== Render ===== */
  function renderDashboard() {
    $("#ivGreeting").textContent = greeting();
    $("#ivUserName").textContent = session.displayName || session.userKey;
    $("#ivMetricNet").textContent = formatMoney(netMonthlyPremium(customers));
    $("#ivMetricSalesToday").textContent = String(salesTodayCount(customers));
    $("#ivMetricAppoint").textContent = formatMoney(
      customers.reduce((s, r) => s + (Number(r.monthly_premium_after_discount) || 0), 0)
    );
    $("#ivMetricIssued").textContent = "—";
    $("#ivMetricCustomers").textContent = String(customers.length);

    const recent = [...customers]
      .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
      .slice(0, 8);

    const list = $("#ivRecentSales");
    if (!recent.length) {
      list.innerHTML = `<div class="ivEmpty">אין מכירות להצגה</div>`;
    } else {
      list.innerHTML = recent.map(row => {
        const premium = collectPolicies(row).reduce((s, p) => s + p.premiumMonthly, 0);
        const policies = collectPolicies(row).map(p => p.productLabel).filter(Boolean).slice(0, 2).join(", ");
        return `<article class="ivListItem">
          <div class="ivListItem__title">${escapeHtml(row.full_name || "לקוח")}</div>
          <div class="ivListItem__sub">נציג: ${escapeHtml(row.agent_name || "—")}${policies ? ` · ${escapeHtml(policies)}` : ""}</div>
          <div class="ivListItem__meta">
            <span class="ivListItem__amount">${formatMoney(premium)}/חודש</span>
            <span>${formatTime(row.updated_at || row.created_at)}</span>
          </div>
        </article>`;
      }).join("");
    }

    const leadsBtn = $("#ivMenuLeads");
    if (leadsBtn) {
      leadsBtn.hidden = !window.InvestoNotify?.canAccessLeads();
    }
    const leadsQuick = document.querySelector('.ivQuickBtn[data-nav="leads"]');
    if (leadsQuick) {
      leadsQuick.hidden = !window.InvestoNotify?.canAccessLeads();
    }
  }

  function renderCustomers(filter = "") {
    const q = filter.trim().toLowerCase();
    const rows = customers.filter(row => {
      if (!q) return true;
      const name = String(row.full_name || "").toLowerCase();
      return name.includes(q) || parsePhone(row).toLowerCase().includes(q);
    });

    const list = $("#ivCustomerList");
    if (!rows.length) {
      list.innerHTML = `<div class="ivEmpty">${q ? "לא נמצאו תוצאות" : "אין לקוחות"}</div>`;
      return;
    }
    list.innerHTML = rows.slice(0, 100).map(row => {
      const premium = collectPolicies(row).reduce((s, p) => s + p.premiumMonthly, 0);
      const phone = parsePhone(row);
      return `<article class="ivListItem">
        <div class="ivListItem__title">${escapeHtml(row.full_name || "לקוח")}</div>
        <div class="ivListItem__sub">${phone ? escapeHtml(phone) + " · " : ""}${escapeHtml(row.agent_name || "")}</div>
        <div class="ivListItem__meta">
          <span class="ivListItem__amount">${formatMoney(premium)}/חודש</span>
          <span>${collectPolicies(row).length} פוליסות</span>
        </div>
      </article>`;
    }).join("");
  }

  function renderClosedLeads() {
    const list = $("#ivLeadsList");
    const showAgent = ["admin", "owner", "manager"].includes(session?.role || "");
    if (!closedLeads.length) {
      list.innerHTML = `<div class="ivEmpty">אין לידים סגורים</div>`;
      $("#ivLeadsCount").textContent = "0 לידים";
      return;
    }
    $("#ivLeadsCount").textContent = `${closedLeads.length} לידים`;
    list.innerHTML = closedLeads.map(lead => `
      <article class="ivListItem">
        <div class="ivListItem__title">${escapeHtml(lead.customerName)}</div>
        <div class="ivListItem__sub">${escapeHtml(lead.phone || "")}${showAgent ? " · " + escapeHtml(lead.assignedAgentName) : ""}</div>
        <div class="ivListItem__meta">
          <span>${escapeHtml(lead.campaignLabel)}</span>
          <span>${formatTime(lead.closedAt || lead.updatedAt)}</span>
        </div>
        ${lead.closedNote ? `<div class="ivListItem__note">${escapeHtml(lead.closedNote)}</div>` : ""}
      </article>
    `).join("");
  }

  async function renderDailyReport() {
    const list = $("#ivDailyList");
    list.innerHTML = `<div class="ivEmpty">טוען דוח…</div>`;
    try {
      const report = await loadDailyReport();
      if (!report) {
        $("#ivDailyTitle").textContent = "דוח יומי";
        $("#ivDailyMeta").textContent = "לא הועלה דוח פעיל";
        list.innerHTML = `<div class="ivEmpty">אין דוח יומי פעיל במערכת</div>`;
        return;
      }
      $("#ivDailyTitle").textContent = "דוח יומי";
      $("#ivDailyMeta").textContent =
        `עודכן: ${formatTime(report.uploaded_at)} · ${report.uploaded_by_name || ""}`;

      let rows = [];
      const dataRows = report.data_rows;
      if (Array.isArray(dataRows)) rows = dataRows;
      else if (typeof dataRows === "string") {
        try { rows = JSON.parse(dataRows); } catch (_e) { rows = []; }
      }

      if (!rows.length) {
        list.innerHTML = `<div class="ivEmpty">הדוח ריק</div>`;
        return;
      }

      list.innerHTML = rows.slice(0, 50).map((row, i) => {
        const cells = Array.isArray(row) ? row : Object.values(row);
        const title = cells[0] != null ? String(cells[0]) : `שורה ${i + 1}`;
        const sub = cells.slice(1, 4).filter(Boolean).map(String).join(" · ");
        return `<article class="ivListItem">
          <div class="ivListItem__title">${escapeHtml(title)}</div>
          ${sub ? `<div class="ivListItem__sub">${escapeHtml(sub)}</div>` : ""}
        </article>`;
      }).join("");
    } catch (err) {
      list.innerHTML = `<div class="ivEmpty">שגיאה בטעינת הדוח: ${escapeHtml(err.message)}</div>`;
    }
  }

  /* ===== Navigation ===== */
  function showView(name) {
    currentView = name;
    $$(".ivView--page, .ivView--crm, .ivView--wizard").forEach(v => { v.hidden = true; });
    $$(".ivBottomNav__item").forEach(b => {
      b.classList.toggle("ivBottomNav__item--active", b.dataset.nav === name);
    });

    if (name === "dashboard") {
      $("#viewDashboard").hidden = false;
      renderDashboard();
    } else if (name === "customers") {
      $("#viewCustomers").hidden = false;
      renderCustomers($("#ivCustomerSearch").value);
    } else if (name === "daily") {
      $("#viewDaily").hidden = false;
      renderDailyReport();
    } else if (name === "crm") {
      $("#viewCrm").hidden = false;
      loadCrmFrame();
    } else if (name === "notifications") {
      $("#viewNotifications").hidden = false;
      window.InvestoNotify?.renderNotifications();
    } else if (name === "leads") {
      $("#viewLeads").hidden = false;
      renderClosedLeads();
    } else if (name === "wizard") {
      $("#viewWizard").hidden = false;
    }
    closeMenu();
  }

  function getCurrentView() { return currentView; }
  function getCustomers() { return customers; }
  function getReminders() { return reminders; }
  function setClosedLeads(rows) { closedLeads = rows; }

  function loadCrmFrame() {
    const frame = $("#ivCrmFrame");
    if (!crmLoaded) {
      frame.src = new URL(CONFIG.crmUrl, location.href).href;
      crmLoaded = true;
      frame.addEventListener("load", tryCrmAutoLogin, { once: false });
    }
  }

  function tryCrmAutoLogin() {
    try {
      const doc = $("#ivCrmFrame").contentDocument;
      if (!doc) return;
      const userEl = doc.getElementById("lcLoginUser");
      const pinEl = doc.getElementById("lcLoginPin");
      const form = doc.getElementById("lcLoginForm");
      if (!userEl || !pinEl || !form || !session) return;
      if (doc.body && !doc.body.classList.contains("lcAuthLock")) return;
      userEl.value = session.userKey;
      pinEl.value = session.pin;
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
    } catch (_e) {}
  }

  function openMenu() { $("#ivMenu").hidden = false; }
  function closeMenu() { $("#ivMenu").hidden = true; }

  function showLogin() {
    document.body.classList.add("ivBody--auth");
    document.body.classList.remove("ivBody--app");
    $("#viewLogin").hidden = false;
    $("#ivApp").hidden = true;
    window.InvestoNotify?.stop();
  }

  function showApp() {
    document.body.classList.remove("ivBody--auth");
    document.body.classList.add("ivBody--app");
    $("#viewLogin").hidden = true;
    $("#ivApp").hidden = false;
    window.InvestoNotify?.start();
    showView("dashboard");
  }

  function hideSplash() {
    const splash = $("#ivSplash");
    if (!splash) return;
    splash.classList.add("ivSplash--hide");
    setTimeout(() => splash.remove(), 500);
  }

  function isIos() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  function maybeShowIosInstall() {
    if (!isIos() || isStandalone()) return;
    if (localStorage.getItem(CONFIG.iosDismissKey) === "1") return;
    $("#ivIosInstall").hidden = false;
  }

  async function registerSw() {
    if (!("serviceWorker" in navigator)) return;
    try {
      await navigator.serviceWorker.register("./service-worker.js");
    } catch (err) {
      console.warn("SW registration failed:", err);
    }
  }

  window.InvestoPwa = {
    CONFIG,
    apiGet,
    apiUpsert,
    escapeHtml,
    formatMoney,
    formatTime,
    toast,
    refreshData,
    updateBadge,
    getSession,
    getCustomers,
    getReminders,
    setClosedLeads,
    getCurrentView,
    showView,
    renderClosedLeads
  };

  function bindEvents() {
    $("#ivLoginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("#ivLoginBtn");
      const errEl = $("#ivLoginError");
      errEl.hidden = true;
      btn.disabled = true;
      btn.textContent = "מתחבר…";
      try {
        const result = await login($("#ivLoginUser").value, $("#ivLoginPin").value);
        saveSession({ ...result, pin: $("#ivLoginPin").value.trim() });
        await refreshData();
        showApp();
      } catch (err) {
        errEl.textContent = err.message || "שגיאה בהתחברות";
        errEl.hidden = false;
      } finally {
        btn.disabled = false;
        btn.textContent = "התחבר";
      }
    });

    $$("[data-nav]").forEach(el => {
      el.addEventListener("click", () => showView(el.dataset.nav));
    });

    $$("[data-action]").forEach(el => {
      el.addEventListener("click", () => {
        if (el.dataset.action === "wizard") window.InvestoWizard?.start();
      });
    });

    $("#ivMenuBtn").addEventListener("click", openMenu);
    $("#ivMenu").querySelector("[data-close-menu]").addEventListener("click", closeMenu);
    $("#ivLogoutBtn").addEventListener("click", () => {
      clearSession();
      crmLoaded = false;
      $("#ivCrmFrame").src = "about:blank";
      showLogin();
    });

    $("#ivCustomerSearch").addEventListener("input", (e) => {
      renderCustomers(e.target.value);
    });

    $("#ivNotifBtn").addEventListener("click", () => showView("notifications"));

    $("#ivIosInstallDismiss").addEventListener("click", () => {
      localStorage.setItem(CONFIG.iosDismissKey, "1");
      $("#ivIosInstall").hidden = true;
    });
  }

  async function boot() {
    window.InvestoWizard?.init();
    window.InvestoNotify?.init();
    bindEvents();
    registerSw();
    hideSplash();
    maybeShowIosInstall();

    session = loadSession();
    if (session) {
      try {
        await refreshData();
        showApp();
      } catch (_e) {
        clearSession();
        showLogin();
      }
    } else {
      showLogin();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
