/* GEMEL INVEST CRM — CLEAN CORE (Sheets + Admin Settings/Users)
   BUILD 20260226-140500
   - Keeps: Login, user pill, Google Sheets connection, Admin: System Settings + Users
   - Removes: Customers / New Customer flow / Policies UI
*/
(() => {
  "use strict";

  const BUILD = "20260227-1415";

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

      this.applyRoleUI();
      this.renderAuthPill();
      Wizard.init();
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

  
  // ---------- New Customer Wizard (Steps 1-2) ----------
  const Wizard = (() => {
    let isOpen = false;
    let step = 1;

    const els = {};

    // data model
    const model = {
      main: { type:"main", label:"מבוטח ראשי", firstName:"", lastName:"", idnum:"", dob:"", gender:"", marital:"", phone:"", job:"",
              city:"", street:"", house:"", apt:"", zip:"", heightCm:"", weightKg:"" },
      insured: [] // {id,type,label,firstName,lastName,idnum,dob,gender,marital,phone,job,city,street,house,apt,zip,heightCm,weightKg}
    };

    const insuredLabels = {
      spouse: "בן/בת זוג",
      adult: "בגיר",
      minor: "קטין"
    };

    const requiredMainStep1 = () => ["firstName","lastName","idnum","dob","gender","marital","phone","job","city","street","house"];
    const requiredStep1 = (who) => {
      const base = ["firstName","lastName","idnum","dob","gender"];
      return (who.type === "minor") ? base : base.concat(["marital","job"]);
    };
    const requiredStep2 = () => ["heightCm","weightKg"];

    const uid = (prefix="i") => prefix + "_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);

    function open(){
      if(!Auth.current) return;
      isOpen = true;
      step = 1;
      gotoStep(1);
      renderInsuredList();
      renderMedicalList();
      updateProgress();
      els.wrap?.classList.add("is-open");
      els.wrap?.setAttribute?.("aria-hidden","false");
      document.body.style.overflow = "hidden";
      setTimeout(() => els.firstName?.focus?.(), 60);
    }

    function close(){
      isOpen = false;
      els.wrap?.classList.remove("is-open");
      els.wrap?.setAttribute?.("aria-hidden","true");
      document.body.style.overflow = "";
      gotoStep(1);
    }

    function gotoStep(n){
      step = (n === 2 ? 2 : 1);
      $$(".lcWizardStep", els.wrap).forEach(s => s.classList.remove("is-active"));
      const active = $("#lcStep" + step, els.wrap);
      if(active) active.classList.add("is-active");
      syncTitle();
      updateProgress();
      if(step === 2) renderMedicalList();
    }

    function syncTitle(){
      if(!els.title || !els.sub) return;
      if(step === 1){
        els.title.textContent = "הקמת לקוח חדש · שלב 1";
        els.sub.textContent = "פרטי לקוח";
      } else {
        els.title.textContent = "הקמת לקוח חדש · שלב 2";
        els.sub.textContent = "נתונים רפואיים";
      }
    }

    function calcAge(dobStr){
      try{
        if(!dobStr) return null;
        const d = new Date(dobStr);
        if(Number.isNaN(d.getTime())) return null;
        const now = new Date();
        let age = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
        if(age < 0) age = 0;
        return age;
      } catch(_e){ return null; }
    }

    function updateAgeUI(){
      const age = calcAge(els.dob?.value);
      const v = $("#c_age");
      if(v) v.textContent = (age === null ? "—" : String(age));
    }

    function openPicker(){
      els.picker?.classList.add("is-open");
      els.picker?.setAttribute?.("aria-hidden","false");
    }
    function closePicker(){
      els.picker?.classList.remove("is-open");
      els.picker?.setAttribute?.("aria-hidden","true");
    }

    function copyAddressTo(item){
      item.city = safeTrim(els.city?.value);
      item.street = safeTrim(els.street?.value);
      item.house = safeTrim(els.house?.value);
      item.apt = safeTrim(els.apt?.value);
      item.zip = safeTrim(els.zip?.value);
    }

    function addInsured(type){
      const id = uid("ins");
      const label = insuredLabels[type] || "מבוטח";
      const item = {
        id, type, label,
        firstName:"", lastName:"", idnum:"", dob:"", gender:"", marital:"", phone:"",
        job:"",
        city:"", street:"", house:"", apt:"", zip:"",
        heightCm:"", weightKg:""
      };
      copyAddressTo(item);
      model.insured.push(item);
      renderInsuredList();
      renderMedicalList();
      updateProgress();
    }

    function removeInsured(id){
      model.insured = model.insured.filter(x => x.id !== id);
      renderInsuredList();
      renderMedicalList();
      updateProgress();
    }

    function renderInsuredList(){
      if(!els.insuredList) return;
      if(!model.insured.length){
        els.insuredList.innerHTML = '<div class="muted small">לא נוספו מבוטחים נוספים עדיין.</div>';
        return;
      }
      els.insuredList.innerHTML = model.insured.map(item => {
        const isMinor = item.type === "minor";
        const tag = '<span class="lcInsuredTag">' + escapeHtml(item.label) + '</span>';
        return `
          <div class="lcInsuredCard" data-insured="${escapeHtml(item.id)}">
            <div class="lcInsuredCard__head">
              <div class="lcInsuredCard__title">מבוטח נוסף ${tag}</div>
              <button class="btn btn--danger" data-act="removeInsured" data-id="${escapeHtml(item.id)}" type="button">הסר</button>
            </div>

            <div class="lcFormGrid lcFormGrid--2">
              <div class="field">
                <label class="label">שם פרטי *</label>
                <input class="input" data-f="firstName" autocomplete="off" />
              </div>

              <div class="field">
                <label class="label">שם משפחה *</label>
                <input class="input" data-f="lastName" autocomplete="off" />
              </div>

              <div class="field">
                <label class="label">תעודת זהות *</label>
                <input class="input" data-f="idnum" inputmode="numeric" autocomplete="off" />
              </div>

              <div class="field">
                <label class="label">תאריך לידה *</label>
                <input class="input" data-f="dob" type="date" />
              </div>

              <div class="field">
                <label class="label">מין *</label>
                <select class="input" data-f="gender">
                  <option value="">בחר…</option>
                  <option value="זכר">זכר</option>
                  <option value="נקבה">נקבה</option>
                </select>
              </div>

              ${isMinor ? "" : `
              <div class="field">
                <label class="label">מצב משפחתי *</label>
                <select class="input" data-f="marital">
                  <option value="">בחר…</option>
                  <option value="רווק/ה">רווק/ה</option>
                  <option value="נשוי/ה">נשוי/ה</option>
                  <option value="גרוש/ה">גרוש/ה</option>
                  <option value="ידוע/ה בציבור">ידוע/ה בציבור</option>
                </select>
              </div>
              `}

              ${isMinor ? "" : `
              <div class="field">
                <label class="label">עיסוק *</label>
                <input class="input" data-f="job" autocomplete="off" />
              </div>
              `}

              ${isMinor ? "" : `
              <div class="field">
                <label class="label">טלפון</label>
                <input class="input" data-f="phone" inputmode="tel" autocomplete="off" placeholder="05x-xxxxxxx" />
              </div>
              `}

              <div class="field" style="${isMinor ? "grid-column:1 / -1;" : ""}">
                <label class="label">כתובת</label>
                <div class="help">נלקח אוטומטית מהמבוטח הראשי${isMinor ? "" : " (ניתן לערוך למבוגר)"}.</div>
              </div>

              ${isMinor ? "" : `
              <div class="field">
                <label class="label">עיר</label>
                <input class="input" data-f="city" autocomplete="off" />
              </div>

              <div class="field">
                <label class="label">רחוב</label>
                <input class="input" data-f="street" autocomplete="off" />
              </div>

              <div class="field">
                <label class="label">מס׳ בית</label>
                <input class="input" data-f="house" inputmode="numeric" autocomplete="off" />
              </div>

              <div class="field">
                <label class="label">מס׳ דירה</label>
                <input class="input" data-f="apt" inputmode="numeric" autocomplete="off" />
              </div>

              <div class="field">
                <label class="label">מיקוד</label>
                <input class="input" data-f="zip" inputmode="numeric" autocomplete="off" />
              </div>
              `}
            </div>
          </div>
        `;
      }).join("");

      els.insuredList.querySelectorAll('button[data-act="removeInsured"]').forEach(b => {
        on(b, "click", () => removeInsured(b.getAttribute("data-id")));
      });

      els.insuredList.querySelectorAll(".lcInsuredCard").forEach(card => {
        const id = card.getAttribute("data-insured");
        const item = model.insured.find(x => x.id === id);
        if(!item) return;

        card.querySelectorAll("[data-f]").forEach(inp => {
          const f = inp.getAttribute("data-f");
          if(!f) return;
          const val = item[f] ?? "";
          if(inp.tagName === "SELECT") inp.value = val;
          else inp.value = val;

          on(inp, "input", () => {
            item[f] = safeTrim(inp.value);
            updateProgress();
            if(step === 2) renderMedicalList();
          });
          on(inp, "change", () => {
            item[f] = safeTrim(inp.value);
            updateProgress();
            if(step === 2) renderMedicalList();
          });
        });
      });
    }

    function bmiFrom(heightCm, weightKg){
      const h = Number(heightCm) / 100;
      const w = Number(weightKg);
      if(!h || !w) return null;
      const bmi = w / (h*h);
      if(!Number.isFinite(bmi)) return null;
      return Math.round(bmi * 10) / 10;
    }

    function riskFromBmi(bmi, isMinor){
      if(bmi === null) return { level:"", label:"—", dot:"" };
      let level = "low";
      let label = "נמוך";
      if (bmi >= 30){ level="high"; label="גבוה"; }
      else if (bmi >= 25){ level="med"; label="בינוני"; }
      else { level="low"; label="נמוך"; }
      if(isMinor) label = label + " (קטין)";
      return { level, label, dot: level };
    }

    function renderMedicalList(){
      if(!els.medicalList) return;
      const list = [{ id:"main", type:"main", label:"מבוטח ראשי", ref:model.main }].concat(
        model.insured.map(x => ({ id:x.id, type:x.type, label:x.label, ref:x }))
      );

      els.medicalList.innerHTML = list.map(entry => {
        const dob = (entry.id === "main") ? safeTrim(els.dob?.value) : safeTrim(entry.ref?.dob);
        const age = calcAge(dob);
        const isMinor = (entry.type === "minor") || (age !== null && age < 18);

        const bmi = bmiFrom(entry.ref?.heightCm, entry.ref?.weightKg);
        const risk = riskFromBmi(bmi, isMinor);

        return `
          <div class="lcMedicalCard" data-med="${escapeHtml(entry.id)}">
            <div class="lcInsuredCard__head">
              <div class="lcInsuredCard__title">${escapeHtml(entry.id==="main" ? "מבוטח ראשי" : "מבוטח נוסף")}
                <span class="lcInsuredTag">${escapeHtml(entry.label)}</span>
              </div>
              <div class="lcBmiBadge" title="BMI + דירוג סיכון">
                <span class="lcBmiDot ${risk.dot}"></span>
                <span>BMI: <span>${bmi === null ? "—" : bmi}</span></span>
                <span class="muted" style="font-weight:900;">·</span>
                <span>${risk.label}</span>
              </div>
            </div>

            <div class="lcMedicalRow">
              <div class="field">
                <label class="label">גובה (ס״מ) *</label>
                <input class="input" data-f="heightCm" inputmode="numeric" placeholder="לדוגמה: 175" />
              </div>
              <div class="field">
                <label class="label">משקל (ק״ג) *</label>
                <input class="input" data-f="weightKg" inputmode="numeric" placeholder="לדוגמה: 78" />
              </div>
              <div class="field">
                <label class="label">הערה</label>
                <div class="help">${isMinor ? "בקטינים פרשנות BMI מלאה נעשית באחוזונים. כרגע מוצג דירוג בסיסי." : "דירוג לפי BMI (נמוך/בינוני/גבוה)."}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");

      els.medicalList.querySelectorAll(".lcMedicalCard").forEach(card => {
        const id = card.getAttribute("data-med");
        const ref = (id === "main") ? model.main : model.insured.find(x => x.id === id);
        if(!ref) return;

        card.querySelectorAll("[data-f]").forEach(inp => {
          const f = inp.getAttribute("data-f");
          inp.value = ref[f] ?? "";
          on(inp, "input", () => {
            ref[f] = safeTrim(inp.value);
            updateProgress();
            renderMedicalList();
          });
        });
      });
    }

    function zipDemo(){
      const city = safeTrim(els.city?.value);
      const street = safeTrim(els.street?.value);
      const house = safeTrim(els.house?.value);
      if(city && street && house && !safeTrim(els.zip?.value)){
        els.zip.value = "00000";
      }
      model.main.zip = safeTrim(els.zip?.value);
      model.insured.forEach(it => { it.zip = model.main.zip; });
      renderInsuredList();
      updateProgress();
    }

    function isStep1Complete(){
      const mainReq = requiredMainStep1();
      for (const f of mainReq){
        if(!safeTrim(model.main[f])) return false;
      }
      for (const it of model.insured){
        const req = requiredStep1(it);
        for (const f of req){
          if(!safeTrim(it[f])) return false;
        }
      }
      return true;
    }

    function isStep2Complete(){
      const all = [model.main].concat(model.insured);
      for (const who of all){
        for (const f of requiredStep2()){
          if(!safeTrim(who[f])) return false;
        }
      }
      return true;
    }

    function updateProgress(){
      let total = 0;
      let done = 0;

      // step1 main
      for (const f of requiredMainStep1()){
        total++;
        if(safeTrim(model.main[f])) done++;
      }
      // step1 extras
      for (const it of model.insured){
        const req = requiredStep1(it);
        for (const f of req){
          total++;
          if(safeTrim(it[f])) done++;
        }
      }
      // step2 all
      const all = [model.main].concat(model.insured);
      for (const who of all){
        for (const f of requiredStep2()){
          total++;
          if(safeTrim(who[f])) done++;
        }
      }

      const pct = total ? Math.round((done/total)*100) : 0;
      if(els.progressFill) els.progressFill.style.width = pct + "%";
      if(els.progressText) els.progressText.textContent = pct + "%";

      if(els.btnNext) els.btnNext.disabled = !isStep1Complete();
      if(els.btnFinish) els.btnFinish.disabled = !isStep2Complete();
    }

    function bindMainInputs(){
      const map = [
        ["firstName", els.firstName],
        ["lastName", els.lastName],
        ["idnum", els.idnum],
        ["dob", els.dob],
        ["gender", els.gender],
        ["marital", els.marital],
        ["phone", els.phone],
        ["job", els.job],
        ["city", els.city],
        ["street", els.street],
        ["house", els.house],
        ["apt", els.apt],
        ["zip", els.zip],
      ];

      map.forEach(([k, el]) => {
        on(el, "input", () => {
          model.main[k] = safeTrim(el.value);
          if(k === "dob") updateAgeUI();

          // mirror address to all extras
          if(["city","street","house","apt","zip"].includes(k)){
            model.insured.forEach(it => { it[k] = model.main[k] || ""; });
            renderInsuredList();
          }
          updateProgress();
        });
        on(el, "change", () => {
          model.main[k] = safeTrim(el.value);
          if(k === "dob") updateAgeUI();
          updateProgress();
        });
      });
    }

    function init(){
      els.wrap = $("#lcWizard");
      if(!els.wrap) return;

      els.backdrop = $("#lcWizardBackdrop");
      els.title = $("#lcWizardTitle");
      els.sub = $("#lcWizardSub");
      els.progressFill = $("#lcProgressFill");
      els.progressText = $("#lcProgressText");

      // main inputs
      els.firstName = $("#c_firstName");
      els.lastName  = $("#c_lastName");
      els.idnum     = $("#c_id");
      els.dob       = $("#c_dob");
      els.gender    = $("#c_gender");
      els.marital   = $("#c_marital");
      els.phone     = $("#c_phone");
      els.job       = $("#c_job");
      els.city      = $("#c_city");
      els.street    = $("#c_street");
      els.house     = $("#c_house");
      els.apt       = $("#c_apt");
      els.zip       = $("#c_zip");
      els.btnZipLookup = $("#btnZipLookup");

      els.insuredList = $("#lcInsuredList");
      els.medicalList = $("#lcMedicalList");

      els.btnClose = $("#btnCloseWizard");
      els.btnAddInsured = $("#btnAddInsured");
      els.btnNext = $("#btnStepNext");
      els.btnBack = $("#btnStepBack");
      els.btnFinish = $("#btnStepFinish");

      // picker
      els.picker = $("#lcInsuredPicker");
      els.pickerBackdrop = $("#lcInsuredPickerBackdrop");
      els.btnClosePicker = $("#btnCloseInsuredPicker");

      on(els.btnClose, "click", close);
      on(els.backdrop, "click", close);

      on(els.btnAddInsured, "click", () => { if(isOpen) openPicker(); });
      on(els.pickerBackdrop, "click", closePicker);
      on(els.btnClosePicker, "click", closePicker);
      $$(".lcPickBtn", els.picker).forEach(b => {
        on(b, "click", () => {
          const t = b.getAttribute("data-pick");
          closePicker();
          addInsured(t);
        });
      });

      on(els.btnNext, "click", () => { if(isStep1Complete()) gotoStep(2); });
      on(els.btnBack, "click", () => gotoStep(1));
      on(els.btnFinish, "click", () => {
        if(!isStep2Complete()) return;
        alert("השלמת הקמה (שלבים 1-2). השמירה לשרת תתווסף בהמשך.");
        close();
      });

      on(els.dob, "change", updateAgeUI);
      on(els.btnZipLookup, "click", zipDemo);

      bindMainInputs();
      updateAgeUI();
      updateProgress();
      renderInsuredList();
      renderMedicalList();
    }

    return { init, open, close, gotoStep };
  })();

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

  // ---------- Start ----------
  UI.init();
  Auth.init();
  App._bootPromise = App.boot();

})();
