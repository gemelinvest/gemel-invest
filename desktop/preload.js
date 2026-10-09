const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronShell", {
  isDesktopApp: true
});

if (!process.argv.includes("--gi-chrome=external")) {
  const insetPopup = () => {
    const root = document.documentElement;
    if (!root || root.classList.contains("gi-desktop-app")) return;
    root.classList.add("gi-desktop-app");
    const style = document.createElement("style");
    style.textContent = [
      "html.gi-desktop-app body{position:fixed !important;top:30px !important;left:0 !important;right:0 !important;bottom:0 !important;height:auto !important;min-height:0 !important;margin:0 !important;overflow:hidden !important;transform:translateZ(0);}",
      "html.gi-desktop-app #app:not(#\\9):not(#\\9),html.gi-desktop-app .app:not(#\\9):not(#\\9),html.gi-desktop-app .sidebar:not(#\\9):not(#\\9),html.gi-desktop-app .main:not(#\\9):not(#\\9){height:100% !important;min-height:0 !important;max-height:100% !important;}"
    ].join("");
    (document.head || root).appendChild(style);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", insetPopup, { once: true });
  } else {
    insetPopup();
  }
}
