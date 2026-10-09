/* GI-WAF / SOC 2026-10-09
   Application firewall + SOC automation for GEMEL INVEST CRM.
   Isolated module. Does not change PIN login success behavior.
   Enforcement is defensive: inspects outbound CRM requests, blocks known
   attack signatures, rate-limits login bursts, and opens incidents.
*/
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.GiWaf = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this), function (root) {
  "use strict";

  const TAG = "20261009-waf-soc-v1";
  const STORE_KEY = "GI_WAF_SOC_V1";
  const SESSION_KEY = "GI_WAF_SESSION_V1";
  const MAX_EVENTS = 400;
  const MAX_INCIDENTS = 80;
  const MAX_SNIPPET = 480;
  const INGEST_PATH = "/rest/v1/rpc/gi_waf_ingest_event";
  const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";

  const SIGNATURES = [
    { id: "sig-xss", category: "xss", severity: "critical", label: "XSS / הזרקת סקריפט", patterns: [
      /<\s*script\b/i, /javascript\s*:/i, /\bonerror\s*=/i, /\bonload\s*=/i, /<\s*iframe\b/i, /<\/\s*script\s*>/i
    ]},
    { id: "sig-sqli", category: "sqli", severity: "critical", label: "SQL Injection", patterns: [
      /union\s+select\b/i, /'\s*or\s+'?1'?\s*=\s*'?1/i, /;\s*drop\s+table\b/i, /\binformation_schema\b/i,
      /\bxp_cmdshell\b/i, /\bsleep\s*\(\s*\d+/i, /;\s*delete\s+from\b/i
    ]},
    { id: "sig-traversal", category: "traversal", severity: "critical", label: "Path traversal", patterns: [
      /\.\.[\\/]/, /%2e%2e(?:%2f|%5c|\.|\/|\\)/i, /etc\/passwd/i, /windows\\system32/i
    ]},
    { id: "sig-ssrf", category: "ssrf", severity: "critical", label: "SSRF / metadata", patterns: [
      /\b169\.254\.169\.254\b/, /metadata\.google\.internal/i, /\bfile:\/\//i, /\b169\.254\.170\.2\b/
    ]},
    { id: "sig-cmd", category: "cmd", severity: "critical", label: "Command injection", patterns: [
      /;\s*rm\s+-rf\b/i, /\|\s*(?:bash|sh|powershell)\b/i, /\$\(\s*(?:id|whoami|cat)\b/i, /`\s*(?:id|whoami)\s*`/i
    ]},
    { id: "sig-proto", category: "proto", severity: "suspicious", label: "Prototype pollution", patterns: [
      /(?:__proto__|constructor\s*\[(?:'|")prototype(?:'|")\])/i
    ]}
  ];

  const DEFAULT_RULES = SIGNATURES.map((sig) => ({
    id: sig.id,
    enabled: true,
    kind: "signature",
    action: sig.severity === "critical" ? "block" : "log",
    category: sig.category,
    label: sig.label
  })).concat([
    { id: "login-burst", enabled: true, kind: "rate", action: "block", category: "login", label: "פרץ ניסיונות כניסה" },
    { id: "write-burst", enabled: true, kind: "rate", action: "log", category: "rate", label: "פרץ כתיבות לשרת" },
    { id: "export-burst", enabled: true, kind: "rate", action: "log", category: "rate", label: "פרץ ייצוא / הורדה" }
  ]);

  const LOGIN_BURST = 8;
  const LOGIN_WINDOW_MS = 10 * 60 * 1000;
  const WRITE_BURST = 90;
  const WRITE_WINDOW_MS = 60 * 1000;
  const EXPORT_BURST = 12;
  const EXPORT_WINDOW_MS = 5 * 60 * 1000;
  const AUTO_BLOCK_MS = 30 * 60 * 1000;

  const buckets = {
    login: new Map(),
    write: new Map(),
    export: new Map()
  };

  const state = {
    installed: false,
    bound: false,
    tab: "live",
    ingestBusy: false,
    nativeFetch: null,
    memory: null
  };

  function now(){ return Date.now(); }

  function iso(ts){ return new Date(ts || now()).toISOString(); }

  function trim(v){ return String(v == null ? "" : v).trim(); }

  function esc(str){
    return String(str ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function uid(prefix){
    return prefix + "-" + now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function sessionId(){
    try {
      let id = root?.localStorage?.getItem(SESSION_KEY);
      if(!id){
        id = uid("sess");
        root.localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch(_e) {
      return "sess-memory";
    }
  }

  function emptyStore(){
    return {
      enabled: true,
      events: [],
      incidents: [],
      rules: DEFAULT_RULES.map((r) => Object.assign({}, r)),
      blocks: [],
      updatedAt: iso()
    };
  }

  function loadStore(){
    try {
      const raw = root?.localStorage?.getItem(STORE_KEY);
      if(!raw){
        if(state.memory) return state.memory;
        return emptyStore();
      }
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== "object") return emptyStore();
      const base = emptyStore();
      base.enabled = parsed.enabled !== false;
      base.events = Array.isArray(parsed.events) ? parsed.events.slice(0, MAX_EVENTS) : [];
      base.incidents = Array.isArray(parsed.incidents) ? parsed.incidents.slice(0, MAX_INCIDENTS) : [];
      const byId = {};
      (Array.isArray(parsed.rules) ? parsed.rules : []).forEach((r) => { if(r && r.id) byId[r.id] = r; });
      base.rules = DEFAULT_RULES.map((def) => {
        const prev = byId[def.id] || {};
        return Object.assign({}, def, {
          enabled: prev.enabled !== false,
          action: prev.action === "log" || prev.action === "block" ? prev.action : def.action
        });
      });
      (Array.isArray(parsed.rules) ? parsed.rules : []).forEach((r) => {
        if(r && r.kind === "ip" && r.id && !base.rules.some((x) => x.id === r.id)){
          base.rules.push({
            id: r.id,
            enabled: r.enabled !== false,
            kind: "ip",
            action: r.action === "log" ? "log" : "block",
            category: "ip",
            label: trim(r.label) || trim(r.pattern) || "חסימת IP",
            pattern: trim(r.pattern)
          });
        }
      });
      base.blocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
      base.updatedAt = parsed.updatedAt || iso();
      return base;
    } catch(_e) {
      return emptyStore();
    }
  }

  function saveStore(store){
    store.updatedAt = iso();
    state.memory = store;
    try {
      root?.localStorage?.setItem(STORE_KEY, JSON.stringify(store));
    } catch(_e) {}
    return store;
  }

  function ruleEnabled(store, id){
    const rule = (store.rules || []).find((r) => r.id === id);
    return !!(rule && rule.enabled !== false);
  }

  function ruleAction(store, id, fallback){
    const rule = (store.rules || []).find((r) => r.id === id);
    if(rule && (rule.action === "block" || rule.action === "log")) return rule.action;
    return fallback || "log";
  }

  function haystackOf(req){
    const parts = [
      trim(req.method),
      trim(req.url),
      trim(req.path),
      trim(req.query),
      trim(req.body),
      trim(req.snippet)
    ];
    return parts.join("\n").slice(0, 8000);
  }

  function matchSignature(hay){
    if(!hay) return null;
    for(let i = 0; i < SIGNATURES.length; i++){
      const sig = SIGNATURES[i];
      for(let p = 0; p < sig.patterns.length; p++){
        if(sig.patterns[p].test(hay)){
          return { id: sig.id, category: sig.category, severity: sig.severity, label: sig.label };
        }
      }
    }
    return null;
  }

  function pruneBucket(map, windowMs){
    const cutoff = now() - windowMs;
    map.forEach((arr, key) => {
      const next = arr.filter((t) => t >= cutoff);
      if(next.length) map.set(key, next);
      else map.delete(key);
    });
  }

  function hitBucket(kind, key, limit, windowMs){
    const map = buckets[kind];
    if(!map) return { count: 0, over: false };
    pruneBucket(map, windowMs);
    const arr = map.get(key) || [];
    arr.push(now());
    map.set(key, arr);
    return { count: arr.length, over: arr.length > limit };
  }

  function activeBlock(store, req){
    const ip = trim(req.ip);
    const user = trim(req.username).toLowerCase();
    const sess = trim(req.sessionId) || sessionId();
    const ts = now();
    return (store.blocks || []).find((b) => {
      if(!b) return false;
      if(b.until && Date.parse(b.until) <= ts) return false;
      const val = trim(b.value).toLowerCase();
      if(!val) return false;
      if(b.kind === "ip" && ip && val === ip.toLowerCase()) return true;
      if(b.kind === "username" && user && val === user) return true;
      if(b.kind === "session" && sess && val === sess.toLowerCase()) return true;
      return false;
    }) || null;
  }

  function inspectRequest(input){
    const req = input && typeof input === "object" ? input : {};
    const store = loadStore();
    const method = trim(req.method || "GET").toUpperCase();
    const url = trim(req.url);
    const path = trim(req.path) || pathFromUrl(url);
    const body = typeof req.body === "string" ? req.body : stringifyBody(req.body);
    const username = trim(req.username);
    const ip = trim(req.ip) || "browser";
    const sess = trim(req.sessionId) || sessionId();
    const hay = haystackOf({ method, url, path, query: queryFromUrl(url), body, snippet: req.snippet });

    if(store.enabled === false){
      return allowDecision(method, url, path, "disabled");
    }

    const blocked = activeBlock(store, { ip, username, sessionId: sess });
    if(blocked){
      return {
        action: "block",
        severity: "critical",
        category: "ip",
        ruleId: "block-list",
        label: "רשומת חסימה פעילה",
        reason: trim(blocked.reason) || "המקור חסום בחומת האש",
        method, url, path, username, ip, sessionId: sess
      };
    }

    const ipRule = (store.rules || []).find((r) => r.kind === "ip" && r.enabled !== false && trim(r.pattern) && ip && trim(r.pattern).toLowerCase() === ip.toLowerCase());
    if(ipRule){
      return {
        action: ipRule.action === "log" ? "log" : "block",
        severity: "critical",
        category: "ip",
        ruleId: ipRule.id,
        label: ipRule.label || "חסימת IP",
        reason: "ה-IP מופיע בכלל חומת האש",
        method, url, path, username, ip, sessionId: sess
      };
    }

    const sig = matchSignature(hay);
    if(sig && ruleEnabled(store, sig.id)){
      return {
        action: ruleAction(store, sig.id, "block"),
        severity: sig.severity,
        category: sig.category,
        ruleId: sig.id,
        label: sig.label,
        reason: "הבקשה תאמה חתימת תקיפה: " + sig.label,
        method, url, path, username, ip, sessionId: sess
      };
    }

    if(isLoginPath(url, path) && ruleEnabled(store, "login-burst")){
      const key = (username || ip || sess).toLowerCase();
      pruneBucket(buckets.login, LOGIN_WINDOW_MS);
      const arr = buckets.login.get(key) || [];
      if(arr.length >= LOGIN_BURST){
        return {
          action: ruleAction(store, "login-burst", "block"),
          severity: "critical",
          category: "login",
          ruleId: "login-burst",
          label: "פרץ ניסיונות כניסה",
          reason: "יותר מדי ניסיונות כניסה בחלון זמן קצר",
          method, url, path, username, ip, sessionId: sess
        };
      }
    }

    if(isWriteMethod(method) && looksLikeCrmApi(url, path) && !isLoginPath(url, path) && ruleEnabled(store, "write-burst")){
      const burst = hitBucket("write", sess, WRITE_BURST, WRITE_WINDOW_MS);
      if(burst.over){
        return {
          action: ruleAction(store, "write-burst", "log"),
          severity: "suspicious",
          category: "rate",
          ruleId: "write-burst",
          label: "פרץ כתיבות",
          reason: "קצב כתיבה חריג מול השרת",
          method, url, path, username, ip, sessionId: sess
        };
      }
    }

    if(isExportPath(url, path) && ruleEnabled(store, "export-burst")){
      const burst = hitBucket("export", sess, EXPORT_BURST, EXPORT_WINDOW_MS);
      if(burst.over){
        return {
          action: ruleAction(store, "export-burst", "log"),
          severity: "suspicious",
          category: "rate",
          ruleId: "export-burst",
          label: "פרץ ייצוא",
          reason: "קצב ייצוא / הורדה חריג",
          method, url, path, username, ip, sessionId: sess
        };
      }
    }

    return allowDecision(method, url, path, "clean");
  }

  function allowDecision(method, url, path, reason){
    return {
      action: "allow",
      severity: "info",
      category: "clean",
      ruleId: "",
      label: "מאושר",
      reason: reason || "clean",
      method, url, path
    };
  }

  function pathFromUrl(url){
    try {
      const u = new URL(url, "https://local.invalid");
      return u.pathname || "";
    } catch(_e) {
      return trim(url).split("?")[0];
    }
  }

  function queryFromUrl(url){
    const i = trim(url).indexOf("?");
    return i >= 0 ? trim(url).slice(i + 1) : "";
  }

  function stringifyBody(body){
    if(body == null) return "";
    if(typeof body === "string") return body;
    if(typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return body.toString();
    if(typeof FormData !== "undefined" && body instanceof FormData) return "";
    if(typeof Blob !== "undefined" && body instanceof Blob) return "";
    if(typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) return "";
    try { return JSON.stringify(body); } catch(_e) { return ""; }
  }

  function isLoginPath(url, path){
    const s = (url + " " + path).toLowerCase();
    return /gi_verify_agent_login|gi-open-agent-session|auth\/v1\/token/.test(s);
  }

  function isWriteMethod(method){
    return /^(POST|PUT|PATCH|DELETE)$/.test(method);
  }

  function looksLikeCrmApi(url, path){
    const s = (url + " " + path).toLowerCase();
    return /supabase\.co|\/rest\/v1\/|\/functions\/v1\//.test(s);
  }

  function isExportPath(url, path){
    const s = (url + " " + path).toLowerCase();
    return /export|download|gi-customer-files|storage\/v1\/object/.test(s);
  }

  function skipInspect(url){
    const s = trim(url).toLowerCase();
    if(!s) return true;
    if(s.indexOf(INGEST_PATH) >= 0) return true;
    if(/gi_waf_/.test(s)) return true;
    return false;
  }

  function recordEvent(decision, extra){
    if(!decision || decision.action === "allow") return null;
    const store = loadStore();
    const event = {
      id: uid("evt"),
      at: iso(),
      action: decision.action,
      severity: decision.severity || "suspicious",
      category: decision.category || "unknown",
      ruleId: decision.ruleId || "",
      label: decision.label || "",
      reason: decision.reason || "",
      method: decision.method || extra?.method || "",
      path: decision.path || extra?.path || pathFromUrl(decision.url || extra?.url || ""),
      username: trim(extra?.username || decision.username),
      ip: trim(extra?.ip || decision.ip || "browser"),
      sessionId: trim(extra?.sessionId || decision.sessionId || sessionId()),
      snippet: trim(extra?.snippet).slice(0, MAX_SNIPPET)
    };
    store.events.unshift(event);
    if(store.events.length > MAX_EVENTS) store.events.length = MAX_EVENTS;
    const incident = triageEvent(store, event);
    saveStore(store);
    if(decision.action === "block" && event.severity === "critical" && extra?.skipAutoBlock !== true){
      autoBlock(store, event);
    }
    scheduleIngest(event);
    if(root && typeof root.dispatchEvent === "function"){
      try { root.dispatchEvent(new CustomEvent("gi-waf-event", { detail: event })); } catch(_e) {}
    }
    return { event, incident };
  }

  function autoBlock(store, event){
    const until = iso(now() + AUTO_BLOCK_MS);
    const value = event.username || event.sessionId || event.ip;
    if(!value) return;
    const kind = event.username ? "username" : (event.ip && event.ip !== "browser" ? "ip" : "session");
    const exists = (store.blocks || []).some((b) => b.kind === kind && trim(b.value).toLowerCase() === trim(value).toLowerCase() && (!b.until || Date.parse(b.until) > now()));
    if(exists) return;
    store.blocks.unshift({
      id: uid("blk"),
      kind,
      value,
      reason: "חסימה אוטומטית: " + (event.label || event.category),
      until,
      createdAt: iso()
    });
    saveStore(store);
  }

  function recommendationFor(event){
    const cat = event.category;
    if(cat === "login"){
      return "נעילה זמנית של המשתמש לפי מדיניות 10 ניסיונות / 15 דקות. אם הלקוח לגיטימי — שחרור מניהול משתמשים. אם לא — השאירו חסימה ובדקו לוג פעילות.";
    }
    if(cat === "xss" || cat === "sqli" || cat === "cmd" || cat === "ssrf" || cat === "traversal"){
      return "הבקשה נחסמה ולא יצאה לשרת. השאירו את הכלל דלוק, בדקו מי המשתמש, ואל תריצו את המטען ידנית. תעדו לפי תוכנית התגובה לאירוע.";
    }
    if(cat === "ip"){
      return "ודאו שה-IP אינו נציג מהמשרד. אם כן — הסירו חסימה. אם לא — השאירו חסום וצמצמו הרשאות אם יש חשבון קשור.";
    }
    if(cat === "rate"){
      return "בדקו אם מדובר בנציג שעובד כרגיל או בייצוא חריג. אם חריג — הגבילו ייצוא וסקרו את התיקים שנפתחו.";
    }
    return "סווגו את האירוע, תעדו החלטה, וסגרו רק אחרי בלימה או אישור שווא.";
  }

  function triageEvent(store, event){
    if(event.severity === "info") return null;
    const windowStart = now() - (30 * 60 * 1000);
    const related = (store.incidents || []).find((inc) => {
      if(inc.status === "closed") return false;
      if(inc.category !== event.category) return false;
      const sameActor = trim(inc.actor).toLowerCase() === trim(event.username || event.sessionId).toLowerCase();
      return sameActor && Date.parse(inc.updatedAt || inc.createdAt) >= windowStart;
    });
    if(related){
      related.count = (related.count || 1) + 1;
      related.updatedAt = iso();
      related.severity = rankSeverity(related.severity, event.severity);
      related.eventIds = (related.eventIds || []).concat([event.id]).slice(-20);
      related.summary = event.reason;
      return related;
    }
    if(event.severity === "suspicious" && event.action !== "block"){
      const recentSame = (store.events || []).filter((e) => e.category === event.category && Date.parse(e.at) >= windowStart).length;
      if(recentSame < 3) return null;
    }
    const incident = {
      id: uid("inc"),
      createdAt: iso(),
      updatedAt: iso(),
      status: event.action === "block" ? "contained" : "open",
      severity: event.severity,
      category: event.category,
      title: titleFor(event),
      summary: event.reason,
      recommendation: recommendationFor(event),
      actor: event.username || event.sessionId,
      eventIds: [event.id],
      count: 1
    };
    store.incidents.unshift(incident);
    if(store.incidents.length > MAX_INCIDENTS) store.incidents.length = MAX_INCIDENTS;
    return incident;
  }

  function titleFor(event){
    if(event.category === "login") return "חשד לניחוש קוד כניסה";
    if(event.category === "xss") return "ניסיון XSS נחסם";
    if(event.category === "sqli") return "ניסיון SQL Injection נחסם";
    if(event.category === "traversal") return "ניסיון גישה לקבצי מערכת נחסם";
    if(event.category === "ssrf") return "ניסיון SSRF נחסם";
    if(event.category === "cmd") return "ניסיון הרצת פקודה נחסם";
    if(event.category === "ip") return "מקור חסום ניסה לגשת למערכת";
    if(event.category === "rate") return "קצב בקשות חריג";
    return "אירוע אבטחה";
  }

  function rankSeverity(a, b){
    const order = { info: 0, suspicious: 1, critical: 2 };
    return (order[b] || 0) >= (order[a] || 0) ? b : a;
  }

  function guardLogin(username){
    const decision = inspectRequest({
      method: "POST",
      url: "/rest/v1/rpc/gi_verify_agent_login",
      path: "/rest/v1/rpc/gi_verify_agent_login",
      username: trim(username),
      body: ""
    });
    if(decision.action === "block"){
      recordEvent(decision, { username: trim(username), snippet: "login-guard" });
      return {
        ok: false,
        error: "חומת האש חסמה את הכניסה אחרי ניסיונות חריגים. נסו שוב מאוחר יותר או פנו למנהל."
      };
    }
    return { ok: true };
  }

  function recordLoginOutcome(result){
    const res = result && typeof result === "object" ? result : {};
    const username = trim(res.username);
    const key = (username || sessionId()).toLowerCase();
    if(res.ok === true){
      buckets.login.delete(key);
      return null;
    }
    const burst = hitBucket("login", key, LOGIN_BURST, LOGIN_WINDOW_MS);
    const code = trim(res.code);
    const over = burst.over || code === "LOCKED";
    const decision = {
      action: over ? "block" : "log",
      severity: over ? "critical" : "suspicious",
      category: "login",
      ruleId: "login-burst",
      label: code === "LOCKED" ? "נעילת כניסה בשרת" : (over ? "פרץ ניסיונות כניסה" : "קוד כניסה שגוי"),
      reason: code === "LOCKED"
        ? "השרת נעל את הכניסה אחרי ניסיונות כושלים"
        : (over ? "יותר מדי ניסיונות כניסה בחלון זמן קצר" : "ניסיון כניסה נכשל"),
      method: "POST",
      path: "/rest/v1/rpc/gi_verify_agent_login",
      username
    };
    return recordEvent(decision, { username, snippet: code || "BAD_PIN" });
  }

  function setEnabled(on){
    const store = loadStore();
    store.enabled = !!on;
    saveStore(store);
    renderConsole();
    return store.enabled;
  }

  function setRuleEnabled(id, on){
    const store = loadStore();
    const rule = store.rules.find((r) => r.id === id);
    if(!rule) return false;
    rule.enabled = !!on;
    saveStore(store);
    renderConsole();
    return true;
  }

  function addIpRule(ip, note){
    const value = trim(ip);
    if(!value) return { ok: false, error: "חסר IP" };
    const store = loadStore();
    const id = uid("ip");
    store.rules.push({
      id,
      enabled: true,
      kind: "ip",
      action: "block",
      category: "ip",
      label: trim(note) || ("חסימת " + value),
      pattern: value
    });
    store.blocks.unshift({
      id: uid("blk"),
      kind: "ip",
      value,
      reason: trim(note) || "חסימה ידנית מקונסולת SOC",
      until: null,
      createdAt: iso()
    });
    saveStore(store);
    renderConsole();
    return { ok: true, id };
  }

  function removeBlock(id){
    const store = loadStore();
    store.blocks = (store.blocks || []).filter((b) => b.id !== id);
    saveStore(store);
    renderConsole();
  }

  function setIncidentStatus(id, status){
    const store = loadStore();
    const inc = store.incidents.find((x) => x.id === id);
    if(!inc) return false;
    inc.status = status;
    inc.updatedAt = iso();
    saveStore(store);
    renderConsole();
    return true;
  }

  function stats(){
    const store = loadStore();
    const cutoff = now() - (24 * 60 * 60 * 1000);
    const recent = store.events.filter((e) => Date.parse(e.at) >= cutoff);
    return {
      enabled: store.enabled !== false,
      blocked24h: recent.filter((e) => e.action === "block").length,
      alerts24h: recent.length,
      openIncidents: store.incidents.filter((i) => i.status !== "closed").length,
      rulesOn: store.rules.filter((r) => r.enabled !== false).length,
      blocksOn: store.blocks.filter((b) => !b.until || Date.parse(b.until) > now()).length
    };
  }

  function canManage(){
    try {
      const Auth = root?.Auth;
      if(Auth?.isAdmin?.() || Auth?.isManager?.()) return true;
    } catch(_e) {}
    try {
      const role = trim(root?.Auth?.current?.role).toLowerCase();
      return role === "admin" || role === "owner" || role === "manager";
    } catch(_e2) {}
    return false;
  }

  function currentUsername(){
    try { return trim(root?.Auth?.current?.username || root?.Auth?.current?.name); } catch(_e) { return ""; }
  }

  function blockedResponse(decision){
    const blockedBody = {
      ok: false,
      error: "WAF_BLOCKED",
      ruleId: decision.ruleId || "",
      message: decision.reason || "הבקשה נחסמה על ידי חומת האש"
    };
    if(typeof Response === "undefined"){
      return Promise.reject(Object.assign(new Error("WAF_BLOCKED"), blockedBody));
    }
    return Promise.resolve(new Response(JSON.stringify(blockedBody), {
      status: 403,
      statusText: "Forbidden",
      headers: { "Content-Type": "application/json", "X-GI-WAF": "blocked" }
    }));
  }

  function readRequestLike(input, init){
    const req = { method: "GET", url: "", body: "", username: currentUsername() };
    try {
      if(typeof Request !== "undefined" && input instanceof Request){
        req.url = input.url || "";
        req.method = input.method || "GET";
      } else {
        req.url = typeof input === "string" ? input : trim(input && input.url);
        req.method = trim(init && init.method) || "GET";
        if(init && init.body != null) req.body = stringifyBody(init.body);
      }
    } catch(_e) {}
    req.path = pathFromUrl(req.url);
    return req;
  }

  function installFetchGuard(){
    if(!root || typeof root.fetch !== "function" || state.installed) return;
    state.nativeFetch = root.fetch.bind(root);
    state.installed = true;
    root.fetch = function giWafFetch(input, init){
      try {
        const req = readRequestLike(input, init);
        if(!skipInspect(req.url)){
          const decision = inspectRequest(req);
          if(decision.action !== "allow"){
            recordEvent(decision, { username: req.username, snippet: haystackOf(req).slice(0, MAX_SNIPPET) });
          }
          if(decision.action === "block"){
            return blockedResponse(decision);
          }
        }
      } catch(_e) {}
      return state.nativeFetch(input, init);
    };
  }

  function scheduleIngest(event){
    if(!event || state.ingestBusy) return;
    if(typeof root === "undefined" || typeof root.fetch !== "function") return;
    try {
      if(!canManage()) return;
    } catch(_e) { return; }
    state.ingestBusy = true;
    Promise.resolve().then(async () => {
      try {
        const url = FALLBACK_SUPABASE_URL + INGEST_PATH;
        const fetchFn = state.nativeFetch || root.fetch;
        await fetchFn(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({
            p_event: {
              action: event.action,
              severity: event.severity,
              category: event.category,
              rule_id: event.ruleId,
              path: event.path,
              method: event.method,
              username: event.username,
              detail: event.reason
            }
          })
        }).catch(() => null);
      } catch(_e) {}
      state.ingestBusy = false;
    });
  }

  function probeSelfTest(){
    const samples = [
      { name: "XSS", body: "<script>alert(1)</script>" },
      { name: "SQLi", body: "' or 1=1 union select password from agents" },
      { name: "Traversal", body: "../../etc/passwd" }
    ];
    const results = samples.map((s) => {
      const actor = "soc-probe-" + s.name.toLowerCase();
      const decision = inspectRequest({
        method: "POST",
        url: "https://example.supabase.co/rest/v1/customers",
        body: s.body,
        username: actor
      });
      if(decision.action !== "allow"){
        recordEvent(decision, { username: actor, snippet: s.body, skipAutoBlock: true });
      }
      return { name: s.name, action: decision.action, ruleId: decision.ruleId, label: decision.label };
    });
    renderConsole();
    return results;
  }

  function $(id){
    try { return root?.document?.getElementById(id); } catch(_e) { return null; }
  }

  function sevClass(sev){
    if(sev === "critical") return "is-crit";
    if(sev === "suspicious") return "is-warn";
    return "is-info";
  }

  function statusHe(status){
    if(status === "open") return "פתוח";
    if(status === "investigating") return "בחקירה";
    if(status === "contained") return "בלום";
    if(status === "closed") return "סגור";
    return status || "";
  }

  function actionHe(action){
    if(action === "block") return "חסום";
    if(action === "log") return "תיעוד";
    return "אושר";
  }

  function timeHe(value){
    try {
      return new Date(value).toLocaleString("he-IL", { hour12: false });
    } catch(_e) {
      return value || "";
    }
  }

  function renderConsole(){
    const rootEl = $("giWafRoot");
    if(!rootEl) return;
    const store = loadStore();
    const s = stats();
    const enabledEl = $("giWafEnabled");
    if(enabledEl) enabledEl.checked = s.enabled;
    const pill = $("giWafPill");
    if(pill){
      pill.textContent = s.enabled ? "חומת אש פעילה" : "חומת אש כבויה";
      pill.classList.toggle("is-off", !s.enabled);
    }
    setText("giWafKpiBlocked", String(s.blocked24h));
    setText("giWafKpiAlerts", String(s.alerts24h));
    setText("giWafKpiIncidents", String(s.openIncidents));
    setText("giWafKpiRules", String(s.rulesOn));

    const live = $("giWafLiveBody");
    if(live){
      const rows = store.events.slice(0, 80);
      live.innerHTML = rows.length ? rows.map((e) => (
        "<tr>" +
          "<td>" + esc(timeHe(e.at)) + "</td>" +
          "<td><span class=\"giWafTag " + sevClass(e.severity) + "\">" + esc(actionHe(e.action)) + "</span></td>" +
          "<td>" + esc(e.label || e.category) + "</td>" +
          "<td dir=\"ltr\">" + esc((e.method || "") + " " + (e.path || "")) + "</td>" +
          "<td>" + esc(e.username || e.ip || "") + "</td>" +
          "<td>" + esc(e.reason) + "</td>" +
        "</tr>"
      )).join("") : "<tr><td colspan=\"6\" class=\"giWafEmpty\">אין אירועים עדיין. חומת האש מתעדת חסימות, כניסות כושלות וחריגות.</td></tr>";
    }

    const inc = $("giWafIncidentBody");
    if(inc){
      const rows = store.incidents.slice(0, 50);
      inc.innerHTML = rows.length ? rows.map((i) => (
        "<article class=\"giWafIncident " + sevClass(i.severity) + "\">" +
          "<div class=\"giWafIncident__top\">" +
            "<strong>" + esc(i.title) + "</strong>" +
            "<span class=\"giWafTag " + sevClass(i.severity) + "\">" + esc(statusHe(i.status)) + "</span>" +
          "</div>" +
          "<p>" + esc(i.summary) + "</p>" +
          "<p class=\"giWafIncident__rec\"><b>המלצת SOC:</b> " + esc(i.recommendation) + "</p>" +
          "<div class=\"giWafIncident__meta\">" + esc(timeHe(i.createdAt)) + " · " + esc(i.actor || "") + " · " + esc(String(i.count || 1)) + " אירועים</div>" +
          "<div class=\"giWafIncident__acts\">" +
            (i.status === "closed" ? "" : "<button type=\"button\" class=\"btn\" data-waf-inc=\"" + esc(i.id) + "\" data-waf-status=\"investigating\">חקירה</button>") +
            (i.status === "closed" ? "" : "<button type=\"button\" class=\"btn\" data-waf-inc=\"" + esc(i.id) + "\" data-waf-status=\"contained\">בלימה</button>") +
            (i.status === "closed" ? "" : "<button type=\"button\" class=\"btn btn--primary\" data-waf-inc=\"" + esc(i.id) + "\" data-waf-status=\"closed\">סגור</button>") +
          "</div>" +
        "</article>"
      )).join("") : "<div class=\"giWafEmpty\">אין אירועים פתוחים.</div>";
    }

    const rules = $("giWafRulesBody");
    if(rules){
      rules.innerHTML = store.rules.map((r) => (
        "<label class=\"giWafRule\">" +
          "<input type=\"checkbox\" data-waf-rule=\"" + esc(r.id) + "\" " + (r.enabled !== false ? "checked" : "") + "/>" +
          "<span><b>" + esc(r.label) + "</b><small>" + esc(r.kind === "signature" ? "חתימה · " + actionHe(r.action) : r.kind === "ip" ? "IP · " + esc(r.pattern || "") : "קצב · " + actionHe(r.action)) + "</small></span>" +
        "</label>"
      )).join("");
    }

    const blocks = $("giWafBlockBody");
    if(blocks){
      const rows = store.blocks.filter((b) => !b.until || Date.parse(b.until) > now());
      blocks.innerHTML = rows.length ? rows.map((b) => (
        "<tr>" +
          "<td>" + esc(b.kind) + "</td>" +
          "<td dir=\"ltr\">" + esc(b.value) + "</td>" +
          "<td>" + esc(b.reason) + "</td>" +
          "<td>" + esc(b.until ? timeHe(b.until) : "קבוע") + "</td>" +
          "<td><button type=\"button\" class=\"btn\" data-waf-unblock=\"" + esc(b.id) + "\">שחרר</button></td>" +
        "</tr>"
      )).join("") : "<tr><td colspan=\"5\" class=\"giWafEmpty\">אין חסימות פעילות.</td></tr>";
    }

    const doc = root?.document;
    if(doc){
      doc.querySelectorAll("[data-waf-tab]").forEach((btn) => {
        const on = btn.getAttribute("data-waf-tab") === state.tab;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      doc.querySelectorAll("[data-waf-pane]").forEach((pane) => {
        pane.hidden = pane.getAttribute("data-waf-pane") !== state.tab;
      });
    }
  }

  function setText(id, value){
    const el = $(id);
    if(el) el.textContent = value;
  }

  function setTab(tab){
    state.tab = tab || "live";
    renderConsole();
  }

  function bindConsole(){
    if(state.bound) return;
    const doc = root?.document;
    if(!doc) return;
    const rootEl = $("giWafRoot");
    if(!rootEl) return;
    state.bound = true;
    rootEl.addEventListener("click", (ev) => {
      const t = ev.target && ev.target.closest ? ev.target.closest("[data-waf-tab],[data-waf-inc],[data-waf-unblock],[data-waf-probe],[data-waf-addip]") : null;
      if(!t) return;
      if(t.hasAttribute("data-waf-tab")) setTab(t.getAttribute("data-waf-tab"));
      if(t.hasAttribute("data-waf-inc")) setIncidentStatus(t.getAttribute("data-waf-inc"), t.getAttribute("data-waf-status"));
      if(t.hasAttribute("data-waf-unblock")) removeBlock(t.getAttribute("data-waf-unblock"));
      if(t.hasAttribute("data-waf-probe")){
        const results = probeSelfTest();
        const box = $("giWafProbeOut");
        if(box){
          box.textContent = results.map((r) => r.name + ": " + actionHe(r.action) + " (" + (r.label || r.ruleId) + ")").join(" · ");
        }
      }
      if(t.hasAttribute("data-waf-addip")){
        const ip = trim($("giWafIpInput")?.value);
        const note = trim($("giWafIpNote")?.value);
        const res = addIpRule(ip, note);
        const box = $("giWafIpMsg");
        if(box) box.textContent = res.ok ? "ה-IP נחסם." : (res.error || "לא נשמר");
        if(res.ok && $("giWafIpInput")) $("giWafIpInput").value = "";
      }
    });
    rootEl.addEventListener("change", (ev) => {
      const t = ev.target;
      if(!t) return;
      if(t.id === "giWafEnabled") setEnabled(!!t.checked);
      if(t.hasAttribute("data-waf-rule")) setRuleEnabled(t.getAttribute("data-waf-rule"), !!t.checked);
    });
  }

  function install(){
    installFetchGuard();
    bindConsole();
    if(root?.document){
      if(root.document.readyState === "loading"){
        root.document.addEventListener("DOMContentLoaded", () => { bindConsole(); });
      }
    }
    return api;
  }

  const api = {
    TAG,
    SIGNATURES,
    inspectRequest,
    matchSignature,
    guardLogin,
    recordLoginOutcome,
    recordEvent,
    setEnabled,
    setRuleEnabled,
    addIpRule,
    removeBlock,
    setIncidentStatus,
    stats,
    probeSelfTest,
    renderConsole,
    install,
    loadStore,
    recommendationFor
  };

  if(root && root.document) install();
  return api;
});
