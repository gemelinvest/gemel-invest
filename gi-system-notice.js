/* GI-SYSTEM-NOTICE 2026-09-15 — broadcast a system message to every signed-in user.
   Isolated module. Does not touch calc / wizard / search / reminder engines.
*/
(() => {
  "use strict";

  const TAG = "20260917-chat-dock-row-v1";
  const TABLE = "gi_system_notices";
  const CHANNEL = "gi-system-notice";
  const STATE_KEY = "GI_SYS_NOTICE_UI_V1";
  const MAX_BODY = 2000;
  const IDLE_MS = 20000;
  const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";

  const state = {
    bound: false,
    notice: null,
    mode: "hidden",
    lastHeardId: "",
    pollTimer: 0,
    idleTimer: 0,
    channel: null,
    dbChannel: null,
    sending: false
  };

  function trim(v){
    return String(v == null ? "" : v).trim();
  }

  function $(id){
    return document.getElementById(id);
  }

  function esc(str){
    return String(str ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function faceBridge(){
    try {
      return window.__GI_FACE_BRIDGE__ && typeof window.__GI_FACE_BRIDGE__ === "object"
        ? window.__GI_FACE_BRIDGE__
        : null;
    } catch(_e) {
      return null;
    }
  }

  function currentAgent(){
    try { return faceBridge()?.getCurrentAgent?.() || null; } catch(_e) { return null; }
  }

  function roleCode(role){
    const r = trim(role).toLowerCase();
    if(r === "owner" || r === "מפתח המערכת") return "owner";
    if(r === "admin" || r === "מנהל מערכת") return "admin";
    if(r === "manager" || r === "adminlite" || r === "admin_lite" || r === "מנהל") return "manager";
    return r;
  }

  function isComposerRole(role){
    const code = roleCode(role);
    return code === "admin" || code === "owner" || code === "manager";
  }

  function agentFromPill(){
    try {
      const name = trim(document.querySelector("#lcUserPillText .lcUserPill__name, .lcUserPill__name")?.textContent);
      const roleHe = trim(document.querySelector("#lcUserPillText .lcUserPill__role, .lcUserPill__role")?.textContent);
      if(!name && !roleHe) return null;
      return { id: "", name, role: roleHe, username: "" };
    } catch(_e) {
      return null;
    }
  }

  function composerAgent(){
    const fromBridge = currentAgent() || {};
    const fromPill = agentFromPill() || {};
    return {
      id: trim(fromBridge.id),
      name: trim(fromBridge.name) || trim(fromPill.name),
      role: trim(fromBridge.role) || trim(fromPill.role),
      username: trim(fromBridge.username)
    };
  }

  function canCompose(){
    if(isComposerRole(currentAgent()?.role)) return true;
    if(isComposerRole(agentFromPill()?.role)) return true;
    return false;
  }

  function connection(){
    const b = faceBridge() || {};
    return {
      url: trim(b.supabaseUrl) || FALLBACK_SUPABASE_URL,
      key: trim(b.publishableKey) || FALLBACK_PUBLISHABLE_KEY
    };
  }

  function supabaseClient(){
    try {
      const client = window.gemelInvestSupabaseClient;
      if(client?.channel) return client;
    } catch(_e) {}
    try {
      const cfg = connection();
      if(window.supabase?.createClient && cfg.url && cfg.key){
        return window.supabase.createClient(cfg.url, cfg.key);
      }
    } catch(_e2) {}
    return null;
  }

  async function authBearer(fallbackKey){
    try {
      const { data } = await window.gemelInvestSupabaseClient?.auth?.getSession?.() || {};
      const token = trim(data?.session?.access_token);
      if(token) return token;
    } catch(_e) {}
    return fallbackKey;
  }

  function isNetworkError(err){
    const msg = trim(err?.message || err);
    const name = trim(err?.name);
    if(name === "TypeError" || name === "AbortError") return true;
    return /failed to fetch|networkerror|load failed|abort/i.test(msg);
  }

  async function restRequest(path, options = {}){
    const cfg = connection();
    if(!cfg.url || !cfg.key) throw new Error("NO_CONNECTION");
    const method = String(options.method || "GET").toUpperCase();
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => controller.abort(),
      Math.max(3000, Number(options.timeoutMs || 8000) || 8000)
    );
    try {
      const bearer = await authBearer(cfg.key);
      const res = await fetch(cfg.url + "/rest/v1/" + String(path || ""), {
        method,
        cache: "no-store",
        signal: controller.signal,
        headers: {
          apikey: cfg.key,
          Authorization: "Bearer " + bearer,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
          ...(options.headers || {})
        },
        body: options.body == null ? undefined : JSON.stringify(options.body)
      });
      let payload = null;
      try { payload = await res.json(); } catch(_e) {}
      if(!res.ok){
        const msg = payload?.message || payload?.error_description || payload?.hint || ("HTTP_" + res.status);
        throw new Error(msg);
      }
      return payload;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function loadUiState(){
    try {
      const raw = localStorage.getItem(STATE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch(_e) {
      return {};
    }
  }

  function saveUiState(next){
    try { localStorage.setItem(STATE_KEY, JSON.stringify(next || {})); } catch(_e) {}
  }

  function clearIdle(){
    window.clearTimeout(state.idleTimer);
    state.idleTimer = 0;
  }

  function armIdle(){
    clearIdle();
    if(state.mode !== "open") return;
    state.idleTimer = window.setTimeout(() => {
      state.idleTimer = 0;
      if(state.mode === "open") minimize();
    }, IDLE_MS);
  }

  function playGiSystemNoticeSound(){
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      if(!playGiSystemNoticeSound._ctx) playGiSystemNoticeSound._ctx = new Ctx();
      const ctx = playGiSystemNoticeSound._ctx;
      if(ctx.state === "suspended"){
        try { void ctx.resume(); } catch(_e) {}
      }
      const t0 = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.exponentialRampToValueAtTime(1.0, t0 + 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.92);
      master.connect(ctx.destination);
      const tone = (when, freq, dur) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, when);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(1.0, when + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        osc.connect(g);
        g.connect(master);
        osc.start(when);
        osc.stop(when + dur + 0.04);
      };
      tone(t0, 523.25, 0.22);
      tone(t0 + 0.28, 783.99, 0.38);
    } catch(_e) {}
  }

  function formatWhen(iso){
    const dt = new Date(iso);
    if(isNaN(dt.getTime())) return "";
    const d = String(dt.getDate()).padStart(2, "0");
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    return d + "/" + m + " · " + hh + ":" + mm;
  }

  function paintCard(){
    const card = $("giSysNoticeCard");
    const dock = $("giSysNoticeDock");
    const body = $("giSysNoticeBody");
    const meta = $("giSysNoticeMeta");
    const notice = state.notice;
    if(!card || !dock) return;
    if(!notice || !trim(notice.body) || document.body.classList.contains("lcAuthLock")){
      card.classList.remove("is-open", "is-min");
      dock.classList.remove("is-on");
      return;
    }
    if(body) body.textContent = notice.body;
    if(meta){
      meta.textContent = formatWhen(notice.created_at);
    }
    if(state.mode === "open"){
      card.classList.add("is-open");
      card.classList.remove("is-min");
      dock.classList.remove("is-on");
    } else if(state.mode === "min"){
      card.classList.remove("is-open");
      card.classList.add("is-min");
      dock.classList.add("is-on");
    } else {
      card.classList.remove("is-open", "is-min");
      dock.classList.remove("is-on");
    }
  }

  function persistMode(){
    if(!state.notice?.id) return;
    const ui = loadUiState();
    ui[state.notice.id] = state.mode;
    ui.lastId = state.notice.id;
    saveUiState(ui);
  }

  function applyNotice(row, options = {}){
    const notice = normalize(row);
    if(!notice) return;
    const isNew = notice.id !== state.notice?.id;
    state.notice = notice;
    const ui = loadUiState();
    const saved = trim(ui[notice.id]);
    if(options.forceOpen || (isNew && options.play)){
      state.mode = "open";
    } else if(saved === "closed"){
      state.mode = "closed";
    } else if(options.fromLogin){
      state.mode = "min";
    } else if(saved === "open" || saved === "min"){
      state.mode = saved;
    } else {
      state.mode = "open";
    }
    persistMode();
    paintCard();
    if(state.mode === "open") armIdle();
    else clearIdle();
    if(options.play && notice.id !== state.lastHeardId){
      state.lastHeardId = notice.id;
      playGiSystemNoticeSound();
    }
  }

  function normalize(row){
    if(!row || typeof row !== "object") return null;
    const id = trim(row.id);
    const body = trim(row.body);
    if(!id || !body) return null;
    return {
      id,
      body,
      author_id: trim(row.author_id),
      author_name: trim(row.author_name),
      created_at: row.created_at || new Date().toISOString()
    };
  }

  function minimize(){
    if(!state.notice) return;
    clearIdle();
    state.mode = "min";
    persistMode();
    paintCard();
  }

  function closeCard(){
    if(!state.notice) return;
    clearIdle();
    state.mode = "closed";
    persistMode();
    paintCard();
  }

  function expand(){
    if(!state.notice) return;
    state.mode = "open";
    persistMode();
    paintCard();
    armIdle();
  }

  function setComposerStatus(msg, isErr){
    const el = $("giSysNoticeStatus");
    if(!el) return;
    el.textContent = trim(msg);
    el.classList.toggle("is-err", !!isErr);
  }

  async function sendNow(){
    if(state.sending) return;
    if(!canCompose()){
      setComposerStatus("אין הרשאה לשלוח הודעת מערכת", true);
      return;
    }
    const body = trim($("giSysNoticeInput")?.value);
    if(!body){
      setComposerStatus("יש לכתוב הודעה", true);
      return;
    }
    if(body.length > MAX_BODY){
      setComposerStatus("ההודעה ארוכה מדי", true);
      return;
    }
    const agent = composerAgent();
    const row = {
      id: "sn_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      body,
      author_id: trim(agent.id),
      author_name: trim(agent.name) || "מערכת",
      created_at: new Date().toISOString()
    };
    state.sending = true;
    const btn = $("giSysNoticeSendBtn");
    if(btn) btn.textContent = "שולח...";
    setComposerStatus("שולח לכל המשתמשים...", false);
    try {
      await restRequest(TABLE, {
        method: "POST",
        body: row,
        headers: { Prefer: "return=minimal" },
        timeoutMs: 8000
      });
      try {
        state.channel?.send?.({ type: "broadcast", event: "notice", payload: row });
      } catch(_e) {}
      applyNotice(row, { play: true, forceOpen: true });
      if($("giSysNoticeInput")) $("giSysNoticeInput").value = "";
      setComposerStatus("נשלח לכל המשתמשים", false);
    } catch(err){
      if(isNetworkError(err) || trim(err?.message) === "NO_CONNECTION"){
        setComposerStatus("אין חיבור לשרת", true);
      } else {
        setComposerStatus("שגיאה בשליחה: " + (err?.message || String(err)), true);
      }
    } finally {
      state.sending = false;
      if(btn) btn.textContent = "שלח";
    }
  }

  async function fetchLatest(){
    try {
      const data = await restRequest(
        TABLE + "?select=id,body,author_id,author_name,created_at&order=created_at.desc&limit=1",
        { method: "GET", timeoutMs: 8000 }
      );
      return Array.isArray(data) && data[0] ? normalize(data[0]) : null;
    } catch(_e) {
      return null;
    }
  }

  function subscribe(){
    const client = supabaseClient();
    if(!client?.channel) return;
    try { state.channel?.unsubscribe?.(); } catch(_e) {}
    try { state.dbChannel?.unsubscribe?.(); } catch(_e) {}
    state.channel = client.channel(CHANNEL, { config: { broadcast: { self: false } } });
    state.channel.on("broadcast", { event: "notice" }, (ev) => {
      applyNotice(ev?.payload, { play: true, forceOpen: true });
    });
    state.channel.subscribe();
    state.dbChannel = client.channel("gi-system-notice-db");
    state.dbChannel.on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: TABLE
    }, (payload) => {
      applyNotice(payload?.new, { play: true, forceOpen: true });
    });
    state.dbChannel.subscribe();
  }

  function startPoll(){
    window.clearInterval(state.pollTimer);
    state.pollTimer = window.setInterval(async () => {
      const latest = await fetchLatest();
      if(!latest) return;
      if(latest.id === state.notice?.id) return;
      applyNotice(latest, { play: true, forceOpen: true });
    }, 4000);
  }

  function bindUi(){
    if(state.bound) return;
    state.bound = true;
    $("giSysNoticeMinBtn")?.addEventListener("click", () => minimize());
    $("giSysNoticeCloseBtn")?.addEventListener("click", () => closeCard());
    $("giSysNoticeDockOpen")?.addEventListener("click", () => expand());
    $("giSysNoticeDockClose")?.addEventListener("click", () => closeCard());
    $("giSysNoticeSendBtn")?.addEventListener("click", () => { void sendNow(); });
    const card = $("giSysNoticeCard");
    card?.addEventListener("pointerenter", () => {
      if(state.mode === "open") clearIdle();
    });
    card?.addEventListener("pointerleave", () => {
      if(state.mode === "open") armIdle();
    });
  }

  async function onLogin(){
    bindUi();
    subscribe();
    startPoll();
    const latest = await fetchLatest();
    if(latest) applyNotice(latest, { fromLogin: true, play: false });
  }

  function onLogout(){
    window.clearInterval(state.pollTimer);
    clearIdle();
    try { state.channel?.unsubscribe?.(); } catch(_e) {}
    try { state.dbChannel?.unsubscribe?.(); } catch(_e) {}
    state.channel = null;
    state.dbChannel = null;
    state.notice = null;
    state.mode = "hidden";
    paintCard();
  }

  function boot(){
    bindUi();
    window.addEventListener("gi:app-login-ready", () => { void onLogin(); });
    window.addEventListener("gi:app-logout", () => { onLogout(); });
    try {
      if(currentAgent()) void onLogin();
    } catch(_e) {}
  }

  window.GiSystemNotice = {
    tag: TAG,
    idleMs: IDLE_MS,
    sendNow,
    playGiSystemNoticeSound,
    onLogin,
    onLogout
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
