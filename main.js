const path = require("path");
const { app, BrowserWindow, shell, session, screen } = require("electron");

const APP_NAME = "GEMEL INVEST CRM";
const START_URL = "https://gemelinvest.github.io/gemel-invest/";

const LOGIN_LOCK_CLASS = "lcAuthLock";
const LOGIN_CHECK_INTERVAL_MS = 380;
const LOGIN_SIZE_INTERVAL_MS = 450;
const LOGIN_DEFAULT_WIDTH = 430;
const LOGIN_DEFAULT_HEIGHT = 650;
const LOGIN_MIN_HEIGHT = 430;
const LOGIN_MAX_HEIGHT = 980;
const LOGIN_TITLEBAR_HEIGHT = 38;
const LOGIN_BOTTOM_TRIM_PX = 6;
const LOGIN_CENTER_OFFSET_X = 0;
const SHARED_PARTITION = "persist:gemel-invest-crm";

const APP_WINDOW = {
  width: 1400,
  height: 900,
  minWidth: 1100,
  minHeight: 720
};

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("media-cache-size", "0");
app.commandLine.appendSwitch("disk-cache-size", "1");
app.commandLine.appendSwitch("disable-http-cache");

const ELECTRON_LOGIN_CSS = `
html, body{
  overflow:hidden !important;
  margin:0 !important;
  padding:0 !important;
  height:100% !important;
}

body.lcAuthLock{
  overflow:hidden !important;
  background:#f5f6f8 !important;
  min-height:unset !important;
  height:100% !important;
}

body.lcAuthLock .lcLogin{
  position:fixed !important;
  inset:0 !important;
  padding:${LOGIN_TITLEBAR_HEIGHT}px 0 20px 0 !important;
  margin:0 !important;
  width:100% !important;
  min-width:0 !important;
  max-width:100% !important;
  min-height:unset !important;
  height:100% !important;
  display:flex !important;
  align-items:flex-start !important;
  justify-content:center !important;
  background:transparent !important;
  overflow:hidden !important;
  box-sizing:border-box !important;
}

body.lcAuthLock .lcLogin__card{
  width:100% !important;
  min-width:0 !important;
  max-width:100% !important;
  margin:18px auto 0 auto !important;
  border-radius:0 !important;
  box-sizing:border-box !important;
  min-height:unset !important;
  height:auto !important;
}

body.lcAuthLock .lcLogin--mfa .lcLogin__card{
  width:100% !important;
  min-width:0 !important;
  max-width:100% !important;
  margin:18px auto 0 auto !important;
  border-radius:0 !important;
  min-height:unset !important;
  height:auto !important;
}

body.lcAuthLock .lcLogin__form,
body.lcAuthLock .lcLogin__mfaStage{
  width:100% !important;
  max-width:none !important;
}

body.lcAuthLock #lcLoginMfaStep{
  padding-inline:0 !important;
}

.gi-electron-titlebar{
  position:fixed;
  top:2px;
  left:2px;
  right:2px;
  width:auto;
  min-width:unset;
  height:24px;
  display:flex;
  flex-direction:row;
  align-items:center;
  justify-content:flex-start;
  gap:6px;
  padding:0;
  box-sizing:border-box;
  background:transparent;
  border:0;
  border-radius:0;
  box-shadow:none;
  backdrop-filter:none;
  -webkit-backdrop-filter:none;
  z-index:2147483647;
  user-select:none;
  pointer-events:auto;
  -webkit-app-region:drag;
}

.gi-electron-titlebar__title{
  display:none;
}

.gi-electron-titlebar--app .gi-electron-titlebar__title{
  display:none;
}

.gi-electron-titlebar__actions{
  position:relative;
  z-index:2;
  display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:6px;
  -webkit-app-region:no-drag;
  pointer-events:auto;
  flex:0 0 auto;
  direction:ltr;
  margin-left:0;
  margin-right:0;
}

.gi-electron-titlebar__drag{
  position:relative;
  z-index:1;
  flex:1 1 auto;
  width:auto;
  min-width:80px;
  height:20px;
  background:transparent;
  -webkit-app-region:drag;
  pointer-events:auto;
  cursor:grab;
  border-radius:999px;
}

.gi-electron-titlebar__btn{
  width:20px;
  height:20px;
  border:0;
  border-radius:0;
  background:transparent;
  box-shadow:none;
  color:#425a82;
  display:grid;
  place-items:center;
  cursor:pointer;
  padding:0;
  transition:transform .14s ease, color .14s ease, opacity .14s ease;
}

.gi-electron-titlebar__btn:hover{
  opacity:1;
  transform:translateY(-1px);
  color:#244a86;
}

.gi-electron-titlebar__btn:active{
  transform:translateY(0);
}

.gi-electron-titlebar__btn--close:hover{
  color:#b42318;
}

.gi-electron-titlebar__btn svg{
  width:11px;
  height:11px;
  display:block;
}

.gi-electron-titlebar__btn--fullscreen{
  display:none;
}

.gi-electron-titlebar--app .gi-electron-titlebar__btn--fullscreen{
  display:grid;
}

.gi-electron-titlebar__btn--fullscreen.is-fullscreen{
  color:#244a86;
}
`;

