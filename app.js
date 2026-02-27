/* GEMEL INVEST CRM — CLEAN CORE (Sheets + Admin Settings/Users)
   BUILD 20260226-142152
   - Keeps: Login, user pill, Google Sheets connection, Admin: System Settings + Users
   - Removes: Customers / New Customer flow / Policies UI
*/
(() => {
  "use strict";

  const BUILD = "20260227-0245";

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
  const Wizard = {
    els: {},
    state: { insured: [], bmi: null },
    currentStep: 1,
    totalSteps: 2,

    init(){
      this.els.wrap = $("#lcWizard");
      this.els.backdrop = $("#lcWizardBackdrop");
      this.els.btnClose = $("#btnCloseWizard");
      this.els.btnAddInsured = $("#btnAddInsured");
      this.els.btnPrev = $("#btnWizardPrev");
      this.els.btnNext = $("#btnWizardNext");

      this.els.title = $("#lcWizardTitle");
      this.els.sub = $("#lcWizardSub");
      this.els.progressFill = $("#lcProgressFill");
      this.els.progressText = $("#lcProgressText");
      this.els.progressHint = $("#lcProgressHint");
      this.els.footHint = $("#lcWizardFootHint");

      this.els.step1 = $("#lcStep1");
      this.els.step2 = $("#lcStep2");

      const ids = ["c_firstName","c_lastName","c_id","c_dob","c_gender","c_marital","c_phone",
                   "c_city","c_street","c_house","c_apt","c_zip","c_job",
                   "c_height","c_weight","c_bmi"];
      this.els.fields = Object.fromEntries(ids.map(id => [id, $("#"+id)]));

      this.els.age = $("#c_age");
      this.els.insuredList = $("#lcInsuredList");
      this.els.btnZipLookup = $("#btnZipLookup");

      this.els.bmiLamp = $("#c_bmiLamp");
      this.els.bmiLabel = $("#c_bmiLabel");

      

      this.els.insuredBmiWrap = $("#lcInsuredBmiWrap");
      this.els.insuredBmiList = $("#lcInsuredBmiList");
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

      // Step 1 fields -> progress
      ["c_firstName","c_lastName","c_id","c_dob","c_gender","c_marital","c_phone","c_city","c_street","c_house","c_apt","c_zip","c_job"].forEach(id => {
        const el = this.els.fields[id];
        if(!el) return;
        on(el, "input", () => this.updateProgress());
        on(el, "change", () => this.updateProgress());
      });

      on(this.els.btnZipLookup, "click", async () => { await this.lookupZip(); });

      // Step 2 fields -> BMI
      ["c_height","c_weight"].forEach(id => {
        const el = this.els.fields[id];
        if(!el) return;
        on(el, "input", () => { this.updateBMI(); this.updateProgress(); });
        on(el, "change", () => { this.updateBMI(); this.updateProgress(); });
      });

      on(this.els.btnPrev, "click", () => {
        if(this.currentStep > 1) this.goStep(this.currentStep - 1);
      });

      on(this.els.btnNext, "click", () => {
        if(!this.isStepValid()) return;
        if(this.currentStep === 1){
          this.goStep(2);
          return;
        }
        if(this.currentStep === 2){
          alert("שלב 2 הושלם ✅\nהמשך התהליך ייבנה בהמשך.");
        }
      });

      this.reset();
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
      Object.values(this.els.fields || {}).forEach(el => { if(el && !el.hasAttribute("readonly")) el.value = ""; });
      if(this.els.fields.c_bmi) this.els.fields.c_bmi.value = "";
      if(this.els.age) this.els.age.textContent = "—";
      this.state.insured = [];
      this.state.bmi = null;
      this.renderInsured();
            this.renderInsuredBMI();
this.goStep(1, { silent:true });
      this.updateBMI();
      this.updateProgress();
    },

    goStep(n, opts={}){
      const step = Math.max(1, Math.min(this.totalSteps, Number(n || 1)));
      this.currentStep = step;

      if(this.els.step1) this.els.step1.classList.toggle("is-active", step === 1);
      if(this.els.step2) this.els.step2.classList.toggle("is-active", step === 2);

      if(this.els.btnPrev){
        this.els.btnPrev.style.display = (step === 1) ? "none" : "";
      }

      if(this.els.title){
        this.els.title.textContent = "הקמת לקוח חדש · שלב " + step;
      }
      if(this.els.sub){
        this.els.sub.textContent = (step === 1) ? "פרטי לקוח" : "נתוני גוף (BMI)";
      }
      if(this.els.progressHint){
        this.els.progressHint.textContent = (step === 1) ? "השלמת שלב פרטי לקוח" : "השלמת שלב BMI";
      }
      if(this.els.footHint){
        this.els.footHint.textContent = (step === 1)
          ? "כפתור “המשך” יופעל לאחר מילוי כל שדות החובה."
          : "מלא גובה ומשקל. ה‑BMI יחושב אוטומטית ואז אפשר להמשיך.";
      }
      if(this.els.btnNext){
        this.els.btnNext.textContent = (step === 2) ? "סיום שלב" : "המשך";
      }

      if(!opts.silent){
        setTimeout(() => {
          if(step === 1) this.els.fields.c_firstName?.focus?.();
          else this.els.fields.c_height?.focus?.();
        }, 60);
      }
      // render BMI rows for additional insureds (if any)
      if(step === 2) this.renderInsuredBMI();
      if(step === 2){
        // double-render to defeat timing/layout/cache issues
        requestAnimationFrame(() => { try{ this.renderInsuredBMI(); }catch(_e){} });
        setTimeout(() => { try{ this.renderInsuredBMI(); }catch(_e){} }, 60);
      }

      this.updateProgress();
    },

    // ----- Step 2: BMI -----
    _num(v){
      const s = safeTrim(v).replace(",", ".");
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    },

    updateBMI(){
      const h = this._num(this.els.fields.c_height?.value);
      const w = this._num(this.els.fields.c_weight?.value);

      // reset UI
      if(this.els.bmiLamp){
        $$(".lcBmiLamp__dot", this.els.bmiLamp).forEach(d => d.classList.remove("is-on"));
      }
      if(this.els.bmiLabel) this.els.bmiLabel.textContent = "הזן גובה ומשקל";
      if(this.els.fields.c_bmi) this.els.fields.c_bmi.value = "";

      if(!h || !w) { this.state.bmi = null; return; }
      if(h < 80 || h > 250 || w < 20 || w > 400) { this.state.bmi = null; return; }

      const bmi = w / Math.pow(h/100, 2);
      if(!Number.isFinite(bmi)) { this.state.bmi = null; return; }

      const v = Math.round(bmi * 10) / 10;
      this.state.bmi = v;
      if(this.els.fields.c_bmi) this.els.fields.c_bmi.value = String(v);

      let band = "green";
      let label = "תקין";
      if(v < 18.5){ band = "red"; label = "נמוך"; }
      else if(v >= 30){ band = "red"; label = "גבוה"; }
      else if(v >= 25){ band = "yellow"; label = "בינוני"; }

      if(this.els.bmiLamp){
        const dot = $(".lcBmiLamp__dot[data-bmi=\"" + band + "\"]", this.els.bmiLamp);
        if(dot) dot.classList.add("is-on");
      }
      if(this.els.bmiLabel) this.els.bmiLabel.textContent = "רמזור: " + (band === "green" ? "ירוק" : band === "yellow" ? "צהוב" : "אדום") + " · " + label;
    },


    _calcBMI(h, w){
      if(!h || !w) return null;
      if(h < 80 || h > 250 || w < 20 || w > 400) return null;
      const bmi = w / Math.pow(h/100, 2);
      if(!Number.isFinite(bmi)) return null;
      const v = Math.round(bmi * 10) / 10;

      let band = "green";
      let label = "תקין";
      if(v < 18.5){ band = "red"; label = "נמוך"; }
      else if(v >= 30){ band = "red"; label = "גבוה"; }
      else if(v >= 25){ band = "yellow"; label = "בינוני"; }

      return { v, band, label };
    },

    renderInsuredBMI(){
      const wrap = this.els.insuredBmiWrap;
      const list = this.els.insuredBmiList;
      if(!wrap || !list) return;

      const arr = Array.isArray(this.state.insured) ? this.state.insured : [];
      if(!arr.length){
        wrap.style.display = "none";
        list.innerHTML = "";
        return;
      }

      wrap.style.display = "block";
      list.innerHTML = arr.map(it => {
        const id = String(it.id || "");
        const title = safeTrim(it.title) || safeTrim(it.label) || "מבוטח נוסף";
        const bh = safeTrim(it?.bmi?.height);
        const bw = safeTrim(it?.bmi?.weight);

        return `
          <div class="lcInsuredBmiCard" data-bmi-card="1" data-id="${id}">
            <div class="lcInsuredBmiCard__head">
              <div class="lcInsuredBmiCard__title">${escHtml(title)}</div>
            </div>
            <div class="lcInsuredBmiCard__grid">
              <div class="field">
                <label class="label">גובה (ס״מ) *</label>
                <input class="input" data-bmi-k="height" data-id="${id}" inputmode="decimal" autocomplete="off" placeholder="לדוגמה: 175" value="${escAttr(bh)}" />
              </div>
              <div class="field">
                <label class="label">משקל (ק״ג) *</label>
                <input class="input" data-bmi-k="weight" data-id="${id}" inputmode="decimal" autocomplete="off" placeholder="לדוגמה: 78" value="${escAttr(bw)}" />
              </div>
              <div class="field" style="grid-column: 1 / -1;">
                <label class="label">BMI (מחושב אוטומטית)</label>
                <div class="lcBmiRow">
                  <input class="input lcBmiAuto" data-bmi-out="1" data-id="${id}" readonly placeholder="—" />
                  <div class="lcBmiLamp" data-bmi-lamp="1" data-id="${id}" aria-label="רמזור BMI">
                    <span class="lcBmiLamp__dot" data-bmi="green" aria-hidden="true"></span>
                    <span class="lcBmiLamp__dot" data-bmi="yellow" aria-hidden="true"></span>
                    <span class="lcBmiLamp__dot" data-bmi="red" aria-hidden="true"></span>
                  </div>
                  <div class="lcBmiLabel muted small" data-bmi-label="1" data-id="${id}">הזן גובה ומשקל</div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");

      // bind events once per render (simple)
      $$('[data-bmi-k]', list).forEach(inp => {
        const id = inp.getAttribute("data-id");
        const k = inp.getAttribute("data-bmi-k");
        const handler = () => {
          const it = this.state.insured.find(x => String(x.id) === String(id));
          if(!it) return;
          if(!it.bmi) it.bmi = { height:"", weight:"", value:null, band:null };
          it.bmi[k] = inp.value;
          this._updateInsuredBMIUI(id);
          this.updateProgress();
        };
        on(inp, "input", handler);
        on(inp, "change", handler);
      });

      // initial paint
      arr.forEach(it => this._updateInsuredBMIUI(it.id));
    },

    _updateInsuredBMIUI(id){
      const list = this.els.insuredBmiList;
      if(!list) return;
      const card = list.querySelector('.lcInsuredBmiCard[data-id="' + CSS.escape(String(id)) + '"]');
      if(!card) return;

      const it = this.state.insured.find(x => String(x.id) === String(id));
      if(!it) return;
      if(!it.bmi) it.bmi = { height:"", weight:"", value:null, band:null };

      const h = this._num(it.bmi.height);
      const w = this._num(it.bmi.weight);

      // reset ui
      const lamp = card.querySelector('[data-bmi-lamp="1"]');
      if(lamp) lamp.querySelectorAll('.lcBmiLamp__dot').forEach(d => d.classList.remove("is-on"));
      const out = card.querySelector('[data-bmi-out="1"]');
      if(out) out.value = "";
      const lab = card.querySelector('[data-bmi-label="1"]');
      if(lab) lab.textContent = "הזן גובה ומשקל";

      const r = this._calcBMI(h, w);
      if(!r){ it.bmi.value = null; it.bmi.band = null; return; }

      it.bmi.value = r.v;
      it.bmi.band = r.band;

      if(out) out.value = String(r.v);
      if(lamp){
        const dot = lamp.querySelector('.lcBmiLamp__dot[data-bmi="' + r.band + '"]');
        if(dot) dot.classList.add("is-on");
      }
      if(lab) lab.textContent = "רמזור: " + (r.band === "green" ? "ירוק" : r.band === "yellow" ? "צהוב" : "אדום") + " · " + r.label;
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
      if(this.currentStep === 1){
        const missing = this.requiredMain().filter(id => !safeTrim(this.els.fields[id]?.value));
        const idv = safeTrim(this.els.fields.c_id?.value);
        if(idv && !/^\d{5,10}$/.test(idv)) missing.push("c_id");
        const ph = safeTrim(this.els.fields.c_phone?.value);
        if(ph && !/^[0-9+\-\s]{7,15}$/.test(ph)) missing.push("c_phone");
        return missing.length === 0 && this.areInsuredValid();
      }

      // step 2
      const h = this._num(this.els.fields.c_height?.value);
      const w = this._num(this.els.fields.c_weight?.value);
      const mainOk = !!(h && w && this.state.bmi !== null);

      const arr = Array.isArray(this.state.insured) ? this.state.insured : [];
      const insuredOk = arr.every(it => {
        const bh = this._num(it?.bmi?.height);
        const bw = this._num(it?.bmi?.weight);
        const r = this._calcBMI(bh, bw);
        if(!it.bmi) it.bmi = { height:"", weight:"", value:null, band:null };
        it.bmi.value = r ? r.v : null;
        it.bmi.band = r ? r.band : null;
        return !!r;
      });

      return mainOk && insuredOk;
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
      if(this.currentStep === 2){
        const h = safeTrim(this.els.fields.c_height?.value) ? 1 : 0;
        const w = safeTrim(this.els.fields.c_weight?.value) ? 1 : 0;
        const arr = Array.isArray(this.state.insured) ? this.state.insured : [];
        const extraDone = arr.reduce((acc, it) => {
          const ih = safeTrim(it?.bmi?.height) ? 1 : 0;
          const iw = safeTrim(it?.bmi?.weight) ? 1 : 0;
          return acc + ih + iw;
        }, 0);
        const total = 2 + (arr.length * 2);
        const done = h + w + extraDone;
        return Math.round((done/Math.max(1,total)) * 100);
      }

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

    updateProgress(){
      this.updateAge();
      if(this.currentStep === 2) {
        this.updateBMI();
        const arr = Array.isArray(this.state.insured) ? this.state.insured : [];

        // Ensure the additional-insured BMI section is rendered & visible when needed
        try{
          const wrap = this.els.insuredBmiWrap;
          const list = this.els.insuredBmiList;
          if(arr.length && wrap && list){
            const empty = !list.innerHTML || list.querySelectorAll(".lcInsuredBmiCard").length === 0;
            const hidden = (getComputedStyle(wrap).display === "none");
            if(empty || hidden){
              this.renderInsuredBMI();
            }
          }
        }catch(_e){}

        arr.forEach(it => this._updateInsuredBMIUI(it.id));
      }
      const pct = this.completionPct();
      if(this.els.progressFill) this.els.progressFill.style.width = pct + "%";
      if(this.els.progressText) this.els.progressText.textContent = pct + "%";
      if(this.els.btnNext) this.els.btnNext.disabled = !this.isStepValid();
    },

    addInsured(type){
      const id = "ins_" + Math.random().toString(16).slice(2, 9);
      this.state.insured.push({ id, type, label: this.insuredLabel(type), data: {}, bmi: { height:"", weight:"", value:null, band:null } });
      this.renderInsured();
      this.renderInsuredBMI();
      this.updateProgress();
    },

    removeInsured(id){
      this.state.insured = this.state.insured.filter(x => x.id !== id);
      this.renderInsured();
      this.renderInsuredBMI();
      this.updateProgress();
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
                <input class="input" data-k="id" data-id="${it.id}" inputmode="numeric" value="${escapeAttr(it.data?.id)}" />
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
