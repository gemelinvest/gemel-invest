/* GI-ASSISTANT — top bar, pairing, and OpenAI Realtime voice (P3–P6).
   Compiled to gi-assistant.js. Do not edit the compiled file by hand. */
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

  type VoiceState = "idle" | "connecting" | "listening" | "speaking" | "error";

  type VoiceRuntime = {
    state: VoiceState;
    sessionId: string;
    pc: RTCPeerConnection | null;
    dc: RTCDataChannel | null;
    stream: MediaStream | null;
    audio: HTMLAudioElement | null;
    error: string;
  };

  let bridge: AssistantBridge = {};
  let bound = false;
  let pairing: PairingSession | null = null;
  let voice: VoiceRuntime = {
    state: "idle",
    sessionId: "",
    pc: null,
    dc: null,
    stream: null,
    audio: null,
    error: ""
  };

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

  async function callEdge(fnPath: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
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
    let data: Record<string, unknown> = {};
    try { data = await res.json() as Record<string, unknown>; } catch (_e) { data = {}; }
    if (!res.ok || data.ok === false) {
      const err = new Error(String(data.error || ("HTTP_" + res.status)));
      (err as Error & { code?: string }).code = String(data.error || "");
      throw err;
    }
    return data;
  }

  function callPairing(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return callEdge(FN_PAIRING_PATH, payload);
  }

  function callRealtime(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return callEdge(FN_REALTIME_PATH, payload);
  }

  function pairingErrorText(code: string): string {
    if (code === "AUTH_FAILED" || code === "MISSING_PIN") return "קוד הכניסה שגוי.";
    if (code === "TOKEN_INVALID") return "קוד הקישור לא תקף או שכבר נוצל.";
    if (code === "AGENT_MISMATCH") return "המשתמש שזוהה אינו מי שהתחיל את הקישור.";
    if (code === "FAILED_TO_FETCH" || code === "TypeError") return "אין חיבור לשרת הקישור. הריצו את supabase-assistant-pairing.sql ופרסו את הפונקציה.";
    if (code === "MISSING_OPENAI_KEY") return "חסר מפתח OpenAI בשרת. יש להגדיר את הסוד ב-Edge secrets.";
    if (code === "OPENAI_ERROR") return "שרת הקול לא זמין כרגע. נסו שוב בעוד רגע.";
    if (code === "MIC_DENIED" || code === "NotAllowedError") return "נדרשת הרשאת מיקרופון כדי לדבר עם העוזר.";
    if (code === "MIC_MISSING" || code === "NotFoundError") return "לא נמצא מיקרופון במכשיר.";
    return "לא הצלחתי להשלים את הקישור. נסו שוב.";
  }

  function voiceStateLabel(state: VoiceState): string {
    if (state === "connecting") return "מתחבר…";
    if (state === "listening") return "מקשיב";
    if (state === "speaking") return "העוזר מדבר";
    if (state === "error") return voice.error || "לא הצלחתי להתחבר לקול.";
    return "דבר עם המערכת";
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
    void stopVoice();
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

  function paintVoiceState(): void {
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
    const startBtn = root.querySelector("#giAsstVoiceStart") as HTMLButtonElement | null;
    const stopBtn = root.querySelector("#giAsstVoiceStop") as HTMLButtonElement | null;
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

  function setVoiceState(next: VoiceState, errorText?: string): void {
    voice.state = next;
    voice.error = next === "error" ? (errorText || voice.error || "") : "";
    paintVoiceState();
  }

  function voiceMarkup(includePin: boolean): string {
    return `
      <div class="giAsst__voice is-idle" data-gi-asst-voice="idle">
        <button class="giAsst__micBtn" id="giAsstMicBtn" type="button" aria-label="התחל שיחה">🎙️</button>
        <p class="giAsst__lead giAsst__voiceStatus" id="giAsstVoiceStatus">דבר עם המערכת</p>
        ${includePin ? `
          <label class="giAsst__label" for="giAsstVoicePin">קוד הכניסה לחשבון</label>
          <input class="giAsst__input" id="giAsstVoicePin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" />
        ` : ""}
        <div class="giAsst__voiceActions">
          <button class="giAsst__btn" id="giAsstVoiceStart" type="button">התחל שיחה</button>
          <button class="giAsst__btn giAsst__btn--ghost" id="giAsstVoiceStop" type="button" hidden>סיים שיחה</button>
        </div>
        <p class="giAsst__hint">המפתח הקבוע של OpenAI נשאר בשרת. הדפדפן מקבל רק טוקן זמני.</p>
      </div>
    `;
  }

  function bindVoiceControls(root: ParentNode): void {
    root.querySelector("#giAsstVoiceStart")?.addEventListener("click", () => { void startVoice(); });
    root.querySelector("#giAsstVoiceStop")?.addEventListener("click", () => { void stopVoice(); });
    root.querySelector("#giAsstMicBtn")?.addEventListener("click", () => {
      if (voice.state === "idle" || voice.state === "error") void startVoice();
      else void stopVoice();
    });
    paintVoiceState();
  }

  function handleRealtimeEvent(raw: string): void {
    let ev: { type?: string } = {};
    try { ev = JSON.parse(raw) as { type?: string }; } catch (_e) { return; }
    const type = trim(ev.type);
    if (type === "session.created" || type === "input_audio_buffer.speech_stopped" || type === "response.done") {
      if (voice.state !== "idle") setVoiceState("listening");
      return;
    }
    if (type === "input_audio_buffer.speech_started") {
      setVoiceState("listening");
      return;
    }
    if (
      type === "response.created" ||
      type === "response.output_audio.delta" ||
      type === "response.audio.delta" ||
      type === "output_audio_buffer.started"
    ) {
      setVoiceState("speaking");
      return;
    }
    if (type === "error") {
      setVoiceState("error", "השיחה נקטעה. נסו שוב.");
    }
  }

  async function mintVoiceToken(): Promise<{ clientSecret: string; sessionId: string }> {
    const device = readDevice();
    const auth = getAuth();
    const payload: Record<string, unknown> = {
      action: "token",
      source: device && trim(device.deviceSecret) ? "phone" : "desktop"
    };
    if (device && trim(device.devicePublicId) && trim(device.deviceSecret)) {
      payload.devicePublicId = trim(device.devicePublicId);
      payload.deviceSecret = trim(device.deviceSecret);
    } else {
      payload.agentId = trim(auth?.id);
      payload.agentName = trim(auth?.name);
      payload.username = trim(auth?.username);
      payload.pin = trim(($("giAsstVoicePin") as HTMLInputElement | null)?.value);
      if (!trim(payload.pin)) throw Object.assign(new Error("MISSING_PIN"), { code: "MISSING_PIN" });
    }
    const data = await callRealtime(payload);
    const clientSecret = trim(data.clientSecret);
    if (!clientSecret || clientSecret.indexOf("sk-") === 0) throw new Error("OPENAI_ERROR");
    return { clientSecret, sessionId: trim(data.sessionId) };
  }

  async function connectWebRtc(clientSecret: string): Promise<void> {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    voice.pc = pc;
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "true");
    voice.audio = audio;
    pc.ontrack = (ev) => {
      audio.srcObject = ev.streams[0];
      void audio.play().catch(() => {});
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

  async function startVoice(): Promise<void> {
    if (voice.state === "connecting" || voice.state === "listening" || voice.state === "speaking") return;
    setVoiceState("connecting");
    try {
      const minted = await mintVoiceToken();
      voice.sessionId = minted.sessionId;
      await connectWebRtc(minted.clientSecret);
      setVoiceState("listening");
    } catch (err) {
      const code = trim((err as Error & { code?: string; name?: string })?.code
        || (err as Error & { name?: string })?.name
        || (err as Error)?.message);
      await stopVoice(false);
      const mapped = pairingErrorText(code);
      const text = (code === "FAILED_TO_FETCH" || code === "TypeError")
        ? "אין חיבור לשרת הקול. הריצו את supabase-assistant-sessions.sql, פרסו את gi-assistant-realtime, והגדירו את סוד OpenAI בשרת."
        : (mapped === "לא הצלחתי להשלים את הקישור. נסו שוב." ? "לא הצלחתי להתחיל את השיחה. נסו שוב." : mapped);
      setVoiceState("error", text);
    }
  }

  async function stopVoice(updateUi = true): Promise<void> {
    const sessionId = trim(voice.sessionId);
    try { voice.dc?.close(); } catch (_e) {}
    try { voice.pc?.getSenders().forEach((sender) => sender.track?.stop()); } catch (_e2) {}
    try { voice.pc?.close(); } catch (_e3) {}
    try { voice.stream?.getTracks().forEach((track) => track.stop()); } catch (_e4) {}
    voice.dc = null;
    voice.pc = null;
    voice.stream = null;
    voice.audio = null;
    voice.sessionId = "";
    if (sessionId) {
      try { await callRealtime({ action: "end", sessionId }); } catch (_e5) {}
    }
    if (updateUi) setVoiceState("idle");
  }

  function renderAssistantBody(): void {
    const body = $("giAsstBody");
    const title = $("giAsstTitle");
    if (title) title.textContent = "העוזר האישי שלי";
    if (!body) return;
    void stopVoice();
    const needPin = !(readDevice() && trim(readDevice()?.deviceSecret));
    body.innerHTML = voiceMarkup(needPin);
    bindVoiceControls(body);
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
    void stopVoice();
    root.innerHTML = `
      <header class="giAsstPhone__head">
        <div class="giAsstPhone__kicker">GEMEL INVEST</div>
        <h1 class="giAsstPhone__title">העוזר האישי שלי</h1>
      </header>
      ${voiceMarkup(false)}
    `;
    bindVoiceControls(root);
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
    getVoiceState(){ return voice.state; }
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
