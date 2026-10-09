const { app, BrowserWindow, Menu, shell, session } = require("electron");
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

function childWindowOptions() {
  return {
    title: "GEMEL CRM",
    autoHideMenuBar: true,
    backgroundColor: "#3870ED",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false
    }
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    title: "GEMEL CRM",
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
  });

  attachNavigation(win.webContents);
  win.webContents.on("did-create-window", (child) => attachNavigation(child.webContents));
  win.loadURL(START_URL);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(true);
  });
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
