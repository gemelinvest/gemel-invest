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
    searchTimer: 0
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

  function fitFrame() {
    const view = window.visualViewport;
    const shell = document.querySelector(".shell");
    if (!view || !shell) return;
    const height = Math.round(view.height);
    const top = Math.round(view.offsetTop);
    document.body.style.top = top + "px";
    document.body.style.bottom = "auto";
    document.body.style.height = height + "px";
    shell.style.height = height + "px";
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
  }

  function show(name) {
    document.querySelectorAll("[data-screen]").forEach((node) => {
      node.hidden = node.getAttribute("data-screen") !== name;
    });
    const app = name === "home" || name === "customers" || name === "report";
    $("tabbar").hidden = !app;
    document.querySelectorAll(".tab").forEach((tab) => {
      const key = tab.getAttribute("data-tab");
      tab.classList.toggle("is-on", (name === "home" && key === "home") || (name === "customers" && key === "customers"));
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

  async function loadSold() {
    const range = israelRange();
    const res = await sb.rpc("gi_dashboard_net_premium", scopeArgs(range));
    if (res.error) throw new Error(res.error.message || "sold");
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    return Number(row && (row.net_premium != null ? row.net_premium : row.netPremium)) || 0;
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
      return '<article class="cust"><span class="cust__mark" style="background:' + marks[tone] + '">' + esc(name.slice(0, 1)) + '</span><div class="cust__main"><div class="cust__name">' + esc(name) + '</div>' + (id ? '<div class="cust__meta">ת.ז. ' + esc(id) + '</div>' : '') + '<div class="cust__meta">' + esc(String(policies)) + " " + policyWord + '</div></div><span class="cust__status ' + cls + '">' + label + '</span></article>';
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

  async function enterApp() {
    await loadScope();
    const profile = state.profile;
    $("homeAvatar").textContent = (profile.name || "נ").slice(0, 1);
    $("homeHello").textContent = "שלום, " + (profile.name || "");
    $("homeRole").textContent = ALLOWED[profile.role] || "";
    show("home");
    $("homeNote").textContent = "";
    const notes = [];
    try { $("tileSold").textContent = money(await loadSold()); }
    catch (_err) { $("tileSold").textContent = "—"; notes.push("נמכר היום לא נטען"); }
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

  $("btnCompanies").addEventListener("click", () => { void openCompanies(); });
  $("btnSearch").addEventListener("click", () => { void openCustomers(true); });
  $("btnReport").addEventListener("click", async () => {
    show("report");
    try {
      await loadReport();
      paintReport();
    } catch (_err) {
      $("reportMeta").textContent = "לא ניתן לטעון את הדוח";
    }
  });
  document.querySelectorAll("[data-open]").forEach((node) => {
    node.addEventListener("click", () => {
      const target = node.getAttribute("data-open");
      if (target === "companies") void openCompanies();
      if (target === "report") $("btnReport").click();
    });
  });
  $("companyClose").addEventListener("click", () => { $("companySheet").hidden = true; });
  $("companyBackdrop").addEventListener("click", () => { $("companySheet").hidden = true; });
  $("btnCustomersBack").addEventListener("click", () => show("home"));
  $("btnReportBack").addEventListener("click", () => show("home"));
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.disabled) return;
      const key = tab.getAttribute("data-tab");
      if (key === "home") show("home");
      if (key === "customers") void openCustomers(false);
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
