/* GEMEL INVEST CRM — CLEAN CORE (Sheets + Admin Settings/Users)
   BUILD 20260226-142152
   - Keeps: Login, user pill, Google Sheets connection, Admin: System Settings + Users
   - Removes: Customers / New Customer flow / Policies UI
*/
(() => {
  "use strict";

  const BUILD = "20260227-030000";

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
    ]
  });

  const State = {
    data: defaultState()
  };

  function normalizeState(s){
    const base = defaultState();
    const out = {
      meta: { ...(s?.meta || {}) },
      agents: Array.isArray(s?.agents) ? s.agents : base.agents
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
      const role = (roleRaw === "manager" || roleRaw === "adminLite" || roleRaw === "admin") ? "manager" : "agent";
      return {
        id: safeTrim(a?.id) || ("a_" + idx),
        name, username, pin, role, active
      };
    }).filter(a => a.name);

    if (!out.agents.length) out.agents = base.agents;
    out.meta.updatedAt = safeTrim(out.meta.updatedAt) || nowISO();
    return out;
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
        remember: $("#lcLoginRemember"),
        err: $("#lcLoginError"),
      };

      // show login immediately
      try {
        document.body.classList.add("lcAuthLock");
        this.els.wrap?.setAttribute?.("aria-hidden","false");
      } catch(_) {}

      const restored = this._restoreSession();
      if (restored) {
        this.current = restored;
        this.unlock();
      } else {
        this.lock();
      }

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
      const remember = !!this.els.remember?.checked;

      this._setError("");
      if(!username) return this._setError("נא להזין שם משתמש");
      if(!pin) return this._setError("נא להזין קוד כניסה");

      // ensure boot done
      try { await App._bootPromise; } catch(_) {}

      const defAdmin = { username:"מנהל מערכת", pin:"1234" };
      const adminAuth = State.data?.meta?.adminAuth || { ...defAdmin, active:true };
      const masterOk = (username === defAdmin.username && pin === defAdmin.pin);

      if (masterOk || (adminAuth.active !== false && username === safeTrim(adminAuth.username) && pin === safeTrim(adminAuth.pin))) {
        this.current = { name: safeTrim(adminAuth.username) || defAdmin.username, role:"admin" };
        if(remember) this._saveSession(this.current); else localStorage.removeItem(LS_SESSION_KEY);
        this.unlock();
        UI.applyRoleUI();
        UI.renderAuthPill();
        UI.goView("settings");
        return;
      }

      const agents = Array.isArray(State.data?.agents) ? State.data.agents : [];
      const matched = agents.find(a => safeTrim(a?.username) === username) || agents.find(a => safeTrim(a?.name) === username);
      if(!matched) return this._setError("שם משתמש לא נמצא");
      if(matched.active === false) return this._setError("המשתמש מושבת");
      const expected = safeTrim(matched.pin) || "0000";
      if(pin !== expected) return this._setError("קוד כניסה שגוי");

      this.current = { name: matched.name, role: (matched.role === "manager" ? "manager" : "agent") };
      if(remember) this._saveSession(this.current); else localStorage.removeItem(LS_SESSION_KEY);
      this.unlock();
      UI.applyRoleUI();
      UI.renderAuthPill();
      UI.goView("dashboard");
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
      this.els.btnNewCustomer = $("#btnNewCustomer");

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

      on(this.els.btnLogout, "click", () => Auth.logout());
      on(this.els.btnNewCustomer, "click", () => Wizard.open());

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

      Wizard.init();
      this.applyRoleUI();
      this.renderAuthPill();
    },

    applyRoleUI(){
      const isAdmin = Auth.isAdmin();
      const canUsers = Auth.canManageUsers();
      const settingsBtn = document.querySelector('.nav__item[data-view="settings"]');
      if (settingsBtn) settingsBtn.style.display = isAdmin ? "" : "none";
      if (this.els.navUsers) this.els.navUsers.style.display = canUsers ? "" : "none";
    },

    setActiveNav(view){
      $$(".nav__item").forEach(b => b.classList.toggle("is-active", b.getAttribute("data-view") === view));
    },

    goView(view){
      let safe = String(view || "dashboard");
      if(safe === "settings" && !Auth.isAdmin()) safe = "dashboard";
      if(safe === "users" && !Auth.canManageUsers()) safe = "dashboard";
      // hide all views
      $$(".view").forEach(v => v.classList.remove("is-visible"));
      const el = $("#view-" + safe);
      if (el) el.classList.add("is-visible");

      // title
      if (this.els.pageTitle) {
        const map = {
          dashboard: "דשבורד",
          settings: "הגדרות מערכת",
          users: "ניהול משתמשים"
        };
        this.els.pageTitle.textContent = map[safe] || "דשבורד";
      }

      this.setActiveNav(safe);
      document.body.classList.remove("view-users-active","view-dashboard-active","view-settings-active");
      document.body.classList.add("view-" + safe + "-active");

      // render view data
      if (safe === "users") UsersUI.render();
    },

    renderAuthPill(){
      const pill = this.els.userPill;
      const txt = this.els.userPillText;
      if(!pill || !txt) return;

      if(Auth.current) {
        pill.style.display = "";
        if (this.els.btnNewCustomer) this.els.btnNewCustomer.style.display = "";
        txt.textContent = Auth.current.name + (Auth.isAdmin() ? " (מנהל מערכת)" : Auth.isManager() ? " (מנהל)" : "");
      } else {
        pill.style.display = "none";
        if (this.els.btnNewCustomer) this.els.btnNewCustomer.style.display = "none";
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
        const role = (a.role === "manager") ? "מנהל" : "נציג";
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
      const rolePick = safeTrim(prompt("סוג משתמש: 1=נציג, 2=מנהל (ללא הגדרות מערכת)", "1") || "1");
      const role = (rolePick === "2" ? "manager" : "agent");
      const name = safeTrim(prompt(role === "manager" ? "שם מנהל:" : "שם נציג/סוכן:") || "");
      if(!name) return;
      const username = safeTrim(prompt("שם משתמש (ברירת מחדל = שם):", name) || name);
      const pin = safeTrim(prompt("קוד כניסה (PIN):", "0000") || "0000");

      const id = "a_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
      State.data.agents = Array.isArray(State.data.agents) ? State.data.agents : [];
      State.data.agents.push({ id, name, username, pin, role, active:true });
      State.data.meta.updatedAt = nowISO();

      await App.persist("נשמר משתמש חדש");
      this.render();
    },

    async editUser(id){
      const a = (State.data.agents || []).find(x => String(x.id) === String(id));
      if(!a) return;

      const name = safeTrim(prompt("שם:", a.name) || a.name);
      const username = safeTrim(prompt("שם משתמש:", a.username) || a.username);
      const pin = safeTrim(prompt("PIN:", a.pin) || a.pin);
      const rolePick = safeTrim(prompt("תפקיד: 1=נציג, 2=מנהל (ללא הגדרות מערכת)", (a.role === "manager" ? "2" : "1")) || (a.role === "manager" ? "2" : "1"));
      const role = (rolePick === "2" ? "manager" : "agent");
      const active = confirm("האם המשתמש פעיל? (אישור=פעיל, ביטול=מושבת)");
      a.name = name;
      a.username = username;
      a.pin = pin;
      a.role = role;
      a.active = active;
      State.data.meta.updatedAt = nowISO();

      await App.persist("עודכן משתמש");
      this.render();
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

  // ---------- App boot ----------
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
      if (r.ok) UI.renderSyncStatus(label || "נשמר", "ok", r.at);
      else UI.renderSyncStatus("שגיאה בשמירה", "err", null, r.error);
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
      } else {
        UI.renderSyncStatus("שגיאה בסנכרון", "err", null, r.error);
      }
    }
  };

  // ---------- New Customer Wizard (Step 1 only) ----------
  
  // ---------- New Customer Wizard (Steps 1-2: Details + BMI) ----------
  const Wizard = {
    els: {},
    state: { step: 1, insured: [], bmi: {}, policies: [], policyDraft: { annexText: "" } },

    init(){
      this.els.wrap = $("#lcWizard");
      this.els.backdrop = $("#lcWizardBackdrop");
      this.els.btnClose = $("#btnCloseWizard");
      this.els.btnAddInsured = $("#btnAddInsured");
      this.els.btnNext = $("#btnWizardNext");
      this.els.btnPrev = $("#btnWizardPrev");
      this.els.progressFill = $("#lcProgressFill");
      this.els.progressText = $("#lcProgressText");
      this.els.title = $("#lcWizardTitle");
      this.els.sub = $("#lcWizardSub");
      this.els.footHint = $("#lcWizardFootHint");

      this.els.step1 = $("#lcStep1");
      this.els.step2 = $("#lcStep2");
      this.els.bmiList = $("#lcBmiList");
      this.els.step3 = $("#lcStep3");

      // Step 3 (Existing Policies)
      this.els.p_insured = $("#p_insured");
      this.els.p_company = $("#p_company");
      this.els.p_product = $("#p_product");
      this.els.p_policyNumber = $("#p_policyNumber");
      this.els.p_status = $("#p_status");
      this.els.p_compWrap = $("#p_compWrap");
      this.els.p_covWrap = $("#p_covWrap");
      this.els.p_compAmount = $("#p_compAmount");
      this.els.p_covAmount = $("#p_covAmount");
      this.els.p_bankWrap = $("#p_bankWrap");
      this.els.p_agencyWrap = $("#p_agencyWrap");
      this.els.p_agency = $("#p_agency");
      this.els.p_annexHint = $("#p_annexHint");
      this.els.btnAddPolicy = $("#btnAddPolicy");
      this.els.policyList = $("#lcPolicyList");

      // Annex modal (partial cancel)
      this.els.annexModal = $("#lcAnnexModal");
      this.els.btnCloseAnnexModal = $("#btnCloseAnnexModal");
      this.els.btnSaveAnnex = $("#btnSaveAnnex");
      this.els.btnCancelAnnex = $("#btnCancelAnnex");
      this.els.p_annexText = $("#p_annexText");


      const ids = ["c_firstName","c_lastName","c_id","c_dob","c_gender","c_marital","c_phone",
                   "c_city","c_street","c_house","c_apt","c_zip","c_job"];
      this.els.fields = Object.fromEntries(ids.map(id => [id, $("#"+id)]));
      this.els.age = $("#c_age");
      this.els.insuredList = $("#lcInsuredList");
      this.els.btnZipLookup = $("#btnZipLookup");

      this.els.picker = $("#lcInsuredPicker");
      this.els.btnClosePicker = $("#btnCloseInsuredPicker");

      on(this.els.btnClose, "click", () => this.close());
      on(this.els.backdrop, "click", () => this.close());
      on(this.els.btnAddInsured, "click", () => this.openPicker());
      on(this.els.btnClosePicker, "click", () => this.closePicker());
      on($(".lcMiniModal__backdrop", this.els.picker), "click", () => this.closePicker());

      $$(".lcPick", this.els.picker).forEach(btn => {
        on(btn, "click", () => {
          const t = btn.getAttribute("data-type");
          this.addInsured(t);
          this.closePicker();
        });
      });

      on(this.els.fields.c_dob, "change", () => { this.updateAge(); this.updateProgress(); });

      Object.values(this.els.fields).forEach(el => {
        if(!el) return;
        on(el, "input", () => this.updateProgress());
        on(el, "change", () => this.updateProgress());
      });

      on(this.els.btnZipLookup, "click", async () => { await this.lookupZip(); });
      // Step 3 bindings
      const onPolicyChange = () => { this.updatePolicyVisibility(); this.updateProgress(); };
      on(this.els.p_product, "change", onPolicyChange);
      on(this.els.p_status, "change", () => { 
        this.onPolicyStatusChange(); 
        this.updateProgress(); 
      });
      on(this.els.p_company, "change", () => this.updateProgress());
      on(this.els.p_policyNumber, "input", () => this.updateProgress());
      on(this.els.p_compAmount, "input", () => this.updateProgress());
      on(this.els.p_covAmount, "input", () => this.updateProgress());
      on(this.els.p_insured, "change", () => this.updateProgress());
      on(this.els.p_agency, "change", () => this.updateProgress());

      // radio yes/no
      $$('#p_bankYesNo input[name="p_bank"]').forEach(r => on(r, "change", () => { this.updatePolicyVisibility(); this.updateProgress(); }));

      on(this.els.btnAddPolicy, "click", () => this.addPolicy());

      // annex modal controls
      on(this.els.btnCloseAnnexModal, "click", () => this.closeAnnexModal(true));
      on(this.els.btnCancelAnnex, "click", () => this.closeAnnexModal(true));
      on($(".lcMiniModal__backdrop", this.els.annexModal), "click", () => this.closeAnnexModal(true));
      on(this.els.btnSaveAnnex, "click", () => this.saveAnnexText());


      on(this.els.btnNext, "click", () => this.goNext());
      on(this.els.btnPrev, "click", () => this.goPrev());

      this.showStep(1);
      this.updateProgress();
    },

    open(){
      if(!this.els.wrap) return;
      this.reset();
      this.els.wrap.classList.add("is-open");
      this.els.wrap.setAttribute("aria-hidden","false");
      setTimeout(() => this.els.fields.c_firstName?.focus?.(), 80);
    },

    close(){
      if(!this.els.wrap) return;
      this.els.wrap.classList.remove("is-open");
      this.els.wrap.setAttribute("aria-hidden","true");
      this.closePicker();
    },

    reset(){
      Object.values(this.els.fields || {}).forEach(el => { if(el) el.value = ""; });
      if(this.els.age) this.els.age.textContent = "—";
      this.state.insured = [];
      this.state.bmi = {};
      this.state.policies = [];
      this.state.policyDraft = { annexText: "" };
      this.renderInsured();
      this.showStep(1);
      this.updateProgress();
    },

    showStep(n){
      this.state.step = n;

      if(this.els.step1) this.els.step1.classList.toggle("is-active", n === 1);
      if(this.els.step2) this.els.step2.classList.toggle("is-active", n === 2);
      if(this.els.step3) this.els.step3.classList.toggle("is-active", n === 3);

      if(this.els.btnPrev) this.els.btnPrev.style.display = (n >= 2) ? "" : "none";
      if(this.els.btnNext) this.els.btnNext.textContent = (n === 3) ? "סיום" : "המשך";

      const hintEl = $("#lcProgressHint");
      if(hintEl){
        hintEl.textContent = (n === 1) ? "השלמת שלב פרטי לקוח"
          : (n === 2) ? "השלמת שלב BMI"
          : "השלמת שלב ביטוחים קיימים";
      }

      if(this.els.footHint){
        this.els.footHint.textContent =
          (n === 1) ? "כפתור “המשך” יופעל לאחר מילוי כל שדות החובה."
          : (n === 2) ? "מלא גובה ומשקל לכל מבוטח — ואז המשך."
          : "הוסף לפחות פוליסה קיימת אחת — ואז אפשר לסיים.";
      }

      if(this.els.title) this.els.title.textContent = `הקמת לקוח חדש · שלב ${n}`;
      if(this.els.sub) this.els.sub.textContent = (n === 1) ? "פרטי לקוח" : (n === 2) ? "BMI" : "ביטוחים קיימים";

      if(n === 2){
        this.renderBMI();
        setTimeout(() => {
          const first = this.els.bmiList?.querySelector?.('input[data-bmi="h"]');
          first?.focus?.();
        }, 50);
      }

      if(n === 3){
        this.populatePolicyPickers();
        this.updatePolicyVisibility();
        this.renderPolicies();
        setTimeout(() => this.els.p_company?.focus?.(), 60);
      }

      this.updateProgress();
    },

    goNext(){
      if(this.state.step === 1){
        if(!this.isStepValid()) return;
        this.showStep(2);
        return;
      }
      if(this.state.step === 2){
        if(!this.isStep2Valid()) return;
        this.showStep(3);
        return;
      }
      if(this.state.step === 3){
        if(!this.isStep3Valid()) return;
        alert("שלב 3 הושלם ✅\nנשמרו ביטוחים קיימים ללקוח.");
        this.close();
        return;
      }
    },

    goPrev(){
      if(this.state.step === 2) this.showStep(1);
      else if(this.state.step === 3) this.showStep(2);
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

    updateAge(){
      const dob = safeTrim(this.els.fields.c_dob?.value);
      if(!dob) { if(this.els.age) this.els.age.textContent = "—"; return; }
      const d = new Date(dob + "T00:00:00");
      if(Number.isNaN(d.getTime())) { if(this.els.age) this.els.age.textContent = "—"; return; }
      const today = new Date();
      let age = today.getFullYear() - d.getFullYear();
      const m = today.getMonth() - d.getMonth();
      if(m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
      if(this.els.age) this.els.age.textContent = (age >= 0 && age <= 130) ? String(age) : "—";
    },

    requiredMain(){
      return ["c_firstName","c_lastName","c_id","c_dob","c_gender","c_marital","c_phone","c_city","c_street","c_house","c_job"];
    },

    isStepValid(){
      const missing = this.requiredMain().filter(id => !safeTrim(this.els.fields[id]?.value));
      const idv = safeTrim(this.els.fields.c_id?.value);
      if(idv && !/^\d{5,10}$/.test(idv)) missing.push("c_id");
      const ph = safeTrim(this.els.fields.c_phone?.value);
      if(ph && !/^[0-9+\-\s]{7,15}$/.test(ph)) missing.push("c_phone");
      return missing.length === 0 && this.areInsuredValid();
    },

    insuredLabel(type){
      if(type === "spouse") return "מבוטח/ת בן/בת זוג";
      if(type === "adult") return "מבוטח/ת בגיר";
      return "מבוטח/ת קטין";
    },

    insuredRequired(item){
      if(item.type === "minor") return ["firstName","lastName","id","dob","gender"];
      return ["firstName","lastName","id","dob","gender","phone","job"];
    },

    areInsuredValid(){
      for(const it of this.state.insured){
        const req = this.insuredRequired(it);
        const data = it.data || {};
        for(const k of req){
          if(!safeTrim(data[k])) return false;
        }
      }
      return true;
    },

    completionPct(){
      const req = this.requiredMain();
      let filled = 0;
      req.forEach(id => { if(safeTrim(this.els.fields[id]?.value)) filled++; });

      const insuredReqTotal = this.state.insured.reduce((acc, it) => acc + this.insuredRequired(it).length, 0);
      const insuredReqFilled = this.state.insured.reduce((acc, it) => {
        const r = this.insuredRequired(it);
        const data = it.data || {};
        r.forEach(k => { if(safeTrim(data[k])) acc++; });
        return acc;
      }, 0);

      const total = req.length + insuredReqTotal;
      const done = filled + insuredReqFilled;
      if(total <= 0) return 0;
      return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
    },

    // ---------- BMI ----------
    allPersons(){
      const mainFn = safeTrim(this.els.fields.c_firstName?.value);
      const mainLn = safeTrim(this.els.fields.c_lastName?.value);
      const mainName = [mainFn, mainLn].filter(Boolean).join(" ").trim();
      const mainLabel = mainName ? `מבוטח ראשי · ${mainName}` : "מבוטח ראשי";

      const list = [{ key:"main", label: mainLabel }].concat(
        this.state.insured.map(it => {
          const fn = safeTrim(it.data?.firstName);
          const ln = safeTrim(it.data?.lastName);
          const nm = [fn, ln].filter(Boolean).join(" ").trim();
          const lbl = nm ? `${it.label} · ${nm}` : it.label;
          return { key: it.id, label: lbl };
        })
      );
      return list;
    },

    bmiLevel(bmi){
      if(!(bmi > 0)) return { cls:"", text:"—" };
      if(bmi >= 18.5 && bmi < 25) return { cls:"is-green", text:"תקין" };
      if(bmi >= 25 && bmi < 30) return { cls:"is-amber", text:"עודף" };
      return { cls:"is-red", text:"סיכון" };
    },

    computeBMI(hCm, wKg){
      const h = Number(hCm);
      const w = Number(wKg);
      if(!(h > 0) || !(w > 0)) return null;
      const hm = h / 100;
      const bmi = w / (hm * hm);
      if(!Number.isFinite(bmi)) return null;
      return bmi;
    },

    bmiCompletionPct(){
      const persons = this.allPersons();
      if(!persons.length) return 0;
      let need = 0, done = 0;
      for(const p of persons){
        need += 2;
        const row = this.state.bmi[p.key] || {};
        if(Number(row.h) > 0) done++;
        if(Number(row.w) > 0) done++;
      }
      return Math.max(0, Math.min(100, Math.round((done / need) * 100)));
    },

    isStep2Valid(){
      const persons = this.allPersons();
      if(!persons.length) return false;
      for(const p of persons){
        const row = this.state.bmi[p.key] || {};
        const h = Number(row.h), w = Number(row.w);
        if(!(h >= 80 && h <= 250)) return false;
        if(!(w >= 20 && w <= 350)) return false;
      }
      return true;
    },

    
    // ---------- Existing Policies (Step 3) ----------
    companies(){
      return ["הראל","כלל","מנורה","הכשרה","מגדל","הפניקס","איילון","ביטוח ישיר","AIG"];
    },
    products(){
      return ["בריאות","מחלות קשות","מחלות סרטן","ריסק","ריסק משכנתא","תאונות אישיות"];
    },
    bankAgencies(){
      return [
        "סוכנות מעלות — בנק לאומי",
        "סוכנות פועלים — בנק פועלים",
        "סוכנות מזרחי טפחות — בנק מזרחי טפחות",
        "סוכנות עיר שלם — בנק ירושלים",
        "סוכנות דיסקונט — בנק דיסקונט"
      ];
    },

    populatePolicyPickers(){
      // insured dropdown
      if(this.els.p_insured){
        const persons = this.allPersons();
        this.els.p_insured.innerHTML = persons.map(p => `<option value="${escapeHtml(p.key)}">${escapeHtml(p.label)}</option>`).join("");
      }

      // company dropdown
      if(this.els.p_company){
        const opts = ['<option value="">בחר…</option>'].concat(this.companies().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`));
        this.els.p_company.innerHTML = opts.join("");
      }

      // product dropdown
      if(this.els.p_product){
        const opts = ['<option value="">בחר…</option>'].concat(this.products().map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`));
        this.els.p_product.innerHTML = opts.join("");
      }

      // agencies dropdown
      if(this.els.p_agency){
        const opts = ['<option value="">בחר…</option>'].concat(this.bankAgencies().map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`));
        this.els.p_agency.innerHTML = opts.join("");
      }
    },

    selectedBankAnswer(){
      const r = document.querySelector('#p_bankYesNo input[name="p_bank"]:checked');
      return r ? String(r.value) : "";
    },

    clearBankAnswer(){
      $$('#p_bankYesNo input[name="p_bank"]').forEach(r => { r.checked = false; });
    },

    onPolicyStatusChange(){
      const status = safeTrim(this.els.p_status?.value);
      if(status === "cancel_partial"){
        this.openAnnexModal();
      } else {
        this.state.policyDraft.annexText = "";
        if(this.els.p_annexHint){ this.els.p_annexHint.style.display = "none"; this.els.p_annexHint.textContent = ""; }
        if(this.els.p_annexText) this.els.p_annexText.value = "";
      }
    },

    updatePolicyVisibility(){
      const product = safeTrim(this.els.p_product?.value);
      const isCritical = (product === "מחלות סרטן" || product === "מחלות קשות");
      const isRisk = (product === "ריסק" || product === "ריסק משכנתא");

      if(this.els.p_compWrap) this.els.p_compWrap.style.display = isCritical ? "" : "none";
      if(this.els.p_covWrap) this.els.p_covWrap.style.display = isRisk ? "" : "none";
      if(!isCritical && this.els.p_compAmount) this.els.p_compAmount.value = "";
      if(!isRisk && this.els.p_covAmount) this.els.p_covAmount.value = "";

      if(this.els.p_bankWrap) this.els.p_bankWrap.style.display = isRisk ? "" : "none";
      if(this.els.p_agencyWrap){
        const showAgency = isRisk && (this.selectedBankAnswer() === "yes");
        this.els.p_agencyWrap.style.display = showAgency ? "" : "none";
        if(!showAgency && this.els.p_agency) this.els.p_agency.value = "";
      }
      if(!isRisk) this.clearBankAnswer();
    },

    openAnnexModal(){
      if(!this.els.annexModal) return;
      this.els.annexModal.classList.add("is-open");
      this.els.annexModal.setAttribute("aria-hidden","false");
      if(this.els.p_annexText){
        this.els.p_annexText.value = safeTrim(this.state.policyDraft.annexText);
        setTimeout(() => this.els.p_annexText?.focus?.(), 40);
      }
    },

    closeAnnexModal(reset=false){
      if(!this.els.annexModal) return;
      this.els.annexModal.classList.remove("is-open");
      this.els.annexModal.setAttribute("aria-hidden","true");
      if(reset){
        if(this.els.p_status && safeTrim(this.els.p_status.value) === "cancel_partial"){
          // if user cancels, revert status selection
          this.els.p_status.value = "";
        }
        this.state.policyDraft.annexText = "";
        if(this.els.p_annexHint){ this.els.p_annexHint.style.display = "none"; this.els.p_annexHint.textContent = ""; }
        if(this.els.p_annexText) this.els.p_annexText.value = "";
      }
    },

    saveAnnexText(){
      const t = safeTrim(this.els.p_annexText?.value);
      if(!t){
        alert("נא למלא נספחים לביטול חלקי");
        this.els.p_annexText?.focus?.();
        return;
      }
      this.state.policyDraft.annexText = t;
      if(this.els.p_annexHint){
        this.els.p_annexHint.style.display = "";
        this.els.p_annexHint.textContent = "נספחים: " + t;
      }
      this.closeAnnexModal(false);
      this.updateProgress();
    },

    normalizeMoney(v){
      const s = safeTrim(v).replace(/[₪,\s]/g, "");
      if(!s) return "";
      if(!/^\d+(\.\d+)?$/.test(s)) return "";
      return s;
    },

    policyForm(){
      const insuredKey = safeTrim(this.els.p_insured?.value);
      const insuredLabel = (this.allPersons().find(p => p.key === insuredKey)?.label) || "";
      const company = safeTrim(this.els.p_company?.value);
      const product = safeTrim(this.els.p_product?.value);
      const policyNumber = safeTrim(this.els.p_policyNumber?.value);
      const status = safeTrim(this.els.p_status?.value);

      const compAmount = this.normalizeMoney(this.els.p_compAmount?.value);
      const covAmount = this.normalizeMoney(this.els.p_covAmount?.value);

      const bankAns = this.selectedBankAnswer(); // yes/no/empty
      const agency = safeTrim(this.els.p_agency?.value);

      const annex = safeTrim(this.state.policyDraft?.annexText);

      return { insuredKey, insuredLabel, company, product, policyNumber, status, compAmount, covAmount, bankAns, agency, annex };
    },

    validatePolicyForm(){
      const f = this.policyForm();
      if(!f.insuredKey) return { ok:false, msg:"בחר מבוטח" };
      if(!f.company) return { ok:false, msg:"בחר חברה" };
      if(!f.product) return { ok:false, msg:"בחר מוצר ביטוח" };
      if(!f.policyNumber) return { ok:false, msg:"מלא מספר פוליסה" };
      if(!f.status) return { ok:false, msg:"בחר סטטוס פוליסה" };

      if(f.product === "מחלות סרטן" || f.product === "מחלות קשות"){
        if(!f.compAmount) return { ok:false, msg:"מלא סכום פיצוי" };
      }
      if(f.product === "ריסק" || f.product === "ריסק משכנתא"){
        if(!f.covAmount) return { ok:false, msg:"מלא סכום ביטוח" };
        if(!(f.bankAns === "yes" || f.bankAns === "no")) return { ok:false, msg:"חובה לבחור כן/לא לגבי סוכנות הבנק" };
        if(f.bankAns === "yes" && !f.agency) return { ok:false, msg:"בחר סוכנות בנק" };
      }

      if(f.status === "cancel_partial"){
        if(!f.annex) return { ok:false, msg:"חובה למלא נספחים לביטול חלקי" };
      }

      return { ok:true };
    },

    addPolicy(){
      const v = this.validatePolicyForm();
      if(!v.ok){ alert(v.msg); return; }

      const f = this.policyForm();
      const id = "pol_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);

      this.state.policies = Array.isArray(this.state.policies) ? this.state.policies : [];
      this.state.policies.push({
        id,
        insuredKey: f.insuredKey,
        insuredLabel: f.insuredLabel,
        company: f.company,
        product: f.product,
        policyNumber: f.policyNumber,
        status: f.status,
        compAmount: f.compAmount || "",
        covAmount: f.covAmount || "",
        bankAns: f.bankAns || "",
        agency: f.agency || "",
        annex: f.annex || ""
      });

      // reset form (keep insured selection)
      if(this.els.p_company) this.els.p_company.value = "";
      if(this.els.p_product) this.els.p_product.value = "";
      if(this.els.p_policyNumber) this.els.p_policyNumber.value = "";
      if(this.els.p_status) this.els.p_status.value = "";
      if(this.els.p_compAmount) this.els.p_compAmount.value = "";
      if(this.els.p_covAmount) this.els.p_covAmount.value = "";
      if(this.els.p_agency) this.els.p_agency.value = "";
      this.clearBankAnswer();
      this.state.policyDraft.annexText = "";
      if(this.els.p_annexHint){ this.els.p_annexHint.style.display = "none"; this.els.p_annexHint.textContent = ""; }
      if(this.els.p_annexText) this.els.p_annexText.value = "";

      this.updatePolicyVisibility();
      this.renderPolicies();
      this.updateProgress();
    },

    removePolicy(id){
      this.state.policies = (this.state.policies || []).filter(p => String(p.id) !== String(id));
      this.renderPolicies();
      this.updateProgress();
    },

    statusLabel(code){
      const m = {
        cancel_full: "ביטול מלא",
        cancel_partial: "ביטול חלקי",
        no_change_client: "ללא שינוי — לבקשת הלקוח",
        no_change_group: "ללא שינוי — קולקטיב/קבוצתי"
      };
      return m[code] || code || "";
    },

    renderPolicies(){
      const host = this.els.policyList;
      if(!host) return;
      const arr = Array.isArray(this.state.policies) ? this.state.policies : [];
      if(!arr.length){
        host.innerHTML = `
          <div class="emptyState glassCard lcGlassBlue">
            <div class="emptyState__title">עדיין לא הוספת ביטוחים</div>
            <div class="emptyState__hint">מלא את הפרטים למעלה ולחץ “הוסף ביטוח”</div>
          </div>`;
        return;
      }

      host.innerHTML = arr.map(p => {
        const amountTxt = p.compAmount ? `סכום פיצוי: ₪${escapeHtml(p.compAmount)}` :
                          p.covAmount ? `סכום ביטוח: ₪${escapeHtml(p.covAmount)}` : "";
        const bankTxt = (p.bankAns === "yes") ? `נרכש דרך סוכנות בנק · ${escapeHtml(p.agency || "")}` :
                        (p.bankAns === "no") ? "לא נרכש דרך סוכנות בנק" : "";
        const annexTxt = p.annex ? `נספחים: ${escapeHtml(p.annex)}` : "";

        return `
          <div class="lcPolicyCard glassCard lcGlassBlue">
            <div class="lcPolicyCard__top">
              <div class="lcPolicyCard__who">${escapeHtml(p.insuredLabel || "מבוטח")}</div>
              <div class="lcPolicyBadges">
                <span class="lcBadge">${escapeHtml(this.statusLabel(p.status))}</span>
                ${p.annex ? '<span class="lcBadge lcBadge--info">נספחים</span>' : ''}
              </div>
            </div>

            <div class="lcPolicyGrid">
              <div><span class="muted small">חברה</span><div class="lcPolicyVal">${escapeHtml(p.company)}</div></div>
              <div><span class="muted small">מוצר</span><div class="lcPolicyVal">${escapeHtml(p.product)}</div></div>
              <div><span class="muted small">מספר פוליסה</span><div class="lcPolicyVal">${escapeHtml(p.policyNumber)}</div></div>
              <div><span class="muted small">פרטים</span><div class="lcPolicyVal">${escapeHtml([amountTxt, bankTxt, annexTxt].filter(Boolean).join(" · ") || "—")}</div></div>
            </div>

            <div class="lcPolicyCard__actions">
              <button class="btn btn--danger btn--sm" type="button" data-polrm="${escapeHtml(p.id)}">הסר</button>
            </div>
          </div>`;
      }).join("");

      host.querySelectorAll('[data-polrm]').forEach(b => on(b, "click", () => this.removePolicy(b.getAttribute("data-polrm"))));
    },

    isStep3Valid(){
      // require at least one policy added
      const arr = Array.isArray(this.state.policies) ? this.state.policies : [];
      return arr.length > 0;
    },

    policiesCompletionPct(){
      return this.isStep3Valid() ? 100 : 0;
    },
renderBMI(){
      const host = this.els.bmiList;
      if(!host) return;
      const persons = this.allPersons();

      if(!persons.length){
        host.innerHTML = '<div class="emptyState" style="padding:18px 12px"><div class="emptyState__title">אין מבוטחים</div></div>';
        return;
      }

      host.innerHTML = persons.map(p => {
        const row = this.state.bmi[p.key] || {};
        const bmi = this.computeBMI(row.h, row.w);
        const bmiTxt = bmi ? bmi.toFixed(1) : "—";
        const lvl = this.bmiLevel(bmi);

        return `
          <div class="lcBmiCard" data-bmicard="${p.key}">
            <div class="lcBmiCard__head">
              <div class="lcBmiCard__title">${escapeHtml(p.label)}</div>
              <div class="lcBmiBadge">
                <span class="lcBmiLight ${lvl.cls}" data-bmilight="${p.key}" aria-hidden="true"></span>
                <span data-bmistatus="${p.key}">${lvl.text}</span>
              </div>
            </div>

            <div class="lcBmiGrid">
              <div class="field">
                <label class="label">גובה (ס״מ) *</label>
                <input class="input" inputmode="decimal" data-bmi="h" data-id="${p.key}" value="${escapeAttr(row.h)}" placeholder="לדוגמה: 175" />
              </div>

              <div class="field">
                <label class="label">משקל (ק״ג) *</label>
                <input class="input" inputmode="decimal" data-bmi="w" data-id="${p.key}" value="${escapeAttr(row.w)}" placeholder="לדוגמה: 78" />
              </div>

              <div class="field">
                <label class="label">BMI</label>
                <input class="input lcBmiAuto" readonly value="${escapeAttr(bmiTxt)}" data-bmiout="${p.key}" />
              </div>

              <div class="field">
                <label class="label">סטטוס</label>
                <input class="input lcBmiAuto" readonly value="${escapeAttr(lvl.text)}" data-bmioutstatus="${p.key}" />
              </div>
            </div>
          </div>
        `;
      }).join("");

      $$('input[data-bmi]', host).forEach(inp => {
        const id = inp.getAttribute("data-id");
        const k = inp.getAttribute("data-bmi"); // h/w
        const handler = () => {
          this.state.bmi[id] = this.state.bmi[id] || {};
          this.state.bmi[id][k] = inp.value;
          this.refreshBMI(id);
          this.updateProgress();
        };
        on(inp, "input", handler);
        on(inp, "change", handler);
      });
    },

    refreshBMI(id){
      const row = this.state.bmi[id] || {};
      const bmi = this.computeBMI(row.h, row.w);
      const bmiTxt = bmi ? bmi.toFixed(1) : "—";
      const lvl = this.bmiLevel(bmi);

      const out = this.els.bmiList?.querySelector?.(`[data-bmiout="${CSS.escape(id)}"]`);
      const outS = this.els.bmiList?.querySelector?.(`[data-bmioutstatus="${CSS.escape(id)}"]`);
      const light = this.els.bmiList?.querySelector?.(`[data-bmilight="${CSS.escape(id)}"]`);
      const stat = this.els.bmiList?.querySelector?.(`[data-bmistatus="${CSS.escape(id)}"]`);

      if(out) out.value = bmiTxt;
      if(outS) outS.value = lvl.text;

      if(light){
        light.classList.remove("is-green","is-amber","is-red");
        if(lvl.cls) light.classList.add(lvl.cls);
      }
      if(stat) stat.textContent = lvl.text;
    },

    updateProgress(){
      this.updateAge();

      const p1 = this.completionPct();
      const p2 = this.bmiCompletionPct();
      const p3 = this.policiesCompletionPct();
      const overall = Math.max(0, Math.min(100, Math.round((p1 + p2 + p3) / 3)));

      if(this.els.progressFill) this.els.progressFill.style.width = overall + "%";
      if(this.els.progressText) this.els.progressText.textContent = overall + "%";

      if(this.els.btnNext){
        if(this.state.step === 1) this.els.btnNext.disabled = !this.isStepValid();
        else if(this.state.step === 2) this.els.btnNext.disabled = !this.isStep2Valid();
        else this.els.btnNext.disabled = !this.isStep3Valid();
      }
    },

    addInsured(type){
      const id = "ins_" + Math.random().toString(16).slice(2, 9);
      this.state.insured.push({ id, type, label: this.insuredLabel(type), data: {} });
      this.renderInsured();
      this.updateProgress();
    },

    removeInsured(id){
      this.state.insured = this.state.insured.filter(x => x.id !== id);
      delete this.state.bmi[id];
      this.renderInsured();
      this.updateProgress();
    },

    mainAddress(){
      return {
        city: safeTrim(this.els.fields.c_city?.value),
        street: safeTrim(this.els.fields.c_street?.value),
        house: safeTrim(this.els.fields.c_house?.value),
        zip: safeTrim(this.els.fields.c_zip?.value)
      };
    },

    renderInsured(){
      const host = this.els.insuredList;
      if(!host) return;

      if(!this.state.insured.length){
        host.innerHTML = `
          <div class="emptyState" style="padding:18px 12px">
            <div class="emptyState__icon">👥</div>
            <div class="emptyState__title">אין מבוטחים נוספים</div>
            <div class="emptyState__text">לחץ על “הוסף מבוטח” כדי להוסיף בן/בת זוג, בגיר או קטין.</div>
          </div>
        `;
        return;
      }

      host.innerHTML = this.state.insured.map(it => {
        const isMinor = it.type === "minor";
        const addr = this.mainAddress();
        const addrLine = [addr.city, addr.street, addr.house].filter(Boolean).join(" ");
        const addrHint = addrLine ? `כתובת משוכפלת: ${escapeHtml(addrLine)}${addr.zip ? " · " + escapeHtml(addr.zip) : ""}` : "כתובת תישאב מהמבוטח הראשי לאחר מילוי";
        const phoneBlock = isMinor ? "" : `
          <div class="field">
            <label class="label">טלפון *</label>
            <input class="input" data-k="phone" data-id="${it.id}" inputmode="tel" placeholder="05x-xxxxxxx" value="${escapeAttr(it.data?.phone)}" />
          </div>
        `;
        const jobBlock = isMinor ? "" : `
          <div class="field">
            <label class="label">עיסוק *</label>
            <input class="input" data-k="job" data-id="${it.id}" value="${escapeAttr(it.data?.job)}" />
          </div>
        `;

        return `
          <div class="lcInsuredCard">
            <div class="lcInsuredCard__head">
              <div class="lcInsuredCard__title">${escapeHtml(it.label)}</div>
              <button class="btn btn--danger lcInsuredCard__remove" type="button" data-remove="${it.id}">הסר</button>
            </div>

            <div class="lcFormGrid lcFormGrid--2">
              <div class="field">
                <label class="label">שם פרטי *</label>
                <input class="input" data-k="firstName" data-id="${it.id}" value="${escapeAttr(it.data?.firstName)}" />
              </div>

              <div class="field">
                <label class="label">שם משפחה *</label>
                <input class="input" data-k="lastName" data-id="${it.id}" value="${escapeAttr(it.data?.lastName)}" />
              </div>

              <div class="field">
                <label class="label">תעודת זהות *</label>
                <input class="input" data-k="id" data-id="${it.id}" inputmode="numeric" placeholder="123456789" value="${escapeAttr(it.data?.id)}" />
              </div>

              <div class="field">
                <label class="label">תאריך לידה מלא *</label>
                <input class="input" data-k="dob" data-id="${it.id}" type="date" value="${escapeAttr(it.data?.dob)}" />
              </div>

              <div class="field">
                <label class="label">מין *</label>
                <select class="input" data-k="gender" data-id="${it.id}">
                  <option value="" ${!it.data?.gender ? "selected":""}>בחר…</option>
                  <option value="זכר" ${it.data?.gender==="זכר"?"selected":""}>זכר</option>
                  <option value="נקבה" ${it.data?.gender==="נקבה"?"selected":""}>נקבה</option>
                </select>
              </div>

              ${phoneBlock}
              ${jobBlock}
            </div>

            <div class="help" style="padding:0 14px 14px">${escapeHtml(addrHint)}${isMinor ? " · (קטין: טלפון/כתובת נלקחים מהמבוטח הראשי)" : ""}</div>
          </div>
        `;
      }).join("");

      $$("[data-remove]", host).forEach(btn => on(btn, "click", () => this.removeInsured(btn.getAttribute("data-remove"))));

      $$("[data-k]", host).forEach(inp => {
        const id = inp.getAttribute("data-id");
        const k = inp.getAttribute("data-k");
        const handler = () => {
          const it = this.state.insured.find(x => x.id === id);
          if(!it) return;
          it.data = it.data || {};
          it.data[k] = inp.value;
          this.updateProgress();
        };
        on(inp, "input", handler);
        on(inp, "change", handler);
      });
    },

    async lookupZip(){
      const city = safeTrim(this.els.fields.c_city?.value);
      const street = safeTrim(this.els.fields.c_street?.value);
      const house = safeTrim(this.els.fields.c_house?.value);

      if(!city || !street || !house){
        alert("כדי למצוא מיקוד יש למלא עיר, רחוב ומספר בית.");
        return;
      }

      const existing = safeTrim(this.els.fields.c_zip?.value);
      if(existing) return;

      alert("כרגע אין שירות מיקוד אוטומטי מובנה בגרסה הזו.\nאפשר להקליד מיקוד ידנית, ובהמשך נחבר שירות רשמי/שרת.");
      this.els.fields.c_zip?.focus?.();
    }
  };

function escapeAttr(v){
    return escapeHtml(safeTrim(v)).replace(/"/g, "&quot;");
  }


  // ---------- Start ----------
  UI.init();
  Auth.init();
  App._bootPromise = App.boot();

})();
