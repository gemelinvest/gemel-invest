const { app, BrowserWindow, BrowserView, Menu, shell, session, ipcMain } = require("electron");
const path = require("path");

const START_URL = "https://gemelinvest.github.io/gemel-invest/";
const APP_HOST = "gemelinvest.github.io";
const CHROME_HEIGHT = 30;

let clearingCache = false;

function isAppUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    return parsed.hostname === APP_HOST;
  } catch (_e) {
    return false;
  }
}

function basePreferences() {
  return {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    devTools: false
  };
}

function childWindowOptions() {
  return {
    title: "GEMEL CRM",
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 480,
    frame: false,
    thickFrame: true,
    autoHideMenuBar: true,
    backgroundColor: "#f8fafc",
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: basePreferences()
  };
}

function sendWindowState(win) {
  if (win.isDestroyed()) return;
  const maximized = win.isMaximized();
  const targets = [win.webContents];
  win.getBrowserViews().forEach((view) => targets.push(view.webContents));
  targets.forEach((contents) => {
    if (!contents.isDestroyed()) contents.send("desktop-window-state", maximized);
  });
}

function attachChromeBar(win) {
  const chrome = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, "chrome-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false
    }
  });
  chrome.setBackgroundColor("#f8fafc");
  win.addBrowserView(chrome);
  win.setTopBrowserView(chrome);

  const layout = () => {
    if (win.isDestroyed()) return;
    const [width] = win.getContentSize();
    chrome.setBounds({ x: 0, y: 0, width, height: CHROME_HEIGHT });
    win.setTopBrowserView(chrome);
  };
  layout();
  win.on("resize", layout);
  win.on("maximize", () => { layout(); sendWindowState(win); });
  win.on("unmaximize", () => { layout(); sendWindowState(win); });
  win.on("enter-full-screen", layout);
  win.on("leave-full-screen", layout);
  chrome.webContents.loadFile(path.join(__dirname, "chrome.html"));
  return chrome;
}

function attachNavigation(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    if (!url || url === "about:blank" || isAppUrl(url)) {
      return { action: "allow", overrideBrowserWindowOptions: childWindowOptions() };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
      return;
    }
    if (url.includes("nocache=") && !clearingCache) {
      event.preventDefault();
      clearingCache = true;
      contents.session.clearCache()
        .catch(() => {})
        .then(() => contents.loadURL(url))
        .finally(() => { clearingCache = false; });
    }
  });

  contents.on("did-create-window", (child) => {
    attachChromeBar(child);
    attachNavigation(child.webContents);
    child.webContents.on("did-finish-load", () => sendWindowState(child));
  });
}

function reveal(win, layout) {
  if (win.isDestroyed() || win.isVisible()) return;
  win.maximize();
  win.show();
  layout();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    title: "GEMEL CRM",
    show: false,
    frame: false,
    thickFrame: true,
    autoHideMenuBar: true,
    backgroundColor: "#f8fafc",
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false
    }
  });

  const page = new BrowserView({
    webPreferences: {
      ...basePreferences(),
      additionalArguments: ["--gi-chrome=external"]
    }
  });
  win.addBrowserView(page);
  attachChromeBar(win);

  const layout = () => {
    if (win.isDestroyed()) return;
    const [width, height] = win.getContentSize();
    page.setBounds({
      x: 0,
      y: CHROME_HEIGHT,
      width,
      height: Math.max(0, height - CHROME_HEIGHT)
    });
  };
  layout();
  win.on("resize", layout);
  win.on("maximize", layout);
  win.on("unmaximize", layout);
  win.on("enter-full-screen", layout);
  win.on("leave-full-screen", layout);

  attachNavigation(page.webContents);
  page.webContents.on("did-finish-load", () => sendWindowState(win));
  page.webContents.once("did-finish-load", () => {
    reveal(win, layout);
    if (!page.webContents.isDestroyed()) page.webContents.focus();
  });
  page.webContents.on("did-fail-load", () => reveal(win, layout));
  page.webContents.loadURL(START_URL);
}

app.setAppUserModelId("com.gemelinvest.crm");

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(true);
  });

  ipcMain.on("desktop-window", (event, action) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (action === "minimize") win.minimize();
    else if (action === "maximize") {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    } else if (action === "close") win.close();
  });

  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
