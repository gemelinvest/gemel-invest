/* GI-FACE 2026-08-14 — optional face login / enroll (PIN + MFA unchanged). */
(() => {
  "use strict";

  const ROTATE_MS = 30000;
  const POLL_MS = 1400;
  const FN_PATH = "/functions/v1/gi-face-auth";
  const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";

  function trim(v){
    return String(v == null ? "" : v).trim();
  }

  function euclidean(a, b){
    const left = Array.isArray(a) ? a : [];
    const right = Array.isArray(b) ? b : [];
    const n = Math.min(left.length, right.length);
    let s = 0;
    for(let i = 0; i < n; i += 1){
      const d = Number(left[i]) - Number(right[i]);
      s += d * d;
    }
    return Math.sqrt(s);
  }

  function deviceLabelFromUa(ua){
    const s = String(ua || "");
    if(/iPhone|iPad|iPod/i.test(s)) return "iPhone";
    if(/Android/i.test(s)) return "Android";
    if(/Windows/i.test(s)) return "מחשב Windows";
    if(/Mac/i.test(s)) return "Mac";
    if(/Mobile/i.test(s)) return "טלפון";
    return "מחשב";
  }

  function forceUnlockLogin(){
    try { document.body.classList.remove("lcAuthLock"); } catch(_e) {}
    try {
      const wrap = document.getElementById("lcLogin");
      if(wrap) wrap.setAttribute("aria-hidden", "true");
    } catch(_e) {}
  }

  function isAuthLocked(){
    return !!(document.body && document.body.classList.contains("lcAuthLock"));
  }

  function agentFromApprovedSession(data){
    const id = trim(data?.agentId);
    const name = trim(data?.agentName);
    if(!id && !name) return null;
    return {
      id,
      name,
      role: trim(data?.agentRole) || "agent",
      username: trim(data?.agentUsername)
    };
  }

  function buildDetailText(deviceLabel, geoText){
    const device = trim(deviceLabel) || "טלפון";
    const geo = trim(geoText) || "מיקום כבוי";
    return ["זיהוי פנים", device, geo].join(" · ");
  }

  function phonePageUrl(publicToken){
    const url = new URL("face-auth.html", window.location.href);
    url.searchParams.set("t", trim(publicToken));
    return url.href;
  }

  function bridge(){
    const b = window.__GI_FACE_BRIDGE__ && typeof window.__GI_FACE_BRIDGE__ === "object"
      ? window.__GI_FACE_BRIDGE__
      : {};
    return {
      supabaseUrl: trim(b.supabaseUrl) || FALLBACK_SUPABASE_URL,
      publishableKey: trim(b.publishableKey) || FALLBACK_PUBLISHABLE_KEY,
      completeAgentLogin: b.completeAgentLogin,
      ensureLoginReady: b.ensureLoginReady,
      findAgentById: b.findAgentById,
      findLoginAgent: b.findLoginAgent,
      hideMfaStep: b.hideMfaStep,
      abortPinLogin: b.abortPinLogin,
      enterFromFaceSession: b.enterFromFaceSession,
      unlock: b.unlock,
      getCurrentAgent: b.getCurrentAgent,
      closeUserMenu: b.closeUserMenu,
      setLoginError: b.setLoginError
    };
  }

  function agentFromPill(){
    const name = trim(document.querySelector("#lcUserPillText .lcUserPill__name, .lcUserPill__name")?.textContent);
    const roleHe = trim(document.querySelector("#lcUserPillText .lcUserPill__role, .lcUserPill__role")?.textContent);
    let role = "agent";
    if(roleHe === "מפתח המערכת") role = "owner";
    else if(roleHe === "מנהל מערכת") role = "admin";
    else if(roleHe === "מנהל") role = "manager";
    else if(roleHe === "מנהל צוות") role = "teamManager";
    else if(roleHe === "מנהל תפעול") role = "ops";
    else if(roleHe === "נציג תפעול") role = "opsAgent";
    else if(roleHe === "אלמנטרי") role = "elementary";
    else if(roleHe === "סוקרת") role = "referent";
    if(!name && !roleHe) return null;
    return { id: "", name: name || "מנהל מערכת", role, username: "" };
  }

  async function callFn(payload){
    const b = bridge();
    const url = trim(b.supabaseUrl) + FN_PATH;
    const key = trim(b.publishableKey);
    if(!url || !key) throw new Error("NO_BRIDGE");
    const res = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload || {})
    });
    let data = null;
    try { data = await res.json(); } catch(_e) { data = {}; }
    if(!res.ok || data?.ok === false){
      const err = new Error(data?.error || ("HTTP_" + res.status));
      err.code = data?.error || "";
      throw err;
    }
    return data;
  }

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("SCRIPT " + src));
      document.head.appendChild(s);
    });
  }

  let qrLibPromise = null;
  function loadQrLib(){
    if(window.QRCode && (typeof window.QRCode.toCanvas === "function" || typeof window.QRCode === "function")){
      return Promise.resolve(window.QRCode);
    }
    if(qrLibPromise) return qrLibPromise;
    qrLibPromise = loadScript("https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js")
      .catch(() => loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"))
      .then(() => window.QRCode);
    return qrLibPromise;
  }

  function setQrLink(href){
    ["lcFaceLoginLink", "giFaceEnrollLink"].forEach((id) => {
      const el = document.getElementById(id);
      if(!el) return;
      el.href = href || "#";
      el.hidden = !href;
    });
  }

  function qrImageUrl(text, provider){
    const data = encodeURIComponent(text);
    if(provider === "quickchart") return "https://quickchart.io/qr?size=220&margin=1&text=" + data;
    return "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=1&data=" + data;
  }

  function paintQrImage(host, text){
    if(!host) return null;
    const img = document.createElement("img");
    img.alt = "QR";
    img.width = 220;
    img.height = 220;
    img.id = host.id || "giFaceQr";
    img.src = qrImageUrl(text, "qrserver");
    img.onerror = function(){
      img.onerror = null;
      img.src = qrImageUrl(text, "quickchart");
    };
    if(typeof host.replaceWith === "function") host.replaceWith(img);
    return img;
  }

  function withTimeout(promise, ms){
    return Promise.race([
      promise,
      new Promise((_, reject) => window.setTimeout(() => reject(new Error("QR_TIMEOUT")), ms))
    ]);
  }

  async function drawQr(canvas, text){
    if(!canvas || !text) return;
    setQrLink(text);
    const painted = paintQrImage(canvas, text);
    try {
      const QRCode = await withTimeout(loadQrLib(), 2500);
      if(QRCode && typeof QRCode.toCanvas === "function"){
        const node = document.createElement("canvas");
        node.id = (painted && painted.id) || canvas.id || "giFaceQr";
        await QRCode.toCanvas(node, text, {
          width: 220,
          margin: 1,
          color: { dark: "#0f172a", light: "#ffffff" }
        });
        const live = document.getElementById(node.id);
        if(live && live !== node && typeof live.replaceWith === "function") live.replaceWith(node);
      }
    } catch(_e) {}
  }

  async function fetchActiveAgents(){
    const b = bridge();
    const url = trim(b.supabaseUrl) + "/rest/v1/agents?select=id,name,username,role,active";
    const key = trim(b.publishableKey);
    if(!url || !key) return [];
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key
      }
    });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  function matchAgentRow(list, cur){
    const rows = Array.isArray(list) ? list : [];
    const id = trim(cur?.id);
    const name = trim(cur?.name);
    const username = trim(cur?.username);
    const role = trim(cur?.role);
    return rows.find((a) => id && trim(a?.id) === id)
      || rows.find((a) => name && (trim(a?.name) === name || trim(a?.username) === name) && a?.active !== false)
      || rows.find((a) => username && trim(a?.username) === username && a?.active !== false)
      || ((role === "admin" || role === "owner" || name === "מנהל מערכת")
        ? rows.find((a) => trim(a?.name) === "אוריה סומך" && a?.active !== false)
        : null)
      || null;
  }

  function isAdminLike(agent){
    const role = trim(agent?.role);
    const name = trim(agent?.name);
    return role === "admin" || role === "owner"
      || name === "מנהל מערכת" || name === "מפתח המערכת"
      || name === "אוריה" || name === "אוריה סומך";
  }

  function ownerFallbackAgent(){
    return { id: "agent-admin-1", name: "אוריה סומך", role: "manager", username: "אוריה" };
  }

  async function resolveAgentForEnroll(){
    const b = bridge();
    let local = null;
    try {
      local = typeof b.getCurrentAgent === "function" ? b.getCurrentAgent() : null;
    } catch(_e) { local = null; }
    if(!local || (!trim(local.id) && !trim(local.name))){
      local = agentFromPill() || local;
    }
    if(local && trim(local.id)) return local;
    let list = [];
    try { list = await fetchActiveAgents(); } catch(_e) { list = []; }
    const matched = matchAgentRow(list, local || {});
    if(matched){
      return {
        id: trim(matched.id),
        name: trim(matched.name),
        role: trim(matched.role) || trim(local?.role) || "agent",
        username: trim(matched.username)
      };
    }
    if(isAdminLike(local)) return ownerFallbackAgent();
    if(local && (trim(local.id) || trim(local.name) || trim(local.role))) return local;
    return agentFromPill() || ownerFallbackAgent();
  }

  function FaceSessionController(opts){
    this.kind = opts.kind;
    this.getAgent = opts.getAgent || (() => null);
    this.onStatus = opts.onStatus || function(){};
    this.onQr = opts.onQr || function(){};
    this.onApproved = opts.onApproved || function(){};
    this.onEnrolled = opts.onEnrolled || function(){};
    this.onDenied = opts.onDenied || function(){};
    this._secret = "";
    this._status = "";
    this._timerRotate = 0;
    this._timerPoll = 0;
    this._busy = false;
    this._closed = false;
  }

  FaceSessionController.prototype.stopTimers = function(){
    if(this._timerRotate) window.clearInterval(this._timerRotate);
    if(this._timerPoll) window.clearInterval(this._timerPoll);
    this._timerRotate = 0;
    this._timerPoll = 0;
  };

  FaceSessionController.prototype.cancel = async function(){
    this._closed = true;
    this.stopTimers();
    const secret = this._secret;
    this._secret = "";
    if(!secret) return;
    try { await callFn({ action: "cancel", desktopSecret: secret }); } catch(_e) {}
  };

  FaceSessionController.prototype.pollOnce = async function(){
    if(this._closed || !this._secret || this._pollBusy) return;
    this._pollBusy = true;
    try {
      const data = await callFn({ action: "poll", desktopSecret: this._secret });
      const status = trim(data?.status);
      this._status = status;
      this.onStatus(status, data);
      if(status === "scanned"){
        if(this._timerRotate){
          window.clearInterval(this._timerRotate);
          this._timerRotate = 0;
        }
        return;
      }
      if(status === "approved"){
        this._closed = true;
        this.stopTimers();
        await this.onApproved(data);
      } else if(status === "enrolled"){
        this._closed = true;
        this.stopTimers();
        await this.onEnrolled(data);
      } else if(status === "denied"){
        this.stopTimers();
        await this.onDenied(data);
      } else if(status === "expired" || status === "cancelled"){
        if(this.kind === "login" || this.kind === "enroll"){
          await this.rotate();
        }
      }
    } catch(_e) {
    } finally {
      this._pollBusy = false;
    }
  };

  FaceSessionController.prototype.rotate = async function(){
    if(this._closed || this._busy || this._status === "scanned") return;
    this._busy = true;
    try {
      const prev = this._secret;
      if(prev){
        try { await callFn({ action: "cancel", desktopSecret: prev }); } catch(_e) {}
      }
      const agent = this.getAgent() || {};
      const payload = {
        action: "create",
        kind: this.kind,
        agentId: trim(agent.id),
        agentName: trim(agent.name),
        agentUsername: trim(agent.username),
        agentRole: trim(agent.role)
      };
      let created;
      try {
        created = await callFn(payload);
      } catch(err) {
        const code = String(err?.code || err?.message || "");
        if(this.kind === "enroll" && isAdminLike(agent) && (code === "AGENT_NOT_FOUND" || code === "MISSING_AGENT")){
          const owner = ownerFallbackAgent();
          created = await callFn({
            action: "create",
            kind: "enroll",
            agentId: owner.id,
            agentName: owner.name,
            agentUsername: owner.username,
            agentRole: owner.role
          });
        } else {
          throw err;
        }
      }
      if(this._closed){
        try { await callFn({ action: "cancel", desktopSecret: created.desktopSecret }); } catch(_e) {}
        return;
      }
      this._secret = created.desktopSecret;
      this._status = "pending";
      const href = phonePageUrl(created.publicToken);
      this.onQr(href, created);
      this.onStatus("pending", created);
    } finally {
      this._busy = false;
    }
  };

  FaceSessionController.prototype.start = async function(){
    this._closed = false;
    this.stopTimers();
    await this.rotate();
    this._timerRotate = window.setInterval(() => { void this.rotate(); }, ROTATE_MS);
    this._timerPoll = window.setInterval(() => { void this.pollOnce(); }, POLL_MS);
    void this.pollOnce();
  };

  const FaceLoginUI = {
    _loginCtl: null,
    _enrollCtl: null,
    _bound: false,

    els(){
      return {
        btnLogin: document.getElementById("btnFaceLogin"),
        panel: document.getElementById("lcFaceLoginPanel"),
        qr: document.getElementById("lcFaceLoginQr"),
        hint: document.getElementById("lcFaceLoginHint"),
        timer: document.getElementById("lcFaceLoginTimer"),
        btnCancel: document.getElementById("btnFaceLoginCancel"),
        or: document.getElementById("lcLoginOrFace"),
        btnEnroll: document.getElementById("btnFaceEnroll"),
        modal: document.getElementById("giFaceEnrollModal"),
        enrollQr: document.getElementById("giFaceEnrollQr"),
        enrollHint: document.getElementById("giFaceEnrollHint"),
        enrollClose: document.getElementById("giFaceEnrollClose"),
        enrollCancel: document.getElementById("giFaceEnrollCancel"),
        enrollBackdrop: document.getElementById("giFaceEnrollBackdrop")
      };
    },

    setLoginHint(text, tone){
      const el = this.els().hint;
      if(!el) return;
      el.textContent = text || "";
      el.classList.toggle("is-ok", tone === "ok");
      el.classList.toggle("is-err", tone === "err");
    },

    showLoginPanel(open){
      const els = this.els();
      if(els.panel) els.panel.hidden = !open;
      if(els.btnLogin) els.btnLogin.hidden = !!open;
    },

    async startLogin(){
      const b = bridge();
      window.__GI_FACE_LOGIN_ACTIVE__ = true;
      window.__GI_FACE_LOGIN_DONE__ = false;
      try { if(typeof b.hideMfaStep === "function") b.hideMfaStep(); } catch(_e) {}
      try { if(typeof b.abortPinLogin === "function") b.abortPinLogin(); } catch(_e) {}
      try { if(typeof b.ensureLoginReady === "function") await b.ensureLoginReady(); } catch(_e) {}
      this.showLoginPanel(true);
      this.setLoginHint("סרקו את הקוד במצלמת הטלפון. הקוד מתחלף כל 30 שניות.");
      if(this._loginCtl) await this._loginCtl.cancel();
      const self = this;
      this._loginCtl = new FaceSessionController({
        kind: "login",
        onQr: (href) => {
          const canvas = self.els().qr;
          if(canvas && canvas.tagName !== "CANVAS"){
            const next = document.createElement("canvas");
            next.id = "lcFaceLoginQr";
            canvas.replaceWith(next);
            void drawQr(next, href);
            return;
          }
          void drawQr(canvas, href);
        },
        onStatus: (status) => {
          if(status === "scanned") self.setLoginHint("הטלפון סרק. ממתינים לזיהוי פנים…");
          if(status === "pending") self.setLoginHint("סרקו את הקוד במצלמת הטלפון. הקוד מתחלף כל 30 שניות.");
        },
        onApproved: async (data) => {
          window.__GI_FACE_LOGIN_ACTIVE__ = true;
          const live = bridge();
          try { if(typeof live.abortPinLogin === "function") live.abortPinLogin(); } catch(_e) {}
          try { if(typeof live.hideMfaStep === "function") live.hideMfaStep(); } catch(_e) {}
          const agent = agentFromApprovedSession(data);
          if(!agent){
            self.setLoginHint("הזיהוי הצליח אך כרטיס הנציג לא נטען. סרקו שוב.", "err");
            return;
          }
          self.setLoginHint("אומת. נכנסים…", "ok");
          const detail = buildDetailText(data.deviceLabel, data.geoText);
          try {
            window.__GI_FACE_LOGIN_DONE__ = true;
            const enter = (typeof window.__GI_FACE_ENTER__ === "function")
              ? window.__GI_FACE_ENTER__
              : live.enterFromFaceSession;
            if(typeof enter === "function"){
              await enter(agent, detail);
            } else if(typeof live.completeAgentLogin === "function"){
              await live.completeAgentLogin(agent, { loginDetailText: detail, skipMfa: true });
            } else {
              throw new Error("NO_COMPLETE_LOGIN");
            }
          } catch(err) {
            console.error("GI_FACE_LOGIN_FINISH_FAILED:", err);
            try {
              if(typeof live.completeAgentLogin === "function"){
                await live.completeAgentLogin(agent, { loginDetailText: detail, skipMfa: true });
              }
            } catch(_e2) {}
          } finally {
            try { if(typeof live.unlock === "function") live.unlock(); } catch(_e) {}
            forceUnlockLogin();
            window.__GI_FACE_LOGIN_ACTIVE__ = false;
            self.showLoginPanel(false);
            self.setLoginHint("");
          }
        },
        onDenied: async () => {
          window.__GI_FACE_LOGIN_ACTIVE__ = false;
          window.__GI_FACE_LOGIN_DONE__ = false;
          self.setLoginHint("הפנים לא זוהו. אפשר להיכנס עם שם משתמש ו-PIN למטה.", "err");
          self.showLoginPanel(false);
          if(typeof b.setLoginError === "function"){
            b.setLoginError("זיהוי הפנים לא הצליח. היכנסו עם שם משתמש וקוד כניסה.");
          }
        },
        onEnrolled: async () => {}
      });
      try {
        await this._loginCtl.start();
      } catch(_e) {
        window.__GI_FACE_LOGIN_ACTIVE__ = false;
        window.__GI_FACE_LOGIN_DONE__ = false;
        this.setLoginHint("לא ניתן לפתוח זיהוי פנים כרגע.", "err");
        this.showLoginPanel(false);
      }
    },

    async stopLogin(){
      window.__GI_FACE_LOGIN_ACTIVE__ = false;
      window.__GI_FACE_LOGIN_DONE__ = false;
      if(this._loginCtl) await this._loginCtl.cancel();
      this._loginCtl = null;
      this.showLoginPanel(false);
      this.setLoginHint("");
    },

    openEnrollModal(open){
      const modal = this.els().modal;
      if(!modal) return;
      modal.classList.toggle("is-open", !!open);
      modal.setAttribute("aria-hidden", open ? "false" : "true");
    },

    setEnrollHint(text, tone){
      const el = this.els().enrollHint;
      if(!el) return;
      el.textContent = text || "";
      el.classList.toggle("is-ok", tone === "ok");
      el.classList.toggle("is-err", tone === "err");
    },

    async startEnroll(){
      const b = bridge();
      try { if(typeof b.closeUserMenu === "function") b.closeUserMenu(); } catch(_e) {}
      this.openEnrollModal(true);
      this.setEnrollHint("מכין קוד QR…");
      try { if(typeof b.ensureLoginReady === "function") await b.ensureLoginReady(); } catch(_e) {}
      let agent = null;
      try { agent = await resolveAgentForEnroll(); } catch(_e) { agent = agentFromPill(); }
      if(!agent) agent = ownerFallbackAgent();
      if(this._enrollCtl) await this._enrollCtl.cancel();
      const self = this;
      this._enrollCtl = new FaceSessionController({
        kind: "enroll",
        getAgent: () => agent,
        onQr: (href) => {
          void drawQr(self.els().enrollQr, href);
          self.setEnrollHint("סרקו בטלפון, צלמו כמה זוויות ולחצו «אישור וסיום».");
        },
        onStatus: (status) => {
          if(status === "scanned") self.setEnrollHint("הטלפון סרק. ממתינים לאישור וסיום בטלפון…");
        },
        onApproved: async () => {},
        onEnrolled: async () => {
          self.setEnrollHint("זיהוי הפנים נשמר. בפעם הבאה אפשר להיכנס מהמסך הראשי.", "ok");
        },
        onDenied: async () => {
          self.setEnrollHint("ההרשמה נכשלה. נסו שוב.", "err");
        }
      });
      try {
        await this._enrollCtl.start();
        if(!trim(this.els().enrollHint?.textContent) || this.els().enrollHint.textContent === "מכין קוד QR…"){
          this.setEnrollHint("סרקו בטלפון, צלמו כמה זוויות ולחצו «אישור וסיום».");
        }
      } catch(err) {
        const code = String(err?.code || err?.message || "");
        this.setEnrollHint("לא ניתן לפתוח הרשמה כרגע" + (code ? " (" + code + ")" : "") + ".", "err");
      }
    },

    async stopEnroll(){
      if(this._enrollCtl) await this._enrollCtl.cancel();
      this._enrollCtl = null;
      this.openEnrollModal(false);
      this.setEnrollHint("");
    },

    init(){
      if(this._bound) return;
      this._bound = true;
      const els = this.els();
      const form = document.getElementById("lcLoginForm");
      if(form){
        form.addEventListener("submit", (ev) => {
          const panel = document.getElementById("lcFaceLoginPanel");
          const panelOpen = !!(panel && !panel.hidden);
          if(!window.__GI_FACE_LOGIN_ACTIVE__ && !window.__GI_FACE_LOGIN_DONE__ && !panelOpen) return;
          ev.preventDefault();
          ev.stopImmediatePropagation();
        }, true);
      }
      if(els.btnLogin){
        els.btnLogin.addEventListener("click", (ev) => {
          ev.preventDefault();
          void this.startLogin();
        });
      }
      if(els.btnCancel){
        els.btnCancel.addEventListener("click", (ev) => {
          ev.preventDefault();
          void this.stopLogin();
        });
      }
      if(els.btnEnroll){
        els.btnEnroll.addEventListener("click", (ev) => {
          ev.preventDefault();
          void this.startEnroll();
        });
      }
      const closeEnroll = () => { void this.stopEnroll(); };
      if(els.enrollClose) els.enrollClose.addEventListener("click", closeEnroll);
      if(els.enrollCancel) els.enrollCancel.addEventListener("click", closeEnroll);
      if(els.enrollBackdrop) els.enrollBackdrop.addEventListener("click", closeEnroll);
      document.addEventListener("keydown", (ev) => {
        if(ev.key === "Escape" && this.els().modal?.classList.contains("is-open")) closeEnroll();
      });
    }
  };

  window.GiFaceAuth = {
    ROTATE_MS,
    MATCH_THRESHOLD: 0.5,
    euclidean,
    deviceLabelFromUa,
    buildDetailText,
    agentFromApprovedSession,
    isAuthLocked,
    phonePageUrl,
    FaceLoginUI
  };

  const boot = () => FaceLoginUI.init();
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
