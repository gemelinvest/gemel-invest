const { app, BrowserWindow, Menu, shell, session, ipcMain } = require("electron");
const path = require("path");

const START_URL = "https://gemelinvest.github.io/gemel-invest/";
const APP_HOST = "gemelinvest.github.io";

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

function windowChrome() {
  return {
    frame: false,
    thickFrame: true,
    autoHideMenuBar: true,
    backgroundColor: "#3870ED",
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false
    }
  };
}

function bindWindow(win) {
  const sendState = () => {
    if (win.isDestroyed()) return;
    win.webContents.send("desktop-window-state", win.isMaximized());
  };
  win.on("maximize", sendState);
  win.on("unmaximize", sendState);
  win.webContents.on("did-finish-load", sendState);
}

function childWindowOptions() {
  return {
    title: "GEMEL CRM",
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 480,
    ...windowChrome()
  };
}

function attachNavigation(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    if (!url || url === "about:blank") {
      return { action: "allow", overrideBrowserWindowOptions: childWindowOptions() };
    }
    if (isAppUrl(url)) {
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
}

function reveal(win) {
  if (win.isDestroyed() || win.isVisible()) return;
  win.maximize();
  win.show();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    title: "GEMEL CRM",
    show: false,
    ...windowChrome()
  });

  bindWindow(win);
  attachNavigation(win.webContents);
  win.webContents.on("did-create-window", (child) => {
    bindWindow(child);
    attachNavigation(child.webContents);
  });
  win.once("ready-to-show", () => reveal(win));
  win.webContents.on("did-fail-load", () => reveal(win));
  win.loadURL(START_URL);
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
