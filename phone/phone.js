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
    chip: "all",
    searchTimer: 0,
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
    noticeSending: false
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
    document.querySelectorAll("[data-screen]").forEach((node) => {
      node.hidden = node.getAttribute("data-screen") !== name;
    });
    const app = name === "home" || name === "customers" || name === "report" || name === "profile" || name === "more";
    $("tabbar").hidden = !app;
    document.querySelectorAll(".tab").forEach((tab) => {
      const key = tab.getAttribute("data-tab");
      const homeOn = (name === "home" || name === "profile") && key === "home";
      tab.classList.toggle("is-on", homeOn || (name === "customers" && key === "customers") || (name === "more" && key === "more"));
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
    if (state.companies) return state.companies;
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

  async function loadReport() {
    if (state.report) return state.report;
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
    if (!q && state.chip === "archive") query = query.eq("is_archived", true);
    else if (!q) query = query.eq("is_archived", false);
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
    let rows = res.data || [];
    if (state.chip === "active" || state.chip === "pending") rows = rows.filter((row) => customerBucket(row) === state.chip);
    if (state.chip === "archive") rows = rows.filter((row) => customerBucket(row) === "archive");
    if (state.chip === "all") rows = rows.filter((row) => customerBucket(row) !== "archive");
    return rows.slice(0, q ? 20 : 10);
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
      const bucket = customerBucket(row);
      const label = bucket === "archive" ? "ארכיון" : bucket === "pending" ? "בהמתנה" : "פעיל";
      const cls = bucket === "archive" ? "is-arch" : bucket === "pending" ? "is-wait" : "";
      const policies = (Number(row.new_policies_count) || 0) + (Number(row.existing_policies_count) || 0);
      const id = trim(row.id_number);
      let tone = 0;
      for (let i = 0; i < name.length; i += 1) tone = (tone + name.charCodeAt(i)) % marks.length;
      const policyWord = policies === 1 ? "פוליסה" : "פוליסות";
      return '<button class="cust" type="button" data-customer="' + esc(row.id) + '"><span class="cust__mark" style="background:' + marks[tone] + '">' + esc(name.slice(0, 1)) + '</span><div class="cust__main"><div class="cust__name">' + esc(name) + '</div>' + (id ? '<div class="cust__meta">ת.ז. ' + esc(id) + '</div>' : '') + '<div class="cust__meta">' + esc(String(policies)) + " " + policyWord + '</div></div><span class="cust__status ' + cls + '">' + label + '</span></button>';
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
          const sub = policySub(policy, title);
          return '<button class="pol" type="button" data-policy="' + index + '"><b class="pol__sum">' + esc(money(policyMonthly(policy))) + '</b><span class="pol__text"><span class="pol__name">' + esc(title) + '</span>' + (sub ? '<span class="pol__sub">' + esc(sub) + '</span>' : '') + '</span><span class="pol__ico" style="background:' + policyTone(title) + '">' + policyIcon(title) + '</span></button>';
        }).join("")
        : '<div class="empty">אין פוליסות שנרכשו בסוכנות</div>';
      body = '<section class="premCard"><div><p class="premCard__k">סה״כ פרמיה בתיק</p><strong>' + esc(money(monthly)) + '</strong></div><span class="premCard__ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/></svg></span></section><div class="fileStats"><div><b>' + policies.length + '</b><span>פוליסות</span></div><div><b>' + companies.size + '</b><span>חברות ביטוח</span></div><div><b>' + kinds.size + '</b><span>סוגי מוצרים</span></div></div><h2 class="blockTitle">פוליסות פעילות</h2><div class="polList">' + list + '</div>';
    } else if (tab === "details") {
      const bits = [];
      if (phone) bits.push('<div class="detailRow"><span>טלפון</span><b>' + esc(phone) + '</b></div>');
      if (idNumber) bits.push('<div class="detailRow"><span>ת.ז.</span><b>' + esc(idNumber) + '</b></div>');
      const agentName = trim(row.agent_name) || trim(payload.agentName);
      if (agentName) bits.push('<div class="detailRow"><span>נציג</span><b>' + esc(agentName) + '</b></div>');
      bits.push('<div class="detailRow"><span>סטטוס</span><b>' + label + '</b></div>');
      body = '<div class="detailList">' + bits.join("") + '</div>';
    } else {
      const docs = state.fileDocs;
      body = docs.length
        ? '<div class="docList">' + docs.map((doc, index) => '<button class="docRow" type="button" data-doc="' + index + '"><span><b>' + esc(docTitle(doc)) + '</b><span>' + esc(showDate(doc.uploadedAt || doc.createdAt) || "הורדה") + '</span></span><b>הורדה</b></button>').join("") + '</div>'
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
    if (state.policyReport) {
      body = '<h2 class="blockTitle">דוח מפורט</h2>' + kvHtml(policyFacts(policy), status.live ? status.text : "") + coversHtml(policy);
    } else if (tab === "deposits") {
      const monthly = policyMonthly(policy);
      const rows = [];
      if (monthly > 0) rows.push({ label: "הפקדה חודשית", value: money(monthly) });
      depositRows(policy).forEach((row) => rows.push(row));
      body = rows.length ? kvHtml(rows, "") : '<div class="empty">אין פירוט הפקדות שמור לפוליסה</div>';
    } else if (tab === "documents") {
      state.policyDocs = policyFiles(policy, payload);
      body = state.policyDocs.length
        ? '<div class="docList">' + state.policyDocs.map((doc, index) => '<button class="docRow" type="button" data-pdoc="' + index + '"><span><b>' + esc(docTitle(doc)) + '</b><span>הורדה</span></span><b>הורדה</b></button>').join("") + '</div>'
        : '<div class="empty">אין מסמכים שמורים לפוליסה</div>';
    } else {
      body = kvHtml(policyFacts(policy), status.live ? status.text : "") + coversHtml(policy);
    }
    host.innerHTML = card + tabs + body + '<p class="formError" id="policyNote" role="alert"></p>';
    foot.innerHTML = '<button class="primary" id="btnPolicyReport" type="button"><span>' + (state.policyReport ? "חזרה לפרטים" : "צפייה בדוח מפורט") + '</span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></button>';
  }

  function openPolicy(index) {
    state.policyIndex = index;
    state.policyTab = "details";
    state.policyReport = false;
    show("policy");
    paintPolicy();
  }

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
    if (photo) node.innerHTML = '<img alt="" src="' + esc(photo) + '"/>';
    else node.textContent = (profile.name || "נ").slice(0, 1);
    $("homeHello").textContent = "שלום, " + (profile.name || "");
    $("homeRole").textContent = ALLOWED[profile.role] || "";
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
      const label = perm === "granted" ? "התראות המכשיר מאושרות" : perm === "denied" ? "התראות המכשיר חסומות בדפדפן" : "התראות המכשיר עדיין לא אושרו";
      const button = perm === "granted" || perm === "unsupported" || perm === "denied"
        ? ""
        : '<button class="primary accountAction" id="btnNotify" type="button">אפשר התראות במכשיר</button>';
      host.innerHTML = '<p class="accountLead">' + esc(label) + '</p>' + button;
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

  async function enterApp() {
    await loadScope();
    paintHomeIdentity();
    show("home");
    $("homeNote").textContent = "";
    const notes = [];
    try {
      $("homeSummary").textContent = money(await loadNet(israelMonth(0)));
    } catch (_err) {
      $("homeSummary").textContent = "—";
      notes.push("הפרמיה החודשית לא נטענה");
    }
    try {
      const report = await loadReport();
      const stats = reportStats(report);
      $("tileIssued").textContent = money(stats.issued);
      $("tilePending").textContent = money(stats.pending);
    } catch (_err) {
      $("tileIssued").textContent = "—";
      $("tilePending").textContent = "—";
      notes.push("דוח המכירות לא נטען");
    }
    try { $("tileLeads").textContent = String(await loadLeadCount()); }
    catch (_err) { $("tileLeads").textContent = "—"; notes.push("ספירת הלידים לא נטענה"); }
    try { $("tileSold").textContent = money(await loadNet(israelRange())); }
    catch (_err) { $("tileSold").textContent = "—"; notes.push("נמכר היום לא נטען"); }
    $("homeNote").textContent = notes.join(" · ");
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

  $("btnReport").addEventListener("click", async () => {
    show("report");
    try {
      await loadReport();
      paintReport();
    } catch (_err) {
      $("reportMeta").textContent = "לא ניתן לטעון את הדוח";
    }
  });
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
      downloadFile(file, docTitle(file) || "document").catch((err) => {
        if (note) note.textContent = err.message || "לא ניתן להוריד את הקובץ";
      });
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
    downloadFile(file, docTitle(file) || "document").catch((err) => {
      if (note) note.textContent = err.message || "לא ניתן להוריד את הקובץ";
    });
  });
  $("policyFoot").addEventListener("click", (event) => {
    if (!event.target.closest("#btnPolicyReport")) return;
    state.policyReport = !state.policyReport;
    if (state.policyReport) state.policyTab = "details";
    paintPolicy();
  });
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
    if (typeof Notification === "undefined" || !Notification.requestPermission) return;
    Notification.requestPermission().then(() => { void paintAccount(); }).catch(() => {});
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
      if (key === "sales") void openSales();
      if (key === "activity") void openActivity();
      if (key === "leads") void openLeadsDay();
      if (key === "notice") openNotice();
    });
  });
  $("btnSalesBack").addEventListener("click", () => show("more"));
  $("btnActivityBack").addEventListener("click", () => show("more"));
  $("btnLeadsBack").addEventListener("click", () => show("more"));
  $("btnNoticeBack").addEventListener("click", () => show("more"));
  $("btnReportBack").addEventListener("click", () => show("home"));
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.disabled) return;
      const key = tab.getAttribute("data-tab");
      if (key === "home") show("home");
      if (key === "customers") void openCustomers(false);
      if (key === "more") show("more");
    });
  });
  document.querySelectorAll("#customerChips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.chip = chip.getAttribute("data-chip");
      document.querySelectorAll("#customerChips .chip").forEach((item) => item.classList.toggle("is-on", item === chip));
      void openCustomers(false);
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

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  lockScreen();
  boot().catch(() => show("splash"));
})();
