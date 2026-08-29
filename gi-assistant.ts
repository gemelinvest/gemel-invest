/* GI-ASSISTANT — top bar + secure QR pairing (P3–P4).
   Compiled to gi-assistant.js. Do not edit the compiled file by hand. */
(() => {
  "use strict";

  const PAIRING_STORAGE_KEY = "gi_assistant_device_paired_v1";
  const DEVICE_STORAGE_KEY = "gi_assistant_device_v1";
  const ROOT_ID = "giAsstRoot";
  const FN_PATH = "/functions/v1/gi-assistant-pairing";
  const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
  const POLL_MS = 1600;

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
  };

  type PairingSession = {
    desktopSecret: string;
    publicToken: string;
    expiresAt: string;
    pollTimer: number;
  };

  let bridge: AssistantBridge = {};
  let bound = false;
  let pairing: PairingSession | null = null;

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

  async function callPairing(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const cfg = supabaseConfig();
    const res = await fetch(cfg.url.replace(/\/+$/, "") + FN_PATH, {
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
      const err = new Error(String(data.error || ("HTTP_" + res.status)));
      (err as Error & { code?: string }).code = String(data.error || "");
      throw err;
    }
    return data;
  }

  function pairingErrorText(code: string): string {
    if (code === "AUTH_FAILED" || code === "MISSING_PIN") return "קוד הכניסה שגוי.";
    if (code === "TOKEN_INVALID") return "קוד הקישור לא תקף או שכבר נוצל.";
    if (code === "AGENT_MISMATCH") return "המשתמש שזוהה אינו מי שהתחיל את הקישור.";
    if (code === "FAILED_TO_FETCH" || code === "TypeError") return "אין חיבור לשרת הקישור. הריצו את supabase-assistant-pairing.sql ופרסו את הפונקציה.";
    return "לא הצלחתי להשלים את הקישור. נסו שוב.";
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

  function renderAssistantBody(): void {
    const body = $("giAsstBody");
    const title = $("giAsstTitle");
    if (title) title.textContent = "העוזר האישי שלי";
    if (!body) return;
    body.innerHTML = `
      <div class="giAsst__idle">
        <div class="giAsst__mic" aria-hidden="true">🎙️</div>
        <p class="giAsst__lead">דבר עם המערכת</p>
        <p class="giAsst__hint">השיחה הקולית תתווסף בשלב הבא. המכשיר כבר מקושר לחשבון.</p>
      </div>
    `;
  }

  function remainLabel(expiresAt: string): string {
    const ms = Date.parse(expiresAt) - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return "פג תוקף";
    const sec = Math.ceil(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, "0");
    return "הקוד תקף עוד " + m + ":" + s;
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
      <p class="giAsst__hint">הקוד חד־פעמי, קצר בזמן, ואינו מכיל ת״ז, סיסמה או מזהה משתמש.</p>
    `;
    const slot = $("giAsstQrSlot");
    if (slot) paintQr(slot, href);
  }

  function renderActivateBody(): void {
    const body = $("giAsstBody");
    const title = $("giAsstTitle");
    if (title) title.textContent = "הפעלת העוזר האישי";
    if (!body) return;
    body.innerHTML = `
      <p class="giAsst__lead">סרוק את קוד ה-QR באמצעות הטלפון כדי לחבר את העוזר האישי לחשבון שלך.</p>
      <form class="giAsst__form" id="giAsstPinForm">
        <label class="giAsst__label" for="giAsstPin">קוד הכניסה לחשבון</label>
        <input class="giAsst__input" id="giAsstPin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" />
        <button class="giAsst__btn" id="giAsstPinBtn" type="submit">הצג QR מאובטח</button>
      </form>
      <div class="giAsst__error" id="giAsstError" role="alert"></div>
      <p class="giAsst__hint">הקוד החד־פעמי נוצר בשרת רק אחרי אימות. הוא אינו מכיל ת״ז, סיסמה או מזהה משתמש.</p>
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
        writeLocalPairing(trim(auth?.id) || trim(auth?.name));
        stopPairingPoll();
        pairing = null;
        renderAssistantBody();
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
        pin
      });
      if (data.alreadyPaired === true) {
        writeLocalPairing(trim(auth?.id) || trim(data.agentId) || trim(auth?.name));
        renderAssistantBody();
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
    root.innerHTML = `
      <header class="giAsstPhone__head">
        <div class="giAsstPhone__kicker">GEMEL INVEST</div>
        <h1 class="giAsstPhone__title">העוזר האישי שלי</h1>
      </header>
      <div class="giAsst__idle">
        <div class="giAsst__mic" aria-hidden="true">🎙️</div>
        <p class="giAsst__lead">דבר עם המערכת</p>
        <p class="giAsst__hint">המכשיר מקושר. השיחה הקולית תתווסף בשלב הבא.</p>
      </div>
    `;
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
        renderPhoneAssistant();
      } catch (err) {
        const code = trim((err as Error & { code?: string })?.code || (err as Error)?.message);
        setPhoneStatus(pairingErrorText(code), "err");
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  function bootPhone(): void {
    document.body.classList.add("giAsstPhonePage");
    if (hasActiveDevicePairing() && !trim(new URLSearchParams(window.location.search).get("p"))) {
      renderPhoneAssistant();
      return;
    }
    const publicToken = trim(new URLSearchParams(window.location.search).get("p"));
    if (!publicToken) {
      if (hasActiveDevicePairing()) {
        renderPhoneAssistant();
        return;
      }
      const root = $("giAsstPhone");
      if (root) {
        root.innerHTML = `
          <header class="giAsstPhone__head">
            <div class="giAsstPhone__kicker">GEMEL INVEST</div>
            <h1 class="giAsstPhone__title">העוזר האישי שלי</h1>
          </header>
          <p class="giAsst__lead">יש לסרוק את קוד ה-QR ממסך המחשב כדי לקשר את המכשיר בפעם הראשונה.</p>
        `;
      }
      return;
    }
    if (hasActiveDevicePairing()) {
      renderPhoneAssistant();
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
    });
    window.addEventListener("gi:app-logout", () => {
      void cancelPairing();
      closeOverlay();
      syncButtonVisibility();
    });
  }

  function onLogin(): void {
    syncButtonVisibility();
  }

  function onLogout(): void {
    void cancelPairing();
    closeOverlay();
    syncButtonVisibility();
  }

  const api = {
    init,
    onLogin,
    onLogout,
    hasActiveDevicePairing,
    openFromTopBar,
    phoneEntryUrl
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