const ALLOWED_HOSTS = [
  "gemelinvest.github.io",
  "script.google.com",
  "accounts.google.com"
];

let loginWindow = null;
let loginCheckTimer = null;
let loginSizeTimer = null;
let lastLoginBoundsKey = "";
let loginReadyTicks = 0;
let appWindowRef = null;
let appLogoutTimer = null;


function clamp(value, min, max){
  return Math.max(min, Math.min(max, value));
}

function stopLoginTimers(){
  if(loginCheckTimer){
    clearInterval(loginCheckTimer);
    loginCheckTimer = null;
  }
  if(loginSizeTimer){
    clearInterval(loginSizeTimer);
    loginSizeTimer = null;
  }
}

function stopAppLogoutWatcher(){
  if(appLogoutTimer){
    clearInterval(appLogoutTimer);
    appLogoutTimer = null;
  }
}

function tryHandleElectronCommand(url, win){
  try{
    const parsed = new URL(url);
    if(parsed.protocol !== "electron:") return false;
    const command = parsed.hostname || parsed.pathname.replace(/^\/+/, "");
    if(command === "minimize"){
      win?.minimize?.();
      return true;
    }
    if(command === "maximize"){
      if(win?.isMaximized?.()) win?.unmaximize?.();
      else win?.maximize?.();
      return true;
    }
    if(command === "fullscreen"){
      const isFull = !!win?.isFullScreen?.();
      win?.setFullScreen?.(!isFull);
      setTimeout(() => { syncFullscreenButton(win); }, 60);
      return true;
    }
    if(command === "close"){
      win?.close?.();
      return true;
    }
  }catch(_){}
  return false;
}

async function syncFullscreenButton(win){
  if(!win || win.isDestroyed()) return;
  const isFull = !!win.isFullScreen();
  const label = isFull ? "צא ממסך מלא" : "מסך מלא";
  const icon = isFull
    ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5H3.5V6M10 3.5h2.5V6M6 12.5H3.5V10M10 12.5h2.5V10"></path></svg>`
    : `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2.5H2.5V5M11 2.5h2.5V5M5 13.5H2.5V11M11 13.5h2.5V11"></path></svg>`;
  try{
    const script = `(() => {
      const btn = document.querySelector('#giElectronTitlebar .gi-electron-titlebar__btn--fullscreen');
      if(!btn) return;
      btn.classList.toggle('is-fullscreen', ${JSON.stringify(isFull)});
      btn.setAttribute('aria-label', ${JSON.stringify(label)});
      btn.setAttribute('title', ${JSON.stringify(label)});
      btn.innerHTML = ${JSON.stringify(icon)};
    })();`;
    await win.webContents.executeJavaScript(script, true);
  }catch(_){ }
}

