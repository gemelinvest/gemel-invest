/* GEMEL INVEST CRM — CLEAN CORE (Sheets + Admin Settings/Users)
   P260228-0800
   - Keeps: Login, user pill, Google Sheets connection, Admin: System Settings + Users
   - Removes: Customers / New Customer flow / Policies UI
*/
(() => {
  "use strict";

  const BUILD = "20260315-1035";
  const ADMIN_CONTACT_EMAIL = "oriasomech@gmail.com";
  const ARCHIVE_CUSTOMER_PIN = "1990";

  // ---------- Helpers ----------
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const on = (el, evt, fn, opts) => el && el.addEventListener && el.addEventListener(evt, fn, opts);
  const safeTrim = (v) => String(v ?? "").trim();
  const nowISO = () => new Date().toISOString();

  // Visible error box (login)
  function showLoginError(msg){
    const box = $("#lcLoginError");
    if (box) box.textContent = msg ? String(msg) : "";
  }

  window.addEventListener("error", (ev) => {
    try {
      console.error("GLOBAL_ERROR:", ev?.error || ev?.message || ev);
      if ($("#lcLogin") && document.body.classList.contains("lcAuthLock")) {
        if (!$("#lcLoginError")?.textContent) showLoginError("שגיאה במערכת. פתח קונסול (F12) לפרטים.");
      }
    } catch(_e) {}
  });
  window.addEventListener("unhandledrejection", (ev) => {
    try {
      console.error("UNHANDLED_REJECTION:", ev?.reason || ev);
      if ($("#lcLogin") && document.body.classList.contains("lcAuthLock")) {
        if (!$("#lcLoginError")?.textContent) showLoginError("שגיאה במערכת. פתח קונסול (F12) לפרטים.");
      }
    } catch(_e) {}
  });

  // ---------- Config / Local keys ----------
  const DEFAULT_GS_URL = "https://script.google.com/macros/s/AKfycbzIfQh5_eUCScWtQxbf8qS978mNB1VXj0WW6wAY3XCVlEDE_JV9gm-FL1T5UKZw5wDURA/exec";
  const LS_GS_URL_KEY = "GEMEL_GS_URL";
  const LS_SESSION_KEY = "GEMEL_SESSION_V1";
  const LS_BACKUP_KEY  = "GEMEL_STATE_BACKUP_V1";

  // ---------- State ----------
  const defaultState = () => ({
    meta: {
      updatedAt: null,
      adminAuth: { username: "מנהל מערכת", pin: "1234", active: true }
    },
    agents: [
      { id:"a_0", name:"יובל מנדלסון", username:"יובל מנדלסון", pin:"0000", active:true }
    ],
    customers: [],
    proposals: []
  });

  const State = {
    data: defaultState()
  };

  function normalizeState(s){
    const base = defaultState();
    const out = {
      meta: { ...(s?.meta || {}) },
      agents: Array.isArray(s?.agents) ? s.agents : base.agents,
      customers: Array.isArray(s?.customers) ? s.customers : [],
      proposals: Array.isArray(s?.proposals) ? s.proposals : []
    };

    const defAdmin = base.meta.adminAuth;
    const rawAdmin = out.meta.adminAuth || {};
    out.meta.adminAuth = {
      username: safeTrim(rawAdmin.username) || defAdmin.username,
      pin: safeTrim(rawAdmin.pin) || defAdmin.pin,
      active: (rawAdmin.active === false) ? false : true
    };

    out.agents = (out.agents || []).map((a, idx) => {
      const name = safeTrim(a?.name) || "נציג";
      const username = safeTrim(a?.username) || safeTrim(a?.user) || name;
      const pin = safeTrim(a?.pin) || safeTrim(a?.pass) || "0000";
      const roleRaw = safeTrim(a?.role) || safeTrim(a?.type) || "";
      const active = (a?.active === false) ? false : true;
      const role = (roleRaw === "manager" || roleRaw === "adminLite" || roleRaw === "admin") ? "manager" : (roleRaw === "ops" || roleRaw === "operations" || roleRaw === "תפעול") ? "ops" : "agent";
      return {
        id: safeTrim(a?.id) || ("a_" + idx),
        name, username, pin, role, active
      };
    }).filter(a => a.name);

    if (!out.agents.length) out.agents = base.agents;
    out.customers = (out.customers || []).map((c, idx) => normalizeCustomerRecord(c, idx)).filter(Boolean);
    out.proposals = (out.proposals || []).map((p, idx) => normalizeProposalRecord(p, idx)).filter(Boolean);
    out.meta.updatedAt = safeTrim(out.meta.updatedAt) || nowISO();
    return out;
  }

  function normalizeCustomerRecord(c, idx=0){
    const payload = c?.payload && typeof c.payload === "object" ? c.payload : {};
    const primary = payload?.primary || payload?.insureds?.[0]?.data || {};
    const fullName = safeTrim(c?.fullName) || safeTrim(((primary.firstName || "") + " " + (primary.lastName || "")).trim()) || "לקוח ללא שם";
    const idNumber = safeTrim(c?.idNumber) || safeTrim(primary.idNumber);
    const phone = safeTrim(c?.phone) || safeTrim(primary.phone);
    const email = safeTrim(c?.email) || safeTrim(primary.email);
    const city = safeTrim(c?.city) || safeTrim(primary.city);
    const agentName = safeTrim(c?.agentName) || safeTrim(c?.createdBy) || "";
    const createdAt = safeTrim(c?.createdAt) || nowISO();
    const updatedAt = safeTrim(c?.updatedAt) || createdAt;
    const insuredCount = Number(c?.insuredCount || payload?.insureds?.length || 0) || 0;
    const existingPoliciesCount = Number(c?.existingPoliciesCount || ((payload?.insureds || []).reduce((acc, ins) => acc + ((ins?.data?.existingPolicies || []).length), 0))) || 0;
    const newPoliciesCount = Number(c?.newPoliciesCount || (payload?.newPolicies || []).length) || 0;
    return {
      id: safeTrim(c?.id) || ("cust_" + idx + "_" + Math.random().toString(16).slice(2)),
      status: safeTrim(c?.status) || "חדש",
      fullName,
      idNumber,
      phone,
      email,
      city,
      agentName,
      agentRole: safeTrim(c?.agentRole) || "",
      createdAt,
      updatedAt,
      insuredCount,
      existingPoliciesCount,
      newPoliciesCount,
      payload
    };
  }

  function normalizeProposalRecord(p, idx=0){
    const payload = p?.payload && typeof p.payload === "object" ? p.payload : {};
    const operational = payload?.operational && typeof payload.operational === "object" ? payload.operational : {};
    const primary = operational?.primary || payload?.insureds?.[0]?.data || {};
    const fullName = safeTrim(p?.fullName) || safeTrim(((primary.firstName || "") + " " + (primary.lastName || "")).trim()) || "הצעה ללא שם";
    const idNumber = safeTrim(p?.idNumber) || safeTrim(primary.idNumber);
    const phone = safeTrim(p?.phone) || safeTrim(primary.phone);
    const email = safeTrim(p?.email) || safeTrim(primary.email);
    const city = safeTrim(p?.city) || safeTrim(primary.city);
    const agentName = safeTrim(p?.agentName) || safeTrim(p?.createdBy) || "";
    const createdAt = safeTrim(p?.createdAt) || nowISO();
    const updatedAt = safeTrim(p?.updatedAt) || createdAt;
    const currentStep = Math.max(1, Math.min(8, Number(p?.currentStep || payload?.currentStep || 1) || 1));
    const insuredCount = Number(p?.insuredCount || payload?.insureds?.length || 0) || 0;
    return {
      id: safeTrim(p?.id) || ("prop_" + idx + "_" + Math.random().toString(16).slice(2)),
      status: safeTrim(p?.status) || "פתוחה",
      fullName,
      idNumber,
      phone,
      email,
      city,
      agentName,
      agentRole: safeTrim(p?.agentRole) || "",
      createdAt,
      updatedAt,
      currentStep,
      insuredCount,
      payload
    };
  }

  // ---------- Storage (Sheets) ----------
  const Storage = {
    gsUrl: DEFAULT_GS_URL,


    session(){
      try{
        const name = safeTrim(Auth?.current?.name);
        const role = safeTrim(Auth?.current?.role);
        return { name, role };
      }catch(_e){
        return { name:"", role:"" };
      }
    },

    loadBackup(){
      try {
        const raw = localStorage.getItem(LS_BACKUP_KEY);
        if(!raw) return null;
        return normalizeState(JSON.parse(raw));
      } catch(_) { return null; }
    },
    saveBackup(st){
      try { localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(st)); } catch(_) {}
    },

    setUrl(v){
      const url = safeTrim(v);
      if(!url) return;
      this.gsUrl = url;
      try { localStorage.setItem(LS_GS_URL_KEY, url); } catch(_) {}
    },
    restoreUrl(){
      try {
        const u = safeTrim(localStorage.getItem(LS_GS_URL_KEY));
        if (u) this.gsUrl = u;
      } catch(_) {}
    },

    async ping(){
      if(!this.gsUrl) return { ok:false, error:"אין כתובת Web App" };
      const url = new URL(this.gsUrl);
      url.searchParams.set("action","ping");
      try {
        const res = await fetch(url.toString(), { method:"GET" });
        const json = await res.json();
        return json && json.ok ? { ok:true, at: json.ts || nowISO() } : { ok:false, error: json?.error || "ping failed" };
      } catch(e) {
        return { ok:false, error: String(e?.message || e) };
      }
    },

    async loadSheets(){
      if(!this.gsUrl) return { ok:false, error:"אין כתובת Web App" };
      const url = new URL(this.gsUrl);
      url.searchParams.set("action","get");
      const s = this.session();
      if (s.name) url.searchParams.set("user", s.name);
      if (s.role) url.searchParams.set("role", s.role);
      try {
        const res = await fetch(url.toString(), { method:"GET" });
        const json = await res.json();
        if(!json || json.ok !== true) return { ok:false, error: json?.error || "get failed" };
        return { ok:true, payload: normalizeState(json.payload || {}), at: json.at || nowISO() };
      } catch(e) {
        return { ok:false, error: String(e?.message || e) };
      }
    },

    async saveSheets(state){
      if(!this.gsUrl) return { ok:false, error:"אין כתובת Web App" };
      const url = new URL(this.gsUrl);
      url.searchParams.set("action","put");
      try {
        const res = await fetch(url.toString(), {
          method:"POST",
          headers: { "Content-Type":"text/plain;charset=utf-8" },
          body: JSON.stringify({ payload: state, user: (this.session().name || ""), role: (this.session().role || "") })
        });
        const json = await res.json();
        if(!json || json.ok !== true) return { ok:false, error: json?.error || "put failed" };
        return { ok:true, at: json.at || nowISO() };
      } catch(e) {
        return { ok:false, error: String(e?.message || e) };
      }
    },

    async sendAdminContact(payload){
      if(!this.gsUrl) return { ok:false, error:"אין כתובת Web App" };
      const url = new URL(this.gsUrl);
      url.searchParams.set("action","sendAdminContact");
      try {
        const res = await fetch(url.toString(), {
          method:"POST",
          headers: { "Content-Type":"text/plain;charset=utf-8" },
          body: JSON.stringify({
            email: ADMIN_CONTACT_EMAIL,
            payload: {
              username: safeTrim(payload?.username),
              message: safeTrim(payload?.message),
              source: "login",
              build: BUILD,
              sentAt: nowISO()
            }
          })
        });
        const json = await res.json();
        if(!json || json.ok !== true) return { ok:false, error: json?.error || "sendAdminContact failed" };
        return { ok:true, at: json.at || nowISO() };
      } catch(e) {
        return { ok:false, error: String(e?.message || e) };
      }
    }
  };

  // ---------- Auth ----------
  const Auth = {
    current: null, // {name, role}
    els: null,

    init(){
      this.els = {
        wrap: $("#lcLogin"),
        form: $("#lcLoginForm"),
        user: $("#lcLoginUser"),
        pin: $("#lcLoginPin"),
        err: $("#lcLoginError"),
      };

      // show login immediately
      try {
        document.body.classList.add("lcAuthLock");
        this.els.wrap?.setAttribute?.("aria-hidden","false");
      } catch(_) {}

      try { localStorage.removeItem(LS_SESSION_KEY); } catch(_) {}
      this.lock();

      on(this.els.form, "submit", async (e) => {
        e.preventDefault();
        await this._submit();
      });
    },

    lock(){
      try {
        document.body.classList.add("lcAuthLock");
        this.els.wrap?.setAttribute?.("aria-hidden","false");
        setTimeout(() => this.els.user?.focus?.(), 50);
      } catch(_) {}
      UI.renderAuthPill();
    },

    unlock(){
      try {
        document.body.classList.remove("lcAuthLock");
        this.els.wrap?.setAttribute?.("aria-hidden","true");
      } catch(_) {}
    },

    isAdmin(){
      return !!(this.current && this.current.role === "admin");
    },

    isManager(){
      return !!(this.current && this.current.role === "manager");
    },

    isOps(){
      return !!(this.current && this.current.role === "ops");
    },

    canViewAllCustomers(){
      return this.isAdmin() || this.isManager() || this.isOps();
    },

    canManageUsers(){
      return this.isAdmin() || this.isManager();
    },

    logout(){
      this.current = null;
      try { localStorage.removeItem(LS_SESSION_KEY); } catch(_) {}
      this.lock();
      UI.applyRoleUI();
      UI.goView("dashboard");
    },

    _setError(msg){
      showLoginError(msg);
    },

    _restoreSession(){
      try {
        const raw = localStorage.getItem(LS_SESSION_KEY);
        if(!raw) return null;
        const s = JSON.parse(raw);
        const name = safeTrim(s?.name);
        const role = safeTrim(s?.role) || "agent";
        if(!name) return null;
        return { name, role };
      } catch(_) { return null; }
    },

    _saveSession(cur){
      try {
        localStorage.setItem(LS_SESSION_KEY, JSON.stringify({ name: cur.name, role: cur.role }));
      } catch(_) {}
    },

    async _submit(){
      const username = safeTrim(this.els.user?.value);
      const pin = safeTrim(this.els.pin?.value);

      this._setError("");
      if(!username) return this._setError("נא להזין שם משתמש");
      if(!pin) return this._setError("נא להזין קוד כניסה");

      // ensure boot done
      try { await App._bootPromise; } catch(_) {}

      const defAdmin = { username:"מנהל מערכת", pin:"1234" };
      const adminAuth = State.data?.meta?.adminAuth || { ...defAdmin, active:true };

      if (adminAuth.active !== false && username === safeTrim(adminAuth.username) && pin === safeTrim(adminAuth.pin)) {
        this.current = { name: safeTrim(adminAuth.username) || defAdmin.username, role:"admin" };
        try { localStorage.removeItem(LS_SESSION_KEY); } catch(_) {}
        await App.reloadSessionState();
        this.unlock();
        UI.applyRoleUI();
        UI.renderAuthPill();
        await WelcomeLoader.play(this.current.name, 4000);
        UI.goView("settings");
        return;
      }

      const agents = Array.isArray(State.data?.agents) ? State.data.agents : [];
      const matched = agents.find(a => safeTrim(a?.username) === username) || agents.find(a => safeTrim(a?.name) === username);
      if(!matched) return this._setError("שם משתמש לא נמצא");
      if(matched.active === false) return this._setError("המשתמש מושבת");
      const expected = safeTrim(matched.pin) || "0000";
      if(pin !== expected) return this._setError("קוד כניסה שגוי");

      this.current = { name: matched.name, role: (matched.role === "manager" ? "manager" : matched.role === "ops" ? "ops" : "agent") };
      try { localStorage.removeItem(LS_SESSION_KEY); } catch(_) {}
      await App.reloadSessionState();
      this.unlock();
      UI.applyRoleUI();
      UI.renderAuthPill();
      await WelcomeLoader.play(this.current.name, 4000);
      UI.goView("dashboard");
    }
  };

  function getTimeGreeting(){
    const hour = new Date().getHours();
    if(hour < 12) return "בוקר טוב";
    if(hour < 17) return "צהריים טובים";
    return "ערב טוב";
  }

  const WelcomeLoader = {
    el: null,
    ensure(){
      if(this.el) return this.el;
      const root = document.createElement("div");
      root.id = "lcWelcomeLoader";
      root.className = "lcWelcomeLoader";
      root.setAttribute("aria-hidden", "true");
      root.innerHTML = `
        <div class="lcWelcomeLoader__backdrop"></div>
        <div class="lcWelcomeLoader__panel" role="status" aria-live="polite" aria-atomic="true">
          <div class="lcWelcomeLoader__logoWrap" aria-hidden="true">
            <img class="lcWelcomeLoader__logo" src="./logo-login-clean.png" alt="GEMEL INVEST" />
          </div>
          <div class="lcWelcomeLoader__greeting" id="lcWelcomeGreeting"></div>
          <div class="lcWelcomeLoader__name" id="lcWelcomeName"></div>
          <div class="lcWelcomeLoader__sub">טוען מערכת, אנא המתן</div>
          <div class="lcWelcomeLoader__dots" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      `;
      document.body.appendChild(root);
      this.el = root;
      return root;
    },
    open(name){
      const root = this.ensure();
      const greetingEl = root.querySelector('#lcWelcomeGreeting');
      const nameEl = root.querySelector('#lcWelcomeName');
      if(greetingEl) greetingEl.textContent = getTimeGreeting();
      if(nameEl) nameEl.textContent = safeTrim(name);
      root.classList.add('is-open');
      root.setAttribute('aria-hidden', 'false');
    },
    close(){
      const root = this.ensure();
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
    },
    async play(name, ms=4000){
      this.open(name);
      await new Promise(resolve => setTimeout(resolve, ms));
      this.close();
    }
  };

  // ---------- Forgot Password / Contact Admin ----------
  const ForgotPasswordUI = {
    els: null,

    init(){
      this.els = {
        trigger: $("#lcForgotPasswordBtn"),
        wrap: $("#lcForgotModal"),
        backdrop: $("#lcForgotModalBackdrop"),
        close: $("#lcForgotModalClose"),
        cancel: $("#lcForgotModalCancel"),
        send: $("#lcForgotModalSend"),
        username: $("#lcForgotUsername"),
        message: $("#lcForgotMessage"),
        err: $("#lcForgotModalError"),
        success: $("#lcForgotModalSuccess")
      };

      on(this.els.trigger, "click", () => this.open());
      on(this.els.close, "click", () => this.close());
      on(this.els.cancel, "click", () => this.close());
      on(this.els.backdrop, "click", () => this.close());
      on(this.els.send, "click", () => this.submit());
      on(this.els.wrap, "keydown", (ev) => {
        if(ev.key === "Escape"){
          ev.preventDefault();
          this.close();
        }
      });
    },

    open(){
      if(!this.els?.wrap) return;
      this.setError("");
      this.setSuccess("");
      const loginUser = safeTrim($("#lcLoginUser")?.value);
      this.els.username.value = loginUser || this.els.username.value || "";
      this.els.wrap.classList.add("is-open");
      this.els.wrap.setAttribute("aria-hidden","false");
      setTimeout(() => {
        if(this.els.username.value) this.els.message?.focus?.();
        else this.els.username?.focus?.();
      }, 50);
    },

    close(){
      if(!this.els?.wrap) return;
      this.els.wrap.classList.remove("is-open");
      this.els.wrap.setAttribute("aria-hidden","true");
      this.setError("");
      this.setSuccess("");
    },

    setError(msg){
      if(this.els?.err) this.els.err.textContent = msg ? String(msg) : "";
    },

    setSuccess(msg){
      if(!this.els?.success) return;
      const hasMsg = !!msg;
      const textEl = this.els.success.querySelector('.lcForgotModal__successText');
      if(textEl) textEl.textContent = msg ? String(msg) : '';
      else this.els.success.textContent = msg ? String(msg) : '';
      this.els.success.classList.toggle('is-visible', hasMsg);
    },

    buildMailto(username, message){
      const subject = "פנייה ממסך כניסה – GEMEL INVEST";
      const body = [
        "שם משתמש: " + safeTrim(username),
        "",
        "הודעה:",
        safeTrim(message),
        "",
        "Build: " + BUILD,
        "Sent: " + nowISO()
      ].join("\n");
      return `mailto:${encodeURIComponent(ADMIN_CONTACT_EMAIL)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    },

    async submit(){
      const username = safeTrim(this.els?.username?.value);
      const message = safeTrim(this.els?.message?.value);
      this.setError("");
      this.setSuccess("");

      if(!username) return this.setError("נא להזין שם משתמש");
      if(!message) return this.setError("נא לכתוב את תוכן הפנייה");

      const btn = this.els?.send;
      const prevText = btn?.textContent || "שלח פנייה";
      if(btn){
        btn.disabled = true;
        btn.textContent = "שולח...";
      }

      const result = await Storage.sendAdminContact({ username, message });
      if(result.ok){
        this.setSuccess("הפנייה נשלחה בהצלחה למנהל המערכת.");
        if(this.els?.message) this.els.message.value = "";
        if(btn){
          btn.disabled = false;
          btn.textContent = prevText;
        }
        setTimeout(() => this.close(), 1800);
        return;
      }

      try {
        window.location.href = this.buildMailto(username, message);
        this.setSuccess("נפתח חלון מייל לשליחת הפנייה למנהל המערכת.");
      } catch(_e) {
        this.setError("לא הצלחתי לשלוח אוטומטית. ודא שמוגדר Web App תומך בשליחת מייל.");
      } finally {
        if(btn){
          btn.disabled = false;
          btn.textContent = prevText;
        }
      }
    }
  };

  // ---------- UI ----------
  const UI = {
    els: {},

    init(){
      this.els.pageTitle = $("#pageTitle");
      this.els.userPill = $("#lcUserPill");
      this.els.userPillText = $("#lcUserPillText");
      this.els.btnLogout = $("#btnLogout");
this.els.syncDot = $("#syncDot");
      this.els.syncText = $("#syncText");
      this.els.lastSyncText = $("#lastSyncText");

      this.els.gsUrl = $("#gsUrl");
      this.els.btnTestConn = $("#btnTestConn");
      this.els.btnSyncNow = $("#btnSyncNow");

      this.els.usersTbody = $("#usersTbody");
      this.els.btnAddUser = $("#btnAddUser");
      this.els.usersSearch = $("#usersSearch");
      this.els.usersFilter = $("#usersFilter");
      this.els.navUsers = $("#navUsers");
      this.els.navCustomers = $("#navCustomers");
      this.els.navProposals = $("#navProposals");
      this.els.customersTbody = $("#customersTbody");
      this.els.customersSearch = $("#customersSearch");
      this.els.customersCountBadge = $("#customersCountBadge");
      this.els.btnCustomersRefresh = $("#btnCustomersRefresh");
      this.els.proposalsTbody = $("#proposalsTbody");
      this.els.proposalsSearch = $("#proposalsSearch");
      this.els.proposalsCountBadge = $("#proposalsCountBadge");
      this.els.btnProposalsRefresh = $("#btnProposalsRefresh");

      on(this.els.btnLogout, "click", () => Auth.logout());
// nav
      $$(".nav__item").forEach(btn => {
        on(btn, "click", () => {
          const v = btn.getAttribute("data-view");
          if(!v) return;
          if(v === "settings" && !Auth.isAdmin()) return;
          if(v === "users" && !Auth.canManageUsers()) return;
          this.goView(v);
        });
      });

      // settings
      if(this.els.gsUrl) {
        this.els.gsUrl.value = Storage.gsUrl || "";
        on(this.els.gsUrl, "change", () => {
          Storage.setUrl(this.els.gsUrl.value);
          this.renderSyncStatus("URL עודכן", "warn");
        });
      }
      on(this.els.btnTestConn, "click", async () => {
        this.renderSyncStatus("בודק חיבור…", "warn");
        const r = await Storage.ping();
        if(r.ok) this.renderSyncStatus("מחובר", "ok", r.at);
        else this.renderSyncStatus("שגיאה בחיבור", "err", null, r.error);
      });
      on(this.els.btnSyncNow, "click", async () => {
        await App.syncNow();
      });

      // users
      on(this.els.btnAddUser, "click", async () => {
        if(!Auth.canManageUsers()) return;
        await UsersUI.addUser();
      });
      on(this.els.usersSearch, "input", () => UsersUI.render());
      on(this.els.usersFilter, "change", () => UsersUI.render());
      on(this.els.customersSearch, "input", () => CustomersUI.render());
      on(this.els.btnCustomersRefresh, "click", () => CustomersUI.render());
      on(this.els.proposalsSearch, "input", () => ProposalsUI.render());
      on(this.els.btnProposalsRefresh, "click", () => ProposalsUI.render());
this.applyRoleUI();
      this.renderAuthPill();
    },

    applyRoleUI(){
      const isAdmin = Auth.isAdmin();
      const canUsers = Auth.canManageUsers();
      const settingsBtn = document.querySelector('.nav__item[data-view="settings"]');
      if (settingsBtn) settingsBtn.style.display = isAdmin ? "" : "none";
      if (this.els.navUsers) this.els.navUsers.style.display = canUsers ? "" : "none";
      if (this.els.navCustomers) this.els.navCustomers.style.display = Auth.current ? "" : "none";
      if (this.els.navProposals) this.els.navProposals.style.display = Auth.current ? "" : "none";
    },

    setActiveNav(view){
      $$(".nav__item").forEach(b => b.classList.toggle("is-active", b.getAttribute("data-view") === view));
    },

    goView(view){
      let safe = String(view || "dashboard");
      if(safe === "settings" && !Auth.isAdmin()) safe = "dashboard";
      if(safe === "users" && !Auth.canManageUsers()) safe = "dashboard";
      if(safe === "customers" && !Auth.current) safe = "dashboard";
      if(safe === "proposals" && !Auth.current) safe = "dashboard";
      // hide all views
      $$(".view").forEach(v => v.classList.remove("is-visible"));
      const el = $("#view-" + safe);
      if (el) el.classList.add("is-visible");

      // title
      if (this.els.pageTitle) {
        const map = {
          dashboard: "דשבורד",
          customers: "לקוחות",
          proposals: "הצעות",
          discountSpec: "מפרט הנחות ביטוח",
          settings: "הגדרות מערכת",
          users: "ניהול משתמשים"
        };
        this.els.pageTitle.textContent = map[safe] || "דשבורד";
      }

      this.setActiveNav(safe);
      document.body.classList.remove("view-users-active","view-dashboard-active","view-settings-active","view-discountSpec-active","view-customers-active");
      document.body.classList.add("view-" + safe + "-active");

      // render view data
      if (safe === "users") UsersUI.render();
      if (safe === "customers") CustomersUI.render();
      if (safe === "proposals") ProposalsUI.render();
    },

    renderAuthPill(){
      const pill = this.els.userPill;
      const txt = this.els.userPillText;
      if(!pill || !txt) return;

      if(Auth.current) {
        pill.style.display = "";
txt.textContent = Auth.current.name + (Auth.isAdmin() ? " (מנהל מערכת)" : Auth.isManager() ? " (מנהל)" : Auth.isOps() ? " (תפעול)" : "");
      } else {
        pill.style.display = "none";
txt.textContent = "";
      }
    },

    renderSyncStatus(label, level="warn", at=null, err=null){
      const dot = this.els.syncDot;
      const t = this.els.syncText;
      const last = this.els.lastSyncText;

      if (t) t.textContent = "מצב: Google Sheets" + (label ? " · " + label : "");
      if (dot) {
        dot.classList.remove("ok","warn","err");
        dot.classList.add(level === "ok" ? "ok" : level === "err" ? "err" : "warn");
      }
      if (last) {
        if (err) last.textContent = "שגיאה: " + String(err);
        else if (at) last.textContent = "עודכן: " + String(at);
      }
    }
  };

  // ---------- Users UI (Admin) ----------
  const UsersUI = {
    _modalEls: null,
    _modalMode: "add",
    _ensureModal(){
      if(this._modalEls) return this._modalEls;
      this._modalEls = {
        wrap: $("#lcUserModal"),
        title: $("#lcUserModalTitle"),
        close: $("#lcUserModalClose"),
        cancel: $("#lcUserModalCancel"),
        save: $("#lcUserModalSave"),
        id: $("#lcUserId"),
        name: $("#lcUserName"),
        username: $("#lcUserUsername"),
        pin: $("#lcUserPin"),
        role: $("#lcUserRole"),
        active: $("#lcUserActive"),
        err: $("#lcUserModalErr"),
        nameErr: $("#lcUserNameErr"),
        userErr: $("#lcUserUsernameErr"),
        pinErr: $("#lcUserPinErr"),
      };

      const E = this._modalEls;
      const closeFn = () => this.closeModal();

      on(E.close, "click", closeFn);
      on(E.cancel, "click", closeFn);
      on(E.wrap, "click", (ev) => {
        const t = ev.target;
        if(t && t.getAttribute && t.getAttribute("data-close") === "1") closeFn();
      });
      on(E.save, "click", async () => {
        await this._saveFromModal();
      });

      on(E.wrap, "keydown", (ev) => {
        if(ev.key === "Escape"){ ev.preventDefault(); closeFn(); }
        if(ev.key === "Enter"){
          const tag = (ev.target && ev.target.tagName) ? ev.target.tagName.toLowerCase() : "";
          if(tag === "input" || tag === "select"){
            ev.preventDefault();
            this._saveFromModal();
          }
        }
      });

      return this._modalEls;
    },

    openModal(mode, user){
      const E = this._ensureModal();
      this._modalMode = (mode === "edit") ? "edit" : "add";

      // clear errors
      const hide = (el) => { if(el){ el.style.display="none"; } };
      hide(E.err); hide(E.nameErr); hide(E.userErr); hide(E.pinErr);

      if(E.title) E.title.textContent = (this._modalMode === "edit") ? "עריכת משתמש" : "הוסף נציג/סוכן";

      if(E.id) E.id.value = user ? (user.id || "") : "";
      if(E.name) E.name.value = user ? (user.name || "") : "";
      if(E.username) E.username.value = user ? (user.username || "") : "";
      if(E.pin) E.pin.value = user ? (user.pin || "") : "0000";
      if(E.role) E.role.value = user ? (user.role || "agent") : "agent";
      if(E.active) E.active.checked = user ? (user.active !== false) : true;

      if(E.wrap){
        E.wrap.classList.add("is-open");
        E.wrap.setAttribute("aria-hidden","false");
      }
      setTimeout(() => E.name?.focus?.(), 50);
    },

    closeModal(){
      const E = this._ensureModal();
      if(E.wrap){
        E.wrap.classList.remove("is-open");
        E.wrap.setAttribute("aria-hidden","true");
      }
    },

    _showErr(el, msg){
      if(!el) return;
      el.textContent = String(msg || "");
      el.style.display = msg ? "block" : "none";
    },

    async _saveFromModal(){
      const E = this._ensureModal();
      const name = safeTrim(E.name?.value);
      const username = safeTrim(E.username?.value) || name;
      const pin = safeTrim(E.pin?.value);
      const role = safeTrim(E.role?.value) || "agent";
      const active = !!E.active?.checked;

      // validate
      let ok = true;
      this._showErr(E.nameErr, name ? "" : "נא להזין שם");
      this._showErr(E.userErr, username ? "" : "נא להזין שם משתמש");
      this._showErr(E.pinErr, pin ? "" : "נא להזין PIN");
      if(!name || !username || !pin) ok = false;

      if(!ok){
        this._showErr(E.err, "חסרים שדות חובה");
        return;
      }
      this._showErr(E.err, "");

      State.data.agents = Array.isArray(State.data.agents) ? State.data.agents : [];

      const id = safeTrim(E.id?.value);
      const isEdit = (this._modalMode === "edit") && id;
      if(isEdit){
        const a = State.data.agents.find(x => String(x.id) === String(id));
        if(!a){
          this._showErr(E.err, "המשתמש לא נמצא");
          return;
        }
        a.name = name;
        a.username = username;
        a.pin = pin;
        a.role = (role === "manager" ? "manager" : role === "ops" ? "ops" : "agent");
        a.active = active;
        State.data.meta.updatedAt = nowISO();
        await App.persist("עודכן משתמש");
      } else {
        const newId = "a_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
        State.data.agents.push({
          id: newId,
          name,
          username,
          pin,
          role: (role === "manager" ? "manager" : role === "ops" ? "ops" : "agent"),
          active: true
        });
        State.data.meta.updatedAt = nowISO();
        await App.persist("נשמר משתמש חדש");
      }

      this.closeModal();
      this.render();
    },

    _filtered(){
      const q = safeTrim(UI.els.usersSearch?.value).toLowerCase();
      const f = safeTrim(UI.els.usersFilter?.value) || "all";
      let arr = Array.isArray(State.data?.agents) ? State.data.agents.slice() : [];
      if (f === "active") arr = arr.filter(a => a.active !== false);
      if (f === "disabled") arr = arr.filter(a => a.active === false);
      if (q) {
        arr = arr.filter(a =>
          safeTrim(a.name).toLowerCase().includes(q) ||
          safeTrim(a.username).toLowerCase().includes(q)
        );
      }
      return arr;
    },

    render(){
      if(!UI.els.usersTbody) return;
      const rows = this._filtered();
      UI.els.usersTbody.innerHTML = rows.map(a => {
        const status = (a.active === false) ? "מושבת" : "פעיל";
        const role = (a.role === "manager") ? "מנהל" : (a.role === "ops") ? "תפעול" : "נציג";
        return `
          <tr>
            <td>${escapeHtml(a.name)}</td>
            <td>${role}</td>
            <td><span class="badge">${status}</span></td>
            <td>
              <button class="btn" data-act="edit" data-id="${escapeHtml(a.id)}">ערוך</button>
              <button class="btn btn--danger" data-act="toggle" data-id="${escapeHtml(a.id)}">${a.active===false ? "הפעל" : "השבת"}</button>
            </td>
          </tr>`;
      }).join("");

      // bind actions
      UI.els.usersTbody.querySelectorAll("button[data-act]").forEach(b => {
        on(b, "click", async () => {
          const id = b.getAttribute("data-id");
          const act = b.getAttribute("data-act");
          if(act === "edit") await this.editUser(id);
          if(act === "toggle") await this.toggleUser(id);
        });
      });
    },

    async addUser(){
      this.openModal("add", null);
    },

    async editUser(id){
      const a = (State.data.agents || []).find(x => String(x.id) === String(id));
      if(!a) return;
      this.openModal("edit", a);
    },

    async toggleUser(id){
      const a = (State.data.agents || []).find(x => String(x.id) === String(id));
      if(!a) return;
      a.active = (a.active === false) ? true : false;
      State.data.meta.updatedAt = nowISO();

      await App.persist(a.active ? "המשתמש הופעל" : "המשתמש הושבת");
      this.render();
    }
  };

  function escapeHtml(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  // ---------- Customers UI ----------
  const CustomersUI = {
    currentId: null,
    els: {},
    policyModal: {},
    init(){
      this.els.wrap = $("#customerFull");
      this.els.backdrop = $("#customerFullBackdrop");
      this.els.close = $("#customerFullClose");
      this.els.opsBtn = $("#customerFullOpsBtn");
      this.els.proposalBtn = $("#customerFullProposalBtn");
      this.els.addPolicyBtn = $("#customerFullAddPolicyBtn");
      this.els.name = $("#customerFullName");
      this.els.meta = $("#customerFullMeta");
      this.els.avatar = $("#customerFullAvatar");
      this.els.dash = $("#customerFullDash");
      this.els.body = $("#customerFullBody");

      this.policyModal.wrap = $("#customerPolicyModal");
      this.policyModal.backdrop = $("#customerPolicyModalBackdrop");
      this.policyModal.close = $("#customerPolicyModalClose");
      this.policyModal.title = $("#customerPolicyModalTitle");
      this.policyModal.body = $("#customerPolicyModalBody");
      this.els.loader = $("#customerLoader");

      on(this.els.close, "click", () => this.close());
      on(this.els.backdrop, "click", () => this.close());
      on(this.els.opsBtn, "click", () => {
        const rec = this.current();
        if(!rec) return;
        const prevPayload = Wizard.getOperationalPayload;
        try{
          Wizard.getOperationalPayload = () => JSON.parse(JSON.stringify(rec.payload || {}));
          Wizard.openOperationalReport();
        } finally {
          Wizard.getOperationalPayload = prevPayload;
        }
      });
      on(this.els.proposalBtn, "click", () => {
        const rec = this.current();
        if(!rec) return;
        alert(`הצעה עבור ${rec.fullName || "הלקוח"} תהיה זמינה בשלב הבא.`);
      });
      on(this.els.addPolicyBtn, "click", () => {
        alert("שלב הבא: חיבור הוספת פוליסה מתוך תיק הלקוח.");
      });

      on(this.policyModal.close, "click", () => this.closePolicyModal());
      on(this.policyModal.backdrop, "click", () => this.closePolicyModal());
      on(this.policyModal.wrap, "click", (ev) => {
        if(ev.target?.getAttribute?.("data-close") === "1") this.closePolicyModal();
      });
    },

    list(){
      const all = Array.isArray(State.data?.customers) ? State.data.customers.slice() : [];
      const visible = all.filter(rec => Auth.canViewAllCustomers() || safeTrim(rec.agentName) === safeTrim(Auth?.current?.name));
      visible.sort((a,b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
      return visible;
    },

    filtered(){
      const q = safeTrim(UI.els.customersSearch?.value).toLowerCase();
      let rows = this.list();
      if(!q) return rows;
      return rows.filter(rec => [rec.fullName, rec.idNumber, rec.phone, rec.agentName, rec.email, rec.city].some(v => safeTrim(v).toLowerCase().includes(q)));
    },

    render(){
      if(!UI.els.customersTbody) return;
      const rows = this.filtered();
      if(UI.els.customersCountBadge){
        UI.els.customersCountBadge.textContent = rows.length + " לקוחות";
      }
      UI.els.customersTbody.innerHTML = rows.length ? rows.map(rec => {
        const updated = this.formatDate(rec.updatedAt || rec.createdAt);
        return `<tr>
          <td><div class="lcCustomers__nameCell"><strong>${escapeHtml(rec.fullName || "—")}</strong><span class="muted small">${escapeHtml(rec.city || "")}</span></div></td>
          <td>${escapeHtml(rec.idNumber || "—")}</td>
          <td dir="ltr">${escapeHtml(rec.phone || "—")}</td>
          <td>${escapeHtml(rec.agentName || "—")}</td>
          <td><span class="badge">${escapeHtml(rec.status || "חדש")}</span></td>
          <td>${escapeHtml(updated)}</td>
          <td><div class="lcCustomers__rowActions">
            <button class="btn btn--primary" data-open-customer="${escapeHtml(rec.id)}" type="button">פתח תיק</button>
            <button class="btn btn--danger lcCustomers__archiveBtn" data-archive-customer="${escapeHtml(rec.id)}" type="button">גנוז לקוח</button>
          </div></td>
        </tr>`;
      }).join("") : `<tr><td colspan="7"><div class="emptyState"><div class="emptyState__icon">🗂️</div><div class="emptyState__title">עדיין אין לקוחות</div><div class="emptyState__text">ברגע שמסיימים הקמת לקוח, הלקוח יישמר כאן אוטומטית ויהיה אפשר לפתוח את תיק הלקוח המלא.</div></div></td></tr>`;

      UI.els.customersTbody.querySelectorAll("[data-open-customer]").forEach(btn => {
        on(btn, "click", () => this.openByIdWithLoader(btn.getAttribute("data-open-customer")));
      });
      UI.els.customersTbody.querySelectorAll("[data-archive-customer]").forEach(btn => {
        on(btn, "click", () => ArchiveCustomerUI.open(btn.getAttribute("data-archive-customer")));
      });
    },

    showLoader(){
      if(!this.els.loader) return;
      this.els.loader.classList.add("is-visible");
      this.els.loader.setAttribute("aria-hidden","false");
      document.body.style.overflow = "hidden";
    },

    hideLoader(){
      if(!this.els.loader) return;
      this.els.loader.classList.remove("is-visible");
      this.els.loader.setAttribute("aria-hidden","true");
    },

    openByIdWithLoader(id, delay=1180){
      const rec = this.byId(id);
      if(!rec) return;
      this.showLoader();
      window.clearTimeout(this._loaderTimer);
      this._loaderTimer = window.setTimeout(() => {
        this.hideLoader();
        this.openById(id);
      }, delay);
    },

    byId(id){
      return (State.data?.customers || []).find(x => String(x.id) === String(id)) || null;
    },

    getAvatarText(rec){
      const name = safeTrim(rec?.fullName || "");
      if(!name) return "ל";
      const parts = name.split(/\s+/).filter(Boolean);
      return safeTrim(parts[0]?.[0] || name[0] || "ל");
    },

    sumPremium(policies=[]){
      return policies.reduce((sum, p) => sum + this.asNumber(p.premiumValue), 0);
    },

    asNumber(v){
      const n = Number(String(v ?? "").replace(/[^\d.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    },

    formatMoney(v){
      const n = this.asNumber(v);
      if(!n) return "₪0";
      try{ return "₪" + n.toLocaleString("he-IL"); }catch(_){ return "₪" + n; }
    },

    collectPolicies(rec){
      const payload = rec?.payload || {};
      const policies = [];
      (payload.insureds || []).forEach((ins, idx) => {
        const insuredLabel = safeTrim(ins?.label) || safeTrim(ins?.type) || `מבוטח ${idx+1}`;
        (ins?.data?.existingPolicies || []).forEach((p, pIdx) => {
          const type = safeTrim(p?.type || p?.product || "פוליסה");
          const monthlyPremium = safeTrim(p?.monthlyPremium || p?.premiumMonthly || p?.premium || "");
          const coverItems = Array.isArray(p?.covers) ? p.covers.filter(Boolean) : [];
          const coverageValue = safeTrim(p?.sumInsured || p?.compensation || p?.coverage || (coverItems.length ? coverItems.join(", ") : ""));
          policies.push({
            id: safeTrim(p?.id) || `existing_${idx}_${pIdx}`,
            origin: "existing",
            insuredLabel,
            company: safeTrim(p?.company),
            type,
            premiumText: monthlyPremium ? this.formatMoney(monthlyPremium) : "—",
            premiumValue: monthlyPremium,
            startDate: safeTrim(p?.startDate),
            policyNumber: safeTrim(p?.policyNumber),
            coverageLabel: (type === "מחלות קשות" || type === "סרטן") ? "סכום פיצוי" : (coverItems.length ? "כיסויים" : "סכום ביטוח"),
            coverageValue,
            coverItems,
            subtitle: safeTrim(p?.policyNumber) ? `פוליסה ${p.policyNumber}` : insuredLabel,
            badgeText: "הגיעה עם הלקוח",
            badgeClass: "is-existing",
            ctaText: "פרטי פוליסה",
            details: {
              "סטטוס": "פוליסה קיימת",
              "מבוטח": insuredLabel,
              "חברה": safeTrim(p?.company),
              "סוג מוצר": type,
              "מספר פוליסה": safeTrim(p?.policyNumber),
              "פרמיה חודשית": monthlyPremium ? this.formatMoney(monthlyPremium) : "—",
              [(coverageValue ? ((type === "מחלות קשות" || type === "סרטן") ? "סכום פיצוי" : "סכום ביטוח") : "פרט נוסף")]: coverageValue || "—",
              "תחילת ביטוח": safeTrim(p?.startDate) || "—",
              "שיעבוד": p?.hasPledge ? `כן${safeTrim(p?.pledgeBankName) ? ` · ${safeTrim(p.pledgeBankName)}` : ""}` : "לא"
            }
          });
        });
      });

      (payload.newPolicies || []).forEach((p, idx) => {
        const type = safeTrim(p?.type || p?.product || (p?.company === "מדיקר" ? "מדיקר" : "פוליסה"));
        const premium = safeTrim(p?.premiumMonthly || p?.premium || p?.premiumBefore || "");
        const coverItems = Array.isArray(p?.healthCovers) ? p.healthCovers.filter(Boolean) : [];
        const coverageValue = safeTrim(p?.sumInsured || p?.compensation || p?.coverage || (coverItems.length ? coverItems.join(", ") : ""));
        const insuredLabel = this.getNewPolicyInsuredLabel(payload, p);
        policies.push({
          id: safeTrim(p?.id) || `new_${idx}`,
          origin: "new",
          insuredLabel,
          company: safeTrim(p?.company),
          type,
          premiumText: premium ? this.formatMoney(premium) : "—",
          premiumValue: premium,
          startDate: safeTrim(p?.startDate),
          policyNumber: safeTrim(p?.policyNumber),
          coverageLabel: (type === "מחלות קשות" || type === "סרטן") ? "סכום פיצוי" : (coverageValue && String(coverageValue).includes(",") ? "כיסויים" : "סכום ביטוח"),
          coverageValue,
          subtitle: insuredLabel,
          badgeText: "חדש",
          badgeClass: "is-new",
          ctaText: "פרטי פוליסה",
          details: {
            "סטטוס": "פוליסה חדשה",
            "מבוטח": insuredLabel,
            "חברה": safeTrim(p?.company),
            "סוג מוצר": type,
            "פרמיה חודשית": premium ? this.formatMoney(premium) : "—",
            "תחילת ביטוח": safeTrim(p?.startDate) || "—",
            [(coverageValue ? ((type === "מחלות קשות" || type === "סרטן") ? "סכום פיצוי" : (String(coverageValue).includes(",") ? "כיסויים" : "סכום ביטוח")) : "פרט נוסף")]: coverageValue || "—",
            "שיעבוד": p?.pledge ? "כן" : "לא"
          }
        });
      });
      return policies;
    },

    getNewPolicyInsuredLabel(payload, policy){
      if(policy?.insuredMode === "couple"){
        const primary = safeTrim(payload?.insureds?.[0]?.label) || "מבוטח ראשי";
        const spouse = safeTrim((payload?.insureds || []).find(x => x.type === "spouse")?.label);
        return spouse ? `${primary} + ${spouse}` : `${primary} (זוגי)`;
      }
      const ins = (payload?.insureds || []).find(x => x.id === policy?.insuredId);
      return safeTrim(ins?.label) || "מבוטח";
    },

    getStats(rec, policies){
      const uniqueCompanies = Array.from(new Set(policies.map(p => safeTrim(p.company)).filter(Boolean)));
      return [
        { icon: "👥", value: String(rec.insuredCount || payloadCount(rec)), label: "מבוטחים במשפחה", sub: "כולל ראשי / בני זוג / ילדים" },
        { icon: "💼", value: this.formatMoney(this.sumPremium(policies)), label: "פרמיה חודשית", sub: "סך כל הפוליסות בתיק" },
        { icon: "🏢", value: String(uniqueCompanies.length || 0), label: "חברות ביטוח", sub: uniqueCompanies.length ? uniqueCompanies.join(" · ") : "טרם נוספו חברות" },
        { icon: "🗂️", value: String(policies.length || 0), label: "פוליסות פעילות", sub: `${rec.existingPoliciesCount || 0} קיימות · ${rec.newPoliciesCount || 0} חדשות` }
      ];

      function payloadCount(rec){
        return Number(rec?.payload?.insureds?.length || rec?.insuredCount || 0) || 0;
      }
    },

    companyClass(company){
      const key = safeTrim(company);
      const map = {
        "הראל": "is-harel",
        "מגדל": "is-migdal",
        "הפניקס": "is-phoenix",
        "מנורה": "is-menora",
        "כלל": "is-clal",
        "הכשרה": "is-hachshara",
        "איילון": "is-ayalon",
        "AIG": "is-aig",
        "ביטוח ישיר": "is-direct",
        "9 מיליון": "is-nine",
        "מדיקר": "is-medicare"
      };
      return map[key] || "is-generic";
    },

    getCompanyLogoSrc(company){
      if(typeof Wizard?.getCompanyLogoSrc === "function") return Wizard.getCompanyLogoSrc(company) || "";
      const map = {
        "הפניקס": "afenix.png",
        "הראל": "harel.png",
        "כלל": "clal.png",
        "מגדל": "megdl.png",
        "מנורה": "menora.png",
        "איילון": "ayalon.png",
        "הכשרה": "achshara.png",
        "AIG": "aig.png",
        "ביטוח ישיר": "beytuyashir.png",
        "9 מיליון": "9milyon.png",
        "מדיקר": "medicare.png"
      };
      return map[company] || "";
    },

    renderPolicyCard(policy){
      const logoSrc = this.getCompanyLogoSrc(policy.company);
      const logoHtml = logoSrc
        ? `<img class="customerPolicyCard__logoImg" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(policy.company || "")}" />`
        : `<span class="customerPolicyCard__logoFallback">${escapeHtml((policy.company || "ח").slice(0,1))}</span>`;
      const coverageLine = safeTrim(policy.coverageValue)
        ? `<div class="customerPolicyCard__metaLine"><span>${escapeHtml(policy.coverageLabel)}:</span> <strong>${escapeHtml(policy.coverageValue)}</strong></div>`
        : `<div class="customerPolicyCard__metaLine customerPolicyCard__metaLine--muted">${escapeHtml(policy.subtitle || "")}</div>`;
      const bottomLine = safeTrim(policy.startDate)
        ? `<div class="customerPolicyCard__metaLine"><span>תחילה:</span> <strong>${escapeHtml(policy.startDate)}</strong></div>`
        : (safeTrim(policy.policyNumber) ? `<div class="customerPolicyCard__metaLine"><span>מס׳ פוליסה:</span> <strong>${escapeHtml(policy.policyNumber)}</strong></div>` : `<div class="customerPolicyCard__metaLine customerPolicyCard__metaLine--muted">${escapeHtml(policy.insuredLabel || "")}</div>`);
      const coverItems = Array.isArray(policy.coverItems) ? policy.coverItems.filter(Boolean) : [];
      const coverChips = coverItems.length ? `<div class="customerPolicyCard__covers"><div class="customerPolicyCard__coversLabel">כיסויים</div><div class="customerPolicyCard__coversList">${coverItems.map(c => `<span class="customerPolicyCard__coverChip">${escapeHtml(c)}</span>`).join("")}</div></div>` : ``;
      return `<article class="customerPolicyCard ${this.companyClass(policy.company)} ${policy.origin === "new" ? "is-newCard" : "is-existingCard"}">
        <button class="customerPolicyCard__badge ${escapeHtml(policy.badgeClass)}" type="button" data-policy-open="${escapeHtml(policy.id)}">${escapeHtml(policy.badgeText)}</button>
        <div class="customerPolicyCard__shine" aria-hidden="true"></div>
        <div class="customerPolicyCard__head">
          <div class="customerPolicyCard__logoWrap">${logoHtml}</div>
          <div class="customerPolicyCard__brandText">
            <div class="customerPolicyCard__company">${escapeHtml(policy.company || "חברה")}</div>
            <div class="customerPolicyCard__product">${escapeHtml(policy.type || "פוליסה")}</div>
          </div>
        </div>
        <div class="customerPolicyCard__body">
          <div class="customerPolicyCard__premium">${escapeHtml(policy.premiumText || "—")}</div>
          ${coverageLine}
          ${bottomLine}
          ${coverChips}
        </div>
        <div class="customerPolicyCard__actions">
          <button class="customerPolicyCard__actionBtn" type="button" data-policy-open="${escapeHtml(policy.id)}">${escapeHtml(policy.ctaText)}</button>
        </div>
      </article>`;
    },

    renderPolicyWallet(rec, policies){
      const cards = policies.map(p => this.renderPolicyCard(p)).join("");
      return `<section class="customerWalletSection">
        <div class="customerWalletSection__head">
          <div class="customerWalletSection__titleWrap">
            <div class="customerWalletSection__icon">💼</div>
            <div>
              <div class="customerWalletSection__title">תיק הפוליסות</div>
              <div class="customerWalletSection__sub">תצוגת Wallet צבעונית — בדיוק לפי שפת העיצוב שבחרת</div>
            </div>
          </div>
        </div>
        <div class="customerPolicyGrid">${cards || `<div class="emptyState"><div class="emptyState__icon">🧾</div><div class="emptyState__title">עדיין אין פוליסות בתיק</div><div class="emptyState__text">ברגע שיישמרו פוליסות קיימות או חדשות, הן יוצגו כאן אוטומטית.</div></div>`}</div>
      </section>`;
    },

    bindPolicyCardActions(rec, policies){
      this.els.body.querySelectorAll("[data-policy-open]").forEach(btn => {
        on(btn, "click", () => {
          const id = btn.getAttribute("data-policy-open");
          const policy = policies.find(x => String(x.id) === String(id));
          if(policy) this.openPolicyModal(rec, policy);
        });
      });
    },

    openById(id){
      const rec = this.byId(id);
      if(!rec || !this.els.wrap) return;
      this.currentId = rec.id;
      const policies = this.collectPolicies(rec);
      const stats = this.getStats(rec, policies);

      if(this.els.name) this.els.name.textContent = rec.fullName || "תיק לקוח";
      if(this.els.avatar) this.els.avatar.textContent = this.getAvatarText(rec);
      if(this.els.meta){
        const metaParts = [
          rec.idNumber ? `<span class="customerHero__metaItem">ת.ז ${escapeHtml(rec.idNumber)}</span>` : "",
          rec.agentName ? `<span class="customerHero__metaSep">|</span><span class="customerHero__metaItem">נציג: ${escapeHtml(rec.agentName)}</span>` : "",
          rec.phone ? `<span class="customerHero__metaSep">|</span><span class="customerHero__metaItem" dir="ltr">${escapeHtml(rec.phone)}</span>` : ""
        ].filter(Boolean).join("");
        this.els.meta.innerHTML = metaParts;
      }
      if(this.els.dash){
        this.els.dash.innerHTML = stats.map(card => `
          <div class="customerStatCard">
            <div class="customerStatCard__icon">${card.icon}</div>
            <div class="customerStatCard__content">
              <div class="customerStatCard__value">${escapeHtml(card.value)}</div>
              <div class="customerStatCard__label">${escapeHtml(card.label)}</div>
              <div class="customerStatCard__sub">${escapeHtml(card.sub)}</div>
            </div>
          </div>`).join("");
      }
      if(this.els.body){
        this.els.body.innerHTML = this.renderPolicyWallet(rec, policies);
        this.bindPolicyCardActions(rec, policies);
      }
      this.els.wrap.classList.add("is-open");
      this.els.wrap.setAttribute("aria-hidden","false");
      document.body.style.overflow = "hidden";
    },

    openOpsById(id){
      const rec = this.byId(id);
      if(!rec) return;
      const prevPayload = Wizard.getOperationalPayload;
      try{
        Wizard.getOperationalPayload = () => JSON.parse(JSON.stringify(rec.payload || {}));
        Wizard.openOperationalReport();
      } finally {
        Wizard.getOperationalPayload = prevPayload;
      }
    },

    openPolicyModal(rec, policy){
      if(!this.policyModal.wrap || !this.policyModal.body) return;
      if(this.policyModal.title){
        this.policyModal.title.textContent = `${policy.company || "חברה"} · ${policy.type || "פוליסה"}`;
      }
      const detailRows = Object.entries(policy.details || {}).map(([k,v]) => `
        <div class="customerPolicyModal__row">
          <div class="customerPolicyModal__k">${escapeHtml(k)}</div>
          <div class="customerPolicyModal__v">${escapeHtml(safeTrim(v) || "—")}</div>
        </div>`).join("");
      this.policyModal.body.innerHTML = `
        <div class="customerPolicyModal__hero ${this.companyClass(policy.company)}">
          <div class="customerPolicyModal__heroTop">
            <div class="customerPolicyModal__heroBadge ${escapeHtml(policy.badgeClass)}">${escapeHtml(policy.badgeText)}</div>
            <div class="customerPolicyModal__heroPremium">${escapeHtml(policy.premiumText || "—")}</div>
          </div>
          <div class="customerPolicyModal__heroCompany">${escapeHtml(policy.company || "חברה")}</div>
          <div class="customerPolicyModal__heroType">${escapeHtml(policy.type || "פוליסה")}</div>
          <div class="customerPolicyModal__heroSub">${escapeHtml(rec.fullName || "לקוח")} · ${escapeHtml(policy.insuredLabel || "מבוטח")}</div>
        </div>
        <div class="customerPolicyModal__grid">${detailRows}</div>
      `;
      this.policyModal.wrap.classList.add("is-open");
      this.policyModal.wrap.setAttribute("aria-hidden", "false");
    },

    closePolicyModal(){
      if(!this.policyModal.wrap) return;
      this.policyModal.wrap.classList.remove("is-open");
      this.policyModal.wrap.setAttribute("aria-hidden", "true");
    },

    close(){
      if(!this.els.wrap) return;
      window.clearTimeout(this._loaderTimer);
      this.hideLoader();
      this.closePolicyModal();
      this.els.wrap.classList.remove("is-open");
      this.els.wrap.setAttribute("aria-hidden","true");
      document.body.style.overflow = "";
    },

    current(){
      return this.byId(this.currentId);
    },

    formatDate(v){
      if(!v) return "—";
      const d = new Date(v);
      if(Number.isNaN(d.getTime())) return String(v);
      return d.toLocaleString("he-IL");
    }
  };

  const ArchiveCustomerUI = {
    els: {},
    targetId: null,

    init(){
      this.els.wrap = $("#lcArchiveCustomerModal");
      this.els.backdrop = $("#lcArchiveCustomerBackdrop");
      this.els.close = $("#lcArchiveCustomerClose");
      this.els.cancel = $("#lcArchiveCustomerCancel");
      this.els.confirm = $("#lcArchiveCustomerConfirm");
      this.els.pin = $("#lcArchiveCustomerPin");
      this.els.error = $("#lcArchiveCustomerError");
      this.els.name = $("#lcArchiveCustomerName");
      this.els.meta = $("#lcArchiveCustomerMeta");

      on(this.els.backdrop, "click", () => this.close());
      on(this.els.close, "click", () => this.close());
      on(this.els.cancel, "click", () => this.close());
      on(this.els.confirm, "click", async () => { await this.confirm(); });
      on(this.els.pin, "keydown", async (ev) => {
        if(ev.key === "Enter"){
          ev.preventDefault();
          await this.confirm();
        }
      });
    },

    open(id){
      const rec = CustomersUI.byId(id);
      if(!rec || !this.els.wrap) return;
      this.targetId = rec.id;
      if(this.els.name) this.els.name.textContent = rec.fullName || "לקוח ללא שם";
      if(this.els.meta){
        this.els.meta.innerHTML = [
          rec.idNumber ? `ת״ז: <strong>${escapeHtml(rec.idNumber)}</strong>` : "",
          rec.phone ? `טלפון: <strong dir="ltr">${escapeHtml(rec.phone)}</strong>` : "",
          rec.agentName ? `נציג: <strong>${escapeHtml(rec.agentName)}</strong>` : ""
        ].filter(Boolean).map(x => `<span>${x}</span>`).join("");
      }
      if(this.els.pin) this.els.pin.value = "";
      this.showError("");
      this.els.wrap.classList.add("is-open");
      this.els.wrap.setAttribute("aria-hidden","false");
      setTimeout(() => this.els.pin?.focus?.(), 60);
    },

    close(){
      if(!this.els.wrap) return;
      this.els.wrap.classList.remove("is-open");
      this.els.wrap.setAttribute("aria-hidden","true");
      this.targetId = null;
      if(this.els.pin) this.els.pin.value = "";
      this.showError("");
    },

    showError(msg){
      if(!this.els.error) return;
      this.els.error.textContent = String(msg || "");
      this.els.error.style.display = msg ? "block" : "none";
    },

    getArchivePin(){
      return ARCHIVE_CUSTOMER_PIN;
    },

    async confirm(){
      const id = this.targetId;
      const rec = CustomersUI.byId(id);
      if(!id || !rec){
        this.showError("הלקוח לא נמצא יותר במערכת");
        return;
      }

      const typedPin = safeTrim(this.els.pin?.value);
      if(!typedPin){
        this.showError("נא להזין קוד מנהל");
        this.els.pin?.focus?.();
        return;
      }

      if(typedPin !== this.getArchivePin()){
        this.showError("קוד מנהל שגוי");
        this.els.pin?.focus?.();
        this.els.pin?.select?.();
        return;
      }

      const prevCustomers = Array.isArray(State.data?.customers) ? State.data.customers.slice() : [];
      const next = prevCustomers.filter(x => String(x.id) !== String(id));
      State.data.customers = next;
      State.data.meta = State.data.meta || {};
      State.data.meta.updatedAt = nowISO();

      const r = await App.persist("הלקוח נגנז ונמחק");
      if(!r?.ok){
        State.data.customers = prevCustomers;
        State.data.meta.updatedAt = nowISO();
        this.showError("שמירת הגניזה ל-Google Sheets נכשלה. הלקוח לא נמחק. בדוק חיבור ונסה שוב.");
        CustomersUI.render();
        return;
      }

      if(CustomersUI.currentId && String(CustomersUI.currentId) === String(id)){
        CustomersUI.close();
      }

      this.close();
      CustomersUI.render();
    }
  };

  // ---------- Proposals UI ----------
  const ProposalsUI = {
    list(){
      const all = Array.isArray(State.data?.proposals) ? State.data.proposals.slice() : [];
      const visible = all.filter(rec => Auth.canViewAllCustomers() || safeTrim(rec.agentName) === safeTrim(Auth?.current?.name));
      visible.sort((a,b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
      return visible;
    },

    filtered(){
      const q = safeTrim(UI.els.proposalsSearch?.value).toLowerCase();
      let rows = this.list();
      if(!q) return rows;
      return rows.filter(rec => [rec.fullName, rec.idNumber, rec.phone, rec.agentName, rec.email, rec.city].some(v => safeTrim(v).toLowerCase().includes(q)));
    },

    render(){
      if(!UI.els.proposalsTbody) return;
      const rows = this.filtered();
      if(UI.els.proposalsCountBadge) UI.els.proposalsCountBadge.textContent = rows.length + " הצעות";
      UI.els.proposalsTbody.innerHTML = rows.length ? rows.map(rec => `
        <tr>
          <td><div class="lcCustomers__nameCell"><strong>${escapeHtml(rec.fullName || "—")}</strong><span class="muted small">שלב ${escapeHtml(String(rec.currentStep || 1))} מתוך 8</span></div></td>
          <td>${escapeHtml(rec.idNumber || "—")}</td>
          <td dir="ltr">${escapeHtml(rec.phone || "—")}</td>
          <td>${escapeHtml(rec.agentName || "—")}</td>
          <td><span class="badge">טיוטה פתוחה</span></td>
          <td>${escapeHtml(CustomersUI.formatDate(rec.updatedAt || rec.createdAt))}</td>
          <td><div class="lcCustomers__rowActions">
            <button class="btn btn--primary" data-open-proposal="${escapeHtml(rec.id)}" type="button">המשך עריכה</button>
            <button class="btn" data-delete-proposal="${escapeHtml(rec.id)}" type="button">מחק</button>
          </div></td>
        </tr>`).join("") : `<tr><td colspan="7"><div class="emptyState"><div class="emptyState__icon">📝</div><div class="emptyState__title">אין כרגע הצעות פתוחות</div><div class="emptyState__text">כששומרים הקמת לקוח באמצע התהליך, ההצעה תופיע כאן ותאפשר להמשיך בדיוק מאותה נקודה.</div></div></td></tr>`;

      UI.els.proposalsTbody.querySelectorAll("[data-open-proposal]").forEach(btn => {
        on(btn, "click", () => this.openById(btn.getAttribute("data-open-proposal")));
      });
      UI.els.proposalsTbody.querySelectorAll("[data-delete-proposal]").forEach(btn => {
        on(btn, "click", async () => this.deleteById(btn.getAttribute("data-delete-proposal")));
      });
    },

    openById(id){
      const rec = (State.data?.proposals || []).find(x => String(x.id) === String(id));
      if(!rec) return;
      Wizard.openDraft(rec);
    },

    async deleteById(id){
      const rec = (State.data?.proposals || []).find(x => String(x.id) === String(id));
      if(!rec) return;
      const ok = window.confirm(`למחוק את ההצעה של ${rec.fullName || "הלקוח"}?`);
      if(!ok) return;
      State.data.proposals = (State.data.proposals || []).filter(x => String(x.id) !== String(id));
      State.data.meta.updatedAt = nowISO();
      await App.persist("ההצעה נמחקה");
      this.render();
    }
  };


  // ---------- App boot ----------
  

  // ---------- New Customer Wizard (Steps 1–7) ----------
  const Wizard = {
    els: {},
    isOpen: false,
    step: 1,
    steps: [
      { id:1, title:"פרטי לקוח" },
      { id:2, title:"BMI" },
      { id:3, title:"פוליסות קיימות" },
      { id:4, title:"ביטול בחברה נגדית" },
      { id:5, title:"פוליסות חדשות" },
      { id:6, title:"פרטי משלם" },
      { id:7, title:"סיכום" },
      { id:8, title:"הצהרת בריאות" }
    ],
    insureds: [],
    activeInsId: null,

    // closed lists
    clinics: ["כללית","מכבי","מאוחדת","לאומית"],
    shabanMap: {
      "כללית": ["אין שב״ן","כללית מושלם","כללית פלטינום"],
      "מכבי":  ["אין שב״ן","מכבי כסף","מכבי זהב","מכבי שלי"],
      "מאוחדת":["אין שב״ן","מאוחדת עדיף","מאוחדת שיא"],
      "לאומית":["אין שב״ן","לאומית כסף","לאומית זהב"]
    },
    occupations: [
      "אבטחה", "אדריכל", "אדריכלית", "אח", "אחות", "אחראי משמרת", "אינסטלטור", "אנליסט", "אנליסט פיננסי", "אסיסטנט", "איש אחזקה", "איש גבייה", "איש מכירות", "איש סיסטם", "איש תמיכה טכנית", "איש תפעול", "איש שירות", "איש שיווק", "איש QA", "איש DevOps", "אקטואר", "ארכיאולוג", "בודק תוכנה", "ביולוג", "בנאי", "בנקאי", "ברמן", "גזבר", "גנן", "גרפיקאי", "גרפיקאית", "דבוראי", "דוגמן", "דוגמנית", "דייל", "דיילת", "דייל קרקע", "דיילת קרקע", "דייג", "דיג׳יי", "הנדסאי", "הנדסאי אדריכלות", "הנדסאי בניין", "הנדסאי חשמל", "הנדסאי מכונות", "הנדסאי תוכנה", "ובמאי", "וטרינר", "וטרינרית", "זגג", "זכיין", "זמר", "זמרת", "חבלן", "חדרן", "חדרנית", "חובש", "חובשת", "חוקר", "חוקרת", "חשב", "חשבת", "חשב שכר", "חשב שכר בכיר", "חשמלאי", "חשמלאית", "טבח", "טבחית", "טבח ראשי", "טכנאי", "טכנאית", "טכנאי אלקטרוניקה", "טכנאי מיזוג", "טכנאי מחשבים", "טכנאי שירות", "טייס", "טייסת", "טלפן", "טלפנית", "טלמרקטינג", "יועץ", "יועצת", "יועץ ביטוח", "יועצת ביטוח", "יועץ השקעות", "יועצת השקעות", "יועץ מס", "יועצת מס", "יזם", "יזמת", "יחצן", "יחצנית", "כלכלן", "כלכלנית", "כבאי", "כבאית", "כתב", "כתבת", "לבורנט", "לבורנטית", "לוגיסטיקאי", "לוגיסטיקאית", "מהנדסת", "מהנדס", "מהנדס אזרחי", "מהנדסת אזרחית", "מהנדס בניין", "מהנדסת בניין", "מהנדס חשמל", "מהנדסת חשמל", "מהנדס מכונות", "מהנדסת מכונות", "מהנדס תוכנה", "מהנדסת תוכנה", "מדריך", "מדריכה", "מדריך כושר", "מדריכת כושר", "מזכיר", "מזכירה", "מזכיר רפואי", "מזכירה רפואית", "מחנך", "מחנכת", "מחסנאי", "מחסנאית", "מיילד", "מיילדת", "מכונאי", "מכונאית", "מכין שכר", "מנהל", "מנהלת", "מנהל אדמיניסטרטיבי", "מנהלת אדמיניסטרטיבית", "מנהל מוצר", "מנהלת מוצר", "מנהל פרויקט", "מנהלת פרויקט", "מנהל חשבונות", "מנהלת חשבונות", "מנהל כספים", "מנהלת כספים", "מנהל לקוחות", "מנהלת לקוחות", "מנהל מחסן", "מנהלת מחסן", "מנהל מוקד", "מנהלת מוקד", "מנהל משרד", "מנהלת משרד", "מנהל מרפאה", "מנהלת מרפאה", "מנהל סניף", "מנהלת סניף", "מנהל עבודה", "מנהלת עבודה", "מנהל רכש", "מנהלת רכש", "מנהל תפעול", "מנהלת תפעול", "מנהל תיקי לקוחות", "מנהלת תיקי לקוחות", "מנופאי", "מעבדה", "מעצב", "מעצבת", "מעצב גרפי", "מעצבת גרפית", "מפיק", "מפיקה", "מפעיל מכונה", "מפעילת מכונה", "מציל", "מצילה", "מרדים", "מרדימה", "מרכז", "מרכזת", "מרכז שירות", "מרכזת שירות", "מרצה", "מרצה בכיר", "משגיח כשרות", "משווק", "משווקת", "משלח", "משלחת", "מתאם", "מתאמת", "מתאם פגישות", "מתאמת פגישות", "מתכנת", "מתכנתת", "נהג", "נהגת", "נהג אוטובוס", "נהגת אוטובוס", "נהג חלוקה", "נהגת חלוקה", "נהג מונית", "נהגת מונית", "נהג משאית", "נהגת משאית", "נגר", "נגרית", "נציג", "נציגה", "נציג בק אופיס", "נציגה בק אופיס", "נציג מכירות", "נציגה מכירות", "נציג שירות", "נציגה שירות", "סגן מנהל", "סגנית מנהל", "סוכן", "סוכנת", "סוכן ביטוח", "סוכנת ביטוח", "סוכן מכירות", "סוכנת מכירות", "סטודנט", "סטודנטית", "ספר", "ספרית", "עובד אדמיניסטרציה", "עובדת אדמיניסטרציה", "עובד ייצור", "עובדת ייצור", "עובד ניקיון", "עובדת ניקיון", "עובד סוציאלי", "עובדת סוציאלית", "עובד כללי", "עובדת כללית", "עובד מעבדה", "עובדת מעבדה", "עובד תחזוקה", "עובדת תחזוקה", "עוזר הוראה", "עוזרת הוראה", "עורך דין", "עורכת דין", "עורך וידאו", "עורכת וידאו", "עיתונאי", "עיתונאית", "עמיל מכס", "עמילה מכס", "פועל", "פועלת", "פיזיותרפיסט", "פיזיותרפיסטית", "פקיד", "פקידה", "פרמדיק", "פרמדיקית", "פסיכולוג", "פסיכולוגית", "פקיד קבלה", "פקידה קבלה", "צלם", "צלמת", "צבעי", "צורף", "קבלן", "קב\"ט", "קונדיטור", "קונדיטורית", "קוסמטיקאית", "קופאי", "קופאית", "קצין בטיחות", "קצינת בטיחות", "קצין ביטחון", "קצינת ביטחון", "קצין רכב", "קצינת רכב", "קצין משאבי אנוש", "קצינת משאבי אנוש", "קריין", "קריינית", "רב", "רואת חשבון", "רואה חשבון", "רוקח", "רוקחת", "רופא", "רופאה", "רופא משפחה", "רופאת משפחה", "רופא שיניים", "רופאת שיניים", "רכז", "רכזת", "רכז גיוס", "רכזת גיוס", "רכז לוגיסטיקה", "רכזת לוגיסטיקה", "רכז תפעול", "רכזת תפעול", "רתך", "שף", "שפית", "שחקן", "שחקנית", "שמאי", "שמאי רכב", "שף קונדיטור", "שוטר", "שוטרת", "שומר", "שומרת", "שרברב", "תובע", "תובעת", "תזונאי", "תזונאית", "תופר", "תופרת", "תחקירן", "תחקירנית", "תיירן", "תיירנית", "תלמיד", "תלמידה", "עצמאי", "עצמאית", "בעל עסק", "בעלת עסק", "פרילנסר", "פרילנסרית", "לא עובד", "לא עובדת", "מחפש עבודה", "מחפשת עבודה", "פנסיונר", "פנסיונרית", "חייל", "חיילת", "איש קבע", "אשת קבע", "מילואימניק", "מילואימניקית", "מאבטח", "מאבטחת", "סדרן", "סדרנית", "עובד מדינה", "עובדת מדינה", "עובד עירייה", "עובדת עירייה", "עובד מועצה", "עובדת מועצה", "עובד ציבור", "עובדת ציבור", "מנכ\"ל", "מנכ\"לית", "סמנכ\"ל", "סמנכ\"לית", "מנהל מערכות מידע", "מנהלת מערכות מידע", "מנהל חדשנות", "מנהלת חדשנות", "מנהל דיגיטל", "מנהלת דיגיטל", "מנהל פיתוח עסקי", "מנהלת פיתוח עסקי", "מנהל קמפיינים", "מנהלת קמפיינים", "מפתח", "מפתחת", "מפתח תוכנה", "מפתחת תוכנה", "מפתח פול סטאק", "מפתחת פול סטאק", "מפתח בקאנד", "מפתחת בקאנד", "מפתח פרונטאנד", "מפתחת פרונטאנד", "מפתח מובייל", "מפתחת מובייל", "מפתח iOS", "מפתחת iOS", "מפתח Android", "מפתחת Android", "מהנדס נתונים", "מהנדסת נתונים", "מדען נתונים", "מדענית נתונים", "אנליסט נתונים", "אנליסטית נתונים", "מנהל IT", "מנהלת IT", "מומחה ענן", "מומחית ענן", "מומחה סייבר", "מומחית סייבר", "אנליסט סייבר", "אנליסטית סייבר", "חוקר סייבר", "חוקרת סייבר", "בודק חדירות", "בודקת חדירות", "DBA", "ארכיטקט תוכנה", "ארכיטקטית תוכנה", "מוכר", "מוכרת", "מוכר בחנות", "מוכרת בחנות", "מוכר פרונטלי", "מוכרת פרונטלית", "נציג תמיכה", "נציגת תמיכה", "נציג קשרי לקוחות", "נציגת קשרי לקוחות", "נציג שימור", "נציגת שימור", "מוקדן", "מוקדנית", "מוקדן שירות", "מוקדנית שירות", "מוקדן מכירות", "מוקדנית מכירות", "טלר", "טלרית", "מטפל", "מטפלת", "מטפל רגשי", "מטפלת רגשית", "מטפל זוגי", "מטפלת זוגית", "מטפל התנהגותי", "מטפלת התנהגותית", "פסיכותרפיסט", "פסיכותרפיסטית", "עובד סיעוד", "עובדת סיעוד", "מטפל סיעודי", "מטפלת סיעודית", "מלווה רפואי", "מלווה רפואית", "מרפא בעיסוק", "מרפאה בעיסוק", "קלינאי תקשורת", "קלינאית תקשורת", "רנטגנאי", "רנטגנאית", "דיאטן", "דיאטנית", "דיאטן קליני", "דיאטנית קלינית", "סניטר", "סניטרית", "רופא ילדים", "רופאת ילדים", "רופא עור", "רופאת עור", "רופא נשים", "רופאת נשים", "רופא פנימי", "רופאה פנימית", "אורתופד", "אורתופדית", "רדיולוג", "רדיולוגית", "קרדיולוג", "קרדיולוגית", "כירורג", "כירורגית", "רופא שיקום", "רופאת שיקום", "פודיאטור", "פודיאטרית", "גננת", "סייע", "סייעת", "מורה יסודי", "מורה על יסודי", "מורה לתיכון", "מורה לאנגלית", "מורה למתמטיקה", "מורה למדעים", "מורה למוזיקה", "מורה לאמנות", "מורה נהיגה", "מורה לחינוך מיוחד", "יועץ חינוכי", "יועצת חינוכית", "מנהל בית ספר", "מנהלת בית ספר", "ספרן", "ספרנית", "חוקר אקדמי", "חוקרת אקדמית", "בנקאי השקעות", "פקיד אשראי", "פקידת אשראי", "פקיד משכנתאות", "פקידת משכנתאות", "חתם אשראי", "חתמת אשראי", "מנהל סיכונים", "מנהלת סיכונים", "אנליסט אשראי", "אנליסטית אשראי", "יועץ פנסיוני", "יועצת פנסיונית", "שמאי ביטוח", "שמאית ביטוח", "מסלק תביעות", "מסלקת תביעות", "נהג מסחרי", "נהגת מסחרית", "נהג הסעות", "נהגת הסעות", "נהג מנוף", "נהגת מנוף", "מלגזן", "מלגזנית", "מנהל צי רכב", "מנהלת צי רכב", "שליח", "שליחה", "בלדר", "בלדרית", "דוור", "דוורית", "אחראי הפצה", "אחראית הפצה", "מתאם לוגיסטי", "מתאמת לוגיסטית", "מסגר", "מסגרית", "חרט", "חרטת", "רתך CO2", "רתכת CO2", "עובד מפעל", "עובדת מפעל", "מפעיל CNC", "מפעילת CNC", "חרט CNC", "חרטת CNC", "מפעיל לייזר", "מפעילת לייזר", "מפעיל רובוט", "מפעילת רובוט", "מפעיל קו ייצור", "מפעילת קו ייצור", "טכנאי מכשור ובקרה", "טכנאית מכשור ובקרה", "מהנדס ייצור", "מהנדסת ייצור", "מהנדס איכות", "מהנדסת איכות", "מנהל מפעל", "מנהלת מפעל", "מנהל ייצור", "מנהלת ייצור", "אופה", "אופה מקצועי", "אופה מקצועית", "שוקולטייר", "בריסטה", "טבח קו", "טבחית קו", "טבח מוסדי", "טבחית מוסדית", "סו שף", "מנהל מסעדה", "מנהלת מסעדה", "מלצר", "מלצרית", "מארח", "מארחת", "צלם סטילס", "צלמת סטילס", "צלם וידאו", "צלמת וידאו", "במאי", "במאית", "מפיק אירועים", "מפיקה אירועים", "שחקן קול", "שחקנית קול", "מעצב אופנה", "מעצבת אופנה", "סטייליסט", "סטייליסטית", "מאפר", "מאפרת", "מעצב פנים", "מעצבת פנים", "הום סטיילינג", "מקעקע", "מקעקעת", "עובד חקלאות", "עובדת חקלאות", "חקלאי", "חקלאית", "כורם", "כורמת", "רפתן", "רפתנית", "לולן", "לולנית", "מאלף כלבים", "מאלפת כלבים", "ספר כלבים", "ספרית כלבים", "מדריך רכיבה", "מדריכת רכיבה", "עורך דין מסחרי", "עורכת דין מסחרית", "עורך דין נדל\"ן", "עורכת דין נדל\"ן", "עורך דין משפחה", "עורכת דין משפחה", "יועץ משפטי", "יועצת משפטית", "מתמחה במשפטים", "מתמחה משפטית", "נוטריון", "חוקר פרטי", "חוקרת פרטית", "מודד", "מודדת", "שמאי מקרקעין", "שמאית מקרקעין", "סוכן נדל\"ן", "סוכנת נדל\"ן", "מתווך", "מתווכת", "מנהל פרויקטי נדל\"ן", "מנהלת פרויקטי נדל\"ן", "מנהל עבודה בבניין", "מנהלת עבודה בבניין", "מהנדס קונסטרוקציה", "מהנדסת קונסטרוקציה", "רצף", "רצפת", "טייח", "טייחת", "קבלן שיפוצים", "קבלנית שיפוצים", "מפעיל עגורן", "מפעילת עגורן", "מיזוג אוויר", "טכנאי קירור", "טכנאית קירור", "פקיד משרד", "פקידת משרד", "מזכירה בכירה", "מזכיר בכיר", "אדמיניסטרטור", "אדמיניסטרטורית", "רכז אדמיניסטרטיבי", "רכזת אדמיניסטרטיבית", "מזכיר אישי", "מזכירה אישית", "פקיד תפעול", "פקידת תפעול", "בק אופיס", "בק אופיס בכיר", "בק אופיס בכירה", "מקליד נתונים", "מקלידת נתונים", "מזין נתונים", "מזינת נתונים", "קניין", "קניינית", "מנהל סחר", "מנהלת סחר", "מנהל קטגוריה", "מנהלת קטגוריה", "מרצ'נדייזר", "מרצ'נדייזרית", "סדרן סחורה", "סדרנית סחורה", "מתרגם", "מתרגמת", "כתב טכני", "כתבת טכנית", "QA ידני", "QA אוטומציה", "בודק אוטומציה", "בודקת אוטומציה", "עוזר אדמיניסטרציה", "עוזרת אדמיניסטרציה", "עוזר תפעול", "עוזרת תפעול", "עוזר מכירות", "עוזרת מכירות", "עוזר שירות לקוחות", "עוזרת שירות לקוחות", "עוזר שירות", "עוזרת שירות", "עוזר גבייה", "עוזרת גבייה", "עוזר לוגיסטיקה", "עוזרת לוגיסטיקה", "עוזר רכש", "עוזרת רכש", "עוזר יבוא", "עוזרת יבוא", "עוזר יצוא", "עוזרת יצוא", "עוזר הדרכה", "עוזרת הדרכה", "עוזר שיווק", "עוזרת שיווק", "עוזר דיגיטל", "עוזרת דיגיטל", "עוזר גיוס", "עוזרת גיוס", "עוזר משאבי אנוש", "עוזרת משאבי אנוש", "עוזר פיתוח עסקי", "עוזרת פיתוח עסקי", "עוזר איכות", "עוזרת איכות", "עוזר בטיחות", "עוזרת בטיחות", "עוזר אחזקה", "עוזרת אחזקה", "עוזר הפצה", "עוזרת הפצה", "עוזר מלאי", "עוזרת מלאי", "עוזר מחסן", "עוזרת מחסן", "עוזר קליניקה", "עוזרת קליניקה", "עוזר מרפאה", "עוזרת מרפאה", "עוזר מעבדה", "עוזרת מעבדה", "עוזר תביעות", "עוזרת תביעות", "עוזר ביטוח", "עוזרת ביטוח", "עוזר פנסיה", "עוזרת פנסיה", "עוזר משכנתאות", "עוזרת משכנתאות", "עוזר אשראי", "עוזרת אשראי", "עוזר כספים", "עוזרת כספים", "עוזר חשבונות", "עוזרת חשבונות", "עוזר תוכן", "עוזרת תוכן", "עוזר סושיאל", "עוזרת סושיאל", "עוזר פרסום", "עוזרת פרסום", "עוזר מדיה", "עוזרת מדיה", "עוזר IT", "עוזרת IT", "עוזר מערכות מידע", "עוזרת מערכות מידע", "עוזר סייבר", "עוזרת סייבר", "עוזר מידע", "עוזרת מידע", "עוזר פרויקטים", "עוזרת פרויקטים", "עוזר לקוחות", "עוזרת לקוחות", "אחראי אדמיניסטרציה", "אחראית אדמיניסטרציה", "אחראי תפעול", "אחראית תפעול", "אחראי מכירות", "אחראית מכירות", "אחראי שירות לקוחות", "אחראית שירות לקוחות", "אחראי שירות", "אחראית שירות", "אחראי גבייה", "אחראית גבייה", "אחראי לוגיסטיקה", "אחראית לוגיסטיקה", "אחראי רכש", "אחראית רכש", "אחראי יבוא", "אחראית יבוא", "אחראי יצוא", "אחראית יצוא", "אחראי הדרכה", "אחראית הדרכה", "אחראי שיווק", "אחראית שיווק", "אחראי דיגיטל", "אחראית דיגיטל", "אחראי גיוס", "אחראית גיוס", "אחראי משאבי אנוש", "אחראית משאבי אנוש", "אחראי פיתוח עסקי", "אחראית פיתוח עסקי", "אחראי איכות", "אחראית איכות", "אחראי בטיחות", "אחראית בטיחות", "אחראי אחזקה", "אחראית אחזקה", "אחראי מלאי", "אחראית מלאי", "אחראי מחסן", "אחראית מחסן", "אחראי קליניקה", "אחראית קליניקה", "אחראי מרפאה", "אחראית מרפאה", "אחראי מעבדה", "אחראית מעבדה", "אחראי תביעות", "אחראית תביעות", "אחראי ביטוח", "אחראית ביטוח", "אחראי פנסיה", "אחראית פנסיה", "אחראי משכנתאות", "אחראית משכנתאות", "אחראי אשראי", "אחראית אשראי", "אחראי כספים", "אחראית כספים", "אחראי חשבונות", "אחראית חשבונות", "אחראי תוכן", "אחראית תוכן", "אחראי סושיאל", "אחראית סושיאל", "אחראי פרסום", "אחראית פרסום", "אחראי מדיה", "אחראית מדיה", "אחראי IT", "אחראית IT", "אחראי מערכות מידע", "אחראית מערכות מידע", "אחראי סייבר", "אחראית סייבר", "אחראי מידע", "אחראית מידע", "אחראי פרויקטים", "אחראית פרויקטים", "אחראי לקוחות", "אחראית לקוחות", "מנהל אדמיניסטרציה", "מנהלת אדמיניסטרציה", "מנהל מכירות", "מנהלת מכירות", "מנהל שירות לקוחות", "מנהלת שירות לקוחות", "מנהל שירות", "מנהלת שירות", "מנהל גבייה", "מנהלת גבייה", "מנהל לוגיסטיקה", "מנהלת לוגיסטיקה", "מנהל יבוא", "מנהלת יבוא", "מנהל יצוא", "מנהלת יצוא", "מנהל הדרכה", "מנהלת הדרכה", "מנהל שיווק", "מנהלת שיווק", "מנהל גיוס", "מנהלת גיוס", "מנהל משאבי אנוש", "מנהלת משאבי אנוש", "מנהל איכות", "מנהלת איכות", "מנהל בטיחות", "מנהלת בטיחות", "מנהל אחזקה", "מנהלת אחזקה", "מנהל הפצה", "מנהלת הפצה", "מנהל מלאי", "מנהלת מלאי", "מנהל קליניקה", "מנהלת קליניקה", "מנהל מעבדה", "מנהלת מעבדה", "מנהל תביעות", "מנהלת תביעות", "מנהל ביטוח", "מנהלת ביטוח", "מנהל פנסיה", "מנהלת פנסיה", "מנהל משכנתאות", "מנהלת משכנתאות", "מנהל אשראי", "מנהלת אשראי", "מנהל תוכן", "מנהלת תוכן", "מנהל סושיאל", "מנהלת סושיאל", "מנהל פרסום", "מנהלת פרסום", "מנהל מדיה", "מנהלת מדיה", "מנהל סייבר", "מנהלת סייבר", "מנהל מידע", "מנהלת מידע", "מנהל פרויקטים", "מנהלת פרויקטים", "רכז אדמיניסטרציה", "רכזת אדמיניסטרציה", "רכז מכירות", "רכזת מכירות", "רכז שירות לקוחות", "רכזת שירות לקוחות", "רכז שירות", "רכזת שירות", "רכז גבייה", "רכזת גבייה", "רכז רכש", "רכזת רכש", "רכז יבוא", "רכזת יבוא", "רכז יצוא", "רכזת יצוא", "רכז הדרכה", "רכזת הדרכה", "רכז שיווק", "רכזת שיווק", "רכז דיגיטל", "רכזת דיגיטל", "רכז משאבי אנוש", "רכזת משאבי אנוש", "רכז פיתוח עסקי", "רכזת פיתוח עסקי", "רכז איכות", "רכזת איכות", "רכז בטיחות", "רכזת בטיחות", "רכז אחזקה", "רכזת אחזקה", "רכז הפצה", "רכזת הפצה", "רכז מלאי", "רכזת מלאי", "רכז מחסן", "רכזת מחסן", "רכז קליניקה", "רכזת קליניקה", "רכז מרפאה", "רכזת מרפאה", "רכז מעבדה", "רכזת מעבדה", "רכז תביעות", "רכזת תביעות", "רכז ביטוח", "רכזת ביטוח", "רכז פנסיה", "רכזת פנסיה", "רכז משכנתאות", "רכזת משכנתאות", "רכז אשראי", "רכזת אשראי", "רכז כספים", "רכזת כספים", "רכז חשבונות", "רכזת חשבונות", "רכז תוכן", "רכזת תוכן", "רכז סושיאל", "רכזת סושיאל", "רכז פרסום", "רכזת פרסום", "רכז מדיה", "רכזת מדיה", "רכז IT", "רכזת IT", "רכז מערכות מידע", "רכזת מערכות מידע", "רכז סייבר", "רכזת סייבר", "רכז מידע", "רכזת מידע", "רכז פרויקטים", "רכזת פרויקטים", "רכז לקוחות", "רכזת לקוחות", "מתאם אדמיניסטרציה", "מתאמת אדמיניסטרציה", "מתאם תפעול", "מתאמת תפעול", "מתאם מכירות", "מתאמת מכירות", "מתאם שירות לקוחות", "מתאמת שירות לקוחות", "מתאם שירות", "מתאמת שירות", "מתאם גבייה", "מתאמת גבייה", "מתאם לוגיסטיקה", "מתאמת לוגיסטיקה", "מתאם רכש", "מתאמת רכש", "מתאם יבוא", "מתאמת יבוא", "מתאם יצוא", "מתאמת יצוא", "מתאם הדרכה", "מתאמת הדרכה", "מתאם שיווק", "מתאמת שיווק", "מתאם דיגיטל", "מתאמת דיגיטל", "מתאם גיוס", "מתאמת גיוס", "מתאם משאבי אנוש", "מתאמת משאבי אנוש", "מתאם פיתוח עסקי", "מתאמת פיתוח עסקי", "מתאם איכות", "מתאמת איכות", "מתאם בטיחות", "מתאמת בטיחות", "מתאם אחזקה", "מתאמת אחזקה", "מתאם הפצה", "מתאמת הפצה", "מתאם מלאי", "מתאמת מלאי", "מתאם מחסן", "מתאמת מחסן", "מתאם קליניקה", "מתאמת קליניקה", "מתאם מרפאה", "מתאמת מרפאה", "מתאם מעבדה", "מתאמת מעבדה", "מתאם תביעות", "מתאמת תביעות", "מתאם ביטוח", "מתאמת ביטוח", "מתאם פנסיה", "מתאמת פנסיה", "מתאם משכנתאות", "מתאמת משכנתאות", "מתאם אשראי", "מתאמת אשראי", "מתאם כספים", "מתאמת כספים", "מתאם חשבונות", "מתאמת חשבונות", "מתאם תוכן", "מתאמת תוכן", "מתאם סושיאל", "מתאמת סושיאל", "מתאם פרסום", "מתאמת פרסום", "מתאם מדיה", "מתאמת מדיה", "מתאם IT", "מתאמת IT", "מתאם מערכות מידע", "מתאמת מערכות מידע", "מתאם סייבר", "מתאמת סייבר", "מתאם מידע", "מתאמת מידע", "מתאם פרויקטים", "מתאמת פרויקטים", "מתאם לקוחות", "מתאמת לקוחות", "מומחה אדמיניסטרציה", "מומחית אדמיניסטרציה", "מומחה תפעול", "מומחית תפעול", "מומחה מכירות", "מומחית מכירות", "מומחה שירות לקוחות", "מומחית שירות לקוחות", "מומחה שירות", "מומחית שירות", "מומחה גבייה", "מומחית גבייה", "מומחה לוגיסטיקה", "מומחית לוגיסטיקה", "מומחה רכש", "מומחית רכש", "מומחה יבוא", "מומחית יבוא", "מומחה יצוא", "מומחית יצוא", "מומחה הדרכה", "מומחית הדרכה", "מומחה שיווק", "מומחית שיווק", "מומחה דיגיטל", "מומחית דיגיטל", "מומחה גיוס", "מומחית גיוס", "מומחה משאבי אנוש", "מומחית משאבי אנוש", "מומחה פיתוח עסקי", "מומחית פיתוח עסקי", "מומחה איכות", "מומחית איכות", "מומחה בטיחות", "מומחית בטיחות", "מומחה אחזקה", "מומחית אחזקה", "מומחה הפצה", "מומחית הפצה", "מומחה מלאי", "מומחית מלאי", "מומחה מחסן", "מומחית מחסן", "מומחה קליניקה", "מומחית קליניקה", "מומחה מרפאה", "מומחית מרפאה", "מומחה מעבדה", "מומחית מעבדה", "מומחה תביעות", "מומחית תביעות", "מומחה ביטוח", "מומחית ביטוח", "מומחה פנסיה", "מומחית פנסיה", "מומחה משכנתאות", "מומחית משכנתאות", "מומחה אשראי", "מומחית אשראי", "מומחה כספים", "מומחית כספים", "מומחה חשבונות", "מומחית חשבונות", "מומחה תוכן", "מומחית תוכן", "מומחה סושיאל", "מומחית סושיאל", "מומחה פרסום", "מומחית פרסום", "מומחה מדיה", "מומחית מדיה", "מומחה IT", "מומחית IT", "מומחה מערכות מידע", "מומחית מערכות מידע", "מומחה מידע", "מומחית מידע", "מומחה פרויקטים", "מומחית פרויקטים", "מומחה לקוחות", "מומחית לקוחות", "יועץ אדמיניסטרציה", "יועצת אדמיניסטרציה", "יועץ תפעול", "יועצת תפעול", "יועץ מכירות", "יועצת מכירות", "יועץ שירות לקוחות", "יועצת שירות לקוחות", "יועץ שירות", "יועצת שירות", "יועץ גבייה", "יועצת גבייה", "יועץ לוגיסטיקה", "יועצת לוגיסטיקה", "יועץ רכש", "יועצת רכש", "יועץ יבוא", "יועצת יבוא", "יועץ יצוא", "יועצת יצוא", "יועץ הדרכה", "יועצת הדרכה", "יועץ שיווק", "יועצת שיווק", "יועץ דיגיטל", "יועצת דיגיטל", "יועץ גיוס", "יועצת גיוס", "יועץ משאבי אנוש", "יועצת משאבי אנוש", "יועץ פיתוח עסקי", "יועצת פיתוח עסקי", "יועץ איכות", "יועצת איכות", "יועץ בטיחות", "יועצת בטיחות", "יועץ אחזקה", "יועצת אחזקה", "יועץ הפצה", "יועצת הפצה", "יועץ מלאי", "יועצת מלאי", "יועץ מחסן", "יועצת מחסן", "יועץ קליניקה", "יועצת קליניקה", "יועץ מרפאה", "יועצת מרפאה", "יועץ מעבדה", "יועצת מעבדה", "יועץ תביעות", "יועצת תביעות", "יועץ פנסיה", "יועצת פנסיה", "יועץ משכנתאות", "יועצת משכנתאות", "יועץ אשראי", "יועצת אשראי", "יועץ כספים", "יועצת כספים", "יועץ חשבונות", "יועצת חשבונות", "יועץ תוכן", "יועצת תוכן", "יועץ סושיאל", "יועצת סושיאל", "יועץ פרסום", "יועצת פרסום", "יועץ מדיה", "יועצת מדיה", "יועץ IT", "יועצת IT", "יועץ מערכות מידע", "יועצת מערכות מידע", "יועץ סייבר", "יועצת סייבר", "יועץ מידע", "יועצת מידע", "יועץ פרויקטים", "יועצת פרויקטים", "יועץ לקוחות", "יועצת לקוחות", "מדריך אדמיניסטרציה", "מדריכה אדמיניסטרציה", "מדריך תפעול", "מדריכה תפעול", "מדריך מכירות", "מדריכה מכירות", "מדריך שירות לקוחות", "מדריכה שירות לקוחות", "מדריך שירות", "מדריכה שירות", "מדריך גבייה", "מדריכה גבייה", "מדריך לוגיסטיקה", "מדריכה לוגיסטיקה", "מדריך רכש", "מדריכה רכש", "מדריך יבוא", "מדריכה יבוא", "מדריך יצוא", "מדריכה יצוא", "מדריך הדרכה", "מדריכה הדרכה", "מדריך שיווק", "מדריכה שיווק", "מדריך דיגיטל", "מדריכה דיגיטל", "מדריך גיוס", "מדריכה גיוס", "מדריך משאבי אנוש", "מדריכה משאבי אנוש", "מדריך פיתוח עסקי", "מדריכה פיתוח עסקי", "מדריך איכות", "מדריכה איכות", "מדריך בטיחות", "מדריכה בטיחות", "מדריך אחזקה", "מדריכה אחזקה", "מדריך הפצה", "מדריכה הפצה", "מדריך מלאי", "מדריכה מלאי", "מדריך מחסן", "מדריכה מחסן", "מדריך קליניקה", "מדריכה קליניקה", "מדריך מרפאה", "מדריכה מרפאה", "מדריך מעבדה", "מדריכה מעבדה", "מדריך תביעות", "מדריכה תביעות", "מדריך ביטוח", "מדריכה ביטוח", "מדריך פנסיה", "מדריכה פנסיה", "מדריך משכנתאות", "מדריכה משכנתאות", "מדריך אשראי", "מדריכה אשראי", "מדריך כספים", "מדריכה כספים", "מדריך חשבונות", "מדריכה חשבונות", "מדריך תוכן", "מדריכה תוכן", "מדריך סושיאל", "מדריכה סושיאל", "מדריך פרסום", "מדריכה פרסום", "מדריך מדיה", "מדריכה מדיה", "מדריך IT", "מדריכה IT", "מדריך מערכות מידע", "מדריכה מערכות מידע", "מדריך סייבר", "מדריכה סייבר", "מדריך מידע", "מדריכה מידע", "מדריך פרויקטים", "מדריכה פרויקטים", "מדריך לקוחות", "מדריכה לקוחות"
    ],
    companies: ["איילון","הראל","כלל","מגדל","מנורה","הפניקס","הכשרה","מדיקר"],
    // חברות שמופיעות רק בשלב "פוליסות קיימות"
    existingCompanies: ["איילון","הראל","כלל","מגדל","מנורה","הפניקס","הכשרה","AIG","ביטוח ישיר","9 מיליון"],

    insTypes: ["בריאות","מחלות קשות","סרטן","תאונות אישיות","ריסק","ריסק משכנתא"],
    bankNames: ["בנק הפועלים","בנק לאומי","בנק דיסקונט","בנק מזרחי-טפחות","הבנק הבינלאומי","בנק מרכנתיל","בנק ירושלים","בנק יהב","בנק מסד","פאג\"י","דואר ישראל","אחר"],

    
    bankAgencies: ["סוכנות מעלות - בנק לאומי","סוכנות פועלים - בנק הפועלים","סוכנות מזרחי טפחות - בנק מזרחי-טפחות","סוכנות עיר שלם - בנק ירושלים","סוכנות דיסקונט - בנק דיסקונט"],

    // כיסויי בריאות (לשלב 3 — פוליסות קיימות)
    healthCovers: [
      { k:"ניתוחים בארץ", sub:"בחירת מנתח/בי\"ח פרטי (לפי תנאי הפוליסה)" },
      { k:"ניתוחים בחו\"ל", sub:"כיסוי ניתוחים וטיפולים בחו\"ל" },
      { k:"השתלות", sub:"כיסוי השתלות וטיפולים מצילי חיים" },
      { k:"תרופות מחוץ לסל", sub:"תרופות שאינן בסל הבריאות" },
      { k:"אמבולטורי", sub:"בדיקות, טיפולים ושירותים ללא אשפוז" },
      { k:"ייעוץ מומחים", sub:"התייעצות עם מומחים ושירותי רופא" },
      { k:"רפואה משלימה", sub:"טיפולים משלימים (דיקור, כירופרקטיקה וכו’)" },
      { k:"בדיקות מתקדמות", sub:"MRI/CT/בדיקות יקרות (לפי תנאי הפוליסה)" },
      { k:"כתב שירות", sub:"שירותי רפואה/תורים/אבחונים (לפי כתב השירות)" }
    ],
init(){
      this.els.wrap = $("#lcWizard");
      if(!this.els.wrap) return;

      this.els.btnOpen = $("#btnNewCustomerWizard");
      this.els.btnClose = $("#lcWizardClose");
      this.els.body = $("#lcWizardBody");
      this.els.steps = $("#lcSteps");
      this.els.fill = $("#lcProgressFill");
      this.els.tabs = $("#lcInsTabs");
      this.els.btnAddIns = $("#lcAddInsuredBtn");
      this.els.hint = $("#lcWizardHint");
      this.els.btnPrev = $("#lcPrevStep");
      this.els.btnNext = $("#lcNextStep");
      this.els.btnSaveDraft = $("#lcSaveDraft");

      // picker
      this.els.picker = $("#lcInsPicker");
      this.els.pickerClose = $("#lcInsPickerClose");

      on(this.els.btnOpen, "click", () => {
        if(!Auth.current) return;
        this.reset();
        this.open();
      });

      on(this.els.btnClose, "click", () => this.close());
      on(this.els.wrap, "click", (e) => {
        const t = e.target;
        if(t && t.getAttribute && t.getAttribute("data-close") === "1") this.close();
      });

      on(this.els.btnAddIns, "click", () => this.openPicker());
      on(this.els.pickerClose, "click", () => this.closePicker());
      on(this.els.picker, "click", (e) => {
        const t = e.target;
        if(t && t.getAttribute && t.getAttribute("data-close") === "1") this.closePicker();
        if(t && t.matches && t.matches("[data-ins-type]")){
          const typ = t.getAttribute("data-ins-type");
          this.addInsured(typ);
          this.closePicker();
        }
      });

      on(this.els.btnPrev, "click", () => this.prevStep());
      on(this.els.btnNext, "click", () => this.nextStep());
      on(this.els.btnSaveDraft, "click", () => this.saveDraft());


      // report + finish flow
      this.els.report = $("#lcReport");
      this.els.reportBody = $("#lcReportBody");
      this.els.reportClose = $("#lcReportClose");
      this.els.reportPrint = $("#lcReportPrint");
      this.els.flow = $("#lcFlow");
      this.els.flowLoading = $("#lcFlowLoading");
      this.els.flowSuccess = $("#lcFlowSuccess");
      this.els.flowProgress = $("#lcFlowProgress");
      this.els.btnOpenCustomerFile = $("#lcOpenCustomerFile");
      this.els.btnSendToOps = $("#lcSendToOps");
      this.els.btnDownloadOpsFile = $("#lcDownloadOpsFile");
      this.els.btnBackToDashboard = $("#lcBackToDashboard");

      on(this.els.reportClose, "click", () => this.closeOperationalReport());
      on(this.els.reportPrint, "click", () => this.exportOperationalPdf());
      on(this.els.report, "click", (e) => {
        const t = e.target;
        if(t && t.getAttribute && t.getAttribute("data-close") === "1") this.closeOperationalReport();
      });
      on(this.els.btnOpenCustomerFile, "click", () => {
        const customerId = this.lastSavedCustomerId;
        this.hideFinishFlow();
        this.close();
        UI.goView("customers");
        if(customerId) setTimeout(() => CustomersUI.openByIdWithLoader(customerId, 1080), 80);
      });
      on(this.els.btnSendToOps, "click", () => {
        this.hideFinishFlow();
        this.openOperationalReport();
      });
      on(this.els.btnDownloadOpsFile, "click", () => this.exportOperationalPdf());
      on(this.els.btnBackToDashboard, "click", () => {
        this.hideFinishFlow();
        this.close();
        UI.goView("dashboard");
      });

      // covers drawer (Step 3 - Health only)
      this.els.coversDrawer = $("#lcCoversDrawer");
      this.els.coversDrawerBackdrop = $("#lcCoversDrawerBackdrop");
      this.els.coversDrawerClose = $("#lcCoversDrawerClose");
      this.els.coversDrawerTitle = $("#lcCoversDrawerTitle");
      this.els.coversHint = this.els.coversDrawer?.querySelector?.(".lcCoversHint") || null;
      this.els.coversList = $("#lcCoversList");
      this.els.coversSave = $("#lcCoversSave");
      this.els.coversCancel = $("#lcCoversCancel");
      this._coversCtx = null; // { kind, insId?, policyId? }

      on(this.els.coversDrawerBackdrop, "click", () => this.closeCoversDrawer());
      on(this.els.coversDrawerClose, "click", () => this.closeCoversDrawer());
      on(this.els.coversCancel, "click", () => this.closeCoversDrawer());
      on(this.els.coversSave, "click", () => this.saveCoversDrawer());

      // base insured
      this.reset();
    },

    reset(){
      const make = (type, label) => ({
        id: "ins_" + Math.random().toString(16).slice(2),
        type,
        label,
        data: {
          // step1
          firstName:"", lastName:"", idNumber:"",
          birthDate:"", gender:"",
          maritalStatus:"",
          phone:"", email:"",
          city:"", street:"", houseNumber:"", zip:"",
          clinic:"", shaban:"", occupation:"",
          // step2
          heightCm:"", weightKg:"", bmi:null,
          // policies
          existingPolicies: [],
          cancellations: {}, // by policyId
          newPolicies: [],
          // payer
          payerChoice:"insured", // insured/external
          externalPayer: { relation:"", firstName:"", lastName:"", idNumber:"", birthDate:"", phone:"" },
          payAll:true,
          policyPayers: {}, // policyId -> payerId/external
          paymentMethod:"cc", // cc/ho
          cc: { holderName:"", holderId:"", cardNumber:"", exp:"" },
          ho: { account:"", branch:"", bankName:"", bankNo:"" },
          healthDeclaration: { categories:{} }
        }
      });

      this.insureds = [ make("primary","מבוטח ראשי") ];
      this.activeInsId = this.insureds[0].id;
      // Step5 (new policies) is global for the case, not per-insured
      this.newPolicies = [];
      this.policyDraft = null;
      this.editingPolicyId = null;

      this.step = 1;
      this.step1FlowMap = {};
      this.lastSavedCustomerId = null;
      this.editingDraftId = null;
      this._finishing = false;
      this.render();
    },

    open(){
      this.isOpen = true;
      this.els.wrap.classList.add("is-open");
      this.els.wrap.setAttribute("aria-hidden","false");
      document.body.style.overflow = "hidden";
      this.render();
      setTimeout(() => {
        const first = this.els.body?.querySelector?.("input,select,textarea,button");
        first?.focus?.();
      }, 50);
    },

    close(){
      this.isOpen = false;
      this.els.wrap.classList.remove("is-open");
      this.els.wrap.setAttribute("aria-hidden","true");
      document.body.style.overflow = "";
      this.closePicker();
    },

    openPicker(){
      if(!this.els.picker) return;
      this.els.picker.classList.add("is-open");
      this.els.picker.setAttribute("aria-hidden","false");
    },
    closePicker(){
      if(!this.els.picker) return;
      this.els.picker.classList.remove("is-open");
      this.els.picker.setAttribute("aria-hidden","true");
    },


    // ===== Health Covers Drawer (Step 3) =====
    _findInsuredById(id){
      return (this.insureds || []).find(x => String(x.id) === String(id)) || null;
    },

    _findExistingPolicy(ins, pid){
      const list = ins?.data?.existingPolicies || [];
      return list.find(x => String(x.id) === String(pid)) || null;
    },

    getHealthCoverList(obj){
      if(Array.isArray(obj?.healthCovers)) return obj.healthCovers.filter(Boolean);
      if(Array.isArray(obj?.covers)) return obj.covers.filter(Boolean);
      return [];
    },

    summarizeHealthCovers(list, opts={}){
      const arr = Array.isArray(list) ? list.filter(Boolean) : [];
      const max = Number(opts.max || 2);
      const emptyLabel = safeTrim(opts.emptyLabel) || "טרם נבחרו כיסויים";
      if(!arr.length) return emptyLabel;
      if(arr.length <= max) return arr.join(" · ");
      return `${arr.slice(0, max).join(" · ")} +${arr.length - max}`;
    },

    openCoversDrawer(ins, pid){
      const pol = this._findExistingPolicy(ins, pid);
      if(!pol) return;
      if(pol.type !== "בריאות") return;
      if(!Array.isArray(pol.covers)) pol.covers = [];

      this._coversCtx = { kind: "existing", insId: ins.id, policyId: pid };
      this.renderCoversDrawer(pol, {
        title: "בחירת כיסויי בריאות",
        hint: "סמן את הכיסויים הרלוונטיים לפוליסה."
      });

      if(this.els.coversDrawer){
        this.els.coversDrawer.classList.add("is-open");
        this.els.coversDrawer.setAttribute("aria-hidden","false");
      }
    },

    openNewPolicyCoversDrawer(){
      this.ensurePolicyDraft();
      const d = this.policyDraft || {};
      if(d.type !== "בריאות") return;
      if(!Array.isArray(d.healthCovers)) d.healthCovers = [];
      this._coversCtx = { kind: "newDraft" };
      this.renderCoversDrawer(d, {
        title: "כיסויי בריאות — פוליסה חדשה",
        hint: "סמן את הכיסויים שהלקוח רכש ולחץ אישור כיסויים."
      });

      if(this.els.coversDrawer){
        this.els.coversDrawer.classList.add("is-open");
        this.els.coversDrawer.setAttribute("aria-hidden","false");
      }
    },

    closeCoversDrawer(){
      this._coversCtx = null;
      if(this.els.coversDrawer){
        this.els.coversDrawer.classList.remove("is-open");
        this.els.coversDrawer.setAttribute("aria-hidden","true");
      }
    },

    renderCoversDrawer(pol, opts={}){
      if(!this.els.coversList) return;
      const selected = new Set(this.getHealthCoverList(pol));
      if(this.els.coversDrawerTitle) this.els.coversDrawerTitle.textContent = String(opts.title || "בחירת כיסויי בריאות");
      if(this.els.coversHint) this.els.coversHint.textContent = String(opts.hint || "סמן את הכיסויים הרלוונטיים לפוליסה.");
      if(this.els.coversSave) this.els.coversSave.textContent = "אישור כיסויים";
      const items = (this.healthCovers || []).map(c => {
        const key = String(c?.k || "");
        const sub = String(c?.sub || "");
        const checked = selected.has(key) ? "checked" : "";
        return `
          <label class="lcCoverItem">
            <input type="checkbox" value="${escapeHtml(key)}" ${checked} />
            <span class="lcCoverItem__main">
              <span class="lcCoverItem__title">${escapeHtml(key)}</span>
              ${sub ? `<span class="lcCoverItem__sub">${escapeHtml(sub)}</span>` : ""}
            </span>
          </label>
        `;
      }).join("");
      this.els.coversList.innerHTML = items || `<div class="muted">אין כיסויים להצגה</div>`;

      setTimeout(() => {
        const first = this.els.coversList?.querySelector?.('input[type="checkbox"]');
        first?.focus?.();
      }, 20);
    },

    saveCoversDrawer(){
      try{
        const ctx = this._coversCtx;
        if(!ctx) return this.closeCoversDrawer();

        const chosen = [];
        this.els.coversList?.querySelectorAll?.('input[type="checkbox"]')?.forEach?.(cb => {
          if(cb.checked) chosen.push(String(cb.value || "").trim());
        });
        const filtered = chosen.filter(Boolean);

        if(ctx.kind === "newDraft"){
          this.ensurePolicyDraft();
          if(this.policyDraft) this.policyDraft.healthCovers = filtered;
          this.closeCoversDrawer();
          this.render();
          this.setHint(filtered.length ? ("נשמרו " + filtered.length + " כיסויים לפוליסת הבריאות") : "לא נבחרו כיסויים לפוליסת הבריאות");
          return;
        }

        const ins = this._findInsuredById(ctx.insId);
        if(!ins) return this.closeCoversDrawer();
        const pol = this._findExistingPolicy(ins, ctx.policyId);
        if(!pol) return this.closeCoversDrawer();
        if(pol.type !== "בריאות") return this.closeCoversDrawer();

        pol.covers = filtered;

        this.closeCoversDrawer();
        this.render();
        this.setHint(pol.covers.length ? ("נשמרו " + pol.covers.length + " כיסויים") : "לא נבחרו כיסויים");
      }catch(_e){
        this.closeCoversDrawer();
      }
    },

    addInsured(type){
      // Allow adding insured only in step 1 (פרטי לקוח)
      if (this.step !== 1) {
        this.setHint("ניתן להוסיף מבוטח רק בשלב פרטי לקוח");
        return;
      }
      const has = (t) => this.insureds.some(x => x.type === t);
      if(type === "spouse" && has("spouse")) return this.setHint("בן/בת זוג כבר קיים/ת");
      const label = (type === "spouse") ? "בן/בת זוג" : (type === "adult") ? "בגיר" : "קטין";
      const ins = {
        id: "ins_" + Math.random().toString(16).slice(2),
        type,
        label,
        data: JSON.parse(JSON.stringify(this.insureds[0].data)) // shallow baseline copy
      };
      // reset fields that must be entered
      ins.data.firstName = "";
      ins.data.lastName = "";
      ins.data.idNumber = "";
      ins.data.birthDate = "";
      ins.data.gender = "";
      ins.data.maritalStatus = "";
      ins.data.clinic = "";
      ins.data.shaban = "";
      ins.data.occupation = "";
      ins.data.heightCm = "";
      ins.data.weightKg = "";
      ins.data.bmi = null;
      ins.data.existingPolicies = [];
      ins.data.cancellations = {};
      ins.data.newPolicies = [];
      // child inherits contact/address from primary later in render/validate
      this.insureds.push(ins);
      this.activeInsId = ins.id;
      this.render();
      this.setHint("נוסף: " + label);
    },

    removeInsured(id){
      const idx = this.insureds.findIndex(x => x.id === id);
      if(idx <= 0) return; // cannot remove primary
      const removed = this.insureds[idx];
      this.insureds.splice(idx,1);
      if(this.activeInsId === id) this.activeInsId = this.insureds[0]?.id || null;
      this.render();
      this.setHint("הוסר: " + (removed?.label || "מבוטח"));
    },

    setActive(id){
      this.activeInsId = id;
      if(!this.step1FlowMap) this.step1FlowMap = {};
      if(this.step === 1 && this.step1FlowMap[id] === undefined) this.step1FlowMap[id] = 0;
      this.render();
    },

    prevStep(){
      if(this.step === 1){
        const ins = this.getActive();
        const idx = this.getStep1FlowIndex(ins);
        if(idx > 0){
          this.setStep1FlowIndex(ins, idx - 1);
          this.setHint("");
          this.render();
          this.focusStep1QuestionSoon();
          return;
        }
      }
      if(this.step <= 1) return;
      const fromStep = this.step;
      this.step -= 1;
      this.handleStepEntry(fromStep, this.step);
      this.render();
    },

    nextStep(){
      if(this.step === 1){
        const ins = this.getActive();
        const questions = this.getStep1Questions(ins);
        const idx = this.getStep1FlowIndex(ins);
        const current = questions[idx];
        if(current && !this.isStep1QuestionComplete(ins, current)){
          this.setHint(current.requiredMsg || "נא להשלים את השדה לפני שממשיכים");
          this.focusStep1QuestionSoon();
          return;
        }
        if(idx < (questions.length - 1)){
          this.setStep1FlowIndex(ins, idx + 1);
          this.setHint("");
          this.render();
          this.focusStep1QuestionSoon();
          return;
        }
      }
      const v = this.validateStep(this.step);
      if(!v.ok){
        this.setHint(v.msg || "נא להשלים את כל החובה בכל המבוטחים");
        return;
      }
      if(this.step >= this.steps.length){
        this.finishWizard();
        return;
      }
      const fromStep = this.step;
      this.step += 1;
      this.handleStepEntry(fromStep, this.step);
      this.setHint("");
      this.render();
    },

    handleStepEntry(fromStep, toStep){
      if(Number(toStep) !== 8 || Number(fromStep) === 8) return;
      const store = this.getHealthStore();
      const list = this.getHealthQuestionList();
      store.ui = store.ui || { currentIndex: 0, summary: false };
      store.ui.summary = false;
      const maxIndex = Math.max(0, list.length - 1);
      const currentIndex = Number(store.ui.currentIndex || 0);
      store.ui.currentIndex = Math.max(0, Math.min(maxIndex, currentIndex));
    },

    setHint(msg){ if(this.els.hint) this.els.hint.textContent = msg ? String(msg) : ""; },

    getActive(){
      return this.insureds.find(x => x.id === this.activeInsId) || this.insureds[0];
    },

    // ---------- Rendering ----------
    render(){
      if(!this.els.wrap) return;
      this.renderSteps();
      this.renderTabs();
      // Show "Add insured" button only on step 1
      if (this.els.btnAddIns) {
        this.els.btnAddIns.style.display = (this.step === 1) ? "" : "none";
      }
      this.renderBody();
      this.renderFooter();
    },

    renderSteps(){
      if(!this.els.steps) return;
      const doneUpTo = this.step - 1;
      this.els.steps.innerHTML = this.steps.map(s => {
        const cls = [
          "lcStep",
          (s.id === this.step) ? "is-active" : "",
          (s.id <= doneUpTo) ? "is-done" : ""
        ].join(" ").trim();
        return `<div class="${cls}" data-step="${s.id}">
          <span class="lcStep__num">${s.id}</span>
          <span>${escapeHtml(s.title)}</span>
        </div>`;
      }).join("");

      // click to jump back only
      $$(".lcStep", this.els.steps).forEach(el => {
        on(el, "click", () => {
          const st = Number(el.getAttribute("data-step") || "1");
          if(st <= this.step) {
            const fromStep = this.step;
            this.step = st;
            this.handleStepEntry(fromStep, st);
            this.render();
          }
        });
      });

      // progress fill
      if(this.els.fill){
        const pct = Math.round(((this.step-1) / (this.steps.length-1)) * 100);
        this.els.fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
      }
    },

    renderTabs(){
      if(!this.els.tabs) return;
      // Steps 5+ are case-level (not per-insured), so hide insured tabs
      if(this.step >= 5){
        this.els.tabs.innerHTML = "";
        this.els.tabs.style.display = "none";
        return;
      }
      this.els.tabs.style.display = "";
      const stepOkMap = this.stepCompletionMap(this.step);

      this.els.tabs.innerHTML = this.insureds.map(ins => {
        const isActive = ins.id === this.activeInsId;
        const ok = stepOkMap[ins.id] === true;
        const badgeCls = ok ? "ok" : "warn";
        const cls = "lcTab" + (isActive ? " is-active" : "");
        const removeBtn = (ins.type !== "primary") ? `<span class="lcDangerLink" data-remove="${ins.id}" title="הסר">✕</span>` : "";
        return `<div class="${cls}" data-ins="${ins.id}">
          <span class="lcTab__badge ${badgeCls}" aria-hidden="true"></span>
          <span>${escapeHtml(ins.label)}</span>
          ${removeBtn}
        </div>`;
      }).join("");

      $$(".lcTab", this.els.tabs).forEach(t => {
        on(t, "click", (e) => {
          const rm = e.target && e.target.getAttribute && e.target.getAttribute("data-remove");
          if(rm){ this.removeInsured(rm); return; }
          const id = t.getAttribute("data-ins");
          if(id) this.setActive(id);
        });
      });
    },

    renderFooter(){
      if(this.els.btnPrev) this.els.btnPrev.disabled = (this.step <= 1);
      if(this.els.btnNext) this.els.btnNext.disabled = false;

      if(this.step === 1){
        const ins = this.getActive();
        const questions = this.getStep1Questions(ins);
        const idx = this.getStep1FlowIndex(ins);
        if(this.els.btnPrev) this.els.btnPrev.disabled = (idx <= 0);
        if(this.els.btnNext) this.els.btnNext.textContent = (idx >= questions.length - 1) ? "לשלב הבא" : "לשאלה הבאה";
        return;
      }

      if(this.els.btnNext) this.els.btnNext.textContent = (this.step >= this.steps.length) ? "סיום הקמת לקוח" : "הבא";
    },

    renderBody(){
      if(!this.els.body) return;
      const ins = this.getActive();
      const stepTitle = this.steps.find(s => s.id === this.step)?.title || "";
      const isCaseLevel = (this.step >= 5);
      const addBtn = (this.step === 3) ? `<button class="btn" id="lcAddExistingPolicy" type="button">➕ הוסף פוליסה</button>` : "";
      const head = (this.step === 1 || this.step === 5) ? "" : (isCaseLevel ? `<div class="lcWSection">
        <div class="row row--between">
          <div>
            <div class="lcWTitle">${escapeHtml(stepTitle)}</div>
            <div class="muted small">.</div>
          </div>
        </div>
      </div>` : `<div class="lcWSection">
        <div class="row row--between">
          <div>
            <div class="lcWTitle">${escapeHtml(stepTitle)} · ${escapeHtml(ins.label)}</div>
          </div>
          ${addBtn}
        </div>
      </div>`);

      let body = "";
      if(this.step === 1) body = this.renderStep1(ins);
      else if(this.step === 2) body = this.renderStep2(ins);
      else if(this.step === 3) body = this.renderStep3(ins);
      else if(this.step === 4) body = this.renderStep4(ins);
      else if(this.step === 5) body = this.renderStep5();
      else if(this.step === 6) body = this.renderStep6(this.insureds[0]);
      else if(this.step === 7) body = this.renderStep7();
      else body = this.renderStep8();

      this.els.body.innerHTML = head + body;

      // bind generic input handlers
      if(this.step < 5) this.bindInputs(ins);
      else if(this.step === 6) this.bindInputs(this.insureds[0]);
      else if(this.step === 8) this.bindHealthInputs();
    },

    bindInputs(ins){
      // any element with data-bind="path"
      $$("[data-bind]", this.els.body).forEach(el => {
        const path = el.getAttribute("data-bind");
        if(!path) return;
        const setVal = (doRender=false) => {
          let v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
          if(el.getAttribute && el.getAttribute("data-money")==="ils"){
            const raw = String(v||"").replace(/[₪,\s]/g,"");
            let cleaned = raw.replace(/[^0-9.]/g,"");
            const parts = cleaned.split(".");
            if(parts.length>2) cleaned = parts[0] + "." + parts.slice(1).join("");
            const [i,f] = cleaned.split(".");
            const ii = (i||"").replace(/^0+(?=\d)/,"");
            const withCommas = ii.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            const formatted = (f!==undefined) ? (withCommas + "." + f) : withCommas;
            if(el.value !== formatted) el.value = formatted;
            v = cleaned;
          }
          this.setPath(ins.data, path, v);
          // special: step1 clinic -> shaban options reset
          if(path === "clinic"){
            if(!ins.data.clinic) ins.data.shaban = "";
            else if(!this.shabanMap[ins.data.clinic]?.includes(ins.data.shaban)) ins.data.shaban = "אין שב״ן";
            this.render(); // rerender to refresh selects
            return;
          }
          
if(path === "birthDate"){
  // dd/mm/yyyy typing (no re-render on partial typing; re-render only when full)
  if(el.getAttribute("data-datefmt") === "dmy"){
    const digits = String(el.value||"").replace(/[^\d]/g, "").slice(0, 8);
    let out = digits;
    if(out.length > 2) out = out.slice(0,2) + "/" + out.slice(2);
    if(out.length > 5) out = out.slice(0,5) + "/" + out.slice(5);
    if(el.value !== out) el.value = out;
    this.setPath(ins.data, path, out);
  }
  const val = String(ins.data.birthDate||"");
  const full = /^\d{4}-\d{2}-\d{2}$/.test(val) || /^\d{2}\/\d{2}\/\d{4}$/.test(val);
  if(doRender || full) this.render();
  return;
}
          if(path === "heightCm" || path === "weightKg"){
            this.calcBmi(ins);
            this.render(); // update BMI widget
            return;
          }
          if(path.endsWith(".bankAgency")){
            this.render();
            return;
          }
          // lightweight: keep hint clear
          this.setHint("");
        };

        on(el, "input", () => setVal(false));
        on(el, "change", () => setVal(true));
      });

      // add existing policy
      const addExist = $("#lcAddExistingPolicy", this.els.body);
      this.bindOccupationAutocomplete(ins);

      if(this.step === 1){
        const focusEl = this.els.body.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
        if(focusEl) focusEl.setAttribute('data-step1-focus', '1');
        this.els.body.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])').forEach(el => {
          on(el, 'keydown', (ev) => {
            if(ev.key !== 'Enter') return;
            if(el.tagName && el.tagName.toLowerCase() === 'textarea') return;
            ev.preventDefault();
            this.nextStep();
          });
        });
      }

      on(addExist, "click", () => { this.addExistingPolicy(ins); });

      // existing policy row actions
      $$("[data-del-exist]", this.els.body).forEach(btn => {
        on(btn, "click", () => {
          const pid = btn.getAttribute("data-del-exist");
          this.delExistingPolicy(ins, pid);
        });
      });

