/* GEMEL INVEST CRM — CLEAN CORE (Supabase + Admin Settings/Users)
   P260318-1238
   - Keeps: Login, user pill, Admin: System Settings + Users
   - Data layer migrated from Google Sheets to Supabase
*/
(() => {
  "use strict";

  const BUILD = "20260322-welcome-loader-card-glass-luxe-1";
  const ADMIN_CONTACT_EMAIL = "oriasomech@gmail.com";
  const ARCHIVE_CUSTOMER_PIN = "1990";
  const SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
  const SUPABASE_TABLES = {
    meta: "app_meta",
    agents: "agents",
    customers: "customers",
    proposals: "proposals"
  };

  const SUPABASE_CHAT = {
    enabled: true,
    retentionMinutes: 5,
    cleanupIntervalMs: 60000,
    typingWindowMs: 2200,
    messagesTable: "gi_chat_messages",
    cleanupRpc: "gi_chat_cleanup",
    presenceTopic: "invest-chat-presence-room"
  };

  const CHAT_FAB_STORAGE_KEY = "GI_CHAT_FAB_POS_V1";
  const CHAT_FAB_DRAG_THRESHOLD = 6;

  // ---------- Helpers ----------
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const on = (el, evt, fn, opts) => el && el.addEventListener && el.addEventListener(evt, fn, opts);
  const safeTrim = (v) => String(v ?? "").trim();
  const nowISO = () => new Date().toISOString();

  const OPS_RESULT_OPTIONS = {
    pendingSignatures: "בוצע שיקוף · ממתין לחתימות",
    notInterested: "נעצרה שיחת שיקוף · לא מעוניין",
    waitingAgentInfo: "ממתין להשלמת מידע מהנציג"
  };

  function ensureOpsProcess(rec){
    if(!rec || typeof rec !== "object") return {};
    const payload = rec.payload && typeof rec.payload === "object" ? rec.payload : (rec.payload = {});
    const store = payload.opsProcess && typeof payload.opsProcess === "object" ? payload.opsProcess : (payload.opsProcess = {});
    return store;
  }

  function setOpsTouch(rec, patch = {}){
    if(!rec) return {};
    const store = ensureOpsProcess(rec);
    Object.assign(store, patch || {});
    const stamp = safeTrim((patch || {}).updatedAt) || nowISO();
    store.updatedAt = stamp;
    if(!store.updatedBy) store.updatedBy = safeTrim(Auth?.current?.name);
    rec.updatedAt = stamp;
    if(State?.data?.meta) State.data.meta.updatedAt = stamp;
    return store;
  }

  function getOpsResultLabel(key){
    const k = safeTrim(key);
    return OPS_RESULT_OPTIONS[k] || "";
  }

  function getOpsStatePresentation(rec){
    const ops = ensureOpsProcess(rec);
    const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
    const mirrorFlow = payload?.mirrorFlow && typeof payload.mirrorFlow === 'object' ? payload.mirrorFlow : {};
    const call = (mirrorFlow.callSession && typeof mirrorFlow.callSession === 'object')
      ? mirrorFlow.callSession
      : ((mirrorFlow.call && typeof mirrorFlow.call === 'object') ? mirrorFlow.call : {});
    const finalLabel = getOpsResultLabel(ops.resultStatus);
    let liveKey = safeTrim(ops.liveState);
    let liveLabel = "ממתין לשיקוף";
    let tone = "info";

    if(call?.active){
      liveKey = "in_call";
      liveLabel = "הלקוח בשיחת שיקוף כעת";
      tone = "warn";
    } else if(finalLabel){
      liveLabel = "הלקוח סיים שיחת שיקוף";
      tone = ops.resultStatus === 'notInterested' ? 'danger' : 'success';
    } else if(liveKey === "call_finished"){
      liveLabel = "הלקוח סיים שיחת שיקוף";
      tone = "success";
    } else if(liveKey === "handling"){
      liveLabel = "הלקוח בטיפול מחלקת תפעול";
      tone = "info";
    }

    let timerText = "00:00";
    let timerMeta = "הטיימר יתחיל ברגע שתופעל שיחת שיקוף";
    let timerLive = false;
    if(call?.active && call?.startedAt){
      const sec = Math.max(0, Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000));
      timerText = MirrorsUI?.formatDuration?.(sec) || "00:00";
      timerMeta = `בשיחה החל מ־${MirrorsUI?.formatClock?.(call.startedAt) || '—'}`;
      timerLive = true;
    } else if(call?.durationText){
      timerText = safeTrim(call.durationText) || "00:00";
      timerMeta = `שיחה אחרונה · התחלה ${safeTrim(call.startTime) || '—'} · סיום ${safeTrim(call.endTime) || '—'}`;
    } else if(safeTrim(call?.startedAt)){
      timerMeta = `שיחה אחרונה בתאריך ${MirrorsUI?.formatFullDate?.(call.startedAt) || '—'}`;
    }

    return {
      store: ops,
      liveKey: liveKey || 'waiting',
      liveLabel,
      finalLabel,
      tone,
      resultKey: safeTrim(ops.resultStatus),
      timerText,
      timerMeta,
      timerLive,
      waitingInfo: liveKey && liveKey !== 'waiting' ? 'יש טיפול פעיל/קודם בתהליך זה' : 'טרם התחיל טיפול תפעולי בלקוח זה',
      ownerText: safeTrim(ops.ownerName || call?.startedBy || ops.updatedBy || ''),
      updatedText: safeTrim(ops.updatedAt || rec?.updatedAt || '')
    };
  }


  function releaseGlobalUiLocks(){
    try { document.body.style.overflow = ""; } catch(_e) {}
    try { document.body.style.pointerEvents = ""; } catch(_e) {}
    try { document.documentElement.style.overflow = ""; } catch(_e) {}
    try { document.documentElement.style.pointerEvents = ""; } catch(_e) {}
    try { document.body.removeAttribute("inert"); } catch(_e) {}
    try { document.documentElement.removeAttribute("inert"); } catch(_e) {}
    try { document.body.classList.remove("is-loading", "is-busy", "modal-open", "lcBusy", "appBusy", "lcLeadShellOpen"); } catch(_e) {}
    try { document.activeElement?.blur?.(); } catch(_e) {}
    $$('[aria-busy="true"]').forEach((el) => el.setAttribute("aria-busy", "false"));
  }

  function forceCloseUiLayers(options = {}){
    const keepIds = new Set(Array.isArray(options.keepIds) ? options.keepIds.filter(Boolean) : []);

    const closeById = (id, cfg = {}) => {
      if(!id || keepIds.has(id)) return;
      const el = document.getElementById(id);
      if(!el) return;
      try { el.classList.remove("is-open", "is-active", "is-visible"); } catch(_e) {}
      if(cfg.hidden) {
        try { el.hidden = true; } catch(_e) {}
      }
      if(cfg.ariaHidden !== false) {
        try { el.setAttribute("aria-hidden", "true"); } catch(_e) {}
      }
      if(cfg.hideStyle) {
        try { el.style.display = "none"; } catch(_e) {}
      }
    };

    try { ForgotPasswordUI?.close?.(); } catch(_e) {}
    try { UsersUI?.closeModal?.(); } catch(_e) {}
    try { ArchiveCustomerUI?.close?.(); } catch(_e) {}
    try { CustomersUI?.closePolicyModal?.(); } catch(_e) {}
    try { CustomersUI?.close?.(); } catch(_e) {}
    try { MirrorsUI?.closeSearch?.(); } catch(_e) {}
    try { MirrorsUI?.closeStartModal?.(); } catch(_e) {}
    try { MirrorsUI?.stopTimerLoop?.(); } catch(_e) {}
    try { LeadShellUI?.close?.(); } catch(_e) {}
    try { Wizard?.closeHealthFindingsModal?.(); } catch(_e) {}
    try { Wizard?.closePicker?.(); } catch(_e) {}
    try { Wizard?.closeCoversDrawer?.(); } catch(_e) {}
    try { Wizard?.closePolicyAddedModal?.(); } catch(_e) {}
    try { Wizard?.closePolicyDiscountModal?.(); } catch(_e) {}
    try { Wizard?.closeOperationalReport?.(); } catch(_e) {}
    try { Wizard?.hideFinishFlow?.(); } catch(_e) {}

    [
      ["lcForgotModal", {}],
      ["lcUserModal", {}],
      ["customerFull", {}],
      ["customerPolicyModal", {}],
      ["lcArchiveCustomerModal", {}],
      ["lcInsPicker", {}],
      ["lcCoversDrawer", {}],
      ["lcPolicyAddedModal", {}],
      ["lcPolicyDiscountModal", {}],
      ["lcLeadShell", {}],
      ["lcReport", {}],
      ["lcFlow", { hideStyle:true }],
      ["mirrorsSearchModal", { hidden:true }],
      ["mirrorsStartModal", { hidden:true }],
      ["systemRepairModal", { ariaHidden:false }]
    ].forEach(([id, cfg]) => closeById(id, cfg));

    try {
      document.querySelectorAll('.modal.is-open, .drawer.is-open, .lcWizard.is-open').forEach((el) => {
        const id = safeTrim(el.id);
        if(id && keepIds.has(id)) return;
        el.classList.remove('is-open', 'is-active', 'is-visible');
        if(el.classList.contains('lcFlow')) el.style.display = 'none';
        if(el.id === 'mirrorsSearchModal' || el.id === 'mirrorsStartModal') el.hidden = true;
        el.setAttribute('aria-hidden', 'true');
      });
    } catch(_e) {}

    releaseGlobalUiLocks();
  }

  function prepareInteractiveWizardOpen(){
    forceCloseUiLayers({ keepIds:["lcWizard"] });
    try {
      const wizard = document.getElementById("lcWizard");
      if(wizard){
        wizard.style.pointerEvents = "";
        wizard.removeAttribute("inert");
      }
      wizard?.querySelectorAll?.('input,select,textarea,button').forEach((el) => {
        el.disabled = false;
        el.readOnly = false;
      });
    } catch(_e) {}
  }

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
  const LS_SESSION_KEY = "GEMEL_SESSION_V1";
  const LS_BACKUP_KEY  = "GEMEL_STATE_BACKUP_V1";

  // ---------- State ----------
  const defaultState = () => ({
    meta: {
      updatedAt: null,
      adminAuth: { username: "מנהל מערכת", pin: "1234", active: true },
      opsEvents: []
    },
    agents: [
      { id:"a_0", name:"יובל מנדלסון", username:"יובל מנדלסון", pin:"0000", active:true }
    ],
    customers: [],
    proposals: []
  });

  const State = {
    data: defaultState()
  };

  function normalizeState(s){
    const base = defaultState();
    const out = {
      meta: { ...(s?.meta || {}) },
      agents: Array.isArray(s?.agents) ? s.agents : base.agents,
      customers: Array.isArray(s?.customers) ? s.customers : [],
      proposals: Array.isArray(s?.proposals) ? s.proposals : []
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
      const role = (roleRaw === "manager" || roleRaw === "adminLite" || roleRaw === "admin") ? "manager" : (roleRaw === "ops" || roleRaw === "operations" || roleRaw === "תפעול") ? "ops" : "agent";
      return {
        id: safeTrim(a?.id) || ("a_" + idx),
        name, username, pin, role, active
      };
    }).filter(a => a.name);

    if (!out.agents.length) out.agents = base.agents;
    out.customers = (out.customers || []).map((c, idx) => normalizeCustomerRecord(c, idx)).filter(Boolean);
    out.proposals = (out.proposals || []).map((p, idx) => normalizeProposalRecord(p, idx)).filter(Boolean);
    out.meta.opsEvents = Array.isArray(out.meta.opsEvents) ? out.meta.opsEvents.map((ev, idx) => normalizeOpsEvent(ev, idx)).filter(Boolean) : [];
    out.meta.updatedAt = safeTrim(out.meta.updatedAt) || nowISO();
    return out;
  }

  function normalizeOpsEvent(ev, idx=0){
    if(!ev || typeof ev !== "object") return null;
    const range = ev.range && typeof ev.range === "object" ? ev.range : {};
    const reminder = ev.reminder && typeof ev.reminder === "object" ? ev.reminder : {};
    const title = safeTrim(ev.title) || "שיחת שיקוף ללקוח";
    const date = safeTrim(ev.date);
    const rangeStart = safeTrim(ev.rangeStart) || safeTrim(range.start);
    const rangeEnd = safeTrim(ev.rangeEnd) || safeTrim(range.end);
    const scheduledAt = safeTrim(ev.scheduledAt) || buildOpsEventDateTime(date, rangeStart);
    const reminderAt = safeTrim(ev.reminderAt) || shiftIsoMinutes(scheduledAt, -2);
    return {
      id: safeTrim(ev.id) || ("ops_event_" + idx + "_" + Math.random().toString(16).slice(2,8)),
      customerId: safeTrim(ev.customerId),
      customerName: safeTrim(ev.customerName) || "לקוח",
      customerPhone: safeTrim(ev.customerPhone),
      customerIdNumber: safeTrim(ev.customerIdNumber),
      title,
      notes: safeTrim(ev.notes),
      date,
      rangeStart,
      rangeEnd,
      range: { start: rangeStart, end: rangeEnd },
      scheduledAt,
      reminderAt,
      status: safeTrim(ev.status) || "scheduled",
      createdAt: safeTrim(ev.createdAt) || nowISO(),
      updatedAt: safeTrim(ev.updatedAt) || safeTrim(ev.createdAt) || nowISO(),
      createdByKey: safeTrim(ev.createdByKey),
      createdByName: safeTrim(ev.createdByName) || "נציג",
      acknowledgedAt: safeTrim(ev.acknowledgedAt),
      reminder: {
        offsetMinutes: Number(reminder.offsetMinutes || ev.reminderOffsetMinutes || 2) || 2,
        toastShownAt: safeTrim(reminder.toastShownAt) || safeTrim(ev.toastShownAt),
        acknowledgedAt: safeTrim(reminder.acknowledgedAt) || safeTrim(ev.acknowledgedAt)
      }
    };
  }

  function buildOpsEventDateTime(dateStr, timeStr){
    const d = safeTrim(dateStr);
    const t = safeTrim(timeStr);
    if(!d || !t) return "";
    return `${d}T${t}:00`;
  }

  function shiftIsoMinutes(isoStr, diffMinutes){
    const ms = Date.parse(isoStr || "");
    if(!Number.isFinite(ms)) return "";
    return new Date(ms + (Number(diffMinutes || 0) * 60000)).toISOString();
  }

  function formatOpsTime(timeStr){
    const value = safeTrim(timeStr);
    return value ? value.slice(0,5) : "—";
  }

  function formatOpsDateTime(isoStr){
    const ms = Date.parse(isoStr || "");
    if(!Number.isFinite(ms)) return "—";
    try {
      return new Intl.DateTimeFormat('he-IL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(ms));
    } catch(_e) {
      return new Date(ms).toLocaleString('he-IL');
    }
  }

  function premiumCustomerIcon(name){
    const icons = {
      medical: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-4.35-8.6-8.02C1.42 9.56 3.15 5.5 6.7 5.5c2.03 0 3.14 1.06 4.05 2.24.56.73 1.93.73 2.5 0 .9-1.18 2.01-2.24 4.04-2.24 3.56 0 5.3 4.06 3.3 7.48C18.5 16.65 12 21 12 21Z"></path><path d="M12 9v6"></path><path d="M9 12h6"></path></svg>',
      briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"></path><path d="M4.5 9.5h15a1.5 1.5 0 0 1 1.5 1.5v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-6A1.5 1.5 0 0 1 4.5 9.5Z"></path><path d="M3 13h18"></path></svg>',
      building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"></path><path d="M7 20V6.5A1.5 1.5 0 0 1 8.5 5h7A1.5 1.5 0 0 1 17 6.5V20"></path><path d="M10 9h1"></path><path d="M13 9h1"></path><path d="M10 12h1"></path><path d="M13 12h1"></path><path d="M11 20v-3h2v3"></path></svg>',
      folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.75 8.75a2 2 0 0 1 2-2h4.15l1.5 1.7h6.85a2 2 0 0 1 2 2v6.8a2 2 0 0 1-2 2H5.75a2 2 0 0 1-2-2v-8.5Z"></path><path d="M3.75 10.25h16.5"></path></svg>',
      activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2.1-4.5L13 16l2.2-4H21"></path></svg>',
      document: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4.75h6.5l4 4V18a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V6.75a2 2 0 0 1 2-2Z"></path><path d="M14.5 4.75v4h4"></path><path d="M9 12h6"></path><path d="M9 15.5h6"></path></svg>'
    };
    return `<span class="premiumMonoIcon premiumMonoIcon--${String(name || 'folder')}" aria-hidden="true">${icons[name] || icons.folder}</span>`;
  }

  function currentAgentIdentity(){
    const currentName = safeTrim(Auth?.current?.name);
    const currentRole = safeTrim(Auth?.current?.role) || 'agent';
    const agents = Array.isArray(State.data?.agents) ? State.data.agents : [];
    const found = agents.find((a) => safeTrim(a?.name) === currentName || safeTrim(a?.username) === currentName) || null;
    const idPart = safeTrim(found?.id) || currentName || 'agent';
    const userPart = safeTrim(found?.username) || safeTrim(found?.name) || currentName || 'agent';
    return {
      key: `${idPart}__${userPart}`.toLowerCase().replace(/\s+/g, '_'),
      name: safeTrim(found?.name) || currentName || 'נציג',
      role: safeTrim(found?.role) || currentRole
    };
  }

  function generateOpsEventSlots(){
    const slots = [];
    for(let h=8; h<=20; h += 1){
      for(let m=0; m<60; m += 15){
        const hh = String(h).padStart(2,'0');
        const mm = String(m).padStart(2,'0');
        slots.push(`${hh}:${mm}`);
      }
    }
    return slots;
  }

  function normalizeCustomerRecord(c, idx=0){
    const payload = c?.payload && typeof c.payload === "object" ? c.payload : {};
    if((!Array.isArray(payload.insureds) || !payload.insureds.length) && Array.isArray(payload?.operational?.insureds)){
      payload.insureds = JSON.parse(JSON.stringify(payload.operational.insureds));
    }
    if((!Array.isArray(payload.newPolicies) || !payload.newPolicies.length) && Array.isArray(payload?.operational?.newPolicies)){
      payload.newPolicies = JSON.parse(JSON.stringify(payload.operational.newPolicies));
    }
    const primary = payload?.primary || payload?.insureds?.[0]?.data || {};
    const fullName = safeTrim(c?.fullName) || safeTrim(((primary.firstName || "") + " " + (primary.lastName || "")).trim()) || "לקוח ללא שם";
    const idNumber = safeTrim(c?.idNumber) || safeTrim(primary.idNumber);
    const phone = safeTrim(c?.phone) || safeTrim(primary.phone);
    const email = safeTrim(c?.email) || safeTrim(primary.email);
    const city = safeTrim(c?.city) || safeTrim(primary.city);
    const agentName = safeTrim(c?.agentName) || safeTrim(c?.createdBy) || "";
    const createdAt = safeTrim(c?.createdAt) || nowISO();
    const updatedAt = safeTrim(c?.updatedAt) || createdAt;
    const insuredCount = Number(c?.insuredCount || payload?.insureds?.length || 0) || 0;
    const existingPoliciesCount = Number(c?.existingPoliciesCount || ((payload?.insureds || []).reduce((acc, ins) => acc + ((ins?.data?.existingPolicies || []).length), 0))) || 0;
    const newPoliciesCount = Number(c?.newPoliciesCount || (payload?.newPolicies || []).length) || 0;
    return {
      id: safeTrim(c?.id) || ("cust_" + idx + "_" + Math.random().toString(16).slice(2)),
      status: safeTrim(c?.status) || "חדש",
      fullName,
      idNumber,
      phone,
      email,
      city,
      agentName,
      agentRole: safeTrim(c?.agentRole) || "",
      createdAt,
      updatedAt,
      insuredCount,
      existingPoliciesCount,
      newPoliciesCount,
      payload
    };
  }

  function normalizeProposalRecord(p, idx=0){
    const payload = p?.payload && typeof p.payload === "object" ? p.payload : {};
    const operational = payload?.operational && typeof payload.operational === "object" ? payload.operational : {};
    const primary = operational?.primary || payload?.insureds?.[0]?.data || {};
    const fullName = safeTrim(p?.fullName) || safeTrim(((primary.firstName || "") + " " + (primary.lastName || "")).trim()) || "הצעה ללא שם";
    const idNumber = safeTrim(p?.idNumber) || safeTrim(primary.idNumber);
    const phone = safeTrim(p?.phone) || safeTrim(primary.phone);
    const email = safeTrim(p?.email) || safeTrim(primary.email);
    const city = safeTrim(p?.city) || safeTrim(primary.city);
    const agentName = safeTrim(p?.agentName) || safeTrim(p?.createdBy) || "";
    const createdAt = safeTrim(p?.createdAt) || nowISO();
    const updatedAt = safeTrim(p?.updatedAt) || createdAt;
    const currentStep = Math.max(1, Math.min(9, Number(p?.currentStep || payload?.currentStep || 1) || 1));
    const insuredCount = Number(p?.insuredCount || payload?.insureds?.length || 0) || 0;
    return {
      id: safeTrim(p?.id) || ("prop_" + idx + "_" + Math.random().toString(16).slice(2)),
      status: safeTrim(p?.status) || "פתוחה",
      fullName,
      idNumber,
      phone,
      email,
      city,
      agentName,
      agentRole: safeTrim(p?.agentRole) || "",
      createdAt,
      updatedAt,
      currentStep,
      insuredCount,
      payload
    };
  }

  // ---------- Storage (Supabase) ----------
  const Storage = {
    supabaseUrl: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
    client: null,

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

    restoreUrl(){ return this.supabaseUrl; },
    setUrl(){ return this.supabaseUrl; },

    getClient(){
      if(this.client) return this.client;
      if(!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("SUPABASE_CLIENT_NOT_LOADED");
      }
      this.client = window.supabase.createClient(this.supabaseUrl, this.publishableKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
      return this.client;
    },

    async ping(){
      if(!this.supabaseUrl || !this.publishableKey) return { ok:false, error:"חסרים פרטי חיבור ל-Supabase" };
      try {
        const res = await fetch(this.supabaseUrl + "/auth/v1/settings", {
          method:"GET",
          headers: {
            apikey: this.publishableKey,
            Authorization: "Bearer " + this.publishableKey
          }
        });
        if(!res.ok) return { ok:false, error:"PING_FAILED_" + res.status };
        return { ok:true, at: nowISO() };
      } catch(e) {
        return { ok:false, error: String(e?.message || e) };
      }
    },

    buildMetaRow(state){
      return {
        key: "global",
        payload: {
          adminAuth: state?.meta?.adminAuth || defaultState().meta.adminAuth,
          opsEvents: Array.isArray(state?.meta?.opsEvents) ? state.meta.opsEvents.map((ev, idx) => normalizeOpsEvent(ev, idx)).filter(Boolean) : [],
          updatedAt: nowISO()
        },
        updated_at: nowISO()
      };
    },

    buildAgentRows(state){
      return (state?.agents || []).map((a, idx) => ({
        id: safeTrim(a?.id) || ("a_" + idx),
        name: safeTrim(a?.name) || "נציג",
        username: safeTrim(a?.username) || safeTrim(a?.name) || "נציג",
        pin: safeTrim(a?.pin) || "0000",
        role: safeTrim(a?.role) || "agent",
        active: a?.active === false ? false : true,
        created_at: safeTrim(a?.created_at) || nowISO(),
        updated_at: nowISO()
      }));
    },

    buildCustomerRows(state){
      return (state?.customers || []).map((c, idx) => ({
        id: safeTrim(c?.id) || ("cust_" + idx),
        status: safeTrim(c?.status) || "חדש",
        full_name: safeTrim(c?.fullName) || "לקוח ללא שם",
        id_number: safeTrim(c?.idNumber),
        phone: safeTrim(c?.phone),
        email: safeTrim(c?.email),
        city: safeTrim(c?.city),
        agent_name: safeTrim(c?.agentName),
        agent_role: safeTrim(c?.agentRole),
        insured_count: Number(c?.insuredCount || 0) || 0,
        existing_policies_count: Number(c?.existingPoliciesCount || 0) || 0,
        new_policies_count: Number(c?.newPoliciesCount || 0) || 0,
        created_at: safeTrim(c?.createdAt) || nowISO(),
        updated_at: nowISO(),
        payload: c?.payload && typeof c.payload === "object" ? c.payload : {}
      }));
    },

    buildProposalRows(state){
      return (state?.proposals || []).map((p, idx) => ({
        id: safeTrim(p?.id) || ("prop_" + idx),
        status: safeTrim(p?.status) || "פתוחה",
        full_name: safeTrim(p?.fullName) || "הצעה ללא שם",
        id_number: safeTrim(p?.idNumber),
        phone: safeTrim(p?.phone),
        email: safeTrim(p?.email),
        city: safeTrim(p?.city),
        agent_name: safeTrim(p?.agentName),
        agent_role: safeTrim(p?.agentRole),
        current_step: Math.max(1, Math.min(9, Number(p?.currentStep || 1) || 1)),
        insured_count: Number(p?.insuredCount || 0) || 0,
        created_at: safeTrim(p?.createdAt) || nowISO(),
        updated_at: nowISO(),
        payload: p?.payload && typeof p.payload === "object" ? p.payload : {}
      }));
    },

    restHeaders(extra = {}){
      return {
        apikey: this.publishableKey,
        Authorization: "Bearer " + this.publishableKey,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...extra
      };
    },

    async restRequest(path, options = {}){
      const res = await fetch(this.supabaseUrl + "/rest/v1/" + String(path || ""), {
        method: options.method || "GET",
        headers: this.restHeaders(options.headers || {}),
        body: options.body == null ? undefined : JSON.stringify(options.body)
      });
      let payload = null;
      try { payload = await res.json(); } catch(_e) {}
      if(!res.ok){
        const msg = payload?.message || payload?.error_description || payload?.hint || ("HTTP_" + res.status);
        throw new Error(msg);
      }
      return payload;
    },

    async upsertMeta(state){
      const row = this.buildMetaRow(state);
      try {
        const client = this.getClient();
        const { error } = await client
          .from(SUPABASE_TABLES.meta)
          .upsert([row], { onConflict: "key" });
        if(error) throw error;
        return;
      } catch(primaryErr) {
        try {
          const existing = await this.restRequest(SUPABASE_TABLES.meta + "?key=eq.global&select=key", {
            method: "GET"
          });
          if(Array.isArray(existing) && existing.length){
            await this.restRequest(SUPABASE_TABLES.meta + "?key=eq.global", {
              method: "PATCH",
              body: row,
              headers: { Prefer: "return=minimal" }
            });
          } else {
            await this.restRequest(SUPABASE_TABLES.meta, {
              method: "POST",
              body: row,
              headers: { Prefer: "return=minimal" }
            });
          }
        } catch(secondaryErr) {
          console.warn("META_SAVE_SKIPPED:", secondaryErr?.message || secondaryErr, "PRIMARY:", primaryErr?.message || primaryErr);
        }
      }
    },

    async syncTable(tableName, rows){
      const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
      let existing = [];
      let canDelete = false;

      try {
        const client = this.getClient();
        const { data, error } = await client.from(tableName).select("id");
        if(error) throw error;
        existing = Array.isArray(data) ? data : [];
        canDelete = true;
      } catch(readErr) {
        try {
          const data = await this.restRequest(tableName + "?select=id", { method: "GET" });
          existing = Array.isArray(data) ? data : [];
          canDelete = true;
        } catch(restReadErr) {
          console.warn("SYNC_READ_IDS_FAILED:", tableName, restReadErr?.message || restReadErr, "PRIMARY:", readErr?.message || readErr);
        }
      }

      if(canDelete){
        const existingIds = new Set((existing || []).map(r => safeTrim(r?.id)).filter(Boolean));
        const nextIds = new Set(safeRows.map(r => safeTrim(r?.id)).filter(Boolean));
        const idsToDelete = Array.from(existingIds).filter(id => !nextIds.has(id));
        if(idsToDelete.length){
          try {
            const client = this.getClient();
            const { error: delError } = await client.from(tableName).delete().in("id", idsToDelete);
            if(delError) throw delError;
          } catch(delErr) {
            try {
              const ids = idsToDelete.map(id => '"' + String(id).replace(/"/g, '\"') + '"').join(",");
              await this.restRequest(tableName + "?id=in.(" + ids + ")", {
                method: "DELETE",
                headers: { Prefer: "return=minimal" }
              });
            } catch(restDelErr) {
              console.warn("SYNC_DELETE_FAILED:", tableName, restDelErr?.message || restDelErr, "PRIMARY:", delErr?.message || delErr);
            }
          }
        }
      }

      if(!safeRows.length) return;

      try {
        const client = this.getClient();
        const { error: upsertError } = await client.from(tableName).upsert(safeRows, { onConflict: "id" });
        if(upsertError) throw upsertError;
        return;
      } catch(primaryErr) {
        console.warn("SYNC_BULK_UPSERT_FAILED:", tableName, primaryErr?.message || primaryErr);
      }

      for (const row of safeRows){
        const id = safeTrim(row?.id);
        if(!id) continue;
        try {
          const updated = await this.restRequest(tableName + "?id=eq." + encodeURIComponent(id) + "&select=id", {
            method: "PATCH",
            body: row
          });
          if(Array.isArray(updated) && updated.length) continue;
          await this.restRequest(tableName, {
            method: "POST",
            body: row
          });
        } catch(rowErr) {
          throw rowErr;
        }
      }
    },

    mapMeta(metaRow){
      const payload = metaRow?.payload && typeof metaRow.payload === "object" ? metaRow.payload : {};
      return {
        updatedAt: safeTrim(payload?.updatedAt) || safeTrim(metaRow?.updated_at) || nowISO(),
        adminAuth: payload?.adminAuth || defaultState().meta.adminAuth,
        opsEvents: Array.isArray(payload?.opsEvents) ? payload.opsEvents.map((ev, idx) => normalizeOpsEvent(ev, idx)).filter(Boolean) : []
      };
    },

    mapAgentRow(row, idx){
      return {
        id: safeTrim(row?.id) || ("a_" + idx),
        name: safeTrim(row?.name),
        username: safeTrim(row?.username),
        pin: safeTrim(row?.pin),
        role: safeTrim(row?.role) || "agent",
        active: row?.active === false ? false : true,
        created_at: safeTrim(row?.created_at),
        updated_at: safeTrim(row?.updated_at)
      };
    },

    mapCustomerRow(row, idx){
      return normalizeCustomerRecord({
        id: row?.id,
        status: row?.status,
        fullName: row?.full_name,
        idNumber: row?.id_number,
        phone: row?.phone,
        email: row?.email,
        city: row?.city,
        agentName: row?.agent_name,
        agentRole: row?.agent_role,
        insuredCount: row?.insured_count,
        existingPoliciesCount: row?.existing_policies_count,
        newPoliciesCount: row?.new_policies_count,
        createdAt: row?.created_at,
        updatedAt: row?.updated_at,
        payload: row?.payload || {}
      }, idx);
    },

    mapProposalRow(row, idx){
      return normalizeProposalRecord({
        id: row?.id,
        status: row?.status,
        fullName: row?.full_name,
        idNumber: row?.id_number,
        phone: row?.phone,
        email: row?.email,
        city: row?.city,
        agentName: row?.agent_name,
        agentRole: row?.agent_role,
        currentStep: row?.current_step,
        insuredCount: row?.insured_count,
        createdAt: row?.created_at,
        updatedAt: row?.updated_at,
        payload: row?.payload || {}
      }, idx);
    },

    async loadTableRows(tableName, selectExpr = "*"){
      try {
        const client = this.getClient();
        const { data, error } = await client.from(tableName).select(selectExpr);
        if(error) throw error;
        return { ok:true, data: data || [] };
      } catch(primaryErr) {
        try {
          const data = await this.restRequest(tableName + "?select=" + encodeURIComponent(selectExpr), { method: "GET" });
          return { ok:true, data: data || [] };
        } catch(restErr) {
          return { ok:false, error: String(restErr?.message || primaryErr?.message || restErr || primaryErr) };
        }
      }
    },

    async loadMetaRow(){
      try {
        const client = this.getClient();
        const { data, error } = await client.from(SUPABASE_TABLES.meta).select("key,payload,updated_at").eq("key", "global").maybeSingle();
        if(error) throw error;
        return { ok:true, data: data || {} };
      } catch(primaryErr) {
        try {
          const data = await this.restRequest(SUPABASE_TABLES.meta + "?key=eq.global&select=key,payload,updated_at", { method: "GET" });
          return { ok:true, data: Array.isArray(data) ? (data[0] || {}) : (data || {}) };
        } catch(restErr) {
          return { ok:false, error: String(restErr?.message || primaryErr?.message || restErr || primaryErr) };
        }
      }
    },

    async loadSheets(){
      try {
        const [metaRes, agentsRes, customersRes, proposalsRes] = await Promise.all([
          this.loadMetaRow(),
          this.loadTableRows(SUPABASE_TABLES.agents),
          this.loadTableRows(SUPABASE_TABLES.customers),
          this.loadTableRows(SUPABASE_TABLES.proposals)
        ]);

        const criticalErr = agentsRes.ok ? (customersRes.ok ? (proposalsRes.ok ? null : proposalsRes.error) : customersRes.error) : agentsRes.error;
        if(criticalErr) return { ok:false, error: String(criticalErr) };

        const payload = normalizeState({
          meta: this.mapMeta(metaRes.ok ? (metaRes.data || {}) : {}),
          agents: (agentsRes.data || []).map((row, idx) => this.mapAgentRow(row, idx)),
          customers: (customersRes.data || []).map((row, idx) => this.mapCustomerRow(row, idx)),
          proposals: (proposalsRes.data || []).map((row, idx) => this.mapProposalRow(row, idx))
        });
        return { ok:true, payload, at: payload?.meta?.updatedAt || nowISO() };
      } catch(e) {
        return { ok:false, error: String(e?.message || e) };
      }
    },

    async saveSheets(state){
      try {
        await this.upsertMeta(state);
        await this.syncTable(SUPABASE_TABLES.agents, this.buildAgentRows(state));
        await this.syncTable(SUPABASE_TABLES.customers, this.buildCustomerRows(state));
        await this.syncTable(SUPABASE_TABLES.proposals, this.buildProposalRows(state));
        return { ok:true, at: nowISO() };
      } catch(e) {
        return { ok:false, error: String(e?.message || e) };
      }
    },

    async sendAdminContact(){
      return { ok:false, error:"SUPABASE_NO_MAIL_ENDPOINT" };
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
        err: $("#lcLoginError"),
      };

      // show login immediately
      try {
        document.body.classList.add("lcAuthLock");
        this.els.wrap?.setAttribute?.("aria-hidden","false");
      } catch(_) {}

      try { localStorage.removeItem(LS_SESSION_KEY); } catch(_) {}
      this.lock();

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

    isOps(){
      return !!(this.current && this.current.role === "ops");
    },

    canViewAllCustomers(){
      return this.isAdmin() || this.isManager() || this.isOps();
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

      this._setError("");
      if(!username) return this._setError("נא להזין שם משתמש");
      if(!pin) return this._setError("נא להזין קוד כניסה");

      // ensure boot done
      try { await App._bootPromise; } catch(_) {}

      const defAdmin = { username:"מנהל מערכת", pin:"1234" };
      const adminAuth = State.data?.meta?.adminAuth || { ...defAdmin, active:true };

      if (adminAuth.active !== false && username === safeTrim(adminAuth.username) && pin === safeTrim(adminAuth.pin)) {
        this.current = { name: safeTrim(adminAuth.username) || defAdmin.username, role:"admin" };
        try { localStorage.removeItem(LS_SESSION_KEY); } catch(_) {}
        await App.reloadSessionState();
        this.unlock();
        UI.applyRoleUI();
        UI.renderAuthPill();
        await WelcomeLoader.play(this.current.name, 4800);
        UI.goView("settings");
        try { ChatUI.onLogin(); } catch(_e) {}
        return;
      }

      const agents = Array.isArray(State.data?.agents) ? State.data.agents : [];
      const matched = agents.find(a => safeTrim(a?.username) === username) || agents.find(a => safeTrim(a?.name) === username);
      if(!matched) return this._setError("שם משתמש לא נמצא");
      if(matched.active === false) return this._setError("המשתמש מושבת");
      const expected = safeTrim(matched.pin) || "0000";
      if(pin !== expected) return this._setError("קוד כניסה שגוי");

      this.current = { name: matched.name, role: (matched.role === "manager" ? "manager" : matched.role === "ops" ? "ops" : "agent") };
      try { localStorage.removeItem(LS_SESSION_KEY); } catch(_) {}
      await App.reloadSessionState();
      this.unlock();
      UI.applyRoleUI();
      UI.renderAuthPill();
      await WelcomeLoader.play(this.current.name, 4800);
      UI.goView("dashboard");
      try { ChatUI.onLogin(); } catch(_e) {}
    }
  };

  function getTimeGreeting(){
    const hour = new Date().getHours();
    if(hour < 12) return "בוקר טוב";
    if(hour < 17) return "צהריים טובים";
    return "ערב טוב";
  }

  const WelcomeLoader = {
    el: null,
    ensure(){
      if(this.el) return this.el;
      const root = document.createElement("div");
      root.id = "lcWelcomeLoader";
      root.className = "lcWelcomeLoader";
      root.setAttribute("aria-hidden", "true");
      root.innerHTML = `
        <div class="lcWelcomeLoader__backdrop"></div>
        <div class="lcWelcomeLoader__panel" role="status" aria-live="polite" aria-atomic="true">
          <div class="lcWelcomeLoader__shell">
            <div class="lcWelcomeLoader__orb lcWelcomeLoader__orb--a" aria-hidden="true"></div>
            <div class="lcWelcomeLoader__orb lcWelcomeLoader__orb--b" aria-hidden="true"></div>
            <div class="lcWelcomeLoader__logoWrap" aria-hidden="true">
              <img class="lcWelcomeLoader__logo" src="./logo-login-clean.png" alt="GEMEL INVEST" />
            </div>
            <div class="lcWelcomeLoader__greeting" id="lcWelcomeGreeting"></div>
            <div class="lcWelcomeLoader__name" id="lcWelcomeName"></div>
            <div class="lcWelcomeLoader__sub">טוען מערכת, אנא המתן</div>
            <div class="lcWelcomeLoader__dots" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div class="lcWelcomeLoader__reflection" aria-hidden="true"></div>
          </div>
        </div>
      `;
      document.body.appendChild(root);
      this.el = root;
      return root;
    },
    open(name){
      const root = this.ensure();
      const greetingEl = root.querySelector('#lcWelcomeGreeting');
      const nameEl = root.querySelector('#lcWelcomeName');
      if(greetingEl) greetingEl.textContent = getTimeGreeting();
      if(nameEl) nameEl.textContent = safeTrim(name);
      root.classList.add('is-open');
      root.setAttribute('aria-hidden', 'false');
    },
    close(){
      const root = this.ensure();
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
    },
    async play(name, ms=4000){
      this.open(name);
      await new Promise(resolve => setTimeout(resolve, ms));
      this.close();
    }
  };

  // ---------- Forgot Password / Contact Admin ----------
  const ForgotPasswordUI = {
    els: null,

    init(){
      this.els = {
        trigger: $("#lcForgotPasswordBtn"),
        wrap: $("#lcForgotModal"),
        backdrop: $("#lcForgotModalBackdrop"),
        close: $("#lcForgotModalClose"),
        cancel: $("#lcForgotModalCancel"),
        send: $("#lcForgotModalSend"),
        username: $("#lcForgotUsername"),
        message: $("#lcForgotMessage"),
        err: $("#lcForgotModalError"),
        success: $("#lcForgotModalSuccess")
      };

      on(this.els.trigger, "click", () => this.open());
      on(this.els.close, "click", () => this.close());
      on(this.els.cancel, "click", () => this.close());
      on(this.els.backdrop, "click", () => this.close());
      on(this.els.send, "click", () => this.submit());
      on(this.els.wrap, "keydown", (ev) => {
        if(ev.key === "Escape"){
          ev.preventDefault();
          this.close();
        }
      });
    },

    open(){
      if(!this.els?.wrap) return;
      this.setError("");
      this.setSuccess("");
      const loginUser = safeTrim($("#lcLoginUser")?.value);
      this.els.username.value = loginUser || this.els.username.value || "";
      this.els.wrap.classList.add("is-open");
      this.els.wrap.setAttribute("aria-hidden","false");
      setTimeout(() => {
        if(this.els.username.value) this.els.message?.focus?.();
        else this.els.username?.focus?.();
      }, 50);
    },

    close(){
      if(!this.els?.wrap) return;
      this.els.wrap.classList.remove("is-open");
      this.els.wrap.setAttribute("aria-hidden","true");
      this.setError("");
      this.setSuccess("");
    },

    setError(msg){
      if(this.els?.err) this.els.err.textContent = msg ? String(msg) : "";
    },

    setSuccess(msg){
      if(!this.els?.success) return;
      const hasMsg = !!msg;
      const textEl = this.els.success.querySelector('.lcForgotModal__successText');
      if(textEl) textEl.textContent = msg ? String(msg) : '';
      else this.els.success.textContent = msg ? String(msg) : '';
      this.els.success.classList.toggle('is-visible', hasMsg);
    },

    buildMailto(username, message){
      const subject = "פנייה ממסך כניסה – GEMEL INVEST";
      const body = [
        "שם משתמש: " + safeTrim(username),
        "",
        "הודעה:",
        safeTrim(message),
        "",
        "Build: " + BUILD,
        "Sent: " + nowISO()
      ].join("\n");
      return `mailto:${encodeURIComponent(ADMIN_CONTACT_EMAIL)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    },

    async submit(){
      const username = safeTrim(this.els?.username?.value);
      const message = safeTrim(this.els?.message?.value);
      this.setError("");
      this.setSuccess("");

      if(!username) return this.setError("נא להזין שם משתמש");
      if(!message) return this.setError("נא לכתוב את תוכן הפנייה");

      const btn = this.els?.send;
      const prevText = btn?.textContent || "שלח פנייה";
      if(btn){
        btn.disabled = true;
        btn.textContent = "שולח...";
      }

      const result = await Storage.sendAdminContact({ username, message });
      if(result.ok){
        this.setSuccess("הפנייה נשלחה בהצלחה למנהל המערכת.");
        if(this.els?.message) this.els.message.value = "";
        if(btn){
          btn.disabled = false;
          btn.textContent = prevText;
        }
        setTimeout(() => this.close(), 1800);
        return;
      }

      try {
        window.location.href = this.buildMailto(username, message);
        this.setSuccess("נפתח חלון מייל לשליחת הפנייה למנהל המערכת.");
      } catch(_e) {
        this.setError("לא הצלחתי לשלוח אוטומטית. בשלב זה הפנייה תיפתח כמייל רגיל למנהל המערכת.");
      } finally {
        if(btn){
          btn.disabled = false;
          btn.textContent = prevText;
        }
      }
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
      this.els.navCustomers = $("#navCustomers");
      this.els.navProposals = $("#navProposals");
      this.els.navMirrors = $("#navMirrors");
      this.els.navMyProcesses = $("#navMyProcesses");
      this.els.myProcessesTbody = $("#myProcessesTbody");
      this.els.myProcessesSearch = $("#myProcessesSearch");
      this.els.myProcessesCountBadge = $("#myProcessesCountBadge");
      this.els.btnMyProcessesRefresh = $("#btnMyProcessesRefresh");
      this.els.myProcessesSummary = $("#myProcessesSummary");
      this.els.myProcessesScope = $("#myProcessesScope");
      this.els.customersTbody = $("#customersTbody");
      this.els.customersSearch = $("#customersSearch");
      this.els.customersCountBadge = $("#customersCountBadge");
      this.els.btnCustomersRefresh = $("#btnCustomersRefresh");
      this.els.proposalsTbody = $("#proposalsTbody");
      this.els.proposalsSearch = $("#proposalsSearch");
      this.els.proposalsCountBadge = $("#proposalsCountBadge");
      this.els.btnProposalsRefresh = $("#btnProposalsRefresh");

      on(this.els.btnLogout, "click", () => Auth.logout());
// nav
      $$(".nav__item").forEach(btn => {
        on(btn, "click", () => {
          const v = btn.getAttribute("data-view");
          if(!v) return;
          if(v === "settings" && !Auth.isAdmin()) return;
          if(v === "users" && !Auth.canManageUsers()) return;
          if(v === "mirrors" && !Auth.isOps()) return;
          if(v === "myProcesses" && !Auth.isOps()) return;
          this.goView(v);
        });
      });

      // settings
      if(this.els.gsUrl) {
        this.els.gsUrl.value = Storage.supabaseUrl || "";
        this.els.gsUrl.readOnly = true;
        on(this.els.gsUrl, "change", () => {
          this.renderSyncStatus("כתובת Supabase קבועה", "ok");
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
      on(this.els.customersSearch, "input", () => CustomersUI.render());
      on(this.els.btnCustomersRefresh, "click", () => CustomersUI.render());
      on(this.els.proposalsSearch, "input", () => ProposalsUI.render());
      on(this.els.btnProposalsRefresh, "click", () => ProposalsUI.render());
      on(this.els.myProcessesSearch, "input", () => ProcessesUI.render());
      on(this.els.btnMyProcessesRefresh, "click", () => ProcessesUI.render());
      on(this.els.myProcessesScope, "click", (ev) => {
        const btn = ev.target?.closest?.("[data-process-scope]");
        if(!btn) return;
        $$(".segmented__btn", this.els.myProcessesScope).forEach(el => el.classList.toggle("is-active", el === btn));
        ProcessesUI.render();
      });
this.applyRoleUI();
      this.renderAuthPill();
    },

    applyRoleUI(){
      const isAdmin = Auth.isAdmin();
      const isOps = Auth.isOps();
      const canUsers = Auth.canManageUsers();
      const settingsBtn = document.querySelector('.nav__item[data-view="settings"]');
      const newCustomerBtn = document.getElementById("btnNewCustomerWizard");
      if (settingsBtn) settingsBtn.style.display = isAdmin ? "" : "none";
      if (this.els.navUsers) this.els.navUsers.style.display = canUsers ? "" : "none";
      if (this.els.navCustomers) this.els.navCustomers.style.display = Auth.current ? "" : "none";
      if (this.els.navProposals) this.els.navProposals.style.display = (Auth.current && !isOps) ? "" : "none";
      if (this.els.navMirrors) this.els.navMirrors.style.display = isOps ? "" : "none";
      if (this.els.navMyProcesses) this.els.navMyProcesses.style.display = isOps ? "" : "none";
      if (newCustomerBtn) newCustomerBtn.style.display = isOps ? "none" : "";
    },

    setActiveNav(view){
      $$(".nav__item").forEach(b => b.classList.toggle("is-active", b.getAttribute("data-view") === view));
    },

    goView(view){
      let safe = String(view || "dashboard");
      if(safe === "settings" && !Auth.isAdmin()) safe = "dashboard";
      if(safe === "users" && !Auth.canManageUsers()) safe = "dashboard";
      if(safe === "mirrors" && !Auth.isOps()) safe = "dashboard";
      if(safe === "myProcesses" && !Auth.isOps()) safe = "dashboard";
      if(safe === "customers" && !Auth.current) safe = "dashboard";
      if(safe === "proposals" && !Auth.current) safe = "dashboard";
      // hide all views
      $$(".view").forEach(v => v.classList.remove("is-visible"));
      const el = $("#view-" + safe);
      if (el) el.classList.add("is-visible");

      // title
      if (this.els.pageTitle) {
        const map = {
          dashboard: "דשבורד",
          customers: "לקוחות",
          proposals: "הצעות",
          myProcesses: "התהליכים שלי",
          mirrors: "שיקופים",
          discountSpec: "מפרט הנחות ביטוח",
          settings: "הגדרות מערכת",
          users: "ניהול משתמשים"
        };
        this.els.pageTitle.textContent = map[safe] || "דשבורד";
      }

      this.setActiveNav(safe);
      document.body.classList.remove("view-users-active","view-dashboard-active","view-settings-active","view-discountSpec-active","view-customers-active","view-proposals-active","view-myProcesses-active","view-mirrors-active");
      document.body.classList.add("view-" + safe + "-active");

      // render view data
      if (safe === "users") UsersUI.render();
      if (safe === "customers") CustomersUI.render();
      if (safe === "proposals") ProposalsUI.render();
      if (safe === "myProcesses") ProcessesUI.render();
      if (safe === "mirrors") MirrorsUI.render();
    },

    renderAuthPill(){
      const pill = this.els.userPill;
      const txt = this.els.userPillText;
      if(!pill || !txt) return;

      if(Auth.current) {
        pill.style.display = "";
txt.textContent = Auth.current.name + (Auth.isAdmin() ? " (מנהל מערכת)" : Auth.isManager() ? " (מנהל)" : Auth.isOps() ? " (תפעול)" : "");
      } else {
        pill.style.display = "none";
txt.textContent = "";
      }
    },

    renderSyncStatus(label, level="warn", at=null, err=null){
      const dot = this.els.syncDot;
      const t = this.els.syncText;
      const last = this.els.lastSyncText;

      if (t) t.textContent = "מצב: Supabase" + (label ? " · " + label : "");
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
    _modalEls: null,
    _modalMode: "add",
    _ensureModal(){
      if(this._modalEls) return this._modalEls;
      this._modalEls = {
        wrap: $("#lcUserModal"),
        title: $("#lcUserModalTitle"),
        close: $("#lcUserModalClose"),
        cancel: $("#lcUserModalCancel"),
        save: $("#lcUserModalSave"),
        id: $("#lcUserId"),
        name: $("#lcUserName"),
        username: $("#lcUserUsername"),
        pin: $("#lcUserPin"),
        role: $("#lcUserRole"),
        active: $("#lcUserActive"),
        err: $("#lcUserModalErr"),
        nameErr: $("#lcUserNameErr"),
        userErr: $("#lcUserUsernameErr"),
        pinErr: $("#lcUserPinErr"),
      };

      const E = this._modalEls;
      const closeFn = () => this.closeModal();

      on(E.close, "click", closeFn);
      on(E.cancel, "click", closeFn);
      on(E.wrap, "click", (ev) => {
        const t = ev.target;
        if(t && t.getAttribute && t.getAttribute("data-close") === "1") closeFn();
      });
      on(E.save, "click", async () => {
        await this._saveFromModal();
      });

      on(E.wrap, "keydown", (ev) => {
        if(ev.key === "Escape"){ ev.preventDefault(); closeFn(); }
        if(ev.key === "Enter"){
          const tag = (ev.target && ev.target.tagName) ? ev.target.tagName.toLowerCase() : "";
          if(tag === "input" || tag === "select"){
            ev.preventDefault();
            this._saveFromModal();
          }
        }
      });

      return this._modalEls;
    },

    openModal(mode, user){
      const E = this._ensureModal();
      this._modalMode = (mode === "edit") ? "edit" : "add";

      // clear errors
      const hide = (el) => { if(el){ el.style.display="none"; } };
      hide(E.err); hide(E.nameErr); hide(E.userErr); hide(E.pinErr);

      if(E.title) E.title.textContent = (this._modalMode === "edit") ? "עריכת משתמש" : "הוסף נציג/סוכן";

      if(E.id) E.id.value = user ? (user.id || "") : "";
      if(E.name) E.name.value = user ? (user.name || "") : "";
      if(E.username) E.username.value = user ? (user.username || "") : "";
      if(E.pin) E.pin.value = user ? (user.pin || "") : "0000";
      if(E.role) E.role.value = user ? (user.role || "agent") : "agent";
      if(E.active) E.active.checked = user ? (user.active !== false) : true;

      if(E.wrap){
        E.wrap.classList.add("is-open");
        E.wrap.setAttribute("aria-hidden","false");
      }
      setTimeout(() => E.name?.focus?.(), 50);
    },

    closeModal(){
      const E = this._ensureModal();
      if(E.wrap){
        E.wrap.classList.remove("is-open");
        E.wrap.setAttribute("aria-hidden","true");
      }
    },

    _showErr(el, msg){
      if(!el) return;
      el.textContent = String(msg || "");
      el.style.display = msg ? "block" : "none";
    },

    async _saveFromModal(){
      const E = this._ensureModal();
      const name = safeTrim(E.name?.value);
      const username = safeTrim(E.username?.value) || name;
      const pin = safeTrim(E.pin?.value);
      const role = safeTrim(E.role?.value) || "agent";
      const active = !!E.active?.checked;

      // validate
      let ok = true;
      this._showErr(E.nameErr, name ? "" : "נא להזין שם");
      this._showErr(E.userErr, username ? "" : "נא להזין שם משתמש");
      this._showErr(E.pinErr, pin ? "" : "נא להזין PIN");
      if(!name || !username || !pin) ok = false;

      if(!ok){
        this._showErr(E.err, "חסרים שדות חובה");
        return;
      }
      this._showErr(E.err, "");

      State.data.agents = Array.isArray(State.data.agents) ? State.data.agents : [];

      const id = safeTrim(E.id?.value);
      const isEdit = (this._modalMode === "edit") && id;
      if(isEdit){
        const a = State.data.agents.find(x => String(x.id) === String(id));
        if(!a){
          this._showErr(E.err, "המשתמש לא נמצא");
          return;
        }
        a.name = name;
        a.username = username;
        a.pin = pin;
        a.role = (role === "manager" ? "manager" : role === "ops" ? "ops" : "agent");
        a.active = active;
        State.data.meta.updatedAt = nowISO();
        await App.persist("עודכן משתמש");
      } else {
        const newId = "a_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
        State.data.agents.push({
          id: newId,
          name,
          username,
          pin,
          role: (role === "manager" ? "manager" : role === "ops" ? "ops" : "agent"),
          active: true
        });
        State.data.meta.updatedAt = nowISO();
        await App.persist("נשמר משתמש חדש");
      }

      this.closeModal();
      this.render();
    },

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
        const role = (a.role === "manager") ? "מנהל" : (a.role === "ops") ? "תפעול" : "נציג";
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
      this.openModal("add", null);
    },

    async editUser(id){
      const a = (State.data.agents || []).find(x => String(x.id) === String(id));
      if(!a) return;
      this.openModal("edit", a);
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

  // ---------- Customers UI ----------
  const CustomersUI = {
    currentId: null,
    els: {},
    policyModal: {},
    init(){
      this.els.wrap = $("#customerFull");
      this.els.backdrop = $("#customerFullBackdrop");
      this.els.close = $("#customerFullClose");
      this.els.archiveBtn = $("#customerFullArchiveBtn");
      this.els.name = $("#customerFullName");
      this.els.meta = $("#customerFullMeta");
      this.els.avatar = $("#customerFullAvatar");
      this.els.dash = $("#customerFullDash");
      this.els.body = $("#customerFullBody");

      this.policyModal.wrap = $("#customerPolicyModal");
      this.policyModal.backdrop = $("#customerPolicyModalBackdrop");
      this.policyModal.close = $("#customerPolicyModalClose");
      this.policyModal.title = $("#customerPolicyModalTitle");
      this.policyModal.body = $("#customerPolicyModalBody");
      this.els.loader = $("#customerLoader");

      on(UI.els.customersTbody, "click", (ev) => {
        const openBtn = ev.target?.closest?.("[data-open-customer]");
        if(openBtn){
          const customerId = openBtn.getAttribute("data-open-customer");
          this.handleOpenCustomerClick(ev, customerId);
          return;
        }

      });

      on(this.els.close, "click", () => this.close());
      on(this.els.backdrop, "click", () => this.close());
      on(this.els.archiveBtn, "click", (ev) => {
        const rec = this.current();
        if(!rec) return;
        this.handleArchiveCustomerClick(ev, rec.id);
      });
      on(this.els.body, "click", (ev) => {
        const backBtn = ev.target?.closest?.("#customerMedicalBackBtn");
        if(!backBtn) return;
        const rec = this.current();
        if(!rec) return;
        this.currentSection = "wallet";
        this.renderCurrentSection(rec);
      });

      on(this.els.dash, "click", async (ev) => {
        const btn = ev.target?.closest?.('[data-ops-result]');
        if(!btn) return;
        const rec = this.current();
        if(!rec || !Auth.isOps()) return;
        const next = safeTrim(btn.getAttribute('data-ops-result'));
        setOpsTouch(rec, {
          ownerName: safeTrim(Auth?.current?.name),
          updatedBy: safeTrim(Auth?.current?.name),
          resultStatus: next,
          liveState: 'call_finished'
        });
        this.refreshOperationalReflectionCard();
        ProcessesUI.render();
        await App.persist('עודכן סטטוס תפעולי');
      });

      on(this.policyModal.close, "click", () => this.closePolicyModal());
      on(this.policyModal.backdrop, "click", () => this.closePolicyModal());
      on(this.policyModal.wrap, "click", (ev) => {
        if(ev.target?.getAttribute?.("data-close") === "1") this.closePolicyModal();
      });
    },

    list(){
      const all = Array.isArray(State.data?.customers) ? State.data.customers.slice() : [];
      const visible = all.filter(rec => Auth.canViewAllCustomers() || safeTrim(rec.agentName) === safeTrim(Auth?.current?.name));
      visible.sort((a,b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
      return visible;
    },

    filtered(){
      const q = safeTrim(UI.els.customersSearch?.value).toLowerCase();
      let rows = this.list();
      if(!q) return rows;
      return rows.filter(rec => [rec.fullName, rec.idNumber, rec.phone, rec.agentName, rec.email, rec.city].some(v => safeTrim(v).toLowerCase().includes(q)));
    },

    handleOpenCustomerClick(ev, customerId){
      ev?.preventDefault?.();
      ev?.stopPropagation?.();
      ev?.stopImmediatePropagation?.();
      const id = safeTrim(customerId);
      if(!id) return;
      window.clearTimeout(this._loaderTimer);
      this.openByIdWithLoader(id);
    },

    handleArchiveCustomerClick(ev, customerId){
      ev?.preventDefault?.();
      ev?.stopPropagation?.();
      ev?.stopImmediatePropagation?.();
      const id = safeTrim(customerId);
      if(!id) return;
      window.clearTimeout(this._loaderTimer);
      try{
        this.hideLoader();
      }catch(_e){}
      try{
        ArchiveCustomerUI.close();
      }catch(_e){}
      requestAnimationFrame(() => ArchiveCustomerUI.open(id));
    },

    bindRowActionButtons(){
      if(!UI.els.customersTbody) return;
      $$('[data-open-customer]', UI.els.customersTbody).forEach(btn => {
        btn.onclick = (ev) => this.handleOpenCustomerClick(ev, btn.getAttribute('data-open-customer'));
      });
    },

    render(){
      if(!UI.els.customersTbody) return;
      const rows = this.filtered();
      if(UI.els.customersCountBadge){
        UI.els.customersCountBadge.textContent = rows.length + " לקוחות";
      }
      UI.els.customersTbody.innerHTML = rows.length ? rows.map(rec => {
        const updated = this.formatDate(rec.updatedAt || rec.createdAt);
        return `<tr class="lcCustomerRow">
          <td><div class="lcCustomers__nameCell"><strong>${escapeHtml(rec.fullName || "—")}</strong><span class="muted small">${escapeHtml(rec.city || "")}</span></div></td>
          <td>${escapeHtml(rec.idNumber || "—")}</td>
          <td dir="ltr">${escapeHtml(rec.phone || "—")}</td>
          <td>${escapeHtml(rec.agentName || "—")}</td>
          <td><span class="badge">${escapeHtml(rec.status || "חדש")}</span></td>
          <td>${escapeHtml(updated)}</td>
          <td>
            <div class="lcCustomers__rowActions lcCustomers__rowActions--folder">
              <button class="lcCustomerFolderBtn" data-open-customer="${escapeHtml(rec.id)}" type="button" aria-label="פתח תיק לקוח עבור ${escapeHtml(rec.fullName || "לקוח")}" title="פתח תיק">
                <span class="lcCustomerFolderBtn__glow" aria-hidden="true"></span>
                <img class="lcCustomerFolderBtn__img" src="./folder-customer.png" alt="" />
              </button>
            </div>
          </td>
        </tr>`;
      }).join("") : `<tr><td colspan="7"><div class="emptyState"><div class="emptyState__icon">🗂️</div><div class="emptyState__title">עדיין אין לקוחות</div><div class="emptyState__text">ברגע שמסיימים הקמת לקוח, הלקוח יישמר כאן אוטומטית ויהיה אפשר לפתוח את תיק הלקוח המלא.</div></div></td></tr>`;

      this.bindRowActionButtons();
    },

    showLoader(){
      if(!this.els.loader) return;
      this.els.loader.classList.add("is-visible");
      this.els.loader.setAttribute("aria-hidden","false");
      document.body.style.overflow = "hidden";
    },

    hideLoader(){
      if(!this.els.loader) return;
      this.els.loader.classList.remove("is-visible");
      this.els.loader.setAttribute("aria-hidden","true");
    },

    openByIdWithLoader(id, delay=1650){
      const rec = this.byId(id);
      if(!rec) {
        console.warn("CUSTOMER_OPEN_NOT_FOUND", id);
        return;
      }
      try {
        Wizard?.hideFinishFlow?.();
        Wizard?.closeHealthFindingsModal?.();
        Wizard?.closePolicyDiscountModal?.();
        Wizard?.closeCoversDrawer?.();
      } catch(_e) {}
      this.showLoader();
      window.clearTimeout(this._loaderTimer);
      this._loaderTimer = window.setTimeout(() => {
        try{
          this.hideLoader();
          this.openById(id);
        }catch(err){
          console.error("CUSTOMER_OPEN_WITH_LOADER_FAILED", err, id);
          this.hideLoader();
          this.openById(id, { skipLoader:true });
        }
      }, Math.max(80, Number(delay) || 0));
    },

    byId(id){
      return (State.data?.customers || []).find(x => String(x.id) === String(id)) || null;
    },

    getAvatarText(rec){
      const name = safeTrim(rec?.fullName || "");
      if(!name) return "ל";
      const parts = name.split(/\s+/).filter(Boolean);
      return safeTrim(parts[0]?.[0] || name[0] || "ל");
    },

    sumPremium(policies=[]){
      return policies.reduce((sum, p) => sum + this.asNumber(p.premiumValue), 0);
    },

    sumPremiumAfterDiscount(policies=[]){
      return policies.reduce((sum, p) => sum + this.asNumber(p.premiumAfterDiscountValue ?? p.premiumAfterDiscount ?? p.premiumValue), 0);
    },

    getNewPoliciesOnly(policies=[]){
      return (Array.isArray(policies) ? policies : []).filter(p => String(p?.origin || '') === 'new');
    },

    getPremiumToneClass(amount){
      const n = Number(amount) || 0;
      if(n >= 1000) return 'is-premium-high';
      if(n >= 400) return 'is-premium-mid';
      return 'is-premium-low';
    },

    asNumber(v){
      const n = Number(String(v ?? "").replace(/[^\d.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    },

    formatMoney(v){
      const n = this.asNumber(v);
      if(!n) return "₪0";
      try{ return "₪" + n.toLocaleString("he-IL"); }catch(_){ return "₪" + n; }
    },

    asMoneyNumber(v){
      return this.asNumber(v);
    },

    getPolicyDiscountPct(policy){
      const raw = policy?.discountPct ?? policy?.discountPercent ?? 0;
      const n = Number(String(raw).replace(/[^\d.\-]/g, ""));
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    },

    getPolicyDiscountSchedule(policy){
      if(Array.isArray(policy?.discountSchedule)){
        return policy.discountSchedule
          .map((item, idx) => {
            const year = Math.max(1, Math.min(10, Number(item?.year || (idx + 1)) || (idx + 1)));
            const pct = Number(String(item?.pct ?? item?.discountPct ?? "0").replace(/[^\d.\-]/g, ""));
            return { year, pct: Number.isFinite(pct) ? Math.max(0, pct) : 0 };
          })
          .filter(item => item.pct > 0)
          .sort((a,b) => a.year - b.year);
      }
      const years = Math.max(0, Math.min(10, Number(String(policy?.discountYears || "").replace(/[^\d]/g, "")) || 0));
      const pct = this.getPolicyDiscountPct(policy);
      if(!years || pct <= 0) return [];
      return Array.from({ length: years }, (_, idx) => ({ year: idx + 1, pct }));
    },

    getPolicyDiscountYearsLabel(policy){
      const schedule = this.getPolicyDiscountSchedule(policy);
      if(schedule.length) return String(schedule.length);
      return safeTrim(policy?.discountYears || "");
    },

    getPolicyDiscountScheduleSummary(policy){
      const schedule = this.getPolicyDiscountSchedule(policy);
      if(!schedule.length) return "";
      return schedule.map(item => `שנה ${item.year}: ${item.pct}%`).join(" · ");
    },

    getPolicyDiscountDisplayText(policy, options = {}){
      const pct = this.getPolicyDiscountPct(policy);
      const years = this.getPolicyDiscountYearsLabel(policy);
      const scheduleSummary = this.getPolicyDiscountScheduleSummary(policy);
      const compact = options && options.compact;
      if(scheduleSummary){
        return compact ? `${pct}% · ${years} שנים` : `${pct}% · ${scheduleSummary}`;
      }
      return pct > 0 || years ? `${pct}%${years ? ` · ${years} שנים` : ''}` : 'ללא הנחה';
    },

    getPolicyPremiumAfterDiscount(policy){
      const base = this.asMoneyNumber(policy?.premiumMonthly ?? policy?.monthlyPremium ?? policy?.premium ?? policy?.premiumBefore);
      const pct = this.getPolicyDiscountPct(policy);
      const out = base * (1 - (pct / 100));
      return Math.max(0, Math.round(out * 100) / 100);
    },

    formatMoneyValue(v){
      const n = Number(v);
      if(!Number.isFinite(n)) return "—";
      return `₪${n.toLocaleString("he-IL", { maximumFractionDigits: n % 1 ? 2 : 0 })}`;
    },

    collectPolicies(rec){
      const payload = rec?.payload || {};
      const sourceInsureds = Array.isArray(payload.insureds) && payload.insureds.length
        ? payload.insureds
        : (Array.isArray(payload?.operational?.insureds) ? payload.operational.insureds : []);
      const sourceNewPolicies = Array.isArray(payload.newPolicies) && payload.newPolicies.length
        ? payload.newPolicies
        : (Array.isArray(payload?.operational?.newPolicies) ? payload.operational.newPolicies : []);
      const policies = [];
      sourceInsureds.forEach((ins, idx) => {
        const insuredLabel = safeTrim(ins?.label) || safeTrim(ins?.type) || `מבוטח ${idx+1}`;
        (ins?.data?.existingPolicies || []).forEach((p, pIdx) => {
          const type = safeTrim(p?.type || p?.product || "פוליסה");
          const monthlyPremium = safeTrim(p?.monthlyPremium || p?.premiumMonthly || p?.premium || p?.premiumBefore || "");
          const coverItems = Array.isArray(p?.covers) ? p.covers.filter(Boolean) : [];
          const coverageValue = safeTrim(p?.sumInsured || p?.compensation || p?.coverage || (coverItems.length ? coverItems.join(", ") : ""));
          const discountPct = this.getPolicyDiscountPct(p);
          const discountYears = this.getPolicyDiscountYearsLabel(p);
          const premiumAfterDiscountValue = this.getPolicyPremiumAfterDiscount(p);
          const premiumAfterDiscount = this.formatMoneyValue(premiumAfterDiscountValue);
          policies.push({
            id: safeTrim(p?.id) || `existing_${idx}_${pIdx}`,
            origin: "existing",
            insuredLabel,
            company: safeTrim(p?.company),
            type,
            premiumText: monthlyPremium ? this.formatMoney(monthlyPremium) : "—",
            premiumValue: monthlyPremium,
            discountPct: String(discountPct),
            discountYears,
            premiumAfterDiscount,
            premiumAfterDiscountValue,
            startDate: safeTrim(p?.startDate),
            policyNumber: safeTrim(p?.policyNumber),
            coverageLabel: (type === "מחלות קשות" || type === "סרטן") ? "סכום פיצוי" : (coverItems.length ? "כיסויים" : "סכום ביטוח"),
            coverageValue,
            coverItems,
            subtitle: safeTrim(p?.policyNumber) ? `פוליסה ${p.policyNumber}` : insuredLabel,
            badgeText: "הגיעה עם הלקוח",
            badgeClass: "is-existing",
            ctaText: "פרטי פוליסה",
            details: {
              "סטטוס": "פוליסה קיימת",
              "מבוטח": insuredLabel,
              "חברה": safeTrim(p?.company),
              "סוג מוצר": type,
              "מספר פוליסה": safeTrim(p?.policyNumber),
              "פרמיה חודשית": monthlyPremium ? this.formatMoney(monthlyPremium) : "—",
              "הנחה": this.getPolicyDiscountDisplayText(p, { compact:true }),
              "פרמיה אחרי הנחה": premiumAfterDiscount,
              [(coverageValue ? ((type === "מחלות קשות" || type === "סרטן") ? "סכום פיצוי" : (coverItems.length ? "כיסויים" : "סכום ביטוח")) : "פרט נוסף")]: coverageValue || "—",
              "תחילת ביטוח": safeTrim(p?.startDate) || "—",
              "שיעבוד": p?.hasPledge ? `כן${safeTrim(p?.pledgeBankName) ? ` · ${safeTrim(p.pledgeBankName)}` : ""}` : "לא"
            }
          });
        });
      });

      sourceNewPolicies.forEach((p, idx) => {
        const type = safeTrim(p?.type || p?.product || (p?.company === "מדיקר" ? "מדיקר" : "פוליסה"));
        const premium = safeTrim(p?.premiumMonthly || p?.premium || p?.premiumBefore || "");
        const coverItems = Array.isArray(p?.healthCovers) ? p.healthCovers.filter(Boolean) : [];
        const coverageValue = safeTrim(p?.sumInsured || p?.compensation || p?.coverage || (coverItems.length ? coverItems.join(", ") : ""));
        const insuredLabel = this.getNewPolicyInsuredLabel(payload, p, sourceInsureds);
        const discountPct = this.getPolicyDiscountPct(p);
        const discountYears = this.getPolicyDiscountYearsLabel(p);
        const premiumAfterDiscountValue = this.getPolicyPremiumAfterDiscount(p);
        const premiumAfterDiscount = this.formatMoneyValue(premiumAfterDiscountValue);
        policies.push({
          id: safeTrim(p?.id) || `new_${idx}`,
          origin: "new",
          insuredLabel,
          company: safeTrim(p?.company),
          type,
          premiumText: premium ? this.formatMoney(premium) : "—",
          premiumValue: premium,
          discountPct: String(discountPct),
          discountYears,
          premiumAfterDiscount,
          premiumAfterDiscountValue,
          startDate: safeTrim(p?.startDate),
          policyNumber: safeTrim(p?.policyNumber),
          coverageLabel: (type === "מחלות קשות" || type === "סרטן") ? "סכום פיצוי" : (coverageValue && String(coverageValue).includes(",") ? "כיסויים" : "סכום ביטוח"),
          coverageValue,
          coverItems,
          subtitle: insuredLabel,
          badgeText: "חדש",
          badgeClass: "is-new",
          ctaText: "פרטי פוליסה",
          details: {
            "סטטוס": "פוליסה חדשה",
            "מבוטח": insuredLabel,
            "חברה": safeTrim(p?.company),
            "סוג מוצר": type,
            "פרמיה חודשית": premium ? this.formatMoney(premium) : "—",
            "הנחה": this.getPolicyDiscountDisplayText(p, { compact:true }),
            "פרמיה אחרי הנחה": premiumAfterDiscount,
            "תחילת ביטוח": safeTrim(p?.startDate) || "—",
            [(coverageValue ? ((type === "מחלות קשות" || type === "סרטן") ? "סכום פיצוי" : (String(coverageValue).includes(",") ? "כיסויים" : "סכום ביטוח")) : "פרט נוסף")]: coverageValue || "—",
            "שיעבוד": p?.pledge ? "כן" : "לא"
          }
        });
      });
      return policies;
    },

    getNewPolicyInsuredLabel(payload, policy, insuredsOverride){
      const insureds = Array.isArray(insuredsOverride) && insuredsOverride.length
        ? insuredsOverride
        : (Array.isArray(payload?.insureds) && payload.insureds.length
          ? payload.insureds
          : (Array.isArray(payload?.operational?.insureds) ? payload.operational.insureds : []));
      if(policy?.insuredMode === "couple"){
        const primary = safeTrim(insureds?.[0]?.label) || "מבוטח ראשי";
        const spouse = safeTrim((insureds || []).find(x => x.type === "spouse")?.label);
        return spouse ? `${primary} + ${spouse}` : `${primary} (זוגי)`;
      }
      const ins = (insureds || []).find(x => x.id === policy?.insuredId);
      return safeTrim(ins?.label) || "מבוטח";
    },

    getStats(rec, policies){
      const uniqueCompanies = Array.from(new Set(policies.map(p => safeTrim(p.company)).filter(Boolean)));
      const newPolicies = this.getNewPoliciesOnly(policies);
      const premiumBefore = this.sumPremium(newPolicies);
      const premiumAfter = this.sumPremiumAfterDiscount(newPolicies);
      const discountSavings = Math.max(0, Math.round((premiumBefore - premiumAfter) * 100) / 100);
      return [
        {
          icon: premiumCustomerIcon("activity"),
          type: "ops-reflection",
          ...getOpsStatePresentation(rec)
        },
        {
          icon: premiumCustomerIcon("briefcase"),
          type: "premium-breakdown",
          toneClass: this.getPremiumToneClass(premiumAfter),
          beforeValue: this.formatMoneyValue(premiumBefore),
          afterValue: this.formatMoneyValue(premiumAfter),
          savingsValue: this.formatMoneyValue(discountSavings),
          label: "פרמיה חודשית",
          sub: newPolicies.length ? `רק פוליסות חדשות · ${newPolicies.length} פוליסות` : "רק פוליסות חדשות · עדיין אין פוליסות חדשות"
        },
        { icon: premiumCustomerIcon("building"), value: String(uniqueCompanies.length || 0), label: "חברות ביטוח", sub: uniqueCompanies.length ? uniqueCompanies.join(" · ") : "טרם נוספו חברות" },
        { icon: premiumCustomerIcon("folder"), value: String(policies.length || 0), label: "פוליסות פעילות", sub: `${rec.existingPoliciesCount || 0} קיימות · ${rec.newPoliciesCount || 0} חדשות` }
      ];

      function payloadCount(rec){
        return Number(rec?.payload?.insureds?.length || rec?.insuredCount || 0) || 0;
      }
    },

    companyClass(company){
      const key = safeTrim(company);
      const map = {
        "הראל": "is-harel",
        "מגדל": "is-migdal",
        "הפניקס": "is-phoenix",
        "מנורה": "is-menora",
        "כלל": "is-clal",
        "הכשרה": "is-hachshara",
        "איילון": "is-ayalon",
        "AIG": "is-aig",
        "ביטוח ישיר": "is-direct",
        "9 מיליון": "is-nine",
        "מדיקר": "is-medicare"
      };
      return map[key] || "is-generic";
    },

    getCompanyLogoSrc(company){
      if(typeof Wizard?.getCompanyLogoSrc === "function") return Wizard.getCompanyLogoSrc(company) || "";
      const map = {
        "הפניקס": "afenix.png",
        "הראל": "harel.png",
        "כלל": "clal.png",
        "מגדל": "megdl.png",
        "מנורה": "menora.png",
        "איילון": "ayalon.png",
        "הכשרה": "achshara.png",
        "AIG": "aig.png",
        "ביטוח ישיר": "beytuyashir.png",
        "9 מיליון": "9milyon.png",
        "מדיקר": "medicare.png"
      };
      return map[company] || "";
    },

    renderPolicyCard(policy){
      return this.renderPolicyRow(policy);
    },

    renderPolicyRow(policy){
      const logoSrc = this.getCompanyLogoSrc(policy.company);
      const logoHtml = logoSrc
        ? `<img class="customerPolicyRow__logoImg" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(policy.company || '')}" />`
        : `<span class="customerPolicyRow__logoFallback">${escapeHtml((policy.company || 'ח').slice(0,1))}</span>`;
      const coverageText = safeTrim(policy.coverageValue) || safeTrim(policy.subtitle) || '—';
      const discountPct = Number(policy.discountPct || 0) || 0;
      const afterPremium = safeTrim(policy.premiumAfterDiscount || policy.premiumText || '—');
      const secondaryMeta = [
        safeTrim(policy.coverageLabel) && coverageText && coverageText !== '—' ? `${safeTrim(policy.coverageLabel)}: ${coverageText}` : '',
        safeTrim(policy.policyNumber) ? `מס׳ פוליסה: ${safeTrim(policy.policyNumber)}` : '',
        safeTrim(policy.startDate) ? `תחילה: ${safeTrim(policy.startDate)}` : '',
        safeTrim(policy.insuredLabel) ? `מבוטח: ${safeTrim(policy.insuredLabel)}` : ''
      ].filter(Boolean).slice(0, 2);
      const menuActions = [
        `<button class="customerPolicyRow__menuItem" type="button" data-policy-open="${escapeHtml(policy.id)}">פרטי פוליסה</button>`
      ];
      return `<article class="customerPolicyRow ${this.companyClass(policy.company)} ${policy.origin === 'new' ? 'is-newRow' : 'is-existingRow'}" data-policy-id="${escapeHtml(policy.id)}">
        <div class="customerPolicyRow__edge" aria-hidden="true"></div>
        <div class="customerPolicyRow__main">
          <div class="customerPolicyRow__brand">
            <div class="customerPolicyRow__logoWrap">${logoHtml}</div>
            <div class="customerPolicyRow__identity">
              <div class="customerPolicyRow__line1">
                <span class="customerPolicyRow__company">${escapeHtml(policy.company || 'חברה')}</span>
                <span class="customerPolicyRow__dot"></span>
                <span class="customerPolicyRow__product">${escapeHtml(policy.type || 'פוליסה')}</span>
                <span class="customerPolicyRow__status ${escapeHtml(policy.badgeClass)}">${escapeHtml(policy.badgeText || '')}</span>
              </div>
              <div class="customerPolicyRow__line2">
                ${secondaryMeta.length ? secondaryMeta.map(item => `<span class="customerPolicyRow__metaPill">${escapeHtml(item)}</span>`).join('') : `<span class="customerPolicyRow__metaPill">${escapeHtml(policy.subtitle || 'פרטי פוליסה')}</span>`}
              </div>
            </div>
          </div>
          <div class="customerPolicyRow__numbers">
            <div class="customerPolicyRow__priceWrap">
              <div class="customerPolicyRow__priceLabel">פרמיה חודשית</div>
              <div class="customerPolicyRow__price">${escapeHtml(policy.premiumText || '—')}</div>
            </div>
            <div class="customerPolicyRow__afterWrap ${discountPct > 0 ? 'has-discount' : ''}">
              <div class="customerPolicyRow__afterLabel">אחרי הנחה</div>
              <div class="customerPolicyRow__after">${escapeHtml(afterPremium)}</div>
            </div>
            <div class="customerPolicyRow__actions">
              <button class="customerPolicyRow__menuBtn" type="button" aria-label="פעולות" data-policy-menu="${escapeHtml(policy.id)}">⋮</button>
              <div class="customerPolicyRow__menu" role="menu">
                ${menuActions.join('')}
              </div>
            </div>
          </div>
        </div>
      </article>`;
    },

    getMedicalGroups(rec){
      try{
        if(typeof MirrorsUI !== "undefined" && MirrorsUI && typeof MirrorsUI.getMirrorHealthEntries === "function"){
          return MirrorsUI.getMirrorHealthEntries(rec) || [];
        }
      }catch(_e){}
      return [];
    },

    getMedicalSummary(rec, groups){
      const stepState = rec?.payload?.mirrorFlow?.healthStep || {};
      let total = 0, positive = 0, negative = 0, detailed = 0;
      (groups || []).forEach(group => {
        (group.items || []).forEach(item => {
          total += 1;
          const answer = safeTrim(item?.response?.answer);
          if(answer === 'yes') positive += 1;
          if(answer === 'no') negative += 1;
          if(item?.response?.fields && Object.values(item.response.fields).some(v => safeTrim(v))) detailed += 1;
        });
      });
      return {
        total, positive, negative, detailed,
        corrected: !!safeTrim(stepState.savedAt),
        updatedAt: safeTrim(stepState.savedAt) || safeTrim(rec?.updatedAt) || safeTrim(rec?.createdAt),
        updatedBy: safeTrim(stepState.savedBy),
        itemsCount: Number(stepState.itemsCount || total) || total
      };
    },

    renderMedicalInfo(rec){
      const groups = this.getMedicalGroups(rec);
      const summary = this.getMedicalSummary(rec, groups);
      const summaryCards = [
        { icon:'🩺', label:'סעיפים רפואיים', value:String(summary.total || 0), sub:'כל ממצאי ההצהרה שנשמרו בתיק' },
        { icon:'⚠️', label:'סומנו כן', value:String(summary.positive || 0), sub:'סעיפים שדורשים תשומת לב רפואית' },
        { icon:'📄', label:'שאלוני המשך', value:String(summary.detailed || 0), sub:'שדות פירוט שנשמרו בפועל' },
        { icon:'🔄', label:'עודכן בשיקוף', value: summary.corrected ? 'כן' : 'לא', sub: summary.corrected ? (summary.updatedBy ? `עודכן ע"י ${summary.updatedBy}` : 'נשמרה גרסה מתוקנת') : 'כרגע מוצגת הגרסה המקורית' }
      ];
      const chips = `
        <div class="customerMedical__metaRow">
          <span class="customerMedical__metaPill">תאריך עדכון: ${escapeHtml(this.formatDate(summary.updatedAt || rec?.updatedAt || rec?.createdAt))}</span>
          <span class="customerMedical__metaPill ${summary.corrected ? 'is-corrected' : ''}">${summary.corrected ? 'סונכרן עם שיקוף' : 'מקור: הצהרת הבריאות'}</span>
          <span class="customerMedical__metaPill">מבוטחים עם מידע: ${escapeHtml(String((groups || []).length || 0))}</span>
        </div>`;
      const groupsHtml = groups.length ? groups.map((group, gIdx) => {
        const items = (group.items || []).map((item, idx) => {
          const answer = safeTrim(item?.response?.answer);
          const fields = item?.response?.fields && typeof item.response.fields === 'object' ? Object.entries(item.response.fields).filter(([k,v]) => safeTrim(v)) : [];
          const badge = answer === 'yes' ? 'כן' : answer === 'no' ? 'לא' : 'טרם סומן';
          const badgeClass = answer === 'yes' ? 'is-yes' : answer === 'no' ? 'is-no' : 'is-empty';
          return `
            <article class="customerMedicalItem">
              <div class="customerMedicalItem__glow" aria-hidden="true"></div>
              <div class="customerMedicalItem__head">
                <div>
                  <div class="customerMedicalItem__title">${escapeHtml(item?.meta?.text || item?.qKey || `שאלה ${idx+1}`)}</div>
                  <div class="customerMedicalItem__sub">${escapeHtml(item?.meta?.title || 'הצהרת בריאות')}</div>
                </div>
                <span class="customerMedicalItem__badge ${badgeClass}">${escapeHtml(badge)}</span>
              </div>
              ${fields.length ? `<div class="customerMedicalItem__fields">${fields.map(([key,val]) => `<div class="customerMedicalField"><span class="customerMedicalField__k">${escapeHtml(key)}</span><span class="customerMedicalField__v">${escapeHtml(String(val))}</span></div>`).join('')}</div>` : `<div class="customerMedicalItem__empty">${answer === 'yes' ? 'סומן כן ללא פירוט נוסף בשדה המשך.' : answer === 'no' ? 'לא דווח ממצא רפואי בשאלה זו.' : 'הסעיף טרם סומן.'}</div>`}
              <div class="customerMedicalItem__footer">
                <span class="customerMedicalItem__footPill">${summary.corrected ? 'מוצג לפי גרסת השיקוף המעודכנת' : 'מוצג לפי הטופס המקורי'}</span>
              </div>
            </article>`;
        }).join('');
        return `
          <section class="customerMedicalGroup">
            <div class="customerMedicalGroup__head">
              <div>
                <div class="customerMedicalGroup__title">${escapeHtml(group?.insured?.label || `מבוטח ${gIdx+1}`)}</div>
                <div class="customerMedicalGroup__sub">${escapeHtml(String((group.items || []).length || 0))} סעיפים רפואיים שמורים בתיק</div>
              </div>
              <div class="customerMedicalGroup__pulse" aria-hidden="true"></div>
            </div>
            <div class="customerMedicalGroup__grid">${items}</div>
          </section>`;
      }).join('') : `<div class="emptyState customerMedical__empty"><div class="emptyState__icon">${premiumCustomerIcon("medical")}</div><div class="emptyState__title">עדיין אין מידע רפואי להצגה</div><div class="emptyState__text">ברגע שתישמר הצהרת בריאות ללקוח, הממצאים יוצגו כאן אוטומטית. אם יתבצע תיקון בשיקוף, המסך הזה יתעדכן בהתאם.</div></div>`;
      return `<section class="customerMedicalView">
        <div class="customerMedicalHero">
          <div class="customerMedicalHero__scan" aria-hidden="true"></div>
          <div class="customerWalletSection__head customerMedicalHero__head">
            <div class="customerWalletSection__titleWrap">
              <div class="customerWalletSection__icon">${premiumCustomerIcon("medical")}</div>
              <div>
                <div class="customerWalletSection__title">מידע רפואי</div>
                <div class="customerWalletSection__sub">סיכום פרימיום של הצהרת הבריאות — כולל סנכרון אוטומטי מול תיקוני שיקוף</div>
              </div>
            </div>
            <div class="customerMedicalHero__tools">
              <button class="customerMedicalHero__backBtn" id="customerMedicalBackBtn" type="button">חזרה לתיק הביטוח</button>
            </div>
          </div>
          ${chips}
          <div class="customerMedicalSummary">${summaryCards.map(card => `<div class="customerMedicalSummaryCard"><div class="customerMedicalSummaryCard__icon">${card.icon}</div><div class="customerMedicalSummaryCard__value">${escapeHtml(card.value)}</div><div class="customerMedicalSummaryCard__label">${escapeHtml(card.label)}</div><div class="customerMedicalSummaryCard__sub">${escapeHtml(card.sub)}</div></div>`).join('')}</div>
        </div>
        <div class="customerMedicalGroups">${groupsHtml}</div>
      </section>`;
    },

    updateHeroButtons(){
      if(this.els.proposalBtn) this.els.proposalBtn.classList.remove('is-section-active');
      if(this.els.medicalBtn) this.els.medicalBtn.classList.remove('is-section-active');
      if(this.currentSection === 'medical'){
        if(this.els.medicalBtn) this.els.medicalBtn.classList.add('is-section-active');
      } else {
        if(this.els.proposalBtn) this.els.proposalBtn.classList.add('is-section-active');
      }
    },

    renderCurrentSection(rec){
      if(!rec || !this.els.body) return;
      const policies = this.collectPolicies(rec);
      this.updateHeroButtons();
      this.els.body.innerHTML = this.currentSection === 'medical' ? this.renderMedicalInfo(rec) : this.renderPolicyWallet(rec, policies);
      if(this.currentSection !== 'medical') this.bindPolicyCardActions(rec, policies);
    },

    renderPolicyWallet(rec, policies){
      const newPolicies = this.getNewPoliciesOnly(policies);
      const renderGroup = (title, sub, rows, toneClass) => `
        <section class="customerPolicyGroup ${toneClass}">
          <div class="customerPolicyGroup__head">
            <div>
              <div class="customerPolicyGroup__title">${escapeHtml(title)}</div>
              <div class="customerPolicyGroup__sub">${escapeHtml(sub)}</div>
            </div>
            <div class="customerPolicyGroup__count">${escapeHtml(String(rows.length || 0))}</div>
          </div>
          <div class="customerPolicyList">
            ${rows.length ? rows.map(p => this.renderPolicyRow(p)).join('') : `<div class="customerPolicyList__empty">עדיין לא נוספו פוליסות חדשות לתיק.</div>`}
          </div>
        </section>`;

      return `<section class="customerWalletSection customerWalletSection--rows customerWalletSection--newOnly">
        <div class="customerWalletSection__head customerWalletSection__head--rows">
          <div class="customerWalletSection__titleWrap">
            <div class="customerWalletSection__icon">${premiumCustomerIcon("briefcase")}</div>
            <div>
              <div class="customerWalletSection__title">תיק הפוליסות</div>
              <div class="customerWalletSection__sub">מוצגות כאן רק הפוליסות החדשות שנבנו בתיק</div>
            </div>
          </div>
        </div>
        ${newPolicies.length
          ? `<div class="customerPolicyStack">
              ${renderGroup('פוליסות חדשות', 'רק פוליסות חדשות מוצגות במסך זה', newPolicies, 'is-newGroup')}
            </div>`
          : `<div class="emptyState"><div class="emptyState__icon">${premiumCustomerIcon("document")}</div><div class="emptyState__title">עדיין אין פוליסות חדשות בתיק</div><div class="emptyState__text">ברגע שתישמר פוליסה חדשה, היא תוצג כאן אוטומטית.</div></div>`}
      </section>`;
    },

    bindPolicyCardActions(rec, policies){
      const root = this.els.body;
      if(!root) return;
      root.querySelectorAll('[data-policy-open]').forEach(btn => {
        on(btn, 'click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const id = btn.getAttribute('data-policy-open');
          const policy = policies.find(x => String(x.id) === String(id));
          if(policy) {
            this.closePolicyRowMenus();
            this.openPolicyModal(rec, policy);
          }
        });
      });
      root.querySelectorAll('[data-policy-menu]').forEach(btn => {
        on(btn, 'click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const row = btn.closest('.customerPolicyRow');
          if(!row) return;
          const isOpen = row.classList.contains('is-menu-open');
          this.closePolicyRowMenus();
          if(!isOpen) row.classList.add('is-menu-open');
        });
      });
      root.querySelectorAll('.customerPolicyRow').forEach(row => {
        on(row, 'click', (ev) => {
          const interactive = ev.target && ev.target.closest ? ev.target.closest('button,.customerPolicyRow__menu') : null;
          if(interactive) return;
          const id = row.getAttribute('data-policy-id');
          const policy = policies.find(x => String(x.id) === String(id));
          if(policy) {
            this.closePolicyRowMenus();
            this.openPolicyModal(rec, policy);
          }
        });
      });
      if(!this._policyRowMenuBound){
        this._policyRowMenuBound = true;
        on(document, 'click', (ev) => {
          const inside = ev.target && ev.target.closest ? ev.target.closest('.customerPolicyRow') : null;
          if(!inside) this.closePolicyRowMenus();
        });
        on(document, 'keydown', (ev) => {
          if(ev.key === 'Escape') this.closePolicyRowMenus();
        });
      }
    },

    closePolicyRowMenus(){
      this.els.body?.querySelectorAll('.customerPolicyRow.is-menu-open').forEach(row => row.classList.remove('is-menu-open'));
    },

    openById(id, opts={}){
      const rec = this.byId(id);
      if(!rec || !this.els.wrap) return;
      const safeSection = String(opts?.section || this.currentSection || "wallet") === "medical" ? "medical" : "wallet";
      const reopenPolicyId = safeTrim(opts?.policyId || "");
      const bodyScrollTop = Math.max(0, Number(opts?.bodyScrollTop || 0) || 0);
      try {
        Wizard?.hideFinishFlow?.();
        Wizard?.closeHealthFindingsModal?.();
      } catch(_e) {}
      try{
        if(Wizard?.isOpen) Wizard.close();
        this.currentId = rec.id;
        const policies = this.collectPolicies(rec);
        const stats = this.getStats(rec, policies);
        this.currentSection = safeSection;

        if(this.els.name) this.els.name.textContent = rec.fullName || "תיק לקוח";
        if(this.els.avatar) this.els.avatar.setAttribute("data-customer-name", safeTrim(rec.fullName || "תיק לקוח"));
        if(this.els.meta){
          const metaParts = [
            rec.idNumber ? `<span class="customerHero__metaItem">ת.ז ${escapeHtml(rec.idNumber)}</span>` : "",
            rec.agentName ? `<span class="customerHero__metaSep">|</span><span class="customerHero__metaItem">נציג: ${escapeHtml(rec.agentName)}</span>` : "",
            rec.phone ? `<span class="customerHero__metaSep">|</span><span class="customerHero__metaItem" dir="ltr">${escapeHtml(rec.phone)}</span>` : ""
          ].filter(Boolean).join("");
          this.els.meta.innerHTML = metaParts;
        }
        if(this.els.dash){
          this.els.dash.innerHTML = stats.map(card => {
            if(card.type === "ops-reflection") return this.renderOperationalReflectionCard(card);
            if(card.type === "premium-breakdown"){
              return `
              <div class="customerStatCard customerStatCard--premium ${escapeHtml(card.toneClass || '')}">
                <div class="customerStatCard__icon">${card.icon}</div>
                <div class="customerStatCard__content customerStatCard__content--premium">
                  <div class="customerStatCard__premiumRows">
                    <div class="customerStatCard__premiumRow">
                      <span class="customerStatCard__miniLabel">סה״כ לפני הנחות</span>
                      <strong class="customerStatCard__miniValue" data-animate-key="premium-before-${escapeHtml(rec.id || '')}" data-animate-number="${escapeHtml(String(this.asNumber(card.beforeValue)))}">${escapeHtml(card.beforeValue)}</strong>
                    </div>
                    <div class="customerStatCard__premiumRow customerStatCard__premiumRow--final">
                      <span class="customerStatCard__miniLabel">סה״כ אחרי הנחות</span>
                      <strong class="customerStatCard__miniValue customerStatCard__miniValue--final" data-animate-key="premium-after-${escapeHtml(rec.id || '')}" data-animate-number="${escapeHtml(String(this.asNumber(card.afterValue)))}">${escapeHtml(card.afterValue)}</strong>
                    </div>
                  </div>
                  <div class="customerStatCard__label">${escapeHtml(card.label)}</div>
                  <div class="customerStatCard__sub">${escapeHtml(card.sub)}</div>
                  <div class="customerStatCard__savings">חיסכון כולל: <span data-animate-key="premium-savings-${escapeHtml(rec.id || '')}" data-animate-number="${escapeHtml(String(this.asNumber(card.savingsValue)))}">${escapeHtml(card.savingsValue)}</span></div>
                </div>
              </div>`;
            }
            return `
            <div class="customerStatCard">
              <div class="customerStatCard__icon">${card.icon}</div>
              <div class="customerStatCard__content">
                <div class="customerStatCard__value">${escapeHtml(card.value)}</div>
                <div class="customerStatCard__label">${escapeHtml(card.label)}</div>
                <div class="customerStatCard__sub">${escapeHtml(card.sub)}</div>
              </div>
            </div>`;
          }).join("");
          this.animatePremiumStats(this.els.dash);
          this.startOpsCardLoop();
        }
        if(this.els.body){
          this.renderCurrentSection(rec);
        }
        this.els.wrap.classList.add("is-open");
        this.els.wrap.setAttribute("aria-hidden","false");
        document.body.style.overflow = "hidden";
        if(this.els.body){
          requestAnimationFrame(() => {
            try { this.els.body.scrollTop = bodyScrollTop; } catch(_e) {}
          });
        }
        if(reopenPolicyId){
          const reopenPolicy = policies.find(x => String(x.id) === String(reopenPolicyId));
          if(reopenPolicy){
            requestAnimationFrame(() => this.openPolicyModal(rec, reopenPolicy));
          }
        }
      }catch(err){
        console.error("CUSTOMER_OPEN_FAILED", err, rec);
        if(this.els.name) this.els.name.textContent = rec.fullName || "תיק לקוח";
        if(this.els.avatar) this.els.avatar.setAttribute("data-customer-name", safeTrim(rec.fullName || "תיק לקוח"));
        if(this.els.meta) this.els.meta.innerHTML = rec.idNumber ? `<span class="customerHero__metaItem">ת.ז ${escapeHtml(rec.idNumber)}</span>` : "";
        if(this.els.dash) this.els.dash.innerHTML = "";
        if(this.els.body){
          this.els.body.innerHTML = `<section class="customerWalletSection"><div class="emptyState"><div class="emptyState__icon">🗂️</div><div class="emptyState__title">התיק נפתח במצב בטוח</div><div class="emptyState__text">נמצאה תקלה בהצגת חלק מהנתונים, אבל התיק עצמו כן נפתח. אפשר להמשיך לבדוק את פרטי הלקוח ולרענן לאחר מכן.</div></div></section>`;
        }
        this.els.wrap.classList.add("is-open");
        this.els.wrap.setAttribute("aria-hidden","false");
        document.body.style.overflow = "hidden";
      }
    },

    renderOperationalReflectionCard(state){
      const current = this.current();
      const isOps = !!Auth.isOps();
      const owner = safeTrim(state?.ownerText) || 'מחלקת תפעול';
      const updated = safeTrim(state?.updatedText) ? ProcessesUI.formatDate(state.updatedText) : '—';
      const resultButtons = isOps ? Object.entries(OPS_RESULT_OPTIONS).map(([key, label]) => `
        <button class="customerOpsResultBtn${state?.resultKey === key ? ' is-active' : ''}" data-ops-result="${escapeHtml(key)}" type="button">${escapeHtml(label)}</button>`).join('') : '';
      return `
        <div class="customerStatCard customerStatCard--ops customerStatCard--ops-${escapeHtml(state?.tone || 'info')}" id="customerOpsReflectionCard" data-customer-id="${escapeHtml(current?.id || '')}">
          <div class="customerStatCard__icon">${premiumCustomerIcon("activity")}</div>
          <div class="customerStatCard__content customerStatCard__content--ops">
            <div class="customerOpsStateRow">
              <span class="customerOpsBadge customerOpsBadge--${escapeHtml(state?.tone || 'info')}">${escapeHtml(state?.liveLabel || 'ממתין לשיקוף')}</span>
              <span class="customerOpsOwner">${escapeHtml(owner)}</span>
            </div>
            <div class="customerOpsTimerRow">
              <strong class="customerOpsTimer${state?.timerLive ? ' is-live' : ''}" id="customerOpsTimerText">${escapeHtml(state?.timerText || '00:00')}</strong>
              <span class="customerOpsTimerMeta" id="customerOpsTimerMeta">${escapeHtml(state?.timerMeta || 'הטיימר יתחיל ברגע שתופעל שיחת שיקוף')}</span>
            </div>
            <div class="customerOpsResultWrap">
              <div class="customerOpsResultTitle">תוצאה</div>
              <div class="customerOpsResultValue" id="customerOpsResultValue">${escapeHtml(state?.finalLabel || 'טרם נקבעה תוצאה סופית')}</div>
            </div>
            ${isOps ? `<div class="customerOpsResultBtns">${resultButtons}</div>` : ''}
            <div class="customerStatCard__sub">עודכן לאחרונה: ${escapeHtml(updated)}</div>
          </div>
        </div>`;
    },

    refreshOperationalReflectionCard(){
      const rec = this.current();
      const card = this.els?.dash?.querySelector?.('#customerOpsReflectionCard');
      if(!rec || !card) return;
      const next = this.renderOperationalReflectionCard(getOpsStatePresentation(rec));
      card.outerHTML = next;
    },

    startOpsCardLoop(){
      this.stopOpsCardLoop();
      const rec = this.current();
      const payload = rec?.payload && typeof rec.payload === 'object' ? rec.payload : {};
      const mirrorFlow = payload?.mirrorFlow && typeof payload.mirrorFlow === 'object' ? payload.mirrorFlow : {};
      const call = (mirrorFlow.callSession && typeof mirrorFlow.callSession === 'object') ? mirrorFlow.callSession : ((mirrorFlow.call && typeof mirrorFlow.call === 'object') ? mirrorFlow.call : {});
      this.refreshOperationalReflectionCard();
      if(!call?.active) return;
      this._opsCardTimer = window.setInterval(() => this.refreshOperationalReflectionCard(), 1000);
    },

    stopOpsCardLoop(){
      if(this._opsCardTimer){
        window.clearInterval(this._opsCardTimer);
        this._opsCardTimer = null;
      }
    },

    animatePremiumStats(root){
      const scope = root || this.els?.dash;
      if(!scope) return;
      if(!this._premiumAnimationCache || typeof this._premiumAnimationCache !== 'object') this._premiumAnimationCache = {};
      const nodes = scope.querySelectorAll('[data-animate-number]');
      nodes.forEach(el => {
        const target = Number(el.getAttribute('data-animate-number') || 0) || 0;
        const cacheKey = safeTrim(el.getAttribute('data-animate-key')) || '';
        const lastTarget = cacheKey ? Number(this._premiumAnimationCache[cacheKey]) : NaN;
        if(cacheKey && Number.isFinite(lastTarget) && Math.abs(lastTarget - target) < 0.001){
          el.textContent = this.formatMoneyValue(target);
          el.dataset.animated = '1';
          return;
        }
        const duration = 760;
        const start = performance.now();
        const step = (now) => {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          const value = Math.round(target * eased * 100) / 100;
          el.textContent = this.formatMoneyValue(value);
          if(progress < 1){
            requestAnimationFrame(step);
          } else {
            el.textContent = this.formatMoneyValue(target);
            el.dataset.animated = '1';
            if(cacheKey) this._premiumAnimationCache[cacheKey] = target;
          }
        };
        requestAnimationFrame(step);
      });
    },

    openOpsById(id){
      const rec = this.byId(id);
      if(!rec) return;
      const prevPayload = Wizard.getOperationalPayload;
      try{
        Wizard.getOperationalPayload = () => JSON.parse(JSON.stringify(rec.payload || {}));
        Wizard.openOperationalReport();
      } finally {
        Wizard.getOperationalPayload = prevPayload;
      }
    },

    openPolicyModal(rec, policy){
      if(!this.policyModal.wrap || !this.policyModal.body) return;
      this._openPolicyId = safeTrim(policy?.id || "");
      this.policyModal.wrap.dataset.policyId = this._openPolicyId;
      if(this.policyModal.title){
        this.policyModal.title.textContent = `${policy.company || "חברה"} · ${policy.type || "פוליסה"}`;
      }
      const detailRows = Object.entries(policy.details || {}).map(([k,v]) => `
        <div class="customerPolicyModal__row">
          <div class="customerPolicyModal__k">${escapeHtml(k)}</div>
          <div class="customerPolicyModal__v">${escapeHtml(safeTrim(v) || "—")}</div>
        </div>`).join("");
      this.policyModal.body.innerHTML = `
        <div class="customerPolicyModal__hero ${this.companyClass(policy.company)}">
          <div class="customerPolicyModal__heroTop">
            <div class="customerPolicyModal__heroBadge ${escapeHtml(policy.badgeClass)}">${escapeHtml(policy.badgeText)}</div>
            <div class="customerPolicyModal__heroPremium">${escapeHtml(policy.premiumText || "—")}</div>
          </div>
          <div class="customerPolicyModal__heroCompany">${escapeHtml(policy.company || "חברה")}</div>
          <div class="customerPolicyModal__heroType">${escapeHtml(policy.type || "פוליסה")}</div>
          <div class="customerPolicyModal__heroSub">${escapeHtml(rec.fullName || "לקוח")} · ${escapeHtml(policy.insuredLabel || "מבוטח")}</div>
        </div>
        <div class="customerPolicyModal__grid">${detailRows}</div>
      `;
      this.policyModal.wrap.classList.add("is-open");
      this.policyModal.wrap.setAttribute("aria-hidden", "false");
    },

    closePolicyModal(){
      if(!this.policyModal.wrap) return;
      this._openPolicyId = "";
      try { delete this.policyModal.wrap.dataset.policyId; } catch(_e) {}
      this.policyModal.wrap.classList.remove("is-open");
      this.policyModal.wrap.setAttribute("aria-hidden", "true");
    },

    refreshOpenCustomerPreservingState(){
      if(!this.currentId || !this.els.wrap?.classList.contains("is-open")) return;
      const stillExists = this.byId(this.currentId);
      if(!stillExists){
        this.close();
        return;
      }
      this.openById(this.currentId, {
        section: this.currentSection || "wallet",
        bodyScrollTop: this.els.body?.scrollTop || 0,
        policyId: this.policyModal.wrap?.classList.contains("is-open") ? (this._openPolicyId || this.policyModal.wrap?.dataset?.policyId || "") : ""
      });
    },

    close(){
      this.stopOpsCardLoop();
      if(!this.els.wrap) return;
      window.clearTimeout(this._loaderTimer);
      this.hideLoader();
      this.closePolicyModal();
      this.els.wrap.classList.remove("is-open");
      this.els.wrap.setAttribute("aria-hidden","true");
      document.body.style.overflow = "";
    },

    current(){
      return this.byId(this.currentId);
    },

    formatDate(v){
      if(!v) return "—";
      const d = new Date(v);
      if(Number.isNaN(d.getTime())) return String(v);
      return d.toLocaleString("he-IL");
    }
  };

  const ArchiveCustomerUI = {
    els: {},
    targetId: null,

    init(){
      this.els.wrap = $("#lcArchiveCustomerModal");
      this.els.backdrop = $("#lcArchiveCustomerBackdrop");
      this.els.close = $("#lcArchiveCustomerClose");
      this.els.cancel = $("#lcArchiveCustomerCancel");
      this.els.confirm = $("#lcArchiveCustomerConfirm");
      this.els.pin = $("#lcArchiveCustomerPin");
      this.els.error = $("#lcArchiveCustomerError");
      this.els.name = $("#lcArchiveCustomerName");
      this.els.meta = $("#lcArchiveCustomerMeta");

      on(this.els.backdrop, "click", () => this.close());
      on(this.els.close, "click", () => this.close());
      on(this.els.cancel, "click", () => this.close());
      on(this.els.confirm, "click", async () => { await this.confirm(); });
      on(this.els.pin, "keydown", async (ev) => {
        if(ev.key === "Enter"){
          ev.preventDefault();
          await this.confirm();
        }
      });
    },

    open(id){
      const rec = CustomersUI.byId(id);
      if(!rec || !this.els.wrap) return;
      this.targetId = rec.id;
      if(this.els.name) this.els.name.textContent = rec.fullName || "לקוח ללא שם";
      if(this.els.meta){
        this.els.meta.innerHTML = [
          rec.idNumber ? `ת״ז: <strong>${escapeHtml(rec.idNumber)}</strong>` : "",
          rec.phone ? `טלפון: <strong dir="ltr">${escapeHtml(rec.phone)}</strong>` : "",
          rec.agentName ? `נציג: <strong>${escapeHtml(rec.agentName)}</strong>` : ""
        ].filter(Boolean).map(x => `<span>${x}</span>`).join("");
      }
      if(this.els.pin) this.els.pin.value = "";
      this.showError("");
      this.els.wrap.classList.add("is-open");
      this.els.wrap.setAttribute("aria-hidden","false");
      setTimeout(() => this.els.pin?.focus?.(), 60);
    },

    close(){
      this.stopOpsCardLoop();
      if(!this.els.wrap) return;
      this.els.wrap.classList.remove("is-open");
      this.els.wrap.setAttribute("aria-hidden","true");
      this.targetId = null;
      if(this.els.pin) this.els.pin.value = "";
      this.showError("");
    },

    showError(msg){
      if(!this.els.error) return;
      this.els.error.textContent = String(msg || "");
      this.els.error.style.display = msg ? "block" : "none";
    },

    getArchivePin(){
      return ARCHIVE_CUSTOMER_PIN;
    },

    async confirm(){
      const id = this.targetId;
      const rec = CustomersUI.byId(id);
      if(!id || !rec){
        this.showError("הלקוח לא נמצא יותר במערכת");
        return;
      }

      const typedPin = safeTrim(this.els.pin?.value);
      if(!typedPin){
        this.showError("נא להזין קוד מנהל");
        this.els.pin?.focus?.();
        return;
      }

      if(typedPin !== this.getArchivePin()){
        this.showError("קוד מנהל שגוי");
        this.els.pin?.focus?.();
        this.els.pin?.select?.();
        return;
      }

      const prevCustomers = Array.isArray(State.data?.customers) ? State.data.customers.slice() : [];
      const next = prevCustomers.filter(x => String(x.id) !== String(id));
      State.data.customers = next;
      State.data.meta = State.data.meta || {};
      State.data.meta.updatedAt = nowISO();

      const r = await App.persist("הלקוח נגנז ונמחק");
      if(!r?.ok){
        State.data.customers = prevCustomers;
        State.data.meta.updatedAt = nowISO();
        this.showError("שמירת המחיקה ל-Supabase נכשלה. הלקוח לא נמחק. בדוק חיבור וטבלאות ונסה שוב.");
        CustomersUI.render();
        return;
      }

      if(CustomersUI.currentId && String(CustomersUI.currentId) === String(id)){
        CustomersUI.close();
      }

      this.close();
      CustomersUI.render();
    }
  };

  // ---------- Proposals UI ----------
  const ProposalsUI = {
    list(){
      const all = Array.isArray(State.data?.proposals) ? State.data.proposals.slice() : [];
      const visible = all.filter(rec => Auth.canViewAllCustomers() || safeTrim(rec.agentName) === safeTrim(Auth?.current?.name));
      visible.sort((a,b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
      return visible;
    },

    filtered(){
      const q = safeTrim(UI.els.proposalsSearch?.value).toLowerCase();
      let rows = this.list();
      if(!q) return rows;
      return rows.filter(rec => [rec.fullName, rec.idNumber, rec.phone, rec.agentName, rec.email, rec.city].some(v => safeTrim(v).toLowerCase().includes(q)));
    },

    render(){
      if(!UI.els.proposalsTbody) return;
      const rows = this.filtered();
      if(UI.els.proposalsCountBadge) UI.els.proposalsCountBadge.textContent = rows.length + " הצעות";
      UI.els.proposalsTbody.innerHTML = rows.length ? rows.map(rec => `
        <tr>
          <td><div class="lcCustomers__nameCell"><strong>${escapeHtml(rec.fullName || "—")}</strong><span class="muted small">שלב ${escapeHtml(String(rec.currentStep || 1))} מתוך 8</span></div></td>
          <td>${escapeHtml(rec.idNumber || "—")}</td>
          <td dir="ltr">${escapeHtml(rec.phone || "—")}</td>
          <td>${escapeHtml(rec.agentName || "—")}</td>
          <td><span class="badge">טיוטה פתוחה</span></td>
          <td>${escapeHtml(CustomersUI.formatDate(rec.updatedAt || rec.createdAt))}</td>
          <td><div class="lcCustomers__rowActions">
            <button class="btn btn--primary" data-open-proposal="${escapeHtml(rec.id)}" type="button">המשך עריכה</button>
            <button class="btn" data-delete-proposal="${escapeHtml(rec.id)}" type="button">מחק</button>
          </div></td>
        </tr>`).join("") : `<tr><td colspan="7"><div class="emptyState"><div class="emptyState__icon">📝</div><div class="emptyState__title">אין כרגע הצעות פתוחות</div><div class="emptyState__text">כששומרים הקמת לקוח באמצע התהליך, ההצעה תופיע כאן ותאפשר להמשיך בדיוק מאותה נקודה.</div></div></td></tr>`;

      UI.els.proposalsTbody.querySelectorAll("[data-open-proposal]").forEach(btn => {
        on(btn, "click", () => this.openById(btn.getAttribute("data-open-proposal")));
      });
      UI.els.proposalsTbody.querySelectorAll("[data-delete-proposal]").forEach(btn => {
        on(btn, "click", async () => this.deleteById(btn.getAttribute("data-delete-proposal")));
      });
    },

    openById(id){
      const rec = (State.data?.proposals || []).find(x => String(x.id) === String(id));
      if(!rec) return;
      Wizard.openDraft(rec);
    },

    async deleteById(id){
      const rec = (State.data?.proposals || []).find(x => String(x.id) === String(id));
      if(!rec) return;
      const ok = window.confirm(`למחוק את ההצעה של ${rec.fullName || "הלקוח"}?`);
      if(!ok) return;
      State.data.proposals = (State.data.proposals || []).filter(x => String(x.id) !== String(id));
      State.data.meta.updatedAt = nowISO();
      await App.persist("ההצעה נמחקה");
      this.render();
    }
  };


  // ---------- App boot ----------

  const LiveRefresh = {
    intervalMs: 5000,
    timer: null,
    busy: false,

    getCurrentView(){
      return document.querySelector(".view.is-visible")?.id?.replace("view-", "") || "dashboard";
    },

    hasBlockingFlow(){
      if(!Auth.current) return true;
      if(document.body.classList.contains("lcAuthLock")) return true;
      if(Wizard?.isOpen) return true;
      if(SystemRepairUI?.busy) return true;
      if(ArchiveCustomerUI?.els?.wrap?.classList?.contains?.("is-open")) return true;
      return false;
    },

    shouldRun(){
      if(this.hasBlockingFlow()) return false;
      const view = this.getCurrentView();
      const proposalsLive = view === "proposals";
      const customersLive = view === "customers";
      const customerFileLive = !!(CustomersUI?.currentId && CustomersUI?.els?.wrap?.classList?.contains?.("is-open"));
      return proposalsLive || customersLive || customerFileLive;
    },

    async tick(){
      if(this.busy || !this.shouldRun()) return;
      this.busy = true;
      try {
        const r = await Storage.loadSheets();
        if(!r?.ok) return;
        State.data = r.payload;
        try { Storage.saveBackup(State.data); } catch(_e) {}
        UI.renderSyncStatus("רענון חי", "ok", r.at);

        const view = this.getCurrentView();
        if(view === "proposals") ProposalsUI.render();
        if(view === "customers") CustomersUI.render();
        if(CustomersUI?.currentId && CustomersUI?.els?.wrap?.classList?.contains?.("is-open")) {
          CustomersUI.refreshOpenCustomerPreservingState();
        }
      } catch(err) {
        console.error("LIVE_REFRESH_FAILED:", err);
      } finally {
        this.busy = false;
      }
    },

    start(){
      this.stop();
      this.timer = window.setInterval(() => { this.tick(); }, this.intervalMs);
    },

    stop(){
      if(this.timer){
        window.clearInterval(this.timer);
        this.timer = null;
      }
    }
  };


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
      { id:7, title:"סיכום" },
      { id:8, title:"הצהרת בריאות" },
      { id:9, title:"סיכום תפעולי" }
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
    occupations: [
      "אבטחה", "אדריכל", "אדריכלית", "אח", "אחות", "אחראי משמרת", "אינסטלטור", "אנליסט", "אנליסט פיננסי", "אסיסטנט", "איש אחזקה", "איש גבייה", "איש מכירות", "איש סיסטם", "איש תמיכה טכנית", "איש תפעול", "איש שירות", "איש שיווק", "איש QA", "איש DevOps", "אקטואר", "ארכיאולוג", "בודק תוכנה", "ביולוג", "בנאי", "בנקאי", "ברמן", "גזבר", "גנן", "גרפיקאי", "גרפיקאית", "דבוראי", "דוגמן", "דוגמנית", "דייל", "דיילת", "דייל קרקע", "דיילת קרקע", "דייג", "דיג׳יי", "הנדסאי", "הנדסאי אדריכלות", "הנדסאי בניין", "הנדסאי חשמל", "הנדסאי מכונות", "הנדסאי תוכנה", "ובמאי", "וטרינר", "וטרינרית", "זגג", "זכיין", "זמר", "זמרת", "חבלן", "חדרן", "חדרנית", "חובש", "חובשת", "חוקר", "חוקרת", "חשב", "חשבת", "חשב שכר", "חשב שכר בכיר", "חשמלאי", "חשמלאית", "טבח", "טבחית", "טבח ראשי", "טכנאי", "טכנאית", "טכנאי אלקטרוניקה", "טכנאי מיזוג", "טכנאי מחשבים", "טכנאי שירות", "טייס", "טייסת", "טלפן", "טלפנית", "טלמרקטינג", "יועץ", "יועצת", "יועץ ביטוח", "יועצת ביטוח", "יועץ השקעות", "יועצת השקעות", "יועץ מס", "יועצת מס", "יזם", "יזמת", "יחצן", "יחצנית", "כלכלן", "כלכלנית", "כבאי", "כבאית", "כתב", "כתבת", "לבורנט", "לבורנטית", "לוגיסטיקאי", "לוגיסטיקאית", "מהנדסת", "מהנדס", "מהנדס אזרחי", "מהנדסת אזרחית", "מהנדס בניין", "מהנדסת בניין", "מהנדס חשמל", "מהנדסת חשמל", "מהנדס מכונות", "מהנדסת מכונות", "מהנדס תוכנה", "מהנדסת תוכנה", "מדריך", "מדריכה", "מדריך כושר", "מדריכת כושר", "מזכיר", "מזכירה", "מזכיר רפואי", "מזכירה רפואית", "מחנך", "מחנכת", "מחסנאי", "מחסנאית", "מיילד", "מיילדת", "מכונאי", "מכונאית", "מכין שכר", "מנהל", "מנהלת", "מנהל אדמיניסטרטיבי", "מנהלת אדמיניסטרטיבית", "מנהל מוצר", "מנהלת מוצר", "מנהל פרויקט", "מנהלת פרויקט", "מנהל חשבונות", "מנהלת חשבונות", "מנהל כספים", "מנהלת כספים", "מנהל לקוחות", "מנהלת לקוחות", "מנהל מחסן", "מנהלת מחסן", "מנהל מוקד", "מנהלת מוקד", "מנהל משרד", "מנהלת משרד", "מנהל מרפאה", "מנהלת מרפאה", "מנהל סניף", "מנהלת סניף", "מנהל עבודה", "מנהלת עבודה", "מנהל רכש", "מנהלת רכש", "מנהל תפעול", "מנהלת תפעול", "מנהל תיקי לקוחות", "מנהלת תיקי לקוחות", "מנופאי", "מעבדה", "מעצב", "מעצבת", "מעצב גרפי", "מעצבת גרפית", "מפיק", "מפיקה", "מפעיל מכונה", "מפעילת מכונה", "מציל", "מצילה", "מרדים", "מרדימה", "מרכז", "מרכזת", "מרכז שירות", "מרכזת שירות", "מרצה", "מרצה בכיר", "משגיח כשרות", "משווק", "משווקת", "משלח", "משלחת", "מתאם", "מתאמת", "מתאם פגישות", "מתאמת פגישות", "מתכנת", "מתכנתת", "נהג", "נהגת", "נהג אוטובוס", "נהגת אוטובוס", "נהג חלוקה", "נהגת חלוקה", "נהג מונית", "נהגת מונית", "נהג משאית", "נהגת משאית", "נגר", "נגרית", "נציג", "נציגה", "נציג בק אופיס", "נציגה בק אופיס", "נציג מכירות", "נציגה מכירות", "נציג שירות", "נציגה שירות", "סגן מנהל", "סגנית מנהל", "סוכן", "סוכנת", "סוכן ביטוח", "סוכנת ביטוח", "סוכן מכירות", "סוכנת מכירות", "סטודנט", "סטודנטית", "ספר", "ספרית", "עובד אדמיניסטרציה", "עובדת אדמיניסטרציה", "עובד ייצור", "עובדת ייצור", "עובד ניקיון", "עובדת ניקיון", "עובד סוציאלי", "עובדת סוציאלית", "עובד כללי", "עובדת כללית", "עובד מעבדה", "עובדת מעבדה", "עובד תחזוקה", "עובדת תחזוקה", "עוזר הוראה", "עוזרת הוראה", "עורך דין", "עורכת דין", "עורך וידאו", "עורכת וידאו", "עיתונאי", "עיתונאית", "עמיל מכס", "עמילה מכס", "פועל", "פועלת", "פיזיותרפיסט", "פיזיותרפיסטית", "פקיד", "פקידה", "פרמדיק", "פרמדיקית", "פסיכולוג", "פסיכולוגית", "פקיד קבלה", "פקידה קבלה", "צלם", "צלמת", "צבעי", "צורף", "קבלן", "קב\"ט", "קונדיטור", "קונדיטורית", "קוסמטיקאית", "קופאי", "קופאית", "קצין בטיחות", "קצינת בטיחות", "קצין ביטחון", "קצינת ביטחון", "קצין רכב", "קצינת רכב", "קצין משאבי אנוש", "קצינת משאבי אנוש", "קריין", "קריינית", "רב", "רואת חשבון", "רואה חשבון", "רוקח", "רוקחת", "רופא", "רופאה", "רופא משפחה", "רופאת משפחה", "רופא שיניים", "רופאת שיניים", "רכז", "רכזת", "רכז גיוס", "רכזת גיוס", "רכז לוגיסטיקה", "רכזת לוגיסטיקה", "רכז תפעול", "רכזת תפעול", "רתך", "שף", "שפית", "שחקן", "שחקנית", "שמאי", "שמאי רכב", "שף קונדיטור", "שוטר", "שוטרת", "שומר", "שומרת", "שרברב", "תובע", "תובעת", "תזונאי", "תזונאית", "תופר", "תופרת", "תחקירן", "תחקירנית", "תיירן", "תיירנית", "תלמיד", "תלמידה", "עצמאי", "עצמאית", "בעל עסק", "בעלת עסק", "פרילנסר", "פרילנסרית", "לא עובד", "לא עובדת", "מחפש עבודה", "מחפשת עבודה", "פנסיונר", "פנסיונרית", "חייל", "חיילת", "איש קבע", "אשת קבע", "מילואימניק", "מילואימניקית", "מאבטח", "מאבטחת", "סדרן", "סדרנית", "עובד מדינה", "עובדת מדינה", "עובד עירייה", "עובדת עירייה", "עובד מועצה", "עובדת מועצה", "עובד ציבור", "עובדת ציבור", "מנכ\"ל", "מנכ\"לית", "סמנכ\"ל", "סמנכ\"לית", "מנהל מערכות מידע", "מנהלת מערכות מידע", "מנהל חדשנות", "מנהלת חדשנות", "מנהל דיגיטל", "מנהלת דיגיטל", "מנהל פיתוח עסקי", "מנהלת פיתוח עסקי", "מנהל קמפיינים", "מנהלת קמפיינים", "מפתח", "מפתחת", "מפתח תוכנה", "מפתחת תוכנה", "מפתח פול סטאק", "מפתחת פול סטאק", "מפתח בקאנד", "מפתחת בקאנד", "מפתח פרונטאנד", "מפתחת פרונטאנד", "מפתח מובייל", "מפתחת מובייל", "מפתח iOS", "מפתחת iOS", "מפתח Android", "מפתחת Android", "מהנדס נתונים", "מהנדסת נתונים", "מדען נתונים", "מדענית נתונים", "אנליסט נתונים", "אנליסטית נתונים", "מנהל IT", "מנהלת IT", "מומחה ענן", "מומחית ענן", "מומחה סייבר", "מומחית סייבר", "אנליסט סייבר", "אנליסטית סייבר", "חוקר סייבר", "חוקרת סייבר", "בודק חדירות", "בודקת חדירות", "DBA", "ארכיטקט תוכנה", "ארכיטקטית תוכנה", "מוכר", "מוכרת", "מוכר בחנות", "מוכרת בחנות", "מוכר פרונטלי", "מוכרת פרונטלית", "נציג תמיכה", "נציגת תמיכה", "נציג קשרי לקוחות", "נציגת קשרי לקוחות", "נציג שימור", "נציגת שימור", "מוקדן", "מוקדנית", "מוקדן שירות", "מוקדנית שירות", "מוקדן מכירות", "מוקדנית מכירות", "טלר", "טלרית", "מטפל", "מטפלת", "מטפל רגשי", "מטפלת רגשית", "מטפל זוגי", "מטפלת זוגית", "מטפל התנהגותי", "מטפלת התנהגותית", "פסיכותרפיסט", "פסיכותרפיסטית", "עובד סיעוד", "עובדת סיעוד", "מטפל סיעודי", "מטפלת סיעודית", "מלווה רפואי", "מלווה רפואית", "מרפא בעיסוק", "מרפאה בעיסוק", "קלינאי תקשורת", "קלינאית תקשורת", "רנטגנאי", "רנטגנאית", "דיאטן", "דיאטנית", "דיאטן קליני", "דיאטנית קלינית", "סניטר", "סניטרית", "רופא ילדים", "רופאת ילדים", "רופא עור", "רופאת עור", "רופא נשים", "רופאת נשים", "רופא פנימי", "רופאה פנימית", "אורתופד", "אורתופדית", "רדיולוג", "רדיולוגית", "קרדיולוג", "קרדיולוגית", "כירורג", "כירורגית", "רופא שיקום", "רופאת שיקום", "פודיאטור", "פודיאטרית", "גננת", "סייע", "סייעת", "מורה יסודי", "מורה על יסודי", "מורה לתיכון", "מורה לאנגלית", "מורה למתמטיקה", "מורה למדעים", "מורה למוזיקה", "מורה לאמנות", "מורה נהיגה", "מורה לחינוך מיוחד", "יועץ חינוכי", "יועצת חינוכית", "מנהל בית ספר", "מנהלת בית ספר", "ספרן", "ספרנית", "חוקר אקדמי", "חוקרת אקדמית", "בנקאי השקעות", "פקיד אשראי", "פקידת אשראי", "פקיד משכנתאות", "פקידת משכנתאות", "חתם אשראי", "חתמת אשראי", "מנהל סיכונים", "מנהלת סיכונים", "אנליסט אשראי", "אנליסטית אשראי", "יועץ פנסיוני", "יועצת פנסיונית", "שמאי ביטוח", "שמאית ביטוח", "מסלק תביעות", "מסלקת תביעות", "נהג מסחרי", "נהגת מסחרית", "נהג הסעות", "נהגת הסעות", "נהג מנוף", "נהגת מנוף", "מלגזן", "מלגזנית", "מנהל צי רכב", "מנהלת צי רכב", "שליח", "שליחה", "בלדר", "בלדרית", "דוור", "דוורית", "אחראי הפצה", "אחראית הפצה", "מתאם לוגיסטי", "מתאמת לוגיסטית", "מסגר", "מסגרית", "חרט", "חרטת", "רתך CO2", "רתכת CO2", "עובד מפעל", "עובדת מפעל", "מפעיל CNC", "מפעילת CNC", "חרט CNC", "חרטת CNC", "מפעיל לייזר", "מפעילת לייזר", "מפעיל רובוט", "מפעילת רובוט", "מפעיל קו ייצור", "מפעילת קו ייצור", "טכנאי מכשור ובקרה", "טכנאית מכשור ובקרה", "מהנדס ייצור", "מהנדסת ייצור", "מהנדס איכות", "מהנדסת איכות", "מנהל מפעל", "מנהלת מפעל", "מנהל ייצור", "מנהלת ייצור", "אופה", "אופה מקצועי", "אופה מקצועית", "שוקולטייר", "בריסטה", "טבח קו", "טבחית קו", "טבח מוסדי", "טבחית מוסדית", "סו שף", "מנהל מסעדה", "מנהלת מסעדה", "מלצר", "מלצרית", "מארח", "מארחת", "צלם סטילס", "צלמת סטילס", "צלם וידאו", "צלמת וידאו", "במאי", "במאית", "מפיק אירועים", "מפיקה אירועים", "שחקן קול", "שחקנית קול", "מעצב אופנה", "מעצבת אופנה", "סטייליסט", "סטייליסטית", "מאפר", "מאפרת", "מעצב פנים", "מעצבת פנים", "הום סטיילינג", "מקעקע", "מקעקעת", "עובד חקלאות", "עובדת חקלאות", "חקלאי", "חקלאית", "כורם", "כורמת", "רפתן", "רפתנית", "לולן", "לולנית", "מאלף כלבים", "מאלפת כלבים", "ספר כלבים", "ספרית כלבים", "מדריך רכיבה", "מדריכת רכיבה", "עורך דין מסחרי", "עורכת דין מסחרית", "עורך דין נדל\"ן", "עורכת דין נדל\"ן", "עורך דין משפחה", "עורכת דין משפחה", "יועץ משפטי", "יועצת משפטית", "מתמחה במשפטים", "מתמחה משפטית", "נוטריון", "חוקר פרטי", "חוקרת פרטית", "מודד", "מודדת", "שמאי מקרקעין", "שמאית מקרקעין", "סוכן נדל\"ן", "סוכנת נדל\"ן", "מתווך", "מתווכת", "מנהל פרויקטי נדל\"ן", "מנהלת פרויקטי נדל\"ן", "מנהל עבודה בבניין", "מנהלת עבודה בבניין", "מהנדס קונסטרוקציה", "מהנדסת קונסטרוקציה", "רצף", "רצפת", "טייח", "טייחת", "קבלן שיפוצים", "קבלנית שיפוצים", "מפעיל עגורן", "מפעילת עגורן", "מיזוג אוויר", "טכנאי קירור", "טכנאית קירור", "פקיד משרד", "פקידת משרד", "מזכירה בכירה", "מזכיר בכיר", "אדמיניסטרטור", "אדמיניסטרטורית", "רכז אדמיניסטרטיבי", "רכזת אדמיניסטרטיבית", "מזכיר אישי", "מזכירה אישית", "פקיד תפעול", "פקידת תפעול", "בק אופיס", "בק אופיס בכיר", "בק אופיס בכירה", "מקליד נתונים", "מקלידת נתונים", "מזין נתונים", "מזינת נתונים", "קניין", "קניינית", "מנהל סחר", "מנהלת סחר", "מנהל קטגוריה", "מנהלת קטגוריה", "מרצ'נדייזר", "מרצ'נדייזרית", "סדרן סחורה", "סדרנית סחורה", "מתרגם", "מתרגמת", "כתב טכני", "כתבת טכנית", "QA ידני", "QA אוטומציה", "בודק אוטומציה", "בודקת אוטומציה", "עוזר אדמיניסטרציה", "עוזרת אדמיניסטרציה", "עוזר תפעול", "עוזרת תפעול", "עוזר מכירות", "עוזרת מכירות", "עוזר שירות לקוחות", "עוזרת שירות לקוחות", "עוזר שירות", "עוזרת שירות", "עוזר גבייה", "עוזרת גבייה", "עוזר לוגיסטיקה", "עוזרת לוגיסטיקה", "עוזר רכש", "עוזרת רכש", "עוזר יבוא", "עוזרת יבוא", "עוזר יצוא", "עוזרת יצוא", "עוזר הדרכה", "עוזרת הדרכה", "עוזר שיווק", "עוזרת שיווק", "עוזר דיגיטל", "עוזרת דיגיטל", "עוזר גיוס", "עוזרת גיוס", "עוזר משאבי אנוש", "עוזרת משאבי אנוש", "עוזר פיתוח עסקי", "עוזרת פיתוח עסקי", "עוזר איכות", "עוזרת איכות", "עוזר בטיחות", "עוזרת בטיחות", "עוזר אחזקה", "עוזרת אחזקה", "עוזר הפצה", "עוזרת הפצה", "עוזר מלאי", "עוזרת מלאי", "עוזר מחסן", "עוזרת מחסן", "עוזר קליניקה", "עוזרת קליניקה", "עוזר מרפאה", "עוזרת מרפאה", "עוזר מעבדה", "עוזרת מעבדה", "עוזר תביעות", "עוזרת תביעות", "עוזר ביטוח", "עוזרת ביטוח", "עוזר פנסיה", "עוזרת פנסיה", "עוזר משכנתאות", "עוזרת משכנתאות", "עוזר אשראי", "עוזרת אשראי", "עוזר כספים", "עוזרת כספים", "עוזר חשבונות", "עוזרת חשבונות", "עוזר תוכן", "עוזרת תוכן", "עוזר סושיאל", "עוזרת סושיאל", "עוזר פרסום", "עוזרת פרסום", "עוזר מדיה", "עוזרת מדיה", "עוזר IT", "עוזרת IT", "עוזר מערכות מידע", "עוזרת מערכות מידע", "עוזר סייבר", "עוזרת סייבר", "עוזר מידע", "עוזרת מידע", "עוזר פרויקטים", "עוזרת פרויקטים", "עוזר לקוחות", "עוזרת לקוחות", "אחראי אדמיניסטרציה", "אחראית אדמיניסטרציה", "אחראי תפעול", "אחראית תפעול", "אחראי מכירות", "אחראית מכירות", "אחראי שירות לקוחות", "אחראית שירות לקוחות", "אחראי שירות", "אחראית שירות", "אחראי גבייה", "אחראית גבייה", "אחראי לוגיסטיקה", "אחראית לוגיסטיקה", "אחראי רכש", "אחראית רכש", "אחראי יבוא", "אחראית יבוא", "אחראי יצוא", "אחראית יצוא", "אחראי הדרכה", "אחראית הדרכה", "אחראי שיווק", "אחראית שיווק", "אחראי דיגיטל", "אחראית דיגיטל", "אחראי גיוס", "אחראית גיוס", "אחראי משאבי אנוש", "אחראית משאבי אנוש", "אחראי פיתוח עסקי", "אחראית פיתוח עסקי", "אחראי איכות", "אחראית איכות", "אחראי בטיחות", "אחראית בטיחות", "אחראי אחזקה", "אחראית אחזקה", "אחראי מלאי", "אחראית מלאי", "אחראי מחסן", "אחראית מחסן", "אחראי קליניקה", "אחראית קליניקה", "אחראי מרפאה", "אחראית מרפאה", "אחראי מעבדה", "אחראית מעבדה", "אחראי תביעות", "אחראית תביעות", "אחראי ביטוח", "אחראית ביטוח", "אחראי פנסיה", "אחראית פנסיה", "אחראי משכנתאות", "אחראית משכנתאות", "אחראי אשראי", "אחראית אשראי", "אחראי כספים", "אחראית כספים", "אחראי חשבונות", "אחראית חשבונות", "אחראי תוכן", "אחראית תוכן", "אחראי סושיאל", "אחראית סושיאל", "אחראי פרסום", "אחראית פרסום", "אחראי מדיה", "אחראית מדיה", "אחראי IT", "אחראית IT", "אחראי מערכות מידע", "אחראית מערכות מידע", "אחראי סייבר", "אחראית סייבר", "אחראי מידע", "אחראית מידע", "אחראי פרויקטים", "אחראית פרויקטים", "אחראי לקוחות", "אחראית לקוחות", "מנהל אדמיניסטרציה", "מנהלת אדמיניסטרציה", "מנהל מכירות", "מנהלת מכירות", "מנהל שירות לקוחות", "מנהלת שירות לקוחות", "מנהל שירות", "מנהלת שירות", "מנהל גבייה", "מנהלת גבייה", "מנהל לוגיסטיקה", "מנהלת לוגיסטיקה", "מנהל יבוא", "מנהלת יבוא", "מנהל יצוא", "מנהלת יצוא", "מנהל הדרכה", "מנהלת הדרכה", "מנהל שיווק", "מנהלת שיווק", "מנהל גיוס", "מנהלת גיוס", "מנהל משאבי אנוש", "מנהלת משאבי אנוש", "מנהל איכות", "מנהלת איכות", "מנהל בטיחות", "מנהלת בטיחות", "מנהל אחזקה", "מנהלת אחזקה", "מנהל הפצה", "מנהלת הפצה", "מנהל מלאי", "מנהלת מלאי", "מנהל קליניקה", "מנהלת קליניקה", "מנהל מעבדה", "מנהלת מעבדה", "מנהל תביעות", "מנהלת תביעות", "מנהל ביטוח", "מנהלת ביטוח", "מנהל פנסיה", "מנהלת פנסיה", "מנהל משכנתאות", "מנהלת משכנתאות", "מנהל אשראי", "מנהלת אשראי", "מנהל תוכן", "מנהלת תוכן", "מנהל סושיאל", "מנהלת סושיאל", "מנהל פרסום", "מנהלת פרסום", "מנהל מדיה", "מנהלת מדיה", "מנהל סייבר", "מנהלת סייבר", "מנהל מידע", "מנהלת מידע", "מנהל פרויקטים", "מנהלת פרויקטים", "רכז אדמיניסטרציה", "רכזת אדמיניסטרציה", "רכז מכירות", "רכזת מכירות", "רכז שירות לקוחות", "רכזת שירות לקוחות", "רכז שירות", "רכזת שירות", "רכז גבייה", "רכזת גבייה", "רכז רכש", "רכזת רכש", "רכז יבוא", "רכזת יבוא", "רכז יצוא", "רכזת יצוא", "רכז הדרכה", "רכזת הדרכה", "רכז שיווק", "רכזת שיווק", "רכז דיגיטל", "רכזת דיגיטל", "רכז משאבי אנוש", "רכזת משאבי אנוש", "רכז פיתוח עסקי", "רכזת פיתוח עסקי", "רכז איכות", "רכזת איכות", "רכז בטיחות", "רכזת בטיחות", "רכז אחזקה", "רכזת אחזקה", "רכז הפצה", "רכזת הפצה", "רכז מלאי", "רכזת מלאי", "רכז מחסן", "רכזת מחסן", "רכז קליניקה", "רכזת קליניקה", "רכז מרפאה", "רכזת מרפאה", "רכז מעבדה", "רכזת מעבדה", "רכז תביעות", "רכזת תביעות", "רכז ביטוח", "רכזת ביטוח", "רכז פנסיה", "רכזת פנסיה", "רכז משכנתאות", "רכזת משכנתאות", "רכז אשראי", "רכזת אשראי", "רכז כספים", "רכזת כספים", "רכז חשבונות", "רכזת חשבונות", "רכז תוכן", "רכזת תוכן", "רכז סושיאל", "רכזת סושיאל", "רכז פרסום", "רכזת פרסום", "רכז מדיה", "רכזת מדיה", "רכז IT", "רכזת IT", "רכז מערכות מידע", "רכזת מערכות מידע", "רכז סייבר", "רכזת סייבר", "רכז מידע", "רכזת מידע", "רכז פרויקטים", "רכזת פרויקטים", "רכז לקוחות", "רכזת לקוחות", "מתאם אדמיניסטרציה", "מתאמת אדמיניסטרציה", "מתאם תפעול", "מתאמת תפעול", "מתאם מכירות", "מתאמת מכירות", "מתאם שירות לקוחות", "מתאמת שירות לקוחות", "מתאם שירות", "מתאמת שירות", "מתאם גבייה", "מתאמת גבייה", "מתאם לוגיסטיקה", "מתאמת לוגיסטיקה", "מתאם רכש", "מתאמת רכש", "מתאם יבוא", "מתאמת יבוא", "מתאם יצוא", "מתאמת יצוא", "מתאם הדרכה", "מתאמת הדרכה", "מתאם שיווק", "מתאמת שיווק", "מתאם דיגיטל", "מתאמת דיגיטל", "מתאם גיוס", "מתאמת גיוס", "מתאם משאבי אנוש", "מתאמת משאבי אנוש", "מתאם פיתוח עסקי", "מתאמת פיתוח עסקי", "מתאם איכות", "מתאמת איכות", "מתאם בטיחות", "מתאמת בטיחות", "מתאם אחזקה", "מתאמת אחזקה", "מתאם הפצה", "מתאמת הפצה", "מתאם מלאי", "מתאמת מלאי", "מתאם מחסן", "מתאמת מחסן", "מתאם קליניקה", "מתאמת קליניקה", "מתאם מרפאה", "מתאמת מרפאה", "מתאם מעבדה", "מתאמת מעבדה", "מתאם תביעות", "מתאמת תביעות", "מתאם ביטוח", "מתאמת ביטוח", "מתאם פנסיה", "מתאמת פנסיה", "מתאם משכנתאות", "מתאמת משכנתאות", "מתאם אשראי", "מתאמת אשראי", "מתאם כספים", "מתאמת כספים", "מתאם חשבונות", "מתאמת חשבונות", "מתאם תוכן", "מתאמת תוכן", "מתאם סושיאל", "מתאמת סושיאל", "מתאם פרסום", "מתאמת פרסום", "מתאם מדיה", "מתאמת מדיה", "מתאם IT", "מתאמת IT", "מתאם מערכות מידע", "מתאמת מערכות מידע", "מתאם סייבר", "מתאמת סייבר", "מתאם מידע", "מתאמת מידע", "מתאם פרויקטים", "מתאמת פרויקטים", "מתאם לקוחות", "מתאמת לקוחות", "מומחה אדמיניסטרציה", "מומחית אדמיניסטרציה", "מומחה תפעול", "מומחית תפעול", "מומחה מכירות", "מומחית מכירות", "מומחה שירות לקוחות", "מומחית שירות לקוחות", "מומחה שירות", "מומחית שירות", "מומחה גבייה", "מומחית גבייה", "מומחה לוגיסטיקה", "מומחית לוגיסטיקה", "מומחה רכש", "מומחית רכש", "מומחה יבוא", "מומחית יבוא", "מומחה יצוא", "מומחית יצוא", "מומחה הדרכה", "מומחית הדרכה", "מומחה שיווק", "מומחית שיווק", "מומחה דיגיטל", "מומחית דיגיטל", "מומחה גיוס", "מומחית גיוס", "מומחה משאבי אנוש", "מומחית משאבי אנוש", "מומחה פיתוח עסקי", "מומחית פיתוח עסקי", "מומחה איכות", "מומחית איכות", "מומחה בטיחות", "מומחית בטיחות", "מומחה אחזקה", "מומחית אחזקה", "מומחה הפצה", "מומחית הפצה", "מומחה מלאי", "מומחית מלאי", "מומחה מחסן", "מומחית מחסן", "מומחה קליניקה", "מומחית קליניקה", "מומחה מרפאה", "מומחית מרפאה", "מומחה מעבדה", "מומחית מעבדה", "מומחה תביעות", "מומחית תביעות", "מומחה ביטוח", "מומחית ביטוח", "מומחה פנסיה", "מומחית פנסיה", "מומחה משכנתאות", "מומחית משכנתאות", "מומחה אשראי", "מומחית אשראי", "מומחה כספים", "מומחית כספים", "מומחה חשבונות", "מומחית חשבונות", "מומחה תוכן", "מומחית תוכן", "מומחה סושיאל", "מומחית סושיאל", "מומחה פרסום", "מומחית פרסום", "מומחה מדיה", "מומחית מדיה", "מומחה IT", "מומחית IT", "מומחה מערכות מידע", "מומחית מערכות מידע", "מומחה מידע", "מומחית מידע", "מומחה פרויקטים", "מומחית פרויקטים", "מומחה לקוחות", "מומחית לקוחות", "יועץ אדמיניסטרציה", "יועצת אדמיניסטרציה", "יועץ תפעול", "יועצת תפעול", "יועץ מכירות", "יועצת מכירות", "יועץ שירות לקוחות", "יועצת שירות לקוחות", "יועץ שירות", "יועצת שירות", "יועץ גבייה", "יועצת גבייה", "יועץ לוגיסטיקה", "יועצת לוגיסטיקה", "יועץ רכש", "יועצת רכש", "יועץ יבוא", "יועצת יבוא", "יועץ יצוא", "יועצת יצוא", "יועץ הדרכה", "יועצת הדרכה", "יועץ שיווק", "יועצת שיווק", "יועץ דיגיטל", "יועצת דיגיטל", "יועץ גיוס", "יועצת גיוס", "יועץ משאבי אנוש", "יועצת משאבי אנוש", "יועץ פיתוח עסקי", "יועצת פיתוח עסקי", "יועץ איכות", "יועצת איכות", "יועץ בטיחות", "יועצת בטיחות", "יועץ אחזקה", "יועצת אחזקה", "יועץ הפצה", "יועצת הפצה", "יועץ מלאי", "יועצת מלאי", "יועץ מחסן", "יועצת מחסן", "יועץ קליניקה", "יועצת קליניקה", "יועץ מרפאה", "יועצת מרפאה", "יועץ מעבדה", "יועצת מעבדה", "יועץ תביעות", "יועצת תביעות", "יועץ פנסיה", "יועצת פנסיה", "יועץ משכנתאות", "יועצת משכנתאות", "יועץ אשראי", "יועצת אשראי", "יועץ כספים", "יועצת כספים", "יועץ חשבונות", "יועצת חשבונות", "יועץ תוכן", "יועצת תוכן", "יועץ סושיאל", "יועצת סושיאל", "יועץ פרסום", "יועצת פרסום", "יועץ מדיה", "יועצת מדיה", "יועץ IT", "יועצת IT", "יועץ מערכות מידע", "יועצת מערכות מידע", "יועץ סייבר", "יועצת סייבר", "יועץ מידע", "יועצת מידע", "יועץ פרויקטים", "יועצת פרויקטים", "יועץ לקוחות", "יועצת לקוחות", "מדריך אדמיניסטרציה", "מדריכה אדמיניסטרציה", "מדריך תפעול", "מדריכה תפעול", "מדריך מכירות", "מדריכה מכירות", "מדריך שירות לקוחות", "מדריכה שירות לקוחות", "מדריך שירות", "מדריכה שירות", "מדריך גבייה", "מדריכה גבייה", "מדריך לוגיסטיקה", "מדריכה לוגיסטיקה", "מדריך רכש", "מדריכה רכש", "מדריך יבוא", "מדריכה יבוא", "מדריך יצוא", "מדריכה יצוא", "מדריך הדרכה", "מדריכה הדרכה", "מדריך שיווק", "מדריכה שיווק", "מדריך דיגיטל", "מדריכה דיגיטל", "מדריך גיוס", "מדריכה גיוס", "מדריך משאבי אנוש", "מדריכה משאבי אנוש", "מדריך פיתוח עסקי", "מדריכה פיתוח עסקי", "מדריך איכות", "מדריכה איכות", "מדריך בטיחות", "מדריכה בטיחות", "מדריך אחזקה", "מדריכה אחזקה", "מדריך הפצה", "מדריכה הפצה", "מדריך מלאי", "מדריכה מלאי", "מדריך מחסן", "מדריכה מחסן", "מדריך קליניקה", "מדריכה קליניקה", "מדריך מרפאה", "מדריכה מרפאה", "מדריך מעבדה", "מדריכה מעבדה", "מדריך תביעות", "מדריכה תביעות", "מדריך ביטוח", "מדריכה ביטוח", "מדריך פנסיה", "מדריכה פנסיה", "מדריך משכנתאות", "מדריכה משכנתאות", "מדריך אשראי", "מדריכה אשראי", "מדריך כספים", "מדריכה כספים", "מדריך חשבונות", "מדריכה חשבונות", "מדריך תוכן", "מדריכה תוכן", "מדריך סושיאל", "מדריכה סושיאל", "מדריך פרסום", "מדריכה פרסום", "מדריך מדיה", "מדריכה מדיה", "מדריך IT", "מדריכה IT", "מדריך מערכות מידע", "מדריכה מערכות מידע", "מדריך סייבר", "מדריכה סייבר", "מדריך מידע", "מדריכה מידע", "מדריך פרויקטים", "מדריכה פרויקטים", "מדריך לקוחות", "מדריכה לקוחות"
    ],
    companies: ["איילון","הראל","כלל","מגדל","מנורה","הפניקס","הכשרה","מדיקר"],
    // חברות שמופיעות רק בשלב "פוליסות קיימות"
    existingCompanies: ["איילון","הראל","כלל","מגדל","מנורה","הפניקס","הכשרה","AIG","ביטוח ישיר","9 מיליון"],

    insTypes: ["בריאות","מחלות קשות","סרטן","תאונות אישיות","ריסק","ריסק משכנתא"],
    bankNames: ["בנק הפועלים","בנק לאומי","בנק דיסקונט","בנק מזרחי-טפחות","הבנק הבינלאומי","בנק מרכנתיל","בנק ירושלים","בנק יהב","בנק מסד","פאג\"י","דואר ישראל","אחר"],

    
    bankAgencies: ["סוכנות מעלות - בנק לאומי","סוכנות פועלים - בנק הפועלים","סוכנות מזרחי טפחות - בנק מזרחי-טפחות","סוכנות עיר שלם - בנק ירושלים","סוכנות דיסקונט - בנק דיסקונט"],

    // כיסויי בריאות (לשלב 3 — פוליסות קיימות)
    healthCovers: [
      { k:"ניתוחים בארץ", sub:"בחירת מנתח/בי\"ח פרטי (לפי תנאי הפוליסה)" },
      { k:"ניתוחים בחו\"ל", sub:"כיסוי ניתוחים וטיפולים בחו\"ל" },
      { k:"השתלות", sub:"כיסוי השתלות וטיפולים מצילי חיים" },
      { k:"תרופות מחוץ לסל", sub:"תרופות שאינן בסל הבריאות" },
      { k:"אמבולטורי", sub:"בדיקות, טיפולים ושירותים ללא אשפוז" },
      { k:"ייעוץ מומחים", sub:"התייעצות עם מומחים ושירותי רופא" },
      { k:"רפואה משלימה", sub:"טיפולים משלימים (דיקור, כירופרקטיקה וכו’)" },
      { k:"בדיקות מתקדמות", sub:"MRI/CT/בדיקות יקרות (לפי תנאי הפוליסה)" },
      { k:"כתב שירות", sub:"שירותי רפואה/תורים/אבחונים (לפי כתב השירות)" }
    ],
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
      this.els.btnSaveDraft = $("#lcSaveDraft");

      // picker
      this.els.picker = $("#lcInsPicker");
      this.els.pickerClose = $("#lcInsPickerClose");

      on(this.els.btnOpen, "click", () => {
        if(!Auth.current) return;
        prepareInteractiveWizardOpen();
        this.reset();
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

      on(this.els.btnPrev, "click", () => this.prevStep());
      on(this.els.btnNext, "click", () => this.nextStep());
      on(this.els.btnSaveDraft, "click", () => this.saveDraft());


      // report + finish flow
      this.els.report = $("#lcReport");
      this.els.reportBody = $("#lcReportBody");
      this.els.reportClose = $("#lcReportClose");
      this.els.reportPrint = $("#lcReportPrint");
      this.els.flow = $("#lcFlow");
      this.els.flowLoading = $("#lcFlowLoading");
      this.els.flowSuccess = $("#lcFlowSuccess");
      this.els.flowProgress = $("#lcFlowProgress");
      this.els.btnOpenCustomerFile = $("#lcOpenCustomerFile");
      this.els.btnSendToOps = $("#lcSendToOps");
      this.els.btnDownloadOpsFile = $("#lcDownloadOpsFile");
      this.els.btnBackToDashboard = $("#lcBackToDashboard");

      on(this.els.reportClose, "click", () => this.closeOperationalReport());
      on(this.els.reportPrint, "click", () => this.exportOperationalPdf());
      on(this.els.report, "click", (e) => {
        const t = e.target;
        if(t && t.getAttribute && t.getAttribute("data-close") === "1") this.closeOperationalReport();
      });
      on(this.els.btnOpenCustomerFile, "click", () => {
        const customerId = this.lastSavedCustomerId;
        this.hideFinishFlow();
        this.close();
        UI.goView("customers");
        if(customerId) setTimeout(() => CustomersUI.openByIdWithLoader(customerId, 1080), 80);
      });
      on(this.els.btnSendToOps, "click", () => {
        this.hideFinishFlow();
        this.openOperationalReport();
      });
      on(this.els.btnDownloadOpsFile, "click", () => this.exportOperationalPdf());
      on(this.els.btnBackToDashboard, "click", () => {
        this.hideFinishFlow();
        this.close();
        UI.goView("dashboard");
      });

      // covers drawer (Step 3 - Health only)
      this.els.coversDrawer = $("#lcCoversDrawer");
      this.els.coversDrawerBackdrop = $("#lcCoversDrawerBackdrop");
      this.els.coversDrawerClose = $("#lcCoversDrawerClose");
      this.els.coversDrawerTitle = $("#lcCoversDrawerTitle");
      this.els.coversHint = this.els.coversDrawer?.querySelector?.(".lcCoversHint") || null;
      this.els.coversList = $("#lcCoversList");
      this.els.coversSave = $("#lcCoversSave");
      this.els.coversCancel = $("#lcCoversCancel");
      this._coversCtx = null; // { kind, insId?, policyId? }

      on(this.els.coversDrawerBackdrop, "click", () => this.closeCoversDrawer());
      on(this.els.coversDrawerClose, "click", () => this.closeCoversDrawer());
      on(this.els.coversCancel, "click", () => this.closeCoversDrawer());
      on(this.els.coversSave, "click", () => this.saveCoversDrawer());

      // policy discount modal
      this.els.policyAddedModal = $("#lcPolicyAddedModal");
      this.els.policyAddedBackdrop = $("#lcPolicyAddedBackdrop");
      this.els.policyAddedApprove = $("#lcPolicyAddedApprove");
      this.els.policyAddedGoDiscount = $("#lcPolicyAddedGoDiscount");
      this._lastAddedPolicyId = null;
      this.els.policyDiscountModal = $("#lcPolicyDiscountModal");
      this.els.policyDiscountBackdrop = $("#lcPolicyDiscountBackdrop");
      this.els.policyDiscountClose = $("#lcPolicyDiscountClose");
      this.els.policyDiscountCancel = $("#lcPolicyDiscountCancel");
      this.els.policyDiscountSave = $("#lcPolicyDiscountSave");
      this.els.policyDiscountName = $("#lcPolicyDiscountName");
      this.els.policyDiscountMeta = $("#lcPolicyDiscountMeta");
      this.els.policyDiscountPct = $("#lcPolicyDiscountPct");
      this.els.policyDiscountYearsBtn = $("#lcPolicyDiscountYearsBtn");
      this.els.policyDiscountScheduleSummary = $("#lcPolicyDiscountScheduleSummary");
      this.els.policyDiscountScheduleList = $("#lcPolicyDiscountScheduleList");
      this.els.policyDiscountScheduleEditor = $("#lcPolicyDiscountScheduleEditor");
      this.els.policyDiscountScheduleBackdrop = $("#lcPolicyDiscountScheduleBackdrop");
      this.els.policyDiscountScheduleClose = $("#lcPolicyDiscountScheduleClose");
      this.els.policyDiscountScheduleCancel = $("#lcPolicyDiscountScheduleCancel");
      this.els.policyDiscountScheduleSave = $("#lcPolicyDiscountScheduleSave");
      this.els.policyDiscountScheduleGrid = $("#lcPolicyDiscountScheduleGrid");
      this.els.policyDiscountPreview = $("#lcPolicyDiscountPreview");
      this.els.policyDiscountError = $("#lcPolicyDiscountError");
      this._discountPolicyId = null;
      this._discountScheduleDraft = [];

      on(this.els.policyAddedBackdrop, "click", () => this.closePolicyAddedModal());
      on(this.els.policyAddedApprove, "click", () => this.closePolicyAddedModal());
      on(this.els.policyAddedGoDiscount, "click", () => this.goToLastAddedPolicyDiscount());

      on(this.els.policyDiscountBackdrop, "click", () => this.closePolicyDiscountModal());
      on(this.els.policyDiscountClose, "click", () => this.closePolicyDiscountModal());
      on(this.els.policyDiscountCancel, "click", () => this.closePolicyDiscountModal());
      on(this.els.policyDiscountSave, "click", () => this.savePolicyDiscountModal());
      on(this.els.policyDiscountYearsBtn, "click", () => this.openPolicyDiscountScheduleEditor());
      on(this.els.policyDiscountScheduleBackdrop, "click", () => this.closePolicyDiscountScheduleEditor());
      on(this.els.policyDiscountScheduleClose, "click", () => this.closePolicyDiscountScheduleEditor());
      on(this.els.policyDiscountScheduleCancel, "click", () => this.closePolicyDiscountScheduleEditor());
      on(this.els.policyDiscountScheduleSave, "click", () => this.savePolicyDiscountScheduleEditor());

      this.ensureHealthFindingsModal();
      on(document, "keydown", (ev) => {
        if(ev.key === "Escape"){
          this.closeHealthFindingsModal();
          this.closePolicyAddedModal();
        }
      });
      on(this.els.policyDiscountPct, "change", () => this.updatePolicyDiscountPreview());

      // base insured
      this.reset();
    },

    _timerHandle: null,

    getCallState(rec){
      if(!rec.payload || typeof rec.payload !== 'object') rec.payload = {};
      if(!rec.payload.mirrorFlow || typeof rec.payload.mirrorFlow !== 'object') rec.payload.mirrorFlow = {};
      if(!rec.payload.mirrorFlow.callSession || typeof rec.payload.mirrorFlow.callSession !== 'object') rec.payload.mirrorFlow.callSession = {};
      const store = rec.payload.mirrorFlow.callSession;
      if(typeof store.active !== 'boolean') store.active = false;
      return store;
    },

    formatDuration(totalSec){
      const s = Math.max(0, Number(totalSec) || 0);
      const hh = String(Math.floor(s / 3600)).padStart(2,'0');
      const mm = String(Math.floor((s % 3600) / 60)).padStart(2,'0');
      const ss = String(s % 60).padStart(2,'0');
      return hh !== '00' ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
    },

    formatFullDate(v){
      if(!v) return '—';
      const d = new Date(v);
      if(Number.isNaN(+d)) return String(v);
      try{ return d.toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit', year:'numeric' }); }catch(_e){ return String(v); }
    },

    formatClock(v){
      if(!v) return '—';
      const d = new Date(v);
      if(Number.isNaN(+d)) return '—';
      try{ return d.toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit', second:'2-digit' }); }catch(_e){ return '—'; }
    },

    openStartModal(){
      const rec = this.current();
      if(!rec || !this.els.startModal) return;
      if(this.els.startText){
        this.els.startText.textContent = `נבחר הלקוח ${rec.fullName || 'לקוח'}. לחץ על התחלה כדי לפתוח את מסך השיקוף ולהפעיל שעון שיחה.`;
      }
      this.els.startModal.hidden = false;
    },

    closeStartModal(){
      if(this.els.startModal) this.els.startModal.hidden = true;
    },

    async startCall(){
      const rec = this.current();
      if(!rec) return;
      const store = this.getCallState(rec);
      const startedAt = nowISO();
      store.active = true;
      store.startedAt = startedAt;
      store.startedBy = safeTrim(Auth?.current?.name);
      store.runtimeSessionId = this.runtimeSessionId;
      store.finishedAt = '';
      store.durationSec = 0;
      store.durationText = '';
      store.dateFull = this.formatFullDate(startedAt);
      store.startTime = this.formatClock(startedAt);
      store.endTime = '';
      setOpsTouch(rec, {
        liveState: 'in_call',
        ownerName: safeTrim(Auth?.current?.name),
        updatedBy: safeTrim(Auth?.current?.name)
      });
      State.data.meta.updatedAt = startedAt;
      rec.updatedAt = startedAt;
      this.closeStartModal();
      this.render();
      this.startTimerLoop();
      await App.persist('שיחת שיקוף התחילה');
    },

    async finishCall(){
      const rec = this.current();
      if(!rec) return;
      const store = this.getCallState(rec);
      if(!store.active || !store.startedAt) return;
      const finishedAt = nowISO();
      const durationSec = Math.max(0, Math.floor((new Date(finishedAt) - new Date(store.startedAt)) / 1000));
      store.active = false;
      store.finishedAt = finishedAt;
      store.durationSec = durationSec;
      store.durationText = this.formatDuration(durationSec);
      store.dateFull = this.formatFullDate(store.startedAt);
      store.startTime = this.formatClock(store.startedAt);
      store.endTime = this.formatClock(finishedAt);
      store.finishedBy = safeTrim(Auth?.current?.name);
      setOpsTouch(rec, {
        liveState: 'call_finished',
        ownerName: safeTrim(Auth?.current?.name),
        updatedBy: safeTrim(Auth?.current?.name)
      });
      State.data.meta.updatedAt = finishedAt;
      rec.updatedAt = finishedAt;
      this.stopTimerLoop();
      this.render();
      await App.persist('שיחת שיקוף הסתיימה');
      alert(`שיחת השיקוף נשמרה. תאריך: ${store.dateFull} · התחלה: ${store.startTime} · משך: ${store.durationText}`);
    },

    startTimerLoop(){
      this.stopTimerLoop();
      const tick = () => { this.renderCallBar(); CustomersUI?.refreshOperationalReflectionCard?.(); };
      tick();
      this._timerHandle = window.setInterval(tick, 1000);
    },

    stopTimerLoop(){
      if(this._timerHandle){
        window.clearInterval(this._timerHandle);
        this._timerHandle = null;
      }
      this.renderCallBar();
      CustomersUI?.refreshOperationalReflectionCard?.();
    },

    renderCallBar(){
      if(!this.els.callBar) return;
      const rec = this.current();
      const store = rec ? this.getCallState(rec) : null;
      const active = !!(rec && store?.active && store?.startedAt && store?.runtimeSessionId === this.runtimeSessionId);
      this.els.callBar.style.display = active ? 'flex' : 'none';
      if(!active) return;
      const seconds = Math.max(0, Math.floor((Date.now() - new Date(store.startedAt).getTime()) / 1000));
      if(this.els.callTimer) this.els.callTimer.textContent = this.formatDuration(seconds);
      if(this.els.callMeta) this.els.callMeta.textContent = `התחיל ב־${store.startTime || this.formatClock(store.startedAt)} · ${store.dateFull || this.formatFullDate(store.startedAt)} · ${safeTrim(store.startedBy) || 'נציג'}`;
    },

    clearStaleActiveCall(rec){
      if(!rec) return false;
      const store = this.getCallState(rec);
      if(!(store?.active && store?.startedAt)) return false;
      if(store.runtimeSessionId === this.runtimeSessionId) return false;
      store.active = false;
      store.startedAt = '';
      store.startedBy = '';
      store.finishedAt = '';
      store.finishedBy = '';
      store.durationSec = 0;
      store.durationText = '';
      store.dateFull = '';
      store.startTime = '';
      store.endTime = '';
      return true;
    },

    suspendUiForExternalModal(){
      this.closeSearch();
      this.closeStartModal();
      this.stopTimerLoop();
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
          clinic:"", shaban:"", occupation:"",
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
          ho: { account:"", branch:"", bankName:"", bankNo:"" },
          healthDeclaration: { categories:{} },
          operationalAgentNumbers: {}
        }
      });

      this.insureds = [ make("primary","מבוטח ראשי") ];
      this.activeInsId = this.insureds[0].id;
      // Step5 (new policies) is global for the case, not per-insured
      this.newPolicies = [];
      this.policyDraft = null;
      this.editingPolicyId = null;

      this.step = 1;
      this.step1FlowMap = {};
      this.lastSavedCustomerId = null;
      this.editingDraftId = null;
      this._finishing = false;
      this.render();
    },

    open(){
      prepareInteractiveWizardOpen();
      try{ MirrorsUI?.suspendUiForExternalModal?.(); }catch(_e){}
      this.isOpen = true;
      this.els.wrap.classList.add("is-open");
      this.els.wrap.setAttribute("aria-hidden","false");
      this.els.wrap.style.pointerEvents = "";
      this.els.wrap.removeAttribute("inert");
      document.body.style.overflow = "hidden";
      document.body.classList.add("modal-open");
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
      this.els.wrap.style.pointerEvents = "";
      this.closeHealthFindingsModal();
      this.closeCoversDrawer?.();
      this.closePolicyAddedModal?.();
      this.closePolicyDiscountModal?.();
      this.hideFinishFlow?.();
      this.closeOperationalReport?.();
      this.closePicker();
      const hasOtherOpenModal = !!document.querySelector('.modal.is-open, .drawer.is-open, .lcWizard.is-open');
      if(!hasOtherOpenModal){
        document.body.style.overflow = "";
        document.body.classList.remove("modal-open");
      }
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


    // ===== Health Covers Drawer (Step 3) =====
    _findInsuredById(id){
      return (this.insureds || []).find(x => String(x.id) === String(id)) || null;
    },

    _findExistingPolicy(ins, pid){
      const list = ins?.data?.existingPolicies || [];
      return list.find(x => String(x.id) === String(pid)) || null;
    },

    getHealthCoverList(obj){
      if(Array.isArray(obj?.healthCovers)) return obj.healthCovers.filter(Boolean);
      if(Array.isArray(obj?.covers)) return obj.covers.filter(Boolean);
      return [];
    },

    summarizeHealthCovers(list, opts={}){
      const arr = Array.isArray(list) ? list.filter(Boolean) : [];
      const max = Number(opts.max || 2);
      const emptyLabel = safeTrim(opts.emptyLabel) || "טרם נבחרו כיסויים";
      if(!arr.length) return emptyLabel;
      if(arr.length <= max) return arr.join(" · ");
      return `${arr.slice(0, max).join(" · ")} +${arr.length - max}`;
    },

    openCoversDrawer(ins, pid){
      const pol = this._findExistingPolicy(ins, pid);
      if(!pol) return;
      if(pol.type !== "בריאות") return;
      if(!Array.isArray(pol.covers)) pol.covers = [];

      this._coversCtx = { kind: "existing", insId: ins.id, policyId: pid };
      this.renderCoversDrawer(pol, {
        title: "בחירת כיסויי בריאות",
        hint: "סמן את הכיסויים הרלוונטיים לפוליסה."
      });

      if(this.els.coversDrawer){
        this.els.coversDrawer.classList.add("is-open");
        this.els.coversDrawer.setAttribute("aria-hidden","false");
      }
    },

    openNewPolicyCoversDrawer(){
      this.ensurePolicyDraft();
      const d = this.policyDraft || {};
      if(d.type !== "בריאות") return;
      if(!Array.isArray(d.healthCovers)) d.healthCovers = [];
      this._coversCtx = { kind: "newDraft" };
      this.renderCoversDrawer(d, {
        title: "כיסויי בריאות — פוליסה חדשה",
        hint: "סמן את הכיסויים שהלקוח רכש ולחץ אישור כיסויים."
      });

      if(this.els.coversDrawer){
        this.els.coversDrawer.classList.add("is-open");
        this.els.coversDrawer.setAttribute("aria-hidden","false");
      }
    },

    closeCoversDrawer(){
      this._coversCtx = null;
      if(this.els.coversDrawer){
        this.els.coversDrawer.classList.remove("is-open");
        this.els.coversDrawer.setAttribute("aria-hidden","true");
      }
    },

    renderCoversDrawer(pol, opts={}){
      if(!this.els.coversList) return;
      const selected = new Set(this.getHealthCoverList(pol));
      if(this.els.coversDrawerTitle) this.els.coversDrawerTitle.textContent = String(opts.title || "בחירת כיסויי בריאות");
      if(this.els.coversHint) this.els.coversHint.textContent = String(opts.hint || "סמן את הכיסויים הרלוונטיים לפוליסה.");
      if(this.els.coversSave) this.els.coversSave.textContent = "אישור כיסויים";
      const items = (this.healthCovers || []).map(c => {
        const key = String(c?.k || "");
        const sub = String(c?.sub || "");
        const checked = selected.has(key) ? "checked" : "";
        return `
          <label class="lcCoverItem">
            <input type="checkbox" value="${escapeHtml(key)}" ${checked} />
            <span class="lcCoverItem__main">
              <span class="lcCoverItem__title">${escapeHtml(key)}</span>
              ${sub ? `<span class="lcCoverItem__sub">${escapeHtml(sub)}</span>` : ""}
            </span>
          </label>
        `;
      }).join("");
      this.els.coversList.innerHTML = items || `<div class="muted">אין כיסויים להצגה</div>`;

      setTimeout(() => {
        const first = this.els.coversList?.querySelector?.('input[type="checkbox"]');
        first?.focus?.();
      }, 20);
    },

    saveCoversDrawer(){
      try{
        const ctx = this._coversCtx;
        if(!ctx) return this.closeCoversDrawer();

        const chosen = [];
        this.els.coversList?.querySelectorAll?.('input[type="checkbox"]')?.forEach?.(cb => {
          if(cb.checked) chosen.push(String(cb.value || "").trim());
        });
        const filtered = chosen.filter(Boolean);

        if(ctx.kind === "newDraft"){
          this.ensurePolicyDraft();
          if(this.policyDraft) this.policyDraft.healthCovers = filtered;
          this.closeCoversDrawer();
          this.render();
          this.setHint(filtered.length ? ("נשמרו " + filtered.length + " כיסויים לפוליסת הבריאות") : "לא נבחרו כיסויים לפוליסת הבריאות");
          return;
        }

        const ins = this._findInsuredById(ctx.insId);
        if(!ins) return this.closeCoversDrawer();
        const pol = this._findExistingPolicy(ins, ctx.policyId);
        if(!pol) return this.closeCoversDrawer();
        if(pol.type !== "בריאות") return this.closeCoversDrawer();

        pol.covers = filtered;

        this.closeCoversDrawer();
        this.render();
        this.setHint(pol.covers.length ? ("נשמרו " + pol.covers.length + " כיסויים") : "לא נבחרו כיסויים");
      }catch(_e){
        this.closeCoversDrawer();
      }
    },

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
      ins.data.occupation = "";
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
      if(!this.step1FlowMap) this.step1FlowMap = {};
      if(this.step === 1 && this.step1FlowMap[id] === undefined) this.step1FlowMap[id] = 0;
      this.render();
    },

    prevStep(){
      if(this.step === 1){
        const ins = this.getActive();
        const idx = this.getStep1FlowIndex(ins);
        if(idx > 0){
          this.setStep1FlowIndex(ins, idx - 1);
          this.setHint("");
          this.render();
          this.focusStep1QuestionSoon();
          return;
        }
      }
      if(this.step <= 1) return;
      const fromStep = this.step;
      this.step -= 1;
      this.handleStepEntry(fromStep, this.step);
      this.render();
    },

    nextStep(){
      if(this.step === 1){
        const ins = this.getActive();
        const questions = this.getStep1Questions(ins);
        const idx = this.getStep1FlowIndex(ins);
        const current = questions[idx];
        if(current && !this.isStep1QuestionComplete(ins, current)){
          this.setHint(current.requiredMsg || "נא להשלים את השדה לפני שממשיכים");
          this.focusStep1QuestionSoon();
          return;
        }
        if(idx < (questions.length - 1)){
          this.setStep1FlowIndex(ins, idx + 1);
          this.setHint("");
          this.render();
          this.focusStep1QuestionSoon();
          return;
        }
      }
      const v = this.validateStep(this.step);
      if(!v.ok){
        this.setHint(v.msg || "נא להשלים את כל החובה בכל המבוטחים");
        return;
      }
      if(this.step >= this.steps.length){
        this.finishWizard();
        return;
      }
      const fromStep = this.step;
      this.step += 1;
      this.handleStepEntry(fromStep, this.step);
      this.setHint("");
      this.render();
    },

    handleStepEntry(fromStep, toStep){
      if(Number(toStep) !== 8 || Number(fromStep) === 8) return;
      const store = this.getHealthStore();
      const list = this.getHealthQuestionList();
      store.ui = store.ui || { currentIndex: 0, summary: false };
      store.ui.summary = false;
      const maxIndex = Math.max(0, list.length - 1);
      const currentIndex = Number(store.ui.currentIndex || 0);
      store.ui.currentIndex = Math.max(0, Math.min(maxIndex, currentIndex));
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
          if(st <= this.step) {
            const fromStep = this.step;
            this.step = st;
            this.handleStepEntry(fromStep, st);
            this.render();
          }
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
      // Steps 5+ are case-level (not per-insured), so hide insured tabs
      if(this.step >= 5){
        this.els.tabs.innerHTML = "";
        this.els.tabs.style.display = "none";
        return;
      }
      this.els.tabs.style.display = "";
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
      if(this.els.btnNext) this.els.btnNext.disabled = false;

      if(this.step === 1){
        const ins = this.getActive();
        const questions = this.getStep1Questions(ins);
        const idx = this.getStep1FlowIndex(ins);
        if(this.els.btnPrev) this.els.btnPrev.disabled = (idx <= 0);
        if(this.els.btnNext) this.els.btnNext.textContent = (idx >= questions.length - 1) ? "לשלב הבא" : "לשאלה הבאה";
        return;
      }

      if(this.els.btnNext) this.els.btnNext.textContent = (this.step >= this.steps.length) ? "סיום הקמת לקוח" : "הבא";
    },

    renderBody(){
      if(!this.els.body) return;
      const ins = this.getActive();
      const stepTitle = this.steps.find(s => s.id === this.step)?.title || "";
      const isCaseLevel = (this.step >= 5);
      const addBtn = (this.step === 3) ? `<button class="btn" id="lcAddExistingPolicy" type="button">➕ הוסף פוליסה</button>` : "";
      const head = (this.step === 1 || this.step === 5) ? "" : (isCaseLevel ? `<div class="lcWSection">
        <div class="row row--between">
          <div>
            <div class="lcWTitle">${escapeHtml(stepTitle)}</div>
            <div class="muted small">${this.step === 9 ? 'בדיקה אחרונה לפני שמירת הלקוח והפקת דוח תפעולי' : ''}</div>
          </div>
        </div>
      </div>` : `<div class="lcWSection">
        <div class="row row--between">
          <div>
            <div class="lcWTitle">${escapeHtml(stepTitle)} · ${escapeHtml(ins.label)}</div>
          </div>
          ${addBtn}
        </div>
      </div>`);

      let body = "";
      if(this.step === 1) body = this.renderStep1(ins);
      else if(this.step === 2) body = this.renderStep2(ins);
      else if(this.step === 3) body = this.renderStep3(ins);
      else if(this.step === 4) body = this.renderStep4(ins);
      else if(this.step === 5) body = this.renderStep5();
      else if(this.step === 6) body = this.renderStep6(this.insureds[0]);
      else if(this.step === 7) body = this.renderStep7();
      else if(this.step === 8) body = this.renderStep8();
      else if(this.step === 9) body = this.renderStep9();
      else body = this.renderStep8();

      this.els.body.innerHTML = head + body;

      // bind generic input handlers
      if(this.step < 5) this.bindInputs(ins);
      else if(this.step === 6) this.bindInputs(this.insureds[0]);
      else if(this.step === 8) this.bindHealthInputs();
      else if(this.step === 9) this.bindOperationalSummaryInputs();
    },

    bindInputs(ins){
      // any element with data-bind="path"
      $$("[data-bind]", this.els.body).forEach(el => {
        const path = el.getAttribute("data-bind");
        if(!path) return;
        const setVal = (doRender=false) => {
          let v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
          if(el.getAttribute && el.getAttribute("data-money")==="ils"){
            const raw = String(v||"").replace(/[₪,\s]/g,"");
            let cleaned = raw.replace(/[^0-9.]/g,"");
            const parts = cleaned.split(".");
            if(parts.length>2) cleaned = parts[0] + "." + parts.slice(1).join("");
            const [i,f] = cleaned.split(".");
            const ii = (i||"").replace(/^0+(?=\d)/,"");
            const withCommas = ii.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            const formatted = (f!==undefined) ? (withCommas + "." + f) : withCommas;
            if(el.value !== formatted) el.value = formatted;
            v = cleaned;
          }
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
      this.bindOccupationAutocomplete(ins);

      if(this.step === 1){
        const focusEl = this.els.body.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
        if(focusEl) focusEl.setAttribute('data-step1-focus', '1');
        this.els.body.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])').forEach(el => {
          on(el, 'keydown', (ev) => {
            if(ev.key !== 'Enter') return;
            if(el.tagName && el.tagName.toLowerCase() === 'textarea') return;
            ev.preventDefault();
            this.nextStep();
          });
        });
      }

      on(addExist, "click", () => { this.addExistingPolicy(ins); });

      // existing policy row actions
      $$("[data-del-exist]", this.els.body).forEach(btn => {
        on(btn, "click", () => {
          const pid = btn.getAttribute("data-del-exist");
          this.delExistingPolicy(ins, pid);
        });
      });

// open health covers drawer (Health only)
      $$("[data-open-covers]", this.els.body).forEach(btn => {
        on(btn, "click", () => {
          const pid = btn.getAttribute("data-open-covers");
          this.openCoversDrawer(ins, pid);
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

      // cancellations choices
      $$("[data-cancel-policy]", this.els.body).forEach(el => {
        on(el, "change", () => {
          const pid = el.getAttribute("data-cancel-policy");
          const key = el.getAttribute("data-cancel-key");
          if(!pid || !key) return;
          if(!ins.data.cancellations[pid]) ins.data.cancellations[pid] = {};
          let v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
          if(el.getAttribute && el.getAttribute("data-money")==="ils"){
            const raw = String(v||"").replace(/[₪,\s]/g,"");
            let cleaned = raw.replace(/[^0-9.]/g,"");
            const parts = cleaned.split(".");
            if(parts.length>2) cleaned = parts[0] + "." + parts.slice(1).join("");
            const [i,f] = cleaned.split(".");
            const ii = (i||"").replace(/^0+(?=\d)/,"");
            const withCommas = ii.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            const formatted = (f!==undefined) ? (withCommas + "." + f) : withCommas;
            if(el.value !== formatted) el.value = formatted;
            v = cleaned;
          }
          ins.data.cancellations[pid][key] = v;
          this.render();
        });
      });

      // payer controls
      $$("[data-payer]", this.els.body).forEach(el => {
        on(el, "change", () => {
          const k = el.getAttribute("data-payer");
          let v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
          if(el.getAttribute && el.getAttribute("data-money")==="ils"){
            const raw = String(v||"").replace(/[₪,\s]/g,"");
            let cleaned = raw.replace(/[^0-9.]/g,"");
            const parts = cleaned.split(".");
            if(parts.length>2) cleaned = parts[0] + "." + parts.slice(1).join("");
            const [i,f] = cleaned.split(".");
            const ii = (i||"").replace(/^0+(?=\d)/,"");
            const withCommas = ii.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            const formatted = (f!==undefined) ? (withCommas + "." + f) : withCommas;
            if(el.value !== formatted) el.value = formatted;
            v = cleaned;
          }
          this.setPath(ins.data, k, v);
          if(k === "selectedPayerId" || k === "payerChoice"){
            if(safeTrim(ins?.data?.payerChoice) === "insured") this.syncSelectedInsuredPayerToHolderFields(ins);
            else this.clearAutoInheritedHolderFieldsForExternalPayer(ins);
          }
          this.render();
        });
      });
    },

    setPath(obj, path, value){
      const parts = String(path).split(".");
      let cur = obj;
      for(let i=0;i<parts.length-1;i++){
        const k = parts[i];
        if(!cur[k] || typeof cur[k] !== "object") cur[k] = {};
        cur = cur[k];
      }
      cur[parts[parts.length-1]] = value;
    },


    normalizeOccupationSearch(value){
      return String(value || "")
        .normalize("NFKC")
        .replace(/[׳'"`]/g, "")
        .replace(/[-_/.,]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    },

    getOccupationSuggestions(term){
      const q = this.normalizeOccupationSearch(term);
      const list = Array.isArray(this.occupations) ? this.occupations : [];
      if(!q) return list.slice(0, 20);
      const exact = [];
      const starts = [];
      const includes = [];
      list.forEach(item => {
        const txt = this.normalizeOccupationSearch(item);
        if(!txt.includes(q)) return;
        if(txt === q) exact.push(item);
        else if(txt.startsWith(q)) starts.push(item);
        else includes.push(item);
      });
      return exact.concat(starts, includes).slice(0, 20);
    },

    renderOccupationSuggestions(term, currentValue){
      const cur = safeTrim(currentValue);
      const items = this.getOccupationSuggestions(term);
      if(!items.length){
        return `<button type="button" class="lcOccOption is-empty" data-occ-empty="1">לא נמצאו תוצאות. אפשר להקליד ידנית.</button>`;
      }
      return items.map(item => {
        const active = (safeTrim(item) === cur) ? " is-active" : "";
        return `<button type="button" class="lcOccOption${active}" data-occ-value="${escapeHtml(item)}">${escapeHtml(item)}</button>`;
      }).join("");
    },

    bindOccupationAutocomplete(ins){
      const input = $("#lcOccupationInput", this.els.body);
      const menu = $("#lcOccupationMenu", this.els.body);
      if(!input || !menu) return;

      const openMenu = () => {
        menu.classList.add("is-open");
        input.setAttribute("aria-expanded", "true");
      };
      const closeMenu = () => {
        menu.classList.remove("is-open");
        input.setAttribute("aria-expanded", "false");
      };
      const refreshMenu = () => {
        menu.innerHTML = this.renderOccupationSuggestions(input.value, ins.data.occupation || "");
      };
      const choose = (val) => {
        const picked = safeTrim(val);
        input.value = picked;
        ins.data.occupation = picked;
        refreshMenu();
        closeMenu();
        this.setHint("");
      };

      refreshMenu();
      on(input, "focus", () => { refreshMenu(); openMenu(); });
      on(input, "click", () => { refreshMenu(); openMenu(); });
      on(input, "input", () => { ins.data.occupation = safeTrim(input.value); refreshMenu(); openMenu(); });
      on(input, "keydown", (ev) => {
        const options = $$("[data-occ-value]", menu);
        const current = menu.querySelector(".lcOccOption.is-hover");
        let idx = current ? options.indexOf(current) : -1;
        if(ev.key === "ArrowDown"){
          ev.preventDefault();
          if(!menu.classList.contains("is-open")){ refreshMenu(); openMenu(); }
          idx = Math.min(idx + 1, options.length - 1);
          options.forEach(o => o.classList.remove("is-hover"));
          if(options[idx]) options[idx].classList.add("is-hover");
          return;
        }
        if(ev.key === "ArrowUp"){
          ev.preventDefault();
          idx = Math.max(idx - 1, 0);
          options.forEach(o => o.classList.remove("is-hover"));
          if(options[idx]) options[idx].classList.add("is-hover");
          return;
        }
        if(ev.key === "Enter" && menu.classList.contains("is-open")){
          const picked = menu.querySelector(".lcOccOption.is-hover") || menu.querySelector("[data-occ-value]");
          if(picked){
            ev.preventDefault();
            choose(picked.getAttribute("data-occ-value") || picked.textContent || "");
          }
          return;
        }
        if(ev.key === "Escape") closeMenu();
      });
      on(menu, "mousedown", (ev) => {
        const btn = ev.target && ev.target.closest ? ev.target.closest("[data-occ-value]") : null;
        if(!btn) return;
        ev.preventDefault();
        choose(btn.getAttribute("data-occ-value") || "");
      });
      on(document, "click", (ev) => {
        if(!this.els.body || !this.els.body.contains(input)) return;
        const inside = ev.target === input || menu.contains(ev.target);
        if(!inside) closeMenu();
      });
    },

    // ---------- Step 1 ----------
    getStep1Questions(ins){
      const d = ins.data || {};
      const isChild = ins.type === "child";
      const primary = this.insureds[0]?.data || {};
      const inherited = (key) => safeTrim(primary[key]);
      const age = this.calcAge(d.birthDate);
      const ageTxt = age === null ? "טרם חושב" : (String(age) + " שנים");
      const shabanHelp = d.clinic ? 'בחר את רמת השב״ן של הלקוח' : 'קודם בוחרים קופת חולים ואז נפתחת רשימת השב״ן';
      const questions = [
        {
          key:'firstName',
          title:'מה השם הפרטי של ' + ins.label + '?',
          sub:'נפתח מהשם הפרטי ונבנה את התיק בצורה מסודרת.',
          render:() => this.fieldText('שם פרטי','firstName', d.firstName)
        },
        {
          key:'lastName',
          title:'מה שם המשפחה של ' + ins.label + '?',
          sub:'כך נציג את הלקוח במערכת, בחיפוש ובתיק הלקוח.',
          render:() => this.fieldText('שם משפחה','lastName', d.lastName)
        },
        {
          key:'idNumber',
          title:'מה תעודת הזהות?',
          sub:'נזין את מספר הזהות של המבוטח לצורך שיוך מלא בתיק.',
          render:() => this.fieldText('ת״ז','idNumber', d.idNumber, 'numeric')
        },
        {
          key:'birthDate',
          title:'מה תאריך הלידה?',
          sub:'אפשר להזין בפורמט DD/MM/YYYY.',
          render:() => this.fieldDate('תאריך לידה','birthDate', d.birthDate)
        },
        {
          key:'age',
          title:'הגיל מחושב אוטומטית',
          sub:'המערכת מושכת את הגיל לפי תאריך הלידה שהוזן.',
          required:false,
          render:() => `<div class="lcStep1InfoCard"><div class="lcStep1InfoCard__label">גיל</div><div class="lcStep1InfoCard__value">${escapeHtml(ageTxt)}</div><div class="lcStep1InfoCard__sub">השדה אוטומטי ואינו דורש עריכה.</div></div>`
        },
        {
          key:'gender',
          title:'מה המין של המבוטח?',
          sub:'נבחר את המין כפי שמופיע בפרטי הלקוח.',
          render:() => this.fieldSelect('מין','gender', d.gender, ['', 'זכר', 'נקבה'])
        }
      ];

      if(!isChild){
        questions.push({
          key:'maritalStatus',
          title:'מה המצב המשפחתי?',
          sub:'השדה נשמר אחד לאחד כפי שביקשת.',
          required:false,
          render:() => this.fieldSelect('מצב משפחתי','maritalStatus', d.maritalStatus, ['', 'רווק/ה', 'נשוי/אה', 'גרוש/ה', 'אלמן/ה', 'ידוע/ה בציבור'])
        });
      }

      questions.push(
        {
          key:'phone',
          title:'מה מספר הטלפון?',
          sub: isChild ? 'בקטין הטלפון נלקח אוטומטית מהמבוטח הראשי.' : 'נזין מספר נייד ליצירת קשר עם הלקוח.',
          required:!isChild,
          render:() => isChild
            ? `<div class="lcStep1InfoCard"><div class="lcStep1InfoCard__label">טלפון</div><div class="lcStep1InfoCard__value">${escapeHtml(inherited('phone') || 'טרם מולא במבוטח הראשי')}</div><div class="lcStep1InfoCard__sub">בקטין השדה מוצג לקריאה בלבד.</div></div>`
            : this.fieldText('טלפון','phone', d.phone, 'tel')
        },
        {
          key:'email',
          title:'מה כתובת האימייל?',
          sub: isChild ? 'האימייל עובר בירושה מהמבוטח הראשי.' : 'האימייל ישמש גם להצעות, תפעול וסיכום לקוח.',
          required:!isChild,
          render:() => isChild
            ? `<div class="lcStep1InfoCard"><div class="lcStep1InfoCard__label">אימייל</div><div class="lcStep1InfoCard__value">${escapeHtml(inherited('email') || 'טרם מולא במבוטח הראשי')}</div><div class="lcStep1InfoCard__sub">בקטין השדה מוצג לקריאה בלבד.</div></div>`
            : this.fieldText('מייל','email', d.email, 'email')
        },
        {
          key:'city',
          title:'באיזו עיר הלקוח גר?',
          sub: isChild ? 'העיר נמשכת אוטומטית מהמבוטח הראשי.' : 'העיר תשמש גם לחישוב המיקוד האוטומטי.',
          required:!isChild,
          render:() => isChild
            ? `<div class="lcStep1InfoCard"><div class="lcStep1InfoCard__label">עיר</div><div class="lcStep1InfoCard__value">${escapeHtml(inherited('city') || 'טרם מולא במבוטח הראשי')}</div><div class="lcStep1InfoCard__sub">בקטין השדה מוצג לקריאה בלבד.</div></div>`
            : this.fieldText('עיר','city', d.city)
        },
        {
          key:'street',
          title:'מה שם הרחוב?',
          sub: isChild ? 'הרחוב נמשך מהמבוטח הראשי.' : 'נזין כתובת מגורים מעודכנת.',
          required:!isChild,
          render:() => isChild
            ? `<div class="lcStep1InfoCard"><div class="lcStep1InfoCard__label">רחוב</div><div class="lcStep1InfoCard__value">${escapeHtml(inherited('street') || 'טרם מולא במבוטח הראשי')}</div><div class="lcStep1InfoCard__sub">בקטין השדה מוצג לקריאה בלבד.</div></div>`
            : this.fieldText('רחוב','street', d.street)
        },
        {
          key:'houseNumber',
          title:'מה מספר הבית?',
          sub: isChild ? 'מספר הבית נמשך אוטומטית מהמבוטח הראשי.' : 'השדה מסייע גם לחישוב המיקוד האוטומטי.',
          required:!isChild,
          render:() => isChild
            ? `<div class="lcStep1InfoCard"><div class="lcStep1InfoCard__label">מספר בית</div><div class="lcStep1InfoCard__value">${escapeHtml(inherited('houseNumber') || 'טרם מולא במבוטח הראשי')}</div><div class="lcStep1InfoCard__sub">בקטין השדה מוצג לקריאה בלבד.</div></div>`
            : this.fieldText('מספר','houseNumber', d.houseNumber, 'numeric')
        },
        {
          key:'zip',
          title:'המיקוד נשלף אוטומטית',
          sub:'המיקוד יחושב לפי עיר, רחוב ומספר בית.',
          required:false,
          render:() => `<div class="lcStep1InfoCard"><div class="lcStep1InfoCard__label">מיקוד</div><div class="lcStep1InfoCard__value" data-zip="zip">${escapeHtml(isChild ? inherited('zip') : (d.zip || 'ימולא אוטומטית'))}</div><div class="lcStep1InfoCard__sub">השדה אוטומטי ואינו דורש הקלדה.</div></div>`
        },
        {
          key:'clinic',
          title:'לאיזו קופת חולים הלקוח שייך?',
          sub:'בחירת הקופה תפתח את אפשרויות השב״ן המתאימות.',
          render:() => `<div class="field"><label class="label">קופת חולים</label><select class="input" data-bind="clinic"><option value="" ${!d.clinic?'selected':''}>בחר…</option>${this.clinics.map(x => `<option value="${escapeHtml(x)}"${d.clinic===x?' selected':''}>${escapeHtml(x)}</option>`).join('')}</select></div>`
        },
        {
          key:'shaban',
          title:'מה רמת השב״ן?',
          sub: shabanHelp,
          render:() => `<div class="field"><label class="label">שב״ן</label><select class="input" data-bind="shaban" ${d.clinic ? '' : 'disabled'}>${(this.shabanMap[d.clinic] || ['אין שב״ן']).map(x => `<option value="${escapeHtml(x)}"${d.shaban===x?' selected':''}>${escapeHtml(x)}</option>`).join('')}</select><div class="help">הרשימה משתנה לפי הקופה שנבחרה.</div></div>`
        }
      );

      if(isChild){
        questions.push({
          key:'inheritNotice',
          title:'ירושה אוטומטית לקטין',
          sub:'כמו שביקשת, השדות של כתובת, טלפון ומייל נשארים אחד לאחד — ומוצגים כאן בקריאה בלבד עבור קטין.',
          required:false,
          render:() => `<div class="lcStep1InfoCard lcStep1InfoCard--soft"><div class="lcStep1InfoCard__label">לקטין</div><div class="lcStep1InfoCard__value">המערכת יורשת אוטומטית טלפון, אימייל וכתובת מהמבוטח הראשי.</div><div class="lcStep1InfoCard__sub">אין צורך למלא שוב את אותם שדות.</div></div>`
        });
      }else{
        questions.push({
          key:'occupation',
          title:'מה העיסוק של הלקוח?',
          sub:'יש חיפוש חכם עם מאגר עיסוקים מורחב.',
          render:() => `<div class="field"><label class="label">עיסוק</label><div class="lcOccWrap"><input class="input lcOccInput" id="lcOccupationInput" type="text" data-bind="occupation" value="${escapeHtml(d.occupation || '')}" placeholder="התחל להקליד עיסוק…" autocomplete="off" aria-autocomplete="list" aria-expanded="false" /><div class="lcOccMenu" id="lcOccupationMenu">${this.renderOccupationSuggestions(d.occupation || '', d.occupation || '')}</div></div><div class="help">מאגר עיסוקים מורחב עם חיפוש חכם. אם לא נמצאה התאמה, אפשר להקליד עיסוק ידנית.</div></div>`
        });
      }

      return questions.map((q, i) => ({
        required: q.required !== false,
        requiredMsg: q.requiredMsg || ('נא להשלים את השדה "' + (q.key || ('שאלה ' + (i+1))) + '" לפני שממשיכים'),
        ...q
      }));
    },

    getStep1FlowIndex(ins){
      if(!this.step1FlowMap) this.step1FlowMap = {};
      const max = Math.max(0, this.getStep1Questions(ins).length - 1);
      let idx = Number(this.step1FlowMap[ins.id] || 0);
      if(!Number.isFinite(idx)) idx = 0;
      if(idx < 0) idx = 0;
      if(idx > max) idx = max;
      this.step1FlowMap[ins.id] = idx;
      return idx;
    },

    setStep1FlowIndex(ins, idx){
      if(!this.step1FlowMap) this.step1FlowMap = {};
      const max = Math.max(0, this.getStep1Questions(ins).length - 1);
      let safe = Number(idx || 0);
      if(!Number.isFinite(safe)) safe = 0;
      if(safe < 0) safe = 0;
      if(safe > max) safe = max;
      this.step1FlowMap[ins.id] = safe;
    },

    isStep1QuestionComplete(ins, q){
      if(!q || q.required === false) return true;
      const d = ins.data || {};
      const primary = this.insureds[0]?.data || {};
      const inheritedKeys = ['phone','email','city','street','houseNumber','zip'];
      if(ins.type === 'child' && inheritedKeys.includes(q.key)) return !!safeTrim(primary[q.key]);
      return !!safeTrim(d[q.key]);
    },

    focusStep1QuestionSoon(){
      setTimeout(() => {
        const root = this.els?.body;
        if(!root) return;
        const el = root.querySelector('[data-step1-focus], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
        try{ el?.focus?.(); }catch(_e){}
      }, 30);
    },

    renderStep1Summary(ins, questions, activeIdx){
      const d = ins.data || {};
      const summaryItems = questions.map((q, idx) => {
        const active = idx === activeIdx ? ' is-active' : '';
        const done = this.isStep1QuestionComplete(ins, q) ? ' is-done' : '';
        let value = '';
        if(q.key === 'age') value = this.calcAge(d.birthDate);
        else if(q.key === 'inheritNotice') value = 'אוטומטי';
        else if(q.key) value = d[q.key];
        if(ins.type === 'child' && ['phone','email','city','street','houseNumber','zip'].includes(q.key || '')) value = (this.insureds[0]?.data || {})[q.key] || '';
        const shown = safeTrim(value) || '—';
        return `<div class="lcStep1SummaryItem${active}${done}"><div class="lcStep1SummaryItem__k">${escapeHtml(q.title || '')}</div><div class="lcStep1SummaryItem__v">${escapeHtml(String(shown))}</div></div>`;
      }).join('');
      return `<aside class="lcStep1Summary"><div class="lcStep1Summary__head"><div class="lcStep1Summary__title">תקציר ${escapeHtml(ins.label)}</div><div class="lcStep1Summary__sub">הפרטים שכבר הוזנו בשלב 1</div></div><div class="lcStep1Summary__list">${summaryItems}</div></aside>`;
    },

    renderStep1(ins){
      const questions = this.getStep1Questions(ins);
      const idx = this.getStep1FlowIndex(ins);
      const q = questions[idx] || questions[0];

      return `
        <div class="lcStep1Premium lcStep1Premium--compact">
          <div class="lcStep1Premium__main">
            <section class="lcStep1QuestionCard lcStep1QuestionCard--compact">
              <div class="lcStep1QuestionCard__top lcStep1QuestionCard__top--single">
                <div class="lcStep1QuestionCard__tag">${escapeHtml(ins.label)}</div>
              </div>
              <h3 class="lcStep1QuestionCard__title">${escapeHtml(q?.title || '')}</h3>
              <div class="lcStep1QuestionCard__sub">${escapeHtml(q?.sub || '')}</div>
              <div class="lcStep1QuestionCard__body" data-step1-body="1">${q?.render ? q.render() : ''}</div>
            </section>
          </div>
          ${this.renderStep1Summary(ins, questions, idx)}
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
      const has = !(d.bmi === null || d.bmi === undefined || d.bmi === "");
      const bmiTxt = has ? String(d.bmi) : "—";
      const labelTxt = has ? (st.label || "—") : "מלא גובה ומשקל";

      return `
        <div class="lcWSection">
          <div class="lcWTitle">BMI</div>
          <div class="lcWGrid">
            ${this.fieldText("גובה (ס״מ)","heightCm", d.heightCm, "numeric")}
            ${this.fieldText("משקל (ק״ג)","weightKg", d.weightKg, "numeric")}

            <div class="lcBmiCard ${has ? "" : "is-empty"}" data-bmi="card">
              <div class="lcBmiCard__side">
                <span class="lcLamp lcBmiDot ${st.lamp}" data-bmi="lamp" aria-hidden="true"></span>
              </div>
              <div class="lcBmiCard__main">
                <div class="lcBmiCard__value" data-bmi="value">${escapeHtml(bmiTxt)}</div>
                <div class="lcBmiCard__label" data-bmi="label">${escapeHtml(labelTxt)}</div>
              </div>
            </div>

          </div>
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
        compensation:"",
        monthlyPremium:""
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
      const anyHealth = (d.existingPolicies || []).some(x => x && x.type === "בריאות");
      const col4Label = anyHealth ? "כיסויים" : "סכום/פיצוי";

      const rows = (d.existingPolicies || []).map(p => {
        const logoSrc = this.getCompanyLogoSrc(p.company);
        const logo = logoSrc
          ? `<img class="lcPolLogoMini" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(p.company||"")}" />`
          : `<div class="lcPolLogoMini lcPolLogoMini--empty" aria-hidden="true"></div>`;
        const compOpts = (this.existingCompanies || this.companies).map(x => `<option value="${escapeHtml(x)}"${p.company===x?" selected":""}>${escapeHtml(x)}</option>`).join("");
        const typeOpts = this.insTypes.map(x => `<option value="${escapeHtml(x)}"${p.type===x?" selected":""}>${escapeHtml(x)}</option>`).join("");
        const isRisk = (p.type === "ריסק" || p.type === "ריסק משכנתא");
        const isCI = (p.type === "מחלות קשות" || p.type === "סרטן");
        const isHealth = (p.type === "בריאות");
        const bankOpts = this.bankNames.map(b => `<option value="${escapeHtml(b)}"${safeTrim(p.pledgeBankName)===b?" selected":""}>${escapeHtml(b)}</option>`).join("");
        const agencies = this.bankAgencies.filter(a => !safeTrim(p.pledgeBankName) || String(a).includes(p.pledgeBankName));
        const agencyOpts = agencies.map(a => `<option value="${escapeHtml(a)}"${safeTrim(p.bankAgencyName)===a?" selected":""}>${escapeHtml(a)}</option>`).join("");

        const coversCount = Array.isArray(p.covers) ? p.covers.length : 0;
        const coversLabel = coversCount ? (coversCount + " כיסויים נבחרו") : "בחירת כיסויים";

        return `
          <tr>
            <td>
              <div class="lcPolCompanyCell">
                ${logo}
                <select class="input" data-bind="existingPolicies.${p.id}.company" aria-label="חברת ביטוח">
                  <option value="">בחר…</option>${compOpts}
                </select>
              </div>
            </td>
            <td>
              <select class="input" data-bind="existingPolicies.${p.id}.type">
                <option value="">בחר…</option>${typeOpts}
              </select>
            </td>
            <td><input class="input" data-bind="existingPolicies.${p.id}.policyNumber" value="${escapeHtml(p.policyNumber||"")}" placeholder="מספר פוליסה" /></td>
            <td>
              ${isHealth ? `
                <button class="btn lcSmallBtn lcCoversBtn" data-open-covers="${escapeHtml(p.id)}" type="button">${escapeHtml(coversLabel)}</button>
              ` : isRisk ? `<input class="input" data-bind="existingPolicies.${p.id}.sumInsured" value="${escapeHtml(p.sumInsured||"")}" placeholder="סכום ביטוח" />` : isCI ? `<input class="input" data-bind="existingPolicies.${p.id}.compensation" value="${escapeHtml(p.compensation||"")}" placeholder="סכום פיצוי" />` : `<span class="muted small">—</span>`}
            </td>
            <td>
              <div class="moneyField" title="פרמיה חודשית">
                <input class="input moneyField__input" data-money="ils" data-bind="existingPolicies.${p.id}.monthlyPremium" value="${escapeHtml(p.monthlyPremium||"")}" placeholder="0" inputmode="decimal" />
                <span class="moneyField__sym">₪</span>
              </div>
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

      return `
        <div class="lcWSection">
          <div class="lcPolTableWrap" style="padding:0">
            <table class="lcPolTable">
              <thead>
                <tr>
                  <th>חברה</th>
                  <th>סוג</th>
                  <th>מספר</th>
                  <th>${escapeHtml(col4Label)}</th>
                  <th>פרמיה חודשית</th>
                  <th>שיעבוד</th>
                  <th style="width:100px">פעולות</th>
                </tr>
              </thead>
              <tbody>${rows || `<tr><td colspan="7" class="muted">אין פוליסות עדיין</td></tr>`}</tbody>
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
          let v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
          if(el.getAttribute && el.getAttribute("data-money")==="ils"){
            const raw = String(v||"").replace(/[₪,\s]/g,"");
            let cleaned = raw.replace(/[^0-9.]/g,"");
            const parts = cleaned.split(".");
            if(parts.length>2) cleaned = parts[0] + "." + parts.slice(1).join("");
            const [i,f] = cleaned.split(".");
            const ii = (i||"").replace(/^0+(?=\d)/,"");
            const withCommas = ii.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            const formatted = (f!==undefined) ? (withCommas + "." + f) : withCommas;
            if(el.value !== formatted) el.value = formatted;
            v = cleaned;
          }

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
      this.bindOccupationAutocomplete(ins);

      if(this.step === 1){
        const focusEl = this.els.body.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
        if(focusEl) focusEl.setAttribute('data-step1-focus', '1');
        this.els.body.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])').forEach(el => {
          on(el, 'keydown', (ev) => {
            if(ev.key !== 'Enter') return;
            if(el.tagName && el.tagName.toLowerCase() === 'textarea') return;
            ev.preventDefault();
            this.nextStep();
          });
        });
      }

      on(addExist, "click", () => { this.addExistingPolicy(ins); });
      $$("[data-del-exist]", this.els.body).forEach(btn => on(btn, "click", () => this.delExistingPolicy(ins, btn.getAttribute("data-del-exist"))));

      // open health covers drawer (Health only)
      $$("[data-open-covers]", this.els.body).forEach(btn => {
        on(btn, "click", () => {
          const pid = btn.getAttribute("data-open-covers");
          if(!pid) return;
          this.openCoversDrawer(ins, pid);
        });
      });

      const addNew = $("#lcAddNewPolicy", this.els.body);
      on(addNew, "click", () => { this.addNewPolicy(ins); });
      $$("[data-del-new]", this.els.body).forEach(btn => on(btn, "click", () => this.delNewPolicy(ins, btn.getAttribute("data-del-new"))));

      $$("[data-cancel-policy]", this.els.body).forEach(el => {
        on(el, "change", () => {
          const pid = el.getAttribute("data-cancel-policy");
          const key = el.getAttribute("data-cancel-key");
          if(!pid || !key) return;
          if(!ins.data.cancellations[pid]) ins.data.cancellations[pid] = { attachments: {} };
          let v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
          if(el.getAttribute && el.getAttribute("data-money")==="ils"){
            const raw = String(v||"").replace(/[₪,\s]/g,"");
            let cleaned = raw.replace(/[^0-9.]/g,"");
            const parts = cleaned.split(".");
            if(parts.length>2) cleaned = parts[0] + "." + parts.slice(1).join("");
            const [i,f] = cleaned.split(".");
            const ii = (i||"").replace(/^0+(?=\d)/,"");
            const withCommas = ii.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            const formatted = (f!==undefined) ? (withCommas + "." + f) : withCommas;
            if(el.value !== formatted) el.value = formatted;
            v = cleaned;
          }
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
          let v = (el.type === "checkbox") ? !!el.checked : safeTrim(el.value);
          if(el.getAttribute && el.getAttribute("data-money")==="ils"){
            const raw = String(v||"").replace(/[₪,\s]/g,"");
            let cleaned = raw.replace(/[^0-9.]/g,"");
            const parts = cleaned.split(".");
            if(parts.length>2) cleaned = parts[0] + "." + parts.slice(1).join("");
            const [i,f] = cleaned.split(".");
            const ii = (i||"").replace(/^0+(?=\d)/,"");
            const withCommas = ii.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            const formatted = (f!==undefined) ? (withCommas + "." + f) : withCommas;
            if(el.value !== formatted) el.value = formatted;
            v = cleaned;
          }
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
        {v:"partial_health", t:"ביטול חלקי"},
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

        const isHealthPolicy = (() => {
          const t = safeTrim(p.type || "");
          return t.includes("בריאות") || t.toLowerCase().includes("health");
        })();
        const showAnnex = (status === "partial_health") && isHealthPolicy;
        const pledgedBank = !!(p.hasPledge && p.bankAgency);

        return `
          <div class="lcWSection lcCancelCard">
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

      return `<div class="lcCancelList">` + blocks + `</div>`;
    },

    // ---------- Step 5 (NEW: company -> product, case-level) ----------
    getCompanyLogoSrc(company){
      const map = {
        "הפניקס": "afenix.png",
        "הראל": "harel.png",
        "כלל": "clal.png",
        "מגדל": "megdl.png",
        "מנורה": "menora.png",
        "איילון": "ayalon.png",
        "הכשרה": "achshara.png",
        "AIG": "aig.png",
        "ביטוח ישיר": "beytuyashir.png",
        "9 מיליון": "9milyon.png",
        "מדיקר": "medicare.png"
      };
      return map[company] || "";
    },


    asMoneyNumber(v){
      const raw = String(v ?? "").replace(/[^\d.-]/g, "");
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    },

    getPolicyDiscountPct(policy){
      const n = Number(String(policy?.discountPct ?? "0").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    },

    getPolicyDiscountSchedule(policy){
      if(Array.isArray(policy?.discountSchedule)){
        return policy.discountSchedule
          .map((item, idx) => {
            const year = Math.max(1, Math.min(10, Number(item?.year || (idx + 1)) || (idx + 1)));
            const pct = Number(String(item?.pct ?? item?.discountPct ?? "0").replace(/[^\d.-]/g, ""));
            return { year, pct: Number.isFinite(pct) ? Math.max(0, pct) : 0 };
          })
          .filter(item => item.pct > 0)
          .sort((a,b) => a.year - b.year);
      }
      const years = Math.max(0, Math.min(10, Number(String(policy?.discountYears || "").replace(/[^\d]/g, "")) || 0));
      const pct = this.getPolicyDiscountPct(policy);
      if(!years || pct <= 0) return [];
      return Array.from({ length: years }, (_, idx) => ({ year: idx + 1, pct }));
    },

    getPolicyDiscountYearsLabel(policy){
      const schedule = this.getPolicyDiscountSchedule(policy);
      if(schedule.length) return String(schedule.length);
      const yearsRaw = safeTrim(policy?.discountYears || "");
      return yearsRaw;
    },

    getPolicyDiscountScheduleSummary(policy){
      const schedule = this.getPolicyDiscountSchedule(policy);
      if(!schedule.length) return "";
      return schedule.map(item => `שנה ${item.year}: ${item.pct}%`).join(" · ");
    },

    getPolicyDiscountDisplayText(policy, options = {}){
      const pct = this.getPolicyDiscountPct(policy);
      const years = this.getPolicyDiscountYearsLabel(policy);
      const scheduleSummary = this.getPolicyDiscountScheduleSummary(policy);
      const compact = options && options.compact;
      if(scheduleSummary){
        return compact ? `${pct}% · ${years} שנים` : `${pct}% · ${scheduleSummary}`;
      }
      return pct > 0 || years ? `${pct}%${years ? ` · ${years} שנים` : ''}` : 'ללא הנחה';
    },

    getPolicyPremiumAfterDiscount(policy){
      const base = this.asMoneyNumber(policy?.premiumMonthly);
      const pct = this.getPolicyDiscountPct(policy);
      const out = base * (1 - (pct / 100));
      return Math.max(0, Math.round(out * 100) / 100);
    },

    formatMoneyValue(v){
      const n = Number(v);
      if(!Number.isFinite(n)) return "—";
      return `₪${n.toLocaleString("he-IL", { maximumFractionDigits: n % 1 ? 2 : 0 })}`;
    },

    isMedicareCompany(company){
      return safeTrim(company) === "מדיקר";
    },

    ensurePolicyDraft(){
      if(this.policyDraft) return;
      const firstIns = this.insureds[0];
      const spouse = this.insureds.find(x => x.type === "spouse");
      this.policyDraft = {
        insuredMode: "single", // single/couple
        insuredId: firstIns?.id || "",
        company: "",
        type: "",
        sumInsured: "",
        compensation: "",
        premiumMonthly: "",
        discountPct: "0",
        discountYears: "",
        discountSchedule: [],
        startDate: "",
        healthCovers: [],
        pledge: false,
        pledgeBank: { bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" }
      };
      if(!spouse){
        // if no spouse exists, couple option will be hidden anyway
      }
    },

    addDraftPolicy(){
      this.ensurePolicyDraft();
      const d = this.policyDraft;
      const createdPolicyId = this.editingPolicyId || ("npol_" + Math.random().toString(16).slice(2));

      // build normalized policy
      const p = {
        id: createdPolicyId,
        insuredMode: d.insuredMode,
        insuredId: d.insuredId || "",
        company: d.company || "",
        type: this.isMedicareCompany(d.company) ? "מדיקר" : (d.type || ""),
        sumInsured: (d.sumInsured || ""),
        compensation: (d.compensation || ""),
        premiumMonthly: (d.premiumMonthly || ""),
        discountPct: String(d.discountPct ?? "0"),
        discountYears: (d.discountYears || ""),
        discountSchedule: Array.isArray(d.discountSchedule) ? JSON.parse(JSON.stringify(d.discountSchedule)) : [],
        startDate: (d.startDate || ""),
        healthCovers: Array.isArray(d.healthCovers) ? d.healthCovers.filter(Boolean) : [],
        pledge: !!d.pledge,
        pledgeBank: Object.assign({ bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" }, d.pledgeBank || {})
      };

      this.newPolicies = (this.newPolicies || []);
      if(this.editingPolicyId){
        this.newPolicies = this.newPolicies.map(item => item.id === this.editingPolicyId ? p : item);
      }else{
        this.newPolicies.push(p);
      }

      const keepMode = d.insuredMode;
      const keepIns = d.insuredId;

      this.editingPolicyId = null;
      this.policyDraft = null;
      this.ensurePolicyDraft();
      this.policyDraft.insuredMode = keepMode;
      this.policyDraft.insuredId = keepIns;
      this.policyDraft.company = "";
      this.policyDraft.type = "";
      this.policyDraft.sumInsured = "";
      this.policyDraft.compensation = "";
      this.policyDraft.premiumMonthly = "";
      this.policyDraft.discountPct = "0";
      this.policyDraft.discountYears = "";
      this.policyDraft.discountSchedule = [];
      this.policyDraft.startDate = "";
      this.policyDraft.healthCovers = [];
      this.policyDraft.pledge = false;
      this.policyDraft.pledgeBank = { bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" };

      this.render();
      return p.id;
    },

    openPolicyAddedModal(pid){
      if(!pid || !this.els.policyAddedModal) return;
      this._lastAddedPolicyId = pid;
      this.els.policyAddedModal.classList.add("is-open");
      this.els.policyAddedModal.setAttribute("aria-hidden", "false");
      setTimeout(() => this.els.policyAddedGoDiscount?.focus?.(), 40);
    },

    closePolicyAddedModal(){
      if(this.els.policyAddedModal){
        this.els.policyAddedModal.classList.remove("is-open");
        this.els.policyAddedModal.setAttribute("aria-hidden", "true");
      }
    },

    goToLastAddedPolicyDiscount(){
      const pid = this._lastAddedPolicyId;
      this.closePolicyAddedModal();
      if(pid) this.openPolicyDiscountModal(pid);
    },

    startEditNewPolicy(pid){
      const p = (this.newPolicies || []).find(item => item.id === pid);
      if(!p) return;
      this.editingPolicyId = pid;
      this.policyDraft = {
        insuredMode: p.insuredMode || "single",
        insuredId: p.insuredId || (this.insureds[0]?.id || ""),
        company: p.company || "",
        type: this.isMedicareCompany(p.company) ? "" : (p.type || ""),
        sumInsured: p.sumInsured || "",
        compensation: p.compensation || "",
        premiumMonthly: p.premiumMonthly || "",
        discountPct: String(p.discountPct ?? "0"),
        discountYears: p.discountYears || "",
        discountSchedule: Array.isArray(p.discountSchedule) ? JSON.parse(JSON.stringify(p.discountSchedule)) : [],
        startDate: p.startDate || "",
        healthCovers: Array.isArray(p.healthCovers) ? p.healthCovers.slice() : [],
        pledge: !!p.pledge,
        pledgeBank: Object.assign({ bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" }, p.pledgeBank || {})
      };
      this.setHint("מצב עריכה הופעל עבור הפוליסה שנבחרה");
      this.render();
    },

    cancelEditNewPolicy(){
      this.editingPolicyId = null;
      this.policyDraft = null;
      this.setHint("עריכת הפוליסה בוטלה");
      this.render();
    },

    delNewPolicy(pid){
      this.newPolicies = (this.newPolicies || []).filter(p => p.id !== pid);
      // clean any payer mappings that may reference this policy (stored on primary)
      const d0 = this.insureds[0]?.data;
      if(d0 && d0.policyPayers) delete d0.policyPayers[pid];
      this.render();
    },


    openPolicyDiscountModal(pid){
      const policy = (this.newPolicies || []).find(item => item.id === pid);
      if(!policy || !this.els.policyDiscountModal) return;
      this._discountPolicyId = pid;
      this._discountScheduleDraft = this.getPolicyDiscountSchedule(policy);
      if(this.els.policyDiscountName) this.els.policyDiscountName.textContent = `${policy.company || "חברה"} · ${policy.type || "פוליסה"}`;
      if(this.els.policyDiscountMeta) this.els.policyDiscountMeta.textContent = `פרמיה נוכחית: ${this.formatMoneyValue(this.asMoneyNumber(policy.premiumMonthly))}`;
      if(this.els.policyDiscountPct) this.els.policyDiscountPct.value = String(policy.discountPct ?? "0");
      if(this.els.policyDiscountError) this.els.policyDiscountError.textContent = "";
      this.renderPolicyDiscountScheduleSummary();
      this.updatePolicyDiscountPreview();
      this.els.policyDiscountModal.classList.add("is-open");
      this.els.policyDiscountModal.setAttribute("aria-hidden", "false");
      setTimeout(() => this.els.policyDiscountPct?.focus?.(), 30);
    },

    closePolicyDiscountModal(){
      this.closePolicyDiscountScheduleEditor?.();
      this._discountPolicyId = null;
      this._discountScheduleDraft = [];
      if(this.els.policyDiscountModal){
        this.els.policyDiscountModal.classList.remove("is-open");
        this.els.policyDiscountModal.setAttribute("aria-hidden", "true");
      }
      if(this.els.policyDiscountError) this.els.policyDiscountError.textContent = "";
    },

    openPolicyDiscountScheduleEditor(){
      if(!this.els.policyDiscountScheduleEditor || !this._discountPolicyId) return;
      this.renderPolicyDiscountScheduleEditor();
      this.els.policyDiscountScheduleEditor.classList.add("is-open");
      this.els.policyDiscountScheduleEditor.setAttribute("aria-hidden", "false");
    },

    closePolicyDiscountScheduleEditor(){
      if(!this.els.policyDiscountScheduleEditor) return;
      this.els.policyDiscountScheduleEditor.classList.remove("is-open");
      this.els.policyDiscountScheduleEditor.setAttribute("aria-hidden", "true");
    },

    renderPolicyDiscountScheduleEditor(){
      if(!this.els.policyDiscountScheduleGrid) return;
      const getPct = (year) => {
        const item = (this._discountScheduleDraft || []).find(entry => Number(entry?.year) === Number(year));
        return item ? String(item.pct) : "0";
      };
      const optionsHtml = [0,2,10,15,20,25,30,35,40,45,50,55,60,65].map(v => `<option value="${v}">${v}%</option>`).join('');
      this.els.policyDiscountScheduleGrid.innerHTML = Array.from({ length: 10 }, (_, idx) => {
        const year = idx + 1;
        return `<div class="lcPolicyDiscountYearCard">
          <div class="lcPolicyDiscountYearCard__top">
            <div class="lcPolicyDiscountYearCard__year">שנה ${year}</div>
            <div class="lcPolicyDiscountYearCard__chip">דירוג ${String(year).padStart(2, '0')}</div>
          </div>
          <label class="label" for="lcPolicyDiscountYear_${year}">בחר הנחה</label>
          <select class="input lcPolicyDiscountYearCard__select" id="lcPolicyDiscountYear_${year}" data-discount-year="${year}">
            ${optionsHtml}
          </select>
        </div>`;
      }).join('');
      $$('[data-discount-year]', this.els.policyDiscountScheduleGrid).forEach((el) => {
        el.value = getPct(el.getAttribute('data-discount-year'));
      });
    },

    savePolicyDiscountScheduleEditor(){
      if(!this.els.policyDiscountScheduleGrid) return;
      const rows = $$('[data-discount-year]', this.els.policyDiscountScheduleGrid).map((el) => {
        const year = Number(el.getAttribute('data-discount-year') || '0');
        const pct = Number(String(el.value || '0').replace(/[^\d.-]/g, '')) || 0;
        return { year, pct };
      }).filter(item => item.year > 0 && item.pct > 0);
      this._discountScheduleDraft = rows;
      this.renderPolicyDiscountScheduleSummary();
      this.updatePolicyDiscountPreview();
      this.closePolicyDiscountScheduleEditor();
    },

    renderPolicyDiscountScheduleSummary(){
      if(!this.els.policyDiscountScheduleSummary || !this.els.policyDiscountScheduleList) return;
      const wrap = this.els.policyDiscountScheduleSummary;
      const count = (this._discountScheduleDraft || []).length;
      const titleEl = wrap.querySelector('.lcPolicyDiscountModal__scheduleSummaryTitle');
      const subEl = wrap.querySelector('.lcPolicyDiscountModal__scheduleSummarySub');
      const badgeEl = wrap.querySelector('.lcPolicyDiscountModal__scheduleBadge');
      if(titleEl) titleEl.textContent = count ? 'דירוג הנחה שנשמר' : 'דירוג ההנחה בשנים';
      if(subEl) subEl.textContent = count ? 'הדירוג יוצג בשורת הפוליסה ובסיכומי התהליך בצורה מסודרת' : 'טרם הוגדר דירוג הנחה לפי שנים';
      if(badgeEl) badgeEl.textContent = `${count}/10`;
      if(!count){
        this.els.policyDiscountScheduleList.innerHTML = `<div class="lcPolicyDiscountModal__scheduleEmpty">לא הוזנו עדיין שנים לדירוג הנחה.</div>`;
        wrap.classList.remove('has-values');
        return;
      }
      wrap.classList.add('has-values');
      this.els.policyDiscountScheduleList.innerHTML = (this._discountScheduleDraft || []).map((item) => `
        <div class="lcPolicyDiscountSchedulePill">
          <span class="lcPolicyDiscountSchedulePill__year">שנה ${item.year}</span>
          <span class="lcPolicyDiscountSchedulePill__pct">${item.pct}%</span>
        </div>
      `).join('');
    },

    updatePolicyDiscountPreview(){
      const pid = this._discountPolicyId;
      const policy = (this.newPolicies || []).find(item => item.id === pid);
      if(!policy || !this.els.policyDiscountPreview) return;
      const pct = Number(String(this.els.policyDiscountPct?.value || "0").replace(/[^\d.-]/g, "")) || 0;
      const base = this.asMoneyNumber(policy.premiumMonthly);
      const after = Math.max(0, Math.round((base * (1 - pct / 100)) * 100) / 100);
      const scheduleSummary = (this._discountScheduleDraft || []).length ? this.getPolicyDiscountScheduleSummary({ discountSchedule: this._discountScheduleDraft }) : '';
      const scheduleText = scheduleSummary ? `<div class="lcPolicyDiscountModal__previewSub">דירוג בשנים: ${escapeHtml(scheduleSummary)}</div>` : `<div class="lcPolicyDiscountModal__previewSub">טרם נשמר דירוג הנחה בשנים</div>`;
      this.els.policyDiscountPreview.innerHTML = `פרמיה אחרי הנחה: <b>${escapeHtml(this.formatMoneyValue(after))}</b>${scheduleText}`;
    },

    savePolicyDiscountModal(){
      const pid = this._discountPolicyId;
      const policy = (this.newPolicies || []).find(item => item.id === pid);
      if(!policy) return this.closePolicyDiscountModal();
      const pctRaw = String(this.els.policyDiscountPct?.value || "0");
      const pct = Number(pctRaw.replace(/[^\d.-]/g, ""));
      if(!Number.isFinite(pct)){
        if(this.els.policyDiscountError) this.els.policyDiscountError.textContent = "בחר אחוז הנחה תקין.";
        return;
      }
      policy.discountPct = String(pct);
      policy.discountSchedule = Array.isArray(this._discountScheduleDraft) ? JSON.parse(JSON.stringify(this._discountScheduleDraft)) : [];
      policy.discountYears = policy.discountSchedule.length ? String(policy.discountSchedule.length) : "";
      this.closePolicyDiscountModal();
      this.render();
      this.setHint("ההנחה ודירוג השנים נשמרו בהצלחה בפוליסה.");
    },

    validateStep5(){
      const list = (this.newPolicies || []);
      if(list.length < 1) return { ok:false, msg:"חובה להוסיף לפחות פוליסה אחת" };

      // validate each policy
      const bad = list.filter(p => {
        const isMedicare = this.isMedicareCompany(p.company);
        if(!safeTrim(p.company)) return true;
        if(!isMedicare && !safeTrim(p.type)) return true;

        if(!safeTrim(p.premiumMonthly)) return true;
        if(!safeTrim(p.startDate)) return true;
        if(!isMedicare && p.type === "בריאות"){
          const covers = Array.isArray(p.healthCovers) ? p.healthCovers.filter(Boolean) : [];
          if(!covers.length) return true;
        }

        if(!isMedicare && (p.type === "סרטן" || p.type === "מחלות קשות")){
          if(!safeTrim(p.compensation)) return true;
        }
        if(!isMedicare && (p.type === "ריסק" || p.type === "ריסק משכנתא")){
          if(!safeTrim(p.sumInsured)) return true;
        }
        if(!isMedicare && (p.type === "ריסק" || p.type === "ריסק משכנתא") && p.pledge){
          const b = p.pledgeBank || {};
          const req = ["bankName","bankNo","branch","amount","years","address"];
          if(!req.every(k => safeTrim(b[k]))) return true;
        }

        // insured linkage
        if(p.insuredMode === "single"){
          if(!safeTrim(p.insuredId)) return true;
        }else{
          // couple requires spouse to exist
          const spouse = this.insureds.find(x => x.type === "spouse");
          if(!spouse) return true;
        }
        return false;
      });

      if(bad.length) return { ok:false, msg:"יש פוליסות חסרות / לא תקינות — נא להשלים חובה" };
      return { ok:true };
    },

    renderStep5(){
      this.ensurePolicyDraft();
      const d = this.policyDraft;
      const spouse = this.insureds.find(x => x.type === "spouse");
      const insuredOpts = this.insureds.map(ins => `<option value="${ins.id}"${d.insuredId===ins.id?" selected":""}>${escapeHtml(ins.label)}</option>`).join("");

      const companyCards = this.companies.map(c => {
        const src = this.getCompanyLogoSrc(c);
        const selected = (d.company === c);
        const cls = "lcCoCard" + (selected ? " is-selected" : "");
        const logo = src ? `<img class="lcCoLogo" src="${escapeHtml(src)}" alt="${escapeHtml(c)}" />` : `<div class="lcCoLogo lcCoLogo--text">${escapeHtml(c)}</div>`;
        return `<button type="button" class="${cls}" data-co="${escapeHtml(c)}">${logo}<div class="lcCoName">${escapeHtml(c)}</div></button>`;
      }).join("");

      const productOpts = this.insTypes.map(t => `<option value="${escapeHtml(t)}"${d.type===t?" selected":""}>${escapeHtml(t)}</option>`).join("");

      const isMedicare = this.isMedicareCompany(d.company);
      const needComp = !isMedicare && (d.type === "סרטן" || d.type === "מחלות קשות");
      const needSum = !isMedicare && (d.type === "ריסק" || d.type === "ריסק משכנתא");
      const isMortgage = !isMedicare && (d.type === "ריסק משכנתא");
      const isRisk = !isMedicare && (d.type === "ריסק" || d.type === "ריסק משכנתא");
      const canPledge = isRisk;

      const list = (this.newPolicies || []);

      // group rendering
      const byIns = {};
      this.insureds.forEach(ins => byIns[ins.id] = []);
      byIns["__couple_primary__"] = [];
      byIns["__couple_spouse__"] = [];

      list.forEach(p => {
        if(p.insuredMode === "couple"){
          const primary = this.insureds[0];
          const sp = spouse;
          if(primary) byIns[primary.id].push(p);
          if(sp) byIns[sp.id].push(p);
        }else{
          if(byIns[p.insuredId]) byIns[p.insuredId].push(p);
        }
      });

      const renderPolicyCard = (p, showCoupleBadge=false) => {
        const src = this.getCompanyLogoSrc(p.company);
        const logo = src
          ? `<div class="lcPolLogoWrap"><img class="lcPolLogo" src="${escapeHtml(src)}" alt="${escapeHtml(p.company)}" /></div>`
          : `<div class="lcPolLogoWrap"><div class="lcPolLogo lcPolLogo--text">${escapeHtml((p.company || "").slice(0,2) || "•")}</div></div>`;
        const badge = showCoupleBadge ? `<span class="lcChip">זוגי</span>` : "";
        const isMedicare = this.isMedicareCompany(p.company);
        const sumLabel = (p.type === "מחלות קשות" || p.type === "סרטן") ? "סכום פיצוי" : "סכום ביטוח";
        const sumValue = (p.type === "מחלות קשות" || p.type === "סרטן") ? (p.compensation || "") : (p.sumInsured || "");
        const policyTitle = `${escapeHtml(p.company)}${isMedicare ? "" : ` · ${escapeHtml(p.type)}`}`;
        const pledgeText = (!isMedicare && (p.type === "ריסק" || p.type === "ריסק משכנתא") && p.pledge) ? "שיעבוד פעיל" : "ללא שיעבוד";
        const coverItems = this.getHealthCoverList(p);
        const coverSummary = this.summarizeHealthCovers(coverItems, { max: 2, emptyLabel: "טרם נבחרו כיסויים" });
        const fmtDate = (v) => {
          const s = safeTrim(v);
          if(!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || "—";
          const [y,m,d] = s.split('-');
          return `${d}.${m}.${y}`;
        };
        const fmtMoney = (v) => {
          const raw = String(v || '').replace(/[₪,\s]/g,'');
          if(!raw) return '—';
          const n = Number(raw);
          if(Number.isFinite(n)) return `₪${n.toLocaleString('he-IL')}`;
          return `₪${escapeHtml(String(v))}`;
        };
        const discountPct = this.getPolicyDiscountPct(p);
        const discountYears = this.getPolicyDiscountYearsLabel(p);
        const premiumAfterDiscount = this.getPolicyPremiumAfterDiscount(p);
        const chips = [
          `<span class="lcPolInfoChip"><span class="lcPolInfoChip__icon">💰</span><span class="lcPolInfoChip__text"><b>${fmtMoney(p.premiumMonthly)}</b><small>פרמיה חודשית</small></span></span>`,
          (() => { const scheduleSummary = this.getPolicyDiscountScheduleSummary(p); return (discountPct > 0 || discountYears) ? `<span class="lcPolInfoChip lcPolInfoChip--discount lcPolInfoChip--discountWide"><span class="lcPolInfoChip__icon">🏷️</span><span class="lcPolInfoChip__text"><b>${escapeHtml(String(discountPct))}%</b><small>${scheduleSummary ? escapeHtml(scheduleSummary) : (discountYears ? `מדורג ל־${escapeHtml(discountYears)} שנים` : 'הנחה שנשמרה')}</small></span></span>` : ''; })(),
          `<span class="lcPolInfoChip lcPolInfoChip--success"><span class="lcPolInfoChip__icon">✨</span><span class="lcPolInfoChip__text"><b>${escapeHtml(this.formatMoneyValue(premiumAfterDiscount))}</b><small>פרמיה אחרי הנחה</small></span></span>`,
          `<span class="lcPolInfoChip"><span class="lcPolInfoChip__icon">📅</span><span class="lcPolInfoChip__text"><b>${escapeHtml(fmtDate(p.startDate))}</b><small>תחילת ביטוח</small></span></span>`,
          sumValue ? `<span class="lcPolInfoChip"><span class="lcPolInfoChip__icon">🛡️</span><span class="lcPolInfoChip__text"><b>${fmtMoney(sumValue)}</b><small>${sumLabel}</small></span></span>` : '',
          (!isMedicare && (p.type === "ריסק" || p.type === "ריסק משכנתא")) ? `<span class="lcPolInfoChip"><span class="lcPolInfoChip__icon">🏦</span><span class="lcPolInfoChip__text"><b>${escapeHtml(pledgeText)}</b><small>סטטוס שיעבוד</small></span></span>` : ''
        ].filter(Boolean).join('');
        return `<div class="lcPolCard lcPolCard--premium" data-pol="${p.id}">
          <div class="lcPolCard__top">
            <div class="lcPolCard__brand">
              ${logo}
              <div class="lcPolCard__brandText">
                <div class="lcPolTitle">${policyTitle} ${badge}</div>
                <div class="lcPolSub">פוליסה חדשה${showCoupleBadge ? " · משויכת לשני מבוטחים" : ""}</div>
              </div>
            </div>
            <div class="lcPolSummaryTag">חדש</div>
          </div>
          <div class="lcPolInfoStrip">${chips}</div>
          ${p.type === "בריאות" ? `<div class="lcPolCoverCompact">
            <div class="lcPolCoverCompact__text"><span class="lcPolCoverCompact__count">${coverItems.length || 0}</span><span>${escapeHtml(coverSummary)}</span></div>
            <button type="button" class="lcPolCoverCompact__btn" data-editpol="${p.id}">ערוך כיסויים</button>
          </div>` : ``}
          <div class="lcPolCard__actions">
            <button type="button" class="lcIconActionBtn lcIconActionBtn--discount" data-discountpol="${p.id}" aria-label="הנחה"><span class="lcIconActionBtn__icon">🏷️</span><span>הנחה</span></button>
            <button type="button" class="lcIconActionBtn" data-editpol="${p.id}" aria-label="עריכה"><span class="lcIconActionBtn__icon">✏️</span><span>עריכה</span></button>
            <button type="button" class="lcIconActionBtn lcIconActionBtn--danger" data-delpol="${p.id}" aria-label="הסר"><span class="lcIconActionBtn__icon">🗑️</span><span>הסר</span></button>
          </div>
        </div>`;
      };

      const groupsHtml = this.insureds.map(ins => {
        const items = (byIns[ins.id] || []);
        if(!items.length) return "";
        // show "couple" badge for policies that are couple
        const cards = items.map(p => renderPolicyCard(p, p.insuredMode === "couple")).join("");
        return `<div class="lcWSection">
          <div class="lcWTitle">${escapeHtml(ins.label)}</div>
          <div class="lcPolList">${cards}</div>
        </div>`;
      }).join("");

      const emptyNote = (!groupsHtml.trim()) ? `<div class="muted small">עדיין לא נוספו פוליסות חדשות.</div>` : "";

      const form = `<div class="lcWSection lcPolBuilderSection">
        <div class="lcWTitle">${this.editingPolicyId ? "עריכת פוליסה" : "הוספת פוליסה חדשה"}</div>
        <div class="lcPolForm lcPolForm--premium">
          <div class="lcPolBuilderCard">
            <div class="lcPolBuilderCard__head">
              <div class="lcPolBuilderCard__title">${this.editingPolicyId ? "עריכת פרטי הפוליסה" : "פרטי הפוליסה החדשה"}</div>
            </div>

            <div class="lcField lcInsuredGlass lcPolBuilderAssign">
              <div class="lcInsuredGlassCard">
                <div class="lcInsuredGlassHead">
                  <label class="lcLabel">שיוך למבוטח</label>
                  <div class="small muted">קובע למי הפוליסה תשויך בסיכום</div>
                </div>
                <div class="lcInsuredGlassRow">
                  <select class="lcSelect" data-pdraft="insuredId"${(d.insuredMode==="couple")?" disabled":""}>
                    ${insuredOpts}
                  </select>
                  ${spouse ? `<button type="button" class="lcBtn lcBtn--ghost ${d.insuredMode==="couple"?"is-active":""}" data-pdraftmode="couple">פוליסה זוגית (ראשי + בן/בת זוג)</button>` : ``}
                  <button type="button" class="lcBtn lcBtn--ghost ${d.insuredMode==="single"?"is-active":""}" data-pdraftmode="single">פוליסה למבוטח אחד</button>
                </div>
              </div>
            </div>

            <div class="lcField lcPolBuilderCompanies">
              <label class="lcLabel">בחירת חברה</label>
              <div class="lcCoGrid">${companyCards}</div>
            </div>

            <div class="lcPolGrid lcPolGrid--top lcPolGrid--mainRow">
              <div class="lcField lcPolField lcPolField--company">
                <label class="lcLabel">חברה</label>
                <div class="lcPolStaticValue lcPolControlShell">${escapeHtml(d.company || "בחר חברה")}</div>
              </div>

              ${isMedicare ? `<div class="lcField lcPolField lcPolField--product">
                <label class="lcLabel">מוצר</label>
                <div class="lcPolStaticValue lcPolControlShell">מדיקר</div>
              </div>` : `<div class="lcField lcPolField lcPolField--product">
                <label class="lcLabel">מוצר ביטוח</label>
                <div class="lcPolSelectWrap lcPolControlShell">
                  <select class="lcSelect lcPolSelect" data-pdraft="type" ${!d.company?"disabled":""}>
                    <option value="">בחר מוצר…</option>
                    ${productOpts}
                  </select>
                </div>
              </div>`}

              <div class="lcField lcPolField lcPolField--date">
                <label class="lcLabel">תאריך תחילת ביטוח (חובה)</label>
                <div class="lcPolDateWrap lcPolControlShell">
                  <input class="lcInput lcPolDateInput" type="date" data-pdraft="startDate" value="${escapeHtml(d.startDate || "")}" />
                </div>
              </div>

              <div class="lcField lcPolField lcPolField--premiumMain">
                <label class="lcLabel">פרמיה חודשית (חובה)</label>
                <div class="lcPolMoneyWrap lcPolControlShell">
                  <span class="lcPolMoneyWrap__sym">₪</span>
                  <input class="lcInput lcPolMoneyWrap__input" type="text" inputmode="numeric" data-pdraft="premiumMonthly" value="${escapeHtml(d.premiumMonthly || "")}" placeholder="לדוגמה: 250" />
                </div>
              </div>
            </div>

            <div class="lcPolGrid lcPolGrid--money">

              ${needSum ? `<div class="lcField lcPolField lcPolField--sum">
                <label class="lcLabel">סכום ביטוח (חובה)</label>
                <input class="lcInput" type="text" inputmode="numeric" data-pdraft="sumInsured" value="${escapeHtml(d.sumInsured || "")}" placeholder="לדוגמה: 1,000,000" />
              </div>` : ``}

              ${needComp ? `<div class="lcField lcPolField lcPolField--sum">
                <label class="lcLabel">סכום פיצוי (חובה)</label>
                <input class="lcInput" type="text" inputmode="numeric" data-pdraft="compensation" value="${escapeHtml(d.compensation || "")}" placeholder="לדוגמה: 500,000" />
              </div>` : ``}

              ${canPledge ? `<div class="lcField lcPolField lcPolField--pledgeSwitch">
                <label class="lcLabel">שיעבוד</label>
                <label class="lcPolToggle">
                  <input type="checkbox" data-pdraft="pledge" ${d.pledge ? "checked":""} />
                  <span>שיעבוד (מוטב בלתי חוזר)</span>
                </label>
                <div class="help small muted">אופציונלי בריסק. בריסק משכנתא לרוב נדרש.</div>
              </div>` : ``}
            </div>

            ${(!isMedicare && d.type === "בריאות") ? `<div class="lcPolCoverCompact lcPolCoverCompact--editor">
              <div class="lcPolCoverCompact__text"><span class="lcPolCoverCompact__count">${this.getHealthCoverList(d).length || 0}</span><span>${escapeHtml(this.summarizeHealthCovers(this.getHealthCoverList(d), { max: 2, emptyLabel: "טרם נבחרו כיסויים" }))}</span></div>
              <button type="button" class="lcPolCoverCompact__btn" data-open-new-health-covers="1">${this.getHealthCoverList(d).length ? "ערוך כיסויים" : "אישור כיסויים"}</button>
            </div>` : ``}

            ${(canPledge && d.pledge) ? `<div class="lcWSection lcPledgeBox">
              <div class="lcWTitle">פרטי המוטב הבלתי חוזר</div>
              <div class="lcGrid2">
                <div class="lcField"><label class="lcLabel">שם בנק</label><input class="lcInput" data-pdraft-bank="bankName" value="${escapeHtml(d.pledgeBank.bankName||"")}" /></div>
                <div class="lcField"><label class="lcLabel">מספר בנק</label><input class="lcInput" data-pdraft-bank="bankNo" value="${escapeHtml(d.pledgeBank.bankNo||"")}" inputmode="numeric" /></div>
                <div class="lcField"><label class="lcLabel">מספר סניף</label><input class="lcInput" data-pdraft-bank="branch" value="${escapeHtml(d.pledgeBank.branch||"")}" inputmode="numeric" /></div>
                <div class="lcField"><label class="lcLabel">סכום לשיעבוד</label><input class="lcInput" data-pdraft-bank="amount" value="${escapeHtml(d.pledgeBank.amount||"")}" inputmode="numeric" /></div>
                <div class="lcField"><label class="lcLabel">לכמה שנים</label><input class="lcInput" data-pdraft-bank="years" value="${escapeHtml(d.pledgeBank.years||"")}" inputmode="numeric" /></div>
                <div class="lcField"><label class="lcLabel">כתובת הבנק</label><input class="lcInput" data-pdraft-bank="address" value="${escapeHtml(d.pledgeBank.address||"")}" /></div>
              </div>
            </div>` : ``}

            <div class="lcPolBuilderActions">
              ${this.editingPolicyId ? `<button type="button" class="lcBtn" data-cancel-editpol="1">ביטול עריכה</button>` : ``}<button type="button" class="lcBtn lcBtn--primary" data-addpol="1">${this.editingPolicyId ? "שמור שינויים" : "הוסף פוליסה"}</button>
            </div>
          </div>
        </div>
      </div>`;

      const res = form + `<div class="lcWSection">
        <div class="lcWTitle">פוליסות שנוספו</div>
        ${emptyNote}
      </div>` + groupsHtml;

      // bind handlers after render
      setTimeout(() => {
        // company card click
        $$(".lcCoCard", this.els.body).forEach(btn => {
          on(btn, "click", () => {
            this.ensurePolicyDraft();
            const co = btn.getAttribute("data-co");
            this.policyDraft.company = co || "";
            // reset product & dependent fields when changing company
            this.policyDraft.type = "";
            this.policyDraft.sumInsured = "";
            this.policyDraft.compensation = "";
            this.policyDraft.pledge = false;
            this.policyDraft.pledgeBank = { bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" };
            this.render();
          });
        });

        // insured mode toggle
        $$("[data-pdraftmode]", this.els.body).forEach(b => {
          on(b, "click", () => {
            this.ensurePolicyDraft();
            const mode = b.getAttribute("data-pdraftmode");
            if(mode === "couple" && !spouse) return;
            this.policyDraft.insuredMode = (mode === "couple") ? "couple" : "single";
            this.render();
          });
        });

        // draft field inputs
        $$("[data-pdraft]", this.els.body).forEach(el => {
          on(el, "input", () => {
            this.ensurePolicyDraft();
            const k = el.getAttribute("data-pdraft");
            if(!k) return;
            if(el.type === "checkbox") this.policyDraft[k] = !!el.checked;
            else this.policyDraft[k] = el.value;
            if(k === "type" && this.policyDraft[k] !== "בריאות") this.policyDraft.healthCovers = [];
            // Re-render only when the change affects visible structure
            if(k === "type" || k === "pledge" || k === "insuredId" || k === "company") this.render();
          });
          on(el, "change", () => {
            this.ensurePolicyDraft();
            const k = el.getAttribute("data-pdraft");
            if(!k) return;
            if(el.type === "checkbox") this.policyDraft[k] = !!el.checked;
            else this.policyDraft[k] = el.value;
            if(k === "type" && this.policyDraft[k] !== "בריאות") this.policyDraft.healthCovers = [];
            // Re-render only when the change affects visible structure
            if(k === "type" || k === "pledge" || k === "insuredId" || k === "company") this.render();
          });
        });

        $$("[data-open-new-health-covers]", this.els.body).forEach(btn => {
          on(btn, "click", () => this.openNewPolicyCoversDrawer());
        });

        $$("[data-pdraft-bank]", this.els.body).forEach(el => {
          on(el, "input", () => {
            this.ensurePolicyDraft();
            const k = el.getAttribute("data-pdraft-bank");
            if(!k) return;
            this.policyDraft.pledgeBank[k] = el.value;
          });
          on(el, "change", () => {
            this.ensurePolicyDraft();
            const k = el.getAttribute("data-pdraft-bank");
            if(!k) return;
            this.policyDraft.pledgeBank[k] = el.value;
          });
        });

        // add policy
        const addBtn = this.els.body.querySelector('[data-addpol="1"]');
        if(addBtn){
          on(addBtn, "click", () => {
            const chk = this.validateDraftPolicy();
            if(!chk.ok){
              this.setHint(chk.msg);
              return;
            }
            this.setHint("");
            const createdPolicyId = this.addDraftPolicy();
            if(createdPolicyId) this.openPolicyAddedModal(createdPolicyId);
          });
        }

        $$('[data-discountpol]', this.els.body).forEach(btn => {
          on(btn, 'click', () => {
            const pid = btn.getAttribute('data-discountpol');
            if(pid) this.openPolicyDiscountModal(pid);
          });
        });

        // edit policy buttons
        $$('[data-editpol]', this.els.body).forEach(btn => {
          on(btn, 'click', () => {
            const pid = btn.getAttribute('data-editpol');
            if(pid) this.startEditNewPolicy(pid);
          });
        });

        // delete policy buttons
        $$("[data-delpol]", this.els.body).forEach(btn => {
          on(btn, "click", () => {
            const pid = btn.getAttribute("data-delpol");
            if(pid) this.delNewPolicy(pid);
          });
        });

        const cancelEditBtn = this.els.body.querySelector('[data-cancel-editpol="1"]');
        if(cancelEditBtn){
          on(cancelEditBtn, 'click', () => this.cancelEditNewPolicy());
        }

      }, 0);

      return res;
    },

    validateDraftPolicy(){
      this.ensurePolicyDraft();
      const d = this.policyDraft;

      if(d.insuredMode === "couple"){
        const spouse = this.insureds.find(x => x.type === "spouse");
        if(!spouse) return { ok:false, msg:"כדי להוסיף פוליסה זוגית יש להוסיף בן/בת זוג בשלב 1" };
      }else{
        if(!safeTrim(d.insuredId)) return { ok:false, msg:"בחר למי שייכת הפוליסה" };
      }

      const isMedicare = this.isMedicareCompany(d.company);

      if(!safeTrim(d.company)) return { ok:false, msg:"בחר חברה" };
      if(!isMedicare && !safeTrim(d.type)) return { ok:false, msg:"בחר מוצר ביטוח" };

      if(!safeTrim(d.premiumMonthly)) return { ok:false, msg:"חובה למלא פרמיה חודשית" };
      if(!safeTrim(d.startDate)) return { ok:false, msg:"חובה למלא תאריך תחילת ביטוח" };
      if(!isMedicare && d.type === "בריאות"){
        const covers = Array.isArray(d.healthCovers) ? d.healthCovers.filter(Boolean) : [];
        if(!covers.length) return { ok:false, msg:"במוצר בריאות חובה לאשר לפחות כיסוי אחד" };
      }

      if(!isMedicare && (d.type === "סרטן" || d.type === "מחלות קשות")){
        if(!safeTrim(d.compensation)) return { ok:false, msg:"במוצר זה חובה למלא סכום פיצוי" };
      }
      if(!isMedicare && (d.type === "ריסק" || d.type === "ריסק משכנתא")){
        if(!safeTrim(d.sumInsured)) return { ok:false, msg:"בריסק/ריסק משכנתא חובה למלא סכום ביטוח" };
      }
      if(!isMedicare && (d.type === "ריסק" || d.type === "ריסק משכנתא") && d.pledge){
        const b = d.pledgeBank || {};
        const req = ["bankName","bankNo","branch","amount","years","address"];
        const ok = req.every(k => safeTrim(b[k]));
        if(!ok) return { ok:false, msg:"בשיעבוד חובה למלא את כל פרטי המוטב הבלתי חוזר" };
      }
      return { ok:true };
    },
// ---------- Step 6 ----------
    getSelectedInsuredPayerSnapshot(ins){
      const d = ins?.data;
      if(!d) return { name:"", idNumber:"" };
      const payerId = safeTrim(d.selectedPayerId);
      if(!payerId) return { name:"", idNumber:"" };
      const payerIns = (this.insureds || []).find(x => String(x?.id) === String(payerId));
      if(!payerIns?.data) return { name:"", idNumber:"" };
      return {
        name: `${safeTrim(payerIns.data.firstName)} ${safeTrim(payerIns.data.lastName)}`.trim(),
        idNumber: safeTrim(payerIns.data.idNumber)
      };
    },

    syncSelectedInsuredPayerToHolderFields(ins, opts = {}){
      const d = ins?.data;
      if(!d || safeTrim(d.payerChoice) !== "insured") return;
      const payer = this.getSelectedInsuredPayerSnapshot(ins);
      if(!payer.name && !payer.idNumber) return;
      if(!d.cc || typeof d.cc !== "object") d.cc = {};
      const preserveFilled = opts?.preserveFilled === true;
      if(payer.name && (!preserveFilled || !safeTrim(d.cc.holderName))) d.cc.holderName = payer.name;
      if(payer.idNumber && (!preserveFilled || !safeTrim(d.cc.holderId))) d.cc.holderId = payer.idNumber;
    },

    clearAutoInheritedHolderFieldsForExternalPayer(ins){
      const d = ins?.data;
      if(!d || safeTrim(d.payerChoice) !== "external") return;
      if(!d.cc || typeof d.cc !== "object") d.cc = {};
      const payer = this.getSelectedInsuredPayerSnapshot(ins);
      const holderName = safeTrim(d.cc.holderName);
      const holderId = safeTrim(d.cc.holderId);
      if(payer.name && holderName && holderName === payer.name) d.cc.holderName = "";
      if(payer.idNumber && holderId && holderId === payer.idNumber) d.cc.holderId = "";
    },

    renderStep6(ins){
      const d = ins.data;
      this.syncSelectedInsuredPayerToHolderFields(ins);
      const insuredPayers = this.insureds
        .filter(x => x.type !== "child")
        .map(x => ({ id:x.id, label:x.label, name: (safeTrim(x.data.firstName)+" "+safeTrim(x.data.lastName)).trim() || x.label }));
      const payerOpts = insuredPayers.map(x => `<option value="${x.id}"${safeTrim(d.selectedPayerId)===x.id?" selected":""}>${escapeHtml(x.name)} (${escapeHtml(x.label)})</option>`).join("");

      const method = safeTrim(d.paymentMethod || "cc");
      return `
        <div class="lcWSection">
          <div class="lcWTitle">פרטי משלם</div>
          <div class="muted small">בחירת משלם, אמצעי תשלום ופרטי חיוב לפי שיטת התשלום.</div>

          <div class="lcWGrid">
            <div class="field">
              <label class="label">בחירת משלם</label>
              <select class="input" data-payer="payerChoice">
                <option value="insured" ${d.payerChoice==="insured"?"selected":""}>מבוטח קיים</option>
                <option value="external" ${d.payerChoice==="external"?"selected":""}>משלם חריג</option>
              </select>
            </div>

            <div class="field">
              <label class="label">אמצעי תשלום</label>
              <select class="input" data-payer="paymentMethod">
                <option value="cc" ${method==="cc"?"selected":""}>כרטיס אשראי</option>
                <option value="ho" ${method==="ho"?"selected":""}>הוראת קבע</option>
              </select>
            </div>
          </div>

          <div class="divider"></div>

          ${d.payerChoice === "insured" ? `
            <div class="field">
              <label class="label">מי המשלם?</label>
              <select class="input" data-payer="selectedPayerId">
                <option value="">בחר…</option>
                ${payerOpts}
              </select>
              <div class="help">קטין לא יכול להיות משלם.</div>
            </div>
          ` : `
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

          ${method==="cc" ? `
            <div class="lcWGrid">
              ${this.fieldText("שם מחזיק/ה","cc.holderName", d.cc?.holderName || "")}
              ${this.fieldText("ת״ז מחזיק/ה","cc.holderId", d.cc?.holderId || "", "numeric")}
              ${this.fieldText("מספר כרטיס","cc.cardNumber", d.cc?.cardNumber || "", "numeric")}
              ${this.fieldText("תוקף (MM/YY)","cc.exp", d.cc?.exp || "", "text")}
            </div>
          ` : `
            <div class="lcWGrid">
              <div class="field">
                <label class="label">שם הבנק</label>
                <select class="input" data-payer="ho.bankName">
                  <option value="">בחר…</option>
                  ${this.bankNames.map(b => `<option value="${escapeHtml(b)}"${d.ho?.bankName===b?" selected":""}>${escapeHtml(b)}</option>`).join("")}
                </select>
              </div>
              ${this.fieldText("מספר בנק","ho.bankNo", d.ho?.bankNo || "", "numeric")}
              ${this.fieldText("מספר סניף","ho.branch", d.ho?.branch || "", "numeric")}
              ${this.fieldText("מספר חשבון","ho.account", d.ho?.account || "", "numeric")}
            </div>
          `}
        </div>
      `;
    },

    // ---------- Step 7 ----------
    renderStep7(){
      const formatPolicyInsured = (p={}) => {
        if(p.insuredMode === "couple"){
          const primaryLabel = safeTrim(this.insureds?.[0]?.label) || "מבוטח ראשי";
          const spouseLabel = safeTrim(this.insureds.find(x => x.type === "spouse")?.label);
          return spouseLabel ? `${primaryLabel} + ${spouseLabel}` : `${primaryLabel} (זוגי)`;
        }
        const ins = this.insureds.find(x => x.id === p.insuredId);
        return safeTrim(ins?.label) || "מבוטח";
      };

      const renderExistingSummaryTable = (list=[]) => {
        if(!list.length) return `<div class="muted small">אין פוליסות קיימות.</div>`;
        const rows = list.map(p => {
          const logoSrc = this.getCompanyLogoSrc(p.company);
          const logo = logoSrc
            ? `<img class="lcPolLogoMini" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(p.company||"")}" />`
            : `<div class="lcPolLogoMini lcPolLogoMini--empty" aria-hidden="true"></div>`;
          const isRisk = (p.type === "ריסק" || p.type === "ריסק משכנתא");
          const isCI = (p.type === "מחלות קשות" || p.type === "סרטן");
          const sumOrComp = isRisk ? (p.sumInsured||"") : (isCI ? (p.compensation||"") : "");
          const pledgeTxt = isRisk ? (p.hasPledge ? `כן (${escapeHtml(p.pledgeBankName||"")})` : "לא") : "—";
          return `<tr>
            <td><div class="lcPolCompanyCell">${logo}<div class="small"><b>${escapeHtml(p.company||"")}</b></div></div></td>
            <td>${escapeHtml(p.type||"")}</td>
            <td>${escapeHtml(p.policyNumber||"")}</td>
            <td>${escapeHtml(sumOrComp)}</td>
            <td>${pledgeTxt}</td>
          </tr>`;
        }).join("");
        return `<div class="lcPolTableWrap" style="margin-top:10px">
          <table class="lcPolTable">
            <thead><tr><th>חברה</th><th>סוג</th><th>מספר</th><th>סכום/פיצוי</th><th>שיעבוד</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      };

      const renderNewSummaryTable = (list=[]) => {
        if(!list.length) return `<div class="muted small">עדיין לא נוספו פוליסות חדשות.</div>`;
        const rows = list.map(p => {
          const logoSrc = this.getCompanyLogoSrc(p.company);
          const logo = logoSrc
            ? `<img class="lcPolLogoMini" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(p.company||"")}" />`
            : `<div class="lcPolLogoMini lcPolLogoMini--empty" aria-hidden="true"></div>`;
          const isMedicare = this.isMedicareCompany(p.company);
          const isRisk = !isMedicare && (p.type === "ריסק" || p.type === "ריסק משכנתא");
          const isCI = !isMedicare && (p.type === "מחלות קשות" || p.type === "סרטן");
          const insuredTxt = formatPolicyInsured(p);
          const coverageTxt = isRisk
            ? (safeTrim(p.sumInsured) ? `סכום ביטוח: ${escapeHtml(p.sumInsured)}` : "—")
            : (isCI
              ? (safeTrim(p.compensation) ? `סכום פיצוי: ${escapeHtml(p.compensation)}` : "—")
              : "—");
          let pledgeTxt = "—";
          if(isRisk){
            pledgeTxt = p.pledge ? "כן" : "לא";
            const b = p.pledgeBank || {};
            if(p.pledge && [b.bankName, b.bankNo, b.branch, b.amount, b.years, b.address].some(v => safeTrim(v))){
              const parts = [];
              if(safeTrim(b.bankName)) parts.push(`בנק: ${escapeHtml(b.bankName)}`);
              if(safeTrim(b.bankNo)) parts.push(`מס' בנק: ${escapeHtml(b.bankNo)}`);
              if(safeTrim(b.branch)) parts.push(`סניף: ${escapeHtml(b.branch)}`);
              if(safeTrim(b.amount)) parts.push(`סכום: ${escapeHtml(b.amount)}`);
              if(safeTrim(b.years)) parts.push(`שנים: ${escapeHtml(b.years)}`);
              if(safeTrim(b.address)) parts.push(`כתובת: ${escapeHtml(b.address)}`);
              pledgeTxt += `<div class="small muted">${parts.join(" · ")}</div>`;
            }
          }
          return `<tr>
            <td>${escapeHtml(insuredTxt)}</td>
            <td><div class="lcPolCompanyCell">${logo}<div class="small"><b>${escapeHtml(p.company||"")}</b></div></div></td>
            <td>${escapeHtml(isMedicare ? "מדיקר" : (p.type || ""))}</td>
            <td>${escapeHtml(p.premiumMonthly || "")}</td>
            <td>${escapeHtml(this.getPolicyDiscountDisplayText(p))}</td>
            <td>${escapeHtml(this.formatMoneyValue(this.getPolicyPremiumAfterDiscount(p)))}</td>
            <td>${escapeHtml(p.startDate || "")}</td>
            <td>${coverageTxt}</td>
            <td>${pledgeTxt}</td>
          </tr>`;
        }).join("");
        return `<div class="lcPolTableWrap" style="margin-top:10px">
          <table class="lcPolTable lcPolTable--summaryNew">
            <thead><tr><th>מבוטח</th><th>חברה</th><th>סוג</th><th>פרמיה חודשית</th><th>הנחה</th><th>פרמיה אחרי הנחה</th><th>תחילת ביטוח</th><th>סכום/פיצוי</th><th>שיעבוד</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      };

      const existingCount = this.insureds.reduce((acc, ins) => acc + ((ins.data?.existingPolicies || []).length), 0);
      const newCount = (this.newPolicies || []).length;

      const existingBlocks = this.insureds.map(ins => {
        const list = ins.data?.existingPolicies || [];
        return `<div class="lcWSection lcSummarySection">
          <div class="lcWTitle">פוליסות קיימות — ${escapeHtml(ins.label)}</div>
          ${renderExistingSummaryTable(list)}
        </div>`;
      }).join("");

      const newPoliciesBlock = `<div class="lcWSection lcSummarySection">
        <div class="lcWTitle">פוליסות חדשות</div>
        <div class="muted small">להלן כל הפוליסות החדשות שנבחרו בתהליך, כולל פרמיה, תאריך תחילה, סכום ביטוח/פיצוי ופרטי שיעבוד כאשר קיימים.</div>
        ${renderNewSummaryTable(this.newPolicies || [])}
      </div>`;

      return `
        <div class="lcWSection lcSummaryHero">
          <div class="lcWTitle">סיכום הקמה</div>
          <div class="lcSummaryMeta">
            <div class="lcSummaryMetaCard"><span class="lcSummaryMetaCard__k">מבוטחים</span><strong class="lcSummaryMetaCard__v">${this.insureds.length}</strong></div>
            <div class="lcSummaryMetaCard"><span class="lcSummaryMetaCard__k">פוליסות קיימות</span><strong class="lcSummaryMetaCard__v">${existingCount}</strong></div>
            <div class="lcSummaryMetaCard"><span class="lcSummaryMetaCard__k">פוליסות חדשות</span><strong class="lcSummaryMetaCard__v">${newCount}</strong></div>
          </div>
        </div>

        ${existingBlocks}
        ${newPoliciesBlock}
      `;
    },


    // ---------- Step 9 ----------
    getExistingPolicyStatusLabel(status){
      const map = {
        keep: "נשארת פעילה",
        cancel: "לביטול",
        full: "ביטול מלא",
        partial_health: "ביטול חלקי",
        replace: "מוחלפת"
      };
      return map[safeTrim(status)] || "טרם נבחר";
    },

    renderStep9(){
      const existingPolicies = [];
      this.insureds.forEach(ins => {
        (ins.data?.existingPolicies || []).forEach(policy => {
          const cancel = ins.data?.cancellations?.[policy.id] || {};
          existingPolicies.push({
            insuredLabel: ins.label,
            company: safeTrim(policy.company),
            type: safeTrim(policy.type),
            monthlyPremium: safeTrim(policy.monthlyPremium),
            status: this.getExistingPolicyStatusLabel(cancel.status),
            statusRaw: safeTrim(cancel.status),
            reason: safeTrim(cancel.reason)
          });
        });
      });

      const formatPolicyInsured = (p={}) => {
        if(p.insuredMode === "couple"){
          const primaryLabel = safeTrim(this.insureds?.[0]?.label) || "מבוטח ראשי";
          const spouseLabel = safeTrim(this.insureds.find(x => x.type === "spouse")?.label);
          return spouseLabel ? `${primaryLabel} + ${spouseLabel}` : `${primaryLabel} (זוגי)`;
        }
        const ins = this.insureds.find(x => x.id === p.insuredId);
        return safeTrim(ins?.label) || "מבוטח";
      };

      const renderExistingCards = () => {
        if(!existingPolicies.length){
          return `<div class="lcOpEmpty">לא הוזנו פוליסות קיימות.</div>`;
        }
        return `<div class="lcOpCards">` + existingPolicies.map((policy, idx) => {
          const logoSrc = this.getCompanyLogoSrc(policy.company);
          const logo = logoSrc ? `<img class="lcOpPolicyCard__logoImg" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(policy.company)}" />` : `<div class="lcOpPolicyCard__logoFallback">${escapeHtml((policy.company || "•").slice(0,1))}</div>`;
          const statusClass = policy.statusRaw ? ` lcOpStatus--${escapeHtml(policy.statusRaw)}` : '';
          return `<article class="lcOpPolicyCard" style="animation-delay:${idx * 70}ms">
            <div class="lcOpPolicyCard__top">
              <div class="lcOpPolicyCard__logoWrap">${logo}</div>
              <div class="lcOpPolicyCard__main">
                <div class="lcOpPolicyCard__company">${escapeHtml(policy.company || "חברה")}</div>
                <div class="lcOpPolicyCard__meta">${escapeHtml(policy.type || "פוליסה")} · ${escapeHtml(policy.insuredLabel || "מבוטח")}</div>
              </div>
              <span class="lcOpStatus${statusClass}">${escapeHtml(policy.status)}</span>
            </div>
            <div class="lcOpPolicyCard__grid">
              <div><span>פרמיה חודשית</span><strong>${escapeHtml(policy.monthlyPremium || "—")}</strong></div>
              <div><span>סטטוס טיפול</span><strong>${escapeHtml(policy.status)}</strong></div>
            </div>
            ${policy.reason ? `<div class="lcOpPolicyCard__note">סיבת טיפול: ${escapeHtml(policy.reason)}</div>` : ``}
          </article>`;
        }).join("") + `</div>`;
      };

      const renderNewCards = () => {
        if(!(this.newPolicies || []).length){
          return `<div class="lcOpEmpty">לא הוזנו פוליסות חדשות.</div>`;
        }
        return `<div class="lcOpCards">` + (this.newPolicies || []).map((policy, idx) => {
          const logoSrc = this.getCompanyLogoSrc(policy.company);
          const logo = logoSrc ? `<img class="lcOpPolicyCard__logoImg" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(policy.company)}" />` : `<div class="lcOpPolicyCard__logoFallback">${escapeHtml((policy.company || "•").slice(0,1))}</div>`;
          const insuredTxt = formatPolicyInsured(policy);
          const premiumAfter = this.formatMoneyValue(this.getPolicyPremiumAfterDiscount(policy));
          const discountTxt = escapeHtml(this.getPolicyDiscountDisplayText(policy));
          return `<article class="lcOpPolicyCard lcOpPolicyCard--new" style="animation-delay:${idx * 80}ms">
            <div class="lcOpPolicyCard__top">
              <div class="lcOpPolicyCard__logoWrap">${logo}</div>
              <div class="lcOpPolicyCard__main">
                <div class="lcOpPolicyCard__company">${escapeHtml(policy.company || "חברה")}</div>
                <div class="lcOpPolicyCard__meta">${escapeHtml(policy.type || "פוליסה")} · ${escapeHtml(insuredTxt)}</div>
              </div>
              <span class="lcOpStatus lcOpStatus--sold">נמכרה</span>
            </div>
            <div class="lcOpPolicyCard__grid">
              <div><span>פרמיה חודשית</span><strong>${escapeHtml(policy.premiumMonthly || "—")}</strong></div>
              <div><span>אחוז הנחה</span><strong>${discountTxt}</strong></div>
              <div><span>פרמיה אחרי הנחה</span><strong>${escapeHtml(premiumAfter)}</strong></div>
              <div><span>תחילת ביטוח</span><strong>${escapeHtml(policy.startDate || "—")}</strong></div>
            </div>
          </article>`;
        }).join("") + `</div>`;
      };

      const companies = this.getOperationalCompanyList();
      const agentNumbers = this.getOperationalAgentNumbers();
      const totalPremium = (this.newPolicies || []).reduce((sum, policy) => sum + this.getPolicyPremiumAfterDiscount(policy), 0);

      const agentFields = !companies.length ? `<div class="lcOpEmpty">לא נמצאו חברות בפוליסות החדשות.</div>` : `<div class="lcOpAgentGrid">` + companies.map((company, idx) => {
        const logoSrc = this.getCompanyLogoSrc(company);
        const logo = logoSrc ? `<img class="lcOpAgentRow__logoImg" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(company)}" />` : `<div class="lcOpAgentRow__logoFallback">${escapeHtml((company || "•").slice(0,1))}</div>`;
        return `<label class="lcOpAgentRow" style="animation-delay:${idx * 90}ms">
          <div class="lcOpAgentRow__brand">
            <div class="lcOpAgentRow__logo">${logo}</div>
            <div>
              <div class="lcOpAgentRow__name">${escapeHtml(company)}</div>
              <div class="lcOpAgentRow__sub">מספר סוכן עבור החברה שנמכרה</div>
            </div>
          </div>
          <input class="input lcOpAgentRow__input" data-op-agent-company="${escapeHtml(company)}" value="${escapeHtml(agentNumbers?.[company] || "")}" inputmode="numeric" placeholder="הכנס מספר סוכן" />
        </label>`;
      }).join("") + `</div>`;

      return `
        <section class="lcOpSummary">
          <div class="lcOpHero">
            <div class="lcOpHero__eyebrow">100% הושלם</div>
            <div class="lcOpHero__title">סיכום הקמה לפני שמירה</div>
            <div class="lcOpHero__sub">המערכת מרכזת את כל נתוני הלקוח, הפוליסות החדשות והקיימות, ומכינה את הדוח התפעולי לשמירה.</div>
            <div class="lcOpHero__stats">
              <div class="lcOpStat"><span>מבוטחים</span><strong>${this.insureds.length}</strong></div>
              <div class="lcOpStat"><span>פוליסות קיימות</span><strong>${existingPolicies.length}</strong></div>
              <div class="lcOpStat"><span>פוליסות חדשות</span><strong>${(this.newPolicies || []).length}</strong></div>
              <div class="lcOpStat"><span>סה"כ פרמיה אחרי הנחה</span><strong>${escapeHtml(this.formatMoneyValue(totalPremium))}</strong></div>
            </div>
          </div>

          <section class="lcOpSection">
            <div class="lcOpSection__head">
              <div>
                <div class="lcOpSection__title">פוליסות קיימות</div>
                <div class="lcOpSection__sub">כל הפוליסות הישנות של הלקוח עם סטטוס הטיפול שנבחר בשלב הביטול.</div>
              </div>
            </div>
            ${renderExistingCards()}
          </section>

          <section class="lcOpSection">
            <div class="lcOpSection__head">
              <div>
                <div class="lcOpSection__title">פוליסות חדשות</div>
                <div class="lcOpSection__sub">הפוליסות שנמכרו בתהליך ההקמה, כולל פרמיה אחרי הנחה.</div>
              </div>
            </div>
            ${renderNewCards()}
          </section>

          <section class="lcOpSection">
            <div class="lcOpSection__head">
              <div>
                <div class="lcOpSection__title">מספרי סוכן לחברות שנמכרו</div>
                <div class="lcOpSection__sub">יש למלא מספר סוכן רק עבור החברות שמופיעות בפוליסות החדשות. נתונים אלו יישמרו בדוח התפעולי.</div>
              </div>
            </div>
            ${agentFields}
          </section>
        </section>
      `;
    },

    bindOperationalSummaryInputs(){
      const store = this.getOperationalAgentNumbers();
      $$("[data-op-agent-company]", this.els.body).forEach(el => {
        on(el, "input", () => {
          const company = safeTrim(el.getAttribute("data-op-agent-company"));
          if(!company) return;
          store[company] = safeTrim(el.value);
          this.setHint("");
        });
        on(el, "change", () => {
          const company = safeTrim(el.getAttribute("data-op-agent-company"));
          if(!company) return;
          store[company] = safeTrim(el.value);
          this.setHint("");
        });
      });
    },

    // ---------- Step 8 ----------
    getHealthCompanies(){
      const supported = new Set(["כלל","הפניקס","הכשרה","הראל","מגדל","מנורה","איילון"]);
      const found = new Set();
      (this.newPolicies || []).forEach(p => {
        const c = safeTrim(p?.company);
        if(supported.has(c)) found.add(c);
      });
      return Array.from(found);
    },

    getHealthStore(){
      const primary = this.insureds[0] || { data:{} };
      primary.data = primary.data || {};
      if(!primary.data.healthDeclaration) primary.data.healthDeclaration = {};
      const out = primary.data.healthDeclaration;
      if(!out.ui) out.ui = { currentIndex: 0, summary: false };
      if(!out.responses) out.responses = {};
      return out;
    },

    parseMoneyNumber(v){
      const raw = String(v ?? '').replace(/[^0-9.]/g, '');
      if(!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    },

    getPolicyLabel(policy){
      const company = safeTrim(policy?.company);
      const type = safeTrim(policy?.type);
      return company && type ? `${company} · ${type}` : (company || type || 'פוליסה');
    },

    getHealthPoliciesForInsured(ins){
      return (this.newPolicies || []).filter(p => {
        if(safeTrim(p?.company) !== 'הפניקס') return false;
        const type = safeTrim(p?.type);
        if(!['ריסק','ריסק משכנתא','בריאות','מחלות קשות','סרטן'].includes(type)) return false;
        if(p?.insuredMode === 'couple') return ins?.type === 'primary' || ins?.type === 'spouse';
        return safeTrim(p?.insuredId) === safeTrim(ins?.id);
      });
    },

    getPhoenixFollowupSchemas(){
      const t = (key, label, type='text') => ({ key, label, type });
      const z = (key, label) => ({ key, label, type:'textarea' });
      return {
        '2': { title:'לב וכלי דם', fields:[t('diagnosis','אבחנה / סוג מחלת לב'), t('eventDate','מועד אבחון / אירוע'), t('tests','בדיקות שבוצעו (אקו / מיפוי / צנתור)'), z('status','טיפול / ניתוח / מצב כיום')] },
        '3': { title:'לחץ דם / שומנים / גורמי סיכון', fields:[t('bloodPressure','ערך לחץ דם אחרון / ממוצע'), t('lipids','ערכי שומנים / כולסטרול אם ידוע'), t('meds','תרופות קבועות'), z('riskNotes','מעקב קרדיולוגי / סיבוכים / מצב נוכחי')] },
        '4': { title:'אירועי לב / כלי דם / קרישי דם', fields:[t('vascularEvent','איזה אירוע / ממצא'), t('vascularDate','מועד האירוע'), t('hospitalization','אשפוז / צנתור / מעקף אם היה'), z('vascularStatus','סיבוכים / טיפול נוכחי / מצב כיום')] },
        '5': { title:'סוכרת', fields:[t('diabetesType','סוג סוכרת / טרום סוכרת'), t('hba1c','HbA1c אחרון'), t('diabetesTreatment','טיפול / אינסולין / כדורים'), z('diabetesComplications','סיבוכים / עיניים / כליות / נוירופתיה / מצב נוכחי')] },
        '6': { title:'בלוטת התריס / הורמונלי', fields:[t('thyroidDiagnosis','אבחנה / תת או יתר פעילות'), t('thyroidDate','מועד אבחון'), t('thyroidTreatment','טיפול / אלטרוקסין / ניתוח'), z('thyroidStatus','ערכים אחרונים / מצב כיום / מעקב')] },
        '7': { title:'שומנים / מטבולי / הורמונלי נוסף', fields:[t('metabolicDiagnosis','אבחנה מטבולית / הורמונלית'), t('metabolicValue','ערך אחרון / BMI / בדיקה רלוונטית'), t('metabolicTreatment','טיפול'), z('metabolicStatus','פירוט מצב נוכחי / סיבוכים')] },
        '8': { title:'מערכת העצבים והמוח / אפילפסיה', fields:[t('neuroDiagnosis','אבחנה / סוג הבעיה הנוירולוגית'), t('neuroType','סוג האפילפסיה / אירוע / תסמין'), t('neuroTreatment','טיפול / ניתוח / תרופות'), z('neuroStatus','תדירות התקפים / אירוע אחרון / מצב כיום')] },
        '9': { title:'מערכת העיכול', fields:[t('digestiveDiagnosis','אבחנה במערכת העיכול'), t('digestiveTreatment','טיפול / תרופות / ביולוגי / ניתוח'), t('digestiveDate','מועד אבחון'), z('digestiveStatus','סיבוכים / מעורבות מחוץ למעי / מצב כיום')] },
        '10': { title:'כבד / צהבת / הפטיטיס', fields:[t('liverDiagnosis','אבחנה בכבד / הפטיטיס'), t('liverTests','תפקודי כבד / עומס ויראלי / בדיקות'), t('liverDate','מועד אבחון'), z('liverStatus','טיפול / פיברוטסט / ביופסיה / מצב כיום')] },
        '12': { title:'עמוד שדרה', fields:[t('spineDiagnosis','אבחנה (בלט/בקע/פריצה/כאבי גב)'), t('spineArea','מיקום עמוד שדרה'), t('spineDate','מועד אבחון / אירוע'), z('spineStatus','טיפול / פיזיותרפיה / ניתוח / מגבלה נוכחית')] },
        '13': { title:'שלד / גפיים / שברים', fields:[t('orthoDiagnosis','אבחנה'), t('orthoLocation','מיקום / צד'), t('orthoDate','מועד פגיעה / אבחון'), z('orthoStatus','ניתוח / מגבלה תפקודית / כאבים / מצב כיום')] },
        '14': { title:'מפרקים ומחלות ראומטולוגיות', fields:[t('rheumDiagnosis','אבחנה ראומטולוגית'), t('rheumTreatment','טיפול / ביולוגי / עירוי / כדורים'), t('rheumComplications','פגיעה כלייתית / חלבון בשתן / סיבוכים'), z('rheumStatus','מצב כיום / התקפים / מגבלות')] },
        '15': { title:'מחלות נפש', fields:[t('mentalDiagnosis','אבחנה נפשית / הפרעת אכילה'), t('mentalTreatment','טיפול תרופתי / פסיכיאטרי / פסיכולוגי'), t('mentalDisability','נכות נפשית אם קיימת'), z('mentalStatus','אשפוז / ניסיונות אובדניים / פגישה פסיכיאטרית / מצב כיום')] },
        '16': { title:'מערכת הנשימה והריאות', fields:[t('respDiagnosis','אבחנה (אסטמה / COPD / דום נשימה וכד׳)'), t('respTreatment','טיפול / משאפים / סטרואידים'), t('respFrequency','תכיפות התקפים / חומרה'), z('respStatus','אשפוזים / תפקודי ריאה / מצב כיום')] },
        '17': { title:'גידול שפיר / ממאיר / סרטן', fields:[t('cancerDiagnosis','סוג גידול / אבחנה'), t('cancerDate','מועד אבחון'), t('cancerTreatment','טיפול / ניתוח / כימו / קרינה'), z('cancerStatus','שלב / גרורות / מעקב / מצב כיום')] },
        '18': { title:'בדיקות פולשניות / הדמיה', fields:[t('testType','איזו בדיקה'), t('testDate','מועד הבדיקה / ההמלצה'), t('testResult','תוצאה / ממצא'), z('testFollowup','מה הומלץ בהמשך / האם הושלם בירור')] },
        '19': { title:'נכות / תביעת נכות', fields:[t('disabilityPercent','דרגת נכות %'), t('disabilityReason','סיבת הנכות / התביעה'), t('disabilityDate','מתי נקבע / הוגש'), z('disabilityStatus','מצב תפקודי / סטטוס התביעה / קצבאות')] },
        '20': { title:'אשפוז / ניתוח / השתלה', fields:[t('hospitalType','סוג אשפוז / ניתוח / השתלה'), t('hospitalDate','מועד'), t('hospitalDays','משך אשפוז'), z('hospitalStatus','סיבת האשפוז / סיבוכים / מצב כיום / האם הומלץ עתידי')] },
        '22': { title:'היסטוריה משפחתית', fields:[t('familyRelative','איזה קרוב מדרגה ראשונה'), t('familyDisease','איזו מחלה'), t('familyAge','באיזה גיל אובחן'), z('familyNotes','האם יותר מקרוב אחד / פירוט נוסף')] }
      };
    },

    buildPhoenixFollowupFields(questionnaireNos=[], baseFields=[]){
      const map = this.getPhoenixFollowupSchemas();
      const out = [];
      const seen = new Set();
      (questionnaireNos || []).forEach(no => {
        const schema = map[String(no)];
        if(!schema) return;
        out.push({ type:'section', label:`שאלון ${String(no)} · ${schema.title}` });
        (schema.fields || []).forEach(f => {
          const key = `${String(no)}__${f.key}`;
          if(seen.has(key)) return;
          seen.add(key);
          out.push({ ...f, key });
        });
      });
      if(baseFields && baseFields.length){
        out.push({ type:'section', label:'פירוט משלים' });
        baseFields.forEach(f => {
          const key = `base__${f.key}`;
          if(seen.has(key)) return;
          seen.add(key);
          out.push({ ...f, key });
        });
      }
      return out.length ? out : (baseFields || []);
    },

    buildPhoenixQuestionnaireCatalog(){
      const detailFields = [
        { key:'diagnosis', label:'אבחנה / מחלה / בדיקה', type:'text' },
        { key:'dates', label:'מועד התחלה / סיום / אבחון', type:'text' },
        { key:'complications', label:'סיבוכים / אירועים חוזרים / הבראה מלאה', type:'textarea' },
        { key:'treatment', label:'סוג טיפול (תרופה / ניתוח / מעקב)', type:'textarea' }
      ];
      const familyFields = [
        { key:'relative', label:'איזה קרוב מדרגה ראשונה', type:'text' },
        { key:'disease', label:'איזו מחלה', type:'text' },
        { key:'age', label:'באיזה גיל אובחן', type:'text' }
      ];
      return {
        short_risk: {
          title: 'הפניקס · הצהרת בריאות מקוצרת',
          sourceLabel: 'עבור ריסק עד 2 מיליון ועד גיל 55',
          steps: [
            { key:'s2_treatment', text:'האם בשנה האחרונה טופלת או הומלץ על טיפול תרופתי יותר מ-3 שבועות?', fields:[{ key:'medName', label:'שם התרופה', type:'text' },{ key:'reason', label:'סיבת טיפול', type:'textarea' }]},
            { key:'s3_tests', text:'האם בשנה האחרונה הומלץ לך או שהינך מועמד לביצוע בדיקה פולשנית, בדיקת הדמיה או ניתוח?', questionnaireNos:['18','20'], fields:[{ key:'testType', label:'סוג בדיקה / ניתוח', type:'text' },{ key:'date', label:'תאריך', type:'text' },{ key:'hospitalDays', label:'משך אשפוז', type:'text' }]},
            { key:'s4_smoking', text:'האם הינך מעשן או עישנת במהלך השנתיים האחרונות?', fields:[{ key:'cigarettes', label:'כמות סיגריות', type:'text' },{ key:'quitDate', label:'תאריך הפסקת עישון', type:'text' }]},
            { key:'s5_1_heart', text:'האם אובחנה מחלת לב, כלי דם או דם?', questionnaireNos:['2','3','4'], fields: detailFields },
            { key:'s5_2_neuro', text:'האם אובחנה מחלה במערכת העצבים והמוח?', questionnaireNos:['8'], fields: detailFields },
            { key:'s5_3_cancer', text:'האם אובחן גידול ממאיר (סרטן)?', questionnaireNos:['17'], fields: detailFields },
            { key:'s5_4_kidney', text:'האם אובחנה מחלת כליות או שתן?', fields: detailFields },
            { key:'s5_5_liver', text:'האם אובחנה מחלת כבד?', questionnaireNos:['10'], fields: detailFields },
            { key:'s5_6_lungs', text:'האם אובחנה מחלת נשימה או ריאות?', questionnaireNos:['16'], fields: detailFields },
            { key:'s6_vision', text:'האם קיימת בעיית ראייה?', fields: detailFields },
            { key:'s7_ortho', text:'האם קיימת בעיית שלד, מפרקים, אורתופדיה או ראומטולוגיה?', questionnaireNos:['12','13','14'], fields: detailFields },
            { key:'s8_hearing', text:'האם קיימת בעיית שמיעה?', fields: detailFields },
            { key:'s9_digestive', text:'האם קיימת מחלת מערכת עיכול?', questionnaireNos:['9'], fields: detailFields },
            { key:'s10_endocrine', text:'האם קיימת מחלת מערכת הפרשה פנימית, לרבות סוכרת?', questionnaireNos:['5','6'], fields: detailFields },
            { key:'s11_mental', text:'האם קיימת מחלת נפש, לרבות דיכאון?', questionnaireNos:['15'], fields: detailFields },
            { key:'s12_disability', text:'האם נקבעה נכות או שהינך בהליך תביעת נכות?', questionnaireNos:['19'], fields:[{ key:'percent', label:'דרגת נכות %', type:'text' },{ key:'reason', label:'סיבת הנכות / ההליך', type:'textarea' }]}
          ]
        },
        extended_risk: {
          title: 'הפניקס · הצהרת בריאות מורחבת',
          sourceLabel: 'עבור ריסק מעל 2 מיליון ו/או מעל גיל 55',
          steps: [
            { key:'e2_weight', text:'האם היו שינויים של למעלה מ-5 ק״ג במשקל בשנה האחרונה?', fields:[{ key:'change', label:'כמה ק״ג ובאיזה כיוון', type:'text' },{ key:'reason', label:'סיבה לשינוי', type:'textarea' }]},
            { key:'e3_meds', text:'האם בשנה האחרונה נטלת תרופות שנרשמו על ידי רופא למשך יותר מ-3 שבועות או נוטל תרופות ללא מרשם באופן קבוע?', fields:[{ key:'medName', label:'שם התרופה', type:'text' },{ key:'reason', label:'סיבת טיפול', type:'textarea' }]},
            { key:'e4_hospital', text:'האם אושפזת ב-5 השנים האחרונות כולל למטרת ניתוח?', questionnaireNos:['20'], fields:[{ key:'hospitalType', label:'סוג אשפוז / ניתוח', type:'text' },{ key:'date', label:'תאריך', type:'text' },{ key:'days', label:'משך אשפוז', type:'text' }]},
            { key:'e5_disability', text:'האם נקבעה לך נכות מכל סיבה שהיא או שהינך בתהליך קביעת נכות / תביעת נכות בשנתיים האחרונות?', questionnaireNos:['19'], fields:[{ key:'percent', label:'דרגת נכות %', type:'text' },{ key:'reason', label:'פירוט סיבה / הליך', type:'textarea' }]},
            { key:'e6_tests', text:'האם עברת או הומלץ לך לעבור ב-5 השנים האחרונות בדיקות פולשניות או בדיקות הדמיה?', questionnaireNos:['18'], fields:[{ key:'testType', label:'סוג בדיקה', type:'text' },{ key:'date', label:'תאריך', type:'text' },{ key:'result', label:'תוצאה / סטטוס', type:'textarea' }]},
            { key:'e7_surgery', text:'האם עברת ניתוח או הומלץ על ניתוח בעתיד או השתלת איבר ב-10 השנים האחרונות?', questionnaireNos:['20'], fields:[{ key:'procedure', label:'איזה ניתוח / השתלה', type:'text' },{ key:'date', label:'תאריך', type:'text' },{ key:'status', label:'מצב כיום / מה הומלץ', type:'textarea' }]},
            { key:'e8_smoking', text:'האם הינך מעשן או עישנת במהלך השנתיים האחרונות?', fields:[{ key:'cigarettes', label:'כמות סיגריות', type:'text' },{ key:'quitDate', label:'תאריך הפסקת עישון', type:'text' }]},
            { key:'e9_drugs', text:'האם השתמשת אי פעם או שהינך משתמש בסמים מכל סוג שהוא?', fields:[{ key:'drugType', label:'סוג', type:'text' },{ key:'freq', label:'תדירות', type:'text' },{ key:'stopDate', label:'מועד הפסקה', type:'text' }]},
            { key:'e10_alcohol', text:'האם הינך צורך או צרכת בעבר יותר מ-14 כוסות / פחיות משקאות חריפים בשבוע?', fields:[{ key:'amount', label:'כמות שבועית', type:'text' },{ key:'details', label:'פירוט', type:'textarea' }]},
            { key:'e11_1_heart', text:'האם אובחנה מחלת לב וכלי דם?', questionnaireNos:['2','3','4'], fields: detailFields },
            { key:'e11_2_neuro', text:'האם אובחנה מחלה במערכת העצבים והמוח?', questionnaireNos:['8'], fields: detailFields },
            { key:'e11_3_digestive', text:'האם אובחנה מחלת מערכת העיכול?', questionnaireNos:['9'], fields: detailFields },
            { key:'e11_4_endocrine', text:'האם אובחנה מחלה במערכות ההפרשה הפנימית, לרבות סוכרת או שומנים בדם?', questionnaireNos:['5','6'], fields: detailFields },
            { key:'e11_5_liver', text:'האם אובחנה מחלת כבד?', questionnaireNos:['10'], fields: detailFields },
            { key:'e11_6_ortho', text:'האם אובחנה מחלת שלד / פרקים / ראומטולוגיה?', questionnaireNos:['12','13','14'], fields: detailFields },
            { key:'e11_7_lungs', text:'האם אובחנה מחלת נשימה או ריאות?', questionnaireNos:['16'], fields: detailFields },
            { key:'e11_8_kidney', text:'האם אובחנה מחלת כליות?', fields: detailFields },
            { key:'e11_9_mental', text:'האם אובחנה מחלת נפש?', questionnaireNos:['15'], fields: detailFields },
            { key:'e11_10_senses', text:'האם קיימת מחלת מערכת החושים, לרבות ראייה / שמיעה?', fields: detailFields },
            { key:'e11_11_hiv', text:'האם הינך נשא HIV או חולה איידס?', fields: detailFields },
            { key:'e11_12_cancer', text:'האם אובחן גידול שפיר או ממאיר?', questionnaireNos:['17'], fields: detailFields },
            { key:'e11_13_blood', text:'האם אובחנה מחלת דם?', fields: detailFields },
            { key:'e11_14_immune', text:'האם אובחנה מחלה במערכת החיסון / אוטואימונית?', fields: detailFields },
            { key:'e11_15_male', text:'האם קיימת מחלה או הפרעה במערכת המין הזכרית?', fields: detailFields },
            { key:'e11_16_female', text:'האם קיימת מחלה או הפרעה במערכת המין הנשית או הריון?', fields: detailFields },
            { key:'e11_17_family', text:'האם ידוע על קרוב משפחה מדרגה ראשונה שחלה לפני גיל 60?', questionnaireNos:['22'], fields: familyFields }
          ]
        },
        full_health: {
          title: 'הפניקס · הצהרת בריאות מלאה',
          sourceLabel: 'ביטוח בריאות',
          steps: [
            { key:'fh_smoking', text:'האם הנך מעשן או עישנת בשנתיים האחרונות, לרבות סיגריה אלקטרונית ו/או נרגילה?', fields:[{ key:'cigarettes', label:'כמות סיגריות ליום', type:'text' }]},
            { key:'fh_family', text:'האם בקרב קרוב משפחה מדרגה ראשונה התגלו מחלות משמעותיות לפני גיל 60?', questionnaireNos:['22'], fields: familyFields },
            { key:'fh_drugs', text:'האם הינך צורך כעת או צרכת בעבר סמים מסוג כלשהו?', fields:[{ key:'drugType', label:'סוג', type:'text' },{ key:'freq', label:'תדירות', type:'text' },{ key:'stopDate', label:'מועד הפסקה', type:'text' }]},
            { key:'fh_alcohol', text:'האם הינך צורך או צרכת בעבר באופן קבוע יותר מ-2 כוסות משקה אלכוהולי ליום?', fields:[{ key:'amount', label:'כמות יומית', type:'text' },{ key:'details', label:'פירוט', type:'textarea' }]},
            { key:'fh_heart', text:'האם אובחנה מחלת לב, כלי דם או דם?', questionnaireNos:['2','3','4'], fields: detailFields },
            { key:'fh_neuro', text:'האם אובחנה מחלה במערכת העצבים והמוח?', questionnaireNos:['8'], fields: detailFields },
            { key:'fh_digestive', text:'האם אובחנה מחלה במערכת העיכול?', questionnaireNos:['9','10'], fields: detailFields },
            { key:'fh_endocrine', text:'האם אובחנה מחלה במערכת ההפרשה הפנימית, לרבות סוכרת?', questionnaireNos:['5','6','7'], fields: detailFields },
            { key:'fh_vision', text:'האם אובחנה מחלת עיניים או הפרעת ראייה?', fields: detailFields },
            { key:'fh_ent', text:'האם אובחנה מחלה במערכת אף, אוזן, גרון?', fields: detailFields },
            { key:'fh_ortho', text:'האם אובחנה מחלה או כאב במערכת השלד / מפרקים / ראומטולוגיה?', questionnaireNos:['12','13','14'], fields: detailFields },
            { key:'fh_lungs', text:'האם אובחנה מחלה במערכת הנשימה והריאות?', questionnaireNos:['16'], fields: detailFields },
            { key:'fh_kidney', text:'האם אובחנה מחלה במערכת הכליות או בדרכי השתן?', fields: detailFields },
            { key:'fh_cancer', text:'האם אובחנה מחלה ממארת, גידול שפיר או ממאיר?', questionnaireNos:['17'], fields: detailFields },
            { key:'fh_blood', text:'האם אובחנה מחלת דם או הפרעת קרישה?', fields: detailFields },
            { key:'fh_skin', text:'האם אובחנה מחלת עור או תופעה בעור?', fields: detailFields },
            { key:'fh_immune', text:'האם אובחנה מחלה במערכת החיסון / אוטואימונית?', fields: detailFields },
            { key:'fh_hernia', text:'האם קיים בקע / הרניה?', fields: detailFields },
            { key:'fh_mental', text:'האם אובחנה מחלת נפש או הפרעת אכילה?', questionnaireNos:['15'], fields: detailFields },
            { key:'fh_premature', text:'לילדים עד גיל שנה – האם נולד פג?', fields:[{ key:'week', label:'שבוע לידה', type:'text' },{ key:'details', label:'פירוט מצב בלידה / אשפוז', type:'textarea' }]},
            { key:'fh_congenital', text:'האם קיימים מומים מולדים, עיכוב התפתחותי או אבחנה בילדות?', fields: detailFields },
            { key:'fh_additional_tests', text:'האם עברת או הומלץ לך לעבור בדיקות פולשניות / הדמיה ב-5 השנים האחרונות?', questionnaireNos:['18'], fields:[{ key:'testType', label:'סוג בדיקה', type:'text' },{ key:'date', label:'תאריך', type:'text' },{ key:'result', label:'תוצאה / סטטוס', type:'textarea' }]},
            { key:'fh_surgery', text:'האם אושפזת, עברת ניתוח או הומלץ על ניתוח עתידי?', questionnaireNos:['20'], fields:[{ key:'procedure', label:'איזה אשפוז / ניתוח', type:'text' },{ key:'date', label:'תאריך', type:'text' },{ key:'status', label:'מצב כיום', type:'textarea' }]},
            { key:'fh_meds', text:'האם הינך נוטל או הומלץ לך ליטול תרופות באופן קבוע ב-3 השנים האחרונות?', fields:[{ key:'medName', label:'שם התרופה', type:'text' },{ key:'reason', label:'סיבת טיפול', type:'textarea' }]},
            { key:'fh_disability', text:'האם נקבעה לך נכות זמנית / צמיתה או שהינך בתהליך קביעת נכות?', questionnaireNos:['19'], fields:[{ key:'percent', label:'דרגת נכות %', type:'text' },{ key:'reason', label:'פירוט סיבה / תביעה', type:'textarea' }]}
          ]
        },
        critical_illness: {
          title: 'הפניקס · הצהרת בריאות מחלות קשות',
          sourceLabel: 'מחלות קשות / סרטן',
          steps: [
            { key:'ci_smoking', text:'האם הנך מעשן או עישנת בשנתיים האחרונות?', fields:[{ key:'cigarettes', label:'כמות סיגריות ליום', type:'text' }]},
            { key:'ci_family', text:'האם בקרב קרוב משפחה מדרגה ראשונה התגלו מחלות משמעותיות עד גיל 60?', questionnaireNos:['22'], fields: familyFields },
            { key:'ci_tests', text:'האם עברת או הומלץ לך לעבור בדיקות פולשניות / הדמיה או בדיקות לגילוי מוקדם של סרטן ב-5 השנים האחרונות?', questionnaireNos:['18'], fields:[{ key:'testType', label:'איזו בדיקה', type:'text' },{ key:'date', label:'מתי', type:'text' },{ key:'result', label:'תוצאה / סטטוס', type:'textarea' }]},
            { key:'ci_cancer', text:'האם חלית במחלה או גידול ממאיר / טרום סרטני / גידול שפיר?', questionnaireNos:['17'], fields: detailFields },
            { key:'ci_digestive', text:'האם אובחנה מחלת קרוהן, קוליטיס, כבד, צהבת או דם בצואה?', questionnaireNos:['9','10'], fields: detailFields },
            { key:'ci_immune', text:'האם קיים דיכוי חיסוני, HIV או השתלת איברים?', fields: detailFields },
            { key:'ci_heightweight', text:'האם יש ממצא חריג בגובה / משקל או BMI שדורש פירוט?', fields:[{ key:'height', label:'גובה', type:'text' },{ key:'weight', label:'משקל', type:'text' },{ key:'details', label:'פירוט', type:'textarea' }]},
            { key:'ci_alcohol', text:'האם הינך צורך באופן קבוע יותר מ-2 כוסות משקה אלכוהולי ליום?', fields:[{ key:'amount', label:'כמות יומית', type:'text' },{ key:'details', label:'פירוט', type:'textarea' }]},
            { key:'ci_hospital', text:'האם ב-5 השנים האחרונות אושפזת, עברת ניתוח או הומלץ לך לעבור ניתוח עתידי?', questionnaireNos:['20'], fields:[{ key:'procedure', label:'איזה ניתוח / אשפוז', type:'text' },{ key:'date', label:'מתי', type:'text' },{ key:'status', label:'מצב כיום', type:'textarea' }]},
            { key:'ci_meds', text:'האם הינך נוטל או הומלץ לך ליטול תרופות באופן קבוע בשלוש השנים האחרונות?', fields:[{ key:'medName', label:'שם התרופה', type:'text' },{ key:'reason', label:'סיבת טיפול', type:'textarea' }]},
            { key:'ci_heart', text:'האם אובחנה מחלת לב, כלי דם או דם?', questionnaireNos:['2','3','4'], fields: detailFields },
            { key:'ci_neuro', text:'האם אובחנה מחלה במערכת העצבים והמוח?', questionnaireNos:['8'], fields: detailFields },
            { key:'ci_senses', text:'האם אובחנה מחלה במערכת החושים (ראייה / שמיעה)?', fields: detailFields },
            { key:'ci_lungs', text:'האם אובחנה מחלה במערכת הנשימה והריאות?', questionnaireNos:['16'], fields: detailFields },
            { key:'ci_ortho', text:'האם אובחנה מחלה אורטופדית / ראומטולוגית?', questionnaireNos:['12','13','14'], fields: detailFields },
            { key:'ci_kidney', text:'האם אובחנה מחלה במערכת הכליות והשתן?', fields: detailFields }
          ]
        }
      };
    },

    getPhoenixHealthSchema(){
      const catalog = this.buildPhoenixQuestionnaireCatalog();
      const categories = [];
      const seen = new Set();
      const phoenixPolicies = (this.newPolicies || []).filter(policy => safeTrim(policy?.company) === 'הפניקס');
      const healthPolicies = phoenixPolicies.filter(policy => safeTrim(policy?.type) === 'בריאות');
      const hasPhoenixHealth = healthPolicies.length > 0;

      if(hasPhoenixHealth && catalog.full_health){
        const healthSchema = catalog.full_health;
        const healthLabels = healthPolicies.map(policy => this.getPolicyLabel(policy)).filter(Boolean);
        const inheritedLabels = phoenixPolicies
          .filter(policy => {
            const type = safeTrim(policy?.type);
            return type && type !== 'בריאות' && (
              type === 'מחלות קשות' ||
              type === 'סרטן' ||
              type === 'ריסק' ||
              type === 'ריסק משכנתא'
            );
          })
          .map(policy => this.getPolicyLabel(policy))
          .filter(Boolean);
        categories.push({
          key: 'phoenix_health_master',
          title: healthSchema.title,
          summary: healthSchema.sourceLabel,
          policyId: healthPolicies[0]?.id || '',
          questions: (healthSchema.steps || []).map(step => ({
            ...step,
            key: `phoenix_health_master__${step.key}`,
            originalKey: step.key,
            companies:['הפניקס'],
            policyLabel: healthLabels[0] || healthSchema.sourceLabel,
            fields: this.buildPhoenixFollowupFields(step.questionnaireNos || [], step.fields || []),
            requirements: {
              default: [
                healthSchema.sourceLabel,
                ...(step.questionnaireNos?.length ? [`יש למלא שאלון/י המשך: ${step.questionnaireNos.join(', ')}`] : []),
                'נבחר מוצר בריאות — הצהרת הבריאות של הבריאות משמשת כהצהרת אב לכל המוצרים הרפואיים הרלוונטיים.'
              ],
              'הפניקס': [
                `פוליסות מקור: ${healthLabels.join(' · ') || 'ביטוח בריאות'}`,
                ...(inheritedLabels.length ? [`פוליסות יורשות: ${inheritedLabels.join(' · ')}`] : []),
                'מחלות קשות / סרטן / ריסק / ריסק משכנתא יירשו אוטומטית מהצהרת הבריאות ולא יוצגו כהצהרה נפרדת.'
              ]
            }
          }))
        });
      }

      phoenixPolicies.forEach(policy => {
        const type = safeTrim(policy?.type);
        let schemaKey = '';
        if(type === 'בריאות') return;
        if(hasPhoenixHealth && (type === 'מחלות קשות' || type === 'סרטן' || type === 'ריסק' || type === 'ריסק משכנתא')) return;
        if(type === 'מחלות קשות' || type === 'סרטן') schemaKey = 'critical_illness';
        else if(type === 'ריסק' || type === 'ריסק משכנתא'){
          const insured = (this.insureds || []).find(x => x.id === policy.insuredId) || this.insureds[0] || { data:{} };
          const age = this.calcAge(insured?.data?.birthDate);
          const sum = this.parseMoneyNumber(policy?.sumInsured);
          schemaKey = (age !== null && age <= 55 && sum !== null && sum <= 2000000) ? 'short_risk' : 'extended_risk';
        }
        if(!schemaKey || !catalog[schemaKey]) return;
        const dedupeKey = `${schemaKey}|${safeTrim(policy?.company)}|${safeTrim(policy?.type)}|${safeTrim(policy?.insuredMode)}|${safeTrim(policy?.insuredId)}`;
        if(seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        const schema = catalog[schemaKey];
        categories.push({
          key: `phoenix_${policy.id || categories.length}_${schemaKey}`,
          title: `${this.getPolicyLabel(policy)} — ${schema.title}`,
          summary: schema.sourceLabel,
          policyId: policy.id,
          questions: (schema.steps || []).map(step => ({
            ...step,
            key: `${policy.id || 'p'}__${step.key}`,
            originalKey: step.key,
            companies:['הפניקס'],
            policyLabel: this.getPolicyLabel(policy),
            fields: this.buildPhoenixFollowupFields(step.questionnaireNos || [], step.fields || []),
            requirements: { default: [schema.sourceLabel, ...(step.questionnaireNos?.length ? [`יש למלא שאלון/י המשך: ${step.questionnaireNos.join(', ')}`] : [])], 'הפניקס': [`פוליסה: ${this.getPolicyLabel(policy)}`] }
          }))
        });
      });
      return categories;
    },

    getHealthSchema(){
      const allCompanies = ["כלל","הפניקס","הכשרה","הראל","מגדל","מנורה","איילון"];
      const lifeCompanies = ["כלל","הפניקס","הראל","מגדל","מנורה","איילון"];
      const mkReq = (defaultItems=[], extra={}) => ({ default: defaultItems, ...extra });
      return [
        {
          key:"general",
          title:"מצב רפואי כללי",
          summary:"בירור, מחלות כרוניות, תרופות, בדיקות, אשפוזים ונכויות.",
          questions:[
            { key:"general_followup", text:"האם אתה נמצא כיום בבירור רפואי, מעקב, טיפול קבוע או בהמתנה לתוצאה רפואית?", companies: allCompanies, fields:[
              { key:"reason", label:"מה מהות הבירור / המעקב", type:"text" },
              { key:"since", label:"ממתי", type:"text" },
              { key:"status", label:"מה המצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של סיבת הבירור, ממתי ומצב נוכחי"]) },
            { key:"general_chronic", text:"האם אובחנה אצלך מחלה כרונית, מצב רפואי מתמשך או צורך במעקב רפואי קבוע?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"date", label:"מועד אבחון", type:"text" },
              { key:"status", label:"טיפול / מצב נוכחי", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה, מועד אבחון וטיפול נוכחי"]) },
            { key:"general_meds", text:"האם אתה נוטל תרופות באופן קבוע?", companies: allCompanies, fields:[
              { key:"meds", label:"שמות התרופות", type:"textarea" },
              { key:"why", label:"לשם מה ניטלות התרופות", type:"text" },
              { key:"since", label:"ממתי", type:"text" }
            ], requirements: mkReq(["שם התרופות + סיבת נטילה"]) },
            { key:"general_test_wait", text:"האם הומלץ לך לעבור בדיקה, טיפול או ניתוח שטרם בוצעו?", companies: allCompanies, fields:[
              { key:"what", label:"איזו בדיקה / טיפול / ניתוח", type:"text" },
              { key:"why", label:"סיבה רפואית", type:"textarea" },
              { key:"when", label:"מתי הומלץ", type:"text" }
            ], requirements: mkReq(["פירוט מה הומלץ ומה סיבת הבירור"], { "הפניקס":["לציין גם האם הומלץ המשך בירור"], "הראל":["בדיקה או אשפוז מחייבים פירוט מלא"] }) },
            { key:"general_hospital", text:"האם היית באשפוז בבית חולים או במיון ב-5 השנים האחרונות?", companies: allCompanies, fields:[
              { key:"date", label:"מועד האשפוז", type:"text" },
              { key:"reason", label:"סיבת האשפוז / אבחנה", type:"text" },
              { key:"status", label:"האם הבעיה חלפה / נדרש המשך בירור", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של כל אשפוז"], { "הפניקס":["אשפוז מחייב מועד, אבחנה והאם הבעיה חלפה"], "הראל":["אשפוז מחייב פירוט כמפורט בדגשי חיתום"] }) },
            { key:"general_surgery", text:"האם עברת ניתוח, צנתור, ביופסיה, אנדוסקופיה או פרוצדורה פולשנית?", companies: allCompanies, fields:[
              { key:"procedure", label:"איזו פרוצדורה", type:"text" },
              { key:"date", label:"מתי", type:"text" },
              { key:"result", label:"תוצאה / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט סוג הפרוצדורה, מועד ותוצאה"]) },
            { key:"general_disability", text:"האם קיימת נכות רפואית, אובדן כושר, קצבה, או מגבלה תפקודית קבועה?", companies: allCompanies, fields:[
              { key:"reason", label:"סיבת הנכות / המגבלה", type:"text" },
              { key:"percent", label:"אחוז נכות / סוג קצבה", type:"text" },
              { key:"details", label:"פירוט מצב תפקודי", type:"textarea" }
            ], requirements: mkReq(["פירוט סיבת הנכות והמצב התפקודי"], { "הראל":["עדיף פרוטוקול ביטוח לאומי / משרד הביטחון אם קיים"] }) }
          ]
        },
        {
          key:"heart",
          title:"לב וכלי דם",
          summary:"לב, לחץ דם, שומנים, כלי דם וגורמי סיכון.",
          questions:[
            { key:"heart_disease", text:"האם אובחנת במחלת לב, מחלת לב איסכמית, אוטם, צנתור, מעקפים, מסתמים או אוושה?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה מדויקת", type:"text" },
              { key:"date", label:"מועד אבחון / אירוע", type:"text" },
              { key:"details", label:"בדיקות שבוצעו / צנתור / ניתוח / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["שאלון לב"], { "הפניקס":["לעיתים נדרש תיעוד קרדיולוג כולל אקו / מיפוי / מאמץ"], "הראל":["תיעוד מרופא עדיף קרדיולוג עם חומרה ובדיקות"] }) },
            { key:"heart_arrhythmia", text:"האם קיימת הפרעת קצב, פלפיטציות, קוצב או טיפול קרדיולוגי קבוע?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"סוג ההפרעה", type:"text" },
              { key:"treatment", label:"טיפול / תרופות / קוצב", type:"text" },
              { key:"last", label:"מצב נוכחי / אירוע אחרון", type:"textarea" }
            ], requirements: mkReq(["פירוט סוג הפרעת הקצב והטיפול"]) },
            { key:"heart_hypertension", text:"האם אובחנת ביתר לחץ דם?", companies: allCompanies, fields:[
              { key:"avg", label:"ערך לחץ דם ממוצע / אחרון", type:"text" },
              { key:"since", label:"ממתי", type:"text" },
              { key:"meds", label:"טיפול / תרופות", type:"textarea" }
            ], requirements: mkReq(["ערך לחץ דם אחרון / ממוצע וטיפול"], { "הראל":["נדרש ערך לחץ דם מהשנה האחרונה"], "הפניקס":["יתר לחץ דם הוא גורם סיכון הדורש פירוט"] }) },
            { key:"heart_lipids", text:"האם יש יתר שומנים בדם, כולסטרול גבוה או טריגליצרידים גבוהים?", companies: allCompanies, fields:[
              { key:"value", label:"ערך אחרון ידוע", type:"text" },
              { key:"meds", label:"טיפול / תרופות", type:"text" },
              { key:"since", label:"ממתי", type:"text" }
            ], requirements: mkReq(["פירוט ערכים וטיפול"], { "הראל":["לכולסטרול / טריגליצרידים יש לציין ערך אחרון"] }) },
            { key:"heart_vessels", text:"האם קיימת מחלת כלי דם, מפרצת, קרישיות או אירוע של קריש דם?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה / מיקום", type:"text" },
              { key:"date", label:"מועד האירוע", type:"text" },
              { key:"details", label:"טיפול / סיבוכים / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של אבחנה, טיפול וסיבוכים"], { "הראל":["מחלת כלי דם מחייבת לעיתים תיעוד מומחה כלי דם"] }) }
          ]
        },
        {
          key:"respiratory",
          title:"ריאות ונשימה",
          summary:"אסתמה, COPD, דום נשימה, מחלות ריאה ואשפוזי נשימה.",
          questions:[
            { key:"resp_asthma", text:"האם אובחנת באסתמה?", companies: allCompanies, fields:[
              { key:"since", label:"מועד אבחון", type:"text" },
              { key:"severity", label:"תדירות התקפים / חומרה", type:"text" },
              { key:"treatment", label:"טיפול קבוע / משאפים / סטרואידים", type:"textarea" }
            ], requirements: mkReq(["שאלון ריאות / אסתמה"], { "הפניקס":["יש לציין אם טיפול קבוע או בעת התקף והאם היה פרדניזון / אשפוז"], "איילון":["לעיתים נדרש סיכום רופא ותפקודי ריאות"] }) },
            { key:"resp_copd", text:"האם אובחנת ב-COPD, אמפיזמה, ברונכיטיס כרונית או מחלת ריאות כרונית אחרת?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"tests", label:"תפקודי ריאות / בדיקות שבוצעו", type:"text" },
              { key:"details", label:"טיפול / חמצן / מצב נוכחי", type:"textarea" }
            ], requirements: mkReq(["שאלון ריאות"], { "הפניקס":["ב-COPD נדרש תיעוד רפואי כולל תפקודי ריאות"], "הראל":["מחלת ריאות חסימתית מחייבת תיעוד רופא ריאות"] }) },
            { key:"resp_sleep", text:"האם אובחנת בדום נשימה בשינה?", companies: allCompanies, fields:[
              { key:"severity", label:"חומרה (קל / בינוני / קשה)", type:"text" },
              { key:"treatment", label:"טיפול / CPAP", type:"text" },
              { key:"details", label:"פירוט נוסף", type:"textarea" }
            ], requirements: mkReq(["פירוט חומרה וטיפול"], { "הראל":["יש לציין חומרה"], "איילון":["יש לציין חומרה וטיפול"] }) },
            { key:"resp_other", text:"האם קיימת מחלת ריאות או נשימה אחרת, כולל פנאומוטורקס, סרקואידוזיס או סינוסיטיס כרונית?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"date", label:"מתי", type:"text" },
              { key:"details", label:"טיפול / אשפוזים / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה, טיפול ואשפוזים"]) }
          ]
        },
        {
          key:"neuro",
          title:"נוירולוגיה ומוח",
          summary:"אפילפסיה, שבץ, טרשת, חבלות ראש, סחרחורות והתפתחות.",
          questions:[
            { key:"neuro_epilepsy", text:"האם אובחנת באפילפסיה, פרכוסים או אירועי התנתקות?", companies: allCompanies, fields:[
              { key:"type", label:"סוג (פטיט מאל / גראנד מאל / אחר)", type:"text" },
              { key:"freq", label:"תדירות התקפים", type:"text" },
              { key:"details", label:"טיפול / מועד התקף אחרון", type:"textarea" }
            ], requirements: mkReq(["שאלון אפילפסיה"], { "כלל":["פירוט סוג ההתקפים ומועד אחרון"], "מנורה":["אפילפסיה מחייבת שאלון ייעודי"], "איילון":["יש לציין מספר התקפים וטיפול תרופתי"] }) },
            { key:"neuro_stroke", text:"האם עברת שבץ מוחי, אירוע מוחי חולף (TIA), דימום מוחי או חבלת ראש משמעותית?", companies: allCompanies, fields:[
              { key:"event", label:"איזה אירוע", type:"text" },
              { key:"date", label:"מתי", type:"text" },
              { key:"status", label:"נזק שארי / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של האירוע והמצב הנוכחי"], { "הפניקס":["לעיתים יידרש תיעוד נוירולוג"], "כלל":["שבץ / TIA נכללים בשאלון עצבים"] }) },
            { key:"neuro_deg", text:"האם אובחנת בטרשת נפוצה, פרקינסון, ניוון שרירים, מיאסטניה או מחלה נוירולוגית אחרת?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"date", label:"מועד אבחון", type:"text" },
              { key:"details", label:"טיפול / מגבלות / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה וטיפול"], { "הפניקס":["מחלה נוירולוגית מחייבת תיעוד נוירולוג"], "הראל":["תיעוד נוירולוג עדכני עשוי להידרש"] }) },
            { key:"neuro_symptoms", text:"האם קיימות סחרחורות, התעלפויות, נימול, ירידה בתחושה או כאבי ראש / מיגרנות משמעותיות?", companies: allCompanies, fields:[
              { key:"symptom", label:"איזה סימפטום", type:"text" },
              { key:"frequency", label:"תדירות / מתי הופיע", type:"text" },
              { key:"details", label:"בירור / טיפול / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של הסימפטומים והבירור"]) },
            { key:"neuro_development", text:"האם קיימת אבחנה של אוטיזם, עיכוב התפתחותי או צורך בסיוע והשגחה?", companies:["כלל","הפניקס","הראל"], fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"support", label:"סיוע / השגחה / אחוזי נכות", type:"text" },
              { key:"details", label:"פירוט תפקודי", type:"textarea" }
            ], requirements: mkReq(["פירוט תפקודי מלא"], { "הפניקס":["מעל גיל 7 עשוי להידרש פרוטוקול ביטוח לאומי / נוירולוג / פסיכיאטר"] }) }
          ]
        },
        {
          key:"mental",
          title:"בריאות הנפש",
          summary:"חרדה, דיכאון, טיפולים, אשפוזים ותרופות נפשיות.",
          questions:[
            { key:"mental_diag", text:"האם אובחנת בחרדה, דיכאון, הפרעת קשב, הפרעה נפשית או קיבלת טיפול פסיכולוגי / פסיכיאטרי?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"therapy", label:"טיפול / מטפל", type:"text" },
              { key:"details", label:"תרופות / משך טיפול / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה, טיפול ותרופות"], { "הפניקס":["בעיות נפשיות עשויות להסתפק בשאלון או לחייב תיעוד פסיכיאטרי"], "הראל":["יש לציין חומרה, טיפול ואשפוז אם היה"] }) },
            { key:"mental_antipsy", text:"האם היה טיפול אנטיפסיכוטי, אשפוז פסיכיאטרי, ניסיון אובדני או נכות נפשית?", companies: allCompanies, fields:[
              { key:"event", label:"איזו אבחנה / אירוע", type:"text" },
              { key:"date", label:"מתי", type:"text" },
              { key:"details", label:"פירוט מלא", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא"], { "הפניקס":["תיעוד פסיכיאטרי נדרש במקרים אלה"], "הראל":["תיעוד פסיכיאטרי עשוי להידרש"] }) }
          ]
        },
        {
          key:"oncology",
          title:"גידולים, סרטן וביופסיות",
          summary:"גידולים שפירים/ממאירים, ביופסיה, טיפולים ומעקב.",
          questions:[
            { key:"oncology_cancer", text:"האם אובחנת בסרטן, גידול ממאיר או היית במעקב אונקולוגי?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"סוג האבחנה", type:"text" },
              { key:"date", label:"מועד גילוי", type:"text" },
              { key:"details", label:"טיפול / תום טיפול / Stage / Grade / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["שאלון אונקולוגי"], { "הפניקס":["ב-10 השנים האחרונות נדרש תיעוד אונקולוג מלא"], "הראל":["לפרט Stage / Grade אם ידוע"], "איילון":["לגידול ממאיר ייתכן צורך במכתב אונקולוג / רופא מטפל"] }) },
            { key:"oncology_benign", text:"האם אובחן אצלך גידול שפיר, ציסטה, קשרית או ממצא חריג שדרש מעקב?", companies: allCompanies, fields:[
              { key:"organ", label:"באיזה איבר", type:"text" },
              { key:"date", label:"מועד גילוי", type:"text" },
              { key:"details", label:"ביופסיה / תשובה / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט האיבר, הממצא ומה בוצע"], { "הפניקס":["ביופסיה ב-3 החודשים האחרונים מחייבת תוצאה / דוח היסטולוגי"] }) },
            { key:"oncology_biopsy", text:"האם עברת ביופסיה, כריתה, הקרנות או כימותרפיה?", companies: allCompanies, fields:[
              { key:"type", label:"איזה טיפול / ביופסיה", type:"text" },
              { key:"date", label:"מתי", type:"text" },
              { key:"result", label:"תוצאה / מצב נוכחי", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של סוג הבדיקה / הטיפול והתוצאה"]) }
          ]
        },
        {
          key:"digestive",
          title:"עיכול, כבד ולבלב",
          summary:"מעיים, כבד, כיס מרה, לבלב וקיבה.",
          questions:[
            { key:"digest_liver", text:"האם קיימת מחלת כבד, הפטיטיס, הפרעה בתפקודי כבד או כבד שומני?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"values", label:"תפקודי כבד / עומס ויראלי אם ידוע", type:"text" },
              { key:"details", label:"טיפול / הדמיה / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה ותפקודי כבד"], { "הפניקס":["הפטיטיס / מחלת כבד מחייבים לעיתים תיעוד גסטרו"], "הראל":["למעט כבד שומני, מחלת כבד מחייבת לעיתים תיעוד רופא"] }) },
            { key:"digest_ibd", text:"האם אובחנת בקרוהן, קוליטיס, מחלת מעי דלקתית או מחלה כרונית במערכת העיכול?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"treatment", label:"טיפול", type:"text" },
              { key:"details", label:"סיבוכים / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה, טיפול וסיבוכים"]) },
            { key:"digest_stomach", text:"האם קיימת מחלת קיבה, כיב, רפלוקס משמעותי, מחלת לבלב או כיס מרה?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"date", label:"מועד אבחון", type:"text" },
              { key:"details", label:"טיפול / ניתוח / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של האבחנה והטיפול"]) }
          ]
        },
        {
          key:"kidney",
          title:"כליות ודרכי שתן",
          summary:"מחלת כליות, אבנים, דם/חלבון בשתן, אורולוגיה.",
          questions:[
            { key:"kidney_disease", text:"האם אובחנת במחלת כליות, אי ספיקת כליות, חלבון או דם בשתן?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"tests", label:"תפקודי כליות / בדיקות שתן", type:"text" },
              { key:"details", label:"פירוט טיפול / הדמיה / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא + בדיקות רלוונטיות אם ידוע"], { "הפניקס":["לעיתים נדרש תיעוד נפרולוג / אורולוג"], "הראל":["מחלת כליות מחייבת לעיתים תיעוד רופא ובדיקות שתן / הדמיה"] }) },
            { key:"kidney_stones", text:"האם היו אבנים בכליות, חסימה, זיהומים חוזרים או בעיה כרונית בדרכי השתן?", companies: allCompanies, fields:[
              { key:"problem", label:"איזו בעיה", type:"text" },
              { key:"last", label:"מועד אירוע אחרון", type:"text" },
              { key:"details", label:"טיפול / ניתוח / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט בעיה, מועד אחרון וטיפול"]) },
            { key:"kidney_prostate", text:"האם קיימת בעיה בערמונית, אורולוגיה או מעקב אורולוגי קבוע?", companies: lifeCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"treatment", label:"טיפול / תרופות", type:"text" },
              { key:"details", label:"מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה, טיפול ומעקב"]) }
          ]
        },
        {
          key:"metabolic",
          title:"סוכרת, הורמונלי ומטבולי",
          summary:"סוכרת, בלוטת תריס, עודף/תת משקל ומחלות הורמונליות.",
          questions:[
            { key:"metabolic_diabetes", text:"האם אובחנת בסוכרת או טרום סוכרת?", companies: allCompanies, fields:[
              { key:"type", label:"סוג הסוכרת / טרום סוכרת", type:"text" },
              { key:"since", label:"מועד אבחון", type:"text" },
              { key:"details", label:"טיפול / אינסולין / HbA1c / פגיעה באיברי מטרה", type:"textarea" }
            ], requirements: mkReq(["שאלון סוכרת"], { "הפניקס":["מעל ספים מסוימים יידרש תיעוד רופא כולל HbA1c וחלבון בשתן"], "הראל":["סכומי ריסק ואכ״ע מסוימים עשויים לחייב תיעוד רופא"] }) },
            { key:"metabolic_thyroid", text:"האם קיימת בעיה בבלוטת התריס / יותרת התריס, כולל קשרית, ציסטה, השימוטו או גידול?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"date", label:"מועד אבחון", type:"text" },
              { key:"details", label:"טיפול / ניתוח / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה וטיפול"], { "איילון":["בשאלון בלוטת תריס יש לציין טיפול ומועד ניתוח אם היה"] }) },
            { key:"metabolic_weight", text:"האם קיים BMI חריג, עודף משקל קיצוני, תת משקל משמעותי או ניתוח בריאטרי?", companies: allCompanies, fields:[
              { key:"bmi", label:"BMI / גובה-משקל / שינוי משקל", type:"text" },
              { key:"date", label:"מועד ניתוח / שינוי משמעותי", type:"text" },
              { key:"details", label:"פירוט מעקב, בדיקות וטיפול", type:"textarea" }
            ], requirements: mkReq(["פירוט משקל / שינוי משקל"], { "הפניקס":["BMI גבוה ברמות מסוימות עשוי לחייב תמצית מידע מקופ״ח"], "מנורה":["עודף משקל חריג עשוי לחייב בדיקות דם או תיעוד"], "הראל":["יש לציין אם תת המשקל יציב לאורך 3 השנים האחרונות"] }) },
            { key:"metabolic_other", text:"האם קיימת מחלה הורמונלית / מטבולית אחרת?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"treatment", label:"טיפול", type:"text" },
              { key:"details", label:"מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של האבחנה והטיפול"]) }
          ]
        },
        {
          key:"blood_autoimmune",
          title:"דם, חיסון ואוטואימוני",
          summary:"אנמיה, קרישיות, לופוס, ראומטולוגיה, HIV ומחלות חיסון.",
          questions:[
            { key:"blood_disorder", text:"האם קיימת מחלת דם, אנמיה משמעותית, הפרעת קרישה או קרישיות יתר?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"latest", label:"ערך / בדיקה אחרונה", type:"text" },
              { key:"details", label:"טיפול / אירועי קריש דם / סיבוכים", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של האבחנה והטיפול"], { "הראל":["קרישיות יתר מחייבת אבחנה, טיפול והאם היה אירוע קריש דם"], "הפניקס":["מחלת דם לרוב מחייבת תיעוד המטולוג"] }) },
            { key:"autoimmune_lupus", text:"האם אובחנת בלופוס, דלקת מפרקים שגרונית, FMF או מחלה אוטואימונית / ראומטולוגית?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"treatment", label:"טיפול / ביולוגי / סטרואידים", type:"text" },
              { key:"details", label:"סיבוכים מחוץ למערכת השלד / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה, טיפול וסיבוכים"], { "הפניקס":["לופוס עשוי לחייב תפקודי כליה וחלבון בשתן"], "הראל":["דלקת מפרקים עשויה לחייב תיעוד ראומטולוג"] }) },
            { key:"blood_hiv", text:"האם קיימת נשאות HIV או מחלה זיהומית משמעותית (HIV / הפטיטיס / שחפת וכד')?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"since", label:"מועד אבחון", type:"text" },
              { key:"details", label:"טיפול / עומס ויראלי / סיבוכים", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של אבחנה, טיפול ומצב כיום"], { "הפניקס":["בנשאות HIV יש לציין CD4, עומס ויראלי, טיפול וסיבוכים"] }) }
          ]
        },
        {
          key:"musculoskeletal",
          title:"שלד, גב ומפרקים",
          summary:"גב, דיסק, מפרקים, שברים, מגבלות וניתוחים אורטופדיים.",
          questions:[
            { key:"ortho_back", text:"האם קיימת בעיה בגב או בעמוד השדרה, כולל בלט / בקע / פריצת דיסק / כאבי גב כרוניים?", companies: allCompanies, fields:[
              { key:"area", label:"אזור עמוד השדרה", type:"text" },
              { key:"date", label:"מועד אבחון / אירוע אחרון", type:"text" },
              { key:"details", label:"טיפול / ימי היעדרות / ניתוח / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["שאלון גב / אורטופדי"], { "הפניקס":["באכ״ע יש לציין ימי היעדרות ב-3 השנים האחרונות"], "הראל":["יש לפרט אזור עמוד השדרה"], "איילון":["שאלון מערכת השלד כולל מגבלה, טיפולים וניתוחים"] }) },
            { key:"ortho_joints", text:"האם קיימת בעיה במפרקים, כתפיים, ברכיים, מניסקוס, רצועות, אוסטיאופורוזיס או בריחת סידן?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"location", label:"מיקום / צד", type:"text" },
              { key:"details", label:"טיפול / ניתוח / מגבלה תפקודית", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה, מיקום, טיפול ומגבלה"], { "הפניקס":["יש לציין אם מדובר באוסטיאופניה או אוסטיאופורוזיס"], "איילון":["יש לציין צד הפגיעה ומגבלה תפקודית"] }) },
            { key:"ortho_other", text:"האם קיימת נכות אורטופדית, קטיעה, שבר משמעותי, תאונה עם פגיעה מתמשכת או מחלת שלד אחרת?", companies: allCompanies, fields:[
              { key:"problem", label:"איזו בעיה", type:"text" },
              { key:"date", label:"מתי", type:"text" },
              { key:"details", label:"פירוט מלא", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של הבעיה והמצב התפקודי"]) }
          ]
        },
        {
          key:"vision_skin_ent",
          title:"עיניים, עור ואא״ג",
          summary:"עיניים, שמיעה, עור ומחלות כרוניות משלימות.",
          questions:[
            { key:"vision_eye", text:"האם קיימת מחלת עיניים משמעותית, גלאוקומה, קטרקט, ניתוח עיניים או ירידה משמעותית בראייה?", companies:["כלל","הראל","מגדל","מנורה","הפניקס"], fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"surgery", label:"ניתוח / טיפול", type:"text" },
              { key:"details", label:"מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט אבחנה, טיפול ומצב נוכחי"]) },
            { key:"skin_main", text:"האם קיימת מחלת עור כרונית, פסוריאזיס, אטופיק דרמטיטיס או ממצא עור במעקב?", companies: allCompanies, fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"severity", label:"חומרה / אחוזי מעורבות", type:"text" },
              { key:"details", label:"טיפול / מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מחלת העור והטיפול"], { "הפניקס":["ייתכן צורך להבדיל בין שפיר לממאיר בממצאי עור"] }) },
            { key:"ent_main", text:"האם קיימת מחלת אוזניים, שמיעה, סחרחורת ממקור אא״ג, ניתוח אא״ג או בעיה כרונית אחרת בתחום זה?", companies:["כלל","הראל","מגדל","מנורה","הפניקס"], fields:[
              { key:"diagnosis", label:"אבחנה", type:"text" },
              { key:"date", label:"מועד אבחון / ניתוח", type:"text" },
              { key:"details", label:"פירוט מצב כיום", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא לפי הצורך"]) }
          ]
        },
        {
          key:"lifestyle_family",
          title:"אורח חיים והיסטוריה משפחתית",
          summary:"עישון, אלכוהול, סמים, קנאביס, עיסוק וקרובי משפחה.",
          questions:[
            { key:"life_smoke", text:"האם אתה מעשן כיום או עישנת בעבר מוצרי טבק / ניקוטין?", companies: allCompanies, fields:[
              { key:"status", label:"כיום / בעבר", type:"text" },
              { key:"amount", label:"כמה / תדירות", type:"text" },
              { key:"quit", label:"מתי הפסקת אם רלוונטי", type:"text" }
            ], requirements: mkReq(["פירוט שימוש / כמות / מועד הפסקה"], { "איילון":["בחלק מהמקרים נדרשת בדיקת קוטינין"], "מנורה":["בדיקות רפואיות מסוימות כוללות קוטינין ללא מעשנים"] }) },
            { key:"life_alcohol", text:"האם קיימת צריכת אלכוהול חריגה, טיפול גמילה או בעיית אלכוהול?", companies: allCompanies, fields:[
              { key:"amount", label:"כמות / תדירות", type:"text" },
              { key:"quit", label:"אם הייתה גמילה - מתי", type:"text" },
              { key:"details", label:"פירוט נוסף", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של השימוש / גמילה"], { "מנורה":["יש שאלון אלכוהול ייעודי"] }) },
            { key:"life_drugs", text:"האם היה שימוש בסמים, קנאביס, קנאביס רפואי, תרופות ממכרות או גמילה?", companies: allCompanies, fields:[
              { key:"type", label:"איזה חומר", type:"text" },
              { key:"freq", label:"תדירות / בעבר או כיום", type:"text" },
              { key:"details", label:"סיבה רפואית / גמילה / פירוט נוסף", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של החומר, תדירות והאם בעבר/כיום"], { "כלל":["סמים / קנאביס מחייבים שאלון ייעודי ולעיתים מסמכים"], "מנורה":["יש שאלון סמים"], "הפניקס":["ייתכן פירוט נוסף לפי חומרה"] }) },
            { key:"life_family", text:"האם קיימת היסטוריה משפחתית מדרגה ראשונה של סרטן, מחלת לב, סכרת, כליות, טרשת נפוצה, ALS, פרקינסון, אלצהיימר או מחלה תורשתית אחרת?", companies: allCompanies, fields:[
              { key:"who", label:"איזה קרובי משפחה", type:"text" },
              { key:"disease", label:"איזו מחלה", type:"text" },
              { key:"details", label:"כמה קרובים ובאיזה גיל אובחנו", type:"textarea" }
            ], requirements: mkReq(["פירוט הקרובים, המחלה וגיל האבחון"], { "הפניקס":["יש להצהיר רק על קרוב מדרגה ראשונה שאובחן עד גיל 60"], "כלל":["יש שאלון היסטוריה משפחתית מפורט"] }) }
          ]
        },
        {
          key:"women",
          title:"נשים / היריון",
          summary:"היריון, סיבוכים, שד, גינקולוגיה ובדיקות רלוונטיות.",
          questions:[
            { key:"women_pregnancy", text:"האם קיימת היריון, סיבוכי היריון, מעקב היריון בסיכון או טיפול פוריות?", companies:["כלל","הפניקס","הראל","מנורה","איילון"], fields:[
              { key:"week", label:"שבוע / מצב נוכחי", type:"text" },
              { key:"details", label:"פירוט סיבוכים / מעקב / טיפול", type:"textarea" },
              { key:"history", label:"סיבוכי עבר אם קיימים", type:"text" }
            ], requirements: mkReq(["פירוט מלא במקרה של תשובה חיובית"]) },
            { key:"women_breast", text:"האם קיימת בעיה גינקולוגית, ממצא בשד, ממוגרפיה / אולטרסאונד חריגים או מעקב נשי רלוונטי?", companies:["כלל","הפניקס","הראל","מנורה","איילון"], fields:[
              { key:"finding", label:"איזה ממצא", type:"text" },
              { key:"date", label:"מתי", type:"text" },
              { key:"details", label:"ביופסיה / מעקב / תשובה", type:"textarea" }
            ], requirements: mkReq(["פירוט מלא של הממצא והבירור"]) }
          ]
        }
      ];
    },

    getHealthQuestionsFiltered(){
      const phoenixSchema = this.getPhoenixHealthSchema();
      if(phoenixSchema.length) return phoenixSchema;
      const companies = this.getHealthCompanies();
      const schema = this.getHealthSchema();
      if(!companies.length) return schema;
      return schema.map(cat => {
        const questions = (cat.questions || []).filter(q => !q.companies || q.companies.some(c => companies.includes(c)));
        return { ...cat, questions };
      }).filter(cat => cat.questions.length);
    },

    getHealthQuestionList(){
      const cats = this.getHealthQuestionsFiltered();
      const list = [];
      cats.forEach(cat => {
        (cat.questions || []).forEach(q => list.push({ catKey: cat.key, catTitle: cat.title, catSummary: cat.summary || "", question: q }));
      });
      return list;
    },

    getHealthResponse(qKey, insId){
      const store = this.getHealthStore();
      const qBlock = store.responses[qKey] || {};
      const out = qBlock[insId] || { answer:"", fields:{}, saved:false };
      if(!out.fields) out.fields = {};
      return out;
    },

    setHealthResponse(qKey, insId, patch){
      const store = this.getHealthStore();
      store.responses[qKey] = store.responses[qKey] || {};
      const prev = this.getHealthResponse(qKey, insId);
      store.responses[qKey][insId] = {
        ...prev,
        ...patch,
        fields: { ...(prev.fields || {}), ...((patch && patch.fields) || {}) }
      };
    },

    getHealthProgress(){
      const list = this.getHealthQuestionList();
      const total = list.length || 1;
      const store = this.getHealthStore();
      const idx = Math.max(0, Math.min(total-1, Number(store.ui.currentIndex || 0)));
      return { total, idx, pct: Math.round(((idx+1) / total) * 100) };
    },

    getHealthCategoryStatus(cat){
      const questions = cat?.questions || [];
      let yes = 0, pending = 0;
      questions.forEach(q => {
        this.insureds.forEach(ins => {
          const r = this.getHealthResponse(q.key, ins.id);
          if(r.answer === 'yes'){
            yes += 1;
            if(!r.saved) pending += 1;
          }
        });
      });
      return { yes, pending };
    },

    getInsuredHealthStatus(ins){
      const list = this.getHealthQuestionList();
      let yes = 0, pending = 0;
      list.forEach(item => {
        const r = this.getHealthResponse(item.question.key, ins.id);
        if(r.answer === 'yes'){
          yes += 1;
          if(!r.saved) pending += 1;
        }
      });
      if(pending > 0) return { cls:'warn', text:'חסר פירוט', icon:'!' };
      if(yes > 0) return { cls:'ok', text:'יש ממצאים', icon:'✓' };
      return { cls:'muted', text:'ללא ממצאים', icon:'•' };
    },

    getHealthQuestionRequirements(question){
      const companies = this.getHealthCompanies();
      const req = question.requirements || {};
      const out = [];
      if(Array.isArray(req.default) && req.default.length){
        out.push({ company:'כללי', items:req.default });
      }
      companies.forEach(c => {
        if(Array.isArray(req[c]) && req[c].length){ out.push({ company:c, items:req[c] }); }
      });
      return out;
    },

    summarizeHealthFields(fields){
      const vals = Object.values(fields || {}).map(v => safeTrim(v)).filter(Boolean);
      if(!vals.length) return 'נשמר';
      return vals.slice(0,2).join(' • ');
    },

    validateHealthDetail(question, insId){
      const r = this.getHealthResponse(question.key, insId);
      if(r.answer !== 'yes') return true;
      const required = (question.fields || []).filter(f => f.type !== 'section');
      if(!required.length) return true;
      return required.every(f => safeTrim(r.fields?.[f.key]));
    },

    renderHealthField(question, insId, field){
      if(field.type === 'section'){
        return `<div class="lcHQSectionTitle">${escapeHtml(field.label)}</div>`;
      }
      const r = this.getHealthResponse(question.key, insId);
      const val = safeTrim(r.fields?.[field.key] || '');
      const key = `${question.key}|${insId}|${field.key}`;
      if(field.type === 'textarea'){
        return `<div class="lcHQField lcHQField--full"><label class="lcHQLabel">${escapeHtml(field.label)}</label><textarea class="lcHQTextarea" rows="3" data-hfield="${escapeHtml(key)}">${escapeHtml(val)}</textarea></div>`;
      }
      return `<div class="lcHQField"><label class="lcHQLabel">${escapeHtml(field.label)}</label><input class="lcHQInput" type="text" value="${escapeHtml(val)}" data-hfield="${escapeHtml(key)}" /></div>`;
    },

    renderHealthStatusBar(){
      return `<div class="lcHStatusBar">${this.insureds.map(ins => {
        const st = this.getInsuredHealthStatus(ins);
        return `<div class="lcHStatusChip ${st.cls}"><span class="lcHStatusChip__dot">${escapeHtml(st.icon)}</span><div><div class="lcHStatusChip__name">${escapeHtml(ins.label)}</div><div class="lcHStatusChip__text">${escapeHtml(st.text)}</div></div></div>`;
      }).join('')}</div>`;
    },

    renderHealthSidebar(currentItem){
      return '';
    },

    ensureHealthFindingsModal(){
      if(this.els.healthFindingsModal) return this.els.healthFindingsModal;
      const wrap = document.createElement('div');
      wrap.id = 'lcHealthFindingsModal';
      wrap.className = 'modal lcHealthFindingsModal';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = `
        <div class="modal__backdrop" data-close="1"></div>
        <div class="modal__panel lcHealthFindingsModal__panel" role="dialog" aria-modal="true" aria-label="ממצאי הצהרת בריאות">
          <div class="modal__head lcHealthFindingsModal__head">
            <div>
              <div class="modal__kicker">GEMEL INVEST</div>
              <div class="modal__title" id="lcHealthFindingsModalTitle">ממצאי הצהרת בריאות</div>
            </div>
            <button class="iconBtn" type="button" id="lcHealthFindingsModalClose" aria-label="סגור">✕</button>
          </div>
          <div class="modal__body lcHealthFindingsModal__body" id="lcHealthFindingsModalBody"></div>
          <div class="modal__foot">
            <button class="btn" type="button" id="lcHealthFindingsModalDone">סגור</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      this.els.healthFindingsModal = wrap;
      this.els.healthFindingsModalTitle = wrap.querySelector('#lcHealthFindingsModalTitle');
      this.els.healthFindingsModalBody = wrap.querySelector('#lcHealthFindingsModalBody');
      this.els.healthFindingsModalClose = wrap.querySelector('#lcHealthFindingsModalClose');
      this.els.healthFindingsModalDone = wrap.querySelector('#lcHealthFindingsModalDone');
      on(this.els.healthFindingsModalClose, 'click', () => this.closeHealthFindingsModal());
      on(this.els.healthFindingsModalDone, 'click', () => this.closeHealthFindingsModal());
      on(wrap, 'click', (ev) => {
        if(ev.target?.getAttribute?.('data-close') === '1') this.closeHealthFindingsModal();
      });
      return wrap;
    },

    getHealthFindingsForInsured(insId){
      const ins = (this.insureds || []).find(x => String(x.id) === String(insId)) || null;
      if(!ins) return { ins:null, findings:[] };
      const findings = [];
      this.getHealthQuestionList().forEach(item => {
        const r = this.getHealthResponse(item.question.key, ins.id);
        if(r.answer === 'yes') findings.push({
          question: item.question,
          saved: !!r.saved,
          summary: this.summarizeHealthFields(r.fields || {}),
          fields: r.fields || {}
        });
      });
      return { ins, findings };
    },

    openHealthFindingsModal(insId){
      const { ins, findings } = this.getHealthFindingsForInsured(insId);
      if(!ins) return;
      this.ensureHealthFindingsModal();
      if(this.els.healthFindingsModalTitle){
        this.els.healthFindingsModalTitle.textContent = `ממצאי הצהרת בריאות · ${ins.label}`;
      }
      const bodyHtml = findings.length ? findings.map((item, idx) => {
        const details = Object.entries(item.fields || {})
          .map(([k,v]) => ({ key:safeTrim(k), value:safeTrim(v) }))
          .filter(row => row.key && row.value)
          .map(row => `<div class="lcHealthFindingsModal__detail"><span>${escapeHtml(row.key)}</span><strong>${escapeHtml(row.value)}</strong></div>`)
          .join('');
        return `<article class="lcHealthFindingsModal__item ${item.saved ? '' : 'is-warn'}">
          <div class="lcHealthFindingsModal__itemHead">
            <div class="lcHealthFindingsModal__index">${idx+1}</div>
            <div>
              <div class="lcHealthFindingsModal__question">${escapeHtml(item.question.text || '')}</div>
              <div class="lcHealthFindingsModal__summary">${escapeHtml(item.summary || 'נשמר')}</div>
            </div>
          </div>
          ${details ? `<div class="lcHealthFindingsModal__details">${details}</div>` : ''}
        </article>`;
      }).join('') : `<div class="emptyState"><div class="emptyState__icon">${premiumCustomerIcon("medical")}</div><div class="emptyState__title">אין ממצאים להצגה</div><div class="emptyState__text">לא סומנו תשובות כן עבור המבוטח הזה.</div></div>`;
      if(this.els.healthFindingsModalBody) this.els.healthFindingsModalBody.innerHTML = bodyHtml;
      this.els.healthFindingsModal.classList.add('is-open');
      this.els.healthFindingsModal.setAttribute('aria-hidden', 'false');
    },

    closeHealthFindingsModal(){
      if(!this.els.healthFindingsModal) return;
      this.els.healthFindingsModal.classList.remove('is-open');
      this.els.healthFindingsModal.setAttribute('aria-hidden', 'true');
    },

    renderHealthSummary(){
      const companies = this.getHealthCompanies();
      const byIns = this.insureds.map(ins => {
        const { findings } = this.getHealthFindingsForInsured(ins.id);
        const st = this.getInsuredHealthStatus(ins);
        const findingsPreview = findings.slice(0, 2).map(f => `<div class="lcHSummaryItem ${f.saved ? '' : 'warn'}"><strong>${escapeHtml(f.question.text)}</strong><span>${escapeHtml(f.summary)}</span></div>`).join('');
        return `<div class="lcHSummaryCard">
          <div class="lcHSummaryCard__head"><div><div class="lcHSummaryCard__name">${escapeHtml(ins.label)}</div><div class="lcHSummaryCard__meta">${escapeHtml(st.text)}</div></div><span class="badge">${findings.length || 0} ממצאים</span></div>
          <div class="lcHSummaryList">${findings.length ? findingsPreview : `<div class="muted">לא סומנו ממצאים עבור מבוטח זה.</div>`}</div>
          <div class="lcHSummaryCard__actions">${findings.length ? `<button type="button" class="btn btn--primary" data-health-open-findings="${escapeHtml(ins.id)}">הצג ממצאים</button>` : `<span class="muted small">אין ממצאים להצגה</span>`}</div>
        </div>`;
      }).join('');
      return `<div class="lcHLayout"><div class="lcHMain"><div class="lcHFinishHero">
        <div class="lcHFinishHero__kicker">תיק לקוח 360°</div>
        <div class="lcHFinishHero__title">סיכום חיתום והצהרת בריאות</div>
        <div class="lcHFinishHero__text">זהו מסך סיכום פנימי לנציג. הנתונים נשמרים על כל מבוטח בנפרד, יחד עם הממצאים שסומנו בשלב 8.</div>
        <div class="lcHCompanies">${companies.map(c => `<span class="lcHChip lcHChip--top">${escapeHtml(c)}</span>`).join('')}</div>
      </div>
      <div class="lcHSummaryGrid">${byIns}</div>
      </div></div>`;
    },

    renderStep8(){
      const companies = this.getHealthCompanies();
      const list = this.getHealthQuestionList();
      const store = this.getHealthStore();
      if(!list.length){
        return `<div class="lcHealthEmpty"><div class="lcHealthEmpty__icon">🩺</div><div class="lcHealthEmpty__title">הצהרת בריאות</div><div class="lcHealthEmpty__text">כדי להציג את שלב 8 יש לבחור בשלב 5 פוליסה רלוונטית. בפוליסות הפניקס המערכת תטען הצהרה ייעודית לפי חברה + מוצר, ובריסק גם לפי גיל המבוטח וסכום הביטוח.</div></div>`;
      }
      const idx = Math.max(0, Math.min(list.length - 1, Number(store.ui.currentIndex || 0)));
      store.ui.currentIndex = idx;
      if(store.ui.summary) return this.renderHealthSummary();
      const item = list[idx];
      const q = item.question;
      const reqs = this.getHealthQuestionRequirements(q);
      const matrix = this.insureds.map(ins => {
        const r = this.getHealthResponse(q.key, ins.id);
        const yes = r.answer === 'yes';
        const no = r.answer === 'no';
        const valid = this.validateHealthDetail(q, ins.id);
        const showEditor = yes && !r.saved;
        const savedBox = yes && r.saved ? `<div class="lcHSavedRow"><span class="lcHSavedRow__ok">✓ נשמר עבור ${escapeHtml(ins.label)}</span><span class="lcHSavedRow__meta">${escapeHtml(this.summarizeHealthFields(r.fields || {}))}</span><div class="lcHSavedRow__actions"><button type="button" class="btn" data-hedit="${escapeHtml(q.key)}|${escapeHtml(ins.id)}">ערוך</button><button type="button" class="btn btn--danger" data-hclear="${escapeHtml(q.key)}|${escapeHtml(ins.id)}">נקה</button></div></div>` : '';
        const editor = showEditor ? `<div class="lcHDetailCard"><div class="lcHDetailCard__head">פירוט עבור: ${escapeHtml(ins.label)}</div><div class="lcHQFields">${(q.fields || []).map(f => this.renderHealthField(q, ins.id, f)).join('')}</div><div class="lcHDetailCard__foot"><button type="button" class="btn btn--primary" data-hsave="${escapeHtml(q.key)}|${escapeHtml(ins.id)}">שמור</button>${!valid ? `<span class="lcHInlineWarn">יש למלא את כל שדות התת־שאלון לפני שמירה</span>` : ''}</div></div>` : '';
        return `<div class="lcHMatrixRow ${yes ? 'is-yes' : no ? 'is-no' : ''}">
          <div class="lcHMatrixRow__who">${escapeHtml(ins.label)}</div>
          <div class="lcHAnswerBtns">
            <button type="button" class="lcHAnswerBtn ${yes ? 'is-active' : ''}" data-hans="${escapeHtml(q.key)}|${escapeHtml(ins.id)}|yes">כן</button>
            <button type="button" class="lcHAnswerBtn ${no ? 'is-active' : ''}" data-hans="${escapeHtml(q.key)}|${escapeHtml(ins.id)}|no">לא</button>
          </div>
          <div class="lcHMatrixRow__content">${savedBox}${editor}</div>
        </div>`;
      }).join('');
      const catIndex = this.getHealthQuestionsFiltered().findIndex(c => c.key === item.catKey);
      return `<div class="lcHLayout">
        <div class="lcHMain">
          <div class="lcHHeroCard">
            <div class="lcHHeroCard__top">
              <div>
                <div class="lcHHeroCard__kicker">שלב 8 · הצהרת בריאות</div>
                <div class="lcHHeroCard__title">${escapeHtml(item.catTitle)}</div>
                <div class="lcHHeroCard__summary">${escapeHtml(item.catSummary || '')}</div>
              </div>
              <div class="lcHHeroCard__step">שאלה ${idx+1} / ${list.length}</div>
            </div>
            <div class="lcHCategoryRail">${this.getHealthQuestionsFiltered().map((cat, cidx) => `<button type="button" class="lcHCatPill ${cidx===catIndex ? 'is-active' : ''}" data-hgoto-cat="${cidx}">${escapeHtml(cat.title)}</button>`).join('')}</div>
          </div>
          <div class="lcHQuestionCard">
            <div class="lcHQuestionCard__head">
              <div>
                <div class="lcHQuestionCard__eyebrow">שאלה משותפת לכל המבוטחים</div>
                <div class="lcHQuestionCard__title">${escapeHtml(q.text)}</div>
              </div>
              <div class="lcHCompanies">${(q.companies || companies).filter(c => companies.length ? companies.includes(c) : true).map(c => `<span class="lcHChip">${escapeHtml(c)}</span>`).join('')}</div>
            </div>
            <div class="lcHQuestionCard__body">${matrix}</div>
            <div class="lcHNavRow">
              <button type="button" class="btn" data-hnav="prev" ${idx <= 0 ? 'disabled' : ''}>הקודם</button>
              <button type="button" class="btn btn--primary" data-hnav="next">${idx >= list.length - 1 ? 'כרטיס סיכום' : 'השאלה הבאה'}</button>
            </div>
          </div>
        </div>
      </div>`;
    },

    bindHealthInputs(){
      const store = this.getHealthStore();
      $$('[data-hans]', this.els.body).forEach(btn => {
        on(btn, 'click', () => {
          const [qKey, insId, ans] = String(btn.getAttribute('data-hans') || '').split('|');
          if(!qKey || !insId || !ans) return;
          if(ans === 'no'){
            this.setHealthResponse(qKey, insId, { answer:'no', fields:{}, saved:false });
          }else{
            const prev = this.getHealthResponse(qKey, insId);
            this.setHealthResponse(qKey, insId, { answer:'yes', saved:false, fields: prev.fields || {} });
          }
          this.render();
        });
      });
      $$('[data-hfield]', this.els.body).forEach(el => {
        const save = () => {
          const [qKey, insId, fieldKey] = String(el.getAttribute('data-hfield') || '').split('|');
          if(!qKey || !insId || !fieldKey) return;
          const prev = this.getHealthResponse(qKey, insId);
          const fields = { ...(prev.fields || {}) };
          fields[fieldKey] = safeTrim(el.value);
          this.setHealthResponse(qKey, insId, { fields, saved:false, answer:'yes' });
        };
        on(el, 'input', save);
        on(el, 'change', save);
      });
      $$('[data-hsave]', this.els.body).forEach(btn => {
        on(btn, 'click', () => {
          const [qKey, insId] = String(btn.getAttribute('data-hsave') || '').split('|');
          if(!qKey || !insId) return;
          const item = this.getHealthQuestionList().find(x => x.question.key === qKey);
          if(!item) return;
          if(!this.validateHealthDetail(item.question, insId)){
            this.setHint('נא למלא את כל שדות התת־שאלון לפני שמירה');
            return;
          }
          this.setHealthResponse(qKey, insId, { saved:true, answer:'yes' });
          this.setHint('הפירוט נשמר');
          this.render();
        });
      });
      $$('[data-hedit]', this.els.body).forEach(btn => {
        on(btn, 'click', () => {
          const [qKey, insId] = String(btn.getAttribute('data-hedit') || '').split('|');
          if(!qKey || !insId) return;
          this.setHealthResponse(qKey, insId, { saved:false, answer:'yes' });
          this.render();
        });
      });
      $$('[data-hclear]', this.els.body).forEach(btn => {
        on(btn, 'click', () => {
          const [qKey, insId] = String(btn.getAttribute('data-hclear') || '').split('|');
          if(!qKey || !insId) return;
          this.setHealthResponse(qKey, insId, { answer:'', fields:{}, saved:false });
          this.render();
        });
      });
      $$('[data-hgoto-cat]', this.els.body).forEach(btn => {
        on(btn, 'click', () => {
          const cats = this.getHealthQuestionsFiltered();
          const idx = Number(btn.getAttribute('data-hgoto-cat') || '0');
          const cat = cats[idx];
          if(!cat) return;
          const list = this.getHealthQuestionList();
          const firstIndex = list.findIndex(x => x.catKey === cat.key);
          if(firstIndex >= 0){ store.ui.currentIndex = firstIndex; store.ui.summary = false; this.render(); }
        });
      });
      $$('[data-health-open-findings]', this.els.body).forEach(btn => {
        on(btn, 'click', () => {
          const insId = String(btn.getAttribute('data-health-open-findings') || '');
          if(!insId) return;
          this.openHealthFindingsModal(insId);
        });
      });
      $$('[data-hnav]', this.els.body).forEach(btn => {
        on(btn, 'click', () => {
          const dir = String(btn.getAttribute('data-hnav') || '');
          const list = this.getHealthQuestionList();
          const idx = Math.max(0, Math.min(list.length - 1, Number(store.ui.currentIndex || 0)));
          if(dir === 'prev'){
            store.ui.summary = false;
            store.ui.currentIndex = Math.max(0, idx - 1);
          }else if(dir === 'next'){
            if(idx >= list.length - 1) store.ui.summary = true;
            else { store.ui.summary = false; store.ui.currentIndex = idx + 1; }
          }
          this.render();
        });
      });
    },

    getHealthBlockingIssue(){
      const list = this.getHealthQuestionList();
      if(!list.length) return { ok:false, msg:'אין שאלות הצהרת בריאות להצגה. בחר פוליסה רלוונטית בשלב 5.' };
      for(const item of list){
        for(const ins of this.insureds){
          const r = this.getHealthResponse(item.question.key, ins.id);
          if(r.answer !== 'yes' && r.answer !== 'no'){
            return { ok:false, msg:`חסרה תשובה בהצהרת הבריאות עבור ${ins.label}` };
          }
          if(r.answer === 'yes'){
            if(!this.validateHealthDetail(item.question, ins.id)){
              return { ok:false, msg:`יש להשלים את כל שדות התת־שאלון עבור ${ins.label}` };
            }
            if(!r.saved){
              return { ok:false, msg:`יש לשמור את פירוט השאלה עבור ${ins.label}` };
            }
          }
        }
      }
      return { ok:true };
    },

    getDraftPayload(){
      const primary = this.insureds[0] || { data:{} };
      return {
        savedAt: nowISO(),
        currentStep: this.step || 1,
        activeInsId: this.activeInsId || (this.insureds[0]?.id || null),
        insureds: JSON.parse(JSON.stringify(this.insureds || [])),
        newPolicies: JSON.parse(JSON.stringify(this.newPolicies || [])),
        companyAgentNumbers: JSON.parse(JSON.stringify(this.getOperationalAgentNumbers() || {})),
        operational: {
          createdAt: nowISO(),
          insureds: this.insureds.map(ins => ({ label: ins.label, type: ins.type, data: JSON.parse(JSON.stringify(ins.data || {})) })),
          newPolicies: JSON.parse(JSON.stringify(this.newPolicies || [])),
          companyAgentNumbers: JSON.parse(JSON.stringify(this.getOperationalAgentNumbers() || {})),
          primary: JSON.parse(JSON.stringify(primary.data || {}))
        }
      };
    },

    openDraft(rec){
      if(!rec) return;
      this.loadDraftData(rec);
      this.open();
      this.setHint("ההצעה נטענה מהמקום שבו נשמרה");
    },

    loadDraftData(rec){
      const payload = rec?.payload || {};
      const insureds = Array.isArray(payload.insureds) ? JSON.parse(JSON.stringify(payload.insureds)) : [];
      this.insureds = insureds.length ? insureds : [{
        id: "ins_" + Math.random().toString(16).slice(2),
        type: "primary",
        label: "מבוטח ראשי",
        data: {}
      }];
      this.newPolicies = Array.isArray(payload.newPolicies) ? JSON.parse(JSON.stringify(payload.newPolicies)) : [];
      this.activeInsId = payload.activeInsId && this.insureds.some(x => String(x.id) === String(payload.activeInsId)) ? payload.activeInsId : (this.insureds[0]?.id || null);
      this.step = Math.max(1, Math.min(this.steps.length, Number(rec?.currentStep || payload.currentStep || 1) || 1));
      this.policyDraft = null;
      this.editingPolicyId = null;
      this.lastSavedCustomerId = null;
      this.editingDraftId = rec?.id || null;
      this._finishing = false;
      this.render();
    },

    async saveDraft(){
      if(!Auth.current) return;
      const payload = this.getDraftPayload();
      const primary = payload?.operational?.primary || {};
      const record = normalizeProposalRecord({
        id: this.editingDraftId || ("prop_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2,8)),
        status: "פתוחה",
        fullName: safeTrim(((primary.firstName || "") + " " + (primary.lastName || "")).trim()) || "הצעה ללא שם",
        idNumber: safeTrim(primary.idNumber),
        phone: safeTrim(primary.phone),
        email: safeTrim(primary.email),
        city: safeTrim(primary.city),
        agentName: safeTrim(Auth?.current?.name),
        agentRole: safeTrim(Auth?.current?.role),
        createdAt: (() => {
          if(this.editingDraftId){
            const existing = (State.data?.proposals || []).find(x => String(x.id) === String(this.editingDraftId));
            if(existing?.createdAt) return existing.createdAt;
          }
          return nowISO();
        })(),
        updatedAt: nowISO(),
        currentStep: this.step || 1,
        insuredCount: (payload.insureds || []).length,
        payload
      });

      State.data.proposals = Array.isArray(State.data.proposals) ? State.data.proposals : [];
      const idx = State.data.proposals.findIndex(x => String(x.id) === String(record.id));
      if(idx >= 0) State.data.proposals[idx] = record;
      else State.data.proposals.unshift(record);
      this.editingDraftId = record.id;
      State.data.meta.updatedAt = nowISO();
      const persistRes = await App.persist("ההצעה נשמרה");
      ProposalsUI.render();
      if(persistRes?.ok){
        this.setHint("ההצעה נשמרה ותופיע במסך הצעות להמשך עריכה");
      }else{
        this.setHint("ההצעה נשמרה מקומית בלבד. בדוק חיבור ל-Supabase כדי שתופיע גם ממחשב אחר.");
      }
    },

    getOperationalAgentNumbers(){
      const primary = this.insureds[0] || { data:{} };
      primary.data = primary.data || {};
      if(!primary.data.operationalAgentNumbers || typeof primary.data.operationalAgentNumbers !== "object"){
        primary.data.operationalAgentNumbers = {};
      }
      return primary.data.operationalAgentNumbers;
    },

    getOperationalCompanyList(){
      const seen = new Set();
      const out = [];
      (this.newPolicies || []).forEach(policy => {
        const company = safeTrim(policy?.company);
        if(!company || seen.has(company)) return;
        seen.add(company);
        out.push(company);
      });
      return out;
    },

    getOperationalPayload(){
      const primary = this.insureds[0] || { data:{} };
      return {
        createdAt: nowISO(),
        insureds: this.insureds.map(ins => ({ label: ins.label, type: ins.type, data: JSON.parse(JSON.stringify(ins.data || {})) })),
        newPolicies: JSON.parse(JSON.stringify(this.newPolicies || [])),
        companyAgentNumbers: JSON.parse(JSON.stringify(this.getOperationalAgentNumbers() || {})),
        primary: JSON.parse(JSON.stringify(primary.data || {}))
      };
    },

    compactReportFields(obj, keys){
      return keys.map(([k,label]) => `<div class="lcReportField"><b>${escapeHtml(label)}</b><div class="lcReportValue">${this.renderReportValue(obj?.[k])}</div></div>`).join('');
    },

    renderReportValue(v){
      if(v === null || v === undefined) return '—';
      const s = safeTrim(v);
      return s ? escapeHtml(s) : '—';
    },

    renderTable(headers, rows){
      if(!rows.length) return `<div class="muted">אין נתונים להצגה.</div>`;
      return `<div class="lcReportTableWrap"><table class="lcReportTable"><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    },

    normalizeOperationalReportPayload(rawPayload){
      const payload = rawPayload && typeof rawPayload === 'object' ? JSON.parse(JSON.stringify(rawPayload)) : {};
      if((!Array.isArray(payload.insureds) || !payload.insureds.length) && Array.isArray(payload?.operational?.insureds)){
        payload.insureds = JSON.parse(JSON.stringify(payload.operational.insureds));
      }
      if((!Array.isArray(payload.newPolicies) || !payload.newPolicies.length) && Array.isArray(payload?.operational?.newPolicies)){
        payload.newPolicies = JSON.parse(JSON.stringify(payload.operational.newPolicies));
      }
      payload.insureds = Array.isArray(payload.insureds) ? payload.insureds : [];
      payload.newPolicies = Array.isArray(payload.newPolicies) ? payload.newPolicies : [];
      payload.primary = (payload.primary && typeof payload.primary === 'object')
        ? payload.primary
        : (payload.insureds[0]?.data && typeof payload.insureds[0].data === 'object' ? payload.insureds[0].data : {});
      payload.companyAgentNumbers = (payload.companyAgentNumbers && typeof payload.companyAgentNumbers === 'object')
        ? payload.companyAgentNumbers
        : (payload.operational?.companyAgentNumbers && typeof payload.operational.companyAgentNumbers === 'object'
            ? payload.operational.companyAgentNumbers
            : (payload.primary?.operationalAgentNumbers && typeof payload.primary.operationalAgentNumbers === 'object'
                ? payload.primary.operationalAgentNumbers
                : {}));
      payload.createdAt = safeTrim(payload.createdAt) || safeTrim(payload.updatedAt) || nowISO();
      return payload;
    },

    buildHealthItemsFromPayload(payload){
      const healthItems = [];
      const primary = payload?.primary && typeof payload.primary === 'object' ? payload.primary : {};
      const healthDeclaration = primary?.healthDeclaration && typeof primary.healthDeclaration === 'object'
        ? primary.healthDeclaration
        : {};
      const responses = healthDeclaration?.responses && typeof healthDeclaration.responses === 'object'
        ? healthDeclaration.responses
        : {};
      const questionMap = new Map();
      this.getHealthQuestionList().forEach(item => questionMap.set(item.question.key, item.question));
      (payload.insureds || []).forEach((ins, index) => {
        const insData = ins?.data && typeof ins.data === 'object' ? ins.data : {};
        const insId = safeTrim(ins?.id) || safeTrim(insData?.id) || `payload_ins_${index}`;
        Object.entries(responses).forEach(([qKey, byIns]) => {
          const block = byIns && typeof byIns === 'object' ? byIns : {};
          const answer = block[insId];
          if(!answer || answer.answer !== 'yes') return;
          const question = questionMap.get(qKey);
          const questionText = question?.text || qKey;
          healthItems.push(`<div class="lcReportListItem"><strong>${escapeHtml(ins?.label || ('מבוטח ' + (index + 1)))} · ${escapeHtml(questionText)}</strong><span>${escapeHtml(this.summarizeHealthFields(answer.fields || {}))}</span></div>`);
        });
      });
      return healthItems;
    },

    renderOperationalReport(payloadOverride){
      const payload = this.normalizeOperationalReportPayload(payloadOverride || this.getOperationalPayload());
      const primary = payload.primary || {};
      const insuredRows = payload.insureds.map(ins => {
        const d = ins?.data && typeof ins.data === 'object' ? ins.data : {};
        return [
          escapeHtml(ins?.label || ''),
          this.renderReportValue((d.firstName || '') + ' ' + (d.lastName || '')),
          this.renderReportValue(d.idNumber),
          this.renderReportValue(d.birthDate),
          this.renderReportValue(d.phone)
        ];
      });
      const existingRows = [];
      payload.insureds.forEach(ins => {
        const insData = ins?.data && typeof ins.data === 'object' ? ins.data : {};
        const existingPolicies = Array.isArray(insData.existingPolicies) ? insData.existingPolicies : [];
        existingPolicies.forEach(p => existingRows.push([
          escapeHtml(ins?.label || ''), this.renderReportValue(p?.company), this.renderReportValue(p?.type), this.renderReportValue(p?.policyNumber), this.renderReportValue(p?.monthlyPremium)
        ]));
      });
      const cancelRows = [];
      payload.insureds.forEach(ins => {
        const insData = ins?.data && typeof ins.data === 'object' ? ins.data : {};
        const canc = insData?.cancellations && typeof insData.cancellations === 'object' ? insData.cancellations : {};
        const existingPolicies = Array.isArray(insData.existingPolicies) ? insData.existingPolicies : [];
        existingPolicies.forEach(p => {
          const c = canc[p?.id] || {};
          if(safeTrim(c.status) || safeTrim(c.reason)) cancelRows.push([
            escapeHtml(ins?.label || ''), this.renderReportValue(p?.company), this.renderReportValue(p?.type), this.renderReportValue(c?.status), this.renderReportValue(c?.reason)
          ]);
        });
      });
      const newRows = (payload.newPolicies || []).map(p => [this.renderReportValue(p?.company), this.renderReportValue(p?.type), this.renderReportValue(p?.premiumMonthly), this.renderReportValue(`${safeTrim(p?.discountPct || "0")}%`), this.renderReportValue(this.formatMoneyValue(this.getPolicyPremiumAfterDiscount(p || {}))), this.renderReportValue(p?.startDate)]);
      const agentNumberRows = Object.entries(payload.companyAgentNumbers || {}).map(([company, agentNo]) => [
        this.renderReportValue(company),
        this.renderReportValue(agentNo)
      ]);
      const healthItems = this.buildHealthItemsFromPayload(payload);
      const payerFields = [];
      if(primary.payerChoice === 'external'){
        const ex = primary.externalPayer || {};
        const anyEx = ['relation','firstName','lastName','idNumber','birthDate','phone'].some(k => safeTrim(ex[k]));
        if(anyEx){
          payerFields.push(`<div class="lcReportGrid">${this.compactReportFields(ex, [['relation','קרבה'],['firstName','שם פרטי'],['lastName','שם משפחה'],['idNumber','תעודת זהות'],['birthDate','תאריך לידה'],['phone','טלפון']])}</div>`);
        }
      }
      const payMethod = safeTrim(primary.paymentMethod);
      if(payMethod === 'cc'){
        const cc = primary.cc || {};
        if(['holderName','holderId','cardNumber','exp'].some(k => safeTrim(cc[k]))){
          payerFields.push(`<div class="lcReportGrid">${this.compactReportFields(cc, [['holderName','שם מחזיק'],['holderId','תז מחזיק'],['cardNumber','מספר כרטיס'],['exp','תוקף']])}</div>`);
        }
      } else if(payMethod === 'ho'){
        const ho = primary.ho || {};
        if(['bankName','bankNo','branch','account'].some(k => safeTrim(ho[k]))){
          payerFields.push(`<div class="lcReportGrid">${this.compactReportFields(ho, [['bankName','שם בנק'],['bankNo','מספר בנק'],['branch','סניף'],['account','מספר חשבון']])}</div>`);
        }
      }
      const ts = new Date(payload.createdAt).toLocaleString('he-IL');
      return `<div class="lcReportDoc">
        <div class="lcReportHero">
          <div class="lcReportCard"><div class="lcReportSection__title">דוח תפעולי מלא</div><div class="lcReportSection__sub">הדוח מציג את כל הנתונים שהוזנו בהקמת הלקוח, בצורה מרוכזת ומוכנה למחלקת תפעול.</div><div class="lcReportMeta"><div class="lcReportMetaItem"><b>מבוטח ראשי</b><span>${this.renderReportValue((primary.firstName||'') + ' ' + (primary.lastName||''))}</span></div><div class="lcReportMetaItem"><b>תעודת זהות</b><span>${this.renderReportValue(primary.idNumber)}</span></div><div class="lcReportMetaItem"><b>מספר מבוטחים</b><span>${payload.insureds.length}</span></div><div class="lcReportMetaItem"><b>הופק בתאריך</b><span>${escapeHtml(ts)}</span></div></div></div>
          <div class="lcReportCard"><div class="lcReportMeta"><div class="lcReportMetaItem"><b>פוליסות קיימות</b><span>${existingRows.length}</span></div><div class="lcReportMetaItem"><b>פוליסות חדשות</b><span>${newRows.length}</span></div><div class="lcReportMetaItem"><b>סוג משלם</b><span>${this.renderReportValue(primary.payerChoice === 'external' ? 'משלם חריג' : primary.payerChoice === 'insured' ? 'מבוטח קיים' : '')}</span></div><div class="lcReportMetaItem"><b>אמצעי תשלום</b><span>${this.renderReportValue(payMethod === 'cc' ? 'כרטיס אשראי' : payMethod === 'ho' ? 'הוראת קבע' : '')}</span></div></div></div>
        </div>
        <section class="lcReportSection"><div class="lcReportSection__title">פרטי לקוח</div><div class="lcReportGrid">${this.compactReportFields(primary, [['firstName','שם פרטי'],['lastName','שם משפחה'],['idNumber','תעודת זהות'],['birthDate','תאריך לידה'],['gender','מגדר'],['maritalStatus','מצב משפחתי'],['phone','טלפון'],['email','אימייל'],['city','עיר'],['street','רחוב'],['houseNumber','מספר בית'],['zip','מיקוד'],['clinic','קופת חולים'],['shaban','שב״ן'],['occupation','עיסוק'],['heightCm','גובה'],['weightKg','משקל'],['bmi','BMI']])}</div></section>
        <section class="lcReportSection"><div class="lcReportSection__title">מבוטחים</div>${this.renderTable(['סוג מבוטח','שם מלא','תעודת זהות','תאריך לידה','טלפון'], insuredRows)}</section>
        <section class="lcReportSection"><div class="lcReportSection__title">פוליסות קיימות</div>${this.renderTable(['מבוטח','חברה','סוג ביטוח','מספר פוליסה','פרמיה חודשית'], existingRows)}</section>
        <section class="lcReportSection"><div class="lcReportSection__title">ביטול בחברה נגדית</div>${this.renderTable(['מבוטח','חברה','סוג ביטוח','סטטוס','סיבה'], cancelRows)}</section>
        <section class="lcReportSection"><div class="lcReportSection__title">פוליסות חדשות</div>${this.renderTable(['חברה','סוג ביטוח','פרמיה חודשית','אחוז הנחה','פרמיה אחרי הנחה','תאריך תחילה'], newRows)}</section>
        <section class="lcReportSection"><div class="lcReportSection__title">מספרי סוכן לחברות שנמכרו</div>${this.renderTable(['חברה','מספר סוכן'], agentNumberRows)}</section>
        ${payerFields.length ? `<section class="lcReportSection"><div class="lcReportSection__title">פרטי תשלום / משלם</div><div class="lcReportStack">${payerFields.join('')}</div></section>` : ''}
        <section class="lcReportSection"><div class="lcReportSection__title">הצהרת בריאות</div><div class="lcReportSection__sub">מופיעים רק ממצאים שסומנו כ"כן" ונשמרו במלואם.</div><div class="lcReportList">${healthItems.length ? healthItems.join('') : '<div class="muted">לא סומנו ממצאים רפואיים.</div>'}</div></section>
      </div>`;
    },

    openOperationalReport(payloadOverride){
      if(!this.els.report || !this.els.reportBody) return;
      try{
        this.els.reportBody.innerHTML = this.renderOperationalReport(payloadOverride);
      }catch(err){
        console.error('openOperationalReport failed', err);
        this.els.reportBody.innerHTML = `<div class="lcReportDoc"><section class="lcReportSection"><div class="lcReportSection__title">לא ניתן לפתוח את הדוח כרגע</div><div class="lcReportSection__sub">אירעה שגיאה בעת בניית הדוח התפעולי. בדוק שהלקוח נשמר עם כל הנתונים ונסה שוב.</div><div class="lcReportList"><div class="lcReportListItem"><strong>פירוט</strong><span>${escapeHtml(err?.message || 'שגיאה לא ידועה')}</span></div></div></section></div>`;
      }
      this.els.report.classList.add('is-open');
      this.els.report.setAttribute('aria-hidden','false');
    },

    closeOperationalReport(){
      if(!this.els.report) return;
      this.els.report.classList.remove('is-open');
      this.els.report.setAttribute('aria-hidden','true');
    },

    exportOperationalPdf(){
      this.openOperationalReport();
      window.print();
    },

    showFinishFlow(){
      if(!this.els.flow) return;
      this.els.flow.classList.add('is-open');
      this.els.flow.setAttribute('aria-hidden','false');
      if(this.els.flowLoading) this.els.flowLoading.style.display = '';
      if(this.els.flowSuccess) this.els.flowSuccess.style.display = 'none';
      if(this.els.flowProgress) this.els.flowProgress.style.width = '0%';
      setTimeout(() => { if(this.els.flowProgress) this.els.flowProgress.style.width = '100%'; }, 80);
      setTimeout(() => {
        if(this.els.flowLoading) this.els.flowLoading.style.display = 'none';
        if(this.els.flowSuccess) this.els.flowSuccess.style.display = '';
      }, 5200);
    },

    hideFinishFlow(){
      if(!this.els.flow) return;
      this.els.flow.classList.remove('is-open');
      this.els.flow.setAttribute('aria-hidden','true');
    },

    async finishWizard(){
      if(this._finishing) return;
      const v = this.validateStep(9);
      if(!v.ok){
        this.setHint(v.msg || 'לא ניתן לסיים לפני השלמה מלאה של כל השלבים');
        this.step = 9;
        this.render();
        return;
      }
      this._finishing = true;
      this.setHint("");
      this.showFinishFlow();
      try{
        const saved = await this.saveCompletedCustomer();
        this.lastSavedCustomerId = saved?.id || null;
        CustomersUI.render();
        ProposalsUI.render();
      }catch(err){
        console.error("FINISH_WIZARD_SAVE_ERROR", err);
        this.hideFinishFlow();
        this.setHint("שמירת הלקוח נכשלה. בדוק חיבור ל-Supabase ונסה שוב.");
        return;
      }finally{
        this._finishing = false;
      }
    },

    async saveCompletedCustomer(){
      const payload = this.getOperationalPayload();
      const primary = payload?.primary || {};
      const record = normalizeCustomerRecord({
        id: "cust_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2,8),
        status: "חדש",
        fullName: safeTrim(((primary.firstName || "") + " " + (primary.lastName || "")).trim()) || "לקוח ללא שם",
        idNumber: safeTrim(primary.idNumber),
        phone: safeTrim(primary.phone),
        email: safeTrim(primary.email),
        city: safeTrim(primary.city),
        agentName: safeTrim(Auth?.current?.name),
        agentRole: safeTrim(Auth?.current?.role),
        createdAt: nowISO(),
        updatedAt: nowISO(),
        insuredCount: (payload.insureds || []).length,
        existingPoliciesCount: (payload.insureds || []).reduce((acc, ins) => acc + ((ins?.data?.existingPolicies || []).length), 0),
        newPoliciesCount: (payload.newPolicies || []).length,
        payload
      });

      State.data.customers = Array.isArray(State.data.customers) ? State.data.customers : [];
      const sameIndex = State.data.customers.findIndex(x =>
        safeTrim(x.idNumber) && safeTrim(x.idNumber) === record.idNumber &&
        Math.abs(new Date(x.createdAt).getTime() - new Date(record.createdAt).getTime()) < 5 * 60 * 1000
      );
      if(sameIndex >= 0){
        State.data.customers[sameIndex] = {
          ...State.data.customers[sameIndex],
          ...record,
          createdAt: State.data.customers[sameIndex].createdAt || record.createdAt
        };
      }else{
        State.data.customers.unshift(record);
      }
      State.data.proposals = Array.isArray(State.data.proposals) ? State.data.proposals : [];
      if(this.editingDraftId){
        State.data.proposals = State.data.proposals.filter(x => String(x.id) !== String(this.editingDraftId));
        this.editingDraftId = null;
      }
      State.data.meta.updatedAt = nowISO();
      await App.persist("הלקוח נשמר");
      return record;
    },

    stepCompletionMap(stepId){
      const map = {};
      this.insureds.forEach(ins => { map[ins.id] = this.isStepCompleteForInsured(stepId, ins); });
      return map;
    },

    validateStep(stepId){
      // Step 5: new policies (case-level)
      if(stepId === 5){
        const res = this.validateStep5();
        return res;
      }
      // Step 6: payer (case-level, stored on primary insured)
      if(stepId === 6){
        const primary = this.insureds[0];
        const ok = this.isStepCompleteForInsured(6, primary);
        return ok ? {ok:true} : {ok:false, msg:"חסר מילוי חובה בפרטי משלם"};
      }
      if(stepId === 7){
        return { ok:true };
      }
      if(stepId === 8){
        return this.getHealthBlockingIssue();
      }
      if(stepId === 9){
        const companies = this.getOperationalCompanyList();
        if(!companies.length) return { ok:true };
        const map = this.getOperationalAgentNumbers();
        const missing = companies.filter(company => !safeTrim(map?.[company]));
        if(missing.length){
          return { ok:false, msg: "יש למלא מספר סוכן עבור: " + missing.join(", ") };
        }
        return { ok:true };
      }

      const bad = this.insureds.filter(ins => !this.isStepCompleteForInsured(stepId, ins));
      if(!bad.length) return { ok:true };
      const names = bad.map(x => x.label).join(", ");
      return { ok:false, msg: "חסר מילוי חובה עבור: " + names };
    },

    isStepCompleteForInsured(stepId, ins){
      const d = ins.data || {};
      if(stepId === 1){
        const baseReq = ["firstName","lastName","idNumber","birthDate","gender"];
        const childReq = baseReq.concat(["clinic","shaban"]);
        const adultReq = baseReq.concat(["phone","email","city","street","houseNumber","clinic","shaban","occupation"]);
        const req = (ins.type === "child") ? childReq : adultReq;

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
        // Existing policies: every opened row must include monthly premium (0 allowed).
        // Additionally: if a risk policy has pledge -> bank is required; if via bank agency -> agency required.
        const list = d.existingPolicies || [];
        for(const p of list){
          if(safeTrim(p.monthlyPremium) === "") return false;
        }
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
        // new policies: if exists, must have company, type, premiumBefore >0, discountPct >=0
        const list = d.newPolicies || [];
        for(const p of list){
          if(!safeTrim(p.company) || !safeTrim(p.type)) return false;
          if(!(Number(p.premiumBefore) > 0)) return false;
          if(Number(p.discountPct) < 0) return false;
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

      const has = !(ins.data.bmi === null || ins.data.bmi === undefined || ins.data.bmi === "");
      const v = has ? String(ins.data.bmi) : "—";

      const cardEl = body.querySelector('[data-bmi="card"]');
      if(cardEl) cardEl.classList.toggle("is-empty", !has);

      const valEl = body.querySelector('[data-bmi="value"]');
      if(valEl){
        // supports both <input> and <div>
        if("value" in valEl) valEl.value = v;
        else valEl.textContent = v;
      }

      const st = this.bmiStatus(ins.data.bmi);
      const lampEl = body.querySelector('[data-bmi="lamp"]');
      if(lampEl){
        lampEl.classList.remove("green","yellow","red");
        if(st.lamp) lampEl.classList.add(st.lamp);
      }

      const labelEl = body.querySelector('[data-bmi="label"]');
      if(labelEl) labelEl.textContent = has ? (st.label || "—") : "מלא גובה ומשקל";
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



  // ---------- Mirrors UI (Ops only) ----------
const MIRROR_DISCLOSURE_LIBRARY = {
  "הפניקס": {
    "meds": {
      "label": "תרופות מחוץ לסל",
      "text": "פוליסת ביטוח בריאות מסוג ___________ שאותה אנו ממליצים לך לרכוש,כוללת את הכיסויים הבאים:\nכיסוי של עד ₪ 3,000,000לתקופה של שנתיים בשל כל מקרי הביטוח לתרופות שאינן כלולות בסל הבריאות,או תרופות הכלולות בסל\nהבריאות,אך לא להתוויה הרפואית המוגדרת לטיפול במצבו הרפואי של המבוטח,תרופות OFF- LABLE,תרופות יתום,עד לסך השיפוי\nהמירבי של ₪ 1,000,000לתקופה של שנתיים בשל כל מקרי הביטוח ולא יותר מ ₪ 200,000בחודש.עד 40,000-שקלים חדשים לכל תרופות שאינן בסל\nמקרה ביטוח.תקרת הכיסוי צמודה למדד מחירי הצרכן.הפוליסה מתחדשת כל שנתיים ותקפה לכל החיים.הפרמיה החודשית משתנה הבריאות-סל הזהב\nבהתאם לקבוצת גיל ומתקבעת בגיל. 66בכיסוי הנ\"ל קיימת תקופת אכשרה בת 90יום וכן החרגות לכיסוי הביטוחי,החרגות בגין מצב\nרפואי קיים,הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.כיסוי זה הינו כיסוי בסיס."
    },
    "transplants": {
      "label": "השתלות וטיפולים מיוחדים בחו\"ל",
      "text": "כיסוי בגין הוצאות רפואיות ונלוות הקשורות בהשתלה,או לטיפולים מיוחדים בחו\"ל,לרבות הוצאות לצוות הרפואי,הוצאות טיסה ושהייה,\nוגמלת החלמה עפ\"י תנאי הפוליסה.במקרה של השתלה -אפשרות למסלול חלופי של פיצוי חד פעמי כמפורט בנספח.השתלות איברים בריאות\nמגוף אדם -כיסוי מלא ללא תקרה אצל נותן שירות שבהסכם.השתלות איברים מבעלי חיים -כיסוי עד.₪ 3,000,000הוצאות איתור תורם,\nהשתלות וטיפולים מוצרי\nהוצאות אשפוז ועוד.תקרת הכיסוי צמודה למדד מחירי הצרכן.הפוליסה מתחדשת כל שנתיים ותקפה לכל החיים.הפרמיה החודשית\nמיוחדים בחו\"ל בסיס\nמשתנה בהתאם לקבוצת גיל ומתקבעת בגיל. 66בכיסוי הנ\"ל קיימת תקופת אכשרה בת 90יום וכן החרגות לכיסוי הביטוחי,החרגות בגין\nמצב רפואי קיים,הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.כיסוי זה הינו כיסוי בסיס."
    },
    "surgeries_abroad": {
      "label": "ניתוחים וטיפולים מחליפי ניתוח בחו\"ל",
      "text": "כיסוי בישראל להוצאות רפואיות הקשורות בניתוח,החזר הוצאות רפואיות בגין ניתוח מחוץ לישראל וטיפול מחליף ניתוח מחוץ לישראל\nלרבות החזר הוצאות נלוות וכן הוצאות נוספות בגין ניתוח מורכב.שיפוי עבור הוצאות רפואיות בביצוע ניתוח בחו\"ל,וכן להוצאות נוספות,בין\nהיתר עבור הבאת מומחה לביצוע ניתוח בישראל,הטסה רפואית,התייעצות לפני ניתוח ועוד.תקרת הכיסוי צמודה למדד מחירי הצרכן. ניתוחים וטיפולים\nהפוליסה מתחדשת כל שנתיים ותקפה לכל החיים.הפרמיה החודשית משתנה בהתאם לקבוצת גיל ומתקבעת בגיל. 66בכיסוי הנ\"ל קיימת מחליפי ניתוח בחו\"ל\nתקופת אכשרה בת 90יום וכן החרגות לכיסוי הביטוחי,החרגות בגין מצב רפואי קיים,הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן\nהכיסויים.כיסוי זה הינו כיסוי בסיס"
    },
    "surgeries_israel": {
      "label": "ניתוחים בארץ",
      "text": "אני מבקש לציין בפניך כי פוליסת הבריאות הבסיסית אינה כוללת כיסוי ביטוחי בגין ביצוע ניתוחים פרטיים בישראל,\nלאחר צירוף לפוליסה בריאות בסיסית בין היתר,מכיוון שכיסוי לניתוחים בישראל ניתן במסגרת השב\"ן\".\nיש להבהיר למועמד:\nכיסוי מעל הזכאות בתכנית השב\"ן )שירותי בריאות נוספים( בגין הוצאות רפואיות בישראל הקשורות בניתוח,התייעצות וטיפול מחליף ניתוח\nניתוחים וטיפולים מחליפי שבוצעו בישראל -כלומר על המבוטח לפנות קודם לקופת החולים למימוש זכויותיו על פי השב\"ן ולאחר מכן לפנות למבטח.החברה תחזיר\nלמבוטח את ההשתתפות העצמית ששילם בשב\"ן או את ההפרש שבין ההוצאות בפועל של הניתוח המכוסה על פי התכנית לבין ההוצאות ניתוח בישראל -\n(ניתוחים משלים שב\"ן עם המגיעות מהשב\"ן וזאת עד התקרה הקבועה בתכנית,לפי העניין.במקרה בו תכנית השב\"ן אינה משתתפת במימון ההוצאות לכלל העמיתים\nבשב\"ן הכיסוי יהיה בניכוי השתתפות עצמית בגובה ₪ 5,000ובלבד שבוצע בהסדר ניתוח כהגדרתו בתכנית.הפוליסה מתחדשת כל\nהשתתפות עצמית של 5,000\nשנתיים ותקפה לכל החיים.הפרמיה החודשית משתנה בהתאם לקבוצת גיל ומתקבעת בגיל. 66בכיסוי הנ\"ל קיימת תקופת אכשרה בת 90\n)₪\nיום וכן החרגות לכיסוי הביטוחי,החרגות בגין מצב רפואי קיים,הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.\nכיסוי מעל הזכאות בתכנית השב\"ן בגין הוצאות רפואיות בישראל הקשורות בניתוח,התייעצות וטיפול מחליף ניתוח שבוצעו בישראל -כלומר\nעל המבוטח לפנות קודם לקופת החולים למימוש זכויותיו על פי השב\"ן ולאחר מכן לפנות למבטח.החברה תחזיר למבוטח את ההשתתפות\nהעצמית ששילם בשב\"ן או את ההפרש שבין ההוצאות בפועל של הניתוח המכוסה על פי התכנית לבין ההוצאות המגיעות מהשב\"ן וזאת עד ביטוח משלים שב\"ן\nלניתוחים וטיפולים מחליפי התקרה הקבועה בתכנית,לפי העניין.במקרה בו תכנית השב\"ן אינה משתתפת במימון ההוצאות לכלל העמיתים בשב\"ן הכיסוי יהיה ללא\nתקרה ובלבד שבוצע בהסדר ניתוח כהגדרתו בתכנית.\nניתוח בישראל ללא השתתפות\nתקרת הכיסוי צמודה למדד מחירי הצרכן.הפוליסה מתחדשת כל שנתיים ותקפה לכל החיים.הפרמיה החודשית משתנה בהתאם לקבוצת\nעצמית\nגיל ומתקבעת בגיל. 66בכיסוי הנ\"ל קיימת תקופת אכשרה בת 90יום וכן החרגות לכיסוי הביטוחי,החרגות בגין מצב רפואי קיים,הגבלות\nלסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.\nהוצאות רפואיות בישראל הקשורות בניתוח,התייעצות וטיפול מחליף ניתוח שבוצעו בישראל,התייעצות עם רופא מומחה בישראל אגב\nניתוח/טיפול מחליף ניתוח בישראל,שכר מנתח בישראל,הוצאות ניתוח בבית חולים פרטי או במרפאה כירורגית פרטית בישראל.תקרת ניתוחים וטיפולים\nהכיסוי צמודה למדד מחירי הצרכן.הפוליסה מתחדשת כל שנתיים ותקפה לכל החיים.הפרמיה החודשית משתנה בהתאם לקבוצת גיל מחליפי ניתוח בישראל\nומתקבעת בגיל. 66בכיסוי הנ\"ל קיימת תקופת אכשרה בת 90יום ו 12חודשים למקרה ביטוח הנוגע להריון או לידה.וכן החרגות לכיסוי מהשקל הראשון\nהביטוחי,החרגות בגין מצב רפואי קיים,הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.\nייעוץ עם רופא מומחה,בדיקות אבחנתיות ומניעה,שירותים בגין הריון ולאחר הלידה.תקרת הכיסוי צמודה למדד מחירי הצרכן.הפוליסה"
    },
    "ambulatory": {
      "label": "אמבולטורי / ייעוץ ובדיקות",
      "text": "ייעוץ עם רופא מומחה,בדיקות אבחנתיות ומניעה,שירותים בגין הריון ולאחר הלידה.תקרת הכיסוי צמודה למדד מחירי הצרכן.הפוליסה\nמתחדשת כל שנתיים.הפרמיה החודשית משתנה בהתאם לקבוצת גיל ומתקבעת בגיל. 66בכיסוי הנ\"ל קיימות החרגות לכיסוי הביטוחי,\nאמבולטורי – ייעוץ ובדיקות\nהחרגות בגין מצב רפואי קיים,הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים. בריאות\nביצוע הליך אבחון ראשוני -בדיקה פיזיקלית,בדיקות אבחנתיות ראשוניות,דוח אבחון ראשוני.הליך אבחון מורחב – מיפוייםCT/ CT-\nאמבולטורי – אבחון רפואי. PET / MRA / MRI / U.S /תקרת הכיסוי צמודה למדד מחירי הצרכן.הפוליסה מתחדשת כל שנתיים.הפרמיה קבועה.בכיסוי הנ\"ל\nקיימת תקופת אכשרה בת 90יום וכן החרגות לכיסוי הביטוחי,החרגות בגין מצב רפואי קיים,הגבלות לסכומי ביטוח והשתתפות עצמית מהיר\nבחלק מן הכיסויים.\nטיפולים לאחר אירוע רפואי,ליווי לאחר אירוע רפואי,טיפולי פיזיותרפיה והידרותרפיה,טיפול ריפוי בדיבור /ריפוי בעיסוק,שמירת מח עצם,\nאמבולטורי – ליווי רפואי אגב הקפאת זרע וביציות,חוות דעת שנייה מחו“ל ועוד.תקרת הכיסוי צמודה למדד מחירי הצרכן.הפוליסה מתחדשת כל שנתיים.הפרמיה\nהחודשית משתנה בהתאם לקבוצת גיל ומתקבעת בגיל. 66בכיסוי הנ\"ל קיימות החרגות לכיסוי הביטוחי,החרגות בגין מצב רפואי קיים, אירוע רפואי\nהגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.\nייעוץ,אבחון וטיפול בנושא התפתחות הילד כולל אבחון רפואי,אבחון להפרעות קשב וריכוז /לקויות למידה,אבחון וייעוץ בבעיות שינה,\nטיפולים בהתפתחות הילד,טיפול פסיכולוגי.תקרת הכיסוי צמודה למדד מחירי הצרכן.כיסוי זה מסתיים בגיל. 21בכיסוי הנ\"ל קיימות ייעוץ,אבחון וטיפול\nהחרגות לכיסוי הביטוחי,החרגות בגין מצב רפואי קיים,הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים. בנושא התפתחות הילד"
    },
    "alt_medicine": {
      "label": "רפואה משלימה",
      "text": "טיפולי רפואה משלימה במרפאות הסדר של נותן השירות.תקרת הכיסוי צמודה למדד מחירי הצרכן.תקופת כתב השירות 12חודשים\nמתאריך תחילת כתב השירות ויתחדש מאליו מדי שנה ובכפוף לנסיבות ביטול כתב השירות.בכיסוי הנ\"ל קיימות החרגות לכיסוי הביטוחי,\nכתב שירות – רפואה משלימה החרגות בגין מצב רפואי קיים,הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים."
    },
    "service": {
      "label": "כתב שירות / שירותים נלווים",
      "text": "שיחת ייעוץ מכוונת בתחומי רפואת מומחים המפורטים בתכנית,שיחת ייעוץ מקוונת רפואת ילדים ומשפחה על ידי רופא מומחה מטעם\nהספק בלבד.שירותי איסוף מידע רפואי מהמנוי באמצעות רופא שיגיע לבית המנוי.תקרת הכיסוי צמודה למדד מחירי הצרכן.הפוליסה\nמתחדשת כל שנתיים.הפרמיה קבועה.תקופת כתב השירות 12חודשים מתאריך תחילת כתב השירות ויתחדש מאליו מדי שנה ובכפוף כתב שירות -רופא\nלנסיבות ביטול כתב השירות. מומחה בקליק\nבכיסוי הנ\"ל קיימת תקופת אכשרה וכן החרגות לכיסוי הביטוחי,החרגות בגין מצב רפואי קיים,הגבלות לסכומי ביטוח והשתתפות עצמית\nבחלק מן הכיסויים."
    },
    "critical_illness": {
      "label": "מחלות קשות",
      "text": "פוליסת ביטוח מסוג \"מרפא\" אותה אנו ממליצים לך לרכוש כוללת את הכיסויים הבאים:\nבמסגרת הכיסוי תקבל פיצוי חד פעמי בסכום של ____ ₪בעת גילוי מחלה קשה מתוך רשימה של 47מחלות קשות המחולקות ל 4-קבוצות,מתוכן\n42מחלות בפיצוי מלא.לאחר תשלום סכום הביטוח בגין מקרה הביטוח הראשון,אם לא היה כלול בקבוצה, 1יינתן פיצוי מלא למקרה ביטוח שני\nבכפוף לתנאי הפוליסה.בגיל 70סכום הביטוח יופחת ב, 50%-לאחר הפחתה של 50%תקבל פיצוי חד פעמי בסכום של _________ש\"ח,\nובהתאם גם הפרמיה.\nקיימת תקופת אכשרה בת 90יום.למקרה ביטוח שני קיימת תקופת אכשרה בת 180יום מקרות מקרה הביטוח הראשון. מרפא\nבעת גילוי מחלת הסרטן,קיימת תקופת אכשרה בת 90יום.למקרה ביטוח שני קיימת תקופת אכשרה בת 60חודשים לאחר סיום הטיפול בגין\nהמקרה הראשון ובכפוף לתנאי הפוליסה.בחלק מהמחלות קיימת תקופת שרידות של 14ימים מקרות מקרה הביטוח.\nתוקף הביטוח הינו עד גיל. 75הפוליסה מתחדשת כל שנתיים. מחלות\nהפרמיה משתנה כל שנה בהתאם לגיל המבוטח.\nקשות\nחשוב לי להבהיר כי גם במידה ויש לך כבר ביטוח כזה,סכומי הביטוח מצטברים וביטוח אחד אינו גורע מהאחר.כיסוי זה הינו כיסוי בסיס."
    },
    "cancer": {
      "label": "סרטן",
      "text": "פוליסת ביטוח מסוג \"מרפא סרטן\" אותה אנו ממליצים לך לרכוש כוללת את הכיסויים הבאים:\nבמסגרת הכיסוי תקבל פיצוי חד פעמי בסכום של ____ ₪בעת גילוי מחלת הסרטן.\nקיימת תקופת אכשרה בת 90יום.למקרה ביטוח שני קיימת תקופת אכשרה בת 60חודשים לאחר סיום הטיפול בגין המקרה הראשון ובכפוף לתנאי\nהפוליסה. מרפא סרטן\nתוקף הביטוח הינו עד גיל. 75הפוליסה מתחדשת כל שנתיים.\nהפרמיה משתנה מידי שנה לפי גיל המבוטח."
    },
    "risk": {
      "label": "ריסק",
      "text": "פוליסת ביטוח חיים מסוג ריסק 1/5אותה אנו ממליצים לך לרכוש נותנת כיסוי למקרה מוות בסכום פיצוי של ____.₪הפוליסה הינה עד גיל. 75\n80\nישנו סייג אחד בפוליסה לגבי התאבדות בשנה הראשונה.\nהפרמיה משתנה כל שנה (ריסק / )1כל 5שנים (ריסק )5לפי גיל המבוטח. ריסק 1/5\nהפרמיה צמודה למדד ומשתנה מידי שנה בהתאם לגיל המבוטח.\nפוליסת ביטוח החיים אותה אנו ממליצים לך לרכוש הינה מסוג הכנסה למשפחה:\nהכנסה חודשית קבועה ע\"ס _________ ₪אשר תשולם במשך התקופה שהוגדרה למוטבים בפוליסה במקרה פטירה.\nסכום הביטוח ישולם ללא תלות בסכומים אחרים המגיעים למוטביך מפוליסות ביטוח אחרות.\nהכנסה למשפחה\nסכום הפיצוי החודשי צמוד למדד.ישנו סייג אחד בפוליסה לגבי התאבדות בשנה הראשונה."
    },
    "mortgage": {
      "label": "משכנתא",
      "text": "תקופת הביטוח הינה בהתאם לתקופה שהוגדרה בהצטרפות ולכל המאוחר עד גיל. 75\nפוליסת ביטוח משכנתא אותה אנו ממליצים לך לרכוש כוללת ביטוח חיים,הנותן מענה במקרים בהם הלווים יצטרכו להפסיק את תשלומי המשכנתא.\nבמקרה של מוות חלילה,חברת הביטוח תדאג לשלם את יתרת ההלוואה לבנק,ובכך תפטור את הלווה הנותר מהמשך תשלומי המשכנתא לבנק\nותקטין את הנטל הכלכלי מהמשפחה.ישנו סייג אחד בפוליסה לגבי התאבדות בשנה הראשונה.\nע\"פ הנתונים שבידינו:המוטב הבלתי חוזר הוא בנק _____ סניף מספר _____ כתובת הסניף _______. משכנתא\nיתרת ההלוואה היא ______ ₪לתקופה של ____ שנים עם ריבית קבועה/משתנה של ___.%\nחיים\nביטוח מבנה:בביטוח זה מבוטח מבנה הדירה מפני סיכונים המפורטים בפוליסה כגון אש,התפוצצות,נזקי טבע וכו':"
    },
    "umbrella": {
      "label": "מטריה ביטוחית",
      "text": "סכום ביטוח המבנה בערך כינון _______.₪כתובת הדירה ______,בית פרטי /קומה ____ מתוך __.גודל הדירה ___ מ\"ר.\nפוליסת הביטוח מטריה ביטוחית מעניקה לך,בהתאם לבחירתך ובכפוף לאישור החברה:כיסוי למקרה של אובדן כושר עבודה,על-פי הגדרת עיסוק\nספציפי – מאושר רק לעיסוקים שהוגדרו על-ידי החברה.\nכיסוי לתקופת אכשרה – תשלום פיצוי במקרה של דחיית התביעה על-ידי קרן הפנסיה בשל העובדה שמדובר במקרה ביטוח שהתרחש בתקופת\nהאכשרה בקרן הפנסיה.\nכיסוי לביטול קיזוז ביטוח לאומי על-ידי קרן הפנסיה – כיסוי משלים לקרן הפנסיה,במקרה של זכאות לתשלום על-ידי המוסד לביטוח לאומי,עקב\nמטריה ביטוחית\nתאונת עבודה או מחלה.\nשחרור מההפקדות לקרן הפנסיה (בכיסויים לתקופת אכשרה ולהגדרת עיסוק ספציפי) ושחרור מתשלום הפרמיה​."
    },
    "disability_income": {
      "label": "אובדן כושר עבודה",
      "text": "בפוליסת אובדן כושר עבודה במעמד עצמאי אותה אנו ממליצים לך לרכוש,אתה מצהיר כי:\nאובדן כושר עבודה -ההכנסה מעבודה שאתה צפוי להרוויח תעמוד על סך של ______ ₪לחודש.ידוע לך כי בקרות מקרה הביטוח יוגבלו תגמולי הפיצוי אובדן כושר\nפיצוי ושחרור בלבד החודשי להם תהיה זכאי לגובה שלא יעלה על 75%מהכנסתך מעבודה בפועל ב 12-החודשים שקדמו למועד קרות מקרה הביטוח,או עבודה\nבתקופה ממועד תחילת הביטוח ועד מועד קרות מקרה הביטוח,אם חלפו פחות מ 12-חודשים."
    }
  },
  "איילון": {
    "meds": {
      "label": "תרופות מחוץ לסל",
      "text": "חשוב שתדע שאתה יכול לרכוש כל אחד מהכיסויים בנפרד,אך מומלץ לרכוש את כל החבילה.הכיסויים העיקריים הם:\nכיסוי לתרופות שאינן בסל הבריאות לרבות:תרופות המאושרות בסל אך להתוויה שונה,תרופות, off labelתרופות יתום,\nתרופות מיוחדות.סכום השיפוי המרבי 3מיליון - ₪מתמלא כל 24חודשים.\nהשתתפות עצמית של ₪ 300לתרופה לחודש.ו ₪ 500לתקופה מיוחדת.\nלתרופות מיוחדות -תקרה של, ₪ 1,000,000מתחדש כל 24חודשים.תקרה חודשית של.₪ 200,000 תרופות שלא בסל\nהביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה,ותקף לכל החיים.הכיסוי כולל תקופת אכשרה בת 90ימים.\nהפרמיה משתנה לפי קבוצת גיל ומתקבעת בגיל.66כיסוי זה הינו כיסוי בסיס."
    },
    "transplants": {
      "label": "השתלות וטיפולים מיוחדים בחו\"ל",
      "text": "כיסוי הוצאות עבור השתלה ו/או טיפול /ניתוח מיוחד בחו\"ל.עיקרי הכיסוי:\nשיפוי בגין הוצאות מוכרות הקשורות להשתלה ו/או ניתוח/טיפול מיוחד בחו\"ל כמפורט בנספח לרבות הוצאות לביצוע\nהפעילות הרפואית הנדרשת לקציר האיבר המושתל,הוצאות אשפוז בבית חולים,תשלום לצוות הרפואי,הוצאות עבור בריאות\nהשתלות וטיפולים מיוחדים\nכרטיסי טיסה ושהייה בחו\"ל,הטסה רפואית,הטסת גופה,הוצאות בשל מיסים היטלים והמרות.טיפולי המשך,הבאת מוצרי\nבחו\"ל\nמומחה רפואי לישראל,קצבה חודשית למועמד להשתלה,גמלה חודשית לאחר ביצוע השתלה. בסיס\nהביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה,ותקף לכל החיים.הכיסוי כולל תקופת אכשרה בת 90ימים."
    },
    "surgeries_abroad": {
      "label": "ניתוחים וטיפולים מחליפי ניתוח בחו\"ל",
      "text": "הפרמיה משתנה לפי קבוצת גיל ומתקבעת בגיל.66כיסוי זה הינו כיסוי בסיס.\nכיסוי להוצאות הכרוכות בניתוחים מחוץ לישראל או בטיפולים מחליפי ניתוח מחוץ לישראל בהתאם לסוגי ההוצאות\nהמפורטים בפוליסה.הוצאות הטסה רפואית,הוצאות שהייה,אחות פרטית,הוצאות החלמה,המשך מעקב רפואי בחו\"ל,\nהוצאות שיקום. ניתוחים וטיפולים\nהביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה,ותקף לכל החיים. מחליפי ניתוח בחו\"ל"
    },
    "surgeries_israel": {
      "label": "ניתוחים בארץ",
      "text": "אני מבקש לציין בפניך כי פוליסת הבריאות הבסיסית אינה כוללת כיסוי ביטוחי בגין ביצוע ניתוחים פרטיים\nלאחר צירוף לפוליסה בריאות בסיסית יש\nבישראל,בין היתר,מכיוון שכיסוי לניתוחים בישראל ניתן במסגרת השב\"ן\".\nלהבהיר למועמד:\nניתוחים וטיפולים מחליפי ניתוח בארץ -משלים שב''ן עם השתתפות עצמית ע\"ס 5000ש\"ח עבור הוצאות שכר מנתח וביצוע\nניתוחים וטיפולים מחליפי ניתוח עלויות הניתוח 3.התייעצויות עם רופא מומחה אגב הניתוח או הטיפול מחליף הניתוח.שכר מנתח.ניתוח בבית חולים פרטי\nבישראל משלים שב\"ן עם או במרפאה כירורגית פרטית.טיפולים מחליפי ניתוח.\nהשתתפות עצמית בסך 5000הביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה,ותקף לכל החיים\nהכיסוי כולל תקופת אכשרה בת 90ימים,בעת מקרה ביטוח הנוגע להריון או לידה,תהיה תקופת האכשרה 12חודשים. ש\"ח\nהפרמיה משתנה לפי קבוצת גיל ומתקבעת בגיל.66\nתכנית ביטוח לניתוחים ומחליפי ניתוח פרטיים בארץ לבעלי שב\"ן – לאחר מיצוי השב\"ן.עיקרי הכיסוי:\nמשלים שב\"ן\nשלוש התייעצויות עם רופא מומחה אגב הניתוח או הטיפול מחליף הניתוח.שכר מנתח.ניתוח בבית חולים פרטי או במרפאה\nלניתוחים ומחליפי\nכירורגית פרטית.טיפולים מחליפי ניתוח.הביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה,ותקף לכל החיים.\nניתוח בישראל ללא השתתפות\nהכיסוי כולל תקופת אכשרה בת 90ימים,בעת מקרה ביטוח הנוגע להריון או לידה,תהיה תקופת האכשרה 12חודשים.\nעצמית\nהפרמיה משתנה לפי קבוצת גיל ומתקבעת בגיל.66\nתכנית ביטוח לניתוחים ומחליפי ניתוח פרטיים בארץ.עיקרי הכיסוי:\nשלוש התייעצויות עם רופא מומחה אגב הניתוח או הטיפול מחליף הניתוח.שכר מנתח.ניתוח בבית חולים פרטי או במרפאה\nכירורגית פרטית.טיפולים מחליפי ניתוח.כיסוי מלא עד תקרת ספקים שבהסדר.הביטוח מתחדש כל שנתיים בכפוף לתנאי ניתוחים ומחליפי\nהפוליסה,ותקף לכל החיים.הכיסוי כולל תקופת אכשרה בת 90ימים בעת מקרה ביטוח הנוגע להריון או לידה,תהיה ניתוח בישראל"
    },
    "ambulatory": {
      "label": "אמבולטורי / ייעוץ ובדיקות",
      "text": "שירותים אמבולטוריים להתייעצות ובדיקות,רפואת מומחים והתייעצויות,בדיקות אבחנתיות וטכנולוגיות מתקדמות,הראיית\nאיברים פנימיים במערכת העיכול באמצעות קפסולה,הריון ולידה,מחלת הסרטן -אבחון,בדיקה ומניעה,בדיקת סקר\nתקופתית,בדיקת,COLONFLAGשירות מחקר אישי ממוקד,שירות מומחה עולמי. אמבולטורי ייעוץ ובדיקות\nהביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה,ותקף לכל החיים.הפרמיה משתנה לפי קבוצת גיל ומתקבעת בגיל.66\nבריאות\nהכיסוי כולל תקופת אכשרה בת 90ימים,הריון ולידה 270ימים,סקר לגילוי סרטן 3שנים,סקר תקופתי 24חודשים.\nנספח לשירותים אמבולטוריים לטיפולים,טיפולים פארא-רפואיים עד 12טיפולים לתקופה של 12חודשים,טיפולי\nפיזיותרפיה והידרותרפיה,מרפאות כאב בבית חולים פרטי.השתלה תוך גופית של כדורים רדיואקטיביים לטיפולים במחלת\nסרטן. אמבולטורי לטיפולים"
    },
    "alt_medicine": {
      "label": "רפואה משלימה",
      "text": "כתב שירות לשירותי רפאה משלימה (אלטרנטיבית),השירותים יסופקו על ידי ספק השירותים ( Targetcareטארגט-קר).\nרשימת השירותים:עיסוי רפואי עקב אשפוזה כתוצאה מתאונה,רפלקסולוגיה,שיאצו,אקופונקטורה,סוגו'ק,פלדנקאייז,\nאוסטיאופתיה,שיטת אלכסנדר,ביו פידבק,הומיאופתיה,כירופרקטיקה,נטורופתיה,פרחי באך,חדרי מלח.\nרפואה משלימה"
    },
    "service": {
      "label": "כתב שירות / שירותים נלווים",
      "text": "שירות זה מאפשר למנוי שאירעה לו תאונה שהיא \"מקרה מזכה\" לקבל את השירותים הבאים:החזר הוצאות פינוי באמצעות\nאמבולנס,ייעוץ עם רופא מומחה האורתופדיה /רדיולוגיה,טיפולי פיזיותרפיה /הידרותרפיה,מפגשי טיפול עם רופא מומחה\nאיילון ספורטיבי\nברפואת כאב,הקפאת מנוי בחדר כושר.הכיסוי כולל תקופת אכשרה בת 90ימים.הפרמיה קבועה לילד עד גיל,20מגיל 21\nפרמיה קבועה למבוגר.הביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה ותקף עד גיל.69\nשירות זה מאפשר למבוטח בשעות הפעילות,לקבל שירות רופא עד הבית,לקבל ייעוץ מקוון עם רופא משפחה או ילדים\nולבצע בדיקות מעבדה בבית כגון לקיחת דמים,על פי המפורט בנספח השירות.השירות ניתן באמצעות נותן שירות בהסכם\nאיילון עד הבית\nעם המבטח בלבד.הפרמיה קבועה לילד עד גיל,20מגיל 21פרמיה קבועה למבוגר.הביטוח מתחדש כל שנתיים בכפוף\nלתנאי הפוליסה ותקף עד גיל.69\nיוני 2024\nכיסויים – חברת איילון ()2/2\nייעוץ רפואי ראשוני ובדיקות אבחנתיות נוספות.פגישת ייעוץ רפואי ראשוני עם רופא מטעם הספק.בכיסוי הנ\"ל קיימת\nנספח לשירותי אבחון מהיר השתתפות עצמית.הביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה,ותקף לכל החיים.\nהכיסוי כולל תקופת אכשרה בת 45ימים.הפרמיה קבועה לילד עד גיל,20מגיל 21פרמיה קבועה למבוגר.\nכתב שירות חמל בר גפן -ניהול משבר רפואי,ליווי וסיוע במימוש זכויות במקרים של מחלה קשה.\nהכיסוי כולל תקופת אכשרה בת 90ימים.הפרמיה משתנה מדי שנה בהתאם לגיל המבוטח ומתקבעת בגיל.71 ניהול משברים בר גפן\nהביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה ותקף עד גיל.85\nכתב שירות לשירותי רפואה אונליין -ייעוץ רפואי מקוון באמצעות טלפון חכם,טבלט או מחשב,הכולל ייעוצים עם רופאים\nכתב שירות ייעוץ בריאות\nמומחים,איסוף מידע לקראת ייעוץ,ייעוץ בתחומי רפואת משפחה וילדים.הביטוח מתחדש כל שנתיים בכפוף לתנאי\nרפואי אונליין"
    },
    "critical_illness": {
      "label": "מחלות קשות",
      "text": "פוליסת ביטוח מחלות קשות מסוג \"בשביל החוסן\" אותה אנו ממליצים לך לרכוש,כוללת את הכיסויים הבאים:\nבעת גילוי מחלה אחת מתוך 35המחלות הקשות או האירועים הרפואיים הקשים הנכללים בכיסוי,תקבל פיצוי חד פעמי של\n_________. ₪ניתן לראות את ריכוז המחלות בתנאי הפוליסה.\nייחודי לאיילון – פיצוי בעת מצב רפואי חמור ובלתי הפיך וכן פיצוי במקרה צנתור לב כלילי.\nפיצוי בעת תביעה ראשונה –, 100%פיצוי בעת תביעה שנייה –.50%\nפיצוי בעת פטירה בתוך 30יום מיום גילוי המחלה. בשביל החוסן\nפרמיה משתנה מדיי שנה.\n– 65סכום הפיצוי יקטן ב.50%-גיל כניסה – עד גיל, 65גיל תום ביטוח. 75:מגיל 70\nישנה תקופת אכשרה בת 90ימים.למקרה ביטוח שני,קיימת תקופת אכשרה של 365ימים מיום המקרה הביטוחי הראשון,\nכיסוי זה הינו כיסוי בסיס."
    },
    "cancer": {
      "label": "סרטן",
      "text": "פוליסת ביטוח מחלות קשות מסוג \"בשביל החוסן סרטן\" אותה אנו ממליצים לך לרכוש,כוללת את הכיסויים הבאים: קשות\nבעת גילוי מחלת הסרטן חלילה,תקבל פיצוי חד פעמי בסך ______.₪\nעיקרי הכיסויים:\nפיצוי בעת תביעה ראשונה, 100% -פיצוי בעת הישנות המחלה 100% -נדרשת תקופת אכשרה של 5שנים בין התביעות.\nכיסוי של 20%מסך גובה הפיצוי שנרכש למקרה של טרום סרטן:\nCARCINOMA IN SITU.1בשד. בשביל החוסן (סרטן)\n.2דיספלזיה קשה של צוואר הרחם בדרגה CIN3\n.3ניתוח לטיפול בגידול ממאיר בערמונית.\nפרמיה משתנה מדי שנה.\nישנה תקופת אכשרה בת 90ימים,כיסוי זה הינו כיסוי בסיס."
    },
    "risk": {
      "label": "ריסק",
      "text": "פוליסת ביטוח החיים אותה אנו ממליצים לך לרכוש הינה מסוג דרור.1\nבהתאם למאפייניך האישיים:גילך,עיסוקך ומצבך המשפחתי,ראינו כי סכום הביטוח המתאים עבורך למקרה מוות הינו\nביטוח חיים -\n____________.₪הפוליסה הינה עד גיל.85\nדרור 1\nישנו סייג אחד בפוליסה והוא לגבי התאבדות בשנה הראשונה.הפרמיה משתנה מדי שנה בהתאם לגיל המבוטח.\nחשוב לי להבהיר כי גם במידה ויש לך כבר ביטוח כזה,סכומי הביטוח הם מצטברים וביטוח אחד אינו גורע מהאחר."
    },
    "mortgage": {
      "label": "משכנתא",
      "text": "פוליסת ביטוח משכנתא אותה אנו ממליצים לך לרכוש כוללת ביטוח חיים,הנותן מענה במקרים בהם הלווים יצטרכו\nלהפסיק את תשלומי המשכנתא.במקרה של מוות חלילה,חברת הביטוח תדאג לשלם את יתרת ההלוואה לבנק,ובכך\nתפטור את הלווה הנותר מהמשך תשלומי המשכנתא לבנק ותקטין את הנטל הכלכלי מהמשפחה. משכנתא\nע\"פ הנתונים שבידינו:המוטב הבלתי חוזר הוא בנק _____ סניף מספר _____ כתובת הסניף ___________.\nיתרת ההלוואה היא __________ ₪לתקופה של _______ שנים עם ריבית קבועה/משתנה של _______.% חיים"
    },
    "umbrella": {
      "label": "מטריה ביטוחית",
      "text": "פוליסת הביטוח מטריה ביטוחית מעניקה לך,בהתאם לבחירתך ובכפוף לאישור החברה:כיסוי למקרה של אובדן כושר\nעבודה,על-פי הגדרת עיסוק ספציפי – מאושר רק לעיסוקים שהוגדרו על-ידי החברה.\nכיסוי לתקופת אכשרה – תשלום פיצוי במקרה של דחיית התביעה על-ידי קרן הפנסיה בשל העובדה שמדובר במקרה\nביטוח שהתרחש בתקופת האכשרה בקרן הפנסיה.\nכיסוי לביטול קיזוז ביטוח לאומי על-ידי קרן הפנסיה – כיסוי משלים לקרן הפנסיה,במקרה של זכאות לתשלום על-ידי מטריה ביטוחית\nהמוסד לביטוח לאומי,עקב תאונת עבודה או מחלה.\nשחרור מההפקדות לקרן הפנסיה (בכיסויים לתקופת אכשרה ולהגדרת עיסוק ספציפי) ושחרור מתשלום הפרמיה​.\nתוקף הביטוח עד גיל פרישה.\nהפרמיה צמודה למדד ומשתנה מדי שנה בהתאם לגיל המבוטח."
    },
    "disability_income": {
      "label": "אובדן כושר עבודה",
      "text": "בפוליסת אובדן כושר עבודה במעמד עצמאי אותה אנו ממליצים לך לרכוש,אתה מצהיר כי:\nההכנסה מעבודה שאתה צפוי להרוויח תעמוד על סך של ______ ₪לחודש.ידוע לך כי בקרות מקרה הביטוח יוגבלו\nתגמולי הפיצוי החודשי להם תהיה זכאי לגובה שלא יעלה על 75%מהכנסתך מעבודה בפועל ב 12-החודשים שקדמו אובדן כושר עבודה\nלמועד קרות מקרה הביטוח,או בתקופה ממועד תחילת הביטוח ועד מועד קרות מקרה הביטוח,אם חלפו פחות מ12-\nאובדן כושר"
    }
  },
  "כלל": {
    "meds": {
      "label": "תרופות מחוץ לסל",
      "text": "חשוב שתדע שאתה יכול לרכוש כל אחד מהכיסויים בנפרד,אך מומלץ לרכוש את כל החבילה.הכיסויים העיקריים הם:\nכיסוי עד ₪ 3,000,000לתרופות שאינן בסל הבריאות,כיסוי לתרופות מיוחדות המכונות \"תרופות בייבוא אישי\" עד\n,₪ 1,000,000ללא השתתפות עצמית לתרופה שעלותה מעל ₪ 5,000בחודש.הכיסוי כולל תקופת אכשרה בת 90\nימים.במקרה שקיים ביטוח בריאות בחברה אחרת – \"תהא אכשרה של 90יום על הכיסויים החדשים /הלא חופפים\". תרופות מחוץ לסל\nהביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה,ותקף לכל החיים."
    },
    "transplants": {
      "label": "השתלות וטיפולים מיוחדים בחו\"ל",
      "text": "הפרמיה משתנה ע\"פ קבוצת גיל ומתקבעת בגיל.66כיסוי זה הינו כיסוי בסיס.\nכיסוי לביצוע השתלות וטיפולים מיוחדים מחוץ לישראל,כולל הוצאות נלוות כגון הוצאות הטסה והוצאות בגין טיפולי\nהמשך,וכולל תשלום קצבה חודשית לפני ואחרי השתלה..\nהשתלות וטיפולים מיוחדים הכיסוי כולל תקופת אכשרה בת 90ימים.\nבמקרה שקיים ביטוח בריאות בחברה אחרת – \"תהא אכשרה של 90יום על הכיסויים החדשים /הלא חופפים\". בחו\"ל בריאות מוצרי"
    },
    "surgeries_abroad": {
      "label": "ניתוחים וטיפולים מחליפי ניתוח בחו\"ל",
      "text": "הפרמיה משתנה ע\"פ קבוצת גיל ומתקבעת בגיל.66כיסוי זה הינו כיסוי בסיס.\nכיסוי לביצוע ניתוחים וטיפולים מחליפי ניתוח בחו\"ל,כולל הוצאות נלוות כגון הוצאות הטסה והוצאות בגין התייעצות עם\nרופא מומחה בישראל ובחו\"ל.\nהכיסוי כולל תקופת אכשרה בת 90ימים. ניתוחים וטיפולים"
    },
    "surgeries_israel": {
      "label": "ניתוחים בארץ",
      "text": "אני מבקש לציין בפניך כי פוליסת הבריאות הבסיסית אינה כוללת כיסוי ביטוחי בגין ביצוע ניתוחים פרטיים בישראל, לאחר צירוף לפוליסה בריאות בסיסית יש\nבין היתר,מכיוון שכיסוי לניתוחים בישראל ניתן במסגרת השב\"ן\". להבהיר למועמד:\nפוליסה המיועדת למי שחבר בשב\"ן בקופת חולים והיא מעניקה כיסוי לניתוחים פרטיים בישראל,לרבות ניתוחים מניעתיים\nוטיפולים מחליפי ניתוח,וכל זאת לאחר מיצוי וניכוי זכויות המבוטח בשב\"ן עם השתתפות עצמית למקרה ביטוח בגובה\n( ₪ 5,000אצל ספק בהסכם).\nניתוחים משלים שב\"ן עם\nמבין ה 3פוליסות זו הפוליסה עם הכיסוי הביטוחי הכי מצומצם (שכן היא מהווה ביטוח משלים מעל השב\"ן) אבל גם הכי\nהשתתפות עצמית של\nזולה.ישנה תקופת אכשרה בת 90יום,למעט למקרה ביטוח הקשור בהריון ו/או ולידה שיהיה לתקופת אכשרה של 12\n5000ש\"ח\nחודשים.\nהביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה ותקף לכל החיים.\nהפרמיה משתנה ע\"פ קבוצת גיל ומתקבעת בגיל.66כיסוי זה הינו כיסוי בסיס.\nפוליסה זו מיועדת למי שחבר בשב\"ן בקופת חולים ומעניקה כיסוי לניתוחים פרטיים בישראל,לרבות ניתוחים מניעתיים\nוטיפולים מחליפי ניתוח,וכל זאת לאחר מיצוי זכויות בשב\"ן -אך בפוליסה זו המבוטח פטור מתשלום השתתפות עצמית.\nזו פוליסה זהה לפוליסה הראשונה למעט שבה אין מגבלה של השתתפות עצמית ולכן היא מעט יותר יקרה.\nניתוחים משלים שב\"ן ללא הכיסוי כולל תקופת אכשרה בת 90ימים.למעט למקרה ביטוח הקשור בהריון ו /או ולידה שיהיה לתקופת אכשרה של 12\nחודשים. השתתפות עצמית\nבמקרה שקיים ביטוח בריאות בחברה אחרת – \"תהא אכשרה של 90יום על הכיסויים החדשים /הלא חופפים\".\nהביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה,ותקף לכל החיים.\nהפרמיה משתנה ע\"פ קבוצת גיל ומתקבעת בגיל.66כיסוי זה הינו כיסוי בסיס.\nפוליסה זו מעניקה כיסוי לניתוחים פרטיים בישראל,לרבות ניתוחים מניעתיים וטיפולים מחליפי ניתוח,וכל זאת מהשקל\nהראשון -כלומר ללא תלות בזכויות המבוטח בשב\"ן.\nמבין ה 3פוליסות זו הפוליסה הרחבה ביותר מבחינת מימוש הכיסוי שכן המבוטח לא תלוי בתנאים ובזמינות של השב\"ן\nועל כן היקרה ביותר.\nניתוחים בישראל מסוג חשוב לציין כי \" הכיסוי לניתוחים ניתן באמצעות מנתחים שמצויים בהסכם עם חברת הביטוח בלבד\" (רשימות הרופאים בריאות\nמפורטים באתר החברה) וכי יש לפנות לחברת הביטוח לתיאום הניתוח טרם ביצועו. שקל ראשון ללא\nהכיסוי כולל תקופת אכשרה בת 90ימים.למעט למקרה ביטוח הקשור בהריון ו /או ולידה שיהיה לתקופת אכשרה של 12 השתתפות עצמית\nחודשים.\nבמקרה שקיים ביטוח בריאות בחברה אחרת – \"תהא אכשרה של 90יום על הכיסויים החדשים /הלא חופפים\".הביטוח"
    },
    "ambulatory": {
      "label": "אמבולטורי / ייעוץ ובדיקות",
      "text": "מדיכלל יעוצים ובדיקות – כיסוי למגוון אירועים רפואיים אמבולטוריים (שאינם במסגרת אשפוז) וכולל:ייעוציים רפואיים,\nבדיקות אבחנתיות,בדיקות היריון,שירותי פונדקאות בישראל ועוד.הכיסוי כולל תקופת אכשרה בת 90ימים.\nהביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה,ותקף לכל החיים.הפרמיה משתנה ע\"פ קבוצת גיל ומתקבעת בגיל ייעוציים ובדיקות\n.66\nאבחון מהיר -ייעוץ ואבחון רפואי ראשוני אצל רופא מאבחן תוך יום עבודה אחד ובדיקות נוספות במידת הצורך,על מנת"
    },
    "service": {
      "label": "כתב שירות / שירותים נלווים",
      "text": "אבחון מהיר -ייעוץ ואבחון רפואי ראשוני אצל רופא מאבחן תוך יום עבודה אחד ובדיקות נוספות במידת הצורך,על מנת\nלהגיע לאבחון מדויק ומהיר ככל האפשר.הפרמיה קבועה וצמודה למדד.\nכתב שירות אבחון מהיר\nהכיסוי כולל תקופת אכשרה בת 90ימים.\nהביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה,ותקף לכל החיים.\nייעוץ רפואי באמצעות שיחת וידאו צ' אט באינטרנט על יד רופאים מומחים,רופאי ילדים ורופאי משפחה בלחיצת כפתור.\nכתב שירות רופא און ליין הביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה.הפרמיה קבועה וצמודה למדד.\nישנה תקופת אכשרה בת 30ימים למעט קבלת ייעוץ בתחומי רפואת משפחה וילדים.\nהכיסוי מעניק שירותים רפואיים ופרה -רפואיים שמטרתם ליווי המבוטח בכל שלבי המחלה.הביטוח מתחדש כל שנתיים\nכתב שירות ליווי אישי בכפוף לתנאי הפוליסה.הפרמיה קבועה וצמודה למדד.\nישנה תקופת אכשרה בת 90יום למקרה של ליווי אישי ע\"י רופא מומחה,או 30יום למקרה של ליווי באשפוז. פלוס\nכיסוי למגוון טיפולים אלטרנטיביים ומשלימים תוך אפשרות לבחירת הספק על ידי הלקוח מתוך רשימת ספקים בהסדר או\nשיפוי לנותני שירות שאינם בהסדר.\nרפואה משלימה\nהביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה.הפרמיה קבועה וצמודה למדד."
    },
    "alt_medicine": {
      "label": "רפואה משלימה",
      "text": "כיסוי למגוון טיפולים אלטרנטיביים ומשלימים תוך אפשרות לבחירת הספק על ידי הלקוח מתוך רשימת ספקים בהסדר או\nשיפוי לנותני שירות שאינם בהסדר.\nרפואה משלימה\nהביטוח מתחדש כל שנתיים בכפוף לתנאי הפוליסה.הפרמיה קבועה וצמודה למדד."
    },
    "critical_illness": {
      "label": "מחלות קשות",
      "text": "פוליסת ביטוח מחלות קשות מסוג \"מדיכלל מחלות קשות \" 33אותה אנו ממליצים לך לרכוש,כוללת את הכיסויים הבאים:\nבעת גילוי מחלה אחת מתוך 33המחלות הקשות או האירועים הרפואיים הקשים הנכללים בכיסוי,תקבל פיצוי חד פעמי\nשל _________. ₪הכיסוי כולל בין היתר מקרים של גילוי חלילה של מחלת הסרטן,מחלת כבד סופנית,תשישות\nנפש,התקף לב חריף,שבץ מוחי,מחלות ומקרים נוספים בכפוף לתנאי הפוליסה. מדיכלל מחלות קשות\nישנה תקופת אכשרה בת 90ימים.למקרה ביטוח שני,קיימת תקופת אכשרה של חצי שנה מיום המקרה הביטוחי 33\nהראשון.\nתוקף הביטוח הינו עד גיל.75הפרמיות משתנות עפ\"י קבוצת גיל.בגיל 70קטן סכום הביטוח והפרמיה ב.50%-חשוב\nלי להבהיר כי גם במידה ויש לך כבר ביטוח כזה,סכומי הביטוח מצטברים וביטוח אחד אינו גורע מהאחר. מחלות"
    },
    "cancer": {
      "label": "סרטן",
      "text": "פוליסת ביטוח מחלות קשות מסוג \"מדיכלל פיצוי לסרטן\" אותה אנו ממליצים לך לרכוש,כוללת את הכיסויים הבאים: קשות\nבעת גילוי מחלת הסרטן חלילה,תקבל פיצוי חד פעמי בסך ______,₪בכפוף לתנאי הפוליסה.\nישנה תקופת אכשרה בת 90ימים.\nתוקף הביטוח הינו עד גיל.85\nמדיכלל פיצוי לסרטן\nהפרמיות משתנות עפ\"י קבוצת גיל.\nבגיל 70קטן סכום הביטוח והפרמיה ב.50%-\nחשוב לי להבהיר כי גם במידה ויש לך כבר ביטוח כזה,סכומי הביטוח מצטברים וביטוח אחד אינו גורע מהאחר.כיסוי זה\nהינו כיסוי בסיס."
    },
    "risk": {
      "label": "ריסק",
      "text": "פוליסת ביטוח החיים אותה אנו ממליצים לך לרכוש הינה מסוג ספיר.1\nבהתאם למאפייניך האישיים:גילך,עיסוקך ומצבך המשפחתי,ראינו כי סכום הביטוח המתאים עבורך למקרה מוות הינו\n____________.₪\nהפוליסה מעניקה לבני המשפחה שייקבעו כמוטבים,פיצוי כספי חד-פעמי במקרה פטירה של המבוטח,חס וחלילה.\nסכום ביטוח קבוע צמוד למדד,מוות מכל סיבה שהיא,י שנו סייג אחד בפוליסה והוא לגבי התאבדות בשנה הראשונה, ביטוח חיים -\nבכפוף לתנאי הפוליסה. ספיר\nהפוליסה הינה עד גיל.80\nהפרמיה משתנה מדי שנה בהתאם לגיל המבוטח.\nחשוב לי להבהיר כי גם במידה ויש לך כבר ביטוח כזה,סכומי הביטוח הם מצטברים וביטוח אחד אינו גורע מהאחר."
    },
    "mortgage": {
      "label": "משכנתא",
      "text": "פוליסת ביטוח משכנתא אותה אנו ממליצים לך לרכוש כוללת ביטוח חיים,הנותן מענה במקרים בהם הלווים יצטרכו\nלהפסיק את תשלומי המשכנתא.במקרה של מוות חלילה,חברת הביטוח תדאג לשלם את יתרת ההלוואה לבנק,ובכך\nתפטור את הלווה הנותר מהמשך תשלומי המשכנתא לבנק ותקטין את הנטל הכלכלי מהמשפחה,בכפוף לתנאי\nהפוליסה.\nע\"פ הנתונים שבידינו:המוטב הבלתי חוזר הוא בנק _____ סניף מספר __ _ כתובת הסניף ___________.\nיתרת ההלוואה היא __________ ₪לתקופה של _______ שנים עם ריבית קבועה/משתנה של _______.% משכנתא\nביטוח מבנה: חיים\nבביטוח זה מבוטח מבנה הדירה מפני סיכונים המפורטים בפוליסה כגון אש,התפוצצות,נזקי טבע וכו'.\nסכום ביטוח המבנה בערך כינון _______.₪כתובת הדירה ______,בית פרטי /קומה ___ מתוך ___.גודל הדירה"
    },
    "umbrella": {
      "label": "מטריה ביטוחית",
      "text": "פוליסת הביטוח מטריה ביטוחית מעניקה לך,בהתאם לבחירתך ובכפוף לאישור החברה:כיסוי למקרה של אובדן כושר\nעבודה,על-פי הגדרת עיסוק ספציפי – מאושר רק לעיסוקים שהוגדרו על-ידי החברה.\nכיסוי לתקופת אכשרה – תשלום פיצוי במקרה של דחיית התביעה על-ידי קרן הפנסיה בשל העובדה שמדובר במקרה\nביטוח שהתרחש בתקופת האכשרה בקרן הפנסיה.\nכיסוי לביטול קיזוז ביטוח לאומי על-ידי קרן הפנסיה – כיסוי משלים לקרן הפנסיה,במקרה של זכאות לתשלום על-ידי מטריה ביטוחית\nהמוסד לביטוח לאומי,עקב תאונת עבודה או מחלה.\nשחרור מההפקדות לקרן הפנסיה (בכיסויים לתקופת אכשרה ולהגדרת עיסוק ספציפי) ושחרור מתשלום הפרמיה​."
    },
    "accident_death": {
      "label": "מוות מתאונה",
      "text": "תשלום חד פעמי למוטבים בגובה סכום הביטוח,ללא קשר לסכומי ביטוח אחרים בהם בוטח,במקרה של מות המבוטח,\nבין בתקופת הביטוח ובין לאחריה,כתוצאה מתאונה,ובלבד שמות המבוטח אירע בתוך 37חודשים ממועד קרות\nהתאונה.תוקף הביטוח הינו עד תום תקופת הביטוח בפוליסה יסודית שכיסוי ביטוחי זה נספח לה,אך לא יותר מגיל.75\nהפרמיה משתנה מדי שנה בהתאם לגיל המבוטח וצמודה למדד. מוות מתאונה"
    },
    "accident_disability": {
      "label": "נכות מתאונה",
      "text": "הפרמיה משתנה מדי שנה בהתאם לגיל המבוטח וצמודה למדד. מוות מתאונה\nחיים\nתשלום חד פעמי במקרה של נכות מוחלטת ותמידית או נכות חלקית ותמידית הנגרמת כתוצאה מתאונה והכל בתוך 37\nחודשים ממועד התאונה,ובלבד שהמבוטח נותר בחיים לפחות 3חודשים לאחר מועד תאונה.\nתוקף הביטוח הינו עד תום תקופת הביטוח בפוליסה יסודית שכיסוי ביטוחי זה נספח לה,אך לא יותר מגיל.65\nהפרמיה משתנה מדי שנה בהתאם לגיל המבוטח וצמודה למדד. נכות מתאונה"
    },
    "disability_income": {
      "label": "אובדן כושר עבודה",
      "text": "בפוליסת אובדן כושר עבודה במעמד עצמאי אותה אנו ממליצים לך לרכוש,אתה מצהיר כי:\nההכנסה מעבודה שאתה צפוי להרוויח תעמוד על סך של ______ ₪לחודש.ידוע לך כי בקרות מקרה הביטוח יוגבלו\nאובדן כושר עבודה -פיצוי ושחרור אובדן כושר\nתגמולי הפיצוי החודשי להם תהיה זכאי לגובה שלא יעלה על 75%מהכנסתך מעבודה בפועל ב 12-החודשים שקדמו\nבלבד עבודה\nלמועד קרות מקרה הביטוח,או בתקופה ממועד תחילת הביטוח ועד מועד קרות מקרה הביטוח,אם חלפו פחות מ12-\nחודשים."
    }
  },
  "מגדל": {
    "meds": {
      "label": "תרופות מחוץ לסל",
      "text": "פירוט שם הכיסוי תחום\nפוליסת ביטוח בריאות מסוג ___________ שאותה אנו ממליצים לך לרכוש,כוללת את הכיסויים הבאים:\nכיסוי לתרופות שאינן נכללות בסל התרופות הממלכתי.כיסוי לתרופות שאינן מכוסות בשל התוויה רפואית השונה מהצורך הרפואי של המבוטח,\nתרופה. LABEL OFFתרופת יתום.בדיקה גנטית להתאמת טיפול תרופתי למלחת הסרטן.שירות רפואי או טיפול רפואי הכרוך בנטילת או מתן\nהתרופה.תקרת הכיסוי צמודה למדד מחירי הצרכן.הפוליסה מתחדשת כל שנתיים ותקפה לכל החיים.הפרמיה החודשית משתנה בהתאם\nלקבוצת גיל ומתקבעת בגיל. 66בכיסוי הנ\"ל קיימת תקופת אכשרה בת 90יום וכן החרגות לכיסוי הביטוחי,החרגות בגין מצב רפואי קיים, תרופות מחוץ לסל\nהגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.כיסוי זה הינו כיסוי בסיס\nבריאות"
    },
    "transplants": {
      "label": "השתלות וטיפולים מיוחדים בחו\"ל",
      "text": "כיסוי לשיפוי בגין הוצאות רפואיות ונלוות להשתלות או לטיפולים מיוחדים מחוץ לישראל,גמלה חודשית למועמד להשתלה וגמלת מוצרי\nהחלמה,פיצוי חד פעמי להשתלה מחוץ לישראל ללא השתתפות המבטח )למעט השתלת מח עצמית.תקרת הכיסוי צמודה למדד מחירי השתלות וטיפולים בסיס\nהצרכן.הפוליסה מתחדשת כל שנתיים ותקפה לכל החיים.הפרמיה החודשית משתנה בהתאם לקבוצת גיל ומתקבעת בגיל. 66בכיסוי הנ\"ל מיוחדים בחו\"ל\nקיימת תקופת אכשרה בת 90יום וכן החרגות לכיסוי הביטוחי,החרגות בגין מצב רפואי קיים.כיסוי זה הינו כיסוי בסיס."
    },
    "surgeries_abroad": {
      "label": "ניתוחים וטיפולים מחליפי ניתוח בחו\"ל",
      "text": "ניתוחים פרטיים בחו\"ל,טיפולים ומחליפי ניתוח בחו\"ל 2,התייעצויות עם רופא מומחה בישראל,הוצאות הטסה רפואית,הוצאות הבאת מומחה\nרפואי לישראל לביצוע הניתוח בישראל ועוד.תקרת הכיסוי צמודה למדד מחירי הצרכן.הפוליסה מתחדשת כל שנתיים ותקפה לכל החיים. ניתוחים וטיפולים\nהפרמיה החודשית משתנה בהתאם לקבוצת גיל ומתקבעת בגיל. 66בכיסוי הנ\"ל קיימת תקופת אכשרה בת 90ימים,החרגות בגין מצב רפואי מחליפי ניתוח בחו\"ל\nקיים,הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.כיסוי זה הינו כיסוי בסיס."
    },
    "surgeries_israel": {
      "label": "ניתוחים בארץ",
      "text": "אני מבקש לציין בפניך כי פוליסת הבריאות הבסיסית אינה כוללת כיסוי ביטוחי בגין ביצוע ניתוחים פרטיים בישראל,בין היתר,\nלאחר צירוף לפוליסה בריאות בסיסית\nמכיוון שכיסוי לניתוחים בישראל ניתן במסגרת השב\"ן\".\nיש להבהיר למועמד:\nכיסוי מעל הזכאות בשב\"ן להוצאות רפואיות בישראל הקשורות לניתוחים,התייעצויות ולטיפולים מחליפי ניתוח בישראל באמצעות רופא\nו /או מוסד רפואי אשר יש למבטח עמו הסדר ניתוח או הסדר התייעצות,לפי העניין הכול לאחר ומעבר לתשלום בכפוף להשתתפות ניתוחים וטיפולים מחליפי\nעצמית על פי תנאי תכנית הביטוח. ניתוח בישראל משלים שב\"ן\nתקרת הכיסוי צמודה למדד מחירי הצרכן.הפוליסה מתחדשת כל שנתיים ותקפה לכל החיים.הפרמיה החודשית משתנה בהתאם לקבוצת גיל עם השתתפות עצמית בסך\nומתקבעת בגיל. 60בכיסוי הנ\"ל קיימת תקופת אכשרה בת 90ימים,במקרה הקשור להריון או לידה 12חודשים וכן החרגות לכיסוי הביטוחי, ₪ 5,000\nהחרגות בגין מצב רפואי קיים,הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.\nכיסוי מעל הזכאות בשב\"ן להוצאות רפואיות בישראל הקשורות לניתוחים,התייעצויות ולטיפולים מחליפי ניתוח בישראל באמצעות רופא\nו /או מוסד רפואי אשר יש למבטח עמו הסדר ניתוח או הסדר התייעצות לפי העניין.רובד משלים לתכנית השב\"ן בה המבוטח חבר,\nהלוקח בחשבון את מימון ההשתתפות של קופת החולים בהוצאות מקרה הביטוח בהתאם לתכנית השב\"ן בה חבר המבוטח.שכר\nמנתח,הוצאות רפואיות הנדרשות לשם ביצוע הניתוח ולאשפוז הנלווה לביצועו בבית חולים פרטי או במרפאה כירורגית פרטית,לרבות ניתוחים וטיפולים מחליפי\nשכר רופא מרדים,הוצאות חדר ניתוח,ציוד מתכלה,שתלים,תרופות במהלך הניתוח והאשפוז בדיקות שבוצעו כחלק מהניתוח והוצאות ניתוח בישראל משלים שב\"ן\nאשפוז ועוד. ללא השתתפות עצמית\nתקרת הכיסוי צמודה למדד מחירי הצרכן.הפוליסה מתחדשת כל שנתיים ותקפה לכל החיים.הפרמיה החודשית משתנה בהתאם לקבוצת גיל\nומתקבעת בגיל. 66בכיסוי הנ\"ל קיימת תקופת אכשרה בת 90ימים,במקרה הקשור להריון או לידה 12חודשים וכן החרגות לכיסוי הביטוחי,\nהחרגות בגין מצב רפואי קיים,הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.\nכיסוי בישראל להוצאות רפואיות הקשורות בניתוח,התייעצויות וטיפול מחליף ניתוח שבוצעו בישראל באמצעות רופא ו/או מוסד רפואי,\nאשר יש למבוטח עמו הסדר ניתוח או הסדר התייעצות,לפי העניין.שלוש התייעצויות בכל שנת ביטוח ועד לסך של ₪ 1,500להתייעצות\nניתוחים וטיפולים מחליפי אצל רופא שאינו בהסדר.טיפול מחליף ניתוח עד לתקרת עלות הניתוח המוחלף בישראל.\nניתוח בישראל שקל ראשון תקרת הכיסוי צמודה למדד מחירי הצרכן.הפוליסה מתחדשת כל שנתיים ותקפה לכל החיים.הפרמיה החודשית משתנה בהתאם\nללא השתתפות עצמית לקבוצת גיל ומתקבעת בגיל.66בכיסוי הנ\"ל קיימת תקופת אכשרה בת 90ימים,במקרה הקשור להריון או לידה 12חודשים וכן\nהחרגות לכיסוי הביטוחי,החרגות בגין מצב רפואי קיים,הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.כיסוי זה הינו כיסוי בריאות"
    },
    "ambulatory": {
      "label": "אמבולטורי / ייעוץ ובדיקות",
      "text": "ייעוץ ובדיקות אבחנתיות,התייעצויות עם רופא מומחה במספר מסלולים:מסלול התייעצות עם נותן שירות בהסכם,התייעצות בתור\nמהיר,התייעצות עם פסיכיאטר,בדיקות אבחנתיות כולל שירות מהיר לביצוע בדיקות אבחנתיות על פי רשימה אצל נותן שירות בהסכם.\nייעוץ ובדיקות -בסיס הפוליסה מתחדשת כל שנתיים ותקפה לכל החיים.הפרמיה החודשית משתנה בהתאם לקבוצת גיל ומתקבעת בגיל.71בכיסוי הנ\"ל\nקיימת תקופת אכשרה בת 90ימים,החרגות בגין מצב רפואי קיים,הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.\nהתייעצויות עם רופא מומחה במספר מסלולים:מסלול התייעצות עם נותן שירות בהסכם,התייעצות בתור מהיר,התייעצות עם נותן\nשירות אחר,התייעצות עם פסיכיאטר,חוו\"ד רפואית שניה בחו\"ל,התייעצות עם רופא /פסיכולוג קליני בבעיות שינה,הכוונה בנושא\nרופאים מומחים,בדיקות אבחנתיות כולל שירות מהיר לביצוע בדיקות אבחנתיות על פי רשימה אצל נותן שירות בהסכם,שירותים נוספים\nבעת ביצוע בדיקה אבחנתית:חוות דעת נוספת של רדיולוג מומחה,החזר הוצאות הרדמה,אבחון וייעוץ גנטי למחלות תורשתיות,\nהשתתפות בהפריה חוץ גופית )מילד שלישי(,בדיקות אבחנתיות לנשים בהריון,שירותי סל הריון:בדיקות גנטיות,שמירת דם טבורי,\nייעוץ ובדיקות -מורחב\nבדיקות סקר מנהלים וסקר סרטן )מגיל,( 20בדיקות רפואה מונעת ו T.Cקרדיאלי לצרכי מניעה למבוטח מעל גיל.45הפוליסה\nמתחדשת כל שנתיים ותקפה לכל החיים.הפרמיה החודשית משתנה בהתאם לקבוצת גיל ומתקבעת בגיל.71בכיסוי הנ\"ל קיימת\nתקופת אכשרה בת 90ימים,במקרה הקשור להריון או לידה,בדיקת סקר מנהלים ובדיקת סקר סרטן 12חודשים וכן החרגות לכיסוי"
    },
    "alt_medicine": {
      "label": "רפואה משלימה",
      "text": "שירותי רפואה משלימה הכלולים בכתב שירות זה:אוסטיאופתיה,יעוץ דיאטטי,כירופרקטיקה,פלדנקרייז,הומיאופתיה,שיטת אלכסנדר,\nביופידבק,נטורופתיה,איורוודה,פרחי באך,שיטת פאולה,אקופוקנטורה,רפלקסולוגיה,שיאצו,סוגו'ק,חדרי מלח,פאלם תרפי,רייקי,\nטיפול במגנטים,דיקור יפני,צ'יגונג,היפונוזה והומוטוקסקולוגיה.הפוליסה מתחדשת כל שנתיים ותקפה לכל החיים.פרמיה קבועה לילד, כתב שירות רפואה\nמגיל 21פרמיה קבועה למבוגר.בכיסוי הנ\"ל קיימת תקופת אכשרה בת 90ימים,החרגות בגין מצב רפואי קיים,הגבלות לסכומי ביטוח משלימה\nוהשתתפות עצמית בחלק מן הכיסויים."
    },
    "service": {
      "label": "כתב שירות / שירותים נלווים",
      "text": "כתב שירות לשירותי אבחון מהיר אצל ספקים שבהסכם ושירותי תמיכה וסיוע בעת אשפוז בבית חולים ולאחר שחרור מאשפוז.\nהפוליסה מתחדשת כל שנתיים ותקפה לכל החיים.פרמיה קבועה לילד,מגיל 21פרמיה קבועה למבוגר.בכיסוי הנ\"ל קיימת תקופת\nכתב שירות אבחון מהיר\nאכשרה בת 90ימים,החרגות בגין מצב רפואי קיים,הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.\nכתב שירות לשירותי ייעוץ מקוון מרופא מומחה מייעץ בהסכם כולל שירות איסוף מידע רפואי מהמנוי טרם הייעוץ המקוון,וכן ייעוץ מקוון בריאות\nמרופא משפחה או רופא ילדים.ייעוץ מקוון עם תזונאי (דיאטן),ייעוץ מקוון נפשי,ייעוץ מקוון תרופתי,ייעוץ מקוון ליולדת,ייעוץ מקוון\nכתב שירות ייעוץ אונליין להדרכת הורים.הפוליסה מתחדשת כל שנתיים ותקפה לכל החיים.פרמיה קבועה לילד,מגיל 21פרמיה קבועה למבוגר.בכיסוי הנ\"ל\nקיימת תקופת אכשרה בת 90ימים,החרגות בגין מצב רפואי קיים,הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים."
    },
    "critical_illness": {
      "label": "מחלות קשות",
      "text": "פוליסת ביטוח מחלות קשות מסוג \"מזור מורחב\" אותה אנו ממליצים לך לרכוש כוללת את הכיסויים הבאים:\nבמסגרת הכיסוי תקבל פיצוי חד פעמי מלא בסכום של ____ ₪בעת גילוי מחלה קשה מתוך רשימה אחת מבין 44מחלות שונות המחולקות ל2-\nקבוצות.במידה והמחלה הינה אחת ממחלות קבוצה, 1ישולם סכום הביטוח המלא והפוליסה תבוטל.במידה והמחלה הינה אחת ממחלות\nקבוצה, 2תהיה זכאי למקרה ביטוח שונה נוסף,עד 3מקרי ביטוח,לאחר תקופת אכשרה של שנה מיום המקרה הביטוחי הראשון.\nתוקף הביטוח הינו עד גיל. 75הפוליסה מתחדשת כל שנתיים.\nמזור מורחב\nהחל מגיל 70הפיצוי קטן ב. 50%-\nהפרמיה משתנה עפ\"י קבוצת גיל כל 5שנים ומתקבעת בגיל. 65\nקיימת תקופת אכשרה בת 90יום.למקרה ביטוח שני קיימת תקופת אכשרה של שנה מיום המקרה הביטוחי הראשון,למקרה שני של מחלת\nהסרטן -תקופת אכשרה בת 5שנים ממועד ההחלמה ממקרה הביטוח הראשון. מחלות\nחשוב לי להבהיר כי גם במידה ויש לך כבר ביטוח כזה,סכומי הביטוח מצטברים וביטוח אחד אינו גורע מהאחר.כיסוי זה הינו כיסוי בסיס. קשות"
    },
    "cancer": {
      "label": "סרטן",
      "text": "פוליסת ביטוח מסוג \"מזור לסרטן\" אותה אנו ממליצים לך לרכוש כוללת את הכיסויים הבאים:\nבעת גילוי מחלת הסרטן,תקבל פיצוי חד פעמי בסכום של ____.₪פיצוי מלא ל 2-מקרים של מחלת הסרטן.סקר סרטן לגילוי מוקדם למניעת\nמחלת הסרטן.\nתוקף הביטוח הינו עד גיל. 75החל מגיל 70הפיצוי קטן ב. 50%-ייתכנו מקרים של גילוי מוקדם בהם סכום הפיצוי יעמוד על 20%מסכום\nמזור לסרטן\nהביטוח.הפרמיה משתנה עפ\"י גיל המבוטח ומתקבעת בגיל. 65\nקיימת תקופת אכשרה בת 90יום.למקרה ביטוח שני קיימת תקופת אכשרה של 5שנים ממועד ההחלמה ממקרה הביטוח הראשון.סקר סרטן\nקיימת תקופת אכשרה של 12חודשים ממועד תחילת הביטוח.\nחשוב לי להבהיר כי גם במידה ויש לך כבר ביטוח כזה,סכומי הביטוח מצטברים וביטוח אחד אינו גורע מהאחר.כיסוי זה הינו כיסוי בסיס."
    },
    "risk": {
      "label": "ריסק",
      "text": "פוליסת ביטוח החיים אותה אנו ממליצים לך לרכוש הינה מסוג אור 1/5ריזיקו מתחדש /ריסק משולב.\nבהתאם למאפייניך האישיים:גילך,עיסוקך ומצבך המשפחתי,ראינו כי סכום הביטוח המתאים עבורך למקרה מוות הינו _____.₪\nאור 1/5ריזיקו /ריסק משולב (הפוליסה הינה עד גיל ___ (לפי הרשום בטופס ההצעה).\nישנו סייג אחד בפוליסה לגבי התאבדות בשנה הראשונה.\nהפרמיה צמודה למדד ומשתנה מידי שנה (אור / )1כל 5שנים (אור )5בהתאם לגיל המבוטח."
    },
    "mortgage": {
      "label": "משכנתא",
      "text": "פוליסת ביטוח משכנתא אותה אנו ממליצים לך לרכוש כוללת ביטוח חיים,הנותן מענה במקרים בהם הלווים יצטרכו להפסיק את תשלומי\nהמשכנתא.במקרה של מוות חלילה,חברת הביטוח תדאג לשלם את יתרת ההלוואה לבנק,ובכך תפטור את הלווה הנותר מהמשך תשלומי\nהמשכנתא לבנק ותקטין את הנטל הכלכלי מהמשפחה.\nישנו סייג אחד בפוליסה לגבי התאבדות בשנה הראשונה.\nמשכנתא\nע\"פ הנתונים שבידינו:המוטב הבלתי חוזר הוא בנק _____ סניף מספר _____ כתובת הסניף _______.\nיתרת ההלוואה היא ______ ₪לתקופה של ____ שנים עם ריבית קבועה/משתנה של ___.%\nביטוח מבנה:בביטוח זה מבוטח מבנה הדירה מפני סיכונים המפורטים בפוליסה כגון אש,התפוצצות,נזקי טבע וכו':\nסכום ביטוח המבנה בערך כינון _______.₪כתובת הדירה ______,בית פרטי /קומה ____ מתוך __.גודל הדירה ___מ\"ר."
    },
    "umbrella": {
      "label": "מטריה ביטוחית",
      "text": "פוליסת הביטוח מטריה ביטוחית מעניקה לך,בהתאם לבחירתך ובכפוף לאישור החברה:כיסוי למקרה של אובדן כושר עבודה,על-פי הגדרת\nעיסוק ספציפי – מאושר רק לעיסוקים שהוגדרו על-ידי החברה.\nכיסוי לתקופת אכשרה – תשלום פיצוי במקרה של דחיית התביעה על-ידי קרן הפנסיה בשל העובדה שמדובר במקרה ביטוח שהתרחש בתקופת\nהאכשרה בקרן הפנסיה.\nכיסוי לביטול קיזוז ביטוח לאומי על-ידי קרן הפנסיה – כיסוי משלים לקרן הפנסיה,במקרה של זכאות לתשלום על-ידי המוסד לביטוח לאומי, מטריה ביטוחית\nעקב תאונת עבודה או מחלה. חיים\nשחרור מההפקדות לקרן הפנסיה ( בכיסויים לתקופת אכשרה ולהגדרת עיסוק ספציפי) ושחרור מתשלום הפרמיה​.\nתוקף הביטוח עד גיל פרישה.\nהפרמיה צמודה למדד ומשתנה מדי שנה בהתאם לגיל המבוטח."
    },
    "disability_income": {
      "label": "אובדן כושר עבודה",
      "text": "בפוליסת אובדן כושר עבודה במעמד עצמאי אותה אנו ממליצים לך לרכוש,אתה מצהיר כי:\nההכנסה מעבודה שאתה צפוי להרוויח תעמוד על סך של ______ ₪לחודש.ידוע לך כי בקרות מקרה הביטוח יוגבלו תגמולי הפיצוי אובדן כושר עבודה -פיצוי\nהחודשי להם תהיה זכאי לגובה שלא יעלה על 75%מהכנסתך מעבודה בפועל ב 12-החודשים שקדמו למועד קרות מקרה הביטוח,או ושחרור בלבד\nבתקופה ממועד תחילת הביטוח ועד מועד קרות מקרה הביטוח,אם חלפו פחות מ 12-חודשים."
    },
    "accident_disability": {
      "label": "נכות מתאונה",
      "text": "פוליסת ביטוח החיים אותה אנו ממליצים לך לרכוש הינה מסוג נכות עקב תאונה:\nכיסוי למקרה שהמבוטח יהפוך לבעל נכות מלאה ותמידית או נכות חלקית ותמידית,עקב תאונה,ובלבד שהתאונה מהווה,בלא תלות\nבכל סיבה אחרת,את הסיבה היחידה הישירה והמיידית לנכותו של המבוטח והמבוטח נותר בחיים 30יום לאחר מועד התאונה. נכות מתאונה\nסכום הביטוח הינו _____.₪\nתום תקופה לכיסוי נכות מתאונה -גיל המבוטח בהתאם ליום הולדתו ה.65 -"
    },
    "accident_death": {
      "label": "מוות מתאונה",
      "text": "פוליסת ביטוח החיים אותה אנו ממליצים לך לרכוש הינה מסוג מוות עקב תאונה:\nתכנית ביטוח המעניקה למוטבים את סכום הביטוח בתשלום חד פעמי במקרה של מות המבוטח עקב תאונה,כהגדרתה בתנאי\nהפוליסה. מוות מתאונה\nסכום הביטוח הינו _____.₪\nתקופת הביטוח תסתיים עד גיל 65של המבוטח או עד תום תקופת הביטוח היסודי – לפי המוקדם מביניהם"
    }
  },
  "הראל": {
    "meds": {
      "label": "תרופות מחוץ לסל",
      "text": `פוליסת ביטוח בריאות מסוג ___________ שאותה אנו ממליצים לך לרכוש, כוללת את הכיסויים הבאים:
תרופות מחוץ לסל הבריאות
כיסוי לרכישת תרופות שאינן כלולות בסל שירותי הבריאות, או שאינן מכוסות בסל הבריאות בגין התוויה רפואית השונה מהצורך הרפואי של המבוטח, ועפ"י סוגי התרופות כמפורט בתנאי הפוליסה, וכן כיסוי להשתתפות עצמית לתרופות מיוחדות שנרכשו בשב"ן. עבור תרופות שאינן בסל הבריאות- 500 ₪ השתתפות עצמית, עבור תרופות יתום ו- OFF LABEL- 300 ₪ השתתפות עצמית. הפוליסה מתחדשת כל שנתיים. הפרמיה החודשית משתנה בהתאם לקבוצת גיל ומתקבעת בגיל 66. כל תקרות הכיסויים צמודות למדד מחירי הצרכן. בכיסוי זה קיימת תקופת אכשרה בת 90 ימים וכן ייתכנו החרגות לכיסוי הביטוחי בעקבות מצב רפואי קיים, הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים. כיסוי זה הינו כיסוי בסיס.`
    },
    "transplants": {
      "label": "השתלות וטיפולים מיוחדים בחו\"ל",
      "text": `השתלות וטיפולים מיוחדים בחו"ל
כיסוי לשיפוי בגין הוצאות רפואיות ונלוות הקשורות בהשתלה או לטיפול המיוחד כמפורט בתוכנית לרבות הוצאות לצוות הרפואי, הוצאות טיסה ושהיה, קצבה חודשית למועמד להשתלה וגמלת החלמה על פי תנאי הפוליסה. הפוליסה מתחדשת כל שנתיים. הפרמיה החודשית משתנה בהתאם לקבוצת גיל ומתקבעת בגיל 66. כל תקרות הכיסויים צמודות למדד מחירי הצרכן. בכיסוי זה קיימת תקופת אכשרה בת 90 ימים וכן ייתכנו החרגות לכיסוי הביטוחי בעקבות מצב רפואי קיים, הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים. כיסוי זה הינו כיסוי בסיס.`
    },
    "surgeries_abroad": {
      "label": "ניתוחים בחו\"ל",
      "text": `ניתוחים בחו"ל
כיסוי להוצאות רפואיות הקשורות בניתוח בחו"ל, וכן להוצאות נלוות כמפורט בנספח. כיסוי מלא במקרה של ניתוח מול מנתח הסכם. כיסוי מול מנתח שאינו בהסכם – יינתן שיפוי עד 250% מעלות אותו הניתוח בישראל. הפוליסה מתחדשת כל שנתיים. הפרמיה החודשית משתנה בהתאם לקבוצת גיל ומתקבעת בגיל 66. כל תקרות הכיסויים צמודות למדד מחירי הצרכן. בכיסוי זה קיימת תקופת אכשרה בת 90 ימים וכן ייתכנו החרגות לכיסוי הביטוחי בעקבות מצב רפואי קיים, הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים. כיסוי זה הינו כיסוי בסיס.`
    },
    "surgeries_israel": {
      "label": "ניתוחים בישראל",
      "text": `לאחר צירוף לפוליסה בריאות בסיסית יש להבהיר למועמד:
אני מבקש לציין בפניך כי פוליסת הבריאות הבסיסית אינה כוללת כיסוי ביטוחי בגין ביצוע ניתוחים פרטיים בישראל, בין היתר, מכיוון שכיסוי לניתוחים בישראל ניתן במסגרת השב"ן.

ניתוחים וטיפולים מחליפי ניתוח בישראל משלים שב"ן כולל השתתפות עצמית בגובה ₪ 5,000
כיסוי מעל הזכאות בשב"ן בגין הוצאות רפואיות בישראל הקשורות בניתוח, התייעצויות וטיפול מחליף ניתוח שבוצעו בישראל באמצעות רופא ו/או מוסד רפואי, אשר יש למבטח עמו הסדר ניתוח או הסדר התייעצות, לפי העניין, ובניכוי השתתפות עצמית למקרה ביטוח בגובה 5,000 ₪. תקופת הביטוח מתחדשת כל שנה. בנספח זה קיימת תקופת אכשרה בת 90 ימים – לניתוחים, התייעצות וטיפולים מחליפי ניתוח בנוגע להריון ולידה 12 חודשים, וכן ייתכנו החרגות לכיסוי הביטוחי בעקבות מצב רפואי קיים, הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.

ניתוחים וטיפולים מחליפי ניתוח בישראל משלים שב"ן
כיסוי מעל לזכאות בשב"ן בגין ביצוע ניתוח, התייעצויות וטיפול מחליף ניתוח באמצעות רופא ו/או מוסד רפואי שבהסדר. שלוש התייעצויות בכל שנת ביטוח ועד לסך של 1,500 ₪ להתייעצות אצל רופא שאינו בהסדר. טיפול מחליף ניתוח עד לתקרת עלות הניתוח המוחלף בישראל. לצורך מימוש הכיסוי בגין ניתוח יהיה עליך לפנות לקופת החולים למימוש זכויותיך עפ"י תכנית שירותי הבריאות הנוספים בה אתה חבר, וכן לפנות למבטח למימוש זכויותיך. הכיסוי מהווה ביטוח משלים. המבטח ישלם את ההפרש שבין ההוצאות בפועל של ניתוח המכוסה עפ"י הפוליסה, לבין ההוצאות המגיעות מהשב"ן וזאת עד לתקרה הקבועה בפוליסה. הפוליסה מתחדשת כל שנתיים. הפרמיה החודשית משתנה בהתאם לקבוצת גיל ומתקבעת בגיל 66. כל תקרות הכיסויים צמודות למדד מחירי הצרכן. בכיסוי זה קיימת תקופת אכשרה בת 90 ימים – לניתוחים, התייעצות וטיפולים מחליפי ניתוח בנוגע להריון ולידה 12 חודשים, וכן ייתכנו החרגות לכיסוי הביטוחי בעקבות מצב רפואי קיים, הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.

ניתוחים וטיפולים מחליפי ניתוח בישראל מהשקל הראשון
כיסוי להוצאות רפואיות בישראל הקשורות בניתוח, התייעצויות וטיפול מחליף ניתוח שבוצעו בישראל באמצעות רופא ו/או מוסד רפואי, אשר יש למבטח עמו הסדר ניתוח או הסדר התייעצות, לפי העניין. הפוליסה מתחדשת כל שנתיים. הפרמיה החודשית משתנה בהתאם לקבוצת גיל ומתקבעת בגיל 66. כל תקרות הכיסויים צמודות למדד מחירי הצרכן. בכיסוי זה קיימת תקופת אכשרה בת 90 ימים – לניתוחים, התייעצות וטיפולים מחליפי ניתוח בנוגע להריון ולידה 12 חודשים, וכן ייתכנו החרגות לכיסוי הביטוחי בעקבות מצב רפואי קיים, הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.`
    },
    "ambulatory": {
      "label": "אמבולטורי / ייעוץ ובדיקות",
      "text": `ייעוץ ובדיקות מורחב
השתתפות בהוצאות בהן נשא בפועל מבוטח הנזקק עקב בעיה רפואית, לקבלת חוות דעת רפואית, בדיקות אבחנתיות, בדיקות היריון, בדיקות מניעה ואבחון. הפוליסה מתחדשת כל שנתיים. הפרמיה החודשית משתנה בהתאם לקבוצת גיל ומתקבעת בגיל 75. כל תקרות הכיסויים צמודות למדד מחירי הצרכן. בכיסוי זה קיימת תקופת אכשרה בת 90 ימים – בנוגע להריון ולידה 12 חודשים, וכן ייתכנו החרגות לכיסוי הביטוחי בעקבות מצב רפואי קיים, הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.

ייעוץ ובדיקות בסיס
השתתפות בהוצאות בהן נשא בפועל מבוטח הנזקק עקב בעיה רפואית, לקבלת חוות דעת רפואית (ייעוץ רפואי יינתן במקרים מסוימים ברשת מומחים שבהסדר עם החברה), בדיקות אבחנתיות, בדיקות היריון, בדיקות מניעה ואבחון. הפוליסה מתחדשת כל שנתיים. הפרמיה החודשית משתנה בהתאם לקבוצת גיל ומתקבעת בגיל 66. כל תקרות הכיסויים צמודות למדד מחירי הצרכן. בכיסוי זה קיימת תקופת אכשרה בת 90 ימים – בנוגע להריון ולידה 12 חודשים, וכן ייתכנו החרגות לכיסוי הביטוחי בעקבות מצב רפואי קיים, הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.`
    },
    "service": {
      "label": "כתב שירות / שירותים נלווים",
      "text": `אבחון רפואי מהיר
מעניק למנוי שירות אבחון רפואי מהיר בבית חולים פרטי שבהסכם עם המבטח, במגוון מצבים רפואיים ומחלות. האבחון מתבצע על־ידי רופא מומחה וכולל ביצוע של בדיקות רפואיות אבחנתיות נדרשות, תוך זמן קצר, לרבות קבלת דו"ח אבחון בסיום התהליך. השירות ניתן אצל ספק שירות בהסכם עם המבטח בלבד. תקופת הביטוח מתחדשת כל שנה. הפרמיה קבועה וצמודה למדד המחירים לצרכן. בנספח זה קיימת תקופת אכשרה בת 60 ימים וכן ייתכנו החרגות לכיסוי הביטוחי בעקבות מצב רפואי קיים, הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.

רופא מלווה אישי
השתתפות בהוצאות בישראל בהן נשא בפועל מבוטח הנזקק עקב אירוע רפואי שהנו ניתוח, או אשפוז מעל 3 לילות ברציפות, או במגוון מצבים רפואיים ומחלות קשות כהגדרתה בתנאים. וכן שירות ליווי רפואי במצבים הרפואיים המפורטים בתנאים, למשך 3 חודשים. השירות ניתן אצל ספק שירות בהסכם עם המבטח בלבד. הפרמיה היא קבועה וצמודה למדד המחירים לצרכן. תקופת הביטוח מתחדשת כל שנה. בנספח זה קיימת תקופת אכשרה 90 ימים וכן ייתכנו החרגות לכיסוי הביטוחי בעקבות מצב רפואי קיים, הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.

ביקור רופא בבית
שירות זה מאפשר למנוי בשעות הפעילות, לקבל שירות רפואי בבית או במקום המצאו של המנוי, על ידי רופא נותן שירות, כולל מתן מרשם לתרופות על פי החלטת הרופא, ולבצע בדיקות מעבדה בבית כגון לקיחת דמים, על פי המפורט בנספח השירות. השירות ניתן אצל ספק שירות בהסכם עם המבטח בלבד. השירותים כוללים תשלום השתתפות עצמית, הפרמיה צמודה למדד המחירים לצרכן.`
    },
    "alt_medicine": {
      "label": "רפואה משלימה",
      "text": `רפואה משלימה
כתב השירות מאפשר קבלת 12 טיפולים בשנת ביטוח, מתחום הרפואה המשלימה בין היתר בתחומים הבאים: הומיאופתיה, אקופונקטורה, כירופרקטיקה, אוסטיאופתיה, רפלקסולוגיה. השירות כרוך בהשתתפות עצמית. הפרמיה היא קבועה וצמודה למדד המחירים לצרכן. תקופת הביטוח מתחדשת כל שנה. בנספח זה קיימת תקופת אכשרה בת 90 ימים וכן ייתכנו החרגות לכיסוי הביטוחי בעקבות מצב רפואי קיים, הגבלות לסכומי ביטוח והשתתפות עצמית בחלק מן הכיסויים.`
    },
    "critical_illness": {
      "label": "מחלות קשות",
      "text": `פוליסת ביטוח מחלות קשות מסוג "מענקית זהב" אותה אנו ממליצים לך לרכוש כוללת את הכיסויים הבאים:
במסגרת הכיסוי תקבל פיצוי חד פעמי מלא בסכום של ____ ₪ בעת גילוי מחלה קשה מתוך רשימה אחת מבין 39 מחלות שונות המחולקות ל־4 קבוצות. במידה והמחלה הינה אחת ממחלות קבוצה 1, ישולם סכום הביטוח המלא והפוליסה תבוטל. במידה והמחלה הינה אחת מהמחלות שבקבוצות האחרות, תמשיך להיות מבוטח בגין מחלה נוספת מהקבוצות הנותרות למעט קבוצה 1 ולמעט הקבוצה ממנה התקבל התגמול הראשון. לאחר תשלום פיצוי שני – הפוליסה תבוטל. במקרה של גילוי סרטן שד מקומי או ביצוע ניתוח סרטן ערמונית, ניתן לקבל פיצוי בגובה 20% מסכום הביטוח. הפוליסה מעניקה פיצוי נוסף בגובה 25% מסכום הביטוח בגין מקרה שני של מחלת הסרטן, לאחר 5 שנים. בהגיע המבוטח לגיל 65 יוקטן סכום הביטוח מדי שנה בשיעור 5% מסכום הביטוח. החברה לא תהא חייבת בתשלום סכום ביטוח אם המבוטח נפטר תוך 14 יום מקרות מקרה הביטוח, למעט במקרה של השתלת איברים. קיימת תקופת אכשרה בת 90 יום. למקרה ביטוח שני קיימת תקופת אכשרה של 180 יום מיום קרות מקרה הביטוח הראשון. תוקף הביטוח הינו עד גיל 75. הפוליסה מתחדשת כל שנתיים. הפרמיה משתנה עפ"י גיל המבוטח ומתקבעת בגיל 65. לידיעתך – בכיסוי הנ"ל קיימות החרגות לכיסוי הביטוחי, החרגות בגין מצב רפואי קיים והגבלות לסכומי ביטוח. חשוב לי להבהיר כי גם במידה ויש לך כבר ביטוח כזה, סכומי הביטוח מצטברים וביטוח אחד אינו גורע מהאחר. כיסוי זה הינו כיסוי בסיס.`
    },
    "cancer": {
      "label": "סרטן",
      "text": `פוליסת ביטוח מסוג "מענקית סרטן" אותה אנו ממליצים לך לרכוש כוללת את הכיסויים הבאים:
בעת גילוי מחלת הסרטן, תקבל פיצוי חד פעמי בסכום של ____ ₪. במקרה של גילוי סרטן שד מקומי או בעת ביצוע ניתוח סרטן ערמונית, ניתן לקבל פיצוי בגובה של 15% מסכום הביטוח, שיקוזז מסכום הביטוח המלא. הפוליסה מעניקה פיצוי נוסף בגובה 25% מסכום הביטוח בגין מקרה שני של מחלת הסרטן, לאחר 5 שנים. בהגיע המבוטח לגיל 65 יוקטן סכום הביטוח מדי שנה בשיעור 5% מסכום הביטוח. החברה לא תהא חייבת בתשלום סכום ביטוח אם המבוטח נפטר תוך 14 יום מקרות מקרה הביטוח, למעט במקרה של השתלת איברים. קיימת תקופת אכשרה בת 90 יום. תוקף הביטוח הינו עד גיל 75. הפרמיה משתנה עפ"י גיל המבוטח ומתקבעת בגיל 65. לידיעתך – בכיסוי הנ"ל קיימות החרגות לכיסוי הביטוחי, החרגות בגין מצב רפואי קיים והגבלות לסכומי ביטוח. חשוב לי להבהיר כי גם במידה ויש לך כבר ביטוח כזה, סכומי הביטוח מצטברים וביטוח אחד אינו גורע מהאחר. כיסוי זה הינו כיסוי בסיס.`
    },
    "risk": {
      "label": "ריסק / חיים",
      "text": `פוליסת ביטוח החיים אותה אנו ממליצים לך לרכוש הינה מסוג מגן / מגן זוגי extra / מגן חודשי / מגן חודשי זוגי / חוסן למחר פלוס – בהתאם למסלול שנבחר בטופס ההצעה.
בהתאם למאפייניך האישיים: גילך, עיסוקך ומצבך המשפחתי, ראינו כי סכום הביטוח המתאים עבורך למקרה מוות הינו ________ ₪. הפוליסה הינה בתוקף עד גיל 80, ולחוסן למחר פלוס עד גיל 70. האם אתה מאשר שקיבלת את מסמך "השתנות פרמיה אישית" המציג את הפרמיה לתשלום בכל גיל? ____. ישנו סייג אחד בפוליסה לגבי התאבדות בשנה הראשונה. הפרמיה צמודה למדד. במסלולים זוגיים ובמסלולי חודשי קיימות ההרחבות המפורטות בטופס, לרבות הכפלת סכום הביטוח לבן הזוג הנותר, אפשרות הגדלה בהולדת ילד, ותשלום כפול במקרים המפורטים במסלול.`
    },
    "mortgage": {
      "label": "משכנתא",
      "text": `פוליסת ביטוח משכנתא אותה אנו ממליצים לך לרכוש כוללת ביטוח חיים, הנותן מענה במקרים בהם הלווים יצטרכו להפסיק את תשלומי המשכנתא. במקרה של מוות חלילה, חברת הביטוח תדאג לשלם את יתרת ההלוואה לבנק, ובכך תפטור את הלווה הנותר מהמשך תשלומי המשכנתא לבנק ותקטין את הנטל הכלכלי מהמשפחה. ע"פ הנתונים שבידינו: המוטב הבלתי חוזר הוא בנק ____ סניף מספר ___ כתובת הסניף _______. יתרת ההלוואה היא ______ ₪ לתקופה של ___ שנים עם ריבית קבועה/משתנה של ___.% ישנו סייג אחד בפוליסה לגבי התאבדות בשנה הראשונה. ביטוח החיים תקף לתקופת המשכנתא, אך לא מעבר לגיל 85. הפרמיה צמודה למדד ומשתנה מדי שנה.`
    },
    "umbrella": {
      "label": "מטריה ביטוחית",
      "text": `פוליסת הביטוח הראל מטריה ביטוחית מעניקה לך, בהתאם לבחירתך ובכפוף לאישור החברה: כיסוי למקרה של אובדן כושר עבודה, על־פי הגדרת עיסוק ספציפי – מאושר רק לעיסוקים שהוגדרו על־ידי החברה. כיסוי לתקופת אכשרה – תשלום פיצוי במקרה של דחיית התביעה על־ידי קרן הפנסיה בשל העובדה שמדובר במקרה ביטוח שהתרחש בתקופת האכשרה בקרן הפנסיה. כיסוי לביטול קיזוז ביטוח לאומי על־ידי קרן הפנסיה – כיסוי משלים לקרן הפנסיה, במקרה של זכאות לתשלום על־ידי המוסד לביטוח לאומי, עקב תאונת עבודה או מחלה. שחרור מההפקדות לקרן הפנסיה (בכיסויים לתקופת אכשרה ולהגדרת עיסוק ספציפי) ושחרור מתשלום הפרמיה. תוקף הביטוח עד גיל פרישה. הפרמיה צמודה למדד ומשתנה מדי שנה בהתאם לגיל המבוטח.`
    },
    "accident_death": {
      "label": "מוות מתאונה",
      "text": `פוליסת ביטוח החיים אותה אנו ממליצים לך לרכוש הינה מסוג מוות מתאונה:
סכום ביטוח חד פעמי למקרה מוות כתוצאה מתאונה, שארע בתקופה של עד 3 שנים ממועד התאונה. במות שני הורים, המבוטחים במסגרת הכיסוי, כתוצאה מתאונה ולהם ילד אחד לפחות מתחת לגיל 21 (במועד המוות של ההורה השני), ישולם סכום ביטוח נוסף בגובה 50% מסכום הביטוח של כל אחד מהם. תוקף הביטוח הינו עד גיל 75.`
    },
    "accident_disability": {
      "label": "נכות מתאונה",
      "text": `פוליסת ביטוח החיים אותה אנו ממליצים לך לרכוש הינה מסוג נכות מתאונה:
סכום ביטוח חד פעמי למקרה נכות כתוצאה מתאונה. שיעור הנכות יקבע ע"י רופא מומחה בהתאם לתקנה 11 לתקנות הביטוח הלאומי. השיעור שנקבע יוכפל בסכום הביטוח שנרכש, ללא הכפלה נוספת בטבלת איברים. תוקף הביטוח הינו עד גיל 75.`
    },
    "family_income": {
      "label": "הכנסה למשפחה",
      "text": `פוליסת ביטוח החיים אותה אנו ממליצים לך לרכוש הינה מסוג הכנסה למשפחה:
הכנסה חודשית קבועה ע"ס ________ ₪ אשר תשולם במשך התקופה שהוגדרה למוטבים בפוליסה במקרה פטירה. סכום הביטוח ישולם ללא תלות בסכומים אחרים המגיעים למוטביך מפוליסות ביטוח אחרות. סכום הפיצוי החודשי צמוד למדד ושומר על ערכו עד מועד תחילת תשלום הפיצוי החודשי הראשון. לאחר מכן, הסכום ישולם בהתאם לתוצאות ההשקעה ועל פי תנאי התכנית. ישנו סייג אחד בפוליסה לגבי התאבדות בשנה הראשונה. תקופת הביטוח הינה בהתאם לתקופה שהוגדרה בהצטרפות ולכל המאוחר עד גיל 80.`
    },
    "disability_income": {
      "label": "אובדן כושר עבודה",
      "text": `בפוליסת אובדן כושר עבודה במעמד עצמאי אותה אנו ממליצים לך לרכוש, אתה מצהיר כי:
ההכנסה מעבודה שאתה צפוי להרוויח תעמוד על סך של ______ ₪ לחודש. ידוע לך כי בקרות מקרה הביטוח יוגבלו תגמולי הפיצוי החודשי להם תהיה זכאי לגובה שלא יעלה על 75% מהכנסתך מעבודה בפועל ב־12 החודשים שקדמו למועד קרות מקרה הביטוח, או בתקופה ממועד תחילת הביטוח ועד מועד קרות מקרה הביטוח, אם חלפו פחות מ־12 חודשים.`
    }
  }
};


  const ProcessesUI = {
    AUTO_REFRESH_MS: 3000,
    _autoRefreshHandle: null,
    _autoRefreshBusy: false,
    _lastAutoRefreshAt: 0,
    _realtimeChannel: null,
    _realtimeDebounceHandle: null,
    _realtimeConnected: false,
    _pendingRealtimeRefresh: false,

    init(){
      this.startAutoRefreshLoop();
      this.startRealtimeSync();
      document.addEventListener('visibilitychange', () => {
        if(document.hidden) return;
        if(this.shouldAutoRefresh()) this.refreshFromServer({ reason:'visibility' });
      });
      window.addEventListener('focus', () => {
        if(this.shouldAutoRefresh()) this.refreshFromServer({ reason:'focus' });
      });
    },

    currentScope(){
      const active = UI.els.myProcessesScope?.querySelector?.(".segmented__btn.is-active");
      return safeTrim(active?.getAttribute?.("data-process-scope")) || "all";
    },

    list(){
      const customers = Array.isArray(State.data?.customers) ? State.data.customers.slice() : [];
      return customers
        .filter(rec => this.isRelevant(rec))
        .sort((a,b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    },

    isRelevant(rec){
      if(!rec || !Auth.isOps()) return false;
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
      const verify = payload?.mirrorFlow?.verify || {};
      const disclosure = payload?.mirrorFlow?.disclosure || {};
      const payment = payload?.mirrorFlow?.payment || {};
      const issuance = payload?.mirrorFlow?.issuance || {};
      return !!(
        Number(rec?.newPoliciesCount || 0) > 0 ||
        safeTrim(rec?.status) ||
        payload?.mirrorFlow ||
        safeTrim(verify?.savedAt) ||
        safeTrim(disclosure?.savedAt) ||
        safeTrim(payment?.savedAt) ||
        safeTrim(issuance?.savedAt)
      );
    },

    filtered(){
      const q = safeTrim(UI.els.myProcessesSearch?.value).toLowerCase();
      const scope = this.currentScope();
      let rows = this.list().map(rec => this.mapRecord(rec));

      if(scope === "active"){
        rows = rows.filter(row => !row.isDone);
      } else if(scope === "urgent"){
        rows = rows.filter(row => row.isUrgent);
      }

      if(!q) return rows;
      return rows.filter(row => [
        row.customer.fullName,
        row.customer.idNumber,
        row.customer.phone,
        row.customer.agentName,
        row.statusText,
        row.typeText,
        row.stageText
      ].some(v => safeTrim(v).toLowerCase().includes(q)));
    },

    mapRecord(rec){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
      const verify = payload?.mirrorFlow?.verify || {};
      const disclosure = payload?.mirrorFlow?.disclosure || {};
      const health = payload?.mirrorFlow?.health || {};
      const payment = payload?.mirrorFlow?.payment || {};
      const issuance = payload?.mirrorFlow?.issuance || {};
      const call = payload?.mirrorFlow?.call || {};
      const progressStep = MirrorsUI?.getProgressStep?.(rec) || 1;
      const ops = getOpsStatePresentation(rec);
      let statusText = ops.finalLabel || ops.liveLabel || safeTrim(rec.status) || "תהליך חדש";
      let stageText = progressStep > 1 ? (MirrorsUI?.getStepTitle?.(progressStep) || "שיקוף") : "פתיחת תהליך";
      let typeText = "שיקוף / תפעול";
      let tone = ops.tone || "info";
      let isDone = !!ops.finalLabel;
      let isUrgent = safeTrim(ops.liveKey) === 'waiting' || safeTrim(ops.resultKey) === 'waitingAgentInfo' || !!call?.active;

      if(safeTrim(issuance?.savedAt)){
        statusText = "מוכן להפקה";
        stageText = "כניסה לתוקף";
        tone = "success";
        isDone = true;
      } else if(safeTrim(payment?.savedAt)){
        statusText = "ממתין להפקה";
        stageText = "אמצעי תשלום";
        tone = "info";
      } else if(safeTrim(health?.savedAt)){
        statusText = "ממתין לתשלום";
        stageText = "הצהרת בריאות";
        tone = "info";
      } else if(safeTrim(disclosure?.savedAt)){
        statusText = "ממתין להצהרת בריאות";
        stageText = "גילוי נאות";
        tone = "warn";
      } else if(safeTrim(verify?.cancelSavedAt)){
        statusText = "ממתין לגילוי נאות";
        stageText = "ביטול בחברה נגדית";
        tone = "warn";
      } else if(safeTrim(verify?.harConsent) === "yes"){
        statusText = "ביטול חברה נגדית";
        stageText = "שיקוף הר הביטוח";
        tone = "warn";
      } else if(verify?.reflectionOpened){
        statusText = "שיקוף פעיל";
        stageText = "אימות נתונים";
        tone = "info";
      } else if(call?.active){
        statusText = "שיחה פעילה";
        stageText = "פתיח שיחה";
        tone = "warn";
        isUrgent = true;
      } else if(safeTrim(rec.status).includes("שיקוף")){
        statusText = safeTrim(rec.status);
        tone = "warn";
      }

      if(safeTrim(rec.status).includes("ממתין")) isUrgent = true;
      if(safeTrim(rec.status).includes("בוצע")) isDone = true;
      if(safeTrim(rec.status).includes("חדש") && !safeTrim(verify?.savedAt) && !ops.finalLabel) tone = "info";
      if(safeTrim(ops.resultKey) === 'notInterested') tone = 'danger';
      if(safeTrim(ops.resultKey) === 'pendingSignatures') tone = 'success';

      const digits = String(rec.id || "").replace(/\D+/g, "");
      const processNumber = digits ? digits.slice(-4) : "—";

      return {
        customer: rec,
        processNumber,
        typeText,
        statusText,
        stageText,
        tone,
        isDone,
        isUrgent,
        updatedText: this.formatDate(rec.updatedAt || rec.createdAt)
      };
    },

    formatDate(value){
      if(!value) return "—";
      const d = new Date(value);
      if(Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString("he-IL", {
        year:"numeric",
        month:"2-digit",
        day:"2-digit",
        hour:"2-digit",
        minute:"2-digit"
      });
    },

    startRealtimeSync(){
      this.stopRealtimeSync();
      try {
        const client = Storage.getClient();
        const channelName = 'ops-myprocesses-customers-live';
        const queueRealtimeRefresh = (reason = 'realtime') => {
          this.queueRealtimeRefresh({ reason });
        };
        this._realtimeChannel = client
          .channel(channelName)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: SUPABASE_TABLES.customers
          }, () => {
            queueRealtimeRefresh('customers-change');
          })
          .subscribe((status) => {
            this._realtimeConnected = status === 'SUBSCRIBED';
            if(status === 'SUBSCRIBED') queueRealtimeRefresh('realtime-subscribed');
          });
      } catch(err) {
        console.error('MY_PROCESSES_REALTIME_INIT_FAILED:', err?.message || err);
        this._realtimeConnected = false;
      }
    },

    stopRealtimeSync(){
      if(this._realtimeDebounceHandle){
        window.clearTimeout(this._realtimeDebounceHandle);
        this._realtimeDebounceHandle = null;
      }
      const client = Storage.client;
      if(client && this._realtimeChannel){
        try { client.removeChannel(this._realtimeChannel); } catch(_e) {}
      }
      this._realtimeChannel = null;
      this._realtimeConnected = false;
      this._pendingRealtimeRefresh = false;
    },

    queueRealtimeRefresh(options = {}){
      const reason = safeTrim(options?.reason) || 'realtime';
      this._pendingRealtimeRefresh = true;
      if(this._realtimeDebounceHandle){
        window.clearTimeout(this._realtimeDebounceHandle);
      }
      this._realtimeDebounceHandle = window.setTimeout(() => {
        this._realtimeDebounceHandle = null;
        this.flushRealtimeRefresh({ reason });
      }, 120);
    },

    flushRealtimeRefresh(options = {}){
      if(!this._pendingRealtimeRefresh) return;
      if(this._autoRefreshBusy){
        this.queueRealtimeRefresh({ reason: options?.reason || 'realtime-busy-retry' });
        return;
      }
      if(this.hasBlockingUiOpen() || this.hasActiveOpsCall()){
        this.queueRealtimeRefresh({ reason: options?.reason || 'realtime-blocked-retry' });
        return;
      }
      this._pendingRealtimeRefresh = false;
      this.refreshFromServer({ reason: options?.reason || 'realtime', force:true });
    },

    startAutoRefreshLoop(){
      this.stopAutoRefreshLoop();
      this._autoRefreshHandle = window.setInterval(() => {
        if(!this.shouldAutoRefresh()) return;
        this.refreshFromServer({ reason:'interval' });
      }, this.AUTO_REFRESH_MS);
      if(this.shouldAutoRefresh()){
        this.refreshFromServer({ reason:'loop-start' });
      }
    },

    stopAutoRefreshLoop(){
      if(this._autoRefreshHandle){
        window.clearInterval(this._autoRefreshHandle);
        this._autoRefreshHandle = null;
      }
    },

    isMyProcessesViewActive(){
      return !!document.getElementById('view-myProcesses')?.classList.contains('is-visible');
    },

    hasBlockingUiOpen(){
      if(document.body.classList.contains('lcLeadShellOpen')) return true;
      if(document.querySelector('.modal.is-open, .drawer.is-open, .lcWizard.is-open')) return true;
      const blockingIds = [
        'customerFull',
        'customerPolicyModal',
        'lcArchiveCustomerModal',
        'lcForgotModal',
        'lcUserModal',
        'lcInsPicker',
        'lcCoversDrawer',
        'lcPolicyAddedModal',
        'lcPolicyDiscountModal',
        'lcLeadShell',
        'lcReport',
        'mirrorsSearchModal',
        'mirrorsStartModal',
        'systemRepairModal'
      ];
      return blockingIds.some((id) => {
        const el = document.getElementById(id);
        if(!el) return false;
        if(el.hidden === false) return true;
        if(el.classList?.contains('is-open') || el.classList?.contains('is-active') || el.classList?.contains('is-visible')) return true;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0;
      });
    },

    isUserInteracting(){
      const active = document.activeElement;
      if(active){
        const tag = String(active.tagName || '').toUpperCase();
        if(active.isContentEditable) return true;
        if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      }
      return false;
    },

    hasActiveOpsCall(){
      const selected = MirrorsUI?.current?.();
      const callState = selected ? MirrorsUI?.getCallState?.(selected) : null;
      return !!callState?.active;
    },

    shouldAutoRefresh(){
      if(!Auth.isOps()) return false;
      if(document.hidden) return false;
      if(!this.isMyProcessesViewActive()) return false;
      if(this._autoRefreshBusy) return false;
      if(this.hasBlockingUiOpen()) return false;
      if(this.hasActiveOpsCall()) return false;
      return true;
    },

    async refreshFromServer(options = {}){
      if(this._autoRefreshBusy) return { ok:false, skipped:true, reason:'busy' };
      if(!options.force && !this.shouldAutoRefresh()) return { ok:false, skipped:true, reason:'blocked' };
      this._autoRefreshBusy = true;
      try {
        const r = await Storage.loadSheets();
        if(r.ok){
          State.data = r.payload;
          Storage.saveBackup(State.data);
          this._lastAutoRefreshAt = Date.now();
          this.render();
          return { ok:true, at:r.at || nowISO() };
        }
        console.error('MY_PROCESSES_AUTO_REFRESH_FAILED:', r?.error || r);
        return r;
      } catch(err) {
        console.error('MY_PROCESSES_AUTO_REFRESH_FAILED:', err?.message || err);
        return { ok:false, error:String(err?.message || err) };
      } finally {
        this._autoRefreshBusy = false;
        if(this._pendingRealtimeRefresh && !this.hasBlockingUiOpen() && !this.hasActiveOpsCall()){
          this.flushRealtimeRefresh({ reason: 'realtime-after-refresh' });
        }
      }
    },

    renderSummary(rows){
      if(!UI.els.myProcessesSummary) return;
      const total = rows.length;
      const active = rows.filter(row => !row.isDone).length;
      const urgent = rows.filter(row => row.isUrgent).length;
      const ready = rows.filter(row => row.statusText === "מוכן להפקה").length;
      UI.els.myProcessesSummary.innerHTML = `
        <div class="lcMyProcessesStat">
          <div class="lcMyProcessesStat__label">סך הכול</div>
          <div class="lcMyProcessesStat__value">${total}</div>
        </div>
        <div class="lcMyProcessesStat">
          <div class="lcMyProcessesStat__label">פעילים</div>
          <div class="lcMyProcessesStat__value">${active}</div>
        </div>
        <div class="lcMyProcessesStat">
          <div class="lcMyProcessesStat__label">דחופים</div>
          <div class="lcMyProcessesStat__value">${urgent}</div>
        </div>
        <div class="lcMyProcessesStat">
          <div class="lcMyProcessesStat__label">מוכנים להפקה</div>
          <div class="lcMyProcessesStat__value">${ready}</div>
        </div>`;
    },

    render(){
      if(this.shouldAutoRefresh() && (!this._lastAutoRefreshAt || (Date.now() - this._lastAutoRefreshAt) > (this.AUTO_REFRESH_MS + 250))){
        this.refreshFromServer({ reason:'render-stale' });
      }
      if(!UI.els.myProcessesTbody) return;
      const rows = this.filtered();
      if(UI.els.myProcessesCountBadge){
        UI.els.myProcessesCountBadge.textContent = rows.length + " תהליכים";
      }
      this.renderSummary(rows);
      try { OpsEventsUI.renderToolbarState(); } catch(_e) {}
      UI.els.myProcessesTbody.innerHTML = rows.length ? rows.map(row => {
        const rec = row.customer;
        const ownerRoleText = row.isMine ? "התהליך משויך אליך" : (rec.agentRole === "ops" ? "משתמש תפעול" : (rec.agentRole === "manager" ? "מנהל מערכת" : "נציג מערכת"));
        return `<tr class="lcMyProcessesRow" data-tone="${escapeHtml(row.tone)}">
          <td><span class="lcMyProcessesRow__num">${escapeHtml(row.processNumber)}</span></td>
          <td>
            <div class="lcMyProcessesClient">
              <strong>${escapeHtml(rec.fullName || "—")}</strong>
              <div class="lcMyProcessesClient__meta">
                <span>ת״ז ${escapeHtml(rec.idNumber || "—")}</span>
                <span class="lcMyProcessesClient__metaDot" aria-hidden="true"></span>
                <span>${escapeHtml(rec.phone || "—")}</span>
              </div>
            </div>
          </td>
          <td><span class="lcMyProcessesType">${escapeHtml(row.typeText)}</span></td>
          <td><span class="lcMyProcessesBadge lcMyProcessesBadge--${escapeHtml(row.tone)}">${escapeHtml(row.statusText)}</span></td>
          <td>
            <div class="lcMyProcessesStageWrap">
              <span class="lcMyProcessesStage">${escapeHtml(row.stageText)}</span>
              <span class="lcMyProcessesStage__sub">שלב נוכחי בתהליך</span>
            </div>
          </td>
          <td>
            <div class="lcMyProcessesOwner">
              <span class="lcMyProcessesOwner__name">${escapeHtml(rec.agentName || "—")}</span>
              <span class="lcMyProcessesOwner__role">${escapeHtml(ownerRoleText)}</span>
            </div>
          </td>
          <td>
            <div class="lcMyProcessesUpdated">
              <span class="lcMyProcessesUpdated__time">${escapeHtml(row.updatedText)}</span>
              <span class="lcMyProcessesUpdated__hint">עדכון אחרון במערכת</span>
            </div>
          </td>
          <td>
            <div class="lcMyProcessesActions">
              <button class="btn btn--primary" data-process-open="${escapeHtml(rec.id)}" type="button">פתח תהליך</button>
              <button class="btn" data-process-customer="${escapeHtml(rec.id)}" type="button">תיק לקוח</button>
              <button class="btn" data-process-event="${escapeHtml(rec.id)}" type="button">צור אירוע</button>
            </div>
          </td>
        </tr>`;
      }).join("") : `<tr><td colspan="8"><div class="emptyState"><div class="emptyState__icon">🧩</div><div class="emptyState__title">אין כרגע תהליכים להצגה</div><div class="emptyState__text">ברגע שיתווספו לקוחות ותהליכי שיקוף/תפעול, הם יופיעו כאן אוטומטית עבור משתמש התפעול.</div></div></td></tr>`;

      UI.els.myProcessesTbody.querySelectorAll("[data-process-open]").forEach(btn => {
        btn.onclick = () => this.openProcess(btn.getAttribute("data-process-open"));
      });
      UI.els.myProcessesTbody.querySelectorAll("[data-process-customer]").forEach(btn => {
        btn.onclick = () => CustomersUI.openByIdWithLoader(btn.getAttribute("data-process-customer"), 900);
      });
      UI.els.myProcessesTbody.querySelectorAll("[data-process-event]").forEach(btn => {
        btn.onclick = () => OpsEventsUI.openCreate(btn.getAttribute("data-process-event"));
      });
    },

    openProcess(id){
      const rec = this.list().find(item => String(item.id) === String(id));
      if(!rec) return;
      UI.goView("mirrors");
      setTimeout(() => {
        try { MirrorsUI.selectCustomer(String(id)); } catch(_e) {}
      }, 40);
    }
  };


  const OpsEventsUI = {
    SLOTS: generateOpsEventSlots(),
    els: {},
    toastTimer: null,
    listRefreshTimer: null,

    init(){
      this.ensureShell();
      this.startLoop();
      document.addEventListener('visibilitychange', () => {
        if(document.hidden) return;
        this.checkReminders();
        if(this.isListOpen()) this.renderList();
      });
      window.addEventListener('focus', () => {
        this.checkReminders();
        if(this.isListOpen()) this.renderList();
      });
    },

    ensureShell(){
      if(document.getElementById('opsEventModal')){
        this.cacheEls();
        return;
      }
      const root = document.createElement('div');
      root.innerHTML = `
        <div class="opsEventModal" id="opsEventModal" aria-hidden="true">
          <div class="opsEventModal__backdrop" data-ops-event-close></div>
          <div class="opsEventModal__dialog" role="dialog" aria-modal="true" aria-labelledby="opsEventModalTitle">
            <div class="opsEventModal__head">
              <div>
                <div class="opsEventModal__kicker">GEMEL INVEST • תפעול</div>
                <div class="opsEventModal__title" id="opsEventModalTitle">צור אירוע שיחת שיקוף</div>
                <div class="opsEventModal__hint">קבע תזמון מדויק + טווח שעות חזרה ללקוח. התזכורת תישלח רק ליוצר האירוע.</div>
              </div>
              <button class="opsEventModal__close" id="btnCloseOpsEventModal" type="button" aria-label="סגור">✕</button>
            </div>
            <form class="opsEventForm" id="opsEventForm">
              <div class="opsEventForm__grid">
                <label class="field">
                  <span class="label">לקוח</span>
                  <select class="input" id="opsEventCustomer"></select>
                </label>
                <label class="field">
                  <span class="label">תאריך חזרה</span>
                  <input class="input" id="opsEventDate" type="date" required />
                </label>
                <label class="field">
                  <span class="label">משעה</span>
                  <select class="input" id="opsEventStart" required></select>
                </label>
                <label class="field">
                  <span class="label">עד שעה</span>
                  <select class="input" id="opsEventEnd" required></select>
                </label>
              </div>
              <div class="opsEventRangePreview" id="opsEventRangePreview">בחר לקוח, תאריך וטווח שעות חזרה.</div>
              <label class="field">
                <span class="label">הערה לנציג</span>
                <textarea class="input opsEventForm__textarea" id="opsEventNotes" placeholder="לדוגמה: הלקוח ביקש לחזור אחרי העבודה / לא זמין לפני 16:00"></textarea>
              </label>
              <div class="opsEventForm__meta">
                <span class="opsEventForm__metaPill">תזכורת קופצת: 2 דקות לפני</span>
                <span class="opsEventForm__metaPill">נשלחת רק ליוצר האירוע</span>
              </div>
              <div class="opsEventForm__error" id="opsEventFormError"></div>
              <div class="opsEventForm__actions">
                <button class="btn" id="btnCancelOpsEvent" type="button">ביטול</button>
                <button class="btn btn--primary" type="submit">שמור אירוע</button>
              </div>
            </form>
          </div>
        </div>

        <div class="opsEventListModal" id="opsEventListModal" aria-hidden="true">
          <div class="opsEventListModal__backdrop" data-ops-events-list-close></div>
          <div class="opsEventListModal__dialog" role="dialog" aria-modal="true" aria-labelledby="opsEventsListTitle">
            <div class="opsEventListModal__head">
              <div>
                <div class="opsEventModal__kicker">GEMEL INVEST • תפעול</div>
                <div class="opsEventModal__title" id="opsEventsListTitle">אירועי שיחות שיקוף</div>
                <div class="opsEventModal__hint">כל נציגי התפעול יכולים לצפות. ההתראה נשלחת רק ליוצר האירוע.</div>
              </div>
              <div class="opsEventListModal__actions">
                <button class="btn" id="btnRefreshOpsEventsList" type="button">רענון</button>
                <button class="opsEventModal__close" id="btnCloseOpsEventsList" type="button" aria-label="סגור">✕</button>
              </div>
            </div>
            <div class="opsEventList" id="opsEventList"></div>
          </div>
        </div>

        <div class="opsEventToastHost" id="opsEventToastHost" aria-live="assertive" aria-atomic="true"></div>
      `;
      document.body.appendChild(root);
      this.cacheEls();
      this.bindShell();
    },

    cacheEls(){
      this.els.modal = document.getElementById('opsEventModal');
      this.els.form = document.getElementById('opsEventForm');
      this.els.customer = document.getElementById('opsEventCustomer');
      this.els.date = document.getElementById('opsEventDate');
      this.els.start = document.getElementById('opsEventStart');
      this.els.end = document.getElementById('opsEventEnd');
      this.els.notes = document.getElementById('opsEventNotes');
      this.els.error = document.getElementById('opsEventFormError');
      this.els.preview = document.getElementById('opsEventRangePreview');
      this.els.listModal = document.getElementById('opsEventListModal');
      this.els.list = document.getElementById('opsEventList');
      this.els.toastHost = document.getElementById('opsEventToastHost');
    },

    bindShell(){
      on(document.getElementById('btnCloseOpsEventModal'), 'click', () => this.closeCreate());
      on(document.getElementById('btnCancelOpsEvent'), 'click', () => this.closeCreate());
      on(document.querySelector('[data-ops-event-close]'), 'click', () => this.closeCreate());
      on(document.getElementById('btnCloseOpsEventsList'), 'click', () => this.closeList());
      on(document.querySelector('[data-ops-events-list-close]'), 'click', () => this.closeList());
      on(document.getElementById('btnRefreshOpsEventsList'), 'click', async () => {
        await App.syncNow();
        this.renderList();
      });
      on(this.els.form, 'submit', (ev) => this.handleSubmit(ev));
      [this.els.customer, this.els.date, this.els.start, this.els.end].forEach((el) => on(el, 'change', () => this.renderPreview()));
    },

    getEvents(){
      return Array.isArray(State.data?.meta?.opsEvents) ? State.data.meta.opsEvents.map((ev, idx) => normalizeOpsEvent(ev, idx)).filter(Boolean) : [];
    },

    setEvents(events){
      State.data.meta = State.data.meta || {};
      State.data.meta.opsEvents = Array.isArray(events) ? events.map((ev, idx) => normalizeOpsEvent(ev, idx)).filter(Boolean) : [];
      State.data.meta.updatedAt = nowISO();
    },

    getCurrentCreator(){
      return currentAgentIdentity();
    },

    customerOptions(){
      return ProcessesUI.list().map((rec) => ({
        id: String(rec.id || ''),
        name: safeTrim(rec.fullName) || 'לקוח',
        phone: safeTrim(rec.phone),
        idNumber: safeTrim(rec.idNumber)
      }));
    },

    fillSlots(){
      const optionHtml = this.SLOTS.map((time) => `<option value="${escapeHtml(time)}">${escapeHtml(time)}</option>`).join('');
      if(this.els.start) this.els.start.innerHTML = `<option value="">בחר</option>${optionHtml}`;
      if(this.els.end) this.els.end.innerHTML = `<option value="">בחר</option>${optionHtml}`;
    },

    fillCustomers(selectedId = ''){
      const items = this.customerOptions();
      this.els.customer.innerHTML = `<option value="">בחר לקוח</option>` + items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}${item.phone ? ` · ${escapeHtml(item.phone)}` : ''}</option>`).join('');
      if(selectedId) this.els.customer.value = String(selectedId);
    },

    defaultDateValue(){
      const d = new Date();
      d.setMinutes(d.getMinutes() + 5);
      return d.toISOString().slice(0,10);
    },

    defaultStartValue(){
      const now = new Date();
      let h = now.getHours();
      let m = now.getMinutes();
      m = Math.ceil((m + 5) / 15) * 15;
      if(m >= 60){ h += 1; m = 0; }
      const hh = String(Math.min(Math.max(h, 8), 20)).padStart(2,'0');
      const mm = String(m).padStart(2,'0');
      const candidate = `${hh}:${mm}`;
      return this.SLOTS.includes(candidate) ? candidate : this.SLOTS[0];
    },

    nextSlot(timeStr){
      const idx = this.SLOTS.indexOf(timeStr);
      return idx >= 0 && idx < this.SLOTS.length - 1 ? this.SLOTS[idx + 1] : this.SLOTS[Math.min(idx + 2, this.SLOTS.length - 1)] || '';
    },

    openCreate(prefillCustomerId = ''){
      if(!Auth.isOps()) return;
      this.ensureShell();
      this.fillSlots();
      this.fillCustomers(prefillCustomerId);
      this.els.date.value = this.defaultDateValue();
      const start = this.defaultStartValue();
      this.els.start.value = start;
      this.els.end.value = this.nextSlot(start);
      this.els.notes.value = '';
      this.els.error.textContent = '';
      this.renderPreview();
      this.els.modal.classList.add('is-open');
      this.els.modal.setAttribute('aria-hidden', 'false');
    },

    closeCreate(){
      this.els.modal?.classList.remove('is-open');
      this.els.modal?.setAttribute('aria-hidden', 'true');
    },

    isListOpen(){
      return !!this.els.listModal?.classList.contains('is-open');
    },

    async openList(){
      this.ensureShell();
      this.els.listModal.classList.add('is-open');
      this.els.listModal.setAttribute('aria-hidden', 'false');
      this.renderList();
      try { await App.syncNow(); } catch(_e) {}
      this.renderList();
    },

    closeList(){
      this.els.listModal?.classList.remove('is-open');
      this.els.listModal?.setAttribute('aria-hidden', 'true');
    },

    renderPreview(){
      if(!this.els.preview) return;
      const customerId = safeTrim(this.els.customer?.value);
      const date = safeTrim(this.els.date?.value);
      const start = safeTrim(this.els.start?.value);
      const end = safeTrim(this.els.end?.value);
      const customer = this.customerOptions().find((item) => String(item.id) === String(customerId));
      if(!customerId || !date || !start || !end){
        this.els.preview.textContent = 'בחר לקוח, תאריך וטווח שעות חזרה.';
        return;
      }
      this.els.preview.textContent = `שיחת שיקוף ל־${customer?.name || 'לקוח'} · ${date.split('-').reverse().join('.')} · בין ${formatOpsTime(start)} ל־${formatOpsTime(end)}.`;
    },

    validateForm(){
      const customerId = safeTrim(this.els.customer?.value);
      const date = safeTrim(this.els.date?.value);
      const start = safeTrim(this.els.start?.value);
      const end = safeTrim(this.els.end?.value);
      if(!customerId) return 'נא לבחור לקוח';
      if(!date) return 'נא לבחור תאריך חזרה';
      if(!start || !end) return 'נא לבחור טווח שעות מלא';
      if(this.SLOTS.indexOf(end) <= this.SLOTS.indexOf(start)) return 'שעת הסיום חייבת להיות אחרי שעת ההתחלה';
      const scheduledAt = buildOpsEventDateTime(date, start);
      const ms = Date.parse(scheduledAt || '');
      if(!Number.isFinite(ms)) return 'מועד האירוע לא תקין';
      if(ms <= (Date.now() + 60000)) return 'יש לבחור מועד עתידי של לפחות דקה מהעכשיו';
      return '';
    },

    async handleSubmit(ev){
      ev.preventDefault();
      const err = this.validateForm();
      this.els.error.textContent = err;
      if(err) return;
      const customerId = safeTrim(this.els.customer.value);
      const customer = this.customerOptions().find((item) => String(item.id) === String(customerId));
      const creator = this.getCurrentCreator();
      const date = safeTrim(this.els.date.value);
      const rangeStart = safeTrim(this.els.start.value);
      const rangeEnd = safeTrim(this.els.end.value);
      const scheduledAt = buildOpsEventDateTime(date, rangeStart);
      const next = this.getEvents();
      next.push(normalizeOpsEvent({
        id: `ops_event_${Date.now()}_${Math.random().toString(16).slice(2,7)}`,
        customerId,
        customerName: customer?.name || 'לקוח',
        customerPhone: customer?.phone || '',
        customerIdNumber: customer?.idNumber || '',
        title: 'שיחת שיקוף ללקוח',
        notes: safeTrim(this.els.notes.value),
        date,
        rangeStart,
        rangeEnd,
        scheduledAt,
        reminderAt: shiftIsoMinutes(scheduledAt, -2),
        status: 'scheduled',
        createdAt: nowISO(),
        updatedAt: nowISO(),
        createdByKey: creator.key,
        createdByName: creator.name,
        reminder: { offsetMinutes: 2 }
      }, next.length));
      this.setEvents(next);
      const result = await App.persist('אירוע שיקוף נשמר');
      if(!result?.ok){
        this.els.error.textContent = 'שמירת האירוע נכשלה. בדוק חיבור ונסה שוב.';
        return;
      }
      this.closeCreate();
      this.renderToolbarState();
      this.renderList();
      this.checkReminders();
      try { ProcessesUI.render(); } catch(_e) {}
    },

    renderToolbarState(){
      const openBtn = document.getElementById('btnOpsOpenEvents');
      if(!openBtn) return;
      const events = this.getEvents();
      openBtn.setAttribute('data-count', String(events.length));
      openBtn.querySelector('[data-ops-events-count]')?.remove();
      const badge = document.createElement('span');
      badge.className = 'opsToolbarCount';
      badge.setAttribute('data-ops-events-count','1');
      badge.textContent = String(events.length);
      openBtn.appendChild(badge);
    },

    sortedEvents(){
      return this.getEvents().sort((a,b) => new Date(a.scheduledAt || a.createdAt || 0) - new Date(b.scheduledAt || b.createdAt || 0));
    },

    eventStatusMeta(ev){
      const now = Date.now();
      const reminderMs = Date.parse(ev.reminderAt || '');
      const eventMs = Date.parse(ev.scheduledAt || '');
      const ack = safeTrim(ev?.reminder?.acknowledgedAt || ev?.acknowledgedAt);
      if(ack) return { label:'התזכורת אושרה', tone:'success' };
      if(Number.isFinite(eventMs) && now > eventMs) return { label:'מועד האירוע הגיע', tone:'warn' };
      if(Number.isFinite(reminderMs) && now >= reminderMs) return { label:'זמן התזכורת פעיל', tone:'warn' };
      return { label:'מתוזמן', tone:'info' };
    },

    renderList(){
      if(!this.els.list) return;
      const events = this.sortedEvents();
      this.els.list.innerHTML = events.length ? events.map((ev) => {
        const meta = this.eventStatusMeta(ev);
        const canAck = safeTrim(ev.createdByKey) === this.getCurrentCreator().key && !safeTrim(ev?.reminder?.acknowledgedAt || ev?.acknowledgedAt);
        return `
          <article class="opsEventCard" data-event-id="${escapeHtml(ev.id)}">
            <div class="opsEventCard__head">
              <div>
                <div class="opsEventCard__title">${escapeHtml(ev.customerName || 'לקוח')}</div>
                <div class="opsEventCard__sub">שיחת שיקוף · יוצר: ${escapeHtml(ev.createdByName || 'נציג')}</div>
              </div>
              <span class="opsEventCard__badge opsEventCard__badge--${escapeHtml(meta.tone)}">${escapeHtml(meta.label)}</span>
            </div>
            <div class="opsEventCard__grid">
              <div class="opsEventCard__item"><span>תאריך</span><strong>${escapeHtml((ev.date || '').split('-').reverse().join('.') || '—')}</strong></div>
              <div class="opsEventCard__item"><span>טווח שעות</span><strong>${escapeHtml(formatOpsTime(ev.rangeStart))} - ${escapeHtml(formatOpsTime(ev.rangeEnd))}</strong></div>
              <div class="opsEventCard__item"><span>טלפון</span><strong dir="ltr">${escapeHtml(ev.customerPhone || '—')}</strong></div>
              <div class="opsEventCard__item"><span>תזכורת</span><strong>${escapeHtml(formatOpsDateTime(ev.reminderAt))}</strong></div>
            </div>
            ${ev.notes ? `<div class="opsEventCard__notes">${escapeHtml(ev.notes)}</div>` : ''}
            <div class="opsEventCard__actions">
              ${canAck ? `<button class="btn btn--primary" data-ops-event-ack="${escapeHtml(ev.id)}" type="button">אישור אירוע</button>` : ''}
            </div>
          </article>`;
      }).join('') : `<div class="emptyState"><div class="emptyState__icon">🗓️</div><div class="emptyState__title">אין אירועים מתוזמנים</div><div class="emptyState__text">אחרי יצירת אירוע שיחת שיקוף הוא יופיע כאן לכל נציגי התפעול.</div></div>`;
      this.els.list.querySelectorAll('[data-ops-event-ack]').forEach((btn) => {
        btn.onclick = () => this.acknowledgeEvent(btn.getAttribute('data-ops-event-ack'));
      });
    },

    startLoop(){
      clearInterval(this.toastTimer);
      this.toastTimer = setInterval(() => this.checkReminders(), 15000);
    },

    pendingReminderEvent(){
      const creator = this.getCurrentCreator();
      const now = Date.now();
      return this.sortedEvents().find((ev) => {
        const reminderMs = Date.parse(ev.reminderAt || '');
        const eventMs = Date.parse(ev.scheduledAt || '');
        const ack = safeTrim(ev?.reminder?.acknowledgedAt || ev?.acknowledgedAt);
        if(!safeTrim(ev.createdByKey) || safeTrim(ev.createdByKey) !== creator.key) return false;
        if(ack) return false;
        if(!Number.isFinite(reminderMs)) return false;
        if(now < reminderMs) return false;
        if(Number.isFinite(eventMs) && now > (eventMs + (12 * 60 * 60 * 1000))) return false;
        return true;
      }) || null;
    },

    checkReminders(){
      if(!Auth.isOps()) return;
      this.ensureShell();
      const pending = this.pendingReminderEvent();
      if(!pending){
        this.els.toastHost.innerHTML = '';
        return;
      }
      const existing = this.els.toastHost.querySelector(`[data-ops-toast-id="${CSS.escape(pending.id)}"]`);
      if(existing) return;
      this.els.toastHost.innerHTML = '';
      const toast = document.createElement('div');
      toast.className = 'opsEventToast';
      toast.setAttribute('data-ops-toast-id', pending.id);
      toast.innerHTML = `
        <div class="opsEventToast__kicker">תזכורת לשיחת שיקוף</div>
        <div class="opsEventToast__title">${escapeHtml(pending.customerName || 'לקוח')}</div>
        <div class="opsEventToast__text">הגיע הזמן לחזור ללקוח בין ${escapeHtml(formatOpsTime(pending.rangeStart))} ל־${escapeHtml(formatOpsTime(pending.rangeEnd))}.</div>
        <div class="opsEventToast__meta">מועד שנקבע: ${escapeHtml(formatOpsDateTime(pending.scheduledAt))}</div>
        <div class="opsEventToast__actions">
          <button class="btn btn--primary" data-ops-toast-ack="${escapeHtml(pending.id)}" type="button">אישור אירוע</button>
          <button class="btn" data-ops-toast-open-list type="button">פתח אירועים</button>
        </div>`;
      this.els.toastHost.appendChild(toast);
      toast.querySelector('[data-ops-toast-ack]').onclick = () => this.acknowledgeEvent(pending.id);
      toast.querySelector('[data-ops-toast-open-list]').onclick = () => this.openList();
    },

    async acknowledgeEvent(eventId){
      const creator = this.getCurrentCreator();
      const events = this.getEvents();
      const idx = events.findIndex((ev) => String(ev.id) === String(eventId));
      if(idx < 0) return;
      if(safeTrim(events[idx].createdByKey) !== creator.key) return;
      events[idx] = normalizeOpsEvent({
        ...events[idx],
        updatedAt: nowISO(),
        acknowledgedAt: nowISO(),
        reminder: { ...(events[idx].reminder || {}), acknowledgedAt: nowISO(), offsetMinutes: 2 }
      }, idx);
      this.setEvents(events);
      const result = await App.persist('אירוע אושר');
      if(!result?.ok) return;
      this.els.toastHost.innerHTML = '';
      this.renderList();
      this.renderToolbarState();
    }
  };


  const MirrorsUI = {
    els: {},
    selectedId: "",
    consent: "",
    lastResults: [],
    runtimeSessionId: `mirrors_${Date.now()}_${Math.random().toString(16).slice(2)}`,

    init(){
      this.els.input = $("#mirrorsSearchInput");
      this.els.searchBtn = $("#mirrorsSearchBtn");
      this.els.results = $("#mirrorsResults");
      this.els.resultsBadge = $("#mirrorsResultsBadge");
      this.els.note = $("#mirrorsSearchNote");
      this.els.empty = $("#mirrorsEmptyState");
      this.els.flow = $("#mirrorsFlow");
      this.els.heroMeta = $("#mirrorsHeroMeta");
      this.els.customerHero = $("#mirrorsCustomerHero");
      this.els.wizardNav = $("#mirrorsWizardNav");
      this.els.scriptCard = $("#mirrorsScriptCard");
      this.els.verifyCard = $("#mirrorsVerifyCard");
      this.els.reflectCard = $("#mirrorsReflectCard");
      this.els.cancelCard = $("#mirrorsCancelCard");
      this.els.disclosureCard = $("#mirrorsDisclosureCard");
      this.els.healthCard = $("#mirrorsHealthCard");
      this.els.paymentCard = $("#mirrorsPaymentCard");
      this.els.issuanceCard = $("#mirrorsIssuanceCard");
      this.els.steps = $$("#mirrorsSteps .mirrorsStep");
      this.els.modal = $("#mirrorsSearchModal");
      this.els.openBtn = $("#btnOpenMirrorsSearch");
      this.els.closeBtn = $("#btnCloseMirrorsSearch");
      this.els.startModal = $("#mirrorsStartModal");
      this.els.startText = $("#mirrorsStartModalText");
      this.els.startConfirmBtn = $("#btnConfirmMirrorsStart");
      this.els.startCancelBtn = $("#btnCancelMirrorsStart");
      this.els.callBar = $("#mirrorsCallBar");
      this.els.callTimer = $("#mirrorsCallTimer");
      this.els.callMeta = $("#mirrorsCallMeta");
      this.els.finishCallBtn = $("#btnFinishMirrorCall");

      on(this.els.openBtn, "click", () => this.openSearch());
      on(this.els.closeBtn, "click", () => this.closeSearch());
      on(this.els.modal, "click", (ev) => {
        if(ev.target?.matches?.('[data-close-mirrors-search]')) this.closeSearch();
      });
      on(this.els.startModal, "click", (ev) => {
        if(ev.target?.matches?.('[data-close-mirrors-start]')) this.closeStartModal();
      });
      on(this.els.startCancelBtn, "click", () => this.closeStartModal());
      on(this.els.startConfirmBtn, "click", () => this.startCall());
      on(this.els.finishCallBtn, "click", () => this.finishCall());
      on(document, "keydown", (ev) => {
        if(ev.key === "Escape" && !this.els.modal?.hasAttribute("hidden")) this.closeSearch();
        if(ev.key === "Escape" && !this.els.startModal?.hasAttribute("hidden")) this.closeStartModal();
      });
      on(this.els.searchBtn, "click", () => this.search());
      on(this.els.input, "keydown", (ev) => {
        if(ev.key === "Enter"){
          ev.preventDefault();
          this.search();
        }
      });
      on(this.els.results, "click", (ev) => {
        const btn = ev.target?.closest?.("[data-mirror-customer]");
        if(!btn) return;
        const id = safeTrim(btn.getAttribute("data-mirror-customer"));
        if(id) this.selectCustomer(id);
      });
      on($("#mirrorsSteps"), "click", (ev) => {
        const btn = ev.target?.closest?.('[data-step]');
        if(!btn) return;
        const rec = this.current();
        if(!rec) return;
        const step = Number(btn.getAttribute('data-step') || 0);
        if(!step) return;
        this.setFocusStep(rec, step);
        this.render();
      });
      on(this.els.wizardNav, "click", (ev) => {
        const btn = ev.target?.closest?.('[data-mirror-nav]');
        if(!btn) return;
        const rec = this.current();
        if(!rec) return;
        const dir = safeTrim(btn.getAttribute('data-mirror-nav'));
        const current = this.getFocusStep(rec);
        if(dir === 'prev') this.setFocusStep(rec, current - 1);
        if(dir === 'next') this.setFocusStep(rec, current + 1);
        this.render();
      });
      on(this.els.scriptCard, "click", (ev) => {
        const yesBtn = ev.target?.closest?.('[data-mirror-answer="yes"]');
        const noBtn = ev.target?.closest?.('[data-mirror-answer="no"]');
        if(yesBtn){
          this.consent = "yes";
          const rec = this.current();
          if(rec) this.setFocusStep(rec, 3);
          this.render();
          return;
        }
        if(noBtn){
          this.consent = "no";
          const rec = this.current();
          if(rec) this.setFocusStep(rec, 2);
          this.render();
        }
      });
      on(this.els.verifyCard, "click", async (ev) => {
        const editBtn = ev.target?.closest?.('[data-mirror-verify-edit]');
        if(editBtn){
          const rec = this.current();
          if(!rec) return;
          this.setVerifyEditMode(rec, true);
          return;
        }
        const cancelEditBtn = ev.target?.closest?.('[data-mirror-verify-cancel]');
        if(cancelEditBtn){
          const rec = this.current();
          if(!rec) return;
          this.setVerifyEditMode(rec, false);
          return;
        }
        const saveEditBtn = ev.target?.closest?.('[data-mirror-save-edits]');
        if(saveEditBtn){
          const rec = this.current();
          if(!rec) return;
          this.applyVerificationEdits(rec);
          State.data.meta.updatedAt = nowISO();
          rec.updatedAt = State.data.meta.updatedAt;
          const result = await App.persist('עודכנו נתוני לקוח בשיקוף');
          this.render();
          if(result?.ok) alert('השינויים נשמרו בהצלחה ויופיעו גם בדוח התפעולי וגם בתיק הלקוח.');
          return;
        }
        const smokeBtn = ev.target?.closest?.('[data-mirror-smoking]');
        if(smokeBtn){
          const rec = this.current();
          if(!rec) return;
          const store = this.getVerifyState(rec);
          store.smokingAnswer = safeTrim(smokeBtn.getAttribute('data-mirror-smoking'));
          if(store.smokingAnswer !== 'yes'){
            store.smokingProducts = [];
            store.smokingQuantity = '';
          }
          this.render();
          return;
        }
        const deliveryBtn = ev.target?.closest?.('[data-mirror-delivery]');
        if(deliveryBtn){
          const rec = this.current();
          if(!rec) return;
          const store = this.getVerifyState(rec);
          store.deliveryMethod = safeTrim(deliveryBtn.getAttribute('data-mirror-delivery'));
          this.render();
          return;
        }
        const continueBtn = ev.target?.closest?.('[data-mirror-open-reflection]');
        if(continueBtn){
          this.openReflection();
          return;
        }
        const saveBtn = ev.target?.closest?.('[data-mirror-save-verify]');
        if(saveBtn){
          this.saveVerification();
        }
      });
      on(this.els.verifyCard, "change", (ev) => {
        const rec = this.current();
        if(!rec) return;
        const target = ev.target;
        const store = this.getVerifyState(rec);
        if(target?.matches?.('[data-mirror-smoke-product]')){
          const value = safeTrim(target.value);
          const set = new Set(Array.isArray(store.smokingProducts) ? store.smokingProducts : []);
          if(target.checked) set.add(value);
          else set.delete(value);
          store.smokingProducts = Array.from(set);
          return;
        }
        if(target?.matches?.('[data-mirror-smoke-qty]')){
          store.smokingQuantity = safeTrim(target.value);
          return;
        }
        if(target?.matches?.('[data-mirror-email]')){
          store.deliveryEmail = safeTrim(target.value);
        }
      });
      on(this.els.verifyCard, "input", (ev) => {
        const rec = this.current();
        if(!rec) return;
        const target = ev.target;
        const store = this.getVerifyState(rec);
        if(target?.matches?.('[data-mirror-smoke-qty]')){
          store.smokingQuantity = safeTrim(target.value);
          return;
        }
        if(target?.matches?.('[data-mirror-email]')){
          store.deliveryEmail = safeTrim(target.value);
        }
      });
      on(this.els.reflectCard, "click", (ev) => {
        const yesBtn = ev.target?.closest?.('[data-reflect-har-consent="yes"]');
        const noBtn = ev.target?.closest?.('[data-reflect-har-consent="no"]');
        if(yesBtn || noBtn){
          const rec = this.current();
          if(!rec) return;
          const store = this.getVerifyState(rec);
          store.harConsent = yesBtn ? 'yes' : 'no';
          if(store.harConsent !== 'yes'){
            store.cancelMode = '';
          }
          this.render();
          return;
        }
        const saveBtn = ev.target?.closest?.('[data-reflect-save]');
        if(saveBtn){
          this.saveReflection();
        }
      });
      on(this.els.cancelCard, "click", (ev) => {
        const optionBtn = ev.target?.closest?.('[data-mirror-cancel-mode]');
        if(!optionBtn){
          const saveBtn = ev.target?.closest?.('[data-mirror-cancel-save]');
          if(saveBtn) this.saveCancellationChoice();
          return;
        }
        const rec = this.current();
        if(!rec) return;
        const store = this.getVerifyState(rec);
        store.cancelMode = safeTrim(optionBtn.getAttribute('data-mirror-cancel-mode'));
        store.cancelStageOpened = true;
        rec.updatedAt = nowISO();
        this.render();
      });
      on(this.els.disclosureCard, "click", (ev) => {
        const saveBtn = ev.target?.closest?.('[data-mirror-disclosure-save]');
        if(saveBtn) this.saveDisclosure();
      });
      on(this.els.healthCard, "click", (ev) => {
        const answerBtn = ev.target?.closest?.('[data-mirror-health-answer]');
        if(answerBtn){
          const rec = this.current();
          if(!rec) return;
          const token = safeTrim(answerBtn.getAttribute('data-mirror-health-answer'));
          const parts = token.split('|');
          const qKey = parts[0] || '';
          const insId = parts[1] || '';
          const answer = parts[2] || '';
          if(!qKey || !insId || !answer) return;
          this.setMirrorHealthAnswer(rec, qKey, insId, answer);
          rec.updatedAt = nowISO();
          this.render();
          return;
        }
        const saveBtn = ev.target?.closest?.('[data-mirror-health-save]');
        if(saveBtn) this.saveHealthDeclaration();
      });
      on(this.els.healthCard, "input", (ev) => {
        const target = ev.target;
        const token = safeTrim(target?.getAttribute?.('data-mirror-health-field'));
        if(!token) return;
        const rec = this.current();
        if(!rec) return;
        const parts = token.split('|');
        const qKey = parts[0] || '';
        const insId = parts[1] || '';
        const fieldKey = parts[2] || '';
        if(!qKey || !insId || !fieldKey) return;
        this.setMirrorHealthField(rec, qKey, insId, fieldKey, target.value);
      });
      on(this.els.healthCard, "change", (ev) => {
        const target = ev.target;
        const token = safeTrim(target?.getAttribute?.('data-mirror-health-field'));
        if(!token) return;
        const rec = this.current();
        if(!rec) return;
        const parts = token.split('|');
        const qKey = parts[0] || '';
        const insId = parts[1] || '';
        const fieldKey = parts[2] || '';
        if(!qKey || !insId || !fieldKey) return;
        this.setMirrorHealthField(rec, qKey, insId, fieldKey, target.value);
      });
      on(this.els.paymentCard, "click", (ev) => {
        const methodBtn = ev.target?.closest?.('[data-mirror-payment-method]');
        if(methodBtn){
          const rec = this.current();
          if(!rec) return;
          this.setMirrorPaymentMethod(rec, safeTrim(methodBtn.getAttribute('data-mirror-payment-method')));
          rec.updatedAt = nowISO();
          this.render();
          return;
        }
        const verifyBtn = ev.target?.closest?.('[data-mirror-payment-verified]');
        if(verifyBtn){
          const rec = this.current();
          if(!rec) return;
          const store = this.getMirrorPaymentState(rec);
          store.clientVerified = safeTrim(verifyBtn.getAttribute('data-mirror-payment-verified')) === 'yes';
          rec.updatedAt = nowISO();
          this.render();
          return;
        }
        const saveBtn = ev.target?.closest?.('[data-mirror-payment-save]');
        if(saveBtn){
          this.savePaymentDetails();
        }
      });
      on(this.els.paymentCard, "input", (ev) => {
        const target = ev.target;
        const field = safeTrim(target?.getAttribute?.('data-mirror-payment-field'));
        if(!field) return;
        const rec = this.current();
        if(!rec) return;
        this.setMirrorPaymentField(rec, field, target.value);
      });
      on(this.els.paymentCard, "change", (ev) => {
        const target = ev.target;
        const field = safeTrim(target?.getAttribute?.('data-mirror-payment-field'));
        if(!field) return;
        const rec = this.current();
        if(!rec) return;
        this.setMirrorPaymentField(rec, field, target.value);
      });
      on(this.els.issuanceCard, "click", (ev) => {
        const answerBtn = ev.target?.closest?.('[data-mirror-issuance-answer]');
        if(answerBtn){
          const rec = this.current();
          if(!rec) return;
          const step = this.getMirrorIssuanceState(rec);
          step.clientAnswer = safeTrim(answerBtn.getAttribute('data-mirror-issuance-answer'));
          rec.updatedAt = nowISO();
          this.render();
          return;
        }
        const readBtn = ev.target?.closest?.('[data-mirror-issuance-read]');
        if(readBtn){
          const rec = this.current();
          if(!rec) return;
          const step = this.getMirrorIssuanceState(rec);
          step.agentRead = !step.agentRead;
          rec.updatedAt = nowISO();
          this.render();
          return;
        }
        const saveBtn = ev.target?.closest?.('[data-mirror-issuance-save]');
        if(saveBtn) this.saveIssuanceStep();
      });
      on(this.els.reflectCard, "change", (ev) => {
        const rec = this.current();
        if(!rec) return;
        const target = ev.target;
        const idx = Number(target?.getAttribute?.('data-reflect-index'));
        const field = safeTrim(target?.getAttribute?.('data-reflect-field'));
        if(Number.isNaN(idx) || !field) return;
        const list = this.getExistingPolicies(rec);
        const row = list[idx];
        if(!row || !row.policy) return;
        if(field === 'status'){
          if(row.cancellation && typeof row.cancellation === 'object') row.cancellation.status = safeTrim(target.value);
        }else if(field === 'covers'){
          row.policy[field] = target.value;
        }else{
          row.policy[field] = target.value;
        }
        row.policy._mirrorEdited = true;
        rec.updatedAt = nowISO();
        this.render();
      });
      on(this.els.reflectCard, "input", (ev) => {
        const rec = this.current();
        if(!rec) return;
        const target = ev.target;
        const idx = Number(target?.getAttribute?.('data-reflect-index'));
        const field = safeTrim(target?.getAttribute?.('data-reflect-field'));
        if(Number.isNaN(idx) || !field) return;
        const list = this.getExistingPolicies(rec);
        const row = list[idx];
        if(!row || !row.policy) return;
        if(field === 'status'){
          if(row.cancellation && typeof row.cancellation === 'object') row.cancellation.status = safeTrim(target.value);
        }else{
          row.policy[field] = target.value;
        }
        row.policy._mirrorEdited = true;
      });
    },

    _timerHandle: null,

    getCallState(rec){
      if(!rec.payload || typeof rec.payload !== 'object') rec.payload = {};
      if(!rec.payload.mirrorFlow || typeof rec.payload.mirrorFlow !== 'object') rec.payload.mirrorFlow = {};
      if(!rec.payload.mirrorFlow.callSession || typeof rec.payload.mirrorFlow.callSession !== 'object') rec.payload.mirrorFlow.callSession = {};
      const store = rec.payload.mirrorFlow.callSession;
      if(typeof store.active !== 'boolean') store.active = false;
      return store;
    },

    formatDuration(totalSec){
      const s = Math.max(0, Number(totalSec) || 0);
      const hh = String(Math.floor(s / 3600)).padStart(2,'0');
      const mm = String(Math.floor((s % 3600) / 60)).padStart(2,'0');
      const ss = String(s % 60).padStart(2,'0');
      return hh !== '00' ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
    },

    formatFullDate(v){
      if(!v) return '—';
      const d = new Date(v);
      if(Number.isNaN(+d)) return String(v);
      try{ return d.toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit', year:'numeric' }); }catch(_e){ return String(v); }
    },

    formatClock(v){
      if(!v) return '—';
      const d = new Date(v);
      if(Number.isNaN(+d)) return '—';
      try{ return d.toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit', second:'2-digit' }); }catch(_e){ return '—'; }
    },

    openStartModal(){
      const rec = this.current();
      if(!rec || !this.els.startModal) return;
      if(this.els.startText){
        this.els.startText.textContent = `נבחר הלקוח ${rec.fullName || 'לקוח'}. לחץ על התחלה כדי לפתוח את מסך השיקוף ולהפעיל שעון שיחה.`;
      }
      this.els.startModal.hidden = false;
    },

    closeStartModal(){
      if(this.els.startModal) this.els.startModal.hidden = true;
    },

    async startCall(){
      const rec = this.current();
      if(!rec) return;
      const store = this.getCallState(rec);
      const startedAt = nowISO();
      store.active = true;
      store.startedAt = startedAt;
      store.startedBy = safeTrim(Auth?.current?.name);
      store.runtimeSessionId = this.runtimeSessionId;
      store.finishedAt = '';
      store.durationSec = 0;
      store.durationText = '';
      store.dateFull = this.formatFullDate(startedAt);
      store.startTime = this.formatClock(startedAt);
      store.endTime = '';
      setOpsTouch(rec, {
        liveState: 'in_call',
        ownerName: safeTrim(Auth?.current?.name),
        updatedBy: safeTrim(Auth?.current?.name)
      });
      State.data.meta.updatedAt = startedAt;
      rec.updatedAt = startedAt;
      this.closeStartModal();
      this.render();
      this.startTimerLoop();
      await App.persist('שיחת שיקוף התחילה');
    },

    async finishCall(){
      const rec = this.current();
      if(!rec) return;
      const store = this.getCallState(rec);
      if(!store.active || !store.startedAt) return;
      const finishedAt = nowISO();
      const durationSec = Math.max(0, Math.floor((new Date(finishedAt) - new Date(store.startedAt)) / 1000));
      store.active = false;
      store.finishedAt = finishedAt;
      store.durationSec = durationSec;
      store.durationText = this.formatDuration(durationSec);
      store.dateFull = this.formatFullDate(store.startedAt);
      store.startTime = this.formatClock(store.startedAt);
      store.endTime = this.formatClock(finishedAt);
      store.finishedBy = safeTrim(Auth?.current?.name);
      setOpsTouch(rec, {
        liveState: 'call_finished',
        ownerName: safeTrim(Auth?.current?.name),
        updatedBy: safeTrim(Auth?.current?.name)
      });
      State.data.meta.updatedAt = finishedAt;
      rec.updatedAt = finishedAt;
      this.stopTimerLoop();
      this.render();
      await App.persist('שיחת שיקוף הסתיימה');
      alert(`שיחת השיקוף נשמרה. תאריך: ${store.dateFull} · התחלה: ${store.startTime} · משך: ${store.durationText}`);
    },

    startTimerLoop(){
      this.stopTimerLoop();
      const tick = () => { this.renderCallBar(); CustomersUI?.refreshOperationalReflectionCard?.(); };
      tick();
      this._timerHandle = window.setInterval(tick, 1000);
    },

    stopTimerLoop(){
      if(this._timerHandle){
        window.clearInterval(this._timerHandle);
        this._timerHandle = null;
      }
      this.renderCallBar();
      CustomersUI?.refreshOperationalReflectionCard?.();
    },

    renderCallBar(){
      if(!this.els.callBar) return;
      const rec = this.current();
      const store = rec ? this.getCallState(rec) : null;
      const active = !!(rec && store?.active && store?.startedAt && store?.runtimeSessionId === this.runtimeSessionId);
      this.els.callBar.style.display = active ? 'flex' : 'none';
      if(!active) return;
      const seconds = Math.max(0, Math.floor((Date.now() - new Date(store.startedAt).getTime()) / 1000));
      if(this.els.callTimer) this.els.callTimer.textContent = this.formatDuration(seconds);
      if(this.els.callMeta) this.els.callMeta.textContent = `התחיל ב־${store.startTime || this.formatClock(store.startedAt)} · ${store.dateFull || this.formatFullDate(store.startedAt)} · ${safeTrim(store.startedBy) || 'נציג'}`;
    },

    clearStaleActiveCall(rec){
      if(!rec) return false;
      const store = this.getCallState(rec);
      if(!(store?.active && store?.startedAt)) return false;
      if(store.runtimeSessionId === this.runtimeSessionId) return false;
      store.active = false;
      store.startedAt = '';
      store.startedBy = '';
      store.finishedAt = '';
      store.finishedBy = '';
      store.durationSec = 0;
      store.durationText = '';
      store.dateFull = '';
      store.startTime = '';
      store.endTime = '';
      return true;
    },

    suspendUiForExternalModal(){
      this.closeSearch();
      this.closeStartModal();
      this.stopTimerLoop();
    },

    reset(){
      this.selectedId = "";
      this.consent = "";
      this.lastResults = [];
      if(this.els.input) this.els.input.value = "";
      this.closeSearch();
      this.closeStartModal();
      this.stopTimerLoop();
      this.render();
    },

    openSearch(prefillRecent = true){
      if(!this.els.modal) return;
      this.els.modal.hidden = false;
      document.body.style.overflow = 'hidden';
      if(prefillRecent && !safeTrim(this.els.input?.value) && !this.lastResults.length){
        const rows = this.visibleCustomers().slice(0, 12);
        this.lastResults = rows;
        this.renderResults(rows.length ? `מציג ${rows.length} לקוחות אחרונים לבחירה.` : 'לא נמצאו לקוחות שמורים במערכת.');
      }
      setTimeout(() => { try{ this.els.input?.focus(); }catch(_e){} }, 30);
    },

    closeSearch(){
      if(!this.els.modal) return;
      this.els.modal.hidden = true;
      document.body.style.overflow = '';
    },

    visibleCustomers(){
      const all = Array.isArray(State.data?.customers) ? State.data.customers.slice() : [];
      return all.filter(rec => Auth.canViewAllCustomers() || safeTrim(rec.agentName) === safeTrim(Auth?.current?.name));
    },

    search(){
      const q = safeTrim(this.els.input?.value).toLowerCase();
      const rows = this.visibleCustomers();
      this.consent = "";
      this.selectedId = "";
      if(!q){
        this.lastResults = rows.slice(0, 12);
        this.renderResults(`מציג ${this.lastResults.length} לקוחות אחרונים לבחירה.`);
        this.render();
        return;
      }
      this.lastResults = rows.filter(rec => [rec.fullName, rec.idNumber, rec.phone, rec.agentName, rec.email, rec.city]
        .some(v => safeTrim(v).toLowerCase().includes(q)))
        .slice(0, 20);
      if(this.lastResults.length === 1){
        this.selectedId = safeTrim(this.lastResults[0].id);
      }
      this.renderResults(this.lastResults.length ? `נמצאו ${this.lastResults.length} תוצאות.` : "לא נמצא לקוח לפי החיפוש הזה.");
      this.render();
    },

    current(){
      if(!this.selectedId) return null;
      return this.visibleCustomers().find(rec => String(rec.id) === String(this.selectedId)) || null;
    },

    selectCustomer(id){
      this.selectedId = String(id);
      this.consent = "";
      this.closeSearch();
      const rec = this.current();
      if(rec) {
        this.setFocusStep(rec, 2);
        const ops = ensureOpsProcess(rec);
        if(!ops.resultStatus && !(this.getCallState(rec)?.active)){
          setOpsTouch(rec, {
            liveState: 'handling',
            ownerName: safeTrim(Auth?.current?.name),
            updatedBy: safeTrim(Auth?.current?.name)
          });
          App.persist('לקוח נכנס לטיפול תפעולי');
        }
      }
      const clearedStale = rec ? this.clearStaleActiveCall(rec) : false;
      const call = rec ? this.getCallState(rec) : null;
      if(clearedStale && rec){
        const stamp = nowISO();
        rec.updatedAt = stamp;
        State.data.meta.updatedAt = stamp;
        App.persist('נוקה טיימר שיקוף ישן');
      }
      this.render();
      if(call?.active && call?.runtimeSessionId === this.runtimeSessionId){
        this.startTimerLoop();
      }else{
        this.stopTimerLoop();
        this.openStartModal();
      }
    },

    renderResults(noteText){
      if(this.els.note) this.els.note.textContent = noteText || "";
      if(this.els.resultsBadge) this.els.resultsBadge.textContent = `${this.lastResults.length} תוצאות`;
      if(!this.els.results) return;
      if(!this.lastResults.length){
        this.els.results.innerHTML = `<div class="mirrorsResults__empty">לא נמצאו תוצאות כרגע. נסה חיפוש אחר.</div>`;
        return;
      }
      this.els.results.innerHTML = this.lastResults.map(rec => {
        const selected = String(this.selectedId) === String(rec.id);
        return `<button class="mirrorsResultCard${selected ? ' is-selected' : ''}" data-mirror-customer="${escapeHtml(rec.id)}" type="button">
          <div class="mirrorsResultCard__main">
            <div class="mirrorsResultCard__name">${escapeHtml(rec.fullName || 'לקוח')}</div>
            <div class="mirrorsResultCard__meta">ת״ז ${escapeHtml(rec.idNumber || '—')} · טלפון ${escapeHtml(rec.phone || '—')}</div>
          </div>
          <div class="mirrorsResultCard__side">
            <span class="mirrorsResultCard__agent">${escapeHtml(rec.agentName || 'ללא נציג')}</span>
            <span class="mirrorsResultCard__date">${escapeHtml(this.formatDate(rec.updatedAt || rec.createdAt))}</span>
          </div>
        </button>`;
      }).join("");
    },

    getWizardStepMap(){
      return {
        2: this.els.scriptCard,
        3: this.els.verifyCard,
        4: this.els.reflectCard,
        5: this.els.cancelCard,
        6: this.els.disclosureCard,
        7: this.els.healthCard,
        8: this.els.paymentCard,
        9: this.els.issuanceCard
      };
    },

    getProgressStep(rec){
      const verify = rec ? this.getVerifyState(rec) : null;
      const disclosure = rec ? this.getDisclosureState(rec) : null;
      const health = rec ? this.getMirrorHealthState(rec) : null;
      const payment = rec ? this.getMirrorPaymentState(rec) : null;
      const issuance = rec ? this.getMirrorIssuanceState(rec) : null;
      return !rec ? 1 : (
        this.consent !== 'yes' ? 2 : (
          !verify?.reflectionOpened ? 3 : (
            safeTrim(verify?.harConsent) !== 'yes' ? 4 : (
              !safeTrim(verify?.cancelSavedAt) ? 5 : (
                !safeTrim(disclosure?.savedAt) ? 6 : (
                  !safeTrim(health?.savedAt) ? 7 : (
                    !safeTrim(payment?.savedAt) ? 8 : (
                      !safeTrim(issuance?.savedAt) ? 9 : 9
                    )
                  )
                )
              )
            )
          )
        )
      );
    },

    getMaxUnlockedStep(rec){
      return Math.max(2, this.getProgressStep(rec));
    },

    getFocusStep(rec){
      if(!rec?.payload || typeof rec.payload !== 'object') rec.payload = {};
      if(!rec.payload.mirrorFlow || typeof rec.payload.mirrorFlow !== 'object') rec.payload.mirrorFlow = {};
      if(!rec.payload.mirrorFlow.ui || typeof rec.payload.mirrorFlow.ui !== 'object') rec.payload.mirrorFlow.ui = {};
      const raw = Number(rec.payload.mirrorFlow.ui.focusStep || 0);
      const max = this.getMaxUnlockedStep(rec);
      const progress = this.getProgressStep(rec);
      if(raw >= 2 && raw <= max) return raw;
      rec.payload.mirrorFlow.ui.focusStep = progress;
      return progress;
    },

    setFocusStep(rec, step){
      if(!rec?.payload || typeof rec.payload !== 'object') rec.payload = {};
      if(!rec.payload.mirrorFlow || typeof rec.payload.mirrorFlow !== 'object') rec.payload.mirrorFlow = {};
      if(!rec.payload.mirrorFlow.ui || typeof rec.payload.mirrorFlow.ui !== 'object') rec.payload.mirrorFlow.ui = {};
      const min = 2;
      const max = this.getMaxUnlockedStep(rec);
      const safe = Math.max(min, Math.min(max, Number(step) || min));
      rec.payload.mirrorFlow.ui.focusStep = safe;
      return safe;
    },

    renderWizardNav(rec){
      if(!this.els.wizardNav) return;
      const progress = this.getProgressStep(rec);
      const focus = this.getFocusStep(rec);
      const max = this.getMaxUnlockedStep(rec);
      this.els.wizardNav.style.display = rec ? 'flex' : 'none';
      this.els.wizardNav.innerHTML = `
        <button class="btn mirrorsWizardNav__btn" data-mirror-nav="prev" type="button" ${focus <= 2 ? 'disabled' : ''}>הקודם</button>
        <div class="mirrorsWizardNav__center">
          <div class="mirrorsWizardNav__label">שלב מוצג כעת</div>
          <div class="mirrorsWizardNav__title">${escapeHtml(this.getStepTitle(focus))}</div>
          <div class="mirrorsWizardNav__meta">שלב ${focus} מתוך 9${focus !== progress ? ` · השלב הפעיל כרגע הוא ${progress}` : ''}</div>
        </div>
        <button class="btn btn--primary mirrorsWizardNav__btn" data-mirror-nav="next" type="button" ${focus >= max ? 'disabled' : ''}>הבא</button>`;
    },

    getStepTitle(step){
      const map = {1:'חיפוש לקוח',2:'פתיח שיחה',3:'אימות נתונים',4:'שיקוף הר הביטוח',5:'ביטול בחברה נגדית',6:'גילוי נאות',7:'הצהרת בריאות',8:'אמצעי תשלום',9:'כניסה לתוקף'};
      return map[Number(step)] || 'שיקוף';
    },

    applyWizardVisibility(rec){
      const map = this.getWizardStepMap();
      const focus = rec ? this.getFocusStep(rec) : 0;
      Object.entries(map).forEach(([step, el]) => {
        if(!el) return;
        const shouldShow = !!rec && Number(step) === focus && el.innerHTML.trim();
        el.style.display = shouldShow ? 'block' : 'none';
        el.classList.toggle('is-wizard-active', shouldShow);
      });
    },

    render(){
      if(this.els.resultsBadge && !this.lastResults.length && !safeTrim(this.els.input?.value)){
        this.els.resultsBadge.textContent = '0 תוצאות';
      }
      const rec = this.current();
      this.updateSteps(rec);
      if(this.els.heroMeta){
        this.els.heroMeta.textContent = rec ? `שיקוף פעיל · ${rec.fullName || 'לקוח'} · ${rec.phone || rec.idNumber || '—'}` : 'טרם נבחר לקוח לשיקוף';
      }
      if(this.els.openBtn){
        this.els.openBtn.textContent = rec ? '🔍 איתור לקוח חדש' : '🔍 איתור לקוח לשיקוף';
      }
      if(!rec){
        this.closeStartModal();
        this.stopTimerLoop();
        if(this.els.empty) this.els.empty.style.display = '';
        if(this.els.flow) this.els.flow.style.display = 'none';
        if(this.els.reflectCard){ this.els.reflectCard.style.display = 'none'; this.els.reflectCard.innerHTML = ''; }
        if(this.els.cancelCard){ this.els.cancelCard.style.display = 'none'; this.els.cancelCard.innerHTML = ''; }
        if(this.els.disclosureCard){ this.els.disclosureCard.style.display = 'none'; this.els.disclosureCard.innerHTML = ''; }
        if(this.els.healthCard){ this.els.healthCard.style.display = 'none'; this.els.healthCard.innerHTML = ''; }
        if(this.els.paymentCard){ this.els.paymentCard.style.display = 'none'; this.els.paymentCard.innerHTML = ''; }
        if(this.els.issuanceCard){ this.els.issuanceCard.style.display = 'none'; this.els.issuanceCard.innerHTML = ''; }
        if(this.els.scriptCard) this.els.scriptCard.innerHTML = '';
        if(this.els.verifyCard) this.els.verifyCard.innerHTML = '';
        if(this.els.customerHero) this.els.customerHero.innerHTML = '';
        if(this.els.wizardNav){ this.els.wizardNav.style.display = 'none'; this.els.wizardNav.innerHTML = ''; }
        this.applyWizardVisibility(null);
        return;
      }
      const call = this.getCallState(rec);
      const isLiveCall = !!(call.active && call.startedAt && call.runtimeSessionId === this.runtimeSessionId);
      const readyForFlow = !!(isLiveCall || call.finishedAt || call.durationText);
      if(this.els.empty) this.els.empty.style.display = readyForFlow ? 'none' : '';
      if(this.els.flow) this.els.flow.style.display = readyForFlow ? 'grid' : 'none';
      this.renderCallBar();
      if(!readyForFlow) return;
      if(isLiveCall) this.startTimerLoop(); else this.stopTimerLoop();
      this.renderCustomerHero(rec);
      this.renderScript(rec);
      this.renderVerification(rec);
      this.renderReflection(rec);
      this.renderCancellation(rec);
      this.renderDisclosure(rec);
      this.renderHealthDeclaration(rec);
      this.renderPaymentDetails(rec);
      this.renderIssuanceStep(rec);
      this.renderWizardNav(rec);
      this.applyWizardVisibility(rec);
    },

    updateSteps(rec){
      const progressStep = this.getProgressStep(rec);
      const focusStep = rec ? this.getFocusStep(rec) : 1;
      const maxUnlocked = rec ? this.getMaxUnlockedStep(rec) : 1;
      (this.els.steps || []).forEach(el => {
        const stepNo = Number(el.getAttribute('data-step') || 0);
        el.classList.toggle('is-active', stepNo === focusStep);
        el.classList.toggle('is-done', stepNo < progressStep);
        el.classList.toggle('is-available', stepNo <= maxUnlocked);
      });
    },

    getPrimary(rec){
      const payload = rec?.payload || {};
      const insureds = Array.isArray(payload.insureds) ? payload.insureds : (Array.isArray(payload?.operational?.insureds) ? payload.operational.insureds : []);
      return payload.primary || insureds?.[0]?.data || {};
    },

    getInsureds(rec){
      const payload = rec?.payload || {};
      return Array.isArray(payload.insureds) ? payload.insureds : (Array.isArray(payload?.operational?.insureds) ? payload.operational.insureds : []);
    },

    getNewPolicies(rec){
      const payload = rec?.payload || {};
      return Array.isArray(payload.newPolicies) && payload.newPolicies.length
        ? payload.newPolicies
        : (Array.isArray(payload?.operational?.newPolicies) ? payload.operational.newPolicies : []);
    },

    getCompanyNames(rec){
      const names = this.getNewPolicies(rec).map(p => safeTrim(p?.company)).filter(Boolean);
      return [...new Set(names)];
    },

    getCompanyLogo(company){
      try{
        if(typeof Wizard?.getCompanyLogoSrc === 'function') return Wizard.getCompanyLogoSrc(company) || '';
      }catch(_e){}
      return '';
    },

    getVerifyState(rec){
      if(!rec.payload || typeof rec.payload !== 'object') rec.payload = {};
      if(!rec.payload.mirrorFlow || typeof rec.payload.mirrorFlow !== 'object') rec.payload.mirrorFlow = {};
      if(!rec.payload.mirrorFlow.verify || typeof rec.payload.mirrorFlow.verify !== 'object') rec.payload.mirrorFlow.verify = {};
      const store = rec.payload.mirrorFlow.verify;
      if(!Array.isArray(store.smokingProducts)) store.smokingProducts = [];
      if(!safeTrim(store.deliveryEmail)) store.deliveryEmail = safeTrim(rec.email) || safeTrim(this.getPrimary(rec)?.email);
      if(!safeTrim(store.cancelMode)) store.cancelMode = '';
      if(typeof store.cancelStageOpened !== 'boolean') store.cancelStageOpened = false;
      if(typeof store.editMode !== 'boolean') store.editMode = false;
      if(!store.editedData || typeof store.editedData !== 'object') store.editedData = {};
      return store;
    },

    getVerifyEditableData(rec){
      const primary = this.getPrimary(rec);
      return {
        fullName: this.getFullName(rec, primary),
        idNumber: safeTrim(rec?.idNumber) || safeTrim(primary?.idNumber),
        birthDate: safeTrim(primary?.birthDate),
        maritalStatus: safeTrim(primary?.maritalStatus || primary?.familyStatus),
        childrenText: this.getChildrenText(rec, primary),
        occupation: safeTrim(primary?.occupation),
        clinic: safeTrim(primary?.clinic || primary?.hmo || primary?.kupatHolim),
        shaban: safeTrim(primary?.shaban || primary?.shabanLevel),
        street: safeTrim(primary?.street),
        houseNumber: safeTrim(primary?.houseNumber),
        city: safeTrim(primary?.city || rec?.city),
        zip: safeTrim(primary?.zip)
      };
    },

    syncVerifyEditedData(rec){
      const store = this.getVerifyState(rec);
      const base = this.getVerifyEditableData(rec);
      store.editedData = { ...base, ...(store.editedData || {}) };
      return store.editedData;
    },

    setVerifyEditMode(rec, isEdit){
      const store = this.getVerifyState(rec);
      if(isEdit) this.syncVerifyEditedData(rec);
      store.editMode = !!isEdit;
      this.render();
    },

    updateVerifyEditedField(rec, field, value){
      const store = this.getVerifyState(rec);
      this.syncVerifyEditedData(rec);
      store.editedData[field] = safeTrim(value);
    },

    getVerifyInfoCards(rec){
      const store = this.getVerifyState(rec);
      const data = this.syncVerifyEditedData(rec);
      const addressText = this.getAddressText(data);
      return [
        ['שם מלא', data.fullName],
        ['תעודת זהות', data.idNumber],
        ['תאריך לידה', data.birthDate],
        ['מצב משפחתי', data.maritalStatus],
        ['האם יש ילדים', data.childrenText],
        ['עיסוק נוכחי', data.occupation],
        ['קופת חולים ושב״ן', [safeTrim(data.clinic), safeTrim(data.shaban)].filter(Boolean).join(' · ')],
        ['כתובת למשלוח הפוליסה', addressText || '—']
      ];
    },

    applyVerificationEdits(rec){
      const primary = this.getPrimary(rec);
      const insureds = this.getInsureds(rec);
      const firstInsured = insureds[0]?.data && typeof insureds[0].data === 'object' ? insureds[0].data : null;
      const store = this.getVerifyState(rec);
      const data = this.syncVerifyEditedData(rec);
      const assign = (obj, key, value) => { if(obj && typeof obj === 'object') obj[key] = value; };
      const fullName = safeTrim(data.fullName);
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      const firstName = nameParts.shift() || '';
      const lastName = nameParts.join(' ');
      rec.fullName = fullName || rec.fullName;
      rec.idNumber = safeTrim(data.idNumber) || rec.idNumber;
      rec.city = safeTrim(data.city) || rec.city;
      assign(primary, 'firstName', firstName);
      assign(primary, 'lastName', lastName);
      assign(primary, 'idNumber', safeTrim(data.idNumber));
      assign(primary, 'birthDate', safeTrim(data.birthDate));
      assign(primary, 'maritalStatus', safeTrim(data.maritalStatus));
      assign(primary, 'familyStatus', safeTrim(data.maritalStatus));
      assign(primary, 'occupation', safeTrim(data.occupation));
      assign(primary, 'clinic', safeTrim(data.clinic));
      assign(primary, 'hmo', safeTrim(data.clinic));
      assign(primary, 'kupatHolim', safeTrim(data.clinic));
      assign(primary, 'shaban', safeTrim(data.shaban));
      assign(primary, 'shabanLevel', safeTrim(data.shaban));
      assign(primary, 'street', safeTrim(data.street));
      assign(primary, 'houseNumber', safeTrim(data.houseNumber));
      assign(primary, 'city', safeTrim(data.city));
      assign(primary, 'zip', safeTrim(data.zip));
      assign(primary, 'childrenCount', safeTrim(data.childrenText));
      assign(primary, 'children', safeTrim(data.childrenText));
      assign(primary, 'hasChildren', safeTrim(data.childrenText));
      if(firstInsured){
        Object.assign(firstInsured, {
          firstName,
          lastName,
          idNumber: safeTrim(data.idNumber),
          birthDate: safeTrim(data.birthDate),
          maritalStatus: safeTrim(data.maritalStatus),
          familyStatus: safeTrim(data.maritalStatus),
          occupation: safeTrim(data.occupation),
          clinic: safeTrim(data.clinic),
          hmo: safeTrim(data.clinic),
          kupatHolim: safeTrim(data.clinic),
          shaban: safeTrim(data.shaban),
          shabanLevel: safeTrim(data.shaban),
          street: safeTrim(data.street),
          houseNumber: safeTrim(data.houseNumber),
          city: safeTrim(data.city),
          zip: safeTrim(data.zip),
          childrenCount: safeTrim(data.childrenText),
          children: safeTrim(data.childrenText),
          hasChildren: safeTrim(data.childrenText)
        });
      }
      if(rec.payload && typeof rec.payload === 'object'){
        if(!rec.payload.primary || typeof rec.payload.primary !== 'object') rec.payload.primary = primary;
        if(!rec.payload.operational || typeof rec.payload.operational !== 'object') rec.payload.operational = {};
        if(firstInsured){
          if(!Array.isArray(rec.payload.operational.insureds)) rec.payload.operational.insureds = insureds;
        }
      }
      store.editsSavedAt = nowISO();
      store.editsSavedBy = safeTrim(Auth?.current?.name);
      store.editMode = false;
    },

    renderVerifyInfoSection(rec){
      const store = this.getVerifyState(rec);
      const data = this.syncVerifyEditedData(rec);
      const savedNote = safeTrim(store.editsSavedAt)
        ? `<div class="mirrorsVerifySaved">השינויים נשמרו בתאריך ${escapeHtml(this.formatDate(store.editsSavedAt))}${safeTrim(store.editsSavedBy) ? ` · על ידי ${escapeHtml(store.editsSavedBy)}` : ''}</div>`
        : '';
      if(!store.editMode){
        const cards = this.getVerifyInfoCards(rec);
        return `<div class="mirrorsVerifyTop">
          <div class="mirrorsPromptBar">ברשותך אשאל אותך מספר שאלות:</div>
          <div class="mirrorsVerifyActions">
            <button class="btn" data-mirror-verify-edit type="button">ערוך נתונים</button>
          </div>
        </div>
        <div class="mirrorsVerifyGrid mirrorsVerifyGrid--wide">${cards.map(([label, value]) => `<div class="mirrorsInfoCard"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '—')}</strong></div>`).join('')}</div>${savedNote}`;
      }
      const maritalOptions = ['', 'רווק/ה', 'נשוי/אה', 'גרוש/ה', 'אלמן/ה', 'ידוע/ה בציבור'];
      return `<div class="mirrorsVerifyTop">
        <div class="mirrorsPromptBar">ברשותך אשאל אותך מספר שאלות:</div>
        <div class="mirrorsVerifyActions">
          <button class="btn" data-mirror-verify-cancel type="button">ביטול</button>
        </div>
      </div>
      <div class="mirrorsEditGrid">
        <label class="field"><span class="label">שם מלא</span><input class="input" data-mirror-edit-field="fullName" type="text" value="${escapeHtml(data.fullName || '')}" /></label>
        <label class="field"><span class="label">תעודת זהות</span><input class="input" data-mirror-edit-field="idNumber" type="text" inputmode="numeric" value="${escapeHtml(data.idNumber || '')}" /></label>
        <label class="field"><span class="label">תאריך לידה</span><input class="input" data-mirror-edit-field="birthDate" type="text" value="${escapeHtml(data.birthDate || '')}" placeholder="dd/mm/yyyy" /></label>
        <label class="field"><span class="label">מצב משפחתי</span><select class="input" data-mirror-edit-field="maritalStatus">${maritalOptions.map(option => `<option value="${escapeHtml(option)}" ${data.maritalStatus === option ? 'selected' : ''}>${escapeHtml(option || 'בחר מצב')}</option>`).join('')}</select></label>
        <label class="field"><span class="label">האם יש ילדים</span><input class="input" data-mirror-edit-field="childrenText" type="text" value="${escapeHtml(data.childrenText || '')}" placeholder="כן / לא / מספר ילדים" /></label>
        <label class="field"><span class="label">עיסוק נוכחי</span><input class="input" data-mirror-edit-field="occupation" type="text" value="${escapeHtml(data.occupation || '')}" /></label>
        <label class="field"><span class="label">קופת חולים</span><input class="input" data-mirror-edit-field="clinic" type="text" value="${escapeHtml(data.clinic || '')}" /></label>
        <label class="field"><span class="label">שב״ן</span><input class="input" data-mirror-edit-field="shaban" type="text" value="${escapeHtml(data.shaban || '')}" /></label>
        <label class="field"><span class="label">רחוב</span><input class="input" data-mirror-edit-field="street" type="text" value="${escapeHtml(data.street || '')}" /></label>
        <label class="field"><span class="label">מספר בית</span><input class="input" data-mirror-edit-field="houseNumber" type="text" value="${escapeHtml(data.houseNumber || '')}" /></label>
        <label class="field"><span class="label">עיר</span><input class="input" data-mirror-edit-field="city" type="text" value="${escapeHtml(data.city || '')}" /></label>
        <label class="field"><span class="label">מיקוד</span><input class="input" data-mirror-edit-field="zip" type="text" inputmode="numeric" value="${escapeHtml(data.zip || '')}" /></label>
      </div>
      <div class="mirrorsContinueBar mirrorsContinueBar--edit">
        <button class="btn btn--primary" data-mirror-save-edits type="button">שמור שינויים</button>
      </div>${savedNote}`;
    },

    getFullName(rec, primary){
      return safeTrim(rec?.fullName) || `${safeTrim(primary?.firstName)} ${safeTrim(primary?.lastName)}`.trim() || '—';
    },

    getAddressText(primary){
      const street = safeTrim(primary?.street);
      const house = safeTrim(primary?.houseNumber);
      const city = safeTrim(primary?.city);
      const zip = safeTrim(primary?.zip);
      const parts = [];
      const streetPart = [street, house].filter(Boolean).join(' ');
      if(streetPart) parts.push(streetPart);
      if(city) parts.push(city);
      if(zip) parts.push(`מיקוד ${zip}`);
      return parts.join(' · ');
    },

    getChildrenText(rec, primary){
      const insureds = this.getInsureds(rec);
      const childCount = insureds.filter(ins => safeTrim(ins?.type) === 'child').length;
      if(childCount > 0) return `כן, ${childCount} ילדים`;
      const raw = primary?.childrenCount ?? primary?.children ?? primary?.hasChildren;
      if(raw === true) return 'כן';
      if(raw === false) return 'לא';
      const txt = safeTrim(raw);
      if(!txt) return 'לא';
      if(txt === '0') return 'לא';
      return txt;
    },

    getClinicText(primary){
      const clinic = safeTrim(primary?.clinic || primary?.hmo || primary?.kupatHolim);
      const shaban = safeTrim(primary?.shaban || primary?.shabanLevel);
      return [clinic, shaban].filter(Boolean).join(' · ') || '—';
    },

    getEmailValue(rec, primary, store){
      return safeTrim(store?.deliveryEmail) || safeTrim(rec?.email) || safeTrim(primary?.email);
    },

    setCustomerEmail(rec, email){
      const clean = safeTrim(email);
      rec.email = clean;
      if(rec.payload && typeof rec.payload === 'object'){
        if(rec.payload.primary && typeof rec.payload.primary === 'object') rec.payload.primary.email = clean;
        const insureds = this.getInsureds(rec);
        if(insureds[0]?.data && typeof insureds[0].data === 'object') insureds[0].data.email = clean;
      }
    },

    getInsuredLabel(ins, index){
      const type = safeTrim(ins?.type);
      if(type === 'primary') return 'מבוטח ראשי';
      if(type === 'spouse' || type === 'secondary') return 'מבוטח משני';
      if(type === 'adult') return 'בגיר';
      if(type === 'child') return 'קטין';
      return index === 0 ? 'מבוטח ראשי' : 'מבוטח נוסף';
    },

    getInsuredDisplayName(ins, index){
      const data = ins?.data || {};
      const fullName = `${safeTrim(data.firstName)} ${safeTrim(data.lastName)}`.trim();
      return fullName || this.getInsuredLabel(ins, index);
    },

    getExistingPolicies(rec){
      const insureds = this.getInsureds(rec);
      const out = [];
      insureds.forEach((ins, insuredIndex) => {
        const data = ins?.data || {};
        const rows = Array.isArray(data.existingPolicies) ? data.existingPolicies : [];
        const cancellations = data?.cancellations || {};
        rows.forEach((policy, policyIndex) => {
          const policyId = safeTrim(policy?.id);
          if(policyId && !cancellations[policyId]) cancellations[policyId] = {};
          out.push({
            policy,
            cancellation: policyId ? cancellations[policyId] : {},
            insuredIndex,
            policyIndex,
            insuredLabel: this.getInsuredLabel(ins, insuredIndex),
            insuredName: this.getInsuredDisplayName(ins, insuredIndex)
          });
        });
      });
      return out;
    },

    getPolicyAmountLabel(policy){
      const type = safeTrim(policy?.type);
      if(type === 'בריאות') return 'כיסויים';
      if(type === 'מחלות קשות' || type === 'סרטן') return 'סכום פיצוי';
      return 'סכום ביטוח';
    },

    getPolicyAmountValue(policy){
      const type = safeTrim(policy?.type);
      if(type === 'בריאות'){
        const covers = Array.isArray(policy?.covers) ? policy.covers.filter(Boolean) : [];
        return covers.length ? covers.join(' • ') : '—';
      }
      return safeTrim(policy?.sumInsured || policy?.compensation || policy?.coverageAmount || policy?.coverage || policy?.sum || '');
    },

    getCancellationStatusOptions(){
      return [
        { value: '', label: 'בחר סטטוס' },
        { value: 'full', label: 'ביטול מלא' },
        { value: 'partial_health', label: 'ביטול חלקי' },
        { value: 'agent_appoint', label: 'מינוי סוכן' },
        { value: 'nochange_client', label: 'ללא שינוי – לבקשת הלקוח' },
        { value: 'nochange_collective', label: 'ללא שינוי – קולקטיב' }
      ];
    },

    getPolicyStatusValue(policy, cancellation){
      const raw = safeTrim(cancellation?.status || policy?.status || policy?.policyStatus || policy?.state || '');
      const map = {
        full: 'ביטול מלא',
        partial_health: 'ביטול חלקי',
        agent_appoint: 'מינוי סוכן',
        nochange_client: 'ללא שינוי – לבקשת הלקוח',
        nochange_collective: 'ללא שינוי – קולקטיב'
      };
      return map[raw] || raw || 'טרם הוזן';
    },

    async openReflection(){
      const ok = await this.saveVerification({ silent: true, openReflection: true });
      if(!ok) return;
      const rec = this.current();
      if(!rec) return;
      const store = this.getVerifyState(rec);
      store.reflectionOpened = true;
      this.setFocusStep(rec, 4);
      this.render();
    },

    renderCustomerHero(rec){
      if(!this.els.customerHero) return;
      const primary = this.getPrimary(rec);
      const companies = this.getCompanyNames(rec);
      const companyChips = companies.length ? companies.map(company => {
        const src = this.getCompanyLogo(company);
        const logo = src ? `<img class="mirrorsChip__logoImg" src="${escapeHtml(src)}" alt="${escapeHtml(company)}" />` : `<span class="mirrorsChip__logoFallback">${escapeHtml((company || '•').slice(0,1))}</span>`;
        return `<span class="mirrorsChip">${logo}<span>${escapeHtml(company)}</span></span>`;
      }).join('') : `<span class="mirrorsChip mirrorsChip--muted">לא הוגדרו חברות בפוליסות חדשות</span>`;
      this.els.customerHero.innerHTML = `<div class="mirrorsCustomerHero__main">
        <div>
          <div class="mirrorsCustomerHero__kicker">לקוח שנבחר לשיקוף</div>
          <div class="mirrorsCustomerHero__name">${escapeHtml(rec.fullName || 'לקוח')}</div>
          <div class="mirrorsCustomerHero__meta">ת״ז ${escapeHtml(rec.idNumber || primary.idNumber || '—')} · טלפון ${escapeHtml(rec.phone || primary.phone || '—')} · נציג מטפל ${escapeHtml(rec.agentName || '—')}</div>
        </div>
        <div class="mirrorsCustomerHero__status">${escapeHtml(rec.status || 'חדש')}</div>
      </div>
      <div class="mirrorsCustomerHero__chips">${companyChips}</div>`;
    },

    renderScript(rec){
      if(!this.els.scriptCard) return;
      const opsName = safeTrim(Auth?.current?.name) || 'נציג תפעול';
      const companies = this.getCompanyNames(rec);
      const companyText = companies.length ? companies.join(', ') : 'החברות שסומנו בהקמת הלקוח';
      const sellingAgent = safeTrim(rec.agentName) || 'הנציג המטפל';
      const yesSelected = this.consent === 'yes';
      const noSelected = this.consent === 'no';
      this.els.scriptCard.innerHTML = `<div class="mirrorsCard__head">
          <div>
            <div class="mirrorsCard__title">נוסח חובה להקראה</div>
            <div class="mirrorsCard__hint">הקרא את הנוסח במלואו ושמור על השדות הדינמיים כפי שהמערכת מציגה אותם.</div>
          </div>
          <span class="mirrorsScriptTag">שיחת מכירה מוקלטת</span>
        </div>
        <div class="mirrorsScriptBody">
          <p>שלום מדבר <strong>${escapeHtml(opsName)}</strong>.</p>
          <p>ואני נציג מכירות מטעם סוכן גרגורי משווק הביטוחים של חברת <strong>${escapeHtml(companyText)}</strong>.</p>
          <p>אני יוצר איתך קשר בהמשך לפנייתך ולשיחתך עם הנציג <strong>${escapeHtml(sellingAgent)}</strong>.</p>
          <p>במטרה להציע לך לרכוש ביטוח. חשוב לי להדגיש בפניך שזוהי שיחת מכירה מוקלטת. האם אתה מאשר להמשיך בשיחה?</p>
        </div>
        <div class="mirrorsAnswerBox">
          <div class="mirrorsAnswerBox__title">מה הלקוח השיב?</div>
          <div class="mirrorsAnswerGrid">
            <button class="mirrorsAnswerCard mirrorsAnswerCard--yes${yesSelected ? ' is-selected' : ''}" data-mirror-answer="yes" type="button">
              <span class="mirrorsAnswerCard__icon">✓</span>
              <strong>כן, הלקוח אישר</strong>
              <small>המשך ישיר לשלב אימות נתונים</small>
            </button>
            <button class="mirrorsAnswerCard mirrorsAnswerCard--no${noSelected ? ' is-selected' : ''}" data-mirror-answer="no" type="button">
              <span class="mirrorsAnswerCard__icon">✕</span>
              <strong>לא, הלקוח לא אישר</strong>
              <small>ניתן לסיים כאן ולהמשיך ללקוח הבא</small>
            </button>
          </div>
          ${noSelected ? `<div class="mirrorsDeclinedNote">הלקוח לא אישר המשך שיחה. לא נפתח שלב אימות הנתונים.</div>` : ``}
        </div>`;
    },

    renderVerification(rec){
      if(!this.els.verifyCard) return;
      if(this.consent !== 'yes'){
        this.els.verifyCard.style.display = 'none';
        this.els.verifyCard.innerHTML = '';
        return;
      }
      this.els.verifyCard.style.display = 'block';
      const primary = this.getPrimary(rec);
      const store = this.getVerifyState(rec);
      const smokingAnswer = safeTrim(store.smokingAnswer);
      const deliveryMethod = safeTrim(store.deliveryMethod);
      const addressText = this.getAddressText(primary);
      const emailValue = this.getEmailValue(rec, primary, store);
      const smokingOptions = ['סיגריות','טבק','אלקטרוניות','נרגילה','קנאביס','מוצרי טבק אחרים'];
      this.els.verifyCard.innerHTML = `<div class="mirrorsCard__head">
          <div>
            <div class="mirrorsCard__title">אימות נתוני לקוח</div>
            <div class="mirrorsCard__hint">ברשותך אשאל אותך מספר שאלות. אמת מול הלקוח את הנתונים הבאים, השלם תשובות חסרות ושמור את שלב האימות.</div>
          </div>
          <span class="mirrorsVerifyBadge">שלב המשך שיחה</span>
        </div>

        ${this.renderVerifyInfoSection(rec)}

        <div class="mirrorsFormBlock">
          <div class="mirrorsFormBlock__title">שאלת עישון</div>
          <div class="mirrorsFormBlock__hint">האם אתה מעשן או עישנת בשנתיים האחרונות? סיגריות, טבק, אלקטרוניות, נרגילה, קנאביס או מוצרי טבק אחרים.</div>
          <div class="mirrorsChoiceGrid mirrorsChoiceGrid--smoke">
            <button class="mirrorsMiniChoice${smokingAnswer === 'yes' ? ' is-selected' : ''}" data-mirror-smoking="yes" type="button">כן</button>
            <button class="mirrorsMiniChoice${smokingAnswer === 'no' ? ' is-selected' : ''}" data-mirror-smoking="no" type="button">לא</button>
          </div>
          ${smokingAnswer === 'yes' ? `
            <div class="mirrorsSmokeBox">
              <div class="mirrorsSmokeBox__title">סמן איזה מוצר הלקוח מעשן</div>
              <div class="mirrorsSmokeProducts">${smokingOptions.map(option => {
                const checked = (store.smokingProducts || []).includes(option);
                return `<label class="mirrorsCheckTag${checked ? ' is-selected' : ''}"><input data-mirror-smoke-product type="checkbox" value="${escapeHtml(option)}" ${checked ? 'checked' : ''} /><span>${escapeHtml(option)}</span></label>`;
              }).join('')}</div>
              <div class="field mirrorsInlineField">
                <label class="label">כמות</label>
                <input class="input" data-mirror-smoke-qty type="text" value="${escapeHtml(store.smokingQuantity || '')}" placeholder="לדוגמה: 10 סיגריות ביום" />
              </div>
            </div>
          ` : ''}
        </div>

        <div class="mirrorsFormBlock">
          <div class="mirrorsFormBlock__title">אופן קבלת דיוורים</div>
          <div class="mirrorsFormBlock__hint">שאל את הלקוח איך ירצה לקבל את הדיוורים: לבית או למייל.</div>
          <div class="mirrorsChoiceGrid">
            <button class="mirrorsMiniChoice${deliveryMethod === 'home' ? ' is-selected' : ''}" data-mirror-delivery="home" type="button">לבית</button>
            <button class="mirrorsMiniChoice${deliveryMethod === 'email' ? ' is-selected' : ''}" data-mirror-delivery="email" type="button">למייל</button>
          </div>
          ${deliveryMethod === 'home' ? `<div class="mirrorsDeliveryNote">הפוליסה תישלח לכתובת: <strong>${escapeHtml(addressText || 'לא הוזנה כתובת במערכת')}</strong></div>` : ''}
          ${deliveryMethod === 'email' ? `<div class="mirrorsEmailBox">
            <div class="mirrorsDeliveryNote">כתובת המייל לשילוח</div>
            <input class="input mirrorsMailInput" data-mirror-email type="email" dir="ltr" value="${escapeHtml(emailValue || '')}" placeholder="name@example.com" />
            <div class="help">אם אין מייל במערכת, הזן כאן את כתובת המייל שהלקוח מסר בשיחה. השמירה תעדכן גם את פרטי הלקוח.</div>
          </div>` : ''}
        </div>

        <div class="mirrorsContinueBar">
          <button class="btn btn--primary" data-mirror-open-reflection type="button">המשך</button>
        </div>`;
    },

    async saveVerification(options = {}){
      const rec = this.current();
      if(!rec) return false;
      const primary = this.getPrimary(rec);
      const store = this.getVerifyState(rec);
      const smokingAnswer = safeTrim(store.smokingAnswer);
      const deliveryMethod = safeTrim(store.deliveryMethod);
      if(!smokingAnswer) {
        alert('יש לסמן האם הלקוח מעשן או עישן בשנתיים האחרונות.');
        return false;
      }
      if(smokingAnswer === 'yes'){
        if(!Array.isArray(store.smokingProducts) || !store.smokingProducts.length){
          alert('יש לסמן לפחות מוצר עישון אחד.');
          return false;
        }
        if(!safeTrim(store.smokingQuantity)){
          alert('יש למלא כמות עישון.');
          return false;
        }
      }
      if(!deliveryMethod){
        alert('יש לבחור איך הלקוח רוצה לקבל את הדיוורים.');
        return false;
      }
      if(deliveryMethod === 'email'){
        const email = this.getEmailValue(rec, primary, store);
        if(!email){
          alert('יש להזין כתובת מייל עבור הלקוח.');
          return false;
        }
        if(!/^\S+@\S+\.\S+$/.test(email)){
          alert('כתובת המייל אינה תקינה.');
          return false;
        }
        store.deliveryEmail = email;
        this.setCustomerEmail(rec, email);
      }
      if(deliveryMethod === 'home'){
        store.deliveryEmail = this.getEmailValue(rec, primary, store);
      }
      store.savedAt = nowISO();
      store.savedBy = safeTrim(Auth?.current?.name);
      if(options.openReflection) store.reflectionOpened = true;
      State.data.meta.updatedAt = nowISO();
      rec.updatedAt = State.data.meta.updatedAt;
      const result = await App.persist('שיקוף נשמר');
      this.render();
      if(!options.silent){
        alert(options.openReflection ? 'שלב האימות נשמר ונפתח מסך שיקוף הר הביטוח.' : 'שלב אימות הנתונים נשמר בהצלחה.');
      }
      return !!result?.ok;
    },

    renderReflection(rec){
      if(!this.els.reflectCard) return;
      const store = this.getVerifyState(rec);
      if(this.consent !== 'yes' || !store.reflectionOpened){
        this.els.reflectCard.style.display = 'none';
        this.els.reflectCard.innerHTML = '';
        return;
      }
      this.els.reflectCard.style.display = 'block';
      const harConsent = safeTrim(store.harConsent);
      const policies = this.getExistingPolicies(rec);
      const newPolicies = this.getNewPolicies(rec);
      const summaryText = policies.length ? `נמצאו ${policies.length} פוליסות קיימות לשיקוף` : 'לא נמצאו פוליסות קיימות במערכת עבור הלקוח';
      this.els.reflectCard.innerHTML = `<div class="mirrorsCard__head">
          <div>
            <div class="mirrorsCard__title">שיקוף הר הביטוח</div>
            <div class="mirrorsCard__hint">מסך ההקראה הבא לנציג לאחר בחירת אופן קבלת הדיוורים. הפוליסות הקיימות מוצגות כאן כשורות מידע לקריאה בלבד, אחד־אחד, ולאחר מכן מוצגות הפוליסות החדשות שהמערכת מציעה למכירה.</div>
          </div>
          <span class="mirrorsSummaryBadge">${escapeHtml(summaryText)}</span>
        </div>
        <div class="mirrorsReflectScript">
          חשוב לי לעדכן אותך כי בשוק ישנן 8 חברות בבריאות ו־9 חברות בחיים המשווקות את המוצר. חברות הביטוח העיקריות שאנו עובדים איתם בתחום ביטוחי הבריאות הם <strong>כלל</strong> ו<strong>איילון</strong>, ובתחום ביטוח החיים הינם <strong>מגדל</strong> ו<strong>כלל</strong>.<br><br>
          אז לאחר שקבלנו את פנייתך האם אתה מאשר שאתה זה שאישרת לנו להיכנס עבורך לממשק הר הביטוח ולבצע עבורך בדיקה על מנת להתאים עבורך ביטוח העונה על צריכך?
        </div>
        <div class="mirrorsReflectQuestion">סמן את תשובת הלקוח:</div>
        <div class="mirrorsChoiceGrid">
          <button class="mirrorsMiniChoice${harConsent === 'yes' ? ' is-selected' : ''}" data-reflect-har-consent="yes" type="button">כן</button>
          <button class="mirrorsMiniChoice${harConsent === 'no' ? ' is-selected' : ''}" data-reflect-har-consent="no" type="button">לא</button>
        </div>
        ${harConsent === 'no' ? `<div class="mirrorsDeclinedNote">הלקוח לא אישר שימוש בבדיקת הר הביטוח. מסך הפוליסות לא יוצג עד שתסומן תשובה "כן".</div>` : ``}
        ${harConsent === 'yes' ? `
          <div class="mirrorsReflectScript mirrorsReflectScript--followup mirrorsIssuanceNote">לאחר ביצוע בדיקה בהר הביטוח, שתקף לחמישה ימי עבודה, להלן הביטוחים הקיימים לך כיום:</div>
          <div class="mirrorsReflectionList">${policies.length ? this.renderReflectionPoliciesTable(policies) : `<div class="mirrorsReflectNote">לא נמצאו פוליסות קיימות שמורות בתיק הלקוח.</div>`}</div>
          <div class="mirrorsReflectScript mirrorsReflectScript--followup mirrorsIssuanceNote">
            בהתאם לביטוחים הקיימים לך כיום, הפוליסה שאנחנו מציעים לך לרכוש היא פוליסת:
          </div>
          <div class="mirrorsReflectQuestion">להלן רשימת הפוליסות החדשות ללקוח:</div>
          <div class="mirrorsReflectionList">${newPolicies.length ? this.renderMirrorNewPoliciesRows(newPolicies) : `<div class="mirrorsReflectNote">לא הוזנו עדיין פוליסות חדשות בתיק הלקוח.</div>`}</div>
          <div class="mirrorsReflectScript mirrorsReflectScript--terms">
            הפרמיה צמודה למדד ובמידה ולא תהיה תוספת חיתומית או מקצועית, ייתכן והגבייה הראשונה תהיה גבייה יחסית או כפולה בהתאם למועד החיוב. הגבייה תתבצע במועד התשלום הקבוע של אמצעי התשלום שלך.
          </div>
          <div class="mirrorsReflectScript mirrorsReflectScript--terms mirrorsReflectScript--termsAlt">
            במידה ובעתיד תרצה לעשות שינוי או ביטול תוכל לבצע זאת בכל אחד מהאמצעים שמעמידה לרשותך חברת הביטוח: פקס, מייל, מוקד שירות, אזור אישי באתר החברה. חשוב לי שתדע שתוכל לבטל את כל אחד מהנספחים הכלולים בחבילה בכל עת בתנאי שנותר מוצר בסיס.
          </div>
        ` : ''}`;
    },

    renderReflectionPoliciesTable(policies){
      return `<div class="mirrorsReflectTableWrap"><table class="mirrorsReflectTable"><thead><tr>
        <th>מבוטח</th>
        <th>חברה</th>
        <th>מוצר</th>
        <th>סטטוס</th>
        <th>פרמיה</th>
        <th>סכום / כיסויים</th>
        <th>תאריך תחילה</th>
      </tr></thead><tbody>${policies.map((row, idx) => this.renderReflectionPolicyRow(row, idx)).join('')}</tbody></table></div>`;
    },

    renderReflectionPolicyRow(row, idx){
      const p = row.policy || {};
      const company = safeTrim(p.company) || '—';
      const type = safeTrim(p.type) || '—';
      const statusValue = this.getPolicyStatusValue(p, row.cancellation);
      const premiumRaw = safeTrim(p.monthlyPremium || p.premiumMonthly || p.premium || '');
      const premium = premiumRaw ? `${premiumRaw} ₪` : '—';
      const amountValue = this.getPolicyAmountValue(p);
      const amountLabel = this.getPolicyAmountLabel(p);
      const startDate = safeTrim(p.startDate || p.policyStartDate || p.beginDate || '');
      const insuredText = [safeTrim(row.insuredLabel), safeTrim(row.insuredName)].filter(Boolean).join(' · ');
      const logoSrc = this.getCompanyLogo(company);
      const companyCell = logoSrc
        ? `<div class="mirrorsReflectCompany"><span class="mirrorsReflectCompany__logo"><img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(company)}" /></span><span>${escapeHtml(company)}</span></div>`
        : `<div class="mirrorsReflectCompany"><span class="mirrorsReflectCompany__fallback">${escapeHtml((company || '•').slice(0,1))}</span><span>${escapeHtml(company)}</span></div>`;
      return `<tr>
        <td><div class="mirrorsReflectInsured">${escapeHtml(insuredText || '—')}</div></td>
        <td>${companyCell}</td>
        <td><div class="mirrorsReflectValue">${escapeHtml(type)}</div></td>
        <td><div class="mirrorsReflectValue">${escapeHtml(statusValue || '—')}</div></td>
        <td><div class="mirrorsReflectValue">${escapeHtml(premium)}</div></td>
        <td><div class="mirrorsReflectValue"><span class="mirrorsReflectValue__label">${escapeHtml(amountLabel)}:</span> ${escapeHtml(amountValue || '—')}</div></td>
        <td><div class="mirrorsReflectValue">${escapeHtml(startDate || '—')}</div></td>
      </tr>`;
    },


    renderMirrorNewPoliciesRows(policies){
      return `<div class="mirrorsNewPoliciesStack">${policies.map((policy, idx) => this.renderMirrorNewPolicyRow(policy, idx)).join('')}</div>`;
    },


    renderCancellation(rec){
      if(!this.els.cancelCard) return;
      const store = this.getVerifyState(rec);
      if(this.consent !== 'yes' || !store.reflectionOpened || safeTrim(store.harConsent) !== 'yes'){
        this.els.cancelCard.style.display = 'none';
        this.els.cancelCard.innerHTML = '';
        return;
      }
      this.els.cancelCard.style.display = 'block';
      store.cancelStageOpened = true;
      const cancelMode = safeTrim(store.cancelMode);
      const agentName = safeTrim(rec?.agentName) || safeTrim(Auth?.current?.name) || 'הנציג המטפל';
      this.els.cancelCard.innerHTML = `<div class="mirrorsCard__head">
          <div>
            <div class="mirrorsCard__title">ביטול בחברה נגדית</div>
            <div class="mirrorsCard__hint">שאל את המבוטח איך הוא מעדיף לבצע את ביטול הפוליסות הישנות ועדכן את הבחירה המתאימה.</div>
          </div>
          <span class="mirrorsSummaryBadge">שלב 5 · המשך שיחה</span>
        </div>
        <div class="mirrorsCancelPrompt">איך תרצה שנבצע את הביטול לפוליסות הישנות?</div>
        <div class="mirrorsCancelOptions">
          <button class="mirrorsCancelOption${cancelMode === 'agent' ? ' is-selected' : ''}" data-mirror-cancel-mode="agent" type="button">
            <span class="mirrorsCancelOption__kicker">אפשרות 1</span>
            <strong>על ידי הנציג</strong>
            <small>המערכת תשייך את הטיפול ל־${escapeHtml(agentName)}</small>
          </button>
          <button class="mirrorsCancelOption${cancelMode === 'client' ? ' is-selected' : ''}" data-mirror-cancel-mode="client" type="button">
            <span class="mirrorsCancelOption__kicker">אפשרות 2</span>
            <strong>הלקוח באופן עצמאי</strong>
            <small>המבוטח יבטל ישירות מול חברת הביטוח</small>
          </button>
        </div>
        ${cancelMode === 'agent' ? `<div class="mirrorsCancelAgentBox">
          <div class="mirrorsCancelAgentBox__label">הנציג המטפל בביטול</div>
          <div class="mirrorsCancelAgentBox__name">${escapeHtml(agentName)}</div>
          <div class="mirrorsCancelAgentBox__script">בהמשך ישלח אליך טופס ביטול לחברה הנגדית עליו תידרש לחתום.</div>
        </div>` : ''}
        ${cancelMode === 'client' ? `<div class="mirrorsReflectNote">הלקוח בחר לבצע את הביטול באופן עצמאי מול חברת הביטוח.</div>` : ''}
        <div class="mirrorsReflectActions">
          <button class="btn btn--primary" data-mirror-cancel-save type="button">שמור שלב ביטול</button>
        </div>`;
    },

    async saveCancellationChoice(){
      const rec = this.current();
      if(!rec) return;
      const store = this.getVerifyState(rec);
      const mode = safeTrim(store.cancelMode);
      if(!mode){
        alert('יש לבחור כיצד הלקוח מעדיף לבצע את הביטול לפוליסות הישנות.');
        return;
      }
      store.cancelSavedAt = nowISO();
      store.cancelSavedBy = safeTrim(Auth?.current?.name);
      State.data.meta.updatedAt = nowISO();
      rec.updatedAt = State.data.meta.updatedAt;
      await App.persist('שלב ביטול בחברה נגדית נשמר');
      this.setFocusStep(rec, 6);
      this.render();
      alert('שלב ביטול בחברה נגדית נשמר בהצלחה.');
    },


    getDisclosureState(rec){
      if(!rec.payload || typeof rec.payload !== 'object') rec.payload = {};
      if(!rec.payload.mirrorFlow || typeof rec.payload.mirrorFlow !== 'object') rec.payload.mirrorFlow = {};
      if(!rec.payload.mirrorFlow.disclosure || typeof rec.payload.mirrorFlow.disclosure !== 'object') rec.payload.mirrorFlow.disclosure = {};
      return rec.payload.mirrorFlow.disclosure;
    },

    normalizeDisclosureKey(value){
      return safeTrim(value)
        .toLowerCase()
        .replace(/"/g, '')
        .replace(/[׳']/g, '')
        .replace(/[״]/g, '')
        .replace(/[()]/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    },

    mapHealthCoverToDisclosureKeys(cover){
      const v = this.normalizeDisclosureKey(cover);
      if(!v) return [];
      if(v.includes('תרופות')) return ['meds'];
      if(v.includes('השתלות')) return ['transplants'];
      if(v.includes('חו') && v.includes('ניתוח')) return ['surgeries_abroad'];
      if(v.includes('בארץ') && v.includes('ניתוח')) return ['surgeries_israel'];
      if(v.includes('אמבולטורי')) return ['ambulatory'];
      if(v.includes('ייעוץ מומחים') || v.includes('ייעוץ') || v.includes('מומחים')) return ['ambulatory'];
      if(v.includes('רפואה משלימה')) return ['alt_medicine'];
      if(v.includes('בדיקות מתקדמות') || v.includes('אבחון')) return ['service'];
      if(v.includes('כתב שירות')) return ['service'];
      return [];
    },

    getDisclosureKeysForPolicy(policy){
      const type = safeTrim(policy?.type || policy?.product);
      const raw = this.normalizeDisclosureKey([policy?.type, policy?.product, policy?.name, policy?.plan, policy?.planName, policy?.title].filter(Boolean).join(' '));
      if(type === 'בריאות' || raw.includes('בריאות')){
        const keys = [];
        this.getHealthCoverList(policy).forEach(cover => keys.push(...this.mapHealthCoverToDisclosureKeys(cover)));
        return [...new Set(keys)];
      }
      if(type === 'מחלות קשות' || raw.includes('מחלות קשות')) return ['critical_illness'];
      if(type === 'סרטן' || raw.includes('סרטן')) return ['cancer'];
      if(type === 'ריסק משכנתא' || raw.includes('משכנתא')) return ['mortgage'];
      if(type === 'תאונות אישיות' || raw.includes('תאונות אישיות')) return ['accident_death','accident_disability'];
      if(raw.includes('מטריה')) return ['umbrella'];
      if(raw.includes('אובדן כושר')) return ['disability_income'];
      if(raw.includes('הכנסה למשפחה')) return ['family_income'];
      if(raw.includes('מוות מתאונה')) return ['accident_death'];
      if(raw.includes('נכות מתאונה')) return ['accident_disability'];
      if(type === 'ריסק' || type === 'חיים' || raw.includes('ריסק') || raw.includes('מגן') || raw.includes('חיים')) return ['risk'];
      return [];
    },

    getDisclosureEntries(rec){
      const policies = this.getNewPolicies(rec);
      const entries = [];
      policies.forEach((policy, idx) => {
        const company = safeTrim(policy?.company);
        const disclosureCompany = company === 'הכשרה' ? 'איילון' : company;
        const companyLib = MIRROR_DISCLOSURE_LIBRARY[disclosureCompany];
        if(!companyLib) return;
        const insuredText = this.getMirrorNewPolicyInsured(policy);
        const keys = this.getDisclosureKeysForPolicy(policy);
        keys.forEach((key, keyIdx) => {
          const block = companyLib[key];
          if(!block || !safeTrim(block.text)) return;
          entries.push({
            id: `${safeTrim(policy?.id) || idx}_${key}_${keyIdx}`,
            company,
            policyType: safeTrim(policy?.type || policy?.product || 'פוליסה'),
            insuredText,
            title: safeTrim(block.label) || safeTrim(policy?.type || policy?.product || 'גילוי נאות'),
            text: safeTrim(block.text)
          });
        });
      });
      return entries;
    },

    renderDisclosure(rec){
      if(!this.els.disclosureCard) return;
      const verify = this.getVerifyState(rec);
      if(this.consent !== 'yes' || !verify?.reflectionOpened || safeTrim(verify?.harConsent) !== 'yes' || !safeTrim(verify?.cancelSavedAt)){
        this.els.disclosureCard.style.display = 'none';
        this.els.disclosureCard.innerHTML = '';
        return;
      }
      this.els.disclosureCard.style.display = 'block';
      const disclosure = this.getDisclosureState(rec);
      const entries = this.getDisclosureEntries(rec);
      const cards = entries.length ? entries.map((entry, idx) => {
        const logoSrc = this.getCompanyLogo(entry.company);
        const logo = logoSrc ? `<span class="mirrorsDisclosureItem__logo"><img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(entry.company)}" /></span>` : `<span class="mirrorsDisclosureItem__logo mirrorsDisclosureItem__logo--fallback">${escapeHtml((entry.company || '•').slice(0,1))}</span>`;
        return `<article class="mirrorsDisclosureItem" style="animation-delay:${idx * 40}ms">
          <div class="mirrorsDisclosureItem__head">
            <div class="mirrorsDisclosureItem__brand">${logo}<div><div class="mirrorsDisclosureItem__company">${escapeHtml(entry.company)}</div><div class="mirrorsDisclosureItem__meta">${escapeHtml(entry.policyType)} · ${escapeHtml(entry.insuredText || 'מבוטח')}</div></div></div>
            <span class="mirrorsDisclosureItem__badge">${escapeHtml(entry.title)}</span>
          </div>
          <div class="mirrorsDisclosureText">${escapeHtml(entry.text).replace(/\n/g,'<br>')}</div>
        </article>`;
      }).join('') : `<div class="mirrorsReflectNote">לא נמצא גילוי נאות תואם לחברה ולמוצר שסומנו בפוליסות החדשות.</div>`;
      const savedNote = safeTrim(disclosure.savedAt) ? `<div class="mirrorsDisclosureSaved">השלב נשמר בתאריך ${escapeHtml(this.formatDate(disclosure.savedAt))}${safeTrim(disclosure.savedBy) ? ` · על ידי ${escapeHtml(disclosure.savedBy)}` : ''}</div>` : '';
      this.els.disclosureCard.innerHTML = `<div class="mirrorsCard__head">
          <div>
            <div class="mirrorsCard__title">גילוי נאות</div>
            <div class="mirrorsCard__hint">המערכת שולפת את נוסח הגילוי הנאות המלא לפי החברה והמוצר שנבחרו בתיק הלקוח.</div>
          </div>
          <span class="mirrorsSummaryBadge">שלב 6 · הקראה מלאה</span>
        </div>
        <div class="mirrorsDisclosureIntro">הקרא את הטקסטים הבאים במלואם, אחד לאחד, בהתאם לחברה ולמוצר שמופיעים בכל פוליסה חדשה.</div>
        <div class="mirrorsDisclosureList">${cards}</div>
        ${savedNote}
        <div class="mirrorsReflectActions"><button class="btn btn--primary" data-mirror-disclosure-save type="button">שמור שלב גילוי נאות</button></div>`;
    },

    async saveDisclosure(){
      const rec = this.current();
      if(!rec) return;
      const entries = this.getDisclosureEntries(rec);
      if(!entries.length){
        alert('לא נמצא גילוי נאות תואם לשמירה עבור הפוליסות החדשות.');
        return;
      }
      const disclosure = this.getDisclosureState(rec);
      disclosure.savedAt = nowISO();
      disclosure.savedBy = safeTrim(Auth?.current?.name);
      disclosure.items = entries.map(item => ({ company: item.company, policyType: item.policyType, title: item.title, text: item.text }));
      State.data.meta.updatedAt = nowISO();
      rec.updatedAt = State.data.meta.updatedAt;
      await App.persist('שלב גילוי נאות נשמר');
      this.setFocusStep(rec, 7);
      this.render();
      alert('שלב גילוי נאות נשמר בהצלחה.');
    },

    getHealthDeclarationSource(rec){
      const primary = this.getPrimary(rec) || {};
      const insureds = this.getInsureds(rec);
      const primaryInsData = insureds?.[0]?.data && typeof insureds[0].data === 'object' ? insureds[0].data : null;
      const host = (primary && typeof primary === 'object' && primary.healthDeclaration) ? primary : (primaryInsData || primary);
      if(!host || typeof host !== 'object') return null;
      if(!host.healthDeclaration || typeof host.healthDeclaration !== 'object') host.healthDeclaration = {};
      if(!host.healthDeclaration.responses || typeof host.healthDeclaration.responses !== 'object') host.healthDeclaration.responses = {};
      if(!host.healthDeclaration.ui || typeof host.healthDeclaration.ui !== 'object') host.healthDeclaration.ui = {};
      if(primaryInsData && primaryInsData !== host) primaryInsData.healthDeclaration = host.healthDeclaration;
      if(primary && primary !== host) primary.healthDeclaration = host.healthDeclaration;
      return host.healthDeclaration;
    },

    getMirrorHealthState(rec){
      if(!rec.payload || typeof rec.payload !== 'object') rec.payload = {};
      if(!rec.payload.mirrorFlow || typeof rec.payload.mirrorFlow !== 'object') rec.payload.mirrorFlow = {};
      if(!rec.payload.mirrorFlow.healthStep || typeof rec.payload.mirrorFlow.healthStep !== 'object') rec.payload.mirrorFlow.healthStep = {};
      return rec.payload.mirrorFlow.healthStep;
    },

    buildMirrorHealthMeta(rec){
      const insureds = this.getInsureds(rec).map((ins, idx) => ({ ...ins, label: this.getInsuredDisplayName(ins, idx) }));
      const newPolicies = this.getNewPolicies(rec).slice();
      const ctx = {
        insureds,
        newPolicies,
        parseMoneyNumber: Wizard.parseMoneyNumber,
        getPolicyLabel: Wizard.getPolicyLabel,
        calcAge: Wizard.calcAge,
        buildPhoenixQuestionnaireCatalog: Wizard.buildPhoenixQuestionnaireCatalog,
        buildPhoenixFollowupFields: Wizard.buildPhoenixFollowupFields,
        getPhoenixFollowupSchemas: Wizard.getPhoenixFollowupSchemas,
        getHealthSchema: Wizard.getHealthSchema,
        getPhoenixHealthSchema: Wizard.getPhoenixHealthSchema
      };
      ctx.getHealthPoliciesForInsured = function(ins){ return Wizard.getHealthPoliciesForInsured.call(ctx, ins); };
      const categories = []
        .concat(Wizard.getHealthSchema.call(ctx) || [])
        .concat(Wizard.getPhoenixHealthSchema.call(ctx) || []);
      const map = {};
      categories.forEach(cat => {
        (cat.questions || []).forEach(q => {
          map[q.key] = {
            key: q.key,
            text: safeTrim(q.text) || safeTrim(q.label) || q.key,
            title: safeTrim(cat.title) || 'הצהרת בריאות',
            summary: safeTrim(cat.summary),
            fields: Array.isArray(q.fields) ? q.fields.slice() : []
          };
          if(q.originalKey && !map[q.originalKey]) map[q.originalKey] = map[q.key];
        });
      });
      return { insureds, categories, map };
    },

    getMirrorHealthEntries(rec){
      const source = this.getHealthDeclarationSource(rec);
      const responses = source?.responses || {};
      const meta = this.buildMirrorHealthMeta(rec);
      const insuredsById = {};
      (meta.insureds || []).forEach((ins, idx) => {
        insuredsById[String(ins.id)] = { ...ins, label: this.getInsuredDisplayName(ins, idx) };
      });
      const groups = {};
      Object.keys(responses || {}).forEach(qKey => {
        const qMeta = meta.map[qKey] || { key:qKey, text:qKey, title:'הצהרת בריאות', summary:'', fields:[] };
        const perIns = responses[qKey] || {};
        Object.keys(perIns || {}).forEach(insId => {
          const ins = insuredsById[String(insId)] || { id:insId, label:'מבוטח' };
          if(!groups[insId]) groups[insId] = { insured: ins, items: [] };
          const resp = perIns[insId] || { answer:'', fields:{}, saved:false };
          groups[insId].items.push({ qKey, insId, meta:qMeta, response:resp });
        });
      });
      return Object.values(groups).map(group => ({
        insured: group.insured,
        items: group.items.sort((a,b) => {
          const ta = safeTrim(a.meta?.title);
          const tb = safeTrim(b.meta?.title);
          if(ta !== tb) return ta.localeCompare(tb, 'he');
          return safeTrim(a.meta?.text).localeCompare(safeTrim(b.meta?.text), 'he');
        })
      }));
    },

    setMirrorHealthAnswer(rec, qKey, insId, answer){
      const source = this.getHealthDeclarationSource(rec);
      source.responses[qKey] = source.responses[qKey] || {};
      const prev = source.responses[qKey][insId] || { answer:'', fields:{}, saved:false };
      source.responses[qKey][insId] = {
        ...prev,
        answer,
        saved: answer === 'yes' ? false : false,
        fields: answer === 'yes' ? (prev.fields || {}) : {}
      };
    },

    setMirrorHealthField(rec, qKey, insId, fieldKey, value){
      const source = this.getHealthDeclarationSource(rec);
      source.responses[qKey] = source.responses[qKey] || {};
      const prev = source.responses[qKey][insId] || { answer:'yes', fields:{}, saved:false };
      source.responses[qKey][insId] = {
        ...prev,
        answer: 'yes',
        saved: false,
        fields: { ...(prev.fields || {}), [fieldKey]: safeTrim(value) }
      };
    },

    validateMirrorHealthItem(item){
      const resp = item?.response || {};
      if(resp.answer !== 'yes') return true;
      const fields = Array.isArray(item?.meta?.fields) ? item.meta.fields.filter(field => field.type !== 'section') : [];
      if(!fields.length) return true;
      return fields.every(field => safeTrim(resp.fields?.[field.key]));
    },

    renderMirrorHealthField(item, field){
      if(field.type === 'section'){
        return `<div class="mirrorsHealthFieldSection">${escapeHtml(field.label || '')}</div>`;
      }
      const val = safeTrim(item?.response?.fields?.[field.key] || '');
      const token = `${item.qKey}|${item.insId}|${field.key}`;
      if(field.type === 'textarea'){
        return `<label class="mirrorsHealthField mirrorsHealthField--full"><span>${escapeHtml(field.label || field.key)}</span><textarea class="input mirrorsHealthTextarea" rows="3" data-mirror-health-field="${escapeHtml(token)}">${escapeHtml(val)}</textarea></label>`;
      }
      return `<label class="mirrorsHealthField"><span>${escapeHtml(field.label || field.key)}</span><input class="input" type="text" data-mirror-health-field="${escapeHtml(token)}" value="${escapeHtml(val)}" /></label>`;
    },

    renderHealthDeclaration(rec){
      if(!this.els.healthCard) return;
      const verify = this.getVerifyState(rec);
      const disclosure = this.getDisclosureState(rec);
      if(this.consent !== 'yes' || !verify?.reflectionOpened || safeTrim(verify?.harConsent) !== 'yes' || !safeTrim(verify?.cancelSavedAt) || !safeTrim(disclosure?.savedAt)){
        this.els.healthCard.style.display = 'none';
        this.els.healthCard.innerHTML = '';
        return;
      }
      this.els.healthCard.style.display = 'block';
      const source = this.getHealthDeclarationSource(rec);
      const groups = this.getMirrorHealthEntries(rec);
      const stepState = this.getMirrorHealthState(rec);
      const savedNote = safeTrim(stepState.savedAt) ? `<div class="mirrorsDisclosureSaved">השלב נשמר בתאריך ${escapeHtml(this.formatDate(stepState.savedAt))}${safeTrim(stepState.savedBy) ? ` · על ידי ${escapeHtml(stepState.savedBy)}` : ''}</div>` : '';
      const body = groups.length ? groups.map(group => {
        const cards = (group.items || []).map(item => {
          const answer = safeTrim(item.response?.answer);
          const yesSelected = answer === 'yes';
          const noSelected = answer === 'no';
          const fields = Array.isArray(item.meta?.fields) ? item.meta.fields : [];
          const detailWarn = yesSelected && !this.validateMirrorHealthItem(item);
          return `<article class="mirrorsHealthItem${yesSelected ? ' is-positive' : noSelected ? ' is-negative' : ''}">
            <div class="mirrorsHealthItem__head">
              <div>
                <div class="mirrorsHealthItem__title">${escapeHtml(item.meta?.text || item.qKey)}</div>
                <div class="mirrorsHealthItem__meta">${escapeHtml(item.meta?.title || 'הצהרת בריאות')}</div>
              </div>
              <span class="mirrorsHealthItem__badge">${answer === 'yes' ? 'כן' : answer === 'no' ? 'לא' : 'טרם סומן'}</span>
            </div>
            <div class="mirrorsChoiceGrid mirrorsChoiceGrid--health">
              <button class="mirrorsMiniChoice${yesSelected ? ' is-selected' : ''}" data-mirror-health-answer="${escapeHtml(`${item.qKey}|${item.insId}|yes`)}" type="button">כן</button>
              <button class="mirrorsMiniChoice${noSelected ? ' is-selected' : ''}" data-mirror-health-answer="${escapeHtml(`${item.qKey}|${item.insId}|no`)}" type="button">לא</button>
            </div>
            ${yesSelected ? `<div class="mirrorsHealthFields">${fields.length ? fields.map(field => this.renderMirrorHealthField(item, field)).join('') : `<div class="mirrorsHealthNoFields">אין לשאלה זו שאלון המשך מובנה, אבל הסימון נשמר כ־כן.</div>`}</div>` : ''}
            ${detailWarn ? `<div class="mirrorsHealthWarn">חסר פירוט בשאלון ההמשך. יש להשלים את כל השדות לפני שמירת השלב.</div>` : ''}
          </article>`;
        }).join('');
        return `<section class="mirrorsHealthGroup">
          <div class="mirrorsHealthGroup__head">
            <div class="mirrorsHealthGroup__name">${escapeHtml(group.insured?.label || 'מבוטח')}</div>
            <div class="mirrorsHealthGroup__sub">כך נשמרו סימוני כן / לא והשאלונים מהטופס המקורי של החברה</div>
          </div>
          <div class="mirrorsHealthGroup__list">${cards}</div>
        </section>`;
      }).join('') : `<div class="mirrorsReflectNote">לא נמצאה הצהרת בריאות שמורה בתיק הלקוח. יש לוודא שהצהרת הבריאות מולאה ונשמרה בטופס המקורי.</div>`;
      this.els.healthCard.innerHTML = `<div class="mirrorsCard__head">
          <div>
            <div class="mirrorsCard__title">הצהרת בריאות</div>
            <div class="mirrorsCard__hint">המערכת שולפת את הסימונים המקוריים של כן / לא ואת שאלוני ההמשך כפי שמולאו בטופס החברה, ומאפשרת לערוך אותם מתוך השיקוף.</div>
          </div>
          <span class="mirrorsSummaryBadge">שלב 7 · הצהרת בריאות</span>
        </div>
        <div class="mirrorsHealthIntro">
          <div class="mirrorsHealthIntro__title">נוסח חובה לפני מעבר על ההצהרה</div>
          <div class="mirrorsHealthIntro__text">
            בעת נעבור להצהרת הבריאות. אני יעבור איתך על מספר שאלות. חשוב לתת בעניינים אלו תשובה מלאה וכנה. אחרת תהיה לכך השפעה על תגמולי הביטוח.
            <br><br>
            במילים אחרות: התשובות שלך לשאלות הצהרת הבריאות שיוקראו לך כעת הן הבסיס לפוליסה, וחשוב מאוד שתענה עליהן בצורה מלאה, נכונה וכנה.
            <br><br>
            לתשומת ליבך מענה שאינו מלא, נכון וכנה עלול לפגוע בך במעמד התביעה ואף עלול להוביל לביטול הפוליסה.
          </div>
        </div>
        ${body}
        ${savedNote}
        <div class="mirrorsReflectActions"><button class="btn btn--primary" data-mirror-health-save type="button">שמור שלב הצהרת בריאות</button></div>`;
    },

    async saveHealthDeclaration(){
      const rec = this.current();
      if(!rec) return;
      const groups = this.getMirrorHealthEntries(rec);
      if(!groups.length){
        alert('לא נמצאה הצהרת בריאות שמורה עבור הלקוח הזה.');
        return;
      }
      for(const group of groups){
        for(const item of (group.items || [])){
          const answer = safeTrim(item.response?.answer);
          if(answer !== 'yes' && answer !== 'no'){
            alert(`יש להשלים סימון כן/לא עבור ${group.insured?.label || 'מבוטח'} בשאלה: ${item.meta?.text || item.qKey}`);
            return;
          }
          if(answer === 'yes' && !this.validateMirrorHealthItem(item)){
            alert(`יש להשלים את שאלון ההמשך עבור ${group.insured?.label || 'מבוטח'} בשאלה: ${item.meta?.text || item.qKey}`);
            return;
          }
        }
      }
      const source = this.getHealthDeclarationSource(rec);
      Object.keys(source.responses || {}).forEach(qKey => {
        const perIns = source.responses[qKey] || {};
        Object.keys(perIns).forEach(insId => {
          const answer = safeTrim(perIns[insId]?.answer);
          perIns[insId].saved = (answer === 'yes');
          if(answer === 'no') perIns[insId].saved = false;
        });
      });
      const stepState = this.getMirrorHealthState(rec);
      stepState.savedAt = nowISO();
      stepState.savedBy = safeTrim(Auth?.current?.name);
      stepState.itemsCount = groups.reduce((sum, group) => sum + ((group.items || []).length), 0);
      State.data.meta.updatedAt = nowISO();
      rec.updatedAt = State.data.meta.updatedAt;
      await App.persist('שלב הצהרת בריאות נשמר');
      this.setFocusStep(rec, 8);
      this.render();
      alert('שלב הצהרת בריאות נשמר בהצלחה.');
    },

    getPaymentHost(rec){
      const primary = this.getPrimary(rec) || {};
      const insureds = this.getInsureds(rec);
      const primaryInsData = insureds?.[0]?.data && typeof insureds[0].data === 'object' ? insureds[0].data : null;
      const host = primaryInsData || primary;
      const defaults = {
        payerChoice: 'insured',
        selectedPayerId: '',
        externalPayer: { relation:'', firstName:'', lastName:'', idNumber:'', birthDate:'', phone:'' },
        paymentMethod: 'cc',
        cc: { holderName:'', holderId:'', cardNumber:'', exp:'' },
        ho: { account:'', branch:'', bankName:'', bankNo:'' }
      };
      host.payerChoice = safeTrim(host.payerChoice) || defaults.payerChoice;
      host.selectedPayerId = safeTrim(host.selectedPayerId);
      host.externalPayer = Object.assign({}, defaults.externalPayer, host.externalPayer || {});
      host.paymentMethod = safeTrim(host.paymentMethod) || defaults.paymentMethod;
      host.cc = Object.assign({}, defaults.cc, host.cc || {});
      host.ho = Object.assign({}, defaults.ho, host.ho || {});
      if(primary && primary !== host){
        primary.payerChoice = host.payerChoice;
        primary.selectedPayerId = host.selectedPayerId;
        primary.externalPayer = host.externalPayer;
        primary.paymentMethod = host.paymentMethod;
        primary.cc = host.cc;
        primary.ho = host.ho;
      }
      return host;
    },

    getMirrorPaymentState(rec){
      if(!rec.payload || typeof rec.payload !== 'object') rec.payload = {};
      if(!rec.payload.mirrorFlow || typeof rec.payload.mirrorFlow !== 'object') rec.payload.mirrorFlow = {};
      if(!rec.payload.mirrorFlow.paymentStep || typeof rec.payload.mirrorFlow.paymentStep !== 'object') rec.payload.mirrorFlow.paymentStep = {};
      const store = rec.payload.mirrorFlow.paymentStep;
      if(typeof store.clientVerified !== 'boolean') store.clientVerified = false;
      return store;
    },

    getPaymentSummary(rec){
      const host = this.getPaymentHost(rec);
      const method = safeTrim(host.paymentMethod) === 'ho' ? 'ho' : 'cc';
      const payerChoice = safeTrim(host.payerChoice) === 'external' ? 'external' : 'insured';
      const insureds = this.getInsureds(rec);
      const payer = payerChoice === 'insured'
        ? insureds.find(ins => String(ins.id) === String(host.selectedPayerId)) || insureds[0] || null
        : null;
      return {
        host,
        method,
        payerChoice,
        payerName: payerChoice === 'external'
          ? `${safeTrim(host.externalPayer?.firstName)} ${safeTrim(host.externalPayer?.lastName)}`.trim()
          : this.getInsuredDisplayName(payer, 0),
        payerMeta: payerChoice === 'external'
          ? [safeTrim(host.externalPayer?.relation), safeTrim(host.externalPayer?.idNumber)].filter(Boolean).join(' · ')
          : safeTrim(payer?.data?.idNumber || ''),
      };
    },

    maskTrailingDigits(value, keep=4){
      const raw = String(value || '').replace(/\D+/g,'');
      if(!raw) return '—';
      if(raw.length <= keep) return raw;
      return `${'*'.repeat(Math.max(0, raw.length - keep))}${raw.slice(-keep)}`;
    },

    setMirrorPaymentMethod(rec, method){
      const host = this.getPaymentHost(rec);
      host.paymentMethod = method === 'ho' ? 'ho' : 'cc';
      const primary = this.getPrimary(rec) || {};
      if(primary && primary !== host) primary.paymentMethod = host.paymentMethod;
      const step = this.getMirrorPaymentState(rec);
      step.clientVerified = false;
      delete step.savedAt;
      delete step.savedBy;
    },

    setMirrorPaymentField(rec, field, value){
      const host = this.getPaymentHost(rec);
      const parts = field.split('.');
      if(parts[0] === 'paymentMethod'){
        this.setMirrorPaymentMethod(rec, value);
        return;
      }
      if(parts[0] === 'cc'){
        host.cc = host.cc || {};
        host.cc[parts[1]] = safeTrim(value);
      }else if(parts[0] === 'ho'){
        host.ho = host.ho || {};
        host.ho[parts[1]] = safeTrim(value);
      }else if(parts[0] === 'externalPayer'){
        host.externalPayer = host.externalPayer || {};
        host.externalPayer[parts[1]] = safeTrim(value);
      }else{
        host[parts[0]] = safeTrim(value);
      }
      const primary = this.getPrimary(rec) || {};
      if(primary && primary !== host){
        primary.payerChoice = host.payerChoice;
        primary.selectedPayerId = host.selectedPayerId;
        primary.externalPayer = host.externalPayer;
        primary.paymentMethod = host.paymentMethod;
        primary.cc = host.cc;
        primary.ho = host.ho;
      }
      const step = this.getMirrorPaymentState(rec);
      step.clientVerified = false;
      delete step.savedAt;
      delete step.savedBy;
    },

    getMirrorIssuanceState(rec){
      if(!rec.payload || typeof rec.payload !== 'object') rec.payload = {};
      if(!rec.payload.mirrorFlow || typeof rec.payload.mirrorFlow !== 'object') rec.payload.mirrorFlow = {};
      if(!rec.payload.mirrorFlow.issuanceStep || typeof rec.payload.mirrorFlow.issuanceStep !== 'object') rec.payload.mirrorFlow.issuanceStep = {};
      const store = rec.payload.mirrorFlow.issuanceStep;
      if(!safeTrim(store.clientAnswer)) store.clientAnswer = '';
      if(typeof store.agentRead !== 'boolean') store.agentRead = false;
      return store;
    },

    getMirrorEffectiveDateText(rec){
      const dates = this.getNewPolicies(rec)
        .map(policy => safeTrim(policy?.startDate || policy?.policyStartDate || policy?.beginDate || ''))
        .filter(Boolean);
      const unique = [...new Set(dates)];
      if(!unique.length) return 'טרם הוזן';
      if(unique.length === 1) return unique[0];
      return unique.join(' / ');
    },

    renderMirrorPaymentField(label, field, value, opts = {}){
      const type = opts.type || 'text';
      const dir = opts.dir ? ` dir="${escapeHtml(opts.dir)}"` : '';
      const inputmode = opts.inputmode ? ` inputmode="${escapeHtml(opts.inputmode)}"` : '';
      const placeholder = opts.placeholder ? ` placeholder="${escapeHtml(opts.placeholder)}"` : '';
      return `<label class="mirrorsHealthField"><span>${escapeHtml(label)}</span><input class="input" type="${escapeHtml(type)}" data-mirror-payment-field="${escapeHtml(field)}" value="${escapeHtml(value || '')}"${dir}${inputmode}${placeholder} /></label>`;
    },

    renderPaymentDetails(rec){
      if(!this.els.paymentCard) return;
      const verify = this.getVerifyState(rec);
      const disclosure = this.getDisclosureState(rec);
      const health = this.getMirrorHealthState(rec);
      if(this.consent !== 'yes' || !verify?.reflectionOpened || safeTrim(verify?.harConsent) !== 'yes' || !safeTrim(verify?.cancelSavedAt) || !safeTrim(disclosure?.savedAt) || !safeTrim(health?.savedAt)){
        this.els.paymentCard.style.display = 'none';
        this.els.paymentCard.innerHTML = '';
        return;
      }
      this.els.paymentCard.style.display = 'block';
      const summary = this.getPaymentSummary(rec);
      const host = summary.host;
      const method = summary.method;
      const step = this.getMirrorPaymentState(rec);
      const methodLabel = method === 'cc' ? 'כרטיס אשראי' : 'הוראת קבע';
      const paymentFields = method === 'cc'
        ? [
            ['שם בעל הכרטיס','cc.holderName',host.cc?.holderName || ''],
            ['ת״ז בעל הכרטיס','cc.holderId',host.cc?.holderId || '', {'inputmode':'numeric','dir':'ltr'}],
            ['מספר כרטיס','cc.cardNumber',host.cc?.cardNumber || '', {'inputmode':'numeric','dir':'ltr'}],
            ['תוקף','cc.exp',host.cc?.exp || '', {'inputmode':'numeric','dir':'ltr','placeholder':'MM/YY'}]
          ]
        : [
            ['שם בנק','ho.bankName',host.ho?.bankName || ''],
            ['מספר בנק','ho.bankNo',host.ho?.bankNo || '', {'inputmode':'numeric','dir':'ltr'}],
            ['סניף','ho.branch',host.ho?.branch || '', {'inputmode':'numeric','dir':'ltr'}],
            ['מספר חשבון','ho.account',host.ho?.account || '', {'inputmode':'numeric','dir':'ltr'}]
          ];
      const preview = method === 'cc'
        ? `<div class="mirrorsPaymentPreview__value">${escapeHtml(this.maskTrailingDigits(host.cc?.cardNumber || ''))}</div><div class="mirrorsPaymentPreview__sub">כרטיס · ${escapeHtml(host.cc?.exp || 'ללא תוקף')}</div>`
        : `<div class="mirrorsPaymentPreview__value">${escapeHtml(this.maskTrailingDigits(host.ho?.account || ''))}</div><div class="mirrorsPaymentPreview__sub">חשבון · בנק ${escapeHtml(host.ho?.bankNo || host.ho?.bankName || '—')}</div>`;
      const savedNote = safeTrim(step.savedAt) ? `<div class="mirrorsDisclosureSaved">השלב נשמר בתאריך ${escapeHtml(this.formatDate(step.savedAt))}${safeTrim(step.savedBy) ? ` · על ידי ${escapeHtml(step.savedBy)}` : ''}</div>` : '';
      this.els.paymentCard.innerHTML = `<div class="mirrorsCard__head">
          <div>
            <div class="mirrorsCard__title">פרטי אמצעי תשלום</div>
            <div class="mirrorsCard__hint">המערכת שולפת את פרטי התשלום שנשמרו בפרטי משלם, ומאפשרת לערוך אותם לפני המשך השיקוף.</div>
          </div>
          <span class="mirrorsSummaryBadge">שלב 8 · אמצעי תשלום</span>
        </div>
        <div class="mirrorsHealthIntro mirrorsHealthIntro--payment">
          <div class="mirrorsHealthIntro__title">נוסח חובה לפני אימות אמצעי תשלום</div>
          <div class="mirrorsHealthIntro__text">קיימות 2 אפשרויות לתשלום. כרטיס אשראי או הוראת קבע.<br><br>אני צריך שתעבור איתי על אמצעי התשלום שלך לצורך אימות.</div>
        </div>
        <div class="mirrorsPaymentShell">
          <div class="mirrorsPaymentPreview mirrorsPaymentPreview--${method === 'cc' ? 'card' : 'bank'}">
            <div class="mirrorsPaymentPreview__kicker">אמצעי תשלום שנשמר</div>
            <div class="mirrorsPaymentPreview__title">${escapeHtml(methodLabel)}</div>
            ${preview}
            <div class="mirrorsPaymentPreview__payer">משלם: <strong>${escapeHtml(summary.payerName || '—')}</strong>${summary.payerMeta ? ` · ${escapeHtml(summary.payerMeta)}` : ''}</div>
          </div>
          <div class="mirrorsPaymentBody">
            <div class="mirrorsPaymentMethods">
              <button class="mirrorsCancelOption${method === 'cc' ? ' is-selected' : ''}" data-mirror-payment-method="cc" type="button"><span class="mirrorsCancelOption__kicker">אפשרות 1</span><strong>כרטיס אשראי</strong><small>מעבר על בעל הכרטיס, מספר הכרטיס והתוקף</small></button>
              <button class="mirrorsCancelOption${method === 'ho' ? ' is-selected' : ''}" data-mirror-payment-method="ho" type="button"><span class="mirrorsCancelOption__kicker">אפשרות 2</span><strong>הוראת קבע</strong><small>מעבר על שם הבנק, סניף ומספר חשבון</small></button>
            </div>
            <div class="mirrorsPaymentGrid"></div>
            <div class="mirrorsVerifyGrid mirrorsVerifyGrid--wide mirrorsVerifyGrid--paymentMeta">
              <div class="mirrorsInfoCard"><span>סוג משלם</span><strong>${escapeHtml(summary.payerChoice === 'external' ? 'משלם חריג' : 'מבוטח קיים')}</strong></div>
              <div class="mirrorsInfoCard"><span>שם משלם</span><strong>${escapeHtml(summary.payerName || '—')}</strong></div>
              <div class="mirrorsInfoCard"><span>אמצעי תשלום</span><strong>${escapeHtml(methodLabel)}</strong></div>
            </div>
            <div class="mirrorsPaymentFields">${paymentFields.map(args => this.renderMirrorPaymentField(args[0], args[1], args[2], args[3] || {})).join('')}</div>
            <div class="mirrorsAnswerBox mirrorsAnswerBox--payment">
              <div class="mirrorsAnswerBox__title">האם הלקוח אישר שאמצעי התשלום נכון?</div>
              <div class="mirrorsAnswerGrid">
                <button class="mirrorsAnswerCard mirrorsAnswerCard--yes${step.clientVerified ? ' is-selected' : ''}" data-mirror-payment-verified="yes" type="button"><span class="mirrorsAnswerCard__icon">✓</span><strong>כן, הלקוח אישר</strong><small>הפרטים אומתו מול הלקוח</small></button>
                <button class="mirrorsAnswerCard mirrorsAnswerCard--no${!step.clientVerified ? ' is-selected' : ''}" data-mirror-payment-verified="no" type="button"><span class="mirrorsAnswerCard__icon">✎</span><strong>נדרש תיקון / עריכה</strong><small>עדכן את הפרטים ואז שמור מחדש</small></button>
              </div>
            </div>
          </div>
        </div>
        ${savedNote}
        <div class="mirrorsReflectActions"><button class="btn btn--primary" data-mirror-payment-save type="button">שמור שלב אמצעי תשלום</button></div>`;
    },

    async savePaymentDetails(){
      const rec = this.current();
      if(!rec) return;
      const summary = this.getPaymentSummary(rec);
      const host = summary.host;
      if(summary.method === 'cc'){
        const req = [['שם בעל הכרטיס', host.cc?.holderName], ['ת"ז בעל הכרטיס', host.cc?.holderId], ['מספר כרטיס', host.cc?.cardNumber], ['תוקף', host.cc?.exp]];
        const miss = req.find(item => !safeTrim(item[1]));
        if(miss){ alert(`יש להשלים ${miss[0]} לפני שמירת אמצעי התשלום.`); return; }
      }else{
        const req = [['שם בנק', host.ho?.bankName], ['מספר בנק', host.ho?.bankNo], ['סניף', host.ho?.branch], ['מספר חשבון', host.ho?.account]];
        const miss = req.find(item => !safeTrim(item[1]));
        if(miss){ alert(`יש להשלים ${miss[0]} לפני שמירת אמצעי התשלום.`); return; }
      }
      const step = this.getMirrorPaymentState(rec);
      if(!step.clientVerified){
        alert('יש לסמן שהלקוח אישר את אמצעי התשלום לפני השמירה.');
        return;
      }
      step.savedAt = nowISO();
      step.savedBy = safeTrim(Auth?.current?.name);
      step.method = summary.method;
      step.methodLabel = summary.method === 'cc' ? 'כרטיס אשראי' : 'הוראת קבע';
      State.data.meta.updatedAt = nowISO();
      rec.updatedAt = State.data.meta.updatedAt;
      await App.persist('שלב אמצעי תשלום נשמר');
      this.setFocusStep(rec, 9);
      this.render();
      alert('שלב אמצעי תשלום נשמר בהצלחה.');
    },

    renderIssuanceStep(rec){
      if(!this.els.issuanceCard) return;
      const verify = this.getVerifyState(rec);
      const disclosure = this.getDisclosureState(rec);
      const health = this.getMirrorHealthState(rec);
      const payment = this.getMirrorPaymentState(rec);
      if(this.consent !== 'yes' || !verify?.reflectionOpened || safeTrim(verify?.harConsent) !== 'yes' || !safeTrim(verify?.cancelSavedAt) || !safeTrim(disclosure?.savedAt) || !safeTrim(health?.savedAt) || !safeTrim(payment?.savedAt)){
        this.els.issuanceCard.style.display = 'none';
        this.els.issuanceCard.innerHTML = '';
        return;
      }
      this.els.issuanceCard.style.display = 'block';
      const step = this.getMirrorIssuanceState(rec);
      const effectiveDateText = this.getMirrorEffectiveDateText(rec);
      const savedNote = safeTrim(step.savedAt) ? `<div class="mirrorsDisclosureSaved">השלב נשמר בתאריך ${escapeHtml(this.formatDate(step.savedAt))}${safeTrim(step.savedBy) ? ` · על ידי ${escapeHtml(step.savedBy)}` : ''}</div>` : '';
      this.els.issuanceCard.innerHTML = `<div class="mirrorsCard__head">
          <div>
            <div class="mirrorsCard__title">כניסה לתוקף, SMS ומסמכי פוליסה</div>
            <div class="mirrorsCard__hint">שלב קריאה מסכם לאחר אימות אמצעי התשלום. ניתן לסמן את תשובת הלקוח, אך אין חובה לבחור כן/לא כדי להמשיך.</div>
          </div>
          <span class="mirrorsSummaryBadge">שלב 9 · כניסה לתוקף</span>
        </div>
        <div class="mirrorsIssuanceIntro">
          <div class="mirrorsIssuanceIntro__kicker">נוסח קריאה מחייב</div>
          <div class="mirrorsIssuanceIntro__text">הפוליסה תיכנס לתוקף החל מהתאריך <span class="mirrorsIssuanceDate">${escapeHtml(effectiveDateText)}</span> או מועד הפקת הפוליסה על ידי החברה לפי המאוחר מביניהם ובכפוף לאמצעי תשלום תקין. בעת הפקת הפוליסה וכניסתה לתוקף תישלח אליך הודעת SMS מחברת הביטוח, יש לעקוב אחרי קבלת הודעה זו.</div>
          <div class="mirrorsIssuanceIntro__text">חשוב לציין כי המידע שמסרת בשיחה מרצונך החופשי וישמר במאגרי החברה ומטעמה לצורך מתן שירות, תפעול הביטוח, עיבוד מידע, פניות ועדכונים.</div>
        </div>
        <div class="mirrorsAnswerBox mirrorsAnswerBox--issuance">
          <div class="mirrorsAnswerBox__title">מה ענה הלקוח?</div>
          <div class="mirrorsAnswerGrid">
            <button class="mirrorsAnswerCard mirrorsAnswerCard--yes${step.clientAnswer === 'yes' ? ' is-selected' : ''}" data-mirror-issuance-answer="yes" type="button"><span class="mirrorsAnswerCard__icon">✓</span><strong>כן</strong><small>הלקוח אישר את הנאמר</small></button>
            <button class="mirrorsAnswerCard mirrorsAnswerCard--no${step.clientAnswer === 'no' ? ' is-selected' : ''}" data-mirror-issuance-answer="no" type="button"><span class="mirrorsAnswerCard__icon">!</span><strong>לא</strong><small>הלקוח לא אישר / ביקש הבהרה</small></button>
          </div>
          <div class="mirrorsAnswerBox__hint">אין חובה לבחור תשובה כדי לשמור את השלב.</div>
        </div>
        <div class="mirrorsIssuanceOutro">
          <div class="mirrorsIssuanceOutro__title">המשך הקריאה של הנציג</div>
          <div class="mirrorsIssuanceOutro__text">כל הנאמר בשיחה הינו בכפוף לפוליסה אשר תישלח אליך לאחר קבלתך לביטוח. מסמכי הפוליסה והדיווחים יישלחו אליך לנייד/מייל. תוכל לעדכן בכל שלב את החברה איך תעדיף לקבל אותם.</div>
          <button class="mirrorsReadToggle${step.agentRead ? ' is-read' : ''}" data-mirror-issuance-read type="button">${step.agentRead ? '✓ הנציג סימן שהקריא את ההמשך' : 'סמן שהנציג הקריא את ההמשך'}</button>
        </div>
        ${savedNote}
        <div class="mirrorsReflectActions"><button class="btn btn--primary" data-mirror-issuance-save type="button">שמור שלב כניסה לתוקף</button></div>`;
    },

    async saveIssuanceStep(){
      const rec = this.current();
      if(!rec) return;
      const step = this.getMirrorIssuanceState(rec);
      step.savedAt = nowISO();
      step.savedBy = safeTrim(Auth?.current?.name);
      step.effectiveDateText = this.getMirrorEffectiveDateText(rec);
      State.data.meta.updatedAt = nowISO();
      rec.updatedAt = State.data.meta.updatedAt;
      await App.persist('שלב כניסה לתוקף נשמר');
      this.setFocusStep(rec, 9);
      this.render();
      alert('שלב כניסה לתוקף נשמר בהצלחה.');
    },

    renderMirrorNewPolicyRow(policy, idx){
      const company = safeTrim(policy?.company) || 'חברה לא מוגדרת';
      const type = safeTrim(policy?.type) || 'פוליסה לא מוגדרת';
      const insuredText = this.getMirrorNewPolicyInsured(policy);
      const premiumBeforeRaw = safeTrim(policy?.premiumMonthly || policy?.monthlyPremium || policy?.premium || '');
      const premiumBefore = premiumBeforeRaw ? `${premiumBeforeRaw} ₪` : '—';
      const premiumAfter = this.getMirrorPolicyAfterDiscount(policy);
      const startDate = safeTrim(policy?.startDate || policy?.policyStartDate || policy?.beginDate || '');
      const amountLabel = this.getPolicyAmountLabel(policy);
      const amountValue = this.getPolicyAmountValue(policy);
      const discountText = this.getMirrorNewPolicyDiscountText(policy);
      const logoSrc = this.getCompanyLogo(company);
      const logo = logoSrc
        ? `<span class="mirrorsReflectCompany__logo"><img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(company)}" /></span>`
        : `<span class="mirrorsReflectCompany__fallback">${escapeHtml((company || '•').slice(0,1))}</span>`;
      return `<div class="mirrorsNewPolicyRow" style="animation-delay:${idx * 60}ms">
        <div class="mirrorsNewPolicyRow__head">
          <div class="mirrorsNewPolicyRow__titleWrap">
            ${logo}
            <div>
              <div class="mirrorsNewPolicyRow__title">${escapeHtml(type)}</div>
              <div class="mirrorsNewPolicyRow__sub">${escapeHtml(company)} · ${escapeHtml(insuredText)}</div>
            </div>
          </div>
          <span class="mirrorsNewPolicyRow__badge">פוליסה מוצעת</span>
        </div>
        <div class="mirrorsNewPolicyRow__grid">
          <div class="mirrorsNewPolicyRow__cell"><span>פרמיה חודשית</span><strong>${escapeHtml(premiumBefore)}</strong></div>
          <div class="mirrorsNewPolicyRow__cell"><span>פרמיה אחרי הנחה</span><strong>${escapeHtml(premiumAfter)}</strong></div>
          <div class="mirrorsNewPolicyRow__cell"><span>${escapeHtml(amountLabel)}</span><strong>${escapeHtml(amountValue || '—')}</strong></div>
          <div class="mirrorsNewPolicyRow__cell"><span>הנחה</span><strong>${escapeHtml(discountText)}</strong></div>
          <div class="mirrorsNewPolicyRow__cell"><span>תאריך תחילה</span><strong>${escapeHtml(startDate || '—')}</strong></div>
        </div>
      </div>`;
    },

    getMirrorNewPolicyInsured(policy){
      if(safeTrim(policy?.insuredMode) === 'couple') return 'מבוטח ראשי + מבוטח משני';
      const insuredId = safeTrim(policy?.insuredId);
      const insureds = this.getInsureds(this.current());
      const ins = insureds.find(item => safeTrim(item?.id) === insuredId);
      if(ins) return `${this.getInsuredLabel(ins)} · ${this.getInsuredDisplayName(ins)}`;
      return safeTrim(policy?.insuredLabel || policy?.insuredName || 'מבוטח');
    },

    getMirrorPolicyAfterDiscount(policy){
      const raw = Number(String(policy?.premiumAfterDiscount ?? '').replace(/[^\d.-]/g, ''));
      if(Number.isFinite(raw) && raw > 0) return `${raw.toLocaleString('he-IL')} ₪`;
      const premium = Number(String(policy?.premiumMonthly || policy?.monthlyPremium || policy?.premium || '0').replace(/[^\d.-]/g, '')) || 0;
      const discountPct = Number(String(policy?.discountPct || '0').replace(/[^\d.-]/g, '')) || 0;
      const after = premium > 0 ? Math.max(0, premium - (premium * discountPct / 100)) : 0;
      return after > 0 ? `${after.toLocaleString('he-IL')} ₪` : '—';
    },

    getMirrorNewPolicyDiscountText(policy){
      return this.getPolicyDiscountDisplayText(policy);
    },


    renderReflectionPolicyCard(row, idx){
      const p = row.policy || {};
      const company = safeTrim(p.company) || 'חברה לא מוגדרת';
      const type = safeTrim(p.type) || 'מוצר לא מוגדר';
      const status = this.getPolicyStatusValue(p);
      const premium = safeTrim(p.monthlyPremium || p.premiumMonthly || p.premium || '');
      const amountLabel = this.getPolicyAmountLabel(p);
      const amountValue = this.getPolicyAmountValue(p);
      const startDate = safeTrim(p.startDate || p.policyStartDate || p.beginDate || '');
      const logoSrc = this.getCompanyLogo(company);
      const logo = logoSrc ? `<img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(company)}" />` : `<span class="mirrorsChip__logoFallback">${escapeHtml(company.slice(0,1))}</span>`;
      return `<div class="mirrorsPolicyReflectCard">
        <div class="mirrorsPolicyReflectCard__top">
          <div class="mirrorsPolicyReflectCard__title">
            <div class="mirrorsPolicyReflectCard__logo">${logo}</div>
            <div>
              <div class="mirrorsPolicyReflectCard__company">${escapeHtml(company)}</div>
              <div class="mirrorsPolicyReflectCard__insured">${escapeHtml(row.insuredLabel)} · ${escapeHtml(row.insuredName)}</div>
            </div>
          </div>
          <div class="mirrorsPolicyReflectCard__status">${escapeHtml(status)}</div>
        </div>
        <div class="mirrorsPolicyGrid">
          <label class="mirrorsField"><span>חברה</span><input class="input" data-reflect-index="${idx}" data-reflect-field="company" value="${escapeHtml(company)}" /></label>
          <label class="mirrorsField"><span>מוצר</span><input class="input" data-reflect-index="${idx}" data-reflect-field="type" value="${escapeHtml(type)}" /></label>
          <label class="mirrorsField"><span>סטטוס</span><input class="input" data-reflect-index="${idx}" data-reflect-field="status" value="${escapeHtml(status)}" /></label>
          <label class="mirrorsField"><span>פרמיה חודשית</span><input class="input" data-reflect-index="${idx}" data-reflect-field="monthlyPremium" value="${escapeHtml(premium)}" /></label>
          <label class="mirrorsField"><span>${escapeHtml(amountLabel)}</span>${amountLabel === 'כיסויים' ? `<textarea class="textarea" data-reflect-index="${idx}" data-reflect-field="covers">${escapeHtml(Array.isArray(p.covers) ? p.covers.join(', ') : amountValue)}</textarea>` : `<input class="input" data-reflect-index="${idx}" data-reflect-field="${amountLabel === 'סכום פיצוי' ? 'compensation' : 'sumInsured'}" value="${escapeHtml(amountValue)}" />`}</label>
          <label class="mirrorsField"><span>תאריך תחילה</span><input class="input" data-reflect-index="${idx}" data-reflect-field="startDate" value="${escapeHtml(startDate)}" /></label>
        </div>
      </div>`;
    },

    async saveReflection(){
      const rec = this.current();
      if(!rec) return;
      const store = this.getVerifyState(rec);
      if(safeTrim(store.harConsent) !== 'yes'){
        alert('יש לסמן שהלקוח אישר את בדיקת הר הביטוח כדי לשמור את שלב השיקוף.');
        return;
      }
      const policies = this.getExistingPolicies(rec);
      policies.forEach(({ policy }) => {
        if(typeof policy.covers === 'string'){
          policy.covers = policy.covers.split(',').map(x => safeTrim(x)).filter(Boolean);
        }
      });
      store.reflectionSavedAt = nowISO();
      store.reflectionSavedBy = safeTrim(Auth?.current?.name);
      State.data.meta.updatedAt = nowISO();
      rec.updatedAt = State.data.meta.updatedAt;
      await App.persist('שיקוף הר הביטוח נשמר');
      this.render();
      alert('מסך שיקוף הר הביטוח נשמר בהצלחה.');
    },

    formatDate(v){
      if(!v) return '—';
      const d = new Date(v);
      if(Number.isNaN(+d)) return String(v);
      try{ return d.toLocaleString('he-IL'); }catch(_e){ return String(v); }
    }
  };

const SystemRepairUI = {
    els: {},
    busy: false,

    init(){
      this.els.wrap = $("#systemRepairModal");
      this.els.backdrop = $("#systemRepairBackdrop");
      this.els.close = $("#systemRepairClose");
      this.els.cancel = $("#systemRepairCancel");
      this.els.confirm = $("#systemRepairConfirm");
      this.els.status = $("#systemRepairStatus");
      this.els.progress = $("#systemRepairProgress");
      this.els.progressBar = $("#systemRepairProgressBar");
      this.els.progressSteps = Array.from(document.querySelectorAll("#systemRepairProgressSteps .systemRepairProgress__step"));
      this.els.btn = $("#btnSystemRepair");

      on(this.els.btn, "click", () => this.open());
      on(this.els.close, "click", () => this.close());
      on(this.els.cancel, "click", () => this.close());
      on(this.els.backdrop, "click", () => this.close());
      on(this.els.wrap, "click", (ev) => {
        if(ev.target?.getAttribute?.("data-close") === "1") this.close();
      });
      on(document, "keydown", (ev) => {
        if(ev.key === "Escape" && this.isOpen() && !this.busy) this.close();
      });
      on(this.els.confirm, "click", async () => {
        if(this.els.confirm?.dataset.mode === "close" && !this.busy){
          this.close();
          return;
        }
        await this.run();
      });
    },

    isOpen(){
      return !!this.els.wrap && this.els.wrap.getAttribute("aria-hidden") === "false";
    },

    open(){
      if(!this.els.wrap) return;
      this.resetActionButtons();
      this.showProgress(false);
      this.setStatus("המערכת מוכנה לבצע טיפול.", "");
      this.els.wrap.classList.add("is-open");
      this.els.wrap.setAttribute("aria-hidden", "false");
    },

    close(){
      if(!this.els.wrap || this.busy) return;
      this.els.wrap.classList.remove("is-open");
      this.els.wrap.setAttribute("aria-hidden", "true");
      this.resetActionButtons();
      this.showProgress(false);
      this.setStatus("המערכת מוכנה לבצע טיפול.", "");
    },

    setStatus(msg, tone=""){
      const el = this.els.status;
      if(!el) return;
      el.textContent = String(msg || "");
      el.classList.remove("is-working", "is-ok", "is-err");
      if(tone) el.classList.add(tone);
    },

    setBusy(flag){
      this.busy = !!flag;
      if(this.els.confirm) this.els.confirm.disabled = !!flag;
      if(this.els.cancel) this.els.cancel.disabled = !!flag;
      if(this.els.close) this.els.close.disabled = !!flag;
      if(this.els.confirm) this.els.confirm.textContent = flag ? "מבצע טיפול..." : ((this.els.confirm.dataset.mode === "close") ? "אישור" : "אישור והפעל טיפול");
    },

    resetActionButtons(){
      if(this.els.confirm){
        this.els.confirm.dataset.mode = "run";
        this.els.confirm.textContent = "אישור והפעל טיפול";
      }
      if(this.els.cancel){
        this.els.cancel.textContent = "ביטול";
        this.els.cancel.disabled = false;
      }
      if(this.els.close) this.els.close.disabled = false;
    },

    setCompletedState(message, tone="is-ok"){
      this.completeProgress();
      this.setStatus(message, tone);
      if(this.els.progress) this.els.progress.classList.add("is-complete");
      if(this.els.confirm){
        this.els.confirm.dataset.mode = "close";
        this.els.confirm.disabled = false;
        this.els.confirm.textContent = "אישור";
      }
      if(this.els.cancel){
        this.els.cancel.textContent = "סגור";
        this.els.cancel.disabled = false;
      }
      if(this.els.close) this.els.close.disabled = false;
    },

    showProgress(flag){
      if(this.els.progress){
        this.els.progress.classList.toggle("is-active", !!flag);
        this.els.progress.classList.remove("is-complete");
        this.els.progress.setAttribute("aria-hidden", flag ? "false" : "true");
      }
      if(!flag) this.updateProgress(0, 0);
    },

    updateProgress(stepIndex, percent){
      if(this.els.progressBar){
        this.els.progressBar.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
      }
      (this.els.progressSteps || []).forEach((el, idx) => {
        el.classList.remove("is-active", "is-done");
        if(idx + 1 < stepIndex) el.classList.add("is-done");
        else if(idx + 1 === stepIndex) el.classList.add("is-active");
      });
      if(!stepIndex){
        (this.els.progressSteps || []).forEach((el) => el.classList.remove("is-active", "is-done"));
      }
    },

    completeProgress(){
      if(this.els.progressBar) this.els.progressBar.style.width = "100%";
      (this.els.progressSteps || []).forEach((el) => {
        el.classList.remove("is-active");
        el.classList.add("is-done");
      });
    },

    async wait(ms){
      await new Promise((resolve) => setTimeout(resolve, ms));
    },

    getCurrentView(){
      return document.querySelector(".view.is-visible")?.id?.replace("view-", "") || "dashboard";
    },

    safeCloseKnownLayers(){
      forceCloseUiLayers({ keepIds:["systemRepairModal"] });
    },

    releaseUiLocks(){
      releaseGlobalUiLocks();
    },

    repairLocalState(){
      try { State.data = normalizeState(State.data || {}); } catch(_e) {}
      try { Storage.saveBackup(State.data); } catch(_e) {}
      try { prepareInteractiveWizardOpen(); } catch(_e) {}
      try {
        if(MirrorsUI){
          MirrorsUI.stopTimerLoop?.();
          MirrorsUI.renderCallBar?.();
        }
      } catch(_e) {}
    },

    rerenderCurrentView(viewName){
      try { UI.renderAuthPill?.(); } catch(_e) {}
      try { UI.applyRoleUI?.(); } catch(_e) {}
      try { UI.goView?.(viewName || this.getCurrentView()); } catch(_e) {}
    },

    async tryReloadSession(){
      if(!Auth.current) return { ok:true, skipped:true };
      try {
        const r = await App.reloadSessionState();
        return r || { ok:false, error:"UNKNOWN_RELOAD_ERROR" };
      } catch(e) {
        return { ok:false, error:String(e?.message || e) };
      }
    },

    async run(){
      if(this.busy) return;
      const currentView = this.getCurrentView();
      this.setBusy(true);
      this.showProgress(true);
      try {
        this.updateProgress(1, 12);
        this.setStatus("שלב 1/3 · משחרר חלונות, שכבות חסימה ומצבי טעינה תקועים...", "is-working");
        await this.wait(220);
        this.safeCloseKnownLayers();
        this.releaseUiLocks();
        this.updateProgress(1, 34);
        await this.wait(320);

        this.updateProgress(2, 46);
        this.setStatus("שלב 2/3 · מאפס טיימרים, דגלי תקיעה ומצב מקומי של המסך הפעיל...", "is-working");
        await this.wait(180);
        this.repairLocalState();
        this.rerenderCurrentView(currentView);
        this.updateProgress(2, 69);
        await this.wait(340);

        this.updateProgress(3, 78);
        this.setStatus("שלב 3/3 · מבצע בדיקה אחרונה, רענון מסך פעיל וסנכרון נתונים...", "is-working");
        await this.wait(180);
        const syncResult = await this.tryReloadSession();
        this.rerenderCurrentView(currentView);
        this.updateProgress(3, 100);
        await this.wait(260);

        if(syncResult.ok || syncResult.skipped){
          this.setCompletedState("בוצע בהצלחה. כל 3 פעולות התיקון הושלמו והמערכת שוחררה, נבדקה ורועננה.", "is-ok");
        } else {
          this.setCompletedState("הטיפול המקומי הושלם וכל 3 פעולות התיקון בוצעו, אך סנכרון הנתונים לא הצליח כעת. אפשר לסגור ולהמשיך לעבוד.", "is-ok");
          console.error("SYSTEM_REPAIR_SYNC_FAILED:", syncResult?.error || syncResult);
        }
      } catch(e) {
        console.error("SYSTEM_REPAIR_FAILED:", e);
        this.releaseUiLocks();
        this.repairLocalState();
        this.rerenderCurrentView(currentView);
        this.setCompletedState("בוצע טיפול חירום מקומי. שלבי הבדיקה הסתיימו, ואם התקלה חוזרת מומלץ לבצע רענון מלא למערכת.", "is-err");
      } finally {
        this.setBusy(false);
      }
    }
  };


  const LeadShellUI = {
    LEAD_URL: "https://oriasomech-jpg.github.io/TalkMe/",
    els: {},
    loaded: false,
    init(){
      this.els.btnOpen = document.getElementById("btnOpenLeadShell");
      this.els.modal = document.getElementById("lcLeadShell");
      this.els.btnClose = document.getElementById("btnCloseLeadShell");
      this.els.frame = document.getElementById("lcLeadShellFrame");
      this.els.placeholder = document.getElementById("lcLeadShellPlaceholder");
      if(!this.els.btnOpen || !this.els.modal || !this.els.frame) return;
      on(this.els.btnOpen, "click", (ev) => { ev.preventDefault(); ev.stopPropagation(); this.open(); });
      on(this.els.btnClose, "click", (ev) => { ev.preventDefault(); this.close(); });
      on(this.els.modal, "click", (ev) => {
        const closeHit = ev.target && (ev.target.dataset?.close === "1" || ev.target.classList?.contains("lcLeadShell__backdrop"));
        if(closeHit) this.close();
      });
      on(this.els.frame, "load", () => {
        this.loaded = true;
        if(this.els.placeholder) this.els.placeholder.style.display = "none";
      });
      document.addEventListener("keydown", (ev) => {
        if(ev.key === "Escape" && this.isOpen()) this.close();
      });
    },
    isOpen(){
      return !!this.els.modal && this.els.modal.classList.contains("is-open");
    },
    ensureFrameLoaded(){
      if(!this.els.frame) return;
      if(this.els.frame.getAttribute("src") !== this.LEAD_URL){
        this.loaded = false;
        if(this.els.placeholder) this.els.placeholder.style.display = "flex";
        this.els.frame.setAttribute("src", this.LEAD_URL);
      }
    },
    open(){
      try{ if(window.Wizard && typeof Wizard.close === "function") Wizard.close(); }catch(_e){}
      try{ document.querySelectorAll('.modal.is-open, .drawer.is-open').forEach((el) => { if(el !== this.els.modal) el.classList.remove('is-open'); }); }catch(_e){}
      if(!this.els.modal) return;
      this.ensureFrameLoaded();
      this.els.modal.classList.add("is-open");
      this.els.modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open", "lcLeadShellOpen");
    },
    close(){
      if(!this.els.modal) return;
      this.els.modal.classList.remove("is-open");
      this.els.modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("lcLeadShellOpen");
      const hasOtherOpenModal = !!document.querySelector('.modal.is-open, .drawer.is-open');
      if(!hasOtherOpenModal) document.body.classList.remove("modal-open");
    }
  };


  const ChatUI = {
    els: {},
    client: null,
    ready: false,
    enabled: false,
    initStarted: false,
    userKey: "",
    currentUser: null,
    selectedUser: null,
    currentConversationId: "",
    usersMap: new Map(),
    currentMessages: [],
    lastMessageByConversation: new Map(),
    unreadByConversation: new Map(),
    userSearchTerm: "",
    dragState: null,
    presenceChannel: null,
    messagesChannel: null,
    typingTimer: null,
    notifyAudioCtx: null,
    cleanupTimer: null,
    retentionMs: Math.max(60000, Number(SUPABASE_CHAT.retentionMinutes || 5) * 60000),
    typingWindowMs: Math.max(1200, Number(SUPABASE_CHAT.typingWindowMs || 2200)),
    fabDrag: null,
    fabWasDragged: false,

    init(){
      this.els = {
        fab: $("#giChatFab"),
        fabBadge: $("#giChatFabBadge"),
        window: $("#giChatWindow"),
        close: $("#giChatClose"),
        minimize: $("#giChatMinimize"),
        dragHandle: $("#giChatDragHandle"),
        meAvatar: $("#giChatMeAvatar"),
        meName: $("#giChatMeName"),
        meRole: $("#giChatMeRole"),
        connectionStatus: $("#giChatConnectionStatus"),
        userSearch: $("#giChatUserSearch"),
        usersList: $("#giChatUsersList"),
        setupHint: $("#giChatSetupHint"),
        empty: $("#giChatEmptyState"),
        conversation: $("#giChatConversation"),
        peerAvatar: $("#giChatPeerAvatar"),
        peerName: $("#giChatPeerName"),
        peerStatus: $("#giChatPeerStatus"),
        messages: $("#giChatMessages"),
        typing: $("#giChatTypingIndicator"),
        typingText: $("#giChatTypingText"),
        inputWrap: $("#giChatComposerWrap"),
        emojiToggle: $("#giChatEmojiToggle"),
        emojiPanel: $("#giChatEmojiPanel"),
        input: $("#giChatInput"),
        send: $("#giChatSend"),
        toasts: $("#giChatToasts")
      };
      if(!this.els.fab || !this.els.window) return;

      on(this.els.fab, "click", (ev) => {
        if(this.fabWasDragged){
          this.fabWasDragged = false;
          ev.preventDefault();
          ev.stopPropagation();
          return;
        }
        this.toggleWindow();
      });
      on(this.els.fab, "keydown", (ev) => {
        if(ev.key === "Enter" || ev.key === " "){
          ev.preventDefault();
          this.toggleWindow();
        }
      });
      on(this.els.close, "click", () => this.closeWindow());
      on(this.els.minimize, "click", () => this.closeWindow());
      on(this.els.userSearch, "input", () => {
        this.userSearchTerm = safeTrim(this.els.userSearch?.value).toLowerCase();
        this.renderUsers();
      });
      on(this.els.send, "click", () => this.sendMessage());
      on(this.els.emojiToggle, "click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.toggleEmojiPanel();
      });
      $$('[data-chat-emoji]', this.els.emojiPanel).forEach((btn) => on(btn, 'click', () => this.insertEmoji(btn.dataset.chatEmoji || '')));
      on(document, 'click', (ev) => {
        if(!this.els.emojiPanel || !this.els.emojiToggle || !this.els.inputWrap) return;
        const target = ev.target;
        if(this.els.inputWrap.contains(target)) return;
        this.closeEmojiPanel();
      });
      on(this.els.input, "keydown", (ev) => {
        if(ev.key === "Escape"){
          this.closeEmojiPanel();
          return;
        }
        if(ev.key === "Enter" && !ev.shiftKey){
          ev.preventDefault();
          this.sendMessage();
          return;
        }
        this.handleTypingPulse();
      });
      on(this.els.input, "input", () => {
        this.autoGrowInput();
        this.handleTypingPulse();
        this.refreshSendButtonState();
      });
      on(window, 'beforeunload', () => this.teardownRealtime(true));
      on(window, 'resize', () => this.clampFabToViewport());
      this.initDrag();
      this.initFabDrag();
      this.syncVisibility('global');
    },

    async ensureStarted(){
      if(this.initStarted) return;
      this.initStarted = true;
      this.refreshCurrentUser();
      this.renderMe();
      this.refreshSendButtonState();
      this.enabled = !!(SUPABASE_CHAT.enabled && this.currentUser && Storage?.getClient);
      if(!this.enabled){
        this.setConnectionStatus("צ׳אט Supabase כבוי כרגע", "warn");
        this.els.setupHint?.classList.remove("is-hidden");
        this.renderUsers();
        return;
      }
      try {
        this.client = Storage.getClient();
        await this.connectPresence();
        this.listenMessages();
        this.startCleanupLoop();
        this.ready = true;
        this.els.setupHint?.classList.add("is-hidden");
        this.setConnectionStatus("צ׳אט לייב מחובר", "ok");
        this.renderUsers();
      } catch(err){
        console.error("CHAT_SUPABASE_INIT_FAILED", err);
        this.enabled = false;
        this.ready = false;
        this.setConnectionStatus("שגיאה בחיבור צ׳אט Supabase", "err");
        this.els.setupHint?.classList.remove("is-hidden");
      }
    },

    refreshCurrentUser(){
      if(!Auth.current) return;
      const roleMap = { admin:"מנהל מערכת", manager:"מנהל", ops:"נציג תפעול", agent:"נציג" };
      const sourceAgent = (Array.isArray(State.data?.agents) ? State.data.agents : []).find((a) => safeTrim(a?.name) === safeTrim(Auth.current?.name) || safeTrim(a?.username) === safeTrim(Auth.current?.name));
      this.currentUser = {
        id: this.userIdFromAgent(sourceAgent || { id: Auth.current?.name, username: Auth.current?.name, name: Auth.current?.name }),
        name: safeTrim(Auth.current?.name) || "משתמש",
        role: roleMap[Auth.current?.role] || "נציג",
        rawRole: Auth.current?.role || "agent"
      };
      this.userKey = this.currentUser.id;
    },

    userIdFromAgent(agent){
      if(!agent) return "";
      return this.normalizeKey((safeTrim(agent.id) || safeTrim(agent.name) || 'agent') + '__' + (safeTrim(agent.username) || safeTrim(agent.name) || ''));
    },

    renderMe(){
      this.refreshCurrentUser();
      if(!this.currentUser) return;
      if(this.els.meAvatar) this.els.meAvatar.textContent = this.initials(this.currentUser.name);
      if(this.els.meName) this.els.meName.textContent = this.currentUser.name;
      if(this.els.meRole) this.els.meRole.textContent = this.currentUser.role;
    },

    normalizeKey(v){
      return String(v || "")
        .normalize("NFKD")
        .replace(/[^\w֐-׿-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase() || "user";
    },

    initials(name){
      const parts = safeTrim(name).split(/\s+/).filter(Boolean);
      return (parts.slice(0,2).map((p) => p.charAt(0)).join("") || "GI").slice(0,2).toUpperCase();
    },

    syncVisibility(view){
      const canShowChat = !!Auth.current && !document.body.classList.contains('lcAuthLock');
      if(!canShowChat){
        this.hideFab();
        this.closeWindow(false, true);
        return;
      }
      if(this.els.window?.classList.contains("is-hidden")) this.showFab();
    },

    showFab(){
      const fab = this.els.fab;
      if(!fab) return;
      const hadInlinePosition = this.hasInlineFabPosition();
      const hasSavedPosition = this.hasSavedFabPosition();
      fab.classList.remove('is-hidden');
      if(hasSavedPosition){
        this.restoreFabPosition();
        return;
      }
      if(hadInlinePosition){
        this.clampFabToViewport();
        return;
      }
      requestAnimationFrame(() => {
        this.captureFabPosition(true);
      });
    },

    hideFab(){
      this.els.fab?.classList.add('is-hidden');
    },

    chatFabStorageKey(){
      return `${CHAT_FAB_STORAGE_KEY}__${this.userKey || 'guest'}`;
    },
    hasInlineFabPosition(){
      const fab = this.els.fab;
      if(!fab) return false;
      return !!(fab.style.left && fab.style.left !== 'auto' && fab.style.top && fab.style.top !== 'auto');
    },

    hasSavedFabPosition(){
      try {
        const payload = JSON.parse(localStorage.getItem(this.chatFabStorageKey()) || 'null');
        return !!(payload && Number.isFinite(Number(payload.left)) && Number.isFinite(Number(payload.top)));
      } catch(_e) {
        return false;
      }
    },

    captureFabPosition(shouldPersist=false){
      const fab = this.els.fab;
      if(!fab || fab.classList.contains('is-hidden')) return;
      const rect = fab.getBoundingClientRect();
      if(!(rect.width > 0 && rect.height > 0)) return;
      fab.style.left = Math.round(rect.left) + 'px';
      fab.style.top = Math.round(rect.top) + 'px';
      fab.style.bottom = 'auto';
      fab.style.right = 'auto';
      this.clampFabToViewport();
      if(shouldPersist) this.saveFabPosition();
    },

    applyDefaultFabPosition(){
      const fab = this.els.fab;
      if(!fab) return;
      const computed = window.getComputedStyle(fab);
      const width = fab.offsetWidth || parseFloat(computed.width) || 64;
      const height = fab.offsetHeight || parseFloat(computed.height) || 64;
      const left = Number.parseFloat(computed.left);
      const bottom = Number.parseFloat(computed.bottom);
      const fallbackLeft = Number.isFinite(left) ? left : 22;
      const fallbackBottom = Number.isFinite(bottom) ? bottom : 22;
      const fallbackTop = Math.max(12, window.innerHeight - height - fallbackBottom);
      fab.style.left = Math.round(fallbackLeft) + 'px';
      fab.style.top = Math.round(fallbackTop) + 'px';
      fab.style.bottom = 'auto';
      fab.style.right = 'auto';
    },

    restoreFabPosition(){
      const fab = this.els.fab;
      if(!fab) return;
      let payload = null;
      try {
        payload = JSON.parse(localStorage.getItem(this.chatFabStorageKey()) || 'null');
      } catch(_e) {}
      fab.style.right = 'auto';
      if(payload && Number.isFinite(Number(payload.left)) && Number.isFinite(Number(payload.top))){
        fab.style.left = Number(payload.left) + 'px';
        fab.style.top = Number(payload.top) + 'px';
        fab.style.bottom = 'auto';
      } else if(!this.hasInlineFabPosition()) {
        this.applyDefaultFabPosition();
      }
      this.clampFabToViewport();
    },

    saveFabPosition(){
      const fab = this.els.fab;
      if(!fab || !this.userKey) return;
      const rect = fab.getBoundingClientRect();
      try {
        localStorage.setItem(this.chatFabStorageKey(), JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
      } catch(_e) {}
    },

    clampFabToViewport(){
      const fab = this.els.fab;
      if(!fab) return;
      const rect = fab.getBoundingClientRect();
      const maxX = Math.max(12, window.innerWidth - rect.width - 12);
      const maxY = Math.max(12, window.innerHeight - rect.height - 12);
      const hasCustomTop = fab.style.top && fab.style.top !== 'auto';
      const hasCustomLeft = fab.style.left && fab.style.left !== 'auto';
      if(!hasCustomTop && !hasCustomLeft) return;
      const nextLeft = Math.min(maxX, Math.max(12, rect.left));
      const nextTop = Math.min(maxY, Math.max(12, rect.top));
      fab.style.left = nextLeft + 'px';
      fab.style.top = nextTop + 'px';
      fab.style.bottom = 'auto';
      fab.style.right = 'auto';
      this.saveFabPosition();
    },

    initFabDrag(){
      const fab = this.els.fab;
      if(!fab) return;
      const stopDrag = () => {
        if(!this.fabDrag) return;
        const moved = !!this.fabDrag.moved;
        this.fabDrag = null;
        fab.classList.remove('is-dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', stopDrag);
        if(moved){
          this.fabWasDragged = true;
          this.saveFabPosition();
          setTimeout(() => { this.fabWasDragged = false; }, 80);
        }
      };
      const onMove = (ev) => {
        if(!this.fabDrag) return;
        ev.preventDefault();
        const nextLeft = ev.clientX - this.fabDrag.offsetX;
        const nextTop = ev.clientY - this.fabDrag.offsetY;
        const maxX = Math.max(12, window.innerWidth - fab.offsetWidth - 12);
        const maxY = Math.max(12, window.innerHeight - fab.offsetHeight - 12);
        const clampedLeft = Math.min(maxX, Math.max(12, nextLeft));
        const clampedTop = Math.min(maxY, Math.max(12, nextTop));
        if(Math.abs(clampedLeft - this.fabDrag.startLeft) > CHAT_FAB_DRAG_THRESHOLD || Math.abs(clampedTop - this.fabDrag.startTop) > CHAT_FAB_DRAG_THRESHOLD){
          this.fabDrag.moved = true;
        }
        fab.style.left = clampedLeft + 'px';
        fab.style.top = clampedTop + 'px';
        fab.style.bottom = 'auto';
        fab.style.right = 'auto';
      };
      on(fab, 'mousedown', (ev) => {
        if(ev.button !== 0) return;
        if(!Auth.current) return;
        const rect = fab.getBoundingClientRect();
        this.fabDrag = {
          offsetX: ev.clientX - rect.left,
          offsetY: ev.clientY - rect.top,
          startLeft: rect.left,
          startTop: rect.top,
          moved: false
        };
        fab.classList.add('is-dragging');
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', stopDrag);
      });
    },

    toggleWindow(){
      const hidden = this.els.window?.classList.contains("is-hidden");
      if(hidden) this.openWindow();
      else this.closeWindow();
    },

    openWindow(){
      this.captureFabPosition(true);
      this.els.window?.classList.remove("is-hidden");
      this.hideFab();
      this.ensureStarted();
      this.resetUnreadForSelected();
      this.els.input?.focus?.();
    },

    closeWindow(forceKeepFab=false, skipSync=false){
      this.els.window?.classList.add("is-hidden");
      const shouldShowFab = !!Auth.current && !document.body.classList.contains('lcAuthLock');
      if(shouldShowFab && !skipSync) this.showFab();
      else if(!shouldShowFab) this.hideFab();
      this.closeEmojiPanel();
      this.setTyping(false);
    },

    initDrag(){
      const win = this.els.window;
      const handle = this.els.dragHandle;
      if(!win || !handle) return;
      const onMove = (ev) => {
        if(!this.dragState) return;
        ev.preventDefault();
        const x = ev.clientX - this.dragState.offsetX;
        const y = ev.clientY - this.dragState.offsetY;
        const maxX = Math.max(8, window.innerWidth - win.offsetWidth - 8);
        const maxY = Math.max(8, window.innerHeight - win.offsetHeight - 8);
        win.style.left = Math.min(maxX, Math.max(8, x)) + 'px';
        win.style.top = Math.min(maxY, Math.max(8, y)) + 'px';
        win.style.bottom = 'auto';
      };
      const stop = () => {
        if(!this.dragState) return;
        this.dragState = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', stop);
      };
      on(handle, 'mousedown', (ev) => {
        const rect = win.getBoundingClientRect();
        this.dragState = { offsetX: ev.clientX - rect.left, offsetY: ev.clientY - rect.top };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', stop);
      });
    },

    autoGrowInput(){
      if(!this.els.input) return;
      this.els.input.style.height = 'auto';
      this.els.input.style.height = Math.min(132, Math.max(46, this.els.input.scrollHeight)) + 'px';
    },

    toggleEmojiPanel(){
      if(!this.els.emojiPanel || !this.els.emojiToggle) return;
      const willOpen = this.els.emojiPanel.classList.contains('is-hidden');
      if(willOpen) this.openEmojiPanel();
      else this.closeEmojiPanel();
    },

    openEmojiPanel(){
      if(!this.els.emojiPanel || !this.els.emojiToggle) return;
      this.els.emojiPanel.classList.remove('is-hidden');
      this.els.emojiPanel.setAttribute('aria-hidden', 'false');
      this.els.emojiToggle.setAttribute('aria-expanded', 'true');
    },

    closeEmojiPanel(){
      if(!this.els.emojiPanel || !this.els.emojiToggle) return;
      this.els.emojiPanel.classList.add('is-hidden');
      this.els.emojiPanel.setAttribute('aria-hidden', 'true');
      this.els.emojiToggle.setAttribute('aria-expanded', 'false');
    },

    insertEmoji(emoji){
      if(!this.els.input || !emoji) return;
      const input = this.els.input;
      const start = Number(input.selectionStart || 0);
      const end = Number(input.selectionEnd || start);
      const value = String(input.value || '');
      input.value = value.slice(0, start) + emoji + value.slice(end);
      const nextPos = start + emoji.length;
      try { input.setSelectionRange(nextPos, nextPos); } catch(_e) {}
      this.autoGrowInput();
      this.refreshSendButtonState();
      this.handleTypingPulse();
      input.focus();
    },

    async connectPresence(){
      if(!this.client || !this.userKey) throw new Error('CHAT_NO_CLIENT');
      this.presenceChannel = this.client.channel(SUPABASE_CHAT.presenceTopic || 'invest-chat-presence-room', {
        config: { presence: { key: this.userKey } }
      });
      this.presenceChannel
        .on('presence', { event: 'sync' }, () => {
          this.renderUsers();
          this.renderPeerMeta();
          this.renderTypingIndicator();
        })
        .on('presence', { event: 'join' }, () => {
          this.renderUsers();
          this.renderPeerMeta();
          this.renderTypingIndicator();
        })
        .on('presence', { event: 'leave' }, () => {
          this.renderUsers();
          this.renderPeerMeta();
          this.renderTypingIndicator();
        });
      await new Promise((resolve, reject) => {
        this.presenceChannel.subscribe(async (status) => {
          if(status === 'SUBSCRIBED'){
            try {
              await this.presenceChannel.track(this.buildPresencePayload());
              resolve();
            } catch(err){ reject(err); }
          } else if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED'){
            reject(new Error('PRESENCE_' + status));
          }
        });
      });
    },

    buildPresencePayload(extra={}){
      return {
        userId: this.userKey,
        name: this.currentUser?.name || 'נציג',
        role: this.currentUser?.role || 'נציג',
        rawRole: this.currentUser?.rawRole || 'agent',
        onlineAt: nowISO(),
        updatedAt: Date.now(),
        typingTo: '',
        typingUntil: 0,
        ...extra
      };
    },

    getPresenceState(){
      if(!this.presenceChannel) return {};
      try { return this.presenceChannel.presenceState() || {}; } catch(_e){ return {}; }
    },

    getPresenceMap(){
      const raw = this.getPresenceState();
      const map = new Map();
      Object.entries(raw).forEach(([key, arr]) => {
        const latest = Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
        if(latest) map.set(key, latest);
      });
      return map;
    },

    availableUsers(){
      const agents = Array.isArray(State.data?.agents) ? State.data.agents.filter((a) => a?.active !== false) : [];
      const presence = this.getPresenceMap();
      return agents
        .map((agent) => {
          const id = this.userIdFromAgent(agent);
          const pres = presence.get(id) || null;
          return {
            id,
            name: safeTrim(agent?.name) || 'נציג',
            role: this.roleLabel(safeTrim(agent?.role) || 'agent'),
            rawRole: safeTrim(agent?.role) || 'agent',
            online: !!pres,
            updatedAt: Number(pres?.updatedAt || 0) || 0,
            typingTo: safeTrim(pres?.typingTo),
            typingUntil: Number(pres?.typingUntil || 0) || 0
          };
        })
        .filter((user) => user.id && user.id !== this.userKey)
        .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'he'));
    },

    roleLabel(raw){
      return ({ admin:'מנהל מערכת', manager:'מנהל', ops:'נציג תפעול', agent:'נציג' })[raw] || 'נציג';
    },

    renderUsers(){
      const wrap = this.els.usersList;
      if(!wrap) return;
      const term = this.userSearchTerm;
      const users = this.availableUsers().filter((user) => !term || user.name.toLowerCase().includes(term) || user.role.toLowerCase().includes(term));
      this.usersMap = new Map(users.map((user) => [user.id, user]));
      if(!users.length){
        wrap.innerHTML = '<div class="giChatSidebar__setupHint" style="display:block;margin:0 6px 8px;">אין כרגע נציגים זמינים להצגה.</div>';
        return;
      }
      wrap.innerHTML = users.map((user) => {
        const active = this.selectedUser?.id === user.id;
        const preview = this.lastMessageByConversation.get(this.conversationId(user.id));
        const unread = this.unreadByConversation.get(this.conversationId(user.id)) || 0;
        const status = user.online ? (this.isUserTyping(user.id) ? 'מקליד עכשיו…' : 'מחובר עכשיו') : 'לא מחובר';
        return `
          <button class="giChatUser ${active ? "is-active" : ""}" type="button" data-chat-user="${this.escapeAttr(user.id)}">
            <div class="giChatUser__avatarWrap">
              <div class="giChatUser__avatar">${this.escapeHtml(this.initials(user.name))}</div>
              ${user.online ? '<span class="giChatUser__onlineDot"></span>' : ''}
            </div>
            <div class="giChatUser__meta">
              <div class="giChatUser__name">${this.escapeHtml(user.name)}</div>
              <div class="giChatUser__status">${this.escapeHtml(preview?.text || status)}</div>
            </div>
            ${unread ? `<span class="giChatUser__unread">${Math.min(unread,99)}</span>` : ''}
          </button>`;
      }).join('');
      $$('[data-chat-user]', wrap).forEach((btn) => on(btn, 'click', () => this.selectUser(btn.dataset.chatUser || '')));
    },

    async selectUser(userId){
      const user = this.usersMap.get(userId) || this.availableUsers().find((item) => item.id === userId);
      if(!user) return;
      this.selectedUser = user;
      this.currentConversationId = this.conversationId(user.id);
      this.currentMessages = [];
      this.renderConversationShell();
      this.closeEmojiPanel();
      this.resetUnreadForSelected();
      await this.loadConversationHistory();
      this.renderPeerMeta();
      this.renderTypingIndicator();
      this.els.input?.focus?.();
    },

    renderConversationShell(){
      this.els.empty?.classList.add('is-hidden');
      this.els.conversation?.classList.remove('is-hidden');
      if(this.els.peerAvatar) this.els.peerAvatar.textContent = this.initials(this.selectedUser?.name || '--');
      if(this.els.peerName) this.els.peerName.textContent = this.selectedUser?.name || '--';
      this.renderMessages();
    },

    renderPeerMeta(){
      if(!this.selectedUser) return;
      const latest = this.availableUsers().find((u) => u.id === this.selectedUser.id) || this.selectedUser;
      this.selectedUser = latest;
      if(this.els.peerAvatar) this.els.peerAvatar.textContent = this.initials(latest.name || '--');
      if(this.els.peerName) this.els.peerName.textContent = latest.name || '--';
      if(this.els.peerStatus){
        this.els.peerStatus.textContent = this.isUserTyping(latest.id)
          ? 'מקליד עכשיו…'
          : (latest.online ? 'מחובר עכשיו' : 'לא מחובר כרגע');
      }
      this.renderUsers();
    },

    async loadConversationHistory(){
      if(!this.client || !this.currentConversationId) return;
      try {
        const { data, error } = await this.client
          .from(SUPABASE_CHAT.messagesTable)
          .select('id,conversation_id,sender_id,sender_name,recipient_id,recipient_name,body,created_at,expires_at')
          .eq('conversation_id', this.currentConversationId)
          .gt('expires_at', nowISO())
          .order('created_at', { ascending: true })
          .limit(120);
        if(error) throw error;
        this.currentMessages = (Array.isArray(data) ? data : []).map((row) => this.normalizeMessage(row));
        const last = this.currentMessages[this.currentMessages.length - 1];
        if(last) this.lastMessageByConversation.set(this.currentConversationId, { text: last.text, at: last.createdAt, fromId: last.fromId });
        this.renderMessages();
      } catch(err){
        console.error('CHAT_LOAD_HISTORY_FAILED', err);
        this.setConnectionStatus('יש להריץ SQL של צ׳אט ב-Supabase', 'err');
        this.els.setupHint?.classList.remove('is-hidden');
      }
    },

    listenMessages(){
      if(!this.client || !this.userKey) return;
      this.messagesChannel = this.client
        .channel('invest-chat-db-' + this.userKey)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: SUPABASE_CHAT.messagesTable
        }, (payload) => this.handleIncomingDbInsert(payload?.new))
        .subscribe((status) => {
          if(status === 'SUBSCRIBED') this.setConnectionStatus('צ׳אט לייב מחובר', 'ok');
          else if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') this.setConnectionStatus('Realtime של הצ׳אט לא זמין', 'err');
        });
    },

    handleIncomingDbInsert(row){
      const msg = this.normalizeMessage(row);
      if(!msg || msg.expiresAt <= Date.now()) return;
      if(msg.fromId !== this.userKey && msg.toId !== this.userKey) return;
      const convoId = msg.conversationId;
      this.lastMessageByConversation.set(convoId, { text: msg.text, at: msg.createdAt, fromId: msg.fromId });
      if(this.currentConversationId === convoId){
        if(!this.currentMessages.some((item) => String(item.id) === String(msg.id))){
          this.currentMessages.push(msg);
          this.currentMessages.sort((a, b) => a.createdAt - b.createdAt);
          this.renderMessages();
        }
        if(msg.fromId !== this.userKey && !this.els.window?.classList.contains('is-hidden')) this.resetUnreadForSelected();
      }
      if(msg.fromId !== this.userKey) this.notifyIncoming(msg);
      this.renderUsers();
    },

    normalizeMessage(row){
      if(!row) return null;
      return {
        id: row.id,
        conversationId: safeTrim(row.conversation_id),
        fromId: safeTrim(row.sender_id),
        fromName: safeTrim(row.sender_name),
        toId: safeTrim(row.recipient_id),
        toName: safeTrim(row.recipient_name),
        text: safeTrim(row.body),
        createdAt: Date.parse(row.created_at || nowISO()) || Date.now(),
        expiresAt: Date.parse(row.expires_at || nowISO()) || (Date.now() + this.retentionMs)
      };
    },

    renderMessages(){
      const host = this.els.messages;
      if(!host) return;
      const fresh = this.currentMessages.filter((msg) => Number(msg.expiresAt || 0) > Date.now());
      this.currentMessages = fresh;
      host.innerHTML = fresh.length ? fresh.map((msg) => {
        const mine = msg.fromId === this.userKey;
        return `
          <div class="giChatMsg ${mine ? 'giChatMsg--mine' : 'giChatMsg--peer'}">
            <div class="giChatMsg__bubble">${this.escapeHtml(msg.text || '')}</div>
            <div class="giChatMsg__meta">
              <span>${this.escapeHtml(mine ? 'אתה' : (msg.fromName || 'נציג'))}</span>
              <span>${this.formatClock(msg.createdAt)}</span>
            </div>
          </div>`;
      }).join('') : '<div class="giChatPanel__emptyText" style="padding:18px 10px;">אין עדיין הודעות בשיחה הזו.</div>';
      host.scrollTop = host.scrollHeight + 120;
      this.renderTypingIndicator();
    },

    isUserTyping(userId){
      const user = this.availableUsers().find((item) => item.id === userId);
      return !!(user && user.typingTo === this.currentConversationId && Number(user.typingUntil || 0) > Date.now());
    },

    renderTypingIndicator(){
      if(!this.els.typing || !this.els.typingText) return;
      if(this.selectedUser && this.isUserTyping(this.selectedUser.id)){
        this.els.typing.classList.remove('is-hidden');
        this.els.typingText.textContent = `${this.selectedUser.name} מקליד עכשיו…`;
      } else {
        this.els.typing.classList.add('is-hidden');
      }
      this.renderPeerMetaSilent();
    },

    renderPeerMetaSilent(){
      if(!this.selectedUser || !this.els.peerStatus) return;
      const user = this.availableUsers().find((item) => item.id === this.selectedUser.id) || this.selectedUser;
      this.els.peerStatus.textContent = this.isUserTyping(user.id) ? 'מקליד עכשיו…' : (user.online ? 'מחובר עכשיו' : 'לא מחובר כרגע');
    },

    refreshSendButtonState(){
      const btn = this.els?.send;
      const input = this.els?.input;
      if(!btn || !input) return;
      const hasText = !!safeTrim(input.value);
      btn.classList.toggle('is-active', hasText);
      btn.setAttribute('aria-disabled', btn.disabled ? 'true' : 'false');
    },

    triggerSendButtonFx(){
      const btn = this.els?.send;
      if(!btn) return;
      btn.classList.remove('is-sending');
      void btn.offsetWidth;
      btn.classList.add('is-sending');
      clearTimeout(this.sendFxTimer);
      this.sendFxTimer = setTimeout(() => btn.classList.remove('is-sending'), 360);
    },

    async sendMessage(){
      if(!this.client || !this.selectedUser || !this.currentConversationId){
        alert('בחר נציג כדי להתחיל שיחה.');
        return;
      }
      const text = safeTrim(this.els.input?.value);
      if(!text) return;
      const sendBtn = this.els.send;
      if(sendBtn) {
        sendBtn.disabled = true;
        this.triggerSendButtonFx();
      }
      this.refreshSendButtonState();
      try {
        const expiresAt = new Date(Date.now() + this.retentionMs).toISOString();
        const payload = {
          conversation_id: this.currentConversationId,
          sender_id: this.userKey,
          sender_name: this.currentUser?.name || 'נציג',
          recipient_id: this.selectedUser.id,
          recipient_name: this.selectedUser.name,
          body: text,
          expires_at: expiresAt
        };
        const { data, error } = await this.client
          .from(SUPABASE_CHAT.messagesTable)
          .insert([payload])
          .select('*')
          .single();
        if(error) throw error;
        const insertedMsg = this.normalizeMessage(data) || {
          id: null,
          conversationId: this.currentConversationId,
          fromId: this.userKey,
          fromName: this.currentUser?.name || 'נציג',
          toId: this.selectedUser.id,
          toName: this.selectedUser.name,
          text,
          createdAt: Date.now(),
          expiresAt: Date.parse(expiresAt) || (Date.now() + this.retentionMs)
        };
        this.upsertIncomingMessage(insertedMsg, true);
        if(this.els.input){
          this.els.input.value = '';
        }
        this.closeEmojiPanel();
        this.autoGrowInput();
        this.refreshSendButtonState();
        await this.setTyping(false);
        this.renderUsers();
      } catch(err){
        console.error('CHAT_SEND_FAILED', err);
        const errMsg = safeTrim(err?.message || err?.details || err?.hint || err?.code || '');
        alert(`לא הצלחתי לשלוח את ההודעה כרגע. ${errMsg || 'בדוק שהרצת את קובץ ה-SQL המעודכן של הצ׳אט ב-Supabase.'}`);
      } finally {
        if(sendBtn) sendBtn.disabled = false;
        this.refreshSendButtonState();
        this.els.input?.focus?.();
      }
    },

    upsertIncomingMessage(msg, markReadForCurrentConversation=false){
      if(!msg || !msg.conversationId) return;
      const convoId = msg.conversationId;
      this.lastMessageByConversation.set(convoId, {
        text: msg.text,
        at: msg.createdAt,
        fromId: msg.fromId
      });
      const exists = this.currentMessages.some((item) => {
        if(msg.id != null && item.id != null) return String(item.id) === String(msg.id);
        return item.conversationId === msg.conversationId
          && item.fromId === msg.fromId
          && item.toId === msg.toId
          && item.text === msg.text
          && Math.abs(Number(item.createdAt || 0) - Number(msg.createdAt || 0)) < 1500;
      });
      if(this.currentConversationId === convoId && !exists){
        this.currentMessages.push(msg);
        this.currentMessages.sort((a, b) => a.createdAt - b.createdAt);
        this.renderMessages();
      } else if(this.currentConversationId === convoId){
        this.renderMessages();
      }
      if(markReadForCurrentConversation && this.currentConversationId === convoId){
        this.resetUnreadForSelected();
      }
    },

    handleTypingPulse(){
      if(!this.enabled || !this.currentConversationId || !this.presenceChannel) return;
      this.setTyping(true);
      clearTimeout(this.typingTimer);
      this.typingTimer = setTimeout(() => this.setTyping(false), this.typingWindowMs);
    },

    async setTyping(flag){
      if(!this.presenceChannel || !this.currentUser) return;
      try {
        await this.presenceChannel.track(this.buildPresencePayload(flag ? {
          typingTo: this.currentConversationId,
          typingUntil: Date.now() + this.typingWindowMs
        } : {
          typingTo: '',
          typingUntil: 0
        }));
      } catch(_e) {}
    },

    conversationId(otherUserId){
      return [this.userKey, otherUserId].sort().join('__');
    },

    resetUnreadForSelected(){
      if(!this.currentConversationId) return;
      this.unreadByConversation.set(this.currentConversationId, 0);
      this.renderFabBadge();
      this.renderUsers();
    },

    renderFabBadge(){
      const total = Array.from(this.unreadByConversation.values()).reduce((sum, n) => sum + Number(n || 0), 0);
      if(this.els.fabBadge){
        this.els.fabBadge.textContent = String(Math.min(total, 99));
        this.els.fabBadge.classList.toggle('is-hidden', !total);
      }
    },

    setConnectionStatus(text, level='warn'){
      if(!this.els.connectionStatus) return;
      this.els.connectionStatus.textContent = text;
      this.els.connectionStatus.dataset.level = level;
    },

    notifyIncoming(message){
      const convoId = this.conversationId(message.fromId);
      const isChatWindowOpen = !this.els.window?.classList.contains('is-hidden');
      const isActiveConversationOpen = this.selectedUser?.id === message.fromId && isChatWindowOpen;
      if(!isActiveConversationOpen){
        this.unreadByConversation.set(convoId, (this.unreadByConversation.get(convoId) || 0) + 1);
        this.renderFabBadge();
        this.renderUsers();
      }
      const from = this.usersMap.get(message.fromId)?.name || message.fromName || 'נציג';
      if(!isChatWindowOpen){
        this.pushToast(from, message.text || 'הודעה חדשה');
        this.playNotifySound();
      }
    },

    pushToast(title, text){
      const host = this.els.toasts;
      if(!host) return;
      const toast = document.createElement('div');
      toast.className = 'giChatToast';
      toast.innerHTML = `<div class="giChatToast__title">${this.escapeHtml(title)}</div><div class="giChatToast__text">${this.escapeHtml(text)}</div>`;
      host.appendChild(toast);
      setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-8px)'; }, 3600);
      setTimeout(() => toast.remove(), 4100);
    },

    playNotifySound(){
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if(!Ctx) return;
        this.notifyAudioCtx = this.notifyAudioCtx || new Ctx();
        const ctx = this.notifyAudioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 740;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;
        gain.gain.exponentialRampToValueAtTime(0.02, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.2);
      } catch(_e) {}
    },

    formatClock(ts){
      const value = typeof ts === 'number' ? ts : Date.now();
      return new Date(value).toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' });
    },

    escapeHtml(v){
      return String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
    },

    escapeAttr(v){
      return this.escapeHtml(v).replace(/`/g, '&#96;');
    },

    async cleanupExpiredData(){
      if(!this.client || !SUPABASE_CHAT.enabled) return;
      const now = nowISO();
      try {
        const { error } = await this.client.rpc(SUPABASE_CHAT.cleanupRpc);
        if(error){
          const fallback = await this.client.from(SUPABASE_CHAT.messagesTable).delete().lt('expires_at', now);
          if(fallback.error) throw fallback.error;
        }
      } catch(_e) {}
      const beforeLen = this.currentMessages.length;
      this.currentMessages = this.currentMessages.filter((msg) => Number(msg.expiresAt || 0) > Date.now());
      if(this.currentMessages.length !== beforeLen) this.renderMessages();
      if(!this.currentMessages.length && this.currentConversationId){
        this.lastMessageByConversation.delete(this.currentConversationId);
        this.renderUsers();
      }
    },

    startCleanupLoop(){
      clearInterval(this.cleanupTimer);
      const run = () => this.cleanupExpiredData();
      this.cleanupTimer = setInterval(run, Math.max(15000, Number(SUPABASE_CHAT.cleanupIntervalMs || 60000)));
      run();
    },

    teardownRealtime(isSilent=false){
      clearTimeout(this.typingTimer);
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      this.ready = false;
      if(this.presenceChannel){
        try { this.presenceChannel.untrack(); } catch(_e) {}
        try { this.client?.removeChannel(this.presenceChannel); } catch(_e) {}
      }
      if(this.messagesChannel){
        try { this.client?.removeChannel(this.messagesChannel); } catch(_e) {}
      }
      this.presenceChannel = null;
      this.messagesChannel = null;
      if(!isSilent) this.setConnectionStatus('צ׳אט מנותק', 'warn');
    },

    onLogin(){
      this.refreshCurrentUser();
      this.renderMe();
      this.restoreFabPosition();
      this.syncVisibility('global');
      this.ensureStarted();
    },

    onLogout(){
      this.teardownRealtime(true);
      this.hideFab();
      this.closeWindow(false, true);
      this.selectedUser = null;
      this.currentConversationId = '';
      this.usersMap = new Map();
      this.currentMessages = [];
      this.unreadByConversation = new Map();
      this.lastMessageByConversation = new Map();
      this.initStarted = false;
      this.enabled = false;
      this.currentUser = null;
      this.userKey = '';
      this.renderFabBadge();
      if(this.els.usersList) this.els.usersList.innerHTML = '';
      if(this.els.messages) this.els.messages.innerHTML = '';
    },
  };

  const __chatOriginalGoView = UI.goView.bind(UI);
  UI.goView = function(view){
    const result = __chatOriginalGoView(view);
    try { ChatUI.syncVisibility(view); } catch(_e) {}
    return result;
  };

  const __chatOriginalLogout = Auth.logout.bind(Auth);
  Auth.logout = function(){
    try { ChatUI.onLogout(); } catch(_e) {}
    return __chatOriginalLogout();
  };

  const App = {
    _bootPromise: null,

    async boot(){
      Storage.restoreUrl();
      UI.renderSyncStatus("טוען…", "warn");

      // load from Supabase
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

      // sync Supabase URL field
      if (UI.els.gsUrl) { UI.els.gsUrl.value = Storage.supabaseUrl || ""; UI.els.gsUrl.readOnly = true; }

      // after state is ready: apply role UI
      UI.applyRoleUI();
      if (Auth.current) {
        try { ChatUI.onLogin(); } catch(_e) {}
        // keep current view (admin -> settings)
        UI.goView(Auth.isAdmin() ? "settings" : "dashboard");
      } else {
        UI.goView("dashboard");
      }
    },

    async persist(label){
      // backup always
      try { Storage.saveBackup(State.data); } catch(_) {}

      // save to Supabase
      UI.renderSyncStatus("שומר…", "warn");
      const r = await Storage.saveSheets(State.data);
      if (r.ok) {
        UI.renderSyncStatus(label || "נשמר", "ok", r.at);
      } else {
        UI.renderSyncStatus("שגיאה בשמירה", "err", null, r.error);
        console.error("SAVE_TO_SUPABASE_FAILED:", r?.error || r);
      }
      return r;
    },

    async reloadSessionState(){
      if(!Auth.current) return { ok:false, error:"NO_SESSION" };
      UI.renderSyncStatus("טוען נתוני משתמש…", "warn");
      const r = await Storage.loadSheets();
      if (r.ok) {
        State.data = r.payload;
        Storage.saveBackup(State.data);
        UI.renderSyncStatus("נתוני משתמש נטענו", "ok", r.at);
        if (Auth.isAdmin()) UsersUI.render();
        if (Auth.current) {
          CustomersUI.render();
          ProposalsUI.render();
          if (Auth.isOps()) { ProcessesUI.render(); try { OpsEventsUI.renderToolbarState(); OpsEventsUI.checkReminders(); } catch(_e) {} }
        }
      } else {
        UI.renderSyncStatus("שגיאה בטעינת נתוני משתמש", "err", null, r.error);
        console.error("LOAD_SUPABASE_SESSION_STATE_FAILED:", r?.error || r);
      }
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
        if (Auth.current) {
          CustomersUI.render();
          ProposalsUI.render();
          if (Auth.isOps()) ProcessesUI.render();
        }
      } else {
        UI.renderSyncStatus("שגיאה בסנכרון", "err", null, r.error);
      }
    }
  };

  // ---------- Start ----------
  UI.init();
  Auth.init();
  ForgotPasswordUI.init();
  CustomersUI.init();
  ArchiveCustomerUI.init();
  MirrorsUI.init();
  ProcessesUI.init();
  OpsEventsUI.init();
  Wizard.init();
  SystemRepairUI.init();
  LeadShellUI.init();
  ChatUI.init();
  LiveRefresh.start();
  App._bootPromise = App.boot();

})();


// ===== CHAT TOAST FIX =====
(function(){
  const isChatOpen = () => {
    const el = document.querySelector('#chatWindow, .chatWindow, #chatModal');
    return el && (el.classList.contains('is-open') || el.classList.contains('active') || el.style.display === 'block');
  };

  const origToast = window.showToast;
  if(typeof origToast === "function"){
    window.showToast = function(...args){
      if(isChatOpen()) return;
      return origToast.apply(this, args);
    };
  }
})();
