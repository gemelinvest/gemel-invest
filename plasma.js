/* GEMEL INVEST — מסך פלזמה למוקד
   עיצוב שידור חי. הנתונים כאן הם תצוגת מוקד עד חיבור לפיד האמת. */
(function () {
  "use strict";

  const BOARD_W = 1920;
  const BOARD_H = 1080;
  const TICKER_TEXT =
    "מבזק זמני · מסך המוקד בשידור חי · נציגים, ממתינים לשיקוף וממתינים לשירות יופיעו כאן בזמן אמת · תוכן המבזק הקבוע יעוצב בהמשך · GEMEL INVEST";

  const STAGE = {
    mirror: { key: "mirror", label: "שיחת שיקוף", cls: "is-mirror" },
    service: { key: "service", label: "שיחת שירות", cls: "is-service" },
    forms: { key: "forms", label: "הקלדת טפסים", cls: "is-forms" },
    sign: { key: "sign", label: "ממתין לחתימות", cls: "is-sign" },
    free: { key: "free", label: "פנוי", cls: "is-free" }
  };

  const now = Date.now();
  const ago = (m, s) => now - (m * 60 + (s || 0)) * 1000;

  const STATE = {
    liveCase: {
      agent: "נועה לוי",
      customer: "דוד כהן",
      startedAt: ago(8, 24)
    },
    agents: [
      { name: "נועה לוי", stage: "mirror", customer: "דוד כהן", startedAt: ago(8, 24) },
      { name: "יוסי אברהם", stage: "service", customer: "מיכל אוחיון", startedAt: ago(14, 11) },
      { name: "מיכל שטרן", stage: "forms", customer: "אלירן משה", startedAt: ago(6, 3) },
      { name: "איתי מזרחי", stage: "sign", customer: "סיגל בר", startedAt: ago(21, 40) },
      { name: "רותם כהן", stage: "free" },
      { name: "שירי לוין", stage: "service", customer: "אמיר סבן", startedAt: ago(3, 18) },
      { name: "הדר ביטון", stage: "forms", customer: "יצחק מלול", startedAt: ago(11, 52) },
      { name: "אורי נחום", stage: "free" }
    ],
    waitingMirror: [
      { name: "רונית אלון", since: ago(7, 42) },
      { name: "מאיר חדד", since: ago(4, 18) },
      { name: "יעל בן דוד", since: ago(2, 5) }
    ],
    waitingService: [
      { name: "אביגיל שלום", since: ago(11, 3) },
      { name: "תומר גבאי", since: ago(5, 40) },
      { name: "ליאור עזרא", since: ago(1, 12) },
      { name: "נועם ברק", since: ago(0, 48) }
    ]
  };

  function $(id) {
    return document.getElementById(id);
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function elapsed(from) {
    if (!from) return "";
    const sec = Math.max(0, Math.floor((Date.now() - from) / 1000));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  function waitHeat(from) {
    const min = (Date.now() - from) / 60000;
    if (min >= 8) return "is-hot";
    if (min >= 4) return "is-mid";
    return "";
  }

  function initials(name) {
    return String(name || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0))
      .join("");
  }

  function shiftLabel(d) {
    const h = d.getHours();
    if (h < 14) return "משמרת בוקר";
    if (h < 22) return "משמרת אחר הצהריים";
    return "משמרת לילה";
  }

  function fitBoard() {
    const board = $("board");
    if (!board) return;
    const s = Math.min(window.innerWidth / BOARD_W, window.innerHeight / BOARD_H);
    board.style.transform = "scale(" + s + ")";
  }

  function viewFromQuery() {
    const q = new URLSearchParams(location.search);
    const raw = (q.get("view") || q.get("room") || "").toLowerCase();
    if (raw === "or" || raw === "mirror" || raw === "room") return "or";
    return "floor";
  }

  function applyView(view) {
    const board = $("board");
    const floor = $("view-floor");
    const or = $("view-or");
    if (!board || !floor || !or) return;
    const isOr = view === "or";
    board.dataset.view = isOr ? "or" : "floor";
    floor.hidden = isOr;
    or.hidden = !isOr;
    document.title = isOr
      ? "GEMEL INVEST · חדר שיקוף"
      : "GEMEL INVEST · מוקד LIVE";
  }

  function renderTicker() {
    const run = $("tickerRun");
    if (!run) return;
    const unit = `<span>${TICKER_TEXT}</span>`;
    run.innerHTML = unit + unit + unit + unit;
  }

  function renderAgents() {
    const grid = $("agentGrid");
    const count = $("agentCount");
    if (!grid) return;
    grid.innerHTML = STATE.agents.map((a, idx) => {
      const st = STAGE[a.stage] || STAGE.free;
      const sub = a.stage === "free"
        ? "ממתין ללקוח הבא"
        : (a.customer ? "עם " + a.customer : st.label);
      const time = a.stage === "free" ? "—" : elapsed(a.startedAt);
      return `<article class="agent ${st.cls}" data-agent-idx="${idx}">
        <div class="agent__top">
          <span class="agent__stage"><i class="agent__dot"></i>${st.label}</span>
        </div>
        <div class="agent__mid">
          <div class="agent__ava" aria-hidden="true">${initials(a.name)}</div>
          <div>
            <div class="agent__name">${a.name}</div>
            <div class="agent__sub">${sub}</div>
          </div>
        </div>
        <div class="agent__foot">
          <span>${a.stage === "free" ? "זמין" : "בטיפול"}</span>
          <span class="agent__elapsed">${time}</span>
        </div>
      </article>`;
    }).join("");
    if (count) count.textContent = STATE.agents.length + " במשמרת";
  }

  function renderQueue(listId, countId, rows) {
    const list = $(listId);
    const count = $(countId);
    if (!list) return;
    list.innerHTML = rows.map((row, i) => {
      const heat = waitHeat(row.since);
      return `<li class="qrow ${heat}" data-wait-idx="${i}">
        <span class="qrow__n">${pad(i + 1)}</span>
        <span class="qrow__name">${row.name}</span>
        <span class="qrow__wait">${elapsed(row.since)}</span>
      </li>`;
    }).join("");
    if (count) count.textContent = String(rows.length);
  }

  function updateLiveTimes() {
    document.querySelectorAll("[data-agent-idx]").forEach((card) => {
      const a = STATE.agents[Number(card.getAttribute("data-agent-idx"))];
      if (!a) return;
      const el = card.querySelector(".agent__elapsed");
      if (el) el.textContent = a.stage === "free" ? "—" : elapsed(a.startedAt);
    });
    [
      ["mirrorList", STATE.waitingMirror],
      ["serviceList", STATE.waitingService]
    ].forEach(([id, rows]) => {
      const list = $(id);
      if (!list) return;
      list.querySelectorAll("[data-wait-idx]").forEach((row) => {
        const item = rows[Number(row.getAttribute("data-wait-idx"))];
        if (!item) return;
        row.classList.remove("is-mid", "is-hot");
        const heat = waitHeat(item.since);
        if (heat) row.classList.add(heat);
        const wait = row.querySelector(".qrow__wait");
        if (wait) wait.textContent = elapsed(item.since);
      });
    });
  }

  function tickClocks() {
    const d = new Date();
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const date = new Intl.DateTimeFormat("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(d);
    const clock = $("clockTime");
    const dateEl = $("clockDate");
    const shift = $("shiftLabel");
    if (clock) clock.textContent = time;
    if (dateEl) dateEl.textContent = date;
    if (shift) shift.textContent = shiftLabel(d);

    const liveElapsed = elapsed(STATE.liveCase.startedAt);
    const caseElapsed = $("caseElapsed");
    const orElapsed = $("orElapsed");
    const orClock = $("orClock");
    if (caseElapsed) caseElapsed.textContent = liveElapsed;
    if (orElapsed) orElapsed.textContent = liveElapsed;
    if (orClock) orClock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

    const caseAgent = $("caseAgent");
    const caseCustomer = $("caseCustomer");
    const orAgent = $("orAgent");
    const orCustomer = $("orCustomer");
    if (caseAgent) caseAgent.textContent = STATE.liveCase.agent;
    if (caseCustomer) caseCustomer.textContent = STATE.liveCase.customer;
    if (orAgent) orAgent.textContent = STATE.liveCase.agent;
    if (orCustomer) orCustomer.textContent = STATE.liveCase.customer;

    updateLiveTimes();
  }

  function goFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement) return;
    try { el.requestFullscreen && el.requestFullscreen(); } catch (_e) {}
  }

  function boot() {
    fitBoard();
    applyView(viewFromQuery());
    renderTicker();
    renderAgents();
    renderQueue("mirrorList", "mirrorCount", STATE.waitingMirror);
    renderQueue("serviceList", "serviceCount", STATE.waitingService);
    tickClocks();
    window.addEventListener("resize", fitBoard);
    setInterval(tickClocks, 1000);
    document.addEventListener("click", goFullscreen, { once: true });
    document.addEventListener("keydown", (e) => {
      if (e.key === "f" || e.key === "F" || e.key === "Enter") goFullscreen();
      if (e.key === "1") applyView("floor");
      if (e.key === "2") applyView("or");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
