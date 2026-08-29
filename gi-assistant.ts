/* GI-ASSISTANT — pairing, Realtime voice, engine, tools, CRM, and simulator wraps (P3–P12).
   Compiled to gi-assistant.js. Do not edit the compiled file by hand. */
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
  const UI_COMMANDS = new Set([
    "open_customer", "go_view", "open_simulator", "open_proposal",
    "open_wizard", "refresh_reminders", "upsert_reminder", "mark_task_done",
    "fill_wizard", "wizard_next", "open_har_import", "click_topbar"
  ]);

  type AgentAuth = {
    id?: string;
    name?: string;
    role?: string;
    username?: string;
  } | null;

  type AssistantBridge = {
    getAuth?: () => AgentAuth;
    getCurrentAgent?: () => AgentAuth;
    supabaseUrl?: string;
    publishableKey?: string;
    openCustomer?: (id: string) => void;
    goView?: (view: string) => void;
    openSimulator?: (company: string, product: string) => void | Promise<unknown>;
    quoteSimulator?: (company: string, product: string, input?: Record<string, unknown>) => Promise<Record<string, unknown> | unknown>;
    openWizard?: (opts?: Record<string, unknown>) => void | Promise<unknown>;
    fillWizard?: (fields: Record<string, unknown>) => void;
    wizardNext?: () => void | Promise<unknown>;
    openHarImport?: () => void | { ok?: boolean; error?: string };
    clickTopbar?: (id: string) => void;
    openCustomerByQuery?: (query: string) => void | Promise<unknown>;
    openProposal?: (id: string) => void;
    refreshReminders?: () => void | Promise<unknown>;
    searchCustomers?: (query: string) => Promise<HitCard[] | unknown[]>;
    findCustomerByIdNumber?: (id: string) => HitCard | null;
    findCustomerById?: (id: string) => HitCard | null;
    upsertReminder?: (row: Record<string, unknown>) => void | Promise<unknown>;
    markTaskDone?: (id: string) => void | Promise<unknown>;
    listTasks?: () => unknown[];
  };

  type HitCard = {
    id?: string;
    full_name?: string;
    city?: string;
    agent_name?: string;
    existing_policies_count?: number;
    new_policies_count?: number;
    type?: string;
    details?: string;
    remind_at?: string;
    customer_name?: string;
    kind?: "customer" | "task" | "quote";
  };

  type PairingSession = {
    desktopSecret: string;
    publicToken: string;
    expiresAt: string;
    pollTimer: number;
  };

  type VoiceState = "idle" | "connecting" | "listening" | "speaking" | "error";

  type VoiceRuntime = {
    state: VoiceState;
    sessionId: string;
    pin: string;
    pc: RTCPeerConnection | null;
    dc: RTCDataChannel | null;
    stream: MediaStream | null;
    audio: HTMLAudioElement | null;
    error: string;
    recognition: { start: () => void; stop: () => void } | null;
  };

  type LocalCommand = {
    tool?: string;
    args?: Record<string, unknown>;
    kind?: "help";
    say?: string;
  };

  type TimelineItem = {
    kind: string;
    text: string;
  };

  type PendingAction = {
    id: string;
    label: string;
  } | null;

  let bridge: AssistantBridge = {};
  let bound = false;
  let pairing: PairingSession | null = null;
  let voice: VoiceRuntime = {
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
  let pendingAction: PendingAction = null;
  let timelineItems: TimelineItem[] = [];
  let lastIntent = "";
  let commandPoll = 0;
  let utteranceBusy = false;
  let lastHeard = "";
  let pairingFreshPhone = false;
  let lastCustomerId = "";
  let lastCustomerName = "";

  function trim(value: unknown): string {
    return String(value == null ? "" : value).trim();
  }

  function $(id: string): HTMLElement | null {
    return document.getElementById(id);
  }

  function readBridge(): AssistantBridge {
    try {
      const fromWindow = (window as Window & { __GI_ASSISTANT_BRIDGE__?: AssistantBridge }).__GI_ASSISTANT_BRIDGE__;
      if (fromWindow && typeof fromWindow === "object") return { ...fromWindow, ...bridge };
    } catch (_e) {}
    return bridge;
  }

  function getAuth(): AgentAuth {
    const active = readBridge();
    try {
      if (typeof active.getCurrentAgent === "function") {
        const agent = active.getCurrentAgent();
        if (agent && (trim(agent.id) || trim(agent.name))) return agent;
      }
    } catch (_e) {}
    try {
      if (typeof active.getAuth === "function") return active.getAuth() || null;
    } catch (_e2) {}
    return null;
  }

  function isLoggedIn(): boolean {
    const auth = getAuth();
    return !!(auth && (trim(auth.id) || trim(auth.name)));
  }

  function isPhonePage(): boolean {
    try { return document.body?.getAttribute("data-gi-asst-page") === "phone"; } catch (_e) { return false; }
  }

  function supabaseConfig(){
    const active = readBridge();
    return {
      url: trim(active.supabaseUrl) || FALLBACK_SUPABASE_URL,
      key: trim(active.publishableKey) || FALLBACK_PUBLISHABLE_KEY
    };
  }

  function readLocalPairing(): { agentId?: string; paired?: boolean } | null {
    try {
      const raw = window.localStorage.getItem(PAIRING_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as { agentId?: string; paired?: boolean };
    } catch (_e) {
      return null;
    }
  }

  function writeLocalPairing(agentId: string): void {
    try {
      window.localStorage.setItem(PAIRING_STORAGE_KEY, JSON.stringify({
        paired: true,
        agentId: trim(agentId),
        at: new Date().toISOString()
      }));
    } catch (_e) {}
  }

  function readDevice(): { devicePublicId?: string; deviceSecret?: string; agentId?: string } | null {
    try {
      const raw = window.localStorage.getItem(DEVICE_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as { devicePublicId?: string; deviceSecret?: string; agentId?: string };
    } catch (_e) {
      return null;
    }
  }

  function writeDevice(row: { devicePublicId: string; deviceSecret: string; agentId: string }): void {
    try {
      window.localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify({
        devicePublicId: trim(row.devicePublicId),
        deviceSecret: trim(row.deviceSecret),
        agentId: trim(row.agentId),
        at: new Date().toISOString()
      }));
    } catch (_e) {}
  }

  function hasActiveDevicePairing(): boolean {
    const device = readDevice();
    if (device && trim(device.devicePublicId) && trim(device.deviceSecret)) return true;
    if (!isLoggedIn()) return false;
    const parsed = readLocalPairing();
    const auth = getAuth();
    const agentId = trim(auth?.id) || trim(auth?.name);
    if (!parsed || parsed.paired !== true) return false;
    if (agentId && trim(parsed.agentId) && trim(parsed.agentId) !== agentId) return false;
    return true;
  }

  function phoneEntryUrl(publicToken: string): string {
    const url = new URL("assistant.html", window.location.href);
    url.searchParams.set("p", trim(publicToken));
    return url.href;
  }

  function phoneHomeUrl(): string {
    return new URL("assistant.html", window.location.href).href;
  }

  function stripPhoneTokenFromUrl(): void {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("p")) return;
      url.search = "";
      window.history.replaceState({}, "", url.pathname + url.hash);
    } catch (_e) {}
  }

  function qrImageUrl(text: string, provider: "qrserver" | "quickchart"): string {
    const data = encodeURIComponent(text);
    if (provider === "quickchart") return "https://quickchart.io/qr?size=220&margin=1&text=" + data;
    return "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=1&data=" + data;
  }

  function paintQr(host: HTMLElement, href: string): void {
    host.innerHTML = "";
    const img = document.createElement("img");
    img.alt = "QR לחיבור העוזר האישי";
    img.width = 220;
    img.height = 220;
    img.className = "giAsst__qrImg";
    img.src = qrImageUrl(href, "qrserver");
    img.onerror = function(){
      img.onerror = null;
      img.src = qrImageUrl(href, "quickchart");
    };
    host.appendChild(img);
    const link = document.createElement("a");
    link.className = "giAsst__qrLink";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "פתיחה בטלפון";
    host.appendChild(link);
  }

  async function callEdge(fnPath: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
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
    let data: Record<string, unknown> = {};
    try { data = await res.json() as Record<string, unknown>; } catch (_e) { data = {}; }
    if (!res.ok || data.ok === false) {
      const code = trim(data.error || data.code || ("HTTP_" + res.status));
      const err = new Error(code || ("HTTP_" + res.status));
      (err as Error & { code?: string }).code = code || ("HTTP_" + res.status);
      throw err;
    }
    return data;
  }

  function callPairing(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return callEdge(FN_PAIRING_PATH, payload);
  }

  function callRealtime(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return callEdge(FN_REALTIME_PATH, payload);
  }

  function callEngine(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return callEdge(FN_ENGINE_PATH, payload);
  }

  function callTools(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return callEdge(FN_TOOLS_PATH, payload);
  }

  function redactSafe(text: unknown): string {
    return trim(text).replace(/\d{8,9}/g, "[מזהה]").slice(0, 280);
  }

  function classifyIntent(text: string): "confirm" | "cancel" | "other" {
    const normalized = trim(text).replace(/[!.?,]/g, "");
    if (/^(כן|בטח|אשרי?|תאשר|מאשר|יאללה|קדימה)$/.test(normalized)) return "confirm";
    if (/^(לא|בטל|ביטול|אל תאשר|לא לאשר)$/.test(normalized)) return "cancel";
    return "other";
  }

  const LOCAL_VOICE_HELP = "אפשר למלא את האשף לפי תווית. לדוגמה: שם פרטי אוריה, שם משפחה סומך, תז, טלפון, כתובת, עיר, ומייל. כשהשלב מלא, אמרו תעברי לשלב הבא. בשלב הפוליסות, אמרו תפתחי את הפק ביטוחים מהר הביטוח.";

  function extractCompany(text: string): string {
    const companies = ["הפניקס", "מנורה", "הכשרה", "מגדל", "איילון", "כלל"];
    for (let i = 0; i < companies.length; i += 1) {
      if (text.indexOf(companies[i]) >= 0) return companies[i];
    }
    return "";
  }

  function extractProduct(text: string): string {
    if (/ריסק\s*משכנתא/.test(text)) return "ריסק משכנתא";
    if (/מחלות\s*קשות/.test(text)) return "מחלות קשות";
    if (/מוות\s*מתאונה/.test(text)) return "מוות מתאונה";
    if (/נכות\s*מתאונה/.test(text)) return "נכות מתאונה";
    if (/סרטן/.test(text)) return "סרטן";
    if (/בריאות/.test(text)) return "בריאות";
    if (/ריסק/.test(text)) return "ריסק";
    return "";
  }

  function extractView(text: string): string {
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
    if (/הצעות/.test(text)) return "proposals";
    if ((/סימול/.test(text) && !extractCompany(text)) || /כלים/.test(text)) return "myTools";
    if (/לוח|ראשי|דשבורד/.test(text)) return "dashboard";
    if (/מכירות/.test(text)) return "dailySales";
    if (/אנשי\s*קשר|קשרים/.test(text)) return "contacts";
    if (/תהליכ/.test(text)) return "myProcesses";
    if (/לקוח|תיק/.test(text)) return "customers";
    return "";
  }

  function extractTopbar(text: string): string {
    if (/צאט|צ.אט/.test(text)) return "giChatFab";
    if (/תזכורות/.test(text)) return "giReminderFab";
    if (/נסיעות/.test(text)) return "btnTravelInsuranceAbroad";
    if (/רכב\s*בקליק|ביטוח\s*רכב/.test(text)) return "btnCarInsuranceClick";
    if (/מרכז\s*הסימול/.test(text)) return "btnSimulatorsCenter";
    if (/הקמת\s*הצעה|הצעה\s*חדשה/.test(text)) return "btnNewCustomerWizard";
    return "";
  }

  function isOpenNavSpeech(text: string): boolean {
    return /(?:עבור|תעבור|עברי|תעברי|לך|לכי|תיכנסי?|היכנסי?|כנסי|פתח|תפתח|תפתחי|תפתחו|תצפתחי)/.test(text);
  }

  function extractFillFields(text: string): Record<string, unknown> | null {
    const raw = trim(text).replace(/[!,?״"']/g, " ").replace(/\s+/g, " ");
    if (!raw) return null;
    const labels: Array<{ key: string; re: RegExp }> = [
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
    type Hit = { key: string; start: number; end: number };
    const hits: Hit[] = [];
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
    const fields: Record<string, unknown> = {};
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
      if (/ידוע(?:ה)?\s*בציבור/.test(raw)) fields.maritalStatus = "ידוע/ה בציבור";
      else if (/אלמנ/.test(raw)) fields.maritalStatus = "אלמן/ה";
      else if (/גרוש/.test(raw)) fields.maritalStatus = "גרוש/ה";
      else if (/נשוי|נשואה/.test(raw)) fields.maritalStatus = "נשוי/אה";
      else if (/רווק/.test(raw)) fields.maritalStatus = "רווק/ה";
    }
    if (!fields.clinic) {
      if (/כללית/.test(raw)) fields.clinic = "כללית";
      else if (/מכבי/.test(raw)) fields.clinic = "מכבי";
      else if (/מאוחדת/.test(raw)) fields.clinic = "מאוחדת";
      else if (/לאומית/.test(raw)) fields.clinic = "לאומית";
      else if (/צהל/.test(raw)) fields.clinic = "קופה צהלית";
    }
    if (fields.smoker === true && !fields.smokingType) {
      if (/סיגריה אלקטרונית/.test(raw)) fields.smokingType = "סיגריה אלקטרונית";
      else if (/קנאביס/.test(raw)) fields.smokingType = "קנאביס";
      else if (/נרגילה/.test(raw)) fields.smokingType = "נרגילה";
      else if (/טבק/.test(raw)) fields.smokingType = "טבק";
      else if (/סיגריות/.test(raw)) fields.smokingType = "סיגריות";
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

  function parseLocalCommand(text: string): LocalCommand | null {
    const raw = trim(text).replace(/[!.?,״"']/g, " ").replace(/\s+/g, " ");
    if (!raw) return null;
    if (classifyIntent(raw) !== "other") return null;
    if (/^(עזרה|מה אתה יכול|מה אפשר)/.test(raw)) return { kind: "help", say: LOCAL_VOICE_HELP };
    if (/(חפש|תחפש|מצא|תמצא|חיפוש)/.test(raw)) {
      const query = raw.replace(/^(?:אפשר\s+)?(?:בבקשה\s+)?(?:חפש|תחפש|מצא|תמצא|חיפוש)\s+(?:לי\s+)?(?:את\s+)?(?:לקוח\s+)?(?:תיק\s+)?/, "");
      return { tool: "search_customer", args: { query: query || raw } };
    }
    if (/(?:פתח|תפתח|תפתחי)\s+(?:את\s+)?(?:ה)?(?:תיק|לקוח)(?!\S)/.test(raw)) {
      const query = raw.replace(/^.*?(?:התיק|תיק|לקוח)\s+(?:של\s+)?/, "");
      return { tool: "find_customer_by_id", args: { query: query || raw } };
    }
    if (/תזכיר לי|(צור|הוסף|תפתח).*(משימה|תזכורת)/.test(raw)) {
      const details = raw.replace(/^.*?(?:משימה|תזכורת|תזכיר לי)\s*/, "") || raw;
      return { tool: "create_task", args: { type: "תזכורת", details } };
    }
    if (/משימות/.test(raw) || (/תזכורות/.test(raw) && !isOpenNavSpeech(raw))) return { tool: "get_tasks", args: {} };
    if (/(?:תעברי?|תעבור|עברי|עבור|לכי|לך|המשיכי|המשך)\s+(?:ל)?שלב\s+הבא|שלב הבא|לשלב הבא|הבא באשף/.test(raw)) {
      return { tool: "wizard_next", args: {} };
    }
    if (/(?:תפתח|פתח|תפתחי|העלי|תעלה).*(?:הר הביטוח|הפק\s*ביטוח|הפק\s*פוליס)|הפק\s*(?:ביטוחים|פוליסות)\s*מהר/.test(raw)) {
      return { tool: "open_har_import", args: {} };
    }
    if (isOpenNavSpeech(raw)) {
      const topbar = extractTopbar(raw);
      if (topbar) return { tool: "click_topbar", args: { id: topbar } };
      const view = extractView(raw);
      if (view) return { tool: "go_view", args: { view } };
    }
    if (/מחיר|ציטוט|פרמיה|כמה עולה/.test(raw)) {
      const args: Record<string, unknown> = {
        company: extractCompany(raw) || "מנורה",
        product: extractProduct(raw) || "ריסק"
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
    if (/סימולטור/.test(raw) || (extractCompany(raw) && extractProduct(raw) && /פתח/.test(raw))) {
      const company = extractCompany(raw);
      const product = extractProduct(raw) || "ריסק";
      if (company) return { tool: "open_simulator", args: { company, product } };
    }
    if (/(הקם|הקימי|צור|תפתח|תפתחי|פתח|בנה).*(הצעה)|הצעה חדשה|הצעה ל/.test(raw)) {
      const query = raw.replace(/^.*?(?:הצעה(?:\s+חדשה)?)\s*(?:ל|עבור|של)?\s*/, "");
      const args: Record<string, unknown> = {};
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
    if (/^(היי|שלום|תודה|בוקר טוב|ערב טוב)$/.test(raw)) return { kind: "help", say: LOCAL_VOICE_HELP };
    if (raw.length >= 2) return { tool: "search_customer", args: { query: raw } };
    return { kind: "help", say: LOCAL_VOICE_HELP };
  }

  function engineAuthPayload(): Record<string, unknown> {
    const device = readDevice();
    const auth = getAuth();
    const payload: Record<string, unknown> = { sessionId: trim(voice.sessionId) };
    if (device && trim(device.devicePublicId) && trim(device.deviceSecret)) {
      payload.devicePublicId = trim(device.devicePublicId);
      payload.deviceSecret = trim(device.deviceSecret);
    } else {
      payload.agentId = trim(auth?.id);
      payload.agentName = trim(auth?.name);
      payload.username = trim(auth?.username);
      payload.pin = trim(voice.pin);
    }
    return payload;
  }

  function pairingErrorText(code: string): string {
    if (code === "AUTH_FAILED" || code === "MISSING_PIN") return "קוד הכניסה שגוי.";
    if (code === "TOKEN_INVALID") return "קוד הקישור החד־פעמי כבר נוצל. פתחו את הדף הקבוע של העוזר או בקשו קישור חדש מהמחשב.";
    if (code === "AGENT_MISMATCH") return "המשתמש שזוהה אינו מי שהתחיל את הקישור.";
    if (code === "NOT_FOUND" || code === "HTTP_404" || code.indexOf("HTTP_404") === 0) {
      return "שרת הקישור עדיין לא פורסם. צריך לפרסם ב-Supabase את gi-assistant-pairing.";
    }
    if (code === "FAILED_TO_FETCH" || code === "TypeError") return "אין חיבור לשרת הקישור. הריצו את supabase-assistant-pairing.sql ופרסו את הפונקציה.";
    if (code === "MISSING_OPENAI_KEY") return "חסר מפתח OpenAI בשרת. יש להגדיר את הסוד ב-Edge secrets.";
    if (code === "OPENAI_INVALID_KEY") return "מפתח OpenAI שגוי. צרו מפתח חדש ב-platform.openai.com והחליפו ב-Secrets.";
    if (code === "OPENAI_QUOTA") return "אין יתרה בחשבון OpenAI. הוסיפו אמצעי תשלום ב-platform.openai.com.";
    if (code === "OPENAI_FORBIDDEN") return "החשבון לא מורשה למודל הקול. בדקו גישת Realtime ב-OpenAI.";
    if (code === "OPENAI_ERROR") return "שרת הקול לא זמין כרגע. נסו שוב בעוד רגע.";
    if (code === "MIC_DENIED" || code === "NotAllowedError") return "נדרשת הרשאת מיקרופון כדי לדבר עם העוזר.";
    if (code === "MIC_MISSING" || code === "NotFoundError") return "לא נמצא מיקרופון במכשיר.";
    if (code === "SPEECH_UNSUPPORTED") return "הדפדפן לא תומך בדיבור מקומי. פתחו את המערכת ב-Chrome.";
    return "לא הצלחתי להשלים את הקישור. נסו שוב.";
  }

  function voiceStateLabel(state: VoiceState): string {
    if (state === "connecting") return "מתחבר…";
    if (state === "listening") return "מקשיב";
    if (state === "speaking") return "העוזר מדבר";
    if (state === "error") return voice.error || "לא הצלחתי להתחבר לקול.";
    return "דבר עם המערכת";
  }

  function stopPairingPoll(): void {
    if (pairing?.pollTimer) {
      window.clearInterval(pairing.pollTimer);
      pairing.pollTimer = 0;
    }
  }

  async function cancelPairing(): Promise<void> {
    const secret = trim(pairing?.desktopSecret);
    stopPairingPoll();
    pairing = null;
    if (!secret) return;
    try { await callPairing({ action: "cancel", desktopSecret: secret }); } catch (_e) {}
  }

  function syncButtonVisibility(): void {
    const btn = $("btnPersonalAssistant");
    if (!btn) return;
    const show = isLoggedIn();
    btn.classList.toggle("is-hidden", !show);
    btn.setAttribute("aria-hidden", show ? "false" : "true");
    if (show) btn.removeAttribute("hidden");
    else btn.setAttribute("hidden", "hidden");
  }

  function ensureRoot(): HTMLElement {
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
              <h2 class="giAsst__title" id="giAsstTitle">הפעלת העוזר האישי</h2>
            </div>
            <button class="giAsst__close" id="giAsstClose" type="button" aria-label="סגור">✕</button>
          </header>
          <div class="giAsst__body" id="giAsstBody"></div>
        </section>
      </div>
    `;
    document.body.appendChild(root);
    $("giAsstClose")?.addEventListener("click", () => closeOverlay());
    root.querySelector("[data-gi-asst-close]")?.addEventListener("click", () => closeOverlay());
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && isOverlayOpen()) closeOverlay();
    });
    return root;
  }

  function isOverlayOpen(): boolean {
    const overlay = $("giAsstOverlay");
    return !!(overlay && !overlay.classList.contains("is-hidden"));
  }

  function closeOverlay(): void {
    void cancelPairing();
    void stopVoice();
    const overlay = $("giAsstOverlay");
    if (!overlay) return;
    overlay.classList.add("is-hidden");
    overlay.setAttribute("hidden", "hidden");
    overlay.setAttribute("aria-hidden", "true");
    $("btnPersonalAssistant")?.focus();
  }

  function openOverlay(): void {
    ensureRoot();
    const overlay = $("giAsstOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-hidden");
    overlay.removeAttribute("hidden");
    overlay.setAttribute("aria-hidden", "false");
    window.setTimeout(() => $("giAsstClose")?.focus(), 40);
  }

  function setActivateError(msg: string): void {
    const box = $("giAsstError");
    if (box) box.textContent = msg || "";
  }

  function paintVoiceState(): void {
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
    const startBtn = root.querySelector("#giAsstVoiceStart") as HTMLButtonElement | null;
    const stopBtn = root.querySelector("#giAsstVoiceStop") as HTMLButtonElement | null;
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

  function setVoiceState(next: VoiceState, errorText?: string): void {
    voice.state = next;
    voice.error = next === "error" ? (errorText || voice.error || "") : "";
    paintVoiceState();
  }

  function voiceMarkup(includePin: boolean): string {
    return `
      <div class="giAsst__voice is-idle" data-gi-asst-voice="idle">
        <button class="giAsst__micBtn" id="giAsstMicBtn" type="button" aria-label="התחל שיחה">🎙️</button>
        <p class="giAsst__lead giAsst__voiceStatus" id="giAsstVoiceStatus">דבר עם המערכת</p>
        ${includePin ? `
          <label class="giAsst__label" for="giAsstVoicePin">קוד הכניסה לחשבון</label>
          <input class="giAsst__input" id="giAsstVoicePin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" />
        ` : ""}
        <div class="giAsst__voiceActions">
          <button class="giAsst__btn" id="giAsstVoiceStart" type="button">התחל שיחה</button>
          <button class="giAsst__btn giAsst__btn--ghost" id="giAsstVoiceStop" type="button" hidden>סיים שיחה</button>
        </div>
        <p class="giAsst__heard" id="giAsstHeard" aria-live="polite"></p>
        <form class="giAsst__talkForm" id="giAsstTalkForm">
          <label class="giAsst__label" for="giAsstTalkText">אם אין תגובה לקול — כתבו כאן</label>
          <div class="giAsst__talkRow">
            <input class="giAsst__input" id="giAsstTalkText" type="text" enterkeyhint="send" autocomplete="off" placeholder="למשל: חפש דוד לוי" />
            <button class="giAsst__btn giAsst__talkSend" id="giAsstTalkSend" type="submit">שלח</button>
          </div>
        </form>
        <div class="giAsst__confirm is-hidden" id="giAsstConfirm" hidden>
          <p class="giAsst__confirmText" id="giAsstConfirmText">ממתין לאישור פעולה.</p>
          <div class="giAsst__confirmActions">
            <button class="giAsst__btn" id="giAsstConfirmYes" type="button">כן</button>
            <button class="giAsst__btn giAsst__btn--ghost" id="giAsstConfirmNo" type="button">לא</button>
          </div>
        </div>
        <ol class="giAsst__timeline" id="giAsstTimeline" aria-live="polite"></ol>
        <div class="giAsst__hits" id="giAsstHits" hidden></div>
        <p class="giAsst__hint">הקול מקומי בדפדפן — בלי תשלום לספק חיצוני. כתיבה דורשת אישור. «כן» חל רק אם יש פעולה ממתינה.</p>
        ${isPhonePage() ? "" : `<button class="giAsst__btn giAsst__btn--ghost" id="giAsstOpenPhone" type="button">פתח שוב בטלפון</button>`}
      </div>
    `;
  }

  function paintTimeline(): void {
    const list = $("giAsstTimeline");
    if (!list) return;
    list.innerHTML = timelineItems.slice(-20).map((item) => {
      const kind = trim(item.kind) || "info";
      return `<li class="giAsst__tl giAsst__tl--${kind}"><span>${redactSafe(item.text)}</span></li>`;
    }).join("");
    list.scrollTop = list.scrollHeight;
  }

  function paintConfirm(): void {
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
    if (text) text.textContent = "לאשר: " + redactSafe(pendingAction.label) + "?";
  }

  function pushTimeline(kind: string, text: string): void {
    const safe = redactSafe(text);
    if (!safe) return;
    timelineItems.push({ kind, text: safe });
    paintTimeline();
  }

  function resetEngineUi(): void {
    pendingAction = null;
    timelineItems = [];
    lastIntent = "";
    paintConfirm();
    paintTimeline();
    paintHits([]);
  }

  function paintHits(items: HitCard[]): void {
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
      const kind = item.kind === "task" ? "task" : (item.kind === "quote" ? "quote" : "customer");
      const title = redactSafe(item.full_name || item.customer_name || item.details || "פריט");
      const meta = kind === "task"
        ? redactSafe([item.type, item.details, item.remind_at].filter(Boolean).join(" · "))
        : kind === "quote"
          ? redactSafe(item.details || "")
          : redactSafe([item.city, item.agent_name].filter(Boolean).join(" · "));
      const openId = kind === "customer" ? trim(item.id) : "";
      return `<button type="button" class="giAsst__hit giAsst__hit--${kind}"${openId ? ` data-customer-id="${openId}"` : ""}>
        <strong>${title}</strong>${meta ? `<span>${meta}</span>` : ""}
      </button>`;
    }).join("");
  }

  function bindHits(root: ParentNode): void {
    const box = root.querySelector("#giAsstHits") as HTMLElement | null;
    if (!box || box.getAttribute("data-gi-asst-hits-bound") === "1") return;
    box.setAttribute("data-gi-asst-hits-bound", "1");
    box.addEventListener("click", (ev) => {
      const target = ev.target as HTMLElement | null;
      const btn = target?.closest?.("[data-customer-id]") as HTMLElement | null;
      const id = trim(btn?.getAttribute("data-customer-id"));
      if (id) readBridge().openCustomer?.(id);
    });
  }

  function asHitCards(list: unknown): HitCard[] {
    if (!Array.isArray(list)) return [];
    return list.filter((item) => item && typeof item === "object") as HitCard[];
  }

  function sanitizeCustomerHit(row: HitCard | Record<string, unknown> | null | undefined): HitCard {
    const src = row && typeof row === "object" ? row as Record<string, unknown> : {};
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

  function safeTaskHit(row: Record<string, unknown>): HitCard {
    return {
      id: trim(row.id),
      kind: "task",
      type: trim(row.type),
      details: trim(row.details).slice(0, 160),
      remind_at: trim(row.remind_at),
      customer_name: trim(row.customer_name)
    };
  }

  async function applyCrmWraps(tool: string, args: Record<string, unknown>, data: Record<string, unknown>): Promise<void> {
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
        } catch (_e) {}
      }
      const hits = asHitCards(data.customers).map(sanitizeCustomerHit);
      data.customers = hits;
      paintHits(hits);
      if (hits.length) pushTimeline("ok", "נמצאו " + hits.length + " לקוחות.");
    } else if ((tool === "find_customer_by_id" || tool === "get_customer") && data.ok !== false && data.customer && typeof data.customer === "object") {
      const serverCard = data.customer as HitCard;
      try {
        let local: HitCard | null = null;
        if (typeof active.findCustomerById === "function") local = active.findCustomerById(trim(serverCard.id));
        if (!local && /^\d{8,9}$/.test(trim(args.query)) && typeof active.findCustomerByIdNumber === "function") {
          local = active.findCustomerByIdNumber(trim(args.query));
        }
        if (local && trim(local.id) === trim(serverCard.id)) data.customer = local;
      } catch (_e) {}
      const card = sanitizeCustomerHit(data.customer as HitCard);
      data.customer = card;
      paintHits([card]);
      if (trim(card.full_name)) pushTimeline("ok", "נמצא לקוח: " + redactSafe(card.full_name));
    } else if (tool === "get_tasks" && data.ok !== false) {
      if (typeof active.listTasks === "function") {
        try {
          await active.refreshReminders?.();
          const local = active.listTasks();
          if (Array.isArray(local) && local.length) {
            const allowed = new Set(asHitCards(data.tasks).map((t) => trim(t.id)));
            data.tasks = local
              .filter((row) => row && typeof row === "object" && allowed.has(trim((row as Record<string, unknown>).id)))
              .map((row) => safeTaskHit(row as Record<string, unknown>));
          }
        } catch (_e) {}
      }
      const hits = asHitCards(data.tasks).map((t) => safeTaskHit(t as Record<string, unknown>));
      paintHits(hits);
      if (hits.length) pushTimeline("ok", "נמצאו " + hits.length + " משימות.");
    }
  }

  function formatPremium(value: unknown): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return String(Math.round(n * 100) / 100);
  }

  async function applySimWraps(tool: string, args: Record<string, unknown>, data: Record<string, unknown>): Promise<void> {
    const cmd = (data.client_command && typeof data.client_command === "object")
      ? data.client_command as Record<string, unknown>
      : null;
    const type = trim(cmd?.type);
    if (tool !== "get_insurance_price" && type !== "quote_simulator") return;
    const active = readBridge();
    const company = trim(cmd?.company || args.company);
    const product = trim(cmd?.product || args.product);
    const input = (cmd?.input && typeof cmd.input === "object")
      ? cmd.input as Record<string, unknown>
      : args;
    if (typeof active.quoteSimulator !== "function") {
      data.quote = { ok: false, error: "NO_CLIENT_ENGINE" };
      return;
    }
    try {
      const quote = await active.quoteSimulator(company, product, input) as Record<string, unknown>;
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
          full_name: company + " · " + product,
          details: monthly ? ("פרמיה חודשית " + monthly + " ₪") : ""
        }]);
        if (monthly) pushTimeline("ok", "פרמיה מסימולטור קיים: " + monthly + " ₪ לחודש.");
      } else if (quote && quote.open_simulator === true) {
        data.needs_input = true;
        data.error = trim(quote.error) || "NEED_INPUT";
        data.client_command = { type: "open_simulator", company, product };
      }
    } catch (_e) {
      data.quote = { ok: false, error: "QUOTE_FAILED" };
    }
  }

  function bindVoiceControls(root: ParentNode): void {
    root.querySelector("#giAsstVoiceStart")?.addEventListener("click", () => { void startVoice(); });
    root.querySelector("#giAsstVoiceStop")?.addEventListener("click", () => { void stopVoice(); });
    root.querySelector("#giAsstMicBtn")?.addEventListener("click", () => {
      if (voice.state === "idle" || voice.state === "error") void startVoice();
      else void stopVoice();
    });
    root.querySelector("#giAsstConfirmYes")?.addEventListener("click", () => { void confirmPending(); });
    root.querySelector("#giAsstConfirmNo")?.addEventListener("click", () => { void cancelPending(); });
    ($("giAsstTalkForm") as HTMLFormElement | null)?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      void submitTalkText();
    });
    root.querySelector("#giAsstOpenPhone")?.addEventListener("click", () => {
      renderPhoneReturnBody();
    });
    bindHits(root);
    paintVoiceState();
    paintConfirm();
    paintTimeline();
    paintHits([]);
  }

  function extractTranscript(ev: Record<string, unknown>, kind: "user" | "assistant"): string {
    const type = trim(ev.type);
    if (kind === "user") {
      if (type.indexOf("input_audio_transcription.completed") >= 0) return redactSafe(ev.transcript);
    } else if (
      type === "response.output_audio_transcript.done" ||
      type === "response.audio_transcript.done" ||
      type.indexOf("output_audio_transcript.done") >= 0
    ) {
      return redactSafe(ev.transcript);
    }
    return "";
  }

  async function onUserTranscript(text: string): Promise<void> {
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
            pushTimeline(ran.ok === false ? "error" : "ok", ran.ok === false ? "האישור התקבל אך הביצוע נכשל." : "הפעולה אושרה ובוצעה.");
          } else {
            pushTimeline("ok", "הפעולה אושרה.");
          }
        } else if (data.cancelled === true) {
          pendingAction = null;
          pushTimeline("cancel", "הפעולה בוטלה.");
        } else if (trim(data.error) === "NO_PENDING") {
          pushTimeline("info", "אין פעולה ממתינה לאישור.");
        }
        paintConfirm();
      }
    } catch (_e) {}
  }

  async function onAssistantTranscript(text: string): Promise<void> {
    pushTimeline("assistant", text);
    if (!trim(voice.sessionId)) return;
    try { await callEngine({ ...engineAuthPayload(), action: "log", kind: "assistant", text }); } catch (_e) {}
  }

  function speechRecognitionCtor(): (new () => {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start: () => void;
    stop: () => void;
    onresult: ((ev: { resultIndex: number; results: ArrayLike<{ isFinal?: boolean; 0: { transcript: string } }> }) => void) | null;
    onerror: ((ev: { error?: string }) => void) | null;
    onend: (() => void) | null;
  }) | null {
    const w = window as Window & {
      SpeechRecognition?: new () => unknown;
      webkitSpeechRecognition?: new () => unknown;
    };
    const ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    return ctor ? ctor as ReturnType<typeof speechRecognitionCtor> : null;
  }

  type VoiceLike = {
    name?: string;
    lang?: string;
    localService?: boolean;
    default?: boolean;
  };

  const FEMALE_VOICE_HINTS = [
    "hila", "carmit", "heami", "he-il-standard-a", "he-il-wavenet-a",
    "female", "woman", "girl", "נשית"
  ];
  const MALE_VOICE_HINTS = ["asaf", "male", "man-", " man", "david"];
  const QUALITY_VOICE_HINTS = ["natural", "neural", "online", "premium", "enhanced", "wavenet", "studio"];

  let voicesHooked = false;

  function scoreHebrewVoice(voice: VoiceLike | null | undefined): number {
    if (!voice) return -1000;
    const name = String(voice.name || "").toLowerCase();
    const lang = String(voice.lang || "").toLowerCase();
    const blob = name + " " + lang;
    const isHe = lang === "he" || lang === "he-il" || lang.indexOf("he-") === 0
      || /hebrew|עברית/.test(blob);
    if (!isHe) return -1000;
    let score = 50;
    if (lang === "he-il" || lang === "he") score += 30;
    for (let i = 0; i < FEMALE_VOICE_HINTS.length; i += 1) {
      if (blob.indexOf(FEMALE_VOICE_HINTS[i]) >= 0) score += 40;
    }
    for (let i = 0; i < QUALITY_VOICE_HINTS.length; i += 1) {
      if (blob.indexOf(QUALITY_VOICE_HINTS[i]) >= 0) score += 18;
    }
    for (let i = 0; i < MALE_VOICE_HINTS.length; i += 1) {
      if (blob.indexOf(MALE_VOICE_HINTS[i]) >= 0) score -= 50;
    }
    if (voice.localService) score += 6;
    if (voice.default) score += 4;
    return score;
  }

  function pickHebrewVoice(voices?: VoiceLike[]): SpeechSynthesisVoice | VoiceLike | null {
    try {
      const list = (voices && voices.length)
        ? voices
        : ((window.speechSynthesis?.getVoices?.() || []) as VoiceLike[]);
      let best: VoiceLike | null = null;
      let bestScore = 0;
      for (let i = 0; i < list.length; i += 1) {
        const score = scoreHebrewVoice(list[i]);
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

  function numberToHebrew(value: unknown, gender: "m" | "f" = "m"): string {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 0) return "";
    if (n > 999999) return String(n);
    const ones = gender === "f"
      ? ["", "אחת", "שתיים", "שלוש", "ארבע", "חמש", "שש", "שבע", "שמונה", "תשע"]
      : ["", "אחד", "שניים", "שלושה", "ארבעה", "חמישה", "שישה", "שבעה", "שמונה", "תשעה"];
    const teens = gender === "f"
      ? ["עשר", "אחת עשרה", "שתים עשרה", "שלוש עשרה", "ארבע עשרה", "חמש עשרה", "שש עשרה", "שבע עשרה", "שמונה עשרה", "תשע עשרה"]
      : ["עשרה", "אחד עשר", "שניים עשר", "שלושה עשר", "ארבעה עשר", "חמישה עשר", "שישה עשר", "שבעה עשר", "שמונה עשר", "תשעה עשר"];
    const tens = ["", "", "עשרים", "שלושים", "ארבעים", "חמישים", "שישים", "שבעים", "שמונים", "תשעים"];
    const thousandHeads = ["", "אלף", "אלפיים", "שלושת אלפים", "ארבעת אלפים", "חמשת אלפים", "ששת אלפים", "שבעת אלפים", "שמונת אלפים", "תשעת אלפים"];
    const twoNoun = gender === "f" ? "שתי" : "שני";
    const under20 = (x: number, constructTwo: boolean): string => {
      if (x === 0) return "";
      if (x === 2 && constructTwo) return twoNoun;
      if (x < 10) return ones[x];
      return teens[x - 10];
    };
    const under100 = (x: number, constructTwo: boolean): string => {
      if (x < 20) return under20(x, constructTwo);
      const t = Math.floor(x / 10);
      const o = x % 10;
      if (!o) return tens[t];
      const onesWord = (o === 2 && gender === "m") ? "שניים" : ones[o];
      return tens[t] + " ו" + onesWord;
    };
    const under1000 = (x: number, constructTwo: boolean): string => {
      if (x < 100) return under100(x, constructTwo);
      const h = Math.floor(x / 100);
      const rest = x % 100;
      const hundreds = h === 1 ? "מאה" : h === 2 ? "מאתיים" : ([
        "", "", "", "שלוש", "ארבע", "חמש", "שש", "שבע", "שמונה", "תשע"
      ][h] + " מאות");
      if (!rest) return hundreds;
      return hundreds + " ו" + under100(rest, false);
    };
    if (n < 1000) return under1000(n, n === 2);
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const head = thousands < 10 ? thousandHeads[thousands] : (under1000(thousands, false) + " אלף");
    if (!rest) return head;
    return head + " ו" + under1000(rest, false);
  }

  function formatSpokenPremium(value: unknown): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    const rounded = Math.round(n * 100) / 100;
    const whole = Math.floor(rounded);
    const agorot = Math.round((rounded - whole) * 100);
    const shekels = whole === 1 ? "שקל אחד" : (numberToHebrew(whole, "m") + " שקלים");
    if (!agorot) return shekels;
    return shekels + " ו" + numberToHebrew(agorot, "f") + " אגורות";
  }

  function prepareSpeechText(text: string): string {
    let spoken = trim(text);
    if (!spoken) return "";
    spoken = spoken.replace(/₪/g, " שקלים ");
    spoken = spoken.replace(/\[מזהה\]/g, "מספר מזהה");
    spoken = spoken.replace(/(\d{1,6})[.,](\d{1,2})\b/g, (_m, whole: string, frac: string) => {
      const head = numberToHebrew(Number(whole), "m");
      const tail = numberToHebrew(Number(frac), "f");
      return (head || whole) + " נקודה " + (tail || frac);
    });
    spoken = spoken.replace(/\b(\d{1,6})\b/g, (raw) => numberToHebrew(Number(raw), "m") || raw);
    spoken = spoken.replace(/\s+/g, " ").trim();
    spoken = spoken.replace(/\s+([,.:!?])/g, "$1");
    spoken = spoken.replace(/([,.:!?])(?=\S)/g, "$1 ");
    if (!/[.!?]$/.test(spoken)) spoken += ".";
    return spoken;
  }

  function applyVoiceTone(utter: SpeechSynthesisUtterance, chosen: VoiceLike | null): void {
    utter.lang = "he-IL";
    if (chosen) {
      try { utter.voice = chosen as SpeechSynthesisVoice; } catch (_e) {}
    }
    const name = String(chosen && chosen.name || "").toLowerCase();
    let female = false;
    for (let i = 0; i < FEMALE_VOICE_HINTS.length; i += 1) {
      if (name.indexOf(FEMALE_VOICE_HINTS[i]) >= 0) female = true;
    }
    utter.rate = 0.9;
    utter.pitch = female ? 1.12 : 1.2;
    utter.volume = 1;
  }

  function speechHoldMs(text: string): number {
    return Math.min(22000, Math.max(3600, Math.round(text.length * 90 + 1000)));
  }

  function warmVoices(): void {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.getVoices();
      if (voicesHooked) return;
      voicesHooked = true;
      const refresh = () => {
        try { synth.getVoices(); } catch (_e) {}
      };
      if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", refresh);
      else synth.onvoiceschanged = refresh;
    } catch (_e2) {}
  }

  function isMobileVoice(): boolean {
    if (isPhonePage()) return true;
    try { return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || ""); } catch (_e) { return false; }
  }

  function setHeardStatus(text: string): void {
    lastHeard = redactSafe(text);
    const el = $("giAsstHeard");
    if (el) el.textContent = lastHeard ? ("שמעתי: " + lastHeard) : "";
  }

  function unlockSpeech(): void {
    try {
      warmVoices();
      const utter = new SpeechSynthesisUtterance(" ");
      utter.volume = 0;
      window.speechSynthesis?.speak(utter);
      window.speechSynthesis?.cancel();
    } catch (_e) {}
  }

  function startLocalListening(): void {
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "he-IL";
    rec.continuous = !isMobileVoice();
    rec.interimResults = true;
    rec.onresult = (ev) => {
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
      const err = trim(ev?.error);
      if (err === "not-allowed") setVoiceState("error", pairingErrorText("MIC_DENIED"));
    };
    rec.onend = () => {
      if (voice.recognition !== rec) return;
      if (voice.state === "idle" || voice.state === "error") return;
      window.setTimeout(() => {
        if (voice.recognition === rec && voice.state !== "idle" && voice.state !== "error") {
          try { rec.start(); } catch (_e) {}
        }
      }, 280);
    };
    voice.recognition = rec;
    rec.start();
  }

  function stopLocalListening(): void {
    const rec = voice.recognition;
    voice.recognition = null;
    try { rec?.stop(); } catch (_e) {}
    try { window.speechSynthesis?.cancel(); } catch (_e2) {}
  }

  async function speak(text: string): Promise<void> {
    const clean = redactSafe(text);
    if (!clean) return;
    const spoken = prepareSpeechText(clean);
    await onAssistantTranscript(clean);
    if (voice.state === "idle" || voice.state === "error") return;
    if (!window.speechSynthesis) return;
    warmVoices();
    setVoiceState("speaking");
    await new Promise<void>((resolve) => {
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
      try { window.speechSynthesis.cancel(); } catch (_e2) {}
      try { window.speechSynthesis.speak(utter); } catch (_e3) { finish(); }
    });
    if (voice.state === "speaking") setVoiceState("listening");
  }

  function replyFromTool(tool: string, data: Record<string, unknown>): string {
    if (data.needs_confirmation === true) return "פעולת כתיבה ממתינה לאישור. אמרו כן, או לא.";
    if (trim(data.error) === "NEED_INPUT" || data.needs_input === true) return "חסרים פרטים. פתחתי את הסימולטור הקיים.";
    if (data.ok === false) return "לא הצלחתי לבצע את הבקשה.";
    if (data.instant === true && (tool === "search_customer" || tool === "find_customer_by_id" || tool === "open_customer")) {
      return "פותחת את התיק.";
    }
    if (tool === "search_customer") {
      const n = asHitCards(data.customers).length;
      if (!n) return "לא מצאתי לקוחות.";
      return n === 1
        ? "מצאתי לקוח אחד. פותחת את התיק."
        : ("מצאתי " + numberToHebrew(n, "m") + " לקוחות.");
    }
    if (tool === "find_customer_by_id" || tool === "get_customer") {
      const name = trim((data.customer && typeof data.customer === "object") ? (data.customer as HitCard).full_name : "");
      return name ? ("מצאתי את " + name + ".") : "לא מצאתי את הלקוח.";
    }
    if (tool === "get_tasks") {
      const n = asHitCards(data.tasks).length;
      return n ? ("יש " + numberToHebrew(n, "f") + " משימות פתוחות.") : "אין משימות פתוחות.";
    }
    if (tool === "get_insurance_price") {
      const monthly = formatSpokenPremium(data.monthlyPremium);
      return monthly ? ("הפרמיה החודשית היא " + monthly + ".") : "לא הצלחתי לחשב פרמיה.";
    }
    if (tool === "open_simulator") return "פתחתי את הסימולטור הקיים.";
    if (tool === "go_view") return "עברתי למסך שביקשת.";
    if (tool === "click_topbar") return "פתחתי את הכפתור מהסרגל.";
    if (tool === "create_proposal") return "פתחתי את האשף הקיים להצעה.";
    if (tool === "fill_wizard") return "מילאתי את השדות באשף.";
    if (tool === "wizard_next") return data.ok === false ? "לא הצלחתי לעבור שלב. בדקו שכל הפרטים מלאים." : "עברתי לשלב הבא.";
    if (tool === "open_har_import") return data.ok === false ? "לא מצאתי את כפתור הר הביטוח. עברו קודם לשלב הפוליסות הקיימות." : "פתחתי את בחירת קובץ הר הביטוח. בחרו את קובץ האקסל מהמחשב.";
    if (tool === "get_monthly_production" || tool === "get_team_production") {
      const count = Number(data.count == null ? data.total : data.count);
      return Number.isFinite(count) ? ("החודש " + numberToHebrew(count, "m") + " תיקים.") : "הבאתי את נתוני הייצור.";
    }
    return "ביצעתי.";
  }

  function commandFromLocalTool(tool: string, args: Record<string, unknown> | undefined): Record<string, unknown> | null {
    const a = args && typeof args === "object" ? args : {};
    if (tool === "go_view" && trim(a.view)) return { type: "go_view", view: trim(a.view) };
    if (tool === "click_topbar" && trim(a.id)) return { type: "click_topbar", id: trim(a.id) };
    if (tool === "fill_wizard") return { type: "fill_wizard", fields: a };
    if (tool === "wizard_next") return { type: "wizard_next" };
    if (tool === "open_har_import") return { type: "open_har_import" };
    if (tool === "open_simulator" && trim(a.company)) return { type: "open_simulator", company: trim(a.company), product: trim(a.product) || "ריסק" };
    if (tool === "create_proposal") {
      const out: Record<string, unknown> = { type: "open_wizard" };
      if (trim(a.customerId)) out.customerId = trim(a.customerId);
      else if (trim(a.query)) out.query = trim(a.query);
      else if (lastCustomerId) out.customerId = lastCustomerId;
      if (trim(a.company)) out.company = trim(a.company);
      if (trim(a.product)) out.product = trim(a.product);
      return out;
    }
    if (tool === "open_customer" || tool === "find_customer_by_id" || tool === "search_customer") {
      const out: Record<string, unknown> = { type: "open_customer" };
      if (trim(a.customerId)) out.customerId = trim(a.customerId);
      if (trim(a.query)) {
        out.query = trim(a.query);
        if (!out.customerId) out.customerId = trim(a.query);
      }
      if (!out.customerId && !out.query) return null;
      return out;
    }
    return null;
  }

  function runInstantUi(cmd: Record<string, unknown>): void {
    if (isPhonePage()) void dispatchDesktopCommand(cmd);
    else executeClientCommand(cmd);
  }

  async function submitTalkText(): Promise<void> {
    const input = $("giAsstTalkText") as HTMLInputElement | null;
    const text = trim(input?.value);
    if (!text) return;
    if (input) input.value = "";
    if (voice.state === "idle" || voice.state === "error") void startVoice();
    setHeardStatus(text);
    await handleLocalUtterance(text);
  }

  async function handleLocalUtterance(text: string): Promise<void> {
    if (utteranceBusy) return;
    utteranceBusy = true;
    try {
      const intent = classifyIntent(text);
      const hadPending = !!pendingAction;
      void onUserTranscript(text);
      if (intent === "confirm") {
        void speak(hadPending ? "אישרתי את הפעולה." : "אין פעולה שממתינה לאישור.");
        return;
      }
      if (intent === "cancel") {
        void speak(hadPending ? "ביטלתי את הפעולה." : "אין פעולה לביטול.");
        return;
      }
      const cmd = parseLocalCommand(text);
      if (!cmd || cmd.kind === "help" || !cmd.tool) {
        void speak((cmd && cmd.say) || LOCAL_VOICE_HELP);
        return;
      }
      const args = Object.assign({}, cmd.args || {});
      const instant = commandFromLocalTool(cmd.tool, args);
      if (instant) {
        runInstantUi(instant);
        if (cmd.tool === "create_proposal") {
          const extra = extractFillFields(text);
          if (extra && (extra.firstName || extra.lastName || extra.company || extra.product || extra.age != null)) {
            runInstantUi({ type: "fill_wizard", fields: extra });
          }
        }
        void speak(replyFromTool(cmd.tool, { ok: true, instant: true }));
        return;
      }
      const data = await invokeTool(cmd.tool, args);
      void speak(replyFromTool(cmd.tool, data));
    } catch (_e3) {
      void speak("לא הצלחתי לבצע את הבקשה.");
    } finally {
      utteranceBusy = false;
    }
  }

  function handleRealtimeEvent(raw: string): void {
    let ev: Record<string, unknown> = {};
    try { ev = JSON.parse(raw) as Record<string, unknown>; } catch (_e) { return; }
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
    if (
      type === "response.created" ||
      type === "response.output_audio.delta" ||
      type === "response.audio.delta" ||
      type === "output_audio_buffer.started"
    ) {
      setVoiceState("speaking");
      return;
    }
    if (type === "error") {
      setVoiceState("error", "השיחה נקטעה. נסו שוב.");
    }
    if (
      type === "response.function_call_arguments.done" ||
      type === "response.output_item.done"
    ) {
      void handleToolCallEvent(ev);
    }
  }

  function sendRealtime(event: Record<string, unknown>): void {
    try { voice.dc?.send(JSON.stringify(event)); } catch (_e) {}
  }

  function executeClientCommand(cmd: Record<string, unknown> | null | undefined): void {
    if (!cmd || typeof cmd !== "object") return;
    const type = trim(cmd.type);
    const active = readBridge();
    if (type === "open_customer") {
      const id = trim(cmd.customerId);
      const query = trim(cmd.query);
      if (id) active.openCustomer?.(id);
      else if (query) void active.openCustomerByQuery?.(query);
    }
    else if (type === "go_view") active.goView?.(trim(cmd.view));
    else if (type === "open_simulator") void active.openSimulator?.(trim(cmd.company), trim(cmd.product));
    else if (type === "quote_simulator") void active.quoteSimulator?.(trim(cmd.company), trim(cmd.product), (cmd.input && typeof cmd.input === "object") ? cmd.input as Record<string, unknown> : {});
    else if (type === "open_wizard") void active.openWizard?.({ customerId: trim(cmd.customerId), query: trim(cmd.query), company: trim(cmd.company), product: trim(cmd.product) });
    else if (type === "fill_wizard") {
      const fields = (cmd.fields && typeof cmd.fields === "object") ? cmd.fields as Record<string, unknown> : {};
      active.fillWizard?.(fields);
    }
    else if (type === "wizard_next") void active.wizardNext?.();
    else if (type === "open_har_import") void active.openHarImport?.();
    else if (type === "click_topbar") active.clickTopbar?.(trim(cmd.id));
    else if (type === "open_proposal") active.openProposal?.(trim(cmd.proposalId));
    else if (type === "upsert_reminder" && cmd.reminder && typeof cmd.reminder === "object") {
      void active.upsertReminder?.(cmd.reminder as Record<string, unknown>);
    }
    else if (type === "mark_task_done") void active.markTaskDone?.(trim(cmd.id || cmd.taskId));
    else if (type === "refresh_reminders") void active.refreshReminders?.();
  }

  async function dispatchDesktopCommand(cmd: Record<string, unknown>): Promise<void> {
    if (!isPhonePage()) return;
    if (!UI_COMMANDS.has(trim(cmd.type))) return;
    try {
      await callEngine({ ...engineAuthPayload(), action: "dispatch", command: cmd });
    } catch (_e) {}
  }

  async function pullDesktopCommands(): Promise<void> {
    if (isPhonePage()) return;
    const device = readDevice();
    if (!device || !trim(device.deviceSecret)) return;
    try {
      const data = await callEngine({ ...engineAuthPayload(), action: "pull" });
      const list = Array.isArray(data.commands) ? data.commands as Array<Record<string, unknown>> : [];
      for (const row of list) {
        const id = trim(row.id);
        const cmd = (row.command && typeof row.command === "object") ? row.command as Record<string, unknown> : null;
        try {
          executeClientCommand(cmd);
          if (id) await callEngine({ ...engineAuthPayload(), action: "ack", commandId: id });
        } catch (_e) {
          if (id) await callEngine({ ...engineAuthPayload(), action: "ack", commandId: id, error: "EXEC" });
        }
      }
    } catch (_e) {}
  }

  function startCommandBus(): void {
    if (isPhonePage() || commandPoll) return;
    commandPoll = window.setInterval(() => { void pullDesktopCommands(); }, COMMAND_POLL_MS);
    void pullDesktopCommands();
  }

  function stopCommandBus(): void {
    if (commandPoll) window.clearInterval(commandPoll);
    commandPoll = 0;
  }

  async function invokeTool(tool: string, args: Record<string, unknown>, pendingActionId?: string): Promise<Record<string, unknown>> {
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
      pushTimeline("confirm", "ממתין לאישור: " + (pendingAction.label || ""));
      paintConfirm();
    }
    await applyCrmWraps(trim(tool), args, data);
    await applySimWraps(trim(tool), args, data);
    if (data.client_command && typeof data.client_command === "object") {
      const cmd = data.client_command as Record<string, unknown>;
      if (isPhonePage()) void dispatchDesktopCommand(cmd);
      else executeClientCommand(cmd);
    }
    return data;
  }

  async function handleToolCallEvent(ev: Record<string, unknown>): Promise<void> {
    const item = (ev.item && typeof ev.item === "object") ? ev.item as Record<string, unknown> : ev;
    const name = trim(item.name || ev.name);
    const callId = trim(item.call_id || ev.call_id);
    let args: Record<string, unknown> = {};
    const raw = item.arguments || ev.arguments;
    if (typeof raw === "string") {
      try { args = JSON.parse(raw) as Record<string, unknown>; } catch (_e) { args = {}; }
    } else if (raw && typeof raw === "object") args = raw as Record<string, unknown>;
    const itemType = trim(item.type);
    if (itemType && itemType !== "function_call") return;
    if (!name || !callId) return;
    let output: Record<string, unknown> = { ok: false, error: "TOOL" };
    try { output = await invokeTool(name, args); } catch (err) {
      output = { ok: false, error: trim((err as Error)?.message) || "TOOL" };
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

  async function proposeWrite(input: { tool: string; label?: string; argumentsSafe?: Record<string, unknown> }): Promise<Record<string, unknown>> {
    const data = await callEngine({
      ...engineAuthPayload(),
      action: "propose",
      tool: trim(input.tool),
      label: trim(input.label),
      argumentsSafe: input.argumentsSafe || {}
    });
    pendingAction = { id: trim(data.pending_action_id), label: trim(data.label) || trim(input.label) || trim(input.tool) };
    pushTimeline("confirm", "ממתין לאישור: " + (pendingAction.label || ""));
    paintConfirm();
    return data;
  }

  async function confirmPending(): Promise<Record<string, unknown> | null> {
    if (!pendingAction) {
      pushTimeline("info", "אין פעולה ממתינה לאישור.");
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
        pushTimeline(ran.ok === false ? "error" : "ok", ran.ok === false ? "האישור התקבל אך הביצוע נכשל." : "הפעולה אושרה ובוצעה.");
        return ran;
      }
      pushTimeline("ok", "הפעולה אושרה.");
      return data;
    } catch (err) {
      const code = trim((err as Error & { code?: string })?.code || (err as Error)?.message);
      if (code === "NO_PENDING") pushTimeline("info", "אין פעולה ממתינה לאישור.");
      return { ok: false, error: code, executed: false };
    }
  }

  async function cancelPending(): Promise<void> {
    if (!pendingAction) return;
    try {
      await callEngine({
        ...engineAuthPayload(),
        action: "cancel",
        pendingActionId: pendingAction.id
      });
    } catch (_e) {}
    pendingAction = null;
    paintConfirm();
    pushTimeline("cancel", "הפעולה בוטלה.");
  }

  async function mintVoiceToken(): Promise<{ clientSecret: string; sessionId: string }> {
    const device = readDevice();
    const auth = getAuth();
    const payload: Record<string, unknown> = {
      action: "token",
      source: device && trim(device.deviceSecret) ? "phone" : "desktop"
    };
    if (device && trim(device.devicePublicId) && trim(device.deviceSecret)) {
      payload.devicePublicId = trim(device.devicePublicId);
      payload.deviceSecret = trim(device.deviceSecret);
    } else {
      payload.agentId = trim(auth?.id);
      payload.agentName = trim(auth?.name);
      payload.username = trim(auth?.username);
      payload.pin = trim(($("giAsstVoicePin") as HTMLInputElement | null)?.value);
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

  async function connectWebRtc(clientSecret: string): Promise<void> {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    voice.pc = pc;
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "true");
    voice.audio = audio;
    pc.ontrack = (ev) => {
      audio.srcObject = ev.streams[0];
      void audio.play().catch(() => {});
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

  async function startVoice(): Promise<void> {
    if (voice.state === "connecting" || voice.state === "listening" || voice.state === "speaking") return;
    setVoiceState("connecting");
    try {
      unlockSpeech();
      warmVoices();
      const device = readDevice();
      const pin = trim(($("giAsstVoicePin") as HTMLInputElement | null)?.value);
      if (!(device && trim(device.deviceSecret))) {
        if (!pin) throw Object.assign(new Error("MISSING_PIN"), { code: "MISSING_PIN" });
        voice.pin = pin;
      }
      if (speechRecognitionCtor() && navigator.mediaDevices?.getUserMedia) {
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          try { mic.getTracks().forEach((track) => track.stop()); } catch (_e) {}
        } catch (micErr) {
          const name = trim((micErr as Error & { name?: string })?.name || (micErr as Error)?.message);
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
      try { await callEngine({ ...engineAuthPayload(), action: "bootstrap" }); } catch (_e2) {}
      pushTimeline("system", "סשן עוזר מקומי נפתח.");
      setHeardStatus("");
      startLocalListening();
      setVoiceState("listening");
      if (!speechRecognitionCtor()) {
        pushTimeline("info", "במכשיר הזה אין דיבור מובנה. כתבו פקודה בתיבה.");
      } else {
        pushTimeline("info", "מקשיב. אפשר גם לכתוב בתיבה.");
      }
    } catch (err) {
      const code = trim((err as Error & { code?: string; name?: string })?.code
        || (err as Error & { name?: string })?.name
        || (err as Error)?.message);
      await stopVoice(false);
      const mapped = pairingErrorText(code);
      const text = (code === "FAILED_TO_FETCH" || code === "TypeError")
        ? "אין חיבור לשרת העוזר. בדקו שהפונקציות פורסמו."
        : (mapped === "לא הצלחתי להשלים את הקישור. נסו שוב." ? "לא הצלחתי להתחיל את השיחה. נסו שוב." : mapped);
      setVoiceState("error", text);
    }
  }

  async function stopVoice(updateUi = true): Promise<void> {
    const sessionId = trim(voice.sessionId);
    const endPayload = { ...engineAuthPayload(), action: "end_session", sessionId };
    stopLocalListening();
    try { voice.dc?.close(); } catch (_e) {}
    try { voice.pc?.getSenders().forEach((sender) => sender.track?.stop()); } catch (_e2) {}
    try { voice.pc?.close(); } catch (_e3) {}
    try { voice.stream?.getTracks().forEach((track) => track.stop()); } catch (_e4) {}
    voice.dc = null;
    voice.pc = null;
    voice.stream = null;
    voice.audio = null;
    voice.sessionId = "";
    voice.pin = "";
    pendingAction = null;
    utteranceBusy = false;
    lastHeard = "";
    if (sessionId) {
      try { await callEngine(endPayload); } catch (_e5) {}
    }
    if (updateUi) {
      setVoiceState("idle");
      paintConfirm();
    }
  }

  function renderAssistantBody(): void {
    const body = $("giAsstBody");
    const title = $("giAsstTitle");
    if (title) title.textContent = "העוזר האישי שלי";
    if (!body) return;
    void stopVoice();
    resetEngineUi();
    const needPin = !(readDevice() && trim(readDevice()?.deviceSecret));
    body.innerHTML = voiceMarkup(needPin);
    bindVoiceControls(body);
  }

  function remainLabel(expiresAt: string): string {
    const ms = Date.parse(expiresAt) - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return "פג תוקף";
    const sec = Math.ceil(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, "0");
    return "הקוד תקף עוד " + m + ":" + s;
  }

  function renderPhoneReturnBody(): void {
    const body = $("giAsstBody");
    const title = $("giAsstTitle");
    if (title) title.textContent = "חזרה לטלפון";
    if (!body) return;
    const href = phoneHomeUrl();
    const parsed = new URL(href);
    if (Array.from(parsed.searchParams.keys()).length) return;
    body.innerHTML = `
      <p class="giAsst__lead">הטלפון כבר מקושר. זה הדף הקבוע — לא חד־פעמי. פתחו אותו בטלפון שכבר קושר, או שמרו אותו במסך הבית.</p>
      <div class="giAsst__qrSlot" id="giAsstQrSlot" aria-live="polite"></div>
      <p class="giAsst__hint" id="giAsstPhoneHomeLink">${href}</p>
      <div class="giAsst__voiceActions">
        <button class="giAsst__btn" id="giAsstReturnTalk" type="button">התחל שיחה במחשב</button>
        <button class="giAsst__btn giAsst__btn--ghost" id="giAsstFreshPhone" type="button">קשר טלפון נוסף</button>
      </div>
    `;
    const slot = $("giAsstQrSlot");
    if (slot) paintQr(slot, href);
    $("giAsstReturnTalk")?.addEventListener("click", () => renderAssistantBody());
    $("giAsstFreshPhone")?.addEventListener("click", () => renderActivateBody(true));
  }

  function renderQrBody(href: string, expiresAt: string): void {
    const body = $("giAsstBody");
    const title = $("giAsstTitle");
    if (title) title.textContent = "הפעלת העוזר האישי";
    if (!body) return;
    body.innerHTML = `
      <p class="giAsst__lead">סרוק את קוד ה-QR באמצעות הטלפון כדי לחבר את העוזר האישי לחשבון שלך.</p>
      <div class="giAsst__qrSlot" id="giAsstQrSlot" aria-live="polite"></div>
      <p class="giAsst__timer" id="giAsstTimer">${remainLabel(expiresAt)}</p>
      <p class="giAsst__hint">הקוד חד־פעמי, קצר בזמן, ואינו מכיל תעודת זהות, סיסמה או מזהה משתמש.</p>
    `;
    const slot = $("giAsstQrSlot");
    if (slot) paintQr(slot, href);
  }

  function renderActivateBody(freshPhone = false): void {
    pairingFreshPhone = freshPhone === true;
    const body = $("giAsstBody");
    const title = $("giAsstTitle");
    if (title) title.textContent = "הפעלת העוזר האישי";
    if (!body) return;
    body.innerHTML = `
      <p class="giAsst__lead">${pairingFreshPhone
        ? "הזינו את קוד הכניסה כדי ליצור QR חדש לטלפון נוסף. הקוד החדש חד־פעמי."
        : "סרוק את קוד ה-QR באמצעות הטלפון כדי לחבר את העוזר האישי לחשבון שלך."}</p>
      <form class="giAsst__form" id="giAsstPinForm">
        <label class="giAsst__label" for="giAsstPin">קוד הכניסה לחשבון</label>
        <input class="giAsst__input" id="giAsstPin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" />
        <button class="giAsst__btn" id="giAsstPinBtn" type="submit">הצג QR מאובטח</button>
      </form>
      <div class="giAsst__error" id="giAsstError" role="alert"></div>
      <p class="giAsst__hint">הקוד החד־פעמי נוצר בשרת רק אחרי אימות. הוא אינו מכיל תעודת זהות, סיסמה או מזהה משתמש.</p>
    `;
    const form = $("giAsstPinForm") as HTMLFormElement | null;
    form?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      void startPairingFromForm();
    });
    window.setTimeout(() => $("giAsstPin")?.focus(), 40);
  }

  async function pollPairingOnce(): Promise<void> {
    const secret = trim(pairing?.desktopSecret);
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
            agentId: trim(data.agentId) || trim(auth?.id)
          });
        }
        writeLocalPairing(trim(auth?.id) || trim(data.agentId) || trim(auth?.name));
        stopPairingPoll();
        pairing = null;
        startCommandBus();
        renderPhoneReturnBody();
        return;
      }
      if (status === "expired" || status === "cancelled" || status === "missing") {
        stopPairingPoll();
        renderActivateBody();
        setActivateError("פג תוקף קוד הקישור. יש ליצור QR חדש.");
        pairing = null;
        return;
      }
      const timer = $("giAsstTimer");
      if (timer && pairing) timer.textContent = remainLabel(pairing.expiresAt);
    } catch (_e) {}
  }

  async function startPairingFromForm(): Promise<void> {
    const pin = trim(($("giAsstPin") as HTMLInputElement | null)?.value);
    const btn = $("giAsstPinBtn") as HTMLButtonElement | null;
    setActivateError("");
    if (!pin) {
      setActivateError("נא להזין את קוד הכניסה.");
      return;
    }
    const auth = getAuth();
    if (btn) btn.disabled = true;
    try {
      const data = await callPairing({
        action: "create",
        agentId: trim(auth?.id),
        agentName: trim(auth?.name),
        username: trim(auth?.username),
        pin,
        freshPhone: pairingFreshPhone === true
      });
      if (data.alreadyPaired === true) {
        if (trim(data.devicePublicId) && trim(data.deviceSecret)) {
          writeDevice({
            devicePublicId: trim(data.devicePublicId),
            deviceSecret: trim(data.deviceSecret),
            agentId: trim(data.agentId) || trim(auth?.id)
          });
        }
        writeLocalPairing(trim(auth?.id) || trim(data.agentId) || trim(auth?.name));
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
      pairing.pollTimer = window.setInterval(() => { void pollPairingOnce(); }, POLL_MS);
    } catch (err) {
      const code = trim((err as Error & { code?: string })?.code || (err as Error)?.message);
      setActivateError(pairingErrorText(code));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function openFromTopBar(): void {
    if (!isLoggedIn()) {
      try {
        (window as Window & { showToast?: (opts: Record<string, unknown>) => void }).showToast?.({
          title: "נדרשת התחברות",
          text: "יש להתחבר למערכת לפני פתיחת העוזר האישי.",
          variant: "warn",
          durationMs: 4200
        });
      } catch (_e) {}
      return;
    }
    ensureRoot();
    if (hasActiveDevicePairing()) renderAssistantBody();
    else renderActivateBody();
    openOverlay();
  }

  function onButtonClick(ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    openFromTopBar();
  }

  function bindButton(): void {
    const btn = $("btnPersonalAssistant");
    if (!btn || btn.getAttribute("data-gi-asst-bound") === "1") return;
    btn.setAttribute("data-gi-asst-bound", "1");
    btn.addEventListener("click", onButtonClick);
  }

  function setPhoneStatus(text: string, tone?: string): void {
    const el = $("giAsstPhoneStatus");
    if (!el) return;
    el.textContent = text || "";
    el.className = "giAsstPhone__status" + (tone ? " is-" + tone : "");
  }

  function renderPhoneAssistant(): void {
    const root = $("giAsstPhone");
    if (!root) return;
    void stopVoice();
    resetEngineUi();
    root.innerHTML = `
      <header class="giAsstPhone__head">
        <div class="giAsstPhone__kicker">GEMEL INVEST</div>
        <h1 class="giAsstPhone__title">העוזר האישי שלי</h1>
      </header>
      ${voiceMarkup(false)}
    `;
    bindVoiceControls(root);
  }

  function renderPhoneLogin(publicToken: string): void {
    const root = $("giAsstPhone");
    if (!root) return;
    root.innerHTML = `
      <header class="giAsstPhone__head">
        <div class="giAsstPhone__kicker">GEMEL INVEST</div>
        <h1 class="giAsstPhone__title">העוזר האישי שלי</h1>
      </header>
      <p class="giAsst__lead">התחברו עם המשתמש של המערכת כדי לקשר את המכשיר.</p>
      <form class="giAsst__form" id="giAsstPhoneForm">
        <label class="giAsst__label" for="giAsstPhoneUser">שם משתמש</label>
        <input class="giAsst__input" id="giAsstPhoneUser" type="text" autocomplete="username" />
        <label class="giAsst__label" for="giAsstPhonePin">קוד כניסה</label>
        <input class="giAsst__input" id="giAsstPhonePin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" />
        <button class="giAsst__btn" id="giAsstPhoneBtn" type="submit">קישור המכשיר</button>
      </form>
      <div class="giAsstPhone__status" id="giAsstPhoneStatus" role="status"></div>
    `;
    ($("giAsstPhoneForm") as HTMLFormElement | null)?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const username = trim(($("giAsstPhoneUser") as HTMLInputElement | null)?.value);
      const pin = trim(($("giAsstPhonePin") as HTMLInputElement | null)?.value);
      const btn = $("giAsstPhoneBtn") as HTMLButtonElement | null;
      if (!username || !pin) {
        setPhoneStatus("נא להזין שם משתמש וקוד כניסה.", "err");
        return;
      }
      if (btn) btn.disabled = true;
      setPhoneStatus("מאמת את הקישור…");
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
        const code = trim((err as Error & { code?: string })?.code || (err as Error)?.message);
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

  function renderPhoneUsedToken(): void {
    const root = $("giAsstPhone");
    if (!root) return;
    const href = phoneHomeUrl();
    root.innerHTML = `
      <header class="giAsstPhone__head">
        <div class="giAsstPhone__kicker">GEMEL INVEST</div>
        <h1 class="giAsstPhone__title">העוזר האישי שלי</h1>
      </header>
      <p class="giAsst__lead">הקוד שסרקתם כבר נוצל. זה תקין — קישור ה-QR הראשון הוא חד־פעמי.</p>
      <p class="giAsst__hint">אם זה הטלפון שכבר קושר, פתחו את הדף הקבוע. אם זה טלפון אחר, בקשו במחשב «קשר טלפון נוסף».</p>
      <a class="giAsst__btn" id="giAsstPhoneHomeBtn" href="${href}">פתח את דף העוזר הקבוע</a>
    `;
  }

  function bootPhone(): void {
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
            <h1 class="giAsstPhone__title">העוזר האישי שלי</h1>
          </header>
          <p class="giAsst__lead">הטלפון הזה עדיין לא מקושר. סרקו מהמחשב QR חדש, או בקשו «קשר טלפון נוסף».</p>
        `;
      }
      return;
    }
    renderPhoneLogin(publicToken);
  }

  function init(nextBridge?: AssistantBridge): void {
    if (nextBridge && typeof nextBridge === "object") bridge = nextBridge;
    if (document.body?.getAttribute("data-gi-asst-page") === "phone") {
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

  function onLogin(): void {
    syncButtonVisibility();
    startCommandBus();
  }

  function onLogout(): void {
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
    getVoiceState(){ return voice.state; },
    proposeWrite,
    confirmPending,
    cancelPending,
    classifyIntent,
    parseLocalCommand,
    commandFromLocalTool,
    pickHebrewVoice,
    scoreHebrewVoice,
    prepareSpeechText,
    applyVoiceTone,
    numberToHebrew,
    replyFromTool,
    redactSafe,
    invokeTool,
    executeClientCommand,
    applyCrmWraps,
    applySimWraps,
    paintHits,
    dispatchDesktopCommand,
    pullDesktopCommands,
    startCommandBus,
    getPendingAction(){ return pendingAction; },
    getLastIntent(){ return lastIntent; },
    getTimeline(){ return timelineItems.slice(); }
  };

  try {
    (window as Window & { GiAssistant?: typeof api }).GiAssistant = api;
  } catch (_e) {}

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(), { once: true });
  } else {
    init();
  }
})();
