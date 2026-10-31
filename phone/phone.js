/* ONYX phone. New files only: no desktop code, no new login, no new 2FA.
   Reads the existing session opener and the existing summary queries. */
(function () {
  "use strict";

  const SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const SUPABASE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
  const PROFILE_KEY = "onyx-phone-profile";
  const FACE_KEY = "onyx-phone-face";
  const FACE_PASS_KEY = "onyx-phone-face-pass";
  const FACE_MODEL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/";
  const ALLOWED = { agent: "נציג", manager: "מנהל", admin: "מנהל", teammanager: "מנהל צוות" };

  const $ = (id) => document.getElementById(id);
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "onyx-phone-auth" }
  });

  const state = {
    profile: null,
    scope: null,
    scopeReady: false,
    factorId: "",
    report: null,
    companies: null,
    customers: [],
    custFilter: "",
    taskTab: "today",
    meetDay: "",
    homeReminders: [],
    searchTimer: 0,
    cancelReport: null,
    cancelSheet: 0,
    cancelQuery: "",
    appointReport: null,
    appointQuery: "",
    ringItem: null,
    file: null,
    fileTab: "policies",
    filePolicies: [],
    fileDocs: [],
    policyIndex: -1,
    policyTab: "details",
    policyReport: false,
    policyDocs: [],
    agents: [],
    assignAgentId: "",
    account: "",
    noticeSending: false,
    sim: null,
    activityTimer: 0,
    alertTimer: 0,
    homeTimer: 0,
    homeBusy: false,
    reminderType: "",
    docUrl: "",
    docBlob: null,
    docName: "",
    pushNote: "",
    leadDay: "",
    meetMonth: "",
    composeReturn: "",
    leadRows: [],
    reviewLeadId: "",
    portalCode: "",
    portalEnabled: false
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

  function israelMonth(shift) {
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
    const wall = Date.UTC(y, m - 1, Number(get("day")), Number(get("hour")), Number(get("minute")), Number(get("second")));
    const offset = wall - now.getTime();
    const start = new Date(Date.UTC(y, m - 1 + shift, 1, 0, 0, 0) - offset);
    const end = new Date(Date.UTC(y, m + shift, 1, 0, 0, 0) - offset);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  function keyboardOverlap(innerHeight, viewHeight, offsetTop) {
    const cover = Math.round(Number(innerHeight) - Number(viewHeight) - Number(offsetTop || 0));
    return cover > 80 ? cover : 0;
  }

  function fitFrame() {
    const view = window.visualViewport;
    const shell = document.querySelector(".shell");
    if (!view || !shell) return;
    const top = Math.round(view.offsetTop || 0);
    document.body.style.top = "0px";
    document.body.style.bottom = "0px";
    document.body.style.height = "auto";
    shell.style.top = top + "px";
    shell.style.bottom = "0px";
    shell.style.height = "auto";
    const chat = $("screenChat");
    const cover = keyboardOverlap(window.innerHeight, view.height, top);
    if (chat) {
      chat.classList.toggle("is-keyboard", cover > 0);
      if (cover) chat.style.setProperty("--keyboard", cover + "px");
      else chat.style.removeProperty("--keyboard");
    }
    const thread = $("chatBody");
    const form = $("chatCompose");
    if (cover && thread && form && !form.hidden) thread.scrollTop = thread.scrollHeight;
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
    window.addEventListener("resize", fitFrame);
  }

  function paintSystemBar(name) {
    let screen = name;
    if (!screen) {
      const visible = document.querySelector("[data-screen]:not([hidden])");
      screen = visible ? visible.getAttribute("data-screen") : "";
    }
    const splash = screen === "splash";
    const entry = splash || screen === "login" || screen === "mfa";
    const color = splash ? "#FFFFFF" : entry ? "#FBF7F2" : "#1E5AA3";
    const nudge = splash ? "#F4F4F4" : entry ? "#F7F1E8" : "#1A5296";
    const nodes = document.querySelectorAll('meta[name="theme-color"]');
    nodes.forEach((node) => node.setAttribute("content", nudge));
    requestAnimationFrame(() => {
      nodes.forEach((node) => node.setAttribute("content", color));
    });
  }

  function show(name) {
    closeDocument();
    document.querySelectorAll("[data-screen]").forEach((node) => {
      node.hidden = node.getAttribute("data-screen") !== name;
    });
    const app = name === "home" || name === "customers" || name === "report" || name === "profile" || name === "alerts" || name === "reports" || name === "leadsDay" || name === "tasks" || name === "meetings" || name === "documents" || name === "newCustomer" || name === "reminder" || name === "chat";
    if (name !== "home") {
      const menu = $("homeMenu");
      const opener = $("btnMenu");
      if (menu) menu.hidden = true;
      if (opener) opener.setAttribute("aria-expanded", "false");
    }
    $("tabbar").hidden = !app;
    if (name !== "customer") closeFolioMenu();
    if (name !== "tasks") closeTaskAdd();
    if (name !== "chat") stopPhoneChat();
    if (name !== "splash" && name !== "account") stopHiddenCamera();
    if (name === "splash") paintFaceButton();
    document.querySelectorAll(".tab").forEach((tab) => {
      const key = tab.getAttribute("data-tab");
      const homeOn = (name === "home" || name === "profile" || name === "chat") && key === "home";
      const customersOn = (name === "customers" || name === "newCustomer") && key === "customers";
      const leadsOn = name === "leadsDay" && key === "leads";
      const tasksOn = (name === "tasks" || name === "reminder") && key === "tasks";
      const meetingsOn = name === "meetings" && key === "meetings";
      tab.classList.toggle("is-on", homeOn || customersOn || leadsOn || tasksOn || meetingsOn);
    });
    if (state.activityTimer) {
      window.clearInterval(state.activityTimer);
      state.activityTimer = 0;
    }
    if (state.homeTimer) {
      window.clearInterval(state.homeTimer);
      state.homeTimer = 0;
    }
    if (name === "activity") {
      state.activityTimer = window.setInterval(() => { void refreshActivity(); }, 8000);
    }
    if (name === "home") {
      const homeBody = document.querySelector("#screenHome .homeBody");
      if (homeBody) homeBody.scrollTop = 0;
    }
    if (name === "home" && state.profile) {
      void refreshHomeMetrics();
      state.homeTimer = window.setInterval(() => { void refreshHomeMetrics(); }, 10000);
    }
    if (name === "splash") playSplash();
    else paintSystemBar(name);
  }

  let splashToken = 0;
  function playSplash() {
    const splash = $("screenSplash");
    if (!splash) return;
    paintSystemBar("splash");
    const token = ++splashToken;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    splash.classList.remove("is-on");
    if (reduced) {
      splash.classList.add("is-on");
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (token !== splashToken) return;
        splash.classList.add("is-on");
      });
    });
  }

  function setBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
  }

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(loginMessage(""))), ms);
      Promise.resolve(promise).then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      }, (err) => {
        window.clearTimeout(timer);
        reject(err);
      });
    });
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

  function readStoredProfile() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch (_err) { stored = null; }
    if (stored && stored.id && ALLOWED[stored.role]) return stored;
    try { stored = JSON.parse(sessionStorage.getItem(PROFILE_KEY) || "null"); } catch (_err) { stored = null; }
    if (stored && stored.id && ALLOWED[stored.role]) {
      try { localStorage.setItem(PROFILE_KEY, JSON.stringify(stored)); } catch (_err) {}
      return stored;
    }
    return null;
  }

  function writeStoredProfile(profile) {
    const raw = JSON.stringify(profile);
    try { localStorage.setItem(PROFILE_KEY, raw); } catch (_err) {}
    try { sessionStorage.setItem(PROFILE_KEY, raw); } catch (_err) {}
  }

  function clearStoredProfile() {
    try { localStorage.removeItem(PROFILE_KEY); } catch (_err) {}
    try { sessionStorage.removeItem(PROFILE_KEY); } catch (_err) {}
  }

  async function signOut() {
    state.profile = null;
    state.scope = null;
    state.scopeReady = false;
    state.factorId = "";
    state.report = null;
    state.companies = null;
    if (state.activityTimer) window.clearInterval(state.activityTimer);
    if (state.alertTimer) window.clearInterval(state.alertTimer);
    if (state.homeTimer) window.clearInterval(state.homeTimer);
    state.activityTimer = 0;
    state.alertTimer = 0;
    state.homeTimer = 0;
    state.homeBusy = false;
    stopSaleWatch();
    stopChatBadge();
    clearStoredProfile();
    try { localStorage.removeItem(FACE_PASS_KEY); } catch (_err) {}
    try { await sb.auth.signOut(); } catch (_err) {}
  }

  async function assurance() {
    const res = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    return trim(res?.data?.currentLevel);
  }

  async function openSession(username, pin) {
    try { localStorage.removeItem(FACE_PASS_KEY); } catch (_err) {}
    const res = await fetch(SUPABASE_URL + "/functions/v1/gi-open-agent-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY
      },
      body: JSON.stringify({ username: username, pin: pin }),
      signal: AbortSignal.timeout(20000)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data || data.ok !== true || !data.access_token) {
      throw new Error(loginMessage(data && data.error));
    }
    const role = roleKey(data.role);
    if (!ALLOWED[role]) {
      throw new Error("האפליקציה פתוחה למנהל, לנציג ולמנהל צוות בלבד.");
    }
    const set = await withTimeout(sb.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token || ""
    }), 20000);
    if (set.error) throw new Error("לא הצלחתי לפתוח את האימות הדו־שלבי. הכניסה נעצרה.");
    state.profile = {
      id: trim(data.agentId),
      name: trim(data.agentName) || username,
      username: username,
      role: role
    };
    const listed = await withTimeout(sb.auth.mfa.listFactors(), 20000);
    if (listed.error) throw new Error("לא הצלחתי להכין את האימות הדו־שלבי לכניסה");
    const totp = (listed.data && listed.data.totp) || [];
    const factor = totp.find((item) => trim(item.status).toLowerCase() === "verified");
    if (!factor || !factor.id) {
      await signOut();
      throw new Error("האימות הדו־שלבי לא מוגדר במערכת. לא נוצר אימות חדש.");
    }
    state.factorId = factor.id;
  }

  async function openFaceSession(enrolled, desktopSecret) {
    const res = await fetch(SUPABASE_URL + "/functions/v1/gi-open-agent-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY
      },
      body: JSON.stringify({
        agentId: enrolled.id,
        username: enrolled.username,
        desktopSecret: desktopSecret
      }),
      signal: AbortSignal.timeout(20000)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data || data.ok !== true || !data.access_token) {
      const err = new Error(data && data.error === "FACE_AUTH_FAILED" ? "הפנים לא זוהו." : "הזיהוי לא אושר");
      err.code = (data && data.error) || "SESSION_OPEN_FAILED";
      throw err;
    }
    const role = roleKey(data.role || enrolled.role);
    if (!ALLOWED[role]) throw new Error("האפליקציה פתוחה למנהל, לנציג ולמנהל צוות בלבד.");
    const set = await withTimeout(sb.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token || ""
    }), 20000);
    if (set.error) throw new Error("לא הצלחתי לפתוח את הכניסה אחרי זיהוי הפנים.");
    state.profile = {
      id: trim(data.agentId) || trim(enrolled.id),
      name: trim(data.agentName) || trim(enrolled.name),
      username: trim(enrolled.username),
      role: role
    };
    writeStoredProfile(state.profile);
    try { localStorage.setItem(FACE_PASS_KEY, state.profile.id); } catch (_err) {}
  }

  function readFaceEnrollment() {
    try {
      const data = JSON.parse(localStorage.getItem(FACE_KEY) || "null");
      if (!data || (!trim(data.id) && !trim(data.username))) return null;
      return data;
    } catch (_err) {
      return null;
    }
  }

  function writeFaceEnrollment(profile) {
    const row = {
      id: trim(profile && profile.id),
      name: trim(profile && profile.name),
      username: trim(profile && profile.username),
      role: trim(profile && profile.role)
    };
    try { localStorage.setItem(FACE_KEY, JSON.stringify(row)); } catch (_err) {}
  }

  function paintFaceButton() {
    const btn = $("btnFace");
    if (!btn) return;
    btn.hidden = !readFaceEnrollment();
    btn.disabled = false;
    btn.textContent = "כניסה ביומטרית";
    if (!btn.hidden) void loadFaceModels().catch(() => {});
  }

  async function faceCall(payload) {
    const res = await fetch(SUPABASE_URL + "/functions/v1/gi-face-auth", {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const err = new Error(data.error || ("HTTP_" + res.status));
      err.code = data.error || "";
      throw err;
    }
    return data;
  }

  function faceDeviceLabel() {
    const s = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(s)) return "iPhone";
    if (/Android/i.test(s)) return "Android";
    return "טלפון";
  }

  function faceSignal(err) {
    const coded = err && typeof err.code === "string" ? err.code : "";
    const named = err && typeof err.name === "string" ? err.name : "";
    const message = err && typeof err.message === "string" ? err.message : "";
    return coded || (named && named !== "Error" ? named : "") || message;
  }

  function faceErrorText(err) {
    const code = faceSignal(err);
    const message = err && typeof err.message === "string" ? err.message : "";
    if (code === "NO_FACE") return "לא זוהו פנים. נסו שוב מול המצלמה.";
    if (code === "NO_MATCH" || code === "denied" || code === "FACE_AUTH_FAILED") return "הפנים לא זוהו.";
    if (code === "LIVENESS") return "החזיקו את הפנים ישר מול המסך ונסו שוב.";
    if (code === "BAD_DESCRIPTORS" || code === "MODEL") return "זיהוי הפנים לא הושלם. נסו שוב מול המצלמה.";
    if (code === "NotAllowedError" || code === "PermissionDeniedError" || code === "SecurityError" || code.indexOf("Permission") >= 0) return "יש לאפשר מצלמה כדי לסרוק פנים.";
    if (code === "CAMERA" || code === "NotFoundError" || code === "NotReadableError" || code === "OverconstrainedError") return "לא נפתחה המצלמה. אשרו הרשאה ונסו שוב.";
    if (code === "EXPIRED" || code === "SESSION_CLOSED") return "הסריקה פגה. נסו שוב.";
    if (code.indexOf("HTTP_") === 0 || code === "TypeError" || message === "Failed to fetch") return "אין חיבור לזיהוי. בדקו רשת ונסו שוב.";
    if (message && /[\u0590-\u05FF]/.test(message)) return message;
    return "הכניסה הביומטרית לא הושלמה.";
  }

  let faceModels = null;
  const faceScan = { busy: false, secret: "", token: "", descriptors: [], mode: "", retry: false, closed: false };
  let faceRun = 0;

  async function loadFaceModels() {
    if (faceModels) return faceModels;
    const faceapi = await import("https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.esm.js");
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(FACE_MODEL),
      faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL)
    ]);
    faceModels = faceapi;
    return faceapi;
  }

  function faceTimeout(promise, ms, code) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        const err = new Error(code);
        err.code = code;
        reject(err);
      }, ms);
      Promise.resolve(promise).then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      }, (err) => {
        window.clearTimeout(timer);
        reject(err);
      });
    });
  }

  function armQuietCamera() {
    const stage = $("faceStage");
    if (!stage) return;
    stage.classList.add("faceStage--quiet");
    stage.hidden = false;
  }

  async function openHiddenCamera() {
    const cam = $("faceCam");
    if (!cam || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = new Error("CAMERA");
      err.code = "CAMERA";
      throw err;
    }
    const stage = $("faceStage");
    const enroll = stage && !stage.hidden && !stage.classList.contains("faceStage--quiet");
    if (!enroll) armQuietCamera();
    let stream = cam.srcObject || null;
    const live = stream && stream.getVideoTracks && stream.getVideoTracks().some((track) => track.readyState === "live");
    if (!live) {
      const attempts = [
        { video: { facingMode: { ideal: "user" }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
        { video: { facingMode: "user" }, audio: false },
        { video: true, audio: false }
      ];
      stream = null;
      let lastErr = null;
      for (let i = 0; i < attempts.length; i += 1) {
        const streamPromise = navigator.mediaDevices.getUserMedia(attempts[i]);
        try {
          stream = await faceTimeout(streamPromise, 10000, "CAMERA");
          break;
        } catch (err) {
          streamPromise.then((opened) => {
            try { opened.getTracks().forEach((track) => track.stop()); } catch (_stop) {}
          }).catch(() => {});
          lastErr = err;
          const name = faceSignal(err);
          if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError" || name === "CAMERA") throw err;
        }
      }
      if (!stream) throw lastErr || Object.assign(new Error("CAMERA"), { code: "CAMERA" });
      if (faceScan.closed) {
        try { stream.getTracks().forEach((track) => track.stop()); } catch (_stop) {}
        const cancelled = new Error("CANCELLED");
        cancelled.code = "CANCELLED";
        throw cancelled;
      }
      cam.srcObject = stream;
    }
    cam.muted = true;
    cam.playsInline = true;
    cam.setAttribute("playsinline", "");
    cam.setAttribute("autoplay", "");
    const track = stream && stream.getVideoTracks && stream.getVideoTracks()[0];
    if (track && track.applyConstraints) {
      try { await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }); } catch (_focus) {}
    }
    await Promise.race([
      cam.play().catch(() => {}),
      new Promise((resolve) => window.setTimeout(resolve, 1200))
    ]);
    const startedAt = cam.currentTime || 0;
    const waitBegan = Date.now();
    while (Date.now() - waitBegan < 4000) {
      if (cam.videoWidth > 0 && (cam.currentTime || 0) > startedAt) break;
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
    if (!(cam.videoWidth > 0) || !((cam.currentTime || 0) > startedAt)) {
      const err = new Error("CAMERA");
      err.code = "CAMERA";
      throw err;
    }
    return cam;
  }

  function showFaceStage(mode) {
    const stage = $("faceStage");
    if (!stage) return;
    faceScan.mode = mode;
    faceScan.retry = false;
    stage.classList.remove("faceStage--quiet");
    stage.hidden = false;
    const approve = $("faceStageApprove");
    if (approve) {
      approve.hidden = mode === "login";
      approve.disabled = mode !== "login";
      approve.textContent = "אישור כניסה ביומטרית";
    }
  }

  function setFaceSeen(on) {
    const ring = document.querySelector(".faceStage__ring");
    if (ring) ring.classList.toggle("faceStage__ring--hit", !!on);
  }

  function hideFaceStage() {
    const stage = $("faceStage");
    setFaceSeen(false);
    if (!stage) return;
    stage.classList.remove("faceStage--quiet");
    stage.hidden = true;
  }

  function faceStageText(text) {
    const node = $("faceStageStatus");
    if (node) node.textContent = text || "";
    faceStatus(text);
  }

  function faceOfferRetry(text) {
    faceScan.retry = true;
    faceStageText(text);
    const approve = $("faceStageApprove");
    if (!approve) return;
    approve.hidden = false;
    approve.disabled = false;
    approve.textContent = "סריקה מחדש";
  }

  function stopHiddenCamera() {
    hideFaceStage();
    const cam = $("faceCam");
    if (!cam) return;
    const stream = cam.srcObject;
    if (stream && stream.getTracks) stream.getTracks().forEach((track) => { try { track.stop(); } catch (_err) {} });
    cam.srcObject = null;
  }

  async function detectFaceSample(cam) {
    const faceapi = faceModels;
    if (!faceapi) {
      const err = new Error("MODEL");
      err.code = "MODEL";
      throw err;
    }
    if (!cam || !(cam.videoWidth > 0)) return null;
    const det = await faceapi
      .detectSingleFace(cam, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.38 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();
    if (!det || !det.descriptor) return null;
    const score = Number(det.detection && det.detection.score);
    if (!(score >= 0.42)) return null;
    const box = det.detection && det.detection.box;
    return {
      descriptor: Array.from(det.descriptor),
      score: score,
      box: box ? {
        x: Number(box.x) || 0,
        y: Number(box.y) || 0,
        width: Number(box.width) || 0,
        height: Number(box.height) || 0
      } : null
    };
  }

  async function detectFaceOnce(cam) {
    const sample = await detectFaceSample(cam);
    if (!sample || sample.score < 0.48) return null;
    return sample.descriptor;
  }

  async function captureFace(timeoutMs, confirmTwice) {
    const cam = $("faceCam");
    const started = Date.now();
    const requested = Number(timeoutMs);
    const limit = Number.isFinite(requested) && requested > 0 ? requested : 12000;
    while (Date.now() - started < limit) {
      if (faceScan.closed) {
        const cancelled = new Error("CANCELLED");
        cancelled.code = "CANCELLED";
        throw cancelled;
      }
      try {
        const desc = await detectFaceOnce(cam);
        if (desc && !confirmTwice) return desc;
        if (desc) {
          await new Promise((resolve) => window.setTimeout(resolve, 60));
          const again = await detectFaceOnce(cam);
          if (again) return again;
        }
      } catch (err) {
        if (err && err.code === "CANCELLED") throw err;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 70));
    }
    const err = new Error("NO_FACE");
    err.code = "NO_FACE";
    throw err;
  }

  async function faceCancelQuiet(secret) {
    if (!secret) return;
    try { await faceCall({ action: "cancel", desktopSecret: secret }); } catch (_err) {}
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
    writeStoredProfile(state.profile);
  }

  function aliasList(aliases, id) {
    const entry = mapValue(aliases, id);
    if (Array.isArray(entry)) return entry.map(trim).filter(Boolean);
    const text = trim(entry);
    return text ? text.split(",").map(trim).filter(Boolean) : [];
  }

  async function teamRoster(profile) {
    const meta = await sb.from("app_meta").select("assigns:payload->teamManagerAssignments,aliases:payload->agentReportAliases").eq("key", "global").maybeSingle();
    if (meta.error) throw new Error(meta.error.message || "team");
    const assigns = asObject(meta.data && meta.data.assigns);
    const aliases = asObject(meta.data && meta.data.aliases);
    const team = await sb.from("agents").select("id,name,username,role,active").eq("team_manager_id", profile.id).limit(200);
    if (team.error) throw new Error(team.error.message || "team");
    const rows = (team.data || []).slice();
    const seen = new Set(rows.map((row) => trim(row.id)).filter(Boolean));
    const assigned = mapValue(assigns, profile.id);
    const assignedIds = (Array.isArray(assigned) ? assigned : []).map(trim).filter((id) => id && id !== profile.id);
    const extraIds = assignedIds.filter((id) => !seen.has(id));
    if (extraIds.length) {
      const extra = await sb.from("agents").select("id,name,username,role,active").in("id", extraIds.slice(0, 200));
      if (extra.error) throw new Error(extra.error.message || "team");
      (extra.data || []).forEach((row) => rows.push(row));
    }
    return { rows: rows, aliases: aliases, assignedIds: new Set(assignedIds) };
  }

  async function loadScope() {
    if (state.scopeReady) return state.scope;
    const profile = state.profile;
    if (!profile) return null;
    if (profile.role === "manager" || profile.role === "admin") {
      state.scope = null;
      state.scopeReady = true;
      return null;
    }
    const ids = [profile.id].filter(Boolean);
    const names = [profile.name, profile.username].map(trim).filter(Boolean);
    let ready = true;
    if (profile.role === "teammanager" && profile.id) {
      try {
        const roster = await teamRoster(profile);
        roster.rows.forEach((row) => {
          const id = trim(row.id);
          if (!id || id === profile.id || row.active === false) return;
          if (roleKey(row.role) !== "agent" && !roster.assignedIds.has(id)) return;
          if (ids.indexOf(id) < 0) ids.push(id);
          if (trim(row.name)) names.push(trim(row.name));
          if (trim(row.username)) names.push(trim(row.username));
          aliasList(roster.aliases, id).forEach((name) => names.push(name));
        });
        aliasList(roster.aliases, profile.id).forEach((name) => names.push(name));
      } catch (_err) {
        ready = false;
      }
    }
    const unique = [...new Set(names)];
    state.scope = {
      ids: ids,
      names: unique,
      tokens: new Set(unique.map(token)),
      tokenLists: unique.map((name) => token(name).split(" ").filter(Boolean))
    };
    state.scopeReady = ready;
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

  async function loadNet(range) {
    const res = await sb.rpc("gi_dashboard_net_premium", scopeArgs(range));
    if (res.error) throw new Error(res.error.message || "sold");
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    return Number(row && (row.net_premium != null ? row.net_premium : row.netPremium)) || 0;
  }

  async function countCustomers(withPolicies) {
    let query = sb.from("customers").select("id", { count: "exact", head: true }).eq("is_archived", false);
    if (state.scope) query = query.in("agent_id", state.scope.ids);
    if (withPolicies) query = query.or("new_policies_count.gt.0,existing_policies_count.gt.0");
    const res = await query;
    if (res.error) throw new Error(res.error.message || "customers");
    return Number(res.count) || 0;
  }

  async function countPolicies() {
    let total = 0;
    let from = 0;
    const page = 400;
    for (let i = 0; i < 8; i += 1) {
      let query = sb.from("customers")
        .select("new_policies_count,existing_policies_count")
        .eq("is_archived", false)
        .range(from, from + page - 1);
      if (state.scope) query = query.in("agent_id", state.scope.ids);
      const res = await query;
      if (res.error) throw new Error(res.error.message || "policies");
      const rows = res.data || [];
      rows.forEach((row) => {
        total += (Number(row.new_policies_count) || 0) + (Number(row.existing_policies_count) || 0);
      });
      if (rows.length < page) break;
      from += page;
    }
    return total;
  }

  async function loadCompanies() {
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

  async function countIncomingLeads() {
    const range = israelRange();
    let query = sb.from("campaign_leads").select("id", { count: "exact", head: true })
      .gte("created_at", range.start)
      .lt("created_at", range.end)
      .not("assigned_agent_id", "is", null)
      .neq("assigned_agent_id", "");
    if (state.scope) query = query.in("assigned_agent_id", state.scope.ids);
    const res = await query;
    if (res.error) throw new Error(res.error.message || "incoming leads");
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
    if (!key || !state.scope.tokens) return false;
    if (state.scope.tokens.has(key)) return true;
    const parts = key.split(" ").filter(Boolean);
    if (parts.length < 2) return false;
    return (state.scope.tokenLists || []).some((list) => parts.every((part) => list.indexOf(part) >= 0));
  }

  async function loadReport(force) {
    if (state.report && !force) return state.report;
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
      .select("id,full_name,id_number,phone,email,status,is_archived,agent_id,new_policies_count,existing_policies_count,created_at")
      .order("created_at", { ascending: false })
      .limit(q ? 20 : 40);
    if (state.scope) query = query.in("agent_id", state.scope.ids);
    query = query.eq("is_archived", false);
    if (q) {
      const safe = q.replace(/[%_,.()]/g, " ").trim();
      const digits = q.replace(/\D/g, "");
      const parts = [];
      if (safe) {
        parts.push("full_name.ilike.%" + safe + "%");
        parts.push("email.ilike.%" + safe + "%");
      }
      if (digits.length >= 2) {
        parts.push("id_number.ilike.%" + digits + "%");
        parts.push("phone.ilike.%" + digits + "%");
      }
      if (!parts.length) return [];
      query = query.or(parts.join(","));
    }
    const res = await query;
    if (res.error) throw new Error(res.error.message || "customers");
    return (res.data || []).slice(0, q ? 20 : 10);
  }

  function customerTone(row) {
    const bucket = customerBucket(row);
    if (bucket === "archive") return { label: "לא פעיל", cls: "is-arch" };
    if (bucket === "pending") return { label: "ממתין", cls: "is-wait" };
    if (stampDateIL(row.created_at) === israelDateKey()) return { label: "חדש", cls: "is-info" };
    return { label: "פעיל", cls: "is-ok" };
  }

  function paintCustomers(rows) {
    const host = $("customerList");
    const shown = rows || [];
    if (!shown.length) {
      host.innerHTML = '<div class="empty">אין לקוחות להצגה</div>';
      return;
    }
    const branchView = { "סיכונים": ["פרט", "custBranch--prat"], "בריאות": ["בריאות", "custBranch--health"], "אלמנטרי": ["אלמנטרי", "custBranch--elem"], "פנסיה": ["פנסיה", "custBranch--pensia"] };
    host.innerHTML = shown.map((row) => {
      const name = trim(row.full_name) || "לקוח";
      const phone = trim(row.phone);
      const tags = (row.branches || []).map((sector) => {
        const view = branchView[sector];
        return view ? '<span class="custBranch ' + view[1] + '">' + esc(view[0]) + "</span>" : "";
      }).join("");
      return '<button class="cust" type="button" data-customer="' + esc(row.id) + '"><span class="cust__mark">' + esc(name.slice(0, 1)) + '</span><div class="cust__main"><div class="cust__name">' + esc(name) + "</div>" + (phone ? '<div class="cust__phone">' + esc(phone) + "</div>" : "") + '</div><span class="cust__branches">' + tags + "</span></button>";
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

  function rowsForAgentTotals(report) {
    if (!report) return [];
    const agent = $("filterAgent").value;
    if (!agent) return report.rows;
    return report.rows.filter((row) => token(row.agent) === token(agent));
  }

  function paintReport() {
    const report = state.report;
    const stats = reportStats({
      rows: rowsForAgentTotals(report),
      cols: report ? report.cols : { status: -1 }
    });
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

  function positive(value) {
    const n = Number(String(value == null ? "" : value).replace(/[₪\s,]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function policyMonthly(policy) {
    if (!policy || typeof policy !== "object") return 0;
    const sim = policy.simDiscountPerInsured;
    if (sim && typeof sim === "object") {
      let sum = 0;
      let any = false;
      Object.keys(sim).forEach((key) => {
        const n = positive(sim[key] && sim[key].monthlyAfterDiscount);
        if (n > 0) { sum += n; any = true; }
      });
      if (any) return Math.round(sum * 100) / 100;
    }
    if (trim(policy.type) === "בריאות" && (policy.coverDiscountsApplied === true || policy.coverDiscountsApplied === "true")) {
      const cover = positive(policy.premiumAfterCoverDiscounts);
      if (cover > 0) return cover;
    }
    const fields = ["premiumAfterDiscountValue", "premiumAfterDiscount", "monthlyPremium", "premiumMonthly", "premiumValue", "premium"];
    for (let i = 0; i < fields.length; i += 1) {
      const n = positive(policy[fields[i]]);
      if (n > 0) return n;
    }
    return 0;
  }

  function policyRows(payload) {
    const root = payload && typeof payload === "object" ? payload : {};
    const fresh = Array.isArray(root.newPolicies) && root.newPolicies.length
      ? root.newPolicies
      : (root.operational && Array.isArray(root.operational.newPolicies) ? root.operational.newPolicies : []);
    const elementary = Array.isArray(root.elementaryPolicies) ? root.elementaryPolicies : [];
    const rows = [];
    const seen = new Set();
    fresh.concat(elementary).forEach((policy) => {
      if (!policy || typeof policy !== "object" || trim(policy.origin) === "existing") return;
      const id = trim(policy.id);
      if (id && seen.has(id)) return;
      if (id) seen.add(id);
      rows.push(policy);
    });
    return rows;
  }

  function policyTitle(policy) {
    return trim(policy.type) || trim(policy.product) || trim(policy.name) || trim(policy.planName) || "פוליסה";
  }

  function policySub(policy, title) {
    const company = trim(policy.company) || trim(policy.insurer) || trim(policy.companyName);
    const kind = trim(policy.product) || trim(policy.plan) || trim(policy.category);
    const extra = kind && kind !== title ? kind : "";
    if (company && extra) return company + " | " + extra;
    return company || extra;
  }

  function policyTone(title) {
    if (/בריאות/.test(title)) return "#3870ED";
    if (/חיים/.test(title)) return "#16A34A";
    if (/נכות|אובדן|כושר/.test(title)) return "#7C5CD6";
    if (/פנס|גמל|השתלמות|חיסכון/.test(title)) return "#3870ED";
    return "#0F9F8F";
  }

  function policyIcon(title) {
    if (/בריאות/.test(title)) return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z"/></svg>';
    if (/חיים/.test(title)) return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 5 6v6c0 4.2 2.8 7.2 7 9 4.2-1.8 7-4.8 7-9V6z"/></svg>';
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>';
  }

  async function loadCustomerFile(id) {
    let query = sb.from("customers")
      .select("id,full_name,id_number,phone,email,status,is_archived,agent_id,agent_name,created_at,payload")
      .eq("id", id)
      .limit(1);
    if (state.scope) query = query.in("agent_id", state.scope.ids);
    const res = await query.maybeSingle();
    if (res.error) throw new Error(res.error.message || "customer");
    return res.data || null;
  }

  function showDate(value) {
    const raw = trim(value);
    if (!raw) return "";
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[3] + "." + iso[2] + "." + iso[1];
    const dmy = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (dmy) return dmy[1].padStart(2, "0") + "." + dmy[2].padStart(2, "0") + "." + dmy[3];
    return raw;
  }

  function customerDocs(payload) {
    const list = payload && Array.isArray(payload.customerDocuments) ? payload.customerDocuments : [];
    return list.filter((doc) => doc && typeof doc === "object");
  }

  function docTitle(doc) {
    const name = trim(doc.name) || trim(doc.fileName) || trim(doc.originalFileName);
    if (name) return name;
    const type = trim(doc.type);
    const labels = {
      operational_report_health: "דוח תפעולי",
      operational_report_agent_appointment: "דוח תפעולי",
      har_bituach_file: "הר הביטוח",
      suitability_document: "הצהרת התאמה",
      nispah_he_har_auth: "הצהרת ביטוח",
      customer_arrival_pack: "מסמכי הגעה",
      premium_development_report: "דוח התפתחות פרמיה",
      company_cancel_form: "טופס ביטול",
      agent_appointment_form: "טופס מינוי סוכן"
    };
    return labels[type] || "מסמך";
  }

  function fileHref(file) {
    if (!file || typeof file !== "object") return "";
    const data = trim(file.dataUrl) || trim(file.data) || trim(file.base64);
    if (data.indexOf("data:") === 0) return data;
    const url = trim(file.url);
    if (url.indexOf("data:") === 0 || /^https?:/i.test(url)) return url;
    return "";
  }

  function filePath(file) {
    return trim(file && (file.storagePath || file.storage_path));
  }

  function saveBlob(blob, filename) {
    const name = filename || "document";
    const file = typeof File === "function" ? new File([blob], name, { type: (blob && blob.type) || "application/octet-stream" }) : null;
    if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch((err) => {
        if (err && err.name === "AbortError") return;
        saveBlobAnchor(blob, name);
      });
      return;
    }
    saveBlobAnchor(blob, name);
  }

  function saveBlobAnchor(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "document";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function fileBlob(file) {
    const href = fileHref(file);
    if (href && href.indexOf("data:") === 0) {
      const res = await fetch(href);
      if (!res.ok) throw new Error("לא ניתן לפתוח את הקובץ");
      return await res.blob();
    }
    const path = filePath(file);
    if (path) {
      const bucket = trim(file.storageBucket || file.storage_bucket) || "gi-customer-files";
      const res = await sb.storage.from(bucket).download(path);
      if (!res.error && res.data) return res.data;
      if (!href) throw new Error("לא ניתן לפתוח את הקובץ");
    }
    if (href) {
      const res = await fetch(href);
      if (!res.ok) throw new Error("לא ניתן לפתוח את הקובץ");
      return await res.blob();
    }
    const err = new Error("אין קובץ שמור");
    err.code = "nofile";
    throw err;
  }

  async function sniffMime(blob, name, hinted) {
    const hint = trim(hinted);
    if (hint && hint !== "application/octet-stream") return hint;
    const given = trim(blob && blob.type);
    if (given && given !== "application/octet-stream") return given;
    const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return "application/pdf";
    if (head[0] === 0xff && head[1] === 0xd8) return "image/jpeg";
    if (head[0] === 0x89 && head[1] === 0x50) return "image/png";
    if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return "image/gif";
    if (/\.pdf$/i.test(name)) return "application/pdf";
    if (/\.png$/i.test(name)) return "image/png";
    if (/\.jpe?g$/i.test(name)) return "image/jpeg";
    if (/\.webp$/i.test(name)) return "image/webp";
    if (/\.html?$/i.test(name)) return "text/html";
    if (/\.txt$/i.test(name)) return "text/plain";
    return given || "";
  }

  let pdfLibPromise = null;

  function loadPdfLib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfLibPromise) return pdfLibPromise;
    pdfLibPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
      script.onload = () => {
        if (!window.pdfjsLib) {
          pdfLibPromise = null;
          reject(new Error("pdf"));
          return;
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      };
      script.onerror = () => {
        pdfLibPromise = null;
        reject(new Error("pdf"));
      };
      document.head.appendChild(script);
    });
    return pdfLibPromise;
  }

  async function paintPdfPages(body, blob, token) {
    const lib = await loadPdfLib();
    if (token !== docToken) return;
    const data = new Uint8Array(await blob.arrayBuffer());
    if (token !== docToken) return;
    const pdf = await lib.getDocument({ data: data }).promise;
    if (token !== docToken) return;
    const wrap = document.createElement("div");
    wrap.className = "docPages";
    body.replaceChildren(wrap);
    if (body.clientWidth < 40) await new Promise((resolve) => requestAnimationFrame(resolve));
    const width = Math.max(280, body.clientWidth - 24);
    const pixel = Math.min(window.devicePixelRatio || 1, 2);
    for (let i = 1; i <= pdf.numPages; i += 1) {
      if (token !== docToken) return;
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (width / base.width) * pixel });
      const canvas = document.createElement("canvas");
      canvas.className = "docPage";
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d", { alpha: false });
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      if (token !== docToken) return;
      wrap.appendChild(canvas);
    }
  }

  let sheetLibPromise = null;

  function isSpreadsheet(mime, name, type) {
    if (trim(type) === "har_bituach_file") return true;
    const hint = (trim(mime) + " " + trim(name)).toLowerCase();
    return /spreadsheet|excel|\.xlsx|\.xls|\.csv|text\/csv/.test(hint);
  }

  function loadSheetLib() {
    if (window.XLSX && window.XLSX.read && window.XLSX.utils) return Promise.resolve(window.XLSX);
    if (sheetLibPromise) return sheetLibPromise;
    sheetLibPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.onload = () => {
        if (!window.XLSX || !window.XLSX.read) {
          sheetLibPromise = null;
          reject(new Error("sheet"));
          return;
        }
        resolve(window.XLSX);
      };
      script.onerror = () => {
        sheetLibPromise = null;
        reject(new Error("sheet"));
      };
      document.head.appendChild(script);
    });
    return sheetLibPromise;
  }

  function sheetTable(rows, sheetName) {
    const list = Array.isArray(rows) ? rows : [];
    const shown = list.slice(0, 800);
    const width = shown.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
    if (!width) return null;
    const block = document.createElement("section");
    block.className = "docGrid";
    if (trim(sheetName)) {
      const caption = document.createElement("h2");
      caption.className = "docGrid__name";
      caption.textContent = sheetName;
      block.appendChild(caption);
    }
    const scroller = document.createElement("div");
    scroller.className = "docGrid__scroll";
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const body = document.createElement("tbody");
    const fill = (row) => {
      const cells = Array.isArray(row) ? row.slice(0, 40) : [];
      while (cells.length < Math.min(width, 40)) cells.push("");
      return cells;
    };
    shown.forEach((row, index) => {
      const tr = document.createElement("tr");
      fill(row).forEach((value) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        cell.textContent = value == null ? "" : String(value);
        tr.appendChild(cell);
      });
      if (index === 0) head.appendChild(tr);
      else body.appendChild(tr);
    });
    table.appendChild(head);
    table.appendChild(body);
    scroller.appendChild(table);
    block.appendChild(scroller);
    if (list.length > shown.length) {
      const note = document.createElement("p");
      note.className = "docGrid__note";
      note.textContent = "מוצגות " + shown.length + " שורות ראשונות מתוך " + list.length;
      block.appendChild(note);
    }
    return block;
  }

  async function paintSpreadsheet(body, blob, token) {
    const lib = await loadSheetLib();
    if (token !== docToken) return false;
    const data = new Uint8Array(await blob.arrayBuffer());
    if (token !== docToken) return false;
    const book = lib.read(data, { type: "array", cellDates: true });
    const names = (book.SheetNames || []).filter((name) => trim(name) && trim(name) !== "_gi_har_origin");
    const wrap = document.createElement("div");
    wrap.className = "docPages";
    names.forEach((name) => {
      const rows = lib.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: "", raw: false, blankrows: false });
      const table = sheetTable(rows, names.length > 1 ? name : "");
      if (table) wrap.appendChild(table);
    });
    if (!wrap.childNodes.length) return false;
    if (token !== docToken) return false;
    body.replaceChildren(wrap);
    return true;
  }

  let docToken = 0;
  let docFitResize = null;

  function closeDocument() {
    docToken += 1;
    if (docFitResize) {
      window.removeEventListener("resize", docFitResize);
      docFitResize = null;
    }
    if (state.docUrl) URL.revokeObjectURL(state.docUrl);
    state.docUrl = "";
    state.docBlob = null;
    const view = $("docView");
    if (view) view.hidden = true;
  }

  function rewriteAssetUrl(raw) {
    let abs;
    try { abs = new URL(raw, location.href); } catch (err) { return raw; }
    const at = abs.pathname.indexOf("/phone/");
    if (at < 0) return typeof raw === "string" ? raw : abs.href;
    const tail = abs.pathname.slice(at + "/phone/".length);
    if (!/^(forms|fonts|assets)\//.test(tail)) return typeof raw === "string" ? raw : abs.href;
    abs.pathname = abs.pathname.slice(0, at + 1) + tail;
    return abs.href;
  }

  function installAssetFetch() {
    if (window.fetch && window.fetch.onyxAssets) return;
    const orig = window.fetch.bind(window);
    const wrapped = function (input, init) {
      if (typeof input === "string") return orig(rewriteAssetUrl(input), init);
      if (input && input.url) {
        const fixed = rewriteAssetUrl(input.url);
        if (fixed !== input.url) return orig(new Request(fixed, input), init);
      }
      return orig(input, init);
    };
    wrapped.onyxAssets = true;
    window.fetch = wrapped;
  }

  function loadScript(src) {
    const ready = document.querySelector('script[data-onyx-src="' + src + '"]');
    if (ready && ready.getAttribute("data-ready") === "1") return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.setAttribute("data-onyx-src", src);
      script.onload = () => {
        script.setAttribute("data-ready", "1");
        resolve();
      };
      script.onerror = () => reject(new Error("load"));
      document.head.appendChild(script);
    });
  }

  function installFormFill() {
    if (window.GI_OFFICIAL_FORM_FILL && window.GI_OFFICIAL_FORM_FILL.setTextSafe) return;
    window.GI_OFFICIAL_FORM_FILL = {
      FONT_FILE: "Heebo-Bold.ttf",
      FONT_SIZE: 10,
      visualHebrew(value) {
        const text = String(value == null ? "" : value);
        if (!/[\u0590-\u05FF]/.test(text)) return text;
        const parts = text.match(/[\u0590-\u05FF]+|[^\u0590-\u05FF]+/g) || [text];
        return parts.reverse().map((part) => /[\u0590-\u05FF]/.test(part) ? part.split("").reverse().join("") : part).join("");
      },
      setTextSafe(form, fieldName, value, font, opts) {
        const text = String(value == null ? "" : value).trim();
        if (!text || !form || !form.getTextField) return;
        const useVisual = !(opts && opts.visual === false);
        try {
          const field = form.getTextField(fieldName);
          const painted = (font && useVisual) ? this.visualHebrew(text) : text;
          const size = Number(opts && opts.fontSize) > 0 ? Number(opts.fontSize) : this.FONT_SIZE;
          if (opts && opts.multiline) {
            try { field.enableMultiline(); } catch (err) {}
          }
          field.setText(painted);
          try { field.setFontSize(size); } catch (err) {}
          if (font && field.updateAppearances) field.updateAppearances(font);
        } catch (err) {}
      }
    };
  }

  let pdfToolsPromise = null;
  function loadPdfTools() {
    if (window.PDFLib && window.fontkit) return Promise.resolve();
    if (pdfToolsPromise) return pdfToolsPromise;
    pdfToolsPromise = loadScript("https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js")
      .then(() => loadScript("https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.js"))
      .catch((err) => {
        pdfToolsPromise = null;
        throw err;
      });
    return pdfToolsPromise;
  }

  function repoScript(file) {
    return new URL("../" + file, location.href).href;
  }

  let followupPromise = null;
  function loadFollowup() {
    if (window.GiFollowupZip && window.GI_FOLLOWUP_ZIP_CONFIG) return Promise.resolve();
    if (followupPromise) return followupPromise;
    followupPromise = loadPdfTools()
      .then(() => loadScript(repoScript("gi-followup-zip-config.js")))
      .then(() => loadScript(repoScript("gi-followup-zip.js")))
      .then(() => installFormFill())
      .catch((err) => {
        followupPromise = null;
        throw err;
      });
    return followupPromise;
  }

  let cancelPromise = null;
  function loadCancelForms() {
    if (window.GiCancelForms) return Promise.resolve();
    if (cancelPromise) return cancelPromise;
    cancelPromise = loadPdfTools()
      .then(() => loadScript(repoScript("gi-cancel-forms.js")))
      .catch((err) => {
        cancelPromise = null;
        throw err;
      });
    return cancelPromise;
  }

  let arrivalPromise = null;
  function loadArrivalDocs() {
    if (window.GiArrivalDocs && window.GiArrivalDocs.buildDraft) return Promise.resolve();
    if (arrivalPromise) return arrivalPromise;
    arrivalPromise = loadPdfTools()
      .then(() => loadScript(repoScript("gi-arrival-docs.js")))
      .catch((err) => {
        arrivalPromise = null;
        throw err;
      });
    return arrivalPromise;
  }

  function pdfBlob(bytes, title) {
    return {
      blob: new Blob([bytes], { type: "application/pdf" }),
      name: (trim(title).replace(/\.\w+$/, "") || "document") + ".pdf"
    };
  }

  async function officialOriginal(file) {
    const type = trim(file && file.type);
    if (!type) return null;
    installAssetFetch();
    const rec = state.file;
    try {
      if (type === "followup_questionnaire") {
        await loadFollowup();
        const source = file.followupEntry && typeof file.followupEntry === "object" ? file.followupEntry : null;
        let entry = source ? Object.assign({}, source) : null;
        if (!entry && window.GiFollowupZip && rec) {
          const list = window.GiFollowupZip.resolveForCustomer(rec, { map: {}, insureds: [] }, []) || [];
          entry = list.find((row) => trim(row.company) === trim(file.company) && trim(row.questionnaireNum) === trim(file.questionnaireNo)) || null;
        }
        if (!entry) return null;
        if (!trim(entry.companyKey) && window.GI_FOLLOWUP_ZIP_CONFIG) {
          entry.companyKey = window.GI_FOLLOWUP_ZIP_CONFIG.companyKeyFromLabel(entry.company || file.company);
        }
        if (!trim(entry.questionnaireNum)) entry.questionnaireNum = trim(file.questionnaireNo);
        if (!trim(entry.companyKey) || !trim(entry.questionnaireNum)) return null;
        const bytes = await window.GiFollowupZip.fillFollowupPdf(entry);
        if (!bytes || !bytes.byteLength) return null;
        return pdfBlob(bytes, docTitle(file));
      }
      if (type === "company_cancel_form") {
        await loadCancelForms();
        if (!window.GiCancelForms || !rec) return null;
        const draft = window.GiCancelForms.buildDraft(rec, file);
        const bytes = await window.GiCancelForms.fillOriginalTemplate(draft);
        if (!bytes || !bytes.byteLength) return null;
        return pdfBlob(bytes, window.GiCancelForms.fileName(draft) || docTitle(file));
      }
      if (type === "suitability_document" || type === "premium_development_report" || type === "nispah_he_har_auth" || type === "customer_arrival_pack") {
        await loadArrivalDocs();
        if (!window.GiArrivalDocs || !rec) return null;
        const draft = window.GiArrivalDocs.buildDraft(rec);
        if (type === "nispah_he_har_auth") {
          const bytes = await window.GiArrivalDocs.fillNispahPdf(draft);
          if (!bytes || !bytes.byteLength) return null;
          return pdfBlob(bytes, "הצהרת ביטוח");
        }
        if (type === "customer_arrival_pack" && window.GiArrivalDocs.buildPackPdf) {
          try {
            const bytes = await window.GiArrivalDocs.buildPackPdf(draft, { includeDownloadStep: false });
            if (bytes && bytes.byteLength) return pdfBlob(bytes, "מסמכי הגעה");
          } catch (err) {}
        }
        const html = type === "premium_development_report"
          ? window.GiArrivalDocs.renderPremiaHtml(draft)
          : (type === "suitability_document" ? window.GiArrivalDocs.renderHatamaHtml(draft) : window.GiArrivalDocs.renderCombinedHtml(draft));
        if (!trim(html)) return null;
        return { blob: new Blob([html], { type: "text/html" }), name: (docTitle(file) || "document") + ".html" };
      }
    } catch (err) {
      return null;
    }
    return null;
  }

  function scopeFittedCss(cssText) {
    return String(cssText || "").replace(/:root/g, ":host").replace(/\bhtml\b/g, ":host").replace(/\bbody\b/g, ":host");
  }

  function paintFittedHtml(body, html, token) {
    const parsed = new DOMParser().parseFromString(String(html || ""), "text/html");
    parsed.querySelectorAll("script").forEach((node) => node.remove());
    const host = document.createElement("div");
    host.className = "docFit";
    const root = host.attachShadow({ mode: "open" });
    const sheet = document.createElement("div");
    sheet.className = "docFit__sheet";
    parsed.querySelectorAll("style").forEach((node) => {
      const style = document.createElement("style");
      style.textContent = scopeFittedCss(node.textContent);
      root.appendChild(style);
    });
    const fitStyle = document.createElement("style");
    fitStyle.textContent = ".docFit__sheet{box-sizing:border-box;width:210mm;transform-origin:top left;position:absolute;left:0;top:0}.docFit__html{direction:rtl}";
    root.appendChild(fitStyle);
    const page = document.createElement("div");
    page.className = "docFit__html";
    page.innerHTML = parsed.body ? parsed.body.innerHTML : "";
    page.querySelectorAll("script").forEach((node) => node.remove());
    page.querySelectorAll("[src]").forEach((node) => {
      const src = node.getAttribute("src");
      if (src) node.setAttribute("src", rewriteAssetUrl(src));
    });
    sheet.appendChild(page);
    root.appendChild(sheet);
    body.replaceChildren(host);
    const fit = () => {
      if (token !== docToken || !host.isConnected) return;
      const avail = body.clientWidth;
      if (avail < 40) return;
      sheet.style.transform = "none";
      sheet.style.width = "210mm";
      const wide = Math.max(sheet.scrollWidth, sheet.offsetWidth);
      const tall = Math.max(sheet.scrollHeight, sheet.offsetHeight);
      if (wide < 8 || tall < 8) return;
      const scale = wide > avail + 1 ? avail / wide : 1;
      sheet.style.transform = scale < 1 ? "scale(" + scale + ")" : "none";
      host.style.height = Math.ceil(tall * scale) + "px";
    };
    if (docFitResize) window.removeEventListener("resize", docFitResize);
    docFitResize = fit;
    window.addEventListener("resize", docFitResize);
    page.querySelectorAll("img").forEach((img) => img.addEventListener("load", fit));
    fit();
    requestAnimationFrame(() => {
      fit();
      requestAnimationFrame(fit);
    });
  }

  async function viewDocument(file) {
    const view = $("docView");
    const body = $("docViewBody");
    const title = $("docViewTitle");
    const save = $("btnDocSave");
    if (!view || !body || !title) return;
    closeDocument();
    const token = docToken;
    const name = docTitle(file) || "מסמך";
    state.docName = name;
    title.textContent = name;
    body.innerHTML = '<div class="empty">טוען…</div>';
    if (save) save.hidden = true;
    view.hidden = false;
    try {
      const official = await officialOriginal(file);
      if (token !== docToken) return;
      const blob = official ? official.blob : await fileBlob(file);
      if (token !== docToken) return;
      const storedName = (official && official.name) || trim(file && (file.fileName || file.originalFileName || file.name)) || name;
      const mime = await sniffMime(blob, storedName, file && file.mime);
      const typed = mime && blob.type !== mime ? new Blob([blob], { type: mime }) : blob;
      const url = URL.createObjectURL(typed);
      if (token !== docToken) {
        URL.revokeObjectURL(url);
        return;
      }
      state.docBlob = typed;
      state.docName = (official && official.name) || trim(file && (file.fileName || file.originalFileName)) || name;
      state.docUrl = url;
      if (save) save.hidden = false;
      if (mime.indexOf("image/") === 0) {
        const img = document.createElement("img");
        img.className = "docPage";
        img.alt = "";
        img.src = url;
        const wrap = document.createElement("div");
        wrap.className = "docPages";
        wrap.appendChild(img);
        body.replaceChildren(wrap);
      } else if (mime === "application/pdf" || /\.pdf$/i.test(state.docName)) {
        await paintPdfPages(body, typed, token);
      } else if (isSpreadsheet(mime, state.docName, file && file.type)) {
        const painted = await paintSpreadsheet(body, typed, token);
        if (token !== docToken) return;
        if (!painted) {
          const card = document.createElement("article");
          card.className = "docSheet";
          card.innerHTML = "<h2>" + esc(name) + "</h2><p>המסמך נטען. אפשר להוריד אותו מהכפתור למעלה.</p>";
          body.replaceChildren(card);
        }
      } else if (mime.indexOf("text/") === 0) {
        const text = await typed.text();
        if (token !== docToken) return;
        if (mime === "text/html") {
          paintFittedHtml(body, text, token);
        } else {
          const pre = document.createElement("pre");
          pre.className = "docText";
          pre.textContent = text;
          body.replaceChildren(pre);
        }
      } else {
        const card = document.createElement("article");
        card.className = "docSheet";
        card.innerHTML = "<h2>" + esc(name) + "</h2><p>המסמך נטען. אפשר להוריד אותו מהכפתור למעלה.</p>";
        body.replaceChildren(card);
      }
    } catch (err) {
      if (token !== docToken) return;
      const sheet = err && err.code === "nofile" ? generatedDocument(file) : "";
      if (sheet) {
        body.innerHTML = '<div class="docPages"><div class="docPage">' + sheet + "</div></div>";
        state.docBlob = new Blob(["<!DOCTYPE html><html lang=\"he\" dir=\"rtl\"><meta charset=\"utf-8\"><title>" + name + "</title><body>" + sheet + "</body></html>"], { type: "text/html" });
        state.docName = (name.replace(/\.\w+$/, "") || "document") + ".html";
        if (save) save.hidden = false;
        return;
      }
      if (state.docBlob) {
        body.innerHTML = '<article class="docSheet"><h2>' + esc(name) + "</h2><p>המסמך נטען. אפשר להוריד אותו מהכפתור למעלה.</p></article>";
        if (save) save.hidden = false;
        return;
      }
      body.innerHTML = '<div class="empty">' + esc(err.message || "לא ניתן לפתוח את הקובץ") + "</div>";
    }
  }

  function docRowsHtml(rows) {
    return rows.filter((row) => trim(row[1])).map((row) => {
      return '<div class="docSheet__row"><span>' + esc(row[0]) + "</span><b>" + esc(row[1]) + "</b></div>";
    }).join("");
  }

  function reportPolicies(file) {
    const snap = file && file.payloadSnapshot && typeof file.payloadSnapshot === "object" ? file.payloadSnapshot : {};
    const primary = snap.primary && typeof snap.primary === "object" ? snap.primary : {};
    const operational = snap.operational && typeof snap.operational === "object" ? snap.operational : {};
    const lists = [snap.newPolicies, operational.newPolicies, primary.newPolicies];
    const seen = new Set();
    const out = [];
    lists.forEach((list) => {
      (Array.isArray(list) ? list : []).forEach((policy) => {
        if (!policy || typeof policy !== "object") return;
        const id = trim(policy.id) || (trim(policy.company) + "|" + trim(policy.premiumMonthly));
        if (!id || seen.has(id)) return;
        seen.add(id);
        out.push(policy);
      });
    });
    return { snap: snap, primary: primary, policies: out };
  }

  function generatedDocument(file) {
    if (!file || typeof file !== "object") return "";
    const type = trim(file.type);
    const rows = [];
    const add = (label, value) => { if (trim(value)) rows.push([label, trim(value)]); };
    let policies = "";
    if (type === "operational_report_health") {
      const report = reportPolicies(file);
      add("מבוטח", trim(file.insuredLabel) || [report.primary.firstName, report.primary.lastName].filter(Boolean).join(" "));
      add("תאריך", showDate(file.uploadedAt));
      policies = report.policies.map((policy) => {
        const amount = Number(policy.premiumMonthly) || Number(policy.premiumAfterDiscountValue) || 0;
        return '<div class="docSheet__pol"><span>' + esc(trim(policy.company) || "פוליסה") + "</span><b>" + esc(money(amount)) + "</b></div>";
      }).join("");
    } else if (type === "company_cancel_form") {
      add("חברה", file.company);
      add("מספר פוליסה", file.policyNumber);
      add("מוצר", file.productLabel);
      add("סטטוס", file.cancelStatus);
      add("תאריך", showDate(file.uploadedAt));
    } else if (type === "customer_arrival_pack" || type === "followup_questionnaire") {
      add("חברה", file.company);
      add("שאלון", file.questionnaireLabel);
      add("מבוטח", file.insuredLabel);
      add("תאריך", showDate(file.uploadedAt));
      add("מקור", file.source);
    } else {
      add("תאריך", showDate(file.uploadedAt));
      add("מקור", file.source);
    }
    const answers = followupAnswerRows(file);
    const body = docRowsHtml(rows) + policies + docRowsHtml(answers);
    if (!body) return "";
    return '<article class="docSheet"><h2>' + esc(docTitle(file)) + "</h2>" + body + "</article>";
  }

  function followupAnswerRows(file) {
    const entry = file && file.followupEntry && typeof file.followupEntry === "object" ? file.followupEntry : file;
    const data = entry && entry.followupData && typeof entry.followupData === "object" ? entry.followupData : {};
    const labels = entry && entry.followupLabels && typeof entry.followupLabels === "object" ? entry.followupLabels : {};
    const names = {
      notes: "הערות לשאלון",
      date: "תאריך",
      diagnosis: "אבחנה",
      diagnosisDate: "תאריך אבחנה",
      treatment: "טיפול",
      hospital: "בית חולים",
      doctor: "רופא מטפל",
      medication: "תרופות",
      details: "פירוט",
      followup: "מעקב",
      tests: "בדיקות",
      status: "מצב כיום",
      surgery: "ניתוח",
      result: "תוצאה",
      reason: "סיבה",
      duration: "משך",
      ongoing: "טיפול נמשך"
    };
    const labelFor = (key) => {
      const given = trim(labels[key]);
      if (given && /[\u0590-\u05FF]/.test(given)) return given;
      const leaf = String(key || "").replace(/^.*__/, "").replace(/^clal_[^_]+_/, "").replace(/^q\d+_/i, "");
      if (names[leaf]) return names[leaf];
      if (/[\u0590-\u05FF]/.test(leaf)) return leaf;
      return "";
    };
    const rows = [];
    const seen = new Set();
    Object.keys(labels).concat(Object.keys(data)).forEach((key) => {
      if (seen.has(key)) return;
      seen.add(key);
      const value = trim(data[key]);
      const label = labelFor(key);
      if (!value || !label) return;
      rows.push([label, value]);
    });
    return rows;
  }

  async function downloadFile(file, filename) {
    const href = fileHref(file);
    if (href) {
      if (href.indexOf("data:") === 0) {
        const res = await fetch(href);
        saveBlob(await res.blob(), filename);
        return;
      }
      const link = document.createElement("a");
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener";
      link.download = filename || "";
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }
    const path = filePath(file);
    if (!path) throw new Error("אין קובץ שמור להורדה");
    const bucket = trim(file.storageBucket || file.storage_bucket) || "gi-customer-files";
    const res = await sb.storage.from(bucket).download(path);
    if (res.error || !res.data) throw new Error("לא ניתן להוריד את הקובץ");
    saveBlob(res.data, filename);
  }

  function canAssign() {
    const role = state.profile && state.profile.role;
    return role === "admin" || role === "manager";
  }

  function roleLabel(role) {
    const key = roleKey(role);
    if (key === "admin") return "מנהל מערכת";
    if (key === "manager") return "מנהל";
    if (key === "teammanager") return "מנהל צוות";
    return "נציג";
  }

  function firstText(policy, keys) {
    for (let i = 0; i < keys.length; i += 1) {
      const value = trim(policy && policy[keys[i]]);
      if (value) return value;
    }
    return "";
  }

  function policyCompany(policy) {
    return firstText(policy, ["company", "insurer", "companyName"]);
  }

  function policyNumber(policy) {
    return firstText(policy, ["policyNumber", "number", "policyNo"]);
  }

  function policyInsuredName(policy, payload) {
    const written = firstText(policy, ["insuredText", "insuredNames"]);
    if (written) return written;
    const listed = [];
    (Array.isArray(policy && policy.policyInsureds) ? policy.policyInsureds : []).forEach((person) => {
      const name = opsPerson(person) || trim(person && (person.name || person.label));
      if (name && listed.indexOf(name) < 0) listed.push(name);
    });
    if (listed.length) return listed.join(", ");
    const root = payload && typeof payload === "object" ? payload : {};
    const people = (Array.isArray(root.insureds) && root.insureds.length
      ? root.insureds
      : (root.operational && Array.isArray(root.operational.insureds) ? root.operational.insureds : [])
    ).filter((ins) => ins && typeof ins === "object");
    const ids = [policy && policy.insuredId].concat(Array.isArray(policy && policy.insuredIds) ? policy.insuredIds : []);
    const matched = [];
    ids.forEach((id) => {
      const key = trim(id);
      if (!key) return;
      const ins = people.find((item) => trim(item.id) === key || trim(item.label) === key);
      if (!ins) return;
      const name = opsPerson(ins.data) || trim(ins.label);
      if (name && matched.indexOf(name) < 0) matched.push(name);
    });
    if (matched.length) return matched.join(", ");
    const label = firstText(policy, ["insuredLabel"]);
    if (label) return label;
    if (people.length === 1) return opsPerson(people[0].data) || trim(people[0].label);
    if (!people.length) return opsPerson(root.primary);
    return "";
  }

  function policyStatus(policy) {
    const scan = policy && policy.issuedPolicyScan;
    if (scan && trim(scan.status) === "ok") return { text: "פעילה", live: true };
    if (scan && trim(scan.status) === "gaps") return { text: "יש פערים", live: false };
    if (scan && trim(scan.status) === "unreadable") return { text: "לא ניתן לקרוא", live: false };
    const raw = firstText(policy, ["status", "badgeText"]);
    if (!raw || raw === "חדש" || raw === "פעיל" || raw === "פעילה" || raw === "הופק" || raw === "הופקה") {
      return { text: "פעילה", live: true };
    }
    return { text: raw, live: false };
  }

  function coverRows(policy) {
    const rows = [];
    const seen = new Set();
    const push = (label, amount, note) => {
      const name = trim(label);
      if (!name || seen.has(name)) return;
      seen.add(name);
      const sum = typeof amount === "number" || (amount != null && trim(amount) !== "" && !Number.isNaN(Number(String(amount).replace(/[₪,\s]/g, ""))))
        ? amount
        : trim(amount);
      rows.push({ label: name, amount: sum, note: trim(note) });
    };
    const lists = []
      .concat(Array.isArray(policy.coverItems) ? policy.coverItems : [])
      .concat(Array.isArray(policy.healthCovers) ? policy.healthCovers : [])
      .concat(Array.isArray(policy.lifeCovers) ? policy.lifeCovers : [])
      .concat(Array.isArray(policy.coverages) ? policy.coverages : []);
    lists.forEach((item) => {
      if (typeof item === "string") push(item, "");
      else if (item && typeof item === "object") {
        push(item.label || item.name || item.coverageName || item.type, item.amount || item.sumInsured || item.premium || item.sum, item.note);
      }
    });
    const amounts = policy.healthCoversWithAmounts;
    if (amounts && typeof amounts === "object") Object.keys(amounts).forEach((key) => push(key, amounts[key]));
    const premiums = policy.productionCoverPremiums;
    if (premiums && typeof premiums === "object") Object.keys(premiums).forEach((key) => push(key, premiums[key]));
    (Array.isArray(policy.productionCoverDetails) ? policy.productionCoverDetails : []).forEach((detail) => {
      if (!detail || typeof detail !== "object") return;
      const bits = [];
      if (trim(detail.endDate)) bits.push("תום " + trim(detail.endDate));
      if (trim(detail.sumInsured)) bits.push("סכום " + trim(detail.sumInsured));
      if (trim(detail.deductible)) bits.push("השתתפות " + trim(detail.deductible));
      push(detail.name || detail.label, detail.premium || detail.amount, bits.join(" · "));
    });
    const addons = policy.healthAddonPremiums;
    if (addons && typeof addons === "object") {
      Object.keys(addons).forEach((key) => {
        const map = addons[key];
        let sum = 0;
        if (map && typeof map === "object") {
          Object.keys(map).forEach((id) => { sum += positive(map[id]); });
        } else sum = positive(map);
        if (sum > 0) push(key, sum);
      });
    }
    return rows;
  }

  function moneyOrText(value) {
    if (value == null || trim(value) === "") return "";
    const n = positive(value);
    if (n > 0) return money(n);
    return trim(value);
  }

  function policyFacts(policy) {
    const monthly = policyMonthly(policy);
    const start = showDate(firstText(policy, ["startDate", "insuranceStartDate", "beginDate"]));
    const end = showDate(firstText(policy, ["endDate", "insuranceEndDate"]));
    const savings = moneyOrText(firstText(policy, ["currentSavings", "savingsAmount", "accumulation", "balance"]));
    const coverSum = moneyOrText(firstText(policy, ["sumInsured", "coverageValue", "compensation"]));
    const product = firstText(policy, ["product", "productName", "planName", "plan", "type"]);
    const rows = [];
    const add = (label, value) => { if (trim(value)) rows.push({ label: label, value: trim(value) }); };
    add("החברה", policyCompany(policy));
    add("מוצר", product);
    add("מספר פוליסה", policyNumber(policy));
    if (savings) add("סכום חיסכון נוכחי", savings);
    if (coverSum) add(firstText(policy, ["coverageLabel"]) || "סכום כיסוי", coverSum);
    if (monthly > 0) add("פרמיה חודשית", money(monthly));
    add("תחילת פוליסה", start);
    add("תום פוליסה", end);
    add("סטטוס", policyStatus(policy).text);
    add("מבוטחים", firstText(policy, ["insuredText", "insuredNames", "insuredLabel"]));
    add("מספר סוכן", firstText(policy, ["agentNumber"]));
    const period = firstText(policy, ["paymentPeriod"]);
    add("תקופת תשלום", period && /^\d+$/.test(period) ? period + " חודשים" : period);
    add("אמצעי תשלום", firstText(policy, ["paymentMethod", "paymentStatusLabel"]));
    add("הערות", firstText(policy, ["notes", "comment"]));
    return rows;
  }

  function depositRows(policy) {
    const keys = ["deposits", "contributions", "depositHistory", "hafkadot", "payments"];
    let list = [];
    for (let i = 0; i < keys.length; i += 1) {
      if (Array.isArray(policy[keys[i]]) && policy[keys[i]].length) {
        list = policy[keys[i]];
        break;
      }
    }
    return list.map((item) => {
      if (item == null) return null;
      if (typeof item !== "object") return { label: "הפקדה", value: moneyOrText(item) || trim(item) };
      const when = showDate(firstText(item, ["date", "depositDate", "paidAt", "createdAt", "month"]));
      const amount = moneyOrText(firstText(item, ["amount", "sum", "value", "deposit", "premium"]));
      return { label: when || "הפקדה", value: amount || trim(item.label) || trim(item.status) };
    }).filter((row) => row && (row.label || row.value));
  }

  function policyFiles(policy, payload) {
    const files = [];
    const push = (file) => { if (file && typeof file === "object") files.push(file); };
    ["policyFiles", "documents", "files"].forEach((key) => {
      (Array.isArray(policy[key]) ? policy[key] : []).forEach(push);
    });
    if (policy.issuedPolicyScan && typeof policy.issuedPolicyScan === "object") push(policy.issuedPolicyScan);
    if (policy.issuedPolicyFile && typeof policy.issuedPolicyFile === "object") push(policy.issuedPolicyFile);
    const id = trim(policy.id);
    const number = policyNumber(policy);
    customerDocs(payload).forEach((doc) => {
      const ids = Array.isArray(doc.policyIds) ? doc.policyIds.map((item) => trim(item)) : [];
      if ((id && (trim(doc.policyId) === id || ids.indexOf(id) >= 0)) || (number && trim(doc.policyNumber) === number)) push(doc);
    });
    return files;
  }

  function kvHtml(rows, statusText) {
    if (!rows.length) return '<div class="empty">אין נתונים שמורים לפוליסה</div>';
    return '<div class="kvList">' + rows.map((row) => {
      const live = statusText && row.label === "סטטוס" && row.value === statusText;
      return '<div class="kv"><span>' + esc(row.label) + '</span><b' + (live ? ' class="is-live"' : '') + '>' + esc(row.value) + '</b></div>';
    }).join("") + '</div>';
  }

  function coversHtml(policy) {
    const rows = coverRows(policy);
    if (!rows.length) return "";
    const list = rows.map((row) => {
      const amount = moneyOrText(row.amount);
      const note = row.note ? '<span>' + esc(row.note) + '</span>' : '';
      return '<div class="coverRow"><div><b>' + esc(row.label) + '</b>' + note + '</div>' + (amount ? '<b>' + esc(amount) + '</b>' : '') + '</div>';
    }).join("");
    return '<section class="coverBlock"><h3>כיסויים</h3><div class="coverList">' + list + '</div></section>';
  }

  function folioKind(title) {
    if (/בריאות/.test(title)) return "health";
    if (/חיים/.test(title)) return "life";
    if (/אלמנטרי|דירה|רכב|בית|רכוש/.test(title)) return "home";
    return "other";
  }

  function folioGlyph(kind) {
    if (kind === "health") return policyIcon("בריאות");
    if (kind === "home") return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 11 12 4l8 7"/><path d="M7 10.2V20h10V10.2"/></svg>';
    return policyIcon("חיים");
  }

  function customerAddress(row) {
    const payload = row && row.payload && typeof row.payload === "object" ? row.payload : {};
    const primary = payload.primary || (payload.insureds && payload.insureds[0] && payload.insureds[0].data) || {};
    const city = trim(primary.city) || trim(payload.city);
    const street = trim(primary.street) || trim(payload.street);
    const house = trim(primary.houseNo || primary.houseNumber || payload.houseNo || payload.houseNumber);
    const apt = trim(primary.apartmentNo || primary.apartment || payload.apartmentNo);
    const zip = trim(primary.zip || primary.postalCode || payload.zip);
    const streetLine = [street, house].filter(Boolean).join(" ");
    const place = [streetLine, apt ? "דירה " + apt : ""].filter(Boolean).join(", ");
    const cityLine = [city, zip].filter(Boolean).join(" ");
    return [place, cityLine].filter(Boolean).join(", ");
  }

  function fileSectionTab() {
    return state.fileTab === "tasks" || state.fileTab === "history" || state.fileTab === "documents" ? state.fileTab : "policies";
  }

  function paintCustomerFile(opts) {
    const row = state.file;
    const host = $("customerFile");
    if (!row) {
      host.innerHTML = '<div class="empty">הלקוח לא נמצא</div>';
      const menu = $("folioMenu");
      if (menu) menu.innerHTML = "";
      closeFolioMenu();
      return;
    }
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    const primary = payload.primary || (payload.insureds && payload.insureds[0] && payload.insureds[0].data) || {};
    const name = trim(row.full_name) || trim(((primary.firstName || "") + " " + (primary.lastName || "")).trim()) || "לקוח";
    const phone = trim(row.phone) || trim(primary.phone);
    const email = trim(row.email) || trim(primary.email) || trim(payload.email);
    const tone = customerTone(row);
    const policies = policyRows(payload);
    let monthly = 0;
    policies.forEach((policy) => { monthly += policyMonthly(policy); });
    state.filePolicies = policies;
    state.fileDocs = customerDocs(payload);
    const tab = fileSectionTab();
    const address = customerAddress(row);
    const phoneIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 3h3l1 4-2 1a12 12 0 0 0 6 6l1-2 4 1v3c0 1-1 2-2 2A16 16 0 0 1 5 5c0-1 1-2 2-2z"/></svg>';
    const mailIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>';
    const pinIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.2"/></svg>';
    const docIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
    const contactLine = (icon, value, href, ltr, label) => {
      const text = trim(value);
      if (!text) return "";
      const inner = '<span class="folioLine__ico">' + icon + "</span><b" + (ltr ? ' dir="ltr"' : "") + ">" + esc(text) + "</b>";
      const named = label ? ' aria-label="' + label + '"' : "";
      return href ? '<a class="folioLine" href="' + href + '"' + named + ">" + inner + "</a>" : '<div class="folioLine"' + named + ">" + inner + "</div>";
    };
    const contacts = (phone ? '<a class="folioLine" href="tel:' + esc(phone.replace(/[^\d+]/g, "")) + '" aria-label="חיוג"><span class="folioLine__ico">' + phoneIcon + '</span><b dir="ltr">' + esc(phone) + "</b></a>" : "") + contactLine(mailIcon, email, email ? "mailto:" + email : "", true, "אימייל") + contactLine(pinIcon, address, "", false, "כתובת מגורים");
    const letter = name.trim().charAt(0) || "ל";
    const head = '<div class="folioStage"><div class="folioHero"><button class="folioId" type="button" data-edit="1"><span class="folioAvatar" aria-hidden="true">' + esc(letter) + '</span><span class="fileCard__name">' + esc(name) + '</span><span class="folioPill ' + tone.cls + '">' + esc(tone.label) + "</span></button>"
      + (contacts ? '<div class="fileCard__contacts">' + contacts + "</div>" : "") + "</div></div>";
    const chevron = '<svg class="folioPol__chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
    const list = policies.length
      ? '<div class="polList">' + policies.map((policy, index) => {
        const title = policyTitle(policy);
        const kind = folioKind(title);
        const status = policyStatus(policy);
        const who = status.live ? policyInsuredName(policy, payload) : "";
        return '<button class="folioPol" type="button" data-policy="' + index + '"><span class="folioPol__ico' + (kind === "home" ? " folioPol__ico--home" : "") + '">' + folioGlyph(kind) + '</span><span class="folioPol__text"><b>' + esc(title) + "</b>" + (who ? '<span class="folioPol__who">' + esc(who) + "</span>" : "") + "<span>" + esc(status.live ? "בתוקף" : status.text) + "</span></span>" + chevron + "</button>";
      }).join("") + "</div>"
      : '<div class="empty">אין פוליסות שנרכשו בסוכנות</div>';
    const portfolio = '<h2 class="blockTitle">תיק ביטוח</h2><p class="folioSum">סה״כ פרמיה בתיק <b>' + esc(money(monthly)) + "</b></p>" + list;
    const eventRow = (title, meta, icon, attrs) => '<button class="folioEvent" type="button"' + (attrs || "") + "><span><b>" + esc(title) + "</b><span>" + esc(meta) + '</span></span><span class="folioEvent__ico">' + icon + "</span></button>";
    let section = "";
    if (tab !== "policies") {
      let body = "";
      if (tab === "tasks") {
        const taskRows = (state.homeReminders || []).filter((item) => token(item.customer_name) === token(name) && item.is_done !== true && !isMeeting(item));
        body = taskRows.length
          ? '<div class="folioEvents">' + taskRows.map((item) => eventRow(reminderTitle(item), reminderWhen(item.remind_at) || trim(item.details), docIcon, "")).join("") + "</div>"
          : '<div class="empty">אין משימות שמורות ללקוח</div>';
      } else if (tab === "history") {
        body = '<div class="empty">אין רשומות שמורות בתיק</div>';
      } else {
        const docs = state.fileDocs;
        body = docs.length
          ? '<div class="folioEvents">' + docs.map((doc, index) => eventRow(docTitle(doc), showDate(doc.uploadedAt || doc.createdAt) || "מסמך", docIcon, ' data-doc="' + index + '"')).join("") + "</div>"
          : '<div class="empty">אין מסמכים בתיק</div>';
      }
      const sectionTitle = tab === "tasks" ? "משימות" : tab === "history" ? "היסטוריה" : "מסמכים";
      section = '<h2 class="blockTitle" id="fileSection">' + sectionTitle + "</h2>" + body;
    }
    host.innerHTML = head + (tab === "policies" ? portfolio : "") + section + '<p class="fileNote" id="fileNote" role="status"></p>';
    paintFolioMenu(tab);
    if (opts && opts.scroll) {
      const section = $("fileSection");
      if (section && section.scrollIntoView) section.scrollIntoView({ block: "start" });
    }
  }

  function closeFolioMenu() {
    const menu = $("folioMenu");
    const backdrop = $("folioMenuBackdrop");
    if (menu) menu.hidden = true;
    if (backdrop) backdrop.hidden = true;
    const button = $("btnCustomerMore");
    if (button) button.setAttribute("aria-expanded", "false");
  }

  function paintFolioMenu(tab) {
    const menu = $("folioMenu");
    if (!menu) return;
    const current = tab === "tasks" || tab === "history" || tab === "documents" ? tab : "policies";
    const chev = '<svg class="folioMenu__chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
    const item = (id, label) => '<button type="button" data-filetab="' + id + '"' + (current === id ? ' class="is-on"' : "") + "><span>" + label + "</span>" + chev + "</button>";
    menu.innerHTML = (canAssign() ? '<button type="button" data-assign="1"><span>שיוך לקוח לנציג</span>' + chev + "</button>" : "")
      + item("history", "היסטוריה")
      + item("tasks", "משימות")
      + item("documents", "מסמכים")
      + '<button type="button" data-portal="1"><span>אזור אישי ללקוח</span>' + chev + "</button>";
  }

  async function openCustomer(id) {
    show("customer");
    closeFolioMenu();
    $("customerFile").innerHTML = '<div class="empty">טוען…</div>';
    try {
      state.file = await loadCustomerFile(id);
      state.fileTab = "policies";
      if (!state.homeReminders) {
        try { state.homeReminders = await loadMyReminders(); }
        catch (_err) { state.homeReminders = []; }
      }
      paintCustomerFile();
    } catch (_err) {
      state.file = null;
      $("customerFile").innerHTML = '<div class="empty">לא ניתן לטעון את הלקוח</div>';
    }
  }

  function paintPolicy() {
    const policy = state.filePolicies[state.policyIndex];
    const host = $("policyBody");
    const foot = $("policyFoot");
    if (!policy) {
      host.innerHTML = '<div class="empty">הפוליסה לא נמצאה</div>';
      foot.innerHTML = "";
      return;
    }
    const payload = state.file && state.file.payload && typeof state.file.payload === "object" ? state.file.payload : {};
    const title = policyTitle(policy);
    const product = firstText(policy, ["product", "productName", "planName"]);
    const heading = product && product !== title ? title + " - " + product : title;
    const company = policyCompany(policy);
    const number = policyNumber(policy);
    const status = policyStatus(policy);
    const tab = state.policyTab || "details";
    const tabs = '<div class="polTabs"><button type="button" data-poltab="details"' + (tab === "details" ? ' class="is-on"' : "") + '>פרטים</button><button type="button" data-poltab="deposits"' + (tab === "deposits" ? ' class="is-on"' : "") + '>הפקדות</button><button type="button" data-poltab="documents"' + (tab === "documents" ? ' class="is-on"' : "") + '>מסמכים</button></div>';
    const card = '<article class="polHead"><div><div class="polHead__name">' + esc(heading) + '</div>' + (company ? '<div class="polHead__co">' + esc(company) + '</div>' : '') + (number ? '<div class="polHead__num">מספר פוליסה: ' + esc(number) + '</div>' : '') + '<span class="' + (status.live ? "live" : "cust__status") + '">' + esc(status.text) + '</span></div><span class="polHead__ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/></svg></span></article>';
    let body = "";
    if (tab === "deposits") {
      const monthly = policyMonthly(policy);
      const rows = [];
      if (monthly > 0) rows.push({ label: "פרמיה חודשית", value: money(monthly) });
      depositRows(policy).forEach((row) => rows.push(row));
      body = rows.length ? kvHtml(rows, "") : '<div class="empty">אין פירוט הפקדות שמור לפוליסה</div>';
    } else if (tab === "documents") {
      state.policyDocs = policyFiles(policy, payload);
      body = state.policyDocs.length
        ? '<div class="docList">' + state.policyDocs.map((doc, index) => '<button class="docRow" type="button" data-pdoc="' + index + '"><span><b>' + esc(docTitle(doc)) + '</b><span>מסמך</span></span><span class="docRow__open">צפייה</span></button>').join("") + '</div>'
        : '<div class="empty">אין מסמכים שמורים לפוליסה</div>';
    } else {
      body = kvHtml(policyFacts(policy), status.live ? status.text : "") + coversHtml(policy);
    }
    host.innerHTML = card + tabs + body + '<p class="formError" id="policyNote" role="alert"></p>';
    foot.innerHTML = '<button class="primary" id="btnPolicyReport" type="button"><span>צפייה בדוח תפעולי</span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></button>';
  }

  function opsPairs(rows) {
    return rows.filter((row) => row && trim(row[1]));
  }

  function opsRows(rows) {
    const pairs = opsPairs(rows);
    if (!pairs.length) return "";
    return '<div class="opsRows">' + pairs.map((row) => '<div class="opsRow"><span>' + esc(row[0]) + "</span><b>" + esc(row[1]) + "</b></div>").join("") + "</div>";
  }

  function opsSection(title, inner) {
    if (!trim(inner)) return "";
    return '<section class="opsSec"><h2>' + esc(title) + "</h2>" + inner + "</section>";
  }

  function opsCode(value, map) {
    const raw = trim(value);
    return map[token(raw)] || raw;
  }

  function opsPerson(data) {
    return trim((trim(data && data.firstName) + " " + trim(data && data.lastName)).trim());
  }

  function opsSmoke(data) {
    const smoking = trim(data && data.smokingStatus);
    if (!smoking) return [["עישון", "לא צוין"]];
    if (token(smoking) === "no" || smoking === "לא מעשן/ת") return [["עישון", "לא מעשן/ת"]];
    const rows = [["עישון", "מעשן/ת"]];
    if (trim(data.smokingType)) rows.push(["סוג עישון", trim(data.smokingType)]);
    if (trim(data.smokingAmount)) rows.push(["כמות ליום", trim(data.smokingAmount)]);
    return rows;
  }

  function opsInsuredRows(ins) {
    const data = ins && ins.data && typeof ins.data === "object" ? ins.data : {};
    const child = trim(ins && ins.type) === "child";
    return opsPairs([
      ["שם מלא", opsPerson(data)],
      ["ת״ז", trim(data.idNumber)],
      ["תאריך לידה", showDate(data.birthDate)],
      ["תאריך הנפקת ת״ז", child ? "" : (showDate(data.idIssueDate) || "לא הוזן")],
      ["גיל", trim(data.age)],
      ["טלפון", trim(data.phone)],
      ["אימייל", trim(data.email)],
      ["מגדר", opsCode(data.gender, { male: "זכר", female: "נקבה", m: "זכר", f: "נקבה" })],
      ["מצב משפחתי", opsCode(data.maritalStatus, { married: "נשוי/ה", single: "רווק/ה", divorced: "גרוש/ה", widowed: "אלמן/ה" })],
      ["עיר", trim(data.city)],
      ["כתובת", [trim(data.street), trim(data.houseNo || data.houseNumber), trim(data.apartmentNo), trim(data.zip)].filter(Boolean).join(" ")],
      ["קופת חולים", trim(data.clinic || data.hmo || data.kupatHolim)],
      ["שב״ן", trim(data.shaban || data.shabanLevel)],
      ["עיסוק", trim(data.occupation)]
    ].concat(opsSmoke(data)));
  }

  function opsHeading(ins, index) {
    const data = ins && ins.data && typeof ins.data === "object" ? ins.data : {};
    const name = opsPerson(data);
    const type = trim(ins && ins.type);
    let role = "מבוטח נוסף";
    if (index === 0 || type === "primary") role = "מבוטח ראשי";
    else if (type === "spouse" || type === "secondary") role = "מבוטח משני";
    else if (type === "child") role = "מבוטח נוסף קטין";
    else if (type === "adult") role = "מבוטח נוסף בגיר";
    return name ? role + " — " + name : role;
  }

  function opsStatus(policy, data) {
    const book = data && data.cancellations && typeof data.cancellations === "object" ? data.cancellations : {};
    const entry = policy && policy.id ? book[policy.id] : null;
    const raw = trim(entry && entry.status) || trim(policy && (policy.status || policy.policyStatus || policy.action));
    const label = opsCode(raw, {
      full: "ביטול מלא",
      partial: "ביטול חלקי",
      partial_health: "ביטול חלקי",
      agent_appoint: "מינוי סוכן",
      agentappoint: "מינוי סוכן",
      keep: "נשמר",
      retained: "נשמר"
    });
    const reason = trim(entry && entry.needsAnalysisReason);
    return { label: label || "—", reason: reason };
  }

  function opsPack(file) {
    const payload = file && file.payload && typeof file.payload === "object" ? file.payload : {};
    const operational = payload.operational && typeof payload.operational === "object" ? payload.operational : {};
    const insureds = (Array.isArray(payload.insureds) && payload.insureds.length ? payload.insureds : (Array.isArray(operational.insureds) ? operational.insureds : [])).filter(Boolean);
    const primary = payload.primary && typeof payload.primary === "object" ? payload.primary : (operational.primary && typeof operational.primary === "object" ? operational.primary : {});
    const fresh = Array.isArray(payload.newPolicies) && payload.newPolicies.length ? payload.newPolicies : (Array.isArray(operational.newPolicies) ? operational.newPolicies : []);
    const elementary = Array.isArray(payload.elementaryPolicies) ? payload.elementaryPolicies : [];
    const policies = fresh.concat(elementary).filter((policy) => policy && typeof policy === "object" && trim(policy.origin) !== "existing");
    return { payload: payload, operational: operational, primary: primary, insureds: insureds, policies: policies };
  }

  function opsHealth(pack) {
    const responses = {};
    const take = (source) => {
      if (!source || typeof source !== "object") return;
      Object.keys(source).forEach((key) => {
        const block = source[key];
        if (!block || typeof block !== "object") return;
        responses[key] = responses[key] && typeof responses[key] === "object" ? responses[key] : {};
        Object.keys(block).forEach((id) => {
          const incoming = block[id];
          if (!incoming || typeof incoming !== "object") return;
          const prev = responses[key][id] && typeof responses[key][id] === "object" ? responses[key][id] : {};
          responses[key][id] = Object.assign({}, prev, incoming);
        });
      });
    };
    const primary = pack.primary || {};
    take(primary.healthDeclaration && primary.healthDeclaration.responses);
    take(pack.operational.primary && pack.operational.primary.healthDeclaration && pack.operational.primary.healthDeclaration.responses);
    pack.insureds.forEach((ins) => take(ins && ins.data && ins.data.healthDeclaration && ins.data.healthDeclaration.responses));
    const lines = [];
    Object.keys(responses).forEach((key) => {
      const block = responses[key];
      const question = /[א-ת]/.test(key) ? key : "שאלה רפואית";
      pack.insureds.forEach((ins, index) => {
        const data = ins && ins.data && typeof ins.data === "object" ? ins.data : {};
        const id = trim(ins && ins.id) || trim(data.id) || String(index);
        const answer = block[id] || block[String(index)] || null;
        if (!answer) return;
        const raw = trim(answer.answer);
        if (!raw) return;
        const fields = answer.fields && typeof answer.fields === "object"
          ? Object.keys(answer.fields).map((name) => trim(answer.fields[name])).filter(Boolean).join(" · ")
          : "";
        lines.push('<article class="opsPol"><b>' + esc(opsHeading(ins, index)) + "</b><span>" + esc(question) + "</span><strong>" + esc(raw === "yes" ? "כן" : raw === "no" ? "לא" : raw) + "</strong>" + (fields ? "<small>" + esc(fields) + "</small>" : "") + "</article>");
      });
    });
    return lines.join("");
  }

  function paintOps() {
    const host = $("opsBody");
    const file = state.file;
    const pack = opsPack(file);
    if (!pack.insureds.length && !pack.policies.length) {
      host.innerHTML = '<div class="empty">אין דוח תפעולי שמור ללקוח</div>';
      return;
    }
    const primaryData = pack.insureds[0] && pack.insureds[0].data && typeof pack.insureds[0].data === "object" ? pack.insureds[0].data : pack.primary;
    const customerName = opsPerson(pack.primary) || opsPerson(primaryData) || trim(file && file.full_name) || "לקוח";
    const stamp = Date.parse(trim(pack.payload.createdAt) || trim(pack.operational.createdAt) || "");
    const when = Number.isFinite(stamp)
      ? new Date(stamp).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "";
    const agent = trim(file && file.agent_name) || trim(pack.payload.agentName) || trim(pack.operational.agentName);
    const people = pack.insureds.map((ins, index) => '<div class="opsPerson"><b>' + esc(opsHeading(ins, index)) + "</b>" + opsRows(opsInsuredRows(ins)) + "</div>").join("");
    const bmi = pack.insureds.map((ins, index) => {
      const data = ins && ins.data && typeof ins.data === "object" ? ins.data : {};
      if (!trim(data.heightCm) && !trim(data.weightKg) && !trim(data.bmi)) return "";
      return '<div class="opsPerson"><b>' + esc(opsHeading(ins, index)) + "</b>" + opsRows([
        ["גובה", trim(data.heightCm) ? trim(data.heightCm) + " ס״מ" : ""],
        ["משקל", trim(data.weightKg) ? trim(data.weightKg) + " ק״ג" : ""],
        ["BMI", trim(data.bmi)]
      ]) + "</div>";
    }).join("");
    const existing = [];
    pack.insureds.forEach((ins, index) => {
      const data = ins && ins.data && typeof ins.data === "object" ? ins.data : {};
      (Array.isArray(data.existingPolicies) ? data.existingPolicies : []).forEach((policy) => {
        const status = opsStatus(policy, data);
        existing.push('<article class="opsPol"><b>' + esc(opsHeading(ins, index)) + "</b><span>" + esc([trim(policy.company), trim(policy.type || policy.product), trim(policy.policyNumber)].filter(Boolean).join(" · ")) + "</span><strong>" + esc(moneyOrText(policy.monthlyPremium || policy.premium) || "—") + "</strong><small>" + esc([status.label, status.reason, policy.importedFromHarBituach ? "יובא מהר הביטוח" : "נוסף ידנית"].filter(Boolean).join(" · ")) + "</small></article>");
      });
    });
    const consider = pack.payload.needsMainConsideration || pack.operational.needsMainConsideration;
    const considerText = typeof consider === "string" ? trim(consider) : trim(consider && (consider.label || consider.key));
    const reasons = [];
    if (considerText) reasons.push('<article class="opsPol"><strong>השיקולים העיקריים במתן ההמלצה הינם: ' + esc(considerText) + "</strong></article>");
    pack.insureds.forEach((ins, index) => {
      const data = ins && ins.data && typeof ins.data === "object" ? ins.data : {};
      (Array.isArray(data.existingPolicies) ? data.existingPolicies : []).forEach((policy) => {
        const status = opsStatus(policy, data);
        if (!status.reason) return;
        reasons.push('<article class="opsPol"><b>' + esc([trim(policy.company), trim(policy.type || policy.product)].filter(Boolean).join(" · ")) + "</b><span>" + esc(opsHeading(ins, index) + " · " + status.label) + "</span><small>" + esc(status.reason) + "</small></article>");
      });
    });
    const fresh = pack.policies.map((policy) => {
      const covers = coverRows(policy).map((row) => trim(row.label) + (row.amount ? " · " + moneyOrText(row.amount) : "")).filter(Boolean).join(" · ");
      const monthly = policyMonthly(policy);
      return '<article class="opsPol"><b>' + esc(policyTitle(policy)) + "</b><span>" + esc([policyCompany(policy), policyNumber(policy)].filter(Boolean).join(" · ")) + "</span>" + (monthly > 0 ? "<strong>" + esc(money(monthly)) + "</strong>" : "") + opsRows([
        ["תחילה", showDate(firstText(policy, ["startDate", "insuranceStartDate"]))],
        ["כיסויים", covers],
        ["אמצעי תשלום", firstText(policy, ["paymentMethod"])],
        ["הערות", firstText(policy, ["notes", "comment"])]
      ]) + "</article>";
    }).join("");
    const payer = pack.primary.payer && typeof pack.primary.payer === "object" ? pack.primary.payer : {};
    const card = pack.primary.cc && typeof pack.primary.cc === "object" ? pack.primary.cc : (primaryData.cc && typeof primaryData.cc === "object" ? primaryData.cc : {});
    const bank = pack.primary.ho && typeof pack.primary.ho === "object" ? pack.primary.ho : (primaryData.ho && typeof primaryData.ho === "object" ? primaryData.ho : {});
    const external = pack.primary.payerChoice === "external";
    const ext = pack.primary.externalPayer && typeof pack.primary.externalPayer === "object" ? pack.primary.externalPayer : {};
    const method = trim(pack.primary.paymentMethod || payer.method);
    const pay = opsRows([
      ["מי משלם", external ? "משלם חריג" : (method ? "המבוטח" : "")],
      ["אמצעי תשלום", method === "cc" ? "אשראי" : method === "ho" ? "הוראת קבע" : method],
      ["שם משלם", external ? opsPerson(ext) : trim(payer.holderName || pack.primary.payerName)],
      ["ת״ז משלם", external ? trim(ext.idNumber) : trim(payer.holderId || pack.primary.payerId)],
      ["טלפון משלם", external ? trim(ext.phone) : ""],
      ["מספר כרטיס", trim(payer.cardNumberMasked || payer.cardNumber || card.cardNumber || pack.primary.cardNumberMasked)],
      ["תוקף", trim(payer.cardExpiry || card.exp || pack.primary.cardExpiry)],
      ["בנק", trim(payer.bankName || bank.bankName)],
      ["מספר בנק", trim(payer.bankNo || bank.bankNo)],
      ["סניף", trim(payer.branchNo || bank.branch)],
      ["חשבון", trim(payer.accountNo || bank.account)]
    ]);
    const mirror = pack.payload.mirrorSchedule || pack.operational.mirrorSchedule || (primaryData.mirrorSchedule || {});
    const meet = opsRows([
      ["תאריך", trim(mirror.date)],
      ["שעה", trim(mirror.time)],
      ["הערת נציג", trim(mirror.note)]
    ]);
    const existingCount = existing.length;
    const counts = pack.insureds.length + " מבוטחים · " + existingCount + " פוליסות קיימות · " + pack.policies.length + " פוליסות חדשות";
    host.innerHTML = '<article class="opsDoc"><header class="opsHead"><p>דוח תפעולי</p><h2>' + esc(customerName) + "</h2><small>" + esc([when, agent].filter(Boolean).join(" · ")) + "</small><small>" + esc(counts) + "</small></header>"
      + opsSection("פרטי לקוח", people)
      + opsSection("גובה, משקל ו־BMI", bmi)
      + opsSection("פוליסות קיימות", existing.join(""))
      + opsSection("שיקולים במתן ההמלצות", reasons.join(""))
      + opsSection("פוליסות חדשות", fresh)
      + opsSection("אמצעי תשלום", pay)
      + opsSection("תזמון שיחת שיקוף", meet)
      + opsSection("הצהרת בריאות", opsHealth(pack))
      + "</article>";
  }

  function openOps(back) {
    state.opsReturn = back || "policy";
    show("ops");
    paintOps();
  }

  function opsReportText() {
    const node = $("opsBody");
    return node ? String(node.innerText || "").trim() : "";
  }

  async function sendOpsReport() {
    const text = opsReportText();
    if (!text) return;
    try {
      if (navigator.share) await navigator.share({ title: "דוח תפעולי", text: text });
      else if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
    } catch (_err) {}
  }

  function downloadOpsReport() {
    const node = $("opsBody");
    const page = "<!DOCTYPE html><html lang=\"he\" dir=\"rtl\"><head><meta charset=\"utf-8\"><title>דוח תפעולי</title></head><body>" + (node ? node.innerHTML : "") + "</body></html>";
    saveBlob(new Blob([page], { type: "text/html;charset=utf-8" }), "operational-report.html");
  }

  function openPolicy(index) {
    state.policyIndex = index;
    state.policyTab = "details";
    state.policyReport = false;
    show("policy");
    paintPolicy();
  }

  const splashAt = Date.now();
  const AVATAR_KEY = "onyx-phone-avatar:";

  function readAvatar() {
    const id = state.profile && state.profile.id;
    if (!id) return "";
    try { return localStorage.getItem(AVATAR_KEY + id) || ""; } catch (_err) { return ""; }
  }

  function writeAvatar(dataUrl) {
    const id = state.profile && state.profile.id;
    if (!id) return;
    localStorage.setItem(AVATAR_KEY + id, dataUrl);
  }

  function jerusalemParts(now) {
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
    const get = (type) => Number(parts.find((part) => part.type === type).value);
    return { y: get("year"), m: get("month"), d: get("day"), hh: get("hour"), mm: get("minute"), ss: get("second") };
  }

  function dayGreeting(now) {
    const when = now instanceof Date ? now : new Date();
    const hour = jerusalemParts(when).hh;
    if (hour >= 5 && hour < 12) return "בוקר טוב";
    if (hour >= 12 && hour < 16) return "צהריים טובים";
    if (hour >= 16 && hour < 23) return "ערב טוב";
    return "לילה טוב";
  }

  function homeHelloLine(now) {
    const greet = dayGreeting(now);
    const name = agentFirstName(state.profile && state.profile.name);
    return name ? greet + " " + name : greet;
  }

  function paintHomeIdentity() {
    const hello = $("homeHello");
    if (hello) hello.textContent = homeHelloLine();
    const activity = document.querySelector('[data-more="activity"]');
    if (activity) activity.hidden = !canAssign();
  }

  function agentFirstName(name) {
    const parts = trim(name).split(/\s+/).filter(Boolean);
    return parts[0] || "";
  }

  function setMenu(open) {
    const menu = $("homeMenu");
    const opener = $("btnMenu");
    if (!menu) return;
    menu.hidden = !open;
    if (opener) opener.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function setIcon(path) {
    return '<span class="setRow__ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">' + path + '</svg></span>';
  }

  function paintProfile() {
    const profile = state.profile || {};
    const name = profile.name || "";
    const role = ALLOWED[profile.role] || "";
    const photo = readAvatar();
    const avatar = photo
      ? '<img alt="" src="' + esc(photo) + '"/>'
      : esc((name || "מ").slice(0, 1));
    const chev = '<svg class="setRow__chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
    const row = (key, label, icon, withChev) => '<button class="setRow" type="button" data-account="' + key + '">' + setIcon(icon) + '<span class="setRow__label">' + label + '</span>' + (withChev ? chev : '') + '</button>';
    $("profileBody").innerHTML = '<div class="profileHero"><button class="profileAvatar" id="btnAvatar" type="button" aria-label="העלאת תמונה">' + avatar + '</button><input id="avatarFile" type="file" accept="image/*" hidden/><div class="profileHero__name">' + esc(name) + '</div><div class="profileHero__role">' + esc(role ? role + " | GEMEL INVEST" : "GEMEL INVEST") + '</div></div><div class="setList">'
      + row("details", "הפרטים שלי", '<circle cx="12" cy="8" r="3"/><path d="M5 19c1.2-3 3.2-4.5 7-4.5S17.8 16 19 19"/>', true)
      + row("notifications", "הגדרות התראות", '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', true)
      + row("security", "אבטחה וכניסה", '<path d="M12 3 5 6v6c0 4.2 2.8 7.2 7 9 4.2-1.8 7-4.8 7-9V6z"/>', true)
      + row("help", "עזרה ותמיכה", '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7"/><path d="M12 17h.01"/>', true)
      + row("logout", "יציאה מהמערכת", '<path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2"/><path d="M15 12H3m0 0 3-3M3 12l3 3"/>', false)
      + '</div>';
  }

  async function loadSelf() {
    const id = state.profile && state.profile.id;
    if (!id) return null;
    const res = await sb.from("agents").select("id,name,username,role,email,birth_date").eq("id", id).maybeSingle();
    if (res.error) throw new Error(res.error.message || "agent");
    return res.data || null;
  }

  async function paintAccount() {
    const kind = state.account;
    const host = $("accountBody");
    const titles = { details: "הפרטים שלי", notifications: "הגדרות התראות", security: "אבטחה וכניסה", help: "עזרה ותמיכה" };
    $("accountTitle").textContent = titles[kind] || "הגדרות";
    if (kind === "details") {
      host.innerHTML = '<div class="empty">טוען…</div>';
      try {
        const row = await loadSelf();
        const profile = state.profile || {};
        const bits = [
          ["שם", (row && row.name) || profile.name],
          ["שם משתמש", (row && row.username) || profile.username],
          ["תפקיד", roleLabel((row && row.role) || profile.role)],
          ["דוא״ל", row && row.email],
          ["תאריך לידה", row && showDate(row.birth_date)]
        ].filter((pair) => trim(pair[1]));
        host.innerHTML = '<div class="kvList">' + bits.map((pair) => '<div class="kv"><span>' + esc(pair[0]) + '</span><b>' + esc(pair[1]) + '</b></div>').join("") + '</div>';
      } catch (_err) {
        host.innerHTML = '<div class="empty">לא ניתן לטעון את הפרטים</div>';
      }
      return;
    }
    if (kind === "notifications") {
      const perm = (typeof Notification === "undefined") ? "unsupported" : Notification.permission;
      const label = perm === "granted" && pushReady ? "התראות פעילות" : perm === "denied" ? "התראות חסומות" : "התראות כבויות";
      const button = perm === "denied" || perm === "unsupported" || (perm === "granted" && pushReady)
        ? ""
        : '<button class="primary accountAction" id="btnNotify" type="button">אפשר התראות</button>';
      const extra = state.pushNote ? '<p class="accountLead">' + esc(state.pushNote) + "</p>" : "";
      host.innerHTML = '<p class="accountLead">' + esc(label) + "</p>" + extra + button;
      return;
    }
    if (kind === "security") {
      const profile = state.profile || {};
      const enrolled = readFaceEnrollment();
      host.innerHTML = '<div class="kvList"><div class="kv"><span>שם משתמש</span><b>' + esc(profile.username || "") + '</b></div><div class="kv"><span>אימות דו־שלבי</span><b class="is-live">פעיל</b></div></div><p class="accountLead">הכניסה דורשת את הקוד בן 6 הספרות שכבר מוגדר לחשבון.</p>'
        + '<button class="primary accountAction" id="btnFaceEnroll" type="button">כניסה ביומטרית</button>'
        + '<p class="accountLead" id="faceEnrollStatus">' + (enrolled ? "כניסה ביומטרית פעילה במכשיר זה. אפשר לסרוק שוב." : "סרקו את הפנים, ואז אשרו כניסה ביומטרית.") + "</p>";
      $("btnFaceEnroll").addEventListener("click", () => { void startFaceEnroll(); });
      return;
    }
    if (kind === "help") {
      host.innerHTML = '<p class="accountLead">פנייה נשלחת לאותה כתובת של התמיכה במערכת.</p><a class="primary accountAction" id="btnHelp" href="mailto:oriasomech@gmail.com?subject=' + encodeURIComponent("פנייה מאפליקציית ONYX") + '">שליחת פנייה</a>';
    }
  }

  function openAccount(kind) {
    state.account = kind;
    show("account");
    void paintAccount();
  }

  function cropAvatar(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read"));
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const size = 256;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const scale = Math.max(size / img.width, size / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          canvas.getContext("2d").drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = () => reject(new Error("image"));
        img.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  function blankMetric(id) {
    const node = $(id);
    if (!node) return;
    if (node.textContent === "…" || node.textContent === "") node.textContent = "—";
  }

  function formatPct(value) {
    const n = Number(value) || 0;
    return n.toLocaleString("he-IL", { maximumFractionDigits: 1 }) + "%";
  }

  function targetNumber(value) {
    const n = Number(String(value == null ? "" : value).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function asObject(value) {
    if (value && typeof value === "object") return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (_err) {
        return {};
      }
    }
    return {};
  }

  function mapValue(map, id) {
    if (!map || !id) return null;
    if (Object.prototype.hasOwnProperty.call(map, id)) return map[id];
    const key = Object.keys(map).find((item) => item.toLowerCase() === String(id).toLowerCase());
    return key ? map[key] : null;
  }

  function storedTarget(store, id) {
    const entry = mapValue(store, id);
    if (entry == null) return 0;
    if (typeof entry !== "object") return targetNumber(entry);
    return targetNumber(entry.monthlySalesTarget != null ? entry.monthlySalesTarget : entry.monthly_sales_target);
  }

  function agentTarget(store, row) {
    const fromStore = storedTarget(store, row && row.id);
    if (fromStore > 0) return fromStore;
    return targetNumber(row && row.monthly_sales_target);
  }

  function israelWall() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date());
    const get = (type) => Number(parts.find((part) => part.type === type).value);
    return { year: get("year"), month: get("month"), day: get("day") };
  }

  function israelWorkdays(year, month, throughDay) {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const limit = throughDay == null ? last : Math.min(throughDay, last);
    let count = 0;
    for (let day = 1; day <= limit; day += 1) {
      const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      if (dow <= 4) count += 1;
    }
    return count;
  }

  function goalMonthLabel(year, month) {
    const probe = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0));
    try {
      const name = new Intl.DateTimeFormat("he-IL", { month: "long", timeZone: "Asia/Jerusalem" }).format(probe);
      return name + " " + year;
    } catch (_err) {
      return month + "/" + year;
    }
  }

  function goalPaceText(targetValue, netPremium, workdaysLeft) {
    if (!(targetValue > 0)) return "לא הוגדר יעד חודשי";
    const remaining = Math.max(0, targetValue - (Number(netPremium) || 0));
    if (remaining <= 0) {
      const over = (Number(netPremium) || 0) - targetValue;
      return over > 0 ? "היעד הושג · " + money(over) + " מעבר ליעד" : "היעד הושג";
    }
    const left = Math.max(0, Number(workdaysLeft) || 0);
    if (left <= 0) return "נותר " + money(remaining) + " · אין ימי עבודה נוספים החודש";
    const rate = remaining / left;
    const daysLabel = left === 1 ? "נותר יום עבודה אחד" : "נותרו " + left + " ימי עבודה";
    return daysLabel + " · " + money(Math.round(rate)) + " ליום";
  }

  function goalDelta(curr, prev) {
    const current = Number(curr) || 0;
    const previous = Number(prev) || 0;
    if (!previous && !current) return 0;
    if (!previous) return 100;
    return Math.round((((current - previous) / previous) * 100) * 10) / 10;
  }

  async function loadNetFor(range, ids, names) {
    const args = { p_start: range.start, p_end: range.end };
    if (ids && ids.length) {
      args.p_agent_ids = ids;
      args.p_agent_names = names && names.length ? names : [];
    }
    const res = await sb.rpc("gi_dashboard_net_premium", args);
    if (res.error) throw new Error(res.error.message || "sold");
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    return Number(row && (row.net_premium != null ? row.net_premium : row.netPremium)) || 0;
  }

  async function loadGoalScope(profile) {
    const meta = await sb.from("app_meta").select("targets:payload->agentTargets,assigns:payload->teamManagerAssignments").eq("key", "global").maybeSingle();
    if (meta.error) throw new Error(meta.error.message || "targets");
    const store = asObject(meta.data && meta.data.targets);
    const assigns = asObject(meta.data && meta.data.assigns);
    const ownRes = profile.id
      ? await sb.from("agents").select("id,monthly_sales_target,role,active,name,username").eq("id", profile.id).maybeSingle()
      : { data: null, error: null };
    if (ownRes.error) throw new Error(ownRes.error.message || "agent");
    const own = ownRes.data || { id: profile.id, name: profile.name, username: profile.username, role: profile.role, active: true };
    const namesOf = (row) => [row && row.name, row && row.username].map(trim).filter(Boolean);
    const role = roleKey(profile.role);
    if (role === "manager" || role === "admin") {
      return { target: agentTarget(store, own), ids: null, names: null };
    }
    if (role !== "teammanager") {
      return {
        target: agentTarget(store, own),
        ids: [profile.id].filter(Boolean),
        names: [...new Set(namesOf(profile).concat(namesOf(own)))]
      };
    }
    const team = await sb.from("agents").select("id,monthly_sales_target,role,active,name,username").eq("team_manager_id", profile.id).limit(200);
    if (team.error) throw new Error(team.error.message || "team");
    const rows = (team.data || []).slice();
    const seen = new Set(rows.map((row) => trim(row.id)).filter(Boolean));
    const assigned = mapValue(assigns, profile.id);
    const assignedIds = new Set((Array.isArray(assigned) ? assigned : []).map(trim).filter((id) => id && id !== profile.id));
    const extraIds = [...assignedIds].filter((id) => !seen.has(id));
    if (extraIds.length) {
      const extra = await sb.from("agents").select("id,monthly_sales_target,role,active,name,username").in("id", extraIds.slice(0, 200));
      if (!extra.error) (extra.data || []).forEach((row) => rows.push(row));
    }
    const managed = rows.filter((row) => {
      const id = trim(row.id);
      if (!id || id === profile.id || row.active === false) return false;
      return roleKey(row.role) === "agent" || assignedIds.has(id);
    });
    let sum = 0;
    const ids = [profile.id].filter(Boolean);
    const names = namesOf(profile).concat(namesOf(own));
    managed.forEach((row) => {
      sum += agentTarget(store, row);
      const id = trim(row.id);
      if (id && ids.indexOf(id) === -1) ids.push(id);
      namesOf(row).forEach((name) => names.push(name));
    });
    return { target: Math.round(sum * 100) / 100, ids: ids, names: [...new Set(names)] };
  }

  function paintGoal(metrics) {
    const card = $("goalCard");
    if (!card) return;
    ["success", "strong", "mid", "low"].forEach((tone) => card.classList.remove("bankGoal--" + tone));
    card.classList.add("bankGoal--" + metrics.tone);
    $("goalPct").textContent = formatPct(metrics.pct);
    $("goalPctMeta").textContent = formatPct(metrics.pct);
    $("goalSub").textContent = metrics.target > 0 ? "התקדמות חודשית" : "ממתין להגדרת יעד";
    const fill = Math.max(0, Math.min(metrics.pct, 100));
    $("goalTrack").style.setProperty("--goal-progress", fill + "%");
    const goalFill = $("goalTrack").querySelector("span");
    if (goalFill) goalFill.style.width = fill + "%";
    const targetText = metrics.target > 0 ? money(metrics.target) : "₪0";
    $("goalMonthTarget").textContent = targetText;
    $("goalMonth").textContent = targetText;
    $("goalActual").textContent = money(metrics.net);
    const arrow = Number(metrics.delta) >= 0 ? "↗" : "↘";
    $("goalDelta").textContent = arrow + " " + formatPct(Math.abs(Number(metrics.delta) || 0)) + " בכמות מול חודש קודם";
    $("goalDaily").textContent = money(metrics.daily);
    $("goalPace").textContent = metrics.pace;
    $("goalMonthLabel").textContent = metrics.monthLabel;
  }

  function blankGoal() {
    ["goalPct", "goalSub", "goalPctMeta", "goalMonthTarget", "goalActual", "goalDelta", "goalDaily", "goalPace", "goalMonth", "goalMonthLabel"].forEach(blankMetric);
  }

  async function loadGoalCard() {
    const profile = state.profile;
    if (!profile) return;
    const scope = await loadGoalScope(profile);
    const current = israelMonth(0);
    const previous = israelMonth(-1);
    const net = await loadNetFor(current, scope.ids, scope.names);
    const prev = await loadNetFor(previous, scope.ids, scope.names);
    const wall = israelWall();
    const workdaysTotal = Math.max(1, israelWorkdays(wall.year, wall.month));
    const workdaysElapsed = israelWorkdays(wall.year, wall.month, wall.day);
    const todayWorkday = new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay() <= 4;
    const workdaysLeft = Math.max(0, workdaysTotal - workdaysElapsed + (todayWorkday ? 1 : 0));
    const target = Number(scope.target) || 0;
    const pctRaw = target > 0 ? (net / target) * 100 : 0;
    const pct = Math.max(0, Math.round(pctRaw * 10) / 10);
    const tone = pct >= 100 ? "success" : pct >= 80 ? "strong" : pct >= 40 ? "mid" : "low";
    paintGoal({
      target: target,
      net: net,
      pct: pct,
      tone: tone,
      delta: goalDelta(net, prev),
      daily: target > 0 ? target / workdaysTotal : 0,
      pace: goalPaceText(target, net, workdaysLeft),
      monthLabel: goalMonthLabel(wall.year, wall.month)
    });
  }

  function paintHomeSide() {
    const feed = $("homeActivity");
    if (feed) {
      const items = (state.alerts || []).slice(0, 4);
      feed.innerHTML = items.length ? items.map((item) => {
        const closed = String(item.id).indexOf("closed:") === 0;
        return '<article class="feedCard"><b>' + esc(closed ? "ליד נסגר" : "מכירה") + "</b><span>" + esc([item.agent, item.customer].filter(Boolean).join(" · ")) + "</span></article>";
      }).join("") : '<div class="empty">אין פעילות להצגה</div>';
    }
    const tasks = $("homeTasks");
    if (tasks) {
      const now = Date.now();
      const upcoming = (state.homeReminders || []).filter((row) => {
        const at = Date.parse(row.remind_at);
        return Number.isFinite(at) && at >= now;
      }).slice(0, 3);
      tasks.innerHTML = upcoming.length ? upcoming.map((row) => '<article class="feedCard"><b>' + esc(reminderTitle(row)) + "</b><span>" + esc([trim(row.customer_name), reminderWhen(row.remind_at)].filter(Boolean).join(" · ")) + "</span></article>").join("") : '<div class="empty">אין משימות קרובות</div>';
    }
  }

  function cancellationPremium(report) {
    const sheets = report && Array.isArray(report.sheets) ? report.sheets : [];
    return sheets.reduce((sum, sheet) => {
      const total = cancelStats(sheet).total.premium;
      return Math.round((sum + total) * 100) / 100;
    }, 0);
  }

  async function refreshHomeMetrics() {
    if (!state.profile || state.homeBusy) return;
    state.homeBusy = true;
    const notes = [];
    try {
      await loadScope();
      try {
        const report = await loadReport(true);
        const stats = reportStats(report);
        $("tileIssued").textContent = money(stats.issued);
        $("tilePending").textContent = money(stats.pending);
        $("homeSummary").textContent = money(stats.pending + stats.issued);
      } catch (_err) {
        blankMetric("tileIssued");
        blankMetric("tilePending");
        blankMetric("homeSummary");
        notes.push("דוח המכירות לא נטען");
      }
      if ($("tileLeads")) {
        try { $("tileLeads").textContent = String(await countIncomingLeads()); }
        catch (_err) { blankMetric("tileLeads"); notes.push("ספירת הלידים לא נטענה"); }
      }
      if ($("statCustomers") || $("statActive")) {
        try {
          if ($("statCustomers")) $("statCustomers").textContent = String(await countCustomers(false));
          if ($("statActive")) $("statActive").textContent = String(await countCustomers(true));
        } catch (_err) {
          blankMetric("statCustomers");
          blankMetric("statActive");
          notes.push("ספירת הלקוחות לא נטענה");
        }
      }
      try {
        state.homeReminders = await loadMyReminders();
        if ($("statTasks")) {
          const today = israelDateKey();
          const due = state.homeReminders.filter((row) => stampDateIL(row.remind_at) === today).length;
          $("statTasks").textContent = String(due);
        }
      } catch (_err) {
        state.homeReminders = [];
        blankMetric("statTasks");
      }
      paintHomeSide();
      try { $("tileSold").textContent = money(await loadNet(israelRange())); }
      catch (_err) { blankMetric("tileSold"); notes.push("נמכר היום לא נטען"); }
      if ($("tileCancel")) {
        try { $("tileCancel").textContent = money(cancellationPremium(await loadCancellations())); }
        catch (_err) { blankMetric("tileCancel"); notes.push("פרמיית הביטול לא נטענה"); }
      }
      try { await loadGoalCard(); }
      catch (_err) { blankGoal(); notes.push("ביצועים מול יעד לא נטענו"); }
      if ($("homeNote")) $("homeNote").textContent = notes.join(" · ");
    } finally {
      state.homeBusy = false;
    }
  }

  async function enterApp() {
    await loadScope();
    paintHomeIdentity();
    show("home");
    startAlertPoll();
    void ensureChatBadge();
    const lead = new URLSearchParams(window.location.search).get("lead");
    if (lead) void openLead(lead);
  }

  function shiftDay(key, delta) {
    const parts = String(key || "").split("-").map(Number);
    const dt = new Date(Date.UTC(parts[0], (parts[1] || 1) - 1, (parts[2] || 1) + delta));
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return dt.getUTCFullYear() + "-" + mm + "-" + dd;
  }

  function taskInTab(row, tab) {
    if (tab === "done" || tab === "all") return true;
    const at = Date.parse(row.remind_at);
    if (tab === "today") return stampDateIL(row.remind_at) === israelDateKey();
    if (tab === "week") return Number.isFinite(at) && at >= Date.now() - 86400000 && at < Date.now() + 7 * 86400000;
    return true;
  }

  function taskCard(row, done) {
    const label = reminderTitle(row);
    const details = trim(row.details);
    const at = Date.parse(row.remind_at);
    const due = !done && Number.isFinite(at) && at <= Date.now();
    const meta = [details && details !== label ? details : "", trim(row.customer_name), reminderWhen(row.remind_at)].filter(Boolean).join(" · ");
    const button = done ? "" : '<button type="button" data-done="' + esc(row.id) + '">בוצע</button>';
    return '<article class="remindCard' + (due ? " is-due" : "") + '"><div><b>' + esc(label) + "</b><span>" + esc(meta) + (due ? " · הגיע" : "") + "</span></div>" + button + "</article>";
  }

  function paintTasks(rows) {
    const host = $("taskList");
    if (!host) return;
    const shown = (rows || []).filter((row) => !isMeeting(row));
    host.innerHTML = shown.length ? shown.map((row) => taskCard(row, false)).join("") : "";
  }

  async function loadDoneReminders() {
    const name = trim(state.profile && state.profile.name);
    if (!name) return [];
    const res = await sb.from("reminders")
      .select("id,type,details,remind_at,customer_name,is_done")
      .eq("agent_id", name)
      .eq("is_done", true)
      .order("remind_at", { ascending: false })
      .limit(40);
    if (res.error) throw new Error(res.error.message || "reminders");
    return res.data || [];
  }

  async function openTasks() {
    show("tasks");
    const host = $("taskList");
    if (host) host.innerHTML = "";
    try {
      const rows = await loadRemindersShared();
      state.myReminders = rows;
      paintTasks(rows);
    } catch (_err) {
      if (host) host.innerHTML = '<div class="empty">לא ניתן לטעון משימות</div>';
    }
  }

  function wazeHref(address) {
    const text = trim(address);
    if (!text) return "";
    return "https://waze.com/ul?q=" + encodeURIComponent(text) + "&navigate=yes";
  }

  function meetingCard(row) {
    const address = trim(row.details);
    const href = wazeHref(address);
    const nav = href ? '<a class="meetNav" href="' + esc(href) + '" target="_blank" rel="noopener">ניווט</a>' : "";
    return '<article class="meetCard"><b>' + esc(trim(row.customer_name) || "פגישה") + "</b>"
      + (address ? "<span>" + esc(address) + "</span>" : "")
      + "<span>" + esc(reminderWhen(row.remind_at)) + "</span>" + nav + "</article>";
  }

  function shiftMonth(ym, delta) {
    const parts = String(ym || israelDateKey().slice(0, 7)).split("-").map(Number);
    const dt = new Date(Date.UTC(parts[0], (parts[1] || 1) - 1 + delta, 1));
    return dt.getUTCFullYear() + "-" + String(dt.getUTCMonth() + 1).padStart(2, "0");
  }

  function clampMonthDay(ym, dayKey) {
    const want = Number(String(dayKey || "").slice(8, 10)) || Number(israelDateKey().slice(8, 10)) || 1;
    const parts = String(ym).split("-").map(Number);
    const last = new Date(Date.UTC(parts[0], parts[1], 0)).getUTCDate();
    const day = Math.min(Math.max(want, 1), last);
    return ym + "-" + String(day).padStart(2, "0");
  }

  function reminderMarks(rows) {
    const map = new Map();
    (rows || []).forEach((row) => {
      const key = stampDateIL(row.remind_at);
      if (!key) return;
      const label = trim(row.customer_name) || trim(row.details) || "תזכורת";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(label);
    });
    return map;
  }

  function calendarHtml(ym, opts) {
    const today = israelDateKey();
    const names = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
    const parts = String(ym).split("-").map(Number);
    const title = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(parts[0], parts[1] - 1, 1, 12)));
    const blanks = new Date(Date.UTC(parts[0], parts[1] - 1, 1)).getUTCDay();
    const count = new Date(Date.UTC(parts[0], parts[1], 0)).getUTCDate();
    const marks = opts.marks || new Map();
    const selected = opts.selected || "";
    let cells = names.map((name) => '<span class="monthCal__dow">' + name + "</span>").join("");
    for (let i = 0; i < blanks; i += 1) cells += "<span></span>";
    for (let day = 1; day <= count; day += 1) {
      const key = ym + "-" + String(day).padStart(2, "0");
      const items = marks.get(key) || [];
      const classes = ["monthCal__day"];
      if (key === today) classes.push("is-today");
      if (key === selected) classes.push("is-on");
      if (items.length) classes.push("is-mark");
      const note = items.length ? (items.length > 1 ? items[0] + " · " + items.length : items[0]) : "";
      cells += '<button type="button" class="' + classes.join(" ") + '" ' + opts.dayAttr + '="' + key + '"><strong>' + day + "</strong>"
        + (note ? "<small>" + esc(note) + "</small>" : "") + "</button>";
    }
    if (opts.fill) {
      const used = blanks + count;
      const tail = (7 - (used % 7)) % 7;
      for (let i = 0; i < tail; i += 1) cells += "<span></span>";
      const weeks = Math.ceil(used / 7);
      for (let week = weeks; week < 6; week += 1) {
        for (let i = 0; i < 7; i += 1) cells += "<span></span>";
      }
    }
    return '<div class="monthCal__bar"><button type="button" ' + opts.monthAttr + '="-1" aria-label="חודש קודם">‹</button><strong>' + esc(title) + '</strong><button type="button" ' + opts.monthAttr + '="1" aria-label="חודש הבא">›</button></div><div class="monthCal__grid">' + cells + "</div>";
  }

  function paintMeetings(rows) {
    const host = $("meetCal");
    if (!host) return;
    if (!state.meetMonth) state.meetMonth = israelDateKey().slice(0, 7);
    host.innerHTML = calendarHtml(state.meetMonth, {
      marks: reminderMarks(rows),
      dayAttr: "data-cal-day",
      monthAttr: "data-cal-month",
      fill: true,
      selected: state.meetDay || ""
    });
  }

  async function openMeetings() {
    show("meetings");
    if (!state.meetMonth) state.meetMonth = israelDateKey().slice(0, 7);
    paintMeetings(state.meetRows || []);
    try {
      state.meetRows = await loadRemindersShared();
      paintMeetings(state.meetRows);
    } catch (_err) {
      const host = $("meetCal");
      if (host) host.insertAdjacentHTML("beforeend", '<p class="empty">לא ניתן לטעון פגישות</p>');
    }
  }

  let meetDraft = null;

  function israelDateTime(dateKey, timeText) {
    const dateParts = String(dateKey || "").split("-").map(Number);
    const timeParts = String(timeText || "").split(":").map(Number);
    const y = dateParts[0];
    const m = dateParts[1];
    const d = dateParts[2];
    const hh = timeParts[0];
    const mm = timeParts[1] || 0;
    if (!y || !m || !d || !Number.isFinite(hh)) return null;
    const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(guess);
    const get = (type) => Number(parts.find((part) => part.type === type).value);
    const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return new Date(Date.UTC(y, m - 1, d, hh, mm, 0) - (wall - guess.getTime()));
  }

  function paintMeetInvite() {
    const host = $("meetInvite");
    const save = $("meetSave");
    if (!host) return;
    const draft = meetDraft;
    if (!draft || !draft.customer) {
      host.innerHTML = "";
      if (save) save.disabled = true;
      return;
    }
    const href = wazeHref(draft.address);
    const nav = href ? '<a class="meetNav" href="' + esc(href) + '" target="_blank" rel="noopener">ניווט</a>' : "";
    host.innerHTML = '<article class="meetInvite"><b>' + esc(draft.customer.full_name || "לקוח") + "</b>"
      + (draft.customer.id_number ? '<span dir="ltr">' + esc(draft.customer.id_number) + "</span>" : "")
      + (draft.customer.phone ? "<span>" + esc(draft.customer.phone) + "</span>" : "")
      + (draft.address ? "<span>" + esc(draft.address) + "</span>" : "<span>אין כתובת שמורה ללקוח</span>")
      + "<span>" + esc(String(draft.date || "").split("-").reverse().join(".")) + " · 09:00</span>"
      + nav + "</article>";
    if (save) save.disabled = false;
  }

  function openMeetSheet() {
    meetDraft = null;
    const date = $("meetDate");
    if (date) date.value = state.meetDay || israelDateKey();
    const query = $("meetQuery");
    if (query) query.value = "";
    const pick = $("meetPick");
    if (pick) pick.innerHTML = "";
    const error = $("meetError");
    if (error) error.textContent = "";
    paintMeetInvite();
    const sheet = $("meetSheet");
    if (sheet) sheet.hidden = false;
  }

  async function chooseMeetCustomer(row) {
    const error = $("meetError");
    if (error) error.textContent = "";
    let file = row;
    try {
      const loaded = await loadCustomerFile(row.id);
      if (loaded) file = loaded;
    } catch (_err) {}
    meetDraft = {
      date: trim($("meetDate") && $("meetDate").value) || state.meetDay || israelDateKey(),
      customer: file,
      address: customerAddress(file)
    };
    const pick = $("meetPick");
    if (pick) pick.innerHTML = "";
    paintMeetInvite();
  }

  async function findMeetCustomer() {
    const error = $("meetError");
    const pick = $("meetPick");
    const fail = (message) => { if (error) error.textContent = message; };
    if (error) error.textContent = "";
    meetDraft = null;
    paintMeetInvite();
    const q = trim($("meetQuery") && $("meetQuery").value);
    if (!q) { fail("יש לרשום תעודת זהות או שם"); return; }
    const digits = q.replace(/\D/g, "");
    let query = sb.from("customers").select("id,full_name,id_number,phone,email,status,is_archived,agent_id").eq("is_archived", false).limit(8);
    if (state.scope) query = query.in("agent_id", state.scope.ids);
    if (digits.length >= 5) query = query.ilike("id_number", "%" + digits + "%");
    else {
      const safe = q.replace(/[%_,.()]/g, " ").trim();
      if (!safe) { fail("יש לרשום תעודת זהות או שם"); return; }
      query = query.ilike("full_name", "%" + safe + "%");
    }
    const button = $("meetFind");
    setBusy(button, true);
    try {
      const res = await query;
      if (res.error) throw new Error(res.error.message || "customers");
      const rows = res.data || [];
      if (!rows.length) {
        if (pick) pick.innerHTML = "";
        fail("הלקוח לא נמצא. לא נוצר לקוח חדש.");
        return;
      }
      if (rows.length === 1) {
        await chooseMeetCustomer(rows[0]);
        return;
      }
      if (pick) {
        pick.innerHTML = '<div class="meetPick">' + rows.map((row) => '<button type="button" data-meet="' + esc(row.id) + '">' + esc(trim(row.full_name) || "לקוח") + (row.id_number ? " · " + esc(row.id_number) : "") + "</button>").join("") + "</div>";
        pick.querySelectorAll("[data-meet]").forEach((node) => {
          node.addEventListener("click", () => {
            const id = node.getAttribute("data-meet");
            const row = rows.find((item) => item.id === id);
            if (row) void chooseMeetCustomer(row);
          });
        });
      }
    } catch (_err) {
      fail("לא ניתן לאתר את הלקוח");
    } finally {
      setBusy(button, false);
    }
  }

  async function saveMeeting() {
    const error = $("meetError");
    const fail = (message) => { if (error) error.textContent = message; };
    const draft = meetDraft;
    const dateVal = trim($("meetDate") && $("meetDate").value) || (draft && draft.date);
    if (!draft || !draft.customer) { fail("יש לאתר לקוח קיים"); return; }
    if (!dateVal) { fail("יש לבחור תאריך"); return; }
    const remindAt = israelDateTime(dateVal, "09:00");
    if (!remindAt || !Number.isFinite(remindAt.getTime())) { fail("התאריך לא תקין"); return; }
    const name = trim(state.profile && state.profile.name) || "מערכת";
    const row = {
      id: "meet_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      agent_id: name,
      // reminders_type_check accepts callback, documents, and missing. The meet_ id keeps this a meeting.
      type: "callback",
      details: trim(draft.address) || "פגישה",
      remind_at: remindAt.toISOString(),
      customer_id: draft.customer.id || null,
      customer_name: trim(draft.customer.full_name) || null,
      lead_id: null,
      proposal_id: null,
      link_kind: null,
      is_done: false,
      created_at: new Date().toISOString(),
      snoozed_until: null
    };
    const button = $("meetSave");
    setBusy(button, true);
    try {
      const res = await sb.from("reminders").insert(row);
      if (res.error) throw new Error(res.error.message || "meeting");
      state.meetDay = dateVal;
      const sheet = $("meetSheet");
      if (sheet) sheet.hidden = true;
      meetDraft = null;
      await openMeetings();
    } catch (err) {
      fail("הפגישה לא נשמרה: " + (err.message || ""));
      setBusy(button, false);
    }
  }

  function paintDocuments() {
    const cats = ["פוליסות", "הצעות ביטוח", "טפסים והצהרות", "מסמכים פיננסיים", "מסמכים כלליים"];
    const host = $("docCats");
    if (host) {
      host.innerHTML = cats.map((name) => '<button class="docCat" type="button" data-doc="' + esc(name) + '"><i aria-hidden="true">📄</i><span>' + esc(name) + "</span></button>").join("");
    }
    const empty = $("docEmpty");
    if (empty) empty.textContent = state.docCat ? "אין רשימת מסמכים נפרדת עבור " + state.docCat + ". המסמך נפתח מתיק הלקוח." : "אין מסמכים להצגה מחוץ לתיק הלקוח.";
  }

  const OFFER_STEPS = [
    { id: 1, title: "פרטי לקוח" },
    { id: 3, title: "פוליסות קיימות" },
    { id: 4, title: "התאמת צרכים" },
    { id: 5, title: "פוליסות חדשות" },
    { id: 6, title: "פרטי משלם" },
    { id: 7, title: "הצהרת בריאות" },
    { id: 8, title: "תיאום שיחה וסיום הקמה" }
  ];
  const OFFER_CLINICS = ["כללית", "מכבי", "מאוחדת", "לאומית", "קופה צהלית"];
  const OFFER_SHABAN = {
    "כללית": ["אין שב״ן", "כללית מושלם", "כללית פלטינום"],
    "מכבי": ["אין שב״ן", "מכבי זהב", "מכבי שלי"],
    "מאוחדת": ["אין שב״ן", "מאוחדת עדיף", "מאוחדת שיא"],
    "לאומית": ["אין שב״ן", "לאומית כסף", "לאומית זהב"],
    "קופה צהלית": ["אין שב״ן"]
  };
  const OFFER_COMPANIES = ["איילון", "כלל", "מגדל", "מנורה", "הפניקס", "הכשרה", "מדיקר"];
  const OFFER_EXISTING = ["איילון", "הראל", "כלל", "מגדל", "מנורה", "הפניקס", "הכשרה", "AIG", "ביטוח ישיר", "9 מיליון", "שומרה", "שלמה", "ליברה", "ווישור", "שירביט", "חקלאי"];
  const OFFER_TYPES = ["בריאות", "מחלות קשות", "סרטן", "אובדן כושר עבודה", "ריסק", "ריסק משכנתא"];
  const OFFER_COVERS = ["ניתוחים ומחליפי ניתוח בישראל (משלים שב״ן)", "ניתוחים ומחליפי ניתוח בישראל מהשקל הראשון", "השתלות", "תרופות", "אמבולטורי (ייעוצים ובדיקות)", "אבחון מהיר"];
  const OFFER_BANKS = ["בנק הפועלים", "בנק לאומי", "בנק דיסקונט", "בנק מזרחי טפחות", "הבנק הבינלאומי", "בנק מרכנתיל", "בנק אוצר החייל", "בנק יהב", "בנק מסד", "בנק ירושלים"];
  const OFFER_HEALTH = [
    "האם אושפזת בחמש השנים האחרונות?",
    "האם אובחנת במחלת לב, לחץ דם, סוכרת או כולסטרול?",
    "האם אובחנת במחלה ממארת או בגידול?",
    "האם עברת ניתוח?",
    "האם קיימת מגבלה גופנית או נכות?",
    "האם אתה נוטל תרופות באופן קבוע?",
    "האם יש מעקב רפואי או בדיקות חריגות?"
  ];
  const OFFER_PREGNANCY = "האם קיימת כיום הריון?";
  let offer = null;

  function offerBlankInsured(type) {
    const label = type === "spouse" ? "בן/בת זוג" : type === "child" ? "ילד" : "מבוטח ראשי";
    return {
      id: "ins_" + Date.now().toString(16) + Math.random().toString(16).slice(2, 6),
      label: label,
      type: type || "primary",
      data: {
        firstName: "", lastName: "", idNumber: "", birthDate: "", gender: "",
        clinic: "", shaban: "", maritalStatus: "", occupation: "", idIssueDate: "",
        smokingStatus: "", smokingType: "", smokingAmount: "",
        phone: "", email: "", city: "", street: "", houseNumber: "", apartment: "", zip: "",
        heightCm: "", weightKg: "", bmi: "",
        existingPolicies: [],
        cancellations: {}
      }
    };
  }

  function offerFresh() {
    const primary = offerBlankInsured("primary");
    return {
      step: 0,
      active: 0,
      customerId: "",
      proposalId: "",
      insureds: [primary],
      needsKey: "",
      policies: [],
      draft: offerBlankPolicy(primary.id),
      exist: { company: "", type: "", policyNumber: "", monthlyPremium: "", status: "keep", reason: "" },
      health: {},
      agentNumbers: {},
      mirror: { date: "", time: "", note: "", unscheduled: false },
      payerChoice: "self",
      paymentMethod: "cc",
      externalPayer: { firstName: "", lastName: "", idNumber: "", phone: "" },
      cc: { holderName: "", holderId: "", cardNumber: "", exp: "" },
      ho: { bankName: "", bankNo: "", branch: "", account: "" },
      busy: false
    };
  }

  function offerBlankPolicy(insuredId) {
    return {
      company: "", type: "", insuredId: insuredId || "", startDate: "", premium: "",
      covers: [], sumInsured: "", compensation: "", salary: "", quoteOk: false, quoteNote: ""
    };
  }

  function offerDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function offerIso(value) {
    const raw = trim(value);
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return raw;
    const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!dmy) return "";
    return dmy[3] + "-" + dmy[2].padStart(2, "0") + "-" + dmy[1].padStart(2, "0");
  }

  function offerDmy(value) {
    const iso = offerIso(value);
    if (!iso) return "";
    const parts = iso.split("-");
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function offerBmi(height, weight) {
    const h = Number(height);
    const w = Number(weight);
    if (!(h > 0) || !(w > 0)) return "";
    return String(Math.round((w / ((h / 100) * (h / 100))) * 10) / 10);
  }

  function offerBmiTone(bmi) {
    const n = Number(bmi);
    if (!(n > 0)) return { lamp: "", label: "מלא גובה ומשקל" };
    if (n >= 18.5 && n <= 24.9) return { lamp: "green", label: "תקין" };
    if (n >= 25 && n <= 29.9) return { lamp: "yellow", label: "עודף משקל" };
    if (n >= 30) return { lamp: "red", label: "השמנה" };
    return { lamp: "", label: "מתחת לטווח" };
  }

  function offerHasExisting() {
    return offer.insureds.some((ins) => (ins.data.existingPolicies || []).length);
  }

  function offerNeedOptions() {
    if (!offerHasExisting()) return [{ key: "new_cover", label: "רכישת ביטוח חדש" }];
    return [
      { key: "hozala", label: "הוזלה" },
      { key: "expansion", label: "הרחבה" },
      { key: "new_cover", label: "כיסוי חדש" }
    ];
  }

  function offerQuestions(ins) {
    const list = OFFER_HEALTH.slice();
    if (ins && ins.data && ins.data.gender === "נקבה" && ins.type !== "child") list.push(OFFER_PREGNANCY);
    return list;
  }

  function offerSelect(key, current, options, placeholder) {
    const rows = ['<option value="">' + esc(placeholder || "בחירה") + "</option>"].concat(options.map((item) => {
      return '<option value="' + esc(item) + '"' + (item === current ? " selected" : "") + ">" + esc(item) + "</option>";
    }));
    return '<select class="input" data-k="' + esc(key) + '" data-render="1">' + rows.join("") + "</select>";
  }

  function offerAmountParts(value) {
    const cleaned = String(value == null ? "" : value).replace(/[^\d.]/g, "");
    if (!cleaned) return "";
    const dot = cleaned.indexOf(".");
    const intRaw = (dot >= 0 ? cleaned.slice(0, dot) : cleaned).replace(/^0+(?=\d)/, "") || "0";
    const frac = dot >= 0 ? cleaned.slice(dot + 1).replace(/\./g, "") : "";
    const grouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return grouped + "." + (frac === "" ? "0" : frac);
  }

  function offerAmountFromNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    const rounded = Math.round(n * 100) / 100;
    return offerAmountParts(String(rounded));
  }

  function offerMoneyNumber(value) {
    const n = Number(String(value == null ? "" : value).replace(/,/g, "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function offerApplyAmount(el) {
    const raw = String(el.value || "");
    const hadDot = raw.replace(/[^\d.]/g, "").indexOf(".") >= 0;
    const formatted = offerAmountParts(raw);
    if (el.value !== formatted) {
      el.value = formatted;
      const pos = hadDot ? formatted.length : Math.max(0, formatted.indexOf("."));
      try { el.setSelectionRange(pos, pos); } catch (_err) {}
    }
    return formatted;
  }

  function offerText(key, value, mode) {
    if (mode === "amount") {
      return '<input class="input" data-k="' + esc(key) + '" data-amount="1" type="text" inputmode="decimal" dir="ltr" value="' + esc(offerAmountParts(value)) + '"/>';
    }
    const type = mode === "email" ? "email" : mode === "tel" ? "tel" : "text";
    const extra = mode === "numeric" || mode === "tel" ? ' inputmode="' + (mode === "tel" ? "tel" : "numeric") + '" dir="ltr"' : (mode === "email" ? ' dir="ltr"' : "");
    return '<input class="input" data-k="' + esc(key) + '" type="' + type + '"' + extra + ' value="' + esc(value || "") + '"/>';
  }

  function offerDate(key, value) {
    return '<input class="input" data-k="' + esc(key) + '" type="date" value="' + esc(offerIso(value)) + '"/>';
  }

  function offerField(label, control) {
    return '<label class="field">' + esc(label) + control + "</label>";
  }

  function offerChips(key, current, options) {
    return '<div class="offerChips">' + options.map((item) => {
      const value = typeof item === "string" ? item : item.key;
      const label = typeof item === "string" ? item : item.label;
      const on = value === current ? " is-on" : "";
      return '<button class="offerChip' + on + '" type="button" data-chip="' + esc(key) + '" data-val="' + esc(value) + '">' + esc(label) + "</button>";
    }).join("") + "</div>";
  }

  function offerPersonBar() {
    const people = offer.insureds.map((ins, index) => {
      return '<button type="button" data-person="' + index + '"' + (index === offer.active ? ' class="is-on"' : "") + ">" + esc(ins.label) + "</button>";
    }).join("");
    return '<div class="offerPeople">' + people + "</div>";
  }

  function offerActive() {
    return offer.insureds[offer.active] || offer.insureds[0];
  }

  function offerStep1() {
    const ins = offerActive();
    const d = ins.data;
    const child = ins.type === "child";
    const shaban = OFFER_SHABAN[d.clinic] || [];
    let body = offerPersonBar();
    body += '<article class="offerCard"><h2>פרטים בסיסיים</h2>'
      + offerField("שם פרטי", offerText("firstName", d.firstName))
      + offerField("שם משפחה", offerText("lastName", d.lastName))
      + offerField("ת״ז", offerText("idNumber", d.idNumber, "numeric"))
      + "</article>";
    body += '<article class="offerCard"><h2>פרטים אישיים</h2>'
      + offerField("תאריך לידה", offerDate("birthDate", d.birthDate))
      + '<p class="offerHint">מין</p>' + offerChips("gender", d.gender, ["זכר", "נקבה"]);
    if (!child) {
      body += offerField("קופת חולים", offerSelect("clinic", d.clinic, OFFER_CLINICS, "קופת חולים"))
        + (d.clinic && d.clinic !== "קופה צהלית" ? offerField("שב״ן", offerSelect("shaban", d.shaban, shaban, "שב״ן")) : "")
        + offerField("מצב משפחתי", offerSelect("maritalStatus", d.maritalStatus, ["רווק/ה", "נשוי/אה", "גרוש/ה", "אלמן/ה", "ידוע/ה בציבור"], "מצב משפחתי"))
        + offerField("עיסוק", offerText("occupation", d.occupation))
        + '<p class="offerHint">האם מעשן/ת או עישנת בשנתיים האחרונות?</p>'
        + offerChips("smokingStatus", d.smokingStatus, [{ key: "no", label: "לא" }, { key: "yes", label: "כן" }]);
      if (d.smokingStatus === "yes") {
        body += offerChips("smokingType", d.smokingType, ["סיגריות", "טבק", "נרגילה", "סיגריה אלקטרונית", "קנאביס"]);
        if (d.smokingType === "סיגריות" || d.smokingType === "טבק") body += offerField("כמות ליום", offerText("smokingAmount", d.smokingAmount, "numeric"));
      }
      body += offerField("תאריך הנפקת ת״ז", offerDate("idIssueDate", d.idIssueDate));
    }
    body += "</article>";
    if (child) {
      const p = offer.insureds[0].data;
      body += '<article class="offerCard"><h2>פרטי קשר</h2><p class="offerHint">לקטין פרטי הקשר נמשכים מהמבוטח הראשי: '
        + esc([p.phone, p.city, p.street, p.houseNumber].filter(Boolean).join(" · ") || "טרם מולאו") + "</p></article>";
    } else {
      body += '<article class="offerCard"><h2>פרטי קשר וכתובת</h2>'
        + offerField("טלפון", offerText("phone", d.phone, "tel"))
        + offerField("מייל", offerText("email", d.email, "email"))
        + offerField("עיר / יישוב", offerText("city", d.city))
        + offerField("רחוב", offerText("street", d.street))
        + '<div class="offerRow">' + offerField("מספר בית", offerText("houseNumber", d.houseNumber, "numeric")) + offerField("דירה", offerText("apartment", d.apartment, "numeric")) + "</div>"
        + offerField("מיקוד", offerText("zip", d.zip, "numeric"))
        + "</article>";
    }
    if (ins.type === "primary") {
      body += '<button class="offerAdd" type="button" data-add="spouse">הוסף בן/בת זוג</button>'
        + '<button class="offerAdd" type="button" data-add="child">הוסף ילד</button>';
    } else {
      body += '<button class="offerAdd" type="button" data-drop="1">הסר את ' + esc(ins.label) + "</button>";
    }
    return body;
  }

  function offerStep3() {
    const ins = offerActive();
    const rows = (ins.data.existingPolicies || []).map((policy, index) => {
      const cancel = ins.data.cancellations && ins.data.cancellations[policy.id];
      const status = cancel && cancel.status === "full" ? "ביטול מלא" : cancel && cancel.status === "partial_health" ? "ביטול חלקי" : "נשמר";
      const premium = policy.monthlyPremium ? offerAmountFromNumber(policy.monthlyPremium) : "";
      return '<div class="offerItem"><div><b>' + esc(policy.company || "פוליסה") + "</b><span>" + esc([policy.type, policy.policyNumber, premium ? "₪" + premium : "", status].filter(Boolean).join(" · ")) + "</span></div><button type=\"button\" data-drop-exist=\"" + index + "\">הסר</button></div>";
    }).join("");
    const draft = offer.exist;
    return offerPersonBar()
      + '<article class="offerCard"><h2>פוליסות קיימות</h2><p class="offerHint">אפשר להמשיך בלי פוליסה קיימת. פוליסה שמבטלים דורשת פירוט.</p>'
      + '<div class="offerList">' + rows + "</div>"
      + offerField("חברה", offerSelect("exist.company", draft.company, OFFER_EXISTING, "חברה"))
      + offerField("מוצר", offerSelect("exist.type", draft.type, OFFER_TYPES, "מוצר"))
      + offerField("מספר פוליסה", offerText("exist.policyNumber", draft.policyNumber))
      + offerField("פרמיה חודשית", offerText("exist.monthlyPremium", draft.monthlyPremium, "numeric"))
      + offerChips("exist.status", draft.status, [{ key: "keep", label: "נשמר" }, { key: "partial_health", label: "ביטול חלקי" }, { key: "full", label: "ביטול מלא" }])
      + (draft.status === "keep" ? "" : offerField("פירוט הביטול", '<textarea class="input" data-k="exist.reason">' + esc(draft.reason || "") + "</textarea>"))
      + '<div class="offerPair"><button class="offerAdd" type="button" data-add="exist">הוסף פוליסה קיימת</button>'
      + '<button class="offerAdd" type="button" data-har="1">קובץ הר ביטוח</button></div></article>';
  }

  function offerStep4() {
    const options = offerNeedOptions();
    const hint = offerHasExisting()
      ? "חובה לבחור אחד: הוזלה, הרחבה או כיסוי חדש."
      : "ללקוח אין פוליסות קיימות — חובה לבחור רכישת ביטוח חדש.";
    return '<article class="offerCard"><h2>שיקולים עיקריים במתן ההמלצה</h2><p class="offerHint">' + esc(hint) + "</p>"
      + offerChips("needs", offer.needsKey, options) + "</article>";
  }

  function offerStep5() {
    const rows = offer.policies.map((policy, index) => {
      const premium = policy.premiumMonthly ? "₪" + offerAmountFromNumber(policy.premiumMonthly) : "";
      return '<div class="offerItem"><div class="offerItem__brand">' + simLogoHtml(policy.company, "offerLogo") + "<div><b>" + esc(policy.company || "פוליסה") + "</b><span>" + esc([policy.type, premium].filter(Boolean).join(" · ")) + "</span></div></div><button type=\"button\" data-drop-pol=\"" + index + "\">הסר</button></div>";
    }).join("");
    const draft = offer.draft;
    const insuredOptions = offer.insureds.map((ins) => '<option value="' + esc(ins.id) + '"' + (ins.id === draft.insuredId ? " selected" : "") + ">" + esc(ins.label) + "</option>").join("");
    let extra = "";
    if (draft.type === "בריאות") {
      extra = '<p class="offerHint">כיסויי בריאות</p><div class="offerChips">' + OFFER_COVERS.map((cover) => {
        const on = draft.covers.indexOf(cover) >= 0 ? " is-on" : "";
        return '<button class="offerChip' + on + '" type="button" data-cover="' + esc(cover) + '">' + esc(cover) + "</button>";
      }).join("") + "</div>";
    } else if (draft.type === "ריסק" || draft.type === "ריסק משכנתא") {
      extra = offerField("סכום ביטוח", offerText("draft.sumInsured", draft.sumInsured, "amount"));
    } else if (draft.type === "סרטן" || draft.type === "מחלות קשות") {
      extra = offerField("סכום פיצוי", offerText("draft.compensation", draft.compensation, "amount"));
    } else if (draft.type === "אובדן כושר עבודה") {
      extra = offerField("שכר", offerText("draft.salary", draft.salary, "amount"));
    }
    const price = draft.quoteOk && draft.premium ? "₪" + draft.premium : "";
    return '<article class="offerCard"><h2>פוליסות חדשות</h2><p class="offerHint">חובה להוסיף לפחות פוליסה אחת לפני שממשיכים. המחיר נלקח מהסימולטור של החברה והמוצר.</p>'
      + '<div class="offerList">' + rows + "</div>"
      + offerField("חברת ביטוח", offerSelect("draft.company", draft.company, OFFER_COMPANIES, "חברה"))
      + offerField("מוצר ביטוח", offerSelect("draft.type", draft.type, OFFER_TYPES, "מוצר"))
      + offerField("מבוטח", '<select class="input" data-k="draft.insuredId" data-render="1">' + insuredOptions + "</select>")
      + extra
      + offerField("תאריך תחילת ביטוח", offerDate("draft.startDate", draft.startDate))
      + '<label class="field">פרמיה חודשית לאחר הנחה<strong class="offerPrice" data-price="1">' + esc(price) + "</strong></label>"
      + '<p class="offerHint" id="offerPrice"></p>'
      + '<button class="offerAdd" type="button" data-add="policy">הוסף פוליסה להצעה</button></article>';
  }

  function offerStep6() {
    let body = '<article class="offerCard"><h2>פרטי משלם</h2>'
      + offerField("מי משלם", '<select class="input" data-k="payerChoice" data-render="1"><option value="self"' + (offer.payerChoice === "self" ? " selected" : "") + '>המבוטח משלם</option><option value="external"' + (offer.payerChoice === "external" ? " selected" : "") + ">משלם אחר</option></select>")
      + offerField("אמצעי תשלום", '<select class="input" data-k="paymentMethod" data-render="1"><option value="cc"' + (offer.paymentMethod !== "ho" ? " selected" : "") + '>כרטיס אשראי</option><option value="ho"' + (offer.paymentMethod === "ho" ? " selected" : "") + ">הוראת קבע</option></select>");
    if (offer.payerChoice === "external") {
      const ext = offer.externalPayer;
      body += offerField("שם פרטי של המשלם", offerText("ext.firstName", ext.firstName))
        + offerField("שם משפחה של המשלם", offerText("ext.lastName", ext.lastName))
        + offerField("ת״ז משלם", offerText("ext.idNumber", ext.idNumber, "numeric"))
        + offerField("טלפון משלם", offerText("ext.phone", ext.phone, "tel"));
    }
    if (offer.paymentMethod === "ho") {
      const ho = offer.ho;
      body += offerField("בנק", offerSelect("ho.bankName", ho.bankName, OFFER_BANKS, "בנק"))
        + offerField("מספר בנק", offerText("ho.bankNo", ho.bankNo, "numeric"))
        + offerField("סניף", offerText("ho.branch", ho.branch, "numeric"))
        + offerField("חשבון", offerText("ho.account", ho.account, "numeric"));
    } else {
      const cc = offer.cc;
      body += offerField("שם בעל הכרטיס", offerText("cc.holderName", cc.holderName))
        + offerField("ת״ז בעל הכרטיס", offerText("cc.holderId", cc.holderId, "numeric"))
        + offerField("מספר כרטיס", offerText("cc.cardNumber", cc.cardNumber, "numeric"))
        + offerField("תוקף MM/YY", offerText("cc.exp", cc.exp));
    }
    return body + "</article>";
  }

  function offerStep7() {
    const cards = offer.insureds.map((ins) => {
      const tone = offerBmiTone(ins.data.bmi);
      const questions = offerQuestions(ins).map((question) => {
        const saved = offer.health[question] && offer.health[question][ins.id];
        const answer = saved ? saved.answer : "";
        const detail = saved && saved.detail ? saved.detail : "";
        return '<div class="offerCard"><h2>' + esc(ins.label) + "</h2><p class=\"offerHint\">" + esc(question) + "</p>"
          + offerChips("health." + question + "." + ins.id, answer, [{ key: "no", label: "לא" }, { key: "yes", label: "כן" }])
          + (answer === "yes" ? offerField("פירוט", '<textarea class="input" data-k="health.' + esc(question) + "." + esc(ins.id) + '.detail">' + esc(detail) + "</textarea>") : "")
          + "</div>";
      }).join("");
      const bmi = '<article class="offerCard"><h2>גובה, משקל ו־BMI · ' + esc(ins.label) + "</h2>"
        + '<div class="offerRow">' + offerField("גובה (ס״מ)", offerText("height." + ins.id, ins.data.heightCm, "numeric")) + offerField("משקל (ק״ג)", offerText("weight." + ins.id, ins.data.weightKg, "numeric")) + "</div>"
        + '<div class="bmiLive"><i class="bmiLamp' + (tone.lamp ? " bmiLamp--" + tone.lamp : "") + '"></i><span>' + esc(ins.data.bmi || "—") + " · " + esc(tone.label) + "</span></div></article>";
      return questions + bmi;
    }).join("");
    return cards;
  }

  function offerStep8() {
    return '<article class="offerCard"><h2>תיאום שיחת שיקוף</h2><p class="offerHint">בחרו תאריך ושעה, או סמנו שאין תיאום.</p>'
      + '<label class="offerCheck"><input type="checkbox" data-k="mirror.unscheduled"' + (offer.mirror.unscheduled ? " checked" : "") + "/> ללא תיאום</label>"
      + (offer.mirror.unscheduled ? "" : offerField("תאריך", offerDate("mirror.date", offer.mirror.date)) + offerField("שעה", '<input class="input" data-k="mirror.time" type="time" value="' + esc(offer.mirror.time || "") + '"/>'))
      + offerField("הערת נציג", '<textarea class="input" data-k="mirror.note">' + esc(offer.mirror.note || "") + "</textarea>")
      + "</article>";
  }

  function offerPaint() {
    const step = OFFER_STEPS[offer.step];
    $("offerTitle").textContent = step.title;
    $("offerCount").textContent = (offer.step + 1) + "/7";
    const rail = OFFER_STEPS.map((item, index) => '<i class="' + (index < offer.step ? "is-done" : index === offer.step ? "is-on" : "") + '"></i>').join("");
    const bodies = [offerStep1, offerStep3, offerStep4, offerStep5, offerStep6, offerStep7, offerStep8];
    $("offerBody").innerHTML = '<div class="offerRail">' + rail + "</div>" + bodies[offer.step]();
    if ($("offerError")) {
      $("offerError").textContent = "";
      $("offerError").classList.remove("is-ok");
    }
    $("offerPrev").hidden = offer.step === 0;
    $("offerNext").textContent = offer.step === OFFER_STEPS.length - 1 ? "סיום הקמת לקוח" : "המשך";
    $("offerBody").scrollTop = 0;
    if (OFFER_STEPS[offer.step].id === 5) void offerPriceDraft();
  }

  function offerWrite(key, value) {
    if (key === "payerChoice") offer.payerChoice = value;
    else if (key === "paymentMethod") offer.paymentMethod = value;
    else if (key.indexOf("exist.") === 0) offer.exist[key.slice(6)] = value;
    else if (key.indexOf("draft.") === 0) {
      offer.draft[key.slice(6)] = value;
      offer.draft.quoteOk = false;
    }
    else if (key.indexOf("cc.") === 0) offer.cc[key.slice(3)] = value;
    else if (key.indexOf("ho.") === 0) offer.ho[key.slice(3)] = value;
    else if (key.indexOf("ext.") === 0) offer.externalPayer[key.slice(4)] = value;
    else if (key.indexOf("mirror.") === 0) offer.mirror[key.slice(7)] = value === true || value === "true" ? true : value === false ? false : value;
    else if (key.indexOf("agent.") === 0) offer.agentNumbers[key.slice(6)] = value;
    else if (key.indexOf("height.") === 0 || key.indexOf("weight.") === 0) {
      const parts = key.split(".");
      const ins = offer.insureds.find((item) => item.id === parts[1]);
      if (!ins) return;
      ins.data[parts[0] === "height" ? "heightCm" : "weightKg"] = value;
      ins.data.bmi = offerBmi(ins.data.heightCm, ins.data.weightKg);
    } else if (key.indexOf("health.") === 0) {
      const parts = key.split(".");
      const detail = parts[parts.length - 1] === "detail";
      const id = parts[parts.length - (detail ? 2 : 1)];
      const question = parts.slice(1, parts.length - (detail ? 2 : 1)).join(".");
      offer.health[question] = offer.health[question] || {};
      offer.health[question][id] = offer.health[question][id] || { answer: "", detail: "" };
      if (detail) offer.health[question][id].detail = value;
      else offer.health[question][id].answer = value;
    } else {
      offerActive().data[key] = value;
      if (key === "clinic" && value === "קופה צהלית") offerActive().data.shaban = "אין שב״ן";
      if (key === "clinic" && value !== "קופה צהלית" && (OFFER_SHABAN[value] || []).indexOf(offerActive().data.shaban) < 0) offerActive().data.shaban = "";
    }
  }

  function offerMissingPerson(ins) {
    const d = ins.data;
    const name = ins.label;
    const labels = { firstName: "שם פרטי", lastName: "שם משפחה", idNumber: "ת״ז", birthDate: "תאריך לידה", gender: "מין" };
    const base = ["firstName", "lastName", "idNumber", "birthDate", "gender"];
    for (let i = 0; i < base.length; i += 1) {
      if (!trim(d[base[i]])) return name + ": חסר " + labels[base[i]];
    }
    if (offerDigits(d.idNumber).length !== 9) return name + ": ת״ז חייבת להיות בת 9 ספרות";
    if (ins.type === "child") {
      const parent = offer.insureds[0].data;
      if (!trim(parent.phone) || !trim(parent.city) || !trim(parent.street) || !trim(parent.houseNumber)) {
        return "המבוטח הראשי: חסרים פרטי קשר (נדרש עבור " + name + ")";
      }
      return "";
    }
    if (!trim(d.maritalStatus)) return name + ": חסר מצב משפחתי";
    if (!trim(d.occupation)) return name + ": חסר עיסוק";
    if (!offerIso(d.idIssueDate)) return name + ": חסר תאריך הנפקת ת״ז";
    if (!trim(d.clinic)) return name + ": חסרה קופת חולים";
    if (d.clinic !== "קופה צהלית" && !trim(d.shaban)) return name + ": חסר שב״ן";
    if (d.smokingStatus !== "yes" && d.smokingStatus !== "no") return name + ": לא נענתה שאלת עישון";
    if (d.smokingStatus === "yes" && !trim(d.smokingType)) return name + ": חסר סוג עישון";
    if (d.smokingStatus === "yes" && (d.smokingType === "סיגריות" || d.smokingType === "טבק") && !trim(d.smokingAmount)) return name + ": חסרה כמות עישון ליום";
    const contact = { phone: "טלפון", city: "עיר", street: "רחוב", houseNumber: "מספר בית" };
    const keys = Object.keys(contact);
    for (let i = 0; i < keys.length; i += 1) {
      if (!trim(d[keys[i]])) return name + ": חסר " + contact[keys[i]];
    }
    if (offerDigits(d.phone).length < 9) return name + ": טלפון חסר";
    return "";
  }

  function offerPolicyError(draft) {
    if (!trim(draft.company)) return "שכחת למלא: חברת ביטוח";
    if (!trim(draft.type)) return "שכחת למלא: מוצר ביטוח";
    if (!offer.insureds.some((ins) => ins.id === draft.insuredId || ins.label === draft.insuredId)) return "שכחת למלא: שיוך מבוטח לפוליסה";
    if (draft.type === "בריאות" && !draft.covers.length) return "שכחת למלא: כיסויי בריאות (לפחות אחד)";
    if ((draft.type === "ריסק" || draft.type === "ריסק משכנתא") && !trim(draft.sumInsured)) return "שכחת למלא: סכום ביטוח";
    if ((draft.type === "סרטן" || draft.type === "מחלות קשות") && !trim(draft.compensation)) return "שכחת למלא: סכום פיצוי";
    if (draft.type === "אובדן כושר עבודה" && !trim(draft.salary)) return "שכחת למלא: שכר";
    if (!offerIso(draft.startDate)) return "שכחת למלא: תאריך תחילת ביטוח";
    if (!draft.quoteOk || !(offerMoneyNumber(draft.premium) > 0)) return draft.quoteNote || "הפרמיה מחושבת לפי הסימולטור. המתינו לחישוב.";
    return "";
  }

  function offerValidate(stepId) {
    if (stepId === 1) {
      for (let i = 0; i < offer.insureds.length; i += 1) {
        const issue = offerMissingPerson(offer.insureds[i]);
        if (issue) return issue;
      }
      return "";
    }
    if (stepId === 3) {
      const draft = offer.exist;
      const started = trim(draft.company) || trim(draft.type) || trim(draft.policyNumber);
      if (started) return "יש ללחוץ «הוסף פוליסה קיימת» או לנקות את השורה";
      for (let i = 0; i < offer.insureds.length; i += 1) {
        const ins = offer.insureds[i];
        const list = ins.data.existingPolicies || [];
        for (let p = 0; p < list.length; p += 1) {
          const cancel = ins.data.cancellations[list[p].id];
          if (cancel && cancel.status !== "keep" && !trim(cancel.needsAnalysisReason)) return "לא ניתן להתקדם לשלב הבא ללא פירוט על הפוליסות שמבטל מלא/חלקי ללקוח";
        }
      }
      return "";
    }
    if (stepId === 4) {
      const options = offerNeedOptions();
      if (!options.some((item) => item.key === offer.needsKey)) {
        return offerHasExisting()
          ? "יש לבחור את השיקול העיקרי במתן ההמלצה (הוזלה / הרחבה / כיסוי חדש)."
          : "יש לבחור רכישת ביטוח חדש בשלב התאמת צרכים כדי להמשיך.";
      }
      return "";
    }
    if (stepId === 5) {
      if (!offer.policies.length) return "חובה שתהיה לפחות פוליסה אחת ברשימה";
      return "";
    }
    if (stepId === 6) {
      if (offer.payerChoice === "external") {
        const ext = offer.externalPayer;
        if (!trim(ext.firstName) || !trim(ext.lastName)) return "יש למלא את שם המשלם";
        if (offerDigits(ext.idNumber).length !== 9) return "יש למלא ת״ז משלם בת 9 ספרות";
        if (offerDigits(ext.phone).length < 9) return "יש למלא טלפון משלם";
      }
      if (offer.paymentMethod === "ho") {
        const ho = offer.ho;
        if (!trim(ho.bankName) || !trim(ho.bankNo) || !trim(ho.branch) || !trim(ho.account)) return "יש להשלים את פרטי הוראת הקבע";
        return "";
      }
      const cc = offer.cc;
      if (!trim(cc.holderName)) return "יש למלא את שם בעל הכרטיס";
      if (offerDigits(cc.holderId).length !== 9) return "יש למלא ת״ז בעל כרטיס בת 9 ספרות";
      if (offerDigits(cc.cardNumber).length !== 16) return "יש להזין מספר כרטיס בן 16 ספרות";
      if (!/^\d{2}\/\d{2}$/.test(trim(cc.exp))) return "יש להזין תוקף בפורמט MM/YY";
      return "";
    }
    if (stepId === 7) {
      for (let i = 0; i < offer.insureds.length; i += 1) {
        const ins = offer.insureds[i];
        const questions = offerQuestions(ins);
        for (let q = 0; q < questions.length; q += 1) {
          const saved = offer.health[questions[q]] && offer.health[questions[q]][ins.id];
          if (!saved || (saved.answer !== "yes" && saved.answer !== "no")) return "חסרה תשובה בהצהרת הבריאות עבור " + ins.label;
          if (saved.answer === "yes" && !trim(saved.detail)) return "יש למלא את פירוט השאלה עבור " + ins.label;
        }
        if (!(Number(ins.data.heightCm) > 0)) return ins.label + ": חסר גובה";
        if (!(Number(ins.data.weightKg) > 0)) return ins.label + ": חסר משקל";
      }
      return "";
    }
    if (offer.mirror.unscheduled) return "";
    if (!offerIso(offer.mirror.date)) return "יש לבחור תאריך זמינות לשיחת השיקוף";
    if (!trim(offer.mirror.time)) return "יש לבחור שעת זמינות לשיחת השיקוף";
    return "";
  }

  function offerInsuredByDraft(draft) {
    return offer.insureds.find((ins) => ins.id === draft.insuredId || ins.label === draft.insuredId) || offer.insureds[0];
  }

  function offerAddPolicy() {
    const draft = offer.draft;
    const insured = offerInsuredByDraft(draft);
    draft.insuredId = insured.id;
    const error = offerPolicyError(draft);
    if (error) return error;
    const premium = offerMoneyNumber(draft.premium);
    const policy = {
      id: "np_" + Date.now().toString(16),
      company: trim(draft.company),
      type: trim(draft.type),
      insuredId: insured.id,
      insuredIds: [insured.id],
      startDate: offerDmy(draft.startDate),
      premiumMonthly: premium,
      premiumAfterDiscountValue: premium,
      premiumPerInsured: {},
      healthCovers: draft.type === "בריאות" ? draft.covers.slice() : [],
      sumInsured: trim(draft.sumInsured),
      sumInsuredPerInsured: {},
      compensation: trim(draft.compensation),
      compensationPerInsured: {},
      akovSalary: trim(draft.salary)
    };
    policy.premiumPerInsured[insured.id] = premium;
    if (policy.sumInsured) policy.sumInsuredPerInsured[insured.id] = policy.sumInsured;
    if (policy.compensation) policy.compensationPerInsured[insured.id] = policy.compensation;
    offer.policies.push(policy);
    offer.draft = offerBlankPolicy(offer.insureds[0].id);
    return "";
  }

  const OFFER_SIM_COVERS = [
    ["ניתוחים ומחליפי ניתוח בישראל (משלים שב״ן)", ["surgery_shaban", "shaban"]],
    ["ניתוחים ומחליפי ניתוח בישראל מהשקל הראשון", ["surgery_first_shekel", "surgeries_israel"]],
    ["השתלות", ["transplant", "transplants_abroad"]],
    ["תרופות", ["drugs"]],
    ["אמבולטורי (ייעוצים ובדיקות)", ["ambulatory_consults", "consult_tests", "ambulatory_base"]],
    ["אבחון מהיר", ["fast_diagnosis", "fast_diag"]]
  ];

  function offerSimCoverIds(company, labels) {
    const catalog = SIM_HEALTH[company] || [];
    const ids = [];
    (labels || []).forEach((label) => {
      const row = OFFER_SIM_COVERS.find((item) => item[0] === label);
      if (!row) return;
      const id = row[1].find((key) => catalog.some((cover) => cover.id === key));
      if (id && ids.indexOf(id) < 0) ids.push(id);
    });
    return ids;
  }

  function offerPriceToken(draft) {
    const insured = offerInsuredByDraft(draft);
    const data = insured.data || {};
    return [draft.company, draft.type, draft.insuredId, draft.startDate, data.birthDate, data.gender, data.smokingStatus, data.occupation, (draft.covers || []).join("|"), draft.sumInsured, draft.compensation, draft.salary].join("~");
  }

  function offerPriceReady(draft) {
    if (!trim(draft.company) || !trim(draft.type)) return { ok: false, hint: "בחרו חברה ומוצר. המחיר יחושב לפי הסימולטור." };
    const insured = offerInsuredByDraft(draft);
    const data = insured.data || {};
    if (insuranceAge(data.birthDate, draft.startDate) == null) return { ok: false, hint: "כדי לחשב מחיר צריך תאריך לידה של המבוטח ותאריך תחילת ביטוח." };
    if (data.gender !== "זכר" && data.gender !== "נקבה") return { ok: false, hint: "כדי לחשב מחיר צריך מין בפרטי הלקוח." };
    if (data.smokingStatus !== "yes" && data.smokingStatus !== "no") return { ok: false, hint: "כדי לחשב מחיר צריך לענות על שאלת העישון." };
    const kind = simKind(draft.type);
    if (kind === "health" && !offerSimCoverIds(draft.company, draft.covers).length) return { ok: false, hint: "בחרו כיסוי כדי לחשב את מחיר הסימולטור." };
    if (kind === "compensation" && !(offerMoneyNumber(draft.compensation) > 0)) return { ok: false, hint: "הזינו סכום פיצוי. המחיר יחושב לפי הסימולטור." };
    if (kind === "sum" && draft.type !== "אובדן כושר עבודה" && !(offerMoneyNumber(draft.sumInsured) > 0)) return { ok: false, hint: "הזינו סכום ביטוח. המחיר יחושב לפי הסימולטור." };
    if (draft.type === "אובדן כושר עבודה" && !(offerMoneyNumber(draft.salary) > 0)) return { ok: false, hint: "הזינו שכר. המחיר יחושב לפי הסימולטור." };
    return { ok: true, hint: "" };
  }

  let offerPriceSeq = 0;
  async function offerPriceDraft() {
    if (!offer || OFFER_STEPS[offer.step].id !== 5) return;
    const draft = offer.draft;
    const token = offerPriceToken(draft);
    const seq = ++offerPriceSeq;
    const ready = offerPriceReady(draft);
    const note = $("offerPrice");
    const view = document.querySelector("[data-price]");
    if (!ready.ok) {
      draft.premium = "";
      draft.quoteOk = false;
      draft.quoteNote = ready.hint;
      if (view) view.textContent = "";
      if (note) note.textContent = ready.hint;
      return;
    }
    if (draft.quoteOk && draft.priceToken === token && offerMoneyNumber(draft.premium) > 0) {
      if (view) view.textContent = "₪" + draft.premium;
      if (note) note.textContent = "המחיר לפי הסימולטור של " + draft.company + " · " + draft.type;
      return;
    }
    draft.quoteOk = false;
    draft.premium = "";
    if (view) view.textContent = "";
    if (note) note.textContent = "מחשב לפי הסימולטור…";
    try {
      const quotes = await loadSimulatorQuotes();
      if (seq !== offerPriceSeq || !offer || offer.draft !== draft) return;
      const insured = offerInsuredByDraft(draft);
      const data = insured.data || {};
      const input = {
        age: insuranceAge(data.birthDate, draft.startDate),
        gender: data.gender,
        smoker: data.smokingStatus === "yes",
        occupation: data.occupation
      };
      const kind = simKind(draft.type);
      if (kind === "health") input.covers = offerSimCoverIds(draft.company, draft.covers);
      else if (kind === "compensation") input.compensation = offerMoneyNumber(draft.compensation);
      else input.sumInsured = offerMoneyNumber(draft.type === "אובדן כושר עבודה" ? draft.salary : draft.sumInsured);
      const result = quotes.quote(draft.company, draft.type, input);
      if (seq !== offerPriceSeq || !offer || offer.draft !== draft) return;
      if (result && result.ok && Number(result.monthlyPremium) > 0) {
        draft.premium = offerAmountFromNumber(result.monthlyPremium);
        draft.quoteOk = true;
        draft.quoteNote = "";
        draft.priceToken = token;
        if (view) view.textContent = "₪" + draft.premium;
        if (note) note.textContent = "המחיר לפי הסימולטור של " + draft.company + " · " + draft.type;
      } else {
        draft.premium = "";
        draft.quoteOk = false;
        draft.priceToken = "";
        draft.quoteNote = simFailText(result);
        if (view) view.textContent = "";
        if (note) note.textContent = draft.quoteNote;
      }
    } catch (_err) {
      if (seq !== offerPriceSeq) return;
      draft.premium = "";
      draft.quoteOk = false;
      draft.quoteNote = "לא ניתן לטעון את מנוע הסימולטורים כרגע.";
      if (view) view.textContent = "";
      if (note) note.textContent = draft.quoteNote;
    }
  }

  function offerHarCell(value) {
    return String(value == null ? "" : value)
      .replace(/[\u00A0\u2007\u202F]/g, " ")
      .replace(/[\u200E\u200F]/g, "")
      .replace(/[״“”]/g, '"')
      .replace(/[׳‘’]/g, "'")
      .replace(/["'׳״`´]/g, "")
      .replace(/[()[\]{}]/g, " ")
      .replace(/[‐‑‒–—−]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/[:;,]+$/g, "")
      .trim();
  }

  function offerHarCompany(value) {
    const compact = offerHarCell(value)
      .replace(/חברה לביטוח בע"?מ/gi, "")
      .replace(/לביטוח בע"?מ/gi, "")
      .replace(/בע"?מ/gi, "")
      .replace(/ישראל/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!compact) return "";
    const checks = [
      ["מנורה מבטחים", "מנורה"], ["מנורה", "מנורה"], ["ביטוח מגדל", "מגדל"], ["מגדל", "מגדל"],
      ["ביטוח הראל", "הראל"], ["הראל", "הראל"], ["ביטוח הפניקס", "הפניקס"], ["הפניקס", "הפניקס"], ["פניקס", "הפניקס"],
      ["ביטוח הכשרה", "הכשרה"], ["הכשרה", "הכשרה"], ["ביטוח איילון", "איילון"], ["איילון", "איילון"],
      ["ביטוח שומרה", "שומרה"], ["שומרה", "שומרה"], ["ביטוח שלמה", "שלמה"], ["ניו קופל", "שלמה"], ["שלמה", "שלמה"],
      ["ליברה", "ליברה"], ["ווישור", "ווישור"], ["וישור", "ווישור"], ["שירביט", "שירביט"],
      ["ביטוח חקלאי", "חקלאי"], ["חקלאי", "חקלאי"], ["איי אי ג", "AIG"], ["aig", "AIG"],
      ["ביטוח ישיר", "ביטוח ישיר"], ["ישיר ביטוח", "ביטוח ישיר"], ["9 מיליון", "9 מיליון"], ["תשעה מיליון", "9 מיליון"],
      ["ביטוח כלל", "כלל"], ["כלל", "כלל"], ["מדיקר", "מדיקר"], ["מדיכלל", "מדיקר"], ["מדיכל", "מדיקר"]
    ];
    const lowered = compact.toLowerCase();
    for (let i = 0; i < checks.length; i += 1) {
      if (lowered.indexOf(String(checks[i][0]).toLowerCase()) >= 0) return checks[i][1];
    }
    return compact;
  }

  function offerHarType(row) {
    const source = [row.productType, row.sub, row.main, row.section, row.extra, row.classification].filter(Boolean).join(" | ");
    const life = [row.productType, row.sub, row.extra].filter(Boolean).join(" | ");
    if (/משכנתא/i.test(source)) return "ריסק משכנתא";
    if (/אבדן כושר|אובדן כושר/i.test(source)) {
      if (/מקרה מוות|ביטוח חיים|חיים למקרה מוות|ריסק|מוות/i.test(source)) return "ריסק";
      return "אובדן כושר עבודה";
    }
    if (/נכויות/i.test(source)) return "נכויות";
    if (/סיעוד/i.test(source)) return "סיעודי";
    if (/מחלות קשות/i.test(source)) return "מחלות קשות";
    if (/סרטן/i.test(source)) return "סרטן";
    if (/בריאות|השתלות|תרופות|ניתוחים|שב"ן|שב״ן|אמבולטורי|אבחון|ייעוץ|בדיקות/i.test(source)) return "בריאות";
    if (/תאונות אישיות/i.test(source) && !/בריאות|השתלות|תרופות|ניתוחים/i.test(source)) return "תאונות אישיות";
    if (/מקרה מוות|ריסק|ביטוח חיים|חיים/i.test(life) || /חיים/i.test(row.main || "")) return "ריסק";
    return /תאונות אישיות/i.test(source) ? "תאונות אישיות" : "בריאות";
  }

  function offerHarCovers(list) {
    const mapped = [];
    (list || []).forEach((item) => {
      const value = trim(item);
      if (!value) return;
      const add = (label) => { if (mapped.indexOf(label) < 0) mapped.push(label); };
      if (/השתל/i.test(value)) add("השתלות");
      if (/תרופ/i.test(value)) add("תרופות");
      if (/ייעוץ|בדיקות/i.test(value)) add("אמבולטורי (ייעוצים ובדיקות)");
      if (/שב"ן|שב״ן|משלים/i.test(value)) add("ניתוחים ומחליפי ניתוח בישראל (משלים שב״ן)");
    });
    return mapped;
  }

  function offerParseHar(buffer) {
    if (!window.XLSX) throw new Error("ספריית הקריאה לקובצי Excel לא נטענה.");
    const wb = window.XLSX.read(buffer, { type: "array" });
    const sheetNames = Array.isArray(wb.SheetNames) ? wb.SheetNames : [];
    if (!sheetNames.length) throw new Error("לא נמצאה לשונית נתונים בקובץ.");
    const matchers = {
      idNumber: [/^תעודת זהות$/, /^מספר תעודת זהות$/, /תעודת\s*זהות/, /מספר\s*תעודת\s*זהות/, /מספר\s*זהות/],
      main: [/^ענף ראשי$/, /^ענף\s*\(?.*ראשי.*\)?$/, /^ענף$/, /ענף\s*ראשי/],
      sub: [/^ענף \(משני\)$/, /^ענף משני$/, /^ענף\s*\(?.*משני.*\)?$/, /ענף\s*משני/, /ענף\s*\(משני\)/],
      productType: [/^סוג מוצר$/, /^מוצר$/, /^שם מוצר$/, /סוג\s*מוצר/],
      company: [/^חברה$/, /חברה מבטחת/, /מבטח/, /שם חברה/, /חברה/],
      period: [/^תקופת ביטוח$/, /תקופה/, /תקופת\s*ביטוח/],
      extra: [/^פרטים נוספים$/, /פרטים נוספים/, /מידע נוסף/],
      premium: [/^פרמיה בש"ח$/, /^פרמיה בשח$/, /^פרמיה$/, /פרמיה לתשלום/, /סכום פרמיה/, /פרמיה\s*בשח/, /פרמיה\s*בש״ח/, /פרמיה\s*בש"ח/],
      premiumType: [/^סוג פרמיה$/, /תדירות פרמיה/, /סוג\s*פרמיה/],
      policyNumber: [/^מספר פוליסה$/, /^מס' פוליסה$/, /^מס פוליסה$/, /פוליסה/, /מספר\s*פוליסה/],
      classification: [/^סיווג תכנית$/, /^סיווג תוכנית$/, /סיווג/, /סיווג\s*תכנית/, /סווג\s*תכנית/]
    };
    const cellHits = (row, patterns) => (row || []).some((cell) => patterns.some((pattern) => pattern.test(offerHarCell(cell))));
    const extracted = [];
    let headerFound = false;
    sheetNames.forEach((sheetName) => {
      if (sheetName === "_gi_har_origin") return;
      const sheet = wb.Sheets[sheetName];
      if (!sheet) return;
      const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      let best = { index: -1, score: 0, required: 0 };
      rows.forEach((row, index) => {
        if (!Array.isArray(row)) return;
        const joined = row.map((cell) => String(cell == null ? "" : cell)).join(" ");
        if (/התיק הביטוחי|הופק מאתר|משרד האוצר/.test(joined)) return;
        const hits = {};
        Object.keys(matchers).forEach((key) => { hits[key] = cellHits(row, matchers[key]); });
        const score = Object.keys(hits).reduce((sum, key) => sum + (hits[key] ? 1 : 0), 0);
        const required = ["idNumber", "main", "company", "policyNumber"].reduce((sum, key) => sum + (hits[key] ? 1 : 0), 0);
        if (required > best.required || (required === best.required && score > best.score)) best = { index: index, score: score, required: required };
      });
      if (best.index < 0 || best.required < 3 || best.score < 4) return;
      headerFound = true;
      const header = rows[best.index].map((cell) => offerHarCell(cell));
      const idx = {};
      Object.keys(matchers).forEach((key) => {
        idx[key] = header.findIndex((cell) => matchers[key].some((pattern) => pattern.test(cell)));
      });
      let section = "";
      rows.slice(best.index + 1).forEach((row) => {
        if (!Array.isArray(row)) return;
        const main = trim(idx.main >= 0 ? row[idx.main] : "");
        if (/^תחום\s*-/.test(main)) { section = main; return; }
        const record = {
          section: section,
          main: main,
          sub: trim(idx.sub >= 0 ? row[idx.sub] : ""),
          productType: trim(idx.productType >= 0 ? row[idx.productType] : ""),
          extra: trim(idx.extra >= 0 ? row[idx.extra] : ""),
          classification: offerHarCell(idx.classification >= 0 ? row[idx.classification] : ""),
          premiumType: trim(idx.premiumType >= 0 ? row[idx.premiumType] : ""),
          company: offerHarCompany(idx.company >= 0 ? row[idx.company] : "")
        };
        const source = [record.main, record.sub, record.productType, record.section, record.extra, record.classification].join(" | ");
        if (!trim(source) || /תחום\s*-|התיק הביטוחי|הופק מאתר|משרד האוצר/.test(source) || !record.company) return;
        if (/ביטוח רכב|רכב חובה|ביטוח מקיף|שירותי רכב|גרירה|שמשות|צד שלישי|ביטוח דירה|מבנה|תכולה/i.test(source)) return;
        if (!/בריאות|תאונות אישיות|סיעוד|סיעודי|מחלות קשות|סרטן|השתלות|תרופות|ניתוחים|ייעוץ|בדיקות|שב"ן|שב״ן|חיים|מקרה מוות|אבדן כושר|אובדן כושר|נכויות|משכנתא|ריסק/i.test(source)) return;
        const premiumRaw = Number(String(idx.premium >= 0 ? (row[idx.premium] == null ? "" : row[idx.premium]) : "").replace(/[^\d.-]/g, ""));
        const premium = Number.isFinite(premiumRaw) ? premiumRaw : 0;
        record.monthlyPremium = /שנתי/i.test(record.premiumType) ? premium / 12 : premium;
        record.policyNumber = trim(idx.policyNumber >= 0 ? row[idx.policyNumber] : "");
        record.type = offerHarType(record);
        record.label = record.sub || record.productType || record.main;
        extracted.push(record);
      });
    });
    if (!extracted.length) return { policies: [], headerFound: headerFound };
    const grouped = new Map();
    extracted.forEach((row) => {
      const key = row.policyNumber || [row.company, row.main, row.sub, row.productType].join("|");
      if (!grouped.has(key)) {
        grouped.set(key, { policyNumber: row.policyNumber || key, company: row.company, monthlyPremium: 0, types: [], labels: [] });
      }
      const bucket = grouped.get(key);
      bucket.company = bucket.company || row.company;
      bucket.monthlyPremium += Number(row.monthlyPremium || 0);
      if (row.type && bucket.types.indexOf(row.type) < 0) bucket.types.push(row.type);
      if (row.label && bucket.labels.indexOf(row.label) < 0) bucket.labels.push(row.label);
    });
    const policies = Array.from(grouped.values()).map((bucket) => {
      const types = bucket.types;
      let type = types.length <= 1 ? (types[0] || "בריאות") : "פוליסה משולבת";
      if (types.indexOf("בריאות") >= 0 && types.indexOf("תאונות אישיות") >= 0) type = "בריאות";
      else if ((types.indexOf("ריסק") >= 0 || types.indexOf("ריסק משכנתא") >= 0) && types.indexOf("אובדן כושר עבודה") >= 0) type = "ריסק";
      return {
        id: "ex_" + Date.now().toString(16) + Math.random().toString(16).slice(2, 6),
        company: bucket.company,
        type: type,
        policyNumber: bucket.policyNumber,
        monthlyPremium: (Math.round(bucket.monthlyPremium * 100) / 100).toFixed(2),
        covers: offerHarCovers(bucket.labels),
        origin: "existing",
        importedFromHarBituach: true
      };
    });
    return { policies: policies, headerFound: headerFound };
  }

  function offerMergeHar(ins, policy, fileName) {
    const list = ins.data.existingPolicies;
    const match = list.find((item) => trim(item.policyNumber) && trim(item.policyNumber) === trim(policy.policyNumber));
    const payload = Object.assign({}, policy, { importSourceFile: fileName || "", importSourceAt: new Date().toISOString() });
    if (match) {
      payload.id = match.id;
      Object.assign(match, payload);
      return;
    }
    list.push(payload);
  }

  async function offerImportHar(file) {
    if (!file || !offer) return;
    const note = $("offerError");
    if (note) note.textContent = "קורא את קובץ הר הביטוח…";
    try {
      await loadSheetLib();
      const parsed = offerParseHar(await file.arrayBuffer());
      if (!parsed.headerFound) throw new Error("לא נמצאו כותרות של הר הביטוח בקובץ");
      if (!parsed.policies.length) throw new Error("לא נמצאו פוליסות בריאות או סיכונים בקובץ");
      const ins = offerActive();
      parsed.policies.forEach((policy) => offerMergeHar(ins, policy, file.name));
      offer.exist = { company: "", type: "", policyNumber: "", monthlyPremium: "", status: "keep", reason: "" };
      offerPaint();
      if ($("offerError")) {
        $("offerError").classList.add("is-ok");
        $("offerError").textContent = "נטענו " + parsed.policies.length + " פוליסות מהר הביטוח";
      }
    } catch (err) {
      if ($("offerError")) $("offerError").textContent = err.message || "לא ניתן לקרוא את הקובץ";
    }
  }

  function offerAddExisting() {
    const ins = offerActive();
    const draft = offer.exist;
    if (!trim(draft.company) || !trim(draft.type)) return "שכחת למלא: חברה ומוצר לפוליסה הקיימת";
    if (draft.status !== "keep" && !trim(draft.reason)) return "לא ניתן להתקדם לשלב הבא ללא פירוט על הפוליסות שמבטל מלא/חלקי ללקוח";
    const id = "ex_" + Date.now().toString(16);
    ins.data.existingPolicies.push({
      id: id,
      company: trim(draft.company),
      type: trim(draft.type),
      policyNumber: trim(draft.policyNumber),
      monthlyPremium: trim(draft.monthlyPremium),
      origin: "existing"
    });
    if (draft.status !== "keep") ins.data.cancellations[id] = { status: draft.status, needsAnalysisReason: trim(draft.reason) };
    offer.exist = { company: "", type: "", policyNumber: "", monthlyPremium: "", status: "keep", reason: "" };
    return "";
  }

  function offerPayload() {
    const needs = offerNeedOptions().find((item) => item.key === offer.needsKey) || { key: "", label: "" };
    const mirror = {
      date: offer.mirror.unscheduled ? "" : offerDmy(offer.mirror.date),
      time: offer.mirror.unscheduled ? "" : trim(offer.mirror.time),
      note: trim(offer.mirror.note),
      unscheduled: !!offer.mirror.unscheduled
    };
    const insureds = offer.insureds.map((ins) => {
      const data = JSON.parse(JSON.stringify(ins.data));
      data.birthDate = offerDmy(data.birthDate) || data.birthDate;
      data.idIssueDate = offerDmy(data.idIssueDate) || data.idIssueDate;
      data.idNumber = offerDigits(data.idNumber);
      data.phone = trim(data.phone);
      data.bmi = offerBmi(data.heightCm, data.weightKg);
      const responses = {};
      offerQuestions(ins).forEach((question) => {
        const saved = offer.health[question] && offer.health[question][ins.id];
        if (!saved) return;
        responses[question] = {};
        responses[question][ins.id] = { answer: saved.answer, fields: saved.detail ? { detail: saved.detail } : {}, saved: true };
      });
      data.healthDeclaration = { responses: responses };
      data.mirrorSchedule = JSON.parse(JSON.stringify(mirror));
      data.operationalAgentNumbers = JSON.parse(JSON.stringify(offer.agentNumbers));
      return { id: ins.id, label: ins.label, type: ins.type, data: data };
    });
    const primary = insureds[0].data;
    primary.payerChoice = offer.payerChoice;
    primary.paymentMethod = offer.paymentMethod;
    primary.externalPayer = JSON.parse(JSON.stringify(offer.externalPayer));
    primary.cc = JSON.parse(JSON.stringify(offer.cc));
    primary.ho = JSON.parse(JSON.stringify(offer.ho));
    primary.payer = offer.paymentMethod === "ho"
      ? { method: "ho", bankName: offer.ho.bankName, bankNo: offer.ho.bankNo, branchNo: offer.ho.branch, accountNo: offer.ho.account }
      : { method: "cc", holderName: offer.cc.holderName, holderId: offerDigits(offer.cc.holderId), cardNumber: offerDigits(offer.cc.cardNumber), cardExpiry: trim(offer.cc.exp) };
    const createdAt = new Date().toISOString();
    const operational = {
      createdAt: createdAt,
      insureds: insureds.map((ins) => ({ label: ins.label, type: ins.type, data: ins.data })),
      newPolicies: JSON.parse(JSON.stringify(offer.policies)),
      companyAgentNumbers: JSON.parse(JSON.stringify(offer.agentNumbers)),
      primary: JSON.parse(JSON.stringify(primary)),
      mirrorSchedule: JSON.parse(JSON.stringify(mirror)),
      needsMainConsideration: { key: needs.key, label: needs.label }
    };
    return {
      createdAt: createdAt,
      flowType: "health",
      insureds: insureds,
      newPolicies: JSON.parse(JSON.stringify(offer.policies)),
      companyAgentNumbers: JSON.parse(JSON.stringify(offer.agentNumbers)),
      primary: JSON.parse(JSON.stringify(primary)),
      mirrorSchedule: JSON.parse(JSON.stringify(mirror)),
      needsMainConsideration: { key: needs.key, label: needs.label },
      operational: operational,
      opsProcess: { healthSetupFinishedAt: createdAt }
    };
  }

  async function offerExistingCustomer(idNumber) {
    const res = await sb.from("customers")
      .select("id,agent_id,agent_name,agent_role,full_name,status,created_at,is_archived")
      .eq("id_number", idNumber)
      .limit(8);
    if (res.error) throw new Error(res.error.message || "customer");
    return (res.data || []).find((row) => row.is_archived !== true) || null;
  }

  async function offerGuard(row) {
    if (!row) return { ok: true, preserve: false };
    const owner = trim(row.agent_id);
    const me = trim(state.profile && state.profile.id);
    if (!owner || owner === me) return { ok: true, preserve: false };
    const role = state.profile && state.profile.role;
    if (role === "manager" || role === "admin") return { ok: true, preserve: true };
    if (role === "teammanager") {
      await loadScope();
      const ids = state.scope && state.scope.ids;
      if (ids && ids.indexOf(owner) >= 0) return { ok: true, preserve: true };
    }
    return { ok: false, preserve: true };
  }

  async function offerFinish() {
    if (offer.busy) return;
    const error = offerValidate(8);
    const note = $("offerError");
    if (error) {
      if (note) note.textContent = error;
      return;
    }
    const profile = state.profile || {};
    const payload = offerPayload();
    const primary = payload.primary;
    const idNumber = offerDigits(primary.idNumber);
    offer.busy = true;
    setBusy($("offerNext"), true);
    try {
      const existing = await offerExistingCustomer(idNumber);
      const guard = await offerGuard(existing);
      if (!guard.ok) {
        if (note) note.textContent = "הלקוח משויך לנציג אחר. לא ניתן להקים עבורו לקוח.";
        return;
      }
      const now = new Date().toISOString();
      const fullName = trim((primary.firstName || "") + " " + (primary.lastName || "")) || "לקוח ללא שם";
      const customerId = existing && existing.id ? existing.id : (offer.customerId || ("cust_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2, 8)));
      const proposalId = offer.proposalId || ("prop_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2, 8));
      const agentId = guard.preserve && existing ? trim(existing.agent_id) : trim(profile.id);
      const agentName = guard.preserve && existing ? trim(existing.agent_name) : trim(profile.name);
      const agentRole = guard.preserve && existing ? trim(existing.agent_role) : trim(profile.role);
      const proposalRow = {
        id: proposalId,
        status: "פתוחה",
        full_name: fullName,
        id_number: idNumber,
        phone: trim(primary.phone),
        email: trim(primary.email),
        city: trim(primary.city),
        agent_name: agentName,
        agent_id: agentId,
        agent_role: agentRole,
        current_step: 8,
        insured_count: payload.insureds.length,
        created_at: now,
        updated_at: now,
        payload: payload
      };
      const proposalSave = await sb.from("proposals").upsert(proposalRow, { onConflict: "id" });
      if (proposalSave.error) throw new Error(proposalSave.error.message || "proposal");
      const customerRow = {
        id: customerId,
        status: trim(existing && existing.status) || "חדש",
        full_name: fullName,
        id_number: idNumber,
        phone: trim(primary.phone),
        email: trim(primary.email),
        city: trim(primary.city),
        agent_name: agentName,
        agent_id: agentId,
        agent_role: agentRole,
        insured_count: payload.insureds.length,
        existing_policies_count: payload.insureds.reduce((sum, ins) => sum + ((ins.data.existingPolicies || []).length), 0),
        new_policies_count: payload.newPolicies.length,
        is_archived: false,
        created_at: existing && existing.created_at ? existing.created_at : now,
        updated_at: now,
        payload: payload
      };
      const customerSave = await sb.from("customers").upsert(customerRow, { onConflict: "id" });
      if (customerSave.error) throw new Error(customerSave.error.message || "customer");
      offer.customerId = customerId;
      offer.proposalId = proposalId;
      void publishReview("ready");
      state.file = customerRow;
      state.fileTab = "policies";
      show("customer");
      paintCustomerFile();
      openOps("customer");
    } catch (err) {
      if (note) note.textContent = "השמירה לא הושלמה: " + (err.message || "");
    } finally {
      offer.busy = false;
      setBusy($("offerNext"), false);
    }
  }

  function offerOnInput(event) {
    const el = event.target;
    const key = el.getAttribute("data-k");
    if (!key || !offer) return;
    if (el.type === "checkbox") offerWrite(key, el.checked);
    else if (el.hasAttribute("data-amount")) offerWrite(key, offerApplyAmount(el));
    else offerWrite(key, el.value);
    if (key.indexOf("draft.") === 0) void offerPriceDraft();
    if (key.indexOf("height.") === 0 || key.indexOf("weight.") === 0) {
      const parts = key.split(".");
      const ins = offer.insureds.find((item) => item.id === parts[1]);
      const card = el.closest(".offerCard");
      const live = card && card.querySelector(".bmiLive span");
      const lamp = card && card.querySelector(".bmiLamp");
      if (ins && live) {
        const tone = offerBmiTone(ins.data.bmi);
        live.textContent = (ins.data.bmi || "—") + " · " + tone.label;
        if (lamp) lamp.className = "bmiLamp" + (tone.lamp ? " bmiLamp--" + tone.lamp : "");
      }
    }
  }

  function offerOnClick(event) {
    if (!offer) return;
    const person = event.target.closest("[data-person]");
    if (person) {
      offer.active = Number(person.getAttribute("data-person")) || 0;
      offerPaint();
      return;
    }
    const har = event.target.closest("[data-har]");
    if (har) {
      const input = $("offerHarFile");
      if (input) {
        input.value = "";
        input.click();
      }
      return;
    }
    const add = event.target.closest("[data-add]");
    if (add) {
      const kind = add.getAttribute("data-add");
      if (kind === "spouse" || kind === "child") {
        if (kind === "spouse" && offer.insureds.some((ins) => ins.type === "spouse")) return;
        offer.insureds.push(offerBlankInsured(kind));
        offer.active = offer.insureds.length - 1;
      } else if (kind === "exist") {
        const error = offerAddExisting();
        const note = $("offerError");
        if (error) {
          if (note) note.textContent = error;
          return;
        }
      } else if (kind === "policy") {
        const error = offerAddPolicy();
        const note = $("offerError");
        if (error) {
          if (note) note.textContent = error;
          return;
        }
      }
      offerPaint();
      return;
    }
    const drop = event.target.closest("[data-drop]");
    if (drop) {
      const ins = offerActive();
      if (ins.type !== "primary") {
        offer.insureds.splice(offer.active, 1);
        offer.active = 0;
        offerPaint();
      }
      return;
    }
    const dropExist = event.target.closest("[data-drop-exist]");
    if (dropExist) {
      const ins = offerActive();
      const row = ins.data.existingPolicies.splice(Number(dropExist.getAttribute("data-drop-exist")), 1)[0];
      if (row) delete ins.data.cancellations[row.id];
      offerPaint();
      return;
    }
    const dropPol = event.target.closest("[data-drop-pol]");
    if (dropPol) {
      offer.policies.splice(Number(dropPol.getAttribute("data-drop-pol")), 1);
      offerPaint();
      return;
    }
    const cover = event.target.closest("[data-cover]");
    if (cover) {
      const name = cover.getAttribute("data-cover");
      const list = offer.draft.covers;
      const at = list.indexOf(name);
      if (at >= 0) list.splice(at, 1);
      else list.push(name);
      offerPaint();
      return;
    }
    const chip = event.target.closest("[data-chip]");
    if (!chip) return;
    const key = chip.getAttribute("data-chip");
    const value = chip.getAttribute("data-val");
    if (key === "needs") offer.needsKey = value;
    else if (key === "payerChoice") offer.payerChoice = value;
    else if (key === "paymentMethod") offer.paymentMethod = value;
    else if (key === "exist.status") offer.exist.status = value;
    else offerWrite(key, value);
    offerPaint();
  }

  function openOffer() {
    offer = offerFresh();
    show("offer");
    offerPaint();
  }

  function openNewCustomer() {
    openOffer();
  }

  async function loadCustomerBranches(ids) {
    const list = (ids || []).map(trim).filter(Boolean).slice(0, 20);
    if (!list.length) return [];
    const res = await sb.from("customers")
      .select("id,branch_new:payload->newPolicies,branch_ops:payload->operational->newPolicies,branch_elem:payload->elementaryPolicies")
      .in("id", list);
    if (res.error) return [];
    return res.data || [];
  }

  function customerBranches(row) {
    const found = new Set();
    const addType = (policy, skipExisting) => {
      if (skipExisting && String(policy && policy.origin || "") === "existing") return;
      const sector = salesSector(policy && (policy.type || policy.product || policy.productType || policy.category || policy.label));
      if (sector && sector !== "אחר") found.add(sector);
    };
    const primary = Array.isArray(row && row.branch_new) && row.branch_new.length ? row.branch_new : (row && row.branch_ops);
    (Array.isArray(primary) ? primary : []).forEach((policy) => addType(policy, true));
    const elementary = Array.isArray(row && row.branch_elem) ? row.branch_elem : [];
    if (elementary.length) {
      elementary.forEach((policy) => addType(policy, false));
      found.add("אלמנטרי");
    }
    return ["סיכונים", "בריאות", "אלמנטרי", "פנסיה"].filter((sector) => found.has(sector));
  }

  async function openCustomers(focusSearch) {
    show("customers");
    if (focusSearch) $("customerQuery").focus();
    $("customerList").innerHTML = '<div class="empty">טוען…</div>';
    try {
      state.customers = await loadCustomers($("customerQuery").value);
      try {
        const extra = await loadCustomerBranches(state.customers.map((row) => row.id));
        const byId = new Map(extra.map((row) => [trim(row.id), row]));
        state.customers.forEach((row) => {
          row.branches = customerBranches(byId.get(trim(row.id)));
        });
      } catch (_err) {}
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

  function faceStatus(text) {
    const node = $("faceEnrollStatus");
    if (node) node.textContent = text;
  }

  async function cancelFaceStage() {
    faceRun += 1;
    faceScan.closed = true;
    const secret = faceScan.secret;
    faceScan.secret = "";
    faceScan.token = "";
    faceScan.descriptors = [];
    faceScan.retry = false;
    faceScan.busy = false;
    resetFaceLoginButton();
    stopHiddenCamera();
    await faceCancelQuiet(secret);
  }

  async function startFaceEnroll() {
    if (faceScan.busy || !state.profile) return;
    const run = ++faceRun;
    faceScan.closed = false;
    faceScan.busy = true;
    faceScan.descriptors = [];
    faceStatus("פותחים את המצלמה…");
    armQuietCamera();
    const cameraPromise = openHiddenCamera();
    const modelsPromise = loadFaceModels();
    try {
      await faceCancelQuiet(faceScan.secret);
      const profile = state.profile;
      const created = await faceTimeout(faceCall({
        action: "create",
        kind: "enroll",
        agentId: profile.id,
        agentName: profile.name,
        agentUsername: profile.username,
        agentRole: profile.role
      }), 12000, "EXPIRED");
      faceScan.secret = created.desktopSecret || "";
      faceScan.token = created.publicToken || "";
      await faceTimeout(Promise.all([cameraPromise, modelsPromise]), 15000, "CAMERA");
      if (run !== faceRun) return;
      showFaceStage("enroll");
      const prompts = ["הסתכלו ישר למצלמה", "פנו מעט שמאלה", "פנו מעט ימינה", "שוב ישר למצלמה"];
      for (let i = 0; i < prompts.length; i += 1) {
        if (run !== faceRun) return;
        faceStageText(prompts[i] + " (" + (i + 1) + "/4)");
        faceScan.descriptors.push(await captureFace(14000, true));
        if (i < prompts.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 220));
      }
      if (run !== faceRun) return;
      faceStageText("הסריקה הושלמה. אשרו כניסה ביומטרית.");
      const approve = $("faceStageApprove");
      if (approve) {
        approve.hidden = false;
        approve.disabled = false;
        approve.textContent = "אישור כניסה ביומטרית";
      }
    } catch (err) {
      if (run !== faceRun || (err && err.code === "CANCELLED")) return;
      faceScan.descriptors = [];
      showFaceStage("enroll");
      faceOfferRetry(faceErrorText(err));
    } finally {
      if (run === faceRun) faceScan.busy = false;
    }
  }

  async function approveFaceEnroll() {
    if (faceScan.busy || faceScan.descriptors.length < 4 || !faceScan.token) return;
    faceScan.busy = true;
    const approve = $("faceStageApprove");
    if (approve) approve.disabled = true;
    faceStageText("שומר את האישור…");
    try {
      const data = await faceCall({
        action: "submit",
        publicToken: faceScan.token,
        descriptors: faceScan.descriptors,
        deviceLabel: faceDeviceLabel(),
        geoText: ""
      });
      const status = trim(data && data.status);
      if (status && status !== "enrolled") {
        const err = new Error(status);
        err.code = status;
        throw err;
      }
      writeFaceEnrollment(state.profile);
      faceScan.descriptors = [];
      faceScan.token = "";
      faceScan.secret = "";
      paintFaceButton();
      faceStatus("כניסה ביומטרית אושרה. היא תופיע מעל התחברות בפתיחה הבאה.");
      stopHiddenCamera();
    } catch (err) {
      if (approve) approve.disabled = false;
      faceOfferRetry(faceErrorText(err));
    } finally {
      faceScan.busy = false;
    }
  }

  /* GI-FACE-MATCH-START */
  function faceDistance(a, b) {
    const left = Array.isArray(a) ? a : [];
    const right = Array.isArray(b) ? b : [];
    const n = Math.min(left.length, right.length);
    let sum = 0;
    for (let i = 0; i < n; i += 1) {
      const delta = Number(left[i]) - Number(right[i]);
      sum += delta * delta;
    }
    return Math.sqrt(sum);
  }

  function faceVector(desc) {
    const list = Array.isArray(desc) ? desc : [];
    if (list.length !== 128) return null;
    const out = [];
    for (let i = 0; i < 128; i += 1) {
      const n = Number(list[i]);
      if (!Number.isFinite(n)) return null;
      out.push(n);
    }
    return out;
  }

  function faceNormalize(desc) {
    const v = faceVector(desc);
    if (!v) return null;
    let sum = 0;
    for (let i = 0; i < v.length; i += 1) sum += v[i] * v[i];
    const len = Math.sqrt(sum);
    if (!(len > 0)) return null;
    const out = [];
    for (let i = 0; i < v.length; i += 1) out.push(v[i] / len);
    return out;
  }

  function faceSeparate(left, right) {
    const gap = faceDistance(left, right);
    if (!(gap >= 0) || gap > 0.55) return null;
    if (gap >= 0.016) return right.slice();
    const target = 0.022;
    const dir = [];
    for (let i = 0; i < left.length; i += 1) {
      const delta = Number(right[i]) - Number(left[i]);
      dir.push(Math.abs(delta) > 1e-8 ? delta : (i % 2 ? -1 : 1) * (1 + (i % 7)));
    }
    let energy = 0;
    for (let i = 0; i < dir.length; i += 1) energy += dir[i] * dir[i];
    const len = Math.sqrt(energy);
    if (!(len > 0)) return null;
    const out = [];
    for (let i = 0; i < left.length; i += 1) out.push(Number(left[i]) + (dir[i] / len) * target);
    return out;
  }

  function facePickPair(samples) {
    const list = (Array.isArray(samples) ? samples : []).filter((sample) => sample && faceVector(sample.descriptor) && Number(sample.score) >= 0.45);
    if (list.length < 2) return null;
    let best = null;
    let bestNeighbors = -1;
    for (let i = 0; i < list.length; i += 1) {
      let neighbors = 0;
      for (let j = 0; j < list.length; j += 1) {
        if (i === j) continue;
        if (faceDistance(list[i].descriptor, list[j].descriptor) <= 0.55) neighbors += 1;
      }
      if (!best || neighbors > bestNeighbors || (neighbors === bestNeighbors && list[i].score > best.score)) {
        best = list[i];
        bestNeighbors = neighbors;
      }
    }
    if (!best || bestNeighbors < 1) return null;
    let chosen = null;
    for (let i = 0; i < list.length; i += 1) {
      const sample = list[i];
      if (sample === best) continue;
      const dist = faceDistance(best.descriptor, sample.descriptor);
      const timeGap = Math.abs((Number(sample.t) || 0) - (Number(best.t) || 0));
      const timed = timeGap >= 0.08 || (!(Number(best.t) > 0) && !(Number(sample.t) > 0));
      if (!timed || dist > 0.55) continue;
      const primary = faceNormalize(best.descriptor);
      const otherRaw = faceNormalize(sample.descriptor);
      if (!primary || !otherRaw) continue;
      const other = faceSeparate(primary, otherRaw);
      if (!other) continue;
      if (!chosen || sample.score > chosen.score) chosen = { score: sample.score, pair: [primary, other] };
    }
    return chosen ? chosen.pair : null;
  }
  /* GI-FACE-MATCH-END */

  async function waitFaceDecision(secret) {
    const started = Date.now();
    while (Date.now() - started < 8000) {
      const data = await faceCall({ action: "poll", desktopSecret: secret });
      const status = trim(data && data.status);
      const reason = trim(data && data.failReason);
      if (status === "approved" || status === "enrolled") return data;
      if (reason) {
        const err = new Error(reason);
        err.code = reason === "denied" ? "NO_MATCH" : reason;
        throw err;
      }
      if (status === "denied" || status === "expired" || status === "cancelled") {
        const err = new Error(status);
        err.code = status === "denied" ? "NO_MATCH" : (status === "expired" ? "EXPIRED" : "SESSION_CLOSED");
        throw err;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }
    const expired = new Error("EXPIRED");
    expired.code = "EXPIRED";
    throw expired;
  }

  function faceLoginNote(text) {
    const btn = $("btnFace");
    if (btn) btn.textContent = text || "כניסה ביומטרית";
  }

  function resetFaceLoginButton() {
    const btn = $("btnFace");
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = "כניסה ביומטרית";
  }

  async function scanFaceForLogin(run) {
    const cam = $("faceCam");
    const samples = [];
    const started = Date.now();
    let sawFace = false;
    while (Date.now() - started < 12000) {
      if (run !== faceRun || faceScan.closed) {
        const cancelled = new Error("CANCELLED");
        cancelled.code = "CANCELLED";
        throw cancelled;
      }
      let sample = null;
      try {
        sample = await detectFaceSample(cam);
      } catch (err) {
        if (err && (err.code === "CANCELLED" || err.code === "MODEL")) throw err;
      }
      if (run !== faceRun || faceScan.closed) return null;
      if (!sample) {
        setFaceSeen(false);
        faceStageText("ממקמים את הפנים במרכז הטבעת");
      } else {
        sawFace = true;
        sample.t = cam && Number(cam.currentTime) > 0 ? Number(cam.currentTime) : 0;
        samples.push(sample);
        if (samples.length > 24) samples.shift();
        setFaceSeen(sample.score >= 0.45);
        const pair = facePickPair(samples);
        if (pair && Date.now() - started > 500) {
          setFaceSeen(true);
          faceStageText("מזהים את הפנים…");
          return pair;
        }
        faceStageText("מזהים את הפנים…");
      }
      await new Promise((resolve) => window.setTimeout(resolve, 90));
    }
    setFaceSeen(false);
    const missed = new Error(sawFace ? "LIVENESS" : "NO_FACE");
    missed.code = sawFace ? "LIVENESS" : "NO_FACE";
    throw missed;
  }

  async function startFaceLogin() {
    const enrolled = readFaceEnrollment();
    if (!enrolled || faceScan.busy) return;
    const run = ++faceRun;
    faceScan.closed = false;
    faceScan.busy = true;
    faceScan.mode = "login";
    faceScan.retry = false;
    const errNode = $("faceError");
    if (errNode) errNode.textContent = "";
    const btn = $("btnFace");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "מזהה פנים…";
    }
    showFaceStage("login");
    faceStageText("פותחים את המצלמה…");
    const cameraPromise = openHiddenCamera();
    const modelsPromise = loadFaceModels();
    try {
      await faceCancelQuiet(faceScan.secret);
      let created = await faceTimeout(faceCall({
        action: "create",
        kind: "login",
        agentId: enrolled.id,
        agentName: enrolled.name,
        agentUsername: enrolled.username,
        agentRole: enrolled.role
      }), 12000, "EXPIRED");
      faceScan.secret = created.desktopSecret || "";
      await faceTimeout(Promise.all([cameraPromise, modelsPromise]), 15000, "CAMERA");
      if (run !== faceRun) return;
      let approved = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (run !== faceRun) return;
        if (attempt) faceStageText("ממשיכים לזהות…");
        try {
          const pair = await scanFaceForLogin(run);
          if (run !== faceRun) return;
          if (!pair) {
            const missed = new Error("LIVENESS");
            missed.code = "LIVENESS";
            throw missed;
          }
          faceStageText("מזהים את הפנים…");
          let data = await faceTimeout(faceCall({
            action: "submit",
            publicToken: created.publicToken,
            descriptors: pair,
            deviceLabel: faceDeviceLabel(),
            geoText: ""
          }), 12000, "EXPIRED");
          let status = trim(data && data.status);
          if (!status || status === "pending" || status === "scanned") {
            data = await waitFaceDecision(created.desktopSecret);
            status = trim(data && data.status);
          }
          if (status && status !== "approved") {
            const err = new Error(status);
            err.code = status === "denied" ? "NO_MATCH" : status;
            throw err;
          }
          approved = data;
          break;
        } catch (err) {
          if (run !== faceRun || (err && err.code === "CANCELLED")) throw err;
          if (!(err && (err.code === "NO_MATCH" || err.code === "LIVENESS") && attempt === 0)) throw err;
          await faceCancelQuiet(faceScan.secret);
          created = await faceTimeout(faceCall({
            action: "create",
            kind: "login",
            agentId: enrolled.id,
            agentName: enrolled.name,
            agentUsername: enrolled.username,
            agentRole: enrolled.role
          }), 12000, "EXPIRED");
          faceScan.secret = created.desktopSecret || "";
        }
      }
      if (!approved) {
        const missed = new Error("NO_MATCH");
        missed.code = "NO_MATCH";
        throw missed;
      }
      faceStageText("הפנים זוהו. נכנסים…");
      const matched = Object.assign({}, enrolled, { id: trim(approved && approved.agentId) || enrolled.id });
      await openFaceSession(matched, created.desktopSecret);
      if (run !== faceRun) return;
      faceScan.secret = "";
      stopHiddenCamera();
      await enterApp();
    } catch (err) {
      if (run !== faceRun) return;
      const secret = faceScan.secret;
      faceScan.secret = "";
      resetFaceLoginButton();
      await faceCancelQuiet(secret);
      if (err && err.code === "CANCELLED") {
        stopHiddenCamera();
        return;
      }
      setFaceSeen(false);
      showFaceStage("login");
      faceOfferRetry(faceErrorText(err));
    } finally {
      if (run === faceRun) faceScan.busy = false;
    }
  }

  async function boot() {
    paintFaceButton();
    const session = await sb.auth.getSession();
    if (!session.data || !session.data.session) {
      show("splash");
      return;
    }
    if ((await assurance()) !== "aal2") {
      const kept = readStoredProfile();
      let facePass = false;
      try { facePass = localStorage.getItem(FACE_PASS_KEY) === trim(kept && kept.id); } catch (_facePass) { facePass = false; }
      if (!facePass) {
        await signOut();
        show("splash");
        return;
      }
    }
    const stored = readStoredProfile();
    if (!stored) {
      await signOut();
      show("splash");
      return;
    }
    state.profile = stored;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const left = (reduced ? 200 : 2600) - (Date.now() - splashAt);
    if (left > 0) await new Promise((resolve) => window.setTimeout(resolve, left));
    await enterApp();
  }

  $("btnEnter").addEventListener("click", () => {
    $("loginError").textContent = "";
    show("login");
  });
  $("btnFace").addEventListener("click", () => { void startFaceLogin(); });
  $("faceStageApprove").addEventListener("click", () => {
    if (faceScan.retry) {
      const mode = faceScan.mode;
      faceScan.retry = false;
      faceScan.busy = false;
      if (mode === "login") void startFaceLogin();
      else void startFaceEnroll();
      return;
    }
    void approveFaceEnroll();
  });
  $("faceStageCancel").addEventListener("click", () => { void cancelFaceStage(); });
  $("offerHarFile").addEventListener("change", () => {
    const file = $("offerHarFile").files && $("offerHarFile").files[0];
    void offerImportHar(file);
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
      await withTimeout(openSession(username, pin), 20000);
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

  $("btnReport").addEventListener("click", () => { void openSales(); });
  $("btnQuote").addEventListener("click", () => openSim());
  $("btnSimBack").addEventListener("click", () => simBack());
  $("simBody").addEventListener("click", (event) => simClick(event));
  $("simBody").addEventListener("change", (event) => {
    if (event.target.id !== "simDiscount" || !state.sim) return;
    state.sim.discountKey = event.target.value;
    paintSim();
  });
  $("simBody").addEventListener("input", (event) => {
    if (event.target.id === "simDiscountPct" && state.sim) {
      state.sim.discountPct = event.target.value;
      paintSimAfter();
      return;
    }
    if (event.target.id !== "simSum") return;
    const next = groupSum(event.target.value);
    if (event.target.value !== next) {
      event.target.value = next;
      try { event.target.setSelectionRange(next.length, next.length); } catch (_err) {}
    }
    if (state.sim) state.sim.sum = next;
  });
  $("btnSold").addEventListener("click", () => { void openCompanies(); });
  $("btnMenu").addEventListener("click", () => setMenu($("homeMenu").hidden));
  $("homeMenuBackdrop").addEventListener("click", () => setMenu(false));
  $("customerList").addEventListener("click", (event) => {
    const card = event.target.closest("[data-customer]");
    if (!card) return;
    void openCustomer(card.getAttribute("data-customer"));
  });
  $("customerFile").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-filetab]");
    if (tab && state.file) {
      state.fileTab = tab.getAttribute("data-filetab") || "policies";
      closeFolioMenu();
      paintCustomerFile({ scroll: true });
      return;
    }
    const policy = event.target.closest("[data-policy]");
    if (policy) {
      openPolicy(Number(policy.getAttribute("data-policy")));
      return;
    }
    const doc = event.target.closest("[data-doc]");
    if (doc) {
      const file = state.fileDocs[Number(doc.getAttribute("data-doc"))];
      const note = $("fileNote");
      if (note) note.textContent = "";
      void viewDocument(file);
      return;
    }
    if (event.target.closest("[data-assign]")) void openAssign();
    if (event.target.closest("[data-edit]")) openEdit();
  });
  $("policyBody").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-poltab]");
    if (tab) {
      state.policyTab = tab.getAttribute("data-poltab");
      state.policyReport = false;
      paintPolicy();
      return;
    }
    const doc = event.target.closest("[data-pdoc]");
    if (!doc) return;
    const file = state.policyDocs[Number(doc.getAttribute("data-pdoc"))];
    const note = $("policyNote");
    if (note) note.textContent = "";
    void viewDocument(file);
  });
  $("btnDocClose").addEventListener("click", closeDocument);
  $("btnDocSave").addEventListener("click", () => {
    if (state.docBlob) saveBlob(state.docBlob, state.docName || "document");
  });
  $("policyFoot").addEventListener("click", (event) => {
    if (!event.target.closest("#btnPolicyReport")) return;
    openOps("policy");
  });
  $("btnOpsBack").addEventListener("click", () => {
    if (state.opsReturn === "customer") show("customer");
    else show("policy");
  });
  $("btnOpsDownload").addEventListener("click", downloadOpsReport);
  $("btnOpsSend").addEventListener("click", () => { void sendOpsReport(); });
  $("btnPolicyBack").addEventListener("click", () => show("customer"));
  $("btnPolicyShare").addEventListener("click", async () => {
    const policy = state.filePolicies[state.policyIndex];
    if (!policy) return;
    const text = [policyTitle(policy), policyCompany(policy), policyNumber(policy) ? "מספר פוליסה: " + policyNumber(policy) : ""].filter(Boolean).join("\n");
    try {
      if (navigator.share) await navigator.share({ title: "פוליסה", text: text });
      else if (navigator.clipboard) await navigator.clipboard.writeText(text);
    } catch (_err) {}
  });
  function openProfile() {
    show("profile");
    paintProfile();
  }
  $("btnProfileBack").addEventListener("click", () => show("home"));
  $("profileBody").addEventListener("click", (event) => {
    if (event.target.closest("#btnAvatar")) {
      const input = $("avatarFile");
      if (input) input.click();
      return;
    }
    const row = event.target.closest("[data-account]");
    if (!row) return;
    const kind = row.getAttribute("data-account");
    if (kind === "logout") {
      void signOut().then(() => show("splash"));
      return;
    }
    openAccount(kind);
  });
  $("profileBody").addEventListener("change", (event) => {
    const input = event.target.closest("#avatarFile");
    const file = input && input.files && input.files[0];
    if (!file) return;
    cropAvatar(file).then((url) => {
      writeAvatar(url);
      paintHomeIdentity();
      paintProfile();
    }).catch(() => {});
  });
  $("btnAccountBack").addEventListener("click", () => {
    show("profile");
    paintProfile();
  });
  $("accountBody").addEventListener("click", (event) => {
    if (!event.target.closest("#btnNotify")) return;
    void enablePush(true);
  });
  function contactFields(file) {
    const payload = file && file.payload && typeof file.payload === "object" ? file.payload : {};
    const primary = payload.primary || (payload.insureds && payload.insureds[0] && payload.insureds[0].data) || {};
    return {
      phone: trim(file && file.phone) || trim(primary.phone),
      email: trim(file && file.email) || trim(primary.email) || trim(payload.email)
    };
  }
  function openEdit() {
    const file = state.file;
    if (!file) return;
    const fields = contactFields(file);
    $("editPhone").value = fields.phone;
    $("editEmail").value = fields.email;
    $("editError").textContent = "";
    $("editSheet").hidden = false;
  }
  async function saveContact(event) {
    event.preventDefault();
    const file = state.file;
    if (!file) return;
    const phone = trim($("editPhone").value);
    const email = trim($("editEmail").value);
    if (email && email.indexOf("@") < 1) {
      $("editError").textContent = "האימייל לא נראה תקין.";
      return;
    }
    const payload = JSON.parse(JSON.stringify(file.payload && typeof file.payload === "object" ? file.payload : {}));
    payload.primary = payload.primary && typeof payload.primary === "object" ? payload.primary : {};
    payload.primary.phone = phone;
    payload.primary.email = email;
    if (payload.insureds && payload.insureds[0] && payload.insureds[0].data && typeof payload.insureds[0].data === "object") {
      payload.insureds[0].data.phone = phone;
      payload.insureds[0].data.email = email;
    }
    const patch = { phone: phone, email: email, updated_at: new Date().toISOString(), payload: payload };
    setBusy($("editSave"), true);
    $("editError").textContent = "";
    try {
      const res = await sb.from("customers").update(patch).eq("id", file.id);
      if (res.error) throw new Error(res.error.message || "edit");
      file.phone = phone;
      file.email = email;
      file.payload = payload;
      $("editSheet").hidden = true;
      paintCustomerFile();
      const note = $("fileNote");
      if (note) note.textContent = "פרטי הקשר נשמרו";
    } catch (err) {
      $("editError").textContent = err.message || "השמירה לא הצליחה";
    } finally {
      setBusy($("editSave"), false);
    }
  }
  function paintAssignList() {
    const q = token($("assignQuery").value);
    const current = trim(state.file && state.file.agent_id);
    const rows = state.agents.filter((agent) => {
      if (!q) return true;
      return token(agent.name).indexOf(q) >= 0 || token(agent.username).indexOf(q) >= 0;
    });
    $("assignList").innerHTML = rows.length
      ? rows.map((agent) => {
        const id = trim(agent.id);
        const currentMark = current && id === current;
        const selected = state.assignAgentId === id;
        return '<button class="assignRow' + (selected ? " is-on" : "") + '" type="button" data-agent="' + esc(id) + '"' + (currentMark ? " disabled" : "") + '><b>' + esc(trim(agent.name) || "נציג") + '</b><span>' + esc(currentMark ? "משויך כעת" : roleLabel(agent.role)) + '</span></button>';
      }).join("")
      : '<div class="empty">לא נמצאו נציגים</div>';
  }
  async function openAssign() {
    if (!canAssign() || !state.file) return;
    state.assignAgentId = "";
    $("assignError").textContent = "";
    $("assignQuery").value = "";
    const currentName = trim(state.file.agent_name) || trim(state.file.payload && state.file.payload.agentName) || "לא משויך";
    $("assignCurrent").textContent = "נציג נוכחי: " + currentName;
    $("assignSheet").hidden = false;
    $("assignList").innerHTML = '<div class="empty">טוען…</div>';
    try {
      const res = await sb.from("agents").select("id,name,username,role,active").limit(400);
      if (res.error) throw new Error(res.error.message || "agents");
      state.agents = (res.data || []).filter((agent) => agent && agent.active !== false && trim(agent.id));
      paintAssignList();
    } catch (_err) {
      $("assignList").innerHTML = '<div class="empty">לא ניתן לטעון נציגים</div>';
    }
  }
  async function confirmAssign() {
    if (!canAssign()) return;
    const file = state.file;
    const target = state.agents.find((agent) => trim(agent.id) === state.assignAgentId);
    if (!file || !target) {
      $("assignError").textContent = "חפש ובחר נציג לשיוך.";
      return;
    }
    if (trim(file.agent_id) === trim(target.id)) {
      $("assignError").textContent = "הלקוח כבר משויך לנציג זה.";
      return;
    }
    const name = trim(target.name) || trim(target.username) || "נציג";
    const userPart = trim(target.username) || name;
    const key = (trim(target.id) + "__" + userPart).toLowerCase().replace(/\s+/g, "_");
    const payload = file.payload && typeof file.payload === "object" ? Object.assign({}, file.payload) : {};
    payload.agentId = trim(target.id);
    payload.agentName = name;
    payload.createdBy = name;
    payload.createdByKey = key;
    const patch = {
      agent_id: trim(target.id),
      agent_name: name,
      agent_role: roleLabel(target.role),
      updated_at: new Date().toISOString(),
      payload: payload
    };
    setBusy($("assignConfirm"), true);
    $("assignError").textContent = "";
    try {
      const res = await sb.from("customers").update(patch).eq("id", file.id);
      if (res.error) throw new Error(res.error.message || "assign");
      const idNumber = trim(file.id_number);
      if (idNumber) {
        const props = await sb.from("proposals").select("id,payload").eq("id_number", idNumber).limit(30);
        if (!props.error) {
          for (let i = 0; i < (props.data || []).length; i += 1) {
            const row = props.data[i];
            const next = row.payload && typeof row.payload === "object" ? Object.assign({}, row.payload) : {};
            next.agentId = patch.agent_id;
            next.agentName = name;
            next.createdBy = name;
            next.createdByKey = key;
            await sb.from("proposals").update({
              agent_id: patch.agent_id,
              agent_name: name,
              agent_role: patch.agent_role,
              updated_at: patch.updated_at,
              payload: next
            }).eq("id", row.id);
          }
        }
      }
      file.agent_id = patch.agent_id;
      file.agent_name = name;
      file.payload = payload;
      $("assignSheet").hidden = true;
      paintCustomerFile();
      const note = $("fileNote");
      if (note) note.textContent = "הלקוח שויך ל־" + name;
    } catch (err) {
      $("assignError").textContent = err.message || "השיוך לא נשמר";
    } finally {
      setBusy($("assignConfirm"), false);
    }
  }
  function israelDateKey() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  function israelDayLabel() {
    return new Intl.DateTimeFormat("he-IL", {
      timeZone: "Asia/Jerusalem",
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(new Date());
  }

  function stampDateIL(raw) {
    const s = trim(raw);
    if (!s) return "";
    const isoDay = /^(\d{4}-\d{2}-\d{2})$/.exec(s);
    if (isoDay) return isoDay[1];
    const ilDay = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (ilDay) return ilDay[3] + "-" + ilDay[2] + "-" + ilDay[1];
    const ms = Date.parse(s);
    if (!Number.isFinite(ms)) {
      const prefix = /^(\d{4}-\d{2}-\d{2})/.exec(s);
      return prefix ? prefix[1] : "";
    }
    try {
      return new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
    } catch (_err) {
      const prefix = /^(\d{4}-\d{2}-\d{2})/.exec(s);
      return prefix ? prefix[1] : "";
    }
  }

  function moneyNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  }

  function leadMeta(description) {
    const text = String(description || "");
    const mark = "---LEAD_META_JSON---";
    const at = text.lastIndexOf(mark);
    if (at < 0) return {};
    try {
      const parsed = JSON.parse(text.slice(at + mark.length).trim());
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_err) {
      return {};
    }
  }

  const SECTOR_TYPE = {
    "ריסק": "סיכונים",
    "ריסק משכנתא": "סיכונים",
    "ביטוח חיים": "סיכונים",
    "אובדן כושר עבודה": "סיכונים",
    "בריאות": "בריאות",
    "מחלות קשות": "בריאות",
    "סרטן": "בריאות",
    "מדיקר": "בריאות",
    "רכב": "אלמנטרי",
    "דירה": "אלמנטרי",
    "פנסיה": "פנסיה"
  };

  function salesSector(rawType) {
    const type = trim(rawType);
    if (SECTOR_TYPE[type]) return SECTOR_TYPE[type];
    if (/ריסק|משכנת|חיים|כושר/i.test(type)) return "סיכונים";
    if (/בריאות|מחלות|סרטן|מדיקר/i.test(type)) return "בריאות";
    if (/רכב|דירה|אלמנטר/i.test(type)) return "אלמנטרי";
    if (/פנס/i.test(type)) return "פנסיה";
    if (/גמל|השתלמות|קרן|פיצוי|תגמול/i.test(type)) return "פנסיה";
    if (/מקיף|חובה|צד\s*ג|רכוש|עסק|נסיע|תכולה|מבנה/i.test(type)) return "אלמנטרי";
    return "אחר";
  }

  function sectorLabel(sector) {
    if (sector === "סיכונים") return "פרט";
    if (sector === "אחר") return "בריאות / פרט";
    return sector || "—";
  }

  function sectorUnit(sector) {
    return sector === "אלמנטרי" ? "שנתית" : "חודשית";
  }

  function countLabel(count, one, many) {
    return (Number(count) || 0) === 1 ? one : String(Number(count) || 0) + " " + many;
  }

  function officeBranch(value) {
    const raw = trim(value).toLowerCase().replace(/[\s_-]+/g, "");
    if (raw === "חיפה" || raw === "haifa") return "חיפה";
    if (raw === "מודיעין" || raw === "modiin" || raw === "modi'in" || raw === "מודיעיןמכביםרעות") return "מודיעין";
    return "";
  }

  function nameKey(value) {
    return trim(value).replace(/\s+/g, " ").toLowerCase();
  }

  async function loadAgentDirectory() {
    const res = await sb.from("agents").select("id,name").limit(400);
    if (res.error) throw new Error(res.error.message || "agents");
    return res.data || [];
  }

  async function loadBranchMap() {
    const res = await sb.from("app_meta").select("agent_branches:payload->agentBranches").eq("key", "global").maybeSingle();
    if (res.error) throw new Error(res.error.message || "branches");
    const raw = res.data && res.data.agent_branches;
    const map = {};
    if (raw && typeof raw === "object") {
      Object.keys(raw).forEach((id) => {
        const branch = officeBranch(raw[id]);
        if (trim(id) && branch) map[trim(id)] = branch;
      });
    }
    return map;
  }

  function branchForAgent(map, agentId) {
    const id = trim(agentId);
    if (!id) return "";
    if (map[id]) return map[id];
    const lower = id.toLowerCase();
    const key = Object.keys(map).find((item) => item.toLowerCase() === lower);
    return key ? map[key] : "";
  }

  function matchAgentId(agents, agentName) {
    const key = nameKey(agentName);
    if (!key) return "";
    const exact = (agents || []).find((row) => nameKey(row.name) === key);
    return exact ? trim(exact.id) : "";
  }

  async function loadSalesReport() {
    const sales = await sb.rpc("gi_daily_sales_by_agent", scopeArgs(israelRange()));
    if (sales.error) throw new Error(sales.error.message || "sales");
    const agents = await loadAgentDirectory();
    const branches = await loadBranchMap();
    const byAgent = new Map();
    (Array.isArray(sales.data) ? sales.data : []).forEach((row) => {
      const name = trim(row.agent_name) || "נציג";
      const sector = salesSector(row.product);
      const premium = Math.round((Number(row.premium) || 0) * 100) / 100;
      const policies = Number(row.policies) || 0;
      if (!byAgent.has(name)) {
        const id = matchAgentId(agents, name);
        byAgent.set(name, {
          name: name,
          branch: branchForAgent(branches, id),
          sectors: new Map(),
          premium: 0
        });
      }
      const agent = byAgent.get(name);
      if (!agent.sectors.has(sector)) agent.sectors.set(sector, { sector: sector, premium: 0, policies: 0 });
      const bucket = agent.sectors.get(sector);
      bucket.premium = Math.round((bucket.premium + premium) * 100) / 100;
      bucket.policies += policies;
      agent.premium = Math.round((agent.premium + premium) * 100) / 100;
    });
    const list = Array.from(byAgent.values()).sort((a, b) => b.premium - a.premium || a.name.localeCompare(b.name, "he"));
    const areas = {
      "מודיעין": { premium: 0, policies: 0, agents: 0 },
      "חיפה": { premium: 0, policies: 0, agents: 0 },
      "": { premium: 0, policies: 0, agents: 0 }
    };
    list.forEach((agent) => {
      const key = agent.branch === "מודיעין" || agent.branch === "חיפה" ? agent.branch : "";
      const policies = Array.from(agent.sectors.values()).reduce((sum, line) => sum + (Number(line.policies) || 0), 0);
      agent.policies = policies;
      areas[key].premium = Math.round((areas[key].premium + agent.premium) * 100) / 100;
      areas[key].policies += policies;
      areas[key].agents += 1;
    });
    return {
      agents: list,
      modiin: areas["מודיעין"].premium,
      haifa: areas["חיפה"].premium,
      unassigned: areas[""].premium,
      areas: areas
    };
  }

  function saleCard(label, bucket, wide) {
    const meta = countLabel(bucket.agents || 0, "נציג אחד", "נציגים") + " · " + countLabel(bucket.policies || 0, "פוליסה אחת", "פוליסות");
    return '<div class="areaCard' + (wide ? " areaCard--wide" : "") + '"><span>' + esc(label) + '</span><strong class="saleNum">' + esc(money(bucket.premium || 0)) + "</strong><small>" + esc(meta) + "</small></div>";
  }

  function paintSales(report) {
    const areas = report.areas || {
      "מודיעין": { premium: report.modiin || 0, policies: 0, agents: 0 },
      "חיפה": { premium: report.haifa || 0, policies: 0, agents: 0 },
      "": { premium: report.unassigned || 0, policies: 0, agents: 0 }
    };
    const both = {
      premium: Math.round(((areas["מודיעין"].premium || 0) + (areas["חיפה"].premium || 0)) * 100) / 100,
      policies: (areas["מודיעין"].policies || 0) + (areas["חיפה"].policies || 0),
      agents: (areas["מודיעין"].agents || 0) + (areas["חיפה"].agents || 0)
    };
    const unassigned = areas[""].premium > 0 ? saleCard("ללא אזור", areas[""], false) : "";
    const cards = '<p class="moreLead">' + esc(israelDayLabel()) + '</p><div class="areaGrid">'
      + saleCard("מודיעין", areas["מודיעין"], false)
      + saleCard("חיפה", areas["חיפה"], false)
      + saleCard("סה״כ שני האזורים", both, true)
      + unassigned
      + "</div>";
    if (!report.agents.length) {
      $("salesBody").innerHTML = cards + '<div class="empty">אין מכירות ביום זה</div>';
      return;
    }
    const groups = ["מודיעין", "חיפה", ""].map((key) => {
      const agents = report.agents.filter((agent) => (agent.branch === "מודיעין" || agent.branch === "חיפה" ? agent.branch : "") === key);
      if (!agents.length) return "";
      const rows = agents.map((agent) => {
        const lines = Array.from(agent.sectors.values()).sort((a, b) => b.premium - a.premium).map((line) => {
          return '<div class="sectorLine"><span>' + esc(sectorLabel(line.sector)) + '</span><b class="saleNum">' + esc(money(line.premium)) + '</b><small>'
            + esc(countLabel(line.policies, "פוליסה אחת", "פוליסות")) + " · " + esc(sectorUnit(line.sector)) + "</small></div>";
        }).join("");
        return '<article class="agentSale"><header><b>' + esc(agent.name) + '</b><strong class="saleNum">' + esc(money(agent.premium)) + "</strong></header>" + lines + "</article>";
      }).join("");
      return '<section class="saleGroup"><h2 class="blockTitle">' + esc(key || "ללא אזור") + "</h2>" + rows + "</section>";
    }).join("");
    $("salesBody").innerHTML = cards + groups;
  }

  async function openSales() {
    show("sales");
    $("salesBody").innerHTML = '<div class="empty">טוען…</div>';
    try {
      await loadScope();
      paintSales(await loadSalesReport());
    } catch (_err) {
      $("salesBody").innerHTML = '<div class="empty">לא ניתן לטעון את דוח המכירות</div>';
    }
  }

  const FLOOR_VIEWS = {
    dashboard: "דשבורד",
    customers: "לקוחות",
    archivedCustomers: "לקוחות שנגנזו",
    proposals: "הצעות",
    elementaryProposals: "הצעות אלמנטרי",
    campaignLeads: "מערכת לידים",
    campaignMyLeads: "הלידים שלי",
    dailySales: "מכירות",
    agentActivity: "פעילות נציג",
    reportsHub: "דוחות",
    dailyReport: "דוח מכירות",
    contacts: "אנשי קשר",
    settings: "הגדרות",
    users: "ניהול משתמשים",
    myTeam: "הצוות שלי",
    myTools: "כלים",
    myProcesses: "התהליכים שלי",
    mirrorCall: "שיחת שיקוף",
    elementaryMirror: "שיקוף אלמנטרי",
    wizard: "אשף"
  };

  function floorFlow(flowType) {
    const flow = trim(flowType);
    if (flow === "elementary") return "אשף אלמנטרי";
    if (flow === "car_click" || flow === "car" || flow === "carInsuranceClick") return "אשף רכב בקליק";
    if (flow === "health" || flow === "health_risks" || flow === "health-risks") return "אשף בריאות וסיכונים";
    return "";
  }

  function floorAction(action) {
    const key = trim(action);
    if (key === "saved_draft") return "שמר הצעה";
    if (key === "paused") return "עצר באמצע";
    if (key === "in_wizard") return "באשף";
    if (key === "viewing_lead") return "צופה בליד";
    if (key === "viewing_customer") return "תיק לקוח";
    if (key === "submitted_proposal") return "הגיש הצעה";
    if (key === "downloading_file") return "מוריד קובץ";
    if (key === "creating_reminder") return "יצר תזכורת";
    if (key === "opening_reminder") return "פותח תזכורת";
    if (key === "typing_lead") return "מקלידה ליד";
    if (key === "idle_surveyor") return "אין פעילות הקלדת ליד";
    return "";
  }

  function floorPremium(row) {
    const now = Number(row && row.premium_now) || 0;
    const before = Number(row && row.premium_before) || 0;
    if (before > 0 && now > 0 && Math.abs(now - before) >= 0.5) {
      return "פרמיה לפני " + money(before) + " · אחרי " + money(now);
    }
    if (now > 0) return "פרמיה " + money(now);
    return trim(row && row.extra_label);
  }

  function floorWhere(row) {
    const action = trim(row && row.action);
    const actionLabel = floorAction(action);
    const extra = trim(row && row.extra_label);
    const entity = trim(row && row.entity_label);
    const wizard = row && (row.wizard_open === true || action === "in_wizard" || action === "saved_draft" || action === "paused" || action === "submitted_proposal");
    if (wizard) {
      const bits = [floorFlow(row.flow_type) || trim(row.view_label) || "אשף"];
      if (trim(row.step_label)) bits.push(trim(row.step_label));
      if (actionLabel && action !== "in_wizard") bits.push(actionLabel);
      const premium = floorPremium(row);
      if (premium) bits.push(premium);
      return bits.join(" · ");
    }
    if (action === "viewing_customer") return "תיק לקוח" + (entity ? " · " + entity : "");
    if (action === "viewing_lead") return "צופה בליד" + (entity ? " · " + entity : "");
    if (action === "downloading_file") return "מוריד קובץ" + (extra ? " · " + extra : "") + (entity ? " · " + entity : "");
    if (action === "creating_reminder") return "יצר תזכורת" + (entity ? " · " + entity : "");
    if (action === "opening_reminder") return "פותח תזכורת" + (entity ? " · " + entity : (extra ? " · " + extra : ""));
    if (action === "typing_lead") return "מקלידה ליד עכשיו";
    if (action === "idle_surveyor") return "אין פעילות הקלדת ליד";
    if (actionLabel) return actionLabel + (entity ? " · " + entity : "");
    return trim(row && row.view_label) || FLOOR_VIEWS[trim(row && row.view)] || trim(row && row.view) || "מסך המערכת";
  }

  function floorVisible(row) {
    if (!state.scope) return true;
    const id = trim(row && row.agent_id);
    if (id && state.scope.ids.indexOf(id) >= 0) return true;
    return state.scope.tokens.has(token(row && row.name));
  }

  async function loadActivity() {
    const cutoff = new Date(Date.now() - 120000).toISOString();
    const res = await sb.from("gi_agent_live")
      .select("id,agent_id,name,view,view_label,wizard_open,flow_type,step_label,action,entity_label,extra_label,premium_now,premium_before,updated_at")
      .eq("online", true)
      .gte("updated_at", cutoff)
      .limit(200);
    if (res.error) throw new Error(res.error.message || "activity");
    return (res.data || []).filter(floorVisible).sort((a, b) => trim(a.name).localeCompare(trim(b.name), "he"));
  }

  function paintActivity(rows) {
    if (!rows.length) {
      $("activityBody").innerHTML = '<div class="empty">אין נציגים מחוברים כרגע</div>';
      return;
    }
    $("activityBody").innerHTML = '<p class="moreLead">מי מחובר עכשיו, ובאיזה מסך</p><div class="liveList">' + rows.map((row) => {
      const where = floorWhere(row);
      const entity = trim(row.entity_label);
      const place = entity && where.indexOf(entity) < 0 ? entity : "";
      return '<article class="liveRow"><span class="liveRow__dot" aria-hidden="true"></span><div><b>' + esc(trim(row.name) || "נציג") + "</b><span>" + esc(where) + "</span>" + (place ? "<small>" + esc(place) + "</small>" : "") + "</div></article>";
    }).join("") + "</div>";
  }

  async function refreshActivity() {
    const screen = document.querySelector('[data-screen="activity"]');
    if (!screen || screen.hidden) return;
    try {
      paintActivity(await loadActivity());
    } catch (_err) {}
  }

  async function openActivity() {
    if (!canAssign()) {
      show("home");
      return;
    }
    show("activity");
    $("activityBody").innerHTML = '<div class="empty">טוען…</div>';
    try {
      await loadScope();
      paintActivity(await loadActivity());
    } catch (_err) {
      $("activityBody").innerHTML = '<div class="empty">לא ניתן לטעון את פעילות הנציגים</div>';
    }
  }

  async function loadClosedLeads() {
    const range = israelRange();
    const rows = [];
    const page = 200;
    const windowFilter = 'and(created_at.gte."' + range.start + '",created_at.lt."' + range.end + '"),and(updated_at.gte."' + range.start + '",updated_at.lt."' + range.end + '")';
    for (let i = 0; i < 4; i += 1) {
      let query = sb.from("campaign_leads")
        .select("description,campaign_id,campaign_label,assigned_agent_id")
        .ilike("description", "%LEAD_META_JSON%")
        .or(windowFilter)
        .range(i * page, i * page + page - 1);
      if (state.scope) query = query.in("assigned_agent_id", state.scope.ids);
      const res = await query;
      if (res.error) throw new Error(res.error.message || "lead premium");
      const batch = res.data || [];
      batch.forEach((row) => rows.push(row));
      if (batch.length < page) break;
    }
    return rows;
  }

  function campaignRows(leads) {
    const day = israelDateKey();
    const map = new Map();
    let monthly = 0;
    let annual = 0;
    (leads || []).forEach((row) => {
      const meta = leadMeta(row.description);
      const month = moneyNumber(meta.proposalPremiumMonthly);
      const year = moneyNumber(meta.proposalPremiumAnnual);
      if (!(month > 0) && !(year > 0)) return;
      if (stampDateIL(meta.proposalPremiumAt) !== day) return;
      monthly = Math.round((monthly + month) * 100) / 100;
      annual = Math.round((annual + year) * 100) / 100;
      const key = trim(row.campaign_id) || trim(row.campaign_label) || "general";
      const label = trim(row.campaign_label) || "כללי";
      if (!map.has(key)) map.set(key, { label: label, customers: 0, monthly: 0, annual: 0 });
      const item = map.get(key);
      item.customers += 1;
      item.monthly = Math.round((item.monthly + month) * 100) / 100;
      item.annual = Math.round((item.annual + year) * 100) / 100;
    });
    const campaigns = Array.from(map.values()).sort((a, b) => (b.monthly + b.annual) - (a.monthly + a.annual) || a.label.localeCompare(b.label, "he"));
    return { monthly: monthly, annual: annual, campaigns: campaigns };
  }

  const LEAD_COLS = "id,phone,customer_name,description,campaign_label,assigned_agent_id,assigned_agent_name,status,source,created_at,id_number,id_issue_date,birth_date";
  const LEAD_CHOICES = [
    ["new", "ליד חדש"],
    ["in_progress", "בטיפול"],
    ["no_answer", "אין מענה"],
    ["agent_appointment", "מינוי סוכן"],
    ["closed", "נסגר"],
    ["irrelevant", "לא רלוונטי"]
  ];
  const REVIEW_SHARE = "https://gi-go.rainy-reference.workers.dev/";
  const REVIEW_PAGE = "https://gemelinvest.github.io/gemel-invest/phone/review.html?c=";
  const PORTAL_SHARE = "https://gi-go.rainy-reference.workers.dev/";
  const REVIEW_RANK = { intro: 0, checking: 1, existing: 2, offered: 3, health: 4, ready: 5 };
  let leadsWired = false;
  let leadMonth = "";
  let leadWired = false;
  let openLeadRow = null;
  let leadDraft = "";
  let leadNotice = "";
  let leadNoticeErr = false;

  function jerusalemBounds(dayKey) {
    const parts = String(dayKey || "").split("-").map(Number);
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    const probe = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(probe);
    const get = (type) => formatted.find((part) => part.type === type).value;
    const wall = Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")), Number(get("hour")), Number(get("minute")), Number(get("second")));
    const offset = wall - probe.getTime();
    const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offset);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  function leadStatusLabel(status) {
    const key = trim(status);
    const hit = LEAD_CHOICES.find((item) => item[0] === key);
    return hit ? hit[1] : (key || "ליד חדש");
  }

  function leadWhen(value) {
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return "";
    try {
      return new Date(ms).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (_err) {
      return "";
    }
  }

  function leadPlain(description) {
    const text = String(description || "");
    const at = text.lastIndexOf("---LEAD_META_JSON---");
    return trim(at < 0 ? text : text.slice(0, at));
  }

  function leadInquiry(description) {
    const text = leadPlain(description);
    const at = text.indexOf("---LANDING_PAYLOAD---");
    return trim(at < 0 ? text : text.slice(0, at));
  }

  function leadLanding(description) {
    const text = leadPlain(description);
    const mark = "---LANDING_PAYLOAD---";
    const at = text.indexOf(mark);
    if (at < 0) return {};
    try {
      const parsed = JSON.parse(text.slice(at + mark.length).trim());
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_err) {
      return {};
    }
  }

  function leadShowDate(value) {
    const raw = trim(value);
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return iso ? iso[3] + "." + iso[2] + "." + iso[1] : raw;
  }

  function leadWhatsApp(phone) {
    let digits = String(phone || "").replace(/\D/g, "");
    if (digits.indexOf("972") === 0) digits = digits.slice(3);
    digits = digits.replace(/^0+/, "");
    return digits ? "https://wa.me/972" + digits : "";
  }

  function leadSourceLabel(source) {
    const value = trim(source);
    const key = value.toLowerCase();
    if (key === "manual") return "ידני";
    if (key === "landing") return "דף נחיתה";
    return value;
  }

  function leadGlyph(kind) {
    const open = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">';
    if (kind === "time") return open + '<circle cx="12" cy="12" r="7.5"/><path d="M12 8v4.5l3 2"/></svg>';
    if (kind === "source") return open + '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5"/></svg>';
    return open + '<path d="M5 10.5v3.2c0 .4.2.8.6 1L16 19V5L5.6 9.5c-.4.2-.6.6-.6 1Z"/></svg>';
  }

  function leadTypeLabel(value) {
    const labels = {
      life_risk: "ריסק",
      mortgage_risk: "ריסק משכנתא",
      health_private: "בריאות",
      critical_illness: "מחלות קשות",
      cancer: "סרטן",
      health_supplement: "מחלות קשות",
      disability: "אובדן כושר עבודה"
    };
    const raw = trim(value);
    return labels[raw] || raw;
  }

  function leadDetailRows(row, meta) {
    const landing = leadLanding(row.description);
    const pick = function () {
      for (let i = 0; i < arguments.length; i += 1) {
        const value = trim(arguments[i]);
        if (value) return value;
      }
      return "";
    };
    const types = []
      .concat(Array.isArray(landing.insuranceTypeLabels) ? landing.insuranceTypeLabels : [])
      .concat(Array.isArray(landing.insuranceTypes) ? landing.insuranceTypes : [])
      .concat(Array.isArray(meta.insuranceTypeLabels) ? meta.insuranceTypeLabels : [])
      .concat(Array.isArray(meta.insuranceTypes) ? meta.insuranceTypes : [])
      .map(leadTypeLabel)
      .filter(Boolean)
      .filter((item, index, list) => list.indexOf(item) === index);
    const agents = (Array.isArray(meta.additionalAgents) ? meta.additionalAgents : [])
      .map((item) => trim(item && item.name))
      .filter(Boolean);
    const products = (Array.isArray(meta.goldProducts) ? meta.goldProducts : []).map((item) => trim(item)).filter(Boolean);
    const track = trim(meta.goldTrack) === "pension" ? "פנסיה" : (trim(meta.goldTrack) === "elementary" ? "אלמנטרי" : "");
    const clearing = trim(meta.goldClearing) === "available" ? "מסלקה זמינה" : (trim(meta.goldClearing) === "pending" ? "מסלקה ממתינה" : "");
    const avail = meta.goldAvailAllDay === true ? "כל היום" : [leadShowDate(meta.goldAvailDate), trim(meta.goldAvailTime)].filter(Boolean).join(" ");
    const month = moneyNumber(meta.proposalPremiumMonthly);
    const year = moneyNumber(meta.proposalPremiumAnnual);
    return [
      ["תאריך הנפקה", leadShowDate(pick(meta.idIssueDate, row.id_issue_date, landing.idIssueDate))],
      ["תעודת זהות", pick(meta.idNumber, row.id_number, landing.idNumber)],
      ["תאריך לידה", leadShowDate(pick(meta.birthDate, row.birth_date, landing.birthDate))],
      ["חברת ביטוח", pick(meta.insuranceCompany, landing.insuranceCompany)],
      ["סוגי ביטוח", types.join(" · ")],
      ["נציגים נוספים", agents.join(" · ")],
      ["מוצרים", products.join(" · ")],
      ["מסלול", track],
      ["מסלקה", clearing],
      ["שכר", trim(meta.goldSalary)],
      ["זמינות", avail],
      ["פרמיה חודשית", month > 0 ? String(month) : ""],
      ["פרמיה שנתית", year > 0 ? String(year) : ""],
      ["תאריך סגירה", leadWhen(meta.closedAt)]
    ].filter((item) => item[1]);
  }

  function clearLeadContact() {
    const host = $("leadBarContact");
    if (!host) return;
    host.innerHTML = "";
    host.hidden = true;
  }

  function paintLeadContact(phone) {
    const host = $("leadBarContact");
    if (!host) return;
    const dial = leadDial(phone);
    const wa = leadWhatsApp(dial);
    if (!dial) {
      clearLeadContact();
      return;
    }
    host.hidden = false;
    host.innerHTML = '<b dir="ltr">' + esc(dial) + "</b>"
      + (wa ? '<a class="leadWa" href="' + esc(wa) + '" target="_blank" rel="noopener" aria-label="וואטסאפ"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 3.2A8.2 8.2 0 0 0 5.2 15.5L4.2 20l4.6-1.2A8.2 8.2 0 1 0 12 3.2Zm4.7 11.6c-.2.54-1.12 1-1.56 1.06-.4.06-.92.08-1.5-.1-.34-.1-.78-.26-1.36-.5-2.4-1.04-3.96-3.46-4.08-3.62-.12-.16-.96-1.26-.96-2.42s.6-1.7.82-1.94c.2-.22.46-.28.62-.28h.44c.14 0 .32-.04.5.38.18.46.64 1.6.7 1.7.06.12.1.26.02.4-.08.16-.12.26-.24.4-.12.12-.24.3-.34.4-.12.12-.24.24-.1.48.14.22.6.98 1.28 1.58.88.78 1.62 1.04 1.86 1.16.24.12.36.1.5-.06.14-.16.58-.66.72-.9.16-.22.3-.18.5-.1.22.08 1.34.64 1.58.76.22.1.38.16.44.26.06.12.06.56-.14 1.1Z"/></svg></a>' : "");
  }

  function leadDial(phone) {
    return trim(phone).replace(/[^\d+]/g, "");
  }

  function leadOwns(row) {
    if (!row) return false;
    const meId = trim(state.profile && state.profile.id);
    const meName = trim(state.profile && state.profile.name);
    const meUser = trim(state.profile && state.profile.username);
    if (trim(row.assigned_agent_id) === "__ELDERLY__") return false;
    if (meId && trim(row.assigned_agent_id) === meId) return true;
    const extra = leadMeta(row.description).additionalAgents;
    const list = Array.isArray(extra) ? extra : [];
    if (meId && list.some((item) => trim(item && item.id) === meId)) return true;
    const assignedName = trim(row.assigned_agent_name);
    if (assignedName && ((meName && assignedName === meName) || (meUser && assignedName === meUser))) return true;
    return list.some((item) => {
      const name = trim(item && item.name);
      return name && ((meName && name === meName) || (meUser && name === meUser));
    });
  }

  function withLeadDay(query, dayKey) {
    if (!dayKey || dayKey === "ALL") return query.limit(120);
    const range = jerusalemBounds(dayKey);
    return query.gte("created_at", range.start).lt("created_at", range.end).limit(80);
  }

  async function loadMyLeads(dayKey) {
    const meId = trim(state.profile && state.profile.id);
    const meName = trim(state.profile && state.profile.name);
    const batches = [];
    if (meId) {
      const byId = await withLeadDay(
        sb.from("campaign_leads").select(LEAD_COLS).eq("assigned_agent_id", meId).order("created_at", { ascending: false }),
        dayKey
      );
      if (byId.error) throw new Error(byId.error.message || "leads");
      batches.push(byId.data || []);
      const extra = await withLeadDay(
        sb.from("campaign_leads").select(LEAD_COLS).ilike("description", "%" + meId + "%").order("created_at", { ascending: false }),
        dayKey
      );
      if (!extra.error) batches.push(extra.data || []);
    }
    if (meName && meName !== meId) {
      const byName = await withLeadDay(
        sb.from("campaign_leads").select(LEAD_COLS).eq("assigned_agent_name", meName).order("created_at", { ascending: false }),
        dayKey
      );
      if (byName.error) throw new Error(byName.error.message || "leads");
      batches.push(byName.data || []);
    }
    const seen = new Set();
    return batches.reduce((all, rows) => all.concat(rows), []).filter((row) => {
      const id = trim(row.id);
      if (!id || seen.has(id) || !leadOwns(row)) return false;
      if (dayKey && dayKey !== "ALL" && stampDateIL(row.created_at) !== dayKey) return false;
      seen.add(id);
      return true;
    }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }

  function paintLeadList(rows) {
    const host = $("leadList");
    if (!host) return;
    host.innerHTML = rows.length
      ? '<div class="leadList">' + rows.map((row) => {
        const name = trim(row.customer_name) || "ליד";
        const phone = leadDial(row.phone);
        const meta = [trim(row.campaign_label), leadWhen(row.created_at)].filter(Boolean).join(" · ");
        return '<button class="leadRow" type="button" data-lead="' + esc(row.id) + '"><span class="leadRow__badge" aria-hidden="true">' + esc(name.slice(0, 1)) + '</span><span class="leadRow__copy"><b>' + esc(name) + "</b>"
          + (phone ? '<span dir="ltr">' + esc(phone) + "</span>" : "")
          + (meta ? "<small>" + esc(meta) + "</small>" : "")
          + "</span><em>" + esc(leadStatusLabel(row.status)) + "</em></button>";
      }).join("") + "</div>"
      : '<div class="empty">אין לידים לתאריך זה</div>';
  }

  function leadDayButtonLabel(dayKey) {
    const day = dayKey || israelDateKey();
    if (day === israelDateKey()) return "היום";
    const parts = String(day).split("-").map(Number);
    if (parts.length < 3 || !parts[0]) return day;
    try {
      return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12)));
    } catch (_err) {
      return day;
    }
  }

  function paintLeadCalendar() {
    const host = $("leadCal");
    if (!host) return;
    const day = state.leadDay || israelDateKey();
    host.innerHTML = calendarHtml(leadMonth || day.slice(0, 7), {
      selected: day,
      dayAttr: "data-lead-day",
      monthAttr: "data-lead-month"
    });
  }

  function setLeadCal(open) {
    const pop = $("leadCalPop");
    const btn = $("btnLeadDay");
    if (pop) {
      if (open) paintLeadCalendar();
      pop.hidden = !open;
    }
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function wireLeads() {
    if (leadsWired) return;
    leadsWired = true;
    const screen = $("screenLeadsDay");
    if (!screen) return;
    screen.addEventListener("click", (event) => {
      if (event.target.closest("#btnLeadDay")) {
        const pop = $("leadCalPop");
        setLeadCal(!(pop && !pop.hidden));
        return;
      }
      const month = event.target.closest("[data-lead-month]");
      if (month) {
        leadMonth = shiftMonth(leadMonth || (state.leadDay || israelDateKey()).slice(0, 7), Number(month.getAttribute("data-lead-month")));
        paintLeadCalendar();
        return;
      }
      const day = event.target.closest("[data-lead-day]");
      if (day) {
        setLeadCal(false);
        void openLeadsDay(day.getAttribute("data-lead-day"));
        return;
      }
      const pop = $("leadCalPop");
      if (pop && !pop.hidden && !event.target.closest("#leadCalPop")) setLeadCal(false);
      const row = event.target.closest("[data-lead]");
      if (!row) return;
      void openLead(row.getAttribute("data-lead"));
    });
  }

  async function openLeadsDay(dayKey) {
    writeLeadBadgeIds(new Set());
    paintLeadBadge();
    if (dayKey && dayKey !== "ALL") state.leadDay = dayKey;
    if (!state.leadDay || state.leadDay === "ALL") state.leadDay = israelDateKey();
    leadMonth = state.leadDay.slice(0, 7);
    show("leadsDay");
    wireLeads();
    setLeadCal(false);
    const btn = $("btnLeadDay");
    if (btn) btn.textContent = leadDayButtonLabel(state.leadDay);
    const list = $("leadList");
    if (list) list.innerHTML = '<div class="empty">טוען…</div>';
    try {
      const rows = await loadMyLeads(state.leadDay);
      state.leadRows = rows;
      paintLeadList(rows);
    } catch (_err) {
      if (list) list.innerHTML = '<div class="empty">לא ניתן לטעון את הלידים</div>';
    }
  }

  function reviewCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = new Uint8Array(6);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else bytes.forEach((_value, index) => { bytes[index] = Math.floor(Math.random() * 256); });
    let code = "r";
    bytes.forEach((value) => { code += alphabet[value % alphabet.length]; });
    return code;
  }

  async function reviewCard(name) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready.catch(() => {});
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");
    const sky = ctx.createLinearGradient(0, 0, 1200, 630);
    sky.addColorStop(0, "#1E5AA3");
    sky.addColorStop(0.46, "#17457E");
    sky.addColorStop(1, "#12345F");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1200, 630);
    ctx.fillStyle = "#F5F8FF";
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.font = "700 92px Heebo, Arial, sans-serif";
    ctx.fillText("שלום", 1080, 280);
    ctx.font = "500 54px Heebo, Arial, sans-serif";
    ctx.fillText(trim(name) || "לקוח", 1080, 380);
    return canvas.toDataURL("image/jpeg", 0.86);
  }

  async function syncReviewPhone(row) {
    const phoneKey = reviewPhoneKey(row && row.phone);
    const leadId = trim(row && row.id);
    if (!phoneKey || !leadId) return;
    const found = await sb.from("onyx_review_links").select("code,id_number").eq("lead_id", leadId).maybeSingle();
    if (found.error || !found.data || trim(found.data.id_number) === phoneKey) return;
    await sb.from("onyx_review_links").update({
      id_number: phoneKey,
      updated_at: new Date().toISOString()
    }).eq("code", found.data.code);
  }

  function reviewPhoneKey(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.indexOf("972") === 0) digits = digits.slice(3);
    digits = digits.replace(/^0+/, "");
    return digits;
  }

  async function ensureReview(row) {
    const leadId = trim(row && row.id);
    if (!leadId) throw new Error("lead");
    const found = await sb.from("onyx_review_links").select("code,customer_name,id_number").eq("lead_id", leadId).maybeSingle();
    if (found.error) throw new Error(found.error.message || "review");
    const phoneKey = reviewPhoneKey(row.phone);
    const name = trim(row.customer_name) || "לקוח";
    if (found.data && found.data.code) {
      const patch = { updated_at: new Date().toISOString() };
      if (name && name !== trim(found.data.customer_name)) {
        patch.customer_name = name;
        try { patch.og_jpeg = await reviewCard(name); } catch (_err) {}
      }
      if (phoneKey && phoneKey !== trim(found.data.id_number)) patch.id_number = phoneKey;
      if (Object.keys(patch).length > 1) await sb.from("onyx_review_links").update(patch).eq("code", found.data.code);
      return found.data.code;
    }
    const code = reviewCode();
    let jpeg = "";
    try { jpeg = await reviewCard(name); } catch (_err) { jpeg = ""; }
    const inserted = await sb.from("onyx_review_links").insert({
      code: code,
      lead_id: leadId,
      agent_id: trim(state.profile && state.profile.id),
      customer_name: name,
      id_number: phoneKey,
      stage: "intro",
      snapshot: {},
      og_jpeg: jpeg,
      open_href: REVIEW_PAGE + encodeURIComponent(code),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    if (!inserted.error) return code;
    const again = await sb.from("onyx_review_links").select("code").eq("lead_id", leadId).maybeSingle();
    if (again.data && again.data.code) return again.data.code;
    throw new Error(inserted.error.message || "review");
  }

  function copyPlain(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    if (!ok) throw new Error("copy");
  }

  function copyReviewLink(row, button) {
    const label = "העתק לינק ללקוח";
    const textPromise = ensureReview(row).then((code) => {
      return "קיבלת לינק לצפייה במעקב בדיקת תיק הביטוח שלך. לחץ לפתיחה.\n" + REVIEW_SHARE + code;
    });
    const pending = navigator.clipboard && navigator.clipboard.write && window.ClipboardItem
      ? navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": textPromise.then((text) => new Blob([text], { type: "text/plain" }))
          })
        ]).catch(() => textPromise.then((text) => copyPlain(text)))
      : textPromise.then((text) => copyPlain(text));
    pending.then(() => {
      button.textContent = "הלינק הועתק";
      window.setTimeout(() => { button.textContent = label; }, 1600);
    }).catch(() => {
      button.textContent = "לא ניתן להכין את הלינק";
      window.setTimeout(() => { button.textContent = label; }, 2200);
    });
  }

  function leadDescriptionWith(description, meta) {
    const plain = leadPlain(description);
    const clean = {};
    Object.keys(meta || {}).forEach((key) => {
      const value = meta[key];
      if (value == null || value === "") return;
      if (Array.isArray(value) && !value.length) return;
      clean[key] = value;
    });
    if (!Object.keys(clean).length) return plain;
    return (plain ? plain + "\n" : "") + "---LEAD_META_JSON---\n" + JSON.stringify(clean);
  }

  function paintOpenLead() {
    const row = openLeadRow;
    if (!row) return;
    const phone = leadDial(row.phone);
    const inquiry = leadInquiry(row.description);
    const meta = leadMeta(row.description);
    const title = $("leadTitle");
    if (title) title.textContent = trim(row.customer_name) || "ליד";
    paintLeadContact(phone);
    const side = [
      trim(row.campaign_label) ? '<p class="leadSide__row">' + leadGlyph("campaign") + "<span>" + esc(trim(row.campaign_label)) + "</span></p>" : "",
      leadWhen(row.created_at) ? '<p class="leadSide__row">' + leadGlyph("time") + "<span>" + esc(leadWhen(row.created_at)) + "</span></p>" : "",
      trim(row.source) ? '<p class="leadSide__row">' + leadGlyph("source") + "<span>" + esc(leadSourceLabel(row.source)) + "</span></p>" : ""
    ].filter(Boolean).join("");
    const choices = LEAD_CHOICES.map((item) => {
      const on = trim(row.status) === item[0] ? " is-on" : "";
      return '<button type="button" data-lead-status="' + item[0] + '" class="' + on + '">' + esc(item[1]) + "</button>";
    }).join("");
    const blocks = [];
    if (trim(meta.closedNote)) blocks.push('<div class="leadNoteBox"><h3>תיעוד מכירה</h3><p>' + esc(meta.closedNote) + "</p></div>");
    if (trim(meta.irrelevantNote)) blocks.push('<div class="leadNoteBox"><h3>תיעוד נציג</h3><p>' + esc(meta.irrelevantNote) + "</p></div>");
    if (trim(meta.callNote)) blocks.push('<div class="leadNoteBox"><h3>תיעוד שיחה</h3><p>' + esc(meta.callNote) + "</p></div>");
    const details = leadDetailRows(row, meta).map((item) => {
      const ltr = /[\d]/.test(item[1]) && !/[א-ת]/.test(item[1]);
      return '<div><dt>' + esc(item[0]) + "</dt><dd" + (ltr ? ' dir="ltr"' : "") + ">" + esc(item[1]) + "</dd></div>";
    }).join("");
    const draftLabel = leadDraft === "closed" ? "תיעוד מכירה" : "תיעוד נציג";
    const draftHint = leadDraft === "closed" ? "פרט את המוצרים שנמכרו, חברות ופרמיות." : "יש לתעד סיכום שיחה עם הלקוח.";
    const draft = leadDraft
      ? '<div class="leadDraft"><h3>' + draftLabel + "</h3><p class=\"leadQuiet\">" + draftHint + "</p>"
        + '<textarea class="input" id="leadNoteText" placeholder="' + draftLabel + '"></textarea>'
        + '<div class="leadActions"><button class="ghost" id="leadNoteCancel" type="button">ביטול</button><button class="leadBtn" id="leadNoteSave" type="button">שמירה</button></div></div>'
      : "";
    $("leadBody").innerHTML = '<article class="leadCard">'
      + (side ? '<div class="leadSide">' + side + "</div>" : "")
      + '<div class="leadBlock"><h3>סטטוס</h3><div class="leadStatus">'
      + '<button class="leadStatus__btn" id="leadStatusBtn" type="button" aria-expanded="false" aria-haspopup="listbox"><span>' + esc(leadStatusLabel(row.status)) + '</span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>'
      + '<div class="leadStatus__menu" id="leadStatusMenu" hidden role="listbox">' + choices + "</div>"
      + draft
      + "</div></div>"
      + (inquiry ? '<p class="leadInquiry">' + esc(inquiry) + "</p>" : "")
      + (details ? '<dl class="leadFacts">' + details + "</dl>" : "")
      + '<div class="leadBlock"><h3>תיעוד</h3>' + (blocks.length ? blocks.join("") : '<p class="leadQuiet">אין תיעוד</p>')
      + '<label class="field" for="leadCallText">תיעוד שיחה</label>'
      + '<textarea class="input" id="leadCallText">' + esc(trim(meta.callNote)) + "</textarea>"
      + '<button class="leadBtn" id="leadCallSave" type="button">שמירת תיעוד שיחה</button></div>'
      + '<p class="leadSaved' + (leadNoticeErr ? " is-err" : "") + '" id="leadSaved">' + esc(leadNotice) + "</p>"
      + "</article>"
      + (phone ? '<a class="leadBtn" href="tel:' + esc(phone) + '">חייג</a>' : "")
      + '<button class="leadBtn" id="btnCopyReview" type="button">העתק לינק ללקוח</button>';
  }

  async function saveLead(patch) {
    const row = openLeadRow;
    if (!row) return;
    const meta = leadMeta(row.description);
    const stamp = new Date().toISOString();
    if (Object.prototype.hasOwnProperty.call(patch, "callNote")) {
      if (trim(patch.callNote)) meta.callNote = trim(patch.callNote);
      else delete meta.callNote;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "irrelevantNote")) {
      if (trim(patch.irrelevantNote)) meta.irrelevantNote = trim(patch.irrelevantNote);
      else delete meta.irrelevantNote;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "closedNote")) {
      if (trim(patch.closedNote)) meta.closedNote = trim(patch.closedNote);
      else delete meta.closedNote;
    }
    if (patch.status === "closed") meta.closedAt = stamp;
    meta.lastModifiedAt = stamp;
    const description = leadDescriptionWith(row.description, meta);
    const update = { description: description, updated_at: stamp };
    if (patch.status) update.status = patch.status;
    const res = await sb.from("campaign_leads").update(update).eq("id", row.id);
    if (res.error) throw new Error(res.error.message || "lead");
    row.description = description;
    if (patch.status) row.status = patch.status;
    const listed = (state.leadRows || []).find((item) => trim(item.id) === trim(row.id));
    if (listed && listed !== row) {
      listed.description = description;
      if (patch.status) listed.status = patch.status;
    }
  }

  function wireLead() {
    if (leadWired) return;
    leadWired = true;
    $("leadBody").addEventListener("click", (event) => {
      const row = openLeadRow;
      if (!row) return;
      const menu = $("leadStatusMenu");
      const opener = $("leadStatusBtn");
      if (menu && !menu.hidden && !event.target.closest(".leadStatus")) {
        menu.hidden = true;
        if (opener) opener.setAttribute("aria-expanded", "false");
      }
      if (event.target.closest("#leadStatusBtn")) {
        if (!menu || !opener) return;
        const open = menu.hidden;
        menu.hidden = !open;
        opener.setAttribute("aria-expanded", open ? "true" : "false");
        return;
      }
      const statusBtn = event.target.closest("[data-lead-status]");
      if (statusBtn) {
        const next = statusBtn.getAttribute("data-lead-status");
        if (!next || next === trim(row.status)) {
          leadDraft = "";
          paintOpenLead();
          return;
        }
        if (next === "closed" || next === "irrelevant") {
          leadDraft = next;
          leadNotice = "";
          paintOpenLead();
          return;
        }
        leadDraft = "";
        void saveLead({ status: next }).then(() => {
          leadNotice = "הסטטוס עודכן";
          leadNoticeErr = false;
          paintOpenLead();
        }).catch(() => {
          leadNotice = "לא ניתן לעדכן את הליד";
          leadNoticeErr = true;
          paintOpenLead();
        });
        return;
      }
      if (event.target.closest("#leadNoteCancel")) {
        leadDraft = "";
        leadNotice = "";
        paintOpenLead();
        return;
      }
      if (event.target.closest("#leadNoteSave")) {
        const note = trim($("leadNoteText") && $("leadNoteText").value);
        if (!note) {
          leadNotice = leadDraft === "closed" ? "חובה לתעד מה נמכר ללקוח" : "חובה לתעד סיכום שיחה";
          leadNoticeErr = true;
          const saved = $("leadSaved");
          if (saved) {
            saved.textContent = leadNotice;
            saved.classList.toggle("is-err", true);
          }
          return;
        }
        const status = leadDraft;
        const patch = { status: status };
        if (status === "closed") patch.closedNote = note;
        else patch.irrelevantNote = note;
        void saveLead(patch).then(() => {
          leadDraft = "";
          leadNotice = "הסטטוס עודכן";
          leadNoticeErr = false;
          paintOpenLead();
        }).catch(() => {
          leadNotice = "לא ניתן לעדכן את הליד";
          leadNoticeErr = true;
          paintOpenLead();
        });
        return;
      }
      if (event.target.closest("#leadCallSave")) {
        const note = trim($("leadCallText") && $("leadCallText").value);
        void saveLead({ callNote: note }).then(() => {
          leadNotice = "תיעוד השיחה נשמר";
          leadNoticeErr = false;
          paintOpenLead();
        }).catch(() => {
          leadNotice = "לא ניתן לשמור את תיעוד השיחה";
          leadNoticeErr = true;
          paintOpenLead();
        });
        return;
      }
      if (event.target.closest("#btnCopyReview")) copyReviewLink(row, event.target.closest("#btnCopyReview"));
    });
  }

  async function openLead(id) {
    const wanted = trim(id);
    state.reviewLeadId = wanted;
    leadDraft = "";
    leadNotice = "";
    leadNoticeErr = false;
    clearLeadContact();
    if ($("leadTitle")) $("leadTitle").textContent = "ליד";
    show("lead");
    wireLead();
    $("leadBody").innerHTML = '<div class="empty">טוען…</div>';
    try {
      let row = (state.leadRows || []).find((item) => trim(item.id) === wanted);
      if (!row) {
        const res = await sb.from("campaign_leads").select(LEAD_COLS).eq("id", wanted).maybeSingle();
        if (res.error) throw new Error(res.error.message || "lead");
        row = res.data;
      }
      if (!row || !leadOwns(row)) {
        openLeadRow = null;
        $("leadBody").innerHTML = '<div class="empty">הליד לא נמצא</div>';
        return;
      }
      openLeadRow = row;
      paintOpenLead();
      void syncReviewPhone(row);
    } catch (_err) {
      openLeadRow = null;
      $("leadBody").innerHTML = '<div class="empty">לא ניתן לטעון את הליד</div>';
    }
  }

  function reviewStageName(leftId) {
    if (leftId === "ready") return "ready";
    if (leftId === 1) return "checking";
    if (leftId === 3) return "existing";
    if (leftId === 5) return "offered";
    if (leftId === 6) return "health";
    return "";
  }

  function reviewSnapshot() {
    let existingTotal = 0;
    const kept = [];
    (offer.insureds || []).forEach((ins) => {
      const data = ins.data || {};
      (data.existingPolicies || []).forEach((policy) => {
        const premium = moneyNumber(policy.monthlyPremium);
        existingTotal = Math.round((existingTotal + premium) * 100) / 100;
        const cancel = data.cancellations && data.cancellations[policy.id];
        const status = cancel && cancel.status;
        if (status === "full" || status === "partial_health") return;
        kept.push({
          company: trim(policy.company),
          type: trim(policy.type),
          number: trim(policy.policyNumber),
          premium: premium
        });
      });
    });
    const policies = (offer.policies || []).map((policy) => ({
      company: trim(policy.company),
      type: trim(policy.type),
      premium: moneyNumber(policy.premiumMonthly)
    }));
    const newTotal = policies.reduce((sum, policy) => Math.round((sum + policy.premium) * 100) / 100, 0);
    return { existingTotal: existingTotal, newTotal: newTotal, policies: policies, kept: kept };
  }

  async function reviewMatch(idNumber, phone) {
    const cols = "code,lead_id,stage,id_number,customer_name";
    if (state.reviewLeadId) {
      const res = await sb.from("onyx_review_links").select(cols).eq("lead_id", state.reviewLeadId).maybeSingle();
      if (!res.error && res.data) return res.data;
    }
    const phoneKey = reviewPhoneKey(phone);
    if (phoneKey) {
      const byPhone = await sb.from("onyx_review_links").select(cols).eq("id_number", phoneKey).order("updated_at", { ascending: false }).limit(1);
      if (!byPhone.error && byPhone.data && byPhone.data[0]) return byPhone.data[0];
    }
    if (idNumber) {
      const byId = await sb.from("onyx_review_links").select(cols).eq("id_number", idNumber).order("updated_at", { ascending: false }).limit(1);
      if (!byId.error && byId.data && byId.data[0]) return byId.data[0];
    }
    if (!phone) return null;
    const found = await sb.from("campaign_leads").select(LEAD_COLS).eq("phone", phone).order("created_at", { ascending: false }).limit(8);
    const mine = (found.data || []).find((item) => leadOwns(item));
    if (!mine) return null;
    const linked = await sb.from("onyx_review_links").select(cols).eq("lead_id", mine.id).maybeSingle();
    if (linked.error || !linked.data) return null;
    return linked.data;
  }

  async function publishReview(leftId) {
    try {
      if (!offer) return;
      const stage = reviewStageName(leftId);
      if (!stage) return;
      const primary = (offer.insureds[0] && offer.insureds[0].data) || {};
      const idNumber = offerDigits(primary.idNumber);
      const name = trim((primary.firstName || "") + " " + (primary.lastName || ""));
      const row = await reviewMatch(idNumber, trim(primary.phone));
      if (!row || !row.code) return;
      const patch = { updated_at: new Date().toISOString() };
      if ((REVIEW_RANK[stage] || 0) >= (REVIEW_RANK[row.stage] || 0)) {
        patch.stage = stage;
        patch.snapshot = reviewSnapshot();
      }
      const phoneKey = reviewPhoneKey(primary.phone);
      if (phoneKey) patch.id_number = phoneKey;
      if (name && name !== trim(row.customer_name)) {
        patch.customer_name = name;
        try { patch.og_jpeg = await reviewCard(name); } catch (_err) {}
      }
      if (Object.keys(patch).length < 2) return;
      await sb.from("onyx_review_links").update(patch).eq("code", row.code);
    } catch (_err) {}
  }

  function canCompose() {
    const role = state.profile && state.profile.role;
    return role === "admin" || role === "manager";
  }

  function noticeStatus(message, isErr) {
    const el = $("noticeStatus");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("is-err", !!isErr);
  }

  function paintNotice() {
    if (!canCompose()) {
      $("noticeBody").innerHTML = '<p class="noticeStatus is-err">אין הרשאה לשלוח הודעת מערכת</p>';
      return;
    }
    $("noticeBody").innerHTML = '<label class="field" for="noticeInput">הודעת מערכת</label>'
      + '<textarea class="input noticeInput" id="noticeInput" maxlength="2000" placeholder="כתוב הודעה לכל המשתמשים"></textarea>'
      + '<p class="noticeStatus" id="noticeStatus" role="status"></p>'
      + '<button class="primary" id="noticeSend" type="button">שלח</button>';
    $("noticeSend").addEventListener("click", () => { void sendNotice(); });
  }

  function openNotice() {
    show("notice");
    paintNotice();
  }

  async function sendNotice() {
    if (state.noticeSending) return;
    if (!canCompose()) {
      paintNotice();
      return;
    }
    const body = trim($("noticeInput") && $("noticeInput").value);
    if (!body) {
      noticeStatus("יש לכתוב הודעה", true);
      return;
    }
    if (body.length > 2000) {
      noticeStatus("ההודעה ארוכה מדי", true);
      return;
    }
    const profile = state.profile || {};
    const row = {
      id: "sn_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      body: body,
      author_id: trim(profile.id),
      author_name: trim(profile.name) || "מערכת",
      created_at: new Date().toISOString()
    };
    state.noticeSending = true;
    const button = $("noticeSend");
    setBusy(button, true);
    if (button) button.textContent = "שולח...";
    noticeStatus("שולח לכל המשתמשים...", false);
    try {
      const res = await sb.from("gi_system_notices").insert(row);
      if (res.error) throw new Error(res.error.message || "notice");
      try {
        const channel = sb.channel("gi-system-notice");
        await new Promise((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            resolve();
          };
          const timer = window.setTimeout(finish, 1500);
          channel.subscribe((status) => {
            if (status !== "SUBSCRIBED") return;
            Promise.resolve(channel.send({ type: "broadcast", event: "notice", payload: row })).finally(() => {
              window.clearTimeout(timer);
              finish();
            });
          });
        });
        sb.removeChannel(channel);
      } catch (_broadcast) {}
      if ($("noticeInput")) $("noticeInput").value = "";
      noticeStatus("נשלח לכל המשתמשים", false);
    } catch (err) {
      const message = trim(err && err.message);
      noticeStatus(message === "NO_CONNECTION" ? "אין חיבור לשרת" : "שגיאה בשליחה: " + (message || "לא ידוע"), true);
    } finally {
      state.noticeSending = false;
      setBusy(button, false);
      if (button) button.textContent = "שלח";
    }
  }

  const REMINDER_LABELS = { callback: "חזרה ללקוח", documents: "מעקב מסמכים", missing: "השלמת חוסרים", meeting: "פגישה", task: "משימה" };

  function isMeeting(row) {
    const id = String(row && row.id || "");
    return id.indexOf("meet_") === 0 || trim(row && row.type) === "meeting";
  }

  function reminderTitle(row) {
    if (isMeeting(row)) return "פגישה";
    return REMINDER_LABELS[row && row.type] || "תזכורת";
  }

  function alertSeenKey() {
    return "onyx-phone-alerts:" + trim(state.profile && state.profile.id);
  }

  function readAlertSeen() {
    const seen = new Set();
    [alertSeenKey(), "onyx-phone-alerts:device"].forEach((key) => {
      try {
        const raw = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(raw)) raw.forEach((id) => { if (id) seen.add(String(id)); });
      } catch (_err) {}
    });
    return seen;
  }

  function writeAlertSeen(seen) {
    const list = JSON.stringify(Array.from(seen).slice(-200));
    try { localStorage.setItem(alertSeenKey(), list); } catch (_err) {}
    try { localStorage.setItem("onyx-phone-alerts:device", list); } catch (_err) {}
  }

  function alertAlreadySeen(seen, id) {
    const key = String(id || "");
    if (!key || seen.has(key)) return true;
    if (key.indexOf("closed:") !== 0) return false;
    const leadId = key.split(":")[1];
    if (!leadId) return false;
    const prefix = "closed:" + leadId + ":";
    for (const old of seen) {
      if (String(old).indexOf(prefix) === 0) return true;
    }
    return false;
  }

  function rememberAlertIds(ids) {
    const list = (ids || []).map((id) => String(id || "")).filter(Boolean);
    if (!list.length || typeof indexedDB === "undefined") return Promise.resolve();
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open("onyx-phone-seen", 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains("ids")) req.result.createObjectStore("ids");
        };
        req.onerror = () => resolve();
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("ids", "readwrite");
          const store = tx.objectStore("ids");
          list.forEach((id) => store.put(Date.now(), id));
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); resolve(); };
        };
      } catch (_err) { resolve(); }
    });
  }

  function alertPremiumText(item) {
    const bits = [];
    if (item.monthly > 0) bits.push(money(item.monthly) + " · בריאות וסיכונים");
    if (item.annual > 0) bits.push(money(item.annual) + " · אלמנטרי");
    return bits.join(" · ");
  }

  function buildAlertItems(rows) {
    const day = israelDateKey();
    const items = [];
    (rows || []).forEach((row) => {
      const meta = leadMeta(row.description);
      const agent = trim(row.assigned_agent_name) || "נציג";
      const customer = trim(row.customer_name);
      const monthly = moneyNumber(meta.proposalPremiumMonthly);
      const annual = moneyNumber(meta.proposalPremiumAnnual);
      if (stampDateIL(meta.proposalPremiumAt) === day && (monthly > 0 || annual > 0)) {
        items.push({
          id: "sale:" + row.id + ":" + trim(meta.proposalPremiumAt),
          title: "מכירה באשף בריאות וסיכונים",
          agent: agent,
          customer: customer,
          monthly: monthly,
          annual: annual,
          at: trim(meta.proposalPremiumAt)
        });
      }
      if (trim(row.status) === "closed" && stampDateIL(meta.closedAt || row.updated_at) === day) {
        items.push({
          id: "closed:" + row.id + ":" + day,
          title: "ליד נסגר",
          agent: agent,
          customer: customer,
          monthly: 0,
          annual: 0,
          note: trim(meta.closedNote),
          at: trim(meta.closedAt) || trim(row.updated_at)
        });
      }
    });
    items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return items;
  }

  function policyMonthly(policy) {
    if (!policy || String(policy.origin || "") === "existing") return 0;
    const after = Number(policy.premiumAfterDiscountValue);
    if (after > 0) return after;
    const raw = String(policy.premiumMonthly || "").replace(/[^\d.]/g, "");
    const amount = Number(raw);
    return amount > 0 ? amount : 0;
  }

  function policyLists(payload) {
    const lists = [];
    if (payload && Array.isArray(payload.newPolicies)) lists.push(payload.newPolicies);
    if (payload && payload.operational && Array.isArray(payload.operational.newPolicies)) lists.push(payload.operational.newPolicies);
    return lists;
  }

  function policySales(rows, day) {
    const items = [];
    (rows || []).forEach((row) => {
      const seen = new Set();
      let monthly = 0;
      let at = "";
      policyLists(row.payload).forEach((list) => {
        list.forEach((policy) => {
          const id = trim(policy && policy.id);
          if (id && seen.has(id)) return;
          if (stampDateIL(policy && policy._addedAt) !== day) return;
          const amount = policyMonthly(policy);
          if (!(amount > 0)) return;
          if (id) seen.add(id);
          monthly += amount;
          const stamp = trim(policy && policy._addedAt);
          if (!at || stamp > at) at = stamp;
        });
      });
      monthly = Math.round(monthly * 100) / 100;
      if (!(monthly > 0)) return;
      items.push({
        id: "sale:cust:" + trim(row.id) + ":" + day,
        title: "מכירה באשף בריאות וסיכונים",
        agent: trim(row.agent_name) || "נציג",
        customer: trim(row.full_name),
        monthly: monthly,
        annual: 0,
        at: at
      });
    });
    return items;
  }

  function mergePolicySales(items, rows, day) {
    const names = new Set();
    (items || []).forEach((item) => {
      if (!item || String(item.id).indexOf("sale:") !== 0 || String(item.id).indexOf("sale:cust:") === 0) return;
      names.add(trim(item.customer));
    });
    policySales(rows, day).forEach((item) => {
      if (names.has(trim(item.customer))) return;
      items.push(item);
    });
    items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return items;
  }

  async function loadAlertRows() {
    if (!canCompose()) return [];
    const range = israelRange();
    const today = israelDateKey();
    const yesterday = shiftDay(today, -1);
    const select = "id,customer_name,assigned_agent_name,status,description,updated_at";
    const touched = await sb.from("campaign_leads")
      .select(select)
      .gte("updated_at", range.start)
      .lt("updated_at", range.end)
      .or("status.eq.closed,description.ilike.%proposalPremiumAt%")
      .order("updated_at", { ascending: false })
      .limit(80);
    if (touched.error) throw new Error(touched.error.message || "alerts");
    const stamped = await sb.from("campaign_leads")
      .select(select)
      .or('description.ilike.%proposalPremiumAt%' + today + '%,description.ilike.%proposalPremiumAt%' + yesterday + '%')
      .order("updated_at", { ascending: false })
      .limit(80);
    const stampedRows = stamped.error ? [] : (stamped.data || []);
    const byId = new Map();
    (touched.data || []).concat(stampedRows).forEach((row) => {
      if (row && row.id) byId.set(row.id, row);
    });
    const items = buildAlertItems(Array.from(byId.values()));
    try {
      const customers = await sb.from("customers")
        .select("id,full_name,agent_name,payload")
        .gte("updated_at", range.start)
        .lt("updated_at", range.end)
        .gt("new_policies_count", 0)
        .order("updated_at", { ascending: false })
        .limit(40);
      if (!customers.error) mergePolicySales(items, customers.data || [], today);
    } catch (_err) {}
    return items;
  }

  function alertOpenedKey() {
    return "onyx-phone-alerts-open:" + trim(state.profile && state.profile.id);
  }

  function readAlertOpened() {
    const opened = new Set();
    [alertOpenedKey(), "onyx-phone-alerts-open:device"].forEach((key) => {
      try {
        const raw = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(raw)) raw.forEach((id) => { if (id) opened.add(String(id)); });
      } catch (_err) {}
    });
    return opened;
  }

  function writeAlertOpened(opened) {
    const list = JSON.stringify(Array.from(opened).slice(-200));
    try { localStorage.setItem(alertOpenedKey(), list); } catch (_err) {}
    try { localStorage.setItem("onyx-phone-alerts-open:device", list); } catch (_err) {}
  }

  function unseenAlerts(items) {
    const opened = readAlertOpened();
    return (items || []).filter((item) => item && item.id && !opened.has(String(item.id)));
  }

  function paintBell(items) {
    const bell = $("btnBell");
    if (bell) bell.classList.toggle("is-hot", canCompose() && unseenAlerts(items).length > 0);
  }

  function markAlertsSeen(items) {
    const seen = readAlertSeen();
    const opened = readAlertOpened();
    (items || []).forEach((item) => {
      if (!item || !item.id) return;
      seen.add(item.id);
      opened.add(String(item.id));
    });
    writeAlertSeen(seen);
    writeAlertOpened(opened);
    void rememberAlertIds((items || []).map((item) => item.id));
  }

  let alertPollRunning = false;
  let alertPollAgain = false;

  async function pollAlerts() {
    if (!state.profile || !canCompose()) return;
    if (alertPollRunning) {
      alertPollAgain = true;
      return;
    }
    alertPollRunning = true;
    try {
      do {
        alertPollAgain = false;
        let items = [];
        try { items = await loadAlertRows(); } catch (_err) { items = null; }
        if (!items) continue;
        state.alerts = items;
        void armSaleWatch();
        const seen = readAlertSeen();
        const fresh = items.filter((item) => !alertAlreadySeen(seen, item.id));
        if (fresh.length && document.visibilityState === "visible") {
          const sales = fresh.filter((item) => String(item.id).indexOf("sale:") === 0);
          const closed = fresh.filter((item) => String(item.id).indexOf("closed:") === 0);
          const busy = (kind) => ringQueue.some((item) => item.kind === kind) || (state.ringItem && state.ringItem.kind === kind);
          if (sales.length && !busy("sale")) {
            const first = sales[0];
            pushRing({
              kind: "sale",
              ids: sales.map((item) => item.id),
              tag: "onyx-sale-" + first.id,
              kicker: "מכירה חדשה",
              title: first.agent,
              text: alertPremiumText(first),
              meta: [first.title, trim(first.customer)].filter(Boolean).join(" · ")
            });
          }
          if (closed.length && !busy("closed")) {
            const first = closed[0];
            const note = trim(first.note);
            pushRing({
              kind: "closed",
              ids: closed.map((item) => item.id),
              tag: "onyx-closed-" + first.id,
              kicker: "ליד נסגר",
              title: first.agent,
              text: [trim(first.customer), note.length > 1 ? note : ""].filter(Boolean).join(" · "),
              meta: ""
            });
          }
        }
    const screen = document.querySelector('[data-screen="alerts"]');
    if (screen && !screen.hidden) {
      markAlertsSeen(items);
      paintAlerts(items);
    }
    paintBell(items);
    const home = document.querySelector('[data-screen="home"]');
    if (home && !home.hidden) paintHomeSide();
  } while (alertPollAgain);
    } finally {
      alertPollRunning = false;
    }
  }

  function stopSaleWatch() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.active) reg.active.postMessage({ type: "watch-stop" });
    }).catch(() => {});
  }

  async function armSaleWatch() {
    if (!canCompose() || !("serviceWorker" in navigator)) return;
    let token = "";
    try {
      const session = await sb.auth.getSession();
      token = session && session.data && session.data.session && session.data.session.access_token || "";
    } catch (_err) { token = ""; }
    if (!token) return;
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) return;
    reg.active.postMessage({
      type: "watch",
      url: SUPABASE_URL,
      key: SUPABASE_KEY,
      token: token,
      seen: Array.from(readAlertSeen()),
      until: Date.now() + 6 * 60 * 60 * 1000
    });
  }

  function readAssigned() {
    try {
      const parsed = JSON.parse(localStorage.getItem("onyx-phone-assign") || "null");
      if (!parsed || parsed.primed !== true) return null;
      return new Set((Array.isArray(parsed.ids) ? parsed.ids : []).map((id) => String(id)));
    } catch (_err) {
      return null;
    }
  }

  function writeAssigned(ids) {
    try {
      localStorage.setItem("onyx-phone-assign", JSON.stringify({ primed: true, ids: Array.from(ids).slice(-200) }));
    } catch (_err) {}
  }

  function readLeadBadgeIds() {
    try {
      const parsed = JSON.parse(localStorage.getItem("onyx-phone-lead-badge") || "null");
      if (!parsed || parsed.primed !== true) return null;
      return new Set((Array.isArray(parsed.ids) ? parsed.ids : []).map((id) => String(id)).filter(Boolean));
    } catch (_err) {
      return null;
    }
  }

  function writeLeadBadgeIds(ids) {
    try {
      localStorage.setItem("onyx-phone-lead-badge", JSON.stringify({
        primed: true,
        ids: Array.from(ids).filter(Boolean).slice(-80)
      }));
    } catch (_err) {}
  }

  function leadBadgeNote(id, screenOpen) {
    let ids = readLeadBadgeIds();
    if (!ids) ids = new Set();
    if (!screenOpen && id && !ids.has(id)) ids.add(String(id));
    writeLeadBadgeIds(ids);
    return ids;
  }

  function paintLeadBadge() {
    const badge = $("leadTabBadge");
    const tab = document.querySelector('.tab[data-tab="leads"]');
    const ids = readLeadBadgeIds();
    const count = ids ? ids.size : 0;
    if (badge) {
      badge.hidden = count < 1;
      badge.textContent = count > 99 ? "99+" : String(count);
    }
    if (tab) tab.classList.toggle("has-badge", count > 0);
  }

  async function pollAssignedLeads() {
    const meId = trim(state.profile && state.profile.id);
    if (!meId) return;
    const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    const res = await sb.from("campaign_leads")
      .select("id,customer_name,assigned_agent_id,updated_at")
      .eq("assigned_agent_id", meId)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (res.error) return;
    const rows = res.data || [];
    const seen = readAssigned();
    if (!seen) {
      writeAssigned(rows.map((row) => trim(row.id)).filter(Boolean));
      if (!readLeadBadgeIds()) writeLeadBadgeIds(new Set());
      paintLeadBadge();
      return;
    }
    let changed = false;
    const leadsOpen = !!($("screenLeadsDay") && !$("screenLeadsDay").hidden);
    rows.forEach((row) => {
      const id = trim(row.id);
      if (!id || seen.has(id)) return;
      seen.add(id);
      changed = true;
      leadBadgeNote(id, leadsOpen);
      paintLeadBadge();
      if (ringQueue.some((item) => item.leadId === id) || (state.ringItem && state.ringItem.leadId === id)) return;
      pushRing({
        kind: "lead",
        id: "lead:" + id,
        leadId: id,
        tag: "onyx-lead-" + id,
        kicker: "ליד חדש",
        title: "שויך לך ליד",
        text: trim(row.customer_name) || "ליד",
        meta: ""
      });
    });
    if (changed) writeAssigned(seen);
  }

  function startAlertPoll() {
    if (state.alertTimer) return;
    askNotify();
    paintLeadBadge();
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
    void enablePush(false).then(() => checkReminders());
    void pollAlerts();
    void pollAssignedLeads();
    state.alertTimer = window.setInterval(() => {
      const hello = $("homeHello");
      if (hello) hello.textContent = homeHelloLine();
      if (!pushReady) void enablePush(false);
      void pollAlerts();
      void checkReminders();
      void pollAssignedLeads();
    }, 20000);
  }

  function reminderWhen(value) {
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return "";
    try {
      return new Date(ms).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (_err) {
      return "";
    }
  }

  async function loadMyReminders() {
    const name = trim(state.profile && state.profile.name);
    if (!name) return [];
    let res = await sb.from("reminders")
      .select("id,type,details,remind_at,customer_name,is_done,snoozed_until")
      .eq("agent_id", name)
      .eq("is_done", false)
      .order("remind_at", { ascending: true })
      .limit(40);
    if (res.error && /snoozed_until/i.test(res.error.message || "")) {
      res = await sb.from("reminders")
        .select("id,type,details,remind_at,customer_name,is_done")
        .eq("agent_id", name)
        .eq("is_done", false)
        .order("remind_at", { ascending: true })
        .limit(40);
    }
    if (res.error) throw new Error(res.error.message || "reminders");
    return res.data || [];
  }

  function paintAlerts(items) {
    const rows = Array.isArray(items) ? items : [];
    const list = rows.length
      ? '<div class="alertList">' + rows.map((item) => {
        const closed = String(item.id).indexOf("closed:") === 0;
        const note = trim(item.note);
        if (closed) {
          return '<article class="alertCard"><b>' + esc(item.agent) + "</b><strong>" + esc(item.title) + "</strong>"
            + (item.customer ? "<span>" + esc(item.customer) + "</span>" : "")
            + (note.length > 1 ? "<span>" + esc(note) + "</span>" : "")
            + "</article>";
        }
        return '<article class="alertCard"><b>' + esc(item.agent) + "</b><strong>" + esc(alertPremiumText(item)) + "</strong><span>" + esc(item.title) + "</span>"
          + (item.customer ? "<span>" + esc(item.customer) + "</span>" : "")
          + "</article>";
      }).join("") + "</div>"
      : '<div class="empty">אין התראות היום</div>';
    $("alertsBody").innerHTML = canCompose() ? list : '<div class="empty">אין התראות היום</div>';
  }

  async function openAlerts() {
    show("alerts");
    $("alertsBody").innerHTML = '<div class="empty">טוען…</div>';
    try {
      const items = canCompose() ? await loadAlertRows() : [];
      state.alerts = items;
      markAlertsSeen(items);
      paintBell(items);
      paintAlerts(items);
    } catch (_err) {
      $("alertsBody").innerHTML = '<div class="empty">לא ניתן לטעון את ההתראות</div>';
    }
  }

  function paintReminderForm() {
    const task = state.composeKind === "task";
    const title = $("reminderTitle");
    if (title) title.textContent = task ? "משימה חדשה" : "תזכורת חדשה";
    const types = task ? "" : '<div class="typeGrid">' + ["callback", "documents", "missing"].map((key) => {
      const on = state.reminderType === key ? " is-on" : "";
      return '<button class="typePick' + on + '" type="button" data-remind="' + key + '">' + esc(REMINDER_LABELS[key]) + "</button>";
    }).join("") + "</div>";
    $("reminderBody").innerHTML = types
      + '<label class="field" for="reminderDetails">' + (task ? "פרטי המשימה" : "פרטים") + "</label>"
      + '<textarea class="input noticeInput" id="reminderDetails" maxlength="500"></textarea>'
      + '<div class="dateRow"><div><label class="field" for="reminderDate">תאריך</label><input class="input" id="reminderDate" type="date"/></div><div><label class="field" for="reminderTime">שעה</label><input class="input" id="reminderTime" type="time"/></div></div>'
      + '<p class="noticeStatus" id="reminderStatus" role="status"></p>'
      + '<button class="primary" id="reminderSave" type="button">' + (task ? "שמור משימה" : "שמור תזכורת") + "</button>";
    $("reminderSave").addEventListener("click", () => { void saveReminder(); });
  }

  function onReminderClick(event) {
    const pick = event.target.closest("[data-remind]");
    if (!pick) return;
    state.reminderType = pick.getAttribute("data-remind");
    document.querySelectorAll(".typePick").forEach((node) => node.classList.toggle("is-on", node === pick));
  }

  function openComposer(kind, dateKey) {
    state.composeKind = kind === "task" ? "task" : "reminder";
    state.reminderType = state.composeKind === "task" ? "task" : "";
    show("reminder");
    paintReminderForm();
    if (dateKey) {
      const input = $("reminderDate");
      if (input) input.value = dateKey;
    }
  }

  function openReminder() {
    openComposer("reminder");
  }

  async function saveReminder() {
    const status = $("reminderStatus");
    const task = state.composeKind === "task";
    const type = task ? "task" : state.reminderType;
    const details = trim($("reminderDetails") && $("reminderDetails").value);
    const dateVal = trim($("reminderDate") && $("reminderDate").value);
    const timeVal = trim($("reminderTime") && $("reminderTime").value);
    const fail = (message) => {
      if (!status) return;
      status.textContent = message;
      status.classList.add("is-err");
    };
    if (!type) { fail("יש לבחור סוג תזכורת"); return; }
    if (task && !details) { fail("יש לרשום את המשימה"); return; }
    if ((type === "documents" || type === "missing") && !details) { fail(type === "documents" ? "יש לרשום את המסמכים" : "יש לרשום את החוסרים"); return; }
    if (!dateVal || !timeVal) { fail("יש לבחור תאריך ושעה"); return; }
    const remindAt = new Date(dateVal + "T" + timeVal + ":00");
    if (!Number.isFinite(remindAt.getTime())) { fail("תאריך או שעה לא תקינים"); return; }
    const name = trim(state.profile && state.profile.name) || "מערכת";
    const row = {
      id: "rem_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      agent_id: name,
      type: type,
      details: details || REMINDER_LABELS[type],
      remind_at: remindAt.toISOString(),
      customer_id: null,
      customer_name: null,
      lead_id: null,
      proposal_id: null,
      link_kind: null,
      is_done: false,
      created_at: new Date().toISOString(),
      snoozed_until: null
    };
    setBusy($("reminderSave"), true);
    try {
      const res = await sb.from("reminders").insert(row);
      if (res.error) throw new Error(res.error.message || "reminder");
      const back = state.composeReturn;
      state.composeReturn = "";
      if (back === "meetings") {
        state.meetMonth = dateVal.slice(0, 7);
        state.meetDay = dateVal;
        await openMeetings();
      } else {
        await openTasks();
      }
    } catch (err) {
      fail("שגיאה בשמירה: " + (err.message || ""));
      setBusy($("reminderSave"), false);
    }
  }

  async function completeReminder(id) {
    const res = await sb.from("reminders").update({ is_done: true }).eq("id", id);
    if (res.error) return;
    const seen = readReminded();
    seen.add(id);
    ringingIds.delete(id);
    writeReminded(seen);
    try {
      state.myReminders = await loadMyReminders();
    } catch (_err) {
      state.myReminders = (state.myReminders || []).filter((row) => row.id !== id);
    }
    const tasks = document.querySelector('[data-screen="tasks"]');
    if (tasks && !tasks.hidden) paintTasks(state.myReminders || []);
  }

  const ringQueue = [];
  const reminderTimers = new Map();
  const ringingIds = new Set();
  let reminderFlight = null;
  function loadRemindersShared() {
    if (!reminderFlight) {
      reminderFlight = loadMyReminders().finally(() => { reminderFlight = null; });
    }
    return reminderFlight;
  }
  let audioCtx = null;
  let notifyAsked = false;

  function remindedKey() {
    return "onyx-phone-reminded:" + trim(state.profile && state.profile.id);
  }

  function readReminded() {
    try {
      const raw = JSON.parse(localStorage.getItem(remindedKey()) || "[]");
      return new Set(Array.isArray(raw) ? raw : []);
    } catch (_err) {
      return new Set();
    }
  }

  function writeReminded(seen) {
    try { localStorage.setItem(remindedKey(), JSON.stringify(Array.from(seen).slice(-200))); } catch (_err) {}
  }

  function unlockAudio() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  }

  function playTone(ctx, dest, freq, start, duration, velocity) {
    const t = ctx.currentTime + start;
    [1, 2.01, 4.04].forEach((mult, index) => {
      const amp = [1, 0.35, 0.12][index];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * mult, t);
      const peak = Math.max(velocity * amp, 0.0002);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + duration + 0.08);
    });
  }

  function playRing(kind) {
    unlockAudio();
    if (!audioCtx) return;
    const master = audioCtx.createGain();
    master.gain.value = kind === "sale" ? 0.7 : 1;
    master.connect(audioCtx.destination);
    if (kind === "sale") {
      playTone(audioCtx, master, 523.25, 0, 0.14, 0.26);
      playTone(audioCtx, master, 659.25, 0.12, 0.14, 0.28);
      playTone(audioCtx, master, 783.99, 0.24, 0.16, 0.32);
      playTone(audioCtx, master, 1046.5, 0.4, 0.34, 0.4);
      playTone(audioCtx, master, 1318.51, 0.7, 0.48, 0.34);
      return;
    }
    const phrase = (offset) => {
      playTone(audioCtx, master, 1567.98, offset, 0.7, 0.5);
      playTone(audioCtx, master, 1318.51, offset + 0.22, 1, 0.44);
    };
    phrase(0);
    phrase(1.72);
  }

  function subscriptionMatches(sub, publicKey) {
    const raw = sub && sub.options && sub.options.applicationServerKey;
    if (raw) {
      const bytes = new Uint8Array(raw);
      const next = bytesFromBase64Url(publicKey);
      if (bytes.length !== next.length) return false;
      for (let i = 0; i < bytes.length; i += 1) if (bytes[i] !== next[i]) return false;
      return true;
    }
    let stored = "";
    try { stored = localStorage.getItem("onyx-phone-vapid") || ""; } catch (_err) { stored = ""; }
    return stored !== "" && stored === publicKey;
  }

  function bytesFromBase64Url(value) {
    const rawValue = String(value || "");
    const pad = "=".repeat((4 - rawValue.length % 4) % 4);
    const raw = atob((rawValue + pad).replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  }

  let pushBusy = false;
  let pushReady = false;

  async function sha256Hex(value) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
    return Array.from(new Uint8Array(buf)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function enablePush(ask) {
    if (pushBusy) return;
    if (pushReady && !ask) return;
    const note = (text) => {
      state.pushNote = text || "";
      if (state.account === "notifications") void paintAccount();
    };
    pushBusy = true;
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
        if (ask) note("המכשיר לא תומך");
        return;
      }
      let perm = Notification.permission;
      if (ask && perm === "default") {
        try { perm = await Notification.requestPermission(); } catch (_err) { perm = "denied"; }
      }
      if (perm !== "granted") {
        if (ask && perm === "denied") note("התראות חסומות");
        return;
      }
      const profile = state.profile;
      if (!profile || !trim(profile.name)) return;
      const keyRes = await sb.from("app_meta").select("publicKey:payload->>publicKey").eq("key", "onyx_push_vapid_public").maybeSingle();
      const publicKey = keyRes.data && trim(keyRes.data.publicKey);
      if (!publicKey) {
        if (ask) note("עדיין לא מוכן");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (sub && !subscriptionMatches(sub, publicKey)) {
        try { await sub.unsubscribe(); } catch (_err) {}
        sub = null;
      }
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytesFromBase64Url(publicKey)
        });
      }
      const json = sub.toJSON();
      const endpoint = sub.endpoint;
      const p256dh = json.keys && json.keys.p256dh;
      const authKey = json.keys && json.keys.auth;
      if (!endpoint || !p256dh || !authKey) {
        if (ask) note("לא נשמר");
        return;
      }
      const saved = await sb.from("app_meta").upsert({
        key: "onyxsub_" + (await sha256Hex(endpoint)).slice(0, 32),
        payload: {
          endpoint: endpoint,
          p256dh: p256dh,
          auth: authKey,
          agent_id: trim(profile.id),
          agent_name: trim(profile.name),
          username: trim(profile.username),
          role: trim(profile.role),
          updated_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });
      if (saved.error) {
        if (ask) note("לא נשמר");
        return;
      }
      try { localStorage.setItem("onyx-phone-vapid", publicKey); } catch (_err) {}
      state.pushNote = "";
      pushReady = true;
      if (state.account === "notifications") void paintAccount();
    } catch (_err) {
      if (ask) note("יש לאשר מתוך האייקון");
    } finally {
      pushBusy = false;
    }
  }

  function askNotify() {
    if (notifyAsked || typeof Notification === "undefined" || Notification.permission !== "default") return;
    notifyAsked = true;
    Notification.requestPermission().then((perm) => {
      if (perm === "granted" && state.profile) void enablePush(false);
    }).catch(() => {});
  }

  function systemNotify(title, body, tag) {
    const payload = {
      body: body,
      lang: "he",
      tag: tag,
      vibrate: [180, 80, 180, 80, 320]
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(async (reg) => {
        if (tag) {
          const existing = await reg.getNotifications({ tag: tag });
          if (existing.length) return;
        }
        await reg.showNotification(title, payload);
      }).catch(() => {});
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try { new Notification(title, payload); } catch (_err) {}
    }
  }

  function showRing(item) {
    state.ringItem = item;
    if (item.kind === "reminder") {
      const seen = readReminded();
      seen.add(item.id);
      writeReminded(seen);
    }
    if (item.kind === "sale" || item.kind === "closed") {
      const seen = readAlertSeen();
      (item.ids || []).forEach((id) => seen.add(id));
      writeAlertSeen(seen);
      void rememberAlertIds(item.ids || []);
    }
    $("ring").classList.toggle("ring--sale", item.kind === "sale");
    $("ringKicker").textContent = item.kicker || "";
    $("ringTitle").textContent = item.title || "";
    $("ringText").textContent = item.text || "";
    $("ringMeta").textContent = item.meta || "";
    $("ringDone").hidden = item.kind !== "reminder";
    $("ringSnooze").hidden = item.kind !== "reminder";
    $("ringOpen").hidden = item.kind !== "sale" && item.kind !== "closed" && item.kind !== "lead";
    $("ringOpen").textContent = item.kind === "lead" ? "פתח" : "כל ההתראות";
    $("ring").hidden = false;
    playRing(item.kind === "sale" || item.kind === "closed" || item.kind === "lead" ? "sale" : "reminder");
    if (item.kind === "lead" && document.visibilityState !== "visible") {
      systemNotify(item.title || "שויך לך ליד", item.text || "", item.tag || "onyx-lead");
    } else if (document.visibilityState !== "visible" && !("serviceWorker" in navigator)) {
      systemNotify(item.title || "ONYX", [item.text, item.meta].filter(Boolean).join("\n"), item.tag || "onyx-ring");
    }
  }

  function nextRing() {
    if (state.ringItem || !ringQueue.length) return;
    showRing(ringQueue.shift());
  }

  function pushRing(item) {
    ringQueue.push(item);
    nextRing();
  }

  function closeRing() {
    state.ringItem = null;
    $("ring").hidden = true;
    window.setTimeout(nextRing, 280);
  }

  async function snoozeReminder(id) {
    const until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const res = await sb.from("reminders").update({ snoozed_until: until }).eq("id", id);
    if (res.error) return;
    const seen = readReminded();
    seen.delete(id);
    ringingIds.delete(id);
    writeReminded(seen);
    const row = (state.myReminders || []).find((item) => item.id === id);
    if (row) row.snoozed_until = until;
    armReminders(state.myReminders || []);
  }

  function armReminders(rows) {
    reminderTimers.forEach((handle) => window.clearTimeout(handle));
    reminderTimers.clear();
    const now = Date.now();
    const upcoming = [];
    (rows || []).forEach((row) => {
      const at = Date.parse(row.remind_at);
      const snooze = Date.parse(row.snoozed_until);
      const wake = Number.isFinite(snooze) && snooze > at ? snooze : at;
      if (!Number.isFinite(wake) || wake <= now || wake - now > 6 * 60 * 60 * 1000) return;
      upcoming.push({
        id: row.id,
        at: wake,
        title: reminderTitle(row),
        body: trim(row.details)
      });
      reminderTimers.set(row.id, window.setTimeout(() => { void checkReminders(); }, wake - now + 250));
    });
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.active) reg.active.postMessage({ type: "arm", reminders: upcoming });
    }).catch(() => {});
  }

  async function checkReminders() {
    let rows = [];
    try { rows = await loadRemindersShared(); } catch (_err) { return; }
    state.myReminders = rows;
    const tasks = document.querySelector('[data-screen="tasks"]');
    if (tasks && !tasks.hidden && state.taskTab !== "done") paintTasks(rows);
    const now = Date.now();
    const seen = readReminded();
    rows.forEach((row) => {
      const at = Date.parse(row.remind_at);
      const snooze = Date.parse(row.snoozed_until);
      const waiting = Number.isFinite(snooze) && snooze > now;
      const due = Number.isFinite(at) && at <= now && !waiting;
      const already = seen.has(row.id) || ringQueue.some((item) => item.id === row.id) || (state.ringItem && state.ringItem.id === row.id);
      const wake = waiting ? snooze : at;
      const late = Number.isFinite(wake) && now - wake > 3 * 60 * 1000;
      if (!due || already || ringingIds.has(row.id) || (late && pushReady)) return;
      ringingIds.add(row.id);
      pushRing({
        kind: "reminder",
        id: row.id,
        tag: "onyx-rem-" + row.id,
        kicker: "תזכורת",
        title: reminderTitle(row),
        text: trim(row.details),
        meta: [trim(row.customer_name), reminderWhen(row.remind_at)].filter(Boolean).join(" · ")
      });
    });
    armReminders(rows);
  }

  function sheetRows(rawSheets) {
    return (Array.isArray(rawSheets) ? rawSheets : []).map((sheet) => {
      const headers = Array.isArray(sheet.header_row) ? sheet.header_row.map((item) => trim(item)) : [];
      const agentCol = findCol(headers, ["נציג", "שם נציג", "סוכן"]);
      const rows = (Array.isArray(sheet.data_rows) ? sheet.data_rows : []).map((item) => {
        const cells = Array.isArray(item && item.cells) ? item.cells.map((value) => trim(value)) : [];
        return {
          agent: trim(item && item.agent) || (agentCol >= 0 ? cells[agentCol] : ""),
          cells: cells
        };
      }).filter(rowVisible);
      return { name: trim(sheet.sheet_name) || "גיליון", headers: headers, rows: rows };
    });
  }

  function cancelKey(value) {
    const n = token(value);
    if (!n) return "";
    if (n === "בוטל חלקי") return "cancelledPartial";
    if (n === "ביטול חלקי") return "partial";
    if (n === "בוטל") return "cancelled";
    if (n === "שומר" || n === "שומרה" || n === "נשמר") return "retained";
    if (n.includes("ממתין") && n.includes("שימור")) return "awaitingRetain";
    return "";
  }

  function reportCols(headers) {
    return {
      status: findCol(headers, ["סטטוס הצעה", "סטאטוס", "סטטוס"]),
      premium: findCol(headers, ["פרמיה חודשית", "פרמיה לחודש", "סכום פרמיה", "פרמיה נטו", "פרמיה"]),
      name: findCol(headers, ["שם לקוח", "שם מלא", "מבוטח", "לקוח", "שם"]),
      company: findCol(headers, ["חברה", "חברת ביטוח", "מבטח"]),
      plan: findCol(headers, ["שם תוכנית", "תוכנית"]),
      month: findCol(headers, ["חודש ביצוע", "חודש"])
    };
  }

  async function loadCancellations() {
    const res = await sb.from("gi_cancellations_report")
      .select("uploaded_at,uploaded_by_name,sheets")
      .eq("id", "active")
      .maybeSingle();
    if (res.error) throw new Error(res.error.message || "cancellations");
    const row = res.data || {};
    return {
      uploadedAt: trim(row.uploaded_at),
      uploadedBy: trim(row.uploaded_by_name),
      sheets: sheetRows(row.sheets)
    };
  }

  function cancelStats(sheet) {
    const cols = reportCols(sheet.headers);
    const stats = {
      cancelled: { premium: 0, count: 0 },
      cancelledPartial: { premium: 0, count: 0 },
      partial: { premium: 0, count: 0 },
      awaitingRetain: { premium: 0, count: 0 },
      retained: { premium: 0, count: 0 }
    };
    sheet.rows.forEach((row) => {
      const key = cancelKey(cell(row, cols.status));
      if (!stats[key]) return;
      stats[key].count += 1;
      stats[key].premium = Math.round((stats[key].premium + parseMoney(cell(row, cols.premium))) * 100) / 100;
    });
    const total = ["cancelled", "cancelledPartial", "partial"].reduce((sum, key) => ({
      count: sum.count + stats[key].count,
      premium: Math.round((sum.premium + stats[key].premium) * 100) / 100
    }), { count: 0, premium: 0 });
    return { cols: cols, stats: stats, total: total };
  }

  function statCard(label, data, wide) {
    return '<div class="areaCard' + (wide ? " areaCard--wide" : "") + '"><span>' + esc(label) + '</span><strong>' + esc(money(data.premium)) + '</strong><small>' + esc(String(data.count)) + " פוליסות</small></div>";
  }

  function paintCancel(keepSearch) {
    const report = state.cancelReport;
    const host = $("cancelBody");
    if (!report || !report.sheets.length) {
      host.innerHTML = '<div class="empty">אין דוח ביטולים</div>';
      return;
    }
    const index = Math.min(state.cancelSheet, report.sheets.length - 1);
    const sheet = report.sheets[index];
    const built = cancelStats(sheet);
    const q = trim(state.cancelQuery).toLowerCase();
    const rows = sheet.rows.filter((row) => !q || (row.cells.join(" ") + " " + row.agent).toLowerCase().includes(q));
    const shown = rows.slice(0, 80);
    const cards = shown.map((row) => {
      const name = cell(row, built.cols.name) || "ללא שם";
      const status = cell(row, built.cols.status);
      const company = cell(row, built.cols.company);
      return '<article class="repCard"><b>' + esc(name) + "</b><span>" + esc([status, company].filter(Boolean).join(" · ")) + "</span><strong>" + esc(money(parseMoney(cell(row, built.cols.premium)))) + "</strong><small>" + esc(row.agent || "") + "</small></article>";
    }).join("");
    const meta = "מוצגות " + shown.length + " מתוך " + rows.length + " שורות";
    if (keepSearch && $("cancelList")) {
      $("cancelList").innerHTML = cards || '<div class="empty">אין שורות</div>';
      $("cancelMeta").textContent = meta;
      return;
    }
    const tabs = report.sheets.length > 1
      ? '<div class="chips">' + report.sheets.map((item, sheetIndex) => '<button class="chip' + (sheetIndex === index ? " is-on" : "") + '" type="button" data-sheet="' + sheetIndex + '">' + esc(item.name) + "</button>").join("") + "</div>"
      : "";
    const when = report.uploadedAt ? reminderWhen(report.uploadedAt) : "";
    const lead = [when ? "הועלה " + when : "", report.uploadedBy].filter(Boolean).join(" · ");
    host.innerHTML = (lead ? '<p class="moreLead">' + esc(lead) + "</p>" : "")
      + '<div class="areaGrid">'
      + statCard("בוטל", built.stats.cancelled, false)
      + statCard("בוטל חלקי", built.stats.cancelledPartial, false)
      + statCard("ביטול חלקי", built.stats.partial, false)
      + statCard("סה״כ פרמיית ביטול", built.total, true)
      + statCard("ממתין לשימור", built.stats.awaitingRetain, false)
      + statCard("סה״כ פרמיה ששומרה", built.stats.retained, false)
      + "</div>"
      + tabs
      + '<input class="input" id="cancelSearch" type="search" placeholder="חיפוש" value="' + esc(state.cancelQuery) + '"/>'
      + '<p class="reportMeta" id="cancelMeta">' + esc(meta) + "</p>"
      + '<div id="cancelList">' + (cards || '<div class="empty">אין שורות</div>') + "</div>";
  }

  async function openCancel() {
    show("cancel");
    $("cancelBody").innerHTML = '<div class="empty">טוען…</div>';
    state.cancelQuery = "";
    state.cancelSheet = 0;
    try {
      await loadScope();
      state.cancelReport = await loadCancellations();
      paintCancel(false);
    } catch (_err) {
      $("cancelBody").innerHTML = '<div class="empty">לא ניתן לטעון את דוח הביטולים</div>';
    }
  }

  function appointmentFromRaw(raw) {
    const sourceRow = raw && typeof raw === "object" ? raw : {};
    const headers = (Array.isArray(sourceRow.header_row) ? sourceRow.header_row : (Array.isArray(sourceRow.headerRow) ? sourceRow.headerRow : [])).map((item) => trim(item));
    const source = Array.isArray(sourceRow.data_rows) ? sourceRow.data_rows : (Array.isArray(sourceRow.dataRows) ? sourceRow.dataRows : []);
    const agentCol = findCol(headers, ["נציג", "שם נציג", "סוכן"]);
    const rows = source.map((item) => {
      const cells = Array.isArray(item && item.cells) ? item.cells.map((value) => trim(value)) : [];
      return {
        agent: trim(item && item.agent) || (agentCol >= 0 ? cells[agentCol] : ""),
        cells: cells
      };
    }).filter(rowVisible);
    return {
      uploadedAt: trim(sourceRow.uploaded_at || sourceRow.uploadedAt),
      uploadedBy: trim(sourceRow.uploaded_by_name || sourceRow.uploadedByName),
      headers: headers,
      rows: rows,
      cols: reportCols(headers)
    };
  }

  function readAppointmentLocal() {
    try {
      const raw = localStorage.getItem("GI_AGENT_APPOINTMENT_REPORT_V1");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_err) {
      return null;
    }
  }

  function loadAppointmentSeed() {
    if (window.GI_AGENT_APPOINTMENT_REPORT_SEED) return Promise.resolve(window.GI_AGENT_APPOINTMENT_REPORT_SEED);
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "../gi-agent-appointment-report-seed.js?v=20260909-agent-appt-report-v1";
      script.onload = () => resolve(window.GI_AGENT_APPOINTMENT_REPORT_SEED || null);
      script.onerror = () => reject(new Error("seed"));
      document.head.appendChild(script);
    });
  }

  async function loadAppointments() {
    const res = await sb.from("gi_agent_appointment_report")
      .select("uploaded_at,uploaded_by_name,header_row,data_rows")
      .eq("id", "active")
      .maybeSingle();
    if (!res.error && res.data) return appointmentFromRaw(res.data);
    const local = readAppointmentLocal();
    if (local) return appointmentFromRaw(local);
    const seed = await loadAppointmentSeed();
    if (!seed) throw new Error(res.error ? res.error.message : "appointments");
    return appointmentFromRaw(seed);
  }

  function paintAppoint(keepSearch) {
    const report = state.appointReport;
    const host = $("appointBody");
    if (!report) {
      host.innerHTML = '<div class="empty">אין דוח מינוי סוכן</div>';
      return;
    }
    const q = trim(state.appointQuery).toLowerCase();
    const rows = report.rows.filter((row) => !q || (row.cells.join(" ") + " " + row.agent).toLowerCase().includes(q));
    let doneCount = 0;
    let donePremium = 0;
    rows.forEach((row) => {
      if (token(cell(row, report.cols.status)) !== "בוצע") return;
      doneCount += 1;
      donePremium = Math.round((donePremium + parseMoney(cell(row, report.cols.premium))) * 100) / 100;
    });
    const shown = rows.slice(0, 80);
    const cards = shown.map((row) => {
      const name = cell(row, report.cols.name) || "ללא שם";
      const status = cell(row, report.cols.status);
      const company = cell(row, report.cols.company);
      const plan = cell(row, report.cols.plan);
      const month = cell(row, report.cols.month);
      return '<article class="repCard"><b>' + esc(name) + "</b><span>" + esc([company, plan].filter(Boolean).join(" · ")) + "</span><strong>" + esc(money(parseMoney(cell(row, report.cols.premium)))) + "</strong><small>" + esc([status, row.agent, month].filter(Boolean).join(" · ")) + "</small></article>";
    }).join("");
    const meta = "מוצגות " + shown.length + " מתוך " + rows.length + " שורות";
    if (keepSearch && $("appointList")) {
      $("appointList").innerHTML = cards || '<div class="empty">אין שורות</div>';
      $("appointMeta").textContent = meta;
      return;
    }
    const when = report.uploadedAt ? reminderWhen(report.uploadedAt) : "";
    const lead = when
      ? ["הועלה " + when, report.uploadedBy].filter(Boolean).join(" · ")
      : "נטען מדוח מינוי סוכן";
    host.innerHTML = (lead ? '<p class="moreLead">' + esc(lead) + "</p>" : "")
      + '<div class="areaGrid"><div class="areaCard"><span>פרמיה שבוצעה</span><strong id="appointDone">' + esc(money(donePremium)) + '</strong><small id="appointDoneSub">' + esc(String(doneCount)) + ' פוליסות בוצע</small></div><div class="areaCard"><span>שורות בדוח</span><strong>' + esc(String(rows.length)) + "</strong><small>לפי השיוך שלך</small></div></div>"
      + '<input class="input" id="appointSearch" type="search" placeholder="חיפוש" value="' + esc(state.appointQuery) + '"/>'
      + '<p class="reportMeta" id="appointMeta">' + esc(meta) + "</p>"
      + '<div id="appointList">' + (cards || '<div class="empty">אין שורות</div>') + "</div>";
  }

  async function openAppoint() {
    show("appoint");
    $("appointBody").innerHTML = '<div class="empty">טוען…</div>';
    state.appointQuery = "";
    try {
      await loadScope();
      state.appointReport = await loadAppointments();
      paintAppoint(false);
    } catch (_err) {
      $("appointBody").innerHTML = '<div class="empty">לא ניתן לטעון את דוח מינוי הסוכן</div>';
    }
  }

  async function openHubReport(kind) {
    if (kind === "sales") {
      show("report");
      try {
        await loadScope();
        if (!state.report) await loadReport();
        paintReport();
      } catch (_err) {
        $("reportTable").innerHTML = '<div class="empty">לא ניתן לטעון את דוח המכירות</div>';
      }
      return;
    }
    if (kind === "cancel") await openCancel();
    if (kind === "appoint") await openAppoint();
  }

  $("reminderBody").addEventListener("click", onReminderClick);
  $("alertsBody").addEventListener("click", (event) => {
    const done = event.target.closest("[data-done]");
    if (!done) return;
    void completeReminder(done.getAttribute("data-done"));
  });

  $("assignQuery").addEventListener("input", paintAssignList);
  $("assignList").addEventListener("click", (event) => {
    const row = event.target.closest("[data-agent]");
    if (!row || row.disabled) return;
    state.assignAgentId = row.getAttribute("data-agent");
    paintAssignList();
  });
  $("assignConfirm").addEventListener("click", () => { void confirmAssign(); });
  $("assignBackdrop").addEventListener("click", () => { $("assignSheet").hidden = true; });
  $("editForm").addEventListener("submit", (event) => { void saveContact(event); });
  $("editBackdrop").addEventListener("click", () => { $("editSheet").hidden = true; });
  $("btnCustomerBack").addEventListener("click", () => {
    if (state.file && fileSectionTab() !== "policies") {
      state.fileTab = "policies";
      closeFolioMenu();
      paintCustomerFile();
      return;
    }
    show("customers");
  });
  $("btnCustomerMore").addEventListener("click", () => {
    const menu = $("folioMenu");
    const backdrop = $("folioMenuBackdrop");
    if (!menu) return;
    const open = menu.hidden;
    menu.hidden = !open;
    if (backdrop) backdrop.hidden = !open;
    $("btnCustomerMore").setAttribute("aria-expanded", open ? "true" : "false");
  });
  $("folioMenuBackdrop").addEventListener("click", closeFolioMenu);
  /* GI-PORTAL-START */
  function portalDigits(value) {
    return String(value == null ? "" : value).replace(/\D/g, "").replace(/^0+/, "");
  }

  function portalPhoneKey(value) {
    let digits = String(value == null ? "" : value).replace(/\D/g, "");
    if (digits.indexOf("972") === 0) digits = digits.slice(3);
    return digits.replace(/^0+/, "");
  }

  function portalBirthKey(value) {
    const raw = String(value == null ? "" : value).trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[1] + iso[2] + iso[3];
    const dmy = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (dmy) return dmy[3] + dmy[2].padStart(2, "0") + dmy[1].padStart(2, "0");
    return "";
  }

  function portalIdentity(row) {
    const payload = row && row.payload && typeof row.payload === "object" ? row.payload : {};
    const primary = payload.primary && typeof payload.primary === "object" ? payload.primary : {};
    const insureds = Array.isArray(payload.insureds) ? payload.insureds : [];
    const id = portalDigits(row && row.id_number) || portalDigits(primary.idNumber);
    let birth = "";
    insureds.forEach((ins) => {
      const data = ins && ins.data && typeof ins.data === "object" ? ins.data : {};
      if (!birth && id && portalDigits(data.idNumber) === id) birth = portalBirthKey(data.birthDate);
    });
    if (!birth && (!portalDigits(primary.idNumber) || portalDigits(primary.idNumber) === id)) birth = portalBirthKey(primary.birthDate);
    const phones = [portalPhoneKey(row && row.phone), portalPhoneKey(primary.phone)];
    insureds.forEach((ins) => {
      const data = ins && ins.data && typeof ins.data === "object" ? ins.data : {};
      phones.push(portalPhoneKey(data.phone));
    });
    return { id: id, birth: birth, phone: phones.find(Boolean) || "" };
  }
  /* GI-PORTAL-END */

  function portalHref(code) {
    return PORTAL_SHARE + code;
  }

  function portalLabel(code) {
    return PORTAL_SHARE.replace(/^https?:\/\//, "") + code;
  }

  function portalMissingMessage(error) {
    const message = trim(error && (error.message || error.details || error.hint));
    return /onyx_customer_portals|schema cache|does not exist|42P01/i.test(message);
  }

  function paintPortalSheet() {
    const code = state.portalCode;
    const link = $("portalLink");
    const send = $("portalSend");
    const approve = $("portalApprove");
    const close = $("portalClose");
    const note = $("portalState");
    if (!link || !send || !approve || !close || !note) return;
    if (code && state.portalEnabled) {
      note.textContent = "האזור האישי פתוח. הלקוח נכנס עם תעודת זהות וטלפון, ואז עם הקוד שנשלח למייל.";
      link.hidden = false;
      link.textContent = portalLabel(code);
      send.hidden = false;
      send.disabled = false;
      send.textContent = "שלח לינק לאזור אישי ללקוח";
      approve.hidden = true;
      close.hidden = false;
      close.disabled = false;
      close.textContent = "סגירת האזור האישי";
      return;
    }
    link.hidden = true;
    send.hidden = true;
    close.hidden = true;
    approve.hidden = false;
    approve.disabled = false;
    if (code) {
      note.textContent = "האזור האישי סגור.";
      approve.textContent = "פתיחה מחדש";
      return;
    }
    note.textContent = "אחרי האישור ייווצר לינק כניסה ללקוח.";
    approve.textContent = "אישור יצירת לינק";
  }

  async function openPortalSheet() {
    const row = state.file;
    const sheet = $("portalSheet");
    if (!row || !sheet) return;
    $("portalError").textContent = "";
    state.portalCode = "";
    state.portalEnabled = false;
    paintPortalSheet();
    $("portalState").textContent = "טוען…";
    sheet.hidden = false;
    const found = await sb.from("onyx_customer_portals").select("code,enabled").eq("customer_id", String(row.id)).maybeSingle();
    if (found.error) {
      $("portalError").textContent = portalMissingMessage(found.error)
        ? "האזור האישי עדיין לא הופעל במערכת"
        : "לא ניתן לטעון את האזור האישי";
      $("portalState").textContent = "";
      return;
    }
    state.portalCode = found.data && found.data.code ? found.data.code : "";
    state.portalEnabled = !!(found.data && found.data.enabled);
    paintPortalSheet();
  }

  async function approvePortal() {
    const row = state.file;
    const button = $("portalApprove");
    if (!row || !button) return;
    const who = portalIdentity(row);
    const missing = [];
    if (!who.id) missing.push("תעודת זהות");
    if (!who.phone) missing.push("טלפון");
    if (!who.birth) missing.push("תאריך לידה");
    if (missing.length) {
      $("portalError").textContent = "חסר בתיק: " + missing.join(", ");
      return;
    }
    button.disabled = true;
    $("portalError").textContent = "";
    const now = new Date().toISOString();
    const agentId = trim(state.profile && state.profile.id);
    let code = state.portalCode;
    if (code) {
      const updated = await sb.from("onyx_customer_portals").update({
        enabled: true,
        agent_id: agentId,
        updated_at: now
      }).eq("code", code);
      if (updated.error) {
        $("portalError").textContent = portalMissingMessage(updated.error)
          ? "האזור האישי עדיין לא הופעל במערכת"
          : "לא ניתן לפתוח את האזור האישי";
        button.disabled = false;
        return;
      }
    } else {
      code = "p" + portalCodeTail();
      const inserted = await sb.from("onyx_customer_portals").insert({
        code: code,
        customer_id: String(row.id),
        agent_id: agentId,
        enabled: true,
        created_at: now,
        updated_at: now
      });
      if (inserted.error) {
        const again = await sb.from("onyx_customer_portals").select("code,enabled").eq("customer_id", String(row.id)).maybeSingle();
        if (!again.data || !again.data.code) {
          $("portalError").textContent = portalMissingMessage(inserted.error)
            ? "האזור האישי עדיין לא הופעל במערכת"
            : "לא ניתן ליצור את הלינק";
          button.disabled = false;
          return;
        }
        code = again.data.code;
      }
    }
    state.portalCode = code;
    state.portalEnabled = true;
    button.disabled = false;
    paintPortalSheet();
  }

  async function closePortal() {
    const code = state.portalCode;
    const button = $("portalClose");
    if (!code || !button || !state.portalEnabled) return;
    button.disabled = true;
    $("portalError").textContent = "";
    const host = location.hostname;
    const preview = new URLSearchParams(location.search).get("preview");
    if ((host === "127.0.0.1" || host === "localhost") && preview === "portal-sheet") {
      state.portalEnabled = false;
      button.disabled = false;
      paintPortalSheet();
      return;
    }
    const updated = await sb.from("onyx_customer_portals").update({
      enabled: false,
      updated_at: new Date().toISOString()
    }).eq("code", code);
    if (updated.error) {
      $("portalError").textContent = portalMissingMessage(updated.error)
        ? "האזור האישי עדיין לא הופעל במערכת"
        : "לא ניתן לסגור את האזור האישי";
      button.disabled = false;
      return;
    }
    state.portalEnabled = false;
    button.disabled = false;
    paintPortalSheet();
  }

  function portalCodeTail() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = new Uint8Array(8);
    (window.crypto || crypto).getRandomValues(bytes);
    let code = "";
    bytes.forEach((value) => { code += alphabet[value % alphabet.length]; });
    return code;
  }

  async function portalShareFile() {
    try {
      const res = await fetch("./portal-og.jpg");
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob || blob.size < 1000) return null;
      return new File([blob], "onyx-portal.jpg", { type: "image/jpeg" });
    } catch (_err) {
      return null;
    }
  }

  async function sendPortalLink() {
    const code = state.portalCode;
    const button = $("portalSend");
    if (!code || !button || !state.portalEnabled) return;
    const href = portalHref(code);
    const text = "נפתח עבורך אזור אישי. לכניסה יש להזין תעודת זהות וטלפון, ואז את הקוד שנשלח למייל.\n" + href;
    const host = location.hostname;
    const preview = new URLSearchParams(location.search).get("preview");
    const file = await portalShareFile();
    if ((host === "127.0.0.1" || host === "localhost") && preview === "portal-sheet") {
      window.ONYX_PORTAL_SENT = text;
      window.ONYX_PORTAL_CARD = !!(file && file.type === "image/jpeg");
      button.textContent = "הלינק מוכן לשליחה";
      return;
    }
    const done = () => {
      button.textContent = "הלינק מוכן לשליחה";
      window.setTimeout(() => { button.textContent = "שלח לינק לאזור אישי ללקוח"; }, 1600);
    };
    const fail = () => { button.textContent = "לא ניתן לשלוח"; };
    const withImage = file && navigator.canShare && navigator.canShare({ files: [file], text: text });
    const share = navigator.share
      ? navigator.share(withImage ? { title: "אזור אישי", text: text, files: [file] } : { title: "אזור אישי", text: text }).then(done)
      : Promise.reject(new Error("share"));
    share.catch((err) => {
      if (err && err.name === "AbortError") return null;
      const write = navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText(text)
        : Promise.reject(new Error("copy"));
      return write.catch(() => copyPlain(text)).then(done);
    }).catch(fail);
  }

  $("folioMenu").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-filetab]");
    if (tab && state.file) {
      state.fileTab = tab.getAttribute("data-filetab") || "policies";
      closeFolioMenu();
      paintCustomerFile({ scroll: true });
      return;
    }
    if (event.target.closest("[data-assign]")) {
      closeFolioMenu();
      void openAssign();
      return;
    }
    if (event.target.closest("[data-portal]")) {
      closeFolioMenu();
      void openPortalSheet();
    }
  });
  $("companyClose").addEventListener("click", () => { $("companySheet").hidden = true; });
  $("companyBackdrop").addEventListener("click", () => { $("companySheet").hidden = true; });
  $("portalBackdrop").addEventListener("click", () => { $("portalSheet").hidden = true; });
  $("portalApprove").addEventListener("click", () => { void approvePortal(); });
  $("portalClose").addEventListener("click", () => { void closePortal(); });
  $("portalSend").addEventListener("click", () => { void sendPortalLink(); });
  $("btnCustomersBack").addEventListener("click", () => show("home"));
  var chat = { me: "", meName: "", peer: null, users: [], messages: [], presence: null, db: null, timer: 0, query: "", badge: null, badgeTimer: 0 };

  function stopChatBadge() {
    if (!chat) return;
    if (chat.badgeTimer) window.clearInterval(chat.badgeTimer);
    chat.badgeTimer = 0;
    if (chat.badge) {
      try { sb.removeChannel(chat.badge); } catch (_err) {}
      chat.badge = null;
    }
  }

  function stopPhoneChat() {
    if (!chat) return;
    if (chat.timer) window.clearInterval(chat.timer);
    chat.timer = 0;
    [chat.presence, chat.db].forEach((channel) => {
      if (!channel) return;
      try { channel.untrack(); } catch (_err) {}
      try { sb.removeChannel(channel); } catch (_err) {}
    });
    chat.presence = null;
    chat.db = null;
  }

  function chatSeenKey() {
    return "onyx-phone-chat-seen:" + (chat.me || "");
  }

  function readChatSeen() {
    try { return localStorage.getItem(chatSeenKey()) || ""; } catch (_err) { return ""; }
  }

  function writeChatSeen(iso) {
    try { localStorage.setItem(chatSeenKey(), iso || ""); } catch (_err) {}
  }

  function markChatSeen() {
    writeChatSeen(new Date().toISOString());
  }

  function chatBadgeText(count) {
    const n = Number(count) || 0;
    if (n < 1) return "";
    return n > 99 ? "99+" : String(n);
  }

  function paintChatBadge(count) {
    const badge = $("chatBadge");
    if (!badge) return;
    const text = chatBadgeText(count);
    badge.hidden = !text;
    badge.textContent = text;
  }

  function chatScreenOpen() {
    const screen = $("screenChat");
    return !!(screen && !screen.hidden);
  }

  async function refreshChatBadge() {
    if (!chat.me) return;
    if (chatScreenOpen()) {
      markChatSeen();
      paintChatBadge(0);
      return;
    }
    if (!readChatSeen()) {
      markChatSeen();
      paintChatBadge(0);
      return;
    }
    const res = await sb.from("gi_chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", chat.me)
      .gt("created_at", readChatSeen())
      .gt("expires_at", new Date().toISOString());
    if (res.error) return;
    paintChatBadge(res.count || 0);
  }

  function listenChatBadge() {
    if (!chat.me || chat.badge) return;
    chat.badge = sb.channel("invest-chat-badge-" + chat.me)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gi_chat_messages", filter: "recipient_id=eq." + chat.me }, () => { void refreshChatBadge(); })
      .subscribe();
    if (chat.badgeTimer) window.clearInterval(chat.badgeTimer);
    chat.badgeTimer = window.setInterval(() => { void refreshChatBadge(); }, 15000);
  }

  async function resolveChatMe() {
    let agent = state.profile || {};
    if (agent.id) {
      const row = await sb.from("agents").select("id,name,username,role").eq("id", agent.id).maybeSingle();
      if (row.data) agent = row.data;
    }
    chat.me = chatUserId(agent);
    chat.meName = trim(agent.name) || trim(state.profile && state.profile.name) || "נציג";
    return chat.me;
  }

  async function ensureChatBadge() {
    try {
      if (!chat.me) await resolveChatMe();
      if (!chat.me) return;
      listenChatBadge();
      await refreshChatBadge();
    } catch (_err) {}
  }

  function chatKey(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[^\w֐-׿-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "user";
  }

  function chatUserId(agent) {
    const id = trim(agent && agent.id) || trim(agent && agent.name) || "agent";
    const user = trim(agent && agent.username) || trim(agent && agent.name) || "";
    return chatKey(id + "__" + user);
  }

  function chatConvo(other) {
    return [chat.me, other].sort().join("__");
  }

  function chatMidnight() {
    const next = new Date();
    next.setHours(24, 0, 0, 0);
    return next.toISOString();
  }

  function chatClock(value) {
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return "";
    try {
      return new Date(ms).toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" });
    } catch (_err) {
      return "";
    }
  }

  function chatInitial(name) {
    const clean = trim(name);
    return clean ? clean.slice(0, 1) : "נ";
  }

  function paintChatLive() {
    const el = $("chatLive");
    if (!el || chat.peer) return;
    const count = chat.users.filter((user) => user.online).length;
    el.textContent = count ? count + " מחוברים" : "מחובר";
    el.classList.toggle("is-on", count > 0);
  }

  function setChatFind(open) {
    const find = $("chatFind");
    if (find) find.hidden = !open;
  }

  function chatMatchesQuery(user, query) {
    const q = token(query);
    if (!q) return true;
    const hay = token([user && user.name, user && user.role, user && user.username].filter(Boolean).join(" "));
    return q.split(" ").every((part) => part && hay.includes(part));
  }

  function chatListedUsers() {
    const field = $("chatUserQuery");
    const query = field ? field.value : chat.query;
    chat.query = query;
    return chat.users.filter((user) => chatMatchesQuery(user, query));
  }

  function paintChatUsers() {
    const host = $("chatBody");
    const form = $("chatCompose");
    if (!host) return;
    if (form) form.hidden = true;
    setChatFind(true);
    const title = $("chatTitle");
    if (title) title.textContent = "צאט";
    paintChatLive();
    const listed = chatListedUsers();
    if (!chat.users.length) {
      host.innerHTML = '<div class="chatEmpty"><b>אין נציגים להצגה</b></div>';
      return;
    }
    if (!listed.length) {
      host.innerHTML = '<div class="chatEmpty"><b>אין משתמש תואם</b></div>';
      return;
    }
    host.innerHTML = '<div class="chatHome"><p class="chatKicker">נציגים</p><div class="chatUsers">' + listed.map((user) => {
      return '<button class="chatUser" type="button" data-chat-user="' + esc(user.id) + '"><span class="chatAvatar">' + esc(chatInitial(user.name)) + '<i class="chatDot' + (user.online ? " is-on" : "") + '"></i></span><span class="chatUser__copy"><b>' + esc(user.name) + "</b><small>" + esc(user.role) + (user.online ? " · מחובר" : "") + '</small></span><svg class="chatChevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>';
    }).join("") + "</div></div>";
  }

  function paintChatThread() {
    const host = $("chatBody");
    const form = $("chatCompose");
    const peer = chat.peer;
    if (!host || !peer) return;
    if (form) form.hidden = false;
    setChatFind(false);
    const title = $("chatTitle");
    if (title) title.textContent = peer.name;
    const live = $("chatLive");
    if (live) {
      live.textContent = peer.online ? "מחובר" : "לא מחובר";
      live.classList.toggle("is-on", !!peer.online);
    }
    const rows = chat.messages.length
      ? chat.messages.map((msg) => {
        const mine = msg.sender_id === chat.me;
        return '<article class="chatBubble ' + (mine ? "chatBubble--mine" : "chatBubble--peer") + '"><p>' + esc(msg.body) + "</p><time>" + esc(chatClock(msg.created_at)) + "</time></article>";
      }).join("")
      : '<div class="chatEmpty"><b>אין עדיין הודעות</b><span>השיחה נמחקת בחצות</span></div>';
    host.innerHTML = '<div class="chatThread">' + rows + "</div>";
    host.scrollTop = host.scrollHeight;
  }

  function chatApplyPresence() {
    const map = new Map();
    if (chat.presence && typeof chat.presence.presenceState === "function") {
      const raw = chat.presence.presenceState() || {};
      Object.keys(raw).forEach((key) => {
        const list = raw[key];
        if (Array.isArray(list) && list.length) map.set(key, list[list.length - 1]);
      });
    }
    chat.users.forEach((user) => { user.online = map.has(user.id); });
    chat.users.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, "he"));
    if (chat.peer) {
      const fresh = chat.users.find((user) => user.id === chat.peer.id);
      if (fresh) chat.peer.online = fresh.online;
      paintChatThread();
    } else paintChatUsers();
  }

  async function loadChatUsers() {
    const res = await sb.from("agents").select("id,name,username,role,active").limit(400);
    if (res.error) throw new Error(res.error.message || "agents");
    chat.users = (res.data || []).filter((agent) => agent && agent.active !== false).map((agent) => ({
      id: chatUserId(agent),
      name: trim(agent.name) || "נציג",
      username: trim(agent.username),
      role: roleLabel(agent.role),
      online: false
    })).filter((user) => user.id && user.id !== chat.me);
    chatApplyPresence();
  }

  async function loadChatMessages() {
    if (!chat.peer || !chat.me) return;
    const res = await sb.from("gi_chat_messages")
      .select("id,conversation_id,sender_id,sender_name,recipient_id,recipient_name,body,created_at,expires_at")
      .eq("conversation_id", chatConvo(chat.peer.id))
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(120);
    if (res.error) throw new Error(res.error.message || "chat");
    chat.messages = res.data || [];
    if (chat.peer) paintChatThread();
  }

  function listenChat() {
    if (!chat.me || chat.db) return;
    chat.db = sb.channel("invest-chat-db-" + chat.me)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gi_chat_messages", filter: "recipient_id=eq." + chat.me }, () => { void loadChatMessages(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gi_chat_messages", filter: "sender_id=eq." + chat.me }, () => { void loadChatMessages(); })
      .subscribe();
  }

  async function connectChatPresence() {
    if (!chat.me || chat.presence) return;
    const channel = sb.channel("invest-chat-presence-room", { config: { presence: { key: chat.me } } });
    chat.presence = channel;
    channel.on("presence", { event: "sync" }, () => chatApplyPresence());
    await new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      window.setTimeout(finish, 2500);
      channel.subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        try {
          await channel.track({
            userId: chat.me,
            name: chat.meName || "נציג",
            role: roleLabel(state.profile && state.profile.role),
            onlineAt: new Date().toISOString(),
            updatedAt: Date.now()
          });
        } catch (_err) {}
        finish();
      });
    });
    chatApplyPresence();
  }

  async function openChat() {
    paintChatBadge(0);
    show("chat");
    const body = $("chatBody");
    if (body) body.innerHTML = '<div class="empty">טוען…</div>';
    const live = $("chatLive");
    if (live) live.textContent = "מתחבר";
    chat.peer = null;
    chat.query = "";
    const query = $("chatUserQuery");
    if (query) query.value = "";
    setChatFind(true);
    try {
      await resolveChatMe();
      markChatSeen();
      paintChatBadge(0);
      try { await sb.rpc("gi_chat_cleanup"); } catch (_err) {}
      await loadChatUsers();
      await connectChatPresence();
      listenChat();
      if (chat.timer) window.clearInterval(chat.timer);
      chat.timer = window.setInterval(() => { if (chat.peer) void loadChatMessages(); }, 8000);
    } catch (_err) {
      if (body) body.innerHTML = '<div class="empty">לא ניתן לפתוח את הצאט</div>';
    }
  }

  function openChatPeer(id) {
    const user = chat.users.find((item) => item.id === id);
    if (!user) return;
    chat.peer = user;
    chat.messages = [];
    paintChatThread();
    const input = $("chatInput");
    if (input) input.value = "";
    void loadChatMessages();
  }

  async function sendChat() {
    const input = $("chatInput");
    const text = trim(input && input.value);
    if (!text || !chat.peer || !chat.me) return;
    const button = $("chatSend");
    setBusy(button, true);
    try {
      const res = await sb.from("gi_chat_messages").insert({
        conversation_id: chatConvo(chat.peer.id),
        sender_id: chat.me,
        sender_name: chat.meName || "נציג",
        recipient_id: chat.peer.id,
        recipient_name: chat.peer.name || "נציג",
        body: text,
        expires_at: chatMidnight()
      }).select("id,conversation_id,sender_id,sender_name,recipient_id,recipient_name,body,created_at,expires_at").single();
      if (res.error) throw new Error(res.error.message || "send");
      if (input) input.value = "";
      if (res.data) chat.messages.push(res.data);
      paintChatThread();
    } catch (_err) {
      const live = $("chatLive");
      if (live) live.textContent = "השליחה נכשלה";
    } finally {
      setBusy(button, false);
    }
  }

  /* GI-CAR-START */
  function carTrim(value) {
    return String(value == null ? "" : value).trim();
  }

  function carDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function carIdKey(value) {
    const digits = carDigits(value).slice(0, 9);
    return digits ? digits.padStart(9, "0") : "";
  }

  function carIsraeliIdOk(value) {
    const raw = carDigits(value);
    if (raw.length !== 9) return false;
    let sum = 0;
    for (let i = 0; i < 9; i += 1) {
      let num = Number(raw[i]) * ((i % 2) + 1);
      if (num > 9) num -= 9;
      sum += num;
    }
    return sum % 10 === 0;
  }

  function carIso(value) {
    const raw = carTrim(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const dmy = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (!dmy) return "";
    return dmy[3] + "-" + dmy[2].padStart(2, "0") + "-" + dmy[1].padStart(2, "0");
  }

  function carDateOk(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(carIso(value));
  }

  function carGender(value) {
    const raw = carTrim(value);
    if (raw === "זכר" || raw === "male" || raw === "m") return "male";
    if (raw === "נקבה" || raw === "female" || raw === "f") return "female";
    return "";
  }

  function carYearOk(value) {
    const year = carDigits(value).slice(0, 4);
    if (year.length !== 4) return false;
    const n = Number(year);
    return n >= 1950 && n <= new Date().getFullYear();
  }

  function carBlank() {
    return {
      firstName: "", lastName: "", idNumber: "", gender: "", birthDate: "", idIssueDate: "",
      licenseIssueDate: "", phone: "", email: "", street: "", houseNumber: "", apartment: "",
      city: "", zip: "", licensePlate: "", vehicleYear: "", vehicleType: "", leviYitzhakModel: "",
      vehicleModelCode: "", elementaryGovCard: null, elementaryGovSource: "", _elemPlateLoadedFor: "",
      _elemLastGovRawRecord: null, vehicleLien: {
        status: "", isCompany: false, companyName: "", companyAddress: "", companyId: "",
        encName: "", encBranch: "", encAddress: ""
      },
      elementaryInsuranceHistory: { claimsCount: "" },
      coverageType: "", requestedCoverageType: "", driverPolicyMode: "", driverAnyEnabled: false,
      driverMinAge: "", driverMinExperienceYears: "", namedDrivers: []
    };
  }

  function carNamedBlank() {
    return { firstName: "", lastName: "", idNumber: "", birthDate: "", licenseYear: "" };
  }

  function carHealthFlag(payload) {
    const box = payload && typeof payload === "object" ? payload : {};
    if (carTrim(box.flowType) === "health") return true;
    if (Array.isArray(box.newPolicies) && box.newPolicies.length) return true;
    const operational = box.operational && typeof box.operational === "object" ? box.operational : {};
    return Array.isArray(operational.newPolicies) && operational.newPolicies.length > 0;
  }

  function carPrefill(data, row) {
    const payload = row && row.payload && typeof row.payload === "object" ? row.payload : {};
    const insureds = Array.isArray(payload.insureds) ? payload.insureds : [];
    const source = insureds[0] && insureds[0].data && typeof insureds[0].data === "object"
      ? insureds[0].data
      : (payload.primary && typeof payload.primary === "object" ? payload.primary : {});
    ["firstName", "lastName", "phone", "email", "street", "houseNumber", "apartment", "city", "zip"].forEach((key) => {
      if (carTrim(source[key])) data[key] = carTrim(source[key]);
    });
    if (carTrim(source.idNumber)) data.idNumber = carDigits(source.idNumber).slice(0, 9);
    if (carGender(source.gender)) data.gender = carGender(source.gender);
    if (carIso(source.birthDate)) data.birthDate = carIso(source.birthDate);
    if (carIso(source.idIssueDate)) data.idIssueDate = carIso(source.idIssueDate);
    if (carDigits(source.licenseIssueDate).length >= 4) data.licenseIssueDate = carDigits(source.licenseIssueDate).slice(0, 4);
    if (!data.firstName && !data.lastName && carTrim(row && row.full_name)) {
      const parts = carTrim(row.full_name).split(/\s+/);
      data.firstName = parts[0] || "";
      data.lastName = parts.slice(1).join(" ");
    }
    if (!data.idNumber) data.idNumber = carDigits(row && row.id_number).slice(0, 9);
    if (!data.phone) data.phone = carTrim(row && row.phone);
    if (!data.email) data.email = carTrim(row && row.email);
    if (!data.city) data.city = carTrim(row && row.city);
  }

  function carGovCard(rec) {
    if (!rec || typeof rec !== "object") return null;
    const manufacturer = carTrim(rec.tozeret_nm);
    const commercial = carTrim(rec.kinuy_mishari || rec.kinuy_mishari_clean);
    const modelTxt = carTrim(rec.degem_nm || rec.sug_degem);
    const year = rec.shnat_yitzur != null ? carTrim(String(rec.shnat_yitzur)) : "";
    const color = carTrim(rec.tzeva_rechev);
    const vehicleCategory = carTrim(rec.sug_rechev_nm || rec.sug_rishuy_nm || "");
    const govModelCode = carTrim(rec.degem_cd || rec.degem_nm_cd);
    const label = [manufacturer, commercial, modelTxt, year ? "שנת " + year : "", color].filter(Boolean).join(" · ");
    if (!label && !govModelCode) return null;
    return { manufacturer: manufacturer, commercial: commercial, modelTxt: modelTxt, year: year, color: color, vehicleCategory: vehicleCategory, govModelCode: govModelCode, label: label };
  }

  function carApplyGov(data, body, plate) {
    const digits = carDigits(plate).slice(0, 8);
    const records = (Array.isArray(body && body.records) ? body.records : []).filter((row) => carDigits(row && row.mispar_rechev) === digits);
    data._elemPlateLoadedFor = digits;
    data.elementaryGovSource = carTrim(body && body.source);
    if (!records.length) {
      data.elementaryGovCard = null;
      data.leviYitzhakModel = "";
      data.vehicleModelCode = "";
      data.vehicleYear = "";
      data.vehicleType = "";
      data._elemLastGovRawRecord = null;
      return { found: false };
    }
    const card = carGovCard(records[0]);
    data._elemLastGovRawRecord = records[0];
    data.elementaryGovCard = card;
    data.leviYitzhakModel = card && card.label || "";
    data.vehicleModelCode = card && card.govModelCode || "";
    data.vehicleYear = card && card.year || "";
    data.vehicleType = card && card.vehicleCategory || "";
    data.elementaryGovSource = data.elementaryGovSource || "active";
    return { found: !!card };
  }

  function carApplyGovMiss(data, plate) {
    data._elemPlateLoadedFor = carDigits(plate).slice(0, 8);
    data.elementaryGovCard = null;
    data.leviYitzhakModel = "";
    data.vehicleModelCode = "";
    data.elementaryGovSource = "error";
    data._elemLastGovRawRecord = null;
  }

  function carPendingReferral(list, idNumber) {
    const id = carIdKey(idNumber);
    if (!id) return false;
    return (Array.isArray(list) ? list : []).some((row) => {
      const status = String(row && row.status || "").toLowerCase();
      if (status && status !== "pending") return false;
      return carIdKey(row && row.idNumber) === id;
    });
  }

  function carStepError(data, step) {
    const row = data || {};
    if (step === "personal") {
      if (!carTrim(row.firstName)) return "חסר שם פרטי";
      if (!carTrim(row.lastName)) return "חסר שם משפחה";
      if (!carIsraeliIdOk(row.idNumber)) return "תעודת הזהות אינה תקינה";
      if (row.gender !== "male" && row.gender !== "female") return "יש לבחור מין";
      if (!carDateOk(row.birthDate)) return "חסר תאריך לידה";
      if (!carDateOk(row.idIssueDate)) return "חסר תאריך הנפקת תעודת זהות";
      if (!carYearOk(row.licenseIssueDate)) return "שנת הוצאת הרישיון צריכה להיות 4 ספרות";
      if (carDigits(row.phone).length < 9) return "חסר טלפון";
      if (!carTrim(row.street)) return "חסר רחוב";
      if (!carTrim(row.houseNumber)) return "חסר מספר בית";
      if (!carTrim(row.city)) return "חסר יישוב";
      if (!carTrim(row.zip)) return "חסר מיקוד";
      return "";
    }
    if (step === "vehicle") {
      const plate = carDigits(row.licensePlate).slice(0, 8);
      if (plate.length < 7) return "מספר רישוי תקף הוא 7 או 8 ספרות";
      if (carDigits(row._elemPlateLoadedFor) !== plate) return "יש לשלוף את פרטי הרכב לפני ההמשך";
      const lien = row.vehicleLien || {};
      if (lien.status !== "none" && lien.status !== "exists") return "יש לציין האם קיים שיעבוד לרכב";
      if (lien.status === "exists" && lien.isCompany) {
        if (!carTrim(lien.companyName) || !carTrim(lien.companyAddress) || !carTrim(lien.companyId)) return "יש למלא שם חברה, כתובת וח.פ";
      }
      if (lien.status === "exists" && !lien.isCompany) {
        if (!carTrim(lien.encName) || !carTrim(lien.encBranch) || !carTrim(lien.encAddress)) return "יש למלא שם משעבד, סניף וכתובת";
      }
      return "";
    }
    if (step === "history") {
      const count = Number((row.elementaryInsuranceHistory && row.elementaryInsuranceHistory.claimsCount) || 0);
      if (!Number.isFinite(count) || count < 0) return "יש להזין מספר תביעות";
      if (count > 3) return "לא ניתן לבטח מבוטח זה — אנא פנה לחיתום";
      return "";
    }
    if (step === "coverage") {
      const covers = ["third", "comprehensive", "mandatory_third", "mandatory_comprehensive"];
      if (covers.indexOf(row.coverageType) < 0) return "יש לבחור סוג כיסוי";
      if (row.driverPolicyMode === "any") {
        const age = Number(carDigits(row.driverMinAge));
        const exp = Number(carDigits(row.driverMinExperienceYears));
        if (!Number.isFinite(age) || age < 17 || age > 99) return "יש להזין גיל מינימלי תקף (17–99)";
        if (!Number.isFinite(exp) || exp < 0 || exp > 80 || carTrim(row.driverMinExperienceYears) === "") return "יש להזין ותק נהיגה מינימלי תקף (0–80 שנים)";
        return "";
      }
      if (row.driverPolicyMode !== "named") return "יש לבחור סוג הגדרת נהגים";
      const named = Array.isArray(row.namedDrivers) ? row.namedDrivers[0] : null;
      if (!named || !carTrim(named.firstName) || !carTrim(named.lastName)) return "יש להוסיף נהג נקוב";
      if (!carIsraeliIdOk(named.idNumber)) return "תעודת הזהות של הנהג הנקוב אינה תקינה";
      if (!carDateOk(named.birthDate)) return "חסר תאריך לידה לנהג הנקוב";
      if (!carYearOk(named.licenseYear)) return "שנת הרישיון של הנהג הנקוב אינה תקינה";
      return "";
    }
    return "";
  }
  /* GI-CAR-END */

  const CAR_STEPS = [
    { id: "personal", title: "פרטים אישיים" },
    { id: "vehicle", title: "פרטי רכב" },
    { id: "history", title: "עבר ביטוחי" },
    { id: "coverage", title: "בחירת כיסוי" }
  ];
  let car = null;

  /* GI-CAR-UI-START */
  function carField(label, key, value, extra) {
    const id = "car_" + key.replace(/\./g, "_");
    return '<label class="field" for="' + id + '">' + esc(label) + "</label>"
      + '<input class="input" id="' + id + '" data-k="' + esc(key) + '" value="' + esc(value) + '" ' + (extra || "") + "/>";
  }

  function carChips(kind, options, current) {
    return '<div class="offerChips">' + options.map((item) => {
      return '<button class="offerChip' + (item.key === current ? " is-on" : "") + '" type="button" data-car="' + kind + '" data-val="' + esc(item.key) + '">' + esc(item.label) + "</button>";
    }).join("") + "</div>";
  }

  function carWrite(key, value) {
    if (!car) return;
    if (key.indexOf("named.") === 0) {
      if (!car.data.namedDrivers[0]) car.data.namedDrivers[0] = carNamedBlank();
      car.data.namedDrivers[0][key.slice(6)] = value;
      return;
    }
    if (key.indexOf("lien.") === 0) {
      car.data.vehicleLien[key.slice(5)] = value;
      return;
    }
    const dot = key.indexOf(".");
    if (dot > 0) {
      const head = key.slice(0, dot);
      if (!car.data[head] || typeof car.data[head] !== "object") car.data[head] = {};
      car.data[head][key.slice(dot + 1)] = value;
      return;
    }
    car.data[key] = value;
    if (key === "licensePlate") {
      const digits = carDigits(value).slice(0, 8);
      car.data.licensePlate = digits;
      if (carDigits(car.data._elemPlateLoadedFor) !== digits) {
        car.data._elemPlateLoadedFor = "";
        car.data.elementaryGovCard = null;
        car.plateNote = "";
      }
    }
  }

  function carChrome() {
    const prev = $("carPrev");
    const next = $("carNext");
    const count = $("carCount");
    const title = $("carTitle");
    if (!car || !prev || !next || !count || !title) return;
    if (car.phase === "id") {
      title.textContent = "רכב בקליק";
      count.textContent = "";
      prev.hidden = true;
      next.textContent = "המשך לאשף";
    } else if (car.phase === "done") {
      title.textContent = "רכב בקליק";
      count.textContent = "";
      prev.hidden = true;
      next.textContent = "חזרה לראשי";
    } else {
      title.textContent = CAR_STEPS[car.step].title;
      count.textContent = (car.step + 1) + "/4";
      prev.hidden = false;
      next.textContent = car.step === 3 ? "הגש הצעה לחיתום" : "המשך";
    }
    next.disabled = !!car.busy;
  }

  function carPaint() {
    const body = $("carBody");
    const note = $("carError");
    if (!body || !car) return;
    if (note && car.phase !== "done") note.textContent = "";
    if (car.phase === "id") {
      body.innerHTML = '<article class="offerCard"><h2>תעודת זהות</h2><p class="offerHint">מזינים תעודת זהות. אם יש תיק שהנציג רשאי לראות, הפרטים ייטענו לאשף. אם אין, האשף נפתח עם התעודה הזו.</p>'
        + carField("תעודת זהות", "gateId", car.idNumber, 'inputmode="numeric" maxlength="9" dir="ltr" autocomplete="off"')
        + "</article>";
      const gate = $("car_gateId");
      if (gate) gate.id = "carId";
    } else if (car.phase === "done") {
      body.innerHTML = '<article class="offerCard"><h2>ההצעה הוגשה לחיתום</h2><p class="offerHint">ההפניה נשמרה ונשלחה לצוות האלמנטרי. לא נפתח תיק לקוח.</p></article>';
    } else {
      const data = car.data;
      const rail = '<div class="offerRail">' + CAR_STEPS.map((step, index) => {
        return '<i class="' + (index === car.step ? "is-on" : index < car.step ? "is-done" : "") + '"></i>';
      }).join("") + "</div>";
      let inner = "";
      if (car.step === 0) {
        inner = carField("שם פרטי", "firstName", data.firstName, 'autocomplete="given-name"')
          + carField("שם משפחה", "lastName", data.lastName, 'autocomplete="family-name"')
          + carField("תעודת זהות", "idNumber", data.idNumber, 'inputmode="numeric" maxlength="9" dir="ltr" readonly')
          + '<p class="field">מין</p>' + carChips("gender", [{ key: "male", label: "זכר" }, { key: "female", label: "נקבה" }], data.gender)
          + carField("תאריך לידה", "birthDate", data.birthDate, 'type="date"')
          + carField("תאריך הנפקת תעודת זהות", "idIssueDate", data.idIssueDate, 'type="date"')
          + carField("שנת הוצאת רישיון", "licenseIssueDate", data.licenseIssueDate, 'inputmode="numeric" maxlength="4" dir="ltr"')
          + carField("טלפון", "phone", data.phone, 'type="tel" inputmode="tel" dir="ltr"')
          + carField("אימייל", "email", data.email, 'type="email" inputmode="email" dir="ltr"')
          + carField("רחוב", "street", data.street, "")
          + carField("מספר בית", "houseNumber", data.houseNumber, 'dir="ltr"')
          + carField("דירה", "apartment", data.apartment, "")
          + carField("יישוב", "city", data.city, "")
          + carField("מיקוד", "zip", data.zip, 'inputmode="numeric" dir="ltr"');
      } else if (car.step === 1) {
        const card = data.elementaryGovCard;
        const shown = card && card.label ? '<p class="carVehicle">' + esc(card.label) + "</p>" : "";
        const lien = data.vehicleLien || {};
        inner = carField("מספר רישוי", "licensePlate", data.licensePlate, 'inputmode="numeric" maxlength="8" dir="ltr"')
          + '<button class="assignBtn" type="button" data-car="lookup">שליפת רכב</button>'
          + (car.plateNote ? '<p class="carNote">' + esc(car.plateNote) + "</p>" : "")
          + shown
          + '<p class="field">שיעבוד על הרכב</p>' + carChips("lien", [{ key: "none", label: "אין שיעבוד" }, { key: "exists", label: "יש שיעבוד" }], lien.status);
        if (lien.status === "exists") {
          inner += '<p class="field">המשעבד</p>' + carChips("lienCompany", [{ key: "0", label: "אדם" }, { key: "1", label: "חברה" }], lien.isCompany ? "1" : "0");
          if (lien.isCompany) {
            inner += carField("שם חברה", "lien.companyName", lien.companyName, "")
              + carField("כתובת", "lien.companyAddress", lien.companyAddress, "")
              + carField("ח.פ", "lien.companyId", lien.companyId, 'dir="ltr"');
          } else {
            inner += carField("שם משעבד", "lien.encName", lien.encName, "")
              + carField("סניף", "lien.encBranch", lien.encBranch, "")
              + carField("כתובת", "lien.encAddress", lien.encAddress, "");
          }
        }
      } else if (car.step === 2) {
        const count = data.elementaryInsuranceHistory && data.elementaryInsuranceHistory.claimsCount || "";
        inner = '<p class="offerHint">מספר תביעות בשלוש השנים האחרונות. מעל 3 לא ניתן להגיש מהאשף.</p>'
          + carField("מספר תביעות", "elementaryInsuranceHistory.claimsCount", count, 'inputmode="numeric" maxlength="2" dir="ltr"');
      } else {
        const named = data.namedDrivers[0] || carNamedBlank();
        inner = '<p class="field">סוג כיסוי</p>' + carChips("coverage", [
          { key: "third", label: "צד ג׳" },
          { key: "comprehensive", label: "מקיף" },
          { key: "mandatory_third", label: "חובה + צד ג׳" },
          { key: "mandatory_comprehensive", label: "חובה + מקיף" }
        ], data.coverageType)
          + '<p class="field">נהגים</p>' + carChips("driver", [{ key: "any", label: "כל נהג מעל גיל" }, { key: "named", label: "נהגים נקובים" }], data.driverPolicyMode);
        if (data.driverPolicyMode === "any") {
          inner += carField("גיל מינימלי", "driverMinAge", data.driverMinAge, 'inputmode="numeric" maxlength="2" dir="ltr"')
            + carField("ותק נהיגה מינימלי", "driverMinExperienceYears", data.driverMinExperienceYears, 'inputmode="numeric" maxlength="2" dir="ltr"');
        } else if (data.driverPolicyMode === "named") {
          inner += '<button class="assignBtn" type="button" data-car="copyDriver">המבוטח הוא הנהג</button>'
            + carField("שם פרטי", "named.firstName", named.firstName, "")
            + carField("שם משפחה", "named.lastName", named.lastName, "")
            + carField("תעודת זהות", "named.idNumber", named.idNumber, 'inputmode="numeric" maxlength="9" dir="ltr"')
            + carField("תאריך לידה", "named.birthDate", named.birthDate, 'type="date"')
            + carField("שנת רישיון", "named.licenseYear", named.licenseYear, 'inputmode="numeric" maxlength="4" dir="ltr"');
        }
      }
      body.innerHTML = rail + '<article class="offerCard"><h2>' + esc(CAR_STEPS[car.step].title) + "</h2>"
        + (car.hint ? '<p class="offerHint">' + esc(car.hint) + "</p>" : "") + inner + "</article>";
    }
    carChrome();
    const sheet = body;
    if (sheet) sheet.scrollTop = 0;
  }

  async function carFindCustomer(id) {
    const bare = id.replace(/^0+/, "");
    const keys = bare && bare !== id ? [id, bare] : [id];
    const res = await sb.from("customers")
      .select("id,full_name,id_number,phone,email,city,agent_id,is_archived,payload")
      .in("id_number", keys)
      .limit(8);
    if (res.error) throw new Error(res.error.message || "customer");
    const rows = (res.data || []).filter((row) => row.is_archived !== true && carIdKey(row.id_number) === carIdKey(id));
    for (let i = 0; i < rows.length; i += 1) {
      const guard = await offerGuard(rows[i]);
      if (guard.ok) return rows[i];
    }
    return null;
  }

  async function carStart() {
    const id = carDigits(car.idNumber).slice(0, 9);
    const note = $("carError");
    if (!carIsraeliIdOk(id)) {
      if (note) note.textContent = "נא להזין תעודת זהות ישראלית תקינה (9 ספרות).";
      return;
    }
    car.busy = true;
    carChrome();
    if (note) note.textContent = "";
    try {
      const found = await carFindCustomer(id);
      car.data = carBlank();
      car.data.idNumber = id;
      car.customerId = "";
      car.health = false;
      car.step = 0;
      car.hint = "לא נמצא לקוח — מלאו את שלבי האשף עד בחירת כיסוי, ואז הגישו לחיתום.";
      if (found) {
        carPrefill(car.data, found);
        car.data.idNumber = id;
        car.customerId = carTrim(found.id);
        car.health = carHealthFlag(found.payload);
        const name = carTrim(found.full_name) || "הלקוח";
        car.hint = "פרטי " + name + " נטענו — מלאו את שלבי האשף עד בחירת כיסוי, ואז הגישו לחיתום.";
        if (!carStepError(car.data, "personal")) car.step = 1;
      }
      car.phase = "wizard";
      car.plateNote = "";
      carPaint();
    } catch (_err) {
      if (note) note.textContent = "לא ניתן לאתר את הלקוח כרגע";
    } finally {
      car.busy = false;
      carChrome();
    }
  }

  async function carLookupPlate() {
    if (!car || car.busy) return;
    const digits = carDigits(car.data.licensePlate).slice(0, 8);
    const note = $("carError");
    if (digits.length < 7) {
      if (note) note.textContent = "מספר רישוי תקף הוא 7 או 8 ספרות";
      return;
    }
    car.busy = true;
    car.plateNote = "שולף פרטי רכב…";
    if (note) note.textContent = "";
    carPaint();
    try {
      const res = await fetch(SUPABASE_URL + "/functions/v1/gi-gov-vehicle?plate=" + encodeURIComponent(digits), {
        headers: { Accept: "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
        signal: AbortSignal.timeout(12000)
      });
      const body = await res.json().catch(() => ({}));
      if (!car) return;
      if (!res.ok) {
        carApplyGovMiss(car.data, digits);
        car.plateNote = carTrim(body.error) || "לא ניתן לשלוף מהמאגר כרגע — ניתן להמשיך אחרי סימון שיעבוד";
      } else {
        const applied = carApplyGov(car.data, body, digits);
        car.plateNote = applied.found ? "נתוני הרכב נשלפו" : "הרכב לא נמצא במאגר — ניתן להמשיך אחרי סימון שיעבוד";
      }
    } catch (_err) {
      if (car) {
        carApplyGovMiss(car.data, digits);
        car.plateNote = "לא ניתן לשלוף מהמאגר כרגע — ניתן להמשיך אחרי סימון שיעבוד";
      }
    } finally {
      if (car) {
        car.busy = false;
        carPaint();
      }
    }
  }

  async function carSaveReferral(referral) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const read = await sb.from("app_meta").select("payload,updated_at").eq("key", "global").maybeSingle();
      if (read.error || !read.data) throw new Error((read.error && read.error.message) || "meta");
      const payload = read.data.payload && typeof read.data.payload === "object" ? read.data.payload : {};
      const list = Array.isArray(payload.elementaryReferrals) ? payload.elementaryReferrals : [];
      if (carPendingReferral(list, referral.idNumber)) return { ok: false, duplicate: true };
      const next = Object.assign({}, payload);
      next.elementaryReferrals = [referral].concat(list);
      next.updatedAt = new Date().toISOString();
      let query = sb.from("app_meta").update({ payload: next, updated_at: next.updatedAt }).eq("key", "global");
      if (read.data.updated_at) query = query.eq("updated_at", read.data.updated_at);
      const write = await query.select("key");
      if (write.error) throw new Error(write.error.message || "meta");
      if (write.data && write.data.length) return { ok: true };
    }
    return { ok: false, error: "השמירה התנגשה עם עדכון אחר. נסו שוב." };
  }

  async function carFinish() {
    if (!car || car.busy) return;
    const note = $("carError");
    for (let i = 0; i < CAR_STEPS.length; i += 1) {
      const error = carStepError(car.data, CAR_STEPS[i].id);
      if (error) {
        car.step = i;
        carPaint();
        if (note) note.textContent = error;
        return;
      }
    }
    const profile = state.profile || {};
    const now = new Date().toISOString();
    const data = JSON.parse(JSON.stringify(car.data));
    if (!carTrim(data.elementaryInsuranceHistory.claimsCount)) data.elementaryInsuranceHistory.claimsCount = "0";
    data.requestedCoverageType = data.coverageType;
    data.driverAnyEnabled = data.driverPolicyMode === "any";
    const fullName = carTrim((data.firstName || "") + " " + (data.lastName || "")) || "לקוח ללא שם";
    const referralId = "elemref_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2, 8);
    const proposalId = car.proposalId || ("prop_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2, 8));
    const formPayload = {
      flowType: "elementary",
      elementaryProduct: "vehicle",
      currentStep: 5,
      primary: data,
      insureds: [{ id: "elem_phone", type: "primary", label: "מבוטח ראשי", data: data }],
      elementaryReferralMeta: {
        continueFromStep: 5,
        submittedAtStep: 4,
        sourceFlow: "carInsuranceClick",
        requestedCoverageType: data.coverageType,
        deferCustomerUntilAgentSetup: true,
        fromExistingHealthCustomer: !!car.health,
        linkedCustomerId: car.customerId || "",
        referralId: referralId
      }
    };
    const referral = {
      id: referralId,
      status: "pending",
      customerId: "",
      fullName: fullName,
      idNumber: carDigits(data.idNumber).slice(0, 9),
      phone: carTrim(data.phone),
      city: carTrim(data.city),
      agentName: carTrim(profile.name),
      agentId: carTrim(profile.id),
      elementaryProduct: "vehicle",
      submittedAt: now,
      updatedAt: now,
      continueFromStep: 5,
      sourceFlow: "carInsuranceClick",
      requestedCoverageType: data.coverageType,
      agentTrackStatus: "waiting_elementary",
      payload: formPayload
    };
    car.busy = true;
    car.proposalId = proposalId;
    setBusy($("carNext"), true);
    if (note) note.textContent = "";
    try {
      const saved = await carSaveReferral(referral);
      if (saved.duplicate) {
        if (note) note.textContent = "כבר הוגשה הפניה ממתינה לחיתום עבור תעודת זהות זו.";
        return;
      }
      if (!saved.ok) throw new Error(saved.error || "meta");
      const proposalRow = {
        id: proposalId,
        status: "הוגשה לחיתום",
        full_name: fullName,
        id_number: referral.idNumber,
        phone: referral.phone,
        email: carTrim(data.email),
        city: referral.city,
        agent_name: referral.agentName,
        agent_id: referral.agentId,
        agent_role: carTrim(profile.role),
        current_step: 4,
        insured_count: 1,
        created_at: now,
        updated_at: now,
        payload: formPayload
      };
      const proposalSave = await sb.from("proposals").upsert(proposalRow, { onConflict: "id" });
      if (proposalSave.error) {
        const sent = new Error("ההפניה נשלחה לחיתום. שמירת ההצעה לא הושלמה — אין לשלוח שוב.");
        sent.sent = true;
        throw sent;
      }
      try {
        await sb.from("gi_elementary_referrals").insert({
          id: referral.id,
          agent_id: referral.agentId || null,
          customer_id: null,
          status: "pending",
          created_at: now,
          updated_at: now,
          payload: referral
        });
      } catch (_table) { /* the elementary queue reads app_meta */ }
      car.phase = "done";
      carPaint();
    } catch (err) {
      if (err && err.sent) {
        car.phase = "done";
        carPaint();
      }
      if (note) note.textContent = err && err.sent ? err.message : ("השליחה לחיתום לא הושלמה: " + ((err && err.message) || ""));
    } finally {
      car.busy = false;
      setBusy($("carNext"), false);
      carChrome();
    }
  }
  /* GI-CAR-UI-END */

  function openCar() {
    car = { phase: "id", step: 0, busy: false, idNumber: "", customerId: "", health: false, hint: "", plateNote: "", proposalId: "", data: carBlank() };
    show("car");
    carPaint();
  }

  function carOnInput(event) {
    const el = event.target;
    if (!car || !el) return;
    if (el.id === "carId") {
      car.idNumber = carDigits(el.value).slice(0, 9);
      if (el.value !== car.idNumber) el.value = car.idNumber;
      return;
    }
    const key = el.getAttribute("data-k");
    if (!key) return;
    carWrite(key, el.value);
    if (key === "licensePlate" && el.value !== car.data.licensePlate) el.value = car.data.licensePlate;
  }

  function carOnClick(event) {
    const button = event.target.closest("[data-car]");
    if (!button || !car) return;
    const kind = button.getAttribute("data-car");
    const val = button.getAttribute("data-val") || "";
    if (kind === "lookup") {
      void carLookupPlate();
      return;
    }
    if (kind === "gender") car.data.gender = val;
    if (kind === "coverage") car.data.coverageType = val;
    if (kind === "lien") car.data.vehicleLien.status = val;
    if (kind === "lienCompany") car.data.vehicleLien.isCompany = val === "1";
    if (kind === "driver") {
      car.data.driverPolicyMode = val;
      car.data.driverAnyEnabled = val === "any";
      if (val === "any") car.data.namedDrivers = [];
      if (val === "named") {
        car.data.driverMinAge = "";
        car.data.driverMinExperienceYears = "";
        if (!car.data.namedDrivers[0]) car.data.namedDrivers[0] = carNamedBlank();
      }
    }
    if (kind === "copyDriver") {
      const named = carNamedBlank();
      named.firstName = car.data.firstName;
      named.lastName = car.data.lastName;
      named.idNumber = car.data.idNumber;
      named.birthDate = car.data.birthDate;
      named.licenseYear = carDigits(car.data.licenseIssueDate).slice(0, 4);
      car.data.namedDrivers = [named];
    }
    carPaint();
  }

  document.querySelectorAll("[data-more]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-more");
      setMenu(false);
      if (key === "profile") openProfile();
      if (key === "sales") void openSales();
      if (key === "activity") void openActivity();
      if (key === "notice") openNotice();
      if (key === "reports") show("reports");
      if (key === "simulators") openSim();
      if (key === "car") openCar();
    });
  });
  $("btnSalesBack").addEventListener("click", () => show("home"));
  $("btnActivityBack").addEventListener("click", () => show("home"));
  $("btnLeadsBack").addEventListener("click", () => show("home"));
  $("btnLeadBack").addEventListener("click", () => { void openLeadsDay(); });
  $("btnNoticeBack").addEventListener("click", () => show("home"));
  $("btnAlertsBack").addEventListener("click", () => show("home"));
  $("btnReminderBack").addEventListener("click", () => {
    if (state.composeReturn === "meetings") {
      state.composeReturn = "";
      void openMeetings();
      return;
    }
    void openTasks();
  });
  $("btnReportBack").addEventListener("click", () => show("reports"));
  $("btnCancelBack").addEventListener("click", () => show("reports"));
  $("btnAppointBack").addEventListener("click", () => show("reports"));
  document.querySelectorAll("[data-hub]").forEach((button) => {
    button.addEventListener("click", () => { void openHubReport(button.getAttribute("data-hub")); });
  });
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.disabled) return;
      const key = tab.getAttribute("data-tab");
      if (key === "home") show("home");
      if (key === "customers") void openCustomers(false);
      if (key === "leads") void openLeadsDay();
      if (key === "tasks") void openTasks();
      if (key === "meetings") void openMeetings();
    });
  });
  $("btnBell").addEventListener("click", () => { void openAlerts(); });
  $("btnChat").addEventListener("click", () => { void openChat(); });
  $("btnAddCustomer").addEventListener("click", openOffer);
  if ($("btnNewCustomer")) $("btnNewCustomer").addEventListener("click", openOffer);
  $("btnOfferBack").addEventListener("click", () => {
    if (offer && offer.step > 0) {
      offer.step -= 1;
      offerPaint();
      return;
    }
    show("home");
  });
  $("offerPrev").addEventListener("click", () => {
    if (!offer || offer.step < 1) return;
    offer.step -= 1;
    offerPaint();
  });
  $("offerNext").addEventListener("click", () => {
    if (!offer || offer.busy) return;
    const error = offerValidate(OFFER_STEPS[offer.step].id);
    const note = $("offerError");
    if (error) {
      if (note) note.textContent = error;
      return;
    }
    if (offer.step < OFFER_STEPS.length - 1) {
      const leftId = OFFER_STEPS[offer.step].id;
      offer.step += 1;
      offerPaint();
      void publishReview(leftId);
      return;
    }
    void offerFinish();
  });
  $("offerBody").addEventListener("input", offerOnInput);
  $("offerBody").addEventListener("change", (event) => {
    const el = event.target;
    if (!el || !offer) return;
    if (el.type === "checkbox" || el.hasAttribute("data-render")) {
      const key = el.getAttribute("data-k");
      if (key) offerWrite(key, el.type === "checkbox" ? el.checked : el.value);
      offerPaint();
    }
  });
  $("offerBody").addEventListener("click", offerOnClick);
  $("btnCarBack").addEventListener("click", () => {
    if (!car || car.phase === "id" || car.phase === "done") {
      show("home");
      return;
    }
    if (car.step > 0) {
      car.step -= 1;
      carPaint();
      return;
    }
    car.phase = "id";
    carPaint();
  });
  $("carPrev").addEventListener("click", () => {
    if (!car || car.phase !== "wizard") return;
    if (car.step > 0) car.step -= 1;
    else car.phase = "id";
    carPaint();
  });
  $("carNext").addEventListener("click", () => {
    if (!car || car.busy) return;
    if (car.phase === "done") {
      show("home");
      return;
    }
    if (car.phase === "id") {
      void carStart();
      return;
    }
    const error = carStepError(car.data, CAR_STEPS[car.step].id);
    const note = $("carError");
    if (error) {
      if (note) note.textContent = error;
      return;
    }
    if (car.step < CAR_STEPS.length - 1) {
      car.step += 1;
      carPaint();
      return;
    }
    void carFinish();
  });
  $("carBody").addEventListener("input", carOnInput);
  $("carBody").addEventListener("click", carOnClick);
  $("btnNewBack").addEventListener("click", () => { void openCustomers(false); });
  $("btnCancelCustomer").addEventListener("click", () => { void openCustomers(false); });
  $("newCustForm").addEventListener("submit", (event) => {
    event.preventDefault();
    openOffer();
  });
  $("homeSearch").addEventListener("change", () => {
    $("customerQuery").value = $("homeSearch").value;
    void openCustomers(false);
  });
  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-jump");
      if (key === "meetings") void openMeetings();
      if (key === "tasks") void openTasks();
      if (key === "leads") void openLeadsDay();
      if (key === "customers") void openCustomers(false);
    });
  });
  if ($("customerChips")) $("customerChips").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-cfilter]");
    if (!chip) return;
    state.custFilter = chip.getAttribute("data-cfilter") || "";
    $("customerChips").querySelectorAll(".chip").forEach((node) => node.classList.toggle("is-on", node === chip));
    void openCustomers(false);
  });
  $("btnChatBack").addEventListener("click", () => {
    if (chat.peer) {
      chat.peer = null;
      paintChatUsers();
      return;
    }
    show("home");
  });
  $("chatUserQuery").addEventListener("input", () => {
    chat.query = $("chatUserQuery").value;
    if (!chat.peer) paintChatUsers();
  });
  $("chatBody").addEventListener("click", (event) => {
    const user = event.target.closest("[data-chat-user]");
    if (!user) return;
    openChatPeer(user.getAttribute("data-chat-user") || "");
  });
  $("chatCompose").addEventListener("submit", (event) => {
    event.preventDefault();
    void sendChat();
  });
  ["chatInput", "chatUserQuery"].forEach((id) => {
    const field = $(id);
    if (!field) return;
    field.addEventListener("focus", () => { window.setTimeout(fitFrame, 60); });
    field.addEventListener("blur", () => { window.setTimeout(fitFrame, 60); });
  });
  $("meetBackdrop").addEventListener("click", () => { $("meetSheet").hidden = true; });
  $("meetFind").addEventListener("click", () => { void findMeetCustomer(); });
  $("meetSave").addEventListener("click", () => { void saveMeeting(); });
  $("taskList").addEventListener("click", (event) => {
    const done = event.target.closest("[data-done]");
    if (!done) return;
    void completeReminder(done.getAttribute("data-done")).then(() => { void openTasks(); });
  });
  $("meetCal").addEventListener("click", (event) => {
    const month = event.target.closest("[data-cal-month]");
    if (month) {
      state.meetMonth = shiftMonth(state.meetMonth || israelDateKey().slice(0, 7), Number(month.getAttribute("data-cal-month")));
      paintMeetings(state.meetRows || []);
      return;
    }
    const day = event.target.closest("[data-cal-day]");
    if (!day) return;
    const key = day.getAttribute("data-cal-day") || "";
    state.meetDay = key;
    state.meetMonth = key.slice(0, 7);
    state.composeReturn = "meetings";
    openMeetSheet();
  });
  function closeTaskAdd() {
    const menu = $("taskAddMenu");
    const backdrop = $("taskAddBackdrop");
    if (menu) menu.hidden = true;
    if (backdrop) backdrop.hidden = true;
    const button = $("btnTaskAdd");
    if (button) button.setAttribute("aria-expanded", "false");
  }
  function chooseCompose(event) {
    const pick = event.target.closest("[data-compose]");
    if (!pick) return;
    closeTaskAdd();
    state.composeReturn = "";
    openComposer(pick.getAttribute("data-compose"));
  }
  $("btnTaskAdd").addEventListener("click", () => {
    const menu = $("taskAddMenu");
    const backdrop = $("taskAddBackdrop");
    if (!menu) return;
    const open = menu.hidden;
    menu.hidden = !open;
    if (backdrop) backdrop.hidden = !open;
    $("btnTaskAdd").setAttribute("aria-expanded", open ? "true" : "false");
  });
  $("taskAddBackdrop").addEventListener("click", closeTaskAdd);
  $("taskAddMenu").addEventListener("click", chooseCompose);
  $("btnDocsBack").addEventListener("click", () => show("home"));
  $("docCats").addEventListener("click", (event) => {
    const cat = event.target.closest("[data-doc]");
    if (!cat) return;
    state.docCat = cat.getAttribute("data-doc") || "";
    paintDocuments();
  });
  $("customerQuery").addEventListener("input", () => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => { void openCustomers(false); }, 280);
  });
  ["reportSearch", "filterAgent", "filterStatus", "filterTeam", "filterPlan"].forEach((id) => {
    $(id).addEventListener("input", paintReport);
    $(id).addEventListener("change", paintReport);
  });

  $("ringDone").addEventListener("click", () => {
    const item = state.ringItem;
    closeRing();
    if (item && item.kind === "reminder") void completeReminder(item.id);
  });
  $("ringSnooze").addEventListener("click", () => {
    const item = state.ringItem;
    closeRing();
    if (item && item.kind === "reminder") void snoozeReminder(item.id);
  });
  $("ringOpen").addEventListener("click", () => {
    const item = state.ringItem;
    closeRing();
    if (item && item.kind === "lead" && item.leadId) {
      void openLead(item.leadId);
      return;
    }
    void openAlerts();
  });
  $("ringClose").addEventListener("click", closeRing);
  $("cancelBody").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-sheet]");
    if (!tab) return;
    state.cancelSheet = Number(tab.getAttribute("data-sheet")) || 0;
    state.cancelQuery = "";
    paintCancel(false);
  });
  $("cancelBody").addEventListener("input", (event) => {
    if (event.target.id !== "cancelSearch") return;
    state.cancelQuery = event.target.value;
    paintCancel(true);
  });
  $("appointBody").addEventListener("input", (event) => {
    if (event.target.id !== "appointSearch") return;
    state.appointQuery = event.target.value;
    paintAppoint(true);
  });
  document.addEventListener("pointerdown", () => {
    unlockAudio();
    askNotify();
  }, { passive: true });
  async function notifyHiddenSales() {
    if (!canCompose() || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      const seen = readAlertSeen();
      const fresh = (await loadAlertRows()).filter((item) => !alertAlreadySeen(seen, item.id)).slice(0, 4);
      fresh.forEach((item) => {
        const closed = String(item.id).indexOf("closed:") === 0;
        if (closed) systemNotify("ליד נסגר", [item.agent, trim(item.customer)].filter(Boolean).join(" · "), "onyx-closed-" + item.id);
        else systemNotify("מכירה חדשה", [item.agent, alertPremiumText(item), trim(item.customer)].filter(Boolean).join(" · "), "onyx-sale-" + item.id);
      });
      if (fresh.length) void rememberAlertIds(fresh.map((item) => item.id));
    } catch (_err) {}
  }

  async function shadeOpenItems() {
    if (!state.profile || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      const rows = state.myReminders || await loadRemindersShared();
      const now = Date.now();
      rows.forEach((row) => {
        const at = Date.parse(row.remind_at);
        const snooze = Date.parse(row.snoozed_until);
        const waiting = Number.isFinite(snooze) && snooze > now;
        if (!Number.isFinite(at) || at > now || waiting) return;
        systemNotify(reminderTitle(row), [trim(row.details), trim(row.customer_name)].filter(Boolean).join(" · "), "onyx-rem-" + row.id);
      });
    } catch (_err) {}
    if (!canCompose()) return;
    await notifyHiddenSales();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void shadeOpenItems();
      return;
    }
    if (!state.profile) return;
    void checkReminders();
    void pollAssignedLeads();
    if (canCompose()) void pollAlerts();
    const home = document.querySelector('[data-screen="home"]');
    if (home && !home.hidden) void refreshHomeMetrics();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      const data = event.data || {};
      if (data.type === "ping") {
        if (event.ports && event.ports[0]) event.ports[0].postMessage({ ok: true, visible: document.visibilityState === "visible" });
        return;
      }
      if (!state.profile) return;
      if (data.type === "due") void checkReminders();
      if (data.type === "sale-ring") {
        if (!canCompose()) return;
        if (document.visibilityState !== "visible") {
          void notifyHiddenSales();
          return;
        }
        void pollAlerts();
        return;
      }
      if (data.type === "lead-open" && data.id) {
        void openLead(data.id);
        return;
      }
      if (data.type === "sale-open") {
        const seen = readAlertSeen();
        (Array.isArray(data.ids) ? data.ids : []).forEach((id) => seen.add(id));
        writeAlertSeen(seen);
        void rememberAlertIds(Array.isArray(data.ids) ? data.ids : []);
        if (canCompose()) void openAlerts();
      }
    });
    let swReloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (swReloading) return;
      swReloading = true;
      window.location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((reg) => reg.update()).catch(() => {});
    });
  }

  const SIM_LOGOS = {
    "הפניקס": "./logos/phoenix.png",
    "מנורה": "./logos/menora.png",
    "הכשרה": "./logos/hachshara.png",
    "מגדל": "./logos/migdal.png",
    "איילון": "./logos/ayalon.png",
    "כלל": "./logos/clal.png"
  };

  function simLogoHtml(company, className) {
    const src = SIM_LOGOS[company];
    if (!src) return "";
    return '<img class="' + className + '" src="' + esc(src) + '" alt="' + esc(company) + '"/>';
  }

  const SIM_COMPANIES = [
    ["הפניקס", ["ריסק", "בריאות", "מחלות קשות", "סרטן", "ריסק משכנתא"]],
    ["מנורה", ["ריסק", "ריסק משכנתא", "בריאות", "מחלות קשות", "סרטן"]],
    ["הכשרה", ["ריסק", "ריסק משכנתא", "בריאות", "מחלות קשות"]],
    ["מגדל", ["בריאות", "מחלות קשות", "סרטן", "ריסק", "ריסק משכנתא", "מוות מתאונה", "נכות מתאונה"]],
    ["איילון", ["בריאות", "מחלות קשות", "סרטן"]],
    ["כלל", ["בריאות", "מחלות קשות", "סרטן", "ריסק משכנתא", "ריסק"]]
  ];
  const SIM_HEALTH = {"מנורה":[{"id":"transplant","label":"השתלות וטיפולים מיוחדים מחוץ לישראל"},{"id":"abroad_surgery","label":"ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל"},{"id":"drugs","label":"תרופות מחוץ לסל שירותי הבריאות"},{"id":"surgery_first_shekel","label":"ניתוחים שקל ראשון"},{"id":"surgery_shaban","label":"ניתוחים שב״ן משלים"},{"id":"surgery_shaban_5000","label":"ניתוחים שב״ן משלים ₪5000 ה.ע"},{"id":"ambulatory_consults","label":"ייעוצים ובדיקות"},{"id":"fast_diagnosis","label":"אבחון רפואי מהיר"},{"id":"tech_devices","label":"טיפולים בטכנולוגיות מתקדמות ואביזרים רפואיים"},{"id":"smart_dr","label":"סמארט דוקטור — ייעוץ רפואי מקוון"},{"id":"top_complementary","label":"טיפולים טופ — רפואה משלימה"},{"id":"child_dev","label":"טופ לילד — אבחונים וטיפולי התפתחות"},{"id":"top_preventive","label":"מניעתית טופ — רפואה מונעת"}],"הפניקס":[{"id":"transplant","label":"השתלות וטיפולים מיוחדים מחוץ לישראל"},{"id":"abroad_surgery","label":"ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל"},{"id":"drugs","label":"תרופות מחוץ לסל שירותי הבריאות"},{"id":"surgery_first_shekel","label":"ניתוחים בישראל מהשקל הראשון"},{"id":"surgery_shaban","label":"משלים שב\"ן ללא השתתפות עצמית"},{"id":"surgery_shaban_5000","label":"משלים שב\"ן עם השתתפות עצמית 5,000 ₪"},{"id":"ambulatory_consults","label":"ייעוץ ובדיקות"},{"id":"fast_diagnosis","label":"אבחון רפואי מהיר"},{"id":"ambulatory_package","label":"ייעוץ ובדיקות ואבחון רפואי מהיר"},{"id":"ambulatory_accompany","label":"ליווי רפואי וטיפולים אגב אירוע רפואי"},{"id":"complementary","label":"רפואה משלימה"},{"id":"child_dev","label":"כתב שירות התפתחות הילד"},{"id":"expert_click","label":"רופא מומחה בקליק"}],"איילון":[{"id":"transplant","label":"השתלות וטיפולים מיוחדים בחו״ל"},{"id":"drugs","label":"תרופות שלא בסל הבריאות"},{"id":"abroad_surgery","label":"ניתוחים ומחליפי ניתוח בחו״ל"},{"id":"surgery_first_shekel","label":"ניתוחים ומחליפי ניתוח פרטיים בארץ — מהשקל הראשון"},{"id":"surgery_shaban","label":"ניתוחים ומחליפי ניתוח פרטיים בארץ — משלים שב״ן"},{"id":"surgery_shaban_5000","label":"משלים שב״ן עם השתתפות עצמית ₪5,000"},{"id":"ambulatory_extended","label":"שירותים אמבולטוריים לייעוץ ובדיקות — מורחב"},{"id":"ambulatory_consults","label":"שירותים אמבולטוריים לייעוץ ובדיקות"},{"id":"ambulatory_treatments","label":"נספח לטיפולים"},{"id":"fast_diagnosis","label":"נספח לשירותי אבחון מהיר"},{"id":"tech_devices","label":"טיפולים בטכנולוגיות מתקדמות ואביזרים רפואיים"},{"id":"child_dev","label":"אבחונים וטיפולי התפתחות הילד"},{"id":"complementary","label":"רפואה משלימה"},{"id":"online","label":"רפואה אונליין — ייעוץ רופא מומחה בקליק"},{"id":"home","label":"איילון עד הבית"},{"id":"sports","label":"איילון ספורטיבי"},{"id":"crisis_bar_gefen","label":"ניהול משברים בר גפן"}],"הכשרה":[{"id":"drugs","label":"תרופות מחוץ לסל שירותי הבריאות"},{"id":"transplant","label":"השתלות וטיפולים מיוחדים מחוץ לישראל"},{"id":"abroad_surgery","label":"ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל"},{"id":"surgery_shaban_5000","label":"ניתוחים בישראל — משלים שב״ן עם השתתפות עצמית 5,000 ₪"},{"id":"surgery_shaban","label":"ניתוחים בישראל — משלים שב״ן ללא השתתפות עצמית"},{"id":"surgery_first_shekel","label":"ניתוחים בישראל מהשקל הראשון"},{"id":"ambulatory_consults","label":"אמבולטורי — ייעוץ ובדיקות"},{"id":"child_premium","label":"שירות פרימיום לילד"}],"מגדל":[{"id":"drugs","label":"תרופות מחוץ לסל"},{"id":"transplant","label":"השתלות וטיפולים מיוחדים מחוץ לישראל"},{"id":"abroad_surgery","label":"ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל"},{"id":"surgery_shaban_5000","label":"משלים שב\"ן עם השתתפות עצמית 5,000 ₪"},{"id":"surgery_shaban","label":"משלים שב\"ן"},{"id":"surgery_first_shekel","label":"ניתוחים בישראל מהשקל הראשון"},{"id":"ambulatory_base","label":"ייעוץ ובדיקות"},{"id":"ambulatory_extended","label":"ייעוץ ובדיקות אבחנתיות — מורחב"},{"id":"ambulatory_accompany","label":"ליווי רפואי וטיפולים אגב אירוע"},{"id":"ambulatory_tech","label":"טיפולים בטכנולוגיות מתקדמות ואביזרים רפואיים"},{"id":"fast_diagnosis","label":"אבחון מהיר"},{"id":"treatments_general","label":"טיפולים רפואיים — פרק א׳"},{"id":"treatments_child_dev","label":"טיפולים להתפתחות הילד"},{"id":"complementary","label":"רפואה משלימה"},{"id":"online_consult","label":"ייעוץ אונליין"},{"id":"doctor_home","label":"רופא עד הבית"}],"כלל":[{"id":"surgeries_abroad","label":"ניתוחים ומחליפי ניתוח בחו\"ל"},{"id":"transplants_abroad","label":"השתלות וטיפולים מיוחדים בחו\"ל"},{"id":"drugs","label":"תרופות"},{"id":"shaban_deduct","label":"משלים שב\"ן עם השתתפות עצמית 5,000 ₪"},{"id":"shaban","label":"משלים שב\"ן לניתוחים ומחליפי ניתוח בישראל"},{"id":"surgeries_israel","label":"ניתוחים ומחליפי ניתוח בישראל"},{"id":"bar_gefen","label":"חמ\"ל בר גפן"},{"id":"consult_tests","label":"ייעוצים ובדיקות"},{"id":"fast_diag","label":"אבחון רפואי מהיר"},{"id":"consult_diag","label":"ייעוץ, בדיקות ואבחון רפואי מהיר"},{"id":"advanced_tech","label":"טיפולים בטכנולוגיות מתקדמות ואביזרים רפואיים"},{"id":"personal_plus","label":"ליווי אישי פלוס"},{"id":"child_services","label":"שירותים לילד"},{"id":"online_doctor","label":"ביקור רופא און-ליין"},{"id":"online_doctor_extra","label":"ביקור רופא און-ליין אקסטרה"},{"id":"complementary","label":"רפואה משלימה"}]};

  function simBlank() {
    return { step: "details", birthDate: "", startDate: "", gender: "", smoker: "", occupation: "", company: "", product: "", sum: "", covers: {}, age: null, result: null, error: "", busy: false, discountKey: "", discountPct: "", discounts: [], discountLoaded: "", saved: [] };
  }

  function parseDmy(value) {
    const s = trim(value);
    if (!s) return null;
    let y = 0;
    let m = 0;
    let d = 0;
    let hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) || /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(s);
    if (hit) { y = Number(hit[1]); m = Number(hit[2]); d = Number(hit[3]); }
    else {
      hit = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
      if (hit) { d = Number(hit[1]); m = Number(hit[2]); y = Number(hit[3]); }
    }
    if (!y || !m || !d) {
      const dig = s.replace(/\D+/g, "");
      if (dig.length === 8) {
        d = Number(dig.slice(0, 2));
        m = Number(dig.slice(2, 4));
        y = Number(dig.slice(4, 8));
      }
    }
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
  }

  function isoFromDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function isoDate(value) {
    const date = parseDmy(value);
    return date ? isoFromDate(date) : "";
  }

  function groupSum(raw) {
    const digits = String(raw == null ? "" : raw).replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
    if (!digits) return "";
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function simAddMonths(date, months) {
    const base = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    base.setDate(Math.min(date.getDate(), last));
    return base;
  }

  function insuranceAge(birthValue, asOfValue) {
    const birth = parseDmy(birthValue);
    if (!birth) return null;
    const asOf = trim(asOfValue) ? parseDmy(asOfValue) : new Date();
    if (!asOf) return null;
    const end = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
    const start = new Date(birth.getFullYear(), birth.getMonth(), birth.getDate());
    if (end < start) return null;
    const birthdayInYear = (year) => {
      const dim = new Date(year, start.getMonth() + 1, 0).getDate();
      return new Date(year, start.getMonth(), Math.min(start.getDate(), dim));
    };
    let completed = end.getFullYear() - start.getFullYear();
    if (end < birthdayInYear(end.getFullYear())) completed--;
    if (completed < 0) return null;
    let lastYear = end.getFullYear();
    if (end < birthdayInYear(end.getFullYear())) lastYear -= 1;
    const half = simAddMonths(birthdayInYear(lastYear), 6);
    return end >= half ? completed + 1 : completed;
  }

  function simKind(product) {
    if (product === "בריאות") return "health";
    if (product === "מחלות קשות" || product === "סרטן") return "compensation";
    return "sum";
  }

  function simProducts(company) {
    const row = SIM_COMPANIES.find((item) => item[0] === company);
    return row ? row[1] : [];
  }

  function readSimForm() {
    const sim = state.sim;
    if (!sim) return;
    const birth = $("simBirth");
    const start = $("simStart");
    const job = $("simJob");
    const sum = $("simSum");
    if (birth) sim.birthDate = birth.value;
    if (start) sim.startDate = start.value;
    if (job) sim.occupation = job.value;
    if (sum) sim.sum = sum.value;
  }

  function simDetailsError() {
    const sim = state.sim;
    const birth = parseDmy(sim.birthDate);
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!birth || birth > todayDate) return "נא להזין תאריך לידה תקין (dd/mm/yyyy).";
    if (trim(sim.startDate) && !parseDmy(sim.startDate)) return "תאריך תחילת ביטוח לא תקין (dd/mm/yyyy).";
    if (sim.gender !== "זכר" && sim.gender !== "נקבה") return "נא לבחור מין.";
    if (sim.smoker !== "yes" && sim.smoker !== "no") return "נא לבחור מעשן או לא מעשן.";
    if (insuranceAge(sim.birthDate, sim.startDate) == null) return "לא ניתן לחשב גיל ביטוחי מהתאריכים.";
    return "";
  }

  function openSim() {
    state.sim = simBlank();
    show("sim");
    paintSim();
  }

  function simBack() {
    const sim = state.sim || simBlank();
    state.sim = sim;
    readSimForm();
    if (sim.step === "company") sim.step = "details";
    else if (sim.step === "product") sim.step = "company";
    else if (sim.step === "inputs" || sim.step === "result" || sim.step === "summary") sim.step = "product";
    else { show("home"); return; }
    paintSim();
  }

  function simClick(event) {
    const sim = state.sim;
    if (!sim) return;
    readSimForm();
    const gender = event.target.closest("[data-sim-gender]");
    if (gender) { sim.gender = gender.getAttribute("data-sim-gender"); sim.error = ""; paintSim(); return; }
    const smoker = event.target.closest("[data-sim-smoker]");
    if (smoker) { sim.smoker = smoker.getAttribute("data-sim-smoker"); sim.error = ""; paintSim(); return; }
    const company = event.target.closest("[data-sim-company]");
    if (company) { sim.company = company.getAttribute("data-sim-company"); sim.product = ""; sim.step = "product"; sim.error = ""; paintSim(); return; }
    const product = event.target.closest("[data-sim-product]");
    if (product) { sim.product = product.getAttribute("data-sim-product"); sim.covers = {}; sim.sum = ""; sim.result = null; sim.discountKey = ""; sim.discountPct = ""; sim.discounts = []; sim.discountLoaded = ""; sim.step = "inputs"; sim.error = ""; paintSim(); return; }
    const cover = event.target.closest("[data-sim-cover]");
    if (cover) {
      const id = cover.getAttribute("data-sim-cover");
      sim.covers[id] = !sim.covers[id];
      paintSim();
      return;
    }
    if (event.target.closest("#simNext")) {
      sim.error = simDetailsError();
      if (!sim.error) { sim.age = insuranceAge(sim.birthDate, sim.startDate); sim.step = "company"; }
      paintSim();
      return;
    }
    if (event.target.closest("#simCalc")) { void runSim(); }
    if (event.target.closest("#simAdd") || event.target.closest("#simAddInsured")) {
      simStashQuote(sim);
      sim.step = event.target.closest("#simAddInsured") ? "details" : "company";
      paintSim();
    }
  }

  function loadSimulatorQuotes() {
    if (window.GiSimulatorQuotes && typeof window.GiSimulatorQuotes.quote === "function") return Promise.resolve(window.GiSimulatorQuotes);
    if (loadSimulatorQuotes.pending) return loadSimulatorQuotes.pending;
    window.__GI_SIM_HOST = {
      safeTrim: function (value) { return String(value == null ? "" : value).trim(); },
      escapeHtml: function (value) { return String(value == null ? "" : value); },
      on: function (el, evt, fn) { if (el && el.addEventListener) el.addEventListener(evt, fn); },
      $: function (sel, root) { return (root || document).querySelector(sel); },
      $$: function (sel, root) { return Array.from((root || document).querySelectorAll(sel)); },
      nowISO: function () { return new Date().toISOString(); },
      parseBirthDateValue: function (value) {
        const date = parseDmy(value);
        if (!date) return null;
        const today = new Date();
        if (date > new Date(today.getFullYear(), today.getMonth(), today.getDate())) return null;
        return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), date: date };
      },
      parseAnyDmyDate: function (value) {
        const date = parseDmy(value);
        return date ? { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), date: date } : null;
      },
      formatDmyFromParts: function (y, m, d) {
        return String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0") + "/" + String(y).padStart(4, "0");
      },
      applyDmyAutoFormat: function (el) { return el ? String(el.value || "") : ""; },
      renderCompanyLogoHtmlForCompany: function () { return ""; },
      ensureGiSimulatorStylesLoaded: function () {},
      RiskSimulators: { register: function () {}, getHandler: function () { return null; }, list: function () { return []; }, registry: {} },
      onSimulatorsInstalled: function () {}
    };
    loadSimulatorQuotes.pending = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = new URL("../gi-simulators.js", window.location.href).href;
      script.onload = function () {
        if (window.GiSimulatorQuotes && typeof window.GiSimulatorQuotes.quote === "function") resolve(window.GiSimulatorQuotes);
        else reject(new Error("engine"));
      };
      script.onerror = function () { reject(new Error("engine")); };
      document.head.appendChild(script);
    }).catch(function (err) {
      loadSimulatorQuotes.pending = null;
      throw err;
    });
    return loadSimulatorQuotes.pending;
  }

  function simFailText(result) {
    const code = result && result.error;
    if (code === "NEED_COVERS") return "נא לבחור לפחות כיסוי אחד.";
    if (code === "NEED_INPUT") return "נא להזין סכום.";
    if (code === "UNKNOWN_SIM") return "אין סימולטור לחברה ולמוצר שנבחרו.";
    return "לא ניתן לחשב פרמיה עם הנתונים שהוזנו.";
  }

  async function runSim() {
    const sim = state.sim;
    if (!sim || sim.busy) return;
    readSimForm();
    sim.error = "";
    sim.age = insuranceAge(sim.birthDate, sim.startDate);
    const kind = simKind(sim.product);
    const amount = Number(String(sim.sum || "").replace(/[^\d.]/g, ""));
    const covers = Object.keys(sim.covers).filter((id) => sim.covers[id]);
    if (sim.age == null) sim.error = "לא ניתן לחשב גיל ביטוחי.";
    else if (kind === "health" && !covers.length) sim.error = "נא לבחור לפחות כיסוי אחד.";
    else if (kind !== "health" && !(amount > 0)) sim.error = kind === "compensation" ? "נא להזין סכום פיצוי." : "נא להזין סכום ביטוח.";
    if (sim.error) { paintSim(); return; }
    sim.busy = true;
    paintSim();
    try {
      const quotes = await loadSimulatorQuotes();
      const input = { age: sim.age, gender: sim.gender, smoker: sim.smoker === "yes", occupation: sim.occupation };
      if (kind === "health") input.covers = covers;
      else if (kind === "compensation") input.compensation = amount;
      else input.sumInsured = amount;
      sim.result = quotes.quote(sim.company, sim.product, input);
      sim.error = sim.result && sim.result.ok ? "" : simFailText(sim.result);
      if (sim.result && sim.result.ok) {
        sim.step = sim.saved && sim.saved.length ? "summary" : "result";
        sim.discountKey = "";
        sim.discountPct = "";
        void loadSimDiscounts();
      }
    } catch (_err) {
      sim.error = "לא ניתן לטעון את מנוע הסימולטורים כרגע.";
    }
    sim.busy = false;
    paintSim();
  }

  function discountRows(raw) {
    return (Array.isArray(raw) ? raw : []).map((row) => {
      const item = row && typeof row === "object" ? row : {};
      return { label: trim(item.label), pct: Number(item.pct) || 0, years: item.years || null, schedule: trim(item.schedule) };
    }).filter((row) => row.label);
  }

  function discountYear1(row) {
    const pct = Number(row && row.pct);
    if (Number.isFinite(pct) && pct > 0) return Math.min(100, pct);
    const sched = trim(row && row.schedule);
    if (sched) {
      const n = Number(String(sched.split("/")[0]).replace(/[^\d.-]/g, ""));
      if (Number.isFinite(n) && n > 0) return Math.min(100, n);
    }
    return 0;
  }

  function chosenDiscountPct(sim) {
    if (!sim) return 0;
    if (sim.discountKey === "manual") {
      const n = Number(String(sim.discountPct || "").replace(/[^\d.]/g, ""));
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.min(100, n);
    }
    if (String(sim.discountKey || "").charAt(0) !== "c") return 0;
    const index = Number(String(sim.discountKey).slice(1));
    const row = sim.discounts && sim.discounts[index];
    return row ? discountYear1(row) : 0;
  }

  function discountAfter(amount, pct) {
    const base = Number(amount) || 0;
    const rate = Math.min(100, Math.max(0, Number(pct) || 0));
    return Math.round(base * (100 - rate)) / 100;
  }

  function simResultHtml(sim) {
    const pct = chosenDiscountPct(sim);
    const monthly = Number(sim.result.monthlyPremium) || 0;
    const annual = Number(sim.result.annualPremium) || 0;
    const options = '<option value="">ללא הנחה</option>'
      + (sim.discounts || []).map((row, index) => {
        const value = "c" + index;
        return '<option value="' + value + '"' + (sim.discountKey === value ? " selected" : "") + ">" + esc(row.label) + "</option>";
      }).join("")
      + '<option value="manual"' + (sim.discountKey === "manual" ? " selected" : "") + ">הנחה ידנית</option>";
    const manual = sim.discountKey === "manual"
      ? '<label class="field" for="simDiscountPct">אחוז הנחה</label><input class="input" id="simDiscountPct" inputmode="decimal" dir="ltr" autocomplete="off" value="' + esc(sim.discountPct || "") + '"/>'
      : "";
    const after = sim.discountKey
      ? '<div><span class="simResult__k">פרמיה לאחר הנחה</span><strong id="simAfterMonth">' + esc(money(discountAfter(monthly, pct))) + "</strong>"
        + '<small id="simAfterYear">שנתית ' + esc(money(discountAfter(annual, pct))) + "</small></div>"
      : "";
    return '<div class="simResultWrap"><article class="simResult">' + simLogoHtml(sim.company, "simLogo")
      + "<p>" + esc(sim.company + " · " + sim.product) + "</p>"
      + '<div class="simPremiums"><div><span class="simResult__k">פרמיה לפני הנחה</span><strong>' + esc(money(monthly)) + "</strong>"
      + "<small>שנתית " + esc(money(annual)) + " · גיל ביטוחי " + esc(String(sim.age)) + "</small></div>"
      + after + "</div>"
      + '<label class="field" for="simDiscount">הנחה</label><select class="input" id="simDiscount">' + options + "</select>"
      + manual + "</article></div>";
  }

  function simStashQuote(sim) {
    if (sim.result && sim.result.ok) {
      sim.saved = sim.saved || [];
      sim.saved.push(simSnapshot(sim));
    }
    sim.company = "";
    sim.product = "";
    sim.covers = {};
    sim.sum = "";
    sim.result = null;
    sim.discountKey = "";
    sim.discountPct = "";
    sim.discounts = [];
    sim.discountLoaded = "";
    sim.error = "";
  }

  function simSnapshot(sim) {
    const pct = chosenDiscountPct(sim);
    const monthly = Number(sim.result && sim.result.monthlyPremium) || 0;
    const annual = Number(sim.result && sim.result.annualPremium) || 0;
    return {
      company: sim.company,
      product: sim.product,
      beforeMonth: monthly,
      afterMonth: discountAfter(monthly, pct)
    };
  }

  function simSummaryHtml(sim) {
    const rows = (sim.saved || []).concat([simSnapshot(sim)]);
    const before = rows.reduce((sum, row) => sum + row.beforeMonth, 0);
    const after = rows.reduce((sum, row) => sum + row.afterMonth, 0);
    const cards = rows.map((row) => '<article class="simSum__row">'
      + simLogoHtml(row.company, "simSum__logo")
      + '<div class="simSum__main"><b>' + esc(row.company) + "</b><span>" + esc(row.product) + "</span></div>"
      + '<div class="simSum__nums"><small>לפני</small><strong>' + esc(money(row.beforeMonth)) + "</strong></div>"
      + '<div class="simSum__nums"><small>אחרי</small><strong>' + esc(money(row.afterMonth)) + "</strong></div></article>").join("");
    return '<section class="simSum" aria-label="סיכום">' + cards
      + '<article class="simSum__total"><span>סה״כ לפני הנחה</span><b>' + esc(money(before)) + "</b>"
      + "<span>סה״כ לאחר הנחה</span><b>" + esc(money(after)) + "</b></article></section>";
  }

  function paintSimAfter() {
    const sim = state.sim;
    if (!sim || !sim.result) return;
    const pct = chosenDiscountPct(sim);
    const month = $("simAfterMonth");
    const year = $("simAfterYear");
    if (month) month.textContent = money(discountAfter(sim.result.monthlyPremium, pct));
    if (year) year.textContent = "שנתית " + money(discountAfter(sim.result.annualPremium, pct));
  }

  async function loadSimDiscounts() {
    const sim = state.sim;
    if (!sim || !sim.company || !sim.product) return;
    const key = sim.company + "\n" + sim.product;
    if (sim.discountLoaded === key) return;
    const table = window.ONYX_DISCOUNT_CATALOG || {};
    const builtIn = table[sim.company] && table[sim.company][sim.product];
    let rows = discountRows(builtIn);
    try {
      const res = await sb.from("app_meta").select("discounts:payload->companyDiscountOverrides").eq("key", "global").maybeSingle();
      const saved = res.data && res.data.discounts;
      const company = saved && saved[sim.company];
      if (company && Object.prototype.hasOwnProperty.call(company, sim.product) && Array.isArray(company[sim.product])) {
        rows = discountRows(company[sim.product]);
      }
    } catch (_err) {}
    if (!state.sim || state.sim.company + "\n" + state.sim.product !== key) return;
    state.sim.discounts = rows;
    state.sim.discountLoaded = key;
    if (state.sim.step === "result") paintSim();
  }

  function paintSim() {
    const host = $("simBody");
    const sim = state.sim || simBlank();
    state.sim = sim;
    if (sim.step === "company") {
      const logoRows = [["הפניקס", "מגדל", "כלל"], ["מנורה", "הכשרה", "איילון"]];
      host.innerHTML = '<p class="simLead">בחירת חברה. גיל ביטוחי ' + esc(String(sim.age)) + '</p><div class="simLogos">'
        + logoRows.map((row) => '<div class="simLogos__row">' + row.map((name) => '<button class="simLogoBtn" type="button" data-sim-company="' + esc(name) + '" aria-label="' + esc(name) + '">' + simLogoHtml(name, "simLogoBtn__img") + "</button>").join("") + "</div>").join("")
        + "</div>";
      return;
    }
    if (sim.step === "product") {
      host.innerHTML = '<p class="simLead">' + esc(sim.company) + "</p>" + simProducts(sim.company).map((product) => '<button class="simPick" type="button" data-sim-product="' + esc(product) + '">' + esc(product) + "</button>").join("");
      return;
    }
    if (sim.step === "inputs" || sim.step === "result" || sim.step === "summary") {
      const kind = simKind(sim.product);
      let fields = "";
      if (kind === "health") {
        const list = SIM_HEALTH[sim.company] || [];
        fields = list.map((cover) => '<button class="simCover' + (sim.covers[cover.id] ? " is-on" : "") + '" type="button" data-sim-cover="' + esc(cover.id) + '">' + esc(cover.label) + "</button>").join("");
      } else {
        const label = kind === "compensation" ? "סכום פיצוי" : "סכום ביטוח";
        fields = '<label class="field" for="simSum">' + label + '</label><input class="input" id="simSum" inputmode="numeric" dir="ltr" autocomplete="off" value="' + esc(groupSum(sim.sum)) + '"/>';
      }
      const done = (sim.step === "result" || sim.step === "summary") && sim.result && sim.result.ok;
      const result = done
        ? simResultHtml(sim) + (sim.saved && sim.saved.length ? simSummaryHtml(sim) : "") + '<div class="simAddRow"><button class="primary" id="simAdd" type="button">הוסף מוצר ללקוח</button><button class="primary" id="simAddInsured" type="button">הוספת מבוטח</button></div>'
        : fields + '<button class="primary" id="simCalc" type="button"' + (sim.busy ? " disabled" : "") + ">" + (sim.busy ? "מחשב..." : "חשב פרמיה") + "</button>";
      const head = sim.step === "result" || sim.step === "summary" ? "" : '<p class="simLead">' + esc(sim.company + " · " + sim.product) + "</p>";
      host.innerHTML = head + result + '<p class="formError">' + esc(sim.error) + "</p>";
      return;
    }
    const seg = (attr, value, label) => '<button type="button" data-sim-' + attr + '="' + esc(value) + '"' + ((attr === "gender" ? sim.gender : sim.smoker) === value ? ' class="is-on"' : "") + ">" + esc(label) + "</button>";
    host.innerHTML = '<label class="field" for="simBirth">תאריך לידה</label><input class="input" id="simBirth" type="date" autocomplete="bday" max="' + esc(isoFromDate(new Date())) + '" value="' + esc(isoDate(sim.birthDate)) + '"/>'
      + '<label class="field" for="simStart">תאריך תחילת ביטוח</label><input class="input" id="simStart" type="date" value="' + esc(isoDate(sim.startDate)) + '"/>'
      + '<span class="field">מין</span><div class="simSeg">' + seg("gender", "זכר", "זכר") + seg("gender", "נקבה", "נקבה") + "</div>"
      + '<span class="field">עישון</span><div class="simSeg">' + seg("smoker", "no", "לא מעשן") + seg("smoker", "yes", "מעשן") + "</div>"
      + '<label class="field" for="simJob">מקצוע (רשות)</label><input class="input" id="simJob" autocomplete="off" maxlength="60" value="' + esc(sim.occupation) + '"/>'
      + '<button class="primary" id="simNext" type="button">המשך לבחירת חברה</button><p class="formError">' + esc(sim.error) + "</p>";
  }
  lockScreen();
  playSplash();
  window.addEventListener("pageshow", (event) => {
    paintSystemBar();
    const splash = $("screenSplash");
    if (event.persisted && splash && !splash.hidden) playSplash();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      paintSystemBar();
      if (state.profile) void refreshChatBadge();
    }
  });
  boot().catch(() => show("splash")).then(() => { previewPortalMenu(); });

  function previewPortalMenu() {
    const host = location.hostname;
    if (host !== "127.0.0.1" && host !== "localhost") return;
    const preview = new URLSearchParams(location.search).get("preview");
    if (preview === "menu") {
      state.profile = { id: "preview", name: "תצוגה", role: "agent" };
      show("home");
      setMenu(true);
      const hello = $("homeHello");
      if (hello) hello.textContent = "שלום";
      return;
    }
    if (preview === "lead") {
      state.profile = { id: "preview", name: "תצוגה", role: "agent" };
      openLeadRow = {
        id: "preview-lead",
        phone: "0542503486",
        customer_name: "אילן",
        campaign_label: "קמפיין דן",
        source: "manual",
        status: "new",
        created_at: "2026-07-22T08:08:00.000Z",
        id_number: "012345678",
        id_issue_date: "2016-03-14",
        birth_date: "1988-11-02",
        description: "ביטוח רכב חדש\n---LEAD_META_JSON---\n" + JSON.stringify({
          idIssueDate: "2016-03-14",
          idNumber: "012345678",
          birthDate: "1988-11-02",
          insuranceCompany: "הפניקס",
          insuranceTypeLabels: ["רכב"]
        })
      };
      show("lead");
      wireLead();
      paintOpenLead();
      return;
    }
    if (preview === "car") {
      state.profile = { id: "preview", name: "תצוגה", role: "agent" };
      openCar();
      const stepName = new URLSearchParams(location.search).get("step");
      const steps = { personal: 0, vehicle: 1, history: 2, coverage: 3 };
      if (Object.prototype.hasOwnProperty.call(steps, stepName)) {
        car.phase = "wizard";
        car.idNumber = "123456782";
        car.data.idNumber = "123456782";
        car.data.firstName = "דנה";
        car.data.lastName = "לוי";
        car.data.gender = "female";
        car.data.birthDate = "1990-04-12";
        car.data.idIssueDate = "2010-05-01";
        car.data.licenseIssueDate = "2010";
        car.data.phone = "0501234567";
        car.data.street = "הרצל";
        car.data.houseNumber = "10";
        car.data.city = "תל אביב";
        car.data.zip = "6100000";
        car.hint = "תצוגה";
        car.step = steps[stepName];
        carPaint();
      }
      return;
    }
    if (preview !== "portal-menu" && preview !== "portal-sheet") return;
    state.file = {
      id: "preview-customer",
      full_name: "דנה לוי",
      phone: "0501234567",
      id_number: "012345678",
      payload: {
        primary: { firstName: "דנה", lastName: "לוי", birthDate: "1990-04-12", phone: "0501234567", idNumber: "012345678" },
        newPolicies: [{ id: "p1", company: "הפניקס", type: "בריאות", policyNumber: "458221", premium: 186, status: "פעילה" }]
      }
    };
    state.fileTab = "policies";
    show("customer");
    paintCustomerFile();
    if (preview === "portal-menu") {
      const menu = $("folioMenu");
      const backdrop = $("folioMenuBackdrop");
      if (menu) menu.hidden = false;
      if (backdrop) backdrop.hidden = false;
      const button = $("btnCustomerMore");
      if (button) button.setAttribute("aria-expanded", "true");
      return;
    }
    state.portalCode = "pPreview1";
    state.portalEnabled = true;
    paintPortalSheet();
    const sheet = $("portalSheet");
    if (sheet) sheet.hidden = false;
  }
})();