// open health covers drawer (Health only)
      $$("[data-open-covers]", this.els.body).forEach(btn => {
        on(btn, "click", () => {
          const pid = btn.getAttribute("data-open-covers");
          this.openCoversDrawer(ins, pid);
        });
      });

      // add new policy
      const addNew = $("#lcAddNewPolicy", this.els.body);
      on(addNew, "click", () => { this.addNewPolicy(ins); });
      $$("[data-del-new]", this.els.body).forEach(btn => {
        on(btn, "click", () => {
          const pid = btn.getAttribute("data-del-new");
          this.delNewPolicy(ins, pid);
        });
      });

      // cancellations choices
      $$("[data-cancel-policy]", this.els.body).forEach(el => {
        on(el, "change", () => {
          const pid = el.getAttribute("data-cancel-policy");
          const key = el.getAttribute("data-cancel-key");
          if(!pid || !key) return;
          if(!ins.data.cancellations[pid]) ins.data.cancellations[pid] = {};
          let v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
          if(el.getAttribute && el.getAttribute("data-money")==="ils"){
            const raw = String(v||"").replace(/[₪,\s]/g,"");
            let cleaned = raw.replace(/[^0-9.]/g,"");
            const parts = cleaned.split(".");
            if(parts.length>2) cleaned = parts[0] + "." + parts.slice(1).join("");
            const [i,f] = cleaned.split(".");
            const ii = (i||"").replace(/^0+(?=\d)/,"");
            const withCommas = ii.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            const formatted = (f!==undefined) ? (withCommas + "." + f) : withCommas;
            if(el.value !== formatted) el.value = formatted;
            v = cleaned;
          }
          ins.data.cancellations[pid][key] = v;
          this.render();
        });
      });

      // payer controls
      $$("[data-payer]", this.els.body).forEach(el => {
        on(el, "change", () => {
          const k = el.getAttribute("data-payer");
          let v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
          if(el.getAttribute && el.getAttribute("data-money")==="ils"){
            const raw = String(v||"").replace(/[₪,\s]/g,"");
            let cleaned = raw.replace(/[^0-9.]/g,"");
            const parts = cleaned.split(".");
            if(parts.length>2) cleaned = parts[0] + "." + parts.slice(1).join("");
            const [i,f] = cleaned.split(".");
            const ii = (i||"").replace(/^0+(?=\d)/,"");
            const withCommas = ii.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            const formatted = (f!==undefined) ? (withCommas + "." + f) : withCommas;
            if(el.value !== formatted) el.value = formatted;
            v = cleaned;
          }
          this.setPath(ins.data, k, v);
          this.render();
        });
      });
    },

    setPath(obj, path, value){
      const parts = String(path).split(".");
      let cur = obj;
      for(let i=0;i<parts.length-1;i++){
        const k = parts[i];
        if(!cur[k] || typeof cur[k] !== "object") cur[k] = {};
        cur = cur[k];
      }
      cur[parts[parts.length-1]] = value;
    },


    normalizeOccupationSearch(value){
      return String(value || "")
        .normalize("NFKC")
        .replace(/[׳'"`]/g, "")
        .replace(/[-_/.,]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    },

    getOccupationSuggestions(term){
      const q = this.normalizeOccupationSearch(term);
      const list = Array.isArray(this.occupations) ? this.occupations : [];
      if(!q) return list.slice(0, 20);
      const exact = [];
      const starts = [];
      const includes = [];
      list.forEach(item => {
        const txt = this.normalizeOccupationSearch(item);
        if(!txt.includes(q)) return;
        if(txt === q) exact.push(item);
        else if(txt.startsWith(q)) starts.push(item);
        else includes.push(item);
      });
      return exact.concat(starts, includes).slice(0, 20);
    },

    renderOccupationSuggestions(term, currentValue){
      const cur = safeTrim(currentValue);
      const items = this.getOccupationSuggestions(term);
      if(!items.length){
        return `<button type="button" class="lcOccOption is-empty" data-occ-empty="1">לא נמצאו תוצאות. אפשר להקליד ידנית.</button>`;
      }
      return items.map(item => {
        const active = (safeTrim(item) === cur) ? " is-active" : "";
        return `<button type="button" class="lcOccOption${active}" data-occ-value="${escapeHtml(item)}">${escapeHtml(item)}</button>`;
      }).join("");
    },

    bindOccupationAutocomplete(ins){
      const input = $("#lcOccupationInput", this.els.body);
      const menu = $("#lcOccupationMenu", this.els.body);
      if(!input || !menu) return;

      const openMenu = () => {
        menu.classList.add("is-open");
        input.setAttribute("aria-expanded", "true");
      };
      const closeMenu = () => {
        menu.classList.remove("is-open");
        input.setAttribute("aria-expanded", "false");
      };
      const refreshMenu = () => {
        menu.innerHTML = this.renderOccupationSuggestions(input.value, ins.data.occupation || "");
      };
      const choose = (val) => {
        const picked = safeTrim(val);
        input.value = picked;
        ins.data.occupation = picked;
        refreshMenu();
        closeMenu();
        this.setHint("");
      };

      refreshMenu();
      on(input, "focus", () => { refreshMenu(); openMenu(); });
      on(input, "click", () => { refreshMenu(); openMenu(); });
      on(input, "input", () => { ins.data.occupation = safeTrim(input.value); refreshMenu(); openMenu(); });
      on(input, "keydown", (ev) => {
        const options = $$("[data-occ-value]", menu);
        const current = menu.querySelector(".lcOccOption.is-hover");
        let idx = current ? options.indexOf(current) : -1;
        if(ev.key === "ArrowDown"){
          ev.preventDefault();
          if(!menu.classList.contains("is-open")){ refreshMenu(); openMenu(); }
          idx = Math.min(idx + 1, options.length - 1);
          options.forEach(o => o.classList.remove("is-hover"));
          if(options[idx]) options[idx].classList.add("is-hover");
          return;
        }
        if(ev.key === "ArrowUp"){
          ev.preventDefault();
          idx = Math.max(idx - 1, 0);
          options.forEach(o => o.classList.remove("is-hover"));
          if(options[idx]) options[idx].classList.add("is-hover");
          return;
        }
        if(ev.key === "Enter" && menu.classList.contains("is-open")){
          const picked = menu.querySelector(".lcOccOption.is-hover") || menu.querySelector("[data-occ-value]");
          if(picked){
            ev.preventDefault();
            choose(picked.getAttribute("data-occ-value") || picked.textContent || "");
          }
          return;
        }
        if(ev.key === "Escape") closeMenu();
      });
      on(menu, "mousedown", (ev) => {
        const btn = ev.target && ev.target.closest ? ev.target.closest("[data-occ-value]") : null;
        if(!btn) return;
        ev.preventDefault();
        choose(btn.getAttribute("data-occ-value") || "");
      });
      on(document, "click", (ev) => {
        if(!this.els.body || !this.els.body.contains(input)) return;
        const inside = ev.target === input || menu.contains(ev.target);
        if(!inside) closeMenu();
      });
    },

    // ---------- Step 1 ----------
    getStep1Questions(ins){
      const d = ins.data || {};
      const isChild = ins.type === "child";
      const primary = this.insureds[0]?.data || {};
      const inherited = (key) => safeTrim(primary[key]);
      const age = this.calcAge(d.birthDate);
      const ageTxt = age === null ? "טרם חושב" : (String(age) + " שנים");
      const shabanHelp = d.clinic ? 'בחר את רמת השב״ן של הלקוח' : 'קודם בוחרים קופת חולים ואז נפתחת רשימת השב״ן';
      const questions = [
        {
          key:'firstName',
          title:'מה השם הפרטי של ' + ins.label + '?',
          sub:'נפתח מהשם הפרטי ונבנה את התיק בצורה מסודרת.',
          render:() => this.fieldText('שם פרטי','firstName', d.firstName)
        },
        {
          key:'lastName',
          title:'מה שם המשפחה של ' + ins.label + '?',
          sub:'כך נציג את הלקוח במערכת, בחיפוש ובתיק הלקוח.',
          render:() => this.fieldText('שם משפחה','lastName', d.lastName)
        },
        {
          key:'idNumber',
          title:'מה תעודת הזהות?',
          sub:'נזין את מספר הזהות של המבוטח לצורך שיוך מלא בתיק.',
          render:() => this.fieldText('ת״ז','idNumber', d.idNumber, 'numeric')
        },
        {
          key:'birthDate',
          title:'מה תאריך הלידה?',
          sub:'אפשר להזין בפורמט DD/MM/YYYY.',
          render:() => this.fieldDate('תאריך לידה','birthDate', d.birthDate)
        },
        {
          key:'age',
          title:'הגיל מחושב אוטומטית',
          sub:'המערכת מושכת את הגיל לפי תאריך הלידה שהוזן.',
          required:false,
          render:() => `<div class="lcStep1InfoCard"><div class="lcStep1InfoCard__label">גיל</div><div class="lcStep1InfoCard__value">${escapeHtml(ageTxt)}</div><div class="lcStep1InfoCard__sub">השדה אוטומטי ואינו דורש עריכה.</div></div>`
        },
        {
          key:'gender',
          title:'מה המין של המבוטח?',
          sub:'נבחר את המין כפי שמופיע בפרטי הלקוח.',
          render:() => this.fieldSelect('מין','gender', d.gender, ['', 'זכר', 'נקבה'])
        }
      ];

      if(!isChild){
        questions.push({
          key:'maritalStatus',
          title:'מה המצב המשפחתי?',
          sub:'השדה נשמר אחד לאחד כפי שביקשת.',
          required:false,
          render:() => this.fieldSelect('מצב משפחתי','maritalStatus', d.maritalStatus, ['', 'רווק/ה', 'נשוי/אה', 'גרוש/ה', 'אלמן/ה', 'ידוע/ה בציבור'])
        });
      }

      questions.push(
        {
          key:'phone',
          title:'מה מספר הטלפון?',
          sub: isChild ? 'בקטין הטלפון נלקח אוטומטית מהמבוטח הראשי.' : 'נזין מספר נייד ליצירת קשר עם הלקוח.',
          required:!isChild,
          render:() => isChild
            ? `<div class="lcStep1InfoCard"><div class="lcStep1InfoCard__label">טלפון</div><div class="lcStep1InfoCard__value">${escapeHtml(inherited('phone') || 'טרם מולא במבוטח הראשי')}</div><div class="lcStep1InfoCard__sub">בקטין השדה מוצג לקריאה בלבד.</div></div>`
            : this.fieldText('טלפון','phone', d.phone, 'tel')
        },
        {
          key:'email',
          title:'מה כתובת האימייל?',
          sub: isChild ? 'האימייל עובר בירושה מהמבוטח הראשי.' : 'האימייל ישמש גם להצעות, תפעול וסיכום לקוח.',
          required:!isChild,
          render:() => isChild
            ? `<div class="lcStep1InfoCard"><div class="lcStep1InfoCard__label">אימייל</div><div class="lcStep1InfoCard__value">${escapeHtml(inherited('email') || 'טרם מולא במבוטח הראשי')}</div><div class="lcStep1InfoCard__sub">בקטין השדה מוצג לקריאה בלבד.</div></div>`
            : this.fieldText('מייל','email', d.email, 'email')
        },
        {
          key:'city',
          title:'באיזו עיר הלקוח גר?',
          sub: isChild ? 'העיר נמשכת אוטומטית מהמבוטח הראשי.' : 'העיר תשמש גם לחישוב המיקוד האוטומטי.',
          required:!isChild,
          render:() => isChild
            ? `<div class="lcStep1InfoCard"><div class="lcStep1InfoCard__label">עיר</div><div class="lcStep1InfoCard__value">${escapeHtml(inherited('city') || 'טרם מולא במבוטח הראשי')}</div><div class="lcStep1InfoCard__sub">בקטין השדה מוצג לקריאה בלבד.</div></div>`
            : this.fieldText('עיר','city', d.city)
        },
        {
          key:'street',
          title:'מה שם הרחוב?',
          sub: isChild ? 'הרחוב נמשך מהמבוטח הראשי.' : 'נזין כתובת מגורים מעודכנת.',
          required:!isChild,
          render:() => isChild
            ? `<div class="lcStep1InfoCard"><div class="lcStep1InfoCard__label">רחוב</div><div class="lcStep1InfoCard__value">${escapeHtml(inherited('street') || 'טרם מולא במבוטח הראשי')}</div><div class="lcStep1InfoCard__sub">בקטין השדה מוצג לקריאה בלבד.</div></div>`
            : this.fieldText('רחוב','street', d.street)
        },
        {
          key:'houseNumber',
          title:'מה מספר הבית?',
          sub: isChild ? 'מספר הבית נמשך אוטומטית מהמבוטח הראשי.' : 'השדה מסייע גם לחישוב המיקוד האוטומטי.',
          required:!isChild,
          render:() => isChild
            ? `<div class="lcStep1InfoCard"><div class="lcStep1InfoCard__label">מספר בית</div><div class="lcStep1InfoCard__value">${escapeHtml(inherited('houseNumber') || 'טרם מולא במבוטח הראשי')}</div><div class="lcStep1InfoCard__sub">בקטין השדה מוצג לקריאה בלבד.</div></div>`
            : this.fieldText('מספר','houseNumber', d.houseNumber, 'numeric')
        },
        {
          key:'zip',
          title:'המיקוד נשלף אוטומטית',
          sub:'המיקוד יחושב לפי עיר, רחוב ומספר בית.',
          required:false,
          render:() => `<div class="lcStep1InfoCard"><div class="lcStep1InfoCard__label">מיקוד</div><div class="lcStep1InfoCard__value" data-zip="zip">${escapeHtml(isChild ? inherited('zip') : (d.zip || 'ימולא אוטומטית'))}</div><div class="lcStep1InfoCard__sub">השדה אוטומטי ואינו דורש הקלדה.</div></div>`
        },
        {
          key:'clinic',
          title:'לאיזו קופת חולים הלקוח שייך?',
          sub:'בחירת הקופה תפתח את אפשרויות השב״ן המתאימות.',
          render:() => `<div class="field"><label class="label">קופת חולים</label><select class="input" data-bind="clinic"><option value="" ${!d.clinic?'selected':''}>בחר…</option>${this.clinics.map(x => `<option value="${escapeHtml(x)}"${d.clinic===x?' selected':''}>${escapeHtml(x)}</option>`).join('')}</select></div>`
        },
        {
          key:'shaban',
          title:'מה רמת השב״ן?',
          sub: shabanHelp,
          render:() => `<div class="field"><label class="label">שב״ן</label><select class="input" data-bind="shaban" ${d.clinic ? '' : 'disabled'}>${(this.shabanMap[d.clinic] || ['אין שב״ן']).map(x => `<option value="${escapeHtml(x)}"${d.shaban===x?' selected':''}>${escapeHtml(x)}</option>`).join('')}</select><div class="help">הרשימה משתנה לפי הקופה שנבחרה.</div></div>`
        }
      );

      if(isChild){
        questions.push({
          key:'inheritNotice',
          title:'ירושה אוטומטית לקטין',
          sub:'כמו שביקשת, השדות של כתובת, טלפון ומייל נשארים אחד לאחד — ומוצגים כאן בקריאה בלבד עבור קטין.',
          required:false,
          render:() => `<div class="lcStep1InfoCard lcStep1InfoCard--soft"><div class="lcStep1InfoCard__label">לקטין</div><div class="lcStep1InfoCard__value">המערכת יורשת אוטומטית טלפון, אימייל וכתובת מהמבוטח הראשי.</div><div class="lcStep1InfoCard__sub">אין צורך למלא שוב את אותם שדות.</div></div>`
        });
      }else{
        questions.push({
          key:'occupation',
          title:'מה העיסוק של הלקוח?',
          sub:'יש חיפוש חכם עם מאגר עיסוקים מורחב.',
          render:() => `<div class="field"><label class="label">עיסוק</label><div class="lcOccWrap"><input class="input lcOccInput" id="lcOccupationInput" type="text" data-bind="occupation" value="${escapeHtml(d.occupation || '')}" placeholder="התחל להקליד עיסוק…" autocomplete="off" aria-autocomplete="list" aria-expanded="false" /><div class="lcOccMenu" id="lcOccupationMenu">${this.renderOccupationSuggestions(d.occupation || '', d.occupation || '')}</div></div><div class="help">מאגר עיסוקים מורחב עם חיפוש חכם. אם לא נמצאה התאמה, אפשר להקליד עיסוק ידנית.</div></div>`
        });
      }

      return questions.map((q, i) => ({
        required: q.required !== false,
        requiredMsg: q.requiredMsg || ('נא להשלים את השדה "' + (q.key || ('שאלה ' + (i+1))) + '" לפני שממשיכים'),
        ...q
      }));
    },

    getStep1FlowIndex(ins){
      if(!this.step1FlowMap) this.step1FlowMap = {};
      const max = Math.max(0, this.getStep1Questions(ins).length - 1);
      let idx = Number(this.step1FlowMap[ins.id] || 0);
      if(!Number.isFinite(idx)) idx = 0;
      if(idx < 0) idx = 0;
      if(idx > max) idx = max;
      this.step1FlowMap[ins.id] = idx;
      return idx;
    },

    setStep1FlowIndex(ins, idx){
      if(!this.step1FlowMap) this.step1FlowMap = {};
      const max = Math.max(0, this.getStep1Questions(ins).length - 1);
      let safe = Number(idx || 0);
      if(!Number.isFinite(safe)) safe = 0;
      if(safe < 0) safe = 0;
      if(safe > max) safe = max;
      this.step1FlowMap[ins.id] = safe;
    },

    isStep1QuestionComplete(ins, q){
      if(!q || q.required === false) return true;
      const d = ins.data || {};
      const primary = this.insureds[0]?.data || {};
      const inheritedKeys = ['phone','email','city','street','houseNumber','zip'];
      if(ins.type === 'child' && inheritedKeys.includes(q.key)) return !!safeTrim(primary[q.key]);
      return !!safeTrim(d[q.key]);
    },

    focusStep1QuestionSoon(){
      setTimeout(() => {
        const root = this.els?.body;
        if(!root) return;
        const el = root.querySelector('[data-step1-focus], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
        try{ el?.focus?.(); }catch(_e){}
      }, 30);
    },

    renderStep1Summary(ins, questions, activeIdx){
      const d = ins.data || {};
      const summaryItems = questions.map((q, idx) => {
        const active = idx === activeIdx ? ' is-active' : '';
        const done = this.isStep1QuestionComplete(ins, q) ? ' is-done' : '';
        let value = '';
        if(q.key === 'age') value = this.calcAge(d.birthDate);
        else if(q.key === 'inheritNotice') value = 'אוטומטי';
        else if(q.key) value = d[q.key];
        if(ins.type === 'child' && ['phone','email','city','street','houseNumber','zip'].includes(q.key || '')) value = (this.insureds[0]?.data || {})[q.key] || '';
        const shown = safeTrim(value) || '—';
        return `<div class="lcStep1SummaryItem${active}${done}"><div class="lcStep1SummaryItem__k">${escapeHtml(q.title || '')}</div><div class="lcStep1SummaryItem__v">${escapeHtml(String(shown))}</div></div>`;
      }).join('');
      return `<aside class="lcStep1Summary"><div class="lcStep1Summary__head"><div class="lcStep1Summary__title">תקציר ${escapeHtml(ins.label)}</div><div class="lcStep1Summary__sub">הפרטים שכבר הוזנו בשלב 1</div></div><div class="lcStep1Summary__list">${summaryItems}</div></aside>`;
    },

    renderStep1(ins){
      const questions = this.getStep1Questions(ins);
      const idx = this.getStep1FlowIndex(ins);
      const q = questions[idx] || questions[0];

      return `
        <div class="lcStep1Premium lcStep1Premium--compact">
          <div class="lcStep1Premium__main">
            <section class="lcStep1QuestionCard lcStep1QuestionCard--compact">
              <div class="lcStep1QuestionCard__top lcStep1QuestionCard__top--single">
                <div class="lcStep1QuestionCard__tag">${escapeHtml(ins.label)}</div>
              </div>
              <h3 class="lcStep1QuestionCard__title">${escapeHtml(q?.title || '')}</h3>
              <div class="lcStep1QuestionCard__sub">${escapeHtml(q?.sub || '')}</div>
              <div class="lcStep1QuestionCard__body" data-step1-body="1">${q?.render ? q.render() : ''}</div>
            </section>
          </div>
          ${this.renderStep1Summary(ins, questions, idx)}
        </div>
      `;
    },

    // ---------- Step 2 ----------
    calcBmi(ins){
      const h = Number(ins.data.heightCm);
      const w = Number(ins.data.weightKg);
      if(!h || !w || h <= 0 || w <= 0) { ins.data.bmi = null; return; }
      const m = h / 100;
      const bmi = w / (m*m);
      ins.data.bmi = Math.round(bmi * 10) / 10;
    },

    bmiStatus(bmi){
      if(bmi === null || bmi === undefined || bmi === "") return { lamp:"", text:"", label:"" };
      const n = Number(bmi);
      if(n >= 18.5 && n <= 24.9) return { lamp:"green", label:"תקין", text:"ירוק · 18.5–24.9" };
      if(n >= 25 && n <= 29.9) return { lamp:"yellow", label:"עודף משקל", text:"צהוב · 25–29.9" };
      if(n >= 30) return { lamp:"red", label:"השמנה", text:"אדום · 30+" };
      return { lamp:"yellow", label:"נמוך", text:"מתחת ל-18.5" };
    },

    renderStep2(ins){
      this.calcBmi(ins);
      const d = ins.data;
      const st = this.bmiStatus(d.bmi);
      const has = !(d.bmi === null || d.bmi === undefined || d.bmi === "");
      const bmiTxt = has ? String(d.bmi) : "—";
      const labelTxt = has ? (st.label || "—") : "מלא גובה ומשקל";

      return `
        <div class="lcWSection">
          <div class="lcWTitle">BMI</div>
          <div class="lcWGrid">
            ${this.fieldText("גובה (ס״מ)","heightCm", d.heightCm, "numeric")}
            ${this.fieldText("משקל (ק״ג)","weightKg", d.weightKg, "numeric")}

            <div class="lcBmiCard ${has ? "" : "is-empty"}" data-bmi="card">
              <div class="lcBmiCard__side">
                <span class="lcLamp lcBmiDot ${st.lamp}" data-bmi="lamp" aria-hidden="true"></span>
              </div>
              <div class="lcBmiCard__main">
                <div class="lcBmiCard__value" data-bmi="value">${escapeHtml(bmiTxt)}</div>
                <div class="lcBmiCard__label" data-bmi="label">${escapeHtml(labelTxt)}</div>
              </div>
            </div>

          </div>
        </div>
      `;
    },

    // ---------- Step 3 ----------
    addExistingPolicy(ins){
      const p = {
        id: "pol_" + Math.random().toString(16).slice(2),
        company:"",
        type:"",
        policyNumber:"",
        sumInsured:"",
        hasPledge:false,
        bankAgency:false,
        pledgeBankName:"",
        bankAgencyName:"",
        compensation:"",
        monthlyPremium:""
      };
      ins.data.existingPolicies.push(p);
      this.render();
    },
    delExistingPolicy(ins, pid){
      ins.data.existingPolicies = (ins.data.existingPolicies || []).filter(p => p.id !== pid);
      delete ins.data.cancellations[pid];
      this.render();
    },

    renderStep3(ins){
      const d = ins.data;
      const anyHealth = (d.existingPolicies || []).some(x => x && x.type === "בריאות");
      const col4Label = anyHealth ? "כיסויים" : "סכום/פיצוי";

      const rows = (d.existingPolicies || []).map(p => {
        const logoSrc = this.getCompanyLogoSrc(p.company);
        const logo = logoSrc
          ? `<img class="lcPolLogoMini" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(p.company||"")}" />`
          : `<div class="lcPolLogoMini lcPolLogoMini--empty" aria-hidden="true"></div>`;
        const compOpts = (this.existingCompanies || this.companies).map(x => `<option value="${escapeHtml(x)}"${p.company===x?" selected":""}>${escapeHtml(x)}</option>`).join("");
        const typeOpts = this.insTypes.map(x => `<option value="${escapeHtml(x)}"${p.type===x?" selected":""}>${escapeHtml(x)}</option>`).join("");
        const isRisk = (p.type === "ריסק" || p.type === "ריסק משכנתא");
        const isCI = (p.type === "מחלות קשות" || p.type === "סרטן");
        const isHealth = (p.type === "בריאות");
        const bankOpts = this.bankNames.map(b => `<option value="${escapeHtml(b)}"${safeTrim(p.pledgeBankName)===b?" selected":""}>${escapeHtml(b)}</option>`).join("");
        const agencies = this.bankAgencies.filter(a => !safeTrim(p.pledgeBankName) || String(a).includes(p.pledgeBankName));
        const agencyOpts = agencies.map(a => `<option value="${escapeHtml(a)}"${safeTrim(p.bankAgencyName)===a?" selected":""}>${escapeHtml(a)}</option>`).join("");

        const coversCount = Array.isArray(p.covers) ? p.covers.length : 0;
        const coversLabel = coversCount ? (coversCount + " כיסויים נבחרו") : "בחירת כיסויים";

        return `
          <tr>
            <td>
              <div class="lcPolCompanyCell">
                ${logo}
                <select class="input" data-bind="existingPolicies.${p.id}.company" aria-label="חברת ביטוח">
                  <option value="">בחר…</option>${compOpts}
                </select>
              </div>
            </td>
            <td>
              <select class="input" data-bind="existingPolicies.${p.id}.type">
                <option value="">בחר…</option>${typeOpts}
              </select>
            </td>
            <td><input class="input" data-bind="existingPolicies.${p.id}.policyNumber" value="${escapeHtml(p.policyNumber||"")}" placeholder="מספר פוליסה" /></td>
            <td>
              ${isHealth ? `
                <button class="btn lcSmallBtn lcCoversBtn" data-open-covers="${escapeHtml(p.id)}" type="button">${escapeHtml(coversLabel)}</button>
              ` : isRisk ? `<input class="input" data-bind="existingPolicies.${p.id}.sumInsured" value="${escapeHtml(p.sumInsured||"")}" placeholder="סכום ביטוח" />` : isCI ? `<input class="input" data-bind="existingPolicies.${p.id}.compensation" value="${escapeHtml(p.compensation||"")}" placeholder="סכום פיצוי" />` : `<span class="muted small">—</span>`}
            </td>
            <td>
              <div class="moneyField" title="פרמיה חודשית">
                <input class="input moneyField__input" data-money="ils" data-bind="existingPolicies.${p.id}.monthlyPremium" value="${escapeHtml(p.monthlyPremium||"")}" placeholder="0" inputmode="decimal" />
                <span class="moneyField__sym">₪</span>
              </div>
            </td>
            <td>
              ${isRisk ? `
                <label class="row" style="gap:8px">
                  <input type="checkbox" data-bind="existingPolicies.${p.id}.hasPledge" ${p.hasPledge ? "checked":""} />
                  <span class="small">יש שיעבוד</span>
                </label>

                ${p.hasPledge ? `
                  <select class="input" style="margin-top:6px" data-bind="existingPolicies.${p.id}.pledgeBankName">
                    <option value="">בחר בנק משעבד…</option>
                    ${bankOpts}
                  </select>

                  <label class="row" style="gap:8px; margin-top:6px">
                    <input type="checkbox" data-bind="existingPolicies.${p.id}.bankAgency" ${p.bankAgency ? "checked":""} />
                    <span class="small">נרכשה דרך סוכנות בנק</span>
                  </label>

                  ${p.bankAgency ? `
                    <select class="input" style="margin-top:6px" data-bind="existingPolicies.${p.id}.bankAgencyName">
                      <option value="">בחר סוכנות…</option>
                      ${agencyOpts}
                    </select>
                  `:""}
                `:""}
              ` : `<span class="muted small">—</span>`}
            </td>
            <td><button class="btn lcSmallBtn" data-del-exist="${p.id}" type="button">הסר</button></td>
          </tr>
        `;
      }).join("");

      return `
        <div class="lcWSection">
          <div class="lcPolTableWrap" style="padding:0">
            <table class="lcPolTable">
              <thead>
                <tr>
                  <th>חברה</th>
                  <th>סוג</th>
                  <th>מספר</th>
                  <th>${escapeHtml(col4Label)}</th>
                  <th>פרמיה חודשית</th>
                  <th>שיעבוד</th>
                  <th style="width:100px">פעולות</th>
                </tr>
              </thead>
              <tbody>${rows || `<tr><td colspan="7" class="muted">אין פוליסות עדיין</td></tr>`}</tbody>
            </table>
          </div>

          
        </div>
      `;
    },

    // Step3/5 use virtual binding for policy rows by id
    resolvePolicyBind(ins, path, value, kind){
      // path example: existingPolicies.<id>.company
      const parts = String(path).split(".");
      const listName = parts[0]; // existingPolicies/newPolicies
      const pid = parts[1];
      const field = parts.slice(2).join(".");
      const list = (listName === "existingPolicies") ? ins.data.existingPolicies : ins.data.newPolicies;
      const row = (list || []).find(x => x.id === pid);
      if(!row) return false;
      row[field] = value;
      return true;
    },

    // override bindInputs with policy binds
    bindInputs(ins){
      $$("[data-bind]", this.els.body).forEach(el => {
        const path = el.getAttribute("data-bind");
        if(!path) return;

        const setVal = (doRender=false) => {
          let v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
          if(el.getAttribute && el.getAttribute("data-money")==="ils"){
            const raw = String(v||"").replace(/[₪,\s]/g,"");
            let cleaned = raw.replace(/[^0-9.]/g,"");
            const parts = cleaned.split(".");
            if(parts.length>2) cleaned = parts[0] + "." + parts.slice(1).join("");
            const [i,f] = cleaned.split(".");
            const ii = (i||"").replace(/^0+(?=\d)/,"");
            const withCommas = ii.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            const formatted = (f!==undefined) ? (withCommas + "." + f) : withCommas;
            if(el.value !== formatted) el.value = formatted;
            v = cleaned;
          }

          // policy virtual binding
          if(path.startsWith("existingPolicies.") || path.startsWith("newPolicies.")){
            const ok = this.resolvePolicyBind(ins, path, v);
            if(ok){
              if(path.endsWith(".type")) this.render(); // to refresh conditional fields
              if(path.endsWith(".hasPledge") || path.endsWith(".bankAgency") || path.endsWith(".pledgeBankName") || path.endsWith(".bankAgencyName")) this.render();
              if(path.endsWith(".premiumBefore") || path.endsWith(".discountPct") || path.endsWith(".discountYears")) this.render();
              this.setHint("");
              return;
            }
          }

          // normal bind
          this.setPath(ins.data, path, v);

          if(path === "clinic"){
            if(!ins.data.clinic) ins.data.shaban = "";
            else if(!this.shabanMap[ins.data.clinic]?.includes(ins.data.shaban)) ins.data.shaban = "אין שב״ן";
            this.render();
            return;
          }
          if(path === "birthDate"){
            // don't re-render on every keystroke (prevents focus loss while typing)
            if(doRender) this.render();
            return;
          }
          if(path === "heightCm" || path === "weightKg"){
            // live update without destroying the input focus
            this.calcBmi(ins);
            this.updateBmiUI(ins);
            if(doRender) this.render();
            return;
          }
          if(path === "city" || path === "street" || path === "houseNumber"){
            this.scheduleZipLookup(ins);
            this.setHint("");
            return;
          }

          this.setHint("");
        };

        on(el, "input", () => setVal(false));
        on(el, "change", () => setVal(true));
      });

      const addExist = $("#lcAddExistingPolicy", this.els.body);
      this.bindOccupationAutocomplete(ins);

      if(this.step === 1){
        const focusEl = this.els.body.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
        if(focusEl) focusEl.setAttribute('data-step1-focus', '1');
        this.els.body.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])').forEach(el => {
          on(el, 'keydown', (ev) => {
            if(ev.key !== 'Enter') return;
            if(el.tagName && el.tagName.toLowerCase() === 'textarea') return;
            ev.preventDefault();
            this.nextStep();
          });
        });
      }

      on(addExist, "click", () => { this.addExistingPolicy(ins); });
      $$("[data-del-exist]", this.els.body).forEach(btn => on(btn, "click", () => this.delExistingPolicy(ins, btn.getAttribute("data-del-exist"))));

      // open health covers drawer (Health only)
      $$("[data-open-covers]", this.els.body).forEach(btn => {
        on(btn, "click", () => {
          const pid = btn.getAttribute("data-open-covers");
          if(!pid) return;
          this.openCoversDrawer(ins, pid);
        });
      });

      const addNew = $("#lcAddNewPolicy", this.els.body);
      on(addNew, "click", () => { this.addNewPolicy(ins); });
      $$("[data-del-new]", this.els.body).forEach(btn => on(btn, "click", () => this.delNewPolicy(ins, btn.getAttribute("data-del-new"))));

      $$("[data-cancel-policy]", this.els.body).forEach(el => {
        on(el, "change", () => {
          const pid = el.getAttribute("data-cancel-policy");
          const key = el.getAttribute("data-cancel-key");
          if(!pid || !key) return;
          if(!ins.data.cancellations[pid]) ins.data.cancellations[pid] = { attachments: {} };
          let v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
          if(el.getAttribute && el.getAttribute("data-money")==="ils"){
            const raw = String(v||"").replace(/[₪,\s]/g,"");
            let cleaned = raw.replace(/[^0-9.]/g,"");
            const parts = cleaned.split(".");
            if(parts.length>2) cleaned = parts[0] + "." + parts.slice(1).join("");
            const [i,f] = cleaned.split(".");
            const ii = (i||"").replace(/^0+(?=\d)/,"");
            const withCommas = ii.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            const formatted = (f!==undefined) ? (withCommas + "." + f) : withCommas;
            if(el.value !== formatted) el.value = formatted;
            v = cleaned;
          }
          if(key.startsWith("att:")){
            const attKey = key.slice(4);
            if(!ins.data.cancellations[pid].attachments) ins.data.cancellations[pid].attachments = {};
            ins.data.cancellations[pid].attachments[attKey] = v;
          }else{
            ins.data.cancellations[pid][key] = v;
          }
          this.render();
        });
      });

      $$("[data-payer]", this.els.body).forEach(el => {
        on(el, "change", () => {
          const k = el.getAttribute("data-payer");
          let v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
          if(el.getAttribute && el.getAttribute("data-money")==="ils"){
            const raw = String(v||"").replace(/[₪,\s]/g,"");
            let cleaned = raw.replace(/[^0-9.]/g,"");
            const parts = cleaned.split(".");
            if(parts.length>2) cleaned = parts[0] + "." + parts.slice(1).join("");
            const [i,f] = cleaned.split(".");
            const ii = (i||"").replace(/^0+(?=\d)/,"");
            const withCommas = ii.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            const formatted = (f!==undefined) ? (withCommas + "." + f) : withCommas;
            if(el.value !== formatted) el.value = formatted;
            v = cleaned;
          }
          this.setPath(ins.data, k, v);
          this.render();
        });
      });
    },

    // ---------- Step 4 ----------
    renderStep4(ins){
      const d = ins.data;
      const list = d.existingPolicies || [];
      const cancelOptions = [
        {v:"", t:"בחר…"},
        {v:"full", t:"ביטול מלא"},
        {v:"partial_health", t:"ביטול חלקי"},
        {v:"nochange_client", t:"ללא שינוי – לבקשת הלקוח"},
        {v:"agent_appoint", t:"מינוי סוכן"},
        {v:"nochange_collective", t:"ללא שינוי – קולקטיב"},
      ];
      const reasons = ["","הוזלת עלויות / מיקסום זכויות","סדר בתיק הביטוחי","רכישת ביטוח חדש"];
      const annexes = Array.from({length:11}).map((_,i)=>`נספח ${i+1}`);

      if(!list.length){
        return `<div class="lcWSection"><div class="lcWTitle">ביטול בחברה נגדית</div><div class="muted">אין פוליסות קיימות למבוטח הזה.</div></div>`;
      }

      const blocks = list.map(p => {
        const c = d.cancellations[p.id] || {};
        const status = safeTrim(c.status || "");
        const needReason = (status === "full" || status === "partial_health");
        const reasonOpts = reasons.map(x => `<option value="${escapeHtml(x)}"${c.reason===x?" selected":""}>${escapeHtml(x || "בחר…")}</option>`).join("");
        const statusOpts = cancelOptions.map(o => `<option value="${o.v}"${status===o.v?" selected":""}>${escapeHtml(o.t)}</option>`).join("");

        const isHealthPolicy = (() => {
          const t = safeTrim(p.type || "");
          return t.includes("בריאות") || t.toLowerCase().includes("health");
        })();
        const showAnnex = (status === "partial_health") && isHealthPolicy;
        const pledgedBank = !!(p.hasPledge && p.bankAgency);

        return `
          <div class="lcWSection lcCancelCard">
            <div class="row row--between">
              <div>
                <div class="lcWTitle">${escapeHtml(p.type || "פוליסה")} · ${escapeHtml(p.company || "חברה")}</div>
                <div class="muted small">מספר: ${escapeHtml(p.policyNumber || "—")}</div>
              </div>
              ${pledgedBank ? `<span class="lcWBadge"><span class="lcStopBlink" aria-hidden="true">🛑</span>שים לב! יש לשלוח ביטול גם לחברת הביטוח וגם לסוכנות</span>` : ``}
            </div>

            <div class="lcWGrid" style="margin-top:10px">
              <div class="field">
                <label class="label">סטטוס</label>
                <select class="input" data-cancel-policy="${p.id}" data-cancel-key="status">${statusOpts}</select>
              </div>

              <div class="field">
                <label class="label">סיבת ביטול</label>
                <select class="input" data-cancel-policy="${p.id}" data-cancel-key="reason" ${needReason ? "" : "disabled"}>${reasonOpts}</select>
                <div class="help">${needReason ? "חובה לבחור סיבה" : "נדרש רק בביטול מלא/חלקי"}</div>
              </div>
            </div>

            ${showAnnex ? `
              <div class="divider"></div>
              <div class="lcWTitle" style="margin-bottom:8px">נספחים לביטול חלקי (בריאות בלבד)</div>
              <div class="lcWGrid">
                ${annexes.map(a => `
                  <label class="row" style="gap:8px">
                    <input type="checkbox" data-cancel-policy="${p.id}" data-cancel-key="att:${escapeHtml(a)}" ${(c.attachments && c.attachments[a]) ? "checked":""} />
                    <span class="small">${escapeHtml(a)}</span>
                  </label>
                `).join("")}
              </div>
            `:""}
          </div>
        `;
      }).join("");

      return `<div class="lcCancelList">` + blocks + `</div>`;
    },

    // ---------- Step 5 (NEW: company -> product, case-level) ----------
    getCompanyLogoSrc(company){
      const map = {
        "הפניקס": "afenix.png",
        "הראל": "harel.png",
        "כלל": "clal.png",
        "מגדל": "megdl.png",
        "מנורה": "menora.png",
        "איילון": "ayalon.png",
        "הכשרה": "achshara.png",
        "AIG": "aig.png",
        "ביטוח ישיר": "beytuyashir.png",
        "9 מיליון": "9milyon.png",
        "מדיקר": "medicare.png"
      };
      return map[company] || "";
    },

    isMedicareCompany(company){
      return safeTrim(company) === "מדיקר";
    },

    ensurePolicyDraft(){
      if(this.policyDraft) return;
      const firstIns = this.insureds[0];
      const spouse = this.insureds.find(x => x.type === "spouse");
      this.policyDraft = {
        insuredMode: "single", // single/couple
        insuredId: firstIns?.id || "",
        company: "",
        type: "",
        sumInsured: "",
        compensation: "",
        premiumMonthly: "",
        startDate: "",
        healthCovers: [],
        pledge: false,
        pledgeBank: { bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" }
      };
      if(!spouse){
        // if no spouse exists, couple option will be hidden anyway
      }
    },

    addDraftPolicy(){
      this.ensurePolicyDraft();
      const d = this.policyDraft;

      // build normalized policy
      const p = {
        id: this.editingPolicyId || ("npol_" + Math.random().toString(16).slice(2)),
        insuredMode: d.insuredMode,
        insuredId: d.insuredId || "",
        company: d.company || "",
        type: this.isMedicareCompany(d.company) ? "מדיקר" : (d.type || ""),
        sumInsured: (d.sumInsured || ""),
        compensation: (d.compensation || ""),
        premiumMonthly: (d.premiumMonthly || ""),
        startDate: (d.startDate || ""),
        healthCovers: Array.isArray(d.healthCovers) ? d.healthCovers.filter(Boolean) : [],
        pledge: !!d.pledge,
        pledgeBank: Object.assign({ bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" }, d.pledgeBank || {})
      };

      this.newPolicies = (this.newPolicies || []);
      if(this.editingPolicyId){
        this.newPolicies = this.newPolicies.map(item => item.id === this.editingPolicyId ? p : item);
      }else{
        this.newPolicies.push(p);
      }

      const keepMode = d.insuredMode;
      const keepIns = d.insuredId;

      this.editingPolicyId = null;
      this.policyDraft = null;
      this.ensurePolicyDraft();
      this.policyDraft.insuredMode = keepMode;
      this.policyDraft.insuredId = keepIns;
      this.policyDraft.company = "";
      this.policyDraft.type = "";
      this.policyDraft.sumInsured = "";
      this.policyDraft.compensation = "";
      this.policyDraft.premiumMonthly = "";
      this.policyDraft.startDate = "";
      this.policyDraft.healthCovers = [];
      this.policyDraft.pledge = false;
      this.policyDraft.pledgeBank = { bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" };

      this.render();
    },

    startEditNewPolicy(pid){
      const p = (this.newPolicies || []).find(item => item.id === pid);
      if(!p) return;
      this.editingPolicyId = pid;
      this.policyDraft = {
        insuredMode: p.insuredMode || "single",
        insuredId: p.insuredId || (this.insureds[0]?.id || ""),
        company: p.company || "",
        type: this.isMedicareCompany(p.company) ? "" : (p.type || ""),
        sumInsured: p.sumInsured || "",
        compensation: p.compensation || "",
        premiumMonthly: p.premiumMonthly || "",
        startDate: p.startDate || "",
        healthCovers: Array.isArray(p.healthCovers) ? p.healthCovers.slice() : [],
        pledge: !!p.pledge,
        pledgeBank: Object.assign({ bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" }, p.pledgeBank || {})
      };
      this.setHint("מצב עריכה הופעל עבור הפוליסה שנבחרה");
      this.render();
    },

    cancelEditNewPolicy(){
      this.editingPolicyId = null;
      this.policyDraft = null;
      this.setHint("עריכת הפוליסה בוטלה");
      this.render();
    },

    delNewPolicy(pid){
      this.newPolicies = (this.newPolicies || []).filter(p => p.id !== pid);
      // clean any payer mappings that may reference this policy (stored on primary)
      const d0 = this.insureds[0]?.data;
      if(d0 && d0.policyPayers) delete d0.policyPayers[pid];
      this.render();
    },

    validateStep5(){
      const list = (this.newPolicies || []);
      if(list.length < 1) return { ok:false, msg:"חובה להוסיף לפחות פוליסה אחת" };

      // validate each policy
      const bad = list.filter(p => {
        const isMedicare = this.isMedicareCompany(p.company);
        if(!safeTrim(p.company)) return true;
        if(!isMedicare && !safeTrim(p.type)) return true;

        if(!safeTrim(p.premiumMonthly)) return true;
        if(!safeTrim(p.startDate)) return true;
        if(!isMedicare && p.type === "בריאות"){
          const covers = Array.isArray(p.healthCovers) ? p.healthCovers.filter(Boolean) : [];
          if(!covers.length) return true;
        }

        if(!isMedicare && (p.type === "סרטן" || p.type === "מחלות קשות")){
          if(!safeTrim(p.compensation)) return true;
        }
        if(!isMedicare && (p.type === "ריסק" || p.type === "ריסק משכנתא")){
          if(!safeTrim(p.sumInsured)) return true;
        }
        if(!isMedicare && (p.type === "ריסק" || p.type === "ריסק משכנתא") && p.pledge){
          const b = p.pledgeBank || {};
          const req = ["bankName","bankNo","branch","amount","years","address"];
          if(!req.every(k => safeTrim(b[k]))) return true;
        }

        // insured linkage
        if(p.insuredMode === "single"){
          if(!safeTrim(p.insuredId)) return true;
        }else{
          // couple requires spouse to exist
          const spouse = this.insureds.find(x => x.type === "spouse");
          if(!spouse) return true;
        }
        return false;
      });

      if(bad.length) return { ok:false, msg:"יש פוליסות חסרות / לא תקינות — נא להשלים חובה" };
      return { ok:true };
    },

    renderStep5(){
      this.ensurePolicyDraft();
      const d = this.policyDraft;
      const spouse = this.insureds.find(x => x.type === "spouse");
      const insuredOpts = this.insureds.map(ins => `<option value="${ins.id}"${d.insuredId===ins.id?" selected":""}>${escapeHtml(ins.label)}</option>`).join("");

      const companyCards = this.companies.map(c => {
        const src = this.getCompanyLogoSrc(c);
        const selected = (d.company === c);
        const cls = "lcCoCard" + (selected ? " is-selected" : "");
        const logo = src ? `<img class="lcCoLogo" src="${escapeHtml(src)}" alt="${escapeHtml(c)}" />` : `<div class="lcCoLogo lcCoLogo--text">${escapeHtml(c)}</div>`;
        return `<button type="button" class="${cls}" data-co="${escapeHtml(c)}">${logo}<div class="lcCoName">${escapeHtml(c)}</div></button>`;
      }).join("");

      const productOpts = this.insTypes.map(t => `<option value="${escapeHtml(t)}"${d.type===t?" selected":""}>${escapeHtml(t)}</option>`).join("");

      const isMedicare = this.isMedicareCompany(d.company);
      const needComp = !isMedicare && (d.type === "סרטן" || d.type === "מחלות קשות");
      const needSum = !isMedicare && (d.type === "ריסק" || d.type === "ריסק משכנתא");
      const isMortgage = !isMedicare && (d.type === "ריסק משכנתא");
      const isRisk = !isMedicare && (d.type === "ריסק" || d.type === "ריסק משכנתא");
      const canPledge = isRisk;

      const list = (this.newPolicies || []);

      // group rendering
      const byIns = {};
      this.insureds.forEach(ins => byIns[ins.id] = []);
      byIns["__couple_primary__"] = [];
      byIns["__couple_spouse__"] = [];

      list.forEach(p => {
        if(p.insuredMode === "couple"){
          const primary = this.insureds[0];
          const sp = spouse;
          if(primary) byIns[primary.id].push(p);
          if(sp) byIns[sp.id].push(p);
        }else{
          if(byIns[p.insuredId]) byIns[p.insuredId].push(p);
        }
      });

      const renderPolicyCard = (p, showCoupleBadge=false) => {
        const src = this.getCompanyLogoSrc(p.company);
        const logo = src
          ? `<div class="lcPolLogoWrap"><img class="lcPolLogo" src="${escapeHtml(src)}" alt="${escapeHtml(p.company)}" /></div>`
          : `<div class="lcPolLogoWrap"><div class="lcPolLogo lcPolLogo--text">${escapeHtml((p.company || "").slice(0,2) || "•")}</div></div>`;
        const badge = showCoupleBadge ? `<span class="lcChip">זוגי</span>` : "";
        const isMedicare = this.isMedicareCompany(p.company);
        const sumLabel = (p.type === "מחלות קשות" || p.type === "סרטן") ? "סכום פיצוי" : "סכום ביטוח";
        const sumValue = (p.type === "מחלות קשות" || p.type === "סרטן") ? (p.compensation || "") : (p.sumInsured || "");
        const policyTitle = `${escapeHtml(p.company)}${isMedicare ? "" : ` · ${escapeHtml(p.type)}`}`;
        const pledgeText = (!isMedicare && (p.type === "ריסק" || p.type === "ריסק משכנתא") && p.pledge) ? "שיעבוד פעיל" : "ללא שיעבוד";
        const coverItems = this.getHealthCoverList(p);
        const coverSummary = this.summarizeHealthCovers(coverItems, { max: 2, emptyLabel: "טרם נבחרו כיסויים" });
        const fmtDate = (v) => {
          const s = safeTrim(v);
          if(!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || "—";
          const [y,m,d] = s.split('-');
          return `${d}.${m}.${y}`;
        };
        const fmtMoney = (v) => {
          const raw = String(v || '').replace(/[₪,\s]/g,'');
          if(!raw) return '—';
          const n = Number(raw);
          if(Number.isFinite(n)) return `₪${n.toLocaleString('he-IL')}`;
          return `₪${escapeHtml(String(v))}`;
        };
        const chips = [
          `<span class="lcPolInfoChip"><span class="lcPolInfoChip__icon">💰</span><span class="lcPolInfoChip__text"><b>${fmtMoney(p.premiumMonthly)}</b><small>פרמיה חודשית</small></span></span>`,
          `<span class="lcPolInfoChip"><span class="lcPolInfoChip__icon">📅</span><span class="lcPolInfoChip__text"><b>${escapeHtml(fmtDate(p.startDate))}</b><small>תחילת ביטוח</small></span></span>`,
          sumValue ? `<span class="lcPolInfoChip"><span class="lcPolInfoChip__icon">🛡️</span><span class="lcPolInfoChip__text"><b>${fmtMoney(sumValue)}</b><small>${sumLabel}</small></span></span>` : '',
          (!isMedicare && (p.type === "ריסק" || p.type === "ריסק משכנתא")) ? `<span class="lcPolInfoChip"><span class="lcPolInfoChip__icon">🏦</span><span class="lcPolInfoChip__text"><b>${escapeHtml(pledgeText)}</b><small>סטטוס שיעבוד</small></span></span>` : ''
        ].filter(Boolean).join('');
        return `<div class="lcPolCard lcPolCard--premium" data-pol="${p.id}">
          <div class="lcPolCard__top">
            <div class="lcPolCard__brand">
              ${logo}
              <div class="lcPolCard__brandText">
                <div class="lcPolTitle">${policyTitle} ${badge}</div>
                <div class="lcPolSub">פוליסה חדשה${showCoupleBadge ? " · משויכת לשני מבוטחים" : ""}</div>
              </div>
            </div>
            <div class="lcPolSummaryTag">חדש</div>
          </div>
          <div class="lcPolInfoStrip">${chips}</div>
          ${p.type === "בריאות" ? `<div class="lcPolCoverCompact">
            <div class="lcPolCoverCompact__text"><span class="lcPolCoverCompact__count">${coverItems.length || 0}</span><span>${escapeHtml(coverSummary)}</span></div>
            <button type="button" class="lcPolCoverCompact__btn" data-editpol="${p.id}">ערוך כיסויים</button>
          </div>` : ``}
          <div class="lcPolCard__actions">
            <button type="button" class="lcIconActionBtn" data-editpol="${p.id}" aria-label="עריכה"><span class="lcIconActionBtn__icon">✏️</span><span>עריכה</span></button>
            <button type="button" class="lcIconActionBtn lcIconActionBtn--danger" data-delpol="${p.id}" aria-label="הסר"><span class="lcIconActionBtn__icon">🗑️</span><span>הסר</span></button>
          </div>
        </div>`;
      };

      const groupsHtml = this.insureds.map(ins => {
        const items = (byIns[ins.id] || []);
        if(!items.length) return "";
        // show "couple" badge for policies that are couple
        const cards = items.map(p => renderPolicyCard(p, p.insuredMode === "couple")).join("");
        return `<div class="lcWSection">
          <div class="lcWTitle">${escapeHtml(ins.label)}</div>
          <div class="lcPolList">${cards}</div>
        </div>`;
      }).join("");

      const emptyNote = (!groupsHtml.trim()) ? `<div class="muted small">עדיין לא נוספו פוליסות חדשות.</div>` : "";

      const form = `<div class="lcWSection lcPolBuilderSection">
        <div class="lcWTitle">${this.editingPolicyId ? "עריכת פוליסה" : "הוספת פוליסה חדשה"}</div>
        <div class="lcPolForm lcPolForm--premium">
          <div class="lcPolBuilderCard">
            <div class="lcPolBuilderCard__head">
              <div class="lcPolBuilderCard__title">${this.editingPolicyId ? "עריכת פרטי הפוליסה" : "פרטי הפוליסה החדשה"}</div>
            </div>

            <div class="lcField lcInsuredGlass lcPolBuilderAssign">
              <div class="lcInsuredGlassCard">
                <div class="lcInsuredGlassHead">
                  <label class="lcLabel">שיוך למבוטח</label>
                  <div class="small muted">קובע למי הפוליסה תשויך בסיכום</div>
                </div>
                <div class="lcInsuredGlassRow">
                  <select class="lcSelect" data-pdraft="insuredId"${(d.insuredMode==="couple")?" disabled":""}>
                    ${insuredOpts}
                  </select>
                  ${spouse ? `<button type="button" class="lcBtn lcBtn--ghost ${d.insuredMode==="couple"?"is-active":""}" data-pdraftmode="couple">פוליסה זוגית (ראשי + בן/בת זוג)</button>` : ``}
                  <button type="button" class="lcBtn lcBtn--ghost ${d.insuredMode==="single"?"is-active":""}" data-pdraftmode="single">פוליסה למבוטח אחד</button>
                </div>
              </div>
            </div>

            <div class="lcField lcPolBuilderCompanies">
              <label class="lcLabel">בחירת חברה</label>
              <div class="lcCoGrid">${companyCards}</div>
            </div>

            <div class="lcPolGrid lcPolGrid--top lcPolGrid--mainRow">
              <div class="lcField lcPolField lcPolField--company">
                <label class="lcLabel">חברה</label>
                <div class="lcPolStaticValue lcPolControlShell">${escapeHtml(d.company || "בחר חברה")}</div>
              </div>

              ${isMedicare ? `<div class="lcField lcPolField lcPolField--product">
                <label class="lcLabel">מוצר</label>
                <div class="lcPolStaticValue lcPolControlShell">מדיקר</div>
              </div>` : `<div class="lcField lcPolField lcPolField--product">
                <label class="lcLabel">מוצר ביטוח</label>
                <div class="lcPolSelectWrap lcPolControlShell">
                  <select class="lcSelect lcPolSelect" data-pdraft="type" ${!d.company?"disabled":""}>
                    <option value="">בחר מוצר…</option>
                    ${productOpts}
                  </select>
                </div>
              </div>`}

              <div class="lcField lcPolField lcPolField--date">
                <label class="lcLabel">תאריך תחילת ביטוח (חובה)</label>
                <div class="lcPolDateWrap lcPolControlShell">
                  <input class="lcInput lcPolDateInput" type="date" data-pdraft="startDate" value="${escapeHtml(d.startDate || "")}" />
                </div>
              </div>

              <div class="lcField lcPolField lcPolField--premiumMain">
                <label class="lcLabel">פרמיה חודשית (חובה)</label>
                <div class="lcPolMoneyWrap lcPolControlShell">
                  <span class="lcPolMoneyWrap__sym">₪</span>
                  <input class="lcInput lcPolMoneyWrap__input" type="text" inputmode="numeric" data-pdraft="premiumMonthly" value="${escapeHtml(d.premiumMonthly || "")}" placeholder="לדוגמה: 250" />
                </div>
              </div>
            </div>

            <div class="lcPolGrid lcPolGrid--money">

              ${needSum ? `<div class="lcField lcPolField lcPolField--sum">
                <label class="lcLabel">סכום ביטוח (חובה)</label>
                <input class="lcInput" type="text" inputmode="numeric" data-pdraft="sumInsured" value="${escapeHtml(d.sumInsured || "")}" placeholder="לדוגמה: 1,000,000" />
              </div>` : ``}

              ${needComp ? `<div class="lcField lcPolField lcPolField--sum">
                <label class="lcLabel">סכום פיצוי (חובה)</label>
                <input class="lcInput" type="text" inputmode="numeric" data-pdraft="compensation" value="${escapeHtml(d.compensation || "")}" placeholder="לדוגמה: 500,000" />
              </div>` : ``}

              ${canPledge ? `<div class="lcField lcPolField lcPolField--pledgeSwitch">
                <label class="lcLabel">שיעבוד</label>
                <label class="lcPolToggle">
                  <input type="checkbox" data-pdraft="pledge" ${d.pledge ? "checked":""} />
                  <span>שיעבוד (מוטב בלתי חוזר)</span>
                </label>
                <div class="help small muted">אופציונלי בריסק. בריסק משכנתא לרוב נדרש.</div>
              </div>` : ``}
            </div>

            ${(!isMedicare && d.type === "בריאות") ? `<div class="lcPolCoverCompact lcPolCoverCompact--editor">
              <div class="lcPolCoverCompact__text"><span class="lcPolCoverCompact__count">${this.getHealthCoverList(d).length || 0}</span><span>${escapeHtml(this.summarizeHealthCovers(this.getHealthCoverList(d), { max: 2, emptyLabel: "טרם נבחרו כיסויים" }))}</span></div>
              <button type="button" class="lcPolCoverCompact__btn" data-open-new-health-covers="1">${this.getHealthCoverList(d).length ? "ערוך כיסויים" : "אישור כיסויים"}</button>
            </div>` : ``}

            ${(canPledge && d.pledge) ? `<div class="lcWSection lcPledgeBox">
              <div class="lcWTitle">פרטי המוטב הבלתי חוזר</div>
              <div class="lcGrid2">
                <div class="lcField"><label class="lcLabel">שם בנק</label><input class="lcInput" data-pdraft-bank="bankName" value="${escapeHtml(d.pledgeBank.bankName||"")}" /></div>
                <div class="lcField"><label class="lcLabel">מספר בנק</label><input class="lcInput" data-pdraft-bank="bankNo" value="${escapeHtml(d.pledgeBank.bankNo||"")}" inputmode="numeric" /></div>
                <div class="lcField"><label class="lcLabel">מספר סניף</label><input class="lcInput" data-pdraft-bank="branch" value="${escapeHtml(d.pledgeBank.branch||"")}" inputmode="numeric" /></div>
                <div class="lcField"><label class="lcLabel">סכום לשיעבוד</label><input class="lcInput" data-pdraft-bank="amount" value="${escapeHtml(d.pledgeBank.amount||"")}" inputmode="numeric" /></div>
                <div class="lcField"><label class="lcLabel">לכמה שנים</label><input class="lcInput" data-pdraft-bank="years" value="${escapeHtml(d.pledgeBank.years||"")}" inputmode="numeric" /></div>
                <div class="lcField"><label class="lcLabel">כתובת הבנק</label><input class="lcInput" data-pdraft-bank="address" value="${escapeHtml(d.pledgeBank.address||"")}" /></div>
              </div>
            </div>` : ``}

            <div class="lcPolBuilderActions">
              ${this.editingPolicyId ? `<button type="button" class="lcBtn" data-cancel-editpol="1">ביטול עריכה</button>` : ``}<button type="button" class="lcBtn lcBtn--primary" data-addpol="1">${this.editingPolicyId ? "שמור שינויים" : "הוסף פוליסה"}</button>
            </div>
          </div>
        </div>
      </div>`;

      const res = form + `<div class="lcWSection">
        <div class="lcWTitle">פוליסות שנוספו</div>
        ${emptyNote}
      </div>` + groupsHtml;

      // bind handlers after render
      setTimeout(() => {
        // company card click
        $$(".lcCoCard", this.els.body).forEach(btn => {
          on(btn, "click", () => {
            this.ensurePolicyDraft();
            const co = btn.getAttribute("data-co");
            this.policyDraft.company = co || "";
            // reset product & dependent fields when changing company
            this.policyDraft.type = "";
            this.policyDraft.sumInsured = "";
            this.policyDraft.compensation = "";
            this.policyDraft.pledge = false;
            this.policyDraft.pledgeBank = { bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" };
            this.render();
          });
        });

        // insured mode toggle
        $$("[data-pdraftmode]", this.els.body).forEach(b => {
          on(b, "click", () => {
            this.ensurePolicyDraft();
            const mode = b.getAttribute("data-pdraftmode");
            if(mode === "couple" && !spouse) return;
            this.policyDraft.insuredMode = (mode === "couple") ? "couple" : "single";
            this.render();
          });
        });

        // draft field inputs
        $$("[data-pdraft]", this.els.body).forEach(el => {
          on(el, "input", () => {
            this.ensurePolicyDraft();
            const k = el.getAttribute("data-pdraft");
            if(!k) return;
            if(el.type === "checkbox") this.policyDraft[k] = !!el.checked;
            else this.policyDraft[k] = el.value;
            if(k === "type" && this.policyDraft[k] !== "בריאות") this.policyDraft.healthCovers = [];
            // Re-render only when the change affects visible structure
            if(k === "type" || k === "pledge" || k === "insuredId" || k === "company") this.render();
          });
          on(el, "change", () => {
            this.ensurePolicyDraft();
            const k = el.getAttribute("data-pdraft");
            if(!k) return;
            if(el.type === "checkbox") this.policyDraft[k] = !!el.checked;
            else this.policyDraft[k] = el.value;
            if(k === "type" && this.policyDraft[k] !== "בריאות") this.policyDraft.healthCovers = [];
            // Re-render only when the change affects visible structure
            if(k === "type" || k === "pledge" || k === "insuredId" || k === "company") this.render();
          });
        });

        $$("[data-open-new-health-covers]", this.els.body).forEach(btn => {
          on(btn, "click", () => this.openNewPolicyCoversDrawer());
        });

        $$("[data-pdraft-bank]", this.els.body).forEach(el => {
          on(el, "input", () => {
            this.ensurePolicyDraft();
            const k = el.getAttribute("data-pdraft-bank");
            if(!k) return;
            this.policyDraft.pledgeBank[k] = el.value;
          });
          on(el, "change", () => {
            this.ensurePolicyDraft();
            const k = el.getAttribute("data-pdraft-bank");
            if(!k) return;
            this.policyDraft.pledgeBank[k] = el.value;
          });
        });

        // add policy
        const addBtn = this.els.body.querySelector('[data-addpol="1"]');
        if(addBtn){
          on(addBtn, "click", () => {
            const chk = this.validateDraftPolicy();
            if(!chk.ok){
              this.setHint(chk.msg);
              return;
            }
            this.setHint("");
            this.addDraftPolicy();
          });
        }

        // edit policy buttons
        $$('[data-editpol]', this.els.body).forEach(btn => {
          on(btn, 'click', () => {
            const pid = btn.getAttribute('data-editpol');
            if(pid) this.startEditNewPolicy(pid);
          });
        });

        // delete policy buttons
        $$("[data-delpol]", this.els.body).forEach(btn => {
          on(btn, "click", () => {
            const pid = btn.getAttribute("data-delpol");
            if(pid) this.delNewPolicy(pid);
          });
        });

        const cancelEditBtn = this.els.body.querySelector('[data-cancel-editpol="1"]');
        if(cancelEditBtn){
          on(cancelEditBtn, 'click', () => this.cancelEditNewPolicy());
        }

      }, 0);

      return res;
    },

    validateDraftPolicy(){
      this.ensurePolicyDraft();
      const d = this.policyDraft;

      if(d.insuredMode === "couple"){
        const spouse = this.insureds.find(x => x.type === "spouse");
        if(!spouse) return { ok:false, msg:"כדי להוסיף פוליסה זוגית יש להוסיף בן/בת זוג בשלב 1" };
      }else{
        if(!safeTrim(d.insuredId)) return { ok:false, msg:"בחר למי שייכת הפוליסה" };
      }

      const isMedicare = this.isMedicareCompany(d.company);

      if(!safeTrim(d.company)) return { ok:false, msg:"בחר חברה" };
      if(!isMedicare && !safeTrim(d.type)) return { ok:false, msg:"בחר מוצר ביטוח" };

      if(!safeTrim(d.premiumMonthly)) return { ok:false, msg:"חובה למלא פרמיה חודשית" };
      if(!safeTrim(d.startDate)) return { ok:false, msg:"חובה למלא תאריך תחילת ביטוח" };
      if(!isMedicare && d.type === "בריאות"){
        const covers = Array.isArray(d.healthCovers) ? d.healthCovers.filter(Boolean) : [];
        if(!covers.length) return { ok:false, msg:"במוצר בריאות חובה לאשר לפחות כיסוי אחד" };
      }

      if(!isMedicare && (d.type === "סרטן" || d.type === "מחלות קשות")){
        if(!safeTrim(d.compensation)) return { ok:false, msg:"במוצר זה חובה למלא סכום פיצוי" };
      }
      if(!isMedicare && (d.type === "ריסק" || d.type === "ריסק משכנתא")){
        if(!safeTrim(d.sumInsured)) return { ok:false, msg:"בריסק/ריסק משכנתא חובה למלא סכום ביטוח" };
      }
      if(!isMedicare && (d.type === "ריסק" || d.type === "ריסק משכנתא") && d.pledge){
        const b = d.pledgeBank || {};
        const req = ["bankName","bankNo","branch","amount","years","address"];
        const ok = req.every(k => safeTrim(b[k]));
        if(!ok) return { ok:false, msg:"בשיעבוד חובה למלא את כל פרטי המוטב הבלתי חוזר" };
      }
      return { ok:true };
    },
// ---------- Step 6 ----------
    renderStep6(ins){
      const d = ins.data;
      const insuredPayers = this.insureds
        .filter(x => x.type !== "child")
        .map(x => ({ id:x.id, label:x.label, name: (safeTrim(x.data.firstName)+" "+safeTrim(x.data.lastName)).trim() || x.label }));
      const payerOpts = insuredPayers.map(x => `<option value="${x.id}"${safeTrim(d.selectedPayerId)===x.id?" selected":""}>${escapeHtml(x.name)} (${escapeHtml(x.label)})</option>`).join("");

      const method = safeTrim(d.paymentMethod || "cc");
      return `
        <div class="lcWSection">
          <div class="lcWTitle">פרטי משלם</div>
          <div class="muted small">בחירת משלם, אמצעי תשלום ופרטי חיוב לפי שיטת התשלום.</div>

          <div class="lcWGrid">
            <div class="field">
              <label class="label">בחירת משלם</label>
              <select class="input" data-payer="payerChoice">
                <option value="insured" ${d.payerChoice==="insured"?"selected":""}>מבוטח קיים</option>
                <option value="external" ${d.payerChoice==="external"?"selected":""}>משלם חריג</option>
              </select>
            </div>

            <div class="field">
              <label class="label">אמצעי תשלום</label>
              <select class="input" data-payer="paymentMethod">
                <option value="cc" ${method==="cc"?"selected":""}>כרטיס אשראי</option>
                <option value="ho" ${method==="ho"?"selected":""}>הוראת קבע</option>
              </select>
            </div>
          </div>

          <div class="divider"></div>

          ${d.payerChoice === "insured" ? `
            <div class="field">
              <label class="label">מי המשלם?</label>
              <select class="input" data-payer="selectedPayerId">
                <option value="">בחר…</option>
                ${payerOpts}
              </select>
              <div class="help">קטין לא יכול להיות משלם.</div>
            </div>
          ` : `
            <div class="lcWGrid">
              ${this.fieldText("קרבה","externalPayer.relation", d.externalPayer?.relation || "")}
              ${this.fieldText("שם פרטי","externalPayer.firstName", d.externalPayer?.firstName || "")}
              ${this.fieldText("שם משפחה","externalPayer.lastName", d.externalPayer?.lastName || "")}
              ${this.fieldText("ת״ז","externalPayer.idNumber", d.externalPayer?.idNumber || "", "numeric")}
              ${this.fieldDate("תאריך לידה","externalPayer.birthDate", d.externalPayer?.birthDate || "")}
              ${this.fieldText("טלפון","externalPayer.phone", d.externalPayer?.phone || "", "tel")}
            </div>
          `}

          <div class="divider"></div>

          ${method==="cc" ? `
            <div class="lcWGrid">
              ${this.fieldText("שם מחזיק/ה","cc.holderName", d.cc?.holderName || "")}
              ${this.fieldText("ת״ז מחזיק/ה","cc.holderId", d.cc?.holderId || "", "numeric")}
              ${this.fieldText("מספר כרטיס","cc.cardNumber", d.cc?.cardNumber || "", "numeric")}
              ${this.fieldText("תוקף (MM/YY)","cc.exp", d.cc?.exp || "", "text")}
            </div>
          ` : `
            <div class="lcWGrid">
              <div class="field">
                <label class="label">שם הבנק</label>
                <select class="input" data-payer="ho.bankName">
                  <option value="">בחר…</option>
                  ${this.bankNames.map(b => `<option value="${escapeHtml(b)}"${d.ho?.bankName===b?" selected":""}>${escapeHtml(b)}</option>`).join("")}
                </select>
              </div>
              ${this.fieldText("מספר בנק","ho.bankNo", d.ho?.bankNo || "", "numeric")}
              ${this.fieldText("מספר סניף","ho.branch", d.ho?.branch || "", "numeric")}
              ${this.fieldText("מספר חשבון","ho.account", d.ho?.account || "", "numeric")}
            </div>
          `}
        </div>
      `;
    },

    // ---------- Step 7 ----------
    renderStep7(){
      const formatPolicyInsured = (p={}) => {
        if(p.insuredMode === "couple"){
          const primaryLabel = safeTrim(this.insureds?.[0]?.label) || "מבוטח ראשי";
          const spouseLabel = safeTrim(this.insureds.find(x => x.type === "spouse")?.label);
          return spouseLabel ? `${primaryLabel} + ${spouseLabel}` : `${primaryLabel} (זוגי)`;
        }
        const ins = this.insureds.find(x => x.id === p.insuredId);
        return safeTrim(ins?.label) || "מבוטח";
      };

      const renderExistingSummaryTable = (list=[]) => {
        if(!list.length) return `<div class="muted small">אין פוליסות קיימות.</div>`;
        const rows = list.map(p => {
          const logoSrc = this.getCompanyLogoSrc(p.company);
          const logo = logoSrc
            ? `<img class="lcPolLogoMini" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(p.company||"")}" />`
            : `<div class="lcPolLogoMini lcPolLogoMini--empty" aria-hidden="true"></div>`;
          const isRisk = (p.type === "ריסק" || p.type === "ריסק משכנתא");
          const isCI = (p.type === "מחלות קשות" || p.type === "סרטן");
          const sumOrComp = isRisk ? (p.sumInsured||"") : (isCI ? (p.compensation||"") : "");
          const pledgeTxt = isRisk ? (p.hasPledge ? `כן (${escapeHtml(p.pledgeBankName||"")})` : "לא") : "—";
          return `<tr>
            <td><div class="lcPolCompanyCell">${logo}<div class="small"><b>${escapeHtml(p.company||"")}</b></div></div></td>
            <td>${escapeHtml(p.type||"")}</td>
            <td>${escapeHtml(p.policyNumber||"")}</td>
            <td>${escapeHtml(sumOrComp)}</td>
            <td>${pledgeTxt}</td>
          </tr>`;
        }).join("");
        return `<div class="lcPolTableWrap" style="margin-top:10px">
          <table class="lcPolTable">
            <thead><tr><th>חברה</th><th>סוג</th><th>מספר</th><th>סכום/פיצוי</th><th>שיעבוד</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      };

      const renderNewSummaryTable = (list=[]) => {
        if(!list.length) return `<div class="muted small">עדיין לא נוספו פוליסות חדשות.</div>`;
        const rows = list.map(p => {
          const logoSrc = this.getCompanyLogoSrc(p.company);
          const logo = logoSrc
            ? `<img class="lcPolLogoMini" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(p.company||"")}" />`
            : `<div class="lcPolLogoMini lcPolLogoMini--empty" aria-hidden="true"></div>`;
          const isMedicare = this.isMedicareCompany(p.company);
          const isRisk = !isMedicare && (p.type === "ריסק" || p.type === "ריסק משכנתא");
          const isCI = !isMedicare && (p.type === "מחלות קשות" || p.type === "סרטן");
          const insuredTxt = formatPolicyInsured(p);
          const coverageTxt = isRisk
            ? (safeTrim(p.sumInsured) ? `סכום ביטוח: ${escapeHtml(p.sumInsured)}` : "—")
            : (isCI
              ? (safeTrim(p.compensation) ? `סכום פיצוי: ${escapeHtml(p.compensation)}` : "—")
              : "—");
          let pledgeTxt = "—";
          if(isRisk){
            pledgeTxt = p.pledge ? "כן" : "לא";
            const b = p.pledgeBank || {};
            if(p.pledge && [b.bankName, b.bankNo, b.branch, b.amount, b.years, b.address].some(v => safeTrim(v))){
              const parts = [];
              if(safeTrim(b.bankName)) parts.push(`בנק: ${escapeHtml(b.bankName)}`);
              if(safeTrim(b.bankNo)) parts.push(`מס' בנק: ${escapeHtml(b.bankNo)}`);
              if(safeTrim(b.branch)) parts.push(`סניף: ${escapeHtml(b.branch)}`);
              if(safeTrim(b.amount)) parts.push(`סכום: ${escapeHtml(b.amount)}`);
              if(safeTrim(b.years)) parts.push(`שנים: ${escapeHtml(b.years)}`);
              if(safeTrim(b.address)) parts.push(`כתובת: ${escapeHtml(b.address)}`);
              pledgeTxt += `<div class="small muted">${parts.join(" · ")}</div>`;
            }
          }
          return `<tr>
            <td>${escapeHtml(insuredTxt)}</td>
            <td><div class="lcPolCompanyCell">${logo}<div class="small"><b>${escapeHtml(p.company||"")}</b></div></div></td>
            <td>${escapeHtml(isMedicare ? "מדיקר" : (p.type || ""))}</td>
            <td>${escapeHtml(p.premiumMonthly || "")}</td>
            <td>${escapeHtml(p.startDate || "")}</td>
            <td>${coverageTxt}</td>
            <td>${pledgeTxt}</td>
          </tr>`;
        }).join("");
        return `<div class="lcPolTableWrap" style="margin-top:10px">
          <table class="lcPolTable lcPolTable--summaryNew">
            <thead><tr><th>מבוטח</th><th>חברה</th><th>סוג</th><th>פרמיה חודשית</th><th>תחילת ביטוח</th><th>סכום/פיצוי</th><th>שיעבוד</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      };

      const existingCount = this.insureds.reduce((acc, ins) => acc + ((ins.data?.existingPolicies || []).length), 0);
      const newCount = (this.newPolicies || []).length;

      const existingBlocks = this.insureds.map(ins => {
        const list = ins.data?.existingPolicies || [];
        return `<div class="lcWSection lcSummarySection">
          <div class="lcWTitle">פוליסות קיימות — ${escapeHtml(ins.label)}</div>
          ${renderExistingSummaryTable(list)}
        </div>`;
      }).join("");

      const newPoliciesBlock = `<div class="lcWSection lcSummarySection">
        <div class="lcWTitle">פוליסות חדשות</div>
        <div class="muted small">להלן כל הפוליסות החדשות שנבחרו בתהליך, כולל פרמיה, תאריך תחילה, סכום ביטוח/פיצוי ופרטי שיעבוד כאשר קיימים.</div>
        ${renderNewSummaryTable(this.newPolicies || [])}
      </div>`;

      return `
        <div class="lcWSection lcSummaryHero">
          <div class="lcWTitle">סיכום הקמה</div>
          <div class="lcSummaryMeta">
            <div class="lcSummaryMetaCard"><span class="lcSummaryMetaCard__k">מבוטחים</span><strong class="lcSummaryMetaCard__v">${this.insureds.length}</strong></div>
            <div class="lcSummaryMetaCard"><span class="lcSummaryMetaCard__k">פוליסות קיימות</span><strong class="lcSummaryMetaCard__v">${existingCount}</strong></div>
            <div class="lcSummaryMetaCard"><span class="lcSummaryMetaCard__k">פוליסות חדשות</span><strong class="lcSummaryMetaCard__v">${newCount}</strong></div>
          </div>
        </div>

        ${existingBlocks}
        ${newPoliciesBlock}
      `;
    },


    // ---------- Step 8 ----------
    getHealthCompanies(){
      const supported = new Set(["כלל","הפניקס","הכשרה","הראל","מגדל","מנורה","איילון"]);
      const found = new Set();
      (this.newPolicies || []).forEach(p => {
        const c = safeTrim(p?.company);
        if(supported.has(c)) found.add(c);
      });
      return Array.from(found);
    },

    getHealthStore(){
      const primary = this.insureds[0] || { data:{} };
      primary.data = primary.data || {};
      if(!primary.data.healthDeclaration) primary.data.healthDeclaration = {};
      const out = primary.data.healthDeclaration;
      if(!out.ui) out.ui = { currentIndex: 0, summary: false };
      if(!out.responses) out.responses = {};
      return out;
    },

    parseMoneyNumber(v){
      const raw = String(v ?? '').replace(/[^0-9.]/g, '');
      if(!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    },

    getPolicyLabel(policy){
      const company = safeTrim(policy?.company);
      const type = safeTrim(policy?.type);
      return company && type ? `${company} · ${type}` : (company || type || 'פוליסה');
    },

    getHealthPoliciesForInsured(ins){
      return (this.newPolicies || []).filter(p => {
        if(safeTrim(p?.company) !== 'הפניקס') return false;
        const type = safeTrim(p?.type);
        if(!['ריסק','ריסק משכנתא','בריאות','מחלות קשות','סרטן'].includes(type)) return false;
        if(p?.insuredMode === 'couple') return ins?.type === 'primary' || ins?.type === 'spouse';
        return safeTrim(p?.insuredId) === safeTrim(ins?.id);
      });
    },

    getPhoenixFollowupSchemas(){
      const t = (key, label, type='text') => ({ key, label, type });
      const z = (key, label) => ({ key, label, type:'textarea' });
      return {
        '2': { title:'לב וכלי דם', fields:[t('diagnosis','אבחנה / סוג מחלת לב'), t('eventDate','מועד אבחון / אירוע'), t('tests','בדיקות שבוצעו (אקו / מיפוי / צנתור)'), z('status','טיפול / ניתוח / מצב כיום')] },
        '3': { title:'לחץ דם / שומנים / גורמי סיכון', fields:[t('bloodPressure','ערך לחץ דם אחרון / ממוצע'), t('lipids','ערכי שומנים / כולסטרול אם ידוע'), t('meds','תרופות קבועות'), z('riskNotes','מעקב קרדיולוגי / סיבוכים / מצב נוכחי')] },
        '4': { title:'אירועי לב / כלי דם / קרישי דם', fields:[t('vascularEvent','איזה אירוע / ממצא'), t('vascularDate','מועד האירוע'), t('hospitalization','אשפוז / צנתור / מעקף אם היה'), z('vascularStatus','סיבוכים / טיפול נוכחי / מצב כיום')] },
        '5': { title:'סוכרת', fields:[t('diabetesType','סוג סוכרת / טרום סוכרת'), t('hba1c','HbA1c אחרון'), t('diabetesTreatment','טיפול / אינסולין / כדורים'), z('diabetesComplications','סיבוכים / עיניים / כליות / נוירופתיה / מצב נוכחי')] },
        '6': { title:'בלוטת התריס / הורמונלי', fields:[t('thyroidDiagnosis','אבחנה / תת או יתר פעילות'), t('thyroidDate','מועד אבחון'), t('thyroidTreatment','טיפול / אלטרוקסין / ניתוח'), z('thyroidStatus','ערכים אחרונים / מצב כיום / מעקב')] },
        '7': { title:'שומנים / מטבולי / הורמונלי נוסף', fields:[t('metabolicDiagnosis','אבחנה מטבולית / הורמונלית'), t('metabolicValue','ערך אחרון / BMI / בדיקה רלוונטית'), t('metabolicTreatment','טיפול'), z('metabolicStatus','פירוט מצב נוכחי / סיבוכים')] },
        '8': { title:'מערכת העצבים והמוח / אפילפסיה', fields:[t('neuroDiagnosis','אבחנה / סוג הבעיה הנוירולוגית'), t('neuroType','סוג האפילפסיה / אירוע / תסמין'), t('neuroTreatment','טיפול / ניתוח / תרופות'), z('neuroStatus','תדירות התקפים / אירוע אחרון / מצב כיום')] },
        '9': { title:'מערכת העיכול', fields:[t('digestiveDiagnosis','אבחנה במערכת העיכול'), t('digestiveTreatment','טיפול / תרופות / ביולוגי / ניתוח'), t('digestiveDate','מועד אבחון'), z('digestiveStatus','סיבוכים / מעורבות מחוץ למעי / מצב כיום')] },
        '10': { title:'כבד / צהבת / הפטיטיס', fields:[t('liverDiagnosis','אבחנה בכבד / הפטיטיס'), t('liverTests','תפקודי כבד / עומס ויראלי / בדיקות'), t('liverDate','מועד אבחון'), z('liverStatus','טיפול / פיברוטסט / ביופסיה / מצב כיום')] },
        '12': { title:'עמוד שדרה', fields:[t('spineDiagnosis','אבחנה (בלט/בקע/פריצה/כאבי גב)'), t('spineArea','מיקום עמוד שדרה'), t('spineDate','מועד אבחון / אירוע'), z('spineStatus','טיפול / פיזיותרפיה / ניתוח / מגבלה נוכחית')] },
        '13': { title:'שלד / גפיים / שברים', fields:[t('orthoDiagnosis','אבחנה'), t('orthoLocation','מיקום / צד'), t('orthoDate','מועד פגיעה / אבחון'), z('orthoStatus','ניתוח / מגבלה תפקודית / כאבים / מצב כיום')] },
        '14': { title:'מפרקים ומחלות ראומטולוגיות', fields:[t('rheumDiagnosis','אבחנה ראומטולוגית'), t('rheumTreatment','טיפול / ביולוגי / עירוי / כדורים'), t('rheumComplications','פגיעה כלייתית / חלבון בשתן / סיבוכים'), z('rheumStatus','מצב כיום / התקפים / מגבלות')] },
        '15': { title:'מחלות נפש', fields:[t('mentalDiagnosis','אבחנה נפשית / הפרעת אכילה'), t('mentalTreatment','טיפול תרופתי / פסיכיאטרי / פסיכולוגי'), t('mentalDisability','נכות נפשית אם קיימת'), z('mentalStatus','אשפוז / ניסיונות אובדניים / פגישה פסיכיאטרית / מצב כיום')] },
        '16': { title:'מערכת הנשימה והריאות', fields:[t('respDiagnosis','אבחנה (אסטמה / COPD / דום נשימה וכד׳)'), t('respTreatment','טיפול / משאפים / סטרואידים'), t('respFrequency','תכיפות התקפים / חומרה'), z('respStatus','אשפוזים / תפקודי ריאה / מצב כיום')] },
        '17': { title:'גידול שפיר / ממאיר / סרטן', fields:[t('cancerDiagnosis','סוג גידול / אבחנה'), t('cancerDate','מועד אבחון'), t('cancerTreatment','טיפול / ניתוח / כימו / קרינה'), z('cancerStatus','שלב / גרורות / מעקב / מצב כיום')] },
        '18': { title:'בדיקות פולשניות / הדמיה', fields:[t('testType','איזו בדיקה'), t('testDate','מועד הבדיקה / ההמלצה'), t('testResult','תוצאה / ממצא'), z('testFollowup','מה הומלץ בהמשך / האם הושלם בירור')] },
        '19': { title:'נכות / תביעת נכות', fields:[t('disabilityPercent','דרגת נכות %'), t('disabilityReason','סיבת הנכות / התביעה'), t('disabilityDate','מתי נקבע / הוגש'), z('disabilityStatus','מצב תפקודי / סטטוס התביעה / קצבאות')] },
        '20': { title:'אשפוז / ניתוח / השתלה', fields:[t('hospitalType','סוג אשפוז / ניתוח / השתלה'), t('hospitalDate','מועד'), t('hospitalDays','משך אשפוז'), z('hospitalStatus','סיבת האשפוז / סיבוכים / מצב כיום / האם הומלץ עתידי')] },
        '22': { title:'היסטוריה משפחתית', fields:[t('familyRelative','איזה קרוב מדרגה ראשונה'), t('familyDisease','איזו מחלה'), t('familyAge','באיזה גיל אובחן'), z('familyNotes','האם יותר מקרוב אחד / פירוט נוסף')] }
      };
    },

    buildPhoenixFollowupFields(questionnaireNos=[], baseFields=[]){
      const map = this.getPhoenixFollowupSchemas();
      const out = [];
      const seen = new Set();
      (questionnaireNos || []).forEach(no => {
        const schema = map[String(no)];
        if(!schema) return;
        out.push({ type:'section', label:`שאלון ${String(no)} · ${schema.title}` });
        (schema.fields || []).forEach(f => {
          const key = `${String(no)}__${f.key}`;
          if(seen.has(key)) return;
          seen.add(key);
          out.push({ ...f, key });
        });
      });
      if(baseFields && baseFields.length){
        out.push({ type:'section', label:'פירוט משלים' });
        baseFields.forEach(f => {
          const key = `base__${f.key}`;
          if(seen.has(key)) return;
          seen.add(key);
          out.push({ ...f, key });
        });
      }
      return out.length ? out : (baseFields || []);
    },

    buildPhoenixQuestionnaireCatalog(){
      const detailFields = [
        { key:'diagnosis', label:'אבחנה / מחלה / בדיקה', type:'text' },
        { key:'dates', label:'מועד התחלה / סיום / אבחון', type:'text' },
        { key:'complications', label:'סיבוכים / אירועים חוזרים / הבראה מלאה', type:'textarea' },
        { key:'treatment', label:'סוג טיפול (תרופה / ניתוח / מעקב)', type:'textarea' }
      ];
      const familyFields = [
        { key:'relative', label:'איזה קרוב מדרגה ראשונה', type:'text' },
        { key:'disease', label:'איזו מחלה', type:'text' },
        { key:'age', label:'באיזה גיל אובחן', type:'text' }
      ];
      return {
        short_risk: {
          title: 'הפניקס · הצהרת בריאות מקוצרת',
          sourceLabel: 'עבור ריסק עד 2 מיליון ועד גיל 55',
          steps: [
            { key:'s2_treatment', text:'האם בשנה האחרונה טופלת או הומלץ על טיפול תרופתי יותר מ-3 שבועות?', fields:[{ key:'medName', label:'שם התרופה', type:'text' },{ key:'reason', label:'סיבת טיפול', type:'textarea' }]},
            { key:'s3_tests', text:'האם בשנה האחרונה הומלץ לך או שהינך מועמד לביצוע בדיקה פולשנית, בדיקת הדמיה או ניתוח?', questionnaireNos:['18','20'], fields:[{ key:'testType', label:'סוג בדיקה / ניתוח', type:'text' },{ key:'date', label:'תאריך', type:'text' },{ key:'hospitalDays', label:'משך אשפוז', type:'text' }]},
            { key:'s4_smoking', text:'האם הינך מעשן או עישנת במהלך השנתיים האחרונות?', fields:[{ key:'cigarettes', label:'כמות סיגריות', type:'text' },{ key:'quitDate', label:'תאריך הפסקת עישון', type:'text' }]},
            { key:'s5_1_heart', text:'האם אובחנה מחלת לב, כלי דם או דם?', questionnaireNos:['2','3','4'], fields: detailFields },
            { key:'s5_2_neuro', text:'האם אובחנה מחלה במערכת העצבים והמוח?', questionnaireNos:['8'], fields: detailFields },
            { key:'s5_3_cancer', text:'האם אובחן גידול ממאיר (סרטן)?', questionnaireNos:['17'], fields: detailFields },
            { key:'s5_4_kidney', text:'האם אובחנה מחלת כליות או שתן?', fields: detailFields },
            { key:'s5_5_liver', text:'האם אובחנה מחלת כבד?', questionnaireNos:['10'], fields: detailFields },
            { key:'s5_6_lungs', text:'האם אובחנה מחלת נשימה או ריאות?', questionnaireNos:['16'], fields: detailFields },
            { key:'s6_vision', text:'האם קיימת בעיית ראייה?', fields: detailFields },
            { key:'s7_ortho', text:'האם קיימת בעיית שלד, מפרקים, אורתופדיה או ראומטולוגיה?', questionnaireNos:['12','13','14'], fields: detailFields },
            { key:'s8_hearing', text:'האם קיימת בעיית שמיעה?', fields: detailFields },
            { key:'s9_digestive', text:'האם קיימת מחלת מערכת עיכול?', questionnaireNos:['9'], fields: detailFields },
            { key:'s10_endocrine', text:'האם קיימת מחלת מערכת הפרשה פנימית, לרבות סוכרת?', questionnaireNos:['5','6'], fields: detailFields },
            { key:'s11_mental', text:'האם קיימת מחלת נפש, לרבות דיכאון?', questionnaireNos:['15'], fields: detailFields },
            { key:'s12_disability', text:'האם נקבעה נכות או שהינך בהליך תביעת נכות?', questionnaireNos:['19'], fields:[{ key:'percent', label:'דרגת נכות %', type:'text' },{ key:'reason', label:'סיבת הנכות / ההליך', type:'textarea' }]}
          ]
        },
        extended_risk: {
          title: 'הפניקס · הצהרת בריאות מורחבת',
          sourceLabel: 'עבור ריסק מעל 2 מיליון ו/או מעל גיל 55',
          steps: [
            { key:'e2_weight', text:'האם היו שינויים של למעלה מ-5 ק״ג במשקל בשנה האחרונה?', fields:[{ key:'change', label:'כמה ק״ג ובאיזה כיוון', type:'text' },{ key:'reason', label:'סיבה לשינוי', type:'textarea' }]},
            { key:'e3_meds', text:'האם בשנה האחרונה נטלת תרופות שנרשמו על ידי רופא למשך יותר מ-3 שבועות או נוטל תרופות ללא מרשם באופן קבוע?', fields:[{ key:'medName', label:'שם התרופה', type:'text' },{ key:'reason', label:'סיבת טיפול', type:'textarea' }]},
            { key:'e4_hospital', text:'האם אושפזת ב-5 השנים האחרונות כולל למטרת ניתוח?', questionnaireNos:['20'], fields:[{ key:'hospitalType', label:'סוג אשפוז / ניתוח', type:'text' },{ key:'date', label:'תאריך', type:'text' },{ key:'days', label:'משך אשפוז', type:'text' }]},
            { key:'e5_disability', text:'האם נקבעה לך נכות מכל סיבה שהיא או שהינך בתהליך קביעת נכות / תביעת נכות בשנתיים האחרונות?', questionnaireNos:['19'], fields:[{ key:'percent', label:'דרגת נכות %', type:'text' },{ key:'reason', label:'פירוט סיבה / הליך', type:'textarea' }]},
            { key:'e6_tests', text:'האם עברת או הומלץ לך לעבור ב-5 השנים האחרונות בדיקות פולשניות או בדיקות הדמיה?', questionnaireNos:['18'], fields:[{ key:'testType', label:'סוג בדיקה', type:'text' },{ key:'date', label:'תאריך', type:'text' },{ key:'result', label:'תוצאה / סטטוס', type:'textarea' }]},
            { key:'e7_surgery', text:'האם עברת ניתוח או הומלץ על ניתוח בעתיד או השתלת איבר ב-10 השנים האחרונות?', questionnaireNos:['20'], fields:[{ key:'procedure', label:'איזה ניתוח / השתלה', type:'text' },{ key:'date', label:'תאריך', type:'text' },{ key:'status', label:'מצב כיום / מה הומלץ', type:'textarea' }]},
            { key:'e8_smoking', text:'האם הינך מעשן או עישנת במהלך השנתיים האחרונות?', fields:[{ key:'cigarettes', label:'כמות סיגריות', type:'text' },{ key:'quitDate', label:'תאריך הפסקת עישון', type:'text' }]},
            { key:'e9_drugs', text:'האם השתמשת אי פעם או שהינך משתמש בסמים מכל סוג שהוא?', fields:[{ key:'drugType', label:'סוג', type:'text' },{ key:'freq', label:'תדירות', type:'text' },{ key:'stopDate', label:'מועד הפסקה', type:'text' }]},
            { key:'e10_alcohol', text:'האם הינך צורך או צרכת בעבר יותר מ-14 כוסות / פחיות משקאות חריפים בשבוע?', fields:[{ key:'amount', label:'כמות שבועית', type:'text' },{ key:'details', label:'פירוט', type:'textarea' }]},
            { key:'e11_1_heart', text:'האם אובחנה מחלת לב וכלי דם?', questionnaireNos:['2','3','4'], fields: detailFields },
            { key:'e11_2_neuro', text:'האם אובחנה מחלה במערכת העצבים והמוח?', questionnaireNos:['8'], fields: detailFields },
            { key:'e11_3_digestive', text:'האם אובחנה מחלת מערכת העיכול?', questionnaireNos:['9'], fields: detailFields },
            { key:'e11_4_endocrine', text:'האם אובחנה מחלה במערכות ההפרשה הפנימית, לרבות סוכרת או שומנים בדם?', questionnaireNos:['5','6'], fields: detailFields },
            { key:'e11_5_liver', text:'האם אובחנה מחלת כבד?', questionnaireNos:['10'], fields: detailFields },
            { key:'e11_6_ortho', text:'האם אובחנה מחלת שלד / פרקים / ראומטולוגיה?', questionnaireNos:['12','13','14'], fields: detailFields },
            { key:'e11_7_lungs', text:'האם אובחנה מחלת נשימה או ריאות?', questionnaireNos:['16'], fields: detailFields },
            { key:'e11_8_kidney', text:'האם אובחנה מחלת כליות?', fields: detailFields },
            { key:'e11_9_mental', text:'האם אובחנה מחלת נפש?', questionnaireNos:['15'], fields: detailFields },
            { key:'e11_10_senses', text:'האם קיימת מחלת מערכת החושים, לרבות ראייה / שמיעה?', fields: detailFields },
            { key:'e11_11_hiv', text:'האם הינך נשא HIV או חולה איידס?', fields: detailFields },
            { key:'e11_12_cancer', text:'האם אובחן גידול שפיר או ממאיר?', questionnaireNos:['17'], fields: detailFields },
            { key:'e11_13_blood', text:'האם אובחנה מחלת דם?', fields: detailFields },
            { key:'e11_14_immune', text:'האם אובחנה מחלה במערכת החיסון / אוטואימונית?', fields: detailFields },
            { key:'e11_15_male', text:'האם קיימת מחלה או הפרעה במערכת המין הזכרית?', fields: detailFields },
            { key:'e11_16_female', text:'האם קיימת מחלה או הפרעה במערכת המין הנשית או הריון?', fields: detailFields },
            { key:'e11_17_family', text:'האם ידוע על קרוב משפחה מדרגה ראשונה שחלה לפני גיל 60?', questionnaireNos:['22'], fields: familyFields }
          ]
        },
        full_health: {
          title: 'הפניקס · הצהרת בריאות מלאה',
          sourceLabel: 'ביטוח בריאות',
          steps: [
            { key:'fh_smoking', text:'האם הנך מעשן או עישנת בשנתיים האחרונות, לרבות סיגריה אלקטרונית ו/או נרגילה?', fields:[{ key:'cigarettes', label:'כמות סיגריות ליום', type:'text' }]},
            { key:'fh_family', text:'האם בקרב קרוב משפחה מדרגה ראשונה התגלו מחלות משמעותיות לפני גיל 60?', questionnaireNos:['22'], fields: familyFields },
            { key:'fh_drugs', text:'האם הינך צורך כעת או צרכת בעבר סמים מסוג כלשהו?', fields:[{ key:'drugType', label:'סוג', type:'text' },{ key:'freq', label:'תדירות', type:'text' },{ key:'stopDate', label:'מועד הפסקה', type:'text' }]},
            { key:'fh_alcohol', text:'האם הינך צורך או צרכת בעבר באופן קבוע יותר מ-2 כוסות משקה אלכוהולי ליום?', fields:[{ key:'amount', label:'כמות יומית', type:'text' },{ key:'details', label:'פירוט', type:'textarea' }]},
            { key:'fh_heart', text:'האם אובחנה מחלת לב, כלי דם או דם?', questionnaireNos:['2','3','4'], fields: detailFields },
            { key:'fh_neuro', text:'האם אובחנה מחלה במערכת העצבים והמוח?', questionnaireNos:['8'], fields: detailFields },
            { key:'fh_digestive', text:'האם אובחנה מחלה במערכת העיכול?', questionnaireNos:['9','10'], fields: detailFields },
            { key:'fh_endocrine', text:'האם אובחנה מחלה במערכת ההפרשה הפנימית, לרבות סוכרת?', questionnaireNos:['5','6','7'], fields: detailFields },
            { key:'fh_vision', text:'האם אובחנה מחלת עיניים או הפרעת ראייה?', fields: detailFields },
            { key:'fh_ent', text:'האם אובחנה מחלה במערכת אף, אוזן, גרון?', fields: detailFields },
            { key:'fh_ortho', text:'האם אובחנה מחלה או כאב במערכת השלד / מפרקים / ראומטולוגיה?', questionnaireNos:['12','13','14'], fields: detailFields },
            { key:'fh_lungs', text:'האם אובחנה מחלה במערכת הנשימה והריאות?', questionnaireNos:['16'], fields: detailFields },
            { key:'fh_kidney', text:'האם אובחנה מחלה במערכת הכליות או בדרכי השתן?', fields: detailFields },
            { key:'fh_cancer', text:'האם אובחנה מחלה ממארת, גידול שפיר או ממאיר?', questionnaireNos:['17'], fields: detailFields },
            { key:'fh_blood', text:'האם אובחנה מחלת דם או הפרעת קרישה?', fields: detailFields },
            { key:'fh_skin', text:'האם אובחנה מחלת עור או תופעה בעור?', fields: detailFields },
            { key:'fh_immune', text:'האם אובחנה מחלה במערכת החיסון / אוטואימונית?', fields: detailFields },
            { key:'fh_hernia', text:'האם קיים בקע / הרניה?', fields: detailFields },
            { key:'fh_mental', text:'האם אובחנה מחלת נפש או הפרעת אכילה?', questionnaireNos:['15'], fields: detailFields },
            { key:'fh_premature', text:'לילדים עד גיל שנה – האם נולד פג?', fields:[{ key:'week', label:'שבוע לידה', type:'text' },{ key:'details', label:'פירוט מצב בלידה / אשפוז', type:'textarea' }]},
            { key:'fh_congenital', text:'האם קיימים מומים מולדים, עיכוב התפתחותי או אבחנה בילדות?', fields: detailFields },
            { key:'fh_additional_tests', text:'האם עברת או הומלץ לך לעבור בדיקות פולשניות / הדמיה ב-5 השנים האחרונות?', questionnaireNos:['18'], fields:[{ key:'testType', label:'סוג בדיקה', type:'text' },{ key:'date', label:'תאריך', type:'text' },{ key:'result', label:'תוצאה / סטטוס', type:'textarea' }]},
            { key:'fh_surgery', text:'האם אושפזת, עברת ניתוח או הומלץ על ניתוח עתידי?', questionnaireNos:['20'], fields:[{ key:'procedure', label:'איזה אשפוז / ניתוח', type:'text' },{ key:'date', label:'תאריך', type:'text' },{ key:'status', label:'מצב כיום', type:'textarea' }]},
            { key:'fh_meds', text:'האם הינך נוטל או הומלץ לך ליטול תרופות באופן קבוע ב-3 השנים האחרונות?', fields:[{ key:'medName', label:'שם התרופה', type:'text' },{ key:'reason', label:'סיבת טיפול', type:'textarea' }]},
            { key:'fh_disability', text:'האם נקבעה לך נכות זמנית / צמיתה או שהינך בתהליך קביעת נכות?', questionnaireNos:['19'], fields:[{ key:'percent', label:'דרגת נכות %', type:'text' },{ key:'reason', label:'פירוט סיבה / תביעה', type:'textarea' }]}
          ]
        },
        critical_illness: {
          title: 'הפניקס · הצהרת בריאות מחלות קשות',
          sourceLabel: 'מחלות קשות / סרטן',
          steps: [
            { key:'ci_smoking', text:'האם הנך מעשן או עישנת בשנתיים האחרונות?', fields:[{ key:'cigarettes', label:'כמות סיגריות ליום', type:'text' }]},
            { key:'ci_family', text:'האם בקרב קרוב משפחה מדרגה ראשונה התגלו מחלות משמעותיות עד גיל 60?', questionnaireNos:['22'], fields: familyFields },
            { key:'ci_tests', text:'האם עברת או הומלץ לך לעבור בדיקות פולשניות / הדמיה או בדיקות לגילוי מוקדם של סרטן ב-5 השנים האחרונות?', questionnaireNos:['18'], fields:[{ key:'testType', label:'איזו בדיקה', type:'text' },{ key:'date', label:'מתי', type:'text' },{ key:'result', label:'תוצאה / סטטוס', type:'textarea' }]},
            { key:'ci_cancer', text:'האם חלית במחלה או גידול ממאיר / טרום סרטני / גידול שפיר?', questionnaireNos:['17'], fields: detailFields },
            { key:'ci_digestive', text:'האם אובחנה מחלת קרוהן, קוליטיס, כבד, צהבת או דם בצואה?', questionnaireNos:['9','10'], fields: detailFields },
            { key:'ci_immune', text:'האם קיים דיכוי חיסוני, HIV או השתלת איברים?', fields: detailFields },
            { key:'ci_heightweight', text:'האם יש ממצא חריג בגובה / משקל או BMI שדורש פירוט?', fields:[{ key:'height', label:'גובה', type:'text' },{ key:'weight', label:'משקל', type:'text' },{ key:'details', label:'פירוט', type:'textarea' }]},
            { key:'ci_alcohol', text:'האם הינך צורך באופן קבוע יותר מ-2 כוסות משקה אלכוהולי ליום?', fields:[{ key:'amount', label:'כמות יומית', type:'text' },{ key:'details', label:'פירוט', type:'textarea' }]},
            { key:'ci_hospital', text:'האם ב-5 השנים האחרונות אושפזת, עברת ניתוח או הומלץ לך לעבור ניתוח עתידי?', questionnaireNos:['20'], fields:[{ key:'procedure', label:'איזה ניתוח / אשפוז', type:'text' },{ key:'date', label:'מתי', type:'text' },{ key:'status', label:'מצב כיום', type:'textarea' }]},
            { key:'ci_meds', text:'האם הינך נוטל או הומלץ לך ליטול תרופות באופן קבוע בשלוש השנים האחרונות?', fields:[{ key:'medName', label:'שם התרופה', type:'text' },{ key:'reason', label:'סיבת טיפול', type:'textarea' }]},
            { key:'ci_heart', text:'האם אובחנה מחלת לב, כלי דם או דם?', questionnaireNos:['2','3','4'], fields: detailFields },
            { key:'ci_neuro', text:'האם אובחנה מחלה במערכת העצבים והמוח?', questionnaireNos:['8'], fields: detailFields },
            { key:'ci_senses', text:'האם אובחנה מחלה במערכת החושים (ראייה / שמיעה)?', fields: detailFields },
            { key:'ci_lungs', text:'האם אובחנה מחלה במערכת הנשימה והריאות?', questionnaireNos:['16'], fields: detailFields },
            { key:'ci_ortho', text:'האם אובחנה מחלה אורטופדית / ראומטולוגית?', questionnaireNos:['12','13','14'], fields: detailFields },
            { key:'ci_kidney', text:'האם אובחנה מחלה במערכת הכליות והשתן?', fields: detailFields }
          ]
        }
      };
    },

    getPhoenixHealthSchema(){
      const catalog = this.buildPhoenixQuestionnaireCatalog();
      const categories = [];
      const seen = new Set();
      const phoenixPolicies = (this.newPolicies || []).filter(policy => safeTrim(policy?.company) === 'הפניקס');
      const healthPolicies = phoenixPolicies.filter(policy => safeTrim(policy?.type) === 'בריאות');
      const hasPhoenixHealth = healthPolicies.length > 0;

      if(hasPhoenixHealth && catalog.full_health){
        const healthSchema = catalog.full_health;
        const healthLabels = healthPolicies.map(policy => this.getPolicyLabel(policy)).filter(Boolean);
        const inheritedLabels = phoenixPolicies
          .filter(policy => {
            const type = safeTrim(policy?.type);
            return type && type !== 'בריאות' && (
              type === 'מחלות קשות' ||
              type === 'סרטן' ||
              type === 'ריסק' ||
              type === 'ריסק משכנתא'
            );
          })
          .map(policy => this.getPolicyLabel(policy))
          .filter(Boolean);
        categories.push({
          key: 'phoenix_health_master',
          title: healthSchema.title,
          summary: healthSchema.sourceLabel,
          policyId: healthPolicies[0]?.id || '',
          questions: (healthSchema.steps || []).map(step => ({
            ...step,
            key: `phoenix_health_master__${step.key}`,
            originalKey: step.key,
            companies:['הפניקס'],
            policyLabel: healthLabels[0] || healthSchema.sourceLabel,
            fields: this.buildPhoenixFollowupFields(step.questionnaireNos || [], step.fields || []),
            requirements: {
              default: [
                healthSchema.sourceLabel,
                ...(step.questionnaireNos?.length ? [`יש למלא שאלון/י המשך: ${step.questionnaireNos.join(', ')}`] : []),
                'נבחר מוצר בריאות — הצהרת הבריאות של הבריאות משמשת כהצהרת אב לכל המוצרים הרפואיים הרלוונטיים.'
              ],
              'הפניקס': [
                `פוליסות מקור: ${healthLabels.join(' · ') || 'ביטוח בריאות'}`,
                ...(inheritedLabels.length ? [`פוליסות יורשות: ${inheritedLabels.join(' · ')}`] : []),
                'מחלות קשות / סרטן / ריסק / ריסק משכנתא יירשו אוטומטית מהצהרת הבריאות ולא יוצגו כהצהרה נפרדת.'
              ]
            }
          }))
        });
      }

      phoenixPolicies.forEach(policy => {
        const type = safeTrim(policy?.type);
        let schemaKey = '';
        if(type === 'בריאות') return;
        if(hasPhoenixHealth && (type === 'מחלות קשות' || type === 'סרטן' || type === 'ריסק' || type === 'ריסק משכנתא')) return;
        if(type === 'מחלות קשות' || type === 'סרטן') schemaKey = 'critical_illness';
        else if(type === 'ריסק' || type === 'ריסק משכנתא'){
          const insured = (this.insureds || []).find(x => x.id === policy.insuredId) || this.insureds[0] || { data:{} };
          const age = this.calcAge(insured?.data?.birthDate);
          const sum = this.parseMoneyNumber(policy?.sumInsured);
          schemaKey = (age !== null && age <= 55 && sum !== null && sum <= 2000000) ? 'short_risk' : 'extended_risk';
        }
        if(!schemaKey || !catalog[schemaKey]) return;
        const dedupeKey = `${schemaKey}|${safeTrim(policy?.company)}|${safeTrim(policy?.type)}|${safeTrim(policy?.insuredMode)}|${safeTrim(policy?.insuredId)}`;
        if(seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        const schema = catalog[schemaKey];
        categories.push({
          key: `phoenix_${policy.id || categories.length}_${schemaKey}`,
          title: `${this.getPolicyLabel(policy)} — ${schema.title}`,
          summary: schema.sourceLabel,
          policyId: policy.id,
          questions: (schema.steps || []).map(step => ({
            ...step,
            key: `${policy.id || 'p'}__${step.key}`,
            originalKey: step.key,
            companies:['הפניקס'],
            policyLabel: this.getPolicyLabel(policy),
            fields: this.buildPhoenixFollowupFields(step.questionnaireNos || [], step.fields || []),
            requirements: { default: [schema.sourceLabel, ...(step.questionnaireNos?.length ? [`יש למלא שאלון/י המשך: ${step.questionnaireNos.join(', ')}`] : [])], 'הפניקס': [`פוליסה: ${this.getPolicyLabel(policy)}`] }
          }))
        });
      });
      return categories;
    },

    getHealthSchema(){
      const allCompanies = ["כלל","הפניקס","הכשרה","הראל","מגדל","מנורה","איילון"];
      const lifeCompanies = ["כלל","הפניקס","הראל","מגדל","מנורה","איילון"];
      const mkReq = (defaultItems=[], extra={}) => ({ default: defaultItems, ...extra });
      return [
        {
          key:"general",
          title:"מצב רפואי כללי",
          summary:"בירור, מחלות כרוניות, תרופות, בדיקות, אשפוזים ונכויות.",
          questions:[
            { key:"general_followup", text:"האם אתה נמצא כיום בבירור רפואי, מעקב, טיפול קבוע או בהמתנה לתוצאה רפואית?", companies: allCompanies, fields:[
              { key:"reason", label:"מה מהות הבירור / המעקב", type:"text" },
              { key:"since", label:"ממתי", type:"text" },
              { key:"status", label:"מה המצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של סיבת הבירור, ממתי ומצב נוכחי"]) },
            { key:"general_chronic", text:"האם אובחנה אצלך מחלה כרונית, מצב רפואי מתמשך או צורך במעקב רפואי קבוע?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"date", label:"מועד אבחון", type:"text" },
              { key:"status", label:"טיפול / מצב נוכחי", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה, מועד אבחון וטיפול נוכחי"]) },
            { key:"general_meds", text:"האם אתה נוטל תרופות באופן קבוע?", companies: allCompanies, fields:[
              { key:"meds", label:"שמות התרופות", type:"textarea" },
              { key:"why", label:"לשם מה ניטלות התרופות", type:"text" },
              { key:"since", label:"ממתי", type:"text" }
            ], requirements: mkReq(["שם התרופות + סיבת נטילה"]) },
            { key:"general_test_wait", text:"האם הומלץ לך לעבור בדיקה, טיפול או ניתוח שטרם בוצעו?", companies: allCompanies, fields:[
              { key:"what", label:"איזו בדיקה / טיפול / ניתוח", type:"text" },
              { key:"why", label:"סיבה רפואית", type:"textarea" },
              { key:"when", label:"מתי הומלץ", type:"text" }
            ], requirements: mkReq(["פירוט מה הומלץ ומה סיבת הבירור"], { "הפניקס":["לציין גם האם הומלץ המשך בירור"], "הראל":["בדיקה או אשפוז מחייבים פירוט מלא"] }) },
            { key:"general_hospital", text:"האם היית באשפוז בבית חולים או במיון ב-5 השנים האחרונות?", companies: allCompanies, fields:[
              { key:"date", label:"מועד האשפוז", type:"text" },
              { key:"reason", label:"סיבת האשפוז / אבחנה", type:"text" },
              { key:"status", label:"האם הבעיה חלפה / נדרש המשך בירור", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של כל אשפוז"], { "הפניקס":["אשפוז מחייב מועד, אבחנה והאם הבעיה חלפה"], "הראל":["אשפוז מחייב פירוט כמפורט בדגשי חיתום"] }) },
            { key:"general_surgery", text:"האם עברת ניתוח, צנתור, ביופסיה, אנדוסקופיה או פרוצדורה פולשנית?", companies: allCompanies, fields:[
              { key:"procedure", label:"איזו פרוצדורה", type:"text" },
              { key:"date", label:"מתי", type:"text" },
              { key:"result", label:"תוצאה / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט סוג הפרוצדורה, מועד ותוצאה"]) },
            { key:"general_disability", text:"האם קיימת נכות רפואית, אובדן כושר, קצבה, או מגבלה תפקודית קבועה?", companies: allCompanies, fields:[
              { key:"reason", label:"סיבת הנכות / המגבלה", type:"text" },
              { key:"percent", label:"אחוז נכות / סוג קצבה", type:"text" },
              { key:"details", label:"פירוט מצב תפקודי", type:"textarea" }
            ], requirements: mkReq(["פירוט סיבת הנכות והמצב התפקודי"], { "הראל":["עדיף פרוטוקול ביטוח לאומי / משרד הביטחון אם קיים"] }) }
          ]
        },
        {
          key:"heart",
          title:"לב וכלי דם",
          summary:"לב, לחץ דם, שומנים, כלי דם וגורמי סיכון.",
          questions:[
            { key:"heart_disease", text:"האם אובחנת במחלת לב, מחלת לב איסכמית, אוטם, צנתור, מעקפים, מסתמים או אוושה?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה מדויקת", type:"text" },
              { key:"date", label:"מועד אבחון / אירוע", type:"text" },
              { key:"details", label:"בדיקות שבוצעו / צנתור / ניתוח / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["שאלון לב"], { "הפניקס":["לעיתים נדרש תיעוד קרדיולוג כולל אקו / מיפוי / מאמץ"], "הראל":["תיעוד מרופא עדיף קרדיולוג עם חומרה ובדיקות"] }) },
            { key:"heart_arrhythmia", text:"האם קיימת הפרעת קצב, פלפיטציות, קוצב או טיפול קרדיולוגי קבוע?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"סוג ההפרעה", type:"text" },
              { key:"treatment", label:"טיפול / תרופות / קוצב", type:"text" },
              { key:"last", label:"מצב נוכחי / אירוע אחרון", type:"textarea" }
            ], requirements: mkReq(["פירוט סוג הפרעת הקצב והטיפול"]) },
            { key:"heart_hypertension", text:"האם אובחנת ביתר לחץ דם?", companies: allCompanies, fields:[
              { key:"avg", label:"ערך לחץ דם ממוצע / אחרון", type:"text" },
              { key:"since", label:"ממתי", type:"text" },
              { key:"meds", label:"טיפול / תרופות", type:"textarea" }
            ], requirements: mkReq(["ערך לחץ דם אחרון / ממוצע וטיפול"], { "הראל":["נדרש ערך לחץ דם מהשנה האחרונה"], "הפניקס":["יתר לחץ דם הוא גורם סיכון הדורש פירוט"] }) },
            { key:"heart_lipids", text:"האם יש יתר שומנים בדם, כולסטרול גבוה או טריגליצרידים גבוהים?", companies: allCompanies, fields:[
              { key:"value", label:"ערך אחרון ידוע", type:"text" },
              { key:"meds", label:"טיפול / תרופות", type:"text" },
              { key:"since", label:"ממתי", type:"text" }
            ], requirements: mkReq(["פירוט ערכים וטיפול"], { "הראל":["לכולסטרול / טריגליצרידים יש לציין ערך אחרון"] }) },
            { key:"heart_vessels", text:"האם קיימת מחלת כלי דם, מפרצת, קרישיות או אירוע של קריש דם?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה / מיקום", type:"text" },
              { key:"date", label:"מועד האירוע", type:"text" },
              { key:"details", label:"טיפול / סיבוכים / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של אבחנה, טיפול וסיבוכים"], { "הראל":["מחלת כלי דם מחייבת לעיתים תיעוד מומחה כלי דם"] }) }
          ]
        },
        {
          key:"respiratory",
          title:"ריאות ונשימה",
          summary:"אסתמה, COPD, דום נשימה, מחלות ריאה ואשפוזי נשימה.",
          questions:[
            { key:"resp_asthma", text:"האם אובחנת באסתמה?", companies: allCompanies, fields:[
              { key:"since", label:"מועד אבחון", type:"text" },
              { key:"severity", label:"תדירות התקפים / חומרה", type:"text" },
              { key:"treatment", label:"טיפול קבוע / משאפים / סטרואידים", type:"textarea" }
            ], requirements: mkReq(["שאלון ריאות / אסתמה"], { "הפניקס":["יש לציין אם טיפול קבוע או בעת התקף והאם היה פרדניזון / אשפוז"], "איילון":["לעיתים נדרש סיכום רופא ותפקודי ריאות"] }) },
            { key:"resp_copd", text:"האם אובחנת ב-COPD, אמפיזמה, ברונכיטיס כרונית או מחלת ריאות כרונית אחרת?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"tests", label:"תפקודי ריאות / בדיקות שבוצעו", type:"text" },
              { key:"details", label:"טיפול / חמצן / מצב נוכחי", type:"textarea" }
            ], requirements: mkReq(["שאלון ריאות"], { "הפניקס":["ב-COPD נדרש תיעוד רפואי כולל תפקודי ריאות"], "הראל":["מחלת ריאות חסימתית מחייבת תיעוד רופא ריאות"] }) },
            { key:"resp_sleep", text:"האם אובחנת בדום נשימה בשינה?", companies: allCompanies, fields:[
              { key:"severity", label:"חומרה (קל / בינוני / קשה)", type:"text" },
              { key:"treatment", label:"טיפול / CPAP", type:"text" },
              { key:"details", label:"פירוט נוסף", type:"textarea" }
            ], requirements: mkReq(["פירוט חומרה וטיפול"], { "הראל":["יש לציין חומרה"], "איילון":["יש לציין חומרה וטיפול"] }) },
            { key:"resp_other", text:"האם קיימת מחלת ריאות או נשימה אחרת, כולל פנאומוטורקס, סרקואידוזיס או סינוסיטיס כרונית?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"date", label:"מתי", type:"text" },
              { key:"details", label:"טיפול / אשפוזים / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה, טיפול ואשפוזים"]) }
          ]
        },
        {
          key:"neuro",
          title:"נוירולוגיה ומוח",
          summary:"אפילפסיה, שבץ, טרשת, חבלות ראש, סחרחורות והתפתחות.",
          questions:[
            { key:"neuro_epilepsy", text:"האם אובחנת באפילפסיה, פרכוסים או אירועי התנתקות?", companies: allCompanies, fields:[
              { key:"type", label:"סוג (פטיט מאל / גראנד מאל / אחר)", type:"text" },
              { key:"freq", label:"תדירות התקפים", type:"text" },
              { key:"details", label:"טיפול / מועד התקף אחרון", type:"textarea" }
            ], requirements: mkReq(["שאלון אפילפסיה"], { "כלל":["פירוט סוג ההתקפים ומועד אחרון"], "מנורה":["אפילפסיה מחייבת שאלון ייעודי"], "איילון":["יש לציין מספר התקפים וטיפול תרופתי"] }) },
            { key:"neuro_stroke", text:"האם עברת שבץ מוחי, אירוע מוחי חולף (TIA), דימום מוחי או חבלת ראש משמעותית?", companies: allCompanies, fields:[
              { key:"event", label:"איזה אירוע", type:"text" },
              { key:"date", label:"מתי", type:"text" },
              { key:"status", label:"נזק שארי / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של האירוע והמצב הנוכחי"], { "הפניקס":["לעיתים יידרש תיעוד נוירולוג"], "כלל":["שבץ / TIA נכללים בשאלון עצבים"] }) },
            { key:"neuro_deg", text:"האם אובחנת בטרשת נפוצה, פרקינסון, ניוון שרירים, מיאסטניה או מחלה נוירולוגית אחרת?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"date", label:"מועד אבחון", type:"text" },
              { key:"details", label:"טיפול / מגבלות / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה וטיפול"], { "הפניקס":["מחלה נוירולוגית מחייבת תיעוד נוירולוג"], "הראל":["תיעוד נוירולוג עדכני עשוי להידרש"] }) },
            { key:"neuro_symptoms", text:"האם קיימות סחרחורות, התעלפויות, נימול, ירידה בתחושה או כאבי ראש / מיגרנות משמעותיות?", companies: allCompanies, fields:[
              { key:"symptom", label:"איזה סימפטום", type:"text" },
              { key:"frequency", label:"תדירות / מתי הופיע", type:"text" },
              { key:"details", label:"בירור / טיפול / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של הסימפטומים והבירור"]) },
            { key:"neuro_development", text:"האם קיימת אבחנה של אוטיזם, עיכוב התפתחותי או צורך בסיוע והשגחה?", companies:["כלל","הפניקס","הראל"], fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"support", label:"סיוע / השגחה / אחוזי נכות", type:"text" },
              { key:"details", label:"פירוט תפקודי", type:"textarea" }
            ], requirements: mkReq(["פירוט תפקודי מלא"], { "הפניקס":["מעל גיל 7 עשוי להידרש פרוטוקול ביטוח לאומי / נוירולוג / פסיכיאטר"] }) }
          ]
        },
        {
          key:"mental",
          title:"בריאות הנפש",
          summary:"חרדה, דיכאון, טיפולים, אשפוזים ותרופות נפשיות.",
          questions:[
            { key:"mental_diag", text:"האם אובחנת בחרדה, דיכאון, הפרעת קשב, הפרעה נפשית או קיבלת טיפול פסיכולוגי / פסיכיאטרי?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"therapy", label:"טיפול / מטפל", type:"text" },
              { key:"details", label:"תרופות / משך טיפול / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה, טיפול ותרופות"], { "הפניקס":["בעיות נפשיות עשויות להסתפק בשאלון או לחייב תיעוד פסיכיאטרי"], "הראל":["יש לציין חומרה, טיפול ואשפוז אם היה"] }) },
            { key:"mental_antipsy", text:"האם היה טיפול אנטיפסיכוטי, אשפוז פסיכיאטרי, ניסיון אובדני או נכות נפשית?", companies: allCompanies, fields:[
              { key:"event", label:"איזו אבחנה / אירוע", type:"text" },
              { key:"date", label:"מתי", type:"text" },
              { key:"details", label:"פירוט מלא", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא"], { "הפניקס":["תיעוד פסיכיאטרי נדרש במקרים אלה"], "הראל":["תיעוד פסיכיאטרי עשוי להידרש"] }) }
          ]
        },
        {
          key:"oncology",
          title:"גידולים, סרטן וביופסיות",
          summary:"גידולים שפירים/ממאירים, ביופסיה, טיפולים ומעקב.",
          questions:[
            { key:"oncology_cancer", text:"האם אובחנת בסרטן, גידול ממאיר או היית במעקב אונקולוגי?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"סוג האבחנה", type:"text" },
              { key:"date", label:"מועד גילוי", type:"text" },
              { key:"details", label:"טיפול / תום טיפול / Stage / Grade / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["שאלון אונקולוגי"], { "הפניקס":["ב-10 השנים האחרונות נדרש תיעוד אונקולוג מלא"], "הראל":["לפרט Stage / Grade אם ידוע"], "איילון":["לגידול ממאיר ייתכן צורך במכתב אונקולוג / רופא מטפל"] }) },
            { key:"oncology_benign", text:"האם אובחן אצלך גידול שפיר, ציסטה, קשרית או ממצא חריג שדרש מעקב?", companies: allCompanies, fields:[
              { key:"organ", label:"באיזה איבר", type:"text" },
              { key:"date", label:"מועד גילוי", type:"text" },
              { key:"details", label:"ביופסיה / תשובה / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט האיבר, הממצא ומה בוצע"], { "הפניקס":["ביופסיה ב-3 החודשים האחרונים מחייבת תוצאה / דוח היסטולוגי"] }) },
            { key:"oncology_biopsy", text:"האם עברת ביופסיה, כריתה, הקרנות או כימותרפיה?", companies: allCompanies, fields:[
              { key:"type", label:"איזה טיפול / ביופסיה", type:"text" },
              { key:"date", label:"מתי", type:"text" },
              { key:"result", label:"תוצאה / מצב נוכחי", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של סוג הבדיקה / הטיפול והתוצאה"]) }
          ]
        },
        {
          key:"digestive",
          title:"עיכול, כבד ולבלב",
          summary:"מעיים, כבד, כיס מרה, לבלב וקיבה.",
          questions:[
            { key:"digest_liver", text:"האם קיימת מחלת כבד, הפטיטיס, הפרעה בתפקודי כבד או כבד שומני?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"values", label:"תפקודי כבד / עומס ויראלי אם ידוע", type:"text" },
              { key:"details", label:"טיפול / הדמיה / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה ותפקודי כבד"], { "הפניקס":["הפטיטיס / מחלת כבד מחייבים לעיתים תיעוד גסטרו"], "הראל":["למעט כבד שומני, מחלת כבד מחייבת לעיתים תיעוד רופא"] }) },
            { key:"digest_ibd", text:"האם אובחנת בקרוהן, קוליטיס, מחלת מעי דלקתית או מחלה כרונית במערכת העיכול?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"treatment", label:"טיפול", type:"text" },
              { key:"details", label:"סיבוכים / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה, טיפול וסיבוכים"]) },
            { key:"digest_stomach", text:"האם קיימת מחלת קיבה, כיב, רפלוקס משמעותי, מחלת לבלב או כיס מרה?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"date", label:"מועד אבחון", type:"text" },
              { key:"details", label:"טיפול / ניתוח / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של האבחנה והטיפול"]) }
          ]
        },
        {
          key:"kidney",
          title:"כליות ודרכי שתן",
          summary:"מחלת כליות, אבנים, דם/חלבון בשתן, אורולוגיה.",
          questions:[
            { key:"kidney_disease", text:"האם אובחנת במחלת כליות, אי ספיקת כליות, חלבון או דם בשתן?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"tests", label:"תפקודי כליות / בדיקות שתן", type:"text" },
              { key:"details", label:"פירוט טיפול / הדמיה / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא + בדיקות רלוונטיות אם ידוע"], { "הפניקס":["לעיתים נדרש תיעוד נפרולוג / אורולוג"], "הראל":["מחלת כליות מחייבת לעיתים תיעוד רופא ובדיקות שתן / הדמיה"] }) },
            { key:"kidney_stones", text:"האם היו אבנים בכליות, חסימה, זיהומים חוזרים או בעיה כרונית בדרכי השתן?", companies: allCompanies, fields:[
              { key:"problem", label:"איזו בעיה", type:"text" },
              { key:"last", label:"מועד אירוע אחרון", type:"text" },
              { key:"details", label:"טיפול / ניתוח / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט בעיה, מועד אחרון וטיפול"]) },
            { key:"kidney_prostate", text:"האם קיימת בעיה בערמונית, אורולוגיה או מעקב אורולוגי קבוע?", companies: lifeCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"treatment", label:"טיפול / תרופות", type:"text" },
              { key:"details", label:"מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה, טיפול ומעקב"]) }
          ]
        },
        {
          key:"metabolic",
          title:"סוכרת, הורמונלי ומטבולי",
          summary:"סוכרת, בלוטת תריס, עודף/תת משקל ומחלות הורמונליות.",
          questions:[
            { key:"metabolic_diabetes", text:"האם אובחנת בסוכרת או טרום סוכרת?", companies: allCompanies, fields:[
              { key:"type", label:"סוג הסוכרת / טרום סוכרת", type:"text" },
              { key:"since", label:"מועד אבחון", type:"text" },
              { key:"details", label:"טיפול / אינסולין / HbA1c / פגיעה באיברי מטרה", type:"textarea" }
            ], requirements: mkReq(["שאלון סוכרת"], { "הפניקס":["מעל ספים מסוימים יידרש תיעוד רופא כולל HbA1c וחלבון בשתן"], "הראל":["סכומי ריסק ואכ״ע מסוימים עשויים לחייב תיעוד רופא"] }) },
            { key:"metabolic_thyroid", text:"האם קיימת בעיה בבלוטת התריס / יותרת התריס, כולל קשרית, ציסטה, השימוטו או גידול?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"date", label:"מועד אבחון", type:"text" },
              { key:"details", label:"טיפול / ניתוח / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה וטיפול"], { "איילון":["בשאלון בלוטת תריס יש לציין טיפול ומועד ניתוח אם היה"] }) },
            { key:"metabolic_weight", text:"האם קיים BMI חריג, עודף משקל קיצוני, תת משקל משמעותי או ניתוח בריאטרי?", companies: allCompanies, fields:[
              { key:"bmi", label:"BMI / גובה-משקל / שינוי משקל", type:"text" },
              { key:"date", label:"מועד ניתוח / שינוי משמעותי", type:"text" },
              { key:"details", label:"פירוט מעקב, בדיקות וטיפול", type:"textarea" }
            ], requirements: mkReq(["פירוט משקל / שינוי משקל"], { "הפניקס":["BMI גבוה ברמות מסוימות עשוי לחייב תמצית מידע מקופ״ח"], "מנורה":["עודף משקל חריג עשוי לחייב בדיקות דם או תיעוד"], "הראל":["יש לציין אם תת המשקל יציב לאורך 3 השנים האחרונות"] }) },
            { key:"metabolic_other", text:"האם קיימת מחלה הורמונלית / מטבולית אחרת?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"treatment", label:"טיפול", type:"text" },
              { key:"details", label:"מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של האבחנה והטיפול"]) }
          ]
        },
        {
          key:"blood_autoimmune",
          title:"דם, חיסון ואוטואימוני",
          summary:"אנמיה, קרישיות, לופוס, ראומטולוגיה, HIV ומחלות חיסון.",
          questions:[
            { key:"blood_disorder", text:"האם קיימת מחלת דם, אנמיה משמעותית, הפרעת קרישה או קרישיות יתר?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"latest", label:"ערך / בדיקה אחרונה", type:"text" },
              { key:"details", label:"טיפול / אירועי קריש דם / סיבוכים", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של האבחנה והטיפול"], { "הראל":["קרישיות יתר מחייבת אבחנה, טיפול והאם היה אירוע קריש דם"], "הפניקס":["מחלת דם לרוב מחייבת תיעוד המטולוג"] }) },
            { key:"autoimmune_lupus", text:"האם אובחנת בלופוס, דלקת מפרקים שגרונית, FMF או מחלה אוטואימונית / ראומטולוגית?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"treatment", label:"טיפול / ביולוגי / סטרואידים", type:"text" },
              { key:"details", label:"סיבוכים מחוץ למערכת השלד / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה, טיפול וסיבוכים"], { "הפניקס":["לופוס עשוי לחייב תפקודי כליה וחלבון בשתן"], "הראל":["דלקת מפרקים עשויה לחייב תיעוד ראומטולוג"] }) },
            { key:"blood_hiv", text:"האם קיימת נשאות HIV או מחלה זיהומית משמעותית (HIV / הפטיטיס / שחפת וכד')?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"since", label:"מועד אבחון", type:"text" },
              { key:"details", label:"טיפול / עומס ויראלי / סיבוכים", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של אבחנה, טיפול ומצב כיום"], { "הפניקס":["בנשאות HIV יש לציין CD4, עומס ויראלי, טיפול וסיבוכים"] }) }
          ]
        },
        {
          key:"musculoskeletal",
          title:"שלד, גב ומפרקים",
          summary:"גב, דיסק, מפרקים, שברים, מגבלות וניתוחים אורטופדיים.",
          questions:[
            { key:"ortho_back", text:"האם קיימת בעיה בגב או בעמוד השדרה, כולל בלט / בקע / פריצת דיסק / כאבי גב כרוניים?", companies: allCompanies, fields:[
              { key:"area", label:"אזור עמוד השדרה", type:"text" },
              { key:"date", label:"מועד אבחון / אירוע אחרון", type:"text" },
              { key:"details", label:"טיפול / ימי היעדרות / ניתוח / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["שאלון גב / אורטופדי"], { "הפניקס":["באכ״ע יש לציין ימי היעדרות ב-3 השנים האחרונות"], "הראל":["יש לפרט אזור עמוד השדרה"], "איילון":["שאלון מערכת השלד כולל מגבלה, טיפולים וניתוחים"] }) },
            { key:"ortho_joints", text:"האם קיימת בעיה במפרקים, כתפיים, ברכיים, מניסקוס, רצועות, אוסטיאופורוזיס או בריחת סידן?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"location", label:"מיקום / צד", type:"text" },
              { key:"details", label:"טיפול / ניתוח / מגבלה תפקודית", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה, מיקום, טיפול ומגבלה"], { "הפניקס":["יש לציין אם מדובר באוסטיאופניה או אוסטיאופורוזיס"], "איילון":["יש לציין צד הפגיעה ומגבלה תפקודית"] }) },
            { key:"ortho_other", text:"האם קיימת נכות אורטופדית, קטיעה, שבר משמעותי, תאונה עם פגיעה מתמשכת או מחלת שלד אחרת?", companies: allCompanies, fields:[
              { key:"problem", label:"איזו בעיה", type:"text" },
              { key:"date", label:"מתי", type:"text" },
              { key:"details", label:"פירוט מלא", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של הבעיה והמצב התפקודי"]) }
          ]
        },
        {
          key:"vision_skin_ent",
          title:"עיניים, עור ואא״ג",
          summary:"עיניים, שמיעה, עור ומחלות כרוניות משלימות.",
          questions:[
            { key:"vision_eye", text:"האם קיימת מחלת עיניים משמעותית, גלאוקומה, קטרקט, ניתוח עיניים או ירידה משמעותית בראייה?", companies:["כלל","הראל","מגדל","מנורה","הפניקס"], fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"surgery", label:"ניתוח / טיפול", type:"text" },
              { key:"details", label:"מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה, טיפול ומצב נוכחי"]) },
            { key:"skin_main", text:"האם קיימת מחלת עור כרונית, פסוריאזיס, אטופיק דרמטיטיס או ממצא עור במעקב?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"severity", label:"חומרה / אחוזי מעורבות", type:"text" },
              { key:"details", label:"טיפול / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מחלת העור והטיפול"], { "הפניקס":["ייתכן צורך להבדיל בין שפיר לממאיר בממצאי עור"] }) },
            { key:"ent_main", text:"האם קיימת מחלת אוזניים, שמיעה, סחרחורת ממקור אא״ג, ניתוח אא״ג או בעיה כרונית אחרת בתחום זה?", companies:["כלל","הראל","מגדל","מנורה","הפניקס"], fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"date", label:"מועד אבחון / ניתוח", type:"text" },
              { key:"details", label:"פירוט מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא לפי הצורך"]) }
          ]
        },
        {
          key:"lifestyle_family",
          title:"אורח חיים והיסטוריה משפחתית",
          summary:"עישון, אלכוהול, סמים, קנאביס, עיסוק וקרובי משפחה.",
          questions:[
            { key:"life_smoke", text:"האם אתה מעשן כיום או עישנת בעבר מוצרי טבק / ניקוטין?", companies: allCompanies, fields:[
              { key:"status", label:"כיום / בעבר", type:"text" },
              { key:"amount", label:"כמה / תדירות", type:"text" },
              { key:"quit", label:"מתי הפסקת אם רלוונטי", type:"text" }
            ], requirements: mkReq(["פירוט שימוש / כמות / מועד הפסקה"], { "איילון":["בחלק מהמקרים נדרשת בדיקת קוטינין"], "מנורה":["בדיקות רפואיות מסוימות כוללות קוטינין ללא מעשנים"] }) },
            { key:"life_alcohol", text:"האם קיימת צריכת אלכוהול חריגה, טיפול גמילה או בעיית אלכוהול?", companies: allCompanies, fields:[
              { key:"amount", label:"כמות / תדירות", type:"text" },
              { key:"quit", label:"אם הייתה גמילה - מתי", type:"text" },
              { key:"details", label:"פירוט נוסף", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של השימוש / גמילה"], { "מנורה":["יש שאלון אלכוהול ייעודי"] }) },
            { key:"life_drugs", text:"האם היה שימוש בסמים, קנאביס, קנאביס רפואי, תרופות ממכרות או גמילה?", companies: allCompanies, fields:[
              { key:"type", label:"איזה חומר", type:"text" },
              { key:"freq", label:"תדירות / בעבר או כיום", type:"text" },
              { key:"details", label:"סיבה רפואית / גמילה / פירוט נוסף", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של החומר, תדירות והאם בעבר/כיום"], { "כלל":["סמים / קנאביס מחייבים שאלון ייעודי ולעיתים מסמכים"], "מנורה":["יש שאלון סמים"], "הפניקס":["ייתכן פירוט נוסף לפי חומרה"] }) },
            { key:"life_family", text:"האם קיימת היסטוריה משפחתית מדרגה ראשונה של סרטן, מחלת לב, סכרת, כליות, טרשת נפוצה, ALS, פרקינסון, אלצהיימר או מחלה תורשתית אחרת?", companies: allCompanies, fields:[
              { key:"who", label:"איזה קרובי משפחה", type:"text" },
              { key:"disease", label:"איזו מחלה", type:"text" },
              { key:"details", label:"כמה קרובים ובאיזה גיל אובחנו", type:"textarea" }
            ], requirements: mkReq(["פירוט הקרובים, המחלה וגיל האבחון"], { "הפניקס":["יש להצהיר רק על קרוב מדרגה ראשונה שאובחן עד גיל 60"], "כלל":["יש שאלון היסטוריה משפחתית מפורט"] }) }
          ]
        },
        {
          key:"women",
          title:"נשים / היריון",
          summary:"היריון, סיבוכים, שד, גינקולוגיה ובדיקות רלוונטיות.",
          questions:[
            { key:"women_pregnancy", text:"האם קיימת היריון, סיבוכי היריון, מעקב היריון בסיכון או טיפול פוריות?", companies:["כלל","הפניקס","הראל","מנורה","איילון"], fields:[
              { key:"week", label:"שבוע / מצב נוכחי", type:"text" },
              { key:"details", label:"פירוט סיבוכים / מעקב / טיפול", type:"textarea" },
              { key:"history", label:"סיבוכי עבר אם קיימים", type:"text" }
            ], requirements: mkReq(["פירוט מלא במקרה של תשובה חיובית"]) },
            { key:"women_breast", text:"האם קיימת בעיה גינקולוגית, ממצא בשד, ממוגרפיה / אולטרסאונד חריגים או מעקב נשי רלוונטי?", companies:["כלל","הפניקס","הראל","מנורה","איילון"], fields:[
              { key:"finding", label:"איזה ממצא", type:"text" },
              { key:"date", label:"מתי", type:"text" },
              { key:"details", label:"ביופסיה / מעקב / תשובה", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של הממצא והבירור"]) }
          ]
        }
      ];
    },

    getHealthQuestionsFiltered(){
      const phoenixSchema = this.getPhoenixHealthSchema();
      if(phoenixSchema.length) return phoenixSchema;
      const companies = this.getHealthCompanies();
      const schema = this.getHealthSchema();
      if(!companies.length) return schema;
      return schema.map(cat => {
        const questions = (cat.questions || []).filter(q => !q.companies || q.companies.some(c => companies.includes(c)));
        return { ...cat, questions };
      }).filter(cat => cat.questions.length);
    },

    getHealthQuestionList(){
      const cats = this.getHealthQuestionsFiltered();
      const list = [];
      cats.forEach(cat => {
        (cat.questions || []).forEach(q => list.push({ catKey: cat.key, catTitle: cat.title, catSummary: cat.summary || "", question: q }));
      });
      return list;
    },

    getHealthResponse(qKey, insId){
      const store = this.getHealthStore();
      const qBlock = store.responses[qKey] || {};
      const out = qBlock[insId] || { answer:"", fields:{}, saved:false };
      if(!out.fields) out.fields = {};
      return out;
    },

    setHealthResponse(qKey, insId, patch){
      const store = this.getHealthStore();
      store.responses[qKey] = store.responses[qKey] || {};
      const prev = this.getHealthResponse(qKey, insId);
      store.responses[qKey][insId] = {
        ...prev,
        ...patch,
        fields: { ...(prev.fields || {}), ...((patch && patch.fields) || {}) }
      };
    },

    getHealthProgress(){
      const list = this.getHealthQuestionList();
      const total = list.length || 1;
      const store = this.getHealthStore();
      const idx = Math.max(0, Math.min(total-1, Number(store.ui.currentIndex || 0)));
      return { total, idx, pct: Math.round(((idx+1) / total) * 100) };
    },

    getHealthCategoryStatus(cat){
      const questions = cat?.questions || [];
      let yes = 0, pending = 0;
      questions.forEach(q => {
        this.insureds.forEach(ins => {
          const r = this.getHealthResponse(q.key, ins.id);
          if(r.answer === 'yes'){
            yes += 1;
            if(!r.saved) pending += 1;
          }
        });
      });
      return { yes, pending };
    },

    getInsuredHealthStatus(ins){
      const list = this.getHealthQuestionList();
      let yes = 0, pending = 0;
      list.forEach(item => {
        const r = this.getHealthResponse(item.question.key, ins.id);
        if(r.answer === 'yes'){
          yes += 1;
          if(!r.saved) pending += 1;
        }
      });
      if(pending > 0) return { cls:'warn', text:'חסר פירוט', icon:'!' };
      if(yes > 0) return { cls:'ok', text:'יש ממצאים', icon:'✓' };
      return { cls:'muted', text:'ללא ממצאים', icon:'•' };
    },

    getHealthQuestionRequirements(question){
      const companies = this.getHealthCompanies();
      const req = question.requirements || {};
      const out = [];
      if(Array.isArray(req.default) && req.default.length){
        out.push({ company:'כללי', items:req.default });
      }
      companies.forEach(c => {
        if(Array.isArray(req[c]) && req[c].length){ out.push({ company:c, items:req[c] }); }
      });
      return out;
    },

    summarizeHealthFields(fields){
      const vals = Object.values(fields || {}).map(v => safeTrim(v)).filter(Boolean);
      if(!vals.length) return 'נשמר';
      return vals.slice(0,2).join(' • ');
    },

    validateHealthDetail(question, insId){
      const r = this.getHealthResponse(question.key, insId);
      if(r.answer !== 'yes') return true;
      const required = (question.fields || []).filter(f => f.type !== 'section');
      if(!required.length) return true;
      return required.every(f => safeTrim(r.fields?.[f.key]));
    },

    renderHealthField(question, insId, field){
      if(field.type === 'section'){
        return `<div class="lcHQSectionTitle">${escapeHtml(field.label)}</div>`;
      }
      const r = this.getHealthResponse(question.key, insId);
      const val = safeTrim(r.fields?.[field.key] || '');
      const key = `${question.key}|${insId}|${field.key}`;
      if(field.type === 'textarea'){
        return `<div class="lcHQField lcHQField--full"><label class="lcHQLabel">${escapeHtml(field.label)}</label><textarea class="lcHQTextarea" rows="3" data-hfield="${escapeHtml(key)}">${escapeHtml(val)}</textarea></div>`;
      }
      return `<div class="lcHQField"><label class="lcHQLabel">${escapeHtml(field.label)}</label><input class="lcHQInput" type="text" value="${escapeHtml(val)}" data-hfield="${escapeHtml(key)}" /></div>`;
    },

    renderHealthStatusBar(){
      return `<div class="lcHStatusBar">${this.insureds.map(ins => {
        const st = this.getInsuredHealthStatus(ins);
        return `<div class="lcHStatusChip ${st.cls}"><span class="lcHStatusChip__dot">${escapeHtml(st.icon)}</span><div><div class="lcHStatusChip__name">${escapeHtml(ins.label)}</div><div class="lcHStatusChip__text">${escapeHtml(st.text)}</div></div></div>`;
      }).join('')}</div>`;
    },

    renderHealthSidebar(currentItem){
      return '';
    },

    renderHealthSummary(){
      const companies = this.getHealthCompanies();
      const byIns = this.insureds.map(ins => {
        const findings = [];
        this.getHealthQuestionList().forEach(item => {
          const r = this.getHealthResponse(item.question.key, ins.id);
          if(r.answer === 'yes') findings.push({ question:item.question, saved:r.saved, summary:this.summarizeHealthFields(r.fields || {}) });
        });
        const st = this.getInsuredHealthStatus(ins);
        return `<div class="lcHSummaryCard">
          <div class="lcHSummaryCard__head"><div><div class="lcHSummaryCard__name">${escapeHtml(ins.label)}</div><div class="lcHSummaryCard__meta">${escapeHtml(st.text)}</div></div><span class="badge">${findings.length || 0} ממצאים</span></div>
          <div class="lcHSummaryList">${findings.length ? findings.map(f => `<div class="lcHSummaryItem ${f.saved ? '' : 'warn'}"><strong>${escapeHtml(f.question.text)}</strong><span>${escapeHtml(f.summary)}</span></div>`).join('') : `<div class="muted">לא סומנו ממצאים עבור מבוטח זה.</div>`}</div>
        </div>`;
      }).join('');
      return `<div class="lcHLayout"><div class="lcHMain"><div class="lcHFinishHero">
        <div class="lcHFinishHero__kicker">תיק לקוח 360°</div>
        <div class="lcHFinishHero__title">סיכום חיתום והצהרת בריאות</div>
        <div class="lcHFinishHero__text">זהו מסך סיכום פנימי לנציג. הנתונים נשמרים על כל מבוטח בנפרד, יחד עם הממצאים שסומנו בשלב 8.</div>
        <div class="lcHCompanies">${companies.map(c => `<span class="lcHChip lcHChip--top">${escapeHtml(c)}</span>`).join('')}</div>
      </div>
      <div class="lcHSummaryGrid">${byIns}</div>
      </div></div>`;
    },

    renderStep8(){
      const companies = this.getHealthCompanies();
      const list = this.getHealthQuestionList();
      const store = this.getHealthStore();
      if(!list.length){
        return `<div class="lcHealthEmpty"><div class="lcHealthEmpty__icon">🩺</div><div class="lcHealthEmpty__title">הצהרת בריאות</div><div class="lcHealthEmpty__text">כדי להציג את שלב 8 יש לבחור בשלב 5 פוליסה רלוונטית. בפוליסות הפניקס המערכת תטען הצהרה ייעודית לפי חברה + מוצר, ובריסק גם לפי גיל המבוטח וסכום הביטוח.</div></div>`;
      }
      const idx = Math.max(0, Math.min(list.length - 1, Number(store.ui.currentIndex || 0)));
      store.ui.currentIndex = idx;
      if(store.ui.summary) return this.renderHealthSummary();
      const item = list[idx];
      const q = item.question;
      const reqs = this.getHealthQuestionRequirements(q);
      const matrix = this.insureds.map(ins => {
        const r = this.getHealthResponse(q.key, ins.id);
        const yes = r.answer === 'yes';
        const no = r.answer === 'no';
        const valid = this.validateHealthDetail(q, ins.id);
        const showEditor = yes && !r.saved;
        const savedBox = yes && r.saved ? `<div class="lcHSavedRow"><span class="lcHSavedRow__ok">✓ נשמר עבור ${escapeHtml(ins.label)}</span><span class="lcHSavedRow__meta">${escapeHtml(this.summarizeHealthFields(r.fields || {}))}</span><div class="lcHSavedRow__actions"><button type="button" class="btn" data-hedit="${escapeHtml(q.key)}|${escapeHtml(ins.id)}">ערוך</button><button type="button" class="btn btn--danger" data-hclear="${escapeHtml(q.key)}|${escapeHtml(ins.id)}">נקה</button></div></div>` : '';
        const editor = showEditor ? `<div class="lcHDetailCard"><div class="lcHDetailCard__head">פירוט עבור: ${escapeHtml(ins.label)}</div><div class="lcHQFields">${(q.fields || []).map(f => this.renderHealthField(q, ins.id, f)).join('')}</div><div class="lcHDetailCard__foot"><button type="button" class="btn btn--primary" data-hsave="${escapeHtml(q.key)}|${escapeHtml(ins.id)}">שמור</button>${!valid ? `<span class="lcHInlineWarn">יש למלא את כל שדות התת־שאלון לפני שמירה</span>` : ''}</div></div>` : '';
        return `<div class="lcHMatrixRow ${yes ? 'is-yes' : no ? 'is-no' : ''}">
          <div class="lcHMatrixRow__who">${escapeHtml(ins.label)}</div>
          <div class="lcHAnswerBtns">
            <button type="button" class="lcHAnswerBtn ${yes ? 'is-active' : ''}" data-hans="${escapeHtml(q.key)}|${escapeHtml(ins.id)}|yes">כן</button>
            <button type="button" class="lcHAnswerBtn ${no ? 'is-active' : ''}" data-hans="${escapeHtml(q.key)}|${escapeHtml(ins.id)}|no">לא</button>
          </div>
          <div class="lcHMatrixRow__content">${savedBox}${editor}</div>
        </div>`;
      }).join('');
      const catIndex = this.getHealthQuestionsFiltered().findIndex(c => c.key === item.catKey);
      return `<div class="lcHLayout">
        <div class="lcHMain">
          <div class="lcHHeroCard">
            <div class="lcHHeroCard__top">
              <div>
                <div class="lcHHeroCard__kicker">שלב 8 · הצהרת בריאות</div>
                <div class="lcHHeroCard__title">${escapeHtml(item.catTitle)}</div>
                <div class="lcHHeroCard__summary">${escapeHtml(item.catSummary || '')}</div>
              </div>
              <div class="lcHHeroCard__step">שאלה ${idx+1} / ${list.length}</div>
            </div>
            <div class="lcHCategoryRail">${this.getHealthQuestionsFiltered().map((cat, cidx) => `<button type="button" class="lcHCatPill ${cidx===catIndex ? 'is-active' : ''}" data-hgoto-cat="${cidx}">${escapeHtml(cat.title)}</button>`).join('')}</div>
          </div>
          <div class="lcHQuestionCard">
            <div class="lcHQuestionCard__head">
              <div>
                <div class="lcHQuestionCard__eyebrow">שאלה משותפת לכל המבוטחים</div>
                <div class="lcHQuestionCard__title">${escapeHtml(q.text)}</div>
              </div>
              <div class="lcHCompanies">${(q.companies || companies).filter(c => companies.length ? companies.includes(c) : true).map(c => `<span class="lcHChip">${escapeHtml(c)}</span>`).join('')}</div>
            </div>
            <div class="lcHQuestionCard__body">${matrix}</div>
            <div class="lcHNavRow">
              <button type="button" class="btn" data-hnav="prev" ${idx <= 0 ? 'disabled' : ''}>הקודם</button>
              <button type="button" class="btn btn--primary" data-hnav="next">${idx >= list.length - 1 ? 'כרטיס סיכום' : 'השאלה הבאה'}</button>
            </div>
          </div>
        </div>
      </div>`;
    },

    bindHealthInputs(){
      const store = this.getHealthStore();
      $$('[data-hans]', this.els.body).forEach(btn => {
        on(btn, 'click', () => {
          const [qKey, insId, ans] = String(btn.getAttribute('data-hans') || '').split('|');
          if(!qKey || !insId || !ans) return;
          if(ans === 'no'){
            this.setHealthResponse(qKey, insId, { answer:'no', fields:{}, saved:false });
          }else{
            const prev = this.getHealthResponse(qKey, insId);
            this.setHealthResponse(qKey, insId, { answer:'yes', saved:false, fields: prev.fields || {} });
          }
          this.render();
        });
      });
      $$('[data-hfield]', this.els.body).forEach(el => {
        const save = () => {
          const [qKey, insId, fieldKey] = String(el.getAttribute('data-hfield') || '').split('|');
          if(!qKey || !insId || !fieldKey) return;
          const prev = this.getHealthResponse(qKey, insId);
          const fields = { ...(prev.fields || {}) };
          fields[fieldKey] = safeTrim(el.value);
          this.setHealthResponse(qKey, insId, { fields, saved:false, answer:'yes' });
        };
        on(el, 'input', save);
        on(el, 'change', save);
      });
      $$('[data-hsave]', this.els.body).forEach(btn => {
        on(btn, 'click', () => {
          const [qKey, insId] = String(btn.getAttribute('data-hsave') || '').split('|');
          if(!qKey || !insId) return;
          const item = this.getHealthQuestionList().find(x => x.question.key === qKey);
          if(!item) return;
          if(!this.validateHealthDetail(item.question, insId)){
            this.setHint('נא למלא את כל שדות התת־שאלון לפני שמירה');
            return;
          }
          this.setHealthResponse(qKey, insId, { saved:true, answer:'yes' });
          this.setHint('הפירוט נשמר');
          this.render();
        });
      });
      $$('[data-hedit]', this.els.body).forEach(btn => {
        on(btn, 'click', () => {
          const [qKey, insId] = String(btn.getAttribute('data-hedit') || '').split('|');
          if(!qKey || !insId) return;
          this.setHealthResponse(qKey, insId, { saved:false, answer:'yes' });
          this.render();
        });
      });
      $$('[data-hclear]', this.els.body).forEach(btn => {
        on(btn, 'click', () => {
          const [qKey, insId] = String(btn.getAttribute('data-hclear') || '').split('|');
          if(!qKey || !insId) return;
          this.setHealthResponse(qKey, insId, { answer:'', fields:{}, saved:false });
          this.render();
        });
      });
      $$('[data-hgoto-cat]', this.els.body).forEach(btn => {
        on(btn, 'click', () => {
          const cats = this.getHealthQuestionsFiltered();
          const idx = Number(btn.getAttribute('data-hgoto-cat') || '0');
          const cat = cats[idx];
          if(!cat) return;
          const list = this.getHealthQuestionList();
          const firstIndex = list.findIndex(x => x.catKey === cat.key);
          if(firstIndex >= 0){ store.ui.currentIndex = firstIndex; store.ui.summary = false; this.render(); }
        });
      });
      $$('[data-hnav]', this.els.body).forEach(btn => {
        on(btn, 'click', () => {
          const dir = String(btn.getAttribute('data-hnav') || '');
          const list = this.getHealthQuestionList();
          const idx = Math.max(0, Math.min(list.length - 1, Number(store.ui.currentIndex || 0)));
          if(dir === 'prev'){
            store.ui.summary = false;
            store.ui.currentIndex = Math.max(0, idx - 1);
          }else if(dir === 'next'){
            if(idx >= list.length - 1) store.ui.summary = true;
            else { store.ui.summary = false; store.ui.currentIndex = idx + 1; }
          }
          this.render();
        });
      });
    },

    getHealthBlockingIssue(){
      const list = this.getHealthQuestionList();
      if(!list.length) return { ok:false, msg:'אין שאלות הצהרת בריאות להצגה. בחר פוליסה רלוונטית בשלב 5.' };
      for(const item of list){
        for(const ins of this.insureds){
          const r = this.getHealthResponse(item.question.key, ins.id);
          if(r.answer !== 'yes' && r.answer !== 'no'){
            return { ok:false, msg:`חסרה תשובה בהצהרת הבריאות עבור ${ins.label}` };
          }
          if(r.answer === 'yes'){
            if(!this.validateHealthDetail(item.question, ins.id)){
              return { ok:false, msg:`יש להשלים את כל שדות התת־שאלון עבור ${ins.label}` };
            }
            if(!r.saved){
              return { ok:false, msg:`יש לשמור את פירוט השאלה עבור ${ins.label}` };
            }
          }
        }
      }
      return { ok:true };
    },

    getDraftPayload(){
      const primary = this.insureds[0] || { data:{} };
      return {
        savedAt: nowISO(),
        currentStep: this.step || 1,
        activeInsId: this.activeInsId || (this.insureds[0]?.id || null),
        insureds: JSON.parse(JSON.stringify(this.insureds || [])),
        newPolicies: JSON.parse(JSON.stringify(this.newPolicies || [])),
        operational: {
          createdAt: nowISO(),
          insureds: this.insureds.map(ins => ({ label: ins.label, type: ins.type, data: JSON.parse(JSON.stringify(ins.data || {})) })),
          newPolicies: JSON.parse(JSON.stringify(this.newPolicies || [])),
          primary: JSON.parse(JSON.stringify(primary.data || {}))
        }
      };
    },

    openDraft(rec){
      if(!rec) return;
      this.loadDraftData(rec);
      this.open();
      this.setHint("ההצעה נטענה מהמקום שבו נשמרה");
    },

    loadDraftData(rec){
      const payload = rec?.payload || {};
      const insureds = Array.isArray(payload.insureds) ? JSON.parse(JSON.stringify(payload.insureds)) : [];
      this.insureds = insureds.length ? insureds : [{
        id: "ins_" + Math.random().toString(16).slice(2),
        type: "primary",
        label: "מבוטח ראשי",
        data: {}
      }];
      this.newPolicies = Array.isArray(payload.newPolicies) ? JSON.parse(JSON.stringify(payload.newPolicies)) : [];
      this.activeInsId = payload.activeInsId && this.insureds.some(x => String(x.id) === String(payload.activeInsId)) ? payload.activeInsId : (this.insureds[0]?.id || null);
      this.step = Math.max(1, Math.min(this.steps.length, Number(rec?.currentStep || payload.currentStep || 1) || 1));
      this.policyDraft = null;
      this.editingPolicyId = null;
      this.lastSavedCustomerId = null;
      this.editingDraftId = rec?.id || null;
      this._finishing = false;
      this.render();
    },

    async saveDraft(){
      if(!Auth.current) return;
      const payload = this.getDraftPayload();
      const primary = payload?.operational?.primary || {};
      const record = normalizeProposalRecord({
        id: this.editingDraftId || ("prop_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2,8)),
        status: "פתוחה",
        fullName: safeTrim(((primary.firstName || "") + " " + (primary.lastName || "")).trim()) || "הצעה ללא שם",
        idNumber: safeTrim(primary.idNumber),
        phone: safeTrim(primary.phone),
        email: safeTrim(primary.email),
        city: safeTrim(primary.city),
        agentName: safeTrim(Auth?.current?.name),
        agentRole: safeTrim(Auth?.current?.role),
        createdAt: (() => {
          if(this.editingDraftId){
            const existing = (State.data?.proposals || []).find(x => String(x.id) === String(this.editingDraftId));
            if(existing?.createdAt) return existing.createdAt;
          }
          return nowISO();
        })(),
        updatedAt: nowISO(),
        currentStep: this.step || 1,
        insuredCount: (payload.insureds || []).length,
        payload
      });

      State.data.proposals = Array.isArray(State.data.proposals) ? State.data.proposals : [];
      const idx = State.data.proposals.findIndex(x => String(x.id) === String(record.id));
      if(idx >= 0) State.data.proposals[idx] = record;
      else State.data.proposals.unshift(record);
      this.editingDraftId = record.id;
      State.data.meta.updatedAt = nowISO();
      const persistRes = await App.persist("ההצעה נשמרה");
      ProposalsUI.render();
      if(persistRes?.ok){
        this.setHint("ההצעה נשמרה ותופיע במסך הצעות להמשך עריכה");
      }else{
        this.setHint("ההצעה נשמרה מקומית בלבד. בדוק חיבור ל-Google Sheets כדי שתופיע גם ממחשב אחר.");
      }
    },

    getOperationalPayload(){
      const primary = this.insureds[0] || { data:{} };
      return {
        createdAt: nowISO(),
        insureds: this.insureds.map(ins => ({ label: ins.label, type: ins.type, data: JSON.parse(JSON.stringify(ins.data || {})) })),
        newPolicies: JSON.parse(JSON.stringify(this.newPolicies || [])),
        primary: JSON.parse(JSON.stringify(primary.data || {}))
      };
    },

    compactReportFields(obj, keys){
      return keys.map(([k,label]) => `<div class="lcReportField"><b>${escapeHtml(label)}</b><div class="lcReportValue">${this.renderReportValue(obj?.[k])}</div></div>`).join('');
    },

    renderReportValue(v){
      if(v === null || v === undefined) return '—';
      const s = safeTrim(v);
      return s ? escapeHtml(s) : '—';
    },

    renderTable(headers, rows){
      if(!rows.length) return `<div class="muted">אין נתונים להצגה.</div>`;
      return `<div class="lcReportTableWrap"><table class="lcReportTable"><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    },

    renderOperationalReport(){
      const payload = this.getOperationalPayload();
      const primary = payload.primary || {};
      const insuredRows = payload.insureds.map(ins => {
        const d = ins.data || {};
        return [
          escapeHtml(ins.label || ''),
          this.renderReportValue((d.firstName || '') + ' ' + (d.lastName || '')),
          this.renderReportValue(d.idNumber),
          this.renderReportValue(d.birthDate),
          this.renderReportValue(d.phone)
        ];
      });
      const existingRows = [];
      payload.insureds.forEach(ins => {
        (ins.data?.existingPolicies || []).forEach(p => existingRows.push([
          escapeHtml(ins.label || ''), this.renderReportValue(p.company), this.renderReportValue(p.type), this.renderReportValue(p.policyNumber), this.renderReportValue(p.monthlyPremium)
        ]));
      });
      const cancelRows = [];
      payload.insureds.forEach(ins => {
        const canc = ins.data?.cancellations || {};
        (ins.data?.existingPolicies || []).forEach(p => {
          const c = canc[p.id] || {};
          if(safeTrim(c.status) || safeTrim(c.reason)) cancelRows.push([
            escapeHtml(ins.label || ''), this.renderReportValue(p.company), this.renderReportValue(p.type), this.renderReportValue(c.status), this.renderReportValue(c.reason)
          ]);
        });
      });
      const newRows = (payload.newPolicies || []).map(p => [this.renderReportValue(p.company), this.renderReportValue(p.type), this.renderReportValue(p.premiumBefore), this.renderReportValue(p.discountPct), this.renderReportValue(p.startDate)]);
      const healthItems = [];
      this.getHealthQuestionList().forEach(item => {
        payload.insureds.forEach(ins => {
          const r = this.getHealthResponse(item.question.key, this.insureds.find(x => x.label===ins.label)?.id || '');
          if(r.answer === 'yes') healthItems.push(`<div class="lcReportListItem"><strong>${escapeHtml(ins.label)} · ${escapeHtml(item.question.text)}</strong><span>${escapeHtml(this.summarizeHealthFields(r.fields || {}))}</span></div>`);
        });
      });
      const payerFields = [];
      if(primary.payerChoice === 'external'){
        const ex = primary.externalPayer || {};
        const anyEx = ['relation','firstName','lastName','idNumber','birthDate','phone'].some(k => safeTrim(ex[k]));
        if(anyEx){
          payerFields.push(`<div class="lcReportGrid">${this.compactReportFields(ex, [['relation','קרבה'],['firstName','שם פרטי'],['lastName','שם משפחה'],['idNumber','תעודת זהות'],['birthDate','תאריך לידה'],['phone','טלפון']])}</div>`);
        }
      }
      const payMethod = safeTrim(primary.paymentMethod);
      if(payMethod === 'cc'){
        const cc = primary.cc || {};
        if(['holderName','holderId','cardNumber','exp'].some(k => safeTrim(cc[k]))){
          payerFields.push(`<div class="lcReportGrid">${this.compactReportFields(cc, [['holderName','שם מחזיק'],['holderId','תז מחזיק'],['cardNumber','מספר כרטיס'],['exp','תוקף']])}</div>`);
        }
      } else if(payMethod === 'ho'){
        const ho = primary.ho || {};
        if(['bankName','bankNo','branch','account'].some(k => safeTrim(ho[k]))){
          payerFields.push(`<div class="lcReportGrid">${this.compactReportFields(ho, [['bankName','שם בנק'],['bankNo','מספר בנק'],['branch','סניף'],['account','מספר חשבון']])}</div>`);
        }
      }
      const ts = new Date(payload.createdAt).toLocaleString('he-IL');
      return `<div class="lcReportDoc">
        <div class="lcReportHero">
          <div class="lcReportCard"><div class="lcReportSection__title">דוח תפעולי מלא</div><div class="lcReportSection__sub">הדוח מציג את כל הנתונים שהוזנו בהקמת הלקוח, בצורה מרוכזת ומוכנה למחלקת תפעול.</div><div class="lcReportMeta"><div class="lcReportMetaItem"><b>מבוטח ראשי</b><span>${this.renderReportValue((primary.firstName||'') + ' ' + (primary.lastName||''))}</span></div><div class="lcReportMetaItem"><b>תעודת זהות</b><span>${this.renderReportValue(primary.idNumber)}</span></div><div class="lcReportMetaItem"><b>מספר מבוטחים</b><span>${payload.insureds.length}</span></div><div class="lcReportMetaItem"><b>הופק בתאריך</b><span>${escapeHtml(ts)}</span></div></div></div>
          <div class="lcReportCard"><div class="lcReportMeta"><div class="lcReportMetaItem"><b>פוליסות קיימות</b><span>${existingRows.length}</span></div><div class="lcReportMetaItem"><b>פוליסות חדשות</b><span>${newRows.length}</span></div><div class="lcReportMetaItem"><b>סוג משלם</b><span>${this.renderReportValue(primary.payerChoice === 'external' ? 'משלם חריג' : primary.payerChoice === 'insured' ? 'מבוטח קיים' : '')}</span></div><div class="lcReportMetaItem"><b>אמצעי תשלום</b><span>${this.renderReportValue(payMethod === 'cc' ? 'כרטיס אשראי' : payMethod === 'ho' ? 'הוראת קבע' : '')}</span></div></div></div>
        </div>
        <section class="lcReportSection"><div class="lcReportSection__title">פרטי לקוח</div><div class="lcReportGrid">${this.compactReportFields(primary, [['firstName','שם פרטי'],['lastName','שם משפחה'],['idNumber','תעודת זהות'],['birthDate','תאריך לידה'],['gender','מגדר'],['maritalStatus','מצב משפחתי'],['phone','טלפון'],['email','אימייל'],['city','עיר'],['street','רחוב'],['houseNumber','מספר בית'],['zip','מיקוד'],['clinic','קופת חולים'],['shaban','שב״ן'],['occupation','עיסוק'],['heightCm','גובה'],['weightKg','משקל'],['bmi','BMI']])}</div></section>
        <section class="lcReportSection"><div class="lcReportSection__title">מבוטחים</div>${this.renderTable(['סוג מבוטח','שם מלא','תעודת זהות','תאריך לידה','טלפון'], insuredRows)}</section>
        <section class="lcReportSection"><div class="lcReportSection__title">פוליסות קיימות</div>${this.renderTable(['מבוטח','חברה','סוג ביטוח','מספר פוליסה','פרמיה חודשית'], existingRows)}</section>
        <section class="lcReportSection"><div class="lcReportSection__title">ביטול בחברה נגדית</div>${this.renderTable(['מבוטח','חברה','סוג ביטוח','סטטוס','סיבה'], cancelRows)}</section>
        <section class="lcReportSection"><div class="lcReportSection__title">פוליסות חדשות</div>${this.renderTable(['חברה','סוג ביטוח','פרמיה לפני הנחה','אחוז הנחה','תאריך תחילה'], newRows)}</section>
        ${payerFields.length ? `<section class="lcReportSection"><div class="lcReportSection__title">פרטי תשלום / משלם</div><div class="lcReportStack">${payerFields.join('')}</div></section>` : ''}
        <section class="lcReportSection"><div class="lcReportSection__title">הצהרת בריאות</div><div class="lcReportSection__sub">מופיעים רק ממצאים שסומנו כ"כן" ונשמרו במלואם.</div><div class="lcReportList">${healthItems.length ? healthItems.join('') : '<div class="muted">לא סומנו ממצאים רפואיים.</div>'}</div></section>
      </div>`;
    },

    openOperationalReport(){
      if(!this.els.report || !this.els.reportBody) return;
      this.els.reportBody.innerHTML = this.renderOperationalReport();
      this.els.report.classList.add('is-open');
      this.els.report.setAttribute('aria-hidden','false');
    },

    closeOperationalReport(){
      if(!this.els.report) return;
      this.els.report.classList.remove('is-open');
      this.els.report.setAttribute('aria-hidden','true');
    },

    exportOperationalPdf(){
      this.openOperationalReport();
      window.print();
    },

    showFinishFlow(){
      if(!this.els.flow) return;
      this.els.flow.classList.add('is-open');
      this.els.flow.setAttribute('aria-hidden','false');
      if(this.els.flowLoading) this.els.flowLoading.style.display = '';
      if(this.els.flowSuccess) this.els.flowSuccess.style.display = 'none';
      if(this.els.flowProgress) this.els.flowProgress.style.width = '0%';
      setTimeout(() => { if(this.els.flowProgress) this.els.flowProgress.style.width = '100%'; }, 80);
      setTimeout(() => {
        if(this.els.flowLoading) this.els.flowLoading.style.display = 'none';
        if(this.els.flowSuccess) this.els.flowSuccess.style.display = '';
      }, 5200);
    },

    hideFinishFlow(){
      if(!this.els.flow) return;
      this.els.flow.classList.remove('is-open');
      this.els.flow.setAttribute('aria-hidden','true');
    },

    async finishWizard(){
      if(this._finishing) return;
      const v = this.validateStep(8);
      if(!v.ok){
        this.setHint(v.msg || 'לא ניתן לסיים לפני השלמה מלאה של כל השאלון');
        this.step = 8;
        this.render();
        return;
      }
      this._finishing = true;
      this.setHint("");
      this.showFinishFlow();
      try{
        const saved = await this.saveCompletedCustomer();
        this.lastSavedCustomerId = saved?.id || null;
        CustomersUI.render();
        ProposalsUI.render();
      }catch(err){
        console.error("FINISH_WIZARD_SAVE_ERROR", err);
        this.hideFinishFlow();
        this.setHint("שמירת הלקוח נכשלה. בדוק חיבור ל-Google Sheets ונסה שוב.");
        return;
      }finally{
        this._finishing = false;
      }
    },

    async saveCompletedCustomer(){
      const payload = this.getOperationalPayload();
      const primary = payload?.primary || {};
      const record = normalizeCustomerRecord({
        id: "cust_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2,8),
        status: "חדש",
        fullName: safeTrim(((primary.firstName || "") + " " + (primary.lastName || "")).trim()) || "לקוח ללא שם",
        idNumber: safeTrim(primary.idNumber),
        phone: safeTrim(primary.phone),
        email: safeTrim(primary.email),
        city: safeTrim(primary.city),
        agentName: safeTrim(Auth?.current?.name),
        agentRole: safeTrim(Auth?.current?.role),
        createdAt: nowISO(),
        updatedAt: nowISO(),
        insuredCount: (payload.insureds || []).length,
        existingPoliciesCount: (payload.insureds || []).reduce((acc, ins) => acc + ((ins?.data?.existingPolicies || []).length), 0),
        newPoliciesCount: (payload.newPolicies || []).length,
        payload
      });

      State.data.customers = Array.isArray(State.data.customers) ? State.data.customers : [];
      const sameIndex = State.data.customers.findIndex(x =>
        safeTrim(x.idNumber) && safeTrim(x.idNumber) === record.idNumber &&
        Math.abs(new Date(x.createdAt).getTime() - new Date(record.createdAt).getTime()) < 5 * 60 * 1000
      );
      if(sameIndex >= 0){
        State.data.customers[sameIndex] = {
          ...State.data.customers[sameIndex],
          ...record,
          createdAt: State.data.customers[sameIndex].createdAt || record.createdAt
        };
      }else{
        State.data.customers.unshift(record);
      }
      State.data.proposals = Array.isArray(State.data.proposals) ? State.data.proposals : [];
      if(this.editingDraftId){
        State.data.proposals = State.data.proposals.filter(x => String(x.id) !== String(this.editingDraftId));
        this.editingDraftId = null;
      }
      State.data.meta.updatedAt = nowISO();
      await App.persist("הלקוח נשמר");
      return record;
    },

    stepCompletionMap(stepId){
      const map = {};
      this.insureds.forEach(ins => { map[ins.id] = this.isStepCompleteForInsured(stepId, ins); });
      return map;
    },

    validateStep(stepId){
      // Step 5: new policies (case-level)
      if(stepId === 5){
        const res = this.validateStep5();
        return res;
      }
      // Step 6: payer (case-level, stored on primary insured)
      if(stepId === 6){
        const primary = this.insureds[0];
        const ok = this.isStepCompleteForInsured(6, primary);
        return ok ? {ok:true} : {ok:false, msg:"חסר מילוי חובה בפרטי משלם"};
      }
      if(stepId === 7){
        return { ok:true };
      }
      if(stepId === 8){
        return this.getHealthBlockingIssue();
      }

      const bad = this.insureds.filter(ins => !this.isStepCompleteForInsured(stepId, ins));
      if(!bad.length) return { ok:true };
      const names = bad.map(x => x.label).join(", ");
      return { ok:false, msg: "חסר מילוי חובה עבור: " + names };
    },

    isStepCompleteForInsured(stepId, ins){
      const d = ins.data || {};
      if(stepId === 1){
        const baseReq = ["firstName","lastName","idNumber","birthDate","gender"];
        const childReq = baseReq.concat(["clinic","shaban"]);
        const adultReq = baseReq.concat(["phone","email","city","street","houseNumber","clinic","shaban","occupation"]);
        const req = (ins.type === "child") ? childReq : adultReq;

        // for child, inherited fields must exist in primary
        if(ins.type === "child"){
          const p = this.insureds[0]?.data || {};
          const inh = ["phone","email","city","street","houseNumber"];
          const inhOk = inh.every(k => safeTrim(p[k]));
          if(!inhOk) return false;
        }

        return req.every(k => safeTrim(d[k]));
      }

      if(stepId === 2){
        const h = Number(d.heightCm);
        const w = Number(d.weightKg);
        return !!(h > 0 && w > 0 && d.bmi !== null);
      }

      if(stepId === 3){
        // Existing policies: every opened row must include monthly premium (0 allowed).
        // Additionally: if a risk policy has pledge -> bank is required; if via bank agency -> agency required.
        const list = d.existingPolicies || [];
        for(const p of list){
          if(safeTrim(p.monthlyPremium) === "") return false;
        }
        for(const p of list){
          const isRisk = (p.type === "ריסק" || p.type === "ריסק משכנתא");
          if(!isRisk) continue;
          if(p.bankAgency && !p.hasPledge) return false;
          if(p.hasPledge){
            if(!safeTrim(p.pledgeBankName)) return false;
            if(p.bankAgency && !safeTrim(p.bankAgencyName)) return false;
          }
        }
        return true;
      }

      if(stepId === 4){
        // if there are existing policies, must choose status per policy; if full/partial -> reason required
        const list = d.existingPolicies || [];
        for(const p of list){
          const c = d.cancellations?.[p.id] || {};
          if(!safeTrim(c.status)) return false;
          if((c.status === "full" || c.status === "partial_health") && !safeTrim(c.reason)) return false;
        }
        return true;
      }

      if(stepId === 5){
        // new policies: if exists, must have company, type, premiumBefore >0, discountPct >=0
        const list = d.newPolicies || [];
        for(const p of list){
          if(!safeTrim(p.company) || !safeTrim(p.type)) return false;
          if(!(Number(p.premiumBefore) > 0)) return false;
          if(Number(p.discountPct) < 0) return false;
          const isRisk = (p.type === "ריסק" || p.type === "ריסק משכנתא");
          const isCI = (p.type === "מחלות קשות" || p.type === "סרטן");
          if(isRisk && !safeTrim(p.sumInsured)) return false;
          if(isCI && !safeTrim(p.compensation)) return false;
          if(isRisk && p.pledge){
            const b = p.pledgeBank || {};
            if(!safeTrim(b.bankName) || !safeTrim(b.bankNo) || !safeTrim(b.branch) || !safeTrim(b.amount) || !safeTrim(b.years) || !safeTrim(b.address)) return false;
          }
        }
        return true;
      }

      if(stepId === 6){
        // payer: child cannot be payer (we already filter). If payerChoice insured -> must select.
        if(d.payerChoice === "insured"){
          if(!safeTrim(d.selectedPayerId)) return false;
        }else{
          const ex = d.externalPayer || {};
          const req = ["relation","firstName","lastName","idNumber","birthDate","phone"];
          if(!req.every(k => safeTrim(ex[k]))) return false;
        }
        if(safeTrim(d.paymentMethod) === "cc"){
          const cc = d.cc || {};
          const req = ["holderName","holderId","cardNumber","exp"];
          if(!req.every(k => safeTrim(cc[k]))) return false;
        }else{
          const ho = d.ho || {};
          const req = ["account","branch","bankName","bankNo"];
          if(!req.every(k => safeTrim(ho[k]))) return false;
        }
        return true;
      }

      return true;
    },

    // ---------- Small field helpers ----------
    fieldText(label, bind, value, inputmode="text", disabled=false, forceBind=false){
      // forceBind: bind string already includes dot-path as needed (used for nested in newPolicies pledgeBank)
      const dataBind = forceBind ? bind : bind;
      return `<div class="field">
        <label class="label">${escapeHtml(label)}</label>
        <input class="input" data-bind="${escapeHtml(dataBind)}" value="${escapeHtml(value||"")}" ${disabled?"disabled":""} ${inputmode==="numeric"?'inputmode="numeric"':''} ${inputmode==="decimal"?'inputmode="decimal"':''} />
      </div>`;
    },
    fieldDate(label, bind, value){
      // Manual IL date typing: DD/MM/YYYY
      return `<div class="field">
        <label class="label">${escapeHtml(label)}</label>
        <input class="input" type="text" dir="ltr" inputmode="numeric" autocomplete="off"
               placeholder="DD/MM/YYYY" maxlength="10"
               data-datefmt="dmy"
               data-bind="${escapeHtml(bind)}"
               value="${escapeHtml(value||"")}" />
      </div>`;
    },
    fieldSelect(label, bind, value, options){
      const opts = options.map(o => `<option value="${escapeHtml(o)}"${String(value)===String(o)?" selected":""}>${escapeHtml(o || "בחר…")}</option>`).join("");
      return `<div class="field">
        <label class="label">${escapeHtml(label)}</label>
        <select class="input" data-bind="${escapeHtml(bind)}">${opts}</select>
      </div>`;
    },

    
    // ---------- UI micro-updaters (avoid full re-render on every keystroke) ----------
    updateBmiUI(ins){
      const body = this.els.body;
      if(!body) return;

      const has = !(ins.data.bmi === null || ins.data.bmi === undefined || ins.data.bmi === "");
      const v = has ? String(ins.data.bmi) : "—";

      const cardEl = body.querySelector('[data-bmi="card"]');
      if(cardEl) cardEl.classList.toggle("is-empty", !has);

      const valEl = body.querySelector('[data-bmi="value"]');
      if(valEl){
        // supports both <input> and <div>
        if("value" in valEl) valEl.value = v;
        else valEl.textContent = v;
      }

      const st = this.bmiStatus(ins.data.bmi);
      const lampEl = body.querySelector('[data-bmi="lamp"]');
      if(lampEl){
        lampEl.classList.remove("green","yellow","red");
        if(st.lamp) lampEl.classList.add(st.lamp);
      }

      const labelEl = body.querySelector('[data-bmi="label"]');
      if(labelEl) labelEl.textContent = has ? (st.label || "—") : "מלא גובה ומשקל";
    },

    updateZipUI(ins){
      const body = this.els.body;
      if(!body) return;
      const el = body.querySelector('[data-zip="zip"]');
      if(el) el.value = safeTrim(ins.data.zip || "");
    },

    scheduleZipLookup(ins){
      // Only for primary/spouse/adult (children inherit primary address)
      if(ins.type === "child") return;

      const city = safeTrim(ins.data.city);
      const street = safeTrim(ins.data.street);
      const house = safeTrim(ins.data.houseNumber);

      // need at least city + street
      if(!city || !street) return;

      // Debounce per insured
      if(!this._zipTimers) this._zipTimers = {};
      if(!this._zipLastKey) this._zipLastKey = {};

      const key = `${city}|${street}|${house}`;
      if(this._zipLastKey[ins.id] === key) return;
      this._zipLastKey[ins.id] = key;

      clearTimeout(this._zipTimers[ins.id]);
      this._zipTimers[ins.id] = setTimeout(async () => {
        try{
          const q = `${street} ${house || ""}, ${city}, Israel`;
          const zip = await this.lookupZipNominatim(q);
          if(zip){
            ins.data.zip = zip;
            this.updateZipUI(ins);
          }
        }catch(_){}
      }, 700);
    },

    async lookupZipNominatim(query){
      const q = safeTrim(query);
      if(!q) return "";
      const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=il&limit=1&q=" + encodeURIComponent(q);
      const r = await fetch(url, { method:"GET" });
      if(!r.ok) return "";
      const j = await r.json();
      const hit = Array.isArray(j) ? j[0] : null;
      const pc = hit?.address?.postcode ? String(hit.address.postcode) : "";
      const digits = pc.replace(/[^0-9]/g, "").slice(0,7);
      // Israeli postal codes are usually 7 digits (sometimes shown as 5 in old format)
      return digits || "";
    },
calcAge(dateStr){
      const s = safeTrim(dateStr);
      if(!s) return null;

      // Accept ISO (YYYY-MM-DD) and common IL format (DD/MM/YYYY)
      let y=null, m=null, dn=null;
      const iso = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(s);
      const il  = /^\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/.exec(s);
      if(iso){ y=Number(iso[1]); m=Number(iso[2]); dn=Number(iso[3]); }
      else if(il){ y=Number(il[3]); m=Number(il[2]); dn=Number(il[1]); }
      else return null;

      if(!y || !m || !dn) return null;
      const birth = new Date(y, m-1, dn); // local, avoids timezone parsing quirks
      if(isNaN(birth.getTime())) return null;

      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const mm = now.getMonth() - birth.getMonth();
      if (mm < 0 || (mm === 0 && now.getDate() < birth.getDate())) age--;
      return age;
    }
  };


const App = {
    _bootPromise: null,

    async boot(){
      Storage.restoreUrl();
      UI.renderSyncStatus("טוען…", "warn");

      // load from sheets
      const r = await Storage.loadSheets();
      if (r.ok) {
        State.data = r.payload;
        Storage.saveBackup(State.data);
        UI.renderSyncStatus("מחובר", "ok", r.at);
      } else {
        const backup = Storage.loadBackup();
        if (backup) {
          State.data = backup;
        } else {
          State.data = defaultState();
        }
        UI.renderSyncStatus("לא מחובר", "err", null, r.error);
      }

      // sync gsUrl field
      if (UI.els.gsUrl) UI.els.gsUrl.value = Storage.gsUrl || "";

      // after state is ready: apply role UI
      UI.applyRoleUI();
      if (Auth.current) {
        // keep current view (admin -> settings)
        UI.goView(Auth.isAdmin() ? "settings" : "dashboard");
      } else {
        UI.goView("dashboard");
      }
    },

    async persist(label){
      // backup always
      try { Storage.saveBackup(State.data); } catch(_) {}

      // save to sheets
      UI.renderSyncStatus("שומר…", "warn");
      const r = await Storage.saveSheets(State.data);
      if (r.ok) {
        UI.renderSyncStatus(label || "נשמר", "ok", r.at);
      } else {
        UI.renderSyncStatus("שגיאה בשמירה", "err", null, r.error);
        console.error("SAVE_TO_SHEETS_FAILED:", r?.error || r);
      }
      return r;
    },

    async reloadSessionState(){
      if(!Auth.current) return { ok:false, error:"NO_SESSION" };
      UI.renderSyncStatus("טוען נתוני משתמש…", "warn");
      const r = await Storage.loadSheets();
      if (r.ok) {
        State.data = r.payload;
        Storage.saveBackup(State.data);
        UI.renderSyncStatus("נתוני משתמש נטענו", "ok", r.at);
        if (Auth.isAdmin()) UsersUI.render();
        if (Auth.current) {
          CustomersUI.render();
          ProposalsUI.render();
        }
      } else {
        UI.renderSyncStatus("שגיאה בטעינת נתוני משתמש", "err", null, r.error);
        console.error("LOAD_SESSION_STATE_FAILED:", r?.error || r);
      }
      return r;
    },

    async syncNow(){
      UI.renderSyncStatus("מסנכרן…", "warn");
      const r = await Storage.loadSheets();
      if (r.ok) {
        State.data = r.payload;
        Storage.saveBackup(State.data);
        UI.renderSyncStatus("סונכרן", "ok", r.at);
        if (Auth.isAdmin()) UsersUI.render();
        if (Auth.current) { CustomersUI.render(); ProposalsUI.render(); }
      } else {
        UI.renderSyncStatus("שגיאה בסנכרון", "err", null, r.error);
      }
    }
  };

  // ---------- Start ----------
  UI.init();
  Auth.init();
  ForgotPasswordUI.init();
  CustomersUI.init();
  ArchiveCustomerUI.init();
  Wizard.init();
  App._bootPromise = App.boot();

})();
