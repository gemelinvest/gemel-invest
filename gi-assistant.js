/* GI-ASSISTANT — generated from gi-assistant.ts. Do not edit by hand. */
(() => {
  (() => {
    "use strict";
    const PAIRING_STORAGE_KEY = "gi_assistant_device_paired_v1";
    const DEVICE_STORAGE_KEY = "gi_assistant_device_v1";
    const ROOT_ID = "giAsstRoot";
    const FN_PAIRING_PATH = "/functions/v1/gi-assistant-pairing";
    const FN_REALTIME_PATH = "/functions/v1/gi-assistant-realtime";
    const OPENAI_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
    const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
    const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
    const POLL_MS = 1600;
    let bridge = {};
    let bound = false;
    let pairing = null;
    let voice = {
      state: "idle",
      sessionId: "",
      pc: null,
      dc: null,
      stream: null,
      audio: null,
      error: ""
    };
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
        const err = new Error(String(data.error || "HTTP_" + res.status));
        err.code = String(data.error || "");
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
    function pairingErrorText(code) {
      if (code === "AUTH_FAILED" || code === "MISSING_PIN") return "\u05E7\u05D5\u05D3 \u05D4\u05DB\u05E0\u05D9\u05E1\u05D4 \u05E9\u05D2\u05D5\u05D9.";
      if (code === "TOKEN_INVALID") return "\u05E7\u05D5\u05D3 \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8 \u05DC\u05D0 \u05EA\u05E7\u05E3 \u05D0\u05D5 \u05E9\u05DB\u05D1\u05E8 \u05E0\u05D5\u05E6\u05DC.";
      if (code === "AGENT_MISMATCH") return "\u05D4\u05DE\u05E9\u05EA\u05DE\u05E9 \u05E9\u05D6\u05D5\u05D4\u05D4 \u05D0\u05D9\u05E0\u05D5 \u05DE\u05D9 \u05E9\u05D4\u05EA\u05D7\u05D9\u05DC \u05D0\u05EA \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8.";
      if (code === "FAILED_TO_FETCH" || code === "TypeError") return "\u05D0\u05D9\u05DF \u05D7\u05D9\u05D1\u05D5\u05E8 \u05DC\u05E9\u05E8\u05EA \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8. \u05D4\u05E8\u05D9\u05E6\u05D5 \u05D0\u05EA supabase-assistant-pairing.sql \u05D5\u05E4\u05E8\u05E1\u05D5 \u05D0\u05EA \u05D4\u05E4\u05D5\u05E0\u05E7\u05E6\u05D9\u05D4.";
      if (code === "MISSING_OPENAI_KEY") return "\u05D7\u05E1\u05E8 \u05DE\u05E4\u05EA\u05D7 OpenAI \u05D1\u05E9\u05E8\u05EA. \u05D9\u05E9 \u05DC\u05D4\u05D2\u05D3\u05D9\u05E8 \u05D0\u05EA \u05D4\u05E1\u05D5\u05D3 \u05D1-Edge secrets.";
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
        <p class="giAsst__hint">\u05D4\u05DE\u05E4\u05EA\u05D7 \u05D4\u05E7\u05D1\u05D5\u05E2 \u05E9\u05DC OpenAI \u05E0\u05E9\u05D0\u05E8 \u05D1\u05E9\u05E8\u05EA. \u05D4\u05D3\u05E4\u05D3\u05E4\u05DF \u05DE\u05E7\u05D1\u05DC \u05E8\u05E7 \u05D8\u05D5\u05E7\u05DF \u05D6\u05DE\u05E0\u05D9.</p>
      </div>
    `;
    }
    function bindVoiceControls(root) {
      var _a, _b, _c;
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
      paintVoiceState();
    }
    function handleRealtimeEvent(raw) {
      let ev = {};
      try {
        ev = JSON.parse(raw);
      } catch (_e) {
        return;
      }
      const type = trim(ev.type);
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
      if (sessionId) {
        try {
          await callRealtime({ action: "end", sessionId });
        } catch (_e5) {
        }
      }
      if (updateUi) setVoiceState("idle");
    }
    function renderAssistantBody() {
      var _a;
      const body = $("giAsstBody");
      const title = $("giAsstTitle");
      if (title) title.textContent = "\u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05D0\u05D9\u05E9\u05D9 \u05E9\u05DC\u05D9";
      if (!body) return;
      void stopVoice();
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
      void stopVoice();
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
      void stopVoice();
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
