const { contextBridge, ipcRenderer } = require("electron");

// Silent, fixed-printer printing (no OS dialog, no manual printer picker) —
// main.js maps these straight to the receipt / kitchen printers by
// deviceName. Exposed via contextBridge since contextIsolation is on.
contextBridge.exposeInMainWorld("electronAPI", {
  printInvoice: (html) => ipcRenderer.invoke("print-invoice", html),
  printKOT: (html) => ipcRenderer.invoke("print-kot", html),
});

window.addEventListener("DOMContentLoaded", () => {});
