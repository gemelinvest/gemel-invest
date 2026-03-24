/* GEMEL INVEST CRM — CLEAN CORE (Supabase + Admin Settings/Users)
   P260318-1238
   - Keeps: Login, user pill, Admin: System Settings + Users
   - Data layer migrated from Google Sheets to Supabase
*/
(() => {
  "use strict";

  const BUILD = "20260325-operational-report-a4-dedicated-engine-v8";
  const ADMIN_CONTACT_EMAIL = "oriasomech@gmail.com";
  const AUTO_LOGOUT_IDLE_MS = 40 * 60 * 1000;
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
    retentionMode: "midnight",
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
  const nextMidnightISO = () => {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.toISOString();
  };

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

    logout(reason = "manual"){
      this.current = null;
      try { localStorage.removeItem(LS_SESSION_KEY); } catch(_) {}
      try { InactivityGuard.stop(); } catch(_e) {}
      this.lock();
      if(reason === "idle"){
        this._setError("בוצעה התנתקות אוטומטית לאחר 40 דקות של אי פעילות במערכת");
      } else {
        this._setError("");
      }
      try {
        if(this.els?.pin) this.els.pin.value = "";
      } catch(_e) {}
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
        try { InactivityGuard.start(); } catch(_e) {}
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
      try { InactivityGuard.start(); } catch(_e) {}
      UI.applyRoleUI();
      UI.renderAuthPill();
      await WelcomeLoader.play(this.current.name, 4800);
      UI.goView("dashboard");
      try { ChatUI.onLogin(); } catch(_e) {}
    }
  };

  const InactivityGuard = {
    idleMs: AUTO_LOGOUT_IDLE_MS,
    warnText: "בוצעה התנתקות אוטומטית לאחר 40 דקות של אי פעילות במערכת",
    timerId: null,
    started: false,
    boundActivityHandler: null,
    boundVisibilityHandler: null,
    events: ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "pointerdown", "wheel"],

    init(){
      this.boundActivityHandler = this.boundActivityHandler || (() => this.bump());
      this.boundVisibilityHandler = this.boundVisibilityHandler || (() => {
        if(document.visibilityState === 'visible') this.bump();
      });
    },

    start(){
      this.init();
      this.stop();
      if(!Auth.current) return;
      this.events.forEach((evt) => window.addEventListener(evt, this.boundActivityHandler, true));
      document.addEventListener('visibilitychange', this.boundVisibilityHandler, true);
      this.started = true;
      this.bump();
    },

    stop(){
      if(this.timerId){
        clearTimeout(this.timerId);
        this.timerId = null;
      }
      if(this.boundActivityHandler){
        this.events.forEach((evt) => window.removeEventListener(evt, this.boundActivityHandler, true));
      }
      if(this.boundVisibilityHandler){
        document.removeEventListener('visibilitychange', this.boundVisibilityHandler, true);
      }
      this.started = false;
    },

    bump(){
      if(!Auth.current) return;
      if(this.timerId) clearTimeout(this.timerId);
      this.timerId = window.setTimeout(() => this.trigger(), this.idleMs);
    },

    trigger(){
      this.timerId = null;
      if(!Auth.current) return;
      this.stop();
      try { ChatUI.close?.(); } catch(_e) {}
      Auth.logout('idle');
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
      this.els.editBtn = $("#customerFullEditBtn");

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
      on(this.els.editBtn, "click", (ev) => {
        ev?.preventDefault?.();
        const rec = this.current();
        if(!rec) return;
        CustomerEditUI.open(rec.id);
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
  const CustomerEditUI = {
    currentId: null,
    draft: null,
    els: {},

    init(){
      this.els.wrap = $("#customerEditModal");
      this.els.backdrop = $("#customerEditModalBackdrop");
      this.els.close = $("#customerEditModalClose");
      this.els.cancel = $("#customerEditModalCancel");
      this.els.save = $("#customerEditModalSave");
      this.els.body = $("#customerEditModalBody");
      this.els.successWrap = $("#customerEditSuccessModal");
      this.els.successBackdrop = $("#customerEditSuccessBackdrop");
      this.els.successClose = $("#customerEditSuccessClose");
      this.els.successOpenReport = $("#customerEditSuccessOpenReport");
      this.els.successDownload = $("#customerEditSuccessDownload");
      this.els.successTitle = $("#customerEditSuccessTitle");
      this.els.successText = $("#customerEditSuccessText");

      on(this.els.close, "click", () => this.close());
      on(this.els.cancel, "click", () => this.close());
      on(this.els.backdrop, "click", () => this.close());
      on(this.els.save, "click", () => this.save());
      on(this.els.successClose, "click", () => this.closeSaveSuccess());
      on(this.els.successBackdrop, "click", () => this.closeSaveSuccess());
      on(this.els.successOpenReport, "click", () => this.openUpdatedOperationalReport());
      on(this.els.successDownload, "click", () => this.downloadUpdatedOperationalReport());

      on(this.els.body, "input", (ev) => this.handleFieldEvent(ev));
      on(this.els.body, "change", (ev) => this.handleFieldEvent(ev));
      on(this.els.body, "click", (ev) => this.handleClick(ev));
    },

    byId(id){
      return (State.data?.customers || []).find(rec => String(rec.id) === String(id)) || null;
    },

    deepClone(v){
      return JSON.parse(JSON.stringify(v ?? null));
    },

    defaultPrimary(){
      return {
        firstName:"", lastName:"", idNumber:"", birthDate:"", gender:"", maritalStatus:"",
        phone:"", email:"", city:"", street:"", houseNumber:"", apartment:"", zip:"",
        occupation:"",
        payerChoice:"insured", selectedPayerId:"", paymentMethod:"cc",
        cc:{ holderName:"", holderId:"", cardNumber:"", exp:"" },
        ho:{ account:"", branch:"", bankName:"", bankNo:"" },
        policyPayers:{},
        operationalAgentNumbers:{}
      };
    },

    defaultInsured(type="adult", label="מבוטח"){
      return {
        id: "ins_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2,7),
        type,
        label,
        data: {
          firstName:"", lastName:"", idNumber:"", birthDate:"", gender:"", maritalStatus:"",
          phone:"", email:"", city:"", street:"", houseNumber:"", apartment:"", zip:"",
          occupation:"",
          existingPolicies:[]
        }
      };
    },

    defaultExistingPolicy(){
      return {
        id: "ex_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2,7),
        company:"", type:"", policyNumber:"", monthlyPremium:"", status:"",
        sumInsured:"", compensation:"",
        hasPledge:false, pledgeBankName:"", bankAgency:false, bankAgencyName:""
      };
    },

    defaultNewPolicy(insuredId=""){
      return {
        id: "new_" + Date.now().toString(16) + "_" + Math.random().toString(16).slice(2,7),
        insuredMode:"single",
        insuredId: insuredId || "",
        company:"", type:"", premiumMonthly:"", startDate:"",
        sumInsured:"", compensation:"",
        pledge:false,
        pledgeBank:{ bankName:"", bankNo:"", branch:"", amount:"", years:"", address:"" },
        healthCovers:[]
      };
    },

    buildDraft(rec){
      const payload = this.deepClone(rec?.payload || {}) || {};
      const primary = Object.assign(this.defaultPrimary(), this.deepClone(payload.primary || {}));
      primary.cc = Object.assign(this.defaultPrimary().cc, this.deepClone(primary.cc || {}));
      primary.ho = Object.assign(this.defaultPrimary().ho, this.deepClone(primary.ho || {}));
      primary.policyPayers = this.deepClone(primary.policyPayers || {});
      primary.operationalAgentNumbers = this.deepClone(primary.operationalAgentNumbers || {});

      let insureds = Array.isArray(payload.insureds) ? this.deepClone(payload.insureds) : [];
      if(!insureds.length && Array.isArray(payload?.operational?.insureds)) insureds = this.deepClone(payload.operational.insureds);
      if(!insureds.length) insureds = [this.defaultInsured("primary", "מבוטח ראשי")];
      insureds = insureds.map((ins, idx) => {
        const fallback = this.defaultInsured(idx === 0 ? "primary" : "adult", idx === 0 ? "מבוטח ראשי" : `מבוטח ${idx+1}`);
        const next = Object.assign({}, fallback, ins || {});
        next.id = safeTrim(next.id) || fallback.id;
        next.type = safeTrim(next.type) || fallback.type;
        next.label = safeTrim(next.label) || fallback.label;
        next.data = Object.assign({}, fallback.data, this.deepClone(next.data || {}));
        next.data.existingPolicies = Array.isArray(next.data.existingPolicies) ? next.data.existingPolicies : [];
        return next;
      });

      let newPolicies = Array.isArray(payload.newPolicies) ? this.deepClone(payload.newPolicies) : [];
      if(!newPolicies.length && Array.isArray(payload?.operational?.newPolicies)) newPolicies = this.deepClone(payload.operational.newPolicies);
      newPolicies = newPolicies.map((policy) => {
        const next = Object.assign(this.defaultNewPolicy(insureds[0]?.id || ""), policy || {});
        next.id = safeTrim(next.id) || this.defaultNewPolicy(insureds[0]?.id || "").id;
        next.pledgeBank = Object.assign(this.defaultNewPolicy().pledgeBank, this.deepClone(next.pledgeBank || {}));
        next.healthCovers = Array.isArray(next.healthCovers) ? next.healthCovers : [];
        return next;
      });
      if(!safeTrim(primary.selectedPayerId) && insureds[0]?.id) primary.selectedPayerId = insureds[0].id;
      return { payload, primary, insureds, newPolicies };
    },

    open(id){
      const rec = this.byId(id);
      if(!rec || !this.els.wrap) return;
      this.currentId = rec.id;
      this.draft = this.buildDraft(rec);
      this.render();
      this.els.wrap.classList.add("is-open");
      this.els.wrap.setAttribute("aria-hidden","false");
    },

    close(){
      this.els.wrap?.classList.remove("is-open");
      this.els.wrap?.setAttribute("aria-hidden","true");
      this.currentId = null;
      this.draft = null;
    },

    getCurrentRecord(){
      return this.byId(this.currentId);
    },

    getCurrentPayloadForOperationalReport(){
      const rec = this.getCurrentRecord();
      return rec?.payload || null;
    },

    openSaveSuccess(message){
      if(!this.els.successWrap) return;
      if(this.els.successTitle) this.els.successTitle.textContent = 'השינויים נשמרו בהצלחה';
      if(this.els.successText) this.els.successText.textContent = safeTrim(message) || 'תיק הלקוח עודכן. אפשר עכשיו להוריד את הדוח התפעולי המעודכן עם כל השינויים.';
      this.els.successWrap.classList.add('is-open');
      this.els.successWrap.setAttribute('aria-hidden', 'false');
    },

    closeSaveSuccess(){
      if(!this.els.successWrap) return;
      this.els.successWrap.classList.remove('is-open');
      this.els.successWrap.setAttribute('aria-hidden', 'true');
    },

    openUpdatedOperationalReport(){
      const payload = this.getCurrentPayloadForOperationalReport();
      this.closeSaveSuccess();
      if(!payload) return;
      Wizard.openOperationalReport(payload);
    },

    async downloadUpdatedOperationalReport(){
      const payload = this.getCurrentPayloadForOperationalReport();
      if(!payload) return;
      await Wizard.exportOperationalPdf(payload);
    },

    field(path, fallback=""){
      const value = this.getByPath(this.draft, path);
      return value == null ? fallback : value;
    },

    esc(v){ return escapeHtml(v ?? ""); },

    getByPath(obj, path){
      return String(path || "").split(".").reduce((acc, part) => acc == null ? undefined : acc[part], obj);
    },

    setByPath(obj, path, value){
      const parts = String(path || "").split(".");
      let ref = obj;
      for(let i=0;i<parts.length-1;i+=1){
        const key = parts[i];
        const nextKey = parts[i+1];
        if(ref[key] == null) ref[key] = String(Number(nextKey)) === nextKey ? [] : {};
        ref = ref[key];
      }
      ref[parts[parts.length-1]] = value;
    },

    handleFieldEvent(ev){
      const el = ev.target?.closest?.("[data-ce-field]");
      if(!el || !this.draft) return;
      const path = el.getAttribute("data-ce-field");
      const value = (el.type === "checkbox") ? !!el.checked : el.value;
      this.setByPath(this.draft, path, value);
      if(path === "primary.payerChoice" && value === "insured" && !safeTrim(this.field("primary.selectedPayerId"))){
        this.setByPath(this.draft, "primary.selectedPayerId", safeTrim(this.draft.insureds?.[0]?.id));
      }
      if(path.endsWith(".type") || path === "primary.payerChoice" || path === "primary.paymentMethod") this.render();
    },

    handleClick(ev){
      const addIns = ev.target?.closest?.("[data-ce-add-insured]");
      if(addIns){
        const count = (this.draft?.insureds || []).length + 1;
        this.draft.insureds.push(this.defaultInsured("adult", `מבוטח ${count}`));
        this.render();
        return;
      }
      const delIns = ev.target?.closest?.("[data-ce-del-insured]");
      if(delIns){
        const idx = Number(delIns.getAttribute("data-ce-del-insured"));
        if(idx > 0){
          const removedId = safeTrim(this.draft.insureds?.[idx]?.id);
          this.draft.insureds.splice(idx, 1);
          this.draft.newPolicies = (this.draft.newPolicies || []).map((policy) => {
            if(String(policy?.insuredId) === String(removedId)) policy.insuredId = safeTrim(this.draft.insureds?.[0]?.id || "");
            return policy;
          });
          if(String(this.field("primary.selectedPayerId")) === String(removedId)) this.setByPath(this.draft, "primary.selectedPayerId", safeTrim(this.draft.insureds?.[0]?.id || ""));
          this.render();
        }
        return;
      }
      const addExisting = ev.target?.closest?.("[data-ce-add-existing]");
      if(addExisting){
        const idx = Number(addExisting.getAttribute("data-ce-add-existing"));
        const list = this.draft.insureds?.[idx]?.data?.existingPolicies;
        if(Array.isArray(list)) list.push(this.defaultExistingPolicy());
        this.render();
        return;
      }
      const delExisting = ev.target?.closest?.("[data-ce-del-existing]");
      if(delExisting){
        const [insIdx, polIdx] = String(delExisting.getAttribute("data-ce-del-existing")).split(":").map(Number);
        const list = this.draft.insureds?.[insIdx]?.data?.existingPolicies;
        if(Array.isArray(list)) list.splice(polIdx, 1);
        this.render();
        return;
      }
      const addNew = ev.target?.closest?.("[data-ce-add-new]");
      if(addNew){
        this.draft.newPolicies.push(this.defaultNewPolicy(safeTrim(this.draft.insureds?.[0]?.id || "")));
        this.render();
        return;
      }
      const delNew = ev.target?.closest?.("[data-ce-del-new]");
      if(delNew){
        const idx = Number(delNew.getAttribute("data-ce-del-new"));
        if(Array.isArray(this.draft.newPolicies)) this.draft.newPolicies.splice(idx, 1);
        this.render();
      }
    },

    renderInput(label, path, value, opts={}){
      const type = opts.type || "text";
      const dir = opts.dir ? ` dir="${this.esc(opts.dir)}"` : "";
      const inputmode = opts.inputmode ? ` inputmode="${this.esc(opts.inputmode)}"` : "";
      const placeholder = opts.placeholder ? ` placeholder="${this.esc(opts.placeholder)}"` : "";
      return `<label class="customerEditField"><span class="customerEditField__label">${this.esc(label)}</span><input class="input customerEditField__input" data-ce-field="${this.esc(path)}" type="${this.esc(type)}" value="${this.esc(value || "")}"${dir}${inputmode}${placeholder} /></label>`;
    },

    renderSelect(label, path, value, optionsHtml){
      let html = String(optionsHtml || "");
      const selectedPattern = new RegExp(`value="${String(this.esc(value || "")).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`);
      html = html.replace(selectedPattern, `value="${this.esc(value || "")}" selected`);
      return `<label class="customerEditField"><span class="customerEditField__label">${this.esc(label)}</span><select class="input customerEditField__input" data-ce-field="${this.esc(path)}">${html}</select></label>`;
    },

    renderCheckbox(label, path, checked){
      return `<label class="customerEditCheck"><input data-ce-field="${this.esc(path)}" type="checkbox" ${checked ? "checked" : ""} /><span>${this.esc(label)}</span></label>`;
    },

    renderPersonalSection(){
      const p = this.draft.primary || {};
      return `
        <section class="customerEditSection">
          <div class="customerEditSection__head">
            <div>
              <div class="customerEditSection__title">פרטים אישיים</div>
              <div class="customerEditSection__sub">כאן אפשר לעדכן את פרטי הלקוח הראשי.</div>
            </div>
          </div>
          <div class="customerEditGrid">
            ${this.renderInput("שם פרטי","primary.firstName", p.firstName)}
            ${this.renderInput("שם משפחה","primary.lastName", p.lastName)}
            ${this.renderInput("ת.ז","primary.idNumber", p.idNumber, { dir:"ltr", inputmode:"numeric" })}
            ${this.renderInput("תאריך לידה","primary.birthDate", p.birthDate, { placeholder:"dd/mm/yyyy" })}
            ${this.renderInput("טלפון","primary.phone", p.phone, { dir:"ltr", inputmode:"numeric" })}
            ${this.renderInput("אימייל","primary.email", p.email, { dir:"ltr", type:"email" })}
            ${this.renderInput("עיר","primary.city", p.city)}
            ${this.renderInput("רחוב","primary.street", p.street)}
            ${this.renderInput("מספר בית","primary.houseNumber", p.houseNumber)}
            ${this.renderInput("דירה","primary.apartment", p.apartment)}
            ${this.renderInput("מיקוד","primary.zip", p.zip)}
            ${this.renderInput("עיסוק","primary.occupation", p.occupation)}
          </div>
        </section>`;
    },

    renderExistingPolicy(policy, insIdx, polIdx){
      const prefix = `insureds.${insIdx}.data.existingPolicies.${polIdx}`;
      const type = safeTrim(policy?.type);
      const amountField = (type === "מחלות קשות" || type === "סרטן") ? "compensation" : "sumInsured";
      const amountLabel = (type === "מחלות קשות" || type === "סרטן") ? "סכום פיצוי" : "סכום ביטוח";
      return `
        <article class="customerEditPolicyCard">
          <div class="customerEditPolicyCard__head">
            <div class="customerEditPolicyCard__title">פוליסה קיימת ${polIdx + 1}</div>
            <button class="btn btn--danger customerEditMiniBtn" data-ce-del-existing="${insIdx}:${polIdx}" type="button">הסר</button>
          </div>
          <div class="customerEditGrid customerEditGrid--policy">
            ${this.renderInput("חברה",`${prefix}.company`, policy?.company || "")}
            ${this.renderInput("מוצר",`${prefix}.type`, type || "")}
            ${this.renderInput("מספר פוליסה",`${prefix}.policyNumber`, policy?.policyNumber || "")}
            ${this.renderInput("פרמיה חודשית",`${prefix}.monthlyPremium`, policy?.monthlyPremium || "", { dir:"ltr", inputmode:"numeric" })}
            ${this.renderInput("סטטוס",`${prefix}.status`, policy?.status || "")}
            ${this.renderInput(amountLabel,`${prefix}.${amountField}`, policy?.[amountField] || "", { dir:"ltr", inputmode:"numeric" })}
          </div>
          <div class="customerEditChecks">
            ${this.renderCheckbox("יש שיעבוד",`${prefix}.hasPledge`, !!policy?.hasPledge)}
            ${this.renderCheckbox("סוכנות בנקאית",`${prefix}.bankAgency`, !!policy?.bankAgency)}
          </div>
          ${policy?.hasPledge ? `<div class="customerEditGrid customerEditGrid--policy">
            ${this.renderInput("שם בנק",`${prefix}.pledgeBankName`, policy?.pledgeBankName || "")}
            ${this.renderInput("שם סוכנות",`${prefix}.bankAgencyName`, policy?.bankAgencyName || "")}
          </div>` : ``}
        </article>`;
    },

    renderInsuredSection(ins, idx){
      const data = ins?.data || {};
      const policies = Array.isArray(data.existingPolicies) ? data.existingPolicies : [];
      return `
        <section class="customerEditSection customerEditSection--insured">
          <div class="customerEditSection__head">
            <div>
              <div class="customerEditSection__title">${this.esc(ins.label || `מבוטח ${idx+1}`)}</div>
              <div class="customerEditSection__sub">פרטי מבוטח ופוליסות קיימות.</div>
            </div>
            ${idx > 0 ? `<button class="btn btn--danger customerEditMiniBtn" data-ce-del-insured="${idx}" type="button">הסר מבוטח</button>` : ``}
          </div>
          <div class="customerEditGrid">
            ${this.renderInput("כותרת מבוטח",`insureds.${idx}.label`, ins.label || "")}
            ${this.renderInput("סוג",`insureds.${idx}.type`, ins.type || "")}
            ${this.renderInput("שם פרטי",`insureds.${idx}.data.firstName`, data.firstName || "")}
            ${this.renderInput("שם משפחה",`insureds.${idx}.data.lastName`, data.lastName || "")}
            ${this.renderInput("ת.ז",`insureds.${idx}.data.idNumber`, data.idNumber || "", { dir:"ltr", inputmode:"numeric" })}
            ${this.renderInput("תאריך לידה",`insureds.${idx}.data.birthDate`, data.birthDate || "", { placeholder:"dd/mm/yyyy" })}
            ${this.renderInput("טלפון",`insureds.${idx}.data.phone`, data.phone || "", { dir:"ltr", inputmode:"numeric" })}
            ${this.renderInput("אימייל",`insureds.${idx}.data.email`, data.email || "", { dir:"ltr", type:"email" })}
          </div>
          <div class="customerEditSubSection">
            <div class="customerEditSubSection__head">
              <div class="customerEditSubSection__title">פוליסות קיימות</div>
              <button class="btn customerEditMiniBtn" data-ce-add-existing="${idx}" type="button">הוסף פוליסה קיימת</button>
            </div>
            <div class="customerEditList">
              ${policies.length ? policies.map((policy, pIdx) => this.renderExistingPolicy(policy, idx, pIdx)).join("") : `<div class="customerEditEmpty">אין כרגע פוליסות קיימות למבוטח הזה.</div>`}
            </div>
          </div>
        </section>`;
    },

    renderNewPoliciesSection(){
      const insuredOptions = (this.draft.insureds || []).map(ins => `<option value="${this.esc(ins.id)}">${this.esc(ins.label || 'מבוטח')}</option>`).join("");
      return `
        <section class="customerEditSection">
          <div class="customerEditSection__head">
            <div>
              <div class="customerEditSection__title">פוליסות חדשות</div>
              <div class="customerEditSection__sub">כאן אפשר להוסיף, להסיר ולעדכן פוליסות חדשות.</div>
            </div>
            <button class="btn customerEditMiniBtn" data-ce-add-new="1" type="button">הוסף פוליסה חדשה</button>
          </div>
          <div class="customerEditList">
            ${(this.draft.newPolicies || []).length ? this.draft.newPolicies.map((policy, idx) => {
              const prefix = `newPolicies.${idx}`;
              const type = safeTrim(policy?.type);
              const amountField = (type === "מחלות קשות" || type === "סרטן") ? "compensation" : "sumInsured";
              const amountLabel = (type === "מחלות קשות" || type === "סרטן") ? "סכום פיצוי" : "סכום ביטוח";
              return `<article class="customerEditPolicyCard">
                <div class="customerEditPolicyCard__head">
                  <div class="customerEditPolicyCard__title">פוליסה חדשה ${idx + 1}</div>
                  <button class="btn btn--danger customerEditMiniBtn" data-ce-del-new="${idx}" type="button">הסר</button>
                </div>
                <div class="customerEditGrid customerEditGrid--policy">
                  ${this.renderInput("חברה",`${prefix}.company`, policy?.company || "")}
                  ${this.renderInput("מוצר",`${prefix}.type`, type || "")}
                  ${this.renderSelect("מבוטח",`${prefix}.insuredId`, policy?.insuredId || "", insuredOptions)}
                  ${this.renderInput("פרמיה חודשית",`${prefix}.premiumMonthly`, policy?.premiumMonthly || "", { dir:"ltr", inputmode:"numeric" })}
                  ${this.renderInput("תאריך תחילה",`${prefix}.startDate`, policy?.startDate || "", { type:"date" })}
                  ${this.renderInput(amountLabel,`${prefix}.${amountField}`, policy?.[amountField] || "", { dir:"ltr", inputmode:"numeric" })}
                </div>
                <div class="customerEditChecks">
                  ${this.renderCheckbox("שיעבוד",`${prefix}.pledge`, !!policy?.pledge)}
                </div>
                ${policy?.pledge ? `<div class="customerEditGrid customerEditGrid--policy">
                  ${this.renderInput("שם בנק",`${prefix}.pledgeBank.bankName`, policy?.pledgeBank?.bankName || "")}
                  ${this.renderInput("מספר בנק",`${prefix}.pledgeBank.bankNo`, policy?.pledgeBank?.bankNo || "", { dir:"ltr", inputmode:"numeric" })}
                  ${this.renderInput("סניף",`${prefix}.pledgeBank.branch`, policy?.pledgeBank?.branch || "", { dir:"ltr", inputmode:"numeric" })}
                  ${this.renderInput("סכום לשיעבוד",`${prefix}.pledgeBank.amount`, policy?.pledgeBank?.amount || "", { dir:"ltr", inputmode:"numeric" })}
                  ${this.renderInput("לכמה שנים",`${prefix}.pledgeBank.years`, policy?.pledgeBank?.years || "", { dir:"ltr", inputmode:"numeric" })}
                  ${this.renderInput("כתובת הבנק",`${prefix}.pledgeBank.address`, policy?.pledgeBank?.address || "")}
                </div>` : ``}
              </article>`;
            }).join("") : `<div class="customerEditEmpty">עדיין אין פוליסות חדשות בתיק.</div>`}
          </div>
        </section>`;
    },

    renderPaymentSection(){
      const payerOptions = (this.draft.insureds || []).map(ins => `<option value="${this.esc(ins.id)}">${this.esc(ins.label || ins.data?.firstName || "מבוטח")}</option>`).join("");
      const isCc = safeTrim(this.field("primary.paymentMethod", "cc")) !== "ho";
      const isExternal = safeTrim(this.field("primary.payerChoice", "insured")) === "external";
      return `
        <section class="customerEditSection">
          <div class="customerEditSection__head">
            <div>
              <div class="customerEditSection__title">אמצעי תשלום</div>
              <div class="customerEditSection__sub">שומר את הנתונים בדיוק לתיק הלקוח והדוח התפעולי.</div>
            </div>
          </div>
          <div class="customerEditGrid">
            ${this.renderSelect("סוג משלם","primary.payerChoice", this.field("primary.payerChoice", "insured"), `<option value="insured">מבוטח קיים</option><option value="external">משלם חריג</option>`)}
            ${!isExternal ? this.renderSelect("בחירת משלם","primary.selectedPayerId", this.field("primary.selectedPayerId"), payerOptions) : `<div class="customerEditField customerEditField--spacer"></div>`}
            ${this.renderSelect("אמצעי תשלום","primary.paymentMethod", this.field("primary.paymentMethod", "cc"), `<option value="cc">כרטיס אשראי</option><option value="ho">הוראת קבע</option>`)}
          </div>
          ${isCc ? `<div class="customerEditGrid">
            ${this.renderInput("שם בעל הכרטיס","primary.cc.holderName", this.field("primary.cc.holderName"))}
            ${this.renderInput("ת.ז בעל הכרטיס","primary.cc.holderId", this.field("primary.cc.holderId"), { dir:"ltr", inputmode:"numeric" })}
            ${this.renderInput("מספר כרטיס","primary.cc.cardNumber", this.field("primary.cc.cardNumber"), { dir:"ltr", inputmode:"numeric" })}
            ${this.renderInput("תוקף","primary.cc.exp", this.field("primary.cc.exp"), { dir:"ltr", inputmode:"numeric", placeholder:"MM/YY" })}
          </div>` : `<div class="customerEditGrid">
            ${this.renderInput("שם בנק","primary.ho.bankName", this.field("primary.ho.bankName"))}
            ${this.renderInput("מספר בנק","primary.ho.bankNo", this.field("primary.ho.bankNo"), { dir:"ltr", inputmode:"numeric" })}
            ${this.renderInput("סניף","primary.ho.branch", this.field("primary.ho.branch"), { dir:"ltr", inputmode:"numeric" })}
            ${this.renderInput("מספר חשבון","primary.ho.account", this.field("primary.ho.account"), { dir:"ltr", inputmode:"numeric" })}
          </div>`}
        </section>`;
    },

    render(){
      if(!this.els.body || !this.draft) return;
      this.els.body.innerHTML = `
        <div class="customerEditModal__content">
          ${this.renderPersonalSection()}
          <section class="customerEditSection">
            <div class="customerEditSection__head">
              <div>
                <div class="customerEditSection__title">מבוטחים ופוליסות קיימות</div>
                <div class="customerEditSection__sub">עדכון מבוטחים והפוליסות הקיימות שלהם.</div>
              </div>
              <button class="btn customerEditMiniBtn" data-ce-add-insured="1" type="button">הוסף מבוטח</button>
            </div>
            <div class="customerEditInsuredStack">
              ${(this.draft.insureds || []).map((ins, idx) => this.renderInsuredSection(ins, idx)).join("")}
            </div>
          </section>
          ${this.renderNewPoliciesSection()}
          ${this.renderPaymentSection()}
        </div>`;
    },

    normalizeDraftForSave(rec){
      const payload = this.deepClone(rec?.payload || {});
      const primary = Object.assign(this.defaultPrimary(), this.deepClone(this.draft.primary || {}));
      primary.cc = Object.assign(this.defaultPrimary().cc, this.deepClone(primary.cc || {}));
      primary.ho = Object.assign(this.defaultPrimary().ho, this.deepClone(primary.ho || {}));
      const insureds = (this.draft.insureds || []).map((ins, idx) => {
        const fallback = this.defaultInsured(idx === 0 ? "primary" : "adult", idx === 0 ? "מבוטח ראשי" : `מבוטח ${idx+1}`);
        const next = Object.assign({}, fallback, this.deepClone(ins || {}));
        next.id = safeTrim(next.id) || fallback.id;
        next.type = safeTrim(next.type) || fallback.type;
        next.label = safeTrim(next.label) || fallback.label;
        next.data = Object.assign({}, fallback.data, this.deepClone(next.data || {}));
        next.data.existingPolicies = Array.isArray(next.data.existingPolicies) ? next.data.existingPolicies : [];
        return next;
      });
      const newPolicies = (this.draft.newPolicies || []).map((policy) => {
        const next = Object.assign(this.defaultNewPolicy(insureds[0]?.id || ""), this.deepClone(policy || {}));
        next.id = safeTrim(next.id) || this.defaultNewPolicy(insureds[0]?.id || "").id;
        next.insuredId = safeTrim(next.insuredId) || safeTrim(insureds[0]?.id || "");
        next.pledgeBank = Object.assign(this.defaultNewPolicy().pledgeBank, this.deepClone(next.pledgeBank || {}));
        next.healthCovers = Array.isArray(next.healthCovers) ? next.healthCovers : [];
        return next;
      });
      if(insureds[0]) insureds[0].data = Object.assign({}, insureds[0].data || {}, primary);
      payload.primary = this.deepClone(primary);
      payload.insureds = this.deepClone(insureds);
      payload.newPolicies = this.deepClone(newPolicies);
      payload.companyAgentNumbers = this.deepClone(primary.operationalAgentNumbers || payload.companyAgentNumbers || {});
      payload.operational = {
        createdAt: safeTrim(payload?.operational?.createdAt) || safeTrim(payload?.createdAt) || nowISO(),
        insureds: insureds.map(ins => ({ label: ins.label, type: ins.type, data: this.deepClone(ins.data || {}) })),
        newPolicies: this.deepClone(newPolicies),
        companyAgentNumbers: this.deepClone(primary.operationalAgentNumbers || payload.companyAgentNumbers || {}),
        primary: this.deepClone(primary)
      };
      return payload;
    },

    async save(){
      const rec = this.byId(this.currentId);
      if(!rec || !this.draft) return;
      const payload = this.normalizeDraftForSave(rec);
      const primary = payload.primary || {};
      rec.payload = payload;
      rec.fullName = safeTrim(((primary.firstName || "") + " " + (primary.lastName || "")).trim()) || rec.fullName || "לקוח ללא שם";
      rec.idNumber = safeTrim(primary.idNumber);
      rec.phone = safeTrim(primary.phone);
      rec.email = safeTrim(primary.email);
      rec.city = safeTrim(primary.city);
      rec.insuredCount = Array.isArray(payload.insureds) ? payload.insureds.length : 0;
      rec.existingPoliciesCount = Array.isArray(payload.insureds) ? payload.insureds.reduce((acc, ins) => acc + ((ins?.data?.existingPolicies || []).length), 0) : 0;
      rec.newPoliciesCount = Array.isArray(payload.newPolicies) ? payload.newPolicies.length : 0;
      rec.updatedAt = nowISO();
      State.data.meta.updatedAt = rec.updatedAt;
      const result = await App.persist("תיק הלקוח עודכן");
      CustomersUI.render();
      ProcessesUI.render();
      this.close();
      CustomersUI.openById(rec.id, { section: CustomersUI.currentSection || "wallet" });
      if(!result?.ok){
        console.warn("CUSTOMER_EDIT_SAVE_LOCAL_ONLY", rec.id);
      }
      this.currentId = rec.id;
      this.openSaveSuccess(result?.ok
        ? 'תיק הלקוח נשמר בהצלחה. אפשר עכשיו לפתוח או להוריד דוח תפעולי מעודכן עם כל השינויים שביצעת.'
        : 'השינויים נשמרו במערכת הפתוחה כרגע, אבל שמירת השרת לא הושלמה. עדיין אפשר לפתוח או להוריד דוח תפעולי מעודכן לפי הנתונים המעודכנים במסך.');
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
      { k:"ניתוחים ומחליפי ניתוח בישראל (משלים שב\"ן)", sub:"כיסוי משלים שב\"ן לניתוחים ומחליפי ניתוח בישראל" },
      { k:"ניתוחים ומחליפי ניתוח בישראל (שב\"ן עם השתתפות עצמית 5,000 ₪)", sub:"מסלול שב\"ן עם השתתפות עצמית 5,000 ₪" },
      { k:"ניתוחים ומחליפי ניתוח בישראל מהשקל הראשון", sub:"כיסוי מהשקל הראשון לניתוחים ומחליפי ניתוח בישראל" },
      { k:"טיפולי ומחליפי ניתוח בחו\"ל", sub:"כיסוי לניתוחים וטיפולים מחליפי ניתוח בחו\"ל" },
      { k:"השתלות", sub:"כיסוי להשתלות וטיפולים מיוחדים" },
      { k:"תרופות", sub:"כיסוי לתרופות בהתאם לתנאי הפוליסה" },
      { k:"אמבולטורי (ייעוצים ובדיקות)", sub:"ייעוצים, בדיקות ושירותים אמבולטוריים" },
      { k:"אבחון מהיר", sub:"שירותי אבחון רפואי מהיר" },
      { k:"נספח כתב שירות לילד", sub:"כתב שירות ייעודי לילד" },
      { k:"רפואה משלימה", sub:"שירותי רפואה משלימה" }
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
      on(this.els.reportPrint, "click", () => this.exportOperationalPdf(null, this.els.reportPrint));
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
        window.alert("הגשה לתפעול עדיין בפיתוח. בקרוב הכפתור יחובר לתהליך תפעול מלא.");
      });
      on(this.els.btnDownloadOpsFile, "click", () => this.exportOperationalPdf(null, this.els.btnDownloadOpsFile));
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

      if(this.step === 8){
        const store = this.getHealthStore();
        store.ui = store.ui || { currentIndex: 0, summary: false };
        if(store.ui.summary){
          store.ui.summary = false;
        }
      }

      const v = this.validateStep(this.step);
      if(!v.ok){
        if(this.step === 8){
          const store = this.getHealthStore();
          if(store?.ui) store.ui.summary = true;
        }
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

      if(this.step === 8){
        const store = this.getHealthStore();
        const isSummary = !!(store && store.ui && store.ui.summary);
        if(this.els.btnNext) this.els.btnNext.textContent = isSummary ? "למסך הסיכום" : "הבא";
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

    getNewPolicyInsuredLabel(payload, policy, insuredsOverride){
      const insureds = Array.isArray(insuredsOverride) && insuredsOverride.length
        ? insuredsOverride
        : (Array.isArray(payload?.insureds) && payload.insureds.length
          ? payload.insureds
          : (Array.isArray(payload?.operational?.insureds) ? payload.operational.insureds : []));
      if(policy?.insuredMode === "couple"){
        const primary = safeTrim(insureds?.[0]?.label) || "מבוטח ראשי";
        const spouse = safeTrim((insureds || []).find(x => x?.type === "spouse")?.label);
        return spouse ? `${primary} + ${spouse}` : `${primary} (זוגי)`;
      }
      const ins = (insureds || []).find(x => safeTrim(x?.id) === safeTrim(policy?.insuredId));
      if(safeTrim(ins?.label)) return safeTrim(ins.label);
      const firstIns = insureds?.[0];
      return safeTrim(firstIns?.label) || "מבוטח";
    },

    getPolicyCoverItems(policy){
      if(Array.isArray(policy?.healthCovers)) return policy.healthCovers.filter(Boolean).map(v => safeTrim(v)).filter(Boolean);
      if(Array.isArray(policy?.covers)) return policy.covers.filter(Boolean).map(v => safeTrim(v)).filter(Boolean);
      const raw = safeTrim(policy?.coverage || policy?.coverages || "");
      if(!raw) return [];
      return raw.split(',').map(v => safeTrim(v)).filter(Boolean);
    },

    getPolicyCoverageDisplayValue(policy){
      const type = safeTrim(policy?.type || policy?.product || "");
      const coverItems = this.getPolicyCoverItems(policy);
      if(type === "מחלות קשות" || type === "סרטן"){
        return safeTrim(policy?.compensation || policy?.sumInsured || policy?.coverage || (coverItems.length ? coverItems.join(', ') : '')) || "—";
      }
      return safeTrim(policy?.sumInsured || policy?.coverage || policy?.compensation || (coverItems.length ? coverItems.join(', ') : '')) || "—";
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
      const key = safeTrim(status);
      const map = {
        keep: "נשארת פעילה",
        cancel: "לביטול",
        full: "ביטול מלא",
        partial_health: "ביטול חלקי",
        replace: "מוחלפת",
        nochange_client: "ללא שינוי – לבקשת הלקוח",
        nochange_collective: "ללא שינוי – קולקטיב",
        agent_appoint: "מינוי סוכן",
        agentappoint: "מינוי סוכן",
        appoint_agent: "מינוי סוכן",
        nochange: "ללא שינוי",
        none: "ללא שינוי"
      };
      return map[key] || key || "טרם נבחר";
    },

    getExistingPolicyStatusMeta(policy, insuredData){
      const data = insuredData && typeof insuredData === 'object' ? insuredData : {};
      const cancellations = data?.cancellations && typeof data.cancellations === 'object' ? data.cancellations : {};
      const cancel = cancellations?.[policy?.id] && typeof cancellations[policy.id] === 'object' ? cancellations[policy.id] : {};
      const raw = safeTrim(cancel.status) || safeTrim(policy?.status) || safeTrim(policy?.treatmentStatus) || safeTrim(policy?.cancelStatus);
      const reason = safeTrim(cancel.reason) || safeTrim(policy?.statusReason) || safeTrim(policy?.reason);
      const partialDetails = [];
      const annexes = Array.isArray(cancel.annexes) ? cancel.annexes.filter(Boolean).map(v => safeTrim(v)).filter(Boolean) : [];
      if(annexes.length) partialDetails.push(`נספחים: ${annexes.join(', ')}`);
      const annexText = safeTrim(cancel.annexText || cancel.partialText || cancel.partialReason);
      if(annexText) partialDetails.push(annexText);
      let tone = 'neutral';
      if(raw === 'full' || raw === 'cancel') tone = 'danger';
      else if(raw === 'partial_health' || raw === 'replace') tone = 'warn';
      else if(raw === 'agent_appoint' || raw === 'agentappoint' || raw === 'appoint_agent' || raw === 'keep' || raw === 'nochange_client' || raw === 'nochange_collective' || raw === 'nochange' || raw === 'none') tone = 'success';
      return {
        raw,
        label: this.getExistingPolicyStatusLabel(raw),
        tone,
        reason,
        partialDetails: partialDetails.join(' · ')
      };
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
            <div class="lcOpHero__actions">
              <button type="button" class="btn btn--primary" data-op-open-report="1">דוח תפעולי</button>
              <button type="button" class="btn" data-op-download-report="1">הורד דוח תפעולי</button>
            </div>
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
      $$("[data-op-open-report]", this.els.body).forEach(btn => {
        on(btn, "click", () => this.openOperationalReport());
      });
      $$("[data-op-download-report]", this.els.body).forEach(btn => {
        on(btn, "click", () => this.exportOperationalPdf(null, btn));
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

    getHealthRelevantPolicies(){
      return (this.newPolicies || []).filter(p => {
        const type = safeTrim(p?.type);
        return ['ריסק','ריסק משכנתא','בריאות','מחלות קשות','סרטן'].includes(type);
      });
    },

    getHealthPoliciesForInsured(ins){
      return this.getHealthRelevantPolicies().filter(p => {
        if(p?.insuredMode === 'couple') return ins?.type === 'primary' || ins?.type === 'spouse';
        return safeTrim(p?.insuredId) === safeTrim(ins?.id);
      });
    },

    getHealthMasterSelection(){
      const policies = this.getHealthRelevantPolicies();
      const healthPolicies = policies.filter(policy => safeTrim(policy?.type) === 'בריאות');
      const criticalPolicies = policies.filter(policy => {
        const type = safeTrim(policy?.type);
        return type === 'מחלות קשות' || type === 'סרטן' || type === 'ריסק' || type === 'ריסק משכנתא';
      });
      const hasHealth = healthPolicies.length > 0;
      const sourcePolicies = hasHealth ? healthPolicies : criticalPolicies;
      const inheritedPolicies = hasHealth ? criticalPolicies : [];
      const companies = Array.from(new Set(policies.map(policy => safeTrim(policy?.company)).filter(Boolean)));
      const sourceLabels = sourcePolicies.map(policy => this.getPolicyLabel(policy)).filter(Boolean);
      const inheritedLabels = inheritedPolicies.map(policy => this.getPolicyLabel(policy)).filter(Boolean);
      if(!sourcePolicies.length) return null;
      return {
        key: hasHealth ? 'master_health' : 'master_critical_illness',
        schemaKey: hasHealth ? 'full_health' : 'critical_illness',
        title: hasHealth ? 'הצהרת בריאות ראשית · בריאות' : 'הצהרת בריאות ראשית · מחלות קשות',
        summary: hasHealth ? 'נבחר לפחות מוצר בריאות — לכן הצהרת הבריאות של בריאות היא ההצהרה הראשית לכל התיק.' : 'לא נבחר מוצר בריאות — לכן הצהרת מחלות קשות משמשת כהצהרה הראשית למחלות קשות / סרטן / ריסק.',
        sourceLabel: hasHealth ? 'בריאות' : 'מחלות קשות / סרטן / ריסק',
        sourcePolicies,
        inheritedPolicies,
        sourceLabels,
        inheritedLabels,
        companies
      };
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
      const selection = this.getHealthMasterSelection();
      if(!selection) return [];
      const schema = catalog[selection.schemaKey];
      if(!schema) return [];
      return [{
        key: selection.key,
        title: selection.title,
        summary: selection.summary,
        policyId: selection.sourcePolicies[0]?.id || '',
        questions: (schema.steps || []).map(step => ({
          ...step,
          key: `${selection.key}__${step.key}`,
          originalKey: step.key,
          companies: selection.companies.length ? selection.companies.slice() : ['הפניקס'],
          policyLabel: selection.sourceLabels[0] || selection.sourceLabel,
          fields: this.buildPhoenixFollowupFields(step.questionnaireNos || [], step.fields || []),
          requirements: {
            default: [
              `הצהרה ראשית לפי מוצר: ${selection.sourceLabel}`,
              ...(step.questionnaireNos?.length ? [`יש למלא שאלון/י המשך: ${step.questionnaireNos.join(', ')}`] : []),
              selection.summary
            ],
            ...(selection.sourceLabels.length ? { 'פוליסות מקור': [`${selection.sourceLabels.join(' · ')}`] } : {}),
            ...(selection.inheritedLabels.length ? { 'פוליסות יורשות': [`${selection.inheritedLabels.join(' · ')}`] } : {}),
            ...(selection.companies.length ? { 'חברות פעילות': [`${selection.companies.join(' · ')}`] } : {})
          }
        }))
      }];
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
        <div class="lcHFinishHero__actions"></div>
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
      $$('[data-health-open-operational-report]', this.els.body).forEach(btn => {
        on(btn, 'click', () => {
          this.openOperationalReport();
        });
      });
      $$('[data-health-download-operational-report]', this.els.body).forEach(btn => {
        on(btn, 'click', () => {
          this.exportOperationalPdf();
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
        insureds: this.insureds.map((ins, index) => ({
          id: safeTrim(ins?.id) || safeTrim(ins?.data?.id) || `payload_ins_${index}`,
          label: ins.label,
          type: ins.type,
          data: JSON.parse(JSON.stringify(ins.data || {}))
        })),
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

    renderReportStatusBadge(label, tone='neutral'){
      const safeTone = ['success','warn','danger','neutral'].includes(safeTrim(tone)) ? safeTrim(tone) : 'neutral';
      return `<span class="lcReportStatus lcReportStatus--${safeTone}">${escapeHtml(label || '—')}</span>`;
    },

    renderReportRowsList(rows, options = {}){
      const items = Array.isArray(rows) ? rows.filter(([label, value]) => safeTrim(label) && (options.keepEmpty ? true : safeTrim(value))) : [];
      if(!items.length) return `<div class="muted">${escapeHtml(options.emptyText || 'אין נתונים להצגה.')}</div>`;
      const denseClass = options.dense ? ' lcReportRows--dense' : '';
      return `<div class="lcReportRows${denseClass}">${items.map(([label, value]) => `<div class="lcReportRow"><div class="lcReportRow__label">${escapeHtml(label)}</div><div class="lcReportRow__value">${value}</div></div>`).join('')}</div>`;
    },

    normalizeOperationalReportPayload(rawPayload){
      const payload = rawPayload && typeof rawPayload === 'object' ? JSON.parse(JSON.stringify(rawPayload)) : {};
      if((!Array.isArray(payload.insureds) || !payload.insureds.length) && Array.isArray(payload?.operational?.insureds)){
        payload.insureds = JSON.parse(JSON.stringify(payload.operational.insureds));
      }
      if((!Array.isArray(payload.newPolicies) || !payload.newPolicies.length) && Array.isArray(payload?.operational?.newPolicies)){
        payload.newPolicies = JSON.parse(JSON.stringify(payload.operational.newPolicies));
      }
      payload.insureds = (Array.isArray(payload.insureds) ? payload.insureds : []).map((ins, index) => {
        const data = ins?.data && typeof ins.data === 'object' ? ins.data : {};
        return {
          ...ins,
          id: safeTrim(ins?.id) || safeTrim(data?.id) || `payload_ins_${index}`,
          label: safeTrim(ins?.label) || `מבוטח ${index + 1}`,
          type: safeTrim(ins?.type) || (index === 0 ? 'primary' : 'insured'),
          data
        };
      });
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
      const primary = payload?.primary && typeof payload.primary === 'object' ? payload.primary : {};
      const healthDeclaration = primary?.healthDeclaration && typeof primary.healthDeclaration === 'object'
        ? primary.healthDeclaration
        : {};
      const responses = healthDeclaration?.responses && typeof healthDeclaration.responses === 'object'
        ? healthDeclaration.responses
        : {};
      const questionList = this.getHealthQuestionList();
      const rows = [];
      (payload.insureds || []).forEach((ins, index) => {
        const insLabel = safeTrim(ins?.label) || `מבוטח ${index + 1}`;
        const insId = safeTrim(ins?.id) || safeTrim(ins?.data?.id) || `payload_ins_${index}`;
        questionList.forEach((item) => {
          const q = item.question || {};
          const answer = responses?.[q.key]?.[insId] || null;
          const answerRaw = safeTrim(answer?.answer);
          if(!answerRaw) return;
          const answerLabel = answerRaw === 'yes' ? 'כן' : answerRaw === 'no' ? 'לא' : answerRaw;
          const details = answerRaw === 'yes'
            ? safeTrim(this.summarizeHealthFields(answer?.fields || {})) || 'סומן כן ללא פירוט נוסף'
            : 'נענה לא';
          rows.push(`<div class="lcReportHealthItem"><div class="lcReportHealthItem__top"><strong>${escapeHtml(insLabel)}</strong><span class="lcReportStatus lcReportStatus--${answerRaw === 'yes' ? 'danger' : 'success'}">${escapeHtml(answerLabel)}</span></div><div class="lcReportHealthItem__question">${escapeHtml(q.text || q.key || 'שאלה רפואית')}</div><div class="lcReportHealthItem__answer">${escapeHtml(details)}</div></div>`);
        });
      });
      return rows;
    },

    renderOperationalReport(payloadOverride){
      try{
        const pack = this.buildOperationalPdfMarkup(payloadOverride, { forPreview:true });
        return `<div class="lcReportDoc lcReportDoc--cleanPdfPreview">${pack.html}</div>`;
      }catch(err){
        console.error('renderOperationalReport failed', err);
        return `<div class="lcReportDoc"><section class="lcReportSection"><div class="lcReportSection__title">לא ניתן להציג את הדוח כרגע</div><div class="lcReportSection__sub">אירעה שגיאה בעת בניית התצוגה המקדימה של הדוח.</div><div class="lcReportList"><div class="lcReportListItem"><strong>פירוט</strong><span>${escapeHtml(err?.message || 'שגיאה לא ידועה')}</span></div></div></section></div>`;
      }
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

    getOperationalPdfFileName(payload){
      const primary = payload?.primary || {};
      const name = safeTrim(((primary.firstName || '') + ' ' + (primary.lastName || '')).trim()) || 'לקוח';
      const stamp = new Date().toISOString().slice(0,19).replace(/[T:]/g,'-');
      return `GEMEL_INVEST_דוח_תפעולי_${name.replace(/[\\/:*?"<>|]/g,'_')}_${stamp}.pdf`;
    },

    async waitForImages(root){
      const images = Array.from(root?.querySelectorAll?.('img') || []);
      if(!images.length) return;
      await Promise.all(images.map((img) => new Promise((resolve) => {
        if(img.complete) return resolve();
        const done = () => resolve();
        img.addEventListener('load', done, { once:true });
        img.addEventListener('error', done, { once:true });
      })));
    },

    sanitizeOperationalReportHtmlForPdf(reportHtml){
      try{
        const wrap = document.createElement('div');
        wrap.innerHTML = String(reportHtml || '');
        const sectionTitlesToStrip = ['פעולות המערכת'];
        $$('.lcReportSection', wrap).forEach((section) => {
          const title = safeTrim($('.lcReportSection__title', section)?.textContent || '');
          if(sectionTitlesToStrip.includes(title)) section.remove();
        });
        return wrap.innerHTML;
      }catch(_err){
        return String(reportHtml || '').replace(/<section[^>]*>[\s\S]*?פעולות המערכת[\s\S]*?<\/section>/g, '');
      }
    },


    buildOperationalPdfMarkup(payloadOverride, options = {}){
      const previewMode = !!options?.forPreview;
      const payload = this.normalizeOperationalReportPayload(payloadOverride || this.getOperationalPayload());
      const primary = payload?.primary || {};
      const insureds = Array.isArray(payload?.insureds) ? payload.insureds : [];
      const newPolicies = Array.isArray(payload?.newPolicies) ? payload.newPolicies : [];
      const exportDate = (() => {
        const raw = safeTrim(payload?.createdAt);
        const ms = Date.parse(raw || '');
        return Number.isFinite(ms) ? new Date(ms) : new Date();
      })();
      const exportedDateLabel = exportDate.toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit', year:'numeric' });
      const exportedTimeLabel = exportDate.toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' });
      const exportedAt = `${exportedDateLabel} ${exportedTimeLabel}`;
      const currentAgentName = safeTrim(Auth?.current?.name) || safeTrim(payload?.agentName) || 'נציג מטפל';
      const logoSrc = safeTrim(document.querySelector('.brand__logoImg, .lcLogin__logoImg')?.src) || './logo-login-clean.png';
      const customerName = safeTrim(((primary.firstName || '') + ' ' + (primary.lastName || '')).trim()) || 'לקוח ללא שם';

      const chunk = (arr, size) => {
        const out = [];
        const safe = Array.isArray(arr) ? arr : [];
        const step = Math.max(1, Number(size) || 1);
        for(let i = 0; i < safe.length; i += step) out.push(safe.slice(i, i + step));
        return out;
      };
      const esc = (v) => escapeHtml(v == null ? '—' : String(v));
      const money = (v) => {
        const s = safeTrim(v);
        return s ? this.formatMoneyValue(s) : '—';
      };

      const getPolicyInsuredLabelSafe = (policy) => {
        if(policy?.insuredMode === 'couple'){
          const primaryLabel = safeTrim(insureds?.[0]?.label) || 'מבוטח ראשי';
          const spouseLabel = safeTrim((insureds || []).find(x => x?.type === 'spouse')?.label);
          return spouseLabel ? `${primaryLabel} + ${spouseLabel}` : `${primaryLabel} (זוגי)`;
        }
        const ins = (insureds || []).find(x => safeTrim(x?.id) === safeTrim(policy?.insuredId));
        return safeTrim(ins?.label) || safeTrim(insureds?.[0]?.label) || 'מבוטח';
      };
      const getPolicyCoverageDisplaySafe = (policy) => {
        try{ if(typeof this.getPolicyCoverageDisplayValue === 'function') return safeTrim(this.getPolicyCoverageDisplayValue(policy || {})) || '—'; }catch(_e){}
        const coverItems = Array.isArray(policy?.healthCovers) ? policy.healthCovers.filter(Boolean).map(v => safeTrim(v)).filter(Boolean) : [];
        return safeTrim(policy?.sumInsured || policy?.coverage || policy?.compensation || (coverItems.length ? coverItems.join(', ') : '')) || '—';
      };
      const getPolicyCoverItemsSafe = (policy) => {
        try{ if(typeof this.getPolicyCoverItems === 'function') return this.getPolicyCoverItems(policy || {}); }catch(_e){}
        if(Array.isArray(policy?.healthCovers)) return policy.healthCovers.filter(Boolean).map(v => safeTrim(v)).filter(Boolean);
        if(Array.isArray(policy?.covers)) return policy.covers.filter(Boolean).map(v => safeTrim(v)).filter(Boolean);
        const raw = safeTrim(policy?.coverage || policy?.coverages || '');
        return raw ? raw.split(',').map(v => safeTrim(v)).filter(Boolean) : [];
      };
      const getPolicyPledgeRowsSafe = (policy) => {
        const type = safeTrim(policy?.type || policy?.product || '');
        if(!(type === 'ריסק' || type === 'ריסק משכנתא')) return [];
        if(!policy?.pledge) return [];
        const bank = policy?.pledgeBank && typeof policy.pledgeBank === 'object' ? policy.pledgeBank : {};
        return [
          ['שיעבוד', 'מוטב בלתי חוזר'],
          ['שם בנק', safeTrim(bank.bankName)],
          ['מספר בנק', safeTrim(bank.bankNo)],
          ['סניף', safeTrim(bank.branch || bank.branchNo)],
          ['סכום משכנתא', safeTrim(policy?.mortgageAmount || bank.amount)],
          ['שנות משכנתא', safeTrim(policy?.mortgageYears || bank.years)],
          ['כתובת נכס / בנק', safeTrim(policy?.mortgageAddress || bank.address)]
        ].filter(([, value]) => safeTrim(value));
      };

      const summaryRows = [
        ['שם לקוח', customerName],
        ['תאריך הפקה', exportedDateLabel],
        ['שעת הפקה', exportedTimeLabel],
        ['נציג מטפל', currentAgentName],
        ['כמות מבוטחים', String(insureds.length || 0)],
        ['פוליסות קיימות', String((insureds || []).reduce((acc, ins) => acc + ((ins?.data?.existingPolicies || []).length), 0))],
        ['פוליסות חדשות', String(newPolicies.length || 0)]
      ].filter(([, value]) => safeTrim(value));

      const customerRows = [
        ['שם מלא', customerName],
        ['ת״ז', safeTrim(primary.idNumber)],
        ['תאריך לידה', safeTrim(primary.birthDate)],
        ['גיל', safeTrim(primary.age)],
        ['טלפון', safeTrim(primary.phone)],
        ['אימייל', safeTrim(primary.email)],
        ['מגדר', safeTrim(primary.gender)],
        ['מצב משפחתי', safeTrim(primary.maritalStatus)],
        ['עיר', safeTrim(primary.city)],
        ['כתובת', [safeTrim(primary.street), safeTrim(primary.houseNumber), safeTrim(primary.apartment)].filter(Boolean).join(' ')],
        ['קופת חולים', safeTrim(primary.healthFund)],
        ['שב״ן', safeTrim(primary.shaban)],
        ['עיסוק', safeTrim(primary.occupation)]
      ].filter(([, value]) => safeTrim(value));

      const insuredRows = insureds.map((ins, index) => {
        const d = ins?.data || {};
        const fullName = [safeTrim(d.firstName), safeTrim(d.lastName)].filter(Boolean).join(' ');
        return {
          label: safeTrim(ins?.label) || `מבוטח ${index + 1}`,
          rows: [
            ['שם מלא', fullName || '—'],
            ['ת״ז', safeTrim(d.idNumber)],
            ['תאריך לידה', safeTrim(d.birthDate)],
            ['גיל', safeTrim(d.age)],
            ['טלפון', safeTrim(d.phone)],
            ['קופת חולים', safeTrim(d.healthFund)],
            ['שב״ן', safeTrim(d.shaban)]
          ].filter(([, value]) => safeTrim(value))
        };
      });

      const existingRows = [];
      insureds.forEach((ins, index) => {
        const d = ins?.data || {};
        const insuredLabel = safeTrim(ins?.label) || `מבוטח ${index + 1}`;
        const policies = Array.isArray(d?.existingPolicies) ? d.existingPolicies : [];
        policies.forEach((policy) => {
          const statusMeta = (typeof this.getExistingPolicyStatusMeta === 'function')
            ? this.getExistingPolicyStatusMeta(policy, d)
            : { label: safeTrim(policy?.status || policy?.policyStatus || policy?.actionStatus || policy?.action) || '—', tone:'neutral' };
          existingRows.push({
            insured: insuredLabel,
            company: safeTrim(policy?.company) || '—',
            type: safeTrim(policy?.type || policy?.product) || '—',
            policyNumber: safeTrim(policy?.policyNumber) || '—',
            premium: safeTrim(policy?.monthlyPremium || policy?.premium) ? this.formatMoneyValue(safeTrim(policy?.monthlyPremium || policy?.premium)) : '—',
            status: safeTrim(statusMeta?.label) || '—'
          });
        });
      });

      const newPolicyBlocks = newPolicies.map((policy, index) => ({
        title: safeTrim(policy?.company) || `פוליסה ${index + 1}`,
        subtitle: safeTrim(policy?.type || policy?.product) || 'פוליסה חדשה',
        rows: [
          ['מבוטח', getPolicyInsuredLabelSafe(policy)],
          ['חברה', safeTrim(policy?.company)],
          ['מוצר', safeTrim(policy?.type || policy?.product)],
          ['פרמיה חודשית', money(safeTrim(policy?.premiumMonthly || policy?.premium))],
          ['פרמיה אחרי הנחה', money(this.getPolicyPremiumAfterDiscount(policy || {}))],
          ['דירוג הנחה', safeTrim(this.getPolicyDiscountDisplayText(policy || {}))],
          ['תאריך תחילה', safeTrim(policy?.startDate)],
          ['כיסוי / סכום', getPolicyCoverageDisplaySafe(policy)],
          ['אופן תשלום', safeTrim(policy?.paymentMethod)]
        ].filter(([, value]) => safeTrim(value)),
        covers: getPolicyCoverItemsSafe(policy),
        pledgeRows: getPolicyPledgeRowsSafe(policy)
      }));

      const payer = primary?.payer || {};
      const payerRows = [
        ['מי משלם', safeTrim(primary.payerChoice === 'external' ? 'משלם חיצוני' : 'המבוטח')],
        ['אמצעי תשלום', safeTrim(primary.paymentMethod === 'cc' ? 'אשראי' : primary.paymentMethod === 'ho' ? 'הוראת קבע' : primary.paymentMethod || payer?.method)],
        ['שם משלם', safeTrim(payer?.holderName || primary?.payerName || primary?.externalPayer?.firstName)],
        ['ת״ז משלם', safeTrim(payer?.holderId || primary?.payerId || primary?.externalPayer?.idNumber)],
        ['טלפון משלם', safeTrim(primary?.externalPayer?.phone)],
        ['מספר כרטיס', safeTrim(payer?.cardNumberMasked || payer?.cardNumber || primary?.cc?.cardNumber || primary?.cardNumberMasked)],
        ['תוקף', safeTrim(payer?.cardExpiry || primary?.cc?.exp || primary?.cardExpiry)],
        ['בנק', safeTrim(payer?.bankName || primary?.ho?.bankName)],
        ['מספר בנק', safeTrim(payer?.bankNo || primary?.ho?.bankNo)],
        ['סניף', safeTrim(payer?.branchNo || primary?.ho?.branch)],
        ['חשבון', safeTrim(payer?.accountNo || primary?.ho?.account)]
      ].filter(([, value]) => safeTrim(value));

      const companyAgentRows = Object.entries(payload.companyAgentNumbers || {}).map(([company, agentNo]) => [safeTrim(company), safeTrim(agentNo)]).filter(([, v]) => v);

      const questionList = typeof this.getHealthQuestionList === 'function' ? (this.getHealthQuestionList() || []) : [];
      const healthDeclaration = primary?.healthDeclaration && typeof primary.healthDeclaration === 'object' ? primary.healthDeclaration : {};
      const responses = healthDeclaration?.responses && typeof healthDeclaration.responses === 'object' ? healthDeclaration.responses : {};
      const healthItems = [];
      (insureds || []).forEach((ins, index) => {
        const insLabel = safeTrim(ins?.label) || `מבוטח ${index + 1}`;
        const insId = safeTrim(ins?.id) || safeTrim(ins?.data?.id) || `payload_ins_${index}`;
        questionList.forEach((item, qIndex) => {
          const q = item?.question || {};
          const answer = responses?.[q.key]?.[insId] || null;
          const answerRaw = safeTrim(answer?.answer);
          if(!answerRaw) return;
          healthItems.push({
            insured: insLabel,
            no: qIndex + 1,
            question: safeTrim(q.text || q.key || 'שאלה רפואית'),
            answer: answerRaw === 'yes' ? 'כן' : answerRaw === 'no' ? 'לא' : answerRaw,
            details: answerRaw === 'yes'
              ? safeTrim(this.summarizeHealthFields(answer?.fields || {})) || 'סומן כן ללא פירוט נוסף'
              : 'נענה לא'
          });
        });
      });

      const style = `<style>
        .lcPdfRoot,.lcPdfRoot *{box-sizing:border-box}
        .lcPdfRoot{direction:rtl;font-family:Arial,"Noto Sans Hebrew","Segoe UI",sans-serif;background:${previewMode ? 'transparent' : '#eef2f7'};padding:${previewMode ? '0' : '18px'};color:#142235}
        .lcPdfPage{width:680px;min-height:1000px;margin:0 auto 18px;background:#fff;padding:24px 22px 20px;border:1px solid #dce4ee;border-radius:${previewMode ? '18px' : '8px'};box-shadow:${previewMode ? 'none' : '0 16px 42px rgba(15,23,42,.10)'};overflow:hidden}
        .lcPdfPageBreak{height:0;break-after:page;page-break-after:always}
        .lcPdfRoot--preview .lcPdfPageBreak{display:none}
        .lcPdfHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding-bottom:12px;border-bottom:1px solid #dce4ee}
        .lcPdfHeader__title{font-size:24px;font-weight:900;color:#122f57;margin:0}
        .lcPdfHeader__sub{font-size:12px;color:#61748b;margin-top:4px}
        .lcPdfHeader__meta{display:grid;gap:4px;margin-top:10px;font-size:12px;color:#30465f}
        .lcPdfHeader__logo{width:105px;height:auto;object-fit:contain}
        .lcPdfSection{margin-top:14px}
        .lcPdfSection__title{font-size:15px;font-weight:900;color:#122f57;margin:0 0 8px}
        .lcPdfKv{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px}
        .lcPdfKv__item{display:grid;grid-template-columns:110px 1fr;align-items:start;border:1px solid #e0e7ef;border-radius:10px;background:#fafbfd;padding:7px 9px;min-height:42px}
        .lcPdfKv__label{font-size:11px;font-weight:800;color:#6a7c92}
        .lcPdfKv__value{font-size:13px;font-weight:700;color:#16283f;word-break:break-word}
        .lcPdfCards{display:grid;gap:10px}
        .lcPdfCard{border:1px solid #e0e7ef;border-radius:12px;padding:10px;background:#fff;break-inside:avoid;page-break-inside:avoid}
        .lcPdfCard__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
        .lcPdfCard__title{font-size:14px;font-weight:900;color:#122f57}
        .lcPdfCard__sub{font-size:12px;color:#6a7c92;font-weight:700}
        .lcPdfPills{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
        .lcPdfPill{display:inline-flex;padding:5px 8px;border-radius:999px;border:1px solid #dce4ee;background:#f4f7fb;font-size:11px;font-weight:800;color:#28405d}
        .lcPdfTable{width:100%;border-collapse:collapse}
        .lcPdfTable th,.lcPdfTable td{border:1px solid #dce4ee;padding:7px 8px;text-align:right;vertical-align:top;font-size:12px}
        .lcPdfTable th{background:#f5f7fb;color:#54677e;font-weight:900}
        .lcPdfEmpty{padding:14px 4px;color:#7b8da2;font-size:12px;font-weight:700}
        .lcPdfFoot{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid #dce4ee;padding-top:10px;margin-top:14px;color:#708196;font-size:11px}
      </style>`;

      const renderKv = (rows, emptyText='אין נתונים להצגה.') => {
        const safeRows = Array.isArray(rows) ? rows.filter(([label, value]) => safeTrim(label) && safeTrim(value)) : [];
        if(!safeRows.length) return `<div class="lcPdfEmpty">${esc(emptyText)}</div>`;
        return `<div class="lcPdfKv">${safeRows.map(([label, value]) => `<div class="lcPdfKv__item"><div class="lcPdfKv__label">${esc(label)}</div><div class="lcPdfKv__value">${esc(value)}</div></div>`).join('')}</div>`;
      };

      const renderTable = (headers, rows, emptyText='אין נתונים להצגה.') => {
        const safeRows = Array.isArray(rows) ? rows.filter((row) => Array.isArray(row) && row.some((cell) => safeTrim(cell))) : [];
        if(!safeRows.length) return `<div class="lcPdfEmpty">${esc(emptyText)}</div>`;
        return `<table class="lcPdfTable"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${safeRows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      };

      const renderPage = (title, subtitle, bodyHtml, pageNo) => `
        <div class="lcPdfPage">
          <header class="lcPdfHeader">
            <div>
              <h1 class="lcPdfHeader__title">${esc(title)}</h1>
              <div class="lcPdfHeader__sub">${esc(subtitle)}</div>
              <div class="lcPdfHeader__meta">
                <div>לקוח: ${esc(customerName)}</div>
                <div>נציג מטפל: ${esc(currentAgentName)}</div>
                <div>הופק בתאריך: ${esc(exportedAt)}</div>
              </div>
            </div>
            <img src="${esc(logoSrc)}" alt="GEMEL INVEST" class="lcPdfHeader__logo" />
          </header>
          ${bodyHtml}
          <div class="lcPdfFoot"><div>GEMEL INVEST</div><div>עמוד ${pageNo}</div></div>
        </div>`;

      const pages = [];

      let pageNo = 1;
      let introBody = `
        <section class="lcPdfSection">
          <div class="lcPdfSection__title">סיכום</div>
          ${renderKv(summaryRows, 'אין נתוני סיכום')}
        </section>
        <section class="lcPdfSection">
          <div class="lcPdfSection__title">פרטי לקוח</div>
          ${renderKv(customerRows, 'לא הוזנו פרטי לקוח')}
        </section>
      `;
      if(insuredRows.length){
        introBody += `<section class="lcPdfSection"><div class="lcPdfSection__title">מבוטחים</div><div class="lcPdfCards">${
          insuredRows.map((item) => `<div class="lcPdfCard"><div class="lcPdfCard__head"><div><div class="lcPdfCard__title">${esc(item.label)}</div></div></div>${renderKv(item.rows, 'לא הוזנו פרטי מבוטח')}</div>`).join('')
        }</div></section>`;
      }
      if(payerRows.length){
        introBody += `<section class="lcPdfSection"><div class="lcPdfSection__title">אמצעי תשלום</div>${renderKv(payerRows, 'לא הוזנו פרטי תשלום')}</section>`;
      }
      if(companyAgentRows.length){
        introBody += `<section class="lcPdfSection"><div class="lcPdfSection__title">מספרי סוכן</div>${renderTable(['חברה','מספר סוכן'], companyAgentRows, 'לא הוזנו מספרי סוכן')}</section>`;
      }
      pages.push(renderPage('דוח תפעולי', 'דף פתיחה מסודר ומרוכז ל-A4.', introBody, pageNo++));

      const existingChunks = chunk(existingRows, 10);
      if(existingChunks.length){
        existingChunks.forEach((group, idx) => {
          const body = `<section class="lcPdfSection"><div class="lcPdfSection__title">פוליסות קיימות ${existingChunks.length > 1 ? `— חלק ${idx + 1}` : ''}</div>${renderTable(['מבוטח','חברה','מוצר','מספר פוליסה','פרמיה','סטטוס'], group.map((row) => [row.insured, row.company, row.type, row.policyNumber, row.premium, row.status]), 'לא נוספו פוליסות קיימות')}</section>`;
          pages.push(renderPage('פוליסות קיימות', 'כל פוליסה מוצגת בשורה נפרדת לקריאה ברורה.', body, pageNo++));
        });
      }

      const newPolicyChunks = chunk(newPolicyBlocks, 3);
      if(newPolicyChunks.length){
        newPolicyChunks.forEach((group, idx) => {
          const body = `<section class="lcPdfSection"><div class="lcPdfSection__title">פוליסות חדשות ${newPolicyChunks.length > 1 ? `— חלק ${idx + 1}` : ''}</div><div class="lcPdfCards">${
            group.map((block) => `
              <section class="lcPdfCard">
                <div class="lcPdfCard__head">
                  <div>
                    <div class="lcPdfCard__title">${esc(block.title)}</div>
                    <div class="lcPdfCard__sub">${esc(block.subtitle)}</div>
                  </div>
                </div>
                ${renderKv(block.rows, 'לא הוזנו פרטי פוליסה')}
                ${block.covers.length ? `<div class="lcPdfPills">${block.covers.map((cover) => `<span class="lcPdfPill">${esc(cover)}</span>`).join('')}</div>` : ''}
                ${block.pledgeRows.length ? `<section class="lcPdfSection"><div class="lcPdfSection__title">שיעבוד</div>${renderKv(block.pledgeRows, 'לא הוזנו פרטי שיעבוד')}</section>` : ''}
              </section>
            `).join('')
          }</div></section>`;
          pages.push(renderPage('פוליסות חדשות', 'הפוליסות שנמכרו מוצגות בכרטיסים מסודרים.', body, pageNo++));
        });
      }

      const healthChunks = chunk(healthItems, 8);
      if(healthChunks.length){
        healthChunks.forEach((group, idx) => {
          const body = `<section class="lcPdfSection"><div class="lcPdfSection__title">הצהרת בריאות ${healthChunks.length > 1 ? `— חלק ${idx + 1}` : ''}</div>${
            renderTable(['מבוטח','סעיף','שאלה','תשובה','פירוט'], group.map((item) => [item.insured, String(item.no), item.question, item.answer, item.details]), 'לא נמצאו תשובות להצגת הצהרת הבריאות')
          }</section>`;
          pages.push(renderPage('הצהרת בריאות', 'ריכוז תשובות ברורות עם כן / לא ופירוט.', body, pageNo++));
        });
      } else {
        pages.push(renderPage('הצהרת בריאות', 'לא נמצאו תשובות להצגת הצהרת הבריאות.', `<section class="lcPdfSection"><div class="lcPdfSection__title">הצהרת בריאות</div><div class="lcPdfEmpty">לא נמצאו תשובות להצגת הצהרת הבריאות.</div></section>`, pageNo++));
      }

      const rootClass = previewMode ? 'lcPdfRoot lcPdfRoot--preview' : 'lcPdfRoot';
      return {
        payload,
        html: `${style}<div class="${rootClass}">${pages.join('<div class="lcPdfPageBreak"></div>')}</div>`
      };
    },

    async exportOperationalPdfPageByPage(payloadOverride, sourceBtn){
      const JsPdfCtor = window?.jspdf?.jsPDF || window?.jsPDF || null;
      const html2canvasFn = typeof window?.html2canvas === 'function' ? window.html2canvas : null;
      if(!JsPdfCtor || !html2canvasFn) return false;

      const triggerBtn = sourceBtn || this.els.reportPrint || this.els.btnDownloadOpsFile || null;
      const originalText = triggerBtn ? triggerBtn.textContent : '';
      if(triggerBtn){
        triggerBtn.disabled = true;
        triggerBtn.textContent = 'מייצא PDF...';
      }

      let host = null;
      try{
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const payload = this.normalizeOperationalReportPayload(payloadOverride || this.getOperationalPayload());
        const filename = this.getOperationalPdfFileName(payload);
        const pack = this.buildOperationalPdfMarkup(payload, { forPreview:false });
        if(!pack?.html) throw new Error('Operational PDF markup was not created');

        const A4_WIDTH_PX = 794;
        host = document.createElement('div');
        host.className = 'lcPdfExportHost';
        host.setAttribute('dir','rtl');
        host.setAttribute('aria-hidden', 'true');
        host.style.position = 'fixed';
        host.style.top = '0';
        host.style.left = '-20000px';
        host.style.width = A4_WIDTH_PX + 'px';
        host.style.minWidth = A4_WIDTH_PX + 'px';
        host.style.maxWidth = A4_WIDTH_PX + 'px';
        host.style.padding = '8px 0';
        host.style.margin = '0';
        host.style.background = '#ffffff';
        host.style.opacity = '1';
        host.style.visibility = 'visible';
        host.style.pointerEvents = 'none';
        host.style.zIndex = '-1';
        host.style.overflow = 'visible';
        host.innerHTML = pack.html;
        document.body.appendChild(host);

        if(document.fonts?.ready){
          try { await document.fonts.ready; } catch(_fontErr) {}
        }
        await this.waitForImages(host);
        await new Promise((resolve) => window.setTimeout(resolve, 180));
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const pages = Array.from(host.querySelectorAll('.lcPdfPage'));
        if(!pages.length) throw new Error('No PDF pages found');

        const pdf = new JsPdfCtor({ unit:'pt', format:'a4', orientation:'portrait', compress:true });
        const pdfPageWidth = pdf.internal.pageSize.getWidth();
        const pdfPageHeight = pdf.internal.pageSize.getHeight();
        const marginX = 16;
        const marginY = 16;
        const usableWidth = pdfPageWidth - (marginX * 2);
        const usableHeight = pdfPageHeight - (marginY * 2);

        for(let i = 0; i < pages.length; i += 1){
          const pageEl = pages[i];
          const canvas = await html2canvasFn(pageEl, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            scrollX: 0,
            scrollY: 0,
            width: pageEl.scrollWidth || 680,
            height: pageEl.scrollHeight || 1000,
            windowWidth: A4_WIDTH_PX,
            windowHeight: pageEl.scrollHeight || 1000
          });
          const imgData = canvas.toDataURL('image/jpeg', 0.98);
          const scale = Math.min(usableWidth / canvas.width, usableHeight / canvas.height);
          const drawWidth = canvas.width * scale;
          const drawHeight = canvas.height * scale;
          const drawX = (pdfPageWidth - drawWidth) / 2;
          const drawY = marginY;
          if(i > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', drawX, drawY, drawWidth, drawHeight, undefined, 'FAST');
        }

        pdf.save(filename);
        return true;
      }catch(err){
        console.warn('exportOperationalPdfPageByPage failed, falling back to legacy engine', err);
        return false;
      }finally{
        if(host && host.parentNode) host.parentNode.removeChild(host);
        if(triggerBtn){
          triggerBtn.disabled = false;
          triggerBtn.textContent = originalText || 'הורד PDF דוח תפעולי';
        }
      }
    },

    async exportOperationalPdf(payloadOverride, sourceBtn){
      this.openOperationalReport(payloadOverride);
      const usedPageEngine = await this.exportOperationalPdfPageByPage(payloadOverride, sourceBtn);
      if(usedPageEngine) return;

      const html2pdfFactory = (typeof window.html2pdf === 'function')
        ? window.html2pdf
        : (typeof window.html2pdf?.default === 'function' ? window.html2pdf.default : null);
      if(!html2pdfFactory){
        window.alert('מנוע ה-PDF עדיין לא נטען. רענן את המערכת ונסה שוב.');
        return;
      }

      const triggerBtn = sourceBtn || this.els.reportPrint || this.els.btnDownloadOpsFile || null;
      const originalText = triggerBtn ? triggerBtn.textContent : '';
      if(triggerBtn){
        triggerBtn.disabled = true;
        triggerBtn.textContent = 'מייצא PDF...';
      }

      let host = null;
      try{
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const payload = this.normalizeOperationalReportPayload(payloadOverride || this.getOperationalPayload());
        const filename = this.getOperationalPdfFileName(payload);
        const pack = this.buildOperationalPdfMarkup(payload, { forPreview:false });
        if(!pack?.html) throw new Error('Operational PDF markup was not created');

        const A4_WIDTH_PX = 794;
        host = document.createElement('div');
        host.className = 'lcPdfExportHost';
        host.setAttribute('dir','rtl');
        host.setAttribute('aria-hidden', 'true');
        host.style.position = 'fixed';
        host.style.top = '0';
        host.style.left = '-20000px';
        host.style.width = A4_WIDTH_PX + 'px';
        host.style.minWidth = A4_WIDTH_PX + 'px';
        host.style.maxWidth = A4_WIDTH_PX + 'px';
        host.style.padding = '8px 0';
        host.style.margin = '0';
        host.style.background = '#ffffff';
        host.style.opacity = '1';
        host.style.visibility = 'visible';
        host.style.pointerEvents = 'none';
        host.style.zIndex = '-1';
        host.style.overflow = 'visible';
        host.innerHTML = pack.html;
        document.body.appendChild(host);

        if(document.fonts?.ready){
          try { await document.fonts.ready; } catch(_fontErr) {}
        }
        await this.waitForImages(host);
        await new Promise((resolve) => window.setTimeout(resolve, 180));

        const worker = html2pdfFactory().set({
          margin: [0, 0, 0, 0],
          filename,
          image: { type:'jpeg', quality:0.98 },
          html2canvas: {
            scale: 1.7,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: A4_WIDTH_PX
          },
          jsPDF: { unit:'pt', format:'a4', orientation:'portrait', compress:true },
          pagebreak: { mode:['css','legacy'], after:'.lcPdfPageBreak' }
        }).from(host.querySelector('.lcPdfRoot'));

        await worker.save();
      }finally{
        if(host && host.parentNode) host.parentNode.removeChild(host);
        if(triggerBtn){
          triggerBtn.disabled = false;
          triggerBtn.textContent = originalText || 'הורד PDF דוח תפעולי';
        }
      }
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



  const NewCustomerEntryUI = {
    els: {},
    statusTimer: null,
    init(){
      this.els.btnOpen = document.getElementById("btnNewCustomerWizard");
      this.els.modal = document.getElementById("lcNewCustomerTypeModal");
      this.els.btnClose = document.getElementById("lcNewCustomerTypeModalClose");
      this.els.status = document.getElementById("lcNewCustomerTypeStatus");
      if(!this.els.btnOpen || !this.els.modal) return;

      on(this.els.btnOpen, "click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if(!Auth.current) return;
        this.open();
      });

      on(this.els.btnClose, "click", (ev) => {
        ev.preventDefault();
        this.close();
      });

      on(this.els.modal, "click", (ev) => {
        const t = ev.target;
        if(t && t.getAttribute && t.getAttribute("data-close") === "1"){
          this.close();
          return;
        }
        const card = t && t.closest ? t.closest("[data-new-customer-type]") : null;
        if(!card) return;
        const type = safeTrim(card.getAttribute("data-new-customer-type"));
        this.handleType(type);
      });

      document.addEventListener("keydown", (ev) => {
        if(ev.key === "Escape" && this.isOpen()) this.close();
      });
    },
    isOpen(){
      return !!this.els.modal && this.els.modal.classList.contains("is-open");
    },
    open(){
      try{ LeadShellUI?.close?.(); }catch(_e){}
      try{ Wizard?.close?.(); }catch(_e){}
      try{
        document.querySelectorAll('.modal.is-open, .drawer.is-open').forEach((el) => {
          if(el !== this.els.modal) el.classList.remove('is-open');
        });
      }catch(_e){}
      this.clearStatus();
      this.els.modal.classList.add("is-open");
      this.els.modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    },
    close(){
      if(!this.els.modal) return;
      this.clearStatus();
      this.els.modal.classList.remove("is-open");
      this.els.modal.setAttribute("aria-hidden", "true");
      const hasOtherOpenModal = !!document.querySelector('.modal.is-open, .drawer.is-open, .lcWizard.is-open');
      if(!hasOtherOpenModal) document.body.classList.remove("modal-open");
    },
    clearStatus(){
      if(this.statusTimer){
        window.clearTimeout(this.statusTimer);
        this.statusTimer = null;
      }
      if(this.els.status){
        this.els.status.classList.remove("is-visible", "is-dev", "is-ready");
        this.els.status.textContent = "";
      }
    },
    showStatus(message, tone = "dev"){
      if(!this.els.status) return;
      this.els.status.textContent = message || "";
      this.els.status.classList.add("is-visible");
      this.els.status.classList.toggle("is-dev", tone === "dev");
      this.els.status.classList.toggle("is-ready", tone === "ready");
      if(tone === "dev"){
        this.statusTimer = window.setTimeout(() => this.clearStatus(), 2400);
      }
    },
    handleType(type){
      if(type === "health"){
        this.showStatus("פותח את וויזארד בריאות וסיכונים…", "ready");
        window.setTimeout(() => {
          this.close();
          try{
            prepareInteractiveWizardOpen();
            Wizard.reset();
            Wizard.open();
          }catch(err){
            console.error("NEW_CUSTOMER_HEALTH_OPEN_FAILED:", err);
            this.showStatus("אירעה תקלה בפתיחת הוויזארד", "dev");
          }
        }, 140);
        return;
      }
      if(type === "elementary"){
        this.showStatus("אלמנטרי — תהליך בפיתוח", "dev");
        return;
      }
      if(type === "pension"){
        this.showStatus("פנסיה — תהליך בפיתוח", "dev");
      }
    }
  };

  const LeadShellUI = {
    AUTO_CLOSE_MS: 3200,
    els: {},
    autoCloseHandle: null,
    init(){
      this.els.btnOpen = document.getElementById("btnOpenLeadShell");
      this.els.modal = document.getElementById("lcLeadShell");
      this.els.btnClose = document.getElementById("btnCloseLeadShell");
      if(!this.els.btnOpen || !this.els.modal) return;
      on(this.els.btnOpen, "click", (ev) => { ev.preventDefault(); ev.stopPropagation(); this.open(); });
      on(this.els.btnClose, "click", (ev) => { ev.preventDefault(); this.close(); });
      on(this.els.modal, "click", (ev) => {
        const closeHit = ev.target && (ev.target.dataset?.close === "1" || ev.target.classList?.contains("lcLeadShell__backdrop"));
        if(closeHit) this.close();
      });
      document.addEventListener("keydown", (ev) => {
        if(ev.key === "Escape" && this.isOpen()) this.close();
      });
    },
    isOpen(){
      return !!this.els.modal && this.els.modal.classList.contains("is-open");
    },
    startAutoClose(){
      this.stopAutoClose();
      this.autoCloseHandle = window.setTimeout(() => this.close(), this.AUTO_CLOSE_MS);
    },
    stopAutoClose(){
      if(this.autoCloseHandle){
        window.clearTimeout(this.autoCloseHandle);
        this.autoCloseHandle = null;
      }
    },
    open(){
      try{ if(window.Wizard && typeof Wizard.close === "function") Wizard.close(); }catch(_e){}
      try{ document.querySelectorAll('.modal.is-open, .drawer.is-open').forEach((el) => { if(el !== this.els.modal) el.classList.remove('is-open'); }); }catch(_e){}
      if(!this.els.modal) return;
      this.stopAutoClose();
      this.els.modal.classList.add("is-open");
      this.els.modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open", "lcLeadShellOpen");
      this.startAutoClose();
    },
    close(){
      if(!this.els.modal) return;
      this.stopAutoClose();
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
        const expiresAt = SUPABASE_CHAT.retentionMode === 'midnight'
          ? nextMidnightISO()
          : new Date(Date.now() + this.retentionMs).toISOString();
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
  CustomerEditUI.init();
  ArchiveCustomerUI.init();
  MirrorsUI.init();
  ProcessesUI.init();
  OpsEventsUI.init();
  Wizard.init();
  SystemRepairUI.init();
  NewCustomerEntryUI.init();
  LeadShellUI.init();
  ChatUI.init();
  InactivityGuard.init();
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
