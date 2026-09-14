/* GI-REMOTE-SUPPORT 2026-09-14 — CRM-tab live view + optional DOM control.
   Isolated module. Does not touch customer/proposal stores or global CSS.
*/
(() => {
  "use strict";

  const TAG = "20260914-remote-support-control-latency-v1";
  const TOKEN_KEY = "GI_RS_ACTOR_TOKEN_V1";
  const SESSION_KEY = "GI_RS_SESSION_V1";
  const ADMIN_TOPIC = "gi-rs-admins";
  const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
  const TERMINAL = new Set(["ended", "rejected", "expired", "failed"]);
  const LIVE_STATUSES = new Set([
    "approved", "connecting", "connected",
    "control_requested", "control_granted", "control_revoked"
  ]);
  const SENSITIVE_IDS = new Set(["lcLoginPin", "lcUserPin", "lcSecurityPassword"]);

  const state = {
    token: "",
    tokenExpiresAt: 0,
    agentUserId: "",
    agentName: "",
    isSupportAdmin: false,
    session: null,
    inbox: [],
    pc: null,
    dc: null,
    dcCmd: null,
    dcMove: null,
    localStream: null,
    watchChannel: null,
    adminChannel: null,
    sigChannel: null,
    makingOffer: false,
    isAgentParty: false,
    pendingMove: null,
    moveRaf: 0,
    bound: false,
    partyId: "",
    pendingIce: [],
    sigQueue: Promise.resolve(),
    needOfferSent: false
  };

  function trim(v){
    return String(v == null ? "" : v).trim();
  }

  function $(id){
    return document.getElementById(id);
  }

  function faceBridge(){
    try {
      return window.__GI_FACE_BRIDGE__ && typeof window.__GI_FACE_BRIDGE__ === "object"
        ? window.__GI_FACE_BRIDGE__
        : null;
    } catch(_e){
      return null;
    }
  }

  function roleFromHebrew(roleHe){
    const label = trim(roleHe);
    if(label === "מפתח המערכת") return "owner";
    if(label === "מנהל מערכת") return "admin";
    if(label === "מנהל") return "manager";
    if(label === "מנהל צוות") return "teamManager";
    if(label === "מנהל תפעול") return "ops";
    if(label === "נציג תפעול") return "opsAgent";
    if(label === "אלמנטרי") return "elementary";
    if(label === "סוקרת") return "referent";
    return "agent";
  }

  function agentFromPill(){
    const name = trim(document.querySelector("#lcUserPillText .lcUserPill__name, .lcUserPill__name")?.textContent);
    const roleHe = trim(document.querySelector("#lcUserPillText .lcUserPill__role, .lcUserPill__role")?.textContent);
    if(!name && !roleHe) return null;
    return { id: "", name: name || "", role: roleFromHebrew(roleHe), username: "" };
  }

  function enrichAgent(partial){
    if(!partial) return null;
    try {
      const rec = faceBridge()?.findLoginAgent?.(partial.id, partial.name || partial.username);
      if(rec && (trim(rec.id) || trim(rec.name))){
        return {
          id: trim(rec.id) || trim(partial.id),
          name: trim(rec.name) || trim(partial.name),
          role: trim(partial.role) || trim(rec.role) || "agent",
          username: trim(rec.username) || trim(partial.username)
        };
      }
    } catch(_e) {}
    if(!trim(partial.id) && !trim(partial.name) && !trim(partial.username)) return null;
    return {
      id: trim(partial.id),
      name: trim(partial.name),
      role: trim(partial.role) || "agent",
      username: trim(partial.username)
    };
  }

  function namesEqual(a, b){
    return !!trim(a) && trim(a) === trim(b);
  }

  function roleIsSupportAdmin(role, name){
    const r = trim(role).toLowerCase();
    const n = trim(name);
    if(r === "admin" || r === "owner" || r === "manager" || r === "adminlite" || r === "מנהל") return true;
    if(n === "איתי סומך" || n === "סוניה ארנשטיין" || n === "אוריה סומך") return true;
    return false;
  }

  function visibleUser(){
    const pill = agentFromPill();
    let fromBridge = null;
    try { fromBridge = enrichAgent(faceBridge()?.getCurrentAgent?.()); } catch(_e) {}
    if(pill && (pill.name || pill.role)){
      if(fromBridge && (namesEqual(fromBridge.name, pill.name) || (trim(fromBridge.id) && namesEqual(fromBridge.id, pill.id)))){
        return {
          id: trim(fromBridge.id),
          name: trim(fromBridge.name) || pill.name,
          role: pill.role || fromBridge.role || "agent",
          username: trim(fromBridge.username)
        };
      }
      return enrichAgent(pill);
    }
    if(fromBridge && (trim(fromBridge.id) || trim(fromBridge.name))) return fromBridge;
    try {
      const a = window.Auth;
      if(a && a.current){
        const fromAuth = enrichAgent(a.current);
        if(fromAuth && (trim(fromAuth.id) || trim(fromAuth.name))) return fromAuth;
      }
    } catch(_e2) {}
    return null;
  }

  function currentUser(){
    return visibleUser();
  }

  function tokenMatchesVisibleUser(){
    const vis = visibleUser();
    if(!vis) return true;
    if(trim(state.agentName) && vis.name && !namesEqual(state.agentName, vis.name)) return false;
    if(trim(state.agentUserId) && vis.id && !namesEqual(state.agentUserId, vis.id)) return false;
    if(state.isSupportAdmin && !roleIsSupportAdmin(vis.role, vis.name)) return false;
    return true;
  }

  function clearToken(){
    state.token = "";
    state.tokenExpiresAt = 0;
    state.agentUserId = "";
    state.agentName = "";
    state.isSupportAdmin = false;
    try { sessionStorage.removeItem(TOKEN_KEY); } catch(_e) {}
  }

  function currentUserId(){
    const user = currentUser();
    if(trim(user?.id)) return trim(user.id);
    if(tokenMatchesVisibleUser() && trim(state.agentUserId)) return trim(state.agentUserId);
    return "";
  }

  function currentUserName(){
    const user = currentUser();
    if(trim(user?.name || user?.username)) return trim(user?.name || user?.username);
    if(tokenMatchesVisibleUser() && trim(state.agentName)) return trim(state.agentName);
    return "";
  }

  function isAgentParty(session){
    if(!session) return false;
    const id = currentUserId();
    if(id && trim(session.agentUserId) === id) return true;
    const name = currentUserName();
    if(name && trim(session.agentName) === name) return true;
    return false;
  }

  function isSupportAdminClient(){
    const user = currentUser();
    return roleIsSupportAdmin(user?.role, user?.name || user?.username);
  }

  function supabaseClient(){
    try {
      if(window.gemelInvestSupabaseClient) return window.gemelInvestSupabaseClient;
    } catch(_e) {}
    try {
      return window.Storage?.client || null;
    } catch(_e2) {}
    return null;
  }

  function toast(payload){
    try { return window.showToast?.(payload); } catch(_e) { return null; }
  }

  function desktopNotify(title, body){
    try { void window.GIDesktopNotifications?.notify?.(title, { body, tag: "gi-rs" }); } catch(_e) {}
  }

  function closeUserMenu(){
    try { faceBridge()?.closeUserMenu?.(); } catch(_e) {}
    try { window.UI?._closeUserMenu?.(); } catch(_e2) {}
  }

  function openModal(id){
    const el = $(id);
    if(!el) return;
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
  }

  function closeModal(id){
    const el = $(id);
    if(!el) return;
    el.classList.remove("is-open");
    el.setAttribute("aria-hidden", "true");
  }

  function setError(id, msg){
    const el = $(id);
    if(!el) return;
    const text = trim(msg);
    el.textContent = text;
    el.classList.toggle("is-visible", !!text);
  }

  function statusLabel(status){
    const map = {
      requested: "ממתין לתמיכה",
      pending_agent_approval: "ממתין לאישור הנציג",
      approved: "אושר — מתחבר",
      connecting: "מתחבר",
      connected: "מחובר — צפייה בלבד",
      control_requested: "ממתין לאישור שליטה",
      control_granted: "שליטה פעילה",
      control_revoked: "שליטה בוטלה",
      ended: "הסתיים",
      rejected: "נדחה",
      expired: "פג תוקף",
      failed: "נכשל"
    };
    return map[status] || status || "";
  }

  function isTerminal(session){
    return !session || TERMINAL.has(trim(session.status));
  }

  function persistToken(){
    try {
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify({
        agentId: currentUserId(),
        agentName: currentUserName(),
        token: state.token,
        expiresAt: state.tokenExpiresAt,
        isSupportAdmin: state.isSupportAdmin
      }));
    } catch(_e) {}
  }

  function restoreToken(){
    try {
      const raw = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null");
      if(!raw || !trim(raw.token)) return;
      if(Number(raw.expiresAt || 0) < Date.now()) return;
      if(!!raw.isSupportAdmin && !isSupportAdminClient()) return;
      const vis = visibleUser();
      if(vis?.name && trim(raw.agentName) && !namesEqual(raw.agentName, vis.name)) return;
      if(vis?.id && trim(raw.agentId) && !namesEqual(raw.agentId, vis.id)) return;
      state.token = trim(raw.token);
      state.tokenExpiresAt = Number(raw.expiresAt || 0);
      state.isSupportAdmin = !!raw.isSupportAdmin && isSupportAdminClient();
      if(trim(raw.agentId)) state.agentUserId = trim(raw.agentId);
      if(trim(raw.agentName)) state.agentName = trim(raw.agentName);
      if(!tokenMatchesVisibleUser()) clearToken();
    } catch(_e) {}
  }

  function persistSessionId(){
    try {
      if(!state.session?.id || isTerminal(state.session)){
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        agentId: currentUserId(),
        agentName: currentUserName(),
        sessionId: state.session.id
      }));
    } catch(_e) {}
  }

  function restoreSessionId(){
    try {
      const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if(!raw) return "";
      const myId = currentUserId();
      const myName = currentUserName();
      if(trim(raw.agentId) && myId && trim(raw.agentId) !== myId) return "";
      if(trim(raw.agentName) && myName && trim(raw.agentName) !== myName) return "";
      return trim(raw.sessionId);
    } catch(_e){
      return "";
    }
  }

  async function rpc(name, args){
    const client = supabaseClient();
    if(!client?.rpc) return { ok: false, error: "NO_CLIENT" };
    try {
      const { data, error } = await client.rpc(name, args);
      if(error) return { ok: false, error: error.message || "RPC_FAILED", raw: error };
      let payload = data;
      if(typeof payload === "string"){
        try { payload = JSON.parse(payload); } catch(_e) {}
      }
      if(Array.isArray(payload)) payload = payload[0] || null;
      if(payload && typeof payload === "object") return payload;
      return { ok: false, error: "BAD_RPC_PAYLOAD" };
    } catch(err){
      return { ok: false, error: String(err?.message || err) };
    }
  }

  function rememberMint(res){
    state.token = trim(res?.token);
    state.isSupportAdmin = !!res?.isSupportAdmin;
    state.tokenExpiresAt = Date.parse(res?.expiresAt) || (Date.now() + 12 * 60 * 60 * 1000);
    if(trim(res?.agentUserId)) state.agentUserId = trim(res.agentUserId);
    if(trim(res?.agentName)) state.agentName = trim(res.agentName);
    persistToken();
  }

  async function ensureToken(){
    if(state.token && !tokenMatchesVisibleUser()) clearToken();
    if(state.token && state.tokenExpiresAt > Date.now() + 15000) return { ok: true, token: state.token };
    restoreToken();
    if(state.token && !tokenMatchesVisibleUser()) clearToken();
    if(state.token && state.tokenExpiresAt > Date.now() + 15000) return { ok: true, token: state.token };
    const user = currentUser();
    const keys = [user?.name, user?.id, user?.username].map(trim).filter(Boolean);
    const uniqueKeys = Array.from(new Set(keys));
    if(!uniqueKeys.length) return { ok: false, error: "NOT_LOGGED_IN" };
    let last = { ok: false, error: "MINT_FAILED" };
    for(const key of uniqueKeys){
      const res = await rpc("gi_rs_mint_actor_token", {
        p_agent_id: key,
        p_pin: ""
      });
      if(res?.ok && res.token){
        rememberMint(res);
        if(!tokenMatchesVisibleUser()){
          clearToken();
          last = { ok: false, error: "AGENT_NOT_FOUND" };
          continue;
        }
        state.isSupportAdmin = isSupportAdminClient() && !!res.isSupportAdmin;
        persistToken();
        return { ok: true, token: state.token };
      }
      last = res && typeof res === "object" ? res : last;
    }
    return { ok: false, error: last.error || "MINT_FAILED" };
  }

  async function action(name, sessionId, payload){
    const tok = await ensureToken();
    if(!tok.ok) return tok;
    const args = {
      p_token: state.token,
      p_action: name,
      p_payload: payload && typeof payload === "object" ? payload : {}
    };
    if(trim(sessionId)) args.p_session_id = sessionId;
    return rpc("gi_rs_action", args);
  }

  async function listSessions(){
    const tok = await ensureToken();
    if(!tok.ok) return tok;
    return rpc("gi_rs_list", { p_token: state.token });
  }

  function applySession(session, opts = {}){
    const prev = state.session;
    state.session = session && session.id ? session : null;
    persistSessionId();
    renderMenuLabel();
    renderBanner();
    if(isSupportAdminClient()) renderAdminModal(false);
    if(state.session && !isTerminal(state.session)){
      void startWatchChannel();
      if(LIVE_STATUSES.has(state.session.status)){
        void startSignaling();
      }
    } else {
      stopWatchChannel();
      stopSignaling();
      teardownRtc("session-cleared");
    }
    handleStatusSideEffects(prev, state.session, opts);
  }

  function handleStatusSideEffects(prev, next, opts){
    const prevStatus = trim(prev?.status);
    const nextStatus = trim(next?.status);
    if(!next || isTerminal(next)){
      closeModal("giRsApproveModal");
      closeModal("giRsControlModal");
      if(opts.fromRemote && prev && !isTerminal(prev)){
        toast({ title: "תמיכה מרחוק הסתיימה", text: statusLabel(nextStatus), variant: "info" });
      }
      return;
    }
    const iAmAgent = isAgentParty(next);
    const iAmAdmin = (!iAmAgent && state.isSupportAdmin) || (trim(next.adminUserId) === currentUserId() && !!currentUserId());

    if(iAmAgent && nextStatus === "pending_agent_approval" && prevStatus !== "pending_agent_approval"){
      openApproveModal();
    }
    if(iAmAgent && nextStatus === "control_requested" && prevStatus !== "control_requested"){
      openControlModal();
    }
    if(iAmAgent && LIVE_STATUSES.has(nextStatus) && nextStatus !== "pending_agent_approval"){
      if(!state.localStream) void startAgentCapture();
    }
    if(iAmAdmin && LIVE_STATUSES.has(nextStatus)){
      openModal("giRsAdminModal");
      renderAdminModal(true);
      void ensureAdminPeer();
    }
    if(prevStatus === "control_granted" && nextStatus !== "control_granted"){
      try { state.dc?.send?.(JSON.stringify({ t: "control-end" })); } catch(_e) {}
    }
  }

  function renderMenuLabel(){
    const btn = $("btnRemoteSupport");
    const label = $("giRsMenuLabel");
    if(!btn) return;
    const session = state.session;
    let text = "🎧 תמיכה מרחוק";
    if(session && !isTerminal(session)){
      if(session.status === "requested") text = "🟠 ממתין לתמיכה";
      else if(session.status === "pending_agent_approval") text = "🟠 ממתין לאישור";
      else if(session.status === "control_granted") text = "🟢 מנהל שולט כרגע";
      else if(LIVE_STATUSES.has(session.status)) text = "🟢 תמיכה מרחוק פעילה";
    }
    if(label) label.textContent = text;
    else btn.lastChild && (btn.lastChild.textContent = text);
    btn.setAttribute("aria-label", text);
  }

  function renderBanner(){
    const banner = $("giRsBanner");
    if(!banner) return;
    const session = state.session;
    const iAmAgent = isAgentParty(session);
    const live = session && iAmAgent && LIVE_STATUSES.has(session.status);
    banner.hidden = !live;
    banner.classList.toggle("is-visible", !!live);
    banner.classList.toggle("is-control", session?.status === "control_granted");
    if(!live) return;
    const title = $("giRsBannerTitle");
    const text = $("giRsBannerText");
    const stopControl = $("giRsBannerStopControl");
    if(session.status === "control_granted"){
      if(title) title.textContent = "🟢 מנהל שולט כרגע בסביבת העבודה";
      if(text) text.textContent = "מנהל המערכת מחובר כעת לסביבת העבודה שלך.";
      if(stopControl) stopControl.hidden = false;
    } else {
      if(title) title.textContent = "🟢 תמיכה מרחוק פעילה";
      if(text) text.textContent = "מנהל המערכת מחובר כעת לסביבת העבודה שלך.";
      if(stopControl) stopControl.hidden = session.status !== "control_granted";
    }
  }

  function renderAdminModal(keepOpen){
    const list = $("giRsInboxList");
    const empty = $("giRsInboxEmpty");
    const live = $("giRsLive");
    const hint = $("giRsLiveHint");
    const connectBtn = $("giRsAdminConnect");
    const controlBtn = $("giRsAdminRequestControl");
    const rejectBtn = $("giRsAdminReject");
    const hangupBtn = $("giRsAdminHangup");
    const selected = state.session;
    if(list){
      const rows = (Array.isArray(state.inbox) ? state.inbox : []).filter((row) => !TERMINAL.has(trim(row.status)));
      if(!rows.length){
        list.innerHTML = "";
        if(empty) empty.hidden = false;
      } else {
        if(empty) empty.hidden = true;
        list.innerHTML = rows.map((row) => {
          const active = selected && row.id === selected.id ? " is-active" : "";
          return `<button class="giRsInbox__item${active}" type="button" data-rs-id="${escapeHtml(row.id)}">
            <span class="giRsInbox__name">${escapeHtml(row.agentName || "נציג")}</span>
            <span class="giRsInbox__meta">${escapeHtml(statusLabel(row.status))}</span>
          </button>`;
        }).join("");
      }
    }
    const showLive = selected && LIVE_STATUSES.has(selected.status);
    live?.classList.toggle("is-visible", !!showLive);
    $("giRsAdminModal")?.classList.toggle("giRsAdminModal--live", !!showLive);
    if(hint){
      hint.textContent = selected
        ? (selected.status === "control_granted"
          ? "שליטה פעילה — לחיצות ועכבר נשלחים לנציג בתוך ה-CRM בלבד."
          : (showLive
            ? "צפייה בלבד. כדי לבצע פעולה לחץ «בקש שליטה»."
            : statusLabel(selected.status)))
        : "";
    }
    if(connectBtn) connectBtn.hidden = !(selected && selected.status === "requested");
    if(controlBtn) controlBtn.hidden = !(selected && (selected.status === "connected" || selected.status === "control_revoked"));
    if(rejectBtn) rejectBtn.hidden = !(selected && selected.status === "requested");
    if(hangupBtn) hangupBtn.hidden = !(selected && !isTerminal(selected));
    if(keepOpen) openModal("giRsAdminModal");
  }

  function escapeHtml(s){
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function watchTopic(sessionId){
    return "gi-rs-watch-" + sessionId;
  }

  function sigTopic(session){
    const secret = trim(session?.signalingSecret);
    if(!session?.id || !secret) return "";
    return "gi-rs-sig-" + session.id + "-" + secret;
  }

  async function startAdminInboxChannel(){
    const client = supabaseClient();
    if(!client?.channel || !state.isSupportAdmin) return;
    stopAdminInboxChannel();
    const ch = client.channel(ADMIN_TOPIC, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "support_requested" }, (payload) => {
      void onAdminBroadcast(payload?.payload || payload);
    });
    ch.on("broadcast", { event: "support_updated" }, (payload) => {
      void refreshFromServer();
    });
    await ch.subscribe();
    state.adminChannel = ch;
  }

  function stopAdminInboxChannel(){
    try { supabaseClient()?.removeChannel?.(state.adminChannel); } catch(_e) {}
    state.adminChannel = null;
  }

  async function broadcastAdmin(event, payload){
    const client = supabaseClient();
    if(!client?.channel) return;
    try {
      const ch = state.adminChannel || client.channel(ADMIN_TOPIC);
      await ch.send({ type: "broadcast", event, payload: payload || {} });
    } catch(_e) {}
  }

  async function startWatchChannel(){
    const client = supabaseClient();
    const session = state.session;
    if(!client?.channel || !session?.id) return;
    if(state.watchChannel?.topic?.endsWith?.(session.id)) return;
    stopWatchChannel();
    const ch = client.channel(watchTopic(session.id), { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "status" }, () => { void refreshFromServer(); });
    await ch.subscribe();
    state.watchChannel = ch;
  }

  function stopWatchChannel(){
    try { supabaseClient()?.removeChannel?.(state.watchChannel); } catch(_e) {}
    state.watchChannel = null;
  }

  async function broadcastStatus(){
    const session = state.session;
    if(!session?.id) return;
    try {
      await state.watchChannel?.send?.({
        type: "broadcast",
        event: "status",
        payload: { id: session.id, status: session.status }
      });
    } catch(_e) {}
    void broadcastAdmin("support_updated", { id: session.id, status: session.status });
  }

  async function startSignaling(){
    const client = supabaseClient();
    const topic = sigTopic(state.session);
    if(!client?.channel || !topic) return;
    if(state.sigChannel && state.sigChannel.topic === "realtime:" + topic) return;
    stopSignaling();
    const ch = client.channel(topic, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "signal" }, (msg) => {
      queueSignal(() => onSignal(msg?.payload || msg));
    });
    await ch.subscribe();
    state.sigChannel = ch;
  }

  function stopSignaling(){
    try { supabaseClient()?.removeChannel?.(state.sigChannel); } catch(_e) {}
    state.sigChannel = null;
  }

  function signalingPartyId(){
    if(trim(state.partyId)) return trim(state.partyId);
    const id = currentUserId() || ("p-" + Math.random().toString(36).slice(2, 10));
    state.partyId = id;
    return id;
  }

  function queueSignal(fn){
    state.sigQueue = Promise.resolve(state.sigQueue).then(fn).catch(() => {});
    return state.sigQueue;
  }

  function sdpKey(desc){
    if(!desc) return "";
    if(typeof desc === "string") return desc;
    return trim(desc.type) + "\n" + trim(desc.sdp);
  }

  async function flushIce(pc){
    const queued = state.pendingIce.splice(0, state.pendingIce.length);
    for(const candidate of queued){
      try { await pc.addIceCandidate(candidate); } catch(_e) {}
    }
  }

  async function sendSignal(payload){
    if(!state.sigChannel) await startSignaling();
    try {
      await state.sigChannel?.send?.({
        type: "broadcast",
        event: "signal",
        payload: { ...payload, from: signalingPartyId() }
      });
    } catch(_e) {}
  }

  function teardownRtc(reason){
    if(state.moveRaf){
      try { cancelAnimationFrame(state.moveRaf); } catch(_e0) {}
    }
    state.moveRaf = 0;
    state.pendingMove = null;
    try { state.dcMove?.close?.(); } catch(_e) {}
    try { state.dcCmd?.close?.(); } catch(_e1) {}
    try { state.dc?.close?.(); } catch(_e2) {}
    state.dcMove = null;
    state.dcCmd = null;
    state.dc = null;
    try {
      state.pc?.getSenders?.()?.forEach((sender) => {
        try { sender.track?.stop?.(); } catch(_e2) {}
      });
    } catch(_e) {}
    try { state.pc?.close?.(); } catch(_e) {}
    state.pc = null;
    if(state.localStream){
      try { state.localStream.getTracks().forEach((t) => t.stop()); } catch(_e) {}
      state.localStream = null;
    }
    const video = $("giRsAdminVideo");
    if(video) video.srcObject = null;
    state.makingOffer = false;
    state.pendingIce = [];
    state.needOfferSent = false;
    void reason;
  }

  function attachPcHandlers(pc, asOfferer){
    pc.onicecandidate = (ev) => {
      if(ev.candidate) void sendSignal({ kind: "ice", candidate: ev.candidate });
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if(st === "connected" && state.localStream){
        void tuneLocalCapture(pc, state.localStream.getVideoTracks()[0]);
      }
      if(st === "failed"){
        toast({ title: "החיבור נכשל", text: "לא ניתן ליצור חיבור WebRTC (NAT/חומת אש). אין פתרון דמה — נדרש STUN/TURN.", variant: "err" });
        void failSession("ice-failed");
      }
    };
    pc.ontrack = (ev) => {
      tuneRemotePlayback(ev.receiver);
      const video = $("giRsAdminVideo");
      if(video){
        video.srcObject = ev.streams[0] || new MediaStream([ev.track]);
        void video.play?.().catch?.(() => {});
      }
    };
    pc.ondatachannel = (ev) => {
      bindDataChannel(ev.channel);
    };
    if(asOfferer){
      bindDataChannel(pc.createDataChannel("gi-rs-control", { ordered: true }));
      bindDataChannel(pc.createDataChannel("gi-rs-move", { ordered: false, maxRetransmits: 0 }));
    }
  }

  function bindDataChannel(dc){
    if(!dc) return;
    const label = trim(dc.label);
    if(label === "gi-rs-move") state.dcMove = dc;
    else state.dcCmd = dc;
    state.dc = state.dcCmd || state.dcMove || dc;
    dc.onmessage = (ev) => {
      let msg = null;
      try { msg = JSON.parse(ev.data); } catch(_e) { return; }
      if(!msg || typeof msg !== "object") return;
      if(!isAgentParty(state.session)) return;
      if(state.session?.status !== "control_granted" || !state.session?.controlPermission) return;
      applyRemoteControl(msg);
    };
  }

  function tuneRemotePlayback(receiver){
    if(!receiver) return;
    try {
      if("jitterBufferTarget" in receiver) receiver.jitterBufferTarget = 0;
    } catch(_e) {}
    try {
      if("playoutDelayHint" in receiver) receiver.playoutDelayHint = 0;
    } catch(_e2) {}
    try {
      if("jitterBufferDelayHint" in receiver) receiver.jitterBufferDelayHint = 0;
    } catch(_e3) {}
  }

  async function tuneLocalCapture(pc, track){
    if(!pc || !track) return;
    try { track.contentHint = "detail"; } catch(_e) {}
    try { await track.applyConstraints({ frameRate: 30 }); } catch(_e2) {}
    const sender = pc.getSenders?.()?.find((s) => s.track === track);
    if(!sender) return;
    try {
      const caps = RTCRtpSender.getCapabilities?.("video");
      const tr = pc.getTransceivers?.().find((t) => t.sender === sender);
      if(caps?.codecs?.length && tr?.setCodecPreferences){
        const preferred = [];
        const rest = [];
        caps.codecs.forEach((codec) => {
          if(/vp8|h264/i.test(codec.mimeType || "")) preferred.push(codec);
          else rest.push(codec);
        });
        if(preferred.length) tr.setCodecPreferences(preferred.concat(rest));
      }
    } catch(_e3) {}
    try {
      const params = sender.getParameters();
      params.degradationPreference = "maintain-framerate";
      if(!Array.isArray(params.encodings) || !params.encodings.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = 2500000;
      params.encodings[0].maxFramerate = 30;
      try { params.encodings[0].priority = "high"; } catch(_e4) {}
      try { params.encodings[0].networkPriority = "high"; } catch(_e5) {}
      await sender.setParameters(params);
    } catch(_e6) {}
  }

  async function ensurePeer(asOfferer){
    if(state.pc && state.pc.connectionState !== "closed" && state.pc.connectionState !== "failed"){
      return state.pc;
    }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    state.pc = pc;
    attachPcHandlers(pc, asOfferer);
    return pc;
  }

  async function startAgentCapture(){
    if(!isAgentParty(state.session)) return;
    if(!navigator.mediaDevices?.getDisplayMedia){
      toast({ title: "לא ניתן לשתף מסך", text: "הדפדפן אינו תומך בשיתוף לשונית.", variant: "err" });
      return;
    }
    try {
      await action("mark_connecting", state.session.id, {});
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 30 },
          width: { ideal: 1920, max: 1920 },
          displaySurface: "browser"
        },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        surfaceSwitching: "exclude",
        systemAudio: "exclude"
      });
      state.localStream = stream;
      const track = stream.getVideoTracks()[0];
      const surface = trim(track?.getSettings?.()?.displaySurface);
      if(surface && surface !== "browser"){
        toast({
          title: "שתפת משטח אחר",
          text: "עדיף לשתף את לשונית ה-CRM בלבד. השליטה תישאר בתוך המערכת.",
          variant: "warn"
        });
      }
      track.addEventListener("ended", () => {
        toast({ title: "שיתוף הלשונית הופסק", variant: "warn" });
        void endSession("share-ended");
      });
      const pc = await ensurePeer(true);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await tuneLocalCapture(pc, track);
      state.makingOffer = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal({ kind: "offer", sdp: pc.localDescription });
      } finally {
        state.makingOffer = false;
      }
      const connected = await action("mark_connected", state.session.id, {});
      if(connected?.session) applySession(connected.session);
      await broadcastStatus();
    } catch(err){
      const name = String(err?.name || err?.message || err);
      if(/notallowed|permission|denied/i.test(name)){
        toast({ title: "שיתוף הלשונית בוטל", text: "החיבור לא יתחיל בלי שיתוף לשונית ה-CRM.", variant: "warn" });
        return;
      }
      toast({ title: "שיתוף הלשונית נכשל", text: name, variant: "err" });
      void failSession("capture-failed");
    }
  }

  async function ensureAdminPeer(){
    if(!state.isSupportAdmin && trim(state.session?.adminUserId) !== currentUserId()) return;
    if(isAgentParty(state.session)) return;
    const pc = await ensurePeer(false);
    await startSignaling();
    if(pc.remoteDescription || pc.signalingState !== "stable") return;
    if(state.needOfferSent) return;
    state.needOfferSent = true;
    await sendSignal({ kind: "need-offer" });
  }

  async function onSignal(payload){
    const msg = payload && typeof payload === "object" ? payload : {};
    if(trim(msg.from) && trim(msg.from) === signalingPartyId()) return;
    const asAgent = isAgentParty(state.session);
    const pc = await ensurePeer(asAgent);
    try {
      if(msg.kind === "offer" && msg.sdp){
        if(sdpKey(pc.remoteDescription) === sdpKey(msg.sdp) && pc.signalingState !== "stable") return;
        const offerCollision = state.makingOffer || pc.signalingState !== "stable";
        if(offerCollision && asAgent) return;
        await pc.setRemoteDescription(msg.sdp);
        await flushIce(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal({ kind: "answer", sdp: pc.localDescription });
        if(state.session && LIVE_STATUSES.has(state.session.status) && state.session.status !== "connected"){
          const connected = await action("mark_connected", state.session.id, {});
          if(connected?.session) applySession(connected.session);
        }
      } else if(msg.kind === "answer" && msg.sdp){
        if(pc.signalingState !== "have-local-offer") return;
        if(sdpKey(pc.remoteDescription) === sdpKey(msg.sdp)) return;
        await pc.setRemoteDescription(msg.sdp);
        await flushIce(pc);
      } else if(msg.kind === "ice" && msg.candidate){
        if(!pc.remoteDescription){
          state.pendingIce.push(msg.candidate);
          return;
        }
        try { await pc.addIceCandidate(msg.candidate); } catch(_e) {}
      } else if(msg.kind === "need-offer"){
        if(!asAgent) return;
        if(!pc.localDescription || pc.localDescription.type !== "offer") return;
        if(pc.signalingState !== "have-local-offer") return;
        await sendSignal({ kind: "offer", sdp: pc.localDescription });
      }
    } catch(err){
      const text = String(err?.message || err);
      if(/wrong state|InvalidStateError|stable|have-local-offer/i.test(text)) return;
      toast({ title: "שגיאת חיבור", text, variant: "err" });
    }
  }

  function isSensitiveTarget(el){
    if(!el || el.nodeType !== 1) return true;
    if(el.closest?.(".giRsBanner, .giRsModal, #giRsRequestModal, #giRsApproveModal, #giRsControlModal, #giRsAdminModal, #btnRemoteSupport")) return true;
    if(el.matches?.("input[type='password']")) return true;
    if(SENSITIVE_IDS.has(el.id)) return true;
    const bind = trim(el.getAttribute?.("data-bind"));
    if(/cc\.|cvv|cardNumber|card_number|\.pan\b/i.test(bind)) return true;
    const name = trim(el.getAttribute?.("name") || el.id);
    if(/cvv|cardNumber|ccNumber|pin/i.test(name)) return true;
    return false;
  }

  function fireDom(el, Ctor, name, init){
    try { el.dispatchEvent(new Ctor(name, init)); } catch(_e) {}
  }

  function applyRemoteControl(msg){
    if(state.session?.status !== "control_granted") return;
    const type = trim(msg.t);
    if(type === "pointer"){
      const x = Math.max(0, Math.min(1, Number(msg.x))) * window.innerWidth;
      const y = Math.max(0, Math.min(1, Number(msg.y))) * window.innerHeight;
      const el = document.elementFromPoint(x, y);
      if(!el || isSensitiveTarget(el)) return;
      const view = el.ownerDocument.defaultView;
      const common = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        button: 0,
        buttons: msg.op === "down" ? 1 : 0,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true
      };
      if(msg.op === "move"){
        fireDom(el, PointerEvent, "pointermove", common);
        fireDom(el, MouseEvent, "mousemove", common);
        return;
      }
      if(msg.op === "down"){
        fireDom(el, PointerEvent, "pointerdown", common);
        fireDom(el, MouseEvent, "mousedown", common);
        return;
      }
      if(msg.op === "up"){
        fireDom(el, PointerEvent, "pointerup", common);
        fireDom(el, MouseEvent, "mouseup", common);
        try { el.click(); } catch(_e) {}
        try { el.focus?.(); } catch(_e2) {}
        return;
      }
      if(msg.op === "dbl"){
        fireDom(el, MouseEvent, "dblclick", common);
        return;
      }
      if(msg.op === "scroll"){
        window.scrollBy({ left: Number(msg.dx) || 0, top: Number(msg.dy) || 0, behavior: "auto" });
      }
      return;
    }
    if(type === "key"){
      const active = document.activeElement;
      if(!active || isSensitiveTarget(active)) return;
      const init = {
        bubbles: true,
        cancelable: true,
        key: String(msg.key || ""),
        code: String(msg.code || ""),
        altKey: !!msg.altKey,
        ctrlKey: !!msg.ctrlKey,
        shiftKey: !!msg.shiftKey,
        metaKey: !!msg.metaKey
      };
      active.dispatchEvent(new KeyboardEvent("keydown", init));
      if(typeof msg.text === "string" && msg.text && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)){
        if(active.type === "password") return;
        const max = Number(active.maxLength || 0);
        const next = String(active.value || "") + msg.text;
        active.value = max > 0 ? next.slice(0, max) : next;
        active.dispatchEvent(new Event("input", { bubbles: true }));
      }
      active.dispatchEvent(new KeyboardEvent("keyup", init));
    }
  }

  function sendControl(msg){
    if(state.session?.status !== "control_granted") return;
    const isMove = msg?.t === "pointer" && msg.op === "move";
    const dc = isMove ? (state.dcMove || state.dcCmd || state.dc) : (state.dcCmd || state.dc);
    if(!dc || dc.readyState !== "open") return;
    if(isMove && dc.bufferedAmount > 8192) return;
    try { dc.send(JSON.stringify(msg)); } catch(_e) {}
  }

  function videoLetterboxRect(video){
    const rect = video.getBoundingClientRect();
    const vw = Number(video.videoWidth) || 0;
    const vh = Number(video.videoHeight) || 0;
    if(!rect.width || !rect.height) return null;
    if(!vw || !vh){
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }
    const scale = Math.min(rect.width / vw, rect.height / vh);
    const width = vw * scale;
    const height = vh * scale;
    return {
      left: rect.left + (rect.width - width) / 2,
      top: rect.top + (rect.height - height) / 2,
      width,
      height
    };
  }

  function pointerFromVideoEvent(ev, video){
    const box = videoLetterboxRect(video);
    if(!box || !box.width || !box.height) return null;
    const x = (ev.clientX - box.left) / box.width;
    const y = (ev.clientY - box.top) / box.height;
    if(x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  }

  function bindAdminVideoControls(){
    const video = $("giRsAdminVideo");
    if(!video || video._giRsBound) return;
    video._giRsBound = true;
    const point = (ev, op, extra) => {
      if(state.session?.status !== "control_granted") return;
      const norm = pointerFromVideoEvent(ev, video);
      if(!norm) return;
      sendControl({ t: "pointer", op, x: norm.x, y: norm.y, ...(extra || {}) });
    };
    video.addEventListener("mousemove", (ev) => {
      if(state.session?.status !== "control_granted") return;
      const norm = pointerFromVideoEvent(ev, video);
      if(!norm) return;
      state.pendingMove = norm;
      if(state.moveRaf) return;
      state.moveRaf = requestAnimationFrame(() => {
        state.moveRaf = 0;
        const next = state.pendingMove;
        state.pendingMove = null;
        if(next) sendControl({ t: "pointer", op: "move", x: next.x, y: next.y });
      });
    });
    video.addEventListener("mousedown", (ev) => { ev.preventDefault(); point(ev, "down"); });
    video.addEventListener("mouseup", (ev) => { ev.preventDefault(); point(ev, "up"); });
    video.addEventListener("dblclick", (ev) => { ev.preventDefault(); point(ev, "dbl"); });
    video.addEventListener("wheel", (ev) => {
      if(state.session?.status !== "control_granted") return;
      ev.preventDefault();
      const norm = pointerFromVideoEvent(ev, video) || { x: 0, y: 0 };
      sendControl({ t: "pointer", op: "scroll", x: norm.x, y: norm.y, dx: ev.deltaX, dy: ev.deltaY });
    }, { passive: false });
    window.addEventListener("keydown", (ev) => {
      if(state.session?.status !== "control_granted") return;
      if(document.activeElement && $("giRsAdminModal")?.contains(document.activeElement) && document.activeElement !== video){
        if(document.activeElement.matches("input,textarea,button")) return;
      }
      if(!$("giRsAdminModal")?.classList.contains("is-open")) return;
      if(trim(state.session?.adminUserId) !== currentUserId()) return;
      sendControl({
        t: "key",
        key: ev.key,
        code: ev.code,
        altKey: ev.altKey,
        ctrlKey: ev.ctrlKey,
        shiftKey: ev.shiftKey,
        metaKey: ev.metaKey,
        text: ev.key && ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey ? ev.key : ""
      });
    });
  }

  async function refreshFromServer(){
    const listed = await listSessions();
    if(!listed?.ok) return;
    state.isSupportAdmin = isSupportAdminClient() && !!listed.isSupportAdmin;
    state.inbox = state.isSupportAdmin && Array.isArray(listed.inbox) ? listed.inbox : [];
    const mine = listed.mine || null;
    const selectedId = state.session?.id;
    let next = mine;
    if(state.isSupportAdmin && selectedId){
      next = state.inbox.find((row) => row.id === selectedId) || mine || state.session;
    }
    applySession(next, { fromRemote: true });
  }

  async function onAdminBroadcast(payload){
    const body = payload && typeof payload === "object" ? payload : {};
    await refreshFromServer();
    const name = trim(body.agentName) || "נציג";
    toast({
      title: "בקשת תמיכה חדשה",
      text: `${name} מבקש תמיכה מרחוק`,
      variant: "warn",
      durationMs: 14000,
      singletonKey: "gi-rs-request-" + trim(body.id),
      actions: [
        { label: "פתח בקשה", onClick: () => { void openAdminFor(body.id); } },
        { label: "דחה", onClick: () => { void rejectRequest(body.id); } }
      ]
    });
    desktopNotify("בקשת תמיכה חדשה", `נציג: ${name}`);
  }

  async function openAdminFor(sessionId){
    openModal("giRsAdminModal");
    const id = trim(sessionId);
    if(id){
      const got = await action("get", id, {});
      if(got?.session) applySession(got.session);
    }
    await refreshFromServer();
    renderAdminModal(true);
  }

  async function submitRequest(){
    setError("giRsRequestError", "");
    if(isSupportAdminClient()){
      closeModal("giRsRequestModal");
      await refreshFromServer();
      renderAdminModal(true);
      return;
    }
    const minted = await ensureToken();
    if(!minted.ok){
      const code = trim(minted.error);
      setError("giRsRequestError",
        code === "NOT_LOGGED_IN" ? "לא זוהה משתמש מחובר. רענן את הדף והיכנס שוב."
        : code === "AGENT_NOT_FOUND" ? "המשתמש המחובר לא נמצא בשרת התמיכה."
        : "לא ניתן לשלוח את הבקשה. נסה שוב או רענן את הדף.");
      return;
    }
    if(isSupportAdminClient()){
      closeModal("giRsRequestModal");
      await refreshFromServer();
      renderAdminModal(true);
      return;
    }
    let res = await action("request_support", null, { problemText: "" });
    if(res?.error === "ADMIN_CANNOT_REQUEST"){
      clearToken();
      const mintedAgain = await ensureToken();
      if(mintedAgain.ok && !isSupportAdminClient()){
        res = await action("request_support", null, { problemText: "" });
      }
    }
    if(!res?.ok){
      setError("giRsRequestError", "שליחת הבקשה נכשלה.");
      return;
    }
    applySession(res.session);
    await broadcastAdmin("support_requested", {
      id: res.session.id,
      agentName: currentUserName()
    });
    await broadcastStatus();
    closeModal("giRsRequestModal");
    toast({ title: "בקשת התמיכה נשלחה", variant: "ok" });
  }

  async function requestConnect(){
    if(!state.session?.id) return;
    const res = await action("request_connect", state.session.id, {});
    if(!res?.ok){
      toast({ title: "לא ניתן לשלוח בקשת התחברות", text: res?.error || "", variant: "err" });
      return;
    }
    applySession(res.session);
    await broadcastStatus();
    toast({ title: "בקשת התחברות נשלחה לנציג", variant: "ok" });
  }

  async function approveConnect(){
    if(!state.session?.id) return;
    const res = await action("approve_connect", state.session.id, {});
    if(!res?.ok){
      toast({ title: "לא ניתן לאשר חיבור", text: res?.error || "", variant: "err" });
      return;
    }
    applySession(res.session);
    closeModal("giRsApproveModal");
    await broadcastStatus();
    await startAgentCapture();
  }

  async function rejectConnect(){
    if(!state.session?.id) return;
    const res = await action("reject_connect", state.session.id, {});
    if(res?.session) applySession(res.session);
    closeModal("giRsApproveModal");
    await broadcastStatus();
  }

  async function rejectRequest(sessionId){
    const id = trim(sessionId) || state.session?.id;
    if(!id) return;
    const res = await action("reject_request", id, {});
    if(res?.session){
      if(state.session?.id === id) applySession(res.session);
      await refreshFromServer();
    }
    await broadcastStatus();
  }

  async function requestControl(){
    if(!state.session?.id) return;
    const res = await action("request_control", state.session.id, {});
    if(!res?.ok){
      toast({ title: "לא ניתן לבקש שליטה", text: res?.error || "", variant: "err" });
      return;
    }
    applySession(res.session);
    await broadcastStatus();
  }

  async function grantControl(){
    if(!state.session?.id) return;
    const res = await action("grant_control", state.session.id, {});
    if(!res?.ok) return;
    applySession(res.session);
    closeModal("giRsControlModal");
    await broadcastStatus();
  }

  async function rejectControl(){
    if(!state.session?.id) return;
    const res = await action("reject_control", state.session.id, {});
    if(res?.session) applySession(res.session);
    closeModal("giRsControlModal");
    await broadcastStatus();
  }

  async function revokeControl(){
    if(!state.session?.id) return;
    const res = await action("revoke_control", state.session.id, {});
    if(res?.session) applySession(res.session);
    await broadcastStatus();
  }

  async function endSession(reason){
    if(!state.session?.id) {
      teardownRtc(reason || "end");
      return;
    }
    const res = await action("end_session", state.session.id, { reason: reason || "ended" });
    applySession(res?.session || null);
    teardownRtc(reason || "end");
    await broadcastStatus();
    closeModal("giRsAdminModal");
    closeModal("giRsApproveModal");
    closeModal("giRsControlModal");
  }

  async function failSession(reason){
    if(!state.session?.id){
      teardownRtc(reason || "fail");
      return;
    }
    const res = await action("fail_session", state.session.id, { reason: reason || "failed" });
    applySession(res?.session || null);
    teardownRtc(reason || "fail");
    await broadcastStatus();
  }

  function openRequestModal(){
    setError("giRsRequestError", "");
    openModal("giRsRequestModal");
  }

  function openApproveModal(){
    const nameEl = $("giRsApproveAdminName");
    if(nameEl) nameEl.textContent = trim(state.session?.adminName) || "מנהל המערכת";
    openModal("giRsApproveModal");
  }

  function openControlModal(){
    openModal("giRsControlModal");
  }

  async function onMenuClick(ev){
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    closeUserMenu();
    const admin = isSupportAdminClient();
    if(admin){
      const minted = await ensureToken();
      if(!minted.ok){
        openModal("giRsAdminModal");
        setError("giRsAdminError", minted.error === "NOT_LOGGED_IN"
          ? "לא זוהה משתמש מחובר. רענן את הדף והיכנס שוב."
          : "לא ניתן לטעון בקשות תמיכה. נסה שוב.");
        return;
      }
      setError("giRsAdminError", "");
      await refreshFromServer();
      renderAdminModal(true);
      return;
    }
    if(state.session && !isTerminal(state.session)){
      if(state.session.status === "pending_agent_approval") openApproveModal();
      else if(state.session.status === "control_requested") openControlModal();
      else toast({ title: statusLabel(state.session.status), variant: "info" });
      return;
    }
    openRequestModal();
  }

  function bindUi(){
    if(state.bound) return;
    state.bound = true;
    $("btnRemoteSupport")?.addEventListener("click", onMenuClick);
    $("giRsRequestCancel")?.addEventListener("click", () => closeModal("giRsRequestModal"));
    $("giRsRequestClose")?.addEventListener("click", () => closeModal("giRsRequestModal"));
    $("giRsRequestBackdrop")?.addEventListener("click", () => closeModal("giRsRequestModal"));
    $("giRsRequestSend")?.addEventListener("click", () => { void submitRequest(); });
    $("giRsApproveReject")?.addEventListener("click", () => { void rejectConnect(); });
    $("giRsApproveAccept")?.addEventListener("click", () => { void approveConnect(); });
    $("giRsControlReject")?.addEventListener("click", () => { void rejectControl(); });
    $("giRsControlAccept")?.addEventListener("click", () => { void grantControl(); });
    $("giRsAdminConnect")?.addEventListener("click", () => { void requestConnect(); });
    $("giRsAdminReject")?.addEventListener("click", () => { void rejectRequest(); });
    $("giRsAdminRequestControl")?.addEventListener("click", () => { void requestControl(); });
    $("giRsAdminHangup")?.addEventListener("click", () => { void endSession("admin-hangup"); });
    $("giRsAdminClose")?.addEventListener("click", () => closeModal("giRsAdminModal"));
    $("giRsAdminBackdrop")?.addEventListener("click", () => {
      if($("giRsAdminModal")?.classList.contains("giRsAdminModal--live")) return;
      closeModal("giRsAdminModal");
    });
    $("giRsBannerStopControl")?.addEventListener("click", () => { void revokeControl(); });
    $("giRsBannerEnd")?.addEventListener("click", () => { void endSession("agent-end"); });
    $("giRsInboxList")?.addEventListener("click", (ev) => {
      const item = ev.target?.closest?.("[data-rs-id]");
      if(!item) return;
      void openAdminFor(item.getAttribute("data-rs-id"));
    });
    bindAdminVideoControls();
    window.addEventListener("pagehide", (ev) => {
      if(ev && ev.persisted) return;
      void endSession("pagehide");
    });
    window.addEventListener("beforeunload", () => {
      if(state.session && !isTerminal(state.session) && state.token){
        try {
          const client = supabaseClient();
          client?.rpc?.("gi_rs_action", {
            p_token: state.token,
            p_action: "end_session",
            p_session_id: state.session.id,
            p_payload: { reason: "unload" }
          });
        } catch(_e) {}
      }
    });
    document.addEventListener("visibilitychange", () => {
      if(document.visibilityState === "visible") void refreshFromServer();
    });
  }

  async function onLogin(){
    if(!currentUser()) return;
    restoreToken();
    state.isSupportAdmin = isSupportAdminClient();
    bindUi();
    renderMenuLabel();
    const minted = await ensureToken();
    if(minted.ok){
      const listed = await listSessions();
      if(listed?.ok){
        state.isSupportAdmin = isSupportAdminClient() && !!listed.isSupportAdmin;
        state.inbox = isSupportAdminClient() && Array.isArray(listed.inbox) ? listed.inbox : [];
        applySession(listed.mine || null);
      }
      if(state.isSupportAdmin) await startAdminInboxChannel();
    } else {
      const restoredId = restoreSessionId();
      if(restoredId) persistSessionId();
    }
    renderMenuLabel();
  }

  async function onLogout(){
    try {
      if(state.session && !isTerminal(state.session)) await endSession("logout");
    } catch(_e) {}
    try { if(state.token) await rpc("gi_rs_revoke_actor_token", { p_token: state.token }); } catch(_e) {}
    stopAdminInboxChannel();
    stopWatchChannel();
    stopSignaling();
    teardownRtc("logout");
    state.token = "";
    state.tokenExpiresAt = 0;
    state.agentUserId = "";
    state.agentName = "";
    state.session = null;
    state.inbox = [];
    state.partyId = "";
    state.sigQueue = Promise.resolve();
    try { sessionStorage.removeItem(TOKEN_KEY); } catch(_e) {}
    try { sessionStorage.removeItem(SESSION_KEY); } catch(_e) {}
    renderMenuLabel();
    renderBanner();
    closeModal("giRsRequestModal");
    closeModal("giRsApproveModal");
    closeModal("giRsControlModal");
    closeModal("giRsAdminModal");
  }

  function boot(){
    bindUi();
    window.addEventListener("gi:app-login-ready", () => { void onLogin(); });
    window.addEventListener("gi:app-logout", () => { void onLogout(); });
    if(currentUser()) void onLogin();
  }

  const api = {
    tag: TAG,
    onLogin,
    onLogout,
    init: onLogin,
    getSession(){ return state.session; }
  };
  window.GiRemoteSupport = api;

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
