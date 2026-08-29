/* GI-ASSISTANT — generated from gi-assistant.ts. Do not edit by hand. */
(() => {
  (() => {
    "use strict";
    const PAIRING_STORAGE_KEY = "gi_assistant_device_paired_v1";
    const DEVICE_STORAGE_KEY = "gi_assistant_device_v1";
    const ROOT_ID = "giAsstRoot";
    const FN_PATH = "/functions/v1/gi-assistant-pairing";
    const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
    const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
    const POLL_MS = 1600;
    let bridge = {};
    let bound = false;
    let pairing = null;
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
    async function callPairing(payload) {
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
      let data = {};
      try {
        data = await res.json();
      } catch (_e) {
        data = {};
      }
      if (!res.ok || data.ok === false) {
        const err = new Error(String(data.error || "HTTP_" + res.status));
        err.code = String(data.error || "");
        throw err;
      }
      return data;
    }
    function pairingErrorText(code) {
      if (code === "AUTH_FAILED" || code === "MISSING_PIN") return "\u05E7\u05D5\u05D3 \u05D4\u05DB\u05E0\u05D9\u05E1\u05D4 \u05E9\u05D2\u05D5\u05D9.";
      if (code === "TOKEN_INVALID") return "\u05E7\u05D5\u05D3 \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8 \u05DC\u05D0 \u05EA\u05E7\u05E3 \u05D0\u05D5 \u05E9\u05DB\u05D1\u05E8 \u05E0\u05D5\u05E6\u05DC.";
      if (code === "AGENT_MISMATCH") return "\u05D4\u05DE\u05E9\u05EA\u05DE\u05E9 \u05E9\u05D6\u05D5\u05D4\u05D4 \u05D0\u05D9\u05E0\u05D5 \u05DE\u05D9 \u05E9\u05D4\u05EA\u05D7\u05D9\u05DC \u05D0\u05EA \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8.";
      if (code === "FAILED_TO_FETCH" || code === "TypeError") return "\u05D0\u05D9\u05DF \u05D7\u05D9\u05D1\u05D5\u05E8 \u05DC\u05E9\u05E8\u05EA \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8. \u05D4\u05E8\u05D9\u05E6\u05D5 \u05D0\u05EA supabase-assistant-pairing.sql \u05D5\u05E4\u05E8\u05E1\u05D5 \u05D0\u05EA \u05D4\u05E4\u05D5\u05E0\u05E7\u05E6\u05D9\u05D4.";
      return "\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9 \u05DC\u05D4\u05E9\u05DC\u05D9\u05DD \u05D0\u05EA \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8. \u05E0\u05E1\u05D5 \u05E9\u05D5\u05D1.";
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
      const show = isLoggedIn();
      btn.classList.toggle("is-hidden", !show);
      btn.setAttribute("aria-hidden", show ? "false" : "true");
      if (show) btn.removeAttribute("hidden");
      else btn.setAttribute("hidden", "hidden");
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
      });
      return root;
    }
    function isOverlayOpen() {
      const overlay = $("giAsstOverlay");
      return !!(overlay && !overlay.classList.contains("is-hidden"));
    }
    function closeOverlay() {
      var _a;
      void cancelPairing();
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
    function setActivateError(msg) {
      const box = $("giAsstError");
      if (box) box.textContent = msg || "";
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
    function remainLabel(expiresAt) {
      const ms = Date.parse(expiresAt) - Date.now();
      if (!Number.isFinite(ms) || ms <= 0) return "\u05E4\u05D2 \u05EA\u05D5\u05E7\u05E3";
      const sec = Math.ceil(ms / 1e3);
      const m = Math.floor(sec / 60);
      const s = String(sec % 60).padStart(2, "0");
      return "\u05D4\u05E7\u05D5\u05D3 \u05EA\u05E7\u05E3 \u05E2\u05D5\u05D3 " + m + ":" + s;
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
      <p class="giAsst__hint">\u05D4\u05E7\u05D5\u05D3 \u05D7\u05D3\u05BE\u05E4\u05E2\u05DE\u05D9, \u05E7\u05E6\u05E8 \u05D1\u05D6\u05DE\u05DF, \u05D5\u05D0\u05D9\u05E0\u05D5 \u05DE\u05DB\u05D9\u05DC \u05EA\u05F4\u05D6, \u05E1\u05D9\u05E1\u05DE\u05D4 \u05D0\u05D5 \u05DE\u05D6\u05D4\u05D4 \u05DE\u05E9\u05EA\u05DE\u05E9.</p>
    `;
      const slot = $("giAsstQrSlot");
      if (slot) paintQr(slot, href);
    }
    function renderActivateBody() {
      const body = $("giAsstBody");
      const title = $("giAsstTitle");
      if (title) title.textContent = "\u05D4\u05E4\u05E2\u05DC\u05EA \u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9";
      if (!body) return;
      body.innerHTML = `
      <p class="giAsst__lead">\u05E1\u05E8\u05D5\u05E7 \u05D0\u05EA \u05E7\u05D5\u05D3 \u05D4-QR \u05D1\u05D0\u05DE\u05E6\u05E2\u05D5\u05EA \u05D4\u05D8\u05DC\u05E4\u05D5\u05DF \u05DB\u05D3\u05D9 \u05DC\u05D7\u05D1\u05E8 \u05D0\u05EA \u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9 \u05DC\u05D7\u05E9\u05D1\u05D5\u05DF \u05E9\u05DC\u05DA.</p>
      <form class="giAsst__form" id="giAsstPinForm">
        <label class="giAsst__label" for="giAsstPin">\u05E7\u05D5\u05D3 \u05D4\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DC\u05D7\u05E9\u05D1\u05D5\u05DF</label>
        <input class="giAsst__input" id="giAsstPin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" />
        <button class="giAsst__btn" id="giAsstPinBtn" type="submit">\u05D4\u05E6\u05D2 QR \u05DE\u05D0\u05D5\u05D1\u05D8\u05D7</button>
      </form>
      <div class="giAsst__error" id="giAsstError" role="alert"></div>
      <p class="giAsst__hint">\u05D4\u05E7\u05D5\u05D3 \u05D4\u05D7\u05D3\u05BE\u05E4\u05E2\u05DE\u05D9 \u05E0\u05D5\u05E6\u05E8 \u05D1\u05E9\u05E8\u05EA \u05E8\u05E7 \u05D0\u05D7\u05E8\u05D9 \u05D0\u05D9\u05DE\u05D5\u05EA. \u05D4\u05D5\u05D0 \u05D0\u05D9\u05E0\u05D5 \u05DE\u05DB\u05D9\u05DC \u05EA\u05F4\u05D6, \u05E1\u05D9\u05E1\u05DE\u05D4 \u05D0\u05D5 \u05DE\u05D6\u05D4\u05D4 \u05DE\u05E9\u05EA\u05DE\u05E9.</p>
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
          writeLocalPairing(trim(auth == null ? void 0 : auth.id) || trim(auth == null ? void 0 : auth.name));
          stopPairingPoll();
          pairing = null;
          renderAssistantBody();
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
          pin
        });
        if (data.alreadyPaired === true) {
          writeLocalPairing(trim(auth == null ? void 0 : auth.id) || trim(data.agentId) || trim(auth == null ? void 0 : auth.name));
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
    function setPhoneStatus(text, tone) {
      const el = $("giAsstPhoneStatus");
      if (!el) return;
      el.textContent = text || "";
      el.className = "giAsstPhone__status" + (tone ? " is-" + tone : "");
    }
    function renderPhoneAssistant() {
      const root = $("giAsstPhone");
      if (!root) return;
      root.innerHTML = `
      <header class="giAsstPhone__head">
        <div class="giAsstPhone__kicker">GEMEL INVEST</div>
        <h1 class="giAsstPhone__title">\u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9 \u05E9\u05DC\u05D9</h1>
      </header>
      <div class="giAsst__idle">
        <div class="giAsst__mic" aria-hidden="true">\u{1F399}\uFE0F</div>
        <p class="giAsst__lead">\u05D3\u05D1\u05E8 \u05E2\u05DD \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA</p>
        <p class="giAsst__hint">\u05D4\u05DE\u05DB\u05E9\u05D9\u05E8 \u05DE\u05E7\u05D5\u05E9\u05E8. \u05D4\u05E9\u05D9\u05D7\u05D4 \u05D4\u05E7\u05D5\u05DC\u05D9\u05EA \u05EA\u05EA\u05D5\u05D5\u05E1\u05E3 \u05D1\u05E9\u05DC\u05D1 \u05D4\u05D1\u05D0.</p>
      </div>
    `;
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
          renderPhoneAssistant();
        } catch (err) {
          const code = trim((err == null ? void 0 : err.code) || (err == null ? void 0 : err.message));
          setPhoneStatus(pairingErrorText(code), "err");
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }
    function bootPhone() {
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
            <h1 class="giAsstPhone__title">\u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9 \u05E9\u05DC\u05D9</h1>
          </header>
          <p class="giAsst__lead">\u05D9\u05E9 \u05DC\u05E1\u05E8\u05D5\u05E7 \u05D0\u05EA \u05E7\u05D5\u05D3 \u05D4-QR \u05DE\u05DE\u05E1\u05DA \u05D4\u05DE\u05D7\u05E9\u05D1 \u05DB\u05D3\u05D9 \u05DC\u05E7\u05E9\u05E8 \u05D0\u05EA \u05D4\u05DE\u05DB\u05E9\u05D9\u05E8 \u05D1\u05E4\u05E2\u05DD \u05D4\u05E8\u05D0\u05E9\u05D5\u05E0\u05D4.</p>
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
      });
      window.addEventListener("gi:app-logout", () => {
        void cancelPairing();
        closeOverlay();
        syncButtonVisibility();
      });
    }
    function onLogin() {
      syncButtonVisibility();
    }
    function onLogout() {
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
