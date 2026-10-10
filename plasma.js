/* מסך פלזמה למוקד — נתונים חיים מהמערכת, בלי רענון ידני. */
(function () {
  "use strict";

  var URL = "https://vhvlkerectggovfihjgm.supabase.co";
  var KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
  var POLL_MS = 8000;
  var ONLINE_MS = 120000;
  var SOON_MS = 10 * 60 * 1000;
  var POP_MS = 5000;
  var CALL_MAX_MS = 8 * 60 * 60 * 1000;

  var client = window.supabase.createClient(URL, KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  var opsIds = {};
  var opsNames = {};
  var seenFiles = null;
  var popQueue = [];
  var popOn = false;
  var lastRows = [];
  var lastStar = "—";
  var lastAgentCount = 0;

  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function trim(value) { return String(value == null ? "" : value).trim(); }
  function pad(n) { return String(n).padStart(2, "0"); }

  function fit() {
    var node = $("wall");
    if (!node) return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    var s = Math.min(w / 1920, h / 1080);
    var x = Math.round((w - 1920 * s) / 2);
    var y = Math.round((h - 1080 * s) / 2);
    node.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")";
    placeFs();
  }

  function placeFs() {
    var btn = $("fsBtn");
    if (!btn) return;
    var slot = $("fsSlot");
    var screen = $("screen");
    var open = screen && !screen.hidden;
    var rect = open && slot ? slot.getBoundingClientRect() : null;
    if (rect && rect.width > 8 && rect.height > 8) {
      var w = Math.max(48, Math.round(rect.width));
      var h = Math.max(48, Math.round(rect.height));
      btn.style.right = "auto";
      btn.style.left = Math.round(rect.left + (rect.width - w) / 2) + "px";
      btn.style.top = Math.round(rect.top + (rect.height - h) / 2) + "px";
      btn.style.width = w + "px";
      btn.style.height = h + "px";
      return;
    }
    btn.style.left = "auto";
    btn.style.right = "18px";
    btn.style.top = "18px";
    btn.style.width = "48px";
    btn.style.height = "48px";
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
    consent: "בירור והתאמת צרכים",
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
    if (phase === "step2" && SCREEN[sub]) return SCREEN[sub];
    if (phase === "step2" && SCREEN[key]) return SCREEN[key];
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
    meta.textContent = statusText(next, now);
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
        + '<span class="chip" data-started="' + row.call.started + '">' + esc(clockText(now - row.call.started)) + '</span>'
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

  function paintTicker(rows) {
    var node = $("ticker");
    if (!node) return;
    var bits = ["מוקד שירות ותפעול בשידור חי"];
    var soon = rows.filter(function (row) { return row.blink; })[0];
    if (soon) bits.push(soon.name + " מתקרב למועד שיחת השיקוף");
    var call = rows.filter(function (row) { return row.call; })[0];
    if (call) bits.push(call.agent + " בשיחת שיקוף עם " + call.name);
    if (lastStar && lastStar !== "—") bits.push("מצטיין יומי · " + lastStar);
    var line = bits.join("  ·  ");
    node.innerHTML = "<span>" + esc(line) + "&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;</span><span>" + esc(line) + "&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;</span>";
  }

  function paintAll() {
    var now = Date.now();
    renderWait(lastRows, now);
    renderCalls(lastRows, now);
    paintDone(lastRows);
    paintTicker(lastRows);
    var agents = $("kpiAgents");
    if (agents) agents.textContent = String(lastAgentCount);
    var star = $("kpiStar");
    if (star) star.textContent = lastStar || "—";
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
    var res = await client.from("customers").select(SELECT).or(FILTER).order("updated_at", { ascending: false }).limit(400);
    if (res.error) throw res.error;
    var now = Date.now();
    lastRows = (res.data || []).map(function (row) { return classify(row, now); });
    noteArrivals(lastRows);
    paintAll();
  }

  function isOpsRole(role) {
    var value = trim(role);
    return value === "ops" || value === "opsAgent" || value === "ops_agent" || value === "נציג תפעול" || value === "מנהל תפעול";
  }

  async function pullAgents() {
    var since = new Date(Date.now() - ONLINE_MS).toISOString();
    var res = await client.from("gi_agent_live").select("agent_id,name,online,role,updated_at").eq("online", true).gte("updated_at", since);
    if (res.error) throw res.error;
    var count = 0;
    (res.data || []).forEach(function (row) {
      var id = trim(row.agent_id);
      var name = trim(row.name);
      var known = isOpsRole(row.role) || !!opsIds[id] || !!opsNames[name];
      if (known) count += 1;
    });
    lastAgentCount = count;
    var node = $("kpiAgents");
    if (node) node.textContent = String(count);
  }

  async function loadOpsRoster() {
    var res = await client.from("agents").select("id,name,username,role,active");
    if (res.error) return;
    (res.data || []).forEach(function (agent) {
      if (agent.active === false || !isOpsRole(agent.role)) return;
      if (trim(agent.id)) opsIds[trim(agent.id)] = true;
      if (trim(agent.name)) opsNames[trim(agent.name)] = true;
      if (trim(agent.username)) opsNames[trim(agent.username)] = true;
    });
  }

  async function pullStar() {
    var range = dayBounds();
    var res = await client.rpc("gi_daily_sales_by_agent", {
      p_start: range.start.toISOString(),
      p_end: range.end.toISOString(),
      p_agent_ids: null,
      p_agent_names: null
    });
    if (res.error) return;
    var totals = {};
    (res.data || []).forEach(function (row) {
      var name = trim(row.agent_name);
      if (!name) return;
      totals[name] = (totals[name] || 0) + (Number(row.premium) || 0);
    });
    var best = "";
    var bestValue = 0;
    Object.keys(totals).forEach(function (name) {
      if (totals[name] > bestValue) {
        bestValue = totals[name];
        best = name;
      }
    });
    lastStar = best || "—";
    var node = $("kpiStar");
    if (node) node.textContent = lastStar;
  }

  var pullBusy = false;
  async function pull() {
    if (pullBusy) return;
    pullBusy = true;
    try {
      await pullQueue();
      await pullAgents();
      await radioPullShared(false);
    } catch (err) {
      var body = $("waitBody");
      if (body && !lastRows.length) {
        body.innerHTML = '<div class="empty">אין חיבור לנתונים. בדקו שהכניסה היא של מנהל או נציג תפעול.</div>';
      }
    } finally {
      pullBusy = false;
    }
  }

  function watch() {
    try {
      client.channel("plasma-wall")
        .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, function () { pull(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "gi_agent_live" }, function () { pullAgents(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "gi_plasma_radio" }, function (payload) {
          radioApplyShared(payload && payload.new, false);
        })
        .subscribe();
    } catch (_e) {}
    window.setInterval(pull, POLL_MS);
    window.setInterval(function () { radioPullShared(false); }, 2000);
    window.setInterval(pullStar, 30000);
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
    { id: "beat", name: "ביט", group: "music", url: "https://jointil.com/stream-beat" }
  ];
  var radioId = "hits";
  var radioOn = true;
  var radioPlaying = false;
  var radioDown = false;
  var radioVolume = 35;
  var radioStationStamp = null;
  var radioListenAt = Date.now();

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

  function radioTune(andPlay) {
    var audio = $("radioAudio");
    var station = radioValidId(radioId);
    if (!station) {
      radioId = "hits";
      station = radioById("hits");
    }
    if (!audio) return;
    if (audio.getAttribute("data-station") !== station.id) {
      audio.src = station.url;
      audio.setAttribute("data-station", station.id);
    }
    radioSetVolume(radioVolume);
    radioDown = false;
    if (!andPlay) return;
    var pending = audio.play();
    if (pending && pending.then) {
      pending.then(function () {
        radioPlaying = true;
        radioDown = false;
        radioPaint();
      }).catch(function () {
        radioPlaying = false;
        radioPaint();
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
      } else if (next && stamp && stamp !== radioStationStamp && next.id !== radioId) {
        radioStationStamp = stamp;
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
      var res = await client.from("gi_plasma_radio").select("station_id,volume,station_updated_at").eq("id", "wall").maybeSingle();
      if (res && !res.error) row = res.data || null;
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
        radioDown = true;
        radioPlaying = false;
        radioPaint();
      });
    }
  }

  function showScreen() {
    $("gate").hidden = true;
    $("screen").hidden = false;
    fit();
    paintClock();
    loadOpsRoster().then(pull);
    pullStar();
    watch();
    radioPullShared(true);
  }

  async function findAgent(username) {
    var res = await client.from("agents").select("id,name,username,role,active");
    if (res.error) throw res.error;
    var key = trim(username);
    var list = res.data || [];
    return list.find(function (agent) {
      return trim(agent.username) === key || trim(agent.name) === key;
    }) || null;
  }

  async function login(username, pin) {
    var agent = await findAgent(username);
    if (!agent) throw new Error("שם משתמש לא נמצא");
    if (agent.active === false) throw new Error("המשתמש מושבת");
    var verified = await client.rpc("gi_verify_agent_login", {
      p_username: trim(agent.username) || trim(agent.name),
      p_pin: trim(pin)
    });
    if (verified.error || !verified.data || verified.data.ok !== true) {
      throw new Error("קוד כניסה שגוי");
    }
    var opened = await fetch(URL + "/functions/v1/gi-open-agent-session", {
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
    var set = await client.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token || ""
    });
    if (set.error) throw new Error("לא נשמרה הכניסה");
  }

  async function boot() {
    fit();
    window.addEventListener("resize", fit);
    paintClock();
    window.setInterval(paintClock, 1000);
    radioBind();
    bindFullscreen();
    var session = await client.auth.getSession();
    if (session.data && session.data.session) {
      showScreen();
      return;
    }
    $("gateForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var err = $("gateErr");
      err.textContent = "";
      radioPlayFromGesture();
      login($("gateUser").value, $("gatePin").value).then(showScreen).catch(function (error) {
        radioStop();
        err.textContent = error.message || "הכניסה נכשלה";
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
