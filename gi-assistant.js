/* GI-ASSISTANT — generated from gi-assistant.ts. Do not edit by hand. */
(() => {
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
    const UI_COMMANDS = /* @__PURE__ */ new Set([
      "open_customer",
      "go_view",
      "open_simulator",
      "open_proposal",
      "open_wizard",
      "refresh_reminders",
      "upsert_reminder",
      "mark_task_done"
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
      error: ""
    };
    let pendingAction = null;
    let timelineItems = [];
    let lastIntent = "";
    let commandPoll = 0;
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
      if (code === "TOKEN_INVALID") return "\u05E7\u05D5\u05D3 \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8 \u05DC\u05D0 \u05EA\u05E7\u05E3 \u05D0\u05D5 \u05E9\u05DB\u05D1\u05E8 \u05E0\u05D5\u05E6\u05DC.";
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
      void stopVoice();
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
        <div class="giAsst__confirm is-hidden" id="giAsstConfirm" hidden>
          <p class="giAsst__confirmText" id="giAsstConfirmText">\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8 \u05E4\u05E2\u05D5\u05DC\u05D4.</p>
          <div class="giAsst__confirmActions">
            <button class="giAsst__btn" id="giAsstConfirmYes" type="button">\u05DB\u05DF</button>
            <button class="giAsst__btn giAsst__btn--ghost" id="giAsstConfirmNo" type="button">\u05DC\u05D0</button>
          </div>
        </div>
        <ol class="giAsst__timeline" id="giAsstTimeline" aria-live="polite"></ol>
        <div class="giAsst__hits" id="giAsstHits" hidden></div>
        <p class="giAsst__hint">\u05E4\u05E2\u05D5\u05DC\u05D5\u05EA \u05DB\u05EA\u05D9\u05D1\u05D4 \u05D3\u05D5\u05E8\u05E9\u05D5\u05EA \u05D0\u05D9\u05E9\u05D5\u05E8. \xAB\u05DB\u05DF\xBB \u05D7\u05DC \u05E8\u05E7 \u05D0\u05DD \u05D9\u05E9 \u05E4\u05E2\u05D5\u05DC\u05D4 \u05DE\u05DE\u05EA\u05D9\u05E0\u05D4.</p>
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
          if (local && trim(local.id) === trim(serverCard.id)) data.customer = local;
        } catch (_e) {
        }
        const card = sanitizeCustomerHit(data.customer);
        data.customer = card;
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
      var _a, _b, _c, _d, _e;
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
      var _a, _b, _c, _d, _e, _f, _g, _h, _i;
      if (!cmd || typeof cmd !== "object") return;
      const type = trim(cmd.type);
      const active = readBridge();
      if (type === "open_customer") (_a = active.openCustomer) == null ? void 0 : _a.call(active, trim(cmd.customerId));
      else if (type === "go_view") (_b = active.goView) == null ? void 0 : _b.call(active, trim(cmd.view));
      else if (type === "open_simulator") void ((_c = active.openSimulator) == null ? void 0 : _c.call(active, trim(cmd.company), trim(cmd.product)));
      else if (type === "quote_simulator") void ((_d = active.quoteSimulator) == null ? void 0 : _d.call(active, trim(cmd.company), trim(cmd.product), cmd.input && typeof cmd.input === "object" ? cmd.input : {}));
      else if (type === "open_wizard") void ((_e = active.openWizard) == null ? void 0 : _e.call(active, { customerId: trim(cmd.customerId), company: trim(cmd.company), product: trim(cmd.product) }));
      else if (type === "open_proposal") (_f = active.openProposal) == null ? void 0 : _f.call(active, trim(cmd.proposalId));
      else if (type === "upsert_reminder" && cmd.reminder && typeof cmd.reminder === "object") {
        void ((_g = active.upsertReminder) == null ? void 0 : _g.call(active, cmd.reminder));
      } else if (type === "mark_task_done") void ((_h = active.markTaskDone) == null ? void 0 : _h.call(active, trim(cmd.id || cmd.taskId)));
      else if (type === "refresh_reminders") void ((_i = active.refreshReminders) == null ? void 0 : _i.call(active));
    }
    async function dispatchDesktopCommand(cmd) {
      if (!isPhonePage()) return;
      if (!UI_COMMANDS.has(trim(cmd.type))) return;
      try {
        await callEngine({ ...engineAuthPayload(), action: "dispatch", command: cmd });
      } catch (_e) {
      }
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
      if (isPhonePage() || commandPoll) return;
      commandPoll = window.setInterval(() => {
        void pullDesktopCommands();
      }, POLL_MS);
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
      if (voice.state === "connecting" || voice.state === "listening" || voice.state === "speaking") return;
      setVoiceState("connecting");
      try {
        const minted = await mintVoiceToken();
        voice.sessionId = minted.sessionId;
        try {
          await callEngine({ ...engineAuthPayload(), action: "bootstrap" });
        } catch (_e) {
        }
        pushTimeline("system", "\u05E1\u05E9\u05DF \u05E2\u05D5\u05D6\u05E8 \u05E0\u05E4\u05EA\u05D7.");
        await connectWebRtc(minted.clientSecret);
        setVoiceState("listening");
      } catch (err) {
        const code = trim((err == null ? void 0 : err.code) || (err == null ? void 0 : err.name) || (err == null ? void 0 : err.message));
        await stopVoice(false);
        const mapped = pairingErrorText(code);
        const text = code === "FAILED_TO_FETCH" || code === "TypeError" ? "\u05D0\u05D9\u05DF \u05D7\u05D9\u05D1\u05D5\u05E8 \u05DC\u05E9\u05E8\u05EA \u05D4\u05E7\u05D5\u05DC. \u05D4\u05E8\u05D9\u05E6\u05D5 \u05D0\u05EA supabase-assistant-sessions.sql, \u05E4\u05E8\u05E1\u05D5 \u05D0\u05EA gi-assistant-realtime, \u05D5\u05D4\u05D2\u05D3\u05D9\u05E8\u05D5 \u05D0\u05EA \u05E1\u05D5\u05D3 OpenAI \u05D1\u05E9\u05E8\u05EA." : mapped === "\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9 \u05DC\u05D4\u05E9\u05DC\u05D9\u05DD \u05D0\u05EA \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8. \u05E0\u05E1\u05D5 \u05E9\u05D5\u05D1." ? "\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9 \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC \u05D0\u05EA \u05D4\u05E9\u05D9\u05D7\u05D4. \u05E0\u05E1\u05D5 \u05E9\u05D5\u05D1." : mapped;
        setVoiceState("error", text);
      }
    }
    async function stopVoice(updateUi = true) {
      var _a, _b, _c, _d;
      const sessionId = trim(voice.sessionId);
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
      if (sessionId) {
        try {
          await callRealtime({ action: "end", sessionId });
        } catch (_e5) {
        }
      }
      if (updateUi) {
        setVoiceState("idle");
        paintConfirm();
      }
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
          if (trim(data.devicePublicId) && trim(data.deviceSecret)) {
            writeDevice({
              devicePublicId: trim(data.devicePublicId),
              deviceSecret: trim(data.deviceSecret),
              agentId: trim(data.agentId) || trim(auth == null ? void 0 : auth.id)
            });
          }
          writeLocalPairing(trim(auth == null ? void 0 : auth.id) || trim(data.agentId) || trim(auth == null ? void 0 : auth.name));
          startCommandBus();
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
      startVoice,
      stopVoice,
      getVoiceState() {
        return voice.state;
      },
      proposeWrite,
      confirmPending,
      cancelPending,
      classifyIntent,
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
})();
