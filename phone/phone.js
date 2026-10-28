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
    scopeReady: false,
    factorId: "",
    report: null,
    companies: null,
    customers: [],
    custFilter: "",
    taskTab: "today",
    meetDay: "",
    homeReminders: [],
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

  function paintSystemBar(color) {
    document.querySelectorAll('meta[name="theme-color"]').forEach((node) => {
      node.setAttribute("content", color);
    });
  }

  function show(name) {
    closeDocument();
    paintSystemBar(name === "splash" ? "#1C62C4" : "#F5F8FD");
    document.querySelectorAll("[data-screen]").forEach((node) => {
      node.hidden = node.getAttribute("data-screen") !== name;
    });
    const app = name === "home" || name === "customers" || name === "report" || name === "profile" || name === "alerts" || name === "reports" || name === "leadsDay" || name === "tasks" || name === "meetings" || name === "documents" || name === "newCustomer" || name === "reminder";
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
      const customersOn = (name === "customers" || name === "newCustomer") && key === "customers";
      const leadsOn = name === "leadsDay" && key === "leads";
      const tasksOn = (name === "tasks" || name === "reminder") && key === "tasks";
      const meetingsOn = name === "meetings" && key === "meetings";
      tab.classList.toggle("is-on", homeOn || customersOn || leadsOn || tasksOn || meetingsOn);
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
    if (name === "home") {
      const homeBody = document.querySelector("#screenHome .homeBody");
      if (homeBody) homeBody.scrollTop = 0;
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
    paintSystemBar("#1C62C4");
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

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(loginMessage(""))), ms);
      Promise.resolve(promise).then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      }, (err) => {
        window.clearTimeout(timer);
        reject(err);
      });
    });
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

  function readStoredProfile() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch (_err) { stored = null; }
    if (stored && stored.id && ALLOWED[stored.role]) return stored;
    try { stored = JSON.parse(sessionStorage.getItem(PROFILE_KEY) || "null"); } catch (_err) { stored = null; }
    if (stored && stored.id && ALLOWED[stored.role]) {
      try { localStorage.setItem(PROFILE_KEY, JSON.stringify(stored)); } catch (_err) {}
      return stored;
    }
    return null;
  }

  function writeStoredProfile(profile) {
    const raw = JSON.stringify(profile);
    try { localStorage.setItem(PROFILE_KEY, raw); } catch (_err) {}
    try { sessionStorage.setItem(PROFILE_KEY, raw); } catch (_err) {}
  }

  function clearStoredProfile() {
    try { localStorage.removeItem(PROFILE_KEY); } catch (_err) {}
    try { sessionStorage.removeItem(PROFILE_KEY); } catch (_err) {}
  }

  async function signOut() {
    state.profile = null;
    state.scope = null;
    state.scopeReady = false;
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
    clearStoredProfile();
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
      body: JSON.stringify({ username: username, pin: pin }),
      signal: AbortSignal.timeout(20000)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data || data.ok !== true || !data.access_token) {
      throw new Error(loginMessage(data && data.error));
    }
    const role = roleKey(data.role);
    if (!ALLOWED[role]) {
      throw new Error("האפליקציה פתוחה למנהל, לנציג ולמנהל צוות בלבד.");
    }
    const set = await withTimeout(sb.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token || ""
    }), 20000);
    if (set.error) throw new Error("לא הצלחתי לפתוח את האימות הדו־שלבי. הכניסה נעצרה.");
    state.profile = {
      id: trim(data.agentId),
      name: trim(data.agentName) || username,
      username: username,
      role: role
    };
    const listed = await withTimeout(sb.auth.mfa.listFactors(), 20000);
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
    writeStoredProfile(state.profile);
  }

  function aliasList(aliases, id) {
    const entry = mapValue(aliases, id);
    if (Array.isArray(entry)) return entry.map(trim).filter(Boolean);
    const text = trim(entry);
    return text ? text.split(",").map(trim).filter(Boolean) : [];
  }

  async function teamRoster(profile) {
    const meta = await sb.from("app_meta").select("assigns:payload->teamManagerAssignments,aliases:payload->agentReportAliases").eq("key", "global").maybeSingle();
    if (meta.error) throw new Error(meta.error.message || "team");
    const assigns = asObject(meta.data && meta.data.assigns);
    const aliases = asObject(meta.data && meta.data.aliases);
    const team = await sb.from("agents").select("id,name,username,role,active").eq("team_manager_id", profile.id).limit(200);
    if (team.error) throw new Error(team.error.message || "team");
    const rows = (team.data || []).slice();
    const seen = new Set(rows.map((row) => trim(row.id)).filter(Boolean));
    const assigned = mapValue(assigns, profile.id);
    const assignedIds = (Array.isArray(assigned) ? assigned : []).map(trim).filter((id) => id && id !== profile.id);
    const extraIds = assignedIds.filter((id) => !seen.has(id));
    if (extraIds.length) {
      const extra = await sb.from("agents").select("id,name,username,role,active").in("id", extraIds.slice(0, 200));
      if (extra.error) throw new Error(extra.error.message || "team");
      (extra.data || []).forEach((row) => rows.push(row));
    }
    return { rows: rows, aliases: aliases, assignedIds: new Set(assignedIds) };
  }

  async function loadScope() {
    if (state.scopeReady) return state.scope;
    const profile = state.profile;
    if (!profile) return null;
    if (profile.role === "manager" || profile.role === "admin") {
      state.scope = null;
      state.scopeReady = true;
      return null;
    }
    const ids = [profile.id].filter(Boolean);
    const names = [profile.name, profile.username].map(trim).filter(Boolean);
    let ready = true;
    if (profile.role === "teammanager" && profile.id) {
      try {
        const roster = await teamRoster(profile);
        roster.rows.forEach((row) => {
          const id = trim(row.id);
          if (!id || id === profile.id || row.active === false) return;
          if (roleKey(row.role) !== "agent" && !roster.assignedIds.has(id)) return;
          if (ids.indexOf(id) < 0) ids.push(id);
          if (trim(row.name)) names.push(trim(row.name));
          if (trim(row.username)) names.push(trim(row.username));
          aliasList(roster.aliases, id).forEach((name) => names.push(name));
        });
        aliasList(roster.aliases, profile.id).forEach((name) => names.push(name));
      } catch (_err) {
        ready = false;
      }
    }
    const unique = [...new Set(names)];
    state.scope = {
      ids: ids,
      names: unique,
      tokens: new Set(unique.map(token)),
      tokenLists: unique.map((name) => token(name).split(" ").filter(Boolean))
    };
    state.scopeReady = ready;
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
    if (!key || !state.scope.tokens) return false;
    if (state.scope.tokens.has(key)) return true;
    const parts = key.split(" ").filter(Boolean);
    if (parts.length < 2) return false;
    return (state.scope.tokenLists || []).some((list) => parts.every((part) => list.indexOf(part) >= 0));
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
      .select("id,full_name,id_number,phone,email,status,is_archived,agent_id,new_policies_count,existing_policies_count,created_at")
      .order("created_at", { ascending: false })
      .limit(q ? 20 : 40);
    if (state.scope) query = query.in("agent_id", state.scope.ids);
    query = query.eq("is_archived", false);
    if (q) {
      const safe = q.replace(/[%_,.()]/g, " ").trim();
      const digits = q.replace(/\D/g, "");
      const parts = [];
      if (safe) {
        parts.push("full_name.ilike.%" + safe + "%");
        parts.push("email.ilike.%" + safe + "%");
      }
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

  function customerTone(row) {
    const bucket = customerBucket(row);
    if (bucket === "archive") return { label: "לא פעיל", cls: "is-arch" };
    if (bucket === "pending") return { label: "ממתין", cls: "is-wait" };
    if (stampDateIL(row.created_at) === israelDateKey()) return { label: "חדש", cls: "is-info" };
    return { label: "פעיל", cls: "is-ok" };
  }

  function paintCustomers(rows) {
    const host = $("customerList");
    const shown = rows || [];
    if (!shown.length) {
      host.innerHTML = '<div class="empty">אין לקוחות להצגה</div>';
      return;
    }
    host.innerHTML = shown.map((row) => {
      const name = trim(row.full_name) || "לקוח";
      const tone = customerTone(row);
      const phone = trim(row.phone);
      return '<button class="cust" type="button" data-customer="' + esc(row.id) + '"><span class="cust__mark">' + esc(name.slice(0, 1)) + '</span><div class="cust__main"><div class="cust__name">' + esc(name) + "</div>" + (phone ? '<div class="cust__phone">' + esc(phone) + "</div>" : "") + '</div><span class="cust__status ' + tone.cls + '">' + esc(tone.label) + "</span></button>";
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

  function rowsForAgentTotals(report) {
    if (!report) return [];
    const agent = $("filterAgent").value;
    if (!agent) return report.rows;
    return report.rows.filter((row) => token(row.agent) === token(agent));
  }

  function paintReport() {
    const report = state.report;
    const stats = reportStats({
      rows: rowsForAgentTotals(report),
      cols: report ? report.cols : { status: -1 }
    });
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
      .select("id,full_name,id_number,phone,email,status,is_archived,agent_id,agent_name,created_at,payload")
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
    const name = filename || "document";
    const file = typeof File === "function" ? new File([blob], name, { type: (blob && blob.type) || "application/octet-stream" }) : null;
    if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch((err) => {
        if (err && err.name === "AbortError") return;
        saveBlobAnchor(blob, name);
      });
      return;
    }
    saveBlobAnchor(blob, name);
  }

  function saveBlobAnchor(blob, filename) {
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
    if (href && href.indexOf("data:") === 0) {
      const res = await fetch(href);
      if (!res.ok) throw new Error("לא ניתן לפתוח את הקובץ");
      return await res.blob();
    }
    const path = filePath(file);
    if (path) {
      const bucket = trim(file.storageBucket || file.storage_bucket) || "gi-customer-files";
      const res = await sb.storage.from(bucket).download(path);
      if (!res.error && res.data) return res.data;
      if (!href) throw new Error("לא ניתן לפתוח את הקובץ");
    }
    if (href) {
      const res = await fetch(href);
      if (!res.ok) throw new Error("לא ניתן לפתוח את הקובץ");
      return await res.blob();
    }
    const err = new Error("אין קובץ שמור");
    err.code = "nofile";
    throw err;
  }

  async function sniffMime(blob, name, hinted) {
    const hint = trim(hinted);
    if (hint && hint !== "application/octet-stream") return hint;
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
    if (/\.html?$/i.test(name)) return "text/html";
    if (/\.txt$/i.test(name)) return "text/plain";
    return given || "";
  }

  let pdfLibPromise = null;

  function loadPdfLib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfLibPromise) return pdfLibPromise;
    pdfLibPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
      script.onload = () => {
        if (!window.pdfjsLib) {
          pdfLibPromise = null;
          reject(new Error("pdf"));
          return;
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      };
      script.onerror = () => {
        pdfLibPromise = null;
        reject(new Error("pdf"));
      };
      document.head.appendChild(script);
    });
    return pdfLibPromise;
  }

  async function paintPdfPages(body, blob, token) {
    const lib = await loadPdfLib();
    if (token !== docToken) return;
    const data = new Uint8Array(await blob.arrayBuffer());
    if (token !== docToken) return;
    const pdf = await lib.getDocument({ data: data }).promise;
    if (token !== docToken) return;
    const wrap = document.createElement("div");
    wrap.className = "docPages";
    body.replaceChildren(wrap);
    if (body.clientWidth < 40) await new Promise((resolve) => requestAnimationFrame(resolve));
    const width = Math.max(280, body.clientWidth - 24);
    const pixel = Math.min(window.devicePixelRatio || 1, 2);
    for (let i = 1; i <= pdf.numPages; i += 1) {
      if (token !== docToken) return;
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (width / base.width) * pixel });
      const canvas = document.createElement("canvas");
      canvas.className = "docPage";
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d", { alpha: false });
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      if (token !== docToken) return;
      wrap.appendChild(canvas);
    }
  }

  let sheetLibPromise = null;

  function isSpreadsheet(mime, name, type) {
    if (trim(type) === "har_bituach_file") return true;
    const hint = (trim(mime) + " " + trim(name)).toLowerCase();
    return /spreadsheet|excel|\.xlsx|\.xls|\.csv|text\/csv/.test(hint);
  }

  function loadSheetLib() {
    if (window.XLSX && window.XLSX.read && window.XLSX.utils) return Promise.resolve(window.XLSX);
    if (sheetLibPromise) return sheetLibPromise;
    sheetLibPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.onload = () => {
        if (!window.XLSX || !window.XLSX.read) {
          sheetLibPromise = null;
          reject(new Error("sheet"));
          return;
        }
        resolve(window.XLSX);
      };
      script.onerror = () => {
        sheetLibPromise = null;
        reject(new Error("sheet"));
      };
      document.head.appendChild(script);
    });
    return sheetLibPromise;
  }

  function sheetTable(rows, sheetName) {
    const list = Array.isArray(rows) ? rows : [];
    const shown = list.slice(0, 800);
    const width = shown.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
    if (!width) return null;
    const block = document.createElement("section");
    block.className = "docGrid";
    if (trim(sheetName)) {
      const caption = document.createElement("h2");
      caption.className = "docGrid__name";
      caption.textContent = sheetName;
      block.appendChild(caption);
    }
    const scroller = document.createElement("div");
    scroller.className = "docGrid__scroll";
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const body = document.createElement("tbody");
    const fill = (row) => {
      const cells = Array.isArray(row) ? row.slice(0, 40) : [];
      while (cells.length < Math.min(width, 40)) cells.push("");
      return cells;
    };
    shown.forEach((row, index) => {
      const tr = document.createElement("tr");
      fill(row).forEach((value) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        cell.textContent = value == null ? "" : String(value);
        tr.appendChild(cell);
      });
      if (index === 0) head.appendChild(tr);
      else body.appendChild(tr);
    });
    table.appendChild(head);
    table.appendChild(body);
    scroller.appendChild(table);
    block.appendChild(scroller);
    if (list.length > shown.length) {
      const note = document.createElement("p");
      note.className = "docGrid__note";
      note.textContent = "מוצגות " + shown.length + " שורות ראשונות מתוך " + list.length;
      block.appendChild(note);
    }
    return block;
  }

  async function paintSpreadsheet(body, blob, token) {
    const lib = await loadSheetLib();
    if (token !== docToken) return false;
    const data = new Uint8Array(await blob.arrayBuffer());
    if (token !== docToken) return false;
    const book = lib.read(data, { type: "array", cellDates: true });
    const names = (book.SheetNames || []).filter((name) => trim(name) && trim(name) !== "_gi_har_origin");
    const wrap = document.createElement("div");
    wrap.className = "docPages";
    names.forEach((name) => {
      const rows = lib.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: "", raw: false, blankrows: false });
      const table = sheetTable(rows, names.length > 1 ? name : "");
      if (table) wrap.appendChild(table);
    });
    if (!wrap.childNodes.length) return false;
    if (token !== docToken) return false;
    body.replaceChildren(wrap);
    return true;
  }

  let docToken = 0;
  let docFitResize = null;

  function closeDocument() {
    docToken += 1;
    if (docFitResize) {
      window.removeEventListener("resize", docFitResize);
      docFitResize = null;
    }
    if (state.docUrl) URL.revokeObjectURL(state.docUrl);
    state.docUrl = "";
    state.docBlob = null;
    const view = $("docView");
    if (view) view.hidden = true;
  }

  function rewriteAssetUrl(raw) {
    let abs;
    try { abs = new URL(raw, location.href); } catch (err) { return raw; }
    const at = abs.pathname.indexOf("/phone/");
    if (at < 0) return typeof raw === "string" ? raw : abs.href;
    const tail = abs.pathname.slice(at + "/phone/".length);
    if (!/^(forms|fonts|assets)\//.test(tail)) return typeof raw === "string" ? raw : abs.href;
    abs.pathname = abs.pathname.slice(0, at + 1) + tail;
    return abs.href;
  }

  function installAssetFetch() {
    if (window.fetch && window.fetch.onyxAssets) return;
    const orig = window.fetch.bind(window);
    const wrapped = function (input, init) {
      if (typeof input === "string") return orig(rewriteAssetUrl(input), init);
      if (input && input.url) {
        const fixed = rewriteAssetUrl(input.url);
        if (fixed !== input.url) return orig(new Request(fixed, input), init);
      }
      return orig(input, init);
    };
    wrapped.onyxAssets = true;
    window.fetch = wrapped;
  }

  function loadScript(src) {
    const ready = document.querySelector('script[data-onyx-src="' + src + '"]');
    if (ready && ready.getAttribute("data-ready") === "1") return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.setAttribute("data-onyx-src", src);
      script.onload = () => {
        script.setAttribute("data-ready", "1");
        resolve();
      };
      script.onerror = () => reject(new Error("load"));
      document.head.appendChild(script);
    });
  }

  function installFormFill() {
    if (window.GI_OFFICIAL_FORM_FILL && window.GI_OFFICIAL_FORM_FILL.setTextSafe) return;
    window.GI_OFFICIAL_FORM_FILL = {
      FONT_FILE: "Heebo-Bold.ttf",
      FONT_SIZE: 10,
      visualHebrew(value) {
        const text = String(value == null ? "" : value);
        if (!/[\u0590-\u05FF]/.test(text)) return text;
        const parts = text.match(/[\u0590-\u05FF]+|[^\u0590-\u05FF]+/g) || [text];
        return parts.reverse().map((part) => /[\u0590-\u05FF]/.test(part) ? part.split("").reverse().join("") : part).join("");
      },
      setTextSafe(form, fieldName, value, font, opts) {
        const text = String(value == null ? "" : value).trim();
        if (!text || !form || !form.getTextField) return;
        const useVisual = !(opts && opts.visual === false);
        try {
          const field = form.getTextField(fieldName);
          const painted = (font && useVisual) ? this.visualHebrew(text) : text;
          const size = Number(opts && opts.fontSize) > 0 ? Number(opts.fontSize) : this.FONT_SIZE;
          if (opts && opts.multiline) {
            try { field.enableMultiline(); } catch (err) {}
          }
          field.setText(painted);
          try { field.setFontSize(size); } catch (err) {}
          if (font && field.updateAppearances) field.updateAppearances(font);
        } catch (err) {}
      }
    };
  }

  let pdfToolsPromise = null;
  function loadPdfTools() {
    if (window.PDFLib && window.fontkit) return Promise.resolve();
    if (pdfToolsPromise) return pdfToolsPromise;
    pdfToolsPromise = loadScript("https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js")
      .then(() => loadScript("https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.js"))
      .catch((err) => {
        pdfToolsPromise = null;
        throw err;
      });
    return pdfToolsPromise;
  }

  function repoScript(file) {
    return new URL("../" + file, location.href).href;
  }

  let followupPromise = null;
  function loadFollowup() {
    if (window.GiFollowupZip && window.GI_FOLLOWUP_ZIP_CONFIG) return Promise.resolve();
    if (followupPromise) return followupPromise;
    followupPromise = loadPdfTools()
      .then(() => loadScript(repoScript("gi-followup-zip-config.js")))
      .then(() => loadScript(repoScript("gi-followup-zip.js")))
      .then(() => installFormFill())
      .catch((err) => {
        followupPromise = null;
        throw err;
      });
    return followupPromise;
  }

  let cancelPromise = null;
  function loadCancelForms() {
    if (window.GiCancelForms) return Promise.resolve();
    if (cancelPromise) return cancelPromise;
    cancelPromise = loadPdfTools()
      .then(() => loadScript(repoScript("gi-cancel-forms.js")))
      .catch((err) => {
        cancelPromise = null;
        throw err;
      });
    return cancelPromise;
  }

  let arrivalPromise = null;
  function loadArrivalDocs() {
    if (window.GiArrivalDocs && window.GiArrivalDocs.buildDraft) return Promise.resolve();
    if (arrivalPromise) return arrivalPromise;
    arrivalPromise = loadPdfTools()
      .then(() => loadScript(repoScript("gi-arrival-docs.js")))
      .catch((err) => {
        arrivalPromise = null;
        throw err;
      });
    return arrivalPromise;
  }

  function pdfBlob(bytes, title) {
    return {
      blob: new Blob([bytes], { type: "application/pdf" }),
      name: (trim(title).replace(/\.\w+$/, "") || "document") + ".pdf"
    };
  }

  async function officialOriginal(file) {
    const type = trim(file && file.type);
    if (!type) return null;
    installAssetFetch();
    const rec = state.file;
    try {
      if (type === "followup_questionnaire") {
        await loadFollowup();
        const source = file.followupEntry && typeof file.followupEntry === "object" ? file.followupEntry : null;
        let entry = source ? Object.assign({}, source) : null;
        if (!entry && window.GiFollowupZip && rec) {
          const list = window.GiFollowupZip.resolveForCustomer(rec, { map: {}, insureds: [] }, []) || [];
          entry = list.find((row) => trim(row.company) === trim(file.company) && trim(row.questionnaireNum) === trim(file.questionnaireNo)) || null;
        }
        if (!entry) return null;
        if (!trim(entry.companyKey) && window.GI_FOLLOWUP_ZIP_CONFIG) {
          entry.companyKey = window.GI_FOLLOWUP_ZIP_CONFIG.companyKeyFromLabel(entry.company || file.company);
        }
        if (!trim(entry.questionnaireNum)) entry.questionnaireNum = trim(file.questionnaireNo);
        if (!trim(entry.companyKey) || !trim(entry.questionnaireNum)) return null;
        const bytes = await window.GiFollowupZip.fillFollowupPdf(entry);
        if (!bytes || !bytes.byteLength) return null;
        return pdfBlob(bytes, docTitle(file));
      }
      if (type === "company_cancel_form") {
        await loadCancelForms();
        if (!window.GiCancelForms || !rec) return null;
        const draft = window.GiCancelForms.buildDraft(rec, file);
        const bytes = await window.GiCancelForms.fillOriginalTemplate(draft);
        if (!bytes || !bytes.byteLength) return null;
        return pdfBlob(bytes, window.GiCancelForms.fileName(draft) || docTitle(file));
      }
      if (type === "suitability_document" || type === "premium_development_report" || type === "nispah_he_har_auth" || type === "customer_arrival_pack") {
        await loadArrivalDocs();
        if (!window.GiArrivalDocs || !rec) return null;
        const draft = window.GiArrivalDocs.buildDraft(rec);
        if (type === "nispah_he_har_auth") {
          const bytes = await window.GiArrivalDocs.fillNispahPdf(draft);
          if (!bytes || !bytes.byteLength) return null;
          return pdfBlob(bytes, "הצהרת ביטוח");
        }
        if (type === "customer_arrival_pack" && window.GiArrivalDocs.buildPackPdf) {
          try {
            const bytes = await window.GiArrivalDocs.buildPackPdf(draft, { includeDownloadStep: false });
            if (bytes && bytes.byteLength) return pdfBlob(bytes, "מסמכי הגעה");
          } catch (err) {}
        }
        const html = type === "premium_development_report"
          ? window.GiArrivalDocs.renderPremiaHtml(draft)
          : (type === "suitability_document" ? window.GiArrivalDocs.renderHatamaHtml(draft) : window.GiArrivalDocs.renderCombinedHtml(draft));
        if (!trim(html)) return null;
        return { blob: new Blob([html], { type: "text/html" }), name: (docTitle(file) || "document") + ".html" };
      }
    } catch (err) {
      return null;
    }
    return null;
  }

  function scopeFittedCss(cssText) {
    return String(cssText || "").replace(/:root/g, ":host").replace(/\bhtml\b/g, ":host").replace(/\bbody\b/g, ":host");
  }

  function paintFittedHtml(body, html, token) {
    const parsed = new DOMParser().parseFromString(String(html || ""), "text/html");
    parsed.querySelectorAll("script").forEach((node) => node.remove());
    const host = document.createElement("div");
    host.className = "docFit";
    const root = host.attachShadow({ mode: "open" });
    const sheet = document.createElement("div");
    sheet.className = "docFit__sheet";
    parsed.querySelectorAll("style").forEach((node) => {
      const style = document.createElement("style");
      style.textContent = scopeFittedCss(node.textContent);
      root.appendChild(style);
    });
    const fitStyle = document.createElement("style");
    fitStyle.textContent = ".docFit__sheet{box-sizing:border-box;width:210mm;transform-origin:top left;position:absolute;left:0;top:0}.docFit__html{direction:rtl}";
    root.appendChild(fitStyle);
    const page = document.createElement("div");
    page.className = "docFit__html";
    page.innerHTML = parsed.body ? parsed.body.innerHTML : "";
    page.querySelectorAll("script").forEach((node) => node.remove());
    page.querySelectorAll("[src]").forEach((node) => {
      const src = node.getAttribute("src");
      if (src) node.setAttribute("src", rewriteAssetUrl(src));
    });
    sheet.appendChild(page);
    root.appendChild(sheet);
    body.replaceChildren(host);
    const fit = () => {
      if (token !== docToken || !host.isConnected) return;
      const avail = body.clientWidth;
      if (avail < 40) return;
      sheet.style.transform = "none";
      sheet.style.width = "210mm";
      const wide = Math.max(sheet.scrollWidth, sheet.offsetWidth);
      const tall = Math.max(sheet.scrollHeight, sheet.offsetHeight);
      if (wide < 8 || tall < 8) return;
      const scale = wide > avail + 1 ? avail / wide : 1;
      sheet.style.transform = scale < 1 ? "scale(" + scale + ")" : "none";
      host.style.height = Math.ceil(tall * scale) + "px";
    };
    if (docFitResize) window.removeEventListener("resize", docFitResize);
    docFitResize = fit;
    window.addEventListener("resize", docFitResize);
    page.querySelectorAll("img").forEach((img) => img.addEventListener("load", fit));
    fit();
    requestAnimationFrame(() => {
      fit();
      requestAnimationFrame(fit);
    });
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
      const official = await officialOriginal(file);
      if (token !== docToken) return;
      const blob = official ? official.blob : await fileBlob(file);
      if (token !== docToken) return;
      const storedName = (official && official.name) || trim(file && (file.fileName || file.originalFileName || file.name)) || name;
      const mime = await sniffMime(blob, storedName, file && file.mime);
      const typed = mime && blob.type !== mime ? new Blob([blob], { type: mime }) : blob;
      const url = URL.createObjectURL(typed);
      if (token !== docToken) {
        URL.revokeObjectURL(url);
        return;
      }
      state.docBlob = typed;
      state.docName = (official && official.name) || trim(file && (file.fileName || file.originalFileName)) || name;
      state.docUrl = url;
      if (save) save.hidden = false;
      if (mime.indexOf("image/") === 0) {
        const img = document.createElement("img");
        img.className = "docPage";
        img.alt = "";
        img.src = url;
        const wrap = document.createElement("div");
        wrap.className = "docPages";
        wrap.appendChild(img);
        body.replaceChildren(wrap);
      } else if (mime === "application/pdf" || /\.pdf$/i.test(state.docName)) {
        await paintPdfPages(body, typed, token);
      } else if (isSpreadsheet(mime, state.docName, file && file.type)) {
        const painted = await paintSpreadsheet(body, typed, token);
        if (token !== docToken) return;
        if (!painted) {
          const card = document.createElement("article");
          card.className = "docSheet";
          card.innerHTML = "<h2>" + esc(name) + "</h2><p>המסמך נטען. אפשר להוריד אותו מהכפתור למעלה.</p>";
          body.replaceChildren(card);
        }
      } else if (mime.indexOf("text/") === 0) {
        const text = await typed.text();
        if (token !== docToken) return;
        if (mime === "text/html") {
          paintFittedHtml(body, text, token);
        } else {
          const pre = document.createElement("pre");
          pre.className = "docText";
          pre.textContent = text;
          body.replaceChildren(pre);
        }
      } else {
        const card = document.createElement("article");
        card.className = "docSheet";
        card.innerHTML = "<h2>" + esc(name) + "</h2><p>המסמך נטען. אפשר להוריד אותו מהכפתור למעלה.</p>";
        body.replaceChildren(card);
      }
    } catch (err) {
      if (token !== docToken) return;
      const sheet = err && err.code === "nofile" ? generatedDocument(file) : "";
      if (sheet) {
        body.innerHTML = '<div class="docPages"><div class="docPage">' + sheet + "</div></div>";
        state.docBlob = new Blob(["<!DOCTYPE html><html lang=\"he\" dir=\"rtl\"><meta charset=\"utf-8\"><title>" + name + "</title><body>" + sheet + "</body></html>"], { type: "text/html" });
        state.docName = (name.replace(/\.\w+$/, "") || "document") + ".html";
        if (save) save.hidden = false;
        return;
      }
      if (state.docBlob) {
        body.innerHTML = '<article class="docSheet"><h2>' + esc(name) + "</h2><p>המסמך נטען. אפשר להוריד אותו מהכפתור למעלה.</p></article>";
        if (save) save.hidden = false;
        return;
      }
      body.innerHTML = '<div class="empty">' + esc(err.message || "לא ניתן לפתוח את הקובץ") + "</div>";
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
    const answers = followupAnswerRows(file);
    const body = docRowsHtml(rows) + policies + docRowsHtml(answers);
    if (!body) return "";
    return '<article class="docSheet"><h2>' + esc(docTitle(file)) + "</h2>" + body + "</article>";
  }

  function followupAnswerRows(file) {
    const entry = file && file.followupEntry && typeof file.followupEntry === "object" ? file.followupEntry : file;
    const data = entry && entry.followupData && typeof entry.followupData === "object" ? entry.followupData : {};
    const labels = entry && entry.followupLabels && typeof entry.followupLabels === "object" ? entry.followupLabels : {};
    const names = {
      notes: "הערות לשאלון",
      date: "תאריך",
      diagnosis: "אבחנה",
      diagnosisDate: "תאריך אבחנה",
      treatment: "טיפול",
      hospital: "בית חולים",
      doctor: "רופא מטפל",
      medication: "תרופות",
      details: "פירוט",
      followup: "מעקב",
      tests: "בדיקות",
      status: "מצב כיום",
      surgery: "ניתוח",
      result: "תוצאה",
      reason: "סיבה",
      duration: "משך",
      ongoing: "טיפול נמשך"
    };
    const labelFor = (key) => {
      const given = trim(labels[key]);
      if (given && /[\u0590-\u05FF]/.test(given)) return given;
      const leaf = String(key || "").replace(/^.*__/, "").replace(/^clal_[^_]+_/, "").replace(/^q\d+_/i, "");
      if (names[leaf]) return names[leaf];
      if (/[\u0590-\u05FF]/.test(leaf)) return leaf;
      return "";
    };
    const rows = [];
    const seen = new Set();
    Object.keys(labels).concat(Object.keys(data)).forEach((key) => {
      if (seen.has(key)) return;
      seen.add(key);
      const value = trim(data[key]);
      const label = labelFor(key);
      if (!value || !label) return;
      rows.push([label, value]);
    });
    return rows;
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
    if (monthly > 0) add("פרמיה חודשית", money(monthly));
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

  function folioKind(title) {
    if (/בריאות/.test(title)) return "health";
    if (/חיים/.test(title)) return "life";
    if (/אלמנטרי|דירה|רכב|בית|רכוש/.test(title)) return "home";
    return "other";
  }

  function folioGlyph(kind) {
    if (kind === "health") return policyIcon("בריאות");
    if (kind === "home") return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 11 12 4l8 7"/><path d="M7 10.2V20h10V10.2"/></svg>';
    return policyIcon("חיים");
  }

  function customerAddress(row) {
    const payload = row && row.payload && typeof row.payload === "object" ? row.payload : {};
    const primary = payload.primary || (payload.insureds && payload.insureds[0] && payload.insureds[0].data) || {};
    const city = trim(primary.city) || trim(payload.city);
    const street = trim(primary.street) || trim(payload.street);
    const house = trim(primary.houseNo || primary.houseNumber || payload.houseNo || payload.houseNumber);
    const apt = trim(primary.apartmentNo || primary.apartment || payload.apartmentNo);
    const zip = trim(primary.zip || primary.postalCode || payload.zip);
    const streetLine = [street, house].filter(Boolean).join(" ");
    const place = [streetLine, apt ? "דירה " + apt : ""].filter(Boolean).join(", ");
    const cityLine = [city, zip].filter(Boolean).join(" ");
    return [place, cityLine].filter(Boolean).join(", ");
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
    const email = trim(row.email) || trim(primary.email) || trim(payload.email);
    const tone = customerTone(row);
    const policies = policyRows(payload);
    let monthly = 0;
    policies.forEach((policy) => { monthly += policyMonthly(policy); });
    state.filePolicies = policies;
    state.fileDocs = customerDocs(payload);
    const tab = state.fileTab === "tasks" || state.fileTab === "history" || state.fileTab === "documents" ? state.fileTab : "documents";
    const address = customerAddress(row);
    const agentName = trim(row.agent_name) || trim(payload.agentName);
    const phoneIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 3h3l1 4-2 1a12 12 0 0 0 6 6l1-2 4 1v3c0 1-1 2-2 2A16 16 0 0 1 5 5c0-1 1-2 2-2z"/></svg>';
    const mailIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>';
    const pinIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.2"/></svg>';
    const docIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
    const contactLine = (icon, value, href, ltr, label) => {
      const text = trim(value);
      if (!text) return "";
      const inner = '<b' + (ltr ? ' dir="ltr"' : "") + ">" + esc(text) + '</b><span class="folioLine__ico">' + icon + "</span>";
      const named = label ? ' aria-label="' + label + '"' : "";
      return href ? '<a class="folioLine" href="' + href + '"' + named + ">" + inner + "</a>" : '<div class="folioLine"' + named + ">" + inner + "</div>";
    };
    const contacts = (phone ? '<a class="folioLine" href="tel:' + esc(phone.replace(/[^\d+]/g, "")) + '" aria-label="חיוג"><b dir="ltr">' + esc(phone) + '</b><span class="folioLine__ico">' + phoneIcon + "</span></a>" : "") + contactLine(mailIcon, email, email ? "mailto:" + email : "", true, "אימייל") + contactLine(pinIcon, address, "", false, "כתובת מגורים");
    const letter = name.trim().charAt(0) || "ל";
    const menu = '<div class="folioMenu" id="folioMenu" hidden><button type="button" data-edit="1">עריכת פרטי קשר</button>'
      + (idNumber ? '<div class="folioMenu__line"><span>ת.ז.</span><b dir="ltr">' + esc(idNumber) + "</b></div>" : "")
      + (agentName ? '<div class="folioMenu__line"><span>נציג</span><b>' + esc(agentName) + "</b></div>" : "")
      + (canAssign() ? '<button type="button" data-assign="1">שיוך לקוח לנציג</button>' : "")
      + "</div>";
    const head = menu + '<button class="folioId" type="button" data-edit="1"><span class="folioAvatar" aria-hidden="true">' + esc(letter) + '</span><span class="fileCard__name">' + esc(name) + '</span><span class="folioPill ' + tone.cls + '">' + esc(tone.label) + "</span></button>"
      + (contacts ? '<div class="fileCard__contacts">' + contacts + "</div>" : "");
    const chevron = '<svg class="folioPol__chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
    const list = policies.length
      ? '<div class="polList">' + policies.map((policy, index) => {
        const title = policyTitle(policy);
        const kind = folioKind(title);
        const status = policyStatus(policy);
        return '<button class="folioPol" type="button" data-policy="' + index + '"><span class="folioPol__ico' + (kind === "home" ? " folioPol__ico--home" : "") + '">' + folioGlyph(kind) + '</span><span class="folioPol__text"><b>' + esc(title) + "</b><span>" + esc(status.live ? "בתוקף" : status.text) + "</span></span>" + chevron + "</button>";
      }).join("") + "</div>"
      : '<div class="empty">אין פוליסות שנרכשו בסוכנות</div>';
    const portfolio = '<h2 class="blockTitle">תיק ביטוח</h2><p class="folioSum">סה״כ פרמיה בתיק <b>' + esc(money(monthly)) + "</b></p>" + list;
    const tabBtn = (id, label) => '<button type="button" data-filetab="' + id + '"' + (tab === id ? ' class="is-on"' : "") + ">" + label + "</button>";
    const tabs = '<div class="fileTabs">' + tabBtn("history", "היסטוריה") + tabBtn("tasks", "משימות") + tabBtn("documents", "מסמכים") + "</div>";
    const eventRow = (title, meta, icon, attrs) => '<button class="folioEvent" type="button"' + (attrs || "") + "><span><b>" + esc(title) + "</b><span>" + esc(meta) + '</span></span><span class="folioEvent__ico">' + icon + "</span></button>";
    let body = "";
    if (tab === "tasks") {
      const taskRows = (state.homeReminders || []).filter((item) => token(item.customer_name) === token(name) && item.is_done !== true);
      body = taskRows.length
        ? '<div class="folioEvents">' + taskRows.map((item) => eventRow(REMINDER_LABELS[item.type] || "משימה", reminderWhen(item.remind_at) || trim(item.details), docIcon, "")).join("") + "</div>"
        : '<div class="empty">אין משימות שמורות ללקוח</div>';
    } else if (tab === "history") {
      body = '<div class="empty">אין רשומות שמורות בתיק</div>';
    } else {
      const docs = state.fileDocs;
      body = docs.length
        ? '<div class="folioEvents">' + docs.map((doc, index) => eventRow(docTitle(doc), showDate(doc.uploadedAt || doc.createdAt) || "מסמך", docIcon, ' data-doc="' + index + '"')).join("") + "</div>"
        : '<div class="empty">אין מסמכים בתיק</div>';
    }
    host.innerHTML = head + portfolio + tabs + body + '<p class="fileNote" id="fileNote" role="status"></p>';
  }

  async function openCustomer(id) {
    show("customer");
    $("customerFile").innerHTML = '<div class="empty">טוען…</div>';
    try {
      state.file = await loadCustomerFile(id);
      state.fileTab = "documents";
      if (!state.homeReminders) {
        try { state.homeReminders = await loadMyReminders(); }
        catch (_err) { state.homeReminders = []; }
      }
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
      if (monthly > 0) rows.push({ label: "פרמיה חודשית", value: money(monthly) });
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

  function openOps(back) {
    state.opsReturn = back || "policy";
    show("ops");
    paintOps();
  }

  function opsReportText() {
    const node = $("opsBody");
    return node ? String(node.innerText || "").trim() : "";
  }

  async function sendOpsReport() {
    const text = opsReportText();
    if (!text) return;
    try {
      if (navigator.share) await navigator.share({ title: "דוח תפעולי", text: text });
      else if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
    } catch (_err) {}
  }

  function downloadOpsReport() {
    const node = $("opsBody");
    const page = "<!DOCTYPE html><html lang=\"he\" dir=\"rtl\"><head><meta charset=\"utf-8\"><title>דוח תפעולי</title></head><body>" + (node ? node.innerHTML : "") + "</body></html>";
    saveBlob(new Blob([page], { type: "text/html;charset=utf-8" }), "operational-report.html");
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

  function jerusalemParts(now) {
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
    const get = (type) => Number(parts.find((part) => part.type === type).value);
    return { y: get("year"), m: get("month"), d: get("day"), hh: get("hour"), mm: get("minute"), ss: get("second") };
  }

  function jerusalemWall(day, hour, minute) {
    const guess = Date.UTC(day.y, day.m - 1, day.d, hour, minute, 0);
    const shown = jerusalemParts(new Date(guess));
    const asUtc = Date.UTC(shown.y, shown.m - 1, shown.d, shown.hh, shown.mm, shown.ss);
    return guess - (asUtc - guess);
  }

  function jerusalemSun(now) {
    const rad = Math.PI / 180;
    const dayMs = 86400000;
    const J1970 = 2440588;
    const J2000 = 2451545;
    const obliquity = rad * 23.4397;
    const lat = 31.7683;
    const lng = 35.2137;
    const day = jerusalemParts(now);
    const noon = jerusalemWall(day, 12, 0);
    const toDays = (ms) => (ms / dayMs - 0.5 + J1970) - J2000;
    const lw = rad * -lng;
    const phi = rad * lat;
    const cycle = Math.round(toDays(noon) - 0.0009 - lw / (2 * Math.PI));
    const ds = 0.0009 + lw / (2 * Math.PI) + cycle;
    const mean = rad * (357.5291 + 0.98560028 * ds);
    const ecliptic = mean + rad * (1.9148 * Math.sin(mean) + 0.02 * Math.sin(2 * mean) + 0.0003 * Math.sin(3 * mean)) + rad * 102.9372 + Math.PI;
    const dec = Math.asin(Math.sin(obliquity) * Math.sin(ecliptic));
    const transit = (value) => J2000 + value + 0.0053 * Math.sin(mean) - 0.0069 * Math.sin(2 * ecliptic);
    const angle = Math.acos((Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
    const setJ = transit(0.0009 + (angle + lw) / (2 * Math.PI) + cycle);
    const noonJ = transit(ds);
    const fromJ = (j) => (j + 0.5 - J1970) * dayMs;
    const set = fromJ(setJ);
    return { rise: fromJ(noonJ - (setJ - noonJ)), set: set, stars: set + 30 * 60 * 1000, noon: noon };
  }

  function dayGreeting(now) {
    const when = now instanceof Date ? now : new Date();
    const sun = jerusalemSun(when);
    const t = when.getTime();
    if (t < sun.rise || t >= sun.stars) return "לילה טוב";
    if (t < sun.noon) return "בוקר טוב";
    if (t < sun.set) return "צהריים טובים";
    return "ערב טוב";
  }

  function paintHomeIdentity() {
    const profile = state.profile || {};
    const photo = readAvatar();
    const node = $("homeAvatar");
    if (node) {
      if (photo) node.innerHTML = '<img alt="" src="' + esc(photo) + '"/>';
      else node.textContent = (agentFirstName(profile.name) || "נ").slice(0, 1);
    }
    const hello = $("homeHello");
    if (hello) hello.textContent = dayGreeting();
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

  function formatPct(value) {
    const n = Number(value) || 0;
    return n.toLocaleString("he-IL", { maximumFractionDigits: 1 }) + "%";
  }

  function targetNumber(value) {
    const n = Number(String(value == null ? "" : value).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function asObject(value) {
    if (value && typeof value === "object") return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (_err) {
        return {};
      }
    }
    return {};
  }

  function mapValue(map, id) {
    if (!map || !id) return null;
    if (Object.prototype.hasOwnProperty.call(map, id)) return map[id];
    const key = Object.keys(map).find((item) => item.toLowerCase() === String(id).toLowerCase());
    return key ? map[key] : null;
  }

  function storedTarget(store, id) {
    const entry = mapValue(store, id);
    if (entry == null) return 0;
    if (typeof entry !== "object") return targetNumber(entry);
    return targetNumber(entry.monthlySalesTarget != null ? entry.monthlySalesTarget : entry.monthly_sales_target);
  }

  function agentTarget(store, row) {
    const fromStore = storedTarget(store, row && row.id);
    if (fromStore > 0) return fromStore;
    return targetNumber(row && row.monthly_sales_target);
  }

  function israelWall() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date());
    const get = (type) => Number(parts.find((part) => part.type === type).value);
    return { year: get("year"), month: get("month"), day: get("day") };
  }

  function israelWorkdays(year, month, throughDay) {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const limit = throughDay == null ? last : Math.min(throughDay, last);
    let count = 0;
    for (let day = 1; day <= limit; day += 1) {
      const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      if (dow <= 4) count += 1;
    }
    return count;
  }

  function goalMonthLabel(year, month) {
    const probe = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0));
    try {
      const name = new Intl.DateTimeFormat("he-IL", { month: "long", timeZone: "Asia/Jerusalem" }).format(probe);
      return name + " " + year;
    } catch (_err) {
      return month + "/" + year;
    }
  }

  function goalPaceText(targetValue, netPremium, workdaysLeft) {
    if (!(targetValue > 0)) return "לא הוגדר יעד חודשי";
    const remaining = Math.max(0, targetValue - (Number(netPremium) || 0));
    if (remaining <= 0) {
      const over = (Number(netPremium) || 0) - targetValue;
      return over > 0 ? "היעד הושג · " + money(over) + " מעבר ליעד" : "היעד הושג";
    }
    const left = Math.max(0, Number(workdaysLeft) || 0);
    if (left <= 0) return "נותר " + money(remaining) + " · אין ימי עבודה נוספים החודש";
    const rate = remaining / left;
    const daysLabel = left === 1 ? "נותר יום עבודה אחד" : "נותרו " + left + " ימי עבודה";
    return daysLabel + " · " + money(Math.round(rate)) + " ליום";
  }

  function goalDelta(curr, prev) {
    const current = Number(curr) || 0;
    const previous = Number(prev) || 0;
    if (!previous && !current) return 0;
    if (!previous) return 100;
    return Math.round((((current - previous) / previous) * 100) * 10) / 10;
  }

  async function loadNetFor(range, ids, names) {
    const args = { p_start: range.start, p_end: range.end };
    if (ids && ids.length) {
      args.p_agent_ids = ids;
      args.p_agent_names = names && names.length ? names : [];
    }
    const res = await sb.rpc("gi_dashboard_net_premium", args);
    if (res.error) throw new Error(res.error.message || "sold");
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    return Number(row && (row.net_premium != null ? row.net_premium : row.netPremium)) || 0;
  }

  async function loadGoalScope(profile) {
    const meta = await sb.from("app_meta").select("targets:payload->agentTargets,assigns:payload->teamManagerAssignments").eq("key", "global").maybeSingle();
    if (meta.error) throw new Error(meta.error.message || "targets");
    const store = asObject(meta.data && meta.data.targets);
    const assigns = asObject(meta.data && meta.data.assigns);
    const ownRes = profile.id
      ? await sb.from("agents").select("id,monthly_sales_target,role,active,name,username").eq("id", profile.id).maybeSingle()
      : { data: null, error: null };
    if (ownRes.error) throw new Error(ownRes.error.message || "agent");
    const own = ownRes.data || { id: profile.id, name: profile.name, username: profile.username, role: profile.role, active: true };
    const namesOf = (row) => [row && row.name, row && row.username].map(trim).filter(Boolean);
    const role = roleKey(profile.role);
    if (role === "manager" || role === "admin") {
      return { target: agentTarget(store, own), ids: null, names: null };
    }
    if (role !== "teammanager") {
      return {
        target: agentTarget(store, own),
        ids: [profile.id].filter(Boolean),
        names: [...new Set(namesOf(profile).concat(namesOf(own)))]
      };
    }
    const team = await sb.from("agents").select("id,monthly_sales_target,role,active,name,username").eq("team_manager_id", profile.id).limit(200);
    if (team.error) throw new Error(team.error.message || "team");
    const rows = (team.data || []).slice();
    const seen = new Set(rows.map((row) => trim(row.id)).filter(Boolean));
    const assigned = mapValue(assigns, profile.id);
    const assignedIds = new Set((Array.isArray(assigned) ? assigned : []).map(trim).filter((id) => id && id !== profile.id));
    const extraIds = [...assignedIds].filter((id) => !seen.has(id));
    if (extraIds.length) {
      const extra = await sb.from("agents").select("id,monthly_sales_target,role,active,name,username").in("id", extraIds.slice(0, 200));
      if (!extra.error) (extra.data || []).forEach((row) => rows.push(row));
    }
    const managed = rows.filter((row) => {
      const id = trim(row.id);
      if (!id || id === profile.id || row.active === false) return false;
      return roleKey(row.role) === "agent" || assignedIds.has(id);
    });
    let sum = 0;
    const ids = [profile.id].filter(Boolean);
    const names = namesOf(profile).concat(namesOf(own));
    managed.forEach((row) => {
      sum += agentTarget(store, row);
      const id = trim(row.id);
      if (id && ids.indexOf(id) === -1) ids.push(id);
      namesOf(row).forEach((name) => names.push(name));
    });
    return { target: Math.round(sum * 100) / 100, ids: ids, names: [...new Set(names)] };
  }

  function paintGoal(metrics) {
    const card = $("goalCard");
    if (!card) return;
    ["success", "strong", "mid", "low"].forEach((tone) => card.classList.remove("bankGoal--" + tone));
    card.classList.add("bankGoal--" + metrics.tone);
    $("goalPct").textContent = formatPct(metrics.pct);
    $("goalPctMeta").textContent = formatPct(metrics.pct);
    $("goalSub").textContent = metrics.target > 0 ? "התקדמות חודשית" : "ממתין להגדרת יעד";
    const fill = Math.max(0, Math.min(metrics.pct, 100));
    $("goalTrack").style.setProperty("--goal-progress", fill + "%");
    const goalFill = $("goalTrack").querySelector("span");
    if (goalFill) goalFill.style.width = fill + "%";
    const targetText = metrics.target > 0 ? money(metrics.target) : "₪0";
    $("goalMonthTarget").textContent = targetText;
    $("goalMonth").textContent = targetText;
    $("goalActual").textContent = money(metrics.net);
    const arrow = Number(metrics.delta) >= 0 ? "↗" : "↘";
    $("goalDelta").textContent = arrow + " " + formatPct(Math.abs(Number(metrics.delta) || 0)) + " בכמות מול חודש קודם";
    $("goalDaily").textContent = money(metrics.daily);
    $("goalPace").textContent = metrics.pace;
    $("goalMonthLabel").textContent = metrics.monthLabel;
  }

  function blankGoal() {
    ["goalPct", "goalSub", "goalPctMeta", "goalMonthTarget", "goalActual", "goalDelta", "goalDaily", "goalPace", "goalMonth", "goalMonthLabel"].forEach(blankMetric);
  }

  async function loadGoalCard() {
    const profile = state.profile;
    if (!profile) return;
    const scope = await loadGoalScope(profile);
    const current = israelMonth(0);
    const previous = israelMonth(-1);
    const net = await loadNetFor(current, scope.ids, scope.names);
    const prev = await loadNetFor(previous, scope.ids, scope.names);
    const wall = israelWall();
    const workdaysTotal = Math.max(1, israelWorkdays(wall.year, wall.month));
    const workdaysElapsed = israelWorkdays(wall.year, wall.month, wall.day);
    const todayWorkday = new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay() <= 4;
    const workdaysLeft = Math.max(0, workdaysTotal - workdaysElapsed + (todayWorkday ? 1 : 0));
    const target = Number(scope.target) || 0;
    const pctRaw = target > 0 ? (net / target) * 100 : 0;
    const pct = Math.max(0, Math.round(pctRaw * 10) / 10);
    const tone = pct >= 100 ? "success" : pct >= 80 ? "strong" : pct >= 40 ? "mid" : "low";
    paintGoal({
      target: target,
      net: net,
      pct: pct,
      tone: tone,
      delta: goalDelta(net, prev),
      daily: target > 0 ? target / workdaysTotal : 0,
      pace: goalPaceText(target, net, workdaysLeft),
      monthLabel: goalMonthLabel(wall.year, wall.month)
    });
  }

  function paintHomeSide() {
    const feed = $("homeActivity");
    if (feed) {
      const items = (state.alerts || []).slice(0, 4);
      feed.innerHTML = items.length ? items.map((item) => {
        const closed = String(item.id).indexOf("closed:") === 0;
        return '<article class="feedCard"><b>' + esc(closed ? "ליד נסגר" : "מכירה") + "</b><span>" + esc([item.agent, item.customer].filter(Boolean).join(" · ")) + "</span></article>";
      }).join("") : '<div class="empty">אין פעילות להצגה</div>';
    }
    const tasks = $("homeTasks");
    if (tasks) {
      const now = Date.now();
      const upcoming = (state.homeReminders || []).filter((row) => {
        const at = Date.parse(row.remind_at);
        return Number.isFinite(at) && at >= now;
      }).slice(0, 3);
      tasks.innerHTML = upcoming.length ? upcoming.map((row) => '<article class="feedCard"><b>' + esc(REMINDER_LABELS[row.type] || "משימה") + "</b><span>" + esc([trim(row.customer_name), reminderWhen(row.remind_at)].filter(Boolean).join(" · ")) + "</span></article>").join("") : '<div class="empty">אין משימות קרובות</div>';
    }
  }

  function cancellationPremium(report) {
    const sheets = report && Array.isArray(report.sheets) ? report.sheets : [];
    return sheets.reduce((sum, sheet) => {
      const total = cancelStats(sheet).total.premium;
      return Math.round((sum + total) * 100) / 100;
    }, 0);
  }

  async function refreshHomeMetrics() {
    if (!state.profile || state.homeBusy) return;
    state.homeBusy = true;
    const notes = [];
    try {
      await loadScope();
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
      if ($("tileLeads")) {
        try { $("tileLeads").textContent = String(await countIncomingLeads()); }
        catch (_err) { blankMetric("tileLeads"); notes.push("ספירת הלידים לא נטענה"); }
      }
      if ($("statCustomers") || $("statActive")) {
        try {
          if ($("statCustomers")) $("statCustomers").textContent = String(await countCustomers(false));
          if ($("statActive")) $("statActive").textContent = String(await countCustomers(true));
        } catch (_err) {
          blankMetric("statCustomers");
          blankMetric("statActive");
          notes.push("ספירת הלקוחות לא נטענה");
        }
      }
      try {
        state.homeReminders = await loadMyReminders();
        if ($("statTasks")) {
          const today = israelDateKey();
          const due = state.homeReminders.filter((row) => stampDateIL(row.remind_at) === today).length;
          $("statTasks").textContent = String(due);
        }
      } catch (_err) {
        state.homeReminders = [];
        blankMetric("statTasks");
      }
      paintHomeSide();
      try { $("tileSold").textContent = money(await loadNet(israelRange())); }
      catch (_err) { blankMetric("tileSold"); notes.push("נמכר היום לא נטען"); }
      if ($("tileCancel")) {
        try { $("tileCancel").textContent = money(cancellationPremium(await loadCancellations())); }
        catch (_err) { blankMetric("tileCancel"); notes.push("פרמיית הביטול לא נטענה"); }
      }
      try { await loadGoalCard(); }
      catch (_err) { blankGoal(); notes.push("ביצועים מול יעד לא נטענו"); }
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

  function shiftDay(key, delta) {
    const parts = String(key || "").split("-").map(Number);
    const dt = new Date(Date.UTC(parts[0], (parts[1] || 1) - 1, (parts[2] || 1) + delta));
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return dt.getUTCFullYear() + "-" + mm + "-" + dd;
  }

  function taskInTab(row, tab) {
    if (tab === "done" || tab === "all") return true;
    const at = Date.parse(row.remind_at);
    if (tab === "today") return stampDateIL(row.remind_at) === israelDateKey();
    if (tab === "week") return Number.isFinite(at) && at >= Date.now() - 86400000 && at < Date.now() + 7 * 86400000;
    return true;
  }

  function taskCard(row, done) {
    const title = REMINDER_LABELS[row.type] || trim(row.details) || "משימה";
    const meta = [trim(row.customer_name), reminderWhen(row.remind_at)].filter(Boolean).join(" · ");
    const button = done ? "" : '<button type="button" data-done="' + esc(row.id) + '">בוצע</button>';
    return '<article class="remindCard"><div><b>' + esc(title) + "</b><span>" + esc(meta) + "</span></div>" + button + "</article>";
  }

  function paintTasks(rows) {
    const host = $("taskList");
    const tab = state.taskTab || "today";
    const shown = (rows || []).filter((row) => taskInTab(row, tab));
    host.innerHTML = shown.length ? shown.map((row) => taskCard(row, tab === "done")).join("") : '<div class="empty">אין משימות להצגה</div>';
  }

  async function loadDoneReminders() {
    const name = trim(state.profile && state.profile.name);
    if (!name) return [];
    const res = await sb.from("reminders")
      .select("id,type,details,remind_at,customer_name,is_done")
      .eq("agent_id", name)
      .eq("is_done", true)
      .order("remind_at", { ascending: false })
      .limit(40);
    if (res.error) throw new Error(res.error.message || "reminders");
    return res.data || [];
  }

  async function openTasks() {
    show("tasks");
    const host = $("taskList");
    if (host) host.innerHTML = '<div class="empty">טוען…</div>';
    try {
      const rows = state.taskTab === "done" ? await loadDoneReminders() : await loadRemindersShared();
      paintTasks(rows);
    } catch (_err) {
      if (host) host.innerHTML = '<div class="empty">לא ניתן לטעון משימות</div>';
    }
  }

  function wazeHref(address) {
    const text = trim(address);
    if (!text) return "";
    return "https://waze.com/ul?q=" + encodeURIComponent(text) + "&navigate=yes";
  }

  function meetingCard(row) {
    const address = trim(row.details);
    const href = wazeHref(address);
    const nav = href ? '<a class="meetNav" href="' + esc(href) + '" target="_blank" rel="noopener">ניווט</a>' : "";
    return '<article class="meetCard"><b>' + esc(trim(row.customer_name) || "פגישה") + "</b>"
      + (address ? "<span>" + esc(address) + "</span>" : "")
      + "<span>" + esc(reminderWhen(row.remind_at)) + "</span>" + nav + "</article>";
  }

  function paintMeetings(rows) {
    const today = israelDateKey();
    if (!state.meetDay) state.meetDay = today;
    const anchor = state.meetDay;
    const startDow = new Date(Date.UTC.apply(null, anchor.split("-").map((part, index) => index === 1 ? Number(part) - 1 : Number(part)))).getUTCDay();
    const start = shiftDay(anchor, -startDow);
    const names = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
    const week = $("meetWeek");
    if (week) {
      week.innerHTML = names.map((name, index) => {
        const key = shiftDay(start, index);
        const on = key === state.meetDay ? " is-on" : "";
        return '<button type="button" class="' + on.trim() + '" data-day="' + key + '"><span>' + name + "</span><strong>" + key.slice(-2) + "</strong></button>";
      }).join("");
    }
    const title = $("meetTitle");
    if (title) title.textContent = state.meetDay === today ? "היום" : state.meetDay.split("-").reverse().join(".");
    const list = (rows || []).filter((row) => stampDateIL(row.remind_at) === state.meetDay);
    const host = $("meetList");
    if (host) host.innerHTML = list.length ? list.map((row) => row.type === "meeting" ? meetingCard(row) : taskCard(row, false)).join("") : '<div class="empty">אין פגישות ביום הזה</div>';
  }

  async function openMeetings() {
    show("meetings");
    const host = $("meetList");
    if (host) host.innerHTML = '<div class="empty">טוען…</div>';
    try {
      state.meetRows = await loadRemindersShared();
      paintMeetings(state.meetRows);
    } catch (_err) {
      if (host) host.innerHTML = '<div class="empty">לא ניתן לטעון פגישות</div>';
    }
  }

  let meetDraft = null;

  function israelDateTime(dateKey, timeText) {
    const dateParts = String(dateKey || "").split("-").map(Number);
    const timeParts = String(timeText || "").split(":").map(Number);
    const y = dateParts[0];
    const m = dateParts[1];
    const d = dateParts[2];
    const hh = timeParts[0];
    const mm = timeParts[1] || 0;
    if (!y || !m || !d || !Number.isFinite(hh)) return null;
    const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(guess);
    const get = (type) => Number(parts.find((part) => part.type === type).value);
    const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return new Date(Date.UTC(y, m - 1, d, hh, mm, 0) - (wall - guess.getTime()));
  }

  function paintMeetInvite() {
    const host = $("meetInvite");
    const save = $("meetSave");
    if (!host) return;
    const draft = meetDraft;
    if (!draft || !draft.customer) {
      host.innerHTML = "";
      if (save) save.disabled = true;
      return;
    }
    const href = wazeHref(draft.address);
    const nav = href ? '<a class="meetNav" href="' + esc(href) + '" target="_blank" rel="noopener">ניווט</a>' : "";
    host.innerHTML = '<article class="meetInvite"><b>' + esc(draft.customer.full_name || "לקוח") + "</b>"
      + (draft.customer.id_number ? '<span dir="ltr">' + esc(draft.customer.id_number) + "</span>" : "")
      + (draft.customer.phone ? "<span>" + esc(draft.customer.phone) + "</span>" : "")
      + (draft.address ? "<span>" + esc(draft.address) + "</span>" : "<span>אין כתובת שמורה ללקוח</span>")
      + "<span>" + esc(String(draft.date || "").split("-").reverse().join(".")) + " · 09:00</span>"
      + nav + "</article>";
    if (save) save.disabled = false;
  }

  function openMeetSheet() {
    meetDraft = null;
    const date = $("meetDate");
    if (date) date.value = state.meetDay || israelDateKey();
    const query = $("meetQuery");
    if (query) query.value = "";
    const pick = $("meetPick");
    if (pick) pick.innerHTML = "";
    const error = $("meetError");
    if (error) error.textContent = "";
    paintMeetInvite();
    const sheet = $("meetSheet");
    if (sheet) sheet.hidden = false;
  }

  async function chooseMeetCustomer(row) {
    const error = $("meetError");
    if (error) error.textContent = "";
    let file = row;
    try {
      const loaded = await loadCustomerFile(row.id);
      if (loaded) file = loaded;
    } catch (_err) {}
    meetDraft = {
      date: trim($("meetDate") && $("meetDate").value) || state.meetDay || israelDateKey(),
      customer: file,
      address: customerAddress(file)
    };
    const pick = $("meetPick");
    if (pick) pick.innerHTML = "";
    paintMeetInvite();
  }

  async function findMeetCustomer() {
    const error = $("meetError");
    const pick = $("meetPick");
    const fail = (message) => { if (error) error.textContent = message; };
    if (error) error.textContent = "";
    meetDraft = null;
    paintMeetInvite();
    const q = trim($("meetQuery") && $("meetQuery").value);
    if (!q) { fail("יש לרשום תעודת זהות או שם"); return; }
    const digits = q.replace(/\D/g, "");
    let query = sb.from("customers").select("id,full_name,id_number,phone,email,status,is_archived,agent_id").eq("is_archived", false).limit(8);
    if (state.scope) query = query.in("agent_id", state.scope.ids);
    if (digits.length >= 5) query = query.ilike("id_number", "%" + digits + "%");
    else {
      const safe = q.replace(/[%_,.()]/g, " ").trim();
      if (!safe) { fail("יש לרשום תעודת זהות או שם"); return; }
      query = query.ilike("full_name", "%" + safe + "%");
    }
    const button = $("meetFind");
    setBusy(button, true);
    try {
      const res = await query;
      if (res.error) throw new Error(res.error.message || "customers");
      const rows = res.data || [];
      if (!rows.length) {
        if (pick) pick.innerHTML = "";
        fail("הלקוח לא נמצא. לא נוצר לקוח חדש.");
        return;
      }
      if (rows.length === 1) {
        await chooseMeetCustomer(rows[0]);
        return;
      }
      if (pick) {
        pick.innerHTML = '<div class="meetPick">' + rows.map((row) => '<button type="button" data-meet="' + esc(row.id) + '">' + esc(trim(row.full_name) || "לקוח") + (row.id_number ? " · " + esc(row.id_number) : "") + "</button>").join("") + "</div>";
        pick.querySelectorAll("[data-meet]").forEach((node) => {
          node.addEventListener("click", () => {
            const id = node.getAttribute("data-meet");
            const row = rows.find((item) => item.id === id);
            if (row) void chooseMeetCustomer(row);
          });
        });
      }
    } catch (_err) {
      fail("לא ניתן לאתר את הלקוח");
    } finally {
      setBusy(button, false);
    }
  }

  async function saveMeeting() {
    const error = $("meetError");
    const fail = (message) => { if (error) error.textContent = message; };
    const draft = meetDraft;
    const dateVal = trim($("meetDate") && $("meetDate").value) || (draft && draft.date);
    if (!draft || !draft.customer) { fail("יש לאתר לקוח קיים"); return; }
    if (!dateVal) { fail("יש לבחור תאריך"); return; }
    const remindAt = israelDateTime(dateVal, "09:00");
    if (!remindAt || !Number.isFinite(remindAt.getTime())) { fail("התאריך לא תקין"); return; }
    const name = trim(state.profile && state.profile.name) || "מערכת";
    const row = {
      id: "rem_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      agent_id: name,
      type: "meeting",
      details: trim(draft.address) || "פגישה",
      remind_at: remindAt.toISOString(),
      customer_id: draft.customer.id || null,
      customer_name: trim(draft.customer.full_name) || null,
      lead_id: null,
      proposal_id: null,
      link_kind: null,
      is_done: false,
      created_at: new Date().toISOString(),
      snoozed_until: null
    };
    const button = $("meetSave");
    setBusy(button, true);
    try {
      const res = await sb.from("reminders").insert(row);
      if (res.error) throw new Error(res.error.message || "meeting");
      state.meetDay = dateVal;
      const sheet = $("meetSheet");
      if (sheet) sheet.hidden = true;
      meetDraft = null;
      await openMeetings();
    } catch (err) {
      fail("הפגישה לא נשמרה: " + (err.message || ""));
      setBusy(button, false);
    }
  }

  function paintDocuments() {
    const cats = ["פוליסות", "הצעות ביטוח", "טפסים והצהרות", "מסמכים פיננסיים", "מסמכים כלליים"];
    const host = $("docCats");
    if (host) {
      host.innerHTML = cats.map((name) => '<button class="docCat" type="button" data-doc="' + esc(name) + '"><i aria-hidden="true">📄</i><span>' + esc(name) + "</span></button>").join("");
    }
    const empty = $("docEmpty");
    if (empty) empty.textContent = state.docCat ? "אין רשימת מסמכים נפרדת עבור " + state.docCat + ". המסמך נפתח מתיק הלקוח." : "אין מסמכים להצגה מחוץ לתיק הלקוח.";
  }

  const OFFER_STEPS = [
    { id: 1, title: "פרטי לקוח" },
    { id: 3, title: "פוליסות קיימות" },
    { id: 4, title: "התאמת צרכים" },
    { id: 5, title: "פוליסות חדשות" },
    { id: 6, title: "פרטי משלם" },
    { id: 7, title: "הצהרת בריאות" },
    { id: 8, title: "תיאום שיחה וסיום הקמה" }
  ];
  const OFFER_CLINICS = ["כללית", "מכבי", "מאוחדת", "לאומית", "קופה צהלית"];
  const OFFER_SHABAN = {
    "כללית": ["אין שב״ן", "כללית מושלם", "כללית פלטינום"],
    "מכבי": ["אין שב״ן", "מכבי זהב", "מכבי שלי"],
    "מאוחדת": ["אין שב״ן", "מאוחדת עדיף", "מאוחדת שיא"],
    "לאומית": ["אין שב״ן", "לאומית כסף", "לאומית זהב"],
    "קופה צהלית": ["אין שב״ן"]
  };
  const OFFER_COMPANIES = ["איילון", "כלל", "מגדל", "מנורה", "הפניקס", "הכשרה", "מדיקר"];
  const OFFER_EXISTING = ["איילון", "הראל", "כלל", "מגדל", "מנורה", "הפניקס", "הכשרה", "AIG", "ביטוח ישיר", "9 מיליון", "שומרה", "שלמה", "ליברה", "ווישור", "שירביט", "חקלאי"];
  const OFFER_TYPES = ["בריאות", "מחלות קשות", "סרטן", "אובדן כושר עבודה", "ריסק", "ריסק משכנתא"];
  const OFFER_COVERS = ["ניתוחים ומחליפי ניתוח בישראל (משלים שב״ן)", "ניתוחים ומחליפי ניתוח בישראל מהשקל הראשון", "השתלות", "תרופות", "אמבולטורי (ייעוצים ובדיקות)", "אבחון מהיר"];
  const OFFER_BANKS = ["בנק הפועלים", "בנק לאומי", "בנק דיסקונט", "בנק מזרחי טפחות", "הבנק הבינלאומי", "בנק מרכנתיל", "בנק אוצר החייל", "בנק יהב", "בנק מסד", "בנק ירושלים"];
  const OFFER_HEALTH = [
    "האם אושפזת בחמש השנים האחרונות?",
    "האם אובחנת במחלת לב, לחץ דם, סוכרת או כולסטרול?",
    "האם אובחנת במחלה ממארת או בגידול?",
    "האם עברת ניתוח?",
    "האם קיימת מגבלה גופנית או נכות?",
    "האם אתה נוטל תרופות באופן קבוע?",
    "האם יש מעקב רפואי או בדיקות חריגות?"
  ];
  const OFFER_PREGNANCY = "האם קיימת כיום הריון?";
  let offer = null;

  function offerBlankInsured(type) {
    const label = type === "spouse" ? "בן/בת זוג" : type === "child" ? "ילד" : "מבוטח ראשי";
    return {
      id: "ins_" + Date.now().toString(16) + Math.random().toString(16).slice(2, 6),
      label: label,
      type: type || "primary",
      data: {
        firstName: "", lastName: "", idNumber: "", birthDate: "", gender: "",
        clinic: "", shaban: "", maritalStatus: "", occupation: "", idIssueDate: "",
        smokingStatus: "", smokingType: "", smokingAmount: "",
        phone: "", email: "", city: "", street: "", houseNumber: "", apartment: "", zip: "",
        heightCm: "", weightKg: "", bmi: "",
        existingPolicies: [],
        cancellations: {}
      }
    };
  }

  function offerFresh() {
    const primary = offerBlankInsured("primary");
    return {
      step: 0,
      active: 0,
      customerId: "",
      proposalId: "",
      insureds: [primary],
      needsKey: "",
      policies: [],
      draft: offerBlankPolicy(primary.id),
      exist: { company: "", type: "", policyNumber: "", monthlyPremium: "", status: "keep", reason: "" },
      health: {},
      agentNumbers: {},
      mirror: { date: "", time: "", note: "", unscheduled: false },
      payerChoice: "self",
      paymentMethod: "cc",
      externalPayer: { firstName: "", lastName: "", idNumber: "", phone: "" },
      cc: { holderName: "", holderId: "", cardNumber: "", exp: "" },
      ho: { bankName: "", bankNo: "", branch: "", account: "" },
      busy: false
    };
  }

  function offerBlankPolicy(insuredId) {
    return {
      company: "", type: "", insuredId: insuredId || "", startDate: "", premium: "",
      covers: [], sumInsured: "", compensation: "", salary: "", agentNumber: ""
    };
  }

  function offerDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function offerIso(value) {
    const raw = trim(value);
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return raw;
    const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!dmy) return "";
    return dmy[3] + "-" + dmy[2].padStart(2, "0") + "-" + dmy[1].padStart(2, "0");
  }

  function offerDmy(value) {
    const iso = offerIso(value);
    if (!iso) return "";
    const parts = iso.split("-");
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function offerBmi(height, weight) {
    const h = Number(height);
    const w = Number(weight);
    if (!(h > 0) || !(w > 0)) return "";
    return String(Math.round((w / ((h / 100) * (h / 100))) * 10) / 10);
  }

  function offerBmiTone(bmi) {
    const n = Number(bmi);
    if (!(n > 0)) return { lamp: "", label: "מלא גובה ומשקל" };
    if (n >= 18.5 && n <= 24.9) return { lamp: "green", label: "תקין" };
    if (n >= 25 && n <= 29.9) return { lamp: "yellow", label: "עודף משקל" };
    if (n >= 30) return { lamp: "red", label: "השמנה" };
    return { lamp: "", label: "מתחת לטווח" };
  }

  function offerHasExisting() {
    return offer.insureds.some((ins) => (ins.data.existingPolicies || []).length);
  }

  function offerNeedOptions() {
    if (!offerHasExisting()) return [{ key: "new_cover", label: "רכישת ביטוח חדש" }];
    return [
      { key: "hozala", label: "הוזלה" },
      { key: "expansion", label: "הרחבה" },
      { key: "new_cover", label: "כיסוי חדש" }
    ];
  }

  function offerQuestions(ins) {
    const list = OFFER_HEALTH.slice();
    if (ins && ins.data && ins.data.gender === "נקבה" && ins.type !== "child") list.push(OFFER_PREGNANCY);
    return list;
  }

  function offerSelect(key, current, options, placeholder) {
    const rows = ['<option value="">' + esc(placeholder || "בחירה") + "</option>"].concat(options.map((item) => {
      return '<option value="' + esc(item) + '"' + (item === current ? " selected" : "") + ">" + esc(item) + "</option>";
    }));
    return '<select class="input" data-k="' + esc(key) + '" data-render="1">' + rows.join("") + "</select>";
  }

  function offerText(key, value, mode) {
    const type = mode === "email" ? "email" : mode === "tel" ? "tel" : "text";
    const extra = mode === "numeric" || mode === "tel" ? ' inputmode="' + (mode === "tel" ? "tel" : "numeric") + '" dir="ltr"' : (mode === "email" ? ' dir="ltr"' : "");
    return '<input class="input" data-k="' + esc(key) + '" type="' + type + '"' + extra + ' value="' + esc(value || "") + '"/>';
  }

  function offerDate(key, value) {
    return '<input class="input" data-k="' + esc(key) + '" type="date" value="' + esc(offerIso(value)) + '"/>';
  }

  function offerField(label, control) {
    return '<label class="field">' + esc(label) + control + "</label>";
  }

  function offerChips(key, current, options) {
    return '<div class="offerChips">' + options.map((item) => {
      const value = typeof item === "string" ? item : item.key;
      const label = typeof item === "string" ? item : item.label;
      const on = value === current ? " is-on" : "";
      return '<button class="offerChip' + on + '" type="button" data-chip="' + esc(key) + '" data-val="' + esc(value) + '">' + esc(label) + "</button>";
    }).join("") + "</div>";
  }

  function offerPersonBar() {
    const people = offer.insureds.map((ins, index) => {
      return '<button type="button" data-person="' + index + '"' + (index === offer.active ? ' class="is-on"' : "") + ">" + esc(ins.label) + "</button>";
    }).join("");
    return '<div class="offerPeople">' + people + "</div>";
  }

  function offerActive() {
    return offer.insureds[offer.active] || offer.insureds[0];
  }

  function offerStep1() {
    const ins = offerActive();
    const d = ins.data;
    const child = ins.type === "child";
    const shaban = OFFER_SHABAN[d.clinic] || [];
    let body = offerPersonBar();
    body += '<article class="offerCard"><h2>פרטים בסיסיים</h2>'
      + offerField("שם פרטי", offerText("firstName", d.firstName))
      + offerField("שם משפחה", offerText("lastName", d.lastName))
      + offerField("ת״ז", offerText("idNumber", d.idNumber, "numeric"))
      + "</article>";
    body += '<article class="offerCard"><h2>פרטים אישיים</h2>'
      + offerField("תאריך לידה", offerDate("birthDate", d.birthDate))
      + '<p class="offerHint">מין</p>' + offerChips("gender", d.gender, ["זכר", "נקבה"]);
    if (!child) {
      body += offerField("קופת חולים", offerSelect("clinic", d.clinic, OFFER_CLINICS, "קופת חולים"))
        + (d.clinic && d.clinic !== "קופה צהלית" ? offerField("שב״ן", offerSelect("shaban", d.shaban, shaban, "שב״ן")) : "")
        + offerField("מצב משפחתי", offerSelect("maritalStatus", d.maritalStatus, ["רווק/ה", "נשוי/אה", "גרוש/ה", "אלמן/ה", "ידוע/ה בציבור"], "מצב משפחתי"))
        + offerField("עיסוק", offerText("occupation", d.occupation))
        + '<p class="offerHint">האם מעשן/ת או עישנת בשנתיים האחרונות?</p>'
        + offerChips("smokingStatus", d.smokingStatus, [{ key: "no", label: "לא" }, { key: "yes", label: "כן" }]);
      if (d.smokingStatus === "yes") {
        body += offerChips("smokingType", d.smokingType, ["סיגריות", "טבק", "נרגילה", "סיגריה אלקטרונית", "קנאביס"]);
        if (d.smokingType === "סיגריות" || d.smokingType === "טבק") body += offerField("כמות ליום", offerText("smokingAmount", d.smokingAmount, "numeric"));
      }
      body += offerField("תאריך הנפקת ת״ז", offerDate("idIssueDate", d.idIssueDate));
    }
    body += "</article>";
    if (child) {
      const p = offer.insureds[0].data;
      body += '<article class="offerCard"><h2>פרטי קשר</h2><p class="offerHint">לקטין פרטי הקשר נמשכים מהמבוטח הראשי: '
        + esc([p.phone, p.city, p.street, p.houseNumber].filter(Boolean).join(" · ") || "טרם מולאו") + "</p></article>";
    } else {
      body += '<article class="offerCard"><h2>פרטי קשר וכתובת</h2>'
        + offerField("טלפון", offerText("phone", d.phone, "tel"))
        + offerField("מייל", offerText("email", d.email, "email"))
        + offerField("עיר / יישוב", offerText("city", d.city))
        + offerField("רחוב", offerText("street", d.street))
        + '<div class="offerRow">' + offerField("מספר בית", offerText("houseNumber", d.houseNumber, "numeric")) + offerField("דירה", offerText("apartment", d.apartment, "numeric")) + "</div>"
        + offerField("מיקוד", offerText("zip", d.zip, "numeric"))
        + "</article>";
    }
    if (ins.type === "primary") {
      body += '<button class="offerAdd" type="button" data-add="spouse">הוסף בן/בת זוג</button>'
        + '<button class="offerAdd" type="button" data-add="child">הוסף ילד</button>';
    } else {
      body += '<button class="offerAdd" type="button" data-drop="1">הסר את ' + esc(ins.label) + "</button>";
    }
    return body;
  }

  function offerStep3() {
    const ins = offerActive();
    const rows = (ins.data.existingPolicies || []).map((policy, index) => {
      const cancel = ins.data.cancellations && ins.data.cancellations[policy.id];
      const status = cancel && cancel.status === "full" ? "ביטול מלא" : cancel && cancel.status === "partial_health" ? "ביטול חלקי" : "נשמר";
      return '<div class="offerItem"><div><b>' + esc(policy.company || "פוליסה") + "</b><span>" + esc([policy.type, policy.policyNumber, status].filter(Boolean).join(" · ")) + "</span></div><button type=\"button\" data-drop-exist=\"" + index + "\">הסר</button></div>";
    }).join("");
    const draft = offer.exist;
    return offerPersonBar()
      + '<article class="offerCard"><h2>פוליסות קיימות</h2><p class="offerHint">אפשר להמשיך בלי פוליסה קיימת. פוליסה שמבטלים דורשת פירוט.</p>'
      + '<div class="offerList">' + rows + "</div>"
      + offerField("חברה", offerSelect("exist.company", draft.company, OFFER_EXISTING, "חברה"))
      + offerField("מוצר", offerSelect("exist.type", draft.type, OFFER_TYPES, "מוצר"))
      + offerField("מספר פוליסה", offerText("exist.policyNumber", draft.policyNumber))
      + offerField("פרמיה חודשית", offerText("exist.monthlyPremium", draft.monthlyPremium, "numeric"))
      + offerChips("exist.status", draft.status, [{ key: "keep", label: "נשמר" }, { key: "partial_health", label: "ביטול חלקי" }, { key: "full", label: "ביטול מלא" }])
      + (draft.status === "keep" ? "" : offerField("פירוט הביטול", '<textarea class="input" data-k="exist.reason">' + esc(draft.reason || "") + "</textarea>"))
      + '<button class="offerAdd" type="button" data-add="exist">הוסף פוליסה קיימת</button></article>';
  }

  function offerStep4() {
    const options = offerNeedOptions();
    const hint = offerHasExisting()
      ? "חובה לבחור אחד: הוזלה, הרחבה או כיסוי חדש."
      : "ללקוח אין פוליסות קיימות — חובה לבחור רכישת ביטוח חדש.";
    return '<article class="offerCard"><h2>שיקולים עיקריים במתן ההמלצה</h2><p class="offerHint">' + esc(hint) + "</p>"
      + offerChips("needs", offer.needsKey, options) + "</article>";
  }

  function offerStep5() {
    const rows = offer.policies.map((policy, index) => {
      return '<div class="offerItem"><div><b>' + esc(policy.company || "פוליסה") + "</b><span>" + esc([policy.type, policy.premiumMonthly ? money(policy.premiumMonthly) : ""].filter(Boolean).join(" · ")) + "</span></div><button type=\"button\" data-drop-pol=\"" + index + "\">הסר</button></div>";
    }).join("");
    const draft = offer.draft;
    const insuredOptions = offer.insureds.map((ins) => '<option value="' + esc(ins.id) + '"' + (ins.id === draft.insuredId ? " selected" : "") + ">" + esc(ins.label) + "</option>").join("");
    let extra = "";
    if (draft.type === "בריאות") {
      extra = '<p class="offerHint">כיסויי בריאות</p><div class="offerChips">' + OFFER_COVERS.map((cover) => {
        const on = draft.covers.indexOf(cover) >= 0 ? " is-on" : "";
        return '<button class="offerChip' + on + '" type="button" data-cover="' + esc(cover) + '">' + esc(cover) + "</button>";
      }).join("") + "</div>";
    } else if (draft.type === "ריסק" || draft.type === "ריסק משכנתא") {
      extra = offerField("סכום ביטוח", offerText("draft.sumInsured", draft.sumInsured, "numeric"));
    } else if (draft.type === "סרטן" || draft.type === "מחלות קשות") {
      extra = offerField("סכום פיצוי", offerText("draft.compensation", draft.compensation, "numeric"));
    } else if (draft.type === "אובדן כושר עבודה") {
      extra = offerField("שכר", offerText("draft.salary", draft.salary, "numeric"));
    }
    return '<article class="offerCard"><h2>פוליסות חדשות</h2><p class="offerHint">חובה להוסיף לפחות פוליסה אחת לפני שממשיכים.</p>'
      + '<div class="offerList">' + rows + "</div>"
      + offerField("חברת ביטוח", offerSelect("draft.company", draft.company, OFFER_COMPANIES, "חברה"))
      + offerField("מוצר ביטוח", offerSelect("draft.type", draft.type, OFFER_TYPES, "מוצר"))
      + offerField("מבוטח", '<select class="input" data-k="draft.insuredId">' + insuredOptions + "</select>")
      + extra
      + offerField("תאריך תחילת ביטוח", offerDate("draft.startDate", draft.startDate))
      + offerField("פרמיה חודשית לאחר הנחה", offerText("draft.premium", draft.premium, "numeric"))
      + offerField("מספר סוכן בחברה", offerText("draft.agentNumber", draft.agentNumber))
      + '<button class="offerAdd" type="button" data-add="policy">הוסף פוליסה להצעה</button></article>';
  }

  function offerStep6() {
    let body = '<article class="offerCard"><h2>פרטי משלם</h2>'
      + offerChips("payerChoice", offer.payerChoice, [{ key: "self", label: "המבוטח משלם" }, { key: "external", label: "משלם אחר" }])
      + offerChips("paymentMethod", offer.paymentMethod, [{ key: "cc", label: "אשראי" }, { key: "ho", label: "הוראת קבע" }]);
    if (offer.payerChoice === "external") {
      const ext = offer.externalPayer;
      body += offerField("שם פרטי של המשלם", offerText("ext.firstName", ext.firstName))
        + offerField("שם משפחה של המשלם", offerText("ext.lastName", ext.lastName))
        + offerField("ת״ז משלם", offerText("ext.idNumber", ext.idNumber, "numeric"))
        + offerField("טלפון משלם", offerText("ext.phone", ext.phone, "tel"));
    }
    if (offer.paymentMethod === "ho") {
      const ho = offer.ho;
      body += offerField("בנק", offerSelect("ho.bankName", ho.bankName, OFFER_BANKS, "בנק"))
        + offerField("מספר בנק", offerText("ho.bankNo", ho.bankNo, "numeric"))
        + offerField("סניף", offerText("ho.branch", ho.branch, "numeric"))
        + offerField("חשבון", offerText("ho.account", ho.account, "numeric"));
    } else {
      const cc = offer.cc;
      body += offerField("שם בעל הכרטיס", offerText("cc.holderName", cc.holderName))
        + offerField("ת״ז בעל הכרטיס", offerText("cc.holderId", cc.holderId, "numeric"))
        + offerField("מספר כרטיס", offerText("cc.cardNumber", cc.cardNumber, "numeric"))
        + offerField("תוקף MM/YY", offerText("cc.exp", cc.exp));
    }
    return body + "</article>";
  }

  function offerStep7() {
    const cards = offer.insureds.map((ins) => {
      const tone = offerBmiTone(ins.data.bmi);
      const questions = offerQuestions(ins).map((question) => {
        const saved = offer.health[question] && offer.health[question][ins.id];
        const answer = saved ? saved.answer : "";
        const detail = saved && saved.detail ? saved.detail : "";
        return '<div class="offerCard"><h2>' + esc(ins.label) + "</h2><p class=\"offerHint\">" + esc(question) + "</p>"
          + offerChips("health." + question + "." + ins.id, answer, [{ key: "no", label: "לא" }, { key: "yes", label: "כן" }])
          + (answer === "yes" ? offerField("פירוט", '<textarea class="input" data-k="health.' + esc(question) + "." + esc(ins.id) + '.detail">' + esc(detail) + "</textarea>") : "")
          + "</div>";
      }).join("");
      const bmi = '<article class="offerCard"><h2>גובה, משקל ו־BMI · ' + esc(ins.label) + "</h2>"
        + '<div class="offerRow">' + offerField("גובה (ס״מ)", offerText("height." + ins.id, ins.data.heightCm, "numeric")) + offerField("משקל (ק״ג)", offerText("weight." + ins.id, ins.data.weightKg, "numeric")) + "</div>"
        + '<div class="bmiLive"><i class="bmiLamp' + (tone.lamp ? " bmiLamp--" + tone.lamp : "") + '"></i><span>' + esc(ins.data.bmi || "—") + " · " + esc(tone.label) + "</span></div></article>";
      return questions + bmi;
    }).join("");
    return cards;
  }

  function offerStep8() {
    const companies = [];
    offer.policies.forEach((policy) => {
      if (policy.company && companies.indexOf(policy.company) < 0) companies.push(policy.company);
    });
    const numbers = companies.map((company) => offerField("מספר סוכן · " + company, offerText("agent." + company, offer.agentNumbers[company] || ""))).join("");
    return '<article class="offerCard"><h2>תיאום שיחת שיקוף</h2><p class="offerHint">בחרו תאריך ושעה, או סמנו שאין תיאום.</p>'
      + '<label class="offerCheck"><input type="checkbox" data-k="mirror.unscheduled"' + (offer.mirror.unscheduled ? " checked" : "") + "/> ללא תיאום</label>"
      + (offer.mirror.unscheduled ? "" : offerField("תאריך", offerDate("mirror.date", offer.mirror.date)) + offerField("שעה", '<input class="input" data-k="mirror.time" type="time" value="' + esc(offer.mirror.time || "") + '"/>'))
      + offerField("הערת נציג", '<textarea class="input" data-k="mirror.note">' + esc(offer.mirror.note || "") + "</textarea>")
      + numbers
      + "</article>";
  }

  function offerPaint() {
    const step = OFFER_STEPS[offer.step];
    $("offerTitle").textContent = step.title;
    $("offerCount").textContent = (offer.step + 1) + "/7";
    const rail = OFFER_STEPS.map((item, index) => '<i class="' + (index < offer.step ? "is-done" : index === offer.step ? "is-on" : "") + '"></i>').join("");
    const bodies = [offerStep1, offerStep3, offerStep4, offerStep5, offerStep6, offerStep7, offerStep8];
    $("offerBody").innerHTML = '<div class="offerRail">' + rail + "</div>" + bodies[offer.step]();
    if ($("offerError")) $("offerError").textContent = "";
    $("offerPrev").hidden = offer.step === 0;
    $("offerNext").textContent = offer.step === OFFER_STEPS.length - 1 ? "סיום הקמת לקוח" : "המשך";
    $("offerBody").scrollTop = 0;
  }

  function offerWrite(key, value) {
    if (key.indexOf("exist.") === 0) offer.exist[key.slice(6)] = value;
    else if (key.indexOf("draft.") === 0) offer.draft[key.slice(6)] = value;
    else if (key.indexOf("cc.") === 0) offer.cc[key.slice(3)] = value;
    else if (key.indexOf("ho.") === 0) offer.ho[key.slice(3)] = value;
    else if (key.indexOf("ext.") === 0) offer.externalPayer[key.slice(4)] = value;
    else if (key.indexOf("mirror.") === 0) offer.mirror[key.slice(7)] = value === true || value === "true" ? true : value === false ? false : value;
    else if (key.indexOf("agent.") === 0) offer.agentNumbers[key.slice(6)] = value;
    else if (key.indexOf("height.") === 0 || key.indexOf("weight.") === 0) {
      const parts = key.split(".");
      const ins = offer.insureds.find((item) => item.id === parts[1]);
      if (!ins) return;
      ins.data[parts[0] === "height" ? "heightCm" : "weightKg"] = value;
      ins.data.bmi = offerBmi(ins.data.heightCm, ins.data.weightKg);
    } else if (key.indexOf("health.") === 0) {
      const parts = key.split(".");
      const detail = parts[parts.length - 1] === "detail";
      const id = parts[parts.length - (detail ? 2 : 1)];
      const question = parts.slice(1, parts.length - (detail ? 2 : 1)).join(".");
      offer.health[question] = offer.health[question] || {};
      offer.health[question][id] = offer.health[question][id] || { answer: "", detail: "" };
      if (detail) offer.health[question][id].detail = value;
      else offer.health[question][id].answer = value;
    } else {
      offerActive().data[key] = value;
      if (key === "clinic" && value === "קופה צהלית") offerActive().data.shaban = "אין שב״ן";
      if (key === "clinic" && value !== "קופה צהלית" && (OFFER_SHABAN[value] || []).indexOf(offerActive().data.shaban) < 0) offerActive().data.shaban = "";
    }
  }

  function offerMissingPerson(ins) {
    const d = ins.data;
    const name = ins.label;
    const labels = { firstName: "שם פרטי", lastName: "שם משפחה", idNumber: "ת״ז", birthDate: "תאריך לידה", gender: "מין" };
    const base = ["firstName", "lastName", "idNumber", "birthDate", "gender"];
    for (let i = 0; i < base.length; i += 1) {
      if (!trim(d[base[i]])) return name + ": חסר " + labels[base[i]];
    }
    if (offerDigits(d.idNumber).length !== 9) return name + ": ת״ז חייבת להיות בת 9 ספרות";
    if (ins.type === "child") {
      const parent = offer.insureds[0].data;
      if (!trim(parent.phone) || !trim(parent.city) || !trim(parent.street) || !trim(parent.houseNumber)) {
        return "המבוטח הראשי: חסרים פרטי קשר (נדרש עבור " + name + ")";
      }
      return "";
    }
    if (!trim(d.maritalStatus)) return name + ": חסר מצב משפחתי";
    if (!trim(d.occupation)) return name + ": חסר עיסוק";
    if (!offerIso(d.idIssueDate)) return name + ": חסר תאריך הנפקת ת״ז";
    if (!trim(d.clinic)) return name + ": חסרה קופת חולים";
    if (d.clinic !== "קופה צהלית" && !trim(d.shaban)) return name + ": חסר שב״ן";
    if (d.smokingStatus !== "yes" && d.smokingStatus !== "no") return name + ": לא נענתה שאלת עישון";
    if (d.smokingStatus === "yes" && !trim(d.smokingType)) return name + ": חסר סוג עישון";
    if (d.smokingStatus === "yes" && (d.smokingType === "סיגריות" || d.smokingType === "טבק") && !trim(d.smokingAmount)) return name + ": חסרה כמות עישון ליום";
    const contact = { phone: "טלפון", city: "עיר", street: "רחוב", houseNumber: "מספר בית" };
    const keys = Object.keys(contact);
    for (let i = 0; i < keys.length; i += 1) {
      if (!trim(d[keys[i]])) return name + ": חסר " + contact[keys[i]];
    }
    if (offerDigits(d.phone).length < 9) return name + ": טלפון חסר";
    return "";
  }

  function offerPolicyError(draft) {
    if (!trim(draft.company)) return "שכחת למלא: חברת ביטוח";
    if (!trim(draft.type)) return "שכחת למלא: מוצר ביטוח";
    if (!offer.insureds.some((ins) => ins.id === draft.insuredId || ins.label === draft.insuredId)) return "שכחת למלא: שיוך מבוטח לפוליסה";
    if (draft.type === "בריאות" && !draft.covers.length) return "שכחת למלא: כיסויי בריאות (לפחות אחד)";
    if ((draft.type === "ריסק" || draft.type === "ריסק משכנתא") && !trim(draft.sumInsured)) return "שכחת למלא: סכום ביטוח";
    if ((draft.type === "סרטן" || draft.type === "מחלות קשות") && !trim(draft.compensation)) return "שכחת למלא: סכום פיצוי";
    if (draft.type === "אובדן כושר עבודה" && !trim(draft.salary)) return "שכחת למלא: שכר";
    if (!offerIso(draft.startDate)) return "שכחת למלא: תאריך תחילת ביטוח";
    if (!(Number(String(draft.premium).replace(/[^\d.]/g, "")) > 0)) return "שכחת למלא: פרמיה חודשית לאחר הנחה";
    return "";
  }

  function offerValidate(stepId) {
    if (stepId === 1) {
      for (let i = 0; i < offer.insureds.length; i += 1) {
        const issue = offerMissingPerson(offer.insureds[i]);
        if (issue) return issue;
      }
      return "";
    }
    if (stepId === 3) {
      const draft = offer.exist;
      const started = trim(draft.company) || trim(draft.type) || trim(draft.policyNumber);
      if (started) return "יש ללחוץ «הוסף פוליסה קיימת» או לנקות את השורה";
      for (let i = 0; i < offer.insureds.length; i += 1) {
        const ins = offer.insureds[i];
        const list = ins.data.existingPolicies || [];
        for (let p = 0; p < list.length; p += 1) {
          const cancel = ins.data.cancellations[list[p].id];
          if (cancel && cancel.status !== "keep" && !trim(cancel.needsAnalysisReason)) return "לא ניתן להתקדם לשלב הבא ללא פירוט על הפוליסות שמבטל מלא/חלקי ללקוח";
        }
      }
      return "";
    }
    if (stepId === 4) {
      const options = offerNeedOptions();
      if (!options.some((item) => item.key === offer.needsKey)) {
        return offerHasExisting()
          ? "יש לבחור את השיקול העיקרי במתן ההמלצה (הוזלה / הרחבה / כיסוי חדש)."
          : "יש לבחור רכישת ביטוח חדש בשלב התאמת צרכים כדי להמשיך.";
      }
      return "";
    }
    if (stepId === 5) {
      if (!offer.policies.length) return "חובה שתהיה לפחות פוליסה אחת ברשימה";
      return "";
    }
    if (stepId === 6) {
      if (offer.payerChoice === "external") {
        const ext = offer.externalPayer;
        if (!trim(ext.firstName) || !trim(ext.lastName)) return "יש למלא את שם המשלם";
        if (offerDigits(ext.idNumber).length !== 9) return "יש למלא ת״ז משלם בת 9 ספרות";
        if (offerDigits(ext.phone).length < 9) return "יש למלא טלפון משלם";
      }
      if (offer.paymentMethod === "ho") {
        const ho = offer.ho;
        if (!trim(ho.bankName) || !trim(ho.bankNo) || !trim(ho.branch) || !trim(ho.account)) return "יש להשלים את פרטי הוראת הקבע";
        return "";
      }
      const cc = offer.cc;
      if (!trim(cc.holderName)) return "יש למלא את שם בעל הכרטיס";
      if (offerDigits(cc.holderId).length !== 9) return "יש למלא ת״ז בעל כרטיס בת 9 ספרות";
      if (offerDigits(cc.cardNumber).length !== 16) return "יש להזין מספר כרטיס בן 16 ספרות";
      if (!/^\d{2}\/\d{2}$/.test(trim(cc.exp))) return "יש להזין תוקף בפורמט MM/YY";
      return "";
    }
    if (stepId === 7) {
      for (let i = 0; i < offer.insureds.length; i += 1) {
        const ins = offer.insureds[i];
        const questions = offerQuestions(ins);
        for (let q = 0; q < questions.length; q += 1) {
          const saved = offer.health[questions[q]] && offer.health[questions[q]][ins.id];
          if (!saved || (saved.answer !== "yes" && saved.answer !== "no")) return "חסרה תשובה בהצהרת הבריאות עבור " + ins.label;
          if (saved.answer === "yes" && !trim(saved.detail)) return "יש למלא את פירוט השאלה עבור " + ins.label;
        }
        if (!(Number(ins.data.heightCm) > 0)) return ins.label + ": חסר גובה";
        if (!(Number(ins.data.weightKg) > 0)) return ins.label + ": חסר משקל";
      }
      return "";
    }
    if (offer.mirror.unscheduled) return offerAgentNumberError();
    if (!offerIso(offer.mirror.date)) return "יש לבחור תאריך זמינות לשיחת השיקוף";
    if (!trim(offer.mirror.time)) return "יש לבחור שעת זמינות לשיחת השיקוף";
    return offerAgentNumberError();
  }

  function offerAgentNumberError() {
    for (let i = 0; i < offer.policies.length; i += 1) {
      const company = offer.policies[i].company;
      if (company && !trim(offer.agentNumbers[company])) return "יש למלא מספר סוכן עבור " + company;
    }
    return "";
  }

  function offerInsuredByDraft(draft) {
    return offer.insureds.find((ins) => ins.id === draft.insuredId || ins.label === draft.insuredId) || offer.insureds[0];
  }

  function offerAddPolicy() {
    const draft = offer.draft;
    const insured = offerInsuredByDraft(draft);
    draft.insuredId = insured.id;
    const error = offerPolicyError(draft);
    if (error) return error;
    const premium = Number(String(draft.premium).replace(/[^\d.]/g, "")) || 0;
    const policy = {
      id: "np_" + Date.now().toString(16),
      company: trim(draft.company),
      type: trim(draft.type),
      insuredId: insured.id,
      insuredIds: [insured.id],
      startDate: offerDmy(draft.startDate),
      premiumMonthly: premium,
      premiumAfterDiscountValue: premium,
      premiumPerInsured: {},
      healthCovers: draft.type === "בריאות" ? draft.covers.slice() : [],
      sumInsured: trim(draft.sumInsured),
      sumInsuredPerInsured: {},
      compensation: trim(draft.compensation),
      compensationPerInsured: {},
      akovSalary: trim(draft.salary)
    };
    policy.premiumPerInsured[insured.id] = premium;
    if (policy.sumInsured) policy.sumInsuredPerInsured[insured.id] = policy.sumInsured;
    if (policy.compensation) policy.compensationPerInsured[insured.id] = policy.compensation;
    offer.policies.push(policy);
    if (trim(draft.agentNumber)) offer.agentNumbers[policy.company] = trim(draft.agentNumber);
    offer.draft = offerBlankPolicy(offer.insureds[0].id);
    return "";
  }

  function offerAddExisting() {
    const ins = offerActive();
    const draft = offer.exist;
    if (!trim(draft.company) || !trim(draft.type)) return "שכחת למלא: חברה ומוצר לפוליסה הקיימת";
    if (draft.status !== "keep" && !trim(draft.reason)) return "לא ניתן להתקדם לשלב הבא ללא פירוט על הפוליסות שמבטל מלא/חלקי ללקוח";
    const id = "ex_" + Date.now().toString(16);
    ins.data.existingPolicies.push({
      id: id,
      company: trim(draft.company),
      type: trim(draft.type),
      policyNumber: trim(draft.policyNumber),
      monthlyPremium: trim(draft.monthlyPremium),
      origin: "existing"
    });
    if (draft.status !== "keep") ins.data.cancellations[id] = { status: draft.status, needsAnalysisReason: trim(draft.reason) };
    offer.exist = { company: "", type: "", policyNumber: "", monthlyPremium: "", status: "keep", reason: "" };
    return "";
  }

  function offerPayload() {
    const needs = offerNeedOptions().find((item) => item.key === offer.needsKey) || { key: "", label: "" };
    const mirror = {
      date: offer.mirror.unscheduled ? "" : offerDmy(offer.mirror.date),
      time: offer.mirror.unscheduled ? "" : trim(offer.mirror.time),
      note: trim(offer.mirror.note),
      unscheduled: !!offer.mirror.unscheduled
    };
    const insureds = offer.insureds.map((ins) => {
      const data = JSON.parse(JSON.stringify(ins.data));
      data.birthDate = offerDmy(data.birthDate) || data.birthDate;
      data.idIssueDate = offerDmy(data.idIssueDate) || data.idIssueDate;
      data.idNumber = offerDigits(data.idNumber);
      data.phone = trim(data.phone);
      data.bmi = offerBmi(data.heightCm, data.weightKg);
      const responses = {};
      offerQuestions(ins).forEach((question) => {
        const saved = offer.health[question] && offer.health[question][ins.id];
        if (!saved) return;
        responses[question] = {};
        responses[question][ins.id] = { answer: saved.answer, fields: saved.detail ? { detail: saved.detail } : {}, saved: true };
      });
      data.healthDeclaration = { responses: responses };
      data.mirrorSchedule = JSON.parse(JSON.stringify(mirror));
      data.operationalAgentNumbers = JSON.parse(JSON.stringify(offer.agentNumbers));
      return { id: ins.id, label: ins.label, type: ins.type, data: data };
    });
    const primary = insureds[0].data;
    primary.payerChoice = offer.payerChoice;
    primary.paymentMethod = offer.paymentMethod;
    primary.externalPayer = JSON.parse(JSON.stringify(offer.externalPayer));
    primary.cc = JSON.parse(JSON.stringify(offer.cc));
    primary.ho = JSON.parse(JSON.stringify(offer.ho));
    primary.payer = offer.paymentMethod === "ho"
      ? { method: "ho", bankName: offer.ho.bankName, bankNo: offer.ho.bankNo, branchNo: offer.ho.branch, accountNo: offer.ho.account }
      : { method: "cc", holderName: offer.cc.holderName, holderId: offerDigits(offer.cc.holderId), cardNumber: offerDigits(offer.cc.cardNumber), cardExpiry: trim(offer.cc.exp) };
    const createdAt = new Date().toISOString();
    const operational = {
      createdAt: createdAt,
      insureds: insureds.map((ins) => ({ label: ins.label, type: ins.type, data: ins.data })),
      newPolicies: JSON.parse(JSON.stringify(offer.policies)),
      companyAgentNumbers: JSON.parse(JSON.stringify(offer.agentNumbers)),
      primary: JSON.parse(JSON.stringify(primary)),
      mirrorSchedule: JSON.parse(JSON.stringify(mirror)),
      needsMainConsideration: { key: needs.key, label: needs.label }
    };
    return {
      createdAt: createdAt,
      flowType: "health",
      insureds: insureds,
      newPolicies: JSON.parse(JSON.stringify(offer.policies)),
      companyAgentNumbers: JSON.parse(JSON.stringify(offer.agentNumbers)),
      primary: JSON.parse(JSON.stringify(primary)),
      mirrorSchedule: JSON.parse(JSON.stringify(mirror)),
      needsMainConsideration: { key: needs.key, label: needs.label },
      operational: operational,
      opsProcess: { healthSetupFinishedAt: createdAt }
    };
  }

  async function offerExistingCustomer(idNumber) {
    const res = await sb.from("customers")
      .select("id,agent_id,agent_name,agent_role,full_name,status,created_at,is_archived")
      .eq("id_number", idNumber)
      .limit(8);
    if (res.error) throw new Error(res.error.message || "customer");
    return (res.data || []).find((row) => row.is_archived !== true) || null;
  }

  async function offerGuard(row) {
    if (!row) return { ok: true, preserve: false };
    const owner = trim(row.agent_id);
    const me = trim(state.profile && state.profile.id);
    if (!owner || owner === me) return { ok: true, preserve: false };
    const role = state.profile && state.profile.role;
    if (role === "manager" || role === "admin") return { ok: true, preserve: true };
    if (role === "teammanager") {
      await loadScope();
      const ids = state.scope && state.scope.ids;
      if (ids && ids.indexOf(owner) >= 0) return { ok: true, preserve: true };
    }
    return { ok: false, preserve: true };
  }

  async function offerFinish() {
    if (offer.busy) return;
    const error = offerValidate(8);
    const note = $("offerError");
    if (error) {
      if (note) note.textContent = error;
      return;
    }
    const profile = state.profile || {};
    const payload = offerPayload();
    const primary = payload.primary;
    const idNumber = offerDigits(primary.idNumber);
    offer.busy = true;
    setBusy($("offerNext"), true);
    try {
      const existing = await offerExistingCustomer(idNumber);
      const guard = await offerGuard(existing);
      if (!guard.ok) {
        if (note) note.textContent = "הלקוח משויך לנציג אחר. לא ניתן להקים עבורו לקוח.";
        return;
      }
      const now = new Date().toISOString();
      const fullName = trim((primary.firstName || "") + " " + (primary.lastName || "")) || "לקוח ללא שם";
      const customerId = existing && existing.id ? existing.id : (offer.customerId || ("cust_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2, 8)));
      const proposalId = offer.proposalId || ("prop_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2, 8));
      const agentId = guard.preserve && existing ? trim(existing.agent_id) : trim(profile.id);
      const agentName = guard.preserve && existing ? trim(existing.agent_name) : trim(profile.name);
      const agentRole = guard.preserve && existing ? trim(existing.agent_role) : trim(profile.role);
      const proposalRow = {
        id: proposalId,
        status: "פתוחה",
        full_name: fullName,
        id_number: idNumber,
        phone: trim(primary.phone),
        email: trim(primary.email),
        city: trim(primary.city),
        agent_name: agentName,
        agent_id: agentId,
        agent_role: agentRole,
        current_step: 8,
        insured_count: payload.insureds.length,
        created_at: now,
        updated_at: now,
        payload: payload
      };
      const proposalSave = await sb.from("proposals").upsert(proposalRow, { onConflict: "id" });
      if (proposalSave.error) throw new Error(proposalSave.error.message || "proposal");
      const customerRow = {
        id: customerId,
        status: trim(existing && existing.status) || "חדש",
        full_name: fullName,
        id_number: idNumber,
        phone: trim(primary.phone),
        email: trim(primary.email),
        city: trim(primary.city),
        agent_name: agentName,
        agent_id: agentId,
        agent_role: agentRole,
        insured_count: payload.insureds.length,
        existing_policies_count: payload.insureds.reduce((sum, ins) => sum + ((ins.data.existingPolicies || []).length), 0),
        new_policies_count: payload.newPolicies.length,
        is_archived: false,
        created_at: existing && existing.created_at ? existing.created_at : now,
        updated_at: now,
        payload: payload
      };
      const customerSave = await sb.from("customers").upsert(customerRow, { onConflict: "id" });
      if (customerSave.error) throw new Error(customerSave.error.message || "customer");
      offer.customerId = customerId;
      offer.proposalId = proposalId;
      state.file = customerRow;
      state.fileTab = "documents";
      show("customer");
      paintCustomerFile();
      openOps("customer");
    } catch (err) {
      if (note) note.textContent = "השמירה לא הושלמה: " + (err.message || "");
    } finally {
      offer.busy = false;
      setBusy($("offerNext"), false);
    }
  }

  function offerOnInput(event) {
    const el = event.target;
    const key = el.getAttribute("data-k");
    if (!key || !offer) return;
    if (el.type === "checkbox") offerWrite(key, el.checked);
    else offerWrite(key, el.value);
    if (key.indexOf("height.") === 0 || key.indexOf("weight.") === 0) {
      const parts = key.split(".");
      const ins = offer.insureds.find((item) => item.id === parts[1]);
      const card = el.closest(".offerCard");
      const live = card && card.querySelector(".bmiLive span");
      const lamp = card && card.querySelector(".bmiLamp");
      if (ins && live) {
        const tone = offerBmiTone(ins.data.bmi);
        live.textContent = (ins.data.bmi || "—") + " · " + tone.label;
        if (lamp) lamp.className = "bmiLamp" + (tone.lamp ? " bmiLamp--" + tone.lamp : "");
      }
    }
  }

  function offerOnClick(event) {
    if (!offer) return;
    const person = event.target.closest("[data-person]");
    if (person) {
      offer.active = Number(person.getAttribute("data-person")) || 0;
      offerPaint();
      return;
    }
    const add = event.target.closest("[data-add]");
    if (add) {
      const kind = add.getAttribute("data-add");
      if (kind === "spouse" || kind === "child") {
        if (kind === "spouse" && offer.insureds.some((ins) => ins.type === "spouse")) return;
        offer.insureds.push(offerBlankInsured(kind));
        offer.active = offer.insureds.length - 1;
      } else if (kind === "exist") {
        const error = offerAddExisting();
        const note = $("offerError");
        if (error) {
          if (note) note.textContent = error;
          return;
        }
      } else if (kind === "policy") {
        const error = offerAddPolicy();
        const note = $("offerError");
        if (error) {
          if (note) note.textContent = error;
          return;
        }
      }
      offerPaint();
      return;
    }
    const drop = event.target.closest("[data-drop]");
    if (drop) {
      const ins = offerActive();
      if (ins.type !== "primary") {
        offer.insureds.splice(offer.active, 1);
        offer.active = 0;
        offerPaint();
      }
      return;
    }
    const dropExist = event.target.closest("[data-drop-exist]");
    if (dropExist) {
      const ins = offerActive();
      const row = ins.data.existingPolicies.splice(Number(dropExist.getAttribute("data-drop-exist")), 1)[0];
      if (row) delete ins.data.cancellations[row.id];
      offerPaint();
      return;
    }
    const dropPol = event.target.closest("[data-drop-pol]");
    if (dropPol) {
      offer.policies.splice(Number(dropPol.getAttribute("data-drop-pol")), 1);
      offerPaint();
      return;
    }
    const cover = event.target.closest("[data-cover]");
    if (cover) {
      const name = cover.getAttribute("data-cover");
      const list = offer.draft.covers;
      const at = list.indexOf(name);
      if (at >= 0) list.splice(at, 1);
      else list.push(name);
      offerPaint();
      return;
    }
    const chip = event.target.closest("[data-chip]");
    if (!chip) return;
    const key = chip.getAttribute("data-chip");
    const value = chip.getAttribute("data-val");
    if (key === "needs") offer.needsKey = value;
    else if (key === "payerChoice") offer.payerChoice = value;
    else if (key === "paymentMethod") offer.paymentMethod = value;
    else if (key === "exist.status") offer.exist.status = value;
    else offerWrite(key, value);
    offerPaint();
  }

  function openOffer() {
    offer = offerFresh();
    show("offer");
    offerPaint();
  }

  function openNewCustomer() {
    openOffer();
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
    const stored = readStoredProfile();
    if (!stored) {
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
      await withTimeout(openSession(username, pin), 20000);
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
  $("simBody").addEventListener("change", (event) => {
    if (event.target.id !== "simDiscount" || !state.sim) return;
    state.sim.discountKey = event.target.value;
    paintSim();
  });
  $("simBody").addEventListener("input", (event) => {
    if (event.target.id === "simDiscountPct" && state.sim) {
      state.sim.discountPct = event.target.value;
      paintSimAfter();
      return;
    }
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
    if (event.target.closest("[data-edit]")) openEdit();
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
    openOps("policy");
  });
  $("btnOpsBack").addEventListener("click", () => {
    if (state.opsReturn === "customer") show("customer");
    else show("policy");
  });
  $("btnOpsDownload").addEventListener("click", downloadOpsReport);
  $("btnOpsSend").addEventListener("click", () => { void sendOpsReport(); });
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
  function contactFields(file) {
    const payload = file && file.payload && typeof file.payload === "object" ? file.payload : {};
    const primary = payload.primary || (payload.insureds && payload.insureds[0] && payload.insureds[0].data) || {};
    return {
      phone: trim(file && file.phone) || trim(primary.phone),
      email: trim(file && file.email) || trim(primary.email) || trim(payload.email)
    };
  }
  function openEdit() {
    const file = state.file;
    if (!file) return;
    const fields = contactFields(file);
    $("editPhone").value = fields.phone;
    $("editEmail").value = fields.email;
    $("editError").textContent = "";
    $("editSheet").hidden = false;
  }
  async function saveContact(event) {
    event.preventDefault();
    const file = state.file;
    if (!file) return;
    const phone = trim($("editPhone").value);
    const email = trim($("editEmail").value);
    if (email && email.indexOf("@") < 1) {
      $("editError").textContent = "האימייל לא נראה תקין.";
      return;
    }
    const payload = JSON.parse(JSON.stringify(file.payload && typeof file.payload === "object" ? file.payload : {}));
    payload.primary = payload.primary && typeof payload.primary === "object" ? payload.primary : {};
    payload.primary.phone = phone;
    payload.primary.email = email;
    if (payload.insureds && payload.insureds[0] && payload.insureds[0].data && typeof payload.insureds[0].data === "object") {
      payload.insureds[0].data.phone = phone;
      payload.insureds[0].data.email = email;
    }
    const patch = { phone: phone, email: email, updated_at: new Date().toISOString(), payload: payload };
    setBusy($("editSave"), true);
    $("editError").textContent = "";
    try {
      const res = await sb.from("customers").update(patch).eq("id", file.id);
      if (res.error) throw new Error(res.error.message || "edit");
      file.phone = phone;
      file.email = email;
      file.payload = payload;
      $("editSheet").hidden = true;
      paintCustomerFile();
      const note = $("fileNote");
      if (note) note.textContent = "פרטי הקשר נשמרו";
    } catch (err) {
      $("editError").textContent = err.message || "השמירה לא הצליחה";
    } finally {
      setBusy($("editSave"), false);
    }
  }
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

  const REMINDER_LABELS = { callback: "חזרה ללקוח", documents: "מעקב מסמכים", missing: "השלמת חוסרים", meeting: "פגישה" };

  function alertSeenKey() {
    return "onyx-phone-alerts:" + trim(state.profile && state.profile.id);
  }

  function readAlertSeen() {
    const seen = new Set();
    [alertSeenKey(), "onyx-phone-alerts:device"].forEach((key) => {
      try {
        const raw = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(raw)) raw.forEach((id) => { if (id) seen.add(String(id)); });
      } catch (_err) {}
    });
    return seen;
  }

  function writeAlertSeen(seen) {
    const list = JSON.stringify(Array.from(seen).slice(-200));
    try { localStorage.setItem(alertSeenKey(), list); } catch (_err) {}
    try { localStorage.setItem("onyx-phone-alerts:device", list); } catch (_err) {}
  }

  function alertAlreadySeen(seen, id) {
    const key = String(id || "");
    if (!key || seen.has(key)) return true;
    if (key.indexOf("closed:") !== 0) return false;
    const leadId = key.split(":")[1];
    if (!leadId) return false;
    const prefix = "closed:" + leadId + ":";
    for (const old of seen) {
      if (String(old).indexOf(prefix) === 0) return true;
    }
    return false;
  }

  function rememberAlertIds(ids) {
    const list = (ids || []).map((id) => String(id || "")).filter(Boolean);
    if (!list.length || typeof indexedDB === "undefined") return Promise.resolve();
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open("onyx-phone-seen", 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains("ids")) req.result.createObjectStore("ids");
        };
        req.onerror = () => resolve();
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("ids", "readwrite");
          const store = tx.objectStore("ids");
          list.forEach((id) => store.put(Date.now(), id));
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); resolve(); };
        };
      } catch (_err) { resolve(); }
    });
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
          id: "closed:" + row.id + ":" + day,
          title: "ליד נסגר",
          agent: agent,
          customer: customer,
          monthly: 0,
          annual: 0,
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
    const today = israelDateKey();
    const yesterday = shiftDay(today, -1);
    const select = "id,customer_name,assigned_agent_name,status,description,updated_at";
    const touched = await sb.from("campaign_leads")
      .select(select)
      .gte("updated_at", range.start)
      .lt("updated_at", range.end)
      .or("status.eq.closed,description.ilike.%proposalPremiumAt%")
      .order("updated_at", { ascending: false })
      .limit(80);
    if (touched.error) throw new Error(touched.error.message || "alerts");
    const stamped = await sb.from("campaign_leads")
      .select(select)
      .or('description.ilike.%proposalPremiumAt%' + today + '%,description.ilike.%proposalPremiumAt%' + yesterday + '%')
      .order("updated_at", { ascending: false })
      .limit(80);
    const stampedRows = stamped.error ? [] : (stamped.data || []);
    const byId = new Map();
    (touched.data || []).concat(stampedRows).forEach((row) => {
      if (row && row.id) byId.set(row.id, row);
    });
    return buildAlertItems(Array.from(byId.values()));
  }

  function alertOpenedKey() {
    return "onyx-phone-alerts-open:" + trim(state.profile && state.profile.id);
  }

  function readAlertOpened() {
    const opened = new Set();
    [alertOpenedKey(), "onyx-phone-alerts-open:device"].forEach((key) => {
      try {
        const raw = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(raw)) raw.forEach((id) => { if (id) opened.add(String(id)); });
      } catch (_err) {}
    });
    return opened;
  }

  function writeAlertOpened(opened) {
    const list = JSON.stringify(Array.from(opened).slice(-200));
    try { localStorage.setItem(alertOpenedKey(), list); } catch (_err) {}
    try { localStorage.setItem("onyx-phone-alerts-open:device", list); } catch (_err) {}
  }

  function unseenAlerts(items) {
    const opened = readAlertOpened();
    return (items || []).filter((item) => item && item.id && !opened.has(String(item.id)));
  }

  function paintBell(items) {
    const bell = $("btnBell");
    if (bell) bell.classList.toggle("is-hot", canCompose() && unseenAlerts(items).length > 0);
  }

  function markAlertsSeen(items) {
    const seen = readAlertSeen();
    const opened = readAlertOpened();
    (items || []).forEach((item) => {
      if (!item || !item.id) return;
      seen.add(item.id);
      opened.add(String(item.id));
    });
    writeAlertSeen(seen);
    writeAlertOpened(opened);
    void rememberAlertIds((items || []).map((item) => item.id));
  }

  let alertPollRunning = false;
  let alertPollAgain = false;

  async function pollAlerts() {
    if (!state.profile || !canCompose()) return;
    if (alertPollRunning) {
      alertPollAgain = true;
      return;
    }
    alertPollRunning = true;
    try {
      do {
        alertPollAgain = false;
        let items = [];
        try { items = await loadAlertRows(); } catch (_err) { items = null; }
        if (!items) continue;
        state.alerts = items;
        void armSaleWatch();
        const seen = readAlertSeen();
        const fresh = items.filter((item) => !alertAlreadySeen(seen, item.id));
        if (fresh.length && document.visibilityState === "visible") {
          const sales = fresh.filter((item) => String(item.id).indexOf("sale:") === 0);
          const closed = fresh.filter((item) => String(item.id).indexOf("closed:") === 0);
          const busy = (kind) => ringQueue.some((item) => item.kind === kind) || (state.ringItem && state.ringItem.kind === kind);
          if (sales.length && !busy("sale")) {
            const first = sales[0];
            pushRing({
              kind: "sale",
              ids: sales.map((item) => item.id),
              tag: "onyx-sale-" + first.id,
              kicker: "מכירה חדשה",
              title: first.agent,
              text: alertPremiumText(first),
              meta: [first.title, trim(first.customer)].filter(Boolean).join(" · ")
            });
          }
          if (closed.length && !busy("closed")) {
            const first = closed[0];
            const note = trim(first.note);
            pushRing({
              kind: "closed",
              ids: closed.map((item) => item.id),
              tag: "onyx-closed-" + first.id,
              kicker: "ליד נסגר",
              title: first.agent,
              text: [trim(first.customer), note.length > 1 ? note : ""].filter(Boolean).join(" · "),
              meta: ""
            });
          }
        }
    const screen = document.querySelector('[data-screen="alerts"]');
    if (screen && !screen.hidden) {
      markAlertsSeen(items);
      paintAlerts(items);
    }
    paintBell(items);
    const home = document.querySelector('[data-screen="home"]');
    if (home && !home.hidden) paintHomeSide();
  } while (alertPollAgain);
    } finally {
      alertPollRunning = false;
    }
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
      const hello = $("homeHello");
      if (hello) hello.textContent = dayGreeting();
      if (!pushReady) void enablePush(false);
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
          const closed = String(item.id).indexOf("closed:") === 0;
          const note = trim(item.note);
          if (closed) {
            return '<article class="alertCard"><b>' + esc(item.agent) + "</b><strong>" + esc(item.title) + "</strong>"
              + (item.customer ? "<span>" + esc(item.customer) + "</span>" : "")
              + (note.length > 1 ? "<span>" + esc(note) + "</span>" : "")
              + "</article>";
          }
          return '<article class="alertCard"><b>' + esc(item.agent) + "</b><strong>" + esc(alertPremiumText(item)) + "</strong><span>" + esc(item.title) + "</span>"
            + (item.customer ? "<span>" + esc(item.customer) + "</span>" : "")
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
      markAlertsSeen(items);
      paintBell(items);
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
    ringingIds.delete(id);
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
  const ringingIds = new Set();
  let reminderFlight = null;
  function loadRemindersShared() {
    if (!reminderFlight) {
      reminderFlight = loadMyReminders().finally(() => { reminderFlight = null; });
    }
    return reminderFlight;
  }
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
      playTone(audioCtx, master, 523.25, 0, 0.14, 0.26);
      playTone(audioCtx, master, 659.25, 0.12, 0.14, 0.28);
      playTone(audioCtx, master, 783.99, 0.24, 0.16, 0.32);
      playTone(audioCtx, master, 1046.5, 0.4, 0.34, 0.4);
      playTone(audioCtx, master, 1318.51, 0.7, 0.48, 0.34);
      return;
    }
    const phrase = (offset) => {
      playTone(audioCtx, master, 1567.98, offset, 0.7, 0.5);
      playTone(audioCtx, master, 1318.51, offset + 0.22, 1, 0.44);
    };
    phrase(0);
    phrase(1.72);
  }

  function subscriptionMatches(sub, publicKey) {
    const raw = sub && sub.options && sub.options.applicationServerKey;
    if (raw) {
      const bytes = new Uint8Array(raw);
      const next = bytesFromBase64Url(publicKey);
      if (bytes.length !== next.length) return false;
      for (let i = 0; i < bytes.length; i += 1) if (bytes[i] !== next[i]) return false;
      return true;
    }
    let stored = "";
    try { stored = localStorage.getItem("onyx-phone-vapid") || ""; } catch (_err) { stored = ""; }
    return stored !== "" && stored === publicKey;
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
      if (sub && !subscriptionMatches(sub, publicKey)) {
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
      vibrate: [180, 80, 180, 80, 320]
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(async (reg) => {
        if (tag) {
          const existing = await reg.getNotifications({ tag: tag });
          if (existing.length) return;
        }
        await reg.showNotification(title, payload);
      }).catch(() => {});
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
    if (item.kind === "sale" || item.kind === "closed") {
      const seen = readAlertSeen();
      (item.ids || []).forEach((id) => seen.add(id));
      writeAlertSeen(seen);
      void rememberAlertIds(item.ids || []);
    }
    $("ring").classList.toggle("ring--sale", item.kind === "sale");
    $("ringKicker").textContent = item.kicker || "";
    $("ringTitle").textContent = item.title || "";
    $("ringText").textContent = item.text || "";
    $("ringMeta").textContent = item.meta || "";
    $("ringDone").hidden = item.kind !== "reminder";
    $("ringSnooze").hidden = item.kind !== "reminder";
    $("ringOpen").hidden = item.kind !== "sale" && item.kind !== "closed";
    $("ring").hidden = false;
    playRing(item.kind === "sale" || item.kind === "closed" ? "sale" : "reminder");
    if (document.visibilityState !== "visible" && !("serviceWorker" in navigator)) {
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
    ringingIds.delete(id);
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
    try { rows = await loadRemindersShared(); } catch (_err) { return; }
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
      if (!due || already || ringingIds.has(row.id) || (late && pushReady)) return;
      ringingIds.add(row.id);
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
  $("editForm").addEventListener("submit", (event) => { void saveContact(event); });
  $("editBackdrop").addEventListener("click", () => { $("editSheet").hidden = true; });
  $("btnCustomerBack").addEventListener("click", () => show("customers"));
  $("btnCustomerMore").addEventListener("click", () => {
    const menu = $("folioMenu");
    if (!menu) return;
    menu.hidden = !menu.hidden;
    $("btnCustomerMore").setAttribute("aria-expanded", menu.hidden ? "false" : "true");
  });
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
      if (key === "reports") show("reports");
      if (key === "documents") { show("documents"); paintDocuments(); }
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
      if (key === "customers") void openCustomers(false);
      if (key === "leads") void openLeadsDay();
      if (key === "tasks") void openTasks();
      if (key === "meetings") void openMeetings();
    });
  });
  $("btnBell").addEventListener("click", () => { void openAlerts(); });
  $("btnAddCustomer").addEventListener("click", openOffer);
  if ($("btnNewCustomer")) $("btnNewCustomer").addEventListener("click", openOffer);
  $("btnOfferBack").addEventListener("click", () => {
    if (offer && offer.step > 0) {
      offer.step -= 1;
      offerPaint();
      return;
    }
    show("home");
  });
  $("offerPrev").addEventListener("click", () => {
    if (!offer || offer.step < 1) return;
    offer.step -= 1;
    offerPaint();
  });
  $("offerNext").addEventListener("click", () => {
    if (!offer || offer.busy) return;
    const error = offerValidate(OFFER_STEPS[offer.step].id);
    const note = $("offerError");
    if (error) {
      if (note) note.textContent = error;
      return;
    }
    if (offer.step < OFFER_STEPS.length - 1) {
      offer.step += 1;
      offerPaint();
      return;
    }
    void offerFinish();
  });
  $("offerBody").addEventListener("input", offerOnInput);
  $("offerBody").addEventListener("change", (event) => {
    const el = event.target;
    if (!el || !offer) return;
    if (el.type === "checkbox" || el.hasAttribute("data-render")) {
      const key = el.getAttribute("data-k");
      if (key) offerWrite(key, el.type === "checkbox" ? el.checked : el.value);
      offerPaint();
    }
  });
  $("offerBody").addEventListener("click", offerOnClick);
  $("btnNewBack").addEventListener("click", () => { void openCustomers(false); });
  $("btnCancelCustomer").addEventListener("click", () => { void openCustomers(false); });
  $("newCustForm").addEventListener("submit", (event) => {
    event.preventDefault();
    openOffer();
  });
  $("homeSearch").addEventListener("change", () => {
    $("customerQuery").value = $("homeSearch").value;
    void openCustomers(false);
  });
  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-jump");
      if (key === "meetings") void openMeetings();
      if (key === "tasks") void openTasks();
      if (key === "leads") void openLeadsDay();
      if (key === "customers") void openCustomers(false);
    });
  });
  if ($("customerChips")) $("customerChips").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-cfilter]");
    if (!chip) return;
    state.custFilter = chip.getAttribute("data-cfilter") || "";
    $("customerChips").querySelectorAll(".chip").forEach((node) => node.classList.toggle("is-on", node === chip));
    void openCustomers(false);
  });
  $("btnAddMeeting").addEventListener("click", openMeetSheet);
  $("meetBackdrop").addEventListener("click", () => { $("meetSheet").hidden = true; });
  $("meetFind").addEventListener("click", () => { void findMeetCustomer(); });
  $("meetSave").addEventListener("click", () => { void saveMeeting(); });
  $("taskChips").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-ttab]");
    if (!chip) return;
    state.taskTab = chip.getAttribute("data-ttab") || "today";
    $("taskChips").querySelectorAll(".chip").forEach((node) => node.classList.toggle("is-on", node === chip));
    void openTasks();
  });
  $("taskList").addEventListener("click", (event) => {
    const done = event.target.closest("[data-done]");
    if (!done) return;
    void completeReminder(done.getAttribute("data-done")).then(() => { void openTasks(); });
  });
  $("meetList").addEventListener("click", (event) => {
    const done = event.target.closest("[data-done]");
    if (!done) return;
    void completeReminder(done.getAttribute("data-done")).then(() => { void openMeetings(); });
  });
  $("meetWeek").addEventListener("click", (event) => {
    const day = event.target.closest("[data-day]");
    if (!day) return;
    state.meetDay = day.getAttribute("data-day") || "";
    paintMeetings(state.meetRows || []);
  });
  $("btnTaskAdd").addEventListener("click", () => openReminder());
  $("btnDocsBack").addEventListener("click", () => show("home"));
  $("docCats").addEventListener("click", (event) => {
    const cat = event.target.closest("[data-doc]");
    if (!cat) return;
    state.docCat = cat.getAttribute("data-doc") || "";
    paintDocuments();
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
  async function notifyHiddenSales() {
    if (!canCompose() || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      const seen = readAlertSeen();
      const fresh = (await loadAlertRows()).filter((item) => !alertAlreadySeen(seen, item.id)).slice(0, 4);
      fresh.forEach((item) => {
        const closed = String(item.id).indexOf("closed:") === 0;
        if (closed) systemNotify("ליד נסגר", [item.agent, trim(item.customer)].filter(Boolean).join(" · "), "onyx-closed-" + item.id);
        else systemNotify("מכירה חדשה", [item.agent, alertPremiumText(item), trim(item.customer)].filter(Boolean).join(" · "), "onyx-sale-" + item.id);
      });
      if (fresh.length) void rememberAlertIds(fresh.map((item) => item.id));
    } catch (_err) {}
  }

  async function shadeOpenItems() {
    if (!state.profile || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      const rows = state.myReminders || await loadRemindersShared();
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
    await notifyHiddenSales();
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
      if (data.type === "ping") {
        if (event.ports && event.ports[0]) event.ports[0].postMessage({ ok: true, visible: document.visibilityState === "visible" });
        return;
      }
      if (!state.profile) return;
      if (data.type === "due") void checkReminders();
      if (data.type === "sale-ring") {
        if (!canCompose()) return;
        if (document.visibilityState !== "visible") {
          void notifyHiddenSales();
          return;
        }
        void pollAlerts();
        return;
      }
      if (data.type === "sale-open") {
        const seen = readAlertSeen();
        (Array.isArray(data.ids) ? data.ids : []).forEach((id) => seen.add(id));
        writeAlertSeen(seen);
        void rememberAlertIds(Array.isArray(data.ids) ? data.ids : []);
        if (canCompose()) void openAlerts();
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

  const SIM_LOGOS = {
    "הפניקס": "./logos/phoenix.png",
    "מנורה": "./logos/menora.png",
    "הכשרה": "./logos/hachshara.png",
    "מגדל": "./logos/migdal.png",
    "איילון": "./logos/ayalon.png",
    "כלל": "./logos/clal.png"
  };

  function simLogoHtml(company, className) {
    const src = SIM_LOGOS[company];
    if (!src) return "";
    return '<img class="' + className + '" src="' + esc(src) + '" alt="' + esc(company) + '"/>';
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
    return { step: "details", birthDate: "", startDate: "", gender: "", smoker: "", occupation: "", company: "", product: "", sum: "", covers: {}, age: null, result: null, error: "", busy: false, discountKey: "", discountPct: "", discounts: [], discountLoaded: "", saved: [] };
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
    else if (sim.step === "inputs" || sim.step === "result" || sim.step === "summary") sim.step = "product";
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
    if (product) { sim.product = product.getAttribute("data-sim-product"); sim.covers = {}; sim.sum = ""; sim.result = null; sim.discountKey = ""; sim.discountPct = ""; sim.discounts = []; sim.discountLoaded = ""; sim.step = "inputs"; sim.error = ""; paintSim(); return; }
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
    if (event.target.closest("#simAdd") || event.target.closest("#simAddInsured")) {
      simStashQuote(sim);
      sim.step = event.target.closest("#simAddInsured") ? "details" : "company";
      paintSim();
    }
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
      if (sim.result && sim.result.ok) {
        sim.step = sim.saved && sim.saved.length ? "summary" : "result";
        sim.discountKey = "";
        sim.discountPct = "";
        void loadSimDiscounts();
      }
    } catch (_err) {
      sim.error = "לא ניתן לטעון את מנוע הסימולטורים כרגע.";
    }
    sim.busy = false;
    paintSim();
  }

  function discountRows(raw) {
    return (Array.isArray(raw) ? raw : []).map((row) => {
      const item = row && typeof row === "object" ? row : {};
      return { label: trim(item.label), pct: Number(item.pct) || 0, years: item.years || null, schedule: trim(item.schedule) };
    }).filter((row) => row.label);
  }

  function discountYear1(row) {
    const pct = Number(row && row.pct);
    if (Number.isFinite(pct) && pct > 0) return Math.min(100, pct);
    const sched = trim(row && row.schedule);
    if (sched) {
      const n = Number(String(sched.split("/")[0]).replace(/[^\d.-]/g, ""));
      if (Number.isFinite(n) && n > 0) return Math.min(100, n);
    }
    return 0;
  }

  function chosenDiscountPct(sim) {
    if (!sim) return 0;
    if (sim.discountKey === "manual") {
      const n = Number(String(sim.discountPct || "").replace(/[^\d.]/g, ""));
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.min(100, n);
    }
    if (String(sim.discountKey || "").charAt(0) !== "c") return 0;
    const index = Number(String(sim.discountKey).slice(1));
    const row = sim.discounts && sim.discounts[index];
    return row ? discountYear1(row) : 0;
  }

  function discountAfter(amount, pct) {
    const base = Number(amount) || 0;
    const rate = Math.min(100, Math.max(0, Number(pct) || 0));
    return Math.round(base * (100 - rate)) / 100;
  }

  function simResultHtml(sim) {
    const pct = chosenDiscountPct(sim);
    const monthly = Number(sim.result.monthlyPremium) || 0;
    const annual = Number(sim.result.annualPremium) || 0;
    const options = '<option value="">ללא הנחה</option>'
      + (sim.discounts || []).map((row, index) => {
        const value = "c" + index;
        return '<option value="' + value + '"' + (sim.discountKey === value ? " selected" : "") + ">" + esc(row.label) + "</option>";
      }).join("")
      + '<option value="manual"' + (sim.discountKey === "manual" ? " selected" : "") + ">הנחה ידנית</option>";
    const manual = sim.discountKey === "manual"
      ? '<label class="field" for="simDiscountPct">אחוז הנחה</label><input class="input" id="simDiscountPct" inputmode="decimal" dir="ltr" autocomplete="off" value="' + esc(sim.discountPct || "") + '"/>'
      : "";
    const after = sim.discountKey
      ? '<div><span class="simResult__k">פרמיה לאחר הנחה</span><strong id="simAfterMonth">' + esc(money(discountAfter(monthly, pct))) + "</strong>"
        + '<small id="simAfterYear">שנתית ' + esc(money(discountAfter(annual, pct))) + "</small></div>"
      : "";
    return '<div class="simResultWrap"><article class="simResult">' + simLogoHtml(sim.company, "simLogo")
      + "<p>" + esc(sim.company + " · " + sim.product) + "</p>"
      + '<div class="simPremiums"><div><span class="simResult__k">פרמיה לפני הנחה</span><strong>' + esc(money(monthly)) + "</strong>"
      + "<small>שנתית " + esc(money(annual)) + " · גיל ביטוחי " + esc(String(sim.age)) + "</small></div>"
      + after + "</div>"
      + '<label class="field" for="simDiscount">הנחה</label><select class="input" id="simDiscount">' + options + "</select>"
      + manual + "</article></div>";
  }

  function simStashQuote(sim) {
    if (sim.result && sim.result.ok) {
      sim.saved = sim.saved || [];
      sim.saved.push(simSnapshot(sim));
    }
    sim.company = "";
    sim.product = "";
    sim.covers = {};
    sim.sum = "";
    sim.result = null;
    sim.discountKey = "";
    sim.discountPct = "";
    sim.discounts = [];
    sim.discountLoaded = "";
    sim.error = "";
  }

  function simSnapshot(sim) {
    const pct = chosenDiscountPct(sim);
    const monthly = Number(sim.result && sim.result.monthlyPremium) || 0;
    const annual = Number(sim.result && sim.result.annualPremium) || 0;
    return {
      company: sim.company,
      product: sim.product,
      beforeMonth: monthly,
      afterMonth: discountAfter(monthly, pct)
    };
  }

  function simSummaryHtml(sim) {
    const rows = (sim.saved || []).concat([simSnapshot(sim)]);
    const before = rows.reduce((sum, row) => sum + row.beforeMonth, 0);
    const after = rows.reduce((sum, row) => sum + row.afterMonth, 0);
    const cards = rows.map((row) => '<article class="simSum__row">'
      + simLogoHtml(row.company, "simSum__logo")
      + '<div class="simSum__main"><b>' + esc(row.company) + "</b><span>" + esc(row.product) + "</span></div>"
      + '<div class="simSum__nums"><small>לפני</small><strong>' + esc(money(row.beforeMonth)) + "</strong></div>"
      + '<div class="simSum__nums"><small>אחרי</small><strong>' + esc(money(row.afterMonth)) + "</strong></div></article>").join("");
    return '<section class="simSum" aria-label="סיכום">' + cards
      + '<article class="simSum__total"><span>סה״כ לפני הנחה</span><b>' + esc(money(before)) + "</b>"
      + "<span>סה״כ לאחר הנחה</span><b>" + esc(money(after)) + "</b></article></section>";
  }

  function paintSimAfter() {
    const sim = state.sim;
    if (!sim || !sim.result) return;
    const pct = chosenDiscountPct(sim);
    const month = $("simAfterMonth");
    const year = $("simAfterYear");
    if (month) month.textContent = money(discountAfter(sim.result.monthlyPremium, pct));
    if (year) year.textContent = "שנתית " + money(discountAfter(sim.result.annualPremium, pct));
  }

  async function loadSimDiscounts() {
    const sim = state.sim;
    if (!sim || !sim.company || !sim.product) return;
    const key = sim.company + "\n" + sim.product;
    if (sim.discountLoaded === key) return;
    const table = window.ONYX_DISCOUNT_CATALOG || {};
    const builtIn = table[sim.company] && table[sim.company][sim.product];
    let rows = discountRows(builtIn);
    try {
      const res = await sb.from("app_meta").select("discounts:payload->companyDiscountOverrides").eq("key", "global").maybeSingle();
      const saved = res.data && res.data.discounts;
      const company = saved && saved[sim.company];
      if (company && Object.prototype.hasOwnProperty.call(company, sim.product) && Array.isArray(company[sim.product])) {
        rows = discountRows(company[sim.product]);
      }
    } catch (_err) {}
    if (!state.sim || state.sim.company + "\n" + state.sim.product !== key) return;
    state.sim.discounts = rows;
    state.sim.discountLoaded = key;
    if (state.sim.step === "result") paintSim();
  }

  function paintSim() {
    const host = $("simBody");
    const sim = state.sim || simBlank();
    state.sim = sim;
    if (sim.step === "company") {
      const logoRows = [["הפניקס", "מגדל", "כלל"], ["מנורה", "הכשרה", "איילון"]];
      host.innerHTML = '<p class="simLead">בחירת חברה. גיל ביטוחי ' + esc(String(sim.age)) + '</p><div class="simLogos">'
        + logoRows.map((row) => '<div class="simLogos__row">' + row.map((name) => '<button class="simLogoBtn" type="button" data-sim-company="' + esc(name) + '" aria-label="' + esc(name) + '">' + simLogoHtml(name, "simLogoBtn__img") + "</button>").join("") + "</div>").join("")
        + "</div>";
      return;
    }
    if (sim.step === "product") {
      host.innerHTML = '<p class="simLead">' + esc(sim.company) + "</p>" + simProducts(sim.company).map((product) => '<button class="simPick" type="button" data-sim-product="' + esc(product) + '">' + esc(product) + "</button>").join("");
      return;
    }
    if (sim.step === "inputs" || sim.step === "result" || sim.step === "summary") {
      const kind = simKind(sim.product);
      let fields = "";
      if (kind === "health") {
        const list = SIM_HEALTH[sim.company] || [];
        fields = list.map((cover) => '<button class="simCover' + (sim.covers[cover.id] ? " is-on" : "") + '" type="button" data-sim-cover="' + esc(cover.id) + '">' + esc(cover.label) + "</button>").join("");
      } else {
        const label = kind === "compensation" ? "סכום פיצוי" : "סכום ביטוח";
        fields = '<label class="field" for="simSum">' + label + '</label><input class="input" id="simSum" inputmode="numeric" dir="ltr" autocomplete="off" value="' + esc(groupSum(sim.sum)) + '"/>';
      }
      const done = (sim.step === "result" || sim.step === "summary") && sim.result && sim.result.ok;
      const result = done
        ? simResultHtml(sim) + (sim.saved && sim.saved.length ? simSummaryHtml(sim) : "") + '<div class="simAddRow"><button class="primary" id="simAdd" type="button">הוסף מוצר ללקוח</button><button class="primary" id="simAddInsured" type="button">הוספת מבוטח</button></div>'
        : fields + '<button class="primary" id="simCalc" type="button"' + (sim.busy ? " disabled" : "") + ">" + (sim.busy ? "מחשב..." : "חשב פרמיה") + "</button>";
      const head = sim.step === "result" || sim.step === "summary" ? "" : '<p class="simLead">' + esc(sim.company + " · " + sim.product) + "</p>";
      host.innerHTML = head + result + '<p class="formError">' + esc(sim.error) + "</p>";
      return;
    }
    const seg = (attr, value, label) => '<button type="button" data-sim-' + attr + '="' + esc(value) + '"' + ((attr === "gender" ? sim.gender : sim.smoker) === value ? ' class="is-on"' : "") + ">" + esc(label) + "</button>";
    host.innerHTML = '<label class="field" for="simBirth">תאריך לידה</label><input class="input" id="simBirth" type="date" autocomplete="bday" max="' + esc(isoFromDate(new Date())) + '" value="' + esc(isoDate(sim.birthDate)) + '"/>'
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
