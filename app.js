/* GEMEL INVEST CRM — CLEAN CORE (Sheets + Admin Settings/Users)
   BUILD 20260226-142152
   - Keeps: Login, user pill, Google Sheets connection, Admin: System Settings + Users
   - Removes: Customers / New Customer flow / Policies UI
*/
(() => {
  "use strict";

    const BUILD = "20260227-105407";

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

      on(this.els.btnLogout, "click", () => Auth.logout());
// nav
      $$(".nav__item").forEach(btn => {
        on(btn, "click", () => {
          const act = btn.getAttribute("data-action");
          if (act === "newCustomer") {
            if (NewCustomerWizard && typeof NewCustomerWizard.open === "function") NewCustomerWizard.open();
            return;
          }
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
txt.textContent = Auth.current.name + (Auth.isAdmin() ? " (מנהל מערכת)" : Auth.isManager() ? " (מנהל)" : "");
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
  // ---------- New Customer Wizard (Step 1–2 ready, framework for 1–7) ----------
  const NewCustomerWizard = (() => {
    const LS_KEY = "GEMEL_NEW_CUSTOMER_DRAFT_V1";

    const STEP = [
      { key:"customer", title:"פרטי לקוח" },
      { key:"bmi", title:"BMI" },
      { key:"existingPolicies", title:"פוליסות קיימות" },
      { key:"cancelOpposing", title:"ביטול בחברה נגדית" },
      { key:"newPolicies", title:"פוליסות חדשות" },
      { key:"payers", title:"פרטי משלם" },
      { key:"healthDecl", title:"הצהרת בריאות" },
    ];

    const KUPA = [
      { id:"clalit", name:"כללית", shaban:["מושלם", "פלטינום", "אין שב״ן"] },
      { id:"maccabi", name:"מכבי", shaban:["זהב", "שלי", "אין שב״ן"] },
      { id:"meuhedet", name:"מאוחדת", shaban:["עדיף", "שיא", "אין שב״ן"] },
      { id:"leumit", name:"לאומית", shaban:["כסף", "זהב", "אין שב״ן"] },
    ];

    const MARITAL = ["רווק/ה","נשוי/אה","גרוש/ה","אלמן/ה","ידוע/ה בציבור"];
    const GENDER = ["זכר","נקבה"];

    // NOTE: Zip lookup – placeholder (we'll connect to external service later)
    function tryAutoZip(city, street){
      const c = safeTrim(city); const s = safeTrim(street);
      if(!c || !s) return "";
      // Minimal deterministic placeholder so field "fills"
      const seed = (c + "|" + s);
      let h = 0;
      for(let i=0;i<seed.length;i++){ h = (h*31 + seed.charCodeAt(i)) >>> 0; }
      const zip = String(10000 + (h % 90000));
      return zip;
    }

    function uid(prefix="i"){ return prefix + "_" + Math.random().toString(36).slice(2,9) + "_" + Date.now().toString(36); }

    function defaultInsured(type="primary"){
      const id = uid("ins");
      const roleLabel = (type==="primary") ? "מבוטח ראשי"
        : (type==="spouse") ? "בן/בת זוג"
        : (type==="adult") ? "בגיר"
        : "קטין";

      const isMinor = type === "minor";
      const inherit = (type !== "primary"); // spouse/adult/minor inherit address/email/phone by default

      return {
        id,
        type,
        roleLabel,
        inheritFromPrimary: inherit,    // for spouse/adult: can be disabled later (UI placeholder)
        fields: {
          firstName:"",
          lastName:"",
          idNumber:"",
          birthDate:"",
          gender:"",
          maritalStatus:"",
          phone: isMinor ? "" : "",
          email: isMinor ? "" : "",
          // address is stored in primary; for others we keep optional overrides for later
          city:"",
          street:"",
          house:"",
          apt:"",
          zip:"",
          kupatHolim:"",
          shaban:"",
        },
        bmi: { heightCm:"", weightKg:"", value:null, color:"", label:"" }
      };
    }

    function defaultDraft(){
      const p = defaultInsured("primary");
      p.fields.maritalStatus = "";
      return {
        meta:{ createdAt: nowISO(), updatedAt: nowISO(), v:1 },
        stepIndex: 0,
        activeInsuredId: p.id,
        insureds: [p],
        existingPolicies: [],
        cancelPlans: [],
        newPolicies: [],
        payers: [],
        health: {}
      };
    }

    const Store = {
      data: defaultDraft(),
      load(){
        try{
          const raw = localStorage.getItem(LS_KEY);
          if(!raw) return;
          const obj = JSON.parse(raw);
          if(!obj || !Array.isArray(obj.insureds) || !obj.insureds.length) return;
          // basic normalize
          this.data = {
            ...defaultDraft(),
            ...obj,
            meta:{ ...(defaultDraft().meta), ...(obj.meta||{}), updatedAt: nowISO() },
            stepIndex: Number.isFinite(obj.stepIndex) ? obj.stepIndex : 0,
            activeInsuredId: safeTrim(obj.activeInsuredId) || obj.insureds[0].id,
            insureds: obj.insureds.map(x => ({ ...defaultInsured(x.type||"adult"), ...x, fields:{...(defaultInsured(x.type||"adult").fields), ...(x.fields||{})}, bmi:{...(defaultInsured(x.type||"adult").bmi), ...(x.bmi||{})} }))
          };
        }catch(_e){}
      },
      save(){
        try{
          this.data.meta.updatedAt = nowISO();
          localStorage.setItem(LS_KEY, JSON.stringify(this.data));
        }catch(_e){}
      },
      reset(){
        this.data = defaultDraft();
        this.save();
      }
    };

    // ---------- Validation ----------
    function isMinor(ins){ return ins.type === "minor"; }

    function validateStepForInsured(stepIndex, ins){
      const f = ins.fields || {};
      const errors = {};

      if(stepIndex === 0){
        const need = (k, msg) => { if(!safeTrim(f[k])) errors[k] = msg; };

        need("firstName","חובה למלא שם פרטי");
        need("lastName","חובה למלא שם משפחה");
        need("idNumber","חובה למלא ת.ז");
        need("birthDate","חובה למלא תאריך לידה");
        need("gender","חובה לבחור מין");

        if(!isMinor(ins)){
          need("phone","חובה למלא טלפון");
          need("email","חובה למלא מייל");
        }

        // address + kupat holim required:
        // Primary must fill full address; others inherit by default (we don't block).
        if(ins.type === "primary"){
          need("city","חובה לבחור עיר");
          need("street","חובה לבחור רחוב");
          need("house","חובה למלא מספר בית");
          need("zip","מיקוד חייב להיות מלא");
          need("kupatHolim","חובה לבחור קופת חולים");
          need("shaban","חובה לבחור שב״ן");
        } else {
          // require kupa/shaban for everyone (as requested stage1 fields)
          need("kupatHolim","חובה לבחור קופת חולים");
          need("shaban","חובה לבחור שב״ן");
        }
      }

      if(stepIndex === 1){
        const h = Number(String(ins.bmi?.heightCm||"").replace(",","."));
        const w = Number(String(ins.bmi?.weightKg||"").replace(",","."));
        if(!h || h <= 0) errors.heightCm = "חובה למלא גובה";
        if(!w || w <= 0) errors.weightKg = "חובה למלא משקל";
      }

      return { ok: Object.keys(errors).length === 0, errors };
    }

    function validateCurrentStepAll(){
      const s = Store.data;
      const stepIndex = s.stepIndex;
      const res = {};
      let allOk = true;
      s.insureds.forEach(ins => {
        const vr = validateStepForInsured(stepIndex, ins);
        res[ins.id] = vr;
        if(!vr.ok) allOk = false;
      });
      return { ok: allOk, byInsured: res };
    }

    // ---------- BMI ----------
    function computeBMI(ins){
      const h = Number(String(ins.bmi?.heightCm||"").replace(",","."));
      const w = Number(String(ins.bmi?.weightKg||"").replace(",","."));
      if(!h || !w || h<=0 || w<=0){
        ins.bmi.value = null;
        ins.bmi.color = "";
        ins.bmi.label = "מלא גובה ומשקל";
        return;
      }
      const m = h / 100;
      const bmi = w / (m*m);
      const v = Math.round(bmi * 10) / 10;
      ins.bmi.value = v;

      if(v < 18.5){ ins.bmi.color="amber"; ins.bmi.label="תת משקל"; }
      else if(v < 25){ ins.bmi.color="green"; ins.bmi.label="תקין"; }
      else if(v < 30){ ins.bmi.color="amber"; ins.bmi.label="עודף משקל"; }
      else { ins.bmi.color="red"; ins.bmi.label="השמנה"; }
    }

    // ---------- DOM / Render ----------
    const Els = {};
    function cacheEls(){
      Els.wrap = $("#ncWizard");
      Els.backdrop = $(".ncWizard__backdrop", Els.wrap);
      Els.panel = $(".ncWizard__panel", Els.wrap);
      Els.btnClose = $("#ncBtnClose");
      Els.subtitle = $("#ncStepSubtitle");
      Els.progressFill = $("#ncProgressFill");
      Els.progressText = $("#ncProgressText");
      Els.tabs = $("#ncInsuredTabs");
      Els.body = $("#ncStepBody");
      Els.btnBack = $("#ncBtnBack");
      Els.btnNext = $("#ncBtnNext");
      Els.footHint = $("#ncFootHint");

      Els.addModal = $("#ncAddInsuredModal");
      Els.addBackdrop = $(".ncModal__backdrop", Els.addModal);
      Els.addClose = $("#ncAddClose");
      Els.pickBtns = $$(".ncPick", Els.addModal);
    }

    function open(){
      cacheEls();
      if(!Els.wrap) return;

      // load draft once per session
      Store.load();

      Els.wrap.classList.add("is-open");
      Els.wrap.setAttribute("aria-hidden","false");
      document.body.style.overflow="hidden";

      bindOnce();
      render();
    }

    function close(){
      if(!Els.wrap) return;
      Els.wrap.classList.remove("is-open");
      Els.wrap.setAttribute("aria-hidden","true");
      document.body.style.overflow="";
      Store.save();
    }

    let _bound = false;
    function bindOnce(){
      if(_bound) return;
      _bound = true;

      on(Els.btnClose, "click", close);
      on(Els.backdrop, "click", (e) => {
        const t = e.target;
        if(t && t.getAttribute && t.getAttribute("data-nc-close") === "1") close();
      });

      on(Els.btnBack, "click", () => {
        const s = Store.data;
        if(s.stepIndex <= 0) return;
        s.stepIndex -= 1;
        Store.save();
        render();
      });

      on(Els.btnNext, "click", () => {
        const s = Store.data;
        const vr = validateCurrentStepAll();
        if(!vr.ok){
          Els.footHint.textContent = "חסרים שדות חובה. בדוק את הסימונים ליד השדות וליד כל מבוטח.";
          render(); // to paint errors
          return;
        }
        Els.footHint.textContent = "";

        if(s.stepIndex < STEP.length - 1){
          // only step 1–2 implemented now
          if(s.stepIndex >= 1){
            s.stepIndex += 1;
            Store.save();
            render();
            return;
          }
          s.stepIndex += 1;
          Store.save();
          render();
        }
      });

      // Add insured modal
      const openAdd = () => {
        Els.addModal.classList.add("is-open");
        Els.addModal.setAttribute("aria-hidden","false");
      };
      const closeAdd = () => {
        Els.addModal.classList.remove("is-open");
        Els.addModal.setAttribute("aria-hidden","true");
      };

      // clicking special chip opens modal
      on(Els.tabs, "click", (e) => {
        const btn = e.target.closest(".ncChip");
        if(!btn) return;

        const act = btn.getAttribute("data-act");
        if(act === "add"){
          openAdd();
          return;
        }
        const id = btn.getAttribute("data-id");
        if(id){
          Store.data.activeInsuredId = id;
          Store.save();
          render();
        }
      });

      on(Els.addBackdrop, "click", (e) => {
        const t = e.target;
        if(t && t.getAttribute && t.getAttribute("data-nc-add-close") === "1") closeAdd();
      });
      on(Els.addClose, "click", closeAdd);

      Els.pickBtns.forEach(b => on(b, "click", () => {
        const t = safeTrim(b.getAttribute("data-add-type"));
        addInsured(t);
        closeAdd();
      }));
    }

    function addInsured(type){
      const s = Store.data;
      const ins = defaultInsured(type);
      // inherit address/phone/email/marital? from primary where relevant
      const primary = s.insureds.find(x => x.type === "primary") || s.insureds[0];

      if(type !== "primary" && primary){
        // inherit address
        ["city","street","house","apt","zip"].forEach(k => ins.fields[k] = safeTrim(primary.fields[k]));
        // inherit contact for spouse/adult/minor by rule (minor doesn't require but keep for reflection)
        ins.fields.phone = safeTrim(primary.fields.phone);
        ins.fields.email = safeTrim(primary.fields.email);
      }

      s.insureds.push(ins);
      s.activeInsuredId = ins.id;
      Store.save();
      render();
    }

    function getActiveInsured(){
      const s = Store.data;
      return s.insureds.find(x => x.id === s.activeInsuredId) || s.insureds[0];
    }

    function setField(insId, key, val){
      const s = Store.data;
      const ins = s.insureds.find(x => x.id === insId);
      if(!ins) return;
      ins.fields[key] = String(val ?? "");
      // auto zip for primary when city/street changed
      if(ins.type === "primary" && (key === "city" || key === "street")){
        const zip = tryAutoZip(ins.fields.city, ins.fields.street);
        ins.fields.zip = zip;
      }
      // shaban options for kupa
      if(key === "kupatHolim"){
        const kupa = KUPA.find(k => k.name === safeTrim(val));
        const shaban = safeTrim(ins.fields.shaban);
        if(!kupa){
          ins.fields.shaban = "";
        } else if(!kupa.shaban.includes(shaban)){
          ins.fields.shaban = "";
        }
      }

      // propagate primary inherited values to others
      if(ins.type === "primary" && ["city","street","house","apt","zip","phone","email"].includes(key)){
        s.insureds.forEach(o => {
          if(o.id === ins.id) return;
          // always inherit for now (Option A for stage1)
          o.fields[key] = String(val ?? "");
        });
      }
      Store.save();
    }

    function setBMI(insId, key, val){
      const s = Store.data;
      const ins = s.insureds.find(x => x.id === insId);
      if(!ins) return;
      ins.bmi[key] = String(val ?? "");
      computeBMI(ins);
      Store.save();
    }

    function render(){
      cacheEls();
      const s = Store.data;
      const step = STEP[s.stepIndex] || STEP[0];

      // subtitle + progress
      if(Els.subtitle) Els.subtitle.textContent = `שלב ${s.stepIndex+1} · ${step.title}`;
      const pct = Math.round(((s.stepIndex) / (STEP.length-1)) * 100);
      if(Els.progressFill) Els.progressFill.style.width = pct + "%";
      if(Els.progressText) Els.progressText.textContent = pct + "%";

      // tabs chips
      const valAll = validateCurrentStepAll();
      if(Els.tabs){
        Els.tabs.innerHTML = s.insureds.map(ins => {
          const vr = valAll.byInsured[ins.id] || { ok:false };
          const dot = vr.ok ? "ok" : "warn";
          const active = (ins.id === s.activeInsuredId) ? " is-active" : "";
          const name = safeTrim(ins.fields.firstName) || ins.roleLabel;
          const meta = safeTrim(ins.fields.idNumber);
          return `
            <button class="ncChip${active}" type="button" data-id="${ins.id}">
              <span class="ncChip__dot ${dot}" aria-hidden="true"></span>
              <span>${escapeHtml(name)}</span>
              <span class="ncChip__meta">${meta ? escapeHtml(meta) : ""}</span>
            </button>
          `;
        }).join("") + `
          <button class="ncChip ncChipAdd" type="button" data-act="add">➕ הוסף מבוטח</button>
        `;
      }

      // step body
      const active = getActiveInsured();
      if(!Els.body || !active) return;

      if(s.stepIndex === 0){
        Els.body.innerHTML = renderStepCustomer(active, valAll.byInsured[active.id]?.errors || {});
        bindStepCustomer(active);
      } else if(s.stepIndex === 1){
        computeBMI(active);
        Els.body.innerHTML = renderStepBMI(active, valAll.byInsured[active.id]?.errors || {});
        bindStepBMI(active);
      } else {
        Els.body.innerHTML = renderStepPlaceholder(step);
      }

      // buttons state
      if(Els.btnBack) Els.btnBack.disabled = (s.stepIndex === 0);
      if(Els.btnNext){
        if(s.stepIndex >= 2){
          Els.btnNext.disabled = true;
          Els.btnNext.textContent = "בקרוב";
        } else {
          Els.btnNext.disabled = false;
          Els.btnNext.textContent = (s.stepIndex === 1) ? "המשך לשלב הבא" : "המשך";
        }
      }

      // footer hint
      if(!Els.footHint.textContent){
        // show quick "what missing"
        const vr = valAll;
        if(!vr.ok){
          const missingCount = Object.values(vr.byInsured).reduce((acc,x)=>acc + (x.ok?0:1),0);
          Els.footHint.textContent = missingCount ? `חסרים פרטים אצל ${missingCount} מבוטחים` : "";
        }
      }
    }

    function renderStepCustomer(ins, errors){
      const isMin = isMinor(ins);
      const s = Store.data;
      const primary = s.insureds.find(x => x.type === "primary") || s.insureds[0];
      const kupa = KUPA.find(k => k.name === safeTrim(ins.fields.kupatHolim));

      const shabanOptions = (kupa ? kupa.shaban : ["אין שב״ן"]).map(x => `<option value="${escapeHtml(x)}"${safeTrim(ins.fields.shaban)===x?' selected':''}>${escapeHtml(x)}</option>`).join("");

      const cityVal = (ins.type==="primary" ? ins.fields.city : primary?.fields?.city || "");
      const streetVal = (ins.type==="primary" ? ins.fields.street : primary?.fields?.street || "");
      const houseVal = (ins.type==="primary" ? ins.fields.house : primary?.fields?.house || "");
      const aptVal = (ins.type==="primary" ? ins.fields.apt : primary?.fields?.apt || "");
      const zipVal = (ins.type==="primary" ? ins.fields.zip : primary?.fields?.zip || "");

      const addrReadonly = (ins.type !== "primary") ? "readonly" : "";

      const maritalBlock = (ins.type === "primary") ? `
        <div class="ncField" data-k="maritalStatus">
          <label class="ncLabel">מצב משפחתי</label>
          <select class="ncSelect" data-field="maritalStatus">
            <option value="">בחר…</option>
            ${MARITAL.map(x => `<option value="${escapeHtml(x)}"${safeTrim(ins.fields.maritalStatus)===x?' selected':''}>${escapeHtml(x)}</option>`).join("")}
          </select>
          <div class="ncErr">${escapeHtml(errors.maritalStatus || "")}</div>
        </div>
      ` : ``;

      return `
        <div class="ncSection">
          <div class="ncSection__head">
            <div class="ncSection__title">שלב 1 · פרטי לקוח</div>
            <div class="ncSection__hint">${escapeHtml(ins.roleLabel)}</div>
          </div>
          <div class="ncSection__body">
            <div class="ncGrid">
              ${fieldText("firstName","שם פרטי",ins.fields.firstName, errors.firstName)}
              ${fieldText("lastName","שם משפחה",ins.fields.lastName, errors.lastName)}
              ${fieldText("idNumber","ת.ז",ins.fields.idNumber, errors.idNumber, 'inputmode="numeric"')}
              ${fieldDate("birthDate","תאריך לידה",ins.fields.birthDate, errors.birthDate)}
              ${fieldSelect("gender","מין",GENDER,ins.fields.gender, errors.gender)}
              ${maritalBlock}
              ${!isMin ? fieldText("phone","טלפון",ins.fields.phone, errors.phone, 'inputmode="tel"') : ""}
              ${!isMin ? fieldText("email","מייל",ins.fields.email, errors.email, 'inputmode="email"') : ""}
              ${fieldText("city","עיר",cityVal, errors.city, addrReadonly)}
              ${fieldText("street","רחוב",streetVal, errors.street, addrReadonly)}
              ${fieldText("house","מספר בית",houseVal, errors.house, addrReadonly + ' inputmode="numeric"')}
              ${fieldText("apt","דירה",aptVal, "", addrReadonly + ' inputmode="numeric"')}
              ${fieldText("zip","מיקוד (ממולא אוטומטית)",zipVal, errors.zip, 'readonly')}
              ${fieldSelect("kupatHolim","קופת חולים",KUPA.map(k=>k.name),ins.fields.kupatHolim, errors.kupatHolim)}
              <div class="ncField ${errors.shaban?'is-error':''}" data-k="shaban">
                <label class="ncLabel">שב״ן</label>
                <select class="ncSelect" data-field="shaban">
                  <option value="">בחר…</option>
                  ${shabanOptions}
                </select>
                <div class="ncErr">${escapeHtml(errors.shaban || "")}</div>
              </div>
            </div>

            <div class="divider"></div>
            <div class="help">
              • כתובת/טלפון/מייל יורשים אוטומטית מהמבוטח הראשי (אופציה A).<br/>
              • המיקוד מחושב אוטומטית לפי עיר + רחוב (בשלב הבא נחבר לשירות חיצוני אמיתי).
            </div>
          </div>
        </div>
      `;
    }

    function renderStepBMI(ins, errors){
      const bmi = ins.bmi?.value;
      const label = safeTrim(ins.bmi?.label) || "";
      const color = safeTrim(ins.bmi?.color) || "";
      const light = color ? `<span class="ncLight ${escapeHtml(color)}" aria-hidden="true"></span>` : `<span class="ncLight" aria-hidden="true"></span>`;
      const show = (bmi === null || bmi === undefined) ? "—" : String(bmi);

      return `
        <div class="ncSection">
          <div class="ncSection__head">
            <div class="ncSection__title">שלב 2 · BMI</div>
            <div class="ncSection__hint">${escapeHtml(ins.roleLabel)}</div>
          </div>
          <div class="ncSection__body">
            <div class="ncGrid">
              ${fieldText("heightCm","גובה (ס״מ)",ins.bmi.heightCm, errors.heightCm, 'inputmode="decimal" data-bmi="heightCm"')}
              ${fieldText("weightKg","משקל (ק״ג)",ins.bmi.weightKg, errors.weightKg, 'inputmode="decimal" data-bmi="weightKg"')}
            </div>

            <div class="divider"></div>

            <div class="ncBmiRow">
              <div class="ncBmiCard">
                <div class="ncBmiK">BMI מחושב</div>
                <div class="ncBmiV">${escapeHtml(show)} ${light}</div>
                <div class="help">${escapeHtml(label)}</div>
              </div>

              <div class="ncBmiCard">
                <div class="ncBmiK">טווחים</div>
                <div class="help" style="margin-top:6px; line-height:1.55">
                  ירוק: 18.5–24.9 (תקין)<br/>
                  צהוב: &lt;18.5 או 25–29.9<br/>
                  אדום: 30+ (השמנה)
                </div>
              </div>
            </div>

            <div class="divider"></div>
            <div class="help">החישוב מתבצע רק אם שני השדות מלאים.</div>
          </div>
        </div>
      `;
    }

    function renderStepPlaceholder(step){
      return `
        <div class="ncSection">
          <div class="ncSection__head">
            <div class="ncSection__title">שלב ${Store.data.stepIndex+1} · ${escapeHtml(step.title)}</div>
            <div class="ncSection__hint">בבנייה</div>
          </div>
          <div class="ncSection__body">
            <div class="emptyState">
              <div class="emptyState__icon">🛠️</div>
              <div class="emptyState__title">השלב הזה בבנייה</div>
              <div class="emptyState__text">השלד וה-Store כבר מוכנים. בספרינט הבא נבנה את המסכים, הלוגיקה והחישובים (כפי שסיכמנו).</div>
            </div>
          </div>
        </div>
      `;
    }

    function fieldText(k,label,val,err,extra=""){
      const isErr = err ? "is-error" : "";
      return `
        <div class="ncField ${isErr}" data-k="${escapeHtml(k)}">
          <label class="ncLabel">${escapeHtml(label)}</label>
          <input class="ncInput" data-field="${escapeHtml(k)}" value="${escapeHtml(val||"")}" ${extra}/>
          <div class="ncErr">${escapeHtml(err||"")}</div>
        </div>
      `;
    }
    function fieldDate(k,label,val,err){
      const isErr = err ? "is-error" : "";
      return `
        <div class="ncField ${isErr}" data-k="${escapeHtml(k)}">
          <label class="ncLabel">${escapeHtml(label)}</label>
          <input class="ncInput" type="date" data-field="${escapeHtml(k)}" value="${escapeHtml(val||"")}"/>
          <div class="ncErr">${escapeHtml(err||"")}</div>
        </div>
      `;
    }
    function fieldSelect(k,label,options,val,err){
      const isErr = err ? "is-error" : "";
      return `
        <div class="ncField ${isErr}" data-k="${escapeHtml(k)}">
          <label class="ncLabel">${escapeHtml(label)}</label>
          <select class="ncSelect" data-field="${escapeHtml(k)}">
            <option value="">בחר…</option>
            ${options.map(x => `<option value="${escapeHtml(x)}"${safeTrim(val)===x?' selected':''}>${escapeHtml(x)}</option>`).join("")}
          </select>
          <div class="ncErr">${escapeHtml(err||"")}</div>
        </div>
      `;
    }

    function bindStepCustomer(ins){
      // inputs
      $$(".ncInput[data-field], .ncSelect[data-field]", Els.body).forEach(el => {
        on(el, "input", () => {
          const k = el.getAttribute("data-field");
          if(!k) return;
          setField(ins.id, k, el.value);
          render();
        });
        on(el, "change", () => {
          const k = el.getAttribute("data-field");
          if(!k) return;
          setField(ins.id, k, el.value);
          render();
        });
      });
    }

    function bindStepBMI(ins){
      $$(".ncInput[data-bmi]", Els.body).forEach(el => {
        on(el, "input", () => {
          const k = el.getAttribute("data-bmi");
          setBMI(ins.id, k, el.value);
          render();
        });
      });
    }

    return { open, close, Store };
  })();


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
