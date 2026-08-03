const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

let mainWindow;

// Fixed printer assignment (see docs/…): the desk never picks a printer
// manually — invoices always go to the receipt printer, KOTs always go to
// the kitchen printer.
const PRINTER_NAMES = {
  invoice: "EPSON TM-T82X",
  kot: "Kitchen_Print",
};

// Windows driver installs frequently register a printer under a name that
// only *contains* the configured name (e.g. "EPSON TM-T82X Receipt6" for a
// configured "EPSON TM-T82X") — an exact-only match silently fell through
// to the system default printer whenever that happened, which is what
// looked like "auto-select isn't working" (no error, just the wrong
// printer). Tries, in order: exact match, case-insensitive exact match,
// case-insensitive substring match either direction. Still falls back to
// undefined (system default) if nothing matches at all.
function findPrinter(printers, deviceName) {
  const exact = printers.find((p) => p.name === deviceName);
  if (exact) return exact;

  const target = deviceName.toLowerCase();
  const ciExact = printers.find((p) => p.name.toLowerCase() === target);
  if (ciExact) return ciExact;

  return printers.find((p) => {
    const name = p.name.toLowerCase();
    return name.includes(target) || target.includes(name);
  });
}

// Renders `html` in an off-screen window and sends it straight to
// `deviceName` with no OS print dialog. Used for both invoice and KOT
// printing so the desk operator never has to choose a printer. Falls back
// to the system default printer (still silently, no dialog) if the
// configured device isn't present on this machine, so a printer rename/
// unplug degrades gracefully instead of blocking checkout.
async function silentPrintHtml(html, { deviceName, pageSize }) {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: false },
  });

  try {
    const dataUrl = `data:text/html;charset=utf-8;base64,${Buffer.from(
      html,
      "utf8"
    ).toString("base64")}`;
    await printWindow.loadURL(dataUrl);

    const printers = await printWindow.webContents.getPrintersAsync();
    const matched = findPrinter(printers, deviceName);
    if (!matched) {
      console.warn(
        `[print] Configured printer "${deviceName}" not found; using system default instead.`
      );
    }

    await new Promise((resolve, reject) => {
      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          // Electron's print() needs the printer's real registered name —
          // matched.name may differ from the configured deviceName when a
          // fuzzy (substring) match was used above.
          ...(matched ? { deviceName: matched.name } : {}),
          margins: { marginType: "none" },
          pageSize,
        },
        (success, errorType) => {
          if (success) resolve();
          else reject(new Error(errorType || "Print failed"));
        }
      );
    });

    return { printed: true, matchedPrinter: !!matched };
  } finally {
    printWindow.destroy();
  }
}

// 80mm-wide receipt roll, generous nominal length — the thermal driver cuts
// at the actual content end, this just avoids Electron clipping the layout
// to a short fixed page.
const RECEIPT_PAGE_SIZE = { width: 80000, height: 297000 };

ipcMain.handle("print-invoice", async (_event, html) => {
  try {
    return await silentPrintHtml(html, {
      deviceName: PRINTER_NAMES.invoice,
      pageSize: RECEIPT_PAGE_SIZE,
    });
  } catch (err) {
    console.error("[print-invoice] failed:", err);
    return { printed: false, error: err.message };
  }
});

ipcMain.handle("print-kot", async (_event, html) => {
  try {
    return await silentPrintHtml(html, {
      deviceName: PRINTER_NAMES.kot,
      pageSize: RECEIPT_PAGE_SIZE,
    });
  } catch (err) {
    console.error("[print-kot] failed:", err);
    return { printed: false, error: err.message };
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    resizable: true,
    maximizable: true,
    show: false,
    icon: path.join(__dirname, "../assets/logo.ico"),

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (app.isPackaged) {
    // Production
    mainWindow.loadFile(
      path.join(__dirname, "../frontend/dist/index.html")
    );

    // Check for updates
    autoUpdater.checkForUpdatesAndNotify();
  } else {
    // Development
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ============================
// Auto Updater Events
// ============================

autoUpdater.on("checking-for-update", () => {
  console.log("Checking for updates...");
});

autoUpdater.on("update-available", () => {
  console.log("Update available.");

  dialog.showMessageBox({
    type: "info",
    title: "Update Available",
    message: "A new version is available and is being downloaded.",
  });
});

autoUpdater.on("update-not-available", () => {
  console.log("No updates available.");
});

autoUpdater.on("download-progress", (progress) => {
  console.log(
    `Download Progress: ${progress.percent.toFixed(2)}%`
  );
});

autoUpdater.on("update-downloaded", () => {
  dialog
    .showMessageBox({
      type: "info",
      title: "Update Ready",
      message:
        "The latest version has been downloaded. Restart now to install the update.",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1,
    })
    .then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
});

autoUpdater.on("error", (err) => {
  console.error("Auto Updater Error:", err);

  dialog.showMessageBox({
    type: "error",
    title: "Update Error",
    message: err == null ? "Unknown error" : err.message,
  });
});

// ============================

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});