function openExternalIfNeeded(url){
  try{
    const u = new URL(url);
    if(u.protocol !== "http:" && u.protocol !== "https:") return false;
    if(!ALLOWED_HOSTS.includes(u.hostname)){
      shell.openExternal(url);
      return true;
    }
  }catch(_){}
  return false;
}

async function exportAuthStateFromWindow(win){
  if(!win || win.isDestroyed()) return null;
  try{
    return await win.webContents.executeJavaScript(`
      (() => {
        const readStorage = (storage) => {
          const data = {};
          try{
            for(let i = 0; i < storage.length; i += 1){
              const key = storage.key(i);
              if(key == null) continue;
              data[key] = storage.getItem(key);
            }
          }catch(_){ }
          return data;
        };

        return {
          href: location.href,
          localStorage: readStorage(window.localStorage),
          sessionStorage: readStorage(window.sessionStorage)
        };
      })();
    `, true);
  }catch(_){
    return null;
  }
}

async function hydrateAuthStateIntoWindow(win, authState){
  if(!win || win.isDestroyed() || !authState) return;

  const payload = JSON.stringify(authState).replace(/</g, '\u003c');
  try{
    await win.webContents.executeJavaScript(`
      (() => {
        const authState = ${payload};
        const applyStorage = (storage, values) => {
          if(!values || typeof values !== 'object') return;
          Object.entries(values).forEach(([key, value]) => {
            try{
              storage.setItem(key, value ?? '');
            }catch(_){ }
          });
        };

        applyStorage(window.localStorage, authState.localStorage);
        applyStorage(window.sessionStorage, authState.sessionStorage);
      })();
    `, true);
  }catch(_){ }
}

function attachNavigationHandlers(win){
  win.webContents.setWindowOpenHandler(({ url }) => {
    if(tryHandleElectronCommand(url, win)) return { action: "deny" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if(tryHandleElectronCommand(url, win) || openExternalIfNeeded(url)){
      event.preventDefault();
    }
  });
}

function createLoginWindow(){
  loginWindow = new BrowserWindow({
    width: LOGIN_DEFAULT_WIDTH,
    height: LOGIN_DEFAULT_HEIGHT,
    minWidth: LOGIN_DEFAULT_WIDTH,
    maxWidth: LOGIN_DEFAULT_WIDTH,
    minHeight: LOGIN_MIN_HEIGHT,
    maxHeight: LOGIN_MAX_HEIGHT,
    resizable: false,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
    center: true,
    show: false,
    frame: false,
    movable: true,
    titleBarStyle: "hidden",
    useContentSize: true,
    title: APP_NAME,
    icon: path.join(__dirname, "build", "icon.ico"),
    backgroundColor: "#f5f6f8",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: SHARED_PARTITION
    }
  });

  attachNavigationHandlers(loginWindow);
  loginWindow.loadURL(START_URL);

  loginWindow.webContents.on("did-finish-load", async () => {
    await injectElectronLoginUi(loginWindow);
    await fitLoginWindow(true);
    if(loginWindow && !loginWindow.isDestroyed()){
      loginWindow.show();
      loginWindow.focus();
    }
    startLoginWatchers();
  });

  loginWindow.on("closed", () => {
    stopLoginTimers();
    stopAppLogoutWatcher();
    loginWindow = null;
  });
}

