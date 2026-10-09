const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronShell", {
  isDesktopApp: true
});

const ICON_MIN = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 6.5h8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
const ICON_MAX = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect x="2.2" y="2.2" width="7.6" height="7.6" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
const ICON_RESTORE = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M4 3.2h5.2V8.4M3 4.4h5.2V9.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 3l6 6M9 3L3 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

function installChrome() {
  const root = document.documentElement;
  if (!root || document.getElementById("giDesktopChrome")) return;
  root.classList.add("gi-desktop-app");

  const style = document.createElement("style");
  style.id = "giDesktopChromeStyle";
  style.textContent = [
    "html.gi-desktop-app .topbar:not(#\\9):not(#\\9){padding-left:158px !important;-webkit-app-region:drag;}",
    "html.gi-desktop-app .topbar button,html.gi-desktop-app .topbar a,html.gi-desktop-app .topbar input,html.gi-desktop-app .topbar select,html.gi-desktop-app .topbar textarea,html.gi-desktop-app .topbar label,html.gi-desktop-app .giTopSearch,html.gi-desktop-app .giUserMenu{-webkit-app-region:no-drag;}",
    "#giDesktopChrome{position:fixed;top:17px;left:14px;z-index:2147483647;display:flex;gap:6px;direction:ltr;-webkit-app-region:no-drag;}",
    "#giDesktopChrome button{width:36px;height:36px;border:0;border-radius:10px;background:rgba(255,255,255,.94);color:#1e293b;box-shadow:0 1px 2px rgba(15,23,42,.16);display:grid;place-items:center;cursor:pointer;padding:0;}",
    "#giDesktopChrome button:hover{background:#eef2ff;}",
    "#giDesktopChrome button[data-act=close]:hover{background:#ED1C24;color:#fff;}"
  ].join("");
  (document.head || root).appendChild(style);

  const bar = document.createElement("div");
  bar.id = "giDesktopChrome";
  bar.innerHTML = [
    '<button type="button" data-act="minimize" aria-label="מזעור">' + ICON_MIN + "</button>",
    '<button type="button" data-act="maximize" aria-label="הגדלה">' + ICON_MAX + "</button>",
    '<button type="button" data-act="close" aria-label="סגירה">' + ICON_CLOSE + "</button>"
  ].join("");
  bar.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    ipcRenderer.send("desktop-window", button.getAttribute("data-act"));
  });
  root.appendChild(bar);

  const maxButton = bar.querySelector('[data-act="maximize"]');
  ipcRenderer.on("desktop-window-state", (_event, maximized) => {
    maxButton.innerHTML = maximized ? ICON_RESTORE : ICON_MAX;
    maxButton.setAttribute("aria-label", maximized ? "שחזור" : "הגדלה");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installChrome, { once: true });
} else {
  installChrome();
}
