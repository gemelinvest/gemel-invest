/* Generated from gi-assistant.ts — edit the TypeScript source, then:
   npx esbuild gi-assistant.ts --outfile=gi-assistant.js --format=iife --target=es2019
*/
(() => {
  (() => {
    "use strict";
    const PAIRING_STORAGE_KEY = "gi_assistant_device_paired_v1";
    const ROOT_ID = "giAsstRoot";
    let bridge = {};
    let bound = false;
    function trim(value) {
      return String(value == null ? "" : value).trim();
    }
    function $(id) {
      return document.getElementById(id);
    }
    function readBridge() {
      try {
        const fromWindow = window.__GI_ASSISTANT_BRIDGE__;
        if (fromWindow && typeof fromWindow === "object") return fromWindow;
      } catch (_e) {
      }
      return bridge;
    }
    function getAuth() {
      const active = readBridge();
      try {
        if (typeof active.getAuth === "function") return active.getAuth() || null;
      } catch (_e) {
      }
      try {
        if (typeof bridge.getAuth === "function") return bridge.getAuth() || null;
      } catch (_e2) {
      }
      return null;
    }
    function isLoggedIn() {
      const auth = getAuth();
      return !!(auth && (trim(auth.id) || trim(auth.name)));
    }
    function hasActiveDevicePairing() {
      if (!isLoggedIn()) return false;
      try {
        const raw = window.localStorage.getItem(PAIRING_STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        const auth = getAuth();
        const agentId = trim(auth == null ? void 0 : auth.id) || trim(auth == null ? void 0 : auth.name);
        if (!parsed || parsed.paired !== true) return false;
        if (agentId && trim(parsed.agentId) && trim(parsed.agentId) !== agentId) return false;
        return true;
      } catch (_e) {
        return false;
      }
    }
    function syncButtonVisibility() {
      const btn = $("btnPersonalAssistant");
      if (!btn) return;
      const show = isLoggedIn();
      btn.classList.toggle("is-hidden", !show);
      btn.setAttribute("aria-hidden", show ? "false" : "true");
      if (show) btn.removeAttribute("hidden");
      else btn.setAttribute("hidden", "hidden");
    }
    function ensureRoot() {
      var _a;
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
      const closeBtn = $("giAsstClose");
      closeBtn == null ? void 0 : closeBtn.addEventListener("click", () => closeOverlay());
      (_a = root.querySelector("[data-gi-asst-close]")) == null ? void 0 : _a.addEventListener("click", () => closeOverlay());
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape" && isOverlayOpen()) closeOverlay();
      });
      return root;
    }
    function isOverlayOpen() {
      const overlay = $("giAsstOverlay");
      return !!(overlay && !overlay.classList.contains("is-hidden"));
    }
    function closeOverlay() {
      var _a;
      const overlay = $("giAsstOverlay");
      if (!overlay) return;
      overlay.classList.add("is-hidden");
      overlay.setAttribute("hidden", "hidden");
      overlay.setAttribute("aria-hidden", "true");
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
    function renderActivateBody() {
      const body = $("giAsstBody");
      const title = $("giAsstTitle");
      if (title) title.textContent = "\u05D4\u05E4\u05E2\u05DC\u05EA \u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9";
      if (!body) return;
      body.innerHTML = `
      <p class="giAsst__lead">\u05E1\u05E8\u05D5\u05E7 \u05D0\u05EA \u05E7\u05D5\u05D3 \u05D4-QR \u05D1\u05D0\u05DE\u05E6\u05E2\u05D5\u05EA \u05D4\u05D8\u05DC\u05E4\u05D5\u05DF \u05DB\u05D3\u05D9 \u05DC\u05D7\u05D1\u05E8 \u05D0\u05EA \u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9 \u05DC\u05D7\u05E9\u05D1\u05D5\u05DF \u05E9\u05DC\u05DA.</p>
      <div class="giAsst__qrSlot" id="giAsstQrSlot" aria-live="polite">
        <div class="giAsst__qrPlaceholder">QR \u05DE\u05D0\u05D5\u05D1\u05D8\u05D7 \u05D9\u05D5\u05E4\u05D9\u05E2 \u05DB\u05D0\u05DF \u05D1\u05D7\u05D9\u05D1\u05D5\u05E8 \u05D4\u05E8\u05D0\u05E9\u05D5\u05DF</div>
      </div>
      <p class="giAsst__hint">\u05D4\u05E7\u05D5\u05D3 \u05D7\u05D3\u05BE\u05E4\u05E2\u05DE\u05D9, \u05E7\u05E6\u05E8 \u05D1\u05D6\u05DE\u05DF, \u05D5\u05D0\u05D9\u05E0\u05D5 \u05DE\u05DB\u05D9\u05DC \u05EA\u05F4\u05D6, \u05E1\u05D9\u05E1\u05DE\u05D4 \u05D0\u05D5 \u05DE\u05D6\u05D4\u05D4 \u05DE\u05E9\u05EA\u05DE\u05E9.</p>
    `;
    }
    function renderAssistantBody() {
      const body = $("giAsstBody");
      const title = $("giAsstTitle");
      if (title) title.textContent = "\u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9 \u05E9\u05DC\u05D9";
      if (!body) return;
      body.innerHTML = `
      <div class="giAsst__idle">
        <div class="giAsst__mic" aria-hidden="true">\u{1F399}\uFE0F</div>
        <p class="giAsst__lead">\u05D3\u05D1\u05E8 \u05E2\u05DD \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA</p>
        <p class="giAsst__hint">\u05D4\u05E9\u05D9\u05D7\u05D4 \u05D4\u05E7\u05D5\u05DC\u05D9\u05EA \u05EA\u05EA\u05D5\u05D5\u05E1\u05E3 \u05D1\u05E9\u05DC\u05D1 \u05D4\u05D1\u05D0. \u05D4\u05DE\u05DB\u05E9\u05D9\u05E8 \u05DB\u05D1\u05E8 \u05DE\u05E7\u05D5\u05E9\u05E8 \u05DC\u05D7\u05E9\u05D1\u05D5\u05DF.</p>
      </div>
    `;
    }
    function openFromTopBar() {
      var _a;
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
    function init(nextBridge) {
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
    function onLogin() {
      syncButtonVisibility();
    }
    function onLogout() {
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
      window.GiAssistant = api;
    } catch (_e) {
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
      init();
    }
  })();
})();