async function promoteLoginWindowToAppWindow(){
  if(!loginWindow || loginWindow.isDestroyed()) return;

  stopLoginTimers();
  stopAppLogoutWatcher();

  const win = loginWindow;
  appWindowRef = win;

  try{
    await win.webContents.insertCSS(`
      html, body{ overflow:auto !important; height:auto !important; }
      body.${LOGIN_LOCK_CLASS}{ overflow:auto !important; height:auto !important; min-height:100% !important; }
      body.${LOGIN_LOCK_CLASS} .lcLogin,
      body.${LOGIN_LOCK_CLASS} .lcLogin__card,
      body.${LOGIN_LOCK_CLASS} .lcLogin__form,
      body.${LOGIN_LOCK_CLASS} .lcLogin__mfaStage,
      body.${LOGIN_LOCK_CLASS} #lcLoginMfaStep{
        position:static !important;
        inset:auto !important;
        width:auto !important;
        min-width:0 !important;
        max-width:none !important;
        height:auto !important;
        min-height:0 !important;
        max-height:none !important;
        margin:0 !important;
        padding:0 !important;
        border-radius:inherit !important;
        overflow:visible !important;
      }
      #giElectronTitlebar{ display:flex !important; top:2px !important; left:2px !important; right:2px !important; width:auto !important; min-width:unset !important; height:24px !important; padding:0 !important; background:transparent !important; border:0 !important; box-shadow:none !important; pointer-events:auto !important; -webkit-app-region:drag !important; direction:ltr !important; }
      #giElectronTitlebar.gi-electron-titlebar{ justify-content:flex-start !important; }
      #giElectronTitlebar .gi-electron-titlebar__actions{ order:0 !important; margin-right:0 !important; margin-left:0 !important; -webkit-app-region:no-drag !important; justify-content:flex-start !important; }
      #giElectronTitlebar .gi-electron-titlebar__drag{ order:1 !important; flex:1 1 auto !important; width:auto !important; min-width:80px !important; max-width:none !important; height:20px !important; -webkit-app-region:drag !important; }
      #giElectronTitlebar.gi-electron-titlebar .gi-electron-titlebar__title{ display:none !important; }
    `);
  }catch(_){ }

  try{
    await win.webContents.executeJavaScript(`
      (() => {
        try{ document.body.classList.remove(${JSON.stringify(LOGIN_LOCK_CLASS)}); }catch(_){ }
        try{ document.getElementById('giElectronTitlebar')?.classList.add('gi-electron-titlebar--app'); }catch(_){ }
      })();
    `, true);
  }catch(_){ }

  const display = screen.getDisplayMatching(win.getBounds());
  const area = display?.workArea || screen.getPrimaryDisplay().workArea;
  const width = Math.min(APP_WINDOW.width, area.width);
  const height = Math.min(APP_WINDOW.height, area.height);
  const x = Math.round(area.x + ((area.width - width) / 2));
  const y = Math.round(area.y + Math.max(0, (area.height - height) / 2));

  try{ win.setResizable(true); }catch(_){ }
  try{ win.setFullScreenable(true); }catch(_){ }
  try{ win.setMinimumSize(APP_WINDOW.minWidth, APP_WINDOW.minHeight); }catch(_){ }
  try{ win.setMaximumSize(10000, 10000); }catch(_){ }
  try{ win.setBounds({ x, y, width, height }, true); }catch(_){ }
  try{ win.center(); }catch(_){ }
  try{ win.show(); }catch(_){ }
  try{ win.focus(); }catch(_){ }
  await syncFullscreenButton(win);
  win.removeAllListeners("enter-full-screen");
  win.removeAllListeners("leave-full-screen");
  win.on("enter-full-screen", () => { syncFullscreenButton(win); });
  win.on("leave-full-screen", () => { syncFullscreenButton(win); });

  startAppLogoutWatcher();

  win.on("closed", () => {
    stopAppLogoutWatcher();
    appWindowRef = null;
    if (process.platform !== "darwin") app.quit();
  });
}

