/* ONYX phone. New files only: no desktop code, no new login, no new 2FA.
   Reads the existing session opener and the existing summary queries. */
(function () {
  "use strict";

  const SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const SUPABASE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
  const PROFILE_KEY = "onyx-phone-profile";
  const ALLOWED = { agent: "נציג", manager: "מנהל", admin: "מנהל", teammanager: "מנהל צוות" };

  const $ = (id) => document.getElementById(id);
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "onyx-phone-auth" }
  });

  const state = {
    profile: null,
    scope: null,
    factorId: "",
    report: null,
    companies: null,
    customers: [],
    searchTimer: 0,
    cancelReport: null,
    cancelSheet: 0,
    cancelQuery: "",
    appointReport: null,
    appointQuery: "",
    ringItem: null,
    file: null,
    fileTab: "policies",
    filePolicies: [],
    fileDocs: [],
    policyIndex: -1,
    policyTab: "details",
    policyReport: false,
    policyDocs: [],
    agents: [],
    assignAgentId: "",
    account: "",
    noticeSending: false,
    sim: null,
    activityTimer: 0,
    alertTimer: 0,
    homeTimer: 0,
    homeBusy: false,
    reminderType: "",
    docUrl: "",
    docBlob: null,
    docName: "",
    pushNote: ""
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function trim(value) {
    return String(value == null ? "" : value).trim();
  }

  function token(value) {
    return trim(value)
      .toLowerCase()
      .replace(/["'`׳״.,;:!?()[\]{}<>|\\/+\-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function roleKey(role) {
    const raw = trim(role).toLowerCase();
    if (raw === "מנהל צוות" || raw === "team_manager" || raw === "teammanager") return "teammanager";
    if (raw === "מנהל" || raw === "manager") return "manager";
    if (raw === "admin" || raw === "מנהל מערכת" || raw === "owner") return "admin";
    if (raw === "נציג" || raw === "agent") return "agent";
    return raw;
  }

  function money(value) {
    const n = Number(value);
    const rounded = Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
    return "₪" + rounded.toLocaleString("he-IL", { maximumFractionDigits: 2 });
  }

  function israelRange() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(now);
    const get = (type) => parts.find((part) => part.type === type).value;
    const y = Number(get("year"));
    const m = Number(get("month"));
    const d = Number(get("day"));
    const wall = Date.UTC(y, m - 1, d, Number(get("hour")), Number(get("minute")), Number(get("second")));
    const offset = wall - now.getTime();
    const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offset);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  function israelMonth(shift) {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(now);
    const get = (type) => parts.find((part) => part.type === type).value;
    const y = Number(get("year"));
    const m = Number(get("month"));
    const wall = Date.UTC(y, m - 1, Number(get("day")), Number(get("hour")), Number(get("minute")), Number(get("second")));
    const offset = wall - now.getTime();
    const start = new Date(Date.UTC(y, m - 1 + shift, 1, 0, 0, 0) - offset);
    const end = new Date(Date.UTC(y, m + shift, 1, 0, 0, 0) - offset);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  function fitFrame() {
    const view = window.visualViewport;
    const shell = document.querySelector(".shell");
    if (!view || !shell) return;
    const top = Math.round(view.offsetTop || 0);
    document.body.style.top = "0px";
    document.body.style.bottom = "0px";
    document.body.style.height = "auto";
    shell.style.top = top + "px";
    shell.style.bottom = "0px";
    shell.style.height = "auto";
  }

  function lockScreen() {
    let startX = 0;
    let startY = 0;
    let axis = "";
    document.addEventListener("touchstart", (event) => {
      const point = event.touches && event.touches[0];
      axis = "";
      if (!point) return;
      startX = point.clientX;
      startY = point.clientY;
    }, { passive: true });
    document.addEventListener("touchmove", (event) => {
      const point = event.touches && event.touches[0];
      if (!point || event.touches.length !== 1) {
        event.preventDefault();
        return;
      }
      const dx = point.clientX - startX;
      const dy = point.clientY - startY;
      if (!axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (axis !== "x") return;
      const table = event.target && event.target.closest && event.target.closest(".tableScroll");
      if (table) return;
      event.preventDefault();
    }, { passive: false });
    window.addEventListener("scroll", () => {
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    });
    fitFrame();
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", fitFrame);
      window.visualViewport.addEventListener("scroll", fitFrame);
    }
    window.addEventListener("orientationchange", fitFrame);
    window.addEventListener("resize", fitFrame);
  }

  function show(name) {
    closeDocument();
    document.querySelectorAll("[data-screen]").forEach((node) => {
      node.hidden = node.getAttribute("data-screen") !== name;
    });
    const app = name === "home" || name === "customers" || name === "report" || name === "profile" || name === "alerts" || name === "reports";
    if (name !== "home") {
      const menu = $("homeMenu");
      const opener = $("btnMenu");
      if (menu) menu.hidden = true;
      if (opener) opener.setAttribute("aria-expanded", "false");
    }
    $("tabbar").hidden = !app;
    document.querySelectorAll(".tab").forEach((tab) => {
      const key = tab.getAttribute("data-tab");
      const homeOn = (name === "home" || name === "profile") && key === "home";
      const reportsOn = (name === "reports" || name === "report") && key === "reports";
      tab.classList.toggle("is-on", homeOn || reportsOn || (name === "customers" && key === "customers") || (name === "alerts" && key === "alerts"));
    });
    if (state.activityTimer) {
      window.clearInterval(state.activityTimer);
      state.activityTimer = 0;
    }
    if (state.homeTimer) {
      window.clearInterval(state.homeTimer);
      state.homeTimer = 0;
    }
    if (name === "activity") {
      state.activityTimer = window.setInterval(() => { void refreshActivity(); }, 8000);
    }
    if (name === "home" && state.profile) {
      void refreshHomeMetrics();
      state.homeTimer = window.setInterval(() => { void refreshHomeMetrics(); }, 10000);
    }
    if (name === "splash") playSplash();
  }

  let splashToken = 0;
  function playSplash() {
    const splash = $("screenSplash");
    if (!splash) return;
    const token = ++splashToken;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    splash.classList.remove("is-on");
    if (reduced) {
      splash.classList.add("is-on");
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (token !== splashToken) return;
        splash.classList.add("is-on");
      });
    });
  }

  function setBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
  }

  function loginMessage(code) {
    const key = trim(code);
    if (key === "LOCKED" || key === "ACCOUNT_LOCKED") return "נעלת את הכניסה לאחר מספר ניסיונות כושלים. נסה שוב מאוחר יותר או פנה למנהל המערכת.";
    if (key === "USERNAME_AMBIGUOUS") return "שם המשתמש לא חד-משמעי. פנה למנהל המערכת.";
    if (key === "AGENT_NOT_FOUND" || key === "USER_NOT_FOUND") return "שם משתמש לא נמצא";
    if (key === "BAD_PIN") return "קוד כניסה שגוי";
    if (key === "AGENT_DISABLED") return "המשתמש מושבת";
    if (key === "AGENT_HAS_NO_AUTH_ACCOUNT") return "לא הצלחתי לפתוח את האימות הדו־שלבי. הכניסה נעצרה.";
    return "לא הצלחתי לפתוח את האימות הדו־שלבי. הכניסה נעצרה. נסה שוב בעוד דקה.";
  }

  async function signOut() {
    state.profile = null;
    state.scope = null;
    state.factorId = "";
    state.report = null;
    state.companies = null;
    if (state.activityTimer) window.clearInterval(state.activityTimer);
    if (state.alertTimer) window.clearInterval(state.alertTimer);
    if (state.homeTimer) window.clearInterval(state.homeTimer);
    state.activityTimer = 0;
    state.alertTimer = 0;
    state.homeTimer = 0;
    state.homeBusy = false;
    stopSaleWatch();
    try { sessionStorage.removeItem(PROFILE_KEY); } catch (_err) {}
    try { await sb.auth.signOut(); } catch (_err) {}
  }

  async function assurance() {
    const res = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    return trim(res?.data?.currentLevel);
  }

  async function openSession(username, pin) {
    const res = await fetch(SUPABASE_URL + "/functions/v1/gi-open-agent-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY
      },
      body: JSON.stringify({ username: username, pin: pin })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data || data.ok !== true || !data.access_token) {
      throw new Error(loginMessage(data && data.error));
    }
    const role = roleKey(data.role);
    if (!ALLOWED[role]) {
      throw new Error("האפליקציה פתוחה למנהל, לנציג ולמנהל צוות בלבד.");
    }
    const set = await sb.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token || ""
    });
    if (set.error) throw new Error("לא הצלחתי לפתוח את האימות הדו־שלבי. הכניסה נעצרה.");
    state.profile = {
      id: trim(data.agentId),
      name: trim(data.agentName) || username,
      username: username,
      role: role
    };
    const listed = await sb.auth.mfa.listFactors();
    if (listed.error) throw new Error("לא הצלחתי להכין את האימות הדו־שלבי לכניסה");
    const totp = (listed.data && listed.data.totp) || [];
    const factor = totp.find((item) => trim(item.status).toLowerCase() === "verified");
    if (!factor || !factor.id) {
      await signOut();
      throw new Error("האימות הדו־שלבי לא מוגדר במערכת. לא נוצר אימות חדש.");
    }
    state.factorId = factor.id;
  }

  async function verifyCode(code) {
    const clean = String(code || "").replace(/\D/g, "").slice(0, 6);
    if (clean.length !== 6) throw new Error("יש להזין קוד בן 6 ספרות בדיוק");
    const challenge = await sb.auth.mfa.challenge({ factorId: state.factorId });
    if (challenge.error) throw new Error("הקוד שגוי או שפג תוקפו. נסה שוב.");
    const challengeId = challenge.data && (challenge.data.id || challenge.data.challengeId);
    const verified = await sb.auth.mfa.verify({
      factorId: state.factorId,
      challengeId: challengeId,
      code: clean
    });
    if (verified.error) throw new Error("הקוד שגוי או שפג תוקפו. נסה שוב.");
    if ((await assurance()) !== "aal2") throw new Error("האימות הדו־שלבי לא הושלם.");
    try { sessionStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile)); } catch (_err) {}
  }

  async function loadScope() {
    if (state.scope) return state.scope;
    const profile = state.profile;
    if (!profile) return null;
    if (profile.role === "manager" || profile.role === "admin") {
      state.scope = null;
      return null;
    }
    const ids = [profile.id].filter(Boolean);
    const names = [profile.name, profile.username].map(trim).filter(Boolean);
    if (profile.role === "teammanager" && profile.id) {
      const team = await sb.from("agents").select("id,name,username").eq("team_manager_id", profile.id).limit(200);
      (team.data || []).forEach((row) => {
        if (row.id) ids.push(row.id);
        if (trim(row.name)) names.push(trim(row.name));
        if (trim(row.username)) names.push(trim(row.username));
      });
    }
    state.scope = { ids: ids, names: names, tokens: new Set(names.map(token)) };
    return state.scope;
  }

  function scopeArgs(range) {
    const args = { p_start: range.start, p_end: range.end };
    if (state.scope) {
      args.p_agent_ids = state.scope.ids;
      args.p_agent_names = state.scope.names;
    }
    return args;
  }

  async function loadNet(range) {
    const res = await sb.rpc("gi_dashboard_net_premium", scopeArgs(range));
    if (res.error) throw new Error(res.error.message || "sold");
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    return Number(row && (row.net_premium != null ? row.net_premium : row.netPremium)) || 0;
  }

  async function countCustomers(withPolicies) {
    let query = sb.from("customers").select("id", { count: "exact", head: true }).eq("is_archived", false);
    if (state.scope) query = query.in("agent_id", state.scope.ids);
    if (withPolicies) query = query.or("new_policies_count.gt.0,existing_policies_count.gt.0");
    const res = await query;
    if (res.error) throw new Error(res.error.message || "customers");
    return Number(res.count) || 0;
  }

  async function countPolicies() {
    let total = 0;
    let from = 0;
    const page = 400;
    for (let i = 0; i < 8; i += 1) {
      let query = sb.from("customers")
        .select("new_policies_count,existing_policies_count")
        .eq("is_archived", false)
        .range(from, from + page - 1);
      if (state.scope) query = query.in("agent_id", state.scope.ids);
      const res = await query;
      if (res.error) throw new Error(res.error.message || "policies");
      const rows = res.data || [];
      rows.forEach((row) => {
        total += (Number(row.new_policies_count) || 0) + (Number(row.existing_policies_count) || 0);
      });
      if (rows.length < page) break;
      from += page;
    }
    return total;
  }

  async function loadCompanies() {
    const res = await sb.rpc("gi_dashboard_sales_by_company", scopeArgs(israelRange()));
    if (res.error) throw new Error(res.error.message || "companies");
    state.companies = (Array.isArray(res.data) ? res.data : []).map((row) => ({
      company: trim(row.company) || "ללא חברה",
      premium: Number(row.premium) || 0,
      policies: Number(row.policies) || 0
    }));
    return state.companies;
  }

  async function loadLeadCount() {
    const range = israelRange();
    let query = sb.from("campaign_leads").select("id", { count: "exact", head: true })
      .gte("created_at", range.start)
      .lt("created_at", range.end);
    if (state.scope) query = query.in("assigned_agent_id", state.scope.ids);
    const res = await query;
    if (res.error) throw new Error(res.error.message || "leads");
    return Number(res.count) || 0;
  }

  async function countIncomingLeads() {
    const range = israelRange();
    let query = sb.from("campaign_leads").select("id", { count: "exact", head: true })
      .gte("created_at", range.start)
      .lt("created_at", range.end)
      .not("assigned_agent_id", "is", null)
      .neq("assigned_agent_id", "");
    if (state.scope) query = query.in("assigned_agent_id", state.scope.ids);
    const res = await query;
    if (res.error) throw new Error(res.error.message || "incoming leads");
    return Number(res.count) || 0;
  }

  function findCol(headers, names) {
    const list = Array.isArray(headers) ? headers.map((item) => trim(item).toLowerCase()) : [];
    for (let i = 0; i < names.length; i += 1) {
      const exact = list.indexOf(names[i].toLowerCase());
      if (exact >= 0) return exact;
    }
    for (let i = 0; i < names.length; i += 1) {
      const idx = list.findIndex((header) => header.includes(names[i].toLowerCase()));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  function parseMoney(value) {
    const raw = trim(value);
    if (!raw || raw === "—") return 0;
    const n = Number(raw.replace(/[₪\s]/g, "").replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  }

  function cell(row, index) {
    if (!row || index < 0) return "";
    return trim(row.cells && row.cells[index]);
  }

  function issuedStatus(value) {
    const norm = token(value);
    if (!norm || norm.includes("ממתין")) return false;
    return norm === "הופק" || norm === "הופקה";
  }

  function pendingStatus(value) {
    const norm = token(value);
    return norm === "ממתין להפקה" || norm === "ממתינה להפקה";
  }

  function rowVisible(row) {
    if (!state.scope) return true;
    const key = token(row && row.agent);
    return !!key && state.scope.tokens.has(key);
  }

  async function loadReport(force) {
    if (state.report && !force) return state.report;
    // report_as_of_date is not a column on the live table. Naming it
    // makes the whole read fail, so the tiles and the daily report stay empty.
    const res = await sb.from("gi_daily_report")
      .select("header_row,data_rows")
      .eq("id", "active")
      .maybeSingle();
    if (res.error) throw new Error(res.error.message || "report");
    const row = res.data || {};
    const headers = Array.isArray(row.header_row) ? row.header_row.map((item) => trim(item)) : [];
    const agentCol = findCol(headers, ["נציג", "שם נציג", "סוכן"]);
    const rows = (Array.isArray(row.data_rows) ? row.data_rows : []).map((item) => {
      const cells = Array.isArray(item && item.cells) ? item.cells.map((value) => trim(value)) : [];
      return {
        agent: trim(item && (item.agent || item.agent_name)) || (agentCol >= 0 ? cells[agentCol] : ""),
        cells: cells
      };
    }).filter(rowVisible);
    state.report = {
      asOf: "",
      headers: headers,
      rows: rows,
      cols: {
        status: findCol(headers, ["סטטוס הצעה", "סטטוס"]),
        team: findCol(headers, ["צוות"]),
        plan: findCol(headers, ["שם תוכנית", "תוכנית"]),
        premium: findCol(headers, ["פרמיה חודשית", "פרמיה לחודש", "סכום פרמיה", "פרמיה נטו", "פרמיה"]),
        issuedPremium: findCol(headers, ["פרמיה הפקה"])
      }
    };
    return state.report;
  }

  function reportStats(report) {
    const out = { issued: 0, pending: 0 };
    if (!report || report.cols.status < 0) return out;
    report.rows.forEach((row) => {
      const status = cell(row, report.cols.status);
      if (issuedStatus(status)) out.issued += parseMoney(cell(row, report.cols.issuedPremium));
      else if (pendingStatus(status)) {
        const base = report.cols.premium >= 0 ? parseMoney(cell(row, report.cols.premium)) : 0;
        out.pending += base > 0 ? base : parseMoney(cell(row, report.cols.issuedPremium));
      }
    });
    return out;
  }

  function customerBucket(row) {
    const status = trim(row.status);
    const low = status.toLowerCase();
    if (row.is_archived === true || low === "inactive" || low === "archived" || low === "purged" || status === "גנוז") return "archive";
    if (low.includes("pending") || status.includes("ממתין")) return "pending";
    return "active";
  }

  async function loadCustomers(queryText) {
    const q = trim(queryText);
    let query = sb.from("customers")
      .select("id,full_name,id_number,phone,status,is_archived,agent_id,new_policies_count,existing_policies_count,created_at")
      .order("created_at", { ascending: false })
      .limit(q ? 20 : 40);
    if (state.scope) query = query.in("agent_id", state.scope.ids);
    query = query.eq("is_archived", false);
    if (q) {
      const safe = q.replace(/[%_,.()]/g, " ").trim();
      const digits = q.replace(/\D/g, "");
      const parts = [];
      if (safe) parts.push("full_name.ilike.%" + safe + "%");
      if (digits.length >= 2) {
        parts.push("id_number.ilike.%" + digits + "%");
        parts.push("phone.ilike.%" + digits + "%");
      }
      if (!parts.length) return [];
      query = query.or(parts.join(","));
    }
    const res = await query;
    if (res.error) throw new Error(res.error.message || "customers");
    return (res.data || []).slice(0, q ? 20 : 10);
  }

  function paintCustomers(rows) {
    const host = $("customerList");
    if (!rows.length) {
      host.innerHTML = '<div class="empty">אין לקוחות להצגה</div>';
      return;
    }
    const marks = ["#3870ED", "#7C5CD6", "#0F9F8F", "#E07A2F", "#E15B78"];
    host.innerHTML = rows.map((row) => {
      const name = trim(row.full_name) || "לקוח";
      let tone = 0;
      for (let i = 0; i < name.length; i += 1) tone = (tone + name.charCodeAt(i)) % marks.length;
      return '<button class="cust" type="button" data-customer="' + esc(row.id) + '"><span class="cust__mark" style="background:' + marks[tone] + '">' + esc(name.slice(0, 1)) + '</span><div class="cust__main"><div class="cust__name">' + esc(name) + "</div></div></button>";
    }).join("");
  }

  function fillSelect(select, values, label) {
    const current = select.value;
    select.innerHTML = '<option value="">' + esc(label) + "</option>" + values.map((value) => '<option value="' + esc(value) + '">' + esc(value) + "</option>").join("");
    if (values.indexOf(current) >= 0) select.value = current;
  }

  function filteredReportRows() {
    const report = state.report;
    if (!report) return [];
    const q = trim($("reportSearch").value).toLowerCase();
    const agent = $("filterAgent").value;
    const status = $("filterStatus").value;
    const team = $("filterTeam").value;
    const plan = $("filterPlan").value;
    return report.rows.filter((row) => {
      if (agent && token(row.agent) !== token(agent)) return false;
      if (status && cell(row, report.cols.status) !== status) return false;
      if (team && cell(row, report.cols.team) !== team) return false;
      if (plan && cell(row, report.cols.plan) !== plan) return false;
      if (!q) return true;
      return (row.cells.join(" ") + " " + row.agent).toLowerCase().includes(q);
    });
  }

  function unique(rows, index, fromAgent) {
    const set = new Set();
    rows.forEach((row) => {
      const value = fromAgent ? trim(row.agent) : cell(row, index);
      if (value) set.add(value);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }

  function paintReport() {
    const report = state.report;
    const stats = reportStats(report || { rows: [], cols: { status: -1 } });
    $("reportIssued").textContent = money(stats.issued);
    $("reportPending").textContent = money(stats.pending);
    $("reportAsOf").textContent = report && report.asOf ? "נכון לתאריך " + report.asOf : "";
    if (!report) return;
    fillSelect($("filterAgent"), unique(report.rows, -1, true), "נציג — הכל");
    fillSelect($("filterStatus"), unique(report.rows, report.cols.status, false), "סטטוס — הכל");
    fillSelect($("filterTeam"), unique(report.rows, report.cols.team, false), "צוות — הכל");
    fillSelect($("filterPlan"), unique(report.rows, report.cols.plan, false), "תוכנית — הכל");
    const rows = filteredReportRows();
    $("reportMeta").textContent = "מוצגות " + rows.length + " שורות";
    const head = report.headers.length ? report.headers : ["שורה"];
    const body = rows.slice(0, 200).map((row) => "<tr>" + head.map((_header, index) => "<td>" + esc(cell(row, index)) + "</td>").join("") + "</tr>").join("");
    const more = rows.length > 200 ? "<tr><td colspan=\"" + head.length + "\">מוצגות 200 השורות הראשונות מתוך " + rows.length + "</td></tr>" : "";
    $("reportTable").innerHTML = "<table><thead><tr>" + head.map((header) => "<th>" + esc(header || "—") + "</th>").join("") + "</tr></thead><tbody>" + (body || "<tr><td>אין שורות</td></tr>") + more + "</tbody></table>";
  }

  function positive(value) {
    const n = Number(String(value == null ? "" : value).replace(/[₪\s,]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function policyMonthly(policy) {
    if (!policy || typeof policy !== "object") return 0;
    const sim = policy.simDiscountPerInsured;
    if (sim && typeof sim === "object") {
      let sum = 0;
      let any = false;
      Object.keys(sim).forEach((key) => {
        const n = positive(sim[key] && sim[key].monthlyAfterDiscount);
        if (n > 0) { sum += n; any = true; }
      });
      if (any) return Math.round(sum * 100) / 100;
    }
    if (trim(policy.type) === "בריאות" && (policy.coverDiscountsApplied === true || policy.coverDiscountsApplied === "true")) {
      const cover = positive(policy.premiumAfterCoverDiscounts);
      if (cover > 0) return cover;
    }
    const fields = ["premiumAfterDiscountValue", "premiumAfterDiscount", "monthlyPremium", "premiumMonthly", "premiumValue", "premium"];
    for (let i = 0; i < fields.length; i += 1) {
      const n = positive(policy[fields[i]]);
      if (n > 0) return n;
    }
    return 0;
  }

  function policyRows(payload) {
    const root = payload && typeof payload === "object" ? payload : {};
    const fresh = Array.isArray(root.newPolicies) && root.newPolicies.length
      ? root.newPolicies
      : (root.operational && Array.isArray(root.operational.newPolicies) ? root.operational.newPolicies : []);
    const elementary = Array.isArray(root.elementaryPolicies) ? root.elementaryPolicies : [];
    const rows = [];
    const seen = new Set();
    fresh.concat(elementary).forEach((policy) => {
      if (!policy || typeof policy !== "object" || trim(policy.origin) === "existing") return;
      const id = trim(policy.id);
      if (id && seen.has(id)) return;
      if (id) seen.add(id);
      rows.push(policy);
    });
    return rows;
  }

  function policyTitle(policy) {
    return trim(policy.type) || trim(policy.product) || trim(policy.name) || trim(policy.planName) || "פוליסה";
  }

  function policySub(policy, title) {
    const company = trim(policy.company) || trim(policy.insurer) || trim(policy.companyName);
    const kind = trim(policy.product) || trim(policy.plan) || trim(policy.category);
    const extra = kind && kind !== title ? kind : "";
    if (company && extra) return company + " | " + extra;
    return company || extra;
  }

  function policyTone(title) {
    if (/בריאות/.test(title)) return "#3870ED";
    if (/חיים/.test(title)) return "#16A34A";
    if (/נכות|אובדן|כושר/.test(title)) return "#7C5CD6";
    if (/פנס|גמל|השתלמות|חיסכון/.test(title)) return "#3870ED";
    return "#0F9F8F";
  }

  function policyIcon(title) {
    if (/בריאות/.test(title)) return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z"/></svg>';
    if (/חיים/.test(title)) return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 5 6v6c0 4.2 2.8 7.2 7 9 4.2-1.8 7-4.8 7-9V6z"/></svg>';
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>';
  }

  async function loadCustomerFile(id) {
    let query = sb.from("customers")
      .select("id,full_name,id_number,phone,status,is_archived,agent_id,agent_name,payload")
      .eq("id", id)
      .limit(1);
    if (state.scope) query = query.in("agent_id", state.scope.ids);
    const res = await query.maybeSingle();
    if (res.error) throw new Error(res.error.message || "customer");
    return res.data || null;
  }

  function showDate(value) {
    const raw = trim(value);
    if (!raw) return "";
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[3] + "." + iso[2] + "." + iso[1];
    const dmy = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (dmy) return dmy[1].padStart(2, "0") + "." + dmy[2].padStart(2, "0") + "." + dmy[3];
    return raw;
  }

  function customerDocs(payload) {
    const list = payload && Array.isArray(payload.customerDocuments) ? payload.customerDocuments : [];
    return list.filter((doc) => doc && typeof doc === "object");
  }

  function docTitle(doc) {
    const name = trim(doc.name) || trim(doc.fileName) || trim(doc.originalFileName);
    if (name) return name;
    const type = trim(doc.type);
    const labels = {
      operational_report_health: "דוח תפעולי",
      operational_report_agent_appointment: "דוח תפעולי",
      har_bituach_file: "הר הביטוח",
      suitability_document: "הצהרת התאמה",
      nispah_he_har_auth: "הצהרת ביטוח",
      customer_arrival_pack: "מסמכי הגעה",
      premium_development_report: "דוח התפתחות פרמיה",
      company_cancel_form: "טופס ביטול",
      agent_appointment_form: "טופס מינוי סוכן"
    };
    return labels[type] || "מסמך";
  }

  function fileHref(file) {
    if (!file || typeof file !== "object") return "";
    const data = trim(file.dataUrl) || trim(file.data) || trim(file.base64);
    if (data.indexOf("data:") === 0) return data;
    const url = trim(file.url);
    if (url.indexOf("data:") === 0 || /^https?:/i.test(url)) return url;
    return "";
  }

  function filePath(file) {
    return trim(file && (file.storagePath || file.storage_path));
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "document";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function fileBlob(file) {
    const href = fileHref(file);
    if (href) {
      const res = await fetch(href);
      if (!res.ok) throw new Error("לא ניתן לפתוח את הקובץ");
      return await res.blob();
    }
    const path = filePath(file);
    if (!path) {
      const err = new Error("אין קובץ שמור");
      err.code = "nofile";
      throw err;
    }
    const bucket = trim(file.storageBucket || file.storage_bucket) || "gi-customer-files";
    const res = await sb.storage.from(bucket).download(path);
    if (res.error || !res.data) throw new Error("לא ניתן לפתוח את הקובץ");
    return res.data;
  }

  async function sniffMime(blob, name) {
    const given = trim(blob && blob.type);
    if (given && given !== "application/octet-stream") return given;
    const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return "application/pdf";
    if (head[0] === 0xff && head[1] === 0xd8) return "image/jpeg";
    if (head[0] === 0x89 && head[1] === 0x50) return "image/png";
    if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return "image/gif";
    if (/\.pdf$/i.test(name)) return "application/pdf";
    if (/\.png$/i.test(name)) return "image/png";
    if (/\.jpe?g$/i.test(name)) return "image/jpeg";
    if (/\.webp$/i.test(name)) return "image/webp";
    return given || "";
  }

  let docToken = 0;

  function closeDocument() {
    docToken += 1;
    if (state.docUrl) URL.revokeObjectURL(state.docUrl);
    state.docUrl = "";
    state.docBlob = null;
    const view = $("docView");
    if (view) view.hidden = true;
  }

  async function viewDocument(file) {
    const view = $("docView");
    const body = $("docViewBody");
    const title = $("docViewTitle");
    const save = $("btnDocSave");
    if (!view || !body || !title) return;
    closeDocument();
    const token = docToken;
    const name = docTitle(file) || "מסמך";
    state.docName = name;
    title.textContent = name;
    body.innerHTML = '<div class="empty">טוען…</div>';
    if (save) save.hidden = true;
    view.hidden = false;
    try {
      const blob = await fileBlob(file);
      if (token !== docToken) return;
      const mime = await sniffMime(blob, name);
      const typed = mime && blob.type !== mime ? new Blob([blob], { type: mime }) : blob;
      const url = URL.createObjectURL(typed);
      if (token !== docToken) {
        URL.revokeObjectURL(url);
        return;
      }
      state.docBlob = typed;
      state.docName = name;
      state.docUrl = url;
      body.replaceChildren();
      if (mime.indexOf("image/") === 0) {
        const img = document.createElement("img");
        img.className = "docView__img";
        img.alt = "";
        img.src = url;
        body.appendChild(img);
      } else if (mime === "application/pdf") {
        const frame = document.createElement("iframe");
        frame.className = "docView__frame";
        frame.title = "מסמך";
        frame.src = url;
        body.appendChild(frame);
      } else {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "אפשר להוריד את הקובץ. התצוגה במכשיר לא זמינה לסוג הזה.";
        body.appendChild(empty);
      }
      if (save) save.hidden = false;
    } catch (err) {
      if (token !== docToken) return;
      const sheet = err && err.code === "nofile" ? generatedDocument(file) : "";
      body.innerHTML = sheet || ('<div class="empty">' + esc(err.message || "לא ניתן לפתוח את הקובץ") + "</div>");
    }
  }

  function docRowsHtml(rows) {
    return rows.filter((row) => trim(row[1])).map((row) => {
      return '<div class="docSheet__row"><span>' + esc(row[0]) + "</span><b>" + esc(row[1]) + "</b></div>";
    }).join("");
  }

  function reportPolicies(file) {
    const snap = file && file.payloadSnapshot && typeof file.payloadSnapshot === "object" ? file.payloadSnapshot : {};
    const primary = snap.primary && typeof snap.primary === "object" ? snap.primary : {};
    const operational = snap.operational && typeof snap.operational === "object" ? snap.operational : {};
    const lists = [snap.newPolicies, operational.newPolicies, primary.newPolicies];
    const seen = new Set();
    const out = [];
    lists.forEach((list) => {
      (Array.isArray(list) ? list : []).forEach((policy) => {
        if (!policy || typeof policy !== "object") return;
        const id = trim(policy.id) || (trim(policy.company) + "|" + trim(policy.premiumMonthly));
        if (!id || seen.has(id)) return;
        seen.add(id);
        out.push(policy);
      });
    });
    return { snap: snap, primary: primary, policies: out };
  }

  function generatedDocument(file) {
    if (!file || typeof file !== "object") return "";
    const type = trim(file.type);
    const rows = [];
    const add = (label, value) => { if (trim(value)) rows.push([label, trim(value)]); };
    let policies = "";
    if (type === "operational_report_health") {
      const report = reportPolicies(file);
      add("מבוטח", trim(file.insuredLabel) || [report.primary.firstName, report.primary.lastName].filter(Boolean).join(" "));
      add("תאריך", showDate(file.uploadedAt));
      policies = report.policies.map((policy) => {
        const amount = Number(policy.premiumMonthly) || Number(policy.premiumAfterDiscountValue) || 0;
        return '<div class="docSheet__pol"><span>' + esc(trim(policy.company) || "פוליסה") + "</span><b>" + esc(money(amount)) + "</b></div>";
      }).join("");
    } else if (type === "company_cancel_form") {
      add("חברה", file.company);
      add("מספר פוליסה", file.policyNumber);
      add("מוצר", file.productLabel);
      add("סטטוס", file.cancelStatus);
      add("תאריך", showDate(file.uploadedAt));
    } else if (type === "customer_arrival_pack" || type === "followup_questionnaire") {
      add("חברה", file.company);
      add("שאלון", file.questionnaireLabel);
      add("מבוטח", file.insuredLabel);
      add("תאריך", showDate(file.uploadedAt));
      add("מקור", file.source);
    } else {
      add("תאריך", showDate(file.uploadedAt));
      add("מקור", file.source);
    }
    const body = docRowsHtml(rows) + policies;
    if (!body) return "";
    return '<article class="docSheet"><h2>' + esc(docTitle(file)) + "</h2>" + body + "</article>";
  }

  async function downloadFile(file, filename) {
    const href = fileHref(file);
    if (href) {
      if (href.indexOf("data:") === 0) {
        const res = await fetch(href);
        saveBlob(await res.blob(), filename);
        return;
      }
      const link = document.createElement("a");
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener";
      link.download = filename || "";
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }
    const path = filePath(file);
    if (!path) throw new Error("אין קובץ שמור להורדה");
    const bucket = trim(file.storageBucket || file.storage_bucket) || "gi-customer-files";
    const res = await sb.storage.from(bucket).download(path);
    if (res.error || !res.data) throw new Error("לא ניתן להוריד את הקובץ");
    saveBlob(res.data, filename);
  }

  function canAssign() {
    const role = state.profile && state.profile.role;
    return role === "admin" || role === "manager";
  }

  function roleLabel(role) {
    const key = roleKey(role);
    if (key === "admin") return "מנהל מערכת";
    if (key === "manager") return "מנהל";
    if (key === "teammanager") return "מנהל צוות";
    return "נציג";
  }

  function firstText(policy, keys) {
    for (let i = 0; i < keys.length; i += 1) {
      const value = trim(policy && policy[keys[i]]);
      if (value) return value;
    }
    return "";
  }

  function policyCompany(policy) {
    return firstText(policy, ["company", "insurer", "companyName"]);
  }

  function policyNumber(policy) {
    return firstText(policy, ["policyNumber", "number", "policyNo"]);
  }

  function policyStatus(policy) {
    const scan = policy && policy.issuedPolicyScan;
    if (scan && trim(scan.status) === "ok") return { text: "פעילה", live: true };
    if (scan && trim(scan.status) === "gaps") return { text: "יש פערים", live: false };
    if (scan && trim(scan.status) === "unreadable") return { text: "לא ניתן לקרוא", live: false };
    const raw = firstText(policy, ["status", "badgeText"]);
    if (!raw || raw === "חדש" || raw === "פעיל" || raw === "פעילה" || raw === "הופק" || raw === "הופקה") {
      return { text: "פעילה", live: true };
    }
    return { text: raw, live: false };
  }

  function coverRows(policy) {
    const rows = [];
    const seen = new Set();
    const push = (label, amount, note) => {
      const name = trim(label);
      if (!name || seen.has(name)) return;
      seen.add(name);
      const sum = typeof amount === "number" || (amount != null && trim(amount) !== "" && !Number.isNaN(Number(String(amount).replace(/[₪,\s]/g, ""))))
        ? amount
        : trim(amount);
      rows.push({ label: name, amount: sum, note: trim(note) });
    };
    const lists = []
      .concat(Array.isArray(policy.coverItems) ? policy.coverItems : [])
      .concat(Array.isArray(policy.healthCovers) ? policy.healthCovers : [])
      .concat(Array.isArray(policy.lifeCovers) ? policy.lifeCovers : [])
      .concat(Array.isArray(policy.coverages) ? policy.coverages : []);
    lists.forEach((item) => {
      if (typeof item === "string") push(item, "");
      else if (item && typeof item === "object") {
        push(item.label || item.name || item.coverageName || item.type, item.amount || item.sumInsured || item.premium || item.sum, item.note);
      }
    });
    const amounts = policy.healthCoversWithAmounts;
    if (amounts && typeof amounts === "object") Object.keys(amounts).forEach((key) => push(key, amounts[key]));
    const premiums = policy.productionCoverPremiums;
    if (premiums && typeof premiums === "object") Object.keys(premiums).forEach((key) => push(key, premiums[key]));
    (Array.isArray(policy.productionCoverDetails) ? policy.productionCoverDetails : []).forEach((detail) => {
      if (!detail || typeof detail !== "object") return;
      const bits = [];
      if (trim(detail.endDate)) bits.push("תום " + trim(detail.endDate));
      if (trim(detail.sumInsured)) bits.push("סכום " + trim(detail.sumInsured));
      if (trim(detail.deductible)) bits.push("השתתפות " + trim(detail.deductible));
      push(detail.name || detail.label, detail.premium || detail.amount, bits.join(" · "));
    });
    const addons = policy.healthAddonPremiums;
    if (addons && typeof addons === "object") {
      Object.keys(addons).forEach((key) => {
        const map = addons[key];
        let sum = 0;
        if (map && typeof map === "object") {
          Object.keys(map).forEach((id) => { sum += positive(map[id]); });
        } else sum = positive(map);
        if (sum > 0) push(key, sum);
      });
    }
    return rows;
  }

  function moneyOrText(value) {
    if (value == null || trim(value) === "") return "";
    const n = positive(value);
    if (n > 0) return money(n);
    return trim(value);
  }

  function policyFacts(policy) {
    const monthly = policyMonthly(policy);
    const start = showDate(firstText(policy, ["startDate", "insuranceStartDate", "beginDate"]));
    const end = showDate(firstText(policy, ["endDate", "insuranceEndDate"]));
    const savings = moneyOrText(firstText(policy, ["currentSavings", "savingsAmount", "accumulation", "balance"]));
    const coverSum = moneyOrText(firstText(policy, ["sumInsured", "coverageValue", "compensation"]));
    const product = firstText(policy, ["product", "productName", "planName", "plan", "type"]);
    const rows = [];
    const add = (label, value) => { if (trim(value)) rows.push({ label: label, value: trim(value) }); };
    add("החברה", policyCompany(policy));
    add("מוצר", product);
    add("מספר פוליסה", policyNumber(policy));
    if (savings) add("סכום חיסכון נוכחי", savings);
    if (coverSum) add(firstText(policy, ["coverageLabel"]) || "סכום כיסוי", coverSum);
    if (monthly > 0) add("הפקדה חודשית", money(monthly));
    add("תחילת פוליסה", start);
    add("תום פוליסה", end);
    add("סטטוס", policyStatus(policy).text);
    add("מבוטחים", firstText(policy, ["insuredText", "insuredNames", "insuredLabel"]));
    add("מספר סוכן", firstText(policy, ["agentNumber"]));
    const period = firstText(policy, ["paymentPeriod"]);
    add("תקופת תשלום", period && /^\d+$/.test(period) ? period + " חודשים" : period);
    add("אמצעי תשלום", firstText(policy, ["paymentMethod", "paymentStatusLabel"]));
    add("הערות", firstText(policy, ["notes", "comment"]));
    return rows;
  }

  function depositRows(policy) {
    const keys = ["deposits", "contributions", "depositHistory", "hafkadot", "payments"];
    let list = [];
    for (let i = 0; i < keys.length; i += 1) {
      if (Array.isArray(policy[keys[i]]) && policy[keys[i]].length) {
        list = policy[keys[i]];
        break;
      }
    }
    return list.map((item) => {
      if (item == null) return null;
      if (typeof item !== "object") return { label: "הפקדה", value: moneyOrText(item) || trim(item) };
      const when = showDate(firstText(item, ["date", "depositDate", "paidAt", "createdAt", "month"]));
      const amount = moneyOrText(firstText(item, ["amount", "sum", "value", "deposit", "premium"]));
      return { label: when || "הפקדה", value: amount || trim(item.label) || trim(item.status) };
    }).filter((row) => row && (row.label || row.value));
  }

  function policyFiles(policy, payload) {
    const files = [];
    const push = (file) => { if (file && typeof file === "object") files.push(file); };
    ["policyFiles", "documents", "files"].forEach((key) => {
      (Array.isArray(policy[key]) ? policy[key] : []).forEach(push);
    });
    if (policy.issuedPolicyScan && typeof policy.issuedPolicyScan === "object") push(policy.issuedPolicyScan);
    if (policy.issuedPolicyFile && typeof policy.issuedPolicyFile === "object") push(policy.issuedPolicyFile);
    const id = trim(policy.id);
    const number = policyNumber(policy);
    customerDocs(payload).forEach((doc) => {
      const ids = Array.isArray(doc.policyIds) ? doc.policyIds.map((item) => trim(item)) : [];
      if ((id && (trim(doc.policyId) === id || ids.indexOf(id) >= 0)) || (number && trim(doc.policyNumber) === number)) push(doc);
    });
    return files;
  }

  function kvHtml(rows, statusText) {
    if (!rows.length) return '<div class="empty">אין נתונים שמורים לפוליסה</div>';
    return '<div class="kvList">' + rows.map((row) => {
      const live = statusText && row.label === "סטטוס" && row.value === statusText;
      return '<div class="kv"><span>' + esc(row.label) + '</span><b' + (live ? ' class="is-live"' : '') + '>' + esc(row.value) + '</b></div>';
    }).join("") + '</div>';
  }

  function coversHtml(policy) {
    const rows = coverRows(policy);
    if (!rows.length) return "";
    const list = rows.map((row) => {
      const amount = moneyOrText(row.amount);
      const note = row.note ? '<span>' + esc(row.note) + '</span>' : '';
      return '<div class="coverRow"><div><b>' + esc(row.label) + '</b>' + note + '</div>' + (amount ? '<b>' + esc(amount) + '</b>' : '') + '</div>';
    }).join("");
    return '<section class="coverBlock"><h3>כיסויים</h3><div class="coverList">' + list + '</div></section>';
  }

  function paintCustomerFile() {
    const row = state.file;
    const host = $("customerFile");
    if (!row) {
      host.innerHTML = '<div class="empty">הלקוח לא נמצא</div>';
      return;
    }
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    const primary = payload.primary || (payload.insureds && payload.insureds[0] && payload.insureds[0].data) || {};
    const name = trim(row.full_name) || trim(((primary.firstName || "") + " " + (primary.lastName || "")).trim()) || "לקוח";
    const idNumber = trim(row.id_number) || trim(primary.idNumber);
    const phone = trim(row.phone) || trim(primary.phone);
    const bucket = customerBucket(row);
    const label = bucket === "archive" ? "ארכיון" : bucket === "pending" ? "בהמתנה" : "פעיל";
    const cls = bucket === "archive" ? "is-arch" : bucket === "pending" ? "is-wait" : "";
    const policies = policyRows(payload);
    const companies = new Set();
    const kinds = new Set();
    let monthly = 0;
    policies.forEach((policy) => {
      monthly += policyMonthly(policy);
      const company = trim(policy.company) || trim(policy.insurer) || trim(policy.companyName);
      const title = policyTitle(policy);
      if (company) companies.add(company);
      if (title) kinds.add(title);
    });
    state.filePolicies = policies;
    state.fileDocs = customerDocs(payload);
    const tab = state.fileTab || "policies";
    const tabs = '<div class="fileTabs"><button type="button" data-filetab="details"' + (tab === "details" ? ' class="is-on"' : "") + '>פרטים</button><button type="button" data-filetab="policies"' + (tab === "policies" ? ' class="is-on"' : "") + '>פוליסות</button><button type="button" data-filetab="documents"' + (tab === "documents" ? ' class="is-on"' : "") + '>מסמכי לקוח</button></div>';
    const head = '<article class="fileCard"><div><div class="fileCard__name">' + esc(name) + '</div>' + (idNumber ? '<div class="fileCard__id">ת.ז. ' + esc(idNumber) + '</div>' : '<div class="fileCard__id"></div>') + '<span class="cust__status ' + cls + '">' + label + '</span></div><span class="fileCard__badge" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.2"/><path d="M3.5 19c.6-3 2.6-4.5 5.5-4.5S15 16 15.5 19"/><path d="M14.2 14.7c1.5-.5 3 .1 4 1.5"/></svg></span></article>';
    const assign = canAssign() ? '<button class="assignBtn" type="button" data-assign="1">שיוך לקוח לנציג</button>' : "";
    let body = "";
    if (tab === "policies") {
      const list = policies.length
        ? policies.map((policy, index) => {
          const title = policyTitle(policy);
          const company = policyCompany(policy);
          const number = policyNumber(policy);
          const status = policyStatus(policy);
          const sub = [company, number].filter(Boolean).join(" · ") || policySub(policy, title);
          return '<button class="pol" type="button" data-policy="' + index + '"><span class="pol__ico" style="background:' + policyTone(title) + '">' + policyIcon(title) + '</span><span class="pol__text"><span class="pol__name">' + esc(title) + '</span>' + (sub ? '<span class="pol__sub">' + esc(sub) + '</span>' : '') + '</span><span class="pol__side"><b class="pol__sum">' + esc(money(policyMonthly(policy))) + '</b><span class="' + (status.live ? "pol__live" : "pol__wait") + '">' + esc(status.text) + '</span></span></button>';
        }).join("")
        : '<div class="empty">אין פוליסות שנרכשו בסוכנות</div>';
      body = '<section class="premCard"><div><p class="premCard__k">סה״כ פרמיה בתיק</p><strong>' + esc(money(monthly)) + '</strong></div><span class="premCard__ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/></svg></span></section><div class="fileStats"><div><b>' + policies.length + '</b><span>פוליסות</span></div><div><b>' + companies.size + '</b><span>חברות ביטוח</span></div><div><b>' + kinds.size + '</b><span>סוגי מוצרים</span></div></div><h2 class="blockTitle">פוליסות פעילות</h2><div class="polList">' + list + '</div>';
    } else if (tab === "details") {
      const email = trim(primary.email) || trim(payload.email);
      const city = trim(primary.city) || trim(payload.city);
      const street = trim(primary.street) || trim(payload.street);
      const house = trim(primary.houseNo || primary.houseNumber || payload.houseNo || payload.houseNumber);
      const apt = trim(primary.apartmentNo || primary.apartment || payload.apartmentNo);
      const zip = trim(primary.zip || primary.postalCode || payload.zip);
      const streetLine = [street, house].filter(Boolean).join(" ");
      const place = [streetLine, apt ? "דירה " + apt : ""].filter(Boolean).join(", ");
      const cityLine = [city, zip].filter(Boolean).join(" ");
      const address = [place, cityLine].filter(Boolean).join(", ");
      const agentName = trim(row.agent_name) || trim(payload.agentName);
      const dial = phone
        ? '<a class="dialBtn" href="tel:' + esc(phone.replace(/[^\d+]/g, "")) + '" aria-label="חיוג"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 3h3l1 4-2 1a12 12 0 0 0 6 6l1-2 4 1v3c0 1-1 2-2 2A16 16 0 0 1 5 5c0-1 1-2 2-2z"/></svg></a>'
        : "";
      const cell = (value, ltr) => {
        const text = trim(value);
        return '<b' + (ltr ? ' dir="ltr"' : "") + (text ? "" : ' class="is-empty"') + ">" + esc(text || "לא צוין") + "</b>";
      };
      const line = (labelText, value, ltr, extra) => '<div class="bankRow"><span>' + labelText + '</span><div class="bankRow__val">' + cell(value, ltr) + (extra || "") + "</div></div>";
      body = '<div class="bank">'
        + line("טלפון", phone, true, dial)
        + line("אימייל", email, true, "")
        + line("כתובת מגורים", address, false, "")
        + line("ת.ז.", idNumber, true, "")
        + line("נציג", agentName, false, "")
        + line("סטטוס", label, false, "")
        + "</div>";
    } else {
      const docs = state.fileDocs;
      body = docs.length
        ? '<div class="docList">' + docs.map((doc, index) => '<button class="docRow" type="button" data-doc="' + index + '"><span><b>' + esc(docTitle(doc)) + '</b><span>' + esc(showDate(doc.uploadedAt || doc.createdAt) || "מסמך") + '</span></span><span class="docRow__open">צפייה</span></button>').join("") + '</div>'
        : '<div class="empty">אין מסמכים בתיק</div>';
    }
    host.innerHTML = head + assign + tabs + body + '<p class="fileNote" id="fileNote" role="status"></p>';
  }

  async function openCustomer(id) {
    show("customer");
    $("customerFile").innerHTML = '<div class="empty">טוען…</div>';
    try {
      state.file = await loadCustomerFile(id);
      state.fileTab = "policies";
      paintCustomerFile();
    } catch (_err) {
      state.file = null;
      $("customerFile").innerHTML = '<div class="empty">לא ניתן לטעון את הלקוח</div>';
    }
  }

  function paintPolicy() {
    const policy = state.filePolicies[state.policyIndex];
    const host = $("policyBody");
    const foot = $("policyFoot");
    if (!policy) {
      host.innerHTML = '<div class="empty">הפוליסה לא נמצאה</div>';
      foot.innerHTML = "";
      return;
    }
    const payload = state.file && state.file.payload && typeof state.file.payload === "object" ? state.file.payload : {};
    const title = policyTitle(policy);
    const product = firstText(policy, ["product", "productName", "planName"]);
    const heading = product && product !== title ? title + " - " + product : title;
    const company = policyCompany(policy);
    const number = policyNumber(policy);
    const status = policyStatus(policy);
    const tab = state.policyTab || "details";
    const tabs = '<div class="polTabs"><button type="button" data-poltab="details"' + (tab === "details" ? ' class="is-on"' : "") + '>פרטים</button><button type="button" data-poltab="deposits"' + (tab === "deposits" ? ' class="is-on"' : "") + '>הפקדות</button><button type="button" data-poltab="documents"' + (tab === "documents" ? ' class="is-on"' : "") + '>מסמכים</button></div>';
    const card = '<article class="polHead"><div><div class="polHead__name">' + esc(heading) + '</div>' + (company ? '<div class="polHead__co">' + esc(company) + '</div>' : '') + (number ? '<div class="polHead__num">מספר פוליסה: ' + esc(number) + '</div>' : '') + '<span class="' + (status.live ? "live" : "cust__status") + '">' + esc(status.text) + '</span></div><span class="polHead__ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/></svg></span></article>';
    let body = "";
    if (tab === "deposits") {
      const monthly = policyMonthly(policy);
      const rows = [];
      if (monthly > 0) rows.push({ label: "הפקדה חודשית", value: money(monthly) });
      depositRows(policy).forEach((row) => rows.push(row));
      body = rows.length ? kvHtml(rows, "") : '<div class="empty">אין פירוט הפקדות שמור לפוליסה</div>';
    } else if (tab === "documents") {
      state.policyDocs = policyFiles(policy, payload);
      body = state.policyDocs.length
        ? '<div class="docList">' + state.policyDocs.map((doc, index) => '<button class="docRow" type="button" data-pdoc="' + index + '"><span><b>' + esc(docTitle(doc)) + '</b><span>מסמך</span></span><span class="docRow__open">צפייה</span></button>').join("") + '</div>'
        : '<div class="empty">אין מסמכים שמורים לפוליסה</div>';
    } else {
      body = kvHtml(policyFacts(policy), status.live ? status.text : "") + coversHtml(policy);
    }
    host.innerHTML = card + tabs + body + '<p class="formError" id="policyNote" role="alert"></p>';
    foot.innerHTML = '<button class="primary" id="btnPolicyReport" type="button"><span>צפייה בדוח תפעולי</span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></button>';
  }

  function opsPairs(rows) {
    return rows.filter((row) => row && trim(row[1]));
  }

  function opsRows(rows) {
    const pairs = opsPairs(rows);
    if (!pairs.length) return "";
    return '<div class="opsRows">' + pairs.map((row) => '<div class="opsRow"><span>' + esc(row[0]) + "</span><b>" + esc(row[1]) + "</b></div>").join("") + "</div>";
  }

  function opsSection(title, inner) {
    if (!trim(inner)) return "";
    return '<section class="opsSec"><h2>' + esc(title) + "</h2>" + inner + "</section>";
  }

  function opsCode(value, map) {
    const raw = trim(value);
    return map[token(raw)] || raw;
  }

  function opsPerson(data) {
    return trim((trim(data && data.firstName) + " " + trim(data && data.lastName)).trim());
  }

  function opsSmoke(data) {
    const smoking = trim(data && data.smokingStatus);
    if (!smoking) return [["עישון", "לא צוין"]];
    if (token(smoking) === "no" || smoking === "לא מעשן/ת") return [["עישון", "לא מעשן/ת"]];
    const rows = [["עישון", "מעשן/ת"]];
    if (trim(data.smokingType)) rows.push(["סוג עישון", trim(data.smokingType)]);
    if (trim(data.smokingAmount)) rows.push(["כמות ליום", trim(data.smokingAmount)]);
    return rows;
  }

  function opsInsuredRows(ins) {
    const data = ins && ins.data && typeof ins.data === "object" ? ins.data : {};
    const child = trim(ins && ins.type) === "child";
    return opsPairs([
      ["שם מלא", opsPerson(data)],
      ["ת״ז", trim(data.idNumber)],
      ["תאריך לידה", showDate(data.birthDate)],
      ["תאריך הנפקת ת״ז", child ? "" : (showDate(data.idIssueDate) || "לא הוזן")],
      ["גיל", trim(data.age)],
      ["טלפון", trim(data.phone)],
      ["אימייל", trim(data.email)],
      ["מגדר", opsCode(data.gender, { male: "זכר", female: "נקבה", m: "זכר", f: "נקבה" })],
      ["מצב משפחתי", opsCode(data.maritalStatus, { married: "נשוי/ה", single: "רווק/ה", divorced: "גרוש/ה", widowed: "אלמן/ה" })],
      ["עיר", trim(data.city)],
      ["כתובת", [trim(data.street), trim(data.houseNo || data.houseNumber), trim(data.apartmentNo), trim(data.zip)].filter(Boolean).join(" ")],
      ["קופת חולים", trim(data.clinic || data.hmo || data.kupatHolim)],
      ["שב״ן", trim(data.shaban || data.shabanLevel)],
      ["עיסוק", trim(data.occupation)]
    ].concat(opsSmoke(data)));
  }

  function opsHeading(ins, index) {
    const data = ins && ins.data && typeof ins.data === "object" ? ins.data : {};
    const name = opsPerson(data);
    const type = trim(ins && ins.type);
    let role = "מבוטח נוסף";
    if (index === 0 || type === "primary") role = "מבוטח ראשי";
    else if (type === "spouse" || type === "secondary") role = "מבוטח משני";
    else if (type === "child") role = "מבוטח נוסף קטין";
    else if (type === "adult") role = "מבוטח נוסף בגיר";
    return name ? role + " — " + name : role;
  }

  function opsStatus(policy, data) {
    const book = data && data.cancellations && typeof data.cancellations === "object" ? data.cancellations : {};
    const entry = policy && policy.id ? book[policy.id] : null;
    const raw = trim(entry && entry.status) || trim(policy && (policy.status || policy.policyStatus || policy.action));
    const label = opsCode(raw, {
      full: "ביטול מלא",
      partial: "ביטול חלקי",
      partial_health: "ביטול חלקי",
      agent_appoint: "מינוי סוכן",
      agentappoint: "מינוי סוכן",
      keep: "נשמר",
      retained: "נשמר"
    });
    const reason = trim(entry && entry.needsAnalysisReason);
    return { label: label || "—", reason: reason };
  }

  function opsPack(file) {
    const payload = file && file.payload && typeof file.payload === "object" ? file.payload : {};
    const operational = payload.operational && typeof payload.operational === "object" ? payload.operational : {};
    const insureds = (Array.isArray(payload.insureds) && payload.insureds.length ? payload.insureds : (Array.isArray(operational.insureds) ? operational.insureds : [])).filter(Boolean);
    const primary = payload.primary && typeof payload.primary === "object" ? payload.primary : (operational.primary && typeof operational.primary === "object" ? operational.primary : {});
    const fresh = Array.isArray(payload.newPolicies) && payload.newPolicies.length ? payload.newPolicies : (Array.isArray(operational.newPolicies) ? operational.newPolicies : []);
    const elementary = Array.isArray(payload.elementaryPolicies) ? payload.elementaryPolicies : [];
    const policies = fresh.concat(elementary).filter((policy) => policy && typeof policy === "object" && trim(policy.origin) !== "existing");
    return { payload: payload, operational: operational, primary: primary, insureds: insureds, policies: policies };
  }

  function opsHealth(pack) {
    const responses = {};
    const take = (source) => {
      if (!source || typeof source !== "object") return;
      Object.keys(source).forEach((key) => {
        const block = source[key];
        if (!block || typeof block !== "object") return;
        responses[key] = responses[key] && typeof responses[key] === "object" ? responses[key] : {};
        Object.keys(block).forEach((id) => {
          const incoming = block[id];
          if (!incoming || typeof incoming !== "object") return;
          const prev = responses[key][id] && typeof responses[key][id] === "object" ? responses[key][id] : {};
          responses[key][id] = Object.assign({}, prev, incoming);
        });
      });
    };
    const primary = pack.primary || {};
    take(primary.healthDeclaration && primary.healthDeclaration.responses);
    take(pack.operational.primary && pack.operational.primary.healthDeclaration && pack.operational.primary.healthDeclaration.responses);
    pack.insureds.forEach((ins) => take(ins && ins.data && ins.data.healthDeclaration && ins.data.healthDeclaration.responses));
    const lines = [];
    Object.keys(responses).forEach((key) => {
      const block = responses[key];
      const question = /[א-ת]/.test(key) ? key : "שאלה רפואית";
      pack.insureds.forEach((ins, index) => {
        const data = ins && ins.data && typeof ins.data === "object" ? ins.data : {};
        const id = trim(ins && ins.id) || trim(data.id) || String(index);
        const answer = block[id] || block[String(index)] || null;
        if (!answer) return;
        const raw = trim(answer.answer);
        if (!raw) return;
        const fields = answer.fields && typeof answer.fields === "object"
          ? Object.keys(answer.fields).map((name) => trim(answer.fields[name])).filter(Boolean).join(" · ")
          : "";
        lines.push('<article class="opsPol"><b>' + esc(opsHeading(ins, index)) + "</b><span>" + esc(question) + "</span><strong>" + esc(raw === "yes" ? "כן" : raw === "no" ? "לא" : raw) + "</strong>" + (fields ? "<small>" + esc(fields) + "</small>" : "") + "</article>");
      });
    });
    return lines.join("");
  }

  function paintOps() {
    const host = $("opsBody");
    const file = state.file;
    const pack = opsPack(file);
    if (!pack.insureds.length && !pack.policies.length) {
      host.innerHTML = '<div class="empty">אין דוח תפעולי שמור ללקוח</div>';
      return;
    }
    const primaryData = pack.insureds[0] && pack.insureds[0].data && typeof pack.insureds[0].data === "object" ? pack.insureds[0].data : pack.primary;
    const customerName = opsPerson(pack.primary) || opsPerson(primaryData) || trim(file && file.full_name) || "לקוח";
    const stamp = Date.parse(trim(pack.payload.createdAt) || trim(pack.operational.createdAt) || "");
    const when = Number.isFinite(stamp)
      ? new Date(stamp).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "";
    const agent = trim(file && file.agent_name) || trim(pack.payload.agentName) || trim(pack.operational.agentName);
    const people = pack.insureds.map((ins, index) => '<div class="opsPerson"><b>' + esc(opsHeading(ins, index)) + "</b>" + opsRows(opsInsuredRows(ins)) + "</div>").join("");
    const bmi = pack.insureds.map((ins, index) => {
      const data = ins && ins.data && typeof ins.data === "object" ? ins.data : {};
      if (!trim(data.heightCm) && !trim(data.weightKg) && !trim(data.bmi)) return "";
      return '<div class="opsPerson"><b>' + esc(opsHeading(ins, index)) + "</b>" + opsRows([
        ["גובה", trim(data.heightCm) ? trim(data.heightCm) + " ס״מ" : ""],
        ["משקל", trim(data.weightKg) ? trim(data.weightKg) + " ק״ג" : ""],
        ["BMI", trim(data.bmi)]
      ]) + "</div>";
    }).join("");
    const existing = [];
    pack.insureds.forEach((ins, index) => {
      const data = ins && ins.data && typeof ins.data === "object" ? ins.data : {};
      (Array.isArray(data.existingPolicies) ? data.existingPolicies : []).forEach((policy) => {
        const status = opsStatus(policy, data);
        existing.push('<article class="opsPol"><b>' + esc(opsHeading(ins, index)) + "</b><span>" + esc([trim(policy.company), trim(policy.type || policy.product), trim(policy.policyNumber)].filter(Boolean).join(" · ")) + "</span><strong>" + esc(moneyOrText(policy.monthlyPremium || policy.premium) || "—") + "</strong><small>" + esc([status.label, status.reason, policy.importedFromHarBituach ? "יובא מהר הביטוח" : "נוסף ידנית"].filter(Boolean).join(" · ")) + "</small></article>");
      });
    });
    const consider = pack.payload.needsMainConsideration || pack.operational.needsMainConsideration;
    const considerText = typeof consider === "string" ? trim(consider) : trim(consider && (consider.label || consider.key));
    const reasons = [];
    if (considerText) reasons.push('<article class="opsPol"><strong>השיקולים העיקריים במתן ההמלצה הינם: ' + esc(considerText) + "</strong></article>");
    pack.insureds.forEach((ins, index) => {
      const data = ins && ins.data && typeof ins.data === "object" ? ins.data : {};
      (Array.isArray(data.existingPolicies) ? data.existingPolicies : []).forEach((policy) => {
        const status = opsStatus(policy, data);
        if (!status.reason) return;
        reasons.push('<article class="opsPol"><b>' + esc([trim(policy.company), trim(policy.type || policy.product)].filter(Boolean).join(" · ")) + "</b><span>" + esc(opsHeading(ins, index) + " · " + status.label) + "</span><small>" + esc(status.reason) + "</small></article>");
      });
    });
    const fresh = pack.policies.map((policy) => {
      const covers = coverRows(policy).map((row) => trim(row.label) + (row.amount ? " · " + moneyOrText(row.amount) : "")).filter(Boolean).join(" · ");
      const monthly = policyMonthly(policy);
      return '<article class="opsPol"><b>' + esc(policyTitle(policy)) + "</b><span>" + esc([policyCompany(policy), policyNumber(policy)].filter(Boolean).join(" · ")) + "</span>" + (monthly > 0 ? "<strong>" + esc(money(monthly)) + "</strong>" : "") + opsRows([
        ["תחילה", showDate(firstText(policy, ["startDate", "insuranceStartDate"]))],
        ["כיסויים", covers],
        ["אמצעי תשלום", firstText(policy, ["paymentMethod"])],
        ["הערות", firstText(policy, ["notes", "comment"])]
      ]) + "</article>";
    }).join("");
    const payer = pack.primary.payer && typeof pack.primary.payer === "object" ? pack.primary.payer : {};
    const card = pack.primary.cc && typeof pack.primary.cc === "object" ? pack.primary.cc : (primaryData.cc && typeof primaryData.cc === "object" ? primaryData.cc : {});
    const bank = pack.primary.ho && typeof pack.primary.ho === "object" ? pack.primary.ho : (primaryData.ho && typeof primaryData.ho === "object" ? primaryData.ho : {});
    const external = pack.primary.payerChoice === "external";
    const ext = pack.primary.externalPayer && typeof pack.primary.externalPayer === "object" ? pack.primary.externalPayer : {};
    const method = trim(pack.primary.paymentMethod || payer.method);
    const pay = opsRows([
      ["מי משלם", external ? "משלם חריג" : (method ? "המבוטח" : "")],
      ["אמצעי תשלום", method === "cc" ? "אשראי" : method === "ho" ? "הוראת קבע" : method],
      ["שם משלם", external ? opsPerson(ext) : trim(payer.holderName || pack.primary.payerName)],
      ["ת״ז משלם", external ? trim(ext.idNumber) : trim(payer.holderId || pack.primary.payerId)],
      ["טלפון משלם", external ? trim(ext.phone) : ""],
      ["מספר כרטיס", trim(payer.cardNumberMasked || payer.cardNumber || card.cardNumber || pack.primary.cardNumberMasked)],
      ["תוקף", trim(payer.cardExpiry || card.exp || pack.primary.cardExpiry)],
      ["בנק", trim(payer.bankName || bank.bankName)],
      ["מספר בנק", trim(payer.bankNo || bank.bankNo)],
      ["סניף", trim(payer.branchNo || bank.branch)],
      ["חשבון", trim(payer.accountNo || bank.account)]
    ]);
    const mirror = pack.payload.mirrorSchedule || pack.operational.mirrorSchedule || (primaryData.mirrorSchedule || {});
    const meet = opsRows([
      ["תאריך", trim(mirror.date)],
      ["שעה", trim(mirror.time)],
      ["הערת נציג", trim(mirror.note)]
    ]);
    const existingCount = existing.length;
    const counts = pack.insureds.length + " מבוטחים · " + existingCount + " פוליסות קיימות · " + pack.policies.length + " פוליסות חדשות";
    host.innerHTML = '<article class="opsDoc"><header class="opsHead"><p>דוח תפעולי</p><h2>' + esc(customerName) + "</h2><small>" + esc([when, agent].filter(Boolean).join(" · ")) + "</small><small>" + esc(counts) + "</small></header>"
      + opsSection("פרטי לקוח", people)
      + opsSection("גובה, משקל ו־BMI", bmi)
      + opsSection("פוליסות קיימות", existing.join(""))
      + opsSection("שיקולים במתן ההמלצות", reasons.join(""))
      + opsSection("פוליסות חדשות", fresh)
      + opsSection("אמצעי תשלום", pay)
      + opsSection("תזמון שיחת שיקוף", meet)
      + opsSection("הצהרת בריאות", opsHealth(pack))
      + "</article>";
  }

  function openOps() {
    show("ops");
    paintOps();
  }

  function openPolicy(index) {
    state.policyIndex = index;
    state.policyTab = "details";
    state.policyReport = false;
    show("policy");
    paintPolicy();
  }

  const splashAt = Date.now();
  const AVATAR_KEY = "onyx-phone-avatar:";

  function readAvatar() {
    const id = state.profile && state.profile.id;
    if (!id) return "";
    try { return localStorage.getItem(AVATAR_KEY + id) || ""; } catch (_err) { return ""; }
  }

  function writeAvatar(dataUrl) {
    const id = state.profile && state.profile.id;
    if (!id) return;
    localStorage.setItem(AVATAR_KEY + id, dataUrl);
  }

  function paintHomeIdentity() {
    const profile = state.profile || {};
    const photo = readAvatar();
    const node = $("homeAvatar");
    if (node) {
      if (photo) node.innerHTML = '<img alt="" src="' + esc(photo) + '"/>';
      else node.textContent = (profile.name || "נ").slice(0, 1);
    }
    const hello = $("homeHello");
    if (hello) hello.textContent = "שלום: " + (agentFirstName(profile.name) || "");
    const month = $("homeMonth");
    if (month) {
      let label = "";
      try { label = new Date().toLocaleDateString("he-IL", { month: "long", timeZone: "Asia/Jerusalem" }); } catch (_err) { label = ""; }
      month.textContent = "פרמיית הפקה עבור חודש " + label;
    }
  }

  function agentFirstName(name) {
    const parts = trim(name).split(/\s+/).filter(Boolean);
    return parts[0] || "";
  }

  function setMenu(open) {
    const menu = $("homeMenu");
    const opener = $("btnMenu");
    if (!menu) return;
    menu.hidden = !open;
    if (opener) opener.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function setIcon(path) {
    return '<span class="setRow__ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">' + path + '</svg></span>';
  }

  function paintProfile() {
    const profile = state.profile || {};
    const name = profile.name || "";
    const role = ALLOWED[profile.role] || "";
    const photo = readAvatar();
    const avatar = photo
      ? '<img alt="" src="' + esc(photo) + '"/>'
      : esc((name || "מ").slice(0, 1));
    const chev = '<svg class="setRow__chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
    const row = (key, label, icon, withChev) => '<button class="setRow" type="button" data-account="' + key + '">' + setIcon(icon) + '<span class="setRow__label">' + label + '</span>' + (withChev ? chev : '') + '</button>';
    $("profileBody").innerHTML = '<div class="profileHero"><button class="profileAvatar" id="btnAvatar" type="button" aria-label="העלאת תמונה">' + avatar + '</button><input id="avatarFile" type="file" accept="image/*" hidden/><div class="profileHero__name">' + esc(name) + '</div><div class="profileHero__role">' + esc(role ? role + " | GEMEL INVEST" : "GEMEL INVEST") + '</div></div><div class="setList">'
      + row("details", "הפרטים שלי", '<circle cx="12" cy="8" r="3"/><path d="M5 19c1.2-3 3.2-4.5 7-4.5S17.8 16 19 19"/>', true)
      + row("notifications", "הגדרות התראות", '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', true)
      + row("security", "אבטחה וכניסה", '<path d="M12 3 5 6v6c0 4.2 2.8 7.2 7 9 4.2-1.8 7-4.8 7-9V6z"/>', true)
      + row("help", "עזרה ותמיכה", '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7"/><path d="M12 17h.01"/>', true)
      + row("logout", "יציאה מהמערכת", '<path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2"/><path d="M15 12H3m0 0 3-3M3 12l3 3"/>', false)
      + '</div>';
  }

  async function loadSelf() {
    const id = state.profile && state.profile.id;
    if (!id) return null;
    const res = await sb.from("agents").select("id,name,username,role,email,birth_date").eq("id", id).maybeSingle();
    if (res.error) throw new Error(res.error.message || "agent");
    return res.data || null;
  }

  async function paintAccount() {
    const kind = state.account;
    const host = $("accountBody");
    const titles = { details: "הפרטים שלי", notifications: "הגדרות התראות", security: "אבטחה וכניסה", help: "עזרה ותמיכה" };
    $("accountTitle").textContent = titles[kind] || "הגדרות";
    if (kind === "details") {
      host.innerHTML = '<div class="empty">טוען…</div>';
      try {
        const row = await loadSelf();
        const profile = state.profile || {};
        const bits = [
          ["שם", (row && row.name) || profile.name],
          ["שם משתמש", (row && row.username) || profile.username],
          ["תפקיד", roleLabel((row && row.role) || profile.role)],
          ["דוא״ל", row && row.email],
          ["תאריך לידה", row && showDate(row.birth_date)]
        ].filter((pair) => trim(pair[1]));
        host.innerHTML = '<div class="kvList">' + bits.map((pair) => '<div class="kv"><span>' + esc(pair[0]) + '</span><b>' + esc(pair[1]) + '</b></div>').join("") + '</div>';
      } catch (_err) {
        host.innerHTML = '<div class="empty">לא ניתן לטעון את הפרטים</div>';
      }
      return;
    }
    if (kind === "notifications") {
      const perm = (typeof Notification === "undefined") ? "unsupported" : Notification.permission;
      const label = perm === "granted" && pushReady ? "התראות פעילות" : perm === "denied" ? "התראות חסומות" : "התראות כבויות";
      const button = perm === "denied" || perm === "unsupported" || (perm === "granted" && pushReady)
        ? ""
        : '<button class="primary accountAction" id="btnNotify" type="button">אפשר התראות</button>';
      const extra = state.pushNote ? '<p class="accountLead">' + esc(state.pushNote) + "</p>" : "";
      host.innerHTML = '<p class="accountLead">' + esc(label) + "</p>" + extra + button;
      return;
    }
    if (kind === "security") {
      const profile = state.profile || {};
      host.innerHTML = '<div class="kvList"><div class="kv"><span>שם משתמש</span><b>' + esc(profile.username || "") + '</b></div><div class="kv"><span>אימות דו־שלבי</span><b class="is-live">פעיל</b></div></div><p class="accountLead">הכניסה דורשת את הקוד בן 6 הספרות שכבר מוגדר לחשבון.</p>';
      return;
    }
    if (kind === "help") {
      host.innerHTML = '<p class="accountLead">פנייה נשלחת לאותה כתובת של התמיכה במערכת.</p><a class="primary accountAction" id="btnHelp" href="mailto:oriasomech@gmail.com?subject=' + encodeURIComponent("פנייה מאפליקציית ONYX") + '">שליחת פנייה</a>';
    }
  }

  function openAccount(kind) {
    state.account = kind;
    show("account");
    void paintAccount();
  }

  function cropAvatar(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read"));
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const size = 256;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const scale = Math.max(size / img.width, size / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          canvas.getContext("2d").drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = () => reject(new Error("image"));
        img.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  function blankMetric(id) {
    const node = $(id);
    if (!node) return;
    if (node.textContent === "…" || node.textContent === "") node.textContent = "—";
  }

  async function refreshHomeMetrics() {
    if (!state.profile || state.homeBusy) return;
    state.homeBusy = true;
    const notes = [];
    try {
      try {
        const report = await loadReport(true);
        const stats = reportStats(report);
        $("tileIssued").textContent = money(stats.issued);
        $("tilePending").textContent = money(stats.pending);
        $("homeSummary").textContent = money(stats.pending + stats.issued);
      } catch (_err) {
        blankMetric("tileIssued");
        blankMetric("tilePending");
        blankMetric("homeSummary");
        notes.push("דוח המכירות לא נטען");
      }
      try { $("tileLeads").textContent = String(await countIncomingLeads()); }
      catch (_err) { blankMetric("tileLeads"); notes.push("ספירת הלידים לא נטענה"); }
      try { $("tileSold").textContent = money(await loadNet(israelRange())); }
      catch (_err) { blankMetric("tileSold"); notes.push("נמכר היום לא נטען"); }
      if ($("homeNote")) $("homeNote").textContent = notes.join(" · ");
    } finally {
      state.homeBusy = false;
    }
  }

  async function enterApp() {
    await loadScope();
    paintHomeIdentity();
    show("home");
    startAlertPoll();
  }

  async function openCustomers(focusSearch) {
    show("customers");
    if (focusSearch) $("customerQuery").focus();
    $("customerList").innerHTML = '<div class="empty">טוען…</div>';
    try {
      state.customers = await loadCustomers($("customerQuery").value);
      paintCustomers(state.customers);
    } catch (_err) {
      $("customerList").innerHTML = '<div class="empty">לא ניתן לטעון לקוחות</div>';
    }
  }

  async function openCompanies() {
    $("companySheet").hidden = false;
    $("companyList").innerHTML = '<div class="empty">טוען…</div>';
    try {
      const rows = await loadCompanies();
      $("companyList").innerHTML = rows.length
        ? rows.map((row) => '<div class="coRow"><b>' + esc(row.company) + '</b><span>' + esc(money(row.premium)) + " · " + esc(String(row.policies)) + " פוליסות</span></div>").join("")
        : '<div class="empty">אין מכירות עדיין היום</div>';
    } catch (_err) {
      $("companyList").innerHTML = '<div class="empty">לא ניתן לטעון את פירוט החברות</div>';
    }
  }

  async function boot() {
    const session = await sb.auth.getSession();
    if (!session.data || !session.data.session) {
      show("splash");
      return;
    }
    if ((await assurance()) !== "aal2") {
      await signOut();
      show("splash");
      return;
    }
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem(PROFILE_KEY) || "null"); } catch (_err) { stored = null; }
    if (!stored || !stored.id || !ALLOWED[stored.role]) {
      await signOut();
      show("splash");
      return;
    }
    state.profile = stored;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const left = (reduced ? 200 : 1500) - (Date.now() - splashAt);
    if (left > 0) await new Promise((resolve) => window.setTimeout(resolve, left));
    await enterApp();
  }

  $("btnEnter").addEventListener("click", () => {
    $("loginError").textContent = "";
    show("login");
  });
  $("btnLoginBack").addEventListener("click", () => show("splash"));
  $("btnMfaBack").addEventListener("click", async () => {
    await signOut();
    $("mfaCode").value = "";
    show("login");
  });

  $("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = trim($("loginUser").value);
    const pin = trim($("loginPass").value);
    $("loginError").textContent = "";
    if (!username || !pin) {
      $("loginError").textContent = "נא להזין שם משתמש וסיסמה";
      return;
    }
    setBusy($("btnLogin"), true);
    try {
      await openSession(username, pin);
      $("loginPass").value = "";
      $("mfaCode").value = "";
      $("mfaError").textContent = "";
      show("mfa");
      $("mfaCode").focus();
    } catch (err) {
      await signOut();
      $("loginError").textContent = err.message || "הכניסה נעצרה";
    } finally {
      setBusy($("btnLogin"), false);
    }
  });

  $("mfaForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("mfaError").textContent = "";
    setBusy($("btnMfa"), true);
    try {
      await verifyCode($("mfaCode").value);
      $("mfaCode").value = "";
      await enterApp();
    } catch (err) {
      $("mfaError").textContent = err.message || "הקוד שגוי";
    } finally {
      setBusy($("btnMfa"), false);
    }
  });

  $("btnReport").addEventListener("click", () => { void openSales(); });
  $("btnQuote").addEventListener("click", () => openSim());
  $("btnSimBack").addEventListener("click", () => simBack());
  $("simBody").addEventListener("click", (event) => simClick(event));
  $("simBody").addEventListener("input", (event) => {
    if (event.target.id !== "simSum") return;
    const next = groupSum(event.target.value);
    if (event.target.value !== next) {
      event.target.value = next;
      try { event.target.setSelectionRange(next.length, next.length); } catch (_err) {}
    }
    if (state.sim) state.sim.sum = next;
  });
  $("btnSold").addEventListener("click", () => { void openCompanies(); });
  $("btnMenu").addEventListener("click", () => setMenu($("homeMenu").hidden));
  $("homeMenuBackdrop").addEventListener("click", () => setMenu(false));
  $("customerList").addEventListener("click", (event) => {
    const card = event.target.closest("[data-customer]");
    if (!card) return;
    void openCustomer(card.getAttribute("data-customer"));
  });
  $("customerFile").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-filetab]");
    if (tab && state.file) {
      state.fileTab = tab.getAttribute("data-filetab");
      paintCustomerFile();
      return;
    }
    const policy = event.target.closest("[data-policy]");
    if (policy) {
      openPolicy(Number(policy.getAttribute("data-policy")));
      return;
    }
    const doc = event.target.closest("[data-doc]");
    if (doc) {
      const file = state.fileDocs[Number(doc.getAttribute("data-doc"))];
      const note = $("fileNote");
      if (note) note.textContent = "";
      void viewDocument(file);
      return;
    }
    if (event.target.closest("[data-assign]")) void openAssign();
  });
  $("policyBody").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-poltab]");
    if (tab) {
      state.policyTab = tab.getAttribute("data-poltab");
      state.policyReport = false;
      paintPolicy();
      return;
    }
    const doc = event.target.closest("[data-pdoc]");
    if (!doc) return;
    const file = state.policyDocs[Number(doc.getAttribute("data-pdoc"))];
    const note = $("policyNote");
    if (note) note.textContent = "";
    void viewDocument(file);
  });
  $("btnDocClose").addEventListener("click", closeDocument);
  $("btnDocSave").addEventListener("click", () => {
    if (state.docBlob) saveBlob(state.docBlob, state.docName || "document");
  });
  $("policyFoot").addEventListener("click", (event) => {
    if (!event.target.closest("#btnPolicyReport")) return;
    openOps();
  });
  $("btnOpsBack").addEventListener("click", () => show("policy"));
  $("btnPolicyBack").addEventListener("click", () => show("customer"));
  $("btnPolicyShare").addEventListener("click", async () => {
    const policy = state.filePolicies[state.policyIndex];
    if (!policy) return;
    const text = [policyTitle(policy), policyCompany(policy), policyNumber(policy) ? "מספר פוליסה: " + policyNumber(policy) : ""].filter(Boolean).join("\n");
    try {
      if (navigator.share) await navigator.share({ title: "פוליסה", text: text });
      else if (navigator.clipboard) await navigator.clipboard.writeText(text);
    } catch (_err) {}
  });
  $("btnProfile").addEventListener("click", () => {
    show("profile");
    paintProfile();
  });
  $("btnProfileBack").addEventListener("click", () => show("home"));
  $("profileBody").addEventListener("click", (event) => {
    if (event.target.closest("#btnAvatar")) {
      const input = $("avatarFile");
      if (input) input.click();
      return;
    }
    const row = event.target.closest("[data-account]");
    if (!row) return;
    const kind = row.getAttribute("data-account");
    if (kind === "logout") {
      void signOut().then(() => show("splash"));
      return;
    }
    openAccount(kind);
  });
  $("profileBody").addEventListener("change", (event) => {
    const input = event.target.closest("#avatarFile");
    const file = input && input.files && input.files[0];
    if (!file) return;
    cropAvatar(file).then((url) => {
      writeAvatar(url);
      paintHomeIdentity();
      paintProfile();
    }).catch(() => {});
  });
  $("btnAccountBack").addEventListener("click", () => {
    show("profile");
    paintProfile();
  });
  $("accountBody").addEventListener("click", (event) => {
    if (!event.target.closest("#btnNotify")) return;
    void enablePush(true);
  });
  function paintAssignList() {
    const q = token($("assignQuery").value);
    const current = trim(state.file && state.file.agent_id);
    const rows = state.agents.filter((agent) => {
      if (!q) return true;
      return token(agent.name).indexOf(q) >= 0 || token(agent.username).indexOf(q) >= 0;
    });
    $("assignList").innerHTML = rows.length
      ? rows.map((agent) => {
        const id = trim(agent.id);
        const currentMark = current && id === current;
        const selected = state.assignAgentId === id;
        return '<button class="assignRow' + (selected ? " is-on" : "") + '" type="button" data-agent="' + esc(id) + '"' + (currentMark ? " disabled" : "") + '><b>' + esc(trim(agent.name) || "נציג") + '</b><span>' + esc(currentMark ? "משויך כעת" : roleLabel(agent.role)) + '</span></button>';
      }).join("")
      : '<div class="empty">לא נמצאו נציגים</div>';
  }
  async function openAssign() {
    if (!canAssign() || !state.file) return;
    state.assignAgentId = "";
    $("assignError").textContent = "";
    $("assignQuery").value = "";
    const currentName = trim(state.file.agent_name) || trim(state.file.payload && state.file.payload.agentName) || "לא משויך";
    $("assignCurrent").textContent = "נציג נוכחי: " + currentName;
    $("assignSheet").hidden = false;
    $("assignList").innerHTML = '<div class="empty">טוען…</div>';
    try {
      const res = await sb.from("agents").select("id,name,username,role,active").limit(400);
      if (res.error) throw new Error(res.error.message || "agents");
      state.agents = (res.data || []).filter((agent) => agent && agent.active !== false && trim(agent.id));
      paintAssignList();
    } catch (_err) {
      $("assignList").innerHTML = '<div class="empty">לא ניתן לטעון נציגים</div>';
    }
  }
  async function confirmAssign() {
    const file = state.file;
    const target = state.agents.find((agent) => trim(agent.id) === state.assignAgentId);
    if (!file || !target) {
      $("assignError").textContent = "חפש ובחר נציג לשיוך.";
      return;
    }
    if (trim(file.agent_id) === trim(target.id)) {
      $("assignError").textContent = "הלקוח כבר משויך לנציג זה.";
      return;
    }
    const name = trim(target.name) || trim(target.username) || "נציג";
    const userPart = trim(target.username) || name;
    const key = (trim(target.id) + "__" + userPart).toLowerCase().replace(/\s+/g, "_");
    const payload = file.payload && typeof file.payload === "object" ? Object.assign({}, file.payload) : {};
    payload.agentId = trim(target.id);
    payload.agentName = name;
    payload.createdBy = name;
    payload.createdByKey = key;
    const patch = {
      agent_id: trim(target.id),
      agent_name: name,
      agent_role: roleLabel(target.role),
      updated_at: new Date().toISOString(),
      payload: payload
    };
    setBusy($("assignConfirm"), true);
    $("assignError").textContent = "";
    try {
      const res = await sb.from("customers").update(patch).eq("id", file.id);
      if (res.error) throw new Error(res.error.message || "assign");
      const idNumber = trim(file.id_number);
      if (idNumber) {
        const props = await sb.from("proposals").select("id,payload").eq("id_number", idNumber).limit(30);
        if (!props.error) {
          for (let i = 0; i < (props.data || []).length; i += 1) {
            const row = props.data[i];
            const next = row.payload && typeof row.payload === "object" ? Object.assign({}, row.payload) : {};
            next.agentId = patch.agent_id;
            next.agentName = name;
            next.createdBy = name;
            next.createdByKey = key;
            await sb.from("proposals").update({
              agent_id: patch.agent_id,
              agent_name: name,
              agent_role: patch.agent_role,
              updated_at: patch.updated_at,
              payload: next
            }).eq("id", row.id);
          }
        }
      }
      file.agent_id = patch.agent_id;
      file.agent_name = name;
      file.payload = payload;
      $("assignSheet").hidden = true;
      paintCustomerFile();
      const note = $("fileNote");
      if (note) note.textContent = "הלקוח שויך ל־" + name;
    } catch (err) {
      $("assignError").textContent = err.message || "השיוך לא נשמר";
    } finally {
      setBusy($("assignConfirm"), false);
    }
  }
  function israelDateKey() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  function israelDayLabel() {
    return new Intl.DateTimeFormat("he-IL", {
      timeZone: "Asia/Jerusalem",
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(new Date());
  }

  function stampDateIL(raw) {
    const s = trim(raw);
    if (!s) return "";
    const isoDay = /^(\d{4}-\d{2}-\d{2})$/.exec(s);
    if (isoDay) return isoDay[1];
    const ilDay = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (ilDay) return ilDay[3] + "-" + ilDay[2] + "-" + ilDay[1];
    const ms = Date.parse(s);
    if (!Number.isFinite(ms)) {
      const prefix = /^(\d{4}-\d{2}-\d{2})/.exec(s);
      return prefix ? prefix[1] : "";
    }
    try {
      return new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
    } catch (_err) {
      const prefix = /^(\d{4}-\d{2}-\d{2})/.exec(s);
      return prefix ? prefix[1] : "";
    }
  }

  function moneyNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  }

  function leadMeta(description) {
    const text = String(description || "");
    const mark = "---LEAD_META_JSON---";
    const at = text.lastIndexOf(mark);
    if (at < 0) return {};
    try {
      const parsed = JSON.parse(text.slice(at + mark.length).trim());
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_err) {
      return {};
    }
  }

  const SECTOR_TYPE = {
    "ריסק": "סיכונים",
    "ריסק משכנתא": "סיכונים",
    "ביטוח חיים": "סיכונים",
    "אובדן כושר עבודה": "סיכונים",
    "בריאות": "בריאות",
    "מחלות קשות": "בריאות",
    "סרטן": "בריאות",
    "מדיקר": "בריאות",
    "רכב": "אלמנטרי",
    "דירה": "אלמנטרי",
    "פנסיה": "פנסיה"
  };

  function salesSector(rawType) {
    const type = trim(rawType);
    if (SECTOR_TYPE[type]) return SECTOR_TYPE[type];
    if (/ריסק|משכנת|חיים|כושר/i.test(type)) return "סיכונים";
    if (/בריאות|מחלות|סרטן|מדיקר/i.test(type)) return "בריאות";
    if (/רכב|דירה|אלמנטר/i.test(type)) return "אלמנטרי";
    if (/פנס/i.test(type)) return "פנסיה";
    if (/גמל|השתלמות|קרן|פיצוי|תגמול/i.test(type)) return "פנסיה";
    if (/מקיף|חובה|צד\s*ג|רכוש|עסק|נסיע|תכולה|מבנה/i.test(type)) return "אלמנטרי";
    return "אחר";
  }

  function sectorLabel(sector) {
    if (sector === "סיכונים") return "פרט";
    if (sector === "אחר") return "בריאות / פרט";
    return sector || "—";
  }

  function sectorUnit(sector) {
    return sector === "אלמנטרי" ? "שנתית" : "חודשית";
  }

  function countLabel(count, one, many) {
    return (Number(count) || 0) === 1 ? one : String(Number(count) || 0) + " " + many;
  }

  function officeBranch(value) {
    const raw = trim(value).toLowerCase().replace(/[\s_-]+/g, "");
    if (raw === "חיפה" || raw === "haifa") return "חיפה";
    if (raw === "מודיעין" || raw === "modiin" || raw === "modi'in" || raw === "מודיעיןמכביםרעות") return "מודיעין";
    return "";
  }

  function nameKey(value) {
    return trim(value).replace(/\s+/g, " ").toLowerCase();
  }

  async function loadAgentDirectory() {
    const res = await sb.from("agents").select("id,name").limit(400);
    if (res.error) throw new Error(res.error.message || "agents");
    return res.data || [];
  }

  async function loadBranchMap() {
    const res = await sb.from("app_meta").select("agent_branches:payload->agentBranches").eq("key", "global").maybeSingle();
    if (res.error) throw new Error(res.error.message || "branches");
    const raw = res.data && res.data.agent_branches;
    const map = {};
    if (raw && typeof raw === "object") {
      Object.keys(raw).forEach((id) => {
        const branch = officeBranch(raw[id]);
        if (trim(id) && branch) map[trim(id)] = branch;
      });
    }
    return map;
  }

  function branchForAgent(map, agentId) {
    const id = trim(agentId);
    if (!id) return "";
    if (map[id]) return map[id];
    const lower = id.toLowerCase();
    const key = Object.keys(map).find((item) => item.toLowerCase() === lower);
    return key ? map[key] : "";
  }

  function matchAgentId(agents, agentName) {
    const key = nameKey(agentName);
    if (!key) return "";
    const exact = (agents || []).find((row) => nameKey(row.name) === key);
    return exact ? trim(exact.id) : "";
  }

  async function loadSalesReport() {
    const sales = await sb.rpc("gi_daily_sales_by_agent", scopeArgs(israelRange()));
    if (sales.error) throw new Error(sales.error.message || "sales");
    const agents = await loadAgentDirectory();
    const branches = await loadBranchMap();
    const byAgent = new Map();
    (Array.isArray(sales.data) ? sales.data : []).forEach((row) => {
      const name = trim(row.agent_name) || "נציג";
      const sector = salesSector(row.product);
      const premium = Math.round((Number(row.premium) || 0) * 100) / 100;
      const policies = Number(row.policies) || 0;
      if (!byAgent.has(name)) {
        const id = matchAgentId(agents, name);
        byAgent.set(name, {
          name: name,
          branch: branchForAgent(branches, id),
          sectors: new Map(),
          premium: 0
        });
      }
      const agent = byAgent.get(name);
      if (!agent.sectors.has(sector)) agent.sectors.set(sector, { sector: sector, premium: 0, policies: 0 });
      const bucket = agent.sectors.get(sector);
      bucket.premium = Math.round((bucket.premium + premium) * 100) / 100;
      bucket.policies += policies;
      agent.premium = Math.round((agent.premium + premium) * 100) / 100;
    });
    const list = Array.from(byAgent.values()).sort((a, b) => b.premium - a.premium || a.name.localeCompare(b.name, "he"));
    const areas = { "מודיעין": 0, "חיפה": 0, "": 0 };
    list.forEach((agent) => {
      const key = agent.branch === "מודיעין" || agent.branch === "חיפה" ? agent.branch : "";
      areas[key] = Math.round((areas[key] + agent.premium) * 100) / 100;
    });
    return { agents: list, modiin: areas["מודיעין"], haifa: areas["חיפה"], unassigned: areas[""] };
  }

  function paintSales(report) {
    const total = Math.round(((report.modiin || 0) + (report.haifa || 0)) * 100) / 100;
    const unassigned = report.unassigned > 0
      ? '<div class="areaCard"><span>ללא אזור</span><strong>' + esc(money(report.unassigned)) + '</strong></div>'
      : "";
    const cards = '<p class="moreLead">' + esc(israelDayLabel()) + '</p><div class="areaGrid">'
      + '<div class="areaCard"><span>מודיעין</span><strong>' + esc(money(report.modiin)) + '</strong></div>'
      + '<div class="areaCard"><span>חיפה</span><strong>' + esc(money(report.haifa)) + '</strong></div>'
      + '<div class="areaCard areaCard--wide"><span>סה״כ שני האזורים</span><strong>' + esc(money(total)) + '</strong></div>'
      + unassigned
      + "</div>";
    if (!report.agents.length) {
      $("salesBody").innerHTML = cards + '<div class="empty">אין מכירות ביום זה</div>';
      return;
    }
    const agents = report.agents.map((agent) => {
      const lines = Array.from(agent.sectors.values()).sort((a, b) => b.premium - a.premium).map((line) => {
        return '<div class="sectorLine"><span>' + esc(sectorLabel(line.sector)) + '</span><b>' + esc(money(line.premium)) + '</b><small>'
          + esc(countLabel(line.policies, "פוליסה אחת", "פוליסות")) + " · " + esc(sectorUnit(line.sector)) + "</small></div>";
      }).join("");
      return '<article class="agentSale"><header><b>' + esc(agent.name) + '</b><span>' + esc(agent.branch || "ללא אזור") + "</span></header>" + lines + "</article>";
    }).join("");
    $("salesBody").innerHTML = cards + '<h2 class="blockTitle">נציגים</h2>' + agents;
  }

  async function openSales() {
    show("sales");
    $("salesBody").innerHTML = '<div class="empty">טוען…</div>';
    try {
      await loadScope();
      paintSales(await loadSalesReport());
    } catch (_err) {
      $("salesBody").innerHTML = '<div class="empty">לא ניתן לטעון את דוח המכירות</div>';
    }
  }

  const FLOOR_VIEWS = {
    dashboard: "דשבורד",
    customers: "לקוחות",
    archivedCustomers: "לקוחות שנגנזו",
    proposals: "הצעות",
    elementaryProposals: "הצעות אלמנטרי",
    campaignLeads: "מערכת לידים",
    campaignMyLeads: "הלידים שלי",
    dailySales: "מכירות",
    agentActivity: "פעילות נציג",
    reportsHub: "דוחות",
    dailyReport: "דוח מכירות",
    contacts: "אנשי קשר",
    settings: "הגדרות",
    users: "ניהול משתמשים",
    myTeam: "הצוות שלי",
    myTools: "כלים",
    myProcesses: "התהליכים שלי",
    mirrorCall: "שיחת שיקוף",
    elementaryMirror: "שיקוף אלמנטרי",
    wizard: "אשף"
  };

  function floorFlow(flowType) {
    const flow = trim(flowType);
    if (flow === "elementary") return "אשף אלמנטרי";
    if (flow === "car_click" || flow === "car" || flow === "carInsuranceClick") return "אשף רכב בקליק";
    if (flow === "health" || flow === "health_risks" || flow === "health-risks") return "אשף בריאות וסיכונים";
    return "";
  }

  function floorAction(action) {
    const key = trim(action);
    if (key === "saved_draft") return "שמר הצעה";
    if (key === "paused") return "עצר באמצע";
    if (key === "in_wizard") return "באשף";
    if (key === "viewing_lead") return "צופה בליד";
    if (key === "viewing_customer") return "תיק לקוח";
    if (key === "submitted_proposal") return "הגיש הצעה";
    if (key === "downloading_file") return "מוריד קובץ";
    if (key === "creating_reminder") return "יצר תזכורת";
    if (key === "opening_reminder") return "פותח תזכורת";
    if (key === "typing_lead") return "מקלידה ליד";
    if (key === "idle_surveyor") return "אין פעילות הקלדת ליד";
    return "";
  }

  function floorPremium(row) {
    const now = Number(row && row.premium_now) || 0;
    const before = Number(row && row.premium_before) || 0;
    if (before > 0 && now > 0 && Math.abs(now - before) >= 0.5) {
      return "פרמיה לפני " + money(before) + " · אחרי " + money(now);
    }
    if (now > 0) return "פרמיה " + money(now);
    return trim(row && row.extra_label);
  }

  function floorWhere(row) {
    const action = trim(row && row.action);
    const actionLabel = floorAction(action);
    const extra = trim(row && row.extra_label);
    const entity = trim(row && row.entity_label);
    const wizard = row && (row.wizard_open === true || action === "in_wizard" || action === "saved_draft" || action === "paused" || action === "submitted_proposal");
    if (wizard) {
      const bits = [floorFlow(row.flow_type) || trim(row.view_label) || "אשף"];
      if (trim(row.step_label)) bits.push(trim(row.step_label));
      if (actionLabel && action !== "in_wizard") bits.push(actionLabel);
      const premium = floorPremium(row);
      if (premium) bits.push(premium);
      return bits.join(" · ");
    }
    if (action === "viewing_customer") return "תיק לקוח" + (entity ? " · " + entity : "");
    if (action === "viewing_lead") return "צופה בליד" + (entity ? " · " + entity : "");
    if (action === "downloading_file") return "מוריד קובץ" + (extra ? " · " + extra : "") + (entity ? " · " + entity : "");
    if (action === "creating_reminder") return "יצר תזכורת" + (entity ? " · " + entity : "");
    if (action === "opening_reminder") return "פותח תזכורת" + (entity ? " · " + entity : (extra ? " · " + extra : ""));
    if (action === "typing_lead") return "מקלידה ליד עכשיו";
    if (action === "idle_surveyor") return "אין פעילות הקלדת ליד";
    if (actionLabel) return actionLabel + (entity ? " · " + entity : "");
    return trim(row && row.view_label) || FLOOR_VIEWS[trim(row && row.view)] || trim(row && row.view) || "מסך המערכת";
  }

  function floorVisible(row) {
    if (!state.scope) return true;
    const id = trim(row && row.agent_id);
    if (id && state.scope.ids.indexOf(id) >= 0) return true;
    return state.scope.tokens.has(token(row && row.name));
  }

  async function loadActivity() {
    const cutoff = new Date(Date.now() - 120000).toISOString();
    const res = await sb.from("gi_agent_live")
      .select("id,agent_id,name,view,view_label,wizard_open,flow_type,step_label,action,entity_label,extra_label,premium_now,premium_before,updated_at")
      .eq("online", true)
      .gte("updated_at", cutoff)
      .limit(200);
    if (res.error) throw new Error(res.error.message || "activity");
    return (res.data || []).filter(floorVisible).sort((a, b) => trim(a.name).localeCompare(trim(b.name), "he"));
  }

  function paintActivity(rows) {
    if (!rows.length) {
      $("activityBody").innerHTML = '<div class="empty">אין נציגים מחוברים כרגע</div>';
      return;
    }
    $("activityBody").innerHTML = '<p class="moreLead">מי מחובר עכשיו, ובאיזה מסך</p><div class="liveList">' + rows.map((row) => {
      const where = floorWhere(row);
      const entity = trim(row.entity_label);
      const place = entity && where.indexOf(entity) < 0 ? entity : "";
      return '<article class="liveRow"><span class="liveRow__dot" aria-hidden="true"></span><div><b>' + esc(trim(row.name) || "נציג") + "</b><span>" + esc(where) + "</span>" + (place ? "<small>" + esc(place) + "</small>" : "") + "</div></article>";
    }).join("") + "</div>";
  }

  async function refreshActivity() {
    const screen = document.querySelector('[data-screen="activity"]');
    if (!screen || screen.hidden) return;
    try {
      paintActivity(await loadActivity());
    } catch (_err) {}
  }

  async function openActivity() {
    show("activity");
    $("activityBody").innerHTML = '<div class="empty">טוען…</div>';
    try {
      await loadScope();
      paintActivity(await loadActivity());
    } catch (_err) {
      $("activityBody").innerHTML = '<div class="empty">לא ניתן לטעון את פעילות הנציגים</div>';
    }
  }

  async function loadClosedLeads() {
    const range = israelRange();
    const rows = [];
    const page = 200;
    const windowFilter = 'and(created_at.gte."' + range.start + '",created_at.lt."' + range.end + '"),and(updated_at.gte."' + range.start + '",updated_at.lt."' + range.end + '")';
    for (let i = 0; i < 4; i += 1) {
      let query = sb.from("campaign_leads")
        .select("description,campaign_id,campaign_label,assigned_agent_id")
        .ilike("description", "%LEAD_META_JSON%")
        .or(windowFilter)
        .range(i * page, i * page + page - 1);
      if (state.scope) query = query.in("assigned_agent_id", state.scope.ids);
      const res = await query;
      if (res.error) throw new Error(res.error.message || "lead premium");
      const batch = res.data || [];
      batch.forEach((row) => rows.push(row));
      if (batch.length < page) break;
    }
    return rows;
  }

  function campaignRows(leads) {
    const day = israelDateKey();
    const map = new Map();
    let monthly = 0;
    let annual = 0;
    (leads || []).forEach((row) => {
      const meta = leadMeta(row.description);
      const month = moneyNumber(meta.proposalPremiumMonthly);
      const year = moneyNumber(meta.proposalPremiumAnnual);
      if (!(month > 0) && !(year > 0)) return;
      if (stampDateIL(meta.proposalPremiumAt) !== day) return;
      monthly = Math.round((monthly + month) * 100) / 100;
      annual = Math.round((annual + year) * 100) / 100;
      const key = trim(row.campaign_id) || trim(row.campaign_label) || "general";
      const label = trim(row.campaign_label) || "כללי";
      if (!map.has(key)) map.set(key, { label: label, customers: 0, monthly: 0, annual: 0 });
      const item = map.get(key);
      item.customers += 1;
      item.monthly = Math.round((item.monthly + month) * 100) / 100;
      item.annual = Math.round((item.annual + year) * 100) / 100;
    });
    const campaigns = Array.from(map.values()).sort((a, b) => (b.monthly + b.annual) - (a.monthly + a.annual) || a.label.localeCompare(b.label, "he"));
    return { monthly: monthly, annual: annual, campaigns: campaigns };
  }

  function paintLeadsDay(count, summary) {
    const campaigns = summary.campaigns.length
      ? summary.campaigns.map((row) => {
        const lines = [];
        if (row.monthly > 0) lines.push('<div class="sectorLine"><span>בריאות וסיכונים</span><b>' + esc(money(row.monthly)) + "</b><small>חודשית</small></div>");
        if (row.annual > 0) lines.push('<div class="sectorLine"><span>אלמנטרי</span><b>' + esc(money(row.annual)) + "</b><small>שנתית</small></div>");
        return '<article class="agentSale"><header><b>' + esc(row.label) + "</b><span>" + esc(countLabel(row.customers, "לקוח אחד", "לקוחות")) + "</span></header>" + lines.join("") + "</article>";
      }).join("")
      : '<div class="empty">אין פרמיה שנסגרה היום</div>';
    $("leadsBody").innerHTML = '<p class="moreLead">הנתונים של היום. בחצות מתאפס.</p><div class="areaGrid">'
      + '<div class="areaCard areaCard--wide"><span>לידים שנוצרו היום</span><strong>' + esc(String(count)) + "</strong></div>"
      + '<div class="areaCard"><span>פרמיה שנסגרה</span><strong>' + esc(money(summary.monthly)) + "</strong><small>בריאות וסיכונים · חודשית</small></div>"
      + '<div class="areaCard"><span>פרמיה שנסגרה</span><strong>' + esc(money(summary.annual)) + "</strong><small>אלמנטרי · שנתית</small></div>"
      + '</div><h2 class="blockTitle">פרמיה לפי קמפיין</h2>' + campaigns;
  }

  async function openLeadsDay() {
    show("leadsDay");
    $("leadsBody").innerHTML = '<div class="empty">טוען…</div>';
    try {
      await loadScope();
      const count = await loadLeadCount();
      const summary = campaignRows(await loadClosedLeads());
      paintLeadsDay(count, summary);
    } catch (_err) {
      $("leadsBody").innerHTML = '<div class="empty">לא ניתן לטעון את הלידים</div>';
    }
  }

  function canCompose() {
    const role = state.profile && state.profile.role;
    return role === "admin" || role === "manager";
  }

  function noticeStatus(message, isErr) {
    const el = $("noticeStatus");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("is-err", !!isErr);
  }

  function paintNotice() {
    if (!canCompose()) {
      $("noticeBody").innerHTML = '<p class="noticeStatus is-err">אין הרשאה לשלוח הודעת מערכת</p>';
      return;
    }
    $("noticeBody").innerHTML = '<label class="field" for="noticeInput">הודעת מערכת</label>'
      + '<textarea class="input noticeInput" id="noticeInput" maxlength="2000" placeholder="כתוב הודעה לכל המשתמשים"></textarea>'
      + '<p class="noticeStatus" id="noticeStatus" role="status"></p>'
      + '<button class="primary" id="noticeSend" type="button">שלח</button>';
    $("noticeSend").addEventListener("click", () => { void sendNotice(); });
  }

  function openNotice() {
    show("notice");
    paintNotice();
  }

  async function sendNotice() {
    if (state.noticeSending) return;
    if (!canCompose()) {
      paintNotice();
      return;
    }
    const body = trim($("noticeInput") && $("noticeInput").value);
    if (!body) {
      noticeStatus("יש לכתוב הודעה", true);
      return;
    }
    if (body.length > 2000) {
      noticeStatus("ההודעה ארוכה מדי", true);
      return;
    }
    const profile = state.profile || {};
    const row = {
      id: "sn_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      body: body,
      author_id: trim(profile.id),
      author_name: trim(profile.name) || "מערכת",
      created_at: new Date().toISOString()
    };
    state.noticeSending = true;
    const button = $("noticeSend");
    setBusy(button, true);
    if (button) button.textContent = "שולח...";
    noticeStatus("שולח לכל המשתמשים...", false);
    try {
      const res = await sb.from("gi_system_notices").insert(row);
      if (res.error) throw new Error(res.error.message || "notice");
      try {
        const channel = sb.channel("gi-system-notice");
        await new Promise((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            resolve();
          };
          const timer = window.setTimeout(finish, 1500);
          channel.subscribe((status) => {
            if (status !== "SUBSCRIBED") return;
            Promise.resolve(channel.send({ type: "broadcast", event: "notice", payload: row })).finally(() => {
              window.clearTimeout(timer);
              finish();
            });
          });
        });
        sb.removeChannel(channel);
      } catch (_broadcast) {}
      if ($("noticeInput")) $("noticeInput").value = "";
      noticeStatus("נשלח לכל המשתמשים", false);
    } catch (err) {
      const message = trim(err && err.message);
      noticeStatus(message === "NO_CONNECTION" ? "אין חיבור לשרת" : "שגיאה בשליחה: " + (message || "לא ידוע"), true);
    } finally {
      state.noticeSending = false;
      setBusy(button, false);
      if (button) button.textContent = "שלח";
    }
  }

  const REMINDER_LABELS = { callback: "חזרה ללקוח", documents: "מעקב מסמכים", missing: "השלמת חוסרים" };

  function alertSeenKey() {
    return "onyx-phone-alerts:" + trim(state.profile && state.profile.id);
  }

  function readAlertSeen() {
    try {
      const raw = JSON.parse(localStorage.getItem(alertSeenKey()) || "[]");
      return new Set(Array.isArray(raw) ? raw : []);
    } catch (_err) {
      return new Set();
    }
  }

  function writeAlertSeen(seen) {
    try { localStorage.setItem(alertSeenKey(), JSON.stringify(Array.from(seen).slice(-200))); } catch (_err) {}
  }

  function alertPremiumText(item) {
    const bits = [];
    if (item.monthly > 0) bits.push(money(item.monthly) + " · בריאות וסיכונים");
    if (item.annual > 0) bits.push(money(item.annual) + " · אלמנטרי");
    return bits.join(" · ");
  }

  function buildAlertItems(rows) {
    const day = israelDateKey();
    const items = [];
    (rows || []).forEach((row) => {
      const meta = leadMeta(row.description);
      const agent = trim(row.assigned_agent_name) || "נציג";
      const customer = trim(row.customer_name);
      const monthly = moneyNumber(meta.proposalPremiumMonthly);
      const annual = moneyNumber(meta.proposalPremiumAnnual);
      if (stampDateIL(meta.proposalPremiumAt) === day && (monthly > 0 || annual > 0)) {
        items.push({
          id: "sale:" + row.id + ":" + trim(meta.proposalPremiumAt),
          title: "מכירה באשף בריאות וסיכונים",
          agent: agent,
          customer: customer,
          monthly: monthly,
          annual: annual,
          at: trim(meta.proposalPremiumAt)
        });
      }
      if (trim(row.status) === "closed" && stampDateIL(meta.closedAt || row.updated_at) === day) {
        items.push({
          id: "closed:" + row.id + ":" + trim(meta.closedAt || row.updated_at),
          title: "ליד נסגר",
          agent: agent,
          customer: customer,
          monthly: monthly,
          annual: annual,
          note: trim(meta.closedNote),
          at: trim(meta.closedAt) || trim(row.updated_at)
        });
      }
    });
    items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return items;
  }

  async function loadAlertRows() {
    if (!canCompose()) return [];
    const range = israelRange();
    const res = await sb.from("campaign_leads")
      .select("id,customer_name,assigned_agent_name,status,description,updated_at")
      .gte("updated_at", range.start)
      .lt("updated_at", range.end)
      .or("status.eq.closed,description.ilike.%proposalPremiumAt%")
      .order("updated_at", { ascending: false })
      .limit(80);
    if (res.error) throw new Error(res.error.message || "alerts");
    return buildAlertItems(res.data || []);
  }

  function paintBell(count) {
    const bell = $("btnBell");
    if (bell) bell.classList.toggle("is-hot", canCompose() && count > 0);
  }

  async function pollAlerts() {
    if (!state.profile || !canCompose()) return;
    let items = [];
    try { items = await loadAlertRows(); } catch (_err) { return; }
    state.alerts = items;
    paintBell(items.length);
    void armSaleWatch();
    const seen = readAlertSeen();
    const fresh = items.filter((item) => !seen.has(item.id));
    if (fresh.length && document.visibilityState === "visible") {
      const first = fresh[0];
      const premium = alertPremiumText(first);
      const queued = ringQueue.some((item) => item.kind === "sale") || (state.ringItem && state.ringItem.kind === "sale");
      if (!queued) {
        pushRing({
          kind: "sale",
          ids: fresh.map((item) => item.id),
          tag: "onyx-sale-" + first.id,
          kicker: "מכירה חדשה",
          title: first.agent,
          text: premium || "אין פרמיה רשומה",
          meta: [first.title, trim(first.customer)].filter(Boolean).join(" · ")
        });
      }
    }
    const screen = document.querySelector('[data-screen="alerts"]');
    if (screen && !screen.hidden) paintAlerts(items);
  }

  function stopSaleWatch() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.active) reg.active.postMessage({ type: "watch-stop" });
    }).catch(() => {});
  }

  async function armSaleWatch() {
    if (!canCompose() || !("serviceWorker" in navigator)) return;
    let token = "";
    try {
      const session = await sb.auth.getSession();
      token = session && session.data && session.data.session && session.data.session.access_token || "";
    } catch (_err) { token = ""; }
    if (!token) return;
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) return;
    reg.active.postMessage({
      type: "watch",
      url: SUPABASE_URL,
      key: SUPABASE_KEY,
      token: token,
      seen: Array.from(readAlertSeen()),
      until: Date.now() + 6 * 60 * 60 * 1000
    });
  }

  function startAlertPoll() {
    if (state.alertTimer) return;
    askNotify();
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
    void enablePush(false).then(() => checkReminders());
    void pollAlerts();
    state.alertTimer = window.setInterval(() => {
      void pollAlerts();
      void checkReminders();
    }, 20000);
  }

  function reminderWhen(value) {
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return "";
    try {
      return new Date(ms).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (_err) {
      return "";
    }
  }

  async function loadMyReminders() {
    const name = trim(state.profile && state.profile.name);
    if (!name) return [];
    let res = await sb.from("reminders")
      .select("id,type,details,remind_at,customer_name,is_done,snoozed_until")
      .eq("agent_id", name)
      .eq("is_done", false)
      .order("remind_at", { ascending: true })
      .limit(40);
    if (res.error && /snoozed_until/i.test(res.error.message || "")) {
      res = await sb.from("reminders")
        .select("id,type,details,remind_at,customer_name,is_done")
        .eq("agent_id", name)
        .eq("is_done", false)
        .order("remind_at", { ascending: true })
        .limit(40);
    }
    if (res.error) throw new Error(res.error.message || "reminders");
    return res.data || [];
  }

  function paintAlerts(items) {
    const list = canCompose()
      ? (items.length
        ? '<div class="alertList">' + items.map((item) => {
          const premium = alertPremiumText(item);
          return '<article class="alertCard"><b>' + esc(item.agent) + "</b><strong>" + esc(premium || "אין פרמיה רשומה") + "</strong><span>" + esc(item.title) + "</span>"
            + (item.customer ? "<span>" + esc(item.customer) + "</span>" : "")
            + (item.note ? "<span>" + esc(item.note) + "</span>" : "")
            + "</article>";
        }).join("") + "</div>"
        : '<div class="empty">אין התראות היום</div>')
      : "";
    const reminders = Array.isArray(state.myReminders) ? state.myReminders : [];
    const nowMs = Date.now();
    const reminderHtml = reminders.length
      ? '<div class="remindList">' + reminders.map((row) => {
        const at = Date.parse(row.remind_at);
        const snooze = Date.parse(row.snoozed_until);
        const waiting = Number.isFinite(snooze) && snooze > nowMs;
        const due = Number.isFinite(at) && at <= nowMs && !waiting;
        const when = reminderWhen(waiting ? row.snoozed_until : row.remind_at);
        return '<article class="remindCard' + (due ? " is-due" : "") + '"><div><b>' + esc(REMINDER_LABELS[row.type] || "תזכורת") + "</b><span>" + esc(trim(row.details)) + "</span><span>" + esc(when) + (due ? " · הגיע" : "") + "</span></div><button type=\"button\" data-done=\"" + esc(row.id) + "\">בוצע</button></article>";
      }).join("") + "</div>"
      : '<div class="empty">אין תזכורות פתוחות</div>';
    $("alertsBody").innerHTML = list
      + '<h2 class="blockTitle">תזכורות</h2>'
      + '<button class="primary" id="btnNewReminder" type="button">תזכורת חדשה</button>'
      + reminderHtml;
    $("btnNewReminder").addEventListener("click", openReminder);
  }

  async function openAlerts() {
    show("alerts");
    $("alertsBody").innerHTML = '<div class="empty">טוען…</div>';
    try {
      const reminders = await loadMyReminders();
      state.myReminders = reminders;
      const items = canCompose() ? await loadAlertRows() : [];
      state.alerts = items;
      paintBell(items.length);
      paintAlerts(items);
    } catch (_err) {
      $("alertsBody").innerHTML = '<div class="empty">לא ניתן לטעון את ההתראות</div>';
    }
  }

  function paintReminderForm() {
    const types = ["callback", "documents", "missing"].map((key) => {
      const on = state.reminderType === key ? " is-on" : "";
      return '<button class="typePick' + on + '" type="button" data-remind="' + key + '">' + esc(REMINDER_LABELS[key]) + "</button>";
    }).join("");
    $("reminderBody").innerHTML = '<div class="typeGrid">' + types + "</div>"
      + '<label class="field" for="reminderDetails">פרטים</label>'
      + '<textarea class="input noticeInput" id="reminderDetails" maxlength="500"></textarea>'
      + '<div class="dateRow"><div><label class="field" for="reminderDate">תאריך</label><input class="input" id="reminderDate" type="date"/></div><div><label class="field" for="reminderTime">שעה</label><input class="input" id="reminderTime" type="time"/></div></div>'
      + '<p class="noticeStatus" id="reminderStatus" role="status"></p>'
      + '<button class="primary" id="reminderSave" type="button">שמור תזכורת</button>';
    $("reminderSave").addEventListener("click", () => { void saveReminder(); });
  }

  function onReminderClick(event) {
    const pick = event.target.closest("[data-remind]");
    if (!pick) return;
    state.reminderType = pick.getAttribute("data-remind");
    document.querySelectorAll(".typePick").forEach((node) => node.classList.toggle("is-on", node === pick));
  }

  function openReminder() {
    state.reminderType = "";
    show("reminder");
    paintReminderForm();
  }

  async function saveReminder() {
    const status = $("reminderStatus");
    const type = state.reminderType;
    const details = trim($("reminderDetails") && $("reminderDetails").value);
    const dateVal = trim($("reminderDate") && $("reminderDate").value);
    const timeVal = trim($("reminderTime") && $("reminderTime").value);
    const fail = (message) => {
      if (!status) return;
      status.textContent = message;
      status.classList.add("is-err");
    };
    if (!type) { fail("יש לבחור סוג תזכורת"); return; }
    if ((type === "documents" || type === "missing") && !details) { fail(type === "documents" ? "יש לרשום את המסמכים" : "יש לרשום את החוסרים"); return; }
    if (!dateVal || !timeVal) { fail("יש לבחור תאריך ושעה"); return; }
    const remindAt = new Date(dateVal + "T" + timeVal + ":00");
    if (!Number.isFinite(remindAt.getTime())) { fail("תאריך או שעה לא תקינים"); return; }
    const name = trim(state.profile && state.profile.name) || "מערכת";
    const row = {
      id: "rem_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      agent_id: name,
      type: type,
      details: details || REMINDER_LABELS[type],
      remind_at: remindAt.toISOString(),
      customer_id: null,
      customer_name: null,
      lead_id: null,
      proposal_id: null,
      link_kind: null,
      is_done: false,
      created_at: new Date().toISOString(),
      snoozed_until: null
    };
    setBusy($("reminderSave"), true);
    try {
      const res = await sb.from("reminders").insert(row);
      if (res.error) throw new Error(res.error.message || "reminder");
      await openAlerts();
    } catch (err) {
      fail("שגיאה בשמירה: " + (err.message || ""));
      setBusy($("reminderSave"), false);
    }
  }

  async function completeReminder(id) {
    const res = await sb.from("reminders").update({ is_done: true }).eq("id", id);
    if (res.error) return;
    const seen = readReminded();
    seen.add(id);
    writeReminded(seen);
    try {
      state.myReminders = await loadMyReminders();
    } catch (_err) {
      state.myReminders = (state.myReminders || []).filter((row) => row.id !== id);
    }
    const alerts = document.querySelector('[data-screen="alerts"]');
    if (alerts && !alerts.hidden) paintAlerts(state.alerts || []);
  }

  const ringQueue = [];
  const reminderTimers = new Map();
  let audioCtx = null;
  let notifyAsked = false;

  function remindedKey() {
    return "onyx-phone-reminded:" + trim(state.profile && state.profile.id);
  }

  function readReminded() {
    try {
      const raw = JSON.parse(localStorage.getItem(remindedKey()) || "[]");
      return new Set(Array.isArray(raw) ? raw : []);
    } catch (_err) {
      return new Set();
    }
  }

  function writeReminded(seen) {
    try { localStorage.setItem(remindedKey(), JSON.stringify(Array.from(seen).slice(-200))); } catch (_err) {}
  }

  function unlockAudio() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  }

  function playTone(ctx, dest, freq, start, duration, velocity) {
    const t = ctx.currentTime + start;
    [1, 2.01, 4.04].forEach((mult, index) => {
      const amp = [1, 0.35, 0.12][index];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * mult, t);
      const peak = Math.max(velocity * amp, 0.0002);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + duration + 0.08);
    });
  }

  function playRing(kind) {
    unlockAudio();
    if (!audioCtx) return;
    const master = audioCtx.createGain();
    master.gain.value = kind === "sale" ? 0.7 : 1;
    master.connect(audioCtx.destination);
    if (kind === "sale") {
      playTone(audioCtx, master, 1318.51, 0, 0.18, 0.35);
      playTone(audioCtx, master, 1760, 0.16, 0.28, 0.4);
      return;
    }
    const phrase = (offset) => {
      playTone(audioCtx, master, 1567.98, offset, 0.7, 0.5);
      playTone(audioCtx, master, 1318.51, offset + 0.22, 1, 0.44);
    };
    phrase(0);
    phrase(1.72);
  }

  function bytesFromBase64Url(value) {
    const rawValue = String(value || "");
    const pad = "=".repeat((4 - rawValue.length % 4) % 4);
    const raw = atob((rawValue + pad).replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  }

  let pushBusy = false;
  let pushReady = false;

  async function sha256Hex(value) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
    return Array.from(new Uint8Array(buf)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function enablePush(ask) {
    if (pushBusy) return;
    if (pushReady && !ask) return;
    const note = (text) => {
      state.pushNote = text || "";
      if (state.account === "notifications") void paintAccount();
    };
    pushBusy = true;
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
        if (ask) note("המכשיר לא תומך");
        return;
      }
      let perm = Notification.permission;
      if (ask && perm === "default") {
        try { perm = await Notification.requestPermission(); } catch (_err) { perm = "denied"; }
      }
      if (perm !== "granted") {
        if (ask && perm === "denied") note("התראות חסומות");
        return;
      }
      const profile = state.profile;
      if (!profile || !trim(profile.name)) return;
      const keyRes = await sb.from("app_meta").select("publicKey:payload->>publicKey").eq("key", "onyx_push_vapid_public").maybeSingle();
      const publicKey = keyRes.data && trim(keyRes.data.publicKey);
      if (!publicKey) {
        if (ask) note("עדיין לא מוכן");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      let previous = "";
      try { previous = localStorage.getItem("onyx-phone-vapid") || ""; } catch (_err) { previous = ""; }
      if (sub && previous && previous !== publicKey) {
        try { await sub.unsubscribe(); } catch (_err) {}
        sub = null;
      }
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytesFromBase64Url(publicKey)
        });
      }
      const json = sub.toJSON();
      const endpoint = sub.endpoint;
      const p256dh = json.keys && json.keys.p256dh;
      const authKey = json.keys && json.keys.auth;
      if (!endpoint || !p256dh || !authKey) {
        if (ask) note("לא נשמר");
        return;
      }
      const saved = await sb.from("app_meta").upsert({
        key: "onyxsub_" + (await sha256Hex(endpoint)).slice(0, 32),
        payload: {
          endpoint: endpoint,
          p256dh: p256dh,
          auth: authKey,
          agent_id: trim(profile.id),
          agent_name: trim(profile.name),
          username: trim(profile.username),
          role: trim(profile.role),
          updated_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });
      if (saved.error) {
        if (ask) note("לא נשמר");
        return;
      }
      try { localStorage.setItem("onyx-phone-vapid", publicKey); } catch (_err) {}
      state.pushNote = "";
      pushReady = true;
      if (state.account === "notifications") void paintAccount();
    } catch (_err) {
      if (ask) note("יש לאשר מתוך האייקון");
    } finally {
      pushBusy = false;
    }
  }

  function askNotify() {
    if (notifyAsked || typeof Notification === "undefined" || Notification.permission !== "default") return;
    notifyAsked = true;
    Notification.requestPermission().then((perm) => {
      if (perm === "granted" && state.profile) void enablePush(false);
    }).catch(() => {});
  }

  function systemNotify(title, body, tag) {
    const payload = {
      body: body,
      lang: "he",
      tag: tag,
      renotify: true,
      vibrate: [180, 80, 180, 80, 320]
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, payload)).catch(() => {});
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try { new Notification(title, payload); } catch (_err) {}
    }
  }

  function showRing(item) {
    state.ringItem = item;
    if (item.kind === "reminder") {
      const seen = readReminded();
      seen.add(item.id);
      writeReminded(seen);
    }
    if (item.kind === "sale") {
      const seen = readAlertSeen();
      (item.ids || []).forEach((id) => seen.add(id));
      writeAlertSeen(seen);
    }
    $("ring").classList.toggle("ring--sale", item.kind === "sale");
    $("ringKicker").textContent = item.kicker || "";
    $("ringTitle").textContent = item.title || "";
    $("ringText").textContent = item.text || "";
    $("ringMeta").textContent = item.meta || "";
    $("ringDone").hidden = item.kind !== "reminder";
    $("ringSnooze").hidden = item.kind !== "reminder";
    $("ringOpen").hidden = item.kind !== "sale";
    $("ring").hidden = false;
    playRing(item.kind === "sale" ? "sale" : "reminder");
    if (document.visibilityState !== "visible") {
      systemNotify(item.title || "ONYX", [item.text, item.meta].filter(Boolean).join("\n"), item.tag || "onyx-ring");
    }
  }

  function nextRing() {
    if (state.ringItem || !ringQueue.length) return;
    showRing(ringQueue.shift());
  }

  function pushRing(item) {
    ringQueue.push(item);
    nextRing();
  }

  function closeRing() {
    state.ringItem = null;
    $("ring").hidden = true;
    window.setTimeout(nextRing, 280);
  }

  async function snoozeReminder(id) {
    const until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const res = await sb.from("reminders").update({ snoozed_until: until }).eq("id", id);
    if (res.error) return;
    const seen = readReminded();
    seen.delete(id);
    writeReminded(seen);
    const row = (state.myReminders || []).find((item) => item.id === id);
    if (row) row.snoozed_until = until;
    armReminders(state.myReminders || []);
  }

  function armReminders(rows) {
    reminderTimers.forEach((handle) => window.clearTimeout(handle));
    reminderTimers.clear();
    const now = Date.now();
    const upcoming = [];
    (rows || []).forEach((row) => {
      const at = Date.parse(row.remind_at);
      const snooze = Date.parse(row.snoozed_until);
      const wake = Number.isFinite(snooze) && snooze > at ? snooze : at;
      if (!Number.isFinite(wake) || wake <= now || wake - now > 6 * 60 * 60 * 1000) return;
      upcoming.push({
        id: row.id,
        at: wake,
        title: REMINDER_LABELS[row.type] || "תזכורת",
        body: trim(row.details)
      });
      reminderTimers.set(row.id, window.setTimeout(() => { void checkReminders(); }, wake - now + 250));
    });
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.active) reg.active.postMessage({ type: "arm", reminders: upcoming });
    }).catch(() => {});
  }

  async function checkReminders() {
    let rows = [];
    try { rows = await loadMyReminders(); } catch (_err) { return; }
    state.myReminders = rows;
    const alerts = document.querySelector('[data-screen="alerts"]');
    if (alerts && !alerts.hidden) paintAlerts(state.alerts || []);
    const now = Date.now();
    const seen = readReminded();
    rows.forEach((row) => {
      const at = Date.parse(row.remind_at);
      const snooze = Date.parse(row.snoozed_until);
      const waiting = Number.isFinite(snooze) && snooze > now;
      const due = Number.isFinite(at) && at <= now && !waiting;
      const already = seen.has(row.id) || ringQueue.some((item) => item.id === row.id) || (state.ringItem && state.ringItem.id === row.id);
      const wake = waiting ? snooze : at;
      const late = Number.isFinite(wake) && now - wake > 3 * 60 * 1000;
      if (!due || already || (late && pushReady)) return;
      pushRing({
        kind: "reminder",
        id: row.id,
        tag: "onyx-rem-" + row.id,
        kicker: "תזכורת",
        title: REMINDER_LABELS[row.type] || "תזכורת",
        text: trim(row.details),
        meta: [trim(row.customer_name), reminderWhen(row.remind_at)].filter(Boolean).join(" · ")
      });
    });
    armReminders(rows);
  }

  function sheetRows(rawSheets) {
    return (Array.isArray(rawSheets) ? rawSheets : []).map((sheet) => {
      const headers = Array.isArray(sheet.header_row) ? sheet.header_row.map((item) => trim(item)) : [];
      const agentCol = findCol(headers, ["נציג", "שם נציג", "סוכן"]);
      const rows = (Array.isArray(sheet.data_rows) ? sheet.data_rows : []).map((item) => {
        const cells = Array.isArray(item && item.cells) ? item.cells.map((value) => trim(value)) : [];
        return {
          agent: trim(item && item.agent) || (agentCol >= 0 ? cells[agentCol] : ""),
          cells: cells
        };
      }).filter(rowVisible);
      return { name: trim(sheet.sheet_name) || "גיליון", headers: headers, rows: rows };
    });
  }

  function cancelKey(value) {
    const n = token(value);
    if (!n) return "";
    if (n === "בוטל חלקי") return "cancelledPartial";
    if (n === "ביטול חלקי") return "partial";
    if (n === "בוטל") return "cancelled";
    if (n === "שומר" || n === "שומרה" || n === "נשמר") return "retained";
    if (n.includes("ממתין") && n.includes("שימור")) return "awaitingRetain";
    return "";
  }

  function reportCols(headers) {
    return {
      status: findCol(headers, ["סטטוס הצעה", "סטאטוס", "סטטוס"]),
      premium: findCol(headers, ["פרמיה חודשית", "פרמיה לחודש", "סכום פרמיה", "פרמיה נטו", "פרמיה"]),
      name: findCol(headers, ["שם לקוח", "שם מלא", "מבוטח", "לקוח", "שם"]),
      company: findCol(headers, ["חברה", "חברת ביטוח", "מבטח"]),
      plan: findCol(headers, ["שם תוכנית", "תוכנית"]),
      month: findCol(headers, ["חודש ביצוע", "חודש"])
    };
  }

  async function loadCancellations() {
    const res = await sb.from("gi_cancellations_report")
      .select("uploaded_at,uploaded_by_name,sheets")
      .eq("id", "active")
      .maybeSingle();
    if (res.error) throw new Error(res.error.message || "cancellations");
    const row = res.data || {};
    return {
      uploadedAt: trim(row.uploaded_at),
      uploadedBy: trim(row.uploaded_by_name),
      sheets: sheetRows(row.sheets)
    };
  }

  function cancelStats(sheet) {
    const cols = reportCols(sheet.headers);
    const stats = {
      cancelled: { premium: 0, count: 0 },
      cancelledPartial: { premium: 0, count: 0 },
      partial: { premium: 0, count: 0 },
      awaitingRetain: { premium: 0, count: 0 },
      retained: { premium: 0, count: 0 }
    };
    sheet.rows.forEach((row) => {
      const key = cancelKey(cell(row, cols.status));
      if (!stats[key]) return;
      stats[key].count += 1;
      stats[key].premium = Math.round((stats[key].premium + parseMoney(cell(row, cols.premium))) * 100) / 100;
    });
    const total = ["cancelled", "cancelledPartial", "partial"].reduce((sum, key) => ({
      count: sum.count + stats[key].count,
      premium: Math.round((sum.premium + stats[key].premium) * 100) / 100
    }), { count: 0, premium: 0 });
    return { cols: cols, stats: stats, total: total };
  }

  function statCard(label, data, wide) {
    return '<div class="areaCard' + (wide ? " areaCard--wide" : "") + '"><span>' + esc(label) + '</span><strong>' + esc(money(data.premium)) + '</strong><small>' + esc(String(data.count)) + " פוליסות</small></div>";
  }

  function paintCancel(keepSearch) {
    const report = state.cancelReport;
    const host = $("cancelBody");
    if (!report || !report.sheets.length) {
      host.innerHTML = '<div class="empty">אין דוח ביטולים</div>';
      return;
    }
    const index = Math.min(state.cancelSheet, report.sheets.length - 1);
    const sheet = report.sheets[index];
    const built = cancelStats(sheet);
    const q = trim(state.cancelQuery).toLowerCase();
    const rows = sheet.rows.filter((row) => !q || (row.cells.join(" ") + " " + row.agent).toLowerCase().includes(q));
    const shown = rows.slice(0, 80);
    const cards = shown.map((row) => {
      const name = cell(row, built.cols.name) || "ללא שם";
      const status = cell(row, built.cols.status);
      const company = cell(row, built.cols.company);
      return '<article class="repCard"><b>' + esc(name) + "</b><span>" + esc([status, company].filter(Boolean).join(" · ")) + "</span><strong>" + esc(money(parseMoney(cell(row, built.cols.premium)))) + "</strong><small>" + esc(row.agent || "") + "</small></article>";
    }).join("");
    const meta = "מוצגות " + shown.length + " מתוך " + rows.length + " שורות";
    if (keepSearch && $("cancelList")) {
      $("cancelList").innerHTML = cards || '<div class="empty">אין שורות</div>';
      $("cancelMeta").textContent = meta;
      return;
    }
    const tabs = report.sheets.length > 1
      ? '<div class="chips">' + report.sheets.map((item, sheetIndex) => '<button class="chip' + (sheetIndex === index ? " is-on" : "") + '" type="button" data-sheet="' + sheetIndex + '">' + esc(item.name) + "</button>").join("") + "</div>"
      : "";
    const when = report.uploadedAt ? reminderWhen(report.uploadedAt) : "";
    const lead = [when ? "הועלה " + when : "", report.uploadedBy].filter(Boolean).join(" · ");
    host.innerHTML = (lead ? '<p class="moreLead">' + esc(lead) + "</p>" : "")
      + '<div class="areaGrid">'
      + statCard("בוטל", built.stats.cancelled, false)
      + statCard("בוטל חלקי", built.stats.cancelledPartial, false)
      + statCard("ביטול חלקי", built.stats.partial, false)
      + statCard("סה״כ פרמיית ביטול", built.total, true)
      + statCard("ממתין לשימור", built.stats.awaitingRetain, false)
      + statCard("סה״כ פרמיה ששומרה", built.stats.retained, false)
      + "</div>"
      + tabs
      + '<input class="input" id="cancelSearch" type="search" placeholder="חיפוש" value="' + esc(state.cancelQuery) + '"/>'
      + '<p class="reportMeta" id="cancelMeta">' + esc(meta) + "</p>"
      + '<div id="cancelList">' + (cards || '<div class="empty">אין שורות</div>') + "</div>";
  }

  async function openCancel() {
    show("cancel");
    $("cancelBody").innerHTML = '<div class="empty">טוען…</div>';
    state.cancelQuery = "";
    state.cancelSheet = 0;
    try {
      await loadScope();
      state.cancelReport = await loadCancellations();
      paintCancel(false);
    } catch (_err) {
      $("cancelBody").innerHTML = '<div class="empty">לא ניתן לטעון את דוח הביטולים</div>';
    }
  }

  function appointmentFromRaw(raw) {
    const sourceRow = raw && typeof raw === "object" ? raw : {};
    const headers = (Array.isArray(sourceRow.header_row) ? sourceRow.header_row : (Array.isArray(sourceRow.headerRow) ? sourceRow.headerRow : [])).map((item) => trim(item));
    const source = Array.isArray(sourceRow.data_rows) ? sourceRow.data_rows : (Array.isArray(sourceRow.dataRows) ? sourceRow.dataRows : []);
    const agentCol = findCol(headers, ["נציג", "שם נציג", "סוכן"]);
    const rows = source.map((item) => {
      const cells = Array.isArray(item && item.cells) ? item.cells.map((value) => trim(value)) : [];
      return {
        agent: trim(item && item.agent) || (agentCol >= 0 ? cells[agentCol] : ""),
        cells: cells
      };
    }).filter(rowVisible);
    return {
      uploadedAt: trim(sourceRow.uploaded_at || sourceRow.uploadedAt),
      uploadedBy: trim(sourceRow.uploaded_by_name || sourceRow.uploadedByName),
      headers: headers,
      rows: rows,
      cols: reportCols(headers)
    };
  }

  function readAppointmentLocal() {
    try {
      const raw = localStorage.getItem("GI_AGENT_APPOINTMENT_REPORT_V1");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_err) {
      return null;
    }
  }

  function loadAppointmentSeed() {
    if (window.GI_AGENT_APPOINTMENT_REPORT_SEED) return Promise.resolve(window.GI_AGENT_APPOINTMENT_REPORT_SEED);
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "../gi-agent-appointment-report-seed.js?v=20260909-agent-appt-report-v1";
      script.onload = () => resolve(window.GI_AGENT_APPOINTMENT_REPORT_SEED || null);
      script.onerror = () => reject(new Error("seed"));
      document.head.appendChild(script);
    });
  }

  async function loadAppointments() {
    const res = await sb.from("gi_agent_appointment_report")
      .select("uploaded_at,uploaded_by_name,header_row,data_rows")
      .eq("id", "active")
      .maybeSingle();
    if (!res.error && res.data) return appointmentFromRaw(res.data);
    const local = readAppointmentLocal();
    if (local) return appointmentFromRaw(local);
    const seed = await loadAppointmentSeed();
    if (!seed) throw new Error(res.error ? res.error.message : "appointments");
    return appointmentFromRaw(seed);
  }

  function paintAppoint(keepSearch) {
    const report = state.appointReport;
    const host = $("appointBody");
    if (!report) {
      host.innerHTML = '<div class="empty">אין דוח מינוי סוכן</div>';
      return;
    }
    const q = trim(state.appointQuery).toLowerCase();
    const rows = report.rows.filter((row) => !q || (row.cells.join(" ") + " " + row.agent).toLowerCase().includes(q));
    let doneCount = 0;
    let donePremium = 0;
    rows.forEach((row) => {
      if (token(cell(row, report.cols.status)) !== "בוצע") return;
      doneCount += 1;
      donePremium = Math.round((donePremium + parseMoney(cell(row, report.cols.premium))) * 100) / 100;
    });
    const shown = rows.slice(0, 80);
    const cards = shown.map((row) => {
      const name = cell(row, report.cols.name) || "ללא שם";
      const status = cell(row, report.cols.status);
      const company = cell(row, report.cols.company);
      const plan = cell(row, report.cols.plan);
      const month = cell(row, report.cols.month);
      return '<article class="repCard"><b>' + esc(name) + "</b><span>" + esc([company, plan].filter(Boolean).join(" · ")) + "</span><strong>" + esc(money(parseMoney(cell(row, report.cols.premium)))) + "</strong><small>" + esc([status, row.agent, month].filter(Boolean).join(" · ")) + "</small></article>";
    }).join("");
    const meta = "מוצגות " + shown.length + " מתוך " + rows.length + " שורות";
    if (keepSearch && $("appointList")) {
      $("appointList").innerHTML = cards || '<div class="empty">אין שורות</div>';
      $("appointMeta").textContent = meta;
      return;
    }
    const when = report.uploadedAt ? reminderWhen(report.uploadedAt) : "";
    const lead = when
      ? ["הועלה " + when, report.uploadedBy].filter(Boolean).join(" · ")
      : "נטען מדוח מינוי סוכן";
    host.innerHTML = (lead ? '<p class="moreLead">' + esc(lead) + "</p>" : "")
      + '<div class="areaGrid"><div class="areaCard"><span>פרמיה שבוצעה</span><strong id="appointDone">' + esc(money(donePremium)) + '</strong><small id="appointDoneSub">' + esc(String(doneCount)) + ' פוליסות בוצע</small></div><div class="areaCard"><span>שורות בדוח</span><strong>' + esc(String(rows.length)) + "</strong><small>לפי השיוך שלך</small></div></div>"
      + '<input class="input" id="appointSearch" type="search" placeholder="חיפוש" value="' + esc(state.appointQuery) + '"/>'
      + '<p class="reportMeta" id="appointMeta">' + esc(meta) + "</p>"
      + '<div id="appointList">' + (cards || '<div class="empty">אין שורות</div>') + "</div>";
  }

  async function openAppoint() {
    show("appoint");
    $("appointBody").innerHTML = '<div class="empty">טוען…</div>';
    state.appointQuery = "";
    try {
      await loadScope();
      state.appointReport = await loadAppointments();
      paintAppoint(false);
    } catch (_err) {
      $("appointBody").innerHTML = '<div class="empty">לא ניתן לטעון את דוח מינוי הסוכן</div>';
    }
  }

  async function openHubReport(kind) {
    if (kind === "sales") {
      show("report");
      try {
        await loadScope();
        if (!state.report) await loadReport();
        paintReport();
      } catch (_err) {
        $("reportTable").innerHTML = '<div class="empty">לא ניתן לטעון את דוח המכירות</div>';
      }
      return;
    }
    if (kind === "cancel") await openCancel();
    if (kind === "appoint") await openAppoint();
  }

  $("reminderBody").addEventListener("click", onReminderClick);
  $("alertsBody").addEventListener("click", (event) => {
    const done = event.target.closest("[data-done]");
    if (!done) return;
    void completeReminder(done.getAttribute("data-done"));
  });

  $("assignQuery").addEventListener("input", paintAssignList);
  $("assignList").addEventListener("click", (event) => {
    const row = event.target.closest("[data-agent]");
    if (!row || row.disabled) return;
    state.assignAgentId = row.getAttribute("data-agent");
    paintAssignList();
  });
  $("assignConfirm").addEventListener("click", () => { void confirmAssign(); });
  $("assignBackdrop").addEventListener("click", () => { $("assignSheet").hidden = true; });
  $("btnCustomerBack").addEventListener("click", () => show("customers"));
  $("companyClose").addEventListener("click", () => { $("companySheet").hidden = true; });
  $("companyBackdrop").addEventListener("click", () => { $("companySheet").hidden = true; });
  $("btnCustomersBack").addEventListener("click", () => show("home"));
  document.querySelectorAll("[data-more]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-more");
      setMenu(false);
      if (key === "sales") void openSales();
      if (key === "activity") void openActivity();
      if (key === "leads") void openLeadsDay();
      if (key === "notice") openNotice();
    });
  });
  $("btnSalesBack").addEventListener("click", () => show("home"));
  $("btnActivityBack").addEventListener("click", () => show("home"));
  $("btnLeadsBack").addEventListener("click", () => show("home"));
  $("btnNoticeBack").addEventListener("click", () => show("home"));
  $("btnAlertsBack").addEventListener("click", () => show("home"));
  $("btnReminderBack").addEventListener("click", () => { void openAlerts(); });
  $("btnReportBack").addEventListener("click", () => show("reports"));
  $("btnCancelBack").addEventListener("click", () => show("reports"));
  $("btnAppointBack").addEventListener("click", () => show("reports"));
  document.querySelectorAll("[data-hub]").forEach((button) => {
    button.addEventListener("click", () => { void openHubReport(button.getAttribute("data-hub")); });
  });
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.disabled) return;
      const key = tab.getAttribute("data-tab");
      if (key === "home") show("home");
      if (key === "reports") show("reports");
      if (key === "customers") void openCustomers(false);
      if (key === "alerts") void openAlerts();
    });
  });
  $("customerQuery").addEventListener("input", () => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => { void openCustomers(false); }, 280);
  });
  ["reportSearch", "filterAgent", "filterStatus", "filterTeam", "filterPlan"].forEach((id) => {
    $(id).addEventListener("input", paintReport);
    $(id).addEventListener("change", paintReport);
  });

  $("ringDone").addEventListener("click", () => {
    const item = state.ringItem;
    closeRing();
    if (item && item.kind === "reminder") void completeReminder(item.id);
  });
  $("ringSnooze").addEventListener("click", () => {
    const item = state.ringItem;
    closeRing();
    if (item && item.kind === "reminder") void snoozeReminder(item.id);
  });
  $("ringOpen").addEventListener("click", () => {
    closeRing();
    void openAlerts();
  });
  $("ringClose").addEventListener("click", closeRing);
  $("cancelBody").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-sheet]");
    if (!tab) return;
    state.cancelSheet = Number(tab.getAttribute("data-sheet")) || 0;
    state.cancelQuery = "";
    paintCancel(false);
  });
  $("cancelBody").addEventListener("input", (event) => {
    if (event.target.id !== "cancelSearch") return;
    state.cancelQuery = event.target.value;
    paintCancel(true);
  });
  $("appointBody").addEventListener("input", (event) => {
    if (event.target.id !== "appointSearch") return;
    state.appointQuery = event.target.value;
    paintAppoint(true);
  });
  document.addEventListener("pointerdown", () => {
    unlockAudio();
    askNotify();
  }, { passive: true });
  async function shadeOpenItems() {
    if (!state.profile || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      const rows = await loadMyReminders();
      const now = Date.now();
      rows.forEach((row) => {
        const at = Date.parse(row.remind_at);
        const snooze = Date.parse(row.snoozed_until);
        const waiting = Number.isFinite(snooze) && snooze > now;
        if (!Number.isFinite(at) || at > now || waiting) return;
        systemNotify(REMINDER_LABELS[row.type] || "תזכורת", [trim(row.details), trim(row.customer_name)].filter(Boolean).join(" · "), "onyx-rem-" + row.id);
      });
    } catch (_err) {}
    if (!canCompose()) return;
    try {
      const items = await loadAlertRows();
      items.slice(0, 4).forEach((item) => {
        systemNotify(item.agent || "מכירה חדשה", [item.title, trim(item.customer)].filter(Boolean).join(" · "), "onyx-sale-" + item.id);
      });
    } catch (_err) {}
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void shadeOpenItems();
      return;
    }
    if (!state.profile) return;
    void checkReminders();
    if (canCompose()) void pollAlerts();
    const home = document.querySelector('[data-screen="home"]');
    if (home && !home.hidden) void refreshHomeMetrics();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      const data = event.data || {};
      if (!state.profile) return;
      if (data.type === "due") void checkReminders();
      if (data.type === "sale-seen" || data.type === "sale-open") {
        const seen = readAlertSeen();
        (Array.isArray(data.ids) ? data.ids : []).forEach((id) => seen.add(id));
        writeAlertSeen(seen);
        if (data.type === "sale-open" && canCompose()) void openAlerts();
      }
    });
    let swReloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (swReloading) return;
      swReloading = true;
      window.location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((reg) => reg.update()).catch(() => {});
    });
  }

  const SIM_COMPANIES = [
    ["הפניקס", ["ריסק", "בריאות", "מחלות קשות", "סרטן", "ריסק משכנתא"]],
    ["מנורה", ["ריסק", "ריסק משכנתא", "בריאות", "מחלות קשות", "סרטן"]],
    ["הכשרה", ["ריסק", "ריסק משכנתא", "בריאות", "מחלות קשות"]],
    ["מגדל", ["בריאות", "מחלות קשות", "סרטן", "ריסק", "ריסק משכנתא", "מוות מתאונה", "נכות מתאונה"]],
    ["איילון", ["בריאות", "מחלות קשות", "סרטן"]],
    ["כלל", ["בריאות", "מחלות קשות", "סרטן", "ריסק משכנתא", "ריסק"]]
  ];
  const SIM_HEALTH = {"מנורה":[{"id":"transplant","label":"השתלות וטיפולים מיוחדים מחוץ לישראל"},{"id":"abroad_surgery","label":"ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל"},{"id":"drugs","label":"תרופות מחוץ לסל שירותי הבריאות"},{"id":"surgery_first_shekel","label":"ניתוחים שקל ראשון"},{"id":"surgery_shaban","label":"ניתוחים שב״ן משלים"},{"id":"surgery_shaban_5000","label":"ניתוחים שב״ן משלים ₪5000 ה.ע"},{"id":"ambulatory_consults","label":"ייעוצים ובדיקות"},{"id":"fast_diagnosis","label":"אבחון רפואי מהיר"},{"id":"tech_devices","label":"טיפולים בטכנולוגיות מתקדמות ואביזרים רפואיים"},{"id":"smart_dr","label":"סמארט דוקטור — ייעוץ רפואי מקוון"},{"id":"top_complementary","label":"טיפולים טופ — רפואה משלימה"},{"id":"child_dev","label":"טופ לילד — אבחונים וטיפולי התפתחות"},{"id":"top_preventive","label":"מניעתית טופ — רפואה מונעת"}],"הפניקס":[{"id":"transplant","label":"השתלות וטיפולים מיוחדים מחוץ לישראל"},{"id":"abroad_surgery","label":"ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל"},{"id":"drugs","label":"תרופות מחוץ לסל שירותי הבריאות"},{"id":"surgery_first_shekel","label":"ניתוחים בישראל מהשקל הראשון"},{"id":"surgery_shaban","label":"משלים שב\"ן ללא השתתפות עצמית"},{"id":"surgery_shaban_5000","label":"משלים שב\"ן עם השתתפות עצמית 5,000 ₪"},{"id":"ambulatory_consults","label":"ייעוץ ובדיקות"},{"id":"fast_diagnosis","label":"אבחון רפואי מהיר"},{"id":"ambulatory_package","label":"ייעוץ ובדיקות ואבחון רפואי מהיר"},{"id":"ambulatory_accompany","label":"ליווי רפואי וטיפולים אגב אירוע רפואי"},{"id":"complementary","label":"רפואה משלימה"},{"id":"child_dev","label":"כתב שירות התפתחות הילד"},{"id":"expert_click","label":"רופא מומחה בקליק"}],"איילון":[{"id":"transplant","label":"השתלות וטיפולים מיוחדים בחו״ל"},{"id":"drugs","label":"תרופות שלא בסל הבריאות"},{"id":"abroad_surgery","label":"ניתוחים ומחליפי ניתוח בחו״ל"},{"id":"surgery_first_shekel","label":"ניתוחים ומחליפי ניתוח פרטיים בארץ — מהשקל הראשון"},{"id":"surgery_shaban","label":"ניתוחים ומחליפי ניתוח פרטיים בארץ — משלים שב״ן"},{"id":"surgery_shaban_5000","label":"משלים שב״ן עם השתתפות עצמית ₪5,000"},{"id":"ambulatory_extended","label":"שירותים אמבולטוריים לייעוץ ובדיקות — מורחב"},{"id":"ambulatory_consults","label":"שירותים אמבולטוריים לייעוץ ובדיקות"},{"id":"ambulatory_treatments","label":"נספח לטיפולים"},{"id":"fast_diagnosis","label":"נספח לשירותי אבחון מהיר"},{"id":"tech_devices","label":"טיפולים בטכנולוגיות מתקדמות ואביזרים רפואיים"},{"id":"child_dev","label":"אבחונים וטיפולי התפתחות הילד"},{"id":"complementary","label":"רפואה משלימה"},{"id":"online","label":"רפואה אונליין — ייעוץ רופא מומחה בקליק"},{"id":"home","label":"איילון עד הבית"},{"id":"sports","label":"איילון ספורטיבי"},{"id":"crisis_bar_gefen","label":"ניהול משברים בר גפן"}],"הכשרה":[{"id":"drugs","label":"תרופות מחוץ לסל שירותי הבריאות"},{"id":"transplant","label":"השתלות וטיפולים מיוחדים מחוץ לישראל"},{"id":"abroad_surgery","label":"ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל"},{"id":"surgery_shaban_5000","label":"ניתוחים בישראל — משלים שב״ן עם השתתפות עצמית 5,000 ₪"},{"id":"surgery_shaban","label":"ניתוחים בישראל — משלים שב״ן ללא השתתפות עצמית"},{"id":"surgery_first_shekel","label":"ניתוחים בישראל מהשקל הראשון"},{"id":"ambulatory_consults","label":"אמבולטורי — ייעוץ ובדיקות"},{"id":"child_premium","label":"שירות פרימיום לילד"}],"מגדל":[{"id":"drugs","label":"תרופות מחוץ לסל"},{"id":"transplant","label":"השתלות וטיפולים מיוחדים מחוץ לישראל"},{"id":"abroad_surgery","label":"ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל"},{"id":"surgery_shaban_5000","label":"משלים שב\"ן עם השתתפות עצמית 5,000 ₪"},{"id":"surgery_shaban","label":"משלים שב\"ן"},{"id":"surgery_first_shekel","label":"ניתוחים בישראל מהשקל הראשון"},{"id":"ambulatory_base","label":"ייעוץ ובדיקות"},{"id":"ambulatory_extended","label":"ייעוץ ובדיקות אבחנתיות — מורחב"},{"id":"ambulatory_accompany","label":"ליווי רפואי וטיפולים אגב אירוע"},{"id":"ambulatory_tech","label":"טיפולים בטכנולוגיות מתקדמות ואביזרים רפואיים"},{"id":"fast_diagnosis","label":"אבחון מהיר"},{"id":"treatments_general","label":"טיפולים רפואיים — פרק א׳"},{"id":"treatments_child_dev","label":"טיפולים להתפתחות הילד"},{"id":"complementary","label":"רפואה משלימה"},{"id":"online_consult","label":"ייעוץ אונליין"},{"id":"doctor_home","label":"רופא עד הבית"}],"כלל":[{"id":"surgeries_abroad","label":"ניתוחים ומחליפי ניתוח בחו\"ל"},{"id":"transplants_abroad","label":"השתלות וטיפולים מיוחדים בחו\"ל"},{"id":"drugs","label":"תרופות"},{"id":"shaban_deduct","label":"משלים שב\"ן עם השתתפות עצמית 5,000 ₪"},{"id":"shaban","label":"משלים שב\"ן לניתוחים ומחליפי ניתוח בישראל"},{"id":"surgeries_israel","label":"ניתוחים ומחליפי ניתוח בישראל"},{"id":"bar_gefen","label":"חמ\"ל בר גפן"},{"id":"consult_tests","label":"ייעוצים ובדיקות"},{"id":"fast_diag","label":"אבחון רפואי מהיר"},{"id":"consult_diag","label":"ייעוץ, בדיקות ואבחון רפואי מהיר"},{"id":"advanced_tech","label":"טיפולים בטכנולוגיות מתקדמות ואביזרים רפואיים"},{"id":"personal_plus","label":"ליווי אישי פלוס"},{"id":"child_services","label":"שירותים לילד"},{"id":"online_doctor","label":"ביקור רופא און-ליין"},{"id":"online_doctor_extra","label":"ביקור רופא און-ליין אקסטרה"},{"id":"complementary","label":"רפואה משלימה"}]};

  function simBlank() {
    return { step: "details", birthDate: "", startDate: "", gender: "", smoker: "", occupation: "", company: "", product: "", sum: "", covers: {}, age: null, result: null, error: "", busy: false };
  }

  function parseDmy(value) {
    const s = trim(value);
    if (!s) return null;
    let y = 0;
    let m = 0;
    let d = 0;
    let hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) || /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(s);
    if (hit) { y = Number(hit[1]); m = Number(hit[2]); d = Number(hit[3]); }
    else {
      hit = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
      if (hit) { d = Number(hit[1]); m = Number(hit[2]); y = Number(hit[3]); }
    }
    if (!y || !m || !d) {
      const dig = s.replace(/\D+/g, "");
      if (dig.length === 8) {
        d = Number(dig.slice(0, 2));
        m = Number(dig.slice(2, 4));
        y = Number(dig.slice(4, 8));
      }
    }
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
  }

  function isoFromDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function isoDate(value) {
    const date = parseDmy(value);
    return date ? isoFromDate(date) : "";
  }

  function groupSum(raw) {
    const digits = String(raw == null ? "" : raw).replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
    if (!digits) return "";
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function simAddMonths(date, months) {
    const base = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    base.setDate(Math.min(date.getDate(), last));
    return base;
  }

  function insuranceAge(birthValue, asOfValue) {
    const birth = parseDmy(birthValue);
    if (!birth) return null;
    const asOf = trim(asOfValue) ? parseDmy(asOfValue) : new Date();
    if (!asOf) return null;
    const end = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
    const start = new Date(birth.getFullYear(), birth.getMonth(), birth.getDate());
    if (end < start) return null;
    const birthdayInYear = (year) => {
      const dim = new Date(year, start.getMonth() + 1, 0).getDate();
      return new Date(year, start.getMonth(), Math.min(start.getDate(), dim));
    };
    let completed = end.getFullYear() - start.getFullYear();
    if (end < birthdayInYear(end.getFullYear())) completed--;
    if (completed < 0) return null;
    let lastYear = end.getFullYear();
    if (end < birthdayInYear(end.getFullYear())) lastYear -= 1;
    const half = simAddMonths(birthdayInYear(lastYear), 6);
    return end >= half ? completed + 1 : completed;
  }

  function simKind(product) {
    if (product === "בריאות") return "health";
    if (product === "מחלות קשות" || product === "סרטן") return "compensation";
    return "sum";
  }

  function simProducts(company) {
    const row = SIM_COMPANIES.find((item) => item[0] === company);
    return row ? row[1] : [];
  }

  function readSimForm() {
    const sim = state.sim;
    if (!sim) return;
    const birth = $("simBirth");
    const start = $("simStart");
    const job = $("simJob");
    const sum = $("simSum");
    if (birth) sim.birthDate = birth.value;
    if (start) sim.startDate = start.value;
    if (job) sim.occupation = job.value;
    if (sum) sim.sum = sum.value;
  }

  function simDetailsError() {
    const sim = state.sim;
    const birth = parseDmy(sim.birthDate);
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!birth || birth > todayDate) return "נא להזין תאריך לידה תקין (dd/mm/yyyy).";
    if (trim(sim.startDate) && !parseDmy(sim.startDate)) return "תאריך תחילת ביטוח לא תקין (dd/mm/yyyy).";
    if (sim.gender !== "זכר" && sim.gender !== "נקבה") return "נא לבחור מין.";
    if (sim.smoker !== "yes" && sim.smoker !== "no") return "נא לבחור מעשן או לא מעשן.";
    if (insuranceAge(sim.birthDate, sim.startDate) == null) return "לא ניתן לחשב גיל ביטוחי מהתאריכים.";
    return "";
  }

  function openSim() {
    state.sim = simBlank();
    show("sim");
    paintSim();
  }

  function simBack() {
    const sim = state.sim || simBlank();
    state.sim = sim;
    readSimForm();
    if (sim.step === "company") sim.step = "details";
    else if (sim.step === "product") sim.step = "company";
    else if (sim.step === "inputs" || sim.step === "result") sim.step = "product";
    else { show("home"); return; }
    paintSim();
  }

  function simClick(event) {
    const sim = state.sim;
    if (!sim) return;
    readSimForm();
    const gender = event.target.closest("[data-sim-gender]");
    if (gender) { sim.gender = gender.getAttribute("data-sim-gender"); sim.error = ""; paintSim(); return; }
    const smoker = event.target.closest("[data-sim-smoker]");
    if (smoker) { sim.smoker = smoker.getAttribute("data-sim-smoker"); sim.error = ""; paintSim(); return; }
    const company = event.target.closest("[data-sim-company]");
    if (company) { sim.company = company.getAttribute("data-sim-company"); sim.product = ""; sim.step = "product"; sim.error = ""; paintSim(); return; }
    const product = event.target.closest("[data-sim-product]");
    if (product) { sim.product = product.getAttribute("data-sim-product"); sim.covers = {}; sim.sum = ""; sim.result = null; sim.step = "inputs"; sim.error = ""; paintSim(); return; }
    const cover = event.target.closest("[data-sim-cover]");
    if (cover) {
      const id = cover.getAttribute("data-sim-cover");
      sim.covers[id] = !sim.covers[id];
      paintSim();
      return;
    }
    if (event.target.closest("#simNext")) {
      sim.error = simDetailsError();
      if (!sim.error) { sim.age = insuranceAge(sim.birthDate, sim.startDate); sim.step = "company"; }
      paintSim();
      return;
    }
    if (event.target.closest("#simCalc")) { void runSim(); }
    if (event.target.closest("#simAgain")) { sim.step = "inputs"; sim.result = null; sim.error = ""; paintSim(); }
  }

  function loadSimulatorQuotes() {
    if (window.GiSimulatorQuotes && typeof window.GiSimulatorQuotes.quote === "function") return Promise.resolve(window.GiSimulatorQuotes);
    if (loadSimulatorQuotes.pending) return loadSimulatorQuotes.pending;
    window.__GI_SIM_HOST = {
      safeTrim: function (value) { return String(value == null ? "" : value).trim(); },
      escapeHtml: function (value) { return String(value == null ? "" : value); },
      on: function (el, evt, fn) { if (el && el.addEventListener) el.addEventListener(evt, fn); },
      $: function (sel, root) { return (root || document).querySelector(sel); },
      $$: function (sel, root) { return Array.from((root || document).querySelectorAll(sel)); },
      nowISO: function () { return new Date().toISOString(); },
      parseBirthDateValue: function (value) {
        const date = parseDmy(value);
        if (!date) return null;
        const today = new Date();
        if (date > new Date(today.getFullYear(), today.getMonth(), today.getDate())) return null;
        return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), date: date };
      },
      parseAnyDmyDate: function (value) {
        const date = parseDmy(value);
        return date ? { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), date: date } : null;
      },
      formatDmyFromParts: function (y, m, d) {
        return String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0") + "/" + String(y).padStart(4, "0");
      },
      applyDmyAutoFormat: function (el) { return el ? String(el.value || "") : ""; },
      renderCompanyLogoHtmlForCompany: function () { return ""; },
      ensureGiSimulatorStylesLoaded: function () {},
      RiskSimulators: { register: function () {}, getHandler: function () { return null; }, list: function () { return []; }, registry: {} },
      onSimulatorsInstalled: function () {}
    };
    loadSimulatorQuotes.pending = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = new URL("../gi-simulators.js", window.location.href).href;
      script.onload = function () {
        if (window.GiSimulatorQuotes && typeof window.GiSimulatorQuotes.quote === "function") resolve(window.GiSimulatorQuotes);
        else reject(new Error("engine"));
      };
      script.onerror = function () { reject(new Error("engine")); };
      document.head.appendChild(script);
    }).catch(function (err) {
      loadSimulatorQuotes.pending = null;
      throw err;
    });
    return loadSimulatorQuotes.pending;
  }

  function simFailText(result) {
    const code = result && result.error;
    if (code === "NEED_COVERS") return "נא לבחור לפחות כיסוי אחד.";
    if (code === "NEED_INPUT") return "נא להזין סכום.";
    if (code === "UNKNOWN_SIM") return "אין סימולטור לחברה ולמוצר שנבחרו.";
    return "לא ניתן לחשב פרמיה עם הנתונים שהוזנו.";
  }

  async function runSim() {
    const sim = state.sim;
    if (!sim || sim.busy) return;
    readSimForm();
    sim.error = "";
    sim.age = insuranceAge(sim.birthDate, sim.startDate);
    const kind = simKind(sim.product);
    const amount = Number(String(sim.sum || "").replace(/[^\d.]/g, ""));
    const covers = Object.keys(sim.covers).filter((id) => sim.covers[id]);
    if (sim.age == null) sim.error = "לא ניתן לחשב גיל ביטוחי.";
    else if (kind === "health" && !covers.length) sim.error = "נא לבחור לפחות כיסוי אחד.";
    else if (kind !== "health" && !(amount > 0)) sim.error = kind === "compensation" ? "נא להזין סכום פיצוי." : "נא להזין סכום ביטוח.";
    if (sim.error) { paintSim(); return; }
    sim.busy = true;
    paintSim();
    try {
      const quotes = await loadSimulatorQuotes();
      const input = { age: sim.age, gender: sim.gender, smoker: sim.smoker === "yes", occupation: sim.occupation };
      if (kind === "health") input.covers = covers;
      else if (kind === "compensation") input.compensation = amount;
      else input.sumInsured = amount;
      sim.result = quotes.quote(sim.company, sim.product, input);
      sim.error = sim.result && sim.result.ok ? "" : simFailText(sim.result);
      if (sim.result && sim.result.ok) sim.step = "result";
    } catch (_err) {
      sim.error = "לא ניתן לטעון את מנוע הסימולטורים כרגע.";
    }
    sim.busy = false;
    paintSim();
  }

  function paintSim() {
    const host = $("simBody");
    const sim = state.sim || simBlank();
    state.sim = sim;
    if (sim.step === "company") {
      host.innerHTML = '<p class="simLead">בחירת חברה. גיל ביטוחי ' + esc(String(sim.age)) + "</p>" + SIM_COMPANIES.map((row) => '<button class="simPick" type="button" data-sim-company="' + esc(row[0]) + '">' + esc(row[0]) + "</button>").join("");
      return;
    }
    if (sim.step === "product") {
      host.innerHTML = '<p class="simLead">' + esc(sim.company) + "</p>" + simProducts(sim.company).map((product) => '<button class="simPick" type="button" data-sim-product="' + esc(product) + '">' + esc(product) + "</button>").join("");
      return;
    }
    if (sim.step === "inputs" || sim.step === "result") {
      const kind = simKind(sim.product);
      let fields = "";
      if (kind === "health") {
        const list = SIM_HEALTH[sim.company] || [];
        fields = list.map((cover) => '<button class="simCover' + (sim.covers[cover.id] ? " is-on" : "") + '" type="button" data-sim-cover="' + esc(cover.id) + '">' + esc(cover.label) + "</button>").join("");
      } else {
        const label = kind === "compensation" ? "סכום פיצוי" : "סכום ביטוח";
        fields = '<label class="field" for="simSum">' + label + '</label><input class="input" id="simSum" inputmode="numeric" dir="ltr" autocomplete="off" value="' + esc(groupSum(sim.sum)) + '"/>';
      }
      const result = sim.step === "result" && sim.result && sim.result.ok
        ? '<article class="simResult"><p>' + esc(sim.company + " · " + sim.product) + "</p><strong>" + esc(money(sim.result.monthlyPremium)) + "</strong><small>פרמיה חודשית · שנתית " + esc(money(sim.result.annualPremium)) + " · גיל ביטוחי " + esc(String(sim.age)) + '</small></article><button class="primary" id="simAgain" type="button">חישוב נוסף</button>'
        : fields + '<button class="primary" id="simCalc" type="button"' + (sim.busy ? " disabled" : "") + ">" + (sim.busy ? "מחשב..." : "חשב פרמיה") + "</button>";
      const head = sim.step === "result" ? "" : '<p class="simLead">' + esc(sim.company + " · " + sim.product) + "</p>";
      host.innerHTML = head + result + '<p class="formError">' + esc(sim.error) + "</p>";
      return;
    }
    const seg = (attr, value, label) => '<button type="button" data-sim-' + attr + '="' + esc(value) + '"' + ((attr === "gender" ? sim.gender : sim.smoker) === value ? ' class="is-on"' : "") + ">" + esc(label) + "</button>";
    host.innerHTML = '<p class="simLead">פרטי המבוטח. הפרמיה מחושבת במנוע של החברה.</p>'
      + '<label class="field" for="simBirth">תאריך לידה</label><input class="input" id="simBirth" type="date" autocomplete="bday" max="' + esc(isoFromDate(new Date())) + '" value="' + esc(isoDate(sim.birthDate)) + '"/>'
      + '<label class="field" for="simStart">תאריך תחילת ביטוח</label><input class="input" id="simStart" type="date" value="' + esc(isoDate(sim.startDate)) + '"/>'
      + '<span class="field">מין</span><div class="simSeg">' + seg("gender", "זכר", "זכר") + seg("gender", "נקבה", "נקבה") + "</div>"
      + '<span class="field">עישון</span><div class="simSeg">' + seg("smoker", "no", "לא מעשן") + seg("smoker", "yes", "מעשן") + "</div>"
      + '<label class="field" for="simJob">מקצוע (רשות)</label><input class="input" id="simJob" autocomplete="off" maxlength="60" value="' + esc(sim.occupation) + '"/>'
      + '<button class="primary" id="simNext" type="button">המשך לבחירת חברה</button><p class="formError">' + esc(sim.error) + "</p>";
  }
  lockScreen();
  playSplash();
  window.addEventListener("pageshow", (event) => {
    const splash = $("screenSplash");
    if (event.persisted && splash && !splash.hidden) playSplash();
  });
  boot().catch(() => show("splash"));
})();
