/* GEMEL INVEST CRM — CLEAN CORE (Sheets + Admin Settings/Users)
   BUILD 20260226-142152
   - Keeps: Login, user pill, Google Sheets connection, Admin: System Settings + Users
   - Removes: Customers / New Customer flow / Policies UI
*/
(() => {
  "use strict";

  const BUILD = "20260227-023000";

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
      this.els.navNewCustomer = $("#navNewCustomer");

      on(this.els.btnLogout, "click", () => Auth.logout());
      if(this.els.navNewCustomer) on(this.els.navNewCustomer, "click", () => Wizard.open());
      
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
  // ---------- New Customer Wizard (NCW) ----------
const Wizard = {
  els: {},
  steps: [
    { id: 1, label: "פרטי לקוח" },
    { id: 2, label: "BMI" },
    { id: 3, label: "פוליסות קיימות" },
    { id: 4, label: "ביטול בחברה נגדית" },
    { id: 5, label: "פוליסות חדשות" },
    { id: 6, label: "פרטי משלם" },
    { id: 7, label: "הצהרת בריאות" }
  ],
  state: {
    open: false,
    step: 1,
    activeInsuredId: null,
    insured: []
  },

  init(){
    this.els.root = $("#ncw");
    this.els.backdrop = $("#ncwBackdrop");
    this.els.btnClose = $("#ncwClose");
    this.els.progress = $("#ncwProgress");
    this.els.tabs = $("#ncwTabs");
    this.els.content = $("#ncwContent");
    this.els.hint = $("#ncwHint");
    this.els.btnPrev = $("#ncwPrev");
    this.els.btnNext = $("#ncwNext");
    this.els.btnAdd = $("#ncwAddInsured");

    this.els.modal = $("#ncwModal");
    this.els.modalBackdrop = $("#ncwModalBackdrop");
    this.els.modalClose = $("#ncwModalClose");

    on(this.els.backdrop, "click", () => this.close());
    on(this.els.btnClose, "click", () => this.close());
    on(this.els.btnPrev, "click", () => this.prev());
    on(this.els.btnNext, "click", () => this.next());
    on(this.els.btnAdd, "click", () => this.openAddModal());
    on(this.els.modalBackdrop, "click", () => this.closeAddModal());
    on(this.els.modalClose, "click", () => this.closeAddModal());

    $$(".ncwPick", this.els.modal).forEach(btn => {
      on(btn, "click", () => {
        const kind = btn.getAttribute("data-kind");
        this.addInsured(kind);
        this.closeAddModal();
      });
    });

    this.ensurePrimary();
    this.render();
  },

  ensurePrimary(){
    if(this.state.insured.length) return;
    const id = "p1";
    this.state.insured.push({
      id,
      kind: "primary",
      label: "מבוטח ראשי",
      data: this.defaultDataFor("primary", null),
      done: {}
    });
    this.state.activeInsuredId = id;
  },

  defaultDataFor(kind, primaryData){
    const base = {
      firstName: "",
      lastName: "",
      idNumber: "",
      birthDate: "",
      age: "",
      gender: "",
      marital: "",
      phone: "",
      email: "",
      city: "",
      street: "",
      house: "",
      zip: "",
      hmo: "",
      shaban: "",
      heightCm: "",
      weightKg: ""
    };

    if(primaryData){
      const inherit = (fields) => fields.forEach(f => base[f] = primaryData[f] || "");
      if(kind === "spouse") inherit(["city","street","house","zip"]);
      if(kind === "adult") inherit(["city","street","house","zip","email"]);
      if(kind === "minor") inherit(["city","street","house","zip","email","phone"]);
    }

    return base;
  },

  open(){
    this.state.open = true;
    this.els.root.classList.add("is-open");
    this.els.root.setAttribute("aria-hidden","false");
    document.body.classList.add("ncwOpen");
    this.render();
  },

  close(){
    this.state.open = false;
    this.els.root.classList.remove("is-open");
    this.els.root.setAttribute("aria-hidden","true");
    document.body.classList.remove("ncwOpen");
  },

  openAddModal(){
    this.els.modal.classList.add("is-open");
    this.els.modal.setAttribute("aria-hidden","false");
  },
  closeAddModal(){
    this.els.modal.classList.remove("is-open");
    this.els.modal.setAttribute("aria-hidden","true");
  },

  addInsured(kind){
    const primary = this.getPrimary();
    const n = this.state.insured.filter(x => x.kind === kind).length + 1;
    const id = `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
    const labelMap = { spouse: "בן/בת זוג", adult: "בגיר", minor: "קטין" };
    this.state.insured.push({
      id,
      kind,
      label: `${labelMap[kind] || "מבוטח"} ${n}`,
      data: this.defaultDataFor(kind, primary ? primary.data : null),
      done: {}
    });
    this.state.activeInsuredId = id;
    this.render();
  },

  getPrimary(){
    return this.state.insured.find(x => x.kind === "primary") || null;
  },

  active(){
    return this.state.insured.find(x => x.id === this.state.activeInsuredId) || this.getPrimary();
  },

  setActive(id){
    this.state.activeInsuredId = id;
    this.render();
  },

  setStep(step){
    this.state.step = Math.max(1, Math.min(7, step));
    this.render();
  },

  prev(){
    if(this.state.step <= 1) return;
    this.setStep(this.state.step - 1);
  },

  next(){
    if(this.state.step >= 7) return;
    const missing = this.findMissingForStep(this.state.step);
    if(missing.length){
      this.els.hint.textContent = `חסר להשלים: ${missing.map(x => x.label).join(", ")}`;
      return;
    }
    this.els.hint.textContent = "";
    this.setStep(this.state.step + 1);
  },

  findMissingForStep(step){
    return this.state.insured.filter(ins => !this.isStepCompleteFor(ins, step));
  },

  isStepCompleteFor(ins, step){
    if(step === 1) return this.validateStep1(ins).ok;
    if(step === 2) return this.validateStep2(ins).ok;
    return false;
  },

  validateStep1(ins){
    const d = ins.data;
    const req = (v) => String(v||"").trim().length>0;
    const errors = [];

    const isMinor = ins.kind === "minor";
    const baseReq = [
      ["firstName","שם פרטי"],
      ["lastName","שם משפחה"],
      ["idNumber","ת\"ז"],
      ["birthDate","תאריך לידה"],
      ["gender","מין"]
    ];

    baseReq.forEach(([k,label]) => { if(!req(d[k])) errors.push(label); });

    if(!isMinor){
      const extra = [
        ["marital","מצב משפחתי"],
        ["phone","טלפון"],
        ["email","מייל"],
        ["city","עיר"],
        ["street","רחוב"],
        ["house","מספר בית"],
        ["zip","מיקוד"],
        ["hmo","קופת חולים"],
        ["shaban","שב\"ן"]
      ];
      extra.forEach(([k,label]) => { if(!req(d[k])) errors.push(label); });
    }

    const age = this.computeAge(d.birthDate);
    if(age !== null) d.age = String(age);

    return { ok: errors.length===0, errors };
  },

  validateStep2(ins){
    const d = ins.data;
    const reqNum = (v) => String(v||"").trim()!=="" && !isNaN(Number(v));
    const errors = [];
    if(!reqNum(d.heightCm)) errors.push("גובה");
    if(!reqNum(d.weightKg)) errors.push("משקל");
    if(errors.length) return { ok:false, errors };

    const h = Number(d.heightCm)/100;
    const w = Number(d.weightKg);
    if(h<=0 || w<=0) return { ok:false, errors:["גובה/משקל לא תקין"] };

    return { ok:true, errors:[] };
  },

  computeAge(iso){
    if(!iso) return null;
    const dt = new Date(iso);
    if(isNaN(dt.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - dt.getFullYear();
    const m = now.getMonth() - dt.getMonth();
    if(m < 0 || (m === 0 && now.getDate() < dt.getDate())) age--;
    if(age < 0 || age > 120) return null;
    return age;
  },

  render(){
    if(!this.els.root) return;

    const stepsHtml = this.steps.map(s => {
      const isActive = s.id === this.state.step;
      const done = this.state.insured.length && this.state.insured.every(ins => this.isStepCompleteFor(ins, s.id));
      return `<div class="ncwStep ${isActive?'is-active':''} ${done?'is-done':''}"><span>${s.id}</span><span>${escapeHtml(s.label)}</span></div>`;
    }).join("");
    this.els.progress.innerHTML = `<div class="ncwSteps">${stepsHtml}</div>`;

    const tabsHtml = this.state.insured.map(ins => {
      const isActive = ins.id === this.state.activeInsuredId;
      let cls = "ncwTab";
      if(isActive) cls += " is-active";
      const v1 = this.validateStep1(ins);
      const v2 = this.validateStep2(ins);
      const v = (this.state.step === 1) ? v1 : (this.state.step === 2 ? v2 : {ok:false, errors:[""]});
      if(v.ok) cls += " is-ok";
      else if(v.errors && v.errors.length<=2) cls += " is-warn";
      else cls += " is-bad";
      return `<button type="button" class="${cls}" data-insured="${escapeHtml(ins.id)}"><span class="ncwTab__dot"></span><span>${escapeHtml(ins.label)}</span></button>`;
    }).join("");
    this.els.tabs.innerHTML = tabsHtml;
    $$(".ncwTab", this.els.tabs).forEach(btn => {
      on(btn, "click", () => this.setActive(btn.getAttribute("data-insured")));
    });

    const ins = this.active();
    if(!ins) return;

    if(this.state.step === 1) this.renderStep1(ins);
    else if(this.state.step === 2) this.renderStep2(ins);
    else this.renderPlaceholder(ins);

    this.els.btnPrev.disabled = this.state.step === 1;
    this.els.btnNext.textContent = (this.state.step === 7) ? "סיום" : "הבא";

    const missing = this.findMissingForStep(this.state.step);
    this.els.hint.textContent = missing.length ? `כדי להמשיך צריך להשלים שלב זה לכל המבוטחים (${missing.length})` : "";
  },

  renderPlaceholder(ins){
    this.els.content.innerHTML = `
      <div class="ncwCard">
        <div class="ncwInline">
          <div class="ncwPill">שלב ${this.state.step}: ${escapeHtml(this.steps[this.state.step-1].label)}</div>
          <div class="ncwPill">מבוטח פעיל: ${escapeHtml(ins.label)}</div>
        </div>
        <div style="margin-top:12px" class="ncwSmall">השלב הזה ייבנה בהמשך (כבר נעול לפי האפיון שסיכמנו).</div>
      </div>
    `;
  },

  renderStep1(ins){
    const d = ins.data;
    const isMinor = ins.kind === "minor";

    const hmoOptions = ["","כללית","מכבי","מאוחדת","לאומית"];
    const shabanMap = {
      "כללית": ["","אין שב״ן","מושלם","זהב","פלטינום"],
      "מכבי": ["","אין שב״ן","כסף","זהב","שלי"],
      "מאוחדת": ["","אין שב״ן","עדיף","שיא"],
      "לאומית": ["","אין שב״ן","כסף","זהב"]
    };

    const genderOptions = ["","זכר","נקבה"];
    const maritalOptions = ["","רווק/ה","נשוי/אה","גרוש/ה","אלמן/ה"];
    const shabanOptions = shabanMap[d.hmo] || ["","אין שב״ן"];

    const agePill = d.age ? `<span class="ncwPill">גיל: <b>${escapeHtml(d.age)}</b></span>` : `<span class="ncwPill">גיל: —</span>`;

    const commonFields = `
      <div class="ncwGrid">
        <div class="ncwField ncwCol6">
          <label>שם פרטי *</label>
          <input data-k="firstName" value="${escapeAttr(d.firstName)}" />
        </div>
        <div class="ncwField ncwCol6">
          <label>שם משפחה *</label>
          <input data-k="lastName" value="${escapeAttr(d.lastName)}" />
        </div>
        <div class="ncwField ncwCol4">
          <label>ת"ז *</label>
          <input data-k="idNumber" inputmode="numeric" value="${escapeAttr(d.idNumber)}" />
        </div>
        <div class="ncwField ncwCol4">
          <label>תאריך לידה *</label>
          <input data-k="birthDate" type="date" value="${escapeAttr(d.birthDate)}" />
        </div>
        <div class="ncwField ncwCol4">
          <label>מין *</label>
          <select data-k="gender">
            ${genderOptions.map(o => `<option value="${escapeAttr(o)}" ${o===d.gender?'selected':''}>${escapeHtml(o||"בחר")}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="ncwInline" style="margin-top:10px">${agePill}</div>
    `;

    const extraFields = isMinor ? "" : `
      <div class="ncwGrid" style="margin-top:12px">
        <div class="ncwField ncwCol4">
          <label>מצב משפחתי *</label>
          <select data-k="marital">
            ${maritalOptions.map(o => `<option value="${escapeAttr(o)}" ${o===d.marital?'selected':''}>${escapeHtml(o||"בחר")}</option>`).join("")}
          </select>
        </div>
        <div class="ncwField ncwCol4">
          <label>טלפון *</label>
          <input data-k="phone" inputmode="tel" value="${escapeAttr(d.phone)}" />
        </div>
        <div class="ncwField ncwCol4">
          <label>מייל *</label>
          <input data-k="email" type="email" value="${escapeAttr(d.email)}" />
        </div>

        <div class="ncwField ncwCol3">
          <label>עיר *</label>
          <input data-k="city" value="${escapeAttr(d.city)}" />
        </div>
        <div class="ncwField ncwCol6">
          <label>רחוב *</label>
          <input data-k="street" value="${escapeAttr(d.street)}" />
        </div>
        <div class="ncwField ncwCol3">
          <label>מספר *</label>
          <input data-k="house" inputmode="numeric" value="${escapeAttr(d.house)}" />
        </div>
        <div class="ncwField ncwCol3">
          <label>מיקוד *</label>
          <input data-k="zip" inputmode="numeric" value="${escapeAttr(d.zip)}" />
        </div>

        <div class="ncwField ncwCol4">
          <label>קופת חולים *</label>
          <select data-k="hmo">
            ${hmoOptions.map(o => `<option value="${escapeAttr(o)}" ${o===d.hmo?'selected':''}>${escapeHtml(o||"בחר")}</option>`).join("")}
          </select>
        </div>
        <div class="ncwField ncwCol4">
          <label>שב״ן *</label>
          <select data-k="shaban">
            ${shabanOptions.map(o => `<option value="${escapeAttr(o)}" ${o===d.shaban?'selected':''}>${escapeHtml(o||"בחר")}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="ncwSmall" style="margin-top:10px">מיקוד אוטומטי לפי עיר/רחוב יתווסף כשנחבר API חיצוני.</div>
    `;

    this.els.content.innerHTML = `
      <div class="ncwCard">
        <div class="ncwInline">
          <div class="ncwPill">מבוטח פעיל: <b>${escapeHtml(ins.label)}</b></div>
          <div class="ncwPill">סוג: <b>${escapeHtml(ins.kind==="minor"?"קטין":(ins.kind==="spouse"?"בן/בת זוג":(ins.kind==="adult"?"בגיר":"ראשי")) )}</b></div>
        </div>
        <div style="margin-top:12px">${commonFields}</div>
        ${extraFields}
      </div>
    `;

    $$("[data-k]", this.els.content).forEach(el => {
      on(el, "input", () => this.onFieldChange(ins, el));
      on(el, "change", () => this.onFieldChange(ins, el));
    });
  },

  onFieldChange(ins, el){
    const k = el.getAttribute("data-k");
    ins.data[k] = el.value;
    if(k === "hmo") ins.data.shaban = "";
    this.render();
  },

  renderStep2(ins){
    const d = ins.data;
    const v = this.validateStep2(ins);
    let bmi = null;
    let lamp = "";
    let status = "—";
    if(v.ok){
      const h = Number(d.heightCm)/100;
      const w = Number(d.weightKg);
      bmi = w / (h*h);
      bmi = Math.round(bmi*10)/10;
      if(bmi >= 30){ lamp="is-red"; status="השמנה"; }
      else if(bmi >= 25){ lamp="is-yellow"; status="עודף משקל"; }
      else if(bmi >= 18.5){ lamp="is-green"; status="תקין"; }
      else { lamp="is-yellow"; status="תת-משקל"; }
    }

    this.els.content.innerHTML = `
      <div class="ncwCard">
        <div class="ncwInline">
          <div class="ncwPill">מבוטח פעיל: <b>${escapeHtml(ins.label)}</b></div>
        </div>

        <div class="ncwGrid" style="margin-top:12px">
          <div class="ncwField ncwCol6">
            <label>גובה (ס"מ) *</label>
            <input data-k="heightCm" inputmode="decimal" value="${escapeAttr(d.heightCm)}" />
          </div>
          <div class="ncwField ncwCol6">
            <label>משקל (ק"ג) *</label>
            <input data-k="weightKg" inputmode="decimal" value="${escapeAttr(d.weightKg)}" />
          </div>
        </div>

        <div class="ncwBMI">
          <div class="ncwInline">
            <span class="ncwLamp ${lamp}"></span>
            <span class="ncwBMILabel">BMI: ${bmi !== null ? `<b>${bmi}</b>` : "—"}</span>
          </div>
          <div class="ncwSmall">סטטוס: <b>${escapeHtml(status)}</b></div>
        </div>

        <div class="ncwSmall" style="margin-top:10px">חישוב מתבצע רק כשגובה ומשקל מלאים.</div>
      </div>
    `;

    $$("[data-k]", this.els.content).forEach(el => {
      on(el, "input", () => this.onFieldChange(ins, el));
      on(el, "change", () => this.onFieldChange(ins, el));
    });
  }
};

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
      const overall = Math.max(0, Math.min(100, Math.round((p1 + p2) / 2)));

      if(this.els.progressFill) this.els.progressFill.style.width = overall + "%";
      if(this.els.progressText) this.els.progressText.textContent = overall + "%";

      if(this.els.btnNext){
        if(this.state.step === 1) this.els.btnNext.disabled = !this.isStepValid();
        else this.els.btnNext.disabled = !this.isStep2Valid();
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