async function restoreToLoginWindow(targetWin = null){
  const win = targetWin || appWindowRef || BrowserWindow.getAllWindows()[0];
  if(!win || win.isDestroyed()) return;

  stopAppLogoutWatcher();
  appWindowRef = null;
  loginWindow = win;
  lastLoginBoundsKey = "";

  try{ win.setFullScreen(false); }catch(_){ }
  try{ win.setFullScreenable(false); }catch(_){ }
  try{ win.setResizable(false); }catch(_){ }
  try{ win.setMinimumSize(LOGIN_DEFAULT_WIDTH, LOGIN_MIN_HEIGHT); }catch(_){ }
  try{ win.setMaximumSize(LOGIN_DEFAULT_WIDTH, LOGIN_MAX_HEIGHT); }catch(_){ }
  try{ win.setSize(LOGIN_DEFAULT_WIDTH, LOGIN_DEFAULT_HEIGHT); }catch(_){ }

  try{
    await injectElectronLoginUi(win);
    await win.webContents.insertCSS(ELECTRON_LOGIN_CSS);
  }catch(_){ }

  try{
    await win.webContents.executeJavaScript(`
      (() => {
        try{ document.body.classList.add(${JSON.stringify(LOGIN_LOCK_CLASS)}); }catch(_){ }
        try{ document.getElementById('giElectronTitlebar')?.classList.remove('gi-electron-titlebar--app'); }catch(_){ }
      })();
    `, true);
  }catch(_){ }

  await syncFullscreenButton(win);
  await fitLoginWindow(true);

  try{ win.center(); }catch(_){ }
  try{ win.show(); }catch(_){ }
  try{ win.focus(); }catch(_){ }

  startLoginWatchers();
}

async function injectElectronLoginUi(win){
  if(!win || win.isDestroyed()) return;
  try{
    await win.webContents.insertCSS(ELECTRON_LOGIN_CSS);
    await win.webContents.executeJavaScript(`
      (() => {
        if (document.getElementById('giElectronTitlebar')) return;

        const bar = document.createElement('div');
        bar.id = 'giElectronTitlebar';
        bar.className = 'gi-electron-titlebar';
        bar.innerHTML = \`
          <div class="gi-electron-titlebar__actions">
            <button class="gi-electron-titlebar__btn gi-electron-titlebar__btn--minimize" type="button" aria-label="מזער" title="מזער" data-gi-win="minimize">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
                <path d="M3 8.5h10"></path>
              </svg>
            </button>
            <button class="gi-electron-titlebar__btn gi-electron-titlebar__btn--fullscreen" type="button" aria-label="מסך מלא" title="מסך מלא" data-gi-win="fullscreen">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 2.5H2.5V5M11 2.5h2.5V5M5 13.5H2.5V11M11 13.5h2.5V11"></path>
              </svg>
            </button>
            <button class="gi-electron-titlebar__btn gi-electron-titlebar__btn--close" type="button" aria-label="סגור" title="סגור" data-gi-win="close">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
                <path d="M4 4l8 8M12 4l-8 8"></path>
              </svg>
            </button>
          </div>
          <div class="gi-electron-titlebar__drag" aria-hidden="true"></div>
          <div class="gi-electron-titlebar__title">${APP_NAME}</div>
        \`;

        bar.addEventListener('click', (event) => {
          const btn = event.target.closest('[data-gi-win]');
          if (!btn) return;
          const action = btn.getAttribute('data-gi-win');
          if (!action) return;
          window.location.href = 'electron://' + action;
        });

        document.body.appendChild(bar);
      })();
    `, true);
  }catch(_){}
}

async function readWindowMetrics(win){
  if(!win || win.isDestroyed()) return null;
  try{
    return await win.webContents.executeJavaScript(`
      (() => {
        const body = document.body;
        const card = document.querySelector('#lcLogin .lcLogin__card');
        const mfaStep = document.getElementById('lcLoginMfaStep');
        if (!card) {
          return {
            isLocked: !!(body && body.classList.contains(${JSON.stringify(LOGIN_LOCK_CLASS)})),
            hasCard: false,
            mfaVisible: !!(mfaStep && !mfaStep.hidden),
            loginVisible: false,
            appReady: false,
            height: 0
          };
        }
        const styles = getComputedStyle(card);
        const rect = card.getBoundingClientRect();
        const marginTop = parseFloat(styles.marginTop || '0') || 0;
        const marginBottom = parseFloat(styles.marginBottom || '0') || 0;
        const text = ((body && body.innerText) || '').replace(/\s+/g, ' ').trim();
        const loginVisible = !!card && rect.width > 0 && rect.height > 0;
        const appReady = ["לקוחות", "הצעות", "דשבורד", "שיקופים", "התהליכים שלי"].some((token) => text.includes(token));
        return {
          isLocked: !!(body && body.classList.contains(${JSON.stringify(LOGIN_LOCK_CLASS)})),
          hasCard: true,
          mfaVisible: !!(mfaStep && !mfaStep.hidden),
          loginVisible,
          appReady,
          height: Math.ceil(rect.height + marginTop + marginBottom)
        };
      })();
    `, true);
  }catch(_){
    return null;
  }
}

