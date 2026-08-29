/* GI-ASSISTANT — pairing, Realtime voice, engine, tools, CRM, and simulator wraps (P3–P12).
   Compiled from gi-assistant.ts. Do not edit by hand. */
(() => {
  "use strict";
  const PAIRING_STORAGE_KEY = "gi_assistant_device_paired_v1";
  const DEVICE_STORAGE_KEY = "gi_assistant_device_v1";
  const ROOT_ID = "giAsstRoot";
  const FN_PAIRING_PATH = "/functions/v1/gi-assistant-pairing";
  const FN_REALTIME_PATH = "/functions/v1/gi-assistant-realtime";
  const FN_ENGINE_PATH = "/functions/v1/gi-assistant-engine";
  const FN_TOOLS_PATH = "/functions/v1/gi-assistant-tools";
  const OPENAI_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
  const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
  const POLL_MS = 1600;
  const COMMAND_POLL_MS = 120;
  const UI_COMMANDS = /* @__PURE__ */ new Set([
    "open_customer",
    "go_view",
    "open_simulator",
    "open_proposal",
    "open_wizard",
    "refresh_reminders",
    "upsert_reminder",
    "mark_task_done",
    "fill_wizard",
    "wizard_next",
    "open_har_import",
    "click_topbar"
  ]);
  let bridge = {};
  let bound = false;
  let pairing = null;
  let voice = {
    state: "idle",
    sessionId: "",
    pin: "",
    pc: null,
    dc: null,
    stream: null,
    audio: null,
    error: "",
    recognition: null
  };
  let pendingAction = null;
  let timelineItems = [];
  let lastIntent = "";
  let commandPoll = 0;
  let utteranceBusy = false;
  let lastHeard = "";
  let pairingFreshPhone = false;
  let lastCustomerId = "";
  let lastCustomerName = "";
  let conversationLive = false;
  let liveMenuOpen = false;
  function trim(value) {
    return String(value == null ? "" : value).trim();
  }
  function $(id) {
    return document.getElementById(id);
  }
  function readBridge() {
    try {
      const fromWindow = window.__GI_ASSISTANT_BRIDGE__;
      if (fromWindow && typeof fromWindow === "object") return { ...fromWindow, ...bridge };
    } catch (_e) {
    }
    return bridge;
  }
  function getAuth() {
    const active = readBridge();
    try {
      if (typeof active.getCurrentAgent === "function") {
        const agent = active.getCurrentAgent();
        if (agent && (trim(agent.id) || trim(agent.name))) return agent;
      }
    } catch (_e) {
    }
    try {
      if (typeof active.getAuth === "function") return active.getAuth() || null;
    } catch (_e2) {
    }
    return null;
  }
  function isLoggedIn() {
    const auth = getAuth();
    return !!(auth && (trim(auth.id) || trim(auth.name)));
  }
  function canAccessPersonalAssistant() {
    try {
      const active = readBridge();
      if (typeof active.canAccessPersonalAssistant === "function") {
        return !!active.canAccessPersonalAssistant();
      }
    } catch (_e) {
    }
    return false;
  }
  function isPhonePage() {
    var _a;
    try {
      return ((_a = document.body) == null ? void 0 : _a.getAttribute("data-gi-asst-page")) === "phone";
    } catch (_e) {
      return false;
    }
  }
  function supabaseConfig() {
    const active = readBridge();
    return {
      url: trim(active.supabaseUrl) || FALLBACK_SUPABASE_URL,
      key: trim(active.publishableKey) || FALLBACK_PUBLISHABLE_KEY
    };
  }
  function readLocalPairing() {
    try {
      const raw = window.localStorage.getItem(PAIRING_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_e) {
      return null;
    }
  }
  function writeLocalPairing(agentId) {
    try {
      window.localStorage.setItem(PAIRING_STORAGE_KEY, JSON.stringify({
        paired: true,
        agentId: trim(agentId),
        at: (/* @__PURE__ */ new Date()).toISOString()
      }));
    } catch (_e) {
    }
  }
  function readDevice() {
    try {
      const raw = window.localStorage.getItem(DEVICE_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_e) {
      return null;
    }
  }
  function writeDevice(row) {
    try {
      window.localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify({
        devicePublicId: trim(row.devicePublicId),
        deviceSecret: trim(row.deviceSecret),
        agentId: trim(row.agentId),
        at: (/* @__PURE__ */ new Date()).toISOString()
      }));
    } catch (_e) {
    }
  }
  function hasActiveDevicePairing() {
    const device = readDevice();
    if (device && trim(device.devicePublicId) && trim(device.deviceSecret)) return true;
    if (!isLoggedIn()) return false;
    const parsed = readLocalPairing();
    const auth = getAuth();
    const agentId = trim(auth == null ? void 0 : auth.id) || trim(auth == null ? void 0 : auth.name);
    if (!parsed || parsed.paired !== true) return false;
    if (agentId && trim(parsed.agentId) && trim(parsed.agentId) !== agentId) return false;
    return true;
  }
  function phoneEntryUrl(publicToken) {
    const url = new URL("assistant.html", window.location.href);
    url.searchParams.set("p", trim(publicToken));
    return url.href;
  }
  function phoneHomeUrl() {
    return new URL("assistant.html", window.location.href).href;
  }
  function stripPhoneTokenFromUrl() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("p")) return;
      url.search = "";
      window.history.replaceState({}, "", url.pathname + url.hash);
    } catch (_e) {
    }
  }
  function qrImageUrl(text, provider) {
    const data = encodeURIComponent(text);
    if (provider === "quickchart") return "https://quickchart.io/qr?size=220&margin=1&text=" + data;
    return "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=1&data=" + data;
  }
  function paintQr(host, href) {
    host.innerHTML = "";
    const img = document.createElement("img");
    img.alt = "QR \u05DC\u05D7\u05D9\u05D1\u05D5\u05E8 \u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9";
    img.width = 220;
    img.height = 220;
    img.className = "giAsst__qrImg";
    img.src = qrImageUrl(href, "qrserver");
    img.onerror = function() {
      img.onerror = null;
      img.src = qrImageUrl(href, "quickchart");
    };
    host.appendChild(img);
    const link = document.createElement("a");
    link.className = "giAsst__qrLink";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "\u05E4\u05EA\u05D9\u05D7\u05D4 \u05D1\u05D8\u05DC\u05E4\u05D5\u05DF";
    host.appendChild(link);
  }
  async function callEdge(fnPath, payload) {
    const cfg = supabaseConfig();
    const res = await fetch(cfg.url.replace(/\/+$/, "") + fnPath, {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: cfg.key,
        Authorization: "Bearer " + cfg.key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload || {})
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_e) {
      data = {};
    }
    if (!res.ok || data.ok === false) {
      const code = trim(data.error || data.code || "HTTP_" + res.status);
      const err = new Error(code || "HTTP_" + res.status);
      err.code = code || "HTTP_" + res.status;
      throw err;
    }
    return data;
  }
  function callPairing(payload) {
    return callEdge(FN_PAIRING_PATH, payload);
  }
  function callRealtime(payload) {
    return callEdge(FN_REALTIME_PATH, payload);
  }
  function callEngine(payload) {
    return callEdge(FN_ENGINE_PATH, payload);
  }
  function callTools(payload) {
    return callEdge(FN_TOOLS_PATH, payload);
  }
  function redactSafe(text) {
    return trim(text).replace(/\d{8,9}/g, "[\u05DE\u05D6\u05D4\u05D4]").slice(0, 280);
  }
  function classifyIntent(text) {
    const normalized = trim(text).replace(/[!.?,]/g, "");
    if (/^(כן|בטח|אשרי?|תאשר|מאשר|יאללה|קדימה)$/.test(normalized)) return "confirm";
    if (/^(לא|בטל|ביטול|אל תאשר|לא לאשר)$/.test(normalized)) return "cancel";
    return "other";
  }
  const LOCAL_VOICE_HELP = "\u05D0\u05E4\u05E9\u05E8 \u05DC\u05DE\u05DC\u05D0 \u05D0\u05EA \u05D4\u05D0\u05E9\u05E3 \u05DC\u05E4\u05D9 \u05EA\u05D5\u05D5\u05D9\u05EA. \u05DC\u05D3\u05D5\u05D2\u05DE\u05D4: \u05E9\u05DD \u05E4\u05E8\u05D8\u05D9 \u05D0\u05D5\u05E8\u05D9\u05D4, \u05E9\u05DD \u05DE\u05E9\u05E4\u05D7\u05D4 \u05E1\u05D5\u05DE\u05DA, \u05EA\u05D6, \u05D8\u05DC\u05E4\u05D5\u05DF, \u05DB\u05EA\u05D5\u05D1\u05EA, \u05E2\u05D9\u05E8, \u05D5\u05DE\u05D9\u05D9\u05DC. \u05DB\u05E9\u05D4\u05E9\u05DC\u05D1 \u05DE\u05DC\u05D0, \u05D0\u05DE\u05E8\u05D5 \u05EA\u05E2\u05D1\u05E8\u05D9 \u05DC\u05E9\u05DC\u05D1 \u05D4\u05D1\u05D0. \u05D1\u05E9\u05DC\u05D1 \u05D4\u05E4\u05D5\u05DC\u05D9\u05E1\u05D5\u05EA, \u05D0\u05DE\u05E8\u05D5 \u05EA\u05E4\u05EA\u05D7\u05D9 \u05D0\u05EA \u05D4\u05E4\u05E7 \u05D1\u05D9\u05D8\u05D5\u05D7\u05D9\u05DD \u05DE\u05D4\u05E8 \u05D4\u05D1\u05D9\u05D8\u05D5\u05D7.";
  const PHONE_SHORT_HELP = "\u05D0\u05DE\u05E8\u05D5 \u05E4\u05E7\u05D5\u05D3\u05D4 \u05E7\u05E6\u05E8\u05D4, \u05DC\u05DE\u05E9\u05DC \u05E4\u05EA\u05D7 \u05EA\u05D9\u05E7 \u05D0\u05D5 \u05DC\u05E9\u05DC\u05D1 \u05D4\u05D1\u05D0.";
  const PHONE_DONE_ACK = "\u05D1\u05D5\u05E6\u05E2.";
  function extractCompany(text) {
    const companies = ["\u05D4\u05E4\u05E0\u05D9\u05E7\u05E1", "\u05DE\u05E0\u05D5\u05E8\u05D4", "\u05D4\u05DB\u05E9\u05E8\u05D4", "\u05DE\u05D2\u05D3\u05DC", "\u05D0\u05D9\u05D9\u05DC\u05D5\u05DF", "\u05DB\u05DC\u05DC"];
    for (let i = 0; i < companies.length; i += 1) {
      if (text.indexOf(companies[i]) >= 0) return companies[i];
    }
    return "";
  }
  function extractProduct(text) {
    if (/ריסק\s*משכנתא/.test(text)) return "\u05E8\u05D9\u05E1\u05E7 \u05DE\u05E9\u05DB\u05E0\u05EA\u05D0";
    if (/מחלות\s*קשות/.test(text)) return "\u05DE\u05D7\u05DC\u05D5\u05EA \u05E7\u05E9\u05D5\u05EA";
    if (/מוות\s*מתאונה/.test(text)) return "\u05DE\u05D5\u05D5\u05EA \u05DE\u05EA\u05D0\u05D5\u05E0\u05D4";
    if (/נכות\s*מתאונה/.test(text)) return "\u05E0\u05DB\u05D5\u05EA \u05DE\u05EA\u05D0\u05D5\u05E0\u05D4";
    if (/סרטן/.test(text)) return "\u05E1\u05E8\u05D8\u05DF";
    if (/בריאות/.test(text)) return "\u05D1\u05E8\u05D9\u05D0\u05D5\u05EA";
    if (/ריסק/.test(text)) return "\u05E8\u05D9\u05E1\u05E7";
    return "";
  }
  function extractView(text) {
    if (/ממתינים\s*לטיפול/.test(text)) return "elementaryPending";
    if (/לקוחות\s*בטיפול|תפעול\s*וחיתום/.test(text)) return "agentElementaryTracking";
    if (/הצעות\s*אלמנטרי/.test(text)) return "elementaryProposals";
    if (/שיקוף\s*שיחה\s*אלמנטרי/.test(text)) return "elementaryMirror";
    if (/שיוכי\s*שיקוף/.test(text)) return "mirrorAssignments";
    if (/שיחת\s*שיקוף/.test(text)) return "mirrorCall";
    if (/מערכת\s*לידים/.test(text)) return "campaignLeads";
    if (/הלידים\s*שלי/.test(text)) return "campaignMyLeads";
    if (/ניהול\s*משתמשים|משתמשים/.test(text)) return "users";
    if (/הגדרות/.test(text)) return "settings";
    if (/הצוות|הצוות שלי/.test(text)) return "myTeam";
    if (/דוח|דוחות/.test(text)) return "reportsHub";
    if (/מסך\s*ההצעות|מסך\s*הצעות|להצעות|ההצעות|הצעות/.test(text)) return "proposals";
    if (/סימול/.test(text) && !extractCompany(text) || /כלים/.test(text)) return "myTools";
    if (/לוח|ראשי|דשבורד/.test(text)) return "dashboard";
    if (/מכירות/.test(text)) return "dailySales";
    if (/אנשי\s*קשר|קשרים/.test(text)) return "contacts";
    if (/תהליכ/.test(text)) return "myProcesses";
    if (/לקוח|תיק/.test(text)) return "customers";
    return "";
  }
  function looksLikeIdNumber(value) {
    const digits = String(value || "").replace(/\D/g, "");
    return /^\d{8,9}$/.test(digits);
  }
  function looksLikePhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (/^972\d{8,9}$/.test(digits)) return true;
    return /^0\d{8,9}$/.test(digits) || /^\d{9,10}$/.test(digits) && !looksLikeIdNumber(digits);
  }
  function isSpokenQuestion(text) {
    const raw = trim(text);
    if (!raw) return false;
    if (/[?]/.test(raw)) return true;
    return /^(?:מה|מי|כמה|איפה|מתי|למה|האם|אפשר\s+לשאול)|(?:מה\s+(?:חסר|נשאר|צריך|סטטוס)|חסר\s+(?:לי|כאן|בשלב)|מה\s+בשלב)/.test(raw);
  }
  function extractTopbar(text) {
    if (/צאט|צ.אט/.test(text)) return "giChatFab";
    if (/תזכורות/.test(text)) return "giReminderFab";
    if (/נסיעות/.test(text)) return "btnTravelInsuranceAbroad";
    if (/רכב\s*בקליק|ביטוח\s*רכב/.test(text)) return "btnCarInsuranceClick";
    if (/מרכז\s*הסימול/.test(text)) return "btnSimulatorsCenter";
    if (/הקמת\s*הצעה|הצעה\s*חדשה/.test(text)) return "btnNewCustomerWizard";
    return "";
  }
  function isOpenNavSpeech(text) {
    return /(?:עבור|תעבור|עברי|תעברי|לך|לכי|תיכנסי?|היכנסי?|כנסי|פתח|תפתח|תפתחי|תפתחו|תצפתחי)/.test(text);
  }
  function extractFillFields(text) {
    const raw = trim(text).replace(/[!,?״"']/g, " ").replace(/\s+/g, " ");
    if (!raw) return null;
    const labels = [
      { key: "firstName", re: /שם\s*פרטי/g },
      { key: "lastName", re: /שם(?:פ)?\s*משפחה/g },
      { key: "idIssueDate", re: /תאריך\s*הנפקה|הנפקת\s*תעודת זהות|הנפקת\s*תז/g },
      { key: "idNumber", re: /תעודת זהות|(?:^|\s)תז(?=\s|$)/g },
      { key: "phone", re: /טלפון|נייד|פלאפון/g },
      { key: "email", re: /מייל|אימייל|דואל/g },
      { key: "birthDate", re: /תאריך\s*לידה|נולד(?:ה)?/g },
      { key: "street", re: /כתובת(?:\s*מגורים)?|רחוב/g },
      { key: "houseNumber", re: /מספר\s*בית/g },
      { key: "apartment", re: /דירה/g },
      { key: "zip", re: /מיקוד/g },
      { key: "city", re: /עיר|יישוב/g },
      { key: "occupation", re: /עיסוק|מקצוע/g },
      { key: "maritalStatus", re: /מצב\s*משפחתי/g },
      { key: "clinic", re: /קופת\s*חולים/g },
      { key: "shaban", re: /שבן/g },
      { key: "smokingType", re: /סוג\s*עישון/g }
    ];
    const hits = [];
    labels.forEach((row) => {
      row.re.lastIndex = 0;
      let match = row.re.exec(raw);
      while (match) {
        hits.push({ key: row.key, start: match.index, end: match.index + match[0].length });
        match = row.re.exec(raw);
      }
    });
    const filtered = hits.filter((hit) => {
      if (hit.key !== "idNumber") return true;
      return !hits.some((other) => other.key === "idIssueDate" && hit.start >= other.start && hit.start < other.end);
    });
    filtered.sort((a, b) => a.start - b.start);
    const fields = {};
    filtered.forEach((hit, i) => {
      const stop = i + 1 < filtered.length ? filtered[i + 1].start : raw.length;
      let value = trim(raw.slice(hit.end, stop));
      if (!value) return;
      if (hit.key === "idNumber" || hit.key === "phone" || hit.key === "zip" || hit.key === "houseNumber") {
        value = value.replace(/\D/g, "");
      }
      if (value) fields[hit.key] = value;
    });
    const ageMatch = raw.match(/גיל\s*(\d{1,2})/);
    if (ageMatch) fields.age = Number(ageMatch[1]);
    if (/לא מעשן/.test(raw)) fields.smoker = false;
    else if (/מעשן/.test(raw)) fields.smoker = true;
    if (/אישה|נקבה/.test(raw)) fields.gender = "female";
    else if (/גבר|זכר/.test(raw)) fields.gender = "male";
    if (!fields.maritalStatus) {
      if (/ידוע(?:ה)?\s*בציבור/.test(raw)) fields.maritalStatus = "\u05D9\u05D3\u05D5\u05E2/\u05D4 \u05D1\u05E6\u05D9\u05D1\u05D5\u05E8";
      else if (/אלמנ/.test(raw)) fields.maritalStatus = "\u05D0\u05DC\u05DE\u05DF/\u05D4";
      else if (/גרוש/.test(raw)) fields.maritalStatus = "\u05D2\u05E8\u05D5\u05E9/\u05D4";
      else if (/נשוי|נשואה/.test(raw)) fields.maritalStatus = "\u05E0\u05E9\u05D5\u05D9/\u05D0\u05D4";
      else if (/רווק/.test(raw)) fields.maritalStatus = "\u05E8\u05D5\u05D5\u05E7/\u05D4";
    }
    if (!fields.clinic) {
      if (/כללית/.test(raw)) fields.clinic = "\u05DB\u05DC\u05DC\u05D9\u05EA";
      else if (/מכבי/.test(raw)) fields.clinic = "\u05DE\u05DB\u05D1\u05D9";
      else if (/מאוחדת/.test(raw)) fields.clinic = "\u05DE\u05D0\u05D5\u05D7\u05D3\u05EA";
      else if (/לאומית/.test(raw)) fields.clinic = "\u05DC\u05D0\u05D5\u05DE\u05D9\u05EA";
      else if (/צהל/.test(raw)) fields.clinic = "\u05E7\u05D5\u05E4\u05D4 \u05E6\u05D4\u05DC\u05D9\u05EA";
    }
    if (fields.smoker === true && !fields.smokingType) {
      if (/סיגריה אלקטרונית/.test(raw)) fields.smokingType = "\u05E1\u05D9\u05D2\u05E8\u05D9\u05D4 \u05D0\u05DC\u05E7\u05D8\u05E8\u05D5\u05E0\u05D9\u05EA";
      else if (/קנאביס/.test(raw)) fields.smokingType = "\u05E7\u05E0\u05D0\u05D1\u05D9\u05E1";
      else if (/נרגילה/.test(raw)) fields.smokingType = "\u05E0\u05E8\u05D2\u05D9\u05DC\u05D4";
      else if (/טבק/.test(raw)) fields.smokingType = "\u05D8\u05D1\u05E7";
      else if (/סיגריות/.test(raw)) fields.smokingType = "\u05E1\u05D9\u05D2\u05E8\u05D9\u05D5\u05EA";
    }
    const amountMatch = raw.match(/כמות(?:\s*ליום)?\s+(\d{1,3})/);
    if (amountMatch) fields.smokingAmount = amountMatch[1];
    const company = extractCompany(raw);
    if (company) fields.company = company;
    const product = extractProduct(raw);
    if (product) fields.product = product;
    const sumMatch = raw.match(/סכום\s+(\d[\d,]{3,})/);
    if (sumMatch) fields.sumInsured = Number(String(sumMatch[1]).replace(/,/g, ""));
    return Object.keys(fields).length ? fields : null;
  }
  function parseLocalCommand(text) {
    const raw = trim(text).replace(/[!.?,״"']/g, " ").replace(/\s+/g, " ");
    if (!raw) return null;
    if (classifyIntent(raw) !== "other") return null;
    if (/^(עזרה|מה אתה יכול|מה אפשר)/.test(raw)) {
      return { kind: "help", say: isPhonePage() ? PHONE_SHORT_HELP : LOCAL_VOICE_HELP };
    }
    if (/(חפש|תחפש|מצא|תמצא|חיפוש)/.test(raw)) {
      const query = raw.replace(/^(?:אפשר\s+)?(?:בבקשה\s+)?(?:חפש|תחפש|מצא|תמצא|חיפוש)\s+(?:לי\s+)?(?:את\s+)?(?:לקוח\s+)?(?:תיק\s+)?/, "");
      return { tool: "search_customer", args: { query: query || raw } };
    }
    if (/המשך\s*עריכ/.test(raw)) {
      const query = raw.replace(/^.*?(?:המשך\s*עריכה?)\s*(?:של\s+|עבור\s+|ל)?/u, "").replace(/\s+(?:בבקשה|תודה)$/, "");
      const args = {};
      if (query && query !== raw) args.query = query;
      else if (lastCustomerName) args.query = lastCustomerName;
      else if (lastCustomerId) args.customerId = lastCustomerId;
      return { tool: "create_proposal", args };
    }
    if (/(?:פתח|תפתח|תפתחי)\s+(?:את\s+)?(?:ה)?(?:תיק|לקוח)(?!\S)/.test(raw) || /(?:תיק|לקוח)\s+(?:לפי\s+)?(?:תעודת\s*זהות|תז|מספר\s*זהות|טלפון|נייד)/.test(raw) || /^[\d\s\-()+]+$/.test(raw) && (looksLikeIdNumber(raw) || looksLikePhone(raw))) {
      let query = raw.replace(/^.*?(?:התיק|תיק|לקוח)\s+(?:של\s+|לפי\s+)?(?:תעודת\s*זהות\s+|תז\s+|מספר\s*זהות\s+|טלפון\s+|נייד\s+)?/, "").replace(/\s+(?:בבקשה|תודה)$/, "");
      const digits = raw.replace(/\D/g, "");
      if ((!query || query === raw) && digits && /^[\d\s\-()+]+$/.test(raw)) query = digits;
      if (looksLikeIdNumber(query) || looksLikePhone(query)) query = query.replace(/\D/g, "");
      return { tool: "find_customer_by_id", args: { query: query || raw } };
    }
    if (/תזכיר לי|(צור|הוסף|תפתח).*(משימה|תזכורת)/.test(raw)) {
      const details = raw.replace(/^.*?(?:משימה|תזכורת|תזכיר לי)\s*/, "") || raw;
      return { tool: "create_task", args: { type: "\u05EA\u05D6\u05DB\u05D5\u05E8\u05EA", details } };
    }
    if (/משימות/.test(raw) || /תזכורות/.test(raw) && !isOpenNavSpeech(raw)) return { tool: "get_tasks", args: {} };
    if (/(?:תעברי?|תעבור|עברי|עבור|לכי|לך|המשיכי|המשך)\s+(?:ל)?שלב\s+הבא|שלב הבא|לשלב הבא|הבא באשף/.test(raw)) {
      return { tool: "wizard_next", args: {} };
    }
    if (/(?:תפתח|פתח|תפתחי|העלי|תעלה|תעלה\s+קובץ|העלה\s+קובץ).*(?:הר הביטוח|הפק\s*ביטוח|הפק\s*פוליס)|הפק\s*(?:ביטוחים|פוליסות)\s*מהר|קובץ\s+(?:הר|מהר)\s*הביטוח|מהמחשב.*(?:הר|הפק)/.test(raw)) {
      return { tool: "open_har_import", args: {} };
    }
    if (isOpenNavSpeech(raw)) {
      const topbar = extractTopbar(raw);
      if (topbar) return { tool: "click_topbar", args: { id: topbar } };
      const view = extractView(raw);
      if (view) return { tool: "go_view", args: { view } };
    }
    if (/מחיר|ציטוט|פרמיה|כמה עולה/.test(raw)) {
      const args = {
        company: extractCompany(raw) || "\u05DE\u05E0\u05D5\u05E8\u05D4",
        product: extractProduct(raw) || "\u05E8\u05D9\u05E1\u05E7"
      };
      const ageMatch = raw.match(/גיל\s*(\d{1,2})/);
      if (ageMatch) args.age = Number(ageMatch[1]);
      const sumMatch = raw.match(/(\d[\d,]{3,})/);
      if (sumMatch) args.sumInsured = Number(String(sumMatch[1]).replace(/,/g, ""));
      if (/לא מעשן/.test(raw)) args.smoker = false;
      else if (/מעשן/.test(raw)) args.smoker = true;
      if (/גבר|זכר/.test(raw)) args.gender = "male";
      if (/אישה|נקבה/.test(raw)) args.gender = "female";
      return { tool: "get_insurance_price", args };
    }
    if (/סימולטור/.test(raw) || extractCompany(raw) && extractProduct(raw) && /פתח/.test(raw)) {
      const company = extractCompany(raw);
      const product = extractProduct(raw) || "\u05E8\u05D9\u05E1\u05E7";
      if (company) return { tool: "open_simulator", args: { company, product } };
    }
    if (/(הקם|הקימי|צור|תפתח|תפתחי|פתח|בנה).*(הצעה)|הצעה חדשה|הצעה ל/.test(raw)) {
      const query = raw.replace(/^.*?(?:הצעה(?:\s+חדשה)?)\s*(?:ל|עבור|של)?\s*/, "");
      const args = {};
      if (query && query !== raw) args.query = query;
      const company = extractCompany(raw);
      const product = extractProduct(raw);
      if (company) args.company = company;
      if (product) args.product = product;
      return { tool: "create_proposal", args };
    }
    const fill = extractFillFields(text);
    if (fill && (fill.firstName || fill.lastName || fill.idNumber || fill.street || fill.phone || fill.city || fill.email || fill.birthDate || fill.maritalStatus || fill.clinic || fill.occupation || fill.age != null || /(מלא|רשום|עדכן|באשף|בהצעה|מעשן)/.test(raw) || extractCompany(raw) || extractProduct(raw))) {
      return { tool: "fill_wizard", args: fill };
    }
    if (/ייצור|תיקים החודש|הפקות/.test(raw)) {
      return { tool: /צוות/.test(raw) ? "get_team_production" : "get_monthly_production", args: {} };
    }
    if (/^(היי|שלום|תודה|בוקר טוב|ערב טוב)$/.test(raw)) {
      return { kind: "help", say: isPhonePage() ? PHONE_SHORT_HELP : LOCAL_VOICE_HELP };
    }
    if (isPhonePage() && !isSpokenQuestion(raw)) {
      return { kind: "help", say: PHONE_SHORT_HELP };
    }
    return { kind: "help", say: LOCAL_VOICE_HELP };
  }
  function engineAuthPayload() {
    const device = readDevice();
    const auth = getAuth();
    const payload = { sessionId: trim(voice.sessionId) };
    if (device && trim(device.devicePublicId) && trim(device.deviceSecret)) {
      payload.devicePublicId = trim(device.devicePublicId);
      payload.deviceSecret = trim(device.deviceSecret);
    } else {
      payload.agentId = trim(auth == null ? void 0 : auth.id);
      payload.agentName = trim(auth == null ? void 0 : auth.name);
      payload.username = trim(auth == null ? void 0 : auth.username);
      payload.pin = trim(voice.pin);
    }
    return payload;
  }
  function pairingErrorText(code) {
    if (code === "AUTH_FAILED" || code === "MISSING_PIN") return "\u05E7\u05D5\u05D3 \u05D4\u05DB\u05E0\u05D9\u05E1\u05D4 \u05E9\u05D2\u05D5\u05D9.";
    if (code === "TOKEN_INVALID") return "\u05E7\u05D5\u05D3 \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8 \u05D4\u05D7\u05D3\u05BE\u05E4\u05E2\u05DE\u05D9 \u05DB\u05D1\u05E8 \u05E0\u05D5\u05E6\u05DC. \u05E4\u05EA\u05D7\u05D5 \u05D0\u05EA \u05D4\u05D3\u05E3 \u05D4\u05E7\u05D1\u05D5\u05E2 \u05E9\u05DC \u05D4\u05E2\u05D5\u05D6\u05E8 \u05D0\u05D5 \u05D1\u05E7\u05E9\u05D5 \u05E7\u05D9\u05E9\u05D5\u05E8 \u05D7\u05D3\u05E9 \u05DE\u05D4\u05DE\u05D7\u05E9\u05D1.";
    if (code === "AGENT_MISMATCH") return "\u05D4\u05DE\u05E9\u05EA\u05DE\u05E9 \u05E9\u05D6\u05D5\u05D4\u05D4 \u05D0\u05D9\u05E0\u05D5 \u05DE\u05D9 \u05E9\u05D4\u05EA\u05D7\u05D9\u05DC \u05D0\u05EA \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8.";
    if (code === "NOT_FOUND" || code === "HTTP_404" || code.indexOf("HTTP_404") === 0) {
      return "\u05E9\u05E8\u05EA \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8 \u05E2\u05D3\u05D9\u05D9\u05DF \u05DC\u05D0 \u05E4\u05D5\u05E8\u05E1\u05DD. \u05E6\u05E8\u05D9\u05DA \u05DC\u05E4\u05E8\u05E1\u05DD \u05D1-Supabase \u05D0\u05EA gi-assistant-pairing.";
    }
    if (code === "FAILED_TO_FETCH" || code === "TypeError") return "\u05D0\u05D9\u05DF \u05D7\u05D9\u05D1\u05D5\u05E8 \u05DC\u05E9\u05E8\u05EA \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8. \u05D4\u05E8\u05D9\u05E6\u05D5 \u05D0\u05EA supabase-assistant-pairing.sql \u05D5\u05E4\u05E8\u05E1\u05D5 \u05D0\u05EA \u05D4\u05E4\u05D5\u05E0\u05E7\u05E6\u05D9\u05D4.";
    if (code === "MISSING_OPENAI_KEY") return "\u05D7\u05E1\u05E8 \u05DE\u05E4\u05EA\u05D7 OpenAI \u05D1\u05E9\u05E8\u05EA. \u05D9\u05E9 \u05DC\u05D4\u05D2\u05D3\u05D9\u05E8 \u05D0\u05EA \u05D4\u05E1\u05D5\u05D3 \u05D1-Edge secrets.";
    if (code === "OPENAI_INVALID_KEY") return "\u05DE\u05E4\u05EA\u05D7 OpenAI \u05E9\u05D2\u05D5\u05D9. \u05E6\u05E8\u05D5 \u05DE\u05E4\u05EA\u05D7 \u05D7\u05D3\u05E9 \u05D1-platform.openai.com \u05D5\u05D4\u05D7\u05DC\u05D9\u05E4\u05D5 \u05D1-Secrets.";
    if (code === "OPENAI_QUOTA") return "\u05D0\u05D9\u05DF \u05D9\u05EA\u05E8\u05D4 \u05D1\u05D7\u05E9\u05D1\u05D5\u05DF OpenAI. \u05D4\u05D5\u05E1\u05D9\u05E4\u05D5 \u05D0\u05DE\u05E6\u05E2\u05D9 \u05EA\u05E9\u05DC\u05D5\u05DD \u05D1-platform.openai.com.";
    if (code === "OPENAI_FORBIDDEN") return "\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05DC\u05D0 \u05DE\u05D5\u05E8\u05E9\u05D4 \u05DC\u05DE\u05D5\u05D3\u05DC \u05D4\u05E7\u05D5\u05DC. \u05D1\u05D3\u05E7\u05D5 \u05D2\u05D9\u05E9\u05EA Realtime \u05D1-OpenAI.";
    if (code === "OPENAI_ERROR") return "\u05E9\u05E8\u05EA \u05D4\u05E7\u05D5\u05DC \u05DC\u05D0 \u05D6\u05DE\u05D9\u05DF \u05DB\u05E8\u05D2\u05E2. \u05E0\u05E1\u05D5 \u05E9\u05D5\u05D1 \u05D1\u05E2\u05D5\u05D3 \u05E8\u05D2\u05E2.";
    if (code === "MIC_DENIED" || code === "NotAllowedError") return "\u05E0\u05D3\u05E8\u05E9\u05EA \u05D4\u05E8\u05E9\u05D0\u05EA \u05DE\u05D9\u05E7\u05E8\u05D5\u05E4\u05D5\u05DF \u05DB\u05D3\u05D9 \u05DC\u05D3\u05D1\u05E8 \u05E2\u05DD \u05D4\u05E2\u05D5\u05D6\u05E8.";
    if (code === "MIC_MISSING" || code === "NotFoundError") return "\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0 \u05DE\u05D9\u05E7\u05E8\u05D5\u05E4\u05D5\u05DF \u05D1\u05DE\u05DB\u05E9\u05D9\u05E8.";
    if (code === "SPEECH_UNSUPPORTED") return "\u05D4\u05D3\u05E4\u05D3\u05E4\u05DF \u05DC\u05D0 \u05EA\u05D5\u05DE\u05DA \u05D1\u05D3\u05D9\u05D1\u05D5\u05E8 \u05DE\u05E7\u05D5\u05DE\u05D9. \u05E4\u05EA\u05D7\u05D5 \u05D0\u05EA \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA \u05D1-Chrome.";
    return "\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9 \u05DC\u05D4\u05E9\u05DC\u05D9\u05DD \u05D0\u05EA \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8. \u05E0\u05E1\u05D5 \u05E9\u05D5\u05D1.";
  }
  function voiceStateLabel(state) {
    if (state === "connecting") return "\u05DE\u05EA\u05D7\u05D1\u05E8\u2026";
    if (state === "listening") return "\u05DE\u05E7\u05E9\u05D9\u05D1";
    if (state === "speaking") return "\u05D4\u05E2\u05D5\u05D6\u05E8 \u05DE\u05D3\u05D1\u05E8";
    if (state === "error") return voice.error || "\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9 \u05DC\u05D4\u05EA\u05D7\u05D1\u05E8 \u05DC\u05E7\u05D5\u05DC.";
    return "\u05D3\u05D1\u05E8 \u05E2\u05DD \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA";
  }
  function stopPairingPoll() {
    if (pairing == null ? void 0 : pairing.pollTimer) {
      window.clearInterval(pairing.pollTimer);
      pairing.pollTimer = 0;
    }
  }
  async function cancelPairing() {
    const secret = trim(pairing == null ? void 0 : pairing.desktopSecret);
    stopPairingPoll();
    pairing = null;
    if (!secret) return;
    try {
      await callPairing({ action: "cancel", desktopSecret: secret });
    } catch (_e) {
    }
  }
  function syncButtonVisibility() {
    const btn = $("btnPersonalAssistant");
    if (!btn) return;
    const show = isLoggedIn() && canAccessPersonalAssistant();
    btn.classList.toggle("is-hidden", !show);
    btn.setAttribute("aria-hidden", show ? "false" : "true");
    if (show) btn.removeAttribute("hidden");
    else btn.setAttribute("hidden", "hidden");
    syncTopbarLive();
  }
  function isConversationLive() {
    return conversationLive === true || voice.state === "connecting" || voice.state === "listening" || voice.state === "speaking";
  }
  function syncTopbarLive() {
    const btn = $("btnPersonalAssistant");
    if (!btn) return;
    const live = isConversationLive();
    btn.classList.toggle("is-live", live);
    btn.classList.toggle("is-active", live);
    btn.setAttribute("aria-pressed", live ? "true" : "false");
    btn.setAttribute("title", live ? "\u05E9\u05D9\u05D7\u05D4 \u05E4\u05E2\u05D9\u05DC\u05D4 \u05E2\u05DD \u05D4\u05E2\u05D5\u05D6\u05E8 \u2014 \u05DC\u05D7\u05E6\u05D5 \u05DC\u05E1\u05D9\u05D5\u05DD" : "\u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9");
    if (!live) hideLiveMenu();
  }
  function ensureLiveMenu() {
    var _a;
    let menu = $("giAsstLiveMenu");
    if (menu) return menu;
    menu = document.createElement("div");
    menu.id = "giAsstLiveMenu";
    menu.className = "giAsstLiveMenu is-hidden";
    menu.setAttribute("hidden", "hidden");
    menu.innerHTML = `
      <button class="giAsstLiveMenu__btn" id="giAsstEndLive" type="button">\u05E1\u05D9\u05D9\u05DD \u05E9\u05D9\u05D7\u05D4 \u05E2\u05DD \u05D4\u05E2\u05D5\u05D6\u05E8</button>
    `;
    document.body.appendChild(menu);
    (_a = $("giAsstEndLive")) == null ? void 0 : _a.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      hideLiveMenu();
      void endLiveConversation();
    });
    document.addEventListener("click", (ev) => {
      var _a2;
      if (!liveMenuOpen) return;
      const target = ev.target;
      if ((menu == null ? void 0 : menu.contains(target)) || ((_a2 = $("btnPersonalAssistant")) == null ? void 0 : _a2.contains(target))) return;
      hideLiveMenu();
    });
    return menu;
  }
  function hideLiveMenu() {
    liveMenuOpen = false;
    const menu = $("giAsstLiveMenu");
    if (!menu) return;
    menu.classList.add("is-hidden");
    menu.setAttribute("hidden", "hidden");
  }
  function showLiveMenu() {
    const btn = $("btnPersonalAssistant");
    const menu = ensureLiveMenu();
    if (!btn || !menu) return;
    liveMenuOpen = true;
    menu.classList.remove("is-hidden");
    menu.removeAttribute("hidden");
    try {
      const rect = btn.getBoundingClientRect();
      menu.style.top = Math.round(rect.bottom + 8) + "px";
      menu.style.left = Math.round(Math.min(window.innerWidth - 220, Math.max(8, rect.left + rect.width / 2 - 100))) + "px";
    } catch (_e) {
    }
    window.setTimeout(() => {
      var _a;
      return (_a = $("giAsstEndLive")) == null ? void 0 : _a.focus();
    }, 30);
  }
  async function endLiveConversation() {
    var _a;
    hideLiveMenu();
    conversationLive = false;
    await stopVoice(true);
    syncTopbarLive();
    try {
      (_a = window.showToast) == null ? void 0 : _a.call(window, {
        title: "\u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9",
        text: "\u05D4\u05E9\u05D9\u05D7\u05D4 \u05E2\u05DD \u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05E1\u05EA\u05D9\u05D9\u05DE\u05D4.",
        variant: "ok",
        durationMs: 3200
      });
    } catch (_e) {
    }
  }
  function ensureRoot() {
    var _a, _b;
    let root = $("giAsstRoot");
    if (root) return root;
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "giAsst";
    root.innerHTML = `
      <div class="giAsst__overlay is-hidden" id="giAsstOverlay" hidden>
        <div class="giAsst__backdrop" data-gi-asst-close="1"></div>
        <section class="giAsst__panel" role="dialog" aria-modal="true" aria-labelledby="giAsstTitle">
          <header class="giAsst__head">
            <div>
              <div class="giAsst__kicker">GEMEL INVEST</div>
              <h2 class="giAsst__title" id="giAsstTitle">\u05D4\u05E4\u05E2\u05DC\u05EA \u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9</h2>
            </div>
            <button class="giAsst__close" id="giAsstClose" type="button" aria-label="\u05E1\u05D2\u05D5\u05E8">\u2715</button>
          </header>
          <div class="giAsst__body" id="giAsstBody"></div>
        </section>
      </div>
    `;
    document.body.appendChild(root);
    (_a = $("giAsstClose")) == null ? void 0 : _a.addEventListener("click", () => closeOverlay());
    (_b = root.querySelector("[data-gi-asst-close]")) == null ? void 0 : _b.addEventListener("click", () => closeOverlay());
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && isOverlayOpen()) closeOverlay();
      if (ev.key === "Escape" && liveMenuOpen) hideLiveMenu();
    });
    return root;
  }
  function isOverlayOpen() {
    const overlay = $("giAsstOverlay");
    return !!(overlay && !overlay.classList.contains("is-hidden"));
  }
  function hideOverlay() {
    const overlay = $("giAsstOverlay");
    if (!overlay) return;
    overlay.classList.add("is-hidden");
    overlay.setAttribute("hidden", "hidden");
    overlay.setAttribute("aria-hidden", "true");
  }
  function closeOverlay() {
    var _a;
    void cancelPairing();
    if (!isConversationLive()) void stopVoice();
    hideOverlay();
    (_a = $("btnPersonalAssistant")) == null ? void 0 : _a.focus();
  }
  function openOverlay() {
    ensureRoot();
    const overlay = $("giAsstOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-hidden");
    overlay.removeAttribute("hidden");
    overlay.setAttribute("aria-hidden", "false");
    window.setTimeout(() => {
      var _a;
      return (_a = $("giAsstClose")) == null ? void 0 : _a.focus();
    }, 40);
  }
  function setActivateError(msg) {
    const box = $("giAsstError");
    if (box) box.textContent = msg || "";
  }
  function paintVoiceState() {
    const root = document.querySelector(".giAsst__voice");
    if (!root) return;
    root.setAttribute("data-gi-asst-voice", voice.state);
    root.classList.remove("is-idle", "is-connecting", "is-listening", "is-speaking", "is-error");
    root.classList.add("is-" + voice.state);
    const status = root.querySelector(".giAsst__voiceStatus");
    if (status) {
      status.textContent = voiceStateLabel(voice.state);
      status.classList.toggle("is-err", voice.state === "error");
    }
    const startBtn = root.querySelector("#giAsstVoiceStart");
    const stopBtn = root.querySelector("#giAsstVoiceStop");
    const busy = voice.state === "connecting" || voice.state === "listening" || voice.state === "speaking";
    if (startBtn) {
      startBtn.hidden = busy;
      startBtn.disabled = voice.state === "connecting";
    }
    if (stopBtn) {
      stopBtn.hidden = !busy;
      stopBtn.disabled = voice.state === "connecting";
    }
    const mic = root.querySelector(".giAsst__micBtn");
    if (mic) {
      mic.classList.toggle("is-listening", voice.state === "listening");
      mic.classList.toggle("is-speaking", voice.state === "speaking");
      mic.classList.toggle("is-connecting", voice.state === "connecting");
    }
  }
  function setVoiceState(next, errorText) {
    voice.state = next;
    voice.error = next === "error" ? errorText || voice.error || "" : "";
    paintVoiceState();
    syncTopbarLive();
  }
  function voiceMarkup(includePin) {
    return `
      <div class="giAsst__voice is-idle" data-gi-asst-voice="idle">
        <button class="giAsst__micBtn" id="giAsstMicBtn" type="button" aria-label="\u05D4\u05EA\u05D7\u05DC \u05E9\u05D9\u05D7\u05D4">\u{1F399}\uFE0F</button>
        <p class="giAsst__lead giAsst__voiceStatus" id="giAsstVoiceStatus">\u05D3\u05D1\u05E8 \u05E2\u05DD \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA</p>
        ${includePin ? `
          <label class="giAsst__label" for="giAsstVoicePin">\u05E7\u05D5\u05D3 \u05D4\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DC\u05D7\u05E9\u05D1\u05D5\u05DF</label>
          <input class="giAsst__input" id="giAsstVoicePin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" />
        ` : ""}
        <div class="giAsst__voiceActions">
          <button class="giAsst__btn" id="giAsstVoiceStart" type="button">\u05D4\u05EA\u05D7\u05DC \u05E9\u05D9\u05D7\u05D4</button>
          <button class="giAsst__btn giAsst__btn--ghost" id="giAsstVoiceStop" type="button" hidden>\u05E1\u05D9\u05D9\u05DD \u05E9\u05D9\u05D7\u05D4</button>
        </div>
        <p class="giAsst__heard" id="giAsstHeard" aria-live="polite"></p>
        <form class="giAsst__talkForm" id="giAsstTalkForm">
          <label class="giAsst__label" for="giAsstTalkText">\u05D0\u05DD \u05D0\u05D9\u05DF \u05EA\u05D2\u05D5\u05D1\u05D4 \u05DC\u05E7\u05D5\u05DC \u2014 \u05DB\u05EA\u05D1\u05D5 \u05DB\u05D0\u05DF</label>
          <div class="giAsst__talkRow">
            <input class="giAsst__input" id="giAsstTalkText" type="text" enterkeyhint="send" autocomplete="off" placeholder="\u05DC\u05DE\u05E9\u05DC: \u05D7\u05E4\u05E9 \u05D3\u05D5\u05D3 \u05DC\u05D5\u05D9" />
            <button class="giAsst__btn giAsst__talkSend" id="giAsstTalkSend" type="submit">\u05E9\u05DC\u05D7</button>
          </div>
        </form>
        <div class="giAsst__confirm is-hidden" id="giAsstConfirm" hidden>
          <p class="giAsst__confirmText" id="giAsstConfirmText">\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8 \u05E4\u05E2\u05D5\u05DC\u05D4.</p>
          <div class="giAsst__confirmActions">
            <button class="giAsst__btn" id="giAsstConfirmYes" type="button">\u05DB\u05DF</button>
            <button class="giAsst__btn giAsst__btn--ghost" id="giAsstConfirmNo" type="button">\u05DC\u05D0</button>
          </div>
        </div>
        <ol class="giAsst__timeline" id="giAsstTimeline" aria-live="polite"></ol>
        <div class="giAsst__hits" id="giAsstHits" hidden></div>
        <p class="giAsst__hint">\u05D4\u05E7\u05D5\u05DC \u05DE\u05E7\u05D5\u05DE\u05D9 \u05D1\u05D3\u05E4\u05D3\u05E4\u05DF \u2014 \u05D1\u05DC\u05D9 \u05EA\u05E9\u05DC\u05D5\u05DD \u05DC\u05E1\u05E4\u05E7 \u05D7\u05D9\u05E6\u05D5\u05E0\u05D9. \u05DB\u05EA\u05D9\u05D1\u05D4 \u05D3\u05D5\u05E8\u05E9\u05EA \u05D0\u05D9\u05E9\u05D5\u05E8. \xAB\u05DB\u05DF\xBB \u05D7\u05DC \u05E8\u05E7 \u05D0\u05DD \u05D9\u05E9 \u05E4\u05E2\u05D5\u05DC\u05D4 \u05DE\u05DE\u05EA\u05D9\u05E0\u05D4.</p>
        ${isPhonePage() ? "" : `<button class="giAsst__btn giAsst__btn--ghost" id="giAsstOpenPhone" type="button">\u05E4\u05EA\u05D7 \u05E9\u05D5\u05D1 \u05D1\u05D8\u05DC\u05E4\u05D5\u05DF</button>`}
      </div>
    `;
  }
  function paintTimeline() {
    const list = $("giAsstTimeline");
    if (!list) return;
    list.innerHTML = timelineItems.slice(-20).map((item) => {
      const kind = trim(item.kind) || "info";
      return `<li class="giAsst__tl giAsst__tl--${kind}"><span>${redactSafe(item.text)}</span></li>`;
    }).join("");
    list.scrollTop = list.scrollHeight;
  }
  function paintConfirm() {
    const box = $("giAsstConfirm");
    const text = $("giAsstConfirmText");
    if (!box) return;
    if (!pendingAction) {
      box.classList.add("is-hidden");
      box.setAttribute("hidden", "hidden");
      return;
    }
    box.classList.remove("is-hidden");
    box.removeAttribute("hidden");
    if (text) text.textContent = "\u05DC\u05D0\u05E9\u05E8: " + redactSafe(pendingAction.label) + "?";
  }
  function pushTimeline(kind, text) {
    const safe = redactSafe(text);
    if (!safe) return;
    timelineItems.push({ kind, text: safe });
    paintTimeline();
  }
  function resetEngineUi() {
    pendingAction = null;
    timelineItems = [];
    lastIntent = "";
    paintConfirm();
    paintTimeline();
    paintHits([]);
  }
  function paintHits(items) {
    const box = $("giAsstHits");
    if (!box) return;
    const cards = (Array.isArray(items) ? items : []).filter((item) => item && trim(item.id));
    if (!cards.length) {
      box.innerHTML = "";
      box.setAttribute("hidden", "hidden");
      return;
    }
    box.removeAttribute("hidden");
    box.innerHTML = cards.map((item) => {
      const kind = item.kind === "task" ? "task" : item.kind === "quote" ? "quote" : "customer";
      const title = redactSafe(item.full_name || item.customer_name || item.details || "\u05E4\u05E8\u05D9\u05D8");
      const meta = kind === "task" ? redactSafe([item.type, item.details, item.remind_at].filter(Boolean).join(" \xB7 ")) : kind === "quote" ? redactSafe(item.details || "") : redactSafe([item.city, item.agent_name].filter(Boolean).join(" \xB7 "));
      const openId = kind === "customer" ? trim(item.id) : "";
      return `<button type="button" class="giAsst__hit giAsst__hit--${kind}"${openId ? ` data-customer-id="${openId}"` : ""}>
        <strong>${title}</strong>${meta ? `<span>${meta}</span>` : ""}
      </button>`;
    }).join("");
  }
  function bindHits(root) {
    const box = root.querySelector("#giAsstHits");
    if (!box || box.getAttribute("data-gi-asst-hits-bound") === "1") return;
    box.setAttribute("data-gi-asst-hits-bound", "1");
    box.addEventListener("click", (ev) => {
      var _a, _b, _c;
      const target = ev.target;
      const btn = (_a = target == null ? void 0 : target.closest) == null ? void 0 : _a.call(target, "[data-customer-id]");
      const id = trim(btn == null ? void 0 : btn.getAttribute("data-customer-id"));
      if (id) (_c = (_b = readBridge()).openCustomer) == null ? void 0 : _c.call(_b, id);
    });
  }
  function asHitCards(list) {
    if (!Array.isArray(list)) return [];
    return list.filter((item) => item && typeof item === "object");
  }
  function sanitizeCustomerHit(row) {
    const src = row && typeof row === "object" ? row : {};
    return {
      id: trim(src.id),
      kind: "customer",
      full_name: trim(src.full_name),
      city: trim(src.city),
      agent_name: trim(src.agent_name),
      existing_policies_count: Number(src.existing_policies_count) || 0,
      new_policies_count: Number(src.new_policies_count) || 0
    };
  }
  function safeTaskHit(row) {
    return {
      id: trim(row.id),
      kind: "task",
      type: trim(row.type),
      details: trim(row.details).slice(0, 160),
      remind_at: trim(row.remind_at),
      customer_name: trim(row.customer_name)
    };
  }
  async function applyCrmWraps(tool, args, data) {
    var _a;
    const active = readBridge();
    if (tool === "search_customer" && data.ok !== false) {
      const serverList = asHitCards(data.customers);
      if (typeof active.searchCustomers === "function") {
        try {
          const local = asHitCards(await active.searchCustomers(trim(args.query)));
          if (local.length) {
            const allowed = new Set(serverList.map((c) => trim(c.id)));
            data.customers = local.filter((c) => allowed.has(trim(c.id))).map(sanitizeCustomerHit);
          }
        } catch (_e) {
        }
      }
      const hits = asHitCards(data.customers).map(sanitizeCustomerHit);
      data.customers = hits;
      paintHits(hits);
      if (hits.length) pushTimeline("ok", "\u05E0\u05DE\u05E6\u05D0\u05D5 " + hits.length + " \u05DC\u05E7\u05D5\u05D7\u05D5\u05EA.");
    } else if ((tool === "find_customer_by_id" || tool === "get_customer") && data.ok !== false && data.customer && typeof data.customer === "object") {
      const serverCard = data.customer;
      try {
        let local = null;
        if (typeof active.findCustomerById === "function") local = active.findCustomerById(trim(serverCard.id));
        if (!local && /^\d{8,9}$/.test(trim(args.query)) && typeof active.findCustomerByIdNumber === "function") {
          local = active.findCustomerByIdNumber(trim(args.query));
        }
        if (!local && looksLikePhone(trim(args.query)) && typeof active.findCustomerByPhone === "function") {
          local = active.findCustomerByPhone(trim(args.query));
        }
        if (local && trim(local.id) === trim(serverCard.id)) data.customer = local;
      } catch (_e) {
      }
      const card = sanitizeCustomerHit(data.customer);
      data.customer = card;
      if (trim(card.id)) lastCustomerId = trim(card.id);
      if (trim(card.full_name)) lastCustomerName = trim(card.full_name);
      paintHits([card]);
      if (trim(card.full_name)) pushTimeline("ok", "\u05E0\u05DE\u05E6\u05D0 \u05DC\u05E7\u05D5\u05D7: " + redactSafe(card.full_name));
    } else if (tool === "get_tasks" && data.ok !== false) {
      if (typeof active.listTasks === "function") {
        try {
          await ((_a = active.refreshReminders) == null ? void 0 : _a.call(active));
          const local = active.listTasks();
          if (Array.isArray(local) && local.length) {
            const allowed = new Set(asHitCards(data.tasks).map((t) => trim(t.id)));
            data.tasks = local.filter((row) => row && typeof row === "object" && allowed.has(trim(row.id))).map((row) => safeTaskHit(row));
          }
        } catch (_e) {
        }
      }
      const hits = asHitCards(data.tasks).map((t) => safeTaskHit(t));
      paintHits(hits);
      if (hits.length) pushTimeline("ok", "\u05E0\u05DE\u05E6\u05D0\u05D5 " + hits.length + " \u05DE\u05E9\u05D9\u05DE\u05D5\u05EA.");
    }
  }
  function formatPremium(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return String(Math.round(n * 100) / 100);
  }
  async function applySimWraps(tool, args, data) {
    const cmd = data.client_command && typeof data.client_command === "object" ? data.client_command : null;
    const type = trim(cmd == null ? void 0 : cmd.type);
    if (tool !== "get_insurance_price" && type !== "quote_simulator") return;
    const active = readBridge();
    const company = trim((cmd == null ? void 0 : cmd.company) || args.company);
    const product = trim((cmd == null ? void 0 : cmd.product) || args.product);
    const input = (cmd == null ? void 0 : cmd.input) && typeof cmd.input === "object" ? cmd.input : args;
    if (typeof active.quoteSimulator !== "function") {
      data.quote = { ok: false, error: "NO_CLIENT_ENGINE" };
      return;
    }
    try {
      const quote = await active.quoteSimulator(company, product, input);
      data.quote = quote && typeof quote === "object" ? quote : { ok: false, error: "QUOTE_FAILED" };
      if (quote && quote.ok === true) {
        data.ok = true;
        data.monthlyPremium = quote.monthlyPremium;
        data.annualPremium = quote.annualPremium;
        data.currency = "ILS";
        delete data.client_command;
        const monthly = formatPremium(quote.monthlyPremium);
        paintHits([{
          id: "quote-" + company + "-" + product,
          kind: "quote",
          full_name: company + " \xB7 " + product,
          details: monthly ? "\u05E4\u05E8\u05DE\u05D9\u05D4 \u05D7\u05D5\u05D3\u05E9\u05D9\u05EA " + monthly + " \u20AA" : ""
        }]);
        if (monthly) pushTimeline("ok", "\u05E4\u05E8\u05DE\u05D9\u05D4 \u05DE\u05E1\u05D9\u05DE\u05D5\u05DC\u05D8\u05D5\u05E8 \u05E7\u05D9\u05D9\u05DD: " + monthly + " \u20AA \u05DC\u05D7\u05D5\u05D3\u05E9.");
      } else if (quote && quote.open_simulator === true) {
        data.needs_input = true;
        data.error = trim(quote.error) || "NEED_INPUT";
        data.client_command = { type: "open_simulator", company, product };
      }
    } catch (_e) {
      data.quote = { ok: false, error: "QUOTE_FAILED" };
    }
  }
  function bindVoiceControls(root) {
    var _a, _b, _c, _d, _e, _f, _g;
    (_a = root.querySelector("#giAsstVoiceStart")) == null ? void 0 : _a.addEventListener("click", () => {
      void startVoice();
    });
    (_b = root.querySelector("#giAsstVoiceStop")) == null ? void 0 : _b.addEventListener("click", () => {
      void stopVoice();
    });
    (_c = root.querySelector("#giAsstMicBtn")) == null ? void 0 : _c.addEventListener("click", () => {
      if (voice.state === "idle" || voice.state === "error") void startVoice();
      else void stopVoice();
    });
    (_d = root.querySelector("#giAsstConfirmYes")) == null ? void 0 : _d.addEventListener("click", () => {
      void confirmPending();
    });
    (_e = root.querySelector("#giAsstConfirmNo")) == null ? void 0 : _e.addEventListener("click", () => {
      void cancelPending();
    });
    (_f = $("giAsstTalkForm")) == null ? void 0 : _f.addEventListener("submit", (ev) => {
      ev.preventDefault();
      void submitTalkText();
    });
    (_g = root.querySelector("#giAsstOpenPhone")) == null ? void 0 : _g.addEventListener("click", () => {
      renderPhoneReturnBody();
    });
    bindHits(root);
    paintVoiceState();
    paintConfirm();
    paintTimeline();
    paintHits([]);
  }
  function extractTranscript(ev, kind) {
    const type = trim(ev.type);
    if (kind === "user") {
      if (type.indexOf("input_audio_transcription.completed") >= 0) return redactSafe(ev.transcript);
    } else if (type === "response.output_audio_transcript.done" || type === "response.audio_transcript.done" || type.indexOf("output_audio_transcript.done") >= 0) {
      return redactSafe(ev.transcript);
    }
    return "";
  }
  async function onUserTranscript(text) {
    pushTimeline("user", text);
    lastIntent = classifyIntent(text);
    if (!trim(voice.sessionId)) return;
    try {
      await callEngine({ ...engineAuthPayload(), action: "log", kind: "user", text });
      if (lastIntent === "confirm" || lastIntent === "cancel") {
        const data = await callEngine({ ...engineAuthPayload(), action: "intent", text });
        if (data.confirmed === true) {
          const tool = trim(data.tool);
          pendingAction = null;
          paintConfirm();
          if (tool) {
            const ran = await invokeTool(tool, {}, trim(data.pending_action_id));
            pushTimeline(ran.ok === false ? "error" : "ok", ran.ok === false ? "\u05D4\u05D0\u05D9\u05E9\u05D5\u05E8 \u05D4\u05EA\u05E7\u05D1\u05DC \u05D0\u05DA \u05D4\u05D1\u05D9\u05E6\u05D5\u05E2 \u05E0\u05DB\u05E9\u05DC." : "\u05D4\u05E4\u05E2\u05D5\u05DC\u05D4 \u05D0\u05D5\u05E9\u05E8\u05D4 \u05D5\u05D1\u05D5\u05E6\u05E2\u05D4.");
          } else {
            pushTimeline("ok", "\u05D4\u05E4\u05E2\u05D5\u05DC\u05D4 \u05D0\u05D5\u05E9\u05E8\u05D4.");
          }
        } else if (data.cancelled === true) {
          pendingAction = null;
          pushTimeline("cancel", "\u05D4\u05E4\u05E2\u05D5\u05DC\u05D4 \u05D1\u05D5\u05D8\u05DC\u05D4.");
        } else if (trim(data.error) === "NO_PENDING") {
          pushTimeline("info", "\u05D0\u05D9\u05DF \u05E4\u05E2\u05D5\u05DC\u05D4 \u05DE\u05DE\u05EA\u05D9\u05E0\u05D4 \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8.");
        }
        paintConfirm();
      }
    } catch (_e) {
    }
  }
  async function onAssistantTranscript(text) {
    pushTimeline("assistant", text);
    if (!trim(voice.sessionId)) return;
    try {
      await callEngine({ ...engineAuthPayload(), action: "log", kind: "assistant", text });
    } catch (_e) {
    }
  }
  function speechRecognitionCtor() {
    const w = window;
    const ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    return ctor ? ctor : null;
  }
  const FEMALE_VOICE_HINTS = [
    "hila",
    "carmit",
    "heami",
    "he-il-standard-a",
    "he-il-wavenet-a",
    "female",
    "woman",
    "girl",
    "\u05E0\u05E9\u05D9\u05EA"
  ];
  const MALE_VOICE_HINTS = ["asaf", "male", "man-", " man", "david"];
  const QUALITY_VOICE_HINTS = ["natural", "neural", "online", "premium", "enhanced", "wavenet", "studio"];
  let voicesHooked = false;
  function preferredVoiceGender() {
    return isPhonePage() ? "male" : "female";
  }
  function scoreHebrewVoice(voice2, prefer = preferredVoiceGender()) {
    if (!voice2) return -1e3;
    const name = String(voice2.name || "").toLowerCase();
    const lang = String(voice2.lang || "").toLowerCase();
    const blob = name + " " + lang;
    const isHe = lang === "he" || lang === "he-il" || lang.indexOf("he-") === 0 || /hebrew|עברית/.test(blob);
    if (!isHe) return -1e3;
    let score = 50;
    if (lang === "he-il" || lang === "he") score += 30;
    let female = false;
    let male = false;
    for (let i = 0; i < FEMALE_VOICE_HINTS.length; i += 1) {
      if (blob.indexOf(FEMALE_VOICE_HINTS[i]) >= 0) female = true;
    }
    for (let i = 0; i < MALE_VOICE_HINTS.length; i += 1) {
      if (blob.indexOf(MALE_VOICE_HINTS[i]) >= 0) male = true;
    }
    if (prefer === "female") {
      if (female) score += 40;
      if (male) score -= 50;
    } else {
      if (male) score += 40;
      if (female) score -= 50;
    }
    for (let i = 0; i < QUALITY_VOICE_HINTS.length; i += 1) {
      if (blob.indexOf(QUALITY_VOICE_HINTS[i]) >= 0) score += 18;
    }
    if (voice2.localService) score += 6;
    if (voice2.default) score += 4;
    return score;
  }
  function pickHebrewVoice(voices, prefer) {
    var _a, _b;
    try {
      const gender = prefer || preferredVoiceGender();
      const list = voices && voices.length ? voices : ((_b = (_a = window.speechSynthesis) == null ? void 0 : _a.getVoices) == null ? void 0 : _b.call(_a)) || [];
      let best = null;
      let bestScore = 0;
      for (let i = 0; i < list.length; i += 1) {
        const score = scoreHebrewVoice(list[i], gender);
        if (score > bestScore) {
          bestScore = score;
          best = list[i];
        }
      }
      return best;
    } catch (_e) {
      return null;
    }
  }
  function numberToHebrew(value, gender = "m") {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 0) return "";
    if (n > 999999) return String(n);
    const ones = gender === "f" ? ["", "\u05D0\u05D7\u05EA", "\u05E9\u05EA\u05D9\u05D9\u05DD", "\u05E9\u05DC\u05D5\u05E9", "\u05D0\u05E8\u05D1\u05E2", "\u05D7\u05DE\u05E9", "\u05E9\u05E9", "\u05E9\u05D1\u05E2", "\u05E9\u05DE\u05D5\u05E0\u05D4", "\u05EA\u05E9\u05E2"] : ["", "\u05D0\u05D7\u05D3", "\u05E9\u05E0\u05D9\u05D9\u05DD", "\u05E9\u05DC\u05D5\u05E9\u05D4", "\u05D0\u05E8\u05D1\u05E2\u05D4", "\u05D7\u05DE\u05D9\u05E9\u05D4", "\u05E9\u05D9\u05E9\u05D4", "\u05E9\u05D1\u05E2\u05D4", "\u05E9\u05DE\u05D5\u05E0\u05D4", "\u05EA\u05E9\u05E2\u05D4"];
    const teens = gender === "f" ? ["\u05E2\u05E9\u05E8", "\u05D0\u05D7\u05EA \u05E2\u05E9\u05E8\u05D4", "\u05E9\u05EA\u05D9\u05DD \u05E2\u05E9\u05E8\u05D4", "\u05E9\u05DC\u05D5\u05E9 \u05E2\u05E9\u05E8\u05D4", "\u05D0\u05E8\u05D1\u05E2 \u05E2\u05E9\u05E8\u05D4", "\u05D7\u05DE\u05E9 \u05E2\u05E9\u05E8\u05D4", "\u05E9\u05E9 \u05E2\u05E9\u05E8\u05D4", "\u05E9\u05D1\u05E2 \u05E2\u05E9\u05E8\u05D4", "\u05E9\u05DE\u05D5\u05E0\u05D4 \u05E2\u05E9\u05E8\u05D4", "\u05EA\u05E9\u05E2 \u05E2\u05E9\u05E8\u05D4"] : ["\u05E2\u05E9\u05E8\u05D4", "\u05D0\u05D7\u05D3 \u05E2\u05E9\u05E8", "\u05E9\u05E0\u05D9\u05D9\u05DD \u05E2\u05E9\u05E8", "\u05E9\u05DC\u05D5\u05E9\u05D4 \u05E2\u05E9\u05E8", "\u05D0\u05E8\u05D1\u05E2\u05D4 \u05E2\u05E9\u05E8", "\u05D7\u05DE\u05D9\u05E9\u05D4 \u05E2\u05E9\u05E8", "\u05E9\u05D9\u05E9\u05D4 \u05E2\u05E9\u05E8", "\u05E9\u05D1\u05E2\u05D4 \u05E2\u05E9\u05E8", "\u05E9\u05DE\u05D5\u05E0\u05D4 \u05E2\u05E9\u05E8", "\u05EA\u05E9\u05E2\u05D4 \u05E2\u05E9\u05E8"];
    const tens = ["", "", "\u05E2\u05E9\u05E8\u05D9\u05DD", "\u05E9\u05DC\u05D5\u05E9\u05D9\u05DD", "\u05D0\u05E8\u05D1\u05E2\u05D9\u05DD", "\u05D7\u05DE\u05D9\u05E9\u05D9\u05DD", "\u05E9\u05D9\u05E9\u05D9\u05DD", "\u05E9\u05D1\u05E2\u05D9\u05DD", "\u05E9\u05DE\u05D5\u05E0\u05D9\u05DD", "\u05EA\u05E9\u05E2\u05D9\u05DD"];
    const thousandHeads = ["", "\u05D0\u05DC\u05E3", "\u05D0\u05DC\u05E4\u05D9\u05D9\u05DD", "\u05E9\u05DC\u05D5\u05E9\u05EA \u05D0\u05DC\u05E4\u05D9\u05DD", "\u05D0\u05E8\u05D1\u05E2\u05EA \u05D0\u05DC\u05E4\u05D9\u05DD", "\u05D7\u05DE\u05E9\u05EA \u05D0\u05DC\u05E4\u05D9\u05DD", "\u05E9\u05E9\u05EA \u05D0\u05DC\u05E4\u05D9\u05DD", "\u05E9\u05D1\u05E2\u05EA \u05D0\u05DC\u05E4\u05D9\u05DD", "\u05E9\u05DE\u05D5\u05E0\u05EA \u05D0\u05DC\u05E4\u05D9\u05DD", "\u05EA\u05E9\u05E2\u05EA \u05D0\u05DC\u05E4\u05D9\u05DD"];
    const twoNoun = gender === "f" ? "\u05E9\u05EA\u05D9" : "\u05E9\u05E0\u05D9";
    const under20 = (x, constructTwo) => {
      if (x === 0) return "";
      if (x === 2 && constructTwo) return twoNoun;
      if (x < 10) return ones[x];
      return teens[x - 10];
    };
    const under100 = (x, constructTwo) => {
      if (x < 20) return under20(x, constructTwo);
      const t = Math.floor(x / 10);
      const o = x % 10;
      if (!o) return tens[t];
      const onesWord = o === 2 && gender === "m" ? "\u05E9\u05E0\u05D9\u05D9\u05DD" : ones[o];
      return tens[t] + " \u05D5" + onesWord;
    };
    const under1000 = (x, constructTwo) => {
      if (x < 100) return under100(x, constructTwo);
      const h = Math.floor(x / 100);
      const rest2 = x % 100;
      const hundreds = h === 1 ? "\u05DE\u05D0\u05D4" : h === 2 ? "\u05DE\u05D0\u05EA\u05D9\u05D9\u05DD" : [
        "",
        "",
        "",
        "\u05E9\u05DC\u05D5\u05E9",
        "\u05D0\u05E8\u05D1\u05E2",
        "\u05D7\u05DE\u05E9",
        "\u05E9\u05E9",
        "\u05E9\u05D1\u05E2",
        "\u05E9\u05DE\u05D5\u05E0\u05D4",
        "\u05EA\u05E9\u05E2"
      ][h] + " \u05DE\u05D0\u05D5\u05EA";
      if (!rest2) return hundreds;
      return hundreds + " \u05D5" + under100(rest2, false);
    };
    if (n < 1e3) return under1000(n, n === 2);
    const thousands = Math.floor(n / 1e3);
    const rest = n % 1e3;
    const head = thousands < 10 ? thousandHeads[thousands] : under1000(thousands, false) + " \u05D0\u05DC\u05E3";
    if (!rest) return head;
    return head + " \u05D5" + under1000(rest, false);
  }
  function formatSpokenPremium(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    const rounded = Math.round(n * 100) / 100;
    const whole = Math.floor(rounded);
    const agorot = Math.round((rounded - whole) * 100);
    const shekels = whole === 1 ? "\u05E9\u05E7\u05DC \u05D0\u05D7\u05D3" : numberToHebrew(whole, "m") + " \u05E9\u05E7\u05DC\u05D9\u05DD";
    if (!agorot) return shekels;
    return shekels + " \u05D5" + numberToHebrew(agorot, "f") + " \u05D0\u05D2\u05D5\u05E8\u05D5\u05EA";
  }
  function prepareSpeechText(text) {
    let spoken = trim(text);
    if (!spoken) return "";
    spoken = spoken.replace(/₪/g, " \u05E9\u05E7\u05DC\u05D9\u05DD ");
    spoken = spoken.replace(/\[מזהה\]/g, "\u05DE\u05E1\u05E4\u05E8 \u05DE\u05D6\u05D4\u05D4");
    spoken = spoken.replace(/(\d{1,6})[.,](\d{1,2})\b/g, (_m, whole, frac) => {
      const head = numberToHebrew(Number(whole), "m");
      const tail = numberToHebrew(Number(frac), "f");
      return (head || whole) + " \u05E0\u05E7\u05D5\u05D3\u05D4 " + (tail || frac);
    });
    spoken = spoken.replace(/\b(\d{1,6})\b/g, (raw) => numberToHebrew(Number(raw), "m") || raw);
    spoken = spoken.replace(/\s+/g, " ").trim();
    spoken = spoken.replace(/\s+([,.:!?])/g, "$1");
    spoken = spoken.replace(/([,.:!?])(?=\S)/g, "$1 ");
    if (!/[.!?]$/.test(spoken)) spoken += ".";
    return spoken;
  }
  function applyVoiceTone(utter, chosen) {
    utter.lang = "he-IL";
    if (chosen) {
      try {
        utter.voice = chosen;
      } catch (_e) {
      }
    }
    const prefer = preferredVoiceGender();
    const name = String(chosen && chosen.name || "").toLowerCase();
    let female = false;
    let male = false;
    for (let i = 0; i < FEMALE_VOICE_HINTS.length; i += 1) {
      if (name.indexOf(FEMALE_VOICE_HINTS[i]) >= 0) female = true;
    }
    for (let i = 0; i < MALE_VOICE_HINTS.length; i += 1) {
      if (name.indexOf(MALE_VOICE_HINTS[i]) >= 0) male = true;
    }
    utter.rate = prefer === "male" ? 0.92 : 0.9;
    if (prefer === "male") {
      utter.pitch = male ? 0.95 : female ? 0.9 : 0.92;
    } else {
      utter.pitch = female ? 1.12 : 1.2;
    }
    utter.volume = 1;
  }
  function speechHoldMs(text) {
    return Math.min(22e3, Math.max(3600, Math.round(text.length * 90 + 1e3)));
  }
  function warmVoices() {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.getVoices();
      if (voicesHooked) return;
      voicesHooked = true;
      const refresh = () => {
        try {
          synth.getVoices();
        } catch (_e) {
        }
      };
      if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", refresh);
      else synth.onvoiceschanged = refresh;
    } catch (_e2) {
    }
  }
  function isMobileVoice() {
    if (isPhonePage()) return true;
    try {
      return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || "");
    } catch (_e) {
      return false;
    }
  }
  function setHeardStatus(text) {
    lastHeard = redactSafe(text);
    const el = $("giAsstHeard");
    if (el) el.textContent = lastHeard ? "\u05E9\u05DE\u05E2\u05EA\u05D9: " + lastHeard : "";
  }
  function unlockSpeech() {
    var _a, _b;
    try {
      warmVoices();
      const utter = new SpeechSynthesisUtterance(" ");
      utter.volume = 0;
      (_a = window.speechSynthesis) == null ? void 0 : _a.speak(utter);
      (_b = window.speechSynthesis) == null ? void 0 : _b.cancel();
    } catch (_e) {
    }
  }
  function pauseLocalListening() {
    const rec = voice.recognition;
    try {
      rec == null ? void 0 : rec.stop();
    } catch (_e) {
    }
  }
  function resumeLocalListening() {
    if (voice.state === "idle" || voice.state === "error") return;
    const rec = voice.recognition;
    if (!rec) {
      startLocalListening();
      return;
    }
    try {
      rec.start();
    } catch (_e) {
    }
  }
  function startLocalListening() {
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "he-IL";
    rec.continuous = !isMobileVoice();
    rec.interimResults = true;
    rec.onresult = (ev) => {
      if (utteranceBusy || voice.state === "speaking") return;
      const results = ev.results;
      let finalText = "";
      let interim = "";
      for (let i = ev.resultIndex; i < results.length; i += 1) {
        const row = results[i];
        const spoken = trim(row && row[0] ? row[0].transcript : "");
        if (!spoken) continue;
        if (row.isFinal) finalText = trim(finalText + " " + spoken);
        else interim = spoken;
      }
      if (interim) setHeardStatus(interim);
      if (finalText) {
        setHeardStatus(finalText);
        void handleLocalUtterance(finalText);
      }
    };
    rec.onerror = (ev) => {
      const err = trim(ev == null ? void 0 : ev.error);
      if (err === "not-allowed") setVoiceState("error", pairingErrorText("MIC_DENIED"));
    };
    rec.onend = () => {
      if (voice.recognition !== rec) return;
      if (voice.state === "idle" || voice.state === "error") return;
      if (utteranceBusy || voice.state === "speaking") return;
      window.setTimeout(() => {
        if (voice.recognition === rec && voice.state !== "idle" && voice.state !== "error" && !utteranceBusy && voice.state !== "speaking") {
          try {
            rec.start();
          } catch (_e) {
          }
        }
      }, isPhonePage() ? 180 : 280);
    };
    voice.recognition = rec;
    rec.start();
  }
  function stopLocalListening() {
    var _a;
    const rec = voice.recognition;
    voice.recognition = null;
    try {
      rec == null ? void 0 : rec.stop();
    } catch (_e) {
    }
    try {
      (_a = window.speechSynthesis) == null ? void 0 : _a.cancel();
    } catch (_e2) {
    }
  }
  async function speak(text) {
    const clean = redactSafe(text);
    if (!clean) return;
    const spoken = prepareSpeechText(clean);
    await onAssistantTranscript(clean);
    if (voice.state === "idle" || voice.state === "error") return;
    if (!window.speechSynthesis) return;
    warmVoices();
    pauseLocalListening();
    setVoiceState("speaking");
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve();
      };
      const timer = window.setTimeout(finish, speechHoldMs(spoken));
      const utter = new SpeechSynthesisUtterance(spoken);
      const chosen = pickHebrewVoice();
      applyVoiceTone(utter, chosen);
      utter.onend = () => finish();
      utter.onerror = () => finish();
      try {
        window.speechSynthesis.cancel();
      } catch (_e2) {
      }
      try {
        window.speechSynthesis.speak(utter);
      } catch (_e3) {
        finish();
      }
    });
    if (voice.state === "speaking") setVoiceState("listening");
    resumeLocalListening();
  }
  function shortActionAck(tool, data) {
    if (data.ok === false) {
      if (tool === "open_har_import") return "\u05DC\u05D0 \u05DE\u05E6\u05D0\u05EA\u05D9 \u05D0\u05EA \u05DB\u05E4\u05EA\u05D5\u05E8 \u05D4\u05E8 \u05D4\u05D1\u05D9\u05D8\u05D5\u05D7.";
      if (tool === "wizard_next") return "\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9 \u05DC\u05E2\u05D1\u05D5\u05E8 \u05E9\u05DC\u05D1.";
      return "\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9.";
    }
    if (tool === "open_har_import") return "\u05E4\u05EA\u05D7\u05EA\u05D9 \u05D1\u05D7\u05D9\u05E8\u05EA \u05E7\u05D5\u05D1\u05E5. \u05D1\u05D7\u05E8\u05D5 \u05DE\u05D4\u05DE\u05D7\u05E9\u05D1.";
    return PHONE_DONE_ACK;
  }
  function replyFromTool(tool, data) {
    if (isPhonePage() && !data.forceVerbose) {
      if (data.needs_confirmation === true) return "\u05DE\u05DE\u05EA\u05D9\u05E0\u05D9\u05DD \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8. \u05D0\u05DE\u05E8\u05D5 \u05DB\u05DF \u05D0\u05D5 \u05DC\u05D0.";
      if (trim(data.error) === "NEED_INPUT" || data.needs_input === true) return "\u05D7\u05E1\u05E8\u05D9\u05DD \u05E4\u05E8\u05D8\u05D9\u05DD.";
      if (tool === "go_view" || tool === "click_topbar" || tool === "fill_wizard" || tool === "wizard_next" || tool === "open_har_import" || tool === "open_simulator" || tool === "create_proposal" || tool === "open_customer" || tool === "find_customer_by_id") {
        return shortActionAck(tool, data);
      }
    }
    if (data.needs_confirmation === true) return "\u05E4\u05E2\u05D5\u05DC\u05EA \u05DB\u05EA\u05D9\u05D1\u05D4 \u05DE\u05DE\u05EA\u05D9\u05E0\u05D4 \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8. \u05D0\u05DE\u05E8\u05D5 \u05DB\u05DF, \u05D0\u05D5 \u05DC\u05D0.";
    if (trim(data.error) === "NEED_INPUT" || data.needs_input === true) return "\u05D7\u05E1\u05E8\u05D9\u05DD \u05E4\u05E8\u05D8\u05D9\u05DD. \u05E4\u05EA\u05D7\u05EA\u05D9 \u05D0\u05EA \u05D4\u05E1\u05D9\u05DE\u05D5\u05DC\u05D8\u05D5\u05E8 \u05D4\u05E7\u05D9\u05D9\u05DD.";
    if (data.ok === false) return "\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9 \u05DC\u05D1\u05E6\u05E2 \u05D0\u05EA \u05D4\u05D1\u05E7\u05E9\u05D4.";
    if (data.instant === true && (tool === "find_customer_by_id" || tool === "open_customer")) {
      return "\u05E4\u05D5\u05EA\u05D7\u05EA \u05D0\u05EA \u05D4\u05EA\u05D9\u05E7.";
    }
    if (tool === "search_customer") {
      const n = asHitCards(data.customers).length;
      if (!n) return "\u05DC\u05D0 \u05DE\u05E6\u05D0\u05EA\u05D9 \u05DC\u05E7\u05D5\u05D7\u05D5\u05EA.";
      return n === 1 ? "\u05DE\u05E6\u05D0\u05EA\u05D9 \u05DC\u05E7\u05D5\u05D7 \u05D0\u05D7\u05D3. \u05E4\u05D5\u05EA\u05D7\u05EA \u05D0\u05EA \u05D4\u05EA\u05D9\u05E7." : "\u05DE\u05E6\u05D0\u05EA\u05D9 " + numberToHebrew(n, "m") + " \u05DC\u05E7\u05D5\u05D7\u05D5\u05EA.";
    }
    if (tool === "find_customer_by_id" || tool === "get_customer") {
      const name = trim(data.customer && typeof data.customer === "object" ? data.customer.full_name : "");
      return name ? "\u05DE\u05E6\u05D0\u05EA\u05D9 \u05D0\u05EA " + name + "." : "\u05DC\u05D0 \u05DE\u05E6\u05D0\u05EA\u05D9 \u05D0\u05EA \u05D4\u05DC\u05E7\u05D5\u05D7.";
    }
    if (tool === "get_tasks") {
      const n = asHitCards(data.tasks).length;
      return n ? "\u05D9\u05E9 " + numberToHebrew(n, "f") + " \u05DE\u05E9\u05D9\u05DE\u05D5\u05EA \u05E4\u05EA\u05D5\u05D7\u05D5\u05EA." : "\u05D0\u05D9\u05DF \u05DE\u05E9\u05D9\u05DE\u05D5\u05EA \u05E4\u05EA\u05D5\u05D7\u05D5\u05EA.";
    }
    if (tool === "get_insurance_price") {
      const monthly = formatSpokenPremium(data.monthlyPremium);
      return monthly ? "\u05D4\u05E4\u05E8\u05DE\u05D9\u05D4 \u05D4\u05D7\u05D5\u05D3\u05E9\u05D9\u05EA \u05D4\u05D9\u05D0 " + monthly + "." : "\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9 \u05DC\u05D7\u05E9\u05D1 \u05E4\u05E8\u05DE\u05D9\u05D4.";
    }
    if (tool === "open_simulator") return "\u05E4\u05EA\u05D7\u05EA\u05D9 \u05D0\u05EA \u05D4\u05E1\u05D9\u05DE\u05D5\u05DC\u05D8\u05D5\u05E8 \u05D4\u05E7\u05D9\u05D9\u05DD.";
    if (tool === "go_view") return "\u05E2\u05D1\u05E8\u05EA\u05D9 \u05DC\u05DE\u05E1\u05DA \u05E9\u05D1\u05D9\u05E7\u05E9\u05EA.";
    if (tool === "click_topbar") return "\u05E4\u05EA\u05D7\u05EA\u05D9 \u05D0\u05EA \u05D4\u05DB\u05E4\u05EA\u05D5\u05E8 \u05DE\u05D4\u05E1\u05E8\u05D2\u05DC.";
    if (tool === "create_proposal") return "\u05E4\u05EA\u05D7\u05EA\u05D9 \u05D0\u05EA \u05D4\u05D0\u05E9\u05E3 \u05D4\u05E7\u05D9\u05D9\u05DD \u05DC\u05D4\u05E6\u05E2\u05D4.";
    if (tool === "fill_wizard") return "\u05DE\u05D9\u05DC\u05D0\u05EA\u05D9 \u05D0\u05EA \u05D4\u05E9\u05D3\u05D5\u05EA \u05D1\u05D0\u05E9\u05E3.";
    if (tool === "wizard_next") return data.ok === false ? "\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9 \u05DC\u05E2\u05D1\u05D5\u05E8 \u05E9\u05DC\u05D1. \u05D1\u05D3\u05E7\u05D5 \u05E9\u05DB\u05DC \u05D4\u05E4\u05E8\u05D8\u05D9\u05DD \u05DE\u05DC\u05D0\u05D9\u05DD." : "\u05E2\u05D1\u05E8\u05EA\u05D9 \u05DC\u05E9\u05DC\u05D1 \u05D4\u05D1\u05D0.";
    if (tool === "open_har_import") return data.ok === false ? "\u05DC\u05D0 \u05DE\u05E6\u05D0\u05EA\u05D9 \u05D0\u05EA \u05DB\u05E4\u05EA\u05D5\u05E8 \u05D4\u05E8 \u05D4\u05D1\u05D9\u05D8\u05D5\u05D7. \u05E2\u05D1\u05E8\u05D5 \u05E7\u05D5\u05D3\u05DD \u05DC\u05E9\u05DC\u05D1 \u05D4\u05E4\u05D5\u05DC\u05D9\u05E1\u05D5\u05EA \u05D4\u05E7\u05D9\u05D9\u05DE\u05D5\u05EA." : "\u05E4\u05EA\u05D7\u05EA\u05D9 \u05D0\u05EA \u05D1\u05D7\u05D9\u05E8\u05EA \u05E7\u05D5\u05D1\u05E5 \u05D4\u05E8 \u05D4\u05D1\u05D9\u05D8\u05D5\u05D7. \u05D1\u05D7\u05E8\u05D5 \u05D0\u05EA \u05E7\u05D5\u05D1\u05E5 \u05D4\u05D0\u05E7\u05E1\u05DC \u05DE\u05D4\u05DE\u05D7\u05E9\u05D1.";
    if (tool === "get_monthly_production" || tool === "get_team_production") {
      const count = Number(data.count == null ? data.total : data.count);
      return Number.isFinite(count) ? "\u05D4\u05D7\u05D5\u05D3\u05E9 " + numberToHebrew(count, "m") + " \u05EA\u05D9\u05E7\u05D9\u05DD." : "\u05D4\u05D1\u05D0\u05EA\u05D9 \u05D0\u05EA \u05E0\u05EA\u05D5\u05E0\u05D9 \u05D4\u05D9\u05D9\u05E6\u05D5\u05E8.";
    }
    return "\u05D1\u05D9\u05E6\u05E2\u05EA\u05D9.";
  }
  function commandFromLocalTool(tool, args) {
    const a = args && typeof args === "object" ? args : {};
    if (tool === "go_view" && trim(a.view)) return { type: "go_view", view: trim(a.view) };
    if (tool === "click_topbar" && trim(a.id)) return { type: "click_topbar", id: trim(a.id) };
    if (tool === "fill_wizard") return { type: "fill_wizard", fields: a };
    if (tool === "wizard_next") return { type: "wizard_next" };
    if (tool === "open_har_import") return { type: "open_har_import" };
    if (tool === "open_simulator" && trim(a.company)) return { type: "open_simulator", company: trim(a.company), product: trim(a.product) || "\u05E8\u05D9\u05E1\u05E7" };
    if (tool === "create_proposal") {
      const out = { type: "open_wizard" };
      if (trim(a.customerId)) out.customerId = trim(a.customerId);
      else if (trim(a.query)) out.query = trim(a.query);
      else if (lastCustomerId) out.customerId = lastCustomerId;
      if (trim(a.company)) out.company = trim(a.company);
      if (trim(a.product)) out.product = trim(a.product);
      return out;
    }
    if (tool === "open_customer" || tool === "find_customer_by_id") {
      const out = { type: "open_customer" };
      const id = trim(a.customerId);
      const query = trim(a.query);
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) out.customerId = id;
      if (query) out.query = query;
      if (!out.customerId && !out.query) return null;
      return out;
    }
    return null;
  }
  function runInstantUi(cmd) {
    if (isPhonePage()) void dispatchDesktopCommand(cmd);
    else executeClientCommand(cmd);
  }
  async function sleepMs(ms) {
    await new Promise((resolve) => window.setTimeout(resolve, ms));
  }
  async function submitTalkText() {
    const input = $("giAsstTalkText");
    const text = trim(input == null ? void 0 : input.value);
    if (!text) return;
    if (input) input.value = "";
    if (voice.state === "idle" || voice.state === "error") void startVoice();
    setHeardStatus(text);
    await handleLocalUtterance(text);
  }
  async function handleLocalUtterance(text) {
    var _a;
    if (utteranceBusy) return;
    try {
      (_a = window.speechSynthesis) == null ? void 0 : _a.cancel();
    } catch (_eBusy) {
    }
    if (voice.state === "speaking") setVoiceState("listening");
    utteranceBusy = true;
    pauseLocalListening();
    try {
      const intent = classifyIntent(text);
      const hadPending = !!pendingAction;
      void onUserTranscript(text);
      if (intent === "confirm") {
        await speak(hadPending ? isPhonePage() ? "\u05D0\u05D5\u05E9\u05E8." : "\u05D0\u05D9\u05E9\u05E8\u05EA\u05D9 \u05D0\u05EA \u05D4\u05E4\u05E2\u05D5\u05DC\u05D4." : isPhonePage() ? "\u05D0\u05D9\u05DF \u05E4\u05E2\u05D5\u05DC\u05D4 \u05DE\u05DE\u05EA\u05D9\u05E0\u05D4." : "\u05D0\u05D9\u05DF \u05E4\u05E2\u05D5\u05DC\u05D4 \u05E9\u05DE\u05DE\u05EA\u05D9\u05E0\u05D4 \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8.");
        return;
      }
      if (intent === "cancel") {
        await speak(hadPending ? isPhonePage() ? "\u05D1\u05D5\u05D8\u05DC." : "\u05D1\u05D9\u05D8\u05DC\u05EA\u05D9 \u05D0\u05EA \u05D4\u05E4\u05E2\u05D5\u05DC\u05D4." : isPhonePage() ? "\u05D0\u05D9\u05DF \u05E4\u05E2\u05D5\u05DC\u05D4 \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC." : "\u05D0\u05D9\u05DF \u05E4\u05E2\u05D5\u05DC\u05D4 \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC.");
        return;
      }
      const cmd = parseLocalCommand(text);
      if (!cmd || cmd.kind === "help" || !cmd.tool) {
        if (isPhonePage() && !isSpokenQuestion(text)) {
          await speak(cmd && cmd.say || PHONE_SHORT_HELP);
          return;
        }
        await speak(cmd && cmd.say || (isPhonePage() ? PHONE_SHORT_HELP : LOCAL_VOICE_HELP));
        return;
      }
      const args = Object.assign({}, cmd.args || {});
      const instant = commandFromLocalTool(cmd.tool, args);
      if (instant) {
        if (isPhonePage()) await dispatchDesktopCommand(instant);
        else executeClientCommand(instant);
        if (cmd.tool === "create_proposal") {
          const extra = extractFillFields(text);
          if (extra && (extra.firstName || extra.lastName || extra.company || extra.product || extra.age != null)) {
            const fillCmd = { type: "fill_wizard", fields: extra };
            if (isPhonePage()) await dispatchDesktopCommand(fillCmd);
            else executeClientCommand(fillCmd);
          }
        }
        await speak(replyFromTool(cmd.tool, { ok: true, instant: true }));
        return;
      }
      const data = await invokeTool(cmd.tool, args);
      await speak(replyFromTool(cmd.tool, data));
    } catch (_e3) {
      await speak(isPhonePage() ? "\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9." : "\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9 \u05DC\u05D1\u05E6\u05E2 \u05D0\u05EA \u05D4\u05D1\u05E7\u05E9\u05D4.");
    } finally {
      utteranceBusy = false;
      if (voice.state === "listening" || voice.state === "connecting") resumeLocalListening();
    }
  }
  function handleRealtimeEvent(raw) {
    let ev = {};
    try {
      ev = JSON.parse(raw);
    } catch (_e) {
      return;
    }
    const type = trim(ev.type);
    const userText = extractTranscript(ev, "user");
    const asstText = extractTranscript(ev, "assistant");
    if (userText) void onUserTranscript(userText);
    if (asstText) void onAssistantTranscript(asstText);
    if (type === "session.created" || type === "input_audio_buffer.speech_stopped" || type === "response.done") {
      if (voice.state !== "idle") setVoiceState("listening");
      return;
    }
    if (type === "input_audio_buffer.speech_started") {
      setVoiceState("listening");
      return;
    }
    if (type === "response.created" || type === "response.output_audio.delta" || type === "response.audio.delta" || type === "output_audio_buffer.started") {
      setVoiceState("speaking");
      return;
    }
    if (type === "error") {
      setVoiceState("error", "\u05D4\u05E9\u05D9\u05D7\u05D4 \u05E0\u05E7\u05D8\u05E2\u05D4. \u05E0\u05E1\u05D5 \u05E9\u05D5\u05D1.");
    }
    if (type === "response.function_call_arguments.done" || type === "response.output_item.done") {
      void handleToolCallEvent(ev);
    }
  }
  function sendRealtime(event) {
    var _a;
    try {
      (_a = voice.dc) == null ? void 0 : _a.send(JSON.stringify(event));
    } catch (_e) {
    }
  }
  function executeClientCommand(cmd) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
    if (!cmd || typeof cmd !== "object") return;
    const type = trim(cmd.type);
    const active = readBridge();
    if (type === "open_customer") {
      const id = trim(cmd.customerId);
      const query = trim(cmd.query);
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (uuid) {
        lastCustomerId = id;
        (_a = active.openCustomer) == null ? void 0 : _a.call(active, id);
      } else {
        if (query) lastCustomerName = query;
        void ((_b = active.openCustomerByQuery) == null ? void 0 : _b.call(active, query || id));
      }
    } else if (type === "go_view") (_c = active.goView) == null ? void 0 : _c.call(active, trim(cmd.view));
    else if (type === "open_simulator") void ((_d = active.openSimulator) == null ? void 0 : _d.call(active, trim(cmd.company), trim(cmd.product)));
    else if (type === "quote_simulator") void ((_e = active.quoteSimulator) == null ? void 0 : _e.call(active, trim(cmd.company), trim(cmd.product), cmd.input && typeof cmd.input === "object" ? cmd.input : {}));
    else if (type === "open_wizard") {
      if (trim(cmd.customerId)) lastCustomerId = trim(cmd.customerId);
      if (trim(cmd.query)) lastCustomerName = trim(cmd.query);
      void ((_f = active.openWizard) == null ? void 0 : _f.call(active, { customerId: trim(cmd.customerId), query: trim(cmd.query), company: trim(cmd.company), product: trim(cmd.product) }));
    } else if (type === "fill_wizard") {
      const fields = cmd.fields && typeof cmd.fields === "object" ? cmd.fields : {};
      (_g = active.fillWizard) == null ? void 0 : _g.call(active, fields);
    } else if (type === "wizard_next") void ((_h = active.wizardNext) == null ? void 0 : _h.call(active));
    else if (type === "open_har_import") void ((_i = active.openHarImport) == null ? void 0 : _i.call(active));
    else if (type === "click_topbar") (_j = active.clickTopbar) == null ? void 0 : _j.call(active, trim(cmd.id));
    else if (type === "open_proposal") (_k = active.openProposal) == null ? void 0 : _k.call(active, trim(cmd.proposalId));
    else if (type === "upsert_reminder" && cmd.reminder && typeof cmd.reminder === "object") {
      void ((_l = active.upsertReminder) == null ? void 0 : _l.call(active, cmd.reminder));
    } else if (type === "mark_task_done") void ((_m = active.markTaskDone) == null ? void 0 : _m.call(active, trim(cmd.id || cmd.taskId)));
    else if (type === "refresh_reminders") void ((_n = active.refreshReminders) == null ? void 0 : _n.call(active));
  }
  async function dispatchDesktopCommand(cmd) {
    if (!isPhonePage()) return;
    if (!UI_COMMANDS.has(trim(cmd.type))) return;
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const data = await callEngine({ ...engineAuthPayload(), action: "dispatch", command: cmd });
        if (data && data.ok === false) {
          lastErr = trim(data.error) || "DISPATCH";
          await sleepMs(140 * (attempt + 1));
          continue;
        }
        return;
      } catch (err) {
        lastErr = err;
        await sleepMs(140 * (attempt + 1));
      }
    }
    if (lastErr) pushTimeline("error", "\u05E9\u05DC\u05D9\u05D7\u05EA \u05D4\u05E4\u05E7\u05D5\u05D3\u05D4 \u05DC\u05DE\u05D7\u05E9\u05D1 \u05E0\u05DB\u05E9\u05DC\u05D4. \u05E0\u05E1\u05D5 \u05E9\u05D5\u05D1.");
  }
  async function pullDesktopCommands() {
    if (isPhonePage()) return;
    const device = readDevice();
    if (!device || !trim(device.deviceSecret)) return;
    try {
      const data = await callEngine({ ...engineAuthPayload(), action: "pull" });
      const list = Array.isArray(data.commands) ? data.commands : [];
      for (const row of list) {
        const id = trim(row.id);
        const cmd = row.command && typeof row.command === "object" ? row.command : null;
        try {
          executeClientCommand(cmd);
          if (id) await callEngine({ ...engineAuthPayload(), action: "ack", commandId: id });
        } catch (_e) {
          if (id) await callEngine({ ...engineAuthPayload(), action: "ack", commandId: id, error: "EXEC" });
        }
      }
    } catch (_e) {
    }
  }
  function startCommandBus() {
    if (isPhonePage()) return;
    if (commandPoll) {
      void pullDesktopCommands();
      return;
    }
    commandPoll = window.setInterval(() => {
      void pullDesktopCommands();
    }, COMMAND_POLL_MS);
    void pullDesktopCommands();
  }
  function stopCommandBus() {
    if (commandPoll) window.clearInterval(commandPoll);
    commandPoll = 0;
  }
  async function invokeTool(tool, args, pendingActionId) {
    delete args.user_id;
    delete args.userId;
    const data = await callTools({
      ...engineAuthPayload(),
      action: "invoke",
      tool: trim(tool),
      arguments: args,
      pendingActionId: trim(pendingActionId)
    });
    if (data.needs_confirmation === true) {
      pendingAction = { id: trim(data.pending_action_id), label: trim(data.label) || trim(tool) };
      pushTimeline("confirm", "\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8: " + (pendingAction.label || ""));
      paintConfirm();
    }
    await applyCrmWraps(trim(tool), args, data);
    await applySimWraps(trim(tool), args, data);
    if (data.client_command && typeof data.client_command === "object") {
      const cmd = data.client_command;
      if (isPhonePage()) void dispatchDesktopCommand(cmd);
      else executeClientCommand(cmd);
    }
    return data;
  }
  async function handleToolCallEvent(ev) {
    const item = ev.item && typeof ev.item === "object" ? ev.item : ev;
    const name = trim(item.name || ev.name);
    const callId = trim(item.call_id || ev.call_id);
    let args = {};
    const raw = item.arguments || ev.arguments;
    if (typeof raw === "string") {
      try {
        args = JSON.parse(raw);
      } catch (_e) {
        args = {};
      }
    } else if (raw && typeof raw === "object") args = raw;
    const itemType = trim(item.type);
    if (itemType && itemType !== "function_call") return;
    if (!name || !callId) return;
    let output = { ok: false, error: "TOOL" };
    try {
      output = await invokeTool(name, args);
    } catch (err) {
      output = { ok: false, error: trim(err == null ? void 0 : err.message) || "TOOL" };
    }
    sendRealtime({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(output)
      }
    });
    sendRealtime({ type: "response.create" });
  }
  async function proposeWrite(input) {
    const data = await callEngine({
      ...engineAuthPayload(),
      action: "propose",
      tool: trim(input.tool),
      label: trim(input.label),
      argumentsSafe: input.argumentsSafe || {}
    });
    pendingAction = { id: trim(data.pending_action_id), label: trim(data.label) || trim(input.label) || trim(input.tool) };
    pushTimeline("confirm", "\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8: " + (pendingAction.label || ""));
    paintConfirm();
    return data;
  }
  async function confirmPending() {
    if (!pendingAction) {
      pushTimeline("info", "\u05D0\u05D9\u05DF \u05E4\u05E2\u05D5\u05DC\u05D4 \u05DE\u05DE\u05EA\u05D9\u05E0\u05D4 \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8.");
      return { ok: false, error: "NO_PENDING", executed: false };
    }
    try {
      const data = await callEngine({
        ...engineAuthPayload(),
        action: "confirm",
        pendingActionId: pendingAction.id
      });
      const tool = trim(data.tool);
      pendingAction = null;
      paintConfirm();
      if (tool) {
        const ran = await invokeTool(tool, {}, trim(data.pending_action_id));
        pushTimeline(ran.ok === false ? "error" : "ok", ran.ok === false ? "\u05D4\u05D0\u05D9\u05E9\u05D5\u05E8 \u05D4\u05EA\u05E7\u05D1\u05DC \u05D0\u05DA \u05D4\u05D1\u05D9\u05E6\u05D5\u05E2 \u05E0\u05DB\u05E9\u05DC." : "\u05D4\u05E4\u05E2\u05D5\u05DC\u05D4 \u05D0\u05D5\u05E9\u05E8\u05D4 \u05D5\u05D1\u05D5\u05E6\u05E2\u05D4.");
        return ran;
      }
      pushTimeline("ok", "\u05D4\u05E4\u05E2\u05D5\u05DC\u05D4 \u05D0\u05D5\u05E9\u05E8\u05D4.");
      return data;
    } catch (err) {
      const code = trim((err == null ? void 0 : err.code) || (err == null ? void 0 : err.message));
      if (code === "NO_PENDING") pushTimeline("info", "\u05D0\u05D9\u05DF \u05E4\u05E2\u05D5\u05DC\u05D4 \u05DE\u05DE\u05EA\u05D9\u05E0\u05D4 \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8.");
      return { ok: false, error: code, executed: false };
    }
  }
  async function cancelPending() {
    if (!pendingAction) return;
    try {
      await callEngine({
        ...engineAuthPayload(),
        action: "cancel",
        pendingActionId: pendingAction.id
      });
    } catch (_e) {
    }
    pendingAction = null;
    paintConfirm();
    pushTimeline("cancel", "\u05D4\u05E4\u05E2\u05D5\u05DC\u05D4 \u05D1\u05D5\u05D8\u05DC\u05D4.");
  }
  async function mintVoiceToken() {
    var _a;
    const device = readDevice();
    const auth = getAuth();
    const payload = {
      action: "token",
      source: device && trim(device.deviceSecret) ? "phone" : "desktop"
    };
    if (device && trim(device.devicePublicId) && trim(device.deviceSecret)) {
      payload.devicePublicId = trim(device.devicePublicId);
      payload.deviceSecret = trim(device.deviceSecret);
    } else {
      payload.agentId = trim(auth == null ? void 0 : auth.id);
      payload.agentName = trim(auth == null ? void 0 : auth.name);
      payload.username = trim(auth == null ? void 0 : auth.username);
      payload.pin = trim((_a = $("giAsstVoicePin")) == null ? void 0 : _a.value);
      if (!trim(payload.pin)) throw Object.assign(new Error("MISSING_PIN"), { code: "MISSING_PIN" });
    }
    if (!device || !trim(device.deviceSecret)) {
      voice.pin = trim(payload.pin);
    }
    const data = await callRealtime(payload);
    const clientSecret = trim(data.clientSecret);
    if (!clientSecret || clientSecret.indexOf("sk-") === 0) throw new Error("OPENAI_ERROR");
    return { clientSecret, sessionId: trim(data.sessionId) };
  }
  async function connectWebRtc(clientSecret) {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    voice.pc = pc;
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "true");
    voice.audio = audio;
    pc.ontrack = (ev) => {
      audio.srcObject = ev.streams[0];
      void audio.play().catch(() => {
      });
    };
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voice.stream = stream;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    const dc = pc.createDataChannel("oai-events");
    voice.dc = dc;
    dc.addEventListener("message", (ev) => handleRealtimeEvent(String(ev.data || "")));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const sdpResponse = await fetch(OPENAI_CALLS_URL, {
      method: "POST",
      body: offer.sdp || "",
      headers: {
        Authorization: "Bearer " + clientSecret,
        "Content-Type": "application/sdp"
      }
    });
    if (!sdpResponse.ok) throw new Error("OPENAI_ERROR");
    const answer = await sdpResponse.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answer });
  }
  async function startVoice() {
    var _a, _b;
    if (voice.state === "connecting" || voice.state === "listening" || voice.state === "speaking") return;
    setVoiceState("connecting");
    try {
      unlockSpeech();
      warmVoices();
      const device = readDevice();
      const pin = trim((_a = $("giAsstVoicePin")) == null ? void 0 : _a.value);
      if (!(device && trim(device.deviceSecret))) {
        if (!pin) throw Object.assign(new Error("MISSING_PIN"), { code: "MISSING_PIN" });
        voice.pin = pin;
      }
      if (speechRecognitionCtor() && ((_b = navigator.mediaDevices) == null ? void 0 : _b.getUserMedia)) {
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          try {
            mic.getTracks().forEach((track) => track.stop());
          } catch (_e) {
          }
        } catch (micErr) {
          const name = trim((micErr == null ? void 0 : micErr.name) || (micErr == null ? void 0 : micErr.message));
          if (name === "NotAllowedError" || name === "MIC_DENIED") {
            throw Object.assign(new Error("MIC_DENIED"), { code: "MIC_DENIED" });
          }
        }
      }
      const opened = await callEngine({
        ...engineAuthPayload(),
        action: "open_session",
        source: device && trim(device.deviceSecret) ? "phone" : "desktop"
      });
      voice.sessionId = trim(opened.sessionId);
      if (!voice.sessionId) throw new Error("MISSING_SESSION");
      try {
        await callEngine({ ...engineAuthPayload(), action: "bootstrap" });
      } catch (_e2) {
      }
      pushTimeline("system", "\u05E1\u05E9\u05DF \u05E2\u05D5\u05D6\u05E8 \u05DE\u05E7\u05D5\u05DE\u05D9 \u05E0\u05E4\u05EA\u05D7.");
      setHeardStatus("");
      conversationLive = true;
      startLocalListening();
      startCommandBus();
      setVoiceState("listening");
      syncTopbarLive();
      if (!isPhonePage()) hideOverlay();
      if (!speechRecognitionCtor()) {
        pushTimeline("info", "\u05D1\u05DE\u05DB\u05E9\u05D9\u05E8 \u05D4\u05D6\u05D4 \u05D0\u05D9\u05DF \u05D3\u05D9\u05D1\u05D5\u05E8 \u05DE\u05D5\u05D1\u05E0\u05D4. \u05DB\u05EA\u05D1\u05D5 \u05E4\u05E7\u05D5\u05D3\u05D4 \u05D1\u05EA\u05D9\u05D1\u05D4.");
      } else {
        pushTimeline("info", "\u05DE\u05E7\u05E9\u05D9\u05D1. \u05D0\u05E4\u05E9\u05E8 \u05D2\u05DD \u05DC\u05DB\u05EA\u05D5\u05D1 \u05D1\u05EA\u05D9\u05D1\u05D4.");
      }
    } catch (err) {
      const code = trim((err == null ? void 0 : err.code) || (err == null ? void 0 : err.name) || (err == null ? void 0 : err.message));
      conversationLive = false;
      await stopVoice(false);
      const mapped = pairingErrorText(code);
      const text = code === "FAILED_TO_FETCH" || code === "TypeError" ? "\u05D0\u05D9\u05DF \u05D7\u05D9\u05D1\u05D5\u05E8 \u05DC\u05E9\u05E8\u05EA \u05D4\u05E2\u05D5\u05D6\u05E8. \u05D1\u05D3\u05E7\u05D5 \u05E9\u05D4\u05E4\u05D5\u05E0\u05E7\u05E6\u05D9\u05D5\u05EA \u05E4\u05D5\u05E8\u05E1\u05DE\u05D5." : mapped === "\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9 \u05DC\u05D4\u05E9\u05DC\u05D9\u05DD \u05D0\u05EA \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8. \u05E0\u05E1\u05D5 \u05E9\u05D5\u05D1." ? "\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9 \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC \u05D0\u05EA \u05D4\u05E9\u05D9\u05D7\u05D4. \u05E0\u05E1\u05D5 \u05E9\u05D5\u05D1." : mapped;
      setVoiceState("error", text);
      syncTopbarLive();
    }
  }
  async function stopVoice(updateUi = true) {
    var _a, _b, _c, _d;
    const sessionId = trim(voice.sessionId);
    const endPayload = { ...engineAuthPayload(), action: "end_session", sessionId };
    stopLocalListening();
    try {
      (_a = voice.dc) == null ? void 0 : _a.close();
    } catch (_e) {
    }
    try {
      (_b = voice.pc) == null ? void 0 : _b.getSenders().forEach((sender) => {
        var _a2;
        return (_a2 = sender.track) == null ? void 0 : _a2.stop();
      });
    } catch (_e2) {
    }
    try {
      (_c = voice.pc) == null ? void 0 : _c.close();
    } catch (_e3) {
    }
    try {
      (_d = voice.stream) == null ? void 0 : _d.getTracks().forEach((track) => track.stop());
    } catch (_e4) {
    }
    voice.dc = null;
    voice.pc = null;
    voice.stream = null;
    voice.audio = null;
    voice.sessionId = "";
    voice.pin = "";
    pendingAction = null;
    utteranceBusy = false;
    lastHeard = "";
    conversationLive = false;
    hideLiveMenu();
    if (sessionId) {
      try {
        await callEngine(endPayload);
      } catch (_e5) {
      }
    }
    if (updateUi) {
      setVoiceState("idle");
      paintConfirm();
    }
    syncTopbarLive();
  }
  function renderAssistantBody() {
    var _a;
    const body = $("giAsstBody");
    const title = $("giAsstTitle");
    if (title) title.textContent = "\u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9 \u05E9\u05DC\u05D9";
    if (!body) return;
    void stopVoice();
    resetEngineUi();
    const needPin = !(readDevice() && trim((_a = readDevice()) == null ? void 0 : _a.deviceSecret));
    body.innerHTML = voiceMarkup(needPin);
    bindVoiceControls(body);
  }
  function remainLabel(expiresAt) {
    const ms = Date.parse(expiresAt) - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return "\u05E4\u05D2 \u05EA\u05D5\u05E7\u05E3";
    const sec = Math.ceil(ms / 1e3);
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, "0");
    return "\u05D4\u05E7\u05D5\u05D3 \u05EA\u05E7\u05E3 \u05E2\u05D5\u05D3 " + m + ":" + s;
  }
  function renderPhoneReturnBody() {
    var _a, _b;
    const body = $("giAsstBody");
    const title = $("giAsstTitle");
    if (title) title.textContent = "\u05D7\u05D6\u05E8\u05D4 \u05DC\u05D8\u05DC\u05E4\u05D5\u05DF";
    if (!body) return;
    const href = phoneHomeUrl();
    const parsed = new URL(href);
    if (Array.from(parsed.searchParams.keys()).length) return;
    body.innerHTML = `
      <p class="giAsst__lead">\u05D4\u05D8\u05DC\u05E4\u05D5\u05DF \u05DB\u05D1\u05E8 \u05DE\u05E7\u05D5\u05E9\u05E8. \u05D6\u05D4 \u05D4\u05D3\u05E3 \u05D4\u05E7\u05D1\u05D5\u05E2 \u2014 \u05DC\u05D0 \u05D7\u05D3\u05BE\u05E4\u05E2\u05DE\u05D9. \u05E4\u05EA\u05D7\u05D5 \u05D0\u05D5\u05EA\u05D5 \u05D1\u05D8\u05DC\u05E4\u05D5\u05DF \u05E9\u05DB\u05D1\u05E8 \u05E7\u05D5\u05E9\u05E8, \u05D0\u05D5 \u05E9\u05DE\u05E8\u05D5 \u05D0\u05D5\u05EA\u05D5 \u05D1\u05DE\u05E1\u05DA \u05D4\u05D1\u05D9\u05EA.</p>
      <div class="giAsst__qrSlot" id="giAsstQrSlot" aria-live="polite"></div>
      <p class="giAsst__hint" id="giAsstPhoneHomeLink">${href}</p>
      <div class="giAsst__voiceActions">
        <button class="giAsst__btn" id="giAsstReturnTalk" type="button">\u05D4\u05EA\u05D7\u05DC \u05E9\u05D9\u05D7\u05D4 \u05D1\u05DE\u05D7\u05E9\u05D1</button>
        <button class="giAsst__btn giAsst__btn--ghost" id="giAsstFreshPhone" type="button">\u05E7\u05E9\u05E8 \u05D8\u05DC\u05E4\u05D5\u05DF \u05E0\u05D5\u05E1\u05E3</button>
      </div>
    `;
    const slot = $("giAsstQrSlot");
    if (slot) paintQr(slot, href);
    (_a = $("giAsstReturnTalk")) == null ? void 0 : _a.addEventListener("click", () => renderAssistantBody());
    (_b = $("giAsstFreshPhone")) == null ? void 0 : _b.addEventListener("click", () => renderActivateBody(true));
  }
  function renderQrBody(href, expiresAt) {
    const body = $("giAsstBody");
    const title = $("giAsstTitle");
    if (title) title.textContent = "\u05D4\u05E4\u05E2\u05DC\u05EA \u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9";
    if (!body) return;
    body.innerHTML = `
      <p class="giAsst__lead">\u05E1\u05E8\u05D5\u05E7 \u05D0\u05EA \u05E7\u05D5\u05D3 \u05D4-QR \u05D1\u05D0\u05DE\u05E6\u05E2\u05D5\u05EA \u05D4\u05D8\u05DC\u05E4\u05D5\u05DF \u05DB\u05D3\u05D9 \u05DC\u05D7\u05D1\u05E8 \u05D0\u05EA \u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9 \u05DC\u05D7\u05E9\u05D1\u05D5\u05DF \u05E9\u05DC\u05DA.</p>
      <div class="giAsst__qrSlot" id="giAsstQrSlot" aria-live="polite"></div>
      <p class="giAsst__timer" id="giAsstTimer">${remainLabel(expiresAt)}</p>
      <p class="giAsst__hint">\u05D4\u05E7\u05D5\u05D3 \u05D7\u05D3\u05BE\u05E4\u05E2\u05DE\u05D9, \u05E7\u05E6\u05E8 \u05D1\u05D6\u05DE\u05DF, \u05D5\u05D0\u05D9\u05E0\u05D5 \u05DE\u05DB\u05D9\u05DC \u05EA\u05E2\u05D5\u05D3\u05EA \u05D6\u05D4\u05D5\u05EA, \u05E1\u05D9\u05E1\u05DE\u05D4 \u05D0\u05D5 \u05DE\u05D6\u05D4\u05D4 \u05DE\u05E9\u05EA\u05DE\u05E9.</p>
    `;
    const slot = $("giAsstQrSlot");
    if (slot) paintQr(slot, href);
  }
  function renderActivateBody(freshPhone = false) {
    pairingFreshPhone = freshPhone === true;
    const body = $("giAsstBody");
    const title = $("giAsstTitle");
    if (title) title.textContent = "\u05D4\u05E4\u05E2\u05DC\u05EA \u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9";
    if (!body) return;
    body.innerHTML = `
      <p class="giAsst__lead">${pairingFreshPhone ? "\u05D4\u05D6\u05D9\u05E0\u05D5 \u05D0\u05EA \u05E7\u05D5\u05D3 \u05D4\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DB\u05D3\u05D9 \u05DC\u05D9\u05E6\u05D5\u05E8 QR \u05D7\u05D3\u05E9 \u05DC\u05D8\u05DC\u05E4\u05D5\u05DF \u05E0\u05D5\u05E1\u05E3. \u05D4\u05E7\u05D5\u05D3 \u05D4\u05D7\u05D3\u05E9 \u05D7\u05D3\u05BE\u05E4\u05E2\u05DE\u05D9." : "\u05E1\u05E8\u05D5\u05E7 \u05D0\u05EA \u05E7\u05D5\u05D3 \u05D4-QR \u05D1\u05D0\u05DE\u05E6\u05E2\u05D5\u05EA \u05D4\u05D8\u05DC\u05E4\u05D5\u05DF \u05DB\u05D3\u05D9 \u05DC\u05D7\u05D1\u05E8 \u05D0\u05EA \u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9 \u05DC\u05D7\u05E9\u05D1\u05D5\u05DF \u05E9\u05DC\u05DA."}</p>
      <form class="giAsst__form" id="giAsstPinForm">
        <label class="giAsst__label" for="giAsstPin">\u05E7\u05D5\u05D3 \u05D4\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DC\u05D7\u05E9\u05D1\u05D5\u05DF</label>
        <input class="giAsst__input" id="giAsstPin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" />
        <button class="giAsst__btn" id="giAsstPinBtn" type="submit">\u05D4\u05E6\u05D2 QR \u05DE\u05D0\u05D5\u05D1\u05D8\u05D7</button>
      </form>
      <div class="giAsst__error" id="giAsstError" role="alert"></div>
      <p class="giAsst__hint">\u05D4\u05E7\u05D5\u05D3 \u05D4\u05D7\u05D3\u05BE\u05E4\u05E2\u05DE\u05D9 \u05E0\u05D5\u05E6\u05E8 \u05D1\u05E9\u05E8\u05EA \u05E8\u05E7 \u05D0\u05D7\u05E8\u05D9 \u05D0\u05D9\u05DE\u05D5\u05EA. \u05D4\u05D5\u05D0 \u05D0\u05D9\u05E0\u05D5 \u05DE\u05DB\u05D9\u05DC \u05EA\u05E2\u05D5\u05D3\u05EA \u05D6\u05D4\u05D5\u05EA, \u05E1\u05D9\u05E1\u05DE\u05D4 \u05D0\u05D5 \u05DE\u05D6\u05D4\u05D4 \u05DE\u05E9\u05EA\u05DE\u05E9.</p>
    `;
    const form = $("giAsstPinForm");
    form == null ? void 0 : form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      void startPairingFromForm();
    });
    window.setTimeout(() => {
      var _a;
      return (_a = $("giAsstPin")) == null ? void 0 : _a.focus();
    }, 40);
  }
  async function pollPairingOnce() {
    const secret = trim(pairing == null ? void 0 : pairing.desktopSecret);
    if (!secret) return;
    try {
      const data = await callPairing({ action: "status", desktopSecret: secret });
      const status = trim(data.status);
      if (status === "paired") {
        const auth = getAuth();
        if (trim(data.devicePublicId) && trim(data.deviceSecret)) {
          writeDevice({
            devicePublicId: trim(data.devicePublicId),
            deviceSecret: trim(data.deviceSecret),
            agentId: trim(data.agentId) || trim(auth == null ? void 0 : auth.id)
          });
        }
        writeLocalPairing(trim(auth == null ? void 0 : auth.id) || trim(data.agentId) || trim(auth == null ? void 0 : auth.name));
        stopPairingPoll();
        pairing = null;
        startCommandBus();
        renderPhoneReturnBody();
        return;
      }
      if (status === "expired" || status === "cancelled" || status === "missing") {
        stopPairingPoll();
        renderActivateBody();
        setActivateError("\u05E4\u05D2 \u05EA\u05D5\u05E7\u05E3 \u05E7\u05D5\u05D3 \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8. \u05D9\u05E9 \u05DC\u05D9\u05E6\u05D5\u05E8 QR \u05D7\u05D3\u05E9.");
        pairing = null;
        return;
      }
      const timer = $("giAsstTimer");
      if (timer && pairing) timer.textContent = remainLabel(pairing.expiresAt);
    } catch (_e) {
    }
  }
  async function startPairingFromForm() {
    var _a;
    const pin = trim((_a = $("giAsstPin")) == null ? void 0 : _a.value);
    const btn = $("giAsstPinBtn");
    setActivateError("");
    if (!pin) {
      setActivateError("\u05E0\u05D0 \u05DC\u05D4\u05D6\u05D9\u05DF \u05D0\u05EA \u05E7\u05D5\u05D3 \u05D4\u05DB\u05E0\u05D9\u05E1\u05D4.");
      return;
    }
    const auth = getAuth();
    if (btn) btn.disabled = true;
    try {
      const data = await callPairing({
        action: "create",
        agentId: trim(auth == null ? void 0 : auth.id),
        agentName: trim(auth == null ? void 0 : auth.name),
        username: trim(auth == null ? void 0 : auth.username),
        pin,
        freshPhone: pairingFreshPhone === true
      });
      if (data.alreadyPaired === true) {
        if (trim(data.devicePublicId) && trim(data.deviceSecret)) {
          writeDevice({
            devicePublicId: trim(data.devicePublicId),
            deviceSecret: trim(data.deviceSecret),
            agentId: trim(data.agentId) || trim(auth == null ? void 0 : auth.id)
          });
        }
        writeLocalPairing(trim(auth == null ? void 0 : auth.id) || trim(data.agentId) || trim(auth == null ? void 0 : auth.name));
        startCommandBus();
        renderPhoneReturnBody();
        return;
      }
      const publicToken = trim(data.publicToken);
      const desktopSecret = trim(data.desktopSecret);
      const expiresAt = trim(data.expiresAt);
      if (!publicToken || !desktopSecret) throw new Error("BAD_CREATE");
      const href = phoneEntryUrl(publicToken);
      const parsed = new URL(href);
      const keys = Array.from(parsed.searchParams.keys());
      if (keys.some((k) => k !== "p") || !trim(parsed.searchParams.get("p"))) {
        throw new Error("UNSAFE_QR");
      }
      await cancelPairing();
      pairing = { publicToken, desktopSecret, expiresAt, pollTimer: 0 };
      renderQrBody(href, expiresAt);
      pairing.pollTimer = window.setInterval(() => {
        void pollPairingOnce();
      }, POLL_MS);
    } catch (err) {
      const code = trim((err == null ? void 0 : err.code) || (err == null ? void 0 : err.message));
      setActivateError(pairingErrorText(code));
    } finally {
      if (btn) btn.disabled = false;
    }
  }
  function openFromTopBar() {
    var _a, _b;
    if (!isLoggedIn()) {
      try {
        (_a = window.showToast) == null ? void 0 : _a.call(window, {
          title: "\u05E0\u05D3\u05E8\u05E9\u05EA \u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA",
          text: "\u05D9\u05E9 \u05DC\u05D4\u05EA\u05D7\u05D1\u05E8 \u05DC\u05DE\u05E2\u05E8\u05DB\u05EA \u05DC\u05E4\u05E0\u05D9 \u05E4\u05EA\u05D9\u05D7\u05EA \u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9.",
          variant: "warn",
          durationMs: 4200
        });
      } catch (_e) {
      }
      return;
    }
    if (!canAccessPersonalAssistant()) {
      try {
        (_b = window.showToast) == null ? void 0 : _b.call(window, {
          title: "\u05D0\u05D9\u05DF \u05D4\u05E8\u05E9\u05D0\u05D4",
          text: "\u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9 \u05D6\u05DE\u05D9\u05DF \u05DC\u05DE\u05E0\u05D4\u05DC \u05DE\u05E2\u05E8\u05DB\u05EA \u05D5\u05DE\u05E0\u05D4\u05DC \u05DE\u05D0\u05E9\u05E8 \u05D1\u05DC\u05D1\u05D3.",
          variant: "warn",
          durationMs: 4200
        });
      } catch (_e) {
      }
      return;
    }
    if (isConversationLive()) {
      if (liveMenuOpen) hideLiveMenu();
      else showLiveMenu();
      return;
    }
    ensureRoot();
    if (hasActiveDevicePairing()) renderAssistantBody();
    else renderActivateBody();
    openOverlay();
  }
  function onButtonClick(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    openFromTopBar();
  }
  function bindButton() {
    const btn = $("btnPersonalAssistant");
    if (!btn || btn.getAttribute("data-gi-asst-bound") === "1") return;
    btn.setAttribute("data-gi-asst-bound", "1");
    btn.addEventListener("click", onButtonClick);
  }
  function setPhoneStatus(text, tone) {
    const el = $("giAsstPhoneStatus");
    if (!el) return;
    el.textContent = text || "";
    el.className = "giAsstPhone__status" + (tone ? " is-" + tone : "");
  }
  function renderPhoneAssistant() {
    const root = $("giAsstPhone");
    if (!root) return;
    void stopVoice();
    resetEngineUi();
    root.innerHTML = `
      <header class="giAsstPhone__head">
        <div class="giAsstPhone__kicker">GEMEL INVEST</div>
        <h1 class="giAsstPhone__title">\u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9 \u05E9\u05DC\u05D9</h1>
      </header>
      ${voiceMarkup(false)}
    `;
    bindVoiceControls(root);
  }
  function renderPhoneLogin(publicToken) {
    var _a;
    const root = $("giAsstPhone");
    if (!root) return;
    root.innerHTML = `
      <header class="giAsstPhone__head">
        <div class="giAsstPhone__kicker">GEMEL INVEST</div>
        <h1 class="giAsstPhone__title">\u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9 \u05E9\u05DC\u05D9</h1>
      </header>
      <p class="giAsst__lead">\u05D4\u05EA\u05D7\u05D1\u05E8\u05D5 \u05E2\u05DD \u05D4\u05DE\u05E9\u05EA\u05DE\u05E9 \u05E9\u05DC \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA \u05DB\u05D3\u05D9 \u05DC\u05E7\u05E9\u05E8 \u05D0\u05EA \u05D4\u05DE\u05DB\u05E9\u05D9\u05E8.</p>
      <form class="giAsst__form" id="giAsstPhoneForm">
        <label class="giAsst__label" for="giAsstPhoneUser">\u05E9\u05DD \u05DE\u05E9\u05EA\u05DE\u05E9</label>
        <input class="giAsst__input" id="giAsstPhoneUser" type="text" autocomplete="username" />
        <label class="giAsst__label" for="giAsstPhonePin">\u05E7\u05D5\u05D3 \u05DB\u05E0\u05D9\u05E1\u05D4</label>
        <input class="giAsst__input" id="giAsstPhonePin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" />
        <button class="giAsst__btn" id="giAsstPhoneBtn" type="submit">\u05E7\u05D9\u05E9\u05D5\u05E8 \u05D4\u05DE\u05DB\u05E9\u05D9\u05E8</button>
      </form>
      <div class="giAsstPhone__status" id="giAsstPhoneStatus" role="status"></div>
    `;
    (_a = $("giAsstPhoneForm")) == null ? void 0 : _a.addEventListener("submit", async (ev) => {
      var _a2, _b;
      ev.preventDefault();
      const username = trim((_a2 = $("giAsstPhoneUser")) == null ? void 0 : _a2.value);
      const pin = trim((_b = $("giAsstPhonePin")) == null ? void 0 : _b.value);
      const btn = $("giAsstPhoneBtn");
      if (!username || !pin) {
        setPhoneStatus("\u05E0\u05D0 \u05DC\u05D4\u05D6\u05D9\u05DF \u05E9\u05DD \u05DE\u05E9\u05EA\u05DE\u05E9 \u05D5\u05E7\u05D5\u05D3 \u05DB\u05E0\u05D9\u05E1\u05D4.", "err");
        return;
      }
      if (btn) btn.disabled = true;
      setPhoneStatus("\u05DE\u05D0\u05DE\u05EA \u05D0\u05EA \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8\u2026");
      try {
        const data = await callPairing({
          action: "consume",
          publicToken,
          username,
          pin
        });
        writeDevice({
          devicePublicId: trim(data.devicePublicId),
          deviceSecret: trim(data.deviceSecret),
          agentId: trim(data.agentId)
        });
        writeLocalPairing(trim(data.agentId));
        stripPhoneTokenFromUrl();
        renderPhoneAssistant();
      } catch (err) {
        const code = trim((err == null ? void 0 : err.code) || (err == null ? void 0 : err.message));
        if (code === "TOKEN_INVALID") {
          renderPhoneUsedToken();
          return;
        }
        setPhoneStatus(pairingErrorText(code), "err");
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }
  function renderPhoneUsedToken() {
    const root = $("giAsstPhone");
    if (!root) return;
    const href = phoneHomeUrl();
    root.innerHTML = `
      <header class="giAsstPhone__head">
        <div class="giAsstPhone__kicker">GEMEL INVEST</div>
        <h1 class="giAsstPhone__title">\u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9 \u05E9\u05DC\u05D9</h1>
      </header>
      <p class="giAsst__lead">\u05D4\u05E7\u05D5\u05D3 \u05E9\u05E1\u05E8\u05E7\u05EA\u05DD \u05DB\u05D1\u05E8 \u05E0\u05D5\u05E6\u05DC. \u05D6\u05D4 \u05EA\u05E7\u05D9\u05DF \u2014 \u05E7\u05D9\u05E9\u05D5\u05E8 \u05D4-QR \u05D4\u05E8\u05D0\u05E9\u05D5\u05DF \u05D4\u05D5\u05D0 \u05D7\u05D3\u05BE\u05E4\u05E2\u05DE\u05D9.</p>
      <p class="giAsst__hint">\u05D0\u05DD \u05D6\u05D4 \u05D4\u05D8\u05DC\u05E4\u05D5\u05DF \u05E9\u05DB\u05D1\u05E8 \u05E7\u05D5\u05E9\u05E8, \u05E4\u05EA\u05D7\u05D5 \u05D0\u05EA \u05D4\u05D3\u05E3 \u05D4\u05E7\u05D1\u05D5\u05E2. \u05D0\u05DD \u05D6\u05D4 \u05D8\u05DC\u05E4\u05D5\u05DF \u05D0\u05D7\u05E8, \u05D1\u05E7\u05E9\u05D5 \u05D1\u05DE\u05D7\u05E9\u05D1 \xAB\u05E7\u05E9\u05E8 \u05D8\u05DC\u05E4\u05D5\u05DF \u05E0\u05D5\u05E1\u05E3\xBB.</p>
      <a class="giAsst__btn" id="giAsstPhoneHomeBtn" href="${href}">\u05E4\u05EA\u05D7 \u05D0\u05EA \u05D3\u05E3 \u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05E7\u05D1\u05D5\u05E2</a>
    `;
  }
  function bootPhone() {
    document.body.classList.add("giAsstPhonePage");
    if (hasActiveDevicePairing()) {
      stripPhoneTokenFromUrl();
      renderPhoneAssistant();
      return;
    }
    const publicToken = trim(new URLSearchParams(window.location.search).get("p"));
    if (!publicToken) {
      const root = $("giAsstPhone");
      if (root) {
        root.innerHTML = `
          <header class="giAsstPhone__head">
            <div class="giAsstPhone__kicker">GEMEL INVEST</div>
            <h1 class="giAsstPhone__title">\u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9 \u05E9\u05DC\u05D9</h1>
          </header>
          <p class="giAsst__lead">\u05D4\u05D8\u05DC\u05E4\u05D5\u05DF \u05D4\u05D6\u05D4 \u05E2\u05D3\u05D9\u05D9\u05DF \u05DC\u05D0 \u05DE\u05E7\u05D5\u05E9\u05E8. \u05E1\u05E8\u05E7\u05D5 \u05DE\u05D4\u05DE\u05D7\u05E9\u05D1 QR \u05D7\u05D3\u05E9, \u05D0\u05D5 \u05D1\u05E7\u05E9\u05D5 \xAB\u05E7\u05E9\u05E8 \u05D8\u05DC\u05E4\u05D5\u05DF \u05E0\u05D5\u05E1\u05E3\xBB.</p>
        `;
      }
      return;
    }
    renderPhoneLogin(publicToken);
  }
  function init(nextBridge) {
    var _a;
    if (nextBridge && typeof nextBridge === "object") bridge = nextBridge;
    if (((_a = document.body) == null ? void 0 : _a.getAttribute("data-gi-asst-page")) === "phone") {
      bootPhone();
      return;
    }
    ensureRoot();
    bindButton();
    syncButtonVisibility();
    if (bound) return;
    bound = true;
    window.addEventListener("gi:app-login-ready", () => {
      syncButtonVisibility();
      startCommandBus();
    });
    window.addEventListener("gi:app-logout", () => {
      void cancelPairing();
      stopCommandBus();
      closeOverlay();
      syncButtonVisibility();
    });
    if (isLoggedIn()) startCommandBus();
  }
  function onLogin() {
    syncButtonVisibility();
    startCommandBus();
  }
  function onLogout() {
    void cancelPairing();
    void stopVoice();
    stopCommandBus();
    closeOverlay();
    syncButtonVisibility();
  }
  const api = {
    init,
    onLogin,
    onLogout,
    hasActiveDevicePairing,
    openFromTopBar,
    phoneEntryUrl,
    phoneHomeUrl,
    startVoice,
    stopVoice,
    endLiveConversation,
    hideOverlay,
    isConversationLive,
    getVoiceState() {
      return voice.state;
    },
    proposeWrite,
    confirmPending,
    cancelPending,
    classifyIntent,
    parseLocalCommand,
    commandFromLocalTool,
    pickHebrewVoice,
    scoreHebrewVoice,
    preferredVoiceGender,
    prepareSpeechText,
    applyVoiceTone,
    numberToHebrew,
    replyFromTool,
    shortActionAck,
    isSpokenQuestion,
    looksLikePhone,
    looksLikeIdNumber,
    redactSafe,
    invokeTool,
    executeClientCommand,
    applyCrmWraps,
    applySimWraps,
    paintHits,
    dispatchDesktopCommand,
    pullDesktopCommands,
    startCommandBus,
    getPendingAction() {
      return pendingAction;
    },
    getLastIntent() {
      return lastIntent;
    },
    getTimeline() {
      return timelineItems.slice();
    }
  };
  try {
    window.GiAssistant = api;
  } catch (_e) {
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(), { once: true });
  } else {
    init();
  }
})();
