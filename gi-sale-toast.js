/* GI-SALE-TOAST 2026-09-17 — live health-wizard sale toast for other signed-in users.
   Isolated module. Broadcast-first. Does not touch calc / wizard / search / reminder engines.
*/
(() => {
  "use strict";

  const TAG = "20260917-sale-toast-prem-v1";
  const CHANNEL = "gi-sale-toast";
  const SHOW_MS = 7000;
  const LEAVE_MS = 180;
  const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
  const FORM_PERSON_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.75h7.25L18.5 8v12.25A1.75 1.75 0 0 1 16.75 22H7A1.75 1.75 0 0 1 5.25 20.25V5.5A1.75 1.75 0 0 1 7 3.75Z"></path><path d="M14.25 3.75V8h4.25"></path><circle cx="12" cy="13.15" r="1.45"></circle><path d="M9.35 17.4c.5-1.2 1.45-1.85 2.65-1.85s2.15.65 2.65 1.85"></path></svg>';

  const state = {
    channel: null,
    hideTimer: 0,
    lastId: "",
    joined: false,
    joinTimer: 0
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

  function roleCode(role){
    const r = trim(role).toLowerCase();
    if(r === "owner" || r === "מפתח המערכת") return "owner";
    if(r === "admin" || r === "מנהל מערכת") return "admin";
    if(r === "manager" || r === "adminlite" || r === "admin_lite" || r === "מנהל") return "manager";
    if(r === "teammanager" || r === "team_manager" || r === "מנהל צוות") return "teamManager";
    if(r === "ops" || r === "מנהל תפעול") return "ops";
    if(r === "opsagent" || r === "ops_agent" || r === "נציג תפעול") return "opsAgent";
    if(r === "elementary" || r === "אלמנטרי") return "elementary";
    if(r === "referent" || r === "סוקרת") return "referent";
    if(r === "agent" || r === "נציג") return "agent";
    return r;
  }

  function isBlockedRole(role){
    const code = roleCode(role);
    return code === "ops" || code === "opsAgent" || code === "elementary" || code === "referent";
  }

  function canSeeSaleToast(){
    const fromBridge = currentAgent()?.role;
    const fromPill = agentFromPill()?.role;
    if(isBlockedRole(fromBridge) || isBlockedRole(fromPill)) return false;
    const code = roleCode(fromBridge || fromPill);
    if(!code) return true;
    return code === "agent" || code === "teamManager" || code === "manager" || code === "admin" || code === "owner";
  }

  function isSelfSale(payload){
    const me = currentAgent() || {};
    const pill = agentFromPill() || {};
    const sellerId = trim(payload?.agentId);
    const myId = trim(me.id);
    if(sellerId && myId) return sellerId === myId;
    const sellerName = trim(payload?.agentName);
    const myName = trim(me.name) || trim(pill.name);
    if(sellerName && myName && sellerName === myName) return true;
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

  function formatPremium(n){
    const v = Number(n);
    if(!Number.isFinite(v)) return "₪0";
    return "₪" + v.toLocaleString("he-IL", { maximumFractionDigits: v % 1 ? 2 : 0 });
  }

  function playGiSaleToastSound(){
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      if(!playGiSaleToastSound._ctx) playGiSaleToastSound._ctx = new Ctx();
      const ctx = playGiSaleToastSound._ctx;
      if(ctx.state === "suspended"){
        try { void ctx.resume(); } catch(_e) {}
      }
      const t0 = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.exponentialRampToValueAtTime(0.55, t0 + 0.01);
      master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      master.connect(ctx.destination);
      const tone = (when, freq, dur) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, when);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(1.0, when + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        osc.connect(g);
        g.connect(master);
        osc.start(when);
        osc.stop(when + dur + 0.02);
      };
      tone(t0, 1244.51, 0.09);
      tone(t0 + 0.07, 1864.66, 0.12);
    } catch(_e) {}
  }

  function normalize(row){
    if(!row || typeof row !== "object") return null;
    const id = trim(row.id);
    const agentName = trim(row.agentName) || "נציג";
    if(!id) return null;
    const premium = Number(row.premium);
    return {
      id,
      agentId: trim(row.agentId),
      agentName,
      premium: Number.isFinite(premium) ? premium : 0,
      created_at: row.created_at || new Date().toISOString()
    };
  }

  function hostEl(){
    return $("giSaleToastHost");
  }

  function clearHide(){
    window.clearTimeout(state.hideTimer);
    state.hideTimer = 0;
  }

  function hideToast(){
    const host = hostEl();
    const card = host?.querySelector(".giSaleToast");
    if(!card){
      if(host) host.innerHTML = "";
      return;
    }
    card.classList.remove("is-in");
    card.classList.add("is-out");
    window.setTimeout(() => {
      const live = hostEl();
      if(live) live.innerHTML = "";
    }, LEAVE_MS);
  }

  function showToast(sale){
    const host = hostEl();
    if(!host) return;
    clearHide();
    host.innerHTML = `<div class="giSaleToast" role="status">
      <div class="giSaleToast__icon">${FORM_PERSON_ICON}</div>
      <div class="giSaleToast__body">
        <div class="giSaleToast__kicker">מכירה חדשה</div>
        <div class="giSaleToast__agent">${esc(sale.agentName)}</div>
        <div class="giSaleToast__prem">${esc(formatPremium(sale.premium))}</div>
      </div>
    </div>`;
    const card = host.querySelector(".giSaleToast");
    requestAnimationFrame(() => {
      try { card?.classList.add("is-in"); } catch(_e) {}
    });
    state.hideTimer = window.setTimeout(() => hideToast(), SHOW_MS);
  }

  function applySale(row){
    const sale = normalize(row);
    if(!sale) return;
    if(sale.id && sale.id === state.lastId) return;
    if(document.body.classList.contains("lcAuthLock")) return;
    if(!canSeeSaleToast()) return;
    if(isSelfSale(sale)) return;
    state.lastId = sale.id;
    showToast(sale);
    playGiSaleToastSound();
  }

  function subscribe(){
    const client = supabaseClient();
    if(!client?.channel) return false;
    try { state.channel?.unsubscribe?.(); } catch(_e) {}
    state.joined = false;
    state.channel = client.channel(CHANNEL, { config: { broadcast: { ack: true, self: false } } });
    state.channel.on("broadcast", { event: "sale" }, (ev) => {
      applySale(ev?.payload);
    });
    state.channel.subscribe((status) => {
      if(status === "SUBSCRIBED") state.joined = true;
    });
    return true;
  }

  function publishNow(row){
    try {
      if(!state.channel) subscribe();
      const send = () => {
        try { state.channel?.send?.({ type: "broadcast", event: "sale", payload: row }); } catch(_e) {}
      };
      if(state.joined){
        send();
        return;
      }
      window.clearTimeout(state.joinTimer);
      let n = 0;
      const wait = () => {
        n += 1;
        if(!state.channel) subscribe();
        if(state.joined || n >= 25){
          state.joinTimer = 0;
          send();
          return;
        }
        state.joinTimer = window.setTimeout(wait, 80);
      };
      wait();
    } catch(_e) {}
  }

  function roundToastMoney(n){
    const v = Number(n);
    if(!Number.isFinite(v) || v <= 0) return 0;
    return Math.round(v * 100) / 100;
  }

  function asToastMoney(v){
    if(v == null || v === "") return 0;
    if(typeof v === "number") return roundToastMoney(v);
    const n = Number(String(v).replace(/[^\d.-]/g, ""));
    return roundToastMoney(n);
  }

  function listSalePolicies(rec){
    if(!rec || typeof rec !== "object") return [];
    const payload = rec.payload && typeof rec.payload === "object" ? rec.payload : rec;
    const fromPayload = Array.isArray(payload.newPolicies) ? payload.newPolicies : [];
    if(fromPayload.length) return fromPayload;
    const fromOps = Array.isArray(payload.operational?.newPolicies) ? payload.operational.newPolicies : [];
    if(fromOps.length) return fromOps;
    return Array.isArray(rec.newPolicies) ? rec.newPolicies : [];
  }

  function wizardSalePolicies(wizard){
    if(!wizard) return [];
    try {
      if(Array.isArray(wizard.newPolicies) && wizard.newPolicies.length) return wizard.newPolicies;
    } catch(_e) {}
    try {
      const payload = typeof wizard.getOperationalPayload === "function"
        ? wizard.getOperationalPayload()
        : null;
      const list = listSalePolicies({ payload });
      if(list.length) return list;
    } catch(_e2) {}
    return [];
  }

  function policySalePremium(p){
    if(!p || typeof p !== "object") return 0;
    if(String(p.origin || "") === "existing") return 0;
    try {
      if(typeof window.DashboardUI?.policyNetPremium === "function"){
        const n = roundToastMoney(window.DashboardUI.policyNetPremium(p));
        if(n > 0) return n;
      }
    } catch(_e) {}
    try {
      if(typeof window.CustomersUI?.getNewPolicyFilePremiumAfterDiscount === "function"){
        const n = roundToastMoney(window.CustomersUI.getNewPolicyFilePremiumAfterDiscount(p));
        if(n > 0) return n;
      }
    } catch(_e2) {}
    const map = p.simDiscountPerInsured;
    if(map && typeof map === "object"){
      let total = 0;
      let found = false;
      Object.keys(map).forEach((iid) => {
        const n = asToastMoney(map[iid]?.monthlyAfterDiscount);
        if(n > 0){
          total += n;
          found = true;
        }
      });
      if(found) return roundToastMoney(total);
    }
    return asToastMoney(p.premiumAfterDiscountValue)
      || asToastMoney(p.premiumAfterDiscount)
      || asToastMoney(p.premiumAfterCoverDiscounts)
      || asToastMoney(p.premiumValue)
      || asToastMoney(p.premiumMonthly)
      || asToastMoney(p.monthlyPremium)
      || asToastMoney(p.premium);
  }

  function sumPolicySalePremiums(list){
    if(!Array.isArray(list) || !list.length) return 0;
    let sum = 0;
    for(const p of list){
      sum += policySalePremium(p) || 0;
    }
    return roundToastMoney(sum);
  }

  /* GI-SALE-TOAST 2026-09-17 — premium fallbacks. Read-only.
     Shallow sum first (same as the customer list). If that is 0, reuse the
     gold-lead helpers and then walk saved / wizard policy fields. */
  function sumSavedPremium(saved, wizard){
    try {
      if(typeof window.CustomersUI?.sumNewPolicyPremiumsShallow === "function"){
        const n = roundToastMoney(window.CustomersUI.sumNewPolicyPremiumsShallow(saved));
        if(n > 0) return n;
      }
    } catch(_e) {}
    try {
      if(typeof window.CustomersUI?.collectNewPoliciesForMetrics === "function"
        && typeof window.DashboardUI?.policyNetPremium === "function"){
        const policies = window.CustomersUI.collectNewPoliciesForMetrics(saved) || [];
        const n = roundToastMoney(policies.reduce((sum, p) => {
          return sum + (Number(window.DashboardUI.policyNetPremium(p)) || 0);
        }, 0));
        if(n > 0) return n;
      }
    } catch(_e2) {}
    const fromSaved = sumPolicySalePremiums(listSalePolicies(saved));
    if(fromSaved > 0) return fromSaved;
    const fromWizard = sumPolicySalePremiums(wizardSalePolicies(wizard));
    if(fromWizard > 0) return fromWizard;
    return 0;
  }

  function publishFromWizardFinish(saved, wizard){
    try {
      if(wizard && typeof wizard.isElementaryFlow === "function" && wizard.isElementaryFlow()) return;
    } catch(_e) {}
    if(!saved) return;
    const agent = currentAgent() || {};
    const row = {
      id: "st_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      agentId: trim(agent.id) || trim(saved.agentId),
      agentName: trim(agent.name) || trim(saved.agentName) || "נציג",
      premium: sumSavedPremium(saved, wizard),
      created_at: new Date().toISOString()
    };
    publishNow(row);
  }

  function onLogin(){
    subscribe();
    if(!state.channel){
      window.setTimeout(() => { if(!state.channel) subscribe(); }, 1200);
    }
  }

  function onLogout(){
    clearHide();
    window.clearTimeout(state.joinTimer);
    state.joinTimer = 0;
    state.joined = false;
    try { state.channel?.unsubscribe?.(); } catch(_e) {}
    state.channel = null;
    state.lastId = "";
    const host = hostEl();
    if(host) host.innerHTML = "";
  }

  function boot(){
    window.addEventListener("gi:app-login-ready", () => { onLogin(); });
    window.addEventListener("gi:app-logout", () => { onLogout(); });
    try {
      if(currentAgent()) onLogin();
    } catch(_e) {}
  }

  window.GiSaleToast = {
    tag: TAG,
    showMs: SHOW_MS,
    publishFromWizardFinish,
    sumSavedPremium,
    playGiSaleToastSound,
    applySale,
    onLogin,
    onLogout
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
