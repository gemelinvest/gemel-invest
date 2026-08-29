/* GI-ASSISTANT P3 — Top bar entry + pairing gate (no QR/API yet).
   Compiled to gi-assistant.js. Do not edit the compiled file by hand. */
(() => {
  "use strict";

  const PAIRING_STORAGE_KEY = "gi_assistant_device_paired_v1";
  const ROOT_ID = "giAsstRoot";

  type AgentAuth = {
    id?: string;
    name?: string;
    role?: string;
  } | null;

  type AssistantBridge = {
    getAuth?: () => AgentAuth;
  };

  let bridge: AssistantBridge = {};
  let bound = false;

  function trim(value: unknown): string {
    return String(value == null ? "" : value).trim();
  }

  function $(id: string): HTMLElement | null {
    return document.getElementById(id);
  }

  function readBridge(): AssistantBridge {
    try {
      const fromWindow = (window as Window & { __GI_ASSISTANT_BRIDGE__?: AssistantBridge }).__GI_ASSISTANT_BRIDGE__;
      if (fromWindow && typeof fromWindow === "object") return fromWindow;
    } catch (_e) {}
    return bridge;
  }

  function getAuth(): AgentAuth {
    const active = readBridge();
    try {
      if (typeof active.getAuth === "function") return active.getAuth() || null;
    } catch (_e) {}
    try {
      if (typeof bridge.getAuth === "function") return bridge.getAuth() || null;
    } catch (_e2) {}
    return null;
  }

  function isLoggedIn(): boolean {
    const auth = getAuth();
    return !!(auth && (trim(auth.id) || trim(auth.name)));
  }

  /** P3 stub: local flag only. P4 will replace with server Device Pairing. */
  function hasActiveDevicePairing(): boolean {
    if (!isLoggedIn()) return false;
    try {
      const raw = window.localStorage.getItem(PAIRING_STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { agentId?: string; paired?: boolean };
      const auth = getAuth();
      const agentId = trim(auth?.id) || trim(auth?.name);
      if (!parsed || parsed.paired !== true) return false;
      if (agentId && trim(parsed.agentId) && trim(parsed.agentId) !== agentId) return false;
      return true;
    } catch (_e) {
      return false;
    }
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
    const closeBtn = $("giAsstClose");
    closeBtn?.addEventListener("click", () => closeOverlay());
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

  function renderActivateBody(): void {
    const body = $("giAsstBody");
    const title = $("giAsstTitle");
    if (title) title.textContent = "הפעלת העוזר האישי";
    if (!body) return;
    body.innerHTML = `
      <p class="giAsst__lead">סרוק את קוד ה-QR באמצעות הטלפון כדי לחבר את העוזר האישי לחשבון שלך.</p>
      <div class="giAsst__qrSlot" id="giAsstQrSlot" aria-live="polite">
        <div class="giAsst__qrPlaceholder">QR מאובטח יופיע כאן בחיבור הראשון</div>
      </div>
      <p class="giAsst__hint">הקוד חד־פעמי, קצר בזמן, ואינו מכיל ת״ז, סיסמה או מזהה משתמש.</p>
    `;
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

  function init(nextBridge?: AssistantBridge): void {
    if (nextBridge && typeof nextBridge === "object") bridge = nextBridge;
    ensureRoot();
    bindButton();
    syncButtonVisibility();
    if (bound) return;
    bound = true;
    window.addEventListener("gi:app-login-ready", () => {
      syncButtonVisibility();
    });
    window.addEventListener("gi:app-logout", () => {
      closeOverlay();
      syncButtonVisibility();
    });
  }

  function onLogin(): void {
    syncButtonVisibility();
  }

  function onLogout(): void {
    closeOverlay();
    syncButtonVisibility();
  }

  const api = {
    init,
    onLogin,
    onLogout,
    hasActiveDevicePairing,
    openFromTopBar
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
