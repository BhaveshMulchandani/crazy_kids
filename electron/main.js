const { app, BrowserWindow, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

let mainWindow;

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