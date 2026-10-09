const { ipcRenderer } = require("electron");

const ICON_MAX = '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><rect x="2.2" y="2.2" width="7.6" height="7.6" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
const ICON_RESTORE = '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M4 3.2h5.2V8.4M3 4.4h5.2V9.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';

window.addEventListener("DOMContentLoaded", () => {
  const bar = document.getElementById("giWindowButtons");
  if (!bar) return;
  const maxButton = bar.querySelector('[data-act="maximize"]');
  bar.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    event.preventDefault();
    ipcRenderer.send("desktop-window", button.getAttribute("data-act"));
  });
  ipcRenderer.on("desktop-window-state", (_event, maximized) => {
    maxButton.innerHTML = maximized ? ICON_RESTORE : ICON_MAX;
    maxButton.setAttribute("aria-label", maximized ? "שחזור" : "הגדלה");
  });
});