async function readLoginMetrics(){
  return await readWindowMetrics(loginWindow);
}

async function fitLoginWindow(force = false){
  if(!loginWindow || loginWindow.isDestroyed()) return;
  const metrics = await readLoginMetrics();
  if(!metrics || !metrics.hasCard) return;

  const width = LOGIN_DEFAULT_WIDTH;
  const cardHeight = metrics.height || LOGIN_DEFAULT_HEIGHT;
  const height = clamp(
    cardHeight + LOGIN_TITLEBAR_HEIGHT - LOGIN_BOTTOM_TRIM_PX,
    LOGIN_MIN_HEIGHT,
    metrics.mfaVisible ? LOGIN_MAX_HEIGHT : 740
  );

  const display = screen.getDisplayMatching(loginWindow.getBounds());
  const area = display?.workArea || screen.getPrimaryDisplay().workArea;
  const x = Math.round(area.x + ((area.width - width) / 2) + LOGIN_CENTER_OFFSET_X);
  const y = Math.round(area.y + Math.max(18, (area.height - height) / 2));
  const nextKey = `${width}x${height}@${x},${y}`;

  if(force || lastLoginBoundsKey !== nextKey){
    lastLoginBoundsKey = nextKey;
    loginWindow.setBounds({ x, y, width, height }, false);
  }
}

function startAppLogoutWatcher(){
  stopAppLogoutWatcher();

  appLogoutTimer = setInterval(async () => {
    if(!appWindowRef || appWindowRef.isDestroyed()){
      stopAppLogoutWatcher();
      return;
    }

    const metrics = await readWindowMetrics(appWindowRef);
    if(!metrics) return;

    const backToLogin = metrics.isLocked === true && metrics.hasCard === true && metrics.loginVisible === true;
    if(!backToLogin) return;

    stopAppLogoutWatcher();
    await restoreToLoginWindow(appWindowRef);
  }, LOGIN_CHECK_INTERVAL_MS);
}

function startLoginWatchers(){
  stopLoginTimers();
  loginReadyTicks = 0;

  loginCheckTimer = setInterval(async () => {
    if(!loginWindow || loginWindow.isDestroyed()){
      stopLoginTimers();
      return;
    }

    const metrics = await readLoginMetrics();
    if(!metrics) return;

    const appReady = metrics.isLocked === false && metrics.appReady === true;
    loginReadyTicks = appReady ? (loginReadyTicks + 1) : 0;

    if(loginReadyTicks >= 2){
      stopLoginTimers();

      await promoteLoginWindowToAppWindow();
    }
  }, LOGIN_CHECK_INTERVAL_MS);

  loginSizeTimer = setInterval(async () => {
    const metrics = await readLoginMetrics();
    if(!metrics || metrics.appReady) return;
    fitLoginWindow(false);
  }, LOGIN_SIZE_INTERVAL_MS);
}

app.whenReady().then(async () => {
  const dataRoot = path.join(app.getPath("appData"), "GEMEL-INVEST-CRM");
  app.setPath("userData", path.join(dataRoot, "user-data"));
  app.setPath("sessionData", path.join(dataRoot, "session-data"));
  app.setPath("cache", path.join(dataRoot, "cache"));

  try {
    const ses = session.defaultSession;
    if (ses) {
      await ses.clearCache().catch(() => {});
    }
  } catch (_) {}

  createLoginWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLoginWindow();
    }
  });
});

app.on("window-all-closed", function () {
  stopLoginTimers();
  stopAppLogoutWatcher();
  if (process.platform !== "darwin") app.quit();
});
