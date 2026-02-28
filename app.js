/* GEMEL INVEST CRM — CLEAN CORE (Sheets + Admin Settings/Users)
   P260228-0800
   - Keeps: Login, user pill, Google Sheets connection, Admin: System Settings + Users
   - Removes: Customers / New Customer flow / Policies UI
*/
(() => {
  "use strict";

  const BUILD = "20260228-0930";

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
      { id:7, title:"סיכום" }
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
    companies: ["הפניקס","הראל","כלל","מגדל","מנורה","איילון","AIG","הכשרה","ביטוח ישיר","אחר"],
    insTypes: ["בריאות","מחלות קשות","סרטן","תאונות אישיות","ריסק","ריסק משכנתא"],
    bankNames: ["בנק הפועלים","בנק לאומי","בנק דיסקונט","בנק מזרחי-טפחות","הבנק הבינלאומי","בנק מרכנתיל","בנק ירושלים","בנק יהב","בנק מסד","פאג\"י","דואר ישראל","אחר"],

    
    bankAgencies: ["סוכנות מעלות - בנק לאומי","סוכנות פועלים - בנק הפועלים","סוכנות מזרחי טפחות - בנק מזרחי-טפחות","סוכנות עיר שלם - בנק ירושלים","סוכנות דיסקונט - בנק דיסקונט"],
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

      // picker
      this.els.picker = $("#lcInsPicker");
      this.els.pickerClose = $("#lcInsPickerClose");

      // discount modal (Step 5)
      this.els.discountModal = $("#lcDiscountModal");
      this.els.discountClose = $("#lcDiscountClose");
      this.els.discountPct = $("#lcDiscountPct");
      this.els.discountSave = $("#lcDiscountSave");
      this.discountPolicyId = null;



      // pledge modal (Step 5) - bank collateral
      this.els.pledgeModal = $("#lcPledgeModal");
      this.els.pledgeClose = $("#lcPledgeClose");
      this.els.pledgeSave = $("#lcPledgeSave");
      this.els.pledgeErr = $("#lcPledgeErr");
      this.els.pledgeBankName = $("#lcPledgeBankName");
      this.els.pledgeBankNo = $("#lcPledgeBankNo");
      this.els.pledgeBranch = $("#lcPledgeBranch");
      this.els.pledgeAmount = $("#lcPledgeAmount");
      this.els.pledgeYears = $("#lcPledgeYears");
      this.els.pledgeAddress = $("#lcPledgeAddress");
      this.pledgePolicyId = null;
      on(this.els.btnOpen, "click", () => {
        if(!Auth.current) return;
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


      // discount modal handlers
      on(this.els.discountClose, "click", () => this.closeDiscount());
      on(this.els.discountModal, "click", (e) => {
        const t = e.target;
        if(t && t.getAttribute && t.getAttribute("data-close") === "1") this.closeDiscount();
      });
      on(this.els.discountSave, "click", () => this.saveDiscount());

      // pledge modal events
      on(this.els.pledgeClose, "click", () => this.closePledge());
      on(this.els.pledgeModal, "click", (e) => {
        const t = e.target;
        if(t && t.getAttribute && t.getAttribute("data-close") === "1") this.closePledge();
      });
      on(this.els.pledgeSave, "click", () => this.savePledge());

      on(document, "keydown", (e) => {
        if(e && e.key === "Escape"){
          if(this.els.discountModal && this.els.discountModal.classList.contains("is-open")) return this.closeDiscount();
          if(this.els.pledgeModal && this.els.pledgeModal.classList.contains("is-open")) return this.closePledge();
          if(this.isOpen) return this.close();
        }
      });

      on(this.els.btnPrev, "click", () => this.prevStep());
      on(this.els.btnNext, "click", () => this.nextStep());

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
          clinic:"", shaban:"",
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
          ho: { account:"", branch:"", bankName:"", bankNo:"" }
        }
      });

      this.insureds = [ make("primary","מבוטח ראשי") ];
      this.activeInsId = this.insureds[0].id;
      this.step = 1;
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


    // ---------- Discount modal (Step 5) ----------
    openDiscount(ins, policyId){
      if(!this.els.discountModal) return;
      this.discountPolicyId = policyId || null;
      // prefill from data (not applied to premium yet)
      const p = (ins?.data?.newPolicies || []).find(x => String(x.id) === String(policyId));
      if(this.els.discountPct) this.els.discountPct.value = p && p.discountPct != null ? String(p.discountPct) : "";
      this.els.discountModal.classList.add("is-open");
      this.els.discountModal.setAttribute("aria-hidden","false");
      // focus input
      setTimeout(() => { try{ this.els.discountPct?.focus(); }catch(e){} }, 0);
    },
    closeDiscount(){
      if(!this.els.discountModal) return;
      this.discountPolicyId = null;
      this.els.discountModal.classList.remove("is-open");
      this.els.discountModal.setAttribute("aria-hidden","true");
    },
    saveDiscount(){
      const ins = this.getActive();
      if(!ins) return this.closeDiscount();
      const pid = this.discountPolicyId;
      if(!pid) return this.closeDiscount();
      const p = (ins.data.newPolicies || []).find(x => String(x.id) === String(pid));
      if(p){
        const v = safeTrim(this.els.discountPct?.value || "");
        // store for later use (currently not applied to pricing as requested)
        p.discountPct = v;
      }
      this.closeDiscount();
    },
,
    // ---------- Pledge/Collateral modal (Step 5) ----------
    openPledge(ins, policyId){
      if(!this.els.pledgeModal) return;
      this.pledgePolicyId = policyId || null;

      const p = (ins?.data?.newPolicies || []).find(x => String(x.id) === String(policyId));
      const pb = p?.pledgeBank || {};

      if(this.els.pledgeErr) this.els.pledgeErr.textContent = "";
      const set = (el, val) => { if(el) el.value = (val == null ? "" : String(val)); };

      set(this.els.pledgeBankName, pb.bankName);
      set(this.els.pledgeBankNo, pb.bankNo);
      set(this.els.pledgeBranch, pb.branch);
      set(this.els.pledgeAmount, pb.amount);
      set(this.els.pledgeYears, pb.years);
      set(this.els.pledgeAddress, pb.address);

      // clear any previous inline error styling
      [this.els.pledgeBankName,this.els.pledgeBankNo,this.els.pledgeBranch,this.els.pledgeAmount,this.els.pledgeYears,this.els.pledgeAddress].forEach(x=>{
        try{ x && (x.style.borderColor = ""); }catch(e){}
      });

      this.els.pledgeModal.classList.add("is-open");
      this.els.pledgeModal.setAttribute("aria-hidden","false");
      setTimeout(() => { try{ this.els.pledgeBankName?.focus(); }catch(e){} }, 0);
    },

    closePledge(){
      if(!this.els.pledgeModal) return;
      this.pledgePolicyId = null;
      this.els.pledgeModal.classList.remove("is-open");
      this.els.pledgeModal.setAttribute("aria-hidden","true");
    },

    savePledge(){
      const ins = this.getActive();
      if(!ins) return this.closePledge();
      const pid = this.pledgePolicyId;
      if(!pid) return this.closePledge();

      const p = (ins.data.newPolicies || []).find(x => String(x.id) === String(pid));
      if(!p) return this.closePledge();

      const val = (el) => safeTrim(el?.value || "");
      const bankName = val(this.els.pledgeBankName);
      const bankNo = val(this.els.pledgeBankNo);
      const branch = val(this.els.pledgeBranch);
      const amount = val(this.els.pledgeAmount);
      const years = val(this.els.pledgeYears);
      const address = val(this.els.pledgeAddress);

      // required validation
      const req = [
        [this.els.pledgeBankName, bankName, "שם בנק"],
        [this.els.pledgeBankNo, bankNo, "מספר בנק"],
        [this.els.pledgeBranch, branch, "מספר סניף"],
        [this.els.pledgeAmount, amount, "סכום לשיעבוד"],
        [this.els.pledgeYears, years, "לכמה שנים"],
        [this.els.pledgeAddress, address, "כתובת הבנק"],
      ];
      let missing = [];
      req.forEach(([el, v, name])=>{
        try{ if(el) el.style.borderColor = ""; }catch(e){}
        if(!v){
          missing.push(name);
          try{ if(el) el.style.borderColor = "rgba(239,68,68,.9)"; }catch(e){}
        }
      });
      if(missing.length){
        if(this.els.pledgeErr) this.els.pledgeErr.textContent = "חובה למלא: " + missing.join(" · ");
        return;
      }

      p.pledge = true;
      if(!p.pledgeBank || typeof p.pledgeBank !== "object") p.pledgeBank = {};
      p.pledgeBank.bankName = bankName;
      p.pledgeBank.bankNo = bankNo;
      p.pledgeBank.branch = branch;
      p.pledgeBank.amount = amount;
      p.pledgeBank.years = years;
      p.pledgeBank.address = address;
      p.pledgeBank._saved = true;

      this.closePledge();
      this.render();
    }



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
      this.render();
    },

    prevStep(){
      if(this.step <= 1) return;
      this.step -= 1;
      this.render();
    },

    nextStep(){
      const v = this.validateStep(this.step);
      if(!v.ok){
        this.setHint(v.msg || "נא להשלים את כל החובה בכל המבוטחים");
        return;
      }
      if(this.step >= this.steps.length) return;
      this.step += 1;
      this.setHint("");
      this.render();
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
          if(st <= this.step) { this.step = st; this.render(); }
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
      if(this.els.btnNext) this.els.btnNext.textContent = (this.step >= this.steps.length) ? "סיום" : "הבא ➜";
      if(this.els.btnNext) this.els.btnNext.disabled = (this.step >= this.steps.length);
    },

    renderBody(){
      if(!this.els.body) return;
      const ins = this.getActive();
      const stepTitle = this.steps.find(s => s.id === this.step)?.title || "";
      const head = `<div class="lcWSection">
        <div class="row row--between">
          <div>
            <div class="lcWTitle">${escapeHtml(stepTitle)} · ${escapeHtml(ins.label)}</div>
            <div class="muted small">מילוי השלב הוא לפי המבוטח הפעיל. מעבר שלב יתאפשר רק כשהשלב הושלם לכל המבוטחים.</div>
          </div>
        </div>
      </div>`;

      let body = "";
      if(this.step === 1) body = this.renderStep1(ins);
      else if(this.step === 2) body = this.renderStep2(ins);
      else if(this.step === 3) body = this.renderStep3(ins);
      else if(this.step === 4) body = this.renderStep4(ins);
      else if(this.step === 5) body = this.renderStep5(ins);
      else if(this.step === 6) body = this.renderStep6(ins);
      else body = this.renderStep7();

      this.els.body.innerHTML = head + body;

      // bind generic input handlers
      this.bindInputs(ins);
    },

    bindInputs(ins){
      // any element with data-bind="path"
      $$("[data-bind]", this.els.body).forEach(el => {
        const path = el.getAttribute("data-bind");
        if(!path) return;
        const setVal = (doRender=false) => {
          const v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
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
      on(addExist, "click", () => { this.addExistingPolicy(ins); });

      // existing policy row actions
      $$("[data-del-exist]", this.els.body).forEach(btn => {
        on(btn, "click", () => {
          const pid = btn.getAttribute("data-del-exist");
          this.delExistingPolicy(ins, pid);
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

      // discount button on new policy row
      $$("[data-discount-new]", this.els.body).forEach(btn => {
        on(btn, "click", () => {
          const pid = btn.getAttribute("data-discount-new");
          this.openDiscount(ins, pid);
        });
      });


      // pledge (collateral) controls - open modal, no inline fields
      $$("[data-pledge-toggle]", this.els.body).forEach(el => {
        on(el, "change", () => {
          const pid = el.getAttribute("data-pledge-toggle");
          const checked = !!el.checked;
          // keep state on policy
          this.setPath(ins.data, `newPolicies.${pid}.pledge`, checked);
          if(!checked){
            // remove collateral data + badge
            const p = (ins.data.newPolicies || []).find(x => String(x.id) === String(pid));
            if(p){
              p.pledgeBank = { bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" };
              delete p.pledgeBank._saved;
            }
            this.render();
            return;
          }
          // open modal to fill bank details
          this.openPledge(ins, pid);
          // rerender to reflect checkbox state (badge appears after save)
          this.render();
        });
      });

      $$("[data-pledge-open]", this.els.body).forEach(btn => {
        on(btn, "click", () => {
          const pid = btn.getAttribute("data-pledge-open");
          // ensure checkbox is on
          this.setPath(ins.data, `newPolicies.${pid}.pledge`, true);
          this.openPledge(ins, pid);
          this.render();
        });
      });

      // cancellations choices
      $$("[data-cancel-policy]", this.els.body).forEach(el => {
        on(el, "change", () => {
          const pid = el.getAttribute("data-cancel-policy");
          const key = el.getAttribute("data-cancel-key");
          if(!pid || !key) return;
          if(!ins.data.cancellations[pid]) ins.data.cancellations[pid] = {};
          const v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
          ins.data.cancellations[pid][key] = v;
          this.render();
        });
      });

      // payer controls
      $$("[data-payer]", this.els.body).forEach(el => {
        on(el, "change", () => {
          const k = el.getAttribute("data-payer");
          const v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
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
        if(Array.isArray(cur)){
          // allow addressing array items by index or by id
          if(/^\d+$/.test(k)){
            const idx = parseInt(k,10);
            if(!cur[idx] || typeof cur[idx] !== "object") cur[idx] = {};
            cur = cur[idx];
          }else{
            let item = cur.find(x => x && typeof x === "object" && String(x.id) === String(k));
            if(!item){
              item = { id: k };
              cur.push(item);
            }
            cur = item;
          }
        }else{
          if(!cur[k] || typeof cur[k] !== "object") cur[k] = {};
          cur = cur[k];
        }
      }
      const last = parts[parts.length-1];
      if(Array.isArray(cur)){
        if(/^\d+$/.test(last)){
          cur[parseInt(last,10)] = value;
        }else{
          // last shouldn't be id when cur is array; fallback to property on array
          cur[last] = value;
        }
      }else{
        cur[last] = value;
      }
    },


    // ---------- Step 1 ----------
    renderStep1(ins){
      const d = ins.data;
      const isChild = ins.type === "child";
      const p = this.insureds[0]?.data || {};
      const age = this.calcAge(d.birthDate);
      const ageTxt = age === null ? "" : String(age);

      const clinicOpts = this.clinics.map(x => `<option value="${escapeHtml(x)}"${d.clinic===x?" selected":""}>${escapeHtml(x)}</option>`).join("");
      const shabanOptsRaw = this.shabanMap[d.clinic] || ["אין שב״ן"];
      const shabanOpts = shabanOptsRaw.map(x => `<option value="${escapeHtml(x)}"${d.shaban===x?" selected":""}>${escapeHtml(x)}</option>`).join("");

      const inherited = (key) => safeTrim(p[key]);

      return `
        <div class="lcWSection">
          <div class="lcWTitle">פרטי ${escapeHtml(ins.label)}</div>

          <div class="lcWGrid">
            ${this.fieldText("שם פרטי","firstName", d.firstName)}
            ${this.fieldText("שם משפחה","lastName", d.lastName)}
            ${this.fieldText("ת״ז","idNumber", d.idNumber, "numeric")}
            ${this.fieldDate("תאריך לידה","birthDate", d.birthDate)}
            <div class="field">
              <label class="label">גיל (אוטומטי)</label>
              <input class="input" value="${escapeHtml(ageTxt)}" disabled />
            </div>
            ${this.fieldSelect("מין","gender", d.gender, ["","זכר","נקבה"])}
            ${!isChild ? this.fieldSelect("מצב משפחתי","maritalStatus", d.maritalStatus, ["","רווק/ה","נשוי/אה","גרוש/ה","אלמן/ה","ידוע/ה בציבור"]) : ""}
            ${this.fieldText("טלפון","phone", isChild ? inherited("phone") : d.phone, "tel", isChild)}
            ${this.fieldText("מייל","email", isChild ? inherited("email") : d.email, "email", isChild)}
            ${this.fieldText("עיר","city", isChild ? inherited("city") : d.city, "text", isChild)}
            ${this.fieldText("רחוב","street", isChild ? inherited("street") : d.street, "text", isChild)}
            ${this.fieldText("מספר","houseNumber", isChild ? inherited("houseNumber") : d.houseNumber, "numeric", isChild)}
            <div class="field">
              <label class="label">מיקוד (אוטומטי)</label>
              <input class="input" data-zip="zip" value="${escapeHtml(isChild ? inherited("zip") : (d.zip||""))}" placeholder="ימולא אוטומטית" disabled />
              <div class="help">המיקוד נשלף אוטומטית לפי עיר/רחוב/מספר.</div>
            </div>

            ${!isChild ? `
              <div class="field">
                <label class="label">קופת חולים</label>
                <select class="input" data-bind="clinic">
                  <option value="" ${!d.clinic?"selected":""}>בחר…</option>
                  ${clinicOpts}
                </select>
              </div>
              <div class="field">
                <label class="label">שב״ן</label>
                <select class="input" data-bind="shaban" ${d.clinic ? "" : "disabled"}>
                  ${shabanOpts}
                </select>
                <div class="help">הרשימה משתנה לפי קופה + “אין שב״ן”.</div>
              </div>
            ` : `
              <div class="field">
                <label class="label">ירושה אוטומטית (לקטין)</label>
                <div class="help">כתובת / טלפון / מייל נלקחים מהמבוטח הראשי ולא ניתנים לעריכה.</div>
              </div>
            `}
          </div>
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
      const bmiTxt = (d.bmi === null) ? "" : String(d.bmi);

      return `
        <div class="lcWSection">
          <div class="lcWTitle">BMI</div>
          <div class="lcWGrid">
            ${this.fieldText("גובה (ס״מ)","heightCm", d.heightCm, "numeric")}
            ${this.fieldText("משקל (ק״ג)","weightKg", d.weightKg, "numeric")}
            <div class="field">
              <label class="label">BMI (אוטומטי)</label>
              <input class="input" data-bmi="value" value="${escapeHtml(bmiTxt)}" disabled />
            </div>
            <div class="field">
              <label class="label">סטטוס</label>
              <div class="lcWRow">
                <span class="lcWBadge" data-bmi="badge"><span class="lcLamp ${st.lamp}" data-bmi="lamp"></span><span data-bmi="label">${escapeHtml(st.label || "—")}</span></span>
                <span class="muted small" data-bmi="text">${escapeHtml(st.text || "מלא גובה ומשקל כדי לחשב")}</span>
              </div>
            </div>
          </div>
          <div class="help">חישוב יתבצע רק כאשר גובה ומשקל מלאים.</div>
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
        compensation:""
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
      const rows = (d.existingPolicies || []).map(p => {
        const compOpts = this.companies.map(x => `<option value="${escapeHtml(x)}"${p.company===x?" selected":""}>${escapeHtml(x)}</option>`).join("");
        const typeOpts = this.insTypes.map(x => `<option value="${escapeHtml(x)}"${p.type===x?" selected":""}>${escapeHtml(x)}</option>`).join("");
        const isRisk = (p.type === "ריסק" || p.type === "ריסק משכנתא");
        const isCI = (p.type === "מחלות קשות" || p.type === "סרטן");
        const bankOpts = this.bankNames.map(b => `<option value="${escapeHtml(b)}"${safeTrim(p.pledgeBankName)===b?" selected":""}>${escapeHtml(b)}</option>`).join("");
        const agencies = this.bankAgencies.filter(a => !safeTrim(p.pledgeBankName) || String(a).includes(p.pledgeBankName));
        const agencyOpts = agencies.map(a => `<option value="${escapeHtml(a)}"${safeTrim(p.bankAgencyName)===a?" selected":""}>${escapeHtml(a)}</option>`).join("");
        return `
          <tr>
            <td>
              <select class="input" data-bind="existingPolicies.${p.id}.company">
                <option value="">בחר…</option>${compOpts}
              </select>
            </td>
            <td>
              <select class="input" data-bind="existingPolicies.${p.id}.type">
                <option value="">בחר…</option>${typeOpts}
              </select>
            </td>
            <td><input class="input" data-bind="existingPolicies.${p.id}.policyNumber" value="${escapeHtml(p.policyNumber||"")}" placeholder="מספר פוליסה" /></td>
            <td>
              ${isRisk ? `<input class="input" data-bind="existingPolicies.${p.id}.sumInsured" value="${escapeHtml(p.sumInsured||"")}" placeholder="סכום ביטוח" />` : isCI ? `<input class="input" data-bind="existingPolicies.${p.id}.compensation" value="${escapeHtml(p.compensation||"")}" placeholder="סכום פיצוי" />` : `<span class="muted small">—</span>`}
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

      // bind custom path for array by id
      // We'll handle in bindInputs via data-bind, but we used "existingPolicies.<id>.field" which isn't real path.
      // We'll patch by translating those in setPath override below via proxied binder (handled in bindInputs?? not yet).
      // We'll instead bind manually here after render in bindInputs using special handler.
      return `
        <div class="lcWSection">
          <div class="row row--between">
            <div>
              <div class="lcWTitle">פוליסות קיימות</div>
              <div class="muted small">לכל מבוטח בנפרד · ניתן להוסיף מספר פוליסות</div>
            </div>
            <button class="btn" id="lcAddExistingPolicy" type="button">➕ הוסף פוליסה</button>
          </div>

          <div class="tableWrap" style="padding:10px 0 0">
            <table class="lcPolTable">
              <thead>
                <tr>
                  <th>חברה</th>
                  <th>סוג</th>
                  <th>מספר</th>
                  <th>סכום/פיצוי</th>
                  <th>שיעבוד</th>
                  <th style="width:100px">פעולות</th>
                </tr>
              </thead>
              <tbody>${rows || `<tr><td colspan="6" class="muted">אין פוליסות עדיין</td></tr>`}</tbody>
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
          const v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);

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
      on(addExist, "click", () => { this.addExistingPolicy(ins); });
      $$("[data-del-exist]", this.els.body).forEach(btn => on(btn, "click", () => this.delExistingPolicy(ins, btn.getAttribute("data-del-exist"))));

      const addNew = $("#lcAddNewPolicy", this.els.body);
      on(addNew, "click", () => { this.addNewPolicy(ins); });
      $$("[data-del-new]", this.els.body).forEach(btn => on(btn, "click", () => this.delNewPolicy(ins, btn.getAttribute("data-del-new"))));

      $$("[data-cancel-policy]", this.els.body).forEach(el => {
        on(el, "change", () => {
          const pid = el.getAttribute("data-cancel-policy");
          const key = el.getAttribute("data-cancel-key");
          if(!pid || !key) return;
          if(!ins.data.cancellations[pid]) ins.data.cancellations[pid] = { attachments: {} };
          const v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
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
          const v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
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
        {v:"partial_health", t:"ביטול חלקי (בריאות)"},
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

        const showAnnex = (status === "partial_health");
        const pledgedBank = !!(p.hasPledge && p.bankAgency);

        return `
          <div class="lcWSection">
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

      return `<div class="lcWSection"><div class="lcWTitle">ביטול בחברה נגדית</div><div class="muted small">לכל פוליסה קיימת בנפרד.</div></div>` + blocks;
    },

    // ---------- Step 5 ----------
    addNewPolicy(ins){
      const p = {
        id: "npol_" + Math.random().toString(16).slice(2),
        company:"",
        type:"",
        premiumMonthly:"",
        // discountPct stored for future use (via % button)
        discountPct:"",
        sumInsured:"",
        compensation:"",
        pledge:false,
        pledgeBank:{ bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" }
      };
      ins.data.newPolicies.push(p);
      this.render();
    },
    delNewPolicy(ins, pid){
      ins.data.newPolicies = (ins.data.newPolicies || []).filter(p => p.id !== pid);
      this.render();
    },

    calcPremium(p){
      const before = Number(p.premiumBefore);
      const pct = Number(p.discountPct);
      if(!before || before <= 0){ p.premiumAfter = null; p.annualAfter = null; return; }
      const after = before * (1 - (pct/100));
      p.premiumAfter = Math.round(after*100)/100;
      p.annualAfter = Math.round(after*12*100)/100;
    },

    
    renderStep5(ins){
      const d = ins.data;
      const rows = (d.newPolicies || []).map(p => {
        const compOpts = this.companies.map(x => `<option value="${escapeHtml(x)}"${p.company===x?" selected":""}>${escapeHtml(x)}</option>`).join("");
        const typeOpts = this.insTypes.map(x => `<option value="${escapeHtml(x)}"${p.type===x?" selected":""}>${escapeHtml(x)}</option>`).join("");

        const isRisk = (p.type === "ריסק" || p.type === "ריסק משכנתא");
        const isCI = (p.type === "מחלות קשות" || p.type === "סרטן");
        const pledgeSaved = !!(p.pledge && p.pledgeBank && p.pledgeBank._saved);

        return `
          <div class="lcPolicyCard">
            <div class="lcPolicyCard__head">
              <div class="row" style="gap:10px; align-items:center; flex-wrap:wrap">
                <div class="lcPolicyCard__title">פוליסה חדשה</div>
                ${isRisk && pledgeSaved ? `<button class="lcWBadge" data-pledge-open="${p.id}" type="button" title="עריכת שיעבוד"><span aria-hidden="true">🏦</span>פוליסה משועבדת</button>` : ``}
              </div>
              <div class="row" style="gap:10px">
                <button class="iconBtn iconBtn--tiny" data-discount-new="${p.id}" type="button" aria-label="הנחה" title="הנחה (אחוז)">
                  %
                </button>
                <button class="btn lcSmallBtn" data-del-new="${p.id}" type="button">הסר</button>
              </div>
            </div>

            <div class="lcPolicyGrid">
              <div class="field">
                <label class="label">חברה</label>
                <select class="input" data-bind="newPolicies.${p.id}.company">
                  <option value="">בחר…</option>${compOpts}
                </select>
              </div>

              <div class="field">
                <label class="label">סוג ביטוח</label>
                <select class="input" data-bind="newPolicies.${p.id}.type">
                  <option value="">בחר…</option>${typeOpts}
                </select>
              </div>

              <div class="field">
                <label class="label">פרמיה חודשית (₪)</label>
                <input class="input" data-bind="newPolicies.${p.id}.premiumMonthly" value="${escapeHtml(p.premiumMonthly||"")}" inputmode="decimal" placeholder="₪" />
              </div>

              ${isCI ? `
                <div class="field">
                  <label class="label">סכום פיצוי (חובה)</label>
                  <input class="input" data-bind="newPolicies.${p.id}.compensation" value="${escapeHtml(p.compensation||"")}" placeholder="₪" inputmode="decimal" />
                </div>
              ` : isRisk ? `
                <div class="field">
                  <label class="label">סכום ביטוח (חובה)</label>
                  <input class="input" data-bind="newPolicies.${p.id}.sumInsured" value="${escapeHtml(p.sumInsured||"")}" placeholder="₪" inputmode="decimal" />
                </div>
              ` : `
                <div class="field">
                  <label class="label">הערה</label>
                  <div class="help">אין שדות נוספים לסוג זה בשלב זה.</div>
                </div>
              `}

              ${isRisk ? `
                <div class="field">
                  <label class="label">שיעבוד</label>
                  <div class="row" style="gap:10px; align-items:center; justify-content:space-between">
                    <label class="row" style="gap:8px">
                      <input type="checkbox" data-pledge-toggle="${p.id}" ${p.pledge ? "checked":""} />
                      <span class="small">יש שיעבוד</span>
                    </label>
                    <button class="iconBtn iconBtn--tiny" data-pledge-open="${p.id}" type="button" aria-label="פרטי שיעבוד" title="פרטי שיעבוד">🏦</button>
                  </div>
                  <div class="help">הפרטים נפתחים בחלון נפרד. לאחר שמירה יופיע 🏦 "פוליסה משועבדת".</div>
                </div>
              ` : ``}
            </div>

            ""

          </div>
        `;
      }).join("");

      return `
        <div class="lcWSection">
          <div class="row row--between">
            <div>
              <div class="lcWTitle">פוליסות חדשות</div>
              <div class="muted small">הנחה הוסרה זמנית ותופיע ככפתור (%) בכל שורת פוליסה.</div>
            </div>
            <button class="btn" id="lcAddNewPolicy" type="button">➕ הוסף פוליסה חדשה</button>
          </div>
        </div>
        ${rows || `<div class="lcWSection"><div class="muted">אין פוליסות חדשות עדיין.</div></div>`}
      `;
    },


    // ---------- Step 6 ----------
    renderStep6(ins){
      const d = ins.data;
      const insuredPayers = this.insureds.filter(x => x.type !== "child").map(x => ({ id:x.id, label:x.label, name: (safeTrim(x.data.firstName)+" "+safeTrim(x.data.lastName)).trim() || x.label }));
      const payerOpts = insuredPayers.map(x => `<option value="${x.id}"${safeTrim(d.selectedPayerId)===x.id?" selected":""}>${escapeHtml(x.name)} (${escapeHtml(x.label)})</option>`).join("");

      const method = safeTrim(d.paymentMethod || "cc");
      const chooser = `
        <div class="lcWSection">
          <div class="lcWTitle">פרטי משלם</div>
          <div class="lcWGrid">
            <div class="field">
              <label class="label">בחירת משלם</label>
              <select class="input" data-payer="payerChoice">
                <option value="insured" ${d.payerChoice==="insured"?"selected":""}>מבוטח קיים</option>
                <option value="external" ${d.payerChoice==="external"?"selected":""}>משלם חריג</option>
              </select>
            </div>

            <div class="field">
              <label class="label">האם משלם עבור כל המבוטחים והפוליסות?</label>
              <label class="row" style="gap:8px">
                <input type="checkbox" data-payer="payAll" ${d.payAll ? "checked":""} />
                <span class="small">כן</span>
              </label>
              <div class="help">אם לא – שיוך ברמת פוליסה יתווסף בהרחבה הבאה.</div>
            </div>
          </div>

          ${d.payerChoice === "insured" ? `
            <div class="divider"></div>
            <div class="field">
              <label class="label">מי המשלם?</label>
              <select class="input" data-payer="selectedPayerId">
                <option value="">בחר…</option>
                ${payerOpts}
              </select>
              <div class="help">קטין לא יכול להיות משלם.</div>
            </div>
          ` : `
            <div class="divider"></div>
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
          <div class="lcWGrid">
            <div class="field">
              <label class="label">אמצעי תשלום</label>
              <select class="input" data-payer="paymentMethod">
                <option value="cc" ${method==="cc"?"selected":""}>כרטיס אשראי</option>
                <option value="ho" ${method==="ho"?"selected":""}>הוראת קבע</option>
              </select>
            </div>

            ${method==="cc" ? `
              ${this.fieldText("שם מחזיק/ה","cc.holderName", d.cc?.holderName || "")}
              ${this.fieldText("ת״ז מחזיק/ה","cc.holderId", d.cc?.holderId || "", "numeric")}
              ${this.fieldText("מספר כרטיס","cc.cardNumber", d.cc?.cardNumber || "", "numeric")}
              ${this.fieldText("תוקף (MM/YY)","cc.exp", d.cc?.exp || "", "text")}
            ` : `
              ${this.fieldText("מספר חשבון","ho.account", d.ho?.account || "", "numeric")}
              ${this.fieldText("מספר סניף","ho.branch", d.ho?.branch || "", "numeric")}
              <div class="field">
                <label class="label">שם בנק</label>
                <select class="input" data-payer="ho.bankName">
                  <option value="">בחר…</option>
                  ${this.bankNames.map(b => `<option value="${escapeHtml(b)}"${d.ho?.bankName===b?" selected":""}>${escapeHtml(b)}</option>`).join("")}
                </select>
              </div>
              ${this.fieldText("מספר בנק","ho.bankNo", d.ho?.bankNo || "", "numeric")}
            `}
          </div>
        </div>
      `;
      return chooser;
    },

    // ---------- Step 7 ----------
    renderStep7(){
      return `
        <div class="lcWSection">
          <div class="lcWTitle">סיכום</div>
          <div class="muted">שלב סיכום ושמירה יתווסף בשלב הבא (כולל יצירת לקוח ושמירה לשרת).</div>
          <div class="divider"></div>
          <div class="help">בשלב הזה כבר יש לנו מבנה מלא של שלבים 1–6, טאבים למבוטחים, ולוגיקה של מעבר שלב לפי השלמת חובה.</div>
        </div>
      `;
    },

    // ---------- Validation ----------
    stepCompletionMap(stepId){
      const map = {};
      this.insureds.forEach(ins => { map[ins.id] = this.isStepCompleteForInsured(stepId, ins); });
      return map;
    },

    validateStep(stepId){
      const bad = this.insureds.filter(ins => !this.isStepCompleteForInsured(stepId, ins));
      if(!bad.length) return { ok:true };
      const names = bad.map(x => x.label).join(", ");
      return { ok:false, msg: "חסר מילוי חובה עבור: " + names };
    },

    isStepCompleteForInsured(stepId, ins){
      const d = ins.data || {};
      if(stepId === 1){
        const baseReq = ["firstName","lastName","idNumber","birthDate","gender"];
        const adultReq = baseReq.concat(["phone","email","city","street","houseNumber","clinic","shaban"]);
        const req = (ins.type === "child") ? baseReq : adultReq;

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
        // existing policies optional, but if a risk policy has pledge -> bank is required; if via bank agency -> agency required
        const list = d.existingPolicies || [];
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
        // new policies: if exists, must have company, type, premiumMonthly > 0
        const list = d.newPolicies || [];
        for(const p of list){
          if(!safeTrim(p.company) || !safeTrim(p.type)) return false;
          if(!(Number(p.premiumMonthly) > 0)) return false;
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
      const v = (ins.data.bmi === null || ins.data.bmi === undefined || ins.data.bmi === "") ? "" : String(ins.data.bmi);
      const valEl = body.querySelector('[data-bmi="value"]');
      if(valEl) valEl.value = v;

      const st = this.bmiStatus(ins.data.bmi);
      const lampEl = body.querySelector('[data-bmi="lamp"]');
      if(lampEl){
        lampEl.classList.remove("green","yellow","red");
        if(st.lamp) lampEl.classList.add(st.lamp);
      }
      const labelEl = body.querySelector('[data-bmi="label"]');
      if(labelEl) labelEl.textContent = st.label || "—";
      const textEl = body.querySelector('[data-bmi="text"]');
      if(textEl) textEl.textContent = st.text || "מלא גובה ומשקל כדי לחשב";
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
  Wizard.init();
  App._bootPromise = App.boot();

})();
