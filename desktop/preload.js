const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronShell", {
  isDesktopApp: true
});
