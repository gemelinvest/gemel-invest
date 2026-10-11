/* מסך פלזמה למוקד — נתונים חיים מהמערכת, בלי רענון ידני. */
(function () {
  "use strict";

  var URL = "https://vhvlkerectggovfihjgm.supabase.co";
  var KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
  var POLL_MS = 8000;
  var FETCH_MS = 12000;
  var SOON_MS = 10 * 60 * 1000;
  var POP_MS = 5000;
  var CALL_MAX_MS = 8 * 60 * 60 * 1000;

  var SESSION_KEY = "sb-vhvlkerectggovfihjgm-auth-token";
  var sessionMem = null;
  var refreshFlight = null;
  var sessionGen = 0;

  function storeGet(key) {
    try {
      if (window.localStorage) {
        var localValue = localStorage.getItem(key);
        if (localValue) return localValue;
      }
    } catch (_local) {}
    try {
      if (window.sessionStorage) return sessionStorage.getItem(key);
    } catch (_session) {}
    return null;
  }

  function storeSet(key, value) {
    try { if (window.localStorage) localStorage.setItem(key, value); } catch (_local) {}
    try { if (window.sessionStorage) sessionStorage.setItem(key, value); } catch (_session) {}
  }

  function readSession() {
    if (sessionMem && sessionMem.access_token) return sessionMem;
    var raw = storeGet(SESSION_KEY);
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.currentSession && parsed.currentSession.access_token) parsed = parsed.currentSession;
      if (parsed && parsed.access_token) {
        sessionMem = parsed;
        return sessionMem;
      }
    } catch (_parse) {}
    return null;
  }

  function writeSession(session) {
    sessionMem = session && session.access_token ? session : null;
    if (!sessionMem) return;
    if (!sessionMem.expires_at) {
      var exp = jwtExp(sessionMem.access_token);
      if (exp) sessionMem.expires_at = exp;
    }
    storeSet(SESSION_KEY, JSON.stringify(sessionMem));
  }

  function clearSession() {
    sessionGen += 1;
    sessionMem = null;
    try { if (window.localStorage) localStorage.removeItem(SESSION_KEY); } catch (_local) {}
    try { if (window.sessionStorage) sessionStorage.removeItem(SESSION_KEY); } catch (_session) {}
  }

  function jwtExp(token) {
    try {
      var part = String(token || "").split(".")[1];
      if (!part || typeof atob !== "function") return 0;
      var pad = part.replace(/-/g, "+").replace(/_/g, "/");
      while (pad.length % 4) pad += "=";
      var json = JSON.parse(atob(pad));
      var exp = Number(json && json.exp);
      return Number.isFinite(exp) ? exp : 0;
    } catch (_exp) { return 0; }
  }

  function tokenExp(session) {
    var exp = Number(session && session.expires_at);
    if (Number.isFinite(exp) && exp > 0) return exp;
    return jwtExp(session && session.access_token);
  }

  function sessionFresh(session) {
    if (!session || !session.access_token) return false;
    var exp = tokenExp(session);
    if (!exp) return true;
    return exp * 1000 > Date.now() + 20000;
  }

  function authHeaders(jsonBody, anon) {
    var session = anon ? null : readSession();
    var token = (!anon && session && sessionFresh(session)) ? session.access_token : KEY;
    var headers = {
      apikey: KEY,
      Authorization: "Bearer " + token,
      Accept: "application/json"
    };
    if (jsonBody) headers["Content-Type"] = "application/json";
    return headers;
  }

  function fetchBound(url, options) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var opts = {};
    var source = options || {};
    Object.keys(source).forEach(function (key) { opts[key] = source[key]; });
    var timer = 0;
    if (controller) {
      opts.signal = controller.signal;
      timer = window.setTimeout(function () {
        try { controller.abort(); } catch (_abort) {}
      }, FETCH_MS);
    }
    return fetch(url, opts).then(function (res) {
      if (timer) window.clearTimeout(timer);
      return res;
    }, function (err) {
      if (timer) window.clearTimeout(timer);
      var name = err && err.name;
      if (name === "AbortError" || name === "TimeoutError") {
        var timeoutErr = new Error("הזמן המוקצב לבקשה נגמר");
        timeoutErr.name = "TimeoutError";
        throw timeoutErr;
      }
      throw err;
    });
  }

  function queryString(params) {
    var parts = [];
    var keys = Object.keys(params || {});
    for (var i = 0; i < keys.length; i += 1) {
      var value = params[keys[i]];
      if (value == null || value === "") continue;
      parts.push(encodeURIComponent(keys[i]) + "=" + encodeURIComponent(String(value)));
    }
    return parts.join("&");
  }

  function refreshSession() {
    if (refreshFlight) return refreshFlight;
    var current = readSession();
    if (!current || !current.refresh_token) return Promise.resolve(false);
    var gen = sessionGen;
    refreshFlight = fetchBound(URL + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: "Bearer " + KEY,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refresh_token: current.refresh_token })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || !data || !data.access_token || gen !== sessionGen) return false;
        writeSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token || current.refresh_token,
          expires_in: data.expires_in,
          expires_at: data.expires_at || (Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600)),
          token_type: data.token_type || "bearer",
          user: data.user || current.user || null
        });
        return true;
      });
    }).catch(function () {
      return false;
    }).then(function (ok) {
      refreshFlight = null;
      if (!ok && gen === sessionGen) clearSession();
      return ok && gen === sessionGen;
    });
    return refreshFlight;
  }

  async function restSend(method, path, params, body, didRefresh, anon) {
    if (!anon && !didRefresh) {
      var current = readSession();
      if (current && current.access_token && !sessionFresh(current)) {
        var warmed = await refreshSession();
        if (!warmed) clearSession();
      }
    }
    var query = queryString(params);
    var res = await fetchBound(URL + path + (query ? "?" + query : ""), {
      method: method,
      headers: authHeaders(body != null, !!anon),
      body: body == null ? undefined : JSON.stringify(body)
    });
    if (res.status === 401 && !didRefresh && !anon) {
      var refreshed = await refreshSession();
      if (refreshed) return restSend(method, path, params, body, true, false);
      clearSession();
    }
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) {
      var message = (data && (data.message || data.error_description || data.msg)) || ("HTTP " + res.status);
      if (/jwt expired/i.test(message)) message = "הכניסה הקודמת פגה. נסו שוב.";
      return { data: null, error: { message: message, status: res.status } };
    }
    return { data: data, error: null };
  }

  function restGet(table, params, anon) {
    return restSend("GET", "/rest/v1/" + table, params, null, false, !!anon);
  }

  function restRpc(name, args, anon) {
    return restSend("POST", "/rest/v1/rpc/" + name, null, args || {}, false, !!anon);
  }

  var seenFiles = null;
  var popQueue = [];
  var popOn = false;
  var lastRows = [];
  var screenOn = false;
  var watchStarted = false;

  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function trim(value) { return String(value == null ? "" : value).trim(); }
  function pad(n) { return String(n).padStart(2, "0"); }

  function viewSize() {
    var root = document.documentElement;
    var vv = window.visualViewport;
    var w = Number(window.innerWidth) || Number(root && root.clientWidth) || Number(vv && vv.width) || 0;
    var h = Number(window.innerHeight) || Number(root && root.clientHeight) || Number(vv && vv.height) || 0;
    return { w: w, h: h };
  }

  var fitPending = 0;
  var fitAttempts = 0;

  function scheduleFit() {
    if (fitPending || fitAttempts > 40) return;
    fitPending = window.setTimeout(function () {
      fitPending = 0;
      fit();
    }, 250);
  }

  function fit() {
    var node = $("wall");
    if (!node) return;
    fitAttempts += 1;
    var size = viewSize();
    var w = size.w;
    var h = size.h;
    var s = (w > 0 && h > 0) ? Math.min(w / 1920, h / 1080) : 0;
    if (!(s > 0)) {
      scheduleFit();
      return;
    }
    var x = Math.round((w - 1920 * s) / 2);
    var y = Math.round((h - 1080 * s) / 2);
    node.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")";
    placeFs();
  }

  function armFit() {
    fit();
    var tries = 0;
    var timer = window.setInterval(function () {
      tries += 1;
      fit();
      var size = viewSize();
      if ((size.w > 0 && size.h > 0 && tries >= 4) || tries >= 24) window.clearInterval(timer);
    }, 250);
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    window.addEventListener("pageshow", fit);
    if (window.visualViewport && window.visualViewport.addEventListener) {
      window.visualViewport.addEventListener("resize", fit);
    }
  }

  function placeFs() {
    var btn = $("fsBtn");
    if (!btn) return;
    var slot = $("fsSlot");
    var title = document.querySelector(".top h1");
    var screen = $("screen");
    var open = screen && !screen.hidden;
    var rect = open && slot ? slot.getBoundingClientRect() : null;
    var titleRect = open && title ? title.getBoundingClientRect() : null;
    if (rect && rect.width > 8 && rect.height > 8 && titleRect && titleRect.height > 8) {
      var size = 40;
      var left = Math.round(rect.left + (rect.width - size) / 2);
      var limit = Math.round(titleRect.left - 18 - size);
      if (left + size > titleRect.left - 12) left = limit;
      btn.style.right = "auto";
      btn.style.left = left + "px";
      btn.style.top = Math.round(titleRect.top + (titleRect.height - size) / 2) + "px";
      btn.style.width = size + "px";
      btn.style.height = size + "px";
      return;
    }
    btn.style.left = "auto";
    btn.style.right = "18px";
    btn.style.top = "18px";
    btn.style.width = "40px";
    btn.style.height = "40px";
  }

  function israelParts(date) {
    var bag = {};
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jerusalem",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23", weekday: "long"
    }).formatToParts(date || new Date()).forEach(function (part) {
      bag[part.type] = part.value;
    });
    return bag;
  }

  var HE_DAYS = {
    Sunday: "ראשון", Monday: "שני", Tuesday: "שלישי", Wednesday: "רביעי",
    Thursday: "חמישי", Friday: "שישי", Saturday: "שבת"
  };
  var HE_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

  function paintClock() {
    var bag = israelParts(new Date());
    var hour = Number(bag.hour) || 0;
    var hourText = pad(hour);
    var dayName = HE_DAYS[bag.weekday] || "";
    var monthName = HE_MONTHS[(Number(bag.month) || 1) - 1] || "";
    var dateText = dayName + ", " + Number(bag.day) + " ב" + monthName + " " + bag.year;
    var floorHour = $("floorHour");
    var floorMin = $("floorMin");
    var floorSec = $("floorSec");
    var floorDate = $("floorDate");
    if (floorHour) floorHour.textContent = hourText;
    if (floorMin) floorMin.textContent = bag.minute;
    if (floorSec) floorSec.textContent = bag.second;
    if (floorDate) floorDate.textContent = dateText;
  }

  function clockText(ms) {
    var sec = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return h > 0 ? (pad(h) + ":" + pad(m) + ":" + pad(s)) : (pad(m) + ":" + pad(s));
  }

  function israelWallToMs(dateStr, timeStr) {
    var date = trim(dateStr);
    var time = trim(timeStr).slice(0, 5);
    var bits = date.split("-");
    var clock = time.split(":");
    if (bits.length < 3 || clock.length < 2) return NaN;
    var guess = Date.UTC(Number(bits[0]), Number(bits[1]) - 1, Number(bits[2]), Number(clock[0]), Number(clock[1]), 0);
    if (!Number.isFinite(guess)) return NaN;
    var bag = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(guess)).forEach(function (part) { bag[part.type] = part.value; });
    var asWall = Date.UTC(Number(bag.year), Number(bag.month) - 1, Number(bag.day), Number(bag.hour), Number(bag.minute), Number(bag.second));
    return guess - (asWall - guess);
  }

  function dayBounds() {
    var bag = israelParts(new Date());
    var start = israelWallToMs(bag.year + "-" + bag.month + "-" + bag.day, "00:00");
    return { start: new Date(start), end: new Date(start + 86400000 - 1) };
  }

  function appointmentMs(row) {
    return israelWallToMs(row.bookDate, row.bookTime);
  }

  function isTrue(value) {
    return value === true || value === "true" || value === "t";
  }

  function liveCall(row, now) {
    if (!isTrue(row.callActive)) return null;
    if (trim(row.finishedAt) || isTrue(row.timerHidden)) return null;
    var started = Date.parse(trim(row.startedAt));
    if (!Number.isFinite(started)) return null;
    var age = now - started;
    if (age < 0 || age > CALL_MAX_MS) return null;
    return { started: started, ms: age };
  }

  var SCREEN = {
    idle: "הצגה עצמית",
    declinePending: "סיום ללא המשך",
    personalVerify: "פרטי מבוטח/ים",
    consent: "הסכמת הר הביטוח",
    existing: "ביטוחים קיימים",
    compareNotice: "אישור היעדר ביטוח",
    offer: "פוליסות מוצעות",
    reasons: "שיקולי המלצה",
    premiumCost: "עלות הביטוח",
    newPolicies: "עלות הביטוח",
    futureCancel: "שינוי או ביטול בעתיד",
    disclosure: "גילוי נאות",
    cancelQuestionnaire: "שאלון ביטול",
    beneficiaries: "פרטי מוטבים",
    healthDeclaration: "הצהרת בריאות",
    paymentDetails: "פרטי אמצעי תשלום",
    insuranceStart: "סיכום והצהרות",
    mirrorSummaryReport: "דוח תיקוני הצעה",
    mirrorFlowDone: "סיום השיקוף"
  };

  function stageText(raw) {
    var phase = trim(raw.uiPhase);
    var sub = trim(raw.needsSub);
    var key = trim(raw.stepKey);
    var label = trim(raw.stepLabel);
    if (phase === "mirrorSummaryReport" || (!phase && key === "mirrorSummaryReport")) return SCREEN.mirrorSummaryReport;
    if (phase === "declinePending") return SCREEN.declinePending;
    if (phase === "idle") return SCREEN.idle;
    if (phase === "step2") {
      var specificSub = sub === "existing" || sub === "offer" || sub === "reasons" || sub === "compareNotice";
      var specificKey = key === "existing" || key === "offer" || key === "reasons" || key === "compareNotice";
      if (specificSub && SCREEN[sub]) return SCREEN[sub];
      if (specificKey && SCREEN[key]) return SCREEN[key];
      if (SCREEN[sub]) return SCREEN[sub];
      if (SCREEN[key]) return SCREEN[key];
    }
    if (phase && SCREEN[phase]) return SCREEN[phase];
    if (key === "mirrorSummaryReport") return SCREEN.mirrorSummaryReport;
    if (key && key !== "idle" && SCREEN[key]) return SCREEN[key];
    if (key === "idle") return SCREEN.idle;
    if (label) return label;
    return "שיחת שיקוף";
  }

  function signStage(row) {
    var sent = trim(row.sigAt) || trim(row.result) === "pendingSignatures";
    if (!sent) return "";
    var label = trim(row.sigLabel);
    if (/פתח/.test(label)) return label;
    if (label && label !== "נשלח SMS ללקוח לחתימות") return label;
    return "נשלח לחתימות המבוטח/ים";
  }

  function policyAmount(policy) {
    if (!policy || typeof policy !== "object") return 0;
    var raw = policy.premiumAfterDiscountValue;
    if (raw == null || raw === "") raw = policy.premiumAfterDiscount;
    if (raw == null || raw === "") raw = policy.premiumValue;
    if (raw == null || raw === "") raw = policy.monthlyPremium;
    if (raw == null || raw === "") raw = policy.premium;
    var n = Number(String(raw == null ? "" : raw).replace(/[^\d.\-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function proposedPremium(raw) {
    var direct = Array.isArray(raw.policies) ? raw.policies : [];
    var list = direct.length ? direct : (Array.isArray(raw.opPolicies) ? raw.opPolicies : []);
    var sum = 0;
    var any = false;
    list.forEach(function (policy) {
      if (!policy || typeof policy !== "object") return;
      if (String(policy.origin || "") === "existing") return;
      any = true;
      sum += policyAmount(policy);
    });
    return { sum: sum, any: any };
  }

  function productionTotal(rows) {
    var sum = 0;
    (rows || []).forEach(function (row) {
      if (!trim(row && row.issuedAt)) return;
      var premium = proposedPremium(row);
      if (premium.any) sum += premium.sum;
    });
    return sum;
  }

  function productionMoney(sum) {
    return "₪" + Math.round(Number(sum) || 0).toLocaleString("he-IL");
  }

  function waitingMirrorTotal(rows) {
    var sum = 0;
    (rows || []).forEach(function (row) {
      if (!row || !row.waiting || !row.health) return;
      if (trim(row.summaryAt) || trim(row.issuedAt)) return;
      if (row.premium && row.premium.any) sum += row.premium.sum;
    });
    return sum;
  }

  function moneyText(premium) {
    if (!premium || !premium.any) return "—";
    return "₪" + Math.round(premium.sum).toLocaleString("he-IL");
  }

  function classify(raw, now) {
    var submitted = trim(raw.submitted);
    var waitingAt = Date.parse(trim(raw.waitingAt) || trim(raw.submitted));
    var call = liveCall(raw, now);
    var when = appointmentMs(raw);
    var waiting = !!submitted && !call && !trim(raw.result);
    var soon = waiting && Number.isFinite(when) && when >= now && (when - now) <= SOON_MS;
    var late = waiting && Number.isFinite(when) && when < now;
    var sign = signStage(raw);
    var premium = proposedPremium(raw);
    var flow = trim(raw.flowType).toLowerCase();
    var health = flow !== "elementary" && !trim(raw.elementary);
    return {
      id: trim(raw.id),
      name: trim(raw.full_name) || "לקוח",
      phone: trim(raw.phone) || "—",
      seller: trim(raw.agent_name) || "נציג",
      topic: "שיחת שיקוף",
      premium: premium,
      submitted: submitted,
      waitingAt: Number.isFinite(waitingAt) ? waitingAt : NaN,
      when: when,
      soon: soon,
      late: late,
      waiting: waiting,
      call: call,
      agent: trim(raw.startedBy) || trim(raw.owner) || trim(raw.updatedBy) || "נציג",
      stage: stageText(raw),
      summaryAt: trim(raw.summaryAt),
      issuedAt: trim(raw.issuedAt),
      health: health,
      sign: sign
    };
  }

  function markNearest(rows) {
    var nearest = null;
    rows.forEach(function (row) {
      row.blink = false;
      if (!row.soon || !Number.isFinite(row.when)) return;
      if (!nearest || row.when < nearest.when) nearest = row;
    });
    if (nearest) nearest.blink = true;
  }

  function statusText(row, now) {
    if (row.sign && !row.waiting && !row.call) return row.sign;
    if (row.blink) return "מתקרב למועד שיחת שיקוף";
    if (row.late) return "עבר המועד";
    if (Number.isFinite(row.when)) {
      var bag = israelParts(new Date(row.when));
      var today = israelParts(new Date(now));
      var hm = bag.hour + ":" + bag.minute;
      if (bag.year === today.year && bag.month === today.month && bag.day === today.day) return hm;
      return bag.day + "." + bag.month + " · " + hm;
    }
    return "ממתין לתזמון";
  }

  function initials(name) {
    return trim(name).split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join("");
  }

  function renderWait(rows, now) {
    var body = $("waitBody");
    if (!body) return;
    markNearest(rows);
    var list = rows.filter(function (row) { return row.waiting; });
    list.sort(function (a, b) {
      var aw = Number.isFinite(a.when) ? a.when : Infinity;
      var bw = Number.isFinite(b.when) ? b.when : Infinity;
      if (aw !== bw) return aw - bw;
      var as = Number.isFinite(a.waitingAt) ? a.waitingAt : Infinity;
      var bs = Number.isFinite(b.waitingAt) ? b.waitingAt : Infinity;
      return as - bs;
    });
    if (!list.length) {
      body.innerHTML = '<div class="empty">אין ממתינים לשיקוף</div>';
    } else {
      body.innerHTML = list.slice(0, 6).map(function (row) {
        var cls = row.blink ? " is-soon" : (row.late ? " is-late" : "");
        return '<div class="wrow' + cls + '">'
          + '<span class="wname"><b>' + esc(row.name) + '</b></span>'
          + '<span class="wprem">' + esc(moneyText(row.premium)) + '</span>'
          + '<span class="wwhen">' + esc(statusText(row, now)) + '</span>'
          + '</div>';
      }).join("");
    }
    var waitingOnly = rows.filter(function (row) { return row.waiting; });
    paintLanes(waitingOnly, rows);
    paintNext(list, now);
  }

  function paintLanes(waitingOnly, rows) {
    var lanes = $("lanes");
    if (!lanes) return;
    var soon = waitingOnly.filter(function (row) { return row.soon; }).length;
    var late = waitingOnly.filter(function (row) { return row.late; }).length;
    var plain = waitingOnly.length - soon - late;
    var signs = rows.filter(function (row) { return row.sign && !row.call; }).length;
    var items = [
      ["ממתינים לשיקוף", plain, "#3870ED"],
      ["מתקרב למועד", soon, "#f59e0b"],
      ["עבר המועד", late, "#e11d48"],
      ["בחתימות", signs, "#1f9d55"]
    ];
    lanes.innerHTML = items.map(function (item) {
      return '<li><span>' + esc(item[0]) + '<i class="dot" style="background:' + item[2] + '"></i></span><b>' + item[1] + '</b></li>';
    }).join("");
  }

  function paintNext(list, now) {
    var box = $("nextBox");
    var name = $("nextName");
    var meta = $("nextMeta");
    if (!box || !name || !meta) return;
    var next = list.find(function (row) { return row.blink; }) || list.find(function (row) { return row.waiting; }) || null;
    box.classList.toggle("is-soon", !!(next && next.soon));
    if (!next) {
      name.textContent = "—";
      meta.textContent = "אין לקוח ממתין";
      return;
    }
    name.textContent = next.name;
    meta.textContent = trim(next.seller) || "נציג";
  }

  function renderCalls(rows, now) {
    var body = $("callBody");
    var calls = rows.filter(function (row) { return row.call; });
    calls.sort(function (a, b) { return a.call.started - b.call.started; });
    var kpi = $("kpiCalls");
    if (kpi) kpi.textContent = String(calls.length);
    if (!body) return;
    if (!calls.length) {
      body.innerHTML = '<div class="empty">אין שיחות שיקוף פתוחות</div>';
      return;
    }
    body.innerHTML = calls.slice(0, 6).map(function (row) {
      return '<div class="crow">'
        + '<span>' + esc(row.name) + '</span>'
        + '<span>' + esc(row.agent) + '</span>'
        + '<span class="callTime"><span class="chip" data-started="' + row.call.started + '">' + esc(clockText(now - row.call.started)) + '</span><span class="talk" aria-hidden="true">' + talkSvg() + '</span></span>'
        + '<span class="stage">' + esc(row.stage) + '</span>'
        + '</div>';
    }).join("");
  }

  function showPop(item) {
    var pop = $("filePop");
    var agent = $("popAgent");
    if (!pop || !agent) return;
    agent.textContent = item.seller || "נציג";
    pop.hidden = false;
  }

  function hidePop() {
    var pop = $("filePop");
    if (pop) pop.hidden = true;
  }

  function pumpPop() {
    if (popOn || !popQueue.length) return;
    var item = popQueue.shift();
    popOn = true;
    showPop(item);
    window.setTimeout(function () {
      hidePop();
      popOn = false;
      pumpPop();
    }, POP_MS);
  }

  function noteArrivals(rows) {
    var fresh = {};
    rows.forEach(function (row) {
      if (!row.submitted) return;
      fresh[row.id + "|" + row.submitted] = row;
    });
    if (!seenFiles) {
      seenFiles = fresh;
      return;
    }
    var added = [];
    Object.keys(fresh).forEach(function (key) {
      if (!seenFiles[key]) added.push(fresh[key]);
    });
    seenFiles = fresh;
    added.sort(function (a, b) { return String(a.submitted).localeCompare(String(b.submitted)); });
    added.forEach(function (row) { popQueue.push(row); });
    pumpPop();
  }

  function doneToday(rows) {
    var bounds = dayBounds();
    var start = bounds.start.getTime();
    var end = bounds.end.getTime();
    var count = 0;
    rows.forEach(function (row) {
      var at = Date.parse(trim(row.summaryAt));
      if (!Number.isFinite(at) || at < start || at > end) return;
      count += 1;
    });
    return count;
  }

  function paintDone(rows) {
    var node = $("kpiDone");
    if (node) node.textContent = String(doneToday(rows));
  }

  function paintTicker() {
    var node = $("ticker");
    if (!node) return;
    var line = "שלום מחלקת שירות ותפעול. בשעה טובה התחדשנו במערכת חדשה. שיהיה בהצלחה :)";
    var sep = '<i class="tickDot" aria-hidden="true"></i>';
    var piece = esc(line) + sep;
    var group = '<span class="tickGroup">' + piece + piece + piece + piece + "</span>";
    node.innerHTML = group + group;
  }

  function talkSvg() {
    return '<svg class="ico" viewBox="0 0 108 52">'
      + '<g class="talk__hand"><g transform="translate(0,8) scale(1.35)">'
      + '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7A2 2 0 0 1 22 16.9z"/>'
      + '</g></g>'
      + '<path class="talk__wave" d="M46 18c2.6 3 2.6 7.4 0 10.4"/>'
      + '<path class="talk__wave w2" d="M54 12.5c4.2 4.6 4.2 13.4 0 18"/>'
      + '<circle cx="80" cy="16" r="7.2"/>'
      + '<path d="M66 48c2-9.2 6.2-14 14-14s12 4.8 14 14"/>'
      + '</svg>';
  }

  function wxKind(code, isDay) {
    var n = Number(code);
    var day = Number(isDay) !== 0;
    if (n === 0) return day ? "clear-day" : "clear-night";
    if (n === 1 || n === 2) return day ? "partly-day" : "partly-night";
    if (n === 3) return "cloud";
    if (n === 45 || n === 48) return "fog";
    if ((n >= 51 && n <= 67) || (n >= 80 && n <= 82)) return "rain";
    if ((n >= 71 && n <= 77) || n === 85 || n === 86) return "snow";
    if (n === 95 || n === 96 || n === 99) return "storm";
    return "cloud";
  }

  function wxLabel(kind) {
    if (kind === "clear-day" || kind === "clear-night") return "בהיר";
    if (kind === "partly-day" || kind === "partly-night") return "מעונן חלקית";
    if (kind === "cloud") return "מעונן";
    if (kind === "fog") return "ערפל";
    if (kind === "rain") return "גשם";
    if (kind === "snow") return "שלג";
    if (kind === "storm") return "סופת רעמים";
    return "מזג אוויר";
  }

  function wxSvg(kind) {
    var paths = {
      "clear-day": '<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2.2M12 19.2v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/>',
      "clear-night": '<path d="M15.6 3.4A8.1 8.1 0 1 0 20.6 14 6.3 6.3 0 0 1 15.6 3.4z"/>',
      "partly-day": '<circle cx="7.6" cy="7.4" r="2.6"/><path d="M7.6 2.6v1.3M3.2 7.4H4.5M4.6 4.4l.9.9M10.6 4.4l-.9.9"/><path d="M8.2 18.6h8.4a3.2 3.2 0 0 0 .3-6.4 4.5 4.5 0 0 0-8.6 1.3 2.9 2.9 0 0 0-.1 5.1z"/>',
      "partly-night": '<path d="M13.6 3.2A4.6 4.6 0 0 0 15.4 8 3.8 3.8 0 0 1 10.6 4.2 4.4 4.4 0 0 1 13.6 3.2z"/><path d="M8.2 18.6h8.4a3.2 3.2 0 0 0 .3-6.4 4.5 4.5 0 0 0-8.6 1.3 2.9 2.9 0 0 0-.1 5.1z"/>',
      cloud: '<path d="M7 17.6h9.4a3.8 3.8 0 0 0 .4-7.6 5.3 5.3 0 0 0-10.2 1.6A3.4 3.4 0 0 0 7 17.6z"/>',
      fog: '<path d="M4 8.2h16M6.2 12h11.6M4 15.8h16"/>',
      rain: '<path d="M7.2 14.2h9a3.3 3.3 0 0 0 .4-6.6 4.7 4.7 0 0 0-9 1.3 3 3 0 0 0-.4 5.3z"/><path class="wx__drop" d="M8.2 15.1l-.7 1.7"/><path class="wx__drop wx__drop--b" d="M12 15.1l-.7 1.7"/><path class="wx__drop wx__drop--c" d="M15.8 15.1l-.7 1.7"/>',
      snow: '<path d="M7.2 13.4h9a3.3 3.3 0 0 0 .4-6.6 4.7 4.7 0 0 0-9 1.3 3 3 0 0 0-.4 5.3z"/><path d="M8.2 16.4v2.6M7 17.7h2.4M12 16.4v2.6M10.8 17.7h2.4M15.8 16.4v2.6M14.6 17.7h2.4"/>',
      storm: '<path d="M7.2 13.6h9a3.3 3.3 0 0 0 .4-6.6 4.7 4.7 0 0 0-9 1.3 3 3 0 0 0-.4 5.3z"/><path d="M13 15.2l-2.1 3.2h2.2L11.2 21"/>'
    };
    var mark = kind === "rain" ? "ico wx--rain" : "ico";
    return '<svg class="' + mark + '" viewBox="0 0 24 24">' + (paths[kind] || paths.cloud) + "</svg>";
  }

  var weatherSeen = false;
  var weatherTimer = 0;

  function paintWeather(info) {
    var icon = $("wxIcon");
    var temp = $("wxTemp");
    var text = $("wxText");
    if (!icon || !temp || !text) return;
    if (!info) {
      if (weatherSeen) return;
      icon.innerHTML = wxSvg("cloud");
      temp.textContent = "—";
      text.textContent = "מזג אוויר";
      return;
    }
    var kind = wxKind(info.code, info.day);
    weatherSeen = true;
    icon.innerHTML = wxSvg(kind);
    temp.textContent = String(info.temp) + "°";
    text.textContent = wxLabel(kind);
  }

  function weatherPlace() {
    return fetch("https://get.geojs.io/v1/ip/geo.json", { cache: "no-store" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        var lat = Number(data && data.latitude);
        var lon = Number(data && data.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
        return { lat: lat, lon: lon };
      })
      .catch(function () { return null; });
  }

  function pullWeather() {
    return weatherPlace().then(function (place) {
      if (!place) {
        paintWeather(null);
        return;
      }
      var url = "https://api.open-meteo.com/v1/forecast?latitude=" + encodeURIComponent(place.lat)
        + "&longitude=" + encodeURIComponent(place.lon)
        + "&current=temperature_2m,weather_code,is_day&timezone=Asia%2FJerusalem";
      return fetch(url, { cache: "no-store" }).then(function (res) {
        return res.ok ? res.json() : null;
      }).then(function (data) {
        var cur = data && data.current;
        var temp = Number(cur && cur.temperature_2m);
        if (!cur || !Number.isFinite(temp) || cur.weather_code == null) {
          paintWeather(null);
          return;
        }
        paintWeather({ temp: Math.round(temp), code: cur.weather_code, day: cur.is_day });
      }).catch(function () { paintWeather(null); });
    });
  }

  function startWeather() {
    pullWeather();
    if (weatherTimer) return;
    weatherTimer = window.setInterval(pullWeather, 15 * 60 * 1000);
  }

  function paintAll() {
    var now = Date.now();
    renderWait(lastRows, now);
    renderCalls(lastRows, now);
    paintDone(lastRows);
    paintTicker(lastRows);
    paintWaiting(lastRows);
  }

  var SELECT = [
    "id", "full_name", "phone", "agent_name",
    "submitted:payload->opsProcess->>submittedToOpsAt",
    "waitingAt:payload->opsProcess->>waitingMirrorAt",
    "live:payload->opsProcess->>liveState",
    "result:payload->opsProcess->>resultStatus",
    "owner:payload->opsProcess->>ownerName",
    "updatedBy:payload->opsProcess->>updatedBy",
    "sigAt:payload->opsProcess->>signatureSentAt",
    "sigLabel:payload->opsProcess->>signatureStatusLabel",
    "callActive:payload->mirrorFlow->callSession->>active",
    "startedAt:payload->mirrorFlow->callSession->>startedAt",
    "startedBy:payload->mirrorFlow->callSession->>startedBy",
    "finishedAt:payload->mirrorFlow->callSession->>finishedAt",
    "timerHidden:payload->mirrorFlow->callSession->>fileTimerHidden",
    "stepLabel:payload->mirrorFlow->callSession->>flowStepLabel",
    "stepKey:payload->mirrorFlow->callSession->>flowStepKey",
    "uiPhase:payload->mirrorFlow->callSession->>uiPhase",
    "needsSub:payload->mirrorFlow->callSession->>needsSubPhase",
    "summaryAt:payload->mirrorFlow->callSession->>mirrorSummaryAt",
    "issuedAt:payload->opsProcess->>issuedToProductionAt",
    "flowType:payload->>flowType",
    "elementary:payload->>elementaryProduct",
    "bookDate:payload->mirrorCallBookings->current->>date",
    "bookTime:payload->mirrorCallBookings->current->>time",
    "policies:payload->newPolicies",
    "opPolicies:payload->operational->newPolicies"
  ].join(",");

  var FILTER = [
    "payload->opsProcess->>submittedToOpsAt.not.is.null",
    "payload->opsProcess->>resultStatus.not.is.null",
    "payload->mirrorFlow->callSession->>active.eq.true",
    "payload->mirrorCallBookings->current->>date.not.is.null"
  ].join(",");

  async function pullQueue() {
    var res = await restGet("customers", {
      select: SELECT,
      or: "(" + FILTER + ")",
      order: "updated_at.desc",
      limit: "400"
    });
    if (res.error) throw res.error;
    var now = Date.now();
    lastRows = (res.data || []).map(function (row) { return classify(row, now); });
    noteArrivals(lastRows);
    paintAll();
  }

  function paintWaiting(rows) {
    var node = $("kpiScope");
    if (node) node.textContent = productionMoney(waitingMirrorTotal(rows));
  }

  function paintProduction(sum) {
    var node = $("kpiProduction");
    if (node) node.textContent = productionMoney(sum);
  }

  async function pullProduction() {
    var productionFilter = {};
    productionFilter.select = "policies:payload->newPolicies,opPolicies:payload->operational->newPolicies,issuedAt:payload->opsProcess->>issuedToProductionAt";
    productionFilter["payload->opsProcess->>issuedToProductionAt"] = "not.is.null";
    productionFilter.limit = "2000";
    var res = await restGet("customers", productionFilter);
    if (res.error) return;
    paintProduction(productionTotal(res.data || []));
  }

  var MODEL_MS = 10 * 60 * 1000;
  var modelRow = null;
  var modelQrToken = "";

  function modelLive(row, now) {
    var at = Date.parse(trim(row && row.approved_at));
    if (!row || !trim(row.image)) return false;
    if (!Number.isFinite(at)) return false;
    var age = now - at;
    return age >= -60000 && age < MODEL_MS;
  }

  function modelPageUrl(token) {
    var path = String(location.pathname || "/");
    var slash = path.lastIndexOf("/");
    var base = slash >= 0 ? path.slice(0, slash + 1) : "/";
    return location.origin + base + "model.html?t=" + encodeURIComponent(token);
  }

  function drawModelQr(url) {
    var host = $("modelQr");
    if (!host || typeof qrcode !== "function") return;
    var qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    var n = qr.getModuleCount();
    var quiet = 2;
    var size = n + quiet * 2;
    var parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + " " + size + '" shape-rendering="crispEdges">'];
    parts.push('<rect width="' + size + '" height="' + size + '" fill="#ffffff"/>');
    var r;
    var c;
    for (r = 0; r < n; r += 1) {
      for (c = 0; c < n; c += 1) {
        if (!qr.isDark(r, c)) continue;
        parts.push('<rect x="' + (c + quiet) + '" y="' + (r + quiet) + '" width="1" height="1" fill="#172033"/>');
      }
    }
    parts.push("</svg>");
    host.innerHTML = parts.join("");
  }

  function paintModel(row) {
    modelRow = row || null;
    var idle = $("modelIdle");
    var shown = $("modelLive");
    var card = $("modelCard");
    if (!idle || !shown) return;
    var live = modelLive(modelRow, Date.now());
    idle.hidden = live;
    shown.hidden = !live;
    if (card) card.classList.toggle("is-live", live);
    if (live) {
      var photo = $("modelPhoto");
      var cap = $("modelCaption");
      var line = trim(modelRow.caption);
      if (photo && photo.getAttribute("src") !== modelRow.image) photo.src = modelRow.image;
      if (cap) {
        cap.textContent = line;
        cap.hidden = !line;
      }
      return;
    }
    var token = trim(modelRow && modelRow.upload_token);
    if (!token || token === modelQrToken) return;
    modelQrToken = token;
    drawModelQr(modelPageUrl(token));
  }

  async function pullModel() {
    try {
      var res = await restGet("gi_plasma_model", {
        select: "caption,approved_at,upload_token",
        id: "eq.wall",
        limit: "1"
      });
      if (!res || res.error) return;
      var row = (res.data && res.data[0]) || null;
      if (!row) {
        paintModel(null);
        return;
      }
      var at = Date.parse(trim(row.approved_at));
      var age = Date.now() - at;
      var fresh = Number.isFinite(at) && age >= -60000 && age < MODEL_MS;
      if (!fresh) {
        row.image = "";
        paintModel(row);
        return;
      }
      if (modelRow && trim(modelRow.image) && trim(modelRow.approved_at) === trim(row.approved_at)) {
        row.image = modelRow.image;
        paintModel(row);
        return;
      }
      var full = await restGet("gi_plasma_model", {
        select: "image,caption,approved_at,upload_token",
        id: "eq.wall",
        limit: "1"
      });
      if (!full || full.error) return;
      paintModel((full.data && full.data[0]) || row);
    } catch (_model) {}
  }

  function sessionEnded(err) {
    var message = trim(err && err.message);
    var status = Number(err && err.status);
    if (status === 401) return true;
    if (/jwt expired/i.test(message)) return true;
    return message.indexOf("הכניסה הקודמת פגה") !== -1;
  }

  function showGate(message) {
    screenOn = false;
    var gate = $("gate");
    var screen = $("screen");
    if (gate) gate.hidden = false;
    if (screen) screen.hidden = true;
    var err = $("gateErr");
    if (err && message) err.textContent = message;
    radioStop();
  }

  var pullBusy = false;
  async function pull() {
    if (!screenOn || pullBusy) return;
    pullBusy = true;
    try {
      if (!sessionFresh(readSession())) {
        var warmed = await refreshSession();
        if (!screenOn) return;
        if (!warmed || !sessionFresh(readSession())) {
          showGate("הכניסה הקודמת פגה. נסו שוב.");
          return;
        }
      }
      await pullQueue();
      await pullProduction();
      await radioPullShared(false);
      await pullModel();
    } catch (err) {
      if (!screenOn) return;
      if (sessionEnded(err)) {
        showGate("הכניסה הקודמת פגה. נסו שוב.");
        return;
      }
      var body = $("waitBody");
      if (body && !lastRows.length) {
        body.innerHTML = '<div class="empty">אין חיבור לנתונים. בדקו שהכניסה היא של מנהל או נציג תפעול.</div>';
      }
    } finally {
      pullBusy = false;
    }
  }

  function watch() {
    if (watchStarted) return;
    watchStarted = true;
    window.setInterval(pull, POLL_MS);
    window.setInterval(function () { radioPullShared(false); }, 2000);
    window.setInterval(tickLive, 1000);
  }

  function tickLive() {
    var now = Date.now();
    document.querySelectorAll("[data-since]").forEach(function (node) {
      var since = Number(node.getAttribute("data-since"));
      if (!Number.isFinite(since) || !since) return;
      node.textContent = clockText(now - since);
    });
    document.querySelectorAll("[data-started]").forEach(function (node) {
      var started = Number(node.getAttribute("data-started"));
      if (!Number.isFinite(started) || !started) return;
      node.textContent = clockText(now - started);
    });
    if (modelRow) paintModel(modelRow);
  }

  function bindFullscreen() {
    var btn = $("fsBtn");
    function sync() {
      var on = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (btn) {
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.setAttribute("aria-label", on ? "יציאה ממסך מלא" : "מסך מלא");
      }
      fit();
    }
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
  }

  var STATIONS = [
    { id: "glglz", name: "גלגל״צ", group: "live", url: "https://glzwizzlv.bynetcdn.com/glglz_mp3" },
    { id: "hits", name: "להיטים חמים", group: "music", url: "https://glzwizzlv.bynetcdn.com/glglz_hits_mp3" },
    { id: "med", name: "ים תיכוני", group: "music", url: "https://glzwizzlv.bynetcdn.com/glglz_med_mp3" },
    { id: "rock", name: "רוק", group: "music", url: "https://glzwizzlv.bynetcdn.com/glglz_rock_mp3" },
    { id: "alt", name: "אלטרנטיבי", group: "music", url: "https://glzwizzlv.bynetcdn.com/glglz_alt_mp3" },
    { id: "reggae", name: "רגאיי", group: "music", url: "https://jointil.com/stream-reggae" },
    { id: "blues", name: "בלוז", group: "music", url: "https://jointil.com/stream-blues" },
    { id: "beat", name: "ביט", group: "music", url: "https://jointil.com/stream-beat" },
    { id: "israeli", name: "ישראלי", group: "music", url: "https://glzwizzlv.bynetcdn.com/glglz_classicil_mp3" },
    { id: "foreign", name: "לועזי", group: "music", url: "https://strm112.1.fm/90s_mobile_mp3" },
    { id: "pop", name: "פופ", group: "music", url: "https://strm112.1.fm/top40_mobile_mp3" },
    { id: "mizrahi", name: "רדיו חופית", group: "music", url: "https://live.ecast.co.il/stream/mizrahit" }
  ];
  var radioId = "hits";
  var radioOn = true;
  var radioPlaying = false;
  var radioDown = false;
  var radioVolume = 35;
  var radioStationStamp = null;
  var radioListenAt = Date.now();
  var radioTuneGen = 0;
  var radioTuneAttempt = 0;
  var radioRetryTimer = 0;

  function radioById(id) {
    for (var i = 0; i < STATIONS.length; i += 1) {
      if (STATIONS[i].id === id) return STATIONS[i];
    }
    return STATIONS[0];
  }

  function radioValidId(id) {
    var station = radioById(id);
    return station && station.id === id ? station : null;
  }

  function radioSetVolume(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return;
    radioVolume = Math.max(0, Math.min(100, Math.round(n)));
    var audio = $("radioAudio");
    if (audio) audio.volume = radioVolume / 100;
  }

  function radioHardStop(audio) {
    try { audio.pause(); } catch (_pause) {}
    try { audio.src = ""; } catch (_clear) {}
    try { audio.removeAttribute("src"); } catch (_drop) {}
    try { audio.load(); } catch (_load) {}
  }

  function radioScheduleRetry(generation, attempt) {
    if (generation !== radioTuneGen) return;
    if (attempt >= 1) {
      if (radioRetryTimer) {
        window.clearTimeout(radioRetryTimer);
        radioRetryTimer = 0;
      }
      radioPlaying = false;
      radioDown = true;
      radioPaint();
      return;
    }
    if (radioRetryTimer) return;
    radioRetryTimer = window.setTimeout(function () {
      radioRetryTimer = 0;
      if (generation !== radioTuneGen || radioPlaying) return;
      var node = $("radioAudio");
      if (node) node.removeAttribute("data-station");
      radioTune(true, attempt + 1);
    }, 400);
  }

  function radioTune(andPlay, attempt) {
    var audio = $("radioAudio");
    var station = radioValidId(radioId);
    if (!station) {
      radioId = "hits";
      station = radioById("hits");
    }
    if (!audio) return;
    if (radioRetryTimer) {
      window.clearTimeout(radioRetryTimer);
      radioRetryTimer = 0;
    }
    var generation = (radioTuneGen += 1);
    var tries = attempt || 0;
    radioTuneAttempt = tries;
    if (audio.getAttribute("data-station") !== station.id) {
      audio.setAttribute("data-tune", "0");
      radioHardStop(audio);
      audio.src = station.url;
      audio.setAttribute("data-station", station.id);
      try { audio.load(); } catch (_load) {}
    }
    audio.setAttribute("data-tune", String(generation));
    radioSetVolume(radioVolume);
    radioDown = false;
    if (!andPlay) return;
    var pending = audio.play();
    if (pending && pending.then) {
      pending.then(function () {
        if (generation !== radioTuneGen) return;
        radioPlaying = true;
        radioDown = false;
        radioPaint();
      }).catch(function () {
        if (generation !== radioTuneGen) return;
        radioScheduleRetry(generation, tries);
      });
    }
  }

  function radioPaint() {
    var box = $("radioBox");
    var title = $("radioTitle");
    var kind = $("radioKind");
    var play = $("radioPlay");
    var menu = $("radioMenu");
    var station = radioById(radioId);
    if (box) {
      box.classList.toggle("is-on", radioPlaying);
      box.classList.toggle("is-down", radioDown);
    }
    if (title) title.textContent = station.name;
    if (kind) kind.textContent = radioDown ? "אין קליטה" : (station.group === "music" ? "מוזיקה בלבד" : "שידור חי");
    if (play) {
      play.textContent = radioPlaying ? "❚❚" : "▶";
      play.setAttribute("aria-label", radioPlaying ? "השהה" : "הפעל רדיו");
    }
    if (!menu) return;
    var html = "";
    var groups = [["live", "שידור חי"], ["music", "מוזיקה בלבד"]];
    groups.forEach(function (group) {
      html += '<div class="radio__group">' + group[1] + "</div>";
      STATIONS.forEach(function (item) {
        if (item.group !== group[0]) return;
        html += '<button type="button" class="radio__item' + (item.id === radioId ? " is-on" : "") + '" data-station="' + item.id + '">' + esc(item.name) + "</button>";
      });
    });
    menu.innerHTML = html;
  }

  function radioOpen(force) {
    var menu = $("radioMenu");
    if (!menu) return;
    menu.hidden = force === false ? true : !menu.hidden;
  }

  function radioApplyShared(row, play) {
    var retune = !!play;
    if (row) {
      if (row.volume != null && row.volume !== "") radioSetVolume(row.volume);
      var stamp = trim(row.station_updated_at);
      var next = radioValidId(trim(row.station_id));
      if (radioStationStamp == null) {
        radioStationStamp = stamp;
        var stampMs = Date.parse(stamp);
        if (next && Number.isFinite(stampMs) && stampMs > radioListenAt + 1000) {
          radioId = next.id;
          radioOn = true;
          retune = true;
        }
      } else if (next && stamp && stamp !== radioStationStamp) {
        radioStationStamp = stamp;
        var playingNow = $("radioAudio");
        if (playingNow && next.id === radioId) playingNow.removeAttribute("data-station");
        radioId = next.id;
        radioOn = true;
        retune = true;
      } else if (stamp && stamp !== radioStationStamp) {
        radioStationStamp = stamp;
      }
    }
    if (!retune) return;
    if (radioOn) radioTune(true);
    radioPaint();
  }

  var radioPullTicket = 0;
  async function radioPullShared(play) {
    var ticket = (radioPullTicket += 1);
    var row = null;
    try {
      var res = await restGet("gi_plasma_radio", {
        select: "station_id,volume,station_updated_at",
        id: "eq.wall",
        limit: "1"
      });
      if (res && !res.error) row = (res.data && res.data[0]) || null;
    } catch (_e) {}
    if (ticket !== radioPullTicket) return;
    radioApplyShared(row, play);
  }

  function radioPlayFromGesture() {
    radioId = "hits";
    radioOn = true;
    radioSetVolume(radioVolume);
    radioTune(true);
    radioPaint();
  }

  function radioStop() {
    var audio = $("radioAudio");
    if (audio) audio.pause();
    radioPlaying = false;
    radioPaint();
  }

  function radioBind() {
    radioSetVolume(radioVolume);
    radioPaint();
    var audio = $("radioAudio");
    if (audio) {
      audio.addEventListener("playing", function () {
        radioPlaying = true;
        radioDown = false;
        radioPaint();
      });
      audio.addEventListener("error", function () {
        if (!audio.getAttribute("src")) return;
        if (Number(audio.getAttribute("data-tune")) !== radioTuneGen) return;
        radioScheduleRetry(radioTuneGen, radioTuneAttempt);
      });
    }
  }

  function showScreen() {
    screenOn = true;
    $("gate").hidden = true;
    $("screen").hidden = false;
    fit();
    paintClock();
    pull();
    watch();
    radioPullShared(true);
    startWeather();
  }

  async function findAgent(username) {
    var res = await restGet("agents", { select: "id,name,username,role,active" }, true);
    if (res.error) throw res.error;
    var key = trim(username);
    var list = res.data || [];
    return list.find(function (agent) {
      return trim(agent.username) === key || trim(agent.name) === key;
    }) || null;
  }

  async function login(username, pin) {
    clearSession();
    var agent = await findAgent(username);
    if (!agent) throw new Error("שם משתמש לא נמצא");
    if (agent.active === false) throw new Error("המשתמש מושבת");
    var verified = await restRpc("gi_verify_agent_login", {
      p_username: trim(agent.username) || trim(agent.name),
      p_pin: trim(pin)
    }, true);
    if (verified.error || !verified.data || verified.data.ok !== true) {
      throw new Error("קוד כניסה שגוי");
    }
    var opened = await fetchBound(URL + "/functions/v1/gi-open-agent-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: KEY,
        Authorization: "Bearer " + KEY
      },
      body: JSON.stringify({
        agentId: agent.id,
        username: trim(agent.username) || trim(agent.name),
        pin: trim(pin)
      })
    });
    var data = await opened.json().catch(function () { return {}; });
    if (!opened.ok || !data.access_token) throw new Error("לא נפתחה כניסה למערכת");
    var exp = jwtExp(data.access_token);
    writeSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token || "",
      token_type: "bearer",
      expires_at: exp || (Math.floor(Date.now() / 1000) + 3600)
    });
    var user = await restSend("GET", "/auth/v1/user", null, null, false);
    if (user.error || !user.data) throw new Error("לא נשמרה הכניסה");
  }

  async function sessionAlive() {
    var session = readSession();
    if (!session || !session.access_token) return false;
    if (!sessionFresh(session)) {
      var warmed = await refreshSession();
      if (!warmed) {
        clearSession();
        return false;
      }
    }
    var user = await restSend("GET", "/auth/v1/user", null, null, false, false);
    if (user.error || !user.data) {
      clearSession();
      return false;
    }
    return !!(user.data.id || user.data.email || user.data.aud);
  }

  function dropAppWorker() {
    if (!navigator.serviceWorker || !navigator.serviceWorker.getRegistrations) return;
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      (regs || []).forEach(function (reg) {
        try { reg.unregister(); } catch (_e) {}
      });
    }).catch(function () {});
  }

  async function boot() {
    dropAppWorker();
    armFit();
    paintClock();
    window.setInterval(paintClock, 1000);
    radioBind();
    bindFullscreen();
    var form = $("gateForm");
    if (form && form.getAttribute("data-bound") !== "1") {
      form.setAttribute("data-bound", "1");
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var err = $("gateErr");
        err.textContent = "";
        radioPlayFromGesture();
        login($("gateUser").value, $("gatePin").value).then(showScreen).catch(function (error) {
          radioStop();
          var msg = trim(error && error.message);
          if (!msg || /jwt expired/i.test(msg)) msg = "הכניסה הקודמת פגה. נסו שוב.";
          err.textContent = msg;
        });
      });
    }
    var alive = false;
    try { alive = await sessionAlive(); } catch (_session) { alive = false; }
    if (alive) showScreen();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
