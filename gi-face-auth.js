/* GI-FACE 2026-08-14 — optional face login / enroll (PIN + MFA unchanged). */
(() => {
  "use strict";

  const ROTATE_MS = 30000;
  const POLL_MS = 1400;
  const FN_PATH = "/functions/v1/gi-face-auth";

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
    return window.__GI_FACE_BRIDGE__ || {};
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

  let qrLibPromise = null;
  function loadQrLib(){
    if(window.QRCode && typeof window.QRCode.toCanvas === "function") return Promise.resolve(window.QRCode);
    if(qrLibPromise) return qrLibPromise;
    qrLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js";
      s.async = true;
      s.onload = () => resolve(window.QRCode);
      s.onerror = () => reject(new Error("QR_LIB"));
      document.head.appendChild(s);
    });
    return qrLibPromise;
  }

  async function drawQr(canvas, text){
    if(!canvas) return;
    try {
      const QRCode = await loadQrLib();
      await QRCode.toCanvas(canvas, text, {
        width: 220,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" }
      });
    } catch(_e) {
      const img = document.createElement("img");
      img.alt = "QR";
      img.width = 220;
      img.height = 220;
      img.src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(text);
      canvas.replaceWith(img);
      img.id = canvas.id;
    }
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
    if(this._closed || !this._secret) return;
    const data = await callFn({ action: "poll", desktopSecret: this._secret });
    const status = trim(data?.status);
    this.onStatus(status, data);
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
  };

  FaceSessionController.prototype.rotate = async function(){
    if(this._closed || this._busy) return;
    this._busy = true;
    try {
      const prev = this._secret;
      if(prev){
        try { await callFn({ action: "cancel", desktopSecret: prev }); } catch(_e) {}
      }
      const agent = this.getAgent() || {};
      const created = await callFn({
        action: "create",
        kind: this.kind,
        agentId: trim(agent.id),
        agentName: trim(agent.name),
        agentRole: trim(agent.role)
      });
      if(this._closed){
        try { await callFn({ action: "cancel", desktopSecret: created.desktopSecret }); } catch(_e) {}
        return;
      }
      this._secret = created.desktopSecret;
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
          const agent = typeof b.findAgentById === "function" ? b.findAgentById(data.agentId) : null;
          if(!agent){
            self.setLoginHint("הנציג לא נמצא במערכת. היכנסו עם PIN.", "err");
            self.showLoginPanel(false);
            return;
          }
          self.setLoginHint("אומת. נכנסים…", "ok");
          const detail = buildDetailText(data.deviceLabel, data.geoText);
          try {
            await b.completeAgentLogin(agent, { loginDetailText: detail });
          } catch(_e) {
            self.setLoginHint("הכניסה נכשלה. היכנסו עם PIN.", "err");
            if(typeof b.setLoginError === "function") b.setLoginError("זיהוי הפנים אומת אך הכניסה נכשלה. היכנסו עם PIN.");
          }
        },
        onDenied: async () => {
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
        this.setLoginHint("לא ניתן לפתוח זיהוי פנים כרגע.", "err");
        this.showLoginPanel(false);
      }
    },

    async stopLogin(){
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
      const agent = typeof b.getCurrentAgent === "function" ? b.getCurrentAgent() : null;
      if(!agent || !trim(agent.id)){
        this.setEnrollHint("זיהוי פנים זמין לנציגים רשומים במערכת.", "err");
        this.openEnrollModal(true);
        return;
      }
      try { if(typeof b.closeUserMenu === "function") b.closeUserMenu(); } catch(_e) {}
      this.openEnrollModal(true);
      this.setEnrollHint("סרקו בטלפון, צלמו כמה זוויות ולחצו «אישור וסיום».");
      if(this._enrollCtl) await this._enrollCtl.cancel();
      const self = this;
      this._enrollCtl = new FaceSessionController({
        kind: "enroll",
        getAgent: () => (typeof b.getCurrentAgent === "function" ? b.getCurrentAgent() : null),
        onQr: (href) => {
          const canvas = self.els().enrollQr;
          if(canvas && canvas.tagName !== "CANVAS"){
            const next = document.createElement("canvas");
            next.id = "giFaceEnrollQr";
            canvas.replaceWith(next);
            void drawQr(next, href);
            return;
          }
          void drawQr(canvas, href);
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
      } catch(err) {
        const code = String(err?.code || err?.message || "");
        if(code === "AGENT_NOT_FOUND" || code === "MISSING_AGENT"){
          this.setEnrollHint("המשתמש הנוכחי לא מחובר כנציג במערכת.", "err");
        } else {
          this.setEnrollHint("לא ניתן לפתוח הרשמה כרגע.", "err");
        }
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
    phonePageUrl,
    FaceLoginUI
  };

  const boot = () => FaceLoginUI.init();
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